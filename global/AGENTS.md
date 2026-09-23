# DeepSeek Harness 全局预设

> 位置：`$DSH_HOME/AGENTS.md`。所有通过 dsh 运行的项目都会自动加载本文件（用户全局指令）。项目目录内更具体的 `AGENTS.md`/`CLAUDE.md` 优先于本文件。
>
> ⚠️ **本文件是「全局预设」的权威副本**（本仓库 `global/AGENTS.md`）。部署机上的 `~/.dsh/AGENTS.md` 是安装副本：首次部署时由 `setup.ps1` 拷贝；更新全局预设 = 改本文件 + 在需要更新的机器上重装（删除 `~/.dsh/AGENTS.md` 后重跑 setup，或手动拷贝）。
> **🔴 维护纪律**：改本文件后必须同步安装副本（`Copy-Item` 覆盖 `~/.dsh/AGENTS.md`），否则会出现「权威副本落后于安装副本」——2026-08-19 已发生过一次（图片/PDF 策略与正式文件版本化约定只在安装副本里）。
>
> **文档版本：v2.20**（2026-09-23 更新；上一版 v2.19 = 同日）——把「结尾点/空格文件名」那条坑补精确：**结尾空格与结尾点同机制**（同日二次实测：`Get-ChildItem` 列得出 `v19home1 `、`Test-Path` 返回 False、`[IO.Directory]::Delete` 用不带空格的路径报「找不到」→ 必须把**空格一起写进 `\\?\` 路径**才删得掉）。v2.19 内容见下。

## 基本规则

- **默认使用中文（简体）回复和交互**，除非用户明确要求其他语言。

## 图片 / 图片输入 / PDF 处理策略（所有 agent 通用，2026-08-19 约定，v2.16）

**图片和 PDF 分开处理。** 图片可直接用当前模型识图；**PDF 必须走 `pdf_pipeline.py` 内部路由，不能把 PDF 文件直接丢给模型**（PDF 是复合格式，仅识图能力的模型无法直接解析）。

**A. 处理一张图片**：
1. 用当前模型识图（dsh 用 `read_image` 工具读图）。
   - 成功读到 → 当前模型可识图 → 直接用当前模型理解/处理。
   - 报 `does not declare image input` / 无法读取 → 当前模型无图片能力 → 到 2。
2. 询问是否切换到一个支持图片的模型。
   - 不切换 → 建议本地 OCR 兜底（Tesseract，纯 CPU）。
   - 切换 → 切换后**再用 `read_image` 实测一次** → 到 3。
3. 切换后再测：能读到 → 用新模型继续；仍不能读 → 明确告知，建议直接走本地 OCR。

**B. 处理一个 PDF / 扫描件**：
直接调用 `pdf_pipeline.py` 内部路由（**不要直接丢给模型**）：
```
python D:\opencode\001\pdf_pipeline.py <文件路径>
```
它会：pdf-inspector 前置分类（文字版直接提取 / 扫描件渲染成图 OCR / 混合分流）→ 多模态 OCR（失败自动降级 Tesseract）→ 输出 Markdown。若因多模态模型缺失全部降级到 Tesseract 且质量不佳，询问用户是否切换模型后重跑。

> 要点：
> - **不额外探测**：dsh 的 `read_image` 本身就会按模型声明的模态判断，能读=能识图、报错=不能，无需跑探测脚本、无需拿 API Key。
> - **交互由 agent 做**：脚本是纯 CLI 无法中途问人；「是否切换」这类确认由 agent 主动向用户提出。
> - **PDF 走路由**：处理 PDF 一律用 `pdf_pipeline.py`（内部先分类再转图 OCR，含降级兜底），不要直接把 PDF 文件丢给模型。配置见 `D:\opencode\001\docs\ocr-pdf-image-strategy-setup-v2.x.md`。
> - **🔴 超时/质量差走脚本闭环，不要自己来回换引擎**：多模态超时 → 脚本 adaptive 已自动「降精度重试」（默认开启，单页超预算强制降最快档收尾）；整体超时 → 用 `--pages N:M --output out.md` 分批续跑。**不要**「超时→切 Tesseract→质量差→换模型→换方案」这样反复重跑——那既慢又绕开脚本的降级/自适应。Tesseract 只是脚本 llm 引擎内部失败时的兜底，不是 agent 手动切的第一选择。

## 协作约定

- **开工先读**：若项目里有 `HANDOVER.md` 或 `AGENTS.md`，先读它们，了解既有工作与约定，避免重复实现。
- **任务结束更新 HANDOVER**：若项目里存在 `HANDOVER.md`，每完成一项任务后更新它（记录做了什么、产出、坑），便于其他会话接力；没有 `HANDOVER.md` 的项目，至少把关键决策与坑留在项目内可查的地方。
- **🔴 写入前必须刷新重读（2026-08-19 强制约定，防并行覆盖）**：多个会话可能并行编辑同一文件，**任何 agent 在写入/更新任何文件（尤其 `HANDOVER.md`、`AGENTS.md`、`README` 等共享文档）之前，必须先重新读取该文件的最新内容，再执行编辑**：
  1. **不要依赖会话早期读到的内容**作为编辑依据——内存/缓存副本可能已过期；写入前重新读取确认当前状态与锚点（`old_string`）仍存在。
  2. **改前核对行数与锚点**：若发现行数/结构与记忆不符（章节消失、内容变化），**立即停止写入并重读全文**，不要强按旧锚点编辑。
  3. **优先小步增量编辑**：用精确锚点做 `edit`，避免整文件 `write` 覆盖（`write` 整体替换，最易造成覆盖事故）。
  4. **发现冲突先报告**：确认内容被其他会话覆盖丢失时，**先向用户报告并确认恢复方式**，不要静默重建或放弃。
  5. **关键产出留索引**：重要产出除文件本身外，在 `HANDOVER.md` 留下「文件名 + 版本 + 要点」索引，便于被覆盖后重建。
  > 教训：2026-08-19 曾发生 HANDOVER 被并行会话整体重写、导致多个章节（§16–§18）丢失的事故（详见该仓库 HANDOVER §19）。
- **正式文件版本化（2026-08-19 约定）**：凡是会被其他 agent 复用/执行的「正式文件」（配置说明、部署脚本、交接文档等），**每次更新后必须在文件内标注版本号 + 时间戳**（如 `> **文档版本：vX.Y**（YYYY-MM-DD 更新）`）并附一行变更记录；**文件名也要带版本号**（如 `xxx-setup-v3.1.md`）；版本号按语义递增（大改/重构 → v 主号，小修/补漏 → v 次号）。更新全局预设等正式文件时同样适用。
- **参数以实测为准（2026-08-19 约定）**：涉及外部服务/模型的参数（上下文长度、输出上限、能力开关等），文档给的只是**推荐值/快照**；**配置前必须实测确认**（如模型供应商的 `/v1/models` 元数据），冲突时以实测为准，并在交付说明中记录差异。
- 遵循项目内已有的编号/命名约定（例如 dsh-desktop 的「路径 A/B/C…」）。

## 环境常见坑（本机通用；项目专属坑见该项目的 HANDOVER）

- **沙箱里 git/API 走 HTTPS 报 `SEC_E_NO_CREDENTIALS`**（schannel 凭据库被拒）→ 首选：`git config http.sslBackend openssl`（仓库级）后带 token URL 直接 push，**免提权**（2026-08-18 实测；新 clone 的仓库要重设该配置）；次选：`danger-full-access` 重试。
- **沙箱里 `curl.exe` 走 HTTPS 一律失败**（`schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS`，`https://` 全部返回 `000`）——**别误判成断网**：DNS 解析与 TCP 连接都正常，只是 schannel 拿不到凭据。→ 下载/探测改用 **`node -e "fetch(...)"`**（Node 自带 OpenSSL 与 CA，实测 HTTPS 正常）；GitHub 直连实测仅 ~56KB/s，加镜像前缀 `https://ghfast.top/<原始URL>` 可达 ~2.7MB/s（2026-09-18 实测，用于侧载 PowerShell 7）。
- **探测本地服务别用 `Get-NetTCPConnection`/`netstat`**（沙箱假阴性「无监听」）→ 用 `curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:43080/`（返回 200 即正常）。
- **不要提交凭据/API Key/.env 到任何 git 仓库**；文档（如 HANDOVER）里的明文凭据入库前先移到 gitignore 文件并改引用。
- **Go 1.21+ 的 telemetry 写 `%APPDATA%\go\telemetry`**：沙箱内 `go version`/`go build` 等报 Access denied → 命令前设 `$env:GOTELEMETRY="off"`（免提权规避）。
- **Go/Wails 项目**：改后端用 `wails build -s`（跳过前端，免 vite `spawn EPERM` 提权）；沙箱里把 `GOCACHE`/`GOTMPDIR` 重定向到工作区 `.cache/`。
- **PowerShell 数组 splatting 传的是位置参数**：`& script.ps1 @array` **不解析** `-Name value` 对（会把 `-Name` 当值传）→ 转交命名参数用**哈希表 splatting** `@{Name=$v}`。
- **git push 的进度/结果输出走 stderr**：pwsh `$ErrorActionPreference='Stop'` 会把它当 NativeCommandError 误报（exit 1 ≠ 失败）→ 以 `git status -sb`（无 ahead）或远端 HEAD 为准。
- **curl.exe 在 pwsh 传 JSON body**：`-d '{"..."}'` 可能报 `Problems parsing JSON`（400）→ 写临时文件 + `curl.exe --data-binary "@file"` 传参。
- **给 Windows PowerShell 5.1 用的 `.ps1` 必须存成 UTF-8 带 BOM**（2026-09-18 实测踩到）：5.1 会把无 BOM 脚本按 ANSI(GBK) 解码，脚本里的中文变成 `灏嗘妸` 之类甚至直接报语法错（`Array index expression is missing or not valid`）。agent 的写文件工具默认写无 BOM → 写完必须补 BOM：`[IO.File]::WriteAllText($p,$t,(New-Object Text.UTF8Encoding($true)))`；`.md`/`.mjs` 无此要求。
  - **补充（同日二次实测）：`edit` 工具改完会把文件里已有的 BOM 吃掉** → 任何一次编辑之后都要复查首 3 字节是否 `EF BB BF`，不是就补回；否则脚本又按 ANSI 解码（本次两个 `.ps1` 都中过）。
