// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        slate: {
          950: "#0B1120",
        },
        // ScreenNova brand tokens
        nova: {
          // Primaries
          ink: "#0F172A",
          body: "#475569",
          muted: "#94A3B8",
          border: "#E2E8F0",
          surface: "#F8FAFC",

          // Lavender accent
          lavender: {
            DEFAULT: "#818CF8",
            light: "#EEF2FF",
            mid: "#C7D2FE",
            deep: "#6366F1",
          },
          // Mint accent
          mint: {
            DEFAULT: "#34D399",
            light: "#ECFDF5",
            mid: "#A7F3D0",
            deep: "#059669",
          },
          // Warning / pending
          amber: {
            light: "#FFF7ED",
            mid: "#FDE68A",
            DEFAULT: "#F59E0B",
          },
          // Destructive
          rose: {
            light: "#FFF1F2",
            mid: "#FECDD3",
            DEFAULT: "#F43F5E",
          },
        },
      },
      backgroundImage: {
        // Mesh gradients for use in bg- utilities
        "nova-mesh": "radial-gradient(at 20% 15%, #C7D2FE 0%, transparent 55%), radial-gradient(at 85% 80%, #A7F3D0 0%, transparent 55%), radial-gradient(at 50% 50%, #FDE68A33 0%, transparent 60%)",
        "nova-cta": "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)",
        "nova-mint-cta": "linear-gradient(135deg, #34D399 0%, #059669 100%)",
        "nova-rose-cta": "linear-gradient(135deg, #FB7185 0%, #E11D48 100%)",
        "nova-score": "linear-gradient(90deg, #818CF855, #818CF8)",
        "nova-score-comm": "linear-gradient(90deg, #34D39955, #34D399)",
        "nova-score-conf": "linear-gradient(90deg, #FCD34D55, #FCD34D)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.5rem",
      },
      boxShadow: {
        glass: "0 2px 24px 0 rgba(100,116,139,0.06), 0 0 0 1px rgba(255,255,255,0.50) inset",
        "glass-lg": "0 8px 40px 0 rgba(100,116,139,0.10), 0 0 0 1px rgba(255,255,255,0.55) inset",
        cta: "0 4px 16px rgba(99,102,241,0.35)",
        "cta-mint": "0 4px 16px rgba(52,211,153,0.35)",
        "voice-pulse": "0 0 0 8px rgba(52,211,153,0.15)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "voice-ring": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.4" },
          "50%": { transform: "scale(1.4)", opacity: "0" },
        },
      },
      animation: {
        shimmer: "shimmer 2.4s linear infinite",
        "fade-up": "fade-up 0.5s ease both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "voice-ring": "voice-ring 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
