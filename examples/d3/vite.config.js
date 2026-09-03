import { defineConfig } from "vite";
import jsox from "@js-ox/compiler/vite";

export default defineConfig({ plugins: [jsox()], base: "./", server: { port: 5184, strictPort: true } });
