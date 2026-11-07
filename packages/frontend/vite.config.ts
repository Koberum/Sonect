import { readFileSync } from "node:fs";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const { version } = JSON.parse(
  readFileSync(path.resolve(__dirname, "./package.json"), "utf-8"),
) as { version: string };

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/player": {
        target: "http://localhost:3000",
        bypass(req) {
          // `/player` is both the mobile player page and the playback API
          // prefix. Document navigations must load the SPA, not the API.
          if (
            req.method === "GET" &&
            req.headers.accept?.includes("text/html")
          ) {
            return "/index.html";
          }
        },
      },
      "/catalog": "http://localhost:3000",
      "/playlists": {
        target: "http://localhost:3000",
        bypass(req) {
          // `/playlists` is both the playlists page and the API prefix.
          // Document navigations must load the SPA, not the API.
          if (
            req.method === "GET" &&
            req.headers.accept?.includes("text/html")
          ) {
            return "/index.html";
          }
        },
      },
      "/covers": "http://localhost:3000",
      "/waveforms": "http://localhost:3000",
      "/stream": "http://localhost:3000",
      "/system": "http://localhost:3000",
      "/dashboard": "http://localhost:3000",
      "/profiles": "http://localhost:3000",
      "/auth": "http://localhost:3000",
      "/likes": "http://localhost:3000",
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@tanstack/react-query-devtools")) return undefined;
            if (id.includes("@tanstack")) return "vendor-query";
            // Specific packages before the generic react match, which would
            // otherwise swallow lucide-react, @radix-ui/* and react-i18next.
            if (id.includes("lucide-react") || id.includes("radix-ui"))
              return "vendor-ui";
            if (id.includes("i18next")) return "vendor-i18n";
            if (id.includes("react")) return "vendor-react";
            return "vendor-other";
          }
        },
      },
    },
  },
});
