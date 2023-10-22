/* eslint-disable functional-core/purity */
import type { editor } from "monaco-editor";
import { escapeRegExp } from "./utils";

const TYPESCRIPT_WORKER_LANGUAGE_IDS = ["typescript", "javascript"] as const;

type LanguageId = (typeof TYPESCRIPT_WORKER_LANGUAGE_IDS)[number];

type MessageTemplatesMap = Record<number, string>;

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type MonacoModule = typeof import("monaco-editor");

/**
 * This is to make sure we only initialise each instance once
 */
const initialisedMonacoInstances = new WeakSet<MonacoModule>();

/**
 * Sets up the given Monaco instance to translate any JS/TS diagnostic marker messages to the locale configured for the language in the compiler options.
 *
 * For example the following will show messages in French for TypeScript models but English for JavaScript models (if the local has not been configured for JS):
 * ```ts
 * const currentCompilerOptions = monaco.languages.typescript.typescriptDefaults.getCompilerOptions();
 * monaco.languages.typescript.typescriptDefaults.setCompilerOptions({ ...currentCompilerOptions, locale: "fr" });
 * ```
 *
 * @remark This is idempotent and will only initialise a given Monaco instance once when called multiple times.
 */
function initIfRequired(monaco: MonacoModule): void {
  if (initialisedMonacoInstances.has(monaco)) {
    return; // already initialised
  }

  // setup JS/TS message translation listener and handler
  // NOTE: assuming monaco fires this with debouncing etc so its performant to handle this directly without further buffering etc
  monaco.editor.onDidChangeMarkers((modelUris) => {
    // todo since the method to remove markers works on all models,
    // so  when we translate the markers we need to consider all the models at the same time to produce one set of output markers
    modelUris.forEach((uri) => {
      const model = monaco.editor.getModel(uri);
      if (model) {
        void translateDiagnosticMessageMarkers({ monaco, model });
      }
    });
  });
}

export default function setLanguageLocale({
  monaco,
  languageId,
  locale,
}: {
  monaco: MonacoModule;
  languageId: "javascript" | "typescript";
  locale: string;
}) {
  initIfRequired(monaco);

  let defaults = monaco.languages.typescript.typescriptDefaults;
  if (languageId === "javascript") {
    defaults = monaco.languages.typescript.javascriptDefaults;
  }

  const currentLocale = defaults.getCompilerOptions().locale;
  if (currentLocale) {
    // Remove all markers from previous locale
    monaco.editor.removeAllMarkers(`${languageId}-${currentLocale}`);
  }

  const existingCompilerOptions = defaults.getCompilerOptions();
  defaults.setCompilerOptions({ ...existingCompilerOptions, locale });
}

// todo instead of driving this from language settings which means all models are affected by a locale change,
// we could track individual locales for each model so each model can have its own locale
function getConfiguredLocaleForLanguage({
  monaco,
  languageId,
}: {
  monaco: MonacoModule;
  languageId: LanguageId;
}): string | undefined {
  switch (languageId) {
    case "typescript":
      return monaco.languages.typescript.typescriptDefaults.getCompilerOptions().locale;
    case "javascript":
      return monaco.languages.typescript.javascriptDefaults.getCompilerOptions().locale;
    default:
      throw Error(`Unsupported language ID "${languageId}"`);
  }
}

async function translateDiagnosticMessageMarkers({
  model,
  monaco,
}: {
  model: editor.IModel;
  monaco: MonacoModule;
}): Promise<void> {
  const languageId = model.getLanguageId() as LanguageId;
  if (!TYPESCRIPT_WORKER_LANGUAGE_IDS.includes(languageId)) {
    return; // only TS/JS messages supported
  }

  // todo investigate issue when there are multiple editors and markers are doubled up

  // NOTE: assumes the JS/TS messages will always have the owner for their markers set as the language ID
  const originalMarkers = monaco.editor.getModelMarkers({ owner: languageId });
  if (!originalMarkers.length) {
    return; // no markers to translate or we already translated them
  }
  console.log("translateDiagnosticMessageMarkers", { languageId, originalMarkers });

  const targetLocale = getConfiguredLocaleForLanguage({ monaco, languageId });
  if (!targetLocale || targetLocale === "en") {
    return; // don't need to translate
  }

  try {
    const translatedMarkers = await translateTypescriptWorkerMarkers({
      originalMarkers,
      targetLocale,
    });

    // this is so the user only sees TS/JS messages in their language and not the original english message also
    // NOTE: if a message cant be translated it will be maintained in english
    monaco.editor.removeAllMarkers(languageId); // remove english markers

    // replace with translated markers
    // NOTE: need to set a different owner ID as setting the markers here will trigger the marker change listener which recursively triggers this method again,
    // but with a non ts/js owner the markers wont be processed again as we filter for js/ts markers specifically,
    // so there will be no markers found and the markers aren't set again
    monaco.editor.setModelMarkers(model, `${languageId}-${targetLocale}`, translatedMarkers);
  } catch (error) {
    console.error("translateDiagnosticMessageMarkers error", error);
  }
}

