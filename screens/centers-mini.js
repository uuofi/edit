import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  FlatList,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import { useAppTheme } from "../lib/useTheme";
import { API_BASE_URL, fetchCenters } from "../lib/api";
import { useCenter } from "../lib/centerContext";

const GOLD = "#F5B544";

// المسافة بين نقطتين (كم) — صيغة هافرسين
const distanceKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function CentersMiniScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { centerId, setCenter } = useCenter();
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [userCoords, setUserCoords] = useState(null);

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

  // موقع المستخدم لحساب المسافة (اختياري — يتدهور بلطف إذا رُفض)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          const req = await Location.requestForegroundPermissionsAsync();
          status = req.status;
        }
        if (status !== "granted") return;

        const pos =
          (await Location.getLastKnownPositionAsync()) ||
          (await Location.getCurrentPositionAsync({}));
        if (mounted && pos?.coords) {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {
        // تجاهل — نعرض المدينة فقط بدون مسافة
      }
    })();
    return () => {
      mounted = false;
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
    const list = !term
      ? centers
      : centers.filter((center) => {
          const haystack = [center.name, center.location, center.phone]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(term);
        });
    // الأعلى تقييماً أولاً
    return list
      .slice()
      .sort((a, b) => (Number(b?.ratingAverage) || 0) - (Number(a?.ratingAverage) || 0));
  }, [centers, searchTerm]);

  const buildMeta = (center) => {
    const city = String(center?.location || "").trim();
    let distance = "";
    const lat = Number(center?.locationLat);
    const lng = Number(center?.locationLng);
    if (userCoords && Number.isFinite(lat) && Number.isFinite(lng)) {
      const km = distanceKm(userCoords.lat, userCoords.lng, lat, lng);
      if (Number.isFinite(km)) {
        distance = km < 1 ? "أقل من 1 كم" : `${Math.round(km)} كم`;
      }
    }
    return [city, distance].filter(Boolean).join("  •  ");
  };

  const renderCard = ({ item: center }) => {
    const active = String(centerId || "") === String(center._id || "");
    const imageUri = resolveMediaUrl(center.coverUrl || center.logoUrl);
    const meta = buildMeta(center);
    const hasRating = Number(center?.ratingCount) > 0;

    return (
      <TouchableOpacity
        style={[styles.card, active && styles.cardActive]}
        activeOpacity={0.85}
        onPress={() => handleCenterPress(center)}
        accessibilityRole="button"
        accessibilityLabel={center.name || "مركز"}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.imageFallback]}>
            <Feather name="home" size={30} color={colors.primary} />
          </View>
        )}

        <View style={styles.cardInfo}>
          <View style={styles.cardTextTop}>
            <Text style={styles.centerName} numberOfLines={2}>
              {center.name || "مركز"}
            </Text>
            {meta ? (
              <Text style={styles.centerMeta} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>

          <View style={styles.ratingRow}>
            <Feather name="star" size={16} color={GOLD} />
            <Text style={styles.ratingValue}>
              {hasRating ? Number(center.ratingAverage).toFixed(1) : "جديد"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          accessibilityLabel="رجوع"
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>المراكز الطبية</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredCenters}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.searchBox}>
              <Feather name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="ابحث عن مركز"
                placeholderTextColor={colors.textMuted}
                value={searchTerm}
                onChangeText={setSearchTerm}
                textAlign="right"
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Feather name="home" size={26} color={colors.textMuted} />
              <Text style={styles.emptyText}>لا توجد مراكز مطابقة.</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 16 }} />}
        />
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
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      flex: 1,
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
      writingDirection: "rtl",
    },
    loaderWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 6,
    },
    searchBox: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 10,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 50,
      marginBottom: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      writingDirection: "rtl",
      paddingVertical: 0,
    },
    card: {
      flexDirection: "row-reverse",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 14,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: "transparent",
      shadowColor: "#0B1F2A",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 2,
    },
    cardActive: {
      borderColor: colors.primary,
    },
    cardImage: {
      width: 110,
      height: 110,
      borderRadius: 18,
      marginLeft: 16,
      backgroundColor: colors.surfaceAlt,
      resizeMode: "cover",
    },
    imageFallback: {
      alignItems: "center",
      justifyContent: "center",
    },
    cardInfo: {
      flex: 1,
      minHeight: 110,
      justifyContent: "space-between",
      alignItems: "flex-end",
      paddingVertical: 2,
    },
    cardTextTop: {
      alignSelf: "stretch",
    },
    centerName: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      textAlign: "left",
      writingDirection: "rtl",
    },
    centerMeta: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: "left",
      writingDirection: "rtl",
      marginTop: 10,
    },
    ratingRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-end",
    },
    ratingValue: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    emptyWrap: {
      marginTop: 40,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: "600",
      textAlign: "center",
      writingDirection: "rtl",
    },
  });
