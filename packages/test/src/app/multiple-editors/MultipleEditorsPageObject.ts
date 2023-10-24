import { LanguageId } from "@packages/common/src/types";
import EditorObject from "../../objects/EditorObject";
import { Page, expect } from "@playwright/test";
import { createTestPageUrlUsingConfig as createTestPageUrlUsingConfig } from "../../utils";
import { BaseTestPageConfig, TestMarkerData } from "../../types";

export const MULTIPLE_EDITORS_PAGE_PATH = "/multiple-editors";

type MultipleEditorsPageConfig = BaseTestPageConfig & {
  editor0Language: LanguageId;
  editor1Language: LanguageId;
};

export default class MultipleEditorsPageObject {
  editor0: EditorObject;
  editor1: EditorObject;
  assert = new Assertions(this);

  constructor(public page: Page) {
    this.editor0 = new EditorObject(page, { index: 0 });
    this.editor1 = new EditorObject(page, { index: 1 });
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

  async openPageUsingConfig(config: MultipleEditorsPageConfig) {
    const url = createTestPageUrlUsingConfig({ path: MULTIPLE_EDITORS_PAGE_PATH, config });
    console.log(`Opening page: ${url}`);
    await this.page.goto(url);

    // wait until editor is ready ie we expect markers to exist for any test case
    await expect(this.editorMarkersDataContainer, {
      message: "markers data container should be visible initially",
    }).toBeVisible({ timeout: 10_000 });
  }
}

class Assertions {
  constructor(private object: MultipleEditorsPageObject) {}

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
