import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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

const EMPTY_MEDICAL_RECORDS_IMAGE = require("../assets/images/منشور سوشيال ميديا Instagram Post عن صيام شهر رمضان المبارك.png");

export default function MedicalRecordsScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewUri, setPreviewUri] = useState("");

  const normalizeUrl = (uri) => {
    if (!uri) return "";
    // allow http/https/data/file/content schemes as-is
    if (/^(https?:|data:|file:|content:)/i.test(uri)) return uri;
    const path = uri.startsWith("/") ? uri : `/${uri}`;
    return `${API_BASE_URL}${path}`;
  };

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

  const medicalRecords = useMemo(() => {
    return records.filter((item) => {
      const hasNote = Boolean(item?.doctorNote);
      const hasRx = Array.isArray(item?.prescriptions) && item.prescriptions.length > 0;
      return hasNote || hasRx;
    });
  }, [records]);

  const renderPrescriptions = (items = []) => {
    if (!items.length) return null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.prescriptionRow}
      >
        {items.map((uri, idx) => {
          const fullUri = normalizeUrl(uri);
          return (
            <View key={`${uri}-${idx}`} style={styles.prescriptionItem}>
              <TouchableOpacity onPress={() => setPreviewUri(fullUri)}>
                <Image source={{ uri: fullUri }} style={styles.prescriptionImage} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-right" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>السجلات الطبية</Text>
        <TouchableOpacity onPress={loadRecords} style={styles.refreshBtn}>
          <Feather name="refresh-ccw" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!error && medicalRecords.length === 0 ? (
            <View style={styles.emptyStateWrap}>
              <Image
                source={EMPTY_MEDICAL_RECORDS_IMAGE}
                style={styles.emptyStateImage}
                resizeMode="contain"
              />
              <Text style={styles.emptyStateText}>لايوجد سجلات طبية مرفوعة حاليا</Text>
            </View>
          ) : null}

          {medicalRecords.map((item) => {
            const hasNote = Boolean(item.doctorNote);
            const hasRx = Array.isArray(item.prescriptions) && item.prescriptions.length > 0;
            return (
              <View key={item._id} style={styles.card}>
                {hasNote ? (
                  <View>
                    <Text style={styles.sectionLabel}>ملاحظة الطبيب</Text>
                    <Text style={styles.sectionText}>{item.doctorNote}</Text>
                  </View>
                ) : null}

                {hasRx ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.sectionLabel}>الوصفة</Text>
                    {renderPrescriptions(item.prescriptions)}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!previewUri} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewBackdrop} onPress={() => setPreviewUri("")} />
          <View style={styles.previewCard}>
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.previewButton} onPress={() => setPreviewUri("")}>
                <Feather name="x" size={18} color={colors.danger} />
                <Text style={[styles.previewButtonText, { color: colors.danger }]}>اغلاق</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, writingDirection: "rtl" },
    header: {
      height: 56,
      backgroundColor: colors.surface,
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    refreshBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    loader: { flex: 1, alignItems: "center", justifyContent: "center" },
    errorText: { textAlign: "center", color: colors.danger, marginTop: 16 },
    emptyStateWrap: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 28,
      marginBottom: 8,
      paddingHorizontal: 16,
    },
    emptyStateImage: {
      width: 220,
      height: 220,
      marginBottom: 10,
    },
    emptyStateText: {
      textAlign: "center",
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: "600",
      writingDirection: "rtl",
    },
    body: { padding: 16, writingDirection: "rtl", alignItems: "stretch" },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      alignItems: "flex-end",
      writingDirection: "rtl",
      width: "100%",
    },
    sectionLabel: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: "right" },
    sectionText: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: 4, textAlign: "right" },
    prescriptionRow: { marginTop: 8, flexDirection: "row-reverse", width: "100%" },
    prescriptionItem: { marginLeft: 10 },
    prescriptionImage: { width: 140, height: 140, borderRadius: 10 },
    previewOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    previewBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    previewCard: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewImage: {
      width: "100%",
      height: 360,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
    },
    previewActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 12,
    },
    previewButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewButtonText: { marginLeft: 8, fontSize: 14, fontWeight: "700" },
  });
