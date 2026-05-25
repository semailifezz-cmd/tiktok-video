import { NextRequest, NextResponse } from 'next/server'
import { callGrok } from '@/lib/xai'
import { BIBLE_SYSTEM_PROMPT, buildBiblePrompt } from '@/lib/prompts'
import type { UniversePrompt } from '@/lib/types'

function extractJson(raw: string): { json: string } | { error: string } {
  const start = raw.indexOf('{')
  if (start === -1) return { error: `No JSON object found. Response starts with: "${raw.slice(0, 200)}"` }
  const end = raw.lastIndexOf('}')
  if (end === -1 || end <= start) {
    return {
      error:
        `JSON object was truncated — starts with "{" but has no closing "}". ` +
        `This usually means the model ran out of output tokens. ` +
        `Try reducing the number of episodes. First 300 chars: "${raw.slice(0, 300)}"`,
    }
  }
  return { json: raw.slice(start, end + 1) }
}


function parseContext(json: string, err: SyntaxError): string {
  const posMatch = err.message.match(/position (\d+)/)
  if (!posMatch) return json.slice(0, 300)
  const pos = parseInt(posMatch[1])
  const from = Math.max(0, pos - 120)
  const to = Math.min(json.length, pos + 120)
  return `…${json.slice(from, to)}…  ← error near position ${pos}`
}

export async function POST(req: NextRequest) {
  if (!process.env.KIE_API_KEY) {
    return NextResponse.json(
      { error: 'KIE_API_KEY is not configured. Add it to your .env.local file.' },
      { status: 503 }
    )
  }

  const input: UniversePrompt = await req.json()

  if (!input.series_title || !input.genre || !input.core_conflict) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const userPrompt = buildBiblePrompt(input)
    const raw = await callGrok(
      [
        { role: 'system', content: BIBLE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.85, maxTokens: 16384, responseFormat: 'json_object' }
    )

    const extracted = extractJson(raw)
    if ('error' in extracted) {
      return NextResponse.json({ error: extracted.error }, { status: 500 })
    }

    let bible
    try {
      bible = JSON.parse(extracted.json)
    } catch (e1) {
      const err = e1 instanceof SyntaxError ? e1 : null
      const context = err ? parseContext(extracted.json, err) : extracted.json.slice(0, 300)
      return NextResponse.json(
        { error: `Series bible JSON parse error — ${err?.message ?? 'unknown'}. Context: "${context}"` },
        { status: 500 }
      )
    }

    return NextResponse.json(bible)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `bible/route: ${message}` }, { status: 500 })
  }
}
