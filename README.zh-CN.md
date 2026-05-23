# xl3

> Excel 转换,在 Excel 之中,用 Excel 语法。
> 把反复出现的 Excel 转换规则放在工作簿模板里。

**状态:** alpha · XTL spec 0.1 (draft) · 1.0 之前可能存在 breaking change

xl3 从技术层面已经趋于稳定,但作为项目仍处于成型期 —— 单一维护者、
尚无生产环境参考案例、治理结构刚刚成文。审计通道已经合上了所有
silent-fallthrough 入口,加上 0.8.0 的数据块更新后,语料库达到 70 个
ADR、154 个 fixture,全部通过。语言表面对早期使用者来说已经足够稳定。
**目前最有价值的贡献就是真实使用后的反馈** —— 1.0 的阻塞项参见 [ROADMAP.md](./ROADMAP.md),决策方式
参见 [GOVERNANCE.md](./GOVERNANCE.md)。

**0.7.0 → 0.8.0 主要变化**(2026 年 5 月):数据块现在采用
**按列界定(column-scoped)** 的形态(ADR-0066)。引擎会取工作表上
所有 `{{ ... }}` 标记的外接矩形,再向相邻的非空单元格延伸,共同
确定数据块的列范围。该范围之外的单元格 —— 侧边汇总表、表头列、
右侧备注等 —— 在数据块展开时保持原本的行位置,不再被行的增加推开。
这从结构上修复了两个长期存在的缺陷 —— #46(shared-formula owner
被重复复制,导致单元格静默丢失)与 #47(被横向推开的侧边单元格,
公式引用错位)。

0.8.0 还新增了显式的 **`@block`** 指令(ADR-0067),共有三种写法:

- `{{ @block }}` —— 无参数,列范围由标记自动推断
- `{{ @block A:D }}` —— 显式指定列范围
- `{{ @block A2:D7 }}` —— 显式指定行 × 列矩形

使用 `@block` 的工作表将启用严格(strict)的多块检测(ADR-0068)
—— 所有 `[Column]` 标记都必须落在某个块内,块矩形之间不能重叠。
其他指令按邻近度自动绑定到最近的重叠块(ADR-0069)。
**向后兼容:** 没有 `@block`、且块外侧列也没有内容的模板,渲染
结果与 0.7.x 完全一致;`@block` 是可选(opt-in)特性。

**0.6.0 → 0.7.0 主要变化**(2026 年 5 月):一组 15 个 ADR
(ADR-0051..0065)关闭了所有残余的语法冲突面 —— 也就是同一种模板写
法可能被解析成两种含义、或者被静默忽略的位置。对用户最显眼的变化是
**聚合函数参数形态收紧**(ADR-0059):`SUM`、`AVERAGE`、`MIN`、
`MAX` 以及单参数的 `COUNT` 现在只接受单列引用(`[Column]` 或
`Source[Column]`),像 `SUM([数量] * [单价])` 这样的逐行算式会在解
析阶段直接被 `xl3/eval/bad-aggregate-arg` 拒绝 —— 解决方法是在源数
据中加一列辅助列,或者在底部汇总单元格里写原生
`=SUMPRODUCT(...)`(详见
[Cookbook 03](./docs/guides/03-aggregates.md) 与
[Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md))。0.7.0
固化的其他行为还涉及字符串字面量分隔符的边界(0051)、混合文本中
错误值的传播(0053)、裸名字解析(0054)、`@subtotal` 行的组合规
则(0058)、`XLOOKUP` 的 value 参数规则(0060)、`__inputs__` 中
default 与 options 的拆分规则(0062、0063),以及字符串到数字的强
制转换范围(0064)。

**0.5.x → 0.6.0**(2026 年 5 月稍早):原生支持源工作簿中的**合并单
元格表头**(ADR-0033)—— 这是中国 B2B 模板(对账单、结算单、采购订
单)中非常常见的样式。数据行里的合并单元格会把主值广播到所有从单元
格(ADR-0035)。新增了一份覆盖图片、条件格式、定义名称、冻结窗格、
工作表保护、数据验证与单元格批注的规范化保留矩阵(ADR-0036)。
0.6.0 同时加入了 **`@group` / `@subtotal`** —— 可以在同一个数据块
内交错生成按客户、按月的小计行(ADR-0038),这正是中国 B2B 对账场景
里的常见排版。`__inputs__` 中的 default、label、description、options
四类单元格现在会作为 XTL 模板在受限上下文中求值,主程序界面里再也
不会看到 `{{ TODAY() }}` 这样的原样占位符(ADR-0050)。

