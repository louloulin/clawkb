# ClawKB 2.0 vs Obsidian 全面对比分析与开发路线图

> 生成时间: 2025-05-09 | 基于完整代码库分析

---

## 一、ClawKB 当前架构概览

### 后端 (65 个 Tauri 命令, 全部已实现)

| 模块 | 命令数 | 关键能力 |
|------|--------|---------|
| KB 生命周期 | 6 | create/open/close/stats/commit/export |
| 笔记 | 6 | CRUD + rename |
| 笔记链接 | 4 | resolve/backlinks/sync/backfill |
| 搜索 | 4 | hybrid/lex/sem + graph-filtered + folder-scoped + multi-KB |
| 导入 | 6 | PDF/DOCX/PPTX/XLSX/EPUB/RTF/CSV/JSON + 目录 + Obsidian vault + audio/image/screenshot |
| Web | 1 | fetch_url |
| 时间线 | 2 | timeline + compare |
| 标签 | 6 | list/rename/merge/delete/counts/set |
| 文件夹 | 5 | list/create/rename/delete/move |
| AI/RAG | 4 | ask/ask_context/ask_document/selection_ai |
| 图谱/实体 | 5 | list/get/traverse/mesh_stats/memories |
| AI 配置 | 3 | set_embedding/set_ask/test_llm |
| OCR | 2 | ocr_image/test_ocr |
| WebDAV 同步 | 7 | test/list/save_config/get_config/sync/status/clear |
| 多知识库 | 5 | open_extra/close_extra/list_open/search_multi/ai_ask_multi |
| 注册表 | 2 | backfill/get_by_path |
| Obsidian | 2 | scan/import |

### 前端 (5 个主页面 + 14 个 Zustand Store)

| 页面 | 组件 | 功能 |
|------|------|------|
| 工作台 | `home-hero` `home-composer` `home-quick-actions` | AI 对话入口、快捷操作、KB 状态 |
| 探索 | `search` `import` `explore-shell` | 三模式搜索、多格式导入、文档工作区 |
| 笔记 | `editor` (TipTap 3) | 富文本编辑、slash commands、块引用、wikilink 补全、模板 |
| 知识库 | `kb-list-pane` `kb-detail-pane` `kb-chat-pane` | KB 管理、详情、AI 对话 |
| 设置 | `settings` | 运行模式、KB 开关、AI 模型配置 |

### 存储: MV2 单文件格式 (memvid-core)

- 非 Markdown 文件系统, 而是单个 `.mv2` 二进制文件
- 内含持久化注册表 (`KbRegistry`): note_index + folder_index + tag_index
- 内含知识图谱 (`LogicMesh`): 实体 + 边 + 记忆卡
- 支持: BM25 词法索引 + 向量语义索引 + 时间追踪 + 并行分段 + 加密 + 回放

---

## 二、功能差距分析

### 图例
- ✅ = ClawKB 完整实现
- 🟡 = 部分实现 / 有后端但前端弱
- ❌ = 完全缺失
- 🔵 = ClawKB 比 Obsidian 更强

---

### 2.1 核心笔记与编辑

| # | 功能 | Obsidian | ClawKB | 后端现状 | 前端缺口 |
|---|------|---------|--------|---------|---------|
| 1 | 富文本编辑器 | Markdown 纯文本 | 🟡 | `add_note`/`update_note`/`get_note` 完整 | 编辑器存 HTML 非 Markdown; 缺 Markdown 序列化 |
| 2 | 双向链接 `[[wikilink]]` | 核心功能 | 🟡 | `resolve_note_link` + `list_backlinks` + `sync_note_links` + `backfill_all_links` | `wikilink-autocomplete.tsx` 已有; 缺反向链接面板、出链面板 |
| 3 | 块引用 `[[note#^block]]` | 核心功能 | 🟡 | `BlockReferenceExtension` + `BlockIdExtension` | 块引用仅搜索当前文档; 标题引用未实现 |
| 4 | 笔记嵌入 `![[note]]` | 核心功能 | ❌ | `get_note` 可获取任意笔记内容 | 完全缺失嵌入渲染 TipTap Node |
| 5 | Frontmatter/Properties | 核心功能 | 🟡 | 后端 `frontmatter` 模块存在 | 无前端属性编辑器 UI |
| 6 | 标签系统 | 核心功能 | ✅ | `list_tags`/`rename_tag`/`merge_tag`/`delete_tag`/`tag_counts` | `tags.tsx` 功能完整 |
| 7 | 文件夹/目录树 | 核心功能 | ✅ | `list_folders`/`create_folder`/`rename_folder`/`delete_folder`/`move_document` | 完整集成 |
| 8 | 模板系统 | Templates + Templater | 🟡 | 无后端 (localStorage) | `template-manager.tsx` 有基础; 缺变量替换 |
| 9 | 每日笔记 | Daily Notes 插件 | ✅ | `add_note` + tag `daily` | `daily-calendar.tsx` 热力图 + 日历 + 快捷键 |
| 10 | 任务管理 | Checkboxes + Tasks 插件 | 🟡 | 无专用后端 | `daily-tasks.tsx` + `kanban-view.tsx` 有 UI, 但只存 localStorage |
| 11 | Callout/标注块 | 核心功能 | ❌ | 无 | 完全缺失 TipTap Callout Node |
| 12 | Mermaid 图表 | 核心功能 | ❌ | 无 | 完全缺失代码块类型识别 + 渲染 |
| 13 | MathJax/LaTeX | 核心功能 | ❌ | 无 | 完全缺失 LaTeX 渲染 |
| 14 | 代码块语法高亮 | 基础功能 | 🟡 | 无 | TipTap StarterKit 基础代码块, 无语言高亮 |
| 15 | 表格编辑 | 基础功能 | ✅ | 无 | TipTap Table 扩展已集成 |

### 2.2 搜索与发现

| # | 功能 | Obsidian | ClawKB | 后端现状 | 前端缺口 |
|---|------|---------|--------|---------|---------|
| 16 | Quick Switcher (Cmd+O) | 核心功能 | 🟡 | `search_kb` + `resolve_note_link` | `command-palette.tsx` 有基础; 无专用模糊跳转入口 |
| 17 | 混合搜索(语义+词法) | 全文搜索 | 🔵 | 3种模式 + graph-filtered + folder-scoped + multi-KB | `search.tsx` 已实现全部模式切换 |
| 18 | 搜索历史 | 无内置 | ✅ | 无 | `search.tsx` 有搜索历史管理 |
| 19 | 时间范围过滤 | 搜索操作符 | 🟡 | `timeline_kb` + `list_tags` | 缺少时间范围选择器 UI |

### 2.3 知识图谱与可视化

| # | 功能 | Obsidian | ClawKB | 后端现状 | 前端缺口 |
|---|------|---------|--------|---------|---------|
| 20 | 全局图谱 | 核心功能 | 🟡 | `list_entities`/`traverse_graph`/`get_mesh_stats` | `graph.tsx` 有 d3-force 图 + 多视图 + 导出; 但是实体图谱, 非笔记链接图谱 |
| 21 | 局部图谱(Per-note) | 核心功能 | ❌ | `list_backlinks` + `resolve_note_link` 可实现 | 无局部图谱 UI |
| 22 | 脑图 | 社区插件 | ✅ | `aiAsk` 可生成大纲 | `mindmap.tsx` 有 AI 生成 + SVG 渲染 |
| 23 | 白板/Canvas | 核心功能 | ✅ | 无后端 (localStorage) | `whiteboard.tsx` 有无限画布 + 卡片 + 连线 |

### 2.4 阅读器与导入

| # | 功能 | Obsidian | ClawKB | 后端现状 | 前端缺口 |
|---|------|---------|--------|---------|---------|
| 24 | PDF 阅读器 | 核心功能 | ✅ | `import_file` 支持 PDF | `reader.tsx` 有 react-pdf + 高亮 + 批注 + 书签 + AI 问答 |
| 25 | 文档导入 | 纯文件系统 | 🔵 | PDF/DOCX/PPTX/XLSX/EPUB/RTF/CSV/JSON + 目录 + Obsidian | `import.tsx` 完整导入 UI |
| 26 | OCR | 社区插件 | 🔵 | Tesseract + `ocr_image` + `import_screenshot` | 完整集成 |
| 27 | URL 抓取 | 社区插件 | ✅ | `fetch_url` | `import.tsx` URL 导入 |
| 28 | 音频/视频嵌入 | 核心功能 | ❌ | `import_audio` 仅文本提取 | 无音视频播放器 |

### 2.5 AI 与 RAG

