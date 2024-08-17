import { defineConfig, devices } from "@playwright/test";
import { TEST_SITE_PORT } from "./src/constants";

const isCI = !!process.env.CI;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./src/app",
  /*
  Run tests in files in parallel,

  off as it makes tests flakey as the monaco workers get confused from editors being used simultaneously (I think)
  */
  fullyParallel: false,
  workers: 1,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: true,
  /* Retry on CI only */
  retries: isCI ? 2 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["html", { open: "never" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },
  globalSetup: require.resolve("./globalSetup.ts"),
  // setting up server can take a while (~30s on dev machine, so maybe more in CI), so accounting for that
  timeout: 120_000,

  /* Configure projects for major browsers */
  // we just need to test one browser, we are testing storybook functionality not its browser compatibility
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    port: TEST_SITE_PORT,
    reuseExistingServer: true,
    command: "npm run dev",
    stdout: "pipe",
    stderr: "pipe",
  },
});
