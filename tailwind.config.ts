import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./config/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surfaceAlt: "var(--surface-alt)",
        border: "var(--border)",
        text: "var(--text)",
        textMuted: "var(--text-muted)",
        primary: "var(--primary)",
        primaryText: "var(--primary-text)",
        primaryGlow: "var(--primary-glow)",
        secondary: "var(--secondary)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px var(--primary), 0 0 18px -2px var(--primary-glow)",
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 10px 30px -12px rgba(0,0,0,0.7)",
      },
      borderRadius: {
        xl2: "1.1rem",
      },
    },
  },
  plugins: [],
};
export default config;
