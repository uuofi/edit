import React, { useMemo } from "react";
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
import { useAppTheme } from "../lib/useTheme";

export default function DoctorDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const ratingAverage = Number(params.ratingAverage);
  const ratingCount = Number(params.ratingCount);
  const hasRating = Number.isFinite(ratingAverage) && ratingCount > 0;
  const ratingText = hasRating
    ? `${ratingAverage.toFixed(1)} (${ratingCount} تقييم)`
    : "لا توجد تقييمات بعد";
  const contactPhone = params.phone || params.contactPhone || params.secretaryPhone;
  const doctorDescription =
    params.description ||
    params.bio ||
    `${doctorName} مختص بـ ${doctorSpecialty} ضمن ${specialtyTitle}، ويحافظ على متابعة دقيقة للمرضى.`;
  const formatDinar = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return null;
    return `${amount.toLocaleString("en-US")} دينار`;
  };
  const formattedConsultationFee = formatDinar(consultationFee);

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
              <Feather name="chevron-right" size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerSubtitle}>الملف التعريفي للطبيب</Text>
              <Text style={styles.headerTitle}>{doctorName}</Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.avatar}>
              {avatarSource ? (
                <Image source={avatarSource} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={42} color={colors.primary} />
              )}
            </View>
            <Text style={styles.doctorName}>{doctorName}</Text>
            <Text style={styles.doctorSpecialty}>{doctorSpecialty}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Feather name="award" size={14} color={colors.primary} />
                <Text style={styles.metaChipText}>{specialtyTitle}</Text>
              </View>
              {doctorAge ? (
                <View style={styles.metaChip}>
                  <Feather name="clock" size={14} color={colors.primary} />
                  <Text style={styles.metaChipText}>العمر: {doctorAge}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.ratingRow}>
              <Feather name="star" size={16} color={colors.primary} />
              <Text style={styles.ratingText}>{ratingText}</Text>
            </View>

            <View style={styles.locationCard}>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={16} color={colors.textMuted} />
                <Text style={styles.locationText}>{location}</Text>
              </View>
              <TouchableOpacity
                style={styles.openMapButton}
                onPress={() =>
                  openInGoogleMaps({
                    latitude: locationLat,
                    longitude: locationLng,
                    address: location,
                  })
                }
              >
                <Text style={styles.openMapButtonText}>فتح موقع العيادة في خرائط Google</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>عن الطبيب</Text>
            <Text style={styles.sectionBody}>{doctorDescription}</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>معلومات إضافية</Text>
            {certification ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>الشهادة</Text>
                <Text style={styles.infoValue}>{certification}</Text>
              </View>
            ) : null}
            {cv ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>السيرة</Text>
                <Text style={styles.infoValue}>{cv}</Text>
              </View>
            ) : null}
            {formattedConsultationFee ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>قيمة الكشف</Text>
                <Text style={styles.infoValue}>{formattedConsultationFee}</Text>
              </View>
            ) : null}
            {contactPhone ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>رقم التواصل</Text>
                <Text style={styles.infoValue}>{contactPhone}</Text>
              </View>
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

const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    screen: { flex: 1, backgroundColor: colors.background },
    headerRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: 4,
      paddingVertical: 6,
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
      textAlign: "right",
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      writingDirection: "rtl",
    },
    headerSubtitle: {
      textAlign: "right",
      color: colors.textMuted,
      fontSize: 13,
      writingDirection: "rtl",
      marginBottom: 2,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 28,
    },
    heroCard: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 18,
      paddingHorizontal: 14,
    },
    avatar: {
      width: 104,
      height: 104,
      borderRadius: 26,
      backgroundColor: colors.primary + "20",
      marginBottom: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImage: {
      width: 104,
      height: 104,
      borderRadius: 26,
    },
    doctorName: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
      textAlign: "right",
      writingDirection: "rtl",
    },
    doctorSpecialty: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 12,
      textAlign: "right",
      writingDirection: "rtl",
    },
    metaRow: {
      width: "100%",
      flexDirection: "row-reverse",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10,
    },
    metaChip: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    metaChipText: {
      fontSize: 12,
      color: colors.text,
      writingDirection: "rtl",
    },
    ratingRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      marginBottom: 12,
    },
    ratingText: {
      marginRight: 4,
      fontSize: 13,
      color: colors.textMuted,
    },
    locationCard: {
      width: "100%",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 10,
    },
    locationRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "center",
    },
    locationText: {
      marginRight: 4,
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    openMapButton: {
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    openMapButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
      writingDirection: "rtl",
    },
    sectionCard: {
      marginTop: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
      textAlign: "right",
      writingDirection: "rtl",
    },
    sectionBody: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    sectionMeta: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 6,
      textAlign: "right",
      writingDirection: "rtl",
    },
    sectionMetaLabel: {
      fontWeight: "600",
      color: colors.text,
    },
    infoRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      marginTop: 10,
      gap: 4,
      alignItems: "flex-end",
    },
    infoLabel: {
      fontSize: 12,
      color: colors.textMuted,
      writingDirection: "rtl",
    },
    infoValue: {
      fontSize: 15,
      color: colors.text,
      writingDirection: "rtl",
      textAlign: "right",
      alignSelf: "stretch",
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 16,
      backgroundColor: colors.surface,
    },
    primaryButton: {
      backgroundColor: colors.primary,
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
