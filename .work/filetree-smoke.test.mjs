// Smoke test for the dsh-client-ui-plugin-project-explorer client bundle.
// Runs in Node: stubs window.__ModuleLoader__, drives the factory with real
// react from the dsh install, verifies the plugin contract (exports/apply/
// locale registration), toRelative path logic, SSR render of the panel
// (loading state — effects do not run under renderToStaticMarkup), and that
// the built bundle embeds config.json.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const bundlePath = new URL("../plugins/dsh-client-ui-plugin-project-explorer/lib/client.js", import.meta.url);
const source = readFileSync(bundlePath, "utf8");

const dshModules = "C:/Users/veken/nodejs/node-v24.16.0-win-x64/node_modules/@deepseek-ai/dsh/node_modules";

// ---- 1. capture the ModuleLoader definition ----
let captured = null;
globalThis.window = {
  __ModuleLoader__: {
    load: (def) => { captured = def; }
  }
};

await import(bundlePath);
if (!captured || typeof captured.factory !== "function") throw new Error("bundle did not register with __ModuleLoader__");

// ---- 2. run the factory with a require shim (synchronous) ----
async function awaitImport(path) {
  const mod = await import(pathToFileURL(path).href);
  return mod.default ?? mod; // CJS interop: prefer the exports object
}
const preloaded = {
  "react": await awaitImport(`${dshModules}/react/index.js`),
  "react/jsx-runtime": await awaitImport(`${dshModules}/react/jsx-runtime.js`),
  "react-dom/client": await awaitImport(`${dshModules}/react-dom/client.js`)
};
const requireShim = (spec) => {
  if (spec in preloaded) return preloaded[spec];
  throw new Error("unexpected require: " + spec);
};

const factory = captured.factory;
const exportsObj = factory(requireShim);

// ---- 3. assert exports shape ----
if (exportsObj.NS !== "projectExplorer") throw new Error("NS mismatch: " + exportsObj.NS);
if (typeof exportsObj.apply !== "function") throw new Error("apply missing");
const expectedInject = ["slots", "locale", "sessions", "conversation"];
if (JSON.stringify(exportsObj.inject) !== JSON.stringify(expectedInject)) {
  throw new Error("inject shape wrong: " + JSON.stringify(exportsObj.inject));
}
if (typeof exportsObj.toRelative !== "function") throw new Error("toRelative missing");
console.log("exports OK:", exportsObj.NS, "inject=", exportsObj.inject.join(","));

// ---- 4. toRelative logic ----
const cases = [
  ["C:/proj", "C:/proj/src/a.ts", "src/a.ts"],
  ["C:/proj/", "C:/proj/src/a.ts", "src/a.ts"],
  ["C:\\proj", "C:\\proj\\src\\a.ts", "src/a.ts"],
  ["C:/proj", "C:/proj", "."],
  ["C:/proj", "C:/other/b.ts", "C:/other/b.ts"],
  ["D:/repo", "d:/repo/pkg/x.js", "pkg/x.js"],
  ["", "C:/x/y.ts", "C:/x/y.ts"]
];
for (const [root, file, want] of cases) {
  const got = exportsObj.toRelative(root, file);
  if (got !== want) throw new Error(`toRelative(${root}, ${file}) = ${got}, want ${want}`);
}
console.log("toRelative OK (" + cases.length + " cases)");

// ---- 5. fake ctx + apply (no document in Node -> DOM skipped) ----
const localeDicts = {};
const ctx = {
  effect: (fn) => fn(),
  get: () => void 0,
  locale: {
    register: (ns, dicts) => { localeDicts[ns] = dicts; },
    bind: (ns) => (key, params) => {
      const dict = (localeDicts[ns] && localeDicts[ns].zh) ?? {};
      let template = (dict && dict[key]) ?? key;
      if (params) template = template.replace(/\{(\w+)\}/g, (m, name) => name in params ? String(params[name]) : m);
      return template;
    }
  }
};
exportsObj.apply(ctx);
if (!localeDicts.projectExplorer || !localeDicts.projectExplorer.zh) {
  throw new Error("locale not registered: " + Object.keys(localeDicts).join(","));
}
console.log("apply OK (locale registered, DOM skipped in Node)");

