import { heroui } from "@heroui/react";

// Keep these values in sync with the color tokens in globals.css.
const neutral = {
  50: "#1c1c1c",
  100: "#2a2a2a",
  200: "#333333",
  300: "#3a3a3a",
  400: "#8f8f8f",
  500: "#b3b3b3",
  600: "#c8c8c8",
  700: "#d9d9d9",
  800: "#ececec",
  900: "#f4f4f4",
};

const accent = {
  50: "#2c251b",
  100: "#41331e",
  200: "#5a4323",
  300: "#7c5a28",
  400: "#b27e32",
  500: "#e9a23b",
  600: "#eaaf5b",
  700: "#eabe7e",
  800: "#ebcda2",
  900: "#ebdac2",
};

export default heroui({
  themes: {
    dark: {
      colors: {
        background: { DEFAULT: "#171717" },
        foreground: { ...neutral, DEFAULT: "#ececec" },
        divider: { DEFAULT: "#333333" },
        focus: { DEFAULT: "#e9a23b" },
        overlay: { DEFAULT: "#141414" },
        content1: { DEFAULT: "#202020", foreground: "#ececec" },
        content2: { DEFAULT: "#2a2a2a", foreground: "#ececec" },
        content3: { DEFAULT: "#333333", foreground: "#ececec" },
        content4: { DEFAULT: "#3a3a3a", foreground: "#ececec" },
        default: { ...neutral, DEFAULT: "#3a3a3a", foreground: "#ececec" },
        primary: { ...accent, DEFAULT: "#e9a23b", foreground: "#1a1a1a" },
        secondary: { ...neutral, DEFAULT: "#b3b3b3", foreground: "#1a1a1a" },
      },
    },
  },
});
