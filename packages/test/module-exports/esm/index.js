/* eslint-disable */
/**
 * This file is used to test the ESM build of the package,
 * whether it can be imported and used correctly in an ESM environment.
 */

import * as mod from "monaco-editor-typescript-locales";
import assert from "node:assert";

assert.strictEqual(typeof mod.register, "function", "ESM module exports register function");

console.log("ESM import test passed!", mod);