- **🔴 Windows PowerShell 5.1 的两条"只在干净 Windows 上发作"的坑（2026-09-23 实测，教训级）**：**目标机器是干净 Windows ⇒ 只有 5.1**（开发机侧载了 PS7 ⇒ 用 `pwsh` 跑的测试**全绿也证明不了目标机可用**）。凡「`.ps1` 调外部程序（node/git/…）并解析其输出」的路径都要按这两条写：
  1. **5.1 用「控制台代码页」解码子进程 stdout**（zh-CN = 936/GBK），不是 UTF-8。中文被按 GBK 误读后，**末尾一个悬空前导字节会吞掉后面那个 `"`**（实测：`项目文件树` = `E6 A0 91` → 前两字节成「鏍」、`91` 吞掉收尾引号）→ JSON 永不闭合 → `ConvertFrom-Json` 崩，且报错里出现的是**中文标题**（极具误导性）。→ 对策：**机器可读载荷一律输出纯 ASCII**（如给 mjs 加 `--ascii`，把非 ASCII 转义成 `\uXXXX`；JSON 解析器会还原成中文），并在脚本开头钉 `[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)`（`try/catch` 包住）。
  2. **5.1 的 `ConvertFrom-Json` 把顶层 JSON 数组当作「一个对象」**（PS7 会枚举成 N 个）→ `@($raw | ConvertFrom-Json)` 在 5.1 得 **1 行**而非 N 行；后果往往是**静默退化**（菜单/列表退回兜底数据、只处理第一条）。→ 对策：解析一律做**形状归一** `@($raw | ConvertFrom-Json) | ForEach-Object { $_ }`。
  3. 两者会**互相掩盖**（先崩的那个挡住后一个）→ 修完解码必须立刻验证数组形状。回归测试要**用真实 `powershell.exe` 子进程 + 把控制台代码页钉成 936** 跑真实脚本（例：`dsh-desktop-env` 的 `.work/ps51-encoding.test.ps1`），并附一条"含非 ASCII 的 `.ps1` 必须有 BOM"的守卫。
