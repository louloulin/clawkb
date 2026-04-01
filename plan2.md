# ClawKB v2.0 — 基于 memvid-core 的本地优先 AI 知识助手改造计划

> **项目名称**: ClawKB (Local-First AI Knowledge Assistant)
> **核心理念**: 本地优先 + 数据主权 + AI 增强 + memvid 内核
> **参考产品**: 腾讯 IMA (ima.copilot) — 搜读写一体的 AI 工作台
> **核心引擎**: memvid-core 2.0 — 便携式 AI 记忆系统 (.mv2 单文件)
> **日期**: 2026-03-31 (v2.0)

---

## 一、现状分析与关键发现

### 1.1 memvid-core 已启用功能

当前 Cargo.toml 已启用以下 memvid-core feature flags:

| Feature | 状态 | 说明 |
|---------|------|------|
| `lex` | ✅ 已启用 | BM25/Tantivy 全文搜索 |
| `vec` | ✅ 已启用 | HNSW 向量索引 + ONNX 本地 Embedding |
| `pdf_extract` | ✅ 已启用 | 纯 Rust PDF 文本抽取 |
| `temporal_track` | ✅ 已启用 | 自然语言日期解析 + 时间线索引 |
| `parallel_segments` | ✅ 已启用 | 多线程并行导入 |
| `encryption` | ✅ 已启用 | 密码加密 (.mv2e) |

### 1.2 memvid-core 未启用功能

| Feature | 状态 | 说明 | 改造优先级 |
|---------|------|------|-----------|
| `clip` | ❌ 未启用 | CLIP 视觉 Embedding，图片搜索 | P2 |
| `whisper` | ❌ 未启用 | Whisper 音频转录 | P2 |
| `api_embed` | ❌ 未启用 | OpenAI 云端 Embedding API | P1 |
| `symspell_cleanup` | ❌ 未启用 | PDF 文本修复 | P3 |

### 1.3 clawkb-core 关键问题：未利用 memvid 高级能力

经过代码审查，发现 **clawkb-core 仅使用了 memvid 的基础 API**，大量高级功能未被调用:

| memvid 能力 | clawkb-core 使用情况 | 影响 |
|-------------|---------------------|------|
| **向量搜索 (vec)** | `enable_embedding(false)` — **禁用了!** | 语义搜索不工作 |
| **Ask API (RAG)** | ❌ 完全未使用 | 无 AI 问答能力 |
| **LogicMesh (知识图谱)** | ❌ 完全未使用 | 无实体关系图 |
| **MemoryCard (记忆卡片)** | ❌ 完全未使用 | 无结构化实体记忆 |
| **TripletExtractor** | `extract_triplets(true)` 已设置但未读取 | 三元组已抽取但未展示 |
| **EnrichmentEngine** | ❌ 完全未使用 | 无自动富化/规则引擎 |
| **ReplaySession (时光机)** | ❌ 完全未使用 | 无历史回溯 |
| **Auto-tag** | `auto_tag(true)` 已设置 | ✅ 已工作 |
| **Timeline** | ✅ 基础使用 | 时间线可用 |
| **Search (hybrid)** | ✅ 基础使用 | 搜索可用 |

### 1.4 前端现状

| 模块 | 页面 | 组件数 | 状态 |
|------|------|--------|------|
| Dashboard | ✅ | 统计卡片、快捷操作 | 完整 |
| Search | ✅ | 搜索栏、结果卡片 | 完整 |
| Notes | ✅ | 添加笔记表单 | 完整 |
| Import | ✅ | 文件导入、URL 导入 | 完整 |
| Timeline | ✅ | 时间线条目 | 完整 |
| Tags | ✅ | 标签云、筛选 | 完整 |
| Entities | ✅ | 实体列表 | 基础(仅正则) |
| Settings | ✅ | KB 管理、导出 | 完整 |
| **Chat (AI 对话)** | ❌ | - | **缺失** |
| **Reader (文档阅读)** | ❌ | - | **缺失** |
| **Editor (AI 写作)** | ❌ | - | **缺失** |
| **MindMap (思维导图)** | ❌ | - | **缺失** |
| **Graph (知识图谱)** | ❌ | - | **缺失** |

---

## 二、改造核心理念：memvid 作为唯一内核

### 2.1 原则

