import { defineConfig } from "vite";
import jsox from "@js-ox/compiler/vite";
import config from "../../jsox.config.js";

export default defineConfig({ plugins: [jsox({ config })], base: "./", server: { port: 5198, strictPort: true } });
