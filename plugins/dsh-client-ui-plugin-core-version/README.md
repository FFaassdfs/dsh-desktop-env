# dsh-client-ui-plugin-core-version（Web GUI 顶部核心版本徽标）

在 dsh Web GUI 的**左下角**显示一个只读小徽标：`dsh v0.1.5-rc.1`（= 正在运行的核心 `@deepseek-ai/dsh` 版本，实测与 `dsh --version` 输出一致；数字随核心升级自动变化，此处为 2026-09-14 快照）。

- 纯展示：`pointer-events:none`，不挡任何点击；取不到版本时自动隐藏。
- 挂官方 `shell.overlay` 帧级浮动层（ui-layout 为 badge/toast 设计），不裸插 DOM、不依赖侧栏布局。
- 版本来源：浏览器侧无任何官方通道（无 /version 端点；`__DSH_BOOT__` 只有内容 hash；官方 client 常量私有），故 host 半区提供一条本地路由读取版本，见下。

## 结构

| 文件 | 职责 |
|---|---|
| `lib/index.js` | host 半区：`GET/POST /plugin-core-version/version` → `{ok,version}`；用 `createRequire` 解析 `profiles/node_modules` 里的 `@deepseek-ai/dsh/package.json`（备选 `dsh-web-app`/`dsh-base` 同族包） |
| `src/bundle.template.js` | client 模板：注册 `shell.overlay` 槽位角标；fetch 版本一次（最多 4 次重试），失败静默 |
| `build.mjs` | `node build.mjs` 生成 `lib/client.js` |
| `package.json` | `dsh.client` 声明（platform web） |

## 构建 / 安装 / 验收

```powershell
# 1. 重建 bundle（改模板后）
node plugins/dsh-client-ui-plugin-core-version/build.mjs
node --check plugins/dsh-client-ui-plugin-core-version/lib/client.js

# 2. 安装到 profile（删旧→拷 package.json+lib→追加 cordis.patch.yml 条目→静态校验）
#    写 %USERPROFILE%\.dsh，沙箱内需提权执行
node .work/install-core-version.mjs

# 3. 刷新浏览器页面即可（client bundle 需刷新加载）；若 host lib/index.js 有改动以完全重启兜底
```

验收清单：
- [x] Web GUI **左下角**（`left:12px;bottom:56px`）出现 `dsh v0.1.5-rc.1` 徽标，不挡交互（2026-09-14 实测确认可见）；
- [ ] 徽标旁 hover 提示「DeepSeek Harness 核心版本」；
- [ ] 官方升级核心后，徽标数字随之变化（host 读的是实际安装包版本）。

## 风险 / 回滚

- 若加载失败影响页面：删除 `~\.dsh\profiles\node_modules\dsh-client-ui-plugin-core-version` 并移除 `profiles\web\cordis.patch.yml` 中 `plugin-core-version` 的 insert 段 → 刷新页面即恢复（无其他文件被改动）。
- 槽位 `shell.overlay` 为官方公开渲染层；若未来官方移除/改名该槽，徽标将停止显示（apply 的 slots.inject 会等待声明，缺失时不挂载、不报错）。
