/* eslint-env node */
/* eslint-disable no-console */

const path = require("node:path");
const fs = require("node:fs");
const glob = require("glob");
const typescriptVersion = require("typescript/package.json").version;

/** @typedef {{category: string; code: number;}} DiagnosticDetails */

/** @typedef {Map<string, DiagnosticDetails>} InputDiagnosticMessageTable */

const TS_DIAGNOSTIC_MESSAGES_SOURCE_FILE_URL =
  "https://raw.githubusercontent.com/microsoft/TypeScript/main/src/compiler/diagnosticMessages.json";
const LOCALES_DIR = path.join(__dirname, "../../locales");
const TYPESCRIPT_NODE_MODULES_LIB_DIR = path.join(
  __dirname,
  "../../../../node_modules/typescript/lib",
);
const DIAGNOSTIC_MESSAGES_FILE_NAME_WITH_EXT = "diagnosticMessages.generated.json";
const LOCALES_METADATA_FILE_PATH = path.join(LOCALES_DIR, "metadata.json");

async function main() {
  // English messages are distributed in the typescript source code, not as a standalone json file
  // so we need to generate our own
  await generateEnglishDiagnosticMessages();
  let availableLocales = ["en"];

  // Non english locale messages are included in the typescript distribution in node_modules, so copy them to our folder
  const localeDiagnosticMessagesFilePaths = getLocaleDiagnosticMessagesFilePaths();
  for (const diagnosticMessagesFilePath of localeDiagnosticMessagesFilePaths) {
    const locale = path.basename(path.dirname(diagnosticMessagesFilePath));
    copyDiagnosticMessagesFromPath({ locale, diagnosticMessagesFilePath });
    availableLocales.push(locale);
  }

  createMetadataFile(availableLocales);
}

main().then(() => console.log("DONE"));

function getLocaleDiagnosticMessagesFilePaths() {
  return glob.sync(`*/${DIAGNOSTIC_MESSAGES_FILE_NAME_WITH_EXT}`, {
    cwd: TYPESCRIPT_NODE_MODULES_LIB_DIR,
    absolute: true,
  });
}

/**
 * @param {{locale: string, diagnosticMessagesFilePath: string}} param0
 */
function copyDiagnosticMessagesFromPath({ locale, diagnosticMessagesFilePath }) {
  const destinationPath = path.join(LOCALES_DIR, locale, DIAGNOSTIC_MESSAGES_FILE_NAME_WITH_EXT);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(diagnosticMessagesFilePath, destinationPath); // NOTE: this replaces the file if it already exists
  console.log(
    `Copied "${locale}" diagnostic messages \n\tfrom "${diagnosticMessagesFilePath}" \n\tto ${destinationPath}`,
  );
}

/**
 * @param {string[]} availableLocales - list of locales that have diagnostic messages
 */
function createMetadataFile(availableLocales) {
  ensureFileExistsAndWrite({
    filePath: LOCALES_METADATA_FILE_PATH,
    // NOTE: the version is accurate for non-english locales from our node_modules,
    // however english messages are fetched from latest source code, so assume they are compatible with atleast this version
    content: JSON.stringify(
      { generatedFromTypescriptVersion: typescriptVersion, availableLocales },
      null,
      2,
    ),
  });
}

async function generateEnglishDiagnosticMessages() {
  // english messages are distributed in the typescript source code, not as a standalone json file
  // so we need to fetch the source and generate our own json messages
  // NOTE: doing it like this to avoid cloning, installing, and building the entire TS repo just for one file
  const messages = await fetchAndGenerateEnglishDiagnosticsMessages();

  // save messages
  const localeFilePath = path.join(LOCALES_DIR, `en/${DIAGNOSTIC_MESSAGES_FILE_NAME_WITH_EXT}`);
  ensureFileExistsAndWrite({ filePath: localeFilePath, content: messages });
  console.log(`Fetched and saved "en" diagnostic messages to "${localeFilePath}"`);
}

/**
 * @param {{filePath: string, content: string}} param0
 */
function ensureFileExistsAndWrite({ filePath, content }) {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`filePath must be absolute, but got ${filePath}`);
  }

  const targetDirName = path.dirname(filePath);
  if (!fs.existsSync(targetDirName)) {
    fs.mkdirSync(targetDirName, { recursive: true });
  }

  // NOTE: this replaces the file if it already exists
  fs.writeFileSync(filePath, content);
}

async function fetchAndGenerateEnglishDiagnosticsMessages() {
  const sourceMessages = await fetchDiagnosticMessagesSourceData();
  const messageTable = new Map(Object.entries(sourceMessages));
  const generatedMessages = buildDiagnosticMessageOutput(messageTable);
  return generatedMessages;
}

async function fetchDiagnosticMessagesSourceData() {
  return fetch(TS_DIAGNOSTIC_MESSAGES_SOURCE_FILE_URL).then((res) => res.json());
}

/**
 * @param {InputDiagnosticMessageTable} messageTable
 * @returns {string}
 *
 * @remark copied from https://github.com/microsoft/TypeScript/blob/main/scripts/processDiagnosticMessages.mjs
 */
function buildDiagnosticMessageOutput(messageTable) {
  /** @type {Record<string, string>} */
  const result = {};

  messageTable.forEach(({ code }, name) => {
    const propName = convertPropertyName(name);
    result[createKey(propName, code)] = name;
  });

  return JSON.stringify(result, null, 2).replace(/\r?\n/g, "\r\n");
}

/**
 * @param {string} name
 * @param {number} code
 * @returns {string}
 *
 * @remark copied from https://github.com/microsoft/TypeScript/blob/main/scripts/processDiagnosticMessages.mjs
 */
function createKey(name, code) {
  return `${name.slice(0, 100)}_${code}`;
}

/**
 * @param {string} origName
 * @returns {string}
 *
 * @remark copied from https://github.com/microsoft/TypeScript/blob/main/scripts/processDiagnosticMessages.mjs
 */
function convertPropertyName(origName) {
  let result = origName
    .split("")
    .map((char) => {
      if (char === "*") {
        return "_Asterisk";
      }
      if (char === "/") {
        return "_Slash";
      }
      if (char === ":") {
        return "_Colon";
      }
      return /\w/.test(char) ? char : "_";
    })
    .join("");

  // get rid of all multi-underscores
  result = result.replace(/_+/g, "_");

  // remove any leading underscore, unless it is followed by a number.
  result = result.replace(/^_([^\d])/, "$1");

  // get rid of all trailing underscores.
  result = result.replace(/_$/, "");

  return result;
}
