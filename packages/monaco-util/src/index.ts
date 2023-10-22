/* eslint-disable functional-core/purity */
import type { editor, languages, Uri } from "monaco-editor";
import { escapeRegExp } from "./utils";

const TYPESCRIPT_WORKER_LANGUAGE_IDS = ["typescript", "javascript"] as const;

type LanguageId = (typeof TYPESCRIPT_WORKER_LANGUAGE_IDS)[number];

type MessageTemplatesMap = Record<number, string>;

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
 * const typescriptDefaults = monaco.languages.typescript.typescriptDefaults;
 * const currentCompilerOptions = typescriptDefaults.getCompilerOptions();
 * typescriptDefaults.setCompilerOptions({ ...currentCompilerOptions, locale: "fr" });
 * ```
 *
 * @remark This is idempotent and will only initialise a given Monaco instance once when called multiple times.
 */
export function register(monaco: MonacoModule): void {
  if (initialisedMonacoInstances.has(monaco)) {
    return; // already initialised
  }

  // setup JS/TS message translation on locale change
  TYPESCRIPT_WORKER_LANGUAGE_IDS.forEach((languageId) => {
    const defaults = getDefaultsForLanguageId({ monaco, languageId });
    defaults.onDidChange(() => {
      // NOTE: we derive this from compiler options so we use the same locale as the compiler,
      // if we tracked this separately we could end up using a different locale if Monaco adds support for this property in the future
      // however it means we are limited to having locals per language and not per model (but tbc if there are any use cases for this)
      const newLocale = defaults.getCompilerOptions().locale || "en";
      onLanguageLocaleChange({ monaco, languageId, newLocale });
    });
  });

  // setup JS/TS message translation on content change
  // NOTE: assuming monaco fires this with debouncing etc so its performant to handle this directly without further buffering etc
  monaco.editor.onDidChangeMarkers(() => {
    void translateMarkersForLanguage({ monaco, languageId: "javascript" });
    void translateMarkersForLanguage({ monaco, languageId: "typescript" });
  });
}

function getDefaultsForLanguageId({
  monaco,
  languageId,
}: {
  monaco: MonacoModule;
  languageId: LanguageId;
}): languages.typescript.LanguageServiceDefaults {
  switch (languageId) {
    case "typescript":
      return monaco.languages.typescript.typescriptDefaults;
    case "javascript":
      return monaco.languages.typescript.javascriptDefaults;
    default:
      throw new Error(`Unsupported language ID: ${languageId}`);
  }
}

// we keep track of the last set locale for each language so we can remove the previous custom markers when the locale changes
const lastSetLanguageLocales: Record<LanguageId, string> = {
  typescript: "en",
  javascript: "en",
};

function onLanguageLocaleChange({
  monaco,
  languageId,
  newLocale,
}: {
  monaco: MonacoModule;
  languageId: "javascript" | "typescript";
  newLocale: string;
}) {
  const oldLocale = lastSetLanguageLocales[languageId];
  if (oldLocale === newLocale) {
    return; // no change
  }

  // Remove all custom markers from previous locale and update current locale markers
  monaco.editor.removeAllMarkers(`${languageId}-${oldLocale}`);
  lastSetLanguageLocales[languageId] = newLocale;

  // todo test it refreshes affected model markers on locale change

  // NOTE: this is triggered by a compiler options change which also seems to refresh the markers,
  // so we assume we will have the default english markers at this point
  void translateMarkersForLanguage({ monaco, languageId });
}

async function translateMarkersForLanguage({
  monaco,
  languageId,
}: {
  monaco: MonacoModule;
  languageId: LanguageId;
}): Promise<void> {
  const targetLocale = lastSetLanguageLocales[languageId];
  if (targetLocale === "en") {
    return; // no translation needed, assume default markers are in english
  }

  // todo test when there are multiple editors and markers are not doubled up
  try {
    // NOTE: assumes the JS/TS messages will always have the owner for their markers set as the language ID
    // NOTE: we assume the current markers are in english and previous custom markers have been removed when this is called
    const defaultJsOrTsMarkers = monaco.editor.getModelMarkers({ owner: languageId });
    if (!defaultJsOrTsMarkers.length) {
      return; // no markers to translate or we already translated them
    }
    const translatedMarkers = await translateMarkers({ defaultJsOrTsMarkers, targetLocale });

    // this is so the user only sees TS/JS messages in their language and not the original english message also
    // NOTE: if a message cant be translated it will be maintained in english
    monaco.editor.removeAllMarkers(languageId); // remove english markers after translation but before setting the new translated markers

    translatedMarkers
      // group markers by resource
      .reduce((resourceMarkersMap, marker) => {
        const resourceMarkers = resourceMarkersMap.get(marker.resource) || [];
        resourceMarkers.push(marker);
        resourceMarkersMap.set(marker.resource, resourceMarkers);
        return resourceMarkersMap;
      }, new Map<Uri, editor.IMarker[]>())
      // set translated markers for each model resource
      .forEach((markers, modelUri) => {
        const model = monaco.editor.getModel(modelUri);
        // not sure if non model resources can have markers but checking just in case
        if (model) {
          // NOTE: need to set a different owner ID as setting the markers here will trigger the marker change listener which recursively triggers this method again,
          // but with a non ts/js owner the markers wont be processed again as we filter for js/ts markers specifically,
          // so there will be no markers found and the markers aren't set again
          monaco.editor.setModelMarkers(model, `${languageId}-${targetLocale}`, markers);
        }
      });
  } catch (error) {
    console.error("translateDiagnosticMessageMarkers error", error);
  }
}

async function translateMarkers({
  defaultJsOrTsMarkers,
  targetLocale,
}: {
  /**
   * @remark assumes the default markers are in english
   */
  defaultJsOrTsMarkers: editor.IMarker[];
  targetLocale: string;
}) {
  const [englishDiagnosticMessageTemplatesMap, targetLocaleDiagnosticMessageTemplatesMap] =
    await Promise.all([
      getDiagnosticMessageTemplatesForLocale("en"),
      getDiagnosticMessageTemplatesForLocale(targetLocale),
    ]);

  return defaultJsOrTsMarkers.map((defaultMarker) => {
    if (!defaultMarker.code) {
      return defaultMarker; // marker doesn't have a code so we cant translate, keep the original
    }

    const messageCode = Number(
      typeof defaultMarker.code === "object" ? defaultMarker.code.value : defaultMarker.code,
    );
    if (isNaN(messageCode)) {
      return defaultMarker; // found code is not valid so we cant translate, keep the original
    }

    const translatedMessage = translatedDiagnosticMessage({
      englishMessage: defaultMarker.message,
      englishMessageTemplate: englishDiagnosticMessageTemplatesMap[messageCode],
      localeMessageTemplate: targetLocaleDiagnosticMessageTemplatesMap[messageCode],
    });

    if (!translatedMessage) {
      return defaultMarker; // could not translate the message, so keep the original
    }

    return {
      ...defaultMarker,
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
    // this could happen if this package is used with a version of Monaco that uses a higher version of TS than this package
    // and we encounter a new message code that we don't have a template for, we keep the english message in this case
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
      const placeholderIndex = placeholderIdentifier.replace("_", "");
      // NOTE: placeholders can be duplicated in the message template so we need to replace all occurrences
      return outMessage.replaceAll(`{${placeholderIndex}}`, placeholderValue);
    },
    localeMessageTemplate,
  );
}

const messageTemplateToRegexCache = new Map<string, RegExp>();

/**
 * @remark this could get called a lot during editing so should be reasonably efficient
 */
function createEnglishMessagePlaceholdersRegex({
  englishMessageTemplate,
}: {
  englishMessageTemplate: string;
}): RegExp {
  let placeholdersRegex = messageTemplateToRegexCache.get(englishMessageTemplate);
  if (placeholdersRegex) {
    return placeholdersRegex; // using cached regex
  }

  const visitedPlaceholderIndexes = new Set<string>();
  // NOTE: named capture group id needs to be a valid JS identifier (so cant be directly the index)
  const placeholdersRegexText = escapeRegExp(englishMessageTemplate).replace(
    /\\{\d+\\}/g,
    (placeholder) => {
      const placeholderIndex = placeholder.replace(/\D/g, "");
      if (visitedPlaceholderIndexes.has(placeholderIndex)) {
        // placeholder has already been visited so we don't need to create a new capture group
        // duplicate capture group names will cause an error when creating the regex
        // example for: "'{0}' refers to a value, but is being used as a type here. Did you mean 'typeof {0}'?"
        // todo test this can translate messages with duplicated placeholders
        return ".+";
      }
      visitedPlaceholderIndexes.add(placeholderIndex);
      return `(?<_${placeholderIndex}>.+)`;
    },
  );

  placeholdersRegex = new RegExp(placeholdersRegexText);
  messageTemplateToRegexCache.set(englishMessageTemplate, placeholdersRegex);
  return placeholdersRegex;
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
