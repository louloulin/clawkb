# ClawKB Production Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 ClawKB 打磨成“个人、本地、简单可用”的生产级知识库产品，在不扩新功能线的前提下，提升产品定位清晰度、数据可靠性、工程稳定性、验证覆盖和发布质量，使其成为本地个人版的 ima 替代品。

**Architecture:** 继续保留当前 Rust `clawkb-core` + Tauri + React 的分层架构，但不再继续横向铺功能，而是围绕“个人本地知识库”这一单一定位做减法和收口。后续优化以四条主线推进：产品定位收紧、数据与状态一致性、可验证性/可恢复性、发布质量和运维基线。

**Tech Stack:** Rust workspace (`clawkb-core` / `clawkb-cli` / `src-tauri`) + React 19 + TypeScript + Zustand + TipTap + shadcn/ui + Tauri 2 + memvid-core

---

## 一、当前代码的生产级差距结论

### 1. 产品定位已经接近，但还没有完全“收口”

目前仓库已经完成了从“多页面工具箱”到“Workbench / Spaces / Documents / Explore / Settings”壳层的重构，也已经把很多协作占位文案收回到“个人、本地、单用户”的方向上。但从生产级产品角度看，还存在几个未完全收口的问题：

- README、计划文档、页面文案之间仍有少量滞后信息
- `Dashboard`、`Chat` 这类旧页面虽然已弱化，但在代码和文案中仍带有历史包袱
- `joined/shared` 这类空间分类已经被重新解释为本地资料管理语义，但产品中仍然容易让用户联想到协作能力
- 当前“替代 ima”的说法只在目标层成立，还没有被凝练成一套更稳定的产品主张

结论：

- 现在最需要的是“定位统一”，不是继续加新模块
- 用户打开产品后，应该立刻理解它是“本地个人知识库工作台”，而不是“潜在协作平台”

### 2. 数据层已经可用，但还不够“生产可靠”

当前数据链路已经比早期版本真实很多：

- Folder metadata 已从 demo command 变成真实持久化
- Registry / active KB / document workspace / draft save 已有真实链路
- Batch tag、entity graph、space metadata 等都已从假实现切到真实实现

但距离生产级仍有差距：

- 大量状态仍依赖前端 localStorage，缺少统一的“本地持久化策略说明”
- 浏览器 demo 模式和真实 Tauri 模式共用一套前端 API，但语义仍有混杂
- 重要用户对象（draft、folder、registry、reading progress、bookmarks）分散在多个 store 中，缺少边界说明和一致性规范
- 目前仍缺少明确的“失败恢复”和“数据迁移”策略

结论：

- 当前不是“功能缺失”，而是“状态和持久化策略尚未产品化”

### 3. 前端可以构建，但还缺少生产级验证体系

好消息是：

- `cargo check` 已能 0 warning 通过
- `cd src && npm run build` 已通过，且拆包后的产物已比之前健康

真正的问题是：

- 仓库仍然没有正式测试目录或系统化测试结构
- 当前验证主要依赖人工命令和浏览器巡检，不足以支撑长期迭代
- 对关键用户流程的断言还没有变成可重复运行的自动化检查
- 没有 release gating，也没有“哪些命令必须过了才能发布”的统一规范

结论：

- 当前已达到“可继续开发”
- 但距离“生产发布有把握”还差一套测试与发布纪律

### 4. 运行模式仍然耦合

当前前端为了兼容浏览器模式和 Tauri 模式，在 `api/commands.ts` 中保留了大量 demo fallback，这在开发早期是必要的，但生产级上需要更清楚的边界：

- 浏览器 demo 是为了开发展示
- Tauri 本地模式才是产品主交付形态

继续混在一起的风险：

- 未来很容易误把 demo 行为当成产品行为
- 某些页面/状态在 browser mode 下看起来“能用”，但并非真实能力
- 代码审阅和故障排查时，需要频繁判断“这是 demo 还是真逻辑”

结论：

- 需要把 demo mode 做成更清晰、更显式、更可隔离的开发辅助层

### 5. 文档与资产管理仍有“阶段性残留”

仓库现在已经把大量截图归档到 `docs/ui-baseline/archive/`，这是很好的方向，但生产级还需要进一步清理：

- `plan1.md`、`plan2.md`、`plan3.md` 缺少角色区分，容易让新人误读
- README 与产品定位还有收紧空间
- 缺少一份面向用户/团队的“当前产品说明”
- 缺少一份面向开发者的“运行模式、验证命令、发布前检查”的约定文档

结论：

- 文档现在不再是“混乱”，但仍不是“生产交付级”

## 二、优化原则

这份计划坚持以下原则：

