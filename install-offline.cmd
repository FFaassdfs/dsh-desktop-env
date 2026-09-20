@echo off
REM Double-click wrapper for install-offline.ps1.
REM
REM The portable package does NOT need an install step: unzip it and run
REM dsh-desktop.exe. Running this script is only useful if you want the 4 custom
REM plugins copied into your DSH home (%USERPROFILE%\.dsh) first.
REM
REM It exists because Windows does not execute .ps1 files on double-click and
REM because the default execution policy may block the script - this wrapper
REM runs it with -ExecutionPolicy Bypass.
setlocal
set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-offline.ps1" %*
echo.
pause
