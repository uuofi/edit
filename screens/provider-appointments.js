import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";

import {
  acceptDoctorAppointment,
  cancelDoctorAppointment,
  cancelDoctorCenterBooking,
  completeDoctorAppointment,
  rescheduleDoctorAppointment,
  createDoctorAppointment,
  assignEmployeeToAppointment,
  fetchSecretaries,
  ApiError,
  fetchDoctorAppointments,
  fetchDoctorCenterBookings,
  fetchMyDoctorCenters,
  fetchDoctorDashboard,
  fetchDoctorBlockedSlots,
  getBlock,
  setBlock,
  acceptDoctorCenterBooking,
  logout,
} from "../lib/api";
import { STATUS_LABELS } from "../lib/constants/statusLabels";
import {
  DEFAULT_SCHEDULE,
  DAY_LABELS,
  WEEKDAY_KEYS,
} from "../lib/constants/schedule";
import { useAppTheme } from "../lib/useTheme";


const parseMinutes = (value) => {
  const [hours = 0, minutes = 0] = String(value || "")
    .split(":")
    .map((v) => Number(v));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
};

const formatSlotLabel = (minutes) => {
  const hours24 = Math.floor(minutes / 60);
  const minutesPart = (minutes % 60).toString().padStart(2, "0");
  const period = hours24 >= 12 ? "م" : "ص";
  let displayHour = hours24 % 12;
  if (displayHour === 0) displayHour = 12;
  const hourString = displayHour.toString().padStart(2, "0");
  return `${hourString}:${minutesPart} ${period}`;
};

const createTimeSlots = (schedule) => {
  const slots = [];
  const duration = schedule.duration > 0 ? schedule.duration : DEFAULT_SCHEDULE.duration;
  const start = parseMinutes(schedule.startTime);
  const end = parseMinutes(schedule.endTime);
  const breakStart = schedule.breakEnabled ? parseMinutes(schedule.breakFrom) : null;
  const breakEnd = schedule.breakEnabled ? parseMinutes(schedule.breakTo) : null;
  const hasBreak =
    schedule.breakEnabled &&
    typeof breakStart === "number" &&
    typeof breakEnd === "number" &&
    breakEnd > breakStart;

  if (end <= start || duration <= 0) return slots;

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

const toComparableDateIso = (appointment) => {
  const raw = String(
    appointment?.appointmentDateIso || appointment?.appointmentDate || ""
  ).trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return toLocalIso(parsed);
  }

  const partialIso = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(partialIso) ? partialIso : "";
};

const getNextActiveDates = (activeDays, count = 7) => {
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
      const localIso = toLocalIso(pointer);
      dates.push({
        key: `${dayKey}-${localIso}`,
        day: DAY_LABELS[dayKey] || dayKey,
        displayDate: pointer.toLocaleDateString("ar-EG", { day: "numeric" }),
        iso: localIso,
      });
    }
    pointer.setDate(pointer.getDate() + 1);
  }

  return dates;
};

