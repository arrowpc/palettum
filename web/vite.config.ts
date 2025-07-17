import fs from "node:fs";
import mime from "mime";
import path from "node:path";
import { defineConfig, type PluginOption, type UserConfig } from "vite";
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
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith("/_libav/")) return next();
      const filename = req.url.slice("/_libav/".length).split("?")[0];
      for (const pkg of LIBAV_PKGS) {
        const filePath = path.join(
          __dirname,
          "node_modules",
          pkg,
          "dist",
          filename,
        );
        if (!fs.existsSync(filePath)) continue;
        const type = mime.getType(filename);
        if (type) res.setHeader("Content-Type", type);
        fs.createReadStream(filePath).pipe(res);
        return;
      }
      next();
    });
  },
  async generateBundle() {
    const outDir = path.join(__dirname, "dist", "_libav");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    for (const pkg of LIBAV_PKGS) {
      const distDir = path.join(__dirname, "node_modules", pkg, "dist");
      if (!fs.existsSync(distDir)) continue;
      for (const file of fs.readdirSync(distDir)) {
        fs.copyFileSync(path.join(distDir, file), path.join(outDir, file));
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

const ReactCompilerConfig = { target: "19" };

export default defineConfig(({ command }): UserConfig => {
  const isDev = command === "serve";

  const libavAliases = [
    {
      find: "@libav.js/variant-webcodecs",
      replacement: isDev
        ? path.resolve(
            __dirname,
            "node_modules/@libav.js/variant-webcodecs/dist/libav-webcodecs.mjs",
          )
        : "/_libav/libav-webcodecs.mjs",
    },
    {
      find: "libavjs-webcodecs-bridge",
      replacement: isDev
        ? path.resolve(
            __dirname,
            "node_modules/libavjs-webcodecs-bridge/dist/libavjs-webcodecs-bridge.mjs",
          )
        : "/_libav/libavjs-webcodecs-bridge.mjs",
    },
    {
      find: "libavjs-webcodecs-polyfill",
      replacement: isDev
        ? path.resolve(
            __dirname,
            "node_modules/libavjs-webcodecs-polyfill/dist/libavjs-webcodecs-polyfill.mjs",
          )
        : "/_libav/libavjs-webcodecs-polyfill.mjs",
    },
  ];

  return {
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
      alias: [
        { find: "@", replacement: path.resolve(__dirname, "./src") },
        { find: "palettes", replacement: PALETTES_PATH },
        { find: "palettum", replacement: PALETTUM_PATH },
        ...libavAliases,
      ],
    },

    optimizeDeps: {
      exclude: LIBAV_PKGS,
    },

    server: {
      fs: {
        allow: [
          path.resolve(__dirname),
          path.resolve(__dirname, "node_modules"),
        ],
      },
    },

    build: {
      rollupOptions: {
        external: (id) => id.startsWith("/_libav/"),
      },
    },

    worker: {
      format: "es",
      plugins: () => [wasm(), topLevelAwait()],
      rollupOptions: {
        external: (id) => id.startsWith("/_libav/"),
      },
    },
  };
});
