# ClawKB vs Obsidian Gap Analysis & Development Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于当前 ClawKB 代码现状，系统对标 Obsidian 的核心能力，明确差距、优先级与实施路径，把产品从“可用的本地 AI 知识库工作台”推进到“可替代 Obsidian 的桌面知识管理产品”。

**Architecture:** 继续沿用现有 `clawkb-core`（Rust 数据与检索内核）+ `src-tauri`（桌面命令桥）+ `src`（React/Tauri UI）三层架构，不推翻重做。开发策略采用“三段式”：先补齐知识管理基础设施（Markdown/Vault/链接/属性/文件树），再补齐 Obsidian 级工作流（反链/日记/模板/工作区/命令系统），最后再做 ClawKB 的 AI 差异化增强。

**Tech Stack:** Rust workspace (`clawkb-core` / `clawkb-cli` / `src-tauri`) + Tauri 2 + React 19 + TypeScript + Zustand + TipTap + shadcn/ui + d3-force + Vitest + Cargo test

---

## 0. 本次分析依据

### 0.1 当前仓库实际观察

已基于当前代码与测试结果完成盘点：

- Rust 测试：`cargo test -q` 通过（24 tests）
- 前端测试：`cd src && npm run test -- --run` 通过（16 files / 40 tests）
- 前端当前已具备：本地 KB 打开/创建、导入、搜索、标签、时间线、图谱、文档工作台、AI 问答、WebDAV 同步、Obsidian Vault 导入、OCR、报告/播客等能力雏形
- 当前前端以 `Workbench / Knowledge Space / Document Workspace / Explore / Settings` 为主壳层，已不是 demo landing page，但仍存在多处“工具台化”而非“笔记产品化”的结构问题
- Rust 内核中 `kb.rs` 已较成熟，具备索引、标签、文件夹、图关系、导入、时间线、同步等能力；但“Markdown-first 知识库”这一主线仍未成为数据模型中心

### 0.2 Obsidian 官方能力基线（用于对标）

本计划对标的不是社区插件宇宙的全部，而是 Obsidian 的主干体验与官方能力基线，重点参考：

- 内链 / Wiki links：<https://help.obsidian.md/Linking%20notes%20and%20files/Internal%20links>
- Backlinks：<https://help.obsidian.md/plugins/backlinks>
- Graph view：<https://help.obsidian.md/plugins/graph>
- Properties：<https://help.obsidian.md/properties>
- Properties view：<https://help.obsidian.md/plugins/properties>
- Canvas：<https://help.obsidian.md/plugins/canvas>
- Daily notes：<https://help.obsidian.md/plugins/daily-notes>
- Templates：<https://help.obsidian.md/Plugins/Templates>
- Workspaces：<https://help.obsidian.md/Plugins/Workspaces>
- Community plugins：<https://help.obsidian.md/community-plugins>
- Workspace 概念：<https://help.obsidian.md/workspace>

这意味着，本计划重点对齐以下产品能力：

1. Markdown 文件即知识单元
2. 双链、反链、图谱互通
3. 属性（YAML/frontmatter）可见、可编辑、可索引
4. Vault / 文件树 / 文件夹 / 模板 / 日记的日常写作流
5. 可组合的工作区、标签页、命令入口
6. 可扩展性（插件、自动化、开放格式）

---

## 1. 当前 ClawKB 能力总评

## 1.1 已经明显强于“普通文档问答工具”的部分

ClawKB 当前已经不是一个简单的 RAG demo，而是具备以下真实能力的桌面应用：

- 本地知识库文件创建、打开、统计、提交
- 多格式导入：文档、目录、网页、图片、音频、Obsidian Vault
- 关键词 / 混合 / 图增强搜索
- 标签系统、实体抽取、时间线、关系图谱
- AI 问答、文档问答、时间点问答、对比问答
- 文档工作台（阅读、草稿、报告、播客）
- WebDAV 同步与 OCR
- 明确的本地优先、桌面优先定位

