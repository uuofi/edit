
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// تسجيل واسترجاع Expo Push Token
export async function registerForPushNotificationsAsync() {
  let expoPushToken;
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    expoPushToken = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;
  } else {
    alert('Must use physical device for Push Notifications');
    return;
  }
  return { expoPushToken };
}

// استقبال الإشعارات في المقدمة
export function onMessage(handler) {
  return Notifications.addNotificationReceivedListener((notification) => {
    handler(notification);
  });
}

// استقبال الإشعارات في الخلفية
export function setBackgroundMessageHandler(handler) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      handler(notification);
      return {
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
  });
}
