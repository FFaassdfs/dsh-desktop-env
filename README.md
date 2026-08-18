# dsh-desktop

DeepSeek Harness 的桌面应用壳（Wails v2 + WebView2），把 dsh 的 Web UI 包装成原生桌面窗口，使用方式类似 opencode 桌面版。

## 部署到新机器（家里电脑）

本仓库同时是**环境同步仓库**：含两个自定义插件、一键部署脚本与文档。在新机器（如家里电脑）复刻本机环境（dsh 锁版本 + 插件 + 可选桌面壳）：

- **用 opencode**：把 [`OPENCODE_PROMPT.md`](OPENCODE_PROMPT.md) 里的「部署指令」整段发给它即可（自包含：自动 clone、读 [`DEPLOY.md`](DEPLOY.md)、逐条执行并验收）
- **手动**：按 [`DEPLOY.md`](DEPLOY.md) 逐条执行，核心就一条：

```powershell
git clone https://github.com/FFaassdfs/dsh-desktop-env.git D:\dsh-desktop
cd D:\dsh-desktop
pwsh -File deploy.ps1 -HarnessVersion 0.1.0-rc.7   # 无 pwsh 用 powershell -File
```

> 桌面壳权威源码在 fork `FFaassdfs/deepseek-harness` 的 `desktop/`（本目录根下的 `app.go` 等为过时副本）。

## 原理

- 启动时显示内嵌启动画面（loading spinner）
- 检测 `127.0.0.1:3080` 是否已有 dsh server：
  - **没有** → 自动后台拉起 `dsh web`（日志写入 `%APPDATA%\dsh-desktop\dsh.log`），轮询 HTTP 200 就绪后窗口跳转到 `http://127.0.0.1:3080`；**应用退出时杀掉自己拉起的 dsh 进程树**
  - **已有** → 直接复用，退出时不动它
- 30 秒未就绪 → 启动画面显示错误提示

## 依赖

- **运行**：Windows 10+（自带 WebView2 Runtime）、已全局安装 `@deepseek-ai/dsh` + Node.js
- **构建**：Go 1.26+、Wails CLI v2

```powershell
npm i -g @deepseek-ai/dsh
```

## 构建

```powershell
wails build          # 产物: build\bin\dsh-desktop.exe
```

## 开发

```powershell
wails dev            # 热重载开发模式
```

## 结构

```
app.go             # 启动编排：端口检测 / 拉起 dsh / 等待就绪 / 窗口跳转 / 退出清理
dsh_windows.go     # Windows 平台 spawn dsh（隐藏窗口 + 日志重定向）
dsh_other.go       # 其他平台 spawn dsh
windowstate.go     # 窗口状态持久化（记住大小/位置/最大化，重启还原）
main.go            # Wails 入口（单实例锁、窗口参数）
frontend/          # 启动画面页（Vite + 原生 JS）
```

窗口大小/位置/最大化状态保存在 `%APPDATA%\dsh-desktop\window.json`，关闭前写入（`OnBeforeClose`）、启动时还原（`OnStartup`）。

## 已知问题

- **exe 的「文件属性 → 详细信息」版本字段显示为空**：这是 wails v2.14.0 所用 `tc-hib/winres v0.3.1` 的上游 bug —— 它把版本资源的 StringTable 键名写成小写（`040904b0`），而 Windows 期望大写（`040904B0`），导致 `FileVersionInfo` 读不到字符串。字符串实际已嵌入 exe，二进制文件版本 `0.1.0.0` 也正常，属纯外观问题、不影响运行，等 wails 升级 winres 后自动修复。