1. **memvid 即引擎** — 不自建 RAG、Embedding、知识图谱、实体抽取，全部使用 memvid 内置能力
2. **UI 层是创新点** — 参考 IMA 的搜读写体验，构建前端交互界面
3. **只做桥接** — clawkb-core 是 memvid API 的薄封装，Tauri 命令暴露 memvid 能力给前端
4. **增量启用** — 分阶段启用 memvid 的 Ask、LogicMesh、MemoryCard、Whisper、CLIP

### 2.2 架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                    ClawKB v2.0 — IMA 风格 UI                     │
├──────────────────────────────────────────────────────────────────┤
│  React 19 + TypeScript + shadcn/ui + Tailwind CSS 4             │
│                                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ Chat │ │Search│ │Reader│ │Editor│ │ Mind │ │Graph │        │
│  │ 搜/问 │ │ 搜索  │ │ 阅读  │ │ 写作  │ │ 导图  │ │ 图谱  │        │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘        │
│     │        │        │        │        │        │              │
├─────┴────────┴────────┴────────┴────────┴────────┴──────────────┤
│  Tauri v2 Commands (桥接层)                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ai_ask · ai_ask_stream · search_kb · ask_context_only  │    │
│  │ list_entities · traverse_graph · get_entity_state       │    │
│  │ enrich_kb · list_memories · get_memory_cards            │    │
│  │ create_kb · open_kb · add_note · import_* · timeline    │    │
│  │ ask_as_of · replay_to · get_checkpoint                  │    │
│  └──────────────────────┬──────────────────────────────────┘    │
├─────────────────────────┴───────────────────────────────────────┤
│  clawkb-core (薄封装)                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ KnowledgeBase { mem: Memvid }                            │    │
│  │                                                          │    │
│  │ ask()           → mem.ask(AskRequest)     // RAG 问答   │    │
│  │ search()        → mem.search(SearchRequest) // 搜索     │    │
│  │ list_entities() → mem.follow entities     // 实体列表   │    │
│  │ traverse()      → mem.follow traverse     // 图谱遍历   │    │
│  │ entity_state()  → mem.state(entity)       // O(1)查询   │    │
│  │ enrich()        → mem.enrich('rules')     // 规则富化   │    │
│  │ memories()      → mem.memories()          // 记忆卡片   │    │
│  │ timeline()      → mem.timeline(query)     // 时间线     │    │
│  │ stats()         → mem.stats()             // 统计       │    │
│  │ commit()        → mem.commit()            // 提交       │    │
│  └─────────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────────┤
│  memvid-core 2.0 (唯一存储与 AI 引擎)                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ .mv2 单文件格式                                          │    │
│  │                                                          │    │
│  │ [Ask API]     RAG 问答 + 来源引用 + Grounding 检测      │    │
│  │ [LogicMesh]   实体图谱 + 关系遍历 + 图过滤搜索          │    │
│  │ [MemoryCard]  实体-槽位-值 记忆卡片 + 规则引擎          │    │
│  │ [Embedding]   ONNX 本地 (bge-small/base/nomic/gte)      │    │
│  │              OpenAI 云端 (text-embedding-3-small/large)  │    │
│  │ [Search]      BM25 + HNSW + Hybrid 混合搜索             │    │
│  │ [Timeline]   时间线索引 + 自然语言日期                    │    │
│  │ [Replay]      时光机 + Checkpoint + StateSnapshot       │    │
│  │ [Whisper]     音频转录 (可选 feature)                    │    │
│  │ [CLIP]        视觉 Embedding (可选 feature)              │    │
│  │ [Encryption]  密码加密 (.mv2e)                           │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 三、分阶段实施计划

---

### Phase 6: 启用 memvid 向量搜索 + AI 问答 (核心"搜"能力)

**目标**: 启用 memvid 的 Embedding + Ask API，实现 IMA 风格的 AI 对话问答

**工期**: 1.5 周

#### 6.1 启用向量搜索 (clawkb-core 修复)

> **关键修复**: 当前 `enable_embedding(false)` 导致语义搜索完全无效

| 任务 | 文件 | 说明 |
|-----|------|------|
| 启用 Embedding | `crates/clawkb-core/src/kb.rs` | `add_note()` 和 `import_file()` 改为 `enable_embedding(true)` |
| 添加 Embedding 配置 | `crates/clawkb-core/src/kb.rs` | 支持选择本地/云端 Embedding 模型 |
| 启用 api_embed feature | `Cargo.toml` | 添加 `api_embed` 到 memvid-core features |
| 添加 ask 方法 | `crates/clawkb-core/src/kb.rs` | 封装 `mem.ask(AskRequest)` 返回 AskResponse |
| 添加 ask_context_only | `crates/clawkb-core/src/kb.rs` | 获取检索上下文不生成回答 (用于前端自定义 LLM) |

