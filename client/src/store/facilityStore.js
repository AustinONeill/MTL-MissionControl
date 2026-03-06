import { create } from 'zustand'

export const STATUS = {
  NORMAL: 'normal',
  WARN:   'warn',
  ALERT:  'alert',
  IDLE:   'idle',
}

export const SYMBOLS = {
  IPM:          'ipm',
  DEFOLIATION:  'defoliation',
  TRANSFER:     'transfer',
  MODE_CHANGE:  'mode_change',
  SUPPLY_READY: 'supply_ready',
  CALENDAR:     'calendar',
  ISSUE:        'issue',
}

export const MODES = {
  VEG:         'veg',
  FLOWER:      'flower',
  FLUSH:       'flush',
  DRY:         'dry',
  IDLE:        'idle',
  MAINTENANCE: 'maintenance',
}

// ── Offline-first seed data ────────────────────────────────────────────────
const initialRooms = [
  { id: 'VEG1', name: 'VEG 1', type: 'veg',     mode: MODES.VEG,    stage: 'Veg Day 18',  status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'VEG2', name: 'VEG 2', type: 'veg',     mode: MODES.VEG,    stage: 'Veg Day 10',  status: STATUS.WARN,   symbols: [SYMBOLS.IPM], flags: [], reEntryExpiresAt: null },
  { id: 'VEG3', name: 'VEG 3', type: 'veg',     mode: MODES.VEG,    stage: 'Veg Day 24',  status: STATUS.NORMAL, symbols: [SYMBOLS.TRANSFER], flags: [], reEntryExpiresAt: null },
  { id: 'VEG4', name: 'VEG 4', type: 'veg',     mode: MODES.VEG,    stage: 'Veg Day 30',  status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'F9',  name: 'F9',  type: 'flower', mode: MODES.FLOWER, stage: 'Flower Day 7',  status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'F8',  name: 'F8',  type: 'flower', mode: MODES.FLOWER, stage: 'Flower Day 14', status: STATUS.WARN,   symbols: [SYMBOLS.IPM, SYMBOLS.ISSUE], flags: [], reEntryExpiresAt: null },
  { id: 'F7',  name: 'F7',  type: 'flower', mode: MODES.FLOWER, stage: 'Flower Day 21', status: STATUS.NORMAL, symbols: [SYMBOLS.DEFOLIATION], flags: [], reEntryExpiresAt: null },
  { id: 'F6',  name: 'F6',  type: 'flower', mode: MODES.FLOWER, stage: 'Flower Day 28', status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'F5',  name: 'F5',  type: 'flower', mode: MODES.FLUSH,  stage: 'Flower Day 35', status: STATUS.ALERT,  symbols: [SYMBOLS.ISSUE], flags: [], reEntryExpiresAt: null },
  { id: 'F14', name: 'F14', type: 'flower', mode: MODES.FLOWER, stage: 'Flower Day 42', status: STATUS.NORMAL, symbols: [SYMBOLS.CALENDAR], flags: [], reEntryExpiresAt: null },
  { id: 'F13', name: 'F13', type: 'flower', mode: MODES.FLOWER, stage: 'Flower Day 49', status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'F12', name: 'F12', type: 'flower', mode: MODES.FLOWER, stage: 'Flower Day 56', status: STATUS.NORMAL, symbols: [SYMBOLS.SUPPLY_READY], flags: [], reEntryExpiresAt: null },
  { id: 'F11', name: 'F11', type: 'flower', mode: MODES.FLUSH,  stage: 'Harvest Week',  status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'F10', name: 'F10', type: 'flower', mode: MODES.FLOWER, stage: 'Flower Day 7',  status: STATUS.WARN,   symbols: [SYMBOLS.MODE_CHANGE], flags: [], reEntryExpiresAt: null },
  { id: 'F17', name: 'F17', type: 'flower', mode: MODES.FLOWER, stage: 'Flower Day 14', status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'F18', name: 'F18', type: 'flower', mode: MODES.FLOWER, stage: 'Flower Day 21', status: STATUS.ALERT,  symbols: [SYMBOLS.ISSUE], flags: [], reEntryExpiresAt: null },
  { id: 'F15', name: 'F15', type: 'flower', mode: MODES.FLOWER, stage: 'Flower Day 28', status: STATUS.NORMAL, symbols: [SYMBOLS.CALENDAR], flags: [], reEntryExpiresAt: null },
  { id: 'F16', name: 'F16', type: 'flower', mode: MODES.FLOWER, stage: 'Flower Day 35', status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'LIVCLONE', name: 'LIVING & CLONING', type: 'support', mode: MODES.VEG,    stage: 'Week 3', status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'PREVEG',   name: 'PRE-VEG',          type: 'support', mode: MODES.VEG,    stage: 'Active', status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'PLANTING', name: 'PLANTING',          type: 'support', mode: MODES.VEG,    stage: 'Active', status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'DRY1', name: 'DRY 1', type: 'utility', mode: MODES.DRY,  stage: 'Curing', status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'DRY2', name: 'DRY 2', type: 'utility', mode: MODES.DRY,  stage: 'Curing', status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'DRY3', name: 'DRY 3', type: 'utility', mode: MODES.IDLE, stage: 'Empty',  status: STATUS.IDLE,   symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'DRY4', name: 'DRY 4', type: 'utility', mode: MODES.IDLE, stage: 'Empty',  status: STATUS.IDLE,   symbols: [], flags: [], reEntryExpiresAt: null },
  { id: 'DRY5', name: 'DRY 5', type: 'utility', mode: MODES.DRY,  stage: 'Curing', status: STATUS.NORMAL, symbols: [], flags: [], reEntryExpiresAt: null },
]

