import type {MonacoModule} from "./types";

export function getLanguageIdDefaults({
  monaco,
  languageId,
}: {
  monaco: MonacoModule;
  languageId: string;
}) {
  switch (languageId) {
    case "typescript":
      return monaco.languages.typescript.typescriptDefaults;
    case "javascript":
      return monaco.languages.typescript.javascriptDefaults;
    default:
      throw Error(`Unsupported language ID "${languageId}"`);
  }
}
