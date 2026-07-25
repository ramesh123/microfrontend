import plugin from "tailwindcss/plugin";

const config = {
  content: [
    "src/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "./index.html",
    "./src/**/*.{js,ts,tsx,jsx}",
  ],
  important: false,
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        "muted": "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        "accent": "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        "destructive": "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        "ring": "hsl(var(--ring))",
        "background": "hsl(var(--background))",
        "foreground": "hsl(var(--foreground))",
        "card": "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        "popover": "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        "tooltip": "hsl(var(--tooltip))",
        "tooltip-foreground": "hsl(var(--tooltip-foreground))",
      },
      keyframes: {
        // Overlay animations
        overlayShow: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        overlayHide: {
          from: { opacity: 1 },
          to: { opacity: 0 },
        },

        // Content animations - now including both scale and clip in one animation
        contentShow: {
          from: {
            opacity: 0,
            transform: "translate(-50%, -50%) scale(0.95)",
            clipPath: "inset(50% 0)",
            boxShadow: "0 4px 8px -2px rgba(0, 0, 0, 0.1)", // Smaller shadow
          },
          to: {
            opacity: 1,
            transform: "translate(-50%, -50%) scale(1)",
            clipPath: "inset(0% 0)",
            boxShadow:
              "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          },
        },
        contentHide: {
          from: {
            opacity: 1,
            transform: "translate(-50%, -50%) scale(1)",
            clipPath: "inset(0% 0)",
            boxShadow:
              "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          },
          to: {
            opacity: 0,
            transform: "translate(-50%, -50%) scale(0.95)",
            clipPath: "inset(50% 0)",
            boxShadow: "0 4px 8px -2px rgba(0, 0, 0, 0.1)",
          },
        },
        wiggle: {
          "0%, 100%": { transform: "scale(100%)" },
          "50%": { transform: "scale(120%)" },
        },
        "border-beam": {
          "100%": {
            "offset-distance": "100%",
          },
        },
        "pulse-pink": {
          "0%, 100%": { backgroundColor: "hsla(var(--accent-pink), 1)" },
          "50%": { backgroundColor: "hsla(var(--accent-pink), 0.4)" },
        },
        /** Dashboard refresh overlay — shimmer bar + soft glow drift */
        "refresh-shimmer": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
        "refresh-orb": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.35" },
          "33%": { transform: "translate(8%, -6%) scale(1.08)", opacity: "0.55" },
          "66%": { transform: "translate(-6%, 4%) scale(0.96)", opacity: "0.45" },
        },
        "refresh-ring": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        // Animation definitions
        overlayShow: "overlayShow 400ms cubic-bezier(0.16, 1, 0.3, 1)",
        overlayHide: "overlayHide 500ms cubic-bezier(0.16, 1, 0.3, 1)",
        contentShow: "contentShow 400ms cubic-bezier(0.16, 1, 0.3, 1)",
        contentHide: "contentHide 500ms cubic-bezier(0.16, 1, 0.3, 1)",
        wiggle: "wiggle 150ms ease-in-out 1",
        "pulse-pink": "pulse-pink 2s linear infinite",
        "slow-wiggle": "wiggle 500ms ease-in-out 1",
        "border-beam": "border-beam calc(var(--duration)*1s) infinite linear",
        "refresh-shimmer": "refresh-shimmer 2.2s ease-in-out infinite",
        "refresh-orb": "refresh-orb 5s ease-in-out infinite",
        "refresh-ring": "refresh-ring 8s linear infinite",
      },
    },
  },
  plugins: [plugin(require("tw-animate-css")),
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".scrollbar-hide": {
          /* IE and Edge */
          "-ms-overflow-style": "none",
          /* Firefox */
          "scrollbar-width": "none",
          /* No reserved gutter next to content */
          "scrollbar-gutter": "auto",
          /* Safari and Chrome — must beat global *::-webkit-scrollbar { width/height: 8px !important } */
          "&::-webkit-scrollbar": {
            display: "none !important",
            width: "0 !important",
            height: "0 !important",
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            display: "none !important",
          },
          "&::-webkit-scrollbar-track": {
            display: "none !important",
          },
        },
        ".custom-scroll": {
          "&::-webkit-scrollbar": {
            width: "8px",
            height: "8px",
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: "hsl(var(--muted))",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "hsl(var(--border))",
            borderRadius: "999px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            backgroundColor: "hsl(var(--placeholder-foreground))",
          },
          "&::-webkit-scrollbar-corner": {
            backgroundColor: "transparent",
          },
          cursor: "auto",
        },
        ".dark .theme-attribution .react-flow__attribution": {
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          padding: "0px 5px",
        },
        ".dark .theme-attribution .react-flow__attribution a": {
          color: "black",
        },
      })
    }),
    tailwindcssTypography
  ],
};

export default config;