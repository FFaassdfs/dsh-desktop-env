// Build script: injects config.json into src/bundle.template.js and writes the
// self-contained client bundle to lib/client.js.
//
// Usage: node build.mjs   (or: npm run build inside the package dir)
//
// Keep config.json as the editable UI-config source; run this script after any
// change, then re-install the package (see HANDOVER.md 路径C) and restart dsh.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(here, "src", "bundle.template.js"), "utf8");
const config = JSON.parse(readFileSync(join(here, "config.json"), "utf8"));

const placeholder = "/*__CONFIG_JSON__*/";
if (!template.includes(placeholder)) {
  throw new Error("bundle.template.js is missing the __CONFIG_JSON__ placeholder");
}

const bundle = template.replace(placeholder, JSON.stringify(config));

const outPath = join(here, "lib", "client.js");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, bundle, "utf8");
console.log(`built ${outPath} (${bundle.length} bytes, config keys: ${Object.keys(config).join(", ")})`);
