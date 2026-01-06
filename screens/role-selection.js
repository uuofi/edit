import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { saveRoleSelection } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const options = [
  {
    value: "patient",
    title: "مراجع",
    description: "احجز مواعيدك، اطلع على الأطباء، تابع حالتك.",
  },
  {
    value: "doctor",
    title: "دكتور",
    description: "إدارة جدولك، عرض المرضى، متابعة الحجز.",
  },
];

export default function RoleSelectionScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSelect = async (role) => {
    await saveRoleSelection(role);
    navigation.replace("Login", { role });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Image source={require("../assets/images/im5.png")} style={{ width: "100%", height: 300, marginBottom: 24 }} />
        <Text style={styles.title}>اختر نوع الحساب</Text>
        <Text style={styles.subtitle}>
          قبل تسجيل الدخول أو إنشاء حساب، حدد إذا كنت مراجعاً أو طبيباً حتى
          نحافظ على تجربة مخصصة.
        </Text>

        <View style={styles.cards}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.card}
              onPress={() => handleSelect(option.value)}
            >
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardDescription}>{option.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.replace("MainTabs")}
        >
          <Text style={styles.skipText}>تخطي - تصفح التطبيق</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: {
      flex: 1,
      padding: 24,
      justifyContent: "center",
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 12,
      color: colors.text,
    },
    subtitle: {
      textAlign: "center",
      color: colors.textMuted,
      marginBottom: 24,
      lineHeight: 20,
    },
    cards: {
      flexDirection: "column",
    },
    card: {
      backgroundColor: colors.surface,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "600",
      textAlign: "right",
      color: colors.text,
    },
    cardDescription: {
      marginTop: 6,
      color: colors.textMuted,
      textAlign: "right",
      lineHeight: 18,
    },
    skipButton: {
      marginTop: 32,
      alignItems: "center",
    },
    skipText: {
      color: colors.primary,
      fontWeight: "500",
    },
  });
