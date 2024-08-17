"use client";

import {Grid, HStack, Text, VStack} from "@chakra-ui/react";
import EditorPanel from "@packages/common/src/components/EditorPanel";
import {useEffect, useState} from "react";
import type {Monaco} from "@monaco-editor/react";
import type {editor} from "monaco-editor";
import LocaleSelector from "@packages/common/src/components/LocaleSelect";
import {
  createIdForEditorIndex,
  getDefaultsForLanguageId,
  getLanguageFromUrlForEditorIndex,
  getLocaleFromUrl,
  logEvents,
} from "../../utils";
import AllMarkersDataPanel from "../../components/AllMarkersDataPanel";

const JS_CODE_WITH_ISSUES = `const`;

export default function Page() {
  const [isMounted, setIsMounted] = useState(false);
  const [monaco, setMonaco] = useState<Monaco>();
  const [allMarkers, setCurrentMarkers] = useState<editor.IMarker[]>([]);

  useEffect(() => {
    if (!monaco) return;

    logEvents({type: "Monaco", instance: monaco.editor});

    monaco.editor.onDidChangeMarkers(() => {
      setCurrentMarkers(monaco.editor.getModelMarkers({}));
    });

    function setupEditor(editor: editor.ICodeEditor) {
      editor?.onDidChangeModelContent(() => {
        setCurrentMarkers([]);
      });
    }

    monaco.editor.getEditors().forEach(setupEditor);
    monaco.editor.onDidCreateEditor(setupEditor);
  }, [monaco]);

  useEffect(() => {});

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const locale = getLocaleFromUrl();
  const editor1Id = createIdForEditorIndex(0);
  const editor2Id = createIdForEditorIndex(1);

  return (
    <Grid templateColumns='1fr 1fr' height='100dvh'>
      <VStack height='inherit'>
        <EditorPanel
          flex={1}
          editor={{
            id: editor1Id,
            locale,
            languageId: getLanguageFromUrlForEditorIndex(0),
            defaultValue: JS_CODE_WITH_ISSUES,
            onMonacoLoaded: setMonaco,
            onEditorMounted: (editor) => {
              window[editor1Id] = editor;
            },
          }}
        />
        <EditorPanel
          flex={1}
          editor={{
            id: editor2Id,
            locale,
            languageId: getLanguageFromUrlForEditorIndex(1),
            defaultValue: JS_CODE_WITH_ISSUES,
            onEditorMounted: (editor) => {
              window[editor2Id] = editor;
            },
          }}
        />
      </VStack>
      <VStack height='inherit'>
        <HStack>
          <Text>Locale</Text>
          <LocaleSelector
            id='editor-locale-select'
            defaultLocale={locale}
            onChange={(newLocale) => {
              if (!monaco) return;

              const uniqueLanguageIds = new Set(
                [0, 1].map((index) => getLanguageFromUrlForEditorIndex(index)),
              );

              for (const languageId of uniqueLanguageIds) {
                const defaults = getDefaultsForLanguageId({monaco, languageId});
                defaults.setCompilerOptions({
                  ...defaults.getCompilerOptions(),
                  locale: newLocale,
                });
              }
            }}
          />
        </HStack>
        <AllMarkersDataPanel markers={allMarkers} flex={1} />
      </VStack>
    </Grid>
  );
}
