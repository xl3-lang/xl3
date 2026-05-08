import { describe, expect, it } from 'vitest';
import {
  canonicalString,
  compareValues,
  isEmpty,
  isTruthy,
} from '../functions.js';

// Property-based smoke tests. We do not pull in fast-check / hedgehog
// to avoid a new devDep; the generator below is deterministic via a
// linear-congruential seeded RNG so failures reproduce. Each test
// runs N=200 cases. If a case fails, the failing input is logged.
//
// What we're checking: invariants that should hold for any value
// the spec touches. A counterexample here means a real spec or
// impl bug.

const ITERATIONS = 200;

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    // Numerical Recipes LCG.
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function randomValue(rng: () => number): unknown {
  const kind = pick(rng, ['null', 'undef', 'empty-str', 'ws-str', 'str', 'int', 'float', 'zero', 'neg', 'true', 'false', 'date']);
  switch (kind) {
    case 'null': return null;
    case 'undef': return undefined;
    case 'empty-str': return '';
    case 'ws-str': return pick(rng, [' ', '\t', '   ', '\n']);
    case 'str': return pick(rng, ['hello', 'a', '123abc', 'TRUE', '0', 'false', 'café', '한글']);
    case 'int': return Math.floor(rng() * 1000);
    case 'float': return rng() * 100 - 50;
    case 'zero': return 0;
    case 'neg': return -Math.floor(rng() * 1000);
    case 'true': return true;
    case 'false': return false;
    case 'date': return new Date(Date.UTC(2020 + Math.floor(rng() * 10), Math.floor(rng() * 12), 1 + Math.floor(rng() * 28)));
    default: return null;
  }
}

function fuzz(label: string, fn: (v: unknown, w: unknown, rng: () => number) => void): void {
  it(label, () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const rng = makeRng(i * 0x9E3779B1);
      const a = randomValue(rng);
      const b = randomValue(rng);
      try {
        fn(a, b, rng);
      } catch (e) {
        const aDesc = JSON.stringify(a) ?? String(a);
        const bDesc = JSON.stringify(b) ?? String(b);
        throw new Error(`property failed at iter=${i} a=${aDesc} b=${bDesc}: ${(e as Error).message}`);
      }
    }
  });
}

describe('properties — value model invariants', () => {
  fuzz('canonicalString never throws and always returns a string', (v) => {
    const s = canonicalString(v);
    expect(typeof s).toBe('string');
  });

  fuzz('canonicalString of empty values is the empty string (ADR-0007/0009)', (v) => {
    if (isEmpty(v)) {
      expect(canonicalString(v)).toBe('');
    }
  });

  fuzz('isTruthy false implies empty OR boolean false OR numeric 0 (ADR-0008)', (v) => {
    if (!isTruthy(v)) {
      const isStrictlyFalse = v === false || v === 0 || isEmpty(v);
      expect(isStrictlyFalse).toBe(true);
    }
  });

  fuzz('compareValues is total — only -1, 0, or +1', (a, b) => {
    const r = compareValues(a, b);
    expect([-1, 0, 1]).toContain(r);
  });

  fuzz('compareValues is reflexive (x compares 0 to itself)', (v) => {
    // Reflexivity is well-defined here because compareValues always
    // returns a definite ordering even for empty/empty (which compare 0).
    expect(compareValues(v, v)).toBe(0);
  });

  fuzz('compareValues is antisymmetric (sign flips on swap)', (a, b) => {
    const ab = compareValues(a, b);
    const ba = compareValues(b, a);
    expect(ab + ba).toBe(0);
  });

  fuzz('isEmpty is consistent with canonicalString === "" for non-numbers/booleans/dates', (v) => {
    if (typeof v === 'number' || typeof v === 'boolean' || v instanceof Date) return;
    expect(isEmpty(v)).toBe(canonicalString(v) === '');
  });

  fuzz('canonicalString of a finite number round-trips through Number()', (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    const s = canonicalString(v);
    expect(Number(s)).toBe(v);
  });

  fuzz('canonicalString of TRUE/FALSE booleans is uppercase per ADR-0009', (v) => {
    if (v === true) expect(canonicalString(v)).toBe('TRUE');
    if (v === false) expect(canonicalString(v)).toBe('FALSE');
  });
});

describe('properties — comparison transitivity (sampled)', () => {
  // Transitivity over THREE random values. With N=200 cases and 3
  // values each, this samples 600 triples — enough to catch a class
  // of bugs without exploding the runtime.
  it('compareValues is transitive across triples', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const rng = makeRng(i * 0xDEADBEEF);
      const a = randomValue(rng);
      const b = randomValue(rng);
      const c = randomValue(rng);
      const ab = compareValues(a, b);
      const bc = compareValues(b, c);
      const ac = compareValues(a, c);
      // Transitivity: if a <= b and b <= c, then a <= c.
      if (ab <= 0 && bc <= 0) {
        expect(ac).toBeLessThanOrEqual(0);
      }
      if (ab >= 0 && bc >= 0) {
        expect(ac).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