1. 不增加新的产品线功能
2. 只打磨现有能力，让定位更清晰、行为更稳定、交付更可靠
3. 桌面本地版本是第一优先级，浏览器模式是开发辅助
4. 优先清理会伤害用户信任和团队效率的问题
5. 每一阶段都要留下可重复验证的证据

## 三、建议优化范围

本次 `plan4.md` 不再做“功能规划”，只做“生产优化规划”。范围限定为：

- 产品定位与导航收口
- 状态与持久化整理
- demo/desktop 模式边界清理
- 测试与验证体系建立
- 文档与交付资产整理
- 发布级打包、错误处理、恢复策略

不包含：

- 云同步
- 多人协作
- 共享服务端
- 新的 AI 模块或新业务功能

## 四、后续实施计划

### Phase A: 产品定位与入口收口

**Goal:** 让产品从任何页面看起来都像“个人、本地知识库”，而不是残留多个历史阶段语义。

**Status:** Completed (2026-04-06)

**Completed work:**

- `Workbench`、`Spaces`、`Documents` 三个顶层入口的文案已统一到“个人、本地、单用户知识库”语义
- `Spaces` 中的本地库分类已从容易联想到协作的平台措辞，收口为更贴近个人产品的资料管理语义
- `Dashboard` 与 `Chat` 已被明确标注为历史兼容入口，而不是主产品入口
- `src/README.md` 已更新为当前成品定位说明
- 已补 `docs/product-positioning.md`，明确一句话定位、目标用户和非目标场景
- 已通过浏览器验证 `Workbench / Spaces / Documents` 三大入口文案的一致性

**Files:**
- Modify: `src/README.md`
- Modify: `src/src/components/layout.tsx`
- Modify: `src/src/components/shell/workbench-shell.tsx`
- Modify: `src/src/components/shell/knowledge-space-shell.tsx`
- Modify: `src/src/components/shell/document-workspace-shell.tsx`
- Modify: `src/src/components/pages/dashboard.tsx`
- Modify: `src/src/components/pages/chat.tsx`
- Create: `docs/product-positioning.md`

- [x] 审查所有顶层 shell 与迁移页文案，统一到“个人、本地、单用户知识库”语义
- [x] 明确哪些旧页面属于历史兼容入口，并在代码注释和文案上收口
- [x] 补一份 `docs/product-positioning.md`，定义一句话定位、目标用户、非目标场景
- [x] 清理 README 中仍然滞后的页面/能力描述
- [x] 用截图重新核对首页、空间页、文档页三大入口文案是否一致

**Verification**

- Run: `cd src && npm run build`
- Manual: 打开 `Workbench / Spaces / Documents`
- Expected:
  - 三个入口都明确传达“个人、本地、知识库工作台”
  - 不再出现容易误解为协作平台的默认表述

### Phase B: 状态与持久化架构收口

**Goal:** 把当前散落的 store 和 localStorage 行为梳理成一致、可解释、可维护的本地状态系统。

**Status:** Completed (2026-04-06)

**Completed work:**

- 已新增 `src/src/store/persistence.ts`，把浏览器侧持久化 key 和安全读写入口统一到单处管理
- `kb-store`、`chat-store`、`bookmark-store`、`ai-store`、`multi-kb-store`、`sync-store` 已统一改用集中 key 和持久化 helper
- `workspace-store` 与 `document-workspace-store` 已切到 `zustand/persist`，关键工作台状态和草稿状态可在刷新后恢复
- `App`、`reader`、`api/commands` 中零散的 `localStorage` 读写已收口到 store / persistence 层，减少页面级直接访问
- 已补 `docs/local-state-model.md`，明确 key 清单、状态分类、恢复边界与约束规则
- 已新增 `scripts/verify-local-state.sh` 与 `scripts/verify-local-state-playwright.mjs`，把 KB 恢复、workspace 恢复、draft 恢复变成可重复执行的真实校验

**Files:**
- Modify: `src/src/store/kb-store.ts`
- Modify: `src/src/store/workspace-store.ts`
- Modify: `src/src/store/document-workspace-store.ts`
- Modify: `src/src/store/chat-store.ts`
- Modify: `src/src/store/folder-store.ts`
- Modify: `src/src/store/bookmark-store.ts`
- Modify: `src/src/store/multi-kb-store.ts`
- Create: `src/src/store/persistence.ts`
- Create: `docs/local-state-model.md`

- [x] 盘点当前所有 localStorage key，形成统一清单
- [x] 提炼 `persistence.ts` 统一浏览器侧持久化读写与 key 管理
- [x] 标注哪些状态是“用户数据”、哪些状态是“会话 UI 状态”、哪些状态是“cache”
- [x] 减少页面级直接操作 localStorage 的情况，统一从 store/persistence 层进入
- [x] 为关键本地状态写恢复策略说明：KB path、draft、folder tree、bookmarks、chat history
- [x] 写 `docs/local-state-model.md`，描述状态边界和生命周期

