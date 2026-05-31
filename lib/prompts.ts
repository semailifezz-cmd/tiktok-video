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
      "Name1": "Pixar-style exaggerated expression — describe the large eyes (drooping, wide, glassy, narrow), brow position, mouth shape, cheek position. NEVER use abstract emotion words ('sad', 'nervous', 'happy') — describe physical features only: eye state, brow position, mouth shape, body lean or tilt. Example: 'Eyes cast downward with heavy lids, brows pulled together in a tight arch. Lower lip slightly trembles. The oversized banana head tilts forward, chin nearly touching the chest.'"
    },
    "action_timeline": "The scene narrative broken into three 5-second beats. Each beat describes the whole situation — what is happening in the space, how all characters and the environment relate. Characters are details within the scene, not separate tracks. Use smooth, continuous motion verbs: 'gradually,' 'slowly,' 'eases,' 'flows into,' 'drifts.' AVOID: 'suddenly,' 'jerks,' 'rapidly,' 'cuts to.' The 10s-15s beat MUST end on a held, motionless pose — this is the last frame and the handoff point for the next clip. Format: '0s-5s: [full scene situation with all characters as details]. 5s-10s: [full scene situation]. 10s-15s: [full scene situation — end on a held, visually strong frame].' Example: '0s-5s: Marco shuffles through the door, backpack slumped low on his shoulders. Sofia, behind the register, goes still when she sees him — her expression sharpens into quiet contempt. The other customers carry on, oblivious. 5s-10s: Marco steps to the counter and holds out his order slip. Sofia glances at it, then at him, then slowly lets it fall to the counter without touching it — tilting her head toward the exit. 10s-15s: Marco stands frozen, the slip untouched between them. Sofia has turned to the next customer, her back to him, as if he never existed — held still.'",
    "camera_angle": "Shot framing ONLY — no movement here. e.g. 'Low-angle medium shot' or 'Wide establishing shot' or 'Close-up on faces'. ONE shot type.",
    "camera_movement": "ONE primary camera move with stability descriptor and duration. NEVER stack two moves. Pick ONE from: slow dolly-in / slow dolly-out / gentle pan left / gentle pan right / steady tracking shot / static tripod-mounted / subtle handheld. Format: '[move], [stability], over [duration]. e.g. Slow dolly-in, tripod-mounted, over 15 seconds.' or 'Gentle pan right, gimbal-smoothed, over 15 seconds.' or 'Static, tripod-mounted.'",
    "scene_lighting": "REQUIRED. ONE specific lighting line — the single biggest quality signal for video generation. State the light source, direction, and mood. e.g. 'Warm golden pendant lamp glow from above, soft amber fill, deep warm shadows.' or 'Soft natural light from window left, warm white ambient fill.' or 'Rim lighting on protagonist from behind, warm pendant overhead, dark background fill.' Keep identical across all 4 clips.",
    "atmosphere": "Overall mood: crowd behaviour, spatial relationships, symbolic staging that reinforces the formula step. Do NOT include lighting here — lighting goes in scene_lighting.",
    "color_ambience": "Pixar color palette — MUST be IDENTICAL across all 4 clips. Define it in Clip 1, copy word-for-word to Clips 2/3/4. e.g. 'Warm golden-amber fills the diner interior. Protagonist is slightly cooler-toned, visually isolated from the warm confident figures around him.'",
    "clip_bridge": "REQUIRED for Clips 1/2/3. One sentence describing the EXACT physical state and screen position of every character at the END of this clip's 10s–15s beat. This is the last frame — the next clip opens from this exact state. e.g. 'Marco stands frozen near the entrance, head bowed, both hands gripping his backpack straps. Sofia has turned away, back to camera, arms crossed behind the register.'",
    "raw_prompt": "SETTING: [Pixar 3D interior name, key props — e.g. 'Warm Pixar 3D fast-food interior, checkered floor, pendant lamps']\nCHARACTERS: [Who is present by NAME ONLY and where they stand — e.g. 'Marco stands at the counter, shoulders hunched. Sofia stands behind the register, arms crossed.']\nACTION: [Timeline of events — '0s–5s: [setup]. 5s–10s: [main event]. 10s–15s: [reaction/hold].' Example: '0s–5s: Marco enters and freezes at the sight of Sofia. 5s–10s: He slowly reaches for the menu board with a trembling hand. 10s–15s: Sofia gradually turns away, ignoring him — held still.']\nCAMERA: [Shot type + ONE movement — e.g. 'Low-angle medium shot. Slow dolly-in, tripod-mounted, over 15 seconds.']\nLIGHTING: [Exact scene_lighting value — e.g. 'Warm golden pendant lamp glow from above, soft amber fill, deep warm shadows.']\nSTYLE: Pixar-style 3D animation, anthropomorphic fruit characters, warm cinematic lighting, smooth fluid motion, no sudden cuts, 9:16 vertical TikTok format"
  }
]

