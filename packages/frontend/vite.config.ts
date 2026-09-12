import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/mpd": "http://localhost:3000",
      "/catalog": "http://localhost:3000",
      "/playlists": "http://localhost:3000",
      "/covers": "http://localhost:3000",
      "/stream": "http://localhost:3000",
      "/system": "http://localhost:3000",
      "/dashboard": "http://localhost:3000",
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
            if (id.includes("react")) return "vendor-react";
            if (id.includes("lucide-react") || id.includes("radix-ui"))
              return "vendor-ui";
            if (id.includes("i18next")) return "vendor-i18n";
            return "vendor-other";
          }
        },
      },
    },
  },
});
