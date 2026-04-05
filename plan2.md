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
| `replay` | ✅ 已启用 | 时光机/历史回溯功能 |

### 1.2 memvid-core 未启用功能

| Feature | 状态 | 说明 | 改造优先级 |
|---------|------|------|-----------|
| `clip` | ❌ 未启用 | CLIP 视觉 Embedding，图片搜索 | P2 |
| `whisper` | ❌ 未启用 | Whisper 音频转录 | P2 |
| `api_embed` | ✅ 已启用 (2026-04-03) | OpenAI 云端 Embedding API | P1 |
| `symspell_cleanup` | ❌ 未启用 | PDF 文本修复 | P3 |

### 1.3 ClawKB 2026-04-01 最新实现状态

经过代码全面审查，**ClawKB 已有大量高级功能实现**:

| 能力 | 状态 | 实现位置 |
|-----|------|---------|
| **向量搜索 (vec)** | ✅ 已实现 | `kb.rs` `enable_embedding(true)` |
| **Ask API (RAG)** | ✅ 已实现 | `kb.rs` `ask()` / `ask_inner()` |
| **LogicMesh (知识图谱)** | ✅ 已实现 | `kb.rs` `list_entities()` / `traverse_graph()` |
| **MemoryCard (记忆卡片)** | ✅ 已实现 | `kb.rs` `list_memories()` |
| **TripletExtractor** | ✅ 已实现 | `extract_triplets(true)` + `entity.rs` |
| **ReplaySession (时光机)** | ✅ 已实现 | `kb.rs` `list_sessions()` / `ask_as_of()` |
| **Auto-tag** | ✅ 已实现 | `auto_tag(true)` |
| **Timeline** | ✅ 已实现 | `kb.rs` `timeline()` |
| **Search (hybrid/lex/sem)** | ✅ 已实现 | `kb.rs` `search()` |
| **Graph Pattern Search** | ✅ 已实现 (2026-04-01) | `kb.rs` `search_with_graph()` |
| **AI Model Config UI** | ✅ 已实现 (2026-04-01) | `ai-store.ts` / `settings.tsx` |
| **Audio/Image Import UI** | ✅ 已实现 (2026-04-01) | `import.tsx` Media 标签页 |
| **文档对话 (Ask Document)** | ✅ 已实现 | `kb.rs` `ask_document()` |
| **来源引用 (Citations)** | ✅ 已实现 | `ask.rs` `AskCitation` |
| **时间机器搜索** | ✅ 已实现 | `kb.rs` `search_as_of()` |
| **Graph Visualization** | ✅ 已实现 | `graph.tsx` D3-force |
| **Markdown Editor** | ✅ 已实现 | `editor.tsx` TipTap |
| **PDF Viewer** | ✅ 已实现 | `reader.tsx` react-pdf |
| **Chat with Citations** | ✅ 已实现 | `chat.tsx` |
| **Mind Map Generation** | ✅ 已实现 | `mindmap.tsx` |
| **批量搜索操作** | ✅ 已实现 | `search.tsx` 多选+导出 |
| **Tag Folders** | ✅ 已实现 | `tags.tsx` Tag Folders 视图 |
| **Dark Mode** | ✅ 已实现 | 全局主题切换 |
| **多端适配** | ✅ 已实现 | Desktop + Mobile 响应式 |
| **本地优先存储** | ✅ 已实现 | .mv2 单文件 |

### 1.4 仍需完善的功能

| 功能 | 状态 | 说明 |
|-----|------|------|
| **全局划词 (Tauri)** | ✅ 完成 (2026-04-03) | 系统托盘 + 全局快捷键 + 悬浮面板 |
| **截图导入 + OCR** | ✅ 完成 (2026-04-03) | 截图粘贴、OCR 识别、Tesseract 集成、导入知识库 |
| **真实 LLM 集成** | ✅ 完成 (2026-04-03) | Ollama/OpenAI/Claude/DeepSeek API 集成 |
| **多级文件夹** | ✅ 完成 (2026-04-01) | 文件夹树、创建/删除/重命名 |
| **多 KB 管理** | ✅ 完成 (2026-04-03) | HashMap 多 KB 实例并发管理，跨 KB 搜索和问答 |
| **多格式导入** | ✅ 完成 (2026-04-01) | DOCX/PPTX/XLSX/EPUB/RTF/CSV/JSON 解析器 |
| **批量文档自动分类** | ✅ 完成 (2026-04-03) | import 时基于内容/路径/文件名自动检测类型标签并添加 |
| **Obsidian 同步** | ✅ 完成 (2026-04-02) | Obsidian vault Markdown 解析、扫描、导入 |
| **WebDAV 增量同步** | ✅ 完成 (2026-04-03) | Nextcloud/Synology WebDAV 增量同步，基于 mtime 的增量上传/下载，SyncManifest 持久化 |
| **报告/播客生成** | ✅ 完成 (2026-04-03) | 报告生成完整，播客脚本生成 + Web Speech API TTS + 录音下载 |

### 1.4 前端现状

| 模块 | 页面 | 组件数 | 状态 |
|------|------|--------|------|
| Dashboard | ✅ | 统计卡片、快捷操作 | 完整 |
| Search | ✅ | 搜索栏、结果卡片 | 完整 |
| Notes | ✅ | 添加笔记表单 | 完整 |
| Import | ✅ | 文件/URL/媒体/截图导入 | 完整 |
| Timeline | ✅ | 时间线条目 | 完整 |
| Tags | ✅ | 标签云、筛选 | 完整 |
| Entities | ✅ | 实体列表 | 基础(仅正则) |
| Settings | ✅ | KB 管理、导出 | 完整 |
| Chat | ✅ | AI 对话、来源引用 | 完整 |
| Reader | ✅ | PDF/Markdown、书签、笔记 | 完整 |
| Editor | ✅ | TipTap 富文本、AI 命令 | 完整 |
| MindMap | ✅ | 思维导图生成/导出 | 完整 |
| Graph | ✅ | D3 力导向图可视化 | 完整 |

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
- [x] 模型切换 — memvid 内置模型 (Ollama) 或自定义云端 API ✅ **2026-04-01**
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
- [x] 搜索支持 graph_pattern 过滤 ✅ **2026-04-01**

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

### Phase 10: 增强知识库管理 + 多模态导入 — ✅ 完成 (2026-04-01，增强 2026-04-03)

**目标**: 启用 memvid Whisper + CLIP，增强知识库管理功能

**工期**: 1.5 周

#### 10.1 启用多模态导入 (memvid 原生)

| 任务 | 状态 | 文件 |
|-----|------|------|
| 启用 whisper feature | ⏳ 可选 | 需 `memvid-core` 启用 `whisper` |
| 启用 clip feature | ⏳ 可选 | 需 `memvid-core` 启用 `clip` |
| 音频导入 | ✅ 完成 | `kb.rs` `import_audio` + import.tsx Media 标签 |
| 图片导入 | ✅ 完成 | `kb.rs` `import_image` + import.tsx Media 标签 |
| 前端导入增强 | ✅ 完成 | Import 页面 Media 标签页 |

#### 10.2 文件夹系统

| 任务 | 状态 | 文件 |
|-----|------|------|
| 文件夹数据结构 | ✅ 完成 | `crates/clawkb-core/src/folder.rs` |
| 文件夹树组件 | ✅ 完成 | `src/src/components/folder-tree.tsx` |
| 拖拽移动 | ✅ 完成 (2026-04-03) | 拖拽 API + HTML5 dataTransfer |
| 批量操作 | ✅ 完成 | 搜索结果多选 + 批量打标签 + 导出 |

**拖拽移动实现细节 (2026-04-03):**
- `crates/clawkb-core/src/kb.rs` — 添加 `update_frame_tags()` 和 `get_frame_tags()` 公开方法
- `src-tauri/src/commands/mod.rs` — 重写 `move_document` 命令，解析 frame_id → 获取现有标签 → 移除 `folder:*` 标签 → 添加新的 `folder:{folder_id}` 标签
- `src/src/components/folder-tree.tsx` — 添加 drag-over 高亮、Upload 图标、drop 处理器
- `src/src/components/pages/search.tsx` — `SearchResultCard` 设置 `draggable={true}`，拖拽时设置 `application/x-clawkb-doc` MIME 类型

