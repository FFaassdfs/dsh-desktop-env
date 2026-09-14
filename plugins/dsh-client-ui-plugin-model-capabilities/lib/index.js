// Host half of dsh-client-ui-plugin-model-capabilities: the ONLY browser
// capability source. The browser cannot read the Host LLM registry, and the
// official model catalog (buildModelCatalog) deliberately drops each model's
// `inputModalities` — so this route re-reads every provider/model through
// ctx.llm and returns the capability picture the "模型能力" settings section
// renders in the Web GUI.
//
// Route: POST /plugin-model-capabilities/list  (body optional, `{}`)
//   -> { ok:true, groups:[{ id, name, models:[{ id, name, description?,
//        inputModalities?, contextWindow?, reasoning? }] }],
//        failures:[{ id, name, message }] }
//
// Security posture: a localhost read-only view of the live model registry.
// It performs no mutation of settings, credentials, or the LLM registry.

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
 * Read one model's capability row. A per-model resolution failure does NOT
 * fail the whole provider: the model is listed with its catalog name and an
 * `error` string so the UI can explain it inline.
 * @param ctx - Host context (must expose `ctx.llm`).
 * @param providerId - owning provider route.
 * @param model - the catalog model entry (`{id, name, ...}`).
 * @returns a detached capability row.
 */
async function rowOf(ctx, providerId, model) {
	try {
		const resolved = await ctx.llm.resolveModelInfo(providerId, model.id);
		return {
			id: model.id,
			name: model.name,
			...(resolved.description === void 0 ? {} : { description: resolved.description }),
			...(resolved.inputModalities === void 0
				? {}
				: { inputModalities: [...resolved.inputModalities] }),
			...(resolved.context === void 0 ? {} : { contextWindow: resolved.context.contextWindow }),
			...(resolved.reasoning === void 0
				? {}
				: {
					reasoning: {
						efforts: resolved.reasoning.efforts.map((effort) => ({ id: effort.id, name: effort.name })),
						...(resolved.reasoning.defaultEffort === void 0 ? {} : { defaultEffort: resolved.reasoning.defaultEffort })
					}
				})
		};
	} catch (error) {
		return { id: model.id, name: model.name, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Build the full capability picture across every registered provider.
 * Providers whose whole catalog lookup fails are reported as failures; a
 * provider that resolves but lists no models yields an empty group (the client
 * decides how to present it).
 * @param ctx - Host context (must expose `ctx.llm`).
 * @returns `{ groups, failures }`.
 */
async function buildCapabilities(ctx) {
	const llm = ctx.llm;
	if (llm === void 0 || typeof llm.listProviders !== "function") {
		throw new Error("ctx.llm is unavailable — the LLM registry is not mounted");
	}
	const providers = llm.listProviders();
	const groups = [];
	const failures = [];
	for (const provider of providers) {
		try {
			const models = await llm.listModels(provider.id);
			const entries = [];
			for (const model of models) {
				// Cap runaway catalogs so the UI stays responsive.
				if (entries.length >= 1000) break;
				entries.push(await rowOf(ctx, provider.id, model));
			}
			groups.push({ id: provider.id, name: provider.name, models: entries });
		} catch (error) {
			failures.push({ id: provider.id, name: provider.name, message: error instanceof Error ? error.message : String(error) });
		}
	}
	return { groups, failures };
}

async function handleList(ctx, req, res) {
	try {
		const raw = await readBody(req);
		if (raw.trim() !== "") JSON.parse(raw); // validate only; filter ignored for now
		const { groups, failures } = await buildCapabilities(ctx);
		return send(res, 200, { ok: true, groups, failures });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return send(res, 500, { ok: false, error: { code: "internal", message } });
	}
}

const inject = ["webServer", "llm"];

function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/plugin-model-capabilities/list",
		handler: (req, res) => handleList(ctx, req, res)
	}), "model-capabilities: list route");
}

export { apply, inject, buildCapabilities, handleList, rowOf };
