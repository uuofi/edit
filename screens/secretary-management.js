import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Switch,
  FlatList,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  fetchSecretaries,
  createSecretary,
  updateSecretary,
  deleteSecretary,
  fetchSecretaryActivity,
} from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

// ─── Helper ──────────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}  ${h}:${min}`;
};

const ACTION_LABELS = {
  accepted: "قبول",
  rejected: "رفض",
  created: "إنشاء",
  completed: "إكمال",
  rescheduled: "إعادة جدولة",
};

const STATUS_LABELS = {
  pending: "معلّق",
  confirmed: "مؤكد",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const PERMISSION_LABELS = {
  canAcceptAppointments: "قبول الحجوزات",
  canRejectAppointments: "رفض الحجوزات",
  canCreateAppointments: "إنشاء حجوزات",
  canCompleteAppointments: "إكمال الحجوزات",
  canRescheduleAppointments: "إعادة جدولة الحجوزات",
  canViewPatients: "عرض المرضى",
  canViewReports: "عرض التقارير",
};

// ─── Main Component ──────────────────────────────────────────
export default function SecretaryManagementScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();

  const [secretaries, setSecretaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create / Edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSecretary, setEditingSecretary] = useState(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");

  // نفس الدالة بصفحة تسجيل الدخول: تحوّل أي صيغة إلى 10 أرقام تبدأ بـ7
  const normalizeIraqPhoneTo10Digits = (value) => {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("964") && digits.length === 13) digits = digits.slice(3);
    if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
    return digits.slice(0, 10);
  };
  const [formPassword, setFormPassword] = useState("");
  const [formPermissions, setFormPermissions] = useState({});
  const [formActive, setFormActive] = useState(true);
  const [formLocation, setFormLocation] = useState("");
  const [formSalary, setFormSalary] = useState("");
  const [formJobTitle, setFormJobTitle] = useState("");
  const [saving, setSaving] = useState(false);

  // Activity modal
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [activitySecretary, setActivitySecretary] = useState(null);
  const [activityData, setActivityData] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);

  // ─── Data loading ──────────────────────────────────────────
  const loadSecretaries = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetchSecretaries();
      setSecretaries(Array.isArray(res?.secretaries) ? res.secretaries : []);
    } catch (_e) {
      Alert.alert("خطأ", "تعذّر تحميل الموظفين");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSecretaries();
    }, [loadSecretaries])
  );

  const openDrawer = useCallback(() => {
    if (typeof navigation?.openDrawer === "function") {
      navigation.openDrawer();
      return;
    }
    const parent = navigation?.getParent?.();
    if (typeof parent?.openDrawer === "function") {
      parent.openDrawer();
    }
  }, [navigation]);

  // ─── Create / Edit ────────────────────────────────────────
  const openCreateModal = () => {
    setEditingSecretary(null);
    setFormName("");
    setFormPhone("");
    setFormPassword("");
    setFormPermissions({
      canAcceptAppointments: true,
      canRejectAppointments: true,
      canCreateAppointments: true,
      canCompleteAppointments: false,
      canRescheduleAppointments: true,
      canViewPatients: true,
      canViewReports: false,
    });
    setFormActive(true);
    setFormLocation("");
    setFormSalary("");
    setFormJobTitle("");
    setModalVisible(true);
  };

  const openEditModal = (sec) => {
    setEditingSecretary(sec);
    setFormName(sec.name || "");
    // عرض الرقم بصيغة 10 أرقام (بدون +964) مثل صفحة تسجيل الدخول
    setFormPhone(normalizeIraqPhoneTo10Digits(sec.phone || ""));
    setFormPassword("");
    setFormPermissions(sec.permissions || {});
    setFormActive(sec.isActive !== false);
    setFormLocation(sec.location || "");
    setFormSalary(sec.monthlySalary ? String(sec.monthlySalary) : "");
    setFormJobTitle(sec.jobTitle || "");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert("تنبيه", "الاسم مطلوب");
      return;
    }
    if (!editingSecretary && !formPhone.trim()) {
      Alert.alert("تنبيه", "رقم الهاتف مطلوب");
      return;
    }
    // نفس تحقق صفحة تسجيل الدخول: 10 أرقام تبدأ بـ7
    if (!editingSecretary && formPhone.trim()) {
      const phoneDigits = normalizeIraqPhoneTo10Digits(formPhone);
      if (phoneDigits.length !== 10 || !phoneDigits.startsWith("7")) {
        Alert.alert("تنبيه", "رقم الهاتف يجب أن يكون 10 أرقام ويبدأ بـ7");
        return;
      }
    }
    if (!editingSecretary && !formPassword) {
      Alert.alert("تنبيه", "كلمة المرور مطلوبة");
      return;
    }
    // نفس قواعد كلمة المرور بصفحة تسجيل الدخول
    if (formPassword) {
      const hasUpper = /[A-Z]/.test(formPassword);
      const hasLower = /[a-z]/.test(formPassword);
      const hasDigit = /\d/.test(formPassword);
      if (formPassword.length < 8 || !hasUpper || !hasLower || !hasDigit) {
        Alert.alert("تنبيه", "كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي حروف كبيرة وصغيرة ورقم");
        return;
      }
    }

    setSaving(true);
    try {
      if (editingSecretary) {
        const payload = {
          name: formName.trim(),
          permissions: formPermissions,
          isActive: formActive,
          location: formLocation.trim(),
          monthlySalary: formSalary ? Number(formSalary) : 0,
          jobTitle: formJobTitle.trim(),
        };
        if (formPhone.trim() && formPhone.trim() !== normalizeIraqPhoneTo10Digits(editingSecretary.phone)) {
          payload.phone = formPhone.trim();
        }
        if (formPassword) {
          payload.password = formPassword;
        }
        await updateSecretary(editingSecretary._id, payload);
        Alert.alert("نجاح", "تم تحديث بيانات الموظف");
      } else {
        await createSecretary({
          name: formName.trim(),
          phone: normalizeIraqPhoneTo10Digits(formPhone),
          password: formPassword,
          permissions: formPermissions,
          location: formLocation.trim(),
          monthlySalary: formSalary ? Number(formSalary) : 0,
          jobTitle: formJobTitle.trim(),
        });
        Alert.alert("نجاح", "تم إنشاء حساب الموظف بنجاح");
      }
      setModalVisible(false);
      loadSecretaries();
    } catch (e) {
      const msg = e?.payload?.message || e?.message || "حدث خطأ";
      Alert.alert("خطأ", msg);
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ────────────────────────────────────────────────
  const handleDelete = (sec) => {
    Alert.alert(
      "تأكيد الحذف",
      `هل تريد حذف حساب الموظف "${sec.name}"؟\nهذا الإجراء لا يمكن التراجع عنه.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSecretary(sec._id);
              Alert.alert("تم", "تم حذف الموظف بنجاح");
              loadSecretaries();
            } catch (e) {
              Alert.alert("خطأ", e?.payload?.message || "حدث خطأ أثناء الحذف");
            }
          },
        },
      ]
    );
  };

  // ─── Activity ──────────────────────────────────────────────
  const openActivity = async (sec) => {
    setActivitySecretary(sec);
    setActivityData([]);
    setActivityPage(1);
    setActivityTotal(0);
    setActivityModalVisible(true);
    setActivityLoading(true);
    try {
      const res = await fetchSecretaryActivity(sec._id, 1);
      setActivityData(Array.isArray(res?.appointments) ? res.appointments : []);
      setActivityTotal(res?.total || 0);
    } catch (_e) {
      Alert.alert("خطأ", "تعذّر تحميل سجل النشاط");
    } finally {
      setActivityLoading(false);
    }
  };

  const loadMoreActivity = async () => {
    if (activityLoading || !activitySecretary) return;
    if (activityData.length >= activityTotal) return;
    const nextPage = activityPage + 1;
    setActivityLoading(true);
    try {
      const res = await fetchSecretaryActivity(activitySecretary._id, nextPage);
      const items = Array.isArray(res?.appointments) ? res.appointments : [];
      setActivityData((prev) => [...prev, ...items]);
      setActivityPage(nextPage);
    } catch (_e) {
      // ignore
    } finally {
      setActivityLoading(false);
    }
  };

  // ─── Render helpers ────────────────────────────────────────
  const renderSecretaryCard = (sec) => (
    <View key={sec._id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Feather name="user" size={18} color={colors.primary} style={{ marginLeft: 8 }} />
          <Text style={styles.cardName}>{sec.name}</Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: sec.isActive ? colors.primary + "22" : colors.danger + "22" },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: sec.isActive ? colors.primary : colors.danger },
              ]}
            >
              {sec.isActive ? "نشط" : "معطّل"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Feather name="phone" size={14} color={colors.textMuted} />
          <Text style={styles.infoText}>{sec.phone}</Text>
        </View>
        {sec.jobTitle ? (
          <View style={styles.infoRow}>
            <Feather name="briefcase" size={14} color={colors.textMuted} />
            <Text style={styles.infoText}>{sec.jobTitle}</Text>
          </View>
        ) : null}
        {sec.location ? (
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={14} color={colors.textMuted} />
            <Text style={styles.infoText}>{sec.location}</Text>
          </View>
        ) : null}
        {sec.monthlySalary ? (
          <View style={styles.infoRow}>
            <Feather name="dollar-sign" size={14} color={colors.textMuted} />
            <Text style={styles.infoText}>{Number(sec.monthlySalary).toLocaleString()} د.ع</Text>
          </View>
        ) : null}
        <View style={styles.infoRow}>
          <Feather name="clock" size={14} color={colors.textMuted} />
          <Text style={styles.infoText}>
            آخر دخول: {sec.lastLoginAt ? formatDate(sec.lastLoginAt) : "لم يسجل دخول بعد"}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Feather name="calendar" size={14} color={colors.textMuted} />
          <Text style={styles.infoText}>تاريخ الإنشاء: {formatDate(sec.createdAt)}</Text>
        </View>
      </View>

      {/* الصلاحيات */}
      <View style={styles.permissionsRow}>
        {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
          const enabled = sec.permissions?.[key] === true;
          return (
            <View
              key={key}
              style={[
                styles.permChip,
                {
                  backgroundColor: enabled ? colors.primary + "18" : colors.border + "44",
                },
              ]}
            >
              <Feather
                name={enabled ? "check" : "x"}
                size={11}
                color={enabled ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.permChipText,
                  { color: enabled ? colors.primary : colors.textMuted },
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* أزرار الإجراءات */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary + "15" }]}
          onPress={() => openEditModal(sec)}
        >
          <Feather name="edit-2" size={15} color={colors.primary} />
          <Text style={[styles.actionBtnText, { color: colors.primary }]}>تعديل</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.info + "15" }]}
          onPress={() => openActivity(sec)}
        >
          <Feather name="activity" size={15} color={colors.info || colors.primary} />
          <Text style={[styles.actionBtnText, { color: colors.info || colors.primary }]}>النشاط</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.danger + "15" }]}
          onPress={() => handleDelete(sec)}
        >
          <Feather name="trash-2" size={15} color={colors.danger} />
          <Text style={[styles.actionBtnText, { color: colors.danger }]}>حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Activity item renderer ────────────────────────────────
  const renderActivityItem = ({ item }) => {
    const action = item.actionBySecretary?.action || "";
    const actionLabel = ACTION_LABELS[action] || action;
    const statusLabel = STATUS_LABELS[item.status] || item.status;
    const patientName = item.user?.name || "—";
    const patientPhone = item.user?.phone || "";
    const date = item.appointmentDate || "";
    const time = item.appointmentTime || "";
    const actionAt = formatDate(item.actionBySecretary?.actionAt);

    return (
      <View style={styles.activityItem}>
        <View style={styles.activityHeader}>
          <View style={[styles.badge, { backgroundColor: colors.primary + "22" }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{actionLabel}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.textMuted + "22" }]}>
            <Text style={[styles.badgeText, { color: colors.textMuted }]}>{statusLabel}</Text>
          </View>
          {item.bookingNumber ? (
            <Text style={styles.bookingNum}>#{item.bookingNumber}</Text>
          ) : null}
        </View>

        <View style={styles.infoRow}>
          <Feather name="user" size={13} color={colors.textMuted} />
          <Text style={styles.infoText}>
            {patientName}
            {patientPhone ? `  (${patientPhone})` : ""}
          </Text>
        </View>
        {date ? (
          <View style={styles.infoRow}>
            <Feather name="calendar" size={13} color={colors.textMuted} />
            <Text style={styles.infoText}>
              {date} {time ? `• ${time}` : ""}
            </Text>
          </View>
        ) : null}
        <View style={styles.infoRow}>
          <Feather name="clock" size={13} color={colors.textMuted} />
          <Text style={styles.infoText}>تاريخ الإجراء: {actionAt}</Text>
        </View>
        {item.service?.name ? (
          <View style={styles.infoRow}>
            <Feather name="tag" size={13} color={colors.textMuted} />
            <Text style={styles.infoText}>
              {item.service.name}
              {item.service.price ? ` - ${item.service.price} د.ع` : ""}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  // ─── Main render ───────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconButton} onPress={openDrawer}>
          <Feather name="menu" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة الموظفين</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal}>
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.addBtnText}>إضافة موظف</Text>
        </TouchableOpacity>
      </View>

      {secretaries.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="users" size={52} color={colors.textMuted} />
          <Text style={styles.emptyText}>لا يوجد موظفين مضافين</Text>
          <Text style={styles.emptySubtext}>
            أضف موظف لمساعدتك في إدارة العيادة والحجوزات
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadSecretaries(true)} />
          }
        >
          {secretaries.map(renderSecretaryCard)}
        </ScrollView>
      )}

      {/* Create / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingSecretary ? "تعديل الموظف" : "إضافة موظف جديد"}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>الاسم *</Text>
              <TextInput
                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="اسم الموظف"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>رقم الهاتف *</Text>
              <TextInput
                style={styles.input}
                value={formPhone}
                onChangeText={(t) => setFormPhone(normalizeIraqPhoneTo10Digits(t))}
                placeholder="أدخل 10 أرقام تبدأ بـ7"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!editingSecretary}
              />
              {editingSecretary ? (
                <Text style={styles.helperText}>لا يمكن تغيير رقم الهاتف بعد الإنشاء</Text>
              ) : null}

              <Text style={styles.fieldLabel}>
                {editingSecretary ? "كلمة المرور (اتركها فارغة إذا لا تريد تغييرها)" : "كلمة المرور *"}
              </Text>
              <TextInput
                style={styles.input}
                value={formPassword}
                onChangeText={setFormPassword}
                placeholder="8 أحرف على الأقل (كبيرة + صغيرة + رقم)"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />

              <Text style={styles.fieldLabel}>المسمى الوظيفي</Text>
              <TextInput
                style={styles.input}
                value={formJobTitle}
                onChangeText={setFormJobTitle}
                placeholder="مثال: موظف استقبال"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>الموقع / العنوان</Text>
              <TextInput
                style={styles.input}
                value={formLocation}
                onChangeText={setFormLocation}
                placeholder="مثال: بغداد - الكرادة"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>الراتب الشهري (د.ع)</Text>
              <TextInput
                style={styles.input}
                value={formSalary}
                onChangeText={setFormSalary}
                placeholder="مثال: 500000"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />

              {/* isActive toggle (edit only) */}
              {editingSecretary ? (
                <View style={styles.switchRow}>
                  <Text style={styles.fieldLabel}>الحساب نشط</Text>
                  <Switch
                    value={formActive}
                    onValueChange={setFormActive}
                    trackColor={{ false: colors.border, true: colors.primary + "66" }}
                    thumbColor={formActive ? colors.primary : colors.textMuted}
                  />
                </View>
              ) : null}

              {/* Permissions */}
              <Text style={[styles.fieldLabel, { marginTop: 16, fontSize: 16, fontWeight: "700" }]}>
                الصلاحيات
              </Text>
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <View key={key} style={styles.switchRow}>
                  <Text style={styles.permLabel}>{label}</Text>
                  <Switch
                    value={formPermissions[key] === true}
                    onValueChange={(v) =>
                      setFormPermissions((prev) => ({ ...prev, [key]: v }))
                    }
                    trackColor={{ false: colors.border, true: colors.primary + "66" }}
                    thumbColor={formPermissions[key] ? colors.primary : colors.textMuted}
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingSecretary ? "حفظ التغييرات" : "إنشاء الحساب"}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Activity Modal */}
      <Modal visible={activityModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                نشاط: {activitySecretary?.name || ""}
              </Text>
              <TouchableOpacity onPress={() => setActivityModalVisible(false)}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.activityCount}>
              إجمالي الإجراءات: {activityTotal}
            </Text>

            {activityLoading && activityData.length === 0 ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : activityData.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="inbox" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>لا يوجد نشاط بعد</Text>
              </View>
            ) : (
              <FlatList
                data={activityData}
                keyExtractor={(item) => item._id}
                renderItem={renderActivityItem}
                contentContainerStyle={{ paddingBottom: 20 }}
                onEndReached={loadMoreActivity}
                onEndReachedThreshold={0.3}
                ListFooterComponent={
                  activityLoading ? (
                    <ActivityIndicator
                      color={colors.primary}
                      style={{ marginVertical: 12 }}
                    />
                  ) : null
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    header: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    headerIconButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addBtn: {
      flexDirection: "row-reverse",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      gap: 6,
    },
    addBtnText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text,
      marginTop: 14,
      fontWeight: "600",
    },
    emptySubtext: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 6,
      textAlign: "center",
      lineHeight: 20,
    },
    // Card
    card: {
      marginHorizontal: 14,
      marginTop: 14,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    cardHeader: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "55",
    },
    cardTitleRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 6,
    },
    cardName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
      textAlign: "right",
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "600",
    },
    cardBody: {
      padding: 14,
      gap: 6,
    },
    infoRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 6,
    },
    infoText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
      flex: 1,
    },
    permissionsRow: {
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      paddingHorizontal: 14,
      paddingBottom: 10,
      gap: 6,
    },
    permChip: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 3,
    },
    permChipText: {
      fontSize: 11,
      fontWeight: "500",
    },
    cardActions: {
      flexDirection: "row-reverse",
      borderTopWidth: 1,
      borderTopColor: colors.border + "55",
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
      gap: 5,
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: "600",
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 16,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      maxHeight: "90%",
      padding: 18,
    },
    modalHeader: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 6,
      marginTop: 10,
      textAlign: "right",
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      textAlign: "right",
    },
    helperText: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
      textAlign: "right",
    },
    switchRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border + "44",
    },
    permLabel: {
      fontSize: 14,
      color: colors.text,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 20,
      marginBottom: 10,
    },
    saveBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
    // Activity
    activityCount: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
      marginBottom: 10,
    },
    activityItem: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border + "55",
      gap: 5,
    },
    activityHeader: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    bookingNum: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
    },
  });
