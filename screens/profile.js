// app/profile.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { getToken, logout, request } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";


export default function ProfileScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchProfile = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        navigation.replace("Login");
        return;
      }

      const data = await request("/api/auth/me");
      setUser(data.user || data);
    } catch (err) {
      console.log("Profile error:", err);
      if (err.status === 401 || err.status === 403) {
        Alert.alert("انتهت الجلسة", "يرجى تسجيل الدخول من جديد.", [
          { text: "إلغاء", style: "cancel" },
          {
            text: "تسجيل الدخول",
            onPress: () => logout().finally(() => navigation.replace("Login")),
          },
        ]);
        return;
      }
      Alert.alert("Error", "Could not load profile");
    }
  }, [navigation]);

  const handleLogout = async () => {
    await logout();
    navigation.replace("Login");
  };

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const displayName = user?.name || "John Doe";
  const displayPhone = user?.phone || "غير متوفر";
  const initials = displayName
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.info}>رقم حسابك: {displayPhone}</Text>
        </View>

        <View style={styles.menuList}>
          <MenuItem
            icon="user"
            iconBg="#EFF6FF"
            iconColor="#0EA5E9"
            title="المعلومات الشخصية"
            onPress={() => navigation.navigate("PersonalInfo")}
            styles={styles}
          />
          <MenuItem
            icon="settings"
            iconBg="#ECFDF3"
            iconColor="#16A34A"
            title="الإعدادات"
            onPress={() => navigation.navigate("ProfileSettings")}
            styles={styles}
          />
          <MenuItem
            icon="help-circle"
            iconBg="#FFF7ED"
            iconColor="#000000ff"
            title="مساعدة ودعم"
            onPress={() => navigation.navigate("Support")}
            styles={styles}
          />
          <MenuItem
            icon="log-out"
            iconBg="#FEF2F2"
            iconColor="#DC2626"
            title="تسجيل خروج"
            titleColor="#DC2626"
            borderRed
            onPress={handleLogout}
            styles={styles}
          />
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  iconBg,
  iconColor,
  title,
  titleColor,
  borderRed,
  onPress,
  styles,
}) {
  const { colors } = useAppTheme();
  const resolvedTitleColor = titleColor || colors.text;

  return (
    <TouchableOpacity
      style={[
        styles.menuItem,
        borderRed && { borderWidth: 2, borderColor: "#FEE2E2" },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.menuIconWrapper, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.menuTitle, { color: resolvedTitleColor }]}>{title}</Text>
      <Feather name="chevron-right" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      textAlign: "center",
      fontSize: 18,
      color: colors.text,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    userCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 20,
      paddingHorizontal: 16,
      alignItems: "center",
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    avatarText: {
      color: "#FFFFFF",
      fontSize: 28,
      fontWeight: "700",
    },
    name: {
      fontSize: 18,
      color: colors.text,
      fontWeight: "600",
      marginBottom: 4,
    },
    info: {
      fontSize: 13,
      color: colors.textMuted,
    },
    menuList: {
      gap: 8,
      marginTop: 8,
    },
    menuItem: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    menuIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    menuTitle: {
      flex: 1,
      fontSize: 15,
    },
  });

