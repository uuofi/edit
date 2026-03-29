import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  fetchMyDoctorCenters,
  updateMyDoctorCenterSchedule,
  saveDoctorSchedule,
  fetchDoctorDashboard,
} from "../lib/api";
import { DEFAULT_SCHEDULE } from "../lib/constants/schedule";
import { useAppTheme } from "../lib/useTheme";

const DAYS = [
  { key: "mon", label: "الاثنين", short: "اثن" },
  { key: "tue", label: "الثلاثاء", short: "ثلا" },
  { key: "wed", label: "الأربعاء", short: "أرب" },
  { key: "thu", label: "الخميس", short: "خمي" },
  { key: "fri", label: "الجمعة", short: "جمع" },
  { key: "sat", label: "السبت", short: "سبت" },
  { key: "sun", label: "الأحد", short: "أحد" },
];

// Map JS getDay() (0=Sun) to our day keys
const JS_DAY_MAP = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const getTodayISO = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getTodayDayKey = () => JS_DAY_MAP[new Date().getDay()];

const createActiveDaysMap = (enabledDays) => {
  const list = Array.isArray(enabledDays) ? enabledDays : [];
  return DAYS.reduce((acc, day) => {
    acc[day.key] = list.includes(day.key);
    return acc;
  }, {});
};

const to12h = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return timeStr || "";
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  let hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? "م" : "ص";
  hours = ((hours + 11) % 12) + 1;
  const hh = hours.toString().padStart(2, "0");
  return `${hh}:${minutes} ${suffix}`;
};

const to24h = (value) => {
  if (!value || typeof value !== "string") return value || "";
  const trimmed = value.trim();
  // Handle Arabic AM/PM (ص/م) and English (AM/PM)
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPpصم])([Mm])?)?$/);
  if (!match) return trimmed;
  let hours = Number(match[1]);
  const minutes = match[2];
  const period = match[3];

  if (period) {
    const isPM = period === "P" || period === "p" || period === "م";
    const isAM = period === "A" || period === "a" || period === "ص";
    if (isPM || isAM) {
      hours = hours % 12;
      if (isPM) hours += 12;
      if (hours === 24) hours = 0;
    }
  }

  const hh = hours.toString().padStart(2, "0");
  return `${hh}:${minutes}`;
};

const toDateFromTime = (timeStr) => {
  const normalized = to24h(timeStr || "00:00");
  const [hour = "0", minute = "0"] = normalized.split(":");
  const date = new Date();
  date.setHours(Number(hour) || 0, Number(minute) || 0, 0, 0);
  return date;
};

