import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    root: "apps/web",
    plugins: [react()],
    publicDir: "public",
    server: {
      port: 5173,
      proxy: env.VITE_API_URL ? undefined : {
        "/api": "http://localhost:8787"
      }
    },
    build: {
      outDir: "../../dist/web",
      emptyOutDir: true,
      sourcemap: true
    }
  };
});
