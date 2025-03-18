import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === "development";
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: isDevelopment
      ? {
        host: true,
        port: 5173,
        proxy: {
          "/api": {
            target: "http://127.0.0.1:5001",
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ""),
            configure: (proxy, _options) => {
              proxy.on("error", (err) => console.log("proxy error", err));
              proxy.on("proxyReq", (_proxyReq, req) =>
                console.log("Sending Request:", req.method, req.url),
              );
              proxy.on("proxyRes", (proxyRes, req) =>
                console.log(
                  "Received Response:",
                  proxyRes.statusCode,
                  req.url,
                ),
              );
            },
          },
        },
      }
      : undefined,
  };
});
