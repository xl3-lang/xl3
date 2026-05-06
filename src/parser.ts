import ExcelJS from 'exceljs';
import type { TemplateMeta, TemplateVariable, SheetTemplate, ParsedTemplate, TemplateModel, Directive, DataBlock } from './types.js';
import { isDataExpression, isAggregateExpression, extractColumnRefs } from './normalizer.js';
import { isDirectiveExpression, parseDirective } from './directive-parser.js';

const CONFIG_SHEET = '_config';
const REMOVED_SOURCE_CONFIG_KEYS = new Set([
  'header_row',
  'source_range',
  'source_header_range',
]);
const VAR_PATTERN = /\{\{\s*(.+?)\s*\}\}/g;

/** Flatten any ExcelJS cell value to a plain string. Rich text cells (mixed
 *  font runs) come through as `{ richText: [{text}, ...] }` and stringifying
 *  them naively yields "[object Object]" — we need to concatenate their runs
 *  so directive / variable detection still sees `{{ @filter ... }}` etc. */
function cellString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: { text: string }[] }).richText
      .map((r) => r.text)
      .join('');
  }
  if (typeof value === 'object' && 'result' in value) {
    return String((value as { result: unknown }).result ?? '');
  }
  return String(value);
}

export async function parseTemplate(buffer: ArrayBuffer): Promise<ParsedTemplate> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const { meta, configVars } = readConfigSheet(workbook);

  const allVars: TemplateVariable[] = [];
  const sheetTemplates: SheetTemplate[] = [];
  const listSheets: Record<string, string[]> = {};

  const fileGroupKeys = extractGroupKeys(meta.output_file_pattern);

  for (const worksheet of workbook.worksheets) {
    if (worksheet.name === CONFIG_SHEET) continue;

    // `_`-prefixed list sheets must be parsed even when hidden — they only
    // exist to back `@filter ... in _list` references and should not show up
    // as tabs in the output workbook.
    if (worksheet.name.startsWith('_')) {
      const values: string[] = [];
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const val = String(row.getCell(1).value ?? '').trim();
        if (val) values.push(val);
      });
      listSheets[worksheet.name] = values;
      continue;
    }

    if (worksheet.state === 'hidden' || worksheet.state === 'veryHidden') continue;

    // Sheet name variables
    const sheetNameVars = extractVarExpressions(worksheet.name);
    for (const expr of sheetNameVars) {
      allVars.push({ expression: expr, columns: [], location: `sheet:${worksheet.name}` });
    }

    const sheetGroupKeys = extractGroupKeys(worksheet.name);

    const blocks: DataBlock[] = [];
    const allDirectives: Directive[] = [];
    const allDirectiveRows: number[] = [];
    let currentBlock: DataBlock | null = null;
    let pendingDirectives: Directive[] = [];
    let pendingDirectiveRows: number[] = [];

    // Legacy fields (for backward compat — populated from blocks at the end)
    let legacyDataStartRow = 0;
    let legacyDataEndRow = 0;
    const staticRows = new Set<number>();

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // 1. Check for directive rows
      let parsedDirective: Directive | null = null;
      let isDirectiveRow = false;
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (isDirectiveRow) return;
        const cellValue = cellString(cell.value);
        const cellVars = extractVarExpressions(cellValue);
        for (const expr of cellVars) {
          if (isDirectiveExpression(expr)) {
            const d = parseDirective(expr);
            if (d) {
              parsedDirective = d;
              isDirectiveRow = true;
              return;
            }
          }
        }
      });

      if (isDirectiveRow && parsedDirective) {
        const directive = parsedDirective as Directive;
        allDirectives.push(directive);
        allDirectiveRows.push(rowNumber);

        if (directive.kind === 'repeat') {
          // Close previous block
          if (currentBlock) { blocks.push(currentBlock); currentBlock = null; }
          // Start new horizontal block
          currentBlock = {
            direction: 'right',
            startRow: 0,
            endRow: 0,
            templateColStart: 0,
            templateColEnd: 0,
            directives: [...pendingDirectives, directive],
            directiveRows: [...pendingDirectiveRows, rowNumber],
          };
          pendingDirectives = [];
          pendingDirectiveRows = [];
        } else {
          // Attach to current block or pending
          if (currentBlock) {
            currentBlock.directives.push(directive);
            currentBlock.directiveRows.push(rowNumber);
          } else {
            pendingDirectives.push(directive);
            pendingDirectiveRows.push(rowNumber);
          }
        }
        return;
      }

      // 2. Check for [field] expressions
      let hasDataVar = false;
      const dataColNumbers: number[] = [];

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const cellValue = cellString(cell.value);
        const cellVars = extractVarExpressions(cellValue);
        for (const expr of cellVars) {
          const colLetter = columnToLetter(colNumber);
          allVars.push({
            expression: expr,
            columns: [],
            location: `cell:${worksheet.name}!${colLetter}${rowNumber}`,
          });

          if (isDataExpression(expr) && !isAggregateExpression(expr)) {
            hasDataVar = true;
            dataColNumbers.push(colNumber);
          }
        }
      });

      if (hasDataVar) {
        // Detect row gap: if current block exists and there's a gap, close it
        if (currentBlock && currentBlock.endRow > 0 && rowNumber > currentBlock.endRow + 1) {
          blocks.push(currentBlock);
          currentBlock = null;
        }

        // If no current block, start a 'down' block with any pending directives
        if (!currentBlock) {
          currentBlock = {
            direction: 'down',
            startRow: 0,
            endRow: 0,
            templateColStart: 0,
            templateColEnd: 0,
            directives: [...pendingDirectives],
            directiveRows: [...pendingDirectiveRows],
          };
          pendingDirectives = [];
          pendingDirectiveRows = [];
        }

        if (currentBlock.startRow === 0) currentBlock.startRow = rowNumber;
        currentBlock.endRow = rowNumber;

        // Track template column range for horizontal blocks
        if (currentBlock.direction === 'right' && dataColNumbers.length > 0) {
          const minCol = Math.min(...dataColNumbers);
          const maxCol = Math.max(...dataColNumbers);
          if (currentBlock.templateColStart === 0 || minCol < currentBlock.templateColStart) {
            currentBlock.templateColStart = minCol;
          }
          if (maxCol > currentBlock.templateColEnd) {
            currentBlock.templateColEnd = maxCol;
          }
        }

        // Legacy fields
        if (legacyDataStartRow === 0) legacyDataStartRow = rowNumber;
        legacyDataEndRow = rowNumber;
      } else {
        // Non-data row: close current block
        if (currentBlock) { blocks.push(currentBlock); currentBlock = null; }
        staticRows.add(rowNumber);
      }
    });

    // Close final block
    if (currentBlock) { blocks.push(currentBlock); currentBlock = null; }

    // Attach any remaining pending directives to legacy fields
    if (pendingDirectives.length > 0 && blocks.length === 0) {
      allDirectives.push(...pendingDirectives);
      allDirectiveRows.push(...pendingDirectiveRows);
    }

    const st: SheetTemplate = {
      originalName: worksheet.name,
      groupKeys: sheetGroupKeys,
      dataStartRow: legacyDataStartRow,
      dataEndRow: legacyDataEndRow,
      staticRows,
      directives: allDirectives,
      directiveRows: allDirectiveRows,
      blocks,
    };

    sheetTemplates.push(st);
  }

  // File-level variables
  for (const expr of extractVarExpressions(meta.output_file_pattern)) {
    allVars.push({ expression: expr, columns: [], location: 'filename' });
  }

  // Validate list references in directives
  for (const st of sheetTemplates) {
    for (const d of st.directives) {
      if (d.kind === 'filter' && d.listRef && !listSheets[d.listRef]) {
        throw new Error(
          `Sheet "${st.originalName}" references missing list sheet "${d.listRef}" in a filter.`,
        );
      }
    }
  }

  return {
    meta,
    variables: deduplicateVars(allVars),
    fileGroupKeys,
    sheetTemplates,
    listSheets,
    configVars,
    workbook,
    warnings: [],
  };
}

