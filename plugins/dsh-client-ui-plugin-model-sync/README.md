# dsh-client-ui-plugin-model-sync

> **文档版本：v1.0**（2026-09-20 创建）—— 路径 P：按提供商刷新模型列表与参数，diff 预览后写入 settings.yaml。
> 状态：Host 半区最小激活入口 + Client 半区（官方 `settings.models.provider-card` slot）；单测 64 断言通过；真实数据验证通过。

## 它解决什么

dsh 的模型目录来自打包在 `@earendil-works/pi-ai` 里的**冻结** catalog：官方新增或改名模型后，
不升级 npm 包就看不到；而「获取可用模型」在路由名命中内置 catalog 时**根本不联网**，
且返回的候选只有 `id/name/contextWindow/maxTokens` 四个字段——**模态和推理档位传不回来**。

本插件在**每个提供商卡片**上加一组同步控件，补上这条链路：

| 步骤 | 做什么 | 走哪条通道 |
|---|---|---|
| 1. FETCH | 读该路由的配置，再从三个源取候选 | `remote.settings.describe` + 浏览器直连 models.dev/OpenRouter + `remote.llm.discoverModels` |
| 2. DIFF | 逐字段比对，标出手工锁定项与借用项 | 纯前端计算 |
| 3. APPLY | 一次路径寻址写入，带 revision 围栏 | `remote.settings.mutate` |
| 4. VERIFY | 回读 host 实际解析结果 | `remote.settings.describe` |

## 为什么 Host 半区几乎是空的

数据面**完全跑在官方 Remote 命名空间上**，所以本插件不自建 HTTP 路由，也不自建 remote：

- **写入**用 `remote.settings.mutate(ns, ops, expectedRevision)`。用路径寻址（`op:"set"` 到
  `["providers", <route>, "models"]`）而不是整体 `replace`——官方注释明确警告：
  用被 redact 过的 view 重建整个 section 会**静默删掉所有没随 wire 返回的 secret 字段**。
- **端点探测**用 `remote.llm.discoverModels`，**不带 apiKey**，让 host 侧从凭据存储解析，
  浏览器全程不接触密钥。
- **元数据**由浏览器直接 fetch：models.dev 与 OpenRouter 都返回
  `access-control-allow-origin: *`（已实测），因此不需要 host 中转。
- **验证**用 `describe()` 回读——它返回的 `value` 是 host 解析后的完整值
  （schema defaults → composition base → user layer），足以证明"写进去了"和"生效了"是两件事。

Host 半区因此只保留一个空的 `apply`：它的存在只是为了让 loader 激活该插件
（客户端 registry 会跳过 host fiber 缺失的条目）。

## 候选优先级

```
端点实测  → 决定"哪些 id 真的可用"+ 容量（权威）
models.dev → provider 级匹配（baseURL 优先，env 兜底）→ 模态 / reasoning 档位 / 容量兜底
OpenRouter → 仅补模态
```

**全局兜底与 `borrowed` 保护**：`vekenllm`（内网 LiteLLM）和 `ctai` 这类自建/中转网关
**不在 models.dev 里**，provider 级匹配必然失败。此时按**同名模型**从 models.dev 全库借元数据，
但一律打 `borrowed` 标记并**默认不勾选**。

> 真实踩到的坑：`vekenllm/auto` 这个**自定义路由名**在 models.dev 里撞上了一个无关的 `auto`
> （ctx=32000），而本机正确配置是 1M 上下文 + 图像。没有 `borrowed` 保护就会拿错误值覆盖正确配置。

## 与路径E（模型能力）的关系

两者数据源不同、职责不重叠，可共存：

- 路径E `dsh-client-ui-plugin-model-capabilities`：**只读展示**当前 Host 注册表里每个模型的能力（含模态）。
- 路径P（本插件）：**可写同步**——拉候选、比差异、写回 settings。

路径E 的 host 路由 `/plugin-model-capabilities/list` 是 `resolveModelInfo` 的深度读口；
本插件刻意不依赖它（保持自包含），代价是验证深度止于 `describe()`。

## 构建与安装

```powershell
node build.mjs                                  # config.json -> lib/client.js
node model-sync.test.mjs                        # 64 个断言
node verify-live.mjs                            # 真实 models.dev 数据端到端
node scripts\setup-plugins.mjs                  # 在仓库根：装入 $DSH_HOME
```

改 `config.json` 后必须重跑 `build.mjs` 并重装；host 半区改动需完全重启 dsh web，
client bundle 改动刷新页面即可。

## 配置

```json
{
  "sources": { "modelsDev": "https://models.dev/api.json", "openRouter": "https://openrouter.ai/api/v1/models" },
  "settingsNamespaces": ["llm-pi-ai"],
  "metadataTimeoutMs": 20000,
  "maxCandidates": 2000
}
```

`settingsNamespaces` 决定往哪些 settings 命名空间的提供商卡片上挂控件（keyed slot 的 key）。

## 已知限制

1. **验证深度**：`describe()` 证明配置被接受且解析正确，但不证明模型在网关上真的能跑；
   `resolveModelInfo` 的深度回读不在客户端 Remote 能力集里（见 HANDOVER 路径 P 的 spike 结论）。
2. **不自动删除**：候选没提到的已存模型标为 `kind: "missing"`，不会自动移除。
3. **不自动定时**：没有后台轮询。dsh 的设计里 `settings.yaml` 是唯一真相源，静默改写在安全上不可接受。
4. **模态词表**：只认 `text`/`image`（dsh 的 `ModelModalityMap`），audio/video/pdf 会被丢弃。
5. **provider-card slot 需要官方 `dsh-client-ui-settings-models` 声明**；该 seat 无注册者时不渲染。
