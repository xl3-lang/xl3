import ExcelJS from 'exceljs';

export interface WorkbookDocument {
  removeAuxiliarySheets(): void;
  getWorksheet(name: string): ExcelJS.Worksheet | undefined;
  hasWorksheet(name: string): boolean;
  removeWorksheet(name: string): void;
  cloneWorksheet(sourceName: string, targetName: string): ExcelJS.Worksheet | undefined;
  writeBuffer(): Promise<ArrayBuffer>;
}

export class ExcelJsWorkbookDocument implements WorkbookDocument {
  private workbook: ExcelJS.Workbook;

  private constructor(workbook: ExcelJS.Workbook) {
    this.workbook = workbook;
  }

  static async fromTemplate(templateWorkbook: ExcelJS.Workbook): Promise<ExcelJsWorkbookDocument> {
    const buf = await templateWorkbook.xlsx.writeBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);
    return new ExcelJsWorkbookDocument(workbook);
  }

  removeAuxiliarySheets() {
    for (const ws of [...this.workbook.worksheets]) {
      if (ws.name.startsWith('_')) {
        this.workbook.removeWorksheet(ws.id);
      }
    }
  }

  getWorksheet(name: string) {
    return this.workbook.getWorksheet(name);
  }

  hasWorksheet(name: string) {
    return Boolean(this.workbook.getWorksheet(name));
  }

  removeWorksheet(name: string) {
    const sheet = this.workbook.getWorksheet(name);
    if (sheet) this.workbook.removeWorksheet(sheet.id);
  }

  cloneWorksheet(sourceName: string, targetName: string) {
    const srcSheet = this.workbook.getWorksheet(sourceName);
    if (!srcSheet) return undefined;

    // Forward sheet-level properties (defaultRowHeight, defaultColWidth, …)
    // and views so empty rows render at the same default height as the
    // template instead of Excel's hardcoded 15.
    const newSheet = this.workbook.addWorksheet(targetName, {
      properties: srcSheet.properties ? { ...srcSheet.properties } : undefined,
      pageSetup: srcSheet.pageSetup ? { ...srcSheet.pageSetup } : undefined,
      views: srcSheet.views ? srcSheet.views.map((v) => ({ ...v })) : undefined,
    });
    copyWorksheet(srcSheet, newSheet);
    return newSheet;
  }

  async writeBuffer(): Promise<ArrayBuffer> {
    return await this.workbook.xlsx.writeBuffer() as ArrayBuffer;
  }
}

// ADR-0002: Output filename sanitization.
//
// The rules are spec-normative (see spec/evaluation.md "Output Filenames" and
// spec/decisions/0002-filename-sanitization.md). Steps 1-3 transform the
// filename; steps 4-5 are error conditions.
const FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;
const RESERVED_DEVICE_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

export interface SanitizedFilename {
  filename: string;
  changed: boolean;
}

export function sanitizeFilename(rendered: string): SanitizedFilename {
  // 1. Replace forbidden characters with `_`.
  let s = rendered.replace(FORBIDDEN_FILENAME_CHARS, '_');

  // 2. Trim leading/trailing whitespace and trailing dots.
  s = s.replace(/^\s+/, '').replace(/[\s.]+$/, '');

  // Split into basename + extension. A leading "." with no other dot means
  // the basename is empty (e.g., ".xlsx" — invalid output filename).
  const splitFilename = (input: string): { base: string; ext: string } => {
    const lastDot = input.lastIndexOf('.');
    if (lastDot > 0) return { base: input.slice(0, lastDot), ext: input.slice(lastDot) };
    if (lastDot === 0) return { base: '', ext: input };
    return { base: input, ext: '' };
  };

  // 3. Reserved name guard on the basename.
  const { base, ext } = splitFilename(s);
  if (RESERVED_DEVICE_NAMES.has(base.toUpperCase())) {
    s = base + '_' + ext;
  }

  // 4. Empty filename or empty basename → error.
  const finalParts = splitFilename(s);
  if (s === '' || finalParts.base === '') {
    throw new Error(
      `Output filename "${rendered}" sanitized to an empty string and is invalid.`,
    );
  }

  // 5. Length cap (UTF-8 bytes).
  const byteLen = new TextEncoder().encode(s).length;
  if (byteLen > 255) {
    throw new Error(
      `Output filename "${s}" is ${byteLen} bytes; exceeds the 255-byte limit.`,
    );
  }

  return { filename: s, changed: s !== rendered };
}

export function sanitizeSheetName(name: string): string {
  // Excel forbids ` : \ / ? * [ ] ` in sheet names. Map brackets to parens so
  // labels like "[SNF]SOOP_xxx" render as "(SNF)SOOP_xxx" instead of being
  // mangled into "_SNF_SOOP_xxx".
  let s = name
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/[:\\/?*]/g, '_');
  if ([...s].length > 31) s = [...s].slice(0, 31).join('');
  return s || 'Sheet';
}

function copyWorksheet(src: ExcelJS.Worksheet, dst: ExcelJS.Worksheet) {
  src.columns.forEach((col, i) => {
    if (col.width) {
      const dstCol = dst.getColumn(i + 1);
      dstCol.width = col.width;
    }
  });

  src.eachRow({ includeEmpty: true }, (srcRow, rowNumber) => {
    const dstRow = dst.getRow(rowNumber);
    // Only copy explicit heights — leave undefined rows alone so Excel falls
    // back to the worksheet's defaultRowHeight (which we forwarded above).
    if (srcRow.height !== undefined) dstRow.height = srcRow.height;

    srcRow.eachCell({ includeEmpty: true }, (srcCell, colNumber) => {
      const dstCell = dstRow.getCell(colNumber);
      dstCell.value = srcCell.value;
      if (srcCell.style) dstCell.style = { ...srcCell.style };
    });

    dstRow.commit();
  });

  src.model.merges?.forEach((merge) => {
    dst.mergeCells(merge);
  });

  // Copy images. Both sheets share the same workbook,
  // so we reuse the existing imageId in the workbook's media collection.
  const images = src.getImages?.() ?? [];
  for (const img of images) {
    const imageId = Number(img.imageId);
    if (Number.isNaN(imageId)) continue;
    dst.addImage(imageId, img.range);
  }
}
