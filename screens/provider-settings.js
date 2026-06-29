import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getUserRole, logout, logoutAllDevices } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";
import { useThemePreference } from "../lib/ThemeProvider";
import useOTAUpdates from "../lib/useOTAUpdates";


export default function ProviderSettingsScreen() {
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const { colors, isDark } = useAppTheme();
  const pref = useThemePreference();
  const { isChecking, isDownloading, checkManually } = useOTAUpdates();
  const styles = useMemo(() => createStyles(colors), [colors]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const role = await getUserRole();
        if (mounted) setUserRole(role || null);
      } catch {
        if (mounted) setUserRole(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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

  const openDrawer = useCallback(() => {
    if (typeof navigation?.openDrawer === "function") {
      navigation.openDrawer();
      return;
    }
    const parent = navigation?.getParent?.();
    if (typeof parent?.openDrawer === "function") parent.openDrawer();
  }, [navigation]);

  const handleLogoutAll = () => {
    if (busy) return;
    Alert.alert("تأكيد", "سيتم تسجيل الخروج من كل الأجهزة.", [
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
    ]);
  };

  const dangerColor = colors.danger || colors.primary;
  const successColor = colors.success || colors.primary;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.iconBtn}>
          <Feather name="menu" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الإعدادات</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Feather name="settings" size={22} color={successColor} />
          <Text style={styles.title}>إعدادات الحساب</Text>
          <Text style={styles.text}>إدارة الأمان وتفضيلات التطبيق.</Text>
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
            <Feather name="lock" size={20} color={colors.primary} />
            <Text style={styles.actionText}>تغيير كلمة المرور</Text>
          </View>
          <Feather name="chevron-left" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, busy && { opacity: 0.7 }]}
          onPress={() => navigation.navigate("Support")}
          disabled={busy}
        >
          <View style={styles.actionLeft}>
            <Feather name="help-circle" size={20} color={colors.primary} />
            <Text style={styles.actionText}>تواصل ودعم</Text>
          </View>
          <Feather name="chevron-left" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {userRole === "doctor" ? (
          <TouchableOpacity
            style={[styles.actionCard, busy && { opacity: 0.7 }]}
            onPress={() => navigation.navigate("BlockedPatients")}
            disabled={busy}
          >
            <View style={styles.actionLeft}>
              <Feather name="slash" size={20} color={colors.primary} />
              <Text style={styles.actionText}>المحظورون من الرسائل</Text>
            </View>
            <Feather name="chevron-left" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.actionCard, busy && { opacity: 0.7 }]}
          onPress={handleLogoutAll}
          disabled={busy}
        >
          <View style={styles.actionLeft}>
            <Feather name="log-out" size={20} color={colors.primary} />
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
            <Feather name="shield" size={20} color={colors.primary} />
            <Text style={styles.actionText}>سياسة الخصوصية</Text>
          </View>
          <Feather name="external-link" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, (busy || isChecking || isDownloading) && { opacity: 0.7 }]}
          onPress={checkManually}
          disabled={busy || isChecking || isDownloading}
        >
          <View style={styles.actionLeft}>
            <Feather name="download-cloud" size={20} color={colors.primary} />
            <Text style={styles.actionText}>
              {isDownloading ? "جارٍ تحميل التحديث..." : isChecking ? "جارٍ التحقق..." : "التحقق من التحديثات"}
            </Text>
          </View>
          {(isChecking || isDownloading) ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="chevron-left" size={20} color={colors.textMuted} />
          )}
        </TouchableOpacity>

        <View style={[styles.card, { marginTop: 12 }]}> 
          <Feather name="trash-2" size={22} color={dangerColor} />
          <Text style={styles.title}>حذف الحساب</Text>
          <Text style={styles.text}>الحذف نهائي ولا يمكن التراجع عنه.</Text>
          <TouchableOpacity
            style={[styles.dangerBtn, busy && { opacity: 0.7 }]}
            onPress={() => navigation.navigate("DeleteAccount")}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={styles.dangerBtnText}>حذف الحساب</Text>
            )}
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
    iconBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
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
      backgroundColor: colors.danger || colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    dangerBtnText: {
      color: colors.surface,
      fontSize: 15,
      fontWeight: "800",
    },
  });