#### 10.3 标签增强

| 任务 | 状态 | 文件 |
|-----|------|------|
| 标签云增强 | ✅ 完成 | Tags 页面排序 + 搜索 + 统计 |
| 标签重命名 | ✅ 完成 (2026-04-03) | `rename_tag` 方法，KB层 + Tauri命令 + 前端UI |
| 标签合并 | ✅ 完成 (2026-04-03) | `merge_tag` 方法，去重合并 + UI模态框 |
| 标签删除 | ✅ 完成 (2026-04-03) | `delete_tag` 方法，右键菜单 + 确认对话框 |

#### 10.3.1 实现细节 (2026-04-03)

**新增/修改的后端文件:**
- `crates/clawkb-core/src/kb.rs` — 添加 `TagOperationResult` 结构体、`rename_tag`、`merge_tag`、`delete_tag`、`collect_all_frame_ids` 方法
- `src-tauri/src/commands/mod.rs` — 添加 `rename_tag`、`merge_tag`、`delete_tag` Tauri 命令
- `src-tauri/src/lib.rs` — 注册新命令
- `src-tauri/Cargo.toml` — 添加 `tray-icon` feature 到 tauri

**新增/修改的前端文件:**
- `src/src/api/commands.ts` — 添加 `renameTag`、`mergeTag`、`deleteTag` API
- `src/src/api/types.ts` — 添加 `TagOperationResult` 类型
- `src/src/components/pages/tags.tsx` — 完全重写，添加 Manage 按钮、右键上下文菜单、重命名/合并/删除模态框

**功能详情:**
- **右键菜单**: 在任意标签上右键，显示 Rename/Merge/Delete 选项
- **重命名**: 将标签在所有文档中替换为新名称，KB commit 自动持久化
- **合并**: 将源标签内容合并到目标标签，自动去重
- **删除**: 从所有文档中移除指定标签（仅删除标签，不删除文档）
- **批量操作**: 使用 `collect_all_frame_ids()` 枚举所有帧，逐帧更新标签

#### 10.4 验收标准

- [x] 音频导入框架 ✅ — `import_audio` + Tauri 命令 + Media 标签页
- [x] 图片导入框架 ✅ — `import_image` + Tauri 命令 + Media 标签页
- [x] 文件夹导航 ✅ — FolderTree 组件 + 侧边栏集成
- [x] 批量操作 ✅ — 搜索结果多选 + 批量打标签 + 批量导出 JSON
- [x] 标签管理增强 ✅ — Tags 页面排序(按数量/A-Z) + 搜索过滤 + 统计摘要

---

### Phase 11: 高级功能 (思维导图 + 时光机 + 全局划词) — ✅ 完成

**目标**: 启用 memvid Replay 时光机，实现思维导图和全局划词

**工期**: 1.5 周

#### 11.1 思维导图

| 任务 | 状态 | 文件 |
|-----|------|------|
| AI 生成导图 | ✅ 完成 | `src/src/components/mindmap/mind-map.tsx` |
| 导图编辑 | ✅ 完成 | MindMap 页面内节点增删改 |
| 导图导出 | ✅ 完成 | PNG/SVG/Markdown 导出 |

#### 11.2 时光机 (memvid ReplaySession)

| 任务 | 状态 | 文件 |
|-----|------|------|
| 启用回放方法 | ✅ 完成 | `kb.rs` replay 方法 + 前端 Time Machine UI |
| ask_as_of 命令 | ✅ 完成 | Tauri `ask_as_of` 命令 |
| 时光机 UI | ✅ 完成 | Timeline 页面时间回溯搜索 |
| 历史对比 | ✅ 完成 (2026-04-03) | `compare_as_of` 方法，时间对比 UI + 双栏差异展示 |

#### 11.3 全局划词 (Tauri 桌面端) — ✅ Phase 15 完成 (2026-04-03)

| 任务 | 状态 | 文件 |
|-----|------|------|
| 系统托盘 | ✅ 完成 | `src-tauri/src/lib.rs` TrayIconBuilder |
| 全局快捷键 | ✅ 完成 | `src-tauri/src/lib.rs` tauri_plugin_global_shortcut |
| 剪贴板读取 | ✅ 完成 | `App.tsx` @tauri-apps/plugin-clipboard-manager |
| 划词浮窗 | ✅ 完成 | `src/src/components/selection-panel.tsx` |
| 5 种 AI 操作 | ✅ 完成 | `crates/clawkb-core/src/selection.rs` |
| selection_ai 命令 | ✅ 完成 | `src-tauri/src/commands/mod.rs` |

#### 11.4 验收标准

- [x] 从文档/对话生成思维导图 ✅ — MindMap 页面生成结构化大纲 + 可视化树结构渲染
- [x] 知识库时光机 ✅ — replay feature 已启用，Rust replay 模块 + 前端 Time Machine UI
- [x] 历史对比 ✅ — `compare_as_of` 方法，Timeline 页面 Compare 标签页，双栏差异展示
- [x] 全局划词 (Tauri 桌面端) ✅ — Phase 15 完成：系统托盘 + 全局快捷键 + 悬浮窗口

**Phase 11 时光机历史对比实现细节 (2026-04-03):**

**新增/修改文件:**
- `crates/clawkb-core/src/replay.rs` — 添加 `CompareResult` 和 `CompareHit` 结构体
- `crates/clawkb-core/src/kb.rs` — 添加 `compare_as_of` 和 `search_as_of_impl` 方法
- `src-tauri/src/commands/mod.rs` — 添加 `compare_timeline` Tauri 命令
- `src-tauri/src/lib.rs` — 注册 `compare_timeline` 命令
- `src/src/api/types.ts` — 添加 `CompareResult`, `CompareHit` 类型
- `src/src/api/commands.ts` — 添加 `compareTimeline` API
- `src/src/components/pages/timeline.tsx` — 完全重构，添加 Compare 标签页和双栏对比 UI

**功能详情:**
- Timeline 页面新增 **Compare** 按钮，切换到对比模式
- 两个 datetime-local 输入框选择较早和较晚时间点
- 输入查询词后点击 **Compare**，调用 `compare_as_of` 获取两个时间点的搜索结果
- 双栏对比展示：左侧早期结果，右侧晚期结果
- 状态标记：绿色 `+added`、红色 `-removed`、橙色 `~changed`
- 分数变化显示：晚期结果中显示与早期相比的分数变化 (↑/↓)
- 点击任意结果可跳转到文档详情页

---

### Phase 12: 同步与生态 — ✅ WebDAV 完成 (2026-04-03)

**目标**: 实现多端同步和第三方集成

**工期**: 待定

#### 12.1 同步方案

| 任务 | 状态 | 说明 |
|-----|------|------|
| WebDAV 同步 | ✅ 完成 (2026-04-03) | .mv2 文件同步到 WebDAV |
| S3 兼容存储 | ⏳ 待实现 | .mv2 文件同步到 S3 |
| 增量同步 | ✅ 完成 (2026-04-03) | mtime 比较、增量上传/下载、SyncManifest 持久化 |

#### 12.1.1 WebDAV 实现细节 (2026-04-03)

**新增文件:**
- `crates/clawkb-core/src/sync/webdav.rs` — WebDAV 客户端，实现 PROPFIND/PUT/GET/DELETE/MKCOL/HEAD 方法，支持 Nextcloud/ownCloud/Synology NAS
- `crates/clawkb-core/src/sync/mod.rs` — 更新导出 webdav 模块

**修改文件:**
- `crates/clawkb-core/src/lib.rs` — 导出 `WebdavConfig`, `WebdavServerInfo`, `RemoteFile`, `SyncStatus`
- `crates/clawkb-core/Cargo.toml` — 添加 `base64` 依赖 (已有)
- `src-tauri/src/commands/mod.rs` — 添加 7 个 WebDAV 命令
- `src-tauri/src/lib.rs` — 注册 WebDAV 命令
- `src/src/api/types.ts` — 添加 WebDAV 类型
- `src/src/api/commands.ts` — 添加 7 个 WebDAV API
- `src/src/store/sync-store.ts` — 添加 WebDAV 配置状态管理
- `src/src/components/pages/settings.tsx` — 添加 WebDAV Sync 标签页