结论：**ClawKB 在“AI 驱动知识检索与加工”上已经有较强基础。**

## 1.2 相比 Obsidian 的核心短板

如果用一句话概括：

**ClawKB 现在更像“以 AI 为中心的本地知识处理工作台”，而不是“以 Markdown/Vault/链接写作为中心的知识管理系统”。**

也就是说，ClawKB 的短板不是“没有能力页”，而是：

- 还没有把“笔记文件”作为第一公民
- 还没有形成 Obsidian 那种低摩擦、连续性的写作—链接—整理闭环
- 还没有形成可扩展的知识工作流平台层

---

## 2. 对标 Obsidian 的差距矩阵

下表按四档评估：

- **A 已具备**：可直接对标
- **B 部分具备**：有底层能力，但体验或模型不完整
- **C 明显缺失**：需要专项建设
- **D 暂不建议对齐**：可以保留差异化，不必短期追平

### 2.1 知识单元与存储模型

| 能力 | Obsidian 基线 | ClawKB 现状 | 评级 | 结论 |
|---|---|---|---|---|
| Markdown 文件为核心 | 每篇笔记就是 Markdown 文件 | 当前核心是 `.mv2` 数据库对象，Markdown 只是导入/导出形态之一 | C | 这是最大差距 |
| Vault 概念 | 文件夹即 Vault，文件系统可见 | ClawKB 有 KB 文件，但不是面向用户可操作的 Vault | C | 需补“库=目录/仓库”语义 |
| 文件树浏览 | 一级核心能力 | 有 folder/store，但更像分类容器，不是完整文件树 | C | 缺少真正文件资源管理器 |
| 笔记重命名/移动/链接保持 | 日常基础能力 | 有文档与文件夹操作，但非 Markdown 链接语义 | C | 需围绕 note path 重建 |
| 开放格式 | md/json/canvas/plugin ecosystem | `.mv2` 自有格式为主 | B | 可保留内核，但需开放笔记层 |

### 2.2 编辑与写作体验

| 能力 | Obsidian 基线 | ClawKB 现状 | 评级 | 结论 |
|---|---|---|---|---|
| Markdown 编辑 | 核心体验 | 当前 `EditorPage` 更偏工作草稿，不是 Vault note editor | C | 需专门的 note editor |
| 实时预览 / 所见即所得 | Live Preview / Source 模式 | 有 TipTap 编辑与阅读，但不是 Markdown 双模 | C | 缺预览与源码双态 |
| 双链输入 `[[...]]` | 核心能力 | 未发现完整 wiki-link 输入与补全 | C | 必补 |
| 块引用 / 标题锚点链接 | Obsidian 常用工作流 | 未形成系统支持 | C | 中高优先级 |
| 多标签页编辑 | Workspace 基础 | 有 document tabs，但更偏文档工作流 | B | 可演进 |
| 快捷命令写作流 | Command palette + hotkeys | 未形成系统入口 | C | 需要平台层支持 |

### 2.3 连接性与知识网络

| 能力 | Obsidian 基线 | ClawKB 现状 | 评级 | 结论 |
|---|---|---|---|---|
| 反链 Backlinks | 官方核心插件 | 当前更偏 entity graph，不是 note backlink | C | 关键缺口 |
| 全局图谱 | 官方核心插件 | 已有 GraphPage，但实体图为主 | B | 方向对，模型不对 |
| 局部图谱 | 打开当前 note 的 local graph | 未见标准 note-local graph | C | 需补 |
| 标签关系浏览 | 搜索与图谱联动 | 已有 tags/entities/graph | B | 可继续增强 |
| 未创建链接（unlinked mentions） | Backlinks 常用能力 | 未见 | C | 中优先级 |

### 2.4 结构化元数据

