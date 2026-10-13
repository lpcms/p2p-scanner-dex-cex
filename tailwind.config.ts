import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#080b10",      // чуть темнее основной фон
          card: "#141a23",         // карточки заметнее на фоне
          elevated: "#1b222d",     // ещё чуть светлее
          hover: "#252d3a",        // более выраженный ховер
        },
        border: {
          DEFAULT: "#2c3645",      // заметнее границы (было #1f2632)
          strong: "#3d4a5c",       // более акцентные границы
        },
        text: {
          primary: "#f1f5fb",      // ярче основной (было #e8edf5)
          secondary: "#aab5c7",    // ярче вторичный (было #9ba6b8)
          muted: "#8590a3",        // подтянул до WCAG AA 4.5:1 (было #5d6878 — 4.0:1)
        },
        accent: {
          green: "#34d770",        // насыщенее (было #22c55e)
          "green-bg": "rgba(52, 215, 112, 0.12)",
          red: "#ff5757",          // насыщенее (было #ef4444)
          "red-bg": "rgba(255, 87, 87, 0.12)",
          yellow: "#fbbf24",       // насыщенее (было #eab308)
          blue: "#5b9bff",         // насыщенее (было #3b82f6)
        },
      },
      fontFamily: {
        sans: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Arial",
          "sans-serif",
        ],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
