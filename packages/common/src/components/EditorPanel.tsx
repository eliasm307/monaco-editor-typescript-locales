import { register } from "monaco-editor-typescript-locales/src";
import { useState, useRef, useEffect } from "react";
import type { BoxProps } from "@chakra-ui/react";
import { Box, Heading, VStack } from "@chakra-ui/react";
import { Editor } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type { LanguageId, MonacoModule } from "../types";
import { getLanguageIdDefaults } from "../utils";

export type EditorPanelProps = BoxProps & {
  editor: {
    id?: string;
    languageId: LanguageId;
    locale?: string;
    defaultValue: string;
    onMonacoLoaded?: (monaco: MonacoModule) => void;
    onEditorMounted?: (editor: editor.IStandaloneCodeEditor) => void;
  };
};

export default function EditorPanel({
  editor: { id, languageId, locale, defaultValue, onMonacoLoaded, onEditorMounted },
  ...boxProps
}: EditorPanelProps) {
  const [monaco, setMonaco] = useState<typeof import("monaco-editor")>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!monaco) return;
    const languageDefaults = getLanguageIdDefaults({ monaco, languageId });

    // update compiler options `locale` and keep other existing options
    languageDefaults.setCompilerOptions({
      ...languageDefaults.getCompilerOptions(),
      locale,
    });
  }, [locale, languageId, monaco]);

  return (
    <VStack
      className='editor-pane'
      ref={containerRef}
      as='section'
      height='100%'
      minHeight='40dvh'
      width='99%' // monaco editor doesn't like 100% width, ie its not responsive when decreasing width but works when increasing width 🤷🏾‍♂️
      transition='none !important'
      overflow='visible' // so editor tooltips aren't clipped
      {...boxProps}
    >
      <Heading as='h2' width='100%' flex='none' size='sm' textAlign='center'>
        {getLanguageDisplayName(languageId)} Editor {id && `(${id})`}
      </Heading>
      <Box
        className='monaco-editor-container'
        outline='1px solid rgba(0,0,0,0.2)'
        width='100%'
        height='100%'
      >
        <Editor
          defaultLanguage={languageId}
          defaultValue={defaultValue}
          defaultPath={id}
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
          }}
          beforeMount={(monacoInstanceInstance) => {
            register(monacoInstanceInstance);
            onMonacoLoaded?.(monacoInstanceInstance);
            setMonaco(monacoInstanceInstance);
          }}
          onMount={(editorInstance) => {
            onEditorMounted?.(editorInstance);
          }}
        />
      </Box>
    </VStack>
  );
}

function getLanguageDisplayName(languageId: string) {
  switch (languageId) {
    case "typescript":
      return "TypeScript";
    case "javascript":
      return "JavaScript";
    default:
      throw Error(`Unsupported language ID "${languageId}"`);
  }
}