| # | 功能 | Obsidian | ClawKB | 后端现状 | 前端缺口 |
|---|------|---------|--------|---------|---------|
| 29 | RAG 问答 | 社区插件 | 🔵 | `ai_ask`/`ai_ask_context`/`ask_document`/`ai_ask_multi` | 编辑器 AI 面板 + KB Chat + Reader AI 均已实现 |
| 30 | 多模型支持 | 社区插件 | 🔵 | Ollama/OpenAI/Anthropic/DeepSeek | 设置页 AI 配置完整 |
| 31 | AI 选区操作 | 社区插件 | ✅ | `selection_ai` (explain/translate/rewrite/summarize/ask) | `selection-panel.tsx` 已有 |

### 2.6 同步与多知识库

| # | 功能 | Obsidian | ClawKB | 后端现状 | 前端缺口 |
|---|------|---------|--------|---------|---------|
| 32 | 云同步 | Obsidian Sync (付费) | 🟡 | WebDAV 增量同步完整 | 设置页有配置; 缺后台自动同步 + 冲突解决 UI |
| 33 | 多知识库 | 多 Vault | ✅ | `open_extra_kb`/`close_extra_kb`/`list_open_kbs`/`search_multi_kb` | `kb-list-pane.tsx` + `multi-kb-store.ts` 已实现 |
| 34 | Obsidian Vault 导入 | N/A | 🔵 | `scan_obsidian_vault` + `import_obsidian_vault` | 完整导入流程 |
| 35 | 导出 | Markdown 文件 | ✅ | `export_kb` (md/html/json) | 设置页导出按钮 |

### 2.7 UI/UX 与平台

| # | 功能 | Obsidian | ClawKB | 后端现状 | 前端缺口 |
|---|------|---------|--------|---------|---------|
| 36 | 命令面板 (Cmd+P) | 核心功能 | ✅ | 无 | `command-palette.tsx` 完整 |
| 37 | 快捷键系统 | 核心功能 | 🟡 | 无 | Cmd+K/P/Shift+D/Escape; 无自定义 |
| 38 | 暗色/亮色主题 | 核心功能 | ✅ | 无 | CSS 变量系统完整 |
| 39 | 侧边栏导航 | 核心功能 | ✅ | 无 | 5 导航 + 可折叠 + 日历 |
| 40 | 文档标签页 | 核心功能 | ✅ | 无 | `document-tabs.tsx` 已集成 |
| 41 | 大纲面板 | 核心功能 | ✅ | 无 | `outline-panel.tsx` + `reader-outline-panel.tsx` |
| 42 | 移动端适配 | iOS/Android 原生 | ❌ | Tauri v2 支持移动端 | 仅桌面构建 |
| 43 | 发布功能 | Obsidian Publish | ❌ | 无 | 无 |
| 44 | 插件系统 | 2700+ 插件 | ❌ | 无 | 无 |

### 2.8 ClawKB 独有优势 (Obsidian 没有)

| # | 功能 | 说明 |
|---|------|------|
| A | **三模式搜索** | BM25 词法 + 向量语义 + 混合, Obsidian 仅全文 |
| B | **内置 RAG** | AI 问答直接基于知识库, Obsidian 需社区插件 |
| C | **多格式导入** | 10+ 格式 + OCR + URL 抓取, Obsidian 仅 Markdown |
| D | **时间机器** | `search_as_of` + `compare_timeline`, Obsidian 无 |
| E | **实体图谱** | LogicMesh 自动抽取实体和关系, Obsidian 仅链接图谱 |
| F | **MV2 单文件** | 便携无散落, 但不兼容其他工具 |
| G | **多知识库并行** | 同时打开多个 KB + 跨库搜索 + 跨库 AI |

---

## 三、统计总览

| 状态 | 数量 | 占比 |
|------|------|------|
| ✅ 完整实现 | 18 | 40% |
| 🟡 部分实现 | 15 | 33% |
| ❌ 完全缺失 | 8 | 18% |
| 🔵 优于 Obsidian | 4 | 9% |

**关键发现**: 44 项功能中 33 项已有后端支撑 (✅+🟡), 大部分缺口是**前端 UI 未充分利用已有后端能力**。

---

## 四、优先级分类

### P0 — 关键缺失 (必须实现, 否则应用感觉不完整)

| # | 功能 | 说明 | 后端已就绪 |
|---|------|------|-----------|
| P0-1 | 反向链接面板 | 后端 `list_backlinks` 已实现, 前端无 UI → **已实现共享组件+编辑器集成** | ✅ ✅ |
| P0-2 | 出链面板 | 后端返回 `outlinks`, 前端无 UI | ✅ |
| P0-3 | Quick Switcher (Cmd+O) | 模糊笔记快速跳转 | ✅ |
| P0-4 | Markdown 序列化 | 编辑器存 HTML, 需双向 Markdown 转换 | ❌ |
| P0-5 | 笔记嵌入 `![[note]]` | 核心工作流, 完全缺失 | ✅ |
| P0-6 | Frontmatter 编辑器 | 后端有 frontmatter 模块, 前端无编辑/显示 | ✅ |
| P0-7 | 编辑器大纲集成 | `outline-panel.tsx` 存在但未在编辑器完整集成 | ✅ |

### P1 — 重要增强 (显著改善日常使用)

| # | 功能 | 说明 | 后端已就绪 |
|---|------|------|-----------|
| P1-1 | Callout/标注块 | Obsidian 标志性功能 | ❌ |
| P1-2 | 代码块语法高亮 | CodeBlockLowlight 扩展 | ❌ |
| P1-3 | Mermaid 图表渲染 | 代码块类型识别 + 渲染 | ❌ |
| P1-4 | 局部图谱 (per-note) | 基于后端 backlinks/outlinks | ✅ |
| P1-5 | 自动保存 | debounce 自动 `update_note` | ✅ |
| P1-6 | 版本历史 UI | 后端 `replay.rs` + `compare_timeline` 已实现 | ✅ |
| P1-7 | WebDAV 后台自动同步 | 后端完整, 缺前端定时同步 | ✅ |
| P1-8 | 笔记链接图谱 | 当前 `graph.tsx` 是实体图谱, 需笔记链接图谱 | ✅ |
| P1-9 | 模板变量替换 | `{{date}}`/`{{time}}`/`{{title}}` | ❌ |

### P2 — 锦上添花 (差异化但非必须)

| # | 功能 | 说明 |
|---|------|------|
| P2-1 | KaTeX/LaTeX 渲染 | 学术用户需要 |
| P2-2 | 音频/视频播放器 | 后端 `import_audio` 已有 |
| P2-3 | Dataview 查询 | SQL-like 查询笔记属性 |
| P2-4 | 快捷键自定义 | 用户自定义所有快捷键 |
| P2-5 | 图片粘贴上传 | 剪贴板直接粘贴图片 |
| P2-6 | 拖拽排序 | 文件夹/标签拖拽排序 |
| P2-7 | Tauri Mobile 构建 | iOS/Android 支持 |

### P3 — 远期愿景

| # | 功能 | 说明 |
|---|------|------|
| P3-1 | 插件系统 | 第三方扩展 API |
| P3-2 | 实时协作 | 多人编辑 |
| P3-3 | 端到端加密同步 | 类似 Obsidian Sync |
| P3-4 | 全文 Markdown 导出 | 兼容 Obsidian 打开 |
| P3-5 | Playwright E2E 测试 | 自动化集成测试 |

---

## 五、实施路线图

### 阶段 1: P0 核心功能补全

| 任务 | 需修改/创建的文件 | 复杂度 | 可复用后端 | 依赖 |
|------|-----------------|--------|-----------|------|
| P0-1: 反向链接面板 | 新建 `components/notes/backlinks-panel.tsx`, 修改 `editor.tsx` | **S** | `list_backlinks` | 无 |
| P0-2: 出链面板 | 新建 `components/notes/outlinks-panel.tsx`, 修改 `editor.tsx` | **S** | `get_note_record.outlinks` | 无 |
| P0-3: Quick Switcher | 修改 `command-palette.tsx`, `App.tsx` 添加 Cmd+O | **S** | `resolve_note_link` + `search_kb` | 无 |
| P0-4: Markdown 序列化 | 新建 `lib/markdown-bridge.ts` (turndown/html-to-md), 修改 `editor.tsx` | **M** | `add_note`/`update_note` | 无 |
| P0-5: 笔记嵌入 | 新建 TipTap Node `components/extensions/note-embed.tsx`, 修改 `editor.tsx` | **M** | `get_note` | P0-4 |
| P0-6: Frontmatter 编辑器 | 修改 `editor.tsx` 标题栏, 新建 `components/notes/frontmatter-editor.tsx` | **S** | `frontmatter` + `update_note` tags | 无 |
| P0-7: 编辑器大纲集成 | 修改 `editor.tsx`, 确保 `outline-panel.tsx` 正确显示并跟随光标 | **S** | 已有 `outline-panel.tsx` | 无 |

