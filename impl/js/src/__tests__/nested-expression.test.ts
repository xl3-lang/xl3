import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { convertJson } from '../index.js';
import { isXtlError } from '../error-codes.js';

/**
 * Issues #128 / #130 — expression structure lost during normalization.
 *
 * #128: an aggregate nested in another call (`ROUND(SUM([Amount]), 2)`)
 * skipped aggregate normalization, so it rendered 0 instead of the total,
 * and its `[Column]` argument was read as a current-row reference, which
 * repeated the cell once per record.
 *
 * #130: IF / IFS conditions located the comparison operator with a plain
 * substring search, so an operator inside a string literal split the
 * condition, and arithmetic / function-call operands were never evaluated.
 *
 * Every case renders a real template and reloads the produced XLSX, so the
 * value and the output row count are checked together.
 */

type Rows = unknown[][];

const HEADERS = ['Name', 'Amount', 'Code'];
const ROWS: Rows = [
  ['Alpha', 1, 'a=b'],
  ['Beta', 2, 'x>=y'],
];

async function render(
  cells: Record<string, string>,
  extraSources: Record<string, { headers: string[]; rows: Rows }> = {},
  primary: { headers: string[]; rows: Rows } = { headers: HEADERS, rows: ROWS },
): Promise<unknown[][]> {
  const template = new ExcelJS.Workbook();
  if (Object.keys(extraSources).length > 0) {
    const decl = template.addWorksheet('__sources__');
    decl.addRow(['name', 'sheet']);
    for (const name of Object.keys(extraSources)) decl.addRow([name, name]);
  }
  const sheet = template.addWorksheet('Report');
  for (const [address, value] of Object.entries(cells)) sheet.getCell(address).value = value;

  const files = await convertJson((await template.xlsx.writeBuffer()) as ArrayBuffer, {
    version: 'xl3-source-json/0.1',
    sources: { default: primary, ...extraSources },
  });
  expect(files).toHaveLength(1);

  const output = new ExcelJS.Workbook();
  const data = files[0]!.data;
  await output.xlsx.load(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  const out: unknown[][] = [];
  output.getWorksheet('Report')!.eachRow({ includeEmpty: true }, (row) => {
    const values = (row.values as unknown[]).slice(1);
    out.push(values.map((v) => v ?? null));
  });
  return out;
}

/** Render a single-cell template and return column A of every output row. */
async function renderCell(
  expr: string,
  primary?: { headers: string[]; rows: Rows },
): Promise<unknown[]> {
  return (await render({ A1: `{{ ${expr} }}` }, {}, primary)).map((r) => r[0]);
}

async function errorCode(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run;
  } catch (e) {
    return isXtlError(e) ? e.code : `not an xl3 error: ${String(e)}`;
  }
  return undefined;
}

