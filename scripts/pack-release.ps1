# pack-release.ps1 - build the portable (offline) dsh-desktop release package.
#
# Produces one zip that needs NOTHING on the target machine (no Node, no npm,
# no Go/Wails):
#
#   dsh-desktop-<shell>-dsh<dshver>-win-x64\
#     dsh-desktop.exe              the launcher (resolves .\runtime next to itself)
#     runtime.zip                  ONE file: node.exe + npm + the harness tree;
#                                  the shell unpacks it to runtime\ on first start
#     plugins\<all bundled>        the custom plugins (listed by --describe / README.txt)
#     scripts\setup-plugins.mjs    installer used by install-offline.ps1
#     install-offline.ps1 (+ .cmd) installs plugins into $DSH_HOME (+ optional app dir)
#     update-plugins.ps1 (+ .cmd)  refreshes ONLY the plugins already installed
#     VERSION.txt / README.txt
#
# Verified on 2026-09-20: dsh keeps ALL of its dependencies nested inside its own
# node_modules (190 entries; commander/open/zod/@deepseek-ai-cordis are NOT
# hoisted to the npm root), so copying the single @deepseek-ai/dsh tree plus a
# node.exe is a complete runtime.
#
# Usage:
#   pwsh -File scripts\pack-release.ps1                        # full package
#   pwsh -File scripts\pack-release.ps1 -NoNode                # without the bundled Node (needs Node on target)
#   pwsh -File scripts\pack-release.ps1 -RuntimeMode full-node-modules   # force copying the whole node_modules
#   pwsh -File scripts\pack-release.ps1 -SkipZip               # stage only
#   pwsh -File scripts\pack-release.ps1 -NoRuntimeArchive      # keep runtime\ as loose files
#   pwsh -File scripts\pack-release.ps1 -CheckOnly             # plan only
#   pwsh -File scripts\pack-release.ps1 -KeepOldPackages       # do not prune older zips in -OutDir
#
# -RuntimeMode: auto (default) | dsh-tree | full-node-modules
#   auto picks by layout: nested deps inside @deepseek-ai/dsh -> dsh-tree;
#   hoisted deps (npm install --prefix) -> full-node-modules. Either way the
#   staged runtime is executed once as a gate, so a wrong layout cannot ship.
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 misreads BOM-less UTF-8
# scripts with non-ASCII content).
param(
  [string]$OutDir = "",
  [string]$ShellExe = "",
  [string]$RuntimeSource = "",
  [string]$NodeExe = "",
  [string]$NodeLicense = "",
  [string]$RuntimeMode = "auto",
  [string]$ShellVersion = "",
  [string]$DshVersion = "",
  [switch]$NoNode,
  [switch]$NoNpm,
  [switch]$NoRuntimeArchive,
  [switch]$SkipZip,
  [switch]$KeepStaging,
  [switch]$KeepOldPackages,
  [switch]$CheckOnly
)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    [ok] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    [!!] $m" -ForegroundColor Yellow }
function DirSize($p) {
  if (-not (Test-Path $p)) { return 0 }
  return (Get-ChildItem $p -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
}

# --- resolve inputs -----------------------------------------------------------
if (-not $OutDir) { $OutDir = Join-Path $repoRoot ".cache\release" }
if (-not $ShellExe) { $ShellExe = Join-Path $repoRoot "build\bin\dsh-desktop.exe" }
if (-not (Test-Path $ShellExe)) { throw "shell exe not found: $ShellExe (run wails build first)" }
$shellInfo = Get-Item $ShellExe
if ($shellInfo.Length -lt 1MB) { throw "shell exe suspiciously small: $($shellInfo.Length) bytes" }

if (-not $RuntimeSource) {
  $shim = Get-Command dsh.cmd -ErrorAction SilentlyContinue
  if (-not $shim) { $shim = Get-Command dsh -ErrorAction SilentlyContinue }
  if (-not $shim) { throw "cannot locate the global dsh install (dsh.cmd not on PATH); pass -RuntimeSource" }
  $RuntimeSource = Split-Path -Parent $shim.Source
}
$dshTree = Join-Path $RuntimeSource "node_modules\@deepseek-ai\dsh"
if (-not (Test-Path $dshTree)) { throw "harness tree not found: $dshTree (pass -RuntimeSource <dir containing node_modules>)" }

if (-not $DshVersion) {
  $manifest = Join-Path $dshTree "package.json"
  $DshVersion = (Get-Content $manifest -Raw | ConvertFrom-Json).version
}
if (-not $ShellVersion) {
  if (Test-Path (Join-Path $repoRoot ".git")) {
    $ShellVersion = (& git -C $repoRoot rev-parse --short HEAD).Trim()
  } else { $ShellVersion = "nogit" }
}

if (-not $NoNode) {
  if (-not $NodeExe) { $NodeExe = Join-Path $RuntimeSource "node.exe" }
  if (-not (Test-Path $NodeExe)) { throw "node executable not found: $NodeExe (pass -NodeExe, or use -NoNode)" }
  if (-not $NodeLicense) { $NodeLicense = Join-Path $RuntimeSource "LICENSE" }
}
$nodeVersion = if ($NoNode) { "(none)" } else { (& $NodeExe --version) }

$pkgName = "dsh-desktop-$ShellVersion-dsh$DshVersion-win-x64"
$staging = Join-Path $OutDir "staging"
$pkgDir = Join-Path $staging $pkgName
$zipPath = Join-Path $OutDir "$pkgName.zip"

Step "plan"
Write-Host "  repo        : $repoRoot"
Write-Host "  shell exe   : $ShellExe ($([math]::Round($shellInfo.Length/1MB,1)) MB, commit $ShellVersion)"
Write-Host "  harness tree: $dshTree (dsh $DshVersion)"
Write-Host "  node        : $(if ($NoNode) { 'not bundled (-NoNode)' } else { "$NodeExe ($nodeVersion, $([math]::Round((Get-Item $NodeExe).Length/1MB,1)) MB)" })"
Write-Host "  output      : $(if ($SkipZip) { $pkgDir } else { $zipPath })"

if ($CheckOnly) {
  Warn "check only - nothing written"
  exit 0
}

# --- stage --------------------------------------------------------------------
Step "1/4 staging the package"
if (Test-Path $pkgDir) { Remove-Item $pkgDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $pkgDir | Out-Null

Copy-Item $ShellExe (Join-Path $pkgDir "dsh-desktop.exe") -Force
Ok "shell exe staged"

if (-not $NoNode) {
  $rt = Join-Path $pkgDir "runtime"
  New-Item -ItemType Directory -Force -Path $rt | Out-Null
  Copy-Item $NodeExe (Join-Path $rt "node.exe") -Force
  if (Test-Path $NodeLicense) { Copy-Item $NodeLicense (Join-Path $rt "LICENSE") -Force }
  Ok "node.exe staged ($([math]::Round((Get-Item $NodeExe).Length/1MB,1)) MB)"

  # npm lays the dependency graph out differently depending on how it installed:
  #   * `npm install -g`      -> deps NESTED in @deepseek-ai/dsh/node_modules
  #   * `npm install --prefix` -> deps HOISTED to <root>/node_modules siblings
  # Copying only the dsh directory is correct for the first layout and produces a
  # broken runtime for the second (this shipped a broken 37.7 MB package in the
  # first CI release, 2026-09-20). Resolve the mode automatically, then VERIFY the
  # staged runtime really starts.
  $nestedDeps = Join-Path $dshTree "node_modules"
  $effectiveMode = $RuntimeMode
  if ($effectiveMode -eq "auto") {
    $effectiveMode = if (Test-Path $nestedDeps) { "dsh-tree" } else { "full-node-modules" }
    Ok "runtime layout: $effectiveMode (auto: nested deps $(if (Test-Path $nestedDeps) { 'present' } else { 'ABSENT -> hoisted' }))"
  }

  if ($effectiveMode -eq "full-node-modules") {
    # Copy the whole node_modules so hoisted siblings come along. RuntimeSource is
    # expected to be a dedicated prefix (its node_modules is exactly the closure).
    $rc = Start-Process -FilePath "robocopy" -ArgumentList @(
      (Join-Path $RuntimeSource "node_modules"), (Join-Path $rt "node_modules"),
      "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1"
    ) -Wait -PassThru -NoNewWindow
    if ($rc.ExitCode -ge 8) { throw "robocopy (node_modules) failed with exit code $($rc.ExitCode)" }
  } else {
    New-Item -ItemType Directory -Force -Path (Join-Path $rt "node_modules\@deepseek-ai") | Out-Null
    $rc = Start-Process -FilePath "robocopy" -ArgumentList @(
      $dshTree, (Join-Path $rt "node_modules\@deepseek-ai\dsh"),
      "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1"
    ) -Wait -PassThru -NoNewWindow
    if ($rc.ExitCode -ge 8) { throw "robocopy (harness tree) failed with exit code $($rc.ExitCode)" }
  }
  Ok "harness staged ($([math]::Round((DirSize (Join-Path $rt 'node_modules'))/1MB,1)) MB, $((Get-ChildItem (Join-Path $rt 'node_modules') -Recurse -File | Measure-Object).Count) files)"

  # GATE: the packaged runtime must actually load the harness. A layout mistake
  # (missing hoisted deps) fails here instead of shipping a broken release.
  # Strict check: exit code 0 AND the first output line is exactly the version
  # (matching the version anywhere in the output is not enough - the staging path
  # itself contains the version string, which once let an error stack pass).
  $rtEntry = Join-Path $rt "node_modules\@deepseek-ai\dsh\lib\bin.js"
  if (-not (Test-Path $rtEntry)) { throw "staged runtime is missing $rtEntry" }
  $probeRaw = (& (Join-Path $rt "node.exe") $rtEntry --version 2>&1 | Out-String)
  $probeExit = $LASTEXITCODE
  $probeFirst = (($probeRaw -split "`r?`n") | Where-Object { $_.Trim() -ne "" } | Select-Object -First 1)
  if ($null -eq $probeFirst) { $probeFirst = "" }
  $probeFirst = $probeFirst.Trim()
  if ($probeExit -ne 0 -or $probeFirst -ne $DshVersion) {
    throw ("staged runtime is NOT runnable (exit=$probeExit, first line='$probeFirst', expected='$DshVersion'). " +
      "Check -RuntimeMode / -RuntimeSource: hoisted layouts need -RuntimeMode full-node-modules.")
  }
  Ok "runtime self-check passed: bundled dsh reports $probeFirst"
  $global:LASTEXITCODE = 0

  # Bundle npm as well, so the portable shell can self-update into its own runtime
  # (same user-visible behaviour as the script install: check the registry, fetch
  # the newer harness, ask for a restart). npm is ~11 MB and is driven directly by
  # the bundled node: node runtime\node_modules\npm\bin\npm-cli.js ...
  if (-not $NoNpm) {
    $npmSrc = Join-Path (Split-Path $NodeExe -Parent) "node_modules\npm"
    if (-not (Test-Path $npmSrc)) {
      # Hard failure on purpose: a package without npm silently loses the
      # self-update capability that the release promises (this shipped once,
      # 2026-09-20 - the CI only copied node.exe, so the packer skipped npm).
      throw "npm not found at $npmSrc - the package could not self-update. Stage npm next to node.exe, or pass -NoNpm to opt out explicitly."
    }
    $rc = Start-Process -FilePath "robocopy" -ArgumentList @(
      $npmSrc, (Join-Path $rt "node_modules\npm"),
      "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1"
    ) -Wait -PassThru -NoNewWindow
    if ($rc.ExitCode -ge 8) { throw "robocopy (npm) failed with exit code $($rc.ExitCode)" }
    $npmProbeRaw = (& (Join-Path $rt "node.exe") (Join-Path $rt "node_modules\npm\bin\npm-cli.js") --version 2>&1 | Out-String)
    $npmProbeExit = $LASTEXITCODE
    $npmProbe = (($npmProbeRaw -split "`r?`n") | Where-Object { $_.Trim() -ne "" } | Select-Object -First 1)
    if ($npmProbeExit -ne 0 -or -not ("$npmProbe".Trim() -match '^\d+\.\d+\.\d+')) {
      throw "bundled npm is not runnable (exit=$npmProbeExit, first line='$npmProbe')"
    }
    Ok "npm bundled and runnable ($($npmProbe.Trim()), $([math]::Round((DirSize (Join-Path $rt 'node_modules\npm'))/1MB,1)) MB)"
    $global:LASTEXITCODE = 0
  } else {
    Warn "npm not bundled (-NoNpm): the portable shell will not self-update"
  }

  # Ship the whole runtime as ONE file. Copying an unpacked package means copying
  # ~27k tiny files (89% under 8 KB), which on Windows costs ~89 s with a
  # single-threaded copy vs ~14 s multithreaded - and much more over USB/network.
  # runtime.zip is extracted by the shell on first start (see HANDOVER §27.11).
  if (-not $NoRuntimeArchive) {
    $rtArchive = Join-Path $pkgDir "runtime.zip"
    if (Test-Path $rtArchive) { Remove-Item $rtArchive -Force }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    & tar.exe -a -cf $rtArchive -C $rt .
    if ($LASTEXITCODE -ne 0) { throw "tar (runtime.zip) failed with exit code $LASTEXITCODE" }
    $entries = @(& tar.exe -tf $rtArchive)
    if (-not ($entries | Where-Object { $_ -match 'node_modules[/\\]@deepseek-ai[/\\]dsh[/\\]lib[/\\]bin\.js$' })) {
      throw "runtime.zip does not contain the dsh entry - refusing to ship it"
    }
    if (-not $NoNpm -and -not ($entries | Where-Object { $_ -match 'node_modules[/\\]npm[/\\]bin[/\\]npm-cli\.js$' })) {
      throw "runtime.zip does not contain npm - refusing to ship it"
    }
    Ok "runtime.zip written in $([math]::Round($sw.Elapsed.TotalSeconds,1))s ($([math]::Round((Get-Item $rtArchive).Length/1MB,1)) MB, $($entries.Count) entries)"
    Remove-Item $rt -Recurse -Force
    Ok "runtime directory replaced by the single-file archive (first start unpacks it)"
  } else {
    Warn "runtime kept as a directory (-NoRuntimeArchive): slow to copy, shell extracts nothing"
  }
}

$pluginsSrc = Join-Path $repoRoot "plugins"
$pluginsDst = Join-Path $pkgDir "plugins"
New-Item -ItemType Directory -Force -Path $pluginsDst | Out-Null
Get-ChildItem $pluginsSrc -Directory | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $pluginsDst $_.Name) -Recurse -Force
}
$pluginCount = (Get-ChildItem $pluginsDst -Directory | Measure-Object).Count
Ok "$pluginCount plugin package(s) staged"

