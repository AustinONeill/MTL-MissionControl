/**
 * Seed script — run with:
 *   DATABASE_URL="..." npx tsx seed.ts
 */
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './src/schema'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1) }

const pool = new Pool({ connectionString: DATABASE_URL })
const db   = drizzle(pool, { schema })

// ── Rooms — matches IsometricMap.jsx tile definitions (interactive only) ──────
const ROOMS: (typeof schema.rooms.$inferInsert)[] = [
  // Veg rooms
  { id: 'VEG1',    name: 'VEG 1',          type: 'veg',     mode: 'auto' },
  { id: 'VEG2',    name: 'VEG 2',          type: 'veg',     mode: 'auto' },
  { id: 'VEG3',    name: 'VEG 3',          type: 'veg',     mode: 'auto' },
  { id: 'VEG4',    name: 'VEG 4',          type: 'veg',     mode: 'off'  },
  // Large flower rooms (upper)
  { id: 'F9',      name: 'F9',             type: 'flower',  mode: 'crop' },
  { id: 'F8',      name: 'F8',             type: 'flower',  mode: 'fill' },
  { id: 'F14',     name: 'F14',            type: 'flower',  mode: 'crop' },
  { id: 'F13',     name: 'F13',            type: 'flower',  mode: 'fill' },
  { id: 'F17',     name: 'F17',            type: 'flower',  mode: 'auto' },
  { id: 'F18',     name: 'F18',            type: 'flower',  mode: 'off'  },
  // Large flower rooms (lower)
  { id: 'F7',      name: 'F7',             type: 'flower',  mode: 'crop' },
  { id: 'F6',      name: 'F6',             type: 'flower',  mode: 'fill' },
  { id: 'F5',      name: 'F5',             type: 'flower',  mode: 'crop' },
  { id: 'F12',     name: 'F12',            type: 'flower',  mode: 'fill' },
  { id: 'F11',     name: 'F11',            type: 'flower',  mode: 'crop' },
  { id: 'F10',     name: 'F10',            type: 'flower',  mode: 'auto' },
  { id: 'F15',     name: 'F15',            type: 'flower',  mode: 'crop' },
  { id: 'F16',     name: 'F16',            type: 'flower',  mode: 'off'  },
  // Dry / utility rooms
  { id: 'DRY1',    name: 'DRY 1',          type: 'utility', mode: 'off'  },
  { id: 'DRY2',    name: 'DRY 2',          type: 'utility', mode: 'off'  },
  { id: 'DRY3',    name: 'DRY 3',          type: 'utility', mode: 'off'  },
  { id: 'DRY4',    name: 'DRY 4',          type: 'utility', mode: 'off'  },
  { id: 'DRY5',    name: 'DRY 5',          type: 'utility', mode: 'off'  },
  // Support rooms
  { id: 'LIVCLONE', name: 'LIVING & CLONING', type: 'support', mode: 'auto' },
  { id: 'PREVEG',   name: 'PRE-VEG',          type: 'support', mode: 'auto' },
  { id: 'PLANTING', name: 'PLANTING',          type: 'support', mode: 'off'  },
]

// ── Sample tasks for the whiteboard ───────────────────────────────────────────
const TASKS: (typeof schema.tasks.$inferInsert)[] = [
  { title: 'Pot check — F7 through F12', roomId: 'F7',   priority: 'high',   status: 'todo',        createdBy: 'seed', createdByName: 'System' },
  { title: 'Filter change — VEG rooms',  roomId: 'VEG1', priority: 'normal', status: 'todo',        createdBy: 'seed', createdByName: 'System' },
  { title: 'Net lowering — F9',          roomId: 'F9',   priority: 'high',   status: 'in_progress', createdBy: 'seed', createdByName: 'System' },
  { title: 'IPM spray scheduled — F8, F13 (re-entry 12h)', roomId: 'F8', priority: 'high', status: 'todo', createdBy: 'seed', createdByName: 'System' },
  { title: 'Defoliation pass — F6',      roomId: 'F6',   priority: 'normal', status: 'todo',        createdBy: 'seed', createdByName: 'System' },
  { title: 'Review batch transfer schedule — PREVEG → VEG1', priority: 'normal', status: 'todo', createdBy: 'seed', createdByName: 'System' },
  { title: 'Calibrate pH sensors — all veg rooms', priority: 'low', status: 'todo', createdBy: 'seed', createdByName: 'System' },
]

async function seed() {
  console.log('Seeding rooms...')
  await db.insert(schema.rooms)
    .values(ROOMS)
    .onConflictDoNothing()
  console.log(`  ✓ ${ROOMS.length} rooms`)

  console.log('Seeding tasks...')
  await db.insert(schema.tasks)
    .values(TASKS)
    .onConflictDoNothing()
  console.log(`  ✓ ${TASKS.length} tasks`)

  console.log('Done.')
  await pool.end()
}

seed().catch(e => { console.error(e); process.exit(1) })
