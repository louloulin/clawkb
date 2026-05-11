# ClawKB 3.0 — 全面功能分析、Obsidian 1.12.7 对标差距与改造计划

> 分析日期：2026-05-11  
> 对标基线：Obsidian Desktop `1.12.7`（官方 changelog 日期为 `2026-03-23`，本机已观察到窗口标题为 `Obsidian 1.12.7`）  
> 分析对象：当前仓库 `/Users/louloulin/Documents/linchong/claw/kb` 对应的本地优先 AI 笔记/知识库产品（ClawKB）

---

## 0. 结论先行

这不是一个“功能很少”的产品，恰恰相反：**当前仓库已经拥有相当多的能力碎片**，包括：

- 本地 KB 打开/创建
- 导入文件、目录、URL、截图、图片、音频
- 搜索 / Ask / Ask with context
- Reader / Editor / Notes / Timeline / Tags / Entities / Graph / Report / Podcast
- 双链补全、反链、出链、局部图谱
- Daily Notes
- 命令面板
- Obsidian Vault 导入入口
- WebDAV 同步设置入口
- 模板、书签、高亮、阅读进度、草稿恢复
- 块级编辑预埋（block id / block reference / slash command / callout / mermaid / task list）

但问题也同样明确：

**它距离 Obsidian 1.12.7 的差距，不主要在“有没有页面”，而在下面五件事：**

1. **文件模型不对等**：Obsidian 以真实文件系统 Vault 为中心，ClawKB 以 `.mv2` 知识库与内部记录为中心；这带来可移植性、插件性、生态兼容、透明度上的系统差距。
2. **主工作流没有收口**：已有大量功能，但用户的主链路仍然不够稳定清晰，尤其是“导入 → 搜索/问答 → 阅读 → 沉淀为笔记 → 再检索”的闭环。
3. **编辑体验已进入 60 分，但还没到 90 分**：编辑器里已经预埋了很多 Obsidian/Notion/Logseq 风格能力，但整体还没形成成熟、一致、稳定、可预期的写作体验。
4. **“组件存在”不等于“产品能力成立”**：白板、内联数据库、看板、模板管理等组件存在，但并未成为主流程中的一等能力。
5. **生态层差距极大**：主题、社区插件、公开格式、CLI/自动化、跨设备同步成熟度、公开发布能力，这些是 Obsidian 的结构性优势，当前 ClawKB 基本未建立可对抗方案。

**一句话判断：**

> 当前 ClawKB 更像“本地优先 AI 知识工作台原型 + 若干高级页面集合”，而不是“已经达到 Obsidian 完整度的 AI 笔记产品”。

但它也有明确机会：

> 如果 3.0 版本把“AI + 本地知识库 + 阅读沉淀闭环”打穿，而不是继续平铺更多页面，它有机会做出 **不同于 Obsidian 的 AI-first 本地知识工作台**，而不是永远当 Obsidian 的低配替代。

---

## 1. 证据来源与分析方法

### 1.1 本仓库证据

本次结论基于以下事实来源：

- 产品说明：`/Users/louloulin/Documents/linchong/claw/kb/src/README.md`
- 定位文档：`/Users/louloulin/Documents/linchong/claw/kb/docs/product-positioning.md`
- 既有方案：`/Users/louloulin/Documents/linchong/claw/kb/plan3.md`
- 前端入口与壳层：`/Users/louloulin/Documents/linchong/claw/kb/src/src/App.tsx`
- 桌面命令桥：`/Users/louloulin/Documents/linchong/claw/kb/src/src/api/commands.ts`
- 页面实现：`/Users/louloulin/Documents/linchong/claw/kb/src/src/components/pages/*.tsx`
- 壳层实现：`/Users/louloulin/Documents/linchong/claw/kb/src/src/components/shell/*.tsx`
- 关键 UI 组件：
  - `.../src/src/components/ui/local-graph.tsx`
  - `.../src/src/components/ui/backlinks-panel.tsx`
  - `.../src/src/components/ui/outlinks-panel.tsx`
  - `.../src/src/components/ui/whiteboard.tsx`
  - `.../src/src/components/ui/inline-database.tsx`
  - `.../src/src/components/ui/kanban-view.tsx`
  - `.../src/src/components/ui/template-manager.tsx`
  - `.../src/src/components/ui/block-extensions.tsx`
  - `.../src/src/components/ui/wikilink-autocomplete.tsx`
- 状态层：
  - `.../src/src/store/kb-store.ts`
  - `.../src/src/store/workspace-store.ts`
  - `.../src/src/store/document-workspace-store.ts`
  - `.../src/src/store/bookmark-store.ts`
  - `.../src/src/store/template-store.ts`
  - `.../src/src/store/sync-store.ts`
  - `.../src/src/store/multi-kb-store.ts`
- 测试用例：`/Users/louloulin/Documents/linchong/claw/kb/src/src/__tests__/*`

### 1.2 外部官方基线

对标基线仅采用 Obsidian 官方资料：

- Changelog: <https://obsidian.md/changelog/>
- Core plugins 列表: <https://obsidian.md/help/plugins>
- Backlinks: <https://obsidian.md/help/Plugins/Backlinks>
- Graph view: <https://obsidian.md/help/Plugins/Graph%2Bview>
- Canvas: <https://obsidian.md/help/Plugins/Canvas>
- Bookmarks: <https://obsidian.md/help/Plugins/Bookmarks>
- Page preview: <https://obsidian.md/help/Plugins/Page%2Bpreview>
- Properties view: <https://obsidian.md/help/Plugins/Properties%2Bview>
- Workspaces: <https://obsidian.md/help/Plugins/Workspaces>
- Daily notes: <https://obsidian.md/help/Plugins/Daily%2Bnotes>
- Command palette: <https://obsidian.md/help/Plugins/Command%2Bpalette>
- Community plugins: <https://obsidian.md/help/Extending%2BObsidian/Community%2Bplugins>
- Obsidian Sync: <https://obsidian.md/help/Obsidian%2BSync/Introduction%2Bto%2BObsidian%2BSync>
- Obsidian Publish: <https://obsidian.md/help/Obsidian%2BPublish/Introduction%2Bto%2BObsidian%2BPublish>
- Accepted file formats: <https://help.obsidian.md/file-formats>

### 1.3 桌面观察

- 已通过桌面工具观察到本机运行中的 Obsidian 窗口标题：`未命名 - lumosnote - Obsidian 1.12.7`
- 已通过浏览器验证当前前端预览态只显示 runtime guard，而非真实知识库 UI

### 1.4 重要分析原则

本文严格区分四种状态：

