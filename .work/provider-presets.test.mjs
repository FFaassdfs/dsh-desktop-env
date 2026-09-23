// Test suite for dsh-client-ui-plugin-provider-presets.
//
// Part 1 drives the client bundle's PURE functions (profile projection, settings
// path ops, drift comparison, key grammar, row decisions) with a stubbed react,
// so it runs with or without react installed.
// Part 2 drives the two-Remote data path (`readSnapshot`) and a full
// enable -> verify -> disable round trip against a FAKE host that applies the
// path ops the way the settings seam does.
// Part 3 asserts the plugin contract: ModuleLoader registration, exports shape,
// the Remote service injection list, and the list-slot registration.
// Part 4 guards the artifact itself: every preset must pass the HOST'S OWN
// pi-ai schema, and the bundle must not carry any locally stored credential.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** First existing file among candidates (dev tree vs installed tree). */
function firstExisting(urls) {
	for (const url of urls) if (existsSync(fileURLToPath(url))) return url;
	throw new Error("none of these exist: " + urls.map((u) => fileURLToPath(u)).join(", "));
}

const PKG = "dsh-client-ui-plugin-provider-presets";
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
/** Assert that running fn throws, and that the message contains `needle`. */
function throws(fn, needle, label) {
	try {
		fn();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (needle && !message.includes(needle)) throw new Error(`${label}: message ${JSON.stringify(message)} lacks ${JSON.stringify(needle)}`);
		checks += 1;
		return;
	}
	throw new Error(label + ": expected a throw");
}

const config = JSON.parse(readFileSync(configUrl, "utf8"));
const VEK = config.presets.find((p) => p.route === "vekenllm");
const CTAI = config.presets.find((p) => p.route === "ctai");
ok(VEK && CTAI, "config carries both presets");

//#region 1. profile projection
const vekProfile = P.profileOf(VEK);
eq(Object.keys(vekProfile), ["displayName", "apiKeyEnv", "api", "baseURL", "compat", "models"], "profile field order matches settings.yaml");
eq(vekProfile.title, void 0, "presentation keys are not written");
eq(vekProfile.summary, void 0, "summary is not written");
eq(vekProfile.baseURL, "http://192.168.100.63:4000/v1", "baseURL projected");
eq(vekProfile.apiKeyEnv, "VEKENLLM_API_KEY", "credential reference projected");
eq(vekProfile.models.map((m) => m.id), ["deepseek-v4-flash", "auto"], "models projected in order");
// deep copy: mutating the projection must not touch the preset (or CONFIG)
{
	const copy = P.profileOf(VEK);
	copy.models[0].id = "mutated";
	copy.compat.thinkingFormat = "mutated";
	eq(VEK.models[0].id, "deepseek-v4-flash", "projection does not alias the preset models");
	eq(VEK.compat.thinkingFormat, "deepseek", "projection does not alias the preset compat");
}
// a preset without compat must not gain an empty one
const bare = P.profileOf({ route: "x", api: "openai-completions", baseURL: "https://x/v1", apiKeyEnv: "X_API_KEY", models: [{ id: "m" }] });
eq(Object.keys(bare), ["apiKeyEnv", "api", "baseURL", "models"], "absent compat is not invented");
eq(Object.keys(bare.models[0]), ["id"], "only stated model fields survive");
console.log("profile projection OK");
//#endregion

//#region 2. settings path ops
eq(P.buildEnableOps(VEK), [{ op: "set", path: ["providers", "vekenllm"], value: vekProfile }], "enable writes one path-addressed set");
eq(P.buildDisableOps("ctai"), [{ op: "unset", path: ["providers", "ctai"] }], "disable unsets exactly that route");
// the whole point of path ops: one route's write cannot touch another's subtree
for (const preset of config.presets) {
	const ops = P.buildEnableOps(preset);
	eq(ops.length, 1, "one op per enable");
	eq(ops[0].path, ["providers", preset.route], "op addresses the preset route only");
	ok(ops[0].path.length === 2, "op is scoped below the namespace root");
}
console.log("settings path ops OK");
//#endregion

