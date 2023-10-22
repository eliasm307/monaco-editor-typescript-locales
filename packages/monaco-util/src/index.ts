/* eslint-disable functional-core/purity */
import type { editor, languages, Uri } from "monaco-editor";
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

  const languageIdAndDefaultsList: {
    languageId: LanguageId;
    defaults: languages.typescript.LanguageServiceDefaults;
  }[] = [
    { languageId: "typescript", defaults: monaco.languages.typescript.typescriptDefaults },
    { languageId: "javascript", defaults: monaco.languages.typescript.javascriptDefaults },
  ];

  // setup JS/TS message translation on locale change
  languageIdAndDefaultsList.forEach(({ languageId, defaults }) => {
    defaults.onDidChange(() => {
      const newLocale = defaults.getCompilerOptions().locale || "en";
      onLanguageLocaleChange({ monaco, languageId, newLocale });
    });
  });

  // setup JS/TS message translation on content change
  // NOTE: assuming monaco fires this with debouncing etc so its performant to handle this directly without further buffering etc
  monaco.editor.onDidChangeMarkers((modelUris) => {
    // const models = modelUris.map((uri) => monaco.editor.getModel(uri)).filter(isTruthy);

    // translate changed model markers
    void translateMarkers({
      monaco,
      languageId: "javascript",
      // models
    });
    void translateMarkers({
      monaco,
      languageId: "typescript",
      // models
    });
  });
}

// function isTruthy<T>(value: T | 0 | "" | false): value is NonNullable<T> {
//   return Boolean(value);
// }

// default is english
const currentLanguageLocales: Record<LanguageId, string> = {
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
  // register(monaco);

  const oldLocale = currentLanguageLocales[languageId];
  if (oldLocale === newLocale) {
    return; // no change
  }

  // Remove all custom markers from previous locale and update current locale markers
  monaco.editor.removeAllMarkers(`${languageId}-${oldLocale}`);
  currentLanguageLocales[languageId] = newLocale;

  // todo test it refreshes affected model markers on locale change
  // const affectedModels = monaco.editor
  //   .getModels()
  //   .filter((model) => model.getLanguageId() === languageId);

  // todo is there a way to restore the default markers after a change?
  // todo which way is better to refresh the markers?

  // affectedModels.forEach((affectedModel) => {
  //   // todo does this work?
  //   affectedModel.setValue(affectedModel.getValue()); // force a refresh of the markers with the new locale
  // });

  // NOTE: this is triggered by a compiler options change which also seems to refresh the markers, so we assume we will have the default english markers at this point
  void translateMarkers({
    monaco,
    languageId,
    //  models: affectedModels
  });
}

// todo instead of driving this from language settings which means all models are affected by a locale change,
// we could track individual locales for each model so each model can have its own locale
// function getLanguageLocale({
//   monaco,
//   languageId,
// }: {
//   monaco: MonacoModule;
//   languageId: LanguageId;
// }): string {
//   switch (languageId) {
//     case "typescript":
//       return monaco.languages.typescript.typescriptDefaults.getCompilerOptions().locale || "en";
//     case "javascript":
//       return monaco.languages.typescript.javascriptDefaults.getCompilerOptions().locale || "en";
//     default:
//       throw Error(`Unsupported language ID "${languageId}"`);
//   }
// }

