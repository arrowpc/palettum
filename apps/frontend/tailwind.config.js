/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "#e2e8f0",
        input: "#e2e8f0",
        ring: "#3b82f6",
        background: "#ffffff",
        foreground: "#0f172a",

        upload: {
          50: "#fefefe",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          "active-bg": "#eff6ff",
          "active-border": "#3b82f6",
          "active-text": "#3b82f6",
        },

        control: {
          DEFAULT: "#ffffff",
          focus: "#3b82f6",
          hover: "#f9fafb",
          disabled: "#f1f5f9",
          label: "#4b5563",
          border: "#e2e8f0",
        },

        icon: {
          active: "#ffffff",
          inactive: "#64748b",
          disabled: "#9ca3af",
        },

        overlay: {
          background: "rgba(0, 0, 0, 0.5)",
          padding: "1rem",
          zIndex: "50",
        },
        modal: {
          overlay: "rgba(0, 0, 0, 0.5)",
          background: "#ffffff",
          border: "#e5e7eb",
          title: "#1f2937",
          close: {
            DEFAULT: "#6b7280",
            hover: "#374151",
          },
        },

        picker: {
          tile: {
            border: "#e5e7eb",
            overlay: {
              DEFAULT: "rgba(0, 0, 0, 0)",
              hover: "rgba(0, 0, 0, 0.2)",
            },
          },
          tool: {
            active: {
              background: "#3b82f6",
              text: "#ffffff",
              hover: "#2563eb",
              border: "#3b82f6",
            },
            inactive: {
              background: "#ffffff",
              text: "#6b7280",
              hover: "#f9fafb",
              border: "#e5e7eb",
            },
          },
        },
        dropdown: {
          background: "#ffffff",
          hover: "#f9fafb",
          border: "#e5e7eb",
          ring: "#3b82f6",
          text: {
            primary: "#374151",
            secondary: "#6b7280",
            muted: "#9ca3af",
          },
          icon: {
            DEFAULT: "#9ca3af",
            hover: "#6b7280",
          },
        },

        palette: {
          item: {
            background: "#ffffff",
            hover: "#f9fafb",
            border: "#ffffff",
          },
          preview: {
            more: {
              background: "#f3f4f6",
              text: "#6b7280",
            },
          },
        },

        search: {
          background: "#ffffff",
          border: "#e5e7eb",
          placeholder: "#9ca3af",
          icon: "#9ca3af",
          ring: "#3b82f6",
        },

        action: {
          primary: "#3b82f6",
          "primary-hover": "#2563eb",
          secondary: "#ffffff",
          "secondary-hover": "#f1f5f9",
          disabled: "#e2e8f0",
        },

        primary: {
          DEFAULT: "#3b82f6",
          foreground: "#ffffff",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },

        secondary: {
          DEFAULT: "#f1f5f9",
          foreground: "#0f172a",
        },

        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },

        muted: {
          DEFAULT: "#f1f5f9",
          foreground: "#64748b",
        },

        accent: {
          DEFAULT: "#f1f5f9",
          foreground: "#0f172a",
        },

        popover: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a",
        },

        card: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a",
        },

        gray: {
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        },
      },

      maxWidth: {
        "palette-name": "200px",
      },

      spacing: {
        "color-square": "1.25rem",
      },

      boxShadow: {
        dropdown:
          "0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)",
        control: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },

      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shake: "shake 0.3s ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