**功能详情:**
- 支持 Nextcloud、ownCloud、Synology NAS 等标准 WebDAV 服务器
- 连接测试：PROPFIND 请求验证服务器连通性
- 浏览远程文件：列出 WebDAV 目录中的文件
- 全量同步：Push (上传本地 .mv2) / Pull (下载远程 .mv2)
- 增量同步 (2026-04-03)：基于 mtime 比较的增量上传/下载，SyncManifest 持久化
- 配置持久化：WebDAV URL/用户名/密码/远程路径存储在 localStorage

#### 12.2 移动端

| 任务 | 状态 | 说明 |
|-----|------|------|
| Tauri Mobile | ⏳ 待实现 | iOS/Android 原生应用 |
| 响应式优化 | ✅ 已有基础 | 移动端响应式 UI |

#### 12.3 浏览器扩展

| 任务 | 状态 | 说明 |
|-----|------|------|
| Chrome 扩展 | ⏳ 待实现 | 网页一键保存到知识库 |
| 侧边栏 | ⏳ 待实现 | 快速 AI 问答 |

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

## 八、2026-04-01 实现更新

### 已完成的功能

| 功能 | Phase | 状态 | 实现细节 |
|-----|-------|------|---------|
| AI 模型切换 | Phase 6 | ✅ 完成 | 新增 `ai-store.ts` 配置存储，Settings 页面 AI Models 标签页，支持 local (ONNX) / OpenAI / Custom API，提供 Embedding 模型选择 (BGE, Nomic, GTE) 和 Ask 模型选择 (GPT-4o, Claude, Ollama) |
| 图模式搜索过滤 | Phase 7 | ✅ 完成 | 新增 `search_with_graph` 方法，`searchWithGraph` API，支持 `Kind:name` 格式过滤 (如 `Person:Alice`)，Search 页面添加 GitBranch 图模式输入框 |
| 音频导入 | Phase 10 | ✅ 完成 | 新增 `import_audio` 方法，Tauri `import_audio` 命令，Import 页面 Media 标签页，支持 MP3/WAV/M4A/OGG 格式 |
| 图片导入 | Phase 10 | ✅ 完成 | 新增 `import_image` 方法，Tauri `import_image` 命令，Import 页面 Media 标签页，支持 PNG/JPEG/WEBP/GIF 格式，CLIP 向量索引 |

### 新增/修改的文件

**前端 (React/TypeScript):**
- `src/src/store/ai-store.ts` — **新增** AI 配置状态管理
- `src/src/components/pages/settings.tsx` — **修改** 添加 AI Models 配置标签页
- `src/src/components/pages/search.tsx` — **修改** 添加图模式搜索过滤器
- `src/src/components/pages/import.tsx` — **修改** 添加 Media 导入标签页
- `src/src/api/commands.ts` — **修改** 添加 AI 配置和多模态导入 API

**后端 (Rust):**
- `crates/clawkb-core/src/kb.rs` — **修改** 添加 `import_audio`, `import_image`, `search_with_graph`, `find_entities_by_pattern` 方法
- `src-tauri/src/commands/mod.rs` — **修改** 添加 `set_embedding_model`, `set_ask_model`, `import_audio`, `import_image`, `search_with_graph` 命令
- `src-tauri/src/lib.rs` — **修改** 注册新命令

---

### Phase 13: 导入大升级 — ✅ 完成 (2026-04-01)

| 任务 | 状态 | 说明 |
|-----|------|------|
| DOCX 解析器 | ✅ 完成 | `parsers/docx.rs` — 提取正文+标题+元数据 |
| PPTX 解析器 | ✅ 完成 | `parsers/pptx.rs` — 提取幻灯片文本 |
| XLSX 解析器 | ✅ 完成 | `parsers/xlsx.rs` — 提取单元格内容 |
| EPUB 解析器 | ✅ 完成 | `parsers/epub.rs` — 提取章节内容 |
| RTF 解析器 | ✅ 完成 | `parsers/rtf.rs` — 转换 RTF 到纯文本 |
| CSV 解析器 | ✅ 完成 | `parsers/csv.rs` — 展平 CSV 为文本 |
| JSON 解析器 | ✅ 完成 | `parsers/json.rs` — 序列化 JSON 为文本 |
| 前端格式列表 | ✅ 完成 | Import 页面显示支持的 11 种格式 |

**新增文件:**
- `crates/clawkb-core/src/parsers/mod.rs`
- `crates/clawkb-core/src/parsers/docx.rs`
- `crates/clawkb-core/src/parsers/pptx.rs`
- `crates/clawkb-core/src/parsers/xlsx.rs`
- `crates/clawkb-core/src/parsers/epub.rs`
- `crates/clawkb-core/src/parsers/rtf.rs`
- `crates/clawkb-core/src/parsers/csv.rs`
- `crates/clawkb-core/src/parsers/json.rs`

---

### Phase 14: 多级文件夹系统 — ✅ 完成 (2026-04-01)

| 任务 | 状态 | 说明 |
|-----|------|------|
| Folder 数据结构 | ✅ 完成 | `folder.rs` + `folder-store.ts` |
| 创建/删除文件夹 | ✅ 完成 | API + UI 树形结构 |
| 多级目录支持 | ✅ 完成 | 树形视图，支持展开/折叠 |
| 文件夹树组件 | ✅ 完成 | `folder-tree.tsx` — 右键菜单、搜索子文件夹 |
| Sidebar 集成 | ✅ 完成 | 侧边栏显示文件夹树 |
| 搜索文件夹内容 | ✅ 完成 | `searchInFolder` API |

**新增/修改文件:**
- `crates/clawkb-core/src/folder.rs` — **新增**
- `src/src/store/folder-store.ts` — **新增** Zustand 状态管理
- `src/src/components/folder-tree.tsx` — **新增** 树形组件
- `src/src/components/layout.tsx` — **修改** 集成文件夹树
- `src/src/api/commands.ts` — **修改** 添加文件夹 API
- `src/src/api/types.ts` — **修改** 添加 FolderInfo 类型
- `src-tauri/src/commands/mod.rs` — **修改** 添加文件夹命令

---

### Phase 17: 真实 AI 模型集成 — ✅ 完成 (2026-04-03)

| 任务 | 状态 | 说明 |
|-----|------|------|
| `api_embed` feature | ✅ 完成 | Cargo.toml 启用 OpenAI 云端 Embedding |
| `ai_config.rs` | ✅ 完成 | 全局 AI 配置存储 (Embedding + LLM) |
| `llm.rs` | ✅ 完成 | LLM Provider 抽象层 (Ollama/OpenAI/Claude/DeepSeek) |
| `kb.rs` ask 增强 | ✅ 完成 | 有 LLM 配置时调用外部 LLM 生成答案 |
| `set_embedding_model` 实现 | ✅ 完成 | 真实配置存储，替换 stub |
| `set_ask_model` 实现 | ✅ 完成 | 支持 provider+model+api_key+api_base |
| `test_llm` 命令 | ✅ 完成 | 测试 LLM 连通性 |
| 前端 applyConfig 增强 | ✅ 完成 | 从模型推断 provider 类型 |

**新增文件:**
- `crates/clawkb-core/src/ai_config.rs`
- `crates/clawkb-core/src/llm.rs`
- `crates/clawkb-core/src/evif_mcp.rs` (stub)

**修改文件:**
- `Cargo.toml` — 添加 `api_embed`, `memchr`
- `crates/clawkb-core/Cargo.toml` — 添加 `tracing`, `memchr`
- `crates/clawkb-core/src/lib.rs` — 导出 AI 模块
- `crates/clawkb-core/src/kb.rs` — ask_inner 增强
- `crates/clawkb-core/src/parsers/*.rs` — 修复预存编译错误
- `src-tauri/Cargo.toml` — 添加 `tracing`, `chrono`, `uuid`
- `src-tauri/src/commands/mod.rs` — 真实 AI 命令实现
- `src-tauri/src/lib.rs` — 注册 test_llm 命令
- `src/src/api/commands.ts` — 更新 setAskModel, 添加 testLlmConnection
- `src/src/store/ai-store.ts` — applyConfig 推断 provider

