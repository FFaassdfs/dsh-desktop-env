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
pwsh -File deploy.ps1 -HarnessVersion 0.1.5-rc.2   # 无 pwsh 用 powershell -File
```

> 首次安装与后续更新都部署到**同一个启动入口**：`D:\dsh\app\current\dsh-desktop.exe`（`-AppDir` 可改）。

## 便携发行包（离线一键，目标机零前置依赖）

不想装 Go/Wails/Node、也不想联网装 harness 时，用**便携发行包**：解压即用。

- **产物**：`dsh-desktop-<壳commit>-dsh<harness版本>-win-x64.zip`（实测 **106 MB**）+ `SHA256SUMS.txt`
  - 内含：壳 `dsh-desktop.exe`、**便携 Node**（`runtime\node.exe`）、**离线 harness 树**（`runtime\node_modules\@deepseek-ai\dsh`，含全部依赖）、4 个插件、`install-offline.ps1`
- **目标机用法（没有"安装"步骤，解压即用）**：
  ```
  1) 把 zip 解压到任意目录（例如 D:\dsh-desktop-portable）
  2) 双击 dsh-desktop.exe          ← 就这样，壳自己认同目录的 runtime\
  3) （可选）想让 4 个插件也进 DSH_HOME：双击 install-offline.cmd
  ```
  - `install-offline.cmd` 是 `install-offline.ps1` 的**双击包装**（自动 `-ExecutionPolicy Bypass`，避免"双击 .ps1 不执行/被执行策略拦住"）。想自定义就命令行跑：
    ```powershell
    powershell -ExecutionPolicy Bypass -File install-offline.ps1 -DSHome D:\dsh-home
    ```
  - 运行前提只有 **WebView2 Runtime**（Win10/11 一般自带）
- **注意**：壳是**单实例**——本机已装着旧壳时必须先退出它；未签名，首启可能有 SmartScreen 提示；API key/`.env` 各机自配。
- **自己打包**：`pwsh -File scripts\pack-release.ps1`（`-NoNode` 可打不含 Node 的小包；`-KeepStaging` 保留中间目录）
- **自动发版**：往仓库打 tag `desktop-v0.1.0` → `.github/workflows/release-desktop.yml` 在 windows runner 上构建并挂到 GitHub Release（用内置 `GITHUB_TOKEN`，不需要 PAT）；也可在 Actions 页手动 `workflow_dispatch`。

## 原理（当前行为）

- 启动后显示**小状态面板**（固定 440×400，不可最大化）
- 检测 `127.0.0.1:43080` 是否已有 dsh server：
  - **没有** → 后台拉起 `dsh web --no-open --port 43080`（日志写 `%APPDATA%\dsh-desktop\dsh.log`），捕获它打印的带 token 的 URL
  - **已有** → 直接复用
- 就绪后：面板显示状态与 URL，并**自动用系统浏览器打开**带 token 的 URL；退出时杀掉自己拉起的 dsh 进程树
- **版本自更新**：启动即检查 + 每 24h，发现新版自动 `npm i -g`，提示「重启服务」生效
- **崩溃自愈**：持有的 dsh web 意外退出会自动重启 —— 指数退避 **15s → 45s → 120s 封顶**，连续 3 次仍失败就停手并提示；**稳定运行 5 分钟**后重置重启预算
- **日志可控**：`dsh.log` 5 MiB / `debug.log` 1 MiB 超限自动轮转；报错只读文件尾（不再整文件读入）
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
wails build            # 中间产物: build\bin\dsh-desktop.exe
pwsh -File scripts\deploy-shell.ps1 -BuiltExe build\bin\dsh-desktop.exe   # 部署到应用区（启动用这份）
# 或者一步到位：pwsh -File update.ps1 -SkipPull -SkipPlugins -SkipFrontend

# 仅改 Go 代码时（跳过前端，更快）
wails build -s
```

## 更新到最新壳（其他电脑 / 日常）

**壳源码就在本仓库**（`app.go`、`frontend/`、`build/`），所以其他电脑拉一下仓库、跑一条命令即可拿到最新壳：

