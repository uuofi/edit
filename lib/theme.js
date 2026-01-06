import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from "@react-navigation/native";

export const lightColors = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#F3F4F6",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  primary: "#124257ff",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  placeholder: "#9CA3AF",
  overlay: "rgba(0,0,0,0.35)",
};

export const darkColors = {
  background: "#111827",
  surface: "#1F2937",
  surfaceAlt: "#0B1220",
  text: "#F9FAFB",
  textMuted: "#9CA3AF",
  border: "#374151",
  primary: "#124257ff",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  placeholder: "#6B7280",
  overlay: "rgba(0,0,0,0.55)",
};

export function getThemeColors(colorScheme) {
  return colorScheme === "dark" ? darkColors : lightColors;
}

export function getNavigationTheme(colorScheme) {
  const isDark = colorScheme === "dark";
  const base = isDark ? NavigationDarkTheme : NavigationDefaultTheme;
  const colors = getThemeColors(colorScheme);

  return {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      primary: colors.primary,
      text: colors.text,
      notification: colors.primary,
    },
  };
}
