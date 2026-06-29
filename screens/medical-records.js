import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { fetchPatientMedicalRecords, ApiError, logout, API_BASE_URL } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

// فلاتر السجلات — مطابقة للتصميم (الترتيب RTL: الكل على اليمين)
const FILTERS = [
  { key: "all", label: "الكل" },
  { key: "labs", label: "التحاليل" },
  { key: "radiology", label: "الأشعة" },
  { key: "reports", label: "التقارير" },
];

// نزيل اسم اليوم من التاريخ ("الأحد، 12 مارس 2024" → "12 مارس 2024")
const cleanDate = (value) => {
  const v = String(value || "").trim();
  if (!v) return "";
  const parts = v.split("،");
  return (parts.length > 1 ? parts.slice(1).join("،") : v).trim();
};

export default function MedicalRecordsScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [preview, setPreview] = useState(null); // { kind, uri?, note?, title? }

  const normalizeUrl = useCallback((uri) => {
    if (!uri) return "";
    if (/^(https?:|data:|file:|content:)/i.test(uri)) return uri;
    const path = uri.startsWith("/") ? uri : `/${uri}`;
    return `${API_BASE_URL}${path}`;
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPatientMedicalRecords();
      const list = Array.isArray(data.records) ? data.records : [];
      setRecords(list);
      setError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        Alert.alert("تسجيل الدخول مطلوب", "سجّل دخولك حتى تستطيع مشاهدة السجلات الطبية.", [
          { text: "إلغاء", style: "cancel" },
          {
            text: "تسجيل الدخول",
            onPress: () => logout().finally(() => navigation.replace("Login")),
          },
        ]);
        setError("تسجيل الدخول مطلوب");
        return;
      }
      setError(err.message || "تعذّر تحميل السجلات");
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords])
  );

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // نسطّح السجلات إلى عناصر مفردة (ملاحظة / تقرير أشعة / تحليل) — كل عنصر بطاقة
  const items = useMemo(() => {
    const out = [];
    for (const rec of records) {
      const date = cleanDate(rec.appointmentDate);
      const specialty = String(rec.specialty || "").trim();

      if (rec.doctorNote) {
        out.push({
          id: `${rec._id}:note`,
          type: "reports",
          title: specialty ? `تقرير زيارة — ${specialty}` : "تقرير زيارة",
          date,
          kind: "note",
          note: rec.doctorNote,
        });
      }
      (Array.isArray(rec.reports) ? rec.reports : []).forEach((uri, i) => {
        out.push({
          id: `${rec._id}:rep:${i}`,
          type: "radiology",
          title: "تقرير أشعة",
          date,
          kind: "image",
          uri: normalizeUrl(uri),
        });
      });
      (Array.isArray(rec.prescriptions) ? rec.prescriptions : []).forEach((uri, i) => {
        out.push({
          id: `${rec._id}:rx:${i}`,
          type: "labs",
          title: "تحاليل / وصفة طبية",
          date,
          kind: "image",
          uri: normalizeUrl(uri),
        });
      });
    }
    return out;
  }, [records, normalizeUrl]);

  const visibleItems = useMemo(() => {
    if (activeFilter === "all") return items;
    return items.filter((it) => it.type === activeFilter);
  }, [items, activeFilter]);

  const openItem = (item) => {
    if (item.kind === "image") {
      setPreview({ kind: "image", uri: item.uri, title: item.title });
    } else {
      setPreview({ kind: "note", note: item.note, title: item.title });
    }
  };

  const renderCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => openItem(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${item.date ? "، " + item.date : ""}`}
    >
      <View style={styles.cardIcon}>
        <Feather name="file-text" size={26} color={colors.primary} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.date ? (
          <View style={styles.cardDateRow}>
            <Feather name="calendar" size={15} color={colors.primary} />
            <Text style={styles.cardDate}>{item.date}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* Header — زر رجوع يسار، العنوان بالوسط */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          accessibilityLabel="رجوع"
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجلاتي الطبية</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* صف الفلاتر */}
      <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {FILTERS.map((f) => {
            const active = f.key === activeFilter;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.8}
                onPress={() => setActiveFilter(f.key)}
                accessibilityRole="button"
                accessibilityState={active ? { selected: true } : {}}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={renderCard}
          ListHeaderComponent={
            error ? <Text style={styles.errorText}>{error}</Text> : null
          }
          ListEmptyComponent={
            !error ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Feather name="folder" size={28} color={colors.primary} />
                </View>
                <Text style={styles.emptyText}>
                  {activeFilter === "all"
                    ? "لا توجد سجلات طبية حالياً."
                    : "لا توجد سجلات في هذا التصنيف."}
                </Text>
                <Text style={styles.emptySubText}>
                  ستظهر هنا تقاريرك وتحاليلك بعد كل زيارة.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={<View style={{ height: 16 }} />}
        />
      )}

      {/* المعاينة (صورة أو ملاحظة نصية) */}
      <Modal visible={!!preview} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewBackdrop}
            onPress={() => setPreview(null)}
          />
          <View style={styles.previewCard}>
            {preview?.title ? (
              <Text style={styles.previewTitle}>{preview.title}</Text>
            ) : null}
            {preview?.kind === "image" ? (
              <Image
                source={{ uri: preview.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : (
              <ScrollView style={styles.previewNoteScroll}>
                <Text style={styles.previewNote}>{preview?.note}</Text>
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.previewButton}
              onPress={() => setPreview(null)}
            >
              <Feather name="x" size={18} color={colors.danger} />
              <Text style={[styles.previewButtonText, { color: colors.danger }]}>
                إغلاق
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
    },
    iconBtn: {
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
    filtersWrap: {
      marginBottom: 8,
    },
    filtersRow: {
      flexDirection: "row-reverse",
      paddingHorizontal: 20,
      gap: 10,
    },
    chip: {
      paddingHorizontal: 22,
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    chipActive: {
      backgroundColor: colors.primary,
    },
    chipText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textMuted,
    },
    chipTextActive: {
      color: "#FFFFFF",
    },
    loader: { flex: 1, alignItems: "center", justifyContent: "center" },
    errorText: {
      textAlign: "center",
      color: colors.danger,
      marginBottom: 12,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    card: {
      flexDirection: "row-reverse",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 18,
      marginBottom: 18,
      shadowColor: "#0B1F2A",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 2,
    },
    cardIcon: {
      width: 64,
      height: 64,
      borderRadius: 18,
      backgroundColor: colors.primary + "14",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 16,
    },
    cardInfo: {
      flex: 1,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    cardTitle: {
      fontSize: 19,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
      alignSelf: "stretch",
    },
    cardDateRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 7,
      marginTop: 12,
    },
    cardDate: {
      fontSize: 15,
      color: colors.textMuted,
    },
    emptyState: {
      paddingVertical: 56,
      alignItems: "center",
    },
    emptyIcon: {
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
      textAlign: "center",
    },
    previewOverlay: {
      flex: 1,
      backgroundColor: colors.overlay || "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    previewBackdrop: { ...StyleSheet.absoluteFillObject },
    previewCard: {
      width: "100%",
      maxWidth: 440,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
    },
    previewTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
      marginBottom: 12,
    },
    previewImage: {
      width: "100%",
      height: 380,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
    },
    previewNoteScroll: {
      maxHeight: 320,
    },
    previewNote: {
      fontSize: 15,
      lineHeight: 24,
      color: colors.text,
      textAlign: "right",
    },
    previewButton: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      marginTop: 14,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
    },
    previewButtonText: { fontSize: 15, fontWeight: "700" },
  });
