interface GraphTokenResponse {
  access_token: string
  expires_in: number
}

interface OutlookEventPayload {
  roomName: string
  title: string
  startDate: string // ISO date string
  endDate: string   // ISO date string
  operatorEmail: string
}

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  tenantId: string
): Promise<string> {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) throw new Error(`Token request failed: ${res.status}`)
  const data = (await res.json()) as GraphTokenResponse
  return data.access_token
}

export async function createOutlookEvent(
  clientId: string,
  clientSecret: string,
  tenantId: string,
  payload: OutlookEventPayload
): Promise<void> {
  const token = await getAccessToken(clientId, clientSecret, tenantId)

  const event = {
    subject: `${payload.title} — ${payload.roomName}`,
    start: { dateTime: payload.startDate, timeZone: 'America/Toronto' },
    end: { dateTime: payload.endDate, timeZone: 'America/Toronto' },
    location: { displayName: payload.roomName },
    body: {
      contentType: 'HTML',
      content: `<p>Scheduled by MTL Mission Control for ${payload.roomName}.</p>`,
    },
  }

  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!res.ok) throw new Error(`Graph API event creation failed: ${res.status}`)
}

export async function getOutlookEvents(
  clientId: string,
  clientSecret: string,
  tenantId: string,
  startDateTime: string,
  endDateTime: string
): Promise<unknown[]> {
  const token = await getAccessToken(clientId, clientSecret, tenantId)

  const url = `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error(`Graph API events fetch failed: ${res.status}`)
  const data = (await res.json()) as { value: unknown[] }
  return data.value
}
