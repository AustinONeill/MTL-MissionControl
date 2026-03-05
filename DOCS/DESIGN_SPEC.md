# MTL Mission Control — Application Design & Data Specification

**Project:** MTL Mission Control — Cultivation Facility Isometric Dashboard  
**Author:** Austin O'Neill  
**Repository:** https://github.com/AustinONeill/MTL-MissionControl  
**Date:** March 5, 2026  
**Last Updated:** March 5, 2026

---

## 1. System Architecture

The application is divided into three distinct layers to ensure separation of concerns, maintainability, and scalability. Each layer communicates with adjacent layers through well-defined interfaces.

### Presentation Layer

- Renders the isometric facility map using SVG with CSS transforms.
- Displays the live-time header with a real-time clock updated every second.
- Renders a **mode badge and/or animation** on each room tile indicating its current operational mode (e.g., Veg, Flower, Flush, Dry, Idle, Maintenance).
- Manages the toolbox panel, including the room legend and draggable/droppable flag components (desktop) and tap-to-select/tap-to-assign flag components (mobile).
- Adapts all UI elements responsively across desktop, tablet, and mobile viewports.
- Provides visual feedback on flag placement, drag interactions, status changes, and spray re-entry countdowns.

### Application Layer

- Controls drag-and-drop logic for flags on desktop, snapping flags to valid room targets on the isometric grid.
- Controls two-step tap-to-assign on mobile: operator taps a flag to select it, then taps a room tile to assign it.
- Manages flag state: type, room assignment, timestamps, and priority levels.
- Manages room mode state: current mode per room, rendered as a badge and/or CSS animation on the tile.
- Interfaces with the integration service layer to push/pull data from Microsoft Teams and Outlook Calendar.
- Handles the responsive layout engine — recalculating isometric tile positions on viewport resize.
- Exposes a local event bus so UI components react to room-state changes in real time.

### Data / Integration Layer

- Persists room state, flag assignments, spray logs, calibration logs, and photo references to a backend (Node.js/Express or Next.js API routes).
- Authentication and session management handled by **Stack Auth** (JWT-based, role-aware).
- Photo attachments stored and compressed in **Cloudflare R2** (S3-compatible object storage).
- Real-time multi-user state and conflict resolution managed via **Cloudflare Durable Objects** (or Socket.io fallback).
- Communicates with the Microsoft Teams API (via Bot Framework / incoming webhooks) for bot-driven alerts and room status queries.
- Communicates with Microsoft Graph API for reading and writing Outlook Calendar events.
- Stores relational data in PostgreSQL via Prisma.
- Exposes REST or WebSocket endpoints for the Application Layer to consume.

---

## 2. Use Case Analysis

### Actors

- **Gardener** — Day-to-day floor operator; logs events, assigns flags, records spray and calibration entries.
- **Pest Control Specialist** — Creates and manages spray logs; views IPM flag history and re-entry countdowns.
- **Control / Automation Engineer** — Manages calibration logs for sensors and equipment; monitors room modes.
- **Master Grower** — Views and updates room modes and flag state across all rooms; approves spray log entries.
- **Director of Cultivation** — Read/review access across all rooms, logs, and reports; can purge audit records (admin).
- **Teams Bot** — Automated agent that sends/receives alerts tied to room flags via Microsoft Teams channels or direct messages.
- **Outlook Calendar** — External scheduling service that syncs harvest and maintenance events.

### Use Cases

**UC-01: View Isometric Facility Map**  
Actor: All roles  
Precondition: User is authenticated via Stack Auth.  
Flow: App loads the isometric map; map tiles scale and reflow to fit the viewport; room mode badges and animations render immediately; the live clock updates continuously.  
Postcondition: Full map is visible; each room displays its current mode and active flags.

