import type { SeriesBible, EpisodeScript, EpisodeOutline, ScenePrompt } from './types'

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function buildContinuityMemo(episode: EpisodeOutline): string {
  return `Episode ${episode.ep_num} "${episode.title}" ended with: ${episode.summary}. Characters involved: ${episode.characters_featured.join(', ')}.`
}

/**
 * Build a clean, flat, ASCII-safe prompt for the Kie.ai video API.
 * The structured raw_prompt (with SETTING/CHARACTERS/ACTION labels and newlines) is
 * kept for UI display but rejected by text-to-video / image-to-video due to:
 *   - literal \n newline characters
 *   - Unicode en-dash (–) in timing ranges like "0s–5s"
 *   - structured labels that confuse motion generation models
 */
export function buildVideoPrompt(scene: ScenePrompt, prevClipBridge?: string): string {
  const parts: string[] = []

  // Clip position and duration marker
  parts.push(`Clip ${scene.clip_num} of 4, 15-second single-take clip`)

  // Scene context: venue, color, atmosphere
  if (scene.venue_used) parts.push(`in ${scene.venue_used}`)
  if (scene.color_ambience) parts.push(scene.color_ambience)
  if (scene.atmosphere) parts.push(scene.atmosphere)

  // Continuity anchor: the exact last frame of the previous clip
  if (prevClipBridge) {
    parts.push(`continuing from: ${prevClipBridge}`)
  }

  // Motion quality signal before action so the model primes for smooth generation
  parts.push('smooth fluid motion, single unbroken take')

  // Scene narrative beats — whole-scene description per timeframe; fall back to per-character if missing
  if (scene.action_timeline) {
    parts.push(scene.action_timeline)
  } else {
    for (const name of scene.characters_used) {
      const action = scene.character_actions?.[name]
      if (action) parts.push(`${name}: ${action}`)
    }
  }

  if (scene.camera_angle) parts.push(scene.camera_angle)
  if (scene.camera_movement) parts.push(scene.camera_movement)

  // Style at end — reinforces aesthetic after all narrative content is processed
  parts.push('Pixar-style 3D animation, anthropomorphic fruit characters, warm cinematic lighting, 9:16 vertical TikTok format')

  return parts
    .join('. ')
    .replace(/\n+|\r+/g, ' ')          // remove all newlines
    .replace(/[–—]/g, '-')             // Unicode dashes → ASCII hyphen
    .replace(/[^\x00-\x7F]/g, c => {  // replace any other non-ASCII with closest ASCII or space
      const map: Record<string, string> = { '‘': "'", '’': "'", '“': '"', '”': '"' }
      return map[c] ?? ' '
    })
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 4800)                    // hard cap below the 5000 char API limit
    .trim()
}

export function injectRefUrls(
  scripts: EpisodeScript[],
  refImages: Record<string, string>,
  bible: SeriesBible
): EpisodeScript[] {
  return scripts.map(episode => ({
    ...episode,
    scenes: episode.scenes.map((scene, sceneIdx) => {
      const refs: string[] = []

      // Protagonist always first
      const protagonist = bible.characters.find(c => c.role === 'protagonist')
      if (protagonist && refImages[protagonist.name]) {
        refs.push(refImages[protagonist.name])
      }

      // Other characters in scene
      for (const charName of scene.characters_used) {
        const char = bible.characters.find(c => c.name === charName)
        if (char && refImages[char.name] && !refs.includes(refImages[char.name])) {
          refs.push(refImages[char.name])
        }
      }

      // Venue as last reference
      if (scene.venue_used && refImages[scene.venue_used] && refs.length < 6) {
        refs.push(refImages[scene.venue_used])
      }

      // Pass the previous clip's bridge so the flat prompt includes a continuity anchor
      const prevClipBridge = sceneIdx > 0 ? episode.scenes[sceneIdx - 1].clip_bridge : undefined

      return {
        ...scene,
        final_prompt: buildVideoPrompt(scene, prevClipBridge),
        grok_ref_images: refs.slice(0, 2),
      }
    }),
  }))
}
