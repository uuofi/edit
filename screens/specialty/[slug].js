import React, { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { specialtyCatalog } from "../../lib/constants/specialties";
import { API_BASE_URL, fetchDoctorsBySpecialty } from "../../lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme } from "../../lib/useTheme";

const compareDoctorsByRating = (a, b) => {
  const avgA = Number(a?.ratingAverage);
  const avgB = Number(b?.ratingAverage);
  const countA = Number(a?.ratingCount);
  const countB = Number(b?.ratingCount);

  const safeAvgA = Number.isFinite(avgA) ? avgA : 0;
  const safeAvgB = Number.isFinite(avgB) ? avgB : 0;
  const safeCountA = Number.isFinite(countA) ? countA : 0;
  const safeCountB = Number.isFinite(countB) ? countB : 0;

  const rankA = safeCountA > 0 ? safeAvgA : -1;
  const rankB = safeCountB > 0 ? safeAvgB : -1;

  if (rankB !== rankA) return rankB - rankA;
  if (safeCountB !== safeCountA) return safeCountB - safeCountA;

  const nameA = String(a?.displayName || a?.name || "");
  const nameB = String(b?.displayName || b?.name || "");
  return nameA.localeCompare(nameB, "ar");
};

const resolveMediaUrl = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const prefix = raw.startsWith("/") ? "" : "/";
  return `${API_BASE_URL}${prefix}${raw}`;
};

