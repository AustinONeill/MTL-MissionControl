import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from './schema'
import type { Env } from './types'

export function getDb(env: Env) {
  // In production: route through Hyperdrive's edge connection pool.
  // In local dev (wrangler dev): Hyperdrive is unavailable so fall back to
  // the direct Neon URL via HTTP. The neon-http import is used for the fallback.
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL

  // Workers expose WebSocket globally — required by @neondatabase/serverless Pool
  neonConfig.webSocketConstructor = WebSocket

  const pool = new Pool({ connectionString })
  return drizzle(pool, { schema })
}

export type Db = ReturnType<typeof getDb>
