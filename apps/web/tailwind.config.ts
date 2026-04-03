import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        akior: {
          cyan: "#00D4FF",
          navy: "#1A1A2E",
          orange: "#FF6B35",
          bg: "#0A0A0F",
          surface: "#12121A",
          border: "#1A1A28",
          text: "#E0E0E0",
          dim: "#555570",
          success: "#00FF88",
          warning: "#FFB800",
          error: "#FF3366",
        },
      },
    },
  },
  plugins: [],
};

export default config;
