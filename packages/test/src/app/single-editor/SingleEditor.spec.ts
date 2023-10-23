import { assertTestSiteIsRunning } from "../../utils";
import SingleEditorPageObject from "./SingleEditorPageObject";
import { test } from "@playwright/test";

test.describe("Single Editor", () => {
  test.beforeAll(async () => {
    await assertTestSiteIsRunning();
  });

  test.beforeEach(async () => {
    test.setTimeout(60_000);
  });

  // NOTE: also tests it refreshes affected model markers on locale change
  test("it can translate messages with repeated templates on locale change", async ({ page }) => {
    const storybookPage = new SingleEditorPageObject(page);
    await storybookPage.openPage({
      locale: "en",
      editor0Language: "typescript",
    });

    await storybookPage.editorValueProxyInput.fill(
      ["const str = 1;", "const bool: str = 5;"].join("\n"),
    );

    // initial markers in english
    await storybookPage.assert.actualMarkersMatch([
      {
        owner: "typescript",
        code: "2749",
        message:
          "'str' refers to a value, but is being used as a type here. Did you mean 'typeof str'?",
        resource: "inmemory://model/1",
      },
    ]);

    // change locale from default
    await storybookPage.editorLocaleSelect.selectOption("fr");
    await storybookPage.assert.actualMarkersMatch([
      {
        owner: "typescript-fr",
        code: "2749",
        message:
          "'str' fait référence à une valeur, mais il est utilisé ici en tant que type. Est-ce que vous avez voulu utiliser 'typeof str' ?",
        resource: "inmemory://model/1",
      },
    ]);

    // change locale from custom locale to another custom locale
    await storybookPage.editorLocaleSelect.selectOption("de");
    await storybookPage.assert.actualMarkersMatch([
      {
        owner: "typescript-de",
        code: "2749",
        message:
          '"str" bezieht sich auf einen Wert, wird hier jedoch als Typ verwendet. Meinten Sie "typeof str"?',
        resource: "inmemory://model/1",
      },
    ]);

    // can go back to original locale from custom locale
    await storybookPage.editorLocaleSelect.selectOption("en");
    await storybookPage.assert.actualMarkersMatch([
      {
        owner: "typescript",
        code: "2749",
        message:
          "'str' refers to a value, but is being used as a type here. Did you mean 'typeof str'?",
        resource: "inmemory://model/1",
      },
    ]);
  });

  test("can translate messages with repeated templates on load", async ({ page }) => {
    const storybookPage = new SingleEditorPageObject(page);
    await storybookPage.openPage({
      locale: "fr",
      editor0Language: "typescript",
    });

    await storybookPage.editorValueProxyInput.fill(
      ["const str = 1;", "const bool: str = 5;"].join("\n"),
    );

    await storybookPage.assert.actualMarkersMatch([
      {
        owner: "typescript-fr",
        code: "2749",
        message:
          "'str' fait référence à une valeur, mais il est utilisé ici en tant que type. Est-ce que vous avez voulu utiliser 'typeof str' ?",
        resource: "inmemory://model/1",
      },
    ]);
  });

  // todo write tests
  test("it updates marker translations when value changes", async ({ page }) => {
    throw new Error("Not implemented");
  });

  // also tests markers are not doubled up when there are multiple models
  test("it can translate multiple models of the same js language simultaneously", async ({
    page,
  }) => {
    throw new Error("Not implemented");
  });

  test("test it can translate multiple models of different js languages simultaneously", async ({
    page,
  }) => {
    throw new Error("Not implemented");
  });
});