// ---- 6. SSR render the panel (loading state — effects do not run) ----
const React = await import(pathToFileURL(`${dshModules}/react/index.js`).href);
const { renderToStaticMarkup } = await import(pathToFileURL(`${dshModules}/react-dom/server.js`).href);
const t = ctx.locale.bind("projectExplorer");
const html = renderToStaticMarkup(React.createElement(exportsObj.ProjectExplorerPanel, { ctx, t }));
if (!html.includes("正在解析项目目录")) throw new Error("SSR loading state missing: " + html.slice(0, 200));
if (!html.includes("dshPe_root")) throw new Error("panel root class missing");
console.log("SSR render OK (loading state)");

// ---- 6b. TreeRow render paths (expanding a folder must never crash) ----
function renderTree(node, expanded, tree, extra) {
  return renderToStaticMarkup(React.createElement(exportsObj.TreeRow, {
    node,
    depth: 0,
    expanded: new Set(expanded),
    tree,
    t,
    onToggle: () => {},
    onRowDragStart: () => {},
    ...extra
  }));
}
// ready folder with files + subdir
const readyTree = {
  "/p/src": { status: "ready", entries: [
    { name: "a.ts", path: "/p/src/a.ts", kind: "file", size: 10 },
    { name: "sub", path: "/p/src/sub", kind: "dir", size: 0 }
  ], truncated: false, error: null }
};
let out = renderTree({ name: "src", path: "/p/src", kind: "dir", size: 0 }, ["/p/src"], readyTree);
if (!out.includes("a.ts") || !out.includes("sub")) throw new Error("ready folder render wrong: " + out.slice(0, 300));
console.log("TreeRow ready OK");
// loading folder
out = renderTree({ name: "src", path: "/p/src", kind: "dir", size: 0 }, ["/p/src"], { "/p/src": { status: "loading", entries: [], truncated: false, error: null } });
if (!out.includes("加载中")) throw new Error("loading folder render wrong");
console.log("TreeRow loading OK");
// error folder
out = renderTree({ name: "src", path: "/p/src", kind: "dir", size: 0 }, ["/p/src"], { "/p/src": { status: "error", entries: [], truncated: false, error: "boom" } });
if (!out.includes("boom")) throw new Error("error folder render wrong");
console.log("TreeRow error OK");
// truncated + empty
out = renderTree({ name: "e", path: "/p/e", kind: "dir", size: 0 }, ["/p/e"], { "/p/e": { status: "ready", entries: [], truncated: true, error: null } });
if (!out.includes("空目录") || !out.includes("截断")) throw new Error("truncated/empty render wrong");
console.log("TreeRow empty+truncated OK");
// nested recursion: sub expanded with its own children
const nestedTree = {
  "/p/src": { status: "ready", entries: [{ name: "sub", path: "/p/src/sub", kind: "dir", size: 0 }], truncated: false, error: null },
  "/p/src/sub": { status: "ready", entries: [{ name: "deep.ts", path: "/p/src/sub/deep.ts", kind: "file", size: 3 }], truncated: false, error: null }
};
out = renderTree({ name: "src", path: "/p/src", kind: "dir", size: 0 }, ["/p/src", "/p/src/sub"], nestedTree);
if (!out.includes("deep.ts")) throw new Error("nested render wrong: " + out.slice(0, 400));
console.log("TreeRow nested OK");
// file row (not expandable)
out = renderTree({ name: "a.ts", path: "/p/a.ts", kind: "file", size: 5 }, [], {});
if (!out.includes("a.ts")) throw new Error("file row render wrong");
console.log("TreeRow file OK");

// ---- 7. config embedded ----
const config = JSON.parse(readFileSync(new URL("../plugins/dsh-client-ui-plugin-project-explorer/config.json", import.meta.url), "utf8"));
for (const [key, value] of Object.entries(config)) {
  if (!source.includes(JSON.stringify(value))) throw new Error("config value missing from bundle: " + key + " = " + value);
}
console.log("config embedded OK (" + Object.keys(config).length + " keys)");

console.log("\nALL SMOKE CHECKS PASSED");
