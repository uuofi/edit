import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { fetchDoctorDashboard, updateDoctorProfile } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const buildFormFromDoctor = (doctor) => ({
  displayName: doctor?.displayName || "",
  specialty: doctor?.specialty || "",
  specialtyLabel: doctor?.specialtyLabel || "",
  location: doctor?.location || "",
  locationLat: typeof doctor?.locationLat === "number" ? doctor.locationLat : null,
  locationLng: typeof doctor?.locationLng === "number" ? doctor.locationLng : null,
  certification: doctor?.certification || "",
  cv: doctor?.cv || "",
  consultationFee:
    typeof doctor?.consultationFee === "number" ? `${doctor.consultationFee}` : "",
  licenseNumber: doctor?.licenseNumber || "",
  avatarUrl: doctor?.avatarUrl || "",
  secretaryPhone: doctor?.secretaryPhone || "",
});

export default function ProviderProfileEditScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const routeDoctor = route.params?.doctor;
  const initialForm = useMemo(
    () => buildFormFromDoctor(routeDoctor),
    [routeDoctor]
  );
  const [formData, setFormData] = useState(initialForm);
  const [avatarPreview, setAvatarPreview] = useState(initialForm.avatarUrl);
  const [loading, setLoading] = useState(!routeDoctor);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData(initialForm);
    setAvatarPreview(initialForm.avatarUrl);
  }, [initialForm]);

  useEffect(() => {
    const picked = route.params?.pickedLocation;
    if (!picked) return;
    const lat = Number(picked.latitude);
    const lng = Number(picked.longitude);
    const address = String(picked.address || "").trim();
    setFormData((prev) => ({
      ...prev,
      location: address || prev.location,
      locationLat: Number.isFinite(lat) ? lat : prev.locationLat,
      locationLng: Number.isFinite(lng) ? lng : prev.locationLng,
    }));
    navigation.setParams?.({ pickedLocation: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.pickedLocation]);

  const loadDoctor = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDoctorDashboard();
      const freshForm = buildFormFromDoctor(data.doctor || {});
      setFormData(freshForm);
      setAvatarPreview(freshForm.avatarUrl);
    } catch (err) {
      console.error("Load doctor profile error:", err);
      Alert.alert("تعذّر تحميل البيانات", err.message || "حاول لاحقاً");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!routeDoctor) {
      loadDoctor();
    }
  }, [loadDoctor, routeDoctor]);

  const handleChooseImage = useCallback(async () => {
    try {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "إذن الوصول مطلوب",
          canAskAgain
            ? "نحتاج إذن الوصول إلى الصور لتحديث الملف الشخصي."
            : "يرجى فتح إعدادات التطبيق للسماح بالوصول إلى الصور.",
          [
            { text: "إلغاء", style: "cancel" },
            {
              text: "فتح الإعدادات",
              onPress: () => Linking.openSettings?.(),
            },
          ]
        );
        return;
      }
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (pickerResult.canceled || pickerResult.cancelled) return;
      const asset = pickerResult.assets?.[0] ?? pickerResult;
      if (!asset?.uri) return;
      const dataUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setAvatarPreview(asset.uri);
      setFormData((prev) => ({ ...prev, avatarUrl: dataUrl }));
    } catch (err) {
      console.error("Image picker error:", err);
      Alert.alert("خطأ بالصور", "تعذّر اختيار الصورة. حاول لاحقاً.");
    }
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (field === "avatarUrl") {
      setAvatarPreview(value);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    const payload = {
      displayName: formData.displayName.trim(),
      specialty: formData.specialty.trim(),
      specialtyLabel: formData.specialtyLabel.trim(),
      location: formData.location.trim(),
      locationLat: formData.locationLat,
      locationLng: formData.locationLng,
      certification: formData.certification.trim(),
      cv: formData.cv.trim(),
      licenseNumber: formData.licenseNumber.trim(),
      avatarUrl: formData.avatarUrl.trim(),
      consultationFee: Number(formData.consultationFee) || 0,
      secretaryPhone: formData.secretaryPhone.trim(),
    };

    try {
      setSaving(true);
      await updateDoctorProfile(payload);
      Alert.alert("تم الحفظ", "تم تحديث معلوماتك بنجاح.", [
        { text: "حسنًا", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error("Save profile error:", err);
      Alert.alert("فشل التحديث", err.message || "حاول لاحقاً");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="chevron-right" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>تعديل الملف</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>معلومات عامة</Text>
          <View style={styles.avatarSection}>
            <View style={styles.avatarPreviewWrapper}>
              {avatarPreview ? (
                <Image source={{ uri: avatarPreview }} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={40} color={colors.placeholder} />
              )}
            </View>
            <View style={styles.avatarActions}>
              <Text style={styles.label}>الصورة الشخصية</Text>
              <TouchableOpacity style={styles.avatarButton} onPress={handleChooseImage}>
                <Text style={styles.avatarButtonText}>اختيار صورة من الاستوديو</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.label}>اسم العرض</Text>
          <TextInput
            style={styles.input}
            placeholder="مثلاً د. ليلى محمد"
            placeholderTextColor={colors.placeholder}
            value={formData.displayName}
            onChangeText={(value) => handleChange("displayName", value)}
          />
          <View style={styles.splitRow}>
            <View style={styles.flexItem}>
              <Text style={styles.label}>التخصص</Text>
              <TextInput
                style={styles.input}
                placeholder="طب الأطفال"
                placeholderTextColor={colors.placeholder}
                value={formData.specialty}
                onChangeText={(value) => handleChange("specialty", value)}
              />
            </View>
            <View style={styles.flexItem}>
              <Text style={styles.label}>اللقب / القسم</Text>
              <TextInput
                style={styles.input}
                placeholder="أمراض القلب"
                placeholderTextColor={colors.placeholder}
                value={formData.specialtyLabel}
                onChangeText={(value) => handleChange("specialtyLabel", value)}
              />
            </View>
          </View>
          <Text style={styles.label}>الموقع / العيادة</Text>
          <TextInput
            style={styles.input}
            placeholder="مثلاً مستشفى الرفاعي، النجف"
            placeholderTextColor={colors.placeholder}
            value={formData.location}
            onChangeText={(value) => handleChange("location", value)}
          />

          <TouchableOpacity
            style={styles.mapPickerButton}
            onPress={() =>
              navigation.navigate("LocationPicker", {
                returnTo: "ProviderProfileEdit",
                title: "اختيار موقع العيادة",
                initialLatitude: formData.locationLat,
                initialLongitude: formData.locationLng,
                initialAddress: formData.location,
              })
            }
          >
            <Text style={styles.mapPickerButtonText}>اختيار الموقع من الخريطة</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>التراخيص والرسوم</Text>
          <Text style={styles.label}>رقم الرخصة</Text>
          <TextInput
            style={styles.input}
            placeholder="4521-طب"
            placeholderTextColor={colors.placeholder}
            value={formData.licenseNumber}
            onChangeText={(value) => handleChange("licenseNumber", value)}
          />
          <Text style={styles.label}>رسوم الاستشارة (رقم)</Text>
          <TextInput
            style={styles.input}
            placeholder="45000"
            keyboardType="numeric"
            placeholderTextColor={colors.placeholder}
            value={formData.consultationFee}
            onChangeText={(value) => handleChange("consultationFee", value)}
          />
          <Text style={styles.label}>رقم السكرتير للتواصل</Text>
          <TextInput
            style={styles.input}
            placeholder="05xxxxxxx"
            keyboardType="phone-pad"
            placeholderTextColor={colors.placeholder}
            value={formData.secretaryPhone}
            onChangeText={(value) => handleChange("secretaryPhone", value)}
          />

          <Text style={styles.sectionTitle}>التفاصيل المهنية</Text>
          <Text style={styles.label}>الشهادة والتخصصات</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="سيرة مختصرة عن الشهادة"
            multiline
            placeholderTextColor={colors.placeholder}
            value={formData.certification}
            onChangeText={(value) => handleChange("certification", value)}
          />
          <Text style={styles.label}>السيرة المهنية</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="أبحاث، خبرات، مجالات اهتمام"
            multiline
            placeholderTextColor={colors.placeholder}
            value={formData.cv}
            onChangeText={(value) => handleChange("cv", value)}
          />

          <View style={styles.footer}>{/* spacer */}</View>
        </ScrollView>

        <View style={styles.saveBar}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving && (
              <ActivityIndicator size="small" color={colors.surface} style={styles.spinner} />
            )}
            <Text style={styles.saveButtonText}>{saving ? "جاري الحفظ..." : "حفظ التعديلات"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      justifyContent: "center",
      alignItems: "center",
    },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
      color: colors.text,
    },
    content: {
      padding: 20,
      paddingBottom: 120,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginTop: 8,
      marginBottom: 6,
    },
    label: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surface,
      marginBottom: 12,
    },
    mapPickerButton: {
      marginTop: -4,
      marginBottom: 12,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surfaceAlt,
    },
    mapPickerButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600",
      writingDirection: "rtl",
    },
    multiline: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    splitRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
    },
    flexItem: {
      flex: 1,
      marginLeft: 8,
    },
    footer: {
      height: 20,
    },
    avatarSection: {
      flexDirection: "row-reverse",
      alignItems: "center",
      marginBottom: 16,
    },
    avatarPreviewWrapper: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
      marginLeft: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    avatarActions: {
      flex: 1,
    },
    avatarButton: {
      marginTop: 4,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "600",
    },
    saveBar: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 16,
      backgroundColor: colors.surface,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
    },
    saveButtonDisabled: {
      opacity: 0.7,
    },
    saveButtonText: {
      color: colors.surface,
      fontSize: 16,
      fontWeight: "600",
    },
    spinner: {
      marginRight: 8,
    },
  });
