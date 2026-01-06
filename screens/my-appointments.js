import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { STATUS_LABELS } from "../lib/constants/statusLabels";
import { fetchAppointments, ApiError, logout } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const CACHE_KEY = "cache_my_appointments_v1";

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

export default function MyAppointmentsScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fetchingRef = useRef(false);

  const loadCached = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) return;
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        setAppointments(parsed);
        setLoading(false);
      }
    } catch (err) {
      console.log("loadCached appointments error", err);
    }
  }, []);

  const handleAuthRedirect = useCallback(() => {
    Alert.alert("تسجيل الدخول مطلوب", "سجّل دخولك حتى تستطيع إدارة مواعيدك.", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تسجيل الدخول",
        onPress: () => logout().finally(() => navigation.replace("Login")),
      },
    ]);
  }, [navigation]);

  const loadAppointments = useCallback(
    async ({ suppressLoader = false } = {}) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      if (!suppressLoader) setLoading(true);

      try {
        const data = await fetchAppointments();
        const fresh = data.appointments || [];
        setAppointments(fresh);
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
        setErrorMessage("");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          handleAuthRedirect();
          return;
        }
        setErrorMessage(err.message || "تعذّر تحميل المواعيد");
      } finally {
        fetchingRef.current = false;
        if (!suppressLoader) setLoading(false);
        setRefreshing(false);
      }
    },
    [handleAuthRedirect]
  );

  useFocusEffect(
    useCallback(() => {
      loadCached();
      loadAppointments();
      return () => {};
    }, [loadAppointments, loadCached])
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>مواعيدي</Text>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadAppointments({ suppressLoader: true });
            }}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <>
            {loading && !refreshing ? (
              <View style={styles.loaderWrapper}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : null}

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            {!loading && appointments.length === 0 && !errorMessage ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>لا توجد مواعيد مسجلة حالياً.</Text>
                <Text style={styles.emptySubText}>ابدأ بالحجز عبر قائمة التخصصات.</Text>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => {
          const statusKey = item.status || "pending";
          const badgeStyle = [
            styles.statusBadge,
            statusKey === "confirmed" && styles.statusConfirmed,
            statusKey === "pending" && styles.statusPending,
            statusKey === "completed" && styles.statusCompleted,
            statusKey === "cancelled" && styles.statusCancelled,
          ];
          const textStyle = [
            styles.statusText,
            statusKey === "confirmed" && styles.statusTextConfirmed,
            statusKey === "pending" && styles.statusTextPending,
            statusKey === "completed" && styles.statusTextCompleted,
            statusKey === "cancelled" && styles.statusTextCancelled,
          ];
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate("AppointmentDetails", {
                  name: item.doctorName,
                  role: item.doctorRole,
                  specialty: item.specialty,
                  appointmentDate: item.appointmentDate,
                  appointmentTime: item.appointmentTime,
                  status: statusKey,
                  appointmentId: item._id,
                  bookingNumber: item.bookingNumber,
                  doctorNote: item.doctorNote,
                  doctorPrescriptions: item.doctorPrescriptions,
                  avatarUrl: item.doctorProfile?.avatarUrl,
                  location: item.doctorProfile?.location,
                  locationLat: item.doctorProfile?.locationLat,
                  locationLng: item.doctorProfile?.locationLng,
                  consultationFee:
                    item.service?.price ?? item.doctorProfile?.consultationFee,
                  service: item.service,
                  doctorBio: item.doctorProfile?.bio,
                  secretaryPhone: item.doctorProfile?.secretaryPhone,
                })
              }
            >
              <View style={styles.cardTopRow}>
                {item.doctorProfile?.avatarUrl ? (
                  <Image
                    source={{ uri: item.doctorProfile.avatarUrl }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatar} />
                )}
                <View style={styles.infoColumn}>
                  <Text style={styles.doctorName}>{item.doctorName}</Text>
                  <Text style={styles.specialty}>{item.specialty}</Text>
                  {item.service?.name ? (
                    <Text style={styles.serviceText}>{item.service.name}</Text>
                  ) : null}
                  <View style={[styles.statusRow, badgeStyle]}>
                    <Text style={textStyle}>{STATUS_LABELS[statusKey] || statusKey}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardBottomRow}>
                <View style={styles.infoRow}>
                  <Feather name="calendar" size={14} color={colors.textMuted} />
                  <Text style={styles.infoText}>{item.appointmentDate}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Feather name="clock" size={14} color={colors.textMuted} />
                  <Text style={styles.infoText}>{to12h(item.appointmentTime)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={<View style={{ height: 24 }} />}
        removeClippedSubviews
        initialNumToRender={8}
        windowSize={7}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      textAlign: "center",
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    loaderWrapper: {
      paddingVertical: 32,
    },
    errorText: {
      textAlign: "center",
      color: "#DC2626",
      marginBottom: 12,
      writingDirection: "rtl",
    },
    emptyState: {
      paddingVertical: 24,
      alignItems: "center",
    },
    emptyText: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 4,
    },
    emptySubText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTopRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      marginBottom: 8,
    },
    infoColumn: {
      flex: 1,
      alignItems: "flex-start",
    },
    statusRow: {
      marginTop: 6,
      alignSelf: "flex-start",
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 999,
      backgroundColor: "#DBEAFE",
      marginLeft: 10,
    },
    avatarImage: {
      width: 56,
      height: 56,
      borderRadius: 999,
      marginLeft: 10,
    },
    doctorName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      textAlign: "right",
    },
    specialty: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
      marginTop: 2,
    },
    serviceText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
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
    statusText: {
      fontSize: 11,
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
    cardBottomRow: {
      flexDirection: "row-reverse",
      marginTop: 4,
      gap: 16,
    },
    infoRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 4,
    },
    infoText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
    },
  });