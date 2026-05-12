#!/usr/bin/env node
// Build the conformance dashboard: runs the reference impl at Stage 2,
// aggregates results by ADR / category, and writes `conformance/DASHBOARD.md`.
//
// External ports can drop their own JSON report under
// `conformance/reports/<impl>-<version>.json` (same format as the runner
// emits via `--report=json`) and they will be added as additional columns
// in the per-fixture status table.
//
// Run with `node conformance/scripts/dashboard.mjs`.

import { spawn } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const FIXTURES_DIR = join(REPO_ROOT, 'conformance', 'fixtures');
const REPORTS_DIR = join(REPO_ROOT, 'conformance', 'reports');
const OUT_FILE = join(REPO_ROOT, 'conformance', 'DASHBOARD.md');
const RUNNER = join(REPO_ROOT, 'dist', 'bin', 'conformance.js');

async function runReferenceImpl() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [
      RUNNER,
      '--fixture-dir=conformance/fixtures',
      '--comparison-stage=2',
      '--report=json',
    ], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && code !== 1) {
        reject(new Error(`runner exited ${code}`));
        return;
      }
      try { resolve(JSON.parse(out)); }
      catch (e) { reject(new Error(`runner produced non-JSON output: ${e.message}`)); }
    });
  });
}

async function loadFixtureMetas() {
  const entries = await readdir(FIXTURES_DIR, { withFileTypes: true });
  const metas = {};
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const metaPath = join(FIXTURES_DIR, e.name, 'meta.yaml');
    if (!existsSync(metaPath)) continue;
    const raw = await readFile(metaPath, 'utf8');
    metas[e.name] = parseLooseYaml(raw);
  }
  return metas;
}

