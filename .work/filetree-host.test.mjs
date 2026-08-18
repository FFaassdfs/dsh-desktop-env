// Host-side test for dsh-client-ui-plugin-project-explorer.
// Imports the repo lib/index.js, fakes ctx/webServer, and exercises the
// /root + /list handlers against a temp directory tree (no dsh instance
// needed — pure Node, mirrors .work/host-toggle-test.mjs).
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const HOST = "D:/opencode/001/dsh-desktop/plugins/dsh-client-ui-plugin-project-explorer/lib/index.js";
const mod = await import(pathToFileURL(HOST).href);
if (typeof mod.apply !== "function" || !Array.isArray(mod.inject) || !mod.inject.includes("webServer")) {
  throw new Error("host module shape wrong: " + Object.keys(mod).join(","));
}
console.log("host exports OK, inject =", mod.inject.join(","));

// --- fake ctx/webServer, capture routes ---
const routes = {};
const ctx = {
  effect: (fn) => fn(),
  webServer: {
    register: (r) => { routes[r.path] = r; return () => {}; }
  }
};
mod.apply(ctx);
const rootPath = "/plugin-project-explorer/root";
const listPath = "/plugin-project-explorer/list";
const openPath = "/plugin-project-explorer/open";
if (routes[rootPath]?.kind !== "exact" || routes[listPath]?.kind !== "exact" || routes[openPath]?.kind !== "exact") {
  throw new Error("routes wrong: " + Object.keys(routes).join(","));
}
console.log("routes registered:", Object.keys(routes).join(", "));

// --- fake req/res ---
function makeReq(payload) {
  const body = JSON.stringify(payload);
  return { [Symbol.asyncIterator]: async function* () { yield body; } };
}
function call(route, payload) {
  const result = { status: 0, body: "" };
  const res = {
    writeHead: (s) => { result.status = s; },
    end: (b) => { result.body = b; }
  };
  return route.handler(makeReq(payload), res).then(() => {
    result.json = JSON.parse(result.body);
    return result;
  });
}

