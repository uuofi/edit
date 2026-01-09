import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getApp, initializeApp } from 'firebase/app';

// إعداد فايربيس (ضع إعدادات مشروعك هنا)
const firebaseConfig = {
  apiKey: "AIzaSyCEhPIKWLZyXutuenyJalCUUnyt5G2OOsk",
  authDomain: "medicare-adba7.firebaseapp.com",
  projectId: "medicare-adba7",
  storageBucket: "medicare-adba7.firebasestorage.app",
  messagingSenderId: "411875480038",
  appId: "1:411875480038:web:22b24af0b6c863f3254627",
  measurementId: "G-375X5XW7NL"
};

let app;
try {
  app = getApp();
} catch {
  app = initializeApp(firebaseConfig);
}
const db = getFirestore(app);

export async function saveExpoPushTokenToFirebase(userId, expoPushToken, role) {
  if (!userId || !expoPushToken) return;
  // جلب التوكنات الحالية
  const userRef = doc(db, 'users', userId);
  let prevTokens = [];
  try {
    const userSnap = await userRef.get();
    if (userSnap.exists() && Array.isArray(userSnap.data().expoPushTokens)) {
      prevTokens = userSnap.data().expoPushTokens;
    } else if (userSnap.exists() && userSnap.data().expoPushToken) {
      prevTokens = [userSnap.data().expoPushToken];
    }
  } catch {}

  // إضافة التوكن الجديد إذا لم يكن موجوداً
  const tokens = Array.from(new Set([...(prevTokens || []), expoPushToken]));
  await setDoc(userRef, {
    expoPushTokens: tokens,
    role,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}
