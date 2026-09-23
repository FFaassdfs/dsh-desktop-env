// setup-plugins.mjs — idempotent installer for the custom dsh plugins.
//
// Relative-path based (repoRoot = parent of this file's directory), so it
// works on any machine right after `git clone` — no hardcoded paths.
//
//   dsh-client-ui-plugin-explainer              -> patch id plugin-explainer
//   dsh-client-ui-plugin-project-explorer       -> patch id plugin-project-explorer
//   dsh-client-ui-plugin-model-capabilities     -> patch id plugin-model-capabilities
//   dsh-client-ui-plugin-core-version           -> patch id plugin-core-version
//   dsh-client-ui-plugin-model-sync             -> patch id plugin-model-sync
//   dsh-client-ui-plugin-provider-presets       -> patch id plugin-provider-presets
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
// Usage: node scripts/setup-plugins.mjs [--check-only] [--plugins <list>] [--describe] [--ascii]
//   --check-only: verify only, write nothing.
//   --describe:   print the plugin catalogue as JSON (number, short name, Chinese
//                 title/summary/where/writes) and exit — used by the offline
//                 installer menu and to keep README in sync. Nothing is installed.
//   --ascii:      escape every non-ASCII character in --describe / --status output
//                 as \uXXXX. REQUIRED when a Windows PowerShell 5.1 caller parses
//                 it: 5.1 decodes a native process's stdout with the CONSOLE
//                 codepage (936/GBK on a zh-CN box), and a mojibake trail byte can
//                 swallow the closing quote of a Chinese string, breaking the JSON
//                 outright (real failure: 2026-09-23, HANDOVER §34). ASCII decodes
//                 identically under every codepage, so escaping removes the whole
//                 class of failure. JSON escapes are decoded by the parser, so the
//                 caller still receives the original Chinese.
//   --plugins:    which plugins to install. "all" (default), "none", or a
//                 comma-separated list of numbers / short names / package names /
//                 patch ids, e.g. --plugins 2,4  ==  --plugins explainer,project-explorer
//   --status:     print what is installed vs what this source tree carries
//                 (content hashes) as JSON and exit — used by update-plugins.ps1
//                 so "已是最新 / 待更新 / 未安装" is decided in exactly one place.
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const checkOnly = process.argv.includes("--check-only");
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
// resolve() on purpose: verify() uses createRequire(), which rejects a relative
// path — a relative DSH_HOME used to abort the install after the first plugin.
const DSH_HOME = resolve(process.env.DSH_HOME || join(homedir(), ".dsh"));
const PROFILE_DIR = join(DSH_HOME, "profiles", "web");
const PATCH_PATH = join(PROFILE_DIR, "cordis.patch.yml");
const PACKAGES_DIR = join(DSH_HOME, "profiles", "node_modules");

// --- machine-readable output (--describe / --status) --------------------------
// Windows PowerShell 5.1 decodes a native child process's stdout with the CONSOLE
// codepage, which on a zh-CN box is 936/GBK — not the UTF-8 node actually wrote.
// The mojibake is not merely ugly: a dangling GBK lead byte at the end of a Chinese
// string absorbs the following `"`, so the JSON never closes and ConvertFrom-Json
// fails with a message that names a plugin title (a real, reproduced failure — see
// HANDOVER §34). Escaping every non-ASCII character as \uXXXX under --ascii makes
// the payload pure ASCII, which decodes the same way under every codepage, while
// the JSON parser turns the escapes back into the original Chinese.
const asciiOutput = process.argv.includes("--ascii");
/**
 * Serialize machine-readable output, optionally as pure ASCII.
 * @param value - the catalogue or status array.
 * @returns the JSON text to print.
 */
