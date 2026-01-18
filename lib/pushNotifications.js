
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Requests permissions, gets Expo push token, and throws on any error. Expo only.
export async function getExpoPushTokenOrThrow() {
  if (!Device.isDevice) {
    throw new Error('Push notifications require a physical device.');
  }

  // Request notification permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    throw new Error('Notification permissions not granted.');
  }

  // Get Expo push token
  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
  if (!expoPushToken) {
    throw new Error('Failed to get Expo push token.');
  }
  return expoPushToken;
}
