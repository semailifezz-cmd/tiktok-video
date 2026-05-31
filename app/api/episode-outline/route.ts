import { NextRequest, NextResponse } from 'next/server'
import { callGrok } from '@/lib/xai'
import type { SeriesBible } from '@/lib/types'

const SYSTEM = `You are a professional drama series showrunner. Return raw JSON only — no markdown, no code fences.`

export async function POST(req: NextRequest) {
  if (!process.env.KIE_API_KEY) {
    return NextResponse.json({ error: 'KIE_API_KEY not configured.' }, { status: 503 })
  }

  const { bible, episodeNum, formula, continuityMemo } = await req.json() as {
    bible: SeriesBible
    episodeNum: number
    formula: string
    continuityMemo: string
  }

  const charNames = bible.characters.map(c => `${c.name} (${c.role}, ${c.fruit_type})`).join(', ')
  const venueNames = bible.venues.map(v => v.location_name).join(', ')
  const prevSummaries = bible.episodes.map(e => `Ep ${e.ep_num}: "${e.title}" — ${e.summary}`).join('\n')

  const prompt = `Write the outline for Episode ${episodeNum} of "${bible.series_title}".

Series Arc: ${bible.overall_arc}
Genre: ${bible.genre}
Characters: ${charNames}
Available Venues: ${venueNames}

Episodes so far:
${prevSummaries}

${continuityMemo ? `Continuity from the last episode: ${continuityMemo}` : ''}

The 4-step drama formula (every episode follows this):
${formula}

Return a single JSON object:
{
  "ep_num": ${episodeNum},
  "title": "A specific episode title that advances the story",
  "summary": "2-3 sentences that continue the series arc — escalate the tension or advance the relationship",
  "characters_featured": ["Character Name 1", "Character Name 2"],
  "venues_featured": ["Exact Venue Name from the list above"],
  "key_plot_points": "Specific drama beats that map to the 4 formula steps for this episode"
}

CRITICAL: characters_featured must contain EXACTLY 2 character names — no more, no fewer. Video generation fails with 3+ characters in the same scene. Choose the 2 most dramatically important characters for this episode.`

  try {
    const raw = await callGrok(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.9, maxTokens: 1024, responseFormat: 'json_object' },
    )

    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      return NextResponse.json({ error: 'Model returned no JSON for episode outline' }, { status: 500 })
    }

    return NextResponse.json(JSON.parse(raw.slice(start, end + 1)))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
