import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "../lib/useTheme";

const contactItems = [
  {
    icon: "phone-call",
    title: "اتصل بنا",
    subtitle: "07839188916",
    action: () => Linking.openURL("tel:07839188916"),
    tone: "primary",
  },
  {
    icon: "mail",
    title: "إيميل الدعم",
    subtitle: "support@medicare.sa",
    action: () => Linking.openURL("mailto:support@medicare.sa"),
    tone: "primary",
  },
  {
    icon: "message-square",
    title: "الدردشة الفورية",
    subtitle: "يفتح واتساب للدعم",
    action: () => Linking.openURL("https://wa.me/966500000000"),
    tone: "success",
  },
];

const faqItems = [
  {
    q: "كيف أسجل دخول؟",
    a: "ادخل رقم جوالك ثم كلمة المرور، سيصلك رمز دخول للتحقق." ,
  },
  {
    q: "لم يصلني رمز التفعيل؟",
    a: "تأكد من تغطية الشبكة واضغط إعادة إرسال، أو تواصل معنا ليتحقق الفريق.",
  },
  {
    q: "كيف أغيّر كلمة المرور؟",
    a: "من صفحة الإعدادات > الأمان يمكنك تغيير كلمة المرور بعد إدخال الكود." ,
  },
];

export default function SupportScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const handlePress = async (action) => {
    try {
      await action();
    } catch (_err) {
      Alert.alert("خطأ", "تعذر فتح وسيلة التواصل، جرّب لاحقًا");
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-right" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>مساعدة ودعم</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>وسائل التواصل</Text>
          {contactItems.map((item) => (
            (() => {
              const toneColor = item.tone === "success" ? colors.success : colors.primary;
              const iconBg = `${toneColor}1A`;
              return (
            <TouchableOpacity
              key={item.title}
              style={styles.contactRow}
              onPress={() => handlePress(item.action)}
              activeOpacity={0.8}
            >
              <View style={[styles.contactIcon, { backgroundColor: iconBg }]}>
                <Feather name={item.icon} size={18} color={toneColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactTitle}>{item.title}</Text>
                <Text style={styles.contactSubtitle}>{item.subtitle}</Text>
              </View>
              <Feather name="chevron-left" size={18} color={colors.textMuted} />
            </TouchableOpacity>
              );
            })()
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>الأسئلة الشائعة</Text>
          {faqItems.map((item, idx) => (
            <View key={item.q} style={[styles.faqItem, idx < faqItems.length - 1 && styles.faqDivider]}>
              <Text style={styles.faqQ}>{item.q}</Text>
              <Text style={styles.faqA}>{item.a}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surfaceAlt },
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
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    contactRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      gap: 12,
    },
    contactIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    contactTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
    contactSubtitle: { fontSize: 13, color: colors.textMuted },
    faqItem: { gap: 6, paddingVertical: 8 },
    faqDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    faqQ: { fontSize: 14, fontWeight: "700", color: colors.text },
    faqA: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  });
