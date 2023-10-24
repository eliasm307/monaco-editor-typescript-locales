"use client";

import { Grid, HStack, Heading, Text, Textarea, VStack } from "@chakra-ui/react";
import EditorPanel from "@packages/common/src/components/EditorPanel";
import {
  createIdForEditorIndex,
  getDefaultsForLanguageId,
  getLanguageFromUrlForEditorIndex,
  getLocaleFromUrl,
  logEvents,
  serialiseMarkers,
} from "../../utils";
import { useEffect, useState } from "react";
import { Monaco } from "@monaco-editor/react";
import { editor } from "monaco-editor";
import LocaleSelector from "@packages/common/src/components/LocaleSelect";
import AllMarkersDataPanel from "../../components/AllMarkersDataPanel";

const JS_CODE_WITH_ISSUES = `const f = x;`;

export default function Page() {
  const [isMounted, setIsMounted] = useState(false);
  const [monaco, setMonaco] = useState<Monaco>();
  const [currentMarkers, setCurrentMarkers] = useState<editor.IMarker[]>([]);

  useEffect(() => {
    if (!monaco) return;

    logEvents({ type: "Monaco", instance: monaco.editor });

    monaco.editor.onDidChangeMarkers((uris) => {
      const markers = [];
      for (const uri of uris) {
        markers.push(...monaco.editor.getModelMarkers({ resource: uri }));
      }
      setCurrentMarkers(markers);
    });

    monaco.editor.onDidCreateEditor((editor) => {
      console.log("editor created:", editor);
    });

    monaco.editor.getEditors().forEach((editor) => {
      logEvents({ type: "Editor", instance: editor });
    });
  }, [monaco]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const languageId = getLanguageFromUrlForEditorIndex(0);
  const locale = getLocaleFromUrl();
  const editorId = createIdForEditorIndex(0);

  return (
    <Grid templateColumns='1fr 1fr' height='100dvh'>
      <EditorPanel
        editor={{
          id: editorId,
          locale,
          languageId,
          defaultValue: JS_CODE_WITH_ISSUES,
          onMonacoLoaded: setMonaco,
          onEditorMounted: (editor) => {
            window[editorId] = editor;
            editor?.onDidChangeModelContent((e) => {
              setCurrentMarkers([]);
            });
          },
        }}
      />
      <VStack height='100%' overflow='hidden'>
        <HStack>
          <Text>Locale</Text>
          <LocaleSelector
            id='editor-locale-select'
            defaultLocale={locale}
            onChange={(newLocale) => {
              if (!monaco) return;
              const defaults = getDefaultsForLanguageId({ monaco, languageId });
              defaults.setCompilerOptions({
                ...defaults.getCompilerOptions(),
                locale: newLocale,
              });
            }}
          />
        </HStack>
        <AllMarkersDataPanel markers={currentMarkers} flex={1} />
      </VStack>
    </Grid>
  );
}
