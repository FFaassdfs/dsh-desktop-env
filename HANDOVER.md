# HANDOVER.md — dsh-desktop 交接文档

> **用途**：让不同会话/协作者在不共享记忆的情况下，快速知道这个仓库里发生过什么、怎么复现、有哪些注意点、要避开哪些坑。
> **最后更新**：**§30 独立插件更新脚本 `update-plugins.ps1`（2026-09-22）**——用户要"单独弄个插件安装脚本，方便直接更新已安装的老版本"：新增 `scripts/update-plugins.ps1` + `.cmd`（默认只更新**已装**插件、`-CheckOnly` 只报告不写、**内容哈希**判定 missing/outdated/current、**先备份失败自动回滚**、只加不减），并随发行包发布到包根；`setup-plugins.mjs` 新增 `--status` 作为判定的单一来源；测试 `.work\update-plugins.test.ps1` **26 项全通过**（含"源变更→检出并更新"与"源损坏→回滚"两条真实路径）。**§29.9 复核路径P 插件并发布 0.1.6（2026-09-22）**——独立复核（bundle 可复现 / 64 断言 / 真实 models.dev 端到端 / 安装链路 3a–3d）；补齐连带影响（`.work/plugin-selection.test.ps1` 改为**期望值由 `--describe` 推导**，5 插件下 **51/51 通过**；README/packer/facts 的"4 个插件"同步为 5）；修正 5 个 `build.mjs` 的字节口径（`bundle.length` 字符数 → `Buffer.byteLength(...,"utf8")`，bundle 内容零变化）；**0.1.6 发布（run #10，资产 98.5 MB）并通过发布资产端到端验证**（包内安装器菜单列出 5 个插件、`2,4` → explainer+model-sync、`--extract-runtime` 实跑通过）。⚠️ 0.1.5 的包只含 4 个插件（tag 早于插件提交）。**§29 路径P：模型同步插件（2026-09-22）**——按提供商刷新模型列表与参数：从 **models.dev / OpenRouter / 该商自己的 `/models` 端点**拉候选，逐字段 diff 后经**官方 `remote.settings.mutate`** 写回 `settings.yaml`（路径寻址 + revision 围栏 + 写后回读验证）；UI 挂**官方 `settings.models.provider-card` slot**，**host 半区为空**（数据面全走官方 Remote，不自建路由）。测试 **64 断言 + 真实 models.dev 数据端到端**通过；插件数 **4→5**（编号按短名字母序，`model-sync` = **4**，`project-explorer` 顺延为 **5**）。⚠️ 本节含一次**基于过期读取写入**的事故复盘（§29.5 坑 1）。**§28 插件安装体验（2026-09-21）**——安装菜单显示**中文功能说明**、**编号多选（`2,4`）**、**输入无效则不装任何插件**；说明由 `setup-plugins.mjs --describe` 单一数据源供给菜单/包内 README/仓库表格。顺带修掉两个真实 bug：**相对 `-DSHome` 导致 mjs `createRequire` 抛错 → 只装第一个插件就崩（半装状态）**、**`install-offline.ps1` 缺 UTF-8 BOM（含中文后 5.1 会乱码）**。测试 `.work\plugin-selection.test.ps1` **42 项全通过**（真实装到临时 DSH_HOME）。**§27.11 运行时改为单文件 `runtime.zip` + 首次启动解压（2026-09-21）**——用户实测反馈"包里文件很碎、拷贝慢"，实测确认是**文件数**问题（解压后 27,413 个文件、89% 小于 8 KB；单线程拷贝 88.8s vs `robocopy /MT:16` 15.9s）。方案 A：把 `runtime\` 打成**单个 `runtime.zip`**（103.2 MB / 31,074 条目），**壳首次启动自动解压**（42s、幂等、含 zip-slip 防护与原子落位），并加 CLI `dsh-desktop.exe --extract-runtime`；**新包只剩 35 个文件**，整个包拷贝 15.9s。打包器的运行时/npm 自检闸门照旧在松散目录上执行，另加"压缩包内必须含 dsh 入口与 npm"的校验。测试 28/28 通过。**§27.10 覆盖升级注意事项 + 版本保护（0.1.2）**——① 壳新增**便携运行时解析**（`runtime.go`：`$DSH_DESKTOP_RUNTIME` → `<exeDir>\runtime` → `<exeDir>` → 原有 shim 回退；便携模式**跳过 npm 自更新**）② **`scripts/pack-release.ps1`** 打出 `dsh-desktop-<shell>-dsh<ver>-win-x64.zip`（实测 **106.2 MB**，原始 312.6 MB/25,482 文件）+ `install-offline.ps1` ③ **`.github/workflows/release-desktop.yml`**：打 `desktop-v*` tag 自动构建并发 Release（用内置 `GITHUB_TOKEN`，无需 PAT）④ 实测：离线树 `node ...bin.js --version` → `0.1.5-rc.2`、离线安装器对临时 DSH_HOME `SETUP OK`、**17/17 Go 测试通过**；⚠️ 本机因 `SingleInstanceLock` 无法做实机便携启动（需目标机验证）。**§26 统一启动入口 + 版本锚点刷新（2026-09-20）**——① 抽出 **`scripts/deploy-shell.ps1`** 作为部署唯一实现，`setup.ps1`（新增 5b 步）与 `update.ps1` 共用 → **唯一启动入口 = `D:\dsh\app\current\dsh-desktop.exe`**（`build\bin\` 只是中间产物），并给 `setup.ps1`/`deploy.ps1` 加 `-AppDir`；② 发现环境已升到 **`0.1.5-rc.2`**（`npm latest` 同版本），把锁版/文档/事实源从 rc.1 统一刷新；③ **rc.2 下插件复验通过**（3 条 host 路由 200、patch 4 条目、`--check-only` 全过）；④ 核对 `global/AGENTS.md` 与 `~/.dsh/AGENTS.md` 完全一致（v2.17）。**§25 其他电脑「一条命令更新壳」（2026-09-15）**——修复被 §24 打断的构建路径：`setup.ps1` 第 5 步从「clone fork 构建 `desktop/`」改为**在本仓库根 `wails build`**；新增 **`update.ps1`**（`git pull` → 刷新插件 → `wails build` → 部署到应用区，含 dated 归档 + `VERSION.txt`，exe 被锁时自动暂存 `.new.exe`；支持 `-SkipPull/-SkipPlugins/-SkipFrontend/-SkipBuild/-NoDeploy/-AppDir/-CheckOnly`）与 **`.work/verify-fresh-clone.ps1`**（回归验证：新克隆能否构建）。**实跑验证**：克隆 HEAD `7f5291d` → 21 个必需文件齐全 → `npm install` 13s + `wails build` 22s → exe 11,333,632 字节且含 P0-3 标记；`update.ps1` 部署/`-CheckOnly` 两条路径均正确。**§24 fork 处置 B + `SYNC_TOKEN` 全部完成**——① fork 独有根级 `desktop/` 已删除并推送（`41aaec8`，顶层条目 60→59）② **`SYNC_TOKEN` 已换新并端到端验证**：run #49 `workflow_dispatch` → `success`，且 `compare` 显示 **`behind_by = 0`**（fork 已含上游当天 03:16Z 的 `0d1f500`）→ 证明 #49 真的走了「合并上游 + 推送」这条路（此前 #47/#48 因 token 失效而失败）③ 新增巡检工具 `.work/sync-status.mjs`（无需本地 fork 克隆；异常时退出码 1）；**路径教训**：blobless 偏克隆无法提交（`write-tree`/`mktree` 都校验对象存在性）→ 大仓库操作用**后台全量浅克隆**（113 MB/约 15 分钟）再本地提交推送（5.4 秒）；**重大发现：上游已有一方官方桌面端 `apps/desktop/`（Electron，implemented）且不提供 `webServer`** → 我们 4 个插件的 host 路由在官方 Desktop profile 下会失效（§24.5）。**§23 壳加固 ②③（2026-09-14）**——崩溃自愈改为**指数退避**（15s→45s→120s 封顶）+ **稳定运行 5 分钟才重置预算**，并修掉两个真实缺陷（原「连续 3 次」预算因就绪即清零而几乎失效；原自动重启未就绪时监测会永久休眠）；日志加**上限轮转**（`dsh.log` 5 MiB / `debug.log` 1 MiB）且报错改为**只读文件尾 64 KiB**（原整文件读入内存）。新增 `logutil.go` + 6 个单测（**9/9 通过**，`go vet` 与 `GOOS=linux vet` 均 0），`wails build -s` 产出新 exe（11,333,632 字节）；因运行中的壳持有 exe 文件锁，**替换与重启留给用户**（`.work\swap-desktop-exe.ps1` 已重写；① 端口避让未做）。**§22 单一事实源（P0-2）与文档版本收口（2026-09-14）**——新增 `project-facts-v1.0.md` 作为端口/核心版本/同步频率/锁版/插件清单的唯一索引（代码与配置才是权威源，文档只引用）；本轮勘误：①官方同步「每小时」→ 实为**每天 08:00 `0 0 * * *`**（读 fork workflow 源码；且 Actions run 47（09-14）已 `failure` → `SYNC_TOKEN` 失效）②核心版本 0.1.2-rc.1 → **0.1.5-rc.1** ③跨机锁版 0.1.0-rc.7 → **0.1.5-rc.1** ④版本徽标位置「顶部右侧」→ **左下角** ⑤clone 目录 → `D:\dsh\dsh-desktop-env`；同时 §21.3 关闭「client 半区目视确认」——**4 个插件界面用户复核全部可见，无需重启**；**§21 dsh 核心升级到 0.1.5-rc.1 的适配与 4 插件验证（2026-09-14）**——实测核心已从 0.1.2-rc.1 升到 **0.1.5-rc.1**（2026-09-10 安装，文档此前未记录），并修好升级带来的三处断裂：①客户端冒烟测试 react 源（0.1.5 不再在 dsh 内自带 react → 新增 `.work/lib/react-source.mjs`，7 套件全绿）②4 插件声明了已废弃的注入边 `@deepseek-ai/dsh-client-runtime`（0.1.5 里被 0 个官方包引用）→ 已删除并在 `setup-plugins.mjs` 加死链检查 ③profile junction 农场 126/607 断链（脏数据，不影响插件）。同时 **core-version 已纳入 `scripts/setup-plugins.mjs`（现 4 插件）**，并实测 4 插件 host 半区在 0.1.5 实例全部活跃、**client 半区 4 个界面已用户复核可见（无需重启）**，详见 §21；§20 工作区迁移与应用区分离（2026-09-14）——源码迁至 `D:\dsh\dsh-desktop-env`、应用产物迁至 `D:\dsh\app\current`、旧工作区冻结（含快照与 fork 补丁归档，见 §20）；**§20.7 记录推送坑：旧 PAT 已失效（401），改用 SSH 443（22 不通），remote 已换、迁移提交已推送**；路径H v8——vekenllm 两份配置文档按**全量实测**同步升级（**v1.8** 双模型 + **v3.5** flash 单模型）：auto 支持思考且默认开启、flash 实测能识图、thinking-disabled 与 effort=none 均能真正关闭思考、代理接受 medium/max——详见 §16.3 八条结论与 §18.4 第 6 条；路径H v7——vekenllm 双模型配置文档升至 **v1.7**（auto 输出长度以 API 实测 393216 为准 + §5 新增实测命令与「推荐值+要求实测」约定）；路径I v1——DSH 落地 vekenllm auto（条目级 input、flash maxTokens 勘误）；路径G v1——litellm 中转 auto 视觉路由调研+方案；**并补回被并行会话覆盖丢失的 §16–§18**，新增 **§19 覆盖事故与「写入前必须刷新重读」防覆盖约定（全局强制）**；路径E v2——已对官方仓库 master 核实（§15.7：版本 0.1.2-rc.1=latest、`buildModelCatalog` 丢 `inputModalities` 在 master 依旧、官方刻意 advisory 目录、无相关 issue/PR → 插件是长期方案）；路径E v1——「模型能力」设置分区插件（Settings > 模型能力：列出每个提供商/模型的输入模态、上下文窗口、推理等级；宿主只读路由 `/plugin-model-capabilities/list` 用 `ctx.llm.resolveModelInfo` 补回官方 `buildModelCatalog` 丢掉的 `inputModalities`，见 §15）；路径D v2——opencode 一键部署（`DEPLOY.md` + `deploy.ps1` + `OPENCODE_PROMPT.md`）；路径D 坑清单补全至 §12.6 共 14 条（openssl 免提权推送、数组 splatting、curl JSON、GOTELEMETRY 等，2026-08-18）；路径D v1 完成——环境同步仓库 `FFaassdfs/dsh-desktop-env`（公开）：setup.ps1 一键复刻 + 插件安装脚本 + PAT 明文脱敏；清理遗留垃圾——删除 `.work\hermes-agent`（失败克隆残留，见 §13）；路径C v1 完成——「项目文件树侧栏」插件（右侧面板 + 拖文件插路径，见 §11）；路径B 桌面壳 16 项功能完善 + 代码迁入 fork + GitHub Action 每小时自动同步（见 §10）；已建 harness 全局预设 `~/.dsh/AGENTS.md`（默认中文 + 更新 HANDOVER 约定 + 常见坑）。

---

## 🟢 当前状态（2026-09-14 迁移后，每会话先看这里）

