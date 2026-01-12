import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

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
      alert('فشل الحصول على توكن الدفع لإشعار الدفع!');
      return;
    }
    expoPushToken = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    alert('يجب استخدام جهاز فعلي لإشعارات الدفع');
    return;
  }
  return { expoPushToken };
}
