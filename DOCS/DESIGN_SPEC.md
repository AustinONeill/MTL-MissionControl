# MTL Mission Control — Application Design & Data Specification

**Project:** MTL Mission Control — Cultivation Facility Isometric Dashboard  
**Author:** Austin O'Neill  
**Repository:** https://github.com/AustinONeill/MTL-MissionControl  
**Date:** March 5, 2026

---

## 1. System Architecture

The application is divided into three distinct layers to ensure separation of concerns, maintainability, and scalability. Each layer communicates with adjacent layers through well-defined interfaces.

### Presentation Layer

- Renders the isometric facility map using HTML5 Canvas or SVG with CSS transforms.
- Displays the live-time header with a real-time clock updated every second.
- Manages the toolbox panel, including the room legend and draggable/droppable flag components.
- Adapts all UI elements responsively across desktop, tablet, and mobile viewports.
- Provides visual feedback on flag placement, drag interactions, and status changes.

### Application Layer

- Controls drag-and-drop logic for flags, snapping flags to valid room targets on the isometric grid.
- Manages flag state: type, room assignment, timestamps, and priority levels.
- Interfaces with the integration service layer to push/pull data from WhatsApp and Outlook Calendar.
- Handles the responsive layout engine — recalculating isometric tile positions on viewport resize.
- Exposes a local event bus so UI components react to room-state changes in real time.

### Data / Integration Layer

- Persists room state, flag assignments, and user sessions to a lightweight backend (Node.js/Express or Next.js API routes).
- Communicates with the WhatsApp Business API (via Meta Cloud API or Twilio) for bot-driven alerts.
- Communicates with Microsoft Graph API for reading and writing Outlook Calendar events.
- Stores configuration and historical state in a database (PostgreSQL or MongoDB).
- Exposes REST or WebSocket endpoints for the Application Layer to consume.

---

## 2. Use Case Analysis

### Actors

- **Facility Operator** — Staff member monitoring rooms on the dashboard.
- **Admin** — Manages flag types, room configuration, and integration credentials.
- **WhatsApp Bot** — Automated agent that sends/receives alerts tied to room flags.
- **Outlook Calendar** — External scheduling service that syncs harvest and maintenance events.

### Use Cases

**UC-01: View Isometric Facility Map**  
Actor: Facility Operator  
Precondition: User opens the dashboard on any device.  
Flow: App loads the isometric map; map tiles scale and reflow to fit the viewport; the live clock in the header updates continuously.  
Postcondition: Full map is visible and interactive on all screen sizes.

**UC-02: Drag & Drop Flag to Room**  
Actor: Facility Operator  
Precondition: At least one flag exists in the toolbox.  
Flow: Operator drags a flag from the toolbox; map rooms highlight as valid drop targets; operator drops the flag onto a room tile; flag snaps to the room and persists.  
Postcondition: Room state updates; connected services are notified if configured.

**UC-03: Move Flag Between Rooms**  
Actor: Facility Operator  
Precondition: A flag is already assigned to a room.  
Flow: Operator drags the flag from its current room to a new room tile; old room clears; new room receives the flag.  
Postcondition: State is updated and change is logged with a timestamp.

**UC-04: Receive WhatsApp Alert**  
Actor: Facility Operator, WhatsApp Bot  
Precondition: WhatsApp integration is configured; a flag event is triggered.  
Flow: Application layer detects a critical flag placement (e.g., "Maintenance Required"); integration layer calls WhatsApp Cloud API to send a message to configured recipients.  
Postcondition: Operator receives a WhatsApp notification with room name and flag type.

**UC-05: Query Room Status via WhatsApp Bot**  
Actor: Facility Operator  
Precondition: WhatsApp webhook is active.  
Flow: Operator sends a message such as "Status Room 3"; bot queries current room state from the database; bot replies with flag assignments and last-updated timestamps.  
Postcondition: Operator receives an up-to-date status summary.

**UC-06: Sync Harvest Event to Outlook Calendar**  
Actor: Facility Operator, Outlook Calendar  
Precondition: Microsoft Graph API credentials are configured; a harvest flag is placed.  
Flow: Application layer creates a calendar event via Graph API `POST /me/events` with room name, date, and operator details; event appears in Outlook.  
Postcondition: All team members with calendar access see the scheduled harvest.

**UC-07: Responsive Layout on Mobile**  
Actor: Facility Operator  
Precondition: User accesses dashboard on a phone or tablet.  
Flow: Viewport resize event triggers the responsive engine; isometric tiles rescale using a CSS viewport-relative transform; the toolbox collapses into a slide-out drawer; drag interactions are replaced with tap-to-assign on touch devices.  
Postcondition: Full functionality is available on touch screens.

---

## 3. Assets

### Isometric Map Tiles

- Custom PNG/SVG tiles per room type (veg room, flower room, dry room, office, etc.)
- Source: custom-designed or from isometric asset packs (e.g., Kenney.nl isometric tiles).
- Format: SVG preferred for resolution-independence; PNG fallback.

### Flag Icons

