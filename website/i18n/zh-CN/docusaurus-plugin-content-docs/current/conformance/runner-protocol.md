# 一致性运行器协议

定义一致性语料与任何想要声明一致性的 XTL 实现之间的契约。

## 什么是运行器

**一致性运行器**是一个小程序：

1. 遍历 `conformance/fixtures/` 中的 fixture
2. 对每个 fixture 的 `template.xlsx` + `data.xlsx` 调用被测实现
3. 将实现的输出与 fixture 的 `expected.xlsx`（或 `expected/` 目录）比较
4. 以标准格式按 fixture 报告 pass / fail / skip

每个实现提供自己的运行器（因为调用方式与语言相关），但所有运行器都产出可比较的输出。

## Fixture 加载

运行器通过枚举 `conformance/fixtures/` 的子目录来发现 fixture。每个子目录命名为 `<NNN>-<slug>/`（例如 `001-basic-substitution`）。

对每个 fixture，运行器读取：

- `template.xlsx`——输入模板
- `data.xlsx`——输入源数据
- `expected.xlsx`（单输出场景）**或** `expected/` 目录下的 `.xlsx` 文件（多文件分组场景，包括零输出场景）
- `meta.yaml`——fixture 元数据

期望零个输出文件的静态 fixture 使用空的 `expected/` 目录。

错误 fixture 省略 `expected.xlsx` 与 `expected/`。它们在 `meta.yaml` 中声明 `expected_error`；预期结果是实现报告的错误消息包含所声明的文本。

动态 fixture 省略 `expected.xlsx` 与 `expected/`。它们在 `meta.yaml` 中声明 `expected_dynamic`；预期结果由运行器根据运行器启动时间戳与声明的断言规则计算得到。动态 fixture 仅保留给规范中明确具有时间依赖的行为，例如 `TODAY()`。

## 必填的 `meta.yaml` 字段

```yaml
description: string         # one-line human description
spec_section: string        # the spec section this fixture exercises
spec_version: string        # minimum XTL version (e.g., "0.1")
tags: [string, ...]         # filter tags (e.g., [substitution, repeat, aggregate])
```

`tags` 是为 `--filter=<tag>` CLI 标志提供的 fixture 侧便利字段。标签值不属于一致性契约——运行器必须（**MUST**）将其作为不透明字符串处理，且不应当（**SHOULD NOT**）因为某个 fixture 的标签集与另一个 fixture 不同而拒绝它。参考语料使用小写、连字符分隔的词元，但不强制规范分类法。

可选字段：

```yaml
verified_by: [hand | excel-formulas | manual-script | reference-impl]
expected_warnings: [string, ...]   # warnings the impl should emit
expected_error: string             # expected error message substring; no expected output is required
expected_error_code: string        # optional ADR-0015 stable error code (e.g. "xl3/source/undeclared")
expected_dynamic: string           # dynamic assertion kind; no expected output is required
comparison_stage: 1 | 2            # minimum comparison stage for static-output fixtures; default is 1
skip_reason: string                # if fixture is currently broken
inputs:                            # host-supplied runtime inputs (ADR-0010)
  - name: region
    value: Seoul
```

`inputs` 块列出运行器作为运行时输入传递给实现的 name/value 对（依据 ADR-0010 的 `__inputs__` 工作表）。运行器必须（**MUST**）将这些值转发到实现的转换入口点。没有 `__inputs__` 工作表的模板会忽略该字段。

阶段门控元数据：

- `comparison_stage` 仅适用于静态输出 fixture。其默认为 `1`。仅当 fixture 断言阶段 1 无法观察的工作簿内容（如样式、合并、包零件或二进制媒体）时才使用 `2`。
- `expected_error` fixture 与 `expected_dynamic` fixture 不使用工作簿比较阶段判定通过/失败。运行器仍会报告当前运行阶段，但这些 fixture 保留各自的错误或动态断言规则。
- `expected_dynamic` 要求为当前定义的 `utc_today` 断言种类提供 `dynamic_cells`。静态输出与错误 fixture 省略 `dynamic_cells`。

