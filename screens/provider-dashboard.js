import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { fetchDoctorDashboard, logout } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

export default function ProviderDashboardScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [doctor, setDoctor] = useState(null);
  const [stats, setStats] = useState({ pending: 0, confirmed: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const loadDoctor = async () => {
    setLoading(true);
    try {
      const data = await fetchDoctorDashboard();
      setDoctor(data.doctor);
      setStats(data.stats || { pending: 0, confirmed: 0, total: 0 });
    } catch (err) {
      console.log("Provider dashboard error:", err);
      Alert.alert("خطأ", err.message || "تعذّر تحميل بيانات الطبيب");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctor();
  }, []);

  const handleGoToAppointments = () => {
    navigation.navigate("DoctorAppointments");
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace("RoleSelection");
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
          <Text style={styles.title}>لوحة الطبيب</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>تسجيل خروج</Text>
          </TouchableOpacity>
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
            <Text style={styles.name}>{doctor?.displayName || "الطبيب"}</Text>
            <Text style={styles.roleText}>{doctor?.specialty || "تخصص"}</Text>
            <Text style={styles.detailText}>{doctor?.location}</Text>
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
            <Text style={styles.statLabel}>الكل</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleGoToAppointments}
        >
          <Text style={styles.primaryButtonText}>فتح صفحة قبول الحجوزات</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>نظرة عامة على الملف</Text>
          <Text style={styles.sectionText}>{doctor?.certification}</Text>
          <Text style={[styles.sectionText, { marginTop: 12 }]}>{doctor?.cv}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
    loaderContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 24,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
    },
    logoutButton: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
    },
    logoutText: {
      color: colors.primary,
      fontWeight: "600",
    },
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      marginRight: 16,
    },
    placeholderAvatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? "rgba(56,189,248,0.15)" : "#DBEAFE",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    placeholderAvatarText: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.primary,
    },
    profileInfo: {
      flex: 1,
    },
    name: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    roleText: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 4,
    },
    detailText: {
      fontSize: 12,
      color: colors.placeholder,
      marginTop: 2,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      paddingVertical: 18,
      paddingHorizontal: 10,
      marginHorizontal: 4,
      alignItems: "center",
    },
    statLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    statValue: {
      fontSize: 20,
      fontWeight: "700",
      marginTop: 6,
      color: colors.text,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      marginBottom: 24,
    },
    primaryButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    section: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 12,
      color: colors.text,
    },
    sectionText: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
    },
  });
