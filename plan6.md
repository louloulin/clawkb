# ClawKB Obsidian Parity Deep Audit & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于对 ClawKB 全仓库代码、测试、命令桥、数据模型和 UI 工作流的深入审计，明确其对标 Obsidian 的真实差距，并形成一份可直接执行、优先级清晰、覆盖架构与产品层的完整开发计划。

**Architecture:** 继续保留现有 Rust `clawkb-core` + `src-tauri` + React/Tauri 前端三层架构，不做推倒重来。核心策略是把当前“AI 本地知识工作台”逐步改造成“Markdown/Vault-first 的本地知识系统”，先围绕 `note/link/property/workspace` 建立新的领域中心，再把已有 AI、时间线、实体、多模态能力回流到这个中心。

**Tech Stack:** Rust workspace (`clawkb-core`, `clawkb-cli`, `src-tauri`) + memvid-core + Tauri 2 + React 19 + TypeScript + Zustand + TipTap + shadcn/ui + d3-force + Vitest + Cargo test

---

## 0. 分析方法与证据来源

### 0.1 本次审计范围

本次分析覆盖：

- Rust workspace：`crates/clawkb-core`, `crates/clawkb-cli`, `src-tauri`
- 前端应用：`src/src/api`, `src/src/store`, `src/src/components`, `src/src/__tests__`
- 产品文档：`docs/product-positioning.md`, `docs/runtime-modes.md`, `docs/local-state-model.md`, `docs/recovery-and-backup.md`, `docs/ui-baseline/verification.md`
- 历史演进线索：最近 20 次提交记录
- 当前计划文档：`plan1.md` ~ `plan5.md`

### 0.2 已验证事实

本次结论不是拍脑袋判断，而是建立在实际代码与测试结果上：

- `cargo test -q` 通过，Rust 侧 24 个测试通过
- `cd src && npm run test -- --run` 通过，前端 16 个测试文件 / 40 个测试通过
- 当前仓库不是 demo，而是具有真实桌面命令桥、真实本地状态、真实导入/问答/同步链路的产品原型
- 但当前架构中心依然不是 `note` / `vault` / `link` / `property`

### 0.3 Obsidian 对标基线

本计划以 Obsidian 官方帮助文档中的核心工作流为主，不以第三方插件生态总量为短期目标：

- Internal links: <https://help.obsidian.md/Linking%20notes%20and%20files/Internal%20links>
- Backlinks: <https://help.obsidian.md/plugins/backlinks>
- Graph view: <https://help.obsidian.md/plugins/graph>
- Properties: <https://help.obsidian.md/properties>
- Properties view: <https://help.obsidian.md/plugins/properties>
- Canvas: <https://help.obsidian.md/plugins/canvas>
- Daily notes: <https://help.obsidian.md/plugins/daily-notes>
- Templates: <https://help.obsidian.md/Plugins/Templates>
- Workspaces: <https://help.obsidian.md/Plugins/Workspaces>
- Community plugins: <https://help.obsidian.md/community-plugins>
- Workspace: <https://help.obsidian.md/workspace>

本次对标关注的是：

1. Markdown note 是否是一等公民
2. 文件树 / Vault / 路径是否是主操作面
3. 双链 / 反链 / 局部图是否顺滑
4. 属性（frontmatter）是否可编辑、可索引、可筛选
5. 日记 / 模板 / 工作区 / 命令面板是否形成高频工作流
6. 系统是否具备未来插件化的结构前提

---

## 1. 仓库现状：现在的 ClawKB 到底是什么

### 1.1 它已经具备的真实能力

从代码与命令桥看，ClawKB 已经具备一个相当完整的“本地 AI 知识工作台”底座：

#### 数据与导入层

- 本地 `.mv2` KB 文件创建、打开、关闭、提交
- 文档与目录导入
- 网页抓取导入
- 图片 OCR 导入
- 音频导入
- Obsidian Vault 扫描与导入
- WebDAV 配置与增量同步

#### 检索与知识处理层

- 关键词检索 / 语义检索 / 混合检索
- 图增强搜索
- AI Ask / Context Ask / Document Ask
- Timeline / as-of / compare 时间检索
- Tag 管理：列出、重命名、合并、删除
- Entity 图谱与 traverse graph
- Folder scoped search

#### UI 工作台层

- Workbench shell / Knowledge Space shell / Document Workspace shell
- 文档阅读、草稿、笔记工作流
- 报告、播客、Mindmap 等 AI 派生页面
- 本地持久化状态恢复
- Browser preview guard 与桌面模式边界

### 1.2 它本质上仍然是“以 KB 操作为中心”的产品

从 `src/src/api/types.ts` 可以看出，前端核心对象仍然是：

- `KbStats`
- `SearchHit`
- `ImportResult`
- `TagInfo`
- `TimelineEntry`
- `EntityInfo`
- `FolderInfo`

而不是：

- `Note`
- `NotePath`
- `Backlink`
- `FrontmatterProperty`
- `WorkspaceLayout`
- `Template`
- `DailyNote`

这决定了产品的中心仍然是：

- 打开 KB
- 搜索 KB
- 问 KB
- 导入到 KB
- 浏览衍生知识页

而不是：

- 打开 Vault
- 在文件树中进入笔记
- 编写 / 链接 / 整理 note
- 借由 note 上下文使用 AI

### 1.3 当前前端主线不是 Obsidian 式主线

`src/src/components/layout.tsx` 的主导航目前是：

- `问答`
- `个人知识库`
- `笔记`
- `设置`

其中“笔记”并不是一个 Markdown-first 笔记系统入口，而是文档工作台的壳层。大量高价值能力分散在：

- `search.tsx`
- `notes.tsx`
- `timeline.tsx`
- `tags.tsx`
- `graph.tsx`
- `entities.tsx`
- `report.tsx`
- `podcast.tsx`

这说明它更接近一个“多功能工作台”，而不是 Obsidian 那种以 note 文件为中心的持续型知识系统。

---

## 2. 代码级深审结论

## 2.1 Rust 内核的优势与限制

### 优势

`crates/clawkb-core/src/kb.rs` 很大，说明很多核心能力已经沉淀到统一数据内核里，优点是：

- 能力集中，命令桥复用方便
- 搜索 / 时间线 / 标签 / 文件夹 / 同步等能力都已经真实存在
- 测试基础不算差，`core_regression.rs` 已覆盖 note、folder、tag 基本回归

### 限制

但 `kb.rs` 过大也暴露问题：

- `KnowledgeBase` 是事实上的 God Object
- note、folder、tag、timeline、search、replay、export 等边界耦合在一起
- 未来若要引入 Markdown-first note domain、backlinks、properties schema，会继续加重这个 God Object
- 目前 `note.rs`、`search.rs`、`tag.rs` 等模块过薄，领域边界不清晰

**结论：** ClawKB 不是缺能力，而是“领域中心尚未分化”。

## 2.2 Tauri 命令桥很丰富，但偏操作型 API

`src-tauri/src/commands/mod.rs` 暴露了大量命令：

- KB 打开/创建/统计
- 搜索 / Ask / Context Ask / Compare / Timeline
- 文件夹操作
- Obsidian 导入
- OCR / WebDAV / Selection AI
- 多 KB 与注册表流

问题在于这些命令大多是：

- action-style
- document retrieval-style
- ingestion-style

缺少围绕“持续编辑 note”的命令族：

- `get_note`
- `save_note`
- `rename_note`
- `move_note`
- `list_backlinks`
- `update_properties`
- `create_daily_note`
- `apply_template`
- `save_workspace_layout`

**结论：** 命令桥很强，但不服务于 Obsidian 式持续写作主线。

## 2.3 前端 store 拆分不少，但不是 note-centric 状态模型

当前 store 有：

- `kb-store.ts`
- `document-workspace-store.ts`
- `folder-store.ts`
- `graph-store.ts`
- `chat-store.ts`
- `report-store.ts`
- `workspace-store.ts`
- `multi-kb-store.ts`
- `sync-store.ts`

这是积极信号：说明状态已经开始模块化。

但问题是：

- 缺少 `note-store`
- 缺少 `properties-store`
- 缺少 `workspace-layout-store`
- 缺少 `command-store`
- 文档工作台的 `draftTitle / draftContent` 仍然是“草稿工作区状态”，不是 note source of truth

