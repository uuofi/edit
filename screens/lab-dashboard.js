// screens/lab-dashboard.js — لوحة تحكم المختبر
import React, { useMemo, useState, useCallback } from "react";
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { fetchLabDashboard, fetchLabProfile, logout } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const LAB_TEAL = "#0D9488";
const LAB_TEAL_LIGHT = "#CCFBF1";
const LAB_AMBER  = "#F59E0B";
const LAB_RED    = "#EF4444";
const LAB_GREEN  = "#10B981";

export default function LabDashboardScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const S = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [lab,       setLab]       = useState(null);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const load = useCallback(async () => {
    try {
      const [profileRes, dashRes] = await Promise.all([
        fetchLabProfile(),
        fetchLabDashboard(),
      ]);
      setLab(profileRes);
      setStats(dashRes);
    } catch (e) {
      if (!refreshing) Alert.alert("خطأ", e.message || "تعذّر تحميل البيانات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleLogout = async () => {
    await logout();
    navigation.replace("RoleSelection");
  };

  if (loading) {
    return (
      <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={LAB_TEAL} />
      </SafeAreaView>
    );
  }

  const statusLabel = {
    pending:   "قيد المراجعة",
    active:    "نشط",
    suspended: "موقوف",
    rejected:  "مرفوض",
  };

  return (
    <SafeAreaView style={S.safe}>
      {/* ── Header ── */}
      <View style={S.header}>
        <View>
          <Text style={S.labName}>{lab?.name || "المختبر"}</Text>
          <View style={[S.statusBadge, lab?.status === "active" ? S.badgeActive : S.badgePending]}>
            <Text style={S.statusText}>{statusLabel[lab?.status] || lab?.status}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={S.logoutBtn}>
          <Feather name="log-out" size={20} color={LAB_TEAL} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={S.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[LAB_TEAL]} />}
      >
        {/* ── Stats Grid ── */}
        <View style={S.grid}>
          <StatCard label="طلبات اليوم"   value={stats?.todayOrders ?? 0}      icon="clipboard" color={LAB_TEAL}  S={S} />
          <StatCard label="قيد الانتظار"  value={stats?.pendingOrders ?? 0}     icon="clock"     color={LAB_AMBER} S={S} />
          <StatCard label="اكتملت"        value={stats?.completedOrders ?? 0}   icon="check-circle" color={LAB_GREEN} S={S} />
          <StatCard label="نتائج حرجة"   value={stats?.criticalResultsUnreviewed ?? 0} icon="alert-triangle" color={LAB_RED} S={S} />
        </View>

        {/* ── Revenue ── */}
        <View style={S.revenueCard}>
          <Feather name="trending-up" size={20} color={LAB_TEAL} />
          <Text style={S.revenueLabel}>إيرادات الأسبوع</Text>
          <Text style={S.revenueValue}>{(stats?.weekRevenue ?? 0).toLocaleString("ar-IQ")} د.ع</Text>
        </View>

        {/* ── Quick Actions ── */}
        <Text style={S.sectionTitle}>الإجراءات السريعة</Text>
        <View style={S.actionsGrid}>
          <QuickAction icon="plus-circle"  label="طلب جديد"      color={LAB_TEAL}  onPress={() => navigation.navigate("LabOrders",   { newOrder: true })} S={S} />
          <QuickAction icon="list"         label="قائمة الطلبات" color={LAB_AMBER} onPress={() => navigation.navigate("LabOrders")} S={S} />
          <QuickAction icon="users"        label="المرضى"        color={LAB_GREEN} onPress={() => navigation.navigate("LabPatients")} S={S} />
          <QuickAction icon="activity"     label="الفحوصات"      color="#8B5CF6"   onPress={() => navigation.navigate("LabTests")} S={S} />
          <QuickAction icon="bar-chart-2" label="التقارير"       color="#EC4899"   onPress={() => navigation.navigate("LabReports")} S={S} />
          <QuickAction icon="settings"    label="الإعدادات"      color="#64748B"   onPress={() => navigation.navigate("LabProfile")} S={S} />
        </View>

        {/* ── Recent Orders ── */}
        {stats?.recentOrders?.length > 0 && (
          <>
            <Text style={S.sectionTitle}>آخر الطلبات</Text>
            {stats.recentOrders.slice(0, 5).map((o) => (
              <TouchableOpacity
                key={o._id}
                style={S.orderRow}
                onPress={() => navigation.navigate("LabOrders", { orderId: o._id })}
              >
                <View style={S.orderLeft}>
                  <Text style={S.orderNum}>{o.orderNumber}</Text>
                  <Text style={S.orderPatient}>{o.patient?.name}</Text>
                </View>
                <View style={[S.orderStatus, { backgroundColor: statusColor(o.status) }]}>
                  <Text style={S.orderStatusText}>{orderStatusLabel(o.status)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const statusColor = (s) => ({
  registered:        "#DBEAFE",
  sample_collected:  "#FEF3C7",
  processing:        "#E0F2FE",
  partial:           "#F3E8FF",
  completed:         "#D1FAE5",
  delivered:         "#A7F3D0",
  cancelled:         "#FEE2E2",
}[s] ?? "#F1F5F9");

const orderStatusLabel = (s) => ({
  registered:       "مسجّل",
  sample_collected: "تم أخذ العينة",
  processing:       "جارٍ المعالجة",
  partial:          "نتائج جزئية",
  completed:        "مكتمل",
  delivered:        "تم التسليم",
  cancelled:        "ملغي",
}[s] ?? s);

function StatCard({ label, value, icon, color, S }) {
  return (
    <View style={[S.statCard, { borderLeftColor: color }]}>
      <Feather name={icon} size={22} color={color} />
      <Text style={S.statValue}>{value}</Text>
      <Text style={S.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, color, onPress, S }) {
  return (
    <TouchableOpacity style={[S.actionBtn, { borderColor: color }]} onPress={onPress}>
      <Feather name={icon} size={24} color={color} />
      <Text style={[S.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (c, dark) => StyleSheet.create({
  safe:         { flex: 1, backgroundColor: c.background },
  center:       { flex: 1, alignItems: "center", justifyContent: "center" },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 12, backgroundColor: dark ? "#0F172A" : "#ECFDF5", borderBottomWidth: 1, borderBottomColor: LAB_TEAL + "33" },
  labName:      { fontSize: 20, fontWeight: "700", color: LAB_TEAL, textAlign: "right" },
  statusBadge:  { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-end", marginTop: 4 },
  badgeActive:  { backgroundColor: "#D1FAE5" },
  badgePending: { backgroundColor: "#FEF3C7" },
  statusText:   { fontSize: 11, fontWeight: "600", color: "#374151" },
  logoutBtn:    { padding: 8 },
  scroll:       { padding: 16, paddingBottom: 40 },
  grid:         { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statCard:     { flex: 1, minWidth: "44%", backgroundColor: c.surface, borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderLeftWidth: 4, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  statValue:    { fontSize: 26, fontWeight: "800", color: c.text },
  statLabel:    { fontSize: 12, color: c.textSecondary, textAlign: "center" },
  revenueCard:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: LAB_TEAL_LIGHT, borderRadius: 14, padding: 16, marginBottom: 16 },
  revenueLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#065F46" },
  revenueValue: { fontSize: 18, fontWeight: "800", color: LAB_TEAL },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 10, textAlign: "right" },
  actionsGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  actionBtn:    { flex: 1, minWidth: "28%", backgroundColor: c.surface, borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 1.5, elevation: 1 },
  actionLabel:  { fontSize: 11, fontWeight: "600", textAlign: "center" },
  orderRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
  orderLeft:    { gap: 2 },
  orderNum:     { fontSize: 14, fontWeight: "700", color: LAB_TEAL, textAlign: "right" },
  orderPatient: { fontSize: 13, color: c.textSecondary, textAlign: "right" },
  orderStatus:  { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  orderStatusText:{ fontSize: 11, fontWeight: "600", color: "#1F2937" },
});
