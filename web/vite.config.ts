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

const LIBAV_PKGS = [
  "@libav.js/variant-webcodecs",
  "libavjs-webcodecs-bridge",
  "libavjs-webcodecs-polyfill",
];

const exposeLibAV: PluginOption = {
  name: "vite-libav.js",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/_libav/")) return next();

      const filename = req.url.replace("/_libav/", "").split("?")[0];
      for (const pkg of LIBAV_PKGS) {
        const filePath = path.join(
          __dirname,
          "node_modules",
          pkg,
          "dist",
          filename,
        );
        if (fs.existsSync(filePath)) {
          const fileType = mime.getType(filename);
          if (fileType) res.setHeader("Content-Type", fileType);
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }
      next();
    });
  },
  async generateBundle(_, _bundle) {
    // Copy all dist files to dist/_libav at build time
    const outDir = path.join(__dirname, "dist", "_libav");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    for (const pkg of LIBAV_PKGS) {
      const libavDist = path.join(__dirname, "node_modules", pkg, "dist");
      if (fs.existsSync(libavDist)) {
        for (const file of fs.readdirSync(libavDist)) {
          fs.copyFileSync(path.join(libavDist, file), path.join(outDir, file));
        }
      }
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

const ReactCompilerConfig = {
  target: "19",
};

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
      },
    }),
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
    exclude: LIBAV_PKGS,
  },
});