**结论：** 当前状态模型更像应用状态，而不是知识对象状态。

## 2.4 编辑器是 AI 草稿编辑器，不是 Markdown note editor

`src/src/components/pages/editor.tsx` 明显说明了这一点：

- 以 TipTap HTML 内容为中心
- 以 AI suggestion / slash command / workspace draft 为中心
- 保存动作是 `api.addNote(title, body, tags)`
- 保存后仍然是“新增一条知识内容”，而不是“编辑某篇 note 文件”

缺失点：

- Markdown 源码模式
- `[[wikilink]]` 补全
- heading/block anchor
- frontmatter editing
- note rename/move
- internal link refactor
- backlinks context pane

**结论：** 当前编辑器更像“AI 写作工位”，不是 Obsidian editor。

## 2.5 Graph 有实现，但不是 Obsidian 的 note graph

`src/src/components/pages/graph.tsx` 已经做了力导向图，而且 UI 复杂度不低。问题不在“有没有图”，而在“图的实体是什么”：

- 现在主要是 `EntityInfo` / `RelationEdge`
- 这是语义实体网络，不是 note-to-note graph
- 它对 AI / 语义分析很有价值，但不能替代 backlinks/local graph

**结论：** Graph 方向对，但建模中心错了。

## 2.6 Folder tree 存在，但还不是 Vault file tree

`src/src/components/folder-tree.tsx` 已经支持：

- 层级文件夹展示
- 选择 folder
- 子文件夹创建
- folder scoped search
- drag & drop document move

这很重要，说明基础设施不是零。

但这不是 Obsidian 的文件树，因为：

- tree node 主要是 folder metadata
- 不是路径驱动的 note 文件层级
- note 不天然挂在 path 上被浏览与编辑
- rename / move / path conflict / link repair 尚未成为一等流程

**结论：** 已经有树，但不是 Vault tree。

## 2.7 测试覆盖代表系统“可演进”，但断言重心偏 UI 壳层

前端测试覆盖了：

- runtime guard
- layout shell
- workbench shell
- import page
- settings page
- kb detail pane
- document tabs / workspace shell

这些对产品稳定性有价值。

但对 Obsidian 对标最关键的部分，目前几乎没有测试：

- note CRUD 生命周期
- markdown link parsing
- backlinks consistency
- property editing
- file tree path behavior
- local graph generation
- daily notes / templates / command palette

**结论：** 验证纪律在，但还没覆盖未来的核心改造主线。

---

## 3. 对标 Obsidian 的差距清单（完整版）

以下按“关键度 + 现状 + 改造难度”综合排序。

### 3.1 P0 差距：不补这些，不能说在对标 Obsidian

#### Gap P0-1：没有 Markdown-first Note Domain

**现状：**
- `SearchHit` 是 UI 主对象
- note 更像搜索命中或新增内容，而不是持久化笔记对象

**影响：**
- 无法构建真正的 note 编辑、重命名、移动、链接修复、属性编辑

**复杂度：** 高

#### Gap P0-2：没有 Wiki Links / Backlinks 主链路

**现状：**
- 现有图谱偏实体图
- 未见 `[[note]]`、`[[note#heading]]`、`[[note|alias]]` 支持

**影响：**
- 失去 Obsidian 最核心的知识连接工作流

**复杂度：** 高

#### Gap P0-3：没有以 note path 为中心的 Vault / File Tree

**现状：**
- 有 folder system，但不是 note tree

**影响：**
- 用户无法形成文件组织心智

**复杂度：** 高

#### Gap P0-4：没有通用 Properties / Frontmatter 系统

**现状：**
- frontmatter 只在 Obsidian 导入里解析
- UI 没有属性面板

**影响：**
- 无法建立结构化知识和筛选流

**复杂度：** 中高

#### Gap P0-5：编辑器不是 Obsidian 式编辑器

**现状：**
- 偏 AI draft editor

**影响：**
- 无法成为日常主笔记工具

**复杂度：** 中高

### 3.2 P1 差距：补齐后才能形成可持续日常使用

