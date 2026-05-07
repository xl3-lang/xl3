import ExcelJS from 'exceljs';
import type {
  TemplateMeta,
  TemplateVariable,
  SheetTemplate,
  ParsedTemplate,
  TemplateModel,
  Directive,
  DataBlock,
  InputSpec,
  InputType,
  SourceSpec,
  JoinDirective,
} from './types.js';
import { isDataExpression, isAggregateExpression, extractColumnRefs } from './normalizer.js';
import { isDirectiveExpression, parseDirective } from './directive-parser.js';

const CONFIG_SHEET = '__config__';
const INPUTS_SHEET = '__inputs__';
const LISTS_SHEET = '__lists__';
const SOURCES_SHEET = '__sources__';
const RESERVED_SHEETS: ReadonlySet<string> = new Set([
  CONFIG_SHEET,
  INPUTS_SHEET,
  LISTS_SHEET,
  SOURCES_SHEET,
]);
const RESERVED_SHEET_RE = /^__[a-z]+__$/;
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
  const inputs = readInputsSheet(workbook);
  const listSheets = readListsSheet(workbook);
  const sources = readSourcesSheet(workbook);

  // ADR-0011: input names MUST NOT collide with __config__ author-defined values.
  for (const input of inputs) {
    if (Object.prototype.hasOwnProperty.call(configVars, input.name)) {
      throw new Error(
        `__inputs__ name "${input.name}" conflicts with the __config__ author-defined value "${input.name}"`,
      );
    }
  }

  // ADR-0011: reject any sheet whose name matches the reserved
  // dunder-wrapped pattern but is not one of the four known reserved
  // sheets. Authors must not invent new __<name>__ sheets.
  for (const worksheet of workbook.worksheets) {
    if (RESERVED_SHEETS.has(worksheet.name)) continue;
    if (RESERVED_SHEET_RE.test(worksheet.name)) {
      throw new Error(
        `Sheet "${worksheet.name}" matches the reserved __<name>__ pattern but is not a known reserved sheet`,
      );
    }
  }

  const allVars: TemplateVariable[] = [];
  const sheetTemplates: SheetTemplate[] = [];

  const fileGroupKeys = extractGroupKeys(meta.output_file_pattern);

  for (const worksheet of workbook.worksheets) {
    if (RESERVED_SHEETS.has(worksheet.name)) continue;

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
          const repeatDirectives = [...pendingDirectives, directive];
          currentBlock = {
            direction: 'right',
            startRow: 0,
            endRow: 0,
            templateColStart: 0,
            templateColEnd: 0,
            directives: repeatDirectives,
            directiveRows: [...pendingDirectiveRows, rowNumber],
            source: extractSourceFromDirectives(repeatDirectives, 'default'),
            join: extractJoinFromDirectives(repeatDirectives),
          };
          pendingDirectives = [];
          pendingDirectiveRows = [];
        } else {
          // Attach to current block or pending
          if (currentBlock) {
            currentBlock.directives.push(directive);
            currentBlock.directiveRows.push(rowNumber);
            if (directive.kind === 'source') currentBlock.source = directive.name;
            if (directive.kind === 'join') currentBlock.join = directive;
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
          const downDirectives = [...pendingDirectives];
          currentBlock = {
            direction: 'down',
            startRow: 0,
            endRow: 0,
            templateColStart: 0,
            templateColEnd: 0,
            directives: downDirectives,
            directiveRows: [...pendingDirectiveRows],
            source: extractSourceFromDirectives(downDirectives, 'default'),
            join: extractJoinFromDirectives(downDirectives),
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

  // ADR-0012: validate every @source directive references a declared source.
  const sourceNames = new Set<string>(['default', ...sources.map((s) => s.name)]);
  for (const st of sheetTemplates) {
    for (const block of st.blocks) {
      if (block.source !== 'default' && !sourceNames.has(block.source)) {
        throw new Error(`Source "${block.source}" is not declared in __sources__`);
      }
      // ADR-0014: validate @join references declared sources and that the
      // primary side of the on-clause matches the block's active source.
      if (block.join) {
        const j = block.join;
        if (!sourceNames.has(j.joinedSource)) {
          throw new Error(`@join source "${j.joinedSource}" must be declared in __sources__`);
        }
        if (j.primarySource !== block.source) {
          throw new Error(
            `@join key columns must reference the joined and primary sources (block source is "${block.source}", on-clause primary is "${j.primarySource}")`,
          );
        }
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
    inputs,
    sources,
    workbook,
    warnings: [],
  };
}

function extractSourceFromDirectives(directives: Directive[], fallback: string): string {
  for (const d of directives) {
    if (d.kind === 'source') return d.name;
  }
  return fallback;
}

function extractJoinFromDirectives(directives: Directive[]): JoinDirective | undefined {
  for (const d of directives) {
    if (d.kind === 'join') return d;
  }
  return undefined;
}

const VALID_INPUT_TYPES: ReadonlySet<InputType> = new Set([
  'text',
  'number',
  'date',
  'select',
]);

const NAME_RE = /^[A-Za-z0-9_]+$/;

// ADR-0010 / ADR-0011: parse the optional `__inputs__` sheet. The
// first row is the header; each subsequent row declares one input.
// Columns are identified by header text, case-insensitive.
export function readInputsSheet(workbook: ExcelJS.Workbook): InputSpec[] {
  const sheet = workbook.getWorksheet(INPUTS_SHEET);
  if (!sheet) return [];

  const header = sheet.getRow(1);
  const headerMap: Record<string, number> = {};
  header.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = String(cell.value ?? '').trim().toLowerCase();
    if (key) headerMap[key] = colNumber;
  });

  const nameCol = headerMap['name'];
  const typeCol = headerMap['type'];
  if (!nameCol || !typeCol) {
    throw new Error('__inputs__ sheet must have at least `name` and `type` columns in row 1');
  }
  const defaultCol = headerMap['default'];
  const labelCol = headerMap['label'];
  const descCol = headerMap['description'];
  const optionsCol = headerMap['options'];

  const inputs: InputSpec[] = [];
  const seen = new Set<string>();

  const totalRows = sheet.rowCount;
  for (let r = 2; r <= totalRows; r++) {
    const row = sheet.getRow(r);
    const name = String(row.getCell(nameCol).value ?? '').trim();
    if (!name) continue; // skip empty rows
    if (!NAME_RE.test(name)) {
      throw new Error(`__inputs__ row ${r} has invalid name "${name}"; use letters, digits, and underscore only`);
    }
    if (seen.has(name)) {
      throw new Error(`__inputs__ has duplicate name "${name}"`);
    }
    seen.add(name);

    const typeRaw = String(row.getCell(typeCol).value ?? '').trim().toLowerCase();
    if (!VALID_INPUT_TYPES.has(typeRaw as InputType)) {
      throw new Error(
        `__inputs__ row ${r} has invalid type "${typeRaw}"; expected one of text, number, date, select`,
      );
    }
    const type = typeRaw as InputType;

    const defaultRaw = defaultCol ? String(row.getCell(defaultCol).value ?? '').trim() : '';
    const label = labelCol ? String(row.getCell(labelCol).value ?? '').trim() : '';
    const description = descCol ? String(row.getCell(descCol).value ?? '').trim() : '';
    const optionsRaw = optionsCol ? String(row.getCell(optionsCol).value ?? '').trim() : '';

    let options: string[] | undefined;
    if (type === 'select') {
      if (!optionsRaw) {
        throw new Error(`__inputs__ row ${r} (name "${name}", type select) requires an options column with pipe-separated values`);
      }
      options = optionsRaw.split('|').map((s) => s.trim()).filter((s) => s.length > 0);
      if (options.length === 0) {
        throw new Error(`__inputs__ row ${r} (name "${name}") has empty options`);
      }
      if (defaultRaw && !options.includes(defaultRaw)) {
        throw new Error(`__inputs__ row ${r} (name "${name}") default "${defaultRaw}" is not in options`);
      }
    }

    inputs.push({
      name,
      type,
      required: defaultRaw === '',
      default: defaultRaw === '' ? undefined : defaultRaw,
      label: label || undefined,
      description: description || undefined,
      options,
    });
  }

  return inputs;
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
    if (!key) return;
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
        // ADR-0011: any non-system key is an author-defined value
        // accessed via {{ __config__[key] }}. The leading-`_` prefix
        // convention is retired.
        configVars[key] = val;
    }
  });

  return { meta, configVars };
}

