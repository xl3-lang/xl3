# XTL 实现清单

[XTL 规范](./spec/) 的实现。xl3 是参考实现。

| 语言 | 仓库 | 包 | 规范版本 | 一致性 | 备注 |
|---|---|---|---|---|---|
| TypeScript | [`jinyoung4478/xl3`](https://github.com/jinyoung4478/xl3) | [`@jinyoung4478/xl3`](https://www.npmjs.com/package/@jinyoung4478/xl3) | XTL 0.1（草案） | 参考实现；**139/139** fixture 通过（133 Stage 1 + 仅 6 Stage 2） | 浏览器 + Node ≥ 20.12；通过 `npx xl3-conformance` 运行；CI 中带 3 时区矩阵 |
| Python | [`jinyoung4478/xl3-py`](https://github.com/jinyoung4478/xl3-py) | _（未发布）_ | XTL 0.1（草案） | **草案**，开发中 | 与参考实现并行跟踪；在 [`conformance/reports/`](./conformance/reports/) 下放一份 `--report=json` 产物，`npm run conformance:dashboard` 就会把它接进来 |

## 新增一个实现

先阅读 [`PORTERS_GUIDE.md`](/zh-CN/porters-guide)——它区分了规范性的硬性要求与 TS 实现的偶然细节，并给出了与一致性语料挂钩的推荐开发顺序。

要把一个移植列在这里：

1. 实现 XTL 0.1 中你打算覆盖的[一致性测试用例](./conformance/fixtures/)的足够子集。
2. 按 [`conformance/runner-protocol.md`](/zh-CN/conformance/runner-protocol) 在 [`conformance/`](./conformance/) 上跑你的实现。
3. 提一个 PR，在上面的表格中加一行：语言、包 URL、目标规范版本、一致性状态（full / partial / N of M fixtures）。

正在开发中的移植同样欢迎——即便一致性还是部分通过，也欢迎链接你的进行中仓库。

## 规范一致性级别

- **reference** —— 本实现。按定义对其声明的规范版本一致。
- **full** —— 通过所声明规范版本的所有一致性测试用例。
- **partial (N/M)** —— 通过 M 个中的 N 个。请列出尚不支持的 fixture 分类。
- **draft** —— 早期 WIP，尚未开始跑一致性。