#### Gap P1-1：没有 Daily Notes
#### Gap P1-2：没有 Templates（note templates）
#### Gap P1-3：没有 Command Palette
#### Gap P1-4：没有 Workspace Layout 保存/恢复模型
#### Gap P1-5：搜索仍偏“问答式”，缺少 note retrieval syntax
#### Gap P1-6：没有最近打开 / 快速切换 / note history 主流能力

### 3.3 P2 差距：会影响迁移和规模化使用

#### Gap P2-1：`.mv2` 与 Markdown source 的关系不清晰
#### Gap P2-2：Canvas 缺失
#### Gap P2-3：插件 API / 命令注册机制缺失
#### Gap P2-4：批量重构能力缺失（rename path + repair links）
#### Gap P2-5：导入后无法平滑过渡到持续维护型 note system

### 3.4 P3 差距：长期生态与平台层

#### Gap P3-1：社区插件体系
#### Gap P3-2：URI / automation / external hooks
#### Gap P3-3：主题/扩展生态
#### Gap P3-4：多端同步与移动端成熟度

---

## 4. 不只是“缺功能”，而是存在结构性错位

### 4.1 核心错位一：当前产品入口仍是“问答/知识库/工作台”

Obsidian 的入口是：

- 文件树
- 当前 note
- 局部知识上下文

ClawKB 当前入口更像：

- 问答
- 空间管理
- 文档工作台

这会让用户更像在“调用系统能力”，而不是“居住在笔记系统中”。

### 4.2 核心错位二：AI 能力是主角，note 是配角

Obsidian 中 AI 往往是辅助层；而在 ClawKB 中，AI 和衍生工具页经常成为显性主线。

这本身不是错误，但如果目标是对标 Obsidian，必须先做到：

- note 是主角
- AI 是 contextual copilot

### 4.3 核心错位三：导入与搜索很强，但持续编辑很弱

ClawKB 擅长“把外部资料放进来并处理”，不擅长“长期维护自己的一套 note 网络”。

而 Obsidian 的强项恰恰在后者。

---

## 5. 产品策略：如何既对标 Obsidian，又不丢掉 ClawKB 优势

### 5.1 应追平的 Obsidian 核心

必须追平：

1. note / vault / path
2. markdown editor
3. wikilinks / backlinks / local graph
4. frontmatter / properties
5. templates / daily notes
6. workspace / command palette

### 5.2 不必短期追平的项目

暂缓：

1. 大型社区插件生态
2. 发布站点 / publish
3. 主题市场
4. 完整移动端体验
5. 深度第三方兼容

### 5.3 应保留并强化的 ClawKB 特长

1. AI ask 与 context retrieval
2. 时间语义（timeline / as-of / compare）
3. OCR / 音频 / 网页 / 多模态导入
4. entity graph
5. 本地优先与简洁定位

目标不是变成 Obsidian 克隆，而是：

**成为一个 Obsidian 级知识管理底座 + ClawKB 级 AI 原生能力 的本地桌面系统。**

---

## 6. 目标状态架构

## 6.1 新的领域中心

未来系统的一等对象应该变成：

- `NoteRecord`
- `NotePath`
- `Frontmatter`
- `PropertyValue`
- `OutgoingLink`
- `Backlink`
- `WorkspaceLayout`
- `TemplateDefinition`
- `DailyNoteRule`
- `CommandDefinition`

而现有对象要退居到辅助层：

- `SearchHit` -> note retrieval view model
- `EntityInfo` -> semantic overlay model
- `TimelineEntry` -> temporal overlay model
- `ImportResult` -> ingestion result model

## 6.2 推荐代码结构调整

### Rust core

**Create:**
- `crates/clawkb-core/src/markdown_note.rs`
- `crates/clawkb-core/src/frontmatter.rs`
- `crates/clawkb-core/src/link_index.rs`
- `crates/clawkb-core/src/backlinks.rs`
- `crates/clawkb-core/src/note_tree.rs`
- `crates/clawkb-core/src/templates.rs`
- `crates/clawkb-core/src/daily_notes.rs`
- `crates/clawkb-core/src/workspace.rs`
- `crates/clawkb-core/src/command_bus.rs`

