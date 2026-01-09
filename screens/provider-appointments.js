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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  acceptDoctorAppointment,
  cancelDoctorAppointment,
  deleteDoctorAppointment,
  createDoctorAppointment,
  ApiError,
  fetchDoctorAppointments,
  fetchDoctorDashboard,
  fetchDoctorBlockedSlots,
  getBlock,
  setBlock,
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
      dates.push({
        key: `${dayKey}-${pointer.toISOString()}`,
        day: DAY_LABELS[dayKey] || dayKey,
        displayDate: pointer.toLocaleDateString("ar-EG", { day: "numeric" }),
        iso: pointer.toISOString().split("T")[0],
      });
    }
    pointer.setDate(pointer.getDate() + 1);
  }

  return dates;
};

export default function ProviderAppointmentsScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState({});
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [recentCancelled, setRecentCancelled] = useState(null);
  const [expandedQrId, setExpandedQrId] = useState(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const emptyManualForm = {
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
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [doctorId, setDoctorId] = useState(null);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [blockedSlots, setBlockedSlots] = useState({});
  const [selectedDateIndex, setSelectedDateIndex] = useState(null);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();
  const fetchingRef = useRef(false);

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

  const filteredTimeSlotOptions = useMemo(() => {
    if (!selectedDateIso) return baseTimeSlotOptions;
    const blockedForDate = blockedSlots[selectedDateIso] || [];
    if (!blockedForDate.length) return baseTimeSlotOptions;
    return baseTimeSlotOptions.filter((slot) => !blockedForDate.includes(slot.value));
  }, [baseTimeSlotOptions, blockedSlots, selectedDateIso]);

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

  const chatConsentKey = (appointment) => {
    const id = appointment?.user?._id || appointment?._id;
    return id ? `CHAT_CONSENT_${id}` : null;
  };

  const ensureChatConsent = async (appointment) => {
    const key = chatConsentKey(appointment);
    if (!key) return true;
    try {
      const stored = await AsyncStorage.getItem(key);
      if (stored === "1") return true;
    } catch (err) {
      // ignore and fall through to prompt
    }

    return new Promise((resolve) => {
      Alert.alert(
        "السماح بالمراسلة",
        "هل تريد السماح لهذا المراجع بإرسال رسائل؟",
        [
          { text: "رفض", style: "cancel", onPress: () => resolve(false) },
          {
            text: "سماح",
            onPress: async () => {
              try {
                await AsyncStorage.setItem(key, "1");
              } catch (_) {}
              resolve(true);
            },
          },
        ]
      );
    });
  };

  const openChat = async (appointment) => {
    if (!appointment) return;
    const allowed = await ensureChatConsent(appointment);
    if (!allowed) return;
    setSelectedAppointment(null);
    navigation.navigate("Chat", {
      patientName: appointment.user?.name || "المراجع",
      appointmentId: appointment._id,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      contactNumber: appointment.user?.phone,
      avatarUrl: appointment.user?.avatarUrl,
    });
  };

  const visibleAppointments = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter((appointment) => {
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
  }, [appointments, searchQuery]);

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
    }
  }, []);

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
      if (appointment?.appointmentDateIso && appointment?.appointmentTimeValue) {
        markSlotBlocked(appointment.appointmentDateIso, appointment.appointmentTimeValue);
      }
      setAppointments((prev) => [appointment, ...prev]);
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
      const data = await fetchDoctorAppointments();
      setAppointments(data.appointments || []);
    } catch (err) {
      console.log("Provider appointments error:", err);
      Alert.alert("خطأ", err.message || "تعذّر تحميل الحجوزات");
    } finally {
      fetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshAppointments();
      loadDoctorData();
      const interval = setInterval(() => refreshAppointments(true), 15000);
      return () => clearInterval(interval);
    }, [refreshAppointments, loadDoctorData])
  );

  useEffect(() => loadBlockedSlots(), [loadBlockedSlots]);

  useEffect(() => {
    if (permission === null) {
      requestPermission();
    }
  }, [permission, requestPermission]);

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

  const handleAccept = async (id) => {
    if (actionLoading[id]) return;
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const { appointment } = await acceptDoctorAppointment(id);
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
      const { appointment } = await cancelDoctorAppointment(id);
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

  const handleDelete = async (id) => {
    if (actionLoading[id]) return;
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await deleteDoctorAppointment(id);
      setAppointments((prev) => prev.filter((item) => item._id !== id));
      setSelectedAppointment((prev) => (prev?._id === id ? null : prev));
      Alert.alert("تم", "تم حذف الحجز من النظام.");
    } catch (err) {
      Alert.alert("خطأ", err.message || "تعذّر حذف الموعد");
      console.log("Delete error:", err);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const confirmDelete = (appointment) => {
    if (!appointment) return;
    Alert.alert(
      "تأكيد الحذف",
      "سيتم إزالة الحجز نهائيًا، هل تريد الاستمرار؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => handleDelete(appointment._id),
        },
      ]
    );
  };

  const openBlockOptions = async (appointment) => {
    if (!appointment?.user?._id) {
      Alert.alert("تنبيه", "لا يمكن حظر مراجع بدون حساب مرتبط.");
      return;
    }
    const patientId = appointment.user._id;
    let current = { blockChat: false, blockBooking: false };
    try {
      const res = await getBlock(patientId);
      if (res?.block) current = res.block;
    } catch (err) {
      console.log("block fetch error", err);
    }

    const applyBlock = async (changes) => {
      try {
        const next = {
          blockChat:
            changes.blockChat !== undefined ? changes.blockChat : current.blockChat,
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
          text: current.blockChat ? "رفع حظر المراسلة" : "حظر المراسلة",
          onPress: () => applyBlock({ blockChat: !current.blockChat }),
        },
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
          <Feather name="camera" size={18} color="#0EA5E9" />
          <Text style={styles.scanButtonText}>مسح باركود المراجع</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.manualButton}
          onPress={() => setManualModalVisible(true)}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.manualButtonText}>حجز يدوي</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Feather name="search" size={18} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث عن مريض (اسم/هاتف/رقم الحجز)"
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
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
          <Text style={styles.statsTitle}>This Week</Text>
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statsLabel}>إجمالي الطلبات</Text>
              <Text style={styles.statsValue}>{weekStats.total}</Text>
            </View>
            <View>
              <Text style={styles.statsLabel}>قيد الانتظار</Text>
              <Text style={styles.statsValue}>{weekStats.pending}</Text>
            </View>
            <View>
              <Text style={styles.statsLabel}>مؤكدة</Text>
              <Text style={styles.statsValue}>{weekStats.confirmed}</Text>
            </View>
            <View>
              <Text style={styles.statsLabel}>مرفوضة</Text>
              <Text style={styles.statsValue}>{weekStats.cancelled}</Text>
            </View>
          </View>
        </View>

        {loading && (
          <ActivityIndicator size="large" color="#0EA5E9" style={styles.loader} />
        )}

        {!loading && appointments.length === 0 && (
          <Text style={styles.emptyText}>لا توجد حجوزات جديدة.</Text>
        )}

        {!loading && appointments.length > 0 && visibleAppointments.length === 0 && (
          <Text style={styles.emptyText}>لا توجد نتائج مطابقة.</Text>
        )}

        {visibleAppointments.map((appointment) => {
          const statusColor = {
            confirmed: "#16A34A",
            pending: "#D97706",
            cancelled: "#B91C1C",
          }[appointment.status] || "#4B5563";
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

              <View style={styles.bookingRow}>
                <Text style={styles.bookingLabel}>رقم الحجز</Text>
                <Text style={styles.bookingValue}>
                  {appointment.doctorQueueNumber ?? appointment.doctorIndex ?? appointment.bookingNumber ?? "-"}
                </Text>
              </View>

              <View style={styles.bookingRow}>
                <Text style={styles.bookingLabel}>الخدمة</Text>
                <Text style={styles.bookingValue}>
                  {appointment.service?.name || "-"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Feather name="calendar" size={16} color="#0EA5E9" />
                <Text style={styles.infoText}>{appointment.appointmentDate}</Text>
              </View>
              <View style={styles.infoRow}>
                <Feather name="clock" size={16} color="#0EA5E9" />
                <Text style={styles.infoText}>{appointment.appointmentTime}</Text>
              </View>
              {appointment.notes ? (
                <View style={styles.notesRow}>
                  <Text style={styles.notesLabel}>ملاحظات</Text>
                  <Text style={styles.notesText}>{appointment.notes}</Text>
                </View>
              ) : null}

              {/* QR Code Toggle and Display Removed */}

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
                {canCancel && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    disabled={Boolean(actionLoading[appointment._id])}
                    onPress={() => handleCancel(appointment._id)}
                  >
                    <Text style={styles.actionText}>إلغاء</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  disabled={Boolean(actionLoading[appointment._id])}
                  onPress={() => confirmDelete(appointment)}
                >
                  <Text style={[styles.actionText, styles.deleteButtonText]}>حذف</Text>
                </TouchableOpacity>
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
                  <Feather name="x" size={20} color="#111827" />
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
                  <ActivityIndicator color="#fff" />
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
                style={[styles.modalActionButton, styles.chatModalButton]}
                onPress={() => openChat(selectedAppointment)}
              >
                <Text style={styles.modalActionText}>مراسلة</Text>
              </TouchableOpacity>
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
                      "doctorName",
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
    </SafeAreaView>
  );
}

const createStyles = (colors, isDark) => {
  const primaryTint = isDark ? "rgba(56,189,248,0.18)" : "#E0F2FE";
  const neutralTint = isDark ? "rgba(255,255,255,0.06)" : "#F9FAFB";
  const mutedCard = isDark ? "rgba(255,255,255,0.04)" : "#F3F4F6";
  const recentCancelBg = isDark ? "rgba(245,158,11,0.18)" : "#FEF3C7";
  const successTint = isDark ? "rgba(16,185,129,0.18)" : "#DCFCE7";
  const warningTint = isDark ? "rgba(245,158,11,0.18)" : "#FEF3C7";
  const dangerTint = isDark ? "rgba(239,68,68,0.16)" : "#FEE2E2";
  const blockTint = isDark ? "rgba(239,68,68,0.16)" : "#FEF2F2";
  const chatDisabled = isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB";
  const modalShadow = isDark ? colors.surface : "#111827";

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
      paddingHorizontal: 12,
      paddingBottom: 12,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 1,
    },
    scanButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: primaryTint,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 8,
    },
    scanButtonText: {
      color: colors.primary,
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
    content: {
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    statsCard: {
      backgroundColor: mutedCard,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    statsTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 12,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    statsLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    statsValue: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    manualButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      gap: 6,
      backgroundColor: colors.text,
      borderWidth: 1,
      borderColor: colors.text,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    manualButtonText: {
      color: colors.background,
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
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: "row-reverse",
      justifyContent: "flex-start",
      alignItems: "center",
      gap: 10,
      alignSelf: "flex-end",
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
      paddingVertical: 2,
      fontSize: 12,
      fontWeight: "600",
      writingDirection: "rtl",
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
    },
    infoText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    notesRow: {
      marginTop: 10,
    },
    bookingRow: {
      flexDirection: "row-reverse",
      justifyContent: "flex-start",
      alignItems: "center",
      gap: 8,
      marginTop: 6,
      alignSelf: "flex-start",
    },
    bookingLabel: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    bookingValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    notesLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 4,
    },
    notesText: {
      fontSize: 14,
      color: colors.text,
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
      justifyContent: "flex-start",
      marginTop: 16,
      flexWrap: "wrap",
      gap: 8,
    },
    actionButton: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      minWidth: 90,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "transparent",
    },
    acceptButton: {
      backgroundColor: successTint,
      borderColor: colors.success,
    },
    cancelButton: {
      backgroundColor: warningTint,
      borderColor: colors.warning,
    },
    deleteButton: {
      backgroundColor: dangerTint,
      borderColor: colors.danger,
    },
    deleteButtonText: {
      color: colors.danger,
    },
    blockButton: {
      backgroundColor: blockTint,
      borderColor: colors.danger,
    },
    chatButton: {
      backgroundColor: primaryTint,
    },
    chatButtonDisabled: {
      backgroundColor: chatDisabled,
    },
    chatButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "700",
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
      backgroundColor: "#25D366",
    },
    callButton: {
      backgroundColor: colors.primary,
    },
    chatModalButton: {
      backgroundColor: "#2563EB",
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
      backgroundColor: "#000",
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
      marginTop: 8,
      fontWeight: "600",
    },
    actionText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
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