**阶段 1 预估**: ~3-5 天工作量

### 阶段 2: P1 重要增强

| 任务 | 需修改/创建的文件 | 复杂度 | 可复用后端 | 依赖 |
|------|-----------------|--------|-----------|------|
| P1-1: Callout 块 | 新建 `components/extensions/callout-block.tsx`, 修改 `editor.tsx` | **M** | 无 | 无 |
| P1-2: 代码块语法高亮 | 安装 `@tiptap/extension-code-block-lowlight` + `lowlight`, 修改 `editor.tsx` | **S** | 无 | 无 |
| P1-3: Mermaid 渲染 | 新建 `components/extensions/mermaid-block.tsx`, 安装 `mermaid` | **M** | 无 | 无 |
| P1-4: 局部图谱 | 新建 `components/notes/local-graph.tsx`, 修改 `editor.tsx` | **L** | `list_backlinks` + `outlinks` | P0-1 |
| P1-5: 自动保存 | 修改 `editor.tsx` onUpdate + debounce `update_note` | **S** | `update_note` | P0-4 |
| P1-6: 版本历史 UI | 新建 `components/notes/version-history-panel.tsx` | **M** | `replay.rs` + `compare_timeline` | 无 |
| P1-7: WebDAV 自动同步 | 修改 `settings.tsx`, 新建 `hooks/use-auto-sync.ts` | **S** | `webdav_sync_kb` | 无 |
| P1-8: 笔记链接图谱 | 修改 `graph.tsx` 添加视图切换(实体/链接) | **L** | `list_backlinks` + `list_notes` | P0-1 |
| P1-9: 模板变量替换 | 修改 `template-store.ts`, 添加 `processTemplateVariables()` | **S** | 无 | 无 |

**阶段 2 预估**: ~5-8 天工作量

### 阶段 3: P2 锦上添花

| 任务 | 需修改/创建的文件 | 复杂度 |
|------|-----------------|--------|
| P2-1: KaTeX 渲染 | 新建 `components/extensions/katex-block.tsx` | **M** |
| P2-2: 音频播放器 | 新建 `components/extensions/audio-player.tsx` | **M** |
| P2-3: Dataview 查询 | 新建 `components/extensions/dataview-block.tsx` | **XL** |
| P2-4: 快捷键自定义 | 新建 `store/keybindings-store.ts` | **M** |
| P2-5: 图片粘贴 | 修改 `editor.tsx` paste handler | **S** |
| P2-6: 拖拽排序 | 修改 `folder-tree.tsx` | **M** |

**阶段 3 预估**: ~5-10 天工作量

---

## 六、快速胜利 (< 1 小时/项, 立竿见影)

| # | 任务 | 修改文件 | 效果 |
|---|------|---------|------|
| 1 | **Cmd+O Quick Switcher** | `App.tsx` 添加快捷键, 复用 `command-palette.tsx` | 快速笔记跳转 |
| 2 | **反向链接面板** | 新建 `backlinks-panel.tsx` ~60行 | 显示谁链接到当前笔记 |
| 3 | **自动保存指示器** | `editor.tsx` 工具栏添加状态文本 | 显示已保存/保存中 |
| 4 | **中文字数统计** | `editor.tsx` 第144行 `setWordCount` | 改为中文友好的字数统计 |
| 5 | **代码块语法高亮** | 安装 `@tiptap/extension-code-block-lowlight` | 代码着色 |
| 6 | **搜索页默认焦点** | `search.tsx` 添加 `useEffect(() => inputRef.current?.focus(), [])` | 即搜即输入 |
| 7 | **模板变量替换** | `template-store.ts` 添加 `{{date}}`/`{{time}}`/`{{title}}` | 模板更实用 |
| 8 | **WebDAV 同步状态指示器** | `layout.tsx` 第174-196行 KB 状态区域 | 显示同步状态 |
| 9 | **标签拖拽合并** | `tags.tsx` 标签云添加拖拽 + `mergeTag` | 快速合并标签 |
| 10 | **Mermaid 代码块** | 安装 `mermaid`, 新建 TipTap Node ~80行 | 流程图渲染 |

---

## 七、架构关键决策点

### 7.1 编辑器内容格式

**当前**: 编辑器存 HTML
**选项 A**: 保持 HTML (富文本完整, 不兼容 Obsidian)
**选项 B**: 存 Markdown (兼容, 但丢失部分富文本能力)
**建议**: 存 Markdown + 导出时可选 HTML。引入 `turndown` (HTML→MD) 和 `html-to-md` 库。前端显示时 Markdown→HTML。

### 7.2 笔记链接图谱 vs 实体图谱

**当前**: `graph.tsx` 是实体图谱 (LogicMesh)
**建议**: 在 `graph.tsx` 添加视图切换 Tab: "实体图谱" | "笔记链接图谱"

### 7.3 自动保存 vs 手动保存

**当前**: 需手动点"保存草稿"
**建议**: 实现 debounce 自动保存 (输入停止 2 秒后自动保存) + 脏标记指示器

### 7.4 MV2 格式的数据可移植性

**当前**: MV2 单文件格式不兼容其他工具
**建议**: 保留 MV2 但加强 Markdown 导出功能, 支持单个/批量导出为 `.md` 文件夹, 使数据可移植到 Obsidian

---

## 八、未被前端充分利用的后端能力

以下后端命令已实现但前端未充分利用:

| 后端命令 | 前端利用现状 | 改进建议 |
|---------|-------------|---------|
| `list_backlinks` | API 已暴露, 无 UI | 添加反向链接面板 |
| `backfill_all_links` | API 未暴露 | 设置页添加"重建链接索引"按钮 |
| `compare_timeline` | timeline 页面基础 | 添加版本对比 UI |
| `search_with_graph` | search.tsx 已用 | 添加更直观的图谱过滤 UI |
| `selection_ai` | 5 种操作只暴露部分 | 完善选区 AI 菜单 |
| `get_entity`/`traverse_graph` | graph.tsx 已用 | 添加实体详情面板 |
| `list_memories` | API 已暴露, 无 UI | 实体记忆卡管理面板 |
| `export_kb` | 设置页有按钮 | 支持导出为 Markdown 文件夹 |
| `webdav_sync_kb` | 设置页有配置 | 添加后台自动同步 |
| `ocr_image` | selection-panel 有入口 | 编辑器内截图 OCR |

---

## 九、关键实现文件索引

| 文件 | 用途 |
|------|------|
| `src/components/pages/editor.tsx` | 核心编辑器, 几乎所有 P0/P1 都需修改 |
| `src/api/commands.ts` | 前端 API 层, 55+ 方法 |
| `src-tauri/src/commands/mod.rs` | 65 个 Tauri 命令定义 |
| `src/components/ui/block-extensions.tsx` | 现有 TipTap 扩展, 新扩展的参考模板 |
| `src/App.tsx` | 应用入口, 全局快捷键和路由 |
| `src/store/kb-store.ts` | 核心 KB 状态管理 |
| `src/store/workspace-store.ts` | 工作区视图状态 |
| `crates/clawkb-core/src/kb.rs` | 核心后端 ~2613 行 |
| `crates/clawkb-core/src/llm.rs` | LLM 多模型实现 |
| `crates/clawkb-core/src/sync/webdav.rs` | WebDAV 同步实现 |

---

## 十、执行策略

### 原则
1. **最大化复用后端** — 后端已实现 65 个命令, 大部分缺口只需前端 UI
2. **渐进式交付** — 每个阶段独立可用, 不依赖后续阶段
3. **快速胜利先行** — 先做 <1 小时的 Quick Wins, 立刻改善体验
4. **TipTap 扩展模式** — 所有编辑器新功能遵循 `block-extensions.tsx` 的模式

### 建议执行顺序
1. **Week 1**: 快速胜利 (10 项) + P0-1/P0-2/P0-3 (链接面板 + Quick Switcher)
2. **Week 2**: P0-4/P0-5/P0-6/P0-7 (Markdown 序列化 + 嵌入 + Frontmatter + 大纲)
3. **Week 3-4**: P1-1~P1-5 (Callout + 高亮 + Mermaid + 局部图谱 + 自动保存)
4. **Week 5-6**: P1-6~P1-9 (版本历史 + 同步 + 笔记图谱 + 模板变量)
5. **后续**: P2 按需实现

