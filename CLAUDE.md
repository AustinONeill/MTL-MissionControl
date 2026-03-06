# MTL Mission Control — Claude Context

## Project
Cannabis cultivation facility dashboard. Isometric SVG map, real-time overlays, compliance logging (spray F-005, net, pot check, filter change), room transfers, and role-based access. Built on Cloudflare edge infrastructure.

## Monorepo Layout
```
/Users/austin/Documents/MTL - MissionControl/
├── client/        React 19 + Vite 7 (Cloudflare Pages)
├── worker/        Hono 4 + Drizzle (Cloudflare Workers)
└── DOCS/          Design spec, priority, README
```

## Key File Paths
| File | Purpose |
|------|---------|
| `client/src/store/facilityStore.js` | Zustand store — rooms, overlays, WS, transfers |
| `client/src/components/IsometricMap.jsx` | Main SVG map — tiles, drag-drop, glyph clicks |
| `client/src/components/RoomDrawer.jsx` | Tabbed side panel (Overview, Spray Logs, Pot Check, Filter Change) |
| `client/src/components/LegendPanel.jsx` | Draggable overlay legend (toolbox) |
| `client/src/index.css` | All global + component styles |
| `worker/src/schema.ts` | Drizzle ORM schema — all tables |
| `worker/src/worker.ts` | Hono router — all routes mounted |
| `worker/src/routes/` | One file per resource (rooms, sprayLogs, netLogs, overlays, etc.) |
| `worker/src/middleware/auth.ts` | Stack Auth JWT verification + role enforcement |
| `worker/src/durable-objects/RoomDurableObject.ts` | Per-room WS broadcast |
| `DOCS/DESIGN_SPEC.md` | Canonical spec — check before major changes |
| `DOCS/PRIORITY.md` | What to build next, in order |

## Deploy Commands
```bash
# Client (from client/)
npm run build && npx wrangler pages deploy dist --project-name mtl-missioncontrol --commit-dirty=true

# Worker (from worker/)
npm run deploy

# Schema push to Neon (requires DATABASE_URL env)
npm run db:push
```

## Tech Stack (exact versions)
- **React** 19.2 + **Vite** 7.3 + **Zustand** 5.0
- **Hono** 4.7.7 on **Cloudflare Workers**
- **Drizzle ORM** 0.41 + **@neondatabase/serverless** 0.10.4
- **Stack Auth** 2.8 (Microsoft OAuth, JWT, roles)
- **Cloudflare R2** (photos, aws4fetch for presigned URLs)
- **Cloudflare Durable Objects** (1 per room, WebSocket broadcast)
- **Cloudflare Hyperdrive** (Neon connection pooling, ID: 387df7aa)
- **TypeScript** 5.8 (worker), **JavaScript/JSX** (client)
- **jose** 5.10 (JWT verification in worker)

## Room Modes
`off | auto | crop | fill` — never use old modes (veg/flower/flush/dry)

## Overlay Types (all valid keys)
`ipm | net | defoliation | transfer | harvest_ready | mode_change | supply_ready | issue`
Note: `pot_check` and `filter_change` are NOT in the draggable toolbox — accessed only via room drawer tabs.

## Drawer Tabs
`OVERVIEW | SPRAY LOGS | POT CHECK | FILTER CHANGE`
No Calibration tab (removed). No action buttons in Overview (removed).

## Auth Roles
`grower | master_grower | director` — enforced in worker middleware per endpoint.

## API Base
- Prod worker: `https://mtl-missioncontrol-api.austinoneill55.workers.dev`
- Prod client: `https://mtl-missioncontrol.pages.dev`
- Local worker: `http://localhost:8787`

## Offline Strategy
- `loadRooms()` caches to `localStorage` as fallback snapshot
- Optimistic updates on overlay place/remove — temp ID replaced after server confirms
- WS reconnect with 3s backoff per room

## Important Conventions
- Overlay `status` field: `active | completed | pending_review`
- Symbols array on rooms is **derived** from active overlays — never store directly
- All dates stored as ISO strings; display with `en-CA` locale
- CSS variables: `--surface`, `--border`, `--text`, `--text-dim`, `--font-mono`
- Modal pattern: `createPortal` to `document.body`, `Escape` key closes
- Photo uploads: presign via `/api/photos/presign` → direct PUT to R2

## Do Not
- Don't add Prisma — we use Drizzle only
- Don't change room modes to anything other than off/auto/crop/fill
- Don't run `drizzle-kit push` without DATABASE_URL set in environment
- Don't add calibration log UI (removed by design)
- Don't commit `.env` files

## Worker Secrets (set via `wrangler secret put`)
DATABASE_URL, STACK_AUTH_JWKS_URL, STACK_AUTH_PROJECT_ID, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL, TEAMS_WEBHOOK_URL, BOT_FRAMEWORK_APP_ID, BOT_FRAMEWORK_APP_SECRET, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID
