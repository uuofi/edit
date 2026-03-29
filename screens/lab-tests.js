// screens/lab-tests.js — كتالوج الفحوصات
import React, { useMemo, useState, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { fetchLabTests, createLabTest, updateLabTest, deleteLabTest } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const TL = "#0D9488";

const CATEGORIES = [
  { key: "",                label: "الكل" },
  { key: "hematology",      label: "دم" },
  { key: "biochemistry",    label: "كيمياء" },
  { key: "microbiology",    label: "أحياء" },
  { key: "immunology",      label: "مناعة" },
  { key: "urinalysis",      label: "بول" },
  { key: "coagulation",     label: "تخثر" },
  { key: "thyroid",         label: "غدة" },
  { key: "diabetes",        label: "سكري" },
  { key: "lipids",          label: "دهون" },
  { key: "liver",           label: "كبد" },
  { key: "kidney",          label: "كلى" },
  { key: "tumor_markers",   label: "أورام" },
  { key: "genetics",        label: "وراثة" },
  { key: "pathology",       label: "أنسجة" },
  { key: "other",           label: "أخرى" },
];

const BLANK = { code: "", name: "", nameAr: "", category: "hematology", price: "", originalPrice: "", turnaroundHours: "24", unit: "", isActive: true, isPanel: false, fastingRequired: false, fastingHours: "" };

export default function LabTestsScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const S = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [tests,    setTests]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState("");
  const [category, setCat]     = useState("");
  const [showForm, setShowForm]= useState(false);
  const [form,     setForm]    = useState(BLANK);
  const [editId,   setEditId]  = useState(null);
  const [saving,   setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchLabTests({ search: search || undefined, category: category || undefined });
      setTests(res);
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => { setForm(BLANK); setEditId(null); setShowForm(true); };
  const openEdit = (t) => {
    setForm({
      code:            t.code, name: t.name, nameAr: t.nameAr || "",
      category:        t.category, price: String(t.price), originalPrice: String(t.originalPrice || ""),
      turnaroundHours: String(t.turnaroundHours || 24), unit: t.unit || "",
      isActive:        t.isActive, isPanel: t.isPanel, fastingRequired: t.fastingRequired,
      fastingHours:    String(t.fastingHours || ""),
    });
    setEditId(t._id);
    setShowForm(true);
  };

  const doDelete = (t) => {
    Alert.alert("حذف الفحص", `هل تريد حذف "${t.nameAr || t.name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try { await deleteLabTest(t._id); load(); } catch (e) { Alert.alert("خطأ", e.message); }
      }},
    ]);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) return Alert.alert("تنبيه", "الكود والاسم مطلوبان");
    const price = Number(form.price);
    if (!price || price <= 0) return Alert.alert("تنبيه", "السعر يجب أن يكون رقماً موجباً");
    setSaving(true);
    try {
      const payload = { ...form, price, originalPrice: Number(form.originalPrice) || price, turnaroundHours: Number(form.turnaroundHours) || 24, fastingHours: Number(form.fastingHours) || 0 };
      if (editId) await updateLabTest(editId, payload);
      else        await createLabTest(payload);
      setShowForm(false);
      load();
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSaving(false);
    }
  };

  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-right" size={22} color={TL} /></TouchableOpacity>
        <Text style={S.title}>كتالوج الفحوصات ({tests.length})</Text>
        <TouchableOpacity onPress={openNew} style={S.newBtn}><Feather name="plus" size={20} color="#fff" /></TouchableOpacity>
      </View>

      <View style={S.searchBox}>
        <Feather name="search" size={16} color={colors.textSecondary} />
        <TextInput style={S.searchInput} placeholder="بحث..." placeholderTextColor={colors.textSecondary} value={search} onChangeText={(v) => { setSearch(v); }} onEndEditing={() => load()} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.catScroll} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity key={cat.key} style={[S.catTab, category === cat.key && S.catActive]} onPress={() => { setCat(cat.key); }}>
            <Text style={[S.catText, category === cat.key && S.catTextActive]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading
        ? <ActivityIndicator color={TL} style={{ marginTop: 30 }} />
        : (
          <FlatList
            data={tests}
            keyExtractor={(i) => i._id}
            contentContainerStyle={S.list}
            ListEmptyComponent={<Text style={S.empty}>لا توجد فحوصات مضافة</Text>}
            renderItem={({ item: t }) => (
              <View style={S.card}>
                <View style={S.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.testName}>{t.nameAr || t.name}</Text>
                    <Text style={S.testSub}>{t.code} · {t.category} · {t.turnaroundHours}ساعة</Text>
                  </View>
                  <View style={S.cardRight}>
                    <Text style={S.price}>{t.price?.toLocaleString("ar-IQ")} د.ع</Text>
                    {!t.isActive && <View style={S.inactiveBadge}><Text style={S.inactiveText}>غير نشط</Text></View>}
                  </View>
                </View>
                <View style={S.actionRow}>
                  <TouchableOpacity style={S.editBtn} onPress={() => openEdit(t)}>
                    <Feather name="edit-2" size={14} color={TL} />
                    <Text style={S.editText}>تعديل</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.delBtn} onPress={() => doDelete(t)}>
                    <Feather name="trash-2" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )
      }

      {/* Form Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={S.modalSafe}>
          <View style={S.modalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}><Feather name="x" size={22} color={TL} /></TouchableOpacity>
            <Text style={S.modalTitle}>{editId ? "تعديل فحص" : "إضافة فحص جديد"}</Text>
            <TouchableOpacity style={[S.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={S.saveBtnText}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={S.formContent}>
              <Row label="كود الفحص *"><TextInput style={S.input} value={form.code} onChangeText={f("code")} placeholder="مثال: CBC" placeholderTextColor={colors.textSecondary} /></Row>
              <Row label="الاسم (EN) *"><TextInput style={S.input} value={form.name} onChangeText={f("name")} placeholder="Complete Blood Count" placeholderTextColor={colors.textSecondary} /></Row>
              <Row label="الاسم (AR)"><TextInput style={S.input} value={form.nameAr} onChangeText={f("nameAr")} placeholder="صورة الدم الكاملة" placeholderTextColor={colors.textSecondary} /></Row>
              <Row label="الفئة">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {CATEGORIES.filter((c2) => c2.key).map((cat) => (
                    <TouchableOpacity key={cat.key} style={[S.catTab, form.category === cat.key && S.catActive]} onPress={() => f("category")(cat.key)}>
                      <Text style={[S.catText, form.category === cat.key && S.catTextActive]}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Row>
              <Row label="السعر (د.ع) *"><TextInput style={S.input} value={form.price} onChangeText={f("price")} keyboardType="numeric" placeholder="5000" placeholderTextColor={colors.textSecondary} /></Row>
              <Row label="وقت الإنجاز (ساعة)"><TextInput style={S.input} value={form.turnaroundHours} onChangeText={f("turnaroundHours")} keyboardType="numeric" placeholder="24" placeholderTextColor={colors.textSecondary} /></Row>
              <Row label="الوحدة"><TextInput style={S.input} value={form.unit} onChangeText={f("unit")} placeholder="g/dL" placeholderTextColor={colors.textSecondary} /></Row>
              <Row label="نشط"><Switch value={form.isActive} onValueChange={f("isActive")} thumbColor={form.isActive ? TL : "#94A3B8"} /></Row>
              <Row label="صوم مطلوب"><Switch value={form.fastingRequired} onValueChange={f("fastingRequired")} thumbColor={form.fastingRequired ? TL : "#94A3B8"} /></Row>
              {form.fastingRequired && (
                <Row label="ساعات الصيام"><TextInput style={S.input} value={form.fastingHours} onChangeText={f("fastingHours")} keyboardType="numeric" placeholder="8" placeholderTextColor={colors.textSecondary} /></Row>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, children }) {
  return (
    <View style={{ gap: 4, marginBottom: 10 }}>
      <Text style={{ fontSize: 13, color: "#64748B", textAlign: "right" }}>{label}</Text>
      {children}
    </View>
  );
}

const createStyles = (c, dark) => StyleSheet.create({
  safe:         { flex: 1, backgroundColor: c.background },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  title:        { fontSize: 17, fontWeight: "700", color: c.text },
  newBtn:       { backgroundColor: TL, borderRadius: 10, padding: 8 },
  searchBox:    { flexDirection: "row", alignItems: "center", margin: 12, backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: c.border },
  searchInput:  { flex: 1, height: 40, color: c.text, textAlign: "right" },
  catScroll:    { maxHeight: 44, marginBottom: 6 },
  catTab:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  catActive:    { backgroundColor: TL, borderColor: TL },
  catText:      { fontSize: 12, color: c.textSecondary },
  catTextActive:{ color: "#fff", fontWeight: "700" },
  list:         { padding: 12, gap: 10, paddingBottom: 40 },
  card:         { backgroundColor: c.surface, borderRadius: 14, padding: 14, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardRow:      { flexDirection: "row", gap: 10, marginBottom: 10 },
  testName:     { fontSize: 15, fontWeight: "700", color: c.text, textAlign: "right" },
  testSub:      { fontSize: 11, color: c.textSecondary, textAlign: "right" },
  cardRight:    { alignItems: "flex-end", gap: 4 },
  price:        { fontSize: 15, fontWeight: "800", color: TL },
  inactiveBadge:{ backgroundColor: "#FEE2E2", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  inactiveText: { fontSize: 10, color: "#991B1B" },
  actionRow:    { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  editBtn:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: TL },
  editText:     { fontSize: 12, fontWeight: "600", color: TL },
  delBtn:       { padding: 8, borderRadius: 10, backgroundColor: "#FEE2E2" },
  empty:        { textAlign: "center", color: c.textSecondary, marginTop: 40, fontSize: 15 },
  modalSafe:    { flex: 1, backgroundColor: c.background },
  modalHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  modalTitle:   { fontSize: 16, fontWeight: "700", color: c.text },
  saveBtn:      { backgroundColor: TL, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText:  { color: "#fff", fontWeight: "700" },
  formContent:  { padding: 16, paddingBottom: 60 },
  input:        { backgroundColor: dark ? "#1E293B" : "#F8FAFC", borderRadius: 10, paddingHorizontal: 12, height: 44, color: c.text, borderWidth: 1, borderColor: c.border, textAlign: "right" },
});