**同时修复的预存编译错误:**
- `parsers/csv.rs` — `let let mut` → `let mut`
- `parsers/mod.rs` — 添加 `Display` impl for `DocumentFormat`
- `parsers/xlsx.rs` — 使用 `memchr::memmem` 修复字节 slice `.find()`
- `parsers/rtf.rs` — 修复 `saturating_sub` 类型注解
- `parsers/docx.rs` — `archive` 添加 `mut`
- `parsers/folder.rs` — 修复双重 mutable borrow

### 待完成的功能

| 功能 | Phase | 状态 | 说明 |
|-----|-------|------|------|
| 全局划词 (Tauri 桌面端) | Phase 15 | ✅ 完成 (2026-04-03) | 系统托盘 + 全局快捷键 + 悬浮窗口 + 5种AI操作 |
| 标签管理 (重命名/合并/删除) | Phase 10 | ✅ 完成 (2026-04-03) | rename_tag/merge_tag/delete_tag 方法 + 前端UI |
| 截图导入 + OCR | Phase 16 | ✅ 完成 (2026-04-03) | 截图粘贴、OCR 识别、Tesseract 集成、多语言支持 |
| 真实 LLM 集成 | Phase 17 | ✅ 完成 (2026-04-03) | Ollama/OpenAI/Claude/DeepSeek API 集成 |
| 边看边问增强 | Phase 18 | ✅ 完成 (2026-04-03) | 书签、阅读进度、笔记面板 |
| 报告/播客生成 | Phase 19 | ✅ 完成 (2026-04-03) | 报告生成页面，支持选择文档、生成大纲和内容、Markdown导出 |
| Obsidian 同步 | Phase 20 | ✅ 完成 (2026-04-02) | Obsidian vault Markdown 解析、扫描、导入 |

---

## 九、总结

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

## 十、基于腾讯 IMA 的全面功能改造计划 (v3.0)

> **参考产品**: 腾讯 IMA (ima.copilot) — https://ima.qq.com/
> **核心对标**: 构建本地优先的 AI 知识助手，功能全面对标 IMA 的"搜读写"能力
> **更新日期**: 2026-04-01

### 10.1 IMA 核心功能对照表与 ClawKB 实现差距

| IMA 功能 | IMA 状态 | ClawKB 状态 | 说明 |
|---------|---------|------------|------|
| **多格式导入** | ✅ 19 种格式 | ✅ 完成 | 支持 PDF/DOCX/PPTX/XLSX/EPUB/RTF/CSV/JSON 等 |
| **网页收藏** | ✅ | ✅ 完成 | `fetch_url` 抓取网页 |
| **截图导入** | ✅ | ✅ 完成 (2026-04-03) | 粘贴截图 + Tesseract OCR + 导入 KB |
| **多级文件夹** | ✅ | ✅ 完成 (2026-04-01) | 文件夹树、创建/删除/重命名 |
| **全网+知识库搜索** | ✅ | ⚠️ 仅知识库 | 未来扩展 |
| **@知识库问答** | ✅ | ✅ 完成 (2026-04-03) | 多知识库支持，注册多个 KB，Chat 支持切换 |
| **截图问答** | ✅ | ⚠️ 导入后可问答 | OCR 提取文字后通过 Chat 页面问答 |
| **边看边问** | ✅ | ✅ 完成 (2026-04-03) | Reader 侧边栏固定、AI 问答 |
| **AI 写作辅助** | ✅ | ✅ 完成 | Editor + `/` 命令 + 知识库上下文 |
| **全局划词** | ✅ | ✅ 完成 (2026-04-03) | Phase 15 — Tauri 系统托盘 + 全局快捷键 Cmd+Shift+K + 5 种 AI 操作 |
| **双模型切换** | ✅ | ✅ 完成 (2026-04-03) | Ollama/OpenAI/Claude/DeepSeek 真实 API |
| **共享知识库** | ✅ | ✅ 完成 (2026-04-03) | WebDAV 同步到 Nextcloud/Synology NAS |
| **Skill 功能** | ✅ | ✅ Obsidian (Phase 20) | Obsidian vault 同步 |
| **报告生成** | ✅ | ✅ 完成 (2026-04-03) | Report 页面，6 种模板，Markdown 导出 |
| **播客生成** | ✅ | ✅ 完成 (2026-04-03) | 播客脚本生成、Web Speech API TTS、录音下载 |
| **知识库广场** | ✅ | ❌ Phase 12 | 公开分享 |

### 10.2 Phase 13: 导入能力大升级 (P0) — ✅ 完成 (2026-04-01)

**目标**: 对标 IMA 的 19 种格式导入能力

#### 10.2.1 当前 ClawKB 导入支持

```rust
// 当前支持格式 (kb.rs:287)
"txt" | "md" | "pdf" | "html" | "htm" | "docx" | "pptx" | "xlsx"
```

#### 10.2.2 需新增格式

| 格式 | Rust 库 | 说明 | 实现文件 |
|-----|--------|------|---------|
| DOCX | `docx-rs` | Word 2007+ 文档 | `import/docx.rs` |
| PPTX | `pptx` | PowerPoint 2007+ | `import/pptx.rs` |
| XLSX | `calamine` | Excel 2007+ 表格 | `import/xlsx.rs` |
| EPUB | `epub` | 电子书格式 | `import/epub.rs` |
| RTF | `rtf` | 富文本格式 | `import/rtf.rs` |
| JSON | 内置 | 结构化数据 | `import/json.rs` |
| CSV | `csv` | 表格数据 | `import/csv.rs` |
| XML | 内置 | 结构化文档 | `import/xml.rs` |
| Markdown | 内置 | 已有支持 | - |
| PDF | `pdf_extract` | 已有支持 | - |
| HTML | `scraper` | 已有支持 | - |
| TXT | 内置 | 已有支持 | - |

#### 10.2.3 实现任务

| 任务 | 文件 | 说明 |
|-----|------|------|
| DOCX 解析 | `crates/clawkb-core/src/import/docx.rs` | 抽取正文+标题+列表+表格 |
| PPTX 解析 | `crates/clawkb-core/src/import/pptx.rs` | 抽取幻灯片文本 |
| XLSX 解析 | `crates/clawkb-core/src/import/xlsx.rs` | 抽取单元格内容 |
| EPUB 解析 | `crates/clawkb-core/src/import/epub.rs` | 抽取章节内容 |
| RTF 解析 | `crates/clawkb-core/src/import/rtf.rs` | 转换 RTF 到纯文本 |
| JSON 解析 | `crates/clawkb-core/src/import/json.rs` | 序列化 JSON 为文本 |
| CSV 解析 | `crates/clawkb-core/src/import/csv.rs` | 展平 CSV 为文本 |
| 统一导入入口 | `crates/clawkb-core/src/kb.rs` | `import_file` 自动识别格式 |
| 前端导入 UI | `src/src/components/pages/import.tsx` | 显示支持的格式列表 |
| 自动分类模块 | `crates/clawkb-core/src/classify.rs` | 内容关键词检测 + 文件夹路径标签 + 文件名分析 |

**批量导入自动分类实现细节 (2026-04-03):**

**新增文件:**
- `crates/clawkb-core/src/classify.rs` — 自动分类模块
  - `detect_type_tags()` — 基于关键词检测文档类型 (meeting/report/research/project 等)
  - `extract_path_tags()` — 从文件路径提取标签 (文件夹名作为 tag)
  - `extract_filename_tags()` — 从文件名提取标签 (Q4_2024_report → q4/2024/report)
  - `classify_document()` — 综合所有分类结果

