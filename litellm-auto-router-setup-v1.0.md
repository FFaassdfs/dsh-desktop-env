# LiteLLM 中转算力 + auto 模型视觉自动路由方案

> **文档版本：v1.0**（2026-08-19 创建）
>
> **变更记录**：
> - v1.0（2026-08-19）：初版。基于 litellm 源码（clone HEAD `c696fdf`）逐项验证后成文。

## 0. 结论（TL;DR）

**可以，完全可行**。用 [LiteLLM](https://github.com/BerriAI/litellm) 自建 OpenAI 兼容中转网关，暴露一个统一模型名 `auto`：

- 请求**不含**多模态内容（纯文本）→ 路由到**单模态文本模型**（默认、便宜、快）
- 请求**含**多模态内容（图片 / PDF / 视频 / 音频等）→ 自动切换到**多模态模型**
- 客户端（DSH / opencode / 任意 OpenAI 兼容应用）**完全无感**，只需把模型名填成 `auto`

实现方式：litellm proxy 的**自定义 `async_pre_call_hook`**（官方受支持的扩展点，源码已验证）。litellm 自带的 AutoRouter 语义路由（v1.74.9+）**不适合**本需求（它只提取文本做 embedding 分类，不检测图像，见 §3.3）。

## 1. 需求拆解

| 需求 | 含义 |
|---|---|
| 中转算力 | 把多个上游供应商/模型聚合到一个 OpenAI 兼容端点后面，客户端只认一个地址一个 key |
| auto 模型 | 一个对外模型名，背后按需选模型（本方案：按请求内容选） |
| 单模态文本模型 | 默认模型：纯文本对话/代码，成本低、速度快 |
| 多模态模型 | 具备理解图片、视频、PDF 的能力（如 gpt-4o / gemini / qwen-vl / claude 等） |
| 自动切换规则 | 默认纯文本；当需要分析图像内容、提取图片中的信息/文字/界面元素、理解截图/图表/架构图等任何视觉内容时，转用多模态模型 |

## 2. 架构

```
┌─────────────────────────── 客户端（DSH / opencode / 任意 OpenAI 兼容应用）───────────────────────────┐
│                         统一请求：POST /v1/chat/completions  {"model": "auto", ...}                     │
└──────────────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                               ▼
┌────────────────────────────── LiteLLM Proxy 中转网关（本机或服务器 :4000）─────────────────────────────┐
│  1. 解析请求，校验 key/配额                                                                               │
│  2. 【自定义 pre-call hook】检查 messages 里的 content blocks：                                          │
│       ├─ 含 image_url / file / input_image / video / audio 等多模态块  → 改写 model = "vision-model"    │
│       └─ 纯文本                                                  → 改写 model = "text-model"            │
│  3. route_request 按改写后的 model 名路由（负载均衡 / fallback / 重试由 Router 负责）                     │
│  4. 上游响应原样返回；流式（SSE）同样支持                                                                 │
└───────────────┬──────────────────────────────────────────┬──────────────────────────────────────────────┘
               ▼                                           ▼
┌───────────────────────────┐                ┌───────────────────────────┐
│ 上游 A：单模态文本模型      │                │ 上游 B：多模态模型          │
│ openai/deepseek/gemini 等  │                │ gpt-4o / gemini / qwen-vl  │
│ （官方 API 或任一中转）     │                │ （官方 API 或任一中转）     │
└───────────────────────────┘                └───────────────────────────┘
```

## 3. litellm 关键能力（源码验证，clone HEAD `c696fdf`）

### 3.1 model group（别名 / 负载均衡组）

`config.yaml` 的 `model_list` 中，**相同 `model_name` 的多条记录构成一个组**，组内默认负载均衡；客户端只认 `model_name`，不知道背后真实模型（见 `proxy_server_config.yaml` 第 8–11 行两条 `gpt-5-mini-end-user-test` 的示例）。这正是一个「auto」组 + 两个真实模型组的配置基础。

### 3.2 自定义 pre-call hook 可改写 model（本方案核心）

- 扩展点：`CustomLogger` 子类实现 `async_pre_call_hook(user_api_key_dict, cache, data, call_type)`，返回 `data` 即回写。
- **官方同款模式**：`litellm/proxy/hooks/sensitive_data_routing.py` 的 `async_pre_call_hook` 就是直接 `data["model"] = routed_model` 再 `return data`（第 189/196 行），并往 `metadata` 打标记——证明「hook 改 model」是官方支持且已在生产使用的模式。
- 时序正确：`common_request_processing.py` 中 `pre_call_hook`（第 1808 行）在 `route_request`（第 2161 行）**之前**执行，改写后的 model 名必然被用于最终路由。
- 注册方式：`litellm_settings.callbacks: <模块路径>.<实例名>`，proxy 用 `importlib.import_module` 加载（`proxy_server.py` 第 1005 行）；惯例是模块内定义 `proxy_handler_instance`（见 `example_config_yaml/custom_callbacks1.py`）。

### 3.3 AutoRouter 语义路由（官方新功能，但**不适合本需求**）

- v1.74.9+ 引入：`litellm_params.model: auto_router/<name>` + `auto_router_config`（JSON 路由表）+ `auto_router_default_model` + `auto_router_embedding_model`，见 `router_strategy/auto_router/auto_router.py`。
- 原理：把最后一条 user 消息**只提取文本**（`_extract_text_from_messages` 只取 `type=="text"` 的块，第 94–114 行）→ embedding 分类 → 按 `Route` 的 utterances 相似度选模型。
- 结论：它是「按**文本语义**分流」（如代码题→code 模型、数学题→math 模型），**不会**因为请求里带图而切模型。本需求是「按**消息结构**（是否含图像/文件）分流」的硬规则，应走 §3.2 的自定义 hook。若日后想要「纯文本但语义上要求看图」的分流，可在 hook 里叠加关键词规则（见 §5 代码注释）。

### 3.4 多模态透传（图片 / PDF / 视频 / 音频）

litellm 的 OpenAI 兼容层完整支持多模态 content blocks，并转换到各上游格式：

- OpenAI 格式块类型（`types/llms/openai.py` 第 677–684 行 `OpenAIMessageContentListBlock`）：`text` / `image_url` / `audio` / `document` / `video` / **`file`**。
- `file` 块（第 663–674 行 `ChatCompletionFileObject`）：`file_data`（base64）/ `file_id` / `filename` / `format` / `video_metadata`（fps、start/end_offset）——**PDF 与视频都走这个类型**。
- 上游转换：gemini（`llms/gemini/chat/transformation.py`）、claude、bedrock、mistral（`llms/mistral/chat/transformation.py` 明确处理 `image_url` 与 `file`）、vertex 等都有 image/file → 上游格式的转换逻辑。
- 结论：客户端按 OpenAI 格式传图片/PDF/视频，litellm 透传给多模态上游；**上游模型必须本身支持这些格式**（gpt-4o/gemini/qwen-vl/claude 均支持图片；PDF/视频支持因模型而异，见 §7.3）。

## 4. 配置文件 config.yaml（完整示例）

```yaml
# ============ LiteLLM Proxy 配置：auto 模型视觉自动路由 ============
# 部署前替换占位符：<TEXT_*>/<VISION_*> 为你的真实供应商与模型 id/密钥
# 参考：https://docs.litellm.ai/docs/proxy/configs

model_list:
  # ── auto 组：客户端统一请求 "auto" ──
  # hook 会把 auto 改写为 text-model / vision-model；
  # 这里保留 auto 条目作为"兜底默认"（hook 异常/禁用时仍可用，落到文本模型）
  - model_name: auto
    litellm_params:
      model: openai/<TEXT_MODEL_ID>          # 兜底 = 纯文本模型
      api_key: os.environ/TEXT_API_KEY
      api_base: <TEXT_API_BASE>              # 例：https://api.deepseek.com/v1 或任一中转 /v1
    model_info:
      mode: chat

  # ── 单模态文本模型组（默认）──
  - model_name: text-model
    litellm_params:
      model: openai/<TEXT_MODEL_ID>
      api_key: os.environ/TEXT_API_KEY
      api_base: <TEXT_API_BASE>
    model_info:
      mode: chat

  # ── 多模态模型组（含图/PDF/视频时切换）──
  # 同一组可配多条（不同供应商/区域）→ 自动负载均衡 + 失败重试
  - model_name: vision-model
    litellm_params:
      model: openai/<VISION_MODEL_ID>        # 例：gpt-4o / gemini-2.x / qwen-vl-max
      api_key: os.environ/VISION_API_KEY
      api_base: <VISION_API_BASE>
    model_info:
      mode: chat

# ── 自定义 hook 注册（本方案核心）──
litellm_settings:
  callbacks: vision_router.proxy_handler_instance
  # 可选：全局开关/超时
  # num_retries: 2
  # request_timeout: 600

# ── 网关密钥（客户端访问本网关用）──
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY   # 网关管理密钥
  # database_url: os.environ/DATABASE_URL     # 可选：用量/日志持久化（postgres）
```

要点：

1. `model: openai/<id>` 的 `openai` 前缀 = 「OpenAI 兼容协议」provider；配合 `api_base` 可指向**任何** OpenAI 兼容端点（官方 API、vekenllm 中转、ctai 等）。非 OpenAI 兼容供应商（如 Bedrock/Vertex 原生）也可直接用 `model: bedrock/...` 等前缀。
2. `model_info.mode: chat` 便于 UI/日志区分用途。
3. 客户端（DSH 等）只配 `auto` 一个模型；`text-model` / `vision-model` 也可直接对外（绕过 hook 强制指定）。

## 5. 自定义 hook：vision_router.py

完整可复制源码见 `.work/litellm-auto-router/vision_router.py`，核心逻辑：

```python
from litellm.integrations.custom_logger import CustomLogger
from litellm.proxy.proxy_server import DualCache, UserAPIKeyAuth
from litellm.types.utils import CallTypesLiteral

# 视为"多模态请求"的 content block 类型（OpenAI chat completions 格式）
MULTIMODAL_BLOCK_TYPES = {
    "image_url",    # 图片：{"type":"image_url","image_url":{"url":...}}
    "file",         # PDF/视频等：{"type":"file","file":{"file_data":...}} 或 {"file_id":...}
    "input_image",  # Responses API 图片
    "input_audio",  # 音频
    "audio_url",    # 音频
    "video",        # 视频
    "document",     # 文档
}

AUTO_MODEL = "auto"
TEXT_MODEL = "text-model"
VISION_MODEL = "vision-model"


class VisionAutoRouter(CustomLogger):
    """auto → 含多模态内容切 vision-model，否则 text-model"""

    async def async_pre_call_hook(
        self,
        user_api_key_dict: UserAPIKeyAuth,
        cache: DualCache,
        data: dict,
        call_type: CallTypesLiteral,
    ):
        # 只处理本方案约定的 auto 别名，其余模型名原样放行
        if data.get("model") != AUTO_MODEL:
            return data
        messages = data.get("messages") or []
        if _has_multimodal_content(messages):
            data["model"] = VISION_MODEL
        else:
            data["model"] = TEXT_MODEL
        # 可选：打标记便于日志/成本统计（照抄官方 sensitive_data_routing 的 metadata 模式）
        metadata = data.get("metadata") or {}
        metadata["auto_router_applied"] = True
        metadata["auto_router_model"] = data["model"]
        data["metadata"] = metadata
        return data


def _has_multimodal_content(messages: list) -> bool:
    """任一消息的 content 为列表且含多模态块类型 → True"""
    for msg in messages:
        content = msg.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if isinstance(block, dict) and block.get("type") in MULTIMODAL_BLOCK_TYPES:
                return True
    return False


proxy_handler_instance = VisionAutoRouter()
```

**可选增强（默认不做，需要时再开）**：

- **语义关键词规则**：纯文本里出现「分析图片 / 看图 / 截图 / 图表 / 架构图 / 界面 / OCR」等词时也切 vision-model（满足「文字说要看图、但图走别的通道」的场景）。注意有误判成本，建议做成环境变量开关（如 `VISION_KEYWORD_ROUTING=1`）。
- **会话粘性**：同一会话一旦切过 vision，后续保持 vision（避免多轮里模型来回切换导致上下文行为不一致）；可参考 `sensitive_data_routing.py` 的 `session_id → model` 缓存实现。
- **降级兜底**：vision 模型不可用时回退 text 模型——litellm Router 的 `fallbacks` 机制原生支持（在 `router_settings` 里配置），也可在 hook 里 try/except 二次改写。

## 6. 部署

### 6.1 Docker（推荐）

```bash
# 准备目录
mkdir litellm-config && cp config.yaml litellm-config/ && cp vision_router.py litellm-config/

# 启动（环境变量注入密钥）
docker run -d --name litellm-auto --restart unless-stopped \
  -p 4000:4000 \
  -v $(pwd)/litellm-config:/app/config \
  -e LITELLM_MASTER_KEY=sk-你的网关key \
  -e TEXT_API_KEY=... -e VISION_API_KEY=... \
  ghcr.io/berriai/litellm:main-stable \
  --config /app/config/config.yaml --detailed_debug
```

镜像：`ghcr.io/berriai/litellm:main-stable`（官方）；`docker compose up -d` 同理（官方仓库自带 `docker-compose.yml`）。

### 6.2 pip（本机/轻量）

```bash
pip install 'litellm[proxy]'
# 把 config.yaml 与 vision_router.py 放同一目录（或 cwd）
litellm --config config.yaml --port 4000 --detailed_debug
```

⚠️ `vision_router.py` 必须放在 proxy **能 import 到**的位置：与 config 同目录并把它加入 `PYTHONPATH`，或放在 `litellm/proxy/hooks/` 里（此时 callbacks 写 `litellm.proxy.hooks.vision_router.proxy_handler_instance`）。

## 7. 验证

### 7.1 基础冒烟

```bash
# 1) 网关健康
curl -s http://localhost:4000/health/liveliness

# 2) 模型列表应包含 auto / text-model / vision-model
curl -s http://localhost:4000/v1/models -H "Authorization: Bearer sk-你的网关key"

# 3) 纯文本 → 路由到 text-model
curl -s http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-你的网关key" -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"你好，介绍一下你自己"}]}'

# 4) 带图 → 路由到 vision-model
curl -s http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-你的网关key" -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":[{"type":"text","text":"这张图里有什么？"},{"type":"image_url","image_url":{"url":"https://example.com/screenshot.png"}}]}]}'
```

用 `--detailed_debug` 看日志确认：第 3 步应出现对 `text-model` 的上游调用，第 4 步应出现对 `vision-model` 的上游调用；请求 metadata 含 `auto_router_model` 标记。

### 7.2 上游调用是否真的走了目标模型

在网关日志里核对 upstream 请求的 model 字段（debug 日志会打印 `litellm_params`/deployment 信息），或在多模态模型管理后台看请求计数。

### 7.3 各多模态格式的投递方式（与客户端配合）

| 内容 | OpenAI 格式 | 说明 |
|---|---|---|
| 图片 | `{"type":"image_url","image_url":{"url":"https://… 或 data:image/png;base64,…"}}` | 所有多模态模型都支持 |
| PDF | `{"type":"file","file":{"file_data":"base64…","filename":"a.pdf","format":"pdf"}}` | gpt-4o / gemini / claude 支持；**具体字段以模型为准** |
| 视频 | `{"type":"file","file":{"file_data":"…","filename":"v.mp4","video_metadata":{"fps":1}}}` 或逐帧 `image_url` | gemini 原生支持视频；OpenAI 系常按帧拆图 |
| 音频 | `{"type":"input_audio","input_audio":{"data":"…","format":"wav"}}` | 需模型支持（如 gpt-4o-audio 系） |

⚠️ **PDF/视频支持与否取决于选定的多模态上游模型**，不取决于 litellm（litellm 只透传转换）。选模型时先到供应商官网核对。

## 8. DSH 接入（本机直接使用）

参照路径F（vekenllm 接入）的做法，改 `~/.dsh/settings.yaml`：

```yaml
llm-pi-ai:
  providers:
    litellm-auto:
      displayName: LiteLLM Auto
      apiKeyEnv: LITELLM_API_KEY          # ~/.dsh/.credentials.yaml 里配，值为网关 key
      api: openai-completions
      baseURL: http://127.0.0.1:4000/v1    # 或 litellm 所在机器地址
      models:
        - id: auto
          name: Auto（文本/视觉自动路由）
          contextWindow: 1000000           # 按文本模型的上下文填
          maxTokens: 393216
```

- DSH 的 prompt 内容块只有 text/image 两种（HANDOVER §11.1）：**图片会以 image 块发出 → litellm 收到 image_url → 自动切 vision 模型**，符合「默认文本、有图切多模态」的预期。
- **PDF / 视频 DSH 侧暂不能直接传**（DSH 的 prompt content part 无 file 类型）：可先在 DSH 里用工具把 PDF/视频转成图片再发送，或由 DSH 的 `read_image` 工具读取后以图发送。
- opencode 等其他 OpenAI 兼容客户端：baseURL 指向 litellm `/v1`、模型名 `auto` 即可。

## 9. 注意事项 / 坑

1. **hook 必须覆盖所有多模态块类型**：漏判一种（如客户端用 `input_image` 而只检测了 `image_url`）会把图发给纯文本模型 → 上游 400。§5 的 `MULTIMODAL_BLOCK_TYPES` 已覆盖常见类型；遇到新类型按 §3.4 的 `OpenAIMessageContentListBlock` 扩展。
2. **上下文一致性**：同一会话中途切模型，两条模型看到的仍是同一份完整会话历史（OpenAI 格式），一般无碍；但若 text 与 vision 是**不同供应商**，注意各自的上下文窗口/格式细节差异。
3. **成本**：多模态模型通常更贵、更慢。hook 的 `metadata` 标记可用于按模型统计成本（litellm 自带 spend tracking，`--detailed_debug` 或管理 UI 可见每次调用的真实上游模型）。
4. **`auto` 条目保留为兜底**：即使 hook 未加载（拼写错误、模块路径错），`auto` 直接落到文本模型，行为安全可预期；不要只靠 hook 改写而不定义 `auto` 条目（虽然时序上可行，但兜底更稳）。
5. **安全**：网关 `master_key` 必配；密钥走环境变量（`os.environ/…` 语法），别写进 config.yaml 明文。
6. **版本**：本方案只依赖 pre-call hook 机制（长期稳定），**不依赖** v1.74.9 的 AutoRouter；老版本 litellm 同样可用。本次源码验证基于 clone HEAD `c696fdf`（2026-08-19 前后 main）。
7. **沙箱/本机部署提醒**（本项目经验）：本机已装 Node 24 / Python 环境未知；若在沙箱内 `pip install` 或 `docker` 操作遇文件访问被拒，需按项目惯例提权或改用任务计划执行。

## 10. 参考资料

- LiteLLM 官方仓库：<https://github.com/BerriAI/litellm>（本地只读克隆：`.work/litellm`，HEAD `c696fdf`）
- 修改/拒绝入站请求（pre-call hook）：<https://docs.litellm.ai/docs/proxy/call_hooks>
- 路由与负载均衡：<https://docs.litellm.ai/docs/routing-load-balancing>
- Auto Routing（语义路由，v1.74.9+）：<https://docs.litellm.ai/docs/proxy/auto_routing>
- 自定义回调（CustomLogger）：<https://docs.litellm.ai/docs/observability/custom_callback>
- 关键源码（本次验证依据）：
  - `litellm/proxy/hooks/sensitive_data_routing.py`（官方「hook 改 model」范本）
  - `litellm/proxy/common_request_processing.py`（pre_call_hook 先于 route_request）
  - `litellm/proxy/utils.py`（`pre_call_hook` 实现与回调遍历）
  - `litellm/router_strategy/auto_router/auto_router.py`（语义路由：只提取文本）
  - `litellm/types/llms/openai.py`（多模态 content block 类型：image_url/file/video/document…）
  - `litellm/proxy/example_config_yaml/custom_callbacks1.py`（自定义 callback 写法）
