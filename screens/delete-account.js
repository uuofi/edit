import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { deleteMyAccount, logout } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

export default function DeleteAccountScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    if (deleting) return;
    if (!password) {
      Alert.alert("خطأ", "يرجى إدخال كلمة المرور لتأكيد الحذف");
      return;
    }

    Alert.alert(
      "تأكيد حذف الحساب",
      "سيتم حذف حسابك نهائياً وجميع البيانات المرتبطة به. هل أنت متأكد؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف الحساب",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteMyAccount(password);
              await logout();
              navigation.reset({ index: 0, routes: [{ name: "RoleSelection" }] });
              Alert.alert("تم", "تم حذف الحساب بنجاح");
            } catch (err) {
              const msg = err?.payload?.message || err?.message || "تعذر حذف الحساب";
              Alert.alert("خطأ", msg);
            } finally {
              setDeleting(false);
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
        <Text style={styles.headerTitle}>حذف الحساب</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.warningTitle}>تنبيه</Text>
          <Text style={styles.warningText}>
            حذف الحساب نهائي ولا يمكن التراجع عنه.
          </Text>

          <Text style={styles.label}>كلمة المرور</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.placeholder}
          />

          <TouchableOpacity
            style={[styles.dangerBtn, deleting && { opacity: 0.7 }]}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.dangerText}>حذف الحساب</Text>
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
    backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
    body: { padding: 16 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    warningTitle: { fontSize: 16, fontWeight: "700", color: "#DC2626" },
    warningText: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20 },
    label: { fontSize: 13, color: colors.textMuted, marginTop: 14 },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 14,
      marginTop: 6,
      color: colors.text,
    },
    dangerBtn: {
      marginTop: 16,
      backgroundColor: "#DC2626",
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    dangerText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  });