- **已成立**：主流程可见、代码闭环清晰、能形成用户价值
- **半成立**：有主界面或 API，但体验不完整或依赖回退实现
- **组件预埋**：代码里有组件/扩展，但没有成为产品能力
- **缺失**：仓库中不存在明确实现路径

---

## 2. Obsidian 1.12.7 的真实产品基线

结合官方 help/changelog，本次对标时将 Obsidian 1.12.7 理解为以下几层能力的组合，而不是单一“Markdown 编辑器”：

### 2.1 核心底座

- 文件系统为中心的 Vault
- 原生支持 `.md`、`.canvas`、`.base`、图片、音视频、PDF 等格式
- 本地优先
- 强大的内部链接与关系建模

### 2.2 核心插件层（官方内建）

官方 Core plugins 页面列出的核心能力包括：

- Backlinks
- Bases
- Bookmarks
- Canvas
- Command palette
- Daily notes
- File explorer
- File recovery
- Graph view
- Outgoing links
- Outline
- Page preview
- Properties view
- Publish
- Quick switcher
- Search
- Slash commands
- Sync
- Tags view
- Templates
- Workspaces
- 以及若干辅助插件

### 2.3 生态层

- Community plugins：安装、启用、更新、卸载、命令/设置集成
- Themes：主题生态
- Publish：把笔记直接发布为站点
- Sync：跨设备同步与选择性同步
- CLI / Headless / automation（在 1.12 线已有明显增强）

### 2.4 1.12.7 版本点说明

Obsidian 官方 changelog 中，`1.12.7 Desktop` 发布日期是 `2026-03-23`。该版本本身更像是 1.12 主线上的迭代修复版本，而不是功能范式切换版本。  
也就是说，本次对标不是拿“某个新奇 beta 特性”对标，而是在对标一个**已经高度成熟、稳定、系统化**的桌面知识工作产品。

---

## 3. 当前 ClawKB 的真实能力画像

### 3.1 当前不是“纯笔记软件”

从 `src/README.md` 与 `docs/product-positioning.md` 可以明确看出，ClawKB 的定位已经不是 Obsidian 那种广义 PKM 平台，而是：

- local-first
- single-user
- AI-first ask/read/write
- 本地知识工作台

这意味着它天生有两条路线可走：

1. **变成更像 Obsidian 的通用 PKM 工具**
2. **变成比 Obsidian 更聚焦的 AI-first 本地知识工作台**

当前仓库处于两条路之间：

- 底层与导入检索更像 AI RAG 工作台
- 编辑器、双链、图谱、日记等又明显在向笔记产品演化

### 3.2 当前能力地图

按现有代码，ClawKB 的能力可以整理为：

#### A. KB / 导入 / 检索

- 创建 / 打开 / 关闭 KB
- 搜索（`lex` / `hybrid`）
- Ask / Ask with context / Ask document
- 导入文件、目录、URL
- 导入音频、图片
- OCR / 截图入口（桌面 runtime）
- 导出

#### B. 笔记与阅读

- Note CRUD
- Reader 页面
- Editor 页面
- Notes 页面
- Draft 保存回 KB
- 书签、高亮、阅读进度
- PDF 阅读与选区问答

#### C. 知识关系

- Wikilink 自动补全
- Backlinks
- Outlinks
- Outline
- Local Graph
- Timeline
- Tags
- Entities

#### D. AI / 衍生生成

- Workbench Ask
- 报告生成
- 播客脚本生成
- 选区 AI
- 编辑器 AI 命令（继续写作、改善表达、精简、展开、修正）

#### E. 组织与扩展性尝试

- 模板管理
- Daily Note 快捷入口
- 命令面板
- 多 KB 注册与切换
- WebDAV 配置
- Obsidian Vault 导入

#### F. 预埋但未产品化的高阶组件

- Block ID / Block Reference
- Slash commands
- Callout / Mermaid / TaskList / Table / Image
- Whiteboard
- Inline Database
- Kanban

### 3.3 当前最大的优点

当前仓库最有价值的地方不是“某个单一页面做得很好”，而是：

- 已经形成了一个本地 AI 知识产品的雏形
- 编辑、阅读、检索、问答、导入并不是完全割裂的
- 很多高级能力已经有代码资产，不是从零开始

### 3.4 当前最大的短板

最大短板也很清楚：

- 主路径没统一
- 产品层面缺少“能力分级”
- 许多能力只到“演示可见”或“组件可见”，未到“日常可用”
- 与 Obsidian 的开放生态差距巨大

---

## 4. 总体对标判断：不是“功能数量差距”，而是“系统成熟度差距”

下面先给总矩阵，再逐项拆开。

### 4.1 总矩阵

| 维度 | Obsidian 1.12.7 | ClawKB 当前 | 判断 |
|---|---|---|---|
| 本地优先 | 强 | 强 | 接近 |
| 文件透明度 | 极强（真实文件系统） | 弱（`.mv2` 封装） | 明显落后 |
| Markdown/Vault 生态兼容 | 极强 | 中（支持导入，不是原生模型） | 落后 |
| 编辑器成熟度 | 高 | 中上 | 落后 |
| 双链/反链/关系 | 高 | 中上 | 接近但未成熟 |
| 图谱 | 高 | 中 | 落后 |
| Canvas/白板 | 高 | 低（组件预埋） | 明显落后 |
| Properties/Bases | 高 | 低到中（零散） | 明显落后 |
| 命令系统 | 高 | 中 | 部分接近 |
| 模板/日记/书签 | 高 | 中 | 部分接近 |
| 搜索体验 | 高 | 中上 | 接近但需打磨 |
| 阅读/PDF | 中上 | 中上 | 有特色但未形成优势 |
| AI 原生能力 | 弱到中 | 强 | ClawKB 领先 |
| 插件生态 | 极强 | 基本没有 | 结构性落后 |
| 主题生态 | 强 | 弱 | 落后 |
| 跨设备同步 | 高 | 低到中 | 落后 |
| 发布能力 | 高 | 缺失 | 明显落后 |
| 工作区布局恢复 | 高 | 中 | 落后 |
| 稳定性/产品完成度 | 很高 | 中 | 落后 |

**关键结论：**

- 如果对标“AI-first 本地知识问答工作台”，ClawKB 已经有差异化机会。  
- 如果对标“成熟的一般型 PKM 桌面平台”，ClawKB 还处于 **1.0~1.5 代产品状态**。

### 4.2 复核观察补充（电脑 + 浏览器）

本轮复核增加两条直接观察证据：

```text
Desktop observation
└─ Obsidian window title: 未命名 - lumosnote - Obsidian 1.12.7

Browser observation
└─ ClawKB localhost preview:
   ├─ Preview Only
   ├─ Desktop runtime required
   ├─ Browser preview only supports runtime messaging / visual QA
   └─ Opening/creating KB, import, search, OCR, sync require Tauri desktop runtime
```

