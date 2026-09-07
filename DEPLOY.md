# DEPLOY.md — 用 opencode 在家部署 dsh-desktop 环境

> 目标机器：家里的 Windows 电脑。执行者：opencode（或人工逐条执行）。
> 完成后得到与本开发机一致的：dsh harness（锁版本）+ 两个自定义插件 +（可选）dsh-desktop 桌面壳。
> 所有命令在 PowerShell 中执行（pwsh 7 或 Windows PowerShell 5.1 均可）。

## 0. 开场（执行者必读）

本文件是**分步执行清单**：每一步先执行、再验证（每步有「验证」行），通过后才进下一步。
失败先看「§7 故障排查」；装依赖的命令在 §3。全程**不需要管理员权限**（winget 用户级安装）。

## 1. 获取代码

```powershell
git clone https://github.com/FFaassdfs/dsh-desktop-env.git D:\dsh-desktop
cd D:\dsh-desktop
```

**验证**：`Test-Path D:\dsh-desktop\setup.ps1` 返回 `True`。

## 2. 检查工具链（缺失才装，见 §3）

| 工具 | 检查命令 | 需要条件 |
|---|---|---|
| Git | `git --version` | 总是 |
| Node.js 22.19+ / 24.x | `node --version` | 总是 |
| PowerShell（任意） | `$PSVersionTable.PSVersion` | 总是 |
| Go 1.26+ | `go version` | 仅要桌面壳时 |
| Wails CLI | `wails version` | 仅要桌面壳时 |
| WebView2 Runtime | Windows 10/11 自带 | 仅桌面壳运行时 |

> 也可以直接跑 `pwsh -File deploy.ps1 -CheckOnly`，它会自动列出缺什么。

## 3. 安装缺失工具（按需执行）

```powershell
# 3.1 Git
winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements

# 3.2 Node.js（LTS）
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements

# 3.3 Go（仅要桌面壳）
winget install --id GoLang.Go -e --accept-source-agreements --accept-package-agreements

# 3.4 PowerShell 7（可选，推荐；不装就用系统自带的 powershell.exe，脚本兼容 5.1）
winget install --id Microsoft.PowerShell -e --accept-source-agreements --accept-package-agreements

# 3.5 Wails CLI（装完 Go 后，仅要桌面壳）
go install github.com/wailsapp/wails/v2/cmd/wails@latest
# 注意：wails.exe 装到 %USERPROFILE%\go\bin，若 `wails version` 找不到：
$env:Path += ";$env:USERPROFILE\go\bin"   # 当前会话；长期加用户 PATH
```

装完**重开终端**（或执行 `refreshenv`）再继续。

**验证**：`node --version`、`git --version` 均输出版本号；要桌面壳则 `go version`、`wails version` 也正常。

## 4. 一键部署

```powershell
cd D:\dsh-desktop
# 推荐（PowerShell 7）：
pwsh -File deploy.ps1 -HarnessVersion 0.1.0-rc.7
# 或系统自带（Windows PowerShell 5.1）：
powershell -File deploy.ps1 -HarnessVersion 0.1.0-rc.7
```

- 不需要桌面壳：加 `-SkipDesktopBuild`
- 只想看会做什么（不动系统）：加 `-CheckOnly`
- `deploy.ps1` 会再次自检依赖，缺失时打印安装命令并以非零码退出（回 §3）
- 部署还会顺带安装**全局预设** `~/.dsh/AGENTS.md`（harness 全局指令，含通用避坑经验；**首次部署时安装，已有则保留不动**——要刷新先删掉该文件再重跑）

**验证**：输出末尾出现 `done`；再跑 `node scripts/setup-plugins.mjs --check-only`，末尾输出
`CHECK ONLY — nothing written. Looks good.`

## 5. 配置 API key（各机独立，不同步）

二选一：

- **方式A**：`dsh web` 启动后浏览器打开 `http://127.0.0.1:43080` → 设置 → 凭据，填入 API key
- **方式B**：在 harness 工作目录放 `.env`，内容 `DEEPSEEK_API_KEY=sk-...`

## 6. 启动并验收

```powershell
# 桌面壳方式
D:\dsh-desktop\build\bin\dsh-desktop.exe
# 或纯 Web 方式
dsh web
```

**验收清单**：
- [ ] 浏览器能打开 Web UI（127.0.0.1:43080）
- [ ] 「设置 → 插件」里出现第三个 tab「插件说明」（能看每个插件的中文解释 + 开关）
- [ ] 页面最右侧出现「📁 项目文件」细条（点击展开文件树，可拖文件到对话框）
- [ ] `dsh --version` 与部署时指定的版本一致

## 7. 故障排查

| 现象 | 处理 |
|---|---|
| `winget` 不是内部或外部命令 | 系统缺少 App Installer：改用官网安装包（nodejs.org / git-scm.com / go.dev/dl） |
| `pwsh` 不是内部或外部命令 | 系统没装 PowerShell 7：用 `powershell -File deploy.ps1 ...`（脚本兼容 5.1），或按 §3.4 装 pwsh |
| `npm` 装 dsh 超时/失败 | 重试；或 `npm config set registry https://registry.npmmirror.com` 后重试（国内网络） |
| `wails version` 找不到 | wails.exe 在 `%USERPROFILE%\go\bin`：`$env:Path += ";$env:USERPROFILE\go\bin"` 或加用户 PATH |
| `setup.ps1` 报 Node 版本过低 | 装 Node 24 LTS，重开终端再跑 |
| 43080 端口被占用 | 可能已有 dsh 实例在跑，直接访问即可；要干净的实例先 `taskkill /F /T /PID <pid>` |
| 「插件说明」tab 没出现 | dsh 必须**完全退出再重开**（关窗口 + 确认 43080 无进程），浏览器 Ctrl+F5 强刷 |
| 「项目文件」面板没出现 | 同上，完全重启；或刷新浏览器页面一次（该插件 host 半区热加载、client 需刷新） |
| 桌面壳构建失败（vite 子进程报错等） | 先用 `-SkipDesktopBuild` 部署插件；桌面壳稍后单独 `wails build` |
| `deploy.ps1` 报缺依赖但已装 | 重开终端让 PATH 生效；确认装的是 64 位版本 |

## 8. 日常同步（以后每次）

本机（开发机）推送更新后，家里：

```powershell
cd D:\dsh-desktop
git pull
pwsh -File deploy.ps1 -HarnessVersion 0.1.0-rc.7   # 或 powershell -File deploy.ps1 ...
```

> 版本号两台机器保持一致（当前锁定 `0.1.0-rc.7`；升级时两台的 `-HarnessVersion` 一起改）。
