// lib/authTheme.js
// Aura color palette — applied across the auth flow (Onboarding / Login /
// Signup / Role) and the new Home screen.
//
// Source palette:
//   Aura Teal  #7BBFC1   Aura Slate #506173
//   Muted Pink #BFABA1   Muted Pink #BFA6A1
//   Muted Grey #A7D1BA   Gold       #A7818A   Gold #BBCEB9

export const authColors = {
  // Brand (Aura Teal)
  primary: "#7BBFC1",
  primaryPressed: "#5FA8AA",
  primarySoft: "#E9F4F4", // tints: checkbox fill, soft circles, illustration panel
  primarySoftBorder: "#CFE6E6",

  // Surfaces
  background: "#F5F7F8",
  card: "#FFFFFF",
  inputBg: "#F0F3F4",
  inputBorder: "#E4E9EC",
  inputBorderFocus: "#7BBFC1",

  // Text (Aura Slate)
  heading: "#506173",
  body: "#5E6E7E",
  muted: "#8B97A3",
  onPrimary: "#FFFFFF",

  // Accents (rest of the Aura palette)
  slate: "#506173",
  mutedPink: "#BFABA1",
  mutedRose: "#BFA6A1",
  mauve: "#A7818A",
  sage: "#A7D1BA",
  paleSage: "#BBCEB9",

  // Misc
  border: "#E6EAEE",
  divider: "#E6EAEE",
  danger: "#E2574C",
  white: "#FFFFFF",
};

export default authColors;
