# dsh-desktop 项目默认预设

> 本文件每个会话开工时自动加载。详细交接细节见同目录 `HANDOVER.md`。默认中文回复。
>
> **当前状态（2026-09-20）**：源码区 = `D:\dsh\dsh-desktop-env`（本仓库，唯一权威工作区）；应用区 = `D:\dsh\app\current`（**唯一启动入口**，首装/更新同一落点）；壳 = **launcher @ 43080**（已运行 P0-3 加固版：退避 + 日志轮转，见 §23）；核心 = **`@deepseek-ai/dsh 0.1.5-rc.2`**（全局 npm；`npm latest` 同版本。旧记的 `0.1.2-rc.1`/`0.1.5-rc.1` 均为过时快照，见 `HANDOVER.md` §21）；旧工作区 `D:\opencode\001\dsh-desktop` **已冻结**；5 个插件均已纳入 `scripts/setup-plugins.mjs`，host 与 client 半区均已验证可见（§21.3）。**P0 全部关闭**（§24：fork 降级为纯镜像 + `SYNC_TOKEN` 已换新验证）；**多机更新链已修好**（§25/§26：`update.ps1` 一条命令 + 首装/更新统一落点）。

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

## 权威源码位置（别改错）

> ⚠️ **2026-09-14 迁移后更新**：壳源码权威位置已变更，旧记录（`.work\deepseek-harness\desktop\`）**作废**。

- **桌面壳源码（唯一权威）**：**本仓库根目录**——`app.go`、`main.go`、`dsh_windows.go`、`dsh_other.go`、`windowstate.go`、`frontend/`（launcher：状态面板 + node 直启 + token 交系统浏览器）
  - 当前形态：**启动器（端口 43080）**，真正的 dsh 界面由**系统浏览器**打开（见 `HANDOVER.md` §14）
- **应用产物（与源码分离）**：`D:\dsh\app\current\dsh-desktop.exe`（历史版本在 `D:\dsh\app\versions\<日期>\`）
  - 改壳后：`wails build` → 用 **`pwsh -File scripts\deploy-shell.ps1 -BuiltExe build\bin\dsh-desktop.exe`** 部署到应用区（首装/更新共用这段逻辑；exe 被运行中的壳锁住时自动暂存 `.new.exe`）
  - 🟢 **一条命令搞定（含 pull/插件/构建/部署）**：`pwsh -File update.ps1`（开关 `-SkipFrontend` 只编 Go、`-CheckOnly` 干跑、`-AppDir` 改应用区）；首次部署用 `setup.ps1`。**壳源码就在本仓库**，fork 根级 `desktop/` 已废弃（见 `HANDOVER.md` §24/§25）
  - 回归验证「新克隆能否构建」：`pwsh -File .work\verify-fresh-clone.ps1`
  - 📦 **便携发行包（离线一键，目标机零前置依赖）**：`pwsh -File scripts\pack-release.ps1` 打出 `dsh-desktop-<shell>-dsh<ver>-win-x64.zip`（含便携 Node + 离线 harness 树 + 4 插件 + `install-offline.ps1`）；打 tag `desktop-v*` 由 `.github/workflows/release-desktop.yml` 自动发 Release（见 `HANDOVER.md` §27）。壳已支持便携运行时（`$DSH_DESKTOP_RUNTIME` → `<exeDir>\runtime` → `<exeDir>`），便携模式下**跳过 npm 自更新**
- **旧工作区 `D:\opencode\001\dsh-desktop` 已冻结**（见其 `FROZEN.md`）：**不要再写入/提交**
- **fork 本地克隆不在本工作区**：`.work\deepseek-harness` 未迁移；fork 仅作官方镜像用，历史补丁存 `.work\migration-2026-09-14\`
- **官方 harness 源码**（`packages/`、`apps/`、`vendor/` 等，若日后自行 clone）：**只读，不要改**——会被官方同步覆盖
- 🔴 **别混淆两个「desktop」**：上游仓库有自己的 **一方官方桌面端 `apps/desktop/`**（Electron 壳，已 implemented，独占 `$DSH_HOME/profiles/desktop`，**不提供 `webServer`**）；我们自己的 Wails 壳是**另一个**东西（本仓库根目录，launcher @ 43080 + `profiles/web`）。fork 里被删掉的是**根级** `desktop/`（我们的旧副本），与上游 `apps/desktop/` 无关。详见 `HANDOVER.md` §24.5 / `project-facts-v1.0.md` F13

## 高频坑（详情见 HANDOVER.md §10.7，共 18 条）

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
