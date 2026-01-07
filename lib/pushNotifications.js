import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Expo Managed Workflow: فقط Expo Push Token
export async function registerForPushNotificationsAsync() {
  // طلب صلاحية الإشعارات
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.log("[PushDebug] Notification permission not granted.");
    return null;
  }
  // إعداد Notification Channel لأندرويد
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  // جلب Expo Push Token فقط
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();

    const expoPushToken = tokenData?.data || null;
    console.log("[PushDebug] Expo push token:", expoPushToken);
    return expoPushToken;
  } catch (e) {
    console.log("[PushDebug] Failed to get Expo push token.", e);
    return null;
  }
}
