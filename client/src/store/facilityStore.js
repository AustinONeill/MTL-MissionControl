import { create } from 'zustand'

export const STATUS = {
  NORMAL: 'normal',
  WARN:   'warn',
  ALERT:  'alert',
  IDLE:   'idle',
}

export const SYMBOLS = {
  IPM:           'ipm',
  NET:           'net',
  POT_CHECK:     'pot_check',
  FILTER_CHANGE: 'filter_change',
  DEFOLIATION:   'defoliation',
  TRANSFER:      'transfer',
  HARVEST_READY: 'harvest_ready',
  MODE_CHANGE:   'mode_change',
  SUPPLY_READY:  'supply_ready',
  ISSUE:         'issue',
}

export const MODES = {
  OFF:  'off',
  AUTO: 'auto',
  CROP: 'crop',
  FILL: 'fill',
}

// ── Offline-first seed data ────────────────────────────────────────────────
const initialRooms = [
  { id: 'VEG1', name: 'VEG 1', type: 'veg',     mode: MODES.CROP, stage: 'Veg Day 18',  status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'VEG2', name: 'VEG 2', type: 'veg',     mode: MODES.CROP, stage: 'Veg Day 10',  status: STATUS.WARN,   symbols: [SYMBOLS.IPM], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'VEG3', name: 'VEG 3', type: 'veg',     mode: MODES.CROP, stage: 'Veg Day 24',  status: STATUS.NORMAL, symbols: [SYMBOLS.TRANSFER], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'VEG4', name: 'VEG 4', type: 'veg',     mode: MODES.CROP, stage: 'Veg Day 30',  status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F9',  name: 'F9',  type: 'flower', mode: MODES.CROP, stage: 'Flower Day 7',  status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F8',  name: 'F8',  type: 'flower', mode: MODES.CROP, stage: 'Flower Day 14', status: STATUS.WARN,   symbols: [SYMBOLS.IPM, SYMBOLS.ISSUE], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F7',  name: 'F7',  type: 'flower', mode: MODES.CROP, stage: 'Flower Day 21', status: STATUS.NORMAL, symbols: [SYMBOLS.DEFOLIATION], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F6',  name: 'F6',  type: 'flower', mode: MODES.CROP, stage: 'Flower Day 28', status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F5',  name: 'F5',  type: 'flower', mode: MODES.FILL, stage: 'Flower Day 35', status: STATUS.ALERT,  symbols: [SYMBOLS.ISSUE], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F14', name: 'F14', type: 'flower', mode: MODES.CROP, stage: 'Flower Day 42', status: STATUS.NORMAL, symbols: [SYMBOLS.HARVEST_READY], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F13', name: 'F13', type: 'flower', mode: MODES.CROP, stage: 'Flower Day 49', status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F12', name: 'F12', type: 'flower', mode: MODES.CROP, stage: 'Flower Day 56', status: STATUS.NORMAL, symbols: [SYMBOLS.SUPPLY_READY], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F11', name: 'F11', type: 'flower', mode: MODES.FILL, stage: 'Harvest Week',  status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F10', name: 'F10', type: 'flower', mode: MODES.CROP, stage: 'Flower Day 7',  status: STATUS.WARN,   symbols: [SYMBOLS.MODE_CHANGE], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F17', name: 'F17', type: 'flower', mode: MODES.CROP, stage: 'Flower Day 14', status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F18', name: 'F18', type: 'flower', mode: MODES.CROP, stage: 'Flower Day 21', status: STATUS.ALERT,  symbols: [SYMBOLS.ISSUE], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F15', name: 'F15', type: 'flower', mode: MODES.CROP, stage: 'Flower Day 28', status: STATUS.NORMAL, symbols: [SYMBOLS.HARVEST_READY], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'F16', name: 'F16', type: 'flower', mode: MODES.CROP, stage: 'Flower Day 35', status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'LIVCLONE', name: 'LIVING & CLONING', type: 'support', mode: MODES.CROP, stage: 'Week 3', status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'PREVEG',   name: 'PRE-VEG',          type: 'support', mode: MODES.CROP, stage: 'Active', status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'PLANTING', name: 'PLANTING',          type: 'support', mode: MODES.CROP, stage: 'Active', status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'DRY1', name: 'DRY 1', type: 'utility', mode: MODES.AUTO, stage: 'Curing', status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'DRY2', name: 'DRY 2', type: 'utility', mode: MODES.AUTO, stage: 'Curing', status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'DRY3', name: 'DRY 3', type: 'utility', mode: MODES.OFF,  stage: 'Empty',  status: STATUS.IDLE,   symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'DRY4', name: 'DRY 4', type: 'utility', mode: MODES.OFF,  stage: 'Empty',  status: STATUS.IDLE,   symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
  { id: 'DRY5', name: 'DRY 5', type: 'utility', mode: MODES.AUTO, stage: 'Curing', status: STATUS.NORMAL, symbols: [], overlays: [], flags: [], reEntryExpiresAt: null },
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

// ── Map API room shape → local room shape ─────────────────────────────────
function mapApiRoom(r) {
  const overlays = r.overlays ?? []
  return {
    ...r,
    overlays,
    // Derive symbols from active overlays for backwards compat with map rendering
    symbols: overlays
      .filter(o => o.status === 'active')
      .map(o => o.overlayType),
  }
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

  // Net log modal
  netLogRoomId: null,

  // PRE-VEG zone batch state
  // zones     — current zone positions (mutable as batch progresses through room)
  // zoneHistory — trail of internal moves [{ fromZones, toZones, movedAt }]
  // destination — planned exit room
  prevegBatches: {
    B78: { zones: [7, 8], zoneHistory: [], destination: null, transferDate: null, notes: '' },
    B56: { zones: [5, 6], zoneHistory: [], destination: null, transferDate: null, notes: '' },
    B3:  { zones: [3],    zoneHistory: [], destination: null, transferDate: null, notes: '' },
    B4:  { zones: [4],    zoneHistory: [], destination: null, transferDate: null, notes: '' },
  },

  // ── Transfers ─────────────────────────────────────────────────────────────
  // { [originId]: { destinationId, transferDate, transferType, notes, createdAt } }
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
      const raw = await apiFetch('/api/rooms')
      const rooms = raw.map(mapApiRoom)
      set({ rooms, apiStatus: 'online' })
      try {
        localStorage.setItem('mtl-rooms-snapshot', JSON.stringify(rooms))
      } catch { /* storage full */ }
    } catch {
      try {
        const snap = localStorage.getItem('mtl-rooms-snapshot')
        if (snap) set({ rooms: JSON.parse(snap).map(mapApiRoom) })
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
          const updated = mapApiRoom(msg.room)
          set((state) => ({
            rooms: state.rooms.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
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
      setTimeout(() => get().connectRoomWs(roomId), 3000)
    }

    set((state) => ({ _wsMap: { ...state._wsMap, [roomId]: ws } }))
  },

  // ── UI actions ──────────────────────────────────────────────────────────
  openDefolInfo:  (roomId) => set({ defolInfoRoomId: roomId }),
  closeDefolInfo: ()       => set({ defolInfoRoomId: null }),
  openNetLog:     (roomId) => set({ netLogRoomId: roomId }),
  closeNetLog:    ()       => set({ netLogRoomId: null }),

  setPrevegBatch: (batchId, data) =>
    set(state => ({
      prevegBatches: {
        ...state.prevegBatches,
        [batchId]: { ...state.prevegBatches[batchId], ...data },
      },
    })),

  clearPrevegBatch: (batchId) =>
    set(state => ({
      prevegBatches: {
        ...state.prevegBatches,
        [batchId]: { ...state.prevegBatches[batchId], destination: null, transferDate: null, notes: '' },
      },
    })),

  // Move a batch to different zones within PreVeg — records history for line rendering
  movePrevegBatch: (batchId, toZones) =>
    set(state => {
      const batch = state.prevegBatches[batchId]
      if (!batch) return state
      const same = [...batch.zones].sort().join() === [...toZones].sort().join()
      if (same) return state
      return {
        prevegBatches: {
          ...state.prevegBatches,
          [batchId]: {
            ...batch,
            zones: toZones,
            zoneHistory: [
              ...batch.zoneHistory,
              { fromZones: batch.zones, toZones, movedAt: new Date().toISOString() },
            ],
          },
        },
      }
    }),
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

  // ── Overlay actions (API-backed) ─────────────────────────────────────────
  placeOverlay: async (roomId, overlayType, options = {}) => {
    const tempId = `temp-${Date.now()}`
    const tempOverlay = { id: tempId, roomId, overlayType, options, status: 'active' }

    // Optimistic update
    set((state) => ({
      rooms: state.rooms.map(r => {
        if (r.id !== roomId) return r
        const overlays = [...(r.overlays ?? []), tempOverlay]
        return {
          ...r,
          overlays,
          symbols: overlays.filter(o => o.status === 'active').map(o => o.overlayType),
        }
      }),
    }))

    if (!API_BASE) return
    try {
      const overlay = await apiFetch(`/api/rooms/${roomId}/overlays`, {
        method: 'POST',
        body: JSON.stringify({ overlayType, options }),
      })
      // Replace temp with real overlay from server
      set((state) => ({
        rooms: state.rooms.map(r => {
          if (r.id !== roomId) return r
          const overlays = r.overlays.map(o => o.id === tempId ? overlay : o)
          return {
            ...r,
            overlays,
            symbols: overlays.filter(o => o.status === 'active').map(o => o.overlayType),
          }
        }),
      }))
    } catch { /* offline — optimistic state stays */ }
  },

  removeOverlay: async (roomId, overlayType) => {
    const room = get().rooms.find(r => r.id === roomId)
    const overlay = room?.overlays?.find(o => o.overlayType === overlayType && o.status === 'active')

    // Optimistic update
    set((state) => ({
      rooms: state.rooms.map(r => {
        if (r.id !== roomId) return r
        const overlays = r.overlays.filter(o => !(o.overlayType === overlayType && o.status === 'active'))
        return {
          ...r,
          overlays,
          symbols: overlays.filter(o => o.status === 'active').map(o => o.overlayType),
        }
      }),
    }))

    if (!overlay || !API_BASE) return
    try {
      await apiFetch(`/api/rooms/${roomId}/overlays/${overlay.id}`, { method: 'DELETE' })
    } catch { /* offline */ }
  },

  // ── Flags (symbols) — now backed by the overlays API ─────────────────────
  addSymbolToRoom: async (roomId, symbol) => {
    return get().placeOverlay(roomId, symbol)
  },

  removeSymbolFromRoom: async (roomId, symbol) => {
    return get().removeOverlay(roomId, symbol)
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

  updateTransfer: (originRoomId, data) =>
    set((state) => ({
      transfers: {
        ...state.transfers,
        [originRoomId]: { ...state.transfers[originRoomId], ...data },
      },
    })),

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
