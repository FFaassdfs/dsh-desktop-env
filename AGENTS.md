# dsh-desktop 项目默认预设

> 本文件每个会话开工时自动加载。详细交接细节见同目录 `HANDOVER.md`。默认中文回复。
>
> **当前状态（2026-09-24）**：源码区 = `D:\dsh\dsh-desktop-env`（本仓库，唯一权威工作区）；应用区 = `D:\dsh\app\current`（**老壳入口，2026-09-30 起已冻结**；干活入口 = **官方桌面版 + 助手**，见顶部冻结声明）；壳 = **launcher @ 43080（冻结版）**（已运行 P0-3 加固版：退避 + 日志轮转，见 §23；**内置「核心版本」选择器：只提示不自动装、按通道选版本、可跳过**，见 §40）；核心 = **`@deepseek-ai/dsh 0.1.7-rc.2`**（全局 npm，**2026-09-27 实测**；✅ 现在 **`dsh --version` = `dist-tags.latest` = `0.1.7-rc.2`**（`next` 同版、`alpha` = 0.1.7-alpha.2）——旧的「`latest` 仍钉 `0.1.5-rc.3`、新版只发在 `next`」现象**自 2026-09-24 起消失**，**上游仍无正式版**；⚠️ 🔴 **`0.1.5-rc.2` 已确认是坏版本——profile 里装了插件就「启动即崩」**（`user patch-layer watching requires the Cordis HMR service`），**不要再用**，见 §42；安装/打包仍必须带 `--before` 时间闸门，见 §31/§40/§42）。📌 **但"包/锁版内置值"自 0.1.17 起是 `0.2.0-rc.1`**（`next` 通道，发布 `2026-09-28T12:34:03Z`；本机全局**未升**）——**两个数都合法，别互相覆盖**（F2 vs F10/F15，见 §51.3）；最新便携包 = **`desktop-v0.1.20`（双包：瘦身 + 整合，内置核心 `0.2.0-rc.1`；新增「更新源」+ 修复残缺 runtime）**（**2026-09-30 11:21 发布**，CI run **#27 全绿**；**slim 118.6 MB** sha256 `ab30bcaf…` / **full 183.8 MB** sha256 `640f4d4d…`；两个包**各 42/42** 端到端验证通过；面板「更新源」可选 官方/淘宝/自定义 + **源不通自动回退淘宝镜像**，见 §54/§55 / facts **F32**）。**0.1.19 发布记录（保留）**：2026-09-30 08:58，slim 118.6 / full 183.7 MB，「全局预设」扩成 **中文交互 + 12 条日常避坑**（§53 / F31）。**0.1.17 发布记录（保留）**：2026-09-29 10:34，slim 118.6 / full 183.7 MB，**内置核心抬到 `0.2.0-rc.1`** + 新增「核心+6 插件」启动闸门（§51 / F30）。**0.1.16 发布记录（保留）**：2026-09-29 08:01，slim 117.9 MB / full 183.1 MB，**修复自更新丢 npm**（§50 / F29）。**0.1.15 发布记录（保留）**：2026-09-28 15:36，slim 118.0 MB / full 183.1 MB，`-Variant slim|full` ⇒ **变体名进包名**（§49）。**0.1.14 发布记录（保留）**：**2026-09-24 15:30 发布，资产 234.6 MB、壳 commit `25bbbfc`**。**0.1.13 发布记录（保留）**：**2026-09-24 发布，核心已修正为 `0.1.7-rc.1`**；CI run #20 全绿、资产端到端 `verify-release.mjs` **30/30**；本地留存 = `D:\dsh\app\packages\`，只留一份，**且直接下载 CI 资产当留存**——本地另打会因依赖布局不同而与发布件哈希不一致，见 §27.12/§42.8.4。⚠️ **`0.1.12` 及以前的所有包都是坏的**——内置 rc.2，装了插件就起不来，见 §42）；⚠️ 🔴 **`D:\dsh-desktop` 目录里那份便携包是坏的（rc.2），别启动它**；旧工作区 `D:\opencode\001\dsh-desktop` **已冻结**；**6 个插件**均已纳入 `scripts/setup-plugins.mjs`（编号 6 = `provider-presets` 预置供应商——内置 **3 条预置**：vekenllm 集团内网 / vekenllm 技术内网 / 电信算力，GUI 内启用/填 key，**脚本与发行包永不携带密钥**，§33/§39；其面板曾因 **list 座位缺必填 `id`** 而静默不渲染，0.1.10 起修复，见 §38），host/client 均已验证（§21.3；§38.5 用户实视）。**P0 全部关闭**（§24）；**多机更新链已修好**（§25/§26）；**插件更新器** = `scripts\update-plugins.ps1`（§30）；**目录约定（多会话）见下方新增章节 + §32**。
>
> 🔒 **冻结声明（2026-09-30，用户拍板）：Web 版（老壳）就此封版，`desktop-v0.1.20` 是最后一个发行版** —— 本仓库根的**老壳路径**（`app.go` / `main.go` / `dsh_windows.go` / `dsh_other.go` / `windowstate.go` / `frontend/` / `scripts/install-offline.ps1` / `scripts/pack-release.ps1` / `.github/workflows/release-desktop.yml`）**不再接受任何修改**（不加功能、不抬核心锚点、不发新包）。⚠️ **不要再推 `desktop-v*` tag**——老 CI 仍以 `on.push.tags: desktop-v*` 触发，会重新打包发 Release。**新工作一律在 `assistant/`**：新应用「**DSH 桌面助手**」（`dsh-assistant.exe`，独立 exe，版本线 `assistant-v1.0.0`，**不跑 harness**，只做官方桌面版的检测 / 插件注入 / 预设避坑 / 备份与指纹）。**共享资产仍在本仓库正常维护**：`plugins/` 6 个插件、`scripts/setup-plugins.mjs`（含新增 `--profile web|desktop|all`）、`global/zh-preset.md`、`.work/` 套件与工具、备份/恢复脚本。迁移 = 打开助手 → 注入插件 → 写预设。详见 `HANDOVER.md` **§57**。
>
> **🆕 最新（2026-09-30 第三段，`$DSH_HOME` 又被重建 + 官方桌面版已发布）**：今天 **13:22** `C:\Users\veken\.dsh` 再次被重建（`sessions\` 只剩 2 个新会话、`storages\workspace.json` 换成全新文档；但 `session_projcache`（文件到 13:20:58）与 `.credentials.yaml`（13:25）**未被动** ⇒ **不是整仓清空**）。用 **12:00 的每日备份** + `.work\restore-dsh-home.ps1`（**合并式**，勿重写）**已恢复 12 份会话**（含 **4.85 MB** 主线「恢复丢失的会话与配置备份」）+ 11 份投影缓存 + 合并索引，**12/12 SHA256 逐字节相同**；回滚现场 = `D:\dsh\backups\pre-restore\dsh-home-20260930-132858`。⚠️ **未恢复**：该会话 **12:13–13:22** 那一轮（「官方桌面版发布后本安装器怎么继续有价值」）正文随重置丢失，只剩投影缓存里的 24 轮 outline（已导出 `.cache\recover-20260930\b62acd52-turn-outline.md`）。🔴 **根因未定论**，两个候选：① 13:19–13:21 三次试跑**官方桌面 app**（其隔离目录 `app-home*`/`scratch*` 全是空的）② 13:22 便携包（内置 `0.1.7-rc.1`）引导被**更新核心**写过的共享 store（13:23 才自更新到 `0.2.0-rc.1`）。🔴 **纪律**：官方 app 与本壳**共用同一个 `$DSH_HOME`、同一份 `storages`/`sessions`** ⇒ **永远不要拿真实 home 试跑官方 app 或异版本核心**，home 级实验一律用 `.cache` 下的假 home。**官方桌面版实测清单 + 我们的定位讨论**见 `HANDOVER.md` **§56**、facts **F33**（**F13 的「未发布 / 不提供 `webServer`」两条已作废**）。
>
> **🆕 更早（2026-09-30 第二段，0.1.20：国内镜像「更新源」+ 修残缺 runtime；提交 `a19d1f3`→`7b7c825` 已推送）**：用户问「更新最新内核访问 GitHub 受阻，**国内有镜像源吗**」——先分清网络：**核心走 npm registry（不是 GitHub）**，发行包才走 GitHub Releases。实测：官方源 **994 ms** vs 淘宝镜像 **186–270 ms**，镜像的 `integrity`/`shasum` 与官方**完全一致**；GitHub 代理前缀 `ghfast.top` / `gh-proxy.com` / `ghproxy.net` 都可用。**落地成功能（B+C）**：新增 `corefeed.go` —— 面板「更新源」可选 **官方 npm / 淘宝镜像 / 自定义**（配置存 `os.UserConfigDir()/dsh-desktop/core-feed.json`，**不碰 `~/.npmrc`**），勾「自动回退」后配置的源不通会**自动改用淘宝镜像重试**；**三处调用点统一走它**（列版本 / 便携自更新 / 全局装），并把**实际使用的源**显示出来。官方那次 `--fetch-timeout=45000 --fetch-retries=1` **快速失败**，镜像那次放宽到 300 s。**真网端到端实测**：镜像文档与官方等价（29 版本、latest 相同）；把源配成 `http://127.0.0.1:9/` ⇒ 真的自动回退成功。**Go 套件 56 → 64 用例**。同版本还修掉：**残缺 `runtime\` 目录导致运行时永远装不回**（Windows 不能 rename 覆盖目录 ⇒ `Access is denied`；顺带实测证明 0.1.16+ 的 exe 能把丢掉的 npm 3 秒补回、且不动现役核心版本）。**已发 `desktop-v0.1.20` 双包**（CI #27 全绿，各 42/42）。详见 **§54 / §55** / facts **v1.36 + F32**。
>
> **🆕 更早（2026-09-29/30 第一段，全局预设加 12 条「日常避坑」；提交 `76a6bb3` 已推送）**：用户要求「加入一点日常避坑的点，比如**中文乱码**的规避」→ 采纳**标准档 12 条**、**并入现有那一段**（面板仍一个按钮，锚点不变）：UTF-8/BOM（5.1 必须有 BOM、编辑后复查）、机器可读载荷走纯 ASCII、无 BOM 文件保持无 BOM、here-string 的 `$false`/裸反引号、5.1 `ConvertFrom-Json` 顶层数组要形状归一、函数名别撞外部命令、`Start-Process` 静默失败要断言产物、子进程用文件 stdio、`curl.exe` 取代 `Invoke-RestMethod`、`git push` 走 stderr、结尾点/空格文件名、大 zip 用 `tar.exe`、工作区外写入需授权。实现上把"Go 常量 + .md 两份"改成 **`//go:embed global/zh-preset.md`**（**单一来源**；⚠️ 改 .md 必须重新构建）。**F11**：Go **55 用例**；`verify-release.mjs` 每变体 **42**。**已发 `desktop-v0.1.19` 双包**（CI #26 全绿，两包各 42/42）。⚠️ 记两个坑：**给带标记的块做脚本替换时别按"第一个锚点"定位**（版本说明里把锚点当示例写在行内 → 曾把 `## 基本规则` 标题吞掉，已修复）；测试辅助 `firstLine` 与 `app.go` 同名会 `redeclared`（已改名 `zhFirstLine`）。详见 **§53** / facts **v1.34 + F31**。
>
> **🆕 更早（2026-09-29 第三段，可选「全局中文交互预设」；提交 `2917a44` 已推送）**：用户问「**能不能让所有项目都有全局预设（比如交互尽量中文）**」，并要求「**在壳上放个按钮**让用户自己选」。查明机制 = 官方 `dsh-agent-instructions` 在**每个会话第一次请求**注入 **`$DSH_HOME/AGENTS.md`**（全局）+ 项目指令链（**项目内优先**，预算 64 KiB，**是指令不是强制**）⇒ 而本机那份**在 9/24、9/27 两次清空时丢了**，所以"没生效"。本次：①**权威文本 `global/zh-preset.md`**（带 `dsh-desktop:zh-preset:begin/end` 锚点的三条规则）；②**壳面板新增「全局预设」按钮**（`agentpreset.go` + 前端）：**只增删自己那段带标记的块，绝不覆盖用户内容**，文件变空才删除文件，保留 BOM——文本硬编码在 Go，但有两条测试与权威副本**逐字对齐**；③**便携包随装**：包内 `global\zh-preset.md`，安装器**首装且文件不存在**时写入（**已存在一字不动**）；④**本机已补装**（写入后**当前会话立刻**收到 user-global 指令注入 = 实证）；⑤顺带把面板那句还在骗人的「安装插件…」→「一键安装全部插件」。**Go 套件 48 → 54**；`verify-release.mjs` 每变体 **34 → 41**。**已发 `desktop-v0.1.18` 双包**（CI #25 全绿，两包各 **41/41**）。详见 **§52** / facts **v1.33 + F31**。
>
> **🆕 更早（2026-09-29 第二段，0.1.17：内置核心抬到 `0.2.0-rc.1`；提交 `ac4ba2a` 已推送）**：用户要求「**下一个包直接内置 0.2.0-rc.1**」。按本项目纪律**先补一道一直缺的闸门**——现成的两道启动闸门（CI 的 `Verify the staged runtime boots` 与 `verify-release.mjs` 第 10 步）**都只在空 `DSH_HOME` 上试启动**，而 §42 连发 13 个坏包的事故恰恰是「**核心+已装插件**」启动即崩：**新增 `.work/core-plugin-boot.test.ps1`（9 项）**（临时 home 装 6 插件 → 真启动 → 断言存活/服务 HTTP/无 HMR 中止签名/patch 层被 `--dump-config` 接受）。**预验结果：0.1.7-rc.2 与 0.2.0-rc.1 各 9/9** ⇒ 才允许钉进包。随后**三处锚点一起抬**：CI `$pinned`/`$before`（→ `2026-09-29T00:00:00.000Z`，必须晚于 `0.2.0-rc.1` 的 `2026-09-28T12:34:03Z`）、`deploy.ps1 -HarnessVersion`、`setup.ps1 -HarnessBefore`。**已发 `desktop-v0.1.17` 双包**（CI #24 全绿；slim 118.6 MB / full 183.7 MB；两包各 **34/34**，解包核心 = `0.2.0-rc.1`）。⚠️ **勘误**：`0.2.0-rc.1` 在 **`next`** 通道，**`latest` 仍是 `0.1.7-rc.2`**（我在 §50 曾口误成"latest 已到 0.2.0-rc.1"）。详见 **§51** / facts **v1.32 + F30**。
>
> **🆕 更早（2026-09-29，修掉「更新核心提示没有 npm」；提交 `6a3a53c`→`040b3f0` 已推送）**：用户报「**有的电脑**点更新核心提示没有 npm 就不更新，**有的电脑直接就更新**」——查明是**壳的真 bug**：自更新换入时用暂存树**整个替换** `runtime\node_modules`，而暂存树由 `npm install --prefix` 装出（**永远不含 npm**）⇒ **第一次成功自更新后包内 npm 被一起删掉**，此后 `bundledNpmCLI` 为空 ⇒ 永远提示「本包未内置 npm，无法自更新」（"有的电脑"＝**成功换入过的机器**；源码装那台走**系统 npm**，装了 Node.js 就"直接开始更新"）。**三处修复**：换入时从旧树**拷贝** npm 进新树（拷贝而非搬移 ⇒ `node_modules.old` 仍可完整回滚）、启动时**从 `runtime.zip` 只解回 `node_modules/npm`**（**保留用户实际在跑的核心版本**）、换入后**断言 npm 仍在**；`-NoNpm` 包不触发。Go 套件 42 → **48 用例**（+3 条 npm 回归），`gofmt`/`go vet` 干净。**已发 `desktop-v0.1.16` 双包**（CI #23 全绿，两包各 34/34 验证）。**已坏的机器怎么救**：①换 0.1.16 的 exe（11 MB）覆盖 `<包>\dsh-desktop.exe`，启动会自动补回 npm；②`tar -xf runtime.zip -C runtime "./node_modules/npm"` 后重启；③换新包。详见 **§50** / facts **F29**。
>
> **🆕 更早（2026-09-28，0.1.15 双包发布；提交 `cf46dd2`→`aae3676` 已推送）**：按用户要求 **0.1.15 一次发两个便携包** —— **瘦身包 `…-win-x64-slim.zip`（118.0 MB，默认下载；不含 325 MB 的 LibreOffice 引擎 ⇒ 侧栏不预览 Office 文档）** 与 **整合包 `…-win-x64-full.zip`（183.1 MB，含引擎）**；Release `desktop-v0.1.15` **已发布**（CI run #22 全绿，2026-09-28 15:36），两个包**各 34/34** 端到端验证通过（含"变体不变量"与"对全新 `DSH_HOME` 真启动"）。同时：①**核心锚点抬到 `0.1.7-rc.2`**（`deploy.ps1` 锁版 + CI `$pinned` 一起），**时间闸门推进到 `2026-09-25`**（F17 纪律：闸门必须晚于所钉版本发布时间）；②**修掉「安装预置插件」按钮的文案谎言**——它其实是**一键装全部**（默认 `-Plugins all`、**无菜单**），文案改为"一键安装全部插件；脚本自动退出后请重启服务"（§48、facts **F28**）；③`verify-release.mjs` 改为**按变体**（`<tag> [slim|full]`）；④记下两个会"伪装成包坏了"的坑（沙箱里 Node 管道 stdio `EPERM`、`Start-Process -NoNewWindow` 静默 `exit $null`）。详见 **§48 / §49**。
>
> **🆕 更早（2026-09-27，恢复作业；提交 `8927b71`→`6e2b7fe` 已推送）**：`$DSH_HOME` 今早 **08:38 被重建**（会话目录清空 + `storages\workspace.json` 丢掉 `D:\dsh\dsh-desktop-env` 工作区 ⇒ 会话列表空）。用 §43 的每日备份**已恢复**：**10 个会话记录**（含主线 1.86 MB「壳修改」+ 897 KB「修正插件」，`Get-FileHash` 与备份 **IDENTICAL**）+ **合并式**还原工作区索引；服务已由用户重启，**守护进程日志证明索引完好**（09:30:53 检测到端口关闭 → 09:31:56 确认服务恢复且索引未变），**✅ 用户实视验收：能看到恢复的会话（2026-09-27 14:2x）**；**`.credentials.yaml` 的 `VEKENLLM_API_KEY` 逐字节相同 ⇒ API key 没丢**；模型配置是清空后 08:41 重新同步的（**按实测为准，未用 9/24 版本覆盖**）。新增 3 个 `.work` 工具：**`restore-dsh-home.ps1`**（合并式还原）、**`restore-on-service-restart.ps1`**（重启窗口守卫）、**`push-via-api.ps1`**（SSH 不可用时的 API 推送）。**推送已恢复**（先用 API 把 5 个提交推上去、SHA 与本地逐一相等；**随后 `~/.ssh` 重建完成并经用户注册公钥，`ssh -T` / `ls-remote` / `push --dry-run` / `fetch` 四项实测全通过 ⇒ 已回归常规 `git push`**）。另修掉**工作区 ACL 缺 `WRITE_DAC` 导致沙箱起不来**（见下方高频坑）。**并做了两处状态更正**：①核心版本锚点 `0.1.7-rc.1` → **`0.1.7-rc.2`**（本机全局 `package.json` mtime = **今天 08:34:40**，即事故窗口内被升级；`dsh --version` 现在**等于** `dist-tags.latest`）；②**官方桌面端（上游 `apps/desktop/` Electron）仍未发布**——2026-09-27 四渠道实测：上游 **22 个 release / 资产 0**、23 个 tag **无 `desktop-*`**、npm 三个包名（`dsh-desktop`/`dsh-app-desktop`/`desktop`）**全 404** ⇒ ~~维持「不迁移、等官方发布」~~ 🔴 **2026-09-30 更正：官方桌面版已发布**（实测清单 + 定位讨论见 facts **F33** / `HANDOVER.md` **§56**；上面那组四渠道实测是 2026-09-27 的当日快照，facts **F13** 已就地标注修订）。详见 **§46**。
>
> **🆕 上一次改动（2026-09-24，提交 `7f976a4` + `b1ff6aa`，已推送；✅ 用户实视验收通过）**：修复 **`project-explorer` 文件树「对不上当前项目目录」**（见 §44）——client 读了**不存在的** `snap.current` ⇒ 恒 `undefined` ⇒ host 回退到磁盘根 `C:\` 并整盘渲染。改用官方判定 **`retainedBy.mainView > 0`**；同一错误在拖拽插入处也已修复；host 侧新增磁盘根守卫（409 `no-project-root`）；顺带修掉 `.work/filetree-host.test.mjs` **一直指向已冻结的旧工作区**（对本仓库 host 改动失明）的缺陷。**验收**：用户**只刷新页面**即生效（`C:` → `dsh-desktop-env`）⇒ 实证「client 半区改动刷新页面即可，无需重启壳」。**其他会话注意**：①`lib/client.js` 是**入库的构建产物**，改 `src/bundle.template.js` 后**必须重跑 `build.mjs`**；②**要发版先提交**（CI 从 commit 取源码，未提交的修复不会进发布包）；③**重新打包不会冲掉修复**（`pack-release.ps1` 是整目录拷贝 `plugins/`，壳构建根本不碰 `plugins/`）——详见 **§44.8**。

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

## 目录约定（多会话并行，2026-09-22 起）

> **目的**：多个会话同时在这个仓库里干活时，各写各的、互不踩踏，且仓库根永远只有"源码 + 文档"。详见 `HANDOVER.md` §32。

| 位置 | 放什么 | 规则 |
|---|---|---|
| **仓库根** `<repo>\` | 源码 / 脚本 / 正式文档 / `plugins\` / `scripts\` / `.work\` / `global\` / `.github\` | **只放会入库的东西**。任何临时文件、临时目录、试验产物**都不要落在根目录** |
| `<repo>\.cache\<用途>\` | 临时/缓存：测试骨架、下载的包、npm/go 缓存、诊断输出 | **gitignored**。**按用途或会话起子目录**（如 `.cache\selftest`、`.cache\verify-0.1.7`），**别共用固定名字**——两个会话用同一个目录会互相删掉对方的东西 |
| `<repo>\.work\` | 可复用的开发脚本与测试套件（**入库**，别的会话能直接用） | 新增脚本/测试放这里，并在 HANDOVER/facts 留索引 |
| `D:\dsh\app\current\` | **老壳入口（2026-09-30 起冻结）**：已部署的壳 exe + `VERSION.txt` | **不再改壳**（封版于 `desktop-v0.1.20`）；新工作见 `assistant/`。`update.ps1` / `scripts\deploy-shell.ps1` 的部署流程仅作历史参考 |
| `D:\dsh\app\versions\<日期>\` | 历史部署归档 | 由部署脚本自动写，保留 |
| **`D:\dsh\app\packages\`** | **本地唯一的发行包**（你要拷去别的机器的那份） | 由 `pwsh -File scripts\pack-release.ps1 -ShellVersion <ver> -OutDir D:\dsh\app\packages` 生成；**打包时自动删掉旧包**（`-KeepOldPackages` 可关），并写 `LATEST.txt`（文件名/版本/大小/SHA256）与 `SHA256SUMS.txt`。**复制时只认 `LATEST.txt` / `LATEST-<变体>.txt` 指向的那个 zip；0.1.15 起 slim 与 full 各留一份** |
| `D:\dsh\001\`、`D:\dsh\_migrate-2026-09-14\`、`D:\dsh\official-desktop-eval\` | 其他项目区 / 迁移归档 / 官方桌面端评估交接 | 不属于本仓库，别往里写 |

**🔴 两条硬规则（都有真实事故）**：

1. **别在仓库根留临时目录**：2026-09-22 曾因调用 `install-offline.ps1` 时漏了 `-Plugins` 标志，插件列表字符串被**位置绑定到 `-AppDir`**，在仓库根创建出 `2, 4`、`4,2`、`explainer,project-explorer` 等 5 个目录（各含一个 11 MB 的 exe），又被 `git add -A` **误提交**（`3f30a63`）。
   - 现已加护栏：`-AppDir` **必须是绝对路径**（否则直接报错，不建目录）；
   - 两个 pwsh 测试套件末尾都加了断言"**测试结束时仓库根没有新增条目**"。
   - **仍然**：提交前先 `git status` 看一眼，**不要无脑 `git add -A`**（本次就是它把垃圾带进库的）。
2. **临时目录带用途后缀**：`.cache\<用途或 tag>`。验证脚本会自己建 `.cache\verify-<版本>`；测试建 `.cache\seltest` / `.cache\uptest`。**发现别人占用了就换个名字**，不要清空别人的目录。

## 权威源码位置（别改错）

> ⚠️ **2026-09-14 迁移后更新**：壳源码权威位置已变更，旧记录（`.work\deepseek-harness\desktop\`）**作废**。

- **桌面壳源码（唯一权威）**：**本仓库根目录**——`app.go`、`main.go`、`dsh_windows.go`、`dsh_other.go`、`windowstate.go`、`frontend/`（launcher：状态面板 + node 直启 + token 交系统浏览器）
  - 🔒 **2026-09-30 起冻结**：以上文件**不再修改**（老壳封版于 `desktop-v0.1.20`）；新应用见 `assistant/`（DSH 桌面助手：独立 exe、不跑 harness、只做官方桌面版的检测/注入/预设/备份），共享 Go 逻辑放 `internal/`
  - 当前形态：**启动器（端口 43080）**，真正的 dsh 界面由**系统浏览器**打开（见 `HANDOVER.md` §14）
- **应用产物（与源码分离）**：`D:\dsh\app\current\dsh-desktop.exe`（历史版本在 `D:\dsh\app\versions\<日期>\`）
  - 改壳后：`wails build` → 用 **`pwsh -File scripts\deploy-shell.ps1 -BuiltExe build\bin\dsh-desktop.exe`** 部署到应用区（首装/更新共用这段逻辑；exe 被运行中的壳锁住时自动暂存 `.new.exe`）
  - 🟢 **一条命令搞定（含 pull/插件/构建/部署）**：`pwsh -File update.ps1`（开关 `-SkipFrontend` 只编 Go、`-CheckOnly` 干跑、`-AppDir` 改应用区）；首次部署用 `setup.ps1`。**壳源码就在本仓库**，fork 根级 `desktop/` 已废弃（见 `HANDOVER.md` §24/§25）
  - 回归验证「新克隆能否构建」：`pwsh -File .work\verify-fresh-clone.ps1`
  - 📦 **便携发行包（离线一键，目标机零前置依赖）**：`pwsh -File scripts\pack-release.ps1` 打出 `dsh-desktop-<壳版本>-dsh<harness版本>-win-x64.zip`（含便携 Node + npm + 单文件 `runtime.zip` 离线 harness 树 + **6 个插件** + `install-offline.ps1` + `update-plugins.ps1`）；打 tag `desktop-v*` 由 `.github/workflows/release-desktop.yml` 自动发 Release（见 `HANDOVER.md` §27/§30）。壳已支持便携运行时（`$DSH_DESKTOP_RUNTIME` → `<exeDir>\runtime` → `<exeDir>`），便携模式下自更新走**包内 npm**（§27.9）
- **旧工作区 `D:\opencode\001\dsh-desktop` 已冻结**（见其 `FROZEN.md`）：**不要再写入/提交**
- **fork 本地克隆不在本工作区**：`.work\deepseek-harness` 未迁移；fork 仅作官方镜像用，历史补丁存 `.work\migration-2026-09-14\`
- **官方 harness 源码**（`packages/`、`apps/`、`vendor/` 等，若日后自行 clone）：**只读，不要改**——会被官方同步覆盖
- 🔴 **别混淆两个「desktop」**：上游仓库有自己的 **一方官方桌面端 `apps/desktop/`**（Electron 壳，**2026-09-30 实测：已发布**，独占 `$DSH_HOME/profiles/desktop`，**且提供 `webServer`（端口 19387，含 index 注入）**——旧注「不提供 `webServer`」**已作废**，见 `HANDOVER.md` §56.2 / facts **F33**）；我们自己的 Wails 壳是**另一个**东西（本仓库根目录，launcher @ 43080 + `profiles/web`）。fork 里被删掉的是**根级** `desktop/`（我们的旧副本），与上游 `apps/desktop/` 无关。详见 `HANDOVER.md` §24.5 / `project-facts-v1.0.md` F13

## 高频坑（详情见 HANDOVER.md §10.7，共 20 条；新增的见本节顶部两条 5.1 坑）

- 🔴 **目标机器是干净 Windows ⇒ 只有 Windows PowerShell 5.1**（本机侧载了 PS7，所以 `pwsh` 全绿 ≠ 目标机可用）。两条 5.1 差异必须同时对付（详见 `HANDOVER.md` §34 / `project-facts` F18）：
  - **5.1 按「控制台代码页」解码子进程 stdout**（zh-CN = 936/GBK），中文乱码时**末尾悬空字节会吞掉 JSON 的收尾引号** → `ConvertFrom-Json` 崩。→ 机器可读载荷一律用 `node ... --describe/--status --ascii`（纯 ASCII 与代码页无关）；脚本开头钉 `[Console]::OutputEncoding` = UTF-8。
  - **5.1 的 `ConvertFrom-Json` 把顶层 JSON 数组当作「一个对象」**（PS7 会枚举成 N 个）→ 解析一律写 `@($raw | ConvertFrom-Json) | ForEach-Object { $_ }` 做**形状归一**，否则静默退化成 1 行 / names-only 兜底。
  - 回归套件：`.work\ps51-encoding.test.ps1`（用真实 5.1 子进程 + 钉 936 跑真实脚本）。
- **含非 ASCII 的 `.ps1` 必须带 UTF-8 BOM**，且 **`edit` 工具改完会吃掉 BOM** → 每次编辑后复查首 3 字节 `EF BB BF`（`ps51-encoding.test.ps1` 的 D 段会自动抓这个）。

- ✅ **工作区 ACL 已修（2026-09-27）**：先前症状是**任何 `pwsh` 调用直接失败**——`Error: SetNamedSecurityInfoW failed (Win32 5): grantWrite(D:\dsh\dsh-desktop-env)`（沙箱要给目录加自己的那条 ACE，而 ACL 只有 `Authenticated Users: Modify`、**没有 `WRITE_DAC`**，所以加不上）。**修复**：`icacls D:\dsh\dsh-desktop-env /grant "DESKTOP-7BGBDVN\veken:(OI)(CI)F"`（该目录 **owner 就是 `veken`** ⇒ 有隐式 `WriteDAC`，**不需要提权**即可改）。**验证（实测）**：不提权的 `workspace-write` 写入正常，且**沙箱边界仍在**（写 `C:\Users\veken\.dsh\…` 被拒 `Access is denied`）。**回滚材料**：`.cache\recover-20260927\acl-before.txt` / `acl-before.sddl`（回滚 = `icacls D:\dsh /restore acl-before.sddl`）。⚠️ 若**再次**看到该报错（权限被别的工具重置），照上面那句 `icacls /grant` 重做；临时绕过是每条命令加 `sandbox_permissions: danger-full-access`。
- 🔴 **`DSH_HOME` 少写 `.dsh` ⇒ 在用户主目录里造出第二个 home**：2026-09-24 / 09-27 实测 `C:\Users\veken\profiles\`、`storages\`、`.credentials.yaml`、`.anonymous-user-id` 都出现过，而且那份 `profiles\web\cordis.patch.yml` 是 **`[]` + 插件列表**的**非法 YAML** ⇒ 便携包自检报 `YAMLException: end of the stream or a document separator is expected` 并启动即崩（见 `HANDOVER.md` §46.4-3）。**跑自检/测试一律显式隔离 home**（`$env:DSH_HOME = <临时目录>`），别依赖默认值。**2026-09-27 已清理**：那 4 项先核对（签名 5 项全命中、`workspace.json` 无任何会话、`.credentials.yaml` 无 `refs`/key）再**移到隔离区** `D:\dsh\backups\accidental-home-C-Users-veken-20260927\`（0.19 MB）——**注意：只要还有脚本用默认 home 跑自检，它就会再长出来**。
- 🔴 **PowerShell 三个"静默毁一切"的坑（2026-09-27 写 `.work\push-via-api.ps1` 时全踩了一遍）**：
  1. **函数名不能与外部命令同名**：函数优先于外部命令解析 ⇒ 名叫 `Git` 的函数里写 `& git …` 会**递归调用自己**（参数每层多两个，命令行长到几百次重复，看起来像"卡住"）。**命名用动词前缀（`Invoke-Git`）并显式调 `git.exe`**。
  2. **函数返回会解包**：单行结果回来是**字符串**，`(f)[0]` 取到的是**第一个字符**（`rev-parse HEAD` 返回 `6`）。**先 `@()` 包一层再索引**。
  3. **`Invoke-RestMethod` 在本机会卡死**（.NET/schannel + 代理自动发现，实测 >2 分钟无响应），而 **`curl.exe` 到同一 URL <1 秒**。**本机做 HTTP 一律用 `curl.exe`**（配合 `--config` 文件放 token，避免出现在进程列表里）；顺便：`git credential fill` 能取到 Windows 凭据管理器里的 GitHub token（`gho_…`，scopes `gist, repo, workflow`）。
  - 另：**用 API 建 tree 时，子树里的 blob 必须先 `POST /git/blobs` 上传**，否则 `422 tree.sha … is not a valid blob`（GitHub 只接受远端已存在的对象 sha）。
- 🔴 **子进程输出捕获：别用管道，断言别只看退出码（2026-09-28，§49.4）**：①**沙箱里 Node 的默认 piped stdio 需要"命名管道"，会被拒**（`spawnSync … EPERM`；而 `execFileSync` 把它包成 `err.status ?? 1` ⇒ 看起来像"子进程退出码 1"，一次把发布验证的 4 个步骤误报成失败）⇒ **给子进程真实文件作 stdout/stderr/stdin**（`execFileSync`→`spawnSync` + `stdio:[inFd,outFd,errFd]`，stdin 也写文件再以 `r` 打开）。②**`Start-Process -NoNewWindow` 在"无真控制台"时静默失败**：`$p` 为 `$null` ⇒ `exit $null` = **退出码 0 但其实什么都没做**（曾让"便携包解压"看起来是坏的）⇒ **断言落在产物上**（如 `runtime\node.exe` 是否存在）；要跑 exe 就直接 `& exe …` 或 `spawnSync`，别套 `Start-Process`。③**沙箱作业回收会杀掉 `Start-Process` 拉起的子进程**（2026-09-30 实测：这样"分离"出去的重启守卫**只活了约 1 分钟**，日志只留 `watch start` 一行，而服务重启还没发生）⇒ **要活过服务重启的守护进程必须用一次性计划任务**（由 Task Scheduler 服务拉起，不在 agent 命令的作业里；实例 = `.work\restore-guard.cmd` + 任务 `dsh-desktop-restore-guard`，见 `HANDOVER.md` §56.5。⚠️ **建任务需要 `danger-full-access`**——沙箱内 `schtasks` 连 `/Query` 都报 `The system cannot find the path specified`）。④**沙箱里 `Get-Process` 只能看到约 12 个进程**，别用"看不见"判定进程已死 ⇒ 改用**独占打开它持有的日志文件**探测（被占用 ⇒ 仍在运行）。
- 🔴 **读 dsh 的会话记录要按"多帧 zstd"解**：`session.v4.jsonl.zstd` 是**追加写**的多帧拼接，`zlib.zstdDecompressSync()` 只解第一帧（1.9 MB 只出 204 B，看着像空文件）⇒ 用 `createZstdDecompress()` 流式或按魔数 `28 B5 2F FD` 逐帧解（§46.1 注）。

- 沙箱里 git/API 走 HTTPS 报 `SEC_E_NO_CREDENTIALS`（schannel 凭据库被拒）→ 用 `danger-full-access` 重试
- 探测本地服务**别用** `Get-NetTCPConnection`/`netstat`（沙箱假阴性，会误判「无监听」）→ 用 `curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:43080/`
  - 🔴 **返回 `401` = 正常**（0.1.2-rc.1 起的浏览器认证门，本机 0.1.5-rc.2；裸 URL 一律 401）；`000` = 未运行；`200` 只在带 token/cookie 时出现
- 改 Go 后端后 `wails build -s`（跳过前端 vite，免提权）；**改前端/绑定或首次构建必须完整 `wails build`**；产物要拷到**应用区** `D:\dsh\app\current\dsh-desktop.exe`（构建 exit 0 ≠ 已生效）
- 🔴 **换壳后必须核对「运行中的进程」，不是磁盘上的文件**：`Get-Process dsh-desktop | Select Id,Path`。2026-09-15 实踩：应用区 exe 已是新构建，但桌面快捷方式仍指向**冻结的旧工作区**（`D:\opencode\001\dsh-desktop\build\bin\`），启动出来的还是旧壳——已把快捷方式改到应用区（详见 `HANDOVER.md` §23.4）
- 推送 `.github/workflows/*` 文件：🔴 **2026-09-20 实测更正——用 SSH push 是允许的**（把 `.github/workflows/release-desktop.yml` 直接推上去，GitHub 随即识别为 `active`）；`workflow` scope 的限制**只针对 token 方式**（PAT/OAuth），CI 内部的内置 `GITHUB_TOKEN` 同样推不了 workflow。fork 的 `SYNC_TOKEN` 已于 2026-09-15 换新并验证（§24.6），历史失效故障见 `HANDOVER.md` §20.7
- 沙箱里 Go 构建：把 `GOCACHE`/`GOTMPDIR` 重定向到 `.cache/`，否则写 `%APPDATA%\go-build` 被拒
- **本机 git 推送走 SSH 443**（`github.com:22` 不通；旧 PAT 已失效）：remote = `ssh://git@ssh.github.com:443/FFaassdfs/dsh-desktop-env.git`

## 凭据与同步

- 凭据文件：`.work\secrets.local.md`（**被 .gitignore 忽略，永不提交**）；推送/同步细节见 `HANDOVER.md` §10.3 / §10.5 / §20.7
- **数值以单一事实源为准**：端口 / 核心版本 / 探测语义 / 同步频率 / 路径 / 插件清单见 **`project-facts-v1.0.md`**（各文档只引用，不复制）
- **推送用 SSH（2026-09-14 起）**：旧 PAT 已失效；remote 为 `ssh://git@ssh.github.com:443/FFaassdfs/dsh-desktop-env.git`（22 端口不通，走 443）
- 官方同步：**每天 08:00（北京时间 = UTC 00:00，cron `0 0 * * *`）**自动跑（fork 的 `sync-upstream.yml`，事实源见 `project-facts-v1.0.md` F4；**`HANDOVER.md` §10.5 旧记「每小时」有误，已更正**）。✅ **2026-09-15 已恢复**：新 PAT 写入 `SYNC_TOKEN`，run #49 = `success`，fork `behind_by = 0`（历史故障 #47/#48 因旧 PAT 失效，见 §20.7 / §24.6）。巡检用 **`node .work\sync-status.mjs`**（走 REST API、**无需本地 fork 克隆**；异常时退出码 1）；旧的 `pwsh -File .work\sync-upstream.ps1` 需要先自行 clone fork
