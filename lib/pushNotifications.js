
import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';

// طلب صلاحية الإشعارات (Android 13+)
async function requestNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

// تسجيل واسترجاع FCM Token
export async function registerForPushNotificationsAsync() {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    console.log('[PushDebug] Notification permission not granted.');
    return null;
  }
  try {
    const fcmPushToken = await messaging().getToken();
    console.log('[PushDebug] FCM push token:', fcmPushToken);
    return { fcmPushToken };
  } catch (e) {
    console.log('[PushDebug] Failed to get FCM push token.', e);
    return null;
  }
}

// استقبال الإشعارات في الخلفية
export function setBackgroundMessageHandler(handler) {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    handler(remoteMessage);
  });
}

// استقبال الإشعارات في المقدمة
export function onMessage(handler) {
  return messaging().onMessage(async remoteMessage => {
    handler(remoteMessage);
  });
}
