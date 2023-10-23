import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createTestPageUrlWithConfig } from "../../utils";
import { TestMarkerData, BaseTestPageConfig } from "../../types";
import { LanguageId, MonacoModule } from "@packages/common/src/types";
import { editor, IPosition } from "monaco-editor";

declare global {
  interface Window {
    editor: editor.ICodeEditor;
    // this is added by monaco itself
    monaco: MonacoModule;
  }
}

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

class Actions {
  constructor(private object: SingleEditorPageObject) {}

  async setEditorValue(value: string) {
    await this.object.page.evaluate((value) => {
      window.editor.setValue(value);
    }, value);
  }

  async setCursorToPosition(position: IPosition) {
    await this.object.page.evaluate((position: IPosition) => {
      window.editor.setPosition(position);
    }, position);
  }

  async typeValueAtCurrentCursorPosition(value: string) {
    await this.object.page.evaluate((value) => {
      window.editor.trigger("keyboard", "type", { text: value });
    }, value);
  }

  async backspaceAtCurrentCursorPosition() {
    await this.object.page.evaluate(() => {
      window.editor.trigger("keyboard", "deleteLeft", {});
    });
  }
}

const PAGE_PATH = "/single-editor";

type SingleEditorPageConfig = BaseTestPageConfig & {
  editor0Language: LanguageId;
};

export default class SingleEditorPageObject {
  assert = new Assertions(this);
  actions = new Actions(this);

  constructor(public page: Page) {}

  async openPage(config: SingleEditorPageConfig) {
    const url = createTestPageUrlWithConfig({ path: PAGE_PATH, config });
    console.log(`Opening page: ${url}`);
    await this.page.goto(url);

    // wait until editor is ready ie we expect markers to exist for any test case
    await expect(this.editorMarkersDataContainer, {
      message: "markers data container should be visible initially",
    }).toBeVisible({ timeout: 10_000 });

    await this.page.evaluate(() => {
      window.editor = window.monaco.editor.getEditors()[0];
    });
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
