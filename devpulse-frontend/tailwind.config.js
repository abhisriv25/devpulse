/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "blob-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(24px, -18px) scale(1.08)" },
          "66%": { transform: "translate(-18px, 16px) scale(0.94)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        shine: {
          "0%": { transform: "translateX(-150%) skewX(-20deg)" },
          "100%": { transform: "translateX(250%) skewX(-20deg)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.6s ease-out both",
        "blob-drift": "blob-drift 14s ease-in-out infinite",
        "blob-drift-slow": "blob-drift 20s ease-in-out infinite",
        shake: "shake 0.4s ease-in-out",
        shine: "shine 1.1s ease-in-out",
      },
    },
  },
  plugins: [],
};
