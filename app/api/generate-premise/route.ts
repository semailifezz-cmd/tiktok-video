import { NextResponse } from 'next/server'
import { callGrok } from '@/lib/xai'

const SYSTEM = `You are a creative director for Pixar-style anthropomorphic fruit character TikTok drama series. Return raw JSON only — no markdown, no code fences, no explanation.`

const PROMPT = `Generate a fresh and creative premise for a new Pixar-style fruit character TikTok drama series.

Rules:
- All characters are anthropomorphic fruit/vegetable (human body, oversized fruit head)
- Must follow the social status drama arc: Humiliation → Identity Revealed → Tables Turn → Iconic Exit
- Warm Pixar 3D CGI aesthetic, 9:16 vertical, designed for TikTok micro-drama
- Be creative — use varied settings (Tokyo, Paris, Dubai, Sydney, etc.) and different fruit types

Return this exact JSON:
{
  "series_title": "A dramatic title (e.g. 'The Mango Who Was Betrayed', 'Queen of the Avocados', 'The Grape Heir')",
  "genre": "Fruit Drama / [sub-genre, e.g. Romance, Workplace Revenge, Class War, Secret Identity]",
  "setting_era": "Contemporary [specific city and location type, e.g. 'Tokyo luxury hotel', 'Paris fashion house', 'Dubai penthouse'], 2024",
  "tone": "Warm, cinematic, [specific emotional tone, e.g. heart-wrenching, fiery, bittersweet], Pixar-style 3D animation",
  "core_conflict": "2-3 sentences. Name the protagonist fruit character and their low-status situation, who wronged or humiliated them, and what dramatic reversal of fortune awaits."
}`

export async function POST() {
  if (!process.env.KIE_API_KEY) {
    return NextResponse.json({ error: 'KIE_API_KEY not configured.' }, { status: 503 })
  }

  try {
    const raw = await callGrok(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: PROMPT },
      ],
      { temperature: 1.0, maxTokens: 1024, responseFormat: 'json_object' },
    )

    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      return NextResponse.json({ error: 'Model returned no JSON' }, { status: 500 })
    }

    return NextResponse.json(JSON.parse(raw.slice(start, end + 1)))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
