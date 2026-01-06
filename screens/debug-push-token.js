
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { registerForPushTokensAsync } from "../lib/pushNotifications";

// متغير لتخزين آخر لوج
let lastLog = "";

export default function DebugPushTokenScreen() {
  const [tokens, setTokens] = useState({});
  const [error, setError] = useState(null);
  const [log, setLog] = useState("");

  useEffect(() => {
    // دالة لالتقاط أي لوج من console.log
    const origLog = console.log;
    console.log = function (...args) {
      lastLog = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      setLog(lastLog);
      origLog.apply(console, args);
    };
    registerForPushTokensAsync()
      .then((result) => {
        setTokens(result || {});
        if (!result || (!result.expoPushToken && !result.fcmPushToken)) {
          setError("لم يتم استلام أي توكن من النظام. قد يكون هناك مشكلة في الإعدادات أو في صلاحيات الإشعارات.");
        } else if (!result.fcmPushToken) {
          setError("FCM Push Token غير متوفر. إذا كنت على أندرويد تأكد من ملف google-services.json والبناء عبر EAS. إذا كنت على iOS فهذا طبيعي في Expo Go.");
        } else {
          setError(null);
        }
      })
      .catch((e) => {
        setError("فشل جلب التوكن: " + (e?.message || e?.toString() || "خطأ غير معروف"));
      });
    // إعادة console.log للوضع الطبيعي عند الخروج
    return () => {
      console.log = origLog;
    };
  }, []);

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      {error && (
        <Text style={{ color: 'red', fontWeight: 'bold', marginBottom: 16 }}>{error}</Text>
      )}
      {log ? (
        <View style={{ backgroundColor: '#eee', borderRadius: 8, padding: 10, marginBottom: 16 }}>
          <Text selectable style={{ color: '#333', fontSize: 13, fontFamily: 'monospace' }}>
            آخر لوج:
            {"\n"}
            {log}
          </Text>
        </View>
      ) : null}
      <Text selectable style={{ fontSize: 16, marginBottom: 10 }}>
        Expo Push Token: {tokens.expoPushToken || "N/A"}
      </Text>
      <Text selectable style={{ fontSize: 16, marginBottom: 10 }}>
        FCM Push Token: {tokens.fcmPushToken || "N/A"}
      </Text>
      <Text selectable style={{ fontSize: 16 }}>
        Device Push Token: {tokens.devicePushToken || "N/A"}
      </Text>
      <Text selectable style={{ fontSize: 16 }}>
        Device Push Token Type: {tokens.devicePushTokenType || "N/A"}
      </Text>
    </ScrollView>
  );
}
