import React from 'react';
import clsx from 'clsx';
import styles from './ExcelPreview.module.css';

export type CellClass =
  | ''
  | 'header'
  | 'template'
  | 'currency'
  | 'status'
  | 'merged-note'
  | 'selected'
  | 'selected currency'
  | 'selected template';

export type Merge = { row: number; col: number; span: number };

// A single worksheet inside the preview window.
export type SheetTab = {
  name: string;          // tab label + sheet name
  formula: string;       // formula-bar content for this sheet
  rows: string[][];
  classes?: CellClass[][];
  merges?: Merge[];
};

export type Workbook = {
  kind: string;          // "data.xlsx" / "__config__" / etc. — small label above the title
  title: string;         // headline shown to the right of the kicker
  note?: string;         // body sentence below the workbook
  workbookTitle: string; // file name (e.g., template.xlsx)
  workbookSubtitle: string;
  // Single-sheet form (kept for back-compat). Ignored when `sheets` is set.
  formula?: string;      // formula bar content
  sheetName?: string;    // tab label
  rows?: string[][];
  classes?: CellClass[][];
  merges?: Merge[];
  // Multi-sheet form: renders clickable sheet tabs that swap the grid.
  sheets?: SheetTab[];
};

function columnLabel(index: number): string {
  let value = '';
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }
  return value;
}

const CELL_CLASS_MAP: Partial<Record<CellClass, string>> = {
  header: styles.headerCell,
  template: styles.templateCell,
  currency: styles.currencyCell,
  status: styles.statusCell,
  'merged-note': styles.mergedNote,
  selected: styles.selected,
  'selected currency': `${styles.selected} ${styles.currencyCell}`,
  'selected template': `${styles.selected} ${styles.templateCell}`,
};

export function ExcelPreview({ workbook }: { workbook: Workbook }) {
  const sheets: SheetTab[] = workbook.sheets ?? [
    {
      name: workbook.sheetName ?? 'Sheet1',
      formula: workbook.formula ?? '',
      rows: workbook.rows ?? [],
      classes: workbook.classes,
      merges: workbook.merges,
    },
  ];
  const [activeSheet, setActiveSheet] = React.useState(0);
  const idx = Math.min(activeSheet, sheets.length - 1);
  const sheet = sheets[idx];

  // Always render at least this many columns so every sheet shows a few
  // trailing empty columns — a natural Excel look, and it keeps the column
  // widths (and the row-number column) identical across steps.
  const MIN_COLS = 7;
  const maxCols = Math.max(MIN_COLS, ...sheet.rows.map((r) => r.length));
  const merges = sheet.merges ?? [];
  const mergeAt = (r: number, c: number) =>
    merges.find((m) => m.row === r && m.col === c);
  const hiddenByMerge = (r: number, c: number) =>
    merges.some((m) => m.row === r && c > m.col && c < m.col + m.span);

  return (
    <div className={styles.window}>
      <div className={styles.titlebar}>
        <div className={styles.dots} aria-hidden="true">
          <span /><span /><span />
        </div>
        <div>
          <strong>{workbook.workbookTitle}</strong>
          <small>{workbook.workbookSubtitle}</small>
        </div>
      </div>
      <div className={styles.sheetWrap}>
        <table className={styles.sheetGrid}>
          <thead>
            <tr>
              <th />
              {Array.from({ length: maxCols }, (_, i) => (
                <th key={i}>{columnLabel(i)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th>{rowIndex + 1}</th>
                {Array.from({ length: maxCols }, (_, colIndex) => {
                  if (hiddenByMerge(rowIndex, colIndex)) return null;
                  const merge = mergeAt(rowIndex, colIndex);
                  const className =
                    CELL_CLASS_MAP[sheet.classes?.[rowIndex]?.[colIndex] as CellClass] ?? '';
                  return (
                    <td
                      key={colIndex}
                      className={className}
                      colSpan={merge ? merge.span : undefined}
                    >
                      {row[colIndex] ?? ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.sheetTabs}>
        {sheets.length > 1 ? (
          sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              className={clsx(
                styles.sheetTab,
                styles.sheetTabButton,
                i !== idx && styles.sheetTabInactive,
              )}
              aria-pressed={i === idx}
              onClick={() => setActiveSheet(i)}
            >
              {s.name}
            </button>
          ))
        ) : (
          <span className={styles.sheetTab}>{sheet.name}</span>
        )}
      </div>
    </div>
  );
}

export function ExcelPreviewFrame({
  kind,
  title,
  note,
  children,
}: {
  kind: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className={styles.frame}>
      <figcaption className={styles.caption}>
        <span>{kind}</span>
        <strong>{title}</strong>
      </figcaption>
      {children}
      {note && <p className={styles.notes}>{note}</p>}
    </figure>
  );
}