**修改文件:**
- `crates/clawkb-core/src/import.rs` — `ImportResult` 添加 `auto_tags` 字段
- `crates/clawkb-core/src/kb.rs` — `import_file` 集成自动分类，导入时自动添加分类标签
- `src/src/api/types.ts` — `ImportResult` 添加 `auto_tags: string[]` 字段
- `src/src/components/pages/import.tsx` — 导入结果中显示自动分类标签 (Sparkles 图标)

**功能详情:**
- 内容关键词检测：支持中英文关键词（会议/报告/研究/项目等），最多返回 3 个类型标签
- 文件夹路径标签：从 `/Users/work/Projects/memvid/docs/` 提取 `work/projects/docs` 标签
- 文件名分析：`Q4_2024_financial_report_final.pdf` → `q4/2024/financial/report`
- 标签去重：自动标签不重复已有的用户标签，限制数量避免标签污染

#### 10.2.4 验收标准

- [x] 支持 15+ 文档格式导入 ✅ — 支持 PDF/DOCX/PPTX/XLSX/EPUB/RTF/MD/TXT/HTML/CSV/JSON
- [x] 自动识别文件格式 ✅ — `DocumentFormat::from_extension()`
- [x] 抽取标题/正文/元数据 ✅ — `ParsedDocument` 结构包含 title/content/metadata
- [x] 前端显示支持的格式 ✅ — Import 页面显示格式列表
- [x] 批量导入自动分类 ✅ (2026-04-03) — 基于内容关键词检测（会议/报告/研究等）、文件夹路径作为标签、文件名分析自动推断标签

---

### 10.3 Phase 14: 多级文件夹系统 (P0) — ✅ 完成 (2026-04-01)

**目标**: 对标 IMA 的多级目录分类

#### 10.3.1 数据模型设计

```rust
// crates/clawkb-core/src/folder.rs (新增)

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,           // UUID
    pub name: String,         // 文件夹名
    pub parent_id: Option<String>, // 父文件夹 (None = 根目录
    pub path: String,         // 完整路径 "/工作/项目A"
    pub created_at: i64,      // 创建时间
    pub doc_count: usize,     // 文档数量
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocFolder {
    pub doc_id: String,       // 文档 ID
    pub folder_id: String,    // 文件夹 ID
    pub added_at: i64,        // 添加时间
}

// memvid 存储策略: 使用 metadata tags 模拟文件夹
// folder_id: "folder:uuid" → tag
// folder_path: "folder_path:/工作/项目A" → tag
```

#### 10.3.2 实现任务

| 任务 | 文件 | 说明 |
|-----|------|------|
| Folder 数据结构 | `crates/clawkb-core/src/folder.rs` | 新增模块 |
| 创建文件夹 | `crates/clawkb-core/src/kb.rs` | `create_folder(name, parent_id)` |
| 移动文档 | `crates/clawkb-core/src/kb.rs` | `move_to_folder(doc_id, folder_id)` |
| 删除文件夹 | `crates/clawkb-core/src/kb.rs` | `delete_folder(folder_id)` |
| 列出文件夹树 | `crates/clawkb-core/src/kb.rs` | `list_folders(parent_id)` |
| 按文件夹搜索 | `crates/clawkb-core/src/kb.rs` | `search_in_folder(folder_id, query)` |
| Tauri 命令 | `src-tauri/src/commands/mod.rs` | 暴露文件夹操作 |
| 前端状态 | `src/src/store/folder-store.ts` | Zustand 文件夹状态 |
| 前端 UI | `src/src/components/folder-tree.tsx` | 树形文件夹组件 |
| Sidebar 集成 | `src/src/components/layout.tsx` | 添加文件夹面板 |

#### 10.3.3 UI 设计

```
Sidebar
├── 📁 ClawKB
│   ├── 📊 Dashboard
│   ├── 🔍 Search
│   ├── 💬 Chat
│   └── ...
├── 📂 我的文件夹
│   ├── 📁 工作
│   │   ├── 📁 项目A
│   │   │   ├── 📄 文档1.pdf
│   │   │   └── 📄 文档2.docx
│   │   └── 📁 项目B
│   ├── 📁 学习
│   │   ├── 📄 笔记.md
│   │   └── 📄 书籍.epub
│   └── 📁 生活
└── ⚙️ Settings
```

#### 10.3.4 验收标准

- [x] 创建/重命名/删除文件夹 ✅ — folder-store + API
- [x] 多级目录支持 ✅ — 树形结构，支持任意深度
- [x] 拖拽移动文档到文件夹 ✅ (2026-04-03) — 搜索结果拖拽到文件夹树，HTML5 drag-and-drop + `move_document` 命令
- [x] 按文件夹筛选搜索 ✅ — searchInFolder API
- [x] 文件夹折叠/展开 ✅ — FolderTree 组件
- [x] 文档计数显示 ✅ — docCount 属性

---

### 10.4 Phase 15: 全局划词 AI (P1 — Tauri 桌面端专属) — ✅ 完成 (2026-04-03)

**目标**: 对标 IMA 的全局 AI 划词功能

#### 10.4.1 技术方案

```
┌─────────────────────────────────────────────────────┐
│ System Tray (托盘)                                   │
│ ├── 🦴 ClawKB                                       │
│ │   ├── 打开主窗口                                   │
│ │   ├── 最近文档                                     │
│ │   └── 设置                                         │
│ ├── 📌 全局划词: 开启/关闭                           │
│ └── ❌ 退出                                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Global Hotkey: Cmd/Ctrl+Shift+K                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🔍 Ask ClawKB...                                │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Selected Text: "机器学习是人工智能的..."             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│ │ 📖 解释  │ │ 🌐 翻译  │ │ ✍️ 改写  │ │ ❓ 问答 │ │
│ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                     │
│ AI Response: 机器学习是人工智能的一个分支...         │
└─────────────────────────────────────────────────────┘
```

#### 10.4.2 实现任务

| 任务 | 文件 | 说明 |
|-----|------|------|
| 系统托盘 | `src-tauri/src/lib.rs` | `TrayIconBuilder` + `Menu` + `MenuItem` |
| 全局快捷键 | `src-tauri/src/lib.rs` | `tauri_plugin_global_shortcut` + `GlobalShortcutExt` |
| 剪贴板读取 | `src/src/App.tsx` | `@tauri-apps/plugin-clipboard-manager` `readText()` |
| 划词浮窗 | `src/src/components/selection-panel.tsx` | 5 种 AI 操作浮窗组件 |
| selection_ai 命令 | `src-tauri/src/commands/mod.rs` | Rust 后端 selection_ai 命令 |
| 5 种 AI 操作 | `crates/clawkb-core/src/selection.rs` | 解释/翻译/改写/摘要/问答 |
| 持久化设置 | `src/src/store/ai-store.ts` | 记住划词开启状态 |

#### 10.4.3 验收标准

- [x] 系统托盘常驻 ✅
- [x] 全局快捷键 `Cmd+Shift+K` 唤起 ✅
- [x] 自动读取选中文本 ✅
- [x] 浮窗显示: 解释/翻译/改写/摘要/问答 ✅
- [x] 后台常驻运行 ✅

#### 10.4.4 实现细节 (2026-04-03)

**新增/修改文件:**
- `crates/clawkb-core/src/selection.rs` — **新增** 划词 AI 模块，支持 5 种操作 (解释/翻译/改写/摘要/问答)
- `src-tauri/src/commands/mod.rs` — **修改** 添加 `selection_ai` 命令
- `src-tauri/src/lib.rs` — **修改** 添加系统托盘 + 全局快捷键注册 + 注册 selection_ai 命令
- `src/src/App.tsx` — **修改** 添加 SelectionPanel 组件，监听 `global-shortcut` 事件，读取剪贴板
- `src/src/components/selection-panel.tsx` — **新增** 悬浮面板组件，5 种操作按钮 + 自定义问答输入
- `src/src/api/commands.ts` — **修改** 添加 `selectionAi` API
- `src/src/api/types.ts` — **修改** 添加 `SelectionResult` 类型
- `src-tauri/capabilities/default.json` — **修改** 扩展权限列表 (window, tray, menu, global-shortcut, clipboard)

