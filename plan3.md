# KB 全面差距分析与重构计划 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于真实代码现状，把当前 KB 从“多页面工具型本地知识库”重构为“知识库空间 + 对话入口 + 文档工作台”一体化产品，并逐步向参考图中的 IMA/OpenClaw 风格靠拢。

**Architecture:** 保留现有 Rust `clawkb-core` / `memvid-core` / Tauri 能力，前端不再继续横向加页面，而是先统一事实层、修复工程基线，再重做产品壳层、知识库空间模型、首页对话工作流和文档工作台。现阶段最重要的不是继续堆功能，而是把“真实可用能力”和“目标产品结构”重新对齐。

**Tech Stack:** Rust workspace (`clawkb-core` / `clawkb-cli` / `src-tauri`) + React 19 + TypeScript + Zustand + TipTap + shadcn/ui + Tauri 2 + memvid-core

---

## 一、这次分析的依据

### 1. 代码与运行事实

- 已检查整个 workspace：`crates/clawkb-core`、`crates/clawkb-cli`、`src-tauri`、`src/src`
- 已执行 `cargo check`：通过，Rust/Tauri 后端整体可编译，但有一批 warning 和少量 stub
- 已执行 `cd src && npm run build`：失败，说明前端当前不具备稳定交付能力
- 已执行 `cd src && npm run dev -- --host 127.0.0.1`：dev 可运行，当前 UI 可巡检
- 已实际巡检当前页面：Dashboard / Search / Chat / Import / Reader / Settings

### 2. 参考目标的真实含义

结合你提供的 4 张图，目标并不是简单“换皮”，而是产品模型升级：

- 参考图 1：深色、chat-first 首页，中心是统一输入框和快捷动作，不是统计型 Dashboard
- 参考图 2：知识库空间页，核心是“个人知识库 / 共享知识库 / 我创建的 / 我加入的”与右侧问答工作区
- 参考图 3：文档工作台，核心是左侧文档流 + 中间编辑器 / 标签页，而不是独立散落的 Reader / Editor / Notes / Report 页面
- 参考图 4：当前实现是一个 light admin 风格的 ClawKB，本质上还是“工具页面集合”

### 3. 一个必须先说清楚的结论

当前仓库和目标截图之间的差距，**不是 UI 细节差距，而是产品结构差距**：

- 当前代码主模型：`单个本地 KB + 多个工具页`
- 目标模型：`多个知识库空间 + 对话主入口 + 文档工作台 + 写作工作流`

因此，`plan3.md` 的核心建议不是继续在当前导航上小修小补，而是：

1. 先把工程恢复到可构建、可验证
2. 然后重构产品壳层和信息架构
3. 最后把现有能力迁移进新的工作流

## 二、当前代码的真实现状

### 1. 可以保留的部分

这些部分是真能力，不应该推倒重来：

- `clawkb-core` 能力面完整，`cargo check` 通过
- 已有真实后端能力：搜索、问答、导入、图谱、时间线、标签、导出、OCR、WebDAV、Obsidian、multi-KB 命令
- `src-tauri/src/commands/mod.rs` 已经暴露大量命令，说明桌面桥接层基础不弱
- 前端已有较丰富页面资产：Search / Chat / Reader / Import / Settings / Graph / Tags / Timeline / Report / Podcast
- `ReaderPage`、`ImportPage`、`SettingsPage`、`GraphPage` 这些页面里有不少可复用模块

### 2. 不能直接相信的部分

这些部分“看起来很多”，但并不等于可交付：

- `src/README.md` 还是 Vite 默认模板，文档事实和代码事实脱节
- `plan1.md` / `plan2.md` 明显高估完成度，不能作为当前状态依据
- 仓库顶层保留了多套方向截图：`notebooklm-*`、`*shadcn*`、`refactored-*`、当前 ClawKB，说明设计方向频繁漂移
- 前端 dev 可跑，但 build 失败，意味着当前页面集合并未收敛到稳定工程

### 3. 前端工程真实问题

