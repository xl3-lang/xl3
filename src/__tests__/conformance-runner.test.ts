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
