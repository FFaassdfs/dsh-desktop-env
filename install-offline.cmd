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
set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"

REM Ask only when the caller did not already choose.
set "ASK=-Plugins ask"
echo %* | findstr /i /c:"-Plugins" >nul && set "ASK="

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-offline.ps1" %ASK% %*
echo.
pause
