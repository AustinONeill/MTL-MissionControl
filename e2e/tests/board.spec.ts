import { test, expect } from '@playwright/test'
import { setupTest, MOCK_TASKS } from '../helpers/mock-api'

test.describe('Whiteboard (Task Board)', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page)
    await page.goto('/')
    await page.getByRole('button', { name: /board/i }).click()
    // Wait for the `open` class — transform panels are always in DOM so aria-label check is insufficient
    await expect(page.locator('.wb-panel.open')).toBeAttached()
  })

  test('shows three status columns with correct labels', async ({ page }) => {
    const board = page.getByLabel('Task whiteboard')
    const labels = board.locator('.wb-col-label')
    await expect(labels.filter({ hasText: 'TO DO' })).toBeVisible()
    await expect(labels.filter({ hasText: 'IN PROGRESS' })).toBeVisible()
    await expect(labels.filter({ hasText: 'DONE' })).toBeVisible()
  })

  test('loads and displays seeded tasks in correct columns', async ({ page }) => {
    const board = page.getByLabel('Task whiteboard')
    // Check task titles appear
    await expect(board.getByText('Defoliation — F7')).toBeVisible()
    await expect(board.getByText('IPM Spray — F8')).toBeVisible()
    await expect(board.getByText('Net Log — VEG1')).toBeVisible()

    // Column counts
    const todoHeader      = board.locator('.wb-col').filter({ hasText: 'TO DO' })
    const inProgressHeader = board.locator('.wb-col').filter({ hasText: 'IN PROGRESS' })
    const doneHeader      = board.locator('.wb-col').filter({ hasText: 'DONE' })

    await expect(todoHeader.locator('.wb-col-count')).toHaveText('1')
    await expect(inProgressHeader.locator('.wb-col-count')).toHaveText('1')
    await expect(doneHeader.locator('.wb-col-count')).toHaveText('1')
  })

  test('opens add-task form on "+ Task" click', async ({ page }) => {
    await page.getByRole('button', { name: /\+ Task/i }).click()
    await expect(page.getByPlaceholder('Task title *')).toBeVisible()
    await expect(page.getByRole('button', { name: /Add Task/i })).toBeVisible()
  })

  test('add-task submit button disabled when title is empty', async ({ page }) => {
    await page.getByRole('button', { name: /\+ Task/i }).click()
    await expect(page.getByRole('button', { name: /Add Task/i })).toBeDisabled()
  })

  test('adds a new task and it appears in TO DO column', async ({ page }) => {
    await page.getByRole('button', { name: /\+ Task/i }).click()

    await page.getByPlaceholder('Task title *').fill('Spray — VEG2 preventative')
    await page.getByPlaceholder('Description (optional)').fill('Weekly IPM run')
    await page.getByRole('button', { name: /Add Task/i }).click()

    // Form closes
    await expect(page.getByPlaceholder('Task title *')).not.toBeVisible()

    // New task card appears in TO DO
    const todoCol = page.locator('.wb-col').filter({ hasText: 'TO DO' })
    await expect(todoCol.getByText('Spray — VEG2 preventative')).toBeVisible()
  })

  test('cycles task status from TO DO → IN PROGRESS → DONE → TO DO', async ({ page }) => {
    const board   = page.getByLabel('Task whiteboard')
    const taskCard = board.locator('.wb-card').filter({ hasText: 'Defoliation — F7' })

    // Initially in TO DO
    await expect(taskCard.getByRole('button', { name: /TO DO/i })).toBeVisible()

    // Click to advance to IN PROGRESS
    await taskCard.getByRole('button', { name: /TO DO/i }).click()
    await expect(taskCard.getByRole('button', { name: /IN PROGRESS/i })).toBeVisible()

    // Click to advance to DONE
    await taskCard.getByRole('button', { name: /IN PROGRESS/i }).click()
    await expect(taskCard.getByRole('button', { name: /DONE/i })).toBeVisible()

    // Click to wrap back to TO DO
    await taskCard.getByRole('button', { name: /DONE/i }).click()
    await expect(taskCard.getByRole('button', { name: /TO DO/i })).toBeVisible()
  })

  test('deletes a task and removes it from the board', async ({ page }) => {
    const board    = page.getByLabel('Task whiteboard')
    const taskCard = board.locator('.wb-card').filter({ hasText: 'Net Log — VEG1' })

    await expect(taskCard).toBeVisible()
    await taskCard.getByRole('button', { name: /Delete task/i }).click()
    await expect(taskCard).not.toBeVisible()
  })

  test('cancel button hides the add form without adding', async ({ page }) => {
    await page.getByRole('button', { name: /\+ Task/i }).click()
    await page.getByPlaceholder('Task title *').fill('Should not be saved')

    // Click Cancel (same button now shows "✕ Cancel")
    await page.getByRole('button', { name: /Cancel/i }).click()

    await expect(page.getByPlaceholder('Task title *')).not.toBeVisible()
    await expect(page.getByText('Should not be saved')).not.toBeVisible()
  })

  test('close button dismisses the panel', async ({ page }) => {
    await page.locator('.wb-close').click()
    await expect(page.locator('.wb-panel.open')).not.toBeAttached()
  })
})
