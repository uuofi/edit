// app/pharmacy-details.js
import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

export default function PharmacyDetailsScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="chevron-left" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pharmacy Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Main Info */}
        <View style={styles.hero}>
          <View style={styles.logo} />
          <Text style={styles.name}>MedPlus Pharmacy</Text>
          <View style={styles.ratingRow}>
            <Feather name="star" size={16} color="#FBBF24" />
            <Text style={styles.ratingText}>4.6 (89 reviews)</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: "#EFF6FF" }]}>
              <Feather name="map-pin" size={20} color="#0EA5E9" />
            </View>
            <View>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailMain}>123 Main Street, Downtown</Text>
              <Text style={styles.detailSub}>1.2 km away</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: "#EFF6FF" }]}>
              <Feather name="clock" size={20} color="#0EA5E9" />
            </View>
            <View>
              <Text style={styles.detailLabel}>Opening Hours</Text>
              <Text style={styles.detailMain}>Open 24/7</Text>
              <Text style={[styles.detailSub, { color: "#16A34A" }]}>
                Open now
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: "#EFF6FF" }]}>
              <Feather name="phone" size={20} color="#0EA5E9" />
            </View>
            <View>
              <Text style={styles.detailLabel}>Contact</Text>
              <Text style={styles.detailMain}>+1 (555) 123-4567</Text>
            </View>
          </View>
        </View>

        {/* About */}
        <View style={[styles.section, { backgroundColor: "#F9FAFB" }]}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.aboutText}>
            MedPlus Pharmacy is your trusted healthcare partner, offering a wide
            range of prescription medications, over-the-counter products, and
            health services. Our experienced pharmacists are available 24/7 to
            assist you.
          </Text>
        </View>

        {/* Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.servicesGrid}>
            <View style={styles.serviceCard}>
              <Text style={styles.serviceEmoji}>💊</Text>
              <Text style={styles.serviceText}>Prescription</Text>
            </View>
            <View style={styles.serviceCard}>
              <Text style={styles.serviceEmoji}>🚚</Text>
              <Text style={styles.serviceText}>Home Delivery</Text>
            </View>
            <View style={styles.serviceCard}>
              <Text style={styles.serviceEmoji}>💉</Text>
              <Text style={styles.serviceText}>Vaccination</Text>
            </View>
            <View style={styles.serviceCard}>
              <Text style={styles.serviceEmoji}>🩺</Text>
              <Text style={styles.serviceText}>Health Check</Text>
            </View>
          </View>
        </View>
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Request Medicine</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Call Pharmacy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  content: {
    paddingBottom: 24,
  },
  hero: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "#F9FAFB",
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "#DCFCE7",
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    color: "#4B5563",
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  detailRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  detailMain: {
    fontSize: 14,
    color: "#111827",
  },
  detailSub: {
    fontSize: 12,
    color: "#6B7280",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
  },
  aboutText: {
    fontSize: 14,
    color: "#4B5563",
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  serviceCard: {
    width: "48%",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  serviceEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  serviceText: {
    fontSize: 13,
    color: "#111827",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: "#0EA5E9",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  secondaryButtonText: {
    color: "#374151",
    fontSize: 15,
  },
});
