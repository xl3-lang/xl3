import type { PrismTheme } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// GitHub-dark palette as a prism-react-renderer theme. Passed as both
// `theme` and `darkTheme` so code blocks read identically across site
// modes (matching the hand-built `.code-card` design). Using a custom
// theme — rather than overriding `prismThemes.github` with `!important`
// CSS — means our colors are inlined directly on each token span; no
// specificity battle with prism's emitted styles.
const xl3GithubDark: PrismTheme = {
  plain: { color: '#e6edf3', backgroundColor: '#0d1117' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#8b949e', fontStyle: 'italic' } },
    { types: ['punctuation'], style: { color: '#e6edf3' } },
    // class-name / JSX-tag in green distinguishes type identifiers
    // (`Promise`, `InputSpec`) from function-call identifiers below.
    { types: ['tag', 'class-name'], style: { color: '#7ee787' } },
    { types: ['boolean', 'number', 'constant', 'symbol', 'deleted', 'attr-name', 'property'], style: { color: '#79c0ff' } },
    { types: ['selector', 'string', 'char', 'builtin', 'inserted', 'url', 'attr-value'], style: { color: '#a5d6ff' } },
    { types: ['operator', 'entity', 'keyword', 'atrule', 'important'], style: { color: '#ff7b72' } },
    { types: ['function'], style: { color: '#d2a8ff' } },
    { types: ['regex', 'variable', 'parameter'], style: { color: '#ffa657' } },
    { types: ['bold'], style: { fontWeight: 'bold' } },
    { types: ['italic'], style: { fontStyle: 'italic' } },
  ],
};

