import { defineConfig, devices } from '@playwright/test';

// On Windows, use the Microsoft Edge that's already installed so no browser
// download is needed. Set PW_CHANNEL=chromium (after `npx playwright install chromium`)
// or another channel to override.
const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);

export default defineConfig({
  testDir: './e2e',
  // Builds the Vue app once so the tests always run against the current code.
  globalSetup: './e2e/global-setup.js',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    channel: channel === 'chromium' ? undefined : channel,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Set PW_SLOWMO=300 (milliseconds per action) with --headed to watch the tests at a readable pace.
    launchOptions: { slowMo: Number(process.env.PW_SLOWMO) || 0 },
  },
  projects: [
    { name: 'desktop' },
    {
      name: 'mobile',
      // A phone-sized viewport checks that the ordering flow works without the side-by-side layout.
      use: { viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true },
      testMatch: /ordering\.spec\.js/,
    },
  ],
});
