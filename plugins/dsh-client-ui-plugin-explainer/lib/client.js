window.__ModuleLoader__.load({
	id: "dsh-client-ui-plugin-explainer",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region css
		const css = ".pEx_section{width:100%;max-width:860px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;display:flex}.pEx_status,.pEx_summary,.pEx_explainText,.pEx_failure p{margin:0}.pEx_status,.pEx_summary,.pEx_explainText{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}.pEx_failure{color:var(--dsw-alias-state-error-primary);align-items:center;gap:10px;display:flex}.pEx_failure button{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:4px 10px}.pEx_catalog{flex-direction:column;gap:12px;display:flex}.pEx_search{width:100%;color:var(--dsw-alias-label-tertiary);align-items:center;display:flex;position:relative}.pEx_search>svg{pointer-events:none;position:absolute;left:12px}.pEx_search input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;height:36px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;outline:none;padding:0 34px 0 36px;font-size:13px}.pEx_search input::placeholder{color:var(--dsw-alias-label-tertiary)}.pEx_search input:focus-visible{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent)}.pEx_summary{align-items:center;gap:7px;padding:0 2px;display:flex;font-variant-numeric:tabular-nums}.pEx_heading{align-items:baseline;gap:7px;padding:0 2px;display:flex}.pEx_heading h3{margin:0;font-size:13px;font-weight:600;line-height:20px}.pEx_heading span{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-size:12px;line-height:18px}.pEx_cards{flex-direction:column;gap:10px;margin:0;padding:0;list-style:none;display:flex}.pEx_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;min-width:0;overflow:hidden}.pEx_card[data-open=true]{border-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-shadow-lv1)}.pEx_cardHeader{width:100%;align-items:stretch;display:flex}.pEx_expand{flex:1;min-width:0;border:0;background:0 0;color:inherit;font:inherit;align-items:center;gap:10px;padding:10px 14px;display:flex;text-align:left;cursor:pointer}.pEx_expand:hover{background:var(--dsw-alias-bg-layer-4)}.pEx_cardTitle{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:600;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pEx_cardTrailing{flex:none;align-items:center;gap:8px;display:inline-flex}.pEx_statusDot{width:8px;height:8px;border-radius:50%;flex:none}.pEx_statusDot[data-phase=active]{background:var(--dsw-alias-state-success-primary)}.pEx_statusDot[data-phase=loading],.pEx_statusDot[data-phase=pending]{background:var(--dsw-alias-state-warning-primary)}.pEx_statusDot[data-phase=failed]{background:var(--dsw-alias-state-error-primary)}.pEx_statusDot[data-phase=unloading],.pEx_statusDot[data-phase=unobserved]{background:var(--dsw-alias-label-tertiary)}.pEx_tag{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.pEx_tag[data-enabled=false]{color:var(--dsw-alias-label-tertiary)}.pEx_chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .15s ease}.pEx_card[data-open=true] .pEx_chevron{transform:rotate(180deg)}.pEx_explain{padding:0 14px 10px}.pEx_explainText{font-size:13px;line-height:20px}.pEx_unexplained{font-style:italic}.pEx_cardDetails{border-top:1px solid var(--dsw-alias-border-l2);flex-direction:column;gap:8px;padding:10px 14px;display:flex}.pEx_entryValue{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-radius:6px;padding:2px 8px;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:12px;line-height:20px;overflow-wrap:anywhere}.pEx_details{margin:0;gap:4px 16px;display:grid;grid-template-columns:auto 1fr}.pEx_details div{min-width:0;display:contents}.pEx_details dt{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px}.pEx_details dd{margin:0;color:var(--dsw-alias-label-primary);font-size:12px;line-height:20px;overflow-wrap:anywhere}.pEx_visuallyHidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;clip:rect(0 0 0 0);overflow:hidden;white-space:nowrap}.pEx_notice{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-radius:8px;align-items:center;gap:8px;padding:8px 12px;display:flex;font-size:12px;line-height:18px}.pEx_switch{position:relative;flex:none;width:32px;height:18px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);cursor:pointer;padding:0;transition:background .15s ease}.pEx_switch[aria-checked=true]{background:var(--dsw-alias-state-success-primary);border-color:transparent}.pEx_switch:disabled{opacity:.45;cursor:not-allowed}.pEx_switchKnob{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .15s ease}.pEx_switch[aria-checked=true] .pEx_switchKnob{transform:translateX(14px);background:#fff}.pEx_pendingTag{white-space:nowrap;background:var(--dsw-alias-state-warning-primary);color:#fff;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.pEx_refresh{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0;border-radius:6px;padding:2px 10px;font:inherit;font-size:12px;line-height:20px;cursor:pointer}.pEx_refresh:hover{color:var(--dsw-alias-label-primary)}";
		const tagId = "dsh-client-ui-plugin-explainer/main.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-client-ui-plugin-explainer";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region dictionary
		const DICTIONARY = {"cordis:include":"加载 profile 配置里 include 进来的外部配置文件（配置组合基础设施）","@deepseek-ai/cordis-plugin-timer":"定时器服务：为整个系统提供定时/延时任务能力（基础设施）","@deepseek-ai/cordis-plugin-hmr":"热更新插件：开发模式下文件变更自动重载（生产环境停用）","@deepseek-ai/dsh-llm":"大模型统一接口：所有模型提供者的抽象层（基础设施）","@deepseek-ai/dsh-session":"会话存储：对话与事件日志的源头（基础设施）","@deepseek-ai/dsh-typert-registry":"类型反射注册表：RPC 协议的类型元数据（基础设施）","@deepseek-ai/dsh-typert-loader":"生成代码的加载器集成：让 RPC 远端定义可用（基础设施）","@deepseek-ai/dsh-api-gateway":"API 网关：分发前端与宿主之间的 RPC 调用（基础设施）","@deepseek-ai/dsh-session-title":"会话标题服务：管理会话标题的生成与存储","@deepseek-ai/dsh-session-title-first-prompt-llm":"标题生成器：用第一条消息 + LLM 自动起会话标题","@deepseek-ai/dsh-user-questions":"用户提问接口：agent 运行中向人类提问的抽象层","@deepseek-ai/dsh-agent":"Agent 核心：代理接口、注册表与事件体系（基础设施）","@deepseek-ai/dsh-agent-default-model":"默认模型选择：新建 Agent 时使用的默认模型","@deepseek-ai/dsh-jobs-local":"后台任务：长任务注册表（轮询/取消/完成通知，本地实现）","@deepseek-ai/dsh-llm-retry":"LLM 重试策略：模型请求失败时按提供者路由重试","@deepseek-ai/dsh-settings-file":"用户设置：读写 $DSH_HOME/settings.yaml（热更新）","@deepseek-ai/dsh-credentials-local":"凭据管理：API Key 等密钥（.credentials.yaml + 环境变量）","@deepseek-ai/dsh-llm-pi-ai":"备用模型适配器（pi-ai）：默认休眠，配置了提供者才启用","@deepseek-ai/dsh-session-persistence-jsonl":"会话持久化：把对话日志写入 JSONL 文件","@deepseek-ai/dsh-attachment-local":"附件存储：图片等二进制内容的内容寻址存储","@deepseek-ai/dsh-session-query-sqlite":"会话查询：按条件读取/搜索历史（SQLite，默认内存模式）","@deepseek-ai/dsh-session-projection":"会话投影：从日志派生的当前状态视图（基础设施）","@deepseek-ai/dsh-session-telemetry-otel":"遥测上报：会话数据交给 OpenTelemetry 管道（可关）","@deepseek-ai/dsh-subprocess-local":"子进程管理：运行外部程序（本地实现，带输出上限与强杀）","@deepseek-ai/dsh-sandbox-local":"进程沙箱：Linux bwrap/landlock、macOS Seatbelt、Windows ACL 限制","@deepseek-ai/dsh-sandbox-policy":"沙箱策略：按会话解析读写模式（只读/工作区写）","@deepseek-ai/dsh-bash-sandbox":"Bash 执行器（沙箱版）：每条命令都受沙箱限制","@deepseek-ai/dsh-pwsh-sandbox":"PowerShell 执行器（沙箱版）：每条命令都受沙箱限制","@deepseek-ai/dsh-user-approval":"用户审批：敏感操作（提权/写文件）需人类确认的机制","@deepseek-ai/dsh-permission-presets":"权限预设：界面上的一个权限选择器（沙箱+审批打包）","@deepseek-ai/dsh-shell-env":"环境变量管理：DSH_* 环境变量注册与注入","@deepseek-ai/dsh-tool-bash":"bash 工具：模型可调用 shell 执行命令（核心能力）","@deepseek-ai/dsh-tool-pwsh":"PowerShell 工具：模型可调用 PowerShell 执行命令","@deepseek-ai/dsh-tool-jobs":"任务工具：模型控制后台任务（job_output/job_list/job_kill）","@deepseek-ai/dsh-fs-observation-policy":"文件策略：读前必读、版本保护的写/改约束","@deepseek-ai/dsh-tool-fs":"文件工具：模型读写/编辑文件（read/write/edit）","@deepseek-ai/dsh-tool-fs-search":"搜索工具：模型用 glob/grep 查找文件","@deepseek-ai/dsh-agent-instructions":"指令加载：自动读取 AGENTS.md / CLAUDE.md 作为上下文","@deepseek-ai/dsh-skill":"技能注册表：管理可加载的 skill 能力","@deepseek-ai/dsh-skill-filesystem":"技能提供者（文件系统版）：从本地加载技能","@deepseek-ai/dsh-skill-badge":"内置 badge 技能：标记/徽章能力","@deepseek-ai/dsh-tool-skill":"技能工具：模型加载 skill 的工具","@deepseek-ai/dsh-commands":"命令注册表：斜杠命令（/xxx）的登记与分发","@deepseek-ai/dsh-command-feedback":"反馈命令：会话反馈的日志与斜杠命令","@deepseek-ai/dsh-goal":"目标服务：跨回合的长期目标状态管理","@deepseek-ai/dsh-goal-round-driver":"目标回合驱动器：目标自动推进机制","@deepseek-ai/dsh-command-goal":"/goal 命令：手动创建/查看目标","@deepseek-ai/dsh-plan-mode":"计划模式：先规划方案再执行（有退出确认）","@deepseek-ai/dsh-token-meter":"Token 计量：统计模型输入输出 token（基础设施）","@deepseek-ai/dsh-compaction-basic":"上下文压缩：对话太长时按 token 触发压缩 + LLM 摘要","@deepseek-ai/dsh-command-compact":"/compact 命令：手动触发上下文压缩","@deepseek-ai/dsh-subagent":"子代理接口：派发子任务的抽象层","@deepseek-ai/dsh-subagent-spawn-in-process":"子代理后端：进程内新建全新子代理","@deepseek-ai/dsh-subagent-fork-in-process":"子代理后端：进程内派生继承上下文的子代理","@deepseek-ai/dsh-tool-subagent-control":"子代理控制工具：send_message / interrupt_agent / list_agents","@deepseek-ai/dsh-tool-subagent-control/list-agents":"子代理列表工具：list_agents（查看子代理状态）","@deepseek-ai/dsh-tool-subagent":"子代理工具：模型把任务委托给子代理","@deepseek-ai/dsh-tool-subagent-report":"子代理报告工具：子代理内部汇报结果","@deepseek-ai/dsh-workflow-worker-thread":"工作流引擎：worker 线程执行编排脚本（不阻塞主线程）","@deepseek-ai/dsh-tool-workflow":"工作流工具：模型运行 JS 编排脚本批量调度子代理","@deepseek-ai/dsh-tool-call-timeout-policy":"工具超时策略：单次工具调用超时自动终止","@deepseek-ai/dsh-spill-local":"溢出存储：超大文本转存到文件（本地实现）","@deepseek-ai/dsh-spill-policy":"溢出策略：工具结果过大时保留预览 + 转存文件","@deepseek-ai/dsh-session-checkpoint-policy":"会话检查点：模型请求/工具操作前持久化防丢","@deepseek-ai/dsh-compaction-tool-result-pruner":"压缩裁剪：压缩时裁剪过长的工具结果节点","@deepseek-ai/dsh-tool-todo":"todo 工具：模型维护任务清单（todo_write）","@deepseek-ai/dsh-tool-goal":"目标工具：模型创建/更新目标（create_goal/update_goal）","@deepseek-ai/dsh-tool-ralph":"Ralph 工具：全新代理循环迭代执行（用户要求时才用）","@deepseek-ai/dsh-tool-str-replace-editor":"文本编辑工具：字符串替换式编辑文件","@deepseek-ai/dsh-repeat-tool-reminder":"重复提醒：模型反复调用相同工具时给出建议","@deepseek-ai/dsh-web":"联网接口：搜索/抓取能力的抽象层","@deepseek-ai/dsh-web-search-deepseek":"搜索提供者：DeepSeek 官方的 web_search 实现","@deepseek-ai/dsh-tool-web":"联网工具：模型使用 web_search / web_fetch","@deepseek-ai/dsh-tools":"工具注册与执行管线：所有工具的核心调度（基础设施）","@deepseek-ai/dsh-system-prompt":"系统提示词：按需组装系统提示（基础设施）","@deepseek-ai/dsh-agent-loop":"Agent 主循环：思考-行动-观察的循环执行器（核心）","@deepseek-ai/dsh-fs-sandbox":"文件系统（沙箱版）：写操作受沙箱模式限制","@deepseek-ai/dsh-llm-deepseek":"DeepSeek 模型适配器：对接官方 chat-completions 接口","@deepseek-ai/dsh-code-runtime-worker-thread":"代码执行：在 worker 线程里运行代码","@deepseek-ai/dsh-storage":"存储中枢：各类 KV 存储的统一入口","@deepseek-ai/dsh-storage-json":"存储后端：JSON 文件 KV 存储","@deepseek-ai/dsh-storage-domain":"领域存储：带 schema 校验的事件型 KV 域","@deepseek-ai/dsh-message-feedback":"消息反馈：对消息评分/写备注（边车数据）","@deepseek-ai/dsh-session-log-export":"日志导出：把会话日志导出为文件","@deepseek-ai/dsh-workspace":"工作区：工作区实体注册与校验","@deepseek-ai/dsh-session-projection-cache":"投影缓存：会话投影的持久化缓存（性能优化）","@deepseek-ai/dsh-session-stats":"会话统计：消息数、耗时等统计视图","@deepseek-ai/dsh-host-directory-picker-auto":"目录选择器：自动选择原生或网页版后端","@deepseek-ai/dsh-host-plugin-inventory":"插件清单服务：本界面「插件列表」的数据源（只读）","@deepseek-ai/dsh-host-apiproxy":"API 代理：前端 fetch 请求的宿主端网关","@deepseek-ai/dsh-cordis-host-runner":"动态插件宿主端：模型可以挂载/卸载插件","@deepseek-ai/dsh-web-app/startup":"Web 应用启动：浏览器界面装配入口","@deepseek-ai/dsh-host-webserver":"HTTP 服务器：路由注册与静态文件服务","@deepseek-ai/dsh-web-app":"Web 模式整体打包层：浏览器界面的核心组合","@deepseek-ai/dsh-client-hmr":"前端热更新：开发时浏览器端自动刷新（生产停用）","@deepseek-ai/dsh-client-modules":"前端模块系统：加载并组合客户端插件（基础设施）","@deepseek-ai/dsh-client-connection":"前端连接层：HTTP/WebSocket 连接管理","@deepseek-ai/dsh-api-remotes":"前端 RPC 装配：把后端能力暴露给前端调用","@deepseek-ai/dsh-client-runtime":"前端核心：插槽注册表与会话运行时","@deepseek-ai/dsh-cordis-client-runner":"动态插件浏览器端：运行模型写的插件","@deepseek-ai/dsh-client-ui-theme":"主题：深色/浅色/跟随系统","@deepseek-ai/dsh-client-locale":"语言：中文/英文界面切换","@deepseek-ai/dsh-client-ui-layout":"布局：三栏应用框架（可拖拽）","@deepseek-ai/dsh-client-ui-sidebar":"侧边栏：会话树、搜索、分组、状态点","@deepseek-ai/dsh-client-ui-settings":"设置页基础：设置命名空间与插槽契约","@deepseek-ai/dsh-client-ui-settings-general":"通用设置：欢迎页、外观等基础设置项","@deepseek-ai/dsh-client-ui-settings-models":"模型设置：配置模型提供者与密钥","@deepseek-ai/dsh-client-ui-settings-plugin-inventory":"官方插件清单 tab：只读的插件加载状态列表","@deepseek-ai/dsh-client-ui-conversation":"对话界面：聊天流与输入框","@deepseek-ai/dsh-client-ui-tool":"工具调用展示：工具调用树渲染","@deepseek-ai/dsh-client-ui-cordis":"动态插件卡片：模型定义插件的运行/停止开关","@deepseek-ai/dsh-client-ui-workflow-run":"工作流运行展示：工作流节点与会话成员","@deepseek-ai/dsh-client-ui-deliverables":"产出文件：回复中的可点击文件引用","@deepseek-ai/dsh-client-ui-workspace":"工作区选择器：选择/切换工作目录","@deepseek-ai/dsh-client-ui-input-trigger":"输入触发器：/ 命令与 @ 引用菜单","@deepseek-ai/dsh-client-ui-commands":"命令面板：斜杠命令的界面","@deepseek-ai/dsh-client-ui-skill":"技能 UI：技能引用与技能工具行","@deepseek-ai/dsh-client-ui-subagent":"子代理目录：子会话列表与继续路由","@deepseek-ai/dsh-client-ui-jobs":"任务列表：会话头部显示后台任务状态","@deepseek-ai/dsh-client-ui-goal":"目标栏：会话顶部显示当前目标","@deepseek-ai/dsh-client-ui-message-feedback":"消息反馈按钮：对单条消息评分","@deepseek-ai/dsh-client-ui-model-selection":"模型选择：/model 切换模型","@deepseek-ai/dsh-client-ui-permission-presets":"权限预设 UI：/permission 设置权限","@deepseek-ai/dsh-client-ui-agent-preset":"Agent 预设：会话的代理组合配置界面","@deepseek-ai/dsh-client-ui-settings-plugins":"插件设置区：可配置插件卡片（终端/循环/搜索）","@deepseek-ai/dsh-client-ui-plan":"计划模式控件：输入框上的计划开关","@deepseek-ai/dsh-client-ui-user-questions":"提问 UI：向用户提问的弹窗界面","@deepseek-ai/dsh-client-ui-trajectory":"轨迹视图：事件时间线（分析用）","@deepseek-ai/dsh-agent-presets":"Agent 预设组合：从 preset 文件组装会话代理","@deepseek-ai/dsh-persona":"角色配置：部署层面的 persona 设定","@deepseek-ai/dsh-tool-ask-user":"提问工具：ask_user_question（问人类）","@deepseek-ai/dsh-host-directory-picker-native":"目录选择器（原生）：调系统文件夹选择框","@deepseek-ai/dsh-client-ui-directory-picker-native":"目录选择器 UI（原生）：无渲染的宿主调用层"};
		/**
		* Entry ids that must never be disabled from the UI. Keep in sync with
		* the host copy in lib/index.js (PROTECTED_IDS).
		*/
		const PROTECTED_IDS = new Set([
			"include",
			"include:timer", "include:llm", "include:session",
			"include:typert", "include:typert-loader", "include:typert-gateway",
			"include:settings", "include:credentials", "include:agent",
			"include:agent-default-model", "include:agent-loop", "include:tools",
			"include:system-prompt", "include:token-meter", "include:approval",
			"include:user-questions", "include:sandbox-policy", "include:shell-env",
			"include:subagent", "include:workflow-worker-thread", "include:jobs",
			"include:compaction-basic", "include:session-persistence-jsonl",
			"include:storage", "include:storage-json", "include:storage-domain",
			"include:session-projection", "include:session-projection-cache",
			"include:workspace", "include:subprocess", "include:sandbox",
			"include:bash-sandbox", "include:pwsh-sandbox", "include:fs-sandbox",
			"include:fs-observation-policy", "include:web", "include:llm-deepseek",
			"include:llm-retry", "include:api-gateway", "include:webserver",
			"include:web-runtime", "include:web-startup", "include:modules",
			"include:connection", "include:client-runtime", "include:api-remotes",
			"include:locale", "include:ui-layout", "include:ui-settings",
			"include:ui-conversation", "include:cordis-client-runner",
			"include:cordis-host-runner", "include:plugin-inventory",
			"include:directory-picker", "include:session-checkpoint-policy",
			"include:spill-local", "include:spill-policy", "include:timeout-policy",
			"include:agent-presets", "include:web-search-deepseek"
		]);
		//#endregion
		//#region helpers
		const PHASE_KEYS = {
			pending: "pending",
			loading: "loadingPhase",
			active: "active",
			failed: "failed",
			unloading: "unloading"
		};
		/** Localized label for one root Fiber phase. */
		function phaseLabel(phase, t) {
			return phase === null ? t("unobserved") : t(PHASE_KEYS[phase]);
		}
		/** Compact a module specifier for the card title. */
		function moduleShortName(moduleName) {
			return (moduleName.startsWith("@") ? moduleName.slice(moduleName.indexOf("/") + 1) : moduleName).replace(/^cordis:/, "").replace(/^cordis-plugin-/, "").replace(/^dsh-(?:host-|client-)?/, "");
		}
		/** Plain-language explanation for a module name, or undefined. */
		function explainOf(moduleName) {
			const hit = DICTIONARY[moduleName];
			if (typeof hit === "string" && hit.length > 0) return hit;
			return void 0;
		}
		/** Whether an inventory row matches the catalog query (name, entry id, or explanation). */
		function matches(entry, normalizedQuery) {
			if (normalizedQuery.length === 0) return true;
			const explanation = explainOf(entry.moduleName);
			return [entry.moduleName, entry.entryId, explanation].some((value) => typeof value === "string" && value.toLocaleLowerCase().includes(normalizedQuery));
		}
		//#endregion
		//#region component
		/** Render the explained read-only Loader inventory. */
		function ExplainedPluginTab({ list, t }) {
			const catalogId = (0, react.useId)();
			const [request, setRequest] = (0, react.useState)(0);
			const [query, setQuery] = (0, react.useState)("");
			const [expanded, setExpanded] = (0, react.useState)(null);
			const [state, setState] = (0, react.useState)({ status: "loading" });
			const [pending, setPending] = (0, react.useState)({});
			const [busy, setBusy] = (0, react.useState)({});
			const [notice, setNotice] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let current = true;
				Promise.resolve().then(() => list()).then((snapshot) => {
					if (current) setState({
						status: "ready",
						snapshot
					});
				}, () => {
					if (current) setState({ status: "error" });
				});
				return () => {
					current = false;
				};
			}, [list, request]);
			const normalizedQuery = query.trim().toLocaleLowerCase();
			const filteredEntries = (0, react.useMemo)(() => state.status === "ready" ? state.snapshot.entries.filter((entry) => matches(entry, normalizedQuery)) : [], [normalizedQuery, state]);
			(0, react.useEffect)(() => {
				if (expanded !== null && !filteredEntries.some((entry) => entry.entryId === expanded)) setExpanded(null);
			}, [expanded, filteredEntries]);
			const retry = () => {
				setState({ status: "loading" });
				setRequest((value) => value + 1);
			};
			/**
			* Send a toggle request to the host route, which rewrites the profile's
			* cordis.patch.yml. The running Loader does not hot-apply it (HMR is
			* disabled), so the change is marked pending until the next restart.
			*/
			const toggle = (entry) => {
				if (busy[entry.entryId] === true) return;
				const desired = pending[entry.entryId] !== void 0 ? pending[entry.entryId] : entry.enabled;
				const next = !desired;
				setBusy((b) => ({ ...b, [entry.entryId]: true }));
				setNotice(null);
				fetch("/plugin-explainer/toggle", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ entryId: entry.entryId, moduleName: entry.moduleName, enabled: next })
				}).then((response) => response.json()).then((data) => {
					if (!data.ok) throw new Error((data.error && data.error.message) || t("toggleError"));
					setPending((p) => ({ ...p, [entry.entryId]: next }));
				}).catch((error) => {
					setPending((p) => {
						const n = { ...p };
						delete n[entry.entryId];
						return n;
					});
					setNotice(t("toggleError") + "：" + (error && error.message ? error.message : String(error)));
				}).finally(() => {
					setBusy((b) => {
						const n = { ...b };
						delete n[entry.entryId];
						return n;
					});
				});
			};
			const refresh = () => {
				setState({ status: "loading" });
				setRequest((value) => value + 1);
			};
			const enabledCount = state.status === "ready" ? state.snapshot.entries.filter((entry) => entry.enabled).length : 0;
			const explainedCount = state.status === "ready" ? state.snapshot.entries.filter((entry) => explainOf(entry.moduleName) !== void 0).length : 0;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "pEx_section",
				"aria-busy": state.status === "loading",
				children: [
					state.status === "loading" ? (0, react_jsx_runtime.jsx)("p", {
						className: "pEx_status",
						children: t("loading")
					}) : null,
					state.status === "error" ? (0, react_jsx_runtime.jsxs)("div", {
						className: "pEx_failure",
						children: [(0, react_jsx_runtime.jsx)("p", {
							role: "alert",
							children: t("error")
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: retry,
							children: t("retry")
						})]
					}) : null,
					state.status === "ready" ? (0, react_jsx_runtime.jsxs)("div", {
						className: "pEx_catalog",
						children: [
							(0, react_jsx_runtime.jsxs)("label", {
								className: "pEx_search",
								children: [
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { "aria-hidden": "true" }),
									(0, react_jsx_runtime.jsx)("span", {
										className: "pEx_visuallyHidden",
										children: t("search")
									}),
									(0, react_jsx_runtime.jsx)("input", {
										type: "search",
										value: query,
										placeholder: t("search"),
										"aria-label": t("search"),
										onChange: (event) => {
											setQuery(event.currentTarget.value);
										}
									})
								]
							}),
							Object.keys(pending).length > 0 || notice !== null ? (0, react_jsx_runtime.jsx)("div", {
								className: "pEx_notice",
								children: notice !== null ? notice : t("pendingNotice", { count: Object.keys(pending).length })
							}) : null,
							(0, react_jsx_runtime.jsx)("div", {
								className: "pEx_summary",
								children: t("summary", {
									total: state.snapshot.entries.length,
									enabled: enabledCount,
									disabled: state.snapshot.entries.length - enabledCount,
									explained: explainedCount
								})
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "pEx_heading",
								children: [(0, react_jsx_runtime.jsx)("h3", { children: t("catalog") }), (0, react_jsx_runtime.jsx)("span", {
									"data-plugin-count": filteredEntries.length,
									children: filteredEntries.length
								}), (0, react_jsx_runtime.jsx)("button", {
									className: "pEx_refresh",
									type: "button",
									onClick: refresh,
									children: t("refresh")
								})]
							}),
							state.snapshot.entries.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
								className: "pEx_status",
								children: t("empty")
							}) : null,
							state.snapshot.entries.length > 0 && filteredEntries.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
								className: "pEx_status",
								children: t("emptySearch")
							}) : null,
							filteredEntries.length > 0 ? (0, react_jsx_runtime.jsx)("ul", {
								className: "pEx_cards",
								children: filteredEntries.map((entry) => {
									const status = phaseLabel(entry.fiberPhase, t);
									const title = moduleShortName(entry.moduleName);
									const configuration = t(entry.enabled ? "enabledTag" : "disabledTag");
									const explanation = explainOf(entry.moduleName);
									const isProtected = PROTECTED_IDS.has(entry.entryId);
									const effectiveEnabled = pending[entry.entryId] !== void 0 ? pending[entry.entryId] : entry.enabled;
									const open = expanded === entry.entryId;
									const detailId = catalogId + "-details-" + encodeURIComponent(entry.entryId);
									return (0, react_jsx_runtime.jsxs)("li", {
										className: "pEx_card",
										"data-plugin-entry": entry.entryId,
										"data-open": open ? "true" : void 0,
										children: [
											(0, react_jsx_runtime.jsxs)("div", {
												className: "pEx_cardHeader",
												children: [
													(0, react_jsx_runtime.jsxs)("button", {
														className: "pEx_expand",
														type: "button",
														"aria-expanded": open,
														"aria-controls": detailId,
														"aria-label": entry.enabled ? title + ", " + status + ", " + configuration : title + ", " + configuration,
														onClick: () => {
															setExpanded((current) => current === entry.entryId ? null : entry.entryId);
														},
														children: [
															(0, react_jsx_runtime.jsx)("strong", {
																className: "pEx_cardTitle",
																title: entry.moduleName,
																children: title
															}),
															(0, react_jsx_runtime.jsxs)("span", {
																className: "pEx_cardTrailing",
																children: [
																	entry.enabled ? (0, react_jsx_runtime.jsx)("span", {
																		className: "pEx_statusDot",
																		"data-phase": entry.fiberPhase ?? "unobserved",
																		role: "img",
																		"aria-label": status,
																		title: status
																	}) : null,
																	(0, react_jsx_runtime.jsx)("span", {
																		className: "pEx_tag",
																		"data-enabled": entry.enabled ? "true" : "false",
																		children: configuration
																	}),
																	pending[entry.entryId] !== void 0 ? (0, react_jsx_runtime.jsx)("span", {
																		className: "pEx_pendingTag",
																		children: t("pending")
																	}) : null,
																	(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {
																		className: "pEx_chevron",
																		size: 12,
																		"aria-hidden": "true"
																	})
																]
															})
														]
													}),
													(0, react_jsx_runtime.jsx)("button", {
														className: "pEx_switch",
														type: "button",
														role: "switch",
														"aria-checked": effectiveEnabled ? "true" : "false",
														"aria-label": t(isProtected ? "protected" : effectiveEnabled ? "toggleOff" : "toggleOn"),
														title: isProtected ? t("protected") : t("switchHint"),
														disabled: isProtected || busy[entry.entryId] === true,
														onClick: (event) => {
															event.stopPropagation();
															toggle(entry);
														},
														children: (0, react_jsx_runtime.jsx)("span", {
															className: "pEx_switchKnob",
															"aria-hidden": "true"
														})
													})
												]
											}),
											(0, react_jsx_runtime.jsx)("div", {
												className: "pEx_explain",
												children: (0, react_jsx_runtime.jsx)("p", {
													className: "pEx_explainText" + (explanation === void 0 ? " pEx_unexplained" : ""),
													children: explanation === void 0 ? t("noExplain") : explanation
												})
											}),
											open ? (0, react_jsx_runtime.jsxs)("div", {
												className: "pEx_cardDetails",
												id: detailId,
												children: [
													(0, react_jsx_runtime.jsx)("code", {
														className: "pEx_entryValue",
														"data-loader-entry": true,
														children: entry.entryId
													}),
													(0, react_jsx_runtime.jsxs)("dl", {
														className: "pEx_details",
														children: [
															(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("module") }), (0, react_jsx_runtime.jsx)("dd", { children: entry.moduleName })] }),
															(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("configuration") }), (0, react_jsx_runtime.jsx)("dd", { children: configuration })] }),
															entry.enabled ? (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("cordis") }), (0, react_jsx_runtime.jsx)("dd", { children: status })] }) : null
														]
													})
												]
											}) : null
										]
									}, entry.entryId);
								})
							}) : null
						]
					}) : null
				]
			});
		}
		//#endregion
		//#region locales
		const zh = {
			tab: "插件说明",
			loading: "正在读取插件…",
			error: "暂时无法读取插件。",
			retry: "重试",
			search: "搜索插件",
			catalog: "全部插件",
			empty: "暂无插件。",
			emptySearch: "没有匹配的插件。",
			enabledTag: "已启用",
			disabledTag: "已停用",
			configuration: "配置状态",
			cordis: "Cordis 状态",
			module: "完整包名",
			unobserved: "未挂载",
			pending: "等待依赖",
			loadingPhase: "加载中",
			active: "已挂载",
			failed: "挂载失败",
			unloading: "卸载中",
			noExplain: "（暂无收录说明：可在 dictionary.json 中补充）",
			toggleOn: "启用此插件",
			toggleOff: "停用此插件",
			switchHint: "开关插件（重启 dsh 后生效）",
			protected: "核心组件，不可停用",
			pending: "待重启生效",
			pendingNotice: "有 {count} 项更改已写入配置，重启 dsh 后生效",
			toggleError: "切换失败",
			refresh: "刷新",
			summary: "共 {total} 个插件：{enabled} 个启用 · {disabled} 个停用 · 已收录说明 {explained} 个"
		};
		const en = {
			tab: "Plugin explainer",
			loading: "Reading plugins…",
			error: "Plugins are temporarily unavailable.",
			retry: "Retry",
			search: "Search plugins",
			catalog: "All plugins",
			empty: "No plugins are available.",
			emptySearch: "No matching plugins.",
			enabledTag: "Enabled",
			disabledTag: "Disabled",
			configuration: "Configuration",
			cordis: "Cordis status",
			module: "Package",
			unobserved: "Not mounted",
			pending: "Waiting for dependencies",
			loadingPhase: "Loading",
			active: "Mounted",
			failed: "Mount failed",
			unloading: "Unloading",
			noExplain: "(No explanation yet: add one in dictionary.json)",
			toggleOn: "Enable this plugin",
			toggleOff: "Disable this plugin",
			switchHint: "Toggle plugin (takes effect after dsh restart)",
			protected: "Core component, cannot be disabled",
			pending: "Pending restart",
			pendingNotice: "{count} change(s) written; effective after dsh restart",
			toggleError: "Toggle failed",
			refresh: "Refresh",
			summary: "{total} plugins: {enabled} enabled, {disabled} disabled, {explained} explained"
		};
		//#endregion
		//#region entry
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.pluginExplainer";
		/** Services required by the Settings registration and generated Remote face. */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.pluginInventory"
		];
		/** Contribute the explained tab to the Plugins settings section. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-plugin-explainer: dictionaries");
			const t = ctx.locale.bind(NS);
			const list = async () => {
				const result = await ctx.remote.pluginInventory.list();
				if (!result.ok) throw new Error("pluginInventory.list failed: " + result.error.code + ": " + result.error.message);
				return result.value;
			};
			const injected = () => ({ list });
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: "explained",
				order: 20,
				label: () => t("tab"),
				locale: NS,
				inject: injected
			}, ExplainedPluginTab));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
