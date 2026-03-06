# MTL Mission Control

Real-time cannabis cultivation facility dashboard. Isometric facility map with drag-and-drop overlay management, compliance logging, room transfers, and live multi-user sync via WebSocket.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 7, deployed to Cloudflare Pages |
| State | Zustand 5 (client), Cloudflare Durable Objects (real-time) |
| Backend | Hono 4 on Cloudflare Workers |
| Database | Neon PostgreSQL (serverless) via Drizzle ORM |
| Auth | Stack Auth (Microsoft OAuth, JWT, role-based access) |
| Storage | Cloudflare R2 (photo attachments) |
| Real-time | Cloudflare Durable Objects — 1 instance per room, WebSocket broadcast |
| Connection Pooling | Cloudflare Hyperdrive → Neon |

---

## Project Structure

```
.
├── client/                 React frontend (Cloudflare Pages)
│   ├── src/
│   │   ├── components/     UI components
│   │   ├── store/          Zustand store (facilityStore.js)
│   │   └── index.css       All styles
│   ├── vite.config.js
│   └── package.json
│
├── worker/                 Hono API (Cloudflare Workers)
│   ├── src/
│   │   ├── routes/         One file per resource
│   │   ├── middleware/     Auth (Stack Auth JWT)
│   │   ├── durable-objects/ Per-room WebSocket hub
│   │   ├── integrations/   Teams webhooks
│   │   ├── schema.ts       Drizzle ORM schema
│   │   ├── db.ts           Database connection
│   │   ├── types.ts        Shared TypeScript types
│   │   └── worker.ts       Hono app entry point
│   ├── drizzle.config.ts
│   ├── wrangler.toml
│   └── package.json
│
├── DOCS/
│   ├── DESIGN_SPEC.md      Canonical architecture and spec
│   └── PRIORITY.md         Feature backlog, ordered by priority
│
└── CLAUDE.md               AI assistant context for this project
```

---

## Prerequisites

- Node.js 20+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with Workers and Pages enabled
- Neon PostgreSQL database
- Stack Auth project (Microsoft OAuth configured)

---

## Local Development

### 1. Clone and install

```bash
git clone <repo>
cd "MTL - MissionControl"

# Install worker deps
cd worker && npm install

# Install client deps
cd ../client && npm install
```

### 2. Configure environment

**Worker** — copy `worker/.env.example` to `worker/.dev.vars` and fill in:
```
DATABASE_URL=postgresql://...
STACK_AUTH_JWKS_URL=https://api.stack-auth.com/api/v1/projects/YOUR_ID/.well-known/jwks.json
STACK_AUTH_PROJECT_ID=your_project_id
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=mtl-photos
R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
```

**Client** — copy `client/.env.example` to `client/.env.local`:
```
VITE_API_BASE_URL=http://localhost:8787
VITE_STACK_PROJECT_ID=your_stack_project_id
VITE_R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev
```

### 3. Push database schema

```bash
cd worker
npm run db:push          # requires DATABASE_URL in .dev.vars
```

### 4. Start dev servers

```bash
# Terminal 1 — Worker API (port 8787)
cd worker && npm run dev

# Terminal 2 — Client (port 5173)
cd client && npm run dev
```

---

## Deployment

### Worker (API)

```bash
cd worker

# Set production secrets (first time only)
wrangler secret put DATABASE_URL
wrangler secret put STACK_AUTH_JWKS_URL
# ... repeat for all secrets listed in CLAUDE.md

# Deploy
npm run deploy
```

### Client (Pages)

```bash
cd client
npm run build
npx wrangler pages deploy dist --project-name mtl-missioncontrol
```

---

## API Overview

All endpoints require `Authorization: Bearer <token>` (Stack Auth JWT).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rooms` | All rooms with active overlays |
| PATCH | `/api/rooms/:id` | Update room mode |
| GET/POST | `/api/rooms/:id/overlays` | Overlay CRUD |
| PATCH/DELETE | `/api/rooms/:id/overlays/:oid` | Update / remove overlay |
| GET/POST | `/api/spray-logs` | F-005 pesticide application logs |
| GET/POST | `/api/net-logs` | Net lowering + zip-tie confirmation |
| GET/POST | `/api/pot-check-logs` | Pot health checks |
| GET/POST | `/api/filter-change-logs` | Filter replacement records |
| GET | `/api/events` | Audit event log |
| POST | `/api/photos/presign` | Generate R2 presigned upload URL |
| GET | `/ws/rooms/:id` | WebSocket upgrade (Durable Object) |

---

## Room Modes

| Mode | Description |
|------|-------------|
| `off` | Room inactive |
| `auto` | Climate automated, no active crop |
| `crop` | Active grow cycle |
| `fill` | Filling / transition state |

## Overlay Types

Drag from legend onto a room tile to assign. `pot_check` and `filter_change` are logged via the room drawer only (not draggable).

| Key | Glyph | Description |
|-----|-------|-------------|
| `ipm` | 🐛 | IPM treatment active |
| `net` | 🕸 | Net lowered |
| `defoliation` | ✂ | Defoliation in progress |
| `transfer` | ⇄ | Room transfer pending |
| `harvest_ready` | ◷ | Harvest window open |
| `mode_change` | ⚙ | Mode recently changed |
| `supply_ready` | ◈ | Supplies prepared |
| `issue` | ⚠ | Open issue flagged |

---

## Auth Roles

| Role | Access |
|------|--------|
| `grower` | Read all, log spray/net/checks |
| `master_grower` | + Approve spray logs, supervisor sign-off |
| `director` | + Full admin, mode changes |
