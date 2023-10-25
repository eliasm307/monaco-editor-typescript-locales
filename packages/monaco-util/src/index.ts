import type { editor, languages, MarkerTag, Uri } from "monaco-editor";

const TYPESCRIPT_WORKER_LANGUAGE_IDS = ["typescript", "javascript"] as const;

type LanguageId = (typeof TYPESCRIPT_WORKER_LANGUAGE_IDS)[number];

type MessageTemplatesMap = Record<number, string>;

type MonacoModule = typeof import("monaco-editor");

/**
 * This is to make sure we only initialise each instance once
 */
const initialisedMonacoInstances = new WeakSet<MonacoModule>();

/**
 * @remark It is assumed that future MarkerTag values will not be negative and not conflict with this value
 */
const IS_TRANSLATED_TAG = -1 as MarkerTag;

/**
 * Sets up the given Monaco instance to translate any JS/TS diagnostic marker messages
 * to the locale configured for the language in the compiler options.
 *
 * For example the following will show messages in French for TypeScript models
 * but English for JavaScript models (if the local has not been configured for JS):
 *
 * ```ts
 * const typescriptDefaults = monaco.languages.typescript.typescriptDefaults;
 * const currentCompilerOptions = typescriptDefaults.getCompilerOptions();
 * typescriptDefaults.setCompilerOptions({ ...currentCompilerOptions, locale: "fr" });
 * ```
 *
 * @remark This is idempotent and will only initialise a given Monaco instance once if called multiple times.
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
  monaco.editor.onDidChangeMarkers((affectedUris) => {
    void translateMarkersForLanguage({ monaco, languageId: "javascript", affectedUris });
    void translateMarkersForLanguage({ monaco, languageId: "typescript", affectedUris });
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
  lastSetLanguageLocales[languageId] = newLocale;
  void translateMarkersForLanguage({ monaco, languageId });
}

async function translateMarkersForLanguage({
  monaco,
  languageId,
  affectedUris,
}: {
  monaco: MonacoModule;
  languageId: LanguageId;
  affectedUris?: readonly Uri[];
}): Promise<void> {
  // if we have a list of affected models then we check if any of them are of the language we are translating, otherwise we translate everything
  if (affectedUris) {
    const relevantModelsAffected = affectedUris.some((uri) => {
      return monaco.editor.getModel(uri)?.getLanguageId() === languageId;
    });
    if (!relevantModelsAffected) {
      return; // no models of the language we are translating were affected
    }
  }

  const targetLocale = lastSetLanguageLocales[languageId];
  if (targetLocale === "en") {
    return; // no translation needed, assume default markers are in english
  }

  try {
    // NOTE: assumes the JS/TS messages will always have the owner for their markers set as the language ID
    // NOTE: we assume the current markers are in english and previous custom markers have been removed when this is called
    const markers = monaco.editor.getModelMarkers({ owner: languageId });
    if (!markers.length) {
      return; // no markers to translate or we already translated them
    }

    const requiresTranslation = markers.some((marker) => !marker.tags?.includes(IS_TRANSLATED_TAG));
    if (!requiresTranslation) {
      return; // all markers have already been translated
    }

    const translatedMarkers = await translateMarkers({ markers, targetLocale });
    translatedMarkers
      // group markers by resource
      .reduce((resourceMarkersMap, marker) => {
        const resourceMarkers = resourceMarkersMap.get(marker.resource) || [];
        resourceMarkers.push(marker);
        resourceMarkersMap.set(marker.resource, resourceMarkers);
        return resourceMarkersMap;
      }, new Map<Uri, editor.IMarker[]>())
      // set translated markers for each model resource
      .forEach((translatedMarkersForModel, modelUri) => {
        const model = monaco.editor.getModel(modelUri);
        // not sure if non model resources can have markers but checking just in case
        if (model) {
          // NOTE: need to set the same owner so the language service can find and manage the markers during editing
          monaco.editor.setModelMarkers(model, languageId, translatedMarkersForModel);
        }
      });
  } catch (error) {
    console.error("translateDiagnosticMessageMarkers error", error);
  }
}

async function translateMarkers({
  markers,
  targetLocale,
}: {
  /**
   * @remark assumes the default markers are in english
   */
  markers: editor.IMarker[];
  targetLocale: string;
}) {
  const [englishDiagnosticMessageTemplatesMap, targetLocaleDiagnosticMessageTemplatesMap] =
    await Promise.all([
      getDiagnosticMessageTemplatesForLocale("en"),
      getDiagnosticMessageTemplatesForLocale(targetLocale),
    ]);

  return markers.map((marker) => {
    if (!marker.code) {
      return marker; // marker doesn't have a code so we cant translate, keep the original
    }
    if (marker.tags?.includes(IS_TRANSLATED_TAG)) {
      return marker; // marker has already been translated
    }

    const messageCode = Number(typeof marker.code === "object" ? marker.code.value : marker.code);
    const translatedMessage = translatedDiagnosticMessage({
      englishMessage: marker.message,
      englishMessageTemplate: englishDiagnosticMessageTemplatesMap[messageCode],
      localeMessageTemplate: targetLocaleDiagnosticMessageTemplatesMap[messageCode],
    });

    if (!translatedMessage) {
      return marker; // could not translate the message, so keep the original
    }

    return {
      ...marker,
      message: translatedMessage, // replace the message with the translated version
      tags: [...(marker.tags || []), IS_TRANSLATED_TAG], // add a tag to indicate this marker has been translated
    };
  });
}

