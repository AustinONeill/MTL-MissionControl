import { Hono } from 'hono'
import { AwsClient } from 'aws4fetch'
import type { Env, HonoVariables } from '../types'

const photos = new Hono<{ Bindings: Env; Variables: HonoVariables }>()

photos.post('/presign', async (c) => {
  const body = await c.req.json<{
    roomId: string
    logType: 'spray' | 'calibration' | 'event'
    contentType: string
  }>()

  if (!body.roomId || !body.logType || !body.contentType) {
    return c.json({ error: 'roomId, logType, and contentType are required', code: 400 }, 400)
  }

  const key = `${body.logType}/${body.roomId}/${Date.now()}-${Math.random().toString(36).slice(2)}`
  const expiresIn = 300 // 5 minutes

  const aws = new AwsClient({
    accessKeyId: c.env.R2_ACCESS_KEY_ID,
    secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
    region: 'auto',
    service: 's3',
  })

  const endpoint = `https://${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${c.env.R2_BUCKET_NAME}/${key}`

  const presignedUrl = await aws.sign(
    new Request(endpoint, { method: 'PUT' }),
    {
      aws: { signQuery: true },
      headers: { 'Content-Type': body.contentType },
      expiresIn,
    }
  )

  const publicUrl = `${c.env.R2_PUBLIC_BASE_URL}/${key}`

  return c.json({
    uploadUrl: presignedUrl.url,
    publicUrl,
    key,
  })
})

export { photos }
