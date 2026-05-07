// ADR-0015: stable error codes for xl3-thrown errors. Hosts use these
// for localization and programmatic dispatch. The English `Error.message`
// remains the conformance-corpus contract.

export type XtlErrorCode =
  // Config
  | 'xl3/config/source-table-removed'
  | 'xl3/config/invalid-source-table'
  // Inputs (ADR-0010)
  | 'xl3/inputs/missing-required'
  | 'xl3/inputs/parse-number'
  | 'xl3/inputs/parse-date'
  | 'xl3/inputs/select-option'
  | 'xl3/inputs/duplicate-name'
  | 'xl3/inputs/invalid-name'
  | 'xl3/inputs/invalid-type'
  | 'xl3/inputs/conflict-config'
  | 'xl3/inputs/missing-header'
  | 'xl3/inputs/missing-options'
  // Sources (ADR-0012)
  | 'xl3/source/undeclared'
  | 'xl3/source/sheet-missing'
  | 'xl3/source/duplicate-name'
  | 'xl3/source/invalid-name'
  | 'xl3/source/missing-header'
  | 'xl3/source/missing-required'
  | 'xl3/source/row-cross-block'
  // Reserved sheets (ADR-0011)
  | 'xl3/sheet/reserved-name'
  | 'xl3/sheet/duplicate-list-name'
  // Join (ADR-0014)
  | 'xl3/join/undeclared-source'
  | 'xl3/join/bad-on-clause'
  // Lists
  | 'xl3/lists/missing-reference'
  // Cell evaluation
  | 'xl3/cell/numfmt-coercion'
  | 'xl3/cell/row-outside-repeat'
  | 'xl3/cell/formula-no-cache'
  // XLOOKUP (ADR-0013)
  | 'xl3/xlookup/no-match'
  | 'xl3/xlookup/source-mismatch'
  | 'xl3/xlookup/bare-bracket'
  // Filename sanitization (ADR-0002)
  | 'xl3/filename/empty'
  | 'xl3/filename/too-long';

export interface XtlError extends Error {
  code: XtlErrorCode;
}

export function xtlError(code: XtlErrorCode, message: string): XtlError {
  const err = new Error(message) as XtlError;
  err.code = code;
  return err;
}

export function isXtlError(e: unknown): e is XtlError {
  return e instanceof Error && typeof (e as XtlError).code === 'string'
    && (e as XtlError).code.startsWith('xl3/');
}
