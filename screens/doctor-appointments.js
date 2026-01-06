import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fetchDoctorAppointments,
  acceptDoctorAppointment,
} from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

export default function DoctorAppointments() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);
  const fetchingRef = useRef(false);

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
      .catch(() =>
        Alert.alert("خطأ", "تعذّر فتح واتساب، جرّب الاتصال الهاتفي")
      );
  };

  const callPatient = (phone) => {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      Alert.alert("تنبيه", "لا يوجد رقم للاتصال");
      return;
    }
    const url = `tel:${normalized}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("خطأ", "تعذّر إجراء الاتصال")
    );
  };

  const loadAppointments = async (options = {}) => {
    const { silent = false } = options;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (!silent) setLoading(true);
    try {
      const data = await fetchDoctorAppointments();
      setAppointments(data.appointments || []);
    } catch (err) {
      console.log("Doctor appointments fetch error:", err);
      Alert.alert("خطأ", err.message || "تعذّر تحميل الحجوزات");
    } finally {
      fetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
    const interval = setInterval(() => loadAppointments({ silent: true }), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async (id) => {
    setAcceptingId(id);
    try {
      await acceptDoctorAppointment(id);
      Alert.alert("تم", "تم قبول الطلب");
      await loadAppointments();
    } catch (err) {
      console.log("Accept error:", err);
      Alert.alert("خطأ", err.message || "تعذّر قبول الطلب");
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>طلبات الحجوزات</Text>
        {appointments.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>لا توجد حجوزات حالياً.</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={loadAppointments}>
              <Text style={styles.refreshText}>تحديث</Text>
            </TouchableOpacity>
          </View>
        )}
        {appointments.map((appointment) => (
          <View style={styles.card} key={appointment._id}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>المراجع</Text>
              <Text style={styles.cardValue}>{appointment.user?.name || "مراجع"}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>رقم الحجز</Text>
              <Text style={styles.cardValue}>
                {appointment.doctorQueueNumber ?? appointment.doctorIndex ?? appointment.bookingNumber ?? "-"}
              </Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>رقم المراجع</Text>
              <Text style={styles.cardValue}>
                {appointment.user?.phone || "غير متوفر"}
              </Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>العمر</Text>
              <Text style={styles.cardValue}>
                {appointment.user?.age ? `${appointment.user.age} سنة` : "غير محدد"}
              </Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>البريد</Text>
              <Text style={styles.cardValue}>{appointment.user?.email || "غير متوفر"}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>التاريخ</Text>
              <Text style={styles.cardValue}>{appointment.appointmentDate}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>الوقت</Text>
              <Text style={styles.cardValue}>{appointment.appointmentTime}</Text>
            </View>
            {appointment.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.cardLabel}>ملاحظات المراجع</Text>
                <Text style={styles.notesText}>{appointment.notes}</Text>
              </View>
            ) : null}
            <Text style={styles.statusText}>الحالة: {appointment.status}</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.contactButton, styles.whatsappButton]}
                onPress={() => openWhatsApp(appointment.user?.phone)}
              >
                <Text style={styles.contactButtonText}>واتساب</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactButton, styles.callButton]}
                onPress={() => callPatient(appointment.user?.phone)}
              >
                <Text style={styles.contactButtonText}>اتصال</Text>
              </TouchableOpacity>
            </View>
            {appointment.status === "pending" && (
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAccept(appointment._id)}
                disabled={acceptingId === appointment._id}
              >
                <Text style={styles.acceptButtonText}>
                  {acceptingId === appointment._id ? "جارٍ القبول..." : "قبول الطلب"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors, isDark) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 20,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      marginBottom: 18,
      color: colors.text,
    },
    card: {
      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#F7F9FB",
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    cardLabel: {
      fontSize: 13,
      color: colors.textMuted,
    },
    cardValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    statusText: {
      marginTop: 6,
      fontSize: 13,
      color: colors.primary,
      fontWeight: "600",
    },
    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    contactButton: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
      marginHorizontal: 4,
    },
    contactButtonText: {
      color: colors.surface,
      fontSize: 14,
      fontWeight: "700",
    },
    whatsappButton: {
      backgroundColor: "#25D366",
    },
    callButton: {
      backgroundColor: colors.primary,
    },
    acceptButton: {
      marginTop: 10,
      backgroundColor: "#10B981",
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
    },
    acceptButtonText: {
      color: colors.surface,
      fontSize: 15,
      fontWeight: "600",
    },
    notesBox: {
      backgroundColor: isDark ? "rgba(56,189,248,0.15)" : "#E5F3FF",
      borderRadius: 12,
      padding: 10,
      marginTop: 8,
    },
    notesText: {
      fontSize: 13,
      color: colors.text,
      marginTop: 4,
      lineHeight: 18,
    },
    emptyState: {
      marginTop: 60,
      alignItems: "center",
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    refreshButton: {
      marginTop: 12,
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
    refreshText: {
      color: colors.surface,
      fontWeight: "600",
    },
  });
}