//#region 3. model signature + drift
const sigModels = [{ id: "b", contextWindow: 2 }, { id: "a", contextWindow: 1 }];
eq(P.modelSignature(sigModels).map((m) => m.id), ["a", "b"], "signature sorts by id");
eq(P.modelSignature(sigModels), P.modelSignature([...sigModels].reverse()), "signature is order-insensitive");
eq(P.modelSignature(void 0), [], "absent models yield an empty signature");

eq(P.driftFields(vekProfile, vekProfile), [], "identical profile does not drift");
eq(P.driftFields({ ...vekProfile, baseURL: "http://other/v1" }, vekProfile), ["baseURL"], "baseURL drift detected");
eq(P.driftFields({ ...vekProfile, models: [...vekProfile.models].reverse() }, vekProfile), [], "reordered models are not drift");
eq(P.driftFields({ ...vekProfile, models: [{ id: "auto" }] }, vekProfile), ["models"], "model set drift detected");
eq(P.driftFields({ ...vekProfile, compat: {} }, vekProfile), ["compat"], "compat drift detected");
eq(P.driftFields({ ...vekProfile, displayName: "renamed", api: "anthropic-messages" }, vekProfile), ["displayName", "api"], "multiple drifts in profile order");
console.log("drift comparison OK");
//#endregion

//#region 4. preset state
const emptyView = { ns: "llm-pi-ai", revision: 3, value: {}, user: {} };
eq(P.presetState(emptyView, VEK), { enabled: false, userOwned: false, drifted: [], modelCount: 0 }, "absent route is not enabled");
const enabledView = {
	ns: "llm-pi-ai",
	revision: 4,
	value: { providers: { vekenllm: vekProfile } },
	user: { providers: { vekenllm: vekProfile } }
};
eq(P.presetState(enabledView, VEK), { enabled: true, userOwned: true, drifted: [], modelCount: 2 }, "installed route reads back clean");
// a route resolved from a composition BASE is enabled but not user-owned
const inheritedView = { ns: "llm-pi-ai", revision: 1, value: { providers: { vekenllm: vekProfile } } };
eq(P.presetState(inheritedView, VEK).userOwned, false, "base-layer route is not user-owned");
eq(P.presetState({ ns: "llm-pi-ai", revision: 1, value: { providers: { vekenllm: null } } }, VEK).enabled, false, "a null route is not enabled");
console.log("preset state OK");
//#endregion

//#region 5. key state
eq(P.keyStateOf({ configured: true, writable: true, source: "file" }), "set", "configured key");
eq(P.keyStateOf({ configured: false, writable: true }), "missing", "missing writable key");
eq(P.keyStateOf({ configured: false, writable: false }), "readonly", "unconfigured and unwritable");
eq(P.keyStateOf(void 0), "unknown", "unknown reference");
console.log("key state OK");
//#endregion

//#region 6. key grammar (mirrors the official Models page)
eq(P.validateApiKey("sk-abc123"), "", "an ordinary key passes");
eq(P.validateApiKey("  sk-abc123  "), "", "surrounding whitespace is trimmed, not rejected");
eq(P.validateApiKey(""), "keyEmpty", "empty field");
eq(P.validateApiKey("   "), "keyEmpty", "whitespace-only field");
eq(P.validateApiKey("sk-abc 123"), "keyFormat", "inner space is illegal");
eq(P.validateApiKey("sk-abc\n123"), "keyFormat", "newline is illegal");
eq(P.validateApiKey("\"sk-abc123\""), "keyFormat", "double-quoted value rejected");
eq(P.validateApiKey("'sk-abc123'"), "keyFormat", "single-quoted value rejected");
eq(P.validateApiKey("sk-中文"), "keyFormat", "non-ASCII rejected");
eq(P.validateApiKey("VEKENLLM_API_KEY=sk-abc123"), "keyFormat", "pasted NAME=value line rejected");
eq(P.validateApiKey("ABCD=="), "", "base64 padding is not mistaken for an assignment");
eq(P.isQuoted("`x`"), true, "backtick pair detected");
eq(P.isQuoted("\"x"), false, "unbalanced quote is not a quoted value");
console.log("key grammar OK");
//#endregion