export default function SpecialtyScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const slug = route.params?.slug || "cardiology";

  // نضمن دائماً وجود object حتى لو الاختصاص غير موجود
  const specialtyBase =
  specialtyCatalog[slug] || specialtyCatalog["cardiology"] || {};

  // قيم افتراضية آمنة
  const specialty = {
    title: specialtyBase.title || "",
    description: specialtyBase.description || "",
    doctors: Array.isArray(specialtyBase.doctors) ? specialtyBase.doctors : [],
    highlights: Array.isArray(specialtyBase.highlights)
      ? specialtyBase.highlights
      : [],
  };

  const [selectedDoctorIndex, setSelectedDoctorIndex] = useState(0);
  const [doctorsBySpecialty, setDoctorsBySpecialty] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const CACHE_KEY = "cache_doctors_by_specialty_v2";

  // نبحث عن دكاترة هذا الاختصاص من الـ API (إن وُجدت)
  const specialtyGroup =
    doctorsBySpecialty.find((group) => group.specialtySlug === slug) || null;

  const dynamicDoctors = Array.isArray(specialtyGroup?.doctors)
    ? specialtyGroup.doctors
    : [];

  // دائماً مصفوفة، يا إمّا من الـ API أو من الـ catalog
  const availableDoctors =
    dynamicDoctors.length > 0 ? dynamicDoctors : specialty.doctors;

  const normalizedTerm = searchTerm.trim().toLowerCase();

  const visibleDoctors = (normalizedTerm
    ? availableDoctors.filter((doc) => {
        const haystack = [
          doc.displayName,
          doc.name,
          doc.specialtyLabel,
          doc.specialty,
          doc.licenseNumber,
          doc.secretaryPhone,
          doc.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedTerm);
      })
    : availableDoctors
  )
    .slice()
    .sort(compareDoctorsByRating);

  const normalizedIndex = Math.min(
    selectedDoctorIndex,
    Math.max(visibleDoctors.length - 1, 0)
  );

  const selectedDoctor =
    visibleDoctors.length > 0
      ? visibleDoctors[normalizedIndex] || visibleDoctors[0]
      : null;

  useEffect(() => {
    setSelectedDoctorIndex(0);
  }, [availableDoctors.length, visibleDoctors.length, searchTerm]);

  const handleDoctorPress = (doctor) => {
    if (!doctor) return;
    navigation.navigate("DoctorDetails", {
      doctorId: doctor._id || doctor.id,
      name: doctor.displayName || doctor.name,
      role: doctor.role || "طبيب",
      specialty: doctor.specialtyLabel || specialty.title,
      location: doctor.location,
      locationLat: doctor.locationLat,
      locationLng: doctor.locationLng,
      avatarUrl: resolveMediaUrl(doctor.avatarUrl),
      age: doctor.age,
      description: doctor.bio || doctor.description,
      bio: doctor.bio,
      certification: doctor.certification,
      cv: doctor.cv,
      consultationFee: doctor.consultationFee,
      ratingAverage: doctor.ratingAverage,
      ratingCount: doctor.ratingCount,
      specialtySlug: doctor.specialtySlug || slug,
      phone: doctor.phone,
      secretaryPhone: doctor.secretaryPhone,
      contactPhone: doctor.contactPhone,
    });
  };

  const handleBookPress = () => {
    if (!selectedDoctor) return;

    const rawDoctorId = selectedDoctor._id || selectedDoctor.id;
    const doctorId = rawDoctorId != null ? String(rawDoctorId) : "";
    const isValidObjectId = /^[a-fA-F0-9]{24}$/.test(doctorId);
    if (!isValidObjectId) {
      Alert.alert(
        "تعذر الحجز",
        "بيانات الطبيب غير مكتملة حالياً. يرجى تحديث قائمة الأطباء ثم المحاولة مرة أخرى."
      );
      return;
    }

    const targetSpecialtySlug = selectedDoctor.specialtySlug || slug;
    const targetSpecialtyLabel =
      selectedDoctor.specialtyLabel || specialty.title;

    navigation.navigate("BookAppointment", {
      doctorName: selectedDoctor.displayName || selectedDoctor.name,
      doctorRole: selectedDoctor.role || "طبيب",
      specialty: targetSpecialtyLabel,
      specialtySlug: targetSpecialtySlug,
      doctorId,
      avatarUrl: resolveMediaUrl(selectedDoctor.avatarUrl),
      location: selectedDoctor.location,
      locationLat: selectedDoctor.locationLat,
      locationLng: selectedDoctor.locationLng,
      schedule: selectedDoctor.schedule,
    });
  };

  const loadCached = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) return;
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        setDoctorsBySpecialty(parsed);
      }
    } catch (err) {
      console.log("loadCached doctors error", err);
    }
  };

  const loadDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const data = await fetchDoctorsBySpecialty();
      const fresh = Array.isArray(data?.bySpecialty) ? data.bySpecialty : [];
      setDoctorsBySpecialty(fresh);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
    } catch (err) {
      console.log("Failed to load doctors by specialty:", err);
    } finally {
      setLoadingDoctors(false);
    }
  };

  useEffect(() => {
    loadCached();
    loadDoctors();
  }, [slug]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="chevron-right" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{specialty.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{specialty.title}</Text>
          <Text style={styles.heroDescription}>{specialty.description}</Text>
          <View style={styles.highlightsRow}>
            {specialty.highlights.map((highlight) => (
              <View style={styles.highlightPill} key={highlight}>
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Doctors Section */}
        <View style={[styles.section, styles.sectionSpacing]}>
          <Text style={styles.sectionTitle}>أطباء القسم</Text>

          {loadingDoctors && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>
                جاري تحميل الأطباء من النظام...
              </Text>
            </View>
          )}

          <View style={styles.searchBox}>
            <View style={styles.searchIconWrap}>
              <Feather name="search" size={16} color={colors.primary} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث باسم الطبيب أو الاختصاص"
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor={colors.placeholder}
            />
          </View>
          <Text style={styles.searchHint}>يمكنك البحث بالاسم، الاختصاص، رقم الترخيص أو رقم التواصل</Text>

          {!loadingDoctors && visibleDoctors.length === 0 && (
            <Text style={styles.emptyText}>لا توجد نتائج مطابقة الآن.</Text>
          )}

          {!loadingDoctors &&
            visibleDoctors.map((doctor, index) => {
              const isActive = index === normalizedIndex;
              return (
                <TouchableOpacity
                  key={doctor.id || doctor.name || index}
                  style={[
                    styles.doctorRow,
                    isActive && styles.doctorRowActive,
                    index === visibleDoctors.length - 1 && styles.doctorRowLast,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedDoctorIndex(index)}
                >
                  {doctor.avatarUrl ? (
                    <Image
                      source={{ uri: resolveMediaUrl(doctor.avatarUrl) }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={styles.avatar} />
                  )}

                  <View style={styles.doctorRowContent}>
                    <View style={styles.doctorInfo}>
                      <Text style={styles.doctorName}>
                        {doctor.displayName || doctor.name}
                      </Text>
                      <Text style={styles.doctorRole}>
                        {doctor.licenseNumber
                          ? `ترخيص: ${doctor.licenseNumber}`
                          : doctor.specialtyLabel || doctor.role || "طبيب"}
                      </Text>

                      {doctor.specialtyLabel ? (
                        <Text style={styles.specialtyTag}>
                          اختصاص: {doctor.specialtyLabel}
                        </Text>
                      ) : null}

                      <View style={styles.ratingInlineRow}>
                        <Feather name="star" size={13} color={colors.primary} />
                        <Text style={styles.ratingInlineText}>
                          {Number(doctor?.ratingCount) > 0
                            ? `${Number(doctor?.ratingAverage || 0).toFixed(1)} (${Number(doctor?.ratingCount)} تقييم)`
                            : "بدون تقييم"}
                        </Text>
                      </View>

                      {doctor.age ? (
                        <Text style={styles.doctorRole}>
                          العمر: {doctor.age}
                        </Text>
                      ) : null}

                      <Text style={styles.doctorEmail}>
                        {doctor.phone ||
                          doctor.secretaryPhone ||
                          "لا يوجد رقم"}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.doctorDetailsButton}
                      onPress={() => handleDoctorPress(doctor)}
                      activeOpacity={0.7}
                    >
                      <Feather name="chevron-left" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
        </View>

        {/* Book Button */}
        <TouchableOpacity
          style={[styles.primaryButton, styles.sectionSpacing]}
          onPress={handleBookPress}
          disabled={!selectedDoctor}
        >
          <Text style={styles.primaryButtonText}>احجز الموعد</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 32,
    },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      marginBottom: 4,
    },
    backButton: {
      width: 44,
      height: 44,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "right",
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      writingDirection: "rtl",
    },
    headerSpacer: {
      width: 44,
      height: 44,
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      shadowColor: colors.overlay,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
      elevation: 4,
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    heroDescription: {
      marginTop: 8,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "right",
      lineHeight: 20,
      writingDirection: "rtl",
    },
    highlightsRow: {
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      marginTop: 16,
    },
    highlightPill: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      marginLeft: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    highlightText: {
      fontSize: 11,
      color: colors.primary,
      textAlign: "center",
      writingDirection: "rtl",
    },
    section: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      shadowColor: colors.overlay,
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionSpacing: {
      marginTop: 16,
    },
    searchBox: {
      flexDirection: "row-reverse",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 10,
      marginTop: 12,
      marginBottom: 6,
      backgroundColor: colors.surface,
      gap: 8,
    },
    searchIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchHint: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
      marginBottom: 4,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    loadingRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      marginTop: 12,
    },
    loadingText: {
      fontSize: 13,
      color: colors.textMuted,
      marginRight: 8,
    },
    emptyText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    doctorRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingVertical: 13,
      paddingHorizontal: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginTop: 10,
      justifyContent: "space-between",
    },
    doctorRowActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
    },
    doctorRowLast: {
      marginBottom: 0,
    },
    doctorRowContent: {
      flex: 1,
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: 6,
    },
    doctorInfo: {
      flex: 1,
      marginHorizontal: 12,
    },
    doctorDetailsButton: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 6,
      backgroundColor: colors.surface,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 16,
      marginLeft: 0,
    },
    doctorName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    doctorRole: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
      marginTop: 2,
    },
    specialtyTag: {
      fontSize: 12,
      color: colors.primary,
      textAlign: "right",
      writingDirection: "rtl",
      marginTop: 2,
    },
    ratingInlineRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    ratingInlineText: {
      fontSize: 12,
      color: colors.text,
      writingDirection: "rtl",
    },
    doctorEmail: {
      fontSize: 12,
      color: colors.textMuted,
      writingDirection: "rtl",
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    primaryButtonText: {
      color: colors.surface,
      fontSize: 16,
      fontWeight: "600",
      writingDirection: "rtl",
    },
  });
