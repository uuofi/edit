import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from "@react-navigation/native";

export const lightColors = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#F3F4F6",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  primary: "#1e4980",
  primaryDark: "#1e4980",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  placeholder: "#9CA3AF",
  overlay: "rgba(0,0,0,0.35)",
  card: "#FFFFFF",
  inputBg: "#F9FAFB",
};

export const darkColors = {
  background: "#0F172A",
  surface: "#1E293B",
  surfaceAlt: "#334155",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  border: "#475569",
  primary: "#38BDF8",
  primaryDark: "#1e4980",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  placeholder: "#64748B",
  overlay: "rgba(0,0,0,0.65)",
  card: "#1E293B",
  inputBg: "#1E293B",
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
