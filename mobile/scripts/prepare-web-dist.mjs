// Runs after `expo export -p web`. Makes dist/ deployable as a static single-page app:
// 1. Expo puts font and icon files under dist/assets/node_modules/..., but the Vercel CLI never
//    uploads folders named node_modules, so those requests fell through to index.html and the app
//    sat on a blank screen waiting for its fonts. Move them to assets/vendor and fix the references.
// 2. Write vercel.json so every route (e.g. /sign-up) serves the app.
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
const from = join(dist, "assets/node_modules");
const to = join(dist, "assets/vendor");

if (existsSync(from)) renameSync(from, to);

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(js|html|json|css)$/.test(name)) {
      const text = readFileSync(path, "utf8");
      if (text.includes("assets/node_modules/")) {
        writeFileSync(path, text.replaceAll("assets/node_modules/", "assets/vendor/"));
      }
    }
  }
}
walk(dist);

writeFileSync(
  join(dist, "vercel.json"),
  JSON.stringify({ rewrites: [{ source: "/(.*)", destination: "/index.html" }] }, null, 2) + "\n",
);
console.log("dist/ ready: assets moved to assets/vendor, vercel.json written");
