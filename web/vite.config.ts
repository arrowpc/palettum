import fs from "node:fs";
import mime from "mime";
import path from "node:path";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

const PALETTES_PATH = path.resolve(__dirname, "../palettes");
const PALETTUM_PATH = path.resolve(__dirname, "./src/wasm/pkg");

const LIBAV_PKG = "@libav.js/variant-webcodecs";
const LIBAV_DIST = path.join(__dirname, "node_modules", LIBAV_PKG, "dist");

const exposeLibAV: PluginOption = {
  name: "vite-libav.js",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/_libav/")) return next();

      const filename = req.url.replace("/_libav/", "").split("?")[0];
      const filePath = path.join(LIBAV_DIST, filename);

      if (!fs.existsSync(filePath)) return next();

      const fileType = mime.getType(filename);
      if (fileType) res.setHeader("Content-Type", fileType);

      fs.createReadStream(filePath).pipe(res);
    });
  },
  async generateBundle(_, _bundle) {
    // Copy all dist files to dist/_libav at build time
    const outDir = path.join(__dirname, "dist", "_libav");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    for (const file of fs.readdirSync(LIBAV_DIST)) {
      fs.copyFileSync(path.join(LIBAV_DIST, file), path.join(outDir, file));
    }
  },
};

const enableCOEP: PluginOption = {
  name: "isolation",
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      next();
    });
  },
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    topLevelAwait(),
    enableCOEP,
    exposeLibAV,
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      palettes: PALETTES_PATH,
      palettum: PALETTUM_PATH,
    },
  },
  worker: {
    format: "es",
    plugins: () => [wasm(), topLevelAwait()],
  },
  optimizeDeps: {
    exclude: ["@libav.js/variant-webcodecs"],
  },
});
