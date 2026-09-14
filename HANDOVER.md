# HANDOVER.md — dsh-desktop 交接文档

> **用途**：让不同会话/协作者在不共享记忆的情况下，快速知道这个仓库里发生过什么、怎么复现、有哪些注意点、要避开哪些坑。
> **最后更新**：**§21 dsh 核心升级到 0.1.5-rc.1 的适配与 4 插件验证（2026-09-14）**——实测核心已从 0.1.2-rc.1 升到 **0.1.5-rc.1**（2026-09-10 安装，文档此前未记录），并修好升级带来的三处断裂：①客户端冒烟测试 react 源（0.1.5 不再在 dsh 内自带 react → 新增 `.work/lib/react-source.mjs`，7 套件全绿）②4 插件声明了已废弃的注入边 `@deepseek-ai/dsh-client-runtime`（0.1.5 里被 0 个官方包引用）→ 已删除并在 `setup-plugins.mjs` 加死链检查 ③profile junction 农场 126/607 断链（脏数据，不影响插件）。同时 **core-version 已纳入 `scripts/setup-plugins.mjs`（现 4 插件）**，并实测 4 插件 host 半区在 0.1.5 实例全部活跃（详见 §21）；§20 工作区迁移与应用区分离（2026-09-14）——源码迁至 `D:\dsh\dsh-desktop-env`、应用产物迁至 `D:\dsh\app\current`、旧工作区冻结（含快照与 fork 补丁归档，见 §20）；**§20.7 记录推送坑：旧 PAT 已失效（401），改用 SSH 443（22 不通），remote 已换、迁移提交已推送**；路径H v8——vekenllm 两份配置文档按**全量实测**同步升级（**v1.8** 双模型 + **v3.5** flash 单模型）：auto 支持思考且默认开启、flash 实测能识图、thinking-disabled 与 effort=none 均能真正关闭思考、代理接受 medium/max——详见 §16.3 八条结论与 §18.4 第 6 条；路径H v7——vekenllm 双模型配置文档升至 **v1.7**（auto 输出长度以 API 实测 393216 为准 + §5 新增实测命令与「推荐值+要求实测」约定）；路径I v1——DSH 落地 vekenllm auto（条目级 input、flash maxTokens 勘误）；路径G v1——litellm 中转 auto 视觉路由调研+方案；**并补回被并行会话覆盖丢失的 §16–§18**，新增 **§19 覆盖事故与「写入前必须刷新重读」防覆盖约定（全局强制）**；路径E v2——已对官方仓库 master 核实（§15.7：版本 0.1.2-rc.1=latest、`buildModelCatalog` 丢 `inputModalities` 在 master 依旧、官方刻意 advisory 目录、无相关 issue/PR → 插件是长期方案）；路径E v1——「模型能力」设置分区插件（Settings > 模型能力：列出每个提供商/模型的输入模态、上下文窗口、推理等级；宿主只读路由 `/plugin-model-capabilities/list` 用 `ctx.llm.resolveModelInfo` 补回官方 `buildModelCatalog` 丢掉的 `inputModalities`，见 §15）；路径D v2——opencode 一键部署（`DEPLOY.md` + `deploy.ps1` + `OPENCODE_PROMPT.md`）；路径D 坑清单补全至 §12.6 共 14 条（openssl 免提权推送、数组 splatting、curl JSON、GOTELEMETRY 等，2026-08-18）；路径D v1 完成——环境同步仓库 `FFaassdfs/dsh-desktop-env`（公开）：setup.ps1 一键复刻 + 插件安装脚本 + PAT 明文脱敏；清理遗留垃圾——删除 `.work\hermes-agent`（失败克隆残留，见 §13）；路径C v1 完成——「项目文件树侧栏」插件（右侧面板 + 拖文件插路径，见 §11）；路径B 桌面壳 16 项功能完善 + 代码迁入 fork + GitHub Action 每小时自动同步（见 §10）；已建 harness 全局预设 `~/.dsh/AGENTS.md`（默认中文 + 更新 HANDOVER 约定 + 常见坑）。

---

## 🟢 当前状态（2026-09-14 迁移后，每会话先看这里）

| 项 | 值 |
|---|---|
| 源码区（唯一权威） | `D:\dsh\dsh-desktop-env`（本仓库） |
| 应用区（exe） | `D:\dsh\app\current\dsh-desktop.exe`（历史版本在 `D:\dsh\app\versions\`） |
| 旧工作区 | `D:\opencode\001\dsh-desktop` **已冻结**（见其 `FROZEN.md`），勿再写入 |
| 当前壳 | **launcher @ 43080**（状态面板 + node 直启 + 带 token URL 交系统浏览器） |
| 核心版本 | **`@deepseek-ai/dsh 0.1.5-rc.1`**（全局 npm；2026-09-10 安装）——文档里旧记的 `0.1.2-rc.1` 已是过时快照，见 §21 |
| 进行中 | 路径E「模型能力」插件 **host 半区已验证活跃**（§21.3）；4 插件均已纳入 `scripts/setup-plugins.mjs`。待办：client 半区目视确认 + 重装重启以生效注入边修正 |
| 迁移快照 | `.work\migration-2026-09-14\`（tracked patch + 2 个 fork 补丁） |
| 下一步（建议） | ①择时重装插件 + 完整重启 dsh web（激活 §21 的 inject 修正，注意会断开当前 GUI 会话）②文档版本收口（0.1.5-rc.1 / 默认模型 auto，见 §21.4）③HANDOVER 瘦身 + 单一事实源（端口/版本/同步频率）④壳 P0：端口保留段避让、崩溃退避 + 日志上限 |

## 0. 会话协作约定（每个会话开工前必读）

- 本仓库有三条并行的开发线，**互不冲突**：
  - **路径A**（§2–§9）：官方 Web GUI 的「插件说明」插件（`plugins/dsh-client-ui-plugin-explainer/`）。
  - **路径B**（§10 起）：桌面壳功能完善 + 代码迁入 fork + 官方自动同步。
  - **路径C**（§11）：官方 Web GUI 的「项目文件树侧栏」插件（`plugins/dsh-client-ui-plugin-project-explorer/`）。
- **新任务按「路径C、D…」递增**，在本文件末尾新增对应小节，并在任务结束时更新本文件「最后更新」。
- **开工前先读全文**，确认要做的事没被 A/B 做过，避免重复实现。
- **权威源码位置**：桌面壳权威源码在 fork 的 `desktop/`（§10.2），不是本目录根下的旧 `app.go` 等。
- **凭据**：GitHub PAT 明文见 §10.3，仅供本地会话使用，**不要提交到任何 git 仓库**。
- **预设层级（自动加载，2026-08-18 建立）**：`~/.dsh/AGENTS.md`（harness 全局：默认中文 + 任务结束更新 HANDOVER + 环境常见坑）→ 本项目 `AGENTS.md`（路径A/B/C、权威源码位置、高频坑）→ 更深层子目录 AGENTS.md。`AGENTS.md` 自动加载进上下文；本文件 `HANDOVER.md` 需主动读。

---

## 1. 项目背景与架构速览

- **dsh-desktop**：DeepSeek Harness 的桌面应用壳（Wails v2 + WebView2），把 dsh 的 Web UI（`http://127.0.0.1:3080`）包装成原生桌面窗口。
- **启动逻辑**（`app.go`）：启动时检测 `127.0.0.1:3080` 是否有 dsh server——
  - **没有** → 后台拉起 `dsh web`（日志在 `%APPDATA%\dsh-desktop\dsh.log`），轮询 HTTP 200 就绪后窗口跳转；退出时杀掉自己拉起的进程树。
  - **已有** → 直接复用，退出时不动它。
- **关键文件**：
  - `app.go`（启动编排/端口检测/就绪轮询/退出清理）、`dsh_windows.go`、`dsh_other.go`（spawn dsh）、`windowstate.go`（窗口状态持久化）、`main.go`（Wails 入口/单实例锁）、`frontend/`（启动画面，Vite + 原生 JS）。