**Modify:**
- `crates/clawkb-core/src/kb.rs`
- `crates/clawkb-core/src/search.rs`
- `crates/clawkb-core/src/export.rs`
- `crates/clawkb-core/src/sync/obsidian.rs`
- `crates/clawkb-core/src/lib.rs`

### Tauri bridge

**Modify:**
- `src-tauri/src/commands/mod.rs`

**Add commands:**
- `list_notes`
- `get_note`
- `save_note`
- `rename_note`
- `move_note`
- `delete_note`
- `list_backlinks`
- `list_outgoing_links`
- `get_note_graph`
- `list_properties`
- `update_properties`
- `create_daily_note`
- `list_templates`
- `apply_template`
- `list_commands`
- `run_command`
- `save_workspace_layout`
- `load_workspace_layout`

### Frontend

**Create:**
- `src/src/store/note-store.ts`
- `src/src/store/properties-store.ts`
- `src/src/store/command-store.ts`
- `src/src/store/workspace-layout-store.ts`
- `src/src/components/notes/note-editor.tsx`
- `src/src/components/notes/note-file-tree.tsx`
- `src/src/components/notes/note-properties-pane.tsx`
- `src/src/components/notes/backlinks-pane.tsx`
- `src/src/components/notes/local-graph-pane.tsx`
- `src/src/components/notes/template-picker.tsx`
- `src/src/components/notes/daily-note-entry.tsx`
- `src/src/components/command/command-palette.tsx`

**Modify:**
- `src/src/api/types.ts`
- `src/src/api/commands.ts`
- `src/src/components/layout.tsx`
- `src/src/components/pages/notes.tsx`
- `src/src/components/pages/editor.tsx`
- `src/src/components/pages/reader.tsx`
- `src/src/components/pages/search.tsx`
- `src/src/components/pages/graph.tsx`
- `src/src/components/shell/document-workspace-shell.tsx`
- `src/src/components/shell/workbench-shell.tsx`

---

## 7. 分阶段任务计划（可直接执行）

### Task 1: 拆出 Note Domain，停止让 `SearchHit` 承担笔记本体职责

**Files:**
- Create: `crates/clawkb-core/src/markdown_note.rs`
- Create: `crates/clawkb-core/src/frontmatter.rs`
- Modify: `crates/clawkb-core/src/kb.rs`
- Modify: `crates/clawkb-core/src/lib.rs`
- Test: `crates/clawkb-core/tests/note_domain_regression.rs`

