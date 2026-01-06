import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { STATUS_LABELS } from "../lib/constants/statusLabels";
import { cancelAppointment, ApiError, getUserRole, fetchAppointment } from "../lib/api";
import { logout } from "../lib/api";
import { openInGoogleMaps } from "../lib/maps";
import { useAppTheme } from "../lib/useTheme";

export default function AppointmentDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params =
    route.params && typeof route.params === "object" ? route.params : {};

  // ====== Helpers from params ======
  const appointmentId = params.appointmentId || params._id || null;
  const doctorName = params.doctorName || params.name || "الطبيب";
  const doctorSpecialty = params.doctorSpecialty || params.specialty || "";
  const doctorProfile =
    params.doctorProfile && typeof params.doctorProfile === "object"
      ? params.doctorProfile
      : null;
  const location =
    params.location || doctorProfile?.location || params.clinicName || "المركز الطبي بالمدينة";
  const rawLat =
    typeof params.locationLat !== "undefined" ? params.locationLat : doctorProfile?.locationLat;
  const rawLng =
    typeof params.locationLng !== "undefined" ? params.locationLng : doctorProfile?.locationLng;
  const locationLat = typeof rawLat === "number" ? rawLat : Number(rawLat);
  const locationLng = typeof rawLng === "number" ? rawLng : Number(rawLng);
  const appointmentDate = params.date || params.appointmentDate || "";
  const appointmentTime = params.time || params.appointmentTime || "";
  const contactNumber =
    params.contactNumber || params.doctorPhone || params.clinicPhone || "";
  const secretaryPhone =
    params.secretaryPhone || doctorProfile?.secretaryPhone || "";
  const consultationFee =
    typeof params.consultationFee === "number"
      ? params.consultationFee
      : Number(params.consultationFee) || 0;
  const service = params.service && typeof params.service === "object" ? params.service : null;
  const serviceName =
    typeof service?.name === "string" && service.name.trim() ? service.name.trim() : null;
  const servicePrice =
    typeof service?.price === "number" ? service.price : Number(service?.price);
  const effectivePrice = Number.isFinite(servicePrice) ? servicePrice : consultationFee;
  const biographyText =
    params.biography || params.aboutDoctor || "لا توجد نبذة متاحة.";
  const initialQrSource =
    params.qrSource || params.qrCodeUrl || params.qrCode || null;
  const initialQrPayload = params.qrPayload || null;
  const createdByDoctor = !!(params.createdByDoctor || params.manualFromDoctor);
  const doctorNote = params.doctorNote || "";
  const doctorPrescriptions = params.doctorPrescriptions || [];
  const bookingNumber = params.bookingNumber || params.bookingNo || "";
  const avatarUrl =
    params.avatarUrl || params.doctorAvatar || params.imageUrl || "";
  const initialStatus = params.status || "pending";

  const [qrSource, setQrSource] = useState(initialQrSource);
  const [qrPayload, setQrPayload] = useState(initialQrPayload);

  // ====== State ======
  const [statusKey, setStatusKey] = useState(initialStatus);
  const [cancelling, setCancelling] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // ====== Effects ======
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const role = await getUserRole();
        if (mounted) setUserRole(role);
      } catch (e) {
        // تجاهل الخطأ، مو ضروري نوقف الشاشة
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (qrSource) return;
        if (!appointmentId) return;
        const data = await fetchAppointment(appointmentId);
        const appt = data?.appointment;
        if (!mounted || !appt) return;
        if (appt.qrCode) setQrSource(appt.qrCode);
        if (appt.qrPayload) setQrPayload(appt.qrPayload);
      } catch {
        // ignore (screen still works without QR)
      }
    })();
    return () => {
      mounted = false;
    };
  }, [appointmentId, qrSource]);

  // ====== Helpers ======
  const statusText = STATUS_LABELS[statusKey] || "قيد المعالجة";

  const formatCurrency = (value) => {
    const num = Number(value) || 0;
    try {
      return `${num.toLocaleString("ar-IQ")} د.ع`;
    } catch {
      return `${num} د.ع`;
    }
  };

  const handleCallSecretary = () => {
    if (!secretaryPhone) return;
    const telUrl = `tel:${secretaryPhone}`;
    Linking.openURL(telUrl).catch(() =>
      Alert.alert("تعذر الاتصال", "تحقق من رقم الهاتف أو الصلاحيات")
    );
  };

  const handleCancelAppointment = () => {
    if (!appointmentId) {
      Alert.alert("غير متاح", "لا يوجد معرف الحجز لإلغائه.");
      return;
    }

    Alert.alert("تأكيد", "هل ترغب بإلغاء هذا الموعد؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "نعم، إلغاء",
        onPress: async () => {
          setCancelling(true);
          try {
            const { appointment } = await cancelAppointment(appointmentId);
            setStatusKey(appointment.status);
            Alert.alert("تم", "أُلغي الموعد بنجاح");
            navigation.replace("MyAppointments");
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
              Alert.alert("تسجيل الدخول مطلوب", "سجّل دخولك حتى تستطيع إلغاء الموعد.", [
                { text: "إلغاء", style: "cancel" },
                {
                  text: "تسجيل الدخول",
                  onPress: () => logout().finally(() => navigation.replace("Login")),
                },
              ]);
              return;
            }
            Alert.alert("فشل الإلغاء", err.message || "حاول لاحقاً.");
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  // ====== Render ======
  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-right" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>تفاصيل الموعد</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Status */}
          <View style={styles.statusWrapper}>
            <View
              style={[
                styles.statusBadge,
                statusKey === "confirmed" && styles.statusConfirmed,
                statusKey === "pending" && styles.statusPending,
                statusKey === "completed" && styles.statusCompleted,
                statusKey === "cancelled" && styles.statusCancelled,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  statusKey === "confirmed" && styles.statusTextConfirmed,
                  statusKey === "pending" && styles.statusTextPending,
                  statusKey === "completed" && styles.statusTextCompleted,
                  statusKey === "cancelled" && styles.statusTextCancelled,
                ]}
              >
                {statusText}
              </Text>
            </View>
          </View>

          {/* Minimal view when doctor حجز يدوي للمراجع */}
          {createdByDoctor ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>بيانات المراجع</Text>

              {params.patientName || params.userName ? (
                <View style={styles.infoRow}>
                  <View style={styles.iconCircle}>
                    <Feather name="user" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.infoLabel}>اسم المريض</Text>
                    <Text style={styles.infoValue}>
                      {params.patientName || params.userName}
                    </Text>
                  </View>
                </View>
              ) : null}

              {bookingNumber ? (
                <View style={styles.infoRow}>
                  <View style={styles.iconCircle}>
                    <Feather name="hash" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.infoLabel}>رقم الحجز</Text>
                    <Text style={styles.infoValue}>{bookingNumber}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.infoRow}>
                <View style={styles.iconCircle}>
                  <Feather name="calendar" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>اليوم</Text>
                  <Text style={styles.infoValue}>{appointmentDate}</Text>
                </View>
              </View>

              {qrSource ? (
                <View style={styles.qrBlock}>
                  <Text style={styles.sectionTitle}>الباركود</Text>
                  <Image
                    source={{ uri: qrSource }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                  {serviceName ? (
                    <Text style={styles.qrCaption}>الخدمة: {serviceName}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <>
              {/* Doctor Info */}
              <View style={styles.doctorCard}>
                <View style={styles.doctorRow}>
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={styles.avatar} />
                  )}
                  <View>
                    <Text style={styles.doctorName}>{doctorName}</Text>
                    <Text style={styles.doctorSpecialty}>
                      {doctorSpecialty}
                    </Text>
                    <View style={styles.locationRow}>
                      <Feather name="map-pin" size={14} color={colors.textMuted} />
                      <Text style={styles.locationText}>{location}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.openMapButton}
                      onPress={() => openInGoogleMaps({ latitude: locationLat, longitude: locationLng, address: location })}
                    >
                      <Text style={styles.openMapButtonText}>فتح موقع العيادة في خرائط كوكل</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Appointment Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>معلومات الموعد</Text>

                {bookingNumber ? (
                  <View style={styles.infoRow}>
                    <View style={styles.iconCircle}>
                      <Feather name="hash" size={18} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.infoLabel}>رقم الحجز</Text>
                      <Text style={styles.infoValue}>{bookingNumber}</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.infoRow}>
                  <View style={styles.iconCircle}>
                    <Feather name="calendar" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.infoLabel}>التاريخ</Text>
                    <Text style={styles.infoValue}>{appointmentDate}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.iconCircle}>
                    <Feather name="clock" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.infoLabel}>الوقت</Text>
                    <Text style={styles.infoValue}>{appointmentTime}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.iconCircle}>
                    <Feather name="video" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.infoLabel}>نوع الزيارة</Text>
                    <Text style={styles.infoValue}>زيارة حضورية</Text>
                  </View>
                </View>

                {qrSource ? (
                  <View style={styles.qrBlock}>
                    <Text style={styles.sectionTitle}>الباركود</Text>
                    <Image
                      source={{ uri: qrSource }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    {serviceName ? (
                      <Text style={styles.qrCaption}>الخدمة: {serviceName}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {/* Doctor notes / prescriptions */}
              {(doctorNote ||
                (doctorPrescriptions && doctorPrescriptions.length)) && (
                <View style={styles.sectionGray}>
                  <Text style={styles.sectionTitle}>ملاحظات الطبيب</Text>
                  {doctorNote ? (
                    <Text style={styles.bodyText}>{doctorNote}</Text>
                  ) : null}
                  {doctorPrescriptions?.length ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginTop: 10 }}
                    >
                      {doctorPrescriptions.map((uri, idx) => (
                        <Image
                          key={idx}
                          source={{ uri }}
                          style={{
                            width: 120,
                            height: 120,
                            borderRadius: 10,
                            marginRight: 10,
                          }}
                        />
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              )}

              {/* About doctor */}
              <View style={styles.sectionGray}>
                <Text style={styles.sectionTitle}>نبذة عن الطبيب</Text>
                <Text style={styles.bodyText}>{biographyText}</Text>
              </View>

              {/* Payment */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>ملخص الدفع</Text>
                {serviceName ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>الخدمة</Text>
                    <Text style={styles.summaryValue}>{serviceName}</Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>السعر</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(effectivePrice)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTotalLabel}>الإجمالي المدفوع</Text>
                  <Text style={styles.summaryTotalValue}>
                    {formatCurrency(effectivePrice)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          {userRole === "doctor" && (
            <TouchableOpacity
              style={styles.nextVisitButton}
              onPress={() => {
                const doctorId =
                  params.doctorProfile?._id || params.doctorId || null;
                navigation.navigate("BookAppointment", {
                  manualFromDoctor: createdByDoctor,
                  doctorId,
                  doctorName: params.name || params.doctorName,
                  doctorRole: params.role || params.doctorRole,
                  specialty: params.specialty || params.doctorSpecialty,
                  specialtySlug: params.specialtySlug || null,
                  avatarUrl: params.avatarUrl || null,
                  patientName: params.patientName || params.userName || "",
                  patientPhone: params.patientPhone || params.userPhone || "",
                  schedule:
                    params.doctorProfile?.schedule ||
                    params.schedule ||
                    null,
                });
              }}
            >
              <Feather name="calendar" size={18} color={colors.primary} />
              <Text style={styles.nextVisitText}>المراجعة القادمة</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.chatButton}
            onPress={() =>
              navigation.navigate("Chat", {
                doctorName,
                appointmentId,
                appointmentDate,
                appointmentTime,
                contactNumber,
                avatarUrl,
              })
            }
          >
            <Feather name="message-circle" size={18} color={colors.primary} />
            <Text style={styles.chatButtonText}>مراسلة الطبيب</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.contactButton,
              !secretaryPhone && styles.contactButtonDisabled,
            ]}
            disabled={!secretaryPhone}
            onPress={handleCallSecretary}
          >
            <Feather name="phone" size={18} color="#fff" />
            <Text style={styles.contactButtonText}>الاتصال بالسكرتير</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            disabled={
              cancelling || statusKey === "cancelled" || !appointmentId
            }
            onPress={handleCancelAppointment}
          >
            <Text style={styles.cancelButtonText}>
              {cancelling
                ? "جارٍ الإلغاء..."
                : statusKey === "cancelled"
                ? "تم الإلغاء"
                : "إلغاء الموعد"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
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
    writingDirection: "rtl",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  statusWrapper: {
    alignItems: "center",
    marginTop: 16,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
  },
  statusText: {
    fontSize: 13,
    color: "#16A34A",
  },
  statusConfirmed: {
    backgroundColor: "#DCFCE7",
  },
  statusPending: {
    backgroundColor: "#FEF3C7",
  },
  statusCompleted: {
    backgroundColor: "#E5E7EB",
  },
  statusCancelled: {
    backgroundColor: "#FEE2E2",
  },
  statusTextConfirmed: {
    color: "#16A34A",
  },
  statusTextPending: {
    color: "#D97706",
  },
  statusTextCompleted: {
    color: "#4B5563",
  },
  statusTextCancelled: {
    color: "#B91C1C",
  },
  doctorCard: {
    backgroundColor: colors.surfaceAlt,
    padding: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  doctorRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  doctorName: { fontSize: 16, fontWeight: "600", color: colors.text },
  doctorSpecialty: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "right",
    writingDirection: "rtl",
  },
  openMapButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  openMapButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    writingDirection: "rtl",
  },
  section: {
    marginTop: 16,
  },
  sectionGray: {
    marginTop: 16,
    backgroundColor: colors.surfaceAlt,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
    textAlign: "right",
    margin: 4,
  },
  infoRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  infoValue: {
    fontSize: 14,
    color: colors.text,
    textAlign: "right",
    writingDirection: "rtl",
  },
  bodyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "right",
    writingDirection: "rtl",
  },
  summaryRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "right",
    writingDirection: "rtl",
  },
  summaryValue: {
    fontSize: 13,
    color: colors.text,
    textAlign: "right",
    writingDirection: "rtl",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    textAlign: "right",
    writingDirection: "rtl",
  },
  summaryTotalValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    textAlign: "right",
    writingDirection: "rtl",
  },
  qrBlock: {
    marginTop: 12,
    alignItems: "center",
  },
  qrCaption: {
    marginTop: 8,
    fontSize: 13,
    color: colors.text,
    textAlign: "right",
    writingDirection: "rtl",
  },
  qrImage: {
    width: 140,
    height: 140,
    marginTop: 8,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    backgroundColor: colors.surface,
  },
  chatButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  chatButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
    writingDirection: "rtl",
  },
  contactButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  contactButtonDisabled: {
    backgroundColor: colors.border,
  },
  contactButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
    writingDirection: "rtl",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#DC2626",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    writingDirection: "rtl",
  },
  nextVisitButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  nextVisitText: {
    color: colors.primary,
    fontWeight: "700",
    marginLeft: 6,
  },
});
