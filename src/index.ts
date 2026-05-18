import JSZip from 'jszip';
import { parseTemplate, populateColumnRefs } from './parser.js';
import { readAllSources, columnSet } from './reader.js';
import type { SourceData } from './reader.js';
import { groupRows } from './grouper.js';
import { Renderer } from './renderer.js';
import { applyDirectives } from './data-transform.js';
import { toTemplateModel } from './template-model.js';
import { resolveInputs } from './inputs.js';
import type {
  OutputFile,
  PreviewResult,
  ParsedTemplate,
  TemplateModel,
  ConvertOptions,
  InputSpec,
  XtlWarning,
} from './types.js';

export type {
  TemplateMeta,
  TemplateModel,
  ParsedTemplate,
  OutputFile,
  PreviewResult,
  PreviewSource,
  PreviewFile,
  PreviewSheet,
  SheetTemplate,
  TemplateVariable,
  DataBlock,
  Directive,
  FilterDirective,
  FilterOp,
  SortDirective,
  TopDirective,
  RepeatDirective,
  SourceDirective,
  JoinDirective,
  ConvertOptions,
  InputSpec,
  InputType,
  SourceSpec,
  XtlWarning,
  XtlWarningCode,
} from './types.js';
export { readConfigSheet, writeConfigSheet, readInputsSheet } from './parser.js';
export type { ConfigResult } from './parser.js';
export { batchMatch } from './matcher.js';
export type { MatchResult } from './matcher.js';
export { toTemplateModel } from './template-model.js';
export { xtlError, isXtlError } from './error-codes.js';
export type { XtlError, XtlErrorCode } from './error-codes.js';
import { xtlError } from './error-codes.js';

interface PreparedConversion {
  parsed: ParsedTemplate;
  source: SourceData;
  sources: Record<string, SourceData>;
  columns: Set<string>;
  grouped: ReturnType<typeof groupRows>;
  renderer: Renderer;
}

function prepareConversionFromSources(
  parsed: ParsedTemplate,
  sources: Record<string, SourceData>,
): PreparedConversion {
  const defaultSource = sources['default']!;
  const columns = columnSet(defaultSource.headers);
  populateColumnRefs(parsed);

  const grouped = groupRows(defaultSource.rows, parsed.fileGroupKeys, parsed.sheetTemplates);
  const renderer = new Renderer(parsed, columns, sources);

  return { parsed, source: defaultSource, sources, columns, grouped, renderer };
}

/** Shared first stage: parse template + read source + resolve columns + group. */
async function prepareConversion(
  templateBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  options?: ConvertOptions,
) {
  const parsed = await parseTemplate(templateBuffer);
  applyResolvedInputs(parsed, options);
  // ADR-0012: read default + all named sources upfront.
  const sources = await readAllSources(
    sourceBuffer,
    parsed.meta.source_sheet,
    { sourceTable: parsed.meta.source_table },
    parsed.sources,
  );

  return prepareConversionFromSources(parsed, sources);
}

// ADR-0010 / ADR-0011: resolve runtime inputs and stash them on the
// parsed template. The renderer exposes them under the `__inputs__`
// namespace in ctx so cells reference them via `{{ __inputs__[name] }}`.
function applyResolvedInputs(parsed: ParsedTemplate, options?: ConvertOptions): void {
  if (parsed.inputs.length === 0 && !options?.inputs) {
    parsed.resolvedInputs = {};
    return;
  }
  parsed.resolvedInputs = resolveInputs(parsed.inputs, options?.inputs);
}