//#region 7. readSnapshot over the two Remotes
function applyOps(view, ops) {
	const value = JSON.parse(JSON.stringify(view.value ?? {}));
	const user = JSON.parse(JSON.stringify(view.user ?? {}));
	value.providers = value.providers ?? {};
	user.providers = user.providers ?? {};
	for (const op of ops) {
		const head = op.path[0];
		const route = op.path[1];
		if (head !== "providers" || route === void 0) throw new Error("unexpected path: " + JSON.stringify(op.path));
		if (op.op === "set") {
			value.providers[route] = op.value;
			user.providers[route] = op.value;
		} else if (op.op === "unset") {
			delete value.providers[route];
			delete user.providers[route];
		} else {
			throw new Error("unexpected op: " + op.op);
		}
	}
	return { ...view, value, user, revision: view.revision + 1 };
}

/** A fake host: settings + credentials, applying ops the way the seam does. */
function makeRemote(view, options = {}) {
	const state = { view, mutateCalls: [], credentialWrites: [] };
	return {
		state,
		settings: {
			describe: async () => options.describeFails
				? { ok: false, error: { code: "x", message: options.describeFails } }
				: { ok: true, value: { writable: options.writable !== false, hasDocument: true, namespaces: options.noNamespaces ? [] : [state.view] } },
			mutate: async (ns, ops, revision) => {
				state.mutateCalls.push({ ns, ops, revision });
				if (options.conflict) return { ok: false, error: { code: "settings/conflict", message: "stale revision" } };
				if (revision !== state.view.revision) return { ok: false, error: { code: "settings/conflict", message: "stale revision" } };
				state.view = applyOps(state.view, ops);
				return { ok: true, value: state.view };
			}
		},
		credentials: {
			describe: async (refs) => options.credsFail
				? { ok: false, error: { code: "x", message: options.credsFail } }
				: {
					ok: true,
					value: Object.fromEntries(refs.map((ref) => [ref, { configured: (options.configured ?? []).includes(ref), writable: options.credWritable !== false }]))
				},
			set: async (ref, value) => {
				state.credentialWrites.push({ ref, value });
				return { ok: true, value: void 0 };
			},
			unset: async (ref) => {
				state.credentialWrites.push({ ref, value: null });
				return { ok: true, value: void 0 };
			}
		}
	};
}

{
	const remote = makeRemote(emptyView, { configured: ["CTAI_API_KEY"] });
	const snapshot = await P.readSnapshot(remote, "llm-pi-ai", config.presets);
	eq(snapshot.writable, true, "writability read from the settings seam");
	eq(snapshot.view.revision, 3, "revision carried for fencing");
	eq(Object.keys(snapshot.keys).sort(), ["CTAI_API_KEY", "VEKENLLM_API_KEY"], "both credential references described");
	eq(P.keyStateOf(snapshot.keys.CTAI_API_KEY), "set", "ctai key configured");
	eq(P.keyStateOf(snapshot.keys.VEKENLLM_API_KEY), "missing", "vekenllm key missing");
	eq(snapshot.keysError, "", "no credential error");
}
{
	// credential seam down: profiles must still be installable
	const remote = makeRemote(emptyView, { credsFail: "no credential provider mounted" });
	const snapshot = await P.readSnapshot(remote, "llm-pi-ai", config.presets);
	eq(snapshot.keys, {}, "credential failure yields no key state");
	ok(snapshot.keysError.includes("no credential provider"), "credential failure is reported");
	eq(snapshot.writable, true, "profile writes stay available");
}
{
	const remote = makeRemote(emptyView);
	await P.readSnapshot(remote, "llm-deepseek", config.presets).then(
		() => { throw new Error("expected a rejection for a missing namespace"); },
		(error) => ok(String(error.message).includes("not registered"), "missing namespace rejected")
	);
}
console.log("readSnapshot OK (both Remotes, degradation, missing namespace)");
//#endregion