**UC-02: Assign Flag to Room (Desktop — Drag & Drop)**  
Actor: Gardener, Pest Control Specialist, Master Grower  
Precondition: User is on a desktop/tablet viewport.  
Flow: Operator drags a flag from the toolbox; map rooms highlight as valid drop targets; operator drops the flag onto a room tile; flag snaps to the room and persists.  
Postcondition: Room state updates; connected services are notified if configured.

**UC-03: Assign Flag to Room (Mobile — Tap to Assign)**  
Actor: Gardener, Pest Control Specialist, Master Grower  
Precondition: User is on a mobile viewport.  
Flow: Operator taps a flag in the toolbox drawer to select it (highlighted active state); all room tiles show a ready-to-receive highlight; operator taps a room tile; flag is assigned and `selectedFlagId` clears.  
Postcondition: Room state updates identically to desktop path.

**UC-04: Move Flag Between Rooms**  
Actor: Gardener, Master Grower  
Precondition: A flag is already assigned to a room.  
Flow: Operator drags (desktop) or re-selects and taps (mobile) to move a flag to a new room; old room clears; new room receives the flag.  
Postcondition: State is updated and change is logged with a timestamp and operator ID.

**UC-05: View and Update Room Mode**  
Actor: Master Grower, Control / Automation Engineer  
Precondition: User has write access to room configuration.  
Flow: Operator opens a room's detail drawer; selects a new mode from a dropdown (Veg, Flower, Flush, Dry, Idle, Maintenance); tile badge and animation update immediately across all connected clients.  
Postcondition: Room mode is persisted and visible on the map in real time.

**UC-06: Log Spray Event**  
Actor: Pest Control Specialist, Gardener  
Precondition: IPM flag is placed on a room.  
Flow: A spray log form opens (or is accessible from the room drawer); operator records product name, application rate, operator name, application date, and re-entry interval (hours). On save, a re-entry countdown timer renders on the room tile.  
Postcondition: Spray log entry is persisted; room tile shows re-entry countdown; Teams alert sent if configured.

**UC-07: Log Calibration Event**  
Actor: Control / Automation Engineer  
Precondition: User accesses calibration log from room drawer or toolbox.  
Flow: Operator selects equipment type (pH meter, EC meter, CO2 sensor, etc.), records pre-calibration reading, calibration standard used, post-calibration reading, date, and operator. Entry is saved to the calibration log.  
Postcondition: Calibration record is persisted and visible in the room's event history.

**UC-08: Attach Photo to Log Entry**  
Actor: Any role  
Precondition: User is creating or viewing a QuickLog, spray log, or calibration log entry.  
Flow: Operator taps/clicks the photo attachment button; selects or captures an image; image is uploaded to Cloudflare R2, compressed server-side, and the returned URL is stored with the log entry.  
Postcondition: Photo thumbnail is visible on the log entry in the room drawer.

**UC-09: Receive Teams Alert**  
Actor: All roles, Teams Bot  
Precondition: Microsoft Teams integration is configured; a flag event is triggered.  
Flow: Application layer detects a critical flag placement or spray log creation; integration layer posts an Adaptive Card to a configured Teams channel via incoming webhook.  
Postcondition: Team receives a Teams notification with room name, flag type, and operator.

**UC-10: Query Room Status via Teams Bot**  
Actor: Any role  
Precondition: Teams bot is deployed and active in the team's channel.  
Flow: User sends "Status [Room Name]" in the Teams channel; bot queries current room state from the database; bot replies with an Adaptive Card showing mode, active flags, last spray log, and last-updated timestamp.  
Postcondition: User receives an up-to-date status summary inside Teams.

**UC-11: Sync Harvest Event to Outlook Calendar**  
Actor: Master Grower, Director of Cultivation  
Precondition: Microsoft Graph API credentials are configured; a harvest flag is placed.  
Flow: Application layer creates a calendar event via Graph API `POST /me/events` with room name, date, and operator details; event appears in Outlook.  
Postcondition: All team members with calendar access see the scheduled harvest.

