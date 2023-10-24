import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createTestPageUrlUsingConfig } from "../../utils";
import { TestMarkerData, BaseTestPageConfig } from "../../types";
import { LanguageId, MonacoModule } from "@packages/common/src/types";
import { editor } from "monaco-editor";
import EditorObject from "../../objects/EditorObject";

class Assertions {
  constructor(private object: SingleEditorPageObject) {}

  async actualMarkersMatch(expectedMarkers: TestMarkerData[]) {
    if (!expectedMarkers.length) {
      await expect(this.object.editorMarkersDataContainer).toBeHidden();
      return;
    }

    let actualConfigText = await this.object.editorMarkersDataContainer.innerText();
    // NOTE reading text from DOM can result in different whitespace characters so this is to normalise the text
    // ie https://stackoverflow.com/questions/24087378/jquery-reads-char-code-160-instead-of-32-for-space-from-chrome-textarea
    actualConfigText = actualConfigText.replace(/\s/g, " ");
    const actualMarkers: TestMarkerData[] = JSON.parse(actualConfigText);
    expect(actualMarkers, "markers data equals").toEqual(expectedMarkers);
  }
}

export const SINGLE_EDITOR_PAGE_PATH = "/single-editor";

type SingleEditorPageConfig = BaseTestPageConfig & {
  editor0Language: LanguageId;
};

export default class SingleEditorPageObject {
  assert = new Assertions(this);
  editor: EditorObject;

  constructor(public page: Page) {
    this.editor = new EditorObject(page, { index: 0 });
  }

  async openPageUsingConfig(config: SingleEditorPageConfig) {
    const url = createTestPageUrlUsingConfig({ path: SINGLE_EDITOR_PAGE_PATH, config });
    console.log(`Opening page: ${url}`);
    await this.page.goto(url);

    // wait until editor is ready ie we expect markers to exist for any test case
    await expect(this.editorMarkersDataContainer, {
      message: "markers data container should be visible initially",
    }).toBeVisible({ timeout: 10_000 });
  }

  /**
   * This is a select element that can be used to change the compilerOptions locale of the editor
   */
  get editorLocaleSelect() {
    return this.page.locator("#editor-locale-select");
  }

  /**
   * This element will contain a JSON representation of the current markers in the editor
   */
  get editorMarkersDataContainer() {
    return this.page.locator("#editor-markers-data-container");
  }
}
