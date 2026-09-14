// Host half of dsh-client-ui-plugin-core-version.
// The ONLY thing the browser cannot do on its own is learn the installed core
// version: the official web app exposes no version endpoint, __DSH_BOOT__
// carries only a content hash, and the client-side DSH_CLIENT_VERSION constant
// is private to the official bundles. So this host half registers one tiny
// localhost route that reads the version from the installed package metadata.
//
// Route:
//   GET/POST /plugin-core-version/version
//     -> {ok:true, version:"0.1.5-rc.1"}   (example; always the installed version)
//     -> {ok:false, error:{code,message}} when no candidate package resolves
//
// Version resolution order (first hit wins): the globally installed
// @deepseek-ai/dsh package, then its nested @deepseek-ai/dsh-web-app and
// @deepseek-ai/dsh-base siblings. All live under $DSH_HOME/profiles/node_modules
// (the same tree this plugin is installed into), so createRequire from this
// file resolves them through normal node_modules lookup.
import { createRequire } from "node:module";

const CANDIDATES = [
	"@deepseek-ai/dsh/package.json",
	"@deepseek-ai/dsh-web-app/package.json",
	"@deepseek-ai/dsh-base/package.json"
];

// --- version resolution -----------------------------------------------------
/** Read the installed core version from package metadata; "" when unresolvable. */
export function readCoreVersion() {
	const requireFromPlugin = createRequire(import.meta.url);
	for (const spec of CANDIDATES) {
		try {
			const pkg = requireFromPlugin(spec);
			if (pkg && typeof pkg.version === "string" && pkg.version !== "") return pkg.version;
		} catch {
			// try the next candidate
		}
	}
	return "";
}

// --- tiny http helpers (same style as the sibling plugins) ------------------
function send(res, status, obj) {
	const body = JSON.stringify(obj);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(body),
		"Cache-Control": "no-store"
	});
	res.end(body);
}

export function handleVersion(req, res) {
	const version = readCoreVersion();
	if (version === "") {
		send(res, 500, { ok: false, error: { code: "internal", message: "cannot resolve installed core version" } });
		return;
	}
	send(res, 200, { ok: true, version });
}

// --- cordis entry -----------------------------------------------------------
const inject = ["webServer"];

function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/plugin-core-version/version",
		handler: handleVersion
	}), "core-version: version route");
}

export { apply, inject };
