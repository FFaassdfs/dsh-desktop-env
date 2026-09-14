# vekenllm 模型配置说明（deepseek-v4-flash + auto）

> **文档版本：v1.8**（2026-08-19 更新）
> 版本历史：v1.8（2026-08-19）**按全量实测修正**：①`auto` 实测**支持思考**（默认开启、low/high 生效、可关闭）——推翻此前「不支持思考」；②`deepseek-v4-flash` 实测**能识别图像**（原声明仅文本）；③`thinking:{type:disabled}` 与 `reasoning_effort:"none"` **均能真正关闭思考**（原 §11.1 说无法完全关闭，已过时）；④代理**接受 `medium`/`max`** 档位（「仅 none/low/high」是使用约定，非代理硬限制）；v1.7（2026-08-19）**auto 输出长度改为以 API 实测为准 = 393216**；v1.6（2026-08-19）修正 DSH 模态写法（条目级 `input`）；v1.5（2026-08-19）去掉「探索其他模型」环节；v1.4（2026-08-19）补齐逐步引导；v1.3（2026-08-19）auto 思考修正；v1.2（2026-08-19）升级为双模型；v1.1（2026-08-19）确认输出长度；v1.0（2026-08-19）创建。
> 更新约定：**任何 agent 修改本文件后，必须递增版本号（文件名 + 文件内版本块同步）并追加一行变更记录**（格式：`vX.Y（日期）内容`）。

> 面向**任何需要配置模型供应商的 agent** 的操作手册。本文档覆盖 `vekenllm` 供应商当前可访问的两个已知模型：**`deepseek-v4-flash`**（纯文本）与 **`auto`**（全模态）。**本文档只配置这两个现有模型，不涉及探索/接入其他模型。**

---

## 🛑 独立供应商声明（置顶必读）

> **`vekenllm` 是一个完全独立的模型供应商，与 `ctai`（电信算力中转）没有任何关系，配置时严禁混淆。** 两者的 baseURL、API Key、provider 键名全部不同，**绝不能**把 vekenllm 的配置写成 ctai、把 vekenllm 的 API Key 用在 ctai 上，或把 ctai 的模型挂到 vekenllm 名下。

| 项目 | **vekenllm**（本文档主题） | **ctai**（另一个供应商） |
|---|---|---|
| provider 键名 | `vekenllm` | `ctai` |
| Base URL | `http://192.168.100.63:4000`（内网 LiteLLM 代理） | `https://ai.ctaigw.cn/v1`（公网中转） |
| API Key | 独立 key，**配置前必须向用户询问**（§3.3） | 独立 key（ctai 环境专用） |

> ⚠️ 2026-08-19 实测：当前 API Key 对应团队**只能访问 `deepseek-v4-flash` 与 `auto`** 两个模型（`/v1/models` 仅返回这两个；`deepseek-v4-pro` 与全部 `ctai-*` 已不在可访问列表，访问返回 403）。**本文档即按这两个已知模型配置，无需探索其他模型。**

---

## 1. 文档使用约定（agent 开工前必读）

### 1.1 强制询问（不可跳过）

| # | 时机 | 内容 |
|---|------|------|
| ① | **配置开始前** | 向用户询问 **API Key**，禁止使用示例值或历史遗留值（§3.3） |

> 本文档**不涉及**「探索其他模型」询问——目标模型固定为 `deepseek-v4-flash` 与 `auto` 两个已知模型。

### 1.2 配置前必须查官方文档（防参数错误）

**任何 agent 动手前，先查看「目标 agent」和「目标模型」的官方文档**，核对：provider 配置格式、模型 ID、上下文长度、输出上限、思考档位、模态、能力标志。**模型参数以官网为准，本文档只是经验值参考**（§9 官网速查表）。

### 1.3 目标客户端（动手前先确认）

| 客户端 | 配置文件 | 声明方式 | baseURL 写法 | 密钥存放 | 生效方式 |
|---|---|---|---|---|---|
| **opencode** | `opencode.json` | `provider.vekenllm.models` 下两个模型条目 | **不带** `/v1`（AI SDK 自动补） | `options.apiKey` 字段 | 重启 opencode 生效 |
| **DSH harness** | `~/.dsh/settings.yaml` | `llm-pi-ai.providers.vekenllm.models` 两条 | **必须带** `/v1` | `~/.dsh/.credentials.yaml` 的 `VEKENLLM_API_KEY` | 动态生效，**无需重启** |
| **WorkBuddy** | `~/.workbuddy/models.json` | `vendor: "Custom"` 两个模型条目 | **必须带** `/v1` | `apiKey` 字段（明文） | 刷新/重启 |
| **Codex 等** | 见各自官网（§9） | — | — | — | — |