```powershell
cd D:\dsh\dsh-desktop-env
git pull
pwsh -File update.ps1          # pull + 刷新插件 + wails build + 部署到应用区（D:\dsh\app\current）
```

`update.ps1` 会：① `git pull --ff-only` 并列出新提交 ② 重装 4 个自定义插件 ③ `wails build` ④ 把 exe 部署到应用区（附历史归档 + `VERSION.txt`）。常用开关：

```powershell
pwsh -File update.ps1 -SkipPull          # 用手头这份源码构建
pwsh -File update.ps1 -SkipFrontend      # 只改了 Go：wails build -s（更快）
pwsh -File update.ps1 -SkipPlugins       # 不动 $DSH_HOME
pwsh -File update.ps1 -NoDeploy          # 只构建，不碰应用区
pwsh -File update.ps1 -CheckOnly         # 干跑，什么都不写
```

- **换壳后必须重启壳**才生效（运行中的壳 owns GUI 会话的 dsh web，重启会中断该会话）。
- 应用区 exe 被运行中的壳锁住时，脚本会自动暂存为 `dsh-desktop.new.exe` 并提示换法（或改用 `.work\swap-desktop-exe.ps1`）。
- 验证"新克隆能否构建"：`pwsh -File .work\verify-fresh-clone.ps1`（克隆 HEAD 到临时目录并跑完整构建）。

> ⚠️ 旧流程（clone `FFaassdfs/deepseek-harness` fork 再构建其 `desktop/`）**已废弃**：该目录已于 2026-09-15 从 fork 删除（见 `HANDOVER.md` §24）。

## 结构

```
app.go             # 启动编排 + 状态面板事件 + 版本自更新 + 健康监测
dsh_windows.go     # Windows 平台 node 直启 dsh web（解析 dsh.cmd shim 取 bin.js）+ npm 更新
dsh_other.go       # 其他平台 spawn dsh web + npm 更新
windowstate.go     # 窗口状态（当前固定尺寸，已不再还原）
logutil.go         # 日志上限轮转 + 只读尾部（详见 HANDOVER §23）
main.go            # Wails 入口（单实例锁、固定窗口 440×400 DisableResize）
frontend/          # 状态面板页（Vite + 原生 JS）
update.ps1         # 一键更新（pull + 插件 + 构建 + 部署）
setup.ps1          # 首次复刻环境（依赖检查 + dsh + 插件 + 全局预设 + 构建）
```

## 关键注意点（跨机应用必读）

1. **端口固定 43080，不是 3080**：避开 Windows 动态端口范围（本机 1024~15000）以及 Hyper-V/WSL/winnat 动态保留的排除段（否则 dsh web 绑端口报 `EACCES`、`netstat` 查不到占用者）。**权威源 = `app.go` 的 `dshPort` 常量**（两处 `--port` 传参自动引用），见 `project-facts-v1.0.md` F1。
2. **`dsh web` 必须 node 直启，不能走 `cmd /C` + `CREATE_NO_WINDOW`**：后者会破坏 node 孙进程的 stdout 继承，导致读不到带 token 的 URL（也导致 `dsh.log` 一直是 0 字节）。当前实现是解析 npm 的 `dsh.cmd` shim 拿到 `bin.js` 后直接 `node <bin.js> web ...`。
3. **浏览器认证**：`dsh web` 打印/打开的 URL 带 `?token=...`，裸 URL 返回 401。壳把这条 URL 交给系统浏览器即可正常显示。
4. **改前端/绑定后必须用完整 `wails build`**（不是 `-s`），否则 wailsjs 绑定不重新生成、前端不重新打包。

详见 [`HANDOVER.md`](HANDOVER.md) §14「壳重定位与跨机应用说明」。

> 文档版本：v1.2（2026-09-15 更新）— 新增「更新到最新壳」一节（`update.ps1` 一条命令）；结构清单补 `logutil.go`/`update.ps1`/`setup.ps1`；说明壳源码在本仓库、fork `desktop/` 已废弃。
> v1.1（2026-09-14）— 修正 dsh 版本号/端口所述、插件数（2→4）、`HANDOVER.md` §12→§14 引用、clone 与构建路径；新增指向 `project-facts-v1.0.md`。
