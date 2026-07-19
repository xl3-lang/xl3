import { defineConfig } from 'tsup';

// Browser bundle: produces an IIFE-format `dist/xl3.bundle.iife.min.js`
// (and unminified `.iife.js`) that exposes `window.xl3` for direct
// <script src="..."> consumption. ExcelJS + JSZip are inlined.
//
// This config is separate from `tsc -p tsconfig.build.json` (the npm
// ESM entry, dist/index.js). Run with `npm run build:bundle`.

export default defineConfig({
  entry: { 'xl3.bundle': 'src/index.ts' },
  format: ['iife'],
  globalName: 'xl3',
  platform: 'browser',
  target: 'es2020',
  // ExcelJS publishes a browser-friendly entry; tsup picks it up via
  // the `browser` field. JSZip is browser-compatible by default.
  noExternal: ['exceljs', 'jszip'],
  outDir: 'dist',
  clean: false, // don't wipe the ESM build that `tsc` produces
  sourcemap: true,
  splitting: false,
  treeshake: true,
  outExtension({ format }) {
    const suffix = process.env.MINIFY === '1' ? '.iife.min.js' : '.iife.js';
    if (format === 'iife') return { js: suffix };
    return { js: '.js' };
  },
  // Two builds: unminified for debugging, minified for prod.
  // tsup emits one config per pass; we run it twice via the npm script.
  minify: process.env.MINIFY === '1',
  banner: {
    js: '/*! @xl3-lang/xl3 IIFE bundle — MIT — https://xl3.io */',
  },
});