| 能力 | Obsidian 基线 | ClawKB 现状 | 评级 | 结论 |
|---|---|---|---|---|
| YAML frontmatter / properties | 官方一等公民 | 仅在 Obsidian 导入解析中体现 | C | 需提升为通用 note schema |
| 属性编辑器 | Properties view | 未见统一属性 UI | C | 必补 |
| 属性类型系统 | text/date/list/tags 等 | 当前 tag/entity 有，但不是属性系统 | C | 需建立 schema |
| 按属性搜索/筛选 | 官方支持 | 当前 search 以全文/RAG 为主 | C | 必补 |

### 2.5 日常工作流

| 能力 | Obsidian 基线 | ClawKB 现状 | 评级 | 结论 |
|---|---|---|---|---|
| Daily notes | 官方核心插件 | 未见日记流 | C | 高频刚需 |
| Templates | 官方核心插件 | 报告模板存在，但不是 note template | C | 需区分写作模板与 AI 产物模板 |
| 工作区 Workspaces | 保存布局与打开标签 | 有 workspace store，但更偏应用状态 | B | 需产品化 |
| 命令面板 | 全局入口 | 未见 | C | 高优先级 |
| 快捷键系统 | 高频工作流依赖 | 未见系统化配置 | C | 中高优先级 |
| 文件打开历史/最近文档 | 基础易用性 | 局部具备 | B | 可补齐 |

### 2.6 扩展生态与平台能力

| 能力 | Obsidian 基线 | ClawKB 现状 | 评级 | 结论 |
|---|---|---|---|---|
| 插件系统 | 核心竞争壁垒 | 当前没有桌面插件 API | C | 长期战略能力 |
| 命令注册机制 | 插件与内置命令共用 | 当前命令主要是 Tauri invoke | C | 应先抽象命令层 |
| 自动化 / URI / Deep link | 可与外部工具联动 | 未形成 | C | 长期需要 |
| 开放文档格式 | md/canvas/json | 仅部分导入导出 | B | 需补笔记层开放性 |

### 2.7 ClawKB 反而有机会领先的点

| 方向 | Obsidian 现状 | ClawKB 优势 |
|---|---|---|
| AI 问答 | 依赖插件生态 | 内建并已深度接入 KB |
| 多模态导入 | 原生一般，依赖插件 | 已有 OCR/音频/网页/图片导入链路 |
| 时间语义检索 | 不是核心主线 | 已有 timeline / as-of / compare |
| 实体网络 | 依赖插件 | 已有 entity / graph 基础 |
| 个人本地 AI 工作台 | 需要拼插件 | 当前定位更集中 |

结论：**ClawKB 不应该机械复制 Obsidian，而应先补 Obsidian 的“知识管理底座”，再保留自己的 AI 优势。**

---

## 3. 根因分析：为什么现在不像 Obsidian

### 3.1 数据模型中心错位

当前中心对象是：

- `KnowledgeBase`
- `SearchHit`
- `ImportResult`
- `EntityInfo`
- `TimelineEntry`

而不是：

- `Note`
- `NotePath`
- `Frontmatter`
- `Link`
- `Backlink`
- `BlockRef`
- `WorkspaceLayout`

这导致：

- 搜索、AI、图谱很强
- 但“写笔记、连笔记、整理笔记”的基础体验薄弱

### 3.2 UI 主线偏“功能页”，不是“知识工作流”

当前页面丰富，但用户主线仍像功能导航：

- Search
- Import
- Timeline
- Tags
- Entities
- Graph
- Mindmap
- Report
- Podcast

Obsidian 的主线却更像：

- 打开 Vault
- 从文件树进入 note
- 编辑 / 链接 / 查看反链 / 局部图
- 用模板 / 日记 / 工作区持续工作

这意味着 ClawKB 需要从“页面集合”转向“笔记工作流中心”。

### 3.3 编辑器与知识连接是分离的

现在编辑器、搜索、图谱、实体、报告彼此都存在，但缺少统一的 note context：

- 编辑时无法顺滑插入 wiki link
- 打开 note 时看不到 backlinks / local graph / properties
- 图谱和实体不天然回流到写作场景