// ── Defoliation seed ──────────────────────────────────────────────────────
const makeEmptyTables = () =>
  Array.from({ length: 6 }, (_, i) => ({ id: i, left: false, right: false }))

// ── API helpers ───────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('stack-auth-token')
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.error ?? `HTTP ${res.status}`), { status: res.status })
  }
  return res.status === 204 ? null : res.json()
}

// ── Store ─────────────────────────────────────────────────────────────────
export const useFacilityStore = create((set, get) => ({
  rooms: initialRooms,
  selectedRoomId: null,
  drawerOpen: false,
  apiStatus: 'offline', // 'loading' | 'online' | 'offline'

  authUser: null,
  setAuthUser: (user) => set({ authUser: user }),

  // Mobile flag selection
  selectedFlagId: null,

  // Defoliation
  defoliationTables: {
    'F7': [
      { id: 0, left: true,  right: true  },
      { id: 1, left: true,  right: false },
      { id: 2, left: false, right: false },
      { id: 3, left: false, right: false },
      { id: 4, left: false, right: false },
      { id: 5, left: false, right: false },
    ],
  },
  defolInfoRoomId: null,

  // ── Transfers ─────────────────────────────────────────────────────────────
  // Keyed by origin roomId
  // { [originId]: { destinationId, transferDate, transferType, notes, createdAt, createdBy } }
  transfers: {},

  // First step of the two-step transfer assignment
  pendingTransferOrigin: null,

  // WebSocket connections per roomId
  _wsMap: {},

  // ── Load rooms from API ──────────────────────────────────────────────────
  loadRooms: async () => {
    if (!API_BASE) return
    set({ apiStatus: 'loading' })
    try {
      const rooms = await apiFetch('/api/rooms')
      set({ rooms, apiStatus: 'online' })
      // Persist snapshot for offline fallback
      try {
        localStorage.setItem('mtl-rooms-snapshot', JSON.stringify(rooms))
      } catch { /* storage full */ }
    } catch {
      // Use cached snapshot if available
      try {
        const snap = localStorage.getItem('mtl-rooms-snapshot')
        if (snap) set({ rooms: JSON.parse(snap) })
      } catch { /* ignore */ }
      set({ apiStatus: 'offline' })
    }
  },

  // ── Connect WebSocket to room Durable Object ─────────────────────────────
  connectRoomWs: (roomId) => {
    if (!API_BASE) return
    const { _wsMap } = get()
    if (_wsMap[roomId]) return // already connected

    const wsUrl = API_BASE.replace(/^http/, 'ws') + `/ws/rooms/${roomId}`
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'ROOM_UPDATED' && msg.room) {
          set((state) => ({
            rooms: state.rooms.map((r) => (r.id === msg.room.id ? { ...r, ...msg.room } : r)),
          }))
        }
      } catch { /* ignore bad frames */ }
    }

    ws.onclose = () => {
      set((state) => {
        const m = { ...state._wsMap }
        delete m[roomId]
        return { _wsMap: m }
      })
      // Reconnect after 3s
      setTimeout(() => get().connectRoomWs(roomId), 3000)
    }

    set((state) => ({ _wsMap: { ...state._wsMap, [roomId]: ws } }))
  },

  // ── UI actions ──────────────────────────────────────────────────────────
  openDefolInfo:  (roomId) => set({ defolInfoRoomId: roomId }),
  closeDefolInfo: ()       => set({ defolInfoRoomId: null }),
  selectRoom:     (roomId) => set({ selectedRoomId: roomId, drawerOpen: true }),
  closeDrawer:    ()       => set({ selectedRoomId: null, drawerOpen: false }),
  getRoom:        (roomId) => get().rooms.find(r => r.id === roomId),

  // Mobile: select a flag type for tap-to-assign
  selectFlag: (flagId) => set((state) => ({
    selectedFlagId: state.selectedFlagId === flagId ? null : flagId,
  })),
  clearSelectedFlag: () => set({ selectedFlagId: null }),

  // ── Room mode ────────────────────────────────────────────────────────────
  updateRoomMode: async (roomId, mode) => {
    // Optimistic update
    set((state) => ({
      rooms: state.rooms.map(r => r.id === roomId ? { ...r, mode } : r),
    }))
    try {
      await apiFetch(`/api/rooms/${roomId}`, {
        method: 'PATCH',
        body: JSON.stringify({ mode }),
      })
    } catch {
      // Revert on failure — handled by WS broadcast on next reconnect
    }
  },

  // ── Flags (symbols) ──────────────────────────────────────────────────────
  addSymbolToRoom: async (roomId, symbol, flagId) => {
    // Optimistic update
    set((state) => ({
      rooms: state.rooms.map(r =>
        r.id === roomId && !r.symbols.includes(symbol)
          ? { ...r, symbols: [...r.symbols, symbol] }
          : r
      ),
    }))
    if (flagId && API_BASE) {
      try {
        await apiFetch(`/api/rooms/${roomId}/flags`, {
          method: 'POST',
          body: JSON.stringify({ flagId }),
        })
      } catch { /* offline — queued automatically by the UI layer */ }
    }
  },

  removeSymbolFromRoom: async (roomId, symbol, flagId) => {
    set((state) => ({
      rooms: state.rooms.map(r =>
        r.id === roomId
          ? { ...r, symbols: r.symbols.filter(s => s !== symbol) }
          : r
      ),
    }))
    if (flagId && API_BASE) {
      try {
        await apiFetch(`/api/rooms/${roomId}/flags/${flagId}`, { method: 'DELETE' })
      } catch { /* offline */ }
    }
  },

  // ── Re-entry countdown ──────────────────────────────────────────────────
  clearReEntry: (roomId) =>
    set((state) => ({
      rooms: state.rooms.map(r =>
        r.id === roomId ? { ...r, reEntryExpiresAt: null } : r
      ),
    })),

  // ── Status (legacy — kept for existing map rendering) ────────────────────
  updateRoomStatus: (roomId, status) =>
    set(state => ({
      rooms: state.rooms.map(r => r.id === roomId ? { ...r, status } : r),
    })),

  // ── Transfer actions ──────────────────────────────────────────────────────

  // Step 1: mark a room as the pending transfer origin
  startTransfer: (originRoomId) => {
    set((state) => ({
      pendingTransferOrigin: originRoomId,
      rooms: state.rooms.map(r =>
        r.id === originRoomId && !r.symbols.includes(SYMBOLS.TRANSFER)
          ? { ...r, symbols: [...r.symbols, SYMBOLS.TRANSFER] }
          : r
      ),
    }))
  },

  // Step 2: complete the transfer by choosing a destination
  completeTransfer: (destinationRoomId) => {
    const { pendingTransferOrigin } = get()
    if (!pendingTransferOrigin || pendingTransferOrigin === destinationRoomId) return

    set((state) => ({
      pendingTransferOrigin: null,
      transfers: {
        ...state.transfers,
        [pendingTransferOrigin]: {
          destinationId: destinationRoomId,
          transferDate: null,
          transferType: 'transplant',
          notes: '',
          createdAt: new Date().toISOString(),
        },
      },
    }))
  },

  // Cancel pending transfer origin (e.g. user presses Escape)
  cancelTransfer: () => {
    const { pendingTransferOrigin } = get()
    if (!pendingTransferOrigin) return
    set((state) => ({
      pendingTransferOrigin: null,
      rooms: state.rooms.map(r =>
        r.id === pendingTransferOrigin
          ? { ...r, symbols: r.symbols.filter(s => s !== SYMBOLS.TRANSFER) }
          : r
      ),
    }))
  },

  // Update transfer details (from TransferModal)
  updateTransfer: (originRoomId, data) =>
    set((state) => ({
      transfers: {
        ...state.transfers,
        [originRoomId]: { ...state.transfers[originRoomId], ...data },
      },
    })),

  // Remove a transfer entirely
  removeTransfer: (originRoomId) =>
    set((state) => {
      const transfers = { ...state.transfers }
      delete transfers[originRoomId]
      return {
        transfers,
        rooms: state.rooms.map(r =>
          r.id === originRoomId
            ? { ...r, symbols: r.symbols.filter(s => s !== SYMBOLS.TRANSFER) }
            : r
        ),
      }
    }),

  // ── Defoliation ──────────────────────────────────────────────────────────
  toggleDefolHalf: (roomId, tableId, half) =>
    set(state => {
      const current = state.defoliationTables[roomId] ?? makeEmptyTables()
      return {
        defoliationTables: {
          ...state.defoliationTables,
          [roomId]: current.map(t =>
            t.id === tableId ? { ...t, [half]: !t[half] } : t
          ),
        },
      }
    }),
}))