这说明对比必须区分：

- **Obsidian 观察对象**：真实桌面运行态，文件树、编辑器、右侧面板、插件入口均可见。
- **ClawKB 浏览器观察对象**：不是完整产品态，而是 runtime guard；真实 KB 工作只能通过 Tauri 桌面态验证。
- **ClawKB 代码观察对象**：目前最可靠的功能判断仍来自源码、测试、README 与现有计划文档。

因此本文对 ClawKB 的判断不是“浏览器页面没有功能”，而是：**浏览器态主动禁用了真实 KB 功能；产品真实能力存在于桌面 runtime + Tauri command bridge + React 页面代码中。**

### 4.3 Obsidian Core Plugins 逐项能力矩阵

下表把 Obsidian 1.12.7 常见核心插件/内建能力，与 ClawKB 当前代码资产逐项对照。状态定义：

- **已成立**：用户主流程中可见且有明确闭环
- **半成立**：有 UI/API，但体验、稳定性或闭环不足
- **预埋**：有组件/代码资产，但未产品化或未接入主流程
- **缺失**：未见明确实现

| Obsidian 能力 | Obsidian 1.12.7 表现 | ClawKB 当前状态 | 差距等级 | 3.0 处理建议 |
|---|---|---|---|---|
| File explorer | Vault 文件树是一等入口 | 有 folder/tree/space，但心智不统一 | A | 统一 Library Tree |
| Search | 全库搜索成熟 | 搜索 + hybrid/lex + AI 问答 | B | 增加结果动作协议 |
| Quick switcher | 高频打开笔记入口 | Cmd/Ctrl+O 进入命令面板 | B | 区分 Quick Open 与 Command |
| Command palette | 全局命令系统 | 有命令面板 | B | 统一命令注册模型 |
| Backlinks | 核心反链体验 | Reader/Editor 已接入反链面板 | B | 增加 hover/context preview |
| Outgoing links | 出链面板 | 已有 outlinks panel | B | 与 Reader/Editor/Search 打通 |
| Graph view | 全局/局部图谱成熟 | 有 graph/local graph，偏基础 | A | filters/groups/depth/presets |
| Tags view | 标签聚合成熟 | Tags 页面 + tagCounts | B | 纳入统一属性系统 |
| Outline | 文档大纲成熟 | Reader/Editor 均有 outline | B | 与标题跳转/折叠联动 |
| Page preview | Hover 预览高频 | 未见成熟主流程 | A | 作为链接体验 P1 |
| Daily notes | 日期笔记 + 模板 | 已有快捷创建 | B | 升级 Periodic Notes |
| Templates | 模板核心插件 | 有 TemplateManager | B | 模板路径/变量/周期化 |
| Bookmarks | 收藏笔记/标题/搜索 | Reader 有书签/进度 store | B | 统一 Saved Items |
| File recovery | 快照恢复 | 有恢复/备份文档，产品化不足 | A | 本地快照与恢复 UI |
| Workspaces | 保存布局 | 有隐式状态持久化 | A | 正式 Workspace Presets |
| Properties view | 文件属性系统 | 标签/实体/元数据零散 | S | 建立统一 properties schema |
| Bases | 基于属性的数据视图 | inline database 组件预埋 | S | Phase 3 做 saved views |
| Canvas | 正式无限画布 | whiteboard 组件预埋 | S | Labs，兼容 JSON Canvas |
| Slash commands | 编辑器内命令 | editor 有 slash defs | C | 产品化插入系统 |
| Sync | 官方同步服务 | WebDAV 配置入口 | A+ | 先备份后双向同步 |
| Publish | 官方发布站点 | 导出有，发布缺失 | S | 暂放后期 |
| Community plugins | 生态护城河 | 无插件 SDK/市场 | SS | 做轻扩展，不复制生态 |
| Themes | 主题生态 | 有暗色/样式 tokens，生态弱 | A | 主题 tokens + preset |
| File formats | `.md/.canvas/.base` 等公开格式 | `.mv2` 为主，导入兼容 | S | 双层存储：Vault-visible + MV2 index |
| AI workflows | 非原生核心 | Ask/Reader/Editor/Report/Podcast | ClawKB 领先 | 做成差异化主线 |

这张表进一步说明：ClawKB 已经在 **AI、导入检索、阅读沉淀** 上拥有差异化资产，但在 **公开文件模型、Properties/Bases、Canvas、插件生态、同步发布、布局恢复** 上距离 Obsidian 仍有明显差距。

---

## 5. 一项一项功能对比分析

下面按照用户真实感知顺序，而不是按代码文件顺序来分析。

---

## 5.1 知识库 / Vault 模型

### Obsidian

- 以真实文件夹（Vault）作为知识库
- 文件、文件夹、附件都直接可见
- 用户可以用任何工具访问自己的内容
- 与 Git、云盘、脚本、外部编辑器天然兼容

### ClawKB 当前

- 以 `.mv2` 作为主知识库容器
- UI 与命令围绕“openKb/createKb/search/addNote/updateNote”运转
- 支持导入 Obsidian Vault，但不是原生以 Vault 为中心工作

### 差距判断

**差距级别：S 级（结构性差距）**

这不是一个小交互问题，而是整个产品模型不同：

- Obsidian 的用户拥有“可见文件系统 + 开放格式”的安全感
- ClawKB 的用户拥有“本地单文件知识库 + 检索能力”的效率感

两者各有优点，但如果 ClawKB 要对标 Obsidian，必须解决三个顾虑：

1. 我的内容是否可迁移？
2. 我的内容是否可审计？
3. 我的内容是否可被外部工具访问？

### 改造建议

- 3.0 不必放弃 `.mv2`
- 但必须新增 **双存储战略**：
  - A 路：保持 `.mv2` 作为高性能 AI 索引仓
  - B 路：增加 `Vault-compatible workspace` 作为用户源数据层
- 最终形态应是：
  - 用户源内容可见、可导出、可同步
  - `.mv2` 作为 AI 加速层，而不是唯一真相源

---

## 5.2 文件浏览 / 文件树 / 空间组织

### Obsidian

- 文件树是绝对一等入口
- 文件夹、文件、附件、拖拽移动、右键操作非常成熟
- 与链接、搜索、预览、工作区联动

### ClawKB 当前

- 有 folder / multi-kb / spaces 概念
- 有 `folder-store`、`kb-registry-store`、`multi-kb-store`
- 有 `listFolders/createFolder/renameFolder/deleteFolder/moveDocumentToFolder`
- 但产品主界面的中心仍不是“文件树作为操作枢纽”

