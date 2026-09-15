// sync-status.mjs — check the fork's upstream-sync health from the GitHub REST
// API, with NO local clone needed (the old .work/sync-upstream.ps1 requires a
// clone of the fork; this one works from any machine with network access).
//
//   node .work/sync-status.mjs
//
// Prints:
//   1. the last few sync-upstream workflow runs (event / conclusion / link)
//   2. how the fork's master relates to upstream master (ahead / behind)
//
// Exit code 1 when the newest run is not a success or the fork is behind
// upstream, so it can be used in a check script. Unauthenticated API calls are
// fine (60/h); set GITHUB_TOKEN to lift the rate limit if you run it often.
const FORK = "FFaassdfs/deepseek-harness";
const UPSTREAM = "deepseek-ai/deepseek-harness";
const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "dsh-desktop-env-sync-status",
  ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function getJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const resp = await fetch(url, { headers });
      if (resp.status === 404) throw new Error("not found (is the repo public?)");
      if (!resp.ok) throw new Error(`http ${resp.status}`);
      return await resp.json();
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  throw lastError;
}

let problems = 0;

// ---- 1. workflow runs --------------------------------------------------------
const runs = await getJson(
  `https://api.github.com/repos/${FORK}/actions/workflows/sync-upstream.yml/runs?per_page=5`
);
console.log(`sync-upstream runs (total ${runs.total_count}):`);
for (const run of runs.workflow_runs) {
  const ok = run.conclusion === "success";
  console.log(
    `  #${run.run_number} ${run.event.padEnd(17)} ${run.status}/${run.conclusion}` +
    `  created=${run.created_at}  head=${String(run.head_sha).slice(0, 7)}`
  );
  console.log(`      ${run.html_url}`);
  if (run === runs.workflow_runs[0] && !ok) problems++;
}
const newest = runs.workflow_runs[0];
console.log(newest && newest.conclusion === "success"
  ? "\nlatest run: SUCCESS"
  : "\nlatest run: NOT successful -> check SYNC_TOKEN (repo + workflow scope) in the fork's Actions secrets");

// ---- 2. fork vs upstream ----------------------------------------------------
const cmp = await getJson(
  `https://api.github.com/repos/${UPSTREAM}/compare/master...${FORK.split("/")[0]}:master`
);
console.log(
  `\nfork vs upstream: status=${cmp.status} ahead_by=${cmp.ahead_by} behind_by=${cmp.behind_by}`
);
console.log(`  merge-base = ${String(cmp.merge_base_commit?.sha).slice(0, 7)}`);
if (cmp.behind_by > 0) {
  problems++;
  console.log(`  the fork is ${cmp.behind_by} commit(s) behind upstream -> the next scheduled run should merge them`);
} else {
  console.log("  the fork already contains upstream's master (behind_by = 0)");
}

const forkHead = await getJson(`https://api.github.com/repos/${FORK}/commits/master`);
console.log(`  fork master     = ${forkHead.sha.slice(0, 7)}  ${forkHead.commit.committer.date}`);
const upstreamHead = await getJson(`https://api.github.com/repos/${UPSTREAM}/commits/master`);
console.log(`  upstream master = ${upstreamHead.sha.slice(0, 7)}  ${upstreamHead.commit.committer.date}`);

process.exit(problems === 0 ? 0 : 1);