**UC-12: Responsive Layout on Mobile**  
Actor: All roles  
Precondition: User accesses dashboard on a phone or tablet.  
Flow: Viewport resize triggers the responsive engine; tiles rescale via CSS custom property; toolbox collapses into a bottom drawer; drag-and-drop is replaced with the two-step tap-to-assign model.  
Postcondition: Full functionality is available on touch screens without requiring drag gestures.

---

## 3. Assets

### Isometric Map Tiles

- Custom SVG tiles per room type: Veg, Flower, Dry, Support, Office.
- Format: SVG preferred for resolution-independence; PNG fallback.
- Each tile type has a distinct roof color to visually distinguish room categories.

### Room Mode Badges & Animations

- Each room tile renders a small badge in the top corner showing its current mode (e.g., "VEG", "FLOWER", "FLUSH").
- Certain modes trigger a CSS animation on the tile (e.g., pulse for Maintenance, shimmer for Flush, glow for Harvest Ready).
- Badge colors map to a consistent mode color palette defined in the design system.

### Flag Icons

- SVG icons for each flag type: IPM, Defoliation, Transfer, Mode Change, Supply Ready, Calendar, Issue.
- Designed to remain legible at small sizes on high-density (Retina) screens.

### Fonts

- Primary: Inter or Roboto (Google Fonts) for dashboard UI text.
- Monospace: JetBrains Mono for the live clock and status codes.

### UI Components

- Toolbox panel, drag handle affordances, tooltip overlays.
- Responsive breakpoint system: ≥1280px desktop, 768–1279px tablet, <768px mobile.

---

## 4. Library & Service Usage

### Frontend

- **React + Vite:** Component-based UI for the toolbox, header, and map.
- **interact.js:** Drag-and-drop with touch support; handles flag drag events and drop-zone snapping on desktop.
- **Day.js:** Lightweight date/time for the live header clock, timestamp formatting, and re-entry countdown calculations.
- **CSS Grid / CSS Transforms:** Isometric tile layout using `rotate(45deg) skewX(-20deg)` technique.

### Auth

- **Stack Auth:** Handles user authentication, session tokens, and role-based claims. Provides prebuilt login UI components. No custom auth implementation required.

### Backend / Integration

- **Node.js + Express (or Next.js API routes):** REST API and webhook receiver.
- **Microsoft Teams (Bot Framework / Incoming Webhooks):** Sends Adaptive Card alerts to channels and receives inbound bot commands; shares the same Azure AD app registration as Graph API.
- **Microsoft Graph API:** OAuth 2.0 authenticated calls to `/me/events` for calendar read/write.
- **Socket.io (or Cloudflare Durable Objects):** Real-time push to the frontend when flag or mode state changes from any client.
- **Prisma + PostgreSQL:** Persistent storage for rooms, flags, spray logs, calibration logs, event history, and photo references.

### Storage

- **Cloudflare R2:** S3-compatible object storage for photo attachments. Images are uploaded via a pre-signed URL, optionally compressed via a Cloudflare Worker before storage. Zero egress fees.

### DevOps

- **dotenv:** Manage API keys and secrets.
- **Jest + React Testing Library:** Unit and integration tests.

---

## 5. Component & Module Breakdown

### IsometricMap

- Renders all room tiles in the correct isometric grid layout.
- Each tile receives `id`, `name`, `position (col, row)`, `mode`, and `currentFlags[]` from state.
- Renders a `RoomModeBadge` overlay on each tile based on the room's current mode.
- Listens for window resize events; recalculates tile scale using `viewportScale`.
- Each tile is a drop target registered with interact.js (desktop) and a tap target (mobile).

### RoomModeBadge

- Small overlay component rendered on the top corner of each tile.
- Displays a short mode label (e.g., "FLOWER", "FLUSH") with a color-coded background.
- Applies a CSS animation class based on the mode (e.g., `animate-pulse` for Maintenance, `animate-shimmer` for Flush).
- Props: `mode: string`.

