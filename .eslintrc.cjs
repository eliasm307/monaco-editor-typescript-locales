const baseConfig = require("@eliasm307/config/eslint")({ withReact: true, withPrettier: true });

module.exports = {
  ...baseConfig,
  root: true,
  ignorePatterns: [
    "**/next.config.js",
    "**/public/**",
    "**/out/**",
    "**/node_modules/**",
    "**/coverage/**",
  ],
  overrides: [
    ...baseConfig.overrides,
    {
      files: ["**/next.config.js", "**/*.js"],
      rules: {
        "functional-core/purity": "off", // has an issue getting scope for this file for some reason
      },
    },
  ],
};
