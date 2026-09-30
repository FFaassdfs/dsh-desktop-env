import { defineConfig } from "vite";

// The assistant is a single small page; no framework, no React. The Wails dev
// server needs a fixed port so the Go side can attach to it.
export default defineConfig({
  server: { port: 34115, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
});
