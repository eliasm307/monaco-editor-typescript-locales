import {assertTestSiteIsRunning} from "./src/utils";

export default async function globalSetup() {
  await assertTestSiteIsRunning();
  // eslint-disable-next-line no-console
  console.log("Test site is running");
}
