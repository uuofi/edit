import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ArrowRight, Stethoscope, User, ShieldCheck } from "lucide-react-native";
import {
  clearExpoPushToken,
  clearUserRole,
  saveRefreshToken,
  saveRoleSelection,
  saveToken,
} from "../lib/api";
import authColors from "../lib/authTheme";

const options = [
  {
    value: "patient",
    title: "مراجع",
    description: "أبحث عن الأطباء وأحجز المواعيد بسهولة",
    Icon: User,
  },
  {
    value: "doctor",
    title: "دكتور",
    description: "أقدم الرعاية الطبية وأدير مواعيد المرضى",
    Icon: Stethoscope,
  },
  // {
  //   value: "lab",
  //   title: "مختبر",
  //   description: "إدارة الفحوصات، إدخال النتائج، متابعة الطلبات.",
  //   Icon: FlaskConical,
  // },
];

function AuraLogo() {
  return (
    <View style={logoStyles.mark}>
      <View style={[logoStyles.petal, logoStyles.petalTL]} />
      <View style={[logoStyles.petal, logoStyles.petalTR]} />
      <View style={[logoStyles.petal, logoStyles.petalBL]} />
      <View style={[logoStyles.petal, logoStyles.petalBR]} />
    </View>
  );
}

export default function RoleSelectionScreen() {
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(), []);

  const handleSelect = async (role) => {
    try {
      await saveToken(null);
      await saveRefreshToken(null);
      await clearExpoPushToken();
      await clearUserRole();
      await saveRoleSelection(role);
    } catch (error) {
      console.warn("Failed to save selected role:", error);
    } finally {
      navigation.reset({ index: 0, routes: [{ name: "Login", params: { role } }] });
    }
  };

  const handleBack = () => {
    // العودة إلى الصفحات التعليمية (Onboarding)
    navigation.navigate("Onboarding");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Back to onboarding */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="العودة إلى الصفحات التعليمية"
        >
          <ArrowRight size={24} color={authColors.heading} strokeWidth={2.2} />
        </TouchableOpacity>

        {/* Brand */}
        <View style={styles.brand}>
          <AuraLogo />
          <Text style={styles.brandName}>Aura</Text>
        </View>

        {/* Header */}
        <Text style={styles.title}>مرحبًا بك في أورا</Text>
        <Text style={styles.subtitle}>
          يرجى اختيار نوع الحساب المناسب لك{"\n"}لتتمكن من تخصيص تجربتك بشكل أفضل
        </Text>

        {/* Role cards */}
        <View style={styles.cards}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => handleSelect(option.value)}
            >
              <View style={styles.avatar}>
                <option.Icon size={44} color={authColors.primary} strokeWidth={1.7} />
              </View>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardDescription}>{option.description}</Text>
              <View style={styles.cardButton}>
                <option.Icon size={22} color={authColors.onPrimary} strokeWidth={2} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Privacy reassurance */}
        <View style={styles.privacyCard}>
          <View style={styles.privacyIcon}>
            <ShieldCheck size={24} color={authColors.primary} strokeWidth={2} />
          </View>
          <View style={styles.privacyTextWrap}>
            <Text style={styles.privacyTitle}>خصوصيتك وأمان بياناتك هي أولويتنا</Text>
            <Text style={styles.privacyText}>
              جميع بياناتك محمية ولن تتم مشاركتها مع أي طرف ثالث
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerHint}>لديك حساب بالفعل؟</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Login")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.footerLink}>تسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const logoStyles = StyleSheet.create({
  mark: {
    width: 54,
    height: 54,
    marginBottom: 10,
  },
  petal: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 13,
  },
  petalTL: {
    top: 0,
    left: 0,
    backgroundColor: "#A8C9C1",
    borderBottomRightRadius: 6,
  },
  petalTR: {
    top: 0,
    right: 0,
    backgroundColor: authColors.primary,
    borderBottomLeftRadius: 6,
  },
  petalBL: {
    bottom: 0,
    left: 0,
    backgroundColor: "#6FA89C",
    borderTopRightRadius: 6,
  },
  petalBR: {
    bottom: 0,
    right: 0,
    backgroundColor: "#3F5B56",
    borderTopLeftRadius: 6,
  },
});

const createStyles = () =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: authColors.background,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 28,
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
      alignSelf: "flex-start",
    },
    brand: {
      alignItems: "center",
      marginTop: 8,
    },
    brandName: {
      fontSize: 24,
      fontWeight: "700",
      color: authColors.heading,
      letterSpacing: 0.5,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: authColors.heading,
      textAlign: "center",
      writingDirection: "rtl",
      marginTop: 24,
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 15,
      color: authColors.muted,
      textAlign: "center",
      writingDirection: "rtl",
      lineHeight: 26,
      marginBottom: 28,
    },
    cards: {
      flexDirection: "row",
      gap: 14,
    },
    card: {
      flex: 1,
      backgroundColor: authColors.card,
      borderRadius: 24,
      paddingVertical: 22,
      paddingHorizontal: 16,
      alignItems: "center",
      shadowColor: "#1E3A34",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    avatar: {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: authColors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: authColors.heading,
      textAlign: "center",
      writingDirection: "rtl",
      marginBottom: 8,
    },
    cardDescription: {
      fontSize: 13.5,
      color: authColors.muted,
      textAlign: "center",
      writingDirection: "rtl",
      lineHeight: 22,
      marginBottom: 18,
      minHeight: 44,
    },
    cardButton: {
      width: "100%",
      height: 52,
      borderRadius: 16,
      backgroundColor: authColors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    privacyCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: authColors.card,
      borderRadius: 20,
      padding: 18,
      marginTop: 26,
      shadowColor: "#1E3A34",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.05,
      shadowRadius: 14,
      elevation: 2,
    },
    privacyIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: authColors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    privacyTextWrap: {
      flex: 1,
    },
    privacyTitle: {
      fontSize: 14.5,
      fontWeight: "700",
      color: authColors.heading,
      textAlign: "right",
      writingDirection: "rtl",
      marginBottom: 4,
    },
    privacyText: {
      fontSize: 13,
      color: authColors.muted,
      textAlign: "right",
      writingDirection: "rtl",
      lineHeight: 20,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 28,
    },
    footerHint: {
      fontSize: 15,
      color: authColors.muted,
    },
    footerLink: {
      fontSize: 15,
      fontWeight: "700",
      color: authColors.primary,
    },
  });
