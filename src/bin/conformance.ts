#!/usr/bin/env node
// CLI entry point for the conformance runner.
// Surface follows runner-protocol.md "Runner CLI conventions".

import { resolve } from 'node:path';
import { runConformance, formatTextReport, type ComparisonStage } from '../conformance-runner.js';

interface Cli {
  fixtureDir: string;
  filter?: string;
  specVersion?: string;
  comparisonStage: ComparisonStage;
  report: 'json' | 'text';
}

function parseArgs(argv: string[]): Cli {
  const cli: Cli = {
    fixtureDir: 'conformance/fixtures',
    comparisonStage: 1,
    report: 'text',
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
      default: die(`unknown flag: ${key}`);
    }
  }
  return cli;
}

function die(msg: string): never {
  console.error(`xl3-conformance: ${msg}`);
  console.error('usage: xl3-conformance [--fixture-dir=<path>] [--filter=<tag>] [--spec-version=<x.y>] [--comparison-stage=1|2] [--report=json|text]');
  process.exit(2);
}

const cli = parseArgs(process.argv);
const report = await runConformance({
  fixtureDir: resolve(cli.fixtureDir),
  filter: cli.filter,
  specVersion: cli.specVersion,
  comparisonStage: cli.comparisonStage,
});

if (cli.report === 'json') {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  process.stdout.write(formatTextReport(report) + '\n');
}

process.exit(report.summary.failed + report.summary.errored > 0 ? 1 : 0);
