# vekenllm 供应商配置说明（deepseek-v4-flash）

> **文档版本：v3.5**（2026-08-19 更新）
> 版本历史：v3.5（2026-08-19）**按全量实测修正**：①flash **实测能识别图像**（原声明仅文本）→ §5.1/§5.3/§6 模态改 `text + image`；②`thinking:{type:disabled}` 与 `reasoning_effort:"none"` **均能真正关闭思考链**（原 §11.1「无法完全关闭」已过时）；③代理**接受 `medium`/`max`**（「仅 none/low/high」是使用约定）；v3.4（2026-08-19）新增 WorkBuddy 完整配置章节（§5.3）+ 客户端表/关键约束/验证/踩坑同步 + 输出长度勘误 384000→393216（API 实测）；v3.3（2026-08-19）小修 §3.3 删除防误用 ctai 注记；v3.2（2026-08-19）新增置顶「🛑 独立供应商声明」vekenllm ≠ ctai；v3.1（2026-08-19）文件名带版本号 + 引用同步；v3.0（2026-08-19）重排为「先查官网再配置」11 章结构 + 新增 §8 官网速查表；v2（2026-08-19）新增两条强制询问 + 客户端差异表 + DSH 落地写法；v1（2026-08-19）初版。
> 更新约定：**任何 agent 修改本文件后，必须递增版本号（文件名 + 文件内版本块同步）并追加一行变更记录**（格式：`vX.Y（日期）内容`）。

> 面向**任何需要配置模型供应商的 agent** 的操作手册。严格按本文档流程执行，**配置前先查官方文档**（§2），**两条「必须先问用户」的强制步骤（§1.1）任何情况下都不得跳过**。

---

## 🛑 独立供应商声明（置顶必读，2026-08-19 新增）

> **`vekenllm` 是一个完全独立的模型供应商，与 `ctai`（电信算力中转）没有任何关系，配置时严禁混淆。** 两者的 baseURL、API Key、provider 键名全部不同，**绝不能**把 vekenllm 的配置写成 ctai、把 vekenllm 的 API Key 用在 ctai 上，或把 ctai 的模型挂到 vekenllm 名下。

### 1. 两个供应商的关键差异（一字不差地对照）

| 项目 | **vekenllm**（本文档主题） | **ctai**（电信算力中转，另一个供应商） |
|---|---|---|
| provider 键名 | `vekenllm` | `ctai` |
| Base URL | `http://192.168.100.63:4000`（内网 LiteLLM 代理） | `https://ai.ctaigw.cn/v1`（公网中转） |
| API Key | 独立 key，**配置前必须向用户询问**（§3.3） | 独立 key（ctai 环境专用） |
| 归属 | 集团内网自建代理 | 电信算力中转服务 |
| 模型 | `deepseek-v4-flash` 等 8 个（`/v1/models` 实测） | `kimi-k2.6` / `kimi-k2.7-code` / `kimi-k3` / `glm-5.2` / `deepseek-v4-pro` / `deepseek-v4-flash` 等 |
| 思考档位 | `deepseek-v4-flash` 仅 `none`/`low`/`high` | 按各模型自己的 variants 配置 |
| 本文档范围 | ✅ 本文档只描述 vekenllm | ❌ 不在本文档范围，配置 ctai 请另行处理 |

### 2. 最容易搞混的两个陷阱

1. **⚠️ `ctai-*` 前缀的模型 ID ≠ ctai 供应商**：vekenllm 的 `/v1/models` 返回列表里包含 `ctai-deepseek-v4-flash`、`ctai-kimi-k3` 等 `ctai-` 前缀模型（见 §10）——**这些模型仍然通过 vekenllm 的 baseURL 访问、用 vekenllm 的 API Key**，只是模型 ID 带 `ctai-` 前缀，**绝不代表要切换到 ctai 供应商或 ctai 的 API Key**。
2. **⚠️ 两边都有 `deepseek-v4-flash` / `kimi` 等同名模型**：vekenllm 与 ctai 的模型列表存在同名（如 `deepseek-v4-flash`），配置时必须靠 **provider 键名 + baseURL + API Key 三者共同确认**到底配置的是哪一个供应商，绝不能只看模型名。

### 3. 防混淆红线（违反即配置错误）

