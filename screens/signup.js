// app/signup.js
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowRight,
  User,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Hash,
  Check,
  AlertTriangle,
} from "lucide-react-native";
import {
  API_BASE_URL,
  saveRoleSelection,
  getRoleSelection,
  logout,
} from "../lib/api";
import { specialtyOptions } from "../lib/constants/specialties";
import authColors from "../lib/authTheme";

const PRIVACY_URL = "https://medicare-iq.com/privacy";
const TERMS_URL = "https://medicare-iq.com/terms";

export default function SignupScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const styles = useMemo(() => createStyles(), []);

  const params = route.params || {};
  const [role, setRole] = useState(params.role || "patient");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [doctorSpecialty, setDoctorSpecialty] = useState(
    specialtyOptions[0]?.value || ""
  );
  const [licenseNumber, setLicenseNumber] = useState("");
  const [avatarUri, setAvatarUri] = useState("");
  const [avatarMimeType, setAvatarMimeType] = useState("image/jpeg");
  const [practiceLocation, setPracticeLocation] = useState("");
  const [practiceLocationLat, setPracticeLocationLat] = useState(null);
  const [practiceLocationLng, setPracticeLocationLng] = useState(null);
  const [certification, setCertification] = useState("");
  const [cv, setCv] = useState("");
  const [consultationFee, setConsultationFee] = useState("");
  const [hasFixedConsultation, setHasFixedConsultation] = useState(false);
  const [secretaryPhone, setSecretaryPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);

  const buildSignupFormState = () => ({
    role,
    name,
    age,
    phone,
    password,
    confirm,
    doctorSpecialty,
    licenseNumber,
    avatarUri,
    avatarMimeType,
    practiceLocation,
    practiceLocationLat,
    practiceLocationLng,
    certification,
    cv,
    consultationFee,
    hasFixedConsultation,
    secretaryPhone,
  });

  const normalizeIraqPhoneTo10Digits = (value) => {
    let digits = String(value || "").replace(/\D/g, "");
    // If pasted as +964XXXXXXXXXX
    if (digits.startsWith("964") && digits.length === 13) {
      digits = digits.slice(3);
    }
    // If pasted as 07XXXXXXXXX
    if (digits.startsWith("0") && digits.length === 11) {
      digits = digits.slice(1);
    }
    return digits.slice(0, 10);
  };

  const imageUriToDataUrl = async (uri, mimeType = "image/jpeg") => {
    const response = await fetch(uri);
    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || "");
        if (result.startsWith("data:")) {
          resolve(result);
          return;
        }
        resolve(`data:${mimeType};base64,${result}`);
      };
      reader.onerror = () => reject(new Error("Failed to read image data"));
      reader.readAsDataURL(blob);
    });
  };

  useEffect(() => {
    let mounted = true;
    const initRole = async () => {
      const paramRole = route.params?.role;
      if (paramRole) {
        await saveRoleSelection(paramRole);
        if (mounted) setRole(paramRole);
        return;
      }
      const stored = await getRoleSelection();
      if (stored && mounted) {
        setRole(stored);
      }
    };

    initRole();
    return () => {
      mounted = false;
    };
  }, [route.params?.role]);

  useEffect(() => {
    const picked = route.params?.pickedLocation;
    if (!picked) return;
    const lat = Number(picked.latitude);
    const lng = Number(picked.longitude);
    const address = String(picked.address || "").trim();
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setPracticeLocationLat(lat);
      setPracticeLocationLng(lng);
    }
    if (address) {
      setPracticeLocation(address);
    } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setPracticeLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }

    // clear param
    navigation.setParams?.({ pickedLocation: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.pickedLocation]);

  useEffect(() => {
    const formState = route.params?.formState;
    if (!formState || typeof formState !== "object") return;

    if (typeof formState.role === "string") setRole(formState.role);
    if (typeof formState.name === "string") setName(formState.name);
    if (typeof formState.age === "string") setAge(formState.age);
    if (typeof formState.phone === "string") setPhone(formState.phone);
    if (typeof formState.password === "string") setPassword(formState.password);
    if (typeof formState.confirm === "string") setConfirm(formState.confirm);
    if (typeof formState.doctorSpecialty === "string") setDoctorSpecialty(formState.doctorSpecialty);
    if (typeof formState.licenseNumber === "string") setLicenseNumber(formState.licenseNumber);
    if (typeof formState.avatarUri === "string") setAvatarUri(formState.avatarUri);
    if (typeof formState.avatarMimeType === "string") setAvatarMimeType(formState.avatarMimeType);
    if (typeof formState.practiceLocation === "string") setPracticeLocation(formState.practiceLocation);
    if (Number.isFinite(Number(formState.practiceLocationLat))) {
      setPracticeLocationLat(Number(formState.practiceLocationLat));
    }
    if (Number.isFinite(Number(formState.practiceLocationLng))) {
      setPracticeLocationLng(Number(formState.practiceLocationLng));
    }
    if (typeof formState.certification === "string") setCertification(formState.certification);
    if (typeof formState.cv === "string") setCv(formState.cv);
    if (typeof formState.consultationFee === "string") setConsultationFee(formState.consultationFee);
    if (typeof formState.hasFixedConsultation === "boolean") {
      setHasFixedConsultation(formState.hasFixedConsultation);
    }
    if (typeof formState.secretaryPhone === "string") setSecretaryPhone(formState.secretaryPhone);

    navigation.setParams?.({ formState: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.formState]);

  const handleSignup = async () => {

    if (!termsAgreed) {
      Alert.alert("التحقق مطلوب", "يجب الموافقة على سياسة الخصوصية وشروط الخدمة للمتابعة.");
      return;
    }

    if (!name || !phone || !password || !confirm || !age) {
      Alert.alert("خطأ", "الرجاء تعبئة جميع الحقول");
      return;
    }

    // تحقق من رقم الهاتف: 10 أرقام ويبدأ بـ7 (السيرفر سيخزنه كـ +964 تلقائياً)
    const phoneDigits = normalizeIraqPhoneTo10Digits(phone);
    if (phoneDigits.length !== 10 || !phoneDigits.startsWith("7")) {
      Alert.alert("خطأ", "رقم الهاتف يجب أن يكون 10 أرقام ويبدأ بـ7");
      return;
    }

    const ageNumber = Number(age);
    if (!Number.isFinite(ageNumber) || ageNumber < 1 || ageNumber > 120) {
      Alert.alert("خطأ", "يرجى إدخال عمر صحيح بين 1 و 120");
      return;
    }

    if (password !== confirm) {
      Alert.alert("خطأ", "كلمات المرور غير متطابقة");
      return;
    }

    if (role === "doctor" && (!doctorSpecialty || !licenseNumber)) {
      Alert.alert("خطأ", "يرجى اختيار التخصص وكتابة رقم الترخيص" );
      return;
    }

    if (
      role === "doctor" &&
      (!avatarUri || !practiceLocation || !certification || !cv)
    ) {
      Alert.alert(
        "خطأ",
        "يرجى إكمال الملف المهني (الصورة، الموقع، الشهادة والسيرة الذاتية)"
      );
      return;
    }

    if (role === "doctor") {
      if (!Number.isFinite(Number(practiceLocationLat)) || !Number.isFinite(Number(practiceLocationLng))) {
        Alert.alert("خطأ", "يرجى تحديد موقع العيادة من الخريطة");
        return;
      }
    }

    if (role === "doctor") {
      if (hasFixedConsultation) {
        const feeValue = Number(consultationFee);
        if (!consultationFee.trim() || Number.isNaN(feeValue) || feeValue <= 0) {
          Alert.alert("خطأ", "يرجى تحديد رسوم الاستشارة بشكل صحيح.");
          return;
        }
      }

      const secretaryDigits = normalizeIraqPhoneTo10Digits(secretaryPhone);
      if (!secretaryDigits) {
        Alert.alert("خطأ", "أدخل رقم الموظف للتواصل مع المرضى.");
        return;
      }

      if (secretaryDigits.length !== 10 || !secretaryDigits.startsWith("7")) {
        Alert.alert("خطأ", "رقم الموظف يجب أن يكون 10 أرقام ويبدأ بـ7");
        return;
      }
    }

    try {
      setLoading(true);

      let avatarDataUrl;
      if (role === "doctor" && avatarUri) {
        avatarDataUrl = await imageUriToDataUrl(avatarUri, avatarMimeType || "image/jpeg");
      }

      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          age: ageNumber,
          phone: phoneDigits,
          password,
          role,
          doctorSpecialty:
            role === "doctor"
              ? specialtyOptions.find((opt) => opt.value === doctorSpecialty)?.label || doctorSpecialty
              : undefined,
          doctorSpecialtySlug: role === "doctor" ? doctorSpecialty : undefined,
          licenseNumber: role === "doctor" ? licenseNumber : undefined,
          avatarUrl:
            role === "doctor" && avatarDataUrl
              ? avatarDataUrl
              : undefined,
          location: role === "doctor" ? practiceLocation : undefined,
          locationLat: role === "doctor" ? practiceLocationLat : undefined,
          locationLng: role === "doctor" ? practiceLocationLng : undefined,
          certification: role === "doctor" ? certification : undefined,
          cv: role === "doctor" ? cv : undefined,
          consultationFee:
            role === "doctor" && hasFixedConsultation ? consultationFee : undefined,
          secretaryPhone:
            role === "doctor" ? normalizeIraqPhoneTo10Digits(secretaryPhone) : undefined,
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        console.warn("Signup parse error", parseErr);
        data = { message: text };
      }

      if (!res.ok) {
        Alert.alert("فشل التسجيل", data.message || "تعذر إنشاء الحساب");
        return;
      }

      // Success
      if (role === "doctor") {
        Alert.alert("تم إنشاء الحساب", "حسابك قيد المراجعة. سيتم تفعيل حسابك بعد موافقة الإدارة. يرجى التواصل مع الدعم لسرعة تفعيل الحساب.", [
          { text: "حسناً", onPress: () => navigation.replace("Login", { role: "doctor" }) },
        ]);
        return;
      }

      // Patients: OTP disabled; backend returns token -> login immediately
      if (data && data.token) {
        const api = await import("../lib/api");
        await api.saveToken(data.token);
        if (data.refreshToken) {
          await api.saveRefreshToken(data.refreshToken);
        }
        await api.saveUserRole("patient");

        // 🔔 Request push permission + register token BEFORE navigation
        try {
          console.log("[Signup] Starting push registration...");
          const push = await import("../lib/pushNotifications");
          const result = await push.registerForPushNotificationsAsync();
          const expoPushToken = result?.expoPushToken;
          console.log("[Signup] Push token result:", expoPushToken ? "GOT TOKEN" : "NO TOKEN");
          if (expoPushToken) {
            await api.registerExpoPushToken(expoPushToken);
            console.log("[Signup] ✅ Push token registered with backend");
          }
        } catch (pushErr) {
          console.log("[Signup] Push registration error:", pushErr?.message || pushErr);
        }

        navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
        return;
      }

      // Fallback
      Alert.alert("تم إنشاء الحساب", "تم إنشاء حسابك بنجاح. يمكنك تسجيل الدخول الآن.", [
        { text: "حسناً", onPress: () => navigation.replace("Login", { role: "patient" }) },
      ]);
      return;
    } catch (err) {
      console.log("Signup error:", err);
      Alert.alert("خطأ", "حدث خطأ، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("أذونات", "يحتاج التطبيق إذن الوصول للصور لاختيار صورتك.");
        return;
      }

      const picker = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (picker.canceled || picker.cancelled) return;

      const asset = picker.assets?.[0];

      if (!asset?.uri) {
        Alert.alert(
          "خطأ",
          "تعذّر قراءة الصورة المختارة، جرّب صورة أخرى أو أعد تشغيل التطبيق."
        );
        return;
      }

      setAvatarUri(asset.uri);
      setAvatarMimeType(asset.mimeType || "image/jpeg");
    } catch (err) {
      console.log("Avatar pick error:", err);
      Alert.alert("خطأ", "تعذر اختيار الصورة، حاول مرة أخرى");
    }
  };


  const handleRoleSwitch = async () => {
    await logout();
    navigation.replace("RoleSelection");
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace("Login", { role });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
          >
            <ArrowRight size={24} color={authColors.heading} strokeWidth={2.2} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>إنشاء حساب جديد</Text>
            <Text style={styles.subtitle}>
              {role === "doctor" ? "سجّل كطبيب واحصل على أدوات الإدارة" : "ابدأ رحلتك الصحية معنا"}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>

            {/* ── تنبيه خاص بالمريض ── */}
            {role === "patient" && (
              <View style={styles.warningBox}>
                <AlertTriangle size={20} color="#C2410C" strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>تنبيه مهم</Text>
                  <Text style={styles.warningText}>
                    يجب أن تكون المعلومات المُدخلة (الاسم، العمر، رقم الهاتف) معلومات المريض شخصياً حصراً.{" "}
                    لا يُسمح بإنشاء حساب بمعلومات شخص آخر.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>الاسم الكامل</Text>
              <View style={styles.inputWrap}>
                <User size={20} color={authColors.muted} strokeWidth={2} />
                <TextInput
                  placeholder="أدخل اسمك"
                  placeholderTextColor={authColors.muted}
                  style={styles.input}
                  textContentType="name"
                  value={name}
                  onChangeText={setName}
                  multiline={false}
                  scrollEnabled={false}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>العمر</Text>
              <View style={styles.inputWrap}>
                <Hash size={20} color={authColors.muted} strokeWidth={2} />
                <TextInput
                  placeholder="مثلاً 30"
                  placeholderTextColor={authColors.muted}
                  style={styles.input}
                  keyboardType="numeric"
                  value={age}
                  onChangeText={setAge}
                  multiline={false}
                  scrollEnabled={false}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>رقم الهاتف</Text>
              <View style={styles.inputWrap}>
                <Phone size={20} color={authColors.muted} strokeWidth={2} />
                <TextInput
                  placeholder="أدخل 10 أرقام تبدأ بـ7"
                  placeholderTextColor={authColors.muted}
                  style={styles.input}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  textContentType="telephoneNumber"
                  value={phone}
                  maxLength={10}
                  onChangeText={(t) => setPhone(normalizeIraqPhoneTo10Digits(t))}
                  multiline={false}
                  scrollEnabled={false}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>كلمة المرور</Text>
              <View style={styles.inputWrap}>
                <Lock size={20} color={authColors.muted} strokeWidth={2} />
                <TextInput
                  placeholder="أدخل كلمة المرور"
                  placeholderTextColor={authColors.muted}
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  value={password}
                  onChangeText={setPassword}
                  multiline={false}
                  scrollEnabled={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={authColors.muted} strokeWidth={2} />
                  ) : (
                    <Eye size={20} color={authColors.muted} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>تأكيد كلمة المرور</Text>
              <View style={styles.inputWrap}>
                <Lock size={20} color={authColors.muted} strokeWidth={2} />
                <TextInput
                  placeholder="أكد كلمة المرور"
                  placeholderTextColor={authColors.muted}
                  style={styles.input}
                  secureTextEntry={!showConfirm}
                  textContentType="newPassword"
                  value={confirm}
                  onChangeText={setConfirm}
                  multiline={false}
                  scrollEnabled={false}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirm((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirm ? "إخفاء تأكيد كلمة المرور" : "إظهار تأكيد كلمة المرور"}
                >
                  {showConfirm ? (
                    <EyeOff size={20} color={authColors.muted} strokeWidth={2} />
                  ) : (
                    <Eye size={20} color={authColors.muted} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {role === "doctor" && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>التخصص الطبي</Text>
                  <View style={styles.specialtyOptionsRow}>
                    {specialtyOptions.map((option) => {
                      const selected = option.value === doctorSpecialty;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.chip,
                            selected && styles.chipSelected,
                          ]}
                          onPress={() => setDoctorSpecialty(option.value)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              selected && styles.chipTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>رقم الترخيص</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      placeholder="أدخل رقم الترخيص أو الهوية المهنية"
                      placeholderTextColor={authColors.muted}
                      style={styles.input}
                      value={licenseNumber}
                      onChangeText={setLicenseNumber}
                      multiline={false}
                      scrollEnabled={false}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>نمط التسعير</Text>
                  <View style={styles.consultationModeRow}>
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        hasFixedConsultation && styles.chipSelected,
                      ]}
                      onPress={() => setHasFixedConsultation(true)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          hasFixedConsultation && styles.chipTextSelected,
                        ]}
                      >
                        عندي استشارة ثابتة
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.chip,
                        !hasFixedConsultation && styles.chipSelected,
                      ]}
                      onPress={() => setHasFixedConsultation(false)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          !hasFixedConsultation && styles.chipTextSelected,
                        ]}
                      >
                        أحدد الأسعار من الخدمات
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {hasFixedConsultation ? (
                    <View style={[styles.inputWrap, { marginTop: 10 }]}>
                      <TextInput
                        placeholder="رسوم الاستشارة (دينار)"
                        placeholderTextColor={authColors.muted}
                        style={styles.input}
                        keyboardType="numeric"
                        value={consultationFee}
                        onChangeText={setConsultationFee}
                        multiline={false}
                        scrollEnabled={false}
                      />
                    </View>
                  ) : (
                    <Text style={styles.helperText}>
                      تقدر تضيف كل الخدمات والأسعار لاحقاً من صفحة الخدمات بعد تسجيل الدخول.
                    </Text>
                  )}

                  <Text style={styles.helperText}>
                    إذا فعّلت الاستشارة الثابتة سيتم اعتمادها مباشرة كرسوم عامة للحجز.
                  </Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>رقم الموظف للتواصل</Text>
                  <View style={styles.inputWrap}>
                    <Phone size={20} color={authColors.muted} strokeWidth={2} />
                    <TextInput
                      placeholder="أدخل 10 أرقام تبدأ بـ7"
                      placeholderTextColor={authColors.muted}
                      style={styles.input}
                      keyboardType="phone-pad"
                      value={secretaryPhone}
                      maxLength={10}
                      onChangeText={(t) => setSecretaryPhone(normalizeIraqPhoneTo10Digits(t))}
                      multiline={false}
                      scrollEnabled={false}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>الصورة الشخصية</Text>
                  <View style={styles.avatarRow}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarPlaceholderText}>لم يتم اختيار صورة</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.avatarButton} onPress={handlePickAvatar}>
                      <Text style={styles.avatarButtonText}>اختر صورة</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>موقع الممارسة أو المستشفى</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      placeholder="مثلاً: بغداد، عيادة الرعاية"
                      placeholderTextColor={authColors.muted}
                      style={styles.input}
                      value={practiceLocation}
                      onChangeText={setPracticeLocation}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.mapPickerButton}
                    onPress={() =>
                      navigation.navigate("LocationPicker", {
                        returnTo: "Signup",
                        formState: buildSignupFormState(),
                        title: "اختيار موقع العيادة",
                        initialLatitude: practiceLocationLat,
                        initialLongitude: practiceLocationLng,
                        initialAddress: practiceLocation,
                      })
                    }
                  >
                    <Text style={styles.mapPickerButtonText}>اختيار الموقع من الخريطة</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>الشهادة المهنية</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      placeholder="اكتب اسم الشهادة أو الصادرة من أي جهة"
                      placeholderTextColor={authColors.muted}
                      style={styles.input}
                      value={certification}
                      onChangeText={setCertification}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>السيرة الذاتية المختصرة</Text>
                  <View style={[styles.inputWrap, styles.multilineWrap]}>
                    <TextInput
                      placeholder="اكتب خبراتك وأبرز التخصصات"
                      placeholderTextColor={authColors.muted}
                      style={[styles.input, styles.multilineInput]}
                      value={cv}
                      onChangeText={setCv}
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                </View>
              </>
            )}

            {/* ── سياسة الخصوصية وشروط الخدمة ── */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setTermsAgreed((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.termsCheckbox, termsAgreed && styles.termsCheckboxChecked]}>
                {termsAgreed && <Check size={14} color={authColors.onPrimary} strokeWidth={3} />}
              </View>
              <Text style={styles.termsText}>
                أوافق على{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => Linking.openURL(PRIVACY_URL)}
                >
                  سياسة الخصوصية
                </Text>
                {" "}و{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => Linking.openURL(TERMS_URL)}
                >
                  شروط الخدمة
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, (!termsAgreed || loading) && styles.primaryButtonDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? "جارٍ الإنشاء..." : "إنشاء حساب"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.loginRow}>
              <Text style={styles.loginHint}>لديك حساب بالفعل؟ </Text>
              <TouchableOpacity onPress={() => navigation.replace("Login", { role })}>
                <Text style={styles.loginLink}>تسجيل الدخول</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.switchRow} onPress={handleRoleSwitch}>
              <Text style={styles.switchText}>تغيير نوع الحساب أو تسجيل خروج</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = () =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: authColors.background,
    },
    root: {
      flex: 1,
      backgroundColor: authColors.background,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 32,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: authColors.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: authColors.inputBorder,
    },
    header: {
      marginTop: 20,
      marginBottom: 24,
      alignItems: "center",
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: authColors.heading,
      textAlign: "center",
      writingDirection: "rtl",
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: authColors.muted,
      textAlign: "center",
      writingDirection: "rtl",
    },
    form: {
      marginTop: 4,
    },
    field: {
      marginBottom: 18,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: authColors.body,
      marginBottom: 8,
      textAlign: "right",
      writingDirection: "rtl",
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: authColors.inputBg,
      borderWidth: 1,
      borderColor: authColors.inputBorder,
      borderRadius: 16,
      paddingHorizontal: 16,
      minHeight: 56,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: authColors.heading,
      textAlign: "right",
      writingDirection: "rtl",
      paddingVertical: 0,
    },
    helperText: {
      color: authColors.muted,
      fontSize: 13,
      marginTop: 8,
      textAlign: "right",
      writingDirection: "rtl",
      lineHeight: 20,
    },
    primaryButton: {
      backgroundColor: authColors.primary,
      borderRadius: 16,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
      shadowColor: authColors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 4,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      color: authColors.onPrimary,
      fontSize: 17,
      fontWeight: "700",
    },
    footer: {
      marginTop: 24,
      alignItems: "center",
    },
    loginRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    loginHint: {
      fontSize: 15,
      color: authColors.muted,
    },
    loginLink: {
      fontSize: 15,
      color: authColors.primary,
      fontWeight: "700",
    },
    switchRow: {
      marginTop: 16,
    },
    switchText: {
      fontSize: 13,
      color: authColors.muted,
      textDecorationLine: "underline",
    },
    // ── Avatar (doctor) ──
    avatarRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    avatarPreview: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    avatarPlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: authColors.inputBg,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: authColors.inputBorder,
    },
    avatarPlaceholderText: {
      fontSize: 10,
      color: authColors.muted,
      textAlign: "center",
    },
    avatarButton: {
      backgroundColor: authColors.primary,
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 14,
    },
    avatarButtonText: {
      color: authColors.onPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    mapPickerButton: {
      marginTop: 10,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: authColors.primarySoftBorder,
      backgroundColor: authColors.primarySoft,
    },
    mapPickerButtonText: {
      color: authColors.primary,
      fontSize: 14,
      fontWeight: "600",
      writingDirection: "rtl",
    },
    multilineWrap: {
      alignItems: "flex-start",
      paddingVertical: 12,
    },
    multilineInput: {
      minHeight: 90,
      textAlignVertical: "top",
    },
    specialtyOptionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: 8,
    },
    consultationModeRow: {
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      gap: 8,
    },
    chip: {
      borderWidth: 1.5,
      borderColor: authColors.inputBorder,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: authColors.card,
    },
    chipSelected: {
      borderColor: authColors.primary,
      backgroundColor: authColors.primarySoft,
    },
    chipText: {
      fontSize: 13,
      color: authColors.body,
    },
    chipTextSelected: {
      color: authColors.primary,
      fontWeight: "700",
    },
    // ── Warning banner (patient) ──
    warningBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: "#FFF7ED",
      borderWidth: 1,
      borderColor: "#FED7AA",
      borderRadius: 16,
      padding: 14,
      marginBottom: 20,
      gap: 10,
    },
    warningTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: "#9A3412",
      textAlign: "right",
      writingDirection: "rtl",
      marginBottom: 4,
    },
    warningText: {
      fontSize: 13,
      color: "#C2410C",
      textAlign: "right",
      writingDirection: "rtl",
      lineHeight: 20,
    },
    // ── Terms row ──
    termsRow: {
      flexDirection: "row-reverse",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 6,
      marginBottom: 6,
      paddingHorizontal: 2,
    },
    termsCheckbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: authColors.inputBorder,
      backgroundColor: authColors.card,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 1,
      flexShrink: 0,
    },
    termsCheckboxChecked: {
      borderColor: authColors.primary,
      backgroundColor: authColors.primary,
    },
    termsText: {
      flex: 1,
      fontSize: 13,
      color: authColors.body,
      textAlign: "right",
      writingDirection: "rtl",
      lineHeight: 22,
    },
    termsLink: {
      color: authColors.primary,
      fontWeight: "700",
    },
  });