describe('#128 nested aggregates', () => {
  it.each([
    ['SUM([Amount])', 3],
    ['ROUND(SUM([Amount]), 2)', 3],
    ['TEXT(SUM([Amount]), "0.00")', '3.00'],
    ['ROUND(AVERAGE([Amount]), 1)', 1.5],
    ['ABS(MIN([Amount]))', 1],
    ['ROUND(MAX([Amount]), 0)', 2],
    ['ROUND(COUNT([Amount]), 0)', 2],
    ['ROUND(COUNT(), 0)', 2],
    ['IF(SUM([Amount]) > 2, "big", "small")', 'big'],
    ['IF(COUNT() > 5, "many", "few")', 'few'],
    ['IF(1 = 1, SUM([Amount]), 0)', 3],
    // An aggregate as the whole condition.
    ['IF(SUM([Amount]), "has", "none")', 'has'],
    ['IF(COUNT(), "has", "none")', 'has'],
    ['IFS(MIN([Amount]) > 5, "big", SUM([Amount]), "some")', 'some'],
  ])('%s renders the row-set result once', async (expr, expected) => {
    // One output row: the aggregate's [Column] argument is not a
    // current-row reference, so the cell must not repeat per record.
    expect(await renderCell(expr)).toEqual([expected]);
  });

  it.each([
    ['SUM([Amount]) / COUNT()', 1.5],
    ['ROUND(SUM([Amount]) / COUNT(), 2)', 1.5],
    ['SUM([Amount]) + SUM([Amount])', 6],
    ['(SUM([Amount]) - MIN([Amount])) * 2', 4],
  ])('%s combines aggregates arithmetically', async (expr, expected) => {
    expect(await renderCell(expr)).toEqual([expected]);
  });

  it('evaluates source-qualified aggregates nested in a call', async () => {
    const out = await render(
      { A1: '{{ ROUND(SUM(Other[Value]), 1) }}', B1: '{{ TEXT(COUNT(Other[Value]), "0") }}' },
      { Other: { headers: ['Value'], rows: [[10.25], [20.5]] } },
    );
    expect(out).toEqual([[30.8, '2']]);
  });

  it('keeps a nested-aggregate cell static beside a data block', async () => {
    const out = await render({
      A1: '{{ TEXT(SUM([Amount]), "0.00") }}',
      A2: '{{ [Name] }}',
      B2: '{{ [Amount] }}',
      A3: '{{ ROUND(SUM([Amount]), 2) }}',
    });
    expect(out).toEqual([['3.00'], ['Alpha', 1], ['Beta', 2], [3]]);
  });

  it('treats a current-row reference next to a nested aggregate as per-row', async () => {
    const out = await render({
      A1: '{{ [Name] }}',
      B1: '{{ ROUND([Amount] / SUM([Amount]), 2) }}',
      C1: '{{ IF([Amount] > 1, SUM([Amount]), 0) }}',
    });
    expect(out).toEqual([
      ['Alpha', 0.33, 0],
      ['Beta', 0.67, 3],
    ]);
  });

  it('evaluates call operands on both sides of an arithmetic operator', async () => {
    expect(await renderCell('ABS([Amount]) + ABS([Amount])')).toEqual([2, 4]);
  });
});

describe('#130 IF / IFS conditions', () => {
  it.each([
    // Operators inside string literals are text, not comparison operators.
    ['IF("a=b" = "a=b", "yes", "no")', ['yes']],
    ['IF("a!=b" != "a!=b", "diff", "same")', ['same']],
    ['IF([Code] = "a=b", "hit", "miss")', ['hit', 'miss']],
    ['IF([Code] = "x>=y", "hit", "miss")', ['miss', 'hit']],
    ['IF([Code] != "x>=y", "hit", "miss")', ['hit', 'miss']],
    ['IF([Code] = "a<b", "hit", "miss")', ['miss', 'miss']],
    // Arithmetic operands are evaluated before the comparison.
    ['IF([Amount] + 1 > 2, "yes", "no")', ['no', 'yes']],
    ['IF([Amount] * 2 >= 4, "yes", "no")', ['no', 'yes']],
    ['IF(2 < [Amount] + 1, "yes", "no")', ['no', 'yes']],
    ['IF(([Amount] + 1) > 2, "yes", "no")', ['no', 'yes']],
    ['IF(([Amount] > 1), "yes", "no")', ['no', 'yes']],
    // Function-call operands are evaluated before the comparison.
    ['IF(ABS([Amount]) > 1, "yes", "no")', ['no', 'yes']],
    ['IF(ROUND([Amount] / 2, 0) = 1, "yes", "no")', ['yes', 'yes']],
    // Existing simple shapes keep working.
    ['IF([Amount] = 1, "one", "other")', ['one', 'other']],
    ['IF([Amount] > -1, "yes", "no")', ['yes', 'yes']],
    ['IF([Amount] <= 1, "yes", "no")', ['yes', 'no']],
    ['IF([Name] = "A&B", "hit", "miss")', ['miss', 'miss']],
  ])('%s', async (expr, expected) => {
    expect(await renderCell(expr)).toEqual(expected);
  });

  it.each([
    ['IFS([Amount] * 2 >= 4, "hi", TRUE, "lo")', ['lo', 'hi']],
    ['IFS([Code] = "a=b", "eq", [Code] = "x>=y", "ge", TRUE, "other")', ['eq', 'ge']],
    ['IFS(ABS([Amount]) > 1, "big", TRUE, "small")', ['small', 'big']],
  ])('%s', async (expr, expected) => {
    expect(await renderCell(expr)).toEqual(expected);
  });
});