### 差距判断

**差距级别：A 级**

问题不在“没有文件夹 API”，而在：

- 组织模型没有成为用户心智主轴
- Spaces / KB / Documents / Explore / Workbench 多壳层并存，造成感知不统一
- 入口层次不如 Obsidian 明快

### 改造建议

- 3.0 应将组织层统一为：
  - `Knowledge Spaces`（知识库级）
  - `Library Tree`（文档/笔记/文件夹级）
- 删除“多个近义入口”的混乱感
- 将“树 + 搜索 + 最近打开 + 收藏”收成同一信息架构

---

## 5.3 编辑器（核心写作体验）

### Obsidian

- Markdown / Live Preview / Reading View 非常成熟
- 链接、嵌入、列表、任务、Callout、Properties、块级导航流畅
- 快捷键体系、命令体系、光标行为、链接行为都极稳定

### ClawKB 当前

从 `editor.tsx`、`block-extensions.tsx`、`wikilink-autocomplete.tsx` 看，已经具备：

- TipTap 编辑器底座
- Heading / List / OrderedList / TaskList / CodeBlock / Quote
- Image / Table / Mermaid / Callout
- Wikilink 自动补全
- Block ID
- Block Reference
- Slash commands
- Outline panel
- AI 写作命令
- Local Graph / Backlinks 侧栏
- 模板管理器

### 差距判断

**差距级别：A 级，但潜力很高**

当前编辑器的问题不是“能力太少”，而是：

1. **稳定与一致性不足**  
   代码能看出很多增强是近似“叠加式接入”，尚未证明交互细节已经统一。

2. **存储模型与编辑模型并不完全对齐**  
   `NotesPage` 使用 `RichEditor` 输出 HTML，而不是 Obsidian 的 Markdown-first 模型；这会影响：
   - 可移植性
   - 外部兼容性
   - 差异比较
   - 长期可维护性

3. **块能力更多是技术预埋，未完全成为产品心智**  
   有 BlockId / BlockReference / SlashCommand，不代表用户已经真正得到“块工作流”。

### 改造建议

- 短期：继续保留 TipTap
- 中期：统一成 **Markdown-compatible block editor**
- 明确 3 层结构：

```text
存储层：Markdown / frontmatter / attachments / refs
编辑层：TipTap block model
知识层：索引 / backlinks / graph / AI context
```

- 不要再同时保留多个编辑模型（HTML 富文本 / Markdown 视图 / 草稿拼装）长期并存

---

## 5.4 双链、反链、出链、局部图谱

### Obsidian

- `[[ ]]` 内链是核心语法
- Backlinks 是成熟核心插件
- Outgoing links、Page preview、Local graph 构成强联动
- Hover preview 是高频体验点

### ClawKB 当前

已实现或部分实现：

- `[[ ]]` 自动补全：`wikilink-autocomplete.tsx`
- 反链：`backlinks-panel.tsx`
- 出链：`outlinks-panel.tsx`
- 局部图谱：`local-graph.tsx`
- Reader / Editor 均接入相关面板

### 差距判断

**差距级别：B+ 级**

这是当前产品最接近 Obsidian 的一组能力之一。  
但仍有关键差距：

- 缺少成熟的 hover preview 主流程体验
- 双链相关能力没有成为全局统一交互语言
- 局部图谱与主搜索、文件树、标签、实体没有强联动
- Unlinked mentions 等高级关联能力未见成熟产品化

### 改造建议

- 把“链接体验”提升为 3.0 一等主题
- 建立统一交互：
  - hover preview
  - cmd+click 打开
  - split open
  - quick backlink preview
  - link mention suggestions
- 把 Reader / Editor / Search / Graph 用同一链接语义打通

---

## 5.5 Graph View（全局图谱）

### Obsidian

官方 Graph view 具备：

- 全局图谱
- Local graph
- 过滤器
- 按标签/附件/孤点/已存在文件过滤
- Group 配色
- 方向、大小、厚度、力学参数
- Time-lapse
- Local depth

### ClawKB 当前

- 有 `graph.tsx` 页面
- 有 `local-graph.tsx`
- 当前形态更像基础 D3 力导向图
- 已有实体图 / 图谱相关 API，但 UI 整合度有限

### 差距判断

**差距级别：A 级**

不是“没有图谱”，而是“图谱还是工具页，不是系统能力”。

当前弱点通常会体现在：

- 筛选与分组不足
- 节点语义不够丰富
- 与标签 / 文件夹 / 文档类型 / 时间维度联动不深
- 性能与大库可用性未知
- 图谱对用户日常工作价值尚未被锚定

### 改造建议

- 不要只继续做“更炫的力导图”
- 3.0 要把图谱分成三层：

```text
Graph A：链接图（notes ↔ notes）
Graph B：知识图（notes ↔ tags ↔ entities ↔ sources）
Graph C：工作图（notes ↔ drafts ↔ reports ↔ tasks）
```

- 默认只展示对当前文档/查询有帮助的视图
- 把“大图谱”从炫技页变成分析工具

---

## 5.6 Canvas / Whiteboard

### Obsidian

Canvas 是正式核心插件：

- 无限画布
- 文本卡片 / 笔记卡片 / 媒体卡片 / 网页卡片 / 文件夹卡片
- 连接线
- 分组
- `.canvas` / JSON Canvas 开放格式
- 与 Vault 内容双向联动

### ClawKB 当前

- 有 `whiteboard.tsx` 组件
- 但代码检索表明：**它目前没有接入主页面或主流程**
- 更像组件资产，而不是产品能力

### 差距判断

**差距级别：S- 级**

这是“有组件”和“有产品”的典型区别：

- Obsidian Canvas 是用户心智中的正式能力
- ClawKB Whiteboard 目前还是预埋实现

### 改造建议

- 3.0 若要做白板，不应只是“把组件挂上去”
- 必须定义清楚它解决什么问题：
  - 研究梳理
  - 阅读摘录拼接
  - 任务/论点/证据排布
  - AI 生成结构化知识画布
- 建议直接采用或兼容 `JSON Canvas`
- 让白板中的卡片可以引用：
  - note
  - source fragment
  - quote
  - AI answer
  - task

---

## 5.7 Properties / Metadata / Bases

### Obsidian

- Properties view 是正式核心插件
- 文件属性与全库属性有统一视图
- Bases 进一步把属性驱动的数据视图做成一等能力

### ClawKB 当前

- 有 tags、folders、entities、timeline
- 有 `inline-database.tsx` 组件
- 有模板与部分结构化信息
- 但没有形成统一“属性系统”

### 差距判断

**差距级别：S- 级**

这是当前 ClawKB 最大的产品缺环之一。  
如果没有统一属性模型，那么：

