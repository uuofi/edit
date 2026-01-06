import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchDoctorDashboard, logout, getToken } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

export default function ProviderProfileScreen() {
  const navigation = useNavigation();
  const [doctor, setDoctor] = useState(null);
  const [stats, setStats] = useState({ pending: 0, confirmed: 0, total: 0 });
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const loadDoctor = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDoctorDashboard();
      setDoctor(data.doctor);
      setStats(data.stats || { pending: 0, confirmed: 0, total: 0 });
      setAppointments(data.appointments || []);
    } catch (err) {
      console.log("Provider profile load error:", err);
      if (err.status === 401 || err.status === 403) {
        const message =
          err.status === 403
            ? err?.payload?.message || "لا تملك صلاحية الوصول."
            : "انتهت الجلسة أو لم تعد صالحة.";
        Alert.alert("تسجيل الدخول مطلوب", message, [
          { text: "إلغاء", style: "cancel" },
          {
            text: "تسجيل الدخول",
            onPress: () => logout().finally(() => navigation.reset({ index: 0, routes: [{ name: "Login" }] })),
          },
        ]);
        return;
      }
      Alert.alert("خطأ", err.message || "تعذّر تحميل بياناتك");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const token = await getToken();
        if (!token) {
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          return;
        }
        await loadDoctor();
      })();
      return () => {};
    }, [loadDoctor, navigation])
  );

  const handleLogout = async () => {
    await logout();
    navigation.replace("RoleSelection");
  };

  const handleOpenAppointments = () => {
    navigation.navigate("ProviderAppointmentsTab");
  };

  const openDrawer = () => {
    if (typeof navigation?.openDrawer === "function") {
      navigation.openDrawer();
      return;
    }
    const parent = navigation?.getParent?.();
    if (typeof parent?.openDrawer === "function") parent.openDrawer();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}> 
          <View>
            <Text style={styles.title}>لوحة الطبيب</Text>
            <Text style={styles.subtitle}>{doctor?.email || ""}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={openDrawer}
            >
              <Feather name="menu" size={20} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Feather name="log-out" size={18} color={colors.primary} />
              <Text style={styles.logoutText}>تسجيل خروج</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileCard}>
          {doctor?.avatarUrl ? (
            <Image source={{ uri: doctor.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.placeholderAvatar}>
              <Text style={styles.placeholderAvatarText}>Dr</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{doctor?.displayName || "الطبيب"}</Text>
              <TouchableOpacity
                style={styles.inlineEditButton}
                onPress={() => navigation.navigate("ProviderProfileEdit", { doctor })}
              >
                <Feather
                  name="edit"
                  size={16}
                  color={colors.primary}
                  style={{ marginLeft: 6 }}
                />
                <Text style={styles.inlineEditButtonText}>تعديل</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.roleText}>{doctor?.specialty || "تخصص"}</Text>
            <Text style={styles.detailText}>{doctor?.location}</Text>
            <Text style={styles.bioText}>{doctor?.bio}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>قيد الانتظار</Text>
            <Text style={styles.statValue}>{stats.pending}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>مؤكد</Text>
            <Text style={styles.statValue}>{stats.confirmed}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>المجموع</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ملف الطبيب</Text>
          <Text style={styles.sectionText}>{doctor?.certification}</Text>
          <Text style={[styles.sectionText, { marginTop: 8 }]}>{doctor?.cv}</Text>
        </View>

        <View style={styles.sectionGray}>
          <Text style={styles.sectionTitle}>قائمة المواعيد القادمة</Text>
          {appointments.length === 0 ? (
            <Text style={styles.emptyText}>لا توجد مواعيد حالياً</Text>
          ) : (
            appointments.slice(0, 3).map((appointment) => (
              <View key={appointment._id} style={styles.appointmentRow}>
                <View>
                  <Text style={styles.appointmentPatient}>مريض</Text>
                  <Text style={styles.appointmentName}>{appointment.user?.name}</Text>
                </View>
                <Text style={styles.appointmentTime}>{appointment.appointmentTime}</Text>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleOpenAppointments}>
          <Text style={styles.primaryButtonText}>إدارة الحجوزات</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 12, backgroundColor: "#EFF6FF" }]}
          onPress={() => navigation.navigate("ProviderServicesTab")}
        >
          <Text style={[styles.primaryButtonText, { color: "#0EA5E9" }]}>إدارة الخدمات</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 12, backgroundColor: "#FFFFFF" }]}
          onPress={() => navigation.navigate("ProviderSettingsTab")}
        >
          <Text style={[styles.primaryButtonText, { color: "#0EA5E9" }]}>الإعدادات</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    loaderContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
      writingDirection: "rtl",
    },
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
      writingDirection: "rtl",
    },
    container: {
      padding: 24,
      paddingBottom: 40,
      writingDirection: "rtl",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 24,
    },
    headerRight: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 10,
    },
    menuButton: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    logoutButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    logoutText: {
      color: colors.primary,
      fontWeight: "700",
    },
    title: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.text,
      textAlign: "right",
    },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 4,
      textAlign: "right",
    },
    profileCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
      shadowColor: colors.overlay,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: colors.surfaceAlt,
    },
    placeholderAvatar: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    placeholderAvatarText: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textMuted,
    },
    profileInfo: {
      flex: 1,
      gap: 4,
    },
    nameRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    name: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      textAlign: "right",
    },
    inlineEditButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inlineEditButtonText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 13,
    },
    roleText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: "right",
    },
    detailText: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "right",
    },
    bioText: {
      color: colors.text,
      fontSize: 13,
      textAlign: "right",
    },
    statsRow: {
      flexDirection: "row-reverse",
      gap: 10,
      marginTop: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 12,
      alignItems: "flex-end",
      borderWidth: 1,
      borderColor: colors.border,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 12,
      marginBottom: 4,
    },
    statValue: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: "800",
    },
    section: {
      marginTop: 18,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionGray: {
      marginTop: 14,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
      textAlign: "right",
    },
    sectionText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
    },
    appointmentRow: {
      marginTop: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 8,
    },
    appointmentPatient: {
      fontSize: 12,
      color: colors.textMuted,
    },
    appointmentName: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "700",
    },
    appointmentTime: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: "700",
    },
    emptyText: {
      textAlign: "right",
      color: colors.textMuted,
      fontSize: 13,
    },
    primaryButton: {
      marginTop: 20,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
    },
    primaryButtonText: {
      color: colors.surface,
      fontWeight: "700",
      fontSize: 15,
    },
  });