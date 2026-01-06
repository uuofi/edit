import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "app.theme.preference";

// preference: 'system' follows device, otherwise force scheme.
const ThemePreferenceContext = createContext(undefined);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState("light");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active) return;
        if (saved === "light" || saved === "dark" || saved === "system") {
          setPreferenceState(saved);
        }
      } catch {
        // ignore storage errors
      } finally {
        if (active) setLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const scheme = useMemo(() => {
    if (preference === "dark" || preference === "light") return preference;
    // If user picked "system" explicitly, follow device; otherwise default stays light.
    const normalizedSystem = systemScheme === "dark" ? "dark" : "light";
    return normalizedSystem;
  }, [preference, systemScheme]);

  const setPreference = useCallback(async (next) => {
    setPreferenceState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggle = useCallback(() => {
    setPreference(scheme === "dark" ? "light" : "dark");
  }, [scheme, setPreference]);

  const value = useMemo(
    () => ({
      scheme,
      preference,
      loaded,
      setPreference,
      toggle,
    }),
    [scheme, preference, loaded, setPreference, toggle]
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  return ctx;
}