- 笔记只是文本块
- 标签只是标签
- 时间线只是时间线
- 数据库只是组件
- AI 也很难稳定建立结构化上下文

### 改造建议

必须在 3.0 定义统一属性层：

```text
Note
 ├─ system fields: id, title, created_at, updated_at, source, type
 ├─ link fields: backlinks, outlinks, mentions
 ├─ semantic fields: tags, entities, topics
 ├─ workflow fields: status, priority, due, owner?, stage
 └─ custom properties: arbitrary key-value / typed schema
```

在这之上再建立：

- File properties panel
- All properties registry
- Saved views / bases
- Filter / sort / group UI
- AI 可利用的结构化字段

---

## 5.8 Search / Quick Switcher / Command Palette

### Obsidian

- Search 很强
- Quick switcher 很高频
- Command palette 是命令系统总入口
- Fuzzy matching、pin、热键成熟

### ClawKB 当前

- 有搜索页面
- 有 `Cmd/Ctrl+K` 与 `Cmd/Ctrl+P`
- `App.tsx` 中已有 Obsidian-style quick-open 注释
- 有命令面板组件

### 差距判断

**差距级别：B 级**

这部分已经有基础，但还没有达到 Obsidian 那种“熟练用户几乎只靠键盘”的成熟度。

问题主要会在：

- 命令体系是否完整
- 搜索是否一处可达全部对象
- 结果操作是否一跳完成（open / split / pin / copy link / reveal in tree）
- quick switcher 与 search 的边界是否清楚

### 改造建议

把命令系统分成三层：

- `Quick Open`：找笔记 / 文档 / 最近项
- `Command Palette`：执行命令
- `Universal Search`：搜内容 / 标签 / 实体 / 时间 / 属性 / AI 历史

并统一一个结果动作协议：

```text
Enter      -> open
Cmd+Enter  -> open in split
Alt+Enter  -> preview
Shift+Enter-> insert link / cite
```

---

## 5.9 Daily Notes / 模板 / 习惯性记录

### Obsidian

- Daily notes 是成熟核心插件
- 支持模板、路径规则、日期格式
- 与 Properties、Command palette、Hotkeys 紧密联动

### ClawKB 当前

- `App.tsx` 与 `workbench-shell.tsx` 中均有 Daily Note 入口
- 可搜索同名日记，若不存在则创建
- 有模板管理器

### 差距判断

**差距级别：B 级**

Daily Note 已经成立，但还没系统化。

可能存在的问题：

- 日记只是“一个快捷新建动作”
- 与任务、时间线、模板、属性、复盘没有做深联动
- 缺少周记 / 月记 / 周期回顾工作流

### 改造建议

- 把 Daily Notes 升级为 `Periodic Notes System`
- 打通：
  - daily / weekly / monthly
  - tasks / habits / highlights / imported sources
  - AI daily summary / end-of-day review

---

## 5.10 Bookmarks / 阅读进度 / 稍后再看

### Obsidian

- Bookmarks 是正式核心插件
- 可收藏笔记、标题、搜索等
- 有分组与侧栏访问

### ClawKB 当前

- `bookmark-store.ts` 存在
- Reader 接入了书签、高亮、阅读进度
- 这意味着在“阅读型工作台”方向上已经有潜力

### 差距判断

**差距级别：B 级**

这里的优势是：ClawKB 的阅读场景可能比 Obsidian 更有机会做得深。  
但前提是它不能停留在“本地 store 里能记住一些 bookmark/highlight”。

### 改造建议

- 收藏系统应升级为统一 `Saved Items`：
  - note
  - heading
  - search query
  - source fragment
  - AI answer
  - report draft
- 统一入口：Sidebar / Command / Reader / Search results

---

## 5.11 Reader / PDF / 高亮 / 注释

### Obsidian

- 原生阅读体验不错
- PDF 能打开，但专业标注通常更多借助插件生态

### ClawKB 当前

Reader 已经具备一组很有潜力的能力：

- 文档阅读
- PDF 翻页 / 缩放
- 选区问答
- 高亮
- 注释
- 书签
- 阅读进度
- Outline / Backlinks / Outlinks / LocalGraph 侧栏联动

### 差距判断

**差距级别：B- 级，且是潜在超车点**

这部分并不一定需要“完全像 Obsidian”。  
相反，ClawKB 完全可以把它做成自己的优势：

> Obsidian 更像笔记中心，ClawKB 可以变成“资料阅读与沉淀中心”。

### 改造建议

- 把 Reader 提升为第一主战场
- 明确 Reader 的核心任务：
  - 打开资料
  - 看清上下文
  - 做摘录/高亮
  - 选区提问
  - 保存为笔记/卡片/证据
- 让 Reader 成为 AI 与知识沉淀交汇点

---

## 5.12 Tags / Entities / Timeline

### Obsidian

- Tags view 是核心插件
- 但实体图谱、时间线通常依赖插件或用户自定义体系

### ClawKB 当前

- tags、entities、timeline 都是正式页面
- compare timeline、mesh stats 等说明后端野心不小

### 差距判断

**差距级别：双面判断**

- 对比 Obsidian“原生基础能力”，ClawKB 在这块 **并不弱**
- 但对比“产品完成度”，这些页面 **容易喧宾夺主**

### 改造建议

- 不要删除这些能力
- 但要把它们从“主导航并列入口”改成“围绕主任务展开的分析视图”

例如：

- 在搜索结果中进入时间线模式
- 在笔记中查看相关实体
- 在标签页中一键切到图谱
- 在 Reader 中查看当前文档实体与时间上下文

---

## 5.13 Sync / 多设备 / 远程备份

### Obsidian

- Obsidian Sync 是正式服务
- 有选择性同步、区域、故障排查、headless sync 等成熟体系

### ClawKB 当前

- 有 `sync-store.ts`
- 有 WebDAV 配置页面
- 有 Obsidian import / vault scan
- 但同步更像“配置能力”而不是“成熟产品能力”

### 差距判断

**差距级别：A+ 级**

目前离 Obsidian Sync 的差距主要在：

- 冲突处理模型
- 选择性同步
- 多设备状态一致性
- 异常恢复与用户心智
- 真正稳定运行的长期信任

### 改造建议

3.0 不要试图一次做成“Obsidian Sync 平替”。  
更现实的路线是：

- Phase 1：本地快照 / 导出 / 恢复 / 备份可感知
- Phase 2：单向备份同步（push backup）
- Phase 3：双向同步 + 冲突处理

---

## 5.14 Publish / 分享 / 公开站点

### Obsidian

- Publish 是正式能力
- 能把内容变成网站、文档站、wiki
- 支持域名、permalink、analytics、collaborators