对于 `expected_error` fixture，运行器必须（**MUST**）将其标记为：

- `pass`，当实现报告的错误包含 `expected_error`
- `fail`，当实现成功
- `fail`，当实现报告了不同的错误

`expected_error` 与 `expected_dynamic` 互斥。

## 动态断言

动态断言让渲染时行为可测，而无需提交一份会过期的 `expected.xlsx`。运行器必须（**MUST**）在执行第一个 fixture 之前捕获一个统一的运行器启动时间戳，并将该时间戳用于本次运行中的所有动态 fixture。这可以避免同一份报告中各 fixture 之间出现跨午夜的差异。

XTL 0.1 定义了一种动态断言种类：

```yaml
expected_dynamic: utc_today
dynamic_cells:
  - sheet: Report
    cell: A2
    format: YYYY-MM-DD
```

对于 `utc_today`，每个所列单元格的预期值是运行器启动时间戳的 UTC 日历日期，按所列的 XTL `TEXT()` 日期格式格式化。实现的输出必须（**MUST**）在每个所列工作表/单元格坐标处包含该预期字符串值。

对于 `expected_dynamic` fixture，运行器必须（**MUST**）将其标记为：

- `pass`，当实现成功且每个所列的动态单元格都匹配
- `fail`,当实现报告了错误
- `fail`,当任一所列动态单元格与计算出的预期值不同

未实现某个已声明的 `expected_dynamic` 种类的运行器，必须（**MUST**）将该 fixture 标记为 `skip` 并附带原因。它们禁止（**MUST NOT**）将其报告为已通过。

## 比较阶段

一致性协议有两个比较阶段：

- **阶段 1：单元格值比较。** 运行器在通过电子表格库加载 `.xlsx` 文件后，比较工作表名称与非辅助性单元格的值。该阶段有意忽略样式、合并、页面设置、嵌入媒体、缓存值之外的公式以及包结构。对于 XTL 0.1 的引导语料而言已经足够，同时规范 OOXML 比较的细节仍在规定与实现中。
- **阶段 2：规范 OOXML 比较。** 运行器在对生成的 `.xlsx` 文件的 OOXML 包进行规范化之后再进行比较。这是完整静态输出一致性的目标，因为它可以捕捉到阶段 1 看不到的版式、样式、合并、工作表结构与包回归。

错误 fixture 与动态 fixture 不是工作簿输出比较。无论比较阶段如何，它们都保留各自的 `expected_error` 与 `expected_dynamic` 通过/失败规则。

报告应当（**SHOULD**）标明每次运行所使用的比较阶段。实现禁止（**MUST NOT**）凭仅运行阶段 1 而声称达到阶段 2 一致性。静态输出 fixture 可以（**MAY**）在 `meta.yaml` 中声明 `comparison_stage`。当 fixture 声明的比较阶段大于运行器的当前阶段时，运行器必须（**MUST**）跳过该 fixture。

## 阶段 2 输出比较 {#stage-2-output-comparison}

比较在**规范化**之后的 OOXML 上进行。最低规范化规则：

1. zip 内文件必须（**MUST**）按内容比较，而不是按 zip 元数据（时间戳、压缩方式、条目顺序或压缩级别）比较。
2. 在规范化之后包零件名称必须（**MUST**）匹配。缺少或多出的工作簿零件构成差异，除非后续 ADR 将该零件标记为易变。
3. XML 文件必须（**MUST**）在解析并以确定性的命名空间声明、属性顺序、引号风格与空元素表示重新序列化之后再比较。
4. XML 元素顺序必须（**MUST**）被保留，除非后续 ADR 明确将某个特定元素集合标记为无序。关系文件是有序的包数据，而不是集合，除非存在这样的规则。
5. 比较前会剥离以下字段（它们反映生成器元数据而非内容）：
   - `cp:lastModifiedBy`、`dc:creator`、`dcterms:created`、`dcterms:modified`
   - 任何 `<calcPr>` 的 `calcId` 属性（Excel 计算引擎版本）
   - 当可以通过工作簿关系与工作表名解析时，生成的工作表 id 与工作表零件文件名
   - ExcelJS 可能添加或省略的默认页面设置值（`copies="1"`、`firstPageNumber="1"`、`useFirstPageNumber="1"`）
