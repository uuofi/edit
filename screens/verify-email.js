// app/verify-email.js
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { API_BASE_URL, registerExpoPushToken, saveToken, saveUserRole } from "../lib/api";
import { getExpoPushTokenOrThrow } from "../lib/pushNotifications";

import { useAppTheme } from "../lib/useTheme";

export default function VerifyEmailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params || {};

  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const phone = params.phone;
  const mode = params.mode || "signup"; // "signup" أو "login"
  const isLoginFlow = mode === "login";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (!phone) {
      Alert.alert("خطأ", "رقم الهاتف مفقود");
      return;
    }
    if (!code) {
      Alert.alert("خطأ", "الرجاء إدخال الكود");
      return;
    }

    try {
      setLoading(true);

      const url = isLoginFlow
        ? `${API_BASE_URL}/api/auth/login/verify`
        : `${API_BASE_URL}/api/auth/verify`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert("فشل التحقق", data.message || "كود غير صالح");
        return;
      }

      const resolvedRole = data.user?.role || params.role || "patient";
      await saveUserRole(resolvedRole);

      // If backend does not return a token (e.g., doctor pending approval), do not proceed.
      if (!data.token) {
        Alert.alert(
          "تم استلام الطلب",
          data.message || "حسابك قيد المراجعة. سيتم تفعيل حسابك بعد موافقة الإدارة.",
          [{ text: "حسناً", onPress: () => navigation.replace("Login", { role: resolvedRole }) }]
        );
        return;
      }

      await saveToken(data.token);

      // 🔔 Register push token immediately after login
      try {
        const api = await import("../lib/api");
        const push = await import("../lib/pushNotifications");
        try {
          const expoPushToken = await getExpoPushTokenOrThrow();
          await registerExpoPushToken(expoPushToken);
        } catch (err) {
          console.log('Push notification setup error:', err);
        }
      } catch (pushErr) {
        console.log("Push registration after verify failed:", pushErr);
      }

      Alert.alert("نجاح", isLoginFlow ? "تم تسجيل الدخول" : "تم التحقق من الرقم");

      const destination = resolvedRole === "doctor" ? "ProviderTabs" : "MainTabs";
      navigation.reset({ index: 0, routes: [{ name: destination }] });
    } catch (err) {
      console.log("Verify error:", err);
      Alert.alert("خطأ", "حدث خطأ، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (isLoginFlow) return; // إعادة إرسال مفعّلة فقط لحالة signup

    if (!phone) {
      Alert.alert("خطأ", "رقم الهاتف مفقود");
      return;
    }

    try {
      setResending(true);

      const res = await fetch(`${API_BASE_URL}/api/auth/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert("خطأ", data.message || "تعذّر إعادة إرسال الكود");
        return;
      }

      Alert.alert("نجاح", data.message || "تم إعادة إرسال الكود إلى رقمك");
    } catch (err) {
      console.log("Resend error:", err);
      Alert.alert("خطأ", "حدث خطأ");
    } finally {
      setResending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logo} />
        <Text style={styles.appName}>MediCare</Text>
        <Text style={styles.tagline}>
          {isLoginFlow ? "أدخل كود الدخول" : "تحقق من رقم هاتفك"}
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.infoText}>
          {isLoginFlow
            ? "أرسلنا كود الدخول إلى رقمك:"
            : "أرسلنا كود التحقق إلى رقمك:"}
        </Text>
        <Text style={styles.emailText}>{phone}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>
            {isLoginFlow ? "كود الدخول" : "كود التحقق"}
          </Text>
          <TextInput
            placeholder={
              isLoginFlow
                ? "أدخل الكود المكوّن من ٦ أرقام"
                : "أدخل كود التحقق المكوّن من ٦ أرقام"
            }
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            maxLength={6}
          />
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleVerify}
          disabled={loading}
        >
            <Text style={styles.primaryButtonText}>
              {loading
                ? "جارٍ التحقق..."
                : isLoginFlow
                ? "تأكيد الدخول"
                : "تحقق من الرقم"}
            </Text>
        </TouchableOpacity>

        {!isLoginFlow && (
          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resending}
          >
            <Text style={styles.resendText}>
              {resending ? "جارٍ الإرسال..." : "إعادة إرسال الكود"}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            navigation.replace(isLoginFlow ? "Login" : "Signup", {
              role: params.role,
            })
          }
        >
          <Text style={styles.secondaryButtonText}>
            {isLoginFlow ? "العودة لتسجيل الدخول" : "العودة للتسجيل"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingVertical: 32,
      justifyContent: "space-between",
    },
    header: {
      alignItems: "center",
      marginTop: 40,
    },
    logo: {
      width: 96,
      height: 96,
      backgroundColor: colors.primary,
      borderRadius: 24,
      marginBottom: 16,
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
      textAlign: "center",
      writingDirection: "rtl",
    },
    
    field: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 6,
      textAlign: "right",
      writingDirection: "rtl",
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
      textAlign: "center",
      writingDirection: "rtl",
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
    resendButton: {
      marginTop: 10,
      alignItems: "center",
    },
    resendText: {
      fontSize: 14,
      color: colors.primary,
      textDecorationLine: "underline",
    },
    secondaryButton: {
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    secondaryButtonText: {
      color: colors.textMuted,
      fontSize: 16,
      textAlign: "center",
      writingDirection: "rtl",
    },
  });