- ❌ 禁止把 vekenllm 的 `baseURL`（`192.168.100.63:4000`）写成 ctai 的 `ai.ctaigw.cn`。
- ❌ 禁止用 ctai 的 API Key 访问 vekenllm（会 401 或鉴权失败）。
- ❌ 禁止把 vekenllm 的模型写进 `provider.ctai` 节点，或把 ctai 模型写进 `provider.vekenllm` 节点。
- ❌ 禁止把 `ctai-*` 前缀模型误判为「属于 ctai 供应商」而切换 baseURL/API Key。
- ✅ 正确姿势：**写入配置前，与用户逐项确认**「供应商名 = `vekenllm`、Base URL = `http://192.168.100.63:4000`、API Key = 本次用户提供的值」（§3.3 步骤 3 已列）。

---

## 1. 文档使用约定（agent 开工前必读）

### 1.1 两条强制询问（不可跳过）

| # | 时机 | 内容 |
|---|------|------|
| ① | **配置开始前** | 向用户询问 **API Key**，禁止使用示例值或历史遗留值（§3.3） |
| ② | **拿到 `/v1/models` 模型列表后** | 向用户展示**全部模型**并询问是否探索/接入其他模型，**得到明确答复后才允许写入配置**（§9）——禁止默认只配 deepseek-v4-flash 就完事 |

### 1.2 配置前必须查官方文档（防参数错误）

**任何 agent 动手前，先查看「目标 agent」和「目标模型」的官方文档**，核对：provider 配置格式、模型 ID、上下文长度、输出上限、思考档位、能力标志。**模型参数以官网为准，本文档只是经验值参考**（§8 官网速查表）。

### 1.3 目标客户端（动手前先确认）

向用户确认目标客户端是哪个，再按对应小节写入：

| 客户端 | 配置文件 | provider 声明 | baseURL 写法 | 密钥存放 | 生效方式 |
|---|---|---|---|---|---|
| **opencode** | `opencode.json` | `provider.vekenllm` + `npm: @ai-sdk/openai-compatible` | **不带** `/v1`（AI SDK 自动补） | `options.apiKey` 字段 | 重启 opencode 生效 |
| **DSH harness** | `~/.dsh/settings.yaml` | `llm-pi-ai.providers.vekenllm` + `api: openai-completions` | **必须带** `/v1`（pi-ai 用 OpenAI SDK 不自动补） | `~/.dsh/.credentials.yaml` 的 `<ROUTE>_API_KEY`，settings 只写 `apiKeyEnv` 引用 | 动态生效，**无需重启** |
| **WorkBuddy** | `~/.workbuddy/models.json`（Windows: `C:\Users\<用户名>\.workbuddy\models.json`） | `vendor: "Custom"`（**不能填 `vekenllm`**，否则 WorkBuddy 不识别） | **必须带** `/v1` | `apiKey` 字段（**明文**存入 json） | 刷新模型选择器，或重启 |
| **Codex 等** | 见各自官网（§8） | — | — | — | — |

> 本文档提供 opencode（§5.1）、DSH（§5.2）、WorkBuddy（§5.3）的完整示例；**其他客户端按 §2.2 查官网后自行套用**。再次强调：供应商声明一律是 **`vekenllm`**（WorkBuddy 侧为 `vendor: "Custom"` + vekenllm 的 URL/key），与 ctai 无关（见置顶声明）。

---

## 2. 配置流程总览（按序执行，勿跳步）

```
Step 0  确认目标客户端（opencode / DSH / 其他）
   ↓
Step 1  查官方文档：目标 agent 的 provider 配置格式 + 目标模型的参数（§2.2 / §8）
   ↓
Step 2  【强制询问①】向用户要 API Key（§3.3）
   ↓
Step 3  测试两个地址连通性 + /v1/models 模型列表（§4）
   ↓
Step 4  【强制询问②】展示全部模型，询问是否探索/接入其他模型（§9），等用户答复
   ↓
Step 5  与用户确认最终参数（供应商名=vekenllm / BaseURL / 模型 ID / API Key）后写入配置（§5）
   ↓
Step 6  校验配置 + 验证连接 + 按客户端告知生效方式（§7）
```

### 2.1 流程图例

- 🔒 = 强制询问用户（§1.1 两条）
- 📖 = 查官网（§2.2）
- ✅ = 必须验证（§7）

### 2.2 如何查官方文档（具体做法）