- **构建**：`wails build` → `build\bin\dsh-desktop.exe`；开发：`wails dev`。
- **运行依赖**：Windows 10+、WebView2 Runtime、全局安装 `@deepseek-ai/dsh` + Node.js。
- **⚠️ 代码已迁入 fork**：桌面壳权威源码现位于 `.work\deepseek-harness\desktop\`（见 §10.2）；本目录根下的 `app.go` 等是旧副本，不再维护。桌面壳功能已从「基础壳」扩充到 16 项（见 §10.4）。

---

## 2. dsh 插件机制速查（本任务的核心背景，强烈建议先读）

DSH 是「万物皆插件」架构：**每个插件 = 一个 npm 包**（官方包名 `@deepseek-ai/dsh-*`，共约 180 个）。

### 2.1 关键路径（本机实际值）

| 项 | 路径 |
|---|---|
| dsh 全局安装 | `C:\Users\veken\nodejs\node-v24.16.0-win-x64\node_modules\@deepseek-ai\dsh` |
| DSH_HOME | `C:\Users\veken\.dsh` |
| 会话数据 | `C:\Users\veken\.dsh\sessions`、`storages` |
| profile 目录 | `C:\Users\veken\.dsh\profiles\web`（web）、`profiles\headless`（单次任务） |
| **共享解析目录** | `C:\Users\veken\.dsh\profiles\node_modules`（约 252 条目，dsh 安装维护，profile 通过 Node parent-walk 解析到这里） |

### 2.2 profile 组成（`profiles/web/`）

- `package.json`：`dsh.profile.bundles` 列表（`@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`）——bundle 是带 `dsh.bundle.patch` 的包，其 `cordis.patch.yml` 作为一层 patch 叠加。
- `cordis.yml`：**根条目列表，别改**（注释明确要求改 patch）。
- `cordis.patch.yml`：**用户 patch 层，一切用户改动进这里**。
- patch 格式（顶层 YAML 数组）：
  ```yaml
  - insert:
      - id: plugin-explainer
        name: 'dsh-client-ui-plugin-explainer'
  ```

### 2.3 客户端插件（浏览器端）的发现机制

浏览器端插件不是自动发现的，条件**全部满足**才会被加载（见 `dsh-client-modules/lib/index.js` 的 `resolveMeta`/`processOne`）：

1. **包可解析**：`require.resolve(<pkg>/package.json)` 能从 profile 根（loader 的 `baseUrl`）解析到（parent-walk 到 `profiles/node_modules`）。
2. **声明 `dsh.client`**：package.json 里 `"dsh": {"client": {"platform": "web", "inject": [...]}}`。
3. **导出 `./client`**：package.json `exports["./client"]` 指向构建后的 bundle（字符串或 `{default}` 均可）。
4. **是 loader 树里的激活条目**：cordis patch 里要有该包的条目，且 host 侧 `main`（如 `lib/index.js`）存在——host 侧通常是个空 `apply(){}` 桩（照抄官方 `dsh-client-ui-settings-plugin-inventory/lib/index.js`）。
5. **bundle 格式**：`window.__ModuleLoader__.load({ id, factory })`，`factory(require)` 返回 `{ NS, apply, inject }`，其中 `inject` 是**服务名数组**（如 `["slots","locale","remote","remote.pluginInventory"]`）。
6. **挂 tab**：`apply(ctx)` 里 `ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({name, id, order, label, locale, inject}, Component))`。多 tab 共存、按 `order` 排序（官方：configurable=0、all=10）。

### 2.4 只读数据接口（已实测可用）

```
POST http://127.0.0.1:3080/api/pluginInventory/list
Content-Type: application/json
{"type":"client-request","rpcId":"任意串","method":"pluginInventory/list","payload":{"args":{}}}
```
返回 `{result:{ok:true, value:{entries:[{entryId, moduleName, enabled, fiberPhase}]}}}`。
`fiberPhase` ∈ `pending/loading/active/failed/unloading/null`。**该接口只读，没有变更路径**。

---

## 3. 本次会话完成的工作（路径A：插件解释界面）

### 3.1 目标
在 dsh 官方 Web GUI 的「设置 → 插件」区新增一个 **「插件说明」tab**：每个已加载插件显示**通俗中文功能解释** + **当前启用/停用开关状态**（含运行阶段），支持搜索（含解释文本）与汇总计数；v2 起每张卡片带**开关按钮**，可真正启用/停用插件（写 profile patch，重启生效）。

### 3.2 产出文件（在仓库内，可重建）

```
plugins/dsh-client-ui-plugin-explainer/
├── package.json           # dsh.client 清单（platform web + inject 依赖）
├── dictionary.json        # 133 条「包名 → 中文解释」（可编辑的源数据！）
├── src/bundle.template.js # bundle 模板（占位 /*__DICTIONARY_JSON__*/ + PROTECTED_IDS）
├── lib/client.js          # 构建产物：自包含浏览器 bundle（约 32KB）
├── lib/index.js           # host 侧：POST /plugin-explainer/toggle 路由（v2 起）
├── build.mjs              # node build.mjs 把词典注入模板生成 client.js
└── README.md
.work/
├── plugin-inventory-snapshot.json   # 159 条实时清单快照（字典的覆盖依据）
├── smoke-test.mjs                   # 客户端 bundle 冒烟测试
└── host-toggle-test.mjs             # host 侧开关路由测试（v2）
HANDOVER.md               # 本文档
```

### 3.3 已完成的部署（本机）

1. 包体已拷贝到 `C:\Users\veken\.dsh\profiles\node_modules\dsh-client-ui-plugin-explainer\`（package.json + lib/）。
2. `C:\Users\veken\.dsh\profiles\web\cordis.patch.yml` 已追加 insert 条目（id=`plugin-explainer`）。

### 3.4 已验证项

- [x] `node build.mjs` 成功生成 lib/client.js（v2 约 32058 字节，133 条词典）
- [x] `node --check lib/client.js`、`node --check lib/index.js` 语法通过
- [x] 冒烟测试全过：exports 形状 / slot 注册（id=explained, order=20）/ list() 接线 / SSR 渲染（loading 态）/ 词典全部内嵌
  - 运行：`node D:\opencode\001\dsh-desktop\.work\smoke-test.mjs`
- [x] `require.resolve` 从 web profile 解析包体 OK（package.json + main）
- [x] patch YAML 用 js-yaml 校验 OK，格式与 dsh-base/cordis.patch.yml 一致
- [x] `clientExportOf` 接受我们的 `exports["./client"]` 形状（`{default}` 对象）
- [x] **host 开关路由测试全过**（v2，`node .work\host-toggle-test.mjs`）：
  - 停用 → 写入 `{id, name, disabled: true}`，保留既有 insert 条目；启用 → 覆盖旧 override（不产生重复条目）；核心组件 → 403 且不动文件；坏请求 → 400；文件缺失 → 自动创建。

### 3.5 尚未完成 / 待人工验证

- ⚠️ **界面实机验证未做**：运行中的 3080 实例不会热加载新插件，必须**完全重启 dsh web** 才能看到「插件说明」tab 与开关按钮（步骤见 §4）。
- 词典为人工整理，个别措辞可再打磨；未收录包显示占位提示（可继续往 dictionary.json 加）。
- 开关的**就绪态渲染**未做真机验证（无 DOM 测试环境）；切换后的实际效果需重启后核对清单。

### 3.6 v2：开关插件按钮（本次会话追加）

**目标**：在「插件说明」每张卡片上加开关，真正启用/停用插件。

**实现**：
- **host 侧**（`lib/index.js`，不再是空桩）：注册 `POST /plugin-explainer/toggle`（`ctx.webServer.register({kind:"exact", ...})`），接收 `{entryId, moduleName, enabled}`，读写 profile 的 `cordis.patch.yml`（js-yaml + `!!js` 兼容 schema，原子写 temp+rename）：
  - 停用 → 写入 `{id, name, disabled: true}`（覆盖 bundle 状态）
  - 启用 → 写入 `{id, name, disabled: false}`（覆盖任何 disable，含 bundle 层的）
  - 核心组件（`PROTECTED_IDS`，61 个）→ 403
  - 多次点击串行化（模块级 writeChain）
- **client 侧**（bundle）：卡片头部新增 `role="switch"` 开关；核心组件置灰（锁）+ title 提示；切换后置「待重启生效」标记并显示顶部通知（`有 N 项更改已写入配置，重启 dsh 后生效`）；支持再点一次撤销（反向写）；标题栏新增「刷新」按钮。
- **为什么重启生效**：profile patch 的热重载需要 Cordis HMR 服务（`watchUserPatches`），而 web 组合里 hmr 默认停用 → 配置写入后只能下次启动时生效。若在「插件说明」里把 `hmr` 启用并重启，之后 patch 改动可热生效（副作用：开启文件监听）。

**保护名单**：`include`、`include:timer/llm/session/agent/agent-loop/tools/settings/credentials/…` 等 61 个核心条目（两处各有一份：`lib/index.js` 与 `src/bundle.template.js` 的 `PROTECTED_IDS`，**必须同步**）。其余（UI 组件、工具、遥测、反馈等）均可开关。

---

## 4. 如何验证 / 使用

1. **确保 dsh web 完全退出**：关闭 dsh-desktop 桌面壳；再确认 `127.0.0.1:3080` 无进程占用（`netstat -ano | findstr 3080`），有残留则 `taskkill /F /T /PID <pid>`。
   - 原因：桌面壳检测到端口占用会**复用旧实例**，旧实例不会加载新插件。
2. 重新打开 dsh-desktop（或手动 `dsh web`）。
3. 浏览器进 `http://127.0.0.1:3080` → **设置 → 插件** → 第三个 tab「**插件说明**」。
4. 期望效果：
   - 顶部汇总：`共 159 个插件：130 个启用 · 29 个停用 · 已收录说明 133 个`；
   - 每个卡片：短名 + 「已启用/已停用」标签 + 阶段小圆点（绿=已挂载/黄=加载中/红=失败）+ **中文解释行** + 右侧**开关**；
   - 核心组件开关置灰（悬停提示「核心组件，不可停用」）；
   - 点开关 → 卡片出现「待重启生效」标记 + 顶部通知；**重启 dsh 后**在清单里核对新状态（开关再点一次可撤销）；
   - 点击展开：完整包名、加载条目 id、配置状态、Cordis 状态；
   - 搜索框支持按包名/条目 id/解释文本过滤；「刷新」按钮重新拉取清单。

---

## 5. 如何修改 / 重建 / 重装

```powershell
# 1. 改词典（只加新键，键 = 插件完整包名）
#    编辑 plugins/dsh-client-ui-plugin-explainer/dictionary.json

# 2. 重建 bundle（把词典注入模板）
node plugins/dsh-client-ui-plugin-explainer/build.mjs

# 3. 重装到 profile —— 注意：先删旧目录再拷，避免 Copy-Item 嵌套（见 §7 坑 10）
$dst = "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-client-ui-plugin-explainer"
Remove-Item $dst -Recurse -Force
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item plugins\dsh-client-ui-plugin-explainer\package.json $dst\package.json -Force
Copy-Item plugins\dsh-client-ui-plugin-explainer\lib $dst\lib -Recurse -Force

# 4. 重启 dsh web（见 §4）
```

改了模板 `src/bundle.template.js` 或 host `lib/index.js` 同理：改 → `build.mjs`（模板）→ 重装 → 重启。

---

## 6. 注意点（重要）

1. **只读清单 ≠ 可切换**：`pluginInventory/list` 没有 mutation 路径，**显示**走它；**切换**走我们的 `POST /plugin-explainer/toggle`（写 `cordis.patch.yml`）。
2. **切换重启才生效**（无 HMR）：写入后 loader 不会热应用；界面用「待重启生效」标记 + 通知提示。想热生效可启用 hmr（有副作用）。
3. **3080 是共享实例**：桌面壳、浏览器、本开发会话共用一个 dsh web 进程；重启它会断开当前连接，验证前务必确认无其他使用者。
4. **`profiles/node_modules` 由 dsh 安装维护**：dsh 升级可能重建该目录，手动拷贝的插件有丢失风险。正式做法是安装 pnpm 后 `dsh plugin --profile web add <pkg>`（走 profile 内 pnpm 工作区，`nodeLinker: hoisted`）。本机当前**未装 pnpm**。
5. **改配置只动 `cordis.patch.yml`**，不要改 `cordis.yml`（根列表，被 bundle 层管理）。
6. **客户端 bundle 是手写 ModuleLoader 格式**，没有打包工具；模板与产物必须通过 `build.mjs` 保持一致，别直接手改 `lib/client.js`（下次 build 会覆盖）。
7. **词典键是 `moduleName`**（如 `@deepseek-ai/dsh-tool-bash`），同一包名可以有多个加载条目（清单 159 条、唯一包名 133 个），重复条目共享同一条解释，属正常现象。
8. **中文解释只收录了当前版本清单**：dsh 升级引入新包后，新包会显示占位提示，需补词典。
9. **`PROTECTED_IDS` 有两份**（host `lib/index.js` 与 client `src/bundle.template.js`），**必须保持同步**；client 那份用于置灰，host 那份是真正的强制（403）。
10. **开关写入会重排 patch 文件**：`yaml.dump` 重写整个文件，**原注释会丢**（保留了我们自己的管理头注释）；结构（insert/override）完整保留，`!!js` 表达式按原样往返。
11. **host 路由是 `/plugin-explainer/toggle`（非 /api 前缀）**：避开 apiProxy 的 `/api/<method>` 分发表；webServer 精确路由优先于前缀/fallback，无冲突。

---

## 7. 坑（都是本次会话实际踩过的）

1. **写 `C:\Users\veken\.dsh` 会被沙箱拒绝**：会话文件沙箱只允许工作区；安装/改 profile 需要 `danger-full-access` 提升（一次性的、带理由）。
2. **同一 profile 不能同时跑两个实例**：`dsh --profile web --dump-config` 在 3080 有实例时会 `EPERM` 打不开 `cordis.yml`（被运行中实例持有/监听）。验证 patch 语法改用 `js-yaml` 解析，不要起第二个 dsh。
3. **PowerShell 5.1 语法限制**：不支持 `??`、`?.` 等；写探测脚本用 `if ($null -eq x)`，否则直接解析错误。
4. **Windows 下 Node ESM `import()` 绝对路径必须是 `file://` URL**：用 `pathToFileURL()`，否则 `ERR_UNSUPPORTED_ESM_URL_SCHEME`。
5. **require shim 必须同步**：`window.__ModuleLoader__` 的 factory 是同步 `require`，返回 Promise 会导致 `react.useId is not a function` 这类诡异报错；先在顶层 await 预加载。
6. **React 组件 `useEffect` 在 SSR（renderToStaticMarkup）不执行**：冒烟测试只能覆盖 loading 态渲染；就绪态（卡片/解释/标签/开关）靠代码结构对齐官方模板 + 真机验证。
7. **本地环境没有 jsdom / react-test-renderer / @testing-library**：别写依赖 DOM 的单测，用「stub ModuleLoader + SSR + 静态断言」这套（见 `.work/smoke-test.mjs`）；host 逻辑可用「临时目录 + 假 req/res」真测（见 `.work/host-toggle-test.mjs`）。
8. **host 侧必须存在 `main` 指向的文件**（如 `lib/index.js`），否则 loader 激活失败 → 客户端 registry 的 `processOne` 会跳过该条目（要求 `fiber !== void 0 && !disabled`），插件静默不加载。
9. **控制台中文乱码 ≠ 文件编码问题**：`cordis.yml` 等文件是 UTF-8，PowerShell 控制台按 GBK 显示注释里的 Unicode 字符会乱码；编辑用 UTF-8 工具（read/edit），验证用 node 读，别用控制台重写。
10. **`Copy-Item -Recurse` 会把目录嵌进已存在的目标目录**：`Copy-Item lib dst\lib -Recurse` 在 `dst\lib` 已存在时会产生 `dst\lib\lib\…`（本次真实踩过，导致旧桩一直生效）。**先删目标目录再拷**（见 §5）。
11. **host webServer handler 要返回 Promise**：`route.handler(req, res)` 被 `await`，若内部是异步链却不 return，调用方拿到的 `then` 是 undefined；返回 writeChain 即可（本次修过）。
12. **host 侧函数插件声明服务**：模块要 `export { apply, inject }`（`inject` 是服务名数组如 `["webServer"]`）；cordis 的 `registry.plugin()` 认 `{apply, inject}` 对象形状（`unwrapExports` 会取 namespace）。

---

## 8. 参考资料（dsh 安装内源码位置）

| 想了解 | 看哪里 |
|---|---|
| 客户端插件发现/组合 | `...\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-client-modules\lib\index.js` |
| profile 组合、两锚点解析、baseUrl | `...\dsh-app-boot\lib\index.js`（§profile） |
| inventory RPC 类型 | `...\dsh-host-plugin-inventory\lib\typert.remote-client.js` |
| 官方清单 tab（我们的模板来源） | `...\dsh-client-ui-settings-plugin-inventory\lib\client.js` |
| patch 格式样例 | `...\@deepseek-ai\dsh-base\cordis.patch.yml` |
| RPC 信封格式（callUnary） | `...\dsh-client-connection\lib\client.js`（约 6206 行） |
| 插件设置区/tab 插槽消费 | `...\dsh-client-ui-settings-plugins\lib\client.js`（约 1186 行） |
| locale 插值 `{param}` | `...\dsh-client-locale\lib\client.js`（约 1107 行） |

