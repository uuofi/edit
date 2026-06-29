// screens/lab-profile.js — إعدادات وملف المختبر
import React, { useMemo, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { fetchLabProfile, updateLabProfile, logout } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const TL  = "#0D9488";

const LAB_TYPES = [
  { key: "general",       label: "عام" },
  { key: "clinical",      label: "سريري" },
  { key: "pathology",     label: "أنسجة" },
  { key: "microbiology",  label: "أحياء دقيقة" },
  { key: "genetics",      label: "جينات" },
  { key: "radiology",     label: "أشعة" },
  { key: "blood_bank",    label: "بنك دم" },
  { key: "specialized",   label: "متخصص" },
];

export default function LabProfileScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const S = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [lab,     setLab]    = useState(null);
  const [form,    setForm]   = useState({});
  const [loading, setLoading]= useState(true);
  const [saving,  setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const l = await fetchLabProfile();
      setLab(l);
      setForm({
        name:            l.name || "",
        nameEn:          l.nameEn || "",
        labType:         l.labType || "general",
        phone:           l.phone || "",
        phone2:          l.phone2 || "",
        email:           l.email || "",
        website:         l.website || "",
        city:            l.city || "",
        address:         l.address || "",
        bio:             l.bio || "",
        reportHeaderText:l.reportHeaderText || "",
        reportFooterText:l.reportFooterText || "",
        allowPatientAccess:          l.allowPatientAccess ?? true,
        requireApprovalBeforeRelease:l.requireApprovalBeforeRelease ?? true,
      });
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    try {
      await updateLabProfile(form);
      Alert.alert("تم", "تم حفظ التعديلات بنجاح");
      load();
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSaving(false);
    }
  };

  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleLogout = async () => {
    Alert.alert("تسجيل الخروج", "هل تريد الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "خروج", style: "destructive", onPress: async () => {
        await logout();
        navigation.replace("RoleSelection");
      }},
    ]);
  };

  if (loading) return (
    <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={TL} />
    </SafeAreaView>
  );

  const statusMap = { pending: "قيد المراجعة", active: "نشط ✓", suspended: "موقوف", rejected: "مرفوض" };

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-right" size={22} color={TL} /></TouchableOpacity>
        <Text style={S.title}>إعدادات المختبر</Text>
        <TouchableOpacity onPress={handleLogout}><Feather name="log-out" size={20} color="#EF4444" /></TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={S.scroll}>

          {/* Status Banner */}
          <View style={[S.statusBanner, lab?.status === "active" ? S.bannerActive : S.bannerPending]}>
            <Feather name={lab?.status === "active" ? "check-circle" : "clock"} size={16} color={lab?.status === "active" ? "#065F46" : "#92400E"} />
            <Text style={[S.statusText, { color: lab?.status === "active" ? "#065F46" : "#92400E" }]}>
              {statusMap[lab?.status] || lab?.status}
            </Text>
          </View>

          {/* Basic Info */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>المعلومات الأساسية</Text>
            <Field label="اسم المختبر (AR)" value={form.name}   onChange={f("name")}   colors={colors} S={S} />
            <Field label="اسم المختبر (EN)" value={form.nameEn} onChange={f("nameEn")} colors={colors} S={S} />
            <Text style={S.fieldLabel}>نوع المختبر</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
              {LAB_TYPES.map((t) => (
                <TouchableOpacity key={t.key} style={[S.typeBtn, form.labType === t.key && S.typeBtnActive]} onPress={() => f("labType")(t.key)}>
                  <Text style={[S.typeBtnText, form.labType === t.key && { color: "#fff" }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Field label="رقم الهاتف"    value={form.phone}   onChange={f("phone")}   keyboardType="phone-pad" colors={colors} S={S} />
            <Field label="رقم إضافي"     value={form.phone2}  onChange={f("phone2")}  keyboardType="phone-pad" colors={colors} S={S} />
            <Field label="البريد الإلكتروني" value={form.email} onChange={f("email")} keyboardType="email-address" colors={colors} S={S} />
            <Field label="الموقع الإلكتروني" value={form.website} onChange={f("website")} colors={colors} S={S} />
            <Field label="المدينة"       value={form.city}    onChange={f("city")}    colors={colors} S={S} />
            <Field label="العنوان"       value={form.address} onChange={f("address")} colors={colors} S={S} multiline />
            <Field label="نبذة عن المختبر" value={form.bio}  onChange={f("bio")}     colors={colors} S={S} multiline />
          </View>

          {/* Report Settings */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>إعدادات التقرير</Text>
            <Field label="رأس التقرير" value={form.reportHeaderText} onChange={f("reportHeaderText")} colors={colors} S={S} multiline />
            <Field label="تذييل التقرير" value={form.reportFooterText} onChange={f("reportFooterText")} colors={colors} S={S} multiline />
          </View>

          {/* Workflow */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>آلية العمل</Text>
            <TouchableOpacity style={S.toggleRow} onPress={() => f("requireApprovalBeforeRelease")(!form.requireApprovalBeforeRelease)}>
              <View style={{ flex: 1 }}>
                <Text style={S.toggleLabel}>يتطلب اعتماد قبل الإصدار</Text>
                <Text style={S.toggleSub}>النتيجة لا تُرسل للمريض حتى يعتمدها المسؤول</Text>
              </View>
              <View style={[S.pill, form.requireApprovalBeforeRelease && S.pillActive]}>
                <Text style={{ color: form.requireApprovalBeforeRelease ? "#fff" : colors.textSecondary, fontSize: 11, fontWeight: "700" }}>
                  {form.requireApprovalBeforeRelease ? "مفعّل" : "معطّل"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[S.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <><Feather name="save" size={18} color="#fff" /><Text style={S.saveBtnText}>حفظ التعديلات</Text></>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={S.logoutBtn} onPress={handleLogout}>
            <Feather name="log-out" size={16} color="#EF4444" />
            <Text style={S.logoutText}>تسجيل الخروج</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, keyboardType, multiline, colors, S }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={S.fieldLabel}>{label}</Text>
      <TextInput
        style={[S.input, multiline && { height: 80, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.textSecondary}
      />
    </View>
  );
}

const createStyles = (c, dark) => StyleSheet.create({
  safe:         { flex: 1, backgroundColor: c.background },
  center:       { flex: 1, alignItems: "center", justifyContent: "center" },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  title:        { fontSize: 17, fontWeight: "700", color: c.text },
  scroll:       { padding: 16, paddingBottom: 60 },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12, marginBottom: 16 },
  bannerActive: { backgroundColor: "#D1FAE5" },
  bannerPending:{ backgroundColor: "#FEF3C7" },
  statusText:   { fontSize: 14, fontWeight: "700" },
  section:      { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: c.text, marginBottom: 12, textAlign: "right" },
  fieldLabel:   { fontSize: 12, color: c.textSecondary, textAlign: "right", marginBottom: 4 },
  input:        { backgroundColor: dark ? "#1E293B" : "#F8FAFC", borderRadius: 10, paddingHorizontal: 12, height: 44, color: c.text, borderWidth: 1, borderColor: c.border, textAlign: "right" },
  typeBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  typeBtnActive:{ backgroundColor: TL, borderColor: TL },
  typeBtnText:  { fontSize: 12, color: c.text, fontWeight: "600" },
  toggleRow:    { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  toggleLabel:  { fontSize: 14, fontWeight: "600", color: c.text, textAlign: "right" },
  toggleSub:    { fontSize: 11, color: c.textSecondary, textAlign: "right", marginTop: 2 },
  pill:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: c.border },
  pillActive:   { backgroundColor: TL },
  saveBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: TL, borderRadius: 14, paddingVertical: 16, marginBottom: 12 },
  saveBtnText:  { color: "#fff", fontSize: 16, fontWeight: "700" },
  logoutBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: "#EF4444" },
  logoutText:   { color: "#EF4444", fontSize: 15, fontWeight: "700" },
});
