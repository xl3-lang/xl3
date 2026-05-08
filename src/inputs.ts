import type { InputSpec } from './types.js';
import { canonicalString } from './functions.js';
import { xtlError } from './error-codes.js';

// ADR-0010 / ADR-0011: resolve host-provided runtime inputs against
// the declarations parsed from the `__inputs__` sheet. Returns the
// resolved values keyed by the bare input name (no underscore prefix).
// The renderer exposes them under the `__inputs__` namespace in ctx,
// so templates reference them via `{{ __inputs__[name] }}`.
//
// Errors are thrown with stable substrings so conformance fixtures can
// match them:
//   - "missing required input"
//   - "input \"<name>\" cannot be parsed as a number"
//   - "input \"<name>\" cannot be parsed as a date"
//   - "input \"<name>\" value \"<value>\" is not in the declared options"
export function resolveInputs(
  specs: InputSpec[],
  host: Record<string, unknown> | undefined,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  if (specs.length === 0) return resolved;

  const provided = host ?? {};

  for (const spec of specs) {
    const hostHas = Object.prototype.hasOwnProperty.call(provided, spec.name);
    let raw: unknown;

    if (hostHas) {
      raw = provided[spec.name];
    } else if (spec.default !== undefined) {
      raw = spec.default;
    } else if (spec.required) {
      throw xtlError("xl3/inputs/missing-required", `Input "${spec.name}" is required but was not provided`);
    } else {
      continue;
    }

    const stored = coerceInput(spec, raw);
    resolved[spec.name] = stored;
  }

  return resolved;
}

function coerceInput(spec: InputSpec, raw: unknown): string {
  switch (spec.type) {
    case 'text':
      return canonicalString(raw);
    case 'number':
      return coerceNumber(spec.name, raw);
    case 'date':
      return coerceDate(spec.name, raw);
    case 'select':
      return coerceSelect(spec, raw);
  }
}

function coerceNumber(name: string, raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  const text = canonicalString(raw).trim();
  if (text === '') {
    throw xtlError("xl3/inputs/parse-number", `Input "${name}" cannot be parsed as a number: empty value`);
  }
  const cleaned = text.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    throw xtlError("xl3/inputs/parse-number", `Input "${name}" cannot be parsed as a number: ${text}`);
  }
  return String(Number(cleaned));
}

const DATE_PATTERNS = [
  /^(\d{4})$/,
  /^(\d{4})[-/](\d{1,2})$/,
  /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/,
  /^(\d{4})(\d{2})(\d{2})$/,
];

function coerceDate(name: string, raw: unknown): string {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      throw xtlError("xl3/inputs/parse-date", `Input "${name}" cannot be parsed as a date: invalid Date`);
    }
    return formatDateIso(raw);
  }
  const text = canonicalString(raw).trim();
  if (text === '') {
    throw xtlError("xl3/inputs/parse-date", `Input "${name}" cannot be parsed as a date: empty value`);
  }
  for (const re of DATE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const y = Number(m[1]);
      const month = m[2] ? Number(m[2]) : 1;
      const day = m[3] ? Number(m[3]) : 1;
      // ADR-0017: validate in UTC for timezone-independence.
      const d = new Date(Date.UTC(y, month - 1, day));
      if (
        d.getUTCFullYear() === y &&
        d.getUTCMonth() === month - 1 &&
        d.getUTCDate() === day
      ) {
        // Preserve the host's literal string when possible — many
        // numFmt-coercion paths re-parse the ISO form, but a host that
        // sent "2026-05" likely wants that exact form to flow through
        // for filename patterns like `{{ _month }}_report.xlsx`.
        return text;
      }
      throw xtlError("xl3/inputs/parse-date", `Input "${name}" cannot be parsed as a date: ${text}`);
    }
  }
  throw xtlError("xl3/inputs/parse-date", `Input "${name}" cannot be parsed as a date: ${text}`);
}

function coerceSelect(spec: InputSpec, raw: unknown): string {
  const text = canonicalString(raw);
  const options = spec.options ?? [];
  if (options.includes(text)) return text;
  throw xtlError(
    'xl3/inputs/select-option',
    `Input "${spec.name}" value "${text}" is not in the declared options [${options.join(', ')}]`,
  );
}

function formatDateIso(d: Date): string {
  // ADR-0017: UTC accessors for timezone-independence.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
