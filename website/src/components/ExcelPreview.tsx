import React from 'react';
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

export type Workbook = {
  kind: string;          // "data.xlsx" / "__config__" / etc. — small label above the title
  title: string;         // headline shown to the right of the kicker
  note?: string;         // body sentence below the workbook
  workbookTitle: string; // file name (e.g., template.xlsx)
  workbookSubtitle: string;
  formula: string;       // formula bar content
  sheetName: string;     // tab label
  rows: string[][];
  classes?: CellClass[][];
  merges?: Merge[];
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
  const maxCols = Math.max(...workbook.rows.map((r) => r.length));
  const merges = workbook.merges ?? [];
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
      <div className={styles.formulaBar}>
        <span className={styles.nameBox}>B2</span>
        <span className={styles.fx}>fx</span>
        <span className={styles.formulaText}>{workbook.formula}</span>
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
            {workbook.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th>{rowIndex + 1}</th>
                {Array.from({ length: maxCols }, (_, colIndex) => {
                  if (hiddenByMerge(rowIndex, colIndex)) return null;
                  const merge = mergeAt(rowIndex, colIndex);
                  const className =
                    CELL_CLASS_MAP[workbook.classes?.[rowIndex]?.[colIndex] as CellClass] ?? '';
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
        <span className={styles.sheetTab}>{workbook.sheetName}</span>
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
