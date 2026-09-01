import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },

  server: {
    proxy: {
      "/cursor-docs": {
        target: "https://cursor.com",
        changeOrigin: true,
        secure: true,
        rewrite: (requestPath) => requestPath.replace(/^\/cursor-docs/, ""),
      },

      "/deep-swe": {
        target: "https://deepswe.datacurve.ai",
        changeOrigin: true,
        secure: true,
        rewrite: (requestPath) => requestPath.replace(/^\/deep-swe/, ""),
      },

      "/frontier-code": {
        target: "https://cognition.com",
        changeOrigin: true,
        secure: true,
        rewrite: (requestPath) => requestPath.replace(/^\/frontier-code/, ""),
      },
    },
  },
});