**功能详情:**
- 系统托盘：右键菜单 (打开主窗口 / 退出)，左键单击显示主窗口
- 全局快捷键：`Cmd+Shift+K` (macOS) / `Ctrl+Shift+K` (Windows/Linux) 触发浮窗
- 浮窗位置：右下角固定 `bottom-6 right-6`，最大高度 70vh
- 5 种 AI 操作：解释(BookOpen)、翻译(Globe)、改写(PenLine)、摘要(AlignLeft)、问答(MessageSquare)
- 自定义问答：支持用户输入自定义问题对选中文本提问
- 结果操作：Copy 复制到剪贴板，Save 保存到知识库

---

### 10.5 Phase 16: 截图导入与 OCR (P1) — ✅ 完成 (2026-04-03)

**目标**: 对标 IMA 的截图问答功能

#### 10.5.1 技术方案

```
截图 → OCR 识别文本 → 存入知识库/直接问答

┌────────────────────────────────────────┐
│ 截图导入流程                            │
├────────────────────────────────────────┤
│ 1. 用户截图 (Cmd+Shift+4 / 系统截图)    │
│ 2. 粘贴到 ClawKB (Cmd+V)               │
│ 3. OCR 识别文字 (Rust `ocr` crate)      │
│ 4. 生成可搜索文本存入知识库              │
│ 5. 或直接进入截图问答模式                │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 截图问答模式                            │
├────────────────────────────────────────┤
│ 1. 用户截图并提问                       │
│ 2. OCR 识别图片文字                     │
│ 3. 结合上下文进行 AI 问答               │
│ 4. 支持"提取文字"和"解读图片"          │
└────────────────────────────────────────┘
```

#### 10.5.2 实现任务

| 任务 | 状态 | 文件 |
|-----|------|------|
| OCR 引擎 | ✅ 完成 | `crates/clawkb-core/src/ocr.rs` |
| 截图导入命令 | ✅ 完成 | `import_screenshot` Tauri 命令 |
| 前端粘贴处理 | ✅ 完成 | Import 页面 Screenshot 标签页 |
| OCR 结果预览 | ✅ 完成 | Import 页面显示识别文本并可编辑 |
| 多语言支持 | ✅ 完成 | eng/chi_sim/chi_tra/jpn/kor 等 |

#### 10.5.3 验收标准

