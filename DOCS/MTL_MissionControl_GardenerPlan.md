# MTL Mission Control — Gardener Experience Plan

**Author:** Austin O'Neill
**Perspective:** Floor operator (Gardener) daily workflow
**Last Updated:** March 2026
**Status:** Planning / Pre-implementation

---

## Core Principle

The dashboard exists to serve the gardener on the floor.
Every feature should answer one question: **"What do I need to do in this room right now,
and how do I log that I did it?"**

> *If logging feels slow, gardeners stop logging.*

When a room tile is fully green at end of shift, the job is done.
A complete IPM round with nothing to report should take 2 taps per room.
The compliance trail is a side effect of good UX, not the other way around.

---

## Table of Contents

1. [The Gardener's Day — Workflow Map](#1-the-gardeners-day--workflow-map)
2. [Room Tile — Daily Completion Indicator](#2-room-tile--daily-completion-indicator)
3. [Pressure Mapping — Zone-Based IPM](#3-pressure-mapping--zone-based-ipm)
4. [IPM Scout Flow — Streamlined for Gardeners](#4-ipm-scout-flow--streamlined-for-gardeners)
5. [Revised Flag & Overlay Types — Gardener Lens](#5-revised-flag--overlay-types--gardener-lens)
6. [Pot Check — Refined for Gardeners](#6-pot-check--refined-for-gardeners)
7. [Filter Change — Refined](#7-filter-change--refined)
8. [Waste Log](#8-waste-log)
9. [Shift Summary View](#9-shift-summary-view)
10. [Data Model Additions](#10-data-model-additions)
11. [API Additions](#11-api-additions)
12. [Implementation Priority](#12-implementation-priority)
13. [Package Recommendations](#13-package-recommendations)
14. [What We Are NOT Building Now](#14-what-we-are-not-building-now)

---

## 1. The Gardener's Day — Workflow Map

```
Arrive at shift
      |
      v
Open dashboard → see all room tiles
      |
      |-- Red/orange badges = tasks due or overdue
      |-- Yellow badges = tasks pending today
      |-- Green tile = all tasks complete
      v
Walk room by room:
  1. Pot check → log it (YES / NO, 2 taps)
  2. Filter change (if scheduled today) → log it
  3. Scout for pests → place IPM flag if found, mark zones on pressure map
  4. Net check if nets are active → confirm zip ties
  5. Any flags to move, update, or close?
  6. Any waste to log?
      |
      v
All tiles green → shift done
      |
      v
Tap "End Shift" → summary auto-compiles → optional note → submit
```

Standard shift timeline:

```
07:00  Arrive — open Mission Control
       → Dashboard loads. Today's checklist tiles are visible on the map.
       → Any unclosed alerts from the previous shift are flagged.

07:15  Morning walk — IPM scouting
       → Tap each room tile → 2-tap scout: "All clear" or "Issue found"
       → If issue: select pressure zone(s), mark pest type, severity
       → Tile updates in real time for all operators on duty

08:00  Pot checks (all active rooms)
       → Open room drawer → POT CHECK tab
       → YES / NO → save (under 10 seconds per room)

09:00  Spray (if required)
       → Full F-005 form (SprayLogModal)
       → Re-entry badge appears on tile immediately after save
       → Teams alert fires to master_grower / director channel

10:00  Net checks (rooms with net overlay active)
       → Tap 🕸 glyph on tile → NetModal
       → Confirm lowered + zip ties → save

12:00  Filter changes (scheduled days only)
       → FILTER CHANGE tab in room drawer
       → YES / NO → save

16:00  End of shift
       → Shift Summary auto-compiles from operator's EventLog
       → One optional note field → Submit
       → Master Grower / Director sees the summary in their feed
```

---

## 2. Room Tile — Daily Completion Indicator

This is the core UX loop. Every room has a daily task checklist.
When all required tasks are submitted, the tile turns green.

### How It Works

Each room has a `DailyChecklist` generated at 06:00 local time by a Cloudflare Cron Trigger:

| Task | Frequency | Trigger |
|------|-----------|---------|
| Pot Check | Daily | All active crop rooms |
| IPM Scout | Daily | All active crop rooms |
| Net Check | Daily | Rooms with `net` overlay active |
| Filter Change | Scheduled | Per room's filter schedule (e.g. Mon/Thu) |
| Spray Log | As-needed | No trigger — logged on action |

Rooms in `mode: 'off'` or `mode: 'auto'` do not generate checklists (no active crop).

### Tile Behaviour

| State | Tile appearance | Meaning |
|-------|-----------------|---------|
| All complete | Green glow / green border | Every task logged for today |
| In progress | Yellow border / amber pulse | Some tasks done, some remaining |
| Overdue item | Red pulsing badge | A task missed its cutoff |
| No tasks today | Neutral / no badge | Room is idle or has no scheduled tasks |

Updates happen in real time via Durable Object broadcast — every operator on duty sees the tile flip green simultaneously when the last item is completed.

**No new tile colours are introduced.** The completion indicator reuses the existing status system — a fully completed room shifts to `STATUS.NORMAL` with a subtle green pulse on the mode badge.

### DailyChecklist Shape

```ts
interface DailyChecklist {
  roomId: string
  date: string              // "2026-03-06"
  tasks: ChecklistItem[]
  allComplete: boolean      // derived — true when every item is complete
}

interface ChecklistItem {
  taskType: string          // "pot_check" | "filter_change" | "net_check" | "ipm_scout"
  required: boolean
  completedAt?: Date
  completedBy?: string      // Stack Auth user ID
  linkedLogId?: string      // references the actual log entry
}
```

When `allComplete` flips to true:
- Room tile updates to green state via Durable Object broadcast
- EventLog entry: `action: 'DAILY_CHECKLIST_COMPLETE'`, operatorId, timestamp

---

## 3. Pressure Mapping — Zone-Based IPM

### Overview

When an IPM flag is placed on a room, the gardener identifies **where** in the room
the pressure is — not just which room. The room is split into rough zones displayed
on the isometric tile as a simple overlay grid. No external charting library.

### Zone Model

| Room type | Grid | Zones |
|-----------|------|-------|
| Small (PreVeg, Dry) | 2 × 2 | 4 zones (NW, NE, SW, SE) |
| Large (Veg, Flower) | 2 × 3 | 6 zones |

Each zone stores:
```ts
{
  pressureLevel: 'none' | 'low' | 'medium' | 'high'
  pestType?: string   // e.g. "spider mites" | "fungus gnats" | "powdery mildew"
  notes?: string
}
```

### How It Looks on the Tile

Zone overlays are CSS `opacity` tints on top of the SVG tile:

| Level | Colour |
|-------|--------|
| `none` | Transparent |
| `low` | Yellow, 15% opacity |
| `medium` | Orange, 25% opacity |
| `high` | Red, 40% opacity |

A room with any `high` zone automatically triggers a `WARN` status and a Teams alert.
The overall room IPM badge reflects the highest zone level present.

### Scout-Only Confirmation

If a gardener scouts a room with an active IPM flag and finds nothing new:
- One-tap **"Scouted — Clear"** button on the IPM flag context menu
- Logs an `ipm_scouts` entry: room, operator, timestamp, `allClear: true`
- Satisfies the daily IPM checklist item for that room
- Pressure zones carry forward until explicitly cleared

---

## 4. IPM Scout Flow — Streamlined for Gardeners

Full scout-to-spray flow, optimised for a gardener standing in a room with a phone:

```
[Room Tile]
    |
    Tap IPM flag in toolbox → or tap 🐛 glyph on active tile
    |
    v
[Scout — Step 1: Any pressure?]
    No  → "Scouted — All Clear" → logs ipm_scout (allClear: true),
           checks off daily IPM task, drawer closes  ← 2 TAPS TOTAL
    Yes → continue to Step 2
    |
    v (Yes path)
[Step 2: Pressure Map]
    Tap zones → assign pressureLevel + pest type
    |
    v
[Step 3: Action taken?]
    Spray applied today → open SprayLog form (F-005 fields)
    No spray yet       → save pressure map only, flag stays open
    |
    v
[Save → tile updates, checklist item marked complete]
```

The full spray log (F-005) is **never shown during the scout**. Scout and spray are
distinct records. A "nothing to report" round takes **2 taps per room**.

### Scout UI Component

Located in the room drawer OVERVIEW tab, below active flags.
Only shown for rooms with `type: 'veg'` or `type: 'flower'` in `mode: 'crop'`:

```
┌──────────────────────────────────────┐
│  IPM SCOUT                           │
│  Last: 8h ago — All Clear (J.Smith)  │
│                                      │
│  [ ✓ All Clear ]  [ ⚠ Issue Found ] │
└──────────────────────────────────────┘
```

Tapping **Issue Found** reveals the zone grid inline — no modal required.
Select zones, pest type, severity, confirm. The overlay on the tile updates immediately.

---

## 5. Revised Flag & Overlay Types — Gardener Lens

| Overlay | Placed By | Opens | Daily task? |
|---------|-----------|-------|-------------|
| **IPM / Scout** | Gardener | Scout flow → Pressure Map → optional SprayLog | Yes — must scout daily if flag active |
| **Net** | Gardener | NetModal (SVG zip tie check, 1st/2nd net) | Yes — net check required while net is active |
| **Defoliation** | Gardener | Simple log: date, operator, notes, photo | No — event-based |
| **Waste** | Gardener | WasteLogModal (weight, witnesses) | No — event-based |
| **Transfer** | Gardener, Master Grower | Source room, dest room, batch, operator | No — event-based |
| **Issue / Alert** | Any role | Free text, severity, photo — fires Teams alert | No — event-based |
| **Supply Ready** | Gardener | Simple confirmation + notes | No — event-based |
| **Mode Change** | Master Grower only | Mode dropdown | No — role-restricted |
| **Harvest Ready** | Master Grower only | Triggers Outlook calendar event | No — role-restricted |

Gardeners **cannot** place Mode Change or Harvest Ready overlays.

---

## 6. Pot Check — Refined for Gardeners

Quick-log optimised for speed on a phone. Currently implemented as YES / NO in the drawer tab.

### Interaction (current)

Two large tap targets in the POT CHECK drawer tab:
- **YES** → logs `completed: true, rootHealth: 'healthy'` → green confirm
- **NO** → logs `completed: false, rootHealth: 'concern'` → red confirm

Total taps: **1 tap + save confirmation**.

### Future — PotCheck Extended (Phase B)

If compliance requires more detail, extend to a 3-state flow (still under 10 seconds):

| Field | Type |
|-------|------|
| Standing water? | Large YES / NO toggle (one tap) |
| If YES: Water removed? | Checkbox — appears only if YES |
| Root health | 3-option visual selector: 🟢 Healthy / 🟡 Concern / 🔴 Critical |
| Notes | Only shown if Concern or Critical — required |
| Photo | Only shown if Critical — required |
| Operator | Auto-filled |

Healthy room with no water: **2 taps total**.

---

## 7. Filter Change — Refined

Currently implemented as YES / NO in the FILTER CHANGE drawer tab.
Future extended form if compliance requires it:

| Field | Type |
|-------|------|
| Filter type | Select: Carbon / Pre-Filter / HEPA / Other |
| Old filter condition | 3-option selector: Normal / Heavily Loaded / Damaged |
| New filter installed | Checkbox — must be checked to save |
| Photo | Optional |
| Notes | Optional |
| Operator | Auto-filled |

---

## 8. Waste Log

### Overview

Health Canada's *Cannabis Regulations* require that plant destruction is witnessed by
**two individuals** and recorded with: date/time, quantity destroyed, reason, and both
witness signatures (or staff IDs). The waste log captures this digitally.
This is an immutable, append-only record.

### WasteLogModal Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Room | Auto | Yes | From selected room |
| Batch Number | Text | Yes | e.g. "3UC260112PE" |
| Waste Type | Select | Yes | Fan Leaves / Trim / Stalks / Root Ball / Full Plant / Other |
| Waste Reason | Select | Yes | Defoliation / Diseased / Dead Plant / Harvest Trim / Other |
| Weight (grams) | Number | Yes | Wet weight at time of disposal |
| Container / Bag ID | Text | No | Label on the waste bag/container |
| Date & Time | DateTime | Yes | Default: now, overrideable |
| Witness 1 Name | Text | Yes | Printed name |
| Witness 1 Staff ID | Text | Yes | Employee / badge number |
| Witness 2 Name | Text | Yes | Must differ from Witness 1 |
| Witness 2 Staff ID | Text | Yes | Must differ from Witness 1 ID |
| Performed By | Auto | Yes | From Stack Auth session |
| Photo | File | No | Strongly recommended — visual evidence |
| Notes | Textarea | No | |

**Validation:** Save button physically disabled until both witness name + ID fields are
filled for both witnesses, and Witness 1 ID ≠ Operator ID ≠ Witness 2 ID.

### Tile Indicator

When an active waste log is open (weight recorded but not yet witnessed/closed):
- Room tile shows a grey **WASTE** badge
- Badge clears once both witnesses are confirmed and log is saved

### Access

- **Create:** `grower` | `master_grower` | `director`
- **View:** all roles
- **Export:** `master_grower` | `director`

### Audit Trail

Every waste log write triggers an `EventLog` entry:
```
action: 'WASTE_LOG'
newValue: JSON.stringify({ plantCount, reason, witness1, witness2 })
```

---

## 9. Shift Summary View

No new data entry. Auto-compiled from the operator's `EventLog` records between
`shift_start` and `shift_end` timestamps.

### Trigger

**"End Shift"** button in the top nav bar — the only new persistent UI element
this plan adds to the main dashboard.

### Auto-Compiled Content

Grouped by room, ordered by timestamp:

```
F7
  08:14  Pot Check — Complete
  08:14  IPM Scout — Issue: spider mite (low) Zone 3

F8
  08:32  Pot Check — Complete
  08:33  IPM Scout — All Clear
  09:15  Spray Log — Sulfur 873, 30L, foliar, re-entry 4h

VEG 2
  10:05  Net Check — Lowered, all zip ties confirmed
  10:06  Filter Change — Complete
```

Summary stats:
- Rooms visited / rooms fully green vs. outstanding
- Total spray logs submitted
- Total pot checks logged
- Flags placed or moved
- Issues or Alerts raised
- Waste logs submitted

### Submission Form

```
┌──────────────────────────────────────────────┐
│  SHIFT SUMMARY — J. Smith                    │
│  07:02 – 16:04  ·  Mar 6, 2026              │
│                                              │
│  [Auto-compiled activity list above]         │
│                                              │
│  Shift Notes (optional)                      │
│  ┌────────────────────────────────────────┐  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│           [ Cancel ]  [ Submit Summary ]     │
└──────────────────────────────────────────────┘
```

### Output

Saved as a `shift_summaries` record. Visible to `master_grower` and `director`
in a feed (future admin view). Teams alert fires with a summary card on submit.

---

## 10. Data Model Additions

New tables required (additions to `worker/src/schema.ts`).
All use Drizzle ORM — no Prisma.

```ts
// Daily checklist per room per day
export const dailyChecklists = pgTable('daily_checklists', {
  id:             uuid('id').primaryKey().defaultRandom(),
  roomId:         text('room_id').notNull(),
  date:           date('date').notNull(),              // YYYY-MM-DD
  requiredTasks:  text('required_tasks').array(),      // ["pot_check","ipm_scout"]
  completedTasks: text('completed_tasks').array(),     // grows as logs are saved
  completedAt:    timestamp('completed_at'),
  generatedAt:    timestamp('generated_at').defaultNow(),
})

// IPM scout log
export const ipmScouts = pgTable('ipm_scouts', {
  id:         uuid('id').primaryKey().defaultRandom(),
  roomId:     text('room_id').notNull(),
  operatorId: text('operator_id').notNull(),
  scoutedAt:  timestamp('scouted_at').defaultNow(),
  allClear:   boolean('all_clear').notNull(),
  zones:      jsonb('zones'),   // [{ zoneId, pressureLevel, pestType }]
  notes:      text('notes'),
  photoUrl:   text('photo_url'),
})

// Pressure map snapshot per room (latest overwrites)
export const pressureMaps = pgTable('pressure_maps', {
  id:        uuid('id').primaryKey().defaultRandom(),
  roomId:    text('room_id').notNull(),
  zones:     jsonb('zones').notNull(), // { NW: { level, pestType }, NE: {...}, ... }
  updatedBy: text('updated_by').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// Waste log
export const wasteLogs = pgTable('waste_logs', {
  id:               uuid('id').primaryKey().defaultRandom(),
  roomId:           text('room_id').notNull(),
  operatorId:       text('operator_id').notNull(),
  batchId:          text('batch_id').notNull(),
  wasteType:        text('waste_type').notNull(),
  wasteReason:      text('waste_reason').notNull(),
  weightGrams:      doublePrecision('weight_grams').notNull(),
  containerId:      text('container_id'),
  destroyedAt:      timestamp('destroyed_at').notNull(),
  witness1Name:     text('witness1_name').notNull(),
  witness1StaffId:  text('witness1_staff_id').notNull(),
  witness2Name:     text('witness2_name').notNull(),
  witness2StaffId:  text('witness2_staff_id').notNull(),
  photoUrl:         text('photo_url'),
  notes:            text('notes'),
  createdAt:        timestamp('created_at').defaultNow(),
})

// Shift summaries
export const shiftSummaries = pgTable('shift_summaries', {
  id:             uuid('id').primaryKey().defaultRandom(),
  operatorId:     text('operator_id').notNull(),
  shiftStart:     timestamp('shift_start').notNull(),
  shiftEnd:       timestamp('shift_end').defaultNow(),
  roomsVisited:   text('rooms_visited').array(),
  completedRooms: text('completed_rooms').array(),
  note:           text('note'),
  createdAt:      timestamp('created_at').defaultNow(),
})
```

---

## 11. API Additions

```
# IPM Scout
GET  /api/ipm-scouts?roomId=X&limit=10   — recent scouts for room
POST /api/ipm-scouts                      — log a scout (with zones if issue found)

# Pressure Map
GET  /api/pressure-maps?roomId=X         — current pressure map for room
PUT  /api/pressure-maps/:roomId          — update zone pressure levels

# Waste Log
GET  /api/waste-logs?roomId=X            — list waste logs
POST /api/waste-logs                      — create (requires both witnesses)

# Shift Summary
GET  /api/shift-summaries                 — list (master_grower / director only)
POST /api/shift-summaries                 — submit shift (any authenticated user)
GET  /api/shift-summaries/preview         — auto-compile current shift from EventLog

# Daily Checklist
GET  /api/checklists/today?roomId=X      — today's checklist for a room
GET  /api/checklists/today               — all rooms, today
```

---

## 12. Implementation Priority

### Phase A — Scout & Checklist (highest ROI)

1. `ipm_scouts` table + `POST /api/ipm-scouts`
2. Scout UI in drawer OVERVIEW — "All Clear" / "Issue Found" + inline zone grid
3. `daily_checklists` table + Cloudflare Cron Trigger (06:00 daily)
4. Completion indicator — tile visual update via Durable Object broadcast

### Phase B — Pressure Map

5. Pressure zone rendering — SVG opacity tints on tile, driven by latest `ipm_scouts`
6. `pressure_maps` table + PUT endpoint
7. Teams alert on `high` pressure detection

### Phase C — End of Shift

8. "End Shift" button in top nav
9. Shift summary auto-compile — query EventLog, group by room, render
10. Submit shift summary — save to DB, Teams alert

### Phase D — Compliance Logging

11. Waste log form — double-witness validation, all fields
12. Waste log API — create + list
13. Export prep — data shape for CTS / Outlook

---

## 13. Package Recommendations

| Package | Purpose | Priority |
|---------|---------|---------|
| `react-hook-form` + `zod` | All modals (SprayLog, NetModal, PotCheck, etc.) | High |
| `@dnd-kit/core` | Drag-and-drop flags (replaces interact.js) | High |
| `framer-motion` | Tile state animations (green pulse, red alert pulse) | High |
| `Dexie.js` | IndexedDB offline queue — critical for floor use | High |
| `sonner` | Toast notifications (sync status, save confirmations) | High |
| `@tanstack/react-query` | Server state + cache invalidation on WS events | High |
| `@tanstack/react-table` | Log history tables (spray, waste, calibration) | Medium |
| `browser-image-compression` | Compress photos before R2 upload on slow WiFi | Medium |
| `recharts` | KPI panel — rooms complete %, IPM frequency, yield | Medium |
| `@react-pdf/renderer` | Shift summary + Health Canada-ready log exports | Medium |
| `date-fns` | Re-entry countdown, stage day counter, recurring task dates | Medium |

---

## 14. What We Are NOT Building Now

| Item | Reason |
|------|--------|
| Seed-to-sale / batch genealogy | Custom API bridge later |
| Automated phase transitions | Linked via model days API later |
| Nutrient / recipe tracking | Not a gardener concern |
| Strain library | Post-MVP |
| Yield predictor | Needs historical harvest data first |
| CTS / B-300 Health Canada report | Post-MVP — needs waste log data first |
| Multi-facility | Post-MVP |
| Biological agent tracking | Post-MVP |
| Clone / propagation tracking | Post-MVP |

---

## UX Constraints (Non-Negotiable)

- **No modal for "All Clear"** — must complete in the drawer, zero context switches
- **Pressure zone grid** — touch targets minimum 44 × 44px, no overlapping labels
- **Waste log** — save button physically disabled until both witnesses entered
- **Shift summary** — zero required typing; the optional note is the only input
- **Completion indicators** — must update within 2 seconds of the last log saving, across all connected clients
- **Offline tolerance** — scout logs, pot checks, and filter changes queue offline and sync on reconnect; waste log requires connectivity (witness integrity)
- **Speed budget** — "nothing to report" IPM round: 2 taps per room. Pot check healthy room: 1 tap. Filter change done: 1 tap.
