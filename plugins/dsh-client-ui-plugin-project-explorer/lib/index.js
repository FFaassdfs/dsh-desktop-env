// Host half of dsh-client-ui-plugin-project-explorer: the ONLY filesystem
// access point of the plugin. The browser cannot read the disk, so the right
// panel asks these two routes for the current project root and lazily-loaded
// directory listings. File *content* is deliberately never served — the
// drag-into-composer feature inserts a path (relative to the session cwd),
// and the agent reads the file itself with its own tools.
//
// Routes (all POST, JSON):
//   POST /plugin-project-explorer/root  {sessionCwd?}
//     -> {ok:true, root, rootName, resolvedVia:"session"|"fallback"}
//        root = realpath(sessionCwd) when it exists and is a directory,
//        otherwise realpath(process.cwd()) — the folder the dsh server was
//        launched in (the desktop shell starts it with the project workdir).
//   POST /plugin-project-explorer/list  {sessionCwd?, path}
//     -> {ok:true, root, entries:[{name,path,kind:"dir"|"file",size}], truncated}
//        path is validated to stay inside the resolved root; symlinks are
//        resolved, broken links skipped, ignore lists and caps applied.
//   POST /plugin-project-explorer/open   {sessionCwd?, path}
//     -> {ok:true, opened:path}
//        Opens the path in the OS file manager (Windows Explorer). Directories
//        are opened; files are opened with the file selected (/select). The
//        path must stay inside the resolved root, same check as /list.
//
// Security posture: this is a localhost self-service tool, not a trust
// boundary, but the routes still refuse anything outside the current root so
// the tree the user sees is exactly the tree the agent's tools can read.
import { spawn } from "node:child_process";
import { realpath, readdir, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

// --- policy (edit here; keep in sync with README) ---------------------------
/** Directory names never shown (and never descended into). */
const IGNORE_NAMES = new Set([
	".git", ".svn", ".hg",
	"node_modules", ".cache", ".turbo", ".next", ".nuxt", ".output",
	"dist", "build", "out", "coverage", "target",
	".idea", ".vscode", "__pycache__", ".venv", "venv", ".tox",
	".dsh", ".work", ".DS_Store", "Thumbs.db"
]);
/** File extensions never shown. */
const IGNORE_EXTENSIONS = new Set([".log", ".tmp", ".lock", ".swp", ".bak"]);
/** Cap on entries returned per directory (beyond that: truncated=true). */
const MAX_ENTRIES = 500;
/** Max directory depth under the root (each request must stay shallower). */
const MAX_DEPTH = 40;
/** Max accepted request body (1 MiB) — pure hygiene. */
const MAX_BODY_BYTES = 1 << 20;

// --- tiny http helpers (mirrors dsh-client-ui-plugin-explainer style) -------
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
	for await (const chunk of req) {
		body += chunk;
		if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
			const error = new Error("请求体过大");
			error.status = 413;
			throw error;
		}
	}
	return body;
}

function httpError(status, message) {
	const error = new Error(message);
	error.status = status;
	return error;
}

async function readJson(req) {
	const body = await readBody(req);
	try {
		return JSON.parse(body || "{}");
	} catch {
		throw httpError(400, "请求体不是合法 JSON");
	}
}

// --- root resolution ---------------------------------------------------------
/**
* Whether `p` is a filesystem root ("C:\", "D:\", "/").
*
* Why this matters: when the client cannot name a session the host falls back to
* its own working directory. A dsh server started from a desktop shortcut has
* `process.cwd()` = the drive root, and the panel then rendered the ENTIRE C:
* drive as "the project folder" — a confusing, slow, and misleading tree. A
* drive root is never a useful project root, so it is reported instead.
* @param p - an absolute, already resolved path.
* @returns true when p is a drive/filesystem root.
*/
function isFilesystemRoot(p) {
	const trimmed = p.replace(/[\\/]+$/, "");
	// "C:" (drive relative) / "C:\" both trim to "C:"; POSIX "/" trims to "".
	return trimmed === "" || /^[a-zA-Z]:$/.test(trimmed);
}

