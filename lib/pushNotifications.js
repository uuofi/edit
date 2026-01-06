import { getToken } from "./api";
const API_BASE_URL = "https://api.medicare-iq.com";
import { Alert, Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
const getExpoProjectId = () => {
  // Priority:
  // 1) EAS projectId (preferred)
  // 2) expo.extra.eas.projectId (legacy)
  // 3) fallback hardcoded (kept for backwards compatibility)

  const easProjectId = Constants?.easConfig?.projectId;
  const extraProjectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.manifest?.extra?.eas?.projectId ||
    Constants?.manifest2?.extra?.eas?.projectId;

  return (
    easProjectId ||
    extraProjectId ||
    // fallback: existing hardcoded value from App.js
    "38c67a16-e624-480f-b47c-5c0b14759ff5"
  );
};



export async function registerForPushTokensAsync() {
  if (!Device.isDevice) {
    Alert.alert("تنبيه", "الإشعارات تحتاج جهاز حقيقي، ليس المحاكي فقط.");
    console.log("[PushDebug] Not a real device. No push tokens will be registered.");
    return { expoPushToken: null, fcmPushToken: null, devicePushToken: null, devicePushTokenType: null };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    Alert.alert("تنبيه", "لم يتم منح صلاحية الإشعارات.");
    console.log("[PushDebug] Notification permission not granted.");
    return { expoPushToken: null, fcmPushToken: null, devicePushToken: null, devicePushTokenType: null };
  }

  // بمجرد الموافقة، خذ التوكن وارسلها للسيرفر
  const accessToken = await getToken();
  console.log("[PushDebug] accessToken used for push:", accessToken);

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  let devicePushToken = null;
  let devicePushTokenType = null;
  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    devicePushToken = deviceToken?.data || null;
    devicePushTokenType = deviceToken?.type || null; // 'fcm' on Android, 'apns' on iOS
    console.log("[PushDebug] Device push token:", devicePushToken, "type:", devicePushTokenType);
    if (!devicePushToken || !devicePushTokenType) {
      console.warn("[PushDebug] لم يتم الحصول على FCM token. تأكد أنك على جهاز Android حقيقي وملف google-services.json موجود.");
    }
  } catch (_e) {
    devicePushToken = null;
    devicePushTokenType = null;
    console.log("[PushDebug] Failed to get device push token.", _e);
  }

  let expoPushToken = null;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: getExpoProjectId(),
    });
    expoPushToken = tokenData?.data || null;
    console.log("[PushDebug] Expo push token:", expoPushToken);
  } catch (_e) {
    expoPushToken = null;
    console.log("[PushDebug] Failed to get Expo push token.", _e);
  }

  const fcmPushToken = devicePushTokenType === "fcm" ? devicePushToken : null;
  console.log("[PushDebug] FCM push token:", fcmPushToken);

  // إرسال التوكنات للسيرفر مباشرة بعد الحصول عليها
  try {
    await fetch(`${API_BASE_URL}/api/notifications/register-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        expoPushToken: expoPushToken || "",
        fcmPushToken: fcmPushToken || "",
      }),
    });
    console.log("[PushDebug] Sent tokens to backend", { expoPushToken, fcmPushToken });
  } catch (err) {
    console.log("[PushDebug] Failed to send tokens to backend", err);
  }

  return {
    expoPushToken,
    fcmPushToken,
    devicePushToken,
    devicePushTokenType,
  };
}

export async function registerForPushNotificationsAsync() {
  const tokens = await registerForPushTokensAsync();
  return tokens?.expoPushToken || null;
}
