import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import jsox from "@js-ox/compiler/vite";
import config from "../../jsox.config.js";

export default defineConfig({
  plugins: [svelte(), jsox({ config })],
  base: "./",
  server: { port: 5180, strictPort: true },
});
