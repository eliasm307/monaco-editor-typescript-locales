"use client";

import { Grid, HStack, Heading, Text, Textarea, VStack } from "@chakra-ui/react";
import EditorPanel from "@packages/common/src/components/EditorPanel";
import {
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

const JS_CODE_WITH_ISSUES = `const str: number = "";

const function = 5;

const a: str = 1;

c =;

return;

fnc() {
  // this produces a parser error message below,
  // not from the Typescript worker,
  // which doesn't get translated
`;

export default function Page() {
  const [isMounted, setIsMounted] = useState(false);
  const [monaco, setMonaco] = useState<Monaco>();
  const [editor, setEditor] = useState<editor.IStandaloneCodeEditor>();
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
    editor?.onDidChangeModelContent((e) => {
      setCurrentMarkers([]);
    });
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const languageId = getLanguageFromUrlForEditorIndex(0);

  return (
    <Grid templateColumns='1fr 1fr' height='100dvh'>
      <EditorPanel
        editor={{
          locale: getLocaleFromUrl(),
          languageId,
          defaultValue: JS_CODE_WITH_ISSUES,
          onMonacoLoaded: setMonaco,
          onEditorMounted: setEditor,
        }}
      />
      <VStack height='100%' overflow='hidden'>
        <HStack>
          <Text>Locale</Text>
          <LocaleSelector
            id='editor-locale-select'
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
        <Heading as='h2' size='md'>
          Value Input
        </Heading>
        <Textarea
          id='editor-proxy-value-input'
          onChange={(e) => {
            editor?.getModel()?.setValue(e.target.value);
          }}
        />
        <Heading as='h2' size='md'>
          Markers
        </Heading>
        {currentMarkers.length && (
          <Text
            as='pre'
            id='editor-markers-data-container'
            flex={1}
            overflow='auto'
            whiteSpace='pre-wrap'
          >
            {serialiseMarkers(currentMarkers)}
          </Text>
        )}
      </VStack>
    </Grid>
  );
}
