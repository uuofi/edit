import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from "react-native";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { logout, logoutAllDevices } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";
import { useThemePreference } from "../lib/ThemeProvider";

export default function ProfileSettingsScreen() {
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);
  const { colors, isDark } = useAppTheme();
  const pref = useThemePreference();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const extra =
    Constants?.expoConfig?.extra ||
    Constants?.manifest?.extra ||
    Constants?.manifest2?.extra ||
    {};
  const privacyPolicyUrl = String(extra?.privacyPolicyUrl || "https://medicare-iq.com/privacy").trim();

  const openUrl = async (url) => {
    const u = String(url || "").trim();
    if (!u) {
      Alert.alert("تنبيه", "الرابط غير متوفر حالياً.");
      return;
    }
    try {
      await Linking.openURL(u);
    } catch {
      Alert.alert("خطأ", "تعذّر فتح الرابط.");
    }
  };

  const handleLogoutAll = () => {
    if (busy) return;
    Alert.alert(
      "تأكيد",
      "سيتم تسجيل الخروج من كل الأجهزة.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تأكيد",
          onPress: async () => {
            setBusy(true);
            try {
              await logoutAllDevices();
              await logout();
              navigation.reset({ index: 0, routes: [{ name: "RoleSelection" }] });
            } catch (err) {
              const msg = err?.payload?.message || err?.message || "تعذر تسجيل الخروج";
              Alert.alert("خطأ", msg);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-right" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الإعدادات</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Feather name="settings" size={22} color="#16A34A" />
          <Text style={styles.title}>إعدادات الحساب</Text>
          <Text style={styles.text}>
            من هنا يمكنك إدارة تفضيلات الإشعارات، اللغة، وإعدادات الأمان مثل تغيير
            كلمة المرور أو المصادقة برمز الدخول.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.actionCard, busy && { opacity: 0.7 }]}
          onPress={() => pref?.toggle?.()}
          disabled={busy || !pref?.loaded}
        >
          <View style={styles.actionLeft}>
            <Feather name={isDark ? "moon" : "sun"} size={20} color={colors.primary} />
            <Text style={styles.actionText}>الوضع الليلي</Text>
          </View>
          <Text style={styles.actionRightText}>{isDark ? "داكن" : "فاتح"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, busy && { opacity: 0.7 }]}
          onPress={() => navigation.navigate("ChangePassword")}
          disabled={busy}
        >
          <View style={styles.actionLeft}>
            <Feather name="lock" size={20} color="#0EA5E9" />
            <Text style={styles.actionText}>تغيير كلمة المرور</Text>
          </View>
          <Feather name="chevron-left" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, busy && { opacity: 0.7 }]}
          onPress={handleLogoutAll}
          disabled={busy}
        >
          <View style={styles.actionLeft}>
            <Feather name="log-out" size={20} color="#0EA5E9" />
            <Text style={styles.actionText}>تسجيل خروج من كل الأجهزة</Text>
          </View>
          <Feather name="chevron-left" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, busy && { opacity: 0.7 }]}
          onPress={() => openUrl(privacyPolicyUrl)}
          disabled={busy || !privacyPolicyUrl}
        >
          <View style={styles.actionLeft}>
            <Feather name="shield" size={20} color="#0EA5E9" />
            <Text style={styles.actionText}>سياسة الخصوصية</Text>
          </View>
          <Feather name="external-link" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={[styles.card, { marginTop: 12 }]}> 
          <Feather name="trash-2" size={22} color="#DC2626" />
          <Text style={styles.title}>حذف الحساب</Text>
          <Text style={styles.text}>
            إذا حذفت الحساب لن تتمكن من استرجاعه.
          </Text>
          <TouchableOpacity
            style={[styles.dangerBtn, busy && { opacity: 0.7 }]}
            onPress={() => navigation.navigate("DeleteAccount")}
            disabled={busy}
          >
            <Text style={styles.dangerBtnText}>حذف الحساب</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { fontSize: 16, fontWeight: "600", color: colors.text },
    text: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
    actionCard: {
      marginTop: 12,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    actionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    actionText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    actionRightText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
    },
    dangerBtn: {
      marginTop: 12,
      backgroundColor: "#DC2626",
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    dangerBtnText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "600",
    },
  });