export default function ProviderAppointmentsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [bulkActionLoading, setBulkActionLoading] = useState({
    acceptAll: false,
    completeAll: false,
  });
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [recentCancelled, setRecentCancelled] = useState(null);
  const [expandedQrId, setExpandedQrId] = useState(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const emptyManualForm = {
    patientId: "",
    patientName: "",
    patientPhone: "",
    appointmentDate: "",
    appointmentDateIso: "",
    appointmentTime: "",
    appointmentTimeValue: "",
    notes: "",
  };
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [manualLoading, setManualLoading] = useState(false);
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDateIndex, setRescheduleDateIndex] = useState(null);
  const [rescheduleTimeIndex, setRescheduleTimeIndex] = useState(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [doctorId, setDoctorId] = useState(null);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [blockedSlots, setBlockedSlots] = useState({});
  const [selectedDateIndex, setSelectedDateIndex] = useState(null);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();

  // ─── Assign Employee state ─────────────────────────────────
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null); // appointment to assign
  const [employeeList, setEmployeeList] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [employeeListLoading, setEmployeeListLoading] = useState(false);

  const fetchingRef = useRef(false);
  const consumedManualRequestRef = useRef(null);

  const availableDates = useMemo(
    () => getNextActiveDates(schedule.activeDays, 7),
    [schedule.activeDays]
  );

  const baseTimeSlotOptions = useMemo(
    () =>
      createTimeSlots({
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        duration: schedule.duration,
        breakEnabled: schedule.breakEnabled,
        breakFrom: schedule.breakFrom,
        breakTo: schedule.breakTo,
      }),
    [schedule.startTime, schedule.endTime, schedule.duration, schedule.breakEnabled, schedule.breakFrom, schedule.breakTo]
  );

  const selectedDate = selectedDateIndex !== null ? availableDates[selectedDateIndex] : null;
  const selectedDateIso = selectedDate?.iso;

  const selectedRescheduleDate =
    rescheduleDateIndex !== null ? availableDates[rescheduleDateIndex] : null;
  const selectedRescheduleDateIso = selectedRescheduleDate?.iso;

  const filteredTimeSlotOptions = useMemo(() => {
    if (!selectedDateIso) return baseTimeSlotOptions;
    const blockedForDate = blockedSlots[selectedDateIso] || [];
    if (!blockedForDate.length) return baseTimeSlotOptions;
    return baseTimeSlotOptions.filter((slot) => !blockedForDate.includes(slot.value));
  }, [baseTimeSlotOptions, blockedSlots, selectedDateIso]);

  const filteredRescheduleTimeSlotOptions = useMemo(() => {
    if (!selectedRescheduleDateIso) return baseTimeSlotOptions;
    const blockedForDate = blockedSlots[selectedRescheduleDateIso] || [];
    if (!blockedForDate.length) return baseTimeSlotOptions;
    return baseTimeSlotOptions.filter((slot) => !blockedForDate.includes(slot.value));
  }, [baseTimeSlotOptions, blockedSlots, selectedRescheduleDateIso]);

  const selectedRescheduleTime =
    rescheduleTimeIndex !== null
      ? filteredRescheduleTimeSlotOptions[rescheduleTimeIndex] || null
      : null;

  const proposedRescheduleLabel =
    selectedRescheduleDate && selectedRescheduleTime
      ? `${selectedRescheduleDate.day}، ${selectedRescheduleDate.displayDate} — ${selectedRescheduleTime.label}`
      : "لم يتم اختيار موعد جديد بعد";

  const normalizePhone = (raw) => {
    if (!raw) return "";
    let digits = String(raw).replace(/[^0-9]/g, "");
    if (!digits) return "";
    if (digits.startsWith("0")) {
      digits = `964${digits.slice(1)}`;
    } else if (!digits.startsWith("964")) {
      digits = `964${digits}`;
    }
    return digits;
  };

  const openWhatsApp = (rawPhone) => {
    if (!rawPhone) {
      Alert.alert("تنبيه", "لا يوجد رقم للتواصل عبر واتساب");
      return;
    }
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      Alert.alert("تنبيه", "صيغة الرقم غير صالحة للتواصل عبر واتساب");
      return;
    }
    const url = `https://wa.me/${phone}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        }
        Alert.alert("تنبيه", "واتساب غير متوفر على هذا الجهاز");
      })
      .catch(() => Alert.alert("خطأ", "تعذّر فتح واتساب، جرّب الاتصال الهاتفي"));
  };

  const callPatient = (phone) => {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      Alert.alert("تنبيه", "لا يوجد رقم للاتصال");
      return;
    }
    const url = `tel:${normalized}`;
    Linking.openURL(url).catch(() => Alert.alert("خطأ", "تعذّر إجراء الاتصال"));
  };

  const visibleAppointments = useMemo(() => {
    const activeAppointments = appointments.filter(
      (appointment) => appointment?.status !== "completed"
    );
    const todayIso = toLocalIso(new Date());
    const q = String(searchQuery || "").trim().toLowerCase();
    return activeAppointments.filter((appointment) => {
      if (todayOnly) {
        const appointmentIso = toComparableDateIso(appointment);
        if (appointmentIso !== todayIso) return false;
      }

      if (!q) return true;

      const patientName = String(appointment?.user?.name || "").toLowerCase();
      const patientPhone = String(appointment?.user?.phone || "").toLowerCase();
      const bookingNo = String(
        appointment?.doctorQueueNumber ??
          appointment?.doctorIndex ??
          appointment?.bookingNumber ??
          appointment?._id ??
          ""
      ).toLowerCase();
      return patientName.includes(q) || patientPhone.includes(q) || bookingNo.includes(q);
    });
  }, [appointments, searchQuery, todayOnly]);

  const activeAppointments = useMemo(
    () => appointments.filter((appointment) => appointment?.status !== "completed"),
    [appointments]
  );

  const todayAppointments = useMemo(() => {
    const todayIso = toLocalIso(new Date());
    return activeAppointments.filter((appointment) => toComparableDateIso(appointment) === todayIso);
  }, [activeAppointments]);

  const todayPendingAppointments = useMemo(
    () => todayAppointments.filter((appointment) => appointment.status === "pending"),
    [todayAppointments]
  );

  const todayConfirmedAppointments = useMemo(
    () => todayAppointments.filter((appointment) => appointment.status === "confirmed"),
    [todayAppointments]
  );

  const showBulkCompleteAllButton =
    todayAppointments.length > 0 &&
    todayPendingAppointments.length === 0 &&
    todayConfirmedAppointments.length > 0;

  const updateManualForm = (field, value) =>
    setManualForm((prev) => ({ ...prev, [field]: value }));

  const resetManualForm = () => {
    setManualForm(emptyManualForm);
    setSelectedDateIndex(null);
    setSelectedTimeIndex(null);
  };

  const markSlotBlocked = (dateIso, timeValue) => {
    if (!dateIso || !timeValue) return;
    setBlockedSlots((prev) => {
      const existing = prev[dateIso] || [];
      if (existing.includes(timeValue)) return prev;
      return { ...prev, [dateIso]: [...existing, timeValue] };
    });
  };

  const redirectToLogin = useCallback(() => {
    (async () => {
      try {
        await logout();
      } catch (_err) {
        // continue to login even if logout request fails
      } finally {
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      }
    })();
  }, [navigation]);

  const loadDoctorData = useCallback(async () => {
    try {
      const data = await fetchDoctorDashboard();
      if (data?.doctor) {
        setDoctorProfile(data.doctor);
        setDoctorId(data.doctor._id);
        setSchedule({ ...DEFAULT_SCHEDULE, ...(data.doctor.schedule || {}) });
      }
    } catch (err) {
      console.log("Doctor dashboard error:", err);
      if (err?.status === 401) {
        Alert.alert(
          "انتهت الجلسة",
          "يرجى تسجيل الدخول مرة أخرى.",
          [{ text: "تسجيل الدخول", onPress: redirectToLogin }]
        );
      } else if (err?.status === 403) {
        Alert.alert("تنبيه", err?.payload?.message || err?.message || "لا تملك صلاحية الوصول.");
      }
      // Network / timeout errors: user sees the appointments error from refreshAppointments
    }
  }, [navigation, redirectToLogin]);

  const loadBlockedSlots = useCallback(() => {
    let active = true;
    if (!doctorId) {
      setBlockedSlots({});
      return () => {
        active = false;
      };
    }
    fetchDoctorBlockedSlots(doctorId)
      .then((data) => {
        if (!active) return;
        setBlockedSlots(data.blockedSlots || {});
      })
      .catch((err) => {
        console.log("Blocked slots error:", err);
        if (active) setBlockedSlots({});
      });
    return () => {
      active = false;
    };
  }, [doctorId]);

  const handleManualCreate = async () => {
    if (manualLoading) return;
    const requiredFields = [
      manualForm.patientName,
      manualForm.patientPhone,
      manualForm.appointmentDate,
      manualForm.appointmentTime,
    ];
    if (requiredFields.some((v) => !v || !String(v).trim())) {
      Alert.alert("مطلوب", "أدخل اسم المراجع، رقم الهاتف، التاريخ، والوقت");
      return;
    }

    setManualLoading(true);
    try {
      const { appointment, tempPassword } = await createDoctorAppointment({
        ...manualForm,
        status: "confirmed",
      });
      setAppointments((prev) => [appointment, ...prev]);
      loadBlockedSlots();
      Alert.alert(
        "تم الحجز",
        tempPassword
          ? `تم إنشاء حساب للمراجع. كلمة المرور المؤقتة: ${tempPassword}`
          : "تم إضافة الحجز للمراجع."
      );
      setManualModalVisible(false);
      resetManualForm();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        Alert.alert("موعد محجوز", err.message || "اختر وقتاً آخر");
      } else {
        Alert.alert("خطأ", err.message || "تعذّر إنشاء الحجز اليدوي");
      }
    } finally {
      setManualLoading(false);
    }
  };

  const refreshAppointments = useCallback(async (silent = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (!silent) setLoading(true);
    try {
      const [data, centersPayload] = await Promise.all([
        fetchDoctorAppointments(),
        fetchMyDoctorCenters().catch(() => ({ centers: [] })),
      ]);

      const regularAppointments = Array.isArray(data?.appointments)
        ? data.appointments.map((item) => ({ ...item, bookingSource: "appointment" }))
        : [];

      const assignedCenters = Array.isArray(centersPayload?.centers)
        ? centersPayload.centers
        : [];

      let centerAppointments = [];
      if (assignedCenters.length) {
        const responses = await Promise.all(
          assignedCenters.map(async (center) => {
            const centerId = String(center?.medicalCenterId || "").trim();
            if (!centerId) return [];
            try {
              const result = await fetchDoctorCenterBookings(centerId);
              const bookings = Array.isArray(result?.bookings) ? result.bookings : [];
              return bookings.map((booking) => ({
                ...booking,
                bookingSource: "center",
                medicalCenterId: centerId,
                centerName: booking?.centerName || center?.name || "",
              }));
            } catch (centerErr) {
              console.log("Center bookings fetch error:", centerErr);
              return [];
            }
          })
        );
        centerAppointments = responses.flat();
      }

      setAppointments([...regularAppointments, ...centerAppointments]);
    } catch (err) {
      console.log("Provider appointments error:", err);
      if (err?.status === 401) {
        Alert.alert(
          "انتهت الجلسة",
          "يرجى تسجيل الدخول مرة أخرى.",
          [{ text: "تسجيل الدخول", onPress: redirectToLogin }]
        );
      } else if (err?.status === 403) {
        Alert.alert("تنبيه", err?.payload?.message || err?.message || "لا تملك صلاحية الوصول.");
      } else {
        Alert.alert("خطأ", err.message || "تعذّر تحميل الحجوزات");
      }
    } finally {
      fetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  }, [navigation, redirectToLogin]);

  useFocusEffect(
    useCallback(() => {
      refreshAppointments();
      loadDoctorData();
      const interval = setInterval(() => refreshAppointments(true), 15000);

      // Safety net: if loading is still true after 35s, force it off so the
      // user is never stuck on a blank spinner indefinitely.
      const safetyTimer = setTimeout(() => {
        setLoading((prev) => {
          if (prev) {
            console.warn("[ProviderAppointments] Safety timeout: forcing loading=false");
            return false;
          }
          return prev;
        });
      }, 35000);

      return () => {
        clearInterval(interval);
        clearTimeout(safetyTimer);
      };
    }, [refreshAppointments, loadDoctorData])
  );

  useEffect(() => loadBlockedSlots(), [loadBlockedSlots]);

  useEffect(() => {
    const shouldOpenManual = Boolean(route?.params?.openManualBooking);
    if (!shouldOpenManual) return;

    const requestId = String(route?.params?.requestId || "").trim();
    if (requestId && consumedManualRequestRef.current === requestId) {
      return;
    }

    const patientId = String(route?.params?.patientId || "").trim();
    const patientName = String(route?.params?.patientName || "").trim();
    const patientPhone = String(route?.params?.patientPhone || "").trim();

    setManualForm((prev) => ({
      ...prev,
      patientId,
      patientName,
      patientPhone,
      notes: "",
    }));
    setManualModalVisible(true);

    if (requestId) {
      consumedManualRequestRef.current = requestId;
    }

    navigation.setParams?.({
      openManualBooking: undefined,
      requestId: undefined,
      patientId: undefined,
      patientName: undefined,
      patientPhone: undefined,
    });
  }, [navigation, route?.params]);

  // Camera permission is requested lazily when user opens the QR scanner
  // (no auto-request on mount to avoid render loops on some devices)

  useEffect(() => {
    if (!manualModalVisible) return;
    if (selectedDateIndex === null && availableDates.length) {
      const first = availableDates[0];
      setSelectedDateIndex(0);
      updateManualForm("appointmentDate", `${first.day}، ${first.displayDate}`);
      updateManualForm("appointmentDateIso", first.iso);
      setSelectedTimeIndex(null);
    }
  }, [manualModalVisible, availableDates, selectedDateIndex]);

  useEffect(() => {
    if (!manualModalVisible) return;
    if (selectedDateIndex === null) return;
    if (!filteredTimeSlotOptions.length) {
      setSelectedTimeIndex(null);
      updateManualForm("appointmentTime", "");
      updateManualForm("appointmentTimeValue", "");
      return;
    }
    if (selectedTimeIndex === null || selectedTimeIndex >= filteredTimeSlotOptions.length) {
      setSelectedTimeIndex(0);
      const slot = filteredTimeSlotOptions[0];
      updateManualForm("appointmentTime", slot.label);
      updateManualForm("appointmentTimeValue", slot.value);
    }
  }, [manualModalVisible, selectedDateIndex, filteredTimeSlotOptions, selectedTimeIndex]);

  useEffect(() => {
    if (!rescheduleModalVisible) return;
    if (rescheduleDateIndex === null && availableDates.length) {
      const currentIso = rescheduleTarget?.appointmentDateIso;
      const foundIndex =
        typeof currentIso === "string"
          ? availableDates.findIndex((date) => date.iso === currentIso)
          : -1;
      setRescheduleDateIndex(foundIndex >= 0 ? foundIndex : 0);
      setRescheduleTimeIndex(null);
    }
  }, [rescheduleModalVisible, availableDates, rescheduleDateIndex, rescheduleTarget]);

  useEffect(() => {
    if (!rescheduleModalVisible) return;
    if (rescheduleDateIndex === null) return;
    if (!filteredRescheduleTimeSlotOptions.length) {
      setRescheduleTimeIndex(null);
      return;
    }
    if (
      rescheduleTimeIndex === null ||
      rescheduleTimeIndex >= filteredRescheduleTimeSlotOptions.length
    ) {
      const currentTime = rescheduleTarget?.appointmentTimeValue;
      const foundIndex =
        typeof currentTime === "string"
          ? filteredRescheduleTimeSlotOptions.findIndex((slot) => slot.value === currentTime)
          : -1;
      setRescheduleTimeIndex(foundIndex >= 0 ? foundIndex : 0);
    }
  }, [
    rescheduleModalVisible,
    rescheduleDateIndex,
    filteredRescheduleTimeSlotOptions,
    rescheduleTimeIndex,
    rescheduleTarget,
  ]);

  const handleAccept = async (id) => {
    if (actionLoading[id]) return;
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const target = appointments.find((item) => item._id === id);
      const isCenterBooking = target?.bookingSource === "center";
      let appointment;

      if (isCenterBooking) {
        const centerId = String(target?.medicalCenterId || "").trim();
        if (!centerId) {
          throw new Error("تعذّر تحديد المركز لهذا الحجز");
        }
        const { booking } = await acceptDoctorCenterBooking(centerId, id);
        appointment = {
          ...(booking || target),
          bookingSource: "center",
          medicalCenterId: centerId,
          centerName: target?.centerName || booking?.centerName || "",
        };
      } else {
        const response = await acceptDoctorAppointment(id);
        appointment = {
          ...(response?.appointment || target),
          bookingSource: "appointment",
        };
      }

      setAppointments((prev) =>
        prev.map((item) => (item._id === id ? appointment : item))
      );
    } catch (err) {
      Alert.alert("خطأ", err.message || "تعذّر تأكيد الموعد");
      console.log("Accept error:", err);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleCancel = async (id) => {
    if (actionLoading[id]) return;
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const target = appointments.find((item) => item._id === id);
      const isCenterBooking = target?.bookingSource === "center";
      let appointment;

      if (isCenterBooking) {
        const centerId = String(target?.medicalCenterId || "").trim();
        if (!centerId) {
          throw new Error("تعذّر تحديد المركز لهذا الحجز");
        }
        const { booking } = await cancelDoctorCenterBooking(centerId, id);
        appointment = {
          ...(booking || target),
          bookingSource: "center",
          medicalCenterId: centerId,
          centerName: target?.centerName || booking?.centerName || "",
        };
      } else {
        const response = await cancelDoctorAppointment(id);
        appointment = {
          ...(response?.appointment || target),
          bookingSource: "appointment",
        };
      }

      setAppointments((prev) =>
        prev.map((item) => (item._id === id ? appointment : item))
      );
      setRecentCancelled({ appointment, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    } catch (err) {
      Alert.alert("خطأ", err.message || "تعذّر إلغاء الموعد");
      console.log("Cancel error:", err);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleComplete = async (id) => {
    if (actionLoading[id]) return;
    const target = appointments.find((item) => item._id === id);
    if (target?.bookingSource === "center") {
      Alert.alert("تنبيه", "إكمال حجز المركز غير مدعوم من هذه الشاشة حالياً.");
      return;
    }
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const { appointment } = await completeDoctorAppointment(id);
      setAppointments((prev) =>
        prev.map((item) => (item._id === id ? appointment : item))
      );
      Alert.alert("تم الإكمال", "تم إكمال الموعد وسيتم الاحتفاظ به في الأرشيف.");
    } catch (err) {
      Alert.alert("خطأ", err.message || "تعذّر إكمال الموعد");
      console.log("Complete error:", err);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // ─── Assign Employee handlers ──────────────────────────────
  const openAssignModal = async (appointment) => {
    setAssignTarget(appointment);
    setAssignModalVisible(true);
    setEmployeeListLoading(true);
    try {
      const res = await fetchSecretaries();
      const list = Array.isArray(res?.secretaries) ? res.secretaries : [];
      setEmployeeList(list.filter((e) => e.isActive !== false));
    } catch (_e) {
      setEmployeeList([]);
      Alert.alert("خطأ", "تعذّر تحميل قائمة الموظفين");
    } finally {
      setEmployeeListLoading(false);
    }
  };

  const handleAssignEmployee = async (secretaryId) => {
    if (!assignTarget || assignLoading) return;
    setAssignLoading(true);
    try {
      const { appointment } = await assignEmployeeToAppointment(assignTarget._id, secretaryId);
      setAppointments((prev) =>
        prev.map((item) => (item._id === assignTarget._id ? { ...item, ...appointment } : item))
      );
      Alert.alert("نجاح", "تم تعيين الموظف بنجاح");
      setAssignModalVisible(false);
      setAssignTarget(null);
    } catch (err) {
      Alert.alert("خطأ", err?.message || "تعذّر تعيين الموظف");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAcceptAllToday = () => {
    if (bulkActionLoading.acceptAll) return;
    const targets = todayPendingAppointments.filter((appointment) => !actionLoading[appointment._id]);
    if (!targets.length) {
      Alert.alert("تنبيه", "لا توجد حجوزات معلّقة لليوم.");
      return;
    }

    Alert.alert(
      "قبول جميع الحجوزات",
      `سيتم قبول ${targets.length} من حجوزات اليوم. هل تريد المتابعة؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "متابعة",
          onPress: async () => {
            setBulkActionLoading((prev) => ({ ...prev, acceptAll: true }));
            const updatedById = {};
            let success = 0;
            let failed = 0;

            for (const appointment of targets) {
              const id = appointment._id;
              const isCenterBooking = appointment?.bookingSource === "center";
              setActionLoading((prev) => ({ ...prev, [id]: true }));
              try {
                let updated;
                if (isCenterBooking) {
                  const centerId = String(appointment?.medicalCenterId || "").trim();
                  if (!centerId) {
                    throw new Error("تعذّر تحديد المركز لهذا الحجز");
                  }
                  const { booking } = await acceptDoctorCenterBooking(centerId, id);
                  updated = {
                    ...(booking || appointment),
                    bookingSource: "center",
                    medicalCenterId: centerId,
                    centerName: appointment?.centerName || booking?.centerName || "",
                  };
                } else {
                  const response = await acceptDoctorAppointment(id);
                  updated = {
                    ...(response?.appointment || appointment),
                    bookingSource: "appointment",
                  };
                }
                updatedById[id] = updated;
                success += 1;
              } catch (err) {
                failed += 1;
              } finally {
                setActionLoading((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
              }
            }

            if (success > 0) {
              setAppointments((prev) =>
                prev.map((item) => (updatedById[item._id] ? updatedById[item._id] : item))
              );
              if (failed === 0) {
                Alert.alert("تم", "تم إكمال جميع حجوزات اليوم وسيتم الاحتفاظ بها في الأرشيف.");
              }
            }

            if (failed > 0) {
              Alert.alert("تنبيه", `تم قبول ${success} حجز وتعذّر ${failed} حجز.`);
            }

            setBulkActionLoading((prev) => ({ ...prev, acceptAll: false }));
          },
        },
      ]
    );
  };

  const handleCompleteAllToday = () => {
    if (bulkActionLoading.completeAll) return;
    const targets = todayConfirmedAppointments.filter(
      (appointment) =>
        !actionLoading[appointment._id] && appointment?.bookingSource !== "center"
    );
    if (!targets.length) {
      Alert.alert("تنبيه", "لا توجد حجوزات مؤكدة لليوم.");
      return;
    }

    Alert.alert(
      "تأكيد جميع الحجوزات",
      `سيتم إكمال ${targets.length} من حجوزات اليوم المؤكدة. هل تريد المتابعة؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "متابعة",
          onPress: async () => {
            setBulkActionLoading((prev) => ({ ...prev, completeAll: true }));
            const updatedById = {};
            let success = 0;
            let failed = 0;

            for (const appointment of targets) {
              const id = appointment._id;
              setActionLoading((prev) => ({ ...prev, [id]: true }));
              try {
                const { appointment: updated } = await completeDoctorAppointment(id);
                updatedById[id] = updated;
                success += 1;
              } catch (err) {
                failed += 1;
              } finally {
                setActionLoading((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
              }
            }

            if (success > 0) {
              setAppointments((prev) =>
                prev.map((item) => (updatedById[item._id] ? updatedById[item._id] : item))
              );
            }

            if (failed > 0) {
              Alert.alert("تنبيه", `تم إكمال ${success} حجز وتعذّر ${failed} حجز.`);
            }

            setBulkActionLoading((prev) => ({ ...prev, completeAll: false }));
          },
        },
      ]
    );
  };

  const openRescheduleModal = (appointment) => {
    if (!appointment?._id) return;
    if (appointment?.bookingSource === "center") {
      Alert.alert("تنبيه", "تأجيل حجز المركز غير مدعوم من هذه الشاشة حالياً.");
      return;
    }
    setRescheduleTarget(appointment);
    setRescheduleDateIndex(null);
    setRescheduleTimeIndex(null);
    setRescheduleModalVisible(true);
  };

  const closeRescheduleModal = () => {
    setRescheduleModalVisible(false);
    setRescheduleTarget(null);
    setRescheduleDateIndex(null);
    setRescheduleTimeIndex(null);
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget?._id || rescheduleLoading) return;
    const targetId = rescheduleTarget._id;
    if (rescheduleDateIndex === null || rescheduleTimeIndex === null) {
      Alert.alert("تنبيه", "يرجى اختيار اليوم والوقت الجديدين");
      return;
    }

    const dateObj = availableDates[rescheduleDateIndex];
    const timeObj = filteredRescheduleTimeSlotOptions[rescheduleTimeIndex];
    if (!dateObj || !timeObj) {
      Alert.alert("تنبيه", "تعذّر قراءة الموعد الجديد");
      return;
    }

    const payload = {
      appointmentDate: `${dateObj.day}، ${dateObj.displayDate}`,
      appointmentDateIso: dateObj.iso,
      appointmentTime: timeObj.label,
      appointmentTimeValue: timeObj.value,
    };

    setRescheduleLoading(true);
    setActionLoading((prev) => ({ ...prev, [targetId]: true }));
    try {
      const { appointment } = await rescheduleDoctorAppointment(targetId, payload);
      if (appointment?.appointmentDateIso && appointment?.appointmentTimeValue) {
        markSlotBlocked(appointment.appointmentDateIso, appointment.appointmentTimeValue);
      }
      setAppointments((prev) =>
        prev.map((item) => (item._id === targetId ? appointment : item))
      );
      Alert.alert("تم", "تم تأجيل الموعد وإشعار المريض بالموعد الجديد.");
      setRescheduleModalVisible(false);
      setRescheduleTarget(null);
      setRescheduleDateIndex(null);
      setRescheduleTimeIndex(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        Alert.alert("موعد محجوز", err.message || "اختر وقتاً آخر");
      } else {
        Alert.alert("خطأ", err.message || "تعذّر تأجيل الموعد");
      }
      console.log("Reschedule error:", err);
    } finally {
      setRescheduleLoading(false);
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
    }
  };

  const openBlockOptions = async (appointment) => {
    if (!appointment?.user?._id) {
      Alert.alert("تنبيه", "لا يمكن حظر مراجع بدون حساب مرتبط.");
      return;
    }
    const patientId = appointment.user._id;
    let current = { blockBooking: false };
    try {
      const res = await getBlock(patientId);
      if (res?.block) current = res.block;
    } catch (err) {
      console.log("block fetch error", err);
    }

    const applyBlock = async (changes) => {
      try {
        const next = {
          blockBooking:
            changes.blockBooking !== undefined
              ? changes.blockBooking
              : current.blockBooking,
        };
        await setBlock(patientId, next);
        current = next;
        Alert.alert("تم", "تم تحديث إعدادات الحظر");
      } catch (err) {
        Alert.alert("خطأ", err.message || "تعذّر تعديل الحظر");
      }
    };

    Alert.alert(
      "إعدادات الحظر",
      "اختر نوع الحظر للمراجع",
      [
        {
          text: current.blockBooking ? "رفع حظر الحجز" : "حظر الحجز",
          onPress: () => applyBlock({ blockBooking: !current.blockBooking }),
        },
        { text: "إلغاء", style: "cancel" },
      ]
    );
  };

  const weekStats = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return appointments.reduce(
      (acc, appointment) => {
        if (appointment?.status === "completed") return acc;
        const createdAt = new Date(appointment.createdAt);
        if (isNaN(createdAt.getTime())) return acc;
        if (createdAt >= weekStart && createdAt < weekEnd) {
          acc.total += 1;
          if (appointment.status && typeof acc[appointment.status] === "number") {
            acc[appointment.status] += 1;
          }
        }
        return acc;
      },
      { total: 0, pending: 0, confirmed: 0, cancelled: 0 }
    );
  }, [appointments]);

  const todayAppointmentsCount = useMemo(() => {
    const todayIso = toLocalIso(new Date());
    return activeAppointments.filter((appointment) => toComparableDateIso(appointment) === todayIso)
      .length;
  }, [activeAppointments]);

  useEffect(() => {
    if (!recentCancelled) return;
    const now = Date.now();
    if (recentCancelled.expiresAt <= now) {
      setRecentCancelled(null);
      return;
    }
    const timeout = setTimeout(() => setRecentCancelled(null), recentCancelled.expiresAt - now);
    return () => clearTimeout(timeout);
  }, [recentCancelled]);

  const handleScan = ({ data }) => {
    setScannerVisible(false);
    if (!data) {
      Alert.alert("لم يتم القراءة", "أعد المحاولة");
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (err) {
      parsed = null;
    }

    setScanResult({
      parsed,
      raw: data,
    });
  };

  const findValueDeep = (source, keys) => {
    if (!source || typeof source !== "object") return null;
    const targets = keys.map((k) => String(k).toLowerCase());
    const stack = [source];

    while (stack.length) {
      const current = stack.pop();
      if (!current || typeof current !== "object") continue;

      if (Array.isArray(current)) {
        for (const item of current) stack.push(item);
        continue;
      }

      for (const [key, value] of Object.entries(current)) {
        if (targets.includes(String(key).toLowerCase())) {
          if (value !== undefined && value !== null && String(value).trim() !== "") {
            return value;
          }
        }
        if (value && typeof value === "object") {
          stack.push(value);
        }
      }
    }

    return null;
  };

  const getScanValue = (keys) => {
    if (!scanResult?.parsed) return "-";
    const value = findValueDeep(scanResult.parsed, keys);

    if (value === undefined || value === null) return "-";
    const trimmed = String(value).trim();
    return trimmed === "" ? "-" : trimmed;
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("لا يوجد إذن كاميرا", "فعّل إذن الكاميرا لتمكين المسح");
        return;
      }
      setScannerVisible(true);
      return;
    }
    setScannerVisible(true);
  };

  const handleCardPress = (appointment) => setSelectedAppointment(appointment);

  const openDrawer = useCallback(() => {
    if (typeof navigation?.openDrawer === "function") {
      navigation.openDrawer();
      return;
    }
    const parent = navigation?.getParent?.();
    if (typeof parent?.openDrawer === "function") parent.openDrawer();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>إدارة الحجوزات</Text>
          <Text style={styles.headerSubtitle}>تابع الطلبات اليومية الرسمية</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={openDrawer}
            style={styles.headerIconButton}
          >
            <Feather name="menu" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.scanBar}>
        <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
          <Feather name="camera" size={18} color={colors.surface} />
          <Text style={styles.scanButtonText}>مسح الباركود</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.manualButton}
          onPress={() => setManualModalVisible(true)}
        >
          <Feather name="plus" size={18} color={colors.text} />
          <Text style={styles.manualButtonText}>حجز يدوي</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث عن مريض (اسم/هاتف/رقم الحجز)"
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[
            styles.todayFilterButton,
            todayOnly && styles.todayFilterButtonActive,
          ]}
          onPress={() => setTodayOnly((prev) => !prev)}
          activeOpacity={0.85}
        >
          <Feather
            name="calendar"
            size={16}
            color={todayOnly ? colors.background : colors.primary}
          />
          <Text
            style={[
              styles.todayFilterText,
              todayOnly && styles.todayFilterTextActive,
            ]}
          >
            حجوزات اليوم
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.bulkActionButton,
            styles.bulkAcceptButton,
            (bulkActionLoading.acceptAll || todayPendingAppointments.length === 0) &&
              styles.bulkActionButtonDisabled,
          ]}
          onPress={handleAcceptAllToday}
          disabled={bulkActionLoading.acceptAll || todayPendingAppointments.length === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.bulkActionText}>
            {bulkActionLoading.acceptAll ? "جارٍ القبول..." : "قبول جميع الحجوزات"}
          </Text>
        </TouchableOpacity>

        {showBulkCompleteAllButton ? (
          <TouchableOpacity
            style={[
              styles.bulkActionButton,
              styles.bulkCompleteButton,
              bulkActionLoading.completeAll && styles.bulkActionButtonDisabled,
            ]}
            onPress={handleCompleteAllToday}
            disabled={bulkActionLoading.completeAll}
            activeOpacity={0.85}
          >
            <Text style={styles.bulkActionText}>
              {bulkActionLoading.completeAll ? "جارٍ التأكيد..." : "تأكيد جميع الحجوزات"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {recentCancelled?.appointment && (
          <View style={styles.recentCancelCard}>
            <Text style={styles.recentCancelText}>
              تم إلغاء حجز {recentCancelled.appointment.user?.name} - {recentCancelled.appointment.appointmentDate} {recentCancelled.appointment.appointmentTime}
            </Text>
            <Text style={styles.recentCancelSubtext}>
              تبقى المعلومات متاحة حتى {new Date(recentCancelled.expiresAt).toLocaleString("ar-EG", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        )}

        <View style={styles.statsCard}>
          <View style={styles.statsHeaderRow}>
            <Text style={styles.statsTitle}>إحصائية سريعة</Text>
            <Text style={styles.statsTodayText}>اليوم: {todayAppointmentsCount}</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <Text style={styles.statsLabel}>الكل</Text>
              <Text style={styles.statsValue}>{weekStats.total}</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsLabel}>انتظار</Text>
              <Text style={styles.statsValue}>{weekStats.pending}</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsLabel}>مؤكد</Text>
              <Text style={styles.statsValue}>{weekStats.confirmed}</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsLabel}>ملغي</Text>
              <Text style={styles.statsValue}>{weekStats.cancelled}</Text>
            </View>
          </View>
        </View>

        <View style={styles.listHeader}>
          <View style={styles.listHeaderTextWrap}>
            <Text style={styles.listHeaderTitle}>الحجوزات</Text>
            <Text style={styles.listHeaderSubtitle}>
              المعروض {visibleAppointments.length} من أصل {activeAppointments.length}
            </Text>
          </View>
          <View style={styles.listHeaderBadges}>
            {todayOnly ? <Text style={styles.listHeaderTodayBadge}>اليوم فقط</Text> : null}
            <Text style={styles.listHeaderCount}>{visibleAppointments.length}</Text>
          </View>
        </View>

        {loading && (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        )}

        {!loading && activeAppointments.length === 0 && (
          <Text style={styles.emptyText}>لا توجد حجوزات جديدة.</Text>
        )}

        {!loading && activeAppointments.length > 0 && visibleAppointments.length === 0 && (
          <Text style={styles.emptyText}>لا توجد نتائج مطابقة.</Text>
        )}

        {visibleAppointments.map((appointment) => {
          const isCenterBooking = appointment?.bookingSource === "center";
          const statusColor = {
            confirmed: colors.success,
            pending: colors.warning,
            completed: colors.primary,
            cancelled: colors.danger,
          }[appointment.status] || colors.textMuted;
          const canCancel = ["pending", "confirmed"].includes(appointment.status);
          return (
            <TouchableOpacity
              key={appointment._id}
              style={styles.card}
              onPress={() => handleCardPress(appointment)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.patient}>{appointment.user?.name}</Text>
                <Text
                  style={[
                    styles.statusBadge,
                    { borderColor: statusColor, color: statusColor },
                  ]}
                >
                  {STATUS_LABELS[appointment.status] || appointment.status}
                </Text>
              </View>

              <View style={styles.quickMetaRow}>
                <View style={styles.quickMetaBadge}>
                  <Text style={styles.quickMetaLabel}>رقم الحجز</Text>
                  <Text style={styles.quickMetaValue}>
                    {appointment.doctorQueueNumber ?? appointment.doctorIndex ?? appointment.bookingNumber ?? "-"}
                  </Text>
                </View>
                <View style={styles.quickMetaBadge}>
                  <Text style={styles.quickMetaLabel}>الخدمة</Text>
                  <Text style={styles.quickMetaValue} numberOfLines={1}>
                    {appointment.service?.name || "-"}
                  </Text>
                </View>
              </View>

              <View style={styles.timeRow}>
                <View style={styles.timeItem}>
                  <Feather name="calendar" size={14} color={colors.primary} />
                  <Text style={styles.timeText}>{appointment.appointmentDate || "-"}</Text>
                </View>
                <View style={styles.timeItem}>
                  <Feather name="clock" size={14} color={colors.primary} />
                  <Text style={styles.timeText}>{appointment.appointmentTime || "-"}</Text>
                </View>
              </View>

              {appointment.notes ? (
                <View style={styles.notesRow}>
                  <Text style={styles.notesLabel}>ملاحظات</Text>
                  <Text style={styles.notesText}>{appointment.notes}</Text>
                </View>
              ) : null}

              {/* عرض اسم السكرتير اللي نفّذ الإجراء */}
              {appointment.actionBySecretary?.secretaryName ? (
                <View style={[styles.notesRow, { backgroundColor: colors.primary + "08" }]}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                    <Feather name="user-check" size={13} color={colors.primary} />
                    <Text style={[styles.notesLabel, { color: colors.primary }]}>
                      {appointment.actionBySecretary.action === "accepted" ? "قُبل بواسطة" :
                       appointment.actionBySecretary.action === "created" ? "أُنشئ بواسطة" :
                       appointment.actionBySecretary.action === "completed" ? "أُكمل بواسطة" :
                       appointment.actionBySecretary.action === "rescheduled" ? "أُعيد جدولته بواسطة" :
                       "بواسطة"}
                    </Text>
                  </View>
                  <Text style={[styles.notesText, { color: colors.primary, fontWeight: "600" }]}>
                    {appointment.actionBySecretary.secretaryName}
                  </Text>
                </View>
              ) : null}

              {/* عرض الموظف المُعيّن للعمل على الحالة */}
              {appointment.assignedEmployee?.secretaryName ? (
                <View style={[styles.notesRow, { backgroundColor: "#4CAF5010" }]}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                    <Feather name="user" size={13} color="#4CAF50" />
                    <Text style={[styles.notesLabel, { color: "#4CAF50" }]}>العامل على الحالة</Text>
                  </View>
                  <Text style={[styles.notesText, { color: "#4CAF50", fontWeight: "600" }]}>
                    {appointment.assignedEmployee.secretaryName}
                  </Text>
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                {appointment.status === "pending" && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    disabled={Boolean(actionLoading[appointment._id])}
                    onPress={() => handleAccept(appointment._id)}
                  >
                    <Text style={styles.actionText}>قبول</Text>
                  </TouchableOpacity>
                )}
                {appointment.status === "confirmed" && !isCenterBooking && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.completeButton]}
                    disabled={Boolean(actionLoading[appointment._id])}
                    onPress={() => handleComplete(appointment._id)}
                  >
                    <Text style={styles.actionText}>تم الإكمال</Text>
                  </TouchableOpacity>
                )}
                {canCancel && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    disabled={Boolean(actionLoading[appointment._id])}
                    onPress={() => handleCancel(appointment._id)}
                  >
                    <Text style={styles.actionText}>إلغاء</Text>
                  </TouchableOpacity>
                )}
                {!isCenterBooking && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rescheduleButton]}
                    disabled={Boolean(actionLoading[appointment._id])}
                    onPress={() => openRescheduleModal(appointment)}
                  >
                    <Text style={styles.actionText}>تأجيل الموعد</Text>
                  </TouchableOpacity>
                )}
                {/* تعيين موظف للعمل على الحالة - فقط للمؤكدة أو المكتملة */}
                {(appointment.status === "confirmed" || appointment.status === "completed") && !isCenterBooking && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: "#4CAF50" }]}
                    onPress={() => openAssignModal(appointment)}
                  >
                    <Feather name="user-plus" size={14} color="#fff" style={{ marginLeft: 4 }} />
                    <Text style={styles.actionText}>تعيين موظف</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal
        visible={manualModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManualModalVisible(false)}
      >
        <View style={styles.scannerOverlay}>
          <View style={[styles.scannerCard, styles.manualModalCard]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
            >
              <View style={styles.manualHeader}>
                <Text style={styles.modalTitle}>إنشاء حجز يدوي</Text>
                <TouchableOpacity
                  onPress={() => {
                    resetManualForm();
                    setManualModalVisible(false);
                  }}
                >
                  <Feather name="x" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>اسم المراجع</Text>
                <TextInput
                  style={styles.input}
                  placeholder="اكتب اسم المراجع"
                  value={manualForm.patientName}
                  onChangeText={(v) => updateManualForm("patientName", v)}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>رقم الهاتف</Text>
                <TextInput
                  style={styles.input}
                  placeholder="07xxxxxxxx"
                  keyboardType="phone-pad"
                  value={manualForm.patientPhone}
                  onChangeText={(v) => updateManualForm("patientPhone", v)}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>اليوم</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {availableDates.map((date, index) => {
                    const isActive = index === selectedDateIndex;
                    return (
                      <TouchableOpacity
                        key={date.key}
                        style={[styles.chip, isActive && styles.chipActive]}
                        onPress={() => {
                          setSelectedDateIndex(index);
                          updateManualForm("appointmentDate", `${date.day}، ${date.displayDate}`);
                          updateManualForm("appointmentDateIso", date.iso);
                          setSelectedTimeIndex(null);
                          updateManualForm("appointmentTime", "");
                          updateManualForm("appointmentTimeValue", "");
                        }}
                      >
                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                          {date.day} {date.displayDate}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الوقت</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {filteredTimeSlotOptions.map((slot, index) => {
                    const isActive = index === selectedTimeIndex;
                    return (
                      <TouchableOpacity
                        key={`${slot.value}-${index}`}
                        style={[styles.chip, isActive && styles.chipActive]}
                        onPress={() => {
                          setSelectedTimeIndex(index);
                          updateManualForm("appointmentTime", slot.label);
                          updateManualForm("appointmentTimeValue", slot.value);
                        }}
                      >
                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                          {slot.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {!filteredTimeSlotOptions.length && (
                    <Text style={styles.emptySlotsText}>لا توجد أوقات متاحة لهذا اليوم</Text>
                  )}
                </ScrollView>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ملاحظات</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="ملاحظات (اختياري)"
                  multiline
                  value={manualForm.notes}
                  onChangeText={(v) => updateManualForm("notes", v)}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, manualLoading && styles.primaryButtonDisabled]}
                onPress={handleManualCreate}
                disabled={manualLoading}
              >
                {manualLoading ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.primaryButtonText}>تأكيد الحجز</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButtonModal}
                onPress={() => {
                  resetManualForm();
                  setManualModalVisible(false);
                }}
              >
                <Text style={styles.secondaryButtonTextModal}>إلغاء</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={rescheduleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeRescheduleModal}
      >
        <View style={styles.scannerOverlay}>
          <View style={[styles.scannerCard, styles.manualModalCard, styles.rescheduleModalCard]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.rescheduleScrollContent}
            >
              <View style={styles.rescheduleHeader}>
                <View style={styles.rescheduleHeaderTextWrap}>
                  <Text style={styles.rescheduleTitle}>تأجيل الموعد</Text>
                  <Text style={styles.reschedulePatientName}>
                    {rescheduleTarget?.user?.name || "المراجع"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.rescheduleCloseButton}
                  onPress={closeRescheduleModal}
                  disabled={rescheduleLoading}
                >
                  <Feather name="x" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.rescheduleSummaryCard}>
                <View style={styles.rescheduleSummaryRow}>
                  <Text style={styles.rescheduleSummaryLabel}>الموعد الحالي</Text>
                  <Text style={styles.rescheduleSummaryValue}>
                    {rescheduleTarget?.appointmentDate || "-"} {rescheduleTarget?.appointmentTime || ""}
                  </Text>
                </View>
                <View style={styles.rescheduleSummaryDivider} />
                <View style={styles.rescheduleSummaryRow}>
                  <Text style={styles.rescheduleSummaryLabel}>الموعد الجديد</Text>
                  <Text style={[styles.rescheduleSummaryValue, styles.rescheduleSummaryValuePrimary]}>
                    {proposedRescheduleLabel}
                  </Text>
                </View>
              </View>

              <View style={styles.rescheduleSection}>
                <Text style={styles.rescheduleSectionTitle}>اختر اليوم الجديد</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rescheduleChipRow}
                >
                  {availableDates.map((date, index) => {
                    const isActive = index === rescheduleDateIndex;
                    return (
                      <TouchableOpacity
                        key={`res-${date.key}`}
                        style={[styles.rescheduleChip, isActive && styles.rescheduleChipActive]}
                        onPress={() => {
                          setRescheduleDateIndex(index);
                          setRescheduleTimeIndex(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.rescheduleChipTitle,
                            isActive && styles.rescheduleChipTitleActive,
                          ]}
                        >
                          {date.day}
                        </Text>
                        <Text
                          style={[
                            styles.rescheduleChipSubtitle,
                            isActive && styles.rescheduleChipSubtitleActive,
                          ]}
                        >
                          {date.day} {date.displayDate}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.rescheduleSection}>
                <Text style={styles.rescheduleSectionTitle}>اختر الوقت الجديد</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rescheduleChipRow}
                >
                  {filteredRescheduleTimeSlotOptions.map((slot, index) => {
                    const isActive = index === rescheduleTimeIndex;
                    return (
                      <TouchableOpacity
                        key={`res-time-${slot.value}-${index}`}
                        style={[styles.rescheduleTimeChip, isActive && styles.rescheduleTimeChipActive]}
                        onPress={() => setRescheduleTimeIndex(index)}
                      >
                        <Text
                          style={[
                            styles.rescheduleTimeChipText,
                            isActive && styles.rescheduleTimeChipTextActive,
                          ]}
                        >
                          {slot.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {!filteredRescheduleTimeSlotOptions.length && (
                    <View style={styles.rescheduleEmptyState}>
                      <Feather name="alert-circle" size={16} color={colors.danger} />
                      <Text style={styles.emptySlotsText}>لا توجد أوقات متاحة لهذا اليوم</Text>
                    </View>
                  )}
                </ScrollView>
              </View>

              <View style={styles.rescheduleFooter}>
                <TouchableOpacity
                  style={[styles.rescheduleSecondaryButton]}
                  onPress={closeRescheduleModal}
                  disabled={rescheduleLoading}
                >
                  <Text style={styles.rescheduleSecondaryButtonText}>إلغاء</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.reschedulePrimaryButton, rescheduleLoading && styles.primaryButtonDisabled]}
                  onPress={handleReschedule}
                  disabled={rescheduleLoading}
                >
                  {rescheduleLoading ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <>
                      <Feather name="clock" size={15} color={colors.surface} />
                      <Text style={styles.reschedulePrimaryButtonText}>تأكيد التأجيل</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedAppointment)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAppointment(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تفاصيل الحجز</Text>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>المريض</Text>
              <Text style={styles.modalValue}>{selectedAppointment?.user?.name || "-"}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>رقم المريض</Text>
              <Text style={styles.modalValue}>
                {selectedAppointment?.user?.phone || "غير متوفر"}
              </Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>العمر</Text>
              <Text style={styles.modalValue}>
                {selectedAppointment?.user?.age ? `${selectedAppointment.user.age} سنة` : "غير محدد"}
              </Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>البريد</Text>
              <Text style={styles.modalValue}>
                {selectedAppointment?.user?.email || "غير متوفر"}
              </Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>التاريخ</Text>
              <Text style={styles.modalValue}>{selectedAppointment?.appointmentDate}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>الوقت</Text>
              <Text style={styles.modalValue}>{selectedAppointment?.appointmentTime}</Text>
            </View>
            {selectedAppointment?.notes ? (
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>ملاحظات</Text>
                <Text style={styles.modalValue}>{selectedAppointment.notes}</Text>
              </View>
            ) : null}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.whatsappButton]}
                onPress={() => openWhatsApp(selectedAppointment?.user?.phone)}
              >
                <Text style={styles.modalActionText}>واتساب</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.callButton]}
                onPress={() => callPatient(selectedAppointment?.user?.phone)}
              >
                <Text style={styles.modalActionText}>اتصال</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.blockModalButton]}
                onPress={() => openBlockOptions(selectedAppointment)}
              >
                <Text style={styles.modalActionText}>حظر</Text>
              </TouchableOpacity>
            </View>
            <Pressable style={styles.modalClose} onPress={() => setSelectedAppointment(null)}>
              <Text style={styles.modalCloseText}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={scannerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerCard}>
            <Text style={styles.modalTitle}>مسح باركود المراجع</Text>
            {!permission?.granted ? (
              <Text style={styles.errorText}>يجب السماح بالوصول للكاميرا</Text>
            ) : (
              <View style={styles.scannerBox}>
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  barcodeScannerSettings={{ barcodeTypes: ["qr", "pdf417", "ean13", "code128"] }}
                  onBarcodeScanned={handleScan}
                />
              </View>
            )}
            <Pressable style={styles.modalClose} onPress={() => setScannerVisible(false)}>
              <Text style={styles.modalCloseText}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(scanResult)}
        transparent
        animationType="fade"
        onRequestClose={() => setScanResult(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>بيانات الباركود</Text>

            {scanResult?.parsed ? (
              <View style={styles.scanDetails}>
                <View style={styles.scanRow}>
                  <Text style={styles.scanKey}>الاسم</Text>
                  <Text style={styles.scanValue}>
                    {getScanValue([
                      "name",
                      "patientName",
                      "userName",
                      "fullName",
                    ])}
                  </Text>
                </View>
                <View style={styles.scanRow}>
                  <Text style={styles.scanKey}>رقم الحجز</Text>
                  <Text style={styles.scanValue}>
                    {getScanValue([
                      "bookingNumber",
                      "booking_number",
                      "bookingNo",
                      "booking_no",
                      "id",
                    ])}
                  </Text>
                </View>
                <View style={styles.scanRow}>
                  <Text style={styles.scanKey}>العمر</Text>
                  <Text style={styles.scanValue}>
                    {getScanValue(["age", "patientAge", "userAge", "Age", "patient_age"])}
                  </Text>
                </View>
                <View style={styles.scanRow}>
                  <Text style={styles.scanKey}>الرقم</Text>
                  <Text style={styles.scanValue}>
                    {getScanValue([
                      "phone",
                      "patientPhone",
                      "userPhone",
                      "mobile",
                      "contact",
                      "phoneNumber",
                      "phone_number",
                      "mobileNumber",
                      "mobile_number",
                      "contactNumber",
                      "contact_number",
                    ])}
                  </Text>
                </View>
                <View style={styles.scanRow}>
                  <Text style={styles.scanKey}>وقت الحجز</Text>
                  <Text style={styles.scanValue}>
                    {getScanValue(["appointmentTime", "time", "slot"])}
                  </Text>
                </View>
                <View style={styles.scanRow}>
                  <Text style={styles.scanKey}>تاريخ الحجز</Text>
                  <Text style={styles.scanValue}>
                    {getScanValue(["appointmentDate", "date", "day"])}
                  </Text>
                </View>

                <View style={styles.scanRow}>
                  <Text style={styles.scanKey}>الخدمة</Text>
                  <Text style={styles.scanValue}>
                    {(() => {
                      const direct = getScanValue(["serviceName", "service_name", "packageName", "package_name"]);
                      if (direct && direct !== "-") return direct;
                      const nested = scanResult?.parsed?.service?.name;
                      return typeof nested === "string" && nested.trim() ? nested.trim() : "-";
                    })()}
                  </Text>
                </View>

                <View style={styles.scanRow}>
                  <Text style={styles.scanKey}>المركز</Text>
                  <Text style={styles.scanValue}>
                    {(() => {
                      const direct = getScanValue([
                        "centerName",
                        "medicalCenterName",
                        "clinicName",
                        "center",
                        "medicalCenter",
                      ]);
                      if (direct && direct !== "-") return direct;
                      const nested = scanResult?.parsed?.center?.name;
                      return typeof nested === "string" && nested.trim() ? nested.trim() : "-";
                    })()}
                  </Text>
                </View>

                <View style={styles.scanRow}>
                  <Text style={styles.scanKey}>مصدر الحجز</Text>
                  <Text style={styles.scanValue}>
                    {(() => {
                      const sourceRaw = getScanValue(["bookingSource", "source", "type"]);
                      const source = String(sourceRaw || "").toLowerCase();
                      if (source === "center" || source === "center_booking") return "من مركز";
                      if (source === "general" || source === "appointment") return "عام";

                      const centerName = getScanValue([
                        "centerName",
                        "medicalCenterName",
                        "clinicName",
                      ]);
                      if (centerName && centerName !== "-") return "من مركز";
                      return "-";
                    })()}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.modalValue}>{scanResult?.raw}</Text>
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.callButton]}
                onPress={() => {
                  setScanResult(null);
                  setScannerVisible(true);
                }}
              >
                <Text style={styles.modalActionText}>مسح جديد</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.whatsappButton]}
                onPress={() => setScanResult(null)}
              >
                <Text style={styles.modalActionText}>إغلاق</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* مودال تعيين موظف للعمل على الحالة */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setAssignModalVisible(false); setAssignTarget(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "70%" }]}>  
            <Text style={styles.modalTitle}>تعيين موظف للحالة</Text>
            {assignTarget && (
              <Text style={{ textAlign: "center", color: "#666", marginBottom: 8 }}>
                حجز رقم {assignTarget.bookingNumber} - {assignTarget.patientName || assignTarget.userName}
              </Text>
            )}

            {employeeListLoading ? (
              <ActivityIndicator size="large" color="#2196F3" style={{ marginVertical: 24 }} />
            ) : employeeList.length === 0 ? (
              <Text style={{ textAlign: "center", color: "#999", marginVertical: 24 }}>لا يوجد موظفين متاحين</Text>
            ) : (
              <ScrollView style={{ maxHeight: 350 }}>
                {employeeList.map((emp) => {
                  const isCurrentlyAssigned =
                    assignTarget?.assignedEmployee?.secretaryId === emp._id;
                  return (
                    <TouchableOpacity
                      key={emp._id}
                      disabled={assignLoading || isCurrentlyAssigned}
                      onPress={() => handleAssignEmployee(emp._id)}
                      style={{
                        flexDirection: "row-reverse",
                        alignItems: "center",
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: "#eee",
                        backgroundColor: isCurrentlyAssigned ? "#E8F5E9" : "#fff",
                        opacity: assignLoading ? 0.5 : 1,
                      }}
                    >
                      <Feather
                        name={isCurrentlyAssigned ? "check-circle" : "user"}
                        size={20}
                        color={isCurrentlyAssigned ? "#4CAF50" : "#555"}
                        style={{ marginLeft: 10 }}
                      />
                      <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: "#333" }}>
                          {emp.name}
                        </Text>
                        {emp.jobTitle ? (
                          <Text style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                            {emp.jobTitle}
                          </Text>
                        ) : null}
                      </View>
                      {isCurrentlyAssigned && (
                        <Text style={{ fontSize: 11, color: "#4CAF50", marginRight: 8 }}>المعيّن حالياً</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {assignLoading && (
              <ActivityIndicator size="small" color="#2196F3" style={{ marginTop: 10 }} />
            )}

            <TouchableOpacity
              style={[styles.modalClose, { marginTop: 14 }]}
              onPress={() => { setAssignModalVisible(false); setAssignTarget(null); }}
            >
              <Text style={styles.modalCloseText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const createStyles = (colors, isDark) => {
  const primaryTint = colors.surfaceAlt;
  const neutralTint = colors.surfaceAlt;
  const mutedCard = colors.surfaceAlt;
  const recentCancelBg = colors.surfaceAlt;
  const successTint = colors.surfaceAlt;
  const warningTint = colors.surfaceAlt;
  const dangerTint = colors.surfaceAlt;
  const blockTint = colors.surfaceAlt;
  const modalShadow = colors.overlay;

  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headerIconButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 2,
    },
    scanBar: {
      paddingHorizontal: 24,
      paddingBottom: 12,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
    },
    scanButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: 14,
      gap: 8,
    },
    scanButtonText: {
      color: colors.surface,
      fontWeight: "700",
      fontSize: 14,
      flexShrink: 1,
      textAlign: "center",
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 24,
      paddingBottom: 12,
    },
    searchInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      color: colors.text,
    },
    filterBar: {
      paddingHorizontal: 24,
      paddingBottom: 12,
      alignItems: "flex-end",
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      gap: 8,
    },
    todayFilterButton: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: primaryTint,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    todayFilterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    todayFilterText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "700",
      writingDirection: "rtl",
    },
    todayFilterTextActive: {
      color: colors.background,
    },
    bulkActionButton: {
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
    },
    bulkAcceptButton: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    bulkCompleteButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    bulkActionButtonDisabled: {
      opacity: 0.6,
    },
    bulkActionText: {
      color: colors.surface,
      fontSize: 12,
      fontWeight: "700",
      writingDirection: "rtl",
      textAlign: "center",
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    statsCard: {
      backgroundColor: mutedCard,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statsHeaderRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    statsTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    statsTodayText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: "700",
      textAlign: "right",
      writingDirection: "rtl",
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
    },
    statsItem: {
      width: "48%",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 7,
      paddingHorizontal: 8,
    },
    statsLabel: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    statsValue: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
      marginTop: 1,
    },
    listHeader: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    listHeaderTextWrap: {
      gap: 2,
      flex: 1,
      alignItems: "flex-end",
    },
    listHeaderTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.text,
      writingDirection: "rtl",
    },
    listHeaderSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      writingDirection: "rtl",
      textAlign: "right",
    },
    listHeaderBadges: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 8,
      marginRight: 10,
    },
    listHeaderTodayBadge: {
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: primaryTint,
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 10,
      color: colors.primary,
      fontSize: 11,
      fontWeight: "800",
      writingDirection: "rtl",
      textAlign: "center",
    },
    listHeaderCount: {
      minWidth: 28,
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: primaryTint,
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
      textAlign: "center",
    },
    manualButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 16,
    },
    manualButtonText: {
      color: colors.text,
      fontWeight: "700",
    },
    reportButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 16,
      justifyContent: "center",
    },
    reportButtonDisabled: {
      opacity: 0.6,
    },
    reportButtonText: {
      color: colors.surface,
      fontWeight: "600",
    },
    recentCancelCard: {
      backgroundColor: recentCancelBg,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
    },
    recentCancelText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.warning,
    },
    recentCancelSubtext: {
      fontSize: 12,
      color: colors.warning,
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      width: "100%",
    },
    patient: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    statusBadge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      fontSize: 12,
      fontWeight: "700",
      writingDirection: "rtl",
    },
    quickMetaRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 10,
    },
    quickMetaBadge: {
      width: "48%",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: neutralTint,
      paddingVertical: 7,
      paddingHorizontal: 10,
      minHeight: 52,
      justifyContent: "center",
    },
    quickMetaLabel: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    quickMetaValue: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
      marginTop: 2,
    },
    timeRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 10,
    },
    timeItem: {
      flex: 1,
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 10,
      backgroundColor: primaryTint,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    timeText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "700",
      textAlign: "center",
      writingDirection: "rtl",
    },
    notesRow: {
      marginTop: 10,
      borderRadius: 10,
      backgroundColor: neutralTint,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    notesLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 4,
      textAlign: "right",
      writingDirection: "rtl",
    },
    notesText: {
      fontSize: 14,
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    manageRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    manageButton: {
      backgroundColor: primaryTint,
      borderColor: colors.primary,
    },
    actionsRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 16,
      flexWrap: "wrap",
      gap: 8,
    },
    actionButton: {
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderRadius: 12,
      minWidth: 102,
      flexGrow: 1,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "transparent",
    },
    acceptButton: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    cancelButton: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    deleteButton: {
      backgroundColor: dangerTint,
      borderColor: colors.danger,
    },
    deleteButtonText: {
      color: colors.danger,
    },
    rescheduleButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    completeButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    blockButton: {
      backgroundColor: blockTint,
      borderColor: colors.danger,
    },
    contactButtonTextDisabled: {
      color: colors.placeholder,
      fontSize: 14,
      fontWeight: "700",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      padding: 24,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
    },
    manageModalCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    manualModalCard: {
      maxHeight: "85%",
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: modalShadow,
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    rescheduleModalCard: {
      maxHeight: "88%",
      padding: 16,
    },
    rescheduleScrollContent: {
      gap: 14,
      paddingBottom: 10,
    },
    rescheduleHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    rescheduleHeaderTextWrap: {
      flex: 1,
      gap: 4,
    },
    rescheduleTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    reschedulePatientName: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    rescheduleCloseButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: neutralTint,
      marginLeft: 10,
    },
    rescheduleSummaryCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: neutralTint,
      padding: 12,
      gap: 8,
    },
    rescheduleSummaryRow: {
      gap: 6,
    },
    rescheduleSummaryLabel: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    rescheduleSummaryValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "700",
      textAlign: "right",
      writingDirection: "rtl",
    },
    rescheduleSummaryValuePrimary: {
      color: colors.primary,
    },
    rescheduleSummaryDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 2,
    },
    rescheduleSection: {
      gap: 8,
    },
    rescheduleSectionTitle: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "700",
      textAlign: "right",
      writingDirection: "rtl",
    },
    rescheduleChipRow: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 2,
    },
    rescheduleChip: {
      minWidth: 122,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: neutralTint,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    rescheduleChipActive: {
      borderColor: colors.primary,
      backgroundColor: primaryTint,
    },
    rescheduleChipTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
    },
    rescheduleChipTitleActive: {
      color: colors.primary,
    },
    rescheduleChipSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
    },
    rescheduleChipSubtitleActive: {
      color: colors.primary,
      opacity: 0.9,
    },
    rescheduleTimeChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: neutralTint,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    rescheduleTimeChipActive: {
      borderColor: colors.primary,
      backgroundColor: primaryTint,
    },
    rescheduleTimeChipText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "700",
    },
    rescheduleTimeChipTextActive: {
      color: colors.primary,
    },
    rescheduleEmptyState: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: dangerTint,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    rescheduleFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 4,
    },
    rescheduleSecondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: neutralTint,
    },
    rescheduleSecondaryButtonText: {
      color: colors.textMuted,
      fontWeight: "700",
      fontSize: 14,
    },
    reschedulePrimaryButton: {
      flex: 1.6,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    reschedulePrimaryButtonText: {
      color: colors.surface,
      fontWeight: "800",
      fontSize: 15,
    },
    manualHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    manualBody: {
      gap: 12,
      paddingBottom: 12,
    },
    fieldGroup: {
      gap: 6,
      alignItems: "stretch",
    },
    fieldLabel: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
      alignSelf: "flex-end",
      writingDirection: "rtl",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 16,
      color: colors.text,
    },
    modalSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 6,
    },
    modalHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 10,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      backgroundColor: neutralTint,
      color: colors.text,
    },
    manageInput: {
      minHeight: 90,
      textAlignVertical: "top",
    },
    notesInput: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: neutralTint,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: primaryTint,
    },
    chipText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "600",
    },
    chipTextActive: {
      color: colors.primary,
    },
    emptySlotsText: {
      fontSize: 12,
      color: colors.danger,
    },
    modalRow: {
      marginBottom: 12,
    },
    modalLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    modalValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    prescriptionsRow: {
      marginTop: 8,
      paddingVertical: 4,
    },
    prescriptionWrapper: {
      marginRight: 10,
      position: "relative",
    },
    prescriptionImage: {
      width: 90,
      height: 90,
      borderRadius: 10,
    },
    removeBadge: {
      position: "absolute",
      top: -8,
      right: -8,
      backgroundColor: colors.danger,
      borderRadius: 999,
      padding: 6,
    },
    outlineButton: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignSelf: "flex-start",
    },
    outlineButtonText: {
      color: colors.primary,
      fontWeight: "700",
    },
    scanDetails: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      backgroundColor: neutralTint,
    },
    scanRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    scanKey: {
      fontSize: 13,
      color: colors.textMuted,
      marginRight: 8,
    },
    scanValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
      textAlign: "right",
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 4,
    },
    primaryButtonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      color: colors.surface,
      fontWeight: "700",
      fontSize: 16,
    },
    secondaryButtonModal: {
      marginTop: 10,
      alignItems: "center",
      paddingVertical: 10,
    },
    secondaryButtonTextModal: {
      color: colors.text,
      fontWeight: "600",
    },
    modalActionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 8,
    },
    modalCancelButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      marginRight: 8,
    },
    modalCancelText: {
      color: colors.textMuted,
      fontWeight: "700",
    },
    modalSaveButton: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: colors.primary,
      marginLeft: 8,
    },
    modalSaveButtonDisabled: {
      opacity: 0.6,
    },
    modalSaveText: {
      color: colors.surface,
      fontWeight: "700",
    },
    modalActionButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      marginHorizontal: 6,
    },
    modalActionText: {
      color: colors.surface,
      fontSize: 15,
      fontWeight: "700",
    },
    whatsappButton: {
      backgroundColor: colors.success,
    },
    callButton: {
      backgroundColor: colors.primary,
    },
    blockModalButton: {
      backgroundColor: colors.danger,
    },
    modalClose: {
      marginTop: 8,
      alignSelf: "flex-end",
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    modalCloseText: {
      fontSize: 14,
      color: colors.primary,
    },
    scannerOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      padding: 24,
    },
    scannerCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
    },
    scannerBox: {
      height: 280,
      borderRadius: 14,
      overflow: "hidden",
      marginTop: 12,
      backgroundColor: colors.surfaceAlt,
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
      marginTop: 8,
      fontWeight: "600",
    },
    actionText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.surface,
    },
    loader: {
      marginVertical: 20,
    },
    emptyText: {
      textAlign: "center",
      color: colors.textMuted,
      marginTop: 24,
      fontSize: 14,
    },
  });
};
