import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { getUserRole } from "../lib/api";
import { fetchDoctorAppointments, saveDoctorNote } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const normalizePatientKey = (user) => user?._id || user?.id || user?.phone || user?.email || "unknown";

export default function PatientsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activePatient, setActivePatient] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [prescriptionsDraft, setPrescriptionsDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const navigation = useNavigation();

  const openDrawer = useCallback(() => {
    if (typeof navigation?.openDrawer === "function") {
      navigation.openDrawer();
      return;
    }
    const parent = navigation?.getParent?.();
    if (typeof parent?.openDrawer === "function") parent.openDrawer();
  }, [navigation]);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDoctorAppointments();
      const list = Array.isArray(data.appointments) ? data.appointments : [];
      const grouped = {};

      const toTimestamp = (appt) => {
        const iso = appt?.appointmentDateIso || appt?.appointmentDate || "";
        const time = appt?.appointmentTimeValue || appt?.appointmentTime || "";
        const composed = iso && time ? `${iso}T${time}` : iso || appt?.createdAt || "";
        const fromComposed = Date.parse(composed);
        if (Number.isFinite(fromComposed)) return fromComposed;
        const fromCreated = Date.parse(appt?.createdAt || "");
        return Number.isFinite(fromCreated) ? fromCreated : 0;
      };

      const sorted = [...list].sort((a, b) => toTimestamp(b) - toTimestamp(a));

      sorted.forEach((appt) => {
        const key = normalizePatientKey(appt.user);
        if (!key) return;
        const entry = grouped[key];
        const bookingNumber =
          appt?.doctorQueueNumber ?? appt?.doctorIndex ?? appt?.bookingNumber ?? "";
        const sortKey = toTimestamp(appt);
        const snapshot = {
          key,
          user: appt.user || {},
          lastBookingNumber: bookingNumber,
          lastDate: appt.appointmentDate,
          lastTime: appt.appointmentTime,
          status: appt.status,
          appointmentId: appt._id,
          doctorNote: appt.doctorNote,
          doctorPrescriptions: appt.doctorPrescriptions || [],
          sortKey,
        };

        if (!entry) {
          grouped[key] = snapshot;
        } else {
          if (sortKey > entry.sortKey) grouped[key] = snapshot;
        }
      });

      setPatients(Object.values(grouped).map(({ sortKey, ...rest }) => rest));
    } catch (err) {
      console.log("patients load error", err);
      Alert.alert("خطأ", err.message || "تعذّر تحميل المرضى");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPatients();
    }, [loadPatients])
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const role = await getUserRole();
        if (!active) return;
        setUserRole(role);
      } catch (e) {
        console.warn("patients: failed to load user role", e?.message || e);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleOpenPatient = (patient) => {
    setActivePatient(patient);
    setNoteDraft(patient?.doctorNote || "");
    setPrescriptionsDraft(Array.isArray(patient?.doctorPrescriptions) ? patient.doctorPrescriptions : []);
  };

  const visiblePatients = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = String(p?.user?.name || "").toLowerCase();
      const phone = String(p?.user?.phone || "").toLowerCase();
      const email = String(p?.user?.email || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [patients, searchQuery]);

  const handleRemovePrescription = (index) => {
    setPrescriptionsDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddPrescription = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("الصلاحيات", "يجب منح صلاحية الوصول للصور");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5 });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) {
      Alert.alert("خطأ", "تعذّر قراءة الملف");
      return;
    }
    const uri = `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`;
    setPrescriptionsDraft((prev) => [...prev, uri]);
  };

  const handleSaveNote = async () => {
    if (!activePatient?.appointmentId) {
      Alert.alert("خطأ", "لا يوجد معرف موعد للحفظ");
      return;
    }
    setSaving(true);
    try {
      await saveDoctorNote(activePatient.appointmentId, {
        note: noteDraft,
        prescriptions: prescriptionsDraft,
      });

      setPatients((prev) =>
        prev.map((p) =>
          p.key === activePatient.key
            ? {
                ...p,
                doctorNote: noteDraft,
                doctorPrescriptions: prescriptionsDraft,
              }
            : p
        )
      );
      setActivePatient(null);
      setPreviewImage(null);
    } catch (err) {
      Alert.alert("خطأ", err.message || "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const renderPrescriptionPreview = (items = [], editable = false) => {
    if (!items.length) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.prescriptionsRow}>
        {items.map((uri, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.prescriptionWrapper}
            onPress={() => setPreviewImage(uri)}
            activeOpacity={0.8}
          >
            <Image source={{ uri }} style={styles.prescriptionImage} />
            {editable && (
              <TouchableOpacity
                style={styles.removeBadge}
                onPress={() => handleRemovePrescription(idx)}
              >
                <Feather name="x" size={14} color="#fff" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderItem = ({ item }) => {
    const entry = {
      note: item.doctorNote || "",
      prescriptions: item.doctorPrescriptions || [],
    };
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.patientName}>{item.user?.name || "مريض"}</Text>
        </View>
        <Text style={styles.label}>الهاتف: <Text style={styles.value}>{item.user?.phone || "-"}</Text></Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => handleOpenPatient(item)}>
            <Text style={styles.primaryText}>عرض التفاصيل</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>المرضى</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={loadPatients}>
            <Feather name="refresh-ccw" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openDrawer}>
            <Feather name="menu" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visiblePatients}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.searchBar}>
              <Feather name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="ابحث عن مريض (اسم/هاتف/إيميل)"
                placeholderTextColor={colors.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{searchQuery ? "لا توجد نتائج" : "لا يوجد مرضى بعد"}</Text>
          }
        />
      )}

      <Modal visible={Boolean(activePatient)} animationType="slide" transparent onRequestClose={() => setActivePatient(null)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}} accessible={false}>
              <View style={styles.modalCard}>
                <View style={styles.infoBox}>
                  <Text style={styles.modalTitle}>{activePatient?.user?.name || "مريض"}</Text>
                  <Text style={styles.modalSubtitle}>{activePatient?.user?.phone || "-"}</Text>
                  <Text style={styles.modalSubtitle}>{activePatient?.user?.email || ""}</Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.modalLabel}>رقم الحجز</Text>
                    <Text style={styles.modalValue}>{activePatient?.lastBookingNumber || "-"}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.modalLabel}>آخر موعد</Text>
                    <Text style={styles.modalValue}>
                      {activePatient?.lastDate || "-"} {activePatient?.lastTime || ""}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.modalLabel}>الحالة</Text>
                    <Text style={styles.modalValue}>{activePatient?.status || "-"}</Text>
                  </View>

                  <Text style={[styles.modalLabel, { marginTop: 12 }]}>الحالة المرضية</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="اكتب الحالة المرضية"
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    multiline
                  />

                  <Text style={[styles.modalLabel, { marginTop: 12 }]}>الوصفة/المرفقات</Text>
                  {renderPrescriptionPreview(prescriptionsDraft, true) || (
                    <Text style={styles.noteValue}>لا توجد مرفقات</Text>
                  )}

                  <TouchableOpacity style={styles.outlineBtn} onPress={handleAddPrescription}>
                    <Feather name="upload" size={16} color={colors.primary} />
                    <Text style={styles.outlineText}>إضافة مرفق</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.modalActions}>
                  {userRole === "doctor" && (
                    <TouchableOpacity
                      style={[styles.primaryBtn, { marginRight: 8 }]}
                      onPress={() => {
                        navigation.navigate("BookAppointment", {
                          manualFromDoctor: true,
                          patientName: activePatient?.user?.name || "",
                          patientPhone: activePatient?.user?.phone || "",
                        });
                        setActivePatient(null);
                      }}
                    >
                      <Text style={styles.primaryText}>إضافة موعد</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setActivePatient(null)}>
                    <Text style={styles.cancelText}>إغلاق</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSaveNote}
                    disabled={saving}
                  >
                    <Text style={styles.saveText}>{saving ? "جارٍ الحفظ" : "حفظ"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={Boolean(previewImage)} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewBackdrop} activeOpacity={1} onPress={() => setPreviewImage(null)}>
            {previewImage ? (
              <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
            ) : null}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
    headerTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 6,
      color: colors.text,
    },
    loader: { flex: 1, justifyContent: "center", alignItems: "center" },
    empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
    card: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    patientName: { fontSize: 16, fontWeight: "700", color: colors.text },
    label: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    value: { color: colors.text, fontWeight: "600" },
    noteLabel: { marginTop: 8, fontSize: 12, color: colors.textMuted },
    noteValue: { fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 18 },
    actionsRow: { flexDirection: "row", marginTop: 10 },
    primaryBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      alignItems: "center",
    },
    primaryText: { color: "#fff", fontWeight: "700" },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      padding: 16,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    modalSubtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
    modalLabel: { fontSize: 12, color: colors.textMuted },
    prescriptionsRow: { marginTop: 8 },
    prescriptionWrapper: {
      marginRight: 8,
      position: "relative",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: "hidden",
    },
    prescriptionImage: { width: 90, height: 90 },
    infoBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surfaceAlt,
      gap: 6,
    },
    removeBadge: {
      position: "absolute",
      top: -8,
      right: -8,
      backgroundColor: colors.danger,
      borderRadius: 999,
      padding: 4,
      elevation: 2,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 14,
      gap: 10,
    },
    cancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: { color: colors.textMuted, fontWeight: "600" },
    saveBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: colors.success,
    },
    saveText: { color: "#fff", fontWeight: "700" },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 10,
      marginTop: 6,
      minHeight: 90,
      textAlignVertical: "top",
      color: colors.text,
    },
    outlineBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      marginTop: 8,
      alignSelf: "flex-start",
    },
    outlineText: { color: colors.primary, fontWeight: "700" },
    previewOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    previewBackdrop: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    previewImage: {
      maxWidth: "90%",
      maxHeight: "90%",
      width: "100%",
      height: undefined,
      aspectRatio: 1,
      resizeMode: "contain",
      borderRadius: 12,
      backgroundColor: "#000",
    },
  });
