// Install script for dsh-client-ui-plugin-project-explorer (HANDOVER 路径C).
//  1. Copies the package into $DSH_HOME/profiles/node_modules (delete-first to
//     avoid Copy-Item nesting, HANDOVER §7.10).
//  2. Appends an idempotent insert entry to profiles/web/cordis.patch.yml
//     (UTF-8, no BOM, preserves existing content).
//  3. Static verification: loader discovery conditions 1-4 from HANDOVER §2.3
//     (resolvable package, dsh.client declaration, exports["./client"],
//     host main exists) + patch YAML parses.
// Usage: node .work/install-project-explorer.mjs   (needs danger-full-access
// sandbox because it writes under $DSH_HOME).
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const SRC = "D:/opencode/001/dsh-desktop/plugins/dsh-client-ui-plugin-project-explorer";
const DSH_HOME = join(process.env.USERPROFILE, ".dsh");
const PACKAGE_NAME = "dsh-client-ui-plugin-project-explorer";
const PATCH_PATH = join(DSH_HOME, "profiles", "web", "cordis.patch.yml");
const PATCH_ENTRY = `\n# dsh-client-ui-plugin-project-explorer: right-side project file tree (HANDOVER 路径C).
# Package lives in $DSH_HOME/profiles/node_modules (manual install, see HANDOVER.md).
- insert:
    - id: plugin-project-explorer
      name: '${PACKAGE_NAME}'
`;

function fail(message) {
  console.error("INSTALL FAILED: " + message);
  process.exit(1);
}

// --- 1. copy package --------------------------------------------------------
const dst = join(DSH_HOME, "profiles", "node_modules", PACKAGE_NAME);
if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
copyFileSync(join(SRC, "package.json"), join(dst, "package.json"));
mkdirSync(join(dst, "lib"), { recursive: true });
for (const file of ["index.js", "client.js", "bring-explorer-front.ps1"]) {
  const srcFile = join(SRC, "lib", file);
  if (!existsSync(srcFile)) fail("missing " + srcFile);
  copyFileSync(srcFile, join(dst, "lib", file));
}
console.log("1. package copied -> " + dst);

// --- 2. patch entry ---------------------------------------------------------
let patch = readFileSync(PATCH_PATH, "utf8");
if (patch.includes("plugin-project-explorer")) {
  console.log("2. patch already contains the entry (skipped append)");
} else {
  patch = patch.replace(/\s+$/, "") + PATCH_ENTRY;
  writeFileSync(PATCH_PATH, patch, "utf8");
  console.log("2. patch entry appended -> " + PATCH_PATH);
}

// --- 3. static verification -------------------------------------------------
const profileDir = join(DSH_HOME, "profiles", "web");
const requireFromProfile = createRequire(join(profileDir, "package.json"));

// condition 1: package resolvable from the profile base
const pkgJsonPath = requireFromProfile.resolve(`${PACKAGE_NAME}/package.json`);
const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
console.log("3a. resolve OK -> " + pkgJsonPath);

// condition 2: dsh.client declaration
if (!pkg.dsh || !pkg.dsh.client || pkg.dsh.client.platform !== "web" || !Array.isArray(pkg.dsh.client.inject)) {
  fail("dsh.client declaration missing/wrong");
}
console.log("3b. dsh.client OK (platform=web, inject=" + pkg.dsh.client.inject.length + ")");

// condition 3: exports["./client"] exists and points at a real file
const clientExport = pkg.exports && pkg.exports["./client"];
if (!clientExport) fail("exports['./client'] missing");
const clientSpec = typeof clientExport === "string" ? clientExport : (clientExport.default || "");
const clientPath = join(dirname(pkgJsonPath), clientSpec);
if (!existsSync(clientPath)) fail("client bundle file missing: " + clientPath);
const clientSource = readFileSync(clientPath, "utf8");
if (!clientSource.includes("window.__ModuleLoader__.load")) fail("client bundle is not a ModuleLoader bundle");
console.log("3c. exports['./client'] OK -> " + clientPath + " (" + clientSource.length + " bytes)");

// condition 4: host main exists
const mainSpec = pkg.main || "lib/index.js";
const mainPath = join(dirname(pkgJsonPath), mainSpec);
if (!existsSync(mainPath)) fail("host main missing: " + mainPath);
console.log("3d. host main OK -> " + mainPath);

// patch YAML parses (js-yaml from the dsh install, if present)
let parsed = null;
try {
  const candidates = [
    join(profileDir, "node_modules", "js-yaml", "index.js"),
    join(DSH_HOME, "profiles", "node_modules", "js-yaml", "index.js"),
    "C:/Users/veken/nodejs/node-v24.16.0-win-x64/node_modules/@deepseek-ai/dsh/node_modules/js-yaml/index.js"
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const jsYaml = await import(pathToFileURL(candidate).href);
    const yamlMod = jsYaml.default ?? jsYaml;
    parsed = yamlMod.load(readFileSync(PATCH_PATH, "utf8"));
    break;
  }
} catch {
  // fall through
}
if (parsed === null) {
  console.log("3e. js-yaml not found — patch YAML check skipped");
} else {
  if (!Array.isArray(parsed)) fail("cordis.patch.yml top level is not an array");
  const ids = parsed.filter((e) => e && Array.isArray(e.insert)).flatMap((e) => e.insert.map((i) => i && i.id)).filter(Boolean);
  if (!ids.includes("plugin-project-explorer")) fail("patch entry missing after append: " + ids.join(","));
  if (!ids.includes("plugin-explainer")) fail("existing plugin-explainer entry lost!");
  console.log("3e. patch YAML OK (ids: " + ids.join(", ") + ")");
}

console.log("\nINSTALL OK — restart dsh web (full exit + relaunch) to load the plugin.");
