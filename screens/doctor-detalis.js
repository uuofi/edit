import React from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { openInGoogleMaps } from "../lib/maps";

export default function DoctorDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params || {};

  const doctorName = params.name || "د. سارة جونسون";
  const doctorSpecialty = params.role || "أمراض القلب";
  const specialtyTitle = params.specialty || "قسم القلب";
  const doctorAge = params.age;
  const avatarUrl = params.avatarUrl;
  const location = params.location || "المركز الطبي بالمدينة";
  const locationLat = typeof params.locationLat === "number" ? params.locationLat : Number(params.locationLat);
  const locationLng = typeof params.locationLng === "number" ? params.locationLng : Number(params.locationLng);
  const certification = params.certification;
  const cv = params.cv;
  const consultationFee = params.consultationFee;
  const contactPhone = params.phone || params.contactPhone || params.secretaryPhone;
  const doctorDescription =
    params.description ||
    params.bio ||
    `${doctorName} مختص بـ ${doctorSpecialty} ضمن ${specialtyTitle}، ويحافظ على متابعة دقيقة للمرضى.`;

  const avatarSource = avatarUrl ? { uri: avatarUrl } : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.goBack()}
            >
              <Feather name="chevron-right" size={20} color="#111827" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{doctorName}</Text>
              <Text style={styles.headerSubtitle}>{specialtyTitle}</Text>
            </View>
          </View>

          <View style={styles.doctorInfo}>
            <View style={styles.avatar}>
              {avatarSource ? (
                <Image source={avatarSource} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={42} color="#0EA5E9" />
              )}
            </View>
            <Text style={styles.doctorName}>{doctorName}</Text>
            <Text style={styles.doctorSpecialty}>{doctorSpecialty}</Text>
            {doctorAge ? (
              <Text style={styles.doctorSpecialty}>العمر: {doctorAge}</Text>
            ) : null}
            <View style={styles.ratingRow}>
              <Feather name="star" size={16} color="#ffb700" />
              <Text style={styles.ratingText}>٤.٨ (١٢٠ تقييم)</Text>
            </View>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={16} color="#6B7280" />
              <Text style={styles.locationText}>
                {specialtyTitle} • {location}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.openMapButton}
              onPress={() => openInGoogleMaps({ latitude: locationLat, longitude: locationLng, address: location })}
            >
              <Text style={styles.openMapButtonText}>فتح موقع العيادة في خرائط كوكل</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>عن الطبيب</Text>
            <Text style={styles.sectionBody}>{doctorDescription}</Text>
            {certification ? (
              <Text style={[styles.sectionMeta, styles.sectionMetaLabel]}>
                الشهادة: {certification}
              </Text>
            ) : null}
            {cv ? (
              <Text style={styles.sectionMeta}>{cv}</Text>
            ) : null}
            {typeof consultationFee === "number" ? (
              <Text style={styles.sectionMeta}>قيمة الكشف: {consultationFee} ريال</Text>
            ) : null}
            {contactPhone ? (
              <Text style={styles.sectionMeta}>رقم التواصل: {contactPhone}</Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.primaryButtonText}>رجوع</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  screen: { flex: 1, backgroundColor: "#fff" },
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
  headerTitle: {
    flex: 1,
    textAlign: "right",
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    writingDirection: "rtl",
  },
  headerSubtitle: {
    flex: 1,
    textAlign: "right",
    color: "#6B7280",
    fontSize: 14,
    writingDirection: "rtl",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  doctorInfo: {
    alignItems: "center",
    paddingVertical: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "#DBEAFE",
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  doctorName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  doctorSpecialty: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
    textAlign: "right",
    writingDirection: "rtl",
  },
  ratingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 8,
  },
  ratingText: {
    marginRight: 4,
    fontSize: 13,
    color: "#374151",
  },
  locationRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  locationText: {
    marginRight: 4,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "right",
    writingDirection: "rtl",
  },
  openMapButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0EA5E9",
    backgroundColor: "#E0F2FE",
  },
  openMapButtonText: {
    color: "#0EA5E9",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    writingDirection: "rtl",
  },
  section: {
    marginTop: 12,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    textAlign: "right",
    writingDirection: "rtl",
  },
  sectionBody: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "right",
    writingDirection: "rtl",
  },
  sectionMeta: {
    fontSize: 13,
    color: "#475467",
    marginTop: 6,
    textAlign: "right",
    writingDirection: "rtl",
  },
  sectionMetaLabel: {
    fontWeight: "600",
    color: "#111827",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 16,
    backgroundColor: "#fff",
  },
  primaryButton: {
    backgroundColor: "#0EA5E9",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    writingDirection: "rtl",
  },
});
