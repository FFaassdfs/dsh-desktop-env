# dsh-client-ui-plugin-model-capabilities

> **文档版本：v1.0**（2026-09-06 新增，路径E概述）

在 dsh Web GUI 的「设置」页新增一个 **「模型能力」** 分区（`settings.section`，order 12，紧挨「模型」/「插件」）：列出每个提供商（provider）下的每个模型，显示其声明的能力——**输入模态（文本 / 图像）**、上下文窗口、推理等级，以及可选描述。

它解决的是「**选模型时看不到模型的跨模态能力**」的问题：官方模型选择器（`dsh-client-ui-model-selection`）只渲染模型的 `name` 和 `reasoning`；而生成选择器的目录数据（`dsh-api-session-controller` 的 `buildModelCatalog`）**主动丢弃了每个模型的 `inputModalities`**。本插件不改动任何官方包，而是通过一个只读宿主路由，用同一份 `ctx.llm`（`resolveModelInfo`）把能力重新读出来给浏览器展示。

## 结构

```
plugins/dsh-client-ui-plugin-model-capabilities/
├── package.json           # dsh.client 清单（platform web + inject 依赖）
├── config.json            # client UI 配置（route / maxModelsPerGroup，build 时注入）
├── src/bundle.template.js # client bundle 模板（占位 /*__CONFIG_JSON__*/）
├── lib/index.js           # host 侧：POST /plugin-model-capabilities/list（只读，用 ctx.llm）
├── lib/client.js          # 构建产物：自包含浏览器 bundle（约 15.7KB）
├── build.mjs              # node build.mjs 注入 config.json 生成 client.js
└── README.md
```

## 宿主路由

`POST /plugin-model-capabilities/list`（body 可选，`{}`）

```jsonc
{
  "ok": true,
  "groups": [{
    "id": "deepseek", "name": "DeepSeek",
    "models": [{
      "id": "deepseek-vl", "name": "DeepSeek VL",
      "description": "…",          // 可选
      "inputModalities": ["text", "image"],   // 核心：模态能力
      "contextWindow": 65536,       // 可选
      "reasoning": { "efforts": [{"id":"high","name":"High"}], "defaultEffort":"high" }  // 可选
    }]
  }],
  "failures": [{ "id": "broken", "name": "Broken", "message": "…" }]   // 提供商级加载失败
}
```

- **只读**：不写配置/凭据/LLM 注册表，纯查询。
- **能力来源**：`ctx.llm.listProviders()` → `listModels(provider)` → `resolveModelInfo(provider, model)`，与官方 `buildModelCatalog` 同一套方法。
- 单个模型解析失败不拖垮整个提供商：该模型以 `{ id, name, error }` 列出，客户端内联显示原因；提供商级 `listModels` 失败则进 `failures`。
- 注入服务：`["webServer", "llm"]`。

## 构建 / 重装

```powershell
# 改 config.json / src/bundle.template.js / lib/index.js 后：
node plugins/dsh-client-ui-plugin-model-capabilities/build.mjs   # 重建 lib/client.js

# 重装到 profile（先删旧目录再拷，见 HANDOVER 路径C 坑 10）
$dst = "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-client-ui-plugin-model-capabilities"
Remove-Item $dst -Recurse -Force
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item plugins\dsh-client-ui-plugin-model-capabilities\package.json $dst\package.json -Force
Copy-Item plugins\dsh-client-ui-plugin-model-capabilities\lib $dst\lib -Recurse -Force

# 重启 dsh web（见 HANDOVER 路径E 验证）
```

或直接 `node scripts/setup-plugins.mjs`（幂等：拷包 + 追加 patch + 静态验证，含本插件）。

## 测试

```powershell
node .work\model-capabilities-host.test.mjs    # 宿主 buildCapabilities/handleList（假 ctx.llm + 假 req/res）
node .work\model-capabilities-smoke.test.mjs   # bundle 契约（exports/apply/locale/slot 注册/config 注入）
```

## 已知边界

- **读取一次对齐启动时的注册表**：能力来自当前 Host 的 LLM 注册表快照；适配器升级 / 设置变更后需刷新页面（client 每次进入分区都会重新拉取）。
- **`inputModalities` 缺省含义**：字段缺失 = 未知（显示「能力未声明」）；显式 `["text"]` = 仅文本；含 `image` = 可识图。UI 用纯中文标签承载（「文本 + 图像（可识图）」「图像（可识图）」「仅文本」「能力未声明」），与 `read_image` 工具的准入判据（`model.inputModalities.includes("image")`）一致。