async function translateMarkers({
  monaco,
  languageId, // models,
}: {
  monaco: MonacoModule;
  languageId: LanguageId;
  // models: editor.ITextModel[];
}): Promise<void> {
  const targetLocale = currentLanguageLocales[languageId];
  if (targetLocale === "en") {
    return; // no translation needed
  }

  // todo since the method to remove markers works on all models,
  // so  when we translate the markers we need to consider all the models at the same time to produce one set of output markers
  // const translatableModels = models.filter((model) => model.getLanguageId() === languageId);
  // if (!translatableModels.length) {
  //   return; // nothing to translate
  // }

  // todo investigate issue when there are multiple editors and markers are doubled up

  // NOTE: assumes the JS/TS messages will always have the owner for their markers set as the language ID
  // NOTE: we assume the current markers are in english and previous custom markers have been removed when this is called
  // const defaultMarkers = monaco.editor.getModelMarkers();
  // if (!defaultMarkers.length) {
  //   return; // no markers to translate or we already translated them
  // }
  // console.log("translateDiagnosticMessageMarkers", {
  //   languageId,
  //   defaultMarkers,
  // });

  try {
    // translatableModels.map(async (model) => {
    //   const defaultMarkers = monaco.editor.getModelMarkers({
    //     resource: model.uri,
    //     owner: languageId,
    //   });
    //   const translatedMarkers = await translateTypescriptWorkerMarkers({
    //     defaultMarkers,
    //     targetLocale,
    //   });

    //   monaco.editor.setModelMarkers(model, languageId, []); // remove english markers
    //   monaco.editor.setModelMarkers(model, `${languageId}-${targetLocale}`, translatedMarkers); // replace with translated markers
    // });

    // NOTE: default markers are in English
    const defaultMarkers = monaco.editor.getModelMarkers({ owner: languageId });
    if (!defaultMarkers.length) {
      return; // no markers to translate or we already translated them
    }
    const translatedMarkers = await translateTypescriptWorkerMarkers({
      defaultMarkers,
      targetLocale,
    });

    // this is so the user only sees TS/JS messages in their language and not the original english message also
    // NOTE: if a message cant be translated it will be maintained in english
    monaco.editor.removeAllMarkers(languageId); // remove english markers after translation but before setting the new translated markers

    // replace with translated markers
    // NOTE: need to set a different owner ID as setting the markers here will trigger the marker change listener which recursively triggers this method again,
    // but with a non ts/js owner the markers wont be processed again as we filter for js/ts markers specifically,
    // so there will be no markers found and the markers aren't set again

    translatedMarkers
      // group markers by resource
      .reduce((resourceMarkersMap, marker) => {
        const resourceMarkers = resourceMarkersMap.get(marker.resource) || [];
        resourceMarkers.push(marker);
        resourceMarkersMap.set(marker.resource, resourceMarkers);
        return resourceMarkersMap;
      }, new Map<Uri, editor.IMarker[]>())
      // set markers for each model resource
      .forEach((markers, modelUri) => {
        const model = monaco.editor.getModel(modelUri);
        if (model) {
          // not sure if non model resources can have markers but checking just in case
          monaco.editor.setModelMarkers(model, `${languageId}-${targetLocale}`, markers);
        }
      });
  } catch (error) {
    console.error("translateDiagnosticMessageMarkers error", error);
  }
}

async function translateTypescriptWorkerMarkers({
  defaultMarkers,
  targetLocale,
}: {
  /**
   * @remark assumes the default markers are in english
   */
  defaultMarkers: editor.IMarker[];
  targetLocale: string;
}) {
  const [englishDiagnosticMessageTemplatesMap, targetLocaleDiagnosticMessageTemplatesMap] =
    await Promise.all([
      getDiagnosticMessageTemplatesForLocale("en"),
      getDiagnosticMessageTemplatesForLocale(targetLocale),
    ]);

  return (
    defaultMarkers
      // .filter((marker) => TYPESCRIPT_WORKER_LANGUAGE_IDS.includes(marker.owner as LanguageId))
      .map((defaultMarker) => {
        // if (!TYPESCRIPT_WORKER_LANGUAGE_IDS.includes(marker.owner as LanguageId)) {
        //   return marker; // not a JS/TS marker so we cant translate but we need to keep it
        // }
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
      })
  );
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
      const placeholderIndex = placeholderIdentifier.replace("_", "");
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
    // NOTE: named capture group id needs to be a valid JS identifier (so cant be directly the index)
    placeholdersRegexText = escapeRegExp(englishMessageTemplate).replace(
      /\\{(\d+)\\}/g,
      "(?<_$1>.+)",
    );
    messageTemplateToRegexTextCache.set(englishMessageTemplate, placeholdersRegexText);
  }

  // this is stateful as it uses the `g` flag so we don't cache the regex itself but we cache the content
  return new RegExp(placeholdersRegexText, "g");
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
