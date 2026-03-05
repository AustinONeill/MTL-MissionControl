import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../types'

export class RoomDurableObject extends DurableObject<Env> {
  private sessions: Set<WebSocket> = new Set()

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Internal broadcast from a Worker route handler
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const payload = await request.text()
      this.broadcast(payload)
      return new Response('OK')
    }

    // WebSocket upgrade from a browser client
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    this.sessions.add(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  private broadcast(message: string): void {
    const dead: WebSocket[] = []
    for (const ws of this.sessions) {
      try {
        ws.send(message)
      } catch {
        dead.push(ws)
      }
    }
    for (const ws of dead) this.sessions.delete(ws)
  }

  override webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): void {
    // Clients are read-only — no inbound messages expected
  }

  override webSocketClose(ws: WebSocket): void {
    this.sessions.delete(ws)
  }

  override webSocketError(ws: WebSocket): void {
    this.sessions.delete(ws)
  }
}
