// Client bundle for dsh-client-ui-plugin-model-capabilities.
// Built from this template by build.mjs (injects config.json at the CONFIG
// placeholder below).
//
// What it does:
//  - Registers a top-level Settings section "模型能力" (settings.section slot,
//    order 12 — right after Models=10, before Plugins=15).
//  - On mount it fetches the read-only Host route /plugin-model-capabilities/list
//    and renders every provider/model with its declared input modalities
//    (text/image), context window, and reasoning efforts — the capability data
//    the official model picker does not surface.
//  - Pure presentation: the browser never touches the LLM registry directly.
window.__ModuleLoader__.load({
	id: "dsh-client-ui-plugin-model-capabilities",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region css
		const css = `
.mc_section{width:100%;max-width:860px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;display:flex}
.mc_status,.mc_summary,.mc_hint,.mc_none{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px;margin:0}
.mc_failure{color:var(--dsw-alias-state-error-primary);align-items:center;gap:10px;display:flex}
.mc_failure p{margin:0}.mc_failure button{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:4px 10px}
.mc_search{width:100%;color:var(--dsw-alias-label-tertiary);align-items:center;display:flex;position:relative}
.mc_search input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;height:36px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;outline:none;padding:0 34px 0 14px;font-size:13px}
.mc_search input::placeholder{color:var(--dsw-alias-label-tertiary)}
.mc_search input:focus-visible{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent)}
.mc_legend{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;display:flex;gap:12px;flex-wrap:wrap;padding:0 2px}
.mc_legend b{font-weight:600;color:var(--dsw-alias-label-secondary)}
.mc_groups{flex-direction:column;gap:16px;display:flex}
.mc_group{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;min-width:0;overflow:hidden}
.mc_groupHead{display:flex;align-items:baseline;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.mc_groupTitle{margin:0;font-size:14px;font-weight:600;line-height:20px}
.mc_groupCount{color:var(--dsw-alias-label-tertiary);font-size:12px;font-variant-numeric:tabular-nums}
.mc_rows{flex-direction:column;padding:0;margin:0;list-style:none;display:flex}
.mc_row{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.mc_row:last-child{border-bottom:none}
.mc_row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mc_rowMain{min-width:0;flex:1}
.mc_rowName{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mc_modelName{font-size:13px;font-weight:600;line-height:20px}
.mc_caps{flex:none;border:1px solid var(--dsw-alias-border-l3);border-radius:4px;padding:1px 6px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.mc_caps_image{color:var(--dsw-alias-state-business-primary)}
.mc_caps_unknown{color:var(--dsw-alias-state-warn-label)}
.mc_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:2px 0 0;word-break:break-word}
.mc_meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;display:flex;gap:12px;flex-wrap:wrap;margin:3px 0 0;font-variant-numeric:tabular-nums}
.mc_meta span{white-space:nowrap}
.mc_errColor{color:var(--dsw-alias-state-error-primary)}
.mc_none{font-size:12px;line-height:18px;padding:4px 12px}
`;
		const tagId = "dsh-client-ui-plugin-model-capabilities/main.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-client-ui-plugin-model-capabilities";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region config
		const CONFIG = /*__CONFIG_JSON__*/;
		//#endregion
		//#region helpers
		/** POST JSON to our host route and unwrap the envelope. */
		function request(path, body) {
			return fetch(path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body || {})
			}).then((response) => response.json());
		}
		/** Flatten every model row into a searchable key. */
		function rowSearchText(group, model) {
			return [group.name, group.id, model.name, model.id, model.description].filter((value) => typeof value === "string").join(" ").toLocaleLowerCase();
		}
		/** Whether a model declares image input at all. */
		function supportsImage(model) {
			return Array.isArray(model.inputModalities) && model.inputModalities.includes("image");
		}
		/** Compact context-window display (e.g. 131072 -> "128K"). */
		function formatContext(v) {
			if (typeof v !== "number" || !Number.isFinite(v)) return void 0;
			if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
			if (v >= 1000) return Math.round(v / 1024) + "K";
			return String(v);
		}
		//#endregion
		//#region locales
		const NS = "modelCapabilities";
		const zh = {
			nav: "模型能力",
			loading: "正在读取模型能力…",
			error: "暂时无法读取模型能力。",
			retry: "重试",
			search: "搜索模型",
			legend: "能力徽标：",
			legend: "能力说明：",
			legendImage: "图像（可识图）",
			legendText: "文本",
			legendUnknown: "未声明（未知）",
			summary: "共 {groups} 个提供商 · {models} 个模型 · {imageCapable} 个支持图像",
			noModels: "此提供商未提供模型。",
			empty: "没有可用的模型。",
			emptySearch: "没有匹配的模型。",
			imageCapable: "支持图像",
			textOnly: "仅文本",
			contextLabel: "上下文",
			contextNone: "上下文未知",
			reasoningLabel: "推理等级",
			capsUnknown: "能力未声明",
			capsImageText: "文本 + 图像（可识图）",
			capsImageOnly: "图像（可识图）",
			capsTextOnly: "仅文本"
		};
		const en = {
			nav: "Model capabilities",
			loading: "Reading model capabilities…",
			error: "Model capabilities are temporarily unavailable.",
			retry: "Retry",
			search: "Search models",
			legend: "Legend:",
			legendImage: "Image (vision-capable)",
			legendText: "Text",
			legendUnknown: "Undeclared (unknown)",
			summary: "{groups} provider(s) · {models} model(s) · {imageCapable} supporting image",
			noModels: "This provider lists no models.",
			empty: "No models available.",
			emptySearch: "No matching models.",
			imageCapable: "Image-capable",
			textOnly: "Text-only",
			contextLabel: "Context",
			contextNone: "Context unknown",
			reasoningLabel: "Efforts",
			capsUnknown: "Unknown",
			capsImageText: "Text + image (vision-capable)",
			capsImageOnly: "Image (vision-capable)",
			capsTextOnly: "Text only"
		};
		//#endregion
		//#region component
		/** Render the input-modality capability as plain Chinese text. */
		function CapabilityText({ model, t }) {
			const modalities = Array.isArray(model.inputModalities) ? model.inputModalities : void 0;
			let label;
			let cls = "mc_caps";
			if (modalities === void 0) {
				label = t("capsUnknown");
				cls = "mc_caps mc_caps_unknown";
			} else if (modalities.includes("image") && modalities.includes("text")) {
				label = t("capsImageText");
				cls = "mc_caps mc_caps_image";
			} else if (modalities.includes("image")) {
				label = t("capsImageOnly");
				cls = "mc_caps mc_caps_image";
			} else if (modalities.includes("text")) {
				label = t("capsTextOnly");
			} else {
				label = t("capsUnknown");
				cls = "mc_caps mc_caps_unknown";
			}
			return (0, react_jsx_runtime.jsx)("span", {
				className: cls,
				title: label,
				children: label
			});
		}
		/** One model row: name + modality badges + context/effort/description. */
		function ModelRow({ group, model, t }) {
			const context = formatContext(model.contextWindow);
			const reasoning = Array.isArray(model.reasoning && model.reasoning.efforts) && model.reasoning.efforts.length > 0
				? model.reasoning.efforts.map((effort) => effort.name).join(" / ")
				: void 0;
			return (0, react_jsx_runtime.jsxs)("li", {
				className: "mc_row",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "mc_rowMain",
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: "mc_rowName",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "mc_modelName",
										title: group.name + " / " + model.name,
										children: model.name
									}),
									(0, react_jsx_runtime.jsx)(CapabilityText, { model, t })
								]
							}),
							model.error !== void 0 ? (0, react_jsx_runtime.jsx)("p", {
								className: "mc_desc mc_errColor",
								children: model.error
							}) : null,
							model.description !== void 0 && model.description !== model.name ? (0, react_jsx_runtime.jsx)("p", {
								className: "mc_desc",
								children: model.description
							}) : null,
							(context !== void 0 || reasoning !== void 0) ? (0, react_jsx_runtime.jsxs)("div", {
								className: "mc_meta",
								children: [
									context !== void 0 ? (0, react_jsx_runtime.jsxs)("span", { children: [t("contextLabel") + ": ", context] }) : (0, react_jsx_runtime.jsxs)("span", {
										className: "mc_caps_unknown",
										children: t("contextNone")
									}),
									reasoning !== void 0 ? (0, react_jsx_runtime.jsxs)("span", { children: [t("reasoningLabel") + ": ", reasoning] }) : null
								]
							}) : (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, {})
						]
					})
				]
			});
		}
		/** The Settings section body: loads /plugin-model-capabilities/list on mount. */
		function ModelCapabilitiesSection(props) {
			const { t } = props;
			const [state, setState] = (0, react.useState)({ status: "loading" });
			const [query, setQuery] = (0, react.useState)("");
			const [attempt, setAttempt] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				let current = true;
				setState({ status: "loading" });
				request(CONFIG.route, {}).then((data) => {
					if (!data.ok) throw new Error((data.error && data.error.message) || "list failed");
					if (current) setState({ status: "ready", groups: data.groups || [], failures: data.failures || [] });
				}).catch((error) => {
					if (current) setState({ status: "error", message: error && error.message ? error.message : String(error) });
				});
				return () => {
					current = false;
				};
			}, [attempt]);
			if (t === void 0) return null;
			const normalized = query.trim().toLocaleLowerCase();
			const ready = state.status === "ready";
			const rows = ready ? state.groups.map((group) => ({
				group,
				models: (group.models || []).filter((model) => normalized === "" || rowSearchText(group, model).includes(normalized))
			})) : [];
			const totalModels = ready ? state.groups.reduce((sum, group) => sum + (group.models || []).length, 0) : 0;
			const imageCapable = ready ? state.groups.reduce((sum, group) => sum + (group.models || []).filter(supportsImage).length, 0) : 0;
			const retry = () => setAttempt((value) => value + 1);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "mc_section",
				"aria-busy": state.status === "loading",
				children: [
					state.status === "loading" ? (0, react_jsx_runtime.jsx)("p", {
						className: "mc_status",
						children: t("loading")
					}) : null,
					state.status === "error" ? (0, react_jsx_runtime.jsxs)("div", {
						className: "mc_failure",
						children: [(0, react_jsx_runtime.jsx)("p", {
							role: "alert",
							children: t("error") + (state.message ? "：" + state.message : "")
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: retry,
							children: t("retry")
						})]
					}) : null,
					ready ? (0, react_jsx_runtime.jsxs)("div", {
						className: "mc_groups",
						children: [
							(0, react_jsx_runtime.jsxs)("label", {
								className: "mc_search",
								children: [
									(0, react_jsx_runtime.jsx)("span", { className: "mc_badge_unknown", style: { paddingRight: 6 }, children: "🔍" }),
									(0, react_jsx_runtime.jsx)("input", {
										type: "search",
										value: query,
										placeholder: t("search"),
										"aria-label": t("search"),
										onChange: (event) => setQuery(event.currentTarget.value)
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: "mc_legend",
								children: [
									(0, react_jsx_runtime.jsx)("span", { children: t("legend") }),
									(0, react_jsx_runtime.jsx)("span", { children: t("legendImage") }),
									(0, react_jsx_runtime.jsx)("span", { children: t("legendText") }),
									(0, react_jsx_runtime.jsx)("span", { children: t("legendUnknown") })
								]
							}),
							(0, react_jsx_runtime.jsx)("p", {
								className: "mc_summary",
								children: t("summary", { groups: state.groups.length, models: totalModels, imageCapable })
							}),
							state.failures.length > 0 ? (0, react_jsx_runtime.jsxs)("div", {
								className: "mc_failure",
								children: [(0, react_jsx_runtime.jsx)("p", {
									children: state.failures.map((failure) => `${failure.name}: ${failure.message}`).join("；")
								})]
							}) : null,
							totalModels === 0 ? (0, react_jsx_runtime.jsx)("p", {
								className: "mc_none",
								children: t("empty")
							}) : null,
							totalModels > 0 && rows.every((entry) => entry.models.length === 0) ? (0, react_jsx_runtime.jsx)("p", {
								className: "mc_none",
								children: t("emptySearch")
							}) : null,
							rows.map(({ group, models }) => (0, react_jsx_runtime.jsxs)("section", {
								className: "mc_group",
								key: group.id,
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: "mc_groupHead",
										children: [
											(0, react_jsx_runtime.jsx)("h3", { className: "mc_groupTitle", children: group.name }),
											(0, react_jsx_runtime.jsx)("span", {
												className: "mc_groupCount",
												children: models.length
											})
										]
									}),
									models.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
										className: "mc_none",
										children: t("noModels")
									}) : (0, react_jsx_runtime.jsx)("ul", {
										className: "mc_rows",
										children: models.map((model) => (0, react_jsx_runtime.jsx)(ModelRow, { group, model, t }, model.id))
									})
								]
							}))
						]
					}) : null
				]
			});
		}
		//#endregion
		//#region entry
		const inject = ["slots", "locale"];
		/** Contribute the "模型能力" section to the Settings page nav. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "model-capabilities: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "model-capabilities",
				order: 12,
				label: () => t("nav"),
				locale: NS
			}, ModelCapabilitiesSection));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.ModelCapabilitiesSection = ModelCapabilitiesSection;
		exports.CapabilityText = CapabilityText;
		return module.exports;
	}
});