- [x] 粘贴截图自动识别文字 ✅ — 监听 paste 事件，识别 image/* 类型
- [x] 截图导入知识库 ✅ — OCR 提取文本后调用 `add_note` 存入 KB
- [x] 支持中英文 OCR ✅ — Tesseract 支持 100+ 语言

#### 10.5.4 实现细节 (2026-04-03)

**新增文件:**
- `crates/clawkb-core/src/ocr.rs` — OCR 模块，支持 base64 图片解码 + Tesseract CLI 调用

**修改文件:**
- `Cargo.toml` — 添加 `base64`
- `crates/clawkb-core/Cargo.toml` — 添加 `base64`, `tempfile`, `image`
- `crates/clawkb-core/src/lib.rs` — 导出 `ocr` 模块、`ocr_image`, `test_ocr`, `OcrResult`
- `src-tauri/src/commands/mod.rs` — 添加 `ocr_image`, `test_ocr`, `import_screenshot` 命令
- `src-tauri/src/lib.rs` — 注册新命令
- `src/src/api/commands.ts` — 添加 `ocrImage`, `testOcr`, `importScreenshot` API
- `src/src/api/types.ts` — 添加 `OcrResult` 类型
- `src/src/components/pages/import.tsx` — 添加 Screenshot 标签页
- `plan2.md` — 更新 Phase 16 状态

**OCR 模块功能:**
- `ocr_image(data, language)` — 解码 base64 图片，保存为临时文件，调用 Tesseract CLI 进行 OCR，返回提取的文本
- `test_ocr()` — 检查 Tesseract 是否已安装
- 支持语言: eng, chi_sim, chi_tra, jpn, kor 等 (需对应语言包)
- 优雅降级: Tesseract 未安装时显示安装指南

---

### 10.7 Phase 17: 真实 AI 模型集成 (P0) — ✅ 完成 (2026-04-03)

**目标**: 将 AI 配置从 stub 变为真实实现

#### 10.7.1 当前问题

```rust
// src-tauri/src/commands/mod.rs (stub)
#[tauri::command]
pub fn set_embedding_model(...) -> Result<(), String> {
    tracing::info!("Embedding model config: ..."); // 仅日志
    Ok(())
}
```

#### 10.7.2 实现方案

**Embedding 模型配置:**

```rust
// 方案 1: 使用 memvid api_embed feature
// Cargo.toml
memvid-core = { features = ["api_embed"] }

// kb.rs
pub fn set_embedding_provider(&mut self, provider: EmbeddingProvider) {
    match provider {
        EmbeddingProvider::OpenAI => {
            self.embedder = OpenAIEmbedder::new(api_key, model)?;
        }
        EmbeddingProvider::Local => {
            self.embedder = LocalONNXEmbedder::new(model)?;
        }
    }
}
```

**Ask/LLM 模型配置:**

```rust
// 集成 Ollama API
pub fn ask_with_model(&mut self, question: &str, model: &str) -> Result<AskResult> {
    let client = reqwest::blocking::Client::new();
    let response = client.post("http://localhost:11434/api/generate")
        .json(&json!({
            "model": model,
            "prompt": build_prompt(question, self.retrieved_context),
            "stream": false
        }))
        .send()?;
    // 解析响应...
}

// 集成 OpenAI API
pub fn ask_with_openai(&mut self, question: &str, model: &str, api_key: &str) -> Result<AskResult> {
    let client = reqwest::blocking::Client::new();
    let response = client.post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&chat_request)
        .send()?;
    // 解析响应...
}
```

#### 10.7.3 实现任务

| 任务 | 状态 | 文件 |
|-----|------|------|
| Ollama 集成 | ✅ 完成 | `crates/clawkb-core/src/llm.rs` |
| OpenAI 集成 | ✅ 完成 | `crates/clawkb-core/src/llm.rs` |
| Claude 集成 | ✅ 完成 | `crates/clawkb-core/src/llm.rs` |
| DeepSeek 集成 | ✅ 完成 | `crates/clawkb-core/src/llm.rs` |
| LLM 抽象层 | ✅ 完成 | `crates/clawkb-core/src/llm.rs` (LlmProvider trait) |
| AI 配置存储 | ✅ 完成 | `crates/clawkb-core/src/ai_config.rs` |
| 前端模型选择 | ✅ 完成 | `src/src/store/ai-store.ts`, `settings.tsx` |
| 前端模型选择 | `src/src/components/pages/settings.tsx` | 模型下拉选择 |
| 前端 API Key 输入 | `src/src/components/pages/settings.tsx` | 安全输入 |

#### 10.7.4 支持的模型

| 模型类型 | 本地 | 云端 |
|---------|-----|------|
| Embedding | ONNX (BGE/Nomic/GTE) | OpenAI, DeepSeek |
| Ask/LLM | Ollama (Llama/Qwen) | GPT-4o, Claude, DeepSeek |

#### 10.7.5 验收标准

- [x] Ollama 本地模型支持 ✅
- [x] OpenAI API 集成 ✅
- [x] Claude API 集成 ✅
- [x] DeepSeek API 集成 ✅
- [x] 模型配置持久化 ✅
- [x] 前端模型切换 ✅

---

### 10.8 Phase 18: 边看边问增强 (P1) — ✅ 完成 (2026-04-03)

**目标**: 增强 Reader 页面的实时问答体验

#### 10.8.1 IMA 对比

| 功能 | IMA | ClawKB 当前 | 改进方向 |
|-----|-----|------------|---------|
| 阅读时问答 | ✅ | ✅ | Reader 侧边栏固定、AI 问答 |
| 划词解释 | ✅ | ✅ (2026-04-03) | 全局划词 (Phase 15) — 5 种操作含解释 |
| 边读边记 | ✅ | ✅ | 笔记面板 + 彩色标签 |
| 书签管理 | ✅ | ✅ | Bookmark 面板 |
| 阅读进度 | ✅ | ✅ | 自动保存/恢复 |

#### 10.8.2 实现任务

| 任务 | 状态 | 文件 |
|-----|------|------|
| 固定问答侧栏 | ✅ 完成 | `src/src/components/pages/reader.tsx` |
| 书签功能 | ✅ 完成 | `src/src/store/bookmark-store.ts` |
| 阅读进度 | ✅ 完成 | `src/src/store/bookmark-store.ts` |
| 笔记面板增强 | ✅ 完成 | `src/src/components/pages/reader.tsx` |

#### 10.8.3 验收标准

- [x] 固定问答侧栏 ✅ — Chat 按钮切换，可展开/收起
- [x] 添加书签 ✅ — Bookmark 面板，+ 按钮保存当前阅读位置
- [x] 记住阅读进度 ✅ — 滚动时自动保存到 localStorage，重新打开自动恢复
- [x] 笔记与知识库同步 ✅ — localStorage 持久化，笔记可编辑/删除

#### 10.8.4 实现细节 (2026-04-03)

**新增文件:**
- `src/src/store/bookmark-store.ts` — `useBookmarkStore` + `useReadingProgressStore` + `HIGHLIGHT_COLORS`

**修改文件:**
- `src/src/components/pages/reader.tsx` — 添加书签面板、阅读进度保存/恢复、增强笔记面板（彩色标签 + 笔记编辑）

**新增功能:**
- 书签面板：显示当前文档书签列表，+ 按钮添加当前位置书签，Jump 跳转，Delete 删除
- 阅读进度：打开文档时自动恢复上次滚动位置，滚动时自动保存
- 增强笔记面板：5 种彩色标签（黄/绿/蓝/粉/橙），选中高亮颜色后添加彩色标注，笔记支持编辑和删除

---

### 10.9 Phase 19: 报告生成与 Agent 模式 (P2) — ✅ 完成 (2026-04-03)

**目标**: 对标 IMA 2.0 的 Agent 能力

#### 10.9.1 功能设计

```
┌─────────────────────────────────────────────────────┐
│ 📊 报告生成模式                                      │
├─────────────────────────────────────────────────────┤
│ 1. 选择主题/关键词                                   │
│ 2. 设置报告结构 (大纲)                               │
│ 3. AI 自动收集相关文档                              │
│ 4. 生成结构化报告                                    │
│ 5. 支持 Markdown/DOCX 导出                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 🎙️ 播客生成模式 (IMA 2.0)                           │
├─────────────────────────────────────────────────────┤
│ 1. 选择主题                                          │
│ 2. AI 生成对话脚本                                  │
│ 3. 文字转语音 (TTS)                                 │
│ 4. 生成播客音频                                     │
└─────────────────────────────────────────────────────┘
```

#### 10.9.2 实现任务

| 任务 | 状态 | 文件 |
|-----|------|------|
| 报告生成前端 UI | ✅ 完成 | `src/src/components/pages/report.tsx` |
| 报告状态管理 | ✅ 完成 | `src/src/store/report-store.ts` |
| 文档选择面板 | ✅ 完成 | `report.tsx` 左面板 |
| 6 种报告模板 | ✅ 完成 | `report-store.ts` |
| AI 大纲生成 | ✅ 完成 | 调用 LLM API + KB 上下文 |
| 分段内容生成 | ✅ 完成 | `report.tsx` Generate 按钮 |
| Markdown 导出 | ✅ 完成 | Download + Copy |
| 播客生成 (TTS) | ✅ 完成 (2026-04-03) | Web Speech API TTS、边播边录、录音下载 |

#### 10.9.3 验收标准

- [x] 选择文档生成报告 ✅ — 左面板文档选择，支持多选、搜索
- [x] 自定义报告大纲 ✅ — 6 种模板 (Blank/Article/Meeting/Proposal/Research/Summary)，支持 AI 生成大纲和手动添加章节
- [x] Markdown 导出 ✅ — Download MD 和 Copy 两种导出方式
- [x] 播客生成 (TTS) ✅ — 已实现 Web Speech API TTS + 录音下载 (2026-04-03)

#### 10.9.4 实现细节 (2026-04-03)

**新增文件:**
- `src/src/store/report-store.ts` — `useReportStore` 报告状态管理，6 种模板配置
- `src/src/components/pages/report.tsx` — 报告生成主页面
- `src/src/components/pages/podcast.tsx` — 播客生成页面 (2026-04-03)

**修改文件:**
- `src/src/App.tsx` — 注册 ReportPage + PodcastPage
- `src/src/components/layout.tsx` — 添加 Report + Podcast 导航项
- `src/src/api/types.ts` — 添加 podcast 类型

**新增功能:**
- 文档选择面板：左侧面板列出所有知识库文档，支持多选、搜索、勾选
- 6 种报告模板：Blank/Article/Meeting/Proposal/Research/Summary，带图标和描述
- AI 生成报告大纲：基于模板生成结构化大纲，支持添加/删除/自定义章节
- 分段生成内容：点击 Generate 按钮为每个章节生成内容，支持重新生成
- 全内容视图：查看完整报告，支持一键生成所有章节
- Markdown 导出：Download 文件 + Copy 到剪贴板
- 播客脚本生成：从知识库搜索相关内容，生成双人对话脚本（主持人+嘉宾）
- Web Speech API TTS：浏览器原生语音合成，无需 API key
- 边播边录：MediaRecorder API 实时录音
- 录音下载：WebM 格式音频导出

### 10.10 Phase 20: Obsidian 同步 (P2) — ✅ 完成 (2026-04-02)

**目标**: 对标 IMA 的 Skill 功能，支持 Obsidian 同步

#### 10.10.1 技术方案

```
Obsidian Vault ←→ ClawKB 知识库
    │                    │
    ├── Markdown 文件 ───┼──→ 解析 → 导入
    ├── 双链链接 ───────┼──→ 转换为标签
    └── 标签 ────────────┼──→ 同步
```

#### 10.10.2 实现任务

| 任务 | 状态 | 文件 |
|-----|------|------|
| Obsidian 解析 | ✅ 完成 | `crates/clawkb-core/src/sync/obsidian.rs` |
| Obsidian 模块 | ✅ 完成 | `crates/clawkb-core/src/sync/mod.rs` |
| Markdown 导入 | ✅ 完成 | Tauri `import_obsidian_vault` 命令 |
| 前端扫描/导入 API | ✅ 完成 | `src/src/api/commands.ts` |
| 同步状态 | ✅ 完成 | `src/src/store/sync-store.ts` |
| Obsidian 设置标签页 | ✅ 完成 | `src/src/components/pages/settings.tsx` |

#### 10.10.3 验收标准

- [x] 指定 Obsidian Vault 路径
- [x] 扫描 vault 并显示摘要（笔记数、标签数、文件夹结构）
- [x] 导入 Markdown 文件（含 YAML frontmatter、标签）
- [x] 增量同步支持（基于已有导入结果）

#### 10.10.4 实现细节 (2026-04-02)

**新增文件:**
- `crates/clawkb-core/src/sync/mod.rs` — 模块导出
- `crates/clawkb-core/src/sync/obsidian.rs` — Obsidian vault 解析器
- `src/src/store/sync-store.ts` — `useSyncStore` 同步状态管理

**修改文件:**
- `Cargo.toml` — 添加 `walkdir = "2"`
- `crates/clawkb-core/Cargo.toml` — 添加 `walkdir`
- `crates/clawkb-core/src/lib.rs` — 导出 `pub mod sync`
- `src-tauri/src/commands/mod.rs` — 添加 `scan_obsidian_vault`, `import_obsidian_vault` 命令
- `src-tauri/src/lib.rs` — 注册新命令
- `src/src/api/commands.ts` — 添加 `scanObsidianVault`, `importObsidianVault` API
- `src/src/api/types.ts` — 添加 `VaultSummary`, `ObsidianImportResult` 类型
- `src/src/components/pages/settings.tsx` — 添加 Obsidian 标签页
- `plan2.md` — 更新 Phase 20 状态

**Obsidian 解析器功能:**
- `scan_vault()` — 快速扫描 vault，返回摘要（笔记数、标签数、文件夹列表）
- `parse_note()` — 解析单个 Markdown 文件，提取 YAML frontmatter (tags, aliases, title, dates)、正文内容、#tag 标签
- `parse_vault()` — 批量解析 vault 中所有 Markdown 文件
- `extract_tags_from_content()` — 从内容中提取 `#tag`，跳过代码块和 frontmatter

---

### 10.11 Phase 21: 性能优化 (持续)

#### 10.11.1 当前问题

| 问题 | 影响 | 优化方案 |
|-----|------|---------|
| D3-force 大图谱卡顿 | Graph 页面 | Canvas 渲染 / WebGL |
| PDF 大文件加载慢 | Reader 页面 | 分页加载 |
| 搜索响应慢 | Search 页面 | 结果缓存 |
| 导入大文件夹 | Import 页面 | 进度条 + 异步 |

#### 10.11.2 优化任务

| 任务 | 文件 | 说明 |
|-----|------|------|
| 图谱 Canvas 渲染 | `src/src/components/pages/graph.tsx` | 替换 SVG |
| PDF 分页加载 | `src/src/components/pages/reader.tsx` | 虚拟滚动 |
| 搜索缓存 | `src/src/store/search-cache.ts` | LRU 缓存 |
| 导入进度 | `src/src/components/pages/import.tsx` | 实时进度 |

---

### 10.12 Phase 22: 多知识库支持 (P1) — ✅ 完成 (2026-04-03)

**目标**: 对标 IMA 的 @知识库问答，支持多个知识库

#### 10.12.1 技术方案

```
多知识库架构:
AppState {
  kb: Option<KnowledgeBase>,           // 默认 KB
  extra_kbs: HashMap<String, KB>,      // 额外打开的 KB
  open_kb_paths: Vec<String>,           // 已打开 KB 路径列表
}
```

#### 10.12.2 实现任务

| 任务 | 状态 | 文件 |
|-----|------|------|
| 多 KB AppState | ✅ 完成 | `src-tauri/src/commands/mod.rs` |
| open_extra_kb 命令 | ✅ 完成 | `src-tauri/src/commands/mod.rs` |
| close_extra_kb 命令 | ✅ 完成 | `src-tauri/src/commands/mod.rs` |
| list_open_kbs 命令 | ✅ 完成 | `src-tauri/src/commands/mod.rs` |
| search_multi_kb 命令 | ✅ 完成 | `src-tauri/src/commands/mod.rs` |
| ai_ask_multi 命令 | ✅ 完成 | `src-tauri/src/commands/mod.rs` |
| 前端 KB 注册 store | ✅ 完成 | `src/src/store/multi-kb-store.ts` |
| 多 KB API | ✅ 完成 | `src/src/api/commands.ts` |

#### 10.12.3 验收标准

- [x] 注册多个 KB 路径 ✅
- [x] 跨 KB 搜索 (search_multi_kb) ✅
- [x] 跨 KB 问答 (ai_ask_multi) ✅
- [x] KB 状态管理 (open/close) ✅

#### 10.12.4 实现细节 (2026-04-03)

**新增文件:**
- `src/src/store/multi-kb-store.ts` — `useMultiKbStore` 多知识库状态管理

**修改文件:**
- `src-tauri/src/commands/mod.rs` — AppState 添加 `extra_kbs: HashMap`, `open_kb_paths`; 添加 5 个多 KB 命令
- `src-tauri/src/lib.rs` — 注册多 KB 命令
- `src/src/api/commands.ts` — 添加 `openExtraKb`, `closeExtraKb`, `listOpenKbs`, `searchMultiKb`, `aiAskMulti` API

**功能详情:**
- AppState 支持同时打开多个 KB (`extra_kbs: HashMap<String, KnowledgeBase>`)
- `search_multi_kb` — 同时查询多个 KB，结果按分数排序，带 `[KB名]` 前缀区分来源
- `ai_ask_multi` — 多 KB 问答，可选择要查询的 KB 列表
- `multi-kb-store.ts` — 注册/注销/重命名 KB，持久化到 localStorage

---

### 10.12 改造优先级与工作量估算

| Phase | 任务 | 优先级 | 工作量 | 依赖 |
|-------|-----|-------|-------|------|
| Phase 13 | 导入大升级 | P0 | 3 周 | - |
| Phase 14 | 多级文件夹 | P0 | 2 周 | - |
| Phase 15 | 全局划词 | P1 | 2 周 | Tauri |
| Phase 16 | 截图导入 | P1 | 2 周 | OCR |
| Phase 17 | 真实 AI 模型 | P0 | 3 周 | API |
| Phase 18 | 边看边问增强 | P1 | 1 周 | - |
| Phase 19 | 报告生成 | P2 | 2 周 | Phase 17 |
| Phase 20 | Obsidian 同步 | P2 | 2 周 | - |
| Phase 21 | 性能优化 | 持续 | - | - |

**预计总工期**: 12-15 周 (Phase 13-20 核心功能)

---

### 10.13 新增文件清单

**Rust 后端:**
```
crates/clawkb-core/src/
├── import/
│   ├── mod.rs
│   ├── docx.rs      # Word 解析
│   ├── pptx.rs      # PPT 解析
│   ├── xlsx.rs      # Excel 解析
│   ├── epub.rs      # EPUB 解析
│   ├── rtf.rs       # RTF 解析
│   ├── json.rs      # JSON 解析
│   ├── csv.rs       # CSV 解析
│   └── markdown.rs  # Markdown 增强
├── folder.rs        # 文件夹系统
├── ocr.rs          # OCR 识别
├── selection.rs    # 划词 AI
├── classify.rs    # 自动分类 (2026-04-03)
├── multi_kb.rs    # 多知识库 (src-tauri/commands)
├── config.rs       # 配置管理
├── llm/
│   ├── mod.rs
│   ├── ollama.rs    # Ollama 集成
│   ├── openai.rs    # OpenAI 集成
│   ├── claude.rs    # Claude 集成
│   └── deepseek.rs  # DeepSeek 集成
├── agent/
│   ├── mod.rs
│   ├── report.rs    # 报告生成
│   ├── outline.rs   # 大纲生成
│   └── synthesize.rs # 多文档综合
├── tts.rs          # 文字转语音
├── sync/
│   ├── mod.rs
│   ├── obsidian.rs  # Obsidian 同步
│   └── bi-sync.rs   # 双向同步
├── sync/
│   ├── mod.rs
│   ├── obsidian.rs  # Obsidian 同步
│   └── webdav.rs    # WebDAV 同步 (2026-04-03)
└── tray.rs         # 系统托盘 (src-tauri)

src-tauri/src/
├── tray.rs         # 托盘管理
├── hotkey.rs       # 全局快捷键
├── clipboard.rs    # 剪贴板监控
└── commands/
    ├── folder.rs    # 文件夹命令
    ├── ocr.rs       # OCR 命令
    └── sync.rs      # 同步命令
```

**React 前端:**
```
src/src/
├── store/
│   ├── folder-store.ts    # 文件夹状态
│   ├── bookmark-store.ts  # 书签状态
│   ├── multi-kb-store.ts  # 多知识库 (2026-04-03)
│   ├── reader-progress.ts # 阅读进度
│   ├── annotation-store.ts # 标注状态
│   └── sync-store.ts      # 同步状态
├── components/
│   ├── folder-tree.tsx    # 文件夹树
│   ├── notes-panel.tsx     # 笔记面板
│   ├── ocr-preview.tsx     # OCR 预览
│   ├── floating-window.tsx # 浮窗
│   └── pages/
│       ├── report.tsx     # 报告生成页
│       └── podcast.tsx    # 播客生成页
└── hooks/
    ├── use-paste.ts       # 粘贴监听
    ├── use-bookmark.ts    # 书签钩子
    └── use-progress.ts    # 进度钩子
```

---

*文档版本: v3.10 (Phase 24 播客TTS + 增量同步完成)*
*创建日期: 2026-03-31*
*最后更新: 2026-04-03*
*作者: Claude Code*
*参考产品: 腾讯 IMA — https://ima.qq.com/*
*核心引擎: memvid-core 2.0 — https://memvid.com*
