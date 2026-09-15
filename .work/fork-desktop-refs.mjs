// Fetch the fork's root config files and look for references to a ROOT-level
// `desktop/` directory (the fork-only Wails shell), so deleting it cannot break
// an upstream-owned workspace/CI file. Run: node .work/fork-desktop-refs.mjs
const base = "https://raw.githubusercontent.com/FFaassdfs/deepseek-harness/master";
const files = [
  "package.json",
  "pnpm-workspace.yaml",
  "lefthook.yml",
  "vitest.config.ts",
  "tsconfig.json",
  ".gitignore",
  ".github/workflows/ci.yml",
  ".github/workflows/ci-master.yml",
  ".github/workflows/expected-filenames.yml",
  ".github/workflows/sync-upstream.yml",
];

// A reference to the fork-only shell looks like "desktop/" NOT preceded by
// apps/ or .agents/, and not a file name that merely contains "desktop-".
const suspicious = /(^|[^/\w.-])desktop\//;

let flagged = 0;
for (const f of files) {
  let text;
  try {
    const resp = await fetch(`${base}/${f}`);
    if (!resp.ok) {
      console.log(`SKIP ${f} (http ${resp.status})`);
      continue;
    }
    text = await resp.text();
  } catch (err) {
    console.log(`SKIP ${f} (${err.message})`);
    continue;
  }
  const lines = text.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, i) => {
    if (!line.includes("desktop")) return;
    if (/apps\/desktop|desktop-host|electron-desktop|\.agents/.test(line)) return;
    if (suspicious.test(line)) hits.push(`${i + 1}: ${line.trim()}`);
  });
  console.log(`${hits.length ? "HIT " : "ok  "}${f} (${text.length} bytes, ${lines.length} lines)`);
  for (const h of hits) console.log(`      ${h}`);
  flagged += hits.length;
}
console.log(flagged === 0
  ? "\nRESULT: no root-level desktop/ reference in any of these files -> safe to delete desktop/"
  : `\nRESULT: ${flagged} suspicious reference(s) -> inspect before deleting`);
