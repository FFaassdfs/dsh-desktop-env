# DeepSeek Harness 全局预设

> 位置：`$DSH_HOME/AGENTS.md`。所有通过 dsh 运行的项目都会自动加载本文件（用户全局指令）。项目目录内更具体的 `AGENTS.md`/`CLAUDE.md` 优先于本文件。
>
> ⚠️ **本文件是「全局预设」的权威副本**（本仓库 `global/AGENTS.md`）。部署机上的 `~/.dsh/AGENTS.md` 是安装副本：首次部署时由 `setup.ps1` 拷贝；更新全局预设 = 改本文件 + 在需要更新的机器上重装（删除 `~/.dsh/AGENTS.md` 后重跑 setup，或手动拷贝）。

## 基本规则

- **默认使用中文（简体）回复和交互**，除非用户明确要求其他语言。

## 协作约定

- **开工先读**：若项目里有 `HANDOVER.md` 或 `AGENTS.md`，先读它们，了解既有工作与约定，避免重复实现。
- **任务结束更新 HANDOVER**：若项目里存在 `HANDOVER.md`，每完成一项任务后更新它（记录做了什么、产出、坑），便于其他会话接力；没有 `HANDOVER.md` 的项目，至少把关键决策与坑留在项目内可查的地方。
- 遵循项目内已有的编号/命名约定（例如 dsh-desktop 的「路径 A/B/C…」）。

## 环境常见坑（本机通用；项目专属坑见该项目的 HANDOVER）

- **沙箱里 git/API 走 HTTPS 报 `SEC_E_NO_CREDENTIALS`**（schannel 凭据库被拒）→ 首选：`git config http.sslBackend openssl`（仓库级）后带 token URL 直接 push，**免提权**（2026-08-18 实测；新 clone 的仓库要重设该配置）；次选：`danger-full-access` 重试。
- **探测本地服务别用 `Get-NetTCPConnection`/`netstat`**（沙箱假阴性「无监听」）→ 用 `curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:3080/`（返回 200 即正常）。
- **不要提交凭据/API Key/.env 到任何 git 仓库**；文档（如 HANDOVER）里的明文凭据入库前先移到 gitignore 文件并改引用。
- **Go 1.21+ 的 telemetry 写 `%APPDATA%\go\telemetry`**：沙箱内 `go version`/`go build` 等报 Access denied → 命令前设 `$env:GOTELEMETRY="off"`（免提权规避）。
- **Go/Wails 项目**：改后端用 `wails build -s`（跳过前端，免 vite `spawn EPERM` 提权）；沙箱里把 `GOCACHE`/`GOTMPDIR` 重定向到工作区 `.cache/`。
- **PowerShell 数组 splatting 传的是位置参数**：`& script.ps1 @array` **不解析** `-Name value` 对（会把 `-Name` 当值传）→ 转交命名参数用**哈希表 splatting** `@{Name=$v}`。
- **git push 的进度/结果输出走 stderr**：pwsh `$ErrorActionPreference='Stop'` 会把它当 NativeCommandError 误报（exit 1 ≠ 失败）→ 以 `git status -sb`（无 ahead）或远端 HEAD 为准。
- **curl.exe 在 pwsh 传 JSON body**：`-d '{"..."}'` 可能报 `Problems parsing JSON`（400）→ 写临时文件 + `curl.exe --data-binary "@file"` 传参。
- **推送 `.github/workflows/*`**：内置 `GITHUB_TOKEN` 推不了 workflow 文件，需带 `workflow` scope 的 PAT（存 secret 使用）。
