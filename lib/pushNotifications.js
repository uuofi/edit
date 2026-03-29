import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';

/** Race a promise against a timeout. Resolves to undefined if the timeout wins. */
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);

/** Default timeout for push-token related Expo calls (30 seconds). */
const PUSH_TIMEOUT_MS = 30000;

/** Resolve the EAS projectId from app config. */
const getProjectId = () => {
  const extra =
    Constants?.expoConfig?.extra ||
    Constants?.manifest?.extra ||
    Constants?.manifest2?.extra ||
    {};
  return (
    extra?.eas?.projectId ||
    Constants?.expoConfig?.extra?.eas?.projectId ||
    "7d991cce-f39f-41cc-8a2f-5217775d6f06"
  );
};

/**
 * Show the user an alert explaining how to enable notifications from Settings.
 * Called when the OS will no longer show the permission dialog.
 */
function promptOpenSettings() {
  Alert.alert(
    "الإشعارات معطلة",
    "لتلقي إشعارات المواعيد، يرجى تفعيل الإشعارات من إعدادات الجهاز.",
    [
      { text: "لاحقاً", style: "cancel" },
      {
        text: "فتح الإعدادات",
        onPress: () => Linking.openSettings(),
      },
    ]
  );
}

export async function registerForPushNotificationsAsync({ silent = false } = {}) {
  let expoPushToken;

  if (!Device.isDevice) {
    console.log('[Push] Not a physical device, skipping push registration');
    return;
  }

  try {
    // Ensure Android notification channel exists BEFORE requesting token
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'إشعارات Medicare',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#38BDF8',
        sound: 'default',
      });
      console.log('[Push] Android notification channel "default" ensured');
    }

    // ── Step 1: check current permission ──
    const permResult = await withTimeout(
      Notifications.getPermissionsAsync(),
      PUSH_TIMEOUT_MS
    );
    if (!permResult) {
      console.warn('[Push] getPermissionsAsync timed out');
      return;
    }
    let finalStatus = permResult.status;
    const canAskAgain = permResult.canAskAgain !== false; // default true
    console.log('[Push] Current permission status:', finalStatus, '| canAskAgain:', canAskAgain);

    // ── Step 2: request permission if not yet granted ──
    if (finalStatus !== 'granted') {
      if (canAskAgain) {
        // No timeout on the OS dialog — let the user respond in their own time
        const reqResult = await Notifications.requestPermissionsAsync();
        finalStatus = reqResult?.status || 'denied';
        console.log('[Push] After request, permission status:', finalStatus);
      }

      if (finalStatus !== 'granted') {
        console.log('[Push] Permission not granted — user denied notifications');
        if (!silent) {
          promptOpenSettings();
        }
        return;
      }
    }

    // ── Step 3: get the Expo push token ──
    const projectId = getProjectId();
    console.log('[Push] Using projectId:', projectId);

    let tokenResult = await withTimeout(
      Notifications.getExpoPushTokenAsync({ projectId }),
      PUSH_TIMEOUT_MS
    );

    if (!tokenResult) {
      console.warn('[Push] getExpoPushTokenAsync timed out (1st try), retrying...');
      tokenResult = await withTimeout(
        Notifications.getExpoPushTokenAsync({ projectId }),
        PUSH_TIMEOUT_MS
      );
    }

    if (!tokenResult?.data) {
      console.warn('[Push] Failed to get Expo token after retry (projectId:', projectId, ')');
      return;
    }

    expoPushToken = tokenResult.data;

    // Validate the token format
    if (typeof expoPushToken === 'string' && expoPushToken.startsWith('ExponentPushToken[')) {
      console.log('[Push] ✅ Got valid Expo push token:', expoPushToken);
    } else {
      console.warn('[Push] ⚠️ Token format unexpected:', expoPushToken);
      console.warn('[Push] Expected ExponentPushToken[...] but got something else');
    }
  } catch (err) {
    console.error('[Push] registerForPushNotificationsAsync error:', err);
    return;
  }

  return { expoPushToken };
}