async function renderPreparedConversion(prepared: PreparedConversion): Promise<OutputFile[]> {
  const files: OutputFile[] = [];
  // ADR-0031: detect filename collisions across file groups before
  // rendering any of them. Two distinct group keys that sanitize to
  // the same filename would otherwise silently overwrite each other
  // in host code (host writes the array to disk or zip, second file
  // clobbers first). Preview-fail-fast catches this at convert-time.
  const seenFilenames = new Set<string>();
  for (const fg of prepared.grouped.fileGroups) {
    const filename = prepared.renderer.previewFilename(fg);
    if (seenFilenames.has(filename)) {
      throw xtlError(
        'xl3/filename/collision',
        `Output filename "${filename}" is produced by multiple file groups (their group key values collapse to the same sanitized filename). Make group keys distinct upstream — different cell values that share only forbidden characters (e.g., "Seoul/Korea" and "Seoul:Korea") both sanitize to "Seoul_Korea".`,
      );
    }
    seenFilenames.add(filename);
  }
  for (const fg of prepared.grouped.fileGroups) {
    const outFile = await prepared.renderer.renderFile(fg);
    files.push(outFile);
  }

  return files;
}

function buildPreviewWarnings(parsed: TemplateModel, columns: Set<string>): XtlWarning[] {
  const warnings: XtlWarning[] = [...parsed.warnings];
  for (const v of parsed.variables) {
    for (const col of v.columns) {
      if (!columns.has(col)) {
        warnings.push({
          code: 'xl3w/parser/missing-column',
          message: `Source column "${col}" is missing`,
          location: v.location,
        });
      }
    }
  }
  return warnings;
}

function buildPreviewFromPrepared(prepared: PreparedConversion): PreviewResult {
  const { parsed, sources, columns, grouped, renderer } = prepared;
  const warnings = buildPreviewWarnings(parsed, columns);
  const inputs = parsed.inputs;

  // ADR-0012/0014 surface: every source the engine has loaded — the
  // implicit `default` plus any declared in `__sources__` — with its
  // row count and headers. Hosts use this to show operators what data
  // is available.
  const previewSources = Object.entries(sources).map(([name, data]) => {
    if (name === 'default') {
      return {
        name,
        sheet: parsed.meta.source_sheet || data.sheetName,
        table: parsed.meta.source_table ?? '1',
        rowCount: data.rows.length,
        headers: data.headers,
      };
    }
    const spec = parsed.sources.find((s) => s.name === name);
    return {
      name,
      sheet: spec?.sheet ?? data.sheetName,
      table: spec?.table ?? '1',
      description: spec?.description,
      rowCount: data.rows.length,
      headers: data.headers,
    };
  });

  const files = grouped.fileGroups.map((fg) => {
    const sheets: { name: string; rowCount: number }[] = [];

    for (const st of parsed.sheetTemplates) {
      if (st.groupKeys.length === 0) {
        const sg = fg.sheetGroups.find((g) => Object.keys(g.key.values).length === 0);
        if (!sg) continue;
        const dataDirectives = st.directives.filter((d) => d.kind !== 'repeat');
        const filteredRows = dataDirectives.length
          ? applyDirectives(sg.rows, dataDirectives, parsed.listSheets)
          : sg.rows;
        sheets.push({ name: st.originalName, rowCount: filteredRows.length });
      } else {
        const matchingGroups = fg.sheetGroups.filter((g) => {
          if (Object.keys(g.key.values).length === 0) return false;
          return st.groupKeys.every((k) => k in g.key.values);
        });
        for (const sg of matchingGroups) {
          const sheetName = renderer.previewSheetName([st], sg.key);
          const dataDirectives = st.directives.filter((d) => d.kind !== 'repeat');
          const filteredRows = dataDirectives.length
            ? applyDirectives(sg.rows, dataDirectives, parsed.listSheets)
            : sg.rows;
          sheets.push({ name: sheetName, rowCount: filteredRows.length });
        }
      }
    }

    warnings.push(...renderer.previewFilenameWarnings(fg));
    return { filename: renderer.previewFilename(fg), sheets };
  });

  return { files, inputs, sources: previewSources, warnings };
}

