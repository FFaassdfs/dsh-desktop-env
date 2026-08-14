# dsh-desktop

DeepSeek Harness 的桌面应用壳（Wails v2 + WebView2），把 dsh 的 Web UI 包装成原生桌面窗口，使用方式类似 opencode 桌面版。

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
main.go            # Wails 入口（单实例锁、窗口参数）
frontend/          # 启动画面页（Vite + 原生 JS）
```
