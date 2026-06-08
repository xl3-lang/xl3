// Build conformance fixture 158 — chained-arithmetic associativity and
// precedence (issue #52).
//
// Authored from the grammar (grammar.ebnf: `mul_expr` binds tighter than
// `arith_expr`, and the `{ ... }` repetition is left-associative) plus
// language.md "Arithmetic" — NOT by running the reference impl. See
// conformance/AUTHORING.md.
//
// The gap this fixture closes: the normalizer split on the FIRST operator
// and recursed rightward, making chained same-precedence arithmetic
// RIGHT-associative — `a / b * c` evaluated as `a / (b * c)`. No prior
// fixture chained two same-precedence operators, so the corpus never
// caught it. The real-world symptom was a VAT cell (`[합계] / 1.1 * 0.1`)
// off by ~100x.
import ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'conformance', 'fixtures');

async function save(wb, path) {
  const buf = await wb.xlsx.writeBuffer();
  writeFileSync(path, Buffer.from(buf));
}

function configSheet(wb, sourceSheet = 'Data') {
  const cfg = wb.addWorksheet('__config__');
  cfg.getCell('A1').value = 'name';      cfg.getCell('B1').value = 'fixture';
  cfg.getCell('A2').value = 'source_sheet'; cfg.getCell('B2').value = sourceSheet;
  cfg.getCell('A3').value = 'source_table'; cfg.getCell('B3').value = '1';
  cfg.getCell('A4').value = 'output_file_pattern'; cfg.getCell('B4').value = 'output.xlsx';
  return cfg;
}

// =====================================================================
// 158 — chained-arithmetic-associativity: `*`/`/` and `+`/`-` chains are
// LEFT-associative with `*`/`/` taking precedence. Data is chosen so the
// left-associative and (buggy) right-associative groupings differ:
//   a/b*c  : (12/2)*3 = 18   vs  12/(2*3) = 2
//   a-b+c  : (12-2)+3 = 13   vs  12-(2+3) = 7
// =====================================================================
{
  const dir = join(ROOT, '158-chained-arithmetic-associativity');
  mkdirSync(dir, { recursive: true });

  // Template — a single per-row data block over A:E.
  const tpl = new ExcelJS.Workbook();
  configSheet(tpl);
  const rep = tpl.addWorksheet('Report');
  rep.getCell('A1').value = 'a';
  rep.getCell('B1').value = 'b';
  rep.getCell('C1').value = 'c';
  rep.getCell('D1').value = 'a/b*c';
  rep.getCell('E1').value = 'a-b+c';
  rep.getCell('A2').value = '{{ [a] }}';
  rep.getCell('B2').value = '{{ [b] }}';
  rep.getCell('C2').value = '{{ [c] }}';
  rep.getCell('D2').value = '{{ [a] / [b] * [c] }}'; // (a/b)*c
  rep.getCell('E2').value = '{{ [a] - [b] + [c] }}'; // (a-b)+c
  await save(tpl, join(dir, 'template.xlsx'));

  // Data — two records.
  const data = new ExcelJS.Workbook();
  const dws = data.addWorksheet('Data');
  dws.getCell('A1').value = 'a'; dws.getCell('B1').value = 'b'; dws.getCell('C1').value = 'c';
  dws.getCell('A2').value = 12; dws.getCell('B2').value = 2; dws.getCell('C2').value = 3;
  dws.getCell('A3').value = 20; dws.getCell('B3').value = 4; dws.getCell('C3').value = 5;
  await save(data, join(dir, 'data.xlsx'));

  // Expected — hand-computed left-associative results:
  //   row1: 12/2*3 = 18, 12-2+3 = 13
  //   row2: 20/4*5 = 25, 20-4+5 = 21
  const exp = new ExcelJS.Workbook();
  const ers = exp.addWorksheet('Report');
  ers.getCell('A1').value = 'a';
  ers.getCell('B1').value = 'b';
  ers.getCell('C1').value = 'c';
  ers.getCell('D1').value = 'a/b*c';
  ers.getCell('E1').value = 'a-b+c';
  ers.getCell('A2').value = 12; ers.getCell('B2').value = 2; ers.getCell('C2').value = 3;
  ers.getCell('D2').value = 18; ers.getCell('E2').value = 13;
  ers.getCell('A3').value = 20; ers.getCell('B3').value = 4; ers.getCell('C3').value = 5;
  ers.getCell('D3').value = 25; ers.getCell('E3').value = 21;
  await save(exp, join(dir, 'expected.xlsx'));

  writeFileSync(join(dir, 'meta.yaml'),
`description: Chained same-precedence arithmetic is LEFT-associative and \`*\`/\`/\` bind tighter than \`+\`/\`-\` (grammar.ebnf arith_expr/mul_expr). \`[a] / [b] * [c]\` evaluates as \`(a/b)*c\` and \`[a] - [b] + [c]\` as \`(a-b)+c\`, not the right-associative grouping. Regression guard for issue #52, where a VAT cell (\`[Total] / 1.1 * 0.1\`) was mis-scaled ~100x.
spec_section: grammar.ebnf#arith_expr / language.md#arithmetic
spec_version: "0.1"
tags: [arithmetic, precedence, associativity, issue-52]
verified_by: [hand]
`);
}

console.log('Fixture 158 written.');
