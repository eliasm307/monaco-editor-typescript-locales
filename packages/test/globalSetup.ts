import type { FullConfig } from "@playwright/test";
import { assertTestSiteIsRunning } from "./src/utils";

export default async function globalSetup(config: FullConfig) {
  await assertTestSiteIsRunning();
  console.log("Test site is running");
}
