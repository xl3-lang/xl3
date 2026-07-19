import type { ParsedTemplate, TemplateModel } from './types.js';

/**
 * Strip the underlying ExcelJS workbook from a `ParsedTemplate` to
 * yield a serializable, workbook-free `TemplateModel`.
 *
 * @stable Frozen at 1.0 per `spec/STABILITY.md` "Public API surface".
 *
 * @example
 * ```ts
 * const parsed = await analyze(templateBuffer);
 * const model = toTemplateModel(parsed);
 * // `model` has no `.workbook`; safe to JSON.stringify or postMessage
 * ```
 */
export function toTemplateModel(parsed: ParsedTemplate): TemplateModel {
  const { workbook: _workbook, ...model } = parsed;
  return model;
}
