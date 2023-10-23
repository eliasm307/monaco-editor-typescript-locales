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

  test("it can translate messages with repeated templates on locale change", async ({ page }) => {
    const storybookPage = new SingleEditorPageObject(page);
    await storybookPage.openPage({
      locale: "en",
      editor0Language: "typescript",
    });

    await storybookPage.editorProxyInput.fill(
      ["const str = 1;", "const bool: str = 5;"].join("\n"),
    );

    await storybookPage.assert.actualMarkersMatch([
      {
        owner: "typescript",
        code: "2749",
        message:
          "'str' refers to a value, but is being used as a type here. Did you mean 'typeof str'?",
        resource: "inmemory://model/1",
      },
    ]);

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

    await storybookPage.editorProxyInput.fill(
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
});
