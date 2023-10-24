import { test } from "@playwright/test";
import MultipleEditorsPageObject from "./MultipleEditorsPageObject";

// also tests markers are not doubled up when there are multiple models
test("it can translate multiple models of the same js language simultaneously", async ({
  page,
}) => {
  const pageObject = new MultipleEditorsPageObject(page);
  await pageObject.openPageUsingConfig({
    locale: "fr",
    editor0Language: "typescript",
    editor1Language: "typescript",
  });

  await pageObject.assert.actualMarkersMatch([
    {
      owner: "typescript",
      code: "1123",
      message: "La liste des déclarations de variable ne peut pas être vide.",
      resource: "/editor0",
    },
    {
      owner: "typescript",
      code: "1123",
      message: "La liste des déclarations de variable ne peut pas être vide.",
      resource: "/editor1",
    },
  ]);

  const editor0 = pageObject.editor0;
  await editor0.actions.setValue("");
  await pageObject.assert.actualMarkersMatch([
    {
      owner: "typescript",
      code: "1123",
      message: "La liste des déclarations de variable ne peut pas être vide.",
      resource: "/editor1",
    },
  ]);

  await editor0.actions.setCursorToPosition({ lineNumber: 1, column: 1 });
  await editor0.actions.typeValueAtCurrentCursorPosition("x");
  await pageObject.assert.actualMarkersMatch([
    {
      owner: "typescript",
      code: "1123",
      message: "La liste des déclarations de variable ne peut pas être vide.",
      resource: "/editor1",
    },
    {
      code: "2304",
      message: "Le nom 'x' est introuvable.",
      owner: "typescript",
      resource: "/editor0",
    },
  ]);

  const editor1 = pageObject.editor1;
  await editor1.actions.setCursorToPosition({ lineNumber: 1, column: 1 });
  await editor1.actions.typeValueAtCurrentCursorPosition("x");
  await pageObject.assert.actualMarkersMatch([
    {
      code: "2304",
      message: "Le nom 'xconst' est introuvable.",
      owner: "typescript",
      resource: "/editor1",
    },
    {
      code: "2304",
      message: "Le nom 'x' est introuvable.",
      owner: "typescript",
      resource: "/editor0",
    },
  ]);
});

test("test it can translate multiple models of different js languages simultaneously", async ({
  page,
}) => {
  const pageObject = new MultipleEditorsPageObject(page);
  await pageObject.openPageUsingConfig({
    locale: "fr",
    editor0Language: "javascript",
    editor1Language: "typescript",
  });

  await pageObject.assert.actualMarkersMatch([
    {
      owner: "typescript",
      code: "1123",
      message: "La liste des déclarations de variable ne peut pas être vide.",
      resource: "/editor1",
    },
  ]);

  const CODE_WITH_ISSUES = "const bool: str = 5;";
  const editor0 = pageObject.editor0;
  const editor1 = pageObject.editor1;
  await editor0.actions.setValue(CODE_WITH_ISSUES);
  await editor1.actions.setValue(CODE_WITH_ISSUES);
  await pageObject.assert.actualMarkersMatch([
    {
      code: "2304",
      message: "Le nom 'str' est introuvable.",
      owner: "typescript",
      resource: "/editor1",
    },
    {
      code: "8010",
      message:
        "Les annotations de type peuvent uniquement être utilisées dans les fichiers TypeScript.",
      owner: "javascript",
      resource: "/editor0",
    },
  ]);

  await editor0.actions.setCursorToPosition({ lineNumber: 1, column: 1 });
  await editor0.actions.typeValueAtCurrentCursorPosition("x");
  await pageObject.assert.actualMarkersMatch([
    {
      code: "2304",
      message: "Le nom 'str' est introuvable.",
      owner: "typescript",
      resource: "/editor1",
    },
    {
      code: "7028",
      message: "Étiquette inutilisée.",
      owner: "javascript",
      resource: "/editor0",
    },
    {
      code: "1435",
      message: "Mot clé ou identificateur inconnu. Souhaitiez-vous utiliser «const» ?",
      owner: "javascript",
      resource: "/editor0",
    },
  ]);

  await editor1.actions.setCursorToPosition({ lineNumber: 1, column: 1 });
  await editor1.actions.typeValueAtCurrentCursorPosition("x");
  await pageObject.assert.actualMarkersMatch([
    {
      code: "7028",
      message: "Étiquette inutilisée.",
      owner: "typescript",
      resource: "/editor1",
    },
    {
      code: "2304",
      message: "Le nom 'xconst' est introuvable.",
      owner: "typescript",
      resource: "/editor1",
    },
    {
      code: "2304",
      message: "Le nom 'str' est introuvable.",
      owner: "typescript",
      resource: "/editor1",
    },
    {
      code: "1435",
      message: "Mot clé ou identificateur inconnu. Souhaitiez-vous utiliser «const» ?",
      owner: "typescript",
      resource: "/editor1",
    },
    {
      code: "7028",
      message: "Étiquette inutilisée.",
      owner: "javascript",
      resource: "/editor0",
    },
    {
      code: "1435",
      message: "Mot clé ou identificateur inconnu. Souhaitiez-vous utiliser «const» ?",
      owner: "javascript",
      resource: "/editor0",
    },
  ]);
});
