// app/pharmacies.js
import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

export default function PharmaciesScreen() {
  const navigation = useNavigation();

  const pharmacies = [
    {
      name: "MedPlus Pharmacy",
      location: "Downtown, Main Street",
      distance: "1.2 km",
      hours: "Open 24/7",
    },
    {
      name: "HealthFirst Pharmacy",
      location: "City Center",
      distance: "2.0 km",
      hours: "8 AM - 10 PM",
    },
    {
      name: "CareRx Pharmacy",
      location: "North Avenue",
      distance: "2.5 km",
      hours: "9 AM - 9 PM",
    },
    {
      name: "WellCare Pharmacy",
      location: "East Side",
      distance: "3.1 km",
      hours: "7 AM - 11 PM",
    },
    {
      name: "QuickMed Pharmacy",
      location: "South District",
      distance: "3.8 km",
      hours: "Open 24/7",
    },
  ];

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
        <Text style={styles.headerTitle}>Pharmacies</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Search */}
        <View style={styles.searchWrapper}>
          <Feather name="search" size={18} color="#9CA3AF" />
          <TextInput
            placeholder="Search pharmacies..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>

        {/* List */}
        {pharmacies.map((p, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.card}
            onPress={() => navigation.navigate("PharmacyDetails")}
          >
            <View style={styles.cardRow}>
              <View style={styles.logo} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.location}>{p.location}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.subInfo}>{p.distance}</Text>
                  <Text style={styles.subInfo}>{p.hours}</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#111827",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  location: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  subInfo: {
    fontSize: 12,
    color: "#4B5563",
  },
});
