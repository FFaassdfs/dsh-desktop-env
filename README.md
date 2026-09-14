# dsh-desktop

DeepSeek Harness 的桌面**启动器 + 版本自更新器 + 状态面板**（Wails v2 + WebView2）。它不再内嵌 dsh 界面，而是：拉起/复用 `dsh web`，把带鉴权 token 的 URL 交给**系统浏览器**打开，壳窗口只显示状态与操作按钮。

> 为什么不再内嵌界面：dsh 0.1.2-rc.1 起引入浏览器会话认证（browser-trust fence），Wails 内嵌 WebView 在「303 重定向 + 种 cookie」流程上不可靠；而系统浏览器（同引擎 Edge/WebView2）能正常完成认证。详见 `HANDOVER.md` §14。

> 端口 / 核心版本 / 官方同步频率等**被多处引用的数值以 [`project-facts-v1.0.md`](project-facts-v1.0.md) 为准**（本文件中的数值均为快照）。

## 部署到新机器（家里电脑）

本仓库同时是**环境同步仓库**：含 **4 个自定义插件**、一键部署脚本与文档。在新机器复刻本机环境：

- **用 opencode**：把 [`OPENCODE_PROMPT.md`](OPENCODE_PROMPT.md) 里的「部署指令」整段发给它即可（自包含：自动 clone、读 [`DEPLOY.md`](DEPLOY.md)、逐条执行并验收）
- **手动**：按 [`DEPLOY.md`](DEPLOY.md) 逐条执行，核心一条：

```powershell
git clone https://github.com/FFaassdfs/dsh-desktop-env.git D:\dsh\dsh-desktop-env
cd D:\dsh\dsh-desktop-env
pwsh -File deploy.ps1 -HarnessVersion 0.1.5-rc.1   # 无 pwsh 用 powershell -File
```

## 原理（当前行为）

- 启动后显示**小状态面板**（固定 440×400，不可最大化）
- 检测 `127.0.0.1:43080` 是否已有 dsh server：
  - **没有** → 后台拉起 `dsh web --no-open --port 43080`（日志写 `%APPDATA%\dsh-desktop\dsh.log`），捕获它打印的带 token 的 URL
  - **已有** → 直接复用
- 就绪后：面板显示状态与 URL，并**自动用系统浏览器打开**带 token 的 URL；退出时杀掉自己拉起的 dsh 进程树
- **版本自更新**：启动即检查 + 每 24h，发现新版自动 `npm i -g`，提示「重启服务」生效
- **崩溃自愈**：持有的 dsh web 意外退出会自动重启（最多连续 3 次）
- 30 秒未就绪且进程已退出 → 面板显示真实错误（`dsh.log` 尾部）

## 依赖

- **运行**：Windows 10+（自带 WebView2 Runtime）、已全局安装 `@deepseek-ai/dsh` + Node.js
- **构建**：Go 1.26+、Wails CLI v2、Node.js + npm

```powershell
npm i -g @deepseek-ai/dsh
```

## 构建

```powershell
# 首次 / 前端或绑定有改动（会重新生成 wailsjs 绑定 + vite 构建 + 编译）
cd D:\dsh\dsh-desktop-env\frontend
npm install
cd ..
wails build            # 产物: build\bin\dsh-desktop.exe（改完壳记得拷到应用区 D:\dsh\app\current\）

# 仅改 Go 代码时（跳过前端，更快）
wails build -s
```

## 结构

```
app.go             # 启动编排 + 状态面板事件 + 版本自更新 + 健康监测
dsh_windows.go     # Windows 平台 node 直启 dsh web（解析 dsh.cmd shim 取 bin.js）+ npm 更新
dsh_other.go       # 其他平台 spawn dsh web + npm 更新
windowstate.go     # 窗口状态（当前固定尺寸，已不再还原）
main.go            # Wails 入口（单实例锁、固定窗口 440×400 DisableResize）
frontend/          # 状态面板页（Vite + 原生 JS）
```

## 关键注意点（跨机应用必读）

1. **端口固定 43080，不是 3080**：避开 Windows 动态端口范围（本机 1024~15000）以及 Hyper-V/WSL/winnat 动态保留的排除段（否则 dsh web 绑端口报 `EACCES`、`netstat` 查不到占用者）。**权威源 = `app.go` 的 `dshPort` 常量**（两处 `--port` 传参自动引用），见 `project-facts-v1.0.md` F1。
2. **`dsh web` 必须 node 直启，不能走 `cmd /C` + `CREATE_NO_WINDOW`**：后者会破坏 node 孙进程的 stdout 继承，导致读不到带 token 的 URL（也导致 `dsh.log` 一直是 0 字节）。当前实现是解析 npm 的 `dsh.cmd` shim 拿到 `bin.js` 后直接 `node <bin.js> web ...`。
3. **浏览器认证**：`dsh web` 打印/打开的 URL 带 `?token=...`，裸 URL 返回 401。壳把这条 URL 交给系统浏览器即可正常显示。
4. **改前端/绑定后必须用完整 `wails build`**（不是 `-s`），否则 wailsjs 绑定不重新生成、前端不重新打包。

详见 [`HANDOVER.md`](HANDOVER.md) §14「壳重定位与跨机应用说明」。

> 文档版本：v1.1（2026-09-14 更新）— 修正 dsh 版本号/端口所述、插件数（2→4）、`HANDOVER.md` §12→§14 引用、clone 与构建路径；新增指向 `project-facts-v1.0.md`。
