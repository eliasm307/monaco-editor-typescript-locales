import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createTestPageUrlWithConfig } from "../../utils";
import { TestMarkerData, BaseTestPageConfig } from "../../types";
import { LanguageId } from "@packages/common/src/types";

class Assertions {
  constructor(private object: SingleEditorPageObject) {}

  async actualMarkersMatch(expectedMarkers: TestMarkerData[]) {
    let actualConfigText = await this.object.editorMarkersDataContainer.innerText();
    // NOTE reading text from DOM can result in different whitespace characters so this is to normalise the text
    // ie https://stackoverflow.com/questions/24087378/jquery-reads-char-code-160-instead-of-32-for-space-from-chrome-textarea
    actualConfigText = actualConfigText.replace(/\s/g, " ");
    const actualMarkers: TestMarkerData[] = JSON.parse(actualConfigText);
    expect(actualMarkers, "markers data equals").toEqual(expectedMarkers);
  }
}

const PAGE_PATH = "/single-editor";

type SingleEditorPageConfig = BaseTestPageConfig & {
  editor0Language: LanguageId;
};

export default class SingleEditorPageObject {
  assert: Assertions;

  constructor(public page: Page) {
    this.assert = new Assertions(this);
  }

  async openPage(config: SingleEditorPageConfig) {
    const url = createTestPageUrlWithConfig({ path: PAGE_PATH, config });
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
   * Setting the editor value via Playwright locators is difficult so this input is to simplify this
   * where changes to this input are set as the value of the editor
   */
  get editorValueProxyInput() {
    return this.page.locator("#editor-proxy-value-input");
  }

  /**
   * This element will contain a JSON representation of the current markers in the editor
   */
  get editorMarkersDataContainer() {
    return this.page.locator("#editor-markers-data-container");
  }
}
