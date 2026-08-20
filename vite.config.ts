import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
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
      "/cursor-docs": {
        target: "https://cursor.com",
        changeOrigin: true,
        secure: true,

        /**
         * Removes the local proxy prefix before forwarding.
         */
        rewrite: (path) => path.replace(/^\/cursor-docs/, ""),
      },
    },
  },
});
