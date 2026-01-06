import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useAppTheme } from "../lib/useTheme";

import {
  fetchMyDoctorServices,
  createMyDoctorService,
  updateMyDoctorService,
} from "../lib/api";

const formatCurrency = (value) => {
  const num = Number(value) || 0;
  try {
    return `${num.toLocaleString("ar-IQ")} د.ع`;
  } catch {
    return `${num} د.ع`;
  }
};

const buildForm = (service) => ({
  name: service?.name ? String(service.name) : "",
  price:
    typeof service?.price === "number"
      ? String(service.price)
      : String(service?.price || ""),
  durationMinutes:
    typeof service?.durationMinutes === "number"
      ? String(service.durationMinutes)
      : String(service?.durationMinutes || ""),
});

export default function ProviderServicesScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(buildForm(null));

  const isEditing = useMemo(() => !!editingId, [editingId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMyDoctorServices();
      setServices(Array.isArray(data?.services) ? data.services : []);
    } catch (err) {
      console.error("Fetch services error:", err);
      const status =
        typeof err?.status === "number" && err.status ? err.status : null;
      const message = err?.message
        ? String(err.message)
        : "تعذّر تحميل الخدمات";
      Alert.alert("خطأ", status ? `[${status}] ${message}` : message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setForm(buildForm(null));
  };

  const validate = () => {
    const name = String(form.name || "").trim();
    const price = Number(form.price);
    const durationMinutes = Number(form.durationMinutes);

    if (!name) return { ok: false, message: "اسم الخدمة مطلوب" };
    if (!Number.isFinite(price) || price < 0)
      return { ok: false, message: "السعر غير صحيح" };
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1)
      return { ok: false, message: "المدة غير صحيحة" };

    return { ok: true, name, price, durationMinutes };
  };

  const handleSave = async () => {
    if (saving) return;
    const v = validate();
    if (!v.ok) {
      Alert.alert("تنبيه", v.message);
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await updateMyDoctorService(editingId, {
          name: v.name,
          price: v.price,
          durationMinutes: v.durationMinutes,
        });
      } else {
        await createMyDoctorService({
          name: v.name,
          price: v.price,
          durationMinutes: v.durationMinutes,
        });
      }

      await load();
      resetForm();
      Alert.alert("تم", isEditing ? "تم تحديث الخدمة" : "تمت إضافة الخدمة");
    } catch (err) {
      console.error("Save service error:", err);
      Alert.alert("فشل", err.message || "تعذّر حفظ الخدمة");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (service) => {
    setEditingId(service?._id || null);
    setForm(buildForm(service));
  };

  const handleToggleActive = async (service) => {
    if (!service?._id) return;
    const next = !service.isActive;

    try {
      await updateMyDoctorService(service._id, { isActive: next });
      setServices((prev) =>
        prev.map((s) => (s._id === service._id ? { ...s, isActive: next } : s))
      );
    } catch (err) {
      console.error("Toggle service error:", err);
      Alert.alert("خطأ", err.message || "تعذّر تحديث حالة الخدمة");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (typeof navigation?.openDrawer === "function") {
              navigation.openDrawer();
              return;
            }
            navigation.goBack();
          }}
          style={styles.backBtn}
        >
          <Feather
            name={
              typeof navigation?.openDrawer === "function"
                ? "menu"
                : "chevron-right"
            }
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة الخدمات</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isEditing ? "تعديل خدمة" : "إضافة خدمة"}
            </Text>

            <Text style={styles.label}>اسم الخدمة / الحالة المرضية</Text>
            <TextInput
              style={styles.input}
              placeholder="مثلاً: استشارة أولية"
              placeholderTextColor={colors.placeholder}
              value={form.name}
              onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
            />

            <View style={styles.splitRow}>
              <View style={styles.flexItem}>
                <Text style={styles.label}>السعر</Text>
                <TextInput
                  style={styles.input}
                  placeholder="45000"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="numeric"
                  value={form.price}
                  onChangeText={(v) => setForm((p) => ({ ...p, price: v }))}
                />
              </View>
              <View style={styles.flexItem}>
                <Text style={styles.label}>المدة (دقيقة)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="20"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="numeric"
                  value={form.durationMinutes}
                  onChangeText={(v) =>
                    setForm((p) => ({ ...p, durationMinutes: v }))
                  }
                />
              </View>
            </View>

            <View style={styles.actionRow}>
              {isEditing ? (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={resetForm}
                  disabled={saving}
                >
                  <Text style={styles.secondaryText}>إلغاء</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Text style={styles.primaryText}>
                    {isEditing ? "حفظ" : "إضافة"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>قائمة الخدمات</Text>
            <TouchableOpacity onPress={load} style={styles.refreshBtn}>
              <Feather name="refresh-ccw" size={16} color={colors.primary} />
              <Text style={styles.refreshText}>تحديث</Text>
            </TouchableOpacity>
          </View>

          {services.length === 0 ? (
            <Text style={styles.emptyText}>ماكو خدمات مضافة حالياً.</Text>
          ) : (
            services.map((svc) => {
              const active = !!svc.isActive;
              return (
                <View key={svc._id} style={styles.serviceCard}>
                  <View style={styles.serviceTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.serviceName}>{svc.name}</Text>
                      <Text style={styles.serviceMeta}>
                        {formatCurrency(svc.price)} • {svc.durationMinutes}{" "}
                        دقيقة
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.statusBadge,
                        active ? styles.badgeOn : styles.badgeOff,
                      ]}
                      onPress={() => handleToggleActive(svc)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          active ? styles.badgeTextOn : styles.badgeTextOff,
                        ]}
                      >
                        {active ? "مفعّلة" : "موقوفة"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.serviceActions}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => handleEdit(svc)}
                    >
                      <Feather name="edit-2" size={16} color={colors.primary} />
                      <Text style={styles.editText}>تعديل</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background, writingDirection: "rtl" },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 44,
      height: 44,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    content: { padding: 20, paddingBottom: 24 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
      textAlign: "right",
    },
    label: {
      marginTop: 12,
      fontSize: 13,
      color: colors.text,
      fontWeight: "600",
      textAlign: "right",
    },
    input: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    splitRow: { flexDirection: "row-reverse", gap: 10 },
    flexItem: { flex: 1 },

    actionRow: {
      marginTop: 14,
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 120,
    },
    primaryBtnDisabled: { opacity: 0.7 },
    primaryText: { color: colors.surface, fontWeight: "800" },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 120,
    },
    secondaryText: { color: colors.primary, fontWeight: "800" },

    listHeader: {
      marginTop: 18,
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
    },
    listTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
    refreshBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
    refreshText: { color: colors.primary, fontWeight: "700" },

    emptyText: { marginTop: 12, color: colors.textMuted, textAlign: "right" },

    serviceCard: {
      marginTop: 12,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    serviceTop: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
    },
    serviceName: {
      fontSize: 14,
      fontWeight: "900",
      color: colors.text,
      textAlign: "right",
    },
    serviceMeta: {
      marginTop: 6,
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
    },

    statusBadge: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgeOn: { backgroundColor: colors.surface, borderColor: colors.success },
    badgeOff: { backgroundColor: colors.surface, borderColor: colors.danger },
    badgeText: { fontSize: 12, fontWeight: "800" },
    badgeTextOn: { color: colors.success },
    badgeTextOff: { color: colors.danger },

    serviceActions: { marginTop: 12, flexDirection: "row-reverse" },
    editBtn: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    editText: { color: colors.primary, fontWeight: "800" },
  });