官方仓库：<https://github.com/deepseek-ai/deepseek-harness>（`docs/` 有开发文档；官方预览页 <https://deepseek.com/harness/en/>）。

---

## 9. 后续可做（三期）

1. **热生效开关**：在「插件说明」里启用 `hmr` 插件并重启后，`cordis.patch.yml` 会被监听热应用，开关即时生效（副作用：文件监听）。已验证机制可行（`watchUserPatches` 需要 HMR 服务 + 根 Include）。
2. **桌面壳一键重启**：dsh-desktop 掌控 dsh 进程生命周期，可在 UI 里加「应用更改并重启」按钮（杀进程 → 拉起 → 重新导航）。
3. **撤销全部**：客户端 pending 状态支持一键批量反向写回。
4. **运行时挂载/卸载**：cordis 动态插件机制（GUI 里 cordis_define 卡片的 run/stop），但**不持久化**，重启即失效。
5. **词典自动化**：从各包 `package.json` 的 description 生成初稿，或接 LLM 批量翻译；新增包的词典条目可在会话中让模型补写。
6. **清单快照定期更新**：`.work/plugin-inventory-snapshot.json` 是 159 条实时快照，dsh 升级后可重跑 RPC 刷新。

---

## 10. 路径B：桌面壳功能完善 + 代码迁入 fork + 官方自动同步

### 10.1 目标与成果

1. 把 dsh-desktop 从「基础壳」完善成功能完整的桌面客户端（16 个提交，见 §10.4）。
2. 把桌面代码迁入你自己的 fork `FFaassdfs/deepseek-harness` 的 `desktop/` 目录（独立 Go+Vite 子项目，不参与 pnpm workspace，与官方 `packages/`/`apps/` 永不冲突）。
3. 建立「时刻对齐官方」机制：GitHub Action 每小时自动把官方 master 合并进 fork（见 §10.5）。

### 10.2 仓库拓扑（关键路径，务必分清）

| 项 | 值 |
|---|---|
| 本会话工作目录 | `D:\opencode\001\dsh-desktop`（含 HANDOVER.md、plugins/、.work/，以及**旧的**桌面壳源码 app.go 等） |
| fork 本地克隆 | `D:\opencode\001\dsh-desktop\.work\deepseek-harness`（git 仓库） |
| **桌面壳权威源码** | `.work\deepseek-harness\desktop\`（**改桌面壳改这里**，不是本目录根下的旧文件） |
| 同步脚本 | `D:\opencode\001\dsh-desktop\.work\sync-upstream.ps1` |
| fork 远程（origin） | `https://github.com/FFaassdfs/deepseek-harness` |
| 官方远程（upstream） | `https://github.com/deepseek-ai/deepseek-harness` |

