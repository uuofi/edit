// ملف worker لاستخدام react-native-threads
self.onmessage = (message) => {
  // معالجة الرسالة القادمة من الـ Main Thread
  // هنا مثال بسيط: إعادة نفس الرسالة مع نص إضافي
  self.postMessage('تمت معالجة الرسالة: ' + message);
};
