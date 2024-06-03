/* eslint-disable */
/**
 * This file is used to test the CommonJS build of the package,
 * whether it can be imported and used correctly in a CommonJS environment.
 */

const assert = require("node:assert");
const mod = require("monaco-editor-typescript-locales");

assert.strictEqual(typeof mod.register, "function", "CJS module exports register function");

console.log("CJS import test passed!", mod);