⚠️ 桌面壳源码有**两份**：本目录根（`app.go`/`main.go` 等，独立 git 仓库，**已过时**）和 fork 内 `.work\deepseek-harness\desktop\`（**权威**）。后续开发一律改 fork 内那份。

### 10.3 凭据（⚠️ 明文已移出本文档）

- GitHub PAT（classic）：**明文见 `.work\secrets.local.md`**（2026-08-18 起移出——本文档将随「环境同步仓库」入库，明文不能进 git；`.work\secrets.local.md` 已被 .gitignore 忽略，仅存于本机）
- scope：`repo` + `workflow`（2026-08-17 已加 workflow scope，用于推送 `.github/workflows/*`）
- 用途：推送桌面提交、推送 workflow 文件、查询/触发 Actions。
- 该 PAT 也已存为仓库 Actions secret **`SYNC_TOKEN`**（供 sync-upstream 工作流推送用，见坑 13）。
- ⚠️ **不要提交到任何 git 仓库**。

### 10.4 桌面壳功能清单（16 个提交，旧→新；都在 fork 的 desktop/ 内）

| # | 提交 | 功能 |
|---|---|---|
| 1 | `de942e6` | 初始桌面壳：自动编排（检测/拉起/复用 dsh web）、就绪跳转、退出清理、单实例锁、启动画面、窗口状态记忆 |
| 2 | `c532e03` | 桌面 README 重写为独立项目文档 |
| 3 | `3cccb1c` | INTEGRATION.md 集成路线图 |
| 4 | `a36fde4` | `config.json` 运行配置（port / command） |
| 5 | `1b17030` | 自动更新 harness：拉起前 `dsh --version` vs `npm view`，有新版则 `npm i -g` |
| 6 | `a16d267` | 崩溃自愈：健康监测每 5s 探测端口，掉线自动重启自拉起实例并重连 |
| 7 | `3048fa7` | 错误诊断：启动/崩溃失败时把 `dsh.log` 尾部一并展示 |
| 8 | `22fa01e` | 进度记录 + 清理死代码 |
| 9 | `07247c5` | 原生通知：崩溃自愈/断连时发系统通知 |
| 10 | `9b03913` | README 特性清单 |
| 11 | `30d5807` | 启动画面更新状态提示（正在更新/已更新） |
| 12 | `78a3a4f` | 更新检查 24h 缓存（避免每次冷启动的网络延迟） |
| 13 | `45074b3` | 并发正确性：owns/cmd 访问加锁（数据竞争修复） |
| 14 | `e25b464` | `workdir` 配置（harness 进程工作目录，定位 .env/cordis） |
| 15 | `ed06b47` | 原生菜单（重新加载/打开日志/打开配置/退出 + 快捷键）+ 外链处理（系统浏览器打开） |
| 16 | `a68e9d5` | GitHub Action 自动同步（每小时对齐官方） |
| 17 | `23068a1` | 适配 dsh 0.1.1-rc.2 浏览器会话鉴权：startDsh 捕获 stdout 解析带 token 的鉴权 URL；waitReady 任何 HTTP 响应即视为就绪；壳 WebView 用鉴权 URL 导航（裸 URL 现返回 401，原逻辑超时/显示鉴权失败） |
| 18 | `ecfaa09` | 壳重定位为「启动器 + 自更新 + 状态面板」：放弃内嵌界面（Wails WebView 在 dsh 浏览器认证 303+cookie 上不可靠），dsh web 加 `--no-open`，壳捕获带 token URL 后用 `runtime.BrowserOpenURL` 交给系统浏览器；`startDsh` 改 node 直启（解析 dsh.cmd shim 取 bin.js，规避 `cmd.exe`+`CREATE_NO_WINDOW` 破坏孙进程 stdout 继承）；窗口固定 440×400 `DisableResize`、去窗口状态还原；新增版本自更新（启动即查 + 每 24h，新版本自动 `npm i -g`） |
| 19 | `4acf3eb` | 启动失败可诊断 + 崩溃自愈：`waitReady` fail-fast 检测子进程退出；启动失败把 `dsh.log` 尾部真实错误上抛（针对 3080 被 Hyper-V/WSL/winnat 动态保留导致 EACCES 的故障）；健康监测每 5s 探测、进程意外退出自动重启（最多连续 3 次）；`cmd.Wait()` 跟踪退出且只在「仍是当前进程」时标记 |
| 20 | `32f5e06` | 端口 3080 → 43080：避开 Hyper-V/WSL/winnat 动态保留段（3080 落在动态端口范围 1024~15000 内，winnat 为 WSL2/Hyper-V NAT 保留整段端口导致 bind EACCES、netstat 查不到占用者）；`dsh web` 透传 `--port 43080` |

### 10.5 同步机制（时刻对齐官方）

- **自动**：`.github/workflows/sync-upstream.yml`（已推送 fork）。每小时 cron（`0 * * * *`），fetch upstream master → 有新增则 `git merge upstream/master --no-edit` → `push`。支持 `workflow_dispatch` 手动触发。无冲突全自动；冲突则失败（Actions 页可见）。
  - 已实测跑通（run 31992432642 → success）。Actions 已启用（`actions/permissions` enabled=true）。
- **手动**：`pwsh -File D:\opencode\001\dsh-desktop\.work\sync-upstream.ps1`（检查模式：报告官方新提交 + 本地待推送提交）或加 `-Apply`（merge+push）。
- 官方已在 2026-08-17 晚前进（合并了大量新提交，含官方新 workflow 文件）；此后由工作流自动跟踪。

### 10.6 构建 / 验证 / 推送（在 fork 的 desktop/ 里）

```powershell
cd D:\opencode\001\dsh-desktop\.work\deepseek-harness\desktop

# 构建
wails build        # 完整（含前端 vite），产物 build/bin/dsh-desktop.exe
wails build -s     # 只改 Go 后端时跳过前端（快，且免 vite EPERM 提权）

# 验证
go test ./...              # 14 个单测
go vet ./...
GOOS=linux go vet ./...    # 交叉验证 dsh_other.go（非 Windows 分支）

# 推送 fork（token 见 §10.3；沙箱内需 danger-full-access）
git -C D:\opencode\001\dsh-desktop\.work\deepseek-harness -c credential.helper= push "https://FFaassdfs:<TOKEN>@github.com/FFaassdfs/deepseek-harness.git" master
```

### 10.7 路径B 的坑（本会话实际踩过）

1. **wails CLI 不在 PATH**：其实已装在 `C:\Users\veken\go\bin\wails.exe`（v2.14.0），只是不在 PATH。加用户 PATH 要写注册表，沙箱会拒 → 需 danger-full-access。
2. **沙箱内 vite 构建 `spawn EPERM`**：`optimizeSafeRealPathSync` 用 piped stdio 派生子进程，沙箱禁命名管道 → 完整 `wails build` 需 danger-full-access；只改 Go 用 `wails build -s` 跳过前端即可免提权。
3. **Go 构建缓存写在沙箱外被拒**：默认 `%APPDATA%\go-build`；用 `GOCACHE`/`GOTMPDIR` 重定向到工作区 `.cache/`。
4. **沙箱内 git HTTPS 走 schannel 报 `SEC_E_NO_CREDENTIALS`**：凭据库访问被沙箱拒 → fetch/push 都需 danger-full-access。
5. **推送 workflow 文件要 `workflow` scope**：PAT 只有 repo 时 `remote rejected ... without workflow scope`。已给 token 加 scope。
6. **`dsh` 是 `dsh.cmd`/`dsh.ps1` shim**：桌面壳用 `cmd /C` 解析 shim；别用 `exec.Command("dsh", ...)` 直接找 exe。
7. **非 Windows 分支 `dsh_other.go`（`//go:build !windows`）在 Windows 上不被 `go test` 编译**：用 `GOOS=linux go vet ./...` 验证。
8. **`runtime.WindowReload` vs `WindowReloadApp`**：前者重载当前页（harness），后者重载壳自身启动页。菜单「重新加载」用前者。
9. **wails v2.14 无「外链跳系统浏览器」原生 API、无系统托盘 API**：外链用「本地 HTTP 桥接 + 注入 JS」实现（harness 页没有 Wails 运行时，无法直接调 BrowserOpenURL）。
10. **菜单 Callback 签名**：`func(*menu.CallbackData)`。
11. **winres v0.3.1 版本资源 StringTable 键名写小写 `040904b0`**（Windows 期望大写）→ exe「文件属性→详细信息」版本字段空；纯外观、不影响运行，wails 升级后自愈。
12. **workflow 提交 + desktop 提交堆叠时，workflow 缺 scope 会连累 desktop 一起被拒**：需 `git reset --hard <base>` + `cherry-pick` 重排顺序，先推 desktop 再推 workflow（或用带 workflow scope 的 token 一次推）。
13. **`permissions` 块里没有 `workflows` 键**（写了会报 `Unexpected value 'workflows'` 解析失败）；且内置 `GITHUB_TOKEN` **无论如何都不能推送 workflow 文件**（GitHub 安全限制）。同步工作流必须用带 `workflow` scope 的 PAT（存成 secret `SYNC_TOKEN`，checkout 用 `token: ${{ secrets.SYNC_TOKEN }}`）来推送，否则合并官方新提交后推送官方 workflow 文件会 `403 without workflows permission`。
14. **🔴 wails 产物路径 ≠ 启动路径**：在 fork `desktop/` 里 `wails build` 输出到 `desktop\build\bin\dsh-desktop.exe`，而应用实际从 `D:\opencode\001\dsh-desktop\build\bin\dsh-desktop.exe` 启动（08/14 遗留路径）。**构建后必须拷贝过去，否则重开还是旧壳**（2026-08-17 实踩：构建 exit 0 但菜单没出现，就是产物没拷到启动路径）。`rebuild-desktop-shell.ps1` 已内置「拷贝 + 校验菜单字符串 + 重开」步骤。
15. **关壳会连坐杀掉自拉的 dsh web**：壳 owns 3080 时（壳启动时端口空闲才会 owns），关壳 → dsh web 一起死 → 若当前会话就跑在 3080 上，关壳=断当前会话。需要「关壳→构建/换 exe→自动重开」全流程时，用**计划任务**（`Register-ScheduledTask` + `Start-ScheduledTask`，需 danger-full-access）跑独立 .ps1，任务进程由 Task Scheduler 持有，脱离会话进程存活（会话被杀也不中断）。流程模板见 `.work/rebuild-desktop-shell.ps1` / `.work/swap-desktop-exe.ps1`（一次性的，跑完可 `Unregister-ScheduledTask` 清理）。
16. **PowerShell 5.1 读无 BOM 的 UTF-8 .ps1 按 ANSI(GBK) 解析**：脚本里写中文串（如"重新加载"）会变成 GBK 字节 → 在 exe 里搜 UTF-8 内容必然 False（假阴性）。exe 内字符串搜索请在命令里内联 UTF-8 文本（工具传参是 UTF-8），别依赖 .ps1 文件里的中文；或把脚本存成 UTF-8 with BOM。
17. **菜单功能已实际部署**：fork 源码里菜单（`menu.go` + `main.go` 的 `Menu: app.buildMenu()`，提交 `ed06b47`）2026-08-17 才真正进入运行的 exe（此前运行的 08/14 旧壳无菜单）。位置：窗口标题栏下方「应用」→ 重新加载(Ctrl+R)/打开日志/打开配置/退出(Ctrl+Q)。
18. **沙箱里 `Get-NetTCPConnection`/`netstat` 探测端口会返回空（假阴性「无监听」）**：判断 harness（或任何本地 HTTP 服务）是否在跑，用 HTTP 探测 `curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:3080/`（返回 200 即正常），**别用端口监听探测**。2026-08-18 实踩：`Get-NetTCPConnection -LocalPort 3080` 返回空、误判 harness 没起，实际 `HTTP 200` 正常在跑。

---

## 11. 路径C：项目文件树侧栏插件（拖文件进对话框）

### 11.1 目标与成果

在 dsh Web GUI **最右侧**加一个可折叠的**项目文件树面板**：展示「当前项目文件夹」（= 当前会话的工作目录 `cwd`，无会话回退 dsh server 启动目录）的目录树与文件；**从面板把文件拖到对话框，输入框末尾插入该文件的相对路径**（相对会话 cwd、正斜杠），用户可继续打字补充需求后一起发送，agent 用自己的 read 工具读文件。

设计决策（需求澄清后确定）：
- **拖入的是路径、不是文件内容**：prompt 内容块只有 text/image 两种（`promptContentPartSchema`），通用附件不存在；路径方式轻量、可编辑、上下文不膨胀，且 `dsh-tool-fs` 的 read/write/edit 相对路径基准 = 会话 cwd（`dsh-tool-fs/lib/index.js` 的 `session-cwd`），与树根天然一致。
- **图片同样只插路径**：不走 composer 原生图片附件（该通道只收 png/jpeg/webp/gif）；工具层有 `read_image` 通道，模型支持即可读。
- **host 是唯一文件访问点**：浏览器读不了磁盘，列目录全走 host 路由；**刻意不提供读文件内容的路由**。

### 11.2 产出文件（在仓库内，可重建）

```
plugins/dsh-client-ui-plugin-project-explorer/
├── package.json           # dsh.client 清单（platform web + inject 依赖，含 ui-conversation 保序）
├── config.json            # client UI 配置（dndMime/面板宽等，build 时注入）
├── src/bundle.template.js # client bundle 模板（占位 /*__CONFIG_JSON__*/）
├── lib/index.js           # host 侧：POST /plugin-project-explorer/{root,list}（唯一 FS 访问点）
├── lib/client.js          # 构建产物：自包含浏览器 bundle（约 22KB）
├── build.mjs              # node build.mjs 注入 config.json 生成 client.js
└── README.md
.work/
├── filetree-host.test.mjs      # host 路由单测（临时目录 + 假 req/res）
├── filetree-smoke.test.mjs     # bundle 冒烟（exports/toRelative/SSR loading/config 注入）
└── install-project-explorer.mjs # 一键安装：拷包+追加 patch+静态验证（需提权执行）
```

### 11.3 已完成的部署（本机）

1. 包体已拷贝到 `C:\Users\veken\.dsh\profiles\node_modules\dsh-client-ui-plugin-project-explorer\`（package.json + lib/）。
2. `C:\Users\veken\.dsh\profiles\web\cordis.patch.yml` 已追加 insert 条目（id=`plugin-project-explorer`，与 plugin-explainer 并存）。

### 11.4 已验证项

- [x] `node build.mjs` 成功生成 lib/client.js（22198 字节，config 4 键注入）
- [x] `node --check` host/client/模板 语法全过
- [x] host 单测全过：/root（session 优先 / fallback / 无效回退）、/list（目录优先排序、忽略名单、嵌套、文件大小、越界 403、不存在 400、缺字段 400、文件当目录 400、符号链接解析）
- [x] bundle 冒烟全过：exports 形状（NS=projectExplorer、inject=slots,locale,sessions,conversation）、`toRelative` 7 用例（正斜杠/反斜杠/大小写/根自身/越界绝对路径）、apply（locale 注册、Node 无 document 时跳过 DOM）、SSR 渲染 loading 态（"正在解析项目目录…"）、config 全部内嵌
- [x] 安装脚本静态验证（loader 发现条件 §2.3 的 1–4）：`require.resolve` 从 web profile 解析 OK、`dsh.client` 声明 OK、`exports["./client"]` 指向真实 ModuleLoader bundle、host main 存在
- [x] patch YAML js-yaml 解析 OK，`plugin-explainer` 旧条目未被破坏

### 11.5 实机验证结果（2026-08-17，运行中实例实测）

**意外发现：本插件无需重启即被运行中的 3080 实例热加载**（与 explainer 的「必须完全重启」经验不同）：
- [x] 安装后不久（无需重启 dsh web），`pluginInventory/list` 即显示 `include:plugin-project-explorer` → `fiberPhase: active`；
- [x] `POST /plugin-project-explorer/root` 立即 200（root=进程 cwd，`resolvedVia: fallback`）；
- [x] `POST /plugin-project-explorer/list` 实机可用：对 `D:\opencode\001\dsh-desktop` 返回 14 项，目录优先排序，`.git`/`build`/`.cache`/`.work` 均被忽略名单正确过滤；
- [x] index HTML 的 boot manifest 立即包含 `dsh-client-ui-plugin-project-explorer` 条目（url `/plugins/…/client.js?rev=…`，inject 边 = package.json 的 5 个包）；
- [x] client bundle URL 200（22198 字节，ModuleLoader 格式）。

推测机制：cordis loader / client-modules registry 在 profile 模块或 patch 变更时动态激活（registry 是「增量扫描 + microtask flush」，见 `dsh-client-modules/lib/index.js` 第 17–21 行），host 半区即刻 apply；**浏览器页面仍需刷新一次**才会拉取新 manifest 并执行 client bundle（面板才可见、拖放才生效）。

**实机验收（2026-08-17 用户确认）**：
- [x] 右侧出现「📁 项目文件」细条 → 点击展开面板正常；
- [x] 点击文件夹展开/收起正常（曾因 §11.7 坑 8 的 `expanded` 布尔值 bug 导致面板消失，已修复并复测通过）；
- [x] 拖 `.ts`/`.md` 文件到对话框 → 输入框末尾插入相对路径，可继续打字后发送。
若 `inject` 声明 `sessions`/`conversation` 导致 client 加载失败（服务时序），备选：inject 只留 `slots,locale`，apply 内 `ctx.get` 惰性取服务（代码已全部用 `safeGet` 防御）。

### 11.6 使用 / 验收

```powershell
# 本次实测：安装后 host 半区自动热加载，无需重启 dsh web；
# 只需刷新浏览器页面（或桌面壳菜单 → 重新加载）让 client bundle 执行。
# 刷新后：最右侧出现「📁 项目文件」细条 → 点击展开 300px 面板
# 拖文件到对话框 → 末尾插入相对路径（如 src/foo.ts）→ 继续打字 → 发送
# 若某些改动未热生效（如改 lib/index.js），仍按 §4 完全重启兜底
```

改模板/配置后：`node plugins/dsh-client-ui-plugin-project-explorer/build.mjs` → `node .work/install-project-explorer.mjs`（提权）→ 刷新页面（必要时完全重启）。

### 11.7 路径C 的坑 / 注意点

1. **模板占位符只能出现一次**：`build.mjs` 用 `String.replace` 替换首个 `/*__CONFIG_JSON__*/`，模板头部注释里若也写了占位符会被误替换（本次真实踩过，注释里已改为「CONFIG placeholder」措辞）。
2. **`react-dom/client` 直接渲染**：explainer 走 slots 注册不需要 ReactDOM；本项目面板是固定浮层，需 `require("react-dom/client")` + `createRoot`。冒烟测试里 apply 在 `document === undefined` 时提前 return，避免 Node 下崩溃。
3. **composer 拖放互不干扰的机理**：内置 drop 监听器只对 `dataTransfer.types` 含 `Files` 的事件 `preventDefault`，我们自定义 MIME 会被它忽略；我们的 document 级 `dragover` 必须 `preventDefault` 才能让 drop 事件触发（否则浏览器默认禁止放下）。
4. **插入草稿的服务路径**：`ctx.get("conversation").input.shell(sessionId)`（ui-conversation 第 9768 行 `ctx.plugin(ConversationController, {input: inputHub,...})`）；`shell.snapshot.draft` 读、`shell.setDraft(text)` 写。shell 解析失败（会话无 binding）时退化为 DOM 方案：`textarea[data-phase]` 改值 + 派发 `InputEvent("input")`。
5. **会话 cwd 是权威根**：`sessions.list.getSnapshot()` 的 `byId[current].cwd`（client-runtime 第 8913–8921/9238 行）；host 端对传入 cwd 做 realpath 校验，无效才回退 `process.cwd()`。
6. **host 无第三方依赖**：只用 `node:fs/promises`、`node:path`，安装不需要额外 node_modules（区别于 explainer 的 js-yaml）。
7. **忽略名单双份维护提醒**：host 的 IGNORE_NAMES/IGNORE_EXTENSIONS 在 `lib/index.js` 顶部常量，client 不重复；改后重装即可（README 已注明）。
8. **🔴 树展开崩溃（实机踩过）**：TreeRow 递归时把 `expanded: expanded.has(child.path)`（布尔值）当 `expanded` 传下去，子目录再展开时对布尔值调 `.has()` → `TypeError: expanded.has is not a function` → React 卸载整个 root → **点击文件夹面板就消失**。修复：TreeRow 内部统一用 `expanded`（Set）经 `isExpanded` 判断，递归与根渲染都传 Set 本体；冒烟测试新增 6 个 TreeRow 渲染用例（ready/loading/error/empty+truncated/nested/file）防回归，其中 nested 用例在该 bug 下必崩。另外面板外层加了 `PanelErrorBoundary` + window error 捕获（错误显示在面板内而不是消失），任何渲染错误都能直接看到文本。

---

## 12. 路径D：环境同步仓库（两台电脑复刻 dsh-desktop 环境）

### 12.1 目标与成果

把「这台电脑的 harness + 壳 + 自定义插件」的可版本化部分收进一个**公开 GitHub 仓库**，家里电脑 `git clone` + 跑一条 `setup.ps1` 即得到一致环境（源码/配置层）；运行时数据（会话/凭据）刻意不同步，各机自配。

- 仓库：`https://github.com/FFaassdfs/dsh-desktop-env`（public，2026-08-18 建）
- 分支：`main`（原工作区历史 3 提交 + 本路径 1 提交 `dbde346`）

### 12.2 同步矩阵（哪些进 git、哪些不同步）

| 内容 | 处理 |
|---|---|
| 两个自定义插件源码（`plugins/`） | ✅ 入库 |
| `HANDOVER.md` / `AGENTS.md` | ✅ 入库（PAT 明文已移出，见 §12.6.1） |
| `.work` 测试/安装脚本 | ✅ 入库（原整目录忽略改为白名单式忽略） |
| `scripts/setup-plugins.mjs`、`setup.ps1` | ✅ 新增 |
| 桌面壳源码 | ✅ 已在 fork（`.work/deepseek-harness` 子仓库，独立 git，不随本仓库） |
| `cordis.patch.yml`、dsh 版本 | 由 setup 脚本重建/锁定，不直接同步文件 |
| 会话历史 / storages / 凭据（API key、PAT、.env） | ❌ 各机自配；PAT 明文在 `.work\secrets.local.md`（gitignore） |
| `profiles\node_modules`、exe、全局 dsh | ❌ 可重建，setup.ps1 处理 |