New-Item -ItemType Directory -Force -Path (Join-Path $pkgDir "scripts") | Out-Null
Copy-Item (Join-Path $repoRoot "scripts\setup-plugins.mjs") (Join-Path $pkgDir "scripts\setup-plugins.mjs") -Force
Copy-Item (Join-Path $repoRoot "install-offline.ps1") (Join-Path $pkgDir "install-offline.ps1") -Force
Copy-Item (Join-Path $repoRoot "install-offline.cmd") (Join-Path $pkgDir "install-offline.cmd") -Force
# The standalone updater: refresh the plugins ALREADY installed in a DSH home
# (content-hash based, with backup + rollback) without running the full installer.
Copy-Item (Join-Path $repoRoot "scripts\update-plugins.ps1") (Join-Path $pkgDir "update-plugins.ps1") -Force
Copy-Item (Join-Path $repoRoot "scripts\update-plugins.cmd") (Join-Path $pkgDir "update-plugins.cmd") -Force
Ok "installer (install-offline.ps1 + .cmd wrapper) + update-plugins.ps1/.cmd + setup-plugins.mjs staged"

# --- metadata -----------------------------------------------------------------
Step "2/4 writing VERSION.txt / README.txt"
$versionText = @"
dsh-desktop portable release
package:   $pkgName
built:     $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
shell:     commit $ShellVersion (from $repoRoot)
harness:   @deepseek-ai/dsh $DshVersion (bundled, offline)
node:      $(if ($NoNode) { 'not bundled' } else { "$nodeVersion (bundled)" })
npm:       $(if ($NoNode -or $NoNpm) { 'not bundled (no self-update)' } else { 'bundled (enables in-package self-update)' })
plugins:   $pluginCount package(s)
port:      43080 (fixed; bare URL answers 401 until the token URL is opened)
contents:  dsh-desktop.exe, runtime.zip (unpacked on first start), plugins\, scripts\, install-offline.ps1 (+ .cmd wrapper)
"@
Set-Content -Path (Join-Path $pkgDir "VERSION.txt") -Value $versionText -Encoding utf8

