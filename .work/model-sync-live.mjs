// Live end-to-end check for dsh-client-ui-plugin-model-sync.
//
// Loads the real bundle, pulls the real models.dev catalog, and runs the real
// matching + candidate pipeline against THIS machine's provider profiles. It
// proves the fallback that matters here: vekenllm (a LAN LiteLLM gateway) and
// ctai (a regional relay) are both absent from models.dev, so provider-level
// matching must fail and same-named models must supply the metadata instead.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

function firstExisting(urls) {
	for (const url of urls) if (existsSync(fileURLToPath(url))) return url;
	throw new Error("bundle not found");
}
const bundleUrl = firstExisting([
	new URL("./lib/client.js", import.meta.url),
	new URL("../plugins/dsh-client-ui-plugin-model-sync/lib/client.js", import.meta.url)
]);
let captured = null;
globalThis.window = { __ModuleLoader__: { load: (def) => { captured = def; } } };
await import(bundleUrl.href);
const P = captured.factory((spec) => {
	if (spec === "react") return { useState: () => [void 0, () => {}], useCallback: (fn) => fn, useEffect: () => {} };
	if (spec === "react/jsx-runtime") return { jsx: () => ({}), jsxs: () => ({}) };
	throw new Error("unexpected require: " + spec);
});

// This machine's profiles (from ~/.dsh/settings.yaml) and what their endpoints serve.
const profiles = {
	vekenllm: { baseURL: "http://192.168.100.63:4000/v1", apiKeyEnv: "VEKENLLM_API_KEY" },
	ctai: { baseURL: "https://ai.ctaigw.cn/v1", apiKeyEnv: "CTAI_API_KEY" }
};
// What remote.llm.discoverModels would return for each route (unknown here: the
// gateway needs a key, so ids are taken from the stored settings).
const endpointIds = {
	vekenllm: ["deepseek-v4-flash", "auto"],
	ctai: ["glm-5.3-flash"]
};

console.log("fetching models.dev …");
const catalog = await (await fetch("https://models.dev/api.json")).json();
const providerCount = Object.keys(catalog).length;
const globalIndex = P.flattenCatalog(catalog);
console.log(`models.dev: ${providerCount} providers, ${globalIndex.length} distinct model ids\n`);

for (const [route, profile] of Object.entries(profiles)) {
	const match = P.matchModelsDevProvider(catalog, profile);
	console.log(`── ${route}  (${profile.baseURL})`);
	console.log(`   provider-level match: ${match === void 0 ? "NONE (expected for a self-hosted/relay endpoint)" : match.id + " via " + match.via}`);
	const candidates = P.buildCandidates({
		endpoint: endpointIds[route].map((id) => ({ id, name: id })),
		modelsDev: match === void 0 ? [] : Object.values(match.provider.models ?? {}).map(P.fromModelsDev),
		globalModelsDev: globalIndex,
		openRouter: []
	});
	for (const candidate of candidates) {
		const enriched = candidate.contextWindow !== void 0 || candidate.input !== void 0 || candidate.reasoningEfforts !== void 0;
		const flag = candidate.borrowed === true ? "BORROWED (unselected by default)" : enriched ? "ENRICHED (provider-matched)" : "no metadata found";
		console.log(
			`   ${candidate.id.padEnd(22)} ${flag}` +
			(candidate.contextWindow !== void 0 ? `  ctx=${candidate.contextWindow}` : "") +
			(candidate.maxTokens !== void 0 ? `  out=${candidate.maxTokens}` : "") +
			(candidate.input !== void 0 ? `  input=[${candidate.input.join(",")}]` : "") +
			(candidate.reasoningEfforts !== void 0 ? `  efforts={${Object.keys(candidate.reasoningEfforts).join(",")}}` : "")
		);
	}
	console.log("");
}

// Cross-check: what does models.dev itself say the Alibaba Token Plan serves?
const tp = P.matchModelsDevProvider(catalog, { baseURL: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1" });
console.log(`── alibaba token plan provider-level match: ${tp === void 0 ? "NONE" : tp.id + " via " + tp.via}`);
if (tp !== void 0) {
	const ids = Object.keys(tp.provider.models ?? {});
	console.log(`   ${ids.length} models on models.dev (pi-ai's frozen catalog has 18 for the same endpoint)`);
}
