<!-- dsh-desktop:zh-preset:begin -->
> 本段由 dsh-desktop 壳面板的「全局预设」按钮管理（添加 / 移除）；上下两行注释是锚点，请勿手改。含两部分：**语言与交互**、**日常避坑**。

### 语言与交互

- **默认用中文（简体）回复与交互**：正文、报错说明、日志、提交信息、文档一律中文，除非用户明确要求其他语言。
- 代码标识符、命令、路径、上游英文原文与专有名词**保持原样**——不要为了"中文"去翻译标识符或改写命令。
- 需要用户看的结论、表格、清单优先中文；引用上游英文原文时保留原文并附中文说明。

### 日常避坑（编码 / PowerShell / 路径；都是踩过的真坑）

- **写文本文件一律显式 UTF-8**；给 Windows PowerShell 5.1 用的 `.ps1` **必须带 UTF-8 BOM**，且**每次编辑后复查首 3 字节是否 `EF BB BF`**（`edit` 之类的工具会静默吃掉 BOM）——无 BOM 的脚本会被 5.1 按 ANSI/GBK 解码，中文变乱码甚至直接语法错。
- **机器可读输出一律纯 ASCII**（如加 `--ascii` 把非 ASCII 转义成 `\uXXXX`），并在脚本开头钉住 `[Console]::OutputEncoding` = UTF-8：5.1 用**控制台代码页**（zh-CN = 936）解码子进程 stdout，中文末尾字节会吞掉后面那个 `"` ⇒ `ConvertFrom-Json` 崩，且报错里显示中文（极具误导）。
- 原本**无 BOM** 的文件（如 `settings.yaml`）**保持无 BOM**：用 `[IO.File]::WriteAllText($p,$t,[Text.UTF8Encoding]::new($false))`；别用 5.1 的 `Set-Content -Encoding UTF8`（会加 BOM），也别用 `Out-File`/`>` 写中文（5.1 默认 UTF-16LE）。
- 生成 PowerShell 代码时：双引号 here-string 里的 `$false` 要转义成 `` `$false ``（否则被内插成字面量 `False`，静默失效）；here-string 内容里**别写裸反引号**（Markdown 式 `` `code` `` 会被当转义符，整段解析失败）；**生成后立刻做解析自检**（`[ScriptBlock]::Create(...)`，PS7 与 5.1 各跑一次）。
- 解析 JSON：5.1 的 `ConvertFrom-Json` 把**顶层数组当成"一个对象"**（PS7 会枚举成 N 条）⇒ 一律做形状归一 `@($raw | ConvertFrom-Json) | ForEach-Object { $_ }`，否则**静默退化成"只处理第一条"**。
- PowerShell **函数名不要与外部命令同名**（函数优先解析 ⇒ 递归调用自己，参数每层翻倍，看着像卡死）；调用外部命令用动词前缀命名 + 写全名（`git.exe`）。
- **`Start-Process -NoNewWindow` 在没有真正控制台时会静默失败**（`$p` 为 `$null` ⇒ 退出码 0 但其实什么都没干）⇒ 断言落在**产物**上（文件 / 进程 / 哈希），别只看退出码；要跑 exe 就直接 `& exe …`。
- 给子进程**用真实文件当 stdout/stderr/stdin**，别用管道：沙箱里 Node 的默认 piped stdio 需要"命名管道"会被拒（`EPERM`），而且常被包装成"子进程退出码 1"这种误导结论。
- 本机做 HTTP 一律用 **`curl.exe`**（`Invoke-RestMethod` 在本机可能卡死）；**`git push` 的进度与结果走 stderr**——别因为 `$ErrorActionPreference='Stop'` 把它误判成失败（以 `git status -sb` 或远端 HEAD 为准）。
- Windows 上**不要生成以 `.` 或空格结尾的文件名/目录名**：`Get-ChildItem` 列得出来，但 `Test-Path`/`Copy-Item` 会报"不存在"（Win32 会剥掉结尾的点/空格，备份等于取不回来）；时间戳只取到**秒**。
- 解压大 zip 用系统自带 **`tar.exe`**（bsdtar），不要用 5.1 的 `Expand-Archive`。
- 写工作区**之外**的路径可能被沙箱拒绝（`Access is denied`）：明确说明或申请授权，**别反复换姿势重试同一路径**；临时产物一律放 **gitignored 的临时目录**并按用途命名，**别在仓库根留下临时文件**。
<!-- dsh-desktop:zh-preset:end -->