function translatedDiagnosticMessage({
  englishMessage,
  englishMessageTemplate,
  localeMessageTemplate,
}: {
  englishMessage: string;
  localeMessageTemplate: string | undefined;
  englishMessageTemplate: string | undefined;
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
    console.error("no placeholder matches using regex found", {
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
  const placeholdersRegexText = escapeRegExp(englishMessageTemplate).replace(
    /\\{\d+\\}/g,
    (placeholder) => {
      const placeholderIndex = placeholder.replace(/\D/g, "");
      if (visitedPlaceholderIndexes.has(placeholderIndex)) {
        // placeholder has already been visited so we don't need to create a new capture group
        // duplicate capture group names will cause an error when creating the regex
        // example template: "'{0}' refers to a value, but is being used as a type here. Did you mean 'typeof {0}'?"
        return ".+";
      }
      visitedPlaceholderIndexes.add(placeholderIndex);
      // NOTE: we use named capture groups so we have a mapping from the regex matches to the placeholder index,
        // sometimes a higher placeholder index can be used before a lower one
      // NOTE: named capture group id needs to be a valid JS identifier (so cant be directly the index)
      return `(?<_${placeholderIndex}>.+)`;
    },
  );

  placeholdersRegex = new RegExp(placeholdersRegexText);
  messageTemplateToRegexCache.set(englishMessageTemplate, placeholdersRegex);
  return placeholdersRegex;
}

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
const reHasRegExpChar = RegExp(reRegExpChar.source);

/**
 * Escapes the `RegExp` special characters "^", "$", "\", ".", "*", "+",
 * "?", "(", ")", "[", "]", "{", "}", and "|" in `string`.
 *
 * @remark From lodash
 *
 * @since Lodash 3.0.0
 * @category String
 * @param {string} [string=''] The string to escape.
 * @returns {string} Returns the escaped string.
 * @see escape, escapeRegExp, unescape
 * @example
 *
 * escapeRegExp('[lodash](https://lodash.com/)')
 * // => '\[lodash\]\(https://lodash\.com/\)'
 */
function escapeRegExp(string: string): string {
  return string && reHasRegExpChar.test(string)
    ? string.replace(reRegExpChar, "\\$&")
    : string || "";
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
