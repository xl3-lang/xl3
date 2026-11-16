import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { convertJson } from '../index.js';

/**
 * Issue #124 — conditional formatting (CF) and data validation (DV) ranges
 * after a directive row is removed.
 *
 * Removing a directive row moves the cells below it up, but the CF / DV
 * coordinates stayed where they were. A range written for the data cell
 * then sat one row below it, the ADR-0040 extension no longer found it
 * inside the block, and only one record kept its formatting and validation.
 */

const DV: ExcelJS.DataValidation = { type: 'list', allowBlank: true, formulae: ['"A,B"'] };
const cfRule = (formula: string): ExcelJS.ConditionalFormattingRule =>
  ({
    type: 'expression',
    formulae: [formula],
    style: { font: { bold: true } },
  }) as ExcelJS.ConditionalFormattingRule;

type Ranges = {
  conditionalFormattings: { ref: string; rules: { formulae?: string[] }[] }[];
  dataValidations: { model: Record<string, unknown> };
};

async function render(build: (sheet: ExcelJS.Worksheet) => void) {
  const template = new ExcelJS.Workbook();
  build(template.addWorksheet('Report'));
  const [file] = await convertJson((await template.xlsx.writeBuffer()) as ArrayBuffer, {
    version: 'xl3-source-json/0.1',
    sources: {
      default: {
        headers: ['Name', 'Kind'],
        rows: [
          ['Alpha', 'x'],
          ['Beta', 'y'],
          ['Gamma', 'x'],
        ],
      },
    },
  });
  const output = new ExcelJS.Workbook();
  const data = file!.data;
  await output.xlsx.load(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  const sheet = output.getWorksheet('Report')!;
  const ranges = sheet as unknown as Ranges;
  const column = (col: number) => {
    const out: Record<number, unknown> = {};
    sheet.eachRow((row, n) => {
      const v = row.getCell(col).value;
      if (v !== null) out[n] = v;
    });
    return out;
  };
  return {
    a: column(1),
    column,
    dv: Object.keys(ranges.dataValidations.model).sort(),
    cf: ranges.conditionalFormattings.map((c) => c.ref).sort(),
    cfFormulae: ranges.conditionalFormattings.flatMap((c) => c.rules.flatMap((r) => r.formulae)),
  };
}

function mark(sheet: ExcelJS.Worksheet, address: string) {
  sheet.getCell(address).dataValidation = DV;
  sheet.addConditionalFormatting({ ref: `${address}:${address}`, rules: [cfRule('TRUE')] });
}

describe('#124 CF / DV ranges follow directive-row removal', () => {
  it('gives the same ranges with and without a directive row', async () => {
    const without = await render((s) => {
      s.getCell('A1').value = '{{ [Name] }}';
      mark(s, 'A1');
    });
    const withFilter = await render((s) => {
      s.getCell('A1').value = '{{ @filter [Name] != "omit" }}';
      s.getCell('A2').value = '{{ [Name] }}';
      mark(s, 'A2');
    });
    expect(without).toMatchObject({ dv: ['A1', 'A2', 'A3'], cf: ['A1:A3'] });
    expect(withFilter.a).toEqual(without.a);
    expect(withFilter).toMatchObject({ dv: ['A1', 'A2', 'A3'], cf: ['A1:A3'] });
  });

  it('covers only the records a filter keeps', async () => {
    const out = await render((s) => {
      s.getCell('A1').value = '{{ @filter [Kind] = "x" }}';
      s.getCell('A2').value = '{{ [Name] }}';
      mark(s, 'A2');
    });
    expect(out.a).toEqual({ 1: 'Alpha', 2: 'Gamma' });
    expect(out).toMatchObject({ dv: ['A1', 'A2'], cf: ['A1:A2'] });
  });

  it('handles several directive rows, a header, and a footer', async () => {
    const out = await render((s) => {
      s.getCell('A1').value = '{{ @filter [Name] != "omit" }}';
      s.getCell('A2').value = '{{ @sort [Name] desc }}';
      s.getCell('A3').value = 'Header';
      s.getCell('A4').value = '{{ [Name] }}';
      s.getCell('A5').value = 'Total';
      mark(s, 'A3');
      mark(s, 'A4');
      mark(s, 'A5');
    });
    expect(out.a).toEqual({ 1: 'Header', 2: 'Gamma', 3: 'Beta', 4: 'Alpha', 5: 'Total' });
    // Header stays on row 1 and the block covers rows 2-4. The footer's
    // range sits where the footer was before the block grew (row 3): a
    // range below a block does not follow it (ADR-0036 row 1), with or
    // without directive rows.
    expect(out.cf).toEqual(['A1:A1', 'A2:A4', 'A3:A3']);
    expect(out.dv).toEqual(['A1', 'A2', 'A3', 'A4']);
  });

  it('drops a range that sat on the directive row itself', async () => {
    const out = await render((s) => {
      s.getCell('A1').value = '{{ @filter [Name] != "omit" }}';
      s.getCell('A2').value = '{{ [Name] }}';
      mark(s, 'A1');
      mark(s, 'A2');
    });
    expect(out).toMatchObject({ dv: ['A1', 'A2', 'A3'], cf: ['A1:A3'] });
  });

  it('keeps a partially overlapping range as authored (ADR-0040 rule 1.2)', async () => {
    const out = await render((s) => {
      s.getCell('A1').value = '{{ @filter [Name] != "omit" }}';
      s.getCell('A2').value = 'Header';
      s.getCell('A3').value = '{{ [Name] }}';
      // Header + data row: starts above the block.
      s.addConditionalFormatting({ ref: 'A2:A3', rules: [cfRule('TRUE')] });
      // Whole column: never modified.
      s.addConditionalFormatting({ ref: 'C:C', rules: [cfRule('TRUE')] });
    });
    expect(out.a).toEqual({ 1: 'Header', 2: 'Alpha', 3: 'Beta', 4: 'Gamma' });
    expect(out.cf).toEqual(['A1:A2', 'C:C']);
  });

  it('moves the range, not the rule formula text', async () => {
    const out = await render((s) => {
      s.getCell('A1').value = '{{ @filter [Name] != "omit" }}';
      s.getCell('A2').value = '{{ [Name] }}';
      s.addConditionalFormatting({ ref: 'A2:A2', rules: [cfRule('A2="Alpha"')] });
    });
    expect(out.cf).toEqual(['A1:A3']);
    // The formula string is preserved verbatim; only the range moves.
    expect(out.cfFormulae).toEqual(['A2="Alpha"']);
  });
});
