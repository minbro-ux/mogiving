import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        toss: {
          blue: "#0064FF",
          "blue-dark": "#0050CC",
          "blue-light": "#E8F1FF",
          red: "#F04452",
          "red-light": "#FFEEEE",
          green: "#03B26C",
          "green-light": "#E5F8EF",
          orange: "#FE9800",
          "orange-light": "#FFF3E0",
        },
        grey: {
          50: "#F9FAFB",
          100: "#F2F4F6",
          200: "#E5E8EB",
          300: "#D1D6DB",
          400: "#B0B8C1",
          500: "#8B95A1",
          600: "#6B7684",
          700: "#4E5968",
          800: "#333D4B",
          900: "#191F28",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Apple SD Gothic Neo",
          "sans-serif",
        ],
      },
      keyframes: {
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "toast-in": {
          from: { opacity: "0", transform: "translate(-50%, 12px)" },
          to: { opacity: "1", transform: "translate(-50%, 0)" },
        },
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "sheet-up": "sheet-up 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
        "fade-in": "fade-in 0.2s ease-out",
        "toast-in": "toast-in 0.25s ease-out",
        pop: "pop 0.45s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
