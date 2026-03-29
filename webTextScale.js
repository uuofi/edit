import { Platform, StyleSheet } from "react-native";

export const DESKTOP_TEXT_SCALE = 1.2;

function scaleFontSize(value) {
  return typeof value === "number" ? value * DESKTOP_TEXT_SCALE : value;
}

function scaleStyleObject(style) {
  if (!style || typeof style !== "object") return style;
  if (Array.isArray(style)) return style.map(scaleStyleObject);

  const next = { ...style };
  for (const key of Object.keys(next)) {
    const value = next[key];
    if (key === "fontSize") {
      next[key] = scaleFontSize(value);
    } else if (value && typeof value === "object") {
      next[key] = scaleStyleObject(value);
    }
  }

  return next;
}

if (Platform.OS === "web" && !globalThis.__desktopTextScaleApplied) {
  const originalCreate = StyleSheet.create.bind(StyleSheet);
  StyleSheet.create = (styles) => originalCreate(scaleStyleObject(styles));
  globalThis.__desktopTextScaleApplied = true;
}
