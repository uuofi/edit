import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../lib/useTheme";
import { API_BASE_URL, fetchCenters } from "../lib/api";
import { useCenter } from "../lib/centerContext";

export default function CenterSelectorScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { centerId, setCenter } = useCenter();
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const resolveMediaUrl = (value) => {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    const prefix = raw.startsWith("/") ? "" : "/";
    return `${API_BASE_URL}${prefix}${raw}`;
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCenters()
      .then((data) => {
        if (!active) return;
        setCenters(Array.isArray(data?.centers) ? data.centers : []);
      })
      .catch(() => {
        if (active) setCenters([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSelect = async (center) => {
    if (!center?._id) return;
    await setCenter({ id: center._id, name: center.name || "" });
    navigation.navigate("CenterDoctors", {
      centerId: center._id,
      centerName: center.name || "",
    });
  };

  const visibleCenters = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return centers;
    return centers.filter((center) => {
      const haystack = [center.name, center.location, center.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [centers, searchTerm]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="chevron-right" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.backLabel}>رجوع</Text>
        </View>
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroTitle}>المراكز الطبية</Text>
          <Text style={styles.heroSubtitle}>اختر المركز المناسب وتابع التفاصيل.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.searchBox}>
            <Feather name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن مركز"
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          {visibleCenters.map((center) => {
            const isActive = String(centerId || "") === String(center._id || "");
            return (
              <TouchableOpacity
                key={center._id}
                style={[styles.card, isActive && styles.cardActive]}
                onPress={() => handleSelect(center)}
                activeOpacity={0.8}
              >
                <View style={styles.logoWrap}>
                  {center.logoUrl ? (
                    <Image
                      source={{ uri: resolveMediaUrl(center.logoUrl) }}
                      style={styles.logo}
                    />
                  ) : (
                    <View style={styles.logoPlaceholder} />
                  )}
                  {isActive ? (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>محدد</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.centerName} numberOfLines={2}>
                    {center.name}
                  </Text>
                  <Text style={styles.centerMeta} numberOfLines={1}>
                    {center.location || "موقع غير محدد"}
                  </Text>
                  <Text style={styles.centerMeta} numberOfLines={1}>
                    {center.phone || "لا يوجد هاتف"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {!visibleCenters.length ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>لا توجد نتائج.</Text>
              <Text style={styles.emptyText}>جرّب كلمة بحث مختلفة أو عد لاحقاً.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 10,
    },
    navRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      marginBottom: 8,
      gap: 6,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    backLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    heroCard: {
      borderRadius: 22,
      padding: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    heroGlow: {
      position: "absolute",
      top: -40,
      right: -20,
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: colors.primary,
      opacity: 0.15,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    heroSubtitle: {
      marginTop: 4,
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    loader: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    list: {
      paddingHorizontal: 16,
      paddingBottom: 28,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "flex-start",
      flexGrow: 1,
    },
    searchBox: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 14,
      backgroundColor: colors.surfaceAlt,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    card: {
      width: "48%",
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 12,
      shadowColor: colors.overlay,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 3,
    },
    cardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceAlt,
    },
    logoWrap: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    logo: {
      width: 84,
      height: 84,
      borderRadius: 42,
    },
    logoPlaceholder: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: colors.surfaceAlt,
    },
    activeBadge: {
      position: "absolute",
      bottom: -6,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    activeBadgeText: {
      color: colors.surface,
      fontSize: 10,
      fontWeight: "700",
    },
    cardInfo: {
      alignItems: "center",
    },
    centerName: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
      writingDirection: "rtl",
    },
    centerMeta: {
      marginTop: 4,
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "center",
      writingDirection: "rtl",
    },
    emptyCard: {
      width: "100%",
      borderRadius: 16,
      padding: 16,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 6,
    },
  });
