import { defineConfig } from "vite";
import jsox from "@jsox/compiler/vite";

export default defineConfig({
  plugins: [jsox()],
  base: "./",
  server: { port: 5180, strictPort: true },
});