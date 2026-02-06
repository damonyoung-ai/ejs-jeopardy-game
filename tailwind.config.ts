import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        jeopardyBlue: "#0b2a66",
        jeopardyGold: "#f5d76e",
        deepBlue: "#071a3b",
        panelBlue: "#0e3b8c"
      },
      boxShadow: {
        glow: "0 0 30px rgba(245, 215, 110, 0.35)"
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui"]
      },
      keyframes: {
        flipIn: {
          "0%": { transform: "rotateX(90deg)", opacity: "0" },
          "100%": { transform: "rotateX(0deg)", opacity: "1" }
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 0 rgba(245, 215, 110, 0.0)" },
          "50%": { boxShadow: "0 0 30px rgba(245, 215, 110, 0.4)" }
        }
      },
      animation: {
        flipIn: "flipIn 0.5s ease",
        glowPulse: "glowPulse 1.8s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
