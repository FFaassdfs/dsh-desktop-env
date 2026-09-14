// core-version smoke test — runs the client bundle's load-time path under a
// stubbed browser-like environment (no DOM) and checks the exports contract.
//   node .work/core-version-smoke.test.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findReactSource, skipNotice } from "./lib/react-source.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(here, "..", "plugins", "dsh-client-ui-plugin-core-version", "lib", "client.js");
const source = readFileSync(bundlePath, "utf8");

// react no longer lives inside the dsh install (dsh >= 0.1.5) — see .work/lib/react-source.mjs
const reactSource = findReactSource();
if (!reactSource) {
	skipNotice("core-version smoke-test");
	process.exit(0);
}

// Stub browser globals the bundle touches at load time (document undefined so
// the CSS-guard branch is skipped, like SSR).
globalThis.window = {};
globalThis.document = undefined;
globalThis.fetch = undefined;

let loaded = null;
window.__ModuleLoader__ = {
	load(entry) {
		// require(): resolve react from the first base that actually has it.
		loaded = entry.factory(reactSource.require);
	}
};
const run = new Function("window", source);
run(window);

if (!loaded) throw new Error("ModuleLoader.load did not produce a module");
if (typeof loaded.apply !== "function") throw new Error("exports.apply missing");
if (typeof loaded.CoreVersionBadge !== "function") throw new Error("exports.CoreVersionBadge missing");

// apply() must be safe when document is missing (SSR/headless): no throw.
let applyThrew = null;
try {
	loaded.apply({ effect: () => {} });
} catch (error) {
	applyThrew = error;
}
if (applyThrew) throw new Error("apply() threw without document: " + applyThrew.message);

console.log("SMOKE OK: load-time clean; apply() no-op safe without document; exports: apply, CoreVersionBadge");
