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
import { fetchAppointments, ApiError, logout, API_BASE_URL } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const resolveMediaUrl = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const prefix = raw.startsWith("/") ? "" : "/";
  return `${API_BASE_URL}${prefix}${raw}`;
};

const CACHE_KEY = "cache_my_appointments_v1";

const TABS = [
  { key: "upcoming", label: "القادمة", statuses: ["pending", "confirmed"] },
  { key: "previous", label: "السابقة", statuses: ["completed"] },
  { key: "cancelled", label: "الملغاة", statuses: ["cancelled"] },
];

const EMPTY_MESSAGES = {
  upcoming: {
    title: "لا توجد مواعيد قادمة.",
    subtitle: "ابدأ بالحجز عبر قائمة التخصصات.",
  },
  previous: {
    title: "لا توجد مواعيد سابقة.",
    subtitle: "ستظهر هنا المواعيد المكتملة.",
  },
  cancelled: {
    title: "لا توجد مواعيد ملغاة.",
    subtitle: "المواعيد التي تلغيها ستظهر هنا.",
  },
};

const to12hArabic = (timeStr) => {
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

export default function MyAppointmentsScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");
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

  const visibleAppointments = useMemo(() => {
    const tab = TABS.find((t) => t.key === activeTab);
    if (!tab) return appointments;
    return appointments.filter((appt) =>
      tab.statuses.includes(appt.status || "pending")
    );
  }, [appointments, activeTab]);

  const handleAddAppointment = useCallback(() => {
    navigation.navigate("HomeTab");
  }, [navigation]);

  const renderCard = useCallback(
    ({ item }) => {
      const statusKey = item.status || "pending";
      return (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate("AppointmentDetails", {
              name: item.doctorName,
              role: item.doctorRole,
              specialty: item.specialty,
              doctorProfile: item.doctorProfile,
              appointmentDate: item.appointmentDate,
              appointmentTime: item.appointmentTime,
              status: statusKey,
              appointmentId: item._id,
              bookingNumber: item.bookingNumber,
              patientRatingScore: item.patientRatingScore,
              patientRatingComment: item.patientRatingComment,
              patientRatedAt: item.patientRatedAt,
              doctorNote: item.doctorNote,
              doctorPrescriptions: item.doctorPrescriptions,
              avatarUrl: item.doctorProfile?.avatarUrl,
              location: item.doctorProfile?.location,
              locationLat: item.doctorProfile?.locationLat,
              locationLng: item.doctorProfile?.locationLng,
              ratingAverage: item.doctorProfile?.ratingAverage,
              ratingCount: item.doctorProfile?.ratingCount,
              consultationFee:
                item.service?.price ?? item.doctorProfile?.consultationFee,
              service: item.service,
              doctorBio: item.doctorProfile?.bio,
              secretaryPhone: item.doctorProfile?.secretaryPhone,
            })
          }
        >
          {item.doctorProfile?.avatarUrl ? (
            <Image
              source={{ uri: resolveMediaUrl(item.doctorProfile.avatarUrl) }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Feather name="user" size={28} color={colors.primary} />
            </View>
          )}

          <View style={styles.infoColumn}>
            <Text style={styles.doctorName} numberOfLines={1}>
              {item.doctorName}
            </Text>

            <View style={styles.metaRow}>
              <Feather name="calendar" size={14} color={colors.primary} />
              <Text style={styles.metaText} numberOfLines={1}>
                {item.appointmentDate}
                {item.appointmentTime
                  ? `  •  ${to12hArabic(item.appointmentTime)}`
                  : ""}
              </Text>
            </View>

            {item.service?.name || item.specialty ? (
              <Text style={styles.specialty} numberOfLines={1}>
                {item.service?.name || item.specialty}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [colors, navigation, styles]
  );

  const empty = EMPTY_MESSAGES[activeTab] || EMPTY_MESSAGES.upcoming;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>مواعيدي</Text>
      </View>

      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              activeOpacity={0.8}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={visibleAppointments}
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
            tintColor={colors.primary}
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

            {!loading && visibleAppointments.length === 0 && !errorMessage ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrapper}>
                  <Feather name="calendar" size={28} color={colors.primary} />
                </View>
                <Text style={styles.emptyText}>{empty.title}</Text>
                <Text style={styles.emptySubText}>{empty.subtitle}</Text>
              </View>
            ) : null}
          </>
        }
        renderItem={renderCard}
        ListFooterComponent={<View style={{ height: 96 }} />}
        removeClippedSubviews
        initialNumToRender={8}
        windowSize={7}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
      />

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={handleAddAppointment}
        accessibilityLabel="حجز موعد جديد"
      >
        <Feather name="plus" size={26} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerTitle: {
      textAlign: "center",
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
    },
    tabsRow: {
      flexDirection: "row-reverse",
      paddingHorizontal: 20,
      gap: 8,
      marginBottom: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    tabActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
    },
    tabTextActive: {
      color: "#FFFFFF",
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    loaderWrapper: {
      paddingVertical: 32,
    },
    errorText: {
      textAlign: "center",
      color: colors.danger,
      marginBottom: 12,
      writingDirection: "rtl",
    },
    emptyState: {
      paddingVertical: 48,
      alignItems: "center",
    },
    emptyIconWrapper: {
      width: 64,
      height: 64,
      borderRadius: 999,
      backgroundColor: colors.primary + "15",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    emptySubText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
      flexDirection: "row-reverse",
      alignItems: "center",
      shadowColor: "#0B1F2A",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    avatarImage: {
      width: 64,
      height: 64,
      borderRadius: 999,
      marginLeft: 16,
      backgroundColor: colors.surfaceAlt,
    },
    avatarFallback: {
      width: 64,
      height: 64,
      borderRadius: 999,
      marginLeft: 16,
      backgroundColor: colors.primary + "15",
      alignItems: "center",
      justifyContent: "center",
    },
    infoColumn: {
      flex: 1,
      alignItems: "flex-start",
    },
    doctorName: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
      alignSelf: "stretch",
    },
    metaRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
    },
    metaText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
    },
    specialty: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
      marginTop: 8,
      alignSelf: "stretch",
    },
    fab: {
      position: "absolute",
      bottom: 24,
      right: 20,
      width: 60,
      height: 60,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    },
  });