const fromDateToTime = (date) => {
  if (!(date instanceof Date)) return "00:00";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

/* ─── Section Card Component ─── */
function SectionCard({ icon, title, subtitle, children, colors, styles }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: colors.primary + "15" }]}>
          <Feather name={icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export default function ScheduleManagementScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [startTime, setStartTime] = useState(DEFAULT_SCHEDULE.startTime);
  const [endTime, setEndTime] = useState(DEFAULT_SCHEDULE.endTime);
  const [breakEnabled, setBreakEnabled] = useState(DEFAULT_SCHEDULE.breakEnabled);
  const [breakFrom, setBreakFrom] = useState(DEFAULT_SCHEDULE.breakFrom);
  const [breakTo, setBreakTo] = useState(DEFAULT_SCHEDULE.breakTo);
  const [allowOnline, setAllowOnline] = useState(DEFAULT_SCHEDULE.allowOnline);
  const [emergency, setEmergency] = useState(DEFAULT_SCHEDULE.emergency);
  const [activeDays, setActiveDays] = useState(() =>
    createActiveDaysMap(DEFAULT_SCHEDULE.activeDays)
  );
  const [selectedDuration, setSelectedDuration] = useState(
    DEFAULT_SCHEDULE.duration
  );
  const [maxPatientsPerSlot, setMaxPatientsPerSlot] = useState(
    String(DEFAULT_SCHEDULE.maxPatientsPerSlot)
  );
  const durationSuggestions = [5, 10, 15, 20, 25, 30, 45, 60, 90];
  const [customDurationText, setCustomDurationText] = useState(String(DEFAULT_SCHEDULE.duration));
  const [disabledDates, setDisabledDates] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [centers, setCenters] = useState([]);
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [selectedDoctorCenterId, setSelectedDoctorCenterId] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerField, setTimePickerField] = useState(null);
  const [timePickerValue, setTimePickerValue] = useState(new Date());

  const todayISO = useMemo(() => getTodayISO(), []);
  const todayDayKey = useMemo(() => getTodayDayKey(), []);
  const isTodayDisabled = disabledDates.includes(todayISO);

  const applySchedule = useCallback((schedule = DEFAULT_SCHEDULE) => {
    const timeline =
      Array.isArray(schedule.activeDays) && schedule.activeDays.length
        ? schedule.activeDays
        : DEFAULT_SCHEDULE.activeDays;

    setActiveDays(createActiveDaysMap(timeline));
    setStartTime(schedule.startTime || DEFAULT_SCHEDULE.startTime);
    setEndTime(schedule.endTime || DEFAULT_SCHEDULE.endTime);
    setBreakEnabled(
      typeof schedule.breakEnabled === "boolean"
        ? schedule.breakEnabled
        : DEFAULT_SCHEDULE.breakEnabled
    );
    setBreakFrom(schedule.breakFrom || DEFAULT_SCHEDULE.breakFrom);
    setBreakTo(schedule.breakTo || DEFAULT_SCHEDULE.breakTo);

    const parsedDuration = Number(schedule.duration);
    const validDuration = Number.isFinite(parsedDuration) && parsedDuration > 0
      ? parsedDuration
      : DEFAULT_SCHEDULE.duration;
    setSelectedDuration(validDuration);
    setCustomDurationText(String(validDuration));

    const parsedMaxPatients = Number(schedule.maxPatientsPerSlot);
    setMaxPatientsPerSlot(
      String(
        Number.isFinite(parsedMaxPatients) && parsedMaxPatients > 0
          ? Math.min(Math.max(Math.floor(parsedMaxPatients), 1), 20)
          : DEFAULT_SCHEDULE.maxPatientsPerSlot
      )
    );
    setAllowOnline(
      typeof schedule.allowOnline === "boolean"
        ? schedule.allowOnline
        : DEFAULT_SCHEDULE.allowOnline
    );
    setEmergency(
      typeof schedule.emergency === "boolean"
        ? schedule.emergency
        : DEFAULT_SCHEDULE.emergency
    );
    setDisabledDates(
      Array.isArray(schedule.disabledDates) ? schedule.disabledDates : []
    );
  }, []);

  const toggleDay = (key) => {
    setActiveDays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTodayDisabled = () => {
    setDisabledDates((prev) =>
      prev.includes(todayISO)
        ? prev.filter((d) => d !== todayISO)
        : [...prev, todayISO]
    );
  };

  const loadSchedule = useCallback(async () => {
    setLoadingSchedule(true);
    try {
      const data = await fetchMyDoctorCenters();
      const centerList = Array.isArray(data?.centers) ? data.centers : [];
      setCenters(centerList);

      if (!centerList.length) {
        setSelectedCenterId("");
        setSelectedDoctorCenterId("");
        // No centers: load profile-level schedule
        try {
          const dash = await fetchDoctorDashboard();
          const profileSchedule = dash?.doctor?.schedule;
          applySchedule(profileSchedule || DEFAULT_SCHEDULE);
        } catch {
          applySchedule(DEFAULT_SCHEDULE);
        }
        return;
      }

      const preferredCenter =
        centerList.find((center) => String(center.medicalCenterId) === String(selectedCenterId)) ||
        centerList[0];

      setSelectedCenterId(String(preferredCenter.medicalCenterId || ""));
      setSelectedDoctorCenterId(String(preferredCenter.doctorCenterId || ""));
      applySchedule(preferredCenter.schedule || DEFAULT_SCHEDULE);
    } catch (err) {
      console.error("Load schedule error:", err);
      Alert.alert("تعذّر تحميل الجدول", err.message || "حاول لاحقًا");
    } finally {
      setLoadingSchedule(false);
    }
  }, [applySchedule, selectedCenterId]);

  const handleCenterChange = useCallback(
    (center) => {
      if (!center) return;
      setSelectedCenterId(String(center.medicalCenterId || ""));
      setSelectedDoctorCenterId(String(center.doctorCenterId || ""));
      applySchedule(center.schedule || DEFAULT_SCHEDULE);
    },
    [applySchedule]
  );

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const handleSaveSchedule = async () => {
    if (savingSchedule || loadingSchedule) return;

    const hasCenters = centers.length > 0;

    if (hasCenters && (!selectedCenterId || !selectedDoctorCenterId)) {
      Alert.alert("المراكز الطبية", "لا يوجد مركز محدد للطبيب حالياً.");
      return;
    }

    const selectedDays = DAYS
      .filter((day) => activeDays[day.key])
      .map((day) => day.key);

    if (selectedDays.length === 0) {
      Alert.alert("أيام العمل", "حدد يوم عمل واحد على الأقل.");
      return;
    }

    const parsedMaxPatients = Number(maxPatientsPerSlot);
    const normalizedMaxPatients =
      Number.isFinite(parsedMaxPatients) && parsedMaxPatients > 0
        ? Math.min(Math.max(Math.floor(parsedMaxPatients), 1), 20)
        : DEFAULT_SCHEDULE.maxPatientsPerSlot;

    const payload = {
      activeDays: selectedDays,
      startTime,
      endTime,
      breakEnabled,
      breakFrom,
      breakTo,
      duration: selectedDuration,
      maxPatientsPerSlot: normalizedMaxPatients,
      allowOnline,
      emergency,
      disabledDates,
    };

    try {
      setSavingSchedule(true);

      if (hasCenters) {
        await updateMyDoctorCenterSchedule(
          selectedCenterId,
          selectedDoctorCenterId,
          payload
        );
        setCenters((prev) =>
          prev.map((center) =>
            String(center.medicalCenterId) === String(selectedCenterId)
              ? { ...center, schedule: payload }
              : center
          )
        );
      } else {
        await saveDoctorSchedule(payload);
      }

      Alert.alert("تم الحفظ ✓", hasCenters ? "تم تحديث جدول هذا المركز بنجاح." : "تم تحديث الجدول بنجاح.");
    } catch (err) {
      console.error("Save schedule error:", err);
      Alert.alert("فشل الحفظ", err.message || "حاول لاحقاً.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const parseTimeValue = (value) => {
    const normalized = to24h(value || "");
    const [hours = 0, minutes = 0] = normalized.split(":").map((v) => Number(v));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return 0;
    }
    return hours * 60 + minutes;
  };

  const handleOpenTimePicker = (field, currentTime) => {
    if (showTimePicker && timePickerField === field) {
      setShowTimePicker(false);
      setTimePickerField(null);
      return;
    }
    setTimePickerField(field);
    setTimePickerValue(toDateFromTime(currentTime));
    setShowTimePicker(true);
  };

  const handleTimePickerChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
      if (event?.type !== "set" || !selectedDate || !timePickerField) return;
    }

    if (!selectedDate || !timePickerField) return;

    const normalized = fromDateToTime(selectedDate);
    setTimePickerValue(selectedDate);

    if (timePickerField === "start") {
      setStartTime(normalized);
    } else if (timePickerField === "end") {
      setEndTime(normalized);
    } else if (timePickerField === "breakFrom") {
      setBreakFrom(normalized);
    } else if (timePickerField === "breakTo") {
      setBreakTo(normalized);
    }
  };

  const scheduleSummary = useMemo(() => {
    const startMinutes = parseTimeValue(startTime);
    const endMinutes = parseTimeValue(endTime);
    const breakMinutes = breakEnabled
      ? Math.max(0, parseTimeValue(breakTo) - parseTimeValue(breakFrom))
      : 0;
    const availableMinutes = Math.max(0, endMinutes - startMinutes - breakMinutes);
    const totalSlots = selectedDuration > 0 ? Math.floor(availableMinutes / selectedDuration) : 0;
    const parsedMaxPatients = Number(maxPatientsPerSlot);
    const normalizedMaxPatients =
      Number.isFinite(parsedMaxPatients) && parsedMaxPatients > 0
        ? Math.min(Math.max(Math.floor(parsedMaxPatients), 1), 20)
        : DEFAULT_SCHEDULE.maxPatientsPerSlot;
    const slotsPerHourValue = selectedDuration > 0 ? Number((60 / selectedDuration).toFixed(1)) : 0;
    const slotsPerHourLabel = selectedDuration > 0
      ? Number.isInteger(60 / selectedDuration)
        ? `${Math.floor(60 / selectedDuration) * normalizedMaxPatients} مراجع / ساعة`
        : `≈ ${(slotsPerHourValue * normalizedMaxPatients).toFixed(1)} مراجع / ساعة`
      : "—";
    const totalPatients = totalSlots * normalizedMaxPatients;

    return {
      totalSlots,
      normalizedMaxPatients,
      slotsPerHourLabel,
      totalPatients,
      availableHours: (availableMinutes / 60).toFixed(1),
    };
  }, [startTime, endTime, breakEnabled, breakFrom, breakTo, selectedDuration, maxPatientsPerSlot]);

  const activeDayCount = useMemo(
    () => DAYS.filter((d) => activeDays[d.key]).length,
    [activeDays]
  );

  const todayLabel = useMemo(() => {
    const day = DAYS.find((d) => d.key === todayDayKey);
    return day ? day.label : "";
  }, [todayDayKey]);

  if (loadingSchedule) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.screen, styles.loaderContainer]}>
          <View style={styles.loaderInner}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loaderText}>جارٍ تحميل الجدول...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.screen}>
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              if (typeof navigation?.openDrawer === "function") {
                navigation.openDrawer();
                return;
              }
              navigation.goBack();
            }}
          >
            <Feather
              name={typeof navigation?.openDrawer === "function" ? "menu" : "chevron-right"}
              size={22}
              color="#fff"
            />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>إدارة الجدول</Text>
            <Text style={styles.headerSubtitle}>تنظيم مواعيدك بسهولة</Text>
          </View>
          <View style={styles.headerButton}>
            <Feather name="calendar" size={20} color="#fff" />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Disable Today Banner ─── */}
          <TouchableOpacity
            style={[
              styles.todayBanner,
              isTodayDisabled ? styles.todayBannerDisabled : styles.todayBannerActive,
            ]}
            onPress={toggleTodayDisabled}
            activeOpacity={0.7}
          >
            <View style={styles.todayBannerLeft}>
              <View style={[
                styles.todayIconWrap,
                { backgroundColor: isTodayDisabled ? colors.danger + "20" : colors.success + "20" },
              ]}>
                <Feather
                  name={isTodayDisabled ? "x-circle" : "check-circle"}
                  size={22}
                  color={isTodayDisabled ? colors.danger : colors.success}
                />
              </View>
              <View style={styles.todayTextWrap}>
                <Text style={styles.todayTitle}>
                  {isTodayDisabled ? "اليوم معطّل" : "اليوم نشط"}
                </Text>
                <Text style={styles.todaySubtitle}>
                  {todayLabel} — {todayISO}
                </Text>
              </View>
            </View>
            <View style={[
              styles.todayToggle,
              { backgroundColor: isTodayDisabled ? colors.danger : colors.success },
            ]}>
              <Feather
                name={isTodayDisabled ? "play" : "pause"}
                size={16}
                color="#fff"
              />
              <Text style={styles.todayToggleText}>
                {isTodayDisabled ? "تفعيل" : "تعطيل"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* ─── Centers ─── */}
          {centers.length > 0 ? (
            <SectionCard
              icon="home"
              title="المركز الطبي"
              subtitle="اختر المركز لإدارة جدوله بشكل مستقل"
              colors={colors}
              styles={styles}
            >
              <View style={styles.centerRow}>
                {centers.map((center) => {
                  const isActive =
                    String(center.medicalCenterId) === String(selectedCenterId);
                  return (
                    <TouchableOpacity
                      key={String(center.doctorCenterId || center.medicalCenterId)}
                      style={[
                        styles.centerChip,
                        isActive ? styles.centerChipActive : styles.centerChipInactive,
                      ]}
                      onPress={() => handleCenterChange(center)}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name={isActive ? "check-circle" : "circle"}
                        size={14}
                        color={isActive ? "#fff" : colors.textMuted}
                        style={{ marginLeft: 6 }}
                      />
                      <Text
                        style={[
                          styles.centerChipText,
                          isActive
                            ? styles.centerChipTextActive
                            : styles.centerChipTextInactive,
                        ]}
                        numberOfLines={1}
                      >
                        {center.name || "مركز"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </SectionCard>
          ) : null}

          {/* ─── Working Days ─── */}
          <SectionCard
            icon="grid"
            title="أيام العمل"
            subtitle="حدد الأيام التي تستقبل فيها المراجعين"
            colors={colors}
            styles={styles}
          >
            <View style={styles.daysGrid}>
              {DAYS.map((day) => {
                const isActive = Boolean(activeDays[day.key]);
                const isToday = day.key === todayDayKey;
                return (
                  <TouchableOpacity
                    key={day.key}
                    style={[
                      styles.dayChip,
                      isActive ? styles.dayChipActive : styles.dayChipInactive,
                      isToday && styles.dayChipToday,
                    ]}
                    onPress={() => toggleDay(day.key)}
                    activeOpacity={0.7}
                  >
                    {isActive && (
                      <Feather name="check" size={12} color="#fff" style={{ marginBottom: 2 }} />
                    )}
                    <Text
                      style={[
                        styles.dayChipText,
                        isActive ? styles.dayChipTextActive : styles.dayChipTextInactive,
                      ]}
                      numberOfLines={1}
                    >
                      {day.label}
                    </Text>
                    {isToday && (
                      <View style={[styles.todayDot, { backgroundColor: isActive ? "#fff" : colors.primary }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.dayCountLabel}>
              {activeDayCount} أيام عمل مفعّلة من أصل 7
            </Text>
          </SectionCard>

          {/* ─── Working Hours ─── */}
          <SectionCard
            icon="clock"
            title="ساعات العمل"
            subtitle="حدد أوقات بداية ونهاية الدوام"
            colors={colors}
            styles={styles}
          >
            <View style={styles.timeRow}>
              <View style={styles.timeBlock}>
                <View style={styles.timeLabelRow}>
                  <Feather name="sunrise" size={14} color={colors.success} />
                  <Text style={styles.timeLabel}>البداية</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.timeInputButton,
                    showTimePicker && timePickerField === "start" && styles.timeInputButtonSelected,
                  ]}
                  onPress={() => handleOpenTimePicker("start", startTime)}
                  activeOpacity={0.75}
                >
                  <Feather name="clock" size={15} color={showTimePicker && timePickerField === "start" ? "#fff" : colors.primary} />
                  <Text style={[
                    styles.timeInputButtonText,
                    showTimePicker && timePickerField === "start" && styles.timeInputButtonTextSelected,
                  ]}>{to12h(startTime)}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.timeDivider}>
                <Feather name="arrow-left" size={18} color={colors.textMuted} />
              </View>
              <View style={styles.timeBlock}>
                <View style={styles.timeLabelRow}>
                  <Feather name="sunset" size={14} color={colors.warning} />
                  <Text style={styles.timeLabel}>النهاية</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.timeInputButton,
                    showTimePicker && timePickerField === "end" && styles.timeInputButtonSelected,
                  ]}
                  onPress={() => handleOpenTimePicker("end", endTime)}
                  activeOpacity={0.75}
                >
                  <Feather name="clock" size={15} color={showTimePicker && timePickerField === "end" ? "#fff" : colors.primary} />
                  <Text style={[
                    styles.timeInputButtonText,
                    showTimePicker && timePickerField === "end" && styles.timeInputButtonTextSelected,
                  ]}>{to12h(endTime)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {showTimePicker && (timePickerField === "start" || timePickerField === "end") ? (
              <View style={styles.timePickerWrap}>
                <DateTimePicker
                  value={timePickerValue}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleTimePickerChange}
                  themeVariant="light"
                  textColor="#000"
                  style={{ backgroundColor: "#fff" }}
                />
                {Platform.OS === "ios" ? (
                  <TouchableOpacity
                    style={styles.timeDoneBtn}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={styles.timeDoneText}>تم</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </SectionCard>

          {/* ─── Summary ─── */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIconWrap}>
                <Feather name="bar-chart-2" size={18} color={colors.primary} />
              </View>
              <Text style={styles.summaryHeaderText}>ملخص الجدول</Text>
            </View>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{scheduleSummary.totalPatients}</Text>
                <Text style={styles.summaryLabel}>مراجع / يوم</Text>
              </View>
              <View style={styles.summaryDividerV} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{scheduleSummary.slotsPerHourLabel}</Text>
                <Text style={styles.summaryLabel}>معدل الساعة</Text>
              </View>
              <View style={styles.summaryDividerV} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{scheduleSummary.availableHours}</Text>
                <Text style={styles.summaryLabel}>ساعات عمل</Text>
              </View>
            </View>
            <Text style={styles.summaryFootnote}>
              يُعرض للمرضى المواعيد ضمن الأيام والساعات المحددة فقط
            </Text>
          </View>

          {/* ─── Duration ─── */}
          <SectionCard
            icon="watch"
            title="مدة الموعد"
            subtitle="اكتب المدة يدوياً أو اختر من الاقتراحات"
            colors={colors}
            styles={styles}
          >
            <View style={styles.durationInputRow}>
              <View style={styles.durationInputWrap}>
                <TextInput
                  value={customDurationText}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, "");
                    setCustomDurationText(cleaned);
                    const num = Number(cleaned);
                    if (Number.isFinite(num) && num > 0) {
                      setSelectedDuration(num);
                    }
                  }}
                  style={styles.durationInput}
                  keyboardType="number-pad"
                  placeholder="20"
                  placeholderTextColor={colors.placeholder}
                />
                <Text style={styles.durationUnit}>دقيقة</Text>
              </View>
            </View>

            <View style={styles.suggestionsRow}>
              {durationSuggestions.map((dur) => {
                const isActive = dur === selectedDuration;
                return (
                  <TouchableOpacity
                    key={dur}
                    style={[
                      styles.suggestionChip,
                      isActive && styles.suggestionChipActive,
                    ]}
                    onPress={() => {
                      setSelectedDuration(dur);
                      setCustomDurationText(String(dur));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={isActive ? styles.suggestionTextActive : styles.suggestionText}>
                      {dur}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.separator} />

            <View style={styles.patientsField}>
              <View style={styles.patientsLabelRow}>
                <Feather name="users" size={14} color={colors.primary} />
                <Text style={styles.patientsLabel}>عدد المرضى لكل وقت</Text>
              </View>
              <TextInput
                value={maxPatientsPerSlot}
                onChangeText={(text) =>
                  setMaxPatientsPerSlot(String(text || "").replace(/[^0-9]/g, ""))
                }
                style={styles.patientsInput}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={colors.placeholder}
              />
            </View>
          </SectionCard>

          {/* ─── Break ─── */}
          <SectionCard
            icon="coffee"
            title="وقت الراحة"
            subtitle="فترة صلاة أو غداء تُستثنى من المواعيد"
            colors={colors}
            styles={styles}
          >
            <View style={styles.breakToggleRow}>
              <Text style={styles.breakToggleLabel}>
                {breakEnabled ? "فترة الراحة مفعّلة" : "فترة الراحة معطّلة"}
              </Text>
              <Switch
                value={breakEnabled}
                onValueChange={setBreakEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={breakEnabled ? "#fff" : colors.surfaceAlt}
              />
            </View>
            {breakEnabled && (
              <View style={styles.breakTimeRow}>
                <View style={styles.breakTimeBlock}>
                  <Text style={styles.breakTimeLabel}>من</Text>
                  <TouchableOpacity
                    style={[
                      styles.timeInputButton,
                      showTimePicker && timePickerField === "breakFrom" && styles.timeInputButtonSelected,
                    ]}
                    onPress={() => handleOpenTimePicker("breakFrom", breakFrom)}
                    activeOpacity={0.75}
                  >
                    <Feather name="clock" size={15} color={showTimePicker && timePickerField === "breakFrom" ? "#fff" : colors.primary} />
                    <Text style={[
                      styles.timeInputButtonText,
                      showTimePicker && timePickerField === "breakFrom" && styles.timeInputButtonTextSelected,
                    ]}>{to12h(breakFrom)}</Text>
                  </TouchableOpacity>
                </View>
                <Feather name="arrow-left" size={16} color={colors.textMuted} style={{ alignSelf: "flex-end", marginBottom: 12 }} />
                <View style={styles.breakTimeBlock}>
                  <Text style={styles.breakTimeLabel}>إلى</Text>
                  <TouchableOpacity
                    style={[
                      styles.timeInputButton,
                      showTimePicker && timePickerField === "breakTo" && styles.timeInputButtonSelected,
                    ]}
                    onPress={() => handleOpenTimePicker("breakTo", breakTo)}
                    activeOpacity={0.75}
                  >
                    <Feather name="clock" size={15} color={showTimePicker && timePickerField === "breakTo" ? "#fff" : colors.primary} />
                    <Text style={[
                      styles.timeInputButtonText,
                      showTimePicker && timePickerField === "breakTo" && styles.timeInputButtonTextSelected,
                    ]}>{to12h(breakTo)}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {showTimePicker && (timePickerField === "breakFrom" || timePickerField === "breakTo") ? (
              <View style={styles.timePickerWrap}>
                <DateTimePicker
                  value={timePickerValue}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleTimePickerChange}
                  themeVariant="light"
                  textColor="#000"
                  style={{ backgroundColor: "#fff" }}
                />
                {Platform.OS === "ios" ? (
                  <TouchableOpacity
                    style={styles.timeDoneBtn}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={styles.timeDoneText}>تم</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </SectionCard>

          {/* ─── Advanced ─── */}
          <SectionCard
            icon="settings"
            title="خيارات إضافية"
            subtitle="إعدادات قيد التطوير"
            colors={colors}
            styles={styles}
          >
            <View style={styles.switchRow}>
              <View style={styles.switchLabelRow}>
                <Feather name="globe" size={16} color={colors.primary} />
                <Text style={styles.switchText}>استشارات أونلاين</Text>
              </View>
              <Switch
                value={allowOnline}
                onValueChange={setAllowOnline}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={allowOnline ? "#fff" : colors.surfaceAlt}
              />
            </View>
            <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
              <View style={styles.switchLabelRow}>
                <Feather name="zap" size={16} color={colors.warning} />
                <Text style={styles.switchText}>مواعيد طوارئ</Text>
              </View>
              <Switch
                value={emergency}
                onValueChange={setEmergency}
                trackColor={{ false: colors.border, true: colors.warning }}
                thumbColor={emergency ? "#fff" : colors.surfaceAlt}
              />
            </View>
          </SectionCard>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ─── Save Footer ─── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (savingSchedule || loadingSchedule) && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveSchedule}
            disabled={savingSchedule || loadingSchedule}
            activeOpacity={0.8}
          >
            {savingSchedule ? (
              <ActivityIndicator color="#fff" size="small" style={{ marginLeft: 8 }} />
            ) : (
              <Feather name="save" size={18} color="#fff" style={{ marginLeft: 8 }} />
            )}
            <Text style={styles.saveButtonText}>
              {savingSchedule ? "جارٍ الحفظ..." : "حفظ الجدول"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════ Styles ═══════════════════════════════ */
const createStyles = (colors, isDark) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      writingDirection: "rtl",
    },
    /* Header */
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
      backgroundColor: colors.primary,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.15)",
    },
    headerCenter: {
      flex: 1,
      alignItems: "flex-end",
      marginHorizontal: 12,
    },
    headerTitle: {
      fontSize: 19,
      fontWeight: "700",
      color: "#fff",
    },
    headerSubtitle: {
      fontSize: 12,
      color: "rgba(255,255,255,0.7)",
      marginTop: 2,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    /* Loader */
    loaderContainer: {
      justifyContent: "center",
      alignItems: "center",
    },
    loaderInner: {
      alignItems: "center",
      gap: 12,
    },
    loaderText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    /* Today Banner */
    todayBanner: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 14,
      borderWidth: 1.5,
    },
    todayBannerActive: {
      backgroundColor: colors.success + "08",
      borderColor: colors.success + "30",
    },
    todayBannerDisabled: {
      backgroundColor: colors.danger + "08",
      borderColor: colors.danger + "30",
    },
    todayBannerLeft: {
      flexDirection: "row-reverse",
      alignItems: "center",
      flex: 1,
    },
    todayIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 10,
    },
    todayTextWrap: {
      flex: 1,
      alignItems: "flex-end",
    },
    todayTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
    },
    todaySubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
      textAlign: "right",
    },
    todayToggle: {
      flexDirection: "row-reverse",
      alignItems: "center",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 4,
    },
    todayToggleText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#fff",
    },
    /* Card */
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
        android: { elevation: 2 },
      }),
    },
    cardHeader: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 8,
    },
    cardIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 10,
    },
    cardHeaderText: {
      flex: 1,
      alignItems: "flex-end",
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
    },
    cardSubtitle: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      textAlign: "right",
      lineHeight: 16,
    },
    cardBody: {
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    /* Centers */
    centerRow: {
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      gap: 8,
    },
    centerChip: {
      flexDirection: "row-reverse",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1.5,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    centerChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    centerChipInactive: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
    },
    centerChipText: {
      fontSize: 13,
      fontWeight: "600",
      writingDirection: "rtl",
    },
    centerChipTextActive: {
      color: "#fff",
    },
    centerChipTextInactive: {
      color: colors.text,
    },
    /* Days */
    daysGrid: {
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "center",
    },
    dayChip: {
      minWidth: 84,
      height: 52,
      paddingHorizontal: 10,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
    },
    dayChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayChipInactive: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
    },
    dayChipToday: {
      borderWidth: 2,
      borderColor: colors.warning,
    },
    dayChipText: {
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
    },
    dayChipTextActive: {
      color: "#fff",
    },
    dayChipTextInactive: {
      color: colors.text,
    },
    todayDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      marginTop: 3,
    },
    dayCountLabel: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 10,
    },
    /* Time */
    timeRow: {
      flexDirection: "row-reverse",
      alignItems: "flex-end",
      gap: 8,
    },
    timeBlock: {
      flex: 1,
    },
    timeLabelRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 6,
      marginBottom: 6,
    },
    timeLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      textAlign: "right",
    },
    timeInputButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.surfaceAlt,
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    timeInputButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    timeInputButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    timeInputButtonTextSelected: {
      color: "#fff",
    },
    timePickerWrap: {
      marginTop: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "#fff",
      overflow: "hidden",
    },
    timeDoneBtn: {
      alignSelf: "flex-end",
      margin: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    timeDoneText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 13,
    },
    timeDivider: {
      paddingBottom: 12,
    },
    /* Summary */
    summaryCard: {
      backgroundColor: colors.primary + "0A",
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.primary + "25",
      padding: 16,
      marginBottom: 14,
    },
    summaryHeader: {
      flexDirection: "row-reverse",
      alignItems: "center",
      marginBottom: 14,
    },
    summaryIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: colors.primary + "15",
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 8,
    },
    summaryHeaderText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.primary,
    },
    summaryGrid: {
      flexDirection: "row-reverse",
      justifyContent: "space-around",
      alignItems: "center",
    },
    summaryItem: {
      alignItems: "center",
      flex: 1,
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.primary,
      textAlign: "center",
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
      textAlign: "center",
    },
    summaryDividerV: {
      width: 1,
      height: 30,
      backgroundColor: colors.primary + "20",
    },
    summaryFootnote: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 12,
    },
    /* Duration */
    durationInputRow: {
      marginBottom: 12,
    },
    durationInputWrap: {
      flexDirection: "row-reverse",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 14,
    },
    durationInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
    },
    durationUnit: {
      fontSize: 13,
      color: colors.textMuted,
      marginRight: 8,
    },
    suggestionsRow: {
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 4,
    },
    suggestionChip: {
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    suggestionChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    suggestionText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    suggestionTextActive: {
      fontSize: 13,
      fontWeight: "600",
      color: "#fff",
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    patientsField: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
    },
    patientsLabelRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 6,
    },
    patientsLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    patientsInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 16,
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      backgroundColor: colors.surfaceAlt,
      textAlign: "center",
      width: 70,
    },
    /* Break */
    breakToggleRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    breakToggleLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    breakTimeRow: {
      flexDirection: "row-reverse",
      alignItems: "flex-end",
      gap: 8,
      marginTop: 10,
    },
    breakTimeBlock: {
      flex: 1,
    },
    breakTimeLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 4,
      textAlign: "right",
    },
    /* Advanced Switches */
    switchRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "60",
    },
    switchLabelRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 8,
    },
    switchText: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
    },
    /* Footer */
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    saveButton: {
      flexDirection: "row-reverse",
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 14,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      ...Platform.select({
        ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
        android: { elevation: 4 },
      }),
    },
    saveButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
  });