function toJson(value) {
  const text = JSON.stringify(value, null, 2);
  if (!asciiOutput) return text;
  // Non-ASCII can only occur inside JSON string literals, so escaping every
  // non-ASCII code point keeps the document valid.
  return text.replace(/[\u007f-\uffff]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
}

// Canonical plugin catalogue. The ORDER is the numbering used by the installer
// menu and by --plugins/--describe, so keep it alphabetical by short name.
// `title` / `summary` / `where` / `writes` are the user-facing description shown
// at install time (single source of truth: install-offline.ps1 asks for it with
// `--describe`, and README.md mirrors it).
const PLUGINS = [
  {
    name: "dsh-client-ui-plugin-core-version",
    patchId: "plugin-core-version",
    title: "核心版本徽标",
    summary: "界面左下角显示当前核心版本号（如 dsh v0.1.5-rc.2），一眼确认用的是哪一版。只读展示，不挡点击。",
    where: "界面左下角",
    writes: "",
    comment: "# dsh-client-ui-plugin-core-version: top-of-GUI core version badge (HANDOVER §21).\n# Package lives in $DSH_HOME/profiles/node_modules (installed by setup.ps1, see HANDOVER.md).\n",
    src: join(repoRoot, "plugins", "dsh-client-ui-plugin-core-version"),
  },
  {
    name: "dsh-client-ui-plugin-explainer",
    patchId: "plugin-explainer",
    title: "插件说明面板",
    summary: "设置 →「插件」多一个「插件说明」页：每个插件是干什么的用中文写清，并显示已启用/已停用，还能一键开关（重启壳生效）。",
    where: "设置 →「插件」",
    writes: "只在你点开关时写 profiles/web/cordis.patch.yml",
    comment: "# dsh-client-ui-plugin-explainer: Settings > Plugins \"plugin explainer\" tab (HANDOVER path A).\n# Package lives in $DSH_HOME/profiles/node_modules (installed by setup.ps1, see HANDOVER.md).\n",
    src: join(repoRoot, "plugins", "dsh-client-ui-plugin-explainer"),
  },
  {
    name: "dsh-client-ui-plugin-model-capabilities",
    patchId: "plugin-model-capabilities",
    title: "模型能力清单",
    summary: "设置里多一个「模型能力」：逐个列出每个模型能否识图、上下文多长、有哪些推理档位。只读查询，不改任何配置。",
    where: "设置 →「模型能力」",
    writes: "",
    comment: "# dsh-client-ui-plugin-model-capabilities: Settings > \"模型能力\" per-model capabilities (HANDOVER path E).\n# Package lives in $DSH_HOME/profiles/node_modules (installed by setup.ps1, see HANDOVER.md).\n",
    src: join(repoRoot, "plugins", "dsh-client-ui-plugin-model-capabilities"),
  },
  {
    name: "dsh-client-ui-plugin-model-sync",
    patchId: "plugin-model-sync",
    title: "模型同步",
    summary: "设置 →「模型」里每个提供商卡片上多一组同步控件：从 models.dev / OpenRouter / 该商自己的 /models 端点拉候选模型，逐字段对比后写入配置；你手工改过的值会被标出且默认不覆盖。",
    where: "设置 →「模型」→ 提供商卡片",
    writes: "只在你点「应用所选」时写 ~/.dsh/settings.yaml 的 llm-pi-ai.providers.<路由>.models",
    comment: "# dsh-client-ui-plugin-model-sync: per-provider model list/parameter sync on the Models page (HANDOVER path P).\n# Package lives in $DSH_HOME/profiles/node_modules (installed by setup.ps1, see HANDOVER.md).\n",
    src: join(repoRoot, "plugins", "dsh-client-ui-plugin-model-sync"),
  },
  {
    name: "dsh-client-ui-plugin-project-explorer",
    patchId: "plugin-project-explorer",
    title: "项目文件树",
    summary: "界面最右侧的可折叠文件树（显示当前会话目录）；把文件拖进输入框即插入它的路径，让 agent 自己去读。只给路径，不传文件内容。",
    where: "界面最右侧",
    writes: "",
    comment: "# dsh-client-ui-plugin-project-explorer: right-side project file tree (HANDOVER path C).\n# Package lives in $DSH_HOME/profiles/node_modules (installed by setup.ps1, see HANDOVER.md).\n",
    src: join(repoRoot, "plugins", "dsh-client-ui-plugin-project-explorer"),
  },
  {
    name: "dsh-client-ui-plugin-provider-presets",
    patchId: "plugin-provider-presets",
    title: "预置供应商",
    summary: "设置 →「模型」底部多一块「预置供应商」：内置 vekenllm 与电信算力两条完整配置（端点、协议、模型清单），点「启用」就写进配置、点「停用」就移除；密钥由你在面板里输入，走官方凭据引用。不需要时保持未启用即可。",
    where: "设置 →「模型」页面底部",
    writes: "只在你点「启用/停用/重置为预置」时写 ~/.dsh/settings.yaml 的 llm-pi-ai.providers.<路由>；密钥单独写入凭据引用（只写，不进配置文件）",
    comment: "# dsh-client-ui-plugin-provider-presets: pre-staged provider profiles on the Models page footer (HANDOVER path Q).\n# Package lives in $DSH_HOME/profiles/node_modules (installed by setup.ps1, see HANDOVER.md).\n",
    src: join(repoRoot, "plugins", "dsh-client-ui-plugin-provider-presets"),
  },
];

function fail(message) {
  console.error("SETUP FAILED: " + message);
  process.exit(1);
}

// --- plugin selection (--plugins) ---------------------------------------------
// Tokens may be the number from the installer menu (1, 2, …), the short name
// (explainer), the package name (dsh-client-ui-plugin-explainer) or the patch id
// (plugin-explainer).
function pluginShortName(plugin) {
  return plugin.name.replace(/^dsh-client-ui-plugin-/, "");
}

function matchesToken(plugin, token) {
  const t = token.trim().toLowerCase();
  if (!t) return false;
  const name = plugin.name.toLowerCase();
  const id = plugin.patchId.toLowerCase();
  const short = pluginShortName(plugin).toLowerCase();
  return t === name || t === id || t === short || id.endsWith("-" + t) || name.endsWith("-" + t);
}

function selectPlugins(arg) {
  const raw = (arg ?? "all").trim();
  if (raw === "" || raw.toLowerCase() === "all") {
    return { selected: PLUGINS.slice(), skipped: [] };
  }
  if (raw.toLowerCase() === "none") {
    return { selected: [], skipped: PLUGINS.slice() };
  }
  // Accept commas and/or whitespace: PowerShell array-splits `-Plugins 2,4` in
  // -Command mode, which arrives here as "2 4".
  const tokens = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  const selected = [];
  const unknown = [];
  for (const token of tokens) {
    let hit = null;
    if (/^\d+$/.test(token)) {
      const idx = Number(token) - 1;
      if (idx >= 0 && idx < PLUGINS.length) hit = PLUGINS[idx];
    } else {
      hit = PLUGINS.find((p) => matchesToken(p, token)) ?? null;
    }
    if (!hit) {
      unknown.push(token);
      continue;
    }
    if (!selected.includes(hit)) selected.push(hit);
  }
  if (unknown.length > 0) {
    fail(
      `unknown plugin(s): ${unknown.join(", ")} — use numbers (1-${PLUGINS.length}) or names: ` +
      PLUGINS.map((p, i) => `${i + 1}=${pluginShortName(p)}`).join(", ")
    );
  }
  return { selected, skipped: PLUGINS.filter((p) => !selected.includes(p)) };
}

// The installer menu and README are generated from this, so the description
// lives in exactly one place.
if (process.argv.includes("--describe")) {
  console.log(toJson(
    PLUGINS.map((p, i) => ({
      index: i + 1,
      short: pluginShortName(p),
      name: p.name,
      patchId: p.patchId,
      title: p.title,
      summary: p.summary,
      where: p.where,
      writes: p.writes,
    }))
  ));
  process.exit(0);
}

// --- installed vs source state (--status) -------------------------------------
// The install payload is package.json + lib/**; hashing exactly those files lets
// the updater say "已是最新" without relying on version numbers (all plugins are
// 0.1.0 today, so versions alone would be useless).
function payloadFiles(dir) {
  const files = [];
  if (existsSync(join(dir, "package.json"))) files.push("package.json");
  const libDir = join(dir, "lib");
  const walk = (base, rel) => {
    for (const entry of readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(base, entry.name), next);
      else if (entry.isFile()) files.push(`lib/${next}`);
    }
  };
  if (existsSync(libDir)) walk(libDir, "");
  return files.sort();
}

