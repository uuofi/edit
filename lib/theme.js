import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from "@react-navigation/native";

// Aura color palette:
//   Aura Teal  #7BBFC1   Aura Slate #506173
//   Muted Pink #BFABA1   Muted Pink #BFA6A1
//   Muted Grey #A7D1BA   Gold       #A7818A   Gold #BBCEB9

export const lightColors = {
  background: "#F5F7F8",
  surface: "#FFFFFF",
  surfaceAlt: "#EEF2F4",
  text: "#506173", // Aura Slate
  textMuted: "#8B97A3",
  border: "#E4E9EC",
  primary: "#7BBFC1", // Aura Teal
  primaryDark: "#5FA8AA",
  success: "#7FB9A0",
  warning: "#CDA349",
  danger: "#E2574C",
  placeholder: "#A6B0BB",
  overlay: "rgba(80,97,115,0.35)",
  card: "#FFFFFF",
  inputBg: "#F0F3F4",
  // Aura accents
  mutedPink: "#BFABA1",
  mutedRose: "#BFA6A1",
  mauve: "#A7818A",
  sage: "#A7D1BA",
  paleSage: "#BBCEB9",
};

export const darkColors = {
  background: "#1B2530",
  surface: "#243140",
  surfaceAlt: "#2E3D4E",
  text: "#E8EDF1",
  textMuted: "#9DAAB6",
  border: "#3A4A5B",
  primary: "#7BBFC1", // Aura Teal
  primaryDark: "#5FA8AA",
  success: "#A7D1BA",
  warning: "#D9B45E",
  danger: "#EF6E64",
  placeholder: "#6B7785",
  overlay: "rgba(0,0,0,0.65)",
  card: "#243140",
  inputBg: "#243140",
  // Aura accents
  mutedPink: "#BFABA1",
  mutedRose: "#BFA6A1",
  mauve: "#A7818A",
  sage: "#A7D1BA",
  paleSage: "#BBCEB9",
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