- SVG icons for each flag type: Maintenance, Harvest Ready, Pest Alert, Inspection, Custom.
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

- **React (or Vanilla JS + Vite):** Component-based UI for the toolbox, header, and map.
- **interact.js:** Drag-and-drop with touch support; handles flag drag events and drop-zone snapping.
- **Day.js:** Lightweight date/time for the live header clock and timestamp formatting.
- **CSS Grid / CSS Transforms:** Isometric tile layout using `rotate(45deg) skewX(-20deg)` technique for responsiveness without canvas overhead.

### Backend / Integration

- **Node.js + Express (or Next.js API routes):** REST API and webhook receiver.
- **Meta WhatsApp Cloud API (or Twilio WhatsApp):** Sends outbound messages and receives inbound bot queries via webhooks.
- **Microsoft Graph API:** OAuth 2.0 authenticated calls to `/me/events` for calendar read/write.
- **Socket.io:** Real-time push to the frontend when flag state changes from an external source (e.g., a WhatsApp command).
- **Prisma + PostgreSQL (or Mongoose + MongoDB):** Persistent storage for room state and flag history.

### DevOps

- **dotenv:** Manage API keys and secrets for WhatsApp, Microsoft, and DB connections.
- **Jest + React Testing Library:** Unit and integration tests.

---

## 5. Component & Module Breakdown

### IsometricMap

- Renders all room tiles in the correct isometric grid layout.
- Accepts a `rooms[]` prop with ID, name, position (col, row), and current flag.
- Listens for window resize events; recalculates tile scale using a `viewportScale` factor.
- Each tile is a drop target registered with interact.js.

### Header

- Displays facility name on the left, live clock on the right.
- Clock updates every 1000ms via `setInterval` using Day.js format.
- On mobile, collapses facility name to a monogram to preserve clock visibility.

### Toolbox

- Lists all available flag types as draggable items.
- Contains a legend mapping flag icon → meaning.
- On mobile, renders as a bottom drawer toggled by a floating action button.

### Flag

- Draggable component with an icon, label, and optional priority badge.
- Tracks `homeRoomId` (null if in toolbox) and `placedAt` timestamp.
- Emits `onFlagMove(flagId, targetRoomId)` event consumed by global state.

### IntegrationService (backend module)

- `sendWhatsAppAlert(roomName, flagType, recipients[])` — calls WhatsApp Cloud API.
- `listenWhatsAppWebhook(req)` — parses inbound bot messages and queries room state.
- `createOutlookEvent(roomName, date, title)` — calls Graph API with Bearer token.
- `getOutlookEvents(dateRange)` — fetches scheduled events for display on dashboard.

### StateStore (Zustand or Redux)

- `rooms`: map of `roomId → { name, currentFlag, lastUpdated }`
- `flags`: list of flag definitions (type, icon, color, notificationEnabled)
- `integrations`: WhatsApp config, Graph API token, notification preferences

---

## 6. Data Flow Diagram

```
[Operator Browser]
      |
      |  drag/drop, tap
      v
[IsometricMap + Flag Components]
      |
      |  onFlagMove(flagId, roomId)
      v
[StateStore / Application Layer]
      |            |
      |            |  persist
      v            v
[Socket.io]   [REST API / DB]
      |            |
      |            |-- WhatsApp Cloud API --> [Operator WhatsApp]
      |            |
      |            |-- Microsoft Graph API --> [Outlook Calendar]
      |
      v
[Browser UI updates in real time]
```

---

## 7. Process Flow

### Map Initialization

1. App fetches current room states from the REST API on load.
2. Isometric tiles are positioned using the CSS transform technique scaled to viewport width.
3. Flags with a `homeRoomId` are rendered on their assigned tiles immediately.

### Flag Drop

1. interact.js fires drop event with `flagId` and `roomId`.
2. StateStore dispatches `ASSIGN_FLAG`; UI updates optimistically.
3. REST API `PATCH /rooms/:id` persists the change.
4. If the flag type has `notificationEnabled: true`, IntegrationService sends a WhatsApp message.
5. If the flag type is `HARVEST_READY`, IntegrationService creates an Outlook Calendar event.

### WhatsApp Bot Query

1. Operator sends "Status [Room Name]" to the business WhatsApp number.
2. Webhook receives the message; IntegrationService queries DB for room state.
3. Bot replies with formatted text: room name, current flag, operator, timestamp.

### Responsive Resize

1. `ResizeObserver` on the map container fires on any dimension change.
2. `viewportScale = containerWidth / BASE_MAP_WIDTH` is recalculated.
3. All tile positions and sizes are updated via CSS custom property `--map-scale`.
4. Toolbox switches layout via a media query at 768px breakpoint.

---

## 8. Data Sources

### Source Types

- **In-memory state (StateStore):** Live room and flag state during a session.
- **REST API + Database:** Persistent room configuration, flag history, and integration credentials.
- **External APIs:** WhatsApp Cloud API (Meta) and Microsoft Graph API (Microsoft 365).

### Types of Data