**Verification**

- Run: `cd src && npm run build`
- Run: `bash scripts/verify-local-state.sh`
- Manual:
  - 打开应用
  - 切换 KB
  - 保存 draft
  - 创建 folder
  - 重启页面
- Expected:
  - 关键状态恢复符合预期
  - 不出现多个 store 相互覆盖或状态漂移

### Phase C: Demo Mode 与 Desktop Mode 边界清理

**Goal:** 让开发展示模式和真实产品模式边界清晰，减少误判和未来维护成本。

**Status:** Completed (2026-04-07)

**Completed work:**

- 已删除 `src/src/api/demo-fixtures.ts`，浏览器侧不再注入 sample KB、demo notes、demo folders 或任何假数据
- `src/src/api/commands.ts` 已收口为纯桌面命令桥，浏览器环境统一返回 `ClawKB desktop runtime required`
- `src/src/api/platform.ts` 已改为输出 `desktop-local / browser-unsupported`，明确浏览器只允许 preview，不再伪装成可用产品模式
- `App` 已在非 Tauri 环境下直接渲染 runtime gate，而不是自动打开假的浏览器知识库
- `docs/runtime-modes.md` 与相关提示文案已同步改成 preview-only 语义，避免继续把 demo 当成产品能力
- `scripts/verify-runtime-modes.sh` 与 `scripts/verify-runtime-modes-playwright.mjs` 已改为校验 `Desktop runtime required` 守卫页
- 已新增 `scripts/verify-desktop-ui.sh`，真实拉起 Tauri 窗口并校验桌面 UI 确实打开

**Files:**
- Modify: `src/src/api/commands.ts`
- Modify: `src/src/api/platform.ts`
- Modify: `src/src/App.tsx`
- Modify: `src/src/components/layout.tsx`
- Modify: `src/src/components/pages/settings.tsx`
- Modify: `src/src/components/pages/import.tsx`
- Delete: `src/src/api/demo-fixtures.ts`
- Create: `docs/runtime-modes.md`
- Create: `scripts/verify-desktop-ui.sh`

- [x] 删除浏览器侧 demo fixtures 和假数据 fallback
- [x] 明确区分“真实命令桥接层”和“浏览器 preview 守卫页”
- [x] 让非桌面环境直接暴露 desktop-only 边界，而不是继续展示伪能力
- [x] 统一梳理哪些交互只能在 desktop local 下执行
- [x] 写 `docs/runtime-modes.md`，解释 browser preview / desktop local 的差异

**Verification**

- Run: `cd src && npm run build`
- Run: `bash scripts/verify-runtime-modes.sh`
- Run: `bash scripts/verify-local-state.sh`
- Run: `bash scripts/verify-desktop-ui.sh`
- Manual:
  - 浏览器模式打开 app
  - 检查 runtime gate 文案与 desktop-only 提示
  - Tauri 模式真实拉起窗口
- Expected:
  - 任何开发者都能快速判断当前运行在 preview 还是真实本地模式
  - 浏览器中不再出现伪造的 KB 数据与假命令结果

### Phase D: 测试与发布验证体系

**Goal:** 从“人工证明能跑”升级到“可重复验证能发”。

**Status:** Completed (2026-04-07)

**Completed work:**

- 已新增 `crates/clawkb-core/tests/core_regression.rs`，补上 KB round-trip 回归：note/search、folder move/search、tag rename/merge/delete
- 已修复 `classify::extract_filename_tags` 对 `Q4 / 2024` 这类文件名标签的错误过滤，并让现有单测重新成为稳定回归
- 已修复 `KnowledgeBase::list_tags()` 的标签统计链路，改为直接枚举 frame tags，而不是依赖脆弱的二次搜索
- 已新增前端 smoke 测试目录 `src/src/__tests__/`，覆盖 shell switching、mention scope、document workspace、spaces metadata 编辑
- 已引入 `vitest` + `jsdom` 测试基线，并补 `src/vitest.config.ts` 与 `src/src/test/setup.ts`
- 已新增 `src/src/__tests__/store-persistence.test.ts`，把 workspace / draft 的本地持久化回归固定下来
- 已新增 `scripts/verify-release.sh`，统一串联 Rust 测试、前端 smoke、前端 build、runtime mode 验证、本地状态恢复验证与桌面 UI 拉起验证
- 已补 `docs/release-checklist.md`，定义自动化基线与发布前人工检查项
- 关键巡检流程已沉淀为脚本：`verify-runtime-modes.sh`、`verify-local-state.sh`、`verify-desktop-ui.sh`

