// Host-side toggle test for dsh-client-ui-plugin-explainer.
// Imports the INSTALLED lib/index.js (so js-yaml resolves via parent-walk),
// fakes ctx/webServer, and exercises the /plugin-explainer/toggle handler
// against a COPY of the real cordis.patch.yml in a temp dir.
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const INSTALLED = "C:/Users/veken/.dsh/profiles/node_modules/dsh-client-ui-plugin-explainer/lib/index.js";
const REAL_PATCH = "C:/Users/veken/.dsh/profiles/web/cordis.patch.yml";

const mod = await import(pathToFileURL(INSTALLED).href);
if (typeof mod.apply !== "function" || !Array.isArray(mod.inject) || !(mod.PROTECTED_IDS instanceof Set)) {
  throw new Error("host module shape wrong: " + Object.keys(mod).join(","));
}
console.log("host exports OK, inject =", mod.inject.join(","), ", protected count =", mod.PROTECTED_IDS.size);

// --- temp profile dir with a copy of the real patch file ---
const tmp = mkdtempSync(join(tmpdir(), "dsh-toggle-test-"));
copyFileSync(REAL_PATCH, join(tmp, "cordis.patch.yml"));
console.log("temp patch dir:", tmp);

let route = null;
const ctx = {
  baseUrl: pathToFileURL(tmp).href + "/",
  effect: (fn) => fn(),
  webServer: {
    register: (r) => { route = r; return () => {}; }
  }
};
mod.apply(ctx);
if (!route || route.path !== "/plugin-explainer/toggle" || route.kind !== "exact") {
  throw new Error("route registration wrong: " + JSON.stringify(route && { path: route.path, kind: route.kind }));
}
console.log("route registered:", route.path);

// --- fake req/res ---
function makeReq(payload) {
  const body = JSON.stringify(payload);
  return {
    [Symbol.asyncIterator]: async function* () { yield body; }
  };
}
function call(payload) {
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

const patchText = () => readFileSync(join(tmp, "cordis.patch.yml"), "utf8");

// Case A: disable a toggleable plugin
let r = await call({ entryId: "include:tool-web", moduleName: "@deepseek-ai/dsh-tool-web", enabled: false });
if (r.status !== 200 || !r.json.ok || r.json.restartRequired !== true) throw new Error("A failed: " + JSON.stringify(r));
let text = patchText();
if (!text.includes("include:tool-web") || !text.includes("disabled: true")) throw new Error("A: disable not written:\n" + text);
if (!text.includes("plugin-explainer")) throw new Error("A: existing insert entry lost:\n" + text);
console.log("A disable OK");

// Case B: enable it again (override replaced, not duplicated)
r = await call({ entryId: "include:tool-web", moduleName: "@deepseek-ai/dsh-tool-web", enabled: true });
if (r.status !== 200 || !r.json.ok) throw new Error("B failed: " + JSON.stringify(r));
text = patchText();
const countTrue = (text.match(/id: include:tool-web/g) || []).length;
if (countTrue !== 1) throw new Error("B: duplicate override entries: " + countTrue);
if (!text.includes("disabled: false") || text.includes("disabled: true")) throw new Error("B: enable not written correctly:\n" + text);
console.log("B enable OK");

// Case C: protected entry rejected, file untouched
const before = patchText();
r = await call({ entryId: "include:session", moduleName: "@deepseek-ai/dsh-session", enabled: false });
if (r.status !== 403 || r.json.error.code !== "protected") throw new Error("C failed: " + JSON.stringify(r));
if (patchText() !== before) throw new Error("C: protected toggle modified the file");
console.log("C protected OK");

// Case D: bad payload
r = await call({ foo: 1 });
if (r.status !== 400) throw new Error("D failed: " + JSON.stringify(r));
console.log("D bad-request OK");

// Case E: missing patch file -> created
rmSync(join(tmp, "cordis.patch.yml"));
r = await call({ entryId: "include:tool-ralph", moduleName: "@deepseek-ai/dsh-tool-ralph", enabled: false });
if (r.status !== 200 || !r.json.ok) throw new Error("E failed: " + JSON.stringify(r));
if (!patchText().includes("include:tool-ralph")) throw new Error("E: file not created");
console.log("E missing-file OK");

rmSync(tmp, { recursive: true, force: true });
console.log("\nALL HOST TOGGLE TESTS PASSED");
