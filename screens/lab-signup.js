// screens/lab-signup.js — تسجيل مختبر جديد
import React, { useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { API_BASE_URL } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const TL = "#0D9488";

const LAB_TYPES = [
  { key: "general",      label: "عام" },
  { key: "clinical",     label: "سريري" },
  { key: "pathology",    label: "أنسجة" },
  { key: "microbiology", label: "أحياء دقيقة" },
  { key: "genetics",     label: "جينات" },
  { key: "blood_bank",   label: "بنك دم" },
  { key: "specialized",  label: "متخصص" },
];

export default function LabSignupScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const S = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [form, setForm] = useState({
    name:              "",
    phone:             "",
    password:          "",
    confirmPassword:   "",
    labName:           "",
    labType:           "general",
    labLicenseNumber:  "",
    labCity:           "",
    labAddress:        "",
  });
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);

  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.name.trim())     return Alert.alert("تنبيه", "اسمك مطلوب");
    if (!form.phone.trim())    return Alert.alert("تنبيه", "رقم الهاتف مطلوب");
    if (!form.password)        return Alert.alert("تنبيه", "كلمة المرور مطلوبة");
    if (form.password !== form.confirmPassword) return Alert.alert("تنبيه", "كلمتا المرور لا تتطابقان");
    if (!form.labName.trim())  return Alert.alert("تنبيه", "اسم المختبر مطلوب");

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role: "lab" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "حدث خطأ");
      Alert.alert(
        "تم التسجيل",
        "سيتم مراجعة طلبك من قِبَل الإدارة وإشعارك عند الموافقة.",
        [{ text: "حسناً", onPress: () => navigation.replace("Login", { role: "lab" }) }]
      );
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-right" size={22} color={TL} /></TouchableOpacity>
        <Text style={S.title}>تسجيل مختبر</Text>
        <View />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={S.scroll}>

          {/* Hero */}
          <View style={S.hero}>
            <View style={S.heroIcon}><Feather name="activity" size={36} color={TL} /></View>
            <Text style={S.heroTitle}>انضم إلى MediCare</Text>
            <Text style={S.heroSub}>سجّل مختبرك وابدأ إدارة الفحوصات إلكترونياً</Text>
          </View>

          {/* Account Info */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>معلومات الحساب</Text>
            <Label text="الاسم الكامل" />
            <TextInput style={S.input} value={form.name} onChangeText={f("name")} placeholder="اسمك" placeholderTextColor={colors.textSecondary} />
            <Label text="رقم الهاتف" />
            <TextInput style={S.input} value={form.phone} onChangeText={f("phone")} placeholder="+9647xxxxxxxxx" placeholderTextColor={colors.textSecondary} keyboardType="phone-pad" />
            <Label text="كلمة المرور" />
            <View style={S.passWrap}>
              <TextInput style={[S.input, { flex: 1 }]} value={form.password} onChangeText={f("password")} placeholder="8+ أحرف، كبيرة وصغيرة ورقم" placeholderTextColor={colors.textSecondary} secureTextEntry={!showPass} />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={S.eyeBtn}>
                <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Label text="تأكيد كلمة المرور" />
            <TextInput style={S.input} value={form.confirmPassword} onChangeText={f("confirmPassword")} placeholder="أعد كلمة المرور" placeholderTextColor={colors.textSecondary} secureTextEntry={!showPass} />
          </View>

          {/* Lab Info */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>معلومات المختبر</Text>
            <Label text="اسم المختبر *" />
            <TextInput style={S.input} value={form.labName} onChangeText={f("labName")} placeholder="مختبر الرعاية الطبية" placeholderTextColor={colors.textSecondary} />
            <Label text="نوع المختبر" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
              {LAB_TYPES.map((t) => (
                <TouchableOpacity key={t.key} style={[S.typeBtn, form.labType === t.key && S.typeBtnActive]} onPress={() => f("labType")(t.key)}>
                  <Text style={[S.typeBtnText, form.labType === t.key && { color: "#fff" }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Label text="رقم الترخيص" />
            <TextInput style={S.input} value={form.labLicenseNumber} onChangeText={f("labLicenseNumber")} placeholder="رقم ترخيص المختبر" placeholderTextColor={colors.textSecondary} />
            <Label text="المدينة" />
            <TextInput style={S.input} value={form.labCity} onChangeText={f("labCity")} placeholder="بغداد" placeholderTextColor={colors.textSecondary} />
            <Label text="العنوان" />
            <TextInput style={S.input} value={form.labAddress} onChangeText={f("labAddress")} placeholder="الشارع، الحي، المدينة" placeholderTextColor={colors.textSecondary} />
          </View>

          <TouchableOpacity style={[S.submitBtn, loading && { opacity: 0.5 }]} onPress={submit} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <><Feather name="user-plus" size={18} color="#fff" /><Text style={S.submitText}>إرسال الطلب</Text></>
            }
          </TouchableOpacity>

          <TouchableOpacity style={S.loginLink} onPress={() => navigation.navigate("Login", { role: "lab" })}>
            <Text style={S.loginLinkText}>لديك حساب؟ تسجيل الدخول</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Label = ({ text }) => (
  <Text style={{ fontSize: 12, color: "#64748B", textAlign: "right", marginBottom: 4 }}>{text}</Text>
);

const createStyles = (c, dark) => StyleSheet.create({
  safe:         { flex: 1, backgroundColor: c.background },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  title:        { fontSize: 17, fontWeight: "700", color: c.text },
  scroll:       { padding: 16, paddingBottom: 60 },
  hero:         { alignItems: "center", paddingVertical: 24, gap: 8 },
  heroIcon:     { width: 72, height: 72, borderRadius: 36, backgroundColor: "#CCFBF1", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  heroTitle:    { fontSize: 22, fontWeight: "800", color: c.text },
  heroSub:      { fontSize: 13, color: c.textSecondary, textAlign: "center" },
  section:      { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: c.text, marginBottom: 12, textAlign: "right" },
  input:        { backgroundColor: dark ? "#1E293B" : "#F8FAFC", borderRadius: 10, paddingHorizontal: 14, height: 46, color: c.text, borderWidth: 1, borderColor: c.border, textAlign: "right", marginBottom: 10 },
  passWrap:     { flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 10 },
  eyeBtn:       { padding: 10, backgroundColor: dark ? "#1E293B" : "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: c.border },
  typeBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  typeBtnActive:{ backgroundColor: TL, borderColor: TL },
  typeBtnText:  { fontSize: 12, color: c.text, fontWeight: "600" },
  submitBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: TL, borderRadius: 14, paddingVertical: 16, marginBottom: 12 },
  submitText:   { color: "#fff", fontSize: 16, fontWeight: "700" },
  loginLink:    { alignItems: "center", paddingVertical: 12 },
  loginLinkText:{ color: TL, fontSize: 14, fontWeight: "600" },
});