### 3.4 当前扩展能力不足

Obsidian 的长期护城河不只是 Markdown，而是：

- 命令面板
- 可配置工作区
- 插件生态
- 开放文件层

ClawKB 现在更像“做好的产品功能”，而不是“可生长的平台”。

---

## 4. 产品策略建议：不要全盘复制 Obsidian

## 4.1 该追平的部分

这些必须追平，否则用户不会把 ClawKB 当成真正的知识管理产品：

1. Markdown-first note 模型
2. 文件树 / Vault / note path
3. wiki links / backlinks / local graph
4. properties/frontmatter
5. daily notes / templates
6. workspace / command palette / hotkeys

## 4.2 不必短期追平的部分

这些可以延后，甚至保持差异化：

1. 社区插件市场规模
2. 主题生态
3. Publish 类网站托管
4. 移动端完整体验
5. 超大规模第三方插件兼容

## 4.3 应该放大的自身差异化

一旦基础补齐，ClawKB 应强调：

1. AI native：每个 note、folder、tag、timeline 都可直接 ask
2. 时间机器：按时间点查询与比较
3. 多模态入库：文档、网页、图像、音频统一入库
4. 实体/关系增强：比传统 backlinks 更“语义化”
5. 个人本地：更安静、更少配置摩擦

---

## 5. 总体开发路线图

本路线图分为四个阶段：

- **Phase 1：补齐知识管理底座**
- **Phase 2：形成 Obsidian 级日常工作流**
- **Phase 3：建立平台层与可扩展性**
- **Phase 4：做 AI 差异化超越**

优先级原则：

- 先补基础对象模型，再补界面
- 先让“写笔记和连笔记”成立，再强化 AI
- 先做用户高频路径，再做炫技页

---

## 6. 目标代码结构调整（规划层）

### 6.1 Rust 层新增/重构建议

**重点新增模块：**

- Create: `crates/clawkb-core/src/markdown_note.rs`
- Create: `crates/clawkb-core/src/frontmatter.rs`
- Create: `crates/clawkb-core/src/link_index.rs`
- Create: `crates/clawkb-core/src/backlinks.rs`
- Create: `crates/clawkb-core/src/workspace.rs`
- Create: `crates/clawkb-core/src/templates.rs`
- Create: `crates/clawkb-core/src/daily_notes.rs`
- Modify: `crates/clawkb-core/src/kb.rs`
- Modify: `crates/clawkb-core/src/search.rs`
- Modify: `crates/clawkb-core/src/export.rs`
- Modify: `crates/clawkb-core/src/sync/obsidian.rs`

### 6.2 Tauri 命令桥新增建议

- Modify: `src-tauri/src/commands/mod.rs`
- Add commands:
  - `list_notes`
  - `get_note`
  - `save_note`
  - `rename_note`
  - `move_note`
  - `delete_note`
  - `list_backlinks`
  - `list_outgoing_links`
  - `get_local_graph`
  - `list_properties`
  - `update_properties`
  - `create_daily_note`
  - `list_templates`
  - `apply_template`
  - `save_workspace_layout`
  - `load_workspace_layout`
  - `list_commands`
  - `run_command`

### 6.3 前端新增/重构建议

- Create: `src/src/store/note-store.ts`
- Create: `src/src/store/command-store.ts`
- Create: `src/src/store/workspace-layout-store.ts`
- Create: `src/src/components/notes/note-editor.tsx`
- Create: `src/src/components/notes/note-properties-pane.tsx`
- Create: `src/src/components/notes/backlinks-pane.tsx`
- Create: `src/src/components/notes/local-graph-pane.tsx`
- Create: `src/src/components/notes/note-file-tree.tsx`
- Create: `src/src/components/notes/template-picker.tsx`
- Create: `src/src/components/notes/daily-note-entry.tsx`
- Create: `src/src/components/command/command-palette.tsx`
- Modify: `src/src/components/layout.tsx`
- Modify: `src/src/components/pages/editor.tsx`
- Modify: `src/src/components/pages/reader.tsx`
- Modify: `src/src/components/pages/graph.tsx`
- Modify: `src/src/components/pages/notes.tsx`
- Modify: `src/src/api/types.ts`
- Modify: `src/src/api/commands.ts`