//#region 8. enable -> verify -> disable round trip
{
	const remote = makeRemote({ ns: "llm-pi-ai", revision: 7, value: {}, user: {} });
	const before = await P.readSnapshot(remote, "llm-pi-ai", config.presets);
	eq(P.presetState(before.view, VEK).enabled, false, "starts disabled");

	// enable ctai first, so we can prove the second write leaves it alone
	const enableCtai = await remote.settings.mutate("llm-pi-ai", P.buildEnableOps(CTAI), before.view.revision);
	eq(enableCtai.ok, true, "enable ctai accepted");
	eq(P.presetState(enableCtai.value, CTAI), { enabled: true, userOwned: true, drifted: [], modelCount: 3 }, "ctai resolves with 3 models");

	const fresh = await P.readSnapshot(remote, "llm-pi-ai", config.presets);
	const enableVek = await remote.settings.mutate("llm-pi-ai", P.buildEnableOps(VEK), fresh.view.revision);
	eq(enableVek.ok, true, "enable vekenllm accepted");
	eq(P.presetState(enableVek.value, VEK).modelCount, 2, "vekenllm resolves with 2 models");
	eq(enableVek.value.value.providers.ctai.models.length, 3, "the other route survived the write");
	eq(enableVek.value.user.providers.vekenllm.baseURL, "http://192.168.100.63:4000/v1", "written profile is exactly the preset");
	eq(enableVek.value.value.revision, void 0, "the returned view carries no stray revision field");
	eq(enableVek.value.revision, 9, "revision advanced by both writes");

	// a stale revision must be refused, never silently applied
	const stale = await remote.settings.mutate("llm-pi-ai", P.buildDisableOps("vekenllm"), before.view.revision);
	eq(stale.ok, false, "stale revision refused");
	eq(stale.error.code, "settings/conflict", "refusal names the conflict");

	// disable only removes its own route
	const disable = await remote.settings.mutate("llm-pi-ai", P.buildDisableOps("vekenllm"), enableVek.value.revision);
	eq(disable.ok, true, "disable accepted");
	eq(P.presetState(disable.value, VEK).enabled, false, "vekenllm is gone");
	eq(P.presetState(disable.value, CTAI).enabled, true, "ctai is untouched by the disable");
	eq(remote.state.mutateCalls.length, 4, "every write went through the settings Remote");
	eq(remote.state.credentialWrites.length, 0, "no settings action ever touched a credential");
}
console.log("enable/disable round trip OK");
//#endregion

//#region 9. row decisions (tags, actions, confirmation arming)
// Drive the panel's own locale binding, so the asserted strings are the shipped ones.
const localeDicts = {};
const slotThunks = [];
const remoteFaces = makeRemote(emptyView);
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
const zh = ctx.locale.bind("providerPresets");

{
	const snapshot = { writable: true, view: emptyView, keys: { VEKENLLM_API_KEY: { configured: false, writable: true } }, keysError: "" };
	const row = P.describeRow(VEK, snapshot, zh, "");
	eq(row.state.enabled, false, "row state disabled");
	eq(row.tags.map((tag) => tag.text), ["未启用", "密钥缺失"], "disabled + missing key tags");
	eq(row.tags.map((tag) => tag.kind), ["off", "bad"], "tag kinds drive the colours");
	eq(row.actions.map((a) => a.id), ["enable"], "only enable is offered");
	eq(row.actions[0].kind, "primary", "enable is the primary action");
	eq(row.actions[0].text, "启用", "enable label");
	ok(row.meta.includes("http://192.168.100.63:4000/v1"), "meta names the endpoint");
	ok(row.meta.includes("预置 2 个模型"), "meta counts the preset models");
	ok(!row.meta.includes("已存"), "a disabled row has no stored count");
}
{
	const stored = { ...vekProfile, models: [{ id: "auto" }] };
	const view = { ns: "llm-pi-ai", revision: 5, value: { providers: { vekenllm: stored } }, user: { providers: { vekenllm: { models: [{ id: "auto" }] } } } };
	const snapshot = { writable: true, view, keys: { VEKENLLM_API_KEY: { configured: true, writable: true, source: "file" } }, keysError: "" };
	const row = P.describeRow(VEK, snapshot, zh, "");
	eq(row.state.drifted, ["models"], "drift found in the stored models");
	eq(row.tags.map((tag) => tag.text), ["已启用", "与预置不一致", "你改过的配置", "密钥已配置（来源 file）"], "enabled + drift + owned + key tags");
	eq(row.actions.map((a) => a.id), ["reset", "disable"], "drifted row offers reset and disable");
	eq(row.actions.map((a) => a.kind), ["plain", "danger"], "reset is neutral, disable is destructive");
	ok(row.meta.includes("差异字段：models"), "meta lists the drifting fields");
	ok(row.meta.includes("已存 1 个模型"), "meta counts stored models");
}
{
	// confirmation arming changes only the destructive action's label
	const view = { ns: "llm-pi-ai", revision: 5, value: { providers: { vekenllm: vekProfile } }, user: {} };
	const snapshot = { writable: true, view, keys: {}, keysError: "" };
	eq(P.describeRow(VEK, snapshot, zh, "").actions.map((a) => a.text), ["停用"], "unarmed disable");
	eq(P.describeRow(VEK, snapshot, zh, "vekenllm:disable").actions.map((a) => a.text), ["确认停用（删除配置）"], "armed disable asks to confirm");
	eq(P.describeRow(VEK, snapshot, zh, "ctai:disable").actions.map((a) => a.text), ["停用"], "another route's arming does not arm this one");
	eq(P.describeRow(VEK, snapshot, zh, "").tags.at(-1).text, "密钥状态未知", "an undescribed reference reads as unknown");
}
console.log("row decisions OK");
//#endregion

