# ADR 0002 — Output filename sanitization rules

- **Status:** accepted
- **Date:** 2026-05-03
- **Spec target:** XTL 0.2
- **Affects:** evaluation.md (new section)

## Context

XTL 0.1 lets templates produce arbitrary filenames via `output_file_pattern`. The error list in `evaluation.md` mentions "Producing an invalid output filename after sanitization rules are applied," but the sanitization rules themselves are unspecified. Without rules:

- Two implementations on different operating systems can disagree on which filenames are valid.
- A template that works on macOS may produce unwritable files on Windows because of forbidden characters or reserved names.
- Trailing whitespace/dots, ASCII control characters, and length overflow are all silent failure modes.

xl3 outputs files for redistribution (often `.zip`-bundled, often opened by Windows users). The strictest realistic platform is Windows/NTFS; defining rules around that platform makes outputs portable everywhere.

## Considered Options

**A. Implementation-defined.** Status quo. Each impl picks its own. Cost: portability hazard, defeats the spec's purpose.

**B. POSIX-only baseline.** Forbid only `/` and NUL. Cost: outputs are unwritable on Windows for common patterns containing `:` or `?`.

**C. Windows/NTFS baseline (chosen).** Forbid `< > : " / \ | ? *` plus ASCII control chars (0x00-0x1F), trim whitespace and trailing dots, reject Windows reserved device names. Permissive enough for non-ASCII/Unicode names, strict enough to be portable.

**D. ASCII-only baseline.** Strip everything outside `[A-Za-z0-9._-]`. Cost: too aggressive — Korean, Japanese, Chinese, accented filenames are common and legal on every modern filesystem.

## Decision

Implementations MUST sanitize each output filename produced by `output_file_pattern` evaluation, in this order:

1. **Replace forbidden characters** with `_`:
   - The set `< > : " / \ | ? *`
   - ASCII control characters in the range `0x00`-`0x1F`
2. **Trim** leading and trailing whitespace and trailing `.` characters.
3. **Reserved name guard:** if the resulting basename (before the `.xlsx` extension), case-insensitive, equals one of `CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`, append a single `_` to the basename.
4. **Empty result is an error.** If steps 1-3 yield an empty filename or empty basename, the implementation MUST report an error.
5. **Length cap:** if the UTF-8 byte length of the filename exceeds 255, the implementation MUST report an error (do not silently truncate — silent truncation can produce duplicate filenames).
6. **Warning:** if any of steps 1, 2, or 3 changed the rendered string, the implementation SHOULD emit a warning that includes the original and the sanitized filename. Warnings MUST NOT change output semantics.

The rules apply to filenames only, not to sheet names. Sheet names retain the existing rules in `sanitizeSheetName` (Excel's own forbidden set) and have separate length limits (31 chars per Excel).

A new section `Output Filenames` is added to `evaluation.md`, between `Cell Evaluation` and `Styles and Workbook Structure`, codifying the rules above.

## Consequences

- The reference implementation gains a `sanitizeFilename` helper applied in `renderer.ts` after `renderFilename` produces the raw string.
- `evaluation.md` gains a new section. The existing error-list bullet "Producing an invalid output filename after sanitization rules are applied" is preserved and now references the new section.
- New fixtures cover: forbidden char replacement, trailing-dot trim, reserved-name suffix, empty-after-sanitization error, and a length-overflow error. The error fixtures presume a future "expected_error" assertion in the runner protocol; until that lands, the empty-result and length-cap rules are exercised only by reference-impl unit tests.
- Unicode names (CJK, emoji, etc.) are intentionally **not** restricted. Filesystems and shells handle UTF-8 widely; restricting them would surprise non-English users.
- The `_config.output_file_pattern` itself is not validated up-front — sanitization happens after rendering, when group-key values are substituted in. A template authored to be safe may still produce a forbidden-char filename if a source value contains one, hence the warning.

## References

- Microsoft naming conventions: <https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file>
- Existing `sanitizeSheetName` in `src/excel-document.ts` (sheet-name analogue, different ruleset).
