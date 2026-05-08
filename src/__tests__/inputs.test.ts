import { describe, expect, it } from 'vitest';
import { resolveInputs } from '../inputs.js';
import type { InputSpec } from '../types.js';

const text = (overrides: Partial<InputSpec> = {}): InputSpec => ({
  name: 'memo',
  type: 'text',
  required: true,
  ...overrides,
});

describe('resolveInputs (ADR-0010)', () => {
  it('returns empty when no specs declared', () => {
    expect(resolveInputs([], { unused: 'x' })).toEqual({});
  });

  it('passes text values through under the bare-name key', () => {
    const out = resolveInputs([text({ name: 'month' })], { month: '2026-05' });
    expect(out).toEqual({ month: '2026-05' });
  });

  it('errors with stable substring when a required input is missing', () => {
    expect(() => resolveInputs([text({ name: 'month' })], {}))
      .toThrow(/Input "month" is required/);
  });

  it('falls back to default when host omits the input', () => {
    const out = resolveInputs(
      [text({ name: 'region', required: false, default: '서울' })],
      undefined,
    );
    expect(out).toEqual({ region: '서울' });
  });

  it('coerces number inputs and rejects non-numeric strings', () => {
    const spec = text({ name: 'threshold', type: 'number' });
    expect(resolveInputs([spec], { threshold: '10000' })).toEqual({ threshold: '10000' });
    expect(resolveInputs([spec], { threshold: 1234.5 })).toEqual({ threshold: '1234.5' });
    expect(() => resolveInputs([spec], { threshold: 'not a number' }))
      .toThrow(/Input "threshold" cannot be parsed as a number/);
  });

  it('coerces date inputs and rejects malformed strings', () => {
    const spec = text({ name: 'when', type: 'date' });
    expect(resolveInputs([spec], { when: '2026-05-07' })).toEqual({ when: '2026-05-07' });
    expect(resolveInputs([spec], { when: '2026-05' })).toEqual({ when: '2026-05' });
    expect(() => resolveInputs([spec], { when: 'last tuesday' }))
      .toThrow(/Input "when" cannot be parsed as a date/);
    expect(() => resolveInputs([spec], { when: '2026-13-01' }))
      .toThrow(/Input "when" cannot be parsed as a date/);
  });

  it('validates select inputs against the declared options', () => {
    const spec: InputSpec = {
      name: 'region',
      type: 'select',
      required: true,
      options: ['Seoul', 'Busan', 'Daegu'],
    };
    expect(resolveInputs([spec], { region: 'Busan' })).toEqual({ region: 'Busan' });
    expect(() => resolveInputs([spec], { region: 'Tokyo' }))
      .toThrow(/Input "region" value "Tokyo" is not in the declared options/);
  });

  it('canonicalString-stringifies non-string host inputs (Boolean → uppercase)', () => {
    const spec = text({ name: 'active' });
    expect(resolveInputs([spec], { active: true })).toEqual({ active: 'TRUE' });
    expect(resolveInputs([spec], { active: false })).toEqual({ active: 'FALSE' });
  });

  it('skips optional inputs when the host omits them and no default is provided', () => {
    const spec = text({ name: 'memo', required: false });
    expect(resolveInputs([spec], {})).toEqual({});
  });
});
