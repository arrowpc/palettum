/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    fontSize: {
      micro: "0.1875rem",
      "2micro": "0.25rem",
      "3micro": "0.3125rem",
      tiny: "0.375rem",
      "2tiny": "0.4375rem",
      xs: "0.4575rem",
      sm: "0.5825rem",
      base: "0.625rem",
      md: "0.6875rem",
      lg: "0.7rem",
      xl: "0.8125rem",
      "2xl": "0.875rem",
      "3xl": "1rem",
      "4xl": "1.125rem",
      "5xl": "1.85rem",
    },
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        background: {
          DEFAULT: "var(--background)",
          secondary: "var(--background-secondary)",
          tertiary: "var(--background-tertiary)",
        },
        foreground: {
          DEFAULT: "var(--foreground)",
          secondary: "var(--foreground-secondary)",
          muted: "var(--foreground-muted)",
        },
        border: {
          DEFAULT: "var(--border)",
          active: "var(--border-active)",
          hover: "var(--border-hover)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          hover: "var(--primary-hover)",
          active: "var(--primary-active)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
          hover: "var(--secondary-hover)",
          active: "var(--secondary-active)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          hover: "var(--accent-hover)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
          hover: "var(--destructive-hover)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
          hover: "var(--card-hover)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        input: {
          DEFAULT: "var(--input)",
          focus: "var(--input-focus)",
          disabled: "var(--input-disabled)",
        },
        ring: {
          DEFAULT: "var(--ring)",
          focus: "var(--ring-focus)",
        },
        icon: {
          active: "var(--icon-active)",
          inactive: "var(--icon-inactive)",
          disabled: "var(--icon-disabled)",
        },
      },
      spacing: {
        xs: "0.25rem",
        sm: "0.5rem",
        md: "1rem",
        lg: "1.5rem",
        xl: "2rem",
        "2xl": "2.5rem",
        "color-square": "1.25rem",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        inner: "var(--shadow-inner)",
      },
      borderRadius: {
        none: "0",
        sm: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
      maxWidth: {
        "palette-name": "200px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-5px)" },
          "50%": { transform: "translateX(5px)" },
          "75%": { transform: "translateX(-5px)" },
        },
        "pixel-fade-in": {
          from: {
            opacity: "0",
            transform: "scale(0.8)",
            boxShadow: "0 0 0 0 rgba(255, 255, 255, 0.2)",
          },
          to: {
            opacity: "1",
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(255, 255, 255, 0)",
          },
        },
        rotate: {
          "0%": { transform: "rotate(0deg) scale(2)" },
          "100%": { transform: "rotate(-360deg) scale(2)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shake: "shake 0.3s ease-in-out",
        "pixel-fade-in": "pixel-fade-in 0.4s ease-out forwards",
        "new-suggestion-border": "new-suggestion-pulse 1.5s ease-out",
        rotate: "rotate 1.5s linear infinite",
      },
      transitions: {
        default: "transition-colors duration-200 ease-in-out",
        colors: "transition-colors duration-200 ease-in-out",
        opacity: "transition-opacity duration-200 ease-in-out",
        transform: "transition-transform duration-200 ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
