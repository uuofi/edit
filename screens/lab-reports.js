// screens/lab-reports.js — تقارير وإحصائيات المختبر
import React, { useMemo, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { fetchLabDashboard, fetchLabOrders } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const TL  = "#0D9488";
const TLL = "#CCFBF1";

const PERIODS = [
  { key: "today",  label: "اليوم" },
  { key: "week",   label: "الأسبوع" },
  { key: "month",  label: "الشهر" },
];

export default function LabReportsScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const S = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState("today");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash] = await Promise.all([fetchLabDashboard()]);
      setStats(dash);
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return (
    <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={TL} />
    </SafeAreaView>
  );

  const STATCARDS = [
    { label: "طلبات اليوم",     value: stats?.todayOrders ?? 0,    icon: "clipboard",       color: TL },
    { label: "إجمالي الطلبات",  value: stats?.totalOrders ?? 0,    icon: "layers",          color: "#6366F1" },
    { label: "اكتملت",          value: stats?.completedOrders ?? 0,icon: "check-circle",    color: "#10B981" },
    { label: "إيرادات الأسبوع", value: `${(stats?.weekRevenue ?? 0).toLocaleString("ar-IQ")} د.ع`, icon: "trending-up", color: "#F59E0B" },
    { label: "نتائج حرجة",     value: stats?.criticalResultsUnreviewed ?? 0, icon: "alert-triangle", color: "#EF4444" },
    { label: "قيد الانتظار",   value: stats?.pendingOrders ?? 0,  icon: "clock",           color: "#8B5CF6" },
  ];

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-right" size={22} color={TL} /></TouchableOpacity>
        <Text style={S.title}>التقارير والإحصائيات</Text>
        <TouchableOpacity onPress={load}><Feather name="refresh-cw" size={18} color={TL} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={S.scroll}>

        {/* Period Tabs */}
        <View style={S.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity key={p.key} style={[S.periodBtn, period === p.key && S.periodActive]} onPress={() => setPeriod(p.key)}>
              <Text style={[S.periodText, period === p.key && S.periodTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stat Cards */}
        <View style={S.grid}>
          {STATCARDS.map((s) => (
            <View key={s.label} style={[S.statCard, { borderTopColor: s.color, borderTopWidth: 3 }]}>
              <Feather name={s.icon} size={22} color={s.color} />
              <Text style={S.statValue}>{s.value}</Text>
              <Text style={S.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Access Buttons */}
        <Text style={S.sectionTitle}>التقارير</Text>
        {[
          { icon: "list",       label: "قائمة الطلبات الكاملة",     action: () => navigation.navigate("LabOrders") },
          { icon: "users",      label: "سجل المرضى",                action: () => navigation.navigate("LabPatients") },
          { icon: "alert-triangle", label: "النتائج الحرجة",        action: () => navigation.navigate("LabOrders", { status: "processing" }) },
          { icon: "dollar-sign",label: "الطلبات غير المدفوعة",     action: () => navigation.navigate("LabOrders", { paymentStatus: "unpaid" }) },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={S.reportRow} onPress={item.action}>
            <View style={[S.iconWrap, { backgroundColor: TLL }]}>
              <Feather name={item.icon} size={18} color={TL} />
            </View>
            <Text style={S.reportLabel}>{item.label}</Text>
            <Feather name="chevron-left" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {/* Recent Orders Summary */}
        {stats?.recentOrders?.length > 0 && (
          <>
            <Text style={S.sectionTitle}>آخر الطلبات</Text>
            {stats.recentOrders.slice(0, 8).map((o) => (
              <View key={o._id} style={S.orderRow}>
                <View>
                  <Text style={S.orderNum}>{o.orderNumber}</Text>
                  <Text style={S.orderPatient}>{o.patient?.name}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <Text style={S.orderTotal}>{o.total?.toLocaleString("ar-IQ")} د.ع</Text>
                  <View style={[S.statusBadge, { backgroundColor: statusColor(o.status) }]}>
                    <Text style={S.statusText}>{statusLabel(o.status)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const statusLabel = (s) => ({ registered:"مسجّل", sample_collected:"العينة", processing:"جارٍ", partial:"جزئي", completed:"مكتمل", delivered:"مُسلَّم", cancelled:"ملغي" }[s] ?? s);
const statusColor = (s) => ({ registered:"#DBEAFE", sample_collected:"#FEF3C7", processing:"#E0F2FE", completed:"#D1FAE5", cancelled:"#FEE2E2" }[s] ?? "#F1F5F9");

const createStyles = (c, dark) => StyleSheet.create({
  safe:           { flex: 1, backgroundColor: c.background },
  center:         { flex: 1, alignItems: "center", justifyContent: "center" },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  title:          { fontSize: 17, fontWeight: "700", color: c.text },
  scroll:         { padding: 16, paddingBottom: 60 },
  periodRow:      { flexDirection: "row", gap: 8, marginBottom: 16 },
  periodBtn:      { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: c.surface, alignItems: "center", borderWidth: 1, borderColor: c.border },
  periodActive:   { backgroundColor: TL, borderColor: TL },
  periodText:     { fontSize: 13, fontWeight: "600", color: c.textSecondary },
  periodTextActive:{ color: "#fff" },
  grid:           { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard:       { flex: 1, minWidth: "44%", backgroundColor: c.surface, borderRadius: 14, padding: 14, alignItems: "center", gap: 6, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  statValue:      { fontSize: 22, fontWeight: "800", color: c.text },
  statLabel:      { fontSize: 11, color: c.textSecondary, textAlign: "center" },
  sectionTitle:   { fontSize: 15, fontWeight: "700", color: c.text, marginBottom: 10, textAlign: "right" },
  reportRow:      { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12, elevation: 1 },
  iconWrap:       { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  reportLabel:    { flex: 1, fontSize: 14, color: c.text, textAlign: "right" },
  orderRow:       { flexDirection: "row", justifyContent: "space-between", backgroundColor: c.surface, borderRadius: 12, padding: 12, marginBottom: 6, elevation: 1 },
  orderNum:       { fontSize: 13, fontWeight: "700", color: TL, textAlign: "right" },
  orderPatient:   { fontSize: 12, color: c.textSecondary, textAlign: "right" },
  orderTotal:     { fontSize: 13, fontWeight: "700", color: c.text },
  statusBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  statusText:     { fontSize: 10, fontWeight: "600", color: "#1F2937" },
});