# Plugin descriptions come from scripts/setup-plugins.mjs --describe (single
# source of truth, shared with the installer menu and the repo README).
$catalogueText = ""
try {
  $describeNode = if (Test-Path $NodeExe) { $NodeExe } else { "node" }
  $rawCatalogue = (& $describeNode (Join-Path $repoRoot "scripts\setup-plugins.mjs") --describe --ascii 2>$null | Out-String)
  if ($LASTEXITCODE -eq 0 -and $rawCatalogue.Trim()) {
    # 5.1 hands back the JSON array as ONE object, 7 enumerates it; normalize so the
    # generated README.txt keeps its per-plugin descriptions on both engines (§34).
    $catalogue = @($rawCatalogue | ConvertFrom-Json) | ForEach-Object { $_ }
    $catalogueText = (($catalogue | ForEach-Object {
      "  {0}) {1}" -f $_.index, $_.short
      "       $($_.title) - $($_.summary)"
      if ($_.where) { "       位置：$($_.where)" }
    }) -join "`r`n")
    $global:LASTEXITCODE = 0
  }
} catch { $catalogueText = "" }
if (-not $catalogueText) { $catalogueText = "  (run: node scripts\setup-plugins.mjs --describe)" }

# SINGLE-quoted here-string on purpose: this text is full of `$` and backticks that
# the user must SEE (`$DSH_HOME`, `tar -xf`). Inside a double-quoted here-string
# PowerShell interpolates/escapes them first, which silently produced two real bugs
# until 2026-09-23: "`tar" became a TAB, and "$DSH_HOME" vanished (undefined here).
# Values are substituted through placeholders instead (HANDOVER §37).
$readmeText = @'
dsh-desktop 便携发行包（__PKG__）
=================================

