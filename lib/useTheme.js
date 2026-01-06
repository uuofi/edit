import { useColorScheme } from "react-native";
import { getNavigationTheme, getThemeColors } from "./theme";
import { useThemePreference } from "./ThemeProvider";

export function useAppTheme() {
  const ctx = useThemePreference();
  const system = useColorScheme();
  // Default to light; only use dark if context says dark (user setting) or system when preference=system.
  const fallback = "light";
  const raw = ctx?.scheme ?? fallback ?? (system === "dark" ? "dark" : "light");
  const scheme = raw === "dark" ? "dark" : "light";

  return {
    scheme,
    isDark: scheme === "dark",
    colors: getThemeColors(scheme),
    navigationTheme: getNavigationTheme(scheme),
  };
}