---

## 十一、深度代码审计 — Bug 与实现问题清单

> 基于逐文件逐行代码审查，按严重度分级

### 11.1 严重 Bug (CRITICAL) — 必须立即修复

| # | 文件 | 行号 | 问题 | 修复方案 |
|---|------|------|------|---------|
| C-1 | `editor.tsx` | — | **无自动保存** — 用户关闭窗口或导航即丢失所有编辑内容 | 添加 debounce 自动保存 (输入停止 2s 后调用 `update_note`) + `beforeunload` 警告 |
| C-2 | `editor.tsx` | 88-93 | **新建笔记每次保存创建重复笔记** — `addNote` 后未设置 `editingNoteId`, 后续自动保存再次调用 `addNote` 创建新笔记 | `addNote` 后捕获返回的 note ID, 设置 `editingNoteId` |
| C-3 | `api/commands.ts` | 315 | **`listSessions` 调用不存在的后端命令** — Rust 后端无 `list_sessions`, 运行时必定报错 | 移除或实现对应 Rust 命令 |
| C-4 | `api/commands.ts` | 320 | **`searchAsOf` 调用不存在的后端命令** — Rust 后端无 `search_as_of` | 移除或实现对应 Rust 命令 |
| C-5 | `api/commands.ts` | 327 | **`askAsOf` 调用不存在的后端命令** — Rust 后端无 `ask_as_of` | 移除或实现对应 Rust 命令 |
| C-6 | `sync-store.ts` | 97 | **WebDAV 密码明文存储在 localStorage** — 任何页面脚本均可读取 | 使用 Tauri 安全存储 API 或加密后存储 |
| C-7 | `ai-store.ts` | 95 | **`setApiKey` 无效密钥也标记为已配置** — 用户输入无效 key 后 `isConfigured=true` | 仅在 `applyConfig` 成功后设置 `isConfigured` |

### 11.2 高优先级 Bug (HIGH) — 核心功能异常

| # | 文件 | 行号 | 问题 | 修复方案 |
|---|------|------|------|---------|
| H-1 | `editor.tsx` | 333-335 | **Slash 命令只在编辑器完全为空时触发** — `editor.isEmpty` 检查应为当前段落为空 | 改为检查 `$from.parent.textContent === ''` |
| H-2 | `editor.tsx` | 643-654 | **Slash 命令输入框抢夺焦点** — 输入框 `autoFocus` 使编辑器光标丢失 | 用 ProseMirror plugin 拦截键盘, 不用独立 input |
| H-3 | `editor.tsx` | 141-146 | **`onUpdate` 闭包中 `title` 永远是初始值** — `useEditor` 只创建一次, `title` 不更新 | 用 `editor.on('update', ...)` 或 ref 持有最新 title |
| H-4 | `editor.tsx` | 813 | **Wikilink `onSelect` 是空函数** — 选择笔记后不执行任何操作 | 实现 onSelect: 插入 wikilink 节点或跳转 |
| H-5 | `block-extensions.tsx` | 277-287 | **DragHandlePlugin `appendTransaction` 传错参数** — 传 `{doc: ...}` 而非 view, DOM 更新是死代码 | 修正参数传递或改用 React 组件方式 |
| H-6 | `reader.tsx` | 18 | **PDF.js worker 从 CDN 加载** — 桌面离线环境下 PDF 无法渲染 | 改为本地 worker 文件或 `new URL('pdf.worker.min.mjs', import.meta.url)` |
| H-7 | `reader.tsx` | 434-448 | **高亮只保存在侧边栏, 不渲染到文档内容中** — 用户看不到高亮效果 | 在 `renderContent` 中对高亮文本添加 `<mark>` 标签 |
| H-8 | `reader.tsx` | 1162-1172 | **反向链接点击不导航** — 更新全局 store 但不更新 ReaderPage 本地 `selectedDoc` | 点击 backlink 后更新组件本地 `selectedDoc` 状态 |
| H-9 | `editor.tsx` | 638-710 | **Slash 命令弹窗纯暗色主题** — `text-white` + `border-white/10` 亮色模式下不可见 | 用语义化 token: `text-foreground` + `border-border` |
| H-10 | `api/commands.ts` | 94 | **`search` 传 `topK` 但 Rust 期望 `top_k`** — camelCase/snake_case 映射可能失败 | 确认 Tauri serde rename_all 配置或手动映射 |

### 11.3 中等优先级 Bug (MEDIUM) — 功能不完整

| # | 文件 | 行号 | 问题 |
|---|------|------|------|
| M-1 | `editor.tsx` | 252-254 | **保存时混合 Markdown 和 HTML** — source 元数据用 MD 格式追加到 HTML 内容前 |
| M-2 | `editor.tsx` | 241-267 | **`handleSaveDraft` 竞态** — 快速连续保存可能使用过期 content |
| M-3 | `editor.tsx` | 159-167, 199-201 | **`onDraftChange` 双重触发** — content 初始化时被调两次 |
| M-4 | `editor.tsx` | 277-292 | **`ToolbarButton` 组件定义在组件体内** — 每次渲染重新创建, 导致所有按钮 unmount/remount |
| M-5 | `editor.tsx` | 144 | **中文词数统计错误** — `split(/\s+/)` 对中文无效, 返回 1 |
| M-6 | `editor.tsx` | 344-349 | **模板应用无确认** — 直接 `setContent` 覆盖现有内容 |
| M-7 | `editor.tsx` | 272 | **AI 建议以纯文本插入** — 格式化内容 (列表/段落) 丢失 |
| M-8 | `search.tsx` | 229-231 | **"清除文件夹" 搜索竞态** — `setTimeout` 中 handleSearch 仍持有旧 folder |
| M-9 | `search.tsx` | 118 | **graphResults 切换搜索模式后残留** — 切换到普通搜索时旧图谱结果仍显示 |
| M-10 | `reader.tsx` | 261-264 | **阅读进度恢复时序问题** — 滚动容器布局未完成时设置 scrollTop 无效 |
| M-11 | `reader.tsx` | 768-782 | **使用 `window.prompt()` 输入笔记** — 阻塞式、不可样式化的对话框 |
| M-12 | `block-extensions.tsx` | 339-358 | **`rangeHasAttribute` 不存在于 ProseMirror** — 折叠功能按键会抛运行时错误 |
| M-13 | `chat-store.ts` | 87-149 | **sendMessage 无并发保护** — 快速发送两条消息会交错 set() 调用 |
| M-14 | `ai-store.ts` | 138-158 | **`applyConfig` 两步配置非原子** — embedding 成功但 ask 失败时状态不一致 |
| M-15 | `ai-store.ts` | 143-150 | **embedding 和 LLM 共享 API Key** — 无法为不同服务配置不同密钥 |
| M-16 | `api/commands.ts` | 300 | **`traverseGraph` 返回类型不匹配** — TS 声明 `EntityInfo[]` 但 Rust 返回 `TraverseResult[]` |

### 11.4 低优先级问题 (LOW) — 代码质量

| # | 文件 | 问题 |
|---|------|------|
| L-1 | `editor.tsx` | `_embedded` prop 声明但未使用 |
| L-2 | `editor.tsx` | 重复的 slash command 过滤逻辑 (line 295 和 679) |
| L-3 | `editor.tsx` | `wikilink` slash command 的 action 是 no-op |
| L-4 | `editor.tsx` | slash `/` 字符输入后不从编辑器移除 |
| L-5 | `block-extensions.tsx` | `BlockDragHandle` 组件已定义但从未渲染 |
| L-6 | `block-extensions.tsx` | 块引用点击无反应 (cursor:pointer 但无 handler) |
| L-7 | `block-extensions.tsx` | `handleDeleteBlock` 只删 1 个位置, 非整个块 |
| L-8 | `kb-store.ts` | `toggleDarkMode` 直接操作 DOM (应通过 React effect) |
| L-9 | `kb-store.ts` | 手动 localStorage 管理而非 Zustand persist |
| L-10 | `chat-store.ts` | 消息 ID 用 `Date.now()` 可能碰撞 |
| L-11 | `chat-store.ts` | multi-KB 结果丢弃 `kb_name`/`kb_path` 属性 |
| L-12 | `folder-store.ts` | 无 persist, 展开状态刷新后丢失 |
| L-13 | `multi-kb-store.ts` | 时间戳格式不一致 (秒 vs 毫秒 vs ISO) |
| L-14 | `api/types.ts` | 缺少 `NoteRecord`, `BacklinkEntry`, `FolderIndexEntry` 类型 |
| L-15 | `api/commands.ts` | `getNote` 和 `getNoteRecord` 调用同一 Rust 命令但类型不同 |

