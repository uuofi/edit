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
import { useAppTheme } from "../lib/useTheme";
import {
  bookAppointment,
  bookCenterAppointment,
  ApiError,
  fetchCenterDoctorBlockedSlots,
  fetchCenterDoctorServices,
  fetchDoctorBlockedSlots,
  createDoctorAppointment,
  fetchDoctorServices,
} from "../lib/api";
import {
  DEFAULT_SCHEDULE,
  DAY_LABELS,
  WEEKDAY_KEYS,
} from "../lib/constants/schedule";

// أعمدة التقويم تبدأ من السبت (مطابق للصورة): السبت ← الجمعة
const CALENDAR_DAY_KEYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];
const CALENDAR_HEADER_LABELS = {
  sun: "الأحد",
  mon: "الإثنين",
  tue: "الثلاثاء",
  wed: "الأربعاء",
  thu: "الخميس",
  fri: "الجمعة",
  sat: "السبت",
};
// كم شهرًا للأمام يُسمح بالتنقل إليه
const MAX_MONTHS_AHEAD = 6;
// الخطوات الثلاث
const STEPS = [
  { id: 1, label: "الخدمة", title: "اختر الخدمة" },
  { id: 2, label: "التاريخ", title: "اختر التاريخ" },
  { id: 3, label: "الوقت", title: "اختر الوقت" },
];

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

/** Return YYYY-MM-DD using LOCAL date components (avoids UTC shift). */
const toLocalIso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** يبني وصف التاريخ (يوم/رقم/iso) من سلسلة YYYY-MM-DD محليًا. */
const buildDateDescriptor = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  const dayKey = WEEKDAY_KEYS[dt.getDay()];
  return {
    iso,
    day: DAY_LABELS[dayKey] || dayKey,
    displayDate: dt.toLocaleDateString("ar-EG", { day: "numeric" }),
  };
};

