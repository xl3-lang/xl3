---
sidebar_label: '17 · 模板编辑时的显示'
pagination_label: '17 · 模板编辑时的显示'
---

# 17 · 模板编辑时的显示

## 常见情景

你在 Excel 里打开 `template.xlsx` 编辑，看到：

- 一个单元格 `=VLOOKUP("Acme", Data!A:B, 2, FALSE)` 显示 `#N/A`。
- 一个单元格 `=Data!B2 + 100` 显示 `#VALUE!`。
- 一个格式化为货币 `￥#,##0` 的单元格，显示的是纯文本 `{{ [金额] }}`。
- 当你点进占位符单元格时弹出数据验证警告。

**这些都不是 bug。** 当 xl3 渲染模板时，它们全部消失：

- Data 工作表的占位符被替换为真实值。
- VLOOKUP 在 A 列里找到了 "Acme"。
- 因为单元格现在是数字，`+100` 起作用了。
- 货币格式作用在被替换的数字上。
- 验证规则应用到实际的值。

这篇速查解释了为什么模板视图会显示成这样，以及如果觉得吵闹该怎么处理。（ADR-0049 是其背后的规范契约。）

## 为什么占位符显示为字面文本

当模板的单元格值为 `{{ [金额] }}`、格式为 `#,##0.00` 时，Excel 看到的是数字单元格里有一个非数字字符串。Excel 的行为：

- 按原样显示文本（不自动格式化）。
- 不显示"以文本形式存储的数字"绿色三角（启发式检查要求内容看起来像数字；`{{ ... }}` 一看就不是）。
- 不报错（这是普通字符串，而不是格式错误的公式）。

单元格在你的编辑视图里显示 `{{ [金额] }}`。xl3 渲染之后，同一单元格显示 `1,234.56`（或值 × 格式组合得到的结果）。

**这是有意的。** 可见的占位符让模板*自带文档*：你不用运行任何东西，就能看到哪些单元格是动态的、哪些是固定的。审阅者打开文件就能直接看懂契约。

## 为什么面板里的公式显示错误（以及如何清理）

面板工作表里常见这类公式：

```excel
=VLOOKUP("Acme", Data!A:B, 2, FALSE)
=Data!B2 + 100
=AVERAGE(Data!B:B)
=SUMPRODUCT((Data!A:A="VIP") * Data!B:B)
```

打开模板时（渲染前），这些引用的是 Data 工作表的占位符行。查找找不到匹配（字符串不会等于字面键）；对字符串做算术返回 `#VALUE!`。结果是面板里一片红色单元格。

### 解决：用 `IFERROR` 包裹

Excel 原生答案。每个公式只多一行，几秒钟就能学会。

```excel
=IFERROR(VLOOKUP("Acme", Data!A:B, 2, FALSE), "—")
=IFERROR(Data!B2 + 100, 0)
=IFERROR(AVERAGE(Data!B:B), 0)
=IFERROR(SUMPRODUCT((Data!A:A="VIP") * Data!B:B), 0)
```

渲染前模板视图：干净（`—`、`0`）。
渲染后输出：真实的值（xl3 按 [ADR-0046](../../spec/decisions/0046-cell-formula-preservation.md) 不改动公式文本；Excel 在打开时重算，外层包装隐于无形）。

### 哪些公式需要包裹

| 公式 | 模板视图是否报错？ | 是否包裹？ |
|---|---|---|
| `=SUM(Data!B:B)` | 否——SUM 忽略范围里的文本，返回 0 | 可选 |
| `=SUMIF(Data!A:A, "VIP", Data!B:B)` | 否——无匹配返回 0 | 可选 |
| `=COUNTIF(Data!A:A, "VIP")` | 否——返回 0 | 可选 |
| `=AVERAGE(Data!B:B)` | **是** ——无数字时 `#DIV/0!` | 是 |
| `=VLOOKUP("key", Data!..., ...)` | **是** ——无匹配时 `#N/A` | 是 |
| `=INDEX(...,MATCH("key",Data!A:A,0))` | **是** ——`#N/A` | 是 |
| `=Data!B2 + N` （单元格级算术） | **是** ——`#VALUE!` | 是 |
| `=Data!B2 & " text"` （文本拼接） | 否——字符串拼接对占位符也工作 | 否 |
| `=COUNTA(Data!A:A)` | 否——统计非空单元格，占位符也算 | 否 |

