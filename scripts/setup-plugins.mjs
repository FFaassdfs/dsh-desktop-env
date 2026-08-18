// setup-plugins.mjs — idempotent installer for the two custom dsh plugins.
//
// Relative-path based (repoRoot = parent of this file's directory), so it
// works on any machine right after `git clone` — no hardcoded paths.
//
//   dsh-client-ui-plugin-explainer         -> patch id plugin-explainer
//   dsh-client-ui-plugin-project-explorer  -> patch id plugin-project-explorer
//
// For each plugin:
//   1. copies package.json + lib/ into $DSH_HOME/profiles/node_modules
//      (delete-first to avoid nesting, HANDOVER pathC pitfall #10)
//   2. appends an idempotent insert entry to profiles/web/cordis.patch.yml
//      (UTF-8, no BOM, preserves existing content)
//   3. static verification: loader discovery conditions from HANDOVER §2.3
//      (resolvable package, dsh.client declaration, exports["./client"],
//      host main exists) + patch YAML still parses.
//
// Usage: node scripts/setup-plugins.mjs [--check-only]
//   --check-only: verify only, write nothing.
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const checkOnly = process.argv.includes("--check-only");
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const DSH_HOME = process.env.DSH_HOME || join(homedir(), ".dsh");
const PROFILE_DIR = join(DSH_HOME, "profiles", "web");
const PATCH_PATH = join(PROFILE_DIR, "cordis.patch.yml");
const PACKAGES_DIR = join(DSH_HOME, "profiles", "node_modules");

const PLUGINS = [
  {
    name: "dsh-client-ui-plugin-explainer",
    patchId: "plugin-explainer",
    comment: "# dsh-client-ui-plugin-explainer: Settings > Plugins \"plugin explainer\" tab (HANDOVER path A).\n# Package lives in $DSH_HOME/profiles/node_modules (installed by setup.ps1, see HANDOVER.md).\n",
    src: join(repoRoot, "plugins", "dsh-client-ui-plugin-explainer"),
  },
  {
    name: "dsh-client-ui-plugin-project-explorer",
    patchId: "plugin-project-explorer",
    comment: "# dsh-client-ui-plugin-project-explorer: right-side project file tree (HANDOVER path C).\n# Package lives in $DSH_HOME/profiles/node_modules (installed by setup.ps1, see HANDOVER.md).\n",
    src: join(repoRoot, "plugins", "dsh-client-ui-plugin-project-explorer"),
  },
];

function fail(message) {
  console.error("SETUP FAILED: " + message);
  process.exit(1);
}

// --- 1. copy package (idempotent: delete-first, then copy) -------------------
function installPackage(plugin) {
  const dst = join(PACKAGES_DIR, plugin.name);
  const srcPkg = join(plugin.src, "package.json");
  const srcLib = join(plugin.src, "lib");
  for (const p of [srcPkg, srcLib]) {
    if (!existsSync(p)) fail("missing " + p);
  }
  if (checkOnly) {
    console.log(`1. would install ${plugin.name} -> ${dst}`);
    return dst;
  }
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  copyFileSync(srcPkg, join(dst, "package.json"));
  cpSync(srcLib, join(dst, "lib"), { recursive: true });
  console.log(`1. package copied -> ${dst}`);
  return dst;
}

// --- 2. patch entry (idempotent: skip if the insert id already exists) -------
function ensurePatchEntry(plugin) {
  if (!existsSync(PATCH_PATH)) {
    if (checkOnly) fail(`cordis.patch.yml missing (${PATCH_PATH})`);
    mkdirSync(dirname(PATCH_PATH), { recursive: true });
    writeFileSync(PATCH_PATH, "# Your patch layer for this dsh profile, applied after every bundle layer:\n# a top-level YAML array of loader patch entries (id-targeted config\n# overrides, disables, and insert lists; `!!js` expressions allowed).\n", "utf8");
  }
  let patch = readFileSync(PATCH_PATH, "utf8");
  const marker = "id: " + plugin.patchId;
  if (patch.includes(marker)) {
    console.log(`2. patch already contains ${plugin.patchId} (skipped)`);
    return;
  }
  if (checkOnly) {
    console.log(`2. would append ${plugin.patchId} entry`);
    return;
  }
  const entry =
    plugin.comment +
    `- insert:\n    - id: ${plugin.patchId}\n      name: '${plugin.name}'\n`;
  patch = patch.replace(/\s+$/, "") + "\n" + entry;
  writeFileSync(PATCH_PATH, patch, "utf8");
  console.log(`2. patch entry appended -> ${PATCH_PATH}`);
}

