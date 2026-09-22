// Host half of dsh-client-ui-plugin-model-sync.
//
// This plugin's data path runs entirely over OFFICIAL Remote namespaces, so the
// host half carries no business logic and registers no HTTP route:
//
//   * model metadata (models.dev / OpenRouter) is fetched by the browser itself
//     — both sources answer `access-control-allow-origin: *` (verified);
//   * endpoint interrogation uses `remote.llm.discoverModels`;
//   * reading and writing settings uses `remote.settings.describe/mutate`.
//
// It exists because the client half is only discovered when the host half
// activates: the loader must find a `main` module, and the client registry
// skips any entry whose host fiber is missing. Nothing here touches settings,
// credentials, or the LLM registry.
//
// Route: none. See README.md for the design rationale.

/** No host service is required: every capability this plugin uses is a Remote. */
const inject = [];

/**
 * Activate the host half. Intentionally empty — the declaration is the point.
 * @param ctx - Host context (unused).
 */
function apply(ctx) {
	void ctx;
}

export { apply, inject };