本包自带全部依赖：目标机不需要 Node.js、npm、Go 或 Wails。
没有安装步骤 —— 解压即用。

快速开始
--------
1. 解压到任意目录（例如 D:\dsh-desktop-portable）。
2. 运行该目录下的 dsh-desktop.exe。
   首次启动会先把内置运行时解开（runtime.zip -> runtime\，约 30-60 秒，只此一次；
   状态面板会显示进度），之后就快了。随后它会在浏览器里打开 Web UI。

本包怎么拷贝
------------
运行时故意做成单文件（runtime.zip）：解开后是约 2.7 万个碎文件，在 Windows 上拷贝它们
要按文件数交税，动辄几分钟。所以：
  * 搬 ZIP，别搬解开后的目录；或者
  * 必须拷目录时用多线程 robocopy（碎文件下快好几倍）：
      robocopy <源> <目标> /E /MT:16 /NFL /NDL /NJH /NJS /NP /R:1 /W:1
  * 解压用 tar -xf <包>.zip -C <目录>（Win10+ 自带）或 7-Zip；
    资源管理器的「全部解压缩」是最慢的。

可选：把自定义插件装进你的 DSH home
-----------------------------------
本包自带这些插件（全部可选，都是界面增强）：

__CATALOGUE__

双击 install-offline.cmd          （推荐；它会列出上面的说明并问你要装哪些）
   或： powershell -ExecutionPolicy Bypass -File install-offline.ps1
        -Plugins all | none | ask | 2,4 | explainer,project-explorer
        编号就是上面列的那些；多个用逗号隔开（如 2,4）。
        输入无效则什么都不装（不会替你猜）。
        -CheckOnly 只列出插件与将要发生的事，不写任何东西。
        -SkipPlugins 完全跳过这一步。

