// Host route test for dsh-client-ui-plugin-model-capabilities.
// Runs in Node: imports buildCapabilities / handleList / rowOf from lib/index.js
// and drives them with a fake ctx.llm + fake req/res. No real LLM registry is
// touched, and no filesystem writes happen.
const lib = await import(new URL("../plugins/dsh-client-ui-plugin-model-capabilities/lib/index.js", import.meta.url).href);
const { buildCapabilities, handleList } = lib;

// ---- fake ctx.llm ----
function makeLlm(providers, listModels, resolveModelInfo) {
  return {
    listProviders: () => providers,
    listModels,
    resolveModelInfo
  };
}

// ---- 1. happy path: two providers, mixed modalities, one model resolution error ----
const ctxHappy = {
  llm: makeLlm(
    [{ id: "deepseek", name: "DeepSeek" }, { id: "pi-ai", name: "PI-AI" }],
    async (provider) => {
      if (provider === "deepseek") return [
        { id: "deepseek-chat", name: "DeepSeek Chat", description: "The chat model" },
        { id: "deepseek-vl", name: "DeepSeek VL" }
      ];
      return [{ id: "pi-1", name: "PI 1" }];
    },
    async (provider, model) => {
      if (provider === "deepseek" && model === "deepseek-chat") return {
        provider, id: model, name: "DeepSeek Chat",
        inputModalities: ["text"],
        context: { contextWindow: 131072 }
      };
      if (provider === "deepseek" && model === "deepseek-vl") return {
        provider, id: model, name: "DeepSeek VL",
        inputModalities: ["text", "image"],
        context: { contextWindow: 65536 },
        reasoning: { efforts: [{ id: "high", name: "High" }], defaultEffort: "high" }
      };
      throw new Error("resolve boom");
    }
  )
};

const out = await buildCapabilities(ctxHappy);
if (!out.groups || out.groups.length !== 2) throw new Error("expected 2 groups, got " + out.groups.length);
const deepseek = out.groups.find((g) => g.id === "deepseek");
if (!deepseek) throw new Error("deepseek group missing");
const chat = deepseek.models.find((m) => m.id === "deepseek-chat");
const vl = deepseek.models.find((m) => m.id === "deepseek-vl");
const pi = out.groups.find((g) => g.id === "pi-ai").models[0];
if (JSON.stringify(chat.inputModalities) !== JSON.stringify(["text"])) throw new Error("chat modalities wrong: " + JSON.stringify(chat.inputModalities));
if (JSON.stringify(vl.inputModalities) !== JSON.stringify(["text", "image"])) throw new Error("vl modalities wrong: " + JSON.stringify(vl.inputModalities));
if (vl.contextWindow !== 65536) throw new Error("vl context wrong: " + vl.contextWindow);
if (!vl.reasoning || vl.reasoning.efforts[0].name !== "High") throw new Error("vl reasoning wrong: " + JSON.stringify(vl.reasoning));
if (pi.error !== "resolve boom") throw new Error("pi should carry a per-model error, got: " + JSON.stringify(pi));
console.log("happy path OK (2 groups, modalities/context/reasoning/per-model-error)");

// ---- 2. provider-level failure ----
const ctxFail = {
  llm: makeLlm(
    [{ id: "broken", name: "Broken" }],
    async () => { throw new Error("catalog boom"); },
    async () => { throw new Error("unused"); }
  )
};
const outFail = await buildCapabilities(ctxFail);
if (outFail.groups.length !== 0 || outFail.failures.length !== 1) throw new Error("failure shape wrong: " + JSON.stringify(outFail));
if (!outFail.failures[0].message.includes("catalog boom")) throw new Error("failure message wrong");
console.log("provider failure OK");

// ---- 3. missing ctx.llm ----
try {
  await buildCapabilities({});
  throw new Error("should have thrown without ctx.llm");
} catch (error) {
  if (!String(error.message).includes("ctx.llm is unavailable")) throw new Error("wrong error: " + error.message);
}
console.log("missing ctx.llm OK");

// ---- 4. http envelope via handleList (fake req/res) ----
function fakeRes() {
  const chunks = [];
  const res = {
    status: 0,
    writeHead: (status) => { res.status = status; },
    end: (body) => { chunks.push(body); },
    getBody: () => chunks.join("")
  };
  return res;
}
const res = fakeRes();
let reqYielded = false;
const req = {
  [Symbol.asyncIterator]: async function* () {
    if (reqYielded) return;
    reqYielded = true;
    yield "";
  }
};
await handleList(ctxHappy, req, res);
const parsed = JSON.parse(res.getBody());
if (parsed.ok !== true || parsed.groups.length !== 2) throw new Error("http envelope wrong: " + res.getBody());
console.log("http envelope OK (ok:true, 2 groups)");

console.log("\nALL HOST CHECKS PASSED");
