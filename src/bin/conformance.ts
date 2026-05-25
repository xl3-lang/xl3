#!/usr/bin/env node
// CLI entry point for the conformance runner.
// Surface follows runner-protocol.md "Runner CLI conventions".

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runConformance, formatTextReport, canonicalizeXlsx, type ComparisonStage } from '../conformance-runner.js';

type Cli = RunCli | CanonicalizeCli;

interface RunCli {
  command: 'run';
  fixtureDir: string;
  filter?: string;
  specVersion?: string;
  comparisonStage: ComparisonStage;
  report: 'json' | 'text';
  engine: 'auto' | 'wasm' | 'js';
}

interface CanonicalizeCli {
  command: 'canonicalize';
  input: string;
  part?: string;
}

function parseArgs(argv: string[]): Cli {
  if (argv[2] === 'canonicalize') return parseCanonicalizeArgs(argv.slice(3));

  const cli: RunCli = {
    command: 'run',
    fixtureDir: 'conformance/fixtures',
    comparisonStage: 1,
    report: 'text',
    engine: 'auto',
  };
  for (const arg of argv.slice(2)) {
    const eq = arg.indexOf('=');
    if (eq < 0) {
      die(`unrecognized argument: ${arg}`);
    }
    const key = arg.slice(0, eq);
    const value = arg.slice(eq + 1);
    switch (key) {
      case '--fixture-dir': cli.fixtureDir = value; break;
      case '--filter': cli.filter = value; break;
      case '--spec-version': cli.specVersion = value; break;
      case '--comparison-stage':
        if (value !== '1' && value !== '2') die(`--comparison-stage must be 1 or 2`);
        cli.comparisonStage = Number(value) as ComparisonStage;
        break;
      case '--report':
        if (value !== 'json' && value !== 'text') die(`--report must be json or text`);
        cli.report = value;
        break;
      case '--engine':
        if (value !== 'auto' && value !== 'wasm' && value !== 'js') {
          die(`--engine must be auto, wasm, or js`);
        }
        cli.engine = value;
        break;
      default: die(`unknown flag: ${key}`);
    }
  }
  return cli;
}

function parseCanonicalizeArgs(args: string[]): CanonicalizeCli {
  const cli: Partial<CanonicalizeCli> = { command: 'canonicalize' };
  for (const arg of args) {
    if (arg.startsWith('--part=')) {
      cli.part = arg.slice('--part='.length);
      continue;
    }
    if (arg.startsWith('--')) die(`unknown canonicalize flag: ${arg}`);
    if (cli.input) die(`canonicalize accepts one input file`);
    cli.input = arg;
  }
  if (!cli.input) die(`canonicalize requires an input .xlsx file`);
  return cli as CanonicalizeCli;
}

function die(msg: string): never {
  console.error(`xl3-conformance: ${msg}`);
  console.error('usage: xl3-conformance [--fixture-dir=<path>] [--filter=<tag>] [--spec-version=<x.y>] [--comparison-stage=1|2] [--report=json|text] [--engine=auto|wasm|js]');
  console.error('       xl3-conformance canonicalize <input.xlsx> [--part=<canonical-part-name>]');
  process.exit(2);
}

const cli = parseArgs(process.argv);
if (cli.command === 'canonicalize') {
  const buf = await readFile(resolve(cli.input));
  const canonical = await canonicalizeXlsx(toArrayBuffer(buf));
  if (cli.part) {
    const content = canonical.get(cli.part);
    if (content === undefined) die(`canonical part not found: ${cli.part}`);
    process.stdout.write(content + '\n');
  } else {
    const entries = [...canonical].sort(([a], [b]) => a.localeCompare(b));
    process.stdout.write(JSON.stringify(Object.fromEntries(entries), null, 2) + '\n');
  }
  process.exit(0);
}

const report = await runConformance({
  fixtureDir: resolve(cli.fixtureDir),
  filter: cli.filter,
  specVersion: cli.specVersion,
  comparisonStage: cli.comparisonStage,
  engine: cli.engine,
});

if (cli.report === 'json') {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  process.stdout.write(formatTextReport(report) + '\n');
}

process.exit(report.summary.failed + report.summary.errored > 0 ? 1 : 0);

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}
