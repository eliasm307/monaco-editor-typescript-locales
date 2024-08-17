/* eslint-env node */
/* eslint-disable no-console */
// @ts-check

const path = require("node:path");
const fs = require("node:fs");
const glob = require("glob");
const typescriptVersion = require("typescript/package.json").version;

/** @typedef {{category: string; code: number;}} DiagnosticDetails */

/** @typedef {Map<string, DiagnosticDetails>} InputDiagnosticMessageTable */

/** @typedef {{generatedFromTypescriptVersion: string, availableLocales: string[]}} Metadata */

const LOCALES_DIR = path.join(__dirname, "../../dist/locales");
const TYPESCRIPT_NODE_MODULES_LIB_DIR = path.join(
  __dirname,
  "../../../../node_modules/typescript/lib",
);
const DIAGNOSTIC_MESSAGES_FILE_NAME_WITH_EXT = "diagnosticMessages.generated.json";
const LOCALES_METADATA_FILE_PATH = path.join(LOCALES_DIR, "metadata.json");
const README_FILE_PATH = path.join(__dirname, "../../README.md");
const README_METADATA_START = "<!-- LOCALES_METADATA_START -->";
const README_METADATA_END = "<!-- LOCALES_METADATA_END -->";

async function main() {
  // English messages are distributed in the typescript source code, not as a standalone json file
  // so we need to generate our own
  await createEnglishDiagnosticMessagesFile();

  // list of locales that have diagnostic messages
  const availableLocales = ["en"];

  // Non english locale messages are included in the typescript distribution in node_modules, so copy them to our folder
  const localeDiagnosticMessagesFilePaths = getLocaleDiagnosticMessagesFilePaths();
  for (const diagnosticMessagesFilePath of localeDiagnosticMessagesFilePaths) {
    const locale = path.basename(path.dirname(diagnosticMessagesFilePath));
    copyDiagnosticMessagesFromPath({locale, diagnosticMessagesFilePath});
    availableLocales.push(locale);
  }

  availableLocales.sort();

  /** @type {Metadata} */
  const metaData = {
    // NOTE: the version is accurate for non-english locales from our node_modules,
    // however english messages are fetched from latest source code, so assume they are compatible with atleast this version
    generatedFromTypescriptVersion: typescriptVersion,
    availableLocales,
  };

  createMetadataFile(metaData);
  await updateReadmeWithMetadata(metaData);
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
function copyDiagnosticMessagesFromPath({locale, diagnosticMessagesFilePath}) {
  const destinationPath = path.join(LOCALES_DIR, locale, DIAGNOSTIC_MESSAGES_FILE_NAME_WITH_EXT);
  fs.mkdirSync(path.dirname(destinationPath), {recursive: true});
  fs.copyFileSync(diagnosticMessagesFilePath, destinationPath); // NOTE: this replaces the file if it already exists
  console.log(
    `Copied "${locale}" diagnostic messages \n\tfrom "${diagnosticMessagesFilePath}" \n\tto ${destinationPath}`,
  );
}

/**
 * @param {Metadata} metaData
 */
function createMetadataFile(metaData) {
  ensureFileExistsAndWrite({
    filePath: LOCALES_METADATA_FILE_PATH,
    content: JSON.stringify(metaData, null, 2),
  });
  console.log(`Saved metadata to "${LOCALES_METADATA_FILE_PATH}"`);
}

/**
 * @param {Metadata} metaData
 */
async function updateReadmeWithMetadata(metaData) {
  const getLocaleDisplayName = new Intl.DisplayNames(["en"], {type: "language"});
  const localeTableRows = metaData.availableLocales
    .map((locale, i) => `| ${i + 1} | ${locale} | ${getLocaleDisplayName.of(locale)} |`)
    .join("\n");

  const localesSectionText = [
    "",
    "| | Code | Description |",
    "| -- | ------ | ------------ |",
    localeTableRows,
    "",
    "",
    `Generated from TypeScript version **${metaData.generatedFromTypescriptVersion}**`,
    "",
  ].join("\n");

  const readmeContent = fs.readFileSync(README_FILE_PATH, "utf-8");
  const startIdx = readmeContent.indexOf(README_METADATA_START) + README_METADATA_START.length;
  const endIdx = readmeContent.indexOf(README_METADATA_END);
  let newReadmeContent =
    readmeContent.slice(0, startIdx) + localesSectionText + readmeContent.slice(endIdx);

  const prettier = require("prettier");
  newReadmeContent = await prettier.format(newReadmeContent, {filepath: README_FILE_PATH});

  fs.writeFileSync(README_FILE_PATH, newReadmeContent);
  console.log(`Updated README with metadata`);
}

async function createEnglishDiagnosticMessagesFile() {
  // english messages are distributed in the typescript source code, not as a standalone json file
  // so we need to fetch the source and generate our own json messages
  // NOTE: doing it like this to avoid cloning, installing, and building the entire TS repo just for one file
  const messages = await fetchAndGenerateEnglishDiagnosticsMessages();

  // save messages
  const localeFilePath = path.join(LOCALES_DIR, `en/${DIAGNOSTIC_MESSAGES_FILE_NAME_WITH_EXT}`);
  ensureFileExistsAndWrite({filePath: localeFilePath, content: messages});
  console.log(`Fetched and saved "en" diagnostic messages to "${localeFilePath}"`);
}

/**
 * @param {{filePath: string, content: string}} param0
 */
function ensureFileExistsAndWrite({filePath, content}) {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`filePath must be absolute, but got ${filePath}`);
  }

  const targetDirName = path.dirname(filePath);
  if (!fs.existsSync(targetDirName)) {
    fs.mkdirSync(targetDirName, {recursive: true});
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
  return fetch(
    "https://api.github.com/repos/microsoft/TypeScript/contents/src/compiler/diagnosticMessages.json",
  )
    .then((res) => res.json())
    .then((data) => {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return JSON.parse(content);
    });
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

  messageTable.forEach(({code}, name) => {
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
