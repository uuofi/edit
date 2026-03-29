import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useAppTheme } from "../lib/useTheme";

function formatCoords(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return String(num);
}

export default function LocationPickerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params || {};
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const returnTo = params.returnTo || null;
  const title = params.title || "اختيار موقع العيادة";
  const formState = params.formState;

  const initial = useMemo(() => {
    const lat = Number(params.initialLatitude);
    const lng = Number(params.initialLongitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
    return null;
  }, [params.initialLatitude, params.initialLongitude]);

  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState(params.initialAddress || "");
  const [latitude, setLatitude] = useState(initial ? formatCoords(initial.latitude) : "");
  const [longitude, setLongitude] = useState(initial ? formatCoords(initial.longitude) : "");

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await Location.requestForegroundPermissionsAsync();
      } catch {
        // ignore permission errors on web
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, []);

  const useCurrentLocation = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatitude(formatCoords(pos.coords.latitude));
      setLongitude(formatCoords(pos.coords.longitude));
    } catch {
      Alert.alert("الموقع", "تعذّر الحصول على موقعك الحالي.");
    }
  };

  const onConfirm = () => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert("اختيار الموقع", "أدخل خط العرض وخط الطول بشكل صحيح.");
      return;
    }

    if (!returnTo) {
      navigation.goBack();
      return;
    }

    navigation.navigate({
      name: returnTo,
      params: {
        pickedLocation: {
          latitude: lat,
          longitude: lng,
          address: String(address || "").trim(),
        },
        formState,
      },
      merge: true,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Feather name="chevron-right" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جارٍ تحميل البيانات...</Text>
        </View>
      ) : (
        <View style={styles.container}>
          <Text style={styles.hint}>
            على الدسكتوب لا توجد خريطة مدمجة. أدخل الإحداثيات يدويًا أو استخدم الموقع الحالي.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>العنوان</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="اكتب عنوان العيادة"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              textAlign="right"
              writingDirection="rtl"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.formGroupHalf}>
              <Text style={styles.label}>خط العرض</Text>
              <TextInput
                value={latitude}
                onChangeText={setLatitude}
                placeholder="مثال: 33.3152"
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                keyboardType="numeric"
                textAlign="right"
                writingDirection="rtl"
              />
            </View>
            <View style={styles.formGroupHalf}>
              <Text style={styles.label}>خط الطول</Text>
              <TextInput
                value={longitude}
                onChangeText={setLongitude}
                placeholder="مثال: 44.3661"
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                keyboardType="numeric"
                textAlign="right"
                writingDirection="rtl"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.secondaryBtn} onPress={useCurrentLocation}>
            <Feather name="crosshair" size={18} color={colors.primary} />
            <Text style={styles.secondaryText}>استخدم موقعي الحالي</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
            <Text style={styles.confirmText}>تأكيد الموقع</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      writingDirection: "rtl",
    },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    loadingText: { marginTop: 12, color: colors.textMuted, writingDirection: "rtl" },
    container: { flex: 1, padding: 16, gap: 16 },
    hint: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      color: colors.textMuted,
      textAlign: "right",
      writingDirection: "rtl",
    },
    formGroup: { gap: 8 },
    formGroupHalf: { flex: 1, gap: 8 },
    label: { fontSize: 13, color: colors.text, textAlign: "right", writingDirection: "rtl" },
    input: {
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      color: colors.text,
      backgroundColor: colors.inputBg || colors.surface,
    },
    row: { flexDirection: "row-reverse", gap: 12 },
    secondaryBtn: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: isDark ? colors.border : "#E0F2FE",
      backgroundColor: isDark ? colors.surfaceAlt : "#E0F2FE",
      borderRadius: 12,
      paddingVertical: 12,
    },
    secondaryText: { color: colors.primary, fontWeight: "700" },
    confirmBtn: {
      marginTop: 4,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    confirmText: { color: "#fff", fontWeight: "700", fontSize: 15, writingDirection: "rtl" },
  });
