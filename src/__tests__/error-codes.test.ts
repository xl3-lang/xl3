import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { xtlError, isXtlError, type XtlErrorCode } from '../error-codes.js';

// ADR-0015: error.code is a stable contract — hosts dispatch on it
// for localization and programmatic handling. The snapshot below
// pins the full catalog so a rename, removal, or reuse with
// different semantics fails CI. New codes are append-only; adding
// one to this list at the same time as defining it in
// error-codes.ts is the expected workflow.
const EXPECTED_CODES: XtlErrorCode[] = [
  'xl3/cell/formula-no-cache',
  'xl3/eval/arity-mismatch',
  'xl3/eval/operand-coercion',
  'xl3/eval/unsupported-syntax',
  'xl3/cell/numfmt-coercion',
  'xl3/cell/row-outside-repeat',
  'xl3/config/invalid-source-table',
  'xl3/config/source-table-removed',
  'xl3/filename/empty',
  'xl3/filename/too-long',
  'xl3/inputs/conflict-config',
  'xl3/inputs/duplicate-name',
  'xl3/inputs/invalid-name',
  'xl3/inputs/invalid-type',
  'xl3/inputs/missing-header',
  'xl3/inputs/missing-options',
  'xl3/inputs/missing-required',
  'xl3/inputs/parse-date',
  'xl3/inputs/parse-number',
  'xl3/inputs/select-option',
  'xl3/directive/invalid-syntax',
  'xl3/join/bad-on-clause',
  'xl3/join/undeclared-source',
  'xl3/lists/missing-reference',
  'xl3/parser/empty-block',
  'xl3/sheet/duplicate-list-name',
  'xl3/sheet/reserved-name',
  'xl3/source/duplicate-name',
  'xl3/source/invalid-name',
  'xl3/source/missing-header',
  'xl3/source/missing-required',
  'xl3/source/row-cross-block',
  'xl3/source/sheet-missing',
  'xl3/source/undeclared',
  'xl3/source/reserved-column-name',
  'xl3/source/unknown-column',
  'xl3/sources/not-a-dictionary',
  'xl3/xlookup/bare-bracket',
  'xl3/xlookup/no-match',
  'xl3/xlookup/source-mismatch',
];

describe('error code catalog (ADR-0015)', () => {
  it('pins the full set of xtl error codes', () => {
    const source = readErrorCodesSource();
    const declared = extractDeclaredCodes(source).sort();
    const expected = [...EXPECTED_CODES].sort();
    expect(declared).toEqual(expected);
  });

  it('every catalog code is actually thrown somewhere in src/', () => {
    const root = srcRoot();
    const allFiles = collectTsFiles(root).filter(
      (f) => !f.endsWith('error-codes.ts') && !f.includes('__tests__'),
    );
    const haystack = allFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

    const orphans = EXPECTED_CODES.filter(
      (code) => !haystack.includes(`'${code}'`) && !haystack.includes(`"${code}"`),
    );
    expect(orphans).toEqual([]);
  });
});

describe('xtlError / isXtlError', () => {
  it('attaches the code to the Error instance', () => {
    const err = xtlError('xl3/source/undeclared', 'Source "X" is not declared');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('xl3/source/undeclared');
    expect(err.message).toBe('Source "X" is not declared');
  });

  it('isXtlError detects xl3-prefixed errors', () => {
    expect(isXtlError(xtlError('xl3/filename/empty', 'm'))).toBe(true);
  });

  it('isXtlError rejects plain errors', () => {
    expect(isXtlError(new Error('plain'))).toBe(false);
  });

  it('isXtlError rejects errors with non-xl3 codes', () => {
    const fake = new Error('m') as Error & { code: string };
    fake.code = 'ENOENT';
    expect(isXtlError(fake)).toBe(false);
  });

  it('isXtlError rejects non-error values', () => {
    expect(isXtlError(undefined)).toBe(false);
    expect(isXtlError(null)).toBe(false);
    expect(isXtlError({ code: 'xl3/filename/empty' })).toBe(false);
    expect(isXtlError('xl3/filename/empty')).toBe(false);
  });
});

function readErrorCodesSource(): string {
  const here = fileURLToPath(new URL('.', import.meta.url));
  return readFileSync(join(here, '..', 'error-codes.ts'), 'utf8');
}

function extractDeclaredCodes(source: string): string[] {
  // Pull every literal `'xl3/.../...'` from the union type body.
  const matches = source.match(/'xl3\/[a-z-]+\/[a-z-]+'/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

function srcRoot(): string {
  return fileURLToPath(new URL('..', import.meta.url));
}

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...collectTsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}
