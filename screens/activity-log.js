import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { fetchMyActivity } from "../lib/api";

const formatDateTime = (iso) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso || "");
    return d.toLocaleString();
  } catch {
    return String(iso || "");
  }
};

export default function ActivityLogScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState([]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchMyActivity(50);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      const msg = err?.payload?.message || err?.message || "تعذر تحميل السجل";
      Alert.alert("خطأ", msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-right" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل النشاط</Text>
        <TouchableOpacity onPress={() => load({ silent: true })} style={styles.iconBtn}>
          <Feather name="refresh-ccw" size={18} color="#0EA5E9" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load({ silent: true });
              }}
              colors={["#0EA5E9"]}
            />
          }
        >
          {logs.length === 0 ? <Text style={styles.empty}>لا يوجد نشاط بعد</Text> : null}

          {logs.map((item, idx) => (
            <View key={`${item.timestamp || idx}-${idx}`} style={styles.card}>
              <Text style={styles.action}>{item.action || ""}</Text>
              <Text style={styles.meta}>
                {formatDateTime(item.timestamp)}
                {item.entityType ? ` • ${item.entityType}` : ""}
                {item.entityName ? ` • ${item.entityName}` : ""}
              </Text>
              {item.details ? <Text style={styles.details}>{item.details}</Text> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    height: 56,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  iconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16 },
  empty: { color: "#6B7280", textAlign: "center", marginTop: 20 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  action: { fontSize: 14, fontWeight: "700", color: "#111827" },
  meta: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  details: { fontSize: 13, color: "#4B5563", marginTop: 8, lineHeight: 18 },
});
