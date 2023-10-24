import { assertTestSiteIsRunning } from "../../utils";
import SingleEditorPageObject from "./SingleEditorPageObject";
import { test } from "@playwright/test";

// NOTE: also tests it refreshes affected model markers on locale change
test("it can translate messages with repeated templates on locale change", async ({ page }) => {
  const pageObject = new SingleEditorPageObject(page);
  await pageObject.openPageUsingConfig({
    locale: "en",
    editor0Language: "typescript",
  });

  await pageObject.editor.actions.setValue(["const str = 1;", "const bool: str = 5;"].join("\n"));

  // initial markers in english
  await pageObject.assert.actualMarkersMatch([
    {
      owner: "typescript",
      code: "2749",
      message:
        "'str' refers to a value, but is being used as a type here. Did you mean 'typeof str'?",
      resource: "/editor0",
    },
  ]);

  // change locale from default
  await pageObject.editorLocaleSelect.selectOption("fr");
  await pageObject.assert.actualMarkersMatch([
    {
      owner: "typescript",
      code: "2749",
      message:
        "'str' fait référence à une valeur, mais il est utilisé ici en tant que type. Est-ce que vous avez voulu utiliser 'typeof str' ?",
      resource: "/editor0",
    },
  ]);

  // change locale from custom locale to another custom locale
  await pageObject.editorLocaleSelect.selectOption("de");
  await pageObject.assert.actualMarkersMatch([
    {
      owner: "typescript",
      code: "2749",
      message:
        '"str" bezieht sich auf einen Wert, wird hier jedoch als Typ verwendet. Meinten Sie "typeof str"?',
      resource: "/editor0",
    },
  ]);

  // can go back to original locale from custom locale
  await pageObject.editorLocaleSelect.selectOption("en");
  await pageObject.assert.actualMarkersMatch([
    {
      owner: "typescript",
      code: "2749",
      message:
        "'str' refers to a value, but is being used as a type here. Did you mean 'typeof str'?",
      resource: "/editor0",
    },
  ]);
});

test("can translate messages with repeated templates on load", async ({ page }) => {
  const pageObject = new SingleEditorPageObject(page);
  await pageObject.openPageUsingConfig({
    locale: "fr",
    editor0Language: "typescript",
  });

  await pageObject.editor.actions.setValue(["const str = 1;", "const bool: str = 5;"].join("\n"));

  await pageObject.assert.actualMarkersMatch([
    {
      owner: "typescript",
      code: "2749",
      message:
        "'str' fait référence à une valeur, mais il est utilisé ici en tant que type. Est-ce que vous avez voulu utiliser 'typeof str' ?",
      resource: "/editor0",
    },
  ]);
});

test("it updates marker translations on type", async ({ page }) => {
  const pageObject = new SingleEditorPageObject(page);
  await pageObject.openPageUsingConfig({
    locale: "fr",
    editor0Language: "typescript",
  });

  await pageObject.editor.actions.setValue("");
  await pageObject.assert.actualMarkersMatch([]);

  await pageObject.editor.actions.setCursorToPosition({ lineNumber: 1, column: 1 });
  await pageObject.editor.actions.typeValueAtCurrentCursorPosition("x");
  await pageObject.assert.actualMarkersMatch([
    {
      owner: "typescript",
      code: "2304",
      message: "Le nom 'x' est introuvable.",
      resource: "/editor0",
    },
  ]);

  await pageObject.editor.actions.typeValueAtCurrentCursorPosition("x");
  await pageObject.assert.actualMarkersMatch([
    {
      owner: "typescript",
      code: "2304",
      message: "Le nom 'xx' est introuvable.",
      resource: "/editor0",
    },
  ]);

  await pageObject.editor.actions.backspaceAtCurrentCursorPosition();
  await pageObject.assert.actualMarkersMatch([
    {
      owner: "typescript",
      code: "2304",
      message: "Le nom 'x' est introuvable.",
      resource: "/editor0",
    },
  ]);

  await pageObject.editor.actions.backspaceAtCurrentCursorPosition();
  await pageObject.assert.actualMarkersMatch([]);
});
