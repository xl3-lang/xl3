import { describe, expect, it } from 'vitest';
import { parseMeta } from '../conformance-runner.js';

describe('parseMeta', () => {
  it('reads required scalar fields', () => {
    const text = `
description: A short description
spec_section: language.md "Source Columns"
spec_version: "0.1"
tags: [substitution, basic]
verified_by: [manual-script]
`;
    expect(parseMeta(text)).toEqual({
      description: 'A short description',
      spec_section: 'language.md "Source Columns"',
      spec_version: '0.1',
      tags: ['substitution', 'basic'],
      verified_by: ['manual-script'],
      expected_warnings: [],
      dynamic_cells: [],
      comparison_stage: 1,
    });
  });

  it('strips matching outer quotes from values', () => {
    expect(parseMeta(`description: "quoted desc"\nspec_version: '0.2'`)).toMatchObject({
      description: 'quoted desc',
      spec_version: '0.2',
    });
  });

  it('parses skip_reason when present', () => {
    const meta = parseMeta(`description: x\nskip_reason: needs canonicalization runner`);
    expect(meta.skip_reason).toBe('needs canonicalization runner');
  });

  it('parses expected_error when present', () => {
    const meta = parseMeta(`description: x\nexpected_error: "Source sheet"`);
    expect(meta.expected_error).toBe('Source sheet');
  });

  it('parses expected_dynamic and dynamic cell assertions', () => {
    const meta = parseMeta(`
description: today
expected_dynamic: utc_today
dynamic_cells:
  - sheet: R
    cell: A2
    format: YYYY-MM-DD
`);
    expect(meta.expected_dynamic).toBe('utc_today');
    expect(meta.dynamic_cells).toEqual([
      { sheet: 'R', cell: 'A2', format: 'YYYY-MM-DD' },
    ]);
  });

  it('parses comparison_stage with default 1', () => {
    expect(parseMeta(`description: x`).comparison_stage).toBe(1);
    expect(parseMeta(`description: x\ncomparison_stage: 2`).comparison_stage).toBe(2);
  });

  it('parses inline string lists with trimmed items', () => {
    const meta = parseMeta(`tags: [a , b,c , d]`);
    expect(meta.tags).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns empty arrays for empty inline lists', () => {
    expect(parseMeta(`tags: []`).tags).toEqual([]);
  });

  it('ignores blank lines and comments', () => {
    const text = `
# leading comment
description: desc  # inline comment
tags: [a, b]

`;
    expect(parseMeta(text)).toMatchObject({
      description: 'desc',
      tags: ['a', 'b'],
    });
  });

  it('ignores unknown keys without throwing', () => {
    expect(() => parseMeta(`unknown_key: 123\ndescription: ok`)).not.toThrow();
  });
});
