# Expo Push Notifications Setup (Production Ready)

## 1. Expo Push Token
- يتم توليد Expo Push Token عند أول تشغيل.
- يتم طلب صلاحيات الإشعارات تلقائياً.
- يتم تخزين التوكن في Firebase Firestore وربطه بالمستخدم.

## 2. الإشعارات
- استقبال الإشعارات في المقدمة والخلفية عبر expo-notifications.
- لا يوجد أي استخدام لـ FCM Token أو messaging.
- الإرسال يتم فقط من Backend عبر Expo Push API.

## 3. إعدادات app.json
- صلاحية POST_NOTIFICATIONS مضافة.
- إعدادات EAS Build و google-services.json صحيحة.

## 4. الكود الأساسي

### تسجيل التوكن:
```js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

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
    expoPushToken = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    alert('Must use physical device for Push Notifications');
    return;
  }
  return { expoPushToken };
}
```

### تخزين التوكن في Firebase:
```js
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getApp, initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let app;
try {
  app = getApp();
} catch {
  app = initializeApp(firebaseConfig);
}
const db = getFirestore(app);

export async function saveExpoPushTokenToFirebase(userId, expoPushToken) {
  if (!userId || !expoPushToken) return;
  await setDoc(doc(db, 'users', userId), {
    expoPushToken,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}
```

### استقبال الإشعارات:
```js
import * as Notifications from 'expo-notifications';

Notifications.addNotificationReceivedListener((notification) => {
  // التعامل مع الإشعار في المقدمة
  console.log('[Expo] Foreground notification:', notification);
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
```

### إرسال إشعار من Backend:
```js
const fetch = require('node-fetch');
const expoPushToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: expoPushToken,
    title: 'عنوان الإشعار',
    body: 'محتوى الإشعار',
    data: { customData: 'value' }
  })
});
```

## 5. التنظيف
- تم حذف أي كود أو مكتبة تخص FCM أو messaging.
- الكود الآن نظيف وجاهز للنشر على Google Play.
