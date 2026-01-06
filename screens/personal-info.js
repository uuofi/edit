import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { request, updateProfile } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

export default function PersonalInfoScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");

  const normalizeIraqPhoneTo10Digits = (value) => {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("964") && digits.length === 13) {
      digits = digits.slice(3);
    }
    if (digits.startsWith("0") && digits.length === 11) {
      digits = digits.slice(1);
    }
    return digits.slice(0, 10);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await request("/api/auth/me");
        const u = data.user || data;
        if (!active) return;
        setName(u?.name || "");
        setPhone(u?.phone ? normalizeIraqPhoneTo10Digits(u.phone) : "");
        setEmail(u?.email || "");
        setAge(u?.age ? String(u.age) : "");
      } catch (err) {
        Alert.alert("خطأ", "تعذر تحميل البيانات");
      } finally {
        active && setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // تحديث البيانات فور العودة من أي مكان آخر بدون تحديث يدوي
  useFocusEffect(
    useCallback(() => {
      // إعادة الجلب عند التركيز
      (async () => {
        try {
          const data = await request("/api/auth/me");
          const u = data.user || data;
          setName(u?.name || "");
          setPhone(u?.phone ? normalizeIraqPhoneTo10Digits(u.phone) : "");
          setEmail(u?.email || "");
          setAge(u?.age ? String(u.age) : "");
        } catch (err) {
          // نتجاهل هنا لتفادي تنبيهات مكررة
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const phoneDigits = phone ? normalizeIraqPhoneTo10Digits(phone) : "";
      await updateProfile({
        name,
        phone: phoneDigits || undefined,
        email,
        age: age ? Number(age) : undefined,
      });
      Alert.alert("تم الحفظ", "تم تحديث بيانات الحساب بنجاح", [
        { text: "حسناً", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const msg = err?.payload?.message || "تعذر حفظ البيانات";
      Alert.alert("خطأ", msg);
    } finally {
      setSaving(false);
    }
  };
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-right" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المعلومات الشخصية</Text>
        <View style={{ width: 32 }} />
      </View>
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.card}>
            <Feather name="user" size={22} color={colors.primary} />
            <Text style={styles.title}>معلومات الحساب</Text>
            <Text style={styles.label}>الاسم</Text>
            <TextInput
              style={styles.input}
              placeholder="اسمك"
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={setName}
            />
            <Text style={styles.label}>رقم الجوال</Text>
            <TextInput
              style={styles.input}
              placeholder="أدخل 10 أرقام تبدأ بـ7"
              placeholderTextColor={colors.placeholder}
              keyboardType="phone-pad"
              value={phone}
              maxLength={10}
              onChangeText={(t) => setPhone(normalizeIraqPhoneTo10Digits(t))}
            />
            <Text style={styles.label}>الإيميل (اختياري)</Text>
            <TextInput
              style={styles.input}
              placeholder="example@email.com"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.label}>العمر</Text>
            <TextInput
              style={styles.input}
              placeholder="مثلاً 30"
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
            />
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>حفظ</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      height: 56,
      backgroundColor: colors.surface,
      flexDirection: "row",
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
    body: { padding: 16 },
    loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { fontSize: 16, fontWeight: "600", color: colors.text },
    label: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 14,
      color: colors.text,
    },
    saveBtn: {
      marginTop: 12,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    saveText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "600",
    },
  });
