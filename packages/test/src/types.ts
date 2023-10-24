export type TestMarkerData = {
  message: string;
  code?: string;
  owner: string;
  resource: string | null;
};

export type BaseTestPageConfig = {
  locale?: string;
};

export type EditorId = `editor${number}`;