| 项 | 值 |
|---|---|
| 源码区（唯一权威） | `D:\dsh\dsh-desktop-env`（本仓库） |
| 应用区（exe） | `D:\dsh\app\current\dsh-desktop.exe`（历史版本在 `D:\dsh\app\versions\`） |
| 旧工作区 | `D:\opencode\001\dsh-desktop` **已冻结**（见其 `FROZEN.md`），勿再写入 |
| 当前壳 | **launcher @ 43080**（状态面板 + node 直启 + 带 token URL 交系统浏览器） |
| 核心版本 | **`@deepseek-ai/dsh 0.1.5-rc.2`**（全局 npm；`npm dist-tags.latest` 同版本；2026-09-20 实测）——文档里旧记的 `0.1.2-rc.1`/`0.1.5-rc.1` 均为过时快照，见 §21/§26 |
| 进行中 | 路径P「模型同步」插件已交付（§29）：静态发现条件全过、64 断言、真实 models.dev 数据验证通过；**待用户重启 dsh web 后目视验收**。路径E（§21.3）host 半区活跃。**5 个插件**均已纳入 `scripts/setup-plugins.mjs`（编号 1–5，`model-sync` = 4） |
| 迁移快照 | `.work\migration-2026-09-14\`（tracked patch + 2 个 fork 补丁） |
| 下一步（建议） | **P0 全部关闭** ✅ 且**多机更新链已修好**（§25：`update.ps1` 一条命令 + 新克隆构建已实测）。可选下一步：①**等官方发布后再评估官方桌面端**（现在只留了评估交接：`D:\dsh\official-desktop-eval\`，结论=未发布、只能自行构建）②HANDOVER 瘦身（数值已收敛到 `project-facts-v1.0.md`）③壳加固 ①端口保留段避让（已按用户决定暂缓，§23.5） |

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
3. 建立「时刻对齐官方」机制：GitHub Action **每天 08:00（cron `0 0 * * *`）**自动把官方 master 合并进 fork（见 §10.5；旧记「每小时」为笔误）。

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
| 16 | `a68e9d5` | GitHub Action 自动同步（每天 08:00 对齐官方；提交当时的描述写「每小时」，实际 cron 为 `0 0 * * *`，见 §10.5 勘误） |
| 17 | `23068a1` | 适配 dsh 0.1.1-rc.2 浏览器会话鉴权：startDsh 捕获 stdout 解析带 token 的鉴权 URL；waitReady 任何 HTTP 响应即视为就绪；壳 WebView 用鉴权 URL 导航（裸 URL 现返回 401，原逻辑超时/显示鉴权失败） |
| 18 | `ecfaa09` | 壳重定位为「启动器 + 自更新 + 状态面板」：放弃内嵌界面（Wails WebView 在 dsh 浏览器认证 303+cookie 上不可靠），dsh web 加 `--no-open`，壳捕获带 token URL 后用 `runtime.BrowserOpenURL` 交给系统浏览器；`startDsh` 改 node 直启（解析 dsh.cmd shim 取 bin.js，规避 `cmd.exe`+`CREATE_NO_WINDOW` 破坏孙进程 stdout 继承）；窗口固定 440×400 `DisableResize`、去窗口状态还原；新增版本自更新（启动即查 + 每 24h，新版本自动 `npm i -g`） |
| 19 | `4acf3eb` | 启动失败可诊断 + 崩溃自愈：`waitReady` fail-fast 检测子进程退出；启动失败把 `dsh.log` 尾部真实错误上抛（针对 3080 被 Hyper-V/WSL/winnat 动态保留导致 EACCES 的故障）；健康监测每 5s 探测、进程意外退出自动重启（最多连续 3 次）；`cmd.Wait()` 跟踪退出且只在「仍是当前进程」时标记 |
| 20 | `32f5e06` | 端口 3080 → 43080：避开 Hyper-V/WSL/winnat 动态保留段（3080 落在动态端口范围 1024~15000 内，winnat 为 WSL2/Hyper-V NAT 保留整段端口导致 bind EACCES、netstat 查不到占用者）；`dsh web` 透传 `--port 43080` |

### 10.5 同步机制（时刻对齐官方）

- **自动**：`.github/workflows/sync-upstream.yml`（已推送 fork）。**每天 08:00（北京时间）= cron `0 0 * * *`（UTC 00:00）**，fetch upstream master → 有新增则 `git merge upstream/master --no-edit` → `push`。支持 `workflow_dispatch` 手动触发。无冲突全自动；冲突则失败（Actions 页可见）。
  - 🔴 **勘误（2026-09-14）**：本条旧记「每小时 cron（`0 * * * *`）」**有误**；读 fork 的 workflow 源码确认是 `0 0 * * *`（每天一次）。事实源见 `project-facts-v1.0.md` F4。
  - ⚠️ **当前状态**：2026-09-14 起该定时任务**失败中**（Actions run 47 `failure`；09-12/09-13 的 run 45/46 仍 `success`）——`SYNC_TOKEN` 随旧 PAT 失效，见 §20.7 / §22。
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
| 4 个自定义插件源码（`plugins/`） | ✅ 入库 |
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
pwsh -File setup.ps1 -HarnessVersion 0.1.5-rc.1   # 完整复刻（含桌面壳构建，需 Go 1.26+ / Wails CLI / WebView2）
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
git clone https://github.com/FFaassdfs/dsh-desktop-env.git D:\dsh\dsh-desktop-env
cd D:\dsh\dsh-desktop-env
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
   - 🔁 **2026-09-14 复核于 0.1.5-rc.1**：结论不变 —— `buildModelCatalog` 仍不透传 `inputModalities`、`ModelSelect` 仍只渲染名字（见 §21.3）。本条的「0.1.2-rc.1」是当时快照。
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

> ⚠️ 2026-09-20 起**推荐直接用脚本**（`scripts\deploy-shell.ps1` 统一落点、`update.ps1` 一条命令），下面保留的是**手工等价步骤**：

```powershell
git clone https://github.com/FFaassdfs/dsh-desktop-env.git D:\dsh\dsh-desktop-env
cd D:\dsh\dsh-desktop-env\frontend; npm install; cd ..
wails build                                    # 中间产物 build\bin\dsh-desktop.exe
pwsh -File scripts\deploy-shell.ps1 -BuiltExe build\bin\dsh-desktop.exe   # 部署到应用区（唯一启动入口）
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

**待做（已完成）：**
1. ✅ **client 半区目视确认通过**（2026-09-14，用户复核）：4 个界面全部可见 —— 设置→插件第三个「插件说明」tab、设置→「模型能力」、右侧「项目文件」文件树、左下角 `dsh v0.1.5-rc.1` 徽标。**无需重启 dsh web**（刷新页面即生效；也说明本次注入边修正没有破坏加载）。
2. ✅ **注入边修正已装入 farm**（2026-09-14，见 §21.6）——farm 与仓库逐字一致，`--check-only` 不再有 WARN。

### 21.4 本次改动文件

```
scripts/setup-plugins.mjs                     # +core-version（第 4 个插件）+ 3b' 注入边死链检查
plugins/*/package.json  ×4                    # 删除废弃注入边 @deepseek-ai/dsh-client-runtime
.work/lib/react-source.mjs                    # 新增：react/react-dom 候选解析器（跨 dsh 版本）
.work/test-deps/{package.json,package-lock}   # 新增：冒烟测试的本地 react 19.3.0（node_modules 忽略）
.work/{smoke-test,filetree-smoke,core-version-smoke,model-capabilities-smoke}.mjs  # 改用 react-source
```

验证：`node scripts/setup-plugins.mjs --check-only` 全过（4 插件 + patch 4 个 id）；7 个测试套件 **7/7 通过**。

### 21.5 文档版本漂移（**已于 §22 收口**）

> 建立单一事实源 `project-facts-v1.0.md` 后，下列漂移已就地修正；历史快照文档保留原貌。详见 §22。

- ~~`0.1.2-rc.1` 仍出现在……~~ **已修**：`AGENTS.md`、`README.md`、`plugins/dsh-client-ui-plugin-core-version/README.md`（含位置描述「顶部右侧」→ 实际**左下角** `left:12px;bottom:56px`）均已更正；仍保留 0.1.2-rc.1 的是**带日期的历史快照**（§15.7/§16、`desktop-shell-redesign-v1.0.md`），已在 §15.7 加「2026-09-14 复核」注。
- ~~`DEPLOY.md` / `deploy.ps1` / `OPENCODE_PROMPT.md` 仍锁 `-HarnessVersion 0.1.0-rc.7`~~ **已修**：三处 + `setup.ps1` 注释统一为 **`0.1.5-rc.1`**，权威源 = `deploy.ps1` 的默认值（`project-facts-v1.0.md` F10）。
- **§18.2 注与 §18.4-4 已过时**：本机 `~/.dsh/settings.yaml` 现为 `agent-default-model: vekenllm/auto` + `reasoningEffort: high`，且 auto 条目**已含** `input: [text, image]` 与 `reasoningEfforts`（即 v1.8 片段已落地，不再是 v1.7）。
- **§10.5 同步频率勘误**：旧记「每小时 `0 * * * *`」→ 实为 **`0 0 * * *`（每天 08:00）**，已就地更正（事实源 = fork 的 workflow，`project-facts-v1.0.md` F4）。
- 另修：`README.md`/`DEPLOY.md`/`HANDOVER.md` 的 clone 路径 `D:\dsh-desktop` → **`D:\dsh\dsh-desktop-env`**；`README.md` 的 `HANDOVER.md` §12 引用 → §14；"两个自定义插件" → 4 个。

### 21.6 执行记录（可复现）

```powershell
# 1) 本地测试依赖（react 在 0.1.5 已不在 dsh 内；沙箱里 npm 缓存要重定向）
$env:npm_config_cache = "D:\dsh\dsh-desktop-env\.cache\npm"
cd .work\test-deps; npm install react@19 react-dom@19; cd ..\..

# 2) 7 个测试套件
foreach ($t in @('smoke-test','host-toggle-test','filetree-host.test','filetree-smoke.test','core-version-smoke.test','model-capabilities-host.test','model-capabilities-smoke.test')) { node ".work\$t.mjs" }
# -> 7/7 通过

# 3) 装入 $DSH_HOME（幂等；写工作区外，沙箱需 danger-full-access）
node scripts\setup-plugins.mjs
# -> 4 插件 copied；3b inject=3/4/3/0；3e patch ids 4 个；farm 与仓库逐字一致
node scripts\setup-plugins.mjs --check-only
# -> 无 WARN（死链已消除）

# 4) 活体探测（运行中的 43080，host 半区无需 token）
curl.exe -s -X POST -H "Content-Type: application/json" --data-binary "@body.json" http://127.0.0.1:43080/plugin-model-capabilities/list   # 200
curl.exe -s http://127.0.0.1:43080/plugin-core-version/version                                                                       # 200 {"version":"0.1.5-rc.1"}
curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:43080/                                                                          # 401 = 正常（认证围栏）
```

提交：`2c31481`（已推送 `origin/main`）。推送坑：本机走 SSH 443，**沙箱里 push 需要 `danger-full-access`**（否则 `sh.exe: couldn't create signal pipe` → `Could not read from remote repository`，看起来像鉴权失败，实为沙箱禁管道）。

---

## 22. 路径J：单一事实源（P0-2）与文档版本收口（2026-09-14）

### 22.1 做了什么

建立 **`project-facts-v1.0.md`** 作为「会被多处引用的数值」的唯一索引，并把漂移的文档改回引用：

- **权威源原则**：代码/配置是权威源，文档只引用不复制——
  - 端口 → `app.go` 的 `dshPort` 常量（F1）
  - 核心版本 → 实测 `dsh --version`（F2）
  - 同步频率 → fork 的 `.github/workflows/sync-upstream.yml` 的 cron（F4）
  - 跨机锁版 → `deploy.ps1` 的 `-HarnessVersion` 默认值（F10）
  - 插件清单 → `scripts/setup-plugins.mjs` 的 `PLUGINS` 数组（F9）

### 22.2 本次勘误（都是「文档互相矛盾 / 过时」）

| 事实 | 旧文档 | 实测 |
|---|---|---|
| 官方同步频率 | §10.5「每小时 `0 * * * *`」 vs `AGENTS.md`「每天 08:00」 | **每天 08:00 = `0 0 * * *`**（读 fork workflow 源码） |
| 同步是否正常 | 假设正常 | ⚠️ **失败中**：Actions run 47（09-14）`failure`；run 45/46（09-12/13）`success` → `SYNC_TOKEN` 随旧 PAT 失效（P0-4） |
| 核心版本 | 0.1.2-rc.1（多处） | **0.1.5-rc.1** |
| 跨机锁版 | `0.1.0-rc.7`（deploy / DEPLOY / OPENCODE） | **`0.1.5-rc.1`** |
| 版本徽标位置 | core-version README 与源码注释写「顶部右侧」 | 实际 CSS `left:12px;bottom:56px` = **左下角**（已改 README + 模板注释并 `build.mjs` 重建） |
| clone 目标目录 | `D:\dsh-desktop` | **`D:\dsh\dsh-desktop-env`** |

### 22.3 改动文件

```
project-facts-v1.0.md          # 新增：事实源索引（F1–F11 + 快照文档清单）
AGENTS.md                      # 状态行/探测语义/凭据与同步（事实源指针 + 频率勘误 + 同步失败告警）
HANDOVER.md                    # §10.5 频率勘误、§15.7 复核注、§21.3 关闭待办、§21.5 收口说明、本节
README.md                      # v1.1：版本/端口/插件数(2→4)/§14 引用/clone 与构建路径 + 事实源指针
DEPLOY.md                      # clone 路径 + 锁版 0.1.5-rc.1 + 构建产物说明
deploy.ps1                     # 默认 -HarnessVersion 0.1.5-rc.1（F10 权威源）
setup.ps1                      # 用法注释同步
OPENCODE_PROMPT.md             # v1.1：路径 / 锁版 / 插件数(2→4，4 个 patch 条目) / 验收清单
plugins/dsh-client-ui-plugin-core-version/{README.md,src/bundle.template.js,lib/client.js,lib/index.js}
                               # 版本快照 0.1.5-rc.1 + 位置描述改左下角（重建 bundle 并复测冒烟）
```

### 22.4 当时的剩余 P0

- **P0-3 壳加固**：端口保留段自动避让（winnat）、崩溃自愈退避、`dsh.log` 大小上限。→ **②③ 已于 §23 完成，① 仍待做**
- **P0-4 fork 处置 + `SYNC_TOKEN`**：fork 只留官方镜像职责；`SYNC_TOKEN` 需用户**重新生成 PAT（repo + workflow scope）**并更新 fork 的 Actions secret，否则每天 08:00 的同步会继续失败（见 §22.2）。

---

## 23. 路径K：壳加固 ②③（崩溃自愈退避 + 日志上限）（2026-09-14）

> 范围：按用户选择做**低风险两项**——② 崩溃自愈退避与稳定重置、③ `dsh.log`/`debug.log` 大小上限与尾部读。**① 端口保留段自动避让本次未做**（它会把「端口 43080」从固定事实改成运行时值，牵动 `project-facts` F1 与多份文档，值得单独一次改动 + netsh 实测）。

### 23.1 改了什么

