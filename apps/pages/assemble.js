import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pagesDir = dirname(fileURLToPath(import.meta.url));
const root = join(pagesDir, "..", "..");
const site = join(root, "_site");
const pagesDist = join(pagesDir, "dist");

await rm(site, { recursive: true, force: true });
await mkdir(site, { recursive: true });
await cp(pagesDist, site, { recursive: true });
console.log(`site assembled at ${site}`);