- [ ] **Step 1: Write the failing test**
定义 note CRUD、note path 唯一性、frontmatter round-trip 的回归用例。

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test -q note_domain_regression`
Expected: FAIL with missing note domain types / APIs.

- [ ] **Step 3: Write minimal implementation**
新增 `NoteRecord` / `NotePath` / `Frontmatter` 结构与最小 CRUD API。

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test -q note_domain_regression`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add crates/clawkb-core/src/markdown_note.rs crates/clawkb-core/src/frontmatter.rs crates/clawkb-core/src/kb.rs crates/clawkb-core/src/lib.rs crates/clawkb-core/tests/note_domain_regression.rs
git commit -m "feat: add note domain model"
```

### Task 2: 让 Vault / File Tree 成为主导航面

**Files:**
- Create: `src/src/store/note-store.ts`
- Create: `src/src/components/notes/note-file-tree.tsx`
- Modify: `src/src/components/layout.tsx`
- Modify: `src/src/components/pages/notes.tsx`
- Modify: `src-tauri/src/commands/mod.rs`
- Test: `src/src/__tests__/note-file-tree.test.tsx`

- [ ] **Step 1: Write the failing test**
断言笔记树能展示层级 note/path、点击进入 note、支持新建/重命名入口。

- [ ] **Step 2: Run test to verify it fails**
Run: `cd src && npm run test -- --run note-file-tree.test.tsx`
Expected: FAIL with missing note tree component/store.

- [ ] **Step 3: Write minimal implementation**
实现 note tree 视图与 `list_notes` bridge。

- [ ] **Step 4: Run test to verify it passes**
Run: `cd src && npm run test -- --run note-file-tree.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/src/store/note-store.ts src/src/components/notes/note-file-tree.tsx src/src/components/layout.tsx src/src/components/pages/notes.tsx src-tauri/src/commands/mod.rs src/src/__tests__/note-file-tree.test.tsx
git commit -m "feat: add note file tree workflow"
```

### Task 3: 把 Editor 重构为 Markdown Note Editor

**Files:**
- Create: `src/src/components/notes/note-editor.tsx`
- Modify: `src/src/components/pages/editor.tsx`
- Modify: `src/src/components/pages/reader.tsx`
- Modify: `src/src/store/document-workspace-store.ts`
- Test: `src/src/__tests__/note-editor.test.tsx`

- [ ] **Step 1: Write the failing test**
覆盖 note title/content 保存、source/preview 切换、dirty state 提示。

- [ ] **Step 2: Run test to verify it fails**
Run: `cd src && npm run test -- --run note-editor.test.tsx`
Expected: FAIL with missing note-centric editor behavior.

- [ ] **Step 3: Write minimal implementation**
把现有 AI draft editor 中的 AI 能力下沉为辅助面板，编辑核心改成 note persistence。

- [ ] **Step 4: Run test to verify it passes**
Run: `cd src && npm run test -- --run note-editor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/src/components/notes/note-editor.tsx src/src/components/pages/editor.tsx src/src/components/pages/reader.tsx src/src/store/document-workspace-store.ts src/src/__tests__/note-editor.test.tsx
git commit -m "feat: convert editor into note editor"
```

### Task 4: 实现 Wikilinks / Backlinks / Local Graph

**Files:**
- Create: `crates/clawkb-core/src/link_index.rs`
- Create: `crates/clawkb-core/src/backlinks.rs`
- Create: `src/src/components/notes/backlinks-pane.tsx`
- Create: `src/src/components/notes/local-graph-pane.tsx`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src/src/api/commands.ts`
- Test: `crates/clawkb-core/tests/wikilinks_regression.rs`
- Test: `src/src/__tests__/backlinks-pane.test.tsx`

- [ ] **Step 1: Write the failing test**
Rust 断言 link parse/backlinks/local graph；前端断言 backlinks pane 渲染。

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test -q wikilinks_regression && cd src && npm run test -- --run backlinks-pane.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**
支持 `[[note]]`, `[[note#heading]]`, `[[note|alias]]` 的最小实现与 UI 接入。

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test -q wikilinks_regression && cd src && npm run test -- --run backlinks-pane.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add crates/clawkb-core/src/link_index.rs crates/clawkb-core/src/backlinks.rs src/src/components/notes/backlinks-pane.tsx src/src/components/notes/local-graph-pane.tsx src-tauri/src/commands/mod.rs src/src/api/commands.ts crates/clawkb-core/tests/wikilinks_regression.rs src/src/__tests__/backlinks-pane.test.tsx
git commit -m "feat: add wikilinks and backlinks"
```

### Task 5: 建立 Properties / Frontmatter 系统

**Files:**
- Create: `src/src/store/properties-store.ts`
- Create: `src/src/components/notes/note-properties-pane.tsx`
- Modify: `crates/clawkb-core/src/frontmatter.rs`
- Modify: `src/src/api/types.ts`
- Modify: `src/src/api/commands.ts`
- Test: `crates/clawkb-core/tests/frontmatter_regression.rs`
- Test: `src/src/__tests__/note-properties-pane.test.tsx`

- [ ] **Step 1: Write the failing test**
断言 properties round-trip、日期/list/tags 序列化、前端编辑行为。

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test -q frontmatter_regression && cd src && npm run test -- --run note-properties-pane.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**
实现通用 property schema 与 UI 编辑器。

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test -q frontmatter_regression && cd src && npm run test -- --run note-properties-pane.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/src/store/properties-store.ts src/src/components/notes/note-properties-pane.tsx crates/clawkb-core/src/frontmatter.rs src/src/api/types.ts src/src/api/commands.ts crates/clawkb-core/tests/frontmatter_regression.rs src/src/__tests__/note-properties-pane.test.tsx
git commit -m "feat: add note properties system"
```

