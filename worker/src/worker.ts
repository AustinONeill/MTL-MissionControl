import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authMiddleware } from './middleware/auth'
import { rooms } from './routes/rooms'
import { flags } from './routes/flags'
import { sprayLogs } from './routes/sprayLogs'
import { calibrationLogs } from './routes/calibrationLogs'
import { photos } from './routes/photos'
import { events } from './routes/events'
import { realtime } from './routes/realtime'
import { webhooks } from './routes/webhooks'
import type { Env, HonoVariables } from './types'

export { RoomDurableObject } from './durable-objects/RoomDurableObject'

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

app.use('*', logger())

app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*',
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
)

// Public health check
app.get('/health', (c) => c.json({ status: 'ok', ts: Date.now() }))

// Webhook routes — auth handled internally by Bot Framework HMAC
app.route('/webhooks', webhooks)

// WebSocket upgrade route — auth via token query param
app.route('/ws', realtime)

// All API routes require Stack Auth JWT
app.use('/api/*', authMiddleware)

app.get('/api/me', (c) => {
  const user = c.get('user')
  return c.json(user)
})

app.route('/api/rooms', rooms)
app.route('/api/flags', flags)
app.route('/api/spray-logs', sprayLogs)
app.route('/api/calibration-logs', calibrationLogs)
app.route('/api/photos', photos)
app.route('/api/events', events)

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error', code: 500 }, 500)
})

app.notFound((c) => c.json({ error: 'Not found', code: 404 }, 404))

export default app
