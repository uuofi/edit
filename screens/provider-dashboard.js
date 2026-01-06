import React, { useEffect, useState } from "react";
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

export default function ProviderDashboardScreen() {
  const navigation = useNavigation();
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
        <ActivityIndicator size="large" color="#0EA5E9" />
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

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
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
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
  },
  logoutText: {
    color: "#0EA5E9",
    fontWeight: "600",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
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
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  placeholderAvatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0EA5E9",
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
  },
  roleText: {
    fontSize: 14,
    color: "#475467",
    marginTop: 4,
  },
  detailText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 10,
    marginHorizontal: 4,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: "#0EA5E9",
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
    backgroundColor: "#F9FAFB",
    borderRadius: 18,
    padding: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 14,
    color: "#475467",
    lineHeight: 20,
  },
});
