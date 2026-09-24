# project-facts — dsh-desktop 单一事实源索引

> **文档版本：v1.28**（2026-09-24 更新）
> 变更记录：
> - v1.28 — 新增 **F27：官方客户端会话列表快照的形状（**没有 `current` 字段**）**——判定「当前会话」必须用 **`retainedBy.mainView > 0`**（官方 `dsh-client-ui-session` 的 `publishMain` 写法）；来由：`project-explorer` 读了不存在的 `snap.current` ⇒ 恒 `undefined` ⇒ host 回退到磁盘根 `C:\` 并整盘渲染（`HANDOVER.md` §44）。**F11** 补记该插件的新回归（host 套件**路径改为相对本仓库**——此前硬编码指向已冻结的 `D:\opencode\001\dsh-desktop`，对本仓库 host 改动失明；smoke 套件 +8 例 `activeSessionId`）。
> 变更记录：
> - v1.27 — 新增 **F26：`$DSH_HOME` 备份**（`.work/backup-dsh-home.ps1` + 每日计划任务 `dsh-desktop-backup-DSH_HOME`）；**F11** 补该工具。来由：2026-09-24 事故连带丢掉了全部会话与 `settings.yaml`，而 `$DSH_HOME` 是**本项目唯一没有兜底的重要数据**（整个才 ~2 MB）。`HANDOVER.md` §43。
> 变更记录：
> - v1.26 — **版本锚点更正（实测优先）+ 新增 F25**。① **F2**：核心版本 `0.1.5-rc.2` → **`0.1.7-rc.1`**（用户已手动升级；并澄清 `dsh --version` **≠** `dist-tags.latest`）。② **F10**：锁版默认值同步抬到 `0.1.7-rc.1`，并明确「`setup.ps1` 自身默认保持 `""` 不锁版，锁版权威源只有 `deploy.ps1` 一处」。③ **F17**：闸门日期随之推进到 `2026-09-24T00:00:00.000Z`（**闸门必须晚于所钉版本发布时间**，否则解析看不到它）。④ **新增 F25**：🔴 **`0.1.5-rc.2` 在 profile 存在用户 patch 层时启动即崩**（`user patch-layer watching requires the Cordis HMR service`）——与便携包「默认预装 6 个插件」直接冲突，0.1.7-rc.1 起修复。⑤ **F11**：Go 套件 39 → **42 用例**（新增 `TestKnownStartupFault`）。`HANDOVER.md` §42。
> 变更记录：
> - v1.25 — 新增 **F24：壳的核心版本更新策略**——旧逻辑 `installed == dist-tags.latest` 字符串等值 + 静默 `npm i -g`（**会把用户手装的更新版本降级回去**，且无开关），现在**只提示、按通道选、可跳过**，比较复用既有 `compareDshVersions`；⚠️ **通道现状：从来没有正式版**，只有 rc / alpha（上游把 `0.1.7-rc.1` 发在 `next`，`latest` 仍钉 `0.1.5-rc.3`）。**F11** 补记 Go 侧套件（`go test ./...`，**39 用例**，含默认跳过的联网用例）。`HANDOVER.md` §40。
> 变更记录：
> - v1.24 — 新增 **F23：vekenllm 的两个内网网关（集团 `192.168.100.63:4000` / 技术 `192.168.15.137:4000`）**——实测两地址都可达但**同一 key 不通用**（`401 token_not_found_in_db`）⇒ 两套独立 LiteLLM，**凭据引用必须分开**（`VEKENLLM_API_KEY` / `VEKENLLM_TECH_API_KEY`）；新增第二条预置 `vekenllm-tech`（模型清单照集团复制、**未实测**）。**F11** `provider-presets.test.mjs` **184→205 断言**。`HANDOVER.md` §39。
> 变更记录：
> - v1.23 — 新增 **F22：官方客户端座位契约**（keyed 要 `key`、**list 要 `id`**；缺 required 字段注册被拒且页面无报错、不渲染——预置供应商首版就栽在这里，两台机器上都看不到面板；`HANDOVER.md` §38）；**F9** 的 `provider-presets` 修复（`lib/client.js` 33624→34104 字节）；**F11** `provider-presets.test.mjs` **180→184 断言**（新增座位契约断言）。
> 变更记录：
> - v1.22 — 新增 **F21：包内 `README.txt` 的语言/编码/生成纪律**（改中文 + 带 BOM；**文本一律用单引号 here-string**，因为双引号 here-string 实测把 `` `tar `` 变成 TAB、把未定义的 `$DSH_HOME` 内插成空——两个 bug 自 0.1.3 起存在于每个发行包）；**F11** `ps51-encoding.test.ps1` **31→38 项**（+7 项 README 断言）。`HANDOVER.md` §37。
> 变更记录：
> - v1.21 — 新增 **F20：GitHub 文案语言与生成**（Release 说明模板改中文 + 10 个历史 Release 用 CI 内置 `GITHUB_TOKEN` 幂等改写，工具 `.work/localize-release-notes.mjs`；**按版本判定能力**而非照英文正文字面翻译；仓库简介 About 需 administration 权限、只能手工设置）；**F11 → 16 个套件/工具**（+ `localize-release-notes.mjs`）。`HANDOVER.md` §36。
> 变更记录：
> - v1.20 — 新增 **F19：行尾与插件载荷哈希**（仓库无 `.gitattributes` + `core.autocrlf=true` ⇒ 检出 CRLF / 构建 LF；`payloadHash()` 改为 **CRLF→LF 归一**后，「已是最新」=「内容相同」）；**F11** `plugin-selection.test.ps1` **57→59 项**（+2 项 CRLF 断言）；**F18** 补 `.cmd` 包装器的**引擎解析顺序**（Program Files PS7 → PATH `pwsh` → 5.1）、`--which-shell` 自检、以及**全仓库 `.ps1` 两引擎解析自检**（`edit` 往 here-string 里写反引号曾把 `pack-release.ps1` 写坏、3 个套件同时 ParserError），`ps51-encoding.test.ps1` **17→31 项**；**F15** 发布 `0.1.9`（CI run #15 success、资产 98.6 MB、`verify-release.mjs` **27/27**；并在**发布资产**上用 5.1 + GBK 实测包内安装器/更新器通过）。`HANDOVER.md` §34/§35。
> 变更记录：
> - v1.19 — 新增 **F18：跨引擎契约（脚本必须同时跑在 Windows PowerShell 5.1 与 7）**——干净 Windows 只有 5.1，实测两个差异（native stdout 按**控制台代码页**解码 → 中文乱码吞掉 JSON 引号；`ConvertFrom-Json` 把顶层 JSON 数组当**一个对象** → 只拿到 1 行）。修复：`--ascii` + 钉 `[Console]::OutputEncoding` + 形状归一；`HANDOVER.md` §34。**F11 → 15 个套件**（新增 `.work/ps51-encoding.test.ps1` 17 项，用真实 5.1 子进程 + 钉 936）；**F15** 发布 `0.1.9`。
> 变更记录：
> - v1.18 — **F9 → 6 个插件**（新增 `provider-presets`＝编号 6：把 vekenllm / 电信算力两条 provider profile 做成**随插件分发的预置**，GUI 内启用/停用 + 就地填 key；密钥只走官方 `credentials.set`，脚本与发行包永不携带；`HANDOVER.md` §33）；**F11 → 14 个套件/工具**（新增 `provider-presets.test.mjs` 180 断言 + `provider-presets-smoke.test.mjs` 19 断言；`plugin-selection.test.ps1` 57 项）；**F15**：`0.1.8` 已发布（CI run #14 success；raw 114.6 MB / 51 文件、资产 zip 98.6 MB；`verify-release.mjs` **27/27**）。
> 变更记录：
> - v1.17 — **F7** 补「本地发行包目录 `D:\dsh\app\packages\`：只留最新一份 zip + `LATEST.txt`（打包自动清理旧包）」；**F11** → **12 个套件/工具**（新增两个入库工具 `verify-release.mjs` / `watch-release.mjs`；两个 pwsh 套件扩到 52/28 项并含"仓库根干净"断言）；目录约定见 `HANDOVER.md` §32 与 `AGENTS.md`「目录约定（多会话并行）」。
> 变更记录：
> - v1.16 — 新增 **F17：harness 安装的 `--before` 时间闸门**（上游 2026-09-22 发布不完整的 `0.1.5-rc.3` 家族 → 直接安装 rc.2 会 ETARGET；CI 与新机安装均已加闸门；`HANDOVER.md` §31）。
> 变更记录：
> - v1.15 — 新增 **F16：插件更新入口 `scripts/update-plugins.ps1`**（只更新已装插件；内容哈希判定；失败回滚；`-CheckOnly` 不写；随包发布）；F11 → **11 个套件**（新增 `update-plugins.test.ps1` 26 项）；F15 包内文件数 42（含更新器）；`HANDOVER.md` §30。
> 变更记录：
> - v1.14 — F15 更新：便携包内含 **5 插件 / 42 文件**；新增 `0.1.6`（`HANDOVER.md` §29.9）。⚠️ `0.1.5` 的包只含 4 个插件（tag 早于 `model-sync` 提交）。
> - v1.13 — **F9 → 5 个插件**（新增 `model-sync`＝编号 4，`project-explorer` 顺延为 5；`HANDOVER.md` §29）；**F11 → 10 个套件**（9 个 node + 1 个 pwsh；新增 `model-sync.test.mjs`(64 断言)/`model-sync-live.mjs`/`plugin-selection.test.ps1`，且后者期望值由 `--describe` 推导）；F13/F14 的"4 个插件"同步为 5 个。
> 变更记录：
> - v1.12 — **F9 插件清单**升级为"单一数据源 + 编号 + 中文说明"：`setup-plugins.mjs --describe` 同时供给安装菜单与包内 README；`-Plugins 2,4` 支持编号，**输入无效则不装任何插件**（`HANDOVER.md` §28）。
> 变更记录：
> - v1.11 — F15 补充**单文件运行时**：包内 `runtime\` 改为 `runtime.zip`（首次启动自动解压，含 CLI `--extract-runtime`），包从 **27,413 个文件降到 35 个**（拷贝 88.8s → 15.9s），详见 `HANDOVER.md` §27.11。
> - v1.10 — F15 补充首发事故要点：`npm i -g`（嵌套）与 `npm install --prefix`（提升）布局不同 → 打包器加 `-RuntimeMode auto` + **运行时自检闸门**；发布资产 104.9 MB（详见 `HANDOVER.md` §27.7）。
> - v1.9 — 新增 **F15：便携发行包**（`scripts/pack-release.ps1` + `.github/workflows/release-desktop.yml`；实测 zip 106.2 MB、含便携 Node 与离线 harness 树；壳的便携运行时解析见 `HANDOVER.md` §27）。
> - v1.8 — **版本锚点刷新（0.1.5-rc.1 → `0.1.5-rc.2`）**：F2（核心版本）、F10（跨机锁版 = `deploy.ps1` 默认值）；**部署入口统一**：F7/F14 补记「首装与更新共用 `scripts/deploy-shell.ps1`，**唯一启动入口 = 应用区 exe**」。
> - v1.7 — 新增 **F14：壳更新入口 = `update.ps1`**（一条命令：pull + 插件 + 构建 + 部署；回归验证脚本 `.work/verify-fresh-clone.ps1`）；F7 补记「壳源码在本仓库、fork 根级 `desktop/` 已废弃（§24）」。
> - v1.6 — **F5 转为健康**：`SYNC_TOKEN` 已换新并端到端验证（run #49 `success`，fork `behind_by = 0`）；新增巡检工具 `.work/sync-status.mjs`（`HANDOVER.md` §24.6）。
> - v1.5 — F5 补记：fork 已按 `HANDOVER.md` §24 降级为**纯官方镜像**（fork 独有根级 `desktop/` 已于 `41aaec8` 删除）；`SYNC_TOKEN` 仍待换新。
> - v1.4 — 新增 **F13：上游已有一方官方桌面端 `apps/desktop/`（Electron）**，及其「不提供 `webServer`」对我们 5 个插件的含义（`HANDOVER.md` §24.5）。
> - v1.3 — F7 补记 2026-09-15 实踩：桌面快捷方式曾指向冻结旧工作区 → 「启动的必须是应用区 exe，且要核对运行进程路径」。
> - v1.2 — F1 标注「端口浮动避让已暂缓（用户决定）」，指向 `HANDOVER.md` §23.4 的触发条件。
> - v1.1 — 新增 F12（壳日志上限/轮转，随 §23 壳加固落地）；F7 补充「替换 exe 需先关壳」的文件锁事实。
> - v1.0 — 建立事实源索引，收口端口 / 核心版本 / 同步频率 / 路径 / 插件清单 等被多处复制的数值；勘误「官方同步每小时」（实为每天 08:00，见 F4）。

## 为什么有这个文件

同一条事实被抄进 `AGENTS.md`、`HANDOVER.md`、`README.md`、`DEPLOY.md`、插件 README 后必然漂移：2026-09-14 就出现过「核心版本写 0.1.2-rc.1、实际 0.1.5-rc.1」「同步频率一处写每小时、一处写每天 08:00」两起。

**规则：**

1. **权威源只有一处**（下表「权威源」列）。要改事实 → 改权威源。
2. 其他文档**只引用，不复制**具体数值；必须写快照时，标注「快照（日期）」并链回本文件。
3. 本文件只做**索引 + 快照**，本身不是权威源；与权威源冲突时**以权威源为准**，并回来更新本文件。

## 事实表

| # | 事实 | 权威源（改这里） | 当前快照 | 常见引用者 |
|---|---|---|---|---|
| F1 | **dsh web 端口 = 43080（固定）** | `app.go` 的 `dshPort` 常量（两个平台文件的 `--port` 传参照用） | `43080`。**端口浮动避让已由用户决定暂缓**（2026-09-14），保留固定端口；触发条件与改法见 `HANDOVER.md` §23.4 | `AGENTS.md`、`README.md`、`HANDOVER.md` §14 |
| F2 | **核心版本** | 实测 `dsh --version`（全局 npm `@deepseek-ai/dsh`） | **`0.1.7-rc.1`**（2026-09-24 实测；⚠️ **`dsh --version` ≠ `dist-tags.latest`**——`latest` 仍钉在 `0.1.5-rc.3`，而 0.1.7-rc.1 发在 `next`。旧值 `0.1.5-rc.2` 已废弃：该版本在 profile 存在用户 patch 层（装了插件）时**启动即崩**，见 F25/`HANDOVER.md` §42） | `AGENTS.md`、`HANDOVER.md`、`README.md`、`DEPLOY.md` |
| F3 | **服务探测语义** | 实测（`curl`） | 裸 URL `401` = **正常**（浏览器认证围栏，0.1.2-rc.1 起）；`000` = 未运行；`200` 只在带 token/cookie 时出现 | `AGENTS.md`、`HANDOVER.md` §10.7-18 |
| F4 | **官方同步频率 = 每天 08:00（北京时间）** | fork `FFaassdfs/deepseek-harness` 的 `.github/workflows/sync-upstream.yml` 里 `cron: '0 0 * * *'`（UTC 00:00） | `0 0 * * *`（实测 workflow 源码）。**勘误**：`HANDOVER.md` §10.5 旧记「每小时 `0 * * * *`」有误，已就地更正 | `AGENTS.md`「凭据与同步」、`HANDOVER.md` §10.5 |
| F5 | **官方同步状态 / fork 职责 / 巡检** | fork 的 Actions 运行记录 + fork 内容；巡检用 `.work/sync-status.mjs` | ✅ **正常运行**（2026-09-15 起）：新 PAT 已写入 `SYNC_TOKEN`，run #49 `workflow_dispatch` = `success`，fork `behind_by = 0`。fork 为**纯官方镜像**（根级 `desktop/` 已于 `41aaec8` 删除，与上游唯一差别只剩 `sync-upstream.yml`）。历史故障：run #47（09-14）/#48（09-15 02:23Z）因旧 PAT 失效而 `failure` | `HANDOVER.md` §20.7、§22、§24.6 |
| F6 | **源码区（唯一权威）** | 本仓库 | `D:\dsh\dsh-desktop-env` | 各处 |
| F7 | **应用区（exe）与启动路径** | 部署逻辑 = `scripts/deploy-shell.ps1`（被 `setup.ps1` / `update.ps1` 共用） | **唯一启动入口** `D:\dsh\app\current\dsh-desktop.exe`；`build\bin\dsh-desktop.exe` 只是中间产物。历史版本 `D:\dsh\app\versions\<日期>\` + `VERSION.txt`。⚠️ ①运行中的壳**持有该文件的锁** → 换 exe 必须先关壳（部署脚本会自动暂存 `.new.exe`；也可用 `.work\swap-desktop-exe.ps1`）②**启动入口必须指向应用区**：桌面快捷方式已于 2026-09-15 改指应用区；换壳后核对 `Get-Process dsh-desktop \| Select Id,Path`（§23.4）③**本地发行包目录 = `D:\dsh\app\packages\`**：打包时**自动只保留最新那一份 zip** 并写 `LATEST.txt`（文件名/版本/大小/SHA256；`-KeepOldPackages` 可关）→ **要拷去别的机器只认 `LATEST.txt`**（§32） | `AGENTS.md`、`README.md`、`DEPLOY.md` §6、`HANDOVER.md` §20/§23/§25/§26/§32 |
| F8 | **DSH_HOME / profile** | 环境变量 `DSH_HOME`（默认 `~/.dsh`） | `C:\Users\veken\.dsh`；profile = `profiles/web`；插件包 = `profiles/node_modules` | `HANDOVER.md` §2.1、§20.4 |
| F9 | **插件清单（6 个 + patch id + 编号 + 中文说明）** | `scripts/setup-plugins.mjs` 的 `PLUGINS` 数组（**单一数据源**：`title`/`summary`/`where`/`writes`；数组按短名字母序 = 安装菜单编号） | `1=plugin-core-version`(核心版本徽标)、`2=plugin-explainer`(插件说明面板)、`3=plugin-model-capabilities`(模型能力清单)、`4=plugin-model-sync`(模型同步)、`5=plugin-project-explorer`(项目文件树)、`6=plugin-provider-presets`(预置供应商)；安装器菜单与包内 README 均由 `node scripts/setup-plugins.mjs --describe` 生成；`-Plugins 2,4` 支持编号，**输入无效则不装任何插件**（`HANDOVER.md` §28） | `HANDOVER.md` §3/§11/§15/§21/§28/§33 |
| F10 | **跨机锁定的 dsh 版本** | `deploy.ps1` 的 `-HarnessVersion` 默认值（+ `DEPLOY.md`/`OPENCODE_PROMPT.md`/`README.md`/`setup.ps1` 注释引用） | **`0.1.7-rc.1`**（2026-09-24 起；历史值 `0.1.5-rc.2` 已废弃——**它启动即崩**，见 F25）。⚠️ `setup.ps1` 自身的默认值**保持 `""`（不锁版）**：锁版权威源只有 `deploy.ps1` 一处，`deploy.ps1` 透传给 `setup.ps1` | `DEPLOY.md`、`OPENCODE_PROMPT.md`、`README.md` |
| F16 | **插件更新入口（只更新插件）** | `scripts/update-plugins.ps1`（+ `.cmd` 双击包装；随发行包发布到包根） | 默认 `-Plugins installed`（只更新**已装**的）；`-CheckOnly` 只报告不写；**内容哈希**判定 `missing/outdated/current`（`setup-plugins.mjs --status`）；**失败自动回滚**（`.backup-<ts>`）；测试 `.work/update-plugins.test.ps1` 26 项 | `HANDOVER.md` §30、`README.md` |
| F17 | **harness 安装的时间闸门（`--before`）** | CI 工作流 `Stage the harness runtime` 步骤的内置 `$before`；`setup.ps1 -HarnessBefore`（默认 `2026-09-24T00:00:00.000Z`） | ⚠️ **闸门日期必须晚于所钉版本的发布时间**，否则解析永远看不到它。2026-09-24 把钉版抬到 `0.1.7-rc.1` 时，闸门同步从 `2026-09-22T05:00:00.000Z` 推进到 `2026-09-24T00:00:00.000Z`。闸门最初的理由仍然成立：上游 2026-09-22 发布**不完整**的 `0.1.5-rc.3` 家族（`@deepseek-ai/dsh-client-ui-sidebar-documentpreview` 缺 rc.3）→ 因 rc.2 声明 caret `^0.1.5-rc.2`，直接装 rc.2 会解析到 rc.3 子包并 **ETARGET**。`-HarnessBefore ""` 可关闭 | `HANDOVER.md` §31/§42 |
| F18 | **跨引擎契约：脚本必须同时可用在 PS 5.1 与 7**（2026-09-23） | `scripts/setup-plugins.mjs` 的 `--ascii` + `install-offline.ps1`/`scripts/update-plugins.ps1` 的 `[Console]::OutputEncoding` 钉 UTF-8 + 所有 JSON 解析写成 `@($raw \| ConvertFrom-Json) \| ForEach-Object { $_ }`；`.cmd` 包装器的引擎解析顺序 = `%ProgramW6432%`/`%ProgramFiles%\PowerShell\7\pwsh.exe` → PATH 的 `pwsh` → `powershell`（5.1），并提供 `--which-shell` 自检 | **目标机器是干净 Windows ⇒ 只有 5.1**。两条差异必须同时对付：① 5.1 用**控制台代码页**（zh-CN = 936）解码子进程 stdout → 中文乱码可吞掉 JSON 收尾引号；② 5.1 的 `ConvertFrom-Json` 把顶层 JSON **数组当作一个对象**（`@(...)` 得 1 行）。**规则**：调外部程序并解析其输出时，机器可读载荷一律用 `--ascii`（纯 ASCII 与代码页无关）+ 形状归一；含非 ASCII 的 `.ps1` 必须带 UTF-8 BOM、`.cmd` 必须纯 ASCII（`edit` 会吃掉 BOM，改完必查）；**`powershell` 永远是 5.1，PS7 只有 `pwsh.exe`**；回归套件 `.work/ps51-encoding.test.ps1`（**31 项**：真实 5.1 子进程 + 钉 936 + 假 Program Files 跑真实包装器 + **两引擎解析自检**） | `HANDOVER.md` §34 |
| F19 | **行尾（CRLF/LF）与插件载荷哈希**（2026-09-23） | `scripts/setup-plugins.mjs` 的 `normalizeEol()`（哈希前 CRLF→LF 归一，latin1 逐字节、保留 BOM） | 仓库**无 `.gitattributes`** 且 `core.autocrlf=true` ⇒ git 检出 **CRLF**、本地构建 **LF**，内容逐字节相同但字节哈希不同；`payloadHash()` 原按原始字节算 ⇒ 从发行包安装的插件被判「待更新」并被反复重写。归一后「已是最新」=「内容相同」。判定口径只在 `--status` 一处，`update-plugins.ps1` 不自行计算 | `HANDOVER.md` §35 |
| F20 | **GitHub 文案语言与生成**（2026-09-23） | 新 Release 的说明模板 = `.github/workflows/release-desktop.yml` 的 `body:`（**单一事实源**）；历史 Release 中文化 = `.work/localize-release-notes.mjs` + `.github/workflows/localize-release-notes.yml`（幂等，走 CI 内置 `GITHUB_TOKEN`） | Release 说明一律**中文**（含 6 插件表 / 快速开始 / 注意事项），标题 `dsh-desktop <ver>（便携包 · Windows x64）`；**按版本判定能力**（0.1.3 起单文件 `runtime.zip`、0.1.5 起中文安装菜单、`install-offline.cmd` 全版本都有）而非照英文正文字面翻译；仓库简介 About 已改中文并加 7 个 topics（2026-09-23）。⚠️ 两个 API 坑：**About 需 administration**（`GITHUB_TOKEN` 不具备 → 只能 PAT/网页）；**`topics` 放 repository PATCH 里会被静默忽略**（200 OK 但为空）→ 必须 `PUT /repos/{owner}/{repo}/topics` + mercy preview 媒体类型 | `HANDOVER.md` §36.5 |
| F21 | **包内 `README.txt` 的语言、编码与生成纪律**（2026-09-23） | `scripts/pack-release.ps1` 的 `$readmeText`（**单引号** here-string + `__PKG__`/`__CATALOGUE__` 占位符）+ `[IO.File]::WriteAllText(..., UTF8Encoding($true))` | 包内 README **中文**、**带 UTF-8 BOM**（无 BOM 的中文 `.txt` 在旧记事本是乱码）。**纪律**：凡是会被用户原样读到的文本（含 `$`/反引号）一律用**单引号 here-string**——双引号 here-string 会把 `` `t `` 变成 TAB、把未定义的 `$VAR` 内插成空（实测：`` `tar ``→TAB、`$DSH_HOME` 消失，两个 bug 在 0.1.3 起的每个包里都存在过）；需要内插的值走占位符替换 | `HANDOVER.md` §37 |
| F22 | **官方客户端座位契约（kind → 必需注册字段）**（2026-09-23） | 注册表产物 `dsh-cordis-client-runner/lib/client.js` 里每个座位的 `registerOptions`（机器生成，可直接读）；断言见 `.work/provider-presets.test.mjs` 的「座位契约」段 | **keyed 座位要 `key`，list 座位要 `id`**（`order`/`label` 可选）——缺 required 字段时注册会被**拒绝，且页面无任何报错、不渲染**（最难查的静默失败）。实测：`settings.models.provider-card`=keyed→`key`（模型同步正常）；`settings.models.footer`=list→**`id`**（预置供应商首版漏传 `id`，两台机器上都不出现，`HANDOVER.md` §38）。**规则**：挂新座位前先读契约，别用"和另一个能用的插件写法一样"来推断 | `HANDOVER.md` §38 |
| F23 | **vekenllm 的两个内网网关（集团 / 技术）**（2026-09-23） | 生产配置 = 插件 `provider-presets` 的两条预置（`vekenllm` / `vekenllm-tech`）；`config.json` 单一数据源 | `192.168.100.63:4000` = **集团大楼内网**（route `vekenllm`，ref `VEKENLLM_API_KEY`）；`192.168.15.137:4000` = **维科技术内网**（route `vekenllm-tech`，ref `VEKENLLM_TECH_API_KEY`）。**实测：两个地址都可达，但同一 key 只在一个网关有效**（集团 key → 技术网关 `401 token_not_found_in_db`）⇒ **两套独立 LiteLLM、各自 token 库**，故**凭据引用必须分开**（否则互相覆盖）。**只启用所在网络的那一条**（同时启用会出现重复模型）。技术那条的模型清单**照集团复制、未实测**（拿不到该网关的 key）。⚠️ 两份 `vekenllm-*-setup-*.md` 是**冻结快照**（§4 已列两个地址，但未含"key 不通用"这一实测结论）→ 以此表为准 | `HANDOVER.md` §39 |
| F24 | **壳的核心版本更新策略（只提示 + 按通道选 + 可跳过）**（2026-09-24） | 逻辑 = `version.go`；比较**复用** `runtime.go` 的 `compareDshVersions` / `splitVersion`（单一事实源）；前端 = `frontend/` 的「核心版本」区；偏好落盘 = `%APPDATA%\dsh-desktop\update.json` 的 `skippedCore` | **只提示，绝不自动装**（旧逻辑 `installed == dist-tags.latest` 字符串等值 + 静默 `npm i -g` 会**把用户手装的更新版本降级回去**，且没有任何开关）。现在按 **semver** 比较、**每通道取最新**（dist-tags 仅作参考：上游把 `0.1.7-rc.1` 发在 `next`，`latest` 仍钉在 `0.1.5-rc.3`）；面板逐行「更新·重装」+「跳过」（跳过只在出现比它更新的版本时才再提示，可「恢复提醒」）。安装只在用户点按钮时发生；便携包走 `stageBundledRuntime(指定版本)`。⚠️ **通道现状：从来没有正式版（stable）**，只有 rc / alpha | `HANDOVER.md` §40 |
| F25 | **🔴 `0.1.5-rc.2` 启动即崩（便携包致命缺陷）**（2026-09-24） | `app.go` 的 `hmrFaultSignature` + `knownStartupFault()`（把签名翻成可操作指引，**优先于"端口被占用"提示**）；回归断言 `TestKnownStartupFault` | 现象：`dsh web` 启动即抛 `Error: dsh: user patch-layer watching requires the Cordis HMR service`（`dsh-app-boot/lib/index.js:1112` 的 `if (hmr === void 0) throw`）并退出 → 壳自动重启 3 次耗尽预算 → 服务永久起不来。**触发条件 = profile 存在用户 patch 层**（即装了任何插件）⇒ **与便携包「默认预装 6 个插件」直接冲突**。**0.1.7-rc.1 起已修复**（实测：同一 DSH_HOME 换 0.1.7-rc.1 后正常）。**教训**：`0.1.5-rc.2` 是**坏的，不要再用**；便携包钉版因此从 rc.2 抬到 rc.1（§42.4） | `HANDOVER.md` §42 |
| F26 | **`$DSH_HOME` 备份**（2026-09-24） | `.work/backup-dsh-home.ps1`（入库）+ Windows 计划任务 **`dsh-desktop-backup-DSH_HOME`** | 🔴 **`$DSH_HOME` 是本项目唯一没有版本控制、也没有兜底的重要数据**（2026-09-24 事故丢了全部会话 + `settings.yaml`）。备份 **`sessions\` / `storages\` / `.credentials.yaml` / `settings.yaml` / `AGENTS.md` / `.anonymous-user-id` / `profiles\web\cordis.patch.yml`** → `D:\dsh\backups\dsh-home-<时间戳>\`，自动保留最新 20 份；**刻意跳过** `profiles\node_modules\`（插件可重装）。**自验证**：比对文件数 + 断言 `.credentials.yaml` 逐字节相同，不一致即 `throw`。每日 **12:00** 自动跑（`-CheckOnly` 可干跑）。整个 `$DSH_HOME` 仅 **~2 MB** | `HANDOVER.md` §43.3 |
| F27 | **官方客户端「会话列表快照」的形状（**没有 `current`**）**（2026-09-24） | 权威读法 = 官方 `dsh-client-ui-session/lib/client.js` 的 `publishMain()`；消费方 = `plugins/dsh-client-ui-plugin-project-explorer/src/bundle.template.js` 的 `activeSessionId()`；回归 = `.work/filetree-smoke.test.mjs` 的 `activeSessionId` 段 | 🔴 **`sessions.list.getSnapshot()` 返回 `{ids, byId, phase, projectionsBySession}`——`current` 字段不存在**（全文件搜过，所有 `current` 命中都是无关局部变量）。判定「当前会话」必须取 **`retainedBy.mainView > 0`** 的那个（`retainedBy` 由 session controller 投影进每个 `byId` 条目，**不需要额外服务**）：已跟随的会话只要**仍被主视图保留**就继续用它，否则取第一个满足者，都没有则 `undefined`。**踩坑后果**：读 `snap.current` 恒得 `undefined` ⇒ `sessionCwd` 不发 ⇒ host 回退到**自己进程的 cwd**，而快捷方式启动的 `dsh web` cwd 是**磁盘根 `C:\`** ⇒ 面板把整个 C 盘当项目目录（"对不上当前项目"，但不报错、树还能展开，所以像"功能坏了"而不是"取错值"）。**同族教训**：同一错误字段常被复制两处（本次：取根 + 拖拽插入）——修完要全文件搜同名字段；**挂官方座位/读官方快照前，先从官方源码确认字段，别靠"另一个插件也这么写"推断**（对照 F22） | `HANDOVER.md` §44 |
| F11 | **测试入口与开发工具** | 仓库 `.work/`（套件 + `lib/react-source.mjs` + 两个发布工具 + 一个文案工具） | **16 个套件/工具**：node 套件 = explainer 冒烟 `smoke-test.mjs` + 开关路由 `host-toggle-test.mjs`、**文件树 `filetree-host.test.mjs`（**路径已改为相对本仓库**，含磁盘根拒绝 O1/O2；曾硬编码指向冻结的 `D:\opencode\001\dsh-desktop` ⇒ 对本仓库 host 改动失明，见 F27/§44.4）+ `filetree-smoke.test.mjs`（含 `activeSessionId` mainView 判定 8 例）**、core-version、model-capabilities host/冒烟、model-sync 单测 `model-sync.test.mjs`（64 断言）+ 真实数据 `model-sync-live.mjs`、**provider-presets 单测 `provider-presets.test.mjs`（205 断言，含座位契约断言与 3 条预置）** + **`provider-presets-smoke.test.mjs`（19 断言，真 react SSR）**；pwsh 套件 = `plugin-selection.test.ps1`（**59 项**）、`update-plugins.test.ps1`（**28 项**）、**`ps51-encoding.test.ps1`（38 项，用真实 Windows PowerShell 5.1 子进程 + 控制台钉 936 跑真实脚本，含 BOM 守卫、两引擎解析自检与包内 README 断言；见 F18/F21）**；**工具** = `verify-release.mjs <tag>`（发布资产端到端验证）、`watch-release.mjs <tag>`（盯 CI + 指出失败步骤）、**`localize-release-notes.mjs`（Release 说明中文化，幂等，见 F20）**。三个 pwsh 套件都含"测试结束时仓库根没有新增条目"断言（§32）。**Go 套件** = 仓库根 `go test ./...`（**42 用例**，`go vet` 干净）：`version_test.go`（核心版本选择器：通道归类 / 每通道最新 / 选项构造 / 跳过语义 / 偏好落盘，**9 例**）+ `app_test.go`（启动诊断：`TestProbeRuntimeNode` / `TestDshLogPath` / **`TestKnownStartupFault`（F25 的签名分类，含"不得误判端口冲突"）**）+ `runtime_test.go` / `windowstate_test.go` / `logutil_test.go` / `dsh_windows_test.go`；其中 `TestFetchRegistryLive` **默认 t.Skip**，`DSH_LIVE_REGISTRY=1` 才联网 | `HANDOVER.md` §21/§28/§29/§30/§32/§33/§34/§36/§40/§42/§44 |
| F12 | **壳日志上限 / 自愈退避** | `app.go` 顶部常量（`maxDshLogBytes`、`maxDebugLogBytes`、`tailReadBytes`、`restartBackoffBase`、`restartBackoffMax`、`stableResetPeriod`、`maxRestarts`） | `dsh.log` 5 MiB、`debug.log` 1 MiB、报错只读尾部 64 KiB；退避 15s→45s→120s 封顶、连续 3 次、稳定 5 分钟重置 | `HANDOVER.md` §23 |
| F13 | **上游已有一方官方桌面端** | 上游仓库 `deepseek-ai/deepseek-harness` 的 `apps/desktop/`（+ `.agents/notes/implemented/architecture/2026-08-25-electron-desktop-packaging-and-updates.md`） | **Electron 壳、不开监听端口、独占 `$DSH_HOME/profiles/desktop`**、自带 Node/pnpm 与 dsh 依赖树、签名+自动更新（2026-09 起 implemented）。⚠️ **不提供 `webServer`** → 我们 5 个插件的 host 自定义路由在该 profile 下不可用，需换传输层（`HANDOVER.md` §24.5） | `AGENTS.md`「权威源码位置」、`HANDOVER.md` §24.5 |
| F14 | **壳更新入口（多机同步）** | `update.ps1`（+ `setup.ps1` 首次、`scripts/deploy-shell.ps1` 部署、`.work/verify-fresh-clone.ps1` 回归验证） | `git pull` + `pwsh -File update.ps1` = pull → 刷新 4 插件 → `wails build`（**壳源码在本仓库**，fork 根级 `desktop/` 已废弃）→ 部署到应用区（dated 归档 + `VERSION.txt`）。实测（2026-09-15）：新克隆 HEAD → 21 个必需文件齐全 → `npm install` 13s + `wails build` 22s → exe 11,333,632 字节 | `README.md`「更新到最新壳」、`DEPLOY.md` §8、`OPENCODE_PROMPT.md` 第 5 步、`HANDOVER.md` §25/§26 |
| F15 | **便携发行包（离线一键 + 自更新 + 单文件运行时）** | `scripts/pack-release.ps1`（`-RuntimeMode auto\|dsh-tree\|full-node-modules`、`-NoNpm`、`-NoRuntimeArchive` + **运行时/npm/归档内容三道闸门**）+ `.github/workflows/release-desktop.yml` + `install-offline.ps1`（`-Plugins all\|none\|ask\|列表`） | 资产 `dsh-desktop-<ver>-dsh<dshver>-win-x64.zip` + `SHA256SUMS.txt`；**包内 51 个文件 / 6 个插件**（`0.1.9`/`0.1.10`；`0.1.7` 为 44/5、`0.1.6` 为 42/5；壳 exe + **`runtime.zip` 单文件运行时** + 安装器 + 更新器），首次启动自动解压（~35-42s，CLI `--extract-runtime`）；自带 npm → **自更新与源码装行为一致**。**本地留存目录 = `D:\dsh\app\packages\`**（`-OutDir` 指定）；本地包与 CI 包哈希不同属正常（**另有行尾差异，见 F19**、Node 24.16 vs 24.20）。⚠️ **`0.1.9` 的包内含未修复的 `provider-presets`（面板不显示，见 F22/§38）→ 0.1.10 起才对**。⚠️ 壳**单实例**；⚠️ 拷贝请搬 zip / 用 `robocopy /MT:16`（§27.11 实测 27,413 → 35 文件、88.8s → 15.9s） | `README.md`「便携发行包」、`HANDOVER.md` §27 |

## 使用示例

```powershell
# F1/F2/F3 一次核完
Select-String -Path app.go -Pattern 'dshPort\s*='   # 端口权威源
dsh --version                                       # 核心版本权威源
curl.exe -s -o NUL -w "%{http_code}`n" http://127.0.0.1:43080/   # 401 = 正常

# F4 权威源（fork 不在本工作区，直接读远端）
#   https://raw.githubusercontent.com/FFaassdfs/deepseek-harness/master/.github/workflows/sync-upstream.yml
# F5 运行记录
#   https://api.github.com/repos/FFaassdfs/deepseek-harness/actions/workflows/sync-upstream.yml/runs?per_page=3
```

## 快照文档（**不要**拿它们当事实源）

以下文件是**带日期的历史快照**，保留原貌不改写；引用时以本表为准：

- `desktop-shell-redesign-v1.0.md`（v1.0，2026-09-07，含当时的 0.1.2-rc.1）
- `vekenllm-auto-setup-v1.8.md`、`vekenllm-deepseek-v4-flash-setup-v3.5.md`、`litellm-auto-router-setup-v1.0.md`
- `HANDOVER.md` 各「路径」小节（§15.7、§16.2 等）中的版本号均为**当时实测值**