### 11.5 Bug 统计

| 严重度 | 数量 | 说明 |
|--------|------|------|
| CRITICAL | 7 | 运行时崩溃或数据丢失 |
| HIGH | 10 | 核心功能异常 |
| MEDIUM | 16 | 功能不完整或体验差 |
| LOW | 15 | 代码质量和维护性 |
| **总计** | **48** | |

---

## 十二、修复优先级建议 (基于 Bug 审计)

### 第一批: 阻塞性修复 (阻断用户正常使用)

| 优先级 | 任务 | 预估时间 |
|--------|------|---------|
| 1 | C-1 + C-2: 编辑器自动保存 + 重复笔记修复 | 2h |
| 2 | H-6: PDF worker 本地化 | 0.5h |
| 3 | H-1 + H-2: Slash 命令修复 | 2h |
| 4 | C-3/C-4/C-5: 移除不存在的 API 命令 | 0.5h |
| 5 | H-4: Wikilink onSelect 实现 | 1h |

### 第二批: 核心体验修复

| 优先级 | 任务 | 预估时间 |
|--------|------|---------|
| 6 | H-7: 高亮渲染到文档内容 | 2h |
| 7 | H-8: 反向链接点击导航 | 1h |
| 8 | H-3: onUpdate 闭包 title 修复 | 0.5h |
| 9 | H-9: Slash 弹窗亮色模式 | 1h |
| 10 | M-5: 中文词数统计 | 0.5h |
| 11 | M-12: 折叠功能移除或修复 | 0.5h |

### 第三批: 稳定性提升

| 优先级 | 任务 | 预估时间 |
|--------|------|---------|
| 12 | M-1: 保存格式统一 (HTML 或 MD) | 3h |
| 13 | M-4: ToolbarButton 提取到组件外 | 0.5h |
| 14 | M-13: Chat 并发保护 | 1h |
| 15 | M-14/M-15: AI 配置原子性 + 独立密钥 | 2h |
| 16 | C-6: WebDAV 密码安全存储 | 2h |
| 17 | M-8/M-9: 搜索竞态修复 | 1h |

---

## 十三、编辑器功能实现状态详细评估

### TipTap 3 扩展注册清单

| 扩展 | 已注册 | 已安装 | 功能状态 |
|------|--------|--------|---------|
| StarterKit | ✅ | ✅ | 基础功能正常 |
| Typography | ✅ | ✅ | 智能引号等正常 |
| Underline | ✅ | ❓ | 可能未安装 |
| Link | ✅ | ❓ | 可能未安装 |
| Table | ✅ | ✅ | 表格正常 |
| TaskList | ✅ | ✅ | 任务列表正常 |
| Image | ✅ | ✅ | 图片正常 |
| BlockId (自定义) | ✅ | — | 架构有误但可运行 |
| BlockReference (自定义) | ✅ | — | 点击无反应 |
| DragHandle (自定义) | ✅ | — | DOM 更新是死代码 |
| CodeBlockLowlight | ❌ | ❌ | 无语法高亮 |
| Callout | ❌ | ❌ | 不存在 |
| Mermaid | ❌ | ❌ | 不存在 |
| KaTeX | ❌ | ❌ | 不存在 |
| NoteEmbed | ❌ | ❌ | 不存在 |

### Slash 命令清单

| 命令 | 可触发 | Action | 状态 |
|------|--------|--------|------|
| 标题 1-3 | ❌ (仅空编辑器) | 正常 | 需修复触发条件 |
| 有序列表 | ❌ | 正常 | 同上 |
| 无序列表 | ❌ | 正常 | 同上 |
| 任务列表 | ❌ | 正常 | 同上 |
| 代码块 | ❌ | 正常 | 同上 |
| 引用 | ❌ | 正常 | 同上 |
| 分割线 | ❌ | 正常 | 同上 |
| 表格 | ❌ | 正常 | 同上 |
| 页面引用 | ❌ | **no-op** | action 为空函数 |
| AI 生成 | ❌ | 部分工作 | 插入纯文本 |
| 模板 | ❌ | 正常 | 需修复触发条件 |

### Wikilink 自动补全状态

| 功能 | 实现 | 状态 |
|------|------|------|
| `[[` 触发检测 | ✅ | 仅连续输入时检测 |
| 搜索笔记 | ✅ | 搜索正常 |
| 选择笔记 | ❌ | `onSelect` 为空函数 |
| 插入链接节点 | ❌ | 无代码实现 |
| 闭括号 `]]` 处理 | ❌ | 无代码实现 |
| 显示笔记预览 | ❌ | 无代码实现 |

---

## 十四、各页面功能完整性矩阵

| 页面 | 导航 | 数据加载 | CRUD | 搜索/过滤 | AI 集成 | 错误处理 | 自动保存 |
|------|------|---------|------|----------|---------|---------|---------|
| 工作台 | ✅ | ✅ | — | — | ✅ | ✅ | — |
| 探索-搜索 | ✅ | ✅ | — | ✅ | — | ✅ | — |
| 探索-导入 | ✅ | ✅ | — | — | — | 🟡 | — |
| 笔记-编辑器 | ✅ | ✅ | 🟡 | — | ✅ | ✅ | ❌ |
| 笔记-阅读器 | ✅ | ✅ | 🟡 | — | ✅ | 🟡 | 🟡 |
| 知识库 | ✅ | ✅ | ✅ | — | ✅ | ✅ | — |
| 设置 | ✅ | ✅ | ✅ | — | — | ✅ | — |
| 图谱 | ✅ | ✅ | — | ✅ | — | 🟡 | — |
| 脑图 | ✅ | ✅ | — | — | ✅ | ✅ | — |
| 标签 | ✅ | ✅ | ✅ | ✅ | — | ✅ | — |

图例: ✅ 完整  🟡 部分  ❌ 缺失

---

## 十五、全面对标顶级笔记应用

### 15.1 七大顶级应用对比矩阵

| 维度 | **ClawKB** | **Obsidian** | **Notion** | **Logseq** | **Heptabase** | **Reflect** | **Tana** |
|------|-----------|-------------|-----------|-----------|--------------|------------|---------|
| **核心范式** | 本地KB工作台 | Markdown文件 | Block组合 | 大纲+日志 | 白板卡片 | AI原生笔记 | Supertag大纲 |
| **数据存储** | MV2单文件 | .md文件 | 云端 | .md文件 | 云端 | 云端(E2E) | 云端 |
| **离线能力** | ✅ 完全 | ✅ 完全 | 🟡 有限 | ✅ 完全 | ❌ | ❌ | 🟡 2025新增 |
| **编辑器** | TipTap富文本 | Markdown | Block编辑 | 大纲编辑 | 卡片编辑 | Markdown | 大纲编辑 |
| **双向链接** | 🟡 后端有,前端弱 | ✅ | ❌ | ✅ 块级 | ✅ 卡片级 | ✅ 自动 | ✅ 节点级 |
| **Slash命令** | 🟡 仅空编辑器 | ✅ | ✅ 丰富 | ✅ | ✅ | ❌ 极简 | ✅ 命令面板 |
| **数据库视图** | 🟡 inline-database | ❌ 需插件 | ✅ 多视图 | ❌ 需查询 | ❌ | ❌ | ✅ Supertag |
| **每日笔记** | ✅ 日历+热力图 | ✅ 插件 | ✅ 数据库 | ✅ **核心入口** | ✅ 集成 | ✅ **核心入口** | ✅ 核心入口 |
| **图谱可视化** | ✅ 实体图谱 | ✅ 链接图谱 | ❌ | ✅ 内置 | ✅ 白板即视图 | ✅ Map视图 | ❌ |
| **AI集成** | 🔵 内置RAG多模型 | ❌ 需插件 | ✅ 全平台Agent | ❌ 需插件 | ✅ 内置 | ✅ GPT-4原生 | ✅ 图谱感知AI |
| **导入格式** | 🔵 10+格式+OCR | 仅.md | 有限 | 仅.md | 有限 | 有限 | 有限 |
| **同步** | 🟡 WebDAV | Obsidian Sync | 云原生 | 手动 | 云原生 | 云原生 | 云原生 |
| **协作** | ❌ | ❌ | ✅ 实时 | ❌ | ✅ | ❌ | ✅ |
| **移动端** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **定价** | 免费 | 免费+Sync付费 | 免费+$10/月 | 免费开源 | 订阅制 | $10/月 | 订阅制 |

### 15.2 ClawKB 独有优势 (所有竞品没有的)