6. 文本运行内的非显著空白被保留（它可能在语义上有意义）。
7. 单元格 `r`（引用）属性必须（**MUST**）精确匹配；`<row>` 内单元格顺序必须（**MUST**）匹配。
8. 二进制包零件（例如图像）必须（**MUST**）按精确字节比较。

JS 参考运行器包含一个用于一致性比较的阶段 2 规范化器。它有意限定在受支持的 XTL fixture 所产生的 OOXML 加上上述规范化规则的范围内；它不是通用的 XML 规范化库。特别是，它不声称提供完整的 XML C14N 支持、DTD/实体处理、语义命名空间改写，或超出此处显式列出的应用特定无序集合规则。需要额外 OOXML 等价规则的 fixture 应先更新本协议。

### 已知规范化空缺

下列情形不由当前规范化器规范化。它们一旦出现就会被视作差异。理由见 [ADR-0006](https://xl3.io/spec/decisions/stage-2-ooxml-conformance) 的修订。

- **默认属性等价。** OOXML 默认值所指定的某个布尔属性，省略与以默认值显式发出（例如 `applyFont="0"`）会被视为差异。
- **颜色十六进制大小写。** `rgb="FF000000"` 与 `rgb="ff000000"` 作为不同字符串比较。
- **命名空间前缀绑定。** 绑定到同一命名空间 URI 的不同前缀不会被统一。

当某个跨写出端 fixture 把这些空缺中的一个暴露为**真正易变**的差异（而不是被装扮成易变差异的内容差异）时，协议与参考规范化器应当一起扩展。实现禁止（**MUST NOT**）在本地静默放宽这些规则。

## 运行器 CLI 约定

实现应当暴露一个具有最小接口的运行器：

```
<runner> [--fixture-dir=<path>] [--filter=<tag>] [--spec-version=<x.y>] [--comparison-stage=1|2] [--report=json|text]
```

提供阶段 2 规范化器的实现还应当（**SHOULD**）暴露一个调试命令，按确定性的零件顺序打印规范化的包内容：

```
<runner> canonicalize <input.xlsx> [--part=<canonical-part-name>]
```

省略 `--part` 时，该命令应当（**SHOULD**）发出一个以规范化包零件名为键的 JSON 对象。提供 `--part` 时，应当（**SHOULD**）仅发出该规范化零件的内容。

JSON 报告格式：

```json
{
  "implementation": "xl3-js",
  "version": "0.1.0-alpha.0",
  "spec_version": "0.1",
  "comparison_stage": 1,
  "results": [
    {
      "fixture": "001-basic-substitution",
      "status": "pass",
      "duration_ms": 12
    },
    {
      "fixture": "007-aggregate-sum",
      "status": "fail",
      "duration_ms": 8,
      "diff": "cell B5: expected 1234, got 1234.0"
    }
  ],
  "summary": {
    "total": 42,
    "passed": 40,
    "failed": 1,
    "skipped": 1
  }
}
```

## 报告一致性

实现通过链接到一次公开的一致性运行来报告其一致性水平。预期形式：

```
xl3-py 0.2.0 — XTL 0.1 conformance: 38/42 (passes filter, repeat, aggregate; fails image-clone, _config-pattern-match, two date-edge cases)
```

仓库中的 [`IMPLEMENTATIONS.md`](/implementations) 列出了已知实现及其一致性水平。
