/* eslint-disable @typescript-eslint/no-shadow */
import type { Page } from "@playwright/test";
import type { MonacoModule } from "@packages/common/src/types";
import type { editor, IPosition } from "monaco-editor";
import { createIdForEditorIndex } from "../utils";
import type { EditorId } from "../types";

type EditorMap = {
  // we will add these
  [key in `editor${number}`]: editor.ICodeEditor;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window extends EditorMap {
    // this is added by monaco itself
    monaco: MonacoModule;
  }
}

class Assertions {
  constructor(private object: EditorObject) {}
}

class Actions {
  constructor(private object: EditorObject) {}

  async setValue(value: string) {
    await this.object.page.evaluate(
      ({ editorId, value }) => {
        window[editorId].setValue(value);
      },
      {
        value,
        editorId: this.object.editorId,
      },
    );
  }

  async setCursorToPosition(position: IPosition) {
    await this.object.page.evaluate(
      ({ editorId, position }) => {
        window[editorId].setPosition(position);
      },
      { position, editorId: this.object.editorId },
    );
  }

  async typeValueAtCurrentCursorPosition(value: string) {
    await this.object.page.evaluate(
      ({ editorId, value }) => {
        window[editorId].trigger("keyboard", "type", { text: value });
      },
      { value, editorId: this.object.editorId },
    );
  }

  async backspaceAtCurrentCursorPosition() {
    await this.object.page.evaluate(
      ({ editorId }) => {
        window[editorId].trigger("keyboard", "deleteLeft", {});
      },
      { editorId: this.object.editorId },
    );
  }
}

type Config = {
  index: number;
};

export default class EditorObject {
  assert = new Assertions(this);
  actions = new Actions(this);
  editorId: EditorId;

  constructor(
    public page: Page,
    config: Config,
  ) {
    this.editorId = createIdForEditorIndex(config.index);
  }
}
