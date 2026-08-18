window.__ModuleLoader__.load({
	id: "dsh-client-ui-plugin-explainer",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region css
		const css = ".pEx_section{width:100%;max-width:860px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;display:flex}.pEx_status,.pEx_summary,.pEx_explainText,.pEx_failure p{margin:0}.pEx_status,.pEx_summary,.pEx_explainText{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}.pEx_failure{color:var(--dsw-alias-state-error-primary);align-items:center;gap:10px;display:flex}.pEx_failure button{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:4px 10px}.pEx_catalog{flex-direction:column;gap:12px;display:flex}.pEx_search{width:100%;color:var(--dsw-alias-label-tertiary);align-items:center;display:flex;position:relative}.pEx_search>svg{pointer-events:none;position:absolute;left:12px}.pEx_search input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;height:36px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;outline:none;padding:0 34px 0 36px;font-size:13px}.pEx_search input::placeholder{color:var(--dsw-alias-label-tertiary)}.pEx_search input:focus-visible{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent)}.pEx_summary{align-items:center;gap:7px;padding:0 2px;display:flex;font-variant-numeric:tabular-nums}.pEx_heading{align-items:baseline;gap:7px;padding:0 2px;display:flex}.pEx_heading h3{margin:0;font-size:13px;font-weight:600;line-height:20px}.pEx_heading span{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-size:12px;line-height:18px}.pEx_cards{flex-direction:column;gap:10px;margin:0;padding:0;list-style:none;display:flex}.pEx_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;min-width:0;overflow:hidden}.pEx_card[data-open=true]{border-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-shadow-lv1)}.pEx_cardHeader{width:100%;align-items:stretch;display:flex}.pEx_expand{flex:1;min-width:0;border:0;background:0 0;color:inherit;font:inherit;align-items:center;gap:10px;padding:10px 14px;display:flex;text-align:left;cursor:pointer}.pEx_expand:hover{background:var(--dsw-alias-bg-layer-4)}.pEx_cardTitle{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:600;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pEx_cardTrailing{flex:none;align-items:center;gap:8px;display:inline-flex}.pEx_statusDot{width:8px;height:8px;border-radius:50%;flex:none}.pEx_statusDot[data-phase=active]{background:var(--dsw-alias-state-success-primary)}.pEx_statusDot[data-phase=loading],.pEx_statusDot[data-phase=pending]{background:var(--dsw-alias-state-warning-primary)}.pEx_statusDot[data-phase=failed]{background:var(--dsw-alias-state-error-primary)}.pEx_statusDot[data-phase=unloading],.pEx_statusDot[data-phase=unobserved]{background:var(--dsw-alias-label-tertiary)}.pEx_tag{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.pEx_tag[data-enabled=false]{color:var(--dsw-alias-label-tertiary)}.pEx_chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .15s ease}.pEx_card[data-open=true] .pEx_chevron{transform:rotate(180deg)}.pEx_explain{padding:0 14px 10px}.pEx_explainText{font-size:13px;line-height:20px}.pEx_unexplained{font-style:italic}.pEx_cardDetails{border-top:1px solid var(--dsw-alias-border-l2);flex-direction:column;gap:8px;padding:10px 14px;display:flex}.pEx_entryValue{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-radius:6px;padding:2px 8px;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:12px;line-height:20px;overflow-wrap:anywhere}.pEx_details{margin:0;gap:4px 16px;display:grid;grid-template-columns:auto 1fr}.pEx_details div{min-width:0;display:contents}.pEx_details dt{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px}.pEx_details dd{margin:0;color:var(--dsw-alias-label-primary);font-size:12px;line-height:20px;overflow-wrap:anywhere}.pEx_visuallyHidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;clip:rect(0 0 0 0);overflow:hidden;white-space:nowrap}.pEx_notice{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-radius:8px;align-items:center;gap:8px;padding:8px 12px;display:flex;font-size:12px;line-height:18px}.pEx_switch{position:relative;flex:none;width:32px;height:18px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);cursor:pointer;padding:0;transition:background .15s ease}.pEx_switch[aria-checked=true]{background:var(--dsw-alias-state-success-primary);border-color:transparent}.pEx_switch:disabled{opacity:.45;cursor:not-allowed}.pEx_switchKnob{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .15s ease}.pEx_switch[aria-checked=true] .pEx_switchKnob{transform:translateX(14px);background:#fff}.pEx_pendingTag{white-space:nowrap;background:var(--dsw-alias-state-warning-primary);color:#fff;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.pEx_refresh{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0;border-radius:6px;padding:2px 10px;font:inherit;font-size:12px;line-height:20px;cursor:pointer}.pEx_refresh:hover{color:var(--dsw-alias-label-primary)}";
		const tagId = "dsh-client-ui-plugin-explainer/main.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-client-ui-plugin-explainer";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region dictionary
		const DICTIONARY = /*__DICTIONARY_JSON__*/;
		/**
		* Entry ids that must never be disabled from the UI. Keep in sync with
		* the host copy in lib/index.js (PROTECTED_IDS).
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
		//#endregion
		//#region helpers
		const PHASE_KEYS = {
			pending: "pending",
			loading: "loadingPhase",
			active: "active",
			failed: "failed",
			unloading: "unloading"
		};
		/** Localized label for one root Fiber phase. */
		function phaseLabel(phase, t) {
			return phase === null ? t("unobserved") : t(PHASE_KEYS[phase]);
		}
		/** Compact a module specifier for the card title. */
		function moduleShortName(moduleName) {
			return (moduleName.startsWith("@") ? moduleName.slice(moduleName.indexOf("/") + 1) : moduleName).replace(/^cordis:/, "").replace(/^cordis-plugin-/, "").replace(/^dsh-(?:host-|client-)?/, "");
		}
		/** Plain-language explanation for a module name, or undefined. */
		function explainOf(moduleName) {
			const hit = DICTIONARY[moduleName];
			if (typeof hit === "string" && hit.length > 0) return hit;
			return void 0;
		}
		/** Whether an inventory row matches the catalog query (name, entry id, or explanation). */
		function matches(entry, normalizedQuery) {
			if (normalizedQuery.length === 0) return true;
			const explanation = explainOf(entry.moduleName);
			return [entry.moduleName, entry.entryId, explanation].some((value) => typeof value === "string" && value.toLocaleLowerCase().includes(normalizedQuery));
		}
		//#endregion
		//#region component
		/** Render the explained read-only Loader inventory. */
		function ExplainedPluginTab({ list, t }) {
			const catalogId = (0, react.useId)();
			const [request, setRequest] = (0, react.useState)(0);
			const [query, setQuery] = (0, react.useState)("");
			const [expanded, setExpanded] = (0, react.useState)(null);
			const [state, setState] = (0, react.useState)({ status: "loading" });
			const [pending, setPending] = (0, react.useState)({});
			const [busy, setBusy] = (0, react.useState)({});
			const [notice, setNotice] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let current = true;
				Promise.resolve().then(() => list()).then((snapshot) => {
					if (current) setState({
						status: "ready",
						snapshot
					});
				}, () => {
					if (current) setState({ status: "error" });
				});
				return () => {
					current = false;
				};
			}, [list, request]);
			const normalizedQuery = query.trim().toLocaleLowerCase();
			const filteredEntries = (0, react.useMemo)(() => state.status === "ready" ? state.snapshot.entries.filter((entry) => matches(entry, normalizedQuery)) : [], [normalizedQuery, state]);
			(0, react.useEffect)(() => {
				if (expanded !== null && !filteredEntries.some((entry) => entry.entryId === expanded)) setExpanded(null);
			}, [expanded, filteredEntries]);
			const retry = () => {
				setState({ status: "loading" });
				setRequest((value) => value + 1);
			};
			/**
			* Send a toggle request to the host route, which rewrites the profile's
			* cordis.patch.yml. The running Loader does not hot-apply it (HMR is
			* disabled), so the change is marked pending until the next restart.
			*/
			const toggle = (entry) => {
				if (busy[entry.entryId] === true) return;
				const desired = pending[entry.entryId] !== void 0 ? pending[entry.entryId] : entry.enabled;
				const next = !desired;
				setBusy((b) => ({ ...b, [entry.entryId]: true }));
				setNotice(null);
				fetch("/plugin-explainer/toggle", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ entryId: entry.entryId, moduleName: entry.moduleName, enabled: next })
				}).then((response) => response.json()).then((data) => {
					if (!data.ok) throw new Error((data.error && data.error.message) || t("toggleError"));
					setPending((p) => ({ ...p, [entry.entryId]: next }));
				}).catch((error) => {
					setPending((p) => {
						const n = { ...p };
						delete n[entry.entryId];
						return n;
					});
					setNotice(t("toggleError") + "：" + (error && error.message ? error.message : String(error)));
				}).finally(() => {
					setBusy((b) => {
						const n = { ...b };
						delete n[entry.entryId];
						return n;
					});
				});
			};
			const refresh = () => {
				setState({ status: "loading" });
				setRequest((value) => value + 1);
			};
			const enabledCount = state.status === "ready" ? state.snapshot.entries.filter((entry) => entry.enabled).length : 0;
			const explainedCount = state.status === "ready" ? state.snapshot.entries.filter((entry) => explainOf(entry.moduleName) !== void 0).length : 0;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "pEx_section",
				"aria-busy": state.status === "loading",
				children: [
					state.status === "loading" ? (0, react_jsx_runtime.jsx)("p", {
						className: "pEx_status",
						children: t("loading")
					}) : null,
					state.status === "error" ? (0, react_jsx_runtime.jsxs)("div", {
						className: "pEx_failure",
						children: [(0, react_jsx_runtime.jsx)("p", {
							role: "alert",
							children: t("error")
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: retry,
							children: t("retry")
						})]
					}) : null,
					state.status === "ready" ? (0, react_jsx_runtime.jsxs)("div", {
						className: "pEx_catalog",
						children: [
							(0, react_jsx_runtime.jsxs)("label", {
								className: "pEx_search",
								children: [
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { "aria-hidden": "true" }),
									(0, react_jsx_runtime.jsx)("span", {
										className: "pEx_visuallyHidden",
										children: t("search")
									}),
									(0, react_jsx_runtime.jsx)("input", {
										type: "search",
										value: query,
										placeholder: t("search"),
										"aria-label": t("search"),
										onChange: (event) => {
											setQuery(event.currentTarget.value);
										}
									})
								]
							}),
							Object.keys(pending).length > 0 || notice !== null ? (0, react_jsx_runtime.jsx)("div", {
								className: "pEx_notice",
								children: notice !== null ? notice : t("pendingNotice", { count: Object.keys(pending).length })
							}) : null,
							(0, react_jsx_runtime.jsx)("div", {
								className: "pEx_summary",
								children: t("summary", {
									total: state.snapshot.entries.length,
									enabled: enabledCount,
									disabled: state.snapshot.entries.length - enabledCount,
									explained: explainedCount
								})
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "pEx_heading",
								children: [(0, react_jsx_runtime.jsx)("h3", { children: t("catalog") }), (0, react_jsx_runtime.jsx)("span", {
									"data-plugin-count": filteredEntries.length,
									children: filteredEntries.length
								}), (0, react_jsx_runtime.jsx)("button", {
									className: "pEx_refresh",
									type: "button",
									onClick: refresh,
									children: t("refresh")
								})]
							}),
							state.snapshot.entries.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
								className: "pEx_status",
								children: t("empty")
							}) : null,
							state.snapshot.entries.length > 0 && filteredEntries.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
								className: "pEx_status",
								children: t("emptySearch")
							}) : null,
							filteredEntries.length > 0 ? (0, react_jsx_runtime.jsx)("ul", {
								className: "pEx_cards",
								children: filteredEntries.map((entry) => {
									const status = phaseLabel(entry.fiberPhase, t);
									const title = moduleShortName(entry.moduleName);
									const configuration = t(entry.enabled ? "enabledTag" : "disabledTag");
									const explanation = explainOf(entry.moduleName);
									const isProtected = PROTECTED_IDS.has(entry.entryId);
									const effectiveEnabled = pending[entry.entryId] !== void 0 ? pending[entry.entryId] : entry.enabled;
									const open = expanded === entry.entryId;
									const detailId = catalogId + "-details-" + encodeURIComponent(entry.entryId);
									return (0, react_jsx_runtime.jsxs)("li", {
										className: "pEx_card",
										"data-plugin-entry": entry.entryId,
										"data-open": open ? "true" : void 0,
										children: [
											(0, react_jsx_runtime.jsxs)("div", {
												className: "pEx_cardHeader",
												children: [
													(0, react_jsx_runtime.jsxs)("button", {
														className: "pEx_expand",
														type: "button",
														"aria-expanded": open,
														"aria-controls": detailId,
														"aria-label": entry.enabled ? title + ", " + status + ", " + configuration : title + ", " + configuration,
														onClick: () => {
															setExpanded((current) => current === entry.entryId ? null : entry.entryId);
														},
														children: [
															(0, react_jsx_runtime.jsx)("strong", {
																className: "pEx_cardTitle",
																title: entry.moduleName,
																children: title
															}),
															(0, react_jsx_runtime.jsxs)("span", {
																className: "pEx_cardTrailing",
																children: [
																	entry.enabled ? (0, react_jsx_runtime.jsx)("span", {
																		className: "pEx_statusDot",
																		"data-phase": entry.fiberPhase ?? "unobserved",
																		role: "img",
																		"aria-label": status,
																		title: status
																	}) : null,
																	(0, react_jsx_runtime.jsx)("span", {
																		className: "pEx_tag",
																		"data-enabled": entry.enabled ? "true" : "false",
																		children: configuration
																	}),
																	pending[entry.entryId] !== void 0 ? (0, react_jsx_runtime.jsx)("span", {
																		className: "pEx_pendingTag",
																		children: t("pending")
																	}) : null,
																	(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {
																		className: "pEx_chevron",
																		size: 12,
																		"aria-hidden": "true"
																	})
																]
															})
														]
													}),
													(0, react_jsx_runtime.jsx)("button", {
														className: "pEx_switch",
														type: "button",
														role: "switch",
														"aria-checked": effectiveEnabled ? "true" : "false",
														"aria-label": t(isProtected ? "protected" : effectiveEnabled ? "toggleOff" : "toggleOn"),
														title: isProtected ? t("protected") : t("switchHint"),
														disabled: isProtected || busy[entry.entryId] === true,
														onClick: (event) => {
															event.stopPropagation();
															toggle(entry);
														},
														children: (0, react_jsx_runtime.jsx)("span", {
															className: "pEx_switchKnob",
															"aria-hidden": "true"
														})
													})
												]
											}),
											(0, react_jsx_runtime.jsx)("div", {
												className: "pEx_explain",
												children: (0, react_jsx_runtime.jsx)("p", {
													className: "pEx_explainText" + (explanation === void 0 ? " pEx_unexplained" : ""),
													children: explanation === void 0 ? t("noExplain") : explanation
												})
											}),
											open ? (0, react_jsx_runtime.jsxs)("div", {
												className: "pEx_cardDetails",
												id: detailId,
												children: [
													(0, react_jsx_runtime.jsx)("code", {
														className: "pEx_entryValue",
														"data-loader-entry": true,
														children: entry.entryId
													}),
													(0, react_jsx_runtime.jsxs)("dl", {
														className: "pEx_details",
														children: [
															(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("module") }), (0, react_jsx_runtime.jsx)("dd", { children: entry.moduleName })] }),
															(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("configuration") }), (0, react_jsx_runtime.jsx)("dd", { children: configuration })] }),
															entry.enabled ? (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("cordis") }), (0, react_jsx_runtime.jsx)("dd", { children: status })] }) : null
														]
													})
												]
											}) : null
										]
									}, entry.entryId);
								})
							}) : null
						]
					}) : null
				]
			});
		}
		//#endregion
		//#region locales
		const zh = {
			tab: "插件说明",
			loading: "正在读取插件…",
			error: "暂时无法读取插件。",
			retry: "重试",
			search: "搜索插件",
			catalog: "全部插件",
			empty: "暂无插件。",
			emptySearch: "没有匹配的插件。",
			enabledTag: "已启用",
			disabledTag: "已停用",
			configuration: "配置状态",
			cordis: "Cordis 状态",
			module: "完整包名",
			unobserved: "未挂载",
			pending: "等待依赖",
			loadingPhase: "加载中",
			active: "已挂载",
			failed: "挂载失败",
			unloading: "卸载中",
			noExplain: "（暂无收录说明：可在 dictionary.json 中补充）",
			toggleOn: "启用此插件",
			toggleOff: "停用此插件",
			switchHint: "开关插件（重启 dsh 后生效）",
			protected: "核心组件，不可停用",
			pending: "待重启生效",
			pendingNotice: "有 {count} 项更改已写入配置，重启 dsh 后生效",
			toggleError: "切换失败",
			refresh: "刷新",
			summary: "共 {total} 个插件：{enabled} 个启用 · {disabled} 个停用 · 已收录说明 {explained} 个"
		};
		const en = {
			tab: "Plugin explainer",
			loading: "Reading plugins…",
			error: "Plugins are temporarily unavailable.",
			retry: "Retry",
			search: "Search plugins",
			catalog: "All plugins",
			empty: "No plugins are available.",
			emptySearch: "No matching plugins.",
			enabledTag: "Enabled",
			disabledTag: "Disabled",
			configuration: "Configuration",
			cordis: "Cordis status",
			module: "Package",
			unobserved: "Not mounted",
			pending: "Waiting for dependencies",
			loadingPhase: "Loading",
			active: "Mounted",
			failed: "Mount failed",
			unloading: "Unloading",
			noExplain: "(No explanation yet: add one in dictionary.json)",
			toggleOn: "Enable this plugin",
			toggleOff: "Disable this plugin",
			switchHint: "Toggle plugin (takes effect after dsh restart)",
			protected: "Core component, cannot be disabled",
			pending: "Pending restart",
			pendingNotice: "{count} change(s) written; effective after dsh restart",
			toggleError: "Toggle failed",
			refresh: "Refresh",
			summary: "{total} plugins: {enabled} enabled, {disabled} disabled, {explained} explained"
		};
		//#endregion
		//#region entry
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.pluginExplainer";
		/** Services required by the Settings registration and generated Remote face. */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.pluginInventory"
		];
		/** Contribute the explained tab to the Plugins settings section. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-plugin-explainer: dictionaries");
			const t = ctx.locale.bind(NS);
			const list = async () => {
				const result = await ctx.remote.pluginInventory.list();
				if (!result.ok) throw new Error("pluginInventory.list failed: " + result.error.code + ": " + result.error.message);
				return result.value;
			};
			const injected = () => ({ list });
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: "explained",
				order: 20,
				label: () => t("tab"),
				locale: NS,
				inject: injected
			}, ExplainedPluginTab));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