**Files:**
- Create: `crates/clawkb-core/tests/`
- Create: `src/src/__tests__/`
- Create: `scripts/verify-release.sh`
- Create: `scripts/verify-desktop-ui.sh`
- Modify: `src/package.json`
- Modify: `Cargo.toml`
- Create: `docs/release-checklist.md`

- [x] 为 `clawkb-core` 补一组核心回归测试：folder、tag、entity、search、registry 相关行为
- [x] 为前端补最小 smoke 测试：shell 切换、mention scope、document workspace、spaces metadata 编辑
- [x] 新增 `verify-release.sh`，统一生产前必须通过的命令
- [x] 定义“发布级验证”最小集合并写入 `docs/release-checklist.md`
- [x] 把当前依赖浏览器人工巡检的关键流程，至少沉淀成脚本化步骤

**Verification**

- Run: `cargo test`
- Run: `cd src && npm test` 或等价 smoke command
- Run: `bash scripts/verify-release.sh`
- Expected:
  - 发布前检查有明确、可重复、可自动执行的基线
  - 自动化结果中包含一次真实桌面窗口拉起证据

### Phase E: 错误处理、恢复与打包质量

**Goal:** 让产品从“开发完成”走到“用户遇错也不会崩”的阶段。

**Status:** Completed (2026-04-07)

**Completed work:**

- 已新增 `src/src/lib/app-error.ts`，把前端错误统一分成 `user / system / runtime` 三类，并统一对应的标题与提示口径
- `Settings`、`Import`、`Search`、`Editor` 的关键失败场景已接入统一错误分类，不再直接把原始异常字符串无差别抛给用户
- `Settings` 与 `Import` 在浏览器 preview 下已改为明确提示 `Desktop runtime required`，避免伪装成真实本地文件操作
- `Search` 已不再静默吞掉失败，空查询、未就绪 KB 等场景会给出明确用户提示
- `Import` 已对空路径、preview 下的本地文件/媒体导入、OCR 失败等场景给出统一且可理解的反馈
- `Editor` 保存草稿时已补用户输入校验与失败提示，空标题/空内容保护更明确
- `src-tauri/src/commands/mod.rs` 已补一层用户可读错误映射，减少 `Knowledge base not open`、`File not found` 这类底层描述直接泄露到 UI
- 已新增 `docs/recovery-and-backup.md`，明确本地 KB 备份、恢复与 browser preview 的边界
- 已新增 `scripts/verify-error-handling.sh`，把错误分类回归固定成可重复执行的脚本
- 已补 `src/src/__tests__/app-error.test.ts`，覆盖错误分类规则的最小回归

**Files:**
- Modify: `src/src/components/pages/settings.tsx`
- Modify: `src/src/components/pages/import.tsx`
- Modify: `src/src/components/pages/reader.tsx`
- Modify: `src/src/components/pages/editor.tsx`
- Modify: `src/src/components/pages/search.tsx`
- Modify: `src-tauri/src/commands/mod.rs`
- Create: `docs/recovery-and-backup.md`

- [x] 统一错误提示分级：用户错误 / 系统错误 / runtime 限制
- [x] 为导入、搜索、打开 KB、保存 draft 等关键动作增加更一致的失败反馈
- [x] 明确“个人本地知识库”的备份/恢复建议，并写进文档
- [x] 审查当前 Tauri 命令错误字符串，减少面向用户的底层实现泄露
- [x] 定义生产打包时要检查的应用信息、默认路径、首次启动体验

**Verification**

- Run: `cargo check`
- Run: `cd src && npm run build`
- Run: `bash scripts/verify-release.sh`
- Run: `bash scripts/verify-error-handling.sh`
- Manual:
  - 故意给错误路径
  - 导入不存在文件
  - 打开不存在 KB
  - 保存空 draft
- Expected:
  - 错误提示更稳定、可理解、可恢复

## 五、计划优先级

### P0

- Phase A: 产品定位与入口收口
- Phase B: 状态与持久化架构收口

### P1

- Phase C: Demo Mode 与 Desktop Mode 边界清理
- Phase D: 测试与发布验证体系

### P2

- Phase E: 错误处理、恢复与打包质量

## 六、最终建议

要把 ClawKB 做到“个人、本地、生产级知识库”，关键不是再加多少功能，而是把以下几件事做到位：

- 用户一眼看懂这是“自己的本地知识库”
- 本地状态恢复和数据持久化可靠
- preview 与真实模式边界清晰
- 发布前有可重复验证
- 出错时用户知道发生了什么、怎么恢复

这份 `plan4.md` 的目标，就是把当前已经很强的功能原型，收成真正可以长期使用和持续维护的产品基线。
