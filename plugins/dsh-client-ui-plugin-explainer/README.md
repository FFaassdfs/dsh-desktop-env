# dsh-client-ui-plugin-explainer

dsh Web 设置页「插件」区的一个增强 tab：**插件说明**。

对每个已加载的插件显示：

- 通俗易懂的中文功能解释（来自 `dictionary.json`，按包名匹配；未收录的显示占位提示）
- 当前开关状态：`已启用` / `已停用`，以及运行阶段（已挂载 / 加载中 / 挂载失败 / …）
- 完整包名与加载条目 id（展开卡片可见）
- **开关按钮**（v2）：真正启用/停用插件——写入 profile 的 `cordis.patch.yml`，**重启 dsh 后生效**；核心组件置灰不可停用

## 结构

```
package.json           # dsh.client 清单（platform: web + inject 依赖）
dictionary.json        # 包名 -> 中文解释（可编辑的源数据）
src/bundle.template.js # 客户端 bundle 模板（占位 __DICTIONARY_JSON__ + PROTECTED_IDS）
lib/client.js          # 构建产物（自包含 bundle，浏览器加载的就是它）
lib/index.js           # host 侧：POST /plugin-explainer/toggle 路由（写 cordis.patch.yml）
build.mjs              # node build.mjs 重新生成 lib/client.js
```

## 数据与写入

- **读取**：只读接口 `pluginInventory/list`（`POST /api/pluginInventory/list`）。
- **开关**：`POST /plugin-explainer/toggle`，body `{entryId, moduleName, enabled}`；
  停用写 `{id, name, disabled: true}`，启用写 `{id, name, disabled: false}`（覆盖 bundle 层 disable）；
  核心组件返回 403。写入后需重启 dsh 生效（profile patch 热重载依赖 HMR，默认停用）。

## 使用

1. 修改 `dictionary.json`（只加新键即可，键 = 插件完整包名）；如改 `PROTECTED_IDS` 需同步 `lib/index.js` 与 `src/bundle.template.js` 两份。
2. `node build.mjs` 重新生成 `lib/client.js`。
3. **先删后拷**整个包目录到 `$DSH_HOME/profiles/node_modules/dsh-client-ui-plugin-explainer/`（避免 Copy-Item 嵌套）。
4. 重启 dsh web（`dsh web` 或桌面壳），设置 → 插件 → 「插件说明」tab。

安装/卸载/排障详见仓库根目录 `HANDOVER.md`。
