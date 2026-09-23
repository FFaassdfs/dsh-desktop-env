// Client bundle for dsh-client-ui-plugin-provider-presets.
// Built from this template by build.mjs (injects config.json at the placeholder).
//
// What it does, as the "预置供应商" panel at the bottom of Settings > Models:
//  1. READ    — reads the llm-pi-ai namespace view and, for every preset's
//               credential reference, the credential state (never a value).
//  2. ENABLE  — installs one preset's whole route profile at
//               `providers.<route>` with ONE path-addressed mutate, fenced by
//               the revision it just read. Disable unsets the same path.
//  3. KEY     — stores the typed key under the preset's credential reference via
//               `remote.credentials.set`. The value crosses in one direction
//               only; no read path here can echo it back.
//  4. VERIFY  — re-reads both seams and reports what the host actually resolved,
//               so "wrote it" and "it took effect" stay distinguishable.
//
// The presets themselves are configuration, not secrets: config.json carries
// endpoint/protocol/compat/models and nothing else. build.mjs refuses to build a
// preset that contains a credential-shaped field or value.
//
// Why path ops and not `settings.replace`: the view crossing the wire is
// REDACTED, so rebuilding the whole section from it would silently drop every
// secret slot the wire did not carry (the official seam says the same about its
// own editor). `set` at one path touches exactly that route.
window.__ModuleLoader__.load({
	id: "dsh-client-ui-plugin-provider-presets",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region css
		const css = `
.pp_wrap{display:flex;flex-direction:column;gap:10px;padding:12px 12px 4px;border-top:1px solid var(--dsw-alias-border-l2)}
.pp_head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pp_title{font-size:12px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-secondary)}
.pp_sub{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);margin:0}
.pp_list{display:flex;flex-direction:column;gap:8px}
.pp_card{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.pp_cardHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pp_name{font-size:12px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary)}
.pp_route{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.pp_meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);margin:0;word-break:break-all}
.pp_tags{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.pp_tag{font-size:11px;line-height:16px;border:1px solid var(--dsw-alias-border-l3);border-radius:4px;padding:0 5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.pp_tagOn{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.pp_tagWarn{color:var(--dsw-alias-state-warn-label);border-color:var(--dsw-alias-state-warn-label)}
.pp_tagBad{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.pp_actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pp_btn{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;background:0 0;border-radius:6px;padding:3px 10px}
.pp_btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.pp_btn:disabled{opacity:.5;cursor:default}
.pp_btnPrimary{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.pp_btnDanger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.pp_keyRow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pp_input{flex:1 1 220px;min-width:180px;font:inherit;font-size:12px;padding:3px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.pp_ok{font-size:12px;line-height:18px;color:var(--dsw-alias-state-business-primary);margin:0}
.pp_error{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);margin:0}
.pp_status{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin:0}
.pp_hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);margin:0}
`;
		const tagId = "dsh-client-ui-plugin-provider-presets/main.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-client-ui-plugin-provider-presets";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region config
		const CONFIG = {"settingsNs":"llm-pi-ai","presets":[{"route":"vekenllm","title":"vekenllm","summary":"内网 LiteLLM 网关（192.168.100.63:4000）。只有能访问该内网时可用。","displayName":"vekenllm","apiKeyEnv":"VEKENLLM_API_KEY","api":"openai-completions","baseURL":"http://192.168.100.63:4000/v1","compat":{"thinkingFormat":"deepseek"},"models":[{"id":"deepseek-v4-flash","name":"DeepSeek V4 Flash","contextWindow":1000000,"maxTokens":393216,"input":["text","image"],"reasoningEfforts":{"off":null,"low":"low","high":"high"}},{"id":"auto","name":"Auto","contextWindow":1000000,"maxTokens":393216,"input":["text","image"],"reasoningEfforts":{"off":null,"low":"low","high":"high"}}]},{"route":"ctai","title":"电信算力","summary":"电信算力 OpenAI 兼容网关（ai.ctaigw.cn）。公网可达。","displayName":"电信算力","apiKeyEnv":"CTAI_API_KEY","api":"openai-completions","baseURL":"https://ai.ctaigw.cn/v1","compat":{"supportsDeveloperRole":false,"maxTokensField":"max_tokens"},"models":[{"id":"glm-5.3-flash","name":"glm-5.3-flash","contextWindow":1000000,"maxTokens":131072,"input":["text","image"],"reasoningEfforts":{"low":"low","high":"high","max":"max"}},{"id":"qwen3.8-flash","name":"qwen3.8-flash","contextWindow":991808,"maxTokens":131072,"input":["text","image"],"reasoningEfforts":{"off":null,"high":"high"}},{"id":"deepseek-v4.1-flash","name":"deepseek-v4.1-flash","contextWindow":1000000,"maxTokens":384000,"input":["text","image"],"reasoningEfforts":{"off":null,"minimal":"minimal","low":"low","medium":"medium","high":"high"}}]}]};
		//#endregion
		//#region pure helpers
		/** The profile fields a preset states, in the order the settings file spells them. */
		const PROFILE_FIELDS = ["displayName", "apiKeyEnv", "api", "baseURL", "compat"];
		/** The model fields a preset states; anything else is left to the schema defaults. */
		const MODEL_FIELDS = ["id", "name", "contextWindow", "maxTokens", "input", "reasoningEfforts"];
		/** Printable ASCII only — exactly the character set an HTTP header can carry. */
		const API_KEY_GRAMMAR = /^[\x21-\x7E]+$/;
		/**
		 * A pasted `NAME=value` environment line. Mirrors the official Models
		 * page's heuristic, narrowings included: the name must be upper-case (so
		 * `sk-` forms break at the hyphen) and the `=` must be followed by
		 * something other than another `=` (so base64 padding on an all-upper-case
		 * key is not mistaken for an assignment).
		 */
		const ENV_LINE = /^[A-Z][A-Z0-9_]*=[^=]/;

		/** One error's message, whatever was thrown. */
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/**
		 * Project one preset onto the llm-pi-ai route profile it declares.
		 * Presentation-only keys on the preset (`title`, `summary`) are dropped:
		 * what gets written is a route profile, and nothing else.
		 *
		 * The result is detached from CONFIG by a JSON round trip. It has to be:
		 * this object is handed to the settings seam, which takes ownership of
		 * what it stores, so the shipped preset must share no structure with a
		 * value that leaves this plugin.
		 * @param preset - one CONFIG.presets entry.
		 * @returns the profile object to write at `providers.<route>`.
		 */
		function profileOf(preset) {
			const profile = {};
			for (const field of PROFILE_FIELDS) {
				if (preset[field] !== void 0) profile[field] = preset[field];
			}
			profile.models = (preset.models ?? []).map((model) => {
				const kept = {};
				for (const field of MODEL_FIELDS) {
					if (model[field] !== void 0) kept[field] = model[field];
				}
				return kept;
			});
			return JSON.parse(JSON.stringify(profile));
		}
		/**
		 * The path ops that install one preset at `providers.<route>`.
		 * @param preset - one CONFIG.presets entry.
		 * @returns one `set` op addressing the whole route profile.
		 */
		function buildEnableOps(preset) {
			return [{ op: "set", path: ["providers", preset.route], value: profileOf(preset) }];
		}
		/**
		 * The path ops that remove one route, which is what "停用" means: the
		 * profile goes away and the provider stops existing. The credential
		 * reference is a separate seam and is deliberately left alone.
		 * @param route - the provider route key.
		 * @returns one `unset` op addressing the whole route profile.
		 */
		function buildDisableOps(route) {
			return [{ op: "unset", path: ["providers", route] }];
		}
		/**
		 * Order-insensitive signature of a models array, for drift comparison.
		 * Comparing a stored list to a preset must not report a difference when
		 * the user merely reordered rows.
		 * @param models - a stored or preset `models` array.
		 * @returns comparable rows, sorted by id.
		 */
		function modelSignature(models) {
			return (Array.isArray(models) ? models : [])
				.map((model) => ({
					id: String(model?.id ?? ""),
					name: model?.name ?? null,
					contextWindow: model?.contextWindow ?? null,
					maxTokens: model?.maxTokens ?? null,
					input: model?.input ?? null,
					reasoningEfforts: model?.reasoningEfforts ?? null
				}))
				.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
		}
		/**
		 * The preset-controlled fields where a stored route disagrees with its
		 * preset. A route the user has tuned is not an error — it is a fact the
		 * panel must state before offering to overwrite it.
		 * @param stored - the resolved route profile.
		 * @param presetProfile - the preset's own profile.
		 * @returns the disagreeing field names, in profile order.
		 */
		function driftFields(stored, presetProfile) {
			const drifted = [];
			for (const field of ["displayName", "api", "baseURL", "apiKeyEnv"]) {
				if (JSON.stringify(stored?.[field] ?? null) !== JSON.stringify(presetProfile[field] ?? null)) drifted.push(field);
			}
			if (JSON.stringify(stored?.compat ?? {}) !== JSON.stringify(presetProfile.compat ?? {})) drifted.push("compat");
			if (JSON.stringify(modelSignature(stored?.models)) !== JSON.stringify(modelSignature(presetProfile.models))) drifted.push("models");
			return drifted;
		}
		/**
		 * Read one preset's state out of a settings namespace view.
		 * @param view - the `llm-pi-ai` namespace view.
		 * @param preset - one CONFIG.presets entry.
		 * @returns whether the route resolves, whether the user layer owns it, how
		 *   it drifts, and how many models it stores.
		 */
		function presetState(view, preset) {
			const stored = view?.value?.providers?.[preset.route];
			const owned = view?.user?.providers?.[preset.route];
			const enabled = stored !== void 0 && stored !== null;
			return {
				enabled,
				userOwned: owned !== void 0 && owned !== null,
				drifted: enabled ? driftFields(stored, profileOf(preset)) : [],
				modelCount: Array.isArray(stored?.models) ? stored.models.length : 0
			};
		}
		/**
		 * Classify one credential reference for the panel. The seam never returns
		 * a value, so "configured" is the strongest statement available.
		 * @param info - the CredentialInfo for the reference, or undefined.
		 * @returns `set` | `missing` | `readonly` | `unknown`.
		 */
		function keyStateOf(info) {
			if (info === void 0 || info === null) return "unknown";
			if (info.configured === true) return "set";
			return info.writable === false ? "readonly" : "missing";
		}
		/** Whether a value is wrapped in one matching pair of quotes. */
		function isQuoted(value) {
			const first = value[0];
			if (first !== "\"" && first !== "'" && first !== "`") return false;
			return value.length > 1 && value.endsWith(first);
		}
		/**
		 * Judge a typed key the way the official Models page does, so the host
		 * never has to refuse a format the panel could have caught. The charset
		 * rule and the two paste-shaped rejections are mirrored deliberately:
		 * this panel asks for the same value in the same way.
		 * @param value - the raw input field value.
		 * @returns a locale key naming the failure, or "" when the value is usable.
		 */
		function validateApiKey(value) {
			const raw = String(value ?? "");
			if (raw.length === 0) return "keyEmpty";
			const text = raw.trim();
			if (text.length === 0) return "keyEmpty";
			if (ENV_LINE.test(text) || isQuoted(text)) return "keyFormat";
			if (!API_KEY_GRAMMAR.test(text)) return "keyFormat";
			return "";
		}
		/**
		 * Read the settings view, the runtime writability flag, and every preset's
		 * credential state in one pass. Credential failures degrade to a notice:
		 * the panel still installs profiles without knowing the key state.
		 * @param remote - the Remote faces captured from the plugin context.
		 * @param syncNs - the settings namespace that carries the routes.
		 * @param presets - CONFIG.presets.
		 * @returns the snapshot the panel renders from.
		 */
		async function readSnapshot(remote, syncNs, presets) {
			const described = await remote.settings.describe();
			if (!described.ok) throw new Error(described.error.message);
			const view = described.value.namespaces.find((entry) => entry.ns === syncNs);
			if (view === void 0) throw new Error("settings namespace " + syncNs + " is not registered");
			const refs = [...new Set((presets ?? []).map((preset) => preset.apiKeyEnv).filter((ref) => typeof ref === "string" && ref !== ""))];
			let keys = {};
			let keysError = "";
			if (refs.length > 0) {
				const describedKeys = await remote.credentials.describe(refs);
				if (describedKeys.ok) keys = describedKeys.value ?? {};
				else keysError = describedKeys.error.message;
			}
			return { writable: described.value.writable !== false, view, keys, keysError };
		}
		/**
		 * Whether the credential seam would accept a write for this preset's
		 * reference.
		 *
		 * This is deliberately NOT `settings.writable`: the two writabilities
		 * belong to different seams. A read-only settings provider says nothing
		 * about whether the credential store can be written, and a reference
		 * supplied by a read-only source can be configured while still refusing
		 * every write. An unknown reference returns true so the host, which knows
		 * more, gets to refuse rather than the panel guessing.
		 * @param preset - one CONFIG.presets entry.
		 * @param snapshot - the panel's snapshot.
		 * @returns true when a key write should be attempted.
		 */
		function keyWritable(preset, snapshot) {
			const info = snapshot?.keys?.[preset.apiKeyEnv];
			if (info === void 0 || info === null) return true;
			return info.writable !== false;
		}
		/**
		 * The one-line endpoint/model summary under a preset's name.
		 * @param preset - one CONFIG.presets entry.
		 * @param state - the preset's resolved state.
		 * @param t - the bound locale lookup.
		 * @returns the summary text.
		 */
		function metaTextOf(preset, state, t) {
			let text = preset.api + " · " + preset.baseURL + " · " + t("modelCount", { count: (preset.models ?? []).length });
			if (state.enabled) text += " · " + t("storedCount", { count: state.modelCount });
			if (state.drifted.length > 0) text += " · " + t("driftFields", { fields: state.drifted.join(", ") });
			return text;
		}
		/**
		 * The key tag's text for one credential state.
		 * @param preset - one CONFIG.presets entry.
		 * @param snapshot - the panel's snapshot.
		 * @param keyState - the classification from {@link keyStateOf}.
		 * @param t - the bound locale lookup.
		 * @returns the tag text.
		 */
		function keyTextOf(preset, snapshot, keyState, t) {
			if (keyState === "set") {
				const source = snapshot?.keys?.[preset.apiKeyEnv]?.source;
				return source ? t("keySetFrom", { source }) : t("keySet");
			}
			if (keyState === "missing") return t("keyMissing");
			if (keyState === "readonly") return t("keyReadonly");
			return t("keyUnknown");
		}
		/**
		 * The display decisions for one preset row: its status tags, its offered
		 * actions and its key state. Pure — the panel's judgement calls are
		 * asserted without a DOM, and React only lays them out.
		 * @param preset - one CONFIG.presets entry.
		 * @param snapshot - the state read from both seams.
		 * @param t - the bound locale lookup.
		 * @param pending - the route+action currently armed for confirmation.
		 * @returns the row's state, tags, actions and summary.
		 */
		function describeRow(preset, snapshot, t, pending) {
			const state = presetState(snapshot.view, preset);
			const keyState = keyStateOf(snapshot.keys?.[preset.apiKeyEnv]);
			const tags = [{
				kind: state.enabled ? "on" : "off",
				text: state.enabled ? t("statusEnabled") : t("statusDisabled")
			}];
			if (state.enabled && state.drifted.length > 0) tags.push({ kind: "warn", text: t("statusDrifted") });
			if (state.userOwned) tags.push({ kind: "plain", text: t("statusOwned") });
			tags.push({
				kind: keyState === "set" ? "on" : keyState === "missing" ? "bad" : "plain",
				text: keyTextOf(preset, snapshot, keyState, t)
			});
			const armed = (action) => pending === preset.route + ":" + action;
			const actions = [];
			if (!state.enabled) {
				actions.push({ id: "enable", kind: "primary", text: t("enable"), busyText: t("enabling") });
			} else {
				if (state.drifted.length > 0) {
					actions.push({ id: "reset", kind: "plain", text: armed("reset") ? t("confirmReset") : t("reset"), busyText: t("resetting") });
				}
				actions.push({ id: "disable", kind: "danger", text: armed("disable") ? t("confirmDisable") : t("disable"), busyText: t("disabling") });
			}
			return { state, keyState, keyWritable: keyWritable(preset, snapshot), tags, actions, meta: metaTextOf(preset, state, t) };
		}
		//#endregion
		//#region locales
		const NS = "providerPresets";
		const zh = {
			title: "预置供应商",
			subtitle: "预置 {count} 个供应商：启用只是写入配置，密钥由你在这里输入（不会写进配置文件）。",
			loading: "正在读取配置…",
			refresh: "刷新",
			refreshing: "刷新中…",
			statusEnabled: "已启用",
			statusDisabled: "未启用",
			statusDrifted: "与预置不一致",
			statusOwned: "你改过的配置",
			driftFields: "差异字段：{fields}",
			modelCount: "预置 {count} 个模型",
			storedCount: "已存 {count} 个模型",
			keySet: "密钥已配置",
			keySetFrom: "密钥已配置（来源 {source}）",
			keyMissing: "密钥缺失",
			keyUnknown: "密钥状态未知",
			keyReadonly: "此处不可写入密钥",
			enable: "启用",
			enabling: "正在启用…",
			reset: "重置为预置",
			confirmReset: "确认重置（覆盖）",
			resetting: "正在重置…",
			disable: "停用",
			confirmDisable: "确认停用（删除配置）",
			disabling: "正在停用…",
			keyLabel: "API Key",
			keyPlaceholder: "粘贴密钥后点「保存密钥」",
			saveKey: "保存密钥",
			savingKey: "正在保存…",
			clearKey: "清除密钥",
			clearingKey: "正在清除…",
			enabled: "已启用 {name}：host 解析到 {count} 个模型。",
			disabled: "已停用 {name}：该路由的配置已从 settings.yaml 移除（密钥未动）。",
			keySaved: "密钥已存入凭据引用 {ref}（只写，界面不回显）。",
			keyCleared: "已清除凭据引用 {ref}。",
			keyEmpty: "密钥不能为空。",
			keyFormat: "密钥格式不合法：必须全部是可打印 ASCII 字符（不要带引号，也不要 NAME=value 形式）。",
			keyFailed: "密钥写入失败：{message}",
			conflict: "配置在别处被改动（revision 冲突），请刷新后重试。",
			readOnly: "当前设置提供方是只读的，无法写入。",
			verifyMismatch: "已写入，但回读确认与预期不符，请刷新查看。",
			settingsFailed: "读取设置失败：{message}",
			credsFailed: "读取密钥状态失败：{message}",
			namespaceMissing: "设置里没有 {ns} 命名空间，插件无法工作。",
			hint: "预置内容随插件包携带（改预置 = 改 config.json 后重新构建并重装）。密钥走官方凭据引用，settings.yaml、发行包与任何脚本都不携带密钥。"
		};
		const en = {
			title: "Preset providers",
			subtitle: "{count} pre-staged provider(s): enabling writes configuration only; the key is typed here and never enters a config file.",
			loading: "Reading configuration…",
			refresh: "Refresh",
			refreshing: "Refreshing…",
			statusEnabled: "Enabled",
			statusDisabled: "Not enabled",
			statusDrifted: "Differs from preset",
			statusOwned: "User-configured",
			driftFields: "Differing fields: {fields}",
			modelCount: "{count} preset model(s)",
			storedCount: "{count} stored model(s)",
			keySet: "Key configured",
			keySetFrom: "Key configured (source {source})",
			keyMissing: "Key missing",
			keyUnknown: "Key state unknown",
			keyReadonly: "Key not writable here",
			enable: "Enable",
			enabling: "Enabling…",
			reset: "Reset to preset",
			confirmReset: "Confirm reset (overwrite)",
			resetting: "Resetting…",
			disable: "Disable",
			confirmDisable: "Confirm disable (delete config)",
			disabling: "Disabling…",
			keyLabel: "API key",
			keyPlaceholder: "Paste the key, then Save",
			saveKey: "Save key",
			savingKey: "Saving…",
			clearKey: "Clear key",
			clearingKey: "Clearing…",
			enabled: "Enabled {name}: the host resolves {count} model(s).",
			disabled: "Disabled {name}: the route was removed from settings.yaml (the key is untouched).",
			keySaved: "Key stored under the credential reference {ref} (write-only; never echoed here).",
			keyCleared: "Credential reference {ref} cleared.",
			keyEmpty: "The key cannot be empty.",
			keyFormat: "Invalid key format: printable ASCII only (no quotes, no NAME=value form).",
			keyFailed: "Storing the key failed: {message}",
			conflict: "Settings changed elsewhere (revision conflict). Refresh and try again.",
			readOnly: "The settings provider is read-only; nothing can be written.",
			verifyMismatch: "Written, but the read-back does not match. Refresh to inspect.",
			settingsFailed: "Reading settings failed: {message}",
			credsFailed: "Reading key state failed: {message}",
			namespaceMissing: "The settings namespace {ns} is not registered; the plugin cannot work.",
			hint: "Presets ship inside the plugin bundle (edit config.json, rebuild, reinstall). Keys travel through the official credential seam: settings.yaml, release packages and every script stay key-free."
		};
		//#endregion
		//#region component
		/**
		 * Build the preset panel.
		 * @param syncNs - the settings namespace the presets install into.
		 * @param t - the bound locale lookup.
		 * @param remote - the Remote faces, captured from the plugin context:
		 *   the footer slot's owner props are intentionally empty, so a component
		 *   could not reach a context on its own.
		 * @returns the React component.
		 */
		function makePanel(syncNs, t, remote) {
			return function ProviderPresetsPanel() {
				const [snapshot, setSnapshot] = react.useState(null);
				const [busy, setBusy] = react.useState("");
				const [notice, setNotice] = react.useState("");
				const [failure, setFailure] = react.useState("");
				const [drafts, setDrafts] = react.useState({});
				const [pending, setPending] = react.useState("");
				const reload = react.useCallback(async () => {
					const next = await readSnapshot(remote, syncNs, CONFIG.presets);
					setSnapshot(next);
					return next;
				}, [remote, syncNs]);
				react.useEffect(() => {
					reload().catch((error) => setFailure(t("settingsFailed", { message: messageOf(error) })));
				}, [reload, t]);
				/**
				 * Run one action, then re-read both seams. The revision is taken
				 * from a FRESH read immediately before the write, so a write is
				 * only ever refused by a change that happened during the round
				 * trip — never by a stale value this panel was holding.
				 */
				const run = react.useCallback(async (preset, action) => {
					setBusy(preset.route + ":" + action);
					setNotice("");
					setFailure("");
					try {
						const current = await readSnapshot(remote, syncNs, CONFIG.presets);
						setSnapshot(current);
						if (action === "enable" || action === "reset" || action === "disable") {
							if (!current.writable) {
								setFailure(t("readOnly"));
								return;
							}
							const ops = action === "disable" ? buildDisableOps(preset.route) : buildEnableOps(preset);
							const response = await remote.settings.mutate(syncNs, ops, current.view.revision);
							if (!response.ok) {
								setFailure(response.error.code === "settings/conflict" ? t("conflict") : messageOf(response.error.message));
								return;
							}
							const after = presetState(response.value, preset);
							const name = preset.title ?? preset.route;
							if (action === "disable") {
								if (after.enabled) setNotice(t("verifyMismatch"));
								else setNotice(t("disabled", { name }));
							} else if (after.enabled) {
								setNotice(t("enabled", { name, count: after.modelCount }));
							} else {
								setNotice(t("verifyMismatch"));
							}
						} else if (action === "saveKey") {
							const value = String(drafts[preset.route] ?? "").trim();
							const problem = validateApiKey(value);
							if (problem !== "") {
								setFailure(t(problem));
								return;
							}
							const response = await remote.credentials.set(preset.apiKeyEnv, value);
							if (!response.ok) {
								setFailure(t("keyFailed", { message: messageOf(response.error.message) }));
								return;
							}
							setDrafts((previous) => ({ ...previous, [preset.route]: "" }));
							setNotice(t("keySaved", { ref: preset.apiKeyEnv }));
						} else if (action === "clearKey") {
							const response = await remote.credentials.unset(preset.apiKeyEnv);
							if (!response.ok) {
								setFailure(t("keyFailed", { message: messageOf(response.error.message) }));
								return;
							}
							setNotice(t("keyCleared", { ref: preset.apiKeyEnv }));
						}
						setPending("");
						setSnapshot(await readSnapshot(remote, syncNs, CONFIG.presets));
					} catch (error) {
						setFailure(messageOf(error));
					} finally {
						setBusy("");
					}
				}, [drafts, remote, syncNs, t]);
				/** Two-step guard: destructive actions arm once, then commit. */
				const guarded = (preset, action) => {
					const token = preset.route + ":" + action;
					if (pending !== token) {
						setPending(token);
						setNotice("");
						setFailure("");
						return;
					}
					run(preset, action);
				};
				const head = (0, react_jsx_runtime.jsxs)("div", {
					className: "pp_head",
					children: [
						(0, react_jsx_runtime.jsx)("span", { className: "pp_title", children: t("title") }),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "pp_btn",
							disabled: busy !== "",
							onClick: () => {
								setBusy("refresh");
								setNotice("");
								setFailure("");
								reload().catch((error) => setFailure(t("settingsFailed", { message: messageOf(error) }))).finally(() => setBusy(""));
							},
							children: busy === "refresh" ? t("refreshing") : t("refresh")
						})
					]
				});
				const keysError = snapshot !== null && snapshot.keysError !== "" ?
					(0, react_jsx_runtime.jsx)("p", { className: "pp_error", children: t("credsFailed", { message: snapshot.keysError }) }) : null;
				const cards = snapshot === null ? [] : CONFIG.presets.map((preset) => {
					const row = describeRow(preset, snapshot, t, pending);
					const name = preset.title ?? preset.route;
					const tags = row.tags.map((tag) => (0, react_jsx_runtime.jsx)("span", {
						className: "pp_tag" + (tag.kind === "on" ? " pp_tagOn" : tag.kind === "warn" ? " pp_tagWarn" : tag.kind === "bad" ? " pp_tagBad" : ""),
						children: tag.text
					}, tag.kind + ":" + tag.text));
					const actions = row.actions.map((action) => (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "pp_btn" + (action.kind === "primary" ? " pp_btnPrimary" : action.kind === "danger" ? " pp_btnDanger" : ""),
						disabled: busy !== "" || !snapshot.writable,
						onClick: () => (action.id === "enable" ? run(preset, "enable") : guarded(preset, action.id)),
						children: busy === preset.route + ":" + action.id ? action.busyText : action.text
					}, action.id));
					const keyRow = [
						(0, react_jsx_runtime.jsx)("span", { className: "pp_route", children: t("keyLabel") + " · " + preset.apiKeyEnv }, "ref"),
						(0, react_jsx_runtime.jsx)("input", {
							className: "pp_input",
							type: "password",
							autoComplete: "off",
							spellCheck: false,
							placeholder: t("keyPlaceholder"),
							value: drafts[preset.route] ?? "",
							disabled: busy !== "" || row.keyWritable === false,
							onChange: (event) => {
								const value = event.target.value;
								setDrafts((previous) => ({ ...previous, [preset.route]: value }));
							}
						}, "input"),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "pp_btn pp_btnPrimary",
							disabled: busy !== "" || row.keyWritable === false || String(drafts[preset.route] ?? "").trim() === "",
							onClick: () => run(preset, "saveKey"),
							children: busy === preset.route + ":saveKey" ? t("savingKey") : t("saveKey")
						}, "save"),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "pp_btn",
							disabled: busy !== "" || row.keyWritable === false || row.keyState !== "set",
							onClick: () => run(preset, "clearKey"),
							children: busy === preset.route + ":clearKey" ? t("clearingKey") : t("clearKey")
						}, "clear")
					];
					return (0, react_jsx_runtime.jsxs)("div", {
						className: "pp_card",
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: "pp_cardHead",
								children: [
									(0, react_jsx_runtime.jsx)("span", { className: "pp_name", children: name }),
									(0, react_jsx_runtime.jsx)("span", { className: "pp_route", children: preset.route }),
									(0, react_jsx_runtime.jsx)("span", { className: "pp_tags", children: tags })
								]
							}),
							preset.summary ? (0, react_jsx_runtime.jsx)("p", { className: "pp_sub", children: preset.summary }) : null,
							(0, react_jsx_runtime.jsx)("p", { className: "pp_meta", children: row.meta }),
							(0, react_jsx_runtime.jsx)("div", { className: "pp_actions", children: actions }),
							(0, react_jsx_runtime.jsx)("div", { className: "pp_keyRow", children: keyRow })
						]
					}, preset.route);
				});
				return (0, react_jsx_runtime.jsxs)("div", {
					className: "pp_wrap",
					children: [
						head,
						(0, react_jsx_runtime.jsx)("p", { className: "pp_sub", children: t("subtitle", { count: CONFIG.presets.length }) }),
						snapshot === null && failure === "" ? (0, react_jsx_runtime.jsx)("p", { className: "pp_status", children: t("loading") }) : null,
						(0, react_jsx_runtime.jsx)("div", { className: "pp_list", children: cards }),
						notice !== "" ? (0, react_jsx_runtime.jsx)("p", { className: "pp_ok", children: notice }) : null,
						failure !== "" ? (0, react_jsx_runtime.jsx)("p", { className: "pp_error", children: failure }) : null,
						keysError,
						(0, react_jsx_runtime.jsx)("p", { className: "pp_hint", children: t("hint") })
					]
				});
			};
		}
		//#endregion
		//#region entry
		const inject = ["slots", "locale", "remote", "remote.credentials", "remote.settings"];
		/**
		 * Contribute the preset panel to the bottom of the Models section.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "provider-presets: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("settings.models.footer", () => ctx.slots.register({
				name: "settings.models.footer"
			}, makePanel(CONFIG.settingsNs, t, ctx.remote)));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.makePanel = makePanel;
		exports.messageOf = messageOf;
		exports.profileOf = profileOf;
		exports.buildEnableOps = buildEnableOps;
		exports.buildDisableOps = buildDisableOps;
		exports.modelSignature = modelSignature;
		exports.driftFields = driftFields;
		exports.presetState = presetState;
		exports.keyStateOf = keyStateOf;
		exports.keyWritable = keyWritable;
		exports.isQuoted = isQuoted;
		exports.validateApiKey = validateApiKey;
		exports.metaTextOf = metaTextOf;
		exports.keyTextOf = keyTextOf;
		exports.describeRow = describeRow;
		exports.readSnapshot = readSnapshot;
		return module.exports;
	}
});