/**
 * A file's bytes with CRLF folded to LF, for hashing.
 *
 * Why: `core.autocrlf=true` (this repo has no .gitattributes) means a git
 * checkout on Windows writes CRLF while a locally built file stays LF. The two
 * are the same content, but a byte hash would call them different — so a plugin
 * installed from a released package (CRLF, built by CI) reported "待更新"
 * against an LF source tree forever, and the updater kept rewriting it. Hashing
 * the LF-normalized bytes makes "已是最新" mean "same content" (HANDOVER §34).
 * latin1 maps every byte to one code unit, so this replaces bytes, not
 * characters, and cannot corrupt a non-UTF-8 payload.
 * @param buffer - the raw file bytes.
 * @returns the LF-normalized text to hash.
 */
function normalizeEol(buffer) {
  return buffer.toString("latin1").replace(/\r\n/g, "\n");
}

function payloadHash(dir) {
  if (!existsSync(dir)) return "";
  const hash = createHash("sha256");
  for (const rel of payloadFiles(dir)) {
    hash.update(rel);
    hash.update("\0");
    hash.update(normalizeEol(readFileSync(join(dir, rel))));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 12);
}

function sourceVersion(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version ?? "";
  } catch {
    return "";
  }
}

if (process.argv.includes("--status")) {
  const patchText = existsSync(PATCH_PATH) ? readFileSync(PATCH_PATH, "utf8") : "";
  console.log(toJson(
    PLUGINS.map((p, i) => {
      const sourceHash = payloadHash(p.src);
      const installedDir = join(PACKAGES_DIR, p.name);
      const installed = existsSync(installedDir);
      const installedHash = payloadHash(installedDir);
      let state = "missing";
      if (installed) state = sourceHash && installedHash === sourceHash ? "current" : "outdated";
      return {
        index: i + 1,
        short: pluginShortName(p),
        name: p.name,
        patchId: p.patchId,
        title: p.title,
        version: sourceVersion(p.src),
        sourceHash,
        installedHash,
        installed,
        patchEntry: patchText.includes("id: " + p.patchId),
        state,
      };
    })
  ));
  process.exit(0);
}

