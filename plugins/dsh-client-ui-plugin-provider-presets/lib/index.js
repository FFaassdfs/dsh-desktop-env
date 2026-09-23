// Host half of dsh-client-ui-plugin-provider-presets.
//
// This plugin's data path runs entirely over OFFICIAL Remote namespaces, so the
// host half carries no business logic and registers no HTTP route:
//
//   * reading the llm-pi-ai section and writing a route profile uses
//     `remote.settings.describe` / `remote.settings.mutate`;
//   * storing an API key uses `remote.credentials.set`, the same write-only seam
//     the official Models page uses — the browser never reads a value back.
//
// It exists because the client half is only discovered when the host half
// activates: the loader must find a `main` module, and the client registry skips
// any entry whose host fiber is missing.
//
// Deliberately NOT here: any file write of its own. Presets reach the profile
// through the settings seam, so revision fencing, redaction and validation stay
// the harness's job — a second writer would have to reimplement all three.
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
