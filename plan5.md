# ClawKB MVP Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 ClawKB 从“本地知识库能力集合”收成一个真正可用的个人知识库 MVP，让用户可以低门槛地完成“建库 -> 导入 -> 搜索/提问 -> 阅读原文 -> 记笔记/写草稿”这条主链路。

**Architecture:** 继续保留 Rust `clawkb-core` + Tauri + React 的桌面本地架构，但在产品层做明显减法。MVP 不追求覆盖 ima 的全部能力，而是只保留个人知识库最小闭环，优先解决易上手、低认知负担、结果可信、操作稳定四件事。

**Tech Stack:** Rust workspace (`clawkb-core` / `clawkb-cli` / `src-tauri`) + React 19 + TypeScript + Zustand + TipTap + shadcn/ui + Tauri 2 + memvid-core

---

## 一、真实参考：腾讯 ima 当前产品形态

### 1. 官方站点呈现出的产品主心智非常集中

基于官方站点 [ima.qq.com](https://ima.qq.com/) 的当前可见入口，ima 的顶层结构非常克制：

- `新对话`
- `个人知识库`
- `知识库广场`
- `问答历史`
- `关于 ima`

这说明 ima 当前对用户讲述的是一个非常清晰的故事：

- 先对话
- 对话围绕知识库展开
- 知识库分个人与广场两种来源
- 历史问答是重要的一等能力

结论：

- ima 的核心不是“工具页集合”
- 而是“围绕知识库组织的对话式工作台”

### 2. App Store 上的官方文案强调的是“搜-读-写一体化”

根据苹果 App Store 的官方页面 [ima - 腾讯 AI 工作台](https://apps.apple.com/cn/app/ima-%E8%85%BE%E8%AE%AF-ai-%E5%B7%A5%E4%BD%9C%E5%8F%B0/id6737188438)：

- ima 自我定义为“以知识库为基础的 AI 工作台”
- 官方核心表述是“搜-读-写”一站式体验
- 个人知识库支持本地文件、微信文件、公众号文章、网页、图片、音频等内容
- 产品把“个人知识库”“共享知识库”“知识库广场”“任务模式”“录音纪要”“笔记”“AI 解读”打包为核心能力

对 ClawKB 有价值的不是去复刻全部能力，而是看出 ima 的优先级：

1. 知识先收进来
2. 再围绕知识做问答、阅读和写作
3. 输出型能力建立在已有知识库之上

### 3. ima 最近迭代重点说明了什么才是高频刚需

从同一 App Store 页面可见的近期版本记录看，ima 最近重点优化的是：

- `2.4.5`：支持创建多个个人知识库
- `2.4.3`：优化 Markdown 识别、优化知识库文件搜索、PDF/Word 支持查看目录
- `2.3.0`：支持知识库添加附件问答
- `2.0.1`：首页支持快捷 `@知识库` 提问，知识库支持多个对话和问答历史

这个顺序很重要。

它说明腾讯在成熟阶段仍然优先打磨的是：

- 多个人知识库
- 文件搜索体验
- 原文阅读体验
- 对话历史
- `@知识库` 这种低摩擦入口

而不是先把图谱、思维导图、播客、报告这些“看起来强”的能力放在产品第一层。

### 4. ima 对 ClawKB 的真正启发

作为参考对象，ima 最值得学习的不是“云同步”“共享广场”这类平台能力，而是下面四点：

1. 顶层心智极简
2. 入口围绕知识库主链路组织
3. 近期迭代持续修正“搜索、阅读、问答、历史、多库”这些真实高频问题
4. 即使能力越来越多，产品表面仍然维持“简单、直接、随手就能用”的感觉

---

## 二、ClawKB 当前与 ima 的核心差距

### 1. ClawKB 更像“能力仓库”，ima 更像“明确任务产品”

ClawKB 当前已经有很多能力：

- Search
- Import
- Notes
- Timeline
- Tags
- Entities
- Graph
- Mind Map
- Report
- Podcast
- OCR / Screenshot / Media import
- Multi-KB registry

但从用户视角看，这些能力现在更像“并列可选项”，而不是一个极清晰的主流程。

和 ima 相比，ClawKB 的主要问题不是功能少，而是：

- 功能主次不分
- 用户不知道第一步应该做什么
- 每个页面都能做一点，但没有哪个页面明确承载主任务

### 2. ClawKB 的顶层导航仍然偏重

当前顶层虽然已经收口到：

- Workbench
- Spaces
- Documents
- Explore
- Settings

但实际认知负担仍然偏大，因为：

- `Workbench` 是对话入口
- `Spaces` 是知识库管理
- `Documents` 是阅读/写作
- `Explore` 里又塞了大量工具页
- `Settings` 里仍有大量会影响首次使用的配置项

这对已经理解产品的人还可以接受，但对第一次打开的人仍然复杂。

和 ima 对比：

- ima 顶层是“对话 / 个人知识库 / 历史”
- ClawKB 顶层更像“工作台 / 空间 / 文档 / 工具 / 设置”

ClawKB 仍然偏“产品内部组织逻辑”，而不是“用户任务逻辑”。

### 3. ClawKB 的“建库”动作仍然太工程化

当前 ClawKB 已经支持本地库打开和创建，但真实体验仍有几个明显门槛：

- 还比较依赖手输路径
- 用户需要理解 `.mv2`
- “当前库 / 已登记库 / joined / shared / personal / created” 这些概念仍然偏内部
- `Settings` 在首次使用时承担了太多职责

对比 ima：

- ima 的产品语言更偏“个人知识库”
- 用户更少接触底层文件和路径概念
- 建库与导入被表达为日常动作，而不是系统管理动作

结论：

- ClawKB 现在还像“本地数据库工具”
- 还没有真正变成“个人知识库应用”

### 4. ClawKB 的导入链路能力够多，但不够顺手

ClawKB 的导入支持面并不差，甚至在解析器层已经很广：

- PDF / DOCX / PPTX / XLSX / EPUB / CSV / JSON / HTML
- URL 导入
- 图片 / 音频 / 截图导入

但产品层的问题在于：

- 导入入口分散在 `Explore -> Import`、`Workbench` 附件、`Settings`
- 导入后文档流转到哪里不够直观
- 导入完成后的“下一步”提示不够强
- 用户不容易自然进入“问答/阅读/摘录/草稿”闭环

而 ima 的导入价值在于：

- 导入本身不是终点
- 导入后马上能进入问答、阅读和写作

ClawKB 现在更像“把东西导进来”，ima 更像“导进来之后立刻能用”。

### 5. ClawKB 的搜-读-写闭环还不够扎实

这是当前最关键的差距。

对个人知识库 MVP 来说，真正的核心能力只有四个：

1. 找到资料
2. 对资料提问
3. 打开原文
4. 基于原文写笔记/草稿

ClawKB 目前这四步都“有”，但连起来还不够顺：

- `Search` 在 `Explore`
- `Ask` 在 `Workbench`
- `Read` 在 `Documents`
- `Write` 也在 `Documents`
- 历史对话是全局存储，不够明确地和当前 KB / 当前任务绑定
- `Documents` 当前通过 `search('*')` 拉文档，这更像工程折中，不像稳定产品语义

而 ima 在产品层把这些都放在一条更自然的路径上：

- 问答围绕知识库
- 问答结果需要能回到原文
- 历史问答本身是核心资产
- 读和写并不显得是“切模块”，而是顺手延续

### 6. ClawKB 在 MVP 阶段仍然暴露了过多“二级价值功能”

以下能力不是没有价值，但在 MVP 阶段优先级明显偏后：

- Timeline
- Tags
- Entities
- Graph
- Mind Map
- Podcast
- Report
- WebDAV Sync
- Obsidian Sync

这些功能的问题不是“做错了”，而是：

- 它们会抢走用户注意力
- 它们让导航看起来更复杂
- 它们提升了维护面
- 它们会让团队错把“能力广”当成“产品已经成熟”

和 ima 对比时尤其要警惕这一点：

- ima 虽然也有任务模式、播客、PPT 等高级能力
- 但它的主表面仍然是对话、知识库、历史

ClawKB 如果想做 MVP，本轮应该学的是“隐藏复杂度”，不是“继续摊更多能力”。

### 7. 语言与产品口径仍然不够统一

ClawKB 当前界面存在较明显的中英混合问题：

- `Workbench`
- `Quick Actions`
- `Document Workspace`
- `Explore Workspace`
- `Continue Draft`
- `Capture Note`

同时又夹杂中文：

- `录音纪要`
- `文档解读`
- `智能写作`
- `快速访问`

这会直接损伤“简单易用”的感受。对个人知识库产品来说，统一口径本身就是易用性的一部分。

### 8. ClawKB 的本地优势还没有被包装成真正差异化价值

ClawKB 的天然优势是：

- 本地优先
- 单用户
- 自己的数据自己掌控
- 不依赖云协作

但当前产品上，这个优势主要停留在“文案说明”和“技术事实”层，还没有被转成真正的用户价值表达：

- 为什么本地更安心？
- 为什么本地更快？
- 为什么本地更适合个人沉淀长期资料？
- 为什么它不是团队工具而是个人第二大脑？

ima 的强项是腾讯生态、跨端、共享、广场、云化。
ClawKB 不应该在 MVP 阶段和它拼这些，而应该把“本地私人知识库”做到明显更安静、更直接、更可控。

---

## 三、ClawKB 当前存在问题清单

### P0：会直接伤害 MVP 易用性的核心问题

- 顶层心智仍然偏复杂，用户无法立刻理解第一步
- 建库、开库、导入仍然过于工程化，路径心智太重
- 搜-读-写主链路跨多个 shell，任务连续性不够
- 未打开 KB 时仍有较多“像是能用，但实际上只是半工作状态”的界面
- 对话历史没有清晰绑定当前 KB / 当前任务上下文
- 语言风格中英混用，降低产品完成度

### P1：会拖慢产品稳定化和认知收口的问题

- Explore 下工具页过多，主次关系模糊
- 多库管理语义仍偏内部实现，不够自然
- `Documents` 依赖搜索结果生成工作流，而不是稳定的文档流视角
- `Settings` 承担过多首次使用入口职责
- 导入后的“下一步”缺少强引导

### P2：应该延后到 MVP 之后的问题

- 图谱与实体类分析
- 时间线视图
- 报告 / 播客 / 思维导图等生成型二级能力
- WebDAV / Obsidian 等外部同步
- 更复杂的多库联合问答与工作流能力

---

## 四、MVP 版本应该是什么

### 一句话定义

ClawKB MVP 应该是：

**一个桌面本地、单用户、可在几分钟内完成建库并开始提问与写作的个人知识库应用。**

### 核心用户任务

用户第一次使用时，应该能自然完成下面这条链路：

1. 打开应用
2. 创建或打开一个个人知识库
3. 导入一个 PDF / 文档 / 网页
4. 问一个问题
5. 从答案跳回原文
6. 记下一条笔记或保存一份草稿

如果这条链路不顺，其他高级功能都不应该优先开发。

### MVP 成功标准

- 首次启动 5 分钟内可以完成第一次建库和第一次提问
- 导入后能清楚看到资料已进入当前知识库
- 搜索和问答都能回到真实原文
- 文档阅读和草稿写作是在同一个连续工作流里
- 用户不需要理解太多内部概念就能上手

### MVP 非目标

以下内容不应成为 `plan5.md` 周期内的主目标：

- 云同步
- 多人协作
- 共享知识库广场
- 任务模式 / Agent 编排
- AI 生图
- 报告 / 播客 / PPT 等花式输出
- 图谱、时间线、知识号生态

---

## 五、plan5：ClawKB MVP 实施计划

### Phase 1: 产品重心再收口

**Goal:** 让任何新用户在 30 秒内看懂 ClawKB 是“个人本地知识库”，并知道第一步是建库或打开已有库。

**Why:** 现在最大的风险不是功能不够，而是首页仍然在向用户暴露太多内部产品结构。

**Status:** In Progress (2026-04-11)

**Completed work:**

- 主导航已压缩到 `Workbench / Libraries / Documents / Settings`，`Explore` 不再作为顶层主入口暴露
- 主导航主文案已进一步收口为 `首页 / 个人知识库 / 笔记 / 设置`，更贴近 ima 的知识库主心智
- 顶栏和页面标签中的 `Spaces` 已统一收口为 `Libraries`
- `Workbench` 在未打开 KB 时已改为真实 setup panel，并明确提供 `Open or Create KB / Review Local Libraries`
- `个人知识库` 页的主文案已从 `Local Libraries / Selected Space / Space Registry` 这类管理语义，收口为“知识库列表 / 个人知识库 / 基于知识库提问”语义
- `个人知识库` 页的三栏结构已收口成更接近 ima 的主页面形态：左侧知识库分组和列表，中间知识库概览与资料入口，底部基于知识库提问
- `Documents` 在未打开 KB 时会显示真实 onboarding 空态，不再伪装成可直接工作的文档流
- `Quick Actions` 中依赖真实 KB 的动作在未开库时会禁用，避免继续暴露伪可用体验
- `Explore` 已降级成二级工具区，`Search / Import / Notes` 保持一线入口，`Timeline / Tags / Entities / Graph / Mind Map / Report / Podcast` 默认折叠在 `Advanced Tools`
- 首页 Hero 与笔记工作区的主文案已切成中文，并明确强调“个人知识库 -> 提问 -> 阅读 -> 笔记/草稿”的连续流程
- 文档标签已进一步收口为 `阅读 / 草稿 / 笔记` 主标签，高级输出继续后移

**Files likely impacted:**

- `src/src/components/layout.tsx`
- `src/src/App.tsx`
- `src/src/components/shell/workbench-shell.tsx`
- `src/src/components/shell/document-workspace-shell.tsx`
- `src/src/components/shell/knowledge-space-shell.tsx`
- `src/README.md`

- [x] 进一步压缩顶层导航，确保 MVP 语义围绕 `Workbench / Libraries / Documents / Settings`
- [x] 把 `Explore` 里的大多数高级页面从主导航降级为二级入口或暂时隐藏
- [ ] 统一产品主语言，避免中英混用
- [x] 明确首页一句话承诺和首次动作
- [x] 把“个人、本地、单用户”写成 UI 默认事实，而不是说明文案补充

**Verification**

- Run: `cd src && npm run build`
- Run: `cd src && npm test -- src/__tests__/layout-shell.test.tsx src/__tests__/workbench-shell.test.tsx src/__tests__/document-workspace-shell.test.tsx src/__tests__/explore-shell.test.tsx`
- Run: `bash scripts/verify-release.sh`
- Manual: 打开 `Workbench / Libraries / Documents`
- Expected:
  - 新用户能立刻知道第一步要先开库
  - 看不到明显“工具箱式产品”心智

### Phase 2: 建库与导入体验重做

**Goal:** 把建库、开库、导入做成真正的个人知识库入口，而不是技术配置动作。

**Why:** 这是 ClawKB 目前和 ima 差距最大的地方之一。

**Status:** In Progress (2026-04-11)

**Completed work:**

- 已接入官方 Tauri `dialog` 插件，桌面端现在可以真实调用原生文件/保存对话框
- `Settings` 的 KB setup 已新增 `Choose Existing KB` 与 `Choose New KB Location`，不再只依赖手输 `.mv2` 路径
- `Import` 的文件/目录导入已新增 `Choose File / Choose Folder`，目录导入不再依赖手工在路径末尾追加 `/`
- `Import` 的主表面已收口为 MVP 语义：文件/文件夹/网页保留在第一层，`Media / Screenshot` 降级为 `Advanced Imports`
- `Media` 导入已新增原生文件选择入口，减少手输路径的工程化感受
- `Obsidian Vault` 已新增目录选择入口，降低首次同步配置门槛
- 文件和网页导入成功后已新增明确的下一步 CTA：`Ask in Workbench / Open Document Workspace`
- `Import` 页面现在会显示当前挂载知识库状态，导入行为不再像“孤立工具页”
- `个人知识库` 页已经收口到“当前知识库 + 其他知识库”单列表，移除了 `共享知识库` 这类一级分类；多个知识库继续保留，但只作为按需切换的进阶能力
- 已新增前端回归测试，固定“原生选择器填充路径”和“目录导入不依赖 trailing slash hack”两条关键行为
- 已新增回归测试，固定“高级导入默认隐藏”和“导入成功后直接进入搜/读主链路”两条行为

**Files likely impacted:**

- `src/src/components/pages/settings.tsx`
- `src/src/components/pages/import.tsx`
- `src/src/store/kb-store.ts`
- `src/src/store/kb-registry-store.ts`
- `src-tauri/src/commands/mod.rs`
- `src/src/lib/native-dialog.ts`
- `src-tauri/src/lib.rs`
- `src-tauri/capabilities/default.json`
- `src-tauri/Cargo.toml`
- `src/package.json`

- [x] 用原生文件/目录选择器替代主要路径手输场景
- [x] 重新定义“个人知识库”模型：默认一个当前库，多个库作为进阶能力，而不是一开始就暴露过多分类
- [x] 简化导入入口，只保留 MVP 必需导入方式：本地文件、文件夹、网页
- [x] 导入完成后，明确把用户带到“提问 / 阅读 / 写草稿”下一步
- [x] 让当前库状态、最近库、最近导入对新用户可见

**Verification**

- Run: `bash scripts/verify-release.sh`
- Manual:
  - 新建 KB
  - 打开已有 KB
  - 导入一个 PDF 和一个网页
- Expected:
  - 用户不需要理解 `.mv2` 才能完成主要动作
  - 导入后能自然进入可用状态

### Phase 3: 搜-读-写主链路重构

**Goal:** 让 ClawKB 真正具备“搜-读-写”一条链，而不是把这三个动作分散在多个产品壳层里。

**Why:** 这是个人知识库 MVP 的核心价值。

**Status:** In Progress (2026-04-11)

**Completed work:**

- `Documents` 的主表面已进一步向“笔记工作区”收口，主标题和引导语明确围绕阅读、笔记、草稿展开
- 文档页标签已改成 `阅读 / 草稿 / 笔记` 一线主入口，`报告 / 播客` 已降级到 `显示高级功能` 后才出现
- 首页与笔记工作区的视觉心智都已更明显地对齐“知识库和笔记为核心”，弱化了泛工具箱感觉
- `个人知识库` 页已经开始从“知识库注册管理”转向“知识库主页面”：左侧是知识库分组和列表，右侧是知识库概览、资料入口和基于知识库提问面板
- `个人知识库` 页中的核心动作文案已切成中文，并且默认强调“切换到知识库 / 打开笔记工作区 / 基于知识库提问”，弱化后台管理感
- `个人知识库` 页已进一步向 ima 主表面靠拢：当前资料卡片现在直接显示在主内容区，知识库设置默认折叠到 `编辑知识库设置` 二级入口，不再把管理表单直接摊在主视图里
- 基于知识库提问面板继续保留在主页面底部，形成“知识库列表 -> 当前资料 -> 问答入口”的连续结构
- 主导航首页已进一步收口为 `问答`，首页快捷动作也改成 `导入资料 / 打开笔记 / 继续写作 / 切换知识库`，弱化了“工具箱”感
- `个人知识库` 页现在可以从资料卡片直接进入笔记；主链路进一步收口为“选知识库 -> 看当前资料 -> 提问或记笔记”
- 首页问答面板已进一步极简化：默认只保留知识库范围、正文输入、`导入文件 / 网页 / 提问` 三类主动作；模型、模式、媒体、截图等能力已折叠进 `显示高级选项`
- `笔记工作区` 左栏与工具条已继续切成中文语义，默认强调“当前资料”“保存草稿到知识库”，减少了此前英文和重复工具按钮带来的工作台噪音
- 未打开知识库时的首页已继续收口：首屏只保留“打开或创建知识库 / 查看个人知识库”主动作，不再额外挂载常用动作和最近问答面板
- `笔记工作区` 的主标签现已继续压缩为 `阅读 / 草稿 / 笔记` 三个一线入口，`报告 / 播客` 不再出现在该工作区主表面
- 首页问答区和知识库页底部问答都已把来源卡片默认展示出来，不再只显示“有几条来源”的弱提示
- 首页问答来源卡片已支持直接进入文档工作区，并选中对应资料；知识库页底部问答也已接入同样的来源跳转链路
- 当前来源跳转已经能稳定把用户带回对应文档工作区，但还没有做到“精确滚动到原文位置”；因此它解决了“回到哪篇资料”的问题，还未完全解决“回到资料的哪一段”的问题
- 已打开知识库后的首页已进一步压扁成“当前知识库问答面板”为中心，不再保留额外的大型 hero 卡片，继续向 ima 的单任务问答入口靠拢
- `当前知识库` 在列表和详情里的默认说明文案已改成中文，减少了首页/知识库页里残留的英文产品口径
- 首页问答区已新增一条更轻的状态条，用极简 chips 显示“当前知识库 / 最近库 / 最近资料”；并已通过真实开库态桌面截图验证
- 问答历史现在已经按当前知识库范围过滤展示；其它知识库的历史不会再污染当前知识库的首页问答来源区
- 已真实访问 ima 当前公开入口，确认其一线结构仍然是 `新对话 / 个人知识库 / 知识库广场 / 问答历史`，这进一步验证了 ClawKB 应继续收口到“知识库与问答/笔记”为主，而不是工具页集合
- 当前阶段的 `个人知识库` 页已经更像 ima 的主页面，但仍明显缺少 ima 那种更轻量的文件卡片流、最近知识库、最近问答和更强的一眼可懂的日常使用感，因此后续仍需继续压缩管理感、增强内容感
- `个人知识库` 页底部已去掉重复的资料浏览器，只保留“基于知识库提问”的问答入口；资料浏览职责全部回到主区卡片流，避免同页出现两套竞争性的浏览界面

**Files likely impacted:**

- `src/src/components/shell/workbench-shell.tsx`
- `src/src/components/shell/document-workspace-shell.tsx`
- `src/src/components/shell/knowledge-space-shell.tsx`
- `src/src/components/spaces/kb-list-pane.tsx`
- `src/src/components/spaces/kb-detail-pane.tsx`
- `src/src/components/spaces/kb-chat-pane.tsx`
- `src/src/components/documents/document-tabs.tsx`
- `src/src/components/home/home-hero.tsx`
- `src/src/components/layout.tsx`
- `src/src/components/pages/search.tsx`
- `src/src/components/pages/reader.tsx`
- `src/src/components/pages/editor.tsx`
- `src/src/store/chat-store.ts`
- `src/src/store/document-workspace-store.ts`

- [x] 把问答结果中的来源展示做成默认强能力，而不是附属信息
- [ ] 支持从问答/搜索结果稳定跳到原文位置
- [ ] 重构文档工作区，避免依赖 `search('*')` 作为文档列表语义
- [x] 让对话历史至少按当前 KB 维度区分，避免全局历史污染
- [ ] 让笔记和草稿自然地归属当前库与当前文档上下文

**Verification**

- Run: `bash scripts/verify-release.sh`
- Manual:
  - 导入一个文档
  - 问一个问题
  - 点击来源回到原文
  - 保存一条笔记或一份草稿
- Expected:
  - 搜、读、写在一次连续任务中完成
  - 用户能感知到答案来自自己资料

### Phase 4: 隐藏非 MVP 功能，保留可演进空间

**Goal:** 在不大规模删底层代码的前提下，把非 MVP 能力从主界面撤下。

**Why:** 现在最大的问题之一是“暴露太多”，而不是“能力太少”。

**Status:** In Progress (2026-04-11)

**Completed work:**

- `Explore` 已不再处于主导航一级
- 高级工具仍保留实现，但默认折叠在 `Advanced Tools` 下，避免和核心搜读写路径争抢注意力
- 通过新增前端回归测试，MVP 主表面的可见性规则已经被固定下来
- 主侧栏里的 `FolderTree` 已从一级工作表面移除，避免再次把产品拉回“文件工具”心智
- `笔记工作区` 顶部工具条已继续收口，不再默认暴露 `Report / Podcast` 快捷入口，主表面只保留笔记保存这类直接服务搜读写的动作
- `设置` 页默认表面已收口为中文的知识库设置；`AI / WebDAV / Obsidian / 导出 / 关于` 已隐藏到 `显示高级设置` 之后，避免设置页本身像后台

**Files likely impacted:**

- `src/src/components/shell/explore-shell.tsx`
- `src/src/components/layout.tsx`
- `src/src/store/workspace-store.ts`
- `src/src/components/pages/report.tsx`
- `src/src/components/pages/podcast.tsx`
- `src/src/components/pages/graph.tsx`
- `src/src/components/pages/timeline.tsx`
- `src/src/components/pages/entities.tsx`
- `src/src/components/pages/mindmap.tsx`

- [x] 将 `timeline / tags / entities / graph / mindmap / report / podcast` 降级为实验性能力或先隐藏
- [x] 减少 Explore 对核心心智的干扰
- [x] 保留底层能力和实现，但不在 MVP 主表面强调
- [ ] 只保留能直接服务“搜-读-写”的二级页面

**Verification**

- Manual: 通看所有主导航和二级入口
- Expected:
  - 主界面不再像“大而全工具箱”
  - 高级功能不会抢走核心产品叙事

### Phase 5: MVP 稳定性与发布基线

**Goal:** 让 MVP 在真实使用中稳定、可信，而不是只在开发者机器上能跑。

**Why:** 个人知识库产品的信任来自数据稳定和结果可追溯。

**Status:** In Progress (2026-04-11)

**Completed work:**

- 真实桌面 UI 校验已改为基于 Quartz 精确匹配 `clawkb-app` 窗口 ID 截图，不再使用容易抓错前景窗口的区域截图
- `verify-desktop-ui.sh` 会在截图后检查亮度与方差，避免黑屏或空白渲染被误判成“启动成功”
- 由于首页继续向深色极简方向收口，本轮已修正 `verify-desktop-ui.sh` 的亮度阈值，让真实有内容但整体更暗的界面不会被误判成空白窗口
- `verify-release.sh` 已 fresh 通过，覆盖 Rust 测试、前端 smoke、preview guard、持久化、错误处理、桌面 UI 启动
- 在接入 Tauri `dialog` 插件之后，真实桌面启动验证仍然通过，证明原生文件选择器没有破坏桌面壳层启动链路
- 2026-04-11 本轮“知识库 + 笔记”极简化改造后，`verify-release.sh` 已再次 fresh 通过，说明这轮 UI 收口没有破坏真实桌面启动与验证链路
- 已真实搜索并核对本地调试/验证相关 skills：`systematic-debugging`、`playwright`、`agent-browser`、`verification-before-completion`
- 已真实检索官方 Tauri 调试参考资料，作为桌面验证方案的外部依据
- 本轮已再次真实访问 ima 官网与 App Store 页面，并据此继续把首页与知识库页往更少层级、更少说明、更少工具感的方向收口
- 本轮 fresh 桌面截图已确认首页更简化：不打开知识库时不再叠加 hero 与流程侧栏，首页首屏已明显缩成更单一的开库入口
- 本轮在继续收口首页后，fresh 桌面截图已进一步确认：未打开知识库时首页现在只保留开库主动作，不再出现下半区的信息面板；更符合“先开库、再提问”的单任务入口
- 本轮 fresh 验证已覆盖新的来源链路：前端测试现在固定首页问答与知识库页底部问答都默认展示来源卡片，并支持从来源卡片进入文档工作区
- 2026-04-14 本轮 fresh 验证再次通过，覆盖新的来源跳转实现与知识库页问答来源卡片交互，说明这轮改造没有破坏桌面壳层与主链路
- 2026-04-15 本轮 fresh 验证再次通过，覆盖“已开库首页继续极简化”和“当前知识库默认中文描述”两处减法调整，说明这轮进一步收口没有破坏桌面链路
- 2026-04-15 本轮又一次 fresh 通过 release 验证，并新增覆盖首页轻状态条的回归测试；同时已重新核对 ima 官网当前可见入口仍然围绕 `新对话 / 个人知识库 / 知识库广场 / 问答历史`
- 2026-04-16 已补真实开库态桌面验证：临时用真实 `.mv2` 自动开库后，首页轻状态条在桌面 UI 中可见，说明“当前库 / 最近库 / 最近导入可见”已经不只是测试通过而是真实可见
- 2026-04-16 本轮 fresh release 验证通过，并新增测试固定“其它知识库的问答历史不会出现在当前知识库首页”，覆盖 KB 维度历史隔离

**Files likely impacted:**

- `scripts/verify-release.sh`
- `scripts/verify-runtime-modes.sh`
- `scripts/verify-desktop-ui.sh`
- `docs/release-checklist.md`
- `docs/recovery-and-backup.md`
- `docs/ui-baseline/verification.md`

- [ ] 增加一条围绕“首次建库 -> 导入 -> 搜索/问答 -> 阅读 -> 草稿保存”的端到端验证脚本
- [x] 保持真实桌面 UI 验证，不允许黑屏或空白窗口误判
- [ ] 补首启失败、导入失败、KB 损坏、无结果查询等恢复策略
- [x] 明确 MVP 发布前必须通过的命令与人工检查项

**Verification**

- Run: `bash scripts/verify-release.sh`
- Expected:
  - 发布基线围绕 MVP 主链路，而不只是零散 smoke

---

## 六、明确要砍掉或延后的内容

在 `plan5.md` 周期内，应该默认延后这些能力的产品优先级：

- 图谱 / 实体 / 时间线
- AI 播客 / 报告 / PPT 类输出
- 任务模式类复杂编排
- WebDAV / Obsidian 同步打磨
- 更复杂的共享 / 广场 / 协作语义

这些能力不是永久放弃，而是：

- 不应该阻塞 MVP
- 不应该占据主导航与主文案
- 不应该优先于“建库、导入、搜索、阅读、写作”

---

## 七、最终判断

如果目标是“构建个人知识库，简单易用是最主要的”，那么 ClawKB 下一阶段最重要的事情不是继续补新能力，而是承认一件事：

**当前 ClawKB 的问题不是不会做知识库，而是还没有把知识库产品收成一个足够简单的 MVP。**

和腾讯 ima 对比，ClawKB 最应该学习的是：

- 产品心智集中
- 搜读写主链路优先
- 最近迭代围绕高频刚需而不是炫技能力

ClawKB 最应该坚持的是：

- 本地优先
- 个人单用户
- 数据可控
- 更安静、更轻、更直接

`plan5.md` 的目标，不是做一个“本地版 ima 全量复刻”，而是做一个：

**真正适合个人长期使用的本地知识库 MVP。**

---

## Sources

- 官方站点： [ima.qq.com](https://ima.qq.com/)
- 官方 App Store 页面： [ima - 腾讯 AI 工作台](https://apps.apple.com/cn/app/ima-%E8%85%BE%E8%AE%AF-ai-%E5%B7%A5%E4%BD%9C%E5%8F%B0/id6737188438)
- 官方 Tauri 调试参考： [Debugging a Tauri App](https://tauri.app/develop/debug/)
- 本地可用调试/验证 skills：
  - `/Users/louloulin/.codex/superpowers/skills/systematic-debugging/SKILL.md`
  - `/Users/louloulin/.codex/skills/playwright/SKILL.md`
  - `/Users/louloulin/.agents/skills/agent-browser/SKILL.md`
  - `/Users/louloulin/.codex/superpowers/skills/verification-before-completion/SKILL.md`
