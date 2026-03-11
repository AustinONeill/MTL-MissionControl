import { defineConfig, devices } from '@playwright/test'

/**
 * Tests run against the production deployment.
 * All worker API calls are intercepted via page.route() in each test.
 * Stack Auth calls are mocked so tests don't require a real Microsoft login.
 *
 * Override the target URL with: BASE_URL=http://localhost:5173 npx playwright test
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,  // 1 retry locally handles production network flakiness
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://mtl-missioncontrol.pages.dev',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Block PWA service worker — prevents SW from caching API responses
    // that would bypass our page.route() mocks in parallel test runs
    serviceWorkers: 'block',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile',   use: { ...devices['iPhone 14'] } },
  ],
})