/**
 * Run full conversion: template + source → output files.
 *
 * Reads the XTL template workbook, applies its directives over the
 * source workbook, and returns one OutputFile per emitted file group.
 *
 * @stable Frozen at 1.0 per `spec/STABILITY.md` "Public API surface".
 *   Signature changes are 2.0-only.
 *
 * @example
 * ```ts
 * const outputs = await convert(templateBuffer, sourceBuffer, {
 *   inputs: { month: '2026-05' },
 * });
 * ```
 */
export async function convert(
  templateBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  options?: ConvertOptions,
): Promise<OutputFile[]> {
  const prepared = await prepareConversion(templateBuffer, sourceBuffer, options);
  return renderPreparedConversion(prepared);
}

/**
 * Preview what conversion will produce without generating full files.
 *
 * Returns the planned filenames, sheet names, row counts, declared
 * inputs, and warnings the host should surface to the operator.
 * Cheaper than `convert()` because it does not serialize output
 * workbooks.
 *
 * @stable Frozen at 1.0.
 *
 * @example
 * ```ts
 * const result = await preview(templateBuffer, sourceBuffer, {
 *   inputs: { month: '2026-05' },
 * });
 * console.log(result.files, result.warnings);
 * ```
 */
export async function preview(
  templateBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  options?: ConvertOptions,
): Promise<PreviewResult> {
  const prepared = await prepareConversion(templateBuffer, sourceBuffer, options);
  return buildPreviewFromPrepared(prepared);
}

/**
 * Inspect a template's runtime input declarations without running a
 * conversion. Hosts use this to render an input form before the host
 * has a source workbook to convert.
 *
 * @stable Frozen at 1.0.
 *
 * @example
 * ```ts
 * const inputs = await readTemplateInputs(templateBuffer);
 * for (const input of inputs) {
 *   console.log(input.name, input.type, input.required);
 * }
 * ```
 */
export async function readTemplateInputs(
  templateBuffer: ArrayBuffer,
): Promise<InputSpec[]> {
  const parsed = await parseTemplate(templateBuffer);
  return parsed.inputs;
}

/**
 * Analyze a template file and return its full parsed model
 * (including the underlying ExcelJS workbook). Useful for tooling
 * that needs to inspect template internals.
 *
 * @stable The entry point itself is frozen at 1.0 (per
 *   `spec/STABILITY.md` "Public API surface"). The **return type**
 *   `ParsedTemplate` is `@experimental`: it exposes internal model
 *   shapes (`Directive`, `DataBlock`, `SheetTemplate`) and the live
 *   `ExcelJS.Workbook`, which MAY change between minor versions.
 *   For a stable serializable view, prefer
 *   {@link analyzeModel} (which returns `TemplateModel`).
 *
 * @example
 * ```ts
 * const parsed = await analyze(templateBuffer);
 * console.log(parsed.meta.name, parsed.sheetTemplates.length);
 * ```
 */
export async function analyze(
  templateBuffer: ArrayBuffer,
): Promise<ParsedTemplate> {
  return parseTemplate(templateBuffer);
}

/**
 * Analyze a template file and return a serializable, workbook-free
 * template model. Suitable for cross-process / cross-language
 * inspection.
 *
 * @stable Frozen at 1.0.
 *
 * @example
 * ```ts
 * const model = await analyzeModel(templateBuffer);
 * const json = JSON.stringify(model, null, 2);
 * ```
 */
export async function analyzeModel(
  templateBuffer: ArrayBuffer,
): Promise<TemplateModel> {
  const parsed = await parseTemplate(templateBuffer);
  return toTemplateModel(parsed);
}

/**
 * Package multiple output files into a single ZIP Blob. Convenience
 * wrapper for hosts that want to download an entire batch in one
 * request.
 *
 * @stable Frozen at 1.0.
 *
 * @example
 * ```ts
 * const outputs = await convert(templateBuffer, sourceBuffer);
 * const zip = await packageZip(outputs);
 * // hand `zip` to the browser as a download
 * ```
 */
export async function packageZip(files: OutputFile[]): Promise<Blob> {
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.filename, f.data);
  }
  return zip.generateAsync({ type: 'blob' });
}
