const baseConfig = require("@eliasm307/config/eslint")({ withReact: true, withPrettier: true });

module.exports = {
  ...baseConfig,
  root: true,
  // plugins: baseConfig.plugins.filter((plugin) => plugin !== "react-hooks"),
  overrides: [
    ...baseConfig.overrides,
    {
      files: ["**/next.config.js", "**/*.js"],
      rules: {
        "functional-core/purity": "off", // has an issue getting scope for js files for some reason
      },
    },
  ],
};
