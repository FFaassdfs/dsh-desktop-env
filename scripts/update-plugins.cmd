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
set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-plugins.ps1" %*
echo.
pause
