import type { UniversePrompt, SeriesBible, EpisodeOutline } from './types'

export const BIBLE_SYSTEM_PROMPT = `You are a professional drama series showrunner specialising in Pixar-style anthropomorphic fruit/vegetable character stories. Your response must be a raw JSON object and nothing else — no greeting, no explanation, no markdown, no code fences. Start your response with { and end with }. Any text outside the JSON object will break the pipeline.`

export function buildBiblePrompt(input: UniversePrompt): string {
  const charCount = input.main_characters.match(/\d+/)?.[0] ?? '4'

  return `Create a complete series bible for this TikTok fruit drama:

Title: ${input.series_title}
Genre: ${input.genre}
Setting: ${input.setting_era}
Core Conflict: ${input.core_conflict}
Tone: ${input.tone}
Main Characters: ${input.main_characters}
Total Episodes: ${input.total_episodes}

CRITICAL ART STYLE RULES — ALL characters must follow this:
- Every character is an anthropomorphic fruit or vegetable: human body with an oversized fruit/vegetable head
- Each character must have a specific fruit_type (e.g. "banana", "strawberry", "apple", "orange", "watermelon", "grape", "pineapple", "avocado", "lemon", "cherry")
- The protagonist is typically a low-status fruit (banana, corn, or plain lemon) dressed in torn/worn clothing
- The antagonist/love interest is a vivid, attractive fruit (strawberry, cherry, or apple) in a work uniform or elegant outfit
- Supporting characters can be any fruit/vegetable type
- All image_prompts must use Pixar-style 3D CGI language, NOT photorealistic

Episode Formula (EVERY episode must follow this structure):
${input.episode_formula}

Output this EXACT JSON schema (no deviations):
{
  "series_title": "${input.series_title}",
  "genre": "${input.genre}",
  "overall_arc": "2-3 sentence description of the full series arc",
  "characters": [
    {
      "name": "Full Name",
      "age": "25",
      "role": "protagonist",
      "fruit_type": "banana",
      "physical_description": "Elongated yellow banana head, scruffy beard, sad drooping eyes with big Pixar-style pupils. Lean human body, slightly hunched posture.",
      "personality": "Key personality traits",
      "outfit_style": "Torn denim shorts, worn-out flip flops, faded t-shirt, backwards cap, beat-up backpack",
      "image_prompt": "Pixar-style 3D animation, anthropomorphic banana character, oversized banana head on human body, [exact physical description], [outfit description]. Warm cinematic lighting. Smooth 3D render. Expressive Pixar face. High detail. 9:16 vertical."
    }
  ],
  "venues": [
    {
      "location_name": "Venue Name",
      "style": "Warm American diner / fast-food interior",
      "lighting": "Warm pendant lamp lighting, golden ambient tones",
      "time_of_day": "day",
      "description": "Full location description",
      "image_prompt": "Pixar-style 3D animation interior, [detailed venue description], checkered floor, pendant lights, warm cinematic lighting. Smooth 3D render. High detail. 9:16 vertical."
    }
  ],
  "props": [
    {
      "prop_name": "Prop Name",
      "visual_desc": "Detailed visual description",
      "owner_character": "Character Name",
      "image_prompt": "Pixar-style 3D animation, [prop description on neutral surface]. Soft studio lighting. High detail."
    }
  ],
  "episodes": [
    {
      "ep_num": 1,
      "title": "Episode Title",
      "summary": "2-3 sentence episode summary",
      "characters_featured": ["Name1", "Name2"],
      "venues_featured": ["Venue Name"],
      "key_plot_points": "Specific plot developments and formula step events"
    }
  ]
}

Requirements:
- Create exactly ${charCount} main characters (one must be the protagonist)
- EVERY character must have a fruit_type and Pixar-style image_prompt
- Create 3-4 distinct venues (warm interiors: diners, restaurants, lobbies, rooftops)
- Create 2-3 recurring props
- Generate all ${input.total_episodes} episode outlines
- Every episode must map to the formula (Step 1 = Clip 1, Step 2 = Clip 2, etc.)
- Keep character descriptions specific enough for consistent 3D image generation`
}

