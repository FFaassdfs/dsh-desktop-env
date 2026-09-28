// verify-release.mjs — end-to-end verification of a PUBLISHED dsh-desktop release.
//
//   node .work/verify-release.mjs desktop-v0.1.15          # verifies the slim asset
//   node .work/verify-release.mjs desktop-v0.1.15 full     # verifies the full asset
//
// 0.1.15 publishes TWO assets in one release (slim + full, see HANDOVER §49). This
// script asserts BOTH are present (a missing sibling is a release bug), then verifies
// the requested one end to end. Older releases shipped a single unsuffixed zip and
// still verify with the default variant (slim).
//
// What it does (everything against the real GitHub Release asset):
//   1. reads the release + its assets (derives the harness version from the asset
//      name, so it works for any future release),
//   2. downloads the zip (mirror first, resumable, per-attempt timeout; reuses a
//      local copy when the hash already matches, and refuses to resume over a
//      stale build of a re-pushed tag),
//   3. verifies SHA256 against the published SHA256SUMS.txt,
//   4. extracts it and checks the package layout,
//   5. runs the SHIPPED installer: -CheckOnly dry run and the interactive menu
//      (prompt forced, answer "2,4" piped in) against clean throwaway DSH homes,
//      asserting it writes nothing,
//   6. runs the SHIPPED updater (-CheckOnly) and asserts it writes nothing,
//   7. runs `dsh-desktop.exe --extract-runtime` and probes the unpacked
//      dsh + npm versions,
//   8. **boots the packaged runtime against a FRESH DSH_HOME** and asserts it stays
//      alive and serves HTTP (regression guard for the 0.1.5-rc.2 HMR boot crash —
//      see HANDOVER §42; packages up to 0.1.12 shipped a harness that could not start
//      on a brand-new machine).
//
// Requires: node, pwsh/powershell, tar.exe (all present on a normal Windows box).
// Scratch lives in .cache/verify-<version>-<variant>/ (gitignored) - see HANDOVER §32.
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { join } from "node:path";

const REPO = "FFaassdfs/dsh-desktop-env";
const TAG = process.argv[2];
const VARIANT = (process.argv[3] || "slim").toLowerCase();
if (!TAG || !/^desktop-v/.test(TAG)) {
  console.log("usage: node .work/verify-release.mjs <tag> [slim|full]    e.g. desktop-v0.1.15 full");
  process.exit(2);
}
if (VARIANT !== "slim" && VARIANT !== "full") {
  console.log(`unknown variant '${VARIANT}' (expected slim or full)`);
  process.exit(2);
}
const VER = TAG.replace(/^desktop-v/, "");
const root = join(process.cwd(), ".cache", `verify-${VER}-${VARIANT}`);
const extractDir = join(root, "extracted");
const homeDir = join(root, "installer-home");
const updaterHome = join(root, "updater-home");

const headers = { accept: "application/vnd.github+json", "user-agent": "dsh-desktop-verify" };
async function api(url, tries = 5) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error("http " + r.status);
      return await r.json();
    } catch (err) { last = err; await new Promise((r) => setTimeout(r, 3000)); }
  }
  throw last;
}

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`   present  ${name}`); }
  else { fail++; console.log(`   MISSING  ${name}${detail ? "  (" + detail + ")" : ""}`); }
}

// The published SHA256SUMS.txt carries one "<hash>  <name>" line per asset. Since
// 0.1.15 lists TWO zips (slim + full), always resolve a hash BY NAME - taking the
// first 64 hex chars silently compares against the other variant.
function shaForAsset(text, name) {
  const line = text.split(/\r?\n/).find((l) => l.trim().endsWith(name));
  return ((line || "").match(/[0-9a-fA-F]{64}/) || [""])[0].toLowerCase();
}

