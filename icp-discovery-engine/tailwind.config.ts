import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#08080d",
        surface: "#0f0f17",
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          strong: "rgba(139,92,246,0.35)",
        },
        violet: {
          50: "#f5f3ff",
          200: "#ddd2ff",
          300: "#c4b0ff",
          400: "#a480ff",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          900: "#2e1065",
        },
      },
      backgroundImage: {
        "glow-purple":
          "radial-gradient(60% 50% at 50% 0%, rgba(124,58,237,0.35) 0%, rgba(124,58,237,0) 70%)",
        "cta-gradient": "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