---

## 7. 分阶段实施计划

### Task 1: 建立 Note Domain Model（最高优先级）

**Files:**
- Create: `crates/clawkb-core/src/markdown_note.rs`
- Create: `crates/clawkb-core/src/frontmatter.rs`
- Modify: `crates/clawkb-core/src/lib.rs`
- Modify: `crates/clawkb-core/src/kb.rs`
- Test: `crates/clawkb-core/tests/note_domain_regression.rs`

**目标：**
把“笔记”从 `SearchHit` 的派生视图提升为一等对象，拥有稳定的 `id/path/title/content/frontmatter/tags/links/updated_at`。

- [ ] **Step 1: 定义 `NoteRecord`、`FrontmatterValue`、`NotePath` 结构**
- [ ] **Step 2: 为 `.mv2` 增加 note 级读取与写入接口**
- [ ] **Step 3: 建立标题、路径、别名的唯一性规则**
- [ ] **Step 4: 为 note CRUD 添加 Rust 回归测试**
- [ ] **Step 5: 运行 `cargo test -q note_domain_regression`**
- [ ] **Step 6: Commit**

**验收标准：**
- 可以不依赖搜索结果直接读取/保存一篇 note
- note 可稳定重命名/移动且不破坏 ID
- frontmatter 不再只存在于 Obsidian 导入逻辑中

### Task 2: 把 Markdown / Wiki Link 变成核心工作流

**Files:**
- Create: `crates/clawkb-core/src/link_index.rs`
- Create: `crates/clawkb-core/src/backlinks.rs`
- Modify: `crates/clawkb-core/src/kb.rs`
- Modify: `src/src/components/notes/note-editor.tsx`
- Modify: `src/src/api/commands.ts`
- Test: `crates/clawkb-core/tests/wiki_links_regression.rs`
- Test: `src/src/__tests__/note-editor-links.test.tsx`

- [ ] **Step 1: 解析 `[[note]]`、`[[note#heading]]`、`[[note|alias]]`**
- [ ] **Step 2: 构建 outgoing links 与 backlinks 索引**
- [ ] **Step 3: 编辑器支持 `[[` 补全与跳转**
- [ ] **Step 4: 打开 note 时展示 backlinks 面板**
- [ ] **Step 5: 运行 Rust 与前端定向测试**
- [ ] **Step 6: Commit**

**验收标准：**
- 写 note 时可插入内部链接
- 查看 note 时能看到引用它的其他 note
- 重命名 note 后链接自动更新或给出修复方案

### Task 3: 构建真正的 Vault / 文件树体验

**Files:**
- Create: `src/src/components/notes/note-file-tree.tsx`
- Create: `src/src/store/note-store.ts`
- Modify: `src/src/components/layout.tsx`
- Modify: `src/src/components/pages/notes.tsx`
- Modify: `src-tauri/src/commands/mod.rs`
- Test: `src/src/__tests__/note-file-tree.test.tsx`

- [ ] **Step 1: 定义 `list_notes / move_note / rename_note / delete_note` API**
- [ ] **Step 2: 前端渲染层级文件树与文件夹操作**
- [ ] **Step 3: 支持创建 note、拖拽移动、重命名**
- [ ] **Step 4: 让“Notes”页升级为默认工作入口之一**
- [ ] **Step 5: 运行前端行为测试**
- [ ] **Step 6: Commit**

**验收标准：**
- 用户能像在 Obsidian 一样，从左侧树状结构进入笔记
- 路径操作不依赖导入流程
- 搜索与文件树共享同一 note 模型

### Task 4: 将 Properties / Frontmatter 产品化