**③ 日志上限（新增 `logutil.go`）**
- `rotateIfTooBig(path, maxBytes)`：超过上限就把文件重命名为 `<path>.1`（覆盖上一次轮转）；**best effort**，被占用/失败一律忽略，绝不阻塞启动。
- `dsh.log` 上限 **5 MiB**（`dsh_windows.go` 的 `startDsh` 打开前轮转）；`debug.log` 上限 **1 MiB**（`debugLog` 每次都检查）。
- `tailFile(path, 64 KiB)` + `lastLines(text, 20)`：报错时**只从文件尾读 64 KiB**（原来 `os.ReadFile` 整文件读入内存），并从行边界裁掉可能被截断的首行。
- `tailDshLog()` 改为走 `tailFile`/`lastLines`。

**② 崩溃自愈退避与稳定重置（`app.go`）**
- 退避序列 `restartBackoff(n)`：**15s → 45s → 120s 封顶**（原来是发现退出就立刻重启，5s 一轮）。
- **修掉两个真实缺陷**：
  1. 原来 bootstrap 就绪时把 `restarts` 清零 → 「连续 3 次」预算**几乎永远用不到**；现在改为记录 `bootedAt`，只有**稳定运行满 5 分钟**才在监测循环里清零。
  2. 原来监测循环的条件是 `!owns || !booted → continue`，所以**自动重启若没起来（booted 仍为 false），监测就此休眠**，必须用户手点；现在只要 `owns` 就继续按退避重试，直到预算耗尽再停手并提示（文案里带上 `dsh.log` 尾部）。
- 用户主动操作（`Retry()` / `Restart()`）会**清零预算**；监测自身走内部 `restartOwned()`（不清零）。退避 `Sleep` 结束后会复查 `booting`/`owns`，避免与用户手动重启打架。

### 23.2 新增测试（`logutil_test.go`，6 个用例）

覆盖：轮转（缺失文件 / 未超限不轮转 / 超限改名 / 二次轮转替换旧 `.1`）、`tailFile`（尾部完整行、不撕裂行、小文件整读、缺文件报错）、`lastLines`（少于/等于/多于 n 行、空、纯换行、CRLF、n=0）、`restartBackoff`（序列 + 封顶 + 单调不减）。

```powershell
$env:GOTELEMETRY="off"; $env:GOCACHE="$PWD\.cache\go-build"; $env:GOTMPDIR="$PWD\.cache\go-tmp"
go vet ./...            # 0
go test ./...           # ok dsh-desktop — 9 个用例全过（6 新 + 3 旧）
GOOS=linux go vet ./... # 0（交叉验证 dsh_other.go 分支）
wails build -s          # 产物 build\bin\dsh-desktop.exe（11,333,632 字节）
```

> `gofmt -l` 会列出**所有** CRLF 工作树文件（含 `main.go` 等未改文件）——那是 git autocrlf 的行尾差异，不是格式问题；本次只修了 `logutil_test.go` 里一处真实空格问题。提交时不要顺手 `gofmt -w`（会产出整文件行尾 diff）。

### 23.3 部署现状（★ 需要用户做最后一步）

