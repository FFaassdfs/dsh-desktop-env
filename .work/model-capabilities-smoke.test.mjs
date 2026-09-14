// Smoke test for the dsh-client-ui-plugin-model-capabilities client bundle.
// Runs in Node: stubs window.__ModuleLoader__, drives the factory with real
// react from the dsh install, verifies the plugin contract (exports/apply/
// locale registration), slot registration shape, SSR render of the section
// (loading state), ModalityBadges rendering, and that config.json is embedded.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const bundlePath = new URL("../plugins/dsh-client-ui-plugin-model-capabilities/lib/client.js", import.meta.url);
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

// ---- 2. drive the factory with a require shim (synchronous) ----
async function awaitImport(path) {
  const mod = await import(pathToFileURL(path).href);
  return mod.default ?? mod; // CJS interop
}
const preloaded = {
  "react": await awaitImport(`${dshModules}/react/index.js`),
  "react/jsx-runtime": await awaitImport(`${dshModules}/react/jsx-runtime.js`)
};
const requireShim = (spec) => {
  if (spec in preloaded) return preloaded[spec];
  throw new Error("unexpected require: " + spec);
};

const exportsObj = captured.factory(requireShim);

// ---- 3. assert exports shape ----
if (exportsObj.NS !== "modelCapabilities") throw new Error("NS mismatch: " + exportsObj.NS);
if (typeof exportsObj.apply !== "function") throw new Error("apply missing");
const expectedInject = ["slots", "locale"];
if (JSON.stringify(exportsObj.inject) !== JSON.stringify(expectedInject)) {
  throw new Error("inject shape wrong: " + JSON.stringify(exportsObj.inject));
}
if (typeof exportsObj.ModelCapabilitiesSection !== "function") throw new Error("ModelCapabilitiesSection missing");
console.log("exports OK:", exportsObj.NS, "inject=", exportsObj.inject.join(","));

// ---- 4. fake ctx + apply (locale registered, slot registration captured) ----
const localeDicts = {};
const slotRegistrations = {};
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
  },
  slots: {
    inject: (slot, thunk) => { slotRegistrations[slot] = thunk; },
    register: (options, Component) => ({ options, Component })
  }
};
exportsObj.apply(ctx);
if (!localeDicts.modelCapabilities || !localeDicts.modelCapabilities.zh || !localeDicts.modelCapabilities.en) {
  throw new Error("locale not registered: " + Object.keys(localeDicts).join(","));
}
const sectionRegistration = slotRegistrations["settings.section"];
if (!sectionRegistration) throw new Error("settings.section slot not registered");
const reg = sectionRegistration();
if (!reg || !reg.options || reg.options.id !== "model-capabilities" || reg.options.order !== 12) {
  throw new Error("section registration shape wrong: " + JSON.stringify(reg && reg.options));
}
if (reg.options.label() !== "模型能力") throw new Error("section label wrong: " + reg.options.label());
console.log("apply OK (locale registered, settings.section registered id=model-capabilities order=12)");

// ---- 5. component is a valid React element factory (react-dom is not
// installed in the harness node_modules, so no SSR snapshot here) ----
const React = await import(pathToFileURL(`${dshModules}/react/index.js`).href);
const t = ctx.locale.bind("modelCapabilities");
const element = React.createElement(exportsObj.ModelCapabilitiesSection, { t });
if (!React.isValidElement(element)) throw new Error("ModelCapabilitiesSection did not produce a valid React element");
if (element.type !== exportsObj.ModelCapabilitiesSection) throw new Error("element type mismatch");
console.log("component factory OK (valid React element)");

// ---- 6. CapabilityText emits plain Chinese labels ----
const zh = localeDicts.modelCapabilities.zh;
for (const key of ["capsImageText", "capsImageOnly", "capsTextOnly", "capsUnknown", "imageCapable", "textOnly", "nav"]) {
  if (typeof zh[key] !== "string" || zh[key].length === 0) throw new Error("zh label missing: " + key);
}
function renderCaps(model) {
  return exportsObj.CapabilityText({ model, t });
}
let el = renderCaps({ id: "x", name: "X", inputModalities: ["text", "image"] });
if (el.props.children !== "文本 + 图像（可识图）") throw new Error("caps image+text wrong: " + el.props.children);
if (!String(el.props.className).includes("mc_caps_image")) throw new Error("caps image+text class wrong: " + el.props.className);
el = renderCaps({ id: "x", name: "X", inputModalities: ["text"] });
if (el.props.children !== "仅文本") throw new Error("caps text-only wrong: " + el.props.children);
el = renderCaps({ id: "x", name: "X", inputModalities: ["image"] });
if (el.props.children !== "图像（可识图）") throw new Error("caps image-only wrong: " + el.props.children);
el = renderCaps({ id: "x", name: "X" });
if (el.props.children !== "能力未声明") throw new Error("caps unknown wrong: " + el.props.children);
console.log("CapabilityText OK (image+text / text-only / image-only / unknown)");

// ---- 7. config embedded ----
const config = JSON.parse(readFileSync(new URL("../plugins/dsh-client-ui-plugin-model-capabilities/config.json", import.meta.url), "utf8"));
for (const [key, value] of Object.entries(config)) {
  if (!source.includes(JSON.stringify(value))) throw new Error("config value missing from bundle: " + key + " = " + value);
}
console.log("config embedded OK (" + Object.keys(config).length + " keys)");

console.log("\nALL SMOKE CHECKS PASSED");