它把选中的插件复制到 %USERPROFILE%\.dsh，并把条目加进 profile 的 patch 文件。
这里只加不减：已装好的插件不会被移除，安装器只添加/更新你选的那些。
用 -DSHome <目录> 指定别的 DSH home；用 -AppDir <目录> 顺带把壳复制到应用目录。

以后更新插件（已装过的机器）
----------------------------
双击 update-plugins.cmd    （或：powershell -ExecutionPolicy Bypass -File update-plugins.ps1）
它按内容哈希（不是版本号）比较包内副本与已装副本，只重写真正变了的东西：

    update-plugins.cmd                     # 更新"已经装了"的插件
    update-plugins.cmd -CheckOnly           # 只报告：已是最新 / 待更新 / 未安装
    update-plugins.cmd -Plugins all         # 连没装的也一起装齐
    update-plugins.cmd -Plugins 2,4         # 按编号多选（编号同上）
    update-plugins.cmd -DSHome <目录>       # 指定别的 DSH home
    update-plugins.cmd --which-shell        # 打印它会用哪个 PowerShell

用哪个 PowerShell
-----------------
.cmd 包装器优先 PowerShell 7（先找标准安装位置，再找 PATH 上的 pwsh），都没有才退回
Windows PowerShell 5.1。注意 "powershell" 永远是 5.1（PowerShell 7 只提供 pwsh.exe），
所以手敲命令要用 pwsh 才是 7.x。这里的一切在 5.1 上也能用；想知道双击实际会跑哪个：

    install-offline.cmd --which-shell      （或 update-plugins.cmd --which-shell）

