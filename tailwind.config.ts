import type { Config } from "tailwindcss";

/** All colors resolve through CSS variables so the dark ⇄ light theme toggle
 *  (data-theme on <html>) flips the entire site — see globals.css. */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        sumi: {
          950: v("sumi-950"),
          900: v("sumi-900"),
          800: v("sumi-800"),
          700: v("sumi-700"),
          600: v("sumi-600"),
        },
        paper: {
          DEFAULT: v("paper"),
          bright: v("paper-bright"),
          dim: v("paper-dim"),
          faint: v("paper-faint"),
        },
        copper: {
          DEFAULT: v("copper"),
          bright: v("copper-bright"),
          dim: v("copper-dim"),
        },
        moss: {
          DEFAULT: v("moss"),
          dim: v("moss-dim"),
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.35em",
      },
      keyframes: {
        kenburns: {
          "0%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        kenburns: "kenburns 8s ease-out forwards",
        fadeUp: "fadeUp 1s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