**经验法则：** 凡是对占位符行会返回 `#N/A`、`#VALUE!`、`#DIV/0!` 的公式都包裹起来。聚合类（`SUM`、`COUNT*`、`SUMIF*`）对文本是容忍的，不需要包裹。

## 验证渲染输出

不必从模板视图反推渲染输出。三种快速路径：

### 1. xl3.io playground

把 `template.xlsx` + 示例 `data.xlsx`（或使用内置示例）拖进 [xl3.io](https://xl3.io)。几秒钟就能看到渲染后的工作簿。

### 2. 宿主里的 `preview()` API

如果你把 xl3 嵌入到 TypeScript 宿主中：

```ts
import { preview } from '@jinyoung4478/xl3';

const result = await preview(templateBuffer, dataBuffer);
console.log(result.sources);   // 检测到的源行
console.log(result.files);     // 输出文件与工作表
console.log(result.warnings);  // 任何非致命问题
```

`preview()` 跑的解析 + 早期求值阶段与 `convert()` 一致，但不产出工作簿字节——非常适合在触发完整渲染前先做宿主侧校验。

### 3. CLI 快速烟雾测试

```bash
# 重新构建示例工作簿（如果你想要新样本）
npm run examples:build

# 渲染并检查
node -e "
import('@jinyoung4478/xl3').then(async ({ convert }) => {
  const fs = await import('node:fs/promises');
  const tpl = await fs.readFile('./template.xlsx');
  const data = await fs.readFile('./data.xlsx');
  const outs = await convert(tpl.buffer, data.buffer);
  for (const o of outs) await fs.writeFile('rendered-' + o.filename, o.data);
})
"
```

打开 `rendered-*.xlsx` 查看真实输出。

## 编辑期间的数据验证警告

如果你在某列设置了"必须是 0 到 100 之间的数字"这样的验证规则，编辑时点进占位符单元格，Excel 会弹出验证警告（"此值与规则不符"）。

可选做法：

- **把验证样式设为 `警告` 或 `信息`** 而不是 `停止` ——警告仍会出现，但不阻止编辑。
- **把验证放在非占位符单元格上**，让它传播到数据行。xl3 的保留行为（ADR-0036 §8）会把规则带到展开后的行。
- **接受点击时的警告** ——xl3 替换为真实值后它就消失了，操作员看到渲染文件时根本不会遇到。

## xl3 故意**不**做的事

来自 [ADR-0049](../../spec/decisions/0049-template-display-vs-render-output.md) 的契约：

1. xl3 **不**为模板视图预先替换占位符为示例值。（那样会丢掉可视化的占位符信号。）
2. xl3 **不**维护每个单元格的两份 `numFmt`（"模板视图格式" vs "渲染格式"）。（额外的规范面，收益微薄。）
3. xl3 **不**自动用 `IFERROR` 包裹面板公式。（那会以 ADR-0046 禁止的方式改动公式文本；还会悄悄掩盖真实的作者错误。）

作者负责模板视图，引擎负责渲染输出。它们按设计就是两回事。

## 另见

- [ADR-0049 — Template-display vs render-output: intentional asymmetry](../../spec/decisions/0049-template-display-vs-render-output.md)
- [ADR-0046 — Cell formula preservation contract](../../spec/decisions/0046-cell-formula-preservation.md)
- [Cookbook 16 — XTL 函数与 Excel 公式对比](./16-xtl-vs-excel-formula.md)
- [`preview()` API 文档](../api/functions/preview.md)
