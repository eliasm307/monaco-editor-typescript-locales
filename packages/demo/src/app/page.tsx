"use client";

import { Box, Grid, HStack, Heading, Select, Text, VStack } from "@chakra-ui/react";
import { Editor } from "@monaco-editor/react";
import { register } from "monaco-editor-typescript-locales/src/index";
import localesMetadata from "monaco-editor-typescript-locales/locales/metadata.json";
import { useEffect, useRef } from "react";
import { editor } from "monaco-editor";

const BREAK_POINT = "md";

export default function Home() {
  return (
    <Grid as='main' templateColumns='1fr' templateRows='auto 1fr' height='100dvh' p={3}>
      <HStack
        as='nav'
        p={3}
        flexDirection={{
          base: "column",
          [BREAK_POINT]: "row",
        }}
      >
        <Heading as='h1' fontSize='x-large' flex={1}>
          Monaco Editor Typescript Locales Util Demo
        </Heading>
        <Text>
          Locales from Typescript Version: {localesMetadata.generatedFromTypescriptVersion}
        </Text>
      </HStack>
      <Grid
        height={{ base: "auto", [BREAK_POINT]: "100%" }}
        templateColumns={{ base: "1fr", [BREAK_POINT]: "1fr 1fr" }}
        templateRows={{ base: "1fr", [BREAK_POINT]: "1fr 1fr" }}
        width='100%'
      >
        <EditorPane languageId='javascript' defaultLocale='en' />
        <EditorPane languageId='typescript' defaultLocale='en' />
        <EditorPane languageId='javascript' defaultLocale='fr' />
        <EditorPane languageId='typescript' defaultLocale='es' />
      </Grid>
    </Grid>
  );
}

const JS_CODE_WITH_ISSUES = `
const a: str = 1;

c =;

return;

fnc() {
  // this produces a parser error below
  // which doesn't get translated
`;

type EditorPaneProps = {
  languageId: "javascript" | "typescript";
  defaultLocale?: string;
};

function EditorPane({ languageId, defaultLocale }: EditorPaneProps) {
  const monacoRef = useRef<typeof import("monaco-editor")>();
  const resizeObserverRef = useRef<ResizeObserver>();

  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, []);

  return (
    <VStack
      as='section'
      height={{
        [BREAK_POINT]: "100%",
      }}
      minHeight='40dvh'
      width={{
        base: "99%",
        [BREAK_POINT]: "99%",
      }}
      transition='none'
    >
      <HStack width='100%' px={3}>
        <Heading as='h2' flex='none' size='md'>
          {languageId} Locale:{" "}
        </Heading>
        <Select
          placeholder='Select option'
          defaultValue={defaultLocale}
          onChange={(event) => {
            if (!monacoRef.current) return;
            const languageDefaults = getLanguageIdDefaults({
              monaco: monacoRef.current,
              languageId,
            });

            languageDefaults.setCompilerOptions({
              ...languageDefaults.getCompilerOptions(),
              locale: event.target.value,
            });
            // setLanguageLocale({
            //   monaco: monacoRef.current,
            //   model: languageId,
            //   locale: event.target.value,
            // });
          }}
        >
          {localesMetadata.availableLocales.map((locale) => (
            <option key={locale} value={locale}>
              {locale}
            </option>
          ))}
        </Select>
      </HStack>
      <Editor
        defaultLanguage={languageId}
        defaultValue={JS_CODE_WITH_ISSUES}
        options={{
          scrollBeyondLastLine: false,
          // automaticLayout: true,
          minimap: {
            enabled: false,
          },
        }}
        beforeMount={(monaco) => {
          monacoRef.current = monaco;
          if (defaultLocale) {
            register(monacoRef.current);
            // setLanguageLocale({ monaco, model: languageId, locale: defaultLocale });
          }
        }}
        onMount={(editor) => {
          resizeObserverRef.current = new ResizeObserver(([entry]) => {
            editor.layout(entry.contentRect);
          });
        }}
      />
    </VStack>
  );
}

function getLanguageIdDefaults({
  monaco,
  languageId,
}: {
  monaco: typeof import("monaco-editor");
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
