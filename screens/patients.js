import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  API_BASE_URL,
  createDoctorArchiveEntry,
  deleteDoctorArchiveEntry,
  fetchDoctorArchiveByPatient,
  fetchDoctorArchivePatients,
  fetchDoctorDashboard,
  getUserRole,
  updateDoctorArchiveEntry,
  uploadDoctorArchiveFile,
  fetchArchiveTemplate,
  saveArchiveTemplate,
} from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const DEBOUNCE_MS = 350;

const getInitials = (name) => {
  const clean = String(name || "").trim();
  if (!clean) return "م";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1);
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
};

const normalizeMediaUrl = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (/^(https?:|data:|file:|content:)/i.test(raw)) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API_BASE_URL}${path}`;
};

const isPdfUri = (uri) => /\.pdf($|\?)/i.test(String(uri || ""));

const DEFAULT_ARCHIVE_TEMPLATE = [
  { key: "patientCondition", label: "حالة المريض", fieldType: "text", isBuiltIn: true, enabled: true, order: 0, options: [], required: false },
  { key: "upcomingVisitsCount", label: "عدد الزيارات القادمة", fieldType: "number", isBuiltIn: true, enabled: true, order: 1, options: [], required: false },
  { key: "totalSpentAmount", label: "إجمالي المبالغ السابقة", fieldType: "number", isBuiltIn: true, enabled: true, order: 2, options: [], required: false },
  { key: "doctorNote", label: "الملاحظات الطبية", fieldType: "textarea", isBuiltIn: true, enabled: true, order: 3, options: [], required: false },
  { key: "prescriptions", label: "الوصفات", fieldType: "images", isBuiltIn: true, enabled: true, order: 4, options: [], required: false },
  { key: "reports", label: "التقارير", fieldType: "images", isBuiltIn: true, enabled: true, order: 5, options: [], required: false },
];

const FIELD_TYPE_LABELS = {
  text: "نص قصير",
  number: "رقم",
  textarea: "نص طويل",
  select: "قائمة منسدلة",
  date: "تاريخ",
  checkbox: "مربع تأشير",
  images: "صور / مرفقات",
};

const buildArchiveForm = (entry) => ({
  note: String(entry?.doctorNote || ""),
  patientCondition: String(entry?.patientCondition || ""),
  upcomingVisitsCount: String(
    Number.isFinite(Number(entry?.upcomingVisitsCount))
      ? Math.max(0, Math.floor(Number(entry?.upcomingVisitsCount)))
      : ""
  ),
  totalSpentAmount: Number(entry?.totalSpentAmount || 0),
  prescriptions: Array.isArray(entry?.prescriptions) ? entry.prescriptions : [],
  reports: Array.isArray(entry?.reports) ? entry.reports : [],
});

const formatIqd = (value) => {
  const num = Number(value) || 0;
  try {
    return `${Math.max(0, num).toLocaleString("ar-IQ")} د.ع`;
  } catch {
    return `${Math.max(0, num)} د.ع`;
  }
};

export default function PatientsScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [archiveEnabled, setArchiveEnabled] = useState(true);

  const [activePatient, setActivePatient] = useState(null);
  const [modalMode, setModalMode] = useState(null); // null | archive | add

  const [archives, setArchives] = useState([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [editingArchive, setEditingArchive] = useState(null);

  const [formNote, setFormNote] = useState("");
  const [formPatientCondition, setFormPatientCondition] = useState("");
  const [formUpcomingVisitsCount, setFormUpcomingVisitsCount] = useState("");
  const [formTotalSpentAmount, setFormTotalSpentAmount] = useState(0);
  const [formPrescriptions, setFormPrescriptions] = useState([]);
  const [formReports, setFormReports] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [savingArchive, setSavingArchive] = useState(false);

  const [previewUri, setPreviewUri] = useState("");

  // Archive template (customizable fields)
  const [archiveTemplate, setArchiveTemplate] = useState(DEFAULT_ARCHIVE_TEMPLATE);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateDraft, setTemplateDraft] = useState([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateView, setTemplateView] = useState("list"); // "list" | "field"
  const [editingFieldIdx, setEditingFieldIdx] = useState(null);
  const [fieldDraft, setFieldDraft] = useState({ key: "", label: "", fieldType: "text", options: [], required: false, enabled: true });
  const [newOptionText, setNewOptionText] = useState("");

  // Custom fields form data (for add/edit archive)
  const [formCustomFields, setFormCustomFields] = useState({});

  const firstRender = useRef(true);
  const previousQuery = useRef("");

  const totalArchivedVisits = useMemo(
    () => patients.reduce((sum, item) => sum + Number(item?.count || 0), 0),
    [patients]
  );

  const closeModals = useCallback(() => {
    setModalMode(null);
    setActivePatient(null);
    setEditingArchive(null);
    setFormNote("");
    setFormPatientCondition("");
    setFormUpcomingVisitsCount("");
    setFormTotalSpentAmount(0);
    setFormPrescriptions([]);
    setFormReports([]);
    setFormCustomFields({});
    setPreviewUri("");
  }, []);

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

  const loadPatients = useCallback(
    async (query = "") => {
      setLoading(true);
      if (!archiveEnabled) {
        setLoading(false);
        return;
      }

      try {
        const data = await fetchDoctorArchivePatients(query);
        setPatients(Array.isArray(data?.patients) ? data.patients : []);
      } catch (error) {
        console.log("patients archive load error", error);
        Alert.alert("خطأ", error?.message || "تعذّر تحميل ارشيف المرضى");
      } finally {
        setLoading(false);
      }
    },
    [archiveEnabled]
  );

  const loadArchivesForPatient = useCallback(async (patient) => {
    if (!patient?.patientId) return;
    setLoadingArchives(true);
    try {
      const data = await fetchDoctorArchiveByPatient(patient.patientId);
      setArchives(Array.isArray(data?.archives) ? data.archives : []);
      const totalSpentAmount = Number(data?.totalSpentAmount || 0);
      setActivePatient((prev) => {
        if (!prev || String(prev.patientId || "") !== String(patient.patientId || "")) {
          return prev;
        }
        return {
          ...prev,
          totalSpentAmount,
        };
      });
    } catch (error) {
      Alert.alert("خطأ", error?.message || "تعذّر تحميل الأرشيف");
    } finally {
      setLoadingArchives(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!archiveEnabled) return;
      loadPatients(previousQuery.current || "");
    }, [archiveEnabled, loadPatients])
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [dashboard, role, tmpl] = await Promise.all([
          fetchDoctorDashboard(),
          getUserRole(),
          fetchArchiveTemplate().catch(() => null),
        ]);

        if (!mounted) return;

        const canArchive =
          dashboard?.doctor?.subscriptionFeatures?.caseArchiveEnabled !== false;
        setArchiveEnabled(Boolean(canArchive));
        setUserRole(role);

        if (Array.isArray(tmpl?.template) && tmpl.template.length) {
          setArchiveTemplate(tmpl.template);
        }

        if (!canArchive) {
          Alert.alert(
            "غير متاح",
            "ميزة ارشفة المرضى غير متاحة ضمن الباقة الحالية.",
            [{ text: "حسناً", onPress: () => navigation.goBack() }]
          );
          return;
        }

        await loadPatients("");
      } catch (error) {
        console.warn("patients: failed to initialize", error?.message || error);
        if (mounted) {
          setArchiveEnabled(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadPatients, navigation]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      previousQuery.current = searchQuery;
      return;
    }

    if (searchQuery === previousQuery.current) return;
    previousQuery.current = searchQuery;

    const timeout = setTimeout(() => {
      loadPatients(searchQuery);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [searchQuery, loadPatients]);

  const openArchiveModal = async (patient) => {
    setActivePatient(patient);
    setModalMode("archive");
    await loadArchivesForPatient(patient);
  };

  const openAddArchiveModal = (patient) => {
    setActivePatient(patient);
    setEditingArchive(null);
    const blank = buildArchiveForm(null);
    setFormNote(blank.note);
    setFormPatientCondition(blank.patientCondition);
    setFormUpcomingVisitsCount(blank.upcomingVisitsCount);
    setFormTotalSpentAmount(Number(patient?.totalSpentAmount || 0));
    setFormPrescriptions(blank.prescriptions);
    setFormReports(blank.reports);
    setFormCustomFields({});
    setModalMode("add");
  };

  const openEditArchiveModal = (patient, archiveEntry) => {
    setActivePatient(patient);
    setEditingArchive(archiveEntry);
    const payload = buildArchiveForm(archiveEntry);
    setFormNote(payload.note);
    setFormPatientCondition(payload.patientCondition);
    setFormUpcomingVisitsCount(payload.upcomingVisitsCount);
    setFormTotalSpentAmount(payload.totalSpentAmount);
    setFormPrescriptions(payload.prescriptions);
    setFormReports(payload.reports);
    setFormCustomFields(archiveEntry?.customFields && typeof archiveEntry.customFields === "object" ? { ...archiveEntry.customFields } : {});
    setModalMode("add");
  };

  const openManualBooking = (patient) => {
    if (!patient) return;

    const params = {
      openManualBooking: true,
      requestId: `${Date.now()}-${patient?.patientId || ""}`,
      patientId: patient?.patientId || "",
      patientName: patient?.patientName || "",
      patientPhone: patient?.patientPhone || "",
    };

    if (typeof navigation?.navigate === "function") {
      navigation.navigate("ProviderAppointmentsTab", params);
      closeModals();
      return;
    }

    const parent = navigation?.getParent?.();
    if (typeof parent?.navigate === "function") {
      parent.navigate("ProviderTabs", {
        screen: "ProviderAppointmentsTab",
        params,
      });
    } else if (typeof navigation?.navigate === "function") {
      navigation.navigate("ProviderAppointmentsTab", params);
    }

    closeModals();
  };

  const handleUploadImage = async (kind = "prescription") => {
    try {
      const permissions = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissions.granted) {
        Alert.alert("خطأ", "يجب السماح بالوصول للصور");
        return;
      }

      const picker = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });
      if (picker.canceled) return;

      const asset = picker.assets?.[0];
      if (!asset?.uri) return;

      setUploadingFile(true);
      const result = await uploadDoctorArchiveFile(
        asset.uri,
        kind === "prescription" ? "prescription" : "report"
      );

      if (!result?.url) return;

      if (kind === "prescription") {
        setFormPrescriptions((prev) => [...prev, result.url]);
      } else {
        setFormReports((prev) => [...prev, result.url]);
      }
    } catch (error) {
      Alert.alert("خطأ", error?.message || "تعذّر رفع الملف");
    } finally {
      setUploadingFile(false);
    }
  };

  const removeAtIndex = (listSetter, index) => {
    listSetter((prev) => prev.filter((_, position) => position !== index));
  };

  const saveArchive = async () => {
    if (!activePatient?.patientId) {
      Alert.alert("خطأ", "لا يوجد مريض محدد");
      return;
    }

    const normalizedUpcomingVisits = Math.max(
      0,
      Math.floor(Number(formUpcomingVisitsCount || 0) || 0)
    );

    if (
      !formNote.trim() &&
      !formPatientCondition.trim() &&
      normalizedUpcomingVisits <= 0 &&
      !formPrescriptions.length &&
      !formReports.length
    ) {
      Alert.alert("تنبيه", "أضف بيانات أرشيف واحدة على الأقل");
      return;
    }

    setSavingArchive(true);
    try {
      const payload = {
        patientId: activePatient.patientId,
        note: formNote,
        patientCondition: formPatientCondition,
        upcomingVisitsCount: normalizedUpcomingVisits,
        prescriptions: formPrescriptions,
        reports: formReports,
        customFields: formCustomFields,
      };

      if (editingArchive?._id) {
        await updateDoctorArchiveEntry(editingArchive._id, payload);
      } else {
        await createDoctorArchiveEntry(payload);
      }

      await loadArchivesForPatient(activePatient);
      await loadPatients(searchQuery);
      setModalMode("archive");
      setEditingArchive(null);
    } catch (error) {
      Alert.alert("خطأ", error?.message || "تعذّر حفظ الأرشيف");
    } finally {
      setSavingArchive(false);
    }
  };

  const confirmDeleteArchive = (archiveEntry) => {
    if (!archiveEntry?._id) return;
    Alert.alert("تأكيد الحذف", "هل تريد حذف هذا الأرشيف؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoctorArchiveEntry(archiveEntry._id);
            await loadArchivesForPatient(activePatient);
            await loadPatients(searchQuery);
          } catch (error) {
            Alert.alert("خطأ", error?.message || "تعذّر حذف الأرشيف");
          }
        },
      },
    ]);
  };

  // ── Template management ──
  const openTemplateSettings = () => {
    setTemplateDraft(archiveTemplate.map((f, i) => ({ ...f, order: f.order ?? i })));
    setShowTemplateModal(true);
  };

  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    setTemplateDraft([]);
    setTemplateView("list");
    setEditingFieldIdx(null);
    setFieldDraft({ key: "", label: "", fieldType: "text", options: [], required: false, enabled: true });
    setNewOptionText("");
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const res = await saveArchiveTemplate(templateDraft);
      if (Array.isArray(res?.template)) {
        setArchiveTemplate(res.template);
      }
      closeTemplateModal();
    } catch (error) {
      Alert.alert("خطأ", error?.message || "تعذّر حفظ القالب");
    } finally {
      setSavingTemplate(false);
    }
  };

  const openAddFieldForm = () => {
    setEditingFieldIdx(null);
    setFieldDraft({
      key: `custom_${Date.now()}`,
      label: "",
      fieldType: "text",
      options: [],
      required: false,
      enabled: true,
    });
    setNewOptionText("");
    setTemplateView("field");
  };

  const openEditFieldForm = (idx) => {
    const f = templateDraft[idx];
    setEditingFieldIdx(idx);
    setFieldDraft({ ...f, options: Array.isArray(f.options) ? [...f.options] : [] });
    setNewOptionText("");
    setTemplateView("field");
  };

  const saveFieldDraft = () => {
    if (!fieldDraft.label.trim()) {
      Alert.alert("تنبيه", "يجب إدخال اسم الحقل");
      return;
    }
    if (fieldDraft.fieldType === "select" && fieldDraft.options.length === 0) {
      Alert.alert("تنبيه", "يجب إضافة خيار واحد على الأقل للقائمة المنسدلة");
      return;
    }
    const updated = [...templateDraft];
    const field = {
      ...fieldDraft,
      key: fieldDraft.key || `custom_${Date.now()}`,
      isBuiltIn: false,
      order: editingFieldIdx !== null ? updated[editingFieldIdx].order : updated.length,
    };
    if (editingFieldIdx !== null) {
      updated[editingFieldIdx] = { ...updated[editingFieldIdx], ...field, isBuiltIn: updated[editingFieldIdx].isBuiltIn };
    } else {
      updated.push(field);
    }
    setTemplateDraft(updated);
    setTemplateView("list");
    setEditingFieldIdx(null);
  };

  const removeCustomField = (idx) => {
    const field = templateDraft[idx];
    if (field?.isBuiltIn) {
      Alert.alert("تنبيه", "لا يمكن حذف الحقول الأساسية، يمكنك تعطيلها فقط");
      return;
    }
    Alert.alert("حذف الحقل", `هل تريد حذف "${field?.label}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => setTemplateDraft((prev) => prev.filter((_, i) => i !== idx)) },
    ]);
  };

  const toggleFieldEnabled = (idx) => {
    setTemplateDraft((prev) => prev.map((f, i) => i === idx ? { ...f, enabled: !f.enabled } : f));
  };

  const moveFieldUp = (idx) => {
    if (idx <= 0) return;
    setTemplateDraft((prev) => {
      const arr = [...prev];
      const prevOrder = arr[idx - 1].order;
      arr[idx - 1] = { ...arr[idx - 1], order: arr[idx].order };
      arr[idx] = { ...arr[idx], order: prevOrder };
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  };

  const moveFieldDown = (idx) => {
    setTemplateDraft((prev) => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      const nextOrder = arr[idx + 1].order;
      arr[idx + 1] = { ...arr[idx + 1], order: arr[idx].order };
      arr[idx] = { ...arr[idx], order: nextOrder };
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  };

  const sortedTemplate = useMemo(
    () => [...archiveTemplate].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [archiveTemplate]
  );

  const enabledTemplate = useMemo(
    () => sortedTemplate.filter((f) => f.enabled !== false),
    [sortedTemplate]
  );

  // Get custom-only fields (non-built-in, enabled)
  const customEnabledFields = useMemo(
    () => enabledTemplate.filter((f) => !f.isBuiltIn),
    [enabledTemplate]
  );

  // ── Dynamic form field rendering ──
  const renderDynamicFormField = (field) => {
    const key = field.key;
    const isBuiltIn = field.isBuiltIn;

    // Built-in fields are rendered by existing code
    if (isBuiltIn) return null;

    const value = formCustomFields[key];

    switch (field.fieldType) {
      case "text":
        return (
          <View key={key} style={{ marginBottom: 8 }}>
            <Text style={styles.modalLabel}>{field.label}{field.required ? " *" : ""}</Text>
            <TextInput
              style={styles.inputSingleLine}
              placeholder={field.label}
              placeholderTextColor={colors.placeholder}
              value={String(value || "")}
              onChangeText={(text) => setFormCustomFields((prev) => ({ ...prev, [key]: text }))}
            />
          </View>
        );

      case "number":
        return (
          <View key={key} style={{ marginBottom: 8 }}>
            <Text style={styles.modalLabel}>{field.label}{field.required ? " *" : ""}</Text>
            <TextInput
              style={styles.inputSingleLine}
              placeholder="0"
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
              value={String(value ?? "")}
              onChangeText={(text) => {
                const num = text.replace(/[^0-9.-]/g, "");
                setFormCustomFields((prev) => ({ ...prev, [key]: num }));
              }}
            />
          </View>
        );

      case "textarea":
        return (
          <View key={key} style={{ marginBottom: 8 }}>
            <Text style={styles.modalLabel}>{field.label}{field.required ? " *" : ""}</Text>
            <TextInput
              style={styles.input}
              placeholder={field.label}
              placeholderTextColor={colors.placeholder}
              multiline
              value={String(value || "")}
              onChangeText={(text) => setFormCustomFields((prev) => ({ ...prev, [key]: text }))}
            />
          </View>
        );

      case "select":
        return (
          <View key={key} style={{ marginBottom: 8 }}>
            <Text style={styles.modalLabel}>{field.label}{field.required ? " *" : ""}</Text>
            <View style={styles.selectRow}>
              {(field.options || []).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.selectOption, value === opt && styles.selectOptionActive]}
                  onPress={() => setFormCustomFields((prev) => ({ ...prev, [key]: value === opt ? "" : opt }))}
                >
                  <Text style={[styles.selectOptionText, value === opt && styles.selectOptionTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case "date":
        return (
          <View key={key} style={{ marginBottom: 8 }}>
            <Text style={styles.modalLabel}>{field.label}{field.required ? " *" : ""}</Text>
            <TextInput
              style={styles.inputSingleLine}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.placeholder}
              value={String(value || "")}
              onChangeText={(text) => setFormCustomFields((prev) => ({ ...prev, [key]: text }))}
            />
          </View>
        );

      case "checkbox":
        return (
          <TouchableOpacity
            key={key}
            style={styles.checkboxRow}
            onPress={() => setFormCustomFields((prev) => ({ ...prev, [key]: !value }))}
          >
            <View style={[styles.checkboxBox, value && styles.checkboxBoxActive]}>
              {value ? <Feather name="check" size={14} color={colors.surface} /> : null}
            </View>
            <Text style={styles.checkboxLabel}>{field.label}{field.required ? " *" : ""}</Text>
          </TouchableOpacity>
        );

      case "images":
        return (
          <View key={key} style={{ marginBottom: 8 }}>
            <Text style={styles.modalLabel}>{field.label}{field.required ? " *" : ""}</Text>
            {renderAttachments(
              Array.isArray(value) ? value : [],
              field.label,
              true,
              (setter) => {
                if (typeof setter === "function") {
                  setFormCustomFields((prev) => ({
                    ...prev,
                    [key]: setter(Array.isArray(prev[key]) ? prev[key] : []),
                  }));
                }
              }
            ) || <Text style={styles.noteHint}>لا توجد مرفقات</Text>}
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={async () => {
                try {
                  const permissions = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!permissions.granted) { Alert.alert("خطأ", "يجب السماح بالوصول للصور"); return; }
                  const picker = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.85 });
                  if (picker.canceled) return;
                  const asset = picker.assets?.[0];
                  if (!asset?.uri) return;
                  setUploadingFile(true);
                  const result = await uploadDoctorArchiveFile(asset.uri, "custom");
                  if (result?.url) {
                    setFormCustomFields((prev) => ({
                      ...prev,
                      [key]: [...(Array.isArray(prev[key]) ? prev[key] : []), result.url],
                    }));
                  }
                } catch (err) {
                  Alert.alert("خطأ", err?.message || "تعذّر رفع الملف");
                } finally {
                  setUploadingFile(false);
                }
              }}
              disabled={uploadingFile}
            >
              <Feather name="image" size={16} color={colors.primary} />
              <Text style={styles.outlineText}>{uploadingFile ? "جارٍ الرفع" : `إضافة ${field.label}`}</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  // ── Render custom field value in display mode ──
  const renderCustomFieldDisplay = (field, entry) => {
    const val = entry?.customFields?.[field.key];
    if (val === undefined || val === null || val === "") return null;
    if (Array.isArray(val) && val.length === 0) return null;
    if (typeof val === "boolean" && !val) return null;

    if (field.fieldType === "images" && Array.isArray(val) && val.length > 0) {
      return renderAttachments(val, field.label);
    }

    if (field.fieldType === "checkbox") {
      return (
        <View style={styles.entrySection}>
          <Text style={styles.modalLabel}>{field.label}</Text>
          <Text style={styles.entryText}>{val ? "نعم ✓" : "لا"}</Text>
        </View>
      );
    }

    return (
      <View style={styles.entrySection}>
        <Text style={styles.modalLabel}>{field.label}</Text>
        <Text style={styles.entryText}>{String(val)}</Text>
      </View>
    );
  };

  const renderAttachments = (items = [], label = "المرفقات", editable = false, listSetter = null) => {
    if (!items.length) return null;

    return (
      <View style={styles.entrySection}>
        <Text style={styles.modalLabel}>{label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentsRow}>
          {items.map((uri, index) => {
            const fullUri = normalizeMediaUrl(uri);
            const pdf = isPdfUri(fullUri);
            return (
              <TouchableOpacity
                key={`${fullUri}-${index}`}
                style={styles.attachmentItem}
                activeOpacity={0.85}
                onPress={() => {
                  if (pdf) {
                    Linking.openURL(fullUri).catch(() => {
                      Alert.alert("تنبيه", "تعذّر فتح الملف");
                    });
                    return;
                  }
                  setPreviewUri(fullUri);
                }}
              >
                {pdf ? (
                  <View style={styles.pdfPlaceholder}>
                    <Feather name="file-text" size={18} color={colors.primary} />
                    <Text style={styles.pdfPlaceholderText}>PDF</Text>
                  </View>
                ) : (
                  <Image source={{ uri: fullUri }} style={styles.attachmentImage} />
                )}

                {editable && listSetter ? (
                  <TouchableOpacity
                    style={styles.removeBadge}
                    onPress={() => removeAtIndex(listSetter, index)}
                  >
                    <Feather name="x" size={14} color={colors.surface} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderPatientItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.patientIdentity}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{getInitials(item.patientName)}</Text>
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.patientName}>{item.patientName || "مريض"}</Text>
            <Text style={styles.visitMeta}>آخر زيارة: {item.lastVisit || "-"}</Text>
          </View>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeValue}>{item.count || 0}</Text>
          <Text style={styles.countBadgeLabel}>أرشفة</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Feather name="phone" size={13} color={colors.textMuted} />
        <Text style={styles.patientMeta}>{item.patientPhone || "-"}</Text>
      </View>
      {item.patientCondition ? (
        <View style={styles.metaRow}>
          <Feather name="activity" size={13} color={colors.textMuted} />
          <Text style={styles.patientMeta}>الحالة: {item.patientCondition}</Text>
        </View>
      ) : null}
      <View style={styles.metaRow}>
        <Feather name="calendar" size={13} color={colors.textMuted} />
        <Text style={styles.patientMeta}>
          الزيارات القادمة: {Math.max(0, Number(item?.upcomingVisitsCount || 0))}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Feather name="credit-card" size={13} color={colors.textMuted} />
        <Text style={styles.patientMeta}>إجمالي المبالغ السابقة: {formatIqd(item?.totalSpentAmount)}</Text>
      </View>
      {item.lastNote ? <Text style={styles.lastNote}>{item.lastNote}</Text> : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.outlineBtnCompact} onPress={() => openArchiveModal(item)}>
          <Feather name="archive" size={16} color={colors.primary} />
          <Text style={styles.outlineText}>عرض الأرشيف</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.outlineBtnCompact} onPress={() => openAddArchiveModal(item)}>
          <Feather name="edit-3" size={16} color={colors.primary} />
          <Text style={styles.outlineText}>إضافة ملاحظة/تقارير</Text>
        </TouchableOpacity>

        {userRole === "doctor" ? (
          <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnFull]} onPress={() => openManualBooking(item)}>
            <Feather name="calendar" size={15} color={colors.surface} />
            <Text style={styles.primaryText}>إضافة موعد</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  if (!archiveEnabled) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loader}>
          <Text style={styles.empty}>ميزة الأرشفة غير متاحة ضمن الباقة الحالية.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>ارشيف المرضى</Text>
          <Text style={styles.headerSubtitle}>سجل طبي منظم لكل مريض</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconAction} onPress={openTemplateSettings}>
            <Feather name="settings" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconAction} onPress={() => loadPatients(searchQuery)}>
            <Feather name="refresh-ccw" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconAction} onPress={openDrawer}>
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
          data={patients}
          keyExtractor={(item) => item.patientId || item.patientPhone || String(Math.random())}
          renderItem={renderPatientItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{patients.length}</Text>
                  <Text style={styles.summaryLabel}>عدد المرضى</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalArchivedVisits}</Text>
                  <Text style={styles.summaryLabel}>إجمالي الأرشفة</Text>
                </View>
              </View>

              <View style={styles.searchBar}>
                <Feather name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="ابحث عن مريض (اسم/هاتف)"
                  placeholderTextColor={colors.placeholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Feather name="x-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{searchQuery ? "لا توجد نتائج" : "لا يوجد ارشيف مرضى حالياً"}</Text>
          }
        />
      )}

      <Modal
        visible={modalMode === "archive"}
        animationType="slide"
        transparent
        onRequestClose={closeModals}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.infoBox}>
              <Text style={styles.modalTitle}>{activePatient?.patientName || "مريض"}</Text>
              <Text style={styles.modalSubtitle}>{activePatient?.patientPhone || "-"}</Text>
              <Text style={styles.modalLabel}>
                إجمالي المبالغ السابقة: {formatIqd(activePatient?.totalSpentAmount)}
              </Text>
            </View>

            {loadingArchives ? (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : archives.length === 0 ? (
              <Text style={styles.empty}>لا يوجد ارشيف لهذا المريض</Text>
            ) : (
              <ScrollView style={styles.archiveList} contentContainerStyle={{ paddingBottom: 16 }}>
                {archives.map((entry, index) => (
                  <View key={`${entry._id || "entry"}-${index}`} style={styles.archiveEntry}>
                    <View style={styles.entryHeader}>
                      <Text style={styles.entryTitle}>زيارة</Text>
                      <Text style={styles.entryDate}>
                        {entry.appointmentDate || "-"} {entry.appointmentTime || ""}
                      </Text>
                    </View>

                    <View style={styles.entryActions}>
                      <TouchableOpacity
                        style={styles.entryActionBtn}
                        onPress={() => openEditArchiveModal(activePatient, entry)}
                      >
                        <Feather name="edit" size={14} color={colors.primary} />
                        <Text style={styles.entryActionText}>تعديل</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.entryDeleteBtn}
                        onPress={() => confirmDeleteArchive(entry)}
                      >
                        <Feather name="trash-2" size={14} color={colors.danger} />
                        <Text style={styles.entryDeleteText}>حذف</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Render enabled fields in template order */}
                    {enabledTemplate.map((field) => {
                      // Built-in fields
                      if (field.key === "doctorNote" && entry.doctorNote) {
                        return (
                          <View key="doctorNote" style={styles.entrySection}>
                            <Text style={styles.modalLabel}>{field.label}</Text>
                            <Text style={styles.entryText}>{entry.doctorNote}</Text>
                          </View>
                        );
                      }
                      if (field.key === "patientCondition" && entry.patientCondition) {
                        return (
                          <View key="patientCondition" style={styles.entrySection}>
                            <Text style={styles.modalLabel}>{field.label}</Text>
                            <Text style={styles.entryText}>{entry.patientCondition}</Text>
                          </View>
                        );
                      }
                      if (field.key === "upcomingVisitsCount") {
                        return (
                          <View key="upcomingVisitsCount" style={styles.entrySection}>
                            <Text style={styles.modalLabel}>{field.label}</Text>
                            <Text style={styles.entryText}>
                              {Math.max(0, Number(entry?.upcomingVisitsCount || 0))}
                            </Text>
                          </View>
                        );
                      }
                      if (field.key === "totalSpentAmount") {
                        return (
                          <View key="totalSpentAmount" style={styles.entrySection}>
                            <Text style={styles.modalLabel}>{field.label}</Text>
                            <Text style={styles.entryText}>{formatIqd(entry?.totalSpentAmount)}</Text>
                          </View>
                        );
                      }
                      if (field.key === "prescriptions") {
                        return <View key="prescriptions">{renderAttachments(entry.prescriptions || [], field.label)}</View>;
                      }
                      if (field.key === "reports") {
                        return <View key="reports">{renderAttachments(entry.reports || [], field.label)}</View>;
                      }
                      // Custom fields
                      if (!field.isBuiltIn) {
                        return <View key={field.key}>{renderCustomFieldDisplay(field, entry)}</View>;
                      }
                      return null;
                    })}
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => openAddArchiveModal(activePatient)}>
                <Feather name="plus" size={16} color={colors.primary} />
                <Text style={styles.outlineText}>إضافة ملاحظة/تقارير</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={closeModals}>
                <Text style={styles.cancelText}>إغلاق</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalMode === "add"}
        animationType="slide"
        transparent
        onRequestClose={closeModals}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}} accessible={false}>
              <View style={styles.modalCard}>
                <View style={styles.infoBox}>
                  <Text style={styles.modalTitle}>{activePatient?.patientName || "مريض"}</Text>
                  <Text style={styles.modalSubtitle}>{activePatient?.patientPhone || "-"}</Text>
                  <Text style={styles.modalLabel}>الحالة المرضية / الملاحظات</Text>
                </View>

                <ScrollView style={styles.formBody} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
                  {/* Render all enabled fields dynamically in template order */}
                  {enabledTemplate.map((field) => {
                    // ── Built-in fields ──
                    if (field.key === "patientCondition") {
                      return (
                        <View key="patientCondition" style={{ marginBottom: 8 }}>
                          <Text style={styles.modalLabel}>{field.label}</Text>
                          <TextInput
                            style={styles.inputSingleLine}
                            placeholder="اكتب حالة المريض"
                            placeholderTextColor={colors.placeholder}
                            value={formPatientCondition}
                            onChangeText={setFormPatientCondition}
                          />
                        </View>
                      );
                    }
                    if (field.key === "upcomingVisitsCount") {
                      return (
                        <View key="upcomingVisitsCount" style={{ marginBottom: 8 }}>
                          <Text style={styles.modalLabel}>{field.label}</Text>
                          <TextInput
                            style={styles.inputSingleLine}
                            placeholder="0"
                            placeholderTextColor={colors.placeholder}
                            keyboardType="number-pad"
                            value={formUpcomingVisitsCount}
                            onChangeText={(text) => {
                              const digitsOnly = String(text || "").replace(/[^0-9]/g, "");
                              setFormUpcomingVisitsCount(digitsOnly);
                            }}
                          />
                        </View>
                      );
                    }
                    if (field.key === "totalSpentAmount") {
                      return (
                        <View key="totalSpentAmount" style={{ marginBottom: 8 }}>
                          <Text style={styles.modalLabel}>{field.label} (محسوب تلقائياً)</Text>
                          <View style={styles.autoValueBox}>
                            <Text style={styles.autoValueText}>{formatIqd(formTotalSpentAmount || activePatient?.totalSpentAmount)}</Text>
                          </View>
                        </View>
                      );
                    }
                    if (field.key === "doctorNote") {
                      return (
                        <View key="doctorNote" style={{ marginBottom: 8 }}>
                          <Text style={styles.modalLabel}>{field.label}</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="اكتب الملاحظات الطبية"
                            placeholderTextColor={colors.placeholder}
                            multiline
                            value={formNote}
                            onChangeText={setFormNote}
                          />
                        </View>
                      );
                    }
                    if (field.key === "prescriptions") {
                      return (
                        <View key="prescriptions" style={{ marginBottom: 8 }}>
                          {renderAttachments(
                            formPrescriptions,
                            field.label,
                            true,
                            setFormPrescriptions
                          ) || <Text style={styles.noteHint}>لا توجد وصفات مضافة</Text>}
                          <TouchableOpacity
                            style={styles.outlineBtn}
                            onPress={() => handleUploadImage("prescription")}
                            disabled={uploadingFile}
                          >
                            <Feather name="image" size={16} color={colors.primary} />
                            <Text style={styles.outlineText}>
                              {uploadingFile ? "جارٍ الرفع" : "إضافة وصفة"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    }
                    if (field.key === "reports") {
                      return (
                        <View key="reports" style={{ marginBottom: 8 }}>
                          {renderAttachments(
                            formReports,
                            field.label,
                            true,
                            setFormReports
                          ) || <Text style={styles.noteHint}>لا توجد تقارير مضافة</Text>}
                          <TouchableOpacity
                            style={styles.outlineBtn}
                            onPress={() => handleUploadImage("report")}
                            disabled={uploadingFile}
                          >
                            <Feather name="file" size={16} color={colors.primary} />
                            <Text style={styles.outlineText}>
                              {uploadingFile ? "جارٍ الرفع" : "إضافة تقرير"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    }
                    // ── Custom fields ──
                    if (!field.isBuiltIn) {
                      return renderDynamicFormField(field);
                    }
                    return null;
                  })}
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, savingArchive && { opacity: 0.7 }]}
                    onPress={saveArchive}
                    disabled={savingArchive}
                  >
                    <Text style={styles.primaryText}>
                      {savingArchive ? "جارٍ الحفظ" : "حفظ الأرشيف"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModals}>
                    <Text style={styles.cancelText}>إلغاء</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Template Settings Modal (combined: list + add/edit field) ── */}
      <Modal
        visible={showTemplateModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (templateView === "field") { setTemplateView("list"); return; }
          closeTemplateModal();
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}} accessible={false}>
              <View style={styles.modalCard}>

                {/* ── LIST VIEW ── */}
                {templateView === "list" ? (
                  <>
                    <View style={styles.infoBox}>
                      <Text style={styles.modalTitle}>تخصيص الأرشيف</Text>
                      <Text style={styles.modalSubtitle}>أضف حقول مخصصة، أعد الترتيب، أو عطّل حقول</Text>
                    </View>

                    <ScrollView style={{ marginTop: 12, maxHeight: 400 }} contentContainerStyle={{ paddingBottom: 16 }}>
                      {templateDraft.map((field, idx) => (
                        <View key={`tmpl-${field.key}-${idx}`} style={styles.templateFieldRow}>
                          <View style={styles.templateFieldInfo}>
                            <View style={styles.templateFieldHeader}>
                              <Text style={[styles.templateFieldLabel, !field.enabled && { opacity: 0.4 }]}>
                                {field.label}
                              </Text>
                              <Text style={styles.templateFieldType}>
                                {FIELD_TYPE_LABELS[field.fieldType] || field.fieldType}
                                {field.isBuiltIn ? " (أساسي)" : ""}
                              </Text>
                            </View>
                            {field.fieldType === "select" && field.options?.length ? (
                              <Text style={styles.templateFieldOptions} numberOfLines={1}>
                                الخيارات: {field.options.join("، ")}
                              </Text>
                            ) : null}
                          </View>

                          <View style={styles.templateFieldActions}>
                            <TouchableOpacity onPress={() => moveFieldUp(idx)} disabled={idx === 0}>
                              <Feather name="chevron-up" size={18} color={idx === 0 ? colors.border : colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => moveFieldDown(idx)} disabled={idx === templateDraft.length - 1}>
                              <Feather name="chevron-down" size={18} color={idx === templateDraft.length - 1 ? colors.border : colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => toggleFieldEnabled(idx)}>
                              <Feather name={field.enabled ? "eye" : "eye-off"} size={18} color={field.enabled ? colors.success || colors.primary : colors.textMuted} />
                            </TouchableOpacity>
                            {!field.isBuiltIn ? (
                              <>
                                <TouchableOpacity onPress={() => openEditFieldForm(idx)}>
                                  <Feather name="edit-2" size={16} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => removeCustomField(idx)}>
                                  <Feather name="trash-2" size={16} color={colors.danger} />
                                </TouchableOpacity>
                              </>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </ScrollView>

                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.outlineBtn} onPress={openAddFieldForm}>
                        <Feather name="plus" size={16} color={colors.primary} />
                        <Text style={styles.outlineText}>إضافة حقل جديد</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.primaryBtn, savingTemplate && { opacity: 0.7 }]}
                        onPress={handleSaveTemplate}
                        disabled={savingTemplate}
                      >
                        <Text style={styles.primaryText}>{savingTemplate ? "جارٍ الحفظ..." : "حفظ القالب"}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.cancelBtn} onPress={closeTemplateModal}>
                        <Text style={styles.cancelText}>إغلاق</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  /* ── FIELD EDIT VIEW ── */
                  <>
                    <View style={styles.infoBox}>
                      <Text style={styles.modalTitle}>
                        {editingFieldIdx !== null ? "تعديل الحقل" : "إضافة حقل جديد"}
                      </Text>
                    </View>

                    <ScrollView style={{ marginTop: 12, maxHeight: 400 }} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
                      <Text style={styles.modalLabel}>اسم الحقل *</Text>
                      <TextInput
                        style={styles.inputSingleLine}
                        placeholder="مثال: فصيلة الدم"
                        placeholderTextColor={colors.placeholder}
                        value={fieldDraft.label}
                        onChangeText={(text) => setFieldDraft((prev) => ({ ...prev, label: text }))}
                      />

                      <Text style={styles.modalLabel}>نوع الحقل</Text>
                      <View style={styles.selectRow}>
                        {Object.entries(FIELD_TYPE_LABELS).map(([type, label]) => (
                          <TouchableOpacity
                            key={type}
                            style={[styles.selectOption, fieldDraft.fieldType === type && styles.selectOptionActive]}
                            onPress={() => setFieldDraft((prev) => ({ ...prev, fieldType: type }))}
                          >
                            <Text style={[styles.selectOptionText, fieldDraft.fieldType === type && styles.selectOptionTextActive]}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {fieldDraft.fieldType === "select" ? (
                        <View style={{ marginTop: 8 }}>
                          <Text style={styles.modalLabel}>الخيارات</Text>
                          {fieldDraft.options.map((opt, oi) => (
                            <View key={`opt-${oi}`} style={styles.optionRow}>
                              <Text style={styles.optionText}>{opt}</Text>
                              <TouchableOpacity
                                onPress={() => setFieldDraft((prev) => ({
                                  ...prev,
                                  options: prev.options.filter((_, i) => i !== oi),
                                }))}
                              >
                                <Feather name="x" size={16} color={colors.danger} />
                              </TouchableOpacity>
                            </View>
                          ))}
                          <View style={styles.addOptionRow}>
                            <TextInput
                              style={[styles.inputSingleLine, { flex: 1 }]}
                              placeholder="خيار جديد"
                              placeholderTextColor={colors.placeholder}
                              value={newOptionText}
                              onChangeText={setNewOptionText}
                            />
                            <TouchableOpacity
                              style={[styles.primaryBtn, { paddingHorizontal: 12 }]}
                              onPress={() => {
                                const t = newOptionText.trim();
                                if (!t) return;
                                setFieldDraft((prev) => ({ ...prev, options: [...prev.options, t] }));
                                setNewOptionText("");
                              }}
                            >
                              <Feather name="plus" size={16} color={colors.surface} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}

                      <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setFieldDraft((prev) => ({ ...prev, required: !prev.required }))}
                      >
                        <View style={[styles.checkboxBox, fieldDraft.required && styles.checkboxBoxActive]}>
                          {fieldDraft.required ? <Feather name="check" size={14} color={colors.surface} /> : null}
                        </View>
                        <Text style={styles.checkboxLabel}>حقل مطلوب</Text>
                      </TouchableOpacity>
                    </ScrollView>

                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.primaryBtn} onPress={saveFieldDraft}>
                        <Text style={styles.primaryText}>
                          {editingFieldIdx !== null ? "تحديث" : "إضافة"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setTemplateView("list")}>
                        <Text style={styles.cancelText}>رجوع</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={!!previewUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUri("")}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewBackdrop}
            activeOpacity={1}
            onPress={() => setPreviewUri("")}
          >
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
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
      paddingTop: 8,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    headerTitleWrap: { gap: 4 },
    headerTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
    headerSubtitle: { fontSize: 12, color: colors.textMuted, writingDirection: "rtl" },
    iconAction: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
    },

    summaryCard: {
      flexDirection: "row",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 12,
      overflow: "hidden",
    },
    summaryItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      gap: 4,
    },
    summaryValue: { fontSize: 20, fontWeight: "800", color: colors.text },
    summaryLabel: { fontSize: 12, color: colors.textMuted, writingDirection: "rtl" },
    summaryDivider: { width: 1, backgroundColor: colors.border },

    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      marginBottom: 12,
    },
    searchInput: { flex: 1, color: colors.text, paddingVertical: 7, textAlign: "right", writingDirection: "rtl" },

    loader: { flex: 1, alignItems: "center", justifyContent: "center" },
    empty: {
      textAlign: "center",
      color: colors.textMuted,
      marginTop: 20,
      writingDirection: "rtl",
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 2,
    },
    patientIdentity: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: colors.surface, fontWeight: "800", fontSize: 14 },
    nameBlock: { flex: 1 },
    patientName: { fontSize: 16, fontWeight: "800", color: colors.text, textAlign: "right", writingDirection: "rtl" },
    visitMeta: { fontSize: 12, color: colors.textMuted, textAlign: "right", writingDirection: "rtl", marginTop: 2 },
    countBadge: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      minWidth: 66,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginLeft: 8,
    },
    countBadgeValue: { fontSize: 16, fontWeight: "800", color: colors.text },
    countBadgeLabel: { fontSize: 11, color: colors.textMuted, writingDirection: "rtl" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "flex-end" },
    patientMeta: { fontSize: 12, color: colors.textMuted, writingDirection: "rtl" },
    lastNote: {
      marginTop: 4,
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      writingDirection: "rtl",
      textAlign: "right",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },

    actionsRow: {
      marginTop: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "space-between",
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    primaryBtnFull: { width: "100%" },
    primaryText: { color: colors.surface, fontWeight: "700" },
    outlineBtn: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      backgroundColor: colors.surface,
    },
    outlineBtnCompact: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      backgroundColor: colors.surface,
      flex: 1,
      minWidth: "48%",
    },
    outlineText: { color: colors.primary, fontWeight: "700" },

    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      padding: 14,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      maxHeight: "90%",
      shadowColor: colors.overlay,
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    infoBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      backgroundColor: colors.surfaceAlt,
      gap: 6,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    modalSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
      marginBottom: 6,
    },
    modalLabel: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },

    formBody: { marginTop: 10, maxHeight: 350 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 10,
      minHeight: 90,
      textAlignVertical: "top",
      color: colors.text,
      backgroundColor: colors.surface,
      writingDirection: "rtl",
      textAlign: "right",
    },
    inputSingleLine: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 10,
      minHeight: 44,
      color: colors.text,
      backgroundColor: colors.surface,
      writingDirection: "rtl",
      textAlign: "right",
      marginTop: 6,
      marginBottom: 8,
    },
    autoValueBox: {
      marginTop: 6,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 10,
      backgroundColor: colors.surfaceAlt,
      alignItems: "flex-end",
    },
    autoValueText: {
      color: colors.text,
      fontWeight: "700",
      writingDirection: "rtl",
      textAlign: "right",
    },
    noteHint: {
      marginTop: 6,
      color: colors.textMuted,
      fontSize: 12,
      textAlign: "right",
      writingDirection: "rtl",
    },

    archiveList: { marginTop: 12 },
    archiveEntry: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      backgroundColor: colors.surfaceAlt,
      marginTop: 12,
    },
    entryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    entryTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    entryDate: { fontSize: 12, color: colors.textMuted },
    entryActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 10,
      justifyContent: "flex-end",
    },
    entryActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: colors.surface,
    },
    entryActionText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
    entryDeleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 10,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: colors.surface,
    },
    entryDeleteText: { color: colors.danger, fontSize: 12, fontWeight: "700" },
    entrySection: { marginTop: 10 },
    entryText: {
      marginTop: 6,
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
      textAlign: "right",
      writingDirection: "rtl",
    },

    attachmentsRow: { marginTop: 8, paddingBottom: 4 },
    attachmentItem: {
      width: 94,
      height: 94,
      borderRadius: 12,
      overflow: "hidden",
      marginRight: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    attachmentImage: { width: "100%", height: "100%" },
    pdfPlaceholder: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      backgroundColor: colors.surfaceAlt,
    },
    pdfPlaceholderText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
    removeBadge: {
      position: "absolute",
      top: -8,
      right: -8,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.danger,
    },

    modalActions: {
      marginTop: 12,
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    cancelBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.surfaceAlt,
    },
    cancelText: { color: colors.text, fontWeight: "700" },

    previewOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    previewBackdrop: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    previewImage: {
      width: "100%",
      height: "100%",
      maxHeight: "90%",
    },

    // ── Template management styles ──
    templateFieldRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      marginBottom: 8,
    },
    templateFieldInfo: {
      flex: 1,
      gap: 2,
    },
    templateFieldHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      justifyContent: "flex-end",
    },
    templateFieldLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    templateFieldType: {
      fontSize: 11,
      color: colors.textMuted,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: "hidden",
    },
    templateFieldOptions: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    templateFieldActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    // ── Select / dropdown styles ──
    selectRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 6,
      marginBottom: 8,
    },
    selectOption: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    selectOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    selectOptionText: {
      fontSize: 13,
      color: colors.text,
      writingDirection: "rtl",
    },
    selectOptionTextActive: {
      color: colors.surface,
      fontWeight: "700",
    },

    // ── Checkbox styles ──
    checkboxRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      justifyContent: "flex-end",
    },
    checkboxBox: {
      width: 22,
      height: 22,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    checkboxBoxActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    checkboxLabel: {
      fontSize: 14,
      color: colors.text,
      writingDirection: "rtl",
    },

    // ── Option row (for select field editor) ──
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      marginBottom: 4,
    },
    optionText: {
      fontSize: 13,
      color: colors.text,
      writingDirection: "rtl",
      flex: 1,
      textAlign: "right",
    },
    addOptionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
  });
