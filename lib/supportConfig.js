export const CONTACT_LINKS = {
  whatsapp: "https://wa.me/9647817706168",
  telegram: "https://t.me/medicareiq",
  instagram: "https://www.instagram.com/medicare.iq/",
  facebook: "https://www.facebook.com/share/184GkSfg6V/?mibextid=wwXIfr",
  email: "mailto:medicare410@gmail.com",
};

const normalizeWhatsAppNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("964")) return digits;
  if (digits.startsWith("0")) return `964${digits.slice(1)}`;
  return digits;
};

const extractWaNumberFromLink = (url) => {
  const value = String(url || "").trim();
  if (!value) return "";

  const match = value.match(/wa\.me\/([^?/#]+)/i);
  const rawNumber = match ? match[1] : value;
  return normalizeWhatsAppNumber(rawNumber);
};

export const getSupportWhatsAppNumber = () =>
  extractWaNumberFromLink(CONTACT_LINKS.whatsapp);