### ClawKB 当前

- 仓库未见正式 Publish 产品路径
- 导出存在，但发布不存在

### 差距判断

**差距级别：S 级**

但这里有一个重要判断：

> 对当前 ClawKB 来说，Publish 不是最该优先补的能力。

因为当前产品定位仍是：

- 本地优先
- 单用户
- AI 知识工作台

### 改造建议

- 3.0 暂不以 “Publish 对标” 为主任务
- 只需做：
  - 可导出结构化 Markdown/HTML bundle
  - 可生成分享包 / report package
- 真正的公开发布可以放到更后阶段

---

## 5.15 Community Plugins / Themes / 扩展生态

### Obsidian

这是 Obsidian 的结构性护城河：

- 社区插件市场
- 安装 / 启用 / 更新 / 卸载
- 命令、热键、设置体系融入统一框架
- 主题生态

### ClawKB 当前

- 当前仓库未建立插件 SDK、插件运行时、主题市场体系
- 代码里有大量功能尝试，但本质上都还是内置功能

### 差距判断

**差距级别：SS 级（最大差距）**

如果用户要的是“可塑性”和“生态丰富度”，当前 ClawKB 不能与 Obsidian 同台竞争。

### 改造建议

这里必须战略取舍：

#### 路线 A：不做生态，做产品完成度

- 专注把主线做强
- 把 20 个真正高频能力做深
- 不碰插件平台

#### 路线 B：先做轻扩展，不做完整插件市场

- 命令扩展
- 模板扩展
- 视图扩展
- AI 工具扩展
- 样式主题扩展

**建议选 B 的轻量版。**  
因为完全复制 Obsidian 社区插件生态，成本非常高；但“可扩展工作台”又确实是 AI 产品长远需要的。

---

## 5.16 Workspaces / 布局恢复 / 多面板工作流

### Obsidian

- Workspaces 是正式核心插件
- 可保存不同任务布局：journaling / reading / writing 等

### ClawKB 当前

- 有多种 shell
- 有状态持久化
- 有 draft state / workspace state / local state model
- 但并没有一个简洁、正式、用户可命名管理的 workspace system

### 差距判断

**差距级别：A 级**

当前实际上已经有“隐式 workspaces”，只是还没被产品化：

- Workbench
- Explore
- Document workspace
- Reader/Editor split 状态
- Draft persistence

### 改造建议

- 将其正式升级为 `Workspace Presets`
- 至少提供：
  - Reading
  - Writing
  - Research
  - Review
- 可以保存：
  - 打开的 pane
  - 当前 KB
  - 当前文档集
  - 左右侧栏可见性
  - 过滤条件 / 搜索上下文

---

## 5.17 Slash commands / Quick insert / 编排能力

### Obsidian

- Slash commands 已是核心插件能力之一
- 在编辑器内触发命令

### ClawKB 当前

- `editor.tsx` 中已经实现 slash command 定义
- 这是非常强的信号：团队已经在往现代块编辑器方向走

### 差距判断

**差距级别：C+ 级**

相比其他差距，这一项的补齐成本较低，因为底子已经有了。

### 改造建议

- 把 slash command 从“编辑器里一个功能”升级为“统一插入系统”
- 插入项至少包括：
  - heading / list / task / quote / callout / code / divider
  - note link / embed / block ref
  - AI summary / AI rewrite / citation block
  - table / kanban / whiteboard card / database view

---

## 5.18 AI 原生能力

### Obsidian

- 原生 AI 并不是它的核心能力中心
- 更多依赖插件与外部服务

### ClawKB 当前

- AI 已经是显式产品核心
- Ask / Context / Document / Selection / Report / Podcast / Editor AI commands 均已存在

### 差距判断

**差距级别：ClawKB 领先**

这恰恰说明：

> ClawKB 没必要去做“另一个 Obsidian”。

它更应该做的是：

> 把 Obsidian 的知识组织强项，与自身 AI-first 能力，融合成一个更完整的本地知识工作流。

### 改造建议

AI 在 3.0 里不要继续做“更多模型设置项”，而要服务四条主链路：

- 导入后自动摘要
- 阅读时选区提问
- 搜索后证据聚合回答
- 摘录后转结构化笔记

---

## 6. 当前最大问题：不是缺功能，而是信息架构与能力分级失衡

这是整份分析里最重要的部分。

### 当前真实状态

当前产品看起来像这样：

```text
已做了很多东西
= 导航入口很多
= 页面很多
= store 很多
= 高级能力很多
!= 用户主线清楚
!= 产品像一个完成的笔记工具
```

### 典型问题

1. 首页、工作台、文档、探索、聊天之间边界不够锋利
2. 多个功能同时争主入口
3. 二等能力、三等能力上浮得过早
4. 组件能力没有被收编为统一系统
5. 知识对象模型仍不够稳固（note / doc / draft / source / fragment / entity / folder / kb / report 的关系仍显散）

### 产品上必须做的取舍

3.0 必须明确：

#### 一等能力（必须直达、必须稳定）

- 打开/创建 KB
- 导入资料
- 搜索/问答
- 阅读来源
- 生成/保存笔记
- 恢复上次工作

#### 二等能力（围绕主线出现）

- 图谱
- 标签
- 实体
- 时间线
- 模板
- 书签
- 工作区布局

#### 三等能力（主线稳定后再强化）

- 白板
- 内联数据库
- 看板
- 播客
- 报告编排器高级功能
- 发布
- 扩展平台

---

## 7. 3.0 的目标形态：不要复制 Obsidian，要“借 Obsidian 的骨架，强化 AI 工作流”

### 7.1 目标定位

建议 3.0 的定位明确写成：

> **ClawKB 3.0 = AI-first, local-first, reading-to-notes knowledge workbench**

它不是：

- 团队文档平台
- 通用协作文档工具
- 完整 Obsidian 平替

它应该是：

- 个人本地知识工作台
- 更擅长“导入资料 → 搜索 → 阅读 → 提问 → 沉淀为笔记”
- 在这条链路上做得比 Obsidian 更直接、更顺手

### 7.2 目标体验句

用户打开 3.0 后应该感受到：

1. 我知道当前在哪个知识库里工作
2. 我可以立刻导入或搜索
3. 我提问时答案是基于我自己的资料
4. 我打开来源后能直接摘录、提问、写回笔记
5. 我之后还能从图谱、时间线、标签回到这些内容

---

## 8. 3.0 信息架构与系统设计

## 8.1 顶层信息架构

建议把顶层壳层从当前多壳并存，收敛成：