### Header

- Displays facility name on the left, live clock on the right.
- Clock updates every 1000ms via `setInterval`.
- On mobile, collapses facility name to a monogram to preserve clock visibility.

### Toolbox / LegendPanel

- Lists all available flag types as draggable items (desktop) or tappable cards (mobile).
- Contains a legend mapping flag icon → meaning and mode badge → meaning.
- On mobile, renders as a bottom drawer toggled by a floating action button.

### Flag

- Draggable component on desktop with an icon, label, and optional priority badge.
- On mobile, renders as a tappable card. Tapping selects it (`selectedFlagId` set in store); tapping again deselects; tapping a room while selected triggers assignment.
- Emits `onFlagAssign(flagId, targetRoomId)` — shared between drag-drop and tap-to-assign paths.

### RoomDrawer

- Slide-in detail panel for a selected room.
- Displays: room name, current mode (editable dropdown for authorised roles), active flags, recent event log with photo thumbnails, spray log entries with re-entry countdown, calibration log entries.
- Action buttons: Log Event, View Spray Log, View Calibration Log, View Timeline.

### SprayLogModal

- Opens when the IPM flag is assigned or when "Log Spray" is tapped in RoomDrawer.
- Fields: product name, application rate, application method, operator (auto-filled from session), application date/time, re-entry interval (hours), optional notes, optional photo attachment.
- On submit: persists to `SprayLog` table; sets re-entry expiry on the room; triggers Teams alert if configured.

### CalibrationLogModal

- Opens from RoomDrawer or a dedicated toolbox action.
- Fields: equipment type (pH meter, EC meter, CO2 sensor, temp/humidity probe, etc.), pre-calibration reading, calibration standard used, post-calibration reading, pass/fail, operator (auto-filled), date/time, optional notes, optional photo.
- On submit: persists to `CalibrationLog` table.

### IntegrationService (backend module)

- `sendTeamsAlert(roomName, flagType, channelWebhookUrl)` — posts an Adaptive Card to a Teams channel.
- `listenTeamsBotMessage(req)` — parses inbound Bot Framework activity; handles "Status [Room]" commands.
- `createOutlookEvent(roomName, date, title)` — calls Graph API with Bearer token.
- `getOutlookEvents(dateRange)` — fetches scheduled events for display on dashboard.
- `uploadPhoto(file, roomId, logType)` — generates a pre-signed R2 URL, uploads and compresses the image, returns the stored URL.

### StateStore (Zustand)

- `rooms`: map of `roomId → { name, mode, currentFlags[], lastUpdated }`
- `flags`: list of flag definitions (type, icon, color, notificationEnabled)
- `selectedFlagId`: flag currently selected on mobile (null on desktop or when no selection)
- `integrations`: Teams webhook URL, Graph API token, notification preferences

---

## 6. Data Flow Diagram

```
[Operator Browser]
      |
      |  drag/drop (desktop) | tap-to-assign (mobile)
      v
[IsometricMap + Flag + RoomModeBadge Components]
      |
      |  onFlagAssign / onModeChange / onSprayLog / onCalibrationLog
      v
[StateStore / Application Layer]
      |            |
      |            |  persist
      v            v
[Socket.io /    [REST API / DB]         [Cloudflare R2]
 Durable Obj]       |                        ^
      |            |-- Teams Webhook --> [Teams Channel]
      |            |
      |            |-- Microsoft Graph API --> [Outlook Calendar]
      |
      v
[All connected browser clients update in real time]
```

---

## 7. Process Flow

### Map Initialization

1. Stack Auth validates the session token; role claims are attached to the request context.
2. App fetches current room states (mode, flags, active spray re-entry) from the REST API.
3. Isometric tiles render with mode badges and animations applied immediately.
4. `selectedFlagId` initializes to null.

### Flag Assignment