`cd src && npm run build` 失败，暴露的是“接口事实源已经断裂”：

- `src/src/api/index.ts` 未导出 `AsOfResult`、`CompareResult`、`FolderInfo`、`VaultSummary`、`ObsidianImportResult`、`OcrResult` 等类型
- `src/src/api/commands.ts` 错误地从 `types.ts` 导入 `KbRegistration`
- `ImportResult`、`SyncStatus` 的 mock 结构与类型定义已不一致
- 多个页面存在未用变量、错误类型、字段缺失，说明页面和 API 在持续漂移

这说明当前最大技术问题不是“缺页面”，而是“前端没有统一事实层”。

## 三、页面与功能的真实分层

### 1. 真实可用

这些模块接近“真功能”：

| 模块 | 真实状态 | 说明 |
|---|---|---|
| Rust Core | 可用 | `cargo check` 通过，后端能力是现阶段最大资产 |
| Search | 基本可用 | 能查、能打开结果，但批量操作设计错误 |
| Chat | 基本可用 | 能问答、能显示 sources，但仍是单页聊天 |
| Import | 能用 | 文件 / URL / Media / Screenshot 入口都有 |
| Reader | 有工作台雏形 | 文档列表 + 阅读区 + Summarize / Chat / Bookmarks |
| Graph | 可用基础较好 | 已接真实 entity / memory API |
| Tags | 基本可用 | 标签管理比很多页面成熟 |
| Settings | 功能重 | AI / WebDAV / Obsidian / Export 都在，但入口层级不对 |

### 2. 半接通

这些模块有代码，但没有形成可靠产品能力：

| 模块 | 问题 |
|---|---|
| Timeline | 页面复杂，但因为类型导出缺失导致 build 失败 |
| Multi-KB | 后端命令和 store 已有，但没有真正变成核心 UI 工作流 |
| OCR / Audio / Image | 导入入口已在，但没有进入首页工作流和知识库空间流 |
| Report / Podcast | 页面很大，但和主工作流割裂，价值没有收束到产品主线 |

### 3. 伪实现 / 假连接

这些模块是当前最危险的“表面完成”：

| 模块 | 真实问题 |
|---|---|
| `EditorPage` | AI Assist 明确写了 mock，只是在展示“会如何调用”，且没有文档持久化主链路 |
| `EntitiesPage` | 不是用真实实体 API，而是从 `timeline` 标题用正则抽大写词 |
| `FolderTree` | 前端 store 落本地缓存；后端 `list_folders` 返回 demo folders；重命名/删除也是空实现 |
| Search 批量加标签 | 不是更新原文档，而是 `api.addNote(title + ' [updated]')` 生成重复文档 |
| Tauri 自动打开 KB | `App.tsx` 里写死 `/.clawkb/knowledge.mv2`，和 CLI 默认 `~/.clawkb/knowledge.mv2` 不一致，存在路径错误风险 |

## 四、与目标参考图的核心差距

### 1. 信息架构差距

| 目标参考 | 当前实现 | 差距结论 |
|---|---|---|
| 首页就是 AI 工作台 | 首页是 Dashboard 统计卡片 | 完全不匹配 |
| 知识库空间页是一级入口 | 只有单 KB 路径和 folder tree | 产品模型不匹配 |
| 文档编辑 / 阅读 / 生成在同一工作台 | 现在拆成 Reader / Editor / Notes / Report / Podcast 多页 | 任务流断裂 |
| 左侧是轻量导航 + 工作区 | 现在是 14 个页面并列导航 | 导航噪音过大 |

### 2. 视觉语言差距

目标参考图的视觉语言：

- 深色、沉浸、对话主导
- 左侧窄 icon rail + 中间 workspace pane
- 大面积留白/留黑，突出输入框和知识库内容
- 强品牌感和“AI 助手”气质

当前 ClawKB：

- 更像 shadcn admin/dashboard
- light mode 默认观感太轻
- 首页中心不是 prompt，而是 stats
- 页面密度偏“工具箱”，不是“工作台”