async function resolveRoot(sessionCwd) {
	if (typeof sessionCwd === "string" && sessionCwd.trim() !== "") {
		try {
			const rp = await realpath(sessionCwd.trim());
			const st = await stat(rp);
			if (st.isDirectory()) return { root: rp, via: "session" };
		} catch {
			// fall through to the server cwd
		}
	}
	const fallback = await realpath(process.cwd());
	if (isFilesystemRoot(fallback)) {
		const error = httpError(409, "无法确定项目目录：当前会话没有提供工作目录，dsh 服务的启动目录是磁盘根目录（" + fallback + "）");
		error.code = "no-project-root";
		throw error;
	}
	return { root: fallback, via: "fallback" };
}

function rootNameOf(root) {
	const trimmed = root.replace(/[\\/]+$/, "");
	const parts = trimmed.split(/[\\/]/);
	return parts[parts.length - 1] || trimmed;
}

/** Case-insensitive containment (Windows realpath case can vary). */
function isWithin(root, candidate) {
	const r = root.replace(/[\\/]+$/, "").toLowerCase();
	const c = candidate.replace(/[\\/]+$/, "").toLowerCase();
	if (c === r) return true;
	return c.startsWith(r + sep.toLowerCase()) || c.startsWith(r + "/");
}

/** Depth of candidate below root, in path segments. */
function depthOf(root, candidate) {
	const r = root.replace(/[\\/]+$/, "").split(/[\\/]/);
	const c = candidate.replace(/[\\/]+$/, "").split(/[\\/]/);
	let i = 0;
	while (i < r.length && i < c.length && r[i].toLowerCase() === c[i].toLowerCase()) i += 1;
	return c.length - i;
}

function extensionOf(name) {
	const idx = name.lastIndexOf(".");
	return idx > 0 ? name.slice(idx).toLowerCase() : "";
}

// --- handlers ----------------------------------------------------------------
/**
* Map a thrown error to the wire error code for a route response.
* An error may carry its own `code` (e.g. "no-project-root", which the client
* shows as actionable guidance rather than a generic failure).
* @param error - the caught error.
* @param status - the HTTP status that will be sent.
* @returns the error code string.
*/
function errorCodeOf(error, status) {
	if (typeof error.code === "string" && error.code !== "") return error.code;
	if (status === 400) return "bad-request";
	if (status === 403) return "forbidden";
	if (status === 409) return "conflict";
	return "internal";
}

async function handleRoot(req, res) {
	try {
		const payload = await readJson(req);
		const { root, via } = await resolveRoot(payload.sessionCwd);
		send(res, 200, { ok: true, root, rootName: rootNameOf(root), resolvedVia: via });
	} catch (error) {
		const status = error.status || 500;
		send(res, status, { ok: false, error: { code: errorCodeOf(error, status), message: error.message || String(error) } });
	}
}

async function handleList(req, res) {
	try {
		const payload = await readJson(req);
		if (typeof payload.path !== "string" || payload.path.trim() === "") {
			throw httpError(400, "需要 {path}");
		}
		const { root } = await resolveRoot(payload.sessionCwd);
		const absolute = resolve(payload.path);
		let real;
		try {
			real = await realpath(absolute);
		} catch {
			throw httpError(400, "路径不存在或不可访问");
		}
		if (!isWithin(root, real)) throw httpError(403, "路径在项目根目录之外");
		if (depthOf(root, real) > MAX_DEPTH) throw httpError(400, "目录层级过深");

		let dirents;
		try {
			dirents = await readdir(real, { withFileTypes: true });
		} catch (error) {
			if (error && error.code === "ENOTDIR") throw httpError(400, "目标不是目录");
			throw error;
		}
		const entries = [];
		let truncated = false;
		for (const dirent of dirents) {
			if (IGNORE_NAMES.has(dirent.name)) continue;
			if (dirent.isFile() && IGNORE_EXTENSIONS.has(extensionOf(dirent.name))) continue;
			if (entries.length >= MAX_ENTRIES) {
				truncated = true;
				break;
			}
			const full = join(real, dirent.name);
			let kind = null;
			let size = 0;
			if (dirent.isSymbolicLink()) {
				try {
					const target = await realpath(full);
					const st = await stat(target);
					if (st.isDirectory()) kind = "dir";
					else if (st.isFile()) {
						kind = "file";
						size = st.size;
					}
				} catch {
					continue; // broken link — skip
				}
			} else if (dirent.isDirectory()) {
				kind = "dir";
			} else if (dirent.isFile()) {
				kind = "file";
				try {
					size = (await stat(full)).size;
				} catch {
					size = 0;
				}
			}
			if (kind === null) continue; // sockets / devices / fifos
			entries.push({ name: dirent.name, path: full, kind, size });
		}
		entries.sort((a, b) => {
			if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
			return a.name.localeCompare(b.name, "zh-CN", { numeric: true });
		});
		send(res, 200, { ok: true, root, entries, truncated });
	} catch (error) {
		const status = error.status || 500;
		send(res, status, { ok: false, error: { code: errorCodeOf(error, status), message: error.message || String(error) } });
	}
}