> ⚠️ 模态（v1.8 实测修正）：**两个模型实测都能识别图像**（`auto` 声明全模态；`deepseek-v4-flash` 原声明仅文本，实测 `image_url` 输入可正确识别）——配置时两者都可声明图像输入。**DSH 侧模态枚举只有 `text`/`image` 两种**（源码实测，`video`/`audio` 写入会报 `settings-rejected`），故 DSH 上两个模型都用 `input: [text, image]`。供应商声明一律是 **`vekenllm`**（WorkBuddy 侧为 `vendor: "Custom"` + vekenllm 的 URL/key），与 ctai 无关（见置顶声明）。

---

## 2. 配置流程总览（按序执行，勿跳步）

```
Step 0  确认目标客户端（opencode / DSH / WorkBuddy / 其他）
   ↓
Step 1  查官方文档：目标 agent 的 provider 配置格式 + 目标模型的参数（§1.2 / §2.2 / §9）
   ↓
Step 2  【强制询问①】向用户要 API Key（§3.3）
   ↓
Step 3  测试 vekenllm 地址连通性 + 确认 /v1/models 返回两个已知模型（§4）
   ↓
Step 4  与用户确认最终参数（供应商名=vekenllm / BaseURL / 模型 ID / API Key）后写入配置（§6）
   ↓
Step 5  校验配置 + 验证连接 + 按客户端告知生效方式（§8）
```

### 2.1 流程图例

- 🔒 = 强制询问用户（§1.1）
- 📖 = 查官网（§1.2）
- ✅ = 必须验证（§8）

### 2.2 如何查官方文档（具体做法）

1. **目标 agent 官网**（§9.1 表格「Agent 类」）→ 找「Providers / Models / Configuration」章节，确认该 agent 声明自定义供应商的字段格式（如 opencode 的 `provider` 节点、DSH 的 `llm-pi-ai.providers`、WorkBuddy 的 `models.json`）。
2. **目标模型官网**（§9.2 表格「模型类」）→ 核对模型 ID、上下文长度、输出上限、思考档位（reasoning 档位集合）、模态、能力标志。
3. 将官网参数与本文档 §7「关键约束」对照：**不一致时以官网为准，并向用户说明差异**。

---

## 3. 配置前准备

### 3.1 确认目标客户端

向用户确认：**opencode 还是 DSH harness，还是 WorkBuddy / Codex 等**。按 §1.3 表格落到对应配置文件。

### 3.2 查官方文档（防参数错误，必做）

按 §2.2 查「目标 agent 官网 + 目标模型官网」，核对配置格式与模型参数。**不要凭记忆写参数**。

### 3.3 🔒 必须主动询问 apikey（强制询问①）

1. 配置开始前，**先向用户询问 API Key**，禁止使用示例值或历史遗留值。
2. 将拿到的 apikey 填入对应配置的密钥字段（opencode 的 `options.apiKey`；DSH 的 `.credentials.yaml`；WorkBuddy 的 `apiKey`）。
3. 向用户确认以下信息无误后再写入配置：
   - 供应商名称：`vekenllm`
   - Base URL：`http://192.168.100.63:4000`
   - 模型 ID：`deepseek-v4-flash` 与 `auto`（两个已知模型）
   - API Key：`<用户提供的值>`

---

## 4. 网络环境与地址选择（测试连通性）

该供应商在不同网络环境有不同连接地址，配置前**必须先测试连通性**：

| 地址 | 服务对象 | 说明 |
|------|---------|------|
| `http://192.168.100.63:4000` | 集团大楼内网 | 主要地址，默认优先 |
| `http://192.168.15.137:4000` | 维科技术 | 备用地址 |

**配置流程：**

1. **先测试两个地址的连通性，并确认返回的模型列表**，用拿到的 apikey 请求 `/v1/models`：
   ```powershell
   $key = "<用户提供的 API Key>"
   Invoke-RestMethod -Uri "http://192.168.100.63:4000/v1/models" -Headers @{ Authorization = "Bearer $key" }
   Invoke-RestMethod -Uri "http://192.168.15.137:4000/v1/models" -Headers @{ Authorization = "Bearer $key" }
   ```
   - 连通性指请求是否成功返回；**模型配置**指返回的 `data` 列表是否包含 `deepseek-v4-flash` 与 `auto`。
   - 两个地址可能在连通性上相同，但**一个地址上配置了模型、另一个没有**，需要分别检查。
