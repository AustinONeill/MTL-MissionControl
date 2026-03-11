import { test, expect } from '@playwright/test'
import { setupTest, MOCK_MESSAGES } from '../helpers/mock-api'

test.describe('Chat Panel', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page)
    await page.goto('/')
    // Open chat via the 💬 button in the topbar
    await page.getByRole('button', { name: /open chat/i }).click()
    // Wait for the `open` class — transform panels are always in DOM so aria-label check is insufficient
    await expect(page.locator('.chat-panel.open')).toBeAttached()
  })

  // ── Channel sidebar ───────────────────────────────────────────────────────

  test('shows global channels in sidebar', async ({ page }) => {
    const sidebar = page.locator('.chat-sidebar')
    await expect(sidebar.getByText('#general')).toBeVisible()
    await expect(sidebar.getByText('#ipm')).toBeVisible()
    await expect(sidebar.getByText('#alerts')).toBeVisible()
  })

  test('shows room channels in sidebar', async ({ page }) => {
    await expect(page.locator('.chat-sidebar').getByText('#F7')).toBeVisible()
  })

  test('auto-selects first channel on open', async ({ page }) => {
    // #general should be active by default
    await expect(page.locator('.chat-chan-item.active').getByText('#general')).toBeVisible()
  })

  test('clicking a channel activates it and shows its messages', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#general' }).click()

    // Channel becomes active
    await expect(page.locator('.chat-chan-item.active').getByText('#general')).toBeVisible()

    // Seeded messages appear
    await expect(page.getByText('Good morning!')).toBeVisible()
    await expect(page.getByText('Ready for defoliation run')).toBeVisible()
  })

  test('switching channels updates the header title', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#ipm' }).click()
    await expect(page.locator('.chat-header-title')).toHaveText('#ipm')
  })

  // ── Message input ─────────────────────────────────────────────────────────

  test('input area appears after selecting a channel', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#general' }).click()
    await expect(page.locator('.chat-input')).toBeVisible()
  })

  test('send button disabled when input is empty', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#general' }).click()
    await expect(page.locator('.chat-send-btn')).toBeDisabled()
  })

  test('send button enabled after typing', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#general' }).click()
    await page.locator('.chat-input').fill('Hello team')
    await expect(page.locator('.chat-send-btn')).toBeEnabled()
  })

  test('sends a plain text message — appears in the thread', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#general' }).click()
    await page.locator('.chat-input').fill('Water temp is nominal')
    await page.locator('.chat-send-btn').click()

    await expect(page.getByText('Water temp is nominal')).toBeVisible()
    // Input cleared after send
    await expect(page.locator('.chat-input')).toHaveValue('')
  })

  test('Enter key sends the message', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#general' }).click()
    await page.locator('.chat-input').fill('Entering via keyboard')
    await page.locator('.chat-input').press('Enter')

    await expect(page.getByText('Entering via keyboard')).toBeVisible()
  })

  // ── Autocomplete task flow ────────────────────────────────────────────────

  test('typing a room prefix triggers room autocomplete dropdown', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#general' }).click()
    // Type "veg" — should match VEG rooms from the seed data
    await page.locator('.chat-input').fill('veg')

    await expect(page.locator('.chat-ac-popup')).toBeVisible()
    await expect(page.locator('.chat-ac-header')).toContainText('Select room for task')
  })

  test('selecting a room advances autocomplete to task-type selection', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#general' }).click()
    await page.locator('.chat-input').fill('veg')

    await expect(page.locator('.chat-ac-popup')).toBeVisible()
    // Click the first room suggestion
    await page.locator('.chat-ac-item').first().click()

    await expect(page.locator('.chat-ac-header')).toContainText('Select task type')
  })

  test('selecting task type with subtasks advances to subtask selection', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#general' }).click()
    await page.locator('.chat-input').fill('veg')
    await page.locator('.chat-ac-item').first().click()

    // Pick Defoliation (has subtasks)
    await page.locator('.chat-ac-item').filter({ hasText: 'Defoliation' }).click()

    await expect(page.locator('.chat-ac-header')).toContainText('Select subtask')
  })

  test('completing autocomplete flow composes an action message with badge', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#general' }).click()
    await page.locator('.chat-input').fill('veg')
    await page.locator('.chat-ac-item').first().click()
    await page.locator('.chat-ac-item').filter({ hasText: 'Defoliation' }).click()
    await page.locator('.chat-ac-item').filter({ hasText: 'Centre clean' }).click()

    // Composed badge appears
    await expect(page.locator('.chat-composed-badge')).toBeVisible()
    await expect(page.locator('.chat-composed-badge')).toContainText('Task will be created on whiteboard')

    // Input shows the composed message
    await expect(page.locator('.chat-input')).toHaveValue(/Defoliation/)
  })

  test('composed action message sends and appears as action bubble', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#general' }).click()
    await page.locator('.chat-input').fill('veg')
    await page.locator('.chat-ac-item').first().click()
    await page.locator('.chat-ac-item').filter({ hasText: 'Defoliation' }).click()
    await page.locator('.chat-ac-item').filter({ hasText: 'Centre clean' }).click()

    await page.locator('.chat-send-btn').click()

    // Autocomplete cleared, composed badge gone
    await expect(page.locator('.chat-composed-badge')).not.toBeVisible()
    await expect(page.locator('.chat-input')).toHaveValue('')
  })

  test('Escape key dismisses the autocomplete dropdown', async ({ page }) => {
    await page.locator('.chat-chan-item').filter({ hasText: '#general' }).click()
    await page.locator('.chat-input').fill('veg')
    await expect(page.locator('.chat-ac-popup')).toBeVisible()

    await page.locator('.chat-input').press('Escape')
    await expect(page.locator('.chat-ac-popup')).not.toBeVisible()
  })

  // ── Panel controls ────────────────────────────────────────────────────────

  test('close button dismisses the panel', async ({ page }) => {
    await page.locator('.chat-close').click()
    await expect(page.locator('.chat-panel.open')).not.toBeAttached()
  })

  test('clicking the backdrop closes the panel', async ({ page }) => {
    await page.locator('.chat-backdrop').click({ position: { x: 10, y: 10 } })
    await expect(page.locator('.chat-panel.open')).not.toBeAttached()
  })
})
