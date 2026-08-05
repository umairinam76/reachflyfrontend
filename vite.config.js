import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  /**
   * Important:
   * Tell Vite that apps/web is the frontend project root.
   * index.html, src, public and .env files are located here.
   */
  root: __dirname,

  plugins: [react()],

  /**
   * Load frontend environment files from apps/web.
   */
  envDir: __dirname,

  /**
   * Vercel serves the application from the domain root.
   */
  base: "/",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },

  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
  },

  build: {
    /**
     * Your backend currently expects the frontend build here:
     *
     * dist/web
     */
    outDir: path.resolve(
      __dirname,
      "../../dist/web"
    ),

    emptyOutDir: true,
    sourcemap: false,

    rollupOptions: {
      input: path.resolve(
        __dirname,
        "index.html"
      ),
    },
  },
});