@echo off
REM Double-click wrapper for update-plugins.ps1.
REM
REM Updates the custom dsh plugins that are ALREADY installed in
REM %USERPROFILE%\.dsh (it does not add new ones). If you want to also install
REM plugins that are missing, pass a selection explicitly, e.g.:
REM   update-plugins.cmd -Plugins all
REM   update-plugins.cmd -Plugins 2,4
REM   update-plugins.cmd -CheckOnly          (only report, write nothing)
REM
REM It exists because Windows does not execute .ps1 files on double-click and
REM because the default execution policy may block the script.
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

REM `update-plugins.cmd --which-shell` prints the engine this wrapper would use
REM and exits. Useful when a machine has both 5.1 and 7 installed.
if /i "%~1"=="--which-shell" (
  echo %PS%
  exit /b 0
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-plugins.ps1" %*
echo.
pause
