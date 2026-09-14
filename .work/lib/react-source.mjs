// react-source.mjs — locate a usable react / react-dom for the client-bundle
// smoke tests (.work/*smoke*.test.mjs, .work/smoke-test.mjs).
//
// Why this exists: those tests used to hardcode
//   C:/Users/veken/nodejs/node-v24.16.0-win-x64/node_modules/@deepseek-ai/dsh/node_modules
// which only worked while dsh shipped react inside its own install (<= 0.1.2-rc.1).
// dsh 0.1.5-rc.1 bundles react into the web frontend dist instead, so that path is
// gone (the $DSH_HOME/profiles/node_modules junction farm still has dangling
// react/react-dom junctions pointing at it). See HANDOVER.md §21.
//
// Candidates, in order:
//   1. .work/test-deps/node_modules                  (repo-local — recommended: `npm install` there)
//   2. <repo>/node_modules                           (if someone installs react at the root)
//   3. $DSH_HOME/profiles/node_modules               (junction farm; only if the junction resolves)
//   4. <global npm root>/@deepseek-ai/dsh/node_modules  (dsh <= 0.1.2 layout)
//
// When react cannot be resolved, callers print skipNotice() and exit 0 — the tests
// stay runnable on a machine without them instead of reporting a false regression.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Repository root (this file lives in <repo>/.work/lib/). */
export const repoRoot = join(here, "..", "..");

/** Candidate module bases, most specific first. */
export function reactCandidates() {
  const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
  const list = [
    join(repoRoot, ".work", "test-deps", "node_modules"),
    join(repoRoot, "node_modules"),
    join(dshHome, "profiles", "node_modules")
  ];
  // npm -g on Windows installs into %APPDATA%\npm\node_modules.
  if (process.env.APPDATA) list.push(join(process.env.APPDATA, "npm", "node_modules", "@deepseek-ai", "dsh", "node_modules"));
  return list;
}

function resolveFrom(base) {
  const require = createRequire(join(base, "noop.js"));
  const pick = (spec) => {
    try {
      return require.resolve(spec);
    } catch {
      return null;
    }
  };
  const react = pick("react");
  if (!react) return null;
  return {
    base,
    require,
    react,
    jsxRuntime: pick("react/jsx-runtime"),
    reactDomServer: pick("react-dom/server"),
    reactDomClient: pick("react-dom/client")
  };
}

/**
 * @returns {{base:string, require:NodeRequire, react:string, jsxRuntime:string|null,
 *            reactDomServer:string|null, reactDomClient:string|null} | null}
 */
export function findReactSource() {
  for (const base of reactCandidates()) {
    if (!existsSync(base)) continue;
    const found = resolveFrom(base);
    if (found) return found;
  }
  return null;
}

/** Load the react modules behind a resolved source (CJS interop: prefer `.default`). */
export async function loadReact(source) {
  const importFile = async (p) => {
    const mod = await import(pathToFileURL(p).href);
    return mod.default ?? mod;
  };
  const out = {
    React: await importFile(source.react),
    jsxRuntime: null,
    renderToStaticMarkup: null,
    reactDomClient: null
  };
  if (source.jsxRuntime) out.jsxRuntime = await importFile(source.jsxRuntime);
  if (source.reactDomServer) out.renderToStaticMarkup = (await importFile(source.reactDomServer)).renderToStaticMarkup;
  if (source.reactDomClient) out.reactDomClient = await importFile(source.reactDomClient);
  return out;
}

/** Print the actionable "cannot test here" notice (tests then exit 0). */
export function skipNotice(testName) {
  console.log(`SKIP ${testName}: react/react-dom not resolvable — client-bundle checks skipped.`);
  console.log("     enable them with:  cd .work/test-deps && npm install");
  console.log("     (dsh >= 0.1.5 no longer ships react in its own node_modules)");
}