- **Room State:** `roomId`, `name`, `position (col/row)`, `currentFlagId`, `lastUpdated`
- **Flag Definitions:** `flagId`, `type`, `icon URL`, `color`, `notificationEnabled`, `calendarEnabled`
- **Event Log:** `timestamp`, `operatorId`, `roomId`, `previousFlagId`, `newFlagId`, `source (UI/WhatsApp)`
- **Integration Config:** WhatsApp phone number ID, access token, Graph API client ID/secret
- **Calendar Events:** `title`, `roomId`, `scheduledDate`, `outlookEventId`

---

## 9. CRUD Operations

| Resource | Create | Read | Update | Delete |
|---|---|---|---|---|
| Room | Admin configures room in setup | `GET /rooms` | `PATCH /rooms/:id` (flag change) | Admin removes room from config |
| Flag Definition | Admin adds flag type | `GET /flags` | `PUT /flags/:id` | `DELETE /flags/:id` |
| Event Log | Auto on every flag move | `GET /events?roomId=&date=` | (immutable log) | Admin purge only |
| Outlook Event | `POST` via Graph API on harvest | `GET` Graph `/me/events` | `PATCH` Graph `/me/events/:id` | `DELETE` Graph `/me/events/:id` |
| WhatsApp Message | Triggered by flag placement | Webhook inbound | N/A | N/A |

---

## 10. Data Storage

### Storage Methods

- **PostgreSQL (via Prisma):** Primary relational store for rooms, flags, event log, and calendar references.
- **Environment Variables (.env):** Secrets — WhatsApp access token, Graph API client secret, DB connection string.
- **Browser LocalStorage:** Persists toolbox collapse state and display preferences client-side.
- **In-memory (StateStore):** Fast, reactive state for the UI; hydrated from REST API on load.

### Schema Sketch (Prisma)

```prisma
model Room {
  id            String   @id @default(uuid())
  name          String
  col           Int
  row           Int
  currentFlag   Flag?    @relation(fields: [currentFlagId], references: [id])
  currentFlagId String?
  events        EventLog[]
  updatedAt     DateTime @updatedAt
}

model Flag {
  id                  String  @id @default(uuid())
  type                String
  iconUrl             String
  color               String
  notificationEnabled Boolean @default(false)
  calendarEnabled     Boolean @default(false)
  rooms               Room[]
}

model EventLog {
  id           String   @id @default(uuid())
  room         Room     @relation(fields: [roomId], references: [id])
  roomId       String
  previousFlag String?
  newFlag      String?
  source       String   // "UI" | "WHATSAPP"
  createdAt    DateTime @default(now())
}
```

---

## 11. Responsive Design Strategy

### Breakpoints

- **Desktop (≥1280px):** Full isometric map, toolbox on the right, header full width.
- **Tablet (768–1279px):** Map scales to 70% of container width; toolbox collapses to icon strip.
- **Mobile (<768px):** Map scrolls horizontally; toolbox becomes a bottom drawer; drag becomes tap-to-assign.

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

`--map-scale` is set dynamically via JavaScript:

```js
const scale = container.offsetWidth / BASE_MAP_WIDTH;
document.documentElement.style.setProperty('--map-scale', scale);
```

### Touch Support

- interact.js natively supports pointer events, covering mouse and touch simultaneously.
- A tap on a room while a flag is "selected" in the toolbox triggers assignment on mobile.

---

## 12. Integration Architecture

### WhatsApp (Meta Cloud API)

1. Register a Meta Business Account and obtain a WhatsApp Business Phone Number ID and Access Token.
2. Configure a webhook URL in Meta Developer Console pointing to `POST /webhooks/whatsapp`.
3. Backend verifies the webhook with a `verify_token`; processes inbound messages.
4. Outbound messages: `POST https://graph.facebook.com/v19.0/{phone-number-id}/messages` with `{ to, type: "text", text: { body } }` and `Authorization: Bearer <token>`.

### Outlook Calendar (Microsoft Graph API)

1. Register an app in Azure AD; grant `Calendars.ReadWrite` delegated permission.
2. Implement OAuth 2.0 Authorization Code flow; store the refresh token securely.
3. Create event: `POST https://graph.microsoft.com/v1.0/me/events` with `subject`, `start/end datetime`, `location` (room name), and `attendees`.
4. List events: `GET https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=&endDateTime=`

---

## 13. References

- Meta. (2024). *WhatsApp Cloud API Documentation*. https://developers.facebook.com/docs/whatsapp/cloud-api
- Microsoft. (2024). *Outlook Calendar API overview — Microsoft Graph*. https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview
- interact.js. (2024). *Drag and Drop & Resizing for the Modern Web*. https://interactjs.io
- Kenney. (2024). *Isometric Asset Packs*. https://kenney.nl/assets?q=isometric
- Prisma. (2024). *Prisma ORM Documentation*. https://www.prisma.io/docs
- Day.js. (2024). *Fast 2kB alternative to Moment.js*. https://day.js.org
- Admin. (2023). *Chess Game System Design*. https://techbyexample.com/chess-low-level-design (structural reference from prior deliverable)
