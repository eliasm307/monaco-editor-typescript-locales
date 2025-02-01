[![npm version](https://img.shields.io/npm/v/monaco-editor-typescript-locales.svg)](https://www.npmjs.com/package/monaco-editor-typescript-locales)

# monaco-editor-typescript-locales

## Problem

The locale of the [Monaco editor](https://github.com/microsoft/monaco-editor) can be configured during load, e.g.:

```js
// set locale to German
require.config({"vs/nls": {availableLanguages: {"*": "de"}}});
```

However, currently this only translates the Monaco editor UI itself and not the diagnostic messages from the Typescript worker that provides language functionality to JavaScript and TypeScript in the editor.

Below is an example of what this means, where the Monaco editor locale is set to German and an error exists in the JavaScript code. As you can see, the text for editor actions (ie from the Monaco editor UI) is correctly translated but the error message (ie diagnostic messages from the TypeScript worker) are still in English.

![Monaco editor localised to German with error that is not translated](/packages/monaco-util/assets/monaco-without-translated-message.png)

You can try this for yourself using the latest version of the Monaco editor using this [interactive example](https://codesandbox.io/s/monaco-localised-example-xyrfz6), which is based on the [official localisation example](https://github.com/microsoft/monaco-editor/blob/main/samples/browser-amd-localized/index.html) from the Monaco editor repo.

The interactive example above even includes the following code to set the JS compiler options locale to German, however this does nothing currently as the messages are hard coded to English in the Typescript worker:

```js
const jsDefaults = monaco.languages.typescript.javascriptDefaults;
jsDefaults.setCompilerOptions({
  ...jsDefaults.getCompilerOptions(),
  locale: "de", // this does nothing currently
});
```

## Solution

This package extends Monaco and adds functionality to translate JavaScript or TypeScript diagnostic messages based on the compiler options `locale` property.

Below is an example of what this looks like:
![Monaco editor with translated diagnostic message](/packages/monaco-util/assets/monaco-with-translated-message.png)

ie the diagnostic message is now translated to German to match the Monaco editor locale.

## Getting Started

### Installation

```sh
npm install monaco-editor-typescript-locales
```

### Usage

```js
import { register } from "monaco-editor-typescript-locales";

// you load your monaco instance as normal
...

// then you register the monaco instance with this package
register(monaco);

// and then you can set locales for the JS and TS compiler options
// which will be used to translate the diagnostic messages, e.g. for JS:
const jsDefaults = monaco.languages.typescript.javascriptDefaults;
jsDefaults.setCompilerOptions({
  ...jsDefaults.getCompilerOptions(),
  locale: "de", // this will translate the JS diagnostic messages to German
});
```

The above will only set the translation language for the JS models, if you want the same language for TS models you will need to set it separately, e.g.:

```js
const tsDefaults = monaco.languages.typescript.typescriptDefaults;
tsDefaults.setCompilerOptions({
  ...tsDefaults.getCompilerOptions(),
  locale: "de", // this will translate the TS diagnostic messages to German
});
```

## Supported Locales

<!-- LOCALES_METADATA_START -->

|     | Code  | Description          |
| --- | ----- | -------------------- |
| 1   | cs    | Czech                |
| 2   | de    | German               |
| 3   | en    | English              |
| 4   | es    | Spanish              |
| 5   | fr    | French               |
| 6   | it    | Italian              |
| 7   | ja    | Japanese             |
| 8   | ko    | Korean               |
| 9   | pl    | Polish               |
| 10  | pt-br | Brazilian Portuguese |
| 11  | ru    | Russian              |
| 12  | tr    | Turkish              |
| 13  | zh-cn | Chinese (China)      |
| 14  | zh-tw | Chinese (Taiwan)     |

Generated from TypeScript version **5.7.3**

<!-- LOCALES_METADATA_END -->

## Notes

- Since languages can be set independently for JS and TS, you will need to set the same language for both if you want them to match.
- This assumes Typescript diagnostic messages content does not change across versions after being introduced into the TS compiler, which means this package just needs to be updated when new versions of Typescript are released and all previous versions are supported ie the messages are backward compatible.
- This is a stop gap solution until the Monaco team implements a native Typescript worker localisation solution. The assumption of this package is this future functionality will hook into the language compiler options `locale` option, and so when that happens it should be a simple case of removing this package and the `register` calls to migrate to the official solution.
- This only translates Typescript worker diagnostic messages, not the Monaco editor UI itself or messages from other languages or sources (e.g. linters or parsers).
- Not all Monaco locales might be supported by Typescript and vice versa, so for some languages you might see a mix of translated and untranslated text even when using this package and setting the Monaco locale.
