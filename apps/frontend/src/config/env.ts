export const ENV = {
  API_KEY: import.meta.env.VITE_API_KEY || "",
  API_URL: import.meta.env.DEV ? "" : import.meta.env.VITE_API_URL,
} as const;