export const SCRIPT_SYSTEM_PROMPT = `You are a professional drama screenwriter and cinematographer specialising in Pixar-style anthropomorphic fruit character stories. Your response must be a raw JSON array and nothing else — no greeting, no explanation, no markdown, no code fences. Start your response with [ and end with ]. Any text outside the JSON array will break the pipeline.`

export function buildScriptPrompt(
  episode: EpisodeOutline,
  bible: SeriesBible,
  formula: string,
  prevMemo: string
): string {
  const charList = bible.characters
    .map(c => `- ${c.name} (${c.role}, ${c.fruit_type ?? 'fruit'} character, age ${c.age}): ${c.physical_description} | Outfit: ${c.outfit_style}`)
    .join('\n')
  const venueList = bible.venues
    .map(v => `- ${v.location_name}: ${v.description} | Lighting: ${v.lighting} | Time: ${v.time_of_day}`)
    .join('\n')

  return `Generate 4 detailed cinematic scene prompts for Episode ${episode.ep_num}: "${episode.title}"

Summary: ${episode.summary}
Key Plot Points: ${episode.key_plot_points}
Characters in this episode: ${episode.characters_featured.join(', ')}
Venues: ${episode.venues_featured.join(', ')}

Full Character Database (all are Pixar-style 3D anthropomorphic fruit/vegetable characters):
${charList}

Available Venues (all are Pixar-style 3D warm interiors):
${venueList}

${prevMemo ? `Continuity from previous episode:\n${prevMemo}\n` : ''}

EPISODE FORMULA — Every clip MUST map to its formula step:
${formula}

ART STYLE REMINDER — Every raw_prompt must:
- Reference the Pixar-style 3D animation aesthetic
- Describe fruit characters by NAME ONLY (reference images handle their appearance)
- Include warm cinematic lighting details
- Be written for a 9:16 vertical TikTok video format

Output a JSON array of exactly 4 scene objects:
[
  {
    "ep_num": ${episode.ep_num},
    "scene_num": 1,
    "clip_num": 1,
    "formula_step": 1,
    "segment_duration": "0–15s",
    "characters_used": ["Name1"],
    "venue_used": "Exact Venue Name from the list above",
    "props_used": [],
    "character_expressions": {
      "Name1": "Pixar-style exaggerated expression — describe the large eyes (drooping, wide, glassy, narrow), brow position, mouth shape, cheek position. Example: 'Eyes cast downward with heavy lids, brows pulled together in a sad arch. Lower lip slightly trembles. The oversized banana head tilts forward in shame.'"
    },
    "character_actions": {
      "Name1": "Precise physical actions: posture, hand/arm position, movement. Example: 'Shuffles forward slowly, backpack slumping off one shoulder. Both hands grip the counter edge. Feet in worn flip flops shuffle on the checkered tile floor.'"
    },
    "camera_angle": "Specific shot type — e.g. 'Low-angle medium shot looking up at the strawberry cashier, emphasising her confident dominance over the banana protagonist'",
    "camera_movement": "Camera motion — e.g. 'Static wide establishing shot, then slow dolly-push to a close-up on the banana protagonist face'",
    "atmosphere": "Overall mood: crowd behaviour, spatial relationships, symbolic staging that reinforces the formula step",
    "color_ambience": "Pixar color palette — e.g. 'Warm golden-amber fills the diner interior. Protagonist is slightly cooler-toned, visually isolated from the warm confident figures around him.'",
    "raw_prompt": "Complete 4–6 sentence Pixar-style 3D cinematic video prompt for 9:16 vertical TikTok format. Describe the venue, character actions, expressions, camera work, atmosphere, and color in one fluid description. Reference characters by NAME ONLY. Explicitly mention: Pixar-style 3D animation, anthropomorphic fruit characters, warm cinematic lighting, 9:16 vertical."
  }
]

Strict rules:
- Clip 1 → Formula Step 1, Clip 2 → Step 2, Clip 3 → Step 3, Clip 4 → Step 4
- ONLY reference characters by name — never describe their fruit type or appearance (reference images handle that)
- character_expressions and character_actions must cover every name in characters_used
- raw_prompt must explicitly state the Pixar 3D art style
- segment_duration must match: Clip 1 → "0–15s", Clip 2 → "15–30s", Clip 3 → "30–45s", Clip 4 → "45–60s"`
}
