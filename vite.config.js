import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  publicDir: false,
  base: "/app/",
  build: {
    outDir: "../public/app",
    emptyOutDir: true
  }
});