### 3. 功能工作流差距

目标参考图的主链路是：

1. 进入首页
2. 选知识库 / 进入空间
3. 围绕当前知识库提问、附加文件、切换模式/模型
4. 打开文档或生成输出
5. 在同一工作台内继续编辑

当前代码的主链路是：

1. 进 Dashboard
2. 去 Search / Chat / Import / Reader / Editor 中某一页
3. 每个页面做自己的事
4. 页面间缺少统一上下文

这意味着当前不是“少几个功能”，而是“缺一个真正的主流程”。

### 4. 数据模型差距

目标图 2 里已经隐含了这些数据模型：

- KB registry
- 个人 / 共享 / 我创建的 / 我加入的分类
- KB 封面 / 描述 / 成员 / 权限
- 选中知识库后的专属会话上下文

当前代码真实模型只有：

- 一个当前 `kbPath`
- 若干 `extra_kbs` 命令
- `multi-kb-store.ts` 里本地持久化的简易注册表

结论：**目标产品需要新的前端状态模型，甚至在“共享/加入”场景下需要新的后端协作模型。**

## 五、重构判断

### 1. 不建议的做法

- 不建议继续在当前 14 个页面上叠加更多入口
- 不建议先做视觉换皮，再回头修产品结构
- 不建议把参考图中的“共享知识库 / 我加入的”直接前端假做成静态列表
- 不建议继续让 demo 数据和真实能力混在同一层 API 中长期共存

### 2. 建议的做法

- 保留 Rust Core，前端壳层重构
- 先统一前端类型/API 事实源
- 把主工作流收束为 3 个一级场景：
  - 首页 Workbench
  - Knowledge Space
  - Document Workspace
- 把 Search / Tags / Graph / Timeline / Settings 变成二级能力，而不是首页级并列导航

## 六、后续实施计划

### Phase 0：恢复工程可信度

**目标：** 先把“前端 build 失败、类型漂移、文档失真”收回来，建立可信基线。

**状态：** 已完成（2026-04-05）

**本轮实际完成：**

- 前端类型出口、API 导出、demo/mock 结构已修到可构建状态
- `App.tsx` 已改为优先打开最近使用的 KB，其次回落到 `$HOME/.clawkb/knowledge.mv2`
- `Editor` / `Entities` 已从主导航暂时隐藏，`Folders` 已改为隐藏并给出说明文案
- `src/README.md` 已更新为当前真实前端说明
- 已执行真实验证：`cargo check`、`cd src && npm run build`、dev server 页面巡检

**Files:**
- Modify: `src/src/api/types.ts`
- Modify: `src/src/api/index.ts`
- Modify: `src/src/api/commands.ts`
- Modify: `src/src/App.tsx`
- Modify: `src/src/components/pages/timeline.tsx`
- Modify: `src/src/components/pages/settings.tsx`
- Modify: `src/src/components/pages/import.tsx`
- Modify: `src/src/components/pages/report.tsx`
- Modify: `src/src/components/pages/podcast.tsx`
- Modify: `src/src/components/folder-tree.tsx`
- Modify: `src/README.md`

- [x] 修正所有前端导出类型、mock 类型、API 类型不一致问题
- [x] 修正 `App.tsx` 默认 KB 路径策略，至少与 CLI 默认路径保持一致
- [x] 标记或临时隐藏 folder/entity/editor 这类伪实现入口，避免继续误导
- [x] 更新 `src/README.md`，写清当前真实模块、启动方式、限制项
- [x] 运行 `cargo check`
- [x] 运行 `cd src && npm run build`

**验收标准**

- `cargo check` 通过
- `cd src && npm run build` 通过
- README 与代码现状一致

### Phase 1：重建产品壳层与信息架构

**目标：** 从“多页面工具箱”切换成“工作台 + 空间 + 文档”的骨架。

**状态：** 已完成（2026-04-05）

**本轮实际完成：**

