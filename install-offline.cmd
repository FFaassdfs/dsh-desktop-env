@echo off
REM Double-click wrapper for install-offline.ps1.
REM
REM The portable package does NOT need an install step: unzip it and run
REM dsh-desktop.exe. Running this script is only useful if you want the bundled
REM custom plugins copied into your DSH home (%USERPROFILE%\.dsh) first.
REM
REM It exists because Windows does not execute .ps1 files on double-click and
REM because the default execution policy may block the script.
REM
REM Double-clicking asks which plugins to install (all / pick / none).
REM Pass your own -Plugins argument to skip the question, e.g.:
REM   install-offline.cmd -Plugins none
REM   install-offline.cmd -Plugins explainer,core-version
setlocal
REM Pick the engine the same way DSH itself does: the standard PowerShell 7
REM install location first, then whatever `pwsh` resolves to on PATH, then
REM Windows PowerShell 5.1 as the system fallback.
REM NOTE: `powershell` is ALWAYS 5.1 -- PowerShell 7 ships as pwsh.exe only --
REM so the name alone decides which engine runs. Checking the install location
REM explicitly also covers a PATH that is stale (a cmd window opened before PS7
REM was installed does not see the new PATH entry).
set "PS=powershell"
if exist "%ProgramW6432%\PowerShell\7\pwsh.exe" set "PS=%ProgramW6432%\PowerShell\7\pwsh.exe"
if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "PS=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not "%PS%"=="powershell" goto :ps_resolved
where pwsh >nul 2>nul && set "PS=pwsh"
:ps_resolved

REM `install-offline.cmd --which-shell` prints the engine this wrapper would use
REM and exits. Useful when a machine has both 5.1 and 7 installed.
if /i "%~1"=="--which-shell" (
  echo %PS%
  exit /b 0
)

REM Ask only when the caller did not already choose.
set "ASK=-Plugins ask"
echo %* | findstr /i /c:"-Plugins" >nul && set "ASK="

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-offline.ps1" %ASK% %*
echo.
pause
