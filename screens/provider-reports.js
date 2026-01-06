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
  if (appointment.appointmentDateIso) return appointment.appointmentDateIso === iso;
  return appointment.appointmentDate?.includes?.(iso);
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
    const fee = doctorFee || Number(billable[0]?.doctorProfile?.consultationFee) || 0;
    return fee * billable.length;
  }, [billable, doctorFee]);

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
      const monthIso = String(selectedIso || "").slice(0, 7);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>التقارير اليومية</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.refresh} onPress={loadAppointments}>
            <Feather name="refresh-ccw" size={18} color={colors.primary} />
            <Text style={styles.refreshText}>تحديث</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={openDrawer}>
            <Feather name="menu" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
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
          <Text style={styles.summaryValue}>{totalMoney}</Text>
        </View>
      </View>

      <View style={styles.exportRow}>
        <TouchableOpacity style={styles.exportBtn} onPress={downloadDailyExcel}>
          <Feather name="download" size={16} color={colors.primary} />
          <Text style={styles.exportText}>تقرير يومي Excel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={downloadMonthlyExcel}>
          <Feather name="download" size={16} color={colors.primary} />
          <Text style={styles.exportText}>تقرير شهري Excel</Text>
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
          {filtered.map((appointment) => {
            const statusColor =
              {
                confirmed: colors.success,
                pending: colors.warning,
                cancelled: colors.danger,
              }[appointment.status] || colors.textMuted;
            return (
              <View key={appointment._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.patient}>{appointment.user?.name || "مراجع"}</Text>
                  <Text style={[styles.status, { color: statusColor }]}>
                    {STATUS_LABELS[appointment.status] || appointment.status}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Feather name="clock" size={16} color={colors.primary} />
                  <Text style={styles.value}>{appointment.appointmentTime}</Text>
                </View>
                {appointment.bookingNumber ? (
                  <View style={styles.row}>
                    <Feather name="hash" size={16} color={colors.textMuted} />
                    <Text style={styles.muted}>
                      رقم الحجز {appointment.doctorQueueNumber ?? appointment.doctorIndex ?? appointment.bookingNumber}
                    </Text>
                  </View>
                ) : null}
                {appointment.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>ملاحظات</Text>
                    <Text style={styles.value}>{appointment.notes}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    menuBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { fontSize: 20, fontWeight: "700", color: colors.text },
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
    refreshText: { color: colors.primary, fontWeight: "600" },
    calendarBar: { paddingHorizontal: 16 },
    dayRow: { gap: 8, paddingVertical: 8, paddingRight: 12 },
    summaryRow: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
    },
    exportRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    exportBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 12,
    },
    exportText: {
      color: colors.primary,
      fontWeight: "700",
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
    summaryValue: { fontSize: 18, fontWeight: "700", color: colors.text },
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
    list: { padding: 16, paddingBottom: 32, gap: 12 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    patient: { fontSize: 16, fontWeight: "700", color: colors.text },
    status: { fontSize: 13, fontWeight: "700" },
    row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
    value: { fontSize: 14, color: colors.text },
    muted: { fontSize: 13, color: colors.textMuted },
    notesBox: {
      marginTop: 10,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 10,
    },
    notesLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
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
  });