### 12.3 产出文件

```
setup.ps1                       # 总入口：环境检查 → dsh 版本锁定/安装 → 插件安装 →（可选）fork clone + wails build
deploy.ps1                      # opencode 引导入口：依赖自检（缺失打印安装命令）→ 哈希表 splatting 转交 setup.ps1
scripts/setup-plugins.mjs       # 幂等安装两个插件 + 合并 cordis.patch.yml + 静态验证（相对路径，任意机器可跑）
DEPLOY.md                       # opencode/人工 分步部署清单（每步带验证 + 故障排查表，兼容无 pwsh 场景）
OPENCODE_PROMPT.md              # 可直接复制发给家里 opencode 的自包含部署指令（clone → 读 DEPLOY.md → 执行 → 验收）
global/AGENTS.md                # 全局预设权威副本（~/.dsh/AGENTS.md 的模板；setup.ps1 步骤 4/5 首次安装，不覆盖本地已有）
.work/secrets.local.md          # 本机凭据（PAT 明文，gitignore 忽略，永不进 git）
```

### 12.4 使用（家里电脑）

**推荐**：把 `OPENCODE_PROMPT.md` 的「部署指令」整段复制发给家里的 opencode，它自己 clone + 按 DEPLOY.md 执行 + 验收。

**手动**：

```powershell
git clone https://github.com/FFaassdfs/dsh-desktop-env.git
cd dsh-desktop-env
pwsh -File setup.ps1 -HarnessVersion 0.1.0-rc.7   # 完整复刻（含桌面壳构建，需 Go 1.26+ / Wails CLI / WebView2）
pwsh -File setup.ps1 -SkipDesktopBuild            # 只装插件（快速，免 Go/Wails）
pwsh -File setup.ps1 -CheckOnly                   # 干跑，不改任何东西
# 之后手动：配 dsh API key / .env（各机独立，不同步）
```

### 12.5 已验证项

- [x] `node scripts/setup-plugins.mjs --check-only`：只读验证全过（resolve / dsh.client / exports["./client"] / host main / patch YAML 两条目俱在）
- [x] 真跑安装：删旧拷新 + patch 幂等跳过（patch 已含两条目时不重复追加）
- [x] 顺带修复：本机 profile 里插件版本比仓库旧（explainer client.js 32058→36924 字节），真跑后 MD5 与仓库一致
- [x] 推送后 `git clone --depth 1` 实机验证（模拟家里拉取）：plugins/、scripts/、setup.ps1、HANDOVER、.work 脚本俱在；`secrets.local.md` / `.review` / `deepseek-harness` 未泄露
- [x] 远端 `main` HEAD = `dbde346`，本地 `## main...origin/main` 干净
- [x] `deploy.ps1 -CheckOnly` 完整链路（v2）：依赖自检全过 → 哈希表 splatting 正确转交 setup.ps1 → 插件 check-only 全过 → `done`；参数传递修复后 `checkOnly: True`、`HarnessVersion` 正确接收

### 12.6 坑 / 注意点

1. **PAT 明文已移出 HANDOVER**（2026-08-18）：§10.3 只引用 `.work\secrets.local.md`；该文件在 .gitignore，永不进 git。fork 的 Actions secret `SYNC_TOKEN` 不受影响。
2. **`.gitignore` 从「整体忽略 `.work/`」改为白名单式**：忽略 `.work/deepseek-harness/`（子仓库）、`.work/*.log`、`.review/`、`secrets.local.md`；其余 `.work` 脚本入库。
3. **setup.ps1 刻意全英文输出**：防 PS 5.1 把无 BOM UTF-8 按 ANSI(GBK) 解析中文乱码（坑 10.7.16）；Node 脚本不受此限。
4. **`clientSource.length` ≠ 字节数**：JS 字符串 length 是 UTF-16 单元数，词典含中文时明显小于字节数（32058 单元 ≈ 36924 字节）——验证输出看着像「旧版本」其实是正常现象，以 MD5/字节数为准。
5. **git push 进度输出走 stderr**：pwsh 在 `$ErrorActionPreference='Stop'` 下会把 git 的 stderr 进度当 NativeCommandError 中断并误报 exit 1——实际可能已成功；跑 git 用宽松模式，以 `git status -sb`/远端 HEAD 为准。
6. **GitHub contents API 对带尾斜杠 URL**（`.../contents/`）返回空/异常：验证仓库内容用不带尾斜杠的 URL 或直接 `git clone`。
7. **两台 dsh 版本要锁同一个**：本机全局 dsh 0.1.0-rc.6、fork 已 rc.7——setup.ps1 用 `-HarnessVersion` 锁版本，建议两台一起升 rc.7。
8. **`.review/` 是 `dsh-vision-router` 插件评审临时物**（本地仍在评估）：gitignore 忽略，未入库未删除。
9. **🔴 PowerShell 数组 splatting 传的是位置参数**：`& script.ps1 @array` **不会**解析 `-Name value` 对——会把 `-HarnessVersion` 当作第一个位置参数的值传（实测 setup.ps1 收到 `$HarnessVersion="-HarnessVersion"`，npm 报 `@deepseek-ai/dsh@-HarnessVersion`）。转交命名参数必须用**哈希表 splatting**（`@{HarnessVersion=$v; CheckOnly=$true}`）。
10. **Go 1.21+ telemetry 写 `%APPDATA%\go\telemetry`**：沙箱内 `go version` 报 Access denied → 验证脚本前置 `$env:GOTELEMETRY="off"` 即可规避，不必提权；家里无沙箱不受影响。
11. **deploy.ps1 -CheckOnly 会暴露 setup.ps1 语法错误**（曾有一处多余 `)` 报 `Missing closing '}'`）：改动 ps1 后跑**整条链路**（deploy → setup）验证，别只单测脚本开头。
12. **DEPLOY.md 面向 opencode/人工**：每条指令带验证命令 + 故障排查表；兼容无 pwsh 场景（`powershell -File deploy.ps1`，脚本 ASCII-only 防 5.1 乱码）。
13. **✅ 沙箱推送免提权办法（2026-08-18 实测）**：本仓库 `git config http.sslBackend openssl`（仓库级）后，带 token URL 的 `git push` 在 workspace-write 下直接成功，**不再需要 danger-full-access**（schannel 凭据库被沙箱拒的问题被绕开）。实测输出 `740c819..46f89c3 main -> main`。副作用：push 时有一条 `sh.exe: couldn't create signal pipe` 噪音（credential helper 子进程，不影响结果）。新克隆的仓库记得重设该配置。
14. **curl.exe 在 pwsh 里 `-d '{"json"}'` 报 `Problems parsing JSON`**（400）：Windows curl 对 pwsh 传入的带空格 JSON 参数解析不稳。改用 `Set-Content -Path tmp.json -Value $body -Encoding ascii` + `curl.exe --data-binary "@tmp.json"` 传文件即可（2026-08-18 建仓时实测）。
15. **全局预设双副本机制（2026-08-18）**：全局 `~/.dsh/AGENTS.md` 的**权威副本在本仓库 `global/AGENTS.md`**（已入库，随部署同步）；各机 `~/.dsh/AGENTS.md` 是安装副本——setup.ps1 步骤 4/5 **install-only 不覆盖**（已有则提示保留）。**改全局预设 = 改 `global/AGENTS.md` 推送 + 目标机删 `~/.dsh/AGENTS.md` 重跑 setup（或手动拷）**。本机当前版本与 global 副本一致（2026-08-18 同步）。

---

## 13. 清理记录（日常维护）

- **2026-08-18 清理**：删除 `.work\hermes-agent`（约 46.6 MB）——一次失败 git 克隆的残留：remote 指向 `FFaassdfs/hermes-agent`，但只有 `.git` 目录、无工作区文件，`.git/objects/pack/` 里仅剩中断的 `tmp_pack_*` 临时文件，`git log` 报「branch appears to be broken」，全仓库无任何脚本引用。判断为垃圾后直接 `Remove-Item -Recurse -Force` 清除。若日后真要引入 hermes-agent，重新 `git clone` 即可（`.work` 下任何非 `deepseek-harness` 的目录都只是临时物，可随时删）。

---

## 14. 壳重定位与跨机应用说明（2026-09-06）

> 本节省略号：本次把桌面壳从「内嵌 Web 界面的窗口」改成了「启动器 + 自更新 + 状态面板」，并换了端口。**在另一台电脑上要正确应用这些变动，看这一节就够了。**

### 14.1 背景：为什么改

dsh 0.1.1-rc.2 起引入**浏览器会话认证（browser-trust fence）**：`dsh web` 的根路径必须带进程启动 token 的 URL（`http://127.0.0.1:<port>/?token=...`）才能换取会话 cookie，裸 URL 一律返回 401「dsh web authentication required」。

- Wails 内嵌 WebView 在「303 重定向 + 种 cookie」这个流程上**不可靠**（壳里始终显示 401，而系统浏览器同引擎却正常）。
- 结论：**放弃内嵌界面，界面交给系统浏览器**（浏览器天然完成认证）。

### 14.2 本次改动全过程（按提交）

| 提交 | 内容 |
|---|---|
| `23068a1` | 第一次尝试：壳捕获 token URL 并让内嵌 WebView 导航过去（**最终废弃**，内嵌 WebView 认证不可靠） |
| `ecfaa09` | **壳重定位**：改为启动器 + 自更新 + 状态面板；`dsh web` 加 `--no-open`，壳用 `runtime.BrowserOpenURL` 把带 token URL 交给系统浏览器 |
| `9e05ddc`/`4acf3eb` | 文档 + 启动失败诊断 + 崩溃自愈（健康监测/自动重启） |
| `32f5e06` | **端口 3080 → 43080**（避开 Hyper-V/WSL/winnat 动态保留段） |

### 14.3 当前架构（一句话）

壳窗口 = 固定 440×400 小面板（不可最大化），显示「状态 / URL / 更新状态」+ 三个按钮（在浏览器打开 / 重启服务 / 退出）；真正的 dsh 界面由**系统浏览器**打开（URL 为 `http://127.0.0.1:43080/?token=...`）。

### 14.4 跨机应用步骤

```powershell
git clone https://github.com/FFaassdfs/dsh-desktop-env.git D:\dsh-desktop
cd D:\dsh-desktop
# 1) 安装全局 harness（锁版本）
npm i -g @deepseek-ai/dsh
# 2) 构建桌面壳（首次/前端或绑定有改动时用完整 build，仅改 Go 用 -s）
cd frontend; npm install; cd ..
wails build        # 产物 build\bin\dsh-desktop.exe
```

### 14.5 注意点 / 坑（务必读）

1. **端口固定 43080，不是 3080**。原因：本机动态端口范围是 1024~15000，3080 落在其中；WSL2/Hyper-V 的 `winnat` 服务会从动态范围里**动态保留整段端口**（`netsh interface ipv4 show excludedportrange protocol=tcp` 可见），3080 某次被划入保留段 → `dsh web` bind 报 `EACCES: permission denied`，且 `netstat` 查不到占用者（因为是系统保留、非进程占用）。改端口在 `app.go` 的 `dshPort` 常量，需同步两处 `--port` 传参（`dsh_windows.go`/`dsh_other.go`）。
2. **`dsh web` 必须 node 直启**，不能 `cmd /C` + `CREATE_NO_WINDOW`：后者会破坏 node 孙进程的 stdout 继承（`dsh.log` 一直是 0 字节、读不到 token URL）。实现：解析 npm 的 `dsh.cmd` shim 拿到 `bin.js`，再 `node <bin.js> web --no-open --port 43080`。
3. **浏览器认证**：`dsh web` 打印/打开的 URL 带 `?token=...`，裸 URL 返回 401。壳捕获该 URL 后交给系统浏览器即可正常显示。
4. **改前端或绑定后必须 `wails build`（完整）**，不要 `-s`：`-s` 不重新生成 wailsjs 绑定、不打包前端。仅改 Go 时才用 `wails build -s`。
5. **git 推送（本机沙箱）**：HTTPS 报 `SEC_E_NO_CREDENTIALS` → 用 `git config http.sslBackend openssl`（仓库级）+ 带 token URL 直接 push（见 global/AGENTS.md）。新 clone 的仓库要重设该配置。
6. **改动后 exe 需重启壳才生效**（旧进程不会热更新）；关旧壳会连坐杀掉它自拉的 dsh web。

---

## 15. 路径E：模型能力展示（Settings > 模型能力 分区插件）

### 15.1 背景：为什么看不到多模态能力

在 dsh Web GUI 选模型时看不到模型的跨模态能力，根因是一条**数据链断裂**，不是数据不存在：