1. Desktop: interact.js fires drop event with `flagId` and `roomId`. Mobile: tap-to-assign fires `onFlagAssign`.
2. StateStore dispatches `ASSIGN_FLAG`; UI updates optimistically.
3. REST API `PATCH /rooms/:id` persists the change with `operatorId` from session.
4. If `notificationEnabled: true` on the flag type, IntegrationService posts a Teams Adaptive Card alert.
5. If flag type is `HARVEST_READY`, IntegrationService creates an Outlook Calendar event.
6. Socket.io / Durable Object broadcasts the change to all other connected clients.

### Spray Log Entry

1. IPM flag is assigned to a room, or operator taps "Log Spray" in the room drawer.
2. `SprayLogModal` opens; operator fills product, rate, re-entry interval, optional photo.
3. If a photo is attached, client requests a pre-signed R2 URL from the backend; image is uploaded directly to R2; backend stores the returned URL.
4. `POST /spray-logs` persists the entry; room's `reEntryExpiresAt` is calculated and stored.
5. Room tile renders a countdown badge until `reEntryExpiresAt`.
6. Teams alert fires if IPM flag has `notificationEnabled: true`.

### Calibration Log Entry

1. Operator opens `CalibrationLogModal` from the room drawer or toolbox.
2. Fills equipment type, readings, standard used, pass/fail, optional photo.
3. Photo upload follows same pre-signed R2 URL flow as spray log.
4. `POST /calibration-logs` persists the entry.
5. Entry appears in the room's event history in the drawer.

### Teams Bot Query

1. User sends "Status [Room Name]" in the Teams channel.
2. Bot Framework webhook receives the activity; IntegrationService queries DB for room state.
3. Bot replies with an Adaptive Card: room name, current mode, active flags, last spray entry, timestamp.

### Responsive Resize

1. `ResizeObserver` on the map container fires on any dimension change.
2. `viewportScale = containerWidth / BASE_MAP_WIDTH` is recalculated.
3. All tile positions and sizes update via CSS custom property `--map-scale`.
4. Toolbox switches layout via media query at 768px breakpoint.

---

## 8. Offline & Resilience Strategy

The app must remain partially functional during network interruptions since the facility floor may have poor connectivity.

- **Optimistic UI:** All flag assignments and mode changes are applied to the Zustand store immediately, before the API call returns. The UI never blocks on a network round-trip.
- **Stale-While-Revalidate:** On load, the app renders from cached state (LocalStorage or IndexedDB snapshot) while the fresh API response loads in the background.
- **IndexedDB Queue:** If a REST call fails (network offline), the action is queued in IndexedDB. On reconnect, the queue is replayed in order.
- **Conflict Resolution:** Cloudflare Durable Objects (or last-write-wins with server timestamps) resolve simultaneous edits. The server timestamp is authoritative; clients that lose a conflict receive a corrective state push via Socket.io.
- **Visual Indicator:** A banner in the header signals "Offline — changes will sync on reconnect" when the API is unreachable.

---

## 9. Compliance & Audit Trail

MTL Cannabis operates under Health Canada's Cannabis Regulations, which require traceable records for pesticide applications, equipment calibration, and room-level activity.

- **Event Log is immutable:** Every flag assignment, mode change, spray log, and calibration log creates an append-only `EventLog` record. Records cannot be updated; only an Admin (Director of Cultivation) can purge records with a logged purge event.
- **Operator identity on every record:** All log entries include `operatorId` sourced from the Stack Auth session token — no anonymous actions.
- **Spray log compliance fields:** `SprayLog` captures product name, application rate, re-entry interval, and Health Canada PCP registration number (optional but recommended).
- **Calibration log compliance fields:** `CalibrationLog` captures pre/post readings, standard used, and pass/fail — sufficient for equipment QA records.
- **Photo evidence:** Photo attachments on spray and calibration logs provide visual proof for inspections.
- **Export:** The Director of Cultivation can export a date-range event log as CSV or PDF from the admin panel (future feature — see Section 14).