- 已新增 `Workbench / Spaces / Documents / Explore / Settings` 五个一级入口
- 首页已替换为 chat-first 的 `WorkbenchShell`，不再以统计卡片作为主入口
- 已新增 `KnowledgeSpaceShell`、`DocumentWorkspaceShell`、`ExploreShell`，把旧页面能力重新挂到新壳层下
- 顶层侧边栏已收束为 icon rail 风格，并默认以窄轨形态启动
- `Search / Chat / Reader / Editor` 已迁移到新壳结构：
  - `Chat` 融入 `Workbench`
  - `Search` 融入 `Explore`
  - `Reader` 融入 `Documents`
  - `Editor` 以 `Draft Lab` 次级标签并入 `Documents`
- 已完成第一轮视觉校准：整体转为 dark-first、工作台导向的视觉语气

**Files:**
- Modify: `src/src/App.tsx`
- Modify: `src/src/components/layout.tsx`
- Create: `src/src/components/shell/workbench-shell.tsx`
- Create: `src/src/components/shell/knowledge-space-shell.tsx`
- Create: `src/src/components/shell/document-workspace-shell.tsx`
- Create: `src/src/store/workspace-store.ts`

- [x] 将一级导航压缩为 `home` / `spaces` / `documents` / `explore` / `settings`
- [x] 首页改为对话主入口，不再以 dashboard stats 为中心
- [x] 引入双层壳结构：窄 icon rail + workspace pane + main canvas
- [x] 重新定义页面跳转逻辑，减少独立页面直达
- [x] 将现有 Search / Chat / Reader / Editor 迁移到新的壳结构下
- [x] 用 dev server 对照参考图做第一轮视觉校准

**验收标准**

- 首页结构接近参考图 1
- 不再以 Dashboard 作为产品主入口
- 导航层级明显收敛

### Phase 2：建立知识库空间模型

**目标：** 让“知识库”从一个路径，升级成一个可浏览、可切换、可进入的空间对象。

**状态：** 已完成（2026-04-05）

**本轮实际完成：**

- 已把 `multi-kb-store.ts` 升级为正式 registry 数据源，支持 collection、lastOpenedAt、缓存 stats 等元数据
- 已新增 [src/src/store/kb-registry-store.ts](/Users/louloulin/Documents/linchong/claw/kb/src/src/store/kb-registry-store.ts) 统一 current KB 与 registered KB 的读取模型
- 已新增空间页拆分组件：
  - [src/src/components/spaces/kb-list-pane.tsx](/Users/louloulin/Documents/linchong/claw/kb/src/src/components/spaces/kb-list-pane.tsx)
  - [src/src/components/spaces/kb-detail-pane.tsx](/Users/louloulin/Documents/linchong/claw/kb/src/src/components/spaces/kb-detail-pane.tsx)
  - [src/src/components/spaces/kb-chat-pane.tsx](/Users/louloulin/Documents/linchong/claw/kb/src/src/components/spaces/kb-chat-pane.tsx)
- `KnowledgeSpaceShell` 现已支持：
  - `personal / created / joined / shared` 分类浏览
  - 注册当前 KB 与自定义本地 KB 路径
  - 选中某个 KB 后展示详情、缓存 stats
  - 选中某个 KB 后在右侧 console 中提问
  - 选中某个 KB 后浏览该空间的文档结果
- 已补做知识空间 registry metadata 编辑 continuation：
  - 可编辑已注册空间的名称
  - 可编辑描述
  - 可在 `created / joined / shared` 之间真实切换分类
  - `joined/shared` lane 不再只是纯展示占位
- 已补做 active knowledge space continuation：
  - `Spaces` 中选中的注册空间会同步为全局 active KB 上下文
  - 回到 `Workbench` 时，mention scope 会自动切到当前 active KB
- 已明确将 Phase 2 限定为“本地 registry + 多 KB 切换”，`joined/shared` 仅作为真实协作能力的占位，不伪造多人数据

