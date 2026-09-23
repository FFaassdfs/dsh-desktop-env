// Build script: injects config.json into src/bundle.template.js and writes the
// self-contained client bundle to lib/client.js.
//
// Usage: node build.mjs
//
// config.json is the single source of the shipped presets: every route profile
// the panel can install lives there, and this script bakes it into the bundle.
// The installed plugin payload is package.json + lib/**, so config.json does NOT
// travel with the plugin — a preset edit is therefore a rebuild + reinstall,
// never a runtime file read.
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

// Refuse to ship a preset that carries anything secret-shaped, and refuse a
// preset that could not survive validation at the settings boundary. This is the
// only guard between "a preset file" and "a credential leaked into git".
const SECRET_KEYS = new Set(["key", "apiKey", "api_key", "token", "secret", "password", "authorization"]);
const SECRET_PATTERNS = [
  /^sk-[A-Za-z0-9_-]{8,}$/,
  /^[A-Za-z0-9_-]{32,}$/
];
const ROUTES = new Set();
const problems = [];
for (const preset of config.presets ?? []) {
  const where = preset.route ?? "<missing route>";
  if (typeof preset.route !== "string" || !/^[a-z0-9][a-z0-9._-]*$/i.test(preset.route)) {
    problems.push(`${where}: route must be a non-empty settings key`);
  } else if (ROUTES.has(preset.route)) {
    problems.push(`${where}: duplicate route`);
  } else {
    ROUTES.add(preset.route);
  }
  if (typeof preset.baseURL !== "string" || !/^https?:\/\//i.test(preset.baseURL)) {
    problems.push(`${where}: baseURL must be an http(s) URL`);
  }
  if (typeof preset.api !== "string" || preset.api === "") problems.push(`${where}: api is required`);
  if (typeof preset.apiKeyEnv !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(preset.apiKeyEnv)) {
    problems.push(`${where}: apiKeyEnv must look like an environment-variable name`);
  }
  if (!Array.isArray(preset.models) || preset.models.length === 0) {
    problems.push(`${where}: at least one model is required`);
  }
  for (const model of preset.models ?? []) {
    if (typeof model?.id !== "string" || model.id === "") problems.push(`${where}: a model has no id`);
    for (const modality of model?.input ?? []) {
      if (modality !== "text" && modality !== "image") problems.push(`${where}/${model?.id}: unsupported modality ${modality}`);
    }
  }
  // Walk the whole preset for secret-shaped values (arrays and nested dicts too).
  const walk = (node, path) => {
    if (node === null || typeof node !== "object") return;
    for (const [field, value] of Object.entries(node)) {
      const at = `${path}.${field}`;
      if (SECRET_KEYS.has(field.toLowerCase())) problems.push(`${at}: secret-shaped field name`);
      if (typeof value === "string" && SECRET_PATTERNS.some((re) => re.test(value))) problems.push(`${at}: value looks like a credential`);
      walk(value, at);
    }
  };
  for (const [field, value] of Object.entries(preset)) {
    if (SECRET_KEYS.has(field.toLowerCase())) problems.push(`${where}.${field}: secret-shaped field name`);
    walk(value, `${where}.${field}`);
  }
}
if (problems.length > 0) {
  throw new Error("config.json refused:\n  - " + problems.join("\n  - "));
}

const bundle = template.replace(placeholder, JSON.stringify(config));

const outPath = join(here, "lib", "client.js");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, bundle, "utf8");
console.log(
  `built ${outPath} (${Buffer.byteLength(bundle, "utf8")} bytes, ${(config.presets ?? []).length} preset(s): ` +
  `${(config.presets ?? []).map((p) => p.route).join(", ")})`
);
