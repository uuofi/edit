import React, { useEffect, useMemo, useRef, useState } from "react";
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
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

function formatAddress(addr) {
  if (!addr) return "";
  const parts = [
    addr.name,
    addr.street,
    addr.district,
    addr.city,
    addr.region,
    addr.country,
  ].filter(Boolean);
  return parts.join("، ");
}

export default function LocationPickerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params || {};

  const mapRef = useRef(null);

  const returnTo = params.returnTo || null;
  const title = params.title || "اختيار موقع العيادة";

  const initial = useMemo(() => {
    const lat = Number(params.initialLatitude);
    const lng = Number(params.initialLongitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
    return null;
  }, [params.initialLatitude, params.initialLongitude]);

  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState(null);
  const [selected, setSelected] = useState(
    initial
      ? { ...initial, address: params.initialAddress || "" }
      : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      const addr = results?.[0];
      return formatAddress(addr);
    } catch {
      return "";
    }
  };

  const animateTo = (nextRegion) => {
    try {
      mapRef.current?.animateToRegion(nextRegion, 450);
    } catch {
      // no-op
    }
  };

  const goToCurrentLocation = async ({ alsoSelect = false } = {}) => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;
      const nextRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };

      setRegion(nextRegion);
      animateTo(nextRegion);

      if (alsoSelect) {
        const address = await reverseGeocode(latitude, longitude);
        setSelected({ latitude, longitude, address });
      }
    } catch {
      Alert.alert("الموقع", "تعذّر الحصول على موقعك الحالي. تأكد من تفعيل GPS ومنح الإذن.");
    }
  };

  const onSearch = async () => {
    const query = String(searchQuery || "").trim();
    if (query.length < 3) {
      Alert.alert("بحث الموقع", "اكتب اسم المكان أو العنوان ثم اضغط بحث.");
      return;
    }

    setSearching(true);
    try {
      const results = await Location.geocodeAsync(query);
      const first = results?.[0];
      if (!first || !Number.isFinite(first.latitude) || !Number.isFinite(first.longitude)) {
        Alert.alert("بحث الموقع", "لم يتم العثور على نتائج. جرّب كتابة عنوان أوضح.");
        return;
      }

      const latitude = first.latitude;
      const longitude = first.longitude;
      const nextRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };

      setRegion(nextRegion);
      animateTo(nextRegion);

      const address = await reverseGeocode(latitude, longitude);
      setSelected({ latitude, longitude, address: address || query });
    } catch {
      Alert.alert("بحث الموقع", "تعذّر البحث حالياً. جرّب مرة أخرى.");
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("إذن الموقع", "نحتاج إذن الموقع لعرض الخريطة وتحديد موقع العيادة.");
        }

        if (initial) {
          const address = selected?.address || (await reverseGeocode(initial.latitude, initial.longitude));
          if (!mounted) return;
          setSelected({ ...initial, address });
          setRegion({
            latitude: initial.latitude,
            longitude: initial.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
          setLoading(false);
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted) return;
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setRegion({
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
        setLoading(false);
      } catch (_e) {
        if (!mounted) return;
        setLoading(false);
        Alert.alert("الخريطة", "تعذّر تحميل الخريطة. حاول مرة أخرى.");
      }
    };

    init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPick = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate || {};
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const address = await reverseGeocode(latitude, longitude);
    setSelected({ latitude, longitude, address });
  };

  const onConfirm = async () => {
    if (!selected) {
      Alert.alert("اختيار الموقع", "اضغط على الخريطة لاختيار موقع العيادة.");
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
          latitude: selected.latitude,
          longitude: selected.longitude,
          address: selected.address || "",
        },
      },
      merge: true,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Feather name="chevron-right" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading || !region ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0EA5E9" />
          <Text style={styles.loadingText}>جارٍ تحميل الخريطة...</Text>
        </View>
      ) : (
        <View style={styles.container}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            onPress={onPick}
          >
            {selected ? (
              <Marker coordinate={{ latitude: selected.latitude, longitude: selected.longitude }} />
            ) : null}
          </MapView>

          <View style={styles.searchBar}>
            <TouchableOpacity
              style={styles.currentBtn}
              onPress={() => goToCurrentLocation({ alsoSelect: false })}
            >
              <Feather name="crosshair" size={18} color="#0EA5E9" />
            </TouchableOpacity>

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="ابحث عن موقع (اسم مكان أو عنوان)"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              textAlign="right"
              writingDirection="rtl"
              returnKeyType="search"
              onSubmitEditing={onSearch}
            />

            <TouchableOpacity
              style={[styles.searchBtn, searching ? styles.searchBtnDisabled : null]}
              onPress={onSearch}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#0EA5E9" />
              ) : (
                <Feather name="search" size={18} color="#0EA5E9" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>موقع العيادة</Text>
            <Text style={styles.sheetBody} numberOfLines={2}>
              {selected?.address
                ? selected.address
                : selected
                ? `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}`
                : "اضغط على الخريطة لتحديد موقع العيادة"}
            </Text>

            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
              <Text style={styles.confirmText}>تأكيد الموقع</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    writingDirection: "rtl",
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#374151", writingDirection: "rtl" },
  container: { flex: 1 },
  map: { flex: 1 },
  searchBar: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  currentBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0F2FE",
    backgroundColor: "#E0F2FE",
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    color: "#111827",
  },
  searchBtn: {
    width: 42,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0F2FE",
    backgroundColor: "#E0F2FE",
  },
  searchBtnDisabled: {
    opacity: 0.7,
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  sheetTitle: { fontSize: 14, fontWeight: "700", color: "#111827", textAlign: "right", writingDirection: "rtl" },
  sheetBody: { marginTop: 6, fontSize: 13, color: "#4B5563", textAlign: "right", writingDirection: "rtl" },
  confirmBtn: {
    marginTop: 12,
    backgroundColor: "#0EA5E9",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmText: { color: "#fff", fontWeight: "700", fontSize: 15, writingDirection: "rtl" },
});