**Files:**
- Modify: `src/src/store/multi-kb-store.ts`
- Create: `src/src/store/kb-registry-store.ts`
- Create: `src/src/components/spaces/kb-list-pane.tsx`
- Create: `src/src/components/spaces/kb-detail-pane.tsx`
- Create: `src/src/components/spaces/kb-chat-pane.tsx`
- Modify: `src/src/api/commands.ts`
- Optional Modify: `src-tauri/src/commands/mod.rs`

- [x] 把 `multi-kb-store.ts` 从“隐藏辅助 store”升级为正式 KB registry
- [x] 增加 `personal / shared / created / joined` 分类视图
- [x] 在 UI 上实现知识库列表、详情卡、内容列表、右侧提问区
- [x] 明确第一阶段只做“本地 registry + 多 KB 切换”，不伪造真实多人协作
- [x] 如果需要真实共享/加入语义，单独开协作后端计划，不与本阶段混写

**验收标准**

- 能在 UI 上管理多个 KB 入口
- 能进入“某个 KB 空间”后提问和浏览文档
- 空间页结构接近参考图 2

### Phase 3：重建首页对话工作流

**目标：** 让首页成为真正的 AI 入口，而不是配置页跳板。

**状态：** 已完成（2026-04-05）

**本轮实际完成：**

- 已新增首页组件拆分：
  - `src/src/components/home/home-hero.tsx`
  - `src/src/components/home/home-composer.tsx`
  - `src/src/components/home/home-quick-actions.tsx`
- `WorkbenchShell` 已改成真正的首页工作台，而不是单块大组件
- 首页中心输入区已支持真实状态：
  - `mode`：`Conversation / Research / Context Only`
  - `model`：直接读取并切换 `ai-store` 的 Ask model
  - `mention`：当前 KB / 已注册空间 / 全部已注册空间
  - `attachment`：File / URL / Media / Screenshot，能真实跳转到 `ImportPage` 对应标签
- `ChatPage` 已降级为迁移提示页，明确主聊天能力进入 `Workbench`
- 快捷动作已收束为首页能力：
  - `录音纪要` → `Import` 的 `Media` 标签
  - `文档解读` → `Documents` 的 `Reader Workspace`
  - `智能写作` → `Documents` 的 `Draft Lab`
  - `快速访问` → `Spaces`
- 首页已实现来源预览区，会对最近 assistant 返回的 context 片段做预览
- 已补强 demo/workbench 的 context-only 来源预览回退，首页来源预览在当前 KB 下可稳定出现
- Recent Stream 已展示 `mode / model / mention scope`，模型切换不再只存在于 Settings

**Files:**
- Create: `src/src/components/home/home-hero.tsx`
- Create: `src/src/components/home/home-composer.tsx`
- Create: `src/src/components/home/home-quick-actions.tsx`
- Modify: `src/src/components/pages/chat.tsx`
- Modify: `src/src/store/chat-store.ts`
- Modify: `src/src/store/ai-store.ts`

- [x] 把首页中心改成统一输入框，支持 mode / model / attachment / mention 的 UI 占位与真实状态
- [x] 将 `ChatPage` 的能力下沉为首页能力或空间页能力，而不是独立孤岛
- [x] 把录音纪要 / 文档解读 / 智能写作 / 快速访问做成 quick action，而非多个并列一级页面
- [x] 把模型切换从 Settings-only 搬到对话上下文中
- [x] 为引用来源、上下文预览设计统一交互

**验收标准**

- 首页是可直接发问的工作台
- 输入框和快捷动作接近参考图 1
- Chat 不再是独立孤岛页面

### Phase 4：重建文档工作台

**目标：** 对齐参考图 3，把阅读、编辑、写作、生成整合为一个文档 workspace。

**状态：** 已完成（2026-04-05）

**本轮实际完成：**

- 已新增文档工作台核心结构：
  - `src/src/store/document-workspace-store.ts`
  - `src/src/components/documents/document-list-pane.tsx`
  - `src/src/components/documents/document-tabs.tsx`
  - `src/src/components/documents/document-toolbar.tsx`
- `DocumentWorkspaceShell` 已重写为统一三段式工作台：
  - 左侧文档流
  - 顶部标签页与工具栏
  - 中央统一内容区