/**
 * Text that is not structure. A string literal has no escape sequences and
 * a column name runs to the next `]`, so an operator, quote, apostrophe, or
 * parenthesis inside either is part of the literal or the name. These
 * expressions worked before #128 / #130 and must keep working.
 */
describe('operators and quotes inside names and literals', () => {
  const odd = {
    headers: ['Name', 'R&D', 'P&L', "Owner's A", "Owner's B", '2) Qty', 'Amount (KRW'],
    rows: [
      ['al', 1, 1, 1, 2, 10, -4],
      ['bo', 2, 5, 3, 2, 20, 5],
    ] as Rows,
  };

  it.each([
    // `&` in a column name.
    ['IF([R&D] > 1, "y", "n")', ['n', 'y']],
    ['IF([P&L] = [R&D], "y", "n")', ['y', 'n']],
    ['IF(1 < [R&D], "y", "n")', ['n', 'y']],
    ['IFS([P&L] >= 5, "hi", TRUE, "lo")', ['lo', 'hi']],
    ['[R&D]', [1, 2]],
    ['ABS([R&D])', [1, 2]],
    ['[R&D] + [P&L]', [2, 7]],
    ['[Name] & "&" & [R&D]', ['al&1', 'bo&2']],
    // An apostrophe in a column name.
    ['IF([Owner\'s A] > [Owner\'s B], "y", "n")', ['n', 'y']],
    ['IFS([Owner\'s A] > [Owner\'s B], "gt", TRUE, "le")', ['le', 'gt']],
    ["ABS([Owner's A])", [1, 3]],
    ["UPPER([Name]) & [Owner's A]", ['AL1', 'BO3']],
    ['IF([R&D] > 1, "big", [Owner\'s A])', [1, 'big']],
    ['CONCAT("it\'s", [Name])', ["it'sal", "it'sbo"]],
    // An unbalanced parenthesis in a column name.
    ['ABS([Amount (KRW])', [4, 5]],
    // A string literal ending in a backslash.
    ['CONCAT([Name], "\\")', ['al\\', 'bo\\']],
    ['IFEMPTY([Name], "C:\\")', ['al', 'bo']],
    ['IF([Name] = "a\\", "y", "n")', ['n', 'n']],
  ])('%s', async (expr, expected) => {
    expect(await renderCell(expr, odd)).toEqual(expected);
  });

  it.each([
    ["SUM([Owner's A])", 4],
    ["COUNT([Owner's B])", 2],
    ['SUM([2) Qty])', 30],
    ['SUM([R&D])', 3],
    ["ROUND(SUM([Owner's A]) / COUNT(), 1)", 2],
  ])('%s aggregates once', async (expr, expected) => {
    expect(await renderCell(expr, odd)).toEqual([expected]);
  });
});

describe('#131 & concatenation', () => {
  const one = { headers: ['Name', 'Amount'], rows: [['Alpha', 1]] as Rows };

  it.each([
    ['"A&B"', 'A&B'],
    ['[Name] & " & " & [Amount]', 'Alpha & 1'],
    ['TEXT([Amount], "0.00") & " USD"', '1.00 USD'],
    ['"Total: " & TEXT(SUM([Amount]), "0.00")', 'Total: 1.00'],
    // Spaces inside a literal are kept; an empty literal adds nothing.
    ['[Name] & " - " & [Amount]', 'Alpha - 1'],
    ['[Name] & "" & [Amount]', 'Alpha1'],
    ['" [" & [Name] & "] "', ' [Alpha] '],
    // Nested calls, arithmetic, and parenthesized groups are evaluated.
    ['UPPER([Name]) & "-" & LOWER([Name])', 'ALPHA-alpha'],
    ['[Name] & ([Amount] + 1)', 'Alpha2'],
    ['[Name] & [Amount] * 3', 'Alpha3'],
    ['CONCAT([Name], "&") & IF([Amount] = 1, "one", "other")', 'Alpha&one'],
    ['IF([Amount] = 1, [Name] & "!", "x")', 'Alpha!'],
    ['IF([Name] & "x" = "Alphax", "y", "n")', 'y'],
    // An `&` inside a nested call's string argument stays text.
    ['[Name] & IFEMPTY("", "a&b")', 'Alphaa&b'],
  ])('%s', async (expr, expected) => {
    expect(await renderCell(expr, one)).toEqual([expected]);
  });

  it('evaluates a source reference operand instead of writing its text', async () => {
    // Outside an @source / @join block the reference has no current row,
    // which is an error — it used to render as the text `Other[Value]`.
    const run = render(
      { A1: '{{ "[" & Other[Value] & "]" }}' },
      { Other: { headers: ['Value'], rows: [[7]] } },
    );
    expect(await errorCode(run)).toBe('xl3/source/row-cross-block');
  });

  it('keeps bare text and bare numbers as literal text', async () => {
    expect(await renderCell('[Name] & Inc(US)', one)).toEqual(['AlphaInc(US)']);
    expect(await renderCell('[Name] & 1.50', one)).toEqual(['Alpha1.50']);
  });
});

