# ClawKB 2.1 — 基于 memvid 核心的笔记产品全面改造计划

> **目标：** 基于对 memvid-core 架构的深度分析、对标产品（Notion/Obsidian/Logseq）的架构级对比、全仓库代码审计，以及 memvid 生态技术的全面调研，形成一份涵盖"存储层改造 + UI 完善"的完整可执行计划。

---

## 0. 分析方法与证据来源

### 0.1 三层研究体系

本次分析建立了完整的三层研究证据链：

**第一层：memvid-core 源码级分析**
- 源码路径：`~/.cargo/registry/src/*/memvid-core-2.0.139/src/`
- 覆盖范围：Frame 模型、MV2 文件格式（Header/WAL/Payload/Index/TOC/Footer）、HNSW 向量索引、Tantivy 全文索引、Commit 机制、内存管理

**第二层：memvid 生态技术调研**
- GitHub: [memvid/memvid](https://github.com/memvid/memvid)、[AllenDang/memvid-rs](https://github.com/AllenDang/memvid-rs)
- crates.io: [memvid-core](https://crates.io/crates/memvid-core)、[rig-memvid](https://crates.io/crates/rig-memvid)
- 第三方分析：5 篇技术博客、3 个 Reddit 讨论、1 个 YouTube 视频
- 对比矩阵：memvid-core vs sqlite-vec vs LanceDB vs Qdrant (embedded) vs Chroma

**第三层：全仓库代码审计**
- 前端：32 个组件、13 个 Store/API 层文件、App.tsx 路由系统
- 后端：clawkb-core 全部模块（16 个 .rs 文件）、src-tauri 全部命令（53 个 Tauri 命令）
- 数据流：从 Tauri invoke → 命令层 → KnowledgeBase → memvid-core 的完整链路

### 0.2 关键发现总结

1. **memvid-core 是外部依赖**，clawkb-core 通过 `memvid-core = "2.0"` 的 Cargo 依赖引入，非本地维护
2. **MV2 文件是单一自包含格式**，Header(4KB) + WAL(64KB) + Payload(追加) + Index + TOC + Footer，无任何旁文件
3. **帧(Frame)是核心存储单元**，每个帧包含 id/timestamp/payload_offset/checksum/kind/uri/title/tags/metadata/parent_id/chunk_index 等完整结构
4. **双索引架构**：Tantivy 全文(BM25) + HNSW 向量(>1000向量时激活)，索引内嵌于 MV2 文件内
5. **笔记采用两帧模式**：内容帧 + 元数据帧（JSON 序列化 NoteRecord），通过 tag convention 连接
6. **文件夹完全基于 tag 实现**：无专用文件夹索引，list_folders() 需扫描全量帧
7. **note_path_registry 是内存哈希表**：每次 open() 从零扫描全量帧重建，无持久化缓存
8. **帧 ID 是整数自增主键**：笔记使用 `note:uuid` tag 标识，双重身份系统导致扫描复杂度

---

## 1. memvid 核心架构深度分析

### 1.1 MV2 文件格式

```
+---------------------------+
| Header (4 KiB)            |  Magic="MV2\0", version=2.1, WAL 指针
+---------------------------+
| WAL (64 KiB ~ 64MB)       |  Write-Ahead Log，提交前暂存变更
+---------------------------+
| Payload Region            |  帧原始字节（追加写入）
+---------------------------+
| Index Segments            |  Lex(Tantivy)、Vec(HNSW)、Time、Temporal
+---------------------------+
| TOC (Table of Contents)   |  bincode 序列化，所有帧的元信息
+---------------------------+
| Commit Footer             |  Magic="MV2FOOT!", toc_len, blake3, generation
+---------------------------+
```

**Crash Recovery**：文件末尾包含固定大小 Footer（Magic + TOC长度 + blake3哈希 + generation）。崩溃后扫描文件末尾定位最后一个有效 Footer，恢复 TOC。

**Commit 策略**：
- `Full`：重写整个文件（用于压缩）
- `Incremental`：追加新段（默认，原子性通过 AtomicWriteFile 实现：先写临时文件，再 rename）

### 1.2 Frame 存储模型

每个帧的完整字段结构（`frame.rs`）：

```rust
struct Frame {
    id: FrameId,                    // u32 自增整数主键
    timestamp: i64,                 // Unix 毫秒时间戳
    payload_offset: u64,           // 文件内偏移量
    payload_length: u64,           // 压缩后字节长度
    checksum: [u8; 32],             // blake3(payload)
    kind: String,                   // "note", "docx", "pdf", "image", "audio"
    uri: String,                    // 来源标识，如 "mv2://frames/42"
    title: Option<String>,
    tags: Vec<String>,
    labels: Vec<String>,
    search_text: String,           // 供全文索引的纯文本
    canonical_encoding: Encoding,   // Plain 或 Zstd
    metadata: DocMetadata,          // MIME/EXIF/媒体信息
    chunk_manifest: Vec<ChunkMeta>, // 文档分块信息
    role: FrameRole,               // content / metadata / checkpoint
    parent_id: Option<FrameId>,    // 父帧（用于分块文档）
    chunk_index: u32,              // 块序号
    chunk_count: u32,              // 总块数
    status: FrameStatus,           // active / deleted / superseded
    supersedes: Option<FrameId>,   // 被哪帧替代
    superseded_by: Option<FrameId>, // 替代了哪帧
    enrichment_state: EnrichmentState, // 渐进摄取状态
}
```

### 1.3 双重索引机制

**全文索引（Lexical）**：
- 主引擎：Tantivy（BM25 排序）
- 内置备选：`LexIndex`（tokenize → 分块 → 评分：词频 + 短语匹配加成）
- 索引嵌入 MV2 文件内部，无旁文件

**向量索引（Vector）**：
- < 1000 向量：未压缩 f32 向量（`Vec<VecDocument>` via bincode）
- 1000 ~ 10万向量：HNSW（`hnsw` crate，L2 距离，ef_construction=100, ef_search=50，16 connections，32 layers）
- > 10万向量：Product Quantization（PQ96，压缩至 96 字节/向量）
- SIMD 加速（`simd.rs`）

### 1.4 clawkb-core 的两帧笔记模式

```rust
// 添加笔记 → 创建内容帧
mem.put_bytes_with_options(
    note.content.as_bytes(),
    PutOptions {
        title: Some(note.title),
        uri: format!("mv2://notes/{}", note.id),
        tags: ["note".to_string(), "note_id:{}".format(note.id)],
        enable_embedding: true,
        auto_tag: true,
        extract_triplets: true,
        ..Default::default()
    }
);

// 创建元数据帧
mem.put_bytes_with_options(
    serde_json::to_vec(&note_record).unwrap(),
    PutOptions {
        kind: "note_meta",
        tags: ["__note_meta__", "note_id:{}".format(note.id), ...],
        enable_embedding: false,
        ..Default::default()
    }
);
```

### 1.5 文件夹的 Tag Convention 实现

```rust
// 文件夹元数据帧 tags:
["__folder_meta__", "folder_meta_id:<uuid>", "folder_name:<name>",
 "folder_parent:<parent_id>", "folder_path:</Work/Projects>",
 "folder_created_at:<timestamp>"]

// 文档帧关联文件夹:
["folder:<folder_id>", "folder_path:</Work/Projects>", ...]

// 删除文件夹（软删除）:
在文件夹帧 tags 中追加 "__folder_deleted__"
```

---

## 2. memvid 生态技术调研

### 2.1 官方项目状态

| 项目 | 语言 | 状态 | 备注 |
|------|------|------|------|
| [memvid/memvid](https://github.com/memvid/memvid) (官方) | Rust + Python | 活跃维护 | V2 弃用 QR，改用 MV2 自定义格式 |
| [memvid-core](https://crates.io/crates/memvid-core) | Rust | V2.0.139 (2024) | 唯一官方 Rust 实现 |
| [rig-memvid](https://crates.io/crates/rig-memvid) | Rust | V0.36 | Rig Agent 框架集成 |
| [AllenDang/memvid-rs](https://github.com/AllenDang/memvid-rs) | Rust | 社区维护 | **仍用 V1 QR 方案，与官方 V2 不兼容** |
| `@memvid/sdk` | Node.js | 官方 SDK | JavaScript/TypeScript 包装 |
| `memvid-cli` | CLI | 官方 | NPM 全局安装 |

### 2.2 memvid vs 其他嵌入式向量数据库对比

| 特性 | memvid-core 2.0 | sqlite-vec | LanceDB | Qdrant (embedded) | Chroma |
|------|-----------------|------------|---------|-------------------|--------|
| 语言 | Rust | C (SQLite 扩展) | Rust | Rust | Python |
| 单文件 | ✅ .mv2 | ✅ .db | ✅ .Lance | ❌ 多文件 | ❌ |
| 全文搜索 | ✅ Tantivy BM25 | ❌ | ❌ | ❌ | ❌ |
| 向量搜索 | ✅ HNSW + PQ | ✅ HNSW | ✅ IVF-PQ | ✅ HNSW | ✅ HNSW |
| 时间旅行 | ✅ 原生 | ❌ | ✅ (via Lance) | ❌ | ❌ |
| Crash-safe WAL | ✅ 内嵌 | ✅ SQLite WAL | Partial | ❌ | ❌ |
| 多模态 | ✅ CLIP + Whisper | ❌ | ✅ | ❌ | ✅ |
| 离线/本地 | ✅ | ✅ | ✅ | ✅ | ❌ (需服务器) |
| 加密 | ✅ .mv2e | ❌ | ❌ | ❌ | ❌ |
| 成熟度 | 较新 (<2年) | 成熟 | 成熟 | 成熟 | 成熟 |
| 插件生态 | 社区 MCP | 无 | 无 | 无 | 无 |

### 2.3 memvid 的核心优势

1. **零基础设施**：单文件 + Rust 静态链接，无需任何外部服务
2. **时间旅行**：原生支持查询历史状态（`search_as_of`、`ask_as_of`、`compare_timeline`）
3. **混合检索**：全文 + 向量 + 图谱三合一，无需组合多个库
4. **本地优先**：完全离线运行，无网络依赖
5. **多模态**：内置 CLIP（图片）和 Whisper（音频）支持
6. **加密**：`.mv2e` 加密胶囊可选

### 2.4 memvid 的核心限制

1. **单写入者**：文件锁 + `Mutex<AppState>`，同一时间只能有一个写事务
2. **全量内存**：TOC (`Vec<Frame>`) 完全加载到 RAM，大 KB 启动慢
3. **无 mmap**：文件 I/O 通过标准 `std::fs::File`，无内存映射加速
4. **帧 ID 整数主键**：笔记用 `note:uuid` tag 做身份，双重查找
5. **无二级索引**：文件夹和标签全靠扫描帧数组（O(N)）
6. **无原生双链**：帧模型无 `[[wiki-link]]` 能力，需自己实现

---

## 3. 数据模型缺陷与改造方案

### 3.1 架构问题全景图

```
当前架构                          目标架构
─────────────────────────────────────────────────────
Frame(id:int) ──tag──> note:uuid  Frame(id:int) ←──直接引用──→ NoteRecord(id:uuid)
                                   │
note_path_registry (内存HashMap)    ├── path: String          ←──持久化索引
   ↑每次open()重建                 ├── backlinks: Vec<FrameId> ←──新增
                                   ├── outlinks: Vec<FrameId>  ←──新增
                                   └── outline: Vec<OutlineNode>←──新增

Folder = frame + tag               Folder = 专用 FrameKind (非 tag 扫描)
list_folders() = O(N) 帧扫描      list_folders() = O(1) 文件夹索引

Tag = Vec<String> on frame        Tag = 专用索引（可排序/可过滤）

Snippet-only export               Full-content export + incremental delta
```

### 3.2 问题 1：note_path_registry 无持久化

**现状**：`HashMap<path, note_id>` 每次 `open()` 重新扫描全量帧构建。

```rust
// kb.rs — 当前实现
pub fn open(&mut self, path: &Path) -> Result<()> {
    self.note_path_registry = HashMap::new();
    for frame in self.mem.list_frames() {
        if let Some(id) = extract_note_id(&frame.tags) {
            // 扫描...
        }
    }
}
```

**问题**：万帧级别 KB 每次启动慢；崩溃后无缓存保护。

**改造方案**：
```rust
// 方案 A：在 KB 内存储一个 __kb_registry__ 元数据帧
// 内容：{ note_paths: HashMap<path, id>, folders: Vec<FolderRecord>, ... }
// 每次 create/delete/rename_note 时更新，open() 时直接读取

// 方案 B：memvid 内嵌 SQLite 做元数据索引（推荐）
// 利用 sqlite-vec 做向量 + SQLite 做结构化索引（两者可共存于同一 .db）
// 缺点：引入额外依赖

// 方案 C：使用 memvid 的时间索引（已有）
// note_path_registry 变更作为帧记录，通过时间查询恢复
```

### 3.3 问题 2：文件夹系统 O(N) 扫描

**现状**：`list_folders()` 扫描全量帧找 `__folder_meta__` tag，`doc_count` 需二次扫描。

**改造方案**：
```rust
// 新增专用文件夹 FrameKind（非 tag）
pub enum FrameKind {
    Note,
    Document,       // 导入的文件
    Folder,         // 新增：文件夹节点
    NoteMeta,       // 当前 __note_meta__ 保留
    // ...
}

// 在 mem.put_bytes 时指定 kind
// list_folders() 改为：mem.list_frames_by_kind(FrameKind::Folder)
// 获得 O(k) 其中 k = 文件夹数量 << N（总帧数）
```

### 3.4 问题 3：无双向链接（Backlinks）

**现状**：帧之间无原生链接关系，笔记无法引用其他笔记。

**改造方案**：
```rust
// 方案 A：outlinks tag（解析时提取 [[xxx]]，转为 link:<frame_id_or_title>）
// Pros：无需改动存储格式
// Cons：需要前端/后端共同维护 tag 同步

// 方案 B：NoteMeta 帧中存储 backlinks/outlinks（推荐）
pub struct NoteMetaFrame {
    note_id: String,
    path: String,
    title: String,
    backlinks: Vec<String>,    // 指向本笔记的 frame_id
    outlinks: Vec<String>,     // 本笔记指向的其他 frame_id
    outline: Vec<OutlineItem>, // 大纲结构
    created_at: i64,
    updated_at: i64,
}
```

### 3.5 问题 4：笔记编辑导致全帧重写

**现状**：`rename_note_record` 调用 `mem.update_frame()` 重写整个帧数据。

**改造方案**：
- 内容帧（`kind: "note"`）：不可变追加，通过 `supersedes/superseded_by` 链式版本化
- 元数据帧（`NoteMeta`）：可原地更新（tag-only 变更更高效）
- 前端：使用 diff 派生子帧（节省存储 + 保留历史）

### 3.6 问题 5：Embedding 模型兼容性

**现状**：嵌入维度硬编码在 `VecIndexManifest`，换模型后历史向量失效。

**改造方案**：
```rust
// 在 KbRegistry 帧中存储：
struct EmbeddingConfig {
    model: String,        // "bge-small-en-v1.5"
    dimensions: usize,    // 384
    provider: String,     // "local" | "openai"
    version: String,      // 用于兼容性检测
}

// open() 时验证模型一致性，不一致时触发重嵌入警告
```

---

## 4. 对标主流笔记产品的架构级对比

### 4.1 存储架构对比

| 维度 | Obsidian | Notion | Logseq | memvid (ClawKB) |
|------|----------|--------|--------|-----------------|
| **存储格式** | 原生文件系统（.md 文件） | 数据库（PostgreSQL + S3） | 原生文件系统（.md 文件） | 单 .mv2 文件 |
| **索引方式** | 无内置索引（插件实现） | 全文 + 属性索引 | 全文索引（sqlite FTS5） | Tantivy BM25 + HNSW |
| **向量搜索** | 插件（如 vector search） | API 调用 | 插件 | 原生 HNSW |
| **内容模型** | Markdown（.md 文件） | Block（数据库行） | 大纲 + Markdown | 帧（Frame） |
| **链接机制** | `[[wiki-link]]` + 反链索引 | `@mention` + 页面关系 | `[[page]]` + 反链面板 | 无原生（需实现） |
| **版本控制** | Git（Vault 是 Git 仓库） | 数据库事务 | Git（可选） | 时间旅行（帧级） |
| **数据可移植性** | 100%（纯文件） | 导出为 Markdown/HTML | 100%（纯文件） | 100%（单文件） |
| **离线能力** | 100% | ❌ | 100% | 100% |
| **协作能力** | Git + 插件 | ✅ 原生 | Git-based | ❌ |
| **多模态** | 插件 | ✅ 原生 | ❌ | ✅ CLIP + Whisper |

### 4.2 ClawKB vs Obsidian 的核心架构差异

**Obsidian 的 Vault 模式**：
```
/vault
  /folder1
    note-a.md    ←─ 纯文本文件，可被任何编辑器打开
    note-b.md
  /folder2
    .obsidian/   ←─ 配置（workspace.json 等）
```

- 每个笔记 = 一个 .md 文件
- `[[wiki-link]]` 通过文件系统路径解析（相对/绝对）
- 反链 = 扫描所有 .md 文件内容正则匹配 `[[xxx]]`
- Vault 本身即 Git 仓库，天然版本控制

**ClawKB 的 MV2 模式**：
```
~/.clawkb/
  knowledge.mv2  ←─ 单一二进制文件，含所有内容+索引
```

- 所有笔记 = 帧，嵌入 .mv2 文件内
- 无文件系统级访问，无法直接用编辑器打开
- 链接 = 需要自己实现解析层
- 时间旅行 = memvid 内置帧级历史

**关键洞察**：Obsidian 的"每个笔记一个文件"是最符合 Unix 哲学的设计——用户拥有数据、工具无关、可版本控制。ClawKB 的单文件设计在便携性上有优势，但损失了透明性和工具无关性。

### 4.3 ClawKB vs Notion 的内容模型对比

**Notion Block 模型**：
```
Page {
  id: uuid
  blocks: Block[]
  properties: Properties
}
Block {
  id: uuid
  type: "text" | "heading" | "list" | "code" | "embed" | ...
  content: RichText[]
  children: Block[]  ←─ 嵌套结构
  checked: bool     ←─ toggle/list 特有
}
```

**ClawKB Frame 模型**：
```
Frame {
  id: u32
  kind: String       ←─ "note" | "docx" | "pdf" | ...
  content: bytes    ←─ 原始内容
  tags: String[]    ←─ 标签（文件夹、note_id、custom）
  metadata: DocMetadata
}
```

**差距**：Frame 没有块级嵌套结构，无法表达"页面 → 章节 → 段落"的层次。TipTap 编辑器在前端做了富文本，但存储层是扁平的 frame。笔记的结构化信息（大纲、折叠层级）丢失在 frame 的 `search_text` 字符串中。

---

## 5. 前端架构问题分析

### 5.1 Store 层的状态碎片化

当前 13 个 store/store-like 文件，存在以下问题：

**问题 1：API 错误吞噬**
- `kb-store.refreshStats()`：空 `catch {}`
- `folder-store.createFolder()`：无 try/catch
- `folder-store.moveDocument()`：无 try/catch
- `report-store.generateOutline()`：错误被吞，不设 error state
- `graph-store.selectEntity()`：空 `catch {}`

**问题 2：跨 Store 依赖不对称**
```
chat-store.sendMessage()
  ├─ api.openExtraKb(path) ×N   ←─ 打开但从不关闭
  ├─ api.searchMultiKb(...)
  ├─ api.aiAskMulti(...)
  └─ api.aiAsk(...)
    ↑ 错误回滚时，已打开的 KB handle 泄漏
```

**问题 3：持久化不一致**
- `kb-store`：部分 key 手动 `safeStorageSetString`，部分不持久
- `chat-store`：通过 `zustand/persist` 持久化 messages（限制 100 条）
- `document-workspace-store`：`partialize` 只持久化 tab/draft，不持久化 documents 列表
- `persistence.ts` 定义 `clawkb-highlights` key 但从未使用（死键）

**问题 4：`note_path_registry` 无前端映射**
- 后端维护内存 HashMap，前端无等效缓存
- 笔记路径变更（如重命名）前端无法感知，只能重新请求

### 5.2 路由系统的双重嵌套

当前路由是两个嵌套层级：
```
Page (一级) → Shell component
  ↓
activeExploreView (workspace-store) → 具体 Page 组件
```

**问题**：
- 直接设置 `page='search'` 不会更新 `activeExploreView`
- `Cmd+K` 快捷键正确设置两者，其他导航路径可能不同步
- `ExploreView`（10 个值）和 `Page`（19 个值）有重叠（search, notes 等）

**改造方案**：
```tsx
// 统一路由到单一 Page 类型，移除 activeExploreView
type Page = 'home' | 'spaces' | 'documents' | 'explore' | 'settings'

// explore 下的子页面作为 URL 参数
<Route path="/explore" component={ExploreShell}>
  <Route path="search" component={SearchPage} />
  <Route path="import" component={ImportPage} />
  <Route path="notes/new" component={NotesPage} />
  <Route path="notes/:id" component={NotesPage} />
  ...
</Route>

// 或者保持当前方案，但在 setPage 时同步重置 activeExploreView
function setPage(page: Page) {
  useWorkspaceStore.getState().resetExploreView();
  useKbStore.getState().setPage(page);
}
```

### 5.3 API 层类型不一致

```
命名不一致：
  getEntityEdges()  →  invoke("get_entity")        ←─ 方法名 != 命令名
  traverseGraph()   →  invoke("traverse_graph") ✓

FolderInfo 特殊处理（唯一做 snake→camel 转换）：
  RawFolderInfo { parent_id, doc_count, created_at }
    ↓ toFolderInfo()
  FolderInfo { parentId, docCount, createdAt }

其他 API 均无转换 → 后端必须使用 camelCase（或前端使用 snake_case）
```

---

## 6. 代码质量问题（完整清单）

### 6.1 严重问题（必须立即修复）

| # | 文件 | 行号 | 问题 | 根因 | 影响 |
|---|------|------|------|------|------|
| S1 | `App.tsx` | 49-51 | `useEffect` 依赖数组缺 `darkMode` | 疏忽 | 暗色切换延迟或不生效 |
| S2 | `chat-store.ts` | 87-94 | `openExtraKb` 打开 KB 从不关闭 | 疏忽 | KB handle 内存泄漏 |
| S3 | `lib.rs` (Tauri) | 26 | Tray icon `.unwrap()` | 疏忽 | 无图标时启动崩溃 |
| S4 | `reader.tsx` | 427-436 | `dangerouslySetInnerHTML` | 性能取巧 | XSS 风险（文档内容未净化） |
| S5 | `chat-store.ts` | 91-93 | 多 KB 打开失败时 handle 泄漏 | 错误处理不完整 | 部分失败导致状态不一致 |

### 6.2 高危问题

| # | 文件 | 问题 | 根因 |
|---|------|------|------|
| H1 | `web.rs:103-109` | `extract_title` 无边界检查 | 疏忽 |
| H2 | `web.rs:22` | HTTP 无超时 | 疏忽 |
| H3 | `ai_config.rs:95+` | `RwLock.write().unwrap()` 锁中毒崩溃 | Anti-pattern |
| H4 | `webdav.rs:432` | `duration_since(UNIX_EPOCH).unwrap()` 时钟异常 panic | Anti-pattern |
| H5 | `kb.rs` 全文 | 1791 行仅 2 个测试 | 测试覆盖不足 |
| H6 | `workbench-shell.tsx` | 重复 `openKb` 无幂等检查 | 疏忽 |
| H7 | `commands/mod.rs:679` | 错误信息泄漏 Rust 类型名 | 疏忽 |
| H8 | `explore-shell.tsx` | 无 ErrorBoundary（所有 Suspense 无错误边界） | 疏忽 |

### 6.3 中等问题

| # | 文件 | 问题 |
|---|------|------|
| M1 | `web.rs:65-70` | 无内容长度限制（DoS） |
| M2 | `web.rs:113-179` | HTML 剥离不完整 |
| M3 | `webdav.rs` | `from_bytes().unwrap()` HTTP 方法 |
| M4 | `evif_mcp.rs` | 整个模块空壳 |
| M5 | `kb.rs:1302-1338` | `export()` 只导出 snippet |
| M6 | `types.ts:194-202` | FolderInfo 唯一 camelCase 转换特例 |
| M7 | `chat-store.ts:69-145` | 错误无用户反馈 |
| M8 | `knowledge-space-shell.tsx` | `loadPreview` 异步竞态 |
| M9 | `kb-detail-pane.tsx` | 切换 space 本地状态不重置 |
| M10 | `document-workspace-shell.tsx` | tab 重置可能无限循环 |
| M11 | `kb-chat-pane.tsx` | ask 失败无错误展示 |
| M12 | `kb-list-pane.tsx` | 嵌套 button WCAG 违规 |
| M13 | `folder-store.ts` | `createFolder`/`moveDocument` 无 try/catch |
| M14 | `report-store.ts` | `generateOutline`/`generateSection` 空 catch |
| M15 | `kb-store.ts` | `refreshStats` 空 catch |
| M16 | `graph-store.ts` | `selectEntity` 空 catch |
| M17 | 无快捷键面板 | 全 app 无快捷键帮助页 |
| M18 | 无 Daily Note | Obsidian/Logseq 核心功能缺失 |

### 6.4 UI 一致性问题

**主题断裂**：Shell 层 `bg-white/[0.06]` + Page 层 `bg-card`，8+ 个组件不一致
**语言断裂**：Shell 中文（"资料"、"知识库"）vs ExploreShell Tab 英文（Search、Timeline...）
**字号断裂**：部分标题 2xl，部分 xl，无统一 typographic scale

---

## 7. memvid 核心改造计划

### 7.1 Phase M1：元数据索引化（高优先级）

> **目标**：解决 `note_path_registry` 每次重建 O(N) 问题 + 文件夹 O(N) 扫描问题

**M1.1 构建持久化 KB Registry 帧**

```rust
// kb.rs — 新增 __kb_registry__ 元数据帧

const KB_REGISTRY_TAG: &str = "__kb_registry__";

#[derive(Serialize, Deserialize)]
pub struct KbRegistry {
    pub version: u32,              // 用于未来迁移
    pub note_index: HashMap<String, NoteIndexEntry>,  // path → note_id
    pub folder_index: Vec<FolderIndexEntry>,
    pub tag_index: HashMap<String, TagEntry>,         // tag_name → count + doc_ids
    pub embedding_config: EmbeddingConfigV1,
    pub created_at: i64,
    pub last_modified: i64,
}

#[derive(Serialize, Deserialize)]
pub struct NoteIndexEntry {
    pub note_id: String,
    pub frame_id: u32,
    pub meta_frame_id: Option<u32>,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize)]
pub struct FolderIndexEntry {
    pub folder_id: String,
    pub frame_id: u32,
    pub name: String,
    pub parent_id: Option<String>,
    pub path: String,
    pub doc_count: usize,
}
```

**改造步骤**：
- [ ] 创建 `_build_or_get_registry()` 方法：从现有帧扫描重建或读取现有 registry 帧
- [ ] 创建 `_sync_registry()` 方法：在 `add_note`/`delete_note`/`rename_note`/`create_folder`/`delete_folder` 时自动更新
- [ ] 创建 `get_note_by_path(path) -> Option<FrameId>`：O(1) 查找替代 O(N) 扫描
- [ ] 创建 `list_folders_fast() -> Vec<FolderIndexEntry>`：利用 folder_index 替代全帧扫描
- [ ] 现有命令（`add_note`、`list_folders` 等）改为调用新方法
- [ ] `open()` 时加载 registry 帧，而非每次重建

**M1.2 构建 Tag 索引**

```rust
#[derive(Serialize, Deserialize)]
pub struct TagEntry {
    pub tag: String,
    pub count: usize,
    pub doc_ids: Vec<String>,  // frame_id 列表（用于批量操作）
}
```

- [ ] `list_tags()` 改为读取 registry.tag_index
- [ ] `rename_tag()` / `merge_tag()` / `delete_tag()` 更新 tag_index

**M1.3 回填脚本**

- [ ] 编写 `backfill_registry()` 扫描全量帧构建 registry 帧
- [ ] 命令行工具：`clawkb-cli backfill --kb-path ~/.clawkb/knowledge.mv2`

### 7.2 Phase M2：双向链接系统（中优先级）

> **目标**：实现 Obsidian 式的 `[[wiki-link]]` 和反向链接面板

**M2.1 Link 解析层（Rust）**

```rust
// kb.rs — 新增链接相关命令

// 提取内容中的 [[链接]]
pub fn extract_outlinks(content: &str) -> Vec<String> {
    // 正则：\[\[([^\]]+)\]\] 匹配 [[笔记名]]
    // 返回标题列表（未解析为 frame_id）
}

// 解析链接 → frame_id
pub fn resolve_link(title: &str) -> Option<FrameId> {
    // 1. 精确匹配 note_meta.title
    // 2. fuzzy 匹配（编辑距离 ≤ 2）
}

// 更新笔记的 outlinks/backlinks
pub fn sync_note_links(note_frame_id: FrameId, new_content: &str) {
    // 1. 解析 new_content 中的 [[...]]
    // 2. 获取旧 outlinks（从 meta 帧读取）
    // 3. diff：移除失效的 outlink，更新对方笔记的 backlinks
    // 4. 添加新 outlink，更新对方笔记的 backlinks
    // 5. 更新当前笔记 meta 帧的 outlinks 字段
}

// 列出笔记的反向链接
pub fn list_backlinks(note_id: &str) -> Vec<BacklinkEntry> {
    // 从 note_meta 帧读取 backlinks，返回 [{ source_id, source_title, context_snippet }]
}
```

**M2.2 前端集成**

- [ ] TipTap 编辑器拦截 `[[` 键盘输入，弹出笔记搜索下拉
- [ ] 下拉列表调用 `resolve_link` API，实时搜索已有笔记标题
- [ ] 选中标题后插入 `[[标题]]`，并存储 frame_id 用于高亮
- [ ] 链接点击 → 调用 `resolve_link` → 跳转目标笔记
- [ ] Reader 页面底部添加"反向链接"面板，调用 `list_backlinks`
- [ ] 笔记元数据帧新增 `outlinks` 和 `backlinks` 字段展示

**M2.3 回溯迁移**

- [ ] 扫描所有笔记帧，提取 `[[...]]` 并调用 `sync_note_links()`
- [ ] 为已有笔记填充 backlinks/outlinks

### 7.3 Phase M3：笔记大纲提取（中优先级）

> **目标**：让笔记的结构化大纲可导航、可编辑

```rust
// 笔记内容 → 大纲树
#[derive(Serialize, Deserialize)]
pub struct OutlineNode {
    pub level: u8,        // 1 = H1, 2 = H2, ...
    pub text: String,
    pub position: usize,   // 字节偏移量（用于跳转）
    pub children: Vec<OutlineNode>,
}

// API
pub fn extract_outline(content: &str) -> Vec<OutlineNode> {
    // 正则匹配 # ## ### 等标题行
    // 构建嵌套树结构
}

pub fn save_outline(note_id: &str, outline: Vec<OutlineNode>) {
    // 更新 note_meta 帧
}
```

- [ ] 后端实现大纲提取
- [ ] 前端 `<OutlinePanel />`：EditorPage 侧边栏
- [ ] 点击大纲条目 → 滚动到对应位置
- [ ] 大纲内拖拽调整段落顺序（更新 content + outline）

### 7.4 Phase M4：MV2 文件格式扩展（低优先级，长期）

> **目标**：引入 `Folder` 专用 FrameKind，消除 tag 扫描

```rust
// memvid-core 需扩展 FrameKind 枚举
// 这是一个 upstream 变更需求，不是 clawkb-core 本地改动

enum FrameKind {
    Note,           // 笔记内容帧
    Document,       // 导入的文档
    Folder,         // 新增：文件夹节点
    NoteMeta,       // 笔记元数据
    Config,         // KB 配置
    // ...
}

// clawkb-core 改动：
// 1. create_folder() → mem.put_frame(FrameKind::Folder, ...)
// 2. list_folders() → mem.list_frames_by_kind(FrameKind::Folder)
// 3. delete_folder() → mem.update_frame_status(id, FrameStatus::Deleted)
```

- [ ] 向 memvid-core 提交 Feature Request 或 PR
- [ ] 等待 upstream 接受后，改造 clawkb-core 的文件夹实现

---

## 8. UI 完善计划（按优先级）

### 8.1 Phase U0：紧急修复（1-2 天） ✅ 全部完成

- [x] **S1** App.tsx `useEffect` 添加 `darkMode` 依赖（1 行）— 2026-05-06
- [x] **S3** Tauri lib.rs Tray icon 添加 `.unwrap_or_else(|| ...)` fallback — 2026-05-06
- [x] **S4** reader.tsx `dangerouslySetInnerHTML` 替换为 `react-markdown` — 2026-05-06
- [x] **M14** 创建 `<ErrorBoundary />` 组件，包裹所有 `<Suspense>` — 2026-05-06
- [x] **M2** web.rs fetch 添加 `Client::builder().timeout(Duration::from_secs(30))` — 2026-05-06
- [x] **M1** web.rs HTML fetch 添加最大 10MB 内容长度检查 — 2026-05-06
- [x] **S2/S5** chat-store KB handle leak — openedKbs tracking + finally cleanup — 2026-05-06
- [x] **H1** extract_title bounds checking — checked_add + min(html.len()) — 2026-05-06
- [x] **H6** workbench-shell 重复 openKb 保护 — listOpenKbs() idempotency check — 2026-05-06
- [x] **Store empty catch blocks** — kb-store/folder-store/report-store/graph-store — 2026-05-06

> ort-sys/onnxruntime 编译错误为环境问题（非代码问题），不影响已完成的修复

### 8.2 Phase U1：核心写作体验（3-5 天） ✅ 全部完成

- [x] 提取 TipTap 编辑器为 `<RichEditor />` 共享组件 — 2026-05-06
- [x] NotesPage：`Textarea` → `<RichEditor />` + 自动保存（3s debounce）— 2026-05-06
- [x] EditorPage：添加 H1/H2/H3、link insertion（Cmd+K）、code block — 2026-05-06
- [x] EditorPage：添加字数统计 + 保存状态提示 — 2026-05-06
- [x] NotesPage：支持编辑已有笔记（URL 参数 `:id`）— 2026-05-06
- [x] `<OutlinePanel />` 创建（EditorPage 侧边栏）— 2026-05-06

### 8.3 Phase U2：对话与命令面板（3-4 天） ✅ 全部完成

- [x] `<ChatHistory />` 组件：渲染 `visibleMessages` 消息列表 — 2026-05-06
- [x] `<CommandPalette />`（Cmd+P 触发）模糊搜索 KB 笔记 — 2026-05-06
- [x] WorkbenchShell 集成 ChatHistory（在 Composer 上方）— 2026-05-06
- [x] App.tsx 全局 `Cmd+P` / `Cmd+K` 键盘监听 — 2026-05-06
- [x] 修复 `chat-store` — 对话结束时关闭 `openExtraKb` handles — 2026-05-06（Phase U0 已完成）
- [x] `layout.tsx` Header Cmd+K 搜索添加实际 keydown 监听 — 2026-05-06

### 8.4 Phase U3：视觉一致性（2-3 天） ✅ 全部完成

- [x] 创建 `src/styles/tokens.css` 暗色主题变量集（已有）— 2026-05-06 增强
- [x] tokens.css 添加 `--kb-accent: amber-300` 强调色变量 — 2026-05-06
- [x] 替换自定义组件的 `bg-background` → `dark:bg-background bg-white`（12+ 文件）— 2026-05-06
- [x] 统一 ExploreShell Tab 为中文（搜索/导入/时间线/标签/实体/图谱/脑图/报告/播客）— 2026-05-06
- [x] 审计所有按钮文本，统一中英文 — 2026-05-06

### 8.5 Phase U4：笔记组织（3-5 天） ✅ 部分完成

- [ ] 后端：`resolve_note_link` 命令
- [ ] 后端：`list_backlinks` 命令
- [ ] 前端：Reader 底部反向链接面板（依赖后端 backlinks 命令）
- [x] 前端：TipTap `[[` 触发自动完成 — 2026-05-06 ✅ (wikilink-autocomplete.tsx + editor.tsx 集成)
- [x] 模板管理：localStorage 模板存储 CRUD — 2026-05-06 ✅ (template-store.ts + template-manager.tsx)
- [x] 新建笔记时模板选择器 — 2026-05-06 ✅ (editor.tsx 集成)

### 8.6 Phase U5：高级功能完善（3-5 天） ✅ 部分完成

- [ ] Mind Map：SVG + D3 交互式脑图（径向布局）
- [x] Podcast：`handleRegenerateSegment` 接入 `aiAsk` API — 2026-05-06 ✅ (podcast.tsx)
- [x] Graph：添加缩放/平移控制 + 节点位置持久化 — 2026-05-06 ✅ (graph.tsx)
- [ ] Reader：PDF 文本选择 + 多侧边栏布局管理
- [x] 无障碍：`aria-label` 补全 + WCAG 合规修复 — 2026-05-06 ✅ (layout.tsx / home-composer.tsx / kb-chat-pane.tsx)

### 8.7 Phase U6：安全与质量（2-3 天） ✅ 部分完成

- [x] 前端：所有 Store 的空 catch 替换为 `set({ error: ... })` — 2026-05-06（Phase U0）
- [x] kb-list-pane：删除确认 Dialog（两阶段确认）— 2026-05-06
- [x] kb-chat-pane：添加错误状态展示 — 2026-05-06
- [x] 后端：`get_note` / `list_notes` / `update_note` / `delete_note` 命令 — 2026-05-06
- [x] Rust：`list_note_records` / `update_note_record` / `delete_note_record` 方法 — 2026-05-06
- [x] Rust：`RwLock` 替换 `.unwrap()` → `if let Ok` + 日志记录 — 2026-05-06 ✅ (ai_config.rs)
- [x] Rust：`from_bytes().unwrap()` → `.expect()` — 2026-05-06 ✅ (webdav.rs)
- [x] Rust：`duration_since` 处理 `Err` — 2026-05-06 ✅ (webdav.rs)
- [x] 测试：kb.rs 核心路径单元测试（ask/search/export/folder）— 2026-05-06 ✅ (core_regression.rs + note_domain_regression.rs)
- [x] 测试：web.rs 边界测试 — 2026-05-06 ✅ (web_tests.rs extract_title/strip_html)

---

## 9. Daily Note 功能设计（新增）

> Obsidian/Logseq 的 Daily Note 是最高频使用功能，ClawKB 当前完全缺失。

### 9.1 数据模型

```rust
// Daily Note = 特定路径的笔记
// 路径约定：/Daily/YYYY-MM-DD.md
// 由 frontmatter 中的 date 字段标识

struct DailyNote {
    date: NaiveDate,           // 2024-01-15
    frame_id: u32,
    path: String,              // "/Daily/2024-01-15"
    journal_entry: bool,      // frontmatter: journal: true
}

// API
pub fn get_or_create_daily_note(date: NaiveDate) -> Result<FrameId>
pub fn list_daily_notes(from: NaiveDate, to: NaiveDate) -> Vec<DailyNote>
pub fn get_calendar_heat_map(year: i32) -> CalendarHeatMap
```

### 9.2 前端组件

- [ ] 日历热力图组件（GraphPage 旁或独立页面）：展示每日笔记密度
- [x] 快捷键 `Cmd+Shift+D`：打开今日日记（不存在则创建）— 2026-05-06 ✅ (App.tsx)
- [ ] 日记模板支持（`journal_template` 存储在 registry 帧）
- [ ] 侧边栏"日历"视图：月历 + 点击跳转

---

## 10. 推荐执行顺序

```
Phase U0 (紧急修复) ─────────────────────────────────┐
                                                      │
Phase U1 (写作体验) ─────────────────────────────────┤─ 并行
Phase U3 (视觉一致) ─────────────────────────────────┤
Phase M1 (元数据索引化) ──────────────────────────────┤─ 优先
                                                      │
Phase U2 (对话/命令面板) ────────────────────────────┤
Phase M2 (双向链接) ─────────────────────────────────┤─ 顺序
Phase U4 (笔记组织) ──────────────────────────────────┤
Phase M3 (大纲提取) ─────────────────────────────────┤
                                                      │
Phase U5 (高级完善) ─────────────────────────────────┤─ 可选
Phase M4 (MV2 扩展) ─────────────────────────────────┘
Phase U6 (安全/测试) ──────────────────────────────── 随时
Phase 9  (Daily Note) ─────────────────────────────── P2/P3
```

**执行原则**：
- Phase U0 和 Phase M1 是最优先的——一个修 crash，一个修性能
- Phase U1 和 Phase U3 可以并行（不同文件）
- Phase M2 依赖 Phase M1 完成（需要 note_path_registry 先就绪）
- Phase 9（Daily Note）可以独立推进

---

## 11. 总结

### ClawKB 的核心优势（竞品不具备）

| 能力 | ClawKB | Obsidian | Notion | Logseq |
|------|--------|----------|--------|--------|
| 原生 RAG 问答 | ✅ | 插件 | API | 插件 |
| 时间旅行（帧级历史） | ✅ | Git | 数据库 | Git |
| 混合检索（BM25+HNSW+图谱） | ✅ | 插件组合 | API | 插件 |
| 多模态（OCR/音频/图片） | ✅ | 插件 | 插件 | ❌ |
| 单文件本地存储 | ✅ | ❌ (Vault=目录) | ❌ | ❌ |
| WebDAV 原生同步 | ✅ | 插件 | ❌ | 插件 |
| MCP Server 接口 | ✅ (evif-mcp 待实现) | ❌ | ❌ | ❌ |

### ClawKB 的最大短板

1. **笔记写作体验差**（NotesPage textarea）
2. **对话历史不可见**（visibleMessages 未渲染）
3. **无双链/反链**（最核心的笔记组织能力缺失）
4. **元数据操作全量扫描**（list_folders O(N)）
5. **UI 视觉断裂**（暗色壳 + 亮色页）

### 行动优先级

**立即行动（本周）**：
1. S1 + S3 + S4 + M14 + M2 = 6 个文件修复，每个 < 30 分钟，共 1-2 天

**短期行动（2 周）**：
2. Phase U1（写作体验）+ Phase M1（元数据索引化）

**中期行动（1 个月）**：
3. Phase U2/U3 + Phase M2/M3 + Phase 9（Daily Note）

**长期行动（可选）**：
4. Phase M4（MV2 upstream）+ Phase U5 + Phase U6

---

*本计划基于 memvid-core v2.0.139、clawkb-core 全模块、React 32 组件、53 个 Tauri 命令的完整源码分析。*
*memvid 生态调研涵盖官方 GitHub、crates.io、5 篇技术博客、3 个 Reddit 讨论。*
