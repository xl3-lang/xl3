// Deterministic .xlsx serialization shared by the example and website
// sample builders.
//
// ExcelJS stamps the current clock into two places on every write:
//   1. docProps/core.xml `dcterms:created` / `dcterms:modified` (from
//      wb.created / wb.modified, which default to `new Date()`), and
//   2. each zip entry's mod-time — ExcelJS appends entries to JSZip
//      without a `date`, so JSZip fills in `new Date()` per entry.
//
// Either one makes the output bytes vary between builds even when the
// cell content is identical, dirtying the git tree and colliding with
// RELEASING.md's "no dirty tree at publish" rule. Pin both to a fixed
// timestamp so identical input always yields byte-identical output.
//
// The timestamp honors SOURCE_DATE_EPOCH (seconds since the Unix epoch,
// the reproducible-builds.org convention) when set, else a fixed constant.

import JSZip from 'jszip';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const epochEnv = process.env.SOURCE_DATE_EPOCH;
export const BUILD_DATE =
  epochEnv && Number.isFinite(Number(epochEnv))
    ? new Date(Number(epochEnv) * 1000)
    : new Date('2026-01-01T00:00:00Z');

// Serialize `wb` to a reproducible .xlsx buffer: fixed doc timestamps plus
// fixed per-entry zip dates. Re-packing through JSZip is what pins the zip
// entry mod-times that ExcelJS otherwise leaves at the current clock; the
// unzipped content is byte-identical to ExcelJS's own output.
export async function toDeterministicBuffer(wb) {
  wb.created = BUILD_DATE;
  wb.modified = BUILD_DATE;
  const buf = await wb.xlsx.writeBuffer();
  const zip = await JSZip.loadAsync(buf);
  for (const name of Object.keys(zip.files)) zip.files[name].date = BUILD_DATE;
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function writeDeterministicXlsx(wb, filePath) {
  const out = await toDeterministicBuffer(wb);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, out);
}