// --- 1. release metadata ------------------------------------------------------
console.log(`1) release metadata for ${TAG}`);
const release = await api(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`).catch(() => null);
if (!release) { console.log(`   no release for ${TAG}`); process.exit(1); }
const zips = release.assets.filter((a) => a.name.endsWith(".zip"));
const sumsAsset = release.assets.find((a) => a.name === "SHA256SUMS.txt");
if (!sumsAsset) { console.log("   no SHA256SUMS.txt asset in this release"); process.exit(1); }
// 0.1.15+ names the variant in the asset; older releases shipped one plain zip.
const variantOf = (name) => (/-win-x64-(slim|full)\.zip$/.exec(name) || [, "single"])[1];
const byVariant = new Map(zips.map((a) => [variantOf(a.name), a]));
if (byVariant.has("slim") || byVariant.has("full")) {
  const missing = ["slim", "full"].filter((v) => !byVariant.has(v));
  if (missing.length) {
    console.log(`   this release must carry BOTH variants; missing: ${missing.join(", ")} (found: ${zips.map((a) => a.name).join(", ") || "none"})`);
    process.exit(1);
  }
} else if (zips.length !== 1) {
  console.log(`   expected exactly one zip (or the slim+full pair), got ${zips.length}`);
  process.exit(1);
}
const asset = byVariant.get(VARIANT) || zips[0];
if (!asset) { console.log(`   no asset for variant ${VARIANT}`); process.exit(1); }
const pkgName = asset.name.replace(/\.zip$/, "");
const EXPECTED = (asset.name.match(/-dsh(.+?)-win-x64(?:-(?:slim|full))?\.zip$/) || [, ""])[1];
console.log(`   verifying variant: ${VARIANT}`);
for (const [v, a] of byVariant) {
  console.log(`   ${v === VARIANT ? "asset" : "other"}: ${a.name} (${(a.size / 1048576).toFixed(1)} MB)`);
}
console.log(`   harness expected inside: ${EXPECTED || "(unparsed)"}`);

let sumsBody = "";
try {
  const r = await fetch(sumsAsset.browser_download_url, { signal: AbortSignal.timeout(60000) });
  if (r.ok) sumsBody = await r.text();
} catch { /* leave empty: the checks below report the detail */ }
check("SHA256SUMS.txt lists every zip asset",
  zips.length > 0 && zips.every((a) => shaForAsset(sumsBody, a.name) !== ""),
  `${zips.length} zip(s), ${sumsBody.split(/\r?\n/).filter(Boolean).length} line(s)`);
check("asset digest matches its SHA256SUMS.txt line", (() => {
  const claimed = shaForAsset(sumsBody, asset.name);
  return claimed !== "" && Boolean(asset.digest) && asset.digest.toLowerCase() === "sha256:" + claimed;
})());

mkdirSync(root, { recursive: true });
const zipPath = join(root, asset.name);

// --- 2. download (mirror first, resumable) ------------------------------------
function localSha() {
  return existsSync(zipPath) ? createHash("sha256").update(readFileSync(zipPath)).digest("hex") : "";
}
async function download(urls, dest) {
  let have = existsSync(dest) ? statSync(dest).size : 0;
  if (have > 0) console.log(`   resuming from ${(have / 1048576).toFixed(1)} MB`);
  for (let attempt = 1; attempt <= 60; attempt++) {
    const url = urls[(attempt - 1) % urls.length];
    try {
      const resp = await fetch(url, {
        headers: have > 0 ? { Range: `bytes=${have}-` } : {},
        signal: AbortSignal.timeout(300000),
      });
      if (resp.status !== 200 && resp.status !== 206) throw new Error("http " + resp.status);
      const total = have + Number(resp.headers.get("content-length") || 0);
      const out = createWriteStream(dest, { flags: have > 0 ? "a" : "w" });
      let received = have;
      let last = Date.now();
      for await (const chunk of resp.body) {
        if (!out.write(chunk)) await new Promise((r) => out.once("drain", r));
        received += chunk.length;
        if (Date.now() - last > 30000) { last = Date.now(); console.log(`   ...${(received / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB`); }
      }
      await new Promise((res, rej) => out.end((e) => (e ? rej(e) : res())));
      if (received < total) throw new Error(`short read ${received}/${total}`);
      return received;
    } catch (err) {
      console.log(`   attempt ${attempt} via ${new URL(url).host}: ${err.message}`);
      have = existsSync(dest) ? statSync(dest).size : 0;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error("download failed");
}

console.log("2) download");
const expectedSha = shaForAsset(sumsBody, asset.name);
if (expectedSha === "") { console.log(`   SHA256SUMS.txt has no line for ${asset.name}`); process.exit(1); }
if (localSha() === expectedSha) {
  console.log(`   already on disk and hash matches (${(statSync(zipPath).size / 1048576).toFixed(1)} MB)`);
} else {
  if (existsSync(zipPath)) {
    // A re-pushed tag produces a different build: never resume over the old file.
    console.log("   local copy is a different build (hash mismatch) - downloading fresh");
    rmSync(zipPath, { force: true });
  }
  const urls = [`https://ghfast.top/https://github.com/${REPO}/releases/download/${TAG}/${asset.name}`,
                `https://github.com/${REPO}/releases/download/${TAG}/${asset.name}`];
  const t0 = Date.now();
  await download(urls, zipPath);
  console.log(`   downloaded in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

console.log("3) SHA256");
const actualSha = localSha();
console.log(`   expected ${expectedSha}`);
console.log(`   actual   ${actualSha}`);
check("SHA256 matches the published checksum file", expectedSha !== "" && actualSha === expectedSha);

// --- 3. extract ---------------------------------------------------------------
console.log("4) extract + layout");
rmSync(extractDir, { recursive: true, force: true });
mkdirSync(extractDir, { recursive: true });
execFileSync("tar.exe", ["-xf", zipPath, "-C", extractDir], { stdio: "inherit" });
const pkgDir = join(extractDir, pkgName);
const top = readdirSync(pkgDir);
console.log(`   top-level: ${top.join(", ")}`);
for (const f of ["dsh-desktop.exe", "install-offline.ps1", "install-offline.cmd", "update-plugins.ps1", "update-plugins.cmd", "runtime.zip", "README.txt", "VERSION.txt"]) {
  check(`package contains ${f}`, top.includes(f));
}
check("runtime ships as the single runtime.zip", top.includes("runtime.zip") && !top.includes("runtime"));

// --- 4. shipped installer -----------------------------------------------------
console.log("5) shipped installer (-CheckOnly dry run)");
for (const dir of [homeDir, updaterHome]) { rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }); }
const installer = join(pkgDir, "install-offline.ps1");
const updater = join(pkgDir, "update-plugins.ps1");
// Sandbox-friendly capture. Node's default piped stdio needs NAMED PIPES, which
// some sandboxes refuse ("spawnSync powershell EPERM" - measured 2026-09-28, which
// silently failed steps 5-8 and killed step 9 before the variant check could run).
// Handing the child real FILES for stdout/stderr - and for stdin when we must feed
// input, since a stdin pipe is a pipe too - works everywhere. The boot gate below
// has always used this same trick for the same reason.
let scratchSeq = 0;
function runCapture(cmd, args, opts = {}) {
  scratchSeq += 1;
  const tag = `${process.pid}-${scratchSeq}`;
  const outPath = join(root, `child-${tag}.out.txt`);
  const errPath = join(root, `child-${tag}.err.txt`);
  let inFd = "ignore";
  if (opts.input !== undefined) {
    const inPath = join(root, `child-${tag}.in.txt`);
    writeFileSync(inPath, opts.input);
    inFd = openSync(inPath, "r");
  }
  const res = spawnSync(cmd, args, {
    env: opts.env,
    stdio: [inFd, openSync(outPath, "w"), openSync(errPath, "w")],
    windowsHide: true,
  });
  const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
  return { out: read(outPath) + read(errPath), stdout: read(outPath), stderr: read(errPath), code: res.status ?? 1, error: res.error };
}

function runFile(file, args, opts = {}) {
  const r = runCapture("pwsh", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", file, ...args],
    { input: opts.input, env: opts.env });
  return { out: r.out, code: r.code };
}
const dry = runFile(installer, ["-CheckOnly", "-Plugins", "2,4", "-DSHome", homeDir]);
check("installer dry run exits 0", dry.code === 0, `exit=${dry.code}`);
check("dry run lists the bundled plugins", /plugin package\(s\) bundled/.test(dry.out));
check("dry run reports what it would install", /would install : \S+/.test(dry.out));
check("dry run wrote nothing", !existsSync(join(homeDir, "profiles", "node_modules")));

console.log("6) shipped installer (interactive menu, answer 2,4 piped in)");
const menu = runFile(installer, ["-CheckOnly", "-Plugins", "ask", "-DSHome", homeDir],
  { input: "2,4\n", env: { ...process.env, DSH_INSTALL_FORCE_PROMPT: "1" } });
check("menu shows the multi-select hint", menu.out.includes("多选请用逗号隔开"));
check("menu lists numbered plugins", /1\)\s+\S+/.test(menu.out));
check("menu shows the Chinese descriptions", menu.out.includes("插件说明面板") || menu.out.includes("核心版本徽标"));
check("menu answer 2,4 selects exactly two", /would install : \S+,\S+\s*$|would install : \S+,\S+/.test(menu.out.replace(/\r/g, "")));
check("menu wrote nothing", !existsSync(join(homeDir, "profiles", "node_modules")));

console.log("7) -Command invocation (PowerShell array-splits 2,4 -> \"2 4\")");
const cmdRun = runCapture("pwsh", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
  `& '${installer}' -CheckOnly -Plugins 2,4 -DSHome '${homeDir}'; exit $LASTEXITCODE`]);
check("-Command form is tolerated", /would install : \S+/.test(cmdRun.out));

// --- 5. shipped updater -------------------------------------------------------
console.log("8) shipped updater (-CheckOnly must not write)");
const upd = runFile(updater, ["-CheckOnly", "-Plugins", "all", "-DSHome", updaterHome]);
check("updater exits 0", upd.code === 0, `exit=${upd.code}`);
check("updater reports the plugins as not installed", (upd.out.match(/未安装/g) || []).length >= 1);
check("updater used the bundled node", upd.out.includes("runtime") && upd.out.includes("node.exe"));
check("updater -CheckOnly wrote nothing", !existsSync(join(updaterHome, "profiles", "node_modules")));

// --- 6. runtime ---------------------------------------------------------------
console.log("9) first-run path: --extract-runtime");
// Invoke the exe DIRECTLY: it unpacks its bundled runtime.zip (~50 s on this box,
// idempotent) and prints "runtime ready in Ns". The previous version wrapped this in
// `powershell -Command "Start-Process -NoNewWindow ..."`, which needs a real console;
// with the file-based stdio this script now uses for sandbox compatibility that fails
// SILENTLY ($p stays null -> `exit $null` -> exit code 0 with nothing extracted, which
// on 2026-09-28 looked exactly like a shipped-package defect).
const extractRun = runCapture(join(pkgDir, "dsh-desktop.exe"), ["--extract-runtime"]);
check("--extract-runtime exits 0", extractRun.code === 0,
  `exit=${extractRun.code} ${extractRun.stderr.split(/\r?\n/).filter(Boolean).slice(-1)[0] || ""}`);
check("--extract-runtime produced runtime\\node.exe", existsSync(join(pkgDir, "runtime", "node.exe")),
  "no runtime\\node.exe after extraction");
const node = join(pkgDir, "runtime", "node.exe");
const entry = join(pkgDir, "runtime", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
const npmCLI = join(pkgDir, "runtime", "node_modules", "npm", "bin", "npm-cli.js");
const dshOut = runCapture(node, [entry, "--version"]).stdout.trim();
const npmOut = runCapture(node, [npmCLI, "--version"]).stdout.trim();
console.log(`   unpacked dsh: ${dshOut}   npm: ${npmOut}`);
check(`unpacked dsh reports ${EXPECTED}`, EXPECTED !== "" && dshOut === EXPECTED, `got ${dshOut}`);
check("unpacked npm runs", /^\d+\.\d+\.\d+/.test(npmOut), `got ${npmOut}`);

// --- 9b. variant invariant: is the LibreOffice engine in there or not? ---------
//
// This is THE thing that separates the two assets, so assert it instead of trusting
// the packer's log: the slim package must NOT carry the 325 MB engine, the full one
// MUST (a "full" asset that silently lost it is a silent regression - the two zips
// would then be identical in behaviour while differing in size claims).
const hasVariants = byVariant.has("slim") && byVariant.has("full");
function findLibreOfficeEngine(dir) {
  const hits = [];
  const walk = (d) => {
    let entries = [];
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      // The platform package is "libreoffice-kit-<platform>"; the loader itself is
      // "libreoffice-kit" and is expected in BOTH variants.
      if (/^libreoffice-kit-./.test(e.name)) { hits.push(join(d, e.name)); continue; }
      walk(join(d, e.name));
    }
  };
  walk(dir);
  return hits;
}
if (!hasVariants) {
  console.log("9b) variant invariant skipped (this release has no slim/full pair)");
} else {
  console.log(`9b) variant invariant (${VARIANT})`);
  const engines = findLibreOfficeEngine(join(pkgDir, "runtime"));
  const shown = engines.map((p) => p.replace(pkgDir, "<pkg>")).join(", ");
  if (VARIANT === "slim") {
    check("slim package does NOT bundle the LibreOffice engine", engines.length === 0, shown);
  } else {
    check("full package DOES bundle the LibreOffice engine", engines.length > 0,
      "no libreoffice-kit-<platform> under runtime\\node_modules - the full asset lost its engine");
  }
}

// --- 10. the bundled runtime must actually BOOT --------------------------------
//
// Regression guard (2026-09-24, HANDOVER §42): every package up to 0.1.12 bundled
// harness 0.1.5-rc.2, whose `dsh web` writes `"patchReload": "live"` into
// profiles/web/package.json. In a PORTABLE layout cordis-plugin-hmr IS resolvable, so
// the boot's live-patch-reload path runs, fails with "requires the Cordis HMR service"
// and the process exits 1 — a brand-new machine (no global install) could never start.
// It went unnoticed because on a machine WITH a global npm install that plugin happens
// not to resolve, so the very same error is swallowed. Hence: boot it here, against a
// fresh DSH_HOME, exactly like a first run does.
console.log("10) the bundled runtime boots against a fresh DSH_HOME");
const bootHome = join(root, "boot-home");
rmSync(bootHome, { recursive: true, force: true });
mkdirSync(bootHome, { recursive: true });
const bootOutPath = join(root, "boot-out.txt");
const bootErrPath = join(root, "boot-err.txt");
// stdio goes to FILES, never pipes: a pipe would need named pipes, which some sandboxes
// refuse, and a file also survives a crash for post-mortem reading.
const bootChild = spawn(node, [entry, "web", "--no-open", "--port", "0"], {
  env: { ...process.env, DSH_HOME: bootHome },
  stdio: ["ignore", openSync(bootOutPath, "w"), openSync(bootErrPath, "w")],
  windowsHide: true
});
let bootPort = "";
let bootUp = false;
const bootDeadline = Date.now() + 90000;
while (Date.now() < bootDeadline) {
  if (bootChild.exitCode !== null) break;
  await new Promise((r) => setTimeout(r, 1000));
  const text = existsSync(bootOutPath) ? readFileSync(bootOutPath, "utf8") : "";
  const found = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\//.exec(text);
  if (!found) continue;
  bootPort = found[1];
  try {
    const res = await fetch(`http://127.0.0.1:${bootPort}/`, { signal: AbortSignal.timeout(3000) });
    bootUp = res.status > 0; // 401 is the expected answer (browser-trust fence)
    if (bootUp) break;
  } catch { /* still coming up */ }
}
const bootAlive = bootChild.exitCode === null;
try { bootChild.kill(); } catch { /* already gone */ }
check("bundled runtime stays alive (no boot crash)", bootAlive, `exit=${bootChild.exitCode}`);
check("bundled runtime serves HTTP on its announced port", bootUp, bootPort ? `port ${bootPort}` : "no URL captured");
if (!bootAlive && existsSync(bootErrPath)) {
  const tail = readFileSync(bootErrPath, "utf8").split("\n").filter(Boolean).slice(0, 5);
  for (const line of tail) console.log(`   stderr: ${line.slice(0, 160)}`);
}
const profilePkg = join(bootHome, "profiles", "web", "package.json");
const profileText = existsSync(profilePkg) ? readFileSync(profilePkg, "utf8") : "";
check("profile template does not opt into live patch reload",
  !/"patchReload"\s*:\s*"live"/.test(profileText),
  profileText.replace(/\s+/g, " ").slice(0, 140));

console.log("");
console.log(`RESULT: ${pass} passed, ${fail} failed  (${TAG}, variant ${VARIANT})`);
process.exit(fail === 0 ? 0 : 1);
