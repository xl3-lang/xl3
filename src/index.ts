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
} from './types.js';

export type {
  TemplateMeta,
  TemplateModel,
  ParsedTemplate,
  OutputFile,
  PreviewResult,
  ConvertOptions,
  InputSpec,
  InputType,
} from './types.js';
export { readConfigSheet, writeConfigSheet, readInputsSheet } from './parser.js';
export { batchMatch } from './matcher.js';
export { toTemplateModel } from './template-model.js';

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
  populateColumnRefs(parsed, columns);

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
  for (const fg of prepared.grouped.fileGroups) {
    const outFile = await prepared.renderer.renderFile(fg);
    files.push(outFile);
  }

  return files;
}

function buildPreviewWarnings(parsed: TemplateModel, columns: Set<string>): string[] {
  const warnings: string[] = [...parsed.warnings];
  for (const v of parsed.variables) {
    for (const col of v.columns) {
      if (!columns.has(col)) {
        warnings.push(`Source column "${col}" is missing (used at ${v.location})`);
      }
    }
  }
  return warnings;
}

function buildPreviewFromPrepared(prepared: PreparedConversion): PreviewResult {
  const { parsed, columns, grouped, renderer } = prepared;
  const warnings = buildPreviewWarnings(parsed, columns);
  const inputs = parsed.inputs;

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

  return { files, inputs, warnings };
}

/** Run full conversion: template + source → output files. */
export async function convert(
  templateBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  options?: ConvertOptions,
): Promise<OutputFile[]> {
  const prepared = await prepareConversion(templateBuffer, sourceBuffer, options);
  return renderPreparedConversion(prepared);
}

/** Preview what conversion will produce without generating full files. */
export async function preview(
  templateBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  options?: ConvertOptions,
): Promise<PreviewResult> {
  const prepared = await prepareConversion(templateBuffer, sourceBuffer, options);
  return buildPreviewFromPrepared(prepared);
}

/** Inspect a template's runtime input declarations without running a
 *  conversion. Hosts can use this to render an input form. */
export async function readTemplateInputs(
  templateBuffer: ArrayBuffer,
): Promise<InputSpec[]> {
  const parsed = await parseTemplate(templateBuffer);
  return parsed.inputs;
}

/** Analyze a template file and return its parsed metadata. */
export async function analyze(
  templateBuffer: ArrayBuffer,
): Promise<ParsedTemplate> {
  return parseTemplate(templateBuffer);
}

export async function analyzeModel(
  templateBuffer: ArrayBuffer,
): Promise<TemplateModel> {
  const parsed = await parseTemplate(templateBuffer);
  return toTemplateModel(parsed);
}

/** Package multiple output files into a ZIP. */
export async function packageZip(files: OutputFile[]): Promise<Blob> {
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.filename, f.data);
  }
  return zip.generateAsync({ type: 'blob' });
}