const startOfDay = (d) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export default function BookAppointmentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useAppTheme();
  const params = route.params || {};

  // استخدم بيانات الدكتور من params فقط إذا كانت موجودة، وإلا لا تعرض بيانات افتراضية
  const doctorName = typeof params.doctorName === "string" ? params.doctorName : "";
  const doctorRole = typeof params.doctorRole === "string" ? params.doctorRole : "";
  const specialty = typeof params.specialty === "string" ? params.specialty : "";
  const specialtySlug = typeof params.specialtySlug === "string" ? params.specialtySlug : "";
  const avatarUrl = typeof params.avatarUrl === "string" ? params.avatarUrl : "";
  const doctorId = typeof params.doctorId === "string" || typeof params.doctorId === "number" ? params.doctorId : "";
  const medicalCenterId =
    typeof params.medicalCenterId === "string" || typeof params.medicalCenterId === "number"
      ? String(params.medicalCenterId)
      : "";
  const doctorCenterId =
    typeof params.doctorCenterId === "string" || typeof params.doctorCenterId === "number"
      ? String(params.doctorCenterId)
      : "";

  const isValidObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || ""));
  const isCenterBookingContext =
    isValidObjectId(medicalCenterId) && isValidObjectId(doctorCenterId);

  const [step, setStep] = useState(1);
  const [selectedDateIso, setSelectedDateIso] = useState(null);
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

  const baseTimeSlotOptions = useMemo(
    () =>
      createTimeSlots({
        startTime: doctorSchedule.startTime,
        endTime: doctorSchedule.endTime,
        duration: doctorSchedule.duration,
        breakEnabled: doctorSchedule.breakEnabled,
        breakFrom: doctorSchedule.breakFrom,
        breakTo: doctorSchedule.breakTo,
      }),
    [
      doctorSchedule.startTime,
      doctorSchedule.endTime,
      doctorSchedule.duration,
      doctorSchedule.breakEnabled,
      doctorSchedule.breakFrom,
      doctorSchedule.breakTo,
    ]
  );

  useEffect(() => {
    let active = true;
    const doctorIdString = doctorId != null ? String(doctorId) : "";
    const isDoctorIdValid = isValidObjectId(doctorIdString);

    if (isCenterBookingContext) {
      setServicesLoading(true);
      fetchCenterDoctorServices(medicalCenterId, doctorCenterId)
        .then((data) => {
          if (!active) return;
          const list = Array.isArray(data?.services) ? data.services : [];
          setServices(list);
          setSelectedServiceIndex(list.length ? 0 : null);
        })
        .catch((err) => {
          console.error("Center services fetch failed:", err);
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
    }

    if (!doctorIdString || !isDoctorIdValid) {
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

  // الأيام التي يعمل بها الطبيب + الأيام المعطّلة
  const activeDaysSet = useMemo(
    () => new Set(doctorSchedule.activeDays || []),
    [doctorSchedule.activeDays]
  );
  const disabledDatesSet = useMemo(
    () =>
      new Set(
        Array.isArray(doctorSchedule.disabledDates) ? doctorSchedule.disabledDates : []
      ),
    [doctorSchedule.disabledDates]
  );
  const hasAnyActiveDay = activeDaysSet.size > 0;

  // الشهر المعروض في التقويم (اليوم الأول من الشهر)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const todayIso = useMemo(() => toLocalIso(startOfDay(new Date())), []);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDate = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // عمود اليوم الأول (السبت = 0)
    const firstCol = (firstDate.getDay() + 1) % 7;
    const today = startOfDay(new Date());

    const cells = [];
    for (let i = 0; i < firstCol; i += 1) {
      cells.push({ type: "blank", key: `blank-${year}-${month}-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      const dt = new Date(year, month, d);
      const iso = toLocalIso(dt);
      const dayKey = WEEKDAY_KEYS[dt.getDay()];
      const isPast = startOfDay(dt) < today;
      const selectable =
        !isPast && activeDaysSet.has(dayKey) && !disabledDatesSet.has(iso);
      cells.push({
        type: "day",
        key: iso,
        iso,
        day: d,
        selectable,
        isToday: iso === todayIso,
      });
    }
    return cells;
  }, [calendarMonth, activeDaysSet, disabledDatesSet, todayIso]);

  const monthLabel = useMemo(
    () =>
      calendarMonth.toLocaleDateString("ar-EG", {
        month: "long",
        year: "numeric",
      }),
    [calendarMonth]
  );

  const monthBounds = useMemo(() => {
    const now = new Date();
    const minIndex = now.getFullYear() * 12 + now.getMonth();
    const maxIndex = minIndex + MAX_MONTHS_AHEAD;
    const currentIndex = calendarMonth.getFullYear() * 12 + calendarMonth.getMonth();
    return {
      canGoPrev: currentIndex > minIndex,
      canGoNext: currentIndex < maxIndex,
    };
  }, [calendarMonth]);

  const goPrevMonth = () => {
    if (!monthBounds.canGoPrev) return;
    setCalendarMonth(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
    );
  };
  const goNextMonth = () => {
    if (!monthBounds.canGoNext) return;
    setCalendarMonth(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
    );
  };

  const selectedDateFullLabel = useMemo(() => {
    if (!selectedDateIso) return "";
    const [y, m, d] = selectedDateIso.split("-").map(Number);
    if (!y || !m || !d) return "";
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("ar-EG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [selectedDateIso]);

  const filteredTimeSlotOptions = useMemo(() => {
    if (!selectedDateIso) {
      return baseTimeSlotOptions;
    }
    const blockedForDate = blockedSlots[selectedDateIso] || [];
    if (!blockedForDate.length) {
      return baseTimeSlotOptions;
    }
    const blockedSet = new Set(blockedForDate);
    const baseSlotDuration =
      Number.isFinite(Number(doctorSchedule.duration)) && Number(doctorSchedule.duration) > 0
        ? Number(doctorSchedule.duration)
        : DEFAULT_SCHEDULE.duration;
    const span = Math.max(1, Math.ceil(Number(effectiveSlotDuration || baseSlotDuration) / baseSlotDuration));

    return baseTimeSlotOptions.filter((slot) => {
      const startMin = parseMinutes(slot.value);
      for (let i = 0; i < span; i += 1) {
        const covered = startMin + i * baseSlotDuration;
        const hh = String(Math.floor(covered / 60)).padStart(2, "0");
        const mm = String(covered % 60).padStart(2, "0");
        const coveredSlot = `${hh}:${mm}`;
        if (blockedSet.has(coveredSlot)) {
          return false;
        }
      }
      return true;
    });
  }, [baseTimeSlotOptions, selectedDateIso, blockedSlots, doctorSchedule.duration, effectiveSlotDuration]);

  // تقسيم الأوقات إلى صباحًا / مساءً مع الحفاظ على الفهرس الأصلي
  const { morningSlots, eveningSlots } = useMemo(() => {
    const morning = [];
    const evening = [];
    filteredTimeSlotOptions.forEach((slot, index) => {
      const entry = { ...slot, index };
      if (parseMinutes(slot.value) < 12 * 60) {
        morning.push(entry);
      } else {
        evening.push(entry);
      }
    });
    return { morningSlots: morning, eveningSlots: evening };
  }, [filteredTimeSlotOptions]);

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
    const isDoctorIdValid = isValidObjectId(doctorIdString);

    if (isCenterBookingContext) {
      setBlockedLoading(true);
      fetchCenterDoctorBlockedSlots(medicalCenterId, doctorCenterId)
        .then((data) => {
          if (!isActive) return;
          const slots = data.blockedSlots || {};
          setBlockedSlots(slots);
        })
        .catch((err) => {
          console.error("Center blocked slots fetch failed:", err);
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
    }

    if (!doctorIdString || !isDoctorIdValid) {
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

  // إعادة ضبط فهرس الوقت إذا أصبح خارج النطاق بعد فلترة المحجوز
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

  const handleSelectService = (idx) => {
    setSelectedServiceIndex(idx);
    // تغيّر مدة الخدمة قد يغيّر المواعيد المتاحة → أعد ضبط الوقت
    setSelectedTimeIndex(null);
  };

  const handleSelectDate = (iso) => {
    setSelectedDateIso(iso);
    setSelectedTimeIndex(null);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      return;
    }
    navigation.goBack();
  };

  const handleNext = () => {
    if (step === 1) {
      if (servicesLoading) {
        Alert.alert("انتظر قليلاً", "جاري تحميل خدمات الطبيب...");
        return;
      }
      if (services.length > 0 && selectedServiceIndex === null) {
        Alert.alert("اختر الخدمة", "يُرجى اختيار خدمة قبل المتابعة.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!hasAnyActiveDay) {
        Alert.alert("لا توجد مواعيد", "الطبيب لم يحدد أي أيام متاحة حاليًا.");
        return;
      }
      if (!selectedDateIso) {
        Alert.alert("اختر التاريخ", "يُرجى اختيار يوم قبل المتابعة.");
        return;
      }
      setStep(3);
    }
  };

  const handleConfirm = async () => {
    if (loading) return;
    if (servicesLoading) {
      Alert.alert("انتظر قليلاً", "جاري تحميل خدمات الطبيب...");
      return;
    }
    if (!selectedDateIso || selectedTimeIndex === null) {
      Alert.alert("يُرجى اختيار التاريخ والوقت", "اختر يومًا ووقتًا قبل المتابعة.");
      return;
    }

    const selectedDate = buildDateDescriptor(selectedDateIso);
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
      } else if (isCenterBookingContext) {
        const centerPayload = {
          doctorCenterId,
          appointmentDate: `${selectedDate.day}، ${selectedDate.displayDate}`,
          appointmentDateIso: selectedDate.iso,
          appointmentTime: selectedSlot.label,
          appointmentTimeValue: selectedSlot.value,
          notes: "",
          ...(selectedServiceId ? { serviceId: selectedServiceId } : {}),
        };
        data = await bookCenterAppointment(medicalCenterId, centerPayload);
      } else {
        data = await bookAppointment(payload);
      }

      markSlotBlocked(selectedDateIso, selectedSlot.value);
      const appointment = data.appointment || data.booking;
      Alert.alert("تم الحجز", "تم تسجيل الموعد بنجاح.");
      navigation.replace("AppointmentDetails", {
        name: appointment.doctorName,
        role: appointment.doctorRole || appointment.doctorProfile?.specialtyLabel || "طبيب",
        specialty: appointment.specialty,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status: appointment.status,
        appointmentId: appointment._id,
        avatarUrl: appointment.doctorProfile?.avatarUrl,
        location: appointment.doctorProfile?.location,
        consultationFee:
          appointment.service?.price ?? appointment.price ?? appointment.doctorProfile?.consultationFee,
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

  const hasSlots = filteredTimeSlotOptions.length > 0;
  const styles = useMemo(() => createStyles(colors), [colors]);

  // تعطيل زر القدم لكل خطوة
  const isFooterDisabled = useMemo(() => {
    if (loading) return true;
    if (step === 1) {
      return servicesLoading || (services.length > 0 && selectedServiceIndex === null);
    }
    if (step === 2) {
      return !hasAnyActiveDay || !selectedDateIso;
    }
    // step 3
    return !hasSlots || selectedTimeIndex === null;
  }, [
    loading,
    step,
    servicesLoading,
    services.length,
    selectedServiceIndex,
    hasAnyActiveDay,
    selectedDateIso,
    hasSlots,
    selectedTimeIndex,
  ]);

  const activeStep = STEPS.find((s) => s.id === step) || STEPS[0];

  const renderStepIndicator = () => (
    <View style={styles.stepperRow}>
      {STEPS.map((s, idx) => {
        const isDone = s.id < step;
        const isCurrent = s.id === step;
        const circleStyle = [
          styles.stepCircle,
          (isDone || isCurrent) && styles.stepCircleActive,
        ];
        return (
          <React.Fragment key={s.id}>
            <View style={styles.stepItem}>
              <View style={circleStyle}>
                {isDone ? (
                  <Feather name="check" size={16} color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      isCurrent && styles.stepNumberActive,
                    ]}
                  >
                    {s.id}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  (isDone || isCurrent) && styles.stepLabelActive,
                ]}
              >
                {s.label}
              </Text>
            </View>
            {idx < STEPS.length - 1 ? (
              <View
                style={[
                  styles.stepConnector,
                  s.id < step && styles.stepConnectorActive,
                ]}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );

  const renderServiceStep = () => {
    if (servicesLoading) {
      return (
        <View style={{ paddingVertical: 24 }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    if (services.length === 0) {
      return (
        <View style={styles.card}>
          <Text style={styles.helperText}>
            لا توجد خدمات مضافة لهذا الطبيب حالياً، يمكنك المتابعة لاختيار الموعد.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.card}>
        <View style={styles.serviceHeaderRow}>
          <Text style={styles.serviceHeaderText}>الخدمات</Text>
          <Text style={styles.serviceHeaderText}>تفاصيل السعر</Text>
        </View>
        {services.map((svc, idx) => {
          const active = idx === selectedServiceIndex;
          const hasDiscount =
            Number(svc?.discountPercent) > 0 &&
            Number(svc?.discountedPrice) < Number(svc?.originalPrice ?? svc?.price);
          return (
            <TouchableOpacity
              key={svc._id || `${idx}`}
              style={[
                styles.serviceRow,
                idx === services.length - 1 && styles.serviceRowLast,
              ]}
              onPress={() => handleSelectService(idx)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${svc.name}`}
            >
              <View style={styles.serviceNameWrap}>
                <Text
                  style={[styles.serviceName, active && styles.serviceNameActive]}
                  numberOfLines={2}
                >
                  {svc.name}
                </Text>
                <Feather
                  name={active ? "check-circle" : "circle"}
                  size={20}
                  color={active ? colors.primary : colors.placeholder}
                  style={styles.serviceRadio}
                />
              </View>
              <View style={styles.servicePriceWrap}>
                {hasDiscount ? (
                  <Text style={styles.servicePriceOld}>
                    {formatCurrency(svc?.originalPrice ?? svc?.price)}
                  </Text>
                ) : null}
                <Text style={[styles.servicePrice, active && styles.servicePriceActive]}>
                  {formatCurrency(hasDiscount ? svc.discountedPrice : svc.price)}
                </Text>
                {Number(svc?.durationMinutes) > 0 ? (
                  <Text style={styles.serviceDuration}>{svc.durationMinutes} دقيقة</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderDateStep = () => {
    if (!hasAnyActiveDay) {
      return (
        <View style={styles.card}>
          <Text style={styles.emptyStateText}>
            الطبيب لم يحدد أي أيام متاحة حاليًا.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.card}>
        {/* تنقّل بين الأشهر */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            onPress={goNextMonth}
            disabled={!monthBounds.canGoNext}
            style={styles.calendarNavBtn}
            accessibilityRole="button"
            accessibilityLabel="الشهر التالي"
          >
            <Feather
              name="chevron-left"
              size={24}
              color={monthBounds.canGoNext ? colors.text : colors.placeholder}
            />
          </TouchableOpacity>
          <Text style={styles.calendarMonthLabel}>{monthLabel}</Text>
          <TouchableOpacity
            onPress={goPrevMonth}
            disabled={!monthBounds.canGoPrev}
            style={styles.calendarNavBtn}
            accessibilityRole="button"
            accessibilityLabel="الشهر السابق"
          >
            <Feather
              name="chevron-right"
              size={24}
              color={monthBounds.canGoPrev ? colors.text : colors.placeholder}
            />
          </TouchableOpacity>
        </View>

        {/* رؤوس الأيام */}
        <View style={styles.weekHeaderRow}>
          {CALENDAR_DAY_KEYS.map((key) => (
            <Text key={key} style={styles.weekHeaderCell}>
              {CALENDAR_HEADER_LABELS[key]}
            </Text>
          ))}
        </View>

        {/* خلايا الأيام */}
        <View style={styles.calendarGrid}>
          {calendarCells.map((cell) => {
            if (cell.type === "blank") {
              return <View key={cell.key} style={styles.dayCell} />;
            }
            const isSelected = cell.iso === selectedDateIso;
            return (
              <View key={cell.key} style={styles.dayCell}>
                <TouchableOpacity
                  disabled={!cell.selectable}
                  onPress={() => handleSelectDate(cell.iso)}
                  style={[
                    styles.dayButton,
                    isSelected && styles.dayButtonSelected,
                    cell.isToday && !isSelected && styles.dayButtonToday,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: !cell.selectable }}
                  accessibilityLabel={`${cell.day}`}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !cell.selectable && styles.dayTextDisabled,
                      isSelected && styles.dayTextSelected,
                      cell.isToday && !isSelected && styles.dayTextToday,
                    ]}
                  >
                    {cell.day}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* بطاقة التاريخ المختار */}
        {selectedDateFullLabel ? (
          <View style={styles.selectedDateCard}>
            <Text style={styles.selectedDateText}>{selectedDateFullLabel}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderTimeGroup = (label, slots) => {
    if (!slots.length) return null;
    return (
      <View style={styles.timeGroup}>
        <Text style={styles.timeGroupLabel}>{label}</Text>
        <View style={styles.timeGrid}>
          {slots.map((slot) => {
            const isActive = slot.index === selectedTimeIndex;
            return (
              <TouchableOpacity
                key={`${slot.value}-${slot.index}`}
                style={[styles.timeChip, isActive && styles.timeChipActive]}
                onPress={() => setSelectedTimeIndex(slot.index)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={slot.label}
              >
                <Text
                  style={[styles.timeChipText, isActive && styles.timeChipTextActive]}
                >
                  {slot.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderTimeStep = () => (
    <View>
      {selectedDateFullLabel ? (
        <Text style={styles.timeStepSubtitle}>{selectedDateFullLabel}</Text>
      ) : null}
      {blockedLoading ? (
        <Text style={styles.blockedNotice}>
          جاري مزامنة المواعيد المحجوزة مع العيادة...
        </Text>
      ) : null}
      {selectedDateIso && (blockedSlots[selectedDateIso]?.length || 0) > 0 ? (
        <Text style={styles.blockedNotice}>
          تم حجز {blockedSlots[selectedDateIso].length} وقتًا لهذا اليوم، ولن تظهر مجددًا.
        </Text>
      ) : null}
      {hasSlots ? (
        <>
          {renderTimeGroup("صباحاً", morningSlots)}
          {renderTimeGroup("مساءً", eveningSlots)}
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.emptyStateText}>
            لا توجد مواعيد متاحة في هذا اليوم.
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* الرأس */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
        >
          <Feather name="arrow-right" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{activeStep.title}</Text>
        <View style={styles.backButton} />
      </View>

      {renderStepIndicator()}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && doctorName ? (
          <View style={styles.doctorStrip}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.doctorAvatar} />
            ) : (
              <View style={styles.doctorAvatarPlaceholder}>
                <Feather name="user" size={20} color={colors.primary} />
              </View>
            )}
            <View style={styles.doctorStripInfo}>
              <Text style={styles.doctorName} numberOfLines={1}>
                {doctorName}
              </Text>
              <Text style={styles.doctorRole} numberOfLines={1}>
                {doctorRole || specialty || "طبيب"}
              </Text>
            </View>
          </View>
        ) : null}

        {step === 1 && renderServiceStep()}
        {step === 2 && renderDateStep()}
        {step === 3 && renderTimeStep()}
      </ScrollView>

      {/* القدم */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, isFooterDisabled && styles.primaryButtonDisabled]}
          onPress={step === 3 ? handleConfirm : handleNext}
          disabled={isFooterDisabled}
          accessibilityRole="button"
        >
          <View style={styles.primaryButtonContent}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" style={styles.buttonSpinner} />
            ) : null}
            <Text style={styles.primaryButtonText}>
              {step === 3
                ? loading
                  ? "جارٍ الحجز..."
                  : "احجز موعد"
                : "التالي"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
      writingDirection: "rtl",
    },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
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
      color: colors.text,
      writingDirection: "rtl",
    },
    // Stepper
    stepperRow: {
      flexDirection: "row-reverse",
      alignItems: "flex-start",
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
    },
    stepItem: {
      alignItems: "center",
      width: 64,
    },
    stepCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepCircleActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    stepNumber: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textMuted,
    },
    stepNumberActive: {
      color: "#fff",
    },
    stepLabel: {
      marginTop: 6,
      fontSize: 12,
      color: colors.textMuted,
      writingDirection: "rtl",
    },
    stepLabelActive: {
      color: colors.primary,
      fontWeight: "700",
    },
    stepConnector: {
      height: 2,
      width: 28,
      backgroundColor: colors.border,
      marginTop: 15,
      marginHorizontal: -6,
    },
    stepConnectorActive: {
      backgroundColor: colors.primary,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      writingDirection: "rtl",
    },
    // Doctor strip
    doctorStrip: {
      flexDirection: "row-reverse",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    doctorAvatar: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary + "20",
    },
    doctorAvatarPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    doctorStripInfo: {
      flex: 1,
      marginHorizontal: 12,
    },
    doctorName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    doctorRole: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    // Generic card
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    helperText: {
      paddingVertical: 16,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    emptyStateText: {
      paddingVertical: 20,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      writingDirection: "rtl",
    },
    blockedNotice: {
      marginBottom: 10,
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    // Services
    serviceHeaderRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    serviceHeaderText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
      writingDirection: "rtl",
    },
    serviceRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      minHeight: 56,
    },
    serviceRowLast: {
      borderBottomWidth: 0,
    },
    serviceNameWrap: {
      flexDirection: "row-reverse",
      alignItems: "center",
      flex: 1,
    },
    serviceRadio: {
      marginRight: 10,
    },
    serviceName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
      flexShrink: 1,
    },
    serviceNameActive: {
      color: colors.primary,
    },
    servicePriceWrap: {
      alignItems: "flex-start",
      marginLeft: 8,
    },
    servicePrice: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      writingDirection: "rtl",
    },
    servicePriceActive: {
      color: colors.primary,
    },
    servicePriceOld: {
      fontSize: 12,
      color: colors.textMuted,
      textDecorationLine: "line-through",
      writingDirection: "rtl",
    },
    serviceDuration: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      writingDirection: "rtl",
    },
    // Calendar
    calendarHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    calendarNavBtn: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    calendarMonthLabel: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      writingDirection: "rtl",
    },
    weekHeaderRow: {
      flexDirection: "row-reverse",
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    weekHeaderCell: {
      width: `${100 / 7}%`,
      textAlign: "center",
      fontSize: 11,
      color: colors.textMuted,
      writingDirection: "rtl",
    },
    calendarGrid: {
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      paddingVertical: 8,
    },
    dayCell: {
      width: `${100 / 7}%`,
      height: 46,
      justifyContent: "center",
      alignItems: "center",
    },
    dayButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    dayButtonSelected: {
      backgroundColor: colors.primary,
    },
    dayButtonToday: {
      borderWidth: 1,
      borderColor: colors.primary,
    },
    dayText: {
      fontSize: 15,
      color: colors.text,
      fontWeight: "600",
      writingDirection: "rtl",
    },
    dayTextDisabled: {
      color: colors.placeholder,
      fontWeight: "400",
    },
    dayTextSelected: {
      color: "#fff",
      fontWeight: "700",
    },
    dayTextToday: {
      color: colors.primary,
      fontWeight: "700",
    },
    selectedDateCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 12,
      marginTop: 8,
      marginBottom: 8,
      alignItems: "center",
    },
    selectedDateText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      writingDirection: "rtl",
    },
    // Time
    timeStepSubtitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      textAlign: "center",
      marginBottom: 16,
      writingDirection: "rtl",
    },
    timeGroup: {
      marginBottom: 20,
    },
    timeGroupLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
      marginBottom: 12,
      writingDirection: "rtl",
    },
    timeGrid: {
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      justifyContent: "flex-start",
    },
    timeChip: {
      width: `${(100 - 2 * 4) / 3}%`,
      marginLeft: "2%",
      marginBottom: 12,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      backgroundColor: colors.surface,
    },
    timeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    timeChipText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "600",
      writingDirection: "rtl",
    },
    timeChipTextActive: {
      color: "#fff",
    },
    // Footer
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    buttonSpinner: {
      marginRight: 8,
    },
    primaryButtonText: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "700",
      textAlign: "center",
      writingDirection: "rtl",
    },
  });