function parseLooseYaml(src) {
  // Tiny YAML subset: scalar/string lines + bracketed inline arrays.
  // Sufficient for the meta.yaml shape used in conformance fixtures.
  const out = {};
  for (const line of src.split(/\r?\n/)) {
    const m = line.match(/^([a-z_]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    } else {
      value = value.replace(/^['"]|['"]$/g, '');
    }
    out[key] = value;
  }
  return out;
}

function extractAdrIds(meta) {
  const ids = new Set();
  const tags = Array.isArray(meta?.tags) ? meta.tags : [];
  for (const tag of tags) {
    const m = tag.match(/^adr-(\d{4})$/);
    if (m) ids.add(m[1]);
  }
  const ss = typeof meta?.spec_section === 'string' ? meta.spec_section : '';
  for (const m of ss.matchAll(/ADR-(\d{4})/g)) ids.add(m[1]);
  return [...ids].sort();
}

async function loadExternalReports() {
  if (!existsSync(REPORTS_DIR)) return [];
  const files = (await readdir(REPORTS_DIR)).filter((f) => f.endsWith('.json'));
  const reports = [];
  for (const f of files) {
    try {
      const raw = await readFile(join(REPORTS_DIR, f), 'utf8');
      const report = JSON.parse(raw);
      reports.push({ filename: f, ...report });
    } catch (e) {
      console.warn(`skipped ${f}: ${e.message}`);
    }
  }
  return reports;
}

function rowStatus(report, fixture) {
  if (!report) return '—';
  const r = (report.results ?? []).find((x) => x.fixture === fixture);
  if (!r) return '—';
  switch (r.status) {
    case 'pass': return 'pass';
    case 'fail': return 'fail';
    case 'skip': return 'skip';
    case 'error': return 'error';
    default: return r.status;
  }
}

function summaryLine(impl, version, summary) {
  const total = summary.total;
  const passed = summary.passed;
  const pct = total === 0 ? '—' : `${((passed / total) * 100).toFixed(1)}%`;
  return `**${impl}** ${version} — ${passed}/${total} pass (${pct}); ${summary.failed ?? 0} fail, ${summary.errored ?? 0} error, ${summary.skipped ?? 0} skip`;
}

function buildAdrTable(metas, fixtureStatuses) {
  const byAdr = {};
  for (const [fx, meta] of Object.entries(metas)) {
    const ids = extractAdrIds(meta);
    const refIds = ids.length ? ids : ['—'];
    for (const id of refIds) {
      if (!byAdr[id]) byAdr[id] = { total: 0, pass: 0, fail: 0, skip: 0, error: 0, fixtures: [] };
      byAdr[id].total++;
      byAdr[id].fixtures.push(fx);
      const status = fixtureStatuses[fx] ?? '—';
      if (status === 'pass') byAdr[id].pass++;
      else if (status === 'fail') byAdr[id].fail++;
      else if (status === 'skip') byAdr[id].skip++;
      else if (status === 'error') byAdr[id].error++;
    }
  }
  const lines = [];
  lines.push('| ADR | Fixtures | Pass | Fail | Skip | Error |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const id of Object.keys(byAdr).sort()) {
    const a = byAdr[id];
    const label = id === '—' ? '*(no ADR)*' : `ADR-${id}`;
    lines.push(`| ${label} | ${a.total} | ${a.pass} | ${a.fail} | ${a.skip} | ${a.error} |`);
  }
  return lines.join('\n');
}

async function main() {
  if (!existsSync(RUNNER)) {
    console.error(`runner not built: ${RUNNER}`);
    console.error('run `npm run build` first');
    process.exit(2);
  }
  const refReport = await runReferenceImpl();
  const metas = await loadFixtureMetas();
  const externalReports = await loadExternalReports();

  const refStatuses = {};
  for (const r of refReport.results ?? []) refStatuses[r.fixture] = r.status;

  const generatedAt = new Date().toISOString();

  const lines = [];
  lines.push('# Conformance dashboard');
  lines.push('');
  lines.push(`_Generated ${generatedAt} by \`conformance/scripts/dashboard.mjs\`. Do not hand-edit; regenerate with \`node conformance/scripts/dashboard.mjs\`._`);
  lines.push('');
  lines.push('## Reference implementation');
  lines.push('');
  lines.push(summaryLine(refReport.implementation ?? 'xl3-js', refReport.version ?? '?', refReport.summary));
  lines.push('');
  if (externalReports.length) {
    lines.push('## External implementations');
    lines.push('');
    for (const er of externalReports) {
      lines.push('- ' + summaryLine(er.implementation ?? er.filename, er.version ?? '?', er.summary));
    }
    lines.push('');
  } else {
    lines.push('## External implementations');
    lines.push('');
    lines.push('_No external port reports under `conformance/reports/`. Drop a JSON report from any port that implements `--report=json` and re-run this script to add it._');
    lines.push('');
  }

  lines.push('## Breakdown by ADR (reference impl)');
  lines.push('');
  lines.push(buildAdrTable(metas, refStatuses));
  lines.push('');

  if (externalReports.length) {
    lines.push('## Per-fixture status');
    lines.push('');
    const headers = ['Fixture', refReport.implementation ?? 'xl3-js', ...externalReports.map((r) => r.implementation ?? r.filename)];
    lines.push('| ' + headers.join(' | ') + ' |');
    lines.push('|' + headers.map(() => '---').join('|') + '|');
    for (const fx of Object.keys(metas).sort()) {
      const cells = [
        fx,
        rowStatus(refReport, fx),
        ...externalReports.map((r) => rowStatus(r, fx)),
      ];
      lines.push('| ' + cells.join(' | ') + ' |');
    }
    lines.push('');
  }

  lines.push('## How to add a port');
  lines.push('');
  lines.push('1. Make your port emit a JSON report in the format documented in [`conformance/runner-protocol.md`](./runner-protocol.md) "JSON report format".');
  lines.push('2. Save it under `conformance/reports/<impl>-<version>.json`.');
  lines.push('3. Run `node conformance/scripts/dashboard.mjs` from the repo root to regenerate this file.');
  lines.push('');

  await writeFile(OUT_FILE, lines.join('\n') + '\n');
  console.log(`wrote ${OUT_FILE}`);
  console.log(summaryLine(refReport.implementation ?? 'xl3-js', refReport.version ?? '?', refReport.summary));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
