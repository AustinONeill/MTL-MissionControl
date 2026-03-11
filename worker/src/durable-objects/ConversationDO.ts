import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../types'

/**
 * One DO instance per conversation.
 * Receives POST /broadcast from the Worker route, fans out to all WS clients.
 * Clients connect read-only — they send messages via REST, receive via WS.
 * Uses ctx.getWebSockets() for hibernation-safe broadcasting.
 */
export class ConversationDO extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Internal broadcast from the chat route handler
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const payload = await request.text()
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.send(payload) } catch { /* stale socket */ }
      }
      return new Response('OK')
    }

    // WebSocket upgrade from browser
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  // Hibernation-safe lifecycle hooks (no-op — clients are receive-only)
  override webSocketMessage(): void {}
  override webSocketClose(): void {}
  override webSocketError(): void {}
}