```text
Home / Workbench
├── Ask
├── Recent
├── Continue Working
└── Quick Actions

Library
├── Tree
├── Search
├── Tags
├── Timeline
└── Graph

Workspace
├── Reader
├── Notes
├── Draft
├── References
└── Inspector

Settings
├── KB
├── AI
├── Import & Sync
├── Backup
└── Labs
```

### 设计原则

- `Home/Workbench`：只做点火与继续工作
- `Library`：只做发现、筛选、组织
- `Workspace`：只做阅读、编辑、沉淀
- `Settings`：只做配置

不要再让这些职责混杂。

---

## 8.2 ANSI 文本架构图（产品架构）

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                           ClawKB 3.0 Product                            │
├──────────────────────────────────────────────────────────────────────────┤
│  Entry Layer                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Workbench    │  │ Library      │  │ Workspace    │  │ Settings     │ │
│  │ Ask/Resume   │  │ Browse/Find  │  │ Read/Write   │  │ Configure    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────┤
│  Interaction Layer                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ Command Palette / Quick Open / Universal Search / Slash Insert      │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ Reader / Editor / Notes / Inspector / Graph / Timeline / Tags       │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│  Domain Layer                                                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐ │
│  │ KB     │ │ Note   │ │ Source │ │ Draft  │ │ Entity │ │ Workspace   │ │
│  └──┬─────┘ └──┬─────┘ └──┬─────┘ └──┬─────┘ └──┬─────┘ └──────┬──────┘ │
│     │           │           │           │           │              │      │
│  ┌──▼────────────────────────────────────────────────────────────▼─────┐ │
│  │ Unified Metadata & Linking Model                                    │ │
│  │ tags / properties / backlinks / outlinks / highlights / refs        │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│  AI Layer                                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ Retrieval / Context Builder / Ask / Selection QA / Rewrite / Report │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│  Storage Layer                                                           │
│  ┌────────────────────────────┐  ┌────────────────────────────────────┐ │
│  │ User-visible Vault Layer   │  │ MV2 Knowledge Index Layer          │ │
│  │ md / attachments / props   │  │ search / graph / embeddings / toc  │ │
│  └────────────────────────────┘  └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 8.3 ANSI 文本设计图（核心工作流）

```text
┌───────────────┐
│   Open KB     │
└──────┬────────┘
       │
       ▼
┌───────────────────────────────┐
│ Import / Search / Ask         │
│ - file / folder / url / image │
│ - keyword / natural language  │
└──────┬────────────────────────┘
       │
       ▼
┌───────────────────────────────┐
│ Open Source in Workspace      │
│ - reader                      │
│ - citations                   │
│ - related notes               │
└──────┬────────────────────────┘
       │
       ├──────────────────────────────┐
       │                              │
       ▼                              ▼
┌─────────────────────┐      ┌──────────────────────────┐
│ Read / Highlight    │      │ Ask Selection / Ask Doc  │
│ Bookmark / Annotate │      │ AI explains / cites      │
└──────────┬──────────┘      └─────────────┬────────────┘
           │                                │
           └──────────────┬─────────────────┘
                          ▼
                ┌───────────────────────┐
                │ Save to Note / Draft  │
                │ - note                │
                │ - daily note          │
                │ - report section      │
                └──────────┬────────────┘
                           │
                           ▼
                ┌───────────────────────┐
                │ Re-index / Re-link    │
                │ Tags / Graph / Search │
                └──────────┬────────────┘
                           │
                           ▼
                ┌───────────────────────┐
                │ Resume Later          │
                │ recent / bookmarks    │
                │ workspaces / history  │
                └───────────────────────┘
```

---

## 9. 分阶段改造计划

下面是建议的完整路线，按优先级而不是按“功能酷炫程度”排序。

## Phase 0 — 收口与澄清（1 周）

目标：先把产品主线说清楚，避免继续无序堆功能。

### 任务

- 明确 3.0 定位文案
- 明确一等 / 二等 / 三等能力分层
- 统一顶层 IA
- 标记当前所有页面：保留 / 下沉 / 合并 / 实验
- 明确核心领域对象与命名

### 输出

- `product-spec-3.0.md`
- `domain-model-3.0.md`
- `navigation-map-3.0.md`

---

## Phase 1 — 核心主链路打穿（2~4 周）

目标：把“导入 → 搜索/问答 → 阅读 → 保存笔记”做成强闭环。

### 必做

- Workbench 重构：只保留继续工作、Ask、Recent、Quick actions
- Library 重构：树 / 搜索 / 标签 / 时间线 / 图谱统一入口
- Workspace 重构：Reader + Draft + Notes + Inspector 四区稳定布局
- Search 结果统一动作协议
- Ask 结果必须有可信来源与一键打开来源
- Reader 内支持“摘录 → 保存为笔记/草稿/卡片”
- Draft 保存回 KB 后自动参与搜索/图谱/反链

### 完成标准

- 新用户 3 分钟内能完成第一次闭环
- 老用户重开应用 30 秒内能续上工作

---

## Phase 2 — 编辑器与链接系统成熟化（3~5 周）

目标：把已预埋的编辑能力真正产品化。

### 必做

- 统一编辑模型（避免 HTML 富文本与知识模型长期分裂）
- 完善 slash command
- 完善 block ref / block id / block fold
- 完善 wikilink hover preview
- 统一 editor/reader 中的 backlinks/outlinks/local graph 交互
- 模板系统升级为 note templates + periodic templates

### 完成标准

- 编辑器可支撑重度日常笔记
- 链接体验成为产品记忆点

---

## Phase 3 — 统一 Metadata / Properties / Bases（3~4 周）

目标：建立与 Obsidian Properties/Bases 对等、且更适合 AI 的结构化层。

### 必做

- Note 属性 schema
- File properties panel
- All properties registry
- 自定义字段类型（text/date/number/select/multi-select/checkbox/reference）
- 基于属性的表格/视图
- AI 对属性可见

### 完成标准

- 笔记不再只是文本块
- 可以基于属性做筛选/分组/排序/视图保存

---

## Phase 4 — 图谱、时间线、实体的体系化（2~4 周）

目标：把分析能力从“页面”升级成“系统辅助能力”。

### 必做

- 全局图谱 / 局部图谱区分
- 图谱过滤 / 分组 / 深度 / 视角保存
- 实体与笔记联动
- 时间线与 daily note / source 时间联动
- 从搜索 / 文档 / 标签直接跳转图谱分析视角

### 完成标准

- 图谱与时间线不再是孤立工具页

---

## Phase 5 — Reader First 深化（2~3 周）

目标：打造真正的“资料阅读与沉淀中心”。

### 必做

- 高亮 / 注释 / 书签统一 Saved Items 模型
- 引文卡片（quote card）
- 选区问答结果一键入笔记
- PDF / 网页 / OCR 导入后的文档体验统一
- 阅读进度与继续阅读入口统一