describe('#137 COUNT argument shape', () => {
  it.each([
    ['COUNT()', 2],
    ['COUNT([Amount])', 2],
    ['ROUND(COUNT([Amount]), 0)', 2],
  ])('%s is accepted', async (expr, expected) => {
    expect(await renderCell(expr)).toEqual([expected]);
  });

  it('accepts a source-qualified column', async () => {
    const out = await render(
      { A1: '{{ COUNT(Other[Value]) }}' },
      { Other: { headers: ['Value'], rows: [[1], [2], [3]] } },
    );
    expect(out).toEqual([[3]]);
  });

  it.each([
    'COUNT("Amount")',
    'COUNT(1)',
    'COUNT([Amount] + 1)',
    'COUNT(ABS([Amount]))',
    'COUNT(Amount)',
    'ROUND(COUNT("Amount"), 0)',
  ])('%s is rejected as a bad aggregate argument', async (expr) => {
    expect(await errorCode(renderCell(expr))).toBe('xl3/eval/bad-aggregate-arg');
  });

  it('still checks arity first', async () => {
    expect(await errorCode(renderCell('COUNT([Amount], [Name])'))).toBe('xl3/eval/arity-mismatch');
  });
});

describe('parentheses and brackets inside names and literals, nested', () => {
  const data = {
    headers: ['Name', 'Amount', 'Amt (KRW', '2) Qty'],
    rows: [
      ['(', 10.5, 8, 7],
      ['a)', 20.25, 9, 6],
    ] as Rows,
  };

  it.each([
    // A column name with an unpaired parenthesis, as a nested argument.
    ['ROUND([Amt (KRW], 0)', [8, 9]],
    ['IFEMPTY([Amt (KRW], 0)', [8, 9]],
    ['TEXT([2) Qty], "0.00")', ['7.00', '6.00']],
    ['ABS([2) Qty])', [7, 6]],
    ['ABS(([2) Qty]))', [7, 6]],
    ['[2) Qty] * 2', [14, 12]],
    ['[Amount] + ([2) Qty])', [17.5, 26.25]],
    ['IF([2) Qty] > 6, "y", "n")', ['y', 'n']],
    ['IF([Amount] > 100, "x", ([2) Qty]))', [7, 6]],
    // A string literal with an unpaired parenthesis or bracket.
    ['IF([Name] = "(", "y", "n")', ['y', 'n']],
    ['IF([Name] = "a)", "y", "n")', ['n', 'y']],
    ['IF([Name] != "]", "y", "n")', ['y', 'y']],
    ['IFEMPTY("", "(") & [Name]', ['((', '(a)']],
    ['CONCAT("[", [Name], "]")', ['[(]', '[a)]']],
  ])('%s', async (expr, expected) => {
    expect(await renderCell(expr, data)).toEqual(expected);
  });

  it.each([
    ['ROUND(SUM([Amt (KRW]), 0)', 17],
    ['ROUND(SUM([2) Qty]), 0)', 13],
  ])('%s aggregates once', async (expr, expected) => {
    expect(await renderCell(expr, data)).toEqual([expected]);
  });
});

/**
 * Unquoted text has no place in the grammar, but XTL has long rendered an
 * unquoted word as itself and resolved a bare word that names a column.
 * Those readings are kept wherever text and an expression can be told
 * apart.
 */
