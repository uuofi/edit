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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  fetchDoctorDashboard,
  saveDoctorSchedule,
} from "../lib/api";
import { DEFAULT_SCHEDULE } from "../lib/constants/schedule";
import { useAppTheme } from "../lib/useTheme";

const DAYS = [
  { key: "mon", label: "الاثنين" },
  { key: "tue", label: "الثلاثاء" },
  { key: "wed", label: "الأربعاء" },
  { key: "thu", label: "الخميس" },
  { key: "fri", label: "الجمعة" },
  { key: "sat", label: "السبت" },
  { key: "sun", label: "الأحد" },
];

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
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = ((hours + 11) % 12) + 1;
  const hh = hours.toString().padStart(2, "0");
  return `${hh}:${minutes} ${suffix}`;
};

const to24h = (value) => {
  if (!value || typeof value !== "string") return value || "";
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
  if (!match) return trimmed;
  let hours = Number(match[1]);
  const minutes = match[2];
  const period = match[3];

  if (period) {
    const upper = period.toUpperCase();
    hours = hours % 12;
    if (upper === "PM") {
      hours += 12;
    }
    if (hours === 24) hours = 0;
  }

  const hh = hours.toString().padStart(2, "0");
  return `${hh}:${minutes}`;
};

export default function ScheduleManagementScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const durationOptions = [10, 15, 20, 30, 45, 60];
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const toggleDay = (key) => {
    setActiveDays((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const loadSchedule = useCallback(async () => {
    setLoadingSchedule(true);
    try {
      const data = await fetchDoctorDashboard();
      const schedule = data.doctor?.schedule || DEFAULT_SCHEDULE;
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
      setSelectedDuration(
        Number.isFinite(parsedDuration) && parsedDuration > 0
          ? parsedDuration
          : DEFAULT_SCHEDULE.duration
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
    } catch (err) {
      console.error("Load schedule error:", err);
      Alert.alert("تعذّر تحميل الجدول", err.message || "حاول لاحقًا");
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const handleSaveSchedule = async () => {
    if (savingSchedule || loadingSchedule) return;
    const selectedDays = DAYS
      .filter((day) => activeDays[day.key])
      .map((day) => day.key);

    if (selectedDays.length === 0) {
      Alert.alert("أيام العمل", "حدد يوم عمل واحد على الأقل.");
      return;
    }

    const payload = {
      activeDays: selectedDays,
      startTime,
      endTime,
      breakEnabled,
      breakFrom,
      breakTo,
      duration: selectedDuration,
      allowOnline,
      emergency,
    };

    try {
      setSavingSchedule(true);
      await saveDoctorSchedule(payload);
      Alert.alert("تم الحفظ", "تم تحديث الجدول وسيُعرض للمرضى تلقائياً.");
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

  const handleTimeChange = (input, setter) => {
    setter(to24h(input));
  };

  const scheduleSummary = useMemo(() => {
    const startMinutes = parseTimeValue(startTime);
    const endMinutes = parseTimeValue(endTime);
    const breakMinutes = breakEnabled
      ? Math.max(0, parseTimeValue(breakTo) - parseTimeValue(breakFrom))
      : 0;
    const availableMinutes = Math.max(0, endMinutes - startMinutes - breakMinutes);
    const totalSlots = selectedDuration > 0 ? Math.floor(availableMinutes / selectedDuration) : 0;
    const slotsPerHourValue = selectedDuration > 0 ? Number((60 / selectedDuration).toFixed(1)) : 0;
    const slotsPerHourLabel = selectedDuration > 0
      ? Number.isInteger(60 / selectedDuration)
        ? `كل ساعة تحتوي على ${Math.floor(60 / selectedDuration)} مراجعين`
        : `تقريباً ${slotsPerHourValue} مراجعين في الساعة`
      : "يرجى تحديد مدة صالحة";

    return {
      totalSlots,
      slotsPerHourLabel,
    };
  }, [startTime, endTime, breakEnabled, breakFrom, breakTo, selectedDuration]);

  if (loadingSchedule) {
    return (
      <View style={[styles.screen, styles.loaderContainer]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.screen}>
      {/* Header */}
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
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة الجدول</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Working Days */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>أيام العمل</Text>
          <Text style={styles.sectionSubtitle}>
            اختر الأيام التي تريد قبول الحجوزات فيها، وسيُستَخدم هذا الجدول في
            عرض الأيام المتاحة للمرضى.
          </Text>
          <View style={styles.daysGrid}>
            {DAYS.map((day) => {
              const isActive = Boolean(activeDays[day.key]);
              return (
                <TouchableOpacity
                  key={day.key}
                  style={[
                    styles.dayChip,
                    isActive ? styles.dayChipActive : styles.dayChipInactive,
                  ]}
                  onPress={() => toggleDay(day.key)}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      isActive ? styles.dayChipTextActive : styles.dayChipTextInactive,
                    ]}
                  >
                    {day.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Working Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ساعات العمل اليومية</Text>
          <Text style={styles.sectionSubtitle}>
            حدد نطاق الوقت الذي ترغب في قبول الحجوزات خلاله؛ سنقسم الأيام إلى
            مواعيد في حدود هذا النطاق.
          </Text>
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.label}>وقت البداية</Text>
              <TextInput
                value={to12h(startTime)}
                onChangeText={(text) => handleTimeChange(text, setStartTime)}
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>وقت النهاية</Text>
              <TextInput
                value={to12h(endTime)}
                onChangeText={(text) => handleTimeChange(text, setEndTime)}
                style={styles.input}
              />
            </View>
          </View>
        </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>ملخص التقسيم</Text>
            <Text style={styles.summaryText}>{scheduleSummary.slotsPerHourLabel}</Text>
            <Text style={styles.summaryText}>
              إجمالي المراجعين المتوقع خلال اليوم: {scheduleSummary.totalSlots}
            </Text>
            <Text style={styles.summarySubtext}>
              سيُعرض للمرضى المواعيد ضمن الأيام والساعات التي حددتها فقط.
            </Text>
          </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>مدة كل موعد</Text>
          <Text style={styles.sectionSubtitle}>
            اختر مدة الموعد وسنقسم التوقيت المتاح إلى فترات متساوية وفقاً لها.
          </Text>
          <View style={styles.durationRow}>
            {durationOptions.map((duration) => {
              const isActive = duration === selectedDuration;
              return (
                <TouchableOpacity
                  key={duration}
                  style={[
                    styles.durationChip,
                    isActive && styles.durationChipActive,
                  ]}
                  onPress={() => setSelectedDuration(duration)}
                >
                  <Text style={isActive ? styles.durationTextActive : styles.durationText}>
                    {duration} دقيقة
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Break */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>وقت الراحة</Text>
          <Text style={styles.sectionSubtitle}>
            أضف فترة راحة (صلاة أو غداء) تنتقل خلالها جميع المواعيد إلى
            الفترة التالية.
          </Text>
          <View style={styles.breakCard}>
            <View style={styles.breakHeader}>
              <Text style={styles.breakTitle}>فترة الراحة</Text>
              <Switch
                value={breakEnabled}
                onValueChange={setBreakEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
            {breakEnabled && (
              <View style={styles.breakInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.breakLabel}>من</Text>
                  <TextInput
                    value={to12h(breakFrom)}
                    onChangeText={(text) => handleTimeChange(text, setBreakFrom)}
                    style={styles.breakInput}
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.breakLabel}>إلى</Text>
                  <TextInput
                    value={to12h(breakTo)}
                    onChangeText={(text) => handleTimeChange(text, setBreakTo)}
                    style={styles.breakInput}
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Advanced */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>خيارات قيد التطوير</Text>
          <View style={styles.advRow}>
            <Text style={styles.advText}>السماح بالاستشارات الأونلاين</Text>
            <Switch
              value={allowOnline}
              onValueChange={setAllowOnline}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
          <View style={styles.advRow}>
            <Text style={styles.advText}>مواعيد طوارئ</Text>
            <Switch
              value={emergency}
              onValueChange={setEmergency}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </View>
      </ScrollView>

      {/* Save */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            (savingSchedule || loadingSchedule) && styles.saveButtonDisabled,
          ]}
          onPress={handleSaveSchedule}
          disabled={savingSchedule || loadingSchedule}
        >
          {savingSchedule && (
            <ActivityIndicator
              color={colors.surface}
              size="small"
              style={styles.saveSpinner}
            />
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

const createStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      writingDirection: "rtl",
      alignItems: "stretch",
    },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "right",
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      alignItems: "flex-end",
    },
    section: {
      marginTop: 16,
      alignItems: "flex-end",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
      textAlign: "right",
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 18,
      marginBottom: 12,
      textAlign: "right",
    },
    daysGrid: {
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      gap: 6,
      justifyContent: "flex-end",
    },
    dayChip: {
      flexBasis: "13%",
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: "center",
    },
    dayChipActive: {
      backgroundColor: colors.primary,
    },
    dayChipInactive: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayChipText: {
      fontSize: 12,
    },
    dayChipTextActive: {
      color: colors.surface,
    },
    dayChipTextInactive: {
      color: colors.text,
    },
    field: {
      flex: 1,
      width: "100%",
      marginBottom: 10,
      alignItems: "flex-end",
    },
    label: {
      fontSize: 13,
      color: colors.text,
      marginBottom: 4,
      textAlign: "right",
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surfaceAlt,
      width: "100%",
    },
    fieldRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      width: "100%",
      gap: 12,
    },
    durationRow: {
      flexDirection: "row-reverse",
      gap: 8,
    },
    durationChip: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    durationChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    durationText: {
      fontSize: 14,
      color: colors.text,
    },
    durationTextActive: {
      fontSize: 14,
      color: colors.surface,
    },
    breakCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 12,
      width: "100%",
      borderWidth: 1,
      borderColor: colors.border,
    },
    breakHeader: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
    },
    breakTitle: {
      fontSize: 14,
      color: colors.text,
    },
    breakInputsRow: {
      flexDirection: "row-reverse",
      width: "100%",
      gap: 8,
      marginTop: 10,
    },
    breakLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 3,
    },
    breakInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      fontSize: 13,
      color: colors.text,
      backgroundColor: colors.surface,
      width: "100%",
    },
    advRow: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 12,
      marginBottom: 8,
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    advText: {
      fontSize: 14,
      color: colors.text,
      textAlign: "right",
    },
    summaryCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 16,
      marginTop: 12,
      width: "100%",
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.warning,
      marginBottom: 8,
      textAlign: "right",
    },
    summaryText: {
      fontSize: 14,
      color: colors.warning,
      marginBottom: 4,
      textAlign: "right",
    },
    summarySubtext: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
    },
    footer: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    saveButton: {
      borderRadius: 12,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      alignItems: "center",
    },
    saveButtonText: {
      color: colors.surface,
      fontSize: 15,
      fontWeight: "600",
    },
    saveSpinner: {
      marginRight: 6,
    },
    saveButtonDisabled: {
      opacity: 0.7,
    },
    loaderContainer: {
      justifyContent: "center",
      alignItems: "center",
    },
  });