### 完成标准

- Reader 成为与 Editor 同等核心入口

---

## Phase 6 — 轻扩展平台（可选，后置）

目标：不复制 Obsidian 插件生态，但建立可扩展性。

### 可做

- 命令扩展
- 模板扩展
- 自定义视图扩展
- AI tool 扩展
- 主题 token 扩展

### 不建议立即做

- 完整插件市场
- 不受控第三方运行时
- 与 Obsidian 同量级的社区生态系统

---

## 10. 完整 TODO List

下面给出一份可执行 todo，按优先级分组。

### P0 — 必须先做

- [ ] 明确 3.0 产品定位与首页文案
- [ ] 合并顶层导航，收敛多壳层职责
- [ ] 统一 Workbench / Library / Workspace / Settings 四层
- [ ] 定义统一领域对象：KB / Note / Source / Draft / Fragment / Property / Workspace
- [ ] 梳理所有已有页面为：保留 / 合并 / 下沉 / 延后
- [ ] 建立统一搜索结果动作协议
- [ ] 建立统一“打开来源 → 阅读 → 保存笔记”闭环
- [ ] 统一 draft 保存后的索引刷新与关系刷新
- [ ] 把 runtime guard 与真实桌面态的边界文案做得更清楚

### P1 — 核心体验增强

- [ ] Reader 成为正式主战场
- [ ] Reader 中增加摘录卡片流
- [ ] 搜索页增加 preview / split open / cite / save note
- [ ] Ask 回答增加更清晰来源证据区
- [ ] 将 Recent / Continue Working 做成一等首页能力
- [ ] Daily note 与最近工作流打通
- [ ] 完善命令面板、quick open、universal search 三分结构

### P1 — 编辑器成熟化

- [ ] 统一编辑器存储模型
- [ ] 完善 slash command 体系
- [ ] 完善 block reference 的插入、跳转、预览
- [ ] 完善 wikilink hover preview
- [ ] 完善 callout / mermaid / task / table 插入体验
- [ ] 完善模板管理与模板应用流程
- [ ] 增加 periodic templates

### P1 — 结构化知识层

- [ ] 设计属性 schema
- [ ] 增加 file properties panel
- [ ] 增加 all properties registry
- [ ] 支持 typed custom properties
- [ ] 增加 saved views / bases 原型
- [ ] 让 tags / timeline / entities 全部基于统一属性层工作

### P2 — 图谱与分析层

- [ ] 重构 graph 页面的数据模型
- [ ] 增加图谱 filters / groups / depth / presets
- [ ] 区分全局图谱与局部图谱
- [ ] 增加图谱与搜索联动
- [ ] 增加 timeline 与 daily notes 的联动
- [ ] 增加 entity graph 的文档回跳能力

### P2 — 组织与恢复

- [ ] 正式化 workspace presets
- [ ] 保存 reading / writing / research 布局
- [ ] 统一 bookmarks / highlights / saved queries / saved views
- [ ] 增加 continue reading / continue writing 卡片

### P2 — 同步与可靠性

- [ ] 增强本地备份与恢复提示
- [ ] 可视化上次同步状态
- [ ] 增加冲突提示基础设施
- [ ] 支持一键导出可审计内容包
- [ ] 设计 Vault-visible 与 MV2-index 双层存储方案

### P3 — 实验特性

- [ ] Whiteboard 正式产品化方案
- [ ] Inline Database 正式接入计划
- [ ] Kanban 与 daily tasks 联动
- [ ] Quote cards / evidence boards
- [ ] AI 自动笔记整理流水线
- [ ] Report / Podcast 降为从主流程触发的高级工具

---

## 11. 建议的页面调整方案

### 保留并强化

- Workbench
- Search
- Reader
- Editor / Notes（建议合并心智）
- Settings

### 保留但下沉为分析视图

- Tags
- Timeline
- Entities
- Graph

### 保留但不再作为主入口竞争注意力

- Report
- Podcast
- Import 的高级分支
- 多 KB 的复杂入口

### 暂不主推，标记为 Labs / Experimental

- Whiteboard
- Inline Database
- Kanban
- 更重的工作台可视化

---

## 12. 研发实现建议（从代码角度）

### 12.1 先做“收口重构”，再做“新功能增量”

当前仓库更需要：

- 统一命名
- 统一对象模型
- 统一壳层职责
- 统一 editor/reader/search 的交互协议

而不是再新增 5 个页面。

### 12.2 以领域模型驱动前端

建议建立清晰的前端 domain types：

```text
KnowledgeBase
LibraryItem
SourceDocument
NoteDocument
WorkspaceDraft
SavedItem
PropertySchema
GraphNode
GraphEdge
AskResult
Citation
```

### 12.3 建立“能力成熟度清单”

给每个功能打状态：

- `core-ready`
- `usable`
- `partial`
- `experimental`
- `hidden`

这样团队才能避免“组件存在就算做完”。

### 12.4 建立用户任务级验证

比起单页 smoke test，更需要以下任务流测试：

- 创建 KB → 导入文件 → 搜索 → 打开 Reader → 保存 Draft
- 搜索 → Ask → 打开来源 → 摘录 → 生成笔记
- Daily Note → 插入链接 → 查看反链 → 图谱跳转
- 重开应用 → 恢复当前工作上下文

---

## 13. 最终优先级建议

如果只能选 3 件事优先做，我建议是：

### 第一优先级：主闭环

把“导入 / 搜索 / 问答 / 阅读 / 保存笔记”的闭环做到极顺。

### 第二优先级：编辑器与链接系统

把现有的编辑器预埋能力真正产品化，做成用户愿意长期写的地方。

### 第三优先级：统一 Metadata / Properties

这是从“很多页面”走向“真正知识系统”的分水岭。

---

## 14. 最终判断

### 如果拿当前版本直接对标 Obsidian 1.12.7

结论是：

> **功能面不算弱，但产品完成度和系统成熟度仍明显落后。**

### 如果问这款产品有没有前途

结论是：

> **有，而且方向不该是“复制 Obsidian”，而是“借 Obsidian 的知识组织强项，做更强的 AI-first 本地知识工作流”。**

### 3.0 的正确目标

不是：

- 再加 10 个新页面
- 再加 20 个设置项
- 再做一堆实验组件演示

而是：

- 统一主流程
- 统一知识模型
- 统一编辑与阅读体验
- 统一结构化属性层
- 把 AI 真正嵌进阅读沉淀闭环

---

## 15. 附：一句战略建议

> **不要把 ClawKB 做成“少一点生态的 Obsidian”；要把它做成“更懂阅读沉淀和 AI 协作的本地知识工作台”。**