---

## 10. Data Sources

### Source Types

- **In-memory state (Zustand):** Live room mode, flag, and re-entry state during a session.
- **REST API + PostgreSQL:** Persistent room config, flag history, spray logs, calibration logs, photo URLs, and credentials.
- **Cloudflare R2:** Binary photo storage; referenced by URL in the database.
- **External APIs:** Microsoft Teams (Bot Framework / incoming webhooks) and Microsoft Graph API (Microsoft 365).
- **Stack Auth:** User identity, role claims, and session tokens.

### Types of Data

- **Room State:** `roomId`, `name`, `position (col/row)`, `mode`, `currentFlagIds[]`, `reEntryExpiresAt`, `lastUpdated`
- **Flag Definitions:** `flagId`, `type`, `icon URL`, `color`, `notificationEnabled`, `calendarEnabled`
- **Event Log:** `timestamp`, `operatorId`, `roomId`, `action`, `previousValue`, `newValue`, `source (UI/TEAMS)`
- **Spray Log:** `roomId`, `product`, `rate`, `method`, `operatorId`, `appliedAt`, `reEntryHours`, `reEntryExpiresAt`, `photoUrl`, `notes`
- **Calibration Log:** `roomId`, `equipmentType`, `preReading`, `standard`, `postReading`, `passFail`, `operatorId`, `calibratedAt`, `photoUrl`, `notes`
- **Integration Config:** Teams channel webhook URL, Bot Framework app ID/secret, Graph API client ID/secret
- **Calendar Events:** `title`, `roomId`, `scheduledDate`, `outlookEventId`
- **Photos:** Stored in Cloudflare R2; URL referenced in spray/calibration/event log records

---

## 11. CRUD Operations

| Resource | Create | Read | Update | Delete |
|---|---|---|---|---|
| Room | Admin configures in setup | `GET /rooms` | `PATCH /rooms/:id` (mode, flag) | Admin only |
| Flag Definition | Admin adds flag type | `GET /flags` | `PUT /flags/:id` | `DELETE /flags/:id` |
| Spray Log | `POST /spray-logs` on IPM event | `GET /spray-logs?roomId=` | (immutable) | Admin purge only |
| Calibration Log | `POST /calibration-logs` | `GET /calibration-logs?roomId=` | (immutable) | Admin purge only |
| Event Log | Auto on every state change | `GET /events?roomId=&date=` | (immutable) | Admin purge only |
| Photo | Upload to R2 via pre-signed URL | R2 URL stored with log entry | N/A | Admin purge only |
| Outlook Event | `POST` via Graph API on harvest | `GET` Graph `/me/events` | `PATCH` Graph `/me/events/:id` | `DELETE` Graph `/me/events/:id` |
| Teams Message | Triggered by flag/spray event | Bot Framework webhook inbound | N/A | N/A |

---

## 12. Data Storage

### Storage Methods

- **PostgreSQL (via Prisma):** Primary relational store for rooms, flags, spray logs, calibration logs, event log, and photo URL references.
- **Cloudflare R2:** Binary object storage for photo attachments. Images uploaded via pre-signed URLs; compressed by a Cloudflare Worker on ingest. Zero egress fees within Cloudflare network.
- **Stack Auth:** Manages user accounts, sessions, and role assignments. No custom user/session tables needed in PostgreSQL.
- **Environment Variables (.env):** Secrets — R2 credentials, Teams webhook URL, Bot Framework credentials, Graph API client secret, DB connection string, Stack Auth API key.
- **Browser LocalStorage:** Persists toolbox collapse state, legend position, and a snapshot of room state for offline rendering.
- **In-memory (Zustand):** Fast reactive state for the UI; hydrated from REST API on load.

### Schema Sketch (Prisma)