//#region 10. plugin contract
eq(P.NS, "providerPresets", "locale namespace");
ok(typeof P.apply === "function", "apply exported");
eq(P.inject, ["slots", "locale", "remote", "remote.credentials", "remote.settings"], "injected services");
ok(localeDicts.providerPresets?.zh && localeDicts.providerPresets?.en, "zh + en dictionaries registered");
eq(slotThunks.length, 1, "one registration thunk");
eq(slotThunks[0].slot, "settings.models.footer", "registered into the official Models footer seat");
const registration = slotThunks[0].thunk();
eq(registration.options.name, "settings.models.footer", "registration names the seat");
ok(typeof registration.Component === "function", "component is a function");

// The seat CONTRACT, read from the installed client registry itself. Its manifest
// carries a machine-generated `registerOptions` list per seat, and registering
// without a `requirement: "required"` option is REFUSED — which renders nothing at
// all, silently, with no error on the page. That is exactly how `settings.models.footer`
// (a LIST seat, needing `id`) shipped broken while `settings.models.provider-card`
// (a key seat, needing only `key`) worked: see HANDOVER §38.
{
	const registryCandidates = [
		join(process.env.DSH_HOME || join(homedir(), ".dsh"), "profiles", "node_modules", "@deepseek-ai", "dsh-cordis-client-runner", "lib", "client.js"),
		process.env.APPDATA ? join(process.env.APPDATA, "npm", "node_modules", "@deepseek-ai", "dsh", "node_modules", "@deepseek-ai", "dsh-cordis-client-runner", "lib", "client.js") : ""
	].filter(Boolean);
	const registry = registryCandidates.find((path) => existsSync(path));
	if (!registry) {
		console.log("SKIP seat-contract check: dsh-cordis-client-runner not found");
	} else {
		const manifest = readFileSync(registry, "utf8");
		const seatIndex = manifest.indexOf('"' + registration.options.name + '"');
		ok(seatIndex > 0, "the registry manifest describes the seat we register into");
		const optionsStart = manifest.indexOf("registerOptions", seatIndex);
		ok(optionsStart > 0, "the seat declares its registerOptions contract");
		// the option list ends at the next "]" that closes registerOptions
		const block = manifest.slice(optionsStart, manifest.indexOf("]", optionsStart) + 1);
		const required = [...block.matchAll(/name:\s*"([^"]+)",\s*requirement:\s*"required"/g)].map((m) => m[1]);
		ok(required.length > 0, "the seat marks at least one option required");
		for (const field of required) {
			ok(field in registration.options, `registration supplies the required "${field}" option`);
		}
		// a key seat is the one that wants `key`; ours must not confuse the two
		if (!required.includes("key")) {
			eq("key" in registration.options, false, "we do not pass a key to a seat that does not take one");
		}
		console.log(`seat contract OK (${registration.options.name} requires: ${required.join(", ")})`);
	}
}
// the panel must close over the Remote faces (footer props are intentionally empty)
const panel = P.makePanel("llm-pi-ai", zh, remoteFaces);
ok(typeof panel === "function", "makePanel returns a component");
// every locale key the panel can ask for must exist in both dictionaries
for (const dict of [localeDicts.providerPresets.zh, localeDicts.providerPresets.en]) {
	for (const key of ["title", "subtitle", "loading", "refresh", "refreshing", "statusEnabled", "statusDisabled", "statusDrifted", "statusOwned",
		"driftFields", "modelCount", "storedCount", "keySet", "keySetFrom", "keyMissing", "keyUnknown", "keyReadonly",
		"enable", "enabling", "reset", "confirmReset", "resetting", "disable", "confirmDisable", "disabling",
		"keyLabel", "keyPlaceholder", "saveKey", "savingKey", "clearKey", "clearingKey",
		"enabled", "disabled", "keySaved", "keyCleared", "keyEmpty", "keyFormat", "keyFailed",
		"conflict", "readOnly", "verifyMismatch", "settingsFailed", "credsFailed", "namespaceMissing", "hint"]) {
		if (typeof dict[key] !== "string" || dict[key] === "") throw new Error("locale key missing: " + key);
	}
}
console.log("plugin contract OK (locale, footer slot, component)");
//#endregion

