// Smoke test for the dsh-client-ui-plugin-explainer client bundle.
// Runs in Node: stubs window.__ModuleLoader__, drives the factory with real
// react from the dsh install, verifies the plugin contract (exports/apply/
// slot registration) and that the component SSR-renders without crashing.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { findReactSource, loadReact, skipNotice } from "./lib/react-source.mjs";

const bundlePath = new URL("../plugins/dsh-client-ui-plugin-explainer/lib/client.js", import.meta.url);
const source = readFileSync(bundlePath, "utf8");

// react no longer lives inside the dsh install (dsh >= 0.1.5) — see .work/lib/react-source.mjs
const reactSource = findReactSource();
if (!reactSource) {
  skipNotice("explainer smoke-test");
  process.exit(0);
}

// ---- 1. capture the ModuleLoader definition ----
let captured = null;
globalThis.window = {
  __ModuleLoader__: {
    load: (def) => { captured = def; }
  }
};

// Evaluate the bundle so it calls window.__ModuleLoader__.load(...)
await import(bundlePath);
if (!captured || typeof captured.factory !== "function") throw new Error("bundle did not register with __ModuleLoader__");

// ---- 2. run the factory with a require shim (synchronous) ----
const preloaded = {
  "react": await awaitImport(reactSource.react),
  "react/jsx-runtime": await awaitImport(reactSource.jsxRuntime),
  "@deepseek-ai/dsh-client-ui-primitives": {
    // primitives is itself a ModuleLoader bundle; stub the two icons we use.
    IconSearchOutline16: () => null,
    IconChevronDownOutline14: () => null
  }
};
const requireShim = (spec) => {
  if (spec in preloaded) return preloaded[spec];
  throw new Error("unexpected require: " + spec);
};

async function awaitImport(path) {
  const mod = await import(pathToFileURL(path).href);
  // Use the module namespace directly: CJS interop exposes named exports there.
  return mod;
}

const factory = captured.factory;
const exportsObj = factory(requireShim);

// ---- 3. assert exports shape ----
if (exportsObj.NS !== "settings.pluginExplainer") throw new Error("NS mismatch: " + exportsObj.NS);
if (typeof exportsObj.apply !== "function") throw new Error("apply missing");
if (!Array.isArray(exportsObj.inject) || exportsObj.inject.length !== 4) throw new Error("inject shape wrong: " + JSON.stringify(exportsObj.inject));
console.log("exports OK:", exportsObj.NS, "inject=", exportsObj.inject.join(","));

// ---- 4. fake ctx + apply ----
const registrations = [];
const localeDicts = {};
const ctx = {
  effect: (fn, desc) => fn(),
  locale: {
    register: (ns, dicts) => { localeDicts[ns] = dicts; },
    bind: (ns) => (key, params) => {
      const dict = (localeDicts[ns] && localeDicts[ns].zh) ?? {};
      let template = (dict && dict[key]) ?? key;
      if (params) template = template.replace(/\{(\w+)\}/g, (m, name) => name in params ? String(params[name]) : m);
      return template;
    }
  },
  remote: {
    pluginInventory: {
      list: async () => ({ ok: true, value: { entries: [
        { entryId: "bash", moduleName: "@deepseek-ai/dsh-tool-bash", enabled: true, fiberPhase: "active" },
        { entryId: "hmr", moduleName: "@deepseek-ai/cordis-plugin-hmr", enabled: false, fiberPhase: null },
        { entryId: "unknown", moduleName: "@deepseek-ai/no-such-package", enabled: true, fiberPhase: "failed" }
      ] } })
    }
  },
  slots: {
    inject: (name, fn) => { registrations.push({ name, fn }); },
    register: (opts, component) => ({ ...opts, component })
  }
};

exportsObj.apply(ctx);

const tabReg = registrations.find((r) => r.name === "settings.plugins.tab");
if (!tabReg) throw new Error("settings.plugins.tab slot not injected");
const reg = tabReg.fn();
if (reg.id !== "explained" || reg.order !== 20 || reg.name !== "settings.plugins.tab") {
  throw new Error("tab registration wrong: " + JSON.stringify({ id: reg.id, order: reg.order, name: reg.name }));
}
console.log("slot registration OK: id=explained order=20");
const injectedProps = reg.inject();
const snapshot = await injectedProps.list();
if (snapshot.entries.length !== 3) throw new Error("list() wiring broken");
console.log("list() wiring OK (3 entries)");

// ---- 5. SSR render the component (loading state) ----
const { React, renderToStaticMarkup } = await loadReact(reactSource);
const t = ctx.locale.bind("settings.pluginExplainer");
const html = renderToStaticMarkup(React.createElement(reg.component, { list: injectedProps.list, t }));
if (!html.includes("正在读取插件")) throw new Error("SSR loading state missing: " + html.slice(0, 200));
console.log("SSR render OK (loading state)");

// ---- 6. dictionary embedded ----
const dict = JSON.parse(readFileSync(new URL("../plugins/dsh-client-ui-plugin-explainer/dictionary.json", import.meta.url), "utf8"));
let missing = 0;
for (const [key, value] of Object.entries(dict)) {
  if (!source.includes(JSON.stringify(key)) || !source.includes(JSON.stringify(value))) {
    missing++;
    console.log("MISSING in bundle:", key, "->", value);
  }
}
if (missing > 0) throw new Error(`${missing} dictionary entries missing from built bundle`);
console.log(`dictionary embedded OK (${Object.keys(dict).length} entries)`);

console.log("\nALL SMOKE CHECKS PASSED");