2. 若**两个地址均可连通且都配置了模型**：**请用户确认使用哪一个**，再写入对应 `baseURL`。
3. 若某地址可连通但**没有配置任何模型**：**明确向用户说明**该地址未配置模型，并**建议用户选择有配置模型的地址**。
4. 若仅一个地址可连通且有模型：使用该地址，并告知用户。
5. 若均不可连通或均无模型：**不要写入配置**，向用户报告并确认 apikey/地址是否正确。
6. **确认模型列表包含 `deepseek-v4-flash` 与 `auto` 后**，即可按 §6 写入配置（**本文档不探索其他模型，直接使用这两个已知模型**）。

> 实测记录（测试日期：2026-08-19）：
> - `192.168.100.63:4000` ✅ 连通，当前返回 2 个模型：`deepseek-v4-flash`、`auto`。
> - `192.168.15.137:4000` ⚠️ 服务在线但用当前 apikey 访问 `/v1/models` 返回 **401**（需该环境专用 key）。

---

## 5. 模型参数（用户提供/API 实测，2026-08-19）

| 项目 | **deepseek-v4-flash** | **auto** |
|------|----------------------|----------|
| 模型 ID | `deepseek-v4-flash` | `auto` |
| 上下文长度 | 1M (1,000,000) | 1M (1,000,000) |
| 最大输出 | **393216**（=384×1024，API 实测） | **393216**（=384×1024，API 实测；原口头 128k 已作废） |
| 输入模态 | 文本 **+ 图像**（v1.8 实测可识别图像；代理侧实际支持） | 文本 / 图像 / 视频 / 音频（**DSH 侧仅支持 text/image**） |
| 输出模态 | 文本 | 文本 |
| 思考模式 | `none`（关闭）/ `low` / `high`（**推荐三档**；代理另接受 `medium`/`max`，见下） | **支持思考，默认开启**；`none`/`low`/`high` 生效（v1.8 实测修正） |
| 关闭思考 | `thinking:{type:"disabled"}` 或 `reasoning_effort:"none"` **均实测有效**（无 `reasoning_content`） | 同左（实测有效） |
| 思考链字段 | `reasoning_content`（实测） | `reasoning_content`（实测，默认返回） |
| 能力 | 工具调用、结构化输出、温度、深度思考 | 工具调用、结构化输出、流式、深度思考、**联网搜索、cache 缓存**（后两者为代理侧能力，客户端无需配置） |

> 🔴 **v1.8 实测修正说明（2026-08-19 全量探测，9 项测试）**：
> 1. **`auto` 实测支持思考**（推翻此前「不支持思考」）：不传参数时**默认返回 `reasoning_content`**；`reasoning_effort=low/high` 均生效（有思考链）；`thinking:{type:disabled}` 与 `reasoning_effort=none` 可关闭。
> 2. **`deepseek-v4-flash` 实测能识别图像**：`image_url` 输入（1×1 红色图）→ 正确回答「红色」（原声明仅文本，实测不符）。
> 3. **关闭思考有效**：`thinking:{type:"disabled"}` 与 `reasoning_effort:"none"` 均**真正关闭**思考链输出（原 §11.1 的「无法完全关闭」说法已过时）。
> 4. **代理接受 `medium`/`max`**：flash 传 `reasoning_effort=medium/max` 均 HTTP 200 + 思考链——**「仅 none/low/high」是本文档的使用约定（用户要求），不是代理的硬限制**。这解释了客户端（如 opencode）可能暴露更多档位的现象。
>
> 🔴 **参数以 API 实测为准（v1.7 约定，继续有效）**：上表数值是**推荐值**（实测快照），**配置前必须自行实测确认**——代理侧参数可能变化（`auto` 的输出上限就曾按口头 128k 记录、实测却是 393216）。
> **实测命令**：
> ```powershell
> $key = "<用户提供的 API Key>"
> Invoke-RestMethod -Uri "http://192.168.100.63:4000/v1/models" -Headers @{ Authorization = "Bearer $key" } |
>   Select-Object -ExpandProperty data | Where-Object { $_.id -in @('deepseek-v4-flash','auto') } |
>   Select-Object id, max_input_tokens, max_output_tokens
> ```
> 返回的 `max_input_tokens` / `max_output_tokens` 即为**该模型的真实上限**，写入配置时以它为准；**实测值与上表推荐值不一致时，以实测为准**（并在交付说明中记录差异）。
> 注意：`auto` 是代理内部路由模型，其元数据与能力可能随上游配置变化——每次配置前重新实测，不要沿用本文档数字。

