import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import {
  bookAppointment,
  ApiError,
  fetchDoctorBlockedSlots,
  createDoctorAppointment,
  fetchDoctorServices,
} from "../lib/api";
import {
  DEFAULT_SCHEDULE,
  DAY_LABELS,
  WEEKDAY_KEYS,
} from "../lib/constants/schedule";

const parseMinutes = (value) => {
  const [hours = 0, minutes = 0] = value
    .split(":")
    .map((v) => Number(v));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
};

const formatSlotLabel = (minutes) => {
  const hours24 = Math.floor(minutes / 60);
  const minutesPart = (minutes % 60).toString().padStart(2, "0");
  const period = hours24 >= 12 ? "م" : "ص";
  let displayHour = hours24 % 12;
  if (displayHour === 0) {
    displayHour = 12;
  }
  const hourString = displayHour.toString().padStart(2, "0");
  return `${hourString}:${minutesPart} ${period}`;
};

const createTimeSlots = (schedule) => {
  const slots = [];
  const duration = schedule.duration > 0 ? schedule.duration : DEFAULT_SCHEDULE.duration;
  const start = parseMinutes(schedule.startTime);
  const end = parseMinutes(schedule.endTime);
  const breakStart = schedule.breakEnabled
    ? parseMinutes(schedule.breakFrom)
    : null;
  const breakEnd = schedule.breakEnabled ? parseMinutes(schedule.breakTo) : null;
  const hasBreak =
    schedule.breakEnabled &&
    typeof breakStart === "number" &&
    typeof breakEnd === "number" &&
    breakEnd > breakStart;

  if (end <= start || duration <= 0) {
    return slots;
  }

  let cursor = start;
  while (cursor + duration <= end) {
    const slotEnd = cursor + duration;
    const inBreak =
      hasBreak &&
      ((cursor >= breakStart && cursor < breakEnd) ||
        (slotEnd > breakStart && slotEnd <= breakEnd) ||
        (cursor < breakStart && slotEnd > breakStart));

    if (inBreak) {
      cursor = breakEnd;
      continue;
    }

    const hours24 = Math.floor(cursor / 60)
      .toString()
      .padStart(2, "0");
    const mins = (cursor % 60).toString().padStart(2, "0");

    slots.push({
      label: formatSlotLabel(cursor),
      value: `${hours24}:${mins}`,
    });
    cursor += duration;
  }

  return slots;
};

const getNextActiveDates = (activeDays, count = 5) => {
  const workingDays =
    Array.isArray(activeDays) && activeDays.length
      ? activeDays
      : DEFAULT_SCHEDULE.activeDays;
  const dates = [];
  const pointer = new Date();
  pointer.setHours(0, 0, 0, 0);

  while (dates.length < count) {
    const dayKey = WEEKDAY_KEYS[pointer.getDay()];
    if (workingDays.includes(dayKey)) {
      dates.push({
        key: `${dayKey}-${pointer.toISOString()}`,
        day: DAY_LABELS[dayKey] || dayKey,
        displayDate: pointer
          .toLocaleDateString("ar-EG", { day: "numeric" }),
        iso: pointer.toISOString().split("T")[0],
      });
    }
    pointer.setDate(pointer.getDate() + 1);
  }

  return dates;
};

