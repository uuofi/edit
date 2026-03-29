// screens/lab-orders.js — قائمة وإنشاء طلبات الفحوصات
import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import {
  fetchLabOrders, createLabOrder, fetchLabTests, updateLabOrder,
} from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const TL  = "#0D9488";
const TLL = "#CCFBF1";

const STATUS_TABS = [
  { key: "all",              label: "الكل" },
  { key: "registered",       label: "مسجّل" },
  { key: "sample_collected", label: "العينة" },
  { key: "processing",       label: "معالجة" },
  { key: "completed",        label: "مكتمل" },
  { key: "cancelled",        label: "ملغي" },
];

export default function LabOrdersScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useAppTheme();
  const S = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [tab,      setTab]      = useState("all");
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);

  // ─── New-Order Modal ───
  const [showNew,  setShowNew]  = useState(false);
  const [tests,    setTests]    = useState([]);
  const [selected, setSelected] = useState([]);
  const [patient,  setPatient]  = useState({ name: "", phone: "", age: "", gender: "male" });
  const [priority, setPriority] = useState("routine");
  const [discount, setDiscount] = useState("0");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p };
      if (tab !== "all") params.status = tab;
      if (search)        params.search = search;
      const res = await fetchLabOrders(params);
      if (p === 1) setOrders(res.orders);
      else         setOrders((prev) => [...prev, ...res.orders]);
      setTotal(res.total);
      setPage(p);
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  // Open new-order modal if param passed (from dashboard)
  useEffect(() => {
    if (route.params?.newOrder) {
      openNewOrder();
    }
  }, [route.params?.newOrder]);

  const openNewOrder = async () => {
    setSelected([]);
    setPatient({ name: "", phone: "", age: "", gender: "male" });
    setPriority("routine");
    setDiscount("0");
    // Load tests catalog
    try {
      const res = await fetchLabTests({ active: true });
      setTests(res);
    } catch {
      setTests([]);
    }
    setShowNew(true);
  };

  const toggleTest = (t) => {
    setSelected((prev) =>
      prev.find((s) => s._id === t._id)
        ? prev.filter((s) => s._id !== t._id)
        : [...prev, t]
    );
  };

  const submitOrder = async () => {
    if (!patient.name.trim()) return Alert.alert("تنبيه", "اسم المريض مطلوب");
    if (!selected.length)     return Alert.alert("تنبيه", "اختر فحصاً واحداً على الأقل");
    setCreating(true);
    try {
      await createLabOrder({
        patient: {
          name:   patient.name.trim(),
          phone:  patient.phone.trim(),
          age:    patient.age ? Number(patient.age) : undefined,
          gender: patient.gender,
        },
        tests:    selected.map((t) => t._id),
        priority,
        discount: Number(discount) || 0,
      });
      setShowNew(false);
      load(1);
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setCreating(false);
    }
  };

  const subtotal = selected.reduce((s, t) => s + (t.price || 0), 0);
  const total2   = Math.max(0, subtotal - (Number(discount) || 0));

  const renderOrder = ({ item }) => (
    <TouchableOpacity
      style={S.card}
      onPress={() => navigation.navigate("LabResultEntry", { orderId: item._id, orderNumber: item.orderNumber })}
    >
      <View style={S.cardTop}>
        <Text style={S.orderNum}>{item.orderNumber}</Text>
        <View style={[S.badge, { backgroundColor: statusColor(item.status) }]}>
          <Text style={S.badgeText}>{statusLabel(item.status)}</Text>
        </View>
      </View>
      <Text style={S.patientName}>{item.patient?.name}</Text>
      <View style={S.cardBottom}>
        <Text style={S.meta}>{item.tests?.length ?? 0} فحوصات · {(item.total ?? 0).toLocaleString("ar-IQ")} د.ع</Text>
        <Text style={S.meta}>{new Date(item.registeredAt || item.createdAt).toLocaleDateString("ar")}</Text>
      </View>
      <View style={S.progressBar}>
        {["registered","sample_collected","processing","completed"].map((s, i) => (
          <View key={s} style={[S.progressStep,
            statusIndex(item.status) >= i ? { backgroundColor: TL } : { backgroundColor: colors.border }
          ]} />
        ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={S.safe}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-right" size={22} color={TL} /></TouchableOpacity>
        <Text style={S.title}>طلبات الفحوصات</Text>
        <TouchableOpacity onPress={openNewOrder} style={S.newBtn}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={S.searchBox}>
        <Feather name="search" size={16} color={colors.textSecondary} />
        <TextInput
          style={S.searchInput}
          placeholder="بحث بالاسم أو رقم الطلب..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={(v) => { setSearch(v); load(1); }}
        />
      </View>

      {/* Status Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabsScroll} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {STATUS_TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[S.tab, tab === t.key && S.tabActive]} onPress={() => { setTab(t.key); load(1); }}>
            <Text style={[S.tabText, tab === t.key && S.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && <ActivityIndicator color={TL} style={{ marginTop: 20 }} />}

      <FlatList
        data={orders}
        keyExtractor={(i) => i._id}
        renderItem={renderOrder}
        contentContainerStyle={S.list}
        onEndReached={() => { if (orders.length < total) load(page + 1); }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={!loading ? <Text style={S.empty}>لا توجد طلبات</Text> : null}
      />

      {/* ── New Order Modal ── */}
      <Modal visible={showNew} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={S.modalSafe}>
          <View style={S.modalHeader}>
            <TouchableOpacity onPress={() => setShowNew(false)}><Feather name="x" size={22} color={TL} /></TouchableOpacity>
            <Text style={S.modalTitle}>طلب فحوصات جديد</Text>
            <TouchableOpacity onPress={submitOrder} disabled={creating} style={[S.saveBtn, creating && { opacity: 0.5 }]}>
              {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={S.saveBtnText}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={S.modalContent}>

              <Text style={S.sectionLabel}>معلومات المريض</Text>
              <TextInput style={S.input} placeholder="الاسم *" placeholderTextColor={colors.textSecondary} value={patient.name} onChangeText={(v) => setPatient((p) => ({ ...p, name: v }))} />
              <TextInput style={S.input} placeholder="رقم الهاتف" placeholderTextColor={colors.textSecondary} value={patient.phone} keyboardType="phone-pad" onChangeText={(v) => setPatient((p) => ({ ...p, phone: v }))} />
              <View style={S.row}>
                <TextInput style={[S.input, S.flex]} placeholder="العمر" placeholderTextColor={colors.textSecondary} value={patient.age} keyboardType="numeric" onChangeText={(v) => setPatient((p) => ({ ...p, age: v }))} />
                <View style={S.genderRow}>
                  {["male","female"].map((g) => (
                    <TouchableOpacity key={g} style={[S.genderBtn, patient.gender === g && S.genderActive]} onPress={() => setPatient((p) => ({ ...p, gender: g }))}>
                      <Text style={[S.genderText, patient.gender === g && { color: "#fff" }]}>{g === "male" ? "ذكر" : "أنثى"}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={S.sectionLabel}>الأولوية</Text>
              <View style={S.row}>
                {["routine","urgent","stat"].map((p2) => (
                  <TouchableOpacity key={p2} style={[S.priBtn, priority === p2 && S.priBtnActive]} onPress={() => setPriority(p2)}>
                    <Text style={[S.priText, priority === p2 && { color: "#fff" }]}>{p2 === "routine" ? "عادي" : p2 === "urgent" ? "عاجل" : "STAT"}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={S.sectionLabel}>اختر الفحوصات</Text>
              {tests.map((t) => {
                const sel = !!selected.find((s) => s._id === t._id);
                return (
                  <TouchableOpacity key={t._id} style={[S.testItem, sel && S.testItemSel]} onPress={() => toggleTest(t)}>
                    <View style={{ flex: 1 }}>
                      <Text style={S.testName}>{t.nameAr || t.name}</Text>
                      <Text style={S.testCode}>{t.code} · {t.category}</Text>
                    </View>
                    <Text style={S.testPrice}>{t.price?.toLocaleString("ar-IQ")} د.ع</Text>
                    {sel && <Feather name="check-circle" size={18} color={TL} style={{ marginLeft: 6 }} />}
                  </TouchableOpacity>
                );
              })}

              <Text style={S.sectionLabel}>الحسم (اختياري)</Text>
              <TextInput style={S.input} placeholder="الحسم بالدينار" placeholderTextColor={colors.textSecondary} value={discount} keyboardType="numeric" onChangeText={setDiscount} />

              <View style={S.totalRow}>
                <Text style={S.totalLabel}>المجموع الكلي</Text>
                <Text style={S.totalValue}>{total2.toLocaleString("ar-IQ")} د.ع</Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const statusIndex = (s) => ["registered","sample_collected","processing","completed"].indexOf(s);
const statusLabel = (s) => ({ registered:"مسجّل", sample_collected:"العينة", processing:"جارٍ", partial:"جزئي", completed:"مكتمل", delivered:"مُسلَّم", cancelled:"ملغي" }[s] ?? s);
const statusColor = (s) => ({ registered:"#DBEAFE", sample_collected:"#FEF3C7", processing:"#E0F2FE", partial:"#F3E8FF", completed:"#D1FAE5", delivered:"#A7F3D0", cancelled:"#FEE2E2" }[s] ?? "#F1F5F9");

const createStyles = (c, dark) => StyleSheet.create({
  safe:        { flex: 1, backgroundColor: c.background },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  title:       { fontSize: 18, fontWeight: "700", color: c.text },
  newBtn:      { backgroundColor: TL, borderRadius: 10, padding: 8 },
  searchBox:   { flexDirection: "row", alignItems: "center", margin: 12, backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: c.border },
  searchInput: { flex: 1, height: 40, color: c.text, textAlign: "right" },
  tabsScroll:  { maxHeight: 44, marginBottom: 4 },
  tab:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  tabActive:   { backgroundColor: TL, borderColor: TL },
  tabText:     { fontSize: 12, color: c.textSecondary },
  tabTextActive:{ color: "#fff", fontWeight: "700" },
  list:        { padding: 12, gap: 10, paddingBottom: 40 },
  card:        { backgroundColor: c.surface, borderRadius: 14, padding: 14, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardTop:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  orderNum:    { fontSize: 13, fontWeight: "700", color: TL },
  badge:       { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 11, fontWeight: "600", color: "#1F2937" },
  patientName: { fontSize: 15, fontWeight: "700", color: c.text, marginBottom: 4, textAlign: "right" },
  cardBottom:  { flexDirection: "row", justifyContent: "space-between" },
  meta:        { fontSize: 12, color: c.textSecondary },
  progressBar: { flexDirection: "row", gap: 4, marginTop: 10 },
  progressStep:{ flex: 1, height: 4, borderRadius: 2 },
  empty:       { textAlign: "center", color: c.textSecondary, marginTop: 40, fontSize: 15 },
  // Modal
  modalSafe:   { flex: 1, backgroundColor: c.background },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  modalTitle:  { fontSize: 16, fontWeight: "700", color: c.text },
  saveBtn:     { backgroundColor: TL, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { color: "#fff", fontWeight: "700" },
  modalContent:{ padding: 16, gap: 10, paddingBottom: 60 },
  sectionLabel:{ fontSize: 14, fontWeight: "700", color: c.text, marginTop: 8, textAlign: "right" },
  input:       { backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 14, height: 44, color: c.text, borderWidth: 1, borderColor: c.border, textAlign: "right" },
  flex:        { flex: 1 },
  row:         { flexDirection: "row", gap: 10, alignItems: "center" },
  genderRow:   { flexDirection: "row", gap: 6 },
  genderBtn:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  genderActive:{ backgroundColor: TL, borderColor: TL },
  genderText:  { fontSize: 13, color: c.text },
  priBtn:      { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center" },
  priBtnActive:{ backgroundColor: TL, borderColor: TL },
  priText:     { fontSize: 12, fontWeight: "600", color: c.text },
  testItem:    { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border },
  testItemSel: { borderColor: TL, backgroundColor: TLL },
  testName:    { fontSize: 14, fontWeight: "600", color: c.text, textAlign: "right" },
  testCode:    { fontSize: 11, color: c.textSecondary, textAlign: "right" },
  testPrice:   { fontSize: 13, fontWeight: "700", color: TL },
  totalRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: TLL, borderRadius: 12, padding: 14, marginTop: 6 },
  totalLabel:  { fontSize: 15, fontWeight: "700", color: "#065F46" },
  totalValue:  { fontSize: 18, fontWeight: "800", color: TL },
});
