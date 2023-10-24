import type { LanguageId, MonacoModule } from "@packages/common/src/types";
import type { editor, languages } from "monaco-editor";
import { TEST_SITE_BASE_URL } from "./constants";
import type { EditorId, TestMarkerData } from "./types";

export function getLocaleFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const locale = urlParams.get("locale");
  return locale || "en";
}

export function getLanguageFromUrlForEditorIndex(editorIndex: number): LanguageId {
  const urlParams = new URLSearchParams(window.location.search);
  const editorLanguage = urlParams.get(`editor${editorIndex}Language`) as LanguageId | null;
  return editorLanguage || "javascript";
}

export const TYPESCRIPT_WORKER_LANGUAGE_IDS = ["typescript", "javascript"] as const;
export function isRelevantMarker(marker: editor.IMarker): boolean {
  return TYPESCRIPT_WORKER_LANGUAGE_IDS.some((relevantLanguageId) => {
    return marker.owner === relevantLanguageId || marker.owner.startsWith(`${relevantLanguageId}-`);
  });
}

type UrlConfigMap = Record<string, string | number | boolean | null | undefined>;

export function createTestPageUrlUsingConfig({
  path,
  config,
}: {
  path: string;
  config: UrlConfigMap;
}) {
  const url = new URL(path, TEST_SITE_BASE_URL);
  Object.entries(config).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value.toString());
    }
  });
  return url.toString();
}

function localHostPortIsInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = require("http").createServer();
    server.on("error", () => {
      server.close();
      resolve(true);
    });
    server.on("listening", () => {
      console.warn(`Nothing is running on port "${port}"`);
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

export async function assertTestSiteIsRunning() {
  const port = Number(new URL(TEST_SITE_BASE_URL).port);
  const isRunning = await localHostPortIsInUse(port);
  if (!isRunning) {
    throw new Error(
      `Test site is not running (expected on ${TEST_SITE_BASE_URL}), please run "npm run dev" in a separate terminal`,
    );
  }
}

const ADD_LISTENER_METHOD_REGEX = /^on[A-Z]/;
export function logEvents({
  type,
  instance,
}: {
  type: "Editor" | "Monaco";
  instance: Record<any, any>;
}): void {
  Object.keys(instance)
    .filter((key) => ADD_LISTENER_METHOD_REGEX.test(key))
    .forEach((key) => {
      const value = instance[key];
      if (typeof value === "function") {
        value.call(instance, (...args: unknown[]) => {
          // eslint-disable-next-line no-console
          console.log(`${type} event "${key}"`, args);
        });
      }
    });
}

export function serialiseMarkers(markers: editor.IMarker[]): string {
  const markersData: TestMarkerData[] = markers.map((marker) => {
    const { message, owner, resource, code } = marker;
    const codeAsString = typeof code === "string" ? code : code?.value;
    return { code: codeAsString, message, owner, resource: resource.path };
  });
  return JSON.stringify(markersData, null, 2);
}

export function getDefaultsForLanguageId({
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

export function createIdForEditorIndex(editorIndex: number): EditorId {
  return `editor${editorIndex}`;
}