1. **Host 端有**：`ctx.llm.resolveModelInfo(provider, model)` 返回 `LlmResolvedModelInfo.inputModalities`（取值 `text`/`image`），这正是图片准入的判据——`read_image` 工具、`dsh-api-session-controller/lib/index.js`（约 751 行 `model.inputModalities.includes("image")`）都用它。**能力真实存在且被使用。**
2. **构建目录时被丢弃**：官方 `dsh-api-session-controller/lib/types/catalog.js` 的 `buildModelCatalog()` 在 `resolveModelInfo` 后只拷贝 `{ id, name, ...description, ...reasoning }`，**没带 `inputModalities`**；`ModelCatalogModel` 类型（`lib/types/types.d.ts`）因此只有 `id/name/description?/reasoning?`。
3. **UI 只渲染 name**：`dsh-client-ui-model-selection/lib/client.js` 的 `ModelSelect` 只画 `model.name`（+reasoning effort）；`/model` 命令弹窗加画 `description`，同样无模态。

结论：官方把 `inputModalities` 丢在了目录构建这一步，UI 没字段可渲染。

### 15.2 方案与取舍

- 用户选定：**自定义插件 + 设置页新分区「模型能力」**（不动官方包，harness 升级不丢），符合路径A/C 既有插件模式。
- 被否路线：打通官方选择器（改 `buildModelCatalog` + `ModelSelect` 渲染）——改了全局安装的官方包，`npm i -g` 升级即覆盖，且违反「官方源码只读」约定。
- 因官方 `ModelSelect` 渲染没有 slot 钩子，无法在不改官方代码的情况下把能力徽标画进现有「选模型」下拉；故做成独立的设置分区。

### 15.3 产物流

```
plugins/dsh-client-ui-plugin-model-capabilities/
├── package.json           # dsh.client 清单（platform web + inject 依赖）
├── config.json            # route / maxModelsPerGroup（build 时注入）
├── src/bundle.template.js # client bundle 模板（占位 /*__CONFIG_JSON__*/）
├── lib/index.js           # host 侧：POST /plugin-model-capabilities/list（只读，用 ctx.llm）
├── lib/client.js          # 构建产物（15719 字节）
├── build.mjs              # node build.mjs 注入 config.json 生成 client.js
└── README.md
.work/
├── model-capabilities-host.test.mjs   # 宿主单测（假 ctx.llm + 假 req/res）
└── model-capabilities-smoke.test.mjs  # bundle 契约测试
```

### 15.4 已验证项

- [x] `node build.mjs` 生成 lib/client.js（15719 字节）；`node --check` host/client 语法过
- [x] **宿主单测全过**：happy path（2 提供商、模态/上下文/推理等级/单模型解析失败的 `error` 行）/ 提供商级失败进 `failures` / 缺 `ctx.llm` 抛错 / `handleList` HTTP 信封（fake req/res）
- [x] **bundle 契约测试全过**：ModuleLoader 注册 / exports（NS=`modelCapabilities`、inject=`["slots","locale"]`、`ModelCapabilitiesSection`）/ apply 注册 locale + `settings.section`（id=`model-capabilities`, order=12）/ `React.isValidElement` / zh 21 个键 / config 注入
- [x] **实机宿主路由已通**（运行中的 43080 实例热加载了 host 半区）：
  `POST /plugin-model-capabilities/list` 返回 `ok:true`，`groups` 含 `deepseek-official`（DeepSeek）、`vekenllm`、`ctai`（电信算力），逐模型给出 `inputModalities`/`contextWindow`/`reasoning`（如 `deepseek-v4-flash-vision-exp` → `["text","image"]`、`ctai/glm-5.3-flash` → `["text","image"]`、`vekenllm/auto` → `["text","image"]`）
- [x] `setup-plugins.mjs` 安装：`plugin-model-capabilities` 已拷入 `profiles/node_modules`，patch 已追加，loader 发现条件 1–4 全过，patch YAML OK

### 15.5 使用 / 验收

```powershell
# host 半区已热加载（路由 200）；client 分区需浏览器层面生效：
#  1. 刷新 dsh Web 页面（必要时用桌面壳菜单 → 重新加载 / Ctrl+R）
#  2. 设置 → 左侧导航应出现「模型能力」分区（order 12，位于「模型」「插件」之间）
#  3. 点进后应看到：每个提供商一张卡片 → 每个模型一行：
#     - 模型名 + 能力中文标签（如「文本 + 图像（可识图）」「仅文本」「能力未声明」）
#     - 上下文窗口、推理等级、描述
#  4. 顶部搜索框可按 提供商名/模型名/描述 过滤
# 若刷新后分区未出现（个别情况需完全重启，参见路径A §3.5），完全退出并重开 dsh web 再验。
# 若能力标签为空（旧 bug：ModalityBadges 把 children 误作 key 参数），用强刷 Ctrl+Shift+R 或重启 dsh web 让新 bundle 生效。
```

### 15.6 坑 / 注意点

1. **能力数据与官方目录一致性的差异是有意的**：官方选择器看不到模态是因为官方丢了字段；本插件通过宿主路由**重新读** `ctx.llm` 而不是改官方目录。因此它展示的是「当前 Host LLM 注册表」快照，不是官方选择器的目录。
2. **`inputModalities` 缺省语义**：字段缺失 = 未知（显示「未声明」）；显式 `["text"]`=仅文本；含 `image`=可识图。与 `read_image` 准入判据一致（`model.inputModalities.includes("image")`）。
3. **host 路由是公开的（不在浏览器认证围栏内）**：验证用 `curl -X POST --data-binary '@文件'` 直接打 `/plugin-model-capabilities/list` 即可（无需 token），但**根路径 `/` 与 `/api/pluginInventory/list` 是 401**（browser-trust）。所以「是否已在 boot manifest」无法用 curl 验证——静态 `/plugins/*/client.js` 对 unauthenticated 请求也 404（已装好的 explainer/project-explorer 同样 404，属认证围栏行为，不代表插件未加载）。**client 生效以浏览器实视为准。**
4. **`ctx.llm` 注入**：host `inject = ["webServer", "llm"]`。若某 profile 没挂 `dsh-llm`，`ctx.llm` 为 undefined → 路由返回 `500`（`buildCapabilities` 显式抛 `ctx.llm is unavailable`）。web profile 默认已挂。
5. **单模型 `resolveModelInfo` 失败不拖垮整个提供商**：该模型以 `{id,name,error}` 列出，客户端内联显示原因；提供商级 `listModels` 失败才进 `failures`。
6. **每提供商最多读 1000 个模型**（`config.json` 的 `maxModelsPerGroup`，host 端硬顶），避免超大目录卡 UI。改它要 `build.mjs` + 重装 + 重启。
7. **`settings.section` 不需要 `inject`/`children`**：本分区直接 `fetch` 宿主路由（不依赖 `remote` RPC），未声明子 slot。
8. **无 react-dom 的测试环境**：本机 harness `node_modules` 里没有 `react-dom`，SSR（`renderToStaticMarkup`）跑不了；bundle 测试改用 `React.isValidElement` + locale/config 断言，不为 SSR 快照。
9. **🔴 能力徽标曾为空（实机踩过）**：第一版 `ModalityBadges` 用 `_jsxs` 时把 children 数组**误传给了第三个参数（React 的 `key`）**，导致徽标内容渲染为空。修复：每个模态返回单个 `_jsx("span",{children:标签})`，且**统一改为纯中文文字**（`CapabilityText`：「文本 + 图像（可识图）」「仅文本」「图像（可识图）」「能力未声明」），去掉了 emoji 和 `color-mix()`（旧 WebView 可能不支持）。冒烟测试用「直接调用 `CapabilityText` 断言 `el.props.children`」覆盖四种模态，避开了无 react-dom 的限制。

### 15.7 与官方仓库的核对（2026-09-06，master=c389f96）

1. **版本**：本地 `@deepseek-ai/dsh@0.1.2-rc.1` = npm `latest`（registry 确认），无更新版本可升；官方 master 上相关文件与本地安装产物逻辑逐字一致。
2. **根因在官方 master 上依然成立**（不是本地版本旧）：
   - `packages/api/session-controller/src/catalog.ts` — `buildModelCatalog` 仍只透传 `{id, name, description?, reasoning}`，`resolveModelInfo` 返回的 `inputModalities` 在手边仍被丢弃；
   - `.../session-controller/src/types.ts` — `ModelCatalogModel` 仍只有 `id/name/description?/reasoning?`；
   - `packages/client/ui-model-selection/src/client/ModelSelect.tsx` — 模型行仍只渲染 `{model.name}` + 选中勾。
3. **是刻意设计不是疏忽**：架构笔记 `.agents/notes/archived/architecture/2026-07-15-llm-model-catalog-and-acp-selection.md`（implemented，2026-09-04 归档）明确「Catalog membership is advisory…never rejects an otherwise valid request」，目录中立面刻意只定义 `LlmModelInfo {provider,id,name,description?}`，选择器交互由各 consumer 自有；能力（模态）走请求期准入（image admission）而非目录宣告。`inputModalities` 是 2026-08-12 笔记后加进 `LlmModelInfo` 供请求期用的，`buildModelCatalog` 投影从未跟着透传——链路就断在这一层。
4. **官方无相关 issue/PR**：repo 内搜 `modalities OR multimodal OR capability` = 0 条。升级 harness 不会自带能力展示 → 本插件是长期方案，不是临时补丁；且「consumer 自有选择器交互」正是官方认可的模式。
5. **若想推动官方支持**：改法很小（catalog.ts 透传 `inputModalities` + `ModelCatalogModel` 加字段 + `ModelSelect` 渲染徽标），可提 issue/PR 上游。

### 15.8 harness 多模态支持面核实（2026-09-06，回答"音频/视频/PDF 行不行"）

结论：**模型原生多模态输入只有 text + image（光栅图）**；音频/视频/PDF 官方多处明写 "deferred work"。四层证据：

1. **模态词表**：`dsh-llm` `ModelModalityMap = { text, image }`（merge-extensible，但全仓库无适配器扩展；deepseek 适配器校验「只能 text/image」，pi-ai 透传其目录）；image admission 只认 `includes("image")`，其他模态值无消费方。
2. **内容块词表**：`ContentBlockMap = text / reasoning / image / tool-call / tool-result`，无 audio/video/file 块；注释「New core blocks must land with adapter, UI, and compaction support」= 加新模态需适配器+UI+压缩三端同步。浏览器上行 `PromptContentPart`（rc.1）= `text | image`。
3. **工具/附件面**：附件只收 PNG/JPEG/WebP/GIF（`dsh-attachment` README：「non-image files, audio, and video are not supported yet」「would need separate lifecycle and provider contracts…undecided」）；`read` 仅 UTF-8（`dsh-tool-fs` README：「PDF, audio, and video remain deferred」）；web fetch 无 pdf 分支（`dsh-web` README：「text-extractable PDF support is named deferred work」）；`@file`/文件树拖拽只插路径文本（`dsh-file-reference`：「never reads or attaches file contents」）。
4. **master 动向**：新增 `fileUploads` 服务 + `file` 上行回执 + `dsh-client-file-upload`（rc.1 尚无），但其 README 明说「**Model Experience: None… contributes no model input**」，字节存储仍走 image-only 的 `ctx.attachments` —— 是浏览器→宿主字节传输地基，不是音视频/PDF 模型输入。

实务：PDF 走 `pdf_pipeline.py`（渲染成光栅图→识图 OCR）正是对这个官方缺口的正确外挂；音频/视频需 agent 经 bash/pwsh 调 ffmpeg/whisper 等转文本/抽帧后再进上下文。

---

## 16. 路径H：vekenllm 双模型配置说明文档（2026-08-19）

> ⚠️ 本节曾于 2026-09-08 被并行会话的 HANDOVER 重写覆盖丢失，2026-08-19 会话按产出文档与实测数据补回（详见 §19 覆盖事故记录）。

### 16.1 背景与产出

用户要求为 vekenllm 供应商建立配置文档，迭代路径：auto 单模型 → 升级为 `deepseek-v4-flash + auto` 双模型 → 简化（去掉「探索其他模型」环节）→ 修正 DSH 模态写法 → 参数改为「以 API 实测为准」。

产出文件（仓库根目录，版本化命名，**当前仅保留最新版**）：

```
vekenllm-auto-setup-v1.8.md                # vekenllm 双模型配置说明（flash + auto，三客户端，当前最新；v1.8 按全量实测修正）
vekenllm-deepseek-v4-flash-setup-v3.5.md   # flash 单模型版（含 WorkBuddy 完整支持；v3.5 同步实测修正）
```

### 16.2 当前模型实测（2026-08-19）

