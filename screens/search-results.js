import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import DoctorResultCard from "../components/DoctorResultCard";
import { useAllDoctors, filterDoctors } from "../lib/doctorSearch";
import { useAppTheme } from "../lib/useTheme";
import { API_BASE_URL } from "../lib/api";

export const goToDoctorDetails = (navigation, doctor) => {
  if (!doctor) return;
  navigation.navigate("DoctorDetails", {
    doctorId: doctor._id || doctor.id,
    name: doctor.displayName || doctor.name || doctor.user?.name,
    role: doctor.role || "طبيب",
    specialty: doctor.specialtyLabel || doctor.specialty || "",
    location: doctor.location,
    locationLat: doctor.locationLat,
    locationLng: doctor.locationLng,
    avatarUrl: (() => {
      const raw = doctor.avatarUrl || "";
      if (!raw) return "";
      if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
      return `${API_BASE_URL}${raw.startsWith("/") ? "" : "/"}${raw}`;
    })(),
    age: doctor.age || doctor.user?.age,
    description: doctor.bio || doctor.description,
    bio: doctor.bio,
    certification: doctor.certification,
    cv: doctor.cv,
    consultationFee: doctor.consultationFee,
    ratingAverage: doctor.ratingAverage,
    ratingCount: doctor.ratingCount,
    specialtySlug: doctor.specialtySlug,
    phone: doctor.phone || doctor.user?.phone,
    secretaryPhone: doctor.secretaryPhone,
    contactPhone: doctor.contactPhone,
  });
};

export default function SearchResultsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const query = route.params?.query || "";
  const { doctors, loading, error, reload } = useAllDoctors();

  const results = useMemo(
    () => filterDoctors(doctors, query),
    [doctors, query]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="رجوع"
        >
          <Feather name="arrow-right" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>نتائج البحث</Text>
        <View style={styles.backButton} />
      </View>

      {/* صف التصفية / الترتيب */}
      <View style={styles.filterRow}>
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.filterText}>تصفية</Text>
        </TouchableOpacity>
        <Text style={styles.sortText}>ترتيب: الأعلى تقييماً</Text>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => String(item._id || item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <DoctorResultCard
            doctor={item}
            index={index}
            onPress={(doc) => goToDoctorDetails(navigation, doc)}
          />
        )}
        ListHeaderComponent={
          loading && results.length === 0 ? (
            <View style={styles.loaderWrapper}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Feather name="search" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>
                {error || "لا توجد نتائج مطابقة."}
              </Text>
              {error ? (
                <TouchableOpacity onPress={reload} style={styles.retryBtn}>
                  <Text style={styles.retryText}>إعادة المحاولة</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.emptySubText}>جرّب كلمة بحث أخرى.</Text>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 24 }} />}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    filterRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 12,
    },
    filterText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.primary,
    },
    sortText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    loaderWrapper: {
      paddingVertical: 40,
    },
    emptyState: {
      paddingVertical: 56,
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
      textAlign: "center",
    },
    emptySubText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },
  });