// --- 3. static verification (loader discovery conditions 1-4, HANDOVER §2.3) --
async function verify(plugin) {
  const requireFromProfile = createRequire(join(PROFILE_DIR, "package.json"));

  // condition 1: package resolvable from the profile base
  const pkgJsonPath = requireFromProfile.resolve(`${plugin.name}/package.json`);
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  console.log(`3a. resolve OK -> ${pkgJsonPath}`);

  // condition 2: dsh.client declaration
  if (!pkg.dsh || !pkg.dsh.client || pkg.dsh.client.platform !== "web" || !Array.isArray(pkg.dsh.client.inject)) {
    fail(plugin.name + ": dsh.client declaration missing/wrong");
  }
  console.log(`3b. dsh.client OK (platform=web, inject=${pkg.dsh.client.inject.length})`);

  // condition 3: exports["./client"] points at a real ModuleLoader bundle
  const clientExport = pkg.exports && pkg.exports["./client"];
  if (!clientExport) fail(plugin.name + ": exports['./client'] missing");
  const clientSpec = typeof clientExport === "string" ? clientExport : (clientExport.default || "");
  const clientPath = join(dirname(pkgJsonPath), clientSpec);
  if (!existsSync(clientPath)) fail(plugin.name + ": client bundle missing: " + clientPath);
  const clientSource = readFileSync(clientPath, "utf8");
  if (!clientSource.includes("window.__ModuleLoader__.load")) fail(plugin.name + ": client bundle is not a ModuleLoader bundle");
  console.log(`3c. exports['./client'] OK -> ${clientPath} (${clientSource.length} bytes)`);

  // condition 4: host main exists
  const mainSpec = pkg.main || "lib/index.js";
  const mainPath = join(dirname(pkgJsonPath), mainSpec);
  if (!existsSync(mainPath)) fail(plugin.name + ": host main missing: " + mainPath);
  console.log(`3d. host main OK -> ${mainPath}`);
}

// --- patch YAML parses + both ids present (js-yaml, best-effort) --------------
async function verifyPatch() {
  const requireFromProfile = createRequire(join(PROFILE_DIR, "package.json"));
  let parsed = null;
  try {
    const jsYamlPath = requireFromProfile.resolve("js-yaml");
    const jsYaml = await import(pathToFileURL(jsYamlPath).href);
    const yamlMod = jsYaml.default ?? jsYaml;
    parsed = yamlMod.load(readFileSync(PATCH_PATH, "utf8"));
  } catch {
    // js-yaml not resolvable from profile — skip YAML check (non-fatal)
  }
  if (parsed === null) {
    console.log("3e. js-yaml not found from profile — patch YAML check skipped");
    return;
  }
  if (!Array.isArray(parsed)) fail("cordis.patch.yml top level is not an array");
  const ids = parsed
    .filter((e) => e && Array.isArray(e.insert))
    .flatMap((e) => e.insert.map((i) => i && i.id))
    .filter(Boolean);
  for (const plugin of PLUGINS) {
    if (!ids.includes(plugin.patchId)) fail(`patch entry missing after append: ${plugin.patchId}`);
  }
  console.log(`3e. patch YAML OK (ids: ${ids.join(", ")})`);
}

// --- main ---------------------------------------------------------------------
console.log(`repoRoot : ${repoRoot}`);
console.log(`DSH_HOME : ${DSH_HOME}`);
console.log(`checkOnly: ${checkOnly}`);
console.log("");

for (const plugin of PLUGINS) {
  console.log(`--- ${plugin.name} ---`);
  installPackage(plugin);
  ensurePatchEntry(plugin);
  await verify(plugin);
  console.log("");
}
await verifyPatch();

console.log(checkOnly
  ? "CHECK ONLY — nothing written. Looks good."
  : "SETUP OK — restart dsh web (full exit + relaunch) to load the plugins.");
