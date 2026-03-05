import { neon } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'

export function getDb(databaseUrl: string): PrismaClient {
  const sql = neon(databaseUrl)
  const adapter = new PrismaNeon(sql)
  return new PrismaClient({ adapter } as any)
}
