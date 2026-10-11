import type { Config } from "tailwindcss";

/** پیکربندی Tailwind — تم تیره مدرن با افکت شیشه‌ای و فونت وزیرمتن */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Vazirmatn", "Tahoma", "sans-serif"]
      },
      colors: {
        night: {
          950: "#070b14",
          900: "#0b1120",
          800: "#111a2e",
          700: "#1a2740"
        },
        neon: {
          cyan: "#22d3ee",
          blue: "#60a5fa",
          violet: "#a78bfa",
          pink: "#f472b6",
          green: "#34d399",
          amber: "#fbbf24",
          red: "#f87171"
        }
      },
      boxShadow: {
        glow: "0 0 24px rgba(34, 211, 238, 0.35)",
        "glow-violet": "0 0 24px rgba(167, 139, 250, 0.35)",
        "glow-red": "0 0 24px rgba(248, 113, 113, 0.45)"
      },
      keyframes: {
        "orb-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.06)", opacity: "0.92" }
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "blink-caret": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" }
        }
      },
      animation: {
        "orb-pulse": "orb-pulse 2.4s ease-in-out infinite",
        "fade-up": "fade-up 0.35s ease-out both",
        "blink-caret": "blink-caret 0.9s step-end infinite"
      }
    }
  },
  plugins: []
};

export default config;
