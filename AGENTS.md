# dsh-desktop 项目默认预设

> 本文件每个会话开工时自动加载。详细交接细节见同目录 `HANDOVER.md`。默认中文回复。

## 开工必做

1. 先读 `HANDOVER.md`，了解既有开发线（互不冲突）：
   - 路径A（§3–§9）：官方 Web GUI「插件说明」插件
   - 路径B（§10）：桌面壳功能 + 代码迁入 fork + 官方自动同步
   - 路径C（§11）：项目文件树侧栏插件
2. 新任务按「路径 D、E…」递增，在 HANDOVER.md 末尾新增小节，并在任务结束更新其「最后更新」。
3. 动手前确认要做的没被 A/B/C 做过，避免重复实现。

## 权威源码位置（别改错）

- **桌面壳源码**：`.work\deepseek-harness\desktop\`（改桌面壳只改这里；本目录根下的 `app.go`/`main.go` 等是 08/14 旧副本，已废弃）
- **官方 harness 源码**（`packages/`、`apps/`、`vendor/` 等）：**只读，不要改**——会被官方同步覆盖，改了也白做
- fork 本地克隆：`.work\deepseek-harness\`（git 仓库，`origin`=你的 fork，`upstream`=官方）

## 高频坑（详情见 HANDOVER.md §10.7，共 18 条）

- 沙箱里 git/API 走 HTTPS 报 `SEC_E_NO_CREDENTIALS`（schannel 凭据库被拒）→ 用 `danger-full-access` 重试
- 探测本地服务**别用** `Get-NetTCPConnection`/`netstat`（沙箱假阴性，会误判「无监听」）→ 用 `curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:43080/`（返回 200 即正常）
- 改 Go 后端后 `wails build -s`（跳过前端 vite，免 EPERM 提权）；产物要**拷贝到启动路径** `build\bin\dsh-desktop.exe`（构建 exit 0 ≠ 已生效）
- 推送 `.github/workflows/*` 文件：`GITHUB_TOKEN` 推不了 → 用带 `workflow` scope 的 PAT（已存为 secret `SYNC_TOKEN`）
- 沙箱里 Go 构建：把 `GOCACHE`/`GOTMPDIR` 重定向到 `.cache/`，否则写 `%APPDATA%\go-build` 被拒

## 凭据与同步

- GitHub PAT、同步机制、构建命令：见 `HANDOVER.md` §10.3 / §10.5 / §10.6
- PAT 明文在 HANDOVER.md 里，**不要提交到任何 git 仓库**
- 官方同步：GitHub Action 每小时自动跑（`.github/workflows/sync-upstream.yml`）；手动检查用 `pwsh -File .work\sync-upstream.ps1`
