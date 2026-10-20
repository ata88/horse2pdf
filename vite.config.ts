import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
// The preview server (used by the E2E tests) enforces the same CSP as the desktop app.
const tauriConf = JSON.parse(readFileSync(new URL("./src-tauri/tauri.conf.json", import.meta.url), "utf8"));

// https://vite.dev/config/ – shared by the Tauri app, the browser build and Vitest.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  preview: {
    port: 4173,
    strictPort: true,
    headers: { "Content-Security-Policy": tauriConf.app.security.csp },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version) },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari15",
    chunkSizeWarningLimit: 4096,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    setupFiles: ["tests/setup.ts"],
  },
});