**Files:**
- Create: `src/src/components/notes/note-properties-pane.tsx`
- Modify: `crates/clawkb-core/src/frontmatter.rs`
- Modify: `src/src/api/types.ts`
- Modify: `src/src/api/commands.ts`
- Test: `crates/clawkb-core/tests/frontmatter_regression.rs`
- Test: `src/src/__tests__/note-properties-pane.test.tsx`

- [ ] **Step 1: 支持 text/list/number/checkbox/date/datetime/tags 属性类型**
- [ ] **Step 2: 定义属性 schema 与统一序列化规则**
- [ ] **Step 3: UI 支持查看、编辑、删除属性**
- [ ] **Step 4: 支持按属性搜索与筛选**
- [ ] **Step 5: 运行属性层回归测试**
- [ ] **Step 6: Commit**

**验收标准：**
- 每篇 note 顶部都有清晰 properties 区
- frontmatter 读写与导入保持一致
- 可按 `tags`、`date`、`aliases`、自定义属性检索

### Task 5: 从“实体图”扩展到“笔记图 + 局部图”

**Files:**
- Modify: `src/src/components/pages/graph.tsx`
- Create: `src/src/components/notes/local-graph-pane.tsx`
- Modify: `crates/clawkb-core/src/backlinks.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Test: `src/src/__tests__/local-graph-pane.test.tsx`

- [ ] **Step 1: 区分 note graph 与 entity graph 两种图谱模式**
- [ ] **Step 2: 支持当前 note 的 local graph**
- [ ] **Step 3: 图谱节点点击可打开 note / property / backlink context**
- [ ] **Step 4: 支持基础过滤（tag/path/orphan）**
- [ ] **Step 5: 运行图谱交互测试**
- [ ] **Step 6: Commit**

**验收标准：**
- 图谱不再只展示实体网络
- 用户能从 note 看局部图、从全局看连接密度
- orphan notes 可视化可用

### Task 6: 补齐 Daily Notes 与 Templates 高频流

**Files:**
- Create: `crates/clawkb-core/src/daily_notes.rs`
- Create: `crates/clawkb-core/src/templates.rs`
- Create: `src/src/components/notes/template-picker.tsx`
- Create: `src/src/components/notes/daily-note-entry.tsx`
- Test: `crates/clawkb-core/tests/daily_notes_regression.rs`
- Test: `src/src/__tests__/daily-note-entry.test.tsx`

- [ ] **Step 1: 定义 daily note path 规则与默认日期格式**
- [ ] **Step 2: 支持模板目录与模板变量（`{{title}}` / `{{date}}` / `{{time}}`）**
- [ ] **Step 3: 一键打开/创建今日日记**
- [ ] **Step 4: 支持从模板新建 note**
- [ ] **Step 5: 运行模板与日记流测试**
- [ ] **Step 6: Commit**

**验收标准：**
- 用户可以每天直接进入日记入口
- 模板成为常规写作能力，而非 AI 报告模板的附属能力

### Task 7: 命令面板、热键、工作区布局

**Files:**
- Create: `src/src/store/command-store.ts`
- Create: `src/src/store/workspace-layout-store.ts`
- Create: `src/src/components/command/command-palette.tsx`
- Create: `crates/clawkb-core/src/workspace.rs`
- Modify: `src/src/components/layout.tsx`
- Test: `src/src/__tests__/command-palette.test.tsx`
- Test: `src/src/__tests__/workspace-layout-store.test.ts`

- [ ] **Step 1: 统一内置命令定义（open note / daily note / search / graph / import）**
- [ ] **Step 2: 提供命令面板 UI 与 fuzzy filter**
- [ ] **Step 3: 保存/恢复工作区布局与打开标签**
- [ ] **Step 4: 增加热键配置入口**
- [ ] **Step 5: 运行命令层与布局层测试**
- [ ] **Step 6: Commit**

**验收标准：**
- `Cmd/Ctrl+P` 可成为主入口
- 工作区可以保存“写作 / 阅读 / 研究”三类布局
- 现有 Workbench shell 概念被产品化而不是仅作状态壳层

### Task 8: 搜索系统从 RAG 检索升级为“知识管理检索”

**Files:**
- Modify: `crates/clawkb-core/src/search.rs`
- Modify: `src/src/components/pages/search.tsx`
- Modify: `src/src/api/types.ts`
- Test: `crates/clawkb-core/tests/search_syntax_regression.rs`
- Test: `src/src/__tests__/search-page-syntax.test.tsx`

- [ ] **Step 1: 增加 path/tag/property/link/backlink 过滤语法**
- [ ] **Step 2: 区分“找 note”与“问 KB”两种意图**
- [ ] **Step 3: 搜索结果显示命中位置、属性、链接上下文**
- [ ] **Step 4: 支持 saved search / recent search**
- [ ] **Step 5: 运行搜索语法测试**
- [ ] **Step 6: Commit**

**验收标准：**
- 搜索不再只是问答的前置步骤
- 用户可以像 Obsidian 一样用结构化条件找 note

### Task 9: 重新梳理信息架构，收敛“炫技页”

**Files:**
- Modify: `src/src/components/layout.tsx`
- Modify: `src/src/components/shell/workbench-shell.tsx`
- Modify: `src/src/components/shell/knowledge-space-shell.tsx`
- Modify: `src/src/components/pages/dashboard.tsx`
- Modify: `src/src/components/pages/report.tsx`
- Modify: `src/src/components/pages/podcast.tsx`
- Test: `src/src/__tests__/layout-shell.test.tsx`

- [ ] **Step 1: 将默认主入口切换为 Notes / Search / Daily / Graph**
- [ ] **Step 2: 将 Report / Podcast / Mindmap 下沉为 note actions 或 lab tools**
- [ ] **Step 3: 弱化 legacy dashboard**
- [ ] **Step 4: 让文档工作台围绕当前 note context 工作**
- [ ] **Step 5: 运行布局回归测试**
- [ ] **Step 6: Commit**

**验收标准：**
- 首屏一眼看出这是笔记产品，不是 AI 工具箱
- 高频功能更聚焦，低频炫技能力不打断主线

### Task 10: 建立插件/自动化预备层（长期战略）

**Files:**
- Create: `docs/plugin-api-draft.md`
- Create: `crates/clawkb-core/src/command_bus.rs`
- Create: `src/src/api/plugin.ts`
- Modify: `src-tauri/src/commands/mod.rs`
- Test: `src/src/__tests__/command-registry.test.ts`

- [ ] **Step 1: 抽象命令注册与执行协议**
- [ ] **Step 2: 定义只读插件 API 草案（note/query/command）**
- [ ] **Step 3: 预留 URI / automation 入口**
- [ ] **Step 4: 先不开放第三方执行，只完成架构预埋**
- [ ] **Step 5: 运行命令注册测试**
- [ ] **Step 6: Commit**

**验收标准：**
- 插件系统不是立刻上线，而是避免未来被当前架构卡死
- 内置命令与未来扩展命令使用统一协议

---

## 8. 优先级排序（必须按序推进）

### P0：没有这些，就不能说在对标 Obsidian

1. Note domain model
2. Markdown editor + wiki links
3. Backlinks + local graph
4. File tree / vault semantics
5. Properties / frontmatter

### P1：补齐高频日常工作流

1. Daily notes
2. Templates
3. Command palette
4. Workspace layouts
5. Search syntax for note retrieval

### P2：改善产品完成度

1. 默认信息架构收敛
2. 标签页 / 最近文档 / 打开历史
3. 批量操作与重构工具（rename/move/update links）
4. 导入体验统一（包括 Obsidian Vault 二次同步）

### P3：长期平台层

1. 插件 API 草案
2. URI / automation
3. canvas/open format strategy
4. external integrations

---

## 9. 建议放弃或延后的事项

为了确保路线清晰，以下事项不建议在 P0/P1 阶段投入过多精力：

- 不要继续扩展新的“展示型页面”
- 不要优先做 Publish / 分享 / 协作能力
- 不要先做完整主题市场
- 不要把插件系统放在 Markdown/Vault 基础设施之前
- 不要让 Report / Podcast / Mindmap 继续占据主导航中心位置

---

## 10. 里程碑定义

### Milestone A：像一个真正的笔记产品

满足条件：

- 可以创建/编辑/移动/重命名 Markdown note
- 支持 wiki links 与 backlinks
- 有可用的文件树与属性面板
- 搜索可以找 note，而不仅是问答

### Milestone B：具备 Obsidian 日常替代能力

满足条件：

- Daily notes / templates / local graph / workspace / command palette 可用
- 主工作流已不依赖导入页与 dashboard
- 用户可以连续几周仅使用 ClawKB 记笔记与整理知识

### Milestone C：形成 ClawKB 差异化优势

满足条件：

- 每篇 note 可直接进入 AI 工作流
- timeline / entity / OCR / 多模态导入 与 note workflow 深度融合
- ClawKB 在“AI native local knowledge workbench”层面超越 Obsidian 默认体验

---

## 11. 风险与应对

### 风险 1：`.mv2` 与 Markdown-first 路线冲突

**风险：** 若仍坚持所有能力围绕 `.mv2` 封闭对象运转，会持续削弱对标 Obsidian 的可信度。

**应对：**

- 保留 `.mv2` 作为索引/检索/压缩层
- 但在产品层引入 note/vault/path/frontmatter 一等抽象
- 长期可考虑“Markdown source + `.mv2` index cache”双层模式

### 风险 2：功能页太多，主线不清晰

**风险：** 用户会把产品理解成“功能集合”而不是“笔记系统”。

**应对：**

- 重新设计默认导航
- 将低频 AI 页面收为 contextual actions
- 让 Notes 成为绝对中心

### 风险 3：编辑器改造会牵涉较大前后端联动

**风险：** wiki links、frontmatter、backlinks 改造会同时影响存储、索引、UI。

**应对：**

- 先建 note domain model
- 再逐层接入 editor / search / graph
- 保持每个阶段都可独立回归验证

---

## 12. 推荐执行顺序（两个月版本）

### Sprint 1（第 1-2 周）

- [ ] 完成 note domain model
- [ ] 完成基础 note CRUD API
- [ ] 完成文件树与 note list UI 原型
- [ ] 完成最小 Markdown note editor

### Sprint 2（第 3-4 周）

- [ ] 完成 wiki links 与 backlinks
- [ ] 完成 note-local graph
- [ ] 完成 properties/frontmatter UI
- [ ] 完成按属性/路径/标签搜索

### Sprint 3（第 5-6 周）

- [ ] 完成 daily notes 与 templates
- [ ] 完成 command palette
- [ ] 完成 workspace layout save/load
- [ ] 完成主导航与信息架构重构

### Sprint 4（第 7-8 周）

- [ ] 把 AI 问答、报告、播客、时间线改造为 note-context actions
- [ ] 打通 note → ask → draft → report 的闭环
- [ ] 补齐回归测试、发布检查与迁移文档

---

## 13. 最终判断

**结论非常明确：**

ClawKB 当前距离 Obsidian 的差距，不在“有没有图谱、导入、AI、标签这些页面”，而在于**有没有把“Markdown note + link + file tree + properties + daily workflow”做成第一主线。**

所以正确路线不是继续横向加功能，而是：

1. 把 note 提升为一等对象
2. 把 Markdown/Vault/链接写作做成主工作流
3. 把反链、图谱、模板、日记、工作区补齐
4. 再把已有 AI 能力全部回流到 note 工作流中

做到这一步后，ClawKB 不只是“像 Obsidian”，而是会成为：

**比 Obsidian 更 AI-native、但仍然保有本地优先与知识管理严肃性的个人知识工作台。**