- **新 exe 已构建**，但**运行中的壳（PID 7244）持有 `D:\dsh\app\current\dsh-desktop.exe` 的文件锁**，无法覆盖（实测 `访问被拒绝`）。
- 因此部署方式为：新 exe 归档到 `app\versions\2026-09-14\`、并在 `app\current\` 旁放 `dsh-desktop.new.exe`，**由用户关闭壳后替换**。
- `.work\swap-desktop-exe.ps1` **已重写**（原来指向旧工作区路径与 3080，已作废）：等待→关闭壳→等文件锁释放→备份 `.bak`→换入→校验大小→重启。因为是壳 owns 当前会话的 dsh web，**这个脚本要作为一次性计划任务运行**（脱离会话进程存活），或从非壳子进程的终端运行：
  ```powershell
  pwsh -File D:\dsh\dsh-desktop-env\.work\swap-desktop-exe.ps1            # 默认等待 20s、自动重启
  pwsh -File D:\dsh\dsh-desktop-env\.work\swap-desktop-exe.ps1 -NoRelaunch # 只换不启
  ```

### 23.4 换壳实测（2026-09-15）：应用区文件换对了，但**运行的仍是旧壳**

用户按 §23.3 换好 exe 并重启后核查，发现一个**会反复咬人的陷阱**：

| | 路径 | 大小 | 含 P0-3 代码 |
|---|---|---|---|
| 当时**运行中**的壳（PID 7252，09-15 13:04 启动） | `D:\opencode\001\dsh-desktop\build\bin\dsh-desktop.exe`（**已冻结的旧工作区**） | 11,325,952 | ❌ |
| 应用区（用户已换入的新壳） | `D:\dsh\app\current\dsh-desktop.exe` | 11,336,632 | ✅ |

- **根因**：桌面快捷方式 `C:\Users\veken\Desktop\DeepSeek Harness.lnk` 的 TargetPath 一直指向**旧工作区**（`D:\opencode\001\dsh-desktop\build\bin\`）。即「从桌面图标启动」= 每次都跑冻结区的旧壳 —— 这正是 §20 交接里「当前运行的壳仍是从旧路径启动的」反复出现的原因。
- **已修**（2026-09-15）：快捷方式 TargetPath / WorkingDirectory / Icon 改为 `D:\dsh\app\current\dsh-desktop.exe`；`app\current\VERSION.txt` 更新为新构建信息，删除 `VERSION.new.txt`。
- **🔴 换壳检查清单（必须核对「进程」而不是「文件」）**：
  1. 关壳 → 覆盖应用区 exe（**壳运行时会锁住该文件**，实测 `访问被拒绝`）；
  2. 启动后核对**运行中的进程路径**：`Get-Process dsh-desktop | Select Id,Path` —— 不要只看磁盘上的文件（本次就是文件对了、进程不对）；
  3. 想确认新代码真在跑：在 exe 二进制里搜本次新增字符串（如「后自动重启（第 %d/%d 次）」）。
- 记录时 PID 7252 仍是旧壳；从（已修好的）桌面快捷方式再启动一次即可用上新壳。

### 23.5 未做 / 后续

- **① 端口保留段自动避让 —— 用户决定暂缓（2026-09-14）**：不做端口浮动，**保留固定 43080**；"躲开了但不会躲"的状态被接受，**等真遇到问题再处理**。
  - 触发信号（真出问题时照这个判）：① 壳报「启动超时（30 秒）」或「服务进程反复启动失败」；② `%APPDATA%\dsh-desktop\dsh.log` 里出现 **`EACCES` / `permission denied`** 且 `netstat` 查不到占用进程；③ `netsh interface ipv4 show excludedportrange protocol=tcp` 里 43080 落在某个保留段内（winnat/Hyper-V/WSL 动态保留）。
  - 届时的做法：端口改为运行时变量（`app.go` 的 `dshPort` → App 字段，两处 `--port` 传参照用）+ 定义「已存在实例」的复用判定（不能只看单一端口）+ 同步改写 `project-facts` F1 与 README/AGENTS 的端口表述。
  - 现状记录：2026-09-14 查 `netsh` **无任何排除段**，43080 可用。
- 顺带可做：前端状态面板目前只区分「运行/失败」，可加「自动重启第 n 次 / 已重置」的展示（事件已在发，面板未渲染细节）。

---

## 24. 路径L：fork 处置（B 方案，✅ 已完成）+ 上游官方桌面端发现（2026-09-15）

### 24.1 目标与备份

- 用户在 P0-4 的 fork 处置中选 **B 彻底**：删除 fork **独有**的根目录 `desktop/`（Wails 壳旧副本），fork 只保留「官方镜像 + `sync-upstream` workflow」职责。
- 可恢复来源（三处）：fork 的 git 历史、`.work/migration-2026-09-14/0001-*.patch` 与 `0002-*.patch`（0002 = 外部实例掉线自动接管，fork 壳唯一未被本仓库吸收的能力）、冻结旧工作区 `D:\opencode\001\dsh-desktop`。

### 24.2 事前核查（结论：删除安全）

- fork 根目录 `desktop/` 共 **43 个文件**，**fork 独有**（上游没有根级 `desktop/`）。
- 扫描根级配置是否引用它：**`pnpm-workspace.yaml`（唯一决定 workspace 成员的文件）无任何根级 `desktop/` 引用** → 删除不会破坏 workspace / CI 依赖解析；其余文件里出现的 "desktop" 全是上游自己的 `apps/desktop/`（官方 Electron 桌面端）与 `.agents/notes/*desktop*` 架构笔记。
- 工具：`.work/fork-desktop-refs.mjs`（node 拉取 fork 的根级配置文件，按「根级 `desktop/` 引用」过滤；可用它复查）。
- 🔴 **原则**：只能删/加 **fork 独有路径**；改动上游也有的文件会在每次 `sync-upstream` 合并时制造冲突。

### 24.3 可行方法（前两条实测走不通，第三条成功）

| 尝试 | 结果 |
|---|---|
| `git clone --depth 1`（前台，10 分钟超时） | **超时未完成**（实为带宽问题，见下） |
| `git clone --depth 1 --filter=blob:none --no-checkout` | 24.5s 成功（只拉 tree），**但无法提交**：`git grep` 惰性拉 blob 会卡死；`write-tree` 报 `invalid object … for '.editorconfig'`；改用 `mktree`（避开 write-tree 校验）也报 `object … is unavailable` → **任何造树操作都会校验对象存在性，blobless 克隆不能用来提交** |
| ✅ **后台全量浅克隆 `--depth 1 --single-branch`（后台任务无超时）** | **成功**：11,310 文件 / **113.4 MB**，实测带宽约 26 KiB/s，耗时约 15 分钟；随后 `git rm -r desktop` + 提交 + 推送 **5.4s** 完成 |

- **结论/经验**：这类大仓库操作在**后台任务**里跑（前台命令有超时上限），完成后本地提交推送（几秒）。blobless 偏克隆只适合「只看路径/树」的场景。
- 另两个坑：① 被超时中断的 git 操作会留 `.git/index.lock`，重试前必须清（并检查残留 `git` 进程）；② PowerShell 向原生命令管道传行会带 CR（`mktree` 报 `'.editorconfig?'`），且 `2>&1` 会把 stderr 变成 ErrorRecord 导致 `.Trim()` 失败。

### 24.4 执行结果（B 已完成）

- 提交：**`41aaec8`** `chore: drop the fork-only desktop/ Wails shell`，父提交 `810c1c8`。
- 推送：`810c1c8..41aaec8  master -> master`；远端核验 `git ls-remote origin refs/heads/master` = **`41aaec8…`**。
- 结果：fork 顶层条目 **60 → 59**（`desktop/` 已消失），`git ls-tree HEAD desktop` 为空；本地克隆（113.4 MB）已删除。
- fork 现状：**纯官方镜像 + `sync-upstream` workflow**，与上游的差异只有那个 workflow 文件本身（`desktop/` 的删除是叠加在镜像之上的一个 commit，其后合并上游不会冲突，因为上游没有根级 `desktop/`）。
- 备注：REST API 路线（原本准备的 4 步，见下）**未使用**，但保留备查：

```
1) GET   /repos/FFaassdfs/deepseek-harness/git/refs/heads/master        # 取 base commit
2) POST  /repos/.../git/trees   { base_tree, tree:[{path:"desktop", mode:"040000", type:"tree", sha:null}] }
3) POST  /repos/.../git/commits { message, tree, parents:[base] }
4) PATCH /repos/.../git/refs/heads/master { sha:newCommit, force:false }
```

### 24.5 🔴 重大发现：上游已有一方官方桌面端 `apps/desktop/`（Electron，**implemented**）

排查引用时发现，**上游自己就有桌面端**，而且是已实现状态（`.agents/notes/implemented/architecture/2026-08-25-electron-desktop-packaging-and-updates.md` 等 4 篇 plus 2026-09-08/09 多篇 implemented 笔记）。

- **形态**：Electron 壳，**不开任何监听端口**（framed byte pipes 传 Fetch/流式响应 + Node IPC 传生命周期 + `dsh-app://` 提供前端资源）；打包自带上游 Node.js 与 pnpm、以及完整 dsh 生产依赖树；独占 **`$DSH_HOME/profiles/desktop`**；有签名/公证/差分自动更新（macOS arm64/x64 + Windows x64；Linux 不是发布目标）。
- **对我们项目的直接影响（务必知道）**：
  1. **官方桌面端不提供 `webServer`** —— upstream README「Known limitations」明写：Web 的 "Open In..." 在 Desktop 被禁用，因为其 host 插件需要 HTTP 路由。而我们 4 个插件的 **host 半区全部依赖 `ctx.webServer.register` 自定义路由**（explainer 的 toggle、project-explorer 的 root/list/open、model-capabilities 的 list、core-version 的 version）→ **若切到官方 Desktop 的 profile，这些路由会拿不到 `webServer`，插件必须换传输层**（改走 remote/RPC，或把数据内嵌进 ui slot）。这是真实迁移成本，提前记下。
  2. 我们的 launcher（Wails + 43080 端口 + `profiles/web` + 交系统浏览器）与官方是**两条路线**；官方既已实现且带自动更新，长期可考虑把精力从「自维护壳」转向「插件与配置」。
  3. 官方 profile 名 `desktop` 与我们的 `web` **互不共享可执行包**（上游明确：CLI 不能 boot/mutate desktop profile）。
- **待办（建议）**：①评估是否改用官方 Desktop 作为日常入口（需拿到安装包或自行 `pnpm run package:desktop*`）；②评估 4 个插件 host 路由的去 `webServer` 迁移方案。

### 24.6 ✅ `SYNC_TOKEN` 已修好并端到端验证（2026-09-15）

- 用户生成新 PAT（`repo` + `workflow` scope）并更新 fork 的 Actions secret，随后**手动触发**了一次 workflow。
- 验证结果（用新增的 `.work/sync-status.mjs` 实测）：
  - **run #49 `workflow_dispatch` → `success`**；而 #47（09-14）、#48（09-15 02:23Z）均 `failure`。失败原因是工作流第一步 `actions/checkout` 用的就是 `secrets.SYNC_TOKEN`，token 失效时它直接失败 —— #49 成功即说明 **token 有效**。
  - 更硬的证据：`compare upstream/master...fork/master` → **`behind_by = 0`**，merge-base = 上游当前 tip **`0d1f500`（2026-09-15T03:16Z 才产生，晚于失败的 #48）**。fork 原先停在 09-11 的合并点 `a6622e9`，是 **#49 真正执行了 `merge upstream/master` 并成功推送**（产出合并提交 `810c1c8`）—— 这条路径必须有有效 token 才能走通，**不是"已同步"提前退出的假成功**。
  - 之后我们的删除提交 `41aaec8` 以 `810c1c8` 为父正常 fast-forward 推上去。
- **新工具 `.work/sync-status.mjs`**（不需要本地 fork 克隆，直接走 REST API；旧 `.work/sync-upstream.ps1` 需要先 clone fork）：打印最近 5 次 sync 运行 + fork/upstream 的 ahead/behind，若最新一次非 success 或 fork 落后上游则**退出码 1**，可用于巡检。用法：`node .work\sync-status.mjs`。
- 结论：fork 现为**纯官方镜像**（`behind_by = 0`，与上游唯一差别只剩 `sync-upstream.yml` 本身），每日 08:00 的定时同步恢复正常，**P0-4 全部关闭**。

---

## 25. 路径M：其他电脑"一条命令更新壳"（含修复被 §24 打断的构建路径）（2026-09-15）

### 25.1 问题：§24 删掉 fork 的 `desktop/` 后，其他电脑的构建路径断了

- 用户需求：**"确保其他电脑同步仓库的项目即可更新到最新壳版本"**。
- 但 `setup.ps1` 第 5 步原先的做法是「**clone `FFaassdfs/deepseek-harness` fork → 构建 `fork/desktop/`**」—— 该目录已在 §24 被删除（B 方案），**这条路径对任何新机器/老机器都已失效**。
- 事实核查（结论：不需要 fork）：**壳源码本来就完整入库在本仓库**：`app.go`/`main.go`/`dsh_windows.go`/`dsh_other.go`/`windowstate*.go`/`logutil*.go`/`go.mod`/`go.sum`/`wails.json`/`frontend/{index.html,package.json,package-lock.json,src,wailsjs}`/`build/{appicon.png,windows/*,darwin/*}`（共 100 个 tracked 文件）。

### 25.2 改了什么

| 文件 | 变更 |
|---|---|
| **`update.ps1`（新增）** | 「一条命令更新」：① `git pull --ff-only`（并列出新提交）② 刷新 4 个插件（`scripts/setup-plugins.mjs`）③ `wails build`（本仓库；前端 `node_modules` 缺失时先 `npm install`）④ 部署到应用区 `D:\dsh\app\current`（dated 归档 + `VERSION.txt`）。开关：`-SkipPull` / `-SkipPlugins` / `-SkipFrontend`（= `wails build -s`）/ `-SkipBuild` / `-NoDeploy` / `-AppDir` / `-CheckOnly`。**应用区 exe 被运行中的壳锁住时自动暂存为 `dsh-desktop.new.exe` + `VERSION.new.txt`** 并给出换法提示 |
| **`setup.ps1`** | 第 5 步由「clone fork + 构建 desktop/」改为「**在本仓库根 `wails build`**」；头部注释同步（两个插件 → 四个）；收尾提示后续用 `update.ps1` |
| `.work/verify-fresh-clone.ps1`（新增） | 回归验证：**克隆 HEAD 到临时目录** → 检查构建所需文件是否都在 git 里 → `npm install` + `wails build` → 校验 exe（大小 + P0-3 标记）。另有 `-SkipBuild`/`-Keep` |
| `README.md` / `DEPLOY.md` / `OPENCODE_PROMPT.md` | 新增/改写「更新到最新壳」入口：`git pull` + `pwsh -File update.ps1`；并明确「壳源码在本仓库、fork 的 `desktop/` 已废弃（§24）」 |

### 25.3 验证（都是实跑，不是推断）

**① 全新克隆能否构建** —— `pwsh -File .work\verify-fresh-clone.ps1`（克隆 HEAD=`7f5291d` 到 `.cache\fresh-clone`）：
- 构建所需 **21 个文件全部在克隆里**（tracked 文件共 100 个）✅
- `npm install`（frontend，14 包）13s → `wails build`（完整：生成绑定 + 前端 install/compile + 编译）**21.99s** ✅
- 产出 `build\bin\dsh-desktop.exe` = **11,333,632 字节**（与本机应用区那份**大小完全一致**），且**含 P0-3 的退避字符串** ✅

**② `update.ps1` 部署路径**（用临时 `-AppDir` 测，不碰真实环境）：
- `-SkipBuild` 部署：归档 → `versions\2026-09-15\dsh-desktop-170117.exe`，部署 → `current\dsh-desktop.exe`，写 `VERSION.txt`（含 `built:` exe 真实构建时间 / `deployed:` / source commit / port / core 版本 / launch 路径）✅
- `-CheckOnly`：只打印将要做的事，**不写任何文件** ✅

### 25.4 其他电脑的正确用法（写进 README/DEPLOY/OPENCODE 了）

```powershell
cd D:\dsh\dsh-desktop-env
git pull
pwsh -File update.ps1            # pull + 插件 + 构建 + 部署
# 只改 Go：pwsh -File update.ps1 -SkipFrontend
# 干跑：   pwsh -File update.ps1 -CheckOnly
```
- 换壳后**必须重启壳**才生效（运行中的壳 owns GUI 会话的 dsh web，重启会中断该会话）。
- 应用区默认 `D:\dsh\app\current`（可用 `-AppDir` 改）；**不同步的内容**：API key/`.env`、exe 本身（各机自行构建）、`$DSH_HOME` 下的会话与凭据。

---

## 26. 路径N：统一启动入口（首装/更新同一落点）+ 版本锚点刷新（2026-09-20）

### 26.1 修掉的不一致：首装与更新落在不同地方

§25 之后仍有一处不一致：**首次安装**（`setup.ps1` 第 5 步）把 exe 留在 `<仓库>\build\bin\`，而**日常更新**（`update.ps1`）才部署到应用区 `D:\dsh\app\current\`。新机器上因此有**两个候选启动路径**——正是 2026-09-15 那次"快捷方式指向旧路径、跑的还是旧壳"的同类隐患。

**改法（抽出共享实现，两处共用同一段代码）**：

| 文件 | 变更 |
|---|---|
| **`scripts/deploy-shell.ps1`（新增）** | 部署逻辑唯一实现：校验 exe（存在 + >1MB）→ 归档到 `<appRoot>\versions\<日期>\dsh-desktop-<时分秒>.exe` → 覆盖 `<AppDir>\dsh-desktop.exe`（**校验大小**）→ 写 `VERSION.txt`（built/deployed 时间、source commit、port、core 版本、launch 路径）；**目标被运行中的壳锁住时**改存 `dsh-desktop.new.exe` + `VERSION.new.txt` 并给出换法。支持 `-BuiltExe` / `-AppDir` / `-RepoRoot` / `-CheckOnly` |
| `setup.ps1` | 第 5 步构建完**接着调用** `deploy-shell.ps1`（新增 **5b** 步）；新增 **`-AppDir`** 参数；收尾提示改为「启动应用区那份」 |
| `update.ps1` | 第 4 步的部署代码改为**调用同一脚本**（删掉重复实现） |
| `deploy.ps1` | 新增 `-AppDir` 并透传给 `setup.ps1`（哈希表 splatting） |
| `README.md` / `DEPLOY.md` / `AGENTS.md` / `project-facts` | 统一表述：**唯一启动入口 = `D:\dsh\app\current\dsh-desktop.exe`**；`build\bin\` 那份只是中间产物 |

**实测**（用临时 `-AppDir`，不碰真实环境）：`setup.ps1 -CheckOnly` 与 `deploy.ps1 -CheckOnly -AppDir D:\tmp-app\current` 都正确显示落点；`update.ps1 -SkipBuild` 走共享脚本完成 归档+部署+`VERSION.txt`；`deploy-shell.ps1 -CheckOnly` 独立可用；4 个脚本 `Parser::ParseFile` 全部 OK。

### 26.2 顺带发现的版本锚点漂移（已修）

做上面验证时发现本机环境已前进：

- **全局 harness 已升到 `0.1.5-rc.2`**（`dsh --version`；`npm dist-tags.latest` 同日也是 `0.1.5-rc.2`，`alpha` 通道为 `0.1.6-alpha.2`）——上一次记录（§21/§25）还是 `0.1.5-rc.1`，**`deploy.ps1` 的锁版还停在 rc.1**，`setup.ps1 -CheckOnly` 已如实报 `dsh version is '0.1.5-rc.2', target is '0.1.5-rc.1'`。
- 已把锚点统一刷到 **`0.1.5-rc.2`**：`deploy.ps1` 默认值（F10 权威源）、`setup.ps1` 用法注释、`DEPLOY.md`（含锁版说明）、`README.md`、`OPENCODE_PROMPT.md`（命令 + 预期 `dsh --version`）、`AGENTS.md` 状态行与探测说明、`project-facts` F2/F10、core-version 插件 README 与 host 注释。

**rc.2 下的插件复验（实测通过）**：`43080` 根 = `401`（正常）；host 路由 `core-version`=**200**、`model-capabilities`=**200**、`project-explorer`=**200**；`node scripts\setup-plugins.mjs --check-only` 全过（4 插件 `dsh.client` 声明 OK + patch YAML 含 4 个 id）；运行中的壳仍来自应用区 `D:\dsh\app\current\dsh-desktop.exe`。

> 附：`global/AGENTS.md` 与安装副本 `~/.dsh/AGENTS.md` 已核对**完全一致**（同哈希、同 mtime 2026-09-18 17:02，均为 v2.17）——无需同步。

---

## 27. 路径O：便携发行包（壳 + harness + Node 全离线）+ CI 发布（2026-09-20）

### 27.1 为什么做

用户要求"仓库发布一个正式包，含壳与 harness 核心，第一次安装所有文件都在本地、速度快"。目标机器**什么前置都不装**（Node/npm/Go/Wails 全免）。方案经评估取 **C 档**：壳 exe + 离线 harness 依赖树 + 便携 Node。

### 27.2 关键可行性实测（决定了包怎么做）

| 检查 | 结果 |
|---|---|
| harness 依赖是否被提升到 npm 根 | **没有**：`commander`/`open`/`zod`/`@deepseek-ai/cordis` 等**全部嵌套在 `@deepseek-ai\dsh\node_modules`**（190 项）→ **只拷这一棵树就完整**，不必拷整个全局 npm root |
| 原生模块 | 树内仅 **11 个 `.node`**，且是**跨平台预编译**（darwin/linux/win32 各架构齐备）→ win-x64 目标机**无需编译**；但预编译与 **Node ABI** 绑定 ⇒ 必须同时带 Node（故取 C 档） |
| 体积 | dsh 树 213.4 MB / 25,447 文件；`node.exe` 88 MB；壳 10.8 MB；插件 0.2 MB ⇒ 原始 **312.6 MB / 25,482 文件**，**zip 后 106.2 MB**（tar.exe 压缩 25.1s） |

### 27.3 壳的改动：便携运行时解析（`runtime.go` + 两处接线）

原先只能靠 PATH 找 `dsh.cmd` shim。现在新增**便携运行时优先**：

```
解析顺序：$DSH_DESKTOP_RUNTIME → <exeDir>\runtime → <exeDir> →（回退）原有 dsh.cmd shim 逻辑
运行布局：<某目录>\node.exe + <某目录>\node_modules\@deepseek-ai\dsh\lib\bin.js
```

- 新增 `runtime.go`（跨平台纯函数，便于单测）：`portableRuntimeIn` / `runtimeCandidateDirs` / `findPortableRuntime` / `bundledRuntimeInUse` / `executableDir`。
- `dsh_windows.go`：`resolveDshWeb()` **先试便携运行时**，命中则用 `runtime\node.exe` + 包内 `bin.js`（保留 shim 回退）。
- `dsh_other.go`：非 Windows 同样支持便携运行时（`runtimeNodeName()`）。
- `app.go`：`installedVersion()` 优先读**包内** manifest；`versionFromPackageJSON()` 抽出复用；**`checkUpdates()` 在便携模式下跳过 npm 自更新**（面板显示「内置运行时 <ver>（便携版随发行包更新，已跳过 npm 自更新）」）——避免全局 dsh 与包内运行时版本分裂。
- 测试：新增 `runtime_test.go`（5 个用例）+ `dsh_windows_test.go`（1 个用例，直接验证 `resolveDshWeb` 会选包内 runtime）→ **全部 17 个用例通过**，`go vet`（含 `GOOS=linux`）为 0。

### 27.4 打包与安装脚本

- **`scripts/pack-release.ps1`**：装配并压缩出便携包，产出 `dsh-desktop-<shell>-dsh<dshver>-win-x64.zip` + `SHA256SUMS.txt`。布局：
  ```
  dsh-desktop-<shell>-dsh<dshver>-win-x64\
    dsh-desktop.exe                 # 壳（自己认 ./runtime）
    runtime\node.exe + LICENSE      # 便携 Node
    runtime\node_modules\@deepseek-ai\dsh\...   # harness + 全部依赖
    plugins\<4 个包>  scripts\setup-plugins.mjs  install-offline.ps1
    VERSION.txt  README.txt
  ```
  开关：`-NoNode`（不带宽 Node，体积小但目标机需自备 Node）/ `-SkipZip` / `-KeepStaging` / `-CheckOnly` / `-RuntimeSource` / `-NodeExe` / `-ShellVersion` / `-DshVersion`。
- **`install-offline.ps1`**（随包发、也可单跑）：① 校验包布局 ② 用**包内 Node** 跑 `scripts/setup-plugins.mjs` 把 4 个插件装进 `$DSH_HOME`（幂等；支持 `-DSHome`）③ 可选 `-AppDir` 把 exe+runtime 拷到应用区。
- **`install-offline.cmd`**（随包发）：上面那个 .ps1 的**双击包装**（`powershell -ExecutionPolicy Bypass -File ...`，并 `pause` 保留窗口）——因为 Windows 双击 `.ps1` 不会执行、且默认执行策略可能拦截。**双击后默认以 `-Plugins ask` 弹出插件选择菜单**（全装 / 逐个选 / 不装）；若调用方自带 `-Plugins`，包装器就不再追加。包内 `README.txt` 已明确写「**没有安装步骤，解压即用**；该脚本只是可选地把插件装进 DSH_HOME」，并补充 **WebView2 Runtime** 前提。
- **插件选择能力（2026-09-20 加）**：
  - `scripts/setup-plugins.mjs` 新增 `--plugins <all|none|逗号列表>`：token 可用**简名**（`explainer`）、全名（`dsh-client-ui-plugin-explainer`）或 patch id（`plugin-explainer`）；`--plugins` 缺值或名字未知都**立即报错并列出可选项**；`none` 直接退出不写任何东西；`verifyPatch` 只校验**被选中**的 patch 条目。
  - `install-offline.ps1` 新增 `-Plugins <all|none|ask|列表>`（默认 `all`）；`ask` 时弹编号菜单（`a` 全装 / `n` 不装 / 输入 `1,3` 选装）；**无控制台**（`-not [Environment]::UserInteractive` 或 **stdin 被重定向**）时自动退化为全装，避免挂死 agent/计划任务。
  - 实测：`--plugins explainer`（只校验该插件、patch 仍报 4 条目）、`--plugins none`、未知名/缺值报错、包内 `-Plugins none|explainer,core-version|all` 三条落位正确（临时 DSH_HOME 里确实只出现被选的插件）、`-Plugins ask` 重定向 stdin 不挂起。

**本地实测（2026-09-20）**：
- 打包成功：`dsh-desktop-a3f4804-dsh0.1.5-rc.2-win-x64.zip` = **106.2 MB**（原始 312.6 MB / 25,482 文件），SHA256 已生成。
- **离线树可用**：`<pkg>\runtime\node.exe <pkg>\runtime\node_modules\@deepseek-ai\dsh\lib\bin.js --version` → **`0.1.5-rc.2`**（证明依赖树完整、无缺失提升依赖）。
- **离线安装器可用**：`install-offline.ps1 -DSHome <临时目录>` → `SETUP OK`，临时 DSH_HOME 里出现 4 个插件 `node_modules` 目录 + patch 条目（用完已删，未碰真实 `$DSH_HOME`）。
- ⚠️ **无法在本机做实机便携启动**：壳有 `SingleInstanceLock`（`main.go`，`UniqueId: dsh-desktop-9a7f1e2b`）——本机已跑着正式壳，第二个实例会立刻退出（这正是测试时"秒退、无日志"的原因）。**该限制要写进说明**（便携包不能与本机已装壳同时运行）。便携模式的接线由单测覆盖，**真正"便携 exe 拉起自带 runtime"需在目标机验证**（那也正是使用场景）。

### 27.5 CI：打 tag 自动出包并发 Release

- 新增 **`.github/workflows/release-desktop.yml`**：`push: tags: ['desktop-v*']`（或手动 `workflow_dispatch` 指定 tag）→ `windows-latest` 上：setup Go 1.26.x / Node 24 → 装 Wails CLI → `wails build` → `npm install --prefix staging @deepseek-ai/dsh@<ver>`（`<ver>` 取输入或 npm latest）→ 下载官方 Node zip 取 `node.exe`+`LICENSE` → `scripts/pack-release.ps1` → `softprops/action-gh-release@v2` 挂上 `*.zip` + `SHA256SUMS.txt`。
- 发布用**内置 `GITHUB_TOKEN`**（`permissions: contents: write`），**不需要 PAT**；只有"把该 workflow 文件本身推上去"这一次需要带 `workflow` scope 的凭据。
- YAML 已用 js-yaml 校验（name/on/permissions/9 个步骤解析正常）。**CI 本身尚未在真实 runner 跑过**——首次发 tag 时观察。

### 27.6 待办 / 风险

1. **首次真实发版**：打 `desktop-v0.1.0` tag 触发 workflow（或先 `workflow_dispatch` 试跑），确认 9 步全绿、资产挂上。
2. **许可证合规**：包内分发第三方依赖树 + Node，需随包保留 Node 的 `LICENSE`（已带）与各包 LICENSE/notices；若公开发布，建议生成一份 `THIRD_PARTY_NOTICES.txt`。
3. **未签名**：SmartScreen 会警告（现状如此）；要消除需代码签名证书。
4. 可选：把"壳自更新"从 npm 改为**下载新发行包**（便携模式下目前只提示"随发行包更新"）。

### 27.7 🔴 首发事故与修复：hoisted 布局导致的"坏包"（2026-09-20 当天）

**现象**：`desktop-v0.1.0` 首发 CI **报告 success**，但资产只有 **37.7 MB**（本地同样脚本打出来是 ~106 MB）。下载核对确认：`runtime\node_modules\@deepseek-ai\dsh\` 里**只有 dsh 自身**，`commander`/`open`/`zod` 等**兄弟依赖全缺** → 内置运行时 `ERR_MODULE_NOT_FOUND`，包等于坏的。

**根因（npm 布局随安装方式而变）**：

| 安装方式 | 依赖位置 | 只拷 `@deepseek-ai/dsh` 一棵树的结果 |
|---|---|---|
| `npm i -g`（我本地打包时用的） | **嵌套**在 `@deepseek-ai/dsh\node_modules`（190 项） | 完整 ✅ |
| `npm install --prefix <dir>`（CI 用法） | **提升**到 `<dir>\node_modules` 根，dsh 目录里**没有** `node_modules` | 空壳 ❌ |

**修复（`scripts/pack-release.ps1`）**：
1. 新增 **`-RuntimeMode auto|dsh-tree|full-node-modules`**（默认 `auto`）：auto 检测 `<dshTree>\node_modules` 是否存在 → 有=nested→`dsh-tree`；无=hoisted→`full-node-modules`（整棵 `node_modules` 一起拷，CI 的 staging 前缀刚好就是完整闭包）。
2. **新增运行时自检闸门**：装完后**实跑** `runtime\node.exe …\dsh\lib\bin.js --version`，**严格要求 `exit=0` 且首个非空行恰好等于目标版本**，否则 `throw` —— 坏包**不可能**再发出去。
   - ⚠️ 闸门自身也踩过一次假通过：第一版用"整段输出里包含版本号"判断，而 staging **路径本身**含版本号（`…dsh-desktop-053340c-dsh0.1.5-rc.2-win-x64\runtime\…`），错误堆栈因而被判为通过 → 已改为严格比较（退出码 + 首行全等）。
3. 三个用例实测：hoisted+auto→`full-node-modules`（213.7 MB）自检通过；全局 nested+auto→`dsh-tree`（213.4 MB）自检通过；**强制 `dsh-tree` 跑 hoisted → 抛 `staged runtime is NOT runnable (exit=1, first line=…)` 且退出码 1**（证明闸门有牙）。

**重新发布**：删除并重推 `desktop-v0.1.0` 标签（softprops 动作会**就地更新**同名资产）→ **run #2 = success，资产 104.9 MB**（与本地一致）。

**发布资产端到端验证（2026-09-20，全部通过）**——从 GitHub Release 下载后实测：

| 步骤 | 结果 |
|---|---|
| 下载 | 104.9 MB（1,099 字节级一致：109,978,357 bytes；链路慢且会断流，脚本改成**流式 + Range 断点续传 + 重试**才拉完，耗时 ~19 分钟） |
| **SHA256 比对** | 线上 `SHA256SUMS.txt` = `328E61DC…0C27`，本地实测 **完全一致** ✅（首次"不匹配"是本机验证脚本没检查响应状态拿到了空内容，非产物问题） |
| 归档内容 | 包根 = `dsh-desktop.exe` / `install-offline.cmd` / `install-offline.ps1` / `plugins/` / `runtime/` / `scripts/` / `README.txt` / `VERSION.txt`；`runtime/node_modules` 下 **190 个依赖目录**（`commander`/`express`/`open`/`zod`/`koffi`/`js-yaml`… 全在）✅ |
| **实跑包内运行时** | 解压后 `runtime\node.exe runtime\node_modules\@deepseek-ai\dsh\lib\bin.js --version` → **`0.1.5-rc.2`，exit=0** ✅ |
| 磁盘占用 | 314.0 MB / 25,487 文件；`VERSION.txt` 记录 shell commit `0.1.0`、harness `0.1.5-rc.2`、**CI 自带 Node v24.20.0**（本机打包用的是 v24.16.0——CI 用 runner 上的官方 Node zip，同主版本即 ABI 兼容） |

> 验证脚本 `.cache/verify-published.mjs` / `.cache/finish-verify.mjs`（未入库，属 scratch）。其中踩到两个本机脚本坑，记下备用：① `fetch` 拿 Release 资产**必须检查 `resp.ok`**，否则失败时会得到空内容而误判；② `execFileSync("tar.exe", ["-tf", zip])` 对 2.5 万个条目的输出会撞 **`ENOBUFS`（默认 maxBuffer 1 MB）**，需要调大 `maxBuffer` 或改用 pwsh 直接跑 tar。

> **教训（写进本节，供后续发版遵循）**：**CI 绿灯 ≠ 包能用**。凡是"把运行时打进去"的产物，**打包器必须自己跑一次再放行**；此外凡是依赖 npm 布局的逻辑，都要显式区分 `-g`（嵌套）与 `--prefix`（提升）。

### 27.8 实测经验（顺手更正一条旧说法）

- 🟢 **SSH push 可以直接推送 `.github/workflows/*` 文件**：本次把 `release-desktop.yml` 用 `git push`（SSH 443）推上去，**未被拒绝**，且 GitHub API 立即把它列为 `state=active`。→ 旧文档"推送 workflow 必须用带 `workflow` scope 的 PAT"**只对 token 方式成立**（PAT/OAuth；CI 里的内置 `GITHUB_TOKEN` 也推不了 workflow）。`AGENTS.md` 高频坑已就地更正。
- ⚠️ **壳的 `SingleInstanceLock`（`main.go`，`UniqueId: dsh-desktop-9a7f1e2b`）导致无法在同机并行验证便携包**：本机已跑正式壳时，便携包 exe 会**立刻退出**（并向第一个实例发"显示窗口"请求）。已把这条写进包内 `README.txt` 与 `install-offline.ps1` 的输出；**真正的便携启动验证要在目标机做**（也正是它的使用场景）。
- 📦 本次本地测试产物（未入库，`.cache` 已被 gitignore）：`.cache\release\dsh-desktop-a3f4804-dsh0.1.5-rc.2-win-x64.zip`（106.2 MB）+ `SHA256SUMS.txt`，可直接拷到别的机器试。

### 27.9 便携版自更新：与源码装"行为一致、机制不同"（2026-09-20 二次迭代）

**用户要求**：便携版在自动更新上要和源码/脚本装一样 —— 查 registry、有新版自动装、提示「重启服务」生效。

**为什么不能照搬 `npm i -g`**：便携壳读的是**包内 `runtime\`**，全局 npm 那份它根本不看（便携包也不依赖系统 Node/npm）→ 装全局等于白装。所以做了**等价改造**：

| 环节 | 源码/脚本装 | 便携版（本次实现） |
|---|---|---|
| 触发 | 启动 + 每 24h | **相同**（`checkUpdatesLoop`） |
| 查版本 | `registry.npmjs.org` 的 `dist-tags.latest` | **相同**（复用 `latestVersion()`） |
| 下载 | `npm i -g @deepseek-ai/dsh` | **包内 npm** 装到 `<包目录>\.update`（`npm install --prefix .update @deepseek-ai/dsh@<ver>`） |
| 生效 | 点「重启服务」 | **相同**；重启时把 `.update\node_modules` 换到 `runtime\node_modules` |
| 提示文案 | 发现新版本…正在自动更新…已更新，请重启 | **相同**（`app.go` 的 `checkBundledUpdate`） |

**前提**：包内必须带 npm（实测 **11.3 MB / 1874 文件**，可直接用包内 node 驱动：`node runtime\node_modules\npm\bin\npm-cli.js --version` → `11.13.0`）。`pack-release.ps1` 现在默认打进去（`-NoNpm` 可关），并加了一道 **npm 可运行性检查**。包内 npm 不存在时，壳会如实提示「本包未内置 npm，无法自更新；请下载新版发行包」。

**安全设计（为什么用"暂存 + 重启交换"而不是原地覆盖）**：运行中的 dsh web 占着 `runtime\` 里的文件，Windows 上原地替换会失败/留下半残树。实现（`runtime.go` + `app.go`）：

1. `stageBundledRuntime()`：用包内 npm 装到 `<pkg>\.update`（cache 指向 `<pkg>\.npm-cache`，全程无窗口）→ 装完**跑一次** `node .update\...\bin.js --version` 验证，版本不符就丢弃并报错。
2. `applyPendingRuntimeUpdate()`：**在启动任何东西之前**调用 → 再次验证暂存树 → `swapRuntimeModules()` 把 `runtime\node_modules` 改名为 `node_modules.old`、把暂存的换进去 → 再探针一次；**探针不过就自动回滚**。
3. 新运行时**成功启动后**（bootstrap ready）删掉 `node_modules.old`（`cleanupRuntimeBackup`）。
4. `node.exe` 与 LICENSE **始终不动**（只换 `node_modules`），所以 node 自身的 ABI 不变。

**单元测试**（`runtime_test.go`，共 22 个用例全绿）：`bundledNpmCLI` 存在/缺失、`stagedRuntimeIn` 完整性判定、`swapRuntimeModules` 交换成功 + **回滚还原** + 暂存缺失时报错且不动现有树、`cleanupRuntimeBackup`、`firstLine`。`go vet`（含 `GOOS=linux`）为 0。

**注意事项**：
- 包若解压到**只读位置**（如 `C:\Program Files`），暂存安装会失败 → 壳会提示失败原因（可下载新版发行包兜底）。
- 更新走 npm，需要能访问 registry.npmjs.org。
- 自更新只换 harness；**壳自身**仍随发行包更新（未来可加"下载新 zip"）。

**🔴 同一模式的第二次事故（同日，已修）**：`desktop-v0.1.1` 首次构建又是"绿灯但缺东西" —— 资产仍是 **104.9 MB**，与 0.1.0 完全相同，而包内多 11.3 MB 的 npm（压缩 ≈4.4 MB）本应让包变大。核对工作流：**CI 只把 `node.exe` 与 `LICENSE` 拷进 staging，没拷 `node_modules\npm`**；打包器从"node.exe 所在目录"取 npm → 探测失败后**只 Warn 跳过** → 于是又出了一个不能自更新的包。修复两处：
1. **工作流**：解压 node dist 后把 `node_modules\npm` 一并拷进 staging，并**立即断言** `staging\node_modules\npm\bin\npm-cli.js` 存在（否则一步失败）。
2. **打包器**：npm 缺失（未显式 `-NoNpm`）从 Warn 改成 **throw** —— 发版承诺了自更新，不许静默丢能力。
重推 tag 后 **run #4 = success，资产 109.3 MB**（+4.4 MB ≈ npm 压缩增量）→ npm 确实进包了。
> **教训（与 §27.7 同源）**：凡是"包内应包含某物"的承诺，都要在**打包时**有断言并**失败**；用"事后比对体积"发现问题虽然有效，但不该是主防线。

**0.1.1 发布资产端到端验证（2026-09-20，全部通过）**：

| 步骤 | 结果 |
|---|---|
| 下载 | 109.3 MB（链路约 117 KiB/s，**断点续传**共耗 48 分钟才拉完） |
| **SHA256** | 线上 `ac87c542b74cf5080d6be45e7497529b59f12556be7f45b44345e745611b0f0e` = 本地实测，**MATCH** ✅ |
| 归档内容 | 共 **31,180 条**；`runtime/node.exe`、**`runtime/node_modules/npm/bin/npm-cli.js`**、`npm/package.json`、`@deepseek-ai/dsh/lib/bin.js`、`commander/package.json`、`express/package.json` **全部存在** ✅ |
| 解压实跑 | **bundled dsh → `0.1.5-rc.2`**；**bundled npm → `11.19.0`** ✅ |
| `VERSION.txt` | 含 `npm: bundled (enables in-package self-update)`、`node: v24.20.0 (bundled)` ✅ |

⇒ **发布出去的 0.1.1 具备"与源码装一致的自更新能力"**（包内 npm 在位 + 机制已本地端到端演练）。

### 27.10 手动覆盖升级（"解压新包覆盖旧目录"）的注意事项 + 版本保护（2026-09-20，随 0.1.2 发布）

用户会问："**把新版解压覆盖到旧目录能不能直接用？**" 结论：**可以**，但有三个条件与一个隐患。

**三个条件 / 注意点**：
1. **必须先完全退出正在运行的那个壳**（含它拉起的 dsh web）：运行中 `dsh-desktop.exe`、`runtime\node.exe` 等被锁，边跑边覆盖会失败或留下半残目录。
2. **插件不会跟着更新**：生效副本在 `$DSH_HOME\profiles\node_modules`，包内 `plugins\` 只是**源码** → 想更新插件要重跑 `install-offline.cmd`（幂等，可用 `-Plugins` 选择）。
3. **`$DSH_HOME` 不受影响**：会话/设置/凭据/插件都在 `%USERPROFILE%\.dsh`，与包目录无关，覆盖不丢东西。

**隐患（已在 `3d82ee9` 修，0.1.2 起带此保护）**：`applyPendingRuntimeUpdate()` 原本只看"暂存树能不能跑"，**不比较版本**。用上带自更新的包后，若目录里留着**更早暂存的 `.update`**（zip 里没有这个目录，**覆盖解压不会删掉它**），下次启动会把它换进去 → **harness 被降级**。现在：
- 暂存版本 **不严格高于**在装版本 → **丢弃**（`compareDshVersions`，支持 `0.1.5-rc.2` 这类预发布：release > 同号 prerelease；容忍前缀 `v` / `+build`；不可解析时退化为字符串比较，不 panic）；
- 已在最新版时顺手清掉陈旧暂存目录。

**推荐的三种升级姿势**（稳→省事）：① 解压到**新目录**、确认能跑再删旧目录（零残留，最稳）；② 原地覆盖：先退壳 → 覆盖 → 手动删 `.update` 与 `runtime\node_modules.old` → 启动；③ 什么都不做，等它自更新 + 点「重启服务」。

### 27.11 运行时改为单文件 `runtime.zip` + 首次启动解压（0.1.3 起，2026-09-21）

**起因（用户实测反馈）**："包里面文件都很碎，拷贝很花时间。" 实测确认这是**文件数**问题，不是体积问题：

| 指标 | 实测 |
|---|---|
| 解压后的包 | **27,413 个文件** / 3,766 目录 / 326 MB，平均 **12.2 KB** |
| 文件大小分布 | **<1 KB 占 44.9%**、1–8 KB 占 43.7%（**小于 8 KB 的合计 89%**）、8–64 KB 10.1%、>1 MB 仅 22 个 |
| 大户（按文件数） | `@opentelemetry` 4,881、`@deepseek-ai` 3,397、`openai` 2,512、`npm` 1,926、`@anthropic-ai` 1,735、`@smithy` 1,538、`@aws-sdk` 1,426、`typebox` 1,367… |
| 拷贝同一 326 MB 源 | `Copy-Item -Recurse`（≈资源管理器）**88.8s** vs `robocopy /MT:16` **13.8s**（6.4×）/ `MT:32` 14.0s |
| 用 tar 解压整包 | 36.1s |

**方案 A（本次实现）**：把 `runtime\` 打包成**单个 `runtime.zip`** 放进发行包，**壳首次启动时自动解压**；同时提供 CLI `dsh-desktop.exe --extract-runtime`（不开窗口、可脚本化、安装器也用它）。

- **打包器**：运行时自检、npm 检查**照旧在"松散 runtime\ 目录"上跑**（闸门不变），随后 `tar -a -cf runtime.zip -C runtime .` 并**校验压缩包里确有 dsh 入口与 npm**，然后删除 `runtime\`；新增 `-NoRuntimeArchive` 可保留旧形态。
- **壳**：`startup()` 里起一个 goroutine 调 `ensureRuntimeExtracted()`（进度写面板），`checkUpdatesLoop()` 与 `bootstrap()` 都**先等 runtime 就绪**——否则未解压时自更新检查会误走"全局 npm"分支。解压实现 `installRuntimeFromArchive()`：先解到 `.runtime-extract\`，校验可运行后再 **rename 原子落位**；含 **zip-slip 防护**（`../` 条目直接拒绝）；失败会清理临时目录并如实提示。
- **`install-offline.ps1`**：发现 `runtime.zip` 且无 `runtime\` 时，先 `Start-Process -Wait` 调 `--extract-runtime`（走壳的同一段代码；失败则回退 `tar.exe`），因为后续要用包内 node 跑插件安装器；`-AppDir` 时优先**只拷 `runtime.zip`**（一个文件），由该目录的壳首次启动解压。
- **包内 README** 增加"Copying this package around"一节：搬 zip 别搬目录、拷目录用 `robocopy /MT:16`、解压用 `tar -xf`/7-Zip 而不是资源管理器。

**实测（2026-09-21）**：
- 新包形态：**35 个文件** / 114.4 MB（`dsh-desktop.exe` 10.9 + **`runtime.zip` 103.2 MB / 31,074 条目** + plugins + scripts + installer + README/VERSION）—— 对比旧形态 **27,413 个文件**
- `runtime.zip` 生成 22.5s；**壳 CLI 解压 42s**（tar 36s），**幂等**（再跑 0.1s 返回 "runtime already extracted"）
- 解压后 `bundled dsh → 0.1.5-rc.2`、`bundled npm → 11.13.0`、临时目录已清理
- 整个新包 robocopy /MT:16 拷贝 **15.9s**
- Go 测试：新增 5 个用例（`needsRuntimeExtraction` / `extractZip` **zip-slip 拒绝** / `installRuntimeFromArchive` 幂等 / 空归档报错 / CLI 标志解析）→ **28/28 通过**；`go vet` 含 `GOOS=linux` 为 0

**代价/注意**：首次启动多 ~40 秒（一次性，面板有进度）；`runtime.zip` 保留 103 MB 在包里（不删可随时整体搬走；删掉也不影响已解压的运行）。源码安装路径（`update.ps1`/`setup.ps1`）**不受影响**——它们只部署裸 exe 到应用区，那里没有 `runtime.zip`，便携逻辑不触发。

**0.1.3 发布资产端到端验证（2026-09-21，全部通过）**——从 GitHub Release 下载后实测：

| 步骤 | 结果 |
|---|---|
| 下载 | 98.5 MB（链路恶化：直连一度掉到 **5 KiB/s**、镜像 12–28 KiB/s；改用**镜像前缀 `https://ghfast.top/` + 每段连接 5 分钟上限 + Range 断点续传**后才跑通，最后 211s 完成） |
| **SHA256** | 线上 `c78e88d86ac8924f80762806fbbb621cf6311ebb38f6be5149c50e65699eb5bd` = 本地实测，**MATCH** ✅ |
| **外层包结构** | 共 **50 条目**；**`runtime.zip` 在、散开的 `runtime/` 文件不在** ✅（本次改动的目标） |
| 解压后形态 | 包内**仅 8 个顶层条目**：`dsh-desktop.exe`、`install-offline.cmd/.ps1`、`plugins\`、`README.txt`、**`runtime.zip`**、`scripts\`、`VERSION.txt` |
| **首次启动路径** | `dsh-desktop.exe --extract-runtime` → **`runtime ready in 35s`** → 解压出的 **dsh = `0.1.5-rc.2`**、**npm = `11.19.0`** ✅ |
| `VERSION.txt` | 含 `runtime.zip (unpacked on first start)`、`npm: bundled (enables in-package self-update)`、`node: v24.20.0` ✅ |

> 验证脚本 `.cache\verify-013.mjs`（scratch，未入库）。**本机验证脚本经验**（与 §27.7 一起看）：① Release 资产要**先试镜像前缀**再回退直连（本沙箱直连会掉到 5 KiB/s 甚至静默挂起）；② `fetch` **必须设超时**（`AbortSignal.timeout(5min)`）否则会永久挂住；③ 分段落盘 + Range 续传让慢链路也能最终完成；④ `execFileSync("tar.exe", ["-tf", zip])` 对 2.5 万条目会撞 `ENOBUFS`（要调大 `maxBuffer`）。

### 27.12 发行包本地留存位置 + `0.1.4`（2026-09-21）

- **本地留存目录约定**：**`D:\dsh\app\packages\`**（与 `app\current`、`app\versions` 并列），放**可直接拷走的发行包**：
  ```powershell
  pwsh -File scripts\pack-release.ps1 -ShellVersion 0.1.4 -OutDir D:\dsh\app\packages
  # -> dsh-desktop-0.1.4-dsh0.1.5-rc.2-win-x64.zip (35 文件 / 97.9 MB) + SHA256SUMS.txt
  ```
- **`0.1.4`（CI run #7 = success，2026-09-21）**：内容 = 0.1.3 的**单文件运行时**设计 + **`f34e761`**（覆盖安装时"包内 `runtime.zip` 严格更新才替换"，防静默沿用旧运行时）。发布资产 **98.5 MB**，digest 与 `SHA256SUMS.txt` 一致（`ed71c8e9…9fc1`）。
- **本地包与 CI 包哈希不同属正常**：本地用**全局安装树**（嵌套依赖 → `dsh-tree` 模式、Node v24.16.0），CI 用 `npm install --prefix` 的暂存前缀（**提升**依赖 → `full-node-modules` 模式、Node v24.20.0）；两者 **harness 版本相同（0.1.5-rc.2）且都已验证可运行**，不要拿两者比哈希。
- 本次本地留存：`dsh-desktop-0.1.4-dsh0.1.5-rc.2-win-x64.zip`（97.9 MB），SHA256 `EA6A1FEF4BC4C919A627FA64EFB505D3EC52937BF0A92B9EB74A7F954394C14F`。

**0.1.4 发布资产端到端验证（2026-09-21，全部通过）**：下载 98.5 MB（**镜像 95 秒**）；SHA256 `ed71c8e924b9a567c434b722b4b9acc31eb541e059bbd3e4fb42b51b170a9fc1` 与线上 `SHA256SUMS.txt` **MATCH**；外层包 **50 条目、`runtime.zip` 在且无散开的 `runtime/`**；解压后**仅 8 个顶层条目**；`dsh-desktop.exe --extract-runtime` → **runtime ready in 40s** → 解压出 **dsh `0.1.5-rc.2` + npm `11.19.0`** 均可运行；`VERSION.txt` 内容正确。⇒ **0.1.3/0.1.4 两个发布包都做过"真实下载 → 哈希 → 结构 → 解压 → 实跑"的完整验证。**

## §28 插件安装体验：功能说明 + 编号多选 + 无效即不装（2026-09-21）

> **文档版本：v1.0**（2026-09-21 新建）。需求来自用户：「安装时能不能提供四个插件的功能说明」「指定装其中两个该怎么输」「补充多选说明，比如加逗号隔开就行」「输入无效默认提示无效并且不安装」。

### 28.1 改了什么

| # | 内容 |
|---|---|
| 1 | **安装菜单显示中文功能说明**：每个插件一行编号 + 短名 + 标题，下面一行"干什么用" |
| 2 | **多选说明写进菜单**：`多选请用逗号隔开（multi-select: separate numbers with commas, e.g. 2,4）` |
| 3 | **编号成为一等输入**：菜单回答与命令行 `-Plugins 2,4` **都认编号**（此前命令行只认短名/包名/patch id） |
| 4 | **无效输入 = 提示无效 + 不安装任何插件**（原来是"忽略无效项"、全无效还会退化为全装） |
| 5 | `-CheckOnly` 变成真正的"预演"：列出清单 + `would install : ...`，且**不会**因为"全新机器上还没有已装状态"而报失败 |
| 6 | 包内 `README.txt` 的插件段**由同一份数据源生成**（不再是手写），并写明编号/多选/无效即不装/只加不减 |
| 7 | 仓库 `README.md` 增加 **4 个插件说明表**与输入规则 |

### 28.2 单一数据源（关键设计）

插件说明只存在一处：**`scripts/setup-plugins.mjs` 的 `PLUGINS` 数组**（新增 `title` / `summary` / `where` / `writes` 字段，数组按短名字母序 = 编号顺序）。三处消费它：

1. 安装器菜单：`install-offline.ps1` 调 `node scripts/setup-plugins.mjs --describe`（JSON）后渲染；
2. 包内 `README.txt`：打包器 `pack-release.ps1` 用同一个 `--describe` 生成段落；
3. 仓库 `README.md` 表格：人工同步（内容取自同一 `--describe`，改说明时改 mjs 一处 + 表格引用）。

`node` 不可用时安装器回退为"只列短名"，绝不报错。

### 28.3 🔴 顺带修掉的两个真实 bug

1. **相对 `-DSHome` 会让安装"装一半就崩"**（本次测试发现）：`setup-plugins.mjs` 的 `verify()` 用 `createRequire(<profile>/package.json)`，Node 的 `createRequire` **拒绝相对路径**（`ERR_INVALID_ARG_VALUE`）→ 第 1 个插件装完、第 2 个复制前崩溃，留下**半装状态**（包已拷、patch 已写）。修复：mjs 内部 `DSH_HOME = resolve(...)` 绝对化 + 安装器把 `$DSHome` 归一化为绝对路径（并展开 `~`）。
2. **`.ps1` 缺 BOM（含中文后必坏）**：`install-offline.ps1` 现在含中文，`install-offline.cmd` 在**没有 PS7 的新机**上会用 **PowerShell 5.1** 执行，5.1 把无 BOM 的 UTF-8 当 ANSI(GBK) 解码 → 乱码/语法错。修复：给该文件**补回 UTF-8 BOM**（编辑工具会吃掉 BOM，每次改完必须复查），并用 **5.1 实测**能读到中文；同时给另外 5 个含非 ASCII 的 `.ps1` 一并补了 BOM（`.work\rebuild-desktop-shell.ps1`、`.work\restart-desktop-shell.ps1`、`.work\verify-fresh-clone.ps1`、`plugins\...\lib\bring-explorer-front.ps1`、`scripts\pack-release.ps1`）。

### 28.4 测试（`.work\plugin-selection.test.ps1`，42 项全通过）

真实安装到**临时 DSH_HOME**（就是新机流程），断言"装进去的目录集合 + patch 条目"：

- `2,4` / `2, 4` / `4,2` / `2,2,4` / `explainer,project-explorer` / `plugin-explainer,plugin-project-explorer` → 都只装那两个
- `1` 追加后再 `1` → **只加不减**语义（3 个）
- `9`、`2,9`、`0`、`2,x` → 非零退出 + `invalid choice` + **一个都没装**
- `none` → 不装；`all` / 默认 → 4 个；`ask` 无控制台 → 退化为全装且不挂住；`-SkipPlugins` → 不装
- **交互菜单本身**（用 `DSH_INSTALL_FORCE_PROMPT=1` + 管道喂答案）：`2,4` → 精确两个；`9` → 提示无效且不装；`a` → 4 个；`n` → 0 个；并断言菜单渲染出"多选提示 + 4 个中文说明 + a/n 行"
- **相对 `-DSHome` 回归用例**（正是它抓到了上面 bug 1）
- mjs 直测：`--describe` 返回 4 条且编号 1..4、含中文标题、无副作用；`--plugins 9` 报错带 `use numbers (1-4)`；`--plugins 2,4` 选出正确两个

### 28.5 涉及文件

`scripts/setup-plugins.mjs`（catalogue + `--describe` + 编号选择 + 绝对化 DSH_HOME + tab/空格分词）、`install-offline.ps1`（菜单/解析/归一化/预演/只加不减提示 + **BOM**）、`scripts/pack-release.ps1`（README 从 `--describe` 生成 + BOM）、`README.md`（说明表 + 输入规则）、`.work/plugin-selection.test.ps1`（新增测试）。

### 28.6 发布与验证（0.1.5）

- `desktop-v0.1.5`：**重推后 CI run #9 = success**，资产 98.5 MB，SHA256 `b266e60537c670f269867e30a9a62a2e7c65994dc009bc6241d0d3b1e58abbd5`。
- **本地留存**：`D:\dsh\app\packages\dsh-desktop-0.1.5-dsh0.1.5-rc.2-win-x64.zip`（98.0 MB / 35 文件，SHA256 `E2CFAEE16C97BE3F200E05C97D9ADFFAFE7E0F35C27C8C55ED9F4BD0FACE2F0D`；旧的 0.1.4 包已删）。抽验：包内 `install-offline.ps1` 含多选提示与"无效即不装"文案；`README.txt` 含 4 插件说明表与编号/多选规则。
- **发布资产端到端验证（`.cache\verify-015.mjs`，全通过）**：SHA256 匹配；外层 8 个顶层条目；**包内自带安装器** 干跑（`-CheckOnly -Plugins 2,4`）显示中文说明 + `would install : explainer,project-explorer` + 不写任何文件 + exit 0；**包内安装器的交互菜单**（强制提示 + 喂答案 `2,4`）渲染出多选提示/编号行/中文说明/a·n 行，且 `2,4` 精确选中两个；`pwsh -Command "… -Plugins 2,4"` 的数组分裂形式（`"2 4"`）也被容忍；`--extract-runtime` 解压后 dsh `0.1.5-rc.2` + npm `11.19.0` 可运行。
- **验证过程中的两个脚本教训**：① 发布验证最初用 `-Command "& install-offline.ps1 -Plugins 2,4"` 调用，PowerShell 在 `-Command` 模式下把 `2,4` 当**数组字面量** → 传进 `[string]` 参数变成 `"2 4"` → 被判无效（用户实际路径 `.cmd`→`-File` 不受影响，但**脚本化安装很常见**）→ 故让解析**同时接受逗号与空白**（`-split '[,\s]+'`，mjs 同步 `split(/[,\s]+/)`），并加 `-Plugins "2 4"` 用例（测试 **44 项全通过**）；随后**重推 `desktop-v0.1.5` 标签**（下载数仍为 0）让发布包带上该修复，而不是再占一个版本号。② **重推标签会生成不同构建**：本地旧包哈希与新的 `SHA256SUMS.txt` 不符时，"断点续传"会撞 **HTTP 416**（旧文件更长）→ 验证脚本改为**先取哈希、对不上就删掉重下**。

> 教训（与 §27.7/§27.9 同源）：**"发布后再验证"能抓到"文档路径能用、脚本路径不能用"这类缺口**；凡是有两种调用方式的入口（`-File` 与 `-Command`、命令行与交互菜单），两种都要验证。

## §29 路径P：模型同步插件（按提供商刷新模型列表与参数）（2026-09-22）

> **文档版本：v1.0**（2026-09-22 新建）。需求来自用户：「写个插件能在需要时刷新模型供应商能提供的模型列表并获取正确的参数，可以用 models.dev 或是直接访问各大模型供应商的官网，并可以允许我手动添加自定义的模型供应商并刷新和验证参数」。

### 29.1 要解决的根因（为什么 opencode 会自己更新、dsh 不会）

| | 模型目录来源 | 是否联网刷新 |
|---|---|---|
| opencode | **models.dev**（远程库，定时拉取） | ✅ 会 |
| dsh | `@earendil-works/pi-ai/dist/providers/data/*.json` | ❌ **随 npm 包冻结** |

dsh 的 discovery 源码注释明写「pi-ai 的注册表对它自有的 provider 就是权威列表」，所以**路由名一旦命中内置 catalog，「获取可用模型」根本不发请求**，永远返回打包时的快照。实测**阿里 Token Plan 国内站**：pi-ai 冻结 **18 个** vs models.dev **28 个**，差的 10 个正是 `glm-5.3`、`deepseek-v4.1-flash`、`qwen3.8-max-preview`、`qwen-image-2.0(-pro)`、`wan2.7-image(-pro)`、`happyhorse-1.1-t2v/i2v/r2v`。

### 29.2 Spike 结论（决定架构的四个事实）

| 问题 | 结论 |
|---|---|
| keyed slot 能否被外部插件注册 | **能**：`ctx.slots.register({ name, key: settingsNs }, Component)`（官方 `dsh-cordis-client-runner/lib/client.js` 内有范例） |
| 写入通道 | `ctx.remote.settings.mutate(ns, ops, expectedRevision)`；`ops = { op:'set'\|'unset', path:[], value }`；冲突码 **`settings/conflict`** |
| `resolveModelInfo` 能否在 client 调 | **不能**。官方 client 只挂了 `llm` 的 3 个方法（`discoverModels` / `listProviders` / `listConfigurableProviders`）——能力集是**构建期选定**的，客户端不发现 Host 服务。这正是路径E 当年必须自建 host 路由的原因 |
| 元数据能否浏览器直连 | **能**。models.dev 与 OpenRouter 均返回 `access-control-allow-origin: *`（实测） |
| 运行时注册自定义 remote | **能**（`ctx.typert.register(contribution)`），但需手工构造 descriptor + Zod schema，本项目未走此路 |

### 29.3 架构：host 半区为空，数据面全走官方 Remote

- **写入**：`remote.settings.mutate` + **路径寻址**。刻意不用整体 `replace` —— 官方注释明确警告：用被 redact 过的 view 重建整个 section 会**静默删掉所有没随 wire 返回的 secret 字段**。
- **端点探测**：`remote.llm.discoverModels`，**不带 apiKey**，由 host 侧解析存储的凭据 → **浏览器全程不接触密钥**。
- **元数据**：浏览器直接 fetch（CORS 已通），不经 host 中转。
- **验证**：写完立刻 `describe()` 回读 → 证明「写进去了」与「生效了」是两件事。
- **host 半区**：只有一个空的 `apply`，存在意义是让 loader 激活该插件（客户端 registry 会跳过 host fiber 缺失的条目）。

候选优先级：**端点实测**（决定哪些 id 真的可用 + 容量，权威）→ **models.dev**（provider 级匹配：baseURL 优先、env 兜底；供给模态与 reasoning 档位）→ **OpenRouter**（仅补模态）。

### 29.4 真实数据验证跑出的两个现实问题

1. **用户的 provider 都不在 models.dev 里**：`vekenllm`（内网 LiteLLM `192.168.100.63:4000`）与 `ctai`（`ai.ctaigw.cn`）的 **provider 级匹配必然失败**。对策：加**模型级全局兜底**（按同名模型从 models.dev 全库借元数据）。实测有效：`glm-5.3-flash` → `ctx=1000000/out=131072/input=[text,image]`。
2. 🔴 **兜底会误伤自定义路由名**：`vekenllm/auto`（本机配的是 1M 上下文 + 图像）在 models.dev 里撞上一个**毫不相干**的 `auto`（`ctx=32000/out=32000/input=[text]`）。若照单全收，就会用错误值**覆盖正确的既有配置**。对策：借用来的元数据打 `borrowed` 标记、**默认不勾选**、UI 显示「借用同名模型 · 需核对」。这条只有跑真实数据才会暴露，纯单测发现不了。

### 29.5 坑

1. 🔴 **基于过期读取写入（本次实际发生，务必引以为戒）**：本会话 `read` 得到的是 `setup-plugins.mjs` 的 **265 行旧版**，而磁盘上是 **327 行新版**（commit `3f30a63` 引入了 `--describe` 与 `title`/`summary`/`where`/`writes` 中文字段）。据旧版内容写入后，条目虽插在合法位置，但**缺 `title`（菜单显示 undefined）且排序违反「按短名字母序」约定**（会打乱安装菜单编号）。已用 `fix-registry.mjs` 全量修正。
   > 教训：AGENTS.md §19 的「写入前必须刷新重读」**不仅适用于多会话并行，也适用于同一会话内隔了一段时间的读取**——工具返回的内容可能落后于磁盘。**凡是要按结构写文件，写入前必须重新读一次。**
2. **编号是连锁的**：新增插件按字母序插入 `model-capabilities` 与 `project-explorer` 之间 → **`project-explorer` 由 4 变 5**。凡是引用编号的文档（README 表格、project-facts F9、包内 README）都要同步。
3. **`LLM_DISCOVERED_MODEL` 只有 4 个字段**（`id/name/contextWindow/maxTokens`），模态与推理档位**传不回来** → 插件必须自带 UI 并自己写 settings，只做 discovery handler 是不够的。
4. **slot owner props 不含 context**：`provider-card` 只给 `{ provider, configured, keyConfigured }`，Remote 面必须在 `makeCard` 里由插件 apply 时的 `ctx.remote` 闭包带入。
5. **`.work` 下的测试要能双位置运行**：测试用「先试 `../plugins/<pkg>/`，再试 `./`」的探测，保证开发树与部署树都能跑。

### 29.6 产出文件

```
plugins/dsh-client-ui-plugin-model-sync/
├── package.json          # dsh.client 清单（platform web + inject 3 个官方模块）
├── config.json           # 源 URL / settingsNamespaces / 超时 / 候选上限
├── build.mjs             # config.json -> lib/client.js
├── src/bundle.template.js# client bundle 模板（纯函数 + provider-card 组件）
├── lib/index.js          # host：空 apply（仅供 loader 激活）
├── lib/client.js         # 构建产物（34,560 字节 = UTF-8 字节数）
└── README.md             # 设计说明 + 已知限制
.work/
├── model-sync.test.mjs       # 64 断言（纯函数 + 插件契约）
└── model-sync-live.mjs       # 真实 models.dev 数据端到端
```

### 29.7 验证项

- [x] `node build.mjs` → `lib/client.js` **34,560 字节**（UTF-8 字节数）；`node --check` 通过
  > 注：原先 5 个插件的 `build.mjs` 都打印 `bundle.length`（**UTF-16 字符数** 33,926），与落盘字节数不符（中文每字符 3 字节）→ 已统一改为 `Buffer.byteLength(bundle, "utf8")`（**bundle 内容零变化**，仅数字变准）。
- [x] `.work\model-sync.test.mjs` → **64 断言全过**（归一化/模态过滤/reasoning 映射/源投影/provider 匹配/候选优先级/全局兜底与 borrowed/diff/组合/写入形状/view 读取/插件契约/config 注入）
- [x] `.work\model-sync-live.mjs` → 真实 models.dev（222 providers / 2397 distinct ids）跑通；`auto` 被正确标为 borrowed
- [x] `scripts\setup-plugins.mjs` 安装 → 4 项 loader 发现条件全过；`--check-only` 全过；patch YAML 含 **5 个 id**
- [x] `--describe` 返回 **5 条**、编号 1–5、`model-sync` 有中文标题与说明
- [ ] ⏳ **待用户重启 dsh web 后目视验收**：设置 →「模型」→ 提供商卡片应出现「模型同步」控件（host 半区是空的，无可 curl 探测的路由，**只能浏览器实视**）

### 29.8 与路径E 的关系

两者数据源不同、职责不重叠，**可共存**：路径E 是**只读展示**当前 Host 注册表能力；路径P 是**可写同步**（拉候选 → diff → 写回）。路径E 的 host 路由 `/plugin-model-capabilities/list` 是 `resolveModelInfo` 的深度读口；本插件刻意**不依赖**它（保持自包含），代价是验证深度止于 `describe()`（证明配置被接受并正确解析，不证明模型在网关上真能跑）。

### 29.9 发布与复核（0.1.6，2026-09-22）

**另一会话完成插件后，本会话做了独立复核 + 补齐连带影响 + 发版**：

- **插件复核（全过）**：`build.mjs` 重跑 → `lib/client.js` 哈希不变（可复现）；`.work/model-sync.test.mjs` **64 断言**；`.work/model-sync-live.mjs` 真实 models.dev（`alibaba-token-plan-cn` 28 个模型 vs pi-ai 冻结目录 18 个；`vekenllm`/`ctai` 无 provider 级匹配 → 正确 `BORROWED` 且默认不勾）；安装链路 3a–3d 全过。
- **架构亮点**：本插件 host 半区**刻意留空**（`inject=[]`、不注册任何 `webServer` 路由），数据面全走官方 Remote → **是目前 5 个插件里唯一不依赖 `ctx.webServer` 的**，对 §24.5「官方 Desktop 不提供 webServer」的迁移评估是正面样本（官方 Desktop 是否提供 `settings`/`llm` Remote **未验证**）。
- **连带影响（本会话补齐）**：① `.work/plugin-selection.test.ps1` 原先写死 4 个插件 → 加第 5 个后 19 项假失败 → **重写为"期望值全部由 `--describe` 推导"**（目录一致性/编号连续且字母序/每个插件都有中文标题与摘要/逐个按短名安装/无效编号拒绝…）→ 5 插件下 **51/51 通过**，以后新增插件不必改测试；② README 两处"4 个自定义插件"、`pack-release.ps1` 头注释 `plugins\<4 packages>` 一并改为通用说法；③ facts F11 明确 **10 个套件**（9 node + 1 pwsh）。
- **口径修正**：5 个插件的 `build.mjs` 一直打印 `bundle.length`（**UTF-16 字符数**），与 UTF-8 落盘字节数不符（中文每字符 3 字节，如 model-sync 33,926 vs 34,560）→ 统一改为 `Buffer.byteLength(x, "utf8")`；重跑确认 **bundle 内容零变化**，仅数字变准。
- **0.1.6 发布**：CI **run #10 = success**，资产 98.5 MB，SHA256 `a581e6f871248329902f555577170d5ffdff38db7d39f258f41dd4bfdc142909`。**发布资产端到端验证全过**：哈希匹配；外层 8 个顶层条目；**包内自带安装器**干跑列出 **5 个**中文说明、`would install : explainer,model-sync`（编号 4 已是 `model-sync`、5 是 `project-explorer`）、不写文件、exit 0；**包内交互菜单**（喂 `2,4`）渲染多选提示 + 5 条中文说明并精确选中两个；`-Command` 形式 `"2 4"` 被容忍；`--extract-runtime` 后 dsh `0.1.5-rc.2` + npm `11.19.0` 可运行。
- **本地留存**：`D:\dsh\app\packages\dsh-desktop-0.1.6-dsh0.1.5-rc.2-win-x64.zip`（98.0 MB / **42 文件**，含 **5 个插件**；SHA256 `683532972795D097E1DF1C85C61DE680BD091223043C2712D3558D4D90BF740D`）。
- ⏳ **仍待用户目视验收**：完全重启壳后，`设置 →「模型」→ 提供商卡片`应出现「模型同步」控件（该插件 host 半区无路由，无法 curl 探测）。
  > ⚠️ 注意：**0.1.5 的包只含 4 个插件**（它的 tag 指向 `3d1bbc0`，当时 `model-sync` 尚未提交）→ 新机要用第 5 个插件需 **0.1.6 起**。

## §30 独立插件更新脚本 `update-plugins.ps1`（2026-09-22）

> **文档版本：v1.0**（2026-09-22 新建）。需求（用户原话）：「单独弄个插件安装脚本吧，方便直接更新已安装的老版本」。

### 30.1 它解决什么

以前要更新**已安装**的插件只有两条重路径：`install-offline.ps1`（包安装器：校验包布局 + 按需解压运行时 + 可选部署应用区）或 `update.ps1`（`git pull` + 重建壳 + 部署）。现在有一条**只做插件**的路：

| 文件 | 角色 |
|---|---|
| `scripts\update-plugins.ps1` | 独立更新器（仓库内、发行包内都能跑；包内被放到**根目录**，与 `install-offline.ps1` 并列） |
| `scripts\update-plugins.cmd` | 双击包装（`-ExecutionPolicy Bypass`；双击 = 更新"已安装的那些"） |

```powershell
pwsh -File scripts\update-plugins.ps1                 # 默认 -Plugins installed：只更新已装的
pwsh -File scripts\update-plugins.ps1 -CheckOnly       # 只报告（已是最新 / 待更新 / 未安装），不写任何东西
pwsh -File scripts\update-plugins.ps1 -Plugins all     # 连没装的也装齐
pwsh -File scripts\update-plugins.ps1 -Plugins 2,4     # 编号多选（同安装菜单编号；也认简名/包名/patch id）
pwsh -File scripts\update-plugins.ps1 -Force           # 内容一致也重拷
pwsh -File scripts\update-plugins.ps1 -NoBackup        # 不建回滚备份
pwsh -File scripts\update-plugins.ps1 -DSHome D:\h     # 指定 DSH_HOME（会归一化为绝对路径）
```

### 30.2 关键机制

1. **"是否最新"用内容哈希**，不看版本号（5 个插件的 `version` 全是 `0.1.0`，看版本毫无意义）：新增 `setup-plugins.mjs --status`，对**安装载荷**（`package.json` + `lib/**`，按路径排序 + 内容）算 sha256 前 12 位，逐插件输出 `missing` / `outdated` / `current` + `patchEntry` 是否存在。判定逻辑**只此一处**。
2. **先备份、失败回滚**：只对"已装且要动"的插件建 `profiles\node_modules\.backup-<时间戳>\`；调用 `setup-plugins.mjs --plugins <list>` 安装并校验；**非零退出**则把备份拷回、保留备份目录供排查并报错退出；成功则删备份。默认**只加不减**（未选/未装的插件不动）。
3. **`-CheckOnly` 不写任何东西**（连备份目录都不建），只打印"would update: …"与跳过项。
4. **Node 解析顺序**：包内 `runtime\node.exe` →（包内有 `runtime.zip`+`dsh-desktop.exe` 时）自动调 `--extract-runtime` 解压 → 系统 `node`；都没有则明确报错并给指引。

### 30.3 测试（`.work\update-plugins.test.ps1`，26 项全通过）

跑真实脚本，但源码树是 `pack-release.ps1 -NoNode` 产出的**可变副本**（这样才能制造"源已变更"与"源损坏"而不脏仓库）：

- 全新 home + 默认 → 不装任何东西、给出指引、无 `.backup-*` 垃圾
- `-CheckOnly -Plugins all` → 报告 5 个"未安装"、**一个字都不写**
- `-Plugins 2,4` → 精确两个；再跑默认 → "already up to date"
- **源改动 → 检出 outdated → 更新**：哈希变化、状态回到 `current`、备份建了又删、另一个插件未受影响
- **源损坏（删掉 host main）→ 安装失败 → 自动回滚**：退出码非零、已装副本**哈希不变**且文件回来了、备份保留、输出含 `rolled back`
- `-Force` / `-Plugins none` / 非法编号（`$total+1`）行为正确

### 30.5 发布（0.1.7）

### 30.4 本次踩的五个坑（自用备忘）

1. **`DSH_HOME` 必须在查询状态之前设置**：第一版把 `--status` 跑在默认 `~/.dsh` 上，于是"**全新 home 也报'已是最新'**"——脚本要把 `$env:DSH_HOME` 提到 `Get-Status` 之前（安装那一步再设已经太晚）。
2. **空 `.backup-*` 目录**：原先无条件创建备份根目录，导致"全新安装"也在 `profiles\node_modules` 里留垃圾 → 改为**只在实际有旧副本时惰性创建**。
3. **失败注入要真的让校验失败**：把 `lib/index.js` 内容改成注释**不会**失败（校验只看"host main 是否存在"）→ 测试改为**删除**该文件，才真的走到回滚分支。
4. **`-CheckOnly` 连目录都不许建**：第一版在 `-CheckOnly` 下仍会 `New-Item -Force profiles\node_modules`（与"只报告、不写任何东西"自相矛盾）→ 该分支改为只警告。抓到它的是**发布资产验证**里"全新 home 下连 `profiles\node_modules` 都不该出现"这条检查（本地测试当时只查了插件目录、没查父目录）——**验证脚本与单测要互相补位**。
5. **验证脚本必须先清空自己的临时 home**：修好上面的问题后，发布验证仍报"写了东西"——因为**上一轮（旧版脚本）跑出来的 `updater-home\profiles\node_modules` 还在**，而新脚本只用 `mkdirSync` 没先删。加了 `rmSync(..., {force:true})` 后即为 PASS。**凡是断言"某目录不该存在"，断言前必须把该目录清掉**（否则断言的是历史，不是行为）。

### 30.5 发布（0.1.7）

- `desktop-v0.1.7`：**CI run #13 = success**，资产 98.5 MB。包内新增 `update-plugins.ps1/.cmd`（**44 个文件**）。
- **本地留存**：`D:\dsh\app\packages\dsh-desktop-0.1.7-dsh0.1.5-rc.2-win-x64.zip`（98.0 MB / 44 文件 / 5 插件，SHA256 `2918E29F38F26CAD530D9FC6B566235D0709EA4222CF674973837D7383B505FD`）。
- **首发（run #11）失败**、以及**第二次重推（run #12）后被发布验证抓到一个只读缺陷**，都已修复并重推标签——详见 §31（上游 `--before` 事故）与 §30.4 坑 4（`-CheckOnly` 不得创建目录）。

## §31 上游发布不完整的 `0.1.5-rc.3` 家族 → 安装 rc.2 会 ETARGET（2026-09-22）

> **文档版本：v1.0**（2026-09-22 新建）。这是**上游注册表状态问题**，不是本仓库改动引起的；但它同时打断了 CI 打包与新机安装。

### 31.1 现象

- CI **run #11**（`desktop-v0.1.7` 首发）失败在 **"Stage the harness runtime (offline dependency tree)"** 这一步（后续 "Pack the portable release" / "Publish the release" 被跳过）。
- 本地**原样复现**同一条命令 → `npm error code ETARGET`：
  `No matching version found for @deepseek-ai/dsh-client-ui-sidebar-documentpreview@^0.1.5-rc.3`。

### 31.2 根因

1. `@deepseek-ai/dsh@0.1.5-rc.2` 对家族包声明 **caret 范围** `^0.1.5-rc.2`（实测：69 个 `@deepseek-ai` 直接依赖里大量 `^0.1.5-rc.2`）。
2. 上游于 **2026-09-22 05:55Z** 发布了 `dsh@0.1.5-rc.3`（家族包**多数**也发了 rc.3），但 **`@deepseek-ai/dsh-client-ui-sidebar-documentpreview` 没有 rc.3**（它的 0.1.5 线最新只有 rc.2，之后直接跳到 `0.1.6-alpha.*` / `0.1.7-alpha.1`）。
3. npm 解析 rc.2 时，caret 使它取"匹配范围内的最新"= **rc.3 子包**；而 rc.3 子包又要求 `^0.1.5-rc.3` → 撞上那个**不存在**的包 → ETARGET。
4. **影响面**：**任何新装/重装**的机器（`setup.ps1` / `deploy.ps1` 的 `npm i -g @deepseek-ai/dsh@0.1.5-rc.2`）与 **CI 打包**都会失败；**已装好的机器不受影响**（本地全局树早就在）。

### 31.3 修复（两处 + 一条纪律）

1. **CI（`.github/workflows/release-desktop.yml`）** 的 `Stage the harness runtime` 步骤：
   - **显式钉版本**：不再 `npm view @deepseek-ai/dsh version` 取 latest，改为内置 `0.1.5-rc.2`（手工 `workflow_dispatch` 仍可用 `dsh_version` 覆盖）——避免上游漂移**悄悄改变我们发布的内容**；
   - `npm install --prefix staging --no-audit --no-fund --before="2026-09-22T05:00:00.000Z" ...`：把解析**闸**在 rc.3 发布之前；
   - 新增**运行时自检**：打包前 `node staging\...\lib\bin.js --version` 必须等于目标版本，否则这一步直接失败（而不是把错的版本带进包）。
2. **新机安装（`setup.ps1`）**：新增参数 `-HarnessBefore`（默认同一时刻），两处 `npm install -g` 都追加 `--before=`；`-CheckOnly` 也会打印将要执行的完整命令。`deploy.ps1` 无需改（`setup.ps1` 的默认值生效）。
3. **🔴 纪律**：`--before` 是**注册表时间闸门**——**将来升级 harness 版本时必须同步更新这个日期**，否则新版本会被闸门挡住；临时关闭用 `-HarnessBefore ""`（setup.ps1）或把工作流里的 `$before` 清空。

### 31.4 实测（本地，2026-09-22）

| 命令 | 结果 |
|---|---|
| `npm install --prefix staging --before=2026-09-22T05:00:00.000Z @deepseek-ai/dsh@0.1.5-rc.2` | **exit 0 / 518 包 / 190 顶层目录**；家族抽样（`dsh-base`、`dsh-client-ui-sidebar-documentpreview`、`dsh-api-session-controller`）全部 **0.1.5-rc.2**；运行时自检 **0.1.5-rc.2** |
| 同命令**不带** `--before` | **ETARGET**（稳定复现） |
| `setup.ps1 -CheckOnly` | 正常（ASCII-only 保持、语法 OK、不触发安装） |

### 31.5 后续

- 重推 `desktop-v0.1.7` 标签后 **CI run #13 = success**（工作流取自标签所在提交，故**先提交修复再重推**；head_sha `698fdd9`）。
- **本地留存包不受影响**：`pwsh -File scripts\pack-release.ps1` 用的是本机**已装好的全局 rc.2 树**，与注册表当前状态无关（`dsh-desktop-0.1.7-…zip`，SHA256 `2918E29F…05FD`）。
- **🔴 同日 23:5x 复核：上游已把 rc.3 家族补全**（`@deepseek-ai/dsh-client-ui-sidebar-documentpreview` 现在有 `0.1.5-rc.3`）→ 早上的 `ETARGET` **已自愈**：实测**不带** `--before` 也能装成功。
- **但闸门仍必须保留**，理由从"避免失败"变成**确定性**：

  | 方式 | 解析出的 dsh 家族版本集合 |
  |---|---|
  | 不带 `--before`（现状） | `0.1.5-rc.2` **+ `0.1.5-rc.3`**（caret 让子包升到 rc.3 → **混装**） |
  | 带 `--before=2026-09-22T05:00:00.000Z` | **只有 `0.1.5-rc.2`**（我们验证过的那棵树） |

  ⇒ **闸门 = "发布纯 rc.2 且可复现"**；要整体升级时再同步改日期（§31.3 纪律）。
- **当前版本快照（2026-09-22 23:5x）**：npm `latest` = `0.1.5-rc.2`（= 我们锁定的版本）、`next` = `0.1.5-rc.3`、`alpha` = `0.1.7-alpha.2`（当日 16:08 发布）；桌面壳最新发布 = **`desktop-v0.1.7`**。

