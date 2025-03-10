export const ENV = {
  API_URL:
    import.meta.env.MODE === "development"
      ? "/api"
      : import.meta.env.VITE_API_URL || "",
} as const;
