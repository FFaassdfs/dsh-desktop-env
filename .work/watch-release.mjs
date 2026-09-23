// watch-release.mjs — follow the release-desktop workflow run for a tag.
//
//   node .work/watch-release.mjs desktop-v0.1.7
//
// Prints status changes (queued -> in_progress -> completed/success) and, when the
// run finishes, the assets attached to that GitHub Release. Exit code 0 on
// success, 1 otherwise. Handy right after `git push origin <tag>`.
import { execFileSync } from "node:child_process";

const REPO = "FFaassdfs/dsh-desktop-env";
const WORKFLOW = "release-desktop.yml";
const TAG = process.argv[2];
if (!TAG) {
  console.log("usage: node .work/watch-release.mjs <tag>       e.g. desktop-v0.1.7");
  process.exit(2);
}
const headers = { accept: "application/vnd.github+json", "user-agent": "dsh-desktop-watch" };

async function api(url, tries = 5) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error("http " + r.status);
      return await r.json();
    } catch (err) { last = err; await new Promise((r) => setTimeout(r, 3000)); }
  }
  throw last;
}

const started = Date.now();
const since = new Date(started - 120000).toISOString(); // ignore runs older than this
let lastLine = "";
let finished = null;

for (let i = 0; i < 90; i++) {
  let runs;
  try {
    runs = await api(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=10`);
  } catch (err) {
    console.log(`poll ${i + 1}: runs query failed (${err.message})`);
    await new Promise((r) => setTimeout(r, 20000));
    continue;
  }
  const run = runs.workflow_runs.filter((r) => r.head_branch === TAG && r.created_at >= since)[0];
  if (!run) {
    console.log(`poll ${i + 1}: no new run for ${TAG} yet`);
  } else {
    const line = `#${run.run_number} ${run.event} ${run.status}/${run.conclusion} ${run.head_sha.slice(0, 7)} ${run.html_url}`;
    if (line !== lastLine) {
      console.log(`[+${Math.round((Date.now() - started) / 60000)}m] ${line}`);
      lastLine = line;
    }
    if (run.status === "completed") { finished = run; break; }
  }
  await new Promise((r) => setTimeout(r, 20000));
}

if (!finished) { console.log("TIMEOUT: workflow still not completed after ~30 minutes"); process.exit(1); }

console.log(`\nRESULT: run #${finished.run_number} -> ${String(finished.conclusion).toUpperCase()}`);
if (finished.conclusion !== "success") {
  // Point at the failing step without needing authenticated log access.
  try {
    const jobs = await api(finished.jobs_url);
    for (const job of jobs.jobs) {
      console.log(`  job ${job.name}: ${job.conclusion}`);
      for (const s of job.steps) if (s.conclusion === "failure") console.log(`    FAILED STEP: ${s.name}`);
    }
  } catch { /* ignore */ }
  process.exit(1);
}

try {
  const release = await api(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`);
  console.log(`release: ${release.html_url}`);
  for (const a of release.assets) {
    console.log(`  ${a.name}  ${(a.size / 1048576).toFixed(1)} MB  downloads=${a.download_count}`);
    console.log(`  ${a.browser_download_url}`);
  }
  console.log("\nnow verify it:  node .work/verify-release.mjs " + TAG);
} catch (err) {
  console.log("release query failed: " + err.message);
}
process.exit(0);
