// app/signup.js
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    API_BASE_URL, getRoleSelection,
    logout, registerExpoPushToken, saveRoleSelection
} from "../lib/api";
import { specialtyOptions } from "../lib/constants/specialties";
import { getExpoPushTokenOrThrow } from "../lib/pushNotifications";
import { useAppTheme } from "../lib/useTheme";

export default function SignupScreen() {
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();

  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const [avatarData, setAvatarData] = useState("");
  const [practiceLocation, setPracticeLocation] = useState("");
  const [practiceLocationLat, setPracticeLocationLat] = useState(null);
  const [practiceLocationLng, setPracticeLocationLng] = useState(null);
  const [certification, setCertification] = useState("");
  const [cv, setCv] = useState("");
  const [consultationFee, setConsultationFee] = useState("");
  const [secretaryPhone, setSecretaryPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // نستخدم هذا العلم حتى لا نعيد تحميل القيم من params أكثر من مرة
  const hasHydratedFromParams = useRef(false);

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

  // استرجاع حالة النموذج إذا رجعنا من شاشة أخرى (مثل الخريطة) وتم إعادة بناء الشاشة
  useEffect(() => {
    const formState = route.params?.formState;
    if (!formState || hasHydratedFromParams.current) return;
    hasHydratedFromParams.current = true;

    if (typeof formState.role === "string") setRole(formState.role);
    if (typeof formState.name === "string") setName(formState.name);
    if (typeof formState.age === "string") setAge(formState.age);
    if (typeof formState.phone === "string") setPhone(formState.phone);
    if (typeof formState.password === "string") setPassword(formState.password);
    if (typeof formState.confirm === "string") setConfirm(formState.confirm);
    if (typeof formState.doctorSpecialty === "string")
      setDoctorSpecialty(formState.doctorSpecialty);
    if (typeof formState.licenseNumber === "string")
      setLicenseNumber(formState.licenseNumber);
    if (typeof formState.avatarUri === "string") setAvatarUri(formState.avatarUri);
    if (typeof formState.avatarData === "string")
      setAvatarData(formState.avatarData);
    if (typeof formState.practiceLocation === "string")
      setPracticeLocation(formState.practiceLocation);
    if (typeof formState.practiceLocationLat === "number")
      setPracticeLocationLat(formState.practiceLocationLat);
    if (typeof formState.practiceLocationLng === "number")
      setPracticeLocationLng(formState.practiceLocationLng);
    if (typeof formState.certification === "string")
      setCertification(formState.certification);
    if (typeof formState.cv === "string") setCv(formState.cv);
    if (typeof formState.consultationFee === "string")
      setConsultationFee(formState.consultationFee);
    if (typeof formState.secretaryPhone === "string")
      setSecretaryPhone(formState.secretaryPhone);
  }, [route.params?.formState]);

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

  const handleSignup = async () => {

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
      (!avatarData || !practiceLocation || !certification || !cv)
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
      // رسوم الاستشارة اختيارية الآن
      const secretaryDigits = normalizeIraqPhoneTo10Digits(secretaryPhone);
      if (!secretaryDigits) {
        Alert.alert("خطأ", "أدخل رقم السكرتير للتواصل مع المرضى.");
        return;
      }
      if (secretaryDigits.length !== 10 || !secretaryDigits.startsWith("7")) {
        Alert.alert("خطأ", "رقم السكرتير يجب أن يكون 10 أرقام ويبدأ بـ7");
        return;
      }
    }

    try {
      setLoading(true);

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
            role === "doctor" && avatarData
              ? `data:image/jpeg;base64,${avatarData}`
              : undefined,
          location: role === "doctor" ? practiceLocation : undefined,
          locationLat: role === "doctor" ? practiceLocationLat : undefined,
          locationLng: role === "doctor" ? practiceLocationLng : undefined,
          certification: role === "doctor" ? certification : undefined,
          cv: role === "doctor" ? cv : undefined,
          consultationFee: role === "doctor" ? consultationFee : undefined,
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
        Alert.alert("تم إنشاء الحساب", "حسابك قيد المراجعة. سيتم تفعيل حسابك بعد موافقة الإدارة.", [
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

          // 🔔 Register push token immediately after signup login
          try {
            const push = await import("../lib/pushNotifications");
            try {
              const expoPushToken = await getExpoPushTokenOrThrow();
              await registerExpoPushToken(expoPushToken);
            } catch (err) {
              console.log('Push notification setup error:', err);
            }
          } catch (pushErr) {
            console.log("Push registration after signup failed:", pushErr);
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
        base64: true,
      });

      if (picker.canceled || picker.cancelled) return;

      const asset = picker.assets?.[0];

      if (!asset?.uri || !asset.base64) {
        Alert.alert(
          "خطأ",
          "تعذّر قراءة الصورة المختارة، جرّب صورة أخرى أو أعد تشغيل التطبيق."
        );
        return;
      }

      setAvatarUri(asset.uri);
      setAvatarData(asset.base64);
    } catch (err) {
      console.log("Avatar pick error:", err);
      Alert.alert("خطأ", "تعذر اختيار الصورة، حاول مرة أخرى");
    }
  };


  const handleRoleSwitch = async () => {
    await logout();
    navigation.replace("RoleSelection");
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
      {/* Header */}
      
      <View style={styles.header}>
        <Image  
          source={require("../assets/images/im4.png")}
          style={styles.logo}
        />
        <Text style={styles.appName}>MediCare</Text>
        <Text style={styles.tagline}>
          {role === "doctor" ? "سجّل كطبيب واحصل على أدوات الإدارة" : "أنشئ حساب المراجع"}
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>الاسم الكامل</Text>
          <TextInput
            placeholder="أدخل اسمك"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            value={name}
            onChangeText={setName}
            multiline={false}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>العمر</Text>
          <TextInput
            placeholder="مثلاً 30"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            keyboardType="numeric"
            value={age}
            onChangeText={setAge}
            multiline={false}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>رقم الهاتف</Text>
          <TextInput
            placeholder="أدخل 10 أرقام تبدأ بـ7"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            keyboardType="phone-pad"
            autoCapitalize="none"
            value={phone}
            maxLength={10}
            onChangeText={(t) => setPhone(normalizeIraqPhoneTo10Digits(t))}
            multiline={false}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>كلمة المرور</Text>
          <View style={styles.passwordRow}>
            <TextInput
              placeholder="أدخل كلمة المرور"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, styles.passwordInput]}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              multiline={false}
              scrollEnabled={false}
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              <Text style={styles.showPasswordText}>{showPassword ? "إخفاء" : "إظهار"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>تأكيد كلمة المرور</Text>
          <View style={styles.passwordRow}>
            <TextInput
              placeholder="أكد كلمة المرور"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, styles.passwordInput]}
              secureTextEntry={!showConfirm}
              value={confirm}
              onChangeText={setConfirm}
              multiline={false}
              scrollEnabled={false}
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() => setShowConfirm((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showConfirm ? "إخفاء تأكيد كلمة المرور" : "إظهار تأكيد كلمة المرور"}
            >
              <Text style={styles.showPasswordText}>{showConfirm ? "إخفاء" : "إظهار"}</Text>
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
                        styles.specialtyOption,
                        selected && styles.specialtyOptionSelected,
                      ]}
                      onPress={() => setDoctorSpecialty(option.value)}
                    >
                      <Text
                        style={[
                          styles.specialtyOptionText,
                          selected && styles.specialtyOptionTextSelected,
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
              <TextInput
                placeholder="أدخل رقم الترخيص أو الهوية المهنية"
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                multiline={false}
                scrollEnabled={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>رسوم الاستشارة (اختياري)</Text>
              <TextInput
                placeholder="اكتب سعر الاستشارة إذا كان ثابتاً أو اتركه فارغاً"
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                value={consultationFee}
                onChangeText={setConsultationFee}
                keyboardType="numeric"
                multiline={false}
                scrollEnabled={false}
              />
              <Text style={{color: colors.placeholder, fontSize: 14, marginTop: 4}}>
                يمكنك ترك الحقل فارغ إذا كانت الاستشارة غير ثابتة وسيتم تحديدها من صفحة الخدمات لاحقاً.
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>رقم السكرتير للتواصل</Text>
              <TextInput
                placeholder="أدخل 10 أرقام تبدأ بـ7"
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                keyboardType="phone-pad"
                value={secretaryPhone}
                maxLength={10}
                onChangeText={(t) => setSecretaryPhone(normalizeIraqPhoneTo10Digits(t))}
                multiline={false}
                scrollEnabled={false}
              />
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
                      <TextInput
                        placeholder="مثلاً: بغداد، عيادة الرعاية"
                        placeholderTextColor={colors.placeholder}
                        style={styles.input}
                        value={practiceLocation}
                        onChangeText={setPracticeLocation}
                      />

                      <TouchableOpacity
                        style={styles.mapPickerButton}
                        onPress={() => {
                          // حفظ حالة النموذج الحالية وتمريرها إلى شاشة الخريطة
                          const formState = {
                            role,
                            name,
                            age,
                            phone,
                            password,
                            confirm,
                            doctorSpecialty,
                            licenseNumber,
                            avatarUri,
                            avatarData,
                            practiceLocation,
                            practiceLocationLat,
                            practiceLocationLng,
                            certification,
                            cv,
                            consultationFee,
                            secretaryPhone,
                          };

                          navigation.navigate("LocationPicker", {
                            returnTo: "Signup",
                            title: "اختيار موقع العيادة",
                            initialLatitude: practiceLocationLat,
                            initialLongitude: practiceLocationLng,
                            initialAddress: practiceLocation,
                            formState,
                          });
                        }}
                      >
                        <Text style={styles.mapPickerButtonText}>اختيار الموقع من الخريطة</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>الشهادة المهنية</Text>
                      <TextInput
                        placeholder="اكتب اسم الشهادة أو الصادرة من أي جهة"
                        placeholderTextColor={colors.placeholder}
                        style={styles.input}
                        value={certification}
                        onChangeText={setCertification}
                      />
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>السيرة الذاتية المختصرة</Text>
                      <TextInput
                        placeholder="اكتب خبراتك وأبرز التخصصات"
                        placeholderTextColor={colors.placeholder}
                        style={[styles.input, styles.multilineInput]}
                        value={cv}
                        onChangeText={setCv}
                        multiline
                        numberOfLines={4}
                      />
                    </View>
          </>
        )}


        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => setPrivacyAccepted((v) => !v)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: privacyAccepted ? colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: privacyAccepted }}
          >
            {privacyAccepted && (
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>✓</Text>
            )}
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 14 }}>
            أوافق على
            <Text
              style={{ color: colors.primary, textDecorationLine: 'underline' }}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            > سياسة الخصوصية </Text>
            و شروط الاستخدام
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { opacity: privacyAccepted && !loading ? 1 : 0.5 }]}
          onPress={handleSignup}
          disabled={loading || !privacyAccepted}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "جارٍ الإنشاء..." : "إنشاء حساب"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.replace("Login")}
        >
          <Text style={styles.secondaryButtonText}>العودة لتسجيل الدخول</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.center} onPress={handleRoleSwitch}>
          <Text style={styles.linkText}>تغيير نوع الحساب أو تسجيل خروج</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingVertical: 32,
      justifyContent: "flex-start",
      paddingBottom: 48,
    },
  header: {
    alignItems: "center",
    marginTop: 40,
  },
  logo: {
   width: 250,
    height: 250,
    borderRadius: 30,
    marginBottom: 16,
    marginTop: 0,
  },
  appName: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    writingDirection: "rtl",
  },
  form: {
    marginTop: 32,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 6,
    textAlign: "right",
    writingDirection: "rtl",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    textAlign: "right",
    writingDirection: "rtl",
  },
  passwordRow: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingLeft: 84,
  },
  showPasswordButton: {
    position: "absolute",
    left: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  showPasswordText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  center: {
    marginTop: 12,
    alignItems: "center",
  },
  linkText: {
    fontSize: 14,
    color: colors.primary,
  },
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
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    fontSize: 10,
    color: colors.placeholder,
    textAlign: "center",
  },
  avatarButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  avatarButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  mapPickerButton: {
    marginTop: 10,
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
  multilineInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  specialtyOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  specialtyOption: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    margin: 4,
  },
  specialtyOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  specialtyOptionText: {
    fontSize: 13,
    color: colors.text,
  },
  specialtyOptionTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },
  });
