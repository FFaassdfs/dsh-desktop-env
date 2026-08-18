// Host half of dsh-client-ui-plugin-explainer: a toggle route that rewrites
// the profile's user patch layer (cordis.patch.yml) so the "插件说明" tab can
// enable/disable loaded plugins. The Loader reads this file at boot (patch
// hot-reload requires the HMR service, disabled in production), so changes
// take effect on the next dsh restart.
//
// Route: POST /plugin-explainer/toggle  {entryId, moduleName, enabled}
//   disable -> writes { id, name, disabled: true }  (overrides bundle state)
//   enable  -> writes { id, name, disabled: false } (overrides any disable)
// Protected core entries are rejected with 403.
import * as yaml from "js-yaml";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// --- YAML dialect: same as dsh's entry-list schema (JSON_SCHEMA + !!js) ---
const JsExpr = new yaml.Type("tag:yaml.org,2002:js", {
	kind: "scalar",
	resolve: (data) => typeof data === "string",
	construct: (data) => ({ __jsExpr: data }),
	predicate: (value) => value !== null && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "__jsExpr"),
	represent: (data) => data["__jsExpr"]
});
const patchSchema = yaml.JSON_SCHEMA.extend(JsExpr);

const PATCH_FILENAME = "cordis.patch.yml";
const HEADER = `# Managed by dsh-client-ui-plugin-explainer (toggle buttons).
# dsh loads this user patch layer after every bundle layer.
`;

/**
 * Entry ids that must never be disabled from the UI — core infrastructure
 * whose absence breaks boot, the agent loop, or the web surface. Keep this
 * list in sync with the client copy in src/bundle.template.js (PROTECTED_IDS).
 */
const PROTECTED_IDS = new Set([
	"include",
	"include:timer", "include:llm", "include:session",
	"include:typert", "include:typert-loader", "include:typert-gateway",
	"include:settings", "include:credentials", "include:agent",
	"include:agent-default-model", "include:agent-loop", "include:tools",
	"include:system-prompt", "include:token-meter", "include:approval",
	"include:user-questions", "include:sandbox-policy", "include:shell-env",
	"include:subagent", "include:workflow-worker-thread", "include:jobs",
	"include:compaction-basic", "include:session-persistence-jsonl",
	"include:storage", "include:storage-json", "include:storage-domain",
	"include:session-projection", "include:session-projection-cache",
	"include:workspace", "include:subprocess", "include:sandbox",
	"include:bash-sandbox", "include:pwsh-sandbox", "include:fs-sandbox",
	"include:fs-observation-policy", "include:web", "include:llm-deepseek",
	"include:llm-retry", "include:api-gateway", "include:webserver",
	"include:web-runtime", "include:web-startup", "include:modules",
	"include:connection", "include:client-runtime", "include:api-remotes",
	"include:locale", "include:ui-layout", "include:ui-settings",
	"include:ui-conversation", "include:cordis-client-runner",
	"include:cordis-host-runner", "include:plugin-inventory",
	"include:directory-picker", "include:session-checkpoint-policy",
	"include:spill-local", "include:spill-policy", "include:timeout-policy",
	"include:agent-presets", "include:web-search-deepseek"
]);

function send(res, status, obj) {
	const body = JSON.stringify(obj);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(body)
	});
	res.end(body);
}

async function readBody(req) {
	let body = "";
	for await (const chunk of req) body += chunk;
	return body;
}

/**
 * Read the patch file, replace any pure override for `entryId` (entries whose
 * keys are only id/name/disabled) with `{id, name, disabled: !enabled}`, and
 * write the file back atomically (temp + rename). Existing insert/config
 * entries and unknown patches are preserved (comments are re-rendered by the
 * YAML dump — the managed header above survives).
 */
function writeToggleOverride(patchPath, entryId, moduleName, enabled) {
	let patches;
	try {
		const content = readFileSync(patchPath, "utf8");
		patches = yaml.load(content, { schema: patchSchema });
		if (!Array.isArray(patches)) throw new Error("cordis.patch.yml 顶层必须是补丁数组");
	} catch (error) {
		if (error && error.code === "ENOENT") {
			patches = [];
		} else {
			throw error;
		}
	}
	const kept = patches.filter((entry) => {
		if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return true;
		if (entry.id !== entryId) return true;
		const keys = Object.keys(entry);
		if (!keys.every((key) => key === "id" || key === "name" || key === "disabled")) return true;
		return false;
	});
	kept.push({ id: entryId, name: moduleName, disabled: !enabled });
	const dumped = yaml.dump(kept, { schema: patchSchema });
	const content = HEADER + dumped;
	const tmp = `${patchPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	writeFileSync(tmp, content, "utf8");
	renameSync(tmp, patchPath);
	return { entryId, enabled, restartRequired: true };
}

async function handleToggle(ctx, req, res) {
	let body;
	try {
		body = await readBody(req);
	} catch {
		return send(res, 400, { ok: false, error: { code: "bad-request", message: "无法读取请求体" } });
	}
	let payload;
	try {
		payload = JSON.parse(body || "{}");
	} catch {
		return send(res, 400, { ok: false, error: { code: "bad-request", message: "请求体不是合法 JSON" } });
	}
	const { entryId, moduleName, enabled } = payload;
	if (typeof entryId !== "string" || entryId.length === 0 || typeof moduleName !== "string" || typeof enabled !== "boolean") {
		return send(res, 400, { ok: false, error: { code: "bad-request", message: "需要 {entryId, moduleName, enabled}" } });
	}
	if (!enabled && PROTECTED_IDS.has(entryId)) {
		return send(res, 403, { ok: false, error: { code: "protected", message: `核心组件 ${entryId} 不可从界面停用` } });
	}
	let profileDir;
	try {
		profileDir = fileURLToPath(ctx.baseUrl);
	} catch {
		return send(res, 500, { ok: false, error: { code: "internal", message: "无法解析 profile 目录" } });
	}
	try {
		const result = writeToggleOverride(join(profileDir, PATCH_FILENAME), entryId, moduleName, enabled);
		return send(res, 200, { ok: true, ...result });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return send(res, 500, { ok: false, error: { code: "internal", message: `写入补丁失败: ${message}` } });
	}
}

/** Serialize toggles so concurrent clicks cannot interleave file writes. */
let writeChain = Promise.resolve();

const inject = ["webServer"];

function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/plugin-explainer/toggle",
		handler: (req, res) => {
			writeChain = writeChain.then(() => handleToggle(ctx, req, res)).catch(() => {});
			return writeChain;
		}
	}), "plugin-explainer: toggle route");
}

export { apply, inject, PROTECTED_IDS };
