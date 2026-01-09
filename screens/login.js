// app/login.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Linking,
} from "react-native";
import Constants from "expo-constants";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import {
  API_BASE_URL,
  saveRoleSelection,
  getRoleSelection,
  logout,
  getToken,
  getUserRole,
} from "../lib/api";
import { registerForPushNotificationsAsync } from "../lib/pushNotifications";
import { useAppTheme } from "../lib/useTheme";
export default function LoginScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params || {};
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(params.role || "patient");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const extra =
    Constants?.expoConfig?.extra ||
    Constants?.manifest?.extra ||
    Constants?.manifest2?.extra ||
    {};
  const privacyPolicyUrl = String(extra?.privacyPolicyUrl || "https://medicare-iq.com/privacy").trim();

  const openPrivacyPolicy = async () => {
    const url = String(privacyPolicyUrl || "").trim();
    if (!url) {
      Alert.alert("تنبيه", "رابط الخصوصية غير متوفر حالياً.");
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("خطأ", "تعذّر فتح رابط الخصوصية.");
    }
  };

  const normalizeIraqPhoneTo10Digits = (value) => {
    let digits = String(value || "").replace(/\D/g, "");
    // If pasted as +964XXXXXXXXXX
    if (digits.startsWith("964") && digits.length === 13) {
      digits = digits.slice(3);
    }
    // If pasted as 07XXXXXXXXX
    if (digits.startsWith("0") && digits.length === 11) {
      digits = digits.slice(1);
    }
    return digits.slice(0, 10);
  };

  // لو المستخدم عنده توكن، ما نرجعه لشاشة تسجيل الدخول إلا إذا سجل خروج
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const token = await getToken();
        if (!token) return;

        const storedRole = await getUserRole();
        const resolvedRole = storedRole || params.role || "patient";
        const destination = resolvedRole === "doctor" ? "ProviderTabs" : "MainTabs";
        if (active) {
          navigation.replace(destination);
        }
      })();
      return () => {
        active = false;
      };
    }, [navigation, params.role])
  );

  useEffect(() => {
    let mounted = true;
    const initRole = async () => {
      const paramRole = route.params?.role;
      if (paramRole) {
        await saveRoleSelection(paramRole);
        if (mounted) setRole(paramRole);
        return;
      }

      const stored = await getRoleSelection();
      if (stored && mounted) {
        setRole(stored);
      }
    };

    initRole();
    return () => {
      mounted = false;
    };
  }, [route.params?.role]);

  const handleLogin = async () => {

    if (!privacyAccepted) {
      Alert.alert("تنبيه", "يرجى الموافقة على سياسة الخصوصية قبل تسجيل الدخول.");
      return;
    }

    if (!phone || !password) {
      Alert.alert("Error", "يرجى إدخال رقم الهاتف والرمز");
      return;
    }

    // تحقق من رقم الهاتف: 10 أرقام ويبدأ بـ7 (السيرفر سيخزنه كـ +964 تلقائياً)
    const phoneDigits = normalizeIraqPhoneTo10Digits(phone);
    if (phoneDigits.length !== 10 || !phoneDigits.startsWith("7")) {
      Alert.alert("خطأ", "رقم الهاتف يجب أن يكون 10 أرقام ويبدأ بـ7");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDigits, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert("Login Failed", data.message || "رقم أو كلمة مرور غير صحيحة");
        return;
      }

      // إذا تم تسجيل الدخول مباشرة (بدون رمز)
      if (data.token) {
        const api = await import("../lib/api");
        await api.saveToken(data.token);
        if (data.refreshToken) {
          await api.saveRefreshToken(data.refreshToken);
        }
        await api.saveUserRole(data.user?.role || role);

        // 🔔 Register push token immediately after login
        try {
          const push = await import("../lib/pushNotifications");
          const { expoPushToken } = await push.registerForPushNotificationsAsync() || {};
          if (expoPushToken) {
            await api.registerPushTokens({ expoPushToken });
          }
        } catch (pushErr) {
          console.log("Push registration after login failed:", pushErr);
        }

        const destination = (data.user?.role || role) === "doctor" ? "ProviderTabs" : "MainTabs";
        navigation.reset({ index: 0, routes: [{ name: destination }] });
        return;
      }

      // OTP disabled; token should always be returned on success.
      Alert.alert("Login Failed", "تعذر تسجيل الدخول. حاول مرة أخرى لاحقاً.");
    } catch (err) {
      console.log("Login error:", err);
      Alert.alert("Error", "Something went wrong, please try again");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "نسيت الرمز؟",
      "ميزة استعادة الرمز غير مفعلة حالياً.",
      [
        { text: "سياسة الخصوصية", onPress: openPrivacyPolicy },
        { text: "حسناً" },
      ]
    );
  };

  const handleRoleSwitch = async () => {
    await logout();
    navigation.replace("RoleSelection");
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
      {/* Logo + Header */}
      <View style={styles.header}>
      
          
          
          
      <View >
        <Image
          source={require("../assets/images/im3.png")}
          style={styles.logo}
        />
      </View>
        <Text style={styles.appName}>MediCare</Text>
        <Text style={styles.tagline}>
          {role === "doctor" ? "دخول الأطباء" : "دخول المراجعين"}
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>رقم الهاتف</Text>
          <TextInput
            placeholder="أدخل 10 أرقام تبدأ بـ7"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            keyboardType="phone-pad"
            autoCapitalize="none"
            value={phone}
            maxLength={10}
            onChangeText={(t) => setPhone(normalizeIraqPhoneTo10Digits(t))}
            multiline={false}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>الرمز</Text>
          <View style={styles.passwordRow}>
            <TextInput
              placeholder="أدخل رمزك"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, styles.passwordInput]}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              multiline={false}
              scrollEnabled={false}
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              <Text style={styles.showPasswordText}>{showPassword ? "إخفاء" : "إظهار"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "تسجيل الدخول..." : "تسجيل الدخول"}
          </Text>
        </TouchableOpacity>

        <View style={styles.consentRow}>
          <TouchableOpacity
            style={[styles.checkbox, privacyAccepted && styles.checkboxChecked]}
            onPress={() => setPrivacyAccepted((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: privacyAccepted }}
          >
            {privacyAccepted ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </TouchableOpacity>
          <Text style={styles.consentText}>
            أوافق على{" "}
            <Text style={styles.consentLink} onPress={openPrivacyPolicy}>
              سياسة الخصوصية
            </Text>
          </Text>
        </View>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("Signup", { role })}
        >
          <Text style={styles.secondaryButtonText}>إنشاء حساب</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.center} onPress={handleForgotPassword}>
          <Text style={styles.linkText}>نسيت الرمز؟</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.center} onPress={handleRoleSwitch}>
          <Text style={[styles.linkText, { color: colors.primary }]}>تغيير نوع الحساب أو تسجيل خروج</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingVertical: 32,
      justifyContent: "flex-start",
      paddingBottom: 48,
    },
    header: {
      alignItems: "center",
      marginTop: 40,
    },
    logo: {
      width: 275,
      height: 240,
      borderRadius: 30,
      marginBottom: 16,
      marginTop: 90,
    },
    appName: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    tagline: {
      fontSize: 14,
      color: colors.textMuted,
    },
    form: {
      textAlign: "right",
    },
    consentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
      marginTop: 12,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkboxMark: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 16,
    },
    consentText: {
      flex: 1,
      color: colors.text,
      textAlign: "left",
    },
    consentLink: {
      color: colors.primary,
      textDecorationLine: "underline",
      fontWeight: "600",
    },
    field: {
      marginBottom: 16,
    },
    label: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 6,
      textAlign: "left",
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      textAlign: "right",
    },
    passwordRow: {
      position: "relative",
      justifyContent: "center",
    },
    passwordInput: {
      paddingLeft: 84,
    },
    showPasswordButton: {
      position: "absolute",
      left: 12,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    showPasswordText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600",
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    primaryButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    secondaryButton: {
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 16,
    },
    center: {
      marginTop: 12,
      alignItems: "center",
    },
    linkText: {
      fontSize: 14,
      color: colors.primary,
    },
  });
