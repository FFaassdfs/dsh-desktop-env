# dsh-client-ui-plugin-provider-presets

> **文档版本：v1.1**（2026-09-23 更新）—— 修掉一个**真 bug**：`settings.models.footer` 是 **list** 座位，契约要求必填 `id`；首版只传 `{name}` → 注册被拒 → 面板**静默不渲染**（两台机器上都复现）。补「座位契约」一节与对应测试断言（§38）。
> v1.0（2026-09-23 创建）—— 路径 Q：把供应商（provider）**预制**出来，随插件分发；GUI 内一键启用/停用，密钥由用户就地输入。
> 状态：Host 半区最小激活入口 + Client 半区（官方 `settings.models.footer` slot）；单测 **184 断言** + SSR 冒烟 **19 断言** 全通过；预置已通过**宿主自己的 pi-ai schema** 校验。

## 它解决什么

`llm-pi-ai` 的 provider 配置是**数据**，不随任何包分发：一台新机器（尤其是便携包解压后的机器）打开「设置 → 模型」是空的，得手工敲 baseURL、协议、compat 和每个模型的上下文/输出/模态/推理档位——**敲错一个字段就是 `settings-rejected`**。

本插件把「供应商定义」变成**随包携带的预置**：

- 预置里只有**非机密**内容（`route` / `displayName` / `apiKeyEnv` / `api` / `baseURL` / `compat` / `models`）；
- 「启用」= 官方 `settings.mutate` 把该 route profile 写进 `~/.dsh/settings.yaml`；
- 「停用」= 同一个 seam 的 `unset`，把该路由整条移除；
- **密钥永远不由本插件、脚本或发行包经手**：用户在面板里输入，走官方 `credentials.set`（只写通道），落进凭据引用 `<ROUTE>_API_KEY`。

因此「预制」的语义是：**配置先就位，密钥按需再给**。密钥未配时，该供应商行在官方 Models 页显示红点（凭据缺失），**不是报错**；填上 key 即变绿可用。

## 内置预置（config.json）

| route | 显示名 | 端点 | 协议 | 模型 | 凭据引用 |
|---|---|---|---|---|---|
| `vekenllm` | vekenllm | `http://192.168.100.63:4000/v1` | openai-completions | `deepseek-v4-flash`、`auto` | `VEKENLLM_API_KEY` |
| `ctai` | 电信算力 | `https://ai.ctaigw.cn/v1` | openai-completions | `glm-5.3-flash`、`qwen3.8-flash`、`deepseek-v4.1-flash` | `CTAI_API_KEY` |

`vekenllm` 是**内网**地址，只有能访问该内网时可用；`ctai` 公网可达。两者是**完全独立**的供应商，端点与密钥互不通用。

## 为什么 Host 半区是空的

数据面**全部跑在官方 Remote 上**，因此不自建 HTTP 路由、不自建 remote：

| 动作 | 通道 |
|---|---|
| 读配置与 revision | `remote.settings.describe()` |
| 启用 / 重置 / 停用 | `remote.settings.mutate(ns, ops, revision)`——**路径寻址**（`set`/`unset` 到 `["providers", <route>]`） |
| 读密钥状态（永远拿不到值） | `remote.credentials.describe([refs])` |
| 写 / 清密钥 | `remote.credentials.set / unset` |

**为什么用路径寻址而不是 `settings.replace`**：跨 wire 的 view 是**被 redact 过的**，拿它重建整个 section 会**静默删掉所有没随 wire 返回的 secret 字段**（官方 seam 对自己的编辑器也是这么说的）。`set` 到一条路径只动那一条。

Host 半区只保留一个空 `apply`：它的存在只是让 loader 激活该插件（client registry 会跳过 host fiber 缺失的条目）。副作用是**本插件是目前 6 个插件里除 model-sync 外不依赖 `ctx.webServer` 的**，对 §24.5「官方 Desktop 不提供 webServer」的迁移评估是正面证据。

## 两条可写性属于两个 seam（踩过的坑）

- **profile 写入**受 `settings.describe().writable` 约束（设置提供方是否可写）；
- **密钥写入**受 `CredentialInfo.writable` 约束（凭据提供方是否可写），**与前者无关**：只读设置提供方不代表凭据不可写，反之亦然。

首版把两者混为一谈（密钥控件漏判只读、又错用了设置的 writable），被 `.work/provider-presets.test.mjs` 的受控-hook 渲染断言当场抓住。现在 `keyWritable(preset, snapshot)` 单独判定；引用状态**未知**时返回 `true`，把拒绝权交给知道更多的 host。

## 🔴 座位契约：list 座位必须带 `id`（v1.1 修的真 bug）

官方客户端注册表（`dsh-cordis-client-runner`）自带**每个座位的 `registerOptions` 契约**，注册时**缺 required 字段会被拒绝**——而且**页面上不报错、什么都不渲染**，属于最难查的一类：

| 座位 | kind | 必需字段 |
|---|---|---|
| `settings.models.provider-card`（「模型同步」插件用的） | **keyed** | `key` |
| `settings.models.footer`（本插件用的） | **list** | **`id`**（`order`/`label` 可选） |

首版只传了 `{ name }` → 注册被拒 → **面板在两台机器上都静默不出现**（而宿主侧一切正常：`dsh --profile web --dump-config` 能看到 `plugin-provider-presets` 条目、`update-plugins.ps1 -CheckOnly` 也显示"已是最新"）。修法：

