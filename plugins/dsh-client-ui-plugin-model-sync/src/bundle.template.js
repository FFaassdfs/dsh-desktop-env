// Client bundle for dsh-client-ui-plugin-model-sync.
// Built from this template by build.mjs (injects config.json at the placeholder).
//
// What it does, per provider card on Settings > Models:
//  1. FETCH  — reads the provider profile from the official settings Remote,
//              then gathers candidates from up to three sources:
//                a. the provider's own /models endpoint (remote.llm.discoverModels)
//                b. models.dev  (full metadata: modalities, limits, reasoning)
//                c. OpenRouter  (modality cross-check)
//  2. DIFF   — compares candidates against the stored models field by field and
//              marks user-pinned entries (present in the settings USER layer).
//  3. APPLY  — writes the accepted result with ONE path-addressed
//              remote.settings.mutate call, fenced by the revision it read.
//  4. VERIFY — re-reads the namespace and reports what the host actually
//              resolved, so "wrote it" and "it took effect" stay distinguishable.
//
// The browser never touches credentials: endpoint interrogation omits the key
// and lets the host resolve the stored credential.
window.__ModuleLoader__.load({
	id: "dsh-client-ui-plugin-model-sync",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region css
		const css = `
.ms_wrap{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-top:1px solid var(--dsw-alias-border-l2)}
.ms_head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ms_title{font-size:12px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-secondary)}
.ms_count{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.ms_btn{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;background:0 0;border-radius:6px;padding:3px 10px}
.ms_btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.ms_btn:disabled{opacity:.5;cursor:default}
.ms_btnPrimary{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.ms_status{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin:0}
.ms_error{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);margin:0}
.ms_ok{font-size:12px;line-height:18px;color:var(--dsw-alias-state-business-primary);margin:0}
.ms_hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);margin:0}
.ms_table{width:100%;border-collapse:collapse;font-size:12px;line-height:18px}
.ms_table th,.ms_table td{text-align:left;padding:4px 6px;border-bottom:1px solid var(--dsw-alias-border-l2);vertical-align:top}
.ms_table th{color:var(--dsw-alias-label-tertiary);font-weight:600;font-size:11px}
.ms_table td{color:var(--dsw-alias-label-primary)}
.ms_id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}
.ms_tag{font-size:11px;line-height:16px;border:1px solid var(--dsw-alias-border-l3);border-radius:4px;padding:0 5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.ms_tagNew{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.ms_tagChange{color:var(--dsw-alias-state-warn-label)}
.ms_tagGone{color:var(--dsw-alias-label-tertiary)}
.ms_tagLock{color:var(--dsw-alias-state-warn-label);border-color:var(--dsw-alias-state-warn-label)}
.ms_deltas{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.ms_scroll{max-height:260px;overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:8px}
.ms_src{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);margin:0;font-variant-numeric:tabular-nums}
`;
		const tagId = "dsh-client-ui-plugin-model-sync/main.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-client-ui-plugin-model-sync";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region config
		const CONFIG = /*__CONFIG_JSON__*/;
		//#endregion
		//#region pure helpers
		/** dsh's reasoning-effort level vocabulary, in escalation order. */
		const EFFORT_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"];
		/** dsh's llm-pi-ai input-modality vocabulary (audio/video/pdf have no consumer). */
		const MODALITIES = ["text", "image"];
		/** A positive finite integer, or undefined. */
		function positiveInt(value) {
			return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
		}
		/** Case-insensitive compare key for a model id, ignoring any provider prefix. */
		function normalizeModelId(id) {
			const text = String(id ?? "").trim();
			const tail = text.includes("/") ? text.slice(text.lastIndexOf("/") + 1) : text;
			return tail.toLowerCase();
		}
		/** Compare key for a base URL: trimmed, lowercased, no trailing slashes. */
		function normalizeBaseUrl(url) {
			return String(url ?? "").trim().toLowerCase().replace(/\/+$/, "");
		}
		/** Keep only the modalities dsh can carry, or undefined when none remain. */
		function keepModalities(list) {
			if (!Array.isArray(list)) return void 0;
			const kept = list.filter((value) => MODALITIES.includes(value));
			return kept.length > 0 ? kept : void 0;
		}
		/**
		 * Translate models.dev `reasoning_options` into the reasoningEfforts dict a
		 * dsh profile declares. Presence of a level is the support signal; the value
		 * is the effort string sent on the wire (`null` means "supported, send
		 * nothing", which is how `off` is spelled).
		 * @param options - models.dev reasoning_options array.
		 * @param reasoning - models.dev `reasoning` boolean.
		 * @returns the efforts dict, or undefined when the model does not reason.
		 */
		function fromReasoningOptions(options, reasoning) {
			if (reasoning !== true) return void 0;
			const list = Array.isArray(options) ? options : [];
			const efforts = {};
			for (const option of list) {
				if (option === null || typeof option !== "object") continue;
				if (option.type === "toggle") efforts.off = null;
				if (option.type === "effort" && Array.isArray(option.values)) {
					for (const value of option.values) {
						if (value === "none") efforts.off = null;
						else if (EFFORT_LEVELS.includes(value)) efforts[value] = value;
					}
				}
			}
			return Object.keys(efforts).length > 0 ? efforts : void 0;
		}
		/**
		 * Read one models.dev model entry as a candidate.
		 * @param entry - one value from `catalog[provider].models`.
		 * @returns the candidate.
		 */
		function fromModelsDev(entry) {
			const limit = entry?.limit ?? {};
			return {
				id: String(entry?.id ?? ""),
				name: typeof entry?.name === "string" ? entry.name : void 0,
				contextWindow: positiveInt(limit.context) ?? positiveInt(limit.input),
				maxTokens: positiveInt(limit.output),
				input: keepModalities(entry?.modalities?.input),
				reasoningEfforts: fromReasoningOptions(entry?.reasoning_options, entry?.reasoning)
			};
		}
		/**
		 * Read one OpenRouter model entry as a candidate (modality cross-check).
		 * @param entry - one item of the OpenRouter `data` array.
		 * @returns the candidate.
		 */
		function fromOpenRouter(entry) {
			const arch = entry?.architecture ?? {};
			return {
				id: String(entry?.id ?? ""),
				name: typeof entry?.name === "string" ? entry.name : void 0,
				contextWindow: positiveInt(entry?.context_length),
				maxTokens: positiveInt(entry?.top_provider?.max_completion_tokens),
				input: keepModalities(arch.input_modalities)
			};
		}
		/**
		 * Find the models.dev provider entry describing one configured route.
		 * The base URL is the reliable join: a provider's own env-var name can
		 * differ between models.dev and the installed catalog (e.g. models.dev
		 * names `ALIBABA_TOKEN_PLAN_API_KEY` where pi-ai names
		 * `QWEN_TOKEN_PLAN_CN_API_KEY` for the same endpoint).
		 * @param catalog - the parsed models.dev api.json.
		 * @param profile - the configured provider profile.
		 * @returns the match with how it was found, or undefined.
		 */
		function matchModelsDevProvider(catalog, profile) {
			const target = normalizeBaseUrl(profile?.baseURL);
			const envName = String(profile?.apiKeyEnv ?? "").trim();
			let byEnv;
			for (const [id, provider] of Object.entries(catalog ?? {})) {
				if (provider === null || typeof provider !== "object") continue;
				if (target !== "" && normalizeBaseUrl(provider.api) === target) return { id, provider, via: "baseURL" };
				const envs = Array.isArray(provider.env) ? provider.env : [];
				if (byEnv === void 0 && envName !== "" && envs.includes(envName)) byEnv = { id, provider, via: "env" };
			}
			return byEnv;
		}
		/**
		 * Flatten a whole models.dev catalog into deduplicated candidates keyed by
		 * normalized model id. This is the FALLBACK path: a self-hosted gateway or a
		 * relay that models.dev does not list still serves models that models.dev
		 * describes under some other provider, and a same-named entry is a far
		 * better parameter hint than no metadata at all.
		 * @param catalog - the parsed models.dev api.json.
		 * @returns one candidate per distinct model id; first writer wins.
		 */
		function flattenCatalog(catalog) {
			const index = new Map();
			for (const provider of Object.values(catalog ?? {})) {
				const models = provider?.models;
				if (models === null || typeof models !== "object" || Array.isArray(models)) continue;
				for (const entry of Object.values(models)) {
					const key = normalizeModelId(entry?.id);
					if (key === "" || index.has(key)) continue;
					index.set(key, fromModelsDev(entry));
				}
			}
			return [...index.values()];
		}
		/**
		 * Merge one candidate into another, filling only what the base lacks.
		 * The base keeps whatever it already stated, so callers control priority by
		 * argument order.
		 * @param base - the candidate whose values win.
		 * @param extra - the candidate consulted for missing fields.
		 * @returns the merged candidate.
		 */
		function mergeCandidate(base, extra) {
			if (extra === void 0) return base;
			return {
				id: base.id,
				name: base.name ?? extra.name,
				contextWindow: base.contextWindow ?? extra.contextWindow,
				maxTokens: base.maxTokens ?? extra.maxTokens,
				input: base.input ?? extra.input,
				reasoningEfforts: base.reasoningEfforts ?? extra.reasoningEfforts
			};
		}
		/**
		 * Build the candidate list for one route.
		 * Priority: the endpoint decides which ids exist and what capacity it
		 * admits; models.dev supplies modalities and reasoning levels; OpenRouter
		 * back-fills modalities only. Capacity from a third party is a hint, never
		 * the authority — the endpoint is what the deployment actually runs.
		 * @param input - the gathered sources.
		 * @returns candidates in endpoint order, then metadata-only additions.
		 */
		function buildCandidates(input) {
			const endpoint = Array.isArray(input.endpoint) ? input.endpoint : [];
			const dev = Array.isArray(input.modelsDev) ? input.modelsDev : [];
			const globalDev = Array.isArray(input.globalModelsDev) ? input.globalModelsDev : [];
			const router = Array.isArray(input.openRouter) ? input.openRouter : [];
			const devByKey = new Map();
			for (const candidate of dev) devByKey.set(normalizeModelId(candidate.id), candidate);
			const globalByKey = new Map();
			for (const candidate of globalDev) globalByKey.set(normalizeModelId(candidate.id), candidate);
			const routerByKey = new Map();
			for (const candidate of router) routerByKey.set(normalizeModelId(candidate.id), candidate);
			const out = [];
			const seen = new Set();
			for (const raw of endpoint) {
				const key = normalizeModelId(raw.id);
				if (key === "" || seen.has(key)) continue;
				seen.add(key);
				const base = {
					id: String(raw.id),
					name: raw.name,
					contextWindow: positiveInt(raw.contextWindow),
					maxTokens: positiveInt(raw.maxTokens)
				};
				const local = devByKey.get(key);
				const meta = local ?? globalByKey.get(key);
				const merged = mergeCandidate(mergeCandidate(base, meta), routerByKey.get(key));
				// Metadata borrowed from a same-named model on an UNRELATED provider is
				// a hint, never an authority. A custom route name such as `auto` can
				// collide with an unrelated model, and silently adopting its numbers
				// would overwrite a correct hand-written config with wrong values.
				// Such a row is flagged and left unselected by default.
				if (local === void 0 && meta !== void 0) merged.borrowed = true;
				out.push(merged);
			}
			for (const candidate of dev) {
				const key = normalizeModelId(candidate.id);
				if (key === "" || seen.has(key)) continue;
				seen.add(key);
				out.push(mergeCandidate(candidate, routerByKey.get(key)));
			}
			return out.slice(0, CONFIG.maxCandidates);
		}
		/**
		 * Compare one stored model against one candidate, field by field.
		 * @param current - the stored model entry.
		 * @param next - the candidate.
		 * @returns the names of the fields that differ.
		 */
		function diffFields(current, next) {
			const changed = [];
			if (typeof next.name === "string" && next.name !== current.name) changed.push("name");
			if (next.contextWindow !== void 0 && next.contextWindow !== current.contextWindow) changed.push("contextWindow");
			if (next.maxTokens !== void 0 && next.maxTokens !== current.maxTokens) changed.push("maxTokens");
			if (next.input !== void 0 && JSON.stringify(next.input) !== JSON.stringify(current.input)) changed.push("input");
			if (next.reasoningEfforts !== void 0 && JSON.stringify(next.reasoningEfforts) !== JSON.stringify(current.reasoningEfforts)) changed.push("reasoningEfforts");
			return changed;
		}
		/**
		 * Classify every candidate against the stored models, and report stored
		 * models the candidates never mentioned. A `missing` row is informational:
		 * nothing is deleted without an explicit choice.
		 * @param candidates - the gathered candidates.
		 * @param existing - the currently stored models array.
		 * @param pinned - normalized ids the user declared in the settings user layer.
		 * @returns one row per candidate, then one row per unmentioned stored model.
		 */
		function computeDiff(candidates, existing, pinned) {
			const rows = [];
			const byKey = new Map();
			for (const model of Array.isArray(existing) ? existing : []) byKey.set(normalizeModelId(model?.id), model);
			const seen = new Set();
			for (const candidate of candidates) {
				const key = normalizeModelId(candidate.id);
				seen.add(key);
				const current = byKey.get(key);
				const locked = pinned.has(key);
				if (current === void 0) rows.push({ id: candidate.id, kind: "added", current: void 0, next: candidate, changed: [], locked, borrowed: candidate.borrowed === true });
				else {
					const changed = diffFields(current, candidate);
					rows.push({ id: candidate.id, kind: changed.length > 0 ? "changed" : "unchanged", current, next: candidate, changed, locked, borrowed: candidate.borrowed === true });
				}
			}
			for (const [key, model] of byKey) {
				if (seen.has(key)) continue;
				rows.push({ id: model?.id ?? key, kind: "missing", current: model, next: void 0, changed: [], locked: pinned.has(key) });
			}
			return rows;
		}
		/**
		 * Project one candidate into the model entry a dsh profile stores.
		 * @param candidate - the accepted candidate.
		 * @returns the stored shape.
		 */
		function toStoredModel(candidate) {
			const model = { id: candidate.id };
			if (typeof candidate.name === "string" && candidate.name !== "") model.name = candidate.name;
			if (candidate.contextWindow !== void 0) model.contextWindow = candidate.contextWindow;
			if (candidate.maxTokens !== void 0) model.maxTokens = candidate.maxTokens;
			if (candidate.input !== void 0) model.input = candidate.input;
			if (candidate.reasoningEfforts !== void 0) model.reasoningEfforts = candidate.reasoningEfforts;
			return model;
		}
		/**
		 * Compose the models array to write: stored entries keep their position and
		 * any field the accepted candidates do not restate, accepted candidates
		 * replace their stored counterpart or append.
		 * @param existing - the currently stored models array.
		 * @param accepted - the accepted candidates, keyed by normalized id.
		 * @returns the complete replacement array.
		 */
		function composeModels(existing, accepted) {
			const out = [];
			const consumed = new Set();
			for (const model of Array.isArray(existing) ? existing : []) {
				const key = normalizeModelId(model?.id);
				const replacement = accepted.get(key);
				if (replacement === void 0) out.push(model);
				else {
					out.push(toStoredModel(replacement));
					consumed.add(key);
				}
			}
			for (const [key, candidate] of accepted) if (!consumed.has(key)) out.push(toStoredModel(candidate));
			return out;
		}
		/**
		 * Build the single path-addressed edit that applies a models array.
		 * A path-addressed `set` is deliberate: a wholesale `replace` rebuilt from
		 * a redacted view would delete every secret the wire never returned.
		 * @param route - the provider route key.
		 * @param models - the complete models array.
		 * @returns one settings path operation.
		 */
		function buildOps(route, models) {
			return [{ op: "set", path: ["providers", route, "models"], value: models }];
		}
		/**
		 * The ids a user pinned in the settings user layer for one route.
		 * @param view - the llm-pi-ai namespace view.
		 * @param route - the provider route key.
		 * @returns normalized pinned ids.
		 */
		function pinnedIds(view, route) {
			const models = view?.user?.providers?.[route]?.models;
			const out = new Set();
			if (!Array.isArray(models)) return out;
			for (const model of models) out.add(normalizeModelId(model?.id));
			return out;
		}
		/**
		 * Extract the stored provider profile for one route from a namespace view.
		 * @param view - the llm-pi-ai namespace view.
		 * @param route - the provider route key.
		 * @returns the profile, or undefined when the route is not configured.
		 */
		function profileOf(view, route) {
			const profile = view?.value?.providers?.[route];
			if (profile === null || typeof profile !== "object") return void 0;
			return {
				baseURL: typeof profile.baseURL === "string" ? profile.baseURL : void 0,
				api: typeof profile.api === "string" ? profile.api : void 0,
				apiKeyEnv: typeof profile.apiKeyEnv === "string" ? profile.apiKeyEnv : void 0,
				models: Array.isArray(profile.models) ? profile.models : []
			};
		}
		/** Human-readable one-line summary of the changed fields. */
		function deltaText(row) {
			if (row.kind === "added") return row.next?.contextWindow !== void 0 ? "新增 · 上下文 " + row.next.contextWindow : "新增";
			if (row.kind === "missing") return "配置中存在，但候选未提供（不会自动删除）";
			return row.changed.join("、");
		}
		//#endregion
		//#region locales
		const NS = "modelSync";
		const zh = {
			title: "模型同步",
			current: "当前 {count} 个模型",
			refresh: "刷新候选",
			refreshing: "正在刷新…",
			apply: "应用所选（{count}）",
			applying: "正在写入…",
			selectAll: "全选变更",
			selectNone: "清空选择",
			colModel: "模型",
			colKind: "状态",
			colChange: "变更字段",
			kindAdded: "新增",
			kindChanged: "有变更",
			kindUnchanged: "无变更",
			kindMissing: "候选缺失",
			pinned: "手工锁定",
			borrowed: "借用同名模型 · 需核对",
			sourceEndpoint: "端点 {count}",
			sourceModelsDev: "models.dev {count}",
			sourceRouter: "OpenRouter {count}",
			noCandidate: "没有取到候选模型。",
			allUnchanged: "全部模型都是最新的。",
			applied: "已写入 {count} 个模型。",
			verified: "回读验证通过：host 解析到 {count} 个模型（revision {revision}）。",
			verifyMismatch: "已写入，但回读结果与预期不符：期望 {expected} 个，实际 {actual} 个。",
			conflict: "配置在别处被改动（revision 冲突），请重新刷新后再试。",
			notConfigured: "此提供商尚未保存配置，先添加后再同步。",
			unsupported: "此分区暂不支持同步。",
			endpointFailed: "端点探测失败：{message}",
			modelsDevFailed: "models.dev 读取失败：{message}",
			routerFailed: "OpenRouter 读取失败：{message}",
			hint: "端点探测走 dsh 的模型发现：若该路由名与内置目录同名，返回的是内置快照而非联网结果。本站点未收录在 models.dev 时，借用同名模型的元数据作参考（容量仍以端点实测为准）。"
		};
		const en = {
			title: "Model sync",
			current: "{count} model(s) stored",
			refresh: "Refresh candidates",
			refreshing: "Refreshing…",
			apply: "Apply selected ({count})",
			applying: "Writing…",
			selectAll: "Select changes",
			selectNone: "Clear selection",
			colModel: "Model",
			colKind: "Status",
			colChange: "Changed fields",
			kindAdded: "New",
			kindChanged: "Changed",
			kindUnchanged: "Unchanged",
			kindMissing: "Not advertised",
			pinned: "User-pinned",
			borrowed: "Borrowed metadata - verify",
			sourceEndpoint: "endpoint {count}",
			sourceModelsDev: "models.dev {count}",
			sourceRouter: "OpenRouter {count}",
			noCandidate: "No candidate models were found.",
			allUnchanged: "Every model is already current.",
			applied: "Wrote {count} model(s).",
			verified: "Verified: the host resolves {count} model(s) (revision {revision}).",
			verifyMismatch: "Written, but the read-back differs: expected {expected}, got {actual}.",
			conflict: "Settings changed elsewhere (revision conflict). Refresh and try again.",
			notConfigured: "This provider has no saved configuration yet.",
			unsupported: "Sync is not supported for this section.",
			endpointFailed: "Endpoint probe failed: {message}",
			modelsDevFailed: "models.dev fetch failed: {message}",
			routerFailed: "OpenRouter fetch failed: {message}",
			hint: "Endpoint probing uses dsh's model discovery: a route named after a built-in catalog provider returns that snapshot, not a live listing. When the endpoint is not on models.dev, a same-named model's metadata is borrowed as a hint (capacity still follows the endpoint)."
		};
		//#endregion
		//#region component
		/**
		 * Read the llm-pi-ai namespace view and locate one route's profile.
		 * @param remote - the settings Remote face.
		 * @param ns - the namespace key to read.
		 * @param route - the provider route key.
		 * @returns the view, the profile, and pinned ids.
		 */
		async function readProfile(remote, ns, route) {
			const described = await remote.describe();
			if (!described.ok) throw new Error(described.error.message);
			const view = described.value.namespaces.find((entry) => entry.ns === ns);
			if (view === void 0) throw new Error(ns + " namespace is not registered");
			return { view, profile: profileOf(view, route), pinned: pinnedIds(view, route) };
		}
		/** Fetch JSON with a caller-supplied timeout. */
		async function fetchJson(url, timeoutMs) {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);
			try {
				const response = await fetch(url, { signal: controller.signal });
				if (!response.ok) throw new Error("HTTP " + response.status);
				return await response.json();
			} finally {
				clearTimeout(timer);
			}
		}
		/**
		 * Build one provider card's sync controls.
		 * @param syncNs - the settings namespace this card edits.
		 * @param t - the bound locale lookup.
		 * @param remote - the Remote faces this card calls, captured from the plugin
		 *   context: slot owner props carry the provider row only, never a context.
		 * @returns the React component.
		 */
		function makeCard(syncNs, t, remote) {
			return function ProviderSyncCard(props) {
				const route = props.provider?.provider;
				const supported = props.provider?.settingsNs === syncNs;
				const [busy, setBusy] = react.useState("");
				const [rows, setRows] = react.useState(null);
				const [sources, setSources] = react.useState(null);
				const [modelCount, setModelCount] = react.useState(null);
				const [notice, setNotice] = react.useState("");
				const [failure, setFailure] = react.useState("");
				const [selected, setSelected] = react.useState(() => new Set());
				const stored = props.configured === false;
				const refresh = react.useCallback(async () => {
					setBusy("refresh");
					setNotice("");
					setFailure("");
					setRows(null);
					const notes = [];
					try {
						const { profile, pinned } = await readProfile(remote.settings, syncNs, route);
						if (profile === void 0) {
							setFailure(t("notConfigured"));
							return;
						}
						setModelCount(profile.models.length);
						const endpointResult = await remote.llm.discoverModels(syncNs, {
							provider: route,
							baseURL: profile.baseURL,
							api: profile.api
						});
						const endpoint = endpointResult.ok ? endpointResult.value : [];
						if (!endpointResult.ok) notes.push(t("endpointFailed", { message: endpointResult.error.message }));
						let dev = [];
						let globalDev = [];
						let router = [];
						try {
							const catalog = await fetchJson(CONFIG.sources.modelsDev, CONFIG.metadataTimeoutMs);
							const match = matchModelsDevProvider(catalog, profile);
							if (match !== void 0) dev = Object.values(match.provider.models ?? {}).map(fromModelsDev);
							globalDev = flattenCatalog(catalog);
						} catch (error) {
							notes.push(t("modelsDevFailed", { message: error instanceof Error ? error.message : String(error) }));
						}
						try {
							const body = await fetchJson(CONFIG.sources.openRouter, CONFIG.metadataTimeoutMs);
							router = (Array.isArray(body?.data) ? body.data : []).map(fromOpenRouter);
						} catch (error) {
							notes.push(t("routerFailed", { message: error instanceof Error ? error.message : String(error) }));
						}
						const candidates = buildCandidates({ endpoint, modelsDev: dev, globalModelsDev: globalDev, openRouter: router });
						const diff = computeDiff(candidates, profile.models, pinned);
						setRows(diff);
						setSources({ endpoint: endpoint.length, modelsDev: dev.length, openRouter: router.length });
						setSelected(new Set(diff.filter((row) => (row.kind === "added" || row.kind === "changed") && row.borrowed !== true).map((row) => row.id)));
						if (diff.length === 0) setNotice(t("noCandidate"));
						else if (diff.every((row) => row.kind === "unchanged" || row.kind === "missing")) setNotice(t("allUnchanged"));
						if (notes.length > 0) setFailure(notes.join("；"));
					} catch (error) {
						setFailure(error instanceof Error ? error.message : String(error));
					} finally {
						setBusy("");
					}
				}, [remote, route, syncNs, t]);
				const toggle = react.useCallback((id) => {
					setSelected((previous) => {
						const next = new Set(previous);
						if (next.has(id)) next.delete(id);
						else next.add(id);
						return next;
					});
				}, []);
				const applySelected = react.useCallback(async () => {
					if (rows === null) return;
					setBusy("apply");
					setNotice("");
					setFailure("");
					try {
						const { view, profile } = await readProfile(remote.settings, syncNs, route);
						if (profile === void 0) {
							setFailure(t("notConfigured"));
							return;
						}
						const accepted = new Map();
						for (const row of rows) {
							if (!selected.has(row.id) || row.next === void 0) continue;
							accepted.set(normalizeModelId(row.next.id), row.next);
						}
						const models = composeModels(profile.models, accepted);
						const response = await remote.settings.mutate(syncNs, buildOps(route, models), view.revision);
						if (!response.ok) {
							setFailure(response.error.code === "settings/conflict" ? t("conflict") : response.error.message);
							return;
						}
						const after = await readProfile(remote.settings, syncNs, route);
						const actual = after.profile?.models?.length ?? 0;
						if (actual === models.length) setNotice(t("verified", { count: actual, revision: after.view.revision }));
						else setNotice(t("verifyMismatch", { expected: models.length, actual }));
					} catch (error) {
						setFailure(error instanceof Error ? error.message : String(error));
					} finally {
						setBusy("");
					}
				}, [remote, rows, route, selected, syncNs, t]);
				if (!supported) return null;
				const changeCount = rows === null ? 0 : rows.filter((row) => selected.has(row.id) && row.next !== void 0).length;
				const head = (0, react_jsx_runtime.jsxs)("div", {
					className: "ms_head",
					children: [
						(0, react_jsx_runtime.jsx)("span", { className: "ms_title", children: t("title") }),
						modelCount === null ? null : (0, react_jsx_runtime.jsx)("span", { className: "ms_count", children: t("current", { count: modelCount }) }),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ms_btn",
							disabled: busy !== "" || stored,
							onClick: refresh,
							children: busy === "refresh" ? t("refreshing") : t("refresh")
						}),
						rows !== null && changeCount > 0 ? (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ms_btn ms_btnPrimary",
							disabled: busy !== "",
							onClick: applySelected,
							children: busy === "apply" ? t("applying") : t("apply", { count: changeCount })
						}) : null
					]
				});
				return (0, react_jsx_runtime.jsxs)("div", {
					className: "ms_wrap",
					children: [
						head,
						sources !== null ? (0, react_jsx_runtime.jsx)("p", {
							className: "ms_src",
							children: [
								t("sourceEndpoint", { count: sources.endpoint }),
								" · ",
								t("sourceModelsDev", { count: sources.modelsDev }),
								" · ",
								t("sourceRouter", { count: sources.openRouter })
							]
						}) : null,
						rows !== null && rows.length > 0 ? (0, react_jsx_runtime.jsx)("div", {
							className: "ms_scroll",
							children: (0, react_jsx_runtime.jsxs)("table", {
								className: "ms_table",
								children: [
									(0, react_jsx_runtime.jsx)("thead", {
										children: (0, react_jsx_runtime.jsxs)("tr", {
											children: [
												(0, react_jsx_runtime.jsx)("th", { style: { width: 28 } }),
												(0, react_jsx_runtime.jsx)("th", { children: t("colModel") }),
												(0, react_jsx_runtime.jsx)("th", { children: t("colKind") }),
												(0, react_jsx_runtime.jsx)("th", { children: t("colChange") })
											]
										})
									}),
									(0, react_jsx_runtime.jsx)("tbody", {
										children: rows.map((row) => (0, react_jsx_runtime.jsxs)("tr", {
											children: [
												(0, react_jsx_runtime.jsx)("td", {
													children: (0, react_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: selected.has(row.id),
														disabled: row.next === void 0,
														onChange: () => toggle(row.id)
													})
												}),
												(0, react_jsx_runtime.jsx)("td", { className: "ms_id", children: row.id }),
												(0, react_jsx_runtime.jsxs)("td", {
													children: [
														(0, react_jsx_runtime.jsx)("span", {
															className: row.kind === "added" ? "ms_tag ms_tagNew" : row.kind === "changed" ? "ms_tag ms_tagChange" : row.kind === "missing" ? "ms_tag ms_tagGone" : "ms_tag",
															children: row.kind === "added" ? t("kindAdded") : row.kind === "changed" ? t("kindChanged") : row.kind === "missing" ? t("kindMissing") : t("kindUnchanged")
														}),
														row.locked ? (0, react_jsx_runtime.jsx)("span", { className: "ms_tag ms_tagLock", style: { marginLeft: 4 }, children: t("pinned") }) : null,
														row.borrowed ? (0, react_jsx_runtime.jsx)("span", { className: "ms_tag ms_tagLock", style: { marginLeft: 4 }, children: t("borrowed") }) : null
													]
												}),
												(0, react_jsx_runtime.jsx)("td", { className: "ms_deltas", children: deltaText(row) })
											]
										}, row.kind + ":" + row.id))
									})
								]
							})
						}) : null,
						notice !== "" ? (0, react_jsx_runtime.jsx)("p", { className: "ms_ok", children: notice }) : null,
						failure !== "" ? (0, react_jsx_runtime.jsx)("p", { className: "ms_error", children: failure }) : null,
						(0, react_jsx_runtime.jsx)("p", { className: "ms_hint", children: t("hint") })
					]
				});
			};
		}
		//#endregion
		//#region entry
		const inject = ["slots", "locale", "remote", "remote.llm", "remote.settings"];
		/**
		 * Contribute sync controls to every provider card of each supported section.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "model-sync: dictionaries");
			const t = ctx.locale.bind(NS);
			for (const syncNs of CONFIG.settingsNamespaces) {
				ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({
					name: "settings.models.provider-card",
					key: syncNs
				}, makeCard(syncNs, t, ctx.remote)));
			}
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.makeCard = makeCard;
		exports.normalizeModelId = normalizeModelId;
		exports.normalizeBaseUrl = normalizeBaseUrl;
		exports.keepModalities = keepModalities;
		exports.fromReasoningOptions = fromReasoningOptions;
		exports.fromModelsDev = fromModelsDev;
		exports.fromOpenRouter = fromOpenRouter;
		exports.matchModelsDevProvider = matchModelsDevProvider;
		exports.flattenCatalog = flattenCatalog;
		exports.mergeCandidate = mergeCandidate;
		exports.buildCandidates = buildCandidates;
		exports.diffFields = diffFields;
		exports.computeDiff = computeDiff;
		exports.toStoredModel = toStoredModel;
		exports.composeModels = composeModels;
		exports.buildOps = buildOps;
		exports.pinnedIds = pinnedIds;
		exports.profileOf = profileOf;
		exports.deltaText = deltaText;
		return module.exports;
	}
});