---

## 6. 写入配置（按目标客户端选一节）

### 6.1 opencode：写入 opencode.json 的 `provider.vekenllm.models` 节点

```jsonc
{
  "provider": {
    "vekenllm": {
      "name": "vekenllm",
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "http://192.168.100.63:4000",
        "apiKey": "<用户提供的 API Key>"
      },
      "models": {
        "deepseek-v4-flash": {
          "id": "deepseek-v4-flash",
          "name": "DeepSeek V4 Flash",
          "family": "deepseek-flash",
          "release_date": "2026-07-31",
          "attachment": true,          // v1.8 实测：flash 也能识图
          "reasoning": true,
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "modalities": {
            "input": ["text", "image"],   // v1.8 实测：flash 能识图
            "output": ["text"]
          },
          "limit": {
            "context": 1000000,
            "output": 393216
          },
          "variants": {
            "none": {
              "thinking": { "type": "disabled" }
            },
            "low": {
              "reasoningEffort": "low"
            },
            "high": {
              "reasoningEffort": "high"
            }
          }
        },
        "auto": {
          "id": "auto",
          "name": "Auto",
          "attachment": true,
          "reasoning": true,           // v1.8 实测：auto 支持思考（默认开启）
          "tool_call": true,
          "structured_output": true,
          "temperature": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "modalities": {
            "input": ["text", "image", "video", "audio"],
            "output": ["text"]
          },
          "limit": {
            "context": 1000000,
            "output": 393216
          },
          "variants": {
            "none": {
              "thinking": { "type": "disabled" }
            },
            "low": {
              "reasoningEffort": "low"
            },
            "high": {
              "reasoningEffort": "high"
            }
          }
        }
      }
    }
  }
}
```

> ⚠️ 若 `attachment` 字段在本机 opencode 版本不被识别（v1.14.30 顶层报 `Unrecognized key: attachment`，模型级行为待验证），可移除该字段，仅保留 `modalities` 声明。

### 6.2 DSH harness：写入 `~/.dsh/settings.yaml` 的 `llm-pi-ai.providers.vekenllm`

```yaml
llm-pi-ai:
  providers:
    vekenllm:
      displayName: vekenllm
      apiKeyEnv: VEKENLLM_API_KEY
      api: openai-completions
      baseURL: http://192.168.100.63:4000/v1
      compat:
        thinkingFormat: deepseek
      models:
        - id: deepseek-v4-flash
          name: DeepSeek V4 Flash
          contextWindow: 1000000
          maxTokens: 393216
          input: [text, image]   # v1.8 实测：flash 也能识图（条目级模态）
          reasoningEfforts:
            off:
            low: low
            high: high
        - id: auto
          name: Auto
          contextWindow: 1000000
          maxTokens: 393216
          input: [text, image]   # 条目级模态（DSH 枚举仅 text/image，video/audio 写入会失败）
          reasoningEfforts:      # v1.8 实测：auto 支持思考（默认开启）
            off:
            low: low
            high: high
```

> ⚠️ **DSH 模态写法（v1.6 修正，源码实测）**：DSH 适配器模态枚举只有 `text` 与 `image`（`dsh-llm-pi-ai` MODALITIES），`video`/`audio` 是非法枚举，写入会报 `settings-rejected`。模态应写在**条目级 `input: [text, image]`**（模态优先级：条目级 `input` → provider 级 `base.input` → 路由级 `defaultInput`），**不要用路由级 `defaultInput: [text,image,video,audio]`**（含非法枚举且会拖累其他模型）。`maxTokens` 两个模型均为 393216（2026-08-19 API 实测，**配置前请按 §5 实测命令核对**）。

### 6.3 WorkBuddy：写入 `~/.workbuddy/models.json`