- `Reader / Draft / Notes / Report / Podcast` 已收束到同一工作台内，不再依赖页面之间来回跳转
- `EditorPage` 已支持工作台嵌入模式，并完成：
  - 基于当前选中文档加载标题与内容
  - `Save Draft to KB` 真实持久化到知识库
  - `AI Assist` 改为真实调用 `api.aiAsk(...)`，不再返回 mock 文案
- `NotesPage` 已支持嵌入模式并用当前文档内容预填
- `ReportPage` 已支持嵌入模式和预选文档
- `PodcastPage` 已支持嵌入模式，并用当前文档标题/内容作为播客脚本起点
- 工作台工具栏已把“继续草稿 / 记录笔记 / 生成报告 / 播客脚本 / 保存草稿”统一成文档动作

**Files:**
- Modify: `src/src/components/pages/reader.tsx`
- Modify: `src/src/components/pages/editor.tsx`
- Modify: `src/src/components/pages/notes.tsx`
- Modify: `src/src/components/pages/report.tsx`
- Modify: `src/src/components/pages/podcast.tsx`
- Create: `src/src/components/documents/document-list-pane.tsx`
- Create: `src/src/components/documents/document-tabs.tsx`
- Create: `src/src/components/documents/document-toolbar.tsx`
- Create: `src/src/store/document-workspace-store.ts`

- [x] 把 Reader / Editor / Notes / Report / Podcast 收束到同一工作台
- [x] Editor 需要接真实文档加载、保存、版本/来源，不允许继续停留在本地临时 state
- [x] 把 AI Assist 从 mock 改为真实调用链
- [x] 把“摘要 / 续写 / 改写 / 报告生成 / 播客脚本”统一为文档动作
- [x] 引入文档标签页和左侧文档流，不再让用户在页面之间来回跳

**验收标准**

- 文档工作台结构接近参考图 3
- 编辑器具备真实持久化
- AI assist 不再是 mock

### Phase 5：清理伪实现并接通真实能力

**目标：** 把当前最危险的“假实现”清掉。

**状态：** 已完成（2026-04-05）

**本轮实际完成：**

- `EntitiesPage` 已改为真实图谱页：
  - 基于 `api.listEntities()` 拉实体
  - 基于 `api.getEntityEdges()` 拉关系
  - 基于 `api.searchWithGraph()` 拉图谱上下文文档
- `SearchPage` 的批量标签行为已改为真实更新文档标签，不再通过 `addNote(...[updated])` 复制新文档
- 已新增 `set_document_tags` 命令并在前端 `api.setDocumentTags()` 中接通
- `FolderTree` 已重新启用，不再显示“Folders hidden for now”占位
- `folder-store` 已改为真实 API 驱动，不再以自身 localStorage 作为主数据源
- `Folder` 后端能力已接通：
  - `list_folders`
  - `create_folder`
  - `rename_folder`
  - `delete_folder`
  - `move_document`
  - `search_in_folder`
- KB 内的 folder metadata 已改为真实持久化标签/元数据帧，不再是 Tauri command 里的静态 demo 列表
- 浏览器模式下的 folder 行为也已改为本地持久化，不再使用写死 demo folders
- `ExploreShell` 已重新加入 `Entities` 标签页入口

**Files:**
- Modify: `src/src/components/pages/entities.tsx`
- Modify: `src/src/components/pages/search.tsx`
- Modify: `src/src/components/folder-tree.tsx`
- Modify: `src/src/store/folder-store.ts`
- Modify: `src-tauri/src/commands/mod.rs`

- [x] `EntitiesPage` 改用真实 `listEntities/getEntityEdges`，不再用 timeline 正则抽词
- [x] Search 的批量标签行为改为“更新现有文档标签”，不能再复制新 note
- [x] Folder tree 需要真实 folder metadata 存储与搜索过滤，去掉 demo folders
- [x] 对未准备好的功能明确降级或隐藏，不再“看起来像能用”

**验收标准**