```rust
// kb.rs 新增方法
impl KnowledgeBase {
    /// AI 问答 — 使用 memvid 内置 Ask API
    pub fn ask(&mut self, question: &str, model: Option<&str>) -> Result<AskResult> {
        let request = AskRequest::builder()
            .question(question.to_string())
            .top_k(8)
            .snippet_chars(480)
            .mode("hybrid")
            .build();
        let response = self.mem.ask(request)
            .map_err(|e| KbError::Memvid(e.to_string()))?;
        // 转换为 AskResult
        Ok(AskResult {
            answer: response.answer,
            context: response.context,
            sources: response.citations,
            grounding: response.grounding,
        })
    }

    /// 仅获取检索上下文 (不调用 LLM 合成)
    pub fn ask_context_only(&mut self, question: &str) -> Result<Vec<ContextChunk>> {
        let request = AskRequest::builder()
            .question(question.to_string())
            .context_only(true)
            .top_k(10)
            .build();
        // ...
    }
}
```

#### 6.2 Tauri AI 命令

| 任务 | 文件 | 说明 |
|-----|------|------|
| ai_ask 命令 | `src-tauri/src/commands/mod.rs` | 调用 `kb.ask()` 返回 AI 回答 |
| ai_ask_context 命令 | `src-tauri/src/commands/mod.rs` | 仅返回检索上下文 (前端自定义 LLM) |
| set_embedding_model 命令 | `src-tauri/src/commands/mod.rs` | 切换 Embedding 模型 |

#### 6.3 Chat 对话页面 (前端)

| 任务 | 文件 | 说明 |
|-----|------|------|
| Chat 页面 | `src/src/components/pages/chat.tsx` | IMA 风格对话界面 |
| ChatMessage 组件 | `src/src/components/chat/chat-message.tsx` | 用户/AI 消息气泡 |
| ChatInput 组件 | `src/src/components/chat/chat-input.tsx` | 输入框 + 发送 |
| SourcePanel 组件 | `src/src/components/chat/source-panel.tsx` | 引用来源侧边栏 |
| Chat Store | `src/src/store/chat-store.ts` | 对话历史状态 |
| 导航更新 | `src/src/components/layout.tsx` | 侧边栏添加 Chat 入口 |

> **设计参考**: IMA 的对话框风格 — 居中对话流，回答下方显示来源引用卡片，支持流式输出

#### 6.4 前端 AI 提供者 (可选增强)

> memvid Ask API 已内置 LLM 合成。如需自定义 LLM (如 OpenAI/Anthropic)，前端可获取 context_only 然后自行调用云端 API。

| 任务 | 文件 | 说明 |
|-----|------|------|
| AI 类型定义 | `src/src/ai/types.ts` | AIProvider, ChatMessage 接口 |
| AI 配置 Store | `src/src/store/ai-store.ts` | API Key、模型选择、本地/云端切换 |
| OpenAI 适配器 | `src/src/ai/providers/openai.ts` | 前端直接调用 OpenAI API (可选) |
| Anthropic 适配器 | `src/src/ai/providers/anthropic.ts` | 前端直接调用 Claude API (可选) |

> **注意**: 这层是可选的。默认使用 memvid 内置 Ask API (本地 Ollama/TinyLlama)。高级用户可配置自己的 API Key 使用云端模型。

#### 6.5 API 层更新

| 任务 | 文件 | 说明 |
|-----|------|------|
| AI 类型 | `src/src/api/types.ts` | AskResult, ContextChunk, AskCitation |
| AI 命令 | `src/src/api/commands.ts` | ai_ask, ai_ask_context, set_embedding_model |
| Browser Mock | `src/src/api/commands.ts` | 浏览器模式 mock AI 回答 |

#### 6.6 验收标准

- [x] `enable_embedding(true)` — 向量搜索正常工作
- [x] `kb.ask()` — AI 问答基于知识库内容回答
- [x] Chat 页面 — IMA 风格对话界面
- [x] 来源追溯 — 回答附带引用来源
- [ ] 模型切换 — memvid 内置模型 (Ollama) 或自定义云端 API
- [x] 对话历史持久化 (localStorage)
- [x] 浏览器模式 mock 数据可预览

