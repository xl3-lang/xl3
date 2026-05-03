import type { ParsedTemplate, TemplateModel } from './types.js';

export function toTemplateModel(parsed: ParsedTemplate): TemplateModel {
  const { workbook: _workbook, ...model } = parsed;
  return model;
}