// ADR-0012: read the __sources__ sheet. Row 1 holds the header; each
// subsequent row declares one external data source.
export function readSourcesSheet(workbook: ExcelJS.Workbook): SourceSpec[] {
  const sheet = workbook.getWorksheet('__sources__');
  if (!sheet) return [];

  const header = sheet.getRow(1);
  const headerMap: Record<string, number> = {};
  header.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = String(cell.value ?? '').trim().toLowerCase();
    if (key) headerMap[key] = colNumber;
  });
  const nameCol = headerMap['name'];
  const sheetCol = headerMap['sheet'];
  if (!nameCol || !sheetCol) {
    throw new Error('__sources__ sheet must have at least `name` and `sheet` columns in row 1');
  }
  const tableCol = headerMap['table'];
  const descCol = headerMap['description'];

  const sources: SourceSpec[] = [];
  const seen = new Set<string>();
  const totalRows = sheet.rowCount;
  for (let r = 2; r <= totalRows; r++) {
    const row = sheet.getRow(r);
    const name = String(row.getCell(nameCol).value ?? '').trim();
    const sheetName = String(row.getCell(sheetCol).value ?? '').trim();
    if (!name && !sheetName) continue; // skip blank rows
    if (!name || !sheetName) {
      throw new Error(`__sources__ row ${r} missing required name/sheet`);
    }
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      throw new Error(`__sources__ row ${r} has invalid name "${name}"; use letters, digits, and underscore only`);
    }
    if (name.startsWith('__') || name === 'default') {
      throw new Error(`__sources__ row ${r} has invalid name "${name}"; reserved`);
    }
    if (seen.has(name)) {
      throw new Error(`__sources__ has duplicate source name "${name}"`);
    }
    seen.add(name);

    const table = tableCol ? String(row.getCell(tableCol).value ?? '').trim() : '';
    const description = descCol ? String(row.getCell(descCol).value ?? '').trim() : '';
    sources.push({
      name,
      sheet: sheetName,
      table: table || '1',
      description: description || undefined,
    });
  }

  return sources;
}

// ADR-0011: read the __lists__ sheet. Row 1 holds list names (one per
// column); each column below is the values of that list. Empty cells
// are skipped per ADR-0007.
export function readListsSheet(workbook: ExcelJS.Workbook): Record<string, string[]> {
  const sheet = workbook.getWorksheet(LISTS_SHEET);
  if (!sheet) return {};

  const lists: Record<string, string[]> = {};
  const header = sheet.getRow(1);
  const colNames: { col: number; name: string }[] = [];
  header.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const name = String(cell.value ?? '').trim();
    if (!name) return;
    if (lists[name] !== undefined) {
      throw new Error(`__lists__ has duplicate list name "${name}"`);
    }
    lists[name] = [];
    colNames.push({ col: colNumber, name });
  });

  const totalRows = sheet.rowCount;
  for (let r = 2; r <= totalRows; r++) {
    const row = sheet.getRow(r);
    for (const { col, name } of colNames) {
      const raw = row.getCell(col).value;
      if (raw === null || raw === undefined) continue;
      const text = String(raw).trim();
      if (text === '') continue;
      lists[name]!.push(text);
    }
  }

  return lists;
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
