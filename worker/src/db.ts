import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'
import type { Env } from './types'

export function getDb(env: Env) {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL
  const pool = new Pool({ connectionString })
  return drizzle(pool, { schema })
}

export type Db = ReturnType<typeof getDb>