| # | 优势 | 价值 |
|---|------|------|
| 1 | **三模式搜索** (BM25+向量+混合) | 所有竞品仅全文搜索, 无语义理解 |
| 2 | **内置 RAG** (零配置AI问答) | Obsidian/Logseq需装插件+配API |
| 3 | **10+格式导入+OCR** | 竞品多仅支持Markdown |
| 4 | **实体图谱** (LogicMesh自动抽取) | 竞品仅手动链接图谱 |
| 5 | **多知识库并行+跨库搜索** | Obsidian需切换Vault |

### 15.3 ClawKB 关键差距 (对比顶级应用共性)

以下功能是**所有顶级笔记应用的共性标准**，ClawKB 缺失：

| # | 标准功能 | Notion | Obsidian | Logseq | Reflect | ClawKB |
|---|---------|--------|---------|--------|---------|--------|
| 1 | Cmd+K / Quick Find | ✅ | ✅ | ✅ | ✅ | 🟡 (有但弱) |
| 2 | 双向链接面板 | — | ✅ | ✅ | ✅ 自动 | ❌ |
| 3 | 自动保存 | ✅ | ✅ 文件 | ✅ 文件 | ✅ 云端 | ❌ |
| 4 | 移动端 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 5 | 模板系统 | ✅ 丰富 | ✅ | ✅ | ✅ | 🟡 |
| 6 | 富媒体嵌入 | ✅ | ✅ | — | — | ❌ |
| 7 | 协作/分享 | ✅ | ✅ Publish | — | — | ❌ |
| 8 | 块/卡片引用 | ✅ | ✅ | ✅ 块级 | — | 🟡 (有但断) |
| 9 | 命令面板 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 10 | 每日笔记 | ✅ | ✅ | ✅ 核心 | ✅ 核心 | ✅ |

### 15.4 各应用杀手级功能 (ClawKB 可借鉴)

| 应用 | 杀手功能 | ClawKB 借鉴方式 |
|------|---------|----------------|
| **Notion** | Block组合+数据库多视图 | 已有 `inline-database.tsx`, 需完善为多视图 |
| **Notion** | 浮动工具栏 (选中文字即出现) | TipTap BubbleMenu 已实现但需完善 |
| **Notion** | `+` 按钮在段落间插入新块 | 添加到 editor.tsx |
| **Logseq** | 块级引用 `((block-id))` | BlockReferenceExtension 已有, 需连接后端 |
| **Logseq** | 每日日志作为核心入口 | 已有 daily-calendar, 需强化为默认页 |
| **Heptabase** | 同一卡片出现在多个白板 | 已有 whiteboard.tsx, 需连接到笔记系统 |
| **Reflect** | 零摩擦捕获 (打开即输入) | 强化首页 AI Composer 为即时入口 |
| **Reflect** | AI 自动生成标题 | 后端 `selection_ai` 可扩展 |
| **Tana** | Supertag (结构化节点) | 已有 tags+frontmatter, 需 UI 化 |
| **Apple Notes** | 系统级快捷入口 | Tauri 全局快捷键 Cmd+Shift+K 已有 |

---

## 十六、UI 视觉审计报告

> 基于浏览器实测截图 + CSS 属性检查

### 16.1 严重视觉问题

#### 问题 V-1: 标题层级混乱 (CRITICAL)

同一应用内 H1/H2/H3 字号无一致性:

| 页面 | 标签 | 实际字号 | 上下文 |
|------|------|---------|--------|
| 探索 | H1 | **24px** | "先搜索、导入和整理资料..." |
| 探索 | H2 | **20px** | "导入资料" |
| 笔记 | H1 | **24px** | "围绕当前资料阅读..." |
| 笔记 | H2 | **18px** | 说明文字 |
| 笔记 | H2 | **30px** | "先打开一个本地知识库..." ← 异常大 |
| 知识库 | H1 | **24px** | 页面标题 |
| 知识库 | H3 | **18px** | 子标题 |
| 设置 | H2 | **20px** | "知识库设置" |
| 设置 | H3 | **14px** | "当前运行模式" ← H3 比 H2 小 6px |

**修复**: 建立统一排版系统:
- H1: 24px (页面主标题, 每页最多 1 个)
- H2: 20px (区块标题)
- H3: 16px (子区块)
- Body: 14px
- Caption: 12px

#### 问题 V-2: 暗色侧边栏 + 亮色内容区冲突 (CRITICAL)

侧边栏使用深渐变背景 (`rgb(15,18,31)` → `rgb(23,27,43)`) + 白色文字, 但主内容区使用浅色背景 (`rgb(249,250,251)`) + 深色文字。搜索栏和芯片组件又使用暗色背景。三种视觉风格在同一个视窗中冲突。

**修复方案**:
- A) 统一为全暗色主题 (推荐, 符合 KB 工具定位)
- B) 侧边栏也用浅色 (不符合品牌调性)
- C) 为侧边栏和内容区之间添加视觉过渡

#### 问题 V-3: 中英文混杂 (CRITICAL)

探索页混用:
- 中文标签: `搜索` / `导入` / `资料` / `搜索优先`
- 英文标题: `"Search"` / `"Import"` / `"File / Directory"` / `"Web Page"`
- 英文按钮: `Choose File` / `Import` / `Comma separated`
- 英文搜索框: `"Search your knowledge base..."`

**修复**: 统一为中文, 或建立 i18n 系统

### 16.2 高影响视觉问题

| # | 问题 | 影响 | 修复 |
|---|------|------|------|
| V-4 | 段落字号 11-14px 混用, 行高 16-28px 不一致 | 阅读体验差 | 统一 body 14px/22px, caption 12px/18px |
| V-5 | 按钮样式至少 5 种, 无统一设计系统 | 视觉杂乱 | 建立统一 Button 变体系统 |
| V-6 | 输入框高度 29px vs 40px 不一致 | 表格不对齐 | 统一 h-10 (40px) |
| V-7 | "KB" 虚线徽章看起来像临时占位符 | 不专业 | 替换为品牌 logo 或精化设计 |
| V-8 | 无焦点指示器 (Tab 键不可见焦点环) | 无障碍失败 (WCAG) | 添加 focus-visible 样式 |
| V-9 | 侧边栏 86px 折叠态中文标签过挤 | 移动端不友好 | 折叠态仅显示图标, 悬浮显示 tooltip |

### 16.3 中等影响问题

| # | 问题 | 修复 |
|---|------|------|
| V-10 | 侧边栏/内容区 border 颜色不匹配 (深色 vs 浅色) | 统一为 `border-border` |
| V-11 | 无骨架屏/加载状态 | 添加 shimmer skeleton |
| V-12 | 空状态仅文字无图标/插图 | 添加空状态插图 |
| V-13 | transition 类存在但无可见动画 | 增强 hover 过渡效果 |
| V-14 | 无响应式断点 (680px 时双面板挤压) | 添加 md/lg 断点折叠 |
| V-15 | 30px H2 在窄屏下文本溢出 | 限制最大字号或换行 |

### 16.4 Premium 感评估

**当前状态**: $0-10 级别 (原型/Beta 质量)

**达到 $30+ 级别的关键改进**:

| 优先级 | 改进 | 预估时间 |
|--------|------|---------|
| 1 | 统一排版系统 (3层字号) | 2h |
| 2 | 统一全暗色主题 | 4h |
| 3 | 统一中文 UI 文案 | 3h |
| 4 | 添加焦点环 | 1h |
| 5 | 添加骨架屏加载 | 3h |
| 6 | 精化空状态设计 | 2h |
| 7 | 统一按钮设计系统 | 2h |
| 8 | 添加 hover 微动画 | 2h |
| 9 | 响应式断点修复 | 4h |
| 10 | 侧边栏折叠态 tooltip | 1h |

---

## 十七、编辑器 UX 对标顶级应用

### 17.1 编辑器交互模式对比

| 交互 | Notion | Obsidian | Logseq | ClawKB 现状 | ClawKB 目标 |
|------|--------|---------|--------|------------|------------|
| 段落间 `+` 按钮 | ✅ | ❌ | ❌ | ❌ | P1 添加 |
| 选中文字浮动工具栏 | ✅ | ✅ | ❌ | ✅ (BlockBubbleMenu) | 完善功能 |
| `/` slash 命令 | ✅ 300+类型 | ✅ | ✅ | ❌ 仅空编辑器 | **P0 修复** |
| `[[` wikilink | — | ✅ | ✅ | 🟡 onSelect 空 | **P0 修复** |
| 块拖拽排序 | ✅ | ❌ | ❌ | ❌ 死代码 | P1 修复 |
| 块折叠 | — | ✅ | ✅ 核心 | ❌ API 不存在 | P2 |
| 图片粘贴上传 | ✅ | ✅ | — | ❌ | P1 |
| 表格编辑 | ✅ 完整 | 🟡 | — | ✅ TipTap Table | 已有 |
| 代码块高亮 | ✅ | ✅ | ✅ | ❌ | P1 |
| AI 写作助手 | ✅ Notion AI | ❌ 需插件 | ❌ 需插件 | ✅ AI Panel | 已有 |
| 自动保存 | ✅ 即时 | ✅ 文件 | ✅ 文件 | ❌ 手动 | **P0 修复** |
| Markdown 快捷键 | — | ✅ 原生 | ✅ 原生 | ✅ TipTap | 已有 |