---

### Phase 7: 知识图谱 + 实体记忆 (核心"联"能力)

**目标**: 启用 memvid 的 LogicMesh + MemoryCard，实现实体图谱和结构化记忆

**工期**: 1.5 周

#### 7.1 启用 LogicMesh (clawkb-core)

> **关键**: memvid 的 `extract_triplets(true)` 已在 add_note 中设置，三元组已抽取但未被读取。LogicMesh 关系图谱已经存在于 .mv2 中！

| 任务 | 文件 | 说明 |
|-----|------|------|
| 实体列表方法 | `crates/clawkb-core/src/entity.rs` | 封装 `mem` 的实体列举，按 kind 筛选 |
| 图谱遍历方法 | `crates/clawkb-core/src/entity.rs` | 封装 `mem` 的关系遍历 (traverse) |
| 图过滤搜索 | `crates/clawkb-core/src/entity.rs` | 搜索时附加 graph_pattern 条件 |
| 实体状态查询 | `crates/clawkb-core/src/entity.rs` | `mem.state(entity)` O(1) 查询 |

#### 7.2 启用 MemoryCard (clawkb-core)

| 任务 | 文件 | 说明 |
|-----|------|------|
| 规则富化方法 | `crates/clawkb-core/src/kb.rs` | 封装 `mem.enrich('rules')` 提取记忆卡片 |
| 记忆卡片列表 | `crates/clawkb-core/src/kb.rs` | 封装 `mem.memories()` |
| 实体状态查询 | `crates/clawkb-core/src/kb.rs` | 封装 `mem.state(entity)` |
| 添加记忆卡片 | `crates/clawkb-core/src/kb.rs` | 封装 `mem.add_memory_cards()` |

#### 7.3 Tauri 知识图谱命令

| 任务 | 文件 | 说明 |
|-----|------|------|
| list_entities | `src-tauri/src/commands/mod.rs` | 列出所有实体 (支持 kind 筛选) |
| traverse_graph | `src-tauri/src/commands/mod.rs` | 从某实体出发遍历关系 |
| get_entity_state | `src-tauri/src/commands/mod.rs` | 获取实体当前状态 (O(1)) |
| enrich_kb | `src-tauri/src/commands/mod.rs` | 运行规则引擎提取记忆卡片 |
| list_memories | `src-tauri/src/commands/mod.rs` | 获取所有记忆卡片 |

#### 7.4 知识图谱前端

| 任务 | 文件 | 说明 |
|-----|------|------|
| Graph 页面 | `src/src/components/pages/graph.tsx` | 知识图谱可视化页面 |
| 力导向图组件 | `src/src/components/graph/force-graph.tsx` | D3 力导向图渲染 |
| 实体节点组件 | `src/src/components/graph/entity-node.tsx` | 实体节点 (人/组织/地点) |
| 关系边组件 | `src/src/components/graph/relation-edge.tsx` | 关系线 (works_at/located_in) |
| 实体详情面板 | `src/src/components/graph/entity-detail.tsx` | 点击实体查看详情+关系 |
| Graph Store | `src/src/store/graph-store.ts` | 图谱数据状态 |
| Entities 页面增强 | `src/src/components/pages/entities.tsx` | 用 memvid 真实实体数据替换正则匹配 |

#### 7.5 验收标准

- [x] 实体列表展示 (从 memvid LogicMesh 读取)
- [x] 关系图谱可视化 (力导向图) — d3-force SVG 力导向图 + 网格/图谱视图切换
- [x] 实体详情查看 (O(1) state 查询)
- [x] 记忆卡片展示
- [x] 图谱筛选 (按 kind, 按关系类型)
- [ ] 搜索支持 graph_pattern 过滤

---

### Phase 8: 文档阅读 + 智能批注 (核心"读"能力)

**目标**: 实现 IMA 风格的文档阅读器，利用 memvid Ask API 实现文档对话和摘要

**工期**: 1.5 周

#### 8.1 文档阅读器

| 任务 | 文件 | 说明 |
|-----|------|------|
| Reader 页面 | `src/src/components/pages/reader.tsx` | 文档阅读主界面 |
| PDF 渲染 | `src/src/components/reader/pdf-viewer.tsx` | react-pdf 渲染 |
| Markdown 渲染 | `src/src/components/reader/md-viewer.tsx` | react-markdown 增强 |
| 文档大纲 | `src/src/components/reader/document-outline.tsx` | TOC 导航 |