export interface ConfigResult {
  meta: TemplateMeta;
  configVars: Record<string, string>;
}

export function readConfigSheet(workbook: ExcelJS.Workbook): ConfigResult {
  const meta: TemplateMeta = {
    name: '', description: '', source_sheet: '',
    output_file_pattern: '', match_pattern: '',
  };
  const configVars: Record<string, string> = {};

  const sheet = workbook.getWorksheet(CONFIG_SHEET);
  if (!sheet) return { meta, configVars };

  sheet.eachRow((row) => {
    const key = String(row.getCell(1).value ?? '').trim();
    const val = String(row.getCell(2).value ?? '').trim();
    if (key.startsWith('_')) {
      configVars[key] = val;
    } else {
      switch (key) {
        case 'name': meta.name = val; break;
        case 'description': meta.description = val; break;
        case 'source_sheet': meta.source_sheet = val; break;
        case 'source_table': meta.source_table = val; break;
        case 'output_file_pattern': meta.output_file_pattern = val; break;
        case 'match_pattern': meta.match_pattern = val; break;
        default:
          if (REMOVED_SOURCE_CONFIG_KEYS.has(key)) {
            throw new Error(`Config key "${key}" was removed. Use "source_table" instead.`);
          }
      }
    }
  });

  return { meta, configVars };
}

export function writeConfigSheet(workbook: ExcelJS.Workbook, meta: TemplateMeta) {
  // Remove existing
  const existing = workbook.getWorksheet(CONFIG_SHEET);
  if (existing) workbook.removeWorksheet(existing.id);

  const sheet = workbook.addWorksheet(CONFIG_SHEET, { state: 'hidden' });
  const entries: [string, string][] = [
    ['name', meta.name],
    ['description', meta.description],
    ['source_sheet', meta.source_sheet],
    ['source_table', meta.source_table ?? ''],
    ['output_file_pattern', meta.output_file_pattern],
    ['match_pattern', meta.match_pattern],
  ];
  entries.forEach(([k, v], i) => {
    sheet.getCell(i + 1, 1).value = k;
    sheet.getCell(i + 1, 2).value = v;
  });
}

export function populateColumnRefs(parsed: TemplateModel, columns: Set<string>) {
  for (const v of parsed.variables) {
    v.columns = extractColumnRefs(v.expression, columns);
  }
}

function extractVarExpressions(s: string): string[] {
  const exprs: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_PATTERN.source, 'g');
  while ((m = re.exec(s)) !== null) {
    exprs.push(m[1].trim());
  }
  return exprs;
}

function extractGroupKeys(pattern: string): string[] {
  return extractVarExpressions(pattern)
    .map((expr) => {
      const bracket = expr.match(/^\[([^\]\r\n]+)\]$/);
      return bracket ? bracket[1].trim() : expr;
    })
    .filter(
      (expr) => !expr.startsWith('.') && !expr.startsWith('_') && !/[ |+*/\-><=!&()[\],]/.test(expr),
    );
}

function deduplicateVars(vars: TemplateVariable[]): TemplateVariable[] {
  const seen = new Set<string>();
  return vars.filter((v) => {
    const key = `${v.expression}|${v.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function columnToLetter(col: number): string {
  let s = '';
  while (col > 0) {
    const mod = (col - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
