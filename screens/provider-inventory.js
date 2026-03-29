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
  Modal,
  Image,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../lib/useTheme";
import {
  API_BASE_URL,
  fetchInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "../lib/api";

// ─────────────────────────────── helpers ────────────────────────────
const pad2 = (n) => String(n).padStart(2, "0");

const formatDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};

const formatCurrency = (val) => {
  const n = Number(val) || 0;
  try {
    return `${n.toLocaleString("ar-IQ")} د.ع`;
  } catch {
    return `${n} د.ع`;
  }
};

/**
 * إرجاع لون بناءً على المدة حتى انتهاء الصلاحية
 * red   → منتهي أو أقل من يوم
 * orange → يومان
 * yellow → أسبوع
 * green  → أكثر
 */
const expiryColor = (expiryDate, colors) => {
  if (!expiryDate) return colors.textMuted;
  const now = Date.now();
  const diff = new Date(expiryDate).getTime() - now;
  const days = diff / (1000 * 60 * 60 * 24);
  if (days <= 0) return "#EF4444";        // منتهي
  if (days <= 2) return "#F97316";        // خطر
  if (days <= 7) return "#EAB308";        // تحذير
  return "#22C55E";                       // آمن
};

const buildEmptyForm = () => ({
  name: "",
  type: "",
  price: "",
  purchaseDate: "",
  expiryDate: "",
});

const parseDateInput = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return new Date();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const candidate = new Date(y, m - 1, d);
    if (!Number.isNaN(candidate.getTime())) return candidate;
  }
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
};

