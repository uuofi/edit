import { Linking, Alert } from "react-native";

export function buildGoogleMapsUrl({ latitude, longitude, address }) {
  const hasCoords =
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude);

  const query = hasCoords
    ? `${latitude},${longitude}`
    : String(address || "").trim();

  if (!query) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export async function openInGoogleMaps({ latitude, longitude, address }) {
  const url = buildGoogleMapsUrl({ latitude, longitude, address });
  if (!url) {
    Alert.alert("لا يوجد موقع", "يرجى تحديد موقع العيادة أولاً");
    return;
  }

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("تعذّر الفتح", "لا يمكن فتح خرائط كوكل على هذا الجهاز");
      return;
    }
    await Linking.openURL(url);
  } catch (e) {
    Alert.alert("تعذّر الفتح", "حدث خطأ أثناء فتح خرائط كوكل");
  }
}