覆盖前它会先备份旧副本；如果新副本校验不过，会自动恢复旧副本（那种情况下备份目录会
保留供你检查）。改完插件要完全重启壳才生效。

运行要求
--------
* Windows 10/11 且带 WebView2 Runtime（Windows 一般自带；若窗口一片空白，装一下
  "Microsoft Edge WebView2 Runtime"）。
* 没别的了。包内 runtime\ 自带 Node.js 与 harness。

注意事项
--------
* 请保持目录结构 —— 壳会在 exe 同级解析 runtime\（或 runtime.zip）。首次启动后删掉
  runtime.zip 是安全的（那时 runtime\ 已经存在），但想保留一个"单文件可拷"的包就别删。
* 壳每个用户单实例：如果已经有另一个 dsh-desktop 在跑（安装版或更早的便携版），
  这个会直接退出并只把那个窗口显示出来。要在安装版旁边试便携版时先关掉它。
* 不包含任何 API Key / .env：每台机器自己配。
* 未签名构建：首次运行 Windows SmartScreen 可能提示（「更多信息」→「仍要运行」）。
* 插件改动需要完全重启壳才生效（只刷新浏览器无效）。
* 端口固定 43080；裸访问 http://127.0.0.1:43080/ 返回 401 是设计如此。
* 日志：%APPDATA%\dsh-desktop\（dsh.log、debug.log；分别在 5 MiB / 1 MiB 轮转）。
* 仅首次启动：dsh-desktop.exe --extract-runtime 只解开运行时不打开窗口（便于脚本化）。

