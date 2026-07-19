---
sidebar_label: '06 · 运行时输入'
pagination_label: '06 · 运行时输入'
---

# 06 · 运行时输入

## 场景

模板本身是通用的，但每次运行都针对某个月份或区域。你不希望让操作员手动改模板——而是让他们在 convert 时把值传进来。

## 在 `__inputs__` 中声明

| name | type | required | default | label | options |
|---|---|---|---|---|---|
| `month` | `text` | `true` | | `目标月份（YYYY-MM）` | |
| `region` | `select` | `false` | `全部` | `区域过滤` | `全部\|北京\|上海\|广州` |

类型取值：`text`、`number`、`date`、`select`。

## 在模板单元格、文件名和分组键中使用

```text
单元格：       {{ "报表月份：" & __inputs__[month] }}
文件名：       output_file_pattern = {{ __inputs__[month] }}-续约.xlsx
过滤：         {{ @filter [区域] = __inputs__[region] OR __inputs__[region] = "全部" }}
```

等一下——最后那一行其实写不出来，XTL 没有 `OR` 关键字。干净的做法是准备两个工作表模板，由上游条件选择走哪个。目前 `__inputs__` 更常见的用法，是把一个字面值注入单元格、文件名，或固定比较里：

```text
{{ @filter [区域] = __inputs__[region] }}
```

……然后让宿主程序仅在操作员选定具体区域之后才调用 `convert()`。

## 从宿主传入值

```ts
import { convert } from '@xl3-lang/xl3';

const outputs = await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: '北京' },
});
```

如果 `inputs.month` 缺失且 `month` 被标记为 required，xl3 会在 convert 时抛出 `xl3/inputs/missing-required`。如果没有提供 `region`，则回退到 `default`（`全部`）。

## 不运行就查看已声明的输入

```ts
import { readTemplateInputs } from '@xl3-lang/xl3';

const inputs = await readTemplateInputs(templateBuffer);
// → [{ name: 'month', type: 'text', required: true, ... }, ...]
```

在宿主 UI 中可以用它，在操作员还没上传数据文件前就先把表单渲染出来。

## 计算式的 default 与 label（ADR-0050）

`default`、`label`、`description`、`options` 这几列在输入读取期会作为 XTL 模板求值。你可以用 `__config__` 组合值，或调用纯标量函数：

| name | type | default | label |
|---|---|---|---|
| `title_prefix` | `text` | `{{ __config__[region] }} 对账单` | `标题前缀` |
| `report_date` | `text` | `{{ TEXT(TODAY(), "YYYY-MM-DD") }}` | `报表日期` |
| `report_label` | `text` | `{{ UPPER(__config__[region]) }}-{{ __config__[period] }}` | `报表标签` |

调用 `readTemplateInputs()` 的宿主 UI 看到的是求值后的字符串（例如 `"CN 对账单"`、当前 UTC 日期）。用户不会再看到原始的 `{{ ... }}` 占位符。

**输入读取期可用的绑定：**

- `__config__[key]` ——`__config__` 工作表里更早声明的值。
- 纯标量函数：`TODAY`、`DATE`、`IF`、`IFEMPTY`、`IFS`、`IFERROR`、`UPPER`、`LOWER`、`TRIM`、`TEXT`、`YEAR`、`MONTH`、`DAY`、`EOMONTH`、`EDATE`、`DATEDIF`、`ROUND`、`ABS`。

**不可用——这些会在输入读取期抛错：**

- `[Column]` / `Source[Column]` ——此时还没有源行上下文。错误码：`xl3/inputs/forward-reference`。
- `__inputs__[name]` ——输入行之间是独立声明，没有依赖图概念。同样错误码。
- `ROW()`、`SUM`、`COUNT`、`AVERAGE`、`MIN`、`MAX`、`XLOOKUP` ——它们读取的渲染状态或源数据此时尚不存在。错误码：`xl3/inputs/runtime-only-fn`。

> **迁移说明。** 0.6 之前，`__inputs__` 单元格中的 `{{ ... }}` 被当作字面文本对待。如果旧模板里有刻意写成字面字符的 `{{ ... }}` 块，那段字符串现在会作为表达式求值。绝大多数作者不会受影响——之前的行为本身在实际使用中也常令人意外。

## 备注

- `select` 的 options 在 `__inputs__` 这一行里用竖线分隔（例如 `北京|上海|广州`）。提供的值不在选项里会抛出 `xl3/inputs/select-option`。竖线拆分发生在单元格模板求值**之后**，所以当 `__config__[regions]` 是字面字符串 `北京|上海|广州` 时，`options: {{ __config__[regions] }}` 也能正常工作。
- 日期输入按 `YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm:ss` 解析。
- 数字输入接受 JS 数字字面量；允许末尾空白。
- 规范参考：[`spec/evaluation.md`](/spec/evaluation) "Inputs"；ADR-0010、ADR-0011、ADR-0050。