//#region 11. config integrity + the bundle carries what config states
eq(config.settingsNs, "llm-pi-ai", "presets install into llm-pi-ai");
eq(config.presets.map((p) => p.route), ["vekenllm", "ctai"], "preset order");
for (const preset of config.presets) {
	ok(/^https?:\/\//.test(preset.baseURL), preset.route + ": baseURL is an http(s) URL");
	eq(preset.api, "openai-completions", preset.route + ": wire protocol");
	ok(/^[A-Z][A-Z0-9_]*$/.test(preset.apiKeyEnv), preset.route + ": credential reference is an env-var name");
	ok(preset.models.length > 0, preset.route + ": at least one model");
	for (const model of preset.models) ok(typeof model.id === "string" && model.id !== "", preset.route + ": model id");
	// the preset may state ONLY route-profile + presentation fields
	const allowed = new Set(["route", "title", "summary", "displayName", "apiKeyEnv", "api", "baseURL", "compat", "models"]);
	for (const field of Object.keys(preset)) {
		if (!allowed.has(field)) throw new Error(`${preset.route}: unexpected preset field ${field}`);
	}
}
for (const [key, value] of Object.entries(config)) {
	if (!source.includes(JSON.stringify(value))) throw new Error("config value missing from bundle: " + key);
}
console.log("config integrity OK (" + Object.keys(config).join(", ") + ")");
//#endregion

//#region 12. the artifact carries no credential
{
	const SECRET_FIELDS = ["key", "apikey", "api_key", "token", "secret", "password", "authorization"];
	const walk = (node, path, problems) => {
		if (node === null || typeof node !== "object") return;
		for (const [field, value] of Object.entries(node)) {
			if (SECRET_FIELDS.includes(field.toLowerCase())) problems.push(`${path}.${field}`);
			walk(value, `${path}.${field}`, problems);
		}
	};
	const problems = [];
	walk(config, "config", problems);
	eq(problems, [], "no credential-shaped field anywhere in the shipped presets");

	// the decisive check: nothing the local credential store holds may appear in
	// the bundle. This is the assertion that would have caught a pasted key.
	const credPath = join(process.env.DSH_HOME || join(homedir(), ".dsh"), ".credentials.yaml");
	if (existsSync(credPath)) {
		const text = readFileSync(credPath, "utf8");
		const values = [];
		for (const line of text.split(/\r?\n/)) {
			const match = /^\s*[A-Z][A-Z0-9_]*:\s*(\S+)\s*$/.exec(line);
			if (match && match[1].length >= 8) values.push(match[1]);
		}
		ok(values.length > 0, "the local credential store was actually parsed");
		for (const value of values) {
			if (source.includes(value)) throw new Error("a stored credential value leaked into lib/client.js");
		}
		console.log(`no-credential guard OK (${values.length} stored value(s) checked against the bundle)`);
	} else {
		console.log("no-credential guard: no local .credentials.yaml found, field-name scan only");
	}
}
//#endregion

//#region 13. the presets pass the HOST'S OWN schema
{
	const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
	const candidates = [
		join(dshHome, "profiles", "node_modules", "@deepseek-ai", "dsh-llm-pi-ai", "lib", "index.js"),
		process.env.APPDATA ? join(process.env.APPDATA, "npm", "node_modules", "@deepseek-ai", "dsh", "node_modules", "@deepseek-ai", "dsh-llm-pi-ai", "lib", "index.js") : ""
	].filter(Boolean);
	const found = candidates.find((path) => existsSync(path));
	if (!found) {
		console.log("SKIP host-schema check: @deepseek-ai/dsh-llm-pi-ai not found");
	} else {
		const piAi = await import(pathToFileURL(found).href);
		ok(typeof piAi.Config === "function", "pi-ai exports its namespace Config schema");
		const providers = {};
		for (const preset of config.presets) providers[preset.route] = P.profileOf(preset);
		const resolved = piAi.Config({ providers });
		for (const preset of config.presets) {
			const round = resolved.providers[preset.route];
			eq(round.models.map((m) => m.id), preset.models.map((m) => m.id), preset.route + ": the host schema keeps every model id");
			eq(round.api, preset.api, preset.route + ": protocol survives validation");
			eq(round.baseURL, preset.baseURL, preset.route + ": endpoint survives validation");
			eq(round.apiKeyEnv, preset.apiKeyEnv, preset.route + ": credential reference survives validation");
			for (const model of round.models) {
				ok(Number.isInteger(model.contextWindow) && model.contextWindow > 0, preset.route + "/" + model.id + ": contextWindow is a positive integer");
				ok(Number.isInteger(model.maxTokens) && model.maxTokens > 0, preset.route + "/" + model.id + ": maxTokens is a positive integer");
				for (const modality of model.input ?? []) ok(["text", "image"].includes(modality), preset.route + "/" + model.id + ": modality " + modality);
			}
		}
		ok(piAi.supportedProtocols().includes("openai-completions"), "openai-completions is a supported protocol");
		// a valueless level must survive as null (how "off" is spelled)
		eq(resolved.providers.ctai.models.find((m) => m.id === "qwen3.8-flash").reasoningEfforts.off, null, "the off level survives as null");
		console.log("host-schema conformance OK (both presets validate against @deepseek-ai/dsh-llm-pi-ai)");
	}
}
//#endregion

//#region 14. the LOADED panel renders its decisions
// Renders the real component with controlled hook values and collecting jsx
// stubs, so the loaded card markup is asserted without a DOM (the panel's data
// arrives through an effect, which SSR alone would never run).
{
	const snapshot = {
		writable: true,
		view: {
			ns: "llm-pi-ai",
			revision: 11,
			value: { providers: { vekenllm: { ...vekProfile, models: [{ id: "auto" }] } } },
			user: { providers: { vekenllm: { models: [{ id: "auto" }] } } }
		},
		keys: { VEKENLLM_API_KEY: { configured: true, writable: true, source: "file" }, CTAI_API_KEY: { configured: false, writable: true } },
		keysError: ""
	};
	const render = (hookValues, remote = remoteFaces) => {
		let index = 0;
		const instance = captured.factory((spec) => {
			if (spec === "react") {
				return {
					useState: () => [hookValues[index++], () => {}],
					useCallback: (fn) => fn,
					useEffect: () => {}
				};
			}
			if (spec === "react/jsx-runtime") {
				const make = (type, props) => ({ type, props: props ?? {} });
				return { jsx: make, jsxs: make };
			}
			throw new Error("unexpected require: " + spec);
		});
		return instance.makePanel("llm-pi-ai", zh, remote)();
	};
	/** Flatten a stubbed element tree into its text and its elements. */
	const collect = (node, acc = { text: [], elements: [] }) => {
		if (node === null || node === void 0 || node === false) return acc;
		if (typeof node === "string" || typeof node === "number") {
			acc.text.push(String(node));
			return acc;
		}
		if (Array.isArray(node)) {
			for (const child of node) collect(child, acc);
			return acc;
		}
		if (typeof node === "object" && node.props !== void 0) {
			acc.elements.push(node);
			if (typeof node.props.placeholder === "string") acc.text.push(node.props.placeholder);
			collect(node.props.children, acc);
		}
		return acc;
	};
	const buttons = (acc) => acc.elements.filter((el) => el.type === "button");
	const inputs = (acc) => acc.elements.filter((el) => el.type === "input");

	const loadedAcc = collect(render([snapshot, "", "", "", {}, ""]));
	const loaded = loadedAcc.text.join(" | ");
	ok(loaded.includes("预置供应商"), "loaded panel keeps its title");
	ok(loaded.includes("预置 2 个供应商"), "loaded panel counts the presets");
	ok(loaded.includes("已启用"), "loaded panel shows the enabled state");
	ok(loaded.includes("与预置不一致"), "loaded panel shows the drift tag");
	ok(loaded.includes("差异字段：models"), "loaded panel names the drifting fields");
	ok(loaded.includes("密钥已配置（来源 file）"), "loaded panel shows the configured key");
	ok(loaded.includes("密钥缺失"), "loaded panel shows the missing key");
	ok(loaded.includes("重置为预置"), "loaded panel offers a reset for the drifted route");
	ok(loaded.includes("停用"), "loaded panel offers disable");
	ok(loaded.includes("启用"), "loaded panel offers enable for the pending route");
	ok(loaded.includes("http://192.168.100.63:4000/v1"), "loaded panel prints the endpoint");
	ok(loaded.includes("粘贴密钥后点「保存密钥」"), "loaded panel renders the key input placeholder");
	ok(!loaded.includes("正在读取配置"), "a loaded panel drops the loading line");
	eq(inputs(loadedAcc).filter((el) => el.props.type === "password").length, 2, "one key field per preset");
	ok(inputs(loadedAcc).every((el) => el.props.autoComplete === "off"), "key fields opt out of autocomplete");

	// the armed state must reach the button label
	const armed = collect(render([snapshot, "", "", "", { vekenllm: "sk-draft" }, "vekenllm:disable"]));
	ok(armed.text.join(" | ").includes("确认停用（删除配置）"), "armed disable asks for confirmation");

	// The two writabilities belong to different seams and must be gated separately.
	const PROFILE_LABELS = ["启用", "重置为预置", "停用", "确认重置（覆盖）", "确认停用（删除配置）"];
	const KEY_LABELS = ["保存密钥", "清除密钥"];
	const writeButtons = (acc, labels) => buttons(acc).filter((el) => labels.includes(el.props.children));
	const readOnly = collect(render([{ ...snapshot, writable: false }, "", "", "", {}, ""]));
	ok(writeButtons(readOnly, PROFILE_LABELS).length === 3, "the read-only case still renders the profile controls");
	ok(writeButtons(readOnly, PROFILE_LABELS).every((el) => el.props.disabled === true), "a read-only settings provider disables profile writes");
	ok(writeButtons(loadedAcc, PROFILE_LABELS).some((el) => el.props.disabled !== true), "a writable settings provider leaves profile writes usable");
	eq(P.keyWritable(VEK, { keys: { VEKENLLM_API_KEY: { configured: false, writable: false } } }), false, "an unwritable reference blocks key writes");
	eq(P.keyWritable(VEK, { keys: {} }), true, "an unknown reference does not block a key write");
	eq(P.keyWritable(VEK, { keys: { VEKENLLM_API_KEY: { configured: true, writable: false } } }), false, "a configured-but-unwritable reference still blocks writes");
	// an unwritable credential disables exactly the key controls
	const unwritableKeys = collect(render([{
		...snapshot,
		keys: { VEKENLLM_API_KEY: { configured: true, writable: false }, CTAI_API_KEY: { configured: false, writable: false } }
	}, "", "", "", { vekenllm: "sk-draft" }, ""]));
	ok(writeButtons(unwritableKeys, KEY_LABELS).every((el) => el.props.disabled === true), "an unwritable credential disables save and clear");
	ok(inputs(unwritableKeys).every((el) => el.props.disabled === true), "an unwritable credential disables the key fields");
	ok(writeButtons(unwritableKeys, PROFILE_LABELS).some((el) => el.props.disabled !== true), "credential writability does not affect profile writes");
	// an empty key field cannot be submitted
	const saveButtons = buttons(loadedAcc).filter((el) => el.props.children === "保存密钥");
	ok(saveButtons.length === 2 && saveButtons.every((el) => el.props.disabled === true), "save is inert until a key is typed");

	// a failed snapshot must show the error, not a stuck spinner
	const failed = collect(render([null, "", "", "读取设置失败：boom", {}, ""]));
	ok(failed.text.join(" | ").includes("boom"), "a load failure is surfaced");
	ok(!failed.text.join(" | ").includes("正在读取配置"), "a failed load does not also claim to be loading");
}
console.log("loaded render OK (tags, actions, arming, read-only, failure, endpoint)");
//#endregion

console.log(`\nALL PROVIDER-PRESETS CHECKS PASSED (${checks} assertions)`);