### Task 6: 搜索从 KB Ask 模式升级为 Note Retrieval 模式

**Files:**
- Modify: `crates/clawkb-core/src/search.rs`
- Modify: `src/src/components/pages/search.tsx`
- Modify: `src/src/api/types.ts`
- Test: `crates/clawkb-core/tests/search_syntax_regression.rs`
- Test: `src/src/__tests__/search-page-syntax.test.tsx`

- [ ] **Step 1: Write the failing test**
覆盖 `tag:`, `path:`, `property:`, `link:` 等检索语法。

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test -q search_syntax_regression && cd src && npm run test -- --run search-page-syntax.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**
加入 note retrieval filters 与结果展示增强。

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test -q search_syntax_regression && cd src && npm run test -- --run search-page-syntax.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add crates/clawkb-core/src/search.rs src/src/components/pages/search.tsx src/src/api/types.ts crates/clawkb-core/tests/search_syntax_regression.rs src/src/__tests__/search-page-syntax.test.tsx
git commit -m "feat: add note retrieval syntax"
```

### Task 7: 实现 Daily Notes 与 Templates

**Files:**
- Create: `crates/clawkb-core/src/daily_notes.rs`
- Create: `crates/clawkb-core/src/templates.rs`
- Create: `src/src/components/notes/daily-note-entry.tsx`
- Create: `src/src/components/notes/template-picker.tsx`
- Test: `crates/clawkb-core/tests/daily_notes_regression.rs`
- Test: `src/src/__tests__/daily-note-entry.test.tsx`

- [ ] **Step 1: Write the failing test**
覆盖今日日记创建、模板变量替换、模板新建 note。

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test -q daily_notes_regression && cd src && npm run test -- --run daily-note-entry.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**
增加模板目录、每日 note 规则与 UI 入口。

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test -q daily_notes_regression && cd src && npm run test -- --run daily-note-entry.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add crates/clawkb-core/src/daily_notes.rs crates/clawkb-core/src/templates.rs src/src/components/notes/daily-note-entry.tsx src/src/components/notes/template-picker.tsx crates/clawkb-core/tests/daily_notes_regression.rs src/src/__tests__/daily-note-entry.test.tsx
git commit -m "feat: add daily notes and templates"
```

### Task 8: 实现 Command Palette 与 Workspace Layout

**Files:**
- Create: `src/src/store/command-store.ts`
- Create: `src/src/store/workspace-layout-store.ts`
- Create: `src/src/components/command/command-palette.tsx`
- Create: `crates/clawkb-core/src/workspace.rs`
- Modify: `src/src/components/layout.tsx`
- Test: `src/src/__tests__/command-palette.test.tsx`
- Test: `src/src/__tests__/workspace-layout-store.test.ts`

- [ ] **Step 1: Write the failing test**
覆盖 `Cmd/Ctrl+P` 打开命令面板、执行命令、保存布局。

- [ ] **Step 2: Run test to verify it fails**
Run: `cd src && npm run test -- --run command-palette.test.tsx workspace-layout-store.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**
建立内置命令模型与布局存档。

- [ ] **Step 4: Run test to verify it passes**
Run: `cd src && npm run test -- --run command-palette.test.tsx workspace-layout-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/src/store/command-store.ts src/src/store/workspace-layout-store.ts src/src/components/command/command-palette.tsx crates/clawkb-core/src/workspace.rs src/src/components/layout.tsx src/src/__tests__/command-palette.test.tsx src/src/__tests__/workspace-layout-store.test.ts
git commit -m "feat: add command palette and workspaces"
```

### Task 9: 重构信息架构，让“笔记系统”成为一眼可见的主产品

**Files:**
- Modify: `src/src/components/layout.tsx`
- Modify: `src/src/components/shell/workbench-shell.tsx`
- Modify: `src/src/components/shell/knowledge-space-shell.tsx`
- Modify: `src/src/components/shell/document-workspace-shell.tsx`
- Modify: `src/src/components/pages/dashboard.tsx`
- Test: `src/src/__tests__/layout-shell.test.tsx`

- [ ] **Step 1: Write the failing test**
断言主导航默认强调 Notes / Search / Daily / Graph，而非工具箱化入口。

- [ ] **Step 2: Run test to verify it fails**
Run: `cd src && npm run test -- --run layout-shell.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**
收敛导航，弱化 legacy dashboard，重新组织 AI 派生工具。

