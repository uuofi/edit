// screens/lab-result-entry.js — إدخال نتائج الفحوصات
import React, { useMemo, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import {
  fetchLabOrder, enterLabResult, verifyLabResult, approveLabResult, updateLabOrder,
} from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const TL  = "#0D9488";
const RED = "#EF4444";

const FLAG_OPTIONS = [
  { key: "",             label: "—",      bg: "#F1F5F9", fg: "#64748B" },
  { key: "low",          label: "منخفض", bg: "#DBEAFE", fg: "#1D4ED8" },
  { key: "normal",       label: "طبيعي", bg: "#D1FAE5", fg: "#065F46" },
  { key: "high",         label: "مرتفع", bg: "#FEF3C7", fg: "#92400E" },
  { key: "critical_low", label: "حرج ↓", bg: "#FEE2E2", fg: "#991B1B" },
  { key: "critical_high",label: "حرج ↑", bg: "#FEE2E2", fg: "#991B1B" },
];

const WORKFLOW = ["registered","sample_collected","processing","completed"];

export default function LabResultEntryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId, orderNumber } = route.params || {};
  const { colors, isDark } = useAppTheme();
  const S = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [order,    setOrder]   = useState(null);
  const [results,  setResults] = useState([]);
  const [loading,  setLoading] = useState(true);
  const [saving,   setSaving]  = useState({});
  const [editing,  setEditing] = useState({}); // { [resultId]: { value, flag, note, interpretation } }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLabOrder(orderId);
      setOrder(data.order);
      setResults(data.results || []);
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const initEdit = (r) => {
    const primary = r.values?.[0] || {};
    setEditing((prev) => ({
      ...prev,
      [r._id]: {
        value:          primary.value || "",
        flag:           primary.flag  || "",
        note:           primary.note  || "",
        interpretation: r.interpretation || "",
      },
    }));
  };

  const saveResult = async (r) => {
    const draft = editing[r._id];
    if (!draft) return;
    setSaving((p) => ({ ...p, [r._id]: true }));
    try {
      await enterLabResult(orderId, r.labTest?._id || r.labTest, {
        values: [{ value: draft.value, flag: draft.flag, note: draft.note,
                   unit: r.labTest?.unit || "" }],
        interpretation: draft.interpretation,
      });
      await load();
      setEditing((p) => { const n = { ...p }; delete n[r._id]; return n; });
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSaving((p) => ({ ...p, [r._id]: false }));
    }
  };

  const doVerify = async (r) => {
    setSaving((p) => ({ ...p, [r._id]: true }));
    try {
      await verifyLabResult(orderId, r.labTest?._id || r.labTest);
      await load();
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSaving((p) => ({ ...p, [r._id]: false }));
    }
  };

  const doApprove = async (r) => {
    Alert.alert("تأكيد الاعتماد", "هل تريد اعتماد وإصدار هذه النتيجة للمريض؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "اعتماد", style: "destructive", onPress: async () => {
        setSaving((p) => ({ ...p, [r._id]: true }));
        try {
          await approveLabResult(orderId, r.labTest?._id || r.labTest);
          await load();
        } catch (e) {
          Alert.alert("خطأ", e.message);
        } finally {
          setSaving((p) => ({ ...p, [r._id]: false }));
        }
      }},
    ]);
  };

  const advanceStatus = async () => {
    const NEXT = {
      registered:        "sample_collected",
      sample_collected:  "processing",
      processing:        "completed",
    };
    const next = NEXT[order.status];
    if (!next) return;
    try {
      await updateLabOrder(orderId, { status: next });
      await load();
    } catch (e) {
      Alert.alert("خطأ", e.message);
    }
  };

  if (loading) return (
    <SafeAreaView style={[S.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={TL} />
    </SafeAreaView>
  );

  const allDone = results.every((r) => ["approved","released"].includes(r.status));

  return (
    <SafeAreaView style={S.safe}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-right" size={22} color={TL} /></TouchableOpacity>
        <Text style={S.title}>{orderNumber || "النتائج"}</Text>
        <View />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={S.scroll}>

          {/* Order Info */}
          <View style={S.infoCard}>
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>المريض</Text>
              <Text style={S.infoValue}>{order?.patient?.name}</Text>
            </View>
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>الأولوية</Text>
              <Text style={[S.infoValue, order?.priority === "stat" && { color: RED }]}>
                {order?.priority === "routine" ? "عادي" : order?.priority === "urgent" ? "عاجل" : "STAT"}
              </Text>
            </View>
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>الإجمالي</Text>
              <Text style={S.infoValue}>{order?.total?.toLocaleString("ar-IQ")} د.ع</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={S.progressWrap}>
            {WORKFLOW.map((s, i) => (
              <React.Fragment key={s}>
                <View style={[S.dot, WORKFLOW.indexOf(order?.status) >= i && { backgroundColor: TL }]}>
                  <Feather name="check" size={10} color="#fff" />
                </View>
                {i < WORKFLOW.length - 1 && (
                  <View style={[S.line, WORKFLOW.indexOf(order?.status) > i && { backgroundColor: TL }]} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* Advance Status Button */}
          {order?.status !== "completed" && order?.status !== "cancelled" && (
            <TouchableOpacity style={S.advBtn} onPress={advanceStatus}>
              <Feather name="arrow-left-circle" size={18} color="#fff" />
              <Text style={S.advBtnText}>{advanceLabel(order?.status)}</Text>
            </TouchableOpacity>
          )}

          {/* Results */}
          <Text style={S.sectionTitle}>نتائج الفحوصات</Text>
          {results.map((r) => {
            const eKey = r._id;
            const isEditing = !!editing[eKey];
            const busy = saving[eKey];
            const primary = r.values?.[0] || {};
            return (
              <View key={r._id} style={S.resultCard}>
                <View style={S.resultHeader}>
                  <Text style={S.testName}>{r.testNameAr || r.testName}</Text>
                  <StatusPill status={r.status} />
                </View>
                <Text style={S.testCode}>{r.testCode} · {r.category}</Text>

                {r.hasCriticalValues && (
                  <View style={S.criticalBanner}>
                    <Feather name="alert-triangle" size={14} color={RED} />
                    <Text style={S.criticalText}>قيمة حرجة — يتطلب إشعار فوري</Text>
                  </View>
                )}

                {isEditing ? (
                  <View style={S.editSection}>
                    <TextInput
                      style={S.input}
                      placeholder="القيمة"
                      placeholderTextColor={colors.textSecondary}
                      value={editing[eKey].value}
                      onChangeText={(v) => setEditing((p) => ({ ...p, [eKey]: { ...p[eKey], value: v } }))}
                    />
                    <Text style={S.smallLabel}>الإشارة</Text>
                    <View style={S.flagRow}>
                      {FLAG_OPTIONS.map((f) => (
                        <TouchableOpacity
                          key={f.key}
                          style={[S.flagBtn, { backgroundColor: f.bg }, editing[eKey].flag === f.key && { borderColor: TL, borderWidth: 2 }]}
                          onPress={() => setEditing((p) => ({ ...p, [eKey]: { ...p[eKey], flag: f.key } }))}
                        >
                          <Text style={[S.flagText, { color: f.fg }]}>{f.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={S.input}
                      placeholder="ملاحظة"
                      placeholderTextColor={colors.textSecondary}
                      value={editing[eKey].note}
                      onChangeText={(v) => setEditing((p) => ({ ...p, [eKey]: { ...p[eKey], note: v } }))}
                    />
                    <TextInput
                      style={[S.input, { height: 70, textAlignVertical: "top" }]}
                      placeholder="التفسير الطبي"
                      placeholderTextColor={colors.textSecondary}
                      value={editing[eKey].interpretation}
                      multiline
                      onChangeText={(v) => setEditing((p) => ({ ...p, [eKey]: { ...p[eKey], interpretation: v } }))}
                    />
                    <View style={S.actionRow}>
                      <TouchableOpacity style={S.cancelBtn} onPress={() => setEditing((p) => { const n={...p}; delete n[eKey]; return n; })}>
                        <Text style={S.cancelText}>إلغاء</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={S.saveBtn} onPress={() => saveResult(r)} disabled={busy}>
                        {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={S.saveBtnText}>حفظ</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    {r.status !== "pending" && (
                      <View style={S.valueRow}>
                        <Text style={S.valueText}>{primary.value || "—"}</Text>
                        {primary.flag && (
                          <View style={[S.flagPill, { backgroundColor: FLAG_OPTIONS.find((f) => f.key === primary.flag)?.bg || "#F1F5F9" }]}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: FLAG_OPTIONS.find((f) => f.key === primary.flag)?.fg || "#374151" }}>
                              {FLAG_OPTIONS.find((f) => f.key === primary.flag)?.label}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    <View style={S.actionRow}>
                      {(r.status === "pending" || r.status === "entered") && (
                        <TouchableOpacity style={S.editBtn} onPress={() => initEdit(r)}>
                          <Feather name="edit-3" size={14} color={TL} />
                          <Text style={S.editBtnText}>إدخال نتيجة</Text>
                        </TouchableOpacity>
                      )}
                      {r.status === "entered" && (
                        <TouchableOpacity style={S.verifyBtn} onPress={() => doVerify(r)} disabled={busy}>
                          {busy ? <ActivityIndicator size="small" color="#fff" /> : (
                            <><Feather name="check" size={14} color="#fff" /><Text style={S.verifyBtnText}>مراجعة</Text></>
                          )}
                        </TouchableOpacity>
                      )}
                      {r.status === "verified" && (
                        <TouchableOpacity style={S.approveBtn} onPress={() => doApprove(r)} disabled={busy}>
                          {busy ? <ActivityIndicator size="small" color="#fff" /> : (
                            <><Feather name="shield" size={14} color="#fff" /><Text style={S.approveBtnText}>اعتماد وإصدار</Text></>
                          )}
                        </TouchableOpacity>
                      )}
                      {["approved","released"].includes(r.status) && (
                        <View style={S.releasedTag}>
                          <Feather name="check-circle" size={14} color="#065F46" />
                          <Text style={S.releasedText}>تم الإصدار</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </View>
            );
          })}

          {allDone && (
            <View style={S.allDoneBanner}>
              <Feather name="check-circle" size={20} color="#065F46" />
              <Text style={S.allDoneText}>جميع النتائج مكتملة ومعتمدة</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatusPill({ status }) {
  const map = {
    pending:  { bg: "#F1F5F9", fg: "#475569", label: "ينتظر" },
    entered:  { bg: "#DBEAFE", fg: "#1D4ED8", label: "مُدخَل" },
    verified: { bg: "#FEF3C7", fg: "#92400E", label: "مراجَع" },
    approved: { bg: "#D1FAE5", fg: "#065F46", label: "معتمد" },
    released: { bg: "#A7F3D0", fg: "#064E3B", label: "مُصدَر" },
  };
  const m = map[status] || { bg: "#F1F5F9", fg: "#374151", label: status };
  return (
    <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: m.bg }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: m.fg }}>{m.label}</Text>
    </View>
  );
}

const advanceLabel = (s) => ({
  registered:       "⟵ تأكيد أخذ العينة",
  sample_collected: "⟵ بدء المعالجة",
  processing:       "⟵ تحديد الاكتمال",
}[s] ?? "التالي");

const createStyles = (c, dark) => StyleSheet.create({
  safe:          { flex: 1, backgroundColor: c.background },
  center:        { flex: 1, alignItems: "center", justifyContent: "center" },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  title:         { fontSize: 17, fontWeight: "700", color: c.text },
  scroll:        { padding: 16, paddingBottom: 60 },
  infoCard:      { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 14, gap: 6, borderLeftWidth: 4, borderLeftColor: TL },
  infoRow:       { flexDirection: "row", justifyContent: "space-between" },
  infoLabel:     { fontSize: 13, color: c.textSecondary },
  infoValue:     { fontSize: 13, fontWeight: "700", color: c.text },
  progressWrap:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 },
  dot:           { width: 22, height: 22, borderRadius: 11, backgroundColor: c.border, alignItems: "center", justifyContent: "center" },
  line:          { flex: 1, height: 3, backgroundColor: c.border, marginHorizontal: 2 },
  advBtn:        { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: TL, borderRadius: 12, padding: 12, justifyContent: "center", marginBottom: 16 },
  advBtnText:    { color: "#fff", fontWeight: "700", fontSize: 14 },
  sectionTitle:  { fontSize: 15, fontWeight: "700", color: c.text, marginBottom: 10, textAlign: "right" },
  resultCard:    { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 10, gap: 8, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  resultHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  testName:      { fontSize: 15, fontWeight: "700", color: c.text, flex: 1, textAlign: "right" },
  testCode:      { fontSize: 11, color: c.textSecondary, textAlign: "right" },
  criticalBanner:{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEE2E2", borderRadius: 8, padding: 8 },
  criticalText:  { fontSize: 12, fontWeight: "600", color: RED },
  editSection:   { gap: 8 },
  input:         { backgroundColor: dark ? "#1E293B" : "#F8FAFC", borderRadius: 10, paddingHorizontal: 12, height: 44, color: c.text, borderWidth: 1, borderColor: c.border, textAlign: "right" },
  smallLabel:    { fontSize: 12, color: c.textSecondary, textAlign: "right" },
  flagRow:       { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flagBtn:       { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  flagText:      { fontSize: 11, fontWeight: "700" },
  flagPill:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  valueRow:      { flexDirection: "row", alignItems: "center", gap: 8 },
  valueText:     { fontSize: 20, fontWeight: "800", color: c.text },
  actionRow:     { flexDirection: "row", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" },
  editBtn:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: TL },
  editBtnText:   { fontSize: 13, fontWeight: "600", color: TL },
  verifyBtn:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: TL },
  verifyBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  approveBtn:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#7C3AED" },
  approveBtnText:{ fontSize: 13, fontWeight: "600", color: "#fff" },
  releasedTag:   { flexDirection: "row", alignItems: "center", gap: 4 },
  releasedText:  { fontSize: 13, fontWeight: "600", color: "#065F46" },
  cancelBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: c.border },
  cancelText:    { fontSize: 13, color: c.textSecondary },
  saveBtn:       { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, backgroundColor: TL, alignItems: "center", minWidth: 80 },
  saveBtnText:   { color: "#fff", fontWeight: "700" },
  allDoneBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#D1FAE5", borderRadius: 14, padding: 16, justifyContent: "center", marginTop: 8 },
  allDoneText:   { fontSize: 15, fontWeight: "700", color: "#065F46" },
});
