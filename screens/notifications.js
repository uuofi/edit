import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "../lib/useTheme";

export default function NotificationsScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const notifications = [
    {
      icon: "check-circle",
      iconBg: isDark ? "rgba(22,163,106,0.15)" : "#ECFDF3",
      iconColor: isDark ? "#34D399" : "#16A34A",
      title: "Appointment Confirmed",
      message:
        "Your appointment with Dr. Sarah Johnson has been confirmed for Dec 5 at 10:00 AM",
      time: "2 hours ago",
      unread: true,
    },
    {
      icon: "clock",
      iconBg: isDark ? "rgba(56,189,248,0.15)" : "#EFF6FF",
      iconColor: isDark ? "#38BDF8" : "#0EA5E9",
      title: "Appointment Reminder",
      message:
        "You have an appointment tomorrow with Dr. Michael Chen at 2:00 PM",
      time: "5 hours ago",
      unread: true,
    },
    {
      icon: "alert-circle",
      iconBg: isDark ? "rgba(251,191,36,0.15)" : "#FFFBEB",
      iconColor: isDark ? "#FBBF24" : "#D97706",
      title: "Test Results Available",
      message:
        "Your blood test results are now available. Tap to view details",
      time: "1 day ago",
      unread: false,
    },
    {
      icon: "calendar",
      iconBg: isDark ? "rgba(139,92,246,0.15)" : "#F5F3FF",
      iconColor: isDark ? "#A78BFA" : "#7C3AED",
      title: "Booking Request",
      message:
        "Dr. Emily Brown has a cancellation. Would you like to book earlier?",
      time: "2 days ago",
      unread: false,
    },
  ];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity>
          <Text style={styles.markAll}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {notifications.map((n, idx) => (
          <View
            key={idx}
            style={[
              styles.card,
              n.unread ? styles.cardUnread : styles.cardRead,
            ]}
          >
            <View style={styles.cardRow}>
              <View
                style={[
                  styles.iconWrapper,
                  { backgroundColor: n.iconBg || (isDark ? "rgba(56,189,248,0.15)" : "#EEF2FF") },
                ]}
              >
                <Feather
                  name={n.icon}
                  size={20}
                  color={n.iconColor || colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{n.title}</Text>
                  {n.unread && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.cardMessage}>{n.message}</Text>
                <Text style={styles.cardTime}>{n.time}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surfaceAlt },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    markAll: {
      fontSize: 13,
      color: colors.primary,
    },
    list: {
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    card: {
      borderRadius: 16,
      padding: 12,
      marginBottom: 10,
      backgroundColor: colors.surface,
    },
    cardUnread: {
      borderWidth: 2,
      borderColor: colors.primary + "30",
    },
    cardRead: {
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardRow: {
      flexDirection: "row",
      gap: 10,
    },
    iconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 2,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
      marginRight: 6,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
      marginTop: 4,
    },
    cardMessage: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 4,
    },
    cardTime: {
      fontSize: 11,
      color: colors.placeholder,
    },
  });
