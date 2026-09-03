import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import jsox from "@js-ox/compiler/vite";

export default defineConfig({ plugins: [svelte(), jsox()], base: "./", server: { port: 5199, strictPort: true } });
