# OPENCODE_PROMPT.md — 发给家里 opencode 的部署指令

## 用法

在家里电脑打开 opencode，把下方「部署指令」整段复制粘贴给它即可。
（无需先 clone——指令里包含 clone 步骤；opencode 会自己拉取仓库并读 `DEPLOY.md` 执行。）

## 部署指令（复制以下整段）

你是一个 Windows 部署助手。请在【本机】把 DeepSeek Harness 桌面环境部署到位。

1. 获取代码：
   - 若 `D:\dsh-desktop` 不存在：`git clone https://github.com/FFaassdfs/dsh-desktop-env.git D:\dsh-desktop`
   - 若已存在：`cd D:\dsh-desktop` 后 `git pull`
2. 阅读 `D:\dsh-desktop\DEPLOY.md`，严格按其中 §0–§6 执行：
   - 逐项检查工具链（Git / Node.js / PowerShell / 可选 Go+Wails），缺失的按 §3 用 winget 或 go install 安装
   - 依赖就绪后运行：`pwsh -File D:\dsh-desktop\deploy.ps1 -HarnessVersion 0.1.0-rc.7`
     （没有 pwsh 就用 `powershell -File ...`；本机不想装桌面壳就加 `-SkipDesktopBuild` 并在汇报中说明）
3. 约束：
   - 全程使用 PowerShell；命令失败先查 DEPLOY.md §7 故障排查，同一问题最多重试 2 次，仍失败就停下向我汇报，不要擅自改方案
   - **不要配置任何 API key / 凭据**——部署完成后提示我手动配置
   - 不要修改仓库源码，只按文档执行
4. 完成后按 DEPLOY.md §6 验收清单逐项自检，向我汇报：
   - 装了哪些工具、`dsh --version` 结果
   - 插件是否生效（Web UI「设置 → 插件」有「插件说明」tab；页面右侧有「项目文件」面板）
   - 桌面壳是否构建成功（若未构建说明原因）
   - 遗留的待办（如需要我手动配 API key）

## 预期结果（自检）

- `dsh --version` = `0.1.0-rc.7`
- 两个自定义插件已装入 `%USERPROFILE%\.dsh\profiles\node_modules`，且 `cordis.patch.yml` 含 `plugin-explainer`、`plugin-project-explorer` 两条目（可运行 `node D:\dsh-desktop\scripts\setup-plugins.mjs --check-only` 验证，末尾应输出 `CHECK ONLY — nothing written. Looks good.`）
- 全局预设已安装：`Test-Path $env:USERPROFILE\.dsh\AGENTS.md` 为 True（部署时自动安装，含通用避坑经验）
- （可选）`D:\dsh-desktop\build\bin\dsh-desktop.exe` 可启动