export default function BookAppointmentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params || {};

  // استخدم بيانات الدكتور من params فقط إذا كانت موجودة، وإلا لا تعرض بيانات افتراضية
  const doctorName = typeof params.doctorName === "string" ? params.doctorName : "";
  const doctorRole = typeof params.doctorRole === "string" ? params.doctorRole : "";
  const specialty = typeof params.specialty === "string" ? params.specialty : "";
  const specialtySlug = typeof params.specialtySlug === "string" ? params.specialtySlug : "";
  const avatarUrl = typeof params.avatarUrl === "string" ? params.avatarUrl : "";
  const doctorId = typeof params.doctorId === "string" || typeof params.doctorId === "number" ? params.doctorId : "";
  
  const [selectedDateIndex, setSelectedDateIndex] = useState(null);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(null);
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [blockedSlots, setBlockedSlots] = useState({});
  const [blockedLoading, setBlockedLoading] = useState(false);

  const selectedService =
    selectedServiceIndex !== null ? services[selectedServiceIndex] : null;

  const selectedServiceId = selectedService?._id || null;
  const selectedServicePrice =
    typeof selectedService?.price === "number"
      ? selectedService.price
      : Number(selectedService?.price) || null;
  const selectedServiceDuration =
    typeof selectedService?.durationMinutes === "number"
      ? selectedService.durationMinutes
      : Number(selectedService?.durationMinutes) || null;

  const formatCurrency = (value) => {
    const num = Number(value) || 0;
    try {
      return `${num.toLocaleString("ar-IQ")} د.ع`;
    } catch {
      return `${num} د.ع`;
    }
  };

  const doctorSchedule = useMemo(() => {
    const incoming = params.schedule || {};
    const normalizedActiveDays =
      Array.isArray(incoming.activeDays) && incoming.activeDays.length
        ? incoming.activeDays
        : DEFAULT_SCHEDULE.activeDays;
    const parsedDuration = Number(incoming.duration);
    return {
      ...DEFAULT_SCHEDULE,
      ...incoming,
      activeDays: normalizedActiveDays,
      duration:
        Number.isFinite(parsedDuration) && parsedDuration > 0
          ? parsedDuration
          : DEFAULT_SCHEDULE.duration,
    };
  }, [params.schedule]);

  const effectiveSlotDuration = useMemo(() => {
    const serviceDuration = Number(selectedServiceDuration);
    if (Number.isFinite(serviceDuration) && serviceDuration > 0) {
      return serviceDuration;
    }
    return doctorSchedule.duration;
  }, [doctorSchedule.duration, selectedServiceDuration]);

  // no server fetch — rely on params.schedule if provided

  const baseTimeSlotOptions = useMemo(
    () =>
      createTimeSlots({
        startTime: doctorSchedule.startTime,
        endTime: doctorSchedule.endTime,
        duration: effectiveSlotDuration,
        breakEnabled: doctorSchedule.breakEnabled,
        breakFrom: doctorSchedule.breakFrom,
        breakTo: doctorSchedule.breakTo,
      }),
    [
      doctorSchedule.startTime,
      doctorSchedule.endTime,
      effectiveSlotDuration,
      doctorSchedule.breakEnabled,
      doctorSchedule.breakFrom,
      doctorSchedule.breakTo,
    ]
  );

  useEffect(() => {
    let active = true;
    const doctorIdString = doctorId != null ? String(doctorId) : "";
    const isValidObjectId = /^[a-fA-F0-9]{24}$/.test(doctorIdString);

    if (!doctorIdString || !isValidObjectId) {
      setServices([]);
      setSelectedServiceIndex(null);
      setServicesLoading(false);
      return () => {
        active = false;
      };
    }

    setServicesLoading(true);
    fetchDoctorServices(doctorIdString)
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data?.services) ? data.services : [];
        setServices(list);
        setSelectedServiceIndex(list.length ? 0 : null);
      })
      .catch((err) => {
        console.error("Services fetch failed:", err);
        if (active) {
          setServices([]);
          setSelectedServiceIndex(null);
        }
      })
      .finally(() => {
        if (active) setServicesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [doctorId]);

  const availableDates = useMemo(
    () => getNextActiveDates(doctorSchedule.activeDays, 5),
    [doctorSchedule.activeDays]
  );

  const selectedDate =
    selectedDateIndex !== null ? availableDates[selectedDateIndex] : null;
  const selectedDateIso = selectedDate?.iso;

  const filteredTimeSlotOptions = useMemo(() => {
    if (!selectedDateIso) {
      return baseTimeSlotOptions;
    }
    const blockedForDate = blockedSlots[selectedDateIso] || [];
    console.warn("[debug] base slots count:", baseTimeSlotOptions.length, "blocked for", selectedDateIso, blockedForDate.length);
    if (!blockedForDate.length) {
      return baseTimeSlotOptions;
    }
    return baseTimeSlotOptions.filter(
      (slot) => !blockedForDate.includes(slot.value)
    );
  }, [baseTimeSlotOptions, selectedDateIso, blockedSlots]);

  const markSlotBlocked = (dateIso, timeValue) => {
    if (!dateIso || !timeValue) {
      return;
    }
    setBlockedSlots((prev) => {
      const existing = prev[dateIso] || [];
      if (existing.includes(timeValue)) {
        return prev;
      }
      return {
        ...prev,
        [dateIso]: [...existing, timeValue],
      };
    });
  };

  const loadBlockedSlots = useCallback(() => {
    let isActive = true;
    const doctorIdString = doctorId != null ? String(doctorId) : "";
    const isValidObjectId = /^[a-fA-F0-9]{24}$/.test(doctorIdString);

    if (!doctorIdString || !isValidObjectId) {
      setBlockedSlots({});
      setBlockedLoading(false);
      return () => {
        isActive = false;
      };
    }

    setBlockedLoading(true);
    fetchDoctorBlockedSlots(doctorIdString)
      .then((data) => {
        if (!isActive) return;
        const slots = data.blockedSlots || {};
        console.warn("[debug] fetchDoctorBlockedSlots result:", slots);
        setBlockedSlots(slots);
      })
      .catch((err) => {
        console.error("Blocked slots fetch failed:", err);
        if (isActive) {
          setBlockedSlots({});
        }
      })
      .finally(() => {
        if (isActive) {
          setBlockedLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [doctorId]);

  useFocusEffect(loadBlockedSlots);

  useEffect(() => {
    if (availableDates.length === 0) {
      setSelectedDateIndex(null);
      return;
    }
    if (selectedDateIndex !== null && selectedDateIndex >= availableDates.length) {
      setSelectedDateIndex(null);
    }
  }, [availableDates, selectedDateIndex]);

  useEffect(() => {
    if (filteredTimeSlotOptions.length === 0) {
      setSelectedTimeIndex(null);
      return;
    }
    if (
      selectedTimeIndex !== null &&
      selectedTimeIndex >= filteredTimeSlotOptions.length
    ) {
      setSelectedTimeIndex(null);
    }
  }, [filteredTimeSlotOptions, selectedTimeIndex]);

  const handleConfirm = async () => {
    if (loading) return;
    if (servicesLoading) {
      Alert.alert("انتظر قليلاً", "جاري تحميل خدمات الطبيب...");
      return;
    }
    if (selectedDateIndex === null || selectedTimeIndex === null) {
      Alert.alert("يُرجى اختيار التاريخ والوقت", "اختر يومًا ووقتًا قبل المتابعة.");
      return;
    }

    const selectedDate = availableDates[selectedDateIndex];
    const selectedSlot = filteredTimeSlotOptions[selectedTimeIndex];

    if (!selectedDate || !selectedSlot) {
      Alert.alert("خطأ", "تعذّر تحديد التاريخ أو الوقت المحدد.");
      return;
    }

    const payload = {
      doctorName,
      doctorRole,
      specialty,
      specialtySlug,
      appointmentDate: `${selectedDate.day}، ${selectedDate.displayDate}`,
      appointmentDateIso: selectedDate.iso,
      appointmentTime: selectedSlot.label,
      appointmentTimeValue: selectedSlot.value,
      doctorId,
      notes: "",
      ...(selectedServiceId ? { serviceId: selectedServiceId } : {}),
    };

    try {
      setLoading(true);
      let data;
      if (params.manualFromDoctor) {
        // include patient info when doctor creates appointment
        const manualPayload = {
          ...payload,
          patientName: params.patientName || "مراجع",
          patientPhone: params.patientPhone || "",
        };
        data = await createDoctorAppointment(manualPayload);
      } else {
        data = await bookAppointment(payload);
      }

      markSlotBlocked(selectedDateIso, selectedSlot.value);
      const appointment = data.appointment;
      Alert.alert("تم الحجز", "تم تسجيل الموعد بنجاح.");
      navigation.replace("AppointmentDetails", {
        name: appointment.doctorName,
        role: appointment.doctorRole,
        specialty: appointment.specialty,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status: appointment.status,
        appointmentId: appointment._id,
        avatarUrl: appointment.doctorProfile?.avatarUrl,
        location: appointment.doctorProfile?.location,
        consultationFee: appointment.service?.price ?? appointment.doctorProfile?.consultationFee,
        service: appointment.service,
        doctorBio: appointment.doctorProfile?.bio,
        secretaryPhone: appointment.doctorProfile?.secretaryPhone,
        qrCode: appointment.qrCode,
        qrPayload: appointment.qrPayload,
        createdByDoctor: appointment.createdByDoctor,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        Alert.alert("تسجيل الدخول مطلوب", "سجّل دخولك لحجز الموعد.", [
          { text: "إلغاء", style: "cancel" },
          { text: "تسجيل الدخول", onPress: () => navigation.replace("Login") },
        ]);
        return;
      }
      Alert.alert("فشل الحجز", err.message || "حاول مرة أخرى لاحقًا.");
    } finally {
      setLoading(false);
    }
  };

  const hasDates = availableDates.length > 0;
  const hasSlots = filteredTimeSlotOptions.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* loader for server schedule removed — use params.schedule when provided */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="chevron-right" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>حدد الموعد</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.doctorCard}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.doctorAvatar} />
          ) : (
            <View style={styles.avatar} />
          )}
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorName}>{doctorName || "اسم الطبيب غير متوفر"}</Text>
            <Text style={styles.doctorRole}>{doctorRole || "الاختصاص غير متوفر"}</Text>
            <Text style={styles.specialtyText}>{specialty || "التخصص غير متوفر"}</Text>
          </View>
        </View>

        {/* Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>اختر الخدمة</Text>
          {servicesLoading ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" color="#0EA5E9" />
            </View>
          ) : services.length === 0 ? (
            <Text style={styles.helperText}>
              لا توجد خدمات مضافة لهذا الطبيب حالياً.
            </Text>
          ) : (
            <View style={{ marginTop: 10 }}>
              {services.map((svc, idx) => {
                const active = idx === selectedServiceIndex;
                return (
                  <TouchableOpacity
                    key={svc._id || `${idx}`}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => {
                      setSelectedServiceIndex(idx);
                      // reset slot selection when duration changes
                      setSelectedTimeIndex(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                        {svc.name}
                      </Text>
                      <Text style={styles.optionMeta}>
                        {formatCurrency(svc.price)} • {svc.durationMinutes} دقيقة
                      </Text>
                    </View>
                    {active ? (
                      <Feather name="check-circle" size={18} color="#0EA5E9" />
                    ) : (
                      <Feather name="circle" size={18} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {selectedServicePrice !== null ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>السعر</Text>
              <Text style={styles.priceValue}>{formatCurrency(selectedServicePrice)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>اختر التاريخ</Text>
          {hasDates ? (
            <View style={styles.dateRow}>
              {availableDates.map((date, index) => {
                const isActive = index === selectedDateIndex;
                return (
                  <TouchableOpacity
                    key={date.key}
                    style={[styles.dateChip, isActive && styles.dateChipActive]}
                    onPress={() => setSelectedDateIndex(index)}
                  >
                    <Text
                      style={[styles.dateChipDay, isActive && styles.dateChipDayActive]}
                    >
                      {date.day}
                    </Text>
                    <Text
                      style={[styles.dateChipDate, isActive && styles.dateChipDateActive]}
                    >
                      {date.displayDate}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyStateText}>
              الطبيب لم يحدد أي أيام متاحة حاليًا.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>اختر الوقت</Text>
          {blockedLoading && (
            <Text style={styles.blockedNotice}>
              جاري مزامنة المواعيد المحجوزة مع العيادة...
            </Text>
          )}
          {selectedDateIso && (blockedSlots[selectedDateIso]?.length || 0) > 0 && (
            <Text style={styles.blockedNotice}>
              تم حجز {blockedSlots[selectedDateIso].length} وقتًا لهذا اليوم، ولن تظهر مجددًا.
            </Text>
          )}
          {hasSlots ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timeRow}
            >
              {filteredTimeSlotOptions.map((slot, index) => {
                const isActive = index === selectedTimeIndex;
                return (
                  <TouchableOpacity
                    key={`${slot.value}-${index}`}
                    style={[styles.timeChip, isActive && styles.timeChipActive]}
                    onPress={() => setSelectedTimeIndex(index)}
                  >
                    <Text
                      style={[styles.timeChipText, isActive && styles.timeChipTextActive]}
                    >
                      {slot.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.emptyStateText}>
              لا توجد مواعيد ضمن الإطار الزمني الحالي.
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!hasDates || !hasSlots ||
              selectedDateIndex === null ||
              selectedTimeIndex === null) &&
              styles.primaryButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={
            loading || !hasDates || !hasSlots ||
            selectedDateIndex === null ||
            selectedTimeIndex === null
          }
        >
          <View style={styles.primaryButtonContent}>
            {loading && (
              <ActivityIndicator size="small" color="#fff" style={styles.buttonSpinner} />
            )}
            <Text style={styles.primaryButtonText}>
              {loading ? "جارٍ الحجز..." : "تأكيد الحجز"}
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
    writingDirection: "rtl",
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    writingDirection: "rtl",
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    writingDirection: "rtl",
  },
  doctorCard: {
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
  },
  doctorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: "#DBEAFE",
  },
  doctorInfo: {
    marginHorizontal: 12,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
  },
  doctorRole: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "right",
  },
  specialtyText: {
    fontSize: 13,
    color: "#111827",
    textAlign: "right",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
  },
  helperText: {
    marginTop: 10,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "right",
    writingDirection: "rtl",
  },
  optionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  optionRowActive: {
    borderColor: "#0EA5E9",
    backgroundColor: "#EFF6FF",
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    textAlign: "right",
    writingDirection: "rtl",
  },
  optionTitleActive: {
    color: "#0EA5E9",
  },
  optionMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
    textAlign: "right",
    writingDirection: "rtl",
  },
  priceRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },
  priceValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "800",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    textAlign: "right",
    writingDirection: "rtl",
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    writingDirection: "rtl",
  },
  blockedNotice: {
    marginTop: 6,
    fontSize: 11,
    color: "#6B7280",
    textAlign: "right",
    writingDirection: "rtl",
  },
  dateRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    marginTop: 12,
  },
  dateChip: {
    minWidth: 72,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
    marginLeft: 10,
    marginBottom: 10,
  },
  dateChipActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  dateChipDay: {
    fontSize: 11,
    color: "#4B5563",
    writingDirection: "rtl",
  },
  dateChipDayActive: {
    color: "#fff",
  },
  dateChipDate: {
    fontSize: 16,
    fontWeight: "600",
    writingDirection: "rtl",
  },
  dateChipDateActive: {
    color: "#fff",
  },
  timeRow: {
    flexDirection: "row",
    paddingVertical: 12,
  },
  timeChip: {
    minWidth: 90,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    backgroundColor: "#fff",
    marginRight: 12,
  },
  timeChipActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  timeChipText: {
    fontSize: 15,
    color: "#374151",
    writingDirection: "rtl",
  },
  timeChipTextActive: {
    color: "#fff",
  },
  primaryButton: {
    backgroundColor: "#0EA5E9",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0EA5E9",
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: "#F8FAFC",
  },
  secondaryButtonIcon: {
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: "#0EA5E9",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    writingDirection: "rtl",
  },
  primaryButtonDisabled: {
    backgroundColor: "#BAE6FD",
  },
  primaryButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSpinner: {
    marginRight: 6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    writingDirection: "rtl",
  },
});