1. **目标 agent 官网**（§8 表格「Agent 类」）→ 找「Providers / Models / Configuration」章节，确认该 agent 声明自定义供应商的字段格式（如 opencode 的 `provider` 节点、DSH 的 `llm-pi-ai.providers`）。
2. **目标模型官网**（§8 表格「模型类」）→ 核对模型 ID、上下文长度、输出上限、思考档位（reasoning 档位集合）、能力标志（tool_call / structured_output / temperature）。
3. 将官网参数与本文档 §6「关键约束」对照：**不一致时以官网为准，并向用户说明差异**。

---

## 3. 配置前准备

### 3.1 确认目标客户端

向用户确认：**opencode 还是 DSH harness，还是其他 agent**（WorkBuddy / Codex 等）。按 §1.3 表格落到对应配置文件。

### 3.2 查官方文档（防参数错误，必做）

按 §2.2 查「目标 agent 官网 + 目标模型官网」，核对配置格式与模型参数。**不要凭记忆写参数**。

### 3.3 🔒 必须主动询问 apikey（强制询问①）

1. 配置开始前，**先向用户询问 API Key**，禁止使用示例值或历史遗留值。
2. 将拿到的 apikey 填入对应配置的密钥字段（opencode 的 `options.apiKey`；DSH 的 `.credentials.yaml`）。
3. 向用户确认以下信息无误后再写入配置：
   - 供应商名称：`vekenllm`（**不是 `ctai`**）
   - Base URL：`http://192.168.100.63:4000`（或用户确认的备用地址，见 §4）
   - 模型 ID：`deepseek-v4-flash`
   - API Key：`<用户提供的值>`

---

## 4. 网络环境与地址选择

该供应商在不同网络环境有不同连接地址，配置前**必须先测试连通性**：

| 地址 | 服务对象 | 说明 |
|------|---------|------|
| `http://192.168.100.63:4000` | 集团大楼内网 | 主要地址，默认优先 |
| `http://192.168.15.137:4000` | 维科技术 | 备用地址 |

**配置流程：**

1. **先测试两个地址的连通性，并检查各地址是否配置了模型**，用拿到的 apikey 请求 `/v1/models`：
   ```powershell
   $key = "<用户提供的 API Key>"
   Invoke-RestMethod -Uri "http://192.168.100.63:4000/v1/models" -Headers @{ Authorization = "Bearer $key" }
   Invoke-RestMethod -Uri "http://192.168.15.137:4000/v1/models" -Headers @{ Authorization = "Bearer $key" }
   ```
   - 连通性指请求是否成功返回；**模型配置**指返回的 `data` 列表是否包含 `deepseek-v4-flash` 等模型。
   - 两个地址可能在连通性上相同，但**一个地址上配置了模型、另一个没有**，需要分别检查。
2. 若**两个地址均可连通且都配置了模型**：**请用户确认使用哪一个**，再写入对应 `baseURL`。
3. 若某地址可连通但**没有配置任何模型**：**明确向用户说明**该地址未配置模型，并**建议用户选择有配置模型的地址**。
4. 若仅一个地址可连通且有模型：使用该地址，并告知用户。
5. 若均不可连通或均无模型：**不要写入配置**，向用户报告并确认 apikey/地址是否正确。
6. 🔒 **（强制询问②，拿到列表后立即执行）** 无论选哪个地址，只要 `/v1/models` 成功返回，就**把返回的全部模型 ID 展示给用户**，并**询问是否探索/接入其他模型**（见 §9，含 `ctai-*` 风险提示）。**必须等用户明确答复（接入哪些/都不接入）后才允许写入配置**——禁止在拿到列表后跳过询问直接写 deepseek-v4-flash。

> 实测记录（测试日期：2026-08-19）：
> - `192.168.100.63:4000` ✅ 连通，返回全部 8 个模型。
> - `192.168.15.137:4000` ⚠️ 服务在线（LiteLLM swagger 与 `/health/liveliness` 正常），但用当前 apikey 访问 `/v1/models` 返回 **401 未授权**，需用户提供该环境对应的 apikey 或确认配置。

---

## 5. 写入配置（按目标客户端选一节）

### 5.1 opencode：写入 opencode.json 的 `provider` 节点