- **改 `~/.dsh/settings.yaml` 必须保持 UTF-8 无 BOM**（原文件无 BOM）→ 别用 5.1 的 `Set-Content -Encoding UTF8`（会加 BOM），用 `[IO.File]::WriteAllText($p,$t,(New-Object Text.UTF8Encoding($false)))`。设置层是 `schema(mergeLayers(base, section))` 深合并，**只写 `shell.pwshPath` 不会丢 `cwd` 等 base 字段，且热生效、无需重启 DSH**。
- **解压大 zip 用系统自带 `tar.exe`（bsdtar）**，不要用 5.1 的 `Expand-Archive`（同一个 101MB / 320 文件的包，tar 快一个数量级）。
- **🔴 本机 PowerShell 现状与乱码回归风险（2026-09-18 起）**：PS7 7.6.6 已免管理员侧载到 `C:\Users\veken\PowerShell\7`，并在 `~/.dsh/settings.yaml` 用 `shell.pwshPath` 指定。DSH 的 `pwsh` 工具解析顺序为 `%ProgramFiles%\PowerShell\7\pwsh.exe` → `PATH` 里的 `pwsh.exe` → **5.1 兜底**；且它以 **`-NoProfile`** 启动，所以 **profile 类编码修复对 agent 命令无效，只能换底层**。若侧载目录被删或 `settings.yaml` 被整体覆盖，agent 会静默退回 5.1 → 乱码回归（`Get-Content` 读 UTF-8 无 BOM 得 `涓枃…`、`Out-File` 默认写 UTF-16LE `FF FE`）。恢复：跑 `D:\dsh\001\tools\ps7-setup\install-pwsh7.ps1`（v1.0；离线包与验证步骤见同目录 `README.md` v1.0）。
- **推送 `.github/workflows/*`**：内置 `GITHUB_TOKEN` 推不了 workflow 文件，需带 `workflow` scope 的 PAT（存 secret 使用）。
- **DSH 模态枚举只有 `text`/`image`**：`dsh-llm-pi-ai` 的 `MODALITIES = {text, image}`，在 provider profile 写 `video`/`audio` 会以 `settings-rejected` 写入失败；模态写在**条目级 `input`**（优先级：条目级 → provider 级 → 路由级 `defaultInput`）。
- **双引号 here-string 里生成 PowerShell 代码时，`$false` 必须转义成 `` `$false ``**（2026-09-18 实测踩到）：不转义会被内插成字面量 `False`，生成 `New-Object ...UTF8Encoding(False)` 这类非法调用，运行时报「False 不是 cmdlet」而**静默失效**（本次导致生成的 profile 里三行编码设置全废）→ 生成器里写 `` `$false ``，或用单引号 here-string `@'...'@`；推荐 `[System.Text.UTF8Encoding]::new($false)`。
- **🔴 双引号 here-string（`@"..."@`）的「内容」里也不能有裸反引号**（2026-09-23 实测踩到）：反引号在 PowerShell 里是**转义符**，往 here-string 里写 Markdown 式 `` `code` ``（尤其 `` `u ``、`` `i ``）会被当成转义序列 → **整个脚本解析失败**（本次把 `scripts/pack-release.ps1` 的 README 文本写成带反引号 → 3 个测试套件同时以 `ParserError: The Unicode escape sequence is not valid` 崩，而不是给出有用的失败信息）。**对策**：here-string 内避免反引号（纯文本/README 本来也不需要），要用就改用单引号 here-string `@'...'@`；**且改完立刻做一次解析自检**——`[ScriptBlock]::Create([IO.File]::ReadAllText($p))`，PS7 与 5.1 各跑一次（成本 1 秒，能把「静默到运行时才炸」提前到写文件那一刻）。
- **Windows 上别生成以「.」或**空格**结尾的文件名/目录名**（2026-09-18 首次实测踩到，2026-09-23 二次实测补充）：用 `new Date().toISOString().replace(/[-:T]/g,'')` 做时间戳时，`slice(0,15)` 会截到毫秒前的小数点，生成 `xxx.bak-20260918085529.`；这种名字 `Get-ChildItem` **列得出来**，但 `Test-Path`/`Get-Item`/`Copy-Item` 因 Win32 **剥掉结尾的点或空格**而**报「不存在」**（备份等于取不回来）→ 时间戳只取到秒（`slice(0,14)`）；**已经生成了的只能走 `\\?\` 前缀，且必须把结尾的点/空格原样写进路径**：`[IO.File]::Move("\\?\$p.", $p)` / `[IO.Directory]::Delete("\\?\$dir ", $true)`（同日二次实测：`.cache\v19home1 ` 结尾是空格，用不带空格的路径删报「找不到」；先看名字字节确认，如 `76 00 31 00 20 00` 末尾的 `20` 就是空格）。
