import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#f0fdfa",
        surface: "#f8f9ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4ff",
        "surface-container": "#e5eeff",
        "surface-container-high": "#dce9ff",
        "on-surface": "#0b1c30",
        "on-surface-variant": "#3d4947",
        outline: "#6d7a77",
        "outline-variant": "#bcc9c6",
        primary: "#0d9488",
        "on-primary": "#ffffff",
        "primary-container": "#115e59",
        "on-primary-container": "#f4fffc",
        "primary-fixed": "#89f5e7",
        secondary: "#5c5f61",
        "secondary-container": "#e0e3e5",
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
      },
      spacing: {
        xs: "4px",
        sm: "12px",
        md: "24px",
        lg: "48px",
        xl: "80px",
        "container-max": "1120px",
      },
      boxShadow: {
        soft: "0px 4px 20px rgba(0, 0, 0, 0.04)",
        modal: "0px 12px 32px rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;