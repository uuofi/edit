import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  fetchDoctorAppointments,
  fetchDoctorDashboard,
  fetchSecretaries,
  generateDailyReportExcelLink,
  generateMonthlyReportExcelLink,
} from "../lib/api";
import { DAY_LABELS, WEEKDAY_KEYS } from "../lib/constants/schedule";
import { STATUS_LABELS } from "../lib/constants/statusLabels";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../lib/useTheme";

const toLocalDateIso = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getAppointmentDayIso = (appointment) => {
  const raw = String(
    appointment?.appointmentDateIso || appointment?.appointmentDate || ""
  ).trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return toLocalDateIso(parsed) || "";
  }

  const partialIso = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(partialIso) ? partialIso : "";
};

const buildDaysRange = (startIso) => {
  if (!startIso) return [];
  const days = [];
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return [];
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  monthEnd.setHours(0, 0, 0, 0);

  const cursor = new Date(start);
  while (cursor <= monthEnd) {
    const dayKey = WEEKDAY_KEYS[cursor.getDay()];
    days.push({
      key: `${cursor.getTime()}`,
      iso: toLocalDateIso(cursor),
      label: `${DAY_LABELS[dayKey] || dayKey} ${cursor.toLocaleDateString("ar-EG", {
        day: "numeric",
        month: "numeric",
      })}`,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const sameDay = (appointment, iso) => {
  if (!iso) return false;
  return getAppointmentDayIso(appointment) === iso;
};

export default function ProviderReportsScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startIso, setStartIso] = useState(null);
  const [selectedIso, setSelectedIso] = useState(() => toLocalDateIso(new Date()));
  const [doctorFee, setDoctorFee] = useState(0);
  const days = useMemo(() => buildDaysRange(startIso), [startIso]);

  // ─── Tab state ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("daily"); // "daily" | "monthly"

  // ─── Monthly state ────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // 0-indexed month
  });
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const monthLabel = useMemo(() => {
    const MONTH_NAMES_AR = [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ];
    return `${MONTH_NAMES_AR[selectedMonth.month]} ${selectedMonth.year}`;
  }, [selectedMonth]);

  const monthIso = useMemo(
    () => `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, "0")}`,
    [selectedMonth]
  );

  const prevMonth = () => {
    setSelectedMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };
  const nextMonth = () => {
    setSelectedMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDoctorAppointments();
      setAppointments(data.appointments || []);
    } catch (err) {
      Alert.alert("خطأ", err.message || "تعذّر تحميل الحجوزات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchDoctorDashboard();
        const created = data?.doctor?.createdAt;
        const fee = Number(data?.doctor?.consultationFee) || 0;
        setDoctorFee(fee);
        if (created && active) {
          setStartIso(toLocalDateIso(new Date(created)));
        } else if (active) {
          setStartIso(toLocalDateIso(new Date()));
        }
      } catch (_err) {
        if (active) setStartIso(toLocalDateIso(new Date()));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Fetch employees when switching to monthly tab
  useEffect(() => {
    if (activeTab !== "monthly") return;
    let active = true;
    (async () => {
      setEmployeesLoading(true);
      try {
        const data = await fetchSecretaries();
        if (active) setEmployees(Array.isArray(data) ? data : data?.secretaries || []);
      } catch (_e) {
        // ignore
      } finally {
        if (active) setEmployeesLoading(false);
      }
    })();
    return () => { active = false; };
  }, [activeTab]);

  // ─── Daily computed ────────────────────────────────────────
  const filtered = useMemo(
    () => appointments.filter((a) => sameDay(a, selectedIso)),
    [appointments, selectedIso]
  );

  const billable = useMemo(
    () => filtered.filter((a) => a.status !== "cancelled"),
    [filtered]
  );

  const totalMoney = useMemo(() => {
    if (!billable.length) return 0;
    return billable.reduce((sum, a) => {
      const price = Number(a?.service?.price) || doctorFee || 0;
      return sum + price;
    }, 0);
  }, [billable, doctorFee]);

  const dayStatusCounts = useMemo(
    () =>
      filtered.reduce(
        (acc, item) => {
          const s = String(item?.status || "");
          if (s === "confirmed") acc.confirmed += 1;
          else if (s === "completed") acc.completed += 1;
          else if (s === "pending") acc.pending += 1;
          else if (s === "cancelled") acc.cancelled += 1;
          return acc;
        },
        { confirmed: 0, completed: 0, pending: 0, cancelled: 0 }
      ),
    [filtered]
  );

  // ─── Monthly computed ──────────────────────────────────────
  const monthlyFiltered = useMemo(() => {
    const prefix = monthIso; // "2026-03"
    return appointments.filter((a) => {
      const d = getAppointmentDayIso(a);
      return d.startsWith(prefix);
    });
  }, [appointments, monthIso]);

  const monthlyBillable = useMemo(
    () => monthlyFiltered.filter((a) => a.status === "confirmed" || a.status === "completed"),
    [monthlyFiltered]
  );

  const monthlyTotalMoney = useMemo(() => {
    return monthlyBillable.reduce((sum, a) => {
      const price = Number(a?.service?.price) || doctorFee || 0;
      return sum + price;
    }, 0);
  }, [monthlyBillable, doctorFee]);

  const monthlyStatusCounts = useMemo(
    () =>
      monthlyFiltered.reduce(
        (acc, item) => {
          const s = String(item?.status || "");
          if (s === "confirmed") acc.confirmed += 1;
          else if (s === "completed") acc.completed += 1;
          else if (s === "pending") acc.pending += 1;
          else if (s === "cancelled") acc.cancelled += 1;
          return acc;
        },
        { confirmed: 0, completed: 0, pending: 0, cancelled: 0 }
      ),
    [monthlyFiltered]
  );

  const totalSalaries = useMemo(
    () => employees.reduce((sum, e) => sum + (Number(e.monthlySalary) || 0), 0),
    [employees]
  );

  const netRevenue = useMemo(() => monthlyTotalMoney - totalSalaries, [monthlyTotalMoney, totalSalaries]);

  // Group monthly appointments by date
  const monthlyGrouped = useMemo(() => {
    const groups = {};
    monthlyFiltered.forEach((a) => {
      const d = a.appointmentDate || a.appointmentDateIso || getAppointmentDayIso(a);
      if (!groups[d]) groups[d] = [];
      groups[d].push(a);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [monthlyFiltered]);

  const openDrawer = () => {
    if (typeof navigation?.openDrawer === "function") {
      navigation.openDrawer();
      return;
    }
    const parent = navigation?.getParent?.();
    if (typeof parent?.openDrawer === "function") parent.openDrawer();
  };

  const downloadDailyExcel = async () => {
    try {
      const data = await generateDailyReportExcelLink(selectedIso);
      if (!data?.downloadUrl) {
        Alert.alert("خطأ", "تعذر إنشاء رابط التقرير");
        return;
      }
      await Linking.openURL(data.downloadUrl);
    } catch (err) {
      Alert.alert("خطأ", err?.message || "تعذر تحميل تقرير الإكسل");
    }
  };

  const downloadMonthlyExcel = async () => {
    try {
      const data = await generateMonthlyReportExcelLink(monthIso);
      if (!data?.downloadUrl) {
        Alert.alert("خطأ", "تعذر إنشاء رابط التقرير");
        return;
      }
      await Linking.openURL(data.downloadUrl);
    } catch (err) {
      Alert.alert("خطأ", err?.message || "تعذر تحميل تقرير الإكسل");
    }
  };

  // ─── Render helpers ────────────────────────────────────────
  const renderAppointmentCard = (appointment) => {
    const statusColor =
      { confirmed: colors.success, completed: "#4CAF50", pending: colors.warning, cancelled: colors.danger }[
        appointment.status
      ] || colors.textMuted;
    const price = Number(appointment?.service?.price) || doctorFee || 0;
    return (
      <View key={appointment._id} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.patient}>{appointment.user?.name || "مراجع"}</Text>
          <Text style={[styles.status, { color: statusColor }]}>
            {STATUS_LABELS[appointment.status] || appointment.status}
          </Text>
        </View>

        <View style={styles.cardBody}>
          {appointment.bookingNumber ? (
            <View style={styles.cardDetailRow}>
              <Text style={styles.cardDetailLabel}>رقم الحجز</Text>
              <Text style={styles.cardDetailValue}>
                {appointment.doctorQueueNumber ?? appointment.doctorIndex ?? appointment.bookingNumber}
              </Text>
            </View>
          ) : null}

          <View style={styles.cardDetailRow}>
            <Text style={styles.cardDetailLabel}>الوقت</Text>
            <Text style={styles.cardDetailValue}>{appointment.appointmentTime || "-"}</Text>
          </View>

          {appointment.user?.age ? (
            <View style={styles.cardDetailRow}>
              <Text style={styles.cardDetailLabel}>العمر</Text>
              <Text style={styles.cardDetailValue}>{appointment.user.age}</Text>
            </View>
          ) : null}

          {appointment.service?.name ? (
            <View style={styles.cardDetailRow}>
              <Text style={styles.cardDetailLabel}>الخدمة</Text>
              <Text style={styles.cardDetailValue}>{appointment.service.name}</Text>
            </View>
          ) : null}

          <View style={styles.cardDetailRow}>
            <Text style={styles.cardDetailLabel}>سعر الكشفية</Text>
            <Text style={[styles.cardDetailValue, { color: colors.primary, fontWeight: "700" }]}>
              {price > 0 ? `${price} د.ع` : "-"}
            </Text>
          </View>

          {appointment.actionBySecretary?.secretaryName ? (
            <View style={styles.cardDetailRow}>
              <Text style={styles.cardDetailLabel}>الموظف المسؤول</Text>
              <Text style={styles.cardDetailValue}>{appointment.actionBySecretary.secretaryName}</Text>
            </View>
          ) : null}

          {appointment.assignedEmployee?.secretaryName ? (
            <View style={styles.cardDetailRow}>
              <Text style={[styles.cardDetailLabel, { color: "#4CAF50" }]}>العامل على الحالة</Text>
              <Text style={[styles.cardDetailValue, { color: "#4CAF50" }]}>
                {appointment.assignedEmployee.secretaryName}
              </Text>
            </View>
          ) : null}
        </View>

        {appointment.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>الحالة المرضية</Text>
            <Text style={styles.value}>{appointment.notes}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ─── Hero ──────────────────────────────────────────── */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Feather name="activity" size={18} color={colors.primary} />
          </View>
          <TouchableOpacity style={styles.menuBtn} onPress={openDrawer}>
            <Feather name="menu" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>لوحة تقارير الطبيب</Text>
        <Text style={styles.heroSubtitle}>متابعة الأداء اليومي والشهري بشكل واضح وسريع.</Text>
      </View>

      {/* ─── Tab Bar ───────────────────────────────────────── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "daily" && styles.tabBtnActive]}
          onPress={() => setActiveTab("daily")}
        >
          <Feather name="calendar" size={16} color={activeTab === "daily" ? "#fff" : colors.primary} />
          <Text style={[styles.tabText, activeTab === "daily" && styles.tabTextActive]}>التقرير اليومي</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "monthly" && styles.tabBtnActive]}
          onPress={() => setActiveTab("monthly")}
        >
          <Feather name="bar-chart-2" size={16} color={activeTab === "monthly" ? "#fff" : colors.primary} />
          <Text style={[styles.tabText, activeTab === "monthly" && styles.tabTextActive]}>التقرير الشهري</Text>
        </TouchableOpacity>
      </View>

      {/* ═══════════════ DAILY TAB ═══════════════ */}
      {activeTab === "daily" && (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>التقارير اليومية</Text>
            <TouchableOpacity style={styles.refresh} onPress={loadAppointments}>
              <Feather name="refresh-ccw" size={16} color={colors.primary} />
              <Text style={styles.refreshText}>تحديث</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.calendarBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayRow}
            >
              {days.map((day) => {
                const active = day.iso === selectedIso;
                return (
                  <TouchableOpacity
                    key={day.key}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() => setSelectedIso(day.iso)}
                  >
                    <Text style={[styles.dayText, active && styles.dayTextActive]}>{day.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>مجموع المراجعين</Text>
              <Text style={styles.summaryValue}>{billable.length}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>مجموع المبلغ</Text>
              <Text style={styles.summaryValue}>{totalMoney > 0 ? `${totalMoney} د.ع` : "0"}</Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { borderBottomColor: colors.success, borderBottomWidth: 3 }]}>
              <Text style={styles.kpiLabel}>مؤكدة</Text>
              <Text style={[styles.kpiValue, { color: colors.success }]}>{dayStatusCounts.confirmed}</Text>
            </View>
            <View style={[styles.kpiCard, { borderBottomColor: "#4CAF50", borderBottomWidth: 3 }]}>
              <Text style={styles.kpiLabel}>مكتملة</Text>
              <Text style={[styles.kpiValue, { color: "#4CAF50" }]}>{dayStatusCounts.completed}</Text>
            </View>
            <View style={[styles.kpiCard, { borderBottomColor: colors.warning, borderBottomWidth: 3 }]}>
              <Text style={styles.kpiLabel}>بانتظار</Text>
              <Text style={[styles.kpiValue, { color: colors.warning }]}>{dayStatusCounts.pending}</Text>
            </View>
            <View style={[styles.kpiCard, { borderBottomColor: colors.danger, borderBottomWidth: 3 }]}>
              <Text style={styles.kpiLabel}>ملغاة</Text>
              <Text style={[styles.kpiValue, { color: colors.danger }]}>{dayStatusCounts.cancelled}</Text>
            </View>
          </View>

          <View style={styles.exportRow}>
            <TouchableOpacity style={styles.exportBtn} onPress={downloadDailyExcel}>
              <Feather name="download" size={16} color={colors.primary} />
              <Text style={styles.exportText}>تحميل تقرير يومي Excel</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>لا توجد حجوزات في هذا اليوم</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {filtered.map(renderAppointmentCard)}
            </ScrollView>
          )}
        </>
      )}

      {/* ═══════════════ MONTHLY TAB ═══════════════ */}
      {activeTab === "monthly" && (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Month selector */}
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={nextMonth} style={styles.monthArrow}>
              <Feather name="chevron-right" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
              <Feather name="chevron-left" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Section: إحصائيات الشهر */}
          <View style={styles.sectionHeader}>
            <Feather name="pie-chart" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>إحصائيات الشهر</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>إجمالي الحجوزات</Text>
              <Text style={styles.summaryValue}>{monthlyFiltered.length}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>المكتملة + المؤكدة</Text>
              <Text style={styles.summaryValue}>{monthlyBillable.length}</Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { borderBottomColor: "#4CAF50", borderBottomWidth: 3 }]}>
              <Text style={styles.kpiLabel}>مكتملة</Text>
              <Text style={[styles.kpiValue, { color: "#4CAF50" }]}>{monthlyStatusCounts.completed}</Text>
            </View>
            <View style={[styles.kpiCard, { borderBottomColor: colors.success, borderBottomWidth: 3 }]}>
              <Text style={styles.kpiLabel}>مؤكدة</Text>
              <Text style={[styles.kpiValue, { color: colors.success }]}>{monthlyStatusCounts.confirmed}</Text>
            </View>
            <View style={[styles.kpiCard, { borderBottomColor: colors.warning, borderBottomWidth: 3 }]}>
              <Text style={styles.kpiLabel}>بانتظار</Text>
              <Text style={[styles.kpiValue, { color: colors.warning }]}>{monthlyStatusCounts.pending}</Text>
            </View>
            <View style={[styles.kpiCard, { borderBottomColor: colors.danger, borderBottomWidth: 3 }]}>
              <Text style={styles.kpiLabel}>ملغاة</Text>
              <Text style={[styles.kpiValue, { color: colors.danger }]}>{monthlyStatusCounts.cancelled}</Text>
            </View>
          </View>

          {/* Section: الملخص المالي */}
          <View style={styles.sectionHeader}>
            <Feather name="dollar-sign" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>الملخص المالي</Text>
          </View>

          <View style={styles.financeCard}>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>مجموع أموال العيادة (المكتملة + المؤكدة)</Text>
              <Text style={[styles.finValue, { color: colors.primary }]}>{monthlyTotalMoney} د.ع</Text>
            </View>

            <View style={styles.finDivider} />

            <View style={styles.finRow}>
              <Text style={styles.finLabel}>إجمالي رواتب الموظفين</Text>
              <Text style={[styles.finValue, { color: "#CC0000" }]}>
                {employeesLoading ? "..." : `${totalSalaries} د.ع`}
              </Text>
            </View>

            <View style={styles.finDivider} />

            <View style={[styles.finRow, { paddingVertical: 10, backgroundColor: netRevenue >= 0 ? "#E8F5E9" : "#FFEBEE", borderRadius: 10, paddingHorizontal: 12 }]}>
              <Text style={[styles.finLabel, { fontWeight: "800", fontSize: 14 }]}>
                صافي أموال العيادة (بعد الرواتب)
              </Text>
              <Text style={[styles.finValue, { fontSize: 18, color: netRevenue >= 0 ? "#2E7D32" : "#C62828" }]}>
                {employeesLoading ? "..." : `${netRevenue} د.ع`}
              </Text>
            </View>
          </View>

          {/* Employee salary details */}
          {!employeesLoading && employees.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Feather name="users" size={16} color={colors.primary} />
                <Text style={styles.sectionTitle}>تفاصيل رواتب الموظفين</Text>
              </View>
              <View style={{ paddingHorizontal: 16, gap: 8 }}>
                {employees.map((emp) => (
                  <View key={emp._id} style={styles.empRow}>
                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                      <Text style={styles.empName}>{emp.name}</Text>
                      {emp.jobTitle ? <Text style={styles.empJob}>{emp.jobTitle}</Text> : null}
                    </View>
                    <Text style={styles.empSalary}>
                      {Number(emp.monthlySalary) || 0} د.ع
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Excel download */}
          <View style={[styles.exportRow, { marginTop: 16 }]}>
            <TouchableOpacity style={styles.exportBtn} onPress={downloadMonthlyExcel}>
              <Feather name="download" size={16} color={colors.primary} />
              <Text style={styles.exportText}>تحميل تقرير شهري Excel</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.refresh, { alignSelf: "center", marginTop: 6, marginBottom: 8 }]}
            onPress={loadAppointments}
          >
            <Feather name="refresh-ccw" size={16} color={colors.primary} />
            <Text style={styles.refreshText}>تحديث البيانات</Text>
          </TouchableOpacity>

          {/* Section: تفاصيل الحجوزات */}
          <View style={styles.sectionHeader}>
            <Feather name="list" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>تفاصيل حجوزات الشهر</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
          ) : monthlyFiltered.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>لا توجد حجوزات في هذا الشهر</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {monthlyGrouped.map(([dateKey, dayAppointments]) => (
                <View key={dateKey}>
                  <View style={styles.dateGroupHeader}>
                    <Feather name="calendar" size={14} color={colors.primary} />
                    <Text style={styles.dateGroupLabel}>{dateKey}</Text>
                    <Text style={styles.dateGroupCount}>{dayAppointments.length} حجز</Text>
                  </View>
                  {dayAppointments.map(renderAppointmentCard)}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    heroCard: {
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 2,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
    },
    heroTopRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    heroIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      textAlign: "right",
    },
    heroSubtitle: {
      marginTop: 4,
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },

    // ─── Tab Bar ──────────────────────────────────────────
    tabBar: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    tabBtnActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
    },
    tabTextActive: {
      color: "#fff",
    },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 8,
    },
    menuBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { fontSize: 18, fontWeight: "700", color: colors.text },
    refresh: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    refreshText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
    calendarBar: { paddingHorizontal: 16 },
    dayRow: { gap: 8, paddingVertical: 8, paddingRight: 12 },

    // ─── Summary & KPI ───────────────────────────────────
    summaryRow: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4, textAlign: "right" },
    summaryValue: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "right" },
    kpiRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 8,
    },
    kpiCard: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 10,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    kpiLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 4,
      textAlign: "center",
    },
    kpiValue: {
      fontSize: 16,
      fontWeight: "800",
    },

    // ─── Export Row ──────────────────────────────────────
    exportRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    exportBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 12,
    },
    exportText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 13,
    },

    // ─── Day chips ───────────────────────────────────────
    dayChip: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    dayChipActive: { borderColor: colors.primary, backgroundColor: colors.surface },
    dayText: { fontSize: 13, color: colors.text, fontWeight: "600" },
    dayTextActive: { color: colors.primary },

    // ─── Cards ───────────────────────────────────────────
    list: { padding: 16, paddingBottom: 32, gap: 10 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    patient: { fontSize: 15, fontWeight: "700", color: colors.text },
    status: { fontSize: 12, fontWeight: "700" },
    cardBody: { gap: 4 },
    cardDetailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 3,
    },
    cardDetailLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
    },
    cardDetailValue: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "600",
      textAlign: "right",
    },
    row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
    value: { fontSize: 14, color: colors.text },
    muted: { fontSize: 13, color: colors.textMuted },
    notesBox: {
      marginTop: 8,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 10,
    },
    notesLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: "600" },
    emptyBox: {
      marginTop: 24,
      marginHorizontal: 20,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyText: { textAlign: "center", color: colors.textMuted, fontWeight: "600" },

    // ─── Month selector ──────────────────────────────────
    monthSelector: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 12,
      gap: 16,
    },
    monthArrow: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    monthLabel: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      minWidth: 140,
      textAlign: "center",
    },

    // ─── Section header ─────────────────────────────────
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
      paddingHorizontal: 20,
      marginTop: 16,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },

    // ─── Finance card ────────────────────────────────────
    financeCard: {
      marginHorizontal: 16,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    finRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    finLabel: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "600",
      textAlign: "right",
      flex: 1,
    },
    finValue: {
      fontSize: 15,
      fontWeight: "800",
      marginLeft: 10,
    },
    finDivider: {
      height: 1,
      backgroundColor: colors.border,
    },

    // ─── Employee salary rows ────────────────────────────
    empRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    empName: { fontSize: 14, fontWeight: "700", color: colors.text },
    empJob: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    empSalary: { fontSize: 14, fontWeight: "700", color: "#CC0000" },

    // ─── Date group ──────────────────────────────────────
    dateGroupHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 8,
      marginTop: 4,
    },
    dateGroupLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
    },
    dateGroupCount: {
      fontSize: 12,
      color: colors.textMuted,
      marginRight: "auto",
    },
  });
