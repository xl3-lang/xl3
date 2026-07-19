// Webpack alias so `import '@xl3-lang/xl3'` from the /try page
// resolves to the local `dist/` build instead of node_modules. Keeps
// the playground in sync with the source under development — no
// version drift between published @xl3-lang/xl3 and what gets
// shipped at /try.

const path = require('path');

module.exports = function xl3AliasPlugin(context) {
  return {
    name: 'xl3-alias-plugin',
    configureWebpack() {
      return {
        resolve: {
          alias: {
            '@xl3-lang/xl3$': path.resolve(context.siteDir, '..', 'impl', 'js', 'dist', 'index.js'),
          },
        },
      };
    },
  };
};