#### 8.2 文档对话 (基于 memvid Ask API)

> **关键**: 不需要自建 RAG — 直接使用 memvid Ask API，限定 scope 为当前文档

| 任务 | 文件 | 说明 |
|-----|------|------|
| 单文档问答 | `crates/clawkb-core/src/kb.rs` | `ask()` 限定 scope/uri 为当前文档 |
| 文档摘要 | `crates/clawkb-core/src/kb.rs` | Ask "请总结这篇文档的主要内容" |
| 跨文档问答 | `crates/clawkb-core/src/kb.rs` | 多文档 scope 搜索 |
| 对话面板 | `src/src/components/reader/doc-chat.tsx` | 文档内对话面板 |

#### 8.3 划词功能

| 任务 | 文件 | 说明 |
|-----|------|------|
| 文本选择菜单 | `src/src/components/reader/selection-menu.tsx` | 划词弹出菜单 |
| AI 解释 | `src/src/components/reader/ai-explain.tsx` | Ask API 解释选中文字 |
| 划词翻译 | `src/src/components/reader/ai-translate.tsx` | Ask API 翻译 |
| 高亮批注 | `src/src/components/reader/highlight.tsx` | 文本高亮保存 |
| 批注面板 | `src/src/components/reader/annotation-panel.tsx` | 批注列表 |

#### 8.4 验收标准

- [x] Markdown 文档渲染
- [x] 基于文档的 AI 对话 (memvid Ask scope)
- [x] 文档一键摘要
- [x] 划词解释/翻译 — 选中文字弹出 Explain/Translate 按钮，调用 Ask API
- [x] 文本高亮批注 — 划词高亮保存到 localStorage + 批注面板查看/删除
- [x] PDF 渲染 — react-pdf + pdfjs-dist 集成，PDF 文档自动切换渲染模式，支持翻页和缩放

---

### Phase 9: AI 写作助手 (核心"写"能力)

**目标**: 实现 IMA 风格的 AI 辅助写作，利用 memvid Ask API 获取知识库上下文

**工期**: 1 周

#### 9.1 富文本编辑器

| 任务 | 文件 | 说明 |
|-----|------|------|
| 编辑器集成 | `src/src/components/editor/rich-editor.tsx` | TipTap 富文本编辑器 |
| 工具栏 | `src/src/components/editor/editor-toolbar.tsx` | 格式化工具 |

#### 9.2 AI 写作 (基于 memvid 上下文)

> **关键**: 写作时使用 `ask_context_only` 从知识库检索相关内容，前端 LLM 生成写作建议

| 任务 | 文件 | 说明 |
|-----|------|------|
| `/` 命令面板 | `src/src/components/editor/slash-commands.tsx` | 输入 / 触发 AI 命令 |
| AI 续写 | `src/src/components/editor/ai-continue.tsx` | 基于知识库上下文续写 |
| AI 扩写/缩写/润色 | `src/src/components/editor/ai-transform.tsx` | 选中文本变换 |
| 写作模板 | `src/src/components/editor/templates.tsx` | 文章/报告/邮件模板 |

#### 9.3 验收标准

- [x] TipTap 富文本编辑器
- [x] `/` 触发 AI 命令
- [x] 基于知识库上下文的 AI 写作 (ask_context_only)
- [x] 续写/扩写/缩写/润色/翻译 — AI 命令面板 (需 LLM provider 生成实际内容，当前为 KB 上下文 + 提示)
- [x] 写作模板 — 6 种预设模板 (空白/文章/报告/邮件/会议记录/提案) + 模板选择器

---

### Phase 10: 增强知识库管理 + 多模态导入

**目标**: 启用 memvid Whisper + CLIP，增强知识库管理功能

**工期**: 1.5 周

#### 10.1 启用多模态导入 (memvid 原生)

| 任务 | 文件 | 说明 |
|-----|------|------|
| 启用 whisper feature | `Cargo.toml` | 添加 `whisper` 到 memvid-core features |
| 启用 clip feature | `Cargo.toml` | 添加 `clip` 到 memvid-core features |
| 音频导入 | `crates/clawkb-core/src/import.rs` | MP3/WAV → memvid Whisper 转录 → add_note |
| 图片导入 | `crates/clawkb-core/src/import.rs` | JPEG/PNG → memvid CLIP embedding |
| 前端导入增强 | `src/src/components/pages/import.tsx` | 支持音频/图片文件选择 |