// --- fixture tree ---
const tmp = mkdtempSync(join(tmpdir(), "dsh-filetree-test-"));
try {
  const root = join(tmp, "project");
  mkdirSync(join(root, "src", "utils"), { recursive: true });
  mkdirSync(join(root, ".git"), { recursive: true });
  mkdirSync(join(root, "node_modules"), { recursive: true });
  writeFileSync(join(root, "src", "main.ts"), "export const x = 1;\n");
  writeFileSync(join(root, "src", "utils", "helper.ts"), "export const y = 2;\n");
  writeFileSync(join(root, "package.json"), "{}\n");
  writeFileSync(join(root, "README.md"), "# demo\n");
  writeFileSync(join(root, "debug.log"), "noise\n");
  writeFileSync(join(root, "src", "notes.txt"), "hello\n");

  // Case A: /root with valid sessionCwd
  let r = await call(routes[rootPath], { sessionCwd: root });
  if (r.status !== 200 || !r.json.ok || r.json.resolvedVia !== "session" || r.json.rootName !== "project") {
    throw new Error("A failed: " + JSON.stringify(r.json));
  }
  console.log("A root(session) OK ->", r.json.root);

  // Case B: /root without sessionCwd -> fallback to process.cwd()
  r = await call(routes[rootPath], {});
  if (r.status !== 200 || !r.json.ok || r.json.resolvedVia !== "fallback") {
    throw new Error("B failed: " + JSON.stringify(r.json));
  }
  console.log("B root(fallback) OK ->", r.json.root);

  // Case C: /root with invalid sessionCwd -> fallback
  r = await call(routes[rootPath], { sessionCwd: join(tmp, "nope") });
  if (r.status !== 200 || r.json.resolvedVia !== "fallback") throw new Error("C failed: " + JSON.stringify(r.json));
  console.log("C root(invalid->fallback) OK");

  // Case D: /list on root: dirs first, ignores applied
  r = await call(routes[listPath], { sessionCwd: root, path: root });
  if (r.status !== 200 || !r.json.ok) throw new Error("D failed: " + JSON.stringify(r.json));
  const names = r.json.entries.map((e) => e.name);
  const kinds = r.json.entries.map((e) => e.kind);
  if (kinds[0] !== "dir") throw new Error("D: dirs not first: " + names.join(","));
  for (const hidden of [".git", "node_modules", "debug.log"]) {
    if (names.includes(hidden)) throw new Error("D: ignore list violated: " + hidden);
  }
  const expected = ["src", "package.json", "README.md"];
  for (const e of expected) if (!names.includes(e)) throw new Error("D: missing " + e + " in " + names.join(","));
  const src = r.json.entries.find((e) => e.name === "src");
  if (src.kind !== "dir") throw new Error("D: src should be dir");
  console.log("D list(root) OK ->", names.join(","));

  // Case E: nested list + file sizes
  r = await call(routes[listPath], { sessionCwd: root, path: join(root, "src") });
  if (r.status !== 200) throw new Error("E failed: " + JSON.stringify(r.json));
  const nested = r.json.entries.map((e) => `${e.name}:${e.kind}`);
  if (nested.join("|") !== "utils:dir|main.ts:file|notes.txt:file") throw new Error("E wrong: " + nested.join("|"));
  const mainTs = r.json.entries.find((e) => e.name === "main.ts");
  if (mainTs.size !== 20) throw new Error("E wrong size: " + mainTs.size);
  console.log("E list(nested) OK ->", nested.join(","));

  // Case F: path outside root -> 403
  r = await call(routes[listPath], { sessionCwd: root, path: tmp });
  if (r.status !== 403 || r.json.error.code !== "forbidden") throw new Error("F failed: " + JSON.stringify(r.json));
  console.log("F outside-root 403 OK");

  // Case G: nonexistent path -> 400
  r = await call(routes[listPath], { sessionCwd: root, path: join(root, "missing") });
  if (r.status !== 400) throw new Error("G failed: " + JSON.stringify(r.json));
  console.log("G missing-path 400 OK");

  // Case H: missing path field -> 400
  r = await call(routes[listPath], { sessionCwd: root });
  if (r.status !== 400) throw new Error("H failed: " + JSON.stringify(r.json));
  console.log("H missing-field 400 OK");

  // Case I: listing a file -> 400
  r = await call(routes[listPath], { sessionCwd: root, path: join(root, "package.json") });
  if (r.status !== 400) throw new Error("I failed: " + JSON.stringify(r.json));
  console.log("I file-as-dir 400 OK");

  // Case J: symlink inside root (best effort — Windows may lack privilege)
  let symlinkOk = true;
  try {
    symlinkSync(join(root, "src"), join(root, "src-link"), "junction");
  } catch {
    symlinkOk = false;
  }
  if (symlinkOk) {
    r = await call(routes[listPath], { sessionCwd: root, path: root });
    const link = r.json.entries.find((e) => e.name === "src-link");
    if (!link || link.kind !== "dir") throw new Error("J: symlink not resolved as dir: " + JSON.stringify(link));
    console.log("J symlink OK");
  } else {
    console.log("J symlink skipped (no privilege)");
  }

  // --- /open route ---
  // K: missing path -> 400 (route; no explorer spawned on validation failure)
  r = await call(routes[openPath], { sessionCwd: root });
  if (r.status !== 400) throw new Error("K failed: " + JSON.stringify(r.json));
  console.log("K open missing-path 400 OK");

  // L: nonexistent path -> 400
  r = await call(routes[openPath], { sessionCwd: root, path: join(root, "nope") });
  if (r.status !== 400) throw new Error("L failed: " + JSON.stringify(r.json));
  console.log("L open missing-path 400 OK");

  // M: outside root -> 403
  r = await call(routes[openPath], { sessionCwd: root, path: tmp });
  if (r.status !== 403) throw new Error("M failed: " + JSON.stringify(r.json));
  console.log("M open outside-root 403 OK");

  // N: success — direct handleOpen with injected fake openFn (no explorer)
  const opened = [];
  r = await call({ handler: (req, res) => mod.handleOpen(req, res, async (target, isDir) => { opened.push({ target, isDir }); }) }, { sessionCwd: root, path: join(root, "src") });
  if (r.status !== 200 || !r.json.ok || opened.length !== 1 || opened[0].isDir !== true) {
    throw new Error("N failed: " + JSON.stringify(r.json) + " opened=" + JSON.stringify(opened));
  }
  r = await call({ handler: (req, res) => mod.handleOpen(req, res, async (target, isDir) => { opened.push({ target, isDir }); }) }, { sessionCwd: root, path: join(root, "package.json") });
  if (r.status !== 200 || opened.length !== 2 || opened[1].isDir !== false) {
    throw new Error("N2 failed: " + JSON.stringify(r.json) + " opened=" + JSON.stringify(opened));
  }
  console.log("N open success OK (dir -> plain, file -> /select)");

  console.log("\nALL HOST TESTS PASSED");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
