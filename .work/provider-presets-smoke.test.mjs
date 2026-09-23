// Smoke test for the dsh-client-ui-plugin-provider-presets client bundle.
// Runs in Node with REAL react: stubs window.__ModuleLoader__, drives the
// factory, verifies the plugin contract (exports / apply / locale registration /
// footer slot registration), server-renders the panel, and checks that
// config.json is embedded in the shipped bundle.
//
// It complements .work/provider-presets.test.mjs: that suite asserts the loaded
// panel's decisions through controlled hooks, this one proves the tree is a
// valid React tree with the real runtime. Neither needs a DOM.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { findReactSource, loadReact, skipNotice } from "./lib/react-source.mjs";

const PKG = "dsh-client-ui-plugin-provider-presets";
const bundlePath = new URL(`../plugins/${PKG}/lib/client.js`, import.meta.url);
const configPath = new URL(`../plugins/${PKG}/config.json`, import.meta.url);
const source = readFileSync(bundlePath, "utf8");

// react no longer lives inside the dsh install (dsh >= 0.1.5) — see .work/lib/react-source.mjs
const reactSource = findReactSource();
if (!reactSource) {
  skipNotice("provider-presets smoke-test");
  process.exit(0);
}

let checks = 0;
function ok(value, label) {
  if (!value) throw new Error(label + ": expected truthy");
  checks += 1;
}
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
  checks += 1;
}

// ---- 1. capture the ModuleLoader definition ----
let captured = null;
globalThis.window = { __ModuleLoader__: { load: (def) => { captured = def; } } };
await import(bundlePath.href);
ok(captured && typeof captured.factory === "function", "bundle registers a factory");
eq(captured.id, PKG, "bundle id");

// ---- 2. drive the factory with the real react ----
const importFile = async (path) => {
  const mod = await import(pathToFileURL(path).href);
  return mod.default ?? mod; // CJS interop
};
const preloaded = {
  "react": await importFile(reactSource.react),
  "react/jsx-runtime": await importFile(reactSource.jsxRuntime)
};
const P = captured.factory((spec) => {
  if (spec in preloaded) return preloaded[spec];
  throw new Error("unexpected require: " + spec);
});

// ---- 3. exports shape ----
eq(P.NS, "providerPresets", "locale namespace");
ok(typeof P.apply === "function", "apply exported");
eq(P.inject, ["slots", "locale", "remote", "remote.credentials", "remote.settings"], "injected services");
console.log("exports OK:", P.NS, "inject=", P.inject.join(","));

// ---- 4. apply: locale + footer slot ----
const localeDicts = {};
const slotRegistrations = {};
const ctx = {
  effect: (fn) => fn(),
  get: () => void 0,
  locale: {
    register: (ns, dicts) => { localeDicts[ns] = dicts; },
    bind: (ns) => (key, params) => {
      const dict = localeDicts[ns]?.zh ?? {};
      let template = dict[key] ?? key;
      if (params) template = template.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
      return template;
    }
  },
  slots: {
    inject: (slot, thunk) => { slotRegistrations[slot] = thunk; },
    register: (options, Component) => ({ options, Component })
  }
};
P.apply(ctx);
ok(localeDicts.providerPresets?.zh && localeDicts.providerPresets?.en, "zh + en dictionaries registered");
const thunk = slotRegistrations["settings.models.footer"];
ok(typeof thunk === "function", "settings.models.footer slot registered");
const registration = thunk();
// `settings.models.footer` is a LIST seat: the registry's contract marks `id` as
// required, and a registration missing it is refused with nothing rendered at all
// (HANDOVER §38). Assert the whole option set so the requirement cannot be dropped.
eq(registration.options, { name: "settings.models.footer", id: "provider-presets" }, "registration options (list seat needs id)");
ok(typeof registration.Component === "function", "registered component is a function");
console.log("apply OK (locale registered, settings.models.footer registered)");

// ---- 5. SSR render (the skeleton state) ----
const { React, renderToStaticMarkup } = await loadReact(reactSource);
ok(typeof renderToStaticMarkup === "function", "react-dom/server is available");
const element = React.createElement(registration.Component);
ok(React.isValidElement(element), "the panel produces a valid React element");
const html = renderToStaticMarkup(element);
for (const needle of ["预置供应商", "预置 3 个供应商", "正在读取配置", "刷新"]) {
  ok(html.includes(needle), "server-rendered panel contains " + JSON.stringify(needle));
}
ok(html.includes("pp_wrap"), "the panel carries its own class namespace");
console.log("SSR render OK (" + html.length + " bytes of markup)");

// ---- 6. config is embedded in the shipped bundle ----
const config = JSON.parse(readFileSync(configPath, "utf8"));
eq(config.presets.map((p) => p.route), ["vekenllm", "ctai", "vekenllm-tech"], "shipped preset routes");
for (const [key, value] of Object.entries(config)) {
  ok(source.includes(JSON.stringify(value)), "config value embedded: " + key);
}
console.log("config embedded OK (" + Object.keys(config).join(", ") + ")");

console.log(`\nALL PROVIDER-PRESETS SMOKE CHECKS PASSED (${checks} assertions)`);
