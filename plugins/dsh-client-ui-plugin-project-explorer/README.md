# dsh-client-ui-plugin-project-explorer（项目文件树侧栏）

在 dsh Web GUI **最右侧**提供一个可折叠的**项目文件树面板**：展示当前项目文件夹（当前会话的工作目录，无会话时回退 dsh 启动目录）的目录树与文件，支持**把文件直接拖进对话框**——输入框末尾插入该文件的**相对路径**（相对当前会话 cwd，正斜杠），你可以继续打字补充需求后一起发送，agent 会用自己的工具去读这些文件。

> 路径C（见仓库根 HANDOVER.md）。官方 Web GUI 本身没有目录树 UI，此为全新功能。

## 功能

- 右侧固定面板（宽 300px，可折叠成 26px 细条，折叠状态记忆在 localStorage）。
- 目录树**懒加载**：展开目录才向后端请求列表；`.git`/`node_modules`/`dist`/`build`/`*.log` 等默认隐藏（策略在 `lib/index.js` 顶部常量）。
- 根目录 = **当前会话的工作目录**（`sessions.list` 的 `current` 会话的 `cwd`）；切换会话自动跟随刷新；无会话时回退 dsh server 启动目录（桌面壳以项目 workdir 拉起，即项目目录）。
- **拖文件进对话框**：行元素可拖拽（自定义 MIME `application/x-dsh-filetree`），document 级 drop 处理器把路径插入 composer 草稿**末尾**（换行分隔），焦点回到输入框，可直接继续输入。
  - 相对路径基准 = 当前会话 cwd；文件在 cwd 外才用绝对路径（v1 树根就是 cwd，正常不会发生）。
  - 目录也可拖（agent 自己 list）。
- 与 composer 原生拖放互不干扰：内置 drop 只认 `dataTransfer.types` 含 `Files` 的事件，我们的自定义 MIME 会被它忽略。

## 架构

浏览器读不了文件系统，所以**文件访问全部在 host 侧**：

| 文件 | 职责 |
|---|---|
| `lib/index.js` | host 半区。注册两条 `webServer` 精确路由（避开 `/api` 分发表） |
| `lib/client.js` | 构建产物：浏览器 bundle（`window.__ModuleLoader__.load` 格式，自包含，约 22KB） |
| `src/bundle.template.js` | client 模板（占位 `/*__CONFIG_JSON__*/`） |
| `config.json` | client UI 配置（MIME、面板宽度等），由 `build.mjs` 注入 |
| `build.mjs` | `node build.mjs` 生成 `lib/client.js` |
| `package.json` | `dsh.client` 清单（platform web + inject 依赖，含 ui-conversation 保证服务顺序） |

### Host 路由

```
POST /plugin-project-explorer/root  {sessionCwd?}
  -> {ok, root, rootName, resolvedVia: "session"|"fallback"}
POST /plugin-project-explorer/list  {sessionCwd?, path}
  -> {ok, root, entries: [{name, path, kind: "dir"|"file", size}], truncated}
```

安全边界（全部在 `lib/index.js`）：
- 路径 `resolve` + `realpath` 规范化，拒绝不存在的路径；
- 请求路径必须落在当前解析出的根目录内（大小写不敏感前缀检查），越界 403；
- 忽略名单：`.git/.svn/.hg/node_modules/.cache/dist/build/out/coverage/target/.idea/.vscode/__pycache__/.venv/venv/.dsh/.work/.DS_Store/Thumbs.db`，忽略扩展名 `.log/.tmp/.lock/.swp/.bak`；
- 单目录最多 500 条（超出标记 `truncated`）、深度上限 40、请求体上限 1MiB；
- **不提供读文件内容的路由**——拖入只是路径，内容由 agent 自己读。

### Client 关键点

- `ctx.get("sessions")` → `list.getSnapshot()` 取 `current` 会话 id 与 `byId[id].cwd`（client-runtime 第 8953 行 `rootCtx.reflect.provide("sessions", …)`）。
- `ctx.get("conversation")` → `conversation.input.shell(sessionId)`（ui-conversation 第 9768 行 `ctx.plugin(ConversationController, {input: inputHub, …})`），`shell.snapshot.draft` 读草稿、`shell.setDraft(text)` 写入；失败时退化为 DOM 方案（`textarea[data-phase]` 插值 + 派发 input 事件）。
- 面板不依赖官方布局插槽，直接 `createRoot` 挂一个 `position:fixed` 容器。
- 相对路径计算 `toRelative(root, filePath)`：正斜杠归一化 + 大小写不敏感前缀匹配，导出以便单测。

## 构建 / 安装 / 验收

```powershell
# 1. 重建 bundle（改模板/配置后）
node plugins/dsh-client-ui-plugin-project-explorer/build.mjs

# 2. 安装到 profile（内部会：删旧目录→拷贝 package.json+lib/→追加 cordis.patch.yml 条目→静态验证）
#    需要写 %USERPROFILE%\.dsh，沙箱内提权执行
node .work/install-project-explorer.mjs

# 3. 完全重启 dsh web（见 HANDOVER §4：关桌面壳 → 确认 3080 无占用 → 重开）
#    运行中的实例不会热加载新插件，必须重启
```

验收清单：
- [ ] 右侧出现「📁 项目文件」细条，点击展开 300px 面板，标题为当前项目目录名；
- [ ] 目录树正常展开/收起，`node_modules`/`.git`/`*.log` 不显示；
- [ ] 切换会话，根目录跟随该会话 cwd 变化；
- [ ] 拖一个 `.ts`/`.md` 文件到输入框 → 末尾出现相对路径（正斜杠），可继续打字，发送后 agent 能读到该文件；
- [ ] 拖图片同样插入路径（不走原生图片附件）。

## 测试

```powershell
node .work/filetree-host.test.mjs    # host 路由单测（临时目录 + 假 req/res）
node .work/filetree-smoke.test.mjs   # bundle 冒烟（exports/toRelative/SSR loading/config 注入）
node --check plugins/dsh-client-ui-plugin-project-explorer/lib/client.js
```

## 注意 / 风险

- **重启才生效**：profile patch 无 HMR（与「插件说明」插件相同），改配置/重装后必须完全重启 dsh web。
- **依赖 composer 内部实现**：`conversation.input.shell().setDraft` 与 `textarea[data-phase]` 是官方 client 内部 API，dsh 升级可能变动（有 DOM 回退兜底）。
- **忽略名单在 `lib/index.js` 顶部常量**，改完需重装（host 是唯一文件访问点，client 不重复维护）。
- 拖放只在**有打开会话**时插入草稿；无会话会提示。
- 只读浏览 + 拖路径，**不提供文件内容预览/上传**（刻意为之，见「架构」）。
