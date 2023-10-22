import { register } from "monaco-editor-typescript-locales/src";
import { useState, useRef, useEffect } from "react";
import type { BoxProps } from "@chakra-ui/react";
import { Box, Heading, VStack } from "@chakra-ui/react";
import { Editor } from "@monaco-editor/react";
import type { Monaco } from "../types";

export type EditorPanelProps = BoxProps & {
  editor: {
    languageId: "javascript" | "typescript";
    locale?: string;
    value: string;
    onMonacoLoaded?: (monaco: Monaco) => void;
  };
};

export default function EditorPanel({
  editor: { languageId, locale, value, onMonacoLoaded },
  ...boxProps
}: EditorPanelProps) {
  const [monaco, setMonaco] = useState<typeof import("monaco-editor")>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!monaco) return;
    const languageDefaults = getLanguageIdDefaults({
      monaco,
      languageId,
    });

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
        {getLanguageDisplayName(languageId)} Editor
      </Heading>
      <Box
        className='monaco-editor-container'
        outline='1px solid rgba(0,0,0,0.2)'
        width='100%'
        height='100%'
      >
        <Editor
          key={`${languageId}-${locale}`} // force remount when locale changes
          defaultLanguage={languageId}
          defaultValue={value}
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
          }}
          beforeMount={(monacoInstanceInstance) => {
            register(monacoInstanceInstance);
            onMonacoLoaded?.(monacoInstanceInstance);
            setMonaco(monacoInstanceInstance);
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

function getLanguageIdDefaults({ monaco, languageId }: { monaco: Monaco; languageId: string }) {
  switch (languageId) {
    case "typescript":
      return monaco.languages.typescript.typescriptDefaults;
    case "javascript":
      return monaco.languages.typescript.javascriptDefaults;
    default:
      throw Error(`Unsupported language ID "${languageId}"`);
  }
}
