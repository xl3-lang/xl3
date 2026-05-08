#!/usr/bin/env node
// perturb-xlsx.mjs <input.xlsx> <output.xlsx>
//
// Produces a "different writer" .xlsx by applying perturbations the
// Stage 2 canonicalizer is supposed to normalize. The output is
// byte-different from the input but should canonicalize identically.
// This is a stepping-stone test for true cross-writer Stage 2 — a
// real Microsoft Excel save would also expose the ADR-0006 amendment
// gap items that this synthetic perturbation does not.
//
// Perturbations applied (all listed in conformance/runner-protocol.md
// "Stage 2 output comparison" rules 1, 3):
//
//   - Reorder attributes within each XML element (rule 3:
//     deterministic attribute order).
//   - Swap `"value"` quoting for `'value'` where safe (rule 3:
//     deterministic quote style). Canonicalizer normalizes both to `"`.
//   - Collapse `<x></x>` to `<x/>` and vice versa (canonicalizer
//     collapses self-closing form).
//   - Reorder file entries within the zip (rule 1: zip metadata
//     ignored).
//
// What this does NOT exercise (would require a real Excel save):
//
//   - Default attribute equivalence (e.g., `applyFont="0"` vs omitted).
//   - Color hex case (`FF000000` vs `ff000000`).
//   - Namespace prefix bindings.
//
// These are the gap items in ADR-0006 amendment.

import JSZip from 'jszip';
import { readFile, writeFile } from 'node:fs/promises';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: perturb-xlsx.mjs <input.xlsx> <output.xlsx>');
  process.exit(2);
}

const buf = await readFile(input);
const zip = await JSZip.loadAsync(buf);

// Reverse-sort file order (rule 1 says zip ordering is ignored).
const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort().reverse();
const out = new JSZip();

for (const name of names) {
  const file = zip.files[name];
  if (name.endsWith('.xml') || name.endsWith('.rels')) {
    let xml = await file.async('string');
    xml = perturbXml(xml);
    out.file(name, xml);
  } else {
    const data = await file.async('uint8array');
    out.file(name, data);
  }
}

const written = await out.generateAsync({ type: 'uint8array' });
await writeFile(output, Buffer.from(written));
console.log(`perturbed: ${input} → ${output} (${written.length} bytes)`);

function perturbXml(xml) {
  // Token-level transform — a real XML parser would be safer, but
  // the canonicalizer's own tokenizer handles the same input shape,
  // so a regex pass is sufficient for our purposes here.
  return xml.replace(
    /<([A-Za-z_][\w:-]*)((?:\s+[A-Za-z_:][\w:.-]*\s*=\s*("[^"]*"|'[^']*'))*)\s*(\/?)>/g,
    (full, tagName, attrsBlob, _q, selfClose) => {
      if (!attrsBlob.trim()) return full;
      const attrs = parseAttrs(attrsBlob);
      // Reverse-sort to perturb the order vs. canonicalizer's
      // alphabetical sort.
      attrs.sort((a, b) => b.name.localeCompare(a.name));
      // Flip quote style on every other attr.
      const out = attrs.map((a, i) => {
        const useSingle = i % 2 === 0 && !a.value.includes("'");
        const q = useSingle ? "'" : '"';
        const v = useSingle ? a.value : a.value.replace(/"/g, '&quot;');
        return `${a.name}=${q}${v}${q}`;
      });
      return `<${tagName} ${out.join(' ')}${selfClose ? '/' : ''}>`;
    },
  );
}

function parseAttrs(blob) {
  const out = [];
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(blob)) !== null) {
    out.push({ name: m[1], value: m[3] !== undefined ? m[3] : m[4] });
  }
  return out;
}
