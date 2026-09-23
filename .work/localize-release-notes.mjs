// localize-release-notes.mjs — rewrite this repo's English GitHub Release notes in
// Chinese, keeping each release's OWN facts (shell commit / harness / node / assets).
//
// WHY: releases 0.1.0–0.1.9 were published by a workflow whose `body:` was English.
// The workflow template is Chinese now (so NEW releases are Chinese), but the page a
// user actually lands on still showed English for every existing release.
//
// It is IDEMPOTENT: a release whose body already contains CJK is skipped, so it is
// safe to re-run (the CI trigger is a push touching this file).
//
// Per-release facts are PARSED FROM THAT RELEASE'S OWN BODY, never taken from today's
// tree — a 0.1.2 package predates the single-file runtime.zip and the .cmd installer,
// so its notes must not tell people to use them (HANDOVER §27.10/§27.11).
//
//   node .work/localize-release-notes.mjs              # dry run (read-only, no token needed)
//   node .work/localize-release-notes.mjs --apply      # PATCH the releases
//   node .work/localize-release-notes.mjs --apply --force   # rewrite even Chinese ones
//
// Token: $GITHUB_TOKEN (CI provides it) or $GH_PAT, else .cache/gh-pat.txt.
import { existsSync, readFileSync } from "node:fs";

const REPO = process.env.REPO ?? "FFaassdfs/dsh-desktop-env";
const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg >= 0 ? process.argv[onlyArg + 1] : "";
const show = process.argv.includes("--show");

const token = process.env.GITHUB_TOKEN || process.env.GH_PAT ||
  (existsSync(".cache/gh-pat.txt") ? readFileSync(".cache/gh-pat.txt", "utf8").trim() : "");

const hasCjk = (text) => /[\u4e00-\u9fff]/.test(text ?? "");

/**
 * Numeric compare of "0.1.7"-style versions.
 * @param version - the tag's version part.
 * @param floor - the version it is compared against.
 * @returns true when version >= floor.
 */
