# Summary

The Typescript compiler options expose a `locale` option however at the moment this does nothing when changed and diagnostic messages are always in English.

This packages adds behaviour to translate Typescript diagnostic messages into the locale specified in the compiler options `locale` property.

## NOTES

- Assumes Typescript diagnostic messages content does not change across versions after being defined,
  which means this package just needs to be updated when new versions of Typescript are released and all previous versions are supported.
- languages can be set independently for JS and TS, show this in the demo as side by side editors
- This is a stop gap solution until the Monaco team implements a better solution for this and it hooks into the compiler options `locale` option on the assumption that is how it will be officially supported in the future, so when that happens it should be a simple case of removing this package and the `register` calls to migrate to the official solution.
- This only translates Typescript/Javascript diagnostic messages, not the Monaco editor UI itself or messages from other languages or sources (e.g. linters or parsers).
