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

export default function CentersMiniScreen() {
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

  const handleCenterPress = async (center) => {
    if (!center?._id) return;
    await setCenter({ id: center._id, name: center.name || "" });
    navigation.navigate("CenterDoctors", {
      centerId: center._id,
      centerName: center.name || "",
    });
  };

  const filteredCenters = useMemo(() => {
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
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Feather name="chevron-right" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>المراكز</Text>
          <Text style={styles.subtitle}>اختر المجمع المناسب لك</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          <View style={styles.searchBox}>
            <View style={styles.searchIconWrap}>
              <Feather name="search" size={16} color={colors.textMuted} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن مركز"
              placeholderTextColor={colors.placeholder}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          {filteredCenters.map((center) => {
            const active = String(centerId || "") === String(center._id || "");
            return (
              <TouchableOpacity
                key={center._id}
                style={[styles.card, active && styles.cardActive]}
                activeOpacity={0.85}
                onPress={() => handleCenterPress(center)}
              >
                <View style={styles.imageWrap}>
                  {center.logoUrl ? (
                    <Image
                      source={{ uri: resolveMediaUrl(center.logoUrl) }}
                      style={styles.centerImage}
                    />
                  ) : (
                    <View style={styles.imageFallback}>
                      <Feather name="home" size={24} color={colors.primary} />
                    </View>
                  )}
                </View>
                <Text style={styles.centerName} numberOfLines={2}>
                  {center.name || "مركز"}
                </Text>
              </TouchableOpacity>
            );
          })}

          {!filteredCenters.length ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>لا توجد نتائج مطابقة.</Text>
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
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTextWrap: {
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
      writingDirection: "rtl",
    },
    subtitle: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
      writingDirection: "rtl",
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    loaderWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    grid: {
      paddingHorizontal: 16,
      paddingBottom: 30,
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
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 11,
      marginBottom: 14,
      backgroundColor: colors.surfaceAlt,
      gap: 8,
    },
    searchIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    card: {
      width: "48%",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 10,
      alignItems: "stretch",
      marginBottom: 14,
      shadowColor: colors.overlay,
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 12,
      elevation: 4,
    },
    cardActive: {
      borderColor: colors.primary,
    },
    imageWrap: {
      width: "100%",
      height: 122,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 12,
      backgroundColor: colors.surfaceAlt,
    },
    centerImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    imageFallback: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
    },
    centerName: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
      writingDirection: "rtl",
      minHeight: 42,
      paddingHorizontal: 2,
      lineHeight: 22,
    },
    emptyWrap: {
      width: "100%",
      marginTop: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 22,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: "center",
      writingDirection: "rtl",
    },
  });