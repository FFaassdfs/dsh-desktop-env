// Test suite for dsh-client-ui-plugin-model-sync.
//
// Part 1 drives the client bundle's PURE functions (candidate building, diff,
// composition, settings path ops) with a stubbed react, so it runs with or
// without react installed.
// Part 2 asserts the plugin contract: ModuleLoader registration, exports shape,
// the Remote service injection list, and the keyed slot registration.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** First existing file among candidates (dev tree vs installed tree). */
function firstExisting(urls) {
	for (const url of urls) if (existsSync(fileURLToPath(url))) return url;
	throw new Error("none of these exist: " + urls.map((u) => fileURLToPath(u)).join(", "));
}

const PKG = "dsh-client-ui-plugin-model-sync";
const bundleUrl = firstExisting([
	new URL(`../plugins/${PKG}/lib/client.js`, import.meta.url),
	new URL(`./lib/client.js`, import.meta.url)
]);
const configUrl = firstExisting([
	new URL(`../plugins/${PKG}/config.json`, import.meta.url),
	new URL(`./config.json`, import.meta.url)
]);

const source = readFileSync(bundleUrl, "utf8");
let captured = null;
globalThis.window = { __ModuleLoader__: { load: (def) => { captured = def; } } };
await import(bundleUrl.href);
if (!captured || typeof captured.factory !== "function") throw new Error("bundle did not register with __ModuleLoader__");
if (captured.id !== PKG) throw new Error("bundle id mismatch: " + captured.id);

// A stubbed react is enough: the factory only stores these references.
const reactStub = {
	useState: () => [void 0, () => {}],
	useCallback: (fn) => fn,
	useEffect: () => {}
};
const requireShim = (spec) => {
	if (spec === "react") return reactStub;
	if (spec === "react/jsx-runtime") return { jsx: () => ({}), jsxs: () => ({}) };
	throw new Error("unexpected require: " + spec);
};
const P = captured.factory(requireShim);
console.log("bundle loaded OK:", captured.id);

// ---- a tiny assertion helper ----
let checks = 0;
function eq(actual, expected, label) {
	const a = JSON.stringify(actual);
	const e = JSON.stringify(expected);
	if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
	checks += 1;
}
function ok(value, label) {
	if (!value) throw new Error(label + ": expected truthy");
	checks += 1;
}

//#region 1. id / url normalization
eq(P.normalizeModelId("deepseek/deepseek-v4-flash"), "deepseek-v4-flash", "strip provider prefix");
eq(P.normalizeModelId("GLM-5.3"), "glm-5.3", "lowercase id");
eq(P.normalizeModelId("  x  "), "x", "trim id");
eq(P.normalizeBaseUrl("https://X.example/v1/"), "https://x.example/v1", "normalize base url");
console.log("normalization OK");
//#endregion

//#region 2. modality filtering (dsh carries text + image only)
eq(P.keepModalities(["text", "image", "video", "audio", "pdf"]), ["text", "image"], "drop non-dsh modalities");
eq(P.keepModalities(["video"]), void 0, "no dsh modality left");
eq(P.keepModalities(void 0), void 0, "absent modalities");
console.log("modality filtering OK");
//#endregion

//#region 3. reasoning_options -> reasoningEfforts
eq(
	P.fromReasoningOptions([{ type: "toggle" }, { type: "effort", values: ["low", "high", "max"] }], true),
	{ off: null, low: "low", high: "high", max: "max" },
	"toggle + effort values"
);
eq(
	P.fromReasoningOptions([{ type: "effort", values: ["none", "high"] }], true),
	{ off: null, high: "high" },
	"none maps to off"
);
eq(P.fromReasoningOptions([{ type: "toggle" }], false), void 0, "non-reasoning model yields nothing");
eq(P.fromReasoningOptions([], true), void 0, "no options yields nothing");
eq(P.fromReasoningOptions([{ type: "effort", values: ["bogus"] }], true), void 0, "unknown levels ignored");
console.log("reasoning mapping OK");
//#endregion

