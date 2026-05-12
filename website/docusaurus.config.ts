import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'xl3',
  tagline: 'Excel conversion, inside Excel, in Excel syntax.',
  favicon: 'img/favicon.svg',

  url: 'https://xl3.io',
  baseUrl: '/',

  organizationName: 'jinyoung4478',
  projectName: 'xl3',

  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',
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

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
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
                if (/\/(converter|cookbook\/?|spec\/?|PORTERS_GUIDE)$/.test(item.url)) {
                  return { ...item, priority: 0.9 };
                }
                if (/\/cookbook\//.test(item.url) || /\/spec\//.test(item.url)) {
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

  themeConfig: {
    image: 'img/og.png',
    metadata: [
      { name: 'theme-color', content: '#185c37' },
      { name: 'keywords', content: 'xl3, XTL, Excel template, Excel-to-Excel, OOXML, xlsx, workbook transformation, conformance, spec' },
    ],
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'xl3',
      logo: { alt: 'xl3', src: 'img/favicon.svg' },
      // Note: left-side items below route to English pages. Full Korean nav
      // parity is deferred to a future Docusaurus i18n migration; for now,
      // the `/ko/` link surfaces the Korean landing as a single entry point.
      items: [
        { to: '/', label: 'Home', position: 'left' },
        { to: '/converter', label: 'Converter', position: 'left' },
        { to: '/cookbook/', label: 'Cookbook', position: 'left' },
        { to: '/api/', label: 'API', position: 'left' },
        { to: '/spec/', label: 'Spec', position: 'left' },
        { to: '/PORTERS_GUIDE', label: "Porter's Guide", position: 'left' },
        { to: '/conformance/DASHBOARD', label: 'Conformance', position: 'left' },
        { to: '/ko/', label: '한국어', position: 'right' },
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
            { label: 'Cookbook', to: '/cookbook/' },
            { label: 'Spec', to: '/spec/' },
            { label: "Porter's Guide", to: '/PORTERS_GUIDE' },
            { label: 'Conformance', to: '/conformance/DASHBOARD' },
          ],
        },
        {
          title: 'Try',
          items: [
            { label: 'Browser converter', to: '/converter' },
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
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