const pluginsArgIndex = process.argv.indexOf("--plugins");
if (pluginsArgIndex >= 0 && process.argv[pluginsArgIndex + 1] === undefined) {
  fail("--plugins needs a value (all | none | comma-separated list)");
}
const pluginsArg = pluginsArgIndex >= 0 ? process.argv[pluginsArgIndex + 1] : "all";
const { selected: SELECTED, skipped: SKIPPED } = selectPlugins(pluginsArg);

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
    // A dry run on a machine that has never installed anything has no patch file
    // to read. That is the state a first install is supposed to be in, so it must
    // not be reported as a verification failure.
    if (checkOnly) {
      console.log(`2. cordis.patch.yml missing (${PATCH_PATH}) — would be created with the ${plugin.patchId} entry`);
      return;
    }
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

  // condition 1: package resolvable from the profile base.
  // A --check-only run against a plugin that is NOT installed yet has nothing to
  // resolve, which used to abort the dry run with MODULE_NOT_FOUND — exactly the
  // run you want before installing something new. In that case verify the SOURCE
  // payload instead: it is what a real run would copy, and the remaining
  // conditions are all relative to the package root, so they check the same files.
  let pkgJsonPath = null;
  try {
    pkgJsonPath = requireFromProfile.resolve(`${plugin.name}/package.json`);
    console.log(`3a. resolve OK -> ${pkgJsonPath}`);
  } catch (error) {
    if (!checkOnly) throw error;
    pkgJsonPath = join(plugin.src, "package.json");
    console.log(`3a. not installed yet; verifying the source payload -> ${pkgJsonPath}`);
  }
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

  // condition 2: dsh.client declaration
  if (!pkg.dsh || !pkg.dsh.client || pkg.dsh.client.platform !== "web" || !Array.isArray(pkg.dsh.client.inject)) {
    fail(plugin.name + ": dsh.client declaration missing/wrong");
  }
  console.log(`3b. dsh.client OK (platform=web, inject=${pkg.dsh.client.inject.length})`);

  // condition 2b: every declared inject edge must be resolvable from the profile.
  // A dangling edge is how the plugins silently stopped working on a core upgrade
  // (`@deepseek-ai/dsh-client-runtime` vanished in dsh 0.1.5 — HANDOVER §21).
  for (const edge of pkg.dsh.client.inject) {
    try {
      requireFromProfile.resolve(edge + "/package.json");
    } catch {
      console.log(`3b'. WARN inject edge not resolvable: ${edge}`);
      console.log("     (obsolete core module name? drop it from dsh.client.inject and rebuild)");
    }
  }

  // condition 3: exports["./client"] points at a real ModuleLoader bundle
  const clientExport = pkg.exports && pkg.exports["./client"];
  if (!clientExport) fail(plugin.name + ": exports['./client'] missing");
  const clientSpec = typeof clientExport === "string" ? clientExport : (clientExport.default || "");
  const clientPath = join(dirname(pkgJsonPath), clientSpec);
  if (!existsSync(clientPath)) fail(plugin.name + ": client bundle missing: " + clientPath);
  const clientSource = readFileSync(clientPath, "utf8");
  if (!clientSource.includes("window.__ModuleLoader__.load")) fail(plugin.name + ": client bundle is not a ModuleLoader bundle");
  console.log(`3c. exports['./client'] OK -> ${clientPath} (${Buffer.byteLength(clientSource, "utf8")} bytes)`);

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
    console.log(existsSync(PATCH_PATH)
      ? "3e. js-yaml not found from profile — patch YAML check skipped"
      : "3e. cordis.patch.yml does not exist yet (nothing installed) — patch YAML check skipped");
    return;
  }
  if (!Array.isArray(parsed)) fail("cordis.patch.yml top level is not an array");
  const ids = parsed
    .filter((e) => e && Array.isArray(e.insert))
    .flatMap((e) => e.insert.map((i) => i && i.id))
    .filter(Boolean);
  for (const plugin of SELECTED) {
    if (ids.includes(plugin.patchId)) continue;
    // A dry run has not appended anything, so a missing id is the expected state
    // there rather than a failure — otherwise --check-only could never pass
    // before the first real install.
    if (checkOnly) {
      console.log(`3e'. patch entry ${plugin.patchId} would be appended (dry run)`);
      continue;
    }
    fail(`patch entry missing after append: ${plugin.patchId}`);
  }
  console.log(`3e. patch YAML OK (ids: ${ids.join(", ")})`);
}

// --- main ---------------------------------------------------------------------
console.log(`repoRoot : ${repoRoot}`);
console.log(`DSH_HOME : ${DSH_HOME}`);
console.log(`checkOnly: ${checkOnly}`);
console.log(`plugins  : ${SELECTED.length === 0 ? "none" : SELECTED.map((p) => `${pluginShortName(p)} (${p.title})`).join(", ")}` +
  (SKIPPED.length > 0 && SELECTED.length > 0
    ? ` (skipped: ${SKIPPED.map(pluginShortName).join(", ")})`
    : ""));
console.log("");

if (SELECTED.length === 0) {
  console.log("No plugins selected — nothing to install.");
  console.log(checkOnly ? "CHECK ONLY — nothing written." : "SETUP OK — no changes made.");
  process.exit(0);
}

for (const plugin of SELECTED) {
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
