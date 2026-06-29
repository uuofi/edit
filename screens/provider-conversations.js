import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { fetchDoctorChatConversations } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const formatRelativeTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) return "الآن";
  if (diffMinutes < 60) return `قبل ${diffMinutes} د`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `قبل ${diffHours} س`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `قبل ${diffDays} يوم`;

  try {
    return date.toLocaleDateString("ar-IQ", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
};

const trimPreview = (value) => {
  const text = String(value || "").trim();
  if (!text) return "لا توجد رسائل";
  if (text.length <= 80) return text;
  return `${text.slice(0, 80)}...`;
};

export default function ProviderConversationsScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  const openDrawer = useCallback(() => {
    if (typeof navigation?.openDrawer === "function") {
      navigation.openDrawer();
      return;
    }

    const parent = navigation?.getParent?.();
    if (typeof parent?.openDrawer === "function") {
      parent.openDrawer();
    }
  }, [navigation]);

  const loadConversations = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setErrorMessage("");
    }

    try {
      const response = await fetchDoctorChatConversations({ limit: 100 });
      setConversations(Array.isArray(response?.conversations) ? response.conversations : []);
      setErrorMessage("");
    } catch (err) {
      if (!silent) {
        setErrorMessage(String(err?.message || "تعذر تحميل المحادثات"));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const runLoad = async () => {
        if (!active) return;
        await loadConversations();
      };

      runLoad();

      const intervalId = setInterval(() => {
        if (!active) return;
        void loadConversations({ silent: true });
      }, 12000);

      return () => {
        active = false;
        clearInterval(intervalId);
      };
    }, [loadConversations])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadConversations({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadConversations]);

  const openConversation = useCallback(
    (item) => {
      const patientId = String(item?.patient?.id || "").trim();
      if (!patientId) return;

      navigation.navigate("AppointmentChat", {
        patientId,
        patientName: item?.patient?.name || "المراجع",
      });
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>المحادثات</Text>
          <Text style={styles.headerSubtitle}>كل محادثاتك مع المرضى بمكان واحد</Text>
        </View>

        <TouchableOpacity onPress={openDrawer} style={styles.headerIconButton}>
          <Feather name="menu" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item, index) => String(item?.conversationKey || `conv-${index}`)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Feather name="message-circle" size={24} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>لا توجد محادثات حالياً</Text>
              <Text style={styles.emptyHint}>ستظهر هنا أي محادثة تبدأها مع المريض</Text>
            </View>
          }
          ListHeaderComponent={
            errorMessage ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color={colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const unreadCount = Math.max(0, Number(item?.unreadCount || 0) || 0);
            const preview = trimPreview(item?.lastMessagePreview);
            const relativeTime = formatRelativeTime(item?.lastMessageAt);

            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => openConversation(item)}
              >
                <View style={styles.avatarWrap}>
                  <Feather name="user" size={18} color={colors.primary} />
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.nameText} numberOfLines={1}>
                      {item?.patient?.name || "المراجع"}
                    </Text>
                    <Text style={styles.timeText}>{relativeTime}</Text>
                  </View>

                  <View style={styles.cardBottomRow}>
                    <Text style={styles.previewText} numberOfLines={1}>
                      {preview}
                    </Text>

                    {unreadCount > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 8,
    },
    headerTextWrap: {
      flex: 1,
      paddingLeft: 12,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
      textAlign: "right",
      writingDirection: "rtl",
    },
    headerSubtitle: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      textAlign: "right",
      writingDirection: "rtl",
    },
    headerIconButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    loaderWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    listContent: {
      paddingHorizontal: 14,
      paddingTop: 6,
      paddingBottom: 24,
      flexGrow: 1,
    },
    errorBox: {
      flexDirection: "row-reverse",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: `${colors.danger}14`,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 10,
    },
    errorText: {
      color: colors.danger,
      marginHorizontal: 6,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "right",
      writingDirection: "rtl",
      flex: 1,
    },
    emptyWrap: {
      flex: 1,
      minHeight: 260,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    emptyTitle: {
      marginTop: 10,
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      textAlign: "center",
      writingDirection: "rtl",
    },
    emptyHint: {
      marginTop: 4,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      textAlign: "center",
      writingDirection: "rtl",
    },
    card: {
      flexDirection: "row-reverse",
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 10,
      marginBottom: 9,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    },
    avatarWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    cardBody: {
      flex: 1,
      marginRight: 10,
    },
    cardTopRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
    },
    nameText: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      textAlign: "right",
      writingDirection: "rtl",
      marginLeft: 8,
    },
    timeText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
    },
    cardBottomRow: {
      marginTop: 5,
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
    },
    previewText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      textAlign: "right",
      writingDirection: "rtl",
      marginLeft: 8,
    },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
      backgroundColor: colors.primary,
    },
    unreadBadgeText: {
      color: colors.surface,
      fontSize: 10,
      fontWeight: "900",
    },
  });