#### 10.2 文件夹系统

| 任务 | 文件 | 说明 |
|-----|------|------|
| 文件夹数据结构 | `crates/clawkb-core/src/kb.rs` | 使用 memvid tag 作为文件夹概念 |
| 文件夹树组件 | `src/src/components/kb/folder-tree.tsx` | 左侧文件夹导航 |
| 拖拽移动 | `src/src/components/kb/drop-zone.tsx` | 拖拽文件到文件夹 |
| 批量操作 | `src/src/components/kb/bulk-actions.tsx` | 多选 + 批量删除/标签/导出 |

#### 10.3 标签增强

| 任务 | 文件 | 说明 |
|-----|------|------|
| 标签云增强 | `src/src/components/pages/tags.tsx` | 使用 memvid 原生 tag API |
| 标签重命名 | `crates-clawkb-core/src/kb.rs` | 批量更新 tag |
| 标签合并 | `crates-clawkb-core/src/kb.rs` | 合并同义标签 |

#### 10.4 验收标准

- [ ] 音频导入 + Whisper 转录 — 需要 whisper feature + ML 模型下载
- [ ] 图片导入 + CLIP 搜索 — 需要 clip feature + ML 模型下载
- [x] 文件夹导航 (基于 tag) — Tag Folders 视图 + 点击过滤
- [x] 批量操作 — 搜索结果多选 + 批量打标签 + 批量导出 JSON
- [x] 标签管理增强 — 排序(按数量/A-Z) + 搜索过滤 + 统计摘要

---

### Phase 11: 高级功能 (思维导图 + 时光机 + 全局划词)

**目标**: 启用 memvid Replay 时光机，实现思维导图和全局划词

**工期**: 1.5 周

#### 11.1 思维导图

| 任务 | 文件 | 说明 |
|-----|------|------|
| AI 生成导图 | `src/src/components/mindmap/mind-map.tsx` | Ask API 生成大纲 → 渲染导图 |
| 导图编辑 | `src/src/components/mindmap/mindmap-editor.tsx` | 节点增删改 |
| 导图导出 | `src/src/components/mindmap/mindmap-export.tsx` | PNG/SVG/Markdown |

#### 11.2 时光机 (memvid ReplaySession)

| 任务 | 文件 | 说明 |
|-----|------|------|
| 启用回放方法 | `crates/clawkb-core/src/kb.rs` | 封装 `mem` 的 replay/checkpoint |
| ask_as_of 命令 | `src-tauri/src/commands/mod.rs` | 查询特定时间点的知识库状态 |
| 时光机 UI | `src/src/components/timeline/time-travel.tsx` | 时间轴拖动 + 回溯查询 |
| 历史对比 | `src/src/components/timeline/history-diff.tsx` | 对比不同时间点的差异 |

#### 11.3 全局划词 (Tauri 桌面端)

| 任务 | 文件 | 说明 |
|-----|------|------|
| 系统托盘 | `src-tauri/src/tray.rs` | 后台运行 |
| 全局快捷键 | `src-tauri/src/hotkey.rs` | 划词触发 |
| 悬浮窗口 | `src/src/components/floating-window.tsx` | 划词 AI 窗口 |

#### 11.4 验收标准

- [x] 从文档/对话生成思维导图 — MindMap 页面使用 Ask API 生成结构化大纲 + 可视化树结构渲染
- [x] 知识库时光机 (查询历史状态) — replay feature 已启用，Rust replay 模块 + 前端 Time Machine UI（时间选择 + 历史搜索 + 历史问答）
- [ ] 全局划词 (Tauri 桌面端) — 需系统托盘 + 全局快捷键 + 悬浮窗口

---

### Phase 12: 同步与生态 (未来)

**目标**: 实现多端同步和第三方集成

**工期**: 待定

#### 12.1 同步方案

| 任务 | 说明 |
|-----|------|
| WebDAV 同步 | .mv2 文件同步到 WebDAV |
| S3 兼容存储 | .mv2 文件同步到 S3 |
| 增量同步 | 只同步变更部分 |

#### 12.2 移动端

| 任务 | 说明 |
|-----|------|
| Tauri Mobile | iOS/Android 原生应用 |
| 响应式优化 | 移动端 UI 优化 |

#### 12.3 浏览器扩展