// ─────────────────────────────── component ──────────────────────────
export default function ProviderInventoryScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(buildEmptyForm());
  const [imageUri, setImageUri] = useState(null); // الصورة الجديدة المختارة
  const [search, setSearch] = useState("");
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateField, setDateField] = useState(null);
  const [dateValue, setDateValue] = useState(new Date());

  // ── load ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInventory();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      Alert.alert("خطأ", err?.message || "تعذّر تحميل المخزن");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── filtered list ──
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(
      (it) =>
        String(it.name || "").toLowerCase().includes(q) ||
        String(it.type || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  // ── open add modal ──
  const openAdd = () => {
    setEditingItem(null);
    setForm(buildEmptyForm());
    setImageUri(null);
    setModalVisible(true);
  };

  // ── open edit modal ──
  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      name: String(item.name || ""),
      type: String(item.type || ""),
      price: String(item.price ?? ""),
      purchaseDate: item.purchaseDate ? formatDate(item.purchaseDate) : "",
      expiryDate: item.expiryDate ? formatDate(item.expiryDate) : "",
    });
    setImageUri(null);
    setModalVisible(true);
  };

  // ── close modal ──
  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setEditingItem(null);
    setForm(buildEmptyForm());
    setImageUri(null);
    setDatePickerVisible(false);
    setDateField(null);
  };

  const openDatePicker = (fieldName) => {
    Keyboard.dismiss();
    setDateField(fieldName);
    setDateValue(parseDateInput(form[fieldName]));
    setDatePickerVisible(true);
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setDatePickerVisible(false);
      if (event?.type !== "set" || !selectedDate || !dateField) return;
      setForm((prev) => ({ ...prev, [dateField]: formatDate(selectedDate) }));
      return;
    }

    if (!selectedDate || !dateField) return;
    setDateValue(selectedDate);
    setForm((prev) => ({ ...prev, [dateField]: formatDate(selectedDate) }));
  };

  // ── pick image ──
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("تنبيه", "يلزم السماح بالوصول إلى المعرض لرفع صورة.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
      }
    } catch (_err) {
      Alert.alert("خطأ", "تعذّر اختيار الصورة");
    }
  };

  // ── validate date string YYYY-MM-DD ──
  const isValidDateStr = (str) => {
    if (!str) return true; // اختياري
    return /^\d{4}-\d{2}-\d{2}$/.test(str.trim()) && !Number.isNaN(new Date(str).getTime());
  };

  // ── save ──
  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      Alert.alert("تنبيه", "اسم العلاج مطلوب");
      return;
    }
    if (form.purchaseDate && !isValidDateStr(form.purchaseDate)) {
      Alert.alert("تنبيه", "صيغة تاريخ الشراء غير صحيحة (YYYY-MM-DD)");
      return;
    }
    if (form.expiryDate && !isValidDateStr(form.expiryDate)) {
      Alert.alert("تنبيه", "صيغة تاريخ الانتهاء غير صحيحة (YYYY-MM-DD)");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        type: form.type.trim(),
        price: form.price ? Number(form.price) : 0,
        purchaseDate: form.purchaseDate.trim() || undefined,
        expiryDate: form.expiryDate.trim() || undefined,
      };

      if (editingItem) {
        const updated = await updateInventoryItem(editingItem._id, payload, imageUri);
        setItems((prev) =>
          prev.map((it) => (it._id === editingItem._id ? updated.item : it))
        );
      } else {
        const created = await createInventoryItem(payload, imageUri);
        setItems((prev) => [created.item, ...prev]);
      }
      closeModal();
    } catch (err) {
      Alert.alert("خطأ", err?.message || "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  // ── delete ──
  const handleDelete = (item) => {
    Alert.alert(
      "تأكيد الحذف",
      `هل تريد حذف "${item.name}" من المخزن؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteInventoryItem(item._id);
              setItems((prev) => prev.filter((it) => it._id !== item._id));
            } catch (err) {
              Alert.alert("خطأ", err?.message || "تعذّر الحذف");
            }
          },
        },
      ]
    );
  };

  // ── expiry badge ──
  const ExpiryBadge = ({ expiryDate }) => {
    if (!expiryDate) return null;
    const color = expiryColor(expiryDate, colors);
    const now = Date.now();
    const diff = new Date(expiryDate).getTime() - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    let label =
      days <= 0
        ? "منتهية الصلاحية"
        : days === 1
        ? "ينتهي غداً"
        : days <= 7
        ? `ينتهي خلال ${days} أيام`
        : formatDate(expiryDate);

    return (
      <View style={[styles.badge, { backgroundColor: color + "25", borderColor: color }]}>
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
      </View>
    );
  };

  // ── render item ──
  const renderItem = (item) => {
    const imgUrl = item.imageUrl ? `${API_BASE_URL}${item.imageUrl}` : null;
    return (
      <View key={item._id} style={styles.card}>
        {imgUrl ? (
          <Image source={{ uri: imgUrl }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Feather name="package" size={28} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          {!!item.type && <Text style={styles.cardSub}>النوع: {item.type}</Text>}
          <Text style={styles.cardSub}>السعر: {formatCurrency(item.price)}</Text>
          {!!item.purchaseDate && (
            <Text style={styles.cardSub}>تاريخ الشراء: {formatDate(item.purchaseDate)}</Text>
          )}
          {!!item.expiryDate && (
            <Text style={styles.cardSub}>
              انتهاء الصلاحية:{" "}
              <Text style={{ color: expiryColor(item.expiryDate, colors), fontWeight: "700" }}>
                {formatDate(item.expiryDate)}
              </Text>
            </Text>
          )}
          <ExpiryBadge expiryDate={item.expiryDate} />
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => openEdit(item)}
          >
            <Feather name="edit-2" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: "#FEE2E2" }]}
            onPress={() => handleDelete(item)}
          >
            <Feather name="trash-2" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─────────────────── render ───────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
          <Feather name="menu" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المخزن</Text>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Feather name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث باسم العلاج أو نوعه..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{items.length}</Text>
          <Text style={styles.statLabel}>إجمالي</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: "#F97316" }]}>
            {items.filter((it) => {
              if (!it.expiryDate) return false;
              const d = (new Date(it.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
              return d >= 0 && d <= 2;
            }).length}
          </Text>
          <Text style={styles.statLabel}>تنتهي قريباً</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: "#EF4444" }]}>
            {items.filter((it) => it.expiryDate && new Date(it.expiryDate).getTime() < Date.now()).length}
          </Text>
          <Text style={styles.statLabel}>منتهية الصلاحية</Text>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.center}>
          <Feather name="package" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>
            {search ? "لا توجد نتائج" : "لا يوجد مخزون بعد\nاضغط + لإضافة عنصر"}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredItems.map(renderItem)}
        </ScrollView>
      )}

      {/* ─────────── Modal ─────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardWrap}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={20}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingItem ? "تعديل العنصر" : "إضافة عنصر جديد"}
                </Text>
                <TouchableOpacity onPress={closeModal} disabled={saving}>
                  <Feather name="x" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
              {/* Image picker */}
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                ) : editingItem?.imageUrl ? (
                  <Image
                    source={{ uri: `${API_BASE_URL}${editingItem.imageUrl}` }}
                    style={styles.imagePreview}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Feather name="camera" size={30} color={colors.textMuted} />
                    <Text style={styles.imagePlaceholderText}>اختر صورة (اختياري)</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Name */}
              <Text style={styles.fieldLabel}>اسم العلاج / الدواء *</Text>
              <TextInput
                style={styles.input}
                placeholder="مثال: أموكسيسيلين"
                placeholderTextColor={colors.textMuted}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              />

              {/* Type */}
              <Text style={styles.fieldLabel}>نوع العلاج</Text>
              <TextInput
                style={styles.input}
                placeholder="مثال: مضاد حيوي، مسكن..."
                placeholderTextColor={colors.textMuted}
                value={form.type}
                onChangeText={(v) => setForm((f) => ({ ...f, type: v }))}
              />

              {/* Price */}
              <Text style={styles.fieldLabel}>السعر (دينار عراقي)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={form.price}
                onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
              />

              {/* Purchase date */}
              <Text style={styles.fieldLabel}>تاريخ الشراء (YYYY-MM-DD)</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => openDatePicker("purchaseDate")}
                activeOpacity={0.85}
              >
                <Feather name="calendar" size={16} color={colors.textMuted} />
                <Text
                  style={[
                    styles.dateInputText,
                    !form.purchaseDate && styles.dateInputPlaceholder,
                  ]}
                >
                  {form.purchaseDate || "اختر تاريخ الشراء"}
                </Text>
              </TouchableOpacity>

              {/* Expiry date */}
              <Text style={styles.fieldLabel}>تاريخ انتهاء الصلاحية (YYYY-MM-DD)</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => openDatePicker("expiryDate")}
                activeOpacity={0.85}
              >
                <Feather name="calendar" size={16} color={colors.textMuted} />
                <Text
                  style={[
                    styles.dateInputText,
                    !form.expiryDate && styles.dateInputPlaceholder,
                  ]}
                >
                  {form.expiryDate || "اختر تاريخ انتهاء الصلاحية"}
                </Text>
              </TouchableOpacity>

              {datePickerVisible ? (
                <View style={styles.datePickerWrap}>
                  <DateTimePicker
                    value={dateValue}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleDateChange}
                    themeVariant="light"
                    textColor="#000"
                    style={{ backgroundColor: "#fff" }}
                  />
                  {Platform.OS === "ios" ? (
                    <TouchableOpacity
                      style={styles.dateDoneBtn}
                      onPress={() => setDatePickerVisible(false)}
                    >
                      <Text style={styles.dateDoneText}>تم</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {/* Save button */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingItem ? "حفظ التعديلات" : "إضافة"}</Text>
                )}
              </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────── styles ─────────────────────────────
const createStyles = (colors, isDark) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuBtn: { padding: 4 },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    addBtn: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      padding: 6,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    searchIcon: { marginRight: 6 },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      textAlign: "right",
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginHorizontal: 16,
      marginBottom: 10,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      marginHorizontal: 4,
      paddingVertical: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    list: { paddingHorizontal: 16, paddingBottom: 20 },
    card: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: "hidden",
    },
    cardImage: {
      width: 80,
      height: "100%",
      minHeight: 90,
    },
    cardImagePlaceholder: {
      backgroundColor: colors.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
    },
    cardBody: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 3,
      textAlign: "right",
    },
    cardSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 2,
      textAlign: "right",
    },
    badge: {
      alignSelf: "flex-end",
      borderRadius: 20,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginTop: 4,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "600",
    },
    cardActions: {
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 8,
      gap: 8,
    },
    iconBtn: {
      borderRadius: 8,
      padding: 8,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 24,
    },
    // ── Modal ──
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "90%",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 30,
    },
    modalKeyboardWrap: {
      width: "100%",
    },
    modalScrollContent: {
      paddingBottom: 16,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    imagePicker: {
      width: "100%",
      height: 160,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
    },
    imagePreview: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    imagePlaceholder: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    imagePlaceholderText: {
      color: colors.textMuted,
      fontSize: 13,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      textAlign: "right",
      marginBottom: 4,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      textAlign: "right",
      marginBottom: 12,
    },
    dateInput: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 12,
    },
    dateInputText: {
      fontSize: 14,
      color: colors.text,
      textAlign: "right",
      flexShrink: 1,
    },
    dateInputPlaceholder: {
      color: colors.textMuted,
    },
    datePickerWrap: {
      marginBottom: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "#fff",
      overflow: "hidden",
    },
    dateDoneBtn: {
      alignSelf: "flex-end",
      margin: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    dateDoneText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 13,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
  });