```prisma
model Room {
  id               String       @id @default(uuid())
  name             String
  col              Int
  row              Int
  mode             String       @default("idle") // "veg" | "flower" | "flush" | "dry" | "idle" | "maintenance"
  currentFlagIds   String[]
  reEntryExpiresAt DateTime?
  events           EventLog[]
  sprayLogs        SprayLog[]
  calibrationLogs  CalibrationLog[]
  updatedAt        DateTime     @updatedAt
}

model Flag {
  id                  String  @id @default(uuid())
  type                String
  iconUrl             String
  color               String
  notificationEnabled Boolean @default(false)
  calendarEnabled     Boolean @default(false)
}

model SprayLog {
  id               String   @id @default(uuid())
  room             Room     @relation(fields: [roomId], references: [id])
  roomId           String
  product          String
  rate             String
  method           String?
  operatorId       String   // Stack Auth user ID
  appliedAt        DateTime
  reEntryHours     Float
  reEntryExpiresAt DateTime
  photoUrl         String?  // Cloudflare R2 URL
  notes            String?
  createdAt        DateTime @default(now())
}

model CalibrationLog {
  id            String   @id @default(uuid())
  room          Room     @relation(fields: [roomId], references: [id])
  roomId        String
  equipmentType String   // "pH meter" | "EC meter" | "CO2 sensor" | etc.
  preReading    Float
  standard      String
  postReading   Float
  passFail      Boolean
  operatorId    String   // Stack Auth user ID
  calibratedAt  DateTime
  photoUrl      String?  // Cloudflare R2 URL
  notes         String?
  createdAt     DateTime @default(now())
}

model EventLog {
  id            String   @id @default(uuid())
  room          Room     @relation(fields: [roomId], references: [id])
  roomId        String
  operatorId    String   // Stack Auth user ID
  action        String   // "FLAG_ASSIGN" | "FLAG_REMOVE" | "MODE_CHANGE" | "SPRAY_LOG" | "CALIBRATION_LOG"
  previousValue String?
  newValue      String?
  source        String   // "UI" | "TEAMS"
  createdAt     DateTime @default(now())
}
```

---

## 13. Responsive Design Strategy

### Breakpoints

- **Desktop (≥1280px):** Full isometric map, toolbox on the right, header full width.
- **Tablet (768–1279px):** Map scales to 70% of container width; toolbox collapses to icon strip.
- **Mobile (<768px):** Map scrolls horizontally; toolbox becomes a bottom drawer; drag-and-drop replaced with two-step tap-to-assign.

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

`--map-scale` is set dynamically:

```js
const scale = container.offsetWidth / BASE_MAP_WIDTH;
document.documentElement.style.setProperty('--map-scale', scale);
```

### Touch Interaction Model

On desktop, interact.js handles drag-and-drop natively via pointer events.

On mobile, a dedicated two-step tap model replaces drag entirely:

1. Operator taps a flag card in the toolbox drawer — card enters "active" highlighted state; `selectedFlagId` is set in the store.
2. All room tiles show a subtle "ready to receive" highlight.
3. Operator taps a room tile — `onFlagAssign(selectedFlagId, roomId)` fires; flag is assigned; `selectedFlagId` clears.
4. Tapping the already-selected flag again cancels the selection.
5. Tapping any room tile with nothing selected opens the room detail drawer.

---

## 14. Integration Architecture

### Authentication (Stack Auth)

- Stack Auth provides prebuilt sign-in UI, JWT session tokens, and role-based claims.
- Roles: `gardener`, `pest_control`, `automation_engineer`, `master_grower`, `director`.
- The backend reads the role claim from the JWT on every request to enforce permissions (e.g., only `master_grower` and above can change room mode; only `director` can purge logs).
- No custom user table required in PostgreSQL — user identity is resolved via Stack Auth's SDK.

### Cloudflare R2 (Photo Storage)

