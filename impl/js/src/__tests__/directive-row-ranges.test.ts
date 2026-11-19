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
    dvType: (address: string) =>
      (ranges.dataValidations.model[address] as { type?: string } | undefined)?.type,
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

  // A rule formula is anchored to the first cell of its range and is never
  // rewritten (ADR-0046). Moving the range of a rule with a relative row
  // would make every cell test the row below it, so such a rule stays
  // where the template put it — exactly as before this fix.
  it('leaves a rule whose formula names a relative row where it was', async () => {
    const out = await render((s) => {
      s.getCell('A1').value = '{{ @filter [Name] != "omit" }}';
      s.getCell('A2').value = '{{ [Name] }}';
      s.addConditionalFormatting({ ref: 'A2:A2', rules: [cfRule('A2="Alpha"')] });
      s.getCell('A2').dataValidation = { type: 'custom', allowBlank: true, formulae: ['A2<>""'] };
    });
    expect(out.cf).toEqual(['A2:A2']);
    expect(out.cfFormulae).toEqual(['A2="Alpha"']);
    expect(out.dv).toEqual(['A2']);
  });

  it('moves a rule whose formula has no relative row', async () => {
    const out = await render((s) => {
      s.getCell('A1').value = '{{ @filter [Name] != "omit" }}';
      s.getCell('A2').value = '{{ [Name] }}';
      // An absolute reference and a constant: neither depends on the
      // range's first row.
      s.addConditionalFormatting({ ref: 'A2:A2', rules: [cfRule('$D$1="on"')] });
      s.addConditionalFormatting({ ref: 'B2:B2', rules: [cfRule('TRUE')] });
      s.getCell('A2').dataValidation = DV;
    });
    expect(out.cf).toEqual(['A1:A3', 'B1:B3']);
    expect(out.cfFormulae.sort()).toEqual(['$D$1="on"', 'TRUE']);
    expect(out.dv).toEqual(['A1', 'A2', 'A3']);
  });

  // A cell holds one validation. A row-anchored one stays on its template
  // address, so the validation that would move onto that address has no
  // cell to take. It used to be dropped from the output; it now keeps its
  // template address too, and so does each one below it that would land on
  // an address kept this way.
  it('keeps a validation whose destination holds one that stayed', async () => {
    const out = await render((s) => {
      s.getCell('A1').value = '{{ @sort [Name] }}';
      s.getCell('A2').value = '{{ [Name] }}';
      s.getCell('A3').value = 'Approve?';
      s.getCell('A4').value = 'Reviewed?';
      s.getCell('B2').dataValidation = { type: 'custom', allowBlank: true, formulae: ['B2<>""'] };
      s.getCell('B3').dataValidation = DV;
      s.getCell('B4').dataValidation = { type: 'whole', allowBlank: true, formulae: [0, 9] };
      // Nothing stays in column C, so its validation moves with its cell.
      s.getCell('C3').dataValidation = DV;
    });
    expect(out.a).toEqual({ 1: 'Alpha', 2: 'Beta', 3: 'Gamma', 4: 'Approve?', 5: 'Reviewed?' });
    expect(out.dv).toEqual(['B2', 'B3', 'B4', 'C2']);
    expect([out.dvType('B2'), out.dvType('B3'), out.dvType('B4')]).toEqual([
      'custom',
      'list',
      'whole',
    ]);
  });
});

/**
 * Two blocks side by side share their template rows, so "inside the
 * block's row span" (ADR-0040) is true of both blocks for every range on
 * those rows. Each block grew the other's ranges by its own record count.
 * On a sheet with several blocks a range belongs to the block whose
 * columns hold it (ADR-0066, ADR-0068).
 */
describe('CF / DV ranges of side-by-side blocks', () => {
  const sideBySide = (leftFilter: string, rightFilter: string) => (s: ExcelJS.Worksheet) => {
    s.getCell('A1').value = '{{ @block A3:A3 }}';
    s.getCell('C1').value = '{{ @block C3:C3 }}';
    s.getCell('A2').value = `{{ @filter ${leftFilter} }}`;
    s.getCell('C2').value = `{{ @filter ${rightFilter} }}`;
    s.getCell('A3').value = '{{ [Name] }}';
    s.getCell('C3').value = '{{ default[Name] }}';
    mark(s, 'A3');
    mark(s, 'C3');
  };

  it('extends each range by its own block: fewer records on the left', async () => {
    const out = await render(sideBySide('[Kind] = "x"', '[Name] != "omit"'));
    expect(out.a).toEqual({ 1: 'Alpha', 2: 'Gamma' });
    expect(out.column(3)).toEqual({ 1: 'Alpha', 2: 'Beta', 3: 'Gamma' });
    expect(out.cf).toEqual(['A1:A2', 'C1:C3']);
    expect(out.dv).toEqual(['A1', 'A2', 'C1', 'C2', 'C3']);
  });

  it('extends each range by its own block: fewer records on the right', async () => {
    const out = await render(sideBySide('[Name] != "omit"', '[Kind] = "y"'));
    expect(out.a).toEqual({ 1: 'Alpha', 2: 'Beta', 3: 'Gamma' });
    expect(out.column(3)).toEqual({ 1: 'Beta' });
    expect(out.cf).toEqual(['A1:A3', 'C1:C1']);
    expect(out.dv).toEqual(['A1', 'A2', 'A3', 'C1']);
  });

  it('tests each sub-range of a multi-range rule against its own block', async () => {
    const out = await render((s) => {
      sideBySide('[Kind] = "x"', '[Name] != "omit"')(s);
      s.addConditionalFormatting({ ref: 'A3:A3 C3:C3', rules: [cfRule('$E$1="on"')] });
    });
    expect(out.cf).toEqual(['A1:A2', 'A1:A2 C1:C3', 'C1:C3']);
  });

  it('leaves a range that is in no single block as authored', async () => {
    const out = await render((s) => {
      sideBySide('[Name] != "omit"', '[Kind] = "x"')(s);
      // Across both blocks, and beside them: neither is one block's range.
      s.addConditionalFormatting({ ref: 'A3:C3', rules: [cfRule('TRUE')] });
      s.addConditionalFormatting({ ref: 'E3:E3', rules: [cfRule('TRUE')] });
      s.getCell('E3').dataValidation = DV;
    });
    expect(out.cf).toEqual(['A1:A3', 'A1:C1', 'C1:C2', 'E1:E1']);
    expect(out.dv).toEqual(['A1', 'A2', 'A3', 'C1', 'C2', 'E1']);
  });
});