async function translateTypescriptWorkerMarkers({
  originalMarkers,
  targetLocale,
}: {
  originalMarkers: editor.IMarker[];
  targetLocale: string;
}): Promise<editor.IMarker[]> {
  const [englishDiagnosticMessageTemplatesMap, targetLocaleDiagnosticMessageTemplatesMap] =
    await Promise.all([
      getDiagnosticMessageTemplatesForLocale("en"),
      getDiagnosticMessageTemplatesForLocale(targetLocale),
    ]);

  return originalMarkers.map((englishMarker) => {
    if (!englishMarker.code) {
      return englishMarker; // marker doesn't have a code so we cant translate, keep the original
    }

    const messageCode = Number(
      typeof englishMarker.code === "object" ? englishMarker.code.value : englishMarker.code,
    );
    if (isNaN(messageCode)) {
      return englishMarker; // found code is not valid so we cant translate, keep the original
    }

    const translatedMessage = translatedDiagnosticMessage({
      englishMessage: englishMarker.message,
      englishMessageTemplate: englishDiagnosticMessageTemplatesMap[messageCode],
      localeMessageTemplate: targetLocaleDiagnosticMessageTemplatesMap[messageCode],
    });

    if (!translatedMessage) {
      return englishMarker; // could not translate the message, so keep the original
    }

    return {
      ...englishMarker,
      message: translatedMessage, // replace the message with the translated version
    };
  });
}

function translatedDiagnosticMessage({
  englishMessage,
  englishMessageTemplate,
  localeMessageTemplate,
}: {
  englishMessage: string;
  localeMessageTemplate?: string;
  englishMessageTemplate?: string;
}): string | undefined {
  if (!englishMessageTemplate || !localeMessageTemplate) {
    // this could happen if this package is used with a version of Monaco that has a higher version of TS than this package
    // and we encounter a new message code that we dont have a template for, we keep the english message in this case
    return; // cannot translate
  }

  const templateHasPlaceholders = localeMessageTemplate.includes("{0}");
  if (!templateHasPlaceholders) {
    return localeMessageTemplate; // we can use the locale template directly
  }

  // we need to get the values of the placeholders from the english message then populate the locale message template to get the translated message
  const placeholdersRegex = createEnglishMessagePlaceholdersRegex({
    englishMessageTemplate,
  });
  const placeholderMatches = placeholdersRegex.exec(englishMessage);
  if (!placeholderMatches?.groups) {
    console.error("getTranslatedMessage no matches found", {
      englishMessage,
      englishMessageTemplate,
      localeMessageTemplate,
      placeholdersRegex,
    });
    return; // this should not happen but we keep the english message if it does
  }

  // populate the locale message template with the placeholder values from the english message
  return Object.entries(placeholderMatches.groups).reduce<string>(
    (outMessage, [placeholderIdentifier, placeholderValue]) => {
      const placeholderIndex = getNumberFromText(placeholderIdentifier);
      return outMessage.replace(`{${placeholderIndex}}`, placeholderValue);
    },
    localeMessageTemplate,
  );
}

const messageTemplateToRegexTextCache = new Map<string, string>();

/**
 * @remark this could get called a lot during editing so should be reasonably efficient
 */
function createEnglishMessagePlaceholdersRegex({
  englishMessageTemplate,
}: {
  englishMessageTemplate: string;
}): RegExp {
  let placeholdersRegexText = messageTemplateToRegexTextCache.get(englishMessageTemplate);
  if (!placeholdersRegexText) {
    placeholdersRegexText = escapeRegExp(englishMessageTemplate).replace(
      /\\{\d+\\}/g,
      (placeholder) => {
        const placeholderIndex = getNumberFromText(placeholder);
        // NOTE: this needs to be a valid JS identifier (so cant be directly the index) for named regex capture groups
        // ie something that could be used as a js variable name
        const placeholderIdentifier = `_${placeholderIndex}`;
        return `(?<${placeholderIdentifier}>.+)`;
      },
    );
    messageTemplateToRegexTextCache.set(englishMessageTemplate, placeholdersRegexText);
  }

  // this is stateful as it uses the `g` flag so dont cache the regex itself but we cache the content
  return new RegExp(placeholdersRegexText, "g");
}

function getNumberFromText(text: string): number {
  const number = Number(text.replace(/\D/g, ""));
  if (isNaN(number)) {
    throw Error(`Could not get placeholder index from "${text}"`);
  }
  return number;
}

const LOCALE_TO_MESSAGE_TEMPLATES_MAP_CACHE: { [key in string]?: MessageTemplatesMap } = {};

async function getDiagnosticMessageTemplatesForLocale(
  locale: string,
): Promise<MessageTemplatesMap> {
  let messageTemplatesMap = LOCALE_TO_MESSAGE_TEMPLATES_MAP_CACHE[locale];
  if (messageTemplatesMap) {
    return messageTemplatesMap;
  }

  // fetch the message templates
  const rawLocaleDiagnosticMessagesMap: Record<string, string> = await import(
    `../locales/${locale}/diagnosticMessages.generated.json`
  ).then((m) => m.default);

  messageTemplatesMap = Object.fromEntries(
    Object.entries(rawLocaleDiagnosticMessagesMap).map(([key, value]) => {
      // get the last segment of the locale entry key, which should be the message code, example key "Are_you_missing_a_semicolon_2734"
      const messageCode = Number(key.split("_").pop()!);
      if (isNaN(messageCode)) {
        throw Error(
          `Diagnostic message code not found for entry with key "${key}" and value "${value}"`,
        );
      }
      return [messageCode, value];
    }),
  );

  LOCALE_TO_MESSAGE_TEMPLATES_MAP_CACHE[locale] = messageTemplatesMap;
  return messageTemplatesMap;
}
