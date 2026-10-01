import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--text-primary)",
        surface: "var(--surface)",
        "surface-elevated": "var(--surface-elevated)",
        "border-clipper": "var(--border)",
        "border-subtle": "var(--border-subtle)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          hover: "var(--accent-hover)",
        },
        cyan: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        }
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        'cyan-glow': '0 0 20px -3px rgba(6, 182, 212, 0.3)',
        'cyan-sm': '0 0 10px -2px rgba(6, 182, 212, 0.25)',
        'surface': '0 4px 20px -2px rgba(0, 0, 0, 0.25)',
      },
      transitionDuration: {
        '180': '180ms',
      }
    },
  },
  plugins: [],
};
export default config;
