const KIE_BASE = 'https://api.kie.ai/api/v1'

// Kie.ai grok-imagine video: max supported duration is 30s per clip.
// Episodes are split into 15s clips (4 per episode = 60s total) to stay within this limit.
export const MAX_CLIP_DURATION_S = 30
export const DEFAULT_CLIP_DURATION_S = 15

function apiKey(): string {
  const key = process.env.KIE_API_KEY
  if (!key) throw new Error('KIE_API_KEY not configured. Add it to .env.local or Vercel env vars.')
  return key
}

function authHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey()}`,
    'Content-Type': 'application/json',
  }
}

async function createTask(model: string, input: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ model, input }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Kie.ai createTask ${res.status}: ${body}`)
  }
  const data = await res.json()
  if (data.code !== 200) throw new Error(`Kie.ai error ${data.code}: ${data.msg}`)
  return data.data.taskId as string
}

export type KieState = 'waiting' | 'queuing' | 'generating' | 'success' | 'fail'

export interface PollResult {
  state: KieState
  resultUrls: string[]
  failReason?: string
}

export async function pollTask(taskId: string): Promise<PollResult> {
  const res = await fetch(`${KIE_BASE}/jobs/recordInfo?taskId=${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey()}` },
  })
  if (!res.ok) throw new Error(`Kie.ai pollTask ${res.status}`)
  const data = await res.json()
  if (data.code !== 200) throw new Error(`Kie.ai poll error ${data.code}: ${data.msg}`)

  const task = data.data
  let resultUrls: string[] = []
  let failReason: string | undefined

  if (task.resultJson) {
    try {
      const parsed = JSON.parse(task.resultJson)
      resultUrls = parsed.resultUrls ?? []
      // Surface any error field from resultJson
      failReason =
        parsed.errorMsg ||
        parsed.error ||
        parsed.failReason ||
        parsed.message ||
        parsed.reason ||
        undefined
    } catch {
      // resultJson is not valid JSON — use raw value as the error message
      if (task.state === 'fail') failReason = `resultJson parse error: ${String(task.resultJson).slice(0, 200)}`
    }
  }

  // Fall back to top-level task fields
  if (!failReason) {
    failReason =
      task.errorMsg ||
      task.failReason ||
      task.message ||
      task.reason ||
      task.error ||
      undefined
  }

  // Final fallback: include the full raw task object so nothing is silently swallowed
  if (!failReason && task.state === 'fail') {
    failReason = `Kie.ai state=fail (no reason provided). Raw task: ${JSON.stringify(task).slice(0, 400)}`
  }

  return { state: task.state as KieState, resultUrls, failReason }
}

export async function submitImageJob(prompt: string): Promise<string> {
  return createTask('grok-imagine/text-to-image', {
    prompt,
    aspect_ratio: '1:1',
    enable_pro: true,
  })
}

// Generate a video clip. Duration is capped at MAX_CLIP_DURATION_S (30s).
// For episode segments longer than 30s, call this multiple times with sub-clips.
export async function submitVideoJob(payload: {
  prompt: string
  image_urls: string[]
  duration: number
  aspect_ratio: string
  resolution: string
}): Promise<string> {
  const duration = Math.min(payload.duration, MAX_CLIP_DURATION_S)

  if (payload.image_urls.length > 0) {
    return createTask('grok-imagine/image-to-video', {
      image_urls: payload.image_urls,
      prompt: payload.prompt,
      mode: 'normal',
      duration: String(duration),
      aspect_ratio: payload.aspect_ratio,
      resolution: payload.resolution,
    })
  }
  return createTask('grok-imagine/text-to-video', {
    prompt: payload.prompt,
    mode: 'normal',
    duration,
    aspect_ratio: payload.aspect_ratio,
    resolution: payload.resolution,
  })
}
