# MTL Mission Control — Application Design & Data Specification

**Project:** MTL Mission Control — Cultivation Facility Isometric Dashboard  
**Author:** Austin O'Neill  
**Repository:** https://github.com/AustinONeill/MTL-MissionControl  
**Date:** March 5, 2026
**Last Updated:** March 9, 2026 — Implementation status audit; PreVeg zone map; gardener YES/NO logs; zone transfer history lines

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Use Case Analysis](#2-use-case-analysis)
3. [Assets](#3-assets)
4. [Library & Service Usage](#4-library--service-usage)
5. [Component & Module Breakdown](#5-component--module-breakdown)
6. [Data Flow Diagram](#6-data-flow-diagram)
7. [Process Flow](#7-process-flow)
8. [Offline & Resilience Strategy](#8-offline--resilience-strategy)
9. [Compliance & Audit Trail](#9-compliance--audit-trail)
10. [Data Sources](#10-data-sources)
11. [CRUD Operations](#11-crud-operations)
12. [Data Storage & Schema](#12-data-storage--schema)
13. [API Endpoint Specification](#13-api-endpoint-specification)
14. [Responsive Design Strategy](#14-responsive-design-strategy)
15. [Integration Architecture](#15-integration-architecture)
16. [Deployment Architecture](#16-deployment-architecture)
17. [Transfer Feature Specification](#17-transfer-feature-specification)
18. [Site Calendar](#18-site-calendar)
19. [Future Features](#19-future-features)
20. [Testing Strategy](#20-testing-strategy)
21. [References](#21-references)

---

## 1. System Architecture

The application is divided into three distinct layers to ensure separation of concerns, maintainability, and scalability. The entire stack runs on Cloudflare's edge network.

### Presentation Layer

- Renders the isometric facility map using SVG with CSS transforms, deployed on **Cloudflare Pages**.
- Displays the live-time header with a real-time clock updated every second.
- Renders a **mode badge and/or animation** on each room tile indicating its current operational mode (OFF, AUTO, CROP, FILL).
- Manages the toolbox panel with draggable/droppable flag components (desktop) and tap-to-select/tap-to-assign (mobile).
- Adapts all UI elements responsively across desktop, tablet, and mobile viewports.
- Provides visual feedback on flag placement, drag interactions, status changes, and spray re-entry countdowns.

### Application Layer

- Controls drag-and-drop logic for overlays on desktop via the **HTML Drag and Drop API** (interact.js was evaluated but not adopted — see §4).
- Controls two-step tap-to-assign on mobile: operator taps a flag to select it, then taps a room tile to assign it.

> **⚑ Mar 2026 — Implementation Note:** interact.js is not installed or used. Overlay drag-and-drop uses the native HTML Drag and Drop API throughout. The client `package.json` has no interact.js dependency.
- Manages flag state, room mode state, and re-entry countdown timers.
- Interfaces with the backend via REST (Hono on Cloudflare Workers) and real-time WebSocket (Cloudflare Durable Objects).
- Handles the responsive layout engine — recalculating isometric tile positions on viewport resize.

### Data / Integration Layer

- REST API built with **Hono** running on **Cloudflare Workers** — fully serverless, zero cold-start overhead.
- Real-time multi-user state and conflict resolution via **Cloudflare Durable Objects** (one DO instance per room, identified by `roomId`).
- Authentication and role-based session management handled by **Stack Auth**.
- Photo attachments stored and compressed in **Cloudflare R2**.
- Persistent relational data in **Neon** (serverless PostgreSQL) via **Drizzle ORM** with `@neondatabase/serverless`.
- Microsoft Teams integration for outbound alerts and inbound bot queries.
- Microsoft Graph API for Outlook Calendar read/write.

---

## 2. Use Case Analysis

### Actors

- **Gardener** — Day-to-day floor operator; logs events, assigns overlays, records spray and calibration entries.
- **Pest Control Specialist** — Creates and manages spray logs; views IPM flag history and re-entry countdowns.
- **Control / Automation Engineer** — Manages calibration logs for sensors and equipment; monitors room modes.
- **Master Grower / Supervisor** — Views and updates room modes and overlay state across all rooms; provides mandatory SUPV/APPV sign-off on spray log entries. The supervisor sign-off field is role-gated — only users with `master_grower` or `director` role can populate it, identified via Stack Auth session.
- **Director of Cultivation** — Full read/review access across all rooms, logs, and reports; can purge audit records.
- **Teams Bot** — Automated agent that sends/receives alerts tied to room overlays via Microsoft Teams.
- **Outlook Calendar** — External scheduling service used as an export target for milestone events only (not the primary scheduling interface — see Section 18).

### Use Cases

**UC-01: View Isometric Facility Map**  
Actor: All roles  
Precondition: User is authenticated via Stack Auth.  
Flow: App loads the isometric map; tiles scale and reflow to fit the viewport; room mode badges and animations render immediately; live clock updates continuously.  
Postcondition: Full map is visible; each room displays its current mode and active flags.

**UC-02: Assign Flag to Room (Desktop — Drag & Drop)**  
Actor: Gardener, Pest Control Specialist, Master Grower  
Precondition: User is on a desktop/tablet viewport.  
Flow: Operator drags a flag from the toolbox; map rooms highlight as valid drop targets; flag snaps to room on drop and persists.  
Postcondition: Room state updates; Durable Object broadcasts change to all connected clients; connected services notified if configured.

**UC-03: Assign Flag to Room (Mobile — Tap to Assign)**  
Actor: Gardener, Pest Control Specialist, Master Grower  
Precondition: User is on a mobile viewport.  
Flow: Operator taps a flag in the toolbox drawer (highlighted active state); all room tiles show ready-to-receive highlight; operator taps a room tile; flag assigned, `selectedFlagId` clears.  
Postcondition: Room state updates identically to desktop path.

**UC-04: Move Flag Between Rooms**  
Actor: Gardener, Master Grower  
Precondition: A flag is already assigned to a room.  
Flow: Operator drags (desktop) or re-selects and taps (mobile) to move a flag to a new room; old room clears; new room receives the flag.  
Postcondition: State updated and logged with timestamp and operator ID.

**UC-05: View and Update Room Mode**  
Actor: Master Grower, Control / Automation Engineer  
Precondition: User has `master_grower` or `director` role.  
Flow: Operator opens room detail drawer; selects new mode from dropdown; tile badge and animation update across all connected clients via Durable Object broadcast.  
Postcondition: Room mode persisted and visible on the map in real time.

**UC-06: Log Spray Event**  
Actor: Pest Control Specialist, Gardener (operator fields); Master Grower / Director (SUPV/APPV sign-off)  
Precondition: IPM overlay is placed on a room.  
Flow: SprayLog modal opens (matching F-005 form); operator fills all required fields including batches, pesticide, times, reason, method, equipment, ratio, and quantity. The SUPV/APPV field is visible to all but **writeable only by users with `master_grower` or `director` role** (Stack Auth role claim enforced both client-side and on the API). On save: entry persisted; re-entry countdown rendered on tile from lookup table (or manual override); Teams alert sent if configured.  
Postcondition: SprayLog persisted; room tile shows re-entry countdown badge.

**UC-07: Log Calibration Event**
Actor: Control / Automation Engineer
Precondition: User accesses calibration log from room drawer or toolbox.
Flow: Operator selects equipment type, records pre/post readings, calibration standard, pass/fail, date, and optional notes. Entry saved to calibration log.
Postcondition: Calibration record persisted and visible in room event history.

> **⚑ Mar 2026 — Implementation Note:** UC-07 is **deferred**. `CalibrationLogModal` and `CalibrationLogList` have been removed from the client. The RoomDrawer no longer has a CALIBRATION tab. The `calibration_logs` table exists in the Drizzle schema and the `/api/calibration-logs` routes are spec'd (§13) but are not wired into the deployed worker. Calibration logging is a Phase C item in the GardenerPlan.

**UC-08: Attach Photo to Log Entry**  
Actor: Any role  
Precondition: User is creating a QuickLog, spray log, or calibration log entry.  
Flow: Operator taps photo attachment button; selects or captures image; client fetches pre-signed R2 URL from backend; image uploaded directly to R2; URL stored with log entry.  
Postcondition: Photo thumbnail visible on the log entry in the room drawer.

**UC-09: Receive Teams Alert**  
Actor: All roles, Teams Bot  
Precondition: Teams integration configured; flag or spray event triggered.  
Flow: Backend detects event; posts Adaptive Card to configured Teams channel webhook.  
Postcondition: Team receives notification with room name, event type, and operator.

**UC-10: Transfer Room Contents (Two-Step Assignment)**  
Actor: Gardener, Master Grower  
Precondition: Rooms exist; transfer flag visible in LegendPanel.  
Flow (Desktop): Operator drags the ⇄ Transfer flag onto the **origin** room — the room begins flashing amber and a status banner "SELECT DESTINATION — ESC to cancel" appears. Operator drags the Transfer flag onto the **destination** room — an animated amber dashed line with arrowhead connects the two rooms and the origin room retains the ⇄ symbol.  
Flow (Mobile): Operator taps the ⇄ Transfer flag in the LegendPanel (selectedFlagId = 'transfer'). Taps origin room — flashes begin. Taps destination room — line connects them.  
Postcondition: Transfer record created in Zustand `transfers` state keyed by originId. Line visible on map. Opening the origin room's drawer shows a Transfer info card with destination, type, scheduled date, and notes.  
Cancel: Press Escape (desktop) to cancel the pending origin selection; transfer symbol removed.

**UC-11: Edit or Remove a Transfer**  
Actor: Gardener, Master Grower  
Precondition: Transfer has been assigned (origin + destination set).  
Flow: Operator opens origin room drawer → sees Transfer card → clicks "✏ Edit Transfer" → TransferModal opens. Can change destination room, transfer type, scheduled date/time, and notes. Can click "Remove Transfer" to delete the record and remove the connecting line.  
Postcondition: Transfer record updated or deleted; line on map updated accordingly.

**UC-12: Query Room Status via Teams Bot**  
Actor: Any role  
Precondition: Teams bot deployed and active in the team's channel.  
Flow: User sends "Status [Room Name]" in Teams channel; bot queries DB; replies with Adaptive Card showing mode, active flags, last spray log, and timestamp.  
Postcondition: User receives up-to-date status summary inside Teams.

**UC-13: Sync Harvest Event to Outlook Calendar**  
Actor: Master Grower, Director of Cultivation  
Precondition: Microsoft Graph API credentials configured; harvest flag placed.  
Flow: Backend creates calendar event via Graph API `POST /me/events` with room name, date, and operator details.  
Postcondition: All team members with calendar access see the scheduled harvest.

**UC-12: Responsive Layout on Mobile**
Actor: All roles
Precondition: User accesses dashboard on a phone or tablet.
Flow: Viewport resize triggers responsive engine; tiles rescale via CSS custom property; toolbox collapses into bottom drawer; drag-and-drop replaced with two-step tap-to-assign.
Postcondition: Full functionality available on touch screens without drag gestures.

> **⚑ Mar 2026 — Implementation Note:** There is a **duplicate UC-12** numbering above (UC-12: Query Room Status via Teams Bot and UC-12: Responsive Layout). The responsive layout use case should be renumbered UC-14. Additionally, pot_check and filter_change overlays are **not** in the LegendPanel toolbox — they are accessed only via the room drawer's POT CHECK and FILTER CHANGE tabs.

---

## 3. Assets

### Isometric Map Tiles

- Custom SVG tiles per room type: Veg, Flower, Dry, Support, Office.
- Each tile type has a distinct roof color to visually distinguish room categories.
- Format: SVG preferred for resolution-independence; PNG fallback.

### Room Mode Badges & Animations

- Each room tile renders a small badge in the top corner showing its current mode (e.g., "VEG", "FLOWER", "FLUSH").
- Certain modes trigger a CSS animation on the tile (e.g., pulse for Maintenance, shimmer for Flush, glow for Harvest Ready).
- Badge colors map to a consistent mode color palette defined in the design system.

> **⚑ Mar 2026 — Implementation Note:** Room modes have been revised. The valid mode values are **`off | auto | crop | fill`** — the old names (veg, flower, flush, dry, maintenance, idle) are no longer used. The mode select dropdown in RoomDrawer reflects these four values. Any reference in this spec to "VEG", "FLOWER", "FLUSH", or "MAINTENANCE" modes should be treated as historical.

### Flag Icons

- SVG icons for each flag type: IPM, Defoliation, Transfer, Mode Change, Supply Ready, Calendar, Issue.
- Legible at small sizes on high-density (Retina) screens.

### Fonts

- Primary: Inter or Roboto (Google Fonts) for dashboard UI text.
- Monospace: JetBrains Mono for the live clock and status codes.

---

## 4. Complete Technology Stack

### Frontend

| Technology | Version | Role |
|-----------|---------|------|
| **React** | 19.2 | Component-based UI framework |
| **Vite** | 7.3 | Build tool, dev server, HMR |
| **Zustand** | 5.0 | Lightweight client-side state management |
| **@stackframe/stack** | 2.8 | Stack Auth client SDK (sign-in UI, session management) |
| **SVG (native)** | — | Isometric map rendering — pure SVG polygons, no canvas |
| **CSS Custom Properties** | — | Theming (`--surface`, `--border`, `--text`, `--font-mono`) |
| **HTML Drag and Drop API** | — | Overlay drag-from-toolbox to room tile |

**Deployment:** Cloudflare Pages (direct Wrangler deploy from `dist/`)

**No** React Router (single-page, no routes), Day.js, interact.js, or any charting library.

---

### Auth

| Technology | Version | Role |
|-----------|---------|------|
| **Stack Auth** | 2.8 | Hosted auth — Microsoft OAuth, JWT issuance, role claims |
| **jose** | 5.10 | JWT signature verification in Cloudflare Workers (JWKS fetch) |
| **Microsoft OAuth / Azure AD** | — | Identity provider via Stack Auth |

**Roles:** `grower` · `master_grower` · `director` — stored as JWT claim, enforced per-endpoint in worker middleware.

---

### Backend

| Technology | Version | Role |
|-----------|---------|------|
| **Cloudflare Workers** | — | Serverless edge runtime, zero cold-start, global PoPs |
| **Hono** | 4.7.7 | Web framework — routing, middleware, typed context |
| **TypeScript** | 5.8 | Strict mode, `noUnusedLocals`, `noUnusedParameters` |
| **Drizzle ORM** | 0.41 | Type-safe SQL query builder, schema-as-code |
| **drizzle-kit** | 0.30 | Schema push (`drizzle-kit push`), studio, migrations |
| **@neondatabase/serverless** | 0.10.4 | Neon HTTP driver — no persistent TCP, works in Workers |
| **Cloudflare Durable Objects** | — | 1 DO instance per room — WebSocket hub + real-time broadcast |
| **Cloudflare Hyperdrive** | — | Connection pooling from Workers to Neon (ID: `387df7aa`) |
| **aws4fetch** | 1.0.20 | AWS Signature V4 for R2 presigned PUT URL generation |

**Entry point:** `worker/src/worker.ts` — Hono app with all routes mounted under `/api/*`.

**Routes:**
```
GET  /health                          — public health check
GET  /api/me                          — current user profile
GET  /api/rooms                       — all rooms with active overlays
PATCH /api/rooms/:id                  — update room mode
GET/POST /api/rooms/:id/overlays      — overlay CRUD
PATCH/DELETE /api/rooms/:id/overlays/:oid
GET/POST /api/spray-logs              — F-005 pesticide logs
GET/POST /api/net-logs                — net operation logs
GET/POST /api/pot-check-logs          — pot health checks
GET/POST /api/filter-change-logs      — filter replacement records
POST /api/photos/presign              — R2 presigned upload URL
GET  /api/events                      — audit event log
GET  /api/flags                       — 410 Gone (deprecated, use overlays)
GET  /ws/rooms/:id                    — WebSocket upgrade to Durable Object
POST /webhooks/teams                  — Bot Framework inbound (HMAC auth)
```

---

### Database

| Technology | Version | Role |
|-----------|---------|------|
| **Neon** | — | Serverless PostgreSQL — primary relational store |
| **Drizzle ORM** | 0.41 | Schema definition, query builder, type inference |
| **Cloudflare Hyperdrive** | — | Connection pool between Workers and Neon |

**Schema file:** `worker/src/schema.ts`

**Tables:** `rooms`, `overlays`, `spray_logs`, `net_logs`, `pot_check_logs`, `filter_change_logs`, `event_logs`

**Schema management:** `drizzle-kit push` (push directly to Neon — no migration files in dev).

---

### Storage

| Technology | Role |
|-----------|------|
| **Cloudflare R2** | S3-compatible binary storage for photo attachments |
| **aws4fetch** | Signs presigned PUT requests from the Worker |
| **Direct client upload** | Client PUTs directly to R2 via presigned URL — Worker never proxies file bytes |

---

### Real-time

| Technology | Role |
|-----------|------|
| **Cloudflare Durable Objects** | One DO per `roomId` — holds active WebSocket connections |
| **WebSocket** | Client connects to `/ws/rooms/:id`, DO broadcasts `ROOM_UPDATED` messages |
| **Zustand WS listener** | `connectRoomWs(roomId)` — updates room state on `ROOM_UPDATED` events, reconnects after 3s on close |

---

### Integrations

| Technology | Role |
|-----------|------|
| **Microsoft Teams — Incoming Webhooks** | Outbound alerts (Adaptive Cards) for IPM, spray, critical pot checks |
| **Microsoft Bot Framework** | Inbound bot queries — HMAC-authenticated webhook at `/webhooks/teams` |
| **Microsoft Graph API** | Outlook calendar read/write (`/me/events`) for site tasks |
| **Azure AD** | OAuth identity provider, shared app registration for Teams + Graph |

---

### DevOps & Tooling

| Technology | Role |
|-----------|------|
| **Wrangler CLI** | Deploy Workers, Durable Objects, Pages; manage secrets |
| **Cloudflare Pages** | Static hosting + SPA redirect (`_redirects`) |
| **GitHub Actions** | CI/CD pipeline — lint → build → deploy on push to `main` |
| **ESLint** | Client-side linting |
| **TypeScript strict** | Worker — `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` |

---

### Environment Variables

**Worker secrets** (set via `wrangler secret put`):
```
DATABASE_URL                  Neon PostgreSQL connection string
STACK_AUTH_JWKS_URL           https://api.stack-auth.com/api/v1/projects/<id>/.well-known/jwks.json
STACK_AUTH_PROJECT_ID         Stack Auth project ID
R2_ACCOUNT_ID                 Cloudflare account ID
R2_ACCESS_KEY_ID              R2 access key
R2_SECRET_ACCESS_KEY          R2 secret key
R2_BUCKET_NAME                e.g. mtl-photos
R2_PUBLIC_BASE_URL            CDN base URL for photo delivery
TEAMS_WEBHOOK_URL             Incoming webhook URL for Teams channel
BOT_FRAMEWORK_APP_ID          Azure AD app ID for bot
BOT_FRAMEWORK_APP_SECRET      Azure AD app secret for bot
AZURE_AD_CLIENT_ID            Azure AD client ID (Graph API)
AZURE_AD_CLIENT_SECRET        Azure AD client secret (Graph API)
AZURE_AD_TENANT_ID            Azure AD tenant ID
```

**Client env** (`.env.local`, prefix `VITE_` for Vite exposure):
```
VITE_API_BASE_URL             https://mtl-missioncontrol-api.austinoneill55.workers.dev
VITE_STACK_PROJECT_ID         Stack Auth project ID (public)
VITE_R2_PUBLIC_BASE_URL       CDN base URL for photo thumbnails
```

---

## 5. Component & Module Breakdown

### IsometricMap

- Renders all room tiles in the correct isometric grid layout.
- Each tile receives `id`, `name`, `position (col, row)`, `mode`, `overlays[]`, and `reEntryExpiresAt` from state.
- Renders a `RoomModeBadge`, optional `ReEntryBadge`, and any active `OverlayBadge` components on each tile.
- Each tile is a drop target (interact.js desktop) and tap target (mobile).
- Listens for WebSocket messages from the room's Durable Object to update state in real time.

> **⚑ Mar 2026 — Implementation Note:** interact.js is not used. Tiles use native HTML `onDragOver`/`onDrop` event handlers. Overlay glyphs on tiles are clickable: ✂ opens the DefoliationModal, 🕸 opens the NetModal via `openNetLog(roomId)` in the store. The `PREVEG` room tile renders an embedded `PreVegZoneMap` component (intra-room batch zone tracking) — this sub-feature is not documented in §17.

### RoomModeBadge

- Small overlay on the top corner of each tile.
- Displays a short mode label with a color-coded background.
- Applies CSS animation class based on mode: `animate-pulse` (Maintenance), `animate-shimmer` (Flush), `animate-glow` (Harvest Ready).
- Props: `mode: string`.

### ReEntryBadge

- Separate overlay for the spray re-entry countdown.
- Uses a `useInterval` hook recalculating `dayjs(reEntryExpiresAt).diff(dayjs(), 'minute')` every 60 seconds.
- `> 60 min`: shows remaining hours, green background.
- `1–60 min`: shows remaining minutes, amber background.
- `0 or expired`: shows "CLEARED", green background; store clears `reEntryExpiresAt` for the room.
- Props: `reEntryExpiresAt: string | null`.

> **⚑ Mar 2026 — Implementation Note:** Day.js is **not installed**. The `ReEntryBadge` component, if implemented, must use native `Date` arithmetic (`Date.now()`, `new Date(reEntryExpiresAt).getTime()`) instead of `dayjs()`. As of March 2026 the re-entry countdown badge tile render is not yet implemented in `IsometricMap.jsx`.

### Header

- Facility name left, live clock right.
- Clock updates every 1000ms via `setInterval`.
- On mobile, collapses facility name to a monogram.

### Toolbox / LegendPanel

- Lists all overlay types as draggable items (desktop) or tappable cards (mobile).
- Legend maps overlay icon → meaning and mode badge → meaning.
- On mobile, renders as a bottom drawer toggled by a floating action button.

### Overlay System

Each overlay placed on a room tile is a full **Overlay Object** — not just an icon. The overlay type determines which modal opens, what options are stored, and what badge renders on the tile.

```ts
interface Overlay {
  id: string
  roomId: string
  overlayType: OverlayType
  options: Record<string, unknown>  // type-specific payload
  status: 'active' | 'completed' | 'pending_review'
  placedBy: string        // Stack Auth user ID
  placedAt: Date
  updatedBy?: string
  updatedAt?: Date
  notificationSent: boolean
}
```

**Overlay Types:**

| Type | Icon | Modal | Recurring? |
|---|---|---|---|
| IPM / Spray | Bug icon | SprayLog form (F-005) | No |
| Net | Net icon | NetModal | No — 1st/2nd net milestone |
| Pot Check | Pot icon | PotCheckModal | Daily |
| Filter Change | Filter icon | FilterChangeModal | Twice weekly |
| Defoliation | Leaf icon | Simple log: operator, date, notes | No |
| Transfer | Arrow icon | TransferModal | No |
| Harvest Ready | Calendar icon | Triggers Outlook export, links to harvest date | No |
| Mode Change | Badge icon | Dropdown mode selector | No |
| Supply Ready | Box icon | Simple confirmation + notes | No |
| Issue / Alert | Warning icon | Free-text description, severity, photo | No |

**Overlay Interaction Rules:**
- **Tap/click placed overlay** → opens the overlay's modal in edit mode (all fields pre-populated)
- **Long-press (mobile) / right-click (desktop)** → context menu: Edit | Mark Complete | Remove
- **Remove** → confirmation dialog: "Remove [Type] from [Room]? This will be logged." → creates an `EventLog` entry with action `OVERLAY_REMOVED`
- **Mark Complete** → changes status to `completed`; overlay icon dims on tile but remains visible in history

### RoomDrawer

- Slide-in detail panel for a selected room.
- Displays: room name, current mode (editable dropdown for `master_grower`+), active overlays, `SprayLogList`, `CalibrationLogList`, `NetLogList`, `PotCheckLogList`, `FilterChangeLogList`, recent event log with photo thumbnails.
- Action buttons: Log Event, Log Spray, Log Calibration, View Timeline.

> **⚑ Mar 2026 — Implementation Note:** The implemented RoomDrawer has **four tabs**: OVERVIEW | SPRAY LOGS | POT CHECK | FILTER CHANGE. There is no CALIBRATION tab, no event log list, and no action buttons (Log Event, Log Calibration, View Timeline have all been removed). The OVERVIEW tab shows: active flag chips (with inline edit buttons for defoliation/net), the active transfer card, and the PreVegZoneMap (for the PREVEG room only). POT CHECK and FILTER CHANGE tabs render a simple YES/NO interface with signed-in user attribution — no complex modal or form. `CalibrationLogList`, `NetLogList`, `PotCheckLogList`, and `FilterChangeLogList` are not implemented as separate components.

### SprayLogList

- Sub-component of RoomDrawer.
- Renders all spray log entries for the room sorted by `appliedAt` descending.
- Each entry shows: pesticide, batches, operator, supervisor sign-off, date/times, re-entry expiry, photo thumbnail.

### CalibrationLogList

- Sub-component of RoomDrawer.
- Renders all calibration log entries sorted by `calibratedAt` descending.
- Each entry shows: equipment type, pre/post readings, pass/fail chip, operator, date, photo thumbnail.

### SprayLogModal

Matches MTL Cannabis Form **F-005 (Pesticides, Rev. 05, CC-2023-007)** exactly.

| Field | Type | Notes |
|---|---|---|
| Room | Auto-filled | From the room the IPM overlay was placed on |
| Batch(es) | Text input | e.g. "3UC260112PE" — supports multi-batch entry |
| Pesticide | Text input | Product name + registration number e.g. "Sulfur 873" |
| Date | Date picker | Application date |
| Start Time | Time picker | 24h format e.g. "08h30" |
| End Time | Time picker | 24h format e.g. "10h30" |
| Reason | Checkbox group | "Preventative" / "Treatment" (both selectable) |
| Method | Checkbox group | "Foliar Spray" / "Dip" |
| Equipment Number | Text input | e.g. "Pest-01", "Pest-02" |
| Equipment Name | Text input | e.g. "MSO Sprayer", "Chapin 20000" |
| Ratio | Text input | e.g. "22g/15L", "2.5ml/L" |
| Quantity | Text input | e.g. "30L", "8L" |
| Performed By | Auto-filled | Stack Auth session (operator name/initials) |
| SUPV / APPV | User selector | **Role-gated: only `master_grower` or `director` can populate** |
| Notes | Textarea | Optional |
| Photo | File/camera | Optional — uploads to R2 |

**Re-Entry Interval:** Calculated automatically from a pesticide lookup table; displayed on the tile as a countdown. An override field is available if the product is not in the table.

On submit: `POST /spray-logs`; `reEntryExpiresAt` calculated server-side; Durable Object broadcasts updated countdown to all clients; Teams alert fires.

### NetModal

Opens when a Net overlay is placed or tapped on a room. Features an interactive SVG graphic of the room from above with the net in the lowered position.

| Field | Type | Notes |
|---|---|---|
| Net Number | Radio | "1st Net" / "2nd Net" |
| Net Action | Radio | "Spread" / "Bend" |
| Net Status | Radio | "Lowering" / "Lowered & Checked" |
| Zip Tie Check — Row A | Checkbox row | Per-anchor checkboxes |
| Zip Tie Check — Row B | Checkbox row | Per-anchor checkboxes |
| Zip Tie Check — Row C | Checkbox row | Per-anchor checkboxes |
| Zip Tie Check — Row D | Checkbox row | Per-anchor checkboxes |
| All Zip Ties Confirmed | Auto-computed | True only if all anchors checked |
| Operator | Auto-filled | Stack Auth session |
| Date | Auto-filled | Current date/time |
| Notes | Textarea | Optional |
| Photo | File/camera | Optional |

**SVG Zip Tie Graphic:** Anchor points are interactive circles. Tapping an anchor toggles its checkbox — visual and form stay in sync. Anchors are red when unchecked, green when checked. The Save button is disabled until all anchors are marked.

**Net Overlay on Room Tile:** Displays "N1" or "N2" badge. Spread = blue badge, Bend = purple badge. Once all zip ties confirmed, badge gets a green checkmark.

> **⚑ Mar 2026 — Implementation Note:** The NetModal has been redesigned to a **two-card sequential flow**: Card 01 — tap to confirm net lowered (activates the SVG top-view animation); Card 02 — tap to confirm all zip ties secured (unlocked after Card 01). The per-anchor checkbox grid (`Row A/B/C/D`) is not implemented. The Net glyph (🕸) on the IsometricMap tile is clickable and triggers `openNetLog(roomId)` in the store. NetModal can also be opened from the flag-chip edit button in RoomDrawer.

### PotCheckModal

Daily recurring task. Opened from the room tile's "POT" badge or the room drawer.

| Field | Type | Notes |
|---|---|---|
| Room | Auto-filled | |
| Check Date | Auto-filled | Today |
| Standing Water Present | Radio | Yes / No |
| Water Removed | Conditional checkbox | Visible only if "Yes" |
| Root Health | Radio | "Healthy" / "Concern" / "Critical" |
| Notes | Textarea | Required if Root Health is Concern or Critical |
| Photo | File/camera | Required if Root Health is Critical |
| Performed By | Auto-filled | Stack Auth session |

**Scheduling:** Internal calendar auto-generates a Pot Check task for every active grow room every day. If not logged by configurable cutoff (e.g. 14h00), room tile shows yellow "POT" badge; after cutoff it turns red and a Teams alert fires to the Master Grower.

> **⚑ Mar 2026 — Implementation Note:** `PotCheckModal` is **not implemented** as a modal. Pot Check is instead a drawer tab (POT CHECK) with a simple YES/NO interface: two large tap-friendly buttons. On YES: `POST /api/pot-check-logs` with `{ roomId, completed: true, rootHealth: 'healthy' }`. On NO: posts with `rootHealth: 'concern'`. A signed-as name and timestamp display for 5 seconds after submission. The detailed field form (standing water, root health radio, conditional photo) is a planned enhancement (GardenerPlan Phase B). The overdue badge/cutoff scheduling system is not yet implemented.

### FilterChangeModal

Twice-weekly recurring task. Opened from the room tile's "FLT" badge or the room drawer.

| Field | Type | Notes |
|---|---|---|
| Room | Auto-filled | |
| Change Date | Auto-filled | Today |
| Filter Type | Select | "Carbon Filter" / "Pre-Filter" / "HEPA" / "Other" |
| Filter Size | Text input | e.g. "4 inch", "6 inch" |
| Old Filter Condition | Radio | "Normal" / "Heavily Loaded" / "Damaged" |
| New Filter Installed | Checkbox | Must be checked to save |
| Equipment Number | Text input | Optional |
| Performed By | Auto-filled | |
| Notes | Textarea | Optional |
| Photo | File/camera | Optional |

**Scheduling:** Internal calendar auto-generates Filter Change tasks twice per week per room (configurable days, e.g. Mon/Thu). Room tile shows an "FLT" badge (orange) when due; clears once logged.

> **⚑ Mar 2026 — Implementation Note:** `FilterChangeModal` is **not implemented** as a modal. Filter Change is a drawer tab (FILTER CHANGE) with the same YES/NO interface as Pot Check. On YES: `POST /api/filter-change-logs` with `{ roomId, completed: true, newInstalled: true }`. The detailed form (filter type, size, condition) is deferred. Overdue badge/scheduling not implemented.

### CalibrationLogModal

- Opens from RoomDrawer or toolbox action.
- Fields: equipment type, pre-calibration reading, calibration standard, post-calibration reading, pass/fail, operator (auto-filled), date/time, optional notes, optional photo.
- On submit: `POST /calibration-logs`.

> **⚑ Mar 2026 — Implementation Note:** `CalibrationLogModal` is **not implemented** and does not exist in the client codebase. It was removed along with the CALIBRATION drawer tab. Deferred to GardenerPlan Phase C.

### IntegrationService (Worker module)

- `sendTeamsAlert(roomName, eventType, channelWebhookUrl)` — posts Adaptive Card; retries with exponential backoff × 3 on failure.
- `listenTeamsBotMessage(req)` — parses Bot Framework activity, handles "Status [Room]" commands.
- `createOutlookEvent(roomName, date, title)` — Graph API call with Bearer token; used only for milestone events exported from the Site Calendar.
- `updateOutlookEvent(eventId, updates)` — Graph API PATCH for rescheduled milestones.
- `deleteOutlookEvent(eventId)` — Graph API DELETE for cancelled milestones.
- `presignR2Upload(roomId, logType)` — generates pre-signed R2 PUT URL.

### RoomDurableObject (Cloudflare Durable Object)

- One instance per `roomId`, identified by `env.ROOM_DO.idFromName(roomId)`.
- Accepts WebSocket upgrade requests from browser clients.
- Maintains a set of active WebSocket connections.
- On `broadcast(message)` call from a Worker: sends message to all connected sockets.
- On client WebSocket close: removes from connection set.

### PreVegZoneMap

> **⚑ Mar 2026 — New Component (not in original spec):** `PreVegZoneMap` is embedded inside the PREVEG room's Overview tab in RoomDrawer. It renders an SVG zone map of the pre-veg room divided into 6 zone groups (pairs of propagation tables: zones 1–2, 3–4, 5–6, 7–8, 9–10, and "Dome"). Four named batches (Early Cuts, Mid Cuts, Late Cuts, Clones) each occupy one zone group. Operators can move a batch to a different zone group (swap if occupied). Moves record a `zoneHistory` trail rendered as animated quadratic bezier arcs routed around zone cells. Undo is available per batch. State lives in `facilityStore.prevegBatches` (Zustand, client-side only).

### StateStore (Zustand)

- `rooms`: map of `roomId → { name, mode, overlays: Overlay[], reEntryExpiresAt, lastUpdated }`
- `overlayDefinitions`: list of overlay types (type, icon, color, notificationEnabled)
- `selectedOverlayType`: overlay type currently selected on mobile (null otherwise)
- `integrations`: Teams webhook URL, Graph API token, notification preferences
- `wsConnections`: map of `roomId → WebSocket` for Durable Object connections
- `siteTasks`: map of `taskId → SiteTask` for calendar task state

> **⚑ Mar 2026 — Implementation Note:** The Zustand store (`facilityStore.js`) also holds: `authUser` (Stack Auth user object), `transfers` (room transfer records, client-side only), `pendingTransferOrigin`, `netLogRoomId`/`openNetLog`/`closeNetLog` (net modal trigger), and `prevegBatches`/`movePrevegBatch`/`undoPrevegBatchMove` (PreVeg zone tracking). `siteTasks` is not yet implemented. `selectedOverlayType` maps to `selectedSymbol` in the actual implementation.

---

## 6. Data Flow Diagram

```
[Operator Browser — Cloudflare Pages]
      |
      |  drag/drop (desktop) | tap-to-assign (mobile)
      v
[IsometricMap + Flag + RoomModeBadge + ReEntryBadge]
      |
      |  onFlagAssign / onModeChange / onSprayLog / onCalibrationLog
      v
[Zustand StateStore]
      |
      |  REST call (Hono / Cloudflare Workers)
      v
[Hono Worker — API Layer]
      |            |                     |
      |            | persist             | notify
      v            v                     v
[Neon PostgreSQL] [Durable Object]  [Teams Webhook]
  (via Drizzle)       |             [Graph API → Outlook]
                      |
                      | WebSocket broadcast
                      v
            [All connected browsers
             update in real time]
```

---

## 7. Process Flow

### Map Initialization

1. Stack Auth validates session token; role claims attached to request context.
2. App fetches room states from `GET /rooms` (mode, active flags, `reEntryExpiresAt`).
3. Browser opens a WebSocket to each room's Durable Object for real-time updates.
4. Tiles render with mode badges, animations, and re-entry countdowns.
5. `selectedFlagId` initializes to null.

### Flag Assignment

1. Desktop: interact.js fires drop → `onFlagAssign(flagId, roomId)`. Mobile: tap-to-assign fires same event.
2. Zustand store updates optimistically.
3. `PATCH /rooms/:id` persists with `operatorId` from Stack Auth session; appends `EventLog` record.
4. Worker calls `ROOM_DO.idFromName(roomId)` → Durable Object broadcasts updated room state to all WebSocket clients.
5. If `notificationEnabled: true`, `sendTeamsAlert()` fires (with retry).
6. If flag type is `HARVEST_READY`, `createOutlookEvent()` fires.

> **⚑ Mar 2026 — Implementation Note:** Overlay placement uses `POST /api/rooms/:id/overlays` (not `PATCH /rooms/:id`). interact.js is not used — native HTML DnD events handle desktop drag. Teams alert and Outlook event creation on overlay placement are not yet wired up.

### Spray Log Entry

1. IPM flag assigned or "Log Spray" tapped → `SprayLogModal` opens.
2. Operator fills form; optionally attaches a photo.
3. If photo: client calls `POST /photos/presign` → receives pre-signed R2 URL → uploads image directly to R2. Backend stores returned URL.
4. `POST /spray-logs` persists entry; `reEntryExpiresAt = appliedAt + reEntryHours` calculated server-side; room record updated.
5. Durable Object broadcasts updated `reEntryExpiresAt` to all clients; `ReEntryBadge` renders on tile.
6. Teams alert fires if IPM flag has `notificationEnabled: true`.

### Calibration Log Entry

1. "Log Calibration" tapped → `CalibrationLogModal` opens.
2. Operator fills form; optional photo via same R2 pre-sign flow.
3. `POST /calibration-logs` persists entry; `EventLog` record appended.
4. Entry appears in `CalibrationLogList` in the room drawer.

> **⚑ Mar 2026 — Implementation Note:** This flow is **not implemented**. See UC-07 note above.

### Re-Entry Countdown

1. `ReEntryBadge` mounts with `reEntryExpiresAt` prop.
2. `useInterval` hook fires every 60 seconds; calls `dayjs(reEntryExpiresAt).diff(dayjs(), 'minute')`.
3. `> 60`: display hours remaining, green badge.
4. `1–60`: display minutes remaining, amber badge.
5. `≤ 0`: display "CLEARED", green badge; store dispatches `CLEAR_REENTRY(roomId)`.

> **⚑ Mar 2026 — Implementation Note:** Day.js is not installed. `ReEntryBadge` is not yet rendered on tiles in `IsometricMap.jsx`. The `reEntryExpiresAt` field is stored in the DB and returned from `GET /api/rooms` but tile-level countdown display is a pending item.

### Teams Bot Query

1. User sends "Status [Room Name]" in Teams channel.
2. Bot Framework webhook hits `POST /webhooks/teams` on the Worker.
3. Worker queries Neon for room state (mode, active flags, last spray log).
4. Worker replies with Adaptive Card via Bot Framework reply URL.

### Responsive Resize

1. `ResizeObserver` fires on map container dimension change.
2. `viewportScale = containerWidth / BASE_MAP_WIDTH` recalculated.
3. `--map-scale` CSS custom property updated; all tile transforms apply.
4. Toolbox layout switches via 768px media query.

---

## 8. Offline & Resilience Strategy

The app must remain partially functional during network interruptions on the facility floor.

- **Optimistic UI:** All flag assignments and mode changes applied to Zustand store immediately, before API response.
- **Stale-While-Revalidate:** On load, app renders from a LocalStorage room state snapshot while the fresh API response loads in background.
- **IndexedDB Action Queue:** Failed REST calls (network offline) are queued in IndexedDB. On reconnect, the queue replays in order. LocalStorage is used only for UI preferences (drawer collapse state, legend position). IndexedDB handles the action queue.
- **Conflict Resolution:** Durable Objects are the authoritative state source. On WebSocket reconnect, the Durable Object sends the current room state. Last-write-wins with server timestamps; clients that lose a conflict receive a corrective broadcast.
- **Visual Indicator:** Offline banner in the header: "Offline — changes will sync on reconnect."

---

## 9. Compliance & Audit Trail

MTL Cannabis operates under Health Canada's Cannabis Regulations, requiring traceable records for pesticide applications, equipment calibration, and room-level activity.

- **Immutable event log:** Every flag assignment, mode change, spray log, and calibration log creates an append-only `EventLog` record. Records cannot be updated. Only a `director` role can purge records, and purge actions are themselves logged.
- **Operator identity:** All log entries include `operatorId` from the Stack Auth session token — no anonymous actions possible.
- **Spray log compliance fields:** `SprayLog` captures product name, application rate, re-entry interval, and an optional Health Canada PCP registration number field.
- **Calibration log compliance fields:** Pre/post readings, standard used, and pass/fail — sufficient for equipment QA records.
- **Photo evidence:** Photo attachments on spray and calibration logs provide visual proof for inspections.
- **Export (future):** Director of Cultivation can export a date-range event log as CSV or PDF from the admin panel (Section 17).

---

## 10. Data Sources

### Source Types

- **Zustand store (in-memory):** Live room mode, flags, and re-entry state for the current session.
- **Neon PostgreSQL (via REST API):** Persistent room config, flag history, spray logs, calibration logs, photo URL references.
- **Cloudflare R2:** Binary photo storage; referenced by URL in the database.
- **Cloudflare Durable Objects:** Authoritative real-time room state; WebSocket hub per room.
- **External APIs:** Microsoft Teams (Bot Framework / incoming webhooks) and Microsoft Graph API (Microsoft 365).
- **Stack Auth:** User identity, role claims, and session tokens.

### Types of Data

- **Room State:** `roomId`, `name`, `position (col/row)`, `mode`, `flags: RoomFlag[]`, `reEntryExpiresAt`, `lastUpdated`
- **Flag Definitions:** `flagId`, `type`, `iconUrl`, `color`, `notificationEnabled`, `calendarEnabled`
- **Spray Log:** `roomId`, `product`, `rate`, `method`, `operatorId`, `appliedAt`, `reEntryHours`, `reEntryExpiresAt`, `photoUrl`, `notes`
- **Calibration Log:** `roomId`, `equipmentType`, `preReading`, `standard`, `postReading`, `passFail`, `operatorId`, `calibratedAt`, `photoUrl`, `notes`
- **Event Log:** `timestamp`, `operatorId`, `roomId`, `action`, `previousValue`, `newValue`, `source (UI/TEAMS)`
- **Integration Config:** Teams channel webhook URL, Bot Framework app ID/secret, Graph API client ID/secret
- **Calendar Events:** `title`, `roomId`, `scheduledDate`, `outlookEventId`
- **Photos:** Binary in R2; URL referenced in spray/calibration/event log records

---

## 11. CRUD Operations

| Resource | Create | Read | Update | Delete |
|---|---|---|---|---|
| Room | Admin configures in setup | `GET /rooms` | `PATCH /rooms/:id` | Admin only |
| Overlay | `POST /rooms/:id/overlays` | Included in `GET /rooms` | `PATCH /rooms/:id/overlays/:overlayId` | `DELETE /rooms/:id/overlays/:overlayId` |
| Overlay Definition | `POST /overlay-types` | `GET /overlay-types` | `PUT /overlay-types/:id` | `DELETE /overlay-types/:id` |
| Spray Log | `POST /spray-logs` | `GET /spray-logs?roomId=` | (immutable) | Admin purge only |
| Net Log | `POST /net-logs` | `GET /net-logs?roomId=` | (immutable) | Admin purge only |
| Pot Check Log | `POST /pot-check-logs` | `GET /pot-check-logs?roomId=` | (immutable) | Admin purge only |
| Filter Change Log | `POST /filter-change-logs` | `GET /filter-change-logs?roomId=` | (immutable) | Admin purge only |
| Calibration Log | `POST /calibration-logs` | `GET /calibration-logs?roomId=` | (immutable) | Admin purge only |
| Event Log | Auto on every state change | `GET /events?roomId=&from=&to=` | (immutable) | Admin purge only |
| Photo | Upload to R2 via pre-signed URL (`POST /photos/presign`) | R2 URL stored with log entry | N/A | Admin purge only |
| Site Task | `POST /tasks` (admin) or auto from RecurringTask engine | `GET /tasks?roomId=&from=&to=` | `PATCH /tasks/:id` | Admin only |
| Recurring Task | `POST /recurring-tasks` | `GET /recurring-tasks` | `PATCH /recurring-tasks/:id` | Admin only |
| Outlook Event | `POST` via Graph API from site calendar (milestone export only) | `GET` Graph `/me/events` | `PATCH` Graph `/me/events/:id` | `DELETE` Graph `/me/events/:id` |
| Teams Message | Triggered by overlay/spray/overdue task | Bot Framework webhook inbound | N/A | N/A |

---

## 12. Data Storage & Schema

### Storage Methods

- **Neon (serverless PostgreSQL via Drizzle ORM):** Primary relational store. Supports DB branching for staging and test environments.
- **Cloudflare R2:** Binary photo storage. Images uploaded via pre-signed URLs, optionally compressed by a Cloudflare Worker on ingest.
- **Cloudflare Durable Objects:** Ephemeral real-time state per room (WebSocket connections + latest room snapshot). Not a persistence layer — state is hydrated from Neon on DO startup.
- **Stack Auth:** Manages user accounts, sessions, and role assignments externally.
- **Browser LocalStorage:** UI preferences — toolbox collapse state, legend position.
- **Browser IndexedDB:** Offline action queue — failed API calls stored and replayed on reconnect.

### Environment Variables

```
# Database (server-only)
DATABASE_URL                    # Neon serverless PostgreSQL connection string

# Stack Auth
STACK_AUTH_SECRET_SERVER_KEY    # server-only
VITE_STACK_PROJECT_ID           # public (Vite prefix for client-side use)

# Cloudflare R2 (server-only)
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
VITE_R2_PUBLIC_BASE_URL         # public — CDN base URL for photo thumbnails

# Microsoft Teams (server-only)
TEAMS_WEBHOOK_URL
BOT_FRAMEWORK_APP_ID
BOT_FRAMEWORK_APP_SECRET

# Microsoft Graph / Azure AD (server-only)
AZURE_AD_CLIENT_ID
AZURE_AD_CLIENT_SECRET
AZURE_AD_TENANT_ID

# App
VITE_API_BASE_URL               # public — base URL of the Hono Worker API
```

### Drizzle Schema

Schema is defined in `worker/src/schema.ts` and managed via `drizzle-kit push` (no migration files — push directly to Neon). See that file for the canonical table definitions. Key tables:

```
rooms              — id, name, col, row, mode, reEntryExpiresAt, updatedAt
overlays           — id, roomId, overlayType, options (json), status, placedBy, placedAt, ...
sprayLogs          — F-005 pesticide fields: batchIds, pesticide, appliedAt, startTime, endTime,
                     reasonPreventative, reasonTreatment, methodFoliarSpray, methodDip,
                     equipmentNumber, equipmentName, ratio, quantity, operatorId, supervisorName,
                     reEntryHours, reEntryExpiresAt, photoUrl, notes
netLogs            — roomId, netNumber (1|2), action, status, zipTieChecks (json),
                     allZipTiesConfirmed, operatorId, photoUrl, notes
potCheckLogs       — roomId, standingWaterFound, waterRemoved, rootHealth, operatorId, photoUrl, notes
filterChangeLogs   — roomId, filterType, filterSize, oldCondition, newInstalled,
                     equipmentNumber, operatorId, photoUrl, notes
calibrationLogs    — roomId, equipmentType, preReading, standard, postReading, passFail,
                     operatorId, calibratedAt, photoUrl, notes
eventLogs          — roomId, operatorId, action, previousValue, newValue, source, createdAt
```

> **⚑ Mar 2026 — Implementation Note:** The canonical Drizzle schema (`worker/src/schema.ts`) defines the following tables: `rooms`, `overlays`, `sprayLogs`, `netLogs`, `potCheckLogs`, `filterChangeLogs`, `calibrationLogs`, `eventLogs`. Tables planned in the GardenerPlan (daily_checklists, ipm_scouts, pressure_maps, waste_logs, shift_summaries) are **not yet added** to the schema. The `calibration_logs` table exists but has no active worker routes or client UI.

Legacy Prisma schema snapshot (pre-migration, kept for reference only):

```prisma
model Room {
  id               String            @id @default(uuid())
  name             String
  col              Int
  row              Int
  mode             String            @default("idle") // "veg"|"flower"|"flush"|"dry"|"idle"|"maintenance"
  reEntryExpiresAt DateTime?
  overlays         Overlay[]
  events           EventLog[]
  sprayLogs        SprayLog[]
  netLogs          NetLog[]
  potCheckLogs     PotCheckLog[]
  filterChangeLogs FilterChangeLog[]
  calibrationLogs  CalibrationLog[]
  siteTasks        SiteTask[]
  recurringTasks   RecurringTask[]
  updatedAt        DateTime          @updatedAt
}

model Overlay {
  id               String   @id @default(uuid())
  room             Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  roomId           String
  overlayType      String   // "ipm"|"net"|"pot_check"|"filter_change"|"defoliation"|"transfer"|"harvest_ready"|"mode_change"|"supply_ready"|"issue"
  options          Json     // type-specific payload
  status           String   @default("active") // "active"|"completed"|"pending_review"
  placedBy         String   // Stack Auth user ID
  placedAt         DateTime @default(now())
  updatedBy        String?
  updatedAt        DateTime @updatedAt
  notificationSent Boolean  @default(false)

  @@index([roomId])
  @@index([overlayType])
}

model SprayLog {
  id                 String    @id @default(uuid())
  room               Room      @relation(fields: [roomId], references: [id])
  roomId             String
  batchIds           String    // comma-separated batch IDs e.g. "3UC260112PE, GP2260112PE"
  pesticide          String    // product name + registration number
  appliedAt          DateTime  // application date
  startTime          String    // "08h30"
  endTime            String    // "10h30"
  reasonPreventative Boolean   @default(false)
  reasonTreatment    Boolean   @default(false)
  methodFoliarSpray  Boolean   @default(false)
  methodDip          Boolean   @default(false)
  equipmentNumber    String
  equipmentName      String
  ratio              String    // "22g/15L"
  quantity           String    // "30L"
  operatorId         String    // Stack Auth user ID (Performed By)
  supervisorName     String    // SUPV/APPV — populated only by master_grower|director
  reEntryHours       Float     @default(0)
  reEntryExpiresAt   DateTime?
  photoUrl           String?
  notes              String?
  createdAt          DateTime  @default(now())

  @@index([roomId])
  @@index([appliedAt])
}

model NetLog {
  id                  String   @id @default(uuid())
  room                Room     @relation(fields: [roomId], references: [id])
  roomId              String
  netNumber           Int      // 1 or 2
  action              String   // "spread" | "bend"
  status              String   // "lowering" | "lowered_checked"
  zipTieChecks        Json     // { rowA: bool[], rowB: bool[], rowC: bool[], rowD: bool[] }
  allZipTiesConfirmed Boolean  @default(false)
  operatorId          String
  loggedAt            DateTime @default(now())
  photoUrl            String?
  notes               String?

  @@index([roomId])
}

model PotCheckLog {
  id                 String   @id @default(uuid())
  room               Room     @relation(fields: [roomId], references: [id])
  roomId             String
  checkedAt          DateTime @default(now())
  standingWaterFound Boolean
  waterRemoved       Boolean?
  rootHealth         String   // "healthy" | "concern" | "critical"
  operatorId         String
  photoUrl           String?
  notes              String?

  @@index([roomId])
  @@index([checkedAt])
}

model FilterChangeLog {
  id              String   @id @default(uuid())
  room            Room     @relation(fields: [roomId], references: [id])
  roomId          String
  changedAt       DateTime @default(now())
  filterType      String   // "carbon" | "pre" | "hepa" | "other"
  filterSize      String?
  oldCondition    String   // "normal" | "heavily_loaded" | "damaged"
  newInstalled    Boolean
  equipmentNumber String?
  operatorId      String
  photoUrl        String?
  notes           String?

  @@index([roomId])
  @@index([changedAt])
}

model RecurringTask {
  id            String   @id @default(uuid())
  roomId        String?  // null = facility-wide task
  taskType      String   // "pot_check" | "filter_change"
  frequency     String   // "daily" | "twice_weekly"
  scheduledDays Json?    // ["monday", "thursday"] for twice_weekly
  cutoffTime    String?  // "14:00" — time after which overdue alert fires
  active        Boolean  @default(true)
}

model SiteTask {
  id              String    @id @default(uuid())
  title           String
  roomId          String?
  room            Room?     @relation(fields: [roomId], references: [id])
  taskType        String    // "pot_check" | "filter_change" | "harvest" | "custom" | ...
  assignedRole    String?
  assignedUserId  String?
  scheduledFor    DateTime
  dueBy           DateTime?
  status          String    @default("pending") // "pending" | "in_progress" | "completed" | "overdue"
  completedBy     String?
  completedAt     DateTime?
  linkedLogId     String?   // references SprayLog, PotCheckLog, etc.
  exportToOutlook Boolean   @default(false)
  outlookEventId  String?   // Graph API event ID for sync
  notes           String?
  createdBy       String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model CalibrationLog {
  id            String   @id @default(uuid())
  room          Room     @relation(fields: [roomId], references: [id])
  roomId        String
  equipmentType String   // "pH meter"|"EC meter"|"CO2 sensor"|"temp/humidity probe"|etc.
  preReading    Float
  standard      String
  postReading   Float
  passFail      Boolean
  operatorId    String   // Stack Auth user ID
  calibratedAt  DateTime
  photoUrl      String?  // Cloudflare R2 URL
  notes         String?
  createdAt     DateTime @default(now())

  @@index([roomId])
  @@index([calibratedAt])
}

model EventLog {
  id            String   @id @default(uuid())
  room          Room     @relation(fields: [roomId], references: [id])
  roomId        String
  operatorId    String   // Stack Auth user ID
  action        String   // "OVERLAY_PLACED"|"OVERLAY_REMOVED"|"OVERLAY_EDITED"|"OVERLAY_COMPLETED"|"MODE_CHANGE"|"SPRAY_LOG"|"NET_LOG"|"POT_CHECK"|"FILTER_CHANGE"|"CALIBRATION_LOG"|"FAILED_NOTIFICATION"
  previousValue String?
  newValue      String?
  source        String   // "UI"|"TEAMS"
  createdAt     DateTime @default(now())

  @@index([roomId])
  @@index([createdAt])
}
```

---

## 13. API Endpoint Specification

All endpoints run on Cloudflare Workers via Hono. Every request requires a valid Stack Auth JWT in the `Authorization: Bearer <token>` header. Role enforcement is applied per endpoint via a Hono middleware that reads the `role` claim from the decoded token.

### Auth Middleware

```
GET  /me         → 200 { userId, role, email }
```

### Rooms

```
GET  /rooms
  Auth: any authenticated role
  Response: 200 [{ id, name, col, row, mode, reEntryExpiresAt, flags: RoomFlag[], updatedAt }]

PATCH /rooms/:id
  Auth: master_grower | director
  Body: { mode?: string }
  Response: 200 { room } | 400 | 401 | 403 | 404
```

### Flags

```
GET  /flags
  Auth: any authenticated role
  Response: 200 [{ id, type, iconUrl, color, notificationEnabled, calendarEnabled }]

POST /rooms/:id/flags
  Auth: gardener | pest_control | master_grower | director
  Body: { flagId: string }
  Response: 201 { roomFlag } | 400 | 401 | 403 | 404 | 409 (flag already assigned to room)

DELETE /rooms/:id/flags/:flagId
  Auth: gardener | pest_control | master_grower | director
  Response: 204 | 401 | 403 | 404
```

### Overlays

```
POST /rooms/:id/overlays
  Auth: gardener | pest_control | master_grower | director
  Body: { overlayType, options, status? }
  Response: 201 { overlay } | 400 | 401 | 403

PATCH /rooms/:id/overlays/:overlayId
  Auth: gardener | pest_control | master_grower | director
  Body: { options?, status? }
  Response: 200 { overlay } | 400 | 401 | 403 | 404

DELETE /rooms/:id/overlays/:overlayId
  Auth: gardener | pest_control | master_grower | director
  Response: 204 | 401 | 403 | 404
  Side effect: creates EventLog with action "OVERLAY_REMOVED"
```

### Spray Logs

```
POST /spray-logs
  Auth: gardener | pest_control | master_grower | director
  Body: { roomId, batchIds, pesticide, appliedAt, startTime, endTime,
          reasonPreventative, reasonTreatment, methodFoliarSpray, methodDip,
          equipmentNumber, equipmentName, ratio, quantity,
          supervisorName (master_grower|director only), reEntryHours?, reEntryOverride?,
          photoUrl?, notes? }
  Response: 201 { sprayLog } | 400 | 401 | 403
  Note: supervisorName field is validated server-side; returns 403 if a non-supervisor role attempts to set it.

GET  /spray-logs?roomId=&from=&to=
  Auth: any authenticated role
  Response: 200 [SprayLog]
```

### Net Logs

```
POST /net-logs
  Auth: gardener | master_grower | director
  Body: { roomId, netNumber, action, status, zipTieChecks, allZipTiesConfirmed, photoUrl?, notes? }
  Response: 201 { netLog } | 400 | 401 | 403

GET  /net-logs?roomId=
  Auth: any authenticated role
  Response: 200 [NetLog]
```

### Pot Check Logs

```
POST /pot-check-logs
  Auth: gardener | master_grower | director
  Body: { roomId, standingWaterFound, waterRemoved?, rootHealth, photoUrl?, notes? }
  Response: 201 { potCheckLog } | 400 | 401 | 403

GET  /pot-check-logs?roomId=&from=&to=
  Auth: any authenticated role
  Response: 200 [PotCheckLog]
```

### Filter Change Logs

```
POST /filter-change-logs
  Auth: gardener | master_grower | director
  Body: { roomId, filterType, filterSize?, oldCondition, newInstalled, equipmentNumber?, photoUrl?, notes? }
  Response: 201 { filterChangeLog } | 400 | 401 | 403

GET  /filter-change-logs?roomId=&from=&to=
  Auth: any authenticated role
  Response: 200 [FilterChangeLog]
```

### Site Tasks

```
GET  /tasks?roomId=&from=&to=&status=
  Auth: any authenticated role
  Response: 200 [SiteTask]

POST /tasks
  Auth: master_grower | director
  Body: { title, roomId?, taskType, assignedRole?, assignedUserId?, scheduledFor, dueBy?, exportToOutlook?, notes? }
  Response: 201 { siteTask } | 400 | 401 | 403

PATCH /tasks/:id
  Auth: any authenticated role (completion); master_grower | director (reschedule/delete)
  Body: { status?, completedBy?, completedAt?, linkedLogId?, exportToOutlook?, scheduledFor?, notes? }
  Response: 200 { siteTask } | 400 | 401 | 403 | 404
  Side effect: if exportToOutlook changes or scheduledFor changes, syncs Outlook event via Graph API.

### Recurring Tasks

GET  /recurring-tasks
  Auth: master_grower | director
  Response: 200 [RecurringTask]

POST /recurring-tasks
  Auth: master_grower | director
  Body: { roomId?, taskType, frequency, scheduledDays?, cutoffTime? }
  Response: 201 { recurringTask }

PATCH /recurring-tasks/:id
  Auth: master_grower | director
  Response: 200 { recurringTask }
```

### Calibration Logs

```
POST /calibration-logs
  Auth: automation_engineer | master_grower | director
  Body: { roomId, equipmentType, preReading, standard, postReading, passFail, calibratedAt, photoUrl?, notes? }
  Response: 201 { calibrationLog } | 400 | 401 | 403

GET  /calibration-logs?roomId=&from=&to=
  Auth: any authenticated role
  Response: 200 [CalibrationLog]
```

> **⚑ Mar 2026 — Implementation Note:** Calibration log routes are **not implemented** in `worker/src/worker.ts`. The schema table exists but no route file has been created. Site Tasks and Recurring Tasks routes are also not yet implemented.

### Photos

```
POST /photos/presign
  Auth: any authenticated role
  Body: { roomId: string, logType: "spray"|"calibration"|"event", contentType: string }
  Response: 200 { uploadUrl: string, publicUrl: string }
    uploadUrl: pre-signed R2 PUT URL (expires in 5 minutes)
    publicUrl: final CDN URL to store in the log record
```

### Events

```
GET  /events?roomId=&from=&to=
  Auth: any authenticated role
  Response: 200 [EventLog]
```

### Webhooks

```
POST /webhooks/teams
  Auth: Bot Framework HMAC verification (not JWT)
  Body: Bot Framework Activity object
  Response: 200 { type: "message", text: "..." } (Adaptive Card reply)
```

### Error Response Shape

```json
{ "error": "string", "code": 400 | 401 | 403 | 404 | 409 | 500 }
```

---

## 14. Responsive Design Strategy

### Breakpoints

- **Desktop (≥1280px):** Full isometric map, toolbox on the right, header full width.
- **Tablet (768–1279px):** Map scales to 70% of container width; toolbox collapses to icon strip.
- **Mobile (<768px):** Map scrolls horizontally; toolbox becomes bottom drawer; drag replaced with two-step tap-to-assign.

### Scaling Technique

```css
:root {
  --map-scale: 1;
}
.isometric-map {
  transform: scale(var(--map-scale));
  transform-origin: top left;
}
```

`--map-scale` set dynamically:

```js
const scale = container.offsetWidth / BASE_MAP_WIDTH;
document.documentElement.style.setProperty('--map-scale', scale);
```

### Touch Interaction Model

On desktop, interact.js handles drag-and-drop via pointer events.

> **⚑ Mar 2026 — Implementation Note:** interact.js is not used. Desktop drag uses the native HTML Drag and Drop API (`draggable`, `onDragStart`, `onDragOver`, `onDrop`).

On mobile, a two-step tap model replaces drag:

1. Tap a flag card in the toolbox drawer → card enters active highlighted state; `selectedFlagId` set in store.
2. All room tiles show a subtle ready-to-receive highlight.
3. Tap a room tile → `onFlagAssign(selectedFlagId, roomId)` fires; flag assigned; `selectedFlagId` clears.
4. Tap the already-selected flag again → cancels selection.
5. Tap any room tile with nothing selected → opens room detail drawer.

---

## 15. Integration Architecture

### Authentication (Stack Auth)

- Roles: `gardener`, `pest_control`, `automation_engineer`, `master_grower`, `director`.
- Hono middleware on every Worker route validates the JWT and attaches `{ userId, role }` to the request context.
- Role hierarchy enforced per endpoint (see Section 13).
- No custom user table in PostgreSQL — user identity resolved via Stack Auth SDK.

### Cloudflare R2 (Photo Storage)

1. Client calls `POST /photos/presign` → Worker generates a pre-signed R2 PUT URL using the S3-compatible SDK.
2. Client uploads image directly to R2 using the pre-signed URL (5-minute expiry).
3. A Cloudflare Worker bound to the R2 bucket can optionally trigger image compression/resize on ingest.
4. Worker stores the `publicUrl` in the associated log record.
5. Zero egress cost within Cloudflare network; CDN-cached for fast thumbnail loads.

### Cloudflare Durable Objects (Real-Time)

1. Each room has one Durable Object instance: `env.ROOM_DO.idFromName(roomId)`.
2. Browser clients upgrade to WebSocket on map load: `GET /ws/rooms/:id` → Worker returns Durable Object WebSocket.
3. On any state change (flag, mode, spray), the Worker sends a `broadcast(payload)` message to the DO.
4. DO sends the payload to all active WebSocket connections for that room.
5. On reconnect, the DO sends the current room snapshot (hydrated from Neon) to the reconnecting client.

### Microsoft Teams (Bot Framework + Incoming Webhooks)

**Outbound alerts:**
1. Add "Incoming Webhook" connector to the target Teams channel; copy webhook URL to `.env`.
2. On flag/spray event, Worker POSTs an Adaptive Card payload to `TEAMS_WEBHOOK_URL`.

**Inbound bot queries:**
1. Register Azure Bot resource; obtain App ID and Client Secret.
2. Side-load bot manifest in Teams or publish to org app catalog.
3. Messaging endpoint: `POST /webhooks/teams` on the Worker.
4. Worker verifies Bot Framework HMAC signature, parses activity, queries Neon, replies with Adaptive Card.
5. Shares Azure AD app registration with Graph API.

**Error handling:** Retry Teams webhook up to 3 times with exponential backoff (1s, 2s, 4s). On final failure, log a `FAILED_NOTIFICATION` `EventLog` record and surface a toast notification in the UI.

### Outlook Calendar (Microsoft Graph API) — Export Only

Outlook is now an **export target from the Site Calendar**, not the primary scheduling interface. Routine operational tasks (pot checks, filter changes) are never exported. Only milestone events with `exportToOutlook: true` are synced.

1. Azure AD app registration with `Calendars.ReadWrite` delegated permission.
2. OAuth 2.0 Authorization Code flow; refresh token stored securely in Worker environment.
3. **Create event:** When `exportToOutlook: true` is set on a `SiteTask`, Worker calls `POST https://graph.microsoft.com/v1.0/me/events` and stores the returned `outlookEventId`.
4. **Update event:** When the task is rescheduled, Worker calls `PATCH /me/events/:outlookEventId`.
5. **Delete event:** When the task is deleted, Worker calls `DELETE /me/events/:outlookEventId`.
6. **Bulk export:** Admin can bulk-export a week's schedule from the calendar view — "Export Week to Outlook."
7. **Error handling:** On Graph API 401 (token expired), Worker uses the refresh token to obtain a new access token, then retries once. On failure, logs `FAILED_NOTIFICATION` event.

---

## 16. Deployment Architecture

### Stack

| Layer | Service | Deploy Method |
|---|---|---|
| Frontend | Cloudflare Pages | Auto-deploy via GitHub Actions on push to `main` |
| Backend API | Cloudflare Workers (Hono) | `wrangler deploy` via GitHub Actions |
| Real-time | Cloudflare Durable Objects | Co-deployed with Workers via `wrangler.toml` |
| Database | Neon (serverless PostgreSQL) | Managed; connect via `DATABASE_URL` |
| Storage | Cloudflare R2 | Bucket created via Wrangler; bound in `wrangler.toml` |
| Auth | Stack Auth | Managed; credentials in env vars |

### `wrangler.toml` Config Sketch

```toml
name = "mtl-missioncontrol-api"
main = "src/worker.ts"
compatibility_date = "2025-01-01"

[[durable_objects.bindings]]
name = "ROOM_DO"
class_name = "RoomDurableObject"

[[migrations]]
tag = "v1"
new_classes = ["RoomDurableObject"]

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "mtl-photos"
```

### Repository Structure

```
MTL-MissionControl/
├── client/               # React + Vite frontend (Cloudflare Pages)
│   ├── src/
│   │   ├── components/
│   │   ├── store/
│   │   └── main.jsx
│   └── vite.config.js
├── worker/               # Hono API + Durable Objects (Cloudflare Workers)
│   ├── src/
│   │   ├── routes/
│   │   ├── durable-objects/
│   │   ├── integrations/
│   │   └── worker.ts
│   ├── wrangler.toml
│   └── package.json
├── worker/src/schema.ts  # Drizzle ORM schema (all tables)
├── DOCS/
│   └── DESIGN_SPEC.md
└── .github/
    └── workflows/
        └── deploy.yml    # GitHub Actions CI/CD
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml (sketch)
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test        # lint + Jest
      - run: npx playwright test       # E2E tests
      - run: npx wrangler deploy       # deploy Worker + Durable Objects
      # Cloudflare Pages deploys automatically on push via Pages GitHub integration
```

---

## 17. Transfer Feature Specification

> See Section 5 (Overlay System) for edit/remove interaction rules that also apply to Transfer overlays.

### Overview

The Transfer feature allows operators to declare that the contents of one room will be (or are being) moved to another room. It uses a two-step assignment interaction that works identically for drag-and-drop (desktop) and tap-to-assign (mobile).

### Interaction Model

**Step 1 — Origin selection**
- Desktop: drag the ⇄ Transfer flag from LegendPanel and drop it on the origin room.
- Mobile: tap ⇄ in LegendPanel (activates selectedFlagId = 'transfer'), then tap the origin room.
- Effect: origin room gains the ⇄ symbol, begins amber pulsing animation, `pendingTransferOrigin` set in Zustand. A banner appears: "SELECT DESTINATION ROOM — ESC to cancel". All other interactive rooms highlight as eligible destinations.

**Step 2 — Destination selection**
- Desktop: drag the ⇄ Transfer flag and drop it on the destination room.
- Mobile: tap any room while `pendingTransferOrigin` is set (no flag re-selection needed).
- Effect: `transfers[originId] = { destinationId, transferType, transferDate, notes, createdAt }` stored in Zustand. An animated amber dashed line with arrowhead is drawn from origin → destination on the SVG map. Banner dismissed.

**Cancel**: Press Escape (desktop) or any mechanism that clears `pendingTransferOrigin`. The ⇄ symbol is removed from the origin room.

### State Shape

```javascript
// facilityStore.js
transfers: {
  'F7': {                          // keyed by origin room ID
    destinationId: 'F9',
    transferType: 'Transplant',    // Transplant | Clone Run | Trim/Process | Harvest Move | Mother Move | Other
    transferDate: '2026-03-10T09:00:00.000Z',  // nullable
    notes: '',
    createdAt: '2026-03-05T19:00:00.000Z',
  }
},
pendingTransferOrigin: null,       // roomId | null — set during step 1
```

### Visual Components

**TransferLine** (`client/src/components/TransferLine.jsx`)
- Pure SVG component; receives `x1, y1, x2, y2` screen coordinates (computed from tile centers using the `iso()` function).
- Renders: amber glow underlay, animated dashed line (`stroke-dashoffset` animation for marching-ants effect), SVG `<marker>` arrowhead at destination, origin dot, and transfer type label at midpoint.
- Rendered above all room tiles in the SVG painter order.

**Pending Origin Flash**
- Two SVG polygon overlays on the origin tile: amber fill with pulsing opacity animation, amber stroke with `stroke-opacity` animation. Duration: 0.9s.

**Eligible Destination Highlight**
- While `pendingTransferOrigin` is set, all other interactive tiles show a dashed amber border overlay.

### Edit & Remove (TransferModal)

Accessible via the **Transfer info card** in the origin room's drawer (Overview tab).

Fields:
| Field | Type | Notes |
|---|---|---|
| Destination Room | Select | All interactive rooms except origin |
| Transfer Type | Select | Transplant / Clone Run / Trim / Harvest Move / Mother Move / Other |
| Scheduled Date & Time | datetime-local | Optional |
| Notes | textarea | Optional |

Actions:
- **Save** — updates `transfers[originId]` in Zustand; line label updates immediately.
- **Remove Transfer** — deletes the transfer record, removes ⇄ symbol from origin room, removes line.
- **Cancel** — closes modal with no changes.

The **destination** room's drawer shows an "Incoming transfer" read-only card pointing back to the origin; editing must be done from the origin room.

### Future: API Persistence

Currently transfers are stored in Zustand only (client-side, ephemeral). A future `transfers` table should be added to the Drizzle schema:

```typescript
export const roomTransfers = pgTable('room_transfers', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  originId:     text('origin_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  destinationId: text('destination_id').notNull().references(() => rooms.id),
  transferType: text('transfer_type').notNull().default('Transplant'),
  transferDate: timestamp('transfer_date'),
  notes:        text('notes'),
  completedAt:  timestamp('completed_at'),  // null = pending
  operatorId:   text('operator_id').notNull(),
  operatorName: text('operator_name').notNull(),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})
```

API routes: `POST /api/transfers`, `PATCH /api/transfers/:id`, `DELETE /api/transfers/:id`, `GET /api/rooms/:id/transfers`.

### PreVeg Internal Zone Transfers

> **⚑ Mar 2026 — New Feature (not in original spec):** The PREVEG room supports a separate **intra-room batch zone transfer** system, distinct from the inter-room transfer feature above. Four propagation batches (Early Cuts, Mid Cuts, Late Cuts, Clones) each occupy one of six zone groups. Operators can move (or swap) batches between zone groups using the `PreVegZoneMap` component in the room drawer. Each move appends a `{ fromZones, toZones, movedAt }` entry to the batch's `zoneHistory`, rendered as animated bezier arcs on the SVG map. Undo removes the last history entry. State is Zustand-only (no API persistence yet). A future `preveg_zone_history` table should be added to the schema.

---

## 18. Site Calendar

The internal site calendar is the **source of truth for daily operations**. Outlook is an export target only (see Section 15).

> **⚑ Mar 2026 — Implementation Note:** The Site Calendar is **not yet implemented**. No calendar UI, recurring task engine, or SiteTask/RecurringTask API routes exist in the deployed system. This is a Phase C/D item in the GardenerPlan. The Drizzle schema does not yet have `site_tasks` or `recurring_tasks` tables.

### Features

| Feature | Description |
|---|---|
| Admin task creation | Admin creates daily/recurring tasks directly in the site calendar |
| Room-scoped tasks | Tasks can be pinned to a specific room or set as facility-wide |
| Recurring task engine | Pot checks and filter changes auto-populate from `RecurringTask` schedule |
| Task assignment | Admin assigns tasks to a role or specific operator |
| Completion tracking | Operators mark tasks complete from the calendar or room drawer |
| Overdue escalation | Uncompleted tasks past `dueBy` trigger Teams alert to Master Grower |
| Export to Outlook | One-click or auto-export of harvest dates and major milestones to Outlook Calendar |

### Calendar Views

- **Day view** — all tasks for today across all rooms; grouped by room
- **Week view** — 7-day grid; shows recurring tasks, special tasks, upcoming harvests
- **Room view** — filter to a single room's task history and upcoming schedule

### Role-Gated Actions

- Creating and editing tasks requires `master_grower` or `director`.
- Completing a task (marking it done, submitting the linked log) is available to any authenticated role.
- Exporting to Outlook requires `master_grower` or `director`.

---

## 19. Future Features (Planned)

- **Multi-facility support** — Top-level facility selector; `Facility` model added to schema with rooms scoped per facility.
- **Role-based access control UI** — Admin panel for Director to assign roles via Stack Auth management API; read-only view for auditors.
- **Harvest Gantt / timeline view** — Horizontal timeline across flower rooms showing stage day and expected harvest date.
- **Dashboard / KPI panel** — Rooms by mode count, active alerts, open IPM flags, next harvest date.
- **Notification escalation** — Unacknowledged WARN/ALERT overlays escalate to Master Grower or Director after a configurable window.
- **PDF export** — One-click daily facility status report for Health Canada inspections (F-005 form pre-filled from SprayLog data).
- **Environmental sensor feed** — Pull temp/humidity/CO2/VPD per room from an existing sensor API; display as badge on tile.

---

## 20. Testing Strategy

> **⚑ Mar 2026 — Implementation Note:** **No tests exist yet.** There is no Jest config, React Testing Library setup, or Playwright config in the repository. CI/CD via GitHub Actions is also not configured (`.github/workflows/` does not exist). The test strategy below is the intended target. Priority tests per the GardenerPlan: PreVeg zone swap logic, YES/NO log submission, overlay placement/removal, and SprayLogModal validation.

### Unit Tests (Jest)

- Zustand store dispatch actions: `ASSIGN_FLAG`, `MODE_CHANGE`, `CLEAR_REENTRY`
- `IntegrationService` methods with mocked `fetch`: `sendTeamsAlert`, `createOutlookEvent`, `presignR2Upload`
- Re-entry countdown calculation logic: boundary cases at 61 min, 60 min, 1 min, 0 min, -1 min

### Component Tests (React Testing Library)

- `Flag`: drag initiation (desktop), tap-to-select (mobile), deselect on second tap
- `RoomModeBadge`: correct animation class applied per mode value
- `ReEntryBadge`: green/amber/cleared states render at correct minute thresholds
- `SprayLogModal`: form validation, photo attachment flow (mocked presign endpoint)
- `CalibrationLogModal`: pass/fail toggle, pre/post reading fields

### Integration Tests (Jest + Neon test branch)

- `POST /spray-logs`: full round-trip against a Neon test branch DB; verify `reEntryExpiresAt` calculated correctly
- `POST /calibration-logs`: verify record persisted with all fields
- `POST /photos/presign`: verify pre-signed URL returned with correct R2 key format
- `PATCH /rooms/:id`: verify 403 returned for `gardener` role, 200 for `master_grower`

### End-to-End Tests (Playwright)

- Flag assign flow on desktop viewport (drag from toolbox → drop on room → drawer shows flag)
- Flag assign flow on mobile viewport (tap flag → tap room → badge appears on tile)
- Spray log creation: fill form, attach photo, verify re-entry badge appears on tile
- Teams alert mock: intercept outbound webhook call, verify Adaptive Card payload shape
- Offline queue: simulate network drop, assign flag, restore network, verify sync

---

## 21. References

- Stack Auth. (2024). *Stack Auth Documentation*. https://docs.stack-auth.com
- Cloudflare. (2024). *R2 Object Storage Documentation*. https://developers.cloudflare.com/r2/
- Cloudflare. (2024). *Durable Objects*. https://developers.cloudflare.com/durable-objects/
- Cloudflare. (2024). *Hono on Cloudflare Workers*. https://hono.dev/docs/getting-started/cloudflare-workers
- Neon. (2024). *Serverless PostgreSQL*. https://neon.tech/docs
- Drizzle ORM. (2024). *Drizzle ORM Documentation*. https://orm.drizzle.team/docs/overview
- Microsoft. (2024). *Build bots with Microsoft Bot Framework*. https://learn.microsoft.com/en-us/azure/bot-service/
- Microsoft. (2024). *Create Incoming Webhooks in Microsoft Teams*. https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook
- Microsoft. (2024). *Adaptive Cards for Teams*. https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/design-effective-cards
- Microsoft. (2024). *Outlook Calendar API overview — Microsoft Graph*. https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview
- interact.js. (2024). *Drag and Drop & Resizing for the Modern Web*. https://interactjs.io *(evaluated but not adopted — native HTML DnD used instead)*
- Kenney. (2024). *Isometric Asset Packs*. https://kenney.nl/assets?q=isometric
- Day.js. (2024). *Fast 2kB alternative to Moment.js*. https://day.js.org *(evaluated but not installed — native Date arithmetic used)*
