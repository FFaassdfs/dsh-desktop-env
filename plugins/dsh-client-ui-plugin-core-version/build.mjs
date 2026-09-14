// build.mjs — generate lib/client.js from src/bundle.template.js.
// (Keep the generated file in sync after every template edit: node build.mjs)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(here, "src", "bundle.template.js"), "utf8");
if (!template.includes("window.__ModuleLoader__.load")) {
	throw new Error("template is not a ModuleLoader bundle");
}
writeFileSync(join(here, "lib", "client.js"), template);
console.log("built lib/client.js (" + template.length + " bytes)");
