interface TeamsAlertPayload {
  type: 'FLAG_ASSIGN' | 'FLAG_REMOVE' | 'SPRAY_LOG' | 'CALIBRATION_LOG' | 'MODE_CHANGE'
  roomName: string
  operator: string
  detail?: string
}

const TYPE_LABELS: Record<TeamsAlertPayload['type'], string> = {
  FLAG_ASSIGN: '🚩 Flag Assigned',
  FLAG_REMOVE: 'Flag Removed',
  SPRAY_LOG: '🧪 Spray Log',
  CALIBRATION_LOG: '🔬 Calibration Log',
  MODE_CHANGE: '🔄 Mode Changed',
}

export async function sendTeamsAlert(
  webhookUrl: string,
  payload: TeamsAlertPayload,
  attempt = 1
): Promise<void> {
  if (!webhookUrl) return

  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: TYPE_LABELS[payload.type] ?? payload.type,
              weight: 'Bolder',
              size: 'Medium',
            },
            {
              type: 'FactSet',
              facts: [
                { title: 'Room', value: payload.roomName },
                { title: 'Operator', value: payload.operator },
                ...(payload.detail ? [{ title: 'Detail', value: payload.detail }] : []),
                { title: 'Time', value: new Date().toLocaleString('en-CA') },
              ],
            },
          ],
        },
      },
    ],
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  })

  if (!res.ok && attempt < 3) {
    const delay = Math.pow(2, attempt - 1) * 1000
    await new Promise((resolve) => setTimeout(resolve, delay))
    return sendTeamsAlert(webhookUrl, payload, attempt + 1)
  }
}
