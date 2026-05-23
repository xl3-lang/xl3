import ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = '/Users/wefun/workspaces/playground/xl3/conformance/fixtures/145-block-bracket-outside-error';
mkdirSync(dir, { recursive: true });

// Template with TWO disconnected `[col]` clusters — should raise
// xl3/expression/bracket-outside-block at parse time (ADR-0066).
const tpl = new ExcelJS.Workbook();
const cfg = tpl.addWorksheet('__config__');
cfg.getCell('A1').value = 'name';      cfg.getCell('B1').value = 'bracket-outside';
cfg.getCell('A2').value = 'source_sheet'; cfg.getCell('B2').value = 'Data';
cfg.getCell('A3').value = 'source_table'; cfg.getCell('B3').value = '1';
cfg.getCell('A4').value = 'output_file_pattern'; cfg.getCell('B4').value = 'out.xlsx';

const main = tpl.addWorksheet('Main');
main.getCell('A1').value = 'a'; main.getCell('B1').value = 'b';
// Cluster 1 at row 2 (cols A-B)
main.getCell('A2').value = '{{ [a] }}';
main.getCell('B2').value = '{{ [b] }}';
// Gap row 3 (no markers)
// Cluster 2 at row 5 — disconnected → should raise the error
main.getCell('A5').value = '{{ [a] }}';

writeFileSync(join(dir, 'template.xlsx'), Buffer.from(await tpl.xlsx.writeBuffer()));

const data = new ExcelJS.Workbook();
const ws = data.addWorksheet('Data');
ws.getCell('A1').value = 'a'; ws.getCell('B1').value = 'b';
ws.getCell('A2').value = 'X'; ws.getCell('B2').value = 1;
writeFileSync(join(dir, 'data.xlsx'), Buffer.from(await data.xlsx.writeBuffer()));

writeFileSync(join(dir, 'meta.yaml'),
`description: ADR-0066 — when a sheet has two or more disconnected clusters of [Column] data-row cells, the parser raises xl3/expression/bracket-outside-block at parse time (Phase 1 supports a single block per sheet).
spec_section: ADR-0066
spec_version: "0.1"
tags: [adr-0066, column-scoped-block, error, negative-path]
verified_by: [manual-script]
expected_error: "form 2 disconnected clusters"
expected_error_code: 'xl3/expression/bracket-outside-block'
`);

console.log('Fixture 145 written.');
