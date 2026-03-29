// lib/cleanArabicText.js
export default function cleanArabicText(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "") // Remove RTL/LTR marks
    .trim();
}