```jsonc
[
  {
    "id": "deepseek-v4-flash",
    "name": "DeepSeek V4 Flash",
    "vendor": "Custom",
    "url": "http://192.168.100.63:4000/v1",
    "apiKey": "<用户提供的 API Key>",
    "supportsToolCall": true,
    "supportsImages": true,       // v1.8 实测：flash 也能识图
    "supportsReasoning": true,
    "useCustomProtocol": false,
    "maxInputTokens": 1000000,
    "maxOutputTokens": 393216,
    "reasoning": {
      "supportedEfforts": ["low", "high"]
    }
  },
  {
    "id": "auto",
    "name": "Auto",
    "vendor": "Custom",
    "url": "http://192.168.100.63:4000/v1",
    "apiKey": "<用户提供的 API Key>",
    "supportsToolCall": true,
    "supportsImages": true,
    "supportsReasoning": true,    // v1.8 实测：auto 支持思考（默认开启）
    "useCustomProtocol": false,
    "maxInputTokens": 1000000,
    "maxOutputTokens": 393216,
    "reasoning": {
      "supportedEfforts": ["low", "high"]
    }
  }
]
```

> ⚠️ WorkBuddy 的 `supportsImages` 对应图像输入（**两个模型实测都能识图**）；视频/音频输入若 WorkBuddy 不支持按需移除。`vendor` 必须为 `"Custom"`。

---

## 7. 关键约束（不要改动；与用户确认/API 实测不符时以实测为准）

| 项目 | deepseek-v4-flash | auto |
|------|-------------------|------|
| 思考模式 | `none`（关闭）/ `low` / `high`（**推荐三档**；代理另接受 `medium`/`max`） | **支持思考，默认开启**；`none`/`low`/`high` 生效（v1.8 实测） |
| `none` 变体 | `thinking: {type: "disabled"}` 或 `reasoning_effort:"none"`（**实测均能真正关闭思考**）；DSH：`off:` 空声明 | 同左（实测有效） |
| `low` / `high` 变体 | `reasoningEffort: "low"/"high"`（DSH：`low: low` / `high: high`） | 同左（实测生效） |
| 上下文长度 | 1M (1,000,000) | 1M (1,000,000) |
| 输出长度 | **393216**（API 实测 =384×1024） | **393216**（API 实测 =384×1024，原口头 128k 作废） |
| 输入模态 | text **+ image**（v1.8 实测可识图） | text / image / video / audio（**DSH 侧仅 text / image**） |
| 输出模态 | text | text |
| 能力 | 工具调用 / 结构化输出 / 温度 / 深度思考 | 工具调用 / 结构化输出 / 流式 / 深度思考 / 联网搜索 / cache（后两者代理侧） |
| 思考链字段 | `reasoning_content`（实测） | `reasoning_content`（实测，默认返回） |

> ⚠️ **v1.8 实测勘误汇总（2026-08-19）**：
> - **输出长度**：两模型 `max_output_tokens` 均 **393216**（=384×1024）。flash 早期 384000（=384×1000）、auto 早期 131072（口头 128k）**均已作废**，一律以实测为准（§5 有实测命令）。
> - **思考**：`auto` 实测**支持思考且默认开启**（推翻旧记录）；`thinking:{type:"disabled"}` 与 `reasoning_effort:"none"` **均能真正关闭**思考链（修正旧「无法完全关闭」说法）。
> - **档位**：代理实测**接受 `medium`/`max`**（flash 传这两档均 200 + 思考链）——「仅 none/low/high」是**本文档使用约定**，客户端（如 opencode）可能因此暴露更多档位，属预期。
> - **模态**：**两个模型实测都能识别图像**（flash 原声明仅文本，实测不符）。

---

## 8. 写入配置后的步骤（必须验证）

1. **实测确认参数（写入前/后都建议做）**：按 §5 的实测命令请求 `/v1/models`，核对 `max_input_tokens`/`max_output_tokens`，**以实测值写入并复核配置**（不要沿用文档推荐值）。
2. **校验配置**：opencode 用 `ConvertFrom-Json`；DSH 用 `js-yaml`；WorkBuddy 用 `JSON.parse()` 校验。
3. **验证连接**：请求 `http://192.168.100.63:4000/v1/models`（带 `/v1`），确认返回包含 `deepseek-v4-flash` 与 `auto`。
4. **按客户端告知生效方式**：opencode 重启；DSH 无需重启（刷新 Models 页）；WorkBuddy 刷新/重启。
4. 分别对两个模型请求 `/v1/chat/completions` 做最小探测（请求体 JSON 需无 BOM，见 §10）。

---

## 9. 官方资料速查（配置前先查，防参数错误）

### 9.1 Agent 官网（查「自定义供应商配置格式」）