//#region 4. source projections
const devEntry = {
	id: "qwen3.8-max",
	name: "Qwen3.8 Max",
	reasoning: true,
	reasoning_options: [{ type: "effort", values: ["high", "max"] }],
	modalities: { input: ["text", "image"], output: ["text"] },
	limit: { context: 1000000, output: 131072 }
};
eq(
	P.fromModelsDev(devEntry),
	{ id: "qwen3.8-max", name: "Qwen3.8 Max", contextWindow: 1000000, maxTokens: 131072, input: ["text", "image"], reasoningEfforts: { high: "high", max: "max" } },
	"models.dev projection"
);
eq(P.fromModelsDev({ id: "x", limit: { input: 4096 } }).contextWindow, 4096, "limit.input fallback");
eq(
	P.fromOpenRouter({ id: "deepseek/deepseek-v4-pro", name: "V4 Pro", context_length: 1048576, top_provider: { max_completion_tokens: 943718 }, architecture: { input_modalities: ["text", "image", "video"] } }),
	{ id: "deepseek/deepseek-v4-pro", name: "V4 Pro", contextWindow: 1048576, maxTokens: 943718, input: ["text", "image"] },
	"openrouter projection"
);
console.log("source projections OK");
//#endregion

//#region 5. models.dev provider matching
const catalog = {
	"alibaba-token-plan-cn": { api: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1", env: ["ALIBABA_TOKEN_PLAN_API_KEY"], models: {} },
	"other": { api: "https://other.example/v1", env: ["VEKENLLM_API_KEY"], models: {} }
};
eq(
	P.matchModelsDevProvider(catalog, { baseURL: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1", apiKeyEnv: "QWEN_TOKEN_PLAN_CN_API_KEY" })?.id,
	"alibaba-token-plan-cn",
	"baseURL wins over a differing env name"
);
eq(
	P.matchModelsDevProvider(catalog, { baseURL: "https://unmatched.example/v1", apiKeyEnv: "VEKENLLM_API_KEY" })?.id,
	"other",
	"env is the fallback when no baseURL matches"
);
eq(P.matchModelsDevProvider(catalog, { baseURL: "https://nope.example/v1", apiKeyEnv: "NOPE" }), void 0, "no match");
console.log("models.dev matching OK");
//#endregion

//#region 6. candidate priority: endpoint capacity wins, metadata fills gaps
const candidates = P.buildCandidates({
	endpoint: [{ id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", contextWindow: 393216, maxTokens: 393216 }],
	modelsDev: [
		{ id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", contextWindow: 1000000, maxTokens: 384000, input: ["text"], reasoningEfforts: { high: "high", max: "max" } },
		{ id: "glm-5.3", name: "GLM-5.3", contextWindow: 1000000, maxTokens: 131072, input: ["text", "image"] }
	],
	openRouter: [{ id: "deepseek/deepseek-v4-flash", input: ["text", "image"] }]
});
eq(candidates.length, 2, "endpoint + metadata-only candidate");
eq(candidates[0].contextWindow, 393216, "endpoint capacity is authoritative over models.dev");
eq(candidates[0].maxTokens, 393216, "endpoint output cap is authoritative");
eq(candidates[0].input, ["text"], "models.dev supplies modalities the endpoint lacks");
eq(candidates[0].reasoningEfforts, { high: "high", max: "max" }, "models.dev supplies reasoning levels");
eq(candidates[1].id, "glm-5.3", "metadata-only model is offered");
eq(candidates[0].borrowed, void 0, "provider-level metadata is authoritative, not borrowed");
// prefix-insensitive join: openrouter id "deepseek/deepseek-v4-flash" must not duplicate
eq(candidates.filter((c) => P.normalizeModelId(c.id) === "deepseek-v4-flash").length, 1, "no duplicate across id spellings");
console.log("candidate building OK");
//#endregion

//#region 6b. global fallback for a route models.dev does not list
// A self-hosted gateway (vekenllm) or a relay (ctai) is absent from models.dev,
// so provider matching fails and the same-named model's metadata is borrowed.
const flat = P.flattenCatalog({
	"z-ai": { models: { "glm-5.3-flash": { id: "glm-5.3-flash", name: "GLM-5.3-Flash", modalities: { input: ["text", "image", "video"] }, limit: { context: 1000000, output: 131072 } } } },
	"dup-holder": { models: { "glm-5.3-flash": { id: "glm-5.3-flash", name: "duplicate, loses" }, "only-here": { id: "only-here" } } }
});
eq(flat.length, 2, "flattenCatalog dedupes by normalized id");
eq(flat[0].name, "GLM-5.3-Flash", "first writer wins the dedupe");
const relay = P.buildCandidates({
	endpoint: [{ id: "glm-5.3-flash", name: "GLM 5.3 Flash", contextWindow: 1000000, maxTokens: 131072 }],
	modelsDev: [],
	globalModelsDev: flat,
	openRouter: []
});
eq(relay.length, 1, "metadata-only models are not invented for an unmatched route");
eq(relay[0].input, ["text", "image"], "global fallback supplies modalities");
eq(relay[0].contextWindow, 1000000, "endpoint capacity still wins over the borrowed entry");
eq(relay[0].borrowed, true, "borrowed metadata is flagged for verification");
// The `auto` case: a custom route name colliding with an unrelated model must
// never be presented as an adopted value.
eq(P.computeDiff([{ id: "auto", contextWindow: 32000, borrowed: true }], [{ id: "auto", contextWindow: 1000000 }], new Set())[0].borrowed, true, "diff carries the borrowed flag so the card leaves it unselected");
console.log("global fallback OK");
//#endregion

//#region 7. diff classification
const stored = [
	{ id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", contextWindow: 393216, maxTokens: 393216, input: ["text"] },
	{ id: "legacy-model", name: "Legacy", contextWindow: 8192 }
];
const diff = P.computeDiff(candidates, stored, new Set(["legacy-model"]));
const byId = new Map(diff.map((row) => [row.id, row]));
eq(byId.get("deepseek-v4-flash").kind, "changed", "newly learned field marks the row changed");
ok(byId.get("deepseek-v4-flash").changed.includes("reasoningEfforts"), "changed lists the newly learned field");
// capacity is compared too — probe it directly, since the row above matches on it
eq(
	P.computeDiff([{ id: "m", contextWindow: 100 }], [{ id: "m", contextWindow: 50 }], new Set())[0].changed,
	["contextWindow"],
	"capacity change detected"
);
eq(byId.get("deepseek-v4-flash").locked, false, "not pinned");
eq(byId.get("glm-5.3").kind, "added", "new candidate is an addition");
eq(byId.get("legacy-model").kind, "missing", "stored-but-unadvertised is reported, not deleted");
eq(byId.get("legacy-model").locked, true, "user-layer id is pinned");
eq(P.computeDiff(candidates, candidates.map((c) => ({ id: c.id, name: c.name, contextWindow: c.contextWindow, maxTokens: c.maxTokens, input: c.input, reasoningEfforts: c.reasoningEfforts })), new Set()).every((r) => r.kind === "unchanged"), true, "identical models are unchanged");
console.log("diff classification OK");
//#endregion

//#region 8. composition preserves everything not accepted
const accepted = new Map([
	["deepseek-v4-flash", { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", contextWindow: 1000000, maxTokens: 384000, input: ["text"] }],
	["glm-5.3", { id: "glm-5.3", name: "GLM-5.3", contextWindow: 1000000, maxTokens: 131072, input: ["text", "image"] }]
]);
const composed = P.composeModels(stored, accepted);
eq(composed.length, 3, "replaced + appended, untouched stored kept");
eq(composed[0].id, "deepseek-v4-flash", "position preserved");
eq(composed[0].contextWindow, 1000000, "accepted candidate replaces stored values");
eq(composed[1].id, "legacy-model", "unaccepted stored model is preserved verbatim");
eq(composed[2].id, "glm-5.3", "new model appended");
console.log("composition OK");
//#endregion

//#region 9. settings write shape
eq(P.buildOps("vekenllm", [{ id: "m" }]), [{ op: "set", path: ["providers", "vekenllm", "models"], value: [{ id: "m" }] }], "path-addressed op");
eq(P.toStoredModel({ id: "x" }), { id: "x" }, "minimal model stays minimal");
eq(
	P.toStoredModel({ id: "x", name: "X", contextWindow: 1, maxTokens: 2, input: ["text"], reasoningEfforts: { off: null } }),
	{ id: "x", name: "X", contextWindow: 1, maxTokens: 2, input: ["text"], reasoningEfforts: { off: null } },
	"full model projects every field"
);
console.log("write shape OK");
//#endregion

//#region 10. view readers
const view = {
	ns: "llm-pi-ai",
	revision: 7,
	value: { providers: { vekenllm: { baseURL: "http://192.168.100.63:4000/v1", api: "openai-completions", apiKeyEnv: "VEKENLLM_API_KEY", models: [{ id: "auto" }] } } },
	user: { providers: { vekenllm: { models: [{ id: "auto" }] } } }
};
const profile = P.profileOf(view, "vekenllm");
eq(profile.baseURL, "http://192.168.100.63:4000/v1", "profile baseURL read");
eq(profile.models.length, 1, "profile models read");
eq(P.profileOf(view, "absent"), void 0, "unknown route yields undefined");
eq([...P.pinnedIds(view, "vekenllm")], ["auto"], "user-layer ids are pinned");
eq([...P.pinnedIds({}, "x")].length, 0, "no user layer means no pins");
console.log("view readers OK");
//#endregion

//#region 11. plugin contract
eq(P.NS, "modelSync", "locale namespace");
ok(typeof P.apply === "function", "apply exported");
eq(P.inject, ["slots", "locale", "remote", "remote.llm", "remote.settings"], "injected services");

const localeDicts = {};
const slotThunks = [];
const remoteFaces = { settings: {}, llm: {} };
const ctx = {
	effect: (fn) => fn(),
	remote: remoteFaces,
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
		inject: (slot, thunk) => { slotThunks.push({ slot, thunk }); },
		register: (options, Component) => ({ options, Component })
	}
};
P.apply(ctx);
ok(localeDicts.modelSync?.zh && localeDicts.modelSync?.en, "zh + en dictionaries registered");

const config = JSON.parse(readFileSync(configUrl, "utf8"));
eq(slotThunks.length, config.settingsNamespaces.length, "one registration thunk per configured namespace");
const registrations = slotThunks.map(({ slot, thunk }) => ({ slot, reg: thunk() }));
for (const { slot, reg } of registrations) {
	eq(slot, "settings.models.provider-card", "registered into the official provider-card seat");
	eq(reg.options.name, "settings.models.provider-card", "registration names the seat");
	ok(config.settingsNamespaces.includes(reg.options.key), "registered under a configured settings namespace");
	ok(typeof reg.Component === "function", "component is a function");
}
// the card factory must close over the Remote faces (slot props carry no context)
const card = P.makeCard("llm-pi-ai", (k) => k, remoteFaces);
ok(typeof card === "function", "makeCard returns a component");
console.log("plugin contract OK (locale, keyed slot, component)");
//#endregion

//#region 12. config is embedded in the shipped bundle
for (const [key, value] of Object.entries(config)) {
	if (!source.includes(JSON.stringify(value))) throw new Error("config value missing from bundle: " + key);
}
console.log("config embedded OK (" + Object.keys(config).join(", ") + ")");
//#endregion

console.log(`\nALL MODEL-SYNC CHECKS PASSED (${checks} assertions)`);