更新
----
壳在启动时以及每 24 小时查一次 npm registry —— 与源码/脚本安装完全一致 —— 并用包内 npm
下载更新的 harness。新版先装进暂存目录，下次启动才换入（「检查更新」→ 重启生效），
所以 dsh 运行中不会被替换。你也可以随时把新版包解压覆盖到本目录；你的 DSH home
（$DSH_HOME，默认 %USERPROFILE%\.dsh：会话、配置、插件）是单独存放的，不受影响。
'@
$readmeText = $readmeText.Replace('__PKG__', $pkgName).Replace('__CATALOGUE__', $catalogueText)
# Write with an explicit UTF-8 BOM: `Set-Content -Encoding utf8` is BOM-less on
# PowerShell 7, and a BOM-less UTF-8 Chinese .txt shows as mojibake in legacy Notepad.
[IO.File]::WriteAllText((Join-Path $pkgDir "README.txt"), $readmeText, (New-Object Text.UTF8Encoding($true)))
Ok "metadata written"

# --- zip ----------------------------------------------------------------------
Step "3/4 zipping"
if ($SkipZip) {
  Warn "zip skipped (-SkipZip); staged at $pkgDir"
} else {
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  & tar.exe -a -cf $zipPath -C $staging $pkgName
  if ($LASTEXITCODE -ne 0) { throw "tar failed with exit code $LASTEXITCODE" }
  Ok "zip written in $([math]::Round($sw.Elapsed.TotalSeconds,1))s: $zipPath ($([math]::Round((Get-Item $zipPath).Length/1MB,1)) MB)"
}

Step "4/4 checksums"
$rawSize = DirSize $pkgDir
if (-not $SkipZip) {
  $hash = (Get-FileHash $zipPath -Algorithm SHA256).Hash
  $sums = Join-Path $OutDir "SHA256SUMS.txt"
  "$hash  $pkgName.zip" | Set-Content -Path $sums -Encoding ascii
  Ok "SHA256 -> $sums"

  # Keep exactly ONE release package in the output folder (this build), so that
  # folder is always "the latest official build to copy" - see HANDOVER §32.
  if (-not $KeepOldPackages) {
    Get-ChildItem $OutDir -File -Filter "dsh-desktop-*.zip" |
      Where-Object { $_.FullName -ne (Get-Item $zipPath).FullName } |
      ForEach-Object { Remove-Item $_.FullName -Force; Ok "removed older package $($_.Name)" }
  }
  $latest = Join-Path $OutDir "LATEST.txt"
  @(
    "dsh-desktop portable release - latest local copy"
    "file    : $pkgName.zip"
    "version : $ShellVersion (harness @deepseek-ai/dsh $DshVersion)"
    "built   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    "size    : $([math]::Round((Get-Item $zipPath).Length/1MB,1)) MB"
    "sha256  : $hash"
    ""
    "Copy THIS zip to another machine, then unzip it and run dsh-desktop.exe."
    "(the output folder keeps only the newest package; -KeepOldPackages disables pruning)"
  ) | Set-Content -Path $latest -Encoding utf8
  Ok "LATEST.txt -> $latest"
}
Write-Host ""
Write-Host "package : $pkgName"
Write-Host "raw     : $([math]::Round($rawSize/1MB,1)) MB ($((Get-ChildItem $pkgDir -Recurse -File | Measure-Object).Count) files)"
if (-not $SkipZip) { Write-Host "zipped  : $([math]::Round((Get-Item $zipPath).Length/1MB,1)) MB" }

if (-not $KeepStaging) {
  Remove-Item $pkgDir -Recurse -Force
  Ok "staging removed (use -KeepStaging to inspect)"
} else {
  Warn "staging kept at $pkgDir"
}