```js
ctx.slots.register({ name: "settings.models.footer", id: "provider-presets" }, Panel)
```

> 教训：**注册前先从契约确认 required 字段**——契约可直接从注册表产物读出（`dsh-cordis-client-runner/lib/client.js` 里每个座位都有 `registerOptions: [{name, requirement, …}]`）。`.work/provider-presets.test.mjs` 已把这一步做成**断言**（读契约 → 断言我们提供了全部 required 字段），这类"静默不渲染"以后不会再靠肉眼发现。详见 `HANDOVER.md` §38。

## 防误伤的四个设计

1. **启用不覆盖**：路由不存在才给「启用」；已存在且**与预置不一致**时，只给「重置为预置」，且**两步确认**（先点变成「确认重置（覆盖）」）。
2. **停用要确认**：「停用」同样两步确认，因为它删的是整条配置（**密钥不受影响**）。
3. **不用 redact 过的 view 重建**（见上）。
4. **revision 围栏**：每次写入前**重新读一次** revision，因此只有"往返期间别人改过"才会被拒（`settings/conflict`），而不是自己拿了个陈旧值。

## 密钥形状校验与官方对齐

面板在提交前按官方 Models 页的同一套规则判密钥：`/^[\x21-\x7E]+$/`（可打印 ASCII，HTTP 头能带的字符集），并额外拒绝**粘贴的 `NAME=value` 环境行**与**成对引号包裹**的值；`NAME` 必须全大写（`sk-` 在连字符处断开）、`=` 后面不能紧跟另一个 `=`（避免把 `ABCD==` 这种 base64 padding 误判成赋值）。校验不通过就不发请求。

## 构建与安装

```powershell
node build.mjs                                   # config.json -> lib/client.js（含"预置不得含密钥"闸门）
node .work\provider-presets.test.mjs             # 180 断言
node .work\provider-presets-smoke.test.mjs       # 19 断言（真 react SSR）
node scripts\setup-plugins.mjs --plugins 6       # 在仓库根：装入 $DSH_HOME
pwsh -File scripts\update-plugins.ps1            # 已装机器上的更新
```

- **改预置 = 改 `config.json` → 重跑 `build.mjs` → 重装插件**。安装载荷只有 `package.json` + `lib/**`，`config.json` 不随包走（预置被 build 烘进 `lib/client.js`），所以没有"运行时读一个可能不存在的文件"这种事。
- `build.mjs` 是**唯一**能产出 bundle 的路径，它带一道闸门：预置里出现密钥形状的**字段名**或**值**（`key`/`token`/`secret`/`sk-…`/32 位以上无分隔串）就直接拒绝构建。
- host 半区改动需完全重启 dsh web；client bundle 改动刷新页面即可（dev:web 在跑时热更）。

## 配置

```json
{
  "settingsNs": "llm-pi-ai",
  "presets": [ { "route": "…", "title": "…", "summary": "…", "displayName": "…", "apiKeyEnv": "…", "api": "…", "baseURL": "…", "compat": {}, "models": [] } ]
}
```

- `route` 是 settings 的键，也是凭据引用的词干；`title`/`summary` 只用于面板显示，**不会写进 settings.yaml**。
- 新增一个预置 = 往 `presets` 里加一条；面板、菜单说明、安装链都不需要改代码。

## 测试覆盖（两套）

`.work/provider-presets.test.mjs`（180 断言）+ 五个 fake host 场景：

1. **纯函数**：profile 投影（只留 route profile 字段、**与 CONFIG 结构完全脱离**）、路径寻址 ops、drift 比对（乱序不算 drift）、密钥语法。
2. **两 Remote 数据面**：`readSnapshot` 正常路径 / 凭据 seam 故障降级（配置仍可写）/ 命名空间缺失拒绝。
3. **enable → verify → disable 往返**：fake host 按 seam 语义应用 path ops，断言"写进去=预置内容"、"另一条路由不受影响"、"陈旧 revision 被拒"、"没有任何配置动作碰过凭据"。
4. **行判定 + 受控-hook 渲染**：标签、可用动作、两步确认只武装对应那条路由、只读设置提供方禁用 profile 写入、不可写凭据禁用密钥控件、空密钥不可提交、失败快照显示错误而不是转圈。
5. **产物防护**：预置不含密钥形状字段；**把本机 `.credentials.yaml` 里所有凭据值拿去比对 `lib/client.js`**（不出现）；两份预置通过**宿主自己的 `@deepseek-ai/dsh-llm-pi-ai` Config schema** 校验，且 `off: null` 存活。

## 已知限制

1. **验证深度**：写入成功 = 官方 seam 接受且回读一致；**不代表模型在网关上真能跑**（需要真密钥 + 网络）。
2. **不自动启用**：装完是这个面板里的"未启用"。刻意如此——装个插件就偷偷改 `settings.yaml` 是不可接受的。
3. **不碰 `agent-default-model`**：预置只写 `providers.<route>`，不动默认模型。
4. **预置是快照**：模型清单/上下文是 2026-09-23 的实测值。要刷新用「模型同步」插件（路径 P，拉端点/models.dev 后写回）。
5. **client 半区生效以浏览器实视为准**：`/plugins/*/client.js` 在未认证请求下 404（认证围栏行为，不代表未加载），需重启壳后在「设置 → 模型」底部目视确认。
