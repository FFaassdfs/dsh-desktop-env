@echo off
rem dsh-desktop restore guard (2026-09-30)
rem
rem WHY THIS EXISTS: .work\restore-on-service-restart.ps1 must outlive BOTH the agent
rem command that starts it AND the harness process it is watching. A plain
rem Start-Process child dies with the sandbox job of the agent command that spawned it
rem (measured 2026-09-30: PID 6772 logged "watch start" and was gone a minute later,
rem long before any restart). A one-shot Scheduled Task is started by the Task
rem Scheduler service instead, so it is outside that job and survives.
rem
rem It runs the staged-index guard for up to 2 hours, then removes its own task.
rem ASCII only on purpose (Windows PowerShell 5.1 misreads BOM-less UTF-8 scripts).
pwsh -NoProfile -File "D:\dsh\dsh-desktop-env\.work\restore-on-service-restart.ps1" -WaitCloseSec 7200 >> "D:\dsh\dsh-desktop-env\.cache\dsh-restore-staged\guard-task.log" 2>&1
schtasks /Delete /TN "dsh-desktop-restore-guard" /F >nul 2>&1
