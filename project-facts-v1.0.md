# project-facts — dsh-desktop 单一事实源索引

> **文档版本：v1.9**（2026-09-20 更新）
> 变更记录：
> - v1.9 — 新增 **F15：便携发行包**（`scripts/pack-release.ps1` + `.github/workflows/release-desktop.yml`；实测 zip 106.2 MB、含便携 Node 与离线 harness 树；壳的便携运行时解析见 `HANDOVER.md` §27）。
> - v1.8 — **版本锚点刷新（0.1.5-rc.1 → `0.1.5-rc.2`）**：F2（核心版本）、F10（跨机锁版 = `deploy.ps1` 默认值）；**部署入口统一**：F7/F14 补记「首装与更新共用 `scripts/deploy-shell.ps1`，**唯一启动入口 = 应用区 exe**」。
> - v1.7 — 新增 **F14：壳更新入口 = `update.ps1`**（一条命令：pull + 插件 + 构建 + 部署；回归验证脚本 `.work/verify-fresh-clone.ps1`）；F7 补记「壳源码在本仓库、fork 根级 `desktop/` 已废弃（§24）」。
> - v1.6 — **F5 转为健康**：`SYNC_TOKEN` 已换新并端到端验证（run #49 `success`，fork `behind_by = 0`）；新增巡检工具 `.work/sync-status.mjs`（`HANDOVER.md` §24.6）。
> - v1.5 — F5 补记：fork 已按 `HANDOVER.md` §24 降级为**纯官方镜像**（fork 独有根级 `desktop/` 已于 `41aaec8` 删除）；`SYNC_TOKEN` 仍待换新。
> - v1.4 — 新增 **F13：上游已有一方官方桌面端 `apps/desktop/`（Electron）**，及其「不提供 `webServer`」对我们 4 个插件的含义（`HANDOVER.md` §24.5）。
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
| F2 | **核心版本** | 实测 `dsh --version`（全局 npm `@deepseek-ai/dsh`） | **`0.1.5-rc.2`**（2026-09-20 实测；`dsh --version` = `npm dist-tags.latest`；`alpha` 通道当时为 `0.1.6-alpha.2`） | `AGENTS.md`、`HANDOVER.md`、`README.md`、`DEPLOY.md` |
| F3 | **服务探测语义** | 实测（`curl`） | 裸 URL `401` = **正常**（浏览器认证围栏，0.1.2-rc.1 起）；`000` = 未运行；`200` 只在带 token/cookie 时出现 | `AGENTS.md`、`HANDOVER.md` §10.7-18 |
| F4 | **官方同步频率 = 每天 08:00（北京时间）** | fork `FFaassdfs/deepseek-harness` 的 `.github/workflows/sync-upstream.yml` 里 `cron: '0 0 * * *'`（UTC 00:00） | `0 0 * * *`（实测 workflow 源码）。**勘误**：`HANDOVER.md` §10.5 旧记「每小时 `0 * * * *`」有误，已就地更正 | `AGENTS.md`「凭据与同步」、`HANDOVER.md` §10.5 |
| F5 | **官方同步状态 / fork 职责 / 巡检** | fork 的 Actions 运行记录 + fork 内容；巡检用 `.work/sync-status.mjs` | ✅ **正常运行**（2026-09-15 起）：新 PAT 已写入 `SYNC_TOKEN`，run #49 `workflow_dispatch` = `success`，fork `behind_by = 0`。fork 为**纯官方镜像**（根级 `desktop/` 已于 `41aaec8` 删除，与上游唯一差别只剩 `sync-upstream.yml`）。历史故障：run #47（09-14）/#48（09-15 02:23Z）因旧 PAT 失效而 `failure` | `HANDOVER.md` §20.7、§22、§24.6 |
| F6 | **源码区（唯一权威）** | 本仓库 | `D:\dsh\dsh-desktop-env` | 各处 |
| F7 | **应用区（exe）与启动路径** | 部署逻辑 = `scripts/deploy-shell.ps1`（被 `setup.ps1` / `update.ps1` 共用） | **唯一启动入口** `D:\dsh\app\current\dsh-desktop.exe`；`build\bin\dsh-desktop.exe` 只是中间产物。历史版本 `D:\dsh\app\versions\<日期>\` + `VERSION.txt`。⚠️ ①运行中的壳**持有该文件的锁** → 换 exe 必须先关壳（部署脚本会自动暂存 `.new.exe`；也可用 `.work\swap-desktop-exe.ps1`）②**启动入口必须指向应用区**：桌面快捷方式已于 2026-09-15 改指应用区；换壳后核对 `Get-Process dsh-desktop \| Select Id,Path`（§23.4） | `AGENTS.md`、`README.md`、`DEPLOY.md` §6、`HANDOVER.md` §20/§23/§25/§26 |
| F8 | **DSH_HOME / profile** | 环境变量 `DSH_HOME`（默认 `~/.dsh`） | `C:\Users\veken\.dsh`；profile = `profiles/web`；插件包 = `profiles/node_modules` | `HANDOVER.md` §2.1、§20.4 |
| F9 | **插件清单（4 个 + patch id）** | `scripts/setup-plugins.mjs` 的 `PLUGINS` 数组 | `plugin-explainer`、`plugin-project-explorer`、`plugin-model-capabilities`、`plugin-core-version` | `HANDOVER.md` §3/§11/§15/§21 |
| F10 | **跨机锁定的 dsh 版本** | `deploy.ps1` 的 `-HarnessVersion` 默认值（+ `DEPLOY.md`/`OPENCODE_PROMPT.md`/`README.md`/`setup.ps1` 注释引用） | **`0.1.5-rc.2`**（2026-09-20 起；历史值 `0.1.5-rc.1` → `0.1.0-rc.7` 均已过时） | `DEPLOY.md`、`OPENCODE_PROMPT.md`、`README.md` |
| F11 | **测试入口** | 仓库 `.work/`（套件 + `lib/react-source.mjs`） | 7 个套件：explainer 冒烟 + 开关路由、文件树 host/冒烟、core-version、model-capabilities host/冒烟 | `HANDOVER.md` §21 |
| F12 | **壳日志上限 / 自愈退避** | `app.go` 顶部常量（`maxDshLogBytes`、`maxDebugLogBytes`、`tailReadBytes`、`restartBackoffBase`、`restartBackoffMax`、`stableResetPeriod`、`maxRestarts`） | `dsh.log` 5 MiB、`debug.log` 1 MiB、报错只读尾部 64 KiB；退避 15s→45s→120s 封顶、连续 3 次、稳定 5 分钟重置 | `HANDOVER.md` §23 |
| F13 | **上游已有一方官方桌面端** | 上游仓库 `deepseek-ai/deepseek-harness` 的 `apps/desktop/`（+ `.agents/notes/implemented/architecture/2026-08-25-electron-desktop-packaging-and-updates.md`） | **Electron 壳、不开监听端口、独占 `$DSH_HOME/profiles/desktop`**、自带 Node/pnpm 与 dsh 依赖树、签名+自动更新（2026-09 起 implemented）。⚠️ **不提供 `webServer`** → 我们 4 个插件的 host 自定义路由在该 profile 下不可用，需换传输层（`HANDOVER.md` §24.5） | `AGENTS.md`「权威源码位置」、`HANDOVER.md` §24.5 |
| F14 | **壳更新入口（多机同步）** | `update.ps1`（+ `setup.ps1` 首次、`scripts/deploy-shell.ps1` 部署、`.work/verify-fresh-clone.ps1` 回归验证） | `git pull` + `pwsh -File update.ps1` = pull → 刷新 4 插件 → `wails build`（**壳源码在本仓库**，fork 根级 `desktop/` 已废弃）→ 部署到应用区（dated 归档 + `VERSION.txt`）。实测（2026-09-15）：新克隆 HEAD → 21 个必需文件齐全 → `npm install` 13s + `wails build` 22s → exe 11,333,632 字节 | `README.md`「更新到最新壳」、`DEPLOY.md` §8、`OPENCODE_PROMPT.md` 第 5 步、`HANDOVER.md` §25/§26 |
| F15 | **便携发行包（离线一键）** | `scripts/pack-release.ps1`（打包）+ `.github/workflows/release-desktop.yml`（打 `desktop-v*` tag 自动发 Release）+ `install-offline.ps1`（包内安装器） | 资产 `dsh-desktop-<shell>-dsh<dshver>-win-x64.zip` + `SHA256SUMS.txt`；含壳 exe + **便携 Node** + **离线 harness 树**（`runtime\node_modules\@deepseek-ai\dsh`）+ 4 插件。实测 **zip 106.2 MB**（原始 312.6 MB / 25,482 文件）。目标机零前置依赖；⚠️ 壳是**单实例**（`SingleInstanceLock`），不能与本机已装壳同时运行 | `README.md`「便携发行包」、`HANDOVER.md` §27 |

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
