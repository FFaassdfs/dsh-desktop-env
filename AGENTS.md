# dsh-desktop 项目默认预设

> 本文件每个会话开工时自动加载。详细交接细节见同目录 `HANDOVER.md`。默认中文回复。
>
> **当前状态（2026-09-24）**：源码区 = `D:\dsh\dsh-desktop-env`（本仓库，唯一权威工作区）；应用区 = `D:\dsh\app\current`（**唯一启动入口**，首装/更新同一落点）；壳 = **launcher @ 43080**（已运行 P0-3 加固版：退避 + 日志轮转，见 §23；**内置「核心版本」选择器：只提示不自动装、按通道选版本、可跳过**，见 §40）；核心 = **`@deepseek-ai/dsh 0.1.5-rc.2`**（全局 npm。⚠️ **不要再以为 `dist-tags.latest` 就是最新**：2026-09-24 时 `latest` = 0.1.5-rc.3 而 `next` = **0.1.7-rc.1**、`alpha` = 0.1.7-alpha.2，**上游从无正式版**；安装/打包仍必须带 `--before` 时间闸门，见 §31/§40）；最新便携包 = **`desktop-v0.1.11`**（本地留存 = `D:\dsh\app\packages\`，只留一份，见 §32）；旧工作区 `D:\opencode\001\dsh-desktop` **已冻结**；**6 个插件**均已纳入 `scripts/setup-plugins.mjs`（编号 6 = `provider-presets` 预置供应商——内置 **3 条预置**：vekenllm 集团内网 / vekenllm 技术内网 / 电信算力，GUI 内启用/填 key，**脚本与发行包永不携带密钥**，§33/§39；其面板曾因 **list 座位缺必填 `id`** 而静默不渲染，0.1.10 起修复，见 §38），host/client 均已验证（§21.3；§38.5 用户实视）。**P0 全部关闭**（§24）；**多机更新链已修好**（§25/§26）；**插件更新器** = `scripts\update-plugins.ps1`（§30）；**目录约定（多会话）见下方新增章节 + §32**。

## 开工必做

1. 先读 `HANDOVER.md`，了解既有开发线（互不冲突）：
   - 路径A（§3–§9）：官方 Web GUI「插件说明」插件
   - 路径B（§10）：桌面壳功能 + 代码迁入 fork + 官方自动同步
   - 路径C（§11）：项目文件树侧栏插件
   - 路径D（§12）：环境同步仓库；路径E（§15）：模型能力展示插件；路径F–I（§16–§18）：vekenllm 模型配置 / litellm 中转 / DSH auto 落地；§19：并行覆盖事故记录
2. 新任务按「路径 D、E…」递增，在 HANDOVER.md 末尾新增小节，并在任务结束更新其「最后更新」。
3. 动手前确认要做的没被 A/B/C 做过，避免重复实现。
4. **🔴 写入前必须刷新重读（2026-08-19 强制约定，防并行覆盖）**：多个会话可能并行编辑同一文件，**任何 agent 在写入/更新任何文件（尤其 `HANDOVER.md`、`AGENTS.md`）之前，必须先重新读取该文件最新内容再编辑**。①不要依赖会话早期读到的内容作为编辑依据（缓存可能已过期）；②改前核对行数与锚点，若结构/行数与记忆不符（章节消失等）→ **立即停止写入并重读全文**；③优先小步 `edit` 精确锚点，避免整文件 `write`（最易覆盖）；④发现内容被覆盖丢失 → **先报告用户确认恢复方式**，不要静默重建；⑤关键产出在 HANDOVER 留「文件名+版本+要点」索引，便于重建。**教训**：2026-08-19 HANDOVER 曾被并行会话整体重写，§16–§18 全部丢失（见 HANDOVER §19）。
5. **正式文件版本化（2026-08-19 约定）**：正式文件（配置说明/部署脚本/交接文档等会被其他 agent 复用/执行的文件）**每次更新后必须在文件内标注版本号 + 时间戳**并附变更记录；**文件名也要带版本号**（如 `xxx-setup-v3.4.md`）；语义化递增（大改→主号，小修→次号）。已实例：`vekenllm-auto-setup-v1.7.md`、`vekenllm-deepseek-v4-flash-setup-v3.4.md`、`litellm-auto-router-setup-v1.0.md`。
6. **参数以实测为准（2026-08-19 约定）**：外部服务/模型参数（上下文、输出上限、能力开关）文档只给推荐值/快照，**配置前必须实测**（如 vekenllm `/v1/models`），冲突时以实测为准。

## 目录约定（多会话并行，2026-09-22 起）

> **目的**：多个会话同时在这个仓库里干活时，各写各的、互不踩踏，且仓库根永远只有"源码 + 文档"。详见 `HANDOVER.md` §32。

| 位置 | 放什么 | 规则 |
|---|---|---|
| **仓库根** `<repo>\` | 源码 / 脚本 / 正式文档 / `plugins\` / `scripts\` / `.work\` / `global\` / `.github\` | **只放会入库的东西**。任何临时文件、临时目录、试验产物**都不要落在根目录** |
| `<repo>\.cache\<用途>\` | 临时/缓存：测试骨架、下载的包、npm/go 缓存、诊断输出 | **gitignored**。**按用途或会话起子目录**（如 `.cache\selftest`、`.cache\verify-0.1.7`），**别共用固定名字**——两个会话用同一个目录会互相删掉对方的东西 |
| `<repo>\.work\` | 可复用的开发脚本与测试套件（**入库**，别的会话能直接用） | 新增脚本/测试放这里，并在 HANDOVER/facts 留索引 |
| `D:\dsh\app\current\` | **唯一启动入口**（已部署的壳 exe + `VERSION.txt`） | 改壳后由 `update.ps1` / `scripts\deploy-shell.ps1` 部署；运行中的壳持有文件锁 |
| `D:\dsh\app\versions\<日期>\` | 历史部署归档 | 由部署脚本自动写，保留 |
| **`D:\dsh\app\packages\`** | **本地唯一的发行包**（你要拷去别的机器的那份） | 由 `pwsh -File scripts\pack-release.ps1 -ShellVersion <ver> -OutDir D:\dsh\app\packages` 生成；**打包时自动删掉旧包**（`-KeepOldPackages` 可关），并写 `LATEST.txt`（文件名/版本/大小/SHA256）与 `SHA256SUMS.txt`。**复制时只认 `LATEST.txt` 指向的那个 zip** |
| `D:\dsh\001\`、`D:\dsh\_migrate-2026-09-14\`、`D:\dsh\official-desktop-eval\` | 其他项目区 / 迁移归档 / 官方桌面端评估交接 | 不属于本仓库，别往里写 |

**🔴 两条硬规则（都有真实事故）**：

1. **别在仓库根留临时目录**：2026-09-22 曾因调用 `install-offline.ps1` 时漏了 `-Plugins` 标志，插件列表字符串被**位置绑定到 `-AppDir`**，在仓库根创建出 `2, 4`、`4,2`、`explainer,project-explorer` 等 5 个目录（各含一个 11 MB 的 exe），又被 `git add -A` **误提交**（`3f30a63`）。
   - 现已加护栏：`-AppDir` **必须是绝对路径**（否则直接报错，不建目录）；
   - 两个 pwsh 测试套件末尾都加了断言"**测试结束时仓库根没有新增条目**"。
   - **仍然**：提交前先 `git status` 看一眼，**不要无脑 `git add -A`**（本次就是它把垃圾带进库的）。
2. **临时目录带用途后缀**：`.cache\<用途或 tag>`。验证脚本会自己建 `.cache\verify-<版本>`；测试建 `.cache\seltest` / `.cache\uptest`。**发现别人占用了就换个名字**，不要清空别人的目录。

## 权威源码位置（别改错）

> ⚠️ **2026-09-14 迁移后更新**：壳源码权威位置已变更，旧记录（`.work\deepseek-harness\desktop\`）**作废**。

- **桌面壳源码（唯一权威）**：**本仓库根目录**——`app.go`、`main.go`、`dsh_windows.go`、`dsh_other.go`、`windowstate.go`、`frontend/`（launcher：状态面板 + node 直启 + token 交系统浏览器）
  - 当前形态：**启动器（端口 43080）**，真正的 dsh 界面由**系统浏览器**打开（见 `HANDOVER.md` §14）
- **应用产物（与源码分离）**：`D:\dsh\app\current\dsh-desktop.exe`（历史版本在 `D:\dsh\app\versions\<日期>\`）
  - 改壳后：`wails build` → 用 **`pwsh -File scripts\deploy-shell.ps1 -BuiltExe build\bin\dsh-desktop.exe`** 部署到应用区（首装/更新共用这段逻辑；exe 被运行中的壳锁住时自动暂存 `.new.exe`）
  - 🟢 **一条命令搞定（含 pull/插件/构建/部署）**：`pwsh -File update.ps1`（开关 `-SkipFrontend` 只编 Go、`-CheckOnly` 干跑、`-AppDir` 改应用区）；首次部署用 `setup.ps1`。**壳源码就在本仓库**，fork 根级 `desktop/` 已废弃（见 `HANDOVER.md` §24/§25）
  - 回归验证「新克隆能否构建」：`pwsh -File .work\verify-fresh-clone.ps1`
  - 📦 **便携发行包（离线一键，目标机零前置依赖）**：`pwsh -File scripts\pack-release.ps1` 打出 `dsh-desktop-<壳版本>-dsh<harness版本>-win-x64.zip`（含便携 Node + npm + 单文件 `runtime.zip` 离线 harness 树 + **6 个插件** + `install-offline.ps1` + `update-plugins.ps1`）；打 tag `desktop-v*` 由 `.github/workflows/release-desktop.yml` 自动发 Release（见 `HANDOVER.md` §27/§30）。壳已支持便携运行时（`$DSH_DESKTOP_RUNTIME` → `<exeDir>\runtime` → `<exeDir>`），便携模式下自更新走**包内 npm**（§27.9）
- **旧工作区 `D:\opencode\001\dsh-desktop` 已冻结**（见其 `FROZEN.md`）：**不要再写入/提交**
- **fork 本地克隆不在本工作区**：`.work\deepseek-harness` 未迁移；fork 仅作官方镜像用，历史补丁存 `.work\migration-2026-09-14\`
- **官方 harness 源码**（`packages/`、`apps/`、`vendor/` 等，若日后自行 clone）：**只读，不要改**——会被官方同步覆盖
- 🔴 **别混淆两个「desktop」**：上游仓库有自己的 **一方官方桌面端 `apps/desktop/`**（Electron 壳，已 implemented，独占 `$DSH_HOME/profiles/desktop`，**不提供 `webServer`**）；我们自己的 Wails 壳是**另一个**东西（本仓库根目录，launcher @ 43080 + `profiles/web`）。fork 里被删掉的是**根级** `desktop/`（我们的旧副本），与上游 `apps/desktop/` 无关。详见 `HANDOVER.md` §24.5 / `project-facts-v1.0.md` F13

## 高频坑（详情见 HANDOVER.md §10.7，共 20 条；新增的见本节顶部两条 5.1 坑）

- 🔴 **目标机器是干净 Windows ⇒ 只有 Windows PowerShell 5.1**（本机侧载了 PS7，所以 `pwsh` 全绿 ≠ 目标机可用）。两条 5.1 差异必须同时对付（详见 `HANDOVER.md` §34 / `project-facts` F18）：
  - **5.1 按「控制台代码页」解码子进程 stdout**（zh-CN = 936/GBK），中文乱码时**末尾悬空字节会吞掉 JSON 的收尾引号** → `ConvertFrom-Json` 崩。→ 机器可读载荷一律用 `node ... --describe/--status --ascii`（纯 ASCII 与代码页无关）；脚本开头钉 `[Console]::OutputEncoding` = UTF-8。
  - **5.1 的 `ConvertFrom-Json` 把顶层 JSON 数组当作「一个对象」**（PS7 会枚举成 N 个）→ 解析一律写 `@($raw | ConvertFrom-Json) | ForEach-Object { $_ }` 做**形状归一**，否则静默退化成 1 行 / names-only 兜底。
  - 回归套件：`.work\ps51-encoding.test.ps1`（用真实 5.1 子进程 + 钉 936 跑真实脚本）。
- **含非 ASCII 的 `.ps1` 必须带 UTF-8 BOM**，且 **`edit` 工具改完会吃掉 BOM** → 每次编辑后复查首 3 字节 `EF BB BF`（`ps51-encoding.test.ps1` 的 D 段会自动抓这个）。

- 沙箱里 git/API 走 HTTPS 报 `SEC_E_NO_CREDENTIALS`（schannel 凭据库被拒）→ 用 `danger-full-access` 重试
- 探测本地服务**别用** `Get-NetTCPConnection`/`netstat`（沙箱假阴性，会误判「无监听」）→ 用 `curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:43080/`
  - 🔴 **返回 `401` = 正常**（0.1.2-rc.1 起的浏览器认证门，本机 0.1.5-rc.2；裸 URL 一律 401）；`000` = 未运行；`200` 只在带 token/cookie 时出现
- 改 Go 后端后 `wails build -s`（跳过前端 vite，免提权）；**改前端/绑定或首次构建必须完整 `wails build`**；产物要拷到**应用区** `D:\dsh\app\current\dsh-desktop.exe`（构建 exit 0 ≠ 已生效）
- 🔴 **换壳后必须核对「运行中的进程」，不是磁盘上的文件**：`Get-Process dsh-desktop | Select Id,Path`。2026-09-15 实踩：应用区 exe 已是新构建，但桌面快捷方式仍指向**冻结的旧工作区**（`D:\opencode\001\dsh-desktop\build\bin\`），启动出来的还是旧壳——已把快捷方式改到应用区（详见 `HANDOVER.md` §23.4）
- 推送 `.github/workflows/*` 文件：🔴 **2026-09-20 实测更正——用 SSH push 是允许的**（把 `.github/workflows/release-desktop.yml` 直接推上去，GitHub 随即识别为 `active`）；`workflow` scope 的限制**只针对 token 方式**（PAT/OAuth），CI 内部的内置 `GITHUB_TOKEN` 同样推不了 workflow。fork 的 `SYNC_TOKEN` 已于 2026-09-15 换新并验证（§24.6），历史失效故障见 `HANDOVER.md` §20.7
- 沙箱里 Go 构建：把 `GOCACHE`/`GOTMPDIR` 重定向到 `.cache/`，否则写 `%APPDATA%\go-build` 被拒
- **本机 git 推送走 SSH 443**（`github.com:22` 不通；旧 PAT 已失效）：remote = `ssh://git@ssh.github.com:443/FFaassdfs/dsh-desktop-env.git`

## 凭据与同步

- 凭据文件：`.work\secrets.local.md`（**被 .gitignore 忽略，永不提交**）；推送/同步细节见 `HANDOVER.md` §10.3 / §10.5 / §20.7
- **数值以单一事实源为准**：端口 / 核心版本 / 探测语义 / 同步频率 / 路径 / 插件清单见 **`project-facts-v1.0.md`**（各文档只引用，不复制）
- **推送用 SSH（2026-09-14 起）**：旧 PAT 已失效；remote 为 `ssh://git@ssh.github.com:443/FFaassdfs/dsh-desktop-env.git`（22 端口不通，走 443）
- 官方同步：**每天 08:00（北京时间 = UTC 00:00，cron `0 0 * * *`）**自动跑（fork 的 `sync-upstream.yml`，事实源见 `project-facts-v1.0.md` F4；**`HANDOVER.md` §10.5 旧记「每小时」有误，已更正**）。✅ **2026-09-15 已恢复**：新 PAT 写入 `SYNC_TOKEN`，run #49 = `success`，fork `behind_by = 0`（历史故障 #47/#48 因旧 PAT 失效，见 §20.7 / §24.6）。巡检用 **`node .work\sync-status.mjs`**（走 REST API、**无需本地 fork 克隆**；异常时退出码 1）；旧的 `pwsh -File .work\sync-upstream.ps1` 需要先自行 clone fork