| Agent | 官网 / 文档 |
|---|---|
| DeepSeek Harness | 官方仓库 https://github.com/deepseek-ai/DeepSeek-Harness ；**Providers 配置指南** https://github.com/deepseek-ai/DeepSeek-Harness/blob/master/docs/user/guide/providers.zh.md |
| opencode | https://opencode.ai/docs/ ；GitHub: https://github.com/sst/opencode |
| WorkBuddy（腾讯） | https://www.workbuddy.cn/docs/ |
| Codex（OpenAI） | https://developers.openai.com/codex/ ；GitHub: https://github.com/openai/codex |

### 9.2 模型厂商官网（查「模型参数」：ID / 上下文 / 输出上限 / 思考档位）

| 模型 | 官网 / 文档 |
|---|---|
| DeepSeek | https://platform.deepseek.com/ 、API 文档 https://api-docs.deepseek.com/ |
| Kimi（月之暗面） | https://platform.kimi.com/docs/ |
| GLM（智谱） | https://docs.bigmodel.cn/ |
| Qwen（阿里百炼） | https://help.aliyun.com/zh/model-studio/ |
| Mimo（小米） | https://mimo.mi.com/ |

> **用法**：配置前打开对应行 → 查「模型列表 / models」页确认模型 ID、context、max output、推理档位、模态；**参数与官网不符时以官网为准**。

---

## 10. 注意事项与坑

- **请求路径必须带 `/v1`**（curl/Invoke-RestMethod 不会自动补；opencode 的 AI SDK 会自动补）。
- **PowerShell 写 JSON 请求体必须无 BOM**（PS 5.1 `Out-File -Encoding utf8` 带 BOM → LiteLLM 400；用 `New-Object System.Text.UTF8Encoding($false)` 或 `curl.exe --data-binary "@file"`）。
- **最小探测示例（curl，无 BOM）**：
  ```powershell
  $payload = '{"model":"auto","messages":[{"role":"user","content":"ping"}],"max_tokens":16}'
  $tmp = "$env:TEMP\dsh-probe.json"
  [System.IO.File]::WriteAllText($tmp, $payload, (New-Object System.Text.UTF8Encoding($false)))
  curl.exe -s -X POST "http://192.168.100.63:4000/v1/chat/completions" `
    -H "Authorization: Bearer <API Key>" -H "Content-Type: application/json" `
    --data-binary "@$tmp"
  ```
  探测时正常响应含 `choices[0].message.reasoning_content`（思考链字段）——**两个模型都会返回**（v1.8 实测：`auto` 默认也思考）。
- **🔴 v1.8 实测修正：`auto` 支持思考（推翻旧记录）**：实测 `auto` 不传参数时**默认返回思考链**，`reasoning_effort=low/high` 生效，`thinking:{type:disabled}` 或 `reasoning_effort=none` 可关闭。客户端配置：opencode `reasoning: true` + variants(none/low/high)；DSH `reasoningEfforts: {off, low, high}`；WorkBuddy `supportsReasoning: true` + `supportedEfforts: ["low","high"]`。
- **🔴 关闭思考有效（v1.8 实测）**：`thinking:{type:"disabled"}` 与 `reasoning_effort:"none"` **均能真正关闭**思考链输出（无 `reasoning_content`）。早期「无法完全关闭思考链」的说法已过时。
- **🔴 代理接受 `medium`/`max`（v1.8 实测）**：「仅 none/low/high」是使用约定而非代理限制——flash 传 `medium`/`max` 均 200 + 思考链。客户端可能因此暴露更多档位（如 opencode 显示 max），属预期行为；如需严格限制，应由客户端配置或代理侧策略控制。
- **🔴 `deepseek-v4-flash` 实测能识图（v1.8 实测）**：`image_url` 输入（1×1 红色图）→ 正确答「红色」。原「仅文本」声明与实测不符，模态声明建议写 `text + image`。
- **DSH 沙箱写入需提权**：`~/.dsh/settings.yaml` / `.credentials.yaml` 在沙箱工作区外，写入需 `danger-full-access`。
- **WorkBuddy `models.json` 明文存 key**：不要提交到版本控制；与 ctai 条目隔离（见置顶声明）。
- **模态限制（v1.6 源码实测）**：**DSH 模态枚举仅 `text`/`image`**，video/audio 在 DSH 侧不可用（写入报 `settings-rejected`）；opencode/WorkBuddy 侧若要用 video/audio 需按各自官网声明并实测。
- **auto 与 litellm 中转的「auto」不是一回事**：本文档的 auto 是 vekenllm 代理直接暴露的模型（`192.168.100.63:4000`）；HANDOVER §16 litellm 方案的 auto 是本地中转（`127.0.0.1:4000`）的对外模型名，配置时注意 baseURL 区分。
