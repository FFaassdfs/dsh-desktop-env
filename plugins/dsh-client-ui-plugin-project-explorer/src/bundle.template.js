// Client bundle for dsh-client-ui-plugin-project-explorer.
// Built from this template by build.mjs (injects config.json at the CONFIG
// placeholder below).
//
// What it does:
//  - Mounts a fixed right-side panel showing the current project folder (the
//    current session's cwd, falling back to the dsh server launch dir) as a
//    lazily-loaded directory tree (listings come from the host routes).
//  - Rows are draggable with a custom MIME carrying {path}; a document-level
//    drop handler inserts the path (relative to the session cwd, forward
//    slashes) into the composer draft at the end, so the user can keep typing
//    and send — the agent then reads the file with its own tools.
//  - The composer's own drop handling only reacts to dataTransfer "Files", so
//    the two coexist without interference.
window.__ModuleLoader__.load({
	id: "dsh-client-ui-plugin-project-explorer",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let react_dom_client = require("react-dom/client");
		//#region css
		const css = `
.dshPe_root{position:fixed;top:0;right:0;bottom:0;z-index:2147483000;display:flex;align-items:stretch;font-size:12px;line-height:18px}
.dshPe_root[data-collapsed="true"]{width:26px}
.dshPe_tab{box-sizing:border-box;width:26px;border:none;border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font:inherit;padding:0}
.dshPe_tab:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshPe_tabIcon{font-size:14px}
.dshPe_tabLabel{writing-mode:vertical-rl;font-size:11px;color:var(--dsw-alias-label-tertiary);letter-spacing:2px}
.dshPe_panel{box-sizing:border-box;width:300px;min-width:0;background:var(--dsw-alias-bg-layer-1);border-left:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;min-height:0}
.dshPe_header{flex:none;display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dshPe_titleWrap{min-width:0;flex:1}
.dshPe_title{display:block;color:var(--dsw-alias-label-primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshPe_via{display:block;color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshPe_actions{flex:none;display:flex;gap:2px}
.dshPe_iconBtn{width:24px;height:24px;border:none;background:0 0;border-radius:6px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;line-height:1;display:inline-flex;align-items:center;justify-content:center}
.dshPe_iconBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshPe_tree{flex:1;min-height:0;overflow:auto;padding:4px 0}
.dshPe_row{display:flex;align-items:center;gap:4px;padding:3px 8px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none;white-space:nowrap}
.dshPe_row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshPe_row.dshPe_rowDir{color:var(--dsw-alias-label-primary)}
.dshPe_arrow{flex:none;width:12px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:10px}
.dshPe_name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis}
.dshPe_size{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;padding-left:6px}
.dshPe_hint{color:var(--dsw-alias-label-tertiary);padding:3px 8px;font-size:12px}
.dshPe_error{color:var(--dsw-alias-state-error-primary);padding:3px 8px;font-size:12px;word-break:break-all}
.dshPe_footer{flex:none;padding:6px 10px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font-size:11px}
.dshPe_notice{position:absolute;left:8px;right:8px;bottom:34px;box-sizing:border-box;padding:6px 10px;border-radius:8px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l1);box-shadow:var(--dsw-shadow-lv2);color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;word-break:break-all;z-index:1}
.dshPe_noticeError{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}
body.dshPe_dragActive::after{content:"";position:fixed;inset:0;z-index:2147483647;pointer-events:none;border:2px dashed var(--dsw-alias-state-business-primary);opacity:.85}
`;
		const tagId = "dsh-client-ui-plugin-project-explorer/main.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-client-ui-plugin-project-explorer";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region config
		const CONFIG = /*__CONFIG_JSON__*/;
		//#endregion
		//#region helpers
		/** Drag payload MIME + drag-active body class. */
		const MIME = CONFIG.dndMime;
		const DRAG_ACTIVE_CLASS = CONFIG.dragActiveClass;
		/** Module-level state shared between the panel and the document drop handler. */
		const shared = { root: null, notify: function () {} };
		/** POST JSON to one of our host routes. */
		function request(path, body) {
			return fetch(path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body)
			}).then((response) => response.json());
		}
		/** Current session's cwd (the project root the tree follows), or undefined. */
		function currentSessionCwd(sessions) {
			try {
				const snap = sessions && sessions.list ? sessions.list.getSnapshot() : null;
				const id = snap && snap.current;
				if (id && snap.byId && snap.byId[id]) return snap.byId[id].cwd;
			} catch {}
			return void 0;
		}
		/** Path relative to the project root (forward slashes); absolute if outside. */
		function toRelative(rootPath, filePath) {
			const norm = (value) => String(value || "").replace(/\\/g, "/");
			const r = norm(rootPath).replace(/\/+$/, "");
			const f = norm(filePath).replace(/\/+$/, "");
			if (r === "" || f === "") return f || r;
			if (f.toLowerCase() === r.toLowerCase()) return ".";
			if (f.toLowerCase().startsWith(r.toLowerCase() + "/")) return f.slice(r.length + 1);
			return f;
		}
		/** Safe service access — services may be absent before runtime apply finishes. */
		function safeGet(ctx, name) {
			try {
				return typeof ctx.get === "function" ? ctx.get(name) : void 0;
			} catch {
				return void 0;
			}
		}
		function formatSize(bytes) {
			if (bytes < 1024) return bytes + " B";
			if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
			if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
			return (bytes / 1073741824).toFixed(1) + " GB";
		}
		function restoreCaretAtEnd() {
			setTimeout(() => {
				const ta = document.querySelector("textarea[data-phase]");
				if (ta === null) return;
				ta.focus();
				const len = ta.value.length;
				ta.setSelectionRange(len, len);
			}, 0);
		}
		//#endregion
		//#region locale
		const NS = "projectExplorer";
		const zh = {
			"panel.expand": "展开项目文件面板",
			"panel.collapse": "收起面板",
			"panel.refresh": "刷新目录",
			"panel.openFolder": "在资源管理器中打开项目文件夹",
			"panel.openFailed": "打开文件夹失败",
			"panel.fallback": "（启动目录）",
			"root.pending": "正在解析项目目录…",
			"root.error": "无法解析项目目录",
			"tree.loading": "加载中…",
			"tree.empty": "（空目录）",
			"tree.truncated": "（条目过多，已截断显示）",
			"tree.error": "加载失败：{message}",
			"footer.hint": "拖拽文件到对话框，插入路径后可直接发送",
			"drop.done": "已插入：{path}",
			"drop.noSession": "请先打开一个会话，再拖入文件",
			"drop.noComposer": "未找到输入框",
			"drop.unsupported": "无法读取拖放数据"
		};
		const en = {
			"panel.expand": "Expand project file panel",
			"panel.collapse": "Collapse panel",
			"panel.refresh": "Refresh",
			"panel.openFolder": "Open the project folder in File Explorer",
			"panel.openFailed": "Failed to open folder",
			"panel.fallback": "(launch dir)",
			"root.pending": "Resolving project directory…",
			"root.error": "Could not resolve project directory",
			"tree.loading": "Loading…",
			"tree.empty": "(empty)",
			"tree.truncated": "(truncated: too many entries)",
			"tree.error": "Load failed: {message}",
			"footer.hint": "Drag files into the chat to insert their path, then send",
			"drop.done": "Inserted: {path}",
			"drop.noSession": "Open a session first, then drag a file in",
			"drop.noComposer": "Composer input not found",
			"drop.unsupported": "Could not read drag data"
		};
		//#endregion
		//#region component
		/** One tree row; directories expand lazily. `expanded` is the Set of
		* expanded directory paths (never a boolean). */
		function TreeRow({ node, depth, expanded, tree, t, onToggle, onRowDragStart }) {
			const isDir = node.kind === "dir";
			const isExpanded = isDir && typeof expanded.has === "function" ? expanded.has(node.path) : !!expanded;
			const entry = tree[node.path];
			const loading = entry !== void 0 && entry.status === "loading";
			const failed = entry !== void 0 && entry.status === "error";
			const ready = entry !== void 0 && entry.status === "ready";
			const list = ready && Array.isArray(entry.entries) ? entry.entries : [];
			const indent = { paddingLeft: 8 + depth * 14 };
			const row = react.createElement("div", {
				key: "r",
				className: "dshPe_row" + (isDir ? " dshPe_rowDir" : ""),
				style: indent,
				draggable: true,
				onDragStart: (event) => onRowDragStart(event, node),
				onClick: isDir ? () => onToggle(node.path) : void 0,
				title: node.path
			}, [
				react.createElement("span", { className: "dshPe_arrow", key: "a" }, isDir ? (isExpanded ? "▾" : "▸") : ""),
				react.createElement("span", { className: "dshPe_name", key: "n" }, node.name),
				!isDir ? react.createElement("span", { className: "dshPe_size", key: "s" }, formatSize(node.size)) : null
			]);
			if (!isDir || !isExpanded) return row;
			let children = [];
			if (loading) {
				children.push(react.createElement("div", { className: "dshPe_hint", style: { paddingLeft: 22 + depth * 14 }, key: "l" }, t("tree.loading")));
			} else if (failed) {
				children.push(react.createElement("div", { className: "dshPe_error", style: { paddingLeft: 22 + depth * 14 }, key: "e" }, t("tree.error", { message: entry.error || "" })));
			} else if (ready) {
				if (list.length === 0) {
					children.push(react.createElement("div", { className: "dshPe_hint", style: { paddingLeft: 22 + depth * 14 }, key: "m" }, t("tree.empty")));
				} else {
					for (const child of list) {
						children.push(react.createElement(TreeRow, {
							key: child.path,
							node: child,
							depth: depth + 1,
							expanded,
							tree,
							t,
							onToggle,
							onRowDragStart
						}));
					}
				}
				if (entry.truncated) {
					children.push(react.createElement("div", { className: "dshPe_hint", style: { paddingLeft: 22 + depth * 14 }, key: "t" }, t("tree.truncated")));
				}
			}
			return react.createElement("div", null, [row, react.createElement("div", { key: "c" }, children)]);
		}
		/** The fixed right-side panel. */
		function ProjectExplorerPanel({ ctx, t }) {
			const [root, setRoot] = react.useState(null);
			const [rootError, setRootError] = react.useState(false);
			const [tree, setTree] = react.useState({});
			const [expanded, setExpanded] = react.useState(function () { return new Set(); });
			const [collapsed, setCollapsed] = react.useState(function () {
				try {
					return typeof localStorage === "undefined" ? false : localStorage.getItem("dsh.projectExplorer.collapsed") === "1";
				} catch {
					return false;
				}
			});
			const [notice, setNotice] = react.useState(null);
			const lastCwdRef = react.useRef(void 0);
			const sessions = safeGet(ctx, "sessions");
			const loadDir = react.useCallback((dirPath) => {
				setTree((prev) => ({ ...prev, [dirPath]: { status: "loading", entries: [], truncated: false, error: null } }));
				request("/plugin-project-explorer/list", { sessionCwd: lastCwdRef.current, path: dirPath }).then((data) => {
					if (!data.ok) throw new Error((data.error && data.error.message) || "list failed");
					setTree((prev) => ({ ...prev, [dirPath]: { status: "ready", entries: data.entries || [], truncated: !!data.truncated, error: null } }));
				}).catch((error) => {
					setTree((prev) => ({ ...prev, [dirPath]: { status: "error", entries: [], truncated: false, error: error && error.message ? error.message : String(error) } }));
				});
			}, []);
			const refreshRoot = react.useCallback(() => {
				const cwd = currentSessionCwd(sessions);
				lastCwdRef.current = cwd;
				setRootError(false);
				request("/plugin-project-explorer/root", { sessionCwd: cwd }).then((data) => {
					if (!data.ok) {
						setRootError(true);
						return;
					}
					const path = data.root;
					setRoot({ path, name: data.rootName, via: data.resolvedVia });
					setTree({});
					setExpanded(new Set([path]));
					loadDir(path);
				}).catch(() => {
					setRootError(true);
				});
			}, [sessions, loadDir]);
			react.useEffect(() => {
				refreshRoot();
				const unsub = sessions && typeof sessions.list === "object" && typeof sessions.list.subscribe === "function"
					? sessions.list.subscribe(() => {
						const cwd = currentSessionCwd(sessions);
						if (cwd !== lastCwdRef.current) refreshRoot();
					})
					: null;
				return () => {
					if (unsub !== null) {
						try { unsub(); } catch {}
					}
				};
			}, [refreshRoot, sessions]);
			react.useEffect(() => {
				shared.root = root ? root.path : null;
			}, [root]);
			react.useEffect(() => {
				shared.notify = (text, kind) => setNotice({ text, kind: kind || "info" });
				return () => { shared.notify = function () {}; };
			}, []);
			react.useEffect(() => {
				if (notice === null) return;
				const id = setTimeout(() => setNotice(null), 3500);
				return () => clearTimeout(id);
			}, [notice]);
			const toggleCollapsed = () => {
				const next = !collapsed;
				setCollapsed(next);
				try {
					localStorage.setItem("dsh.projectExplorer.collapsed", next ? "1" : "0");
				} catch {}
			};
			const toggleDir = (dirPath) => {
				const willExpand = !expanded.has(dirPath);
				setExpanded((prev) => {
					const next = new Set(prev);
					if (willExpand) next.add(dirPath);
					else next.delete(dirPath);
					return next;
				});
				if (willExpand) {
					const entry = tree[dirPath];
					if (entry === void 0 || entry.status !== "ready") loadDir(dirPath);
				}
			};
			const onRowDragStart = (event, node) => {
				const rel = toRelative(root ? root.path : "", node.path);
				try {
					event.dataTransfer.setData(MIME, JSON.stringify({ path: node.path }));
					event.dataTransfer.setData("text/plain", rel);
					event.dataTransfer.effectAllowed = "copy";
				} catch {}
			};
			/** Ask the host to open the current project root in the OS file manager. */
			const onOpenFolder = () => {
				if (root === null) return;
				request("/plugin-project-explorer/open", { sessionCwd: lastCwdRef.current, path: root.path }).then((data) => {
					if (!data.ok) throw new Error((data.error && data.error.message) || "open failed");
				}).catch((error) => {
					setNotice({ text: t("panel.openFailed") + "：" + (error && error.message ? error.message : String(error)), kind: "error" });
				});
			};
			if (collapsed) {
				return react.createElement("div", { className: "dshPe_root", "data-collapsed": "true" },
					react.createElement("button", {
						className: "dshPe_tab",
						type: "button",
						onClick: toggleCollapsed,
						title: t("panel.expand"),
						"aria-label": t("panel.expand")
					}, [
						react.createElement("span", { className: "dshPe_tabIcon", key: "i" }, "📁"),
						react.createElement("span", { className: "dshPe_tabLabel", key: "l" }, "项目文件")
					]));
			}
			const header = react.createElement("div", { className: "dshPe_header", key: "h" }, [
				react.createElement("div", { className: "dshPe_titleWrap", key: "t" }, [
					react.createElement("span", { className: "dshPe_title", key: "n", title: root ? root.path : "" }, root ? root.name : t("root.pending")),
					react.createElement("span", { className: "dshPe_via", key: "v" }, root && root.via === "fallback" ? t("panel.fallback") : "")
				]),
				react.createElement("div", { className: "dshPe_actions", key: "a" }, [
					react.createElement("button", { className: "dshPe_iconBtn", type: "button", key: "o", onClick: onOpenFolder, title: t("panel.openFolder"), "aria-label": t("panel.openFolder") }, "📂"),
					react.createElement("button", { className: "dshPe_iconBtn", type: "button", key: "r", onClick: refreshRoot, title: t("panel.refresh") }, "⟳"),
					react.createElement("button", { className: "dshPe_iconBtn", type: "button", key: "c", onClick: toggleCollapsed, title: t("panel.collapse") }, "»")
				])
			]);
			let body;
			if (root === null) {
				body = react.createElement("div", { className: "dshPe_hint" }, rootError ? t("root.error") : t("root.pending"));
			} else {
				const rootEntry = tree[root.path];
				const loadingRoot = rootEntry === void 0 || rootEntry.status === "loading";
				const failedRoot = rootEntry !== void 0 && rootEntry.status === "error";
				const rootList = rootEntry !== void 0 && Array.isArray(rootEntry.entries) ? rootEntry.entries : [];
				const rows = [];
				if (loadingRoot) {
					rows.push(react.createElement("div", { className: "dshPe_hint", key: "l" }, t("tree.loading")));
				} else if (failedRoot) {
					rows.push(react.createElement("div", { className: "dshPe_error", key: "e" }, t("tree.error", { message: rootEntry.error || "" })));
				} else {
					if (rootList.length === 0) {
						rows.push(react.createElement("div", { className: "dshPe_hint", key: "m" }, t("tree.empty")));
					} else {
						for (const child of rootList) {
							rows.push(react.createElement(TreeRow, {
								key: child.path,
								node: child,
								depth: 0,
								expanded,
								tree,
								t,
								onToggle: toggleDir,
								onRowDragStart
							}));
						}
					}
					if (rootEntry.truncated) rows.push(react.createElement("div", { className: "dshPe_hint", key: "t" }, t("tree.truncated")));
				}
				body = react.createElement("div", null, rows);
			}
			return react.createElement("div", { className: "dshPe_root", "data-collapsed": "false" },
				react.createElement("div", { className: "dshPe_panel" }, [
					header,
					react.createElement("div", { className: "dshPe_tree", key: "tree" }, body),
					react.createElement("div", { className: "dshPe_footer", key: "f" }, t("footer.hint")),
					notice !== null ? react.createElement("div", { className: "dshPe_notice" + (notice.kind === "error" ? " dshPe_noticeError" : ""), key: "n" }, notice.text) : null
				]));
		}
		//#endregion
		//#region drop handling
		function hasDragPayload(event) {
			return event.dataTransfer !== null && Array.prototype.indexOf.call(event.dataTransfer.types || [], MIME) !== -1;
		}
		/** Insert the dragged path into the current session's composer draft. */
		function insertPath(ctx, event) {
			let payload = null;
			try {
				payload = JSON.parse(event.dataTransfer.getData(MIME) || "null");
			} catch {
				shared.notify("drop.unsupported", "error");
				return;
			}
			if (payload === null || typeof payload.path !== "string") return;
			const sessions = safeGet(ctx, "sessions");
			const conversation = safeGet(ctx, "conversation");
			const snap = sessions && sessions.list ? sessions.list.getSnapshot() : null;
			const sessionId = snap && snap.current;
			if (typeof sessionId !== "string") {
				shared.notify("drop.noSession", "error");
				return;
			}
			const rel = toRelative(shared.root, payload.path);
			const line = rel === "" ? payload.path : rel;
			let inserted = false;
			try {
				const shell = conversation && conversation.input ? conversation.input.shell(sessionId) : void 0;
				if (shell !== void 0 && typeof shell.setDraft === "function") {
					const draft = shell.snapshot && shell.snapshot.draft ? shell.snapshot.draft : "";
					const next = draft === "" ? line : draft.replace(/\s+$/, "") + "\n" + line;
					shell.setDraft(next);
					restoreCaretAtEnd();
					inserted = true;
				}
			} catch {}
			if (!inserted) {
				const ta = document.querySelector("textarea[data-phase]");
				if (ta === null) {
					shared.notify("drop.noComposer", "error");
					return;
				}
				const draft = ta.value;
				const next = draft === "" ? line : draft.replace(/\s+$/, "") + "\n" + line;
				ta.value = next;
				ta.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: line }));
				ta.focus();
				ta.setSelectionRange(next.length, next.length);
			}
			shared.notify("drop.done", "info");
		}
		//#endregion
		//#region entry
		/** Services this bundle declares (ordering + ctx exposure). */
		const inject = [
			"slots",
			"locale",
			"sessions",
			"conversation"
		];
		/**
		* Catches render errors so the panel never vanishes silently: the error
		* text is shown in place, and the console copy carries the stack.
		*/
		class PanelErrorBoundary extends react.Component {
			constructor(props) {
				super(props);
				this.state = { error: null };
			}
			static getDerivedStateFromError(error) {
				return { error };
			}
			componentDidCatch(error) {
				console.error("[project-explorer] panel render error:", error);
			}
			render() {
				if (this.state.error !== null) {
					const message = this.state.error && this.state.error.message ? this.state.error.message : String(this.state.error);
					return react.createElement("div", { className: "dshPe_error", style: { padding: 10 } }, "面板错误：" + message);
				}
				return this.props.children;
			}
		}
		/** Mount the panel and wire document-level drag-and-drop. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "project-explorer: dictionaries");
			const t = ctx.locale.bind(NS);
			if (typeof document === "undefined") return; // SSR / test environments
			const onWindowError = (event) => {
				try {
					const file = event && event.filename ? String(event.filename) : "";
					if (!file.includes("project-explorer")) return;
					shared.notify("错误: " + (event.message || "unknown error"), "error");
				} catch {}
			};
			ctx.effect(() => {
				window.addEventListener("error", onWindowError);
				return () => window.removeEventListener("error", onWindowError);
			}, "project-explorer: window error capture");
			const host = document.createElement("div");
			host.id = "dsh-project-explorer-root";
			document.body.appendChild(host);
			const domRoot = react_dom_client.createRoot(host);
			ctx.effect(() => {
				domRoot.render(react.createElement(PanelErrorBoundary, null, react.createElement(ProjectExplorerPanel, { ctx, t })));
				return () => {
					try { domRoot.unmount(); } catch {}
					host.remove();
				};
			}, "project-explorer: panel render");
			const onDragOver = (event) => {
				if (!hasDragPayload(event)) return;
				event.preventDefault();
				if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "copy";
				document.body.classList.add(DRAG_ACTIVE_CLASS);
			};
			const onDragLeave = (event) => {
				if (!hasDragPayload(event)) return;
				if (event.relatedTarget === null) document.body.classList.remove(DRAG_ACTIVE_CLASS);
			};
			const onDrop = (event) => {
				if (!hasDragPayload(event)) return;
				event.preventDefault();
				event.stopPropagation();
				document.body.classList.remove(DRAG_ACTIVE_CLASS);
				insertPath(ctx, event);
			};
			const onDragEnd = () => {
				document.body.classList.remove(DRAG_ACTIVE_CLASS);
			};
			ctx.effect(() => {
				document.addEventListener("dragover", onDragOver);
				document.addEventListener("dragleave", onDragLeave);
				document.addEventListener("drop", onDrop);
				window.addEventListener("dragend", onDragEnd);
				return () => {
					document.removeEventListener("dragover", onDragOver);
					document.removeEventListener("dragleave", onDragLeave);
					document.removeEventListener("drop", onDrop);
					window.removeEventListener("dragend", onDragEnd);
					document.body.classList.remove(DRAG_ACTIVE_CLASS);
				};
			}, "project-explorer: document dnd");
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.toRelative = toRelative;
		exports.ProjectExplorerPanel = ProjectExplorerPanel;
		exports.TreeRow = TreeRow;
		return module.exports;
	}
});
