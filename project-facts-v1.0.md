# project-facts — dsh-desktop 单一事实源索引

> **文档版本：v1.2**（2026-09-14 更新）
> 变更记录：
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
| F2 | **核心版本** | 实测 `dsh --version`（全局 npm `@deepseek-ai/dsh`） | **`0.1.5-rc.1`**（2026-09-14 实测；三处一致：`dsh --version` / `npm ls -g` / `GET /plugin-core-version/version`） | `AGENTS.md`、`HANDOVER.md`、`README.md`、`DEPLOY.md` |
| F3 | **服务探测语义** | 实测（`curl`） | 裸 URL `401` = **正常**（浏览器认证围栏，0.1.2-rc.1 起）；`000` = 未运行；`200` 只在带 token/cookie 时出现 | `AGENTS.md`、`HANDOVER.md` §10.7-18 |
| F4 | **官方同步频率 = 每天 08:00（北京时间）** | fork `FFaassdfs/deepseek-harness` 的 `.github/workflows/sync-upstream.yml` 里 `cron: '0 0 * * *'`（UTC 00:00） | `0 0 * * *`（实测 workflow 源码）。**勘误**：`HANDOVER.md` §10.5 旧记「每小时 `0 * * * *`」有误，已就地更正 | `AGENTS.md`「凭据与同步」、`HANDOVER.md` §10.5 |
| F5 | **官方同步当前状态** | fork 的 Actions 运行记录 | ⚠️ **失败中**：run 47（2026-09-14）`failure`，run 45/46（09-12/09-13）`success` → `SYNC_TOKEN` 随旧 PAT 失效（见 `HANDOVER.md` §20.7 / §22） | `HANDOVER.md` §20.7、§22 |
| F6 | **源码区（唯一权威）** | 本仓库 | `D:\dsh\dsh-desktop-env` | 各处 |
| F7 | **应用区（exe）** | 部署约定 | `D:\dsh\app\current\dsh-desktop.exe`；历史版本 `D:\dsh\app\versions\<日期>\` + `VERSION.txt`。⚠️ 运行中的壳**持有该文件的锁** → 换 exe 必须先关壳（用 `.work\swap-desktop-exe.ps1`，见 `HANDOVER.md` §23.3） | `AGENTS.md`、`HANDOVER.md` §20/§23 |
| F8 | **DSH_HOME / profile** | 环境变量 `DSH_HOME`（默认 `~/.dsh`） | `C:\Users\veken\.dsh`；profile = `profiles/web`；插件包 = `profiles/node_modules` | `HANDOVER.md` §2.1、§20.4 |
| F9 | **插件清单（4 个 + patch id）** | `scripts/setup-plugins.mjs` 的 `PLUGINS` 数组 | `plugin-explainer`、`plugin-project-explorer`、`plugin-model-capabilities`、`plugin-core-version` | `HANDOVER.md` §3/§11/§15/§21 |
| F10 | **跨机锁定的 dsh 版本** | `deploy.ps1` 的 `-HarnessVersion` 默认值（+ `DEPLOY.md`/`OPENCODE_PROMPT.md` 引用） | **`0.1.5-rc.1`**（原 `0.1.0-rc.7` 已过时） | `DEPLOY.md`、`OPENCODE_PROMPT.md` |
| F11 | **测试入口** | 仓库 `.work/`（套件 + `lib/react-source.mjs`） | 7 个套件：explainer 冒烟 + 开关路由、文件树 host/冒烟、core-version、model-capabilities host/冒烟 | `HANDOVER.md` §21 |
| F12 | **壳日志上限 / 自愈退避** | `app.go` 顶部常量（`maxDshLogBytes`、`maxDebugLogBytes`、`tailReadBytes`、`restartBackoffBase`、`restartBackoffMax`、`stableResetPeriod`、`maxRestarts`） | `dsh.log` 5 MiB、`debug.log` 1 MiB、报错只读尾部 64 KiB；退避 15s→45s→120s 封顶、连续 3 次、稳定 5 分钟重置 | `HANDOVER.md` §23 |

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
