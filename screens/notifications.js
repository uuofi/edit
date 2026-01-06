import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";

export default function NotificationsScreen() {
  const notifications = [
    {
      icon: "check-circle",
      iconBg: "#ECFDF3",
      iconColor: "#16A34A",
      title: "Appointment Confirmed",
      message:
        "Your appointment with Dr. Sarah Johnson has been confirmed for Dec 5 at 10:00 AM",
      time: "2 hours ago",
      unread: true,
    },
    {
      icon: "clock",
      iconBg: "#EFF6FF",
      iconColor: "#0EA5E9",
      title: "Appointment Reminder",
      message:
        "You have an appointment tomorrow with Dr. Michael Chen at 2:00 PM",
      time: "5 hours ago",
      unread: true,
    },
    {
      icon: "alert-circle",
      iconBg: "#FFFBEB",
      iconColor: "#D97706",
      title: "Test Results Available",
      message:
        "Your blood test results are now available. Tap to view details",
      time: "1 day ago",
      unread: false,
    },
    {
      icon: "calendar",
      iconBg: "#F5F3FF",
      iconColor: "#7C3AED",
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
                  { backgroundColor: n.iconBg || "#EEF2FF" },
                ]}
              >
                <Feather
                  name={n.icon}
                  size={20}
                  color={n.iconColor || "#0EA5E9"}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  markAll: {
    fontSize: 13,
    color: "#0EA5E9",
  },
  list: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  card: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  cardUnread: {
    borderWidth: 2,
    borderColor: "#DBEAFE",
  },
  cardRead: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
    color: "#111827",
    flex: 1,
    marginRight: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#0EA5E9",
    marginTop: 4,
  },
  cardMessage: {
    fontSize: 13,
    color: "#4B5563",
    marginBottom: 4,
  },
  cardTime: {
    fontSize: 11,
    color: "#9CA3AF",
  },
});
