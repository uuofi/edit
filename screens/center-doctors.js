import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { API_BASE_URL, fetchCenterById, fetchCenterDoctors } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";
import { useCenter } from "../lib/centerContext";
import cleanArabicText from "../lib/cleanArabicText";

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

export default function CenterDoctorsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { centerId: storedCenterId, centerName: storedCenterName } = useCenter();

  const params = route.params || {};
  const centerId = params.centerId || storedCenterId || null;
  const centerName = params.centerName || storedCenterName || "";

  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [centerDetails, setCenterDetails] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDoctorIndex, setSelectedDoctorIndex] = useState(0);

  const resolveMediaUrl = (value) => {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return "";
    if (raw.startsWith("data:") || raw.startsWith("file:")) return raw;
    const normalized = raw.replace(/\\/g, "/");
    if (normalized.startsWith("http://") || normalized.startsWith("https://")) return normalized;
    const prefix = normalized.startsWith("/") ? "" : "/";
    return `${API_BASE_URL}${prefix}${normalized}`;
  };

  const getDoctorAvatarUrl = (doctor) => {
    if (!doctor || typeof doctor !== "object") return "";
    return (
      doctor.avatarUrl ||
      doctor.avatar ||
      doctor.imageUrl ||
      doctor.profileAvatarUrl ||
      doctor.doctorProfile?.avatarUrl ||
      doctor.profile?.avatarUrl ||
      doctor.user?.avatarUrl ||
      ""
    );
  };

  useEffect(() => {
    let active = true;
    if (!centerId) {
      setDoctors([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    Promise.all([fetchCenterDoctors(centerId), fetchCenterById(centerId)])
      .then(([doctorsData, centerData]) => {
        if (!active) return;
        setDoctors(Array.isArray(doctorsData?.doctors) ? doctorsData.doctors : []);
        setCenterDetails(centerData?.center || null);
      })
      .catch(() => {
        if (active) {
          setDoctors([]);
          setCenterDetails(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [centerId]);

  const normalizedTerm = searchTerm.trim().toLowerCase();
  const visibleDoctors = (normalizedTerm
    ? doctors.filter((doc) => {
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
    : doctors
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
  }, [visibleDoctors.length, searchTerm]);

  const handleBookPress = () => {
    if (!selectedDoctor) {
      Alert.alert("تعذر الحجز", "يرجى اختيار طبيب أولاً.");
      return;
    }

    const doctorId = String(selectedDoctor.id || selectedDoctor._id || "");
    const doctorCenterId = selectedDoctor.doctorCenterId || null;
    const isValidObjectId = /^[a-fA-F0-9]{24}$/.test(doctorId);
    if (!isValidObjectId) {
      Alert.alert("تعذر الحجز", "بيانات الطبيب غير مكتملة حالياً.");
      return;
    }

    navigation.navigate("BookAppointment", {
      doctorName: cleanArabicText(selectedDoctor.displayName || selectedDoctor.name),
      doctorRole: selectedDoctor.role || "طبيب",
      specialty: selectedDoctor.specialtyLabel || "",
      specialtySlug: selectedDoctor.specialtySlug || "",
      doctorId,
      medicalCenterId: centerId,
      doctorCenterId,
      avatarUrl: resolveMediaUrl(getDoctorAvatarUrl(selectedDoctor)),
      location: selectedDoctor.location,
      locationLat: selectedDoctor.locationLat,
      locationLng: selectedDoctor.locationLng,
      schedule: selectedDoctor.schedule,
    });
  };

  const handleDoctorPress = (doctor) => {
    if (!doctor) return;
    navigation.navigate("DoctorDetails", {
      doctorId: doctor.id || doctor._id,
      name: cleanArabicText(doctor.displayName || doctor.name || doctor.doctorName),
      role: doctor.role || "طبيب",
      specialty: doctor.specialtyLabel || doctor.specialty || "",
      location: doctor.location,
      locationLat: doctor.locationLat,
      locationLng: doctor.locationLng,
      avatarUrl: resolveMediaUrl(getDoctorAvatarUrl(doctor)),
      age: doctor.age,
      description: doctor.bio || doctor.description,
      bio: doctor.bio,
      certification: doctor.certification,
      cv: doctor.cv,
      consultationFee: doctor.consultationFee,
      ratingAverage: doctor.ratingAverage,
      ratingCount: doctor.ratingCount,
      specialtySlug: doctor.specialtySlug,
      phone: doctor.phone,
      secretaryPhone: doctor.secretaryPhone,
      contactPhone: doctor.contactPhone,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Feather name="chevron-right" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{centerName || centerDetails?.name || "الأطباء"}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.heroWrap}>
          {centerDetails?.coverUrl ? (
            <Image
              source={{ uri: resolveMediaUrl(centerDetails.coverUrl) }}
              style={styles.coverImage}
            />
          ) : (
            <View style={styles.coverFallback} />
          )}
          <View style={styles.coverOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{centerDetails?.name || centerName || ""}</Text>
            <Text style={styles.heroSubtitle}>أطباء مختارون حسب تخصصات المركز.</Text>
          </View>
        </View>

        <View style={styles.centerCard}>
          <View style={styles.centerBadgeRow}>
            <View style={styles.centerBadge}>
              <Feather name="map-pin" size={14} color={colors.primary} />
              <Text style={styles.centerBadgeText}>{centerDetails?.location || "—"}</Text>
            </View>
            <View style={styles.centerBadge}>
              <Feather name="phone" size={14} color={colors.primary} />
              <Text style={styles.centerBadgeText}>{centerDetails?.phone || "—"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchBoxOuter}>
          <View style={styles.searchIconWrap}>
            <Feather name="search" size={16} color={colors.primary} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن طبيب داخل المجمع"
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor={colors.placeholder}
          />
        </View>
        <Text style={styles.searchHint}>البحث بالاسم، الاختصاص، رقم الترخيص أو الهاتف</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الأطباء</Text>

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>جاري تحميل الأطباء...</Text>
            </View>
          )}

          {!loading && visibleDoctors.length === 0 && (
            <Text style={styles.emptyText}>لا توجد نتائج مطابقة.</Text>
          )}

          {!loading &&
            visibleDoctors.map((doctor, index) => {
              const isActive = index === normalizedIndex;
              return (
                <TouchableOpacity
                  key={doctor.doctorCenterId || doctor.id || index}
                  style={[
                    styles.doctorRow,
                    isActive && styles.doctorRowActive,
                    index === visibleDoctors.length - 1 && styles.doctorRowLast,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedDoctorIndex(index)}
                >
                  {getDoctorAvatarUrl(doctor) ? (
                    <Image
                      source={{ uri: resolveMediaUrl(getDoctorAvatarUrl(doctor)) }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={styles.avatar} />
                  )}

                  <View style={styles.doctorRowContent}>
                    <View style={styles.doctorInfo}>
                      <View style={styles.doctorHeaderLine}>
                        <Text style={styles.doctorName}>
                          {cleanArabicText(doctor.displayName || doctor.name || "الطبيب")}
                        </Text>
                        {index === 0 && Number(doctor?.ratingCount) > 0 ? (
                          <View style={styles.topRatedBadge}>
                            <Feather name="award" size={11} color={colors.warning} />
                            <Text style={styles.topRatedBadgeText}>الأعلى تقييماً</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.metaChipsRow}>
                        {doctor.specialtyLabel ? (
                          <View style={styles.metaChip}>
                            <Text style={styles.metaChipText}>اختصاص {doctor.specialtyLabel}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.ratingInlineRow}>
                        <Feather name="star" size={13} color={colors.primary} />
                        <Text style={styles.ratingInlineText}>
                          {Number(doctor?.ratingCount) > 0
                            ? `${Number(doctor?.ratingAverage || 0).toFixed(1)} (${Number(doctor?.ratingCount)} تقييم)`
                            : "بدون تقييم"}
                        </Text>
                      </View>

                      <View style={styles.contactRow}>
                        <Feather name="phone" size={12} color={colors.textMuted} />
                        <Text style={styles.doctorEmail}>
                          {doctor.phone || doctor.secretaryPhone || "لا يوجد رقم"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.doctorActionsCol}>
                      <View
                        style={[
                          styles.availabilityBadge,
                          doctor?.isAcceptingBookings === false
                            ? styles.availabilityBadgeOff
                            : styles.availabilityBadgeOn,
                        ]}
                      >
                        <Text
                          style={[
                            styles.availabilityBadgeText,
                            doctor?.isAcceptingBookings === false
                              ? styles.availabilityBadgeTextOff
                              : styles.availabilityBadgeTextOn,
                          ]}
                        >
                          {doctor?.isAcceptingBookings === false ? "غير متاح" : "متاح"}
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
                  </View>
                </TouchableOpacity>
              );
            })}
        </View>
      </ScrollView>

      <View style={styles.bottomActionWrap}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleBookPress}>
          <Text style={styles.primaryButtonText}>احجز الموعد</Text>
        </TouchableOpacity>
      </View>
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
      paddingBottom: 120,
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
    heroWrap: {
      marginTop: 8,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    coverImage: {
      width: "100%",
      height: 180,
    },
    coverFallback: {
      width: "100%",
      height: 180,
      backgroundColor: colors.surfaceAlt,
    },
    coverOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    heroContent: {
      position: "absolute",
      bottom: 16,
      left: 16,
      right: 16,
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: "#fff",
      textAlign: "right",
      writingDirection: "rtl",
    },
    heroSubtitle: {
      marginTop: 4,
      fontSize: 12,
      color: "rgba(255,255,255,0.8)",
      textAlign: "right",
      writingDirection: "rtl",
    },
    centerCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 12,
      marginBottom: 12,
    },
    centerBadgeRow: {
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      gap: 8,
    },
    centerBadge: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    centerBadgeText: {
      fontSize: 12,
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    searchBoxOuter: {
      flexDirection: "row-reverse",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 10,
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
      marginBottom: 10,
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
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
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
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginTop: 10,
      justifyContent: "space-between",
      shadowColor: colors.overlay,
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 6,
      elevation: 2,
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
    doctorInfo: {
      flex: 1,
      marginHorizontal: 12,
    },
    doctorHeaderLine: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    doctorName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
      flexShrink: 1,
    },
    topRatedBadge: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.surface,
    },
    topRatedBadgeText: {
      fontSize: 10,
      color: colors.warning,
      fontWeight: "800",
      writingDirection: "rtl",
    },
    metaChipsRow: {
      marginTop: 6,
      flexDirection: "row-reverse",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },
    metaChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.surfaceAlt,
    },
    metaChipText: {
      fontSize: 10,
      color: colors.textMuted,
      writingDirection: "rtl",
    },
    ratingInlineRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 4,
      marginTop: 7,
    },
    ratingInlineText: {
      fontSize: 12,
      color: colors.text,
      writingDirection: "rtl",
    },
    contactRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 4,
      marginTop: 6,
    },
    doctorEmail: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    doctorActionsCol: {
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginLeft: 4,
    },
    availabilityBadge: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
    },
    availabilityBadgeOn: {
      borderColor: colors.success,
      backgroundColor: colors.surface,
    },
    availabilityBadgeOff: {
      borderColor: colors.danger,
      backgroundColor: colors.surface,
    },
    availabilityBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      writingDirection: "rtl",
    },
    availabilityBadgeTextOn: {
      color: colors.success,
    },
    availabilityBadgeTextOff: {
      color: colors.danger,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 18,
      backgroundColor: colors.surfaceAlt,
    },
    avatarImage: {
      width: 60,
      height: 60,
      borderRadius: 18,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
    },
    bottomActionWrap: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 14,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    primaryButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
  });