> 🔴 **provider 键名必须是 `vekenllm`**，与 ctai 供应商（`provider.ctai`）是完全不同的节点，两者互不相干（见置顶声明）。

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
          "attachment": true,          // v3.5 实测：flash 也能识图
          "reasoning": true,
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "structured_output": true,
          "temperature": true,
          "modalities": {
            "input": ["text", "image"],   // v3.5 实测：flash 能识别图像
            "output": ["text"]
          },
          "limit": {
            "context": 1000000,
            "output": 393216
          },
          "cost": {
            "input": 0.14,
            "output": 0.28,
            "cache_read": 0.0028
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

### 5.2 DSH harness：写入 `~/.dsh/settings.yaml` 的 `llm-pi-ai` 分节

> 2026-08-19 实机配置验证通过。差异要点：协议字段是 `api`（非 `npm`）、`baseURL` 必须带 `/v1`、密钥单独存 `.credentials.yaml` 并以 `apiKeyEnv` 引用、思考档位用 `reasoningEfforts`（`off` 空声明 = `thinking: {type:"disabled"}`）、无需重启。**provider 键名必须是 `vekenllm`（不是 `ctai`）**。

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
          reasoningEfforts:
            off:
            low: low
            high: high
```

对应密钥写入 `~/.dsh/.credentials.yaml`（DSH 的凭据文件，**明文不进入 settings.yaml**）：

```yaml
VEKENLLM_API_KEY: <用户提供的 API Key>
```

### 5.3 WorkBuddy：写入 `~/.workbuddy/models.json` 的模型条目

> 2026-08-19 WorkBuddy 实机配置验证通过。两种配置方式：**① UI**（设置 → 模型管理 → 添加自定义模型 → 选 Custom）；**② 直接编辑** `~/.workbuddy/models.json`（Windows: `C:\Users\<用户名>\.workbuddy\models.json`）。
> ⚠️ WorkBuddy 字段命名与 opencode/DSH 完全不同：用 `url`（不是 `baseURL`）、`vendor`（不是 `provider`）、`supportsToolCall`（不是 `tool_call`）、`maxInputTokens`/`maxOutputTokens`；`reasoning.supportedEfforts` 是**字符串数组**（不是 DSH 的 key-value 对，也不是 opencode 的 variants 对象）。**`vendor` 必须填 `"Custom"`，不能填 `vekenllm`**，否则 WorkBuddy 不识别。

```jsonc
{
  "id": "deepseek-v4-flash",
  "name": "DeepSeek V4 Flash",
  "vendor": "Custom",
  "url": "http://192.168.100.63:4000/v1",   // 带 /v1，与 DSH 一致
  "apiKey": "<用户提供的 API Key>",            // ⚠️ 明文存入 json（见 §11.4 安全提示）
  "supportsToolCall": true,
  "supportsImages": true,                     // v3.5 实测：flash 也能识图
  "supportsReasoning": true,
  "useCustomProtocol": false,                 // OpenAI 兼容协议
  "maxInputTokens": 1000000,
  "maxOutputTokens": 393216,                  // API /v1/models 实测值（见 §6 勘误）
  "reasoning": {
    "supportedEfforts": ["low", "high"]       // none=关闭思考，不列入数组
  }
}
```

### 5.4 其他客户端（Codex 等）

按 §2.2 **先查该 agent 官网**确认自定义供应商声明格式，再套用 §6 的模型参数。常见做法：Codex 用 `~/.codex/config.toml` 的 `model_providers`（详见官网）。**无论哪种客户端，供应商声明一律是 `vekenllm`、baseURL 一律用 `http://192.168.100.63:4000`（ctai 地址与此无关）**。

---

## 6. 关键约束（不要改动；与官网核对后如有差异，以官网为准并向用户说明）

| 项目 | 值 | opencode 说明 | DSH 说明 | WorkBuddy 说明 |
|------|-----|------|------|------|
| 思考模式 | `none` / `low` / `high` | 推荐这三个 variants；**代理另接受 `medium`/`max`**（v3.5 实测），「仅三档」为使用约定 | `off`/`low`/`high` | `reasoning.supportedEfforts: ["low","high"]`（数组，**不含 none**；none=关闭思考） |
| `none` 变体 | `thinking: {type: "disabled"}` 或 `reasoning_effort:"none"` | 官方 OpenAI 格式，关闭思考模式；**v3.5 实测两者均能真正关闭**思考链 | `reasoningEfforts: off:`（空声明） | 关闭思考：不设 `supportsReasoning` 或设为 `false` |
| `low` / `high` 变体 | `reasoningEffort: "low" / "high"` | camelCase，AI SDK 自动转 `reasoning_effort` | `low: low` / `high: high` | 数组元素直接作为档位 |
| 上下文长度 | 1000000 (1M) | `limit.context` | `contextWindow` | `maxInputTokens: 1000000` |
| 输出长度 | **393216**（API 实测；原参考 384000 有误，见下） | `limit.output` | `maxTokens` | `maxOutputTokens: 393216` |
| 模型能力 | `tool_call` / `structured_output` / `temperature` 均为 `true` | 同左 | 由 `openai-completions` 协议天然支持，无需声明 | `supportsToolCall: true` |
| 图片输入 | **支持**（v3.5 实测：`image_url` 可识别图像） | `attachment: true` + `modalities.input: ["text","image"]` | 条目级 `input: [text, image]`（DSH 枚举仅 text/image） | `supportsImages: true` |
| 思考链字段 | `interleaved.field = "reasoning_content"` | 同左 | `compat.thinkingFormat: deepseek` | 无需配置（OpenAI 兼容协议自动处理 `reasoning_content`） |

> ⚠️ **输出长度勘误（2026-08-19 实测）**：API `/v1/models` 返回 `max_output_tokens: 393216`（= 384×1024），文档早期参考值 **384000**（= 384×1000）与其差 9216。**配置一律以 API 实测值 393216 为准**（opencode §5.1 / DSH §5.2 / WorkBuddy §5.3 示例已同步为 393216）。
> ⚠️ **v3.5 实测修正（2026-08-19）**：①**flash 实测能识别图像**（原声明仅文本）；②`thinking:{type:"disabled"}` 与 `reasoning_effort:"none"` **均能真正关闭思考链**（原「无法完全关闭」说法已过时）；③代理**接受 `medium`/`max`** 档位（「仅 none/low/high」是使用约定）。
> ⚠️ 上表其余数值是 vekenllm 代理实测/配置参考值。**配置任何模型前，先到该模型官网（§8）核对上下文/输出/思考档位，避免参数错误**。

---

## 7. 写入配置后的步骤（必须验证）

1. **校验配置**：opencode 用 `ConvertFrom-Json`（或等效工具）确认 JSON 合法；DSH 用 YAML 解析器（如 `js-yaml`）确认 `settings.yaml` 合法；WorkBuddy 用 `JSON.parse()` / `node -e` 校验 `models.json` 合法。
2. **验证连接**：用拿到的 apikey 请求 `http://192.168.100.63:4000/v1/models`（注意带 `/v1`），确认返回包含 `deepseek-v4-flash`。**确认当前请求的是 vekenllm 地址、用的是 vekenllm 的 key**（见置顶声明）。
3. **按客户端告知生效方式**：
   - opencode：配置在启动时加载，需**退出并重启 opencode** 才生效。
   - DSH harness：settings 分节动态合并 + 凭据文件热重载，**无需重启**；刷新 Web GUI Models 页即可看到新路由。
   - WorkBuddy：刷新模型选择器即可看到新模型；若未出现，重启 WorkBuddy。
4. 请求 `/v1/chat/completions` 做最小探测验证模型可用（注意请求体 JSON 需无 BOM，见 §11.2）。

---

## 8. 官方资料速查表（配置前先查，防参数错误）

### 8.1 Agent 官网（查「自定义供应商配置格式」）

| Agent | 官网 / 文档 | 说明 |
|---|---|---|
| DeepSeek Harness | 官方仓库 https://github.com/deepseek-ai/DeepSeek-Harness ；**自定义供应商配置指南（Providers）**：https://github.com/deepseek-ai/DeepSeek-Harness/blob/master/docs/user/guide/providers.zh.md | 本机安装为 `@deepseek-ai/dsh`，配置在 `~/.dsh/settings.yaml`；**查官网时优先看 providers 指南** |
| opencode | https://opencode.ai/docs/ | 官方文档；GitHub: https://github.com/sst/opencode |
| WorkBuddy（腾讯） | https://www.workbuddy.cn/docs/ | 腾讯智能体（CodeBuddy 系）官方文档 |
| Codex（OpenAI） | https://developers.openai.com/codex/ | Codex CLI 官方文档；GitHub: https://github.com/openai/codex |

### 8.2 模型厂商官网（查「模型参数」：ID / 上下文 / 输出上限 / 思考档位）

| 模型 | 官网 / 文档 | 说明 |
|---|---|---|
| DeepSeek | https://platform.deepseek.com/ 、API 文档 https://api-docs.deepseek.com/ | 官方开放平台与 API 文档 |
| Kimi（月之暗面 / Moonshot） | https://platform.kimi.com/docs/ | Kimi 开放平台文档（OpenAI 兼容） |
| GLM（智谱 BigModel） | https://docs.bigmodel.cn/ | 智谱 AI 开放文档（HTTP API、模型列表） |
| Qwen（通义千问 / 阿里云百炼） | https://help.aliyun.com/zh/model-studio/ | 阿里云百炼 Model Studio 文档（DashScope API） |
| Mimo（小米） | https://mimo.mi.com/ | 小米 MiMo 开放平台 |

> **用法**：配置前打开对应行 → 查「模型列表 / models」页确认模型 ID、`context`（上下文）、`max output`（输出上限）、推理档位；**参数与官网不符时以官网为准**。

---

## 9. 🔒 探索并配置其他模型（接入可选，**询问强制**）

> **⚠️ 与文档其余部分不同，这一节的「接入」是可选、按需的；但「询问」是强制的（§1.1 强制询问②）**：只要 `/v1/models` 返回成功（§4 步骤 1 必做），就必须执行下面的询问。禁止跳过询问直接写 deepseek-v4-flash，也禁止未经询问主动把全部模型写入配置。

1. 使用 §4 步骤 1 已获得的 `/v1/models` 结果（不必重复请求），取全部模型 ID。
2. 🔒 **（强制）向用户展示全部模型 ID，并询问是否要探索/接入其他模型，以及具体接入哪些（多选）**。展示时注明 `ctai-*` 前缀模型为测试用途、且**仍属 vekenllm 访问路径**（见置顶声明 + §10）。**必须等用户明确答复后才继续**。
3. 若用户同意接入，对每个目标模型请求 `/v1/chat/completions` 做最小探测（见 §11.2 命令），确认可用性与思考链行为。
4. 按需写入配置时，同样需要向用户确认 apikey、模型 ID 与参数；模型配置参考 §5.1（opencode）或 §5.2（DSH）的 `deepseek-v4-flash` 结构，思考档位一律沿用 `none/off`、`low`、`high` 三档。**模型参数先到 §8.2 官网核对**。

---

## 10. ⚠️ 重要提醒：`ctai-` 前缀模型为临时测试用途（且仍属 vekenllm）

探测时若发现以下 `ctai-` 开头的模型 ID，请注意：

| 模型 ID | 说明 |
|---------|------|
| `ctai-deepseek-v4-flash` | 电信算力中转（测试） |
| `ctai-deepseek-v4-pro` | 电信算力中转（测试） |
| `ctai-kimi-k2.6` | Kimi K2.6（测试） |
| `ctai-kimi-k2.7-code` | Kimi K2.7 Code（测试） |
| `ctai-kimi-k3` | Kimi K3（测试） |
| `ctai-glm-5.2` | GLM 5.2（测试） |

- **这些 `ctai-*` 模型是当前测试用途，后期可能被取消**。
- **🔴 它们只是模型 ID 带 `ctai-` 前缀，访问路径仍是 vekenllm**（`http://192.168.100.63:4000` + vekenllm 的 API Key）——**不是**切到 ctai 供应商（`ai.ctaigw.cn` + ctai 的 key）。见置顶声明。
- 若要将它们写入配置，**必须提前向用户说明这一风险并征得同意**，且不建议作为默认/长期依赖模型。
- 建议优先使用 `deepseek-v4-flash` / `deepseek-v4-pro`（非 `ctai-` 前缀、由代理直接暴露的模型）。

---

## 11. 注意事项与坑

### 11.1 通用注意事项

- 该供应商为内网 LiteLLM 代理（uvicorn）。**v3.5 实测修正**：`thinking: {type:"disabled"}` 与 `reasoning_effort:"none"` **均能真正关闭思考链输出**（响应无 `reasoning_content`）；不传参数时默认返回思考链。早期「无法完全关闭」的说法已过时。
- **v3.5 实测补充**：①`deepseek-v4-flash` **能识别图像**（`image_url` 输入 1×1 红色图 → 正确答「红色」），模态可声明 `text + image`；②代理**接受 `medium`/`max`** 档位（HTTP 200 + 思考链），「仅 none/low/high」是使用约定而非代理限制——客户端（如 opencode）可能暴露更多档位属预期。
- 若用户未提供 apikey，**不要写入配置**，应再次向用户询问。
- **再次强调：vekenllm 与 ctai 是两个独立供应商**，API Key、baseURL、provider 键名互不通用（见置顶声明），配置时务必与用户逐项确认。
- 不要将该配置写入技能仓库或公开仓库（含 apikey 的配置文件属于敏感信息）。

### 11.2 探测命令的坑（2026-08-19 实机踩到）

1. **请求路径必须带 `/v1`**：用 `http://192.168.100.63:4000/v1/models`、`/v1/chat/completions`，不是 `/models` 或 `/chat/completions`（opencode 的 AI SDK 自动补 `/v1`，但 curl/Invoke-RestMethod 不会）。
2. **PowerShell 写 JSON 请求体必须无 BOM**：`Out-File -Encoding utf8`（PS 5.1 默认带 BOM）或 `[System.IO.File]::WriteAllText` 默认编码写出的文件带 BOM，LiteLLM 会报 `400 Invalid JSON payload: unexpected character`。用 `New-Object System.Text.UTF8Encoding($false)` 写入，或直接 `curl.exe --data-binary "@file"` 传参（2026-08-19 实测，`Invoke-WebRequest -InFile` 同样会带 BOM 而失败）。
3. **最小探测示例（curl，无 BOM）**：
   ```powershell
   $payload = '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"ping"}],"max_tokens":16}'
   $tmp = "$env:TEMP\dsh-probe.json"
   [System.IO.File]::WriteAllText($tmp, $payload, (New-Object System.Text.UTF8Encoding($false)))
   curl.exe -s -X POST "http://192.168.100.63:4000/v1/chat/completions" `
     -H "Authorization: Bearer <API Key>" -H "Content-Type: application/json" `
     --data-binary "@$tmp"
   ```
   正常响应含 `choices[0].message.reasoning_content`（思考链字段）。

### 11.3 DSH 专属注意（2026-08-19 实机配置验证）

- `~/.dsh/settings.yaml` 与 `~/.dsh/.credentials.yaml` 在沙箱工作区外：写入需提权（`danger-full-access`）。
- 凭据文件支持热重载（`watch: true`），settings 分节动态合并——**写入后立即生效，无需重启**；但若改动 `.env`/启动环境来源的凭据，需重启才生效。
- DSH 侧同样存在与 ctai 混淆的风险：`llm-pi-ai.providers` 下若同时配置了 `vekenllm` 与 `ctai`，两路由的 `apiKeyEnv` 必须各自独立（如 `VEKENLLM_API_KEY` / `CTAI_API_KEY`），baseURL 不得写串。

### 11.4 WorkBuddy 专属注意（2026-08-19 实机配置验证）

**安全提示（重要）**
- ⚠️ `~/.workbuddy/models.json` 将 API Key **明文存储**在 JSON 中（不像 DSH 用独立 `.credentials.yaml` + `apiKeyEnv` 引用，也不像 opencode 有凭据管理）。**该文件不要提交到任何版本控制仓库**。
- ⚠️ 该文件中可能同时存在多个供应商的条目（如当前已有 ctai + vekenllm），注意**按条目隔离**：每个模型的 `url` 与 `apiKey` 必须与它所属的供应商一一对应，不要互相串用（见置顶声明）。

**字段命名差异（与 opencode/DSH 完全不同，照抄会失效）**
- `url`（不是 `baseURL`）、`vendor`（不是 `provider`）、`supportsToolCall`（不是 `tool_call`）、`supportsImages`（不是 `attachment`）、`maxInputTokens`/`maxOutputTokens`。
- `reasoning.supportedEfforts` 是**字符串数组**（`["low","high"]`），不是 DSH 的 key-value 对、也不是 opencode 的 variants 对象；**none（关闭思考）不列入数组**。
- **`vendor` 必须填 `"Custom"`**，不能填 `vekenllm`，否则 WorkBuddy 不识别该模型。
- `url` 必须带 `/v1` 路径段（与 DSH 一致；opencode 的 AI SDK 会自动补，WorkBuddy 不会）。
