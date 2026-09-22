# dsh-desktop

DeepSeek Harness 的桌面**启动器 + 版本自更新器 + 状态面板**（Wails v2 + WebView2）。它不再内嵌 dsh 界面，而是：拉起/复用 `dsh web`，把带鉴权 token 的 URL 交给**系统浏览器**打开，壳窗口只显示状态与操作按钮。

> 为什么不再内嵌界面：dsh 0.1.2-rc.1 起引入浏览器会话认证（browser-trust fence），Wails 内嵌 WebView 在「303 重定向 + 种 cookie」流程上不可靠；而系统浏览器（同引擎 Edge/WebView2）能正常完成认证。详见 `HANDOVER.md` §14。

> 端口 / 核心版本 / 官方同步频率等**被多处引用的数值以 [`project-facts-v1.0.md`](project-facts-v1.0.md) 为准**（本文件中的数值均为快照）。

## 部署到新机器（家里电脑）

本仓库同时是**环境同步仓库**：含 **5 个自定义插件**、一键部署脚本与文档。在新机器复刻本机环境：

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

- **产物**：`dsh-desktop-<壳commit>-dsh<harness版本>-win-x64.zip`（实测 **109 MB**）+ `SHA256SUMS.txt`
  - 内含：壳 `dsh-desktop.exe`、**`runtime.zip`（单文件运行时：便携 Node + npm + 离线 harness，首次启动自动解压 ~40 秒，仅一次）**、5 个插件、`install-offline.cmd/.ps1`
  - **为什么运行时是单个 zip**：解压开是 **2.7 万个碎文件**（89% 小于 8 KB），Windows 上拷贝它们要按文件数交税（实测：单线程 88.8s vs `robocopy /MT:16` 15.9s）；打包成单文件后，**下载/拷贝只需搬 1 个文件**（整个包 35 个文件）
- **拷贝/分发的正确姿势**：① **搬 zip，别搬解压后的目录**；② 若必须拷目录，用 `robocopy <源> <目标> /E /MT:16 /NFL /NDL /NJH /NJS /NP`；③ 解压用 `tar -xf 包.zip -C 目标` 或 7-Zip，**别用资源管理器的"全部解压缩"**（最慢）
- **目标机用法（没有"安装"步骤，解压即用）**：
  ```
  1) 把 zip 解压到任意目录（例如 D:\dsh-desktop-portable）
  2) 双击 dsh-desktop.exe   ← 首次启动会先解压内置运行时（~40 秒，状态面板显示进度），之后就快了
  3) （可选）想让 5 个插件也进 DSH_HOME：双击 install-offline.cmd
  ```
  - 想跳过 GUI 先解压（脚本化）：`dsh-desktop.exe --extract-runtime`
  - `install-offline.cmd` 是 `install-offline.ps1` 的**双击包装**（自动 `-ExecutionPolicy Bypass`，避免"双击 .ps1 不执行/被执行策略拦住"）；双击后会**列出每个插件的功能说明**并问你要装哪些。命令行同样支持选择：
    ```powershell
    powershell -ExecutionPolicy Bypass -File install-offline.ps1 -Plugins all              # 全装（默认）
    powershell -ExecutionPolicy Bypass -File install-offline.ps1 -Plugins none             # 不装（只跑壳）
    powershell -ExecutionPolicy Bypass -File install-offline.ps1 -Plugins ask              # 交互菜单
    powershell -ExecutionPolicy Bypass -File install-offline.ps1 -Plugins explainer,core-version
    powershell -ExecutionPolicy Bypass -File install-offline.ps1 -Plugins 2,4              # 按菜单编号选（多选用逗号）
    powershell -ExecutionPolicy Bypass -File install-offline.ps1 -CheckOnly                # 只列清单/预演，不写东西
    powershell -ExecutionPolicy Bypass -File install-offline.ps1 -DSHome D:\dsh-home       # 指定 DSH_HOME
    ```
    - **多选**：菜单里直接输编号、用**逗号隔开**（如 `2,4` = 只装第 2 和第 4 个）；`a`=全部、`n`=都不装、直接回车=全部。
    - **输入无效时**（如 `9`、`2,x`）提示无效并**不安装任何插件**（不会猜、也不会退化为全装）。
    - 编号也可写成简名/包名/patch id：`explainer` / `project-explorer` / `model-sync` / `model-capabilities` / `core-version`。
    - **安装器只加不减**：已装但这次没选的插件不会被移除；想关掉用「插件说明」面板的开关（或手工删包 + patch 条目）。
    - 无控制台调用（agent/计划任务）时 `ask` 自动退化为全装、不会挂住；`DSH_INSTALL_FORCE_PROMPT=1` 可强制走菜单（便于喂答案：`echo 2,4 | install-offline.cmd`）。

  **5 个插件分别是什么**（安装菜单里显示同一段文字；单一数据源 = `scripts/setup-plugins.mjs --describe`）：

  | 编号 | 短名 | 功能 | 在哪看到 |
  |---|---|---|---|
  | 1 | core-version | **核心版本徽标**：显示当前核心版本号（如 `dsh v0.1.5-rc.2`）。只读展示，不挡点击 | 界面左下角 |
  | 2 | explainer | **插件说明面板**：每个插件干什么用中文写清，显示已启用/已停用，可一键开关（重启壳生效） | 设置 →「插件」 |
  | 3 | model-capabilities | **模型能力清单**：每个模型能否识图、上下文多长、有哪些推理档位。只读查询 | 设置 →「模型能力」 |
  | 4 | model-sync | **模型同步**：从 models.dev / OpenRouter / 该商自己的 `/models` 端点拉候选，逐字段对比后写入配置；手工改过的值会被标出、默认不覆盖。**会写 `settings.yaml`**（有 revision 冲突保护） | 设置 →「模型」→ 提供商卡片 |
  | 5 | project-explorer | **项目文件树**：右侧可折叠文件树；把文件拖进输入框即插入其路径，让 agent 自己去读。只给路径、不传内容 | 界面最右侧 |
  - 运行前提只有 **WebView2 Runtime**（Win10/11 一般自带）
- **注意**：壳是**单实例**——本机已装着旧壳时必须先退出它；未签名，首启可能有 SmartScreen 提示；API key/`.env` 各机自配。
- **自动更新（与源码装一致）**：便携版启动时 + 每 24h 也会查 npm registry，发现新版就用**包内 npm** 自动下载，提示「重启服务」生效；重启时把新 harness 换入 `runtime\`（先暂存、验证能跑、失败自动回滚；`node.exe` 不动）。包内 npm 缺失（`-NoNpm` 构建）或解压到只读目录时会如实提示，可改用下载新版发行包。
- **自己打包**：`pwsh -File scripts\pack-release.ps1`（`-NoNode` 打不含 Node 的小包；`-NoNpm` 关掉自更新能力；`-KeepStaging` 保留中间目录）
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

`update.ps1` 会：① `git pull --ff-only` 并列出新提交 ② 重装全部自定义插件 ③ `wails build` ④ 把 exe 部署到应用区（附历史归档 + `VERSION.txt`）。常用开关：

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
