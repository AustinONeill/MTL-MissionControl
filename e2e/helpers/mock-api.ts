import type { Page } from '@playwright/test'

// ── Fake JWT (far-future exp — client-side expiry check only) ─────────────
function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
export const FAKE_TOKEN = [
  b64url({ alg: 'ES256', typ: 'JWT' }),
  b64url({
    sub:   'test-user-id',
    name:  'Test Grower',
    email: 'test@mtl.com',
    role:  'master_grower',
    aud:   '765e7a88-60bf-43d5-bbd5-626b2a4f75fc',
    iss:   'https://api.stack-auth.com/api/v1/projects/765e7a88-60bf-43d5-bbd5-626b2a4f75fc',
    exp:   9_999_999_999,
  }),
  'fake_sig',
].join('.')

// ── Seed data ─────────────────────────────────────────────────────────────
export const MOCK_TASKS = [
  { id: 'task-1', title: 'Defoliation — F7', description: 'Centre clean', status: 'todo',        priority: 'normal', roomId: 'F7',  createdBy: 'test-user-id', createdAt: new Date().toISOString() },
  { id: 'task-2', title: 'IPM Spray — F8',   description: 'Treatment',    status: 'in_progress', priority: 'high',   roomId: 'F8',  createdBy: 'test-user-id', createdAt: new Date().toISOString() },
  { id: 'task-3', title: 'Net Log — VEG1',   description: '1st net',      status: 'done',        priority: 'low',    roomId: null,  createdBy: 'test-user-id', createdAt: new Date().toISOString() },
]

export const MOCK_CONVERSATIONS = [
  { id: 'global:general', type: 'global',       name: '#general', description: 'Team-wide discussion' },
  { id: 'global:ipm',     type: 'global',       name: '#ipm',     description: 'IPM & pest control' },
  { id: 'global:alerts',  type: 'global',       name: '#alerts',  description: 'System alerts' },
  { id: 'room:F7',        type: 'room_channel', name: '#F7',      description: null, roomId: 'F7' },
]

export const MOCK_MESSAGES = [
  { id: 'msg-1', conversationId: 'global:general', senderId: 'other-user', senderName: 'Alex', content: 'Good morning!', contentType: 'text', createdAt: new Date(Date.now() - 60_000).toISOString() },
  { id: 'msg-2', conversationId: 'global:general', senderId: 'test-user-id', senderName: 'Test Grower', content: 'Ready for defoliation run', contentType: 'text', createdAt: new Date().toISOString() },
]

// ── Setup helpers ─────────────────────────────────────────────────────────

/**
 * Injects a fake auth token into localStorage so getToken() returns it
 * without needing a real Stack Auth session.
 */
export async function injectFakeAuth(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem('stack-auth-token', token)
  }, FAKE_TOKEN)
}

/**
 * Mocks all Stack Auth API calls so useUser() / getUser() returns a fake user
 * and the sign-in button is replaced with the signed-in state.
 */
export async function mockStackAuth(page: Page) {
  const PROJECT = '765e7a88-60bf-43d5-bbd5-626b2a4f75fc'
  const fakeUser = {
    id: 'test-user-id',
    display_name: 'Test Grower',
    primary_email: 'test@mtl.com',
    signed_in_or_anonymous: true,
    // Fields Stack Auth SDK v2 may check
    access_token: FAKE_TOKEN,
    refresh_token: 'fake_refresh',
    is_anonymous: false,
    has_password: false,
    oauth_providers: [],
    primary_email_verified: true,
  }

  // Intercept ALL Stack Auth project API calls so no real network hangs the test
  await page.route(/api\.stack-auth\.com/, async (route) => {
    const url = route.request().url()
    // JWKS endpoint — must return the correct structure
    if (url.includes('/.well-known/jwks.json')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ keys: [] }) })
      return
    }
    // All other Stack Auth endpoints — return fakeUser
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeUser) })
  })
}

/**
 * Mocks all worker API endpoints used by the board and chat panels.
 */
export async function mockWorkerApi(page: Page, overrides: {
  tasks?: object[]
  conversations?: object[]
  messages?: Record<string, object[]>
} = {}) {
  // Spread to fresh arrays so parallel tests can't pollute each other via unshift/push
  const tasks         = overrides.tasks         ?? [...MOCK_TASKS]
  const conversations = overrides.conversations ?? [...MOCK_CONVERSATIONS]
  const messages      = overrides.messages      ?? { 'global:general': [...MOCK_MESSAGES] }

  await page.route(/workers\.dev/, async (route) => {
    const url    = route.request().url()
    const method = route.request().method()

    // Tasks ─────────────────────────────────────────────────────────────
    if (url.match(/\/api\/tasks\/[^/]+$/) && method === 'DELETE') {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    if (url.match(/\/api\/tasks\/[^/]+$/) && method === 'PATCH') {
      const body = JSON.parse(route.request().postData() ?? '{}')
      const id   = url.split('/').pop()!
      const task = tasks.find((t: any) => t.id === id) as any
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...task, ...body }) })
      return
    }
    if (url.includes('/api/tasks') && method === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}')
      const newTask = { id: `task-new-${Date.now()}`, status: 'todo', priority: 'normal', createdBy: 'test-user-id', createdAt: new Date().toISOString(), ...body }
      tasks.unshift(newTask as any)
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newTask) })
      return
    }
    if (url.includes('/api/tasks') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasks) })
      return
    }

    // Chat — messages ───────────────────────────────────────────────────
    const msgMatch = url.match(/\/api\/chat\/conversations\/([^/]+)\/messages/)
    if (msgMatch) {
      const convId = decodeURIComponent(msgMatch[1])
      if (method === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}')
        const msg  = { id: `msg-${Date.now()}`, conversationId: convId, senderId: 'test-user-id', senderName: 'Test Grower', createdAt: new Date().toISOString(), contentType: 'text', ...body }
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(msg) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(messages[convId] ?? []) })
      }
      return
    }

    // Chat — conversations ──────────────────────────────────────────────
    if (url.includes('/api/chat/conversations') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(conversations) })
      return
    }

    // Rooms — include VEG rooms so autocomplete suggestions work ───────
    if (url.includes('/api/rooms') && method === 'GET') {
      const rooms = [
        { id: 'VEG1', name: 'VEG 1', type: 'veg',    mode: 'crop',  stage: 'Veg Day 18', overlays: [] },
        { id: 'VEG2', name: 'VEG 2', type: 'veg',    mode: 'crop',  stage: 'Veg Day 10', overlays: [] },
        { id: 'F7',   name: 'F7',    type: 'flower',  mode: 'crop',  stage: 'Flower Day 21', overlays: [] },
        { id: 'F8',   name: 'F8',    type: 'flower',  mode: 'crop',  stage: 'Flower Day 14', overlays: [] },
      ]
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rooms) })
      return
    }

    // Anything else (WS, photos, etc.) — pass through or abort cleanly
    await route.continue()
  })
}

/** Full setup: inject auth + mock all APIs. Call at the start of each test. */
export async function setupTest(page: Page, overrides = {}) {
  await injectFakeAuth(page)
  await mockStackAuth(page)
  await mockWorkerApi(page, overrides)
}