- entities / folders / batch tag 都基于真实数据行为
- 页面不再依赖明显的 demo stub

### Phase 6：视觉统一、验证与收口

**目标：** 让产品从“能跑”变成“像一个产品”。

**状态：** 已完成（2026-04-06）

**本轮实际完成：**

- 已新增 `src/src/styles/tokens.css` 与 `src/src/styles/workbench.css`，为工作台壳层提供统一视觉 token 与 surface class
- `index.css` 已引入新 styles，核心 UI 控件已统一圆角、表面层级与 dark-first 语气：
  - `src/src/components/ui/button.tsx`
  - `src/src/components/ui/tabs.tsx`
  - `src/src/components/ui/select.tsx`
- 已补做 Phase 6 延续收口：
  - `App.tsx`、`ExploreShell`、`DocumentWorkspaceShell` 改为页面级懒加载
  - 前端构建产物已拆分为多 chunk，最大的 JS chunk 已降到 500KB 告警阈值以内
  - Rust/Tauri 侧编译 warning 已进一步清理为 0
- 顶层壳层与主要 workspace 已切到统一视觉语言：
  - `layout.tsx`
  - `workbench-shell.tsx`
  - `knowledge-space-shell.tsx`
  - `document-workspace-shell.tsx`
  - `explore-shell.tsx`
- 浏览器 demo 模式下的导入链路已补强，导入文件/目录/网页后可进入 demo KB 继续搜索或提问
- 已产出当前产品基线截图：
  - `docs/ui-baseline/workbench-home.png`
  - `docs/ui-baseline/spaces-registry.png`
  - `docs/ui-baseline/document-workspace.png`
- 已新增基线文档：
  - `docs/ui-baseline/README.md`
  - `docs/ui-baseline/verification.md`
- 历史顶层探索截图已统一归档到 `docs/ui-baseline/archive/`，避免仓库继续混放多套命名和阶段产物
- 已完成并记录关键流程验证：
  - 打开 KB
  - 搜索并打开文档
  - 在 KB 空间提问
  - 导入文件并继续提问
  - 打开文档并编辑保存

**Files:**
- Modify: `src/src/index.css`
- Modify: `src/src/components/layout.tsx`
- Modify: `src/src/components/ui/*`
- Create: `src/src/styles/tokens.css`
- Create: `src/src/styles/workbench.css`

- [x] 统一 dark-first 视觉主题、层级、间距、圆角、输入框规范
- [x] 为首页、空间页、文档页各出一版稳定截图
- [x] 增加最少量的关键流程验证：
  - 打开 KB
  - 搜索并打开文档
  - 在 KB 空间提问
  - 导入文件并继续提问
  - 打开文档并编辑保存
- [x] 清理历史命名漂移和无效截图资产，保留最新设计基线

**验收标准**

- UI 视觉方向统一
- 三条主工作流全通
- 仓库中只有一套当前产品叙事

## 七、优先级建议

### P0

- Phase 0 工程恢复
- Phase 1 产品壳层重构

### P1

- Phase 2 知识库空间模型
- Phase 3 首页对话工作流

### P2

- Phase 4 文档工作台
- Phase 5 伪实现清理

### P3

- Phase 6 视觉统一与验证
- 真正的多人协作 / 共享知识库服务端方案

## 八、最终判断

这套仓库**不是没东西**，而是“后端能力不少，前端产品形态跑偏，工程事实源失真”。真正应该做的是：

- **保后端，重前端壳层**
- **先修事实层，再做产品层**
- **先收敛主工作流，再决定哪些高级能力保留为二级能力**

如果按这个方向推进，当前仓库最有价值的资产是：

- Rust `clawkb-core`
- Tauri 命令层
- Reader / Import / Graph / Tags 等已有组件资产

当前最需要立刻停止扩散的，是：

- 页面继续横向增长
- demo/stub 长期冒充真实能力
- 文档和代码状态继续脱节

这个项目接下来最正确的路线不是“补几个页面”，而是**做一次产品结构和工程结构同步重构**。
