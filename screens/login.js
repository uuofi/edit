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
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { ArrowRight, Phone, Lock, Eye, EyeOff, ScanFace } from "lucide-react-native";
import {
  API_BASE_URL,
  clearExpoPushToken,
  clearUserRole,
  normalizeUserRole,
  saveRoleSelection,
  saveRefreshToken,
  saveToken,
  getRoleSelection,
  logout,
  getToken,
  getUserRole,
} from "../lib/api";
import authColors from "../lib/authTheme";
import { getSupportWhatsAppNumber } from "../lib/supportConfig";

export default function LoginScreen() {
  const styles = useMemo(() => createStyles(), []);
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params || {};
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(params.role || "patient");

  const extra =
    Constants?.expoConfig?.extra ||
    Constants?.manifest?.extra ||
    Constants?.manifest2?.extra ||
    {};
  const privacyPolicyUrl = String(extra?.privacyPolicyUrl || "https://medicare-iq.com/privacy").trim();
  const termsUrl = String(extra?.termsUrl || "https://medicare-iq.com/terms").trim();
  const supportWhatsAppDefault = getSupportWhatsAppNumber();

  const normalizeWhatsApp = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("964")) return digits;
    if (digits.startsWith("0")) return `964${digits.slice(1)}`;
    return digits;
  };

  const openSupportWhatsApp = async (inputNumber) => {
    const normalized = normalizeWhatsApp(inputNumber || supportWhatsAppDefault);
    if (!normalized) {
      Alert.alert("تنبيه", "رقم واتساب الدعم غير مضبوط حالياً.");
      return;
    }

    const text = encodeURIComponent("مرحبا، انتهى اشتراك حساب الدكتور وأرغب بتجديده.");
    const waUrl = `https://wa.me/${normalized}?text=${text}`;

    try {
      await Linking.openURL(waUrl);
    } catch {
      Alert.alert("خطأ", "تعذر فتح واتساب حالياً.");
    }
  };

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

  const openTerms = async () => {
    const url = String(termsUrl || "").trim();
    if (!url) {
      Alert.alert("تنبيه", "رابط شروط الخدمة غير متوفر حالياً.");
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("خطأ", "تعذّر فتح رابط شروط الخدمة.");
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

        const storedRole = normalizeUserRole(await getUserRole());
        const routeRole = normalizeUserRole(params.role);
        const selectedRole = normalizeUserRole(await getRoleSelection());
        const resolvedRole = storedRole || routeRole || selectedRole;

        if (!resolvedRole) {
          await saveToken(null);
          await saveRefreshToken(null);
          await clearExpoPushToken();
          await clearUserRole();
          return;
        }

        const destination = (resolvedRole === "doctor" || resolvedRole === "secretary") ? "ProviderTabs" : resolvedRole === "lab" ? "LabTabs" : "MainTabs";
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
    if (!phone || !password) {
      Alert.alert("تنبيه", "يرجى إدخال رقم الهاتف والرمز");
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

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneDigits,
          password,
          selectedRole: role,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();

      if (!res.ok) {
        const status = Number(res.status || 0);
        const errorCode = String(data?.code || "").trim();
        const message = String(data?.message || "").trim();

        if (normalizeUserRole(role) === "doctor") {
          if (errorCode === "DOCTOR_ACCOUNT_NOT_FOUND" || status === 404) {
            Alert.alert("تنبيه", "حساب الدكتور غير موجود");
            return;
          }

          if (errorCode === "DOCTOR_SUBSCRIPTION_EXPIRED") {
            Alert.alert(
              "انتهاء الاشتراك",
              message || "انتهى اشتراكك. يرجى التواصل مع الدعم لتجديد الاشتراك",
              [
                {
                  text: "واتساب الدعم",
                  onPress: () => {
                    void openSupportWhatsApp();
                  },
                },
                { text: "إغلاق", style: "cancel" },
              ]
            );
            return;
          }
        }

        Alert.alert("فشل تسجيل الدخول", message || "رقم أو كلمة مرور غير صحيحة");
        return;
      }

      // إذا تم تسجيل الدخول مباشرة (بدون رمز)
      if (data.token) {
        const api = await import("../lib/api");
        await api.saveToken(data.token);
        if (data.refreshToken) {
          await api.saveRefreshToken(data.refreshToken);
        }
        const resolvedRole = normalizeUserRole(data.user?.role || role);
        await api.saveUserRole(resolvedRole);

        // 🔔 Request push permission + register token BEFORE navigation
        try {
          console.log("[Login] Starting push registration...");
          const push = await import("../lib/pushNotifications");
          const result = await push.registerForPushNotificationsAsync();
          const expoPushToken = result?.expoPushToken;
          console.log("[Login] Push token result:", expoPushToken ? "GOT TOKEN" : "NO TOKEN");
          if (expoPushToken) {
            console.log("[Login] Sending token to backend...");
            await api.registerExpoPushToken(expoPushToken);
            console.log("[Login] ✅ Push token registered with backend");
          }
        } catch (pushErr) {
          console.log("[Login] Push registration error:", pushErr?.message || pushErr);
        }

        const destination =
          resolvedRole === "doctor" || resolvedRole === "secretary"
            ? "ProviderTabs"
            : resolvedRole === "lab"
            ? "LabTabs"
            : resolvedRole === "patient"
            ? "MainTabs"
            : "RoleSelection";
        navigation.reset({ index: 0, routes: [{ name: destination }] });
        return;
      }

      // OTP disabled; token should always be returned on success.
      Alert.alert("فشل تسجيل الدخول", "تعذر تسجيل الدخول. حاول مرة أخرى لاحقاً.");
    } catch (err) {
      console.log("Login error:", err);
      Alert.alert("خطأ", "حدث خطأ ما، يرجى المحاولة مرة أخرى");
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

  const handleFaceLogin = () => {
    Alert.alert("الدخول بالبصمة", "ميزة الدخول باستخدام بصمة الوجه قيد التفعيل قريباً.");
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace("RoleSelection");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
          >
            <ArrowRight size={24} color={authColors.heading} strokeWidth={2.2} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>أهلاً بك مجدداً</Text>
            <Text style={styles.subtitle}>
              {role === "doctor" ? "تسجيل دخول الأطباء إلى حسابك" : "تسجيل الدخول إلى حسابك"}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>رقم الهاتف</Text>
              <View style={styles.inputWrap}>
                <Phone size={20} color={authColors.muted} strokeWidth={2} />
                <TextInput
                  placeholder="أدخل 10 أرقام تبدأ بـ7"
                  placeholderTextColor={authColors.muted}
                  style={styles.input}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  textContentType="telephoneNumber"
                  value={phone}
                  maxLength={10}
                  onChangeText={(t) => setPhone(normalizeIraqPhoneTo10Digits(t))}
                  multiline={false}
                  scrollEnabled={false}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>كلمة المرور</Text>
              <View style={styles.inputWrap}>
                <Lock size={20} color={authColors.muted} strokeWidth={2} />
                <TextInput
                  placeholder="أدخل رمزك"
                  placeholderTextColor={authColors.muted}
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  value={password}
                  onChangeText={setPassword}
                  multiline={false}
                  scrollEnabled={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={authColors.muted} strokeWidth={2} />
                  ) : (
                    <Eye size={20} color={authColors.muted} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.forgotRow} onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>نسيت الرمز؟</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>أو</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Face ID */}
            <TouchableOpacity
              style={styles.faceButton}
              onPress={handleFaceLogin}
              activeOpacity={0.85}
            >
              <ScanFace size={22} color={authColors.primary} strokeWidth={2} />
              <Text style={styles.faceButtonText}>الدخول باستخدام بصمة الوجه</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.signupRow}>
              <Text style={styles.signupHint}>ليس لديك حساب؟ </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate(role === "lab" ? "LabSignup" : "Signup", { role })}
              >
                <Text style={styles.signupLink}>إنشاء حساب</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.switchRow} onPress={handleRoleSwitch}>
              <Text style={styles.switchText}>تغيير نوع الحساب أو تسجيل خروج</Text>
            </TouchableOpacity>

            <Text style={styles.consentNote}>
              بتسجيل دخولك، أنت توافق على{" "}
              <Text style={styles.consentLink} onPress={openPrivacyPolicy}>سياسة الخصوصية</Text>
              {" "}و{" "}
              <Text style={styles.consentLink} onPress={openTerms}>شروط الخدمة</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = () =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: authColors.background,
    },
    root: {
      flex: 1,
      backgroundColor: authColors.background,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 32,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: authColors.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: authColors.inputBorder,
    },
    header: {
      marginTop: 28,
      marginBottom: 28,
      alignItems: "center",
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: authColors.heading,
      textAlign: "center",
      writingDirection: "rtl",
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: authColors.muted,
      textAlign: "center",
      writingDirection: "rtl",
    },
    form: {
      marginTop: 4,
    },
    field: {
      marginBottom: 18,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: authColors.body,
      marginBottom: 8,
      textAlign: "right",
      writingDirection: "rtl",
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: authColors.inputBg,
      borderWidth: 1,
      borderColor: authColors.inputBorder,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 56,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: authColors.heading,
      textAlign: "right",
      writingDirection: "rtl",
      paddingVertical: 0,
    },
    forgotRow: {
      alignSelf: "flex-start",
      marginTop: 2,
      marginBottom: 22,
    },
    forgotText: {
      fontSize: 14,
      color: authColors.primary,
      fontWeight: "600",
    },
    primaryButton: {
      backgroundColor: authColors.primary,
      borderRadius: 16,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: authColors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 4,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: authColors.onPrimary,
      fontSize: 17,
      fontWeight: "700",
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 24,
      gap: 12,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: authColors.divider,
    },
    dividerText: {
      fontSize: 14,
      color: authColors.muted,
    },
    faceButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 56,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: authColors.primarySoftBorder,
      backgroundColor: authColors.card,
    },
    faceButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: authColors.body,
    },
    footer: {
      marginTop: 28,
      alignItems: "center",
    },
    signupRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    signupHint: {
      fontSize: 15,
      color: authColors.muted,
    },
    signupLink: {
      fontSize: 15,
      color: authColors.primary,
      fontWeight: "700",
    },
    switchRow: {
      marginTop: 16,
    },
    switchText: {
      fontSize: 13,
      color: authColors.muted,
      textDecorationLine: "underline",
    },
    consentNote: {
      marginTop: 18,
      fontSize: 12,
      lineHeight: 20,
      color: authColors.muted,
      textAlign: "center",
      writingDirection: "rtl",
      paddingHorizontal: 8,
    },
    consentLink: {
      color: authColors.primary,
      fontWeight: "600",
    },
  });
