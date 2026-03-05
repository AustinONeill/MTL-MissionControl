export class RoomDurableObject {
  private state: DurableObjectState
  private sessions: Set<WebSocket> = new Set()

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Internal broadcast call from a Worker
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const payload = await request.text()
      this.broadcast(payload)
      return new Response('OK')
    }

    // WebSocket upgrade from a browser client
    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const { 0: client, 1: server } = new WebSocketPair()
    this.state.acceptWebSocket(server)
    this.sessions.add(server)

    server.addEventListener('close', () => {
      this.sessions.delete(server)
    })

    server.addEventListener('error', () => {
      this.sessions.delete(server)
    })

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
    for (const ws of dead) {
      this.sessions.delete(ws)
    }
  }

  // Called by the Workers runtime for hibernation-compatible WebSockets
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    // Clients don't send messages; ignore
  }

  webSocketClose(ws: WebSocket): void {
    this.sessions.delete(ws)
  }

  webSocketError(ws: WebSocket): void {
    this.sessions.delete(ws)
  }
}