**范围(ADR-0043)。** XTL 的函数集合刻意比 Excel 小。规则是:只有
当一个函数的结果**必须在工作簿写出之前**就确定时,它才出现在 XTL 里
—— 比如 `@filter`、`@sort`、`@group`、`@subtotal`、源端聚合、文件名
与工作表名模式,或者 `__inputs__` 的默认值。凡是 Excel 在打开工作簿
时自己就能算的(可视化格式、按单元格的算式、类型判断)都留给 Excel
单元格公式,xl3 会原样保留。对照写法参见
[Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md)。

[English](./README.md) · [한국어](./README.ko.md) · [日本語](./README.ja.md) · **简体中文** · [繁體中文](./README.zh-TW.md) · [Español](./README.es.md) · [Website](https://xl3.io) · [Spec](./spec) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

> **正在用 LLM(Claude、GPT、Gemini、Codex、Cursor 等)编写 xl3 模板?** 请先阅读 [`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md) —— 它讲清了 LLM 几乎每次都会犯的一个错误(残留的样式行污染每一份输出)以及如何避开。该文档保持英文,因为它是 LLM 直接参考的资料。

---

## xl3 是什么?

xl3 把 Excel 转换逻辑**放在 Excel 文件里面**,而不是写在代码里。非开
发人员可以直接打开模板阅读和修改规则,因为这些规则就是他们每天都在
用的 `IF`、`SUM` 和列引用。开发者交付引擎,工作簿承载工作流。

结构很简单:

- 谁:不需要看代码的运营和分析人员
- 做什么:反复出现的 Excel 转换工作
- 怎么做:模板工作簿、`source_table`,加上熟悉的 Excel 公式

```text
raw.xlsx        (输入数据)
       +
template.xlsx   (工作流契约)
       ↓
result.xlsx     (完成的工作簿)
```

开发者用代码维护引擎,运营走的是基于文件的流程:上传原始 Excel、
选定经过审核的模板、下载完成的工作簿。

模板**直接在 Excel 中编写**。在 `__config__` 里写配置,在单元格
里写 `{{ [客户] }}` 或
`{{ IF([续约金额] > 10000, "优先", "普通") }}` 这样的表达式,保
存文件,然后运行 xl3。没有宏、没有隐藏脚本、不依赖任何第三方云。

模板本身就是交接物。可以被评审、可以打版本、可以归档,也可以直接交
给下一个负责人,而不必让对方先去读自动化代码。

## 一个简单的例子

模板里可以同时包含普通 Excel 内容、`__config__` 和 xl3 表达式:

| `__config__` 键 | 值 |
|---|---|
| `source_sheet` | `原始数据` |
| `source_table` | `1` |
| `output_file_pattern` | `客户-续约报告.xlsx` |

| 单元格 | 模板值 |
|---|---|
| A5 | `{{ [客户] }}` |
| B5 | `{{ [区域] }}` |
| C5 | `{{ [续约金额] }}` |
| E5 | `{{ IF([续约金额] > 10000, "优先", "普通") }}` |

给定下面这份数据工作簿:

| 客户 | 区域 | 续约金额 | 负责人 |
|---|---|---:|---|
| 北京物流 | 北京 | 18400 | 李敏 |
| 上海贝塔工程 | 上海 | 7200 | 王俊 |

xl3 渲染出的结果:

| 客户 | 区域 | 续约金额 | 负责人 | 等级 |
|---|---|---:|---|---|
| 北京物流 | 北京 | 18400 | 李敏 | 优先 |
| 上海贝塔工程 | 上海 | 7200 | 王俊 | 普通 |

输出仍然是一个 `.xlsx` 工作簿。模板里的格式、数字格式、合并单元格
都是结果的一部分,不是顺带产生的附加物。

语言草案参见 [`spec/`](./spec),实现无关的 fixture 语料库与 runner
协议参见 [`conformance/`](./conformance)。

## xl3 为什么存在

很多报表流程其实早就活在电子表格里了:续约报表、结算单、对账单导出、
内部运营模板。它们通常是用一次性的 Python 脚本、VBA 宏、或者某个服
务自带的工作流步骤来自动化的。在规则被分散到代码、账号和口口相传的
经验里之前,这些做法都还能用。

xl3 把可复用的引擎和工作簿特定的契约拆开。把部署、校验、集成这类事
情放在代码里;把反复出现的业务流程留在工作簿里。

## xl3 强调什么

- **基于文件的流程。** 原始 `.xlsx` 进来、经审核的模板进来、完成的
  工作簿出去。
- **规则跟着工作簿走。** `__config__`、表达式、版式、输出形态都归
  档在 `template.xlsx` 中。
- **引擎由开发者拥有。** TypeScript API 可以接到浏览器页面、内部门
  户、CLI 或服务端点。
- **Excel 还是 Excel。** 样式、数字格式、工作表结构、合并单元格都
  会原样保留到结果里。
- **不依赖宏,也不依赖第三方云。** 模板行为就是工作簿里能看到的明
  确内容。

## 横向对比

| 方案 | 擅长 | 取舍 |
|---|---|---|
| **xl3** | 构建基于文件的 Excel 转换引擎:运营上传原始 `.xlsx`、下载完成的工作簿,工作流规则始终留在 `template.xlsx` 里。 | 仍处于 alpha 阶段。XTL 语言表面刻意保持精简,目前仍在演进。 |
| Python / VBA 脚本 | 围绕现有电子表格做快速、一次性的自动化。 | 业务规则容易沉淀到代码里或某位维护者的脑子里,交接和评审都不轻松。 |
| Power Query / Office Scripts / Power Automate | Microsoft 365 内部的工作流、数据整形和操作自动化。 | 平台契合度很高,但流程容易绑定到具体租户、账号或环境,不是可移植的工作簿资产。 |
| SheetJS、ExcelJS、Aspose.Cells 等电子表格 SDK | 低层或全功能的工作簿编程生成。 | 开发者通常会把报表特定的规则直接写进应用代码里。 |
| JXLS、xltpl 等模板/报表引擎 | 基于类似电子表格的模板做服务端报表生成。 | 很有用,但常常绑定具体语言和运行时;面向运营的浏览器流程与工作簿级交接不是其主要形态。 |
| Plumsail、Formstack、Conga 等文档生成 SaaS | 托管型的文档流程、集成、审批与分发。 | 规则落在第三方服务里,而不是一份可自托管的、可移植的工作簿模板里。 |
| 基于 LLM 的电子表格生成 | 临时性的探索与草稿。 | 不是反复执行的运营场景所需要的确定性转换契约。 |

## 安装

```bash
npm install @jinyoung4478/xl3
```

## 使用

```ts
import { convert } from '@jinyoung4478/xl3';

const templateBuffer = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
const dataBuffer = await fetch('./data.xlsx').then((r) => r.arrayBuffer());

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: OutputFile[] — 根据模板里的分组规则,可能输出一个或多个 .xlsx
```

在浏览器和 Node(≥ 20.12)上都可以运行。

### 不依赖打包工具,直接用 `<script>`

对于不使用打包工具的项目,可以直接引用自包含的 IIFE 构建,在
`window.xl3` 上挂载所有 API:

```html
<script src="https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.8.0/dist/xl3.bundle.iife.min.js"></script>
<script>
  const tpl = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
  const data = await fetch('./data.xlsx').then((r) => r.arrayBuffer());
  const outputs = await xl3.convert(tpl, data);
</script>
```

压缩后约 1 MB(gzip 后约 300 KB)。ExcelJS 和 JSZip 已经内联进来,不
需要额外的依赖。

可以在 [xl3.io](https://xl3.io) 直接体验浏览器流程:用页面自带的样
例文件原样跑一遍、下载原始/模板工作簿研究一下,或者把任意一份文件
换成你自己的来试。

### Excel 版本兼容性

xl3 通过 OOXML 读取 `.xlsx`,本身在设计上就尽量做到与版本无关 ——
直接读取公式的缓存结果,在 UTC 下归一化日期,并在单元格值层面忽略
OOXML 序列化层的差异。完整的兼容性矩阵参见
[ADR-0022](./spec/decisions/0022-excel-version-compatibility.md);
简短的建议是:动态内容统一走 XTL 的 `{{ ... }}` 语法,避免在数据
块内部使用图表/数据透视/原生公式,并在组织内部统一一种日期系统
(1900)。

模板通过隐藏的 `__config__` 工作表来指定源表格的位置:

| 键 | 示例 | 含义 |
|---|---|---|
| `source_sheet` | `原始数据` | 源工作表名称,或者以 `*` 结尾的前缀模式 |
| `source_table` | `1` | 第 1 行为列名,下面的所有行都是数据 |
| `source_table` | `A1:D` | A1-D1 为列名,下面的所有行都是数据 |
| `source_table` | `A1:D200` | A1-D1 为列名,A2-D200 为数据 |

最常见的情况(第 N 行为列名)用 `source_table = N` 就够了。只有当
表格从靠后的列开始、或者需要限定结束行时,才需要写区间形式。

### 保留工作表

模板使用四个两端带双下划线的保留工作表(参见 ADR-0011):

| 工作表 | 用途 |
|---|---|
| `__config__` | 作者定义的配置与取值字典;通过 `{{ __config__[name] }}` 访问 |
| `__inputs__` | 每次运行时由主程序提供的入参(ADR-0010);通过 `name`/`type`/`default`/`label`/`description`/`options` 这些列声明 |
| `__sources__` | 在默认 `source_sheet` 之外额外声明的命名数据源(ADR-0012);通过 `name`/`sheet`/`table`/`description` 这些列声明 |
| `__lists__` | 供 `@filter [field] in __lists__[name]` 等使用的成员列表 |

作者自定义的工作表名一旦匹配 `^__[a-z]+__$` 这种模式,会在解析阶段
直接被拒绝。

### 多源数据

除了默认的 `source_sheet`,模板还可以在 `__sources__` 中声明命名数
据源,并用 Excel 结构化引用的形式来引用它们:

```text
{{ Customers[Account] }}
{{ SUM(Renewals[Amount]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
```

`@source <Name>` 会把一个数据块的默认源切换为 `<Name>`,这样裸引用
形式 `[Column]` 也会按 `<Name>` 来解析。`@join` 则以键为基准,把第
二个数据源中的行与主行配对(inner join,取第一条匹配)。完整的指令
语法参见 [`spec/language.md`](./spec/language.md)。

### 运行时输入

需要每次运行时传入值(目标月份、客户过滤、标签等)的模板,可以在
`__inputs__` 中声明它们,主程序把这些值传给 `convert(...)`:

```ts
await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: '北京' },
});
```

输入会流入单元格(`{{ __inputs__[month] }}`)、文件名模式以及分组
键。

## 示例

[`examples/`](./examples) 里有四份贴近生产形态的模板:基础的续约报
表、按区域分工作表配合列表过滤、带运行时输入的多源 join,以及一份
咖啡店周报,展示了 `@group` + `@subtotal` 配合按类目小计的写法。可
以用 `npm run examples:build && npm run examples:run` 跑起来。

## 指南

[`docs/guides/`](./docs/guides) 中有面向常见场景的、可直接复制粘贴
的短小食谱,目前共 18 篇,涵盖入门、条件、聚合、按文件/工作表分
组、运行时输入、连接、`XLOOKUP`、排序与 Top-N、品牌样式、多行文本、
空值处理、错误处理、`__config__` 取值、指令组合、XTL 与 Excel 公式
对照、模板编写时的展示效果,以及 `@group` / `@subtotal`。

## Spec

XTL 规范是语言中立的,放在 [`spec/`](./spec) 下。本仓库提供的是
TypeScript 参考实现。欢迎用其他语言来移植 —— 详见
[IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md)。

在本地运行 conformance 语料库:

```bash
npm run conformance
node dist/bin/conformance.js --fixture-dir=conformance/fixtures --comparison-stage=2
```

最新一次参考实现运行的汇总,以及任何放入
[`conformance/reports/`](./conformance/reports/) 的外部移植报告的对
应列,可以在 [`conformance/DASHBOARD.md`](./conformance/DASHBOARD.md)
查看。使用 `npm run conformance:dashboard` 重新生成。

## 项目结构

- `spec/` —— 规范性的 XTL 语言草案。
- `conformance/` —— 实现无关的 fixture 语料库与 runner 协议。
- `src/` —— TypeScript 参考实现。

规范是唯一的事实来源。Conformance fixture 把规范行为以可执行的形式
固定下来。参考实现很有用,但并不具有规范效力。

## 许可证

- 代码(`src/`、`conformance/`):[MIT](./LICENSE)
- XTL 规范(`spec/`):[CC-BY-4.0](./spec/LICENSE)

---

Microsoft 和 Excel 是 Microsoft Corporation 的商标。xl3 与 Microsoft 没有任何关联。Office Open XML 格式(`.xlsx`)以 ISO/IEC 29500 的形式公开发布。
