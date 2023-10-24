"use client";

import {
  Center,
  Checkbox,
  Grid,
  HStack,
  Heading,
  Spinner,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { loader } from "@monaco-editor/react";
import localesMetadata from "monaco-editor-typescript-locales/locales/metadata.json";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorPanelProps } from "@packages/common/src/components/EditorPanel";
import EditorPanel from "@packages/common/src/components/EditorPanel";
import LocaleSelect from "@packages/common/src/components/LocaleSelect";
import { Colours } from "./constants";

// todo update site icons

const BREAK_POINT = "md";

function getLocaleFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const locale = urlParams.get("locale");
  return locale || "en";
}

type UrlParamKey = "locale" | "reloadOnChange";

function setUrlParam(key: UrlParamKey, value: string | number | boolean) {
  if (typeof window === "undefined") return;
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.set(key, String(value));
  window.history.replaceState({}, "", `${window.location.pathname}?${urlParams}`);
}

function getUrlParam(key: UrlParamKey) {
  if (typeof window === "undefined") return;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(key);
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setLocale(getLocaleFromUrl());
  }, []);

  if (!mounted || !locale) return null;

  return (
    <Grid
      as='main'
      height='100dvh'
      width='100dvw'
      templateColumns='1fr'
      templateRows='auto 1fr'
      p={0}
    >
      <Header locale={locale} setLocale={setLocale} />
      <Editors locale={locale} />
    </Grid>
  );
}

function Header({ locale, setLocale }: { locale: string; setLocale: (locale: string) => void }) {
  // todo add light/dark theme switcher

  const reloadOnChangeRef = useRef(getUrlParam("reloadOnChange") === "true");

  const onLocaleChange = useCallback((newLocale: string) => {
    setLocale(newLocale);
    setUrlParam("locale", newLocale);
    if (reloadOnChangeRef.current) {
      // NOTE: need to reload so `loader` can be reinitialized with the new locale
      // NOTE: this is not required to change locale for TS/JS diagnostic messages
      window.location.reload();
    }
  }, []);

  const onReloadCheckBoxChange: React.ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
    reloadOnChangeRef.current = e.target.checked;
    setUrlParam("reloadOnChange", e.target.checked);
  }, []);

  return (
    <VStack
      className='header-container'
      width='100%'
      position='relative'
      zIndex={1}
      background={Colours.monacoPrimary}
      color='white'
      p={3}
    >
      <Heading as='h1' fontSize='x-large' flex={1}>
        Monaco Editor Typescript Locales Demo
      </Heading>
      <HStack>
        <Tooltip
          label={`Diagnostic messages translated using Typescript Version: ${localesMetadata.generatedFromTypescriptVersion}`}
        >
          <Text whiteSpace='nowrap'>Current Locale:</Text>
        </Tooltip>
        <LocaleSelect defaultLocale={locale} onChange={onLocaleChange} />
        <Tooltip label='The Typescript/JavaScript messages update when the locale is changed however other editor text requires a refresh to update the text to the new locale'>
          <Checkbox flex='none' onChange={onReloadCheckBoxChange}>
            Reload on Change
          </Checkbox>
        </Tooltip>
      </HStack>
    </VStack>
  );
}

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

function Editors({ locale }: { locale: string }) {
  const [state, setState] = useState<"idle" | "loading">("idle");

  useEffect(() => {
    loader.config({
      "vs/nls": { availableLanguages: { "*": locale === "en" ? undefined : locale } },
    });

    const existingInstance = loader.__getMonacoInstance();
    if (existingInstance) {
      existingInstance.editor.getEditors().forEach((editor) => {
        editor.dispose();
      });
    }

    setState("loading");
    void loader.init().then(() => {
      setState("idle");
    });
  }, [locale]);

  if (state === "loading") {
    return (
      <Center>
        <Spinner />
      </Center>
    );
  }

  const baseEditorPanelProps: Partial<EditorPanelProps> = {
    height: {
      base: "auto",
      [BREAK_POINT]: "100%",
    },
  };

  return (
    <Grid
      className='editors-container'
      position='relative'
      zIndex={2}
      height={{ base: "auto", [BREAK_POINT]: "100%" }}
      templateColumns={{ base: "1fr", [BREAK_POINT]: "1fr 1fr" }}
      templateRows={{ base: "1fr", [BREAK_POINT]: "1fr 1fr" }}
      transition='none !important'
      width='100%'
      maxWidth='100%'
      overflow='visible' // so editor tooltips aren't clipped
      gap={3}
      p={3}
    >
      <EditorPanel
        {...baseEditorPanelProps}
        editor={{ languageId: "javascript", locale, defaultValue: JS_CODE_WITH_ISSUES }}
      />
      <EditorPanel
        {...baseEditorPanelProps}
        editor={{ languageId: "javascript", locale, defaultValue: JS_CODE_WITH_ISSUES }}
      />
      <EditorPanel
        {...baseEditorPanelProps}
        editor={{ languageId: "typescript", locale, defaultValue: JS_CODE_WITH_ISSUES }}
      />
      <EditorPanel
        {...baseEditorPanelProps}
        editor={{ languageId: "typescript", locale, defaultValue: JS_CODE_WITH_ISSUES }}
      />
    </Grid>
  );
}
