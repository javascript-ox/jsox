import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pagesDir = dirname(fileURLToPath(import.meta.url));
const root = join(pagesDir, "..", "..");
const site = join(root, "_site");
const pagesDist = join(pagesDir, "dist");
const examplesDir = join(root, "examples");

await rm(site, { recursive: true, force: true });
await mkdir(site, { recursive: true });
await cp(pagesDist, site, { recursive: true });

for (const name of await readdir(examplesDir)) {
  const dist = join(examplesDir, name, "dist");
  try {
    const info = await stat(dist);
    if (!info.isDirectory()) continue;
  } catch {
    continue;
  }
  const dest = join(site, "examples", name);
  await mkdir(dest, { recursive: true });
  await cp(dist, dest, { recursive: true });
  console.log(`copied examples/${name}/dist -> _site/examples/${name}`);
}

console.log(`site assembled at ${site}`);
