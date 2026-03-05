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

// Accurate room inventory from facility floor plan
// type: 'flower' | 'veg' | 'utility' | 'support' | 'wing'
const initialRooms = [
  // ── VEG ROOMS ──────────────────────────────────────────────────────────────
  { id: 'VEG1', name: 'VEG 1', type: 'veg',     stage: 'Veg Day 18',  batch: 'BTH-V01', status: STATUS.NORMAL, symbols: [] },
  { id: 'VEG2', name: 'VEG 2', type: 'veg',     stage: 'Veg Day 10',  batch: 'BTH-V02', status: STATUS.WARN,   symbols: [SYMBOLS.IPM] },
  { id: 'VEG3', name: 'VEG 3', type: 'veg',     stage: 'Veg Day 24',  batch: 'BTH-V03', status: STATUS.NORMAL, symbols: [SYMBOLS.TRANSFER] },
  { id: 'VEG4', name: 'VEG 4', type: 'veg',     stage: 'Veg Day 30',  batch: 'BTH-V04', status: STATUS.NORMAL, symbols: [] },

  // ── FLOWER ROOMS ────────────────────────────────────────────────────────────
  // Column A – left cultivation column
  { id: 'F9',  name: 'F9',  type: 'flower', stage: 'Flower Day 7',  batch: 'BTH-F09', status: STATUS.NORMAL, symbols: [] },
  { id: 'F8',  name: 'F8',  type: 'flower', stage: 'Flower Day 14', batch: 'BTH-F08', status: STATUS.WARN,   symbols: [SYMBOLS.IPM, SYMBOLS.ISSUE] },
  { id: 'F7',  name: 'F7',  type: 'flower', stage: 'Flower Day 21', batch: 'BTH-F07', status: STATUS.NORMAL, symbols: [SYMBOLS.DEFOLIATION] },
  { id: 'F6',  name: 'F6',  type: 'flower', stage: 'Flower Day 28', batch: 'BTH-F06', status: STATUS.NORMAL, symbols: [] },
  { id: 'F5',  name: 'F5',  type: 'flower', stage: 'Flower Day 35', batch: 'BTH-F05', status: STATUS.ALERT,  symbols: [SYMBOLS.ISSUE] },

  // Column B – center cultivation column
  { id: 'F14', name: 'F14', type: 'flower', stage: 'Flower Day 42', batch: 'BTH-F14', status: STATUS.NORMAL, symbols: [SYMBOLS.CALENDAR] },
  { id: 'F13', name: 'F13', type: 'flower', stage: 'Flower Day 49', batch: 'BTH-F13', status: STATUS.NORMAL, symbols: [] },
  { id: 'F12', name: 'F12', type: 'flower', stage: 'Flower Day 56', batch: 'BTH-F12', status: STATUS.NORMAL, symbols: [SYMBOLS.SUPPLY_READY] },
  { id: 'F11', name: 'F11', type: 'flower', stage: 'Harvest Week',  batch: 'BTH-F11', status: STATUS.NORMAL, symbols: [] },
  { id: 'F10', name: 'F10', type: 'flower', stage: 'Flower Day 7',  batch: 'BTH-F10', status: STATUS.WARN,   symbols: [SYMBOLS.MODE_CHANGE] },

  // Column C right – east section (2 sub-columns wide)
  { id: 'F17', name: 'F17', type: 'flower', stage: 'Flower Day 14', batch: 'BTH-F17', status: STATUS.NORMAL, symbols: [] },
  { id: 'F18', name: 'F18', type: 'flower', stage: 'Flower Day 21', batch: 'BTH-F18', status: STATUS.ALERT,  symbols: [SYMBOLS.ISSUE] },
  { id: 'F15', name: 'F15', type: 'flower', stage: 'Flower Day 28', batch: 'BTH-F15', status: STATUS.NORMAL, symbols: [SYMBOLS.CALENDAR] },
  { id: 'F16', name: 'F16', type: 'flower', stage: 'Flower Day 35', batch: 'BTH-F16', status: STATUS.NORMAL, symbols: [] },

  // ── KEY SUPPORT (gardener-relevant) ────────────────────────────────────────
  { id: 'LIVCLONE', name: 'LIVING & CLONING', type: 'support', stage: 'Week 3', batch: null, status: STATUS.NORMAL, symbols: [] },
  { id: 'PREVEG',   name: 'PRE-VEG',          type: 'support', stage: 'Active', batch: null, status: STATUS.NORMAL, symbols: [] },
  { id: 'PLANTING', name: 'PLANTING',          type: 'support', stage: 'Active', batch: null, status: STATUS.NORMAL, symbols: [] },

  // ── DRY ROOMS ───────────────────────────────────────────────────────────────
  { id: 'DRY1', name: 'DRY 1', type: 'utility', stage: 'Curing', batch: 'BTH-DRY1', status: STATUS.NORMAL, symbols: [] },
  { id: 'DRY2', name: 'DRY 2', type: 'utility', stage: 'Curing', batch: 'BTH-DRY2', status: STATUS.NORMAL, symbols: [] },
  { id: 'DRY3', name: 'DRY 3', type: 'utility', stage: 'Empty',  batch: null,       status: STATUS.IDLE,   symbols: [] },
  { id: 'DRY4', name: 'DRY 4', type: 'utility', stage: 'Empty',  batch: null,       status: STATUS.IDLE,   symbols: [] },
  { id: 'DRY5', name: 'DRY 5', type: 'utility', stage: 'Curing', batch: 'BTH-DRY5', status: STATUS.NORMAL, symbols: [] },
]

// 6 growing tables per room, each split into left + right half
const makeEmptyTables = () =>
  Array.from({ length: 6 }, (_, i) => ({ id: i, left: false, right: false }))

export const useFacilityStore = create((set, get) => ({
  rooms: initialRooms,
  selectedRoomId: null,
  drawerOpen: false,

  // defoliationTables: { [roomId]: [{id, left, right}, ...×6] }
  defoliationTables: {
    // seed F7 with some progress so it's visible immediately
    'F7': [
      { id: 0, left: true,  right: true  },
      { id: 1, left: true,  right: false },
      { id: 2, left: false, right: false },
      { id: 3, left: false, right: false },
      { id: 4, left: false, right: false },
      { id: 5, left: false, right: false },
    ],
  },

  // Defoliation info modal (opened from scissors glyph on map)
  defolInfoRoomId: null,
  openDefolInfo:  (roomId) => set({ defolInfoRoomId: roomId }),
  closeDefolInfo: ()       => set({ defolInfoRoomId: null }),

  selectRoom: (roomId) => set({ selectedRoomId: roomId, drawerOpen: true }),
  closeDrawer: () => set({ selectedRoomId: null, drawerOpen: false }),
  getRoom: (roomId) => get().rooms.find(r => r.id === roomId),

  updateRoomStatus: (roomId, status) =>
    set(state => ({
      rooms: state.rooms.map(r => r.id === roomId ? { ...r, status } : r),
    })),

  addSymbolToRoom: (roomId, symbol) =>
    set(state => ({
      rooms: state.rooms.map(r =>
        r.id === roomId && !r.symbols.includes(symbol)
          ? { ...r, symbols: [...r.symbols, symbol] }
          : r
      ),
    })),

  removeSymbolFromRoom: (roomId, symbol) =>
    set(state => ({
      rooms: state.rooms.map(r =>
        r.id === roomId
          ? { ...r, symbols: r.symbols.filter(s => s !== symbol) }
          : r
      ),
    })),

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
