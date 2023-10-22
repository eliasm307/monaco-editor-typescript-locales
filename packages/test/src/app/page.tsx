"use client";

import {
  Box,
  Center,
  Grid,
  HStack,
  Heading,
  Select,
  Spinner,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { Editor, loader } from "@monaco-editor/react";
import { register } from "monaco-editor-typescript-locales/src/index";
import localesMetadata from "monaco-editor-typescript-locales/locales/metadata.json";
import { useEffect, useRef, useState } from "react";
import { Colours } from "./constants";

const BREAK_POINT = "md";

function getLocaleFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const locale = urlParams.get("locale");
  return locale || "en";
}

function setLocaleInUrl(locale: string) {
  if (typeof window === "undefined") return;
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.set("locale", locale);
  window.history.replaceState({}, "", `${window.location.pathname}?${urlParams}`);

  // NOTE: need to reload so `loader` can be reinitialized with the new locale
  window.location.reload();
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const locale = getLocaleFromUrl();

  return (
    <Grid
      as='main'
      height='100dvh'
      width='100dvw'
      templateColumns='1fr'
      templateRows='auto 1fr'
      p={0}
    >
      <Header locale={locale} setLocale={setLocaleInUrl} />
      <Editors locale={locale} setLocale={setLocaleInUrl} />
    </Grid>
  );
}

function Header({ locale, setLocale }: { locale: string; setLocale: (locale: string) => void }) {
  // todo add theme switcher
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
        <LocaleSelect defaultLocale={locale} onChange={setLocale} />
      </HStack>
    </VStack>
  );
}

function Editors({ locale, setLocale }: { locale: string; setLocale: (locale: string) => void }) {
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
    console.log("Monaco editor init with locale", locale);
    loader.init().then(() => {
      console.log("Monaco editor init done");
      setState("idle");
    });
  }, [locale]);

  if (state === "loading")
    return (
      <Center>
        <Spinner />
      </Center>
    );

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
      <EditorPane languageId='javascript' locale={locale} setLocale={setLocale} />
      <EditorPane languageId='javascript' locale={locale} setLocale={setLocale} />
      <EditorPane languageId='typescript' locale={locale} setLocale={setLocale} />
      <EditorPane languageId='typescript' locale={locale} setLocale={setLocale} />
    </Grid>
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

/**
 * @remark These are Typescript locales and Monaco might not support all of them and will fallback to English,
 * but the Typescript/Javascript diagnostic messages will be in the selected locale
 */
function LocaleSelect({
  defaultLocale,
  onChange,
}: {
  defaultLocale?: string;
  onChange: (newLocale: string) => void;
}) {
  const intlDisplayName = useRef(
    new Intl.DisplayNames([window.navigator.language || "en"], { type: "language" }),
  ).current;

  return (
    <Select
      defaultValue={defaultLocale}
      required
      isRequired
      onChange={(event) => onChange(event.target.value)}
    >
      {localesMetadata.availableLocales.map((locale) => (
        <option key={locale} value={locale} style={{ color: "black" }}>
          {locale} - {intlDisplayName.of(locale)}
        </option>
      ))}
    </Select>
  );
}
