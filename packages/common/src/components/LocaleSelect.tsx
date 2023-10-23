/* eslint-disable functional-core/purity */
import { useRef } from "react";
import { Select } from "@chakra-ui/react";
import localesMetadata from "monaco-editor-typescript-locales/locales/metadata.json";

type LocaleSelectProps = {
  id?: string;
  defaultLocale?: string;
  onChange: (newLocale: string) => void;
};

/**
 * @remark These are Typescript locales and Monaco might not support all of them and will fallback to English,
 * but the Typescript/Javascript diagnostic messages will be in the selected locale
 */
export default function LocaleSelect({ defaultLocale, onChange, ...props }: LocaleSelectProps) {
  const intlDisplayName = useRef(
    new Intl.DisplayNames([window.navigator.language || "en"], { type: "language" }),
  ).current;

  return (
    <Select
      defaultValue={defaultLocale}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      {...props}
    >
      {localesMetadata.availableLocales.map((locale) => (
        <option key={locale} value={locale} style={{ color: "black" }}>
          {locale} - {intlDisplayName.of(locale)}
        </option>
      ))}
    </Select>
  );
}
