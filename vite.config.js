import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "client",
  publicDir: false,
  base: "/app/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../public/app",
    emptyOutDir: true
  }
});
