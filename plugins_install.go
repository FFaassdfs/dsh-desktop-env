package main

import (
	"os"
	"path/filepath"
)

// 「安装预置插件」——壳只负责把发行包里那个安装器**跑起来**，成败不判断。
//
// 为什么不自己在壳里实现安装：
//
//	install-offline.ps1 / .cmd 已经解决了全部兼容性问题（PS7/5.1 四级引擎解析、
//	控制台代码页与 BOM、编号多选、无效即不装、包内 node 定位——见 HANDOVER
//	§28/§34）。壳再实现一遍就是第二套可能不一致的逻辑，违反本项目的「单一事实源」
//	原则。所以这里刻意**不做**插件清单解析、不做状态判断、不做参数拼装。
//
// 为什么跑 .ps1 而不是 .cmd：.cmd 末尾有 `pause`（双击时留住窗口），由壳启动会
// 永远等不到进程退出；.ps1 不带 pause，且 --which-shell 之类的引擎选择我们只
// 需要「能跑就行」。两者用同一份 .ps1，行为一致。

// installerEnvOverride 允许显式指定安装器路径（也便于测试）。
const installerEnvOverride = "DSH_DESKTOP_INSTALLER"

// installerName 是发行包根目录里的安装脚本。
const installerName = "install-offline.ps1"

// installerCandidates 列出可能放着安装器的脚本路径，最具体的在前。
// 只看 exe 同级——便携包就是「解压即用、所有东西在 exe 旁边」的布局；
// 源码装的使用者本来就是开发者，自己跑一条命令比点按钮快，不必猜仓库位置。
func installerCandidates(exeDir string, env func(string) string) []string {
	out := make([]string, 0, 2)
	if env != nil {
		if v := trimSpace(env(installerEnvOverride)); v != "" {
			out = append(out, v)
		}
	}
	if exeDir != "" {
		out = append(out, filepath.Join(exeDir, installerName))
	}
	return out
}

// findInstaller 返回第一个存在的安装器路径（"" 表示本机没有，面板据此隐藏按钮）。
func findInstaller(dirs []string) string {
	for _, p := range dirs {
		if fileExists(p) {
			return p
		}
	}
	return ""
}

// installerPathForThisExe 是壳实际使用的解析入口。
func installerPathForThisExe() string {
	return findInstaller(installerCandidates(executableDir(), os.Getenv))
}

// powershellCandidates 返回用于执行 .ps1 的引擎，按偏好排序。
//
// 与 install-offline.cmd 里的四级顺序保持一致的**结果**（PS7 优先、5.1 兜底），
// 但这里刻意只做最简单的事：壳只要求「能把脚本跑起来」。真正的兼容性由脚本
// 自己负责（它已经钉了 [Console]::OutputEncoding 并规避了 5.1 的 JSON 陷阱，
// 见 HANDOVER §34），所以用哪个引擎都不会跑错。
//
// 注意：PowerShell 7 只提供 pwsh.exe；`powershell` 永远是 5.1。
func powershellCandidates(env func(string) string) []string {
	out := make([]string, 0, 3)
	if env != nil {
		if v := trimSpace(env("ProgramW6432")); v != "" {
			out = append(out, filepath.Join(v, "PowerShell", "7", "pwsh.exe"))
		}
		if v := trimSpace(env("ProgramFiles")); v != "" {
			out = append(out, filepath.Join(v, "PowerShell", "7", "pwsh.exe"))
		}
	}
	// 最后才用系统自带的 5.1：它一定存在，且脚本对 5.1 已做过适配。
	return append(out, "powershell.exe")
}

// firstExistingExecutable 返回第一个真实存在的引擎；都不存在时退回最后一个
// 候选（"powershell.exe"），让 exec 自己去 PATH 里找。
func firstExistingExecutable(candidates []string) string {
	for _, c := range candidates {
		if fileExists(c) {
			return c
		}
	}
	if len(candidates) == 0 {
		return "powershell.exe"
	}
	return candidates[len(candidates)-1]
}

// trimSpace 是 strings.TrimSpace 的一层薄封装，单独抽出来是为了让
// installerCandidates / powershellCandidates 保持「不引入 strings」的纯粹性。
func trimSpace(s string) string {
	start, end := 0, len(s)
	for start < end && isSpace(s[start]) {
		start++
	}
	for end > start && isSpace(s[end-1]) {
		end--
	}
	return s[start:end]
}

func isSpace(b byte) bool {
	return b == ' ' || b == '\t' || b == '\n' || b == '\r'
}
