---
slug: /roadmap
---

# 路线图

为了让 **XTL 1.0**（规范）和 **xl3 1.0**（参考实现）成型，需要落地哪些事项。

当前版本为 **0.7.0**（npm），对应 **XTL 0.1（草案）**。在 0.x 阶段仍可能引入不兼容变更。1.0 的发布以下表中的事项为门槛，而不是以日历日期为准。

> **深度的版本规划**收录在
> [`docs/internal/blueprint-to-1.0.md`](https://github.com/xl3-lang/xl3/blob/main/docs/internal/blueprint-to-1.0.md)
> ——包含差距分析、哲学边界（xl3 ≠ JXLS）以及逐版本的步骤规划。本文档是"电梯演讲"版本；蓝图文档承载完整的论证依据。
>
> **1.0 关卡的单一可信来源是下方表格。** 当本文件与蓝图文档冲突时，以本表格为准；蓝图随之更新对齐。

## 1.0 对 xl3 意味着什么

1.0 的目标是**让运维人员能够"看得懂、信得过"**：规范不再漂移，参考实现不再带来意外，整体表面足够小，让运维同学不用读代码就能审阅一个模板。它**不是**要在功能完备性上和 JXLS 比拼——xl3 有意保持更小的能力面（ADR-0043 + ADR-0048）。预设的核心用户是**管理大量客户专属票据格式的韩国运营团队**（거래명세서、정산서、발주서）；引擎本身可以泛化到这个领域之外，但这个细分场景是切入点。

## 1.0 关卡表格（单一可信来源）

每个关卡都有所有者、用于关闭它的产出物、判定通过/失败的标准、关卡不可达时的降级方案，以及目标里程碑。下方逐版本步骤规划通过 ID 引用这些关卡。

| ID | 关卡 | 所有者 | 产出物 | 通过标准 | 降级方案 | 目标 |
|----|------|-------|--------|---------|---------|------|
| G1 | 一致性语料 ≥ 140 | 维护者 | `conformance/fixtures/` | `ls conformance/fixtures/ \| wc -l` ≥ 140 | — | 0.7.1（当前 139；0.7.0 ADR 预留 141–187） |
| G2 | Stage 2 OOXML 规范化完成 | 维护者 | ADR-0006 + src/ 中的 canonicalizer | 由测试用例 024-027、093 + ADR-0006 修订覆盖 | — | DONE |
| G3 | 错误码目录冻结 | 维护者 | `src/__tests__/error-codes.test.ts` 快照 | 目录快照 30 天保持不变 | — | 0.9-rc（0.7.0 新增 4 个错误码，2026-05-22 时钟重置） |
| G4 | 发布 JXLS 边界 | 维护者 | ADR-0048 | 文件存在并引用 PORTERS_GUIDE | — | DONE |
| G5 | 延期实现的 ADR 落地 | 维护者 | ADR-0038 实现 ✅（2026-05-18）+ ADR-0040 PE 实现 | ADR-0038 部分已发布（测试用例 132-135）；ADR-0040 CF/DV 区间扩展仍在进行中 | — | 0.6（部分）/ 0.7.1 |
| G6 | 公开 API 表面冻结 | 维护者 | `src/__tests__/api-surface.test.ts` 快照 | 快照 30 天保持不变 | — | 0.9-rc |
| G7 | @stable 导出项的 JSDoc 示例 | 维护者 | TypeDoc 输出 | 每一个 `@stable` 符号都附带 `@example` 区块 | — | 0.8 |
| G8 | 性能特性描述 | 维护者 | `scripts/BENCH.md` | 发布 1k/10k/100k 行 × 5/10/20 列矩阵 + 内存上限 + parse/eval/write 分项数据 | — | 0.7.1 |
| G9 | 性能回归测试用例 | 维护者 | 一致性语料 | ≥ 2 个大体量 fixture，使用基于比率的断言 | — | 0.7.1 |
| G10 | 跨浏览器冒烟测试 | 维护者 | `ci.yml` | Safari + Firefox bundle 加载 + 每次运行至少一次 convert() | — | 0.7.1 |
| G11 | Stage 2 接入 CI | 维护者 | `ci.yml` | 每个 PR 都运行 `npm run conformance:stage2` | — | 0.7.1 |
| G12 | 未定行为定锚（pivot/sparkline/ListObject/分页） | 维护者 | 一致性测试用例 + 每项一份 ADR | 每项：要么有 fixture 锚定当前行为，要么有 ADR 显式延期到 1.x | 配 ADR 推迟到 1.1 | 0.7.1 / 0.8 |
| G13 | 第二语言实现验证 | 外部（xl3-py） | `conformance/reports/*.json` | xl3-py 通过 Stage 1 ≥ 80% 或 Stage 2 ≥ 80%；或在其他所有关卡关闭后的 12 个月内，某个其他语言（Rust/Go/Java）有文档化的 50% 骨架实现 | 通过公开 ADR 修订 GOVERNANCE，接受单实现 1.0 | 0.7.x–0.8.x |
| G14 | 外部贡献者 ADR | 外部 | `spec/decisions/NNNN-*.md` | ≥ 1 份 ADR 的 Author 是非维护者（按行数计，Context/Decision 章节 ≥ 60% 由其撰写） | 18 个月时间盒，到期后：≥ 2 份外部作者撰写的 cookbook 配方，或 ≥ 5 份外部作者撰写的一致性测试用例 | 0.8 |
| G15 | 生产参考案例 | 外部（维护者协助） | `IMPLEMENTATIONS.md` 中"生产用户"一行 | ≥ 1 名具名用户，满足以下任一：(a) 外部公司允许公开列出，或 (b) 维护者所在公司在生产中按计划运行 xl3 并发布公开案例研究 | — | 0.8 |
| G16 | 维护者集合扩大 | 维护者 | `GOVERNANCE.md` | ≥ 2 人拥有 ADR 和实现 PR 的接受/拒绝权限 | 通过对 GOVERNANCE 的修订，显式接受单维护者形态的 1.0 治理结构 | 0.8 |
| G17 | 韩文 cookbook 国际化完成 | 维护者 | `website/i18n/ko/.../guides/` | 全部 cookbook 配方均有韩文翻译 | — | DONE（0.6） |
| G18 | README 中的生产用例 | 维护者 | `README.md` | 用具体的生产参考案例替换 "alpha" 状态（与 G15 绑定） | — | 1.0（与 G15 同步） |
| G19 | 0.x → 1.0 迁移指南 | 维护者 | `docs/migration-0.x-to-1.0.md` | 记录每一个行为变更，或确认是纯新增式变更 | 若确认为纯新增式变更，则降级为 CHANGELOG 备注 | 0.8 |
| G20 | SECURITY.md + 威胁模型 | 维护者 | `SECURITY.md` + 规范修订 | 文档化对 zip 炸弹 / 超大工作簿 / 公式执行的立场和 limits API | — | 0.7.1 |
| G21 | 硬限制文档化（1.1 前不支持流式） | 维护者 | spec/evaluation.md | 行数 / 内存的硬限制值 + AbortSignal API 已记录在文档中 | — | 0.7.1 |
| G22 | API 表面——内部模型类型剥离 | 维护者 | `src/index.ts` 导出 + STABILITY.md | 只保留 `convert`/`preview`/`analyze` + 标注为 `@stable` 的稳定接口；模型/解析器类型标注为 `@experimental` 或迁移到 `xl3/internal` | — | DONE（0.6） |
| G23 | RC 浸泡期 | 维护者 | git 标签 | RC 已发布；浸泡期 ≥ 21 天（根据评审反馈，从 7 天延长）；0 个严重问题 | — | 0.9-rc |
| G24 | "稳定季度"发布前清单 | 维护者 | 发布日历 | 最后一个关卡 ✅ 后的 90 天窗口；窗口内不发生规范/API/错误码的不兼容变更 | 发生不兼容变更 → 重置时钟 | 介于最后一个关卡 ✅ 和 1.0 发布之间 |

### 定义（可测试）

- **外部贡献者（G14）：** 在 PR 打开时，既不在 `GOVERNANCE.md` 维护者集合中，也未出现在已合入 ADR 提交的 `Co-authored-by` 历史中。顺手改错别字的编辑不计入；需以 Author 身份出现在 ADR 前置元数据中；按行数计，Context/Decision 章节 ≥ 60% 由其撰写。
- **不兼容变更（G24、G23）：** 对以下任一项的修改：(a) 公开 API 表面快照；(b) 错误码目录（重命名/删除/重新用途化）；(c) ADR `accepted` → `rejected`，或与原状态冲突的状态翻转。补丁版本和纯新增式 ADR **不**重置季度时钟。
- **关键 bug 修复（G23 RC 例外）：** (a) `convert()` 中的静默数据丢失；(b) 文档和运行时之间的错误码目录不一致；或 (c) 某个 `accepted` ADR 中的 MUST 按现有写法无法实现。维护者需在 PR 中标明命中的是 (a)/(b)/(c) 中的哪一项。
- **数据丢失测试（G24 可测试形式）：** 语料中存在专门的 `data-loss/` fixture 分组（≥ 8 个 fixture），覆盖静默字符串化、numFmt 丢失、公式改写、日期往返路径；全部在参考实现上通过。
- **季度时钟起点（G24 与 G23）：** G24 的 90 天季度从**最后一个**关卡 ✅ 的当天开始计时。RC 发布**不**启动时钟；时钟必须在 RC 发布**之前**已经开始。若 RC 浸泡期间发生不兼容变更，则浸泡期（G23）和季度（G24）双双重置。

## 逐版本步骤规划

基于关卡，而非基于日期。日历估时已移除——每个里程碑在它列出的关卡全部关闭时才算关闭。

### 0.6.0 —— 延期实现，范围收窄

主题：干净利落地关闭影响最大的延期实现关卡。

关闭的关卡：**G5**（仅 `@group`/`@subtotal` 实现——ADR-0040 PE 的其余部分移入 0.6.1）、**G17**（韩文 cookbook 还缺 16/17 篇翻译）、**G22**（在 `@group` 暴露新的内部类型之前先收敛 API 表面）。

按工程可行性评审的反馈，原先"在一个 0.6.0 里塞下所有东西"的计划范围过大。仅 ADR-0038 的实现就涉及一次完整的管线插入（新增指令、分组边界状态机、transform-pass 切分、渲染器重写、分组作用域的聚合求值）。把 0.6.0 拆开能让这个里程碑可以真正交付。

### 0.6.1 —— 延期实现的剩余部分（已规划，尚未发布）

关闭的关卡：**G5** 完结（ADR-0040 PE：CF/DV `sqref` 扩展），以及 pivot/分页行为 fixture 朝 **G12** 推进。

0.7.0 发布时的状态：本里程碑被规范审计批次（0.7.0）跳过。G5/G12 的工作被合并到 0.7.1。

### 0.7.0 —— 规范审计批次（已于 2026-05-22 发布）

主题：关闭一次深度审计揭示出的 17 个语法冲突缺口，覆盖词法分析、单元格分类、指令组合、聚合参数和保留工作表语义。原关卡表中未计划；原本挂在 0.7.0 上的性能/CI/limits 工作移入 **0.7.1**。

已发布的产出物：

- 15 份新 ADR（0051–0065）+ ADR-0021（group-order 目录条目）和 ADR-0041（表头单元格多行规范化）的修订。
- 4 个新错误码——`xl3/parser/unbalanced-literal`、`xl3/lists/invalid-use`、`xl3/eval/bad-aggregate-arg`、`xl3/expression/unknown-name`。
- 语法补充：`positive_integer`、`group_directive`、`subtotal_directive`、`aggregate_call`，以及一段词法消歧义说明。
- `src/directive-parser.ts` 对前导零整数加严。
- 双通道并行评审（claude-general + codex）；所有 CRITICAL/HIGH 发现已在打 tag 前关闭。

对关卡的影响：

- **G1** —— 当前 139 个 fixture。0.7.0 的 ADR 预留了 fixture 编号 **141–187**；实现仍在进行中。这些 fixture 在 0.7.1 落地后 G1 即关闭。
- **G3** —— 30 天错误码目录时钟于 2026-05-22 因新增 4 个错误码而**重置**。
- **G6** —— 公开 API 表面无变化；G6 时钟不受影响。

### 0.7.1 —— 性能 + 外部验证启动（从旧的 0.7.0 重命名而来）

关闭的关卡：**G5** 完结（ADR-0040 CF/DV `sqref` 区间）、**G8**（性能基准）、**G9**（性能回归测试用例）、**G10**（跨浏览器）、**G11**（Stage 2 进 CI）、**G20**（SECURITY.md 草案 + 威胁模型）、**G21**（硬限制 + AbortSignal 文档）。

同时通过落地 0.7.0 ADR 预留的 141–187 号 fixture，关闭 **G1 ≥ 140 fixture** 的底线。

推进进度：**G12**（未定行为定锚）、**G13**（xl3-py）。

重新标注：在 G8 发布且 xl3-py 在 Stage 1 达到 ≥ 50% 后，将 `alpha` 改为 `beta`。

### 0.8.0 —— 社会性关卡

关闭的关卡：**G14**（外部 ADR）、**G15**（生产案例）、**G16**（维护者扩员，或显式接受单维护者形态）、**G19**（迁移指南）、**G20** 完结。

这是耗时最长的一个里程碑。计划是在招募期间持续发布 0.8.x 补丁版本，而不是默不作声地等待。

### 0.9.0-rc.x —— 1.0 前的冻结期

关闭的关卡：**G3**、**G6**、**G7**、**G23**（≥ 21 天的 RC 浸泡期）。

G23 启动后，G24 的季度时钟开始（它必须在 G3/G6/G7 等关卡关闭过程中就已经走起来——见上方定义）。

### 1.0.0 —— 最终发布

关闭的关卡：**G24**（最后一个关卡 ✅ 之后的 90 天季度走完）。

## 招募与外联

社会性关卡（G13/G14/G15/G16）需要的是人，而不是代码。项目有两个截然不同的招募面向：

### 韩国运营受众（G15、未来的 cookbook 贡献者）

渠道：韩国开发者社区（Naver Café、Kakao 오픈톡、LinkedIn KR）、公司内部 / 供应商模板作者调研。每个小版本发布都会配套一篇与发布节奏绑定的韩文文章（0.6 = `@group`/`@subtotal` 在票据小计场景的演示；0.7 = 性能数据；0.8 = 案例研究）。

### 英文 OSS 受众（G13、G14）

渠道：HN、lobste.rs、r/excel、各类大会 CFP（JSConf、面向 xl3-py 的 EuroPython）。每个重大节点都会配套一份具体的对外产物：

- 0.7.0 发布："Show HN: xl3 0.7 —— 10 万行级别的 Excel 模板引擎"
- 0.8.0 发布：案例研究 + xl3-py 一致性面板
- 1.0.0 发布：规范 + 多实现交叉验证

## 1.0 的非目标

这些内容是有意延期的。每一项都有对应 ADR 说明原因：

- **超出 Y/M/D/EOMONTH/EDATE/DATEDIF 之外的日期运算** —— 该家族其余部分按
  [ADR-0019 修订](/zh-CN/spec/decisions/deferred-date-arithmetic)延期。
- **区域感知的字符串排序** ——
  [ADR-0020](/zh-CN/spec/decisions/deferred-locale-collation)。
- **多表 join、左连接、多行匹配** ——
  [ADR-0014](/zh-CN/spec/decisions/source-joins) 的范围外章节。
- **XLOOKUP 通配符 / 近似匹配 / 反向搜索** ——
  [ADR-0013](/zh-CN/spec/decisions/xlookup-cross-source-lookup) 的范围外章节。
- **动态图片插入** —— [ADR-0037](/zh-CN/spec/decisions/rejected-dynamic-image-insertion)。
- **运行时单元格变更** —— [ADR-0042](/zh-CN/spec/decisions/rejected-runtime-cell-mutation)。
- **按 ADR-0043 关卡被拒绝的函数** —— 数学扩展、类型判定（按 ADR-0047 例外保留 `ISBLANK`）、NOW / WEEKDAY 等、条件聚合、TEXT() 格式 token 扩展。详见
  [ADR-0045](/zh-CN/spec/decisions/function-batch-rejected)。
- **流式输出 / SXSSF 类似物。** 延期至 1.1+。**在 1.0，作为替代会文档化硬性的内存/行数上限（G21）。**
- **模板编译缓存 API。** 延期至 1.1+。
- **PDF / HTML 输出。** 范围外；xl3 的契约是 xlsx-in、xlsx-out。
- **超出 `093` 的跨写入器 Stage 2 fixture** ——
  [ADR-0006](/zh-CN/spec/decisions/stage-2-ooxml-conformance) 修订。

这些仍然是 **XTL 1.1、1.2、1.x** 的候选项，取决于需求强度。

## 如何帮助关闭事项

| 事项 | 如何帮忙 |
|---|---|
| G13 第二实现 ≥ 80% | 参与 [xl3-py](https://github.com/jinyoung4478/xl3-py)，或启动一个新的移植（Rust、Java、Go）。参见 [PORTERS_GUIDE.md](/zh-CN/porters-guide)。 |
| G14 外部 ADR | 挑选一个延期项（pivot 表保留、分页符、ADR-0045 切出的函数等），在 `spec/decisions/` 中起草一份 ADR。参见 [GOVERNANCE.md](/zh-CN/governance) 中"变更如何进入项目"。GitHub 上以 `good-first-ADR` 标签提供了若干"入门 ADR 草稿"议题。 |
| G15 生产案例 | 在内部使用 xl3，并分享行得通 / 行不通的地方。如果合适，在 [IMPLEMENTATIONS.md](/zh-CN/implementations) 中加一行。如果维护者所在公司（Snack24h）发布公开案例研究，也可作为生产参考案例计入。 |
| G17 韩文 cookbook 16+17 国际化 | 翻译最新的两篇配方（其余已完成）。 |
| G8 基准测试 | 在有代表性的模板上运行 `npm run bench`，分享结果。 |
| G10 跨浏览器 | 把 Safari + Firefox 加入 bundle 冒烟测试。 |
| 函数再提案 | 如果你需要某个被 ADR-0045 拒绝的函数，请使用 [`Function re-proposal`](https://github.com/xl3-lang/xl3/issues/new?template=function-reproposal.md) 议题模板提交。 |

## 本路线图如何演进

本文档是公开的"电梯演讲" + 关卡表是单一可信来源。更深层的
[`docs/internal/blueprint-to-1.0.md`](https://github.com/xl3-lang/xl3/blob/main/docs/internal/blueprint-to-1.0.md)
承载差距分析、哲学边界以及逐版本的论证依据。随着关卡逐个 ✅，两份文档都会更新。每当出现新的缺口，两份文档都会补上。

对 1.0 关卡表格的删减和新增，与其他任何事项一样，通过相同的 ADR / 议题流程讨论。