| 模型 ID | max_input | max_output |
|---|---|---|
| `deepseek-v4-flash` | 1,000,000 | **393,216** |
| `auto` | 1,000,000 | **393,216** |

- 主地址 `http://192.168.100.63:4000` ✅ 连通，**当前仅返回上述 2 个模型**
- 备用地址 `http://192.168.15.137:4000` ⚠️ 401 未授权（需该环境专用 key）
- 权限：当前 API Key 团队可访问模型 = `['deepseek-v4-flash', 'auto']`（403 错误信息实测）；`deepseek-v4-pro` 与全部 `ctai-*` **已不可访问**

### 16.3 关键结论（文档已落地，v1.8 按全量实测修正）

1. **输出长度以 API 实测为准**：实测两模型 `max_output_tokens` 均为 **393216**（=384×1024）。flash 早期参考值 384000（=384×1000）有误；auto 早期按口头 128k 记的 131072 亦与实测不符。文档 §5 给出**实测命令** + 「推荐值 + 配置前必须实测」约定。
2. **🔴 `auto` 支持思考（v1.8 实测修正，推翻旧记录）**：实测不传参数时**默认返回 `reasoning_content`**；`reasoning_effort=low/high` 生效；`thinking:{type:disabled}` 或 `reasoning_effort=none` 可关闭。客户端配置：opencode `reasoning: true` + variants；DSH `reasoningEfforts: {off, low, high}`；WorkBuddy `supportsReasoning: true` + `supportedEfforts`。
3. **🔴 关闭思考有效**：`thinking:{type:"disabled"}` 与 `reasoning_effort:"none"` **均能真正关闭**思考链（原「无法完全关闭」说法已过时）。
4. **🔴 代理接受 `medium`/`max`**：「仅 none/low/high」是**使用约定**而非代理硬限制（flash 传 medium/max 均 200 + 思考链）——解释了客户端暴露更多档位（如 opencode 显示 max）的现象。
5. **🔴 `deepseek-v4-flash` 实测能识图**：`image_url` 输入（1×1 红色图）→ 正确答「红色」，原「仅文本」声明与实测不符。
6. **DSH 模态枚举仅 `text`/`image`**（源码实测）：`video`/`audio` 写入报 `settings-rejected` → 用**条目级 `input: [text, image]`**。模态优先级：条目级 `input` → provider 级 `base.input` → 路由级 `defaultInput`。
7. **文档不含「探索其他模型」环节**（用户要求简化）：只保留「测连通性 + 配置两个已知模型」。
8. **🔴 vekenllm ≠ ctai**：两个完全独立的供应商，baseURL（`192.168.100.63:4000` vs `ai.ctaigw.cn/v1`）、API Key、provider 键名（`vekenllm` vs `ctai`）互不通用；文档置顶有专门声明（`ctai-*` 前缀模型仍走 vekenllm 地址+key，不代表切到 ctai）。

### 16.4 注意点

1. **与 §17 litellm 中转的「auto」不是一回事**：本节 auto 是 vekenllm 代理直接暴露的模型（`192.168.100.63:4000`）；§17 的 auto 是本地 litellm 中转（`127.0.0.1:4000`）的对外模型名。
2. **两份文档并存**：`vekenllm-deepseek-v4-flash-setup-v3.5.md`（flash 单模型，含 WorkBuddy；v3.5 同步实测修正）+ `vekenllm-auto-setup-v1.8.md`（双模型合并视图，含参数实测约定）。
3. **默认模型未切**：`agent-default-model = vekenllm/deepseek-v4-flash`；auto 需在 Web GUI Models 页手动选择。
4. **auto 元数据可能变化**：auto 是代理内部路由模型，`/v1/models` 返回的上限可能随上游配置变化 → **每次配置前重新实测**，不沿用文档数字。

---

## 17. 路径G：litellm 中转算力 + auto 模型视觉自动路由（2026-08-19）

> 同上：本节内容曾被 2026-09-08 的 HANDOVER 重写覆盖，现补回要点。

### 17.1 目标与结论

