// Client bundle for dsh-client-ui-plugin-core-version.
// Built from this template by build.mjs (currently a verbatim copy step).
//
// What it does:
//  - Mounts a tiny read-only badge in a fixed top-right corner of the Web GUI
//    showing the running core dsh version. Same proven technique as the
//    project-explorer panel (own fixed container via createRoot, no dependency
//    on official slot semantics).
//  - The badge fetches the version from the host route
//    /plugin-core-version/version once, with gentle retries; renders nothing
//    when it cannot be fetched.
//  - Purely informational: pointer-events:none, never intercepts clicks.
window.__ModuleLoader__.load({
	id: "dsh-client-ui-plugin-core-version",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom_client = require("react-dom/client");

		const ROOT_ID = "dsh-core-version-root";
		const CSS_ID = "dsh-client-ui-plugin-core-version/main.css";
		const VERSION_ROUTE = "/plugin-core-version/version";
		const css = `
.dshVcv_badge{position:fixed;left:12px;bottom:56px;z-index:2147482000;pointer-events:none;user-select:none;box-sizing:border-box;padding:1px 8px;border-radius:999px;background:color-mix(in srgb, var(--dsw-alias-bg-layer-2, #222) 82%, transparent);border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.28));color:var(--dsw-alias-label-tertiary, rgba(160,160,160,.95));font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap;letter-spacing:.2px;font-family:ui-sans-serif,system-ui,"Segoe UI",sans-serif}
`;
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		/** Fetch the core version with a few gentle retries; silently give up. */
		function fetchVersion(onVersion) {
			let attempts = 0;
			const poll = () => {
				fetch(VERSION_ROUTE, { headers: { "accept": "application/json" } })
					.then((resp) => {
						if (!resp.ok) throw new Error("http " + String(resp.status));
						return resp.json();
					})
					.then((data) => {
						if (data && data.ok === true && typeof data.version === "string" && data.version !== "") {
							onVersion(data.version);
							return;
						}
						throw new Error("bad payload");
					})
					.catch(() => {
						attempts += 1;
						if (attempts < 4) setTimeout(poll, 1500);
					});
			};
			poll();
		}

		/** Corner badge component. Renders nothing until the version arrives. */
		function CoreVersionBadge() {
			const [version, setVersion] = react.useState("");
			react.useEffect(() => {
				let cancelled = false;
				fetchVersion((v) => {
					if (!cancelled) setVersion(v);
				});
				return () => {
					cancelled = true;
				};
			}, []);
			if (version === "") return null;
			return react.createElement(
				"div",
				{ className: "dshVcv_badge", title: "DeepSeek Harness 核心版本" },
				"dsh " + version
			);
		}

		/** Mount once (guard against hot-reload double apply); remove on dispose. */
		function apply(ctx) {
			if (typeof document === "undefined") return;
			if (document.getElementById(ROOT_ID) !== null) return;
			const host = document.createElement("div");
			host.id = ROOT_ID;
			document.body.appendChild(host);
			const domRoot = react_dom_client.createRoot(host);
			domRoot.render(react.createElement(CoreVersionBadge));
			if (ctx && typeof ctx.effect === "function") {
				ctx.effect(() => {
					return () => {
						try { domRoot.unmount(); } catch {}
						if (host.parentNode) host.parentNode.removeChild(host);
					};
				}, "core-version: badge render");
			}
		}

		exports.CoreVersionBadge = CoreVersionBadge;
		exports.apply = apply;
		return module.exports;
	}
});
