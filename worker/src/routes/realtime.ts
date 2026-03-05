import { Hono } from 'hono'
import type { Env, HonoVariables } from '../types'

// WebSocket upgrade route — proxies to the room's Durable Object
const realtime = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

realtime.get('/rooms/:id', async (c) => {
  const roomId = c.req.param('id')
  const upgradeHeader = c.req.header('Upgrade')

  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade', code: 426 }, 426)
  }

  const doId = c.env.ROOM_DO.idFromName(roomId)
  const stub = c.env.ROOM_DO.get(doId)

  // Forward the WebSocket upgrade to the Durable Object
  return stub.fetch(c.req.raw)
})

export { realtime }
