// Build script: injects dictionary.json into src/bundle.template.js and writes
// the self-contained client bundle to lib/client.js.
//
// Usage: node build.mjs   (or: npm run build inside the package dir)
//
// The browser half of dsh cannot read files, so the plain-language dictionary
// must live INSIDE the bundle. Keep dictionary.json as the editable source of
// truth; run this script after every dictionary change, then re-install the
// package (see HANDOVER.md) and restart dsh web.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(here, "src", "bundle.template.js"), "utf8");
const dictionary = JSON.parse(readFileSync(join(here, "dictionary.json"), "utf8"));

const placeholder = "/*__DICTIONARY_JSON__*/";
if (!template.includes(placeholder)) {
  throw new Error("bundle.template.js is missing the __DICTIONARY_JSON__ placeholder");
}

const injected = JSON.stringify(dictionary);
const bundle = template.replace(placeholder, injected);

const outPath = join(here, "lib", "client.js");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, bundle, "utf8");
console.log(`built ${outPath} (${bundle.length} bytes, ${Object.keys(dictionary).length} dictionary entries)`);
