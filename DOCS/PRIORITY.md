# MTL Mission Control — Priority Backlog

Items are ordered by operational value. Complete each tier before moving to the next.

---

## Tier 1 — Core Operations (Ship First)

### 1.1 Database Schema Push
- Run `npm run db:push` in `worker/` with `DATABASE_URL` set
- Applies all tables to Neon: overlays, sprayLogs, netLogs, potCheckLogs, filterChangeLogs, eventLogs
- **Blocker for all real data persistence**

### 1.2 Spray Log — Real Data Flow
- F-005 form already built (`SprayLogModal.jsx`)
- Need: verify `/api/spray-logs` POST saves and returns correctly
- Need: `SprayLogList.jsx` fetches and renders saved logs
- Need: re-entry countdown badge activates after save (`reEntryExpiresAt` propagated to room state)

### 1.3 Net Log — Real Data Flow
- NetModal already built (two-card: net lowered → zip ties)
- Need: verify `/api/net-logs` POST saves correctly
- Need: clicking 🕸 on map tile opens NetModal for rooms that have `net` overlay active

### 1.4 Pot Check — Real Data Flow
- PotCheckTab inline form in drawer already built
- Need: verify `/api/pot-check-logs` POST works end-to-end

### 1.5 Filter Change — Real Data Flow
- FilterChangeTab inline form in drawer already built
- Need: verify `/api/filter-change-logs` POST works end-to-end

---

## Tier 2 — Compliance & Reporting

### 2.1 Spray Log List
- `SprayLogList.jsx` needs to fetch real logs from `/api/spray-logs?roomId=X`
- Display: pesticide name, date, operator, re-entry expiry
- Should show last 10, with "load more"

### 2.2 Re-Entry Countdown
- After spray log saved, `reEntryExpiresAt` should be set on the room
- `ReEntryBadge.jsx` renders countdown on the map tile
- Badge clears when time passes or manually dismissed

### 2.3 Teams Alerts
- IPM overlay placed → Teams card with room name + operator
- Spray log saved → Teams card with pesticide + re-entry window
- Pot check critical → Teams card with notes + photo link
- Verify webhook URL is set as Wrangler secret

### 2.4 Event Log (Audit Trail)
- Every overlay place/remove, mode change, and log creation writes to `event_logs`
- Need: basic audit view — could be a future drawer tab or admin page
- Workers already write to event_logs where implemented — verify coverage

---

## Tier 3 — UX Polish

### 3.1 Room Drawer — Log History Tabs
- SPRAY LOGS tab: `SprayLogList` component with real API data + pagination
- POT CHECK tab: show recent pot check logs below the form (last 5)
- FILTER CHANGE tab: show recent filter change logs below the form (last 5)

### 3.2 Offline Queue
- Currently: optimistic updates stay in memory, not persisted
- Need: IndexedDB queue for failed API calls
- Replay on reconnect (WS back online)

### 3.3 Defoliation — API-backed
- Currently defoliation table state is local (Zustand seed only)
- Need: save defoliation progress to overlays `options` JSON field
- Auto-remove `defoliation` overlay when all tables complete

### 3.4 Transfer — API-backed
- Transfer state currently local only
- Need: POST to `/api/rooms/:id/overlays` with `overlayType: 'transfer'` and `options: { destinationId }`
- Need: PATCH to complete or cancel transfer

### 3.5 Net Overlay Auto-Create
- When NetModal saves a log with `lowered: true`, the `net` overlay should be placed automatically
- Currently the user must also drag the net overlay from the toolbox separately

---

## Tier 4 — Access Control

### 4.1 Role-Based UI Gates
- Some actions should be hidden or disabled based on role:
  - Mode changes: `master_grower` or `director` only
  - Spray supervisor sign-off: `master_grower` or `director` only
  - Transfer creation: `master_grower` or `director` only
- Role comes from `authUser` in the store (from `/api/me`)

### 4.2 Re-Entry Room Lock
- If `reEntryExpiresAt` is in the future, room should show visual lock state
- Prevent mode changes during re-entry (or at least warn)

---

## Tier 5 — Integrations

### 5.1 Microsoft Teams Bot (Inbound)
- Bot Framework webhook already scaffolded in `worker/src/routes/webhooks.ts`
- Need: command parsing — e.g. "status F7" returns room overlay summary
- Need: Azure AD app registration + Bot Framework channel setup

### 5.2 Outlook Calendar Export
- Site tasks with `exportToOutlook: true` → create event via Graph API
- Requires Azure AD OAuth with `Calendars.ReadWrite` scope

### 5.3 Site Tasks / Scheduling
- `site_tasks` and `recurring_tasks` tables in schema but no UI yet
- Need: task creation, assignment to room, status tracking
- Could surface as a "TASKS" tab in the drawer or a separate admin page

---

## Tier 6 — Infrastructure

### 6.1 Staging Environment
- Neon DB branching for staging (`dev` branch)
- Wrangler environments (`[env.staging]` in wrangler.toml)
- Cloudflare Pages preview deployments

### 6.2 CI/CD Pipeline
- GitHub Actions: lint → build → deploy worker → deploy pages on push to `main`
- Block merge if build fails

### 6.3 Database Migrations
- Currently using `drizzle-kit push` (no migration files)
- For production: switch to `drizzle-kit generate` + `migrate` for tracked migrations

### 6.4 Error Monitoring
- Add Sentry or Cloudflare Workers observability
- Client: ErrorBoundary already exists, needs Sentry DSN wired in
- Worker: structured error logging with request IDs

---

## Deferred / Removed

- ~~Calibration logs~~ — removed by design decision
- ~~Prisma ORM~~ — replaced by Drizzle
- ~~Pot check / Filter change as separate modals~~ — moved to drawer tabs