describe('unquoted text keeps its long-standing reading', () => {
  const data = {
    headers: ['Name', 'Unit', 'Kind', 'Price(USD)', 'R&D'],
    rows: [
      ['Alpha', 'Rate(USD)', 'A&B', 10, 5],
      ['Beta', 'kg', 'Inc(US)', 20, 0],
    ] as Rows,
  };

  it.each([
    // Comparison operands.
    ['IF([Unit] = Rate(USD), "y", "n")', ['y', 'n']],
    ['IF([Kind] = A&B, "y", "n")', ['y', 'n']],
    ['IF([Kind] != A&B, "y", "n")', ['n', 'y']],
    ['IFS([Kind] = A&B, "ab", TRUE, "other")', ['ab', 'other']],
    ['IF([Name] = Alpha, "y", "n")', ['y', 'n']],
    // `&` operands.
    ['[Name] & (draft)', ['Alpha(draft)', 'Beta(draft)']],
    ['[Name] & Inc(US)', ['AlphaInc(US)', 'BetaInc(US)']],
    ['[Name] & Price(USD)', ['Alpha10', 'Beta20']],
  ])('%s', async (expr, expected) => {
    expect(await renderCell(expr, data)).toEqual(expected);
  });

  it('resolves a bare word that names a column, beside a data cell', async () => {
    // A bare word is not a [Column] marker, so the cell repeats only when
    // its row has one.
    const out = await render(
      {
        A1: '{{ [Name] }}',
        B1: '{{ IF(Price(USD) > 10, "y", "n") }}',
        C1: '{{ IF(R&D > 1, "y", "n") }}',
      },
      {},
      data,
    );
    expect(out).toEqual([
      ['Alpha', 'n', 'y'],
      ['Beta', 'y', 'n'],
    ]);
  });

  it('still evaluates an operand that is an expression', async () => {
    expect(await renderCell('IF([Name] & "!" = "Alpha!", "y", "n")', data)).toEqual(['y', 'n']);
    expect(await renderCell('[Name] & ([R&D] + 1)', data)).toEqual(['Alpha6', 'Beta1']);
    expect(await renderCell('[Name] & 2024 - 2025', data)).toEqual(['Alpha-1', 'Beta-1']);
  });
});