const config: Config = {
  title: 'xl3',
  tagline: 'Excel conversion, inside Excel, in Excel syntax.',
  favicon: 'img/xl3-favicon.png',

  url: 'https://xl3.io',
  baseUrl: '/',

  organizationName: 'jinyoung4478',
  projectName: 'xl3',

  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',
  // No trailing slash on any URL — index docs become `/spec`, `/api`,
  // `/conformance` (not `/spec/`). Keeps the navbar/footer URL form
  // consistent with the lowercase-pathname convention.
  trailingSlash: false,
  // Per-file detection: `.md` is parsed as CommonMark (no JSX/MDX),
  // `.mdx` is parsed as MDX. The repo's markdown contains literal
  // `<title>`, `</type>` etc. fragments from ADR text that MDX would
  // try to parse as JSX. CommonMark mode treats them as text.
  markdown: {
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  // Docusaurus i18n. Adding a new language is a config-only operation:
  //   1. Append the locale to `locales` and add a `localeConfigs` entry.
  //   2. Drop translations under `i18n/<locale>/`:
  //        - `docusaurus-plugin-content-pages/` for src/pages overrides
  //        - `docusaurus-theme-classic/{navbar,footer}.json` for theme strings
  //        - `code.json` for React component strings
  //   3. (Optional) Translate docs by mirroring tree under
  //      `i18n/<locale>/docusaurus-plugin-content-docs/current/`.
  //      Untranslated docs fall back to the default locale automatically.
  // Non-default locales route under `/<locale>/...` (e.g. `/ko/`).
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ko', 'ja', 'zh-CN', 'zh-TW', 'es'],
    localeConfigs: {
      en: { label: 'English', htmlLang: 'en-US' },
      ko: { label: '한국어', htmlLang: 'ko-KR' },
      ja: { label: '日本語', htmlLang: 'ja-JP' },
      'zh-CN': { label: '简体中文', htmlLang: 'zh-CN' },
      'zh-TW': { label: '繁體中文', htmlLang: 'zh-TW' },
      es: { label: 'Español', htmlLang: 'es' },
    },
  },

  // Docs are sourced from the repo's existing markdown trees rather than
  // duplicated. The build script symlinks them into website/docs/ before
  // `docusaurus build` runs.
  plugins: ['./plugins/xl3-alias/index.cjs'],

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/jinyoung4478/xl3/edit/main/',
          // Surfaces lastUpdatedAt in route metadata so the sitemap can
          // emit <lastmod>. Synced docs carry the date via injected
          // `last_update` frontmatter (see scripts/sync-docs.mjs);
          // git-tracked i18n translations resolve through git history.
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          lastmod: 'date',
          // The root `/` and a couple of high-traffic pages get higher
          // priority so Google ranks them above the long-tail spec/ADR
          // pages.
          createSitemapItems: async (params) => {
            const { defaultCreateSitemapItems, ...rest } = params;
            const items = await defaultCreateSitemapItems(rest);
            return items
              // Drop the 404 page — search engines should not index it.
              .filter((item) => !/\/404\/?$/.test(item.url))
              // Drop the trailing duplicate root entry the default
              // sitemap generator emits.
              .filter((item, idx, arr) => arr.findIndex((x) => x.url === item.url) === idx)
              .map((item) => {
                if (item.url === 'https://xl3.io/' || item.url === 'https://xl3.io') {
                  return { ...item, priority: 1.0, changefreq: 'weekly' };
                }
                if (/\/(try|guides|api|spec|porters-guide)$/.test(item.url)) {
                  return { ...item, priority: 0.9 };
                }
                if (/\/guides\//.test(item.url) || /\/spec\//.test(item.url)) {
                  return { ...item, priority: 0.7 };
                }
                if (/\/spec\/decisions\//.test(item.url)) {
                  return { ...item, priority: 0.4 };
                }
                return item;
              });
          },
        },
      } satisfies Preset.Options,
    ],
  ],

  // JSON-LD @graph so AI platforms can resolve xl3 as a distinct entity
  // (name collisions: Novation XL3, XLCubed XL3, xl3.com). Cross-referenced
  // via @id so Organization, Person, SoftwareApplication, and WebSite are
  // treated as one coherent entity graph rather than isolated schema blocks.
  headTags: [
    // Naver Search Advisor ownership verification (meta-tag method).
    {
      tagName: 'meta',
      attributes: {
        name: 'naver-site-verification',
        content: '17297dad9d996f8aa377803da09a13c9de3f801b',
      },
    },
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': 'https://xl3.io/#organization',
            name: 'xl3',
            url: 'https://xl3.io',
            logo: {
              '@type': 'ImageObject',
              url: 'https://xl3.io/img/xl3-logo.png',
            },
            description:
              'Open-source deterministic rule format for Excel-to-Excel transformation. The transformation rules are authored in Excel itself using XTL, an Excel-syntax template language specified independently of any runtime.',
            foundingDate: '2024',
            founder: { '@id': 'https://xl3.io/#person-jinyoung' },
            sameAs: [
              'https://github.com/jinyoung4478/xl3',
            ],
            knowsAbout: [
              'Excel-to-Excel transformation',
              'OOXML workbook generation',
              'deterministic document rendering',
              'AI-authored spreadsheet templates',
              'Excel-syntax template languages',
            ],
          },
          {
            '@type': 'Person',
            '@id': 'https://xl3.io/#person-jinyoung',
            name: 'Jinyoung Kim',
            url: 'https://github.com/jinyoung4478',
            sameAs: ['https://github.com/jinyoung4478'],
            knowsAbout: [
              'Excel workbook generation',
              'OOXML specification',
              'TypeScript',
              'open-source software',
            ],
          },
          {
            '@type': 'SoftwareApplication',
            '@id': 'https://xl3.io/#software',
            name: 'xl3',
            description:
              'Deterministic runtime for AI-generated Excel reports. An LLM writes the template once; xl3 renders the workbook from (template, data) as a pure function — same inputs, same bytes, every time.',
            url: 'https://xl3.io',
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Node.js 18+, Browser (ESM)',
            programmingLanguage: 'TypeScript',
            license: 'https://opensource.org/licenses/MIT',
            softwareVersion: '0.9.0',
            releaseNotes: 'https://github.com/jinyoung4478/xl3/blob/main/CHANGELOG.md',
            codeRepository: 'https://github.com/jinyoung4478/xl3',
            creator: { '@id': 'https://xl3.io/#organization' },
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
            },
            featureList: [
              'Deterministic Excel workbook rendering — same inputs produce identical byte-for-byte output',
              'LLM-authored templates — AI writes the template.xlsx once, xl3 renders every run',
              'XTL expression language for cell-level transformations',
              'Preserves sheet structure, number formats, styles, and merged cells',
              'Works in Node.js and browser environments',
              'Open-source with MIT license',
              '70 Architecture Decision Records and 154 conformance fixtures',
              "Porter's Guide enables second-language implementations",
            ],
            screenshot: 'https://xl3.io/img/og.png',
            sameAs: ['https://github.com/jinyoung4478/xl3'],
          },
          {
            '@type': 'WebSite',
            '@id': 'https://xl3.io/#website',
            name: 'xl3',
            url: 'https://xl3.io',
            publisher: { '@id': 'https://xl3.io/#organization' },
          },
        ],
      }),
    },
  ],

  themeConfig: {
    image: 'img/og.png',
    metadata: [
      { name: 'theme-color', content: '#185c37' },
      { name: 'keywords', content: 'xl3, XTL, Excel template, Excel-to-Excel, OOXML, xlsx, workbook transformation, conformance, spec' },
      {
        name: 'description',
        content:
          'xl3 is an open-source, deterministic rule format for Excel-to-Excel transformation. Author the rules in .xlsx using Excel-syntax XTL expressions; xl3 renders the same bytes for the same inputs, every time. npm: @jinyoung4478/xl3.',
      },
      { property: 'og:type', content: 'website' },
    ],
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'xl3',
      logo: { alt: 'xl3', src: 'img/xl3-logo.png', width: 39, height: 32 },
      // Navbar item labels translate via i18n/<locale>/docusaurus-theme-classic/navbar.json.
      // `localeDropdown` auto-switches between /, /ko/, /ja/, … based on `locales`.
      items: [
        { to: '/try', label: 'Try it', position: 'left' },
        { to: '/guides', label: 'Guides', position: 'left' },
        { to: '/api', label: 'API', position: 'left' },
        {
          type: 'dropdown',
          label: 'Docs',
          position: 'left',
          items: [
            { label: 'Spec', to: '/spec' },
            { label: "Porter's Guide", to: '/porters-guide' },
            { label: 'Conformance', to: '/conformance' },
            { label: 'Roadmap to 1.0', to: '/roadmap' },
            { label: 'Governance', to: '/governance' },
            { label: 'Contributing', to: '/contributing' },
            { label: 'Implementations', to: '/implementations' },
            { label: 'Releasing', to: '/releasing' },
          ],
        },
        { type: 'localeDropdown', position: 'right' },
        { href: 'https://github.com/jinyoung4478/xl3', label: 'GitHub', position: 'right' },
        { href: 'https://www.npmjs.com/package/@jinyoung4478/xl3', label: 'npm', position: 'right' },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Guides', to: '/guides' },
            { label: 'Spec', to: '/spec' },
            { label: "Porter's Guide", to: '/porters-guide' },
            { label: 'Conformance', to: '/conformance' },
          ],
        },
        {
          title: 'Try',
          items: [
            { label: 'Browser converter', to: '/try' },
            // pathname:// prefix bypasses Docusaurus's in-site link checker
            // so these static-asset downloads under /static/ don't get
            // flagged as broken routes.
            { label: 'Sample raw.xlsx', href: 'pathname:///playground-samples/sample-raw.xlsx' },
            { label: 'Sample template.xlsx', href: 'pathname:///playground-samples/sample-template.xlsx' },
          ],
        },
        {
          title: 'Code',
          items: [
            { label: 'GitHub', href: 'https://github.com/jinyoung4478/xl3' },
            { label: 'npm', href: 'https://www.npmjs.com/package/@jinyoung4478/xl3' },
            { label: 'Changelog', href: 'https://github.com/jinyoung4478/xl3/blob/main/CHANGELOG.md' },
          ],
        },
      ],
      copyright: `Code MIT · Spec CC-BY-4.0. Microsoft and Excel are trademarks of Microsoft Corporation. xl3 is not affiliated.`,
    },
    prism: {
      theme: xl3GithubDark,
      darkTheme: xl3GithubDark,
      additionalLanguages: ['bash', 'json', 'yaml', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