function versionAtLeast(version, floor) {
  const a = version.split(".").map(Number);
  const b = floor.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

/**
 * Read one release's own table so the Chinese text keeps ITS values.
 *
 * Capabilities that the English bodies never mentioned are derived from the repo
 * history instead of guessed, by reading each tag's own files:
 *   - install-offline.cmd      present in EVERY tag (commit 82fbb41 is already in 0.1.0)
 *                              — 0.1.0's body simply failed to mention it
 *   - single-file runtime.zip  from 0.1.3 (commit bc69c53, HANDOVER §27.11)
 *   - Chinese installer menu   from 0.1.5 (commit 3f30a63, HANDOVER §28)
 * @param body - the release body as published.
 * @param version - the tag's version part ("0.1.7").
 * @returns the facts that vary per release.
 */
function releaseFacts(body, version) {
  const pick = (label) => {
    const m = new RegExp("^\\|\\s*" + label + "\\s*\\|(.*)\\|\\s*$", "im").exec(body ?? "");
    return m ? m[1].trim() : "";
  };
  return {
    version,
    sha: /`([0-9a-f]{7,40})`/.exec(pick("shell"))?.[1] ?? "",
    harness: /`@deepseek-ai\/dsh ([^`]+)`/.exec(pick("harness"))?.[1] ?? "",
    node: /`([^`]+)`/.exec(pick("node"))?.[1] ?? "",
    // the bodies are reliable about these two: 0.1.0 has neither
    hasNpmRow: /^\|\s*npm\s*\|/im.test(body ?? ""),
    hasUpdates: /\*\*Updates\*\*/.test(body ?? ""),
    hasCmdWrapper: true,
    singleFileRuntime: versionAtLeast(version, "0.1.3"),
    menuWithDescriptions: versionAtLeast(version, "0.1.5")
  };
}

/**
 * Build the Chinese body for one release.
 * @param release - the GitHub release object.
 * @param info - the parsed per-release facts.
 * @returns the markdown body.
 */
function chineseBody(release, info) {
  const zip = release.assets.find((a) => a.name.endsWith(".zip"));
  const lines = [
    "**dsh-desktop 便携发行包**：解压即用，目标机**不需要** Node.js、npm、Go 或 Wails。",
    "",
    "| 项 | 值 |",
    "|---|---|",
    `| 壳 | commit \`${info.sha}\` |`,
    `| 核心 | \`@deepseek-ai/dsh ${info.harness}\`（离线内置） |`,
    `| Node | \`${info.node}\` 便携运行时 |`
  ];
  if (info.hasNpmRow) lines.push("| npm | 已内置 —— 便携壳与源码装一样**能自更新** |");
  lines.push(`| 插件 | 包内自带自定义插件${info.menuWithDescriptions ? "，安装菜单会逐个显示中文说明" : ""}（清单见包内 \`README.txt\`） |`, "");
  if (zip) {
    lines.push(`**资产**：\`${zip.name}\`（${(zip.size / 1048576).toFixed(1)} MB）+ \`SHA256SUMS.txt\``, "");
  }
  lines.push("**快速开始**", "");
  lines.push("1. 把 zip 解压到任意目录（例如 `D:\\dsh-desktop`）");
  lines.push(info.singleFileRuntime
    ? "2. 双击 `dsh-desktop.exe` —— 首次启动会先解压内置运行时（约 40 秒，只此一次）"
    : "2. 双击 `dsh-desktop.exe` —— 便携运行时是普通目录，无需额外解压步骤");
  lines.push(info.hasCmdWrapper
    ? "3. （可选）双击 `install-offline.cmd`（或 `powershell -File install-offline.ps1`），按提示选择要装进 `%USERPROFILE%\\.dsh` 的插件，装完**完全退出壳再重启**"
    : "3. （可选）`powershell -File install-offline.ps1`，把自定义插件装进 `%USERPROFILE%\\.dsh`，装完**完全退出壳再重启**");
  if (info.singleFileRuntime) lines.push("4. 想跳过界面先解压运行时：`dsh-desktop.exe --extract-runtime`");
  lines.push("");
  if (info.hasUpdates) {
    lines.push(
      "**更新**：壳启动时以及每 24 小时会查一次 npm registry，发现新版就用**包内 npm** 下载到暂存目录，下次启动换入（只作用于 harness，`node.exe` 不动）；也可以直接解压更新版覆盖本目录。",
      ""
    );
  }
  lines.push(
    "**注意**",
    "",
    "- 包内**不含**任何 API Key / `.env`：每台机器自己配",
    "- 未签名构建：首次运行可能有 SmartScreen 提示",
    "- 端口固定 **43080**；会话与配置在 `$DSH_HOME`（`%USERPROFILE%\\.dsh`），更新不丢",
    "- 请保持目录结构（壳按 exe 同级的 `runtime\\` 解析便携运行时）；**每个用户单实例**",
    "- 拷贝/分发请**搬 zip**；必须拷目录时用 `robocopy <源> <目标> /E /MT:16 /NFL /NDL /NJH /NJS /NP`",
    "",
    "> 本说明于 2026-09-23 由英文改为中文，各项事实取自该版本自身（commit / 核心 / Node / 资产；能力按该版本的仓库历史判定）；后续版本的说明由发布流程直接以中文生成。"
  );
  return lines.join("\n");
}

/** Chinese release title, keeping the tag readable. */
function chineseName(tag) {
  return tag.replace(/^desktop-v/, "dsh-desktop ") + "（便携包 · Windows x64）";
}

async function api(path, init = {}) {
  const res = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      "user-agent": "dsh-desktop-release-notes",
      accept: "application/vnd.github+json",
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(init.headers ?? {})
    }
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep null */ }
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${json?.message ?? text.slice(0, 200)}`);
  return json;
}

const releases = (await api(`/repos/${REPO}/releases?per_page=50`))
  .filter((r) => r.tag_name.startsWith("desktop-v") && (!only || r.tag_name === only));

console.log(`repo    : ${REPO}`);
console.log(`token   : ${token ? "present (" + token.length + " chars)" : "absent — read-only dry run"}`);
console.log(`releases: ${releases.length}${only ? " (only " + only + ")" : ""}`);
console.log(`mode    : ${apply ? "APPLY" : "DRY RUN"}\n`);

let changed = 0;
let skipped = 0;
for (const r of releases) {
  const version = /^desktop-v(.+)$/.exec(r.tag_name)?.[1] ?? "0.0.0";
  const expectedName = chineseName(r.tag_name);
  // Two INDEPENDENT reasons to touch a release: a body that is not Chinese yet, and
  // a title that does not match the house form. The title case exists because the
  // first release published from the Chinese template repeated the tag prefix
  // (`dsh-desktop desktop-v0.1.10（便携包 · Windows x64）`) — repaired here rather
  // than by hand, since this job already holds the right token.
  const bodyNeedsFix = force || !hasCjk(r.body);
  const nameNeedsFix = r.name !== expectedName;
  if (!bodyNeedsFix && !nameNeedsFix) {
    console.log(`  ${r.tag_name.padEnd(16)} up to date (Chinese body + canonical title) — skipped`);
    skipped += 1;
    continue;
  }
  const info = releaseFacts(r.body, version);
  const body = bodyNeedsFix ? chineseBody(r, info) : r.body;
  console.log(`  ${r.tag_name.padEnd(16)} v${version} body=${bodyNeedsFix ? "rewrite" : "keep"}` +
    ` title=${nameNeedsFix ? JSON.stringify(r.name) + " -> " + JSON.stringify(expectedName) : "keep"}` +
    (bodyNeedsFix ? ` shell=${(info.sha || "?").slice(0, 8)} harness=${info.harness || "?"} node=${info.node || "?"} npm=${info.hasNpmRow} updates=${info.hasUpdates} runtimeZip=${info.singleFileRuntime} menuZh=${info.menuWithDescriptions} -> ${body.length} chars` : ""));
  if (show && !apply && bodyNeedsFix) {
    console.log("-".repeat(78));
    console.log(body);
    console.log("-".repeat(78));
  }
  if (!apply) continue;
  await api(`/repos/${REPO}/releases/${r.id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...(bodyNeedsFix ? { body } : {}), ...(nameNeedsFix ? { name: expectedName } : {}) })
  });
  console.log(`  ${" ".repeat(16)} PATCHED (${[bodyNeedsFix ? "body" : null, nameNeedsFix ? "title" : null].filter(Boolean).join(" + ")})`);
  changed += 1;
}

console.log(`\n${apply ? "applied" : "would apply"}: ${changed}   skipped (already canonical): ${skipped}`);
if (!apply) console.log("re-run with --apply to write.");
