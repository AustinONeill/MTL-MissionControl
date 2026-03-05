# MTL Mission Control — Application Design & Data Specification

**Project:** MTL Mission Control — Cultivation Facility Isometric Dashboard  
**Author:** Austin O'Neill  
**Repository:** https://github.com/AustinONeill/MTL-MissionControl  
**Date:** March 5, 2026  
**Last Updated:** March 5, 2026

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
17. [Future Features](#17-future-features)
18. [Testing Strategy](#18-testing-strategy)
19. [References](#19-references)

---

## 1. System Architecture

The application is divided into three distinct layers to ensure separation of concerns, maintainability, and scalability. The entire stack runs on Cloudflare's edge network.

### Presentation Layer

- Renders the isometric facility map using SVG with CSS transforms, deployed on **Cloudflare Pages**.
- Displays the live-time header with a real-time clock updated every second.
- Renders a **mode badge and/or animation** on each room tile indicating its current operational mode (Veg, Flower, Flush, Dry, Idle, Maintenance).
- Manages the toolbox panel with draggable/droppable flag components (desktop) and tap-to-select/tap-to-assign (mobile).
- Adapts all UI elements responsively across desktop, tablet, and mobile viewports.
- Provides visual feedback on flag placement, drag interactions, status changes, and spray re-entry countdowns.

### Application Layer

- Controls drag-and-drop logic for flags on desktop via interact.js.
- Controls two-step tap-to-assign on mobile: operator taps a flag to select it, then taps a room tile to assign it.
- Manages flag state, room mode state, and re-entry countdown timers.
- Interfaces with the backend via REST (Hono on Cloudflare Workers) and real-time WebSocket (Cloudflare Durable Objects).
- Handles the responsive layout engine — recalculating isometric tile positions on viewport resize.

### Data / Integration Layer

- REST API built with **Hono** running on **Cloudflare Workers** — fully serverless, zero cold-start overhead.
- Real-time multi-user state and conflict resolution via **Cloudflare Durable Objects** (one DO instance per room, identified by `roomId`).
- Authentication and role-based session management handled by **Stack Auth**.
- Photo attachments stored and compressed in **Cloudflare R2**.
- Persistent relational data in **Neon** (serverless PostgreSQL) via Prisma with `@prisma/adapter-neon`.
- Microsoft Teams integration for outbound alerts and inbound bot queries.
- Microsoft Graph API for Outlook Calendar read/write.

---

## 2. Use Case Analysis

### Actors

- **Gardener** — Day-to-day floor operator; logs events, assigns flags, records spray and calibration entries.
- **Pest Control Specialist** — Creates and manages spray logs; views IPM flag history and re-entry countdowns.
- **Control / Automation Engineer** — Manages calibration logs for sensors and equipment; monitors room modes.
- **Master Grower** — Views and updates room modes and flag state across all rooms; approves spray log entries.
- **Director of Cultivation** — Full read/review access across all rooms, logs, and reports; can purge audit records.
- **Teams Bot** — Automated agent that sends/receives alerts tied to room flags via Microsoft Teams.
- **Outlook Calendar** — External scheduling service that syncs harvest and maintenance events.

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
Actor: Pest Control Specialist, Gardener  
Precondition: IPM flag is placed on a room.  
Flow: Spray log form opens; operator records product name, rate, method, application date/time, and re-entry interval (hours). On save: entry persisted; re-entry countdown rendered on tile; Teams alert sent if configured.  
Postcondition: Spray log persisted; room tile shows re-entry countdown badge.

**UC-07: Log Calibration Event**  
Actor: Control / Automation Engineer  
Precondition: User accesses calibration log from room drawer or toolbox.  
Flow: Operator selects equipment type, records pre/post readings, calibration standard, pass/fail, date, and optional notes. Entry saved to calibration log.  
Postcondition: Calibration record persisted and visible in room event history.

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

**UC-10: Query Room Status via Teams Bot**  
Actor: Any role  
Precondition: Teams bot deployed and active in the team's channel.  
Flow: User sends "Status [Room Name]" in Teams channel; bot queries DB; replies with Adaptive Card showing mode, active flags, last spray log, and timestamp.  
Postcondition: User receives up-to-date status summary inside Teams.

**UC-11: Sync Harvest Event to Outlook Calendar**  
Actor: Master Grower, Director of Cultivation  
Precondition: Microsoft Graph API credentials configured; harvest flag placed.  
Flow: Backend creates calendar event via Graph API `POST /me/events` with room name, date, and operator details.  
Postcondition: All team members with calendar access see the scheduled harvest.

**UC-12: Responsive Layout on Mobile**  
Actor: All roles  
Precondition: User accesses dashboard on a phone or tablet.  
Flow: Viewport resize triggers responsive engine; tiles rescale via CSS custom property; toolbox collapses into bottom drawer; drag-and-drop replaced with two-step tap-to-assign.  
Postcondition: Full functionality available on touch screens without drag gestures.

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

### Flag Icons

- SVG icons for each flag type: IPM, Defoliation, Transfer, Mode Change, Supply Ready, Calendar, Issue.
- Legible at small sizes on high-density (Retina) screens.

### Fonts

- Primary: Inter or Roboto (Google Fonts) for dashboard UI text.
- Monospace: JetBrains Mono for the live clock and status codes.

---

## 4. Library & Service Usage

### Frontend

- **React + Vite:** Component-based UI, deployed to Cloudflare Pages.
- **interact.js:** Drag-and-drop on desktop via pointer events.
- **Day.js:** Live clock, timestamp formatting, re-entry countdown calculations.
- **CSS Grid / CSS Transforms:** Isometric tile layout using `rotate(45deg) skewX(-20deg)`.
- **Zustand:** Client-side state management.

### Auth

- **Stack Auth:** Prebuilt sign-in UI, JWT session tokens, role-based claims. No custom user table required.

### Backend

- **Hono:** Lightweight web framework for Cloudflare Workers. Replaces Express/Next.js — native Workers support, zero overhead.
- **Cloudflare Workers:** Serverless edge runtime for the REST API and webhook receivers.
- **Cloudflare Durable Objects:** Stateful edge objects providing WebSocket-based real-time broadcast per room. One DO instance per `roomId`.
- **Prisma + `@prisma/adapter-neon`:** ORM connecting Workers to Neon PostgreSQL via HTTP driver (no persistent TCP required).
- **Neon:** Serverless PostgreSQL; supports branching for staging/test environments.

### Storage

- **Cloudflare R2:** S3-compatible object storage for photo attachments. Pre-signed PUT URLs for direct client upload. Zero egress fees within Cloudflare network.

### Integration

- **Microsoft Teams (Bot Framework / Incoming Webhooks):** Adaptive Card alerts and inbound bot queries. Shares Azure AD app registration with Graph API.
- **Microsoft Graph API:** OAuth 2.0 calls to `/me/events` for calendar read/write.

### DevOps

- **Wrangler CLI:** Cloudflare Workers and Durable Objects deployment.
- **GitHub Actions:** CI/CD pipeline — lint, test, deploy on push to `main`.
- **Jest + React Testing Library:** Unit and component tests.
- **Playwright:** End-to-end tests across desktop and mobile viewports.

---

## 5. Component & Module Breakdown

### IsometricMap

- Renders all room tiles in the correct isometric grid layout.
- Each tile receives `id`, `name`, `position (col, row)`, `mode`, `flags[]`, and `reEntryExpiresAt` from state.
- Renders a `RoomModeBadge` and optional `ReEntryBadge` overlay on each tile.
- Each tile is a drop target (interact.js desktop) and tap target (mobile).
- Listens for WebSocket messages from the room's Durable Object to update state in real time.

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

### Header

- Facility name left, live clock right.
- Clock updates every 1000ms via `setInterval`.
- On mobile, collapses facility name to a monogram.

### Toolbox / LegendPanel

- Lists all flag types as draggable items (desktop) or tappable cards (mobile).
- Legend maps flag icon → meaning and mode badge → meaning.
- On mobile, renders as a bottom drawer toggled by a floating action button.

### Flag

- Draggable on desktop with icon, label, and optional priority badge.
- On mobile: tappable card. Tapping sets `selectedFlagId`; tapping room assigns; tapping again deselects.
- Emits `onFlagAssign(flagId, targetRoomId)` — shared between drag-drop and tap-to-assign paths.

### RoomDrawer

- Slide-in detail panel for a selected room.
- Displays: room name, current mode (editable dropdown for `master_grower`+), active flags, `SprayLogList`, `CalibrationLogList`, recent event log with photo thumbnails.
- Action buttons: Log Event, Log Spray, Log Calibration, View Timeline.

### SprayLogList

- Sub-component of RoomDrawer.
- Renders all spray log entries for the room sorted by `appliedAt` descending.
- Each entry shows: product, rate, operator, date, re-entry expiry, photo thumbnail (if present).

### CalibrationLogList

- Sub-component of RoomDrawer.
- Renders all calibration log entries sorted by `calibratedAt` descending.
- Each entry shows: equipment type, pre/post readings, pass/fail chip, operator, date, photo thumbnail.

### SprayLogModal

- Opens when IPM flag is assigned or "Log Spray" is tapped in RoomDrawer.
- Fields: product name, application rate, method, operator (auto-filled from Stack Auth session), date/time, re-entry interval (hours), optional notes, optional photo attachment.
- On submit: `POST /spray-logs`; sets `reEntryExpiresAt` on the room; triggers Teams alert.

### CalibrationLogModal

- Opens from RoomDrawer or toolbox action.
- Fields: equipment type, pre-calibration reading, calibration standard, post-calibration reading, pass/fail, operator (auto-filled), date/time, optional notes, optional photo.
- On submit: `POST /calibration-logs`.

### IntegrationService (Worker module)

- `sendTeamsAlert(roomName, eventType, channelWebhookUrl)` — posts Adaptive Card; retries with exponential backoff × 3 on failure.
- `listenTeamsBotMessage(req)` — parses Bot Framework activity, handles "Status [Room]" commands.
- `createOutlookEvent(roomName, date, title)` — Graph API call with Bearer token.
- `getOutlookEvents(dateRange)` — fetches scheduled events.
- `presignR2Upload(roomId, logType)` — generates pre-signed R2 PUT URL.

### RoomDurableObject (Cloudflare Durable Object)

- One instance per `roomId`, identified by `env.ROOM_DO.idFromName(roomId)`.
- Accepts WebSocket upgrade requests from browser clients.
- Maintains a set of active WebSocket connections.
- On `broadcast(message)` call from a Worker: sends message to all connected sockets.
- On client WebSocket close: removes from connection set.

### StateStore (Zustand)

- `rooms`: map of `roomId → { name, mode, flags: RoomFlag[], reEntryExpiresAt, lastUpdated }`
- `flagDefinitions`: list of flag types (type, icon, color, notificationEnabled)
- `selectedFlagId`: flag currently selected on mobile (null otherwise)
- `integrations`: Teams webhook URL, Graph API token, notification preferences
- `wsConnections`: map of `roomId → WebSocket` for Durable Object connections

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
   (via Prisma)       |             [Graph API → Outlook]
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

### Re-Entry Countdown

1. `ReEntryBadge` mounts with `reEntryExpiresAt` prop.
2. `useInterval` hook fires every 60 seconds; calls `dayjs(reEntryExpiresAt).diff(dayjs(), 'minute')`.
3. `> 60`: display hours remaining, green badge.
4. `1–60`: display minutes remaining, amber badge.
5. `≤ 0`: display "CLEARED", green badge; store dispatches `CLEAR_REENTRY(roomId)`.

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
| RoomFlag | `POST /rooms/:id/flags` | Included in `GET /rooms` | N/A | `DELETE /rooms/:id/flags/:flagId` |
| Flag Definition | `POST /flags` | `GET /flags` | `PUT /flags/:id` | `DELETE /flags/:id` |
| Spray Log | `POST /spray-logs` | `GET /spray-logs?roomId=` | (immutable) | Admin purge only |
| Calibration Log | `POST /calibration-logs` | `GET /calibration-logs?roomId=` | (immutable) | Admin purge only |
| Event Log | Auto on every state change | `GET /events?roomId=&from=&to=` | (immutable) | Admin purge only |
| Photo | Upload to R2 via pre-signed URL (`POST /photos/presign`) | R2 URL stored with log entry | N/A | Admin purge only |
| Outlook Event | `POST` via Graph API on harvest | `GET` Graph `/me/events` | `PATCH` Graph `/me/events/:id` | `DELETE` Graph `/me/events/:id` |
| Teams Message | Triggered by flag/spray event | Bot Framework webhook inbound | N/A | N/A |

---

## 12. Data Storage & Schema

### Storage Methods

- **Neon (serverless PostgreSQL via Prisma):** Primary relational store. Supports DB branching for staging and test environments.
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

### Prisma Schema

```prisma
model Room {
  id               String           @id @default(uuid())
  name             String
  col              Int
  row              Int
  mode             String           @default("idle") // "veg"|"flower"|"flush"|"dry"|"idle"|"maintenance"
  reEntryExpiresAt DateTime?
  flags            RoomFlag[]
  events           EventLog[]
  sprayLogs        SprayLog[]
  calibrationLogs  CalibrationLog[]
  updatedAt        DateTime         @updatedAt
}

model Flag {
  id                  String     @id @default(uuid())
  type                String
  iconUrl             String
  color               String
  notificationEnabled Boolean    @default(false)
  calendarEnabled     Boolean    @default(false)
  rooms               RoomFlag[]
}

model RoomFlag {
  id         String   @id @default(uuid())
  room       Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  roomId     String
  flag       Flag     @relation(fields: [flagId], references: [id])
  flagId     String
  assignedBy String   // Stack Auth user ID
  assignedAt DateTime @default(now())

  @@index([roomId])
  @@index([flagId])
}

model SprayLog {
  id               String   @id @default(uuid())
  room             Room     @relation(fields: [roomId], references: [id])
  roomId           String
  product          String
  rate             String
  method           String?
  pcpRegNumber     String?  // Health Canada PCP registration number
  operatorId       String   // Stack Auth user ID
  appliedAt        DateTime
  reEntryHours     Float
  reEntryExpiresAt DateTime
  photoUrl         String?  // Cloudflare R2 URL
  notes            String?
  createdAt        DateTime @default(now())

  @@index([roomId])
  @@index([appliedAt])
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
  action        String   // "FLAG_ASSIGN"|"FLAG_REMOVE"|"MODE_CHANGE"|"SPRAY_LOG"|"CALIBRATION_LOG"|"FAILED_NOTIFICATION"
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

### Spray Logs

```
POST /spray-logs
  Auth: gardener | pest_control | master_grower | director
  Body: { roomId, product, rate, method?, pcpRegNumber?, appliedAt, reEntryHours, photoUrl?, notes? }
  Response: 201 { sprayLog } | 400 | 401 | 403

GET  /spray-logs?roomId=&from=&to=
  Auth: any authenticated role
  Response: 200 [SprayLog]
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

### Outlook Calendar (Microsoft Graph API)

1. Azure AD app registration with `Calendars.ReadWrite` delegated permission.
2. OAuth 2.0 Authorization Code flow; refresh token stored securely in Worker environment.
3. Create event: `POST https://graph.microsoft.com/v1.0/me/events`.
4. List events: `GET https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=&endDateTime=`
5. **Error handling:** On Graph API 401 (token expired), Worker uses the refresh token to obtain a new access token, then retries once. On failure, logs `FAILED_NOTIFICATION` event.

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
├── prisma/               # Shared Prisma schema
│   └── schema.prisma
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

## 17. Future Features (Planned)

- **Multi-facility support** — Top-level facility selector; `Facility` model added to schema with rooms scoped per facility.
- **Role-based access control UI** — Admin panel for Director to assign roles via Stack Auth management API; read-only view for auditors.
- **Harvest Gantt / timeline view** — Horizontal timeline across flower rooms showing stage day and expected harvest date.
- **Dashboard / KPI panel** — Rooms by mode count, active alerts, open IPM flags, next harvest date.
- **Notification escalation** — Unacknowledged WARN/ALERT flags escalate to Master Grower or Director after a configurable window.
- **PDF export** — One-click daily facility status report for Health Canada inspections.
- **Environmental sensor feed** — Pull temp/humidity/CO2/VPD per room from an existing sensor API; display as badge on tile.

---

## 18. Testing Strategy

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

## 19. References

- Stack Auth. (2024). *Stack Auth Documentation*. https://docs.stack-auth.com
- Cloudflare. (2024). *R2 Object Storage Documentation*. https://developers.cloudflare.com/r2/
- Cloudflare. (2024). *Durable Objects*. https://developers.cloudflare.com/durable-objects/
- Cloudflare. (2024). *Hono on Cloudflare Workers*. https://hono.dev/docs/getting-started/cloudflare-workers
- Neon. (2024). *Serverless PostgreSQL*. https://neon.tech/docs
- Prisma. (2024). *Prisma ORM with Neon (serverless driver)*. https://www.prisma.io/docs/orm/overview/databases/neon
- Microsoft. (2024). *Build bots with Microsoft Bot Framework*. https://learn.microsoft.com/en-us/azure/bot-service/
- Microsoft. (2024). *Create Incoming Webhooks in Microsoft Teams*. https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook
- Microsoft. (2024). *Adaptive Cards for Teams*. https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/design-effective-cards
- Microsoft. (2024). *Outlook Calendar API overview — Microsoft Graph*. https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview
- interact.js. (2024). *Drag and Drop & Resizing for the Modern Web*. https://interactjs.io
- Kenney. (2024). *Isometric Asset Packs*. https://kenney.nl/assets?q=isometric
- Day.js. (2024). *Fast 2kB alternative to Moment.js*. https://day.js.org
