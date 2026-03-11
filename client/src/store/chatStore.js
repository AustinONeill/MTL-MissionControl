import { create } from 'zustand'
import { apiFetch, getToken } from '../lib/apiFetch'
import { useFacilityStore } from './facilityStore'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export const useChatStore = create((set, get) => ({
  conversations: [],       // [{ id, type, name, roomId, ... }]
  messages:      {},       // { [convId]: Message[] }
  activeConvId:  null,
  unread:        {},       // { [convId]: number }
  wsMap:         {},       // { [convId]: WebSocket }
  loading:       false,
  error:         null,
  notifBanner:   null,     // { senderName, content, convName } | null

  // ── Conversations ──────────────────────────────────────────────────────
  loadConversations: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch('/api/chat/conversations')
      const firstId = data[0]?.id ?? null
      set(s => ({
        conversations: data,
        // Auto-select the first channel if nothing is active
        activeConvId: s.activeConvId ?? firstId,
      }))
      // Load messages for auto-selected channel
      if (firstId && !get().messages[firstId]) get().loadMessages(firstId)
      // Auto-connect WS for all conversations to track unread
      for (const conv of data) get().connectWS(conv.id)
    } catch (e) {
      console.error('[chat] loadConversations failed:', e)
      set({ error: e.message ?? 'Failed to load channels' })
    } finally {
      set({ loading: false })
    }
  },

  setActiveConv: (id) => {
    set(s => ({
      activeConvId: id,
      unread: { ...s.unread, [id]: 0 },
    }))
    const { messages, loadMessages } = get()
    if (!messages[id]) loadMessages(id)
  },

  // ── Messages ───────────────────────────────────────────────────────────
  loadMessages: async (convId) => {
    try {
      const data = await apiFetch(`/api/chat/conversations/${convId}/messages`)
      set(s => ({ messages: { ...s.messages, [convId]: data } }))
    } catch (e) {
      console.error('[chat] loadMessages failed:', e)
    }
  },

  sendMessage: async (convId, payload) => {
    const msg = await apiFetch(`/api/chat/conversations/${convId}/messages`, {
      method: 'POST',
      body:   JSON.stringify(payload),
    })
    // If a task was created server-side, add it to the shared task store immediately
    if (msg.createdTask) {
      useFacilityStore.getState().addTask(msg.createdTask)
    }
    // Optimistic local append — WS broadcast may also deliver the message,
    // so deduplicate by id to avoid showing it twice.
    set(s => {
      const existing = s.messages[convId] ?? []
      if (existing.some(m => m.id === msg.id)) return s
      return { messages: { ...s.messages, [convId]: [...existing, msg] } }
    })
    return msg
  },

  dismissBanner: () => set({ notifBanner: null }),

  // ── WebSocket ──────────────────────────────────────────────────────────
  connectWS: async (convId) => {
    if (get().wsMap[convId]) return

    let token
    try { token = await getToken() } catch {}
    if (!token) return

    const wsBase = API_BASE
      .replace('https://', 'wss://')
      .replace('http://',  'ws://')
    const url = `${wsBase}/ws/chat/${encodeURIComponent(convId)}?token=${encodeURIComponent(token)}`

    let ws
    try { ws = new WebSocket(url) } catch (e) {
      console.error('[chat] WS connect failed:', e)
      return
    }

    ws.onmessage = (e) => {
      try {
        const { type, data } = JSON.parse(e.data)
        if (type !== 'message') return

        const { activeConvId, conversations } = get()
        const isActive = activeConvId === data.conversationId

        set(s => {
          const prev = s.messages[data.conversationId] ?? []
          // Deduplicate: optimistic sendMessage may have already appended this
          if (prev.some(m => m.id === data.id)) return s
          return {
            messages: {
              ...s.messages,
              [data.conversationId]: [...prev, data],
            },
            unread: {
              ...s.unread,
              [data.conversationId]: isActive
                ? 0
                : (s.unread[data.conversationId] ?? 0) + 1,
            },
          }
        })

        // Push created tasks to the shared whiteboard store (for all clients receiving via WS)
        if (data.createdTask) {
          useFacilityStore.getState().addTask(data.createdTask)
        }

        // In-app banner when panel is closed (or different conv is active)
        if (!isActive) {
          const conv = conversations.find(c => c.id === data.conversationId)
          set({
            notifBanner: {
              senderName: data.senderName,
              content:    data.content.slice(0, 80),
              convName:   conv?.name ?? data.conversationId,
              convId:     data.conversationId,
            },
          })
          setTimeout(() => {
            // Auto-dismiss after 5s if not dismissed manually
            set(s => s.notifBanner?.convId === data.conversationId ? { notifBanner: null } : s)
          }, 5000)
        }
      } catch {}
    }

    ws.onclose = () => {
      set(s => {
        const { [convId]: _, ...rest } = s.wsMap
        return { wsMap: rest }
      })
      // Reconnect after 3s
      setTimeout(() => get().connectWS(convId), 3_000)
    }

    ws.onerror = (e) => console.warn('[chat] WS error on', convId, e)

    set(s => ({ wsMap: { ...s.wsMap, [convId]: ws } }))
  },

  disconnectAll: () => {
    const { wsMap } = get()
    for (const ws of Object.values(wsMap)) {
      try { ws.close() } catch {}
    }
    set({ wsMap: {} })
  },
}))