/** Last path segment (the folder name a File Explorer window titles itself with). */
function basenameOf(p) {
	const parts = p.replace(/[\\/]+$/, "").split(/[\\/]/);
	return parts[parts.length - 1] || p;
}

/**
* Open a path in the OS file manager. Windows Explorer is the target for this
* desktop shell: directories open the folder itself, files open with the file
* selected (/select). explorer.exe detaches and its exit code is unreliable,
* so the promise settles on spawn (error only on process creation failure).
* Windows keeps background-spawned windows behind the foreground app, so a
* best-effort helper (bring-explorer-front.ps1) raises the new window.
* @param target - validated absolute path.
* @param isDir - whether the target is a directory (plain open vs /select).
* @returns Promise resolving when explorer has been spawned.
*/
function spawnExplorer(target, isDir) {
	return new Promise((resolvePromise, reject) => {
		const args = isDir ? [target] : ["/select," + target];
		const child = spawn("explorer", args, { detached: true, stdio: "ignore" });
		child.once("error", reject);
		child.once("spawn", () => {
			try {
				const titleHint = isDir ? basenameOf(target) : basenameOf(dirname(target));
				const helper = join(dirname(fileURLToPath(import.meta.url)), "bring-explorer-front.ps1");
				const proc = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", helper, "-FolderName", titleHint], { detached: true, stdio: "ignore" });
				proc.unref();
			} catch {
				// helper is best-effort; explorer already opened
			}
			resolvePromise();
		});
	});
}

/** Whether `target` is a directory (files open with /select instead). */
async function isDirectory(target) {
	try {
		return (await stat(target)).isDirectory();
	} catch {
		return false;
	}
}

/**
* Open a path inside the resolved root with the OS file manager. The spawn is
* injectable for tests (openFn receives (target, isDir)).
* @param openFn - async (target, isDir) => void, defaults to spawnExplorer.
*/
async function handleOpen(req, res, openFn = spawnExplorer) {
	try {
		const payload = await readJson(req);
		if (typeof payload.path !== "string" || payload.path.trim() === "") {
			throw httpError(400, "需要 {path}");
		}
		const { root } = await resolveRoot(payload.sessionCwd);
		const absolute = resolve(payload.path);
		let real;
		try {
			real = await realpath(absolute);
		} catch {
			throw httpError(400, "路径不存在或不可访问");
		}
		if (!isWithin(root, real)) throw httpError(403, "路径在项目根目录之外");
		const isDir = await isDirectory(real);
		await openFn(real, isDir);
		send(res, 200, { ok: true, opened: real, openedAs: isDir ? "dir" : "file" });
	} catch (error) {
		const status = error.status || 500;
		send(res, status, { ok: false, error: { code: errorCodeOf(error, status), message: error.message || String(error) } });
	}
}

const inject = ["webServer"];

function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/plugin-project-explorer/root",
		handler: handleRoot
	}), "project-explorer: root route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/plugin-project-explorer/list",
		handler: handleList
	}), "project-explorer: list route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/plugin-project-explorer/open",
		handler: handleOpen
	}), "project-explorer: open route");
}

export { apply, inject, handleOpen };
