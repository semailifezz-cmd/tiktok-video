import { NextResponse } from 'next/server'
import { callGrok } from '@/lib/xai'

const SYSTEM = `You are a creative director for Pixar-style fruit character TikTok micro-drama. Return raw JSON only — no markdown, no code fences, no explanation.`

const PROMPT = `Generate a fresh variation of the 4-step episode formula for a Pixar-style fruit character TikTok drama.

The arc must stay the same: Humiliation → Identity Revealed → Tables Turn → Iconic Exit
Each step maps to a 15-second clip. The format, structure, and drama formula must be identical — only the setting, social dynamic, plot details, and visual descriptions should differ.

Be creative — use varied social settings (luxury hotel lobby, high-end fashion boutique, exclusive restaurant, corporate office, airport VIP lounge, upscale gym, art gallery opening, rooftop bar, etc.) and vary the power dynamic (boss/intern, celebrity/fan, old money/working class, etc.).

Return this exact JSON:
{
  "episode_formula": "Step 1 — [Step Name] (0–15s / Clip 1)\\nSetting: [Pixar-style 3D interior description]\\nPlot: [What happens in this clip — protagonist humiliated, what the antagonist does]\\nVisual style: Pixar 3D CGI. Anthropomorphic fruit/vegetable characters. Warm cinematic lighting. 9:16 vertical.\\nGoal: [Emotional goal for the viewer]\\n\\nStep 2 — [Step Name] (15–30s / Clip 2)\\nPlot: [Identity reveal — who enters, what they say, how others react]\\nPerformance: [How the protagonist's demeanor shifts]\\nVisual: [Shot type and reaction details]\\n\\nStep 3 — [Step Name] (30–45s / Clip 3)\\nPlot: [How the antagonist reacts, what the reversal looks like]\\nVisual: [Staging and shot description]\\n\\nStep 4 — [Step Name] (45–60s / Clip 4)\\nPlot: [Protagonist's exit, final line or gesture, antagonist's last expression]\\nEnding: [How it closes — slow fade, door closing, car pulling away, etc.]\\nGoal: [Emotional payoff]"
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
