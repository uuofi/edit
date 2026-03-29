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
  fetchMyDoctorCenters,
  fetchMyCenterDoctorServices,
  createMyCenterDoctorService,
  updateMyCenterDoctorService,
  fetchMyDoctorServices,
  createMyDoctorService,
  updateMyDoctorService,
  fetchDoctorDashboard,
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
  discountPercent:
    typeof service?.discountPercent === "number"
      ? String(service.discountPercent)
      : String(service?.discountPercent || "0"),
});

const clampDiscountPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(Math.max(num, 0), 100);
};

const calculateDiscountedPrice = (price, discountPercent) => {
  const base = Number(price) || 0;
  const pct = clampDiscountPercent(discountPercent);
  if (base <= 0 || pct <= 0) return base;
  return Math.max(0, Math.round(base - (base * pct) / 100));
};

    const isValidObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

export default function ProviderServicesScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [saving, setSaving] = useState(false);
  const [centers, setCenters] = useState([]);
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [services, setServices] = useState([]);
  const [profileScheduleDuration, setProfileScheduleDuration] = useState(20);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(buildForm(null));
  const [discountEnabled, setDiscountEnabled] = useState(false);

  const hasCenters = centers.length > 0;
  const isEditing = useMemo(() => !!editingId, [editingId]);
  const selectedCenterDuration = useMemo(() => {
    if (!hasCenters) return profileScheduleDuration;
    const selectedCenter = centers.find(
      (center) => String(center.medicalCenterId) === String(selectedCenterId)
    );
    const parsedDuration = Number(selectedCenter?.schedule?.duration);
    return Number.isFinite(parsedDuration) && parsedDuration > 0
      ? Math.min(Math.max(Math.floor(parsedDuration), 1), 480)
      : profileScheduleDuration;
  }, [centers, selectedCenterId, hasCenters, profileScheduleDuration]);

  const serviceStats = useMemo(() => {
    const total = services.length;
    const active = services.filter((service) => !!service.isActive).length;
    const inactive = Math.max(0, total - active);
    return { total, active, inactive };
  }, [services]);

  const loadCenters = useCallback(async () => {
    setLoadingCenters(true);
    try {
      const [centersData, dashData] = await Promise.all([
        fetchMyDoctorCenters(),
        fetchDoctorDashboard(),
      ]);

      // Store profile-level schedule duration as fallback
      const profDur = Number(dashData?.doctor?.schedule?.duration);
      if (Number.isFinite(profDur) && profDur > 0) {
        setProfileScheduleDuration(Math.min(Math.max(Math.floor(profDur), 1), 480));
      }

      const list = Array.isArray(centersData?.centers) ? centersData.centers : [];
      const validList = list.filter((center) =>
        isValidObjectId(center?.medicalCenterId)
      );
      setCenters(validList);
      if (!validList.length) {
        setSelectedCenterId("");
        return;
      }

      setSelectedCenterId((prev) => {
        const exists = validList.some(
          (center) => String(center.medicalCenterId) === String(prev)
        );
        return exists ? prev : String(validList[0].medicalCenterId || "");
      });
    } catch (err) {
      console.error("Fetch centers error:", err);
      const message = err?.message
        ? String(err.message)
        : "تعذّر تحميل البيانات";
      Alert.alert("خطأ", message);
    } finally {
      setLoadingCenters(false);
    }
  }, []);

  const load = useCallback(async () => {
    // If has centers but none selected yet, wait
    if (hasCenters && !selectedCenterId) {
      setServices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (hasCenters && !isValidObjectId(selectedCenterId)) {
        setServices([]);
        Alert.alert("خطأ", "معرّف المركز غير صالح، اختر مركزاً صحيحاً.");
        return;
      }

      const data = hasCenters
        ? await fetchMyCenterDoctorServices(selectedCenterId)
        : await fetchMyDoctorServices();
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
  }, [selectedCenterId, hasCenters]);

  useEffect(() => {
    loadCenters();
  }, [loadCenters]);

  useEffect(() => {
    load();
    resetForm();
  }, [load, selectedCenterId]);

  const resetForm = () => {
    setEditingId(null);
    setDiscountEnabled(false);
    setForm(buildForm(null));
  };

  const validate = () => {
    const name = String(form.name || "").trim();
    const price = Number(form.price);
    const durationMinutes = selectedCenterDuration;
    const discountPercent = discountEnabled
      ? clampDiscountPercent(form.discountPercent)
      : 0;

    if (!name) return { ok: false, message: "اسم الخدمة مطلوب" };
    if (!Number.isFinite(price) || price < 0)
      return { ok: false, message: "السعر غير صحيح" };
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1)
      return { ok: false, message: "المدة غير صحيحة" };

    return { ok: true, name, price, durationMinutes, discountPercent };
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
      if (hasCenters && !isValidObjectId(selectedCenterId)) {
        Alert.alert("خطأ", "معرّف المركز غير صالح، اختر مركزاً صحيحاً.");
        return;
      }

      const payload = {
        name: v.name,
        price: v.price,
        durationMinutes: v.durationMinutes,
        discountPercent: v.discountPercent,
      };

      if (hasCenters) {
        if (isEditing) {
          await updateMyCenterDoctorService(selectedCenterId, editingId, payload);
        } else {
          await createMyCenterDoctorService(selectedCenterId, payload);
        }
      } else {
        if (isEditing) {
          await updateMyDoctorService(editingId, payload);
        } else {
          await createMyDoctorService(payload);
        }
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
    setDiscountEnabled(clampDiscountPercent(service?.discountPercent) > 0);
    setForm(buildForm(service));
  };

  const handleServiceStopToggle = (service) => {
    if (!service?._id) return;
    const active = !!service.isActive;
    if (active) {
      Alert.alert("إيقاف الخدمة", "عند الإيقاف لن تظهر الخدمة للمريض.", [
        { text: "إلغاء", style: "cancel" },
        { text: "إيقاف", style: "destructive", onPress: () => handleToggleActive(service) },
      ]);
      return;
    }
    handleToggleActive(service);
  };

  const handleToggleActive = async (service) => {
    if (!service?._id) return;
    if (hasCenters && !selectedCenterId) return;
    if (hasCenters && !isValidObjectId(selectedCenterId)) {
      Alert.alert("خطأ", "معرّف المركز غير صالح، اختر مركزاً صحيحاً.");
      return;
    }
    const next = !service.isActive;

    try {
      if (hasCenters) {
        await updateMyCenterDoctorService(selectedCenterId, service._id, {
          isActive: next,
        });
      } else {
        await updateMyDoctorService(service._id, { isActive: next });
      }
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

      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Feather name="clipboard" size={18} color={colors.primary} />
          </View>
          <Text style={styles.heroSubtitle}>{hasCenters ? "تنظيم الخدمات والتسعير لكل مركز طبي" : "تنظيم الخدمات والتسعير"}</Text>
        </View>
        <Text style={styles.heroTitle}>لوحة خدمات الطبيب</Text>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>إجمالي الخدمات</Text>
            <Text style={styles.heroStatValue}>{serviceStats.total}</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>المفعّلة</Text>
            <Text style={[styles.heroStatValue, { color: colors.success }]}>{serviceStats.active}</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>الموقوفة</Text>
            <Text style={[styles.heroStatValue, { color: colors.danger }]}>{serviceStats.inactive}</Text>
          </View>
        </View>
      </View>

      {hasCenters ? (
        <View style={styles.centersSection}>
          <Text style={styles.centersLabel}>اختر المركز الطبي</Text>
          {loadingCenters ? null : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.centerChipsRow}
            >
              {centers.map((center) => {
                const isActive =
                  String(center.medicalCenterId) === String(selectedCenterId);
                return (
                  <TouchableOpacity
                    key={String(center.doctorCenterId || center.medicalCenterId)}
                    style={[
                      styles.centerChip,
                      isActive ? styles.centerChipActive : styles.centerChipInactive,
                    ]}
                    onPress={() =>
                      setSelectedCenterId(String(center.medicalCenterId || ""))
                    }
                  >
                    <Text
                      style={[
                        styles.centerChipText,
                        isActive
                          ? styles.centerChipTextActive
                          : styles.centerChipTextInactive,
                      ]}
                      numberOfLines={1}
                    >
                      {center.name || "مركز"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}

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
            {hasCenters && !!selectedCenterId ? (
              <Text style={styles.centerHint}>
                سيتم حفظ الخدمة للمركز المحدد فقط.
              </Text>
            ) : null}

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
                <View style={[styles.input, styles.durationReadOnly]}>
                  <Text style={styles.durationReadOnlyText}>{selectedCenterDuration} دقيقة</Text>
                </View>
                <Text style={styles.durationHint}>محدد من الجدول تلقائياً</Text>
              </View>
            </View>

            <View style={styles.discountToggleRow}>
              <Text style={styles.label}>تفعيل الخصم</Text>
              <TouchableOpacity
                style={[
                  styles.discountToggleBtn,
                  discountEnabled ? styles.discountToggleBtnOn : styles.discountToggleBtnOff,
                ]}
                onPress={() => {
                  setDiscountEnabled((prev) => {
                    const next = !prev;
                    if (!next) {
                      setForm((p) => ({ ...p, discountPercent: "0" }));
                    }
                    return next;
                  });
                }}
              >
                <Text
                  style={[
                    styles.discountToggleText,
                    discountEnabled ? styles.discountToggleTextOn : styles.discountToggleTextOff,
                  ]}
                >
                  {discountEnabled ? "مفعّل" : "غير مفعّل"}
                </Text>
              </TouchableOpacity>
            </View>

            {discountEnabled ? (
              <>
                <Text style={styles.label}>نسبة الخصم (%)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="numeric"
                  value={form.discountPercent}
                  onChangeText={(v) => setForm((p) => ({ ...p, discountPercent: v }))}
                />

                <Text style={styles.discountPreviewText}>
                  السعر بعد الخصم: {formatCurrency(calculateDiscountedPrice(form.price, form.discountPercent))}
                </Text>
              </>
            ) : null}

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
                disabled={saving || (hasCenters && !selectedCenterId)}
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
                        {svc?.discountPercent > 0 ? (
                          `${formatCurrency(svc.discountedPrice ?? calculateDiscountedPrice(svc.price, svc.discountPercent))} • ${svc.durationMinutes} دقيقة`
                        ) : (
                          `${formatCurrency(svc.price)} • ${svc.durationMinutes} دقيقة`
                        )}
                      </Text>
                      {svc?.discountPercent > 0 ? (
                        <View style={styles.discountLineWrap}>
                          <Text style={styles.oldPriceText}>{formatCurrency(svc.price)}</Text>
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountBadgeText}>خصم {Math.round(Number(svc.discountPercent) || 0)}%</Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.statusBadge,
                        active ? styles.badgeOn : styles.badgeOff,
                      ]}
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

                    <TouchableOpacity
                      style={[styles.stopBtn, active ? styles.stopBtnOff : styles.stopBtnOn]}
                      onPress={() => handleServiceStopToggle(svc)}
                    >
                      <Feather
                        name={active ? "pause-circle" : "play-circle"}
                        size={16}
                        color={active ? colors.danger : colors.success}
                      />
                      <Text style={[styles.stopBtnText, active ? styles.stopBtnTextOff : styles.stopBtnTextOn]}>
                        {active ? "إيقاف الخدمة" : "تفعيل الخدمة"}
                      </Text>
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
    heroCard: {
      marginHorizontal: 20,
      marginTop: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
    },
    heroTopRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    heroIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    heroSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    heroTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      textAlign: "right",
      marginBottom: 10,
    },
    heroStatsRow: {
      flexDirection: "row",
      gap: 8,
    },
    heroStatCard: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    heroStatLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 4,
      textAlign: "center",
    },
    heroStatValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.primary,
    },
    centersSection: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    centersLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
      textAlign: "right",
      marginBottom: 8,
    },
    centerChipsRow: {
      flexDirection: "row-reverse",
      gap: 8,
      paddingBottom: 2,
    },
    centerChip: {
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxWidth: 180,
    },
    centerChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    centerChipInactive: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
    },
    centerChipText: {
      fontSize: 13,
      fontWeight: "700",
      textAlign: "right",
      writingDirection: "rtl",
    },
    centerChipTextActive: {
      color: colors.surface,
    },
    centerChipTextInactive: {
      color: colors.text,
    },
    centerEmptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
      marginBottom: 4,
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
    centerHint: {
      marginTop: 8,
      color: colors.textMuted,
      fontSize: 12,
      textAlign: "right",
      writingDirection: "rtl",
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
    durationHint: {
      marginTop: 4,
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    durationReadOnly: {
      justifyContent: "center",
      backgroundColor: colors.primary + "10",
      borderColor: colors.primary + "30",
    },
    durationReadOnlyText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
      textAlign: "right",
      writingDirection: "rtl",
    },
    discountPreviewText: {
      marginTop: 8,
      fontSize: 12,
      color: colors.success,
      textAlign: "right",
      writingDirection: "rtl",
      fontWeight: "700",
    },
    discountToggleRow: {
      marginTop: 10,
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
    },
    discountToggleBtn: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    discountToggleBtnOn: {
      borderColor: colors.success,
      backgroundColor: colors.surface,
    },
    discountToggleBtnOff: {
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    discountToggleText: {
      fontSize: 12,
      fontWeight: "800",
    },
    discountToggleTextOn: { color: colors.success },
    discountToggleTextOff: { color: colors.textMuted },
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
    discountLineWrap: {
      marginTop: 6,
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 8,
      justifyContent: "flex-end",
    },
    oldPriceText: {
      fontSize: 12,
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
    discountBadge: {
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    discountBadgeText: {
      color: colors.danger,
      fontSize: 11,
      fontWeight: "800",
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

    serviceActions: { marginTop: 12, flexDirection: "row-reverse", gap: 8 },
    editBtn: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    editText: { color: colors.primary, fontWeight: "800" },
    stopBtn: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    stopBtnOff: { borderColor: colors.danger },
    stopBtnOn: { borderColor: colors.success },
    stopBtnText: { fontWeight: "800" },
    stopBtnTextOff: { color: colors.danger },
    stopBtnTextOn: { color: colors.success },
  });