1. Client requests a pre-signed upload URL from the backend: `POST /photos/presign`.
2. Backend generates a pre-signed R2 PUT URL (using the AWS S3-compatible SDK) and returns it to the client.
3. Client uploads the image directly to R2 using the pre-signed URL.
4. Optionally, a Cloudflare Worker on the R2 bucket triggers image compression/resizing on ingest.
5. Backend stores the final R2 public URL in the associated log record.
6. Zero egress cost when accessed within Cloudflare's network; CDN-cached for fast thumbnail loads.

### Microsoft Teams (Bot Framework + Incoming Webhooks)

**Outbound alerts (Incoming Webhook — simplest path):**

1. In the target Teams channel, add the "Incoming Webhook" connector and copy the webhook URL.
2. Store the URL in `.env` as `TEAMS_WEBHOOK_URL`.
3. On a flag or spray log event, backend POSTs an Adaptive Card payload to the webhook URL.

**Inbound bot queries (Bot Framework — required for "Status Room 3" queries):**

1. Register a Bot in Azure Portal; obtain App ID and Client Secret.
2. Side-load the bot manifest in Teams or publish to the org's app catalog.
3. Configure messaging endpoint: `POST /webhooks/teams` on the backend.
4. Backend uses `botbuilder` SDK to parse incoming activities and reply with Adaptive Cards.
5. Shares the same Azure AD app registration as the Graph API integration.

### Outlook Calendar (Microsoft Graph API)

1. Register an app in Azure AD; grant `Calendars.ReadWrite` delegated permission.
2. Implement OAuth 2.0 Authorization Code flow; store refresh token securely.
3. Create event: `POST https://graph.microsoft.com/v1.0/me/events` with `subject`, `start/end datetime`, `location` (room name), and `attendees`.
4. List events: `GET https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=&endDateTime=`

---

## 15. Future Features (Planned)

- **Multi-facility support** — A top-level facility selector allowing the same app to manage multiple grow sites under one account. Requires a `Facility` model added to the schema with rooms scoped per facility.
- **Role-based access control UI** — Admin panel for the Director of Cultivation to assign roles to users via Stack Auth's management API. Read-only view for auditors and visitors.
- **Harvest Gantt / timeline view** — A horizontal timeline across all flower rooms showing current stage day and expected harvest date.
- **Dashboard / KPI panel** — Rooms by mode count, active alerts, rooms with open IPM flags, next harvest date.
- **Notification escalation** — If a WARN or ALERT flag is unacknowledged past a configurable window, a follow-up Teams alert escalates to the Master Grower or Director.
- **PDF export** — One-click daily facility status report for Health Canada inspections: all rooms, active flags, recent spray logs, recent calibration logs.
- **Environmental sensor feed** — Pull temp/humidity/CO2/VPD per room from an existing sensor API and display as a badge on the tile.

---

## 16. References

- Stack Auth. (2024). *Stack Auth Documentation*. https://docs.stack-auth.com
- Cloudflare. (2024). *R2 Object Storage Documentation*. https://developers.cloudflare.com/r2/
- Cloudflare. (2024). *Durable Objects*. https://developers.cloudflare.com/durable-objects/
- Microsoft. (2024). *Build bots with Microsoft Bot Framework*. https://learn.microsoft.com/en-us/azure/bot-service/
- Microsoft. (2024). *Create Incoming Webhooks in Microsoft Teams*. https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook
- Microsoft. (2024). *Adaptive Cards for Teams*. https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/design-effective-cards
- Microsoft. (2024). *Outlook Calendar API overview — Microsoft Graph*. https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview
- interact.js. (2024). *Drag and Drop & Resizing for the Modern Web*. https://interactjs.io
- Kenney. (2024). *Isometric Asset Packs*. https://kenney.nl/assets?q=isometric
- Prisma. (2024). *Prisma ORM Documentation*. https://www.prisma.io/docs
- Day.js. (2024). *Fast 2kB alternative to Moment.js*. https://day.js.org