| 任务 | 说明 |
|-----|------|
| Chrome 扩展 | 网页一键保存到知识库 |
| 侧边栏 | 快速 AI 问答 |

---

## 四、关键变更：与旧计划的差异

### 4.1 删除的内容 (memvid 已内置，无需自建)

| 旧计划内容 | 删除原因 | memvid 替代 |
|-----------|---------|------------|
| 自建 AI Provider 抽象层 | memvid Ask API 已内置多模型支持 | `AskRequest.use_model` |
| 自建 RAG Engine | memvid 有完整 RAG 管道 | `mem.ask(AskRequest)` |
| 自建 Embedding Service | memvid 有 ONNX 本地 + OpenAI 云端 | feature flags: `vec`, `api_embed` |
| 自建 上下文构建器 | memvid Ask API 自动构建上下文 | `AskRequest.context_only=true` |
| 自建 知识图谱 | memvid LogicMesh 已内置 | `extract_triplets(true)` + traverse |
| 自建 实体抽取 | memvid TripletExtractor 已内置 | `PutOptions.extract_triplets(true)` |
| 自建 Enrichment | memvid EnrichmentEngine 已内置 | `mem.enrich('rules')` |
| 自建 音频转录 | memvid WhisperTranscriber 已内置 | feature flag: `whisper` |
| 自建 图片搜索 | memvid CLIP 已内置 | feature flag: `clip` |

### 4.2 新增内容 (充分利用 memvid)

| 新增内容 | memvid API | 说明 |
|---------|-----------|------|
| Ask API 问答 | `mem.ask()` | 核心对话能力 |
| LogicMesh 图谱 | `mem.follow traverse` | 知识图谱可视化 |
| MemoryCard 记忆 | `mem.memories()` / `mem.state()` | 结构化实体记忆 |
| Grounding 检测 | `AskResponse.grounding` | 幻觉检测/可信度评分 |
| 时光机 | `mem.replay()` / `ask --as-of-frame` | 知识库历史回溯 |
| 规则富化 | `mem.enrich('rules')` | 自动提取结构化信息 |
| 图过滤搜索 | `graph_pattern` 参数 | 搜索时叠加图谱条件 |

### 4.3 核心修复

| 修复 | 文件 | 说明 |
|-----|------|------|
| `enable_embedding(false)` → `true` | `kb.rs:75` | 启用向量搜索 |
| 读取三元组数据 | `entity.rs` | 展示已抽取的实体关系 |
| 启用 `api_embed` feature | `Cargo.toml` | 支持云端 Embedding |

---

## 五、文件变更清单

### 5.1 Rust 后端变更

```
# 修改
Cargo.toml                              # 添加 api_embed, whisper, clip features
crates/clawkb-core/src/kb.rs            # 启用 embedding, 添加 ask/ask_context/enrich/memories/replay 方法
crates/clawkb-core/src/entity.rs        # 重写为使用 LogicMesh API
crates/clawkb-core/src/import.rs        # 添加音频/图片导入
src-tauri/src/commands/mod.rs           # 添加 AI/图谱/记忆 Tauri 命令

# 新增
crates/clawkb-core/src/ask.rs           # Ask API 封装
crates/clawkb-core/src/memory.rs        # MemoryCard 封装
src-tauri/src/tray.rs                   # 系统托盘 (Phase 11)
src-tauri/src/hotkey.rs                 # 全局快捷键 (Phase 11)
```

### 5.2 React 前端变更

```
# 修改
src/src/components/layout.tsx           # 侧边栏添加 Chat/Reader/Graph 入口
src/src/components/pages/entities.tsx   # 使用 memvid 真实实体数据
src/src/components/pages/tags.tsx       # 增强 tag 管理
src/src/components/pages/import.tsx     # 添加音频/图片导入
src/src/api/types.ts                    # 添加 AI/图谱/记忆类型
src/src/api/commands.ts                 # 添加 AI/图谱 API 调用
src/src/store/kb-store.ts              # 添加新状态字段
src/App.tsx                             # 添加新路由

# 新增
src/src/components/pages/chat.tsx       # AI 对话页面
src/src/components/pages/reader.tsx     # 文档阅读页面
src/src/components/pages/graph.tsx      # 知识图谱页面
src/src/components/chat/                # Chat 子组件
src/src/components/reader/              # Reader 子组件
src/src/components/editor/              # Editor 子组件
src/src/components/graph/               # Graph 子组件
src/src/components/mindmap/             # MindMap 子组件
src/src/store/chat-store.ts            # 对话状态
src/src/store/ai-store.ts              # AI 配置状态
src/src/store/graph-store.ts           # 图谱状态
src/src/ai/types.ts                    # AI 类型 (可选，前端 LLM)
src/src/ai/providers/                  # AI 适配器 (可选，前端 LLM)
```