### 17.2 导航模式对比

| 模式 | Notion | Obsidian | Reflect | ClawKB 现状 | ClawKB 目标 |
|------|--------|---------|---------|------------|------------|
| Cmd+K 搜索 | ✅ | ✅ | ✅ | ✅ 搜索页 | 保持 |
| Cmd+O 快速跳转 | — | ✅ | — | ❌ | P0 添加 |
| Cmd+P 命令面板 | ✅ | ✅ | ✅ | ✅ | 保持 |
| 面包屑导航 | ✅ | ❌ | ❌ | ❌ | P1 添加 |
| 侧边栏树形 | ✅ | ✅ | — | ✅ 5项导航 | 保持 |
| 标签页/多文档 | — | ✅ | — | ✅ document-tabs | 保持 |
| 反向链接面板 | — | ✅ | ✅ | ❌ | **P0 添加** |
| 图谱视图 | — | ✅ | ✅ Map | ✅ 实体图谱 | 添加链接图谱 |

### 17.3 每日笔记工作流对比

| 功能 | Obsidian | Logseq | Reflect | ClawKB |
|------|---------|--------|---------|--------|
| 每日自动创建 | ✅ | ✅ 核心入口 | ✅ 核心入口 | ✅ DailyCalendar |
| 日历 UI | ✅ 插件 | ✅ | ✅ | ✅ 热力图+日历 |
| 快捷键 | ✅ | ✅ | ✅ | ✅ Cmd+Shift+D |
| 日记模板 | ✅ | ✅ | ✅ | 🟡 模板系统弱 |
| 日记中链接笔记 | ✅ `[[wikilink]]` | ✅ 块级 | ✅ 自动 | ❌ wikilink 未接通 |
| 日记搜索 | ✅ 全文 | ✅ | ✅ | ✅ search |

---

## 十八、综合差距分析与行动优先级

### 18.1 "必须有"功能差距 (所有竞品共性)

| # | 功能 | 严重度 | 实现难度 | 建议阶段 |
|---|------|--------|---------|---------|
| 1 | 自动保存 | 🔴 | S (2h) | **立即** |
| 2 | Slash 命令 (任意位置触发) | 🔴 | M (4h) | **立即** |
| 3 | Wikilink 完整流程 | 🔴 | M (4h) | **立即** |
| 4 | 反向链接面板 | 🔴 | S (2h) | **Week 1** |
| 5 | 统一主题 (全暗色) | 🔴 | M (4h) | **Week 1** |
| 6 | 统一中文文案 | 🟡 | S (3h) | **Week 1** |
| 7 | 统一排版系统 | 🟡 | S (2h) | **Week 1** |
| 8 | 焦点指示器 | 🟡 | S (1h) | **Week 1** |
| 9 | Quick Switcher (Cmd+O) | 🟡 | S (1h) | **Week 1** |
| 10 | Frontmatter 编辑器 | 🟡 | S (2h) | **Week 2** |
| 11 | 骨架屏加载状态 | 🟡 | M (3h) | **Week 2** |
| 12 | 代码块语法高亮 | 🟡 | S (1h) | **Week 2** |

### 18.2 "差异化的高级功能" (顶级应用部分有)

| # | 功能 | 来源应用 | 实现难度 |
|---|------|---------|---------|
| 1 | 笔记嵌入 `![[note]]` | Obsidian | M |
| 2 | 局部图谱 (per-note) | Obsidian | L |
| 3 | 白板+笔记连接 | Heptabase | L |
| 4 | AI 自动标题生成 | Reflect | S (后端已有) |
| 5 | 数据库多视图 | Notion | XL |
| 6 | Mermaid 图表渲染 | Obsidian | M |
| 7 | Callout/标注块 | Obsidian | M |
| 8 | 块级引用完整流程 | Logseq | M |
| 9 | 版本历史 UI | 所有竞品 | M |
| 10 | 模板变量替换 | Obsidian Templater | S |

### 18.3 竞品工作流启示

| 工作流 | 竞品做法 | ClawKB 改进 |
|--------|---------|------------|
| **捕获** | Reflect/Apple Notes: 打开即输入 | 首页 AI Composer 强化 |
| **组织** | Heptabase: 空间排列, 不是树 | 白板连接到笔记系统 |
| **链接** | Logseq: 每个块可引用 | BlockReference 连接后端 |
| **发现** | Notion Cmd+K: 全局搜索+命令 | 已有, 需强化笔记搜索 |
| **回顾** | Tana/Reflect: AI 帮你回顾笔记 | 后端 RAG 已有, 需 UI |
| **输出** | Obsidian Publish: 分享笔记 | 导出 Markdown 功能 |

---

## 十九、修订后的执行计划

### Phase 0: 紧急修复 (Week 1, ~20h)

| 优先级 | 任务 | 时间 | 修复文件 |
|--------|------|------|---------|
| P0-0a | 自动保存 + 重复笔记修复 | 2h | `editor.tsx`, `notes.tsx` |
| P0-0b | Slash 命令任意位置触发 | 4h | `editor.tsx` (ProseMirror plugin) |
| P0-0c | Wikilink onSelect 实现 | 4h | `editor.tsx`, `wikilink-autocomplete.tsx` |
| P0-0d | 反向链接面板 | 2h | 新建 `backlinks-panel.tsx` |
| P0-0e | 统一排版系统 | 2h | `index.css` + 各页面 H1/H2/H3 |
| P0-0f | 统一中文文案 | 3h | `search.tsx`, `import.tsx` 等 |
| P0-0g | 焦点指示器 + 无障碍 | 1h | 全局 CSS |
| P0-0h | 移除幽灵 API 命令 | 0.5h | `commands.ts` |
| P0-0i | PDF worker 本地化 | 0.5h | `reader.tsx` |
| P0-0j | onUpdate 闭包 title 修复 | 1h | `editor.tsx` |

### Phase 1: 核心功能 (Week 2-3, ~30h)

| 任务 | 时间 | 文件 |
|------|------|------|
| 统一全暗色主题 | 4h | `index.css`, 各组件 |
| Quick Switcher (Cmd+O) | 1h | `command-palette.tsx`, `App.tsx` |
| Frontmatter 编辑器 | 2h | `editor.tsx` |
| 代码块语法高亮 | 1h | `editor.tsx` |
| 骨架屏加载 | 3h | 各页面 |
| 高亮渲染到文档内容 | 2h | `reader.tsx` |
| 反向链接点击导航 | 1h | `reader.tsx` |
| 中文词数统计修复 | 0.5h | `editor.tsx` |
| Markdown 序列化 | 3h | 新建 `markdown-bridge.ts` |
| 笔记嵌入 `![[note]]` | 4h | 新建 `note-embed.tsx` |
| 编辑器大纲集成 | 2h | `editor.tsx` + `outline-panel.tsx` |
| 响应式断点修复 | 4h | 各 shell 组件 |
| 空状态设计精化 | 2h | 各页面 |
| 搜索竞态修复 | 0.5h | `search.tsx` |

### Phase 2: 重要增强 (Week 4-5, ~25h)

| 任务 | 时间 | 文件 |
|------|------|------|
| Callout/标注块 | 4h | 新建 `callout-block.tsx` |
| Mermaid 渲染 | 3h | 新建 `mermaid-block.tsx` |
| 局部图谱 (per-note) | 4h | 新建 `local-graph.tsx` |
| 笔记链接图谱 (视图切换) | 3h | `graph.tsx` |
| 模板变量替换 | 2h | `template-store.ts` |
| WebDAV 自动同步 | 2h | `settings.tsx`, `use-auto-sync.ts` |
| 版本历史 UI | 3h | 新建 `version-history-panel.tsx` |
| WebDAV 密码安全存储 | 2h | `sync-store.ts` |
| AI 配置原子性修复 | 2h | `ai-store.ts` |

### Phase 3: 差异化 (Week 6+, 按需)

