import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'xl3',
  description: 'Excel conversion, inside Excel, in Excel syntax.',
  cleanUrls: true,

  // Pages live in the repo root and under docs/, spec/, conformance/.
  // VitePress only renders pages under `srcDir`, so we keep srcDir as
  // the repo root and explicitly include the markdown trees we want to
  // expose. The site config below builds a deliberate sitemap from
  // existing source markdown rather than duplicating content.
  srcDir: '..',
  outDir: '.vitepress/dist',
  // Site is mounted at xl3.io/docs/ — the root xl3.io is the
  // hand-written marketing page + browser playground in `site/`.
  // Locally `npm run docs:dev` serves from /docs/ too, so links
  // resolve identically in dev and prod.
  base: '/docs/',

  // Markdown links point at source-tree paths (LICENSE, src/, ADRs,
  // grammar.ebnf) that aren't part of the rendered site. Don't fail
  // the build on these — they resolve correctly on GitHub.
  ignoreDeadLinks: true,

  // Avoid `/docs/docs/cookbook/` collisions: the site is already
  // mounted at /docs/, so collapse the `docs/` prefix from the
  // source markdown paths.
  rewrites: {
    'docs/cookbook/README.md': 'cookbook/index.md',
    'docs/cookbook/:slug': 'cookbook/:slug',
    'docs/SITE.md': 'site.md',
  },

  // Files we surface in the site. Everything else (build scripts,
  // fixture xlsx, node_modules) is ignored.
  srcExclude: [
    'node_modules/**',
    'dist/**',
    'examples/**/*.xlsx',
    'conformance/fixtures/**/*.xlsx',
    'conformance/reports/*.json',
    'scripts/**',
    'package*.json',
    'tsconfig*.json',
    '.github/**',
    // The files below contain literal `{{ }}` syntax in tables and
    // code spans that VitePress's Vue compiler tries to parse as
    // interpolation. Link to GitHub for these instead — they are
    // long-form historical reference docs, not site navigation.
    'CHANGELOG.md',
    'spec/decisions/**/*.md',
    'docs/announcements/**',
  ],

  markdown: {
    config(md) {
      // XTL templates use `{{ ... }}` syntax extensively in the
      // cookbook, spec, and PORTERS_GUIDE. VitePress's Vue compiler
      // tries to parse those as template interpolation and chokes on
      // anything that isn't a valid JS expression. Replacing the
      // braces with HTML entities at the renderer-output stage skips
      // Vue's parser while still showing literal `{{ }}` to readers.
      const escapeCurlies = (s: string) => s.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;');
      const wrap = (name: string) => {
        const orig = md.renderer.rules[name];
        md.renderer.rules[name] = (tokens, idx, options, env, self) => {
          const out = orig ? orig(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
          return escapeCurlies(out);
        };
      };
      wrap('text');
      wrap('code_inline');
      wrap('fence');
      wrap('code_block');
      wrap('html_block');
      wrap('html_inline');
    },
  },

  themeConfig: {
    nav: [
      { text: 'Spec', link: '/spec/' },
      { text: 'Cookbook', link: '/cookbook/' },
      {
        text: 'Reference',
        items: [
          { text: 'README', link: '/README' },
          { text: 'Porter\'s Guide', link: '/PORTERS_GUIDE' },
          { text: 'Implementations', link: '/IMPLEMENTATIONS' },
          { text: 'Changelog', link: '/CHANGELOG' },
        ],
      },
      {
        text: 'Conformance',
        items: [
          { text: 'Dashboard', link: '/conformance/DASHBOARD' },
          { text: 'Coverage matrix', link: '/conformance/coverage' },
          { text: 'Runner protocol', link: '/conformance/runner-protocol' },
        ],
      },
    ],

    sidebar: {
      '/cookbook/': [
        {
          text: 'Cookbook',
          items: [
            { text: 'Overview', link: '/cookbook/' },
            { text: '01 · Getting started', link: '/cookbook/01-getting-started' },
            { text: '02 · Conditional cells', link: '/cookbook/02-conditional-cells' },
            { text: '03 · Aggregates', link: '/cookbook/03-aggregates' },
            { text: '04 · File per group', link: '/cookbook/04-file-per-group' },
            { text: '05 · Sheet per group', link: '/cookbook/05-sheet-per-group' },
            { text: '06 · Runtime inputs', link: '/cookbook/06-runtime-inputs' },
            { text: '07 · Multi-source + @join', link: '/cookbook/07-multi-source-join' },
            { text: '08 · XLOOKUP', link: '/cookbook/08-xlookup' },
            { text: '09 · Sort and Top-N', link: '/cookbook/09-sort-and-top' },
            { text: '10 · Styling and branding', link: '/cookbook/10-styling-and-branding' },
          ],
        },
      ],
      '/spec/': [
        {
          text: 'Spec',
          items: [
            { text: 'Index', link: '/spec/' },
            { text: 'Language', link: '/spec/language' },
            { text: 'Evaluation', link: '/spec/evaluation' },
            { text: 'Stability', link: '/spec/STABILITY' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jinyoung4478/xl3' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@jinyoung4478/xl3' },
    ],

    footer: {
      message: 'Code MIT · Spec CC-BY-4.0.',
      copyright: 'Microsoft and Excel are trademarks of Microsoft Corporation. xl3 is not affiliated.',
    },

    editLink: {
      pattern: 'https://github.com/jinyoung4478/xl3/edit/main/:path',
      text: 'Edit this page on GitHub',
    },
  },
});
