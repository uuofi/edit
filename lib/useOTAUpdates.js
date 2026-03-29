import { useEffect, useState, useCallback } from "react";
import { Alert, AppState } from "react-native";
import * as Updates from "expo-updates";

/**
 * Hook to check for and apply OTA updates via EAS Update.
 *
 * - Checks for updates on mount & every time the app comes to foreground.
 * - If an update is found, downloads it and prompts the user to restart.
 * - Exposes `checkManually()` for a button-triggered check.
 */
export default function useOTAUpdates() {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const checkForUpdate = useCallback(async (silent = true) => {
    // OTA updates are not available in development builds or Expo Go
    if (__DEV__) {
      if (!silent) {
        Alert.alert("وضع التطوير", "تحديثات OTA غير متوفرة في وضع التطوير.");
      }
      return;
    }

    try {
      setIsChecking(true);
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setIsDownloading(true);
        await Updates.fetchUpdateAsync();
        setIsDownloading(false);

        Alert.alert(
          "تحديث جديد 🎉",
          "تم تحميل تحديث جديد للتطبيق. هل تريد إعادة تشغيل التطبيق الآن لتطبيق التحديث؟",
          [
            { text: "لاحقاً", style: "cancel" },
            {
              text: "إعادة التشغيل",
              style: "destructive",
              onPress: async () => {
                await Updates.reloadAsync();
              },
            },
          ]
        );
      } else if (!silent) {
        Alert.alert("لا يوجد تحديث", "أنت تستخدم أحدث إصدار من التطبيق. ✅");
      }
    } catch (err) {
      console.log("[OTA] Update check error:", err?.message || err);
      if (!silent) {
        Alert.alert("خطأ", "تعذّر التحقق من التحديثات. حاول لاحقاً.");
      }
    } finally {
      setIsChecking(false);
      setIsDownloading(false);
    }
  }, []);

  // Check on mount
  useEffect(() => {
    // Small delay so the app finishes booting first
    const timer = setTimeout(() => checkForUpdate(true), 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  // Check when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        checkForUpdate(true);
      }
    });
    return () => subscription.remove();
  }, [checkForUpdate]);

  return {
    isChecking,
    isDownloading,
    checkManually: () => checkForUpdate(false),
  };
}
