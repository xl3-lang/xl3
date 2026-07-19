// Tiny semver-ish helpers for XTL spec_version comparison.
//
// We only handle the "MAJOR.MINOR" and "MAJOR.MINOR.PATCH" shapes that
// xl3 actually uses on fixture metadata and CLI flags. No prerelease
// tags, no build metadata, no range operators. If the project ever
// needs ranges (>=, ^, ~) the right move is to depend on `semver`;
// this module intentionally stays under 30 lines.

export type Version = [number, number, number];

export function parseVersion(s: string): Version | null {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(s.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
}

export function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// Parses both sides and returns true if they represent the same
// MAJOR.MINOR.PATCH triple. Treats "0.1" and "0.1.0" as equal.
// Falls back to strict string equality if either side fails to parse,
// so malformed user input still produces a deterministic answer
// rather than a silent mismatch.
export function versionsEqual(a: string, b: string): boolean {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return a === b;
  return compareVersions(pa, pb) === 0;
}