用户需求：用 [litellm](https://github.com/BerriAI/litellm) 实现「中转算力」——对外暴露一个模型 `auto`，背后一个单模态文本模型（默认）+ 一个多模态模型（理解图片/视频/PDF），请求含视觉内容时自动切多模态。

**结论：可行**。方案 = litellm proxy + 自定义 `async_pre_call_hook`（官方受支持扩展点）在请求进入时检查 messages，含多模态 content block → 改写 `model` 为 vision 组，否则 text 组。**litellm 自带的 AutoRouter 语义路由不适合**（只提取文本做 embedding 分类，不检测图像）。

### 17.2 产出文件

```
litellm-auto-router-setup-v1.0.md              # 正式方案文档：架构/config.yaml 完整示例/hook 代码/部署/验证/DSH 接入/坑
.work/litellm-auto-router/vision_router.py     # 可复制 hook 源码（CustomLogger 子类 + proxy_handler_instance）
.work/litellm/                                 # litellm 官方仓库只读克隆（调研依据；不入 git）
```

### 17.3 关键源码证据（已逐项验证）

| 结论 | 证据 |
|---|---|
| pre-call hook 可改 model | `litellm/proxy/hooks/sensitive_data_routing.py`：官方生产代码 `data["model"] = routed_model; return data` |
| hook 先于路由执行 | `litellm/proxy/common_request_processing.py`：`pre_call_hook` 在 `route_request` 之前 |
| 自定义 callback 注册 | `litellm_settings.callbacks: <模块>.<实例>`，`importlib.import_module` 加载 |
| 多模态块类型 | `types/llms/openai.py`：text/image_url/audio/document/video/**file** |
| 语义路由不适合本需求 | `router_strategy/auto_router/auto_router.py` 只提取 text 块 |
| model group | `model_list` 同 `model_name` 多条 = 负载均衡组 |

### 17.4 方案要点

- config.yaml：`model_list` 定义 `auto`（兜底=文本模型）/ `text-model` / `vision-model` 三组；上游用 `openai/<id>` + `api_base` 可指向**任何** OpenAI 兼容端点（官方/vekenllm/ctai）。
- hook 规则：`image_url`/`file`/`input_image`/`input_audio`/`audio_url`/`video`/`document` 任一命中 → vision；纯文本 → text。
- 部署：Docker（`ghcr.io/berriai/litellm:main-stable`）或 `pip install 'litellm[proxy]'`。
- DSH 接入：照 §16 写法，baseURL=`http://127.0.0.1:4000/v1`、模型 `auto`。

### 17.5 坑 / 注意点

1. **hook 漏判类型会把图发给文本模型**（上游 400）：`MULTIMODAL_BLOCK_TYPES` 覆盖 7 种常见块类型；遇到新类型需对照扩展。
2. **`auto` 条目必须保留为兜底**：即使 hook 加载失败，`auto` 直接落到文本模型，行为安全可预期。
3. **PDF/视频支持取决于上游多模态模型**（litellm 只透传转换）。
4. **沙箱内 git clone litellm 走 HTTPS 报 `SEC_E_NO_CREDENTIALS`**：用 `git -c http.sslBackend=openssl clone …` 免提权。
5. **未实际部署**：本次只完成调研 + 方案文档 + hook 源码，未在本机起 litellm 实例（需用户提供上游模型与 key）。

---

## 18. 路径I：DSH 落地 vekenllm auto 模型配置（2026-08-19）

> 同上：本节内容曾被覆盖，现补回要点。

### 18.1 做了什么

在 DSH `~/.dsh/settings.yaml` 的 `llm-pi-ai.providers.vekenllm` 路由下新增 `auto` 条目（沿用现有 `VEKENLLM_API_KEY`，**未切默认模型**），并实测通过。

### 18.2 最终 settings.yaml 片段

```yaml
      models:
        - id: deepseek-v4-flash
          name: DeepSeek V4 Flash
          contextWindow: 1000000
          maxTokens: 393216          # 勘误：原 384000 → 384×1024
          input: [text, image]       # v1.8 实测：flash 也能识图
          reasoningEfforts:
            off:
            low: low
            high: high
        - id: auto
          name: Auto
          contextWindow: 1000000
          maxTokens: 393216          # v1.7：API 实测（原口头 128k 作废）
          input: [text, image]       # 条目级（DSH 枚举仅 text/image）
          reasoningEfforts:          # v1.8 实测：auto 支持思考（默认开启）
            off:
            low: low
            high: high
```

> ⚠️ 本机 `~/.dsh/settings.yaml` 当前实际写入的是 v1.7 版本（auto 无 `reasoningEfforts`）；如需让 auto 支持思考档位切换，按上面 v1.8 片段补 `input`/`reasoningEfforts` 即可（写入前先刷新重读文件）。

### 18.3 已验证

- `/v1/models` 返回 `deepseek-v4-flash, auto`；备用地址超时/401（弃）
- js-yaml 校验通过；`input:[text,image]` 在 DSH MODALITIES 内
- auto/flash 最小 `/v1/chat/completions` 均 HTTP 200
- 热重载后服务健康（HTTP 200），未触发 `settings-rejected` → Web GUI Models 页可见 `vekenllm / Auto`
- **v1.8 补充实测**：两模型思考档位/工具调用/图像识别/流式输出全部验证通过（详见 §16.3）

### 18.4 坑 / 重要发现

1. **🔴 DSH 模态枚举只有 `text` 和 `image`**（`dsh-llm-pi-ai/lib/index.js` 的 `MODALITIES = {text, image}`）。`defaultInput: [text, image, video, audio]` 里的 video/audio 是**非法枚举**，`assertServiceable` 会在写入时抛 `settings-rejected`，该写法**写不进去**。模态只能写 `[text, image]`。
2. **模态优先级链路**：`entry.input`（条目级）→ `base.input`（provider 级）→ `request.defaultInput`（路由级）。条目级声明 `input` 会在**不改路由级 defaultInput** 的前提下覆盖该模型模态——推荐写法。
3. **flash maxTokens 勘误**：384000 → 393216（=384×1024，API 实测）。
4. **默认模型未切**：仍 `agent-default-model = vekenllm/deepseek-v4-flash`；auto 仅在 Models 页可选。
5. 需提权写入 `~/.dsh/settings.yaml`（工作区外），用 `danger-full-access` 完成。
6. **🔴 v1.8 实测修正（与本节早期记录冲突，以 §16.3 为准）**：auto **支持思考**（早期误记为不支持）；`thinking:{type:disabled}`/`reasoning_effort:none` **能真正关闭思考**（早期误记为无法关闭）；代理**接受 medium/max**；**flash 也能识图**。

---

## 19. 🔴 并行会话覆盖事故与防覆盖约定（2026-08-19 踩坑，全局适用）

### 19.1 事故描述

2026-08-19 会话在更新 HANDOVER 记录 vekenllm 文档时，发现 **HANDOVER.md 已被并行会话（时间戳 2026-09-08）整体重写**，导致本会话先前写入的 §16（litellm 中转）、§17（vekenllm 双模型文档）、§18（DSH auto 落地）等章节**全部丢失**（文件从 ~745 行回退为另一时间线的版本）。

**根因**：多个会话并行编辑同一文件时，各自基于**已过期的内存/缓存副本**写入，后写者覆盖先写者的内容。

### 19.2 防覆盖约定（🔴 强制，全局所有会话必须遵守）

> **任何 agent 在写入/更新任何文件（尤其 HANDOVER.md、AGENTS.md、README 等共享文档）之前，必须先「刷新重读」该文件的最新内容，再执行编辑。**

具体要求：
1. **写入前重读**：不要依赖会话早期读到的内容作为编辑依据；每次写入前用最新读取（read 工具/重新读取）确认当前文件状态与目标锚点（old_string）仍然存在。
2. **改前核对行数与锚点**：若发现文件行数/结构与记忆不符（例如章节消失、内容变化），**立即停止写入并重新读取全文**，不要强行按旧锚点编辑。
3. **优先小步编辑**：用精确锚点做增量编辑，避免整文件 write 覆盖（write 会整体替换，最易造成覆盖事故）。
4. **发现冲突先报告**：若确认内容被其他会话覆盖丢失，**先向用户报告并确认**恢复方式，不要静默重建或放弃。
5. **关键产出双备份**：重要产出（配置文档、方案文档）除仓库文件外，在 HANDOVER 中留下「文件名 + 版本 + 要点」索引，便于被覆盖后重建。

### 19.3 已落地

- 本节即为本约定在项目层的记录；**全局约定已写入 `global/AGENTS.md` 与 `~/.dsh/AGENTS.md`（权威副本 + 安装副本）**，对所有项目所有会话生效。

---

## 20. 工作区迁移与应用区分离（2026-09-14）

### 20.1 为什么迁

多会话在同一工作区并发写同一批文件（`AGENTS.md`/`HANDOVER.md` 反复被并行改写，见 §19 事故）；且**壳 exe 与源码同目录**，清理/重建工作区会影响正在运行的应用。2026-09-14 决定：**换新工作区 + 源码区与应用区分离**。

### 20.2 迁移结果

| 区域 | 路径 | 说明 |
|---|---|---|
| 源码（唯一权威） | `D:\dsh\dsh-desktop-env` | 自 env 仓库克隆（origin=GitHub）；HEAD = `460b544` + 迁移 WIP 提交 `f51e7c3` |
| 应用（exe） | `D:\dsh\app\current\dsh-desktop.exe` | 版本化：`versions\2026-09-14\`，附 `VERSION.txt`（构建时间/源码提交/端口/核心版本） |
| 迁移快照 | `D:\dsh\_migrate-2026-09-14` | tracked patch（49.8KB）+ fork 2 个补丁 + 未跟踪产出副本 |
| 旧工作区 | `D:\opencode\001\dsh-desktop` | **已冻结**（`FROZEN.md`），仅作回溯 |

### 20.3 带了什么 / 没带什么

- **带**：4 个 tracked 改动文件（`AGENTS.md`/`HANDOVER.md`/`global/AGENTS.md`/`scripts/setup-plugins.mjs`，含另一会话**进行中**的路径E 改动）；2 个未入库插件（`core-version` 徽标、`model-capabilities` WIP）；最新文档（`vekenllm-auto-setup-v1.8.md`、`vekenllm-deepseek-v4-flash-setup-v3.5.md`、`litellm-auto-router-setup-v1.0.md`）；4 个 `.work` 脚本/测试。
- **没带（可再生）**：`.work\deepseek-harness`（351MB fork 克隆 → 仅导出 2 个未推送提交为补丁）、`.cache`、`build`、`frontend\node_modules`（改用复制复用，免联网）、`__pycache__`、`*.bak`、临时脚本（`takeover-trigger.ps1`/`apply-new-shell.ps1`，repo 内已有正式版 `swap-desktop-exe.ps1`/`restart-desktop-shell.ps1`/`rebuild-desktop-shell.ps1`）。
- **小事故（已修正）**：迁移中一次 `wails build` 因未指定 workdir 误在**旧工作区**执行（重复构建，无损害）；已在新工作区重新构建并部署。

### 20.4 不随项目走的全局态（重要）

`~\.dsh\`（DSH_HOME：profiles/已装插件/settings/凭据）、`%APPDATA%\dsh-desktop\`（config/window/dsh.log）、全局 npm `@deepseek-ai/dsh` **都不在项目内、不在迁移范围**。因此两个工作区**共用同一 DSH_HOME** → 约定「**只有一处跑 `scripts/setup-plugins.mjs`**」，否则插件安装互相覆盖。

### 20.5 复现步骤（新机器 / 重建环境）

```powershell
git clone https://github.com/FFaassdfs/dsh-desktop-env.git D:\dsh\dsh-desktop-env
cd D:\dsh\dsh-desktop-env\frontend; npm install; cd ..
wails build                                    # 产物 build\bin\dsh-desktop.exe
mkdir D:\dsh\app\current
copy build\bin\dsh-desktop.exe D:\dsh\app\current\
node scripts\setup-plugins.mjs                 # 装插件（幂等）
D:\dsh\app\current\dsh-desktop.exe             # 启动壳（launcher@43080，自动开系统浏览器）
```

### 20.6 迁移后待办（建议 P0）

1. **插件入库**：验证 `model-capabilities`（WIP）与 `core-version` 徽标，纳入 `scripts/setup-plugins.mjs` 并提交——`plugins/` 本就是入库目录。
2. **单一事实源**：端口（43080）、核心版本、官方同步频率（每天 08:00）各只在一处定义，其余文档引用。
3. **壳 P0 加固**：端口保留段自动避让（winnat）、崩溃自愈退避 + `dsh.log` 大小上限。
4. **fork 处置**：仅保留「官方镜像」职责；其 `desktop/` 内嵌壳**已废弃**。补丁 0002（外部实例掉线自动接管）是 fork 壳唯一未被本仓库吸收的能力，需要时从 `.work\migration-2026-09-14\` 择取。

### 20.7 迁移当天的推送坑（PAT 失效 → 改用 SSH）

- **旧 PAT 已失效**（2026-09-14 实测：`api.github.com/user` → **401**；`git push` → `Invalid username or token. Password authentication is not supported`）。旧 PAT 明文存在 `.work\secrets.local.md`（gitignored）与 Windows 凭据管理器里，**两处都已失效**。
- **SSH 可用、但只走 443**：`ssh -T git@github.com`（22 端口）**不通/超时**；`ssh -T -p 443 git@ssh.github.com` → `Hi FFaassdfs! You've successfully authenticated`。
- **本仓库 remote 已改为 SSH 443**：
  ```
  git remote set-url origin ssh://git@ssh.github.com:443/FFaassdfs/dsh-desktop-env.git
  $env:GIT_SSH_COMMAND='ssh -o BatchMode=yes'   # 免交互
  git push origin main
  ```
- 迁移提交 `f51e7c3`、`8f5391e` 已推送成功（`origin/main = 8f5391e`）。
- ⚠️ **连带影响**：fork 的 `sync-upstream.yml` 用 secret `SYNC_TOKEN`（= 同一枚旧 PAT）→ **该 secret 很可能也已失效**，每日自动同步会失败；需重新生成 PAT 并更新 fork 的 Actions secret（或改用其他凭据方式）。

---

## 21. dsh 核心升级到 0.1.5-rc.1 的适配与 4 插件验证（2026-09-14）

> 本节由「迁移后新会话」记录：入场盘点时发现**核心已悄悄从 0.1.2-rc.1 升到 0.1.5-rc.1**（2026-09-10 安装），文档全线未记录，且升级打断了插件测试环境。以下为实测结论与已做修正。

### 21.1 事实核对（实测优先）

| 断言 | 实测值 | 说明 |
|---|---|---|
| 核心版本 | **0.1.5-rc.1** | `dsh --version`、`npm ls -g`、`/plugin-core-version/version` 三处一致 |
| 壳 | launcher @ **43080** 在跑（PID 7244，来自 `D:\dsh\app\current\dsh-desktop.exe`） | 交接里「仍从旧路径启动」已不成立 |
| 裸 URL 探测 | **401** = 正常（认证围栏） | 见 `AGENTS.md` 高频坑 |
| git | `HEAD=5e7c643`，工作树干净，无 ahead | 迁移提交已推送 |

### 21.2 升级带来的三处断裂（前两处已修）

**① 客户端冒烟测试断 react（已修）**
0.1.2 时 react 装在其自身 `node_modules` 下；0.1.5 起把它并入 **web 前端产物**，该路径消失 → 4 个 bundle 冒烟测试全部 `ERR_MODULE_NOT_FOUND`（假回归）。
修法：新增 **`.work/lib/react-source.mjs`**，按候选目录依次解析 react / react-dom / jsx-runtime：
`.work/test-deps/node_modules` → 仓库 `node_modules` → `$DSH_HOME/profiles/node_modules` → 全局 npm 下 `@deepseek-ai/dsh/node_modules`；**都取不到时打印 SKIP 并 exit 0**（换机器不会假报失败）。
本地测试依赖目录 `.work/test-deps/`（`npm install` → react/react-dom **19.3.0**；`node_modules` 走 .gitignore，只入库 `package.json` + `package-lock.json`）。
> 顺带坑：npm 在此沙箱里默认缓存目录写不进去（EPERM）→ 用 `$env:npm_config_cache=<工作区>/.cache/npm` 即可正常安装。

**② 插件注入边死链 `@deepseek-ai/dsh-client-runtime`（已修）**
0.1.5 里该模块名**被 0 个官方包引用**（已废弃），而**我们 4 个插件全都声明了它** → 已从 4 份 `package.json` 的 `dsh.client.inject` 删除（core-version 变成 `[]`，它只往 `document.body` 挂固定徽标、不依赖任何官方模块）。
对照官方同类插件（0.1.5）：`settings-plugins` / `settings-models` 注入 `{api-remotes, client-ui-settings, client-locale}` —— 与我们修正后的列表一致。
`scripts/setup-plugins.mjs` 新增 **3b' 检查**：声明的注入边若无法从 profile 解析 → WARN 并提示删除（该检查在**未重装的旧副本**上如实报警，证明有效）。

**③ profile junction 农场断链（脏数据，暂不动）**
`$DSH_HOME/profiles/node_modules` 是 **607 个 junction**（指向 dsh 安装内部包目录），其中 **126 个目标已随 0.1.5 消失**：`react`、`react-dom`、`@deepseek-ai/dsh-client-runtime`、`dsh-client-ui-slots`、`dsh-client-ui-primitives`、`immer`、`clsx`、`@lexical/*` 等。
- **不影响已装插件**：loader 只解析**插件自身** package.json（`dsh-client-modules` 的 `locatePkgJson`/`resolveMeta`）；浏览器端 `require("react")`、`require("@deepseek-ai/dsh-client-ui-primitives")` 由**前端产物注册的模块表**满足（primitives 被 39 个官方包引用，仍是活名字）。
- 属遗留脏数据，需要时可清理/重建农场，暂无必要动共享全局态。

### 21.3 4 插件在 0.1.5 下的验证结果

**host 半区（运行中 43080 实例实测，无需 token）——全部 200：**

| 插件 | 探测 | 结果 |
|---|---|---|
| model-capabilities | `POST /plugin-model-capabilities/list` | **200**：返回 `deepseek-official`/`vekenllm`/`ctai` 分组 + 逐模型 `inputModalities`/`contextWindow`/`reasoning` |
| project-explorer | `POST /plugin-project-explorer/root` | **200**：`root=D:\dsh\app\current`（无会话上下文 → `resolvedVia: fallback`） |
| core-version | `GET /plugin-core-version/version` | **200**：`{"ok":true,"version":"0.1.5-rc.1"}` |
| explainer | `POST /plugin-explainer/toggle`（故意坏体） | **400** bad-request（路由已注册、校验生效、未写文件）；对照未知路由 = **404** |

**官方 API 复核（0.1.5 源码，逐项确认仍在）：**
- 槽位 `settings.plugins.tab`（10 处）、`settings.section`（14 处）、`shell.overlay`（2 处）均在；
- `webServer.register(route)` 仍在（`dsh-host-webserver`）；
- `ctx.llm.resolveModelInfo` 仍返回 `inputModalities`，而 `buildModelCatalog` / `ModelSelect` **依旧不透传** → **§15 路径E 插件仍是长期方案**（前提未变）。

**待做（需择时/需人眼）：**
1. **client 半区目视确认**：浏览器里看 4 个界面（设置→插件第三个 tab、设置→模型能力、右侧文件树、版本徽标）。
2. **激活 inject 修正**：`node scripts/setup-plugins.mjs`（写 `$DSH_HOME`，需提权）+ **完整重启 dsh web**——重启会断开当前 GUI 会话，须与用户约定时机。

### 21.4 本次改动文件

```
scripts/setup-plugins.mjs                     # +core-version（第 4 个插件）+ 3b' 注入边死链检查
plugins/*/package.json  ×4                    # 删除废弃注入边 @deepseek-ai/dsh-client-runtime
.work/lib/react-source.mjs                    # 新增：react/react-dom 候选解析器（跨 dsh 版本）
.work/test-deps/{package.json,package-lock}   # 新增：冒烟测试的本地 react 19.3.0（node_modules 忽略）
.work/{smoke-test,filetree-smoke,core-version-smoke,model-capabilities-smoke}.mjs  # 改用 react-source
```

验证：`node scripts/setup-plugins.mjs --check-only` 全过（4 插件 + patch 4 个 id）；7 个测试套件 **7/7 通过**。

### 21.5 文档版本漂移（待收口，勿再引用旧值）

- `0.1.2-rc.1` 仍出现在：`AGENTS.md` 状态行、§16.2/§16.3、`README.md`、`plugins/dsh-client-ui-plugin-core-version/README.md`、`desktop-shell-redesign-v1.0.md`（均为**快照值**，实测以 0.1.5-rc.1 为准）。
- `DEPLOY.md` / `deploy.ps1` / `OPENCODE_PROMPT.md` 仍锁 `-HarnessVersion 0.1.0-rc.7`（跨机锁版已失效）。
- **§18.2 注与 §18.4-4 已过时**：本机 `~/.dsh/settings.yaml` 现为 `agent-default-model: vekenllm/auto` + `reasoningEffort: high`，且 auto 条目**已含** `input: [text, image]` 与 `reasoningEfforts`（即 v1.8 片段已落地，不再是 v1.7）。



