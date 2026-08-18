# Best-effort helper: raise the freshly opened File Explorer window to the
# foreground. Windows keeps windows spawned by background processes behind the
# current foreground app (foreground lock / focus-stealing prevention), so a
# plain `explorer.exe <path>` opens in the background. This helper finds the
# new Explorer window (class CabinetWClass, title contains the folder name)
# and uses the Alt-key trick (simulated key press) to bypass the lock, then
# SetForegroundWindow. Failures are silently ignored — worst case the window
# stays in the background, exactly as without this helper.
#
# PowerShell 5.1 compatible (no ??, no string.Contains(StringComparison)).
param(
    [Parameter(Mandatory = $true)][string]$FolderName
)
$ErrorActionPreference = "SilentlyContinue"

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ExplorerFront {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@

# Poll up to ~3s for the new window. FindWindowEx enumerates topmost-first, so
# the first visible CabinetWClass window whose title contains the folder name
# is the freshly opened one in practice.
$target = [IntPtr]::Zero
for ($i = 0; $i -lt 20 -and $target -eq [IntPtr]::Zero; $i++) {
    $hwnd = [IntPtr]::Zero
    while ($true) {
        $hwnd = [ExplorerFront]::FindWindowEx([IntPtr]::Zero, $hwnd, "CabinetWClass", $null)
        if ($hwnd -eq [IntPtr]::Zero) { break }
        if (-not [ExplorerFront]::IsWindowVisible($hwnd)) { continue }
        $sb = New-Object System.Text.StringBuilder 512
        [void][ExplorerFront]::GetWindowText($hwnd, $sb, 512)
        if ($sb.ToString().IndexOf($FolderName, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            $target = $hwnd
            break
        }
    }
    if ($target -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 150 }
}

if ($target -ne [IntPtr]::Zero) {
    # Alt key down+up makes the system treat this as user input, releasing the
    # foreground lock; then the new Explorer window can take focus.
    [ExplorerFront]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
    [ExplorerFront]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
    [void][ExplorerFront]::SetForegroundWindow($target)
}
