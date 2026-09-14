# dsh-desktop 项目默认预设

> 本文件每个会话开工时自动加载。详细交接细节见同目录 `HANDOVER.md`。默认中文回复。
>
> **当前状态（2026-09-14）**：源码区 = `D:\dsh\dsh-desktop-env`（本仓库，唯一权威工作区）；应用区 = `D:\dsh\app\current`（exe，与源码分离）；壳 = **launcher @ 43080**；核心 = `@deepseek-ai/dsh 0.1.2-rc.1`（全局 npm）；旧工作区 `D:\opencode\001\dsh-desktop` **已冻结**；进行中：路径E「模型能力」插件（WIP，自另一会话迁移，未验证）。

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
  - 改壳后：`wails build` → 把 `build\bin\dsh-desktop.exe` 拷到 `D:\dsh\app\current\`
- **旧工作区 `D:\opencode\001\dsh-desktop` 已冻结**（见其 `FROZEN.md`）：**不要再写入/提交**
- **fork 本地克隆不在本工作区**：`.work\deepseek-harness` 未迁移；fork 仅作官方镜像用，历史补丁存 `.work\migration-2026-09-14\`
- **官方 harness 源码**（`packages/`、`apps/`、`vendor/` 等，若日后自行 clone）：**只读，不要改**——会被官方同步覆盖

## 高频坑（详情见 HANDOVER.md §10.7，共 18 条）

- 沙箱里 git/API 走 HTTPS 报 `SEC_E_NO_CREDENTIALS`（schannel 凭据库被拒）→ 用 `danger-full-access` 重试
- 探测本地服务**别用** `Get-NetTCPConnection`/`netstat`（沙箱假阴性，会误判「无监听」）→ 用 `curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:43080/`（返回 200 即正常）
- 改 Go 后端后 `wails build -s`（跳过前端 vite，免 EPERM 提权）；产物要**拷贝到启动路径** `build\bin\dsh-desktop.exe`（构建 exit 0 ≠ 已生效）
- 推送 `.github/workflows/*` 文件：`GITHUB_TOKEN` 推不了 → 用带 `workflow` scope 的 PAT（已存为 secret `SYNC_TOKEN`）
- 沙箱里 Go 构建：把 `GOCACHE`/`GOTMPDIR` 重定向到 `.cache/`，否则写 `%APPDATA%\go-build` 被拒

## 凭据与同步

- GitHub PAT、同步机制、构建命令：见 `HANDOVER.md` §10.3 / §10.5 / §10.6
- PAT 明文在 HANDOVER.md 里，**不要提交到任何 git 仓库**
- 官方同步：**每天 08:00（北京时间 = UTC 00:00，cron `0 0 * * *`）**自动跑（fork 的 `sync-upstream.yml`，见 `HANDOVER.md` §10.5）；手动检查用 `pwsh -File .work\sync-upstream.ps1`（需先自行 clone fork）
