// Webpack alias so `import '@jinyoung4478/xl3'` from the converter
// page resolves to the local `dist/` build instead of node_modules.
// Keeps the playground in sync with the source under development —
// no version drift between published @jinyoung4478/xl3 and what
// gets shipped at /converter.

const path = require('path');

module.exports = function xl3AliasPlugin(context) {
  return {
    name: 'xl3-alias-plugin',
    configureWebpack() {
      return {
        resolve: {
          alias: {
            '@jinyoung4478/xl3$': path.resolve(context.siteDir, '..', 'dist', 'index.js'),
          },
        },
      };
    },
  };
};