// language.md "Template Blocks": whitespace around an operator is
// insignificant, so `{{ [a]+[b] }}` is `{{ [a] + [b] }}`. Operators were
// recognized only between spaces; without them the expression rendered as
// its own source text, or — as a function argument or a condition —
// evaluated to a wrong value.
describe('arithmetic operators without surrounding spaces', () => {
  const data = {
    headers: ['Name', 'Amount', 'Code', 'Unit-Price', 'Price(USD)'],
    rows: [
      ['Alpha', 1, '2024-01-01', 10, 3],
      ['Beta', 2, 'N/A', 20, 4],
    ] as Rows,
  };

  it.each([
    ['[Amount]*2', [2, 4]],
    ['2*[Amount]', [2, 4]],
    ['[Amount]+[Amount]', [2, 4]],
    ['[Amount]-1', [0, 1]],
    ['[Amount] -1', [0, 1]],
    ['[Amount]*-1', [-1, -2]],
    ['[Amount]--1', [2, 3]],
    ['[Amount]*1e-1', [0.1, 0.2]],
    // Precedence and grouping are the same with and without spaces.
    ['[Amount]+[Amount]*2', [3, 6]],
    ['[Amount]/2+[Amount]', [1.5, 3]],
    ['([Amount]+1)*2', [4, 6]],
    ['[Amount]*(1-0.5)', [0.5, 1]],
    ['[Amount] * (1-0.5)', [0.5, 1]],
    ['[Amount]*((1-0.5)*2)', [1, 2]],
    // Calls on both sides of the operator.
    ['ABS([Amount])-ABS([Amount])', [0, 0]],
    ['ROUND([Amount],0)*ROUND([Amount],0)', [1, 4]],
    // As a function argument, a condition operand, and an `&` operand.
    ['ROUND([Amount]/3,2)', [0.33, 0.67]],
    ['ROUND([Amount]*1.1+0.5, 0)', [2, 3]],
    ['IF([Amount]*2 > 2, "y", "n")', ['n', 'y']],
    ['IF([Amount]*2>2, "y", "n")', ['n', 'y']],
    ['[Name] & [Amount]*3', ['Alpha3', 'Beta6']],
    ['[Name] & ([Amount]+1)', ['Alpha2', 'Beta3']],
    // An operator character inside a column name is part of the name.
    ['[Unit-Price]*2', [20, 40]],
    ['[Price(USD)]*[Amount]', [3, 8]],
  ])('%s', async (expr, expected) => {
    expect(await renderCell(expr, data)).toEqual(expected);
  });

  it.each([
    ['SUM([Amount])/COUNT([Amount])', 1.5],
    ['MAX([Amount])-MIN([Amount])', 1],
    ['SUM([Amount])/COUNT([Amount])*100', 150],
  ])('%s is one static value below the data rows', async (expr, expected) => {
    const out = await render({ A1: '{{ [Name] }}', A2: `{{ ${expr} }}` }, {}, data);
    expect(out).toEqual([['Alpha'], ['Beta'], [expected]]);
  });

  // Unquoted text can contain the same characters: a date, a fraction, a
  // phone number, a hyphenated word. Without a space around the operator
  // and with no reference or function call in it, it stays text.
  it.each([
    ['2024-01-01', ['2024-01-01']],
    ['1/2', ['1/2']],
    ['(1+2)*3', ['(1+2)*3']],
    ['[Name] & 2024-01-01', ['Alpha2024-01-01', 'Beta2024-01-01']],
    ['[Name] & 1/2', ['Alpha1/2', 'Beta1/2']],
    ['[Name] & (02)-555-0100', ['Alpha(02)-555-0100', 'Beta(02)-555-0100']],
    ['[Name] & N/A', ['AlphaN/A', 'BetaN/A']],
    ['[Name] & a-b', ['Alphaa-b', 'Betaa-b']],
    ['[Name] & (1+2)', ['Alpha(1+2)', 'Beta(1+2)']],
    ['IF([Code] = 2024-01-01, "y", "n")', ['y', 'n']],
    ['IF([Amount] = 1, 10-20, N/A)', ['10-20', 'N/A']],
    ['Price(USD)*2', ['Price(USD)*2']],
    // An operator inside a string literal is text.
    ['[Name] & "-" & [Amount]', ['Alpha-1', 'Beta-2']],
    ['IF([Name] = "A-B", "y", "n")', ['n', 'n']],
  ])('%s keeps its reading as text', async (expr, expected) => {
    expect(await renderCell(expr, data)).toEqual(expected);
  });

  it('still evaluates the spaced forms as before', async () => {
    expect(await renderCell('10 - 20', data)).toEqual([-10]);
    expect(await renderCell('(1 + 2) * 3', data)).toEqual([9]);
  });

  it('reads & inside a group as a concatenation first, as it does outside one', async () => {
    expect(await renderCell('[Amount] * ("1" / "2"&"5")', data)).toEqual([0.55, 1.1]);
    expect(await renderCell('[Amount]*("1"&"0")', data)).toEqual([10, 20]);
  });

  it('still rejects a unary minus on a reference', async () => {
    expect(await errorCode(renderCell('-[Amount]', data))).toBe('xl3/eval/unsupported-syntax');
  });
});

describe('unbalanced parentheses are an error, not output text', () => {
  it.each([
    'SUM([Amount]))',
    'COUNT())',
    'IF(([Amount] > 1, "y", "n")',
    'ROUND([Amount], 2',
    '[Amount] & ) & [Name]',
    '[Amount] & ( & [Name]',
  ])('%s', async (expr) => {
    expect(await errorCode(renderCell(expr))).toBe('xl3/eval/unsupported-syntax');
  });

  it.each([
    ['"(" & [Name] & ")"', ['(Alpha)', '(Beta)']],
    ['IF([Amount] > 1, "a)", "(b")', ['(b', 'a)']],
    ['[Name] & ":)"', ['Alpha:)', 'Beta:)']],
  ])('%s — a parenthesis inside a literal is text', async (expr, expected) => {
    expect(await renderCell(expr)).toEqual(expected);
  });
});
