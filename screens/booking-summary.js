import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import BookingSummaryScreen from "./my-appointments";
// غيّر المسار حسب مشروعك إذا لازم
import { fetchDoctorDashboard } from "../lib/api";

export default function BookingSummaryTabScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  const handleAddAppointment = async () => {
    setLoading(true);
    try {
      const data = await fetchDoctorDashboard();
      const doctor = data?.doctor;

      if (!doctor) {
        throw new Error("تعذر جلب بيانات الطبيب");
      }

      navigation.navigate("BookAppointment", {
        doctorId: doctor._id,
        doctorName: doctor.name,
        doctorRole: doctor.role,
        specialty: doctor.specialty,
        specialtySlug: doctor.specialtySlug,
        avatarUrl: doctor.avatarUrl,
        schedule: doctor.schedule,
        location: doctor.location,
        certification: doctor.certification,
        cv: doctor.cv,
        consultationFee: doctor.consultationFee,
      });
    } catch (err) {
      console.log("fetchDoctorDashboard error:", err);
      Alert.alert("خطأ", err.message || "تعذر جلب بيانات الطبيب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* شاشة قائمة المواعيد */}
      <BookingSummaryScreen />

      {/* زر إضافة موعد جديد */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddAppointment}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.addButtonText}>إضافة موعد</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    position: "absolute",
    bottom: 24,
    right: 20,
    left: 20,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
