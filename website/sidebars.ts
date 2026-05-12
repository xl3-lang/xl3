import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  cookbookSidebar: [
    { type: 'doc', id: 'cookbook/index', label: 'Overview' },
    { type: 'doc', id: 'cookbook/getting-started', label: '01 · Getting started' },
    { type: 'doc', id: 'cookbook/conditional-cells', label: '02 · Conditional cells' },
    { type: 'doc', id: 'cookbook/aggregates', label: '03 · Aggregates' },
    { type: 'doc', id: 'cookbook/file-per-group', label: '04 · File per group' },
    { type: 'doc', id: 'cookbook/sheet-per-group', label: '05 · Sheet per group' },
    { type: 'doc', id: 'cookbook/runtime-inputs', label: '06 · Runtime inputs' },
    { type: 'doc', id: 'cookbook/multi-source-join', label: '07 · Multi-source + @join' },
    { type: 'doc', id: 'cookbook/xlookup', label: '08 · XLOOKUP' },
    { type: 'doc', id: 'cookbook/sort-and-top', label: '09 · Sort and Top-N' },
    { type: 'doc', id: 'cookbook/styling-and-branding', label: '10 · Styling and branding' },
    { type: 'doc', id: 'cookbook/text-formatting', label: '11 · TEXT() formatting' },
    { type: 'doc', id: 'cookbook/empty-values', label: '12 · Empty values in depth' },
    { type: 'doc', id: 'cookbook/error-handling', label: '13 · Error handling for hosts' },
    { type: 'doc', id: 'cookbook/config-values', label: '14 · __config__ as a value dictionary' },
    { type: 'doc', id: 'cookbook/directive-composition', label: '15 · Composing directives' },
  ],

  specSidebar: [
    { type: 'doc', id: 'spec/index', label: 'Spec index' },
    { type: 'doc', id: 'spec/language', label: 'Language' },
    { type: 'doc', id: 'spec/evaluation', label: 'Evaluation' },
    { type: 'doc', id: 'spec/STABILITY', label: 'Stability' },
    { type: 'doc', id: 'spec/glossary', label: 'Glossary' },
  ],

  conformanceSidebar: [
    { type: 'doc', id: 'conformance/README', label: 'Overview' },
    { type: 'doc', id: 'conformance/DASHBOARD', label: 'Dashboard' },
    { type: 'doc', id: 'conformance/coverage', label: 'Coverage matrix' },
    { type: 'doc', id: 'conformance/runner-protocol', label: 'Runner protocol' },
    { type: 'doc', id: 'conformance/AUTHORING', label: 'Authoring fixtures' },
  ],

  referenceSidebar: [
    { type: 'doc', id: 'PORTERS_GUIDE', label: "Porter's Guide" },
    { type: 'doc', id: 'IMPLEMENTATIONS', label: 'Implementations' },
    { type: 'doc', id: 'CONTRIBUTING', label: 'Contributing' },
    { type: 'doc', id: 'RELEASING', label: 'Releasing' },
    { type: 'doc', id: 'README', label: 'README (English)' },
  ],
};

export default sidebars;