- [ ] **Step 4: Run test to verify it passes**
Run: `cd src && npm run test -- --run layout-shell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/src/components/layout.tsx src/src/components/shell/workbench-shell.tsx src/src/components/shell/knowledge-space-shell.tsx src/src/components/shell/document-workspace-shell.tsx src/src/components/pages/dashboard.tsx src/src/__tests__/layout-shell.test.tsx
git commit -m "feat: refocus app navigation around notes"
```

### Task 10: 预埋插件化与自动化架构

**Files:**
- Create: `docs/plugin-api-draft.md`
- Create: `crates/clawkb-core/src/command_bus.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src/src/api/index.ts`
- Test: `src/src/__tests__/command-registry.test.ts`

- [ ] **Step 1: Write the failing test**
定义命令注册与执行协议的最小约束。

- [ ] **Step 2: Run test to verify it fails**
Run: `cd src && npm run test -- --run command-registry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**
抽象 command registry，写插件 API 草案文档。

- [ ] **Step 4: Run test to verify it passes**
Run: `cd src && npm run test -- --run command-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add docs/plugin-api-draft.md crates/clawkb-core/src/command_bus.rs src-tauri/src/commands/mod.rs src/src/api/index.ts src/src/__tests__/command-registry.test.ts
git commit -m "chore: prepare command registry for plugins"
```

---

## 8. 里程碑定义

### Milestone 1：从“AI 工具台”升级为“笔记系统原型”

完成后应满足：

- 存在一等 `NoteRecord`
- 存在 note file tree
- 存在可保存的 note editor
- 搜索结果与 note 模型打通

### Milestone 2：达到 Obsidian 核心工作流基线

完成后应满足：

- wiki links / backlinks / local graph 可用
- properties / frontmatter 可编辑
- daily notes / templates 可用
- command palette / workspace 可用

### Milestone 3：形成 ClawKB 自己的优势形态

完成后应满足：

- AI ask 以当前 note / selection / folder / timeline 为上下文
- entity graph 与 note graph 共存
- OCR / import / timeline / report 都围绕 note workflow 回流

---

## 9. 执行顺序建议

### 第一阶段（2 周）

- [ ] Task 1 Note domain
- [ ] Task 2 Note file tree
- [ ] Task 3 Note editor

### 第二阶段（2 周）

- [ ] Task 4 Wikilinks / backlinks / local graph
- [ ] Task 5 Properties / frontmatter
- [ ] Task 6 Search syntax

### 第三阶段（2 周）

- [ ] Task 7 Daily notes / templates
- [ ] Task 8 Command palette / workspace
- [ ] Task 9 Information architecture

### 第四阶段（1-2 周）

- [ ] Task 10 Plugin/automation prep
- [ ] 把 AI、timeline、entity、report、podcast 重新接到 note context
- [ ] 增补端到端回归与迁移文档

---

## 10. 最终判断

经过对整个代码库的充分分析，可以明确下结论：

### 10.1 ClawKB 的短板不是“功能不够多”

它已经有很多 Obsidian 默认没有的东西：

- 内建 AI
- 时间语义检索
- 多模态导入
- 实体关系图
- WebDAV 同步

### 10.2 真正的问题是“知识管理主轴尚未确立”

也就是：

- note 不是一等对象
- 链接不是一等关系
- path/vault 不是一等组织方式
- property 不是一等结构化层
- workspace/command 不是一等交互系统

### 10.3 对标 Obsidian 的正确方法

不是继续添加更多 AI 工具页，而是：

1. 先把 Obsidian 的知识管理底座补齐
2. 再让现有 AI 能力成为 note workflow 的增益层
3. 最后再考虑插件化和长期生态

如果沿着这条路线推进，ClawKB 的目标不该只是“像 Obsidian”，而应该是：

**成为一个具备 Obsidian 级知识组织能力、同时原生内建 AI 和时间语义能力的本地优先个人知识系统。**
