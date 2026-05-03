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