### 5.3 依赖项变更

```toml
# Cargo.toml — memvid-core features 更新
memvid-core = { version = "2.0", features = [
    "lex", "vec", "pdf_extract", "temporal_track",
    "parallel_segments", "encryption",
    "api_embed",       # 新增: OpenAI 云端 Embedding
    "whisper",         # 新增: 音频转录 (Phase 10)
    "clip",            # 新增: 视觉 Embedding (Phase 10)
] }
```

```json
// package.json — 前端新增依赖
{
  "dependencies": {
    "@tiptap/react": "^2.5.0",
    "@tiptap/starter-kit": "^2.5.0",
    "react-pdf": "^9.0.0",
    "pdfjs-dist": "^4.0.0",
    "d3-force": "^3.0.0",
    "dompurify": "^3.0.0"
  }
}
```

> **注意**: 不需要 `@ai-sdk/openai`, `@ai-sdk/anthropic`, `ai` 等 AI SDK — 因为 AI 问答由 memvid Ask API 在 Rust 层处理。前端仅在需要自定义 LLM 时才引入。

---

## 六、里程碑

| 阶段 | 里程碑 | 预计完成 | 核心交付 |
|-----|--------|---------|---------|
| Phase 6 | AI 问答 MVP | 第 1.5 周末 | Chat 页面 + memvid Ask API + Embedding 启用 |
| Phase 7 | 知识图谱 | 第 3 周末 | LogicMesh 图谱可视化 + MemoryCard |
| Phase 8 | 文档阅读 | 第 4.5 周末 | PDF 阅读器 + 文档对话 + 划词 |
| Phase 9 | AI 写作 | 第 5.5 周末 | TipTap 编辑器 + / 命令 + 知识库引用 |
| Phase 10 | 多模态导入 | 第 7 周末 | Whisper 音频 + CLIP 图片 + 文件夹 |
| Phase 11 | 高级功能 | 第 8.5 周末 | 思维导图 + 时光机 + 全局划词 |
| Phase 12 | 同步生态 | TBD | WebDAV + 移动端 + 浏览器扩展 |

---

## 七、风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| memvid Ask API 不支持流式输出 | 用户体验差 (等待时间长) | 使用 context_only + 前端流式 LLM 作为备选 |
| memvec-core Rust API 文档不完善 | 开发困难 | 阅读 memvid-core 源码 + CLI 实现参考 |
| ONNX 模型下载慢 | 首次启动体验差 | 后台下载 + 进度提示 + 默认用 bge-small (120MB) |
| Whisper/CLIP 模型体积大 | 用户磁盘占用 | 按需下载，feature flag 控制 |
| PDF 渲染兼容性 | 显示问题 | 多测试，提供降级方案 |
| LogicMesh 实体抽取质量 | 实体不准确 | memvid 内置 NER + 用户手动修正 |

---

## 八、总结

本计划的核心理念是 **memvid 即引擎**：

1. **不自建** RAG、Embedding、知识图谱、实体抽取 — memvid 已内置
2. **只做桥接** — clawkb-core 封装 memvid API，Tauri 命令暴露给前端
3. **UI 是创新** — 参考 IMA 的搜读写体验，构建前端交互界面
4. **增量启用** — 分阶段启用 memvid Ask、LogicMesh、MemoryCard、Whisper、CLIP

**与旧计划的关键差异**: 旧计划试图自建 AI Provider 层、RAG Engine、Embedding Service、知识图谱 — 这些都是重复造轮子。memvid-core 2.0 已经提供了完整的能力链。新计划聚焦于：

- **启用** memvid 未使用的能力 (embedding、Ask、LogicMesh、MemoryCard)
- **暴露** memvid 能力给前端 (Tauri 命令)
- **构建** IMA 风格 UI (Chat、Reader、Editor、Graph)

**数据永远在用户本地的 .mv2 单文件中**。

---

*文档版本: v2.0 (memvid-centric)*
*创建日期: 2026-03-31*
*作者: Claude Code*
*核心引擎: memvid-core 2.0 — https://memvid.com*