VISUAL COHERENCE — these 4 clips must stitch into one seamless 60-second episode:

Venue lock: All 4 clips use the EXACT same venue_used string. Only change venue if the formula explicitly specifies a location move.

Color lock: Define color_ambience once in Clip 1. Copy it word-for-word into Clips 2, 3, and 4. The color palette NEVER shifts mid-episode.

Lighting lock: The atmosphere field must describe the same lighting quality across all 4 clips — same warmth, same shadows, same ambient tone.

Character state chain: The 10s–15s beat of each clip is a held position. The 0s–5s beat of the NEXT clip opens from that exact position. Your clip_bridge captures this handoff. Write the clip_bridges first, then write character_actions to match them.

Camera arc across the episode (camera_angle = shot type, camera_movement = ONE move with stability + duration):
  - Clip 1 (Establish): camera_angle: 'Wide establishing shot' | camera_movement: 'Slow dolly-in, tripod-mounted, over 15 seconds'
  - Clip 2 (React): camera_angle: 'Medium shot' | camera_movement: 'Slow dolly-in to close-up, gimbal-smoothed, over 15 seconds'
  - Clip 3 (Turn): camera_angle: 'Close-up' | camera_movement: 'Slow dolly-out to medium shot, tripod-mounted, over 15 seconds'
  - Clip 4 (Exit): camera_angle: 'Medium shot' | camera_movement: 'Slow dolly-out to wide shot, tripod-mounted, over 15 seconds'

Strict rules:
- Clip 1 → Formula Step 1, Clip 2 → Step 2, Clip 3 → Step 3, Clip 4 → Step 4
- MAXIMUM 2 characters per scene — 3 or more causes face drift, body warping, and identity confusion in video generation
- ONLY reference characters by name — never describe their fruit type or appearance (reference images handle that)
- character_expressions must cover every name in characters_used
- action_timeline MUST use three beats: 0s-5s / 5s-10s / 10s-15s — written as whole-scene narrative, not per-character lists
- action_timeline 0s-5s beat of Clip 2/3/4 MUST pick up from the physical state described in the previous clip's clip_bridge
- ALL 4 clips MUST have identical venue_used
- ALL 4 clips MUST have identical color_ambience
- ALL 4 clips MUST have identical scene_lighting — define it in Clip 1 and copy word-for-word to Clips 2/3/4
- clip_bridge is REQUIRED on Clips 1, 2, and 3 (Clip 4 needs no bridge — it is the final shot)
- raw_prompt MUST use all 6 labeled parts in order: SETTING / CHARACTERS / ACTION / CAMERA / LIGHTING / STYLE — each on its own line, colon after the label
- raw_prompt ACTION MUST include the three-beat timeline: 0s–5s / 5s–10s / 10s–15s
- action_timeline and raw_prompt ACTION verbs must be smooth and gradual — use 'gradually,' 'slowly,' 'eases,' 'flows into,' 'drifts.' NEVER use 'suddenly,' 'jerks,' 'rapidly,' or 'cuts to'
- camera_movement must be ONE primary move only — NEVER stack two moves (e.g. 'dolly-in while panning' is forbidden — pick ONE)
- NEVER use 'fast' as a descriptor anywhere — it is the single biggest video quality degrader
- NEVER use negative phrasing ('no blur', 'without X', 'avoid Y') — always describe what IS present, never what is absent
- segment_duration must match: Clip 1 → "0–15s", Clip 2 → "15–30s", Clip 3 → "30–45s", Clip 4 → "45–60s"`
}