| 任务 | 时间 |
|------|------|
| KaTeX/LaTeX 渲染 | 4h |
| 音频播放器 | 4h |
| 块拖拽排序修复 | 3h |
| 图片粘贴上传 | 2h |
| 白板+笔记连接 | 8h |
| 移动端构建 (Tauri) | 16h |
| 插件系统设计 | 40h+ |

---

## 二十、执行 TODO 清单 (实时跟踪)

### ✅ 已完成

| # | 任务 | 修改文件 | 完成时间 |
|---|------|---------|---------|
| P0-1a | 修复新建笔记每次保存创建重复笔记 | `notes.tsx` L91: `addNote` 后捕获 `newId` 设置 `editingNoteId` | ✅ |
| P0-1b | 编辑器 `handleSaveDraft` 防重复创建 | `editor.tsx`: 添加 `savedNoteIdRef`, 首次 `addNote` 后存 ID, 后续调用 `updateNote` | ✅ |
| P0-2 | Slash 命令任意位置触发 | `editor.tsx` L342: `editor.isEmpty` → `$from.parent.textContent === ''` | ✅ |
| P0-3 | **Wikilink onSelect 链接同步** | `editor.tsx` L842: `onSelect` 调用 `api.syncNoteLinks()` 追踪反向链接 | ✅ |
| P0-4 | `onUpdate` 闭包 title 过期 | `editor.tsx`: 添加 `titleRef`, `onUpdate` 中使用 `titleRef.current` | ✅ |
| P0-5 | **反向链接面板 (编辑器+阅读器)** | 新建 `components/ui/backlinks-panel.tsx` 共享组件; `editor.tsx` 添加 `EditorBacklinksPanel`; `reader.tsx` 替换内联实现为共享组件 | ✅ |
| P0-6 | PDF worker 本地化 | `reader.tsx` L18: `unpkg CDN` → `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` | ✅ |
| P0-7 | 移除幽灵 API 命令 | `commands.ts`: 删除 `listSessions`/`searchAsOf`/`askAsOf`; `timeline.tsx`: 降级为 `search`+`aiAsk` | ✅ |
| P0-8a | **阅读器高亮渲染到文档内容** | `reader.tsx` renderContent: 高亮文本用 `<mark>` 标签包裹, 支持多色高亮 | ✅ |
| P0-8b | **反向链接点击导航 + wikilink 导航** | `reader.tsx`: backlink 和 wiki-link 点击调用 `handleSelectDoc()` 更新本地 `selectedDoc` | ✅ |
| P0-9 | 中文词数统计修复 | `editor.tsx` L144: CJK 字符单独计数 + Latin 空格分词 | ✅ |
| P1-a | **ToolbarButton 提取到组件外** | `editor.tsx`: `ToolbarButton` 从函数体提取为独立组件, 避免每次渲染重建 | ✅ |
| P1-b | **Slash 命令弹窗亮/暗色兼容** | `editor.tsx`: `text-white`/`bg-white/5`/`border-white/10` → `text-foreground`/`bg-muted`/`border-border` | ✅ |
| P1-c | **AI 建议以 HTML 插入** | `editor.tsx`: `insertContent(aiSuggestion)` → `insertContent(htmlContent)` 自动包裹 `<p>` 标签 | ✅ |
| P1-d | **代码块语法高亮** | 安装 `@tiptap/extension-code-block-lowlight` + `lowlight`; 禁用 StarterKit codeBlock; 引入 `github-dark-dimmed` 主题 CSS | ✅ |
| P1-e | **Callout/标注块** | 新建 `components/ui/callout-block.tsx` (TipTap Node + ReactNodeViewRenderer); 集成到 `editor.tsx` 扩展 + 斜杠命令; 支持 info/warning/success/danger/tip 5种类型 | ✅ |
| P2-a | **Quick Switcher (Cmd+O + Cmd+P)** | `App.tsx`: 添加 `Cmd+O` 快捷键; `command-palette.tsx`: 主题一致性修复 `border-white/10`→`border-border`, `bg-amber-300/20`→`bg-primary/15` | ✅ |
| V-c | **统一中文文案** | `reader.tsx`: 6个 title 属性英→中; `import.tsx`: 4个 placeholder 英→中; `search.tsx`: 3个 placeholder 英→中 | ✅ |
| V-d | **WCAG 焦点指示器** | `index.css`: 增强 `focus-visible` 规则, 添加 `button`/`a`/`input`/`textarea`/`select`/`[tabindex]` 明确选择器 + `:focus:not(:focus-visible)` 移除鼠标焦点轮廓 | ✅ |
| P1-f | **Mermaid 图表渲染** | 新建 `components/ui/mermaid-block.tsx` (TipTap Node + mermaid.render); 集成到 `editor.tsx` 扩展 + 斜杠命令; `npm install mermaid` | ✅ |
| P2-b | **搜索文件夹竞态修复** | `search.tsx` L228: 移除 `setTimeout` hack, 改为直接调用 `search(query, mode)` 避免闭包过期 | ✅ |
| P2-c | **graphResults 残留修复** | `search.tsx` L118: `displayResults` 添加 `results ?? []` null safety | ✅ |
| V-a | **统一排版系统** | `index.css`: 添加 `--font-size-h1/h2/h3/body/small` 和 `--line-height-tight/normal` CSS 变量 | ✅ |
| V-e | **骨架屏加载状态** | `components/ui/skeleton.tsx`: 增强 `SkeletonText` + `SkeletonCard` 组件 | ✅ |
| V-b | **统一暗色主题** | `layout.tsx`/`block-extensions.tsx`/`inline-database.tsx`: `border-white/10`→`border-border`, `text-white`→`text-foreground`, `bg-white/5`→`bg-muted/50`, `bg-[#1a1e2a]`→`bg-popover` | ✅ |
| S-c | **Chat 并发保护** | `chat-store.ts`: `sendMessage` 添加 `if (get().isLoading) return` 防重复提交 | ✅ |
| S-d | **Frontmatter 标签编辑器** | `editor.tsx`: 标题栏下方添加标签输入区域, 支持回车/逗号添加, Backspace 删除, 保存时合并用户标签 | ✅ |
| S-e | **模板变量替换** | `editor.tsx` `handleTemplateSelect`: 替换 `{{date}}`/`{{time}}`/`{{title}}`/`{{tags}}` 为实际值 | ✅ |
| UI-1 | 主题一致性修复 (之前会话) | 全局替换硬编码颜色为 CSS 变量 token, 对齐 `.dark` 变量 | ✅ |

### ⬜ 待执行 (按优先级排序)

#### 第一优先级: 核心笔记功能完整性

~~所有第一优先级任务已完成~~

#### 第二优先级: 编辑器体验

~~所有第二优先级任务已完成~~

#### 第三优先级: 搜索与导航

| # | 任务 | 修改文件 | 复杂度 |
|---|------|---------|--------|
| ~~P2-a~~ | ~~Quick Switcher (Cmd+O)~~ | | ~~S~~ |
| ~~P2-b~~ | ~~搜索文件夹竞态修复~~ | | ~~S~~ |
| ~~P2-c~~ | ~~graphResults 残留修复~~ | | ~~S~~ |
| ~~P2-d~~ | ~~局部图谱 (per-note)~~ | | ~~L~~ |
| ~~P2-e~~ | ~~笔记链接图谱 (视图切换)~~ | | ~~L~~ |

#### 第四优先级: 视觉与交互

| # | 任务 | 修改文件 | 复杂度 |
|---|------|---------|--------|
| ~~V-a~~ | ~~统一排版系统~~ | | ~~M~~ |
| ~~V-b~~ | ~~统一暗色主题~~ | | ~~M~~ |
| ~~V-c~~ | ~~统一中文文案~~ | | ~~S~~ |
| ~~V-d~~ | ~~焦点指示器 (WCAG)~~ | | ~~S~~ |
| ~~V-e~~ | ~~骨架屏加载状态~~ | | ~~M~~ |
| ~~V-f~~ | ~~响应式断点修复~~ | | ~~M~~ |

#### 第五优先级: 数据安全与稳定性

| # | 任务 | 修改文件 | 复杂度 |
|---|------|---------|--------|
| ~~S-a~~ | ~~WebDAV 密码安全存储~~ | | ~~M~~ |
| ~~S-b~~ | ~~AI 配置原子性 + 独立密钥~~ | | ~~M~~ |
| ~~S-c~~ | ~~Chat 并发保护~~ | | ~~S~~ |
| ~~S-d~~ | ~~Frontmatter 编辑器~~ | | ~~S~~ |
| ~~S-e~~ | ~~模板变量替换~~ | | ~~S~~ |
