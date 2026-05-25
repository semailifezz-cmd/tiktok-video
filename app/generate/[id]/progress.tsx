'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { UniversePrompt, SeriesBible, EpisodeScript, ScenePrompt, EpisodeOutline } from '@/lib/types'
import { injectRefUrls, buildContinuityMemo, buildVideoPrompt, sleep } from '@/lib/workflow'
import { upsertSeriesEntry, getSeriesEntry, getSeriesResult } from '@/lib/store'

const PHASES = [
  { id: 1, name: 'Series Bible Generation', desc: 'Gemini designs fruit characters, venues & episode outlines' },
  { id: 2, name: 'Asset Database Population', desc: 'Structuring character, venue, and prop tables' },
  { id: 3, name: 'Reference Image Generation', desc: 'Grok Imagine creates Pixar-style portrait & venue shots via Kie.ai' },
  { id: 4, name: 'Scene Script Generation', desc: 'Writing 4 cinematic scene prompts per episode using the formula' },
  { id: 5, name: 'Reference URL Injection', desc: 'Assembling final video prompts with character reference images' },
  { id: 6, name: 'Video Generation', desc: 'Generating all clips via Grok Imagine Video — 4 × 15s per episode' },
  { id: 7, name: 'Episode Stitching', desc: 'Concatenating 4 clips into 60-second episodes' },
]

type PhaseStatus = 'idle' | 'running' | 'done' | 'error'

interface PhaseState {
  status: PhaseStatus
  progress: number
  detail: string
}

// Reads body as text first so JSON.parse errors never hide the real message
async function tryJson(res: Response): Promise<any> {
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { error: text.slice(0, 500) || `HTTP ${res.status}` } }
}

async function downloadVideo(url: string, filename: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}

function VideoCard({
  epNum,
  clipNum,
  formulaStep,
  url,
  seriesTitle,
}: {
  epNum: number
  clipNum: number
  formulaStep: number
  url: string
  seriesTitle: string
}) {
  const [downloading, setDownloading] = useState(false)
  const stepLabels: Record<number, string> = {
    1: 'Humiliation',
    2: 'Revealed',
    3: 'Turn',
    4: 'Exit',
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
      <div className="relative bg-black" style={{ aspectRatio: '9/16' }}>
        <video
          src={url}
          controls
          playsInline
          className="w-full h-full object-contain"
          preload="metadata"
        />
      </div>
      <div className="p-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-mono text-zinc-300 font-semibold">Clip {clipNum}</p>
          <p className="text-[11px] text-zinc-600 font-mono">
            Step {formulaStep} · {stepLabels[formulaStep] ?? ''}
          </p>
        </div>
        <button
          onClick={async () => {
            setDownloading(true)
            const filename = `${seriesTitle.replace(/\s+/g, '_')}_Ep${epNum}_Clip${clipNum}.mp4`
            await downloadVideo(url, filename)
            setDownloading(false)
          }}
          disabled={downloading}
          className="flex items-center gap-1.5 text-[11px] font-mono bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          {downloading ? '…' : '↓ MP4'}
        </button>
      </div>
    </div>
  )
}

const STEP_LABELS: Record<number, string> = { 1: 'Humiliation', 2: 'Revealed', 3: 'Turn', 4: 'Exit' }

function SceneCard({ scene }: { scene: ScenePrompt }) {
  return (
    <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-mono bg-pink-950/50 text-pink-400 border border-pink-900/40 px-1.5 py-0.5 rounded">
          Clip {scene.clip_num}
        </span>
        {scene.segment_duration && (
          <span className="text-[10px] font-mono bg-zinc-700/60 text-zinc-400 px-1.5 py-0.5 rounded">
            {scene.segment_duration}
          </span>
        )}
        <span className="text-[10px] font-mono text-zinc-500">
          Step {scene.formula_step} · {STEP_LABELS[scene.formula_step] ?? ''}
        </span>
        <span className="text-[10px] font-mono text-zinc-600 ml-auto truncate max-w-[200px]">
          {scene.venue_used}
        </span>
      </div>

      {(scene.camera_angle || scene.camera_movement) && (
        <div className="space-y-1 bg-zinc-900/50 rounded-lg p-2.5">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1">Camera</p>
          {scene.camera_angle && (
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-mono text-zinc-600 w-18 flex-shrink-0 mt-0.5">Angle</span>
              <p className="text-xs text-zinc-400 leading-relaxed">{scene.camera_angle}</p>
            </div>
          )}
          {scene.camera_movement && (
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-mono text-zinc-600 w-18 flex-shrink-0 mt-0.5">Movement</span>
              <p className="text-xs text-zinc-400 leading-relaxed">{scene.camera_movement}</p>
            </div>
          )}
        </div>
      )}

      {scene.characters_used.length > 0 && (scene.character_expressions || scene.character_actions) && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">Characters</p>
          {scene.characters_used.map(name => (
            <div key={name} className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-2.5 space-y-1.5">
              <p className="text-[11px] font-mono text-zinc-300 font-semibold">{name}</p>
              {scene.character_expressions?.[name] && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-mono text-zinc-600 w-20 flex-shrink-0 mt-0.5">Expression</span>
                  <p className="text-xs text-zinc-500 leading-relaxed">{scene.character_expressions[name]}</p>
                </div>
              )}
              {scene.character_actions?.[name] && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-mono text-zinc-600 w-20 flex-shrink-0 mt-0.5">Action</span>
                  <p className="text-xs text-zinc-500 leading-relaxed">{scene.character_actions[name]}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(scene.atmosphere || scene.color_ambience) && (
        <div className="space-y-1 bg-zinc-900/50 rounded-lg p-2.5">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1">Mood & Color</p>
          {scene.atmosphere && (
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-mono text-zinc-600 w-18 flex-shrink-0 mt-0.5">Atmosphere</span>
              <p className="text-xs text-zinc-500 leading-relaxed">{scene.atmosphere}</p>
            </div>
          )}
          {scene.color_ambience && (
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-mono text-zinc-600 w-18 flex-shrink-0 mt-0.5">Color</span>
              <p className="text-xs text-zinc-500 leading-relaxed">{scene.color_ambience}</p>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-zinc-700/40 pt-3">
        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1.5">Video Prompt</p>
        <p className="text-xs text-zinc-400 leading-relaxed">{scene.final_prompt ?? buildVideoPrompt(scene)}</p>
      </div>
    </div>
  )
}

export default function Progress({ id }: { id: string }) {
  const router = useRouter()
  const [formData, setFormData] = useState<UniversePrompt | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [phases, setPhases] = useState<PhaseState[]>(
    PHASES.map(() => ({ status: 'idle' as PhaseStatus, progress: 0, detail: '' }))
  )
  const [currentPhase, setCurrentPhase] = useState(-1)
  const [bible, setBible] = useState<SeriesBible | null>(null)
  const [refImages, setRefImages] = useState<Record<string, string>>({})
  const [scripts, setScripts] = useState<EpisodeScript[]>([])
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({})
  const [videoErrors, setVideoErrors] = useState<Record<string, string>>({})
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    const stored = localStorage.getItem(`tiktok_${id}`)
    if (!stored) { setNotFound(true); return }
    setFormData(JSON.parse(stored))

    const saved = localStorage.getItem(`tiktok_${id}_result`)
    if (saved) {
      try {
        const { videoUrls: savedUrls, bible: savedBible, refImages: savedImages, scripts: savedScripts } = JSON.parse(saved)
        setVideoUrls(savedUrls ?? {})
        setBible(savedBible)
        setRefImages(savedImages ?? {})
        setScripts(savedScripts ?? [])
        setIsComplete(true)
        setPhases(PHASES.map(() => ({ status: 'done' as PhaseStatus, progress: 100, detail: '' })))
        setCurrentPhase(PHASES.length - 1)
      } catch { /* ignore corrupt saved data */ }
    }
  }, [id])

  useEffect(() => {
    if (!formData || startedRef.current || isComplete) return
    startedRef.current = true
    runWorkflow(formData)
  }, [formData]) // eslint-disable-line react-hooks/exhaustive-deps

  const setPhase = (index: number, status: PhaseStatus, detail: string, progress = 0) => {
    setCurrentPhase(index)
    setPhases(prev =>
      prev.map((p, i) => (i === index ? { status, detail, progress } : p))
    )
  }

  const runWorkflow = async (form: UniversePrompt) => {
    try {
      const cont = (form as any)._continuation as { source_id: string; ep_num: number } | undefined

      let currentBible!: SeriesBible
      let newRefImages: Record<string, string> = {}
      let episodesToProcess: EpisodeOutline[] = []

      if (cont) {
        // ── CONTINUATION: reuse existing bible + images ─────────────────────
        const original = getSeriesResult(cont.source_id)
        if (!original) throw new Error('Original series data not found in browser storage. Please open the original series first, then try Add Episode again.')

        currentBible = original.bible
        newRefImages = { ...original.refImages }

        setPhase(0, 'done', `Bible reused — "${currentBible.series_title}" · ${currentBible.episodes.length} previous episode${currentBible.episodes.length !== 1 ? 's' : ''}`, 100)
        setBible(currentBible)
        setRefImages(newRefImages)
        await sleep(250)
        setPhase(1, 'done', 'Asset database reused from existing series', 100)
        await sleep(250)
        setPhase(2, 'done', `${Object.keys(newRefImages).length} reference images reused`, 100)
        await sleep(250)

        // Generate new episode outline as the first step of Phase 4
        setPhase(3, 'running', `Generating Episode ${cont.ep_num} outline…`)
        const lastEp = currentBible.episodes.at(-1)
        const contMemo = lastEp
          ? `Episode ${lastEp.ep_num}: "${lastEp.title}" — ${lastEp.summary}. Characters featured: ${lastEp.characters_featured.join(', ')}.`
          : ''

        const outlineRes = await fetch('/api/episode-outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bible: currentBible, episodeNum: cont.ep_num, formula: form.episode_formula, continuityMemo: contMemo }),
        })
        const outlineJson = await tryJson(outlineRes)
        if (!outlineRes.ok || outlineJson.error) throw new Error(outlineJson.error ?? 'Episode outline generation failed')
        const outline: EpisodeOutline = outlineJson

        currentBible = { ...currentBible, episodes: [...currentBible.episodes, outline] }
        setBible(currentBible)
        episodesToProcess = [outline]

      } else {
        // ── FULL GENERATION ────────────────────────────────────────────────

        // Phase 1: Series Bible
        setPhase(0, 'running', 'Calling Gemini to design fruit characters and episode outlines…')
        const bibleRes = await fetch('/api/bible', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const bibleJson = await tryJson(bibleRes)
        if (!bibleRes.ok || bibleJson.error) throw new Error(bibleJson.error ?? `Bible generation HTTP ${bibleRes.status}`)
        currentBible = bibleJson
        setBible(currentBible)
        setPhase(0, 'done', `${currentBible.characters.length} fruit characters · ${currentBible.venues.length} venues · ${currentBible.episodes.length} episodes`, 100)

        // Phase 2: Asset DB
        setPhase(1, 'running', 'Structuring asset database…')
        await sleep(400)
        const totalAssets = currentBible.characters.length + currentBible.venues.length + currentBible.props.length
        setPhase(1, 'done', `${totalAssets} assets indexed — Characters, Venues, Props, Episode_Outline`, 100)

        // Phase 3: Reference Images — all submitted in parallel, polled together
        const assetList = [
          ...currentBible.characters.map((c: SeriesBible['characters'][0]) => ({ name: c.name, type: 'character', prompt: c.image_prompt })),
          ...currentBible.venues.map((v: SeriesBible['venues'][0]) => ({ name: v.location_name, type: 'venue', prompt: v.image_prompt })),
          ...currentBible.props.map((p: SeriesBible['props'][0]) => ({ name: p.prop_name, type: 'prop', prompt: p.image_prompt })),
        ]
        type AssetItem = typeof assetList[0]

        const IMG_TOTAL_TIMEOUT_MS = 7 * 60 * 1000
        const MAX_IMG_RETRIES = 3
        const imgDeadline = Date.now() + IMG_TOTAL_TIMEOUT_MS
        const imgRetryCount = new Map<string, number>()

        // Submit all jobs in parallel
        setPhase(2, 'running', `Submitting ${assetList.length} image jobs in parallel…`, 0)
        const submitResults = await Promise.allSettled(
          assetList.map(async (asset) => {
            const res = await fetch('/api/images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: asset.prompt }),
            })
            const body = await tryJson(res)
            if (!res.ok) throw new Error(body.error ?? `Image submit HTTP ${res.status}`)
            return { asset, jobId: body.jobId } as { asset: AssetItem; jobId: string }
          })
        )

        let pendingPolls: { asset: AssetItem; jobId: string }[] = []
        for (const r of submitResults) {
          if (r.status === 'fulfilled') pendingPolls.push(r.value)
        }

        // Poll all in parallel; retry only failed ones; stop at 7-min deadline
        while (pendingPolls.length > 0 && Date.now() < imgDeadline) {
          await sleep(3000)

          const pollResults = await Promise.allSettled(
            pendingPolls.map(async (item) => {
              const res = await fetch(`/api/images/${item.jobId}`)
              const data = await tryJson(res)
              return { ...item, data }
            })
          )

          const nextPolls: typeof pendingPolls = []
          const toResubmit: AssetItem[] = []

          for (const r of pollResults) {
            if (r.status === 'rejected') continue
            const { asset, data } = r.value

            if (data.status === 'done' && data.image_url) {
              newRefImages[asset.name] = data.image_url
              setRefImages(prev => ({ ...prev, [asset.name]: data.image_url }))
            } else if (data.status === 'failed') {
              const tries = (imgRetryCount.get(asset.name) ?? 0) + 1
              imgRetryCount.set(asset.name, tries)
              if (tries <= MAX_IMG_RETRIES && Date.now() < imgDeadline) {
                toResubmit.push(asset)
              }
            } else {
              nextPolls.push(r.value)
            }
          }

          // Resubmit failed assets
          if (toResubmit.length > 0 && Date.now() < imgDeadline) {
            const resubmitResults = await Promise.allSettled(
              toResubmit.map(async (asset) => {
                const res = await fetch('/api/images', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ prompt: asset.prompt }),
                })
                const body = await tryJson(res)
                if (!res.ok) throw new Error(body.error ?? `Image resubmit HTTP ${res.status}`)
                return { asset, jobId: body.jobId } as { asset: AssetItem; jobId: string }
              })
            )
            for (const r of resubmitResults) {
              if (r.status === 'fulfilled') nextPolls.push(r.value)
            }
          }

          pendingPolls = nextPolls

          const done = Object.keys(newRefImages).length
          const total = assetList.length
          const remaining = Math.ceil((imgDeadline - Date.now()) / 1000)
          setPhase(2, 'running',
            `${done}/${total} images ready · ${pendingPolls.length} generating · ${remaining}s left`,
            (done / total) * 100
          )
        }

        const imgCount = Object.keys(newRefImages).length
        setPhase(2, 'done', `${imgCount}/${assetList.length} Pixar-style reference images generated`, 100)
        episodesToProcess = currentBible.episodes
      }

      // ── Phase 4: Scene Scripts ─────────────────────────────────────────
      const allScripts: EpisodeScript[] = []
      let prevMemo = ''

      for (let i = 0; i < episodesToProcess.length; i++) {
        const episode = episodesToProcess[i]
        setPhase(3, 'running', `Episode ${episode.ep_num}: "${episode.title}" (${i + 1} / ${episodesToProcess.length})`, (i / episodesToProcess.length) * 100)

        const scriptRes = await fetch('/api/scripts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ episode, bible: currentBible, formula: form.episode_formula, prevMemo }),
        })
        const script = await tryJson(scriptRes)
        if (!scriptRes.ok || script.error) throw new Error(script.error ?? `Script generation HTTP ${scriptRes.status}`)
        allScripts.push(script)
        setScripts([...allScripts])
        prevMemo = buildContinuityMemo(episode)
      }

      const totalScenes = allScripts.reduce((n, s) => n + s.scenes.length, 0)
      setPhase(3, 'done', `${totalScenes} scene prompts written across ${allScripts.length} episode${allScripts.length !== 1 ? 's' : ''}`, 100)

      // ── Phase 5: Reference URL Injection ──────────────────────────────
      setPhase(4, 'running', 'Assembling final video prompts with Pixar character reference images…')
      const injectedScripts = injectRefUrls(allScripts, newRefImages, currentBible)
      await sleep(300)
      setPhase(4, 'done', `${injectedScripts.flatMap(s => s.scenes).length} prompts assembled`, 100)

      // ── Phase 6: Video Generation — submit all in parallel, poll every 30s
      const allScenes = injectedScripts.flatMap(s => s.scenes)
      const newVideoUrls: Record<string, string> = {}
      const VID_TOTAL_TIMEOUT_MS = 30 * 60 * 1000
      const MAX_VID_RETRIES = 5
      const vidDeadline = Date.now() + VID_TOTAL_TIMEOUT_MS
      const vidRetryCount = new Map<string, number>()

      type VideoItem = { scene: ScenePrompt; key: string; jobId: string }

      // Submit all jobs in parallel
      setPhase(5, 'running', `Submitting ${allScenes.length} video jobs in parallel…`, 0)
      const vidSubmitResults = await Promise.allSettled(
        allScenes.map(async (scene) => {
          const key = `ep${scene.ep_num}_clip${scene.clip_num}`
          const res = await fetch('/api/videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: scene.final_prompt,
              image_urls: scene.grok_ref_images ?? [],
              duration: 15,
              aspect_ratio: '9:16',
              resolution: '720p',
            }),
          })
          const body = await tryJson(res)
          if (!res.ok) throw new Error(body.error ?? `Video submit HTTP ${res.status}`)
          return { scene, key, jobId: body.jobId } as VideoItem
        })
      )

      let vidPendingPolls: VideoItem[] = []
      for (let i = 0; i < vidSubmitResults.length; i++) {
        const r = vidSubmitResults[i]
        if (r.status === 'fulfilled') {
          vidPendingPolls.push(r.value)
        } else {
          const scene = allScenes[i]
          const key = `ep${scene.ep_num}_clip${scene.clip_num}`
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
          setVideoErrors(prev => ({ ...prev, [key]: `Submit failed: ${msg}` }))
        }
      }

      // Poll every 30s; retry failed jobs; stop at deadline
      while (vidPendingPolls.length > 0 && Date.now() < vidDeadline) {
        await sleep(30000)

        const pollResults = await Promise.allSettled(
          vidPendingPolls.map(async (item) => {
            const res = await fetch(`/api/videos/${item.jobId}`)
            const data = await tryJson(res)
            return { ...item, data }
          })
        )

        const nextPolls: VideoItem[] = []
        const toResubmit: ScenePrompt[] = []

        for (let i = 0; i < pollResults.length; i++) {
          const r = pollResults[i]
          if (r.status === 'rejected') {
            nextPolls.push(vidPendingPolls[i])  // network blip — retry next round
            continue
          }
          const { scene, key, data } = r.value

          if (data.status === 'done' && data.url) {
            newVideoUrls[key] = data.url
            setVideoUrls(prev => ({ ...prev, [key]: data.url }))
          } else if (data.status === 'failed') {
            const tries = (vidRetryCount.get(key) ?? 0) + 1
            vidRetryCount.set(key, tries)
            if (tries <= MAX_VID_RETRIES && Date.now() < vidDeadline) {
              // From the 2nd retry onward, drop reference image URLs — tempfile.aiquickdraw.com
              // URLs expire quickly, causing image-to-video to 500 on every attempt.
              // Falling back to text-to-video removes the URL dependency entirely.
              toResubmit.push(tries >= 2 ? { ...scene, grok_ref_images: [] } : scene)
            } else {
              setVideoErrors(prev => ({ ...prev, [key]: `Failed after ${tries} attempt${tries !== 1 ? 's' : ''}: ${data.reason ?? 'unknown'}` }))
            }
          } else {
            nextPolls.push(r.value)
          }
        }

        // Resubmit failed jobs — 30s countdown first so the model has time to clear
        if (toResubmit.length > 0 && Date.now() < vidDeadline) {
          for (let w = 30; w > 0 && Date.now() < vidDeadline; w--) {
            const done = Object.keys(newVideoUrls).length
            const total = allScenes.length
            const remaining = Math.ceil((vidDeadline - Date.now()) / 1000)
            setPhase(5, 'running',
              `${done}/${total} ready · ${toResubmit.length} retrying in ${w}s · ${nextPolls.length} still generating · ${remaining}s left`,
              (done / total) * 100
            )
            await sleep(1000)
          }

          if (Date.now() < vidDeadline) {
            const resubResults = await Promise.allSettled(
              toResubmit.map(async (scene) => {
                const key = `ep${scene.ep_num}_clip${scene.clip_num}`
                const res = await fetch('/api/videos', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    prompt: scene.final_prompt,
                    image_urls: scene.grok_ref_images ?? [],
                    duration: 15,
                    aspect_ratio: '9:16',
                    resolution: '720p',
                  }),
                })
                const body = await tryJson(res)
                if (!res.ok) throw new Error(body.error ?? `Video resubmit HTTP ${res.status}`)
                return { scene, key, jobId: body.jobId } as VideoItem
              })
            )
            for (let i = 0; i < resubResults.length; i++) {
              const r = resubResults[i]
              if (r.status === 'fulfilled') {
                nextPolls.push(r.value)
              } else {
                const scene = toResubmit[i]
                const key = `ep${scene.ep_num}_clip${scene.clip_num}`
                setVideoErrors(prev => ({ ...prev, [key]: 'Resubmit failed' }))
              }
            }
          }
        }

        vidPendingPolls = nextPolls

        const done = Object.keys(newVideoUrls).length
        const total = allScenes.length
        const remaining = Math.ceil((vidDeadline - Date.now()) / 1000)
        setPhase(5, 'running',
          `${done}/${total} clips ready · ${vidPendingPolls.length} generating · ${remaining}s left`,
          (done / total) * 100
        )
      }

      // Any jobs still pending at deadline are timed out
      for (const item of vidPendingPolls) {
        setVideoErrors(prev => ({ ...prev, [item.key]: 'Timed out after 30 minutes' }))
      }

      setPhase(5, 'done', `${Object.keys(newVideoUrls).length}/${allScenes.length} clips generated`, 100)

      // ── Phase 7: Episode Stitching ─────────────────────────────────────
      const epLabel = episodesToProcess.length === 1 ? '1 episode' : `${episodesToProcess.length} episodes`
      setPhase(6, 'running', cont ? `Finalising Episode ${cont.ep_num}…` : 'Stitching 4 × 15s clips into 60-second episodes…')
      await sleep(800)
      setPhase(6, 'done', `${epLabel} ready`, 100)

      // ── Save results ───────────────────────────────────────────────────
      localStorage.setItem(`tiktok_${id}_result`, JSON.stringify({
        videoUrls: newVideoUrls,
        bible: currentBible,
        refImages: newRefImages,
        scripts: allScripts,
      }))

      const existing = getSeriesEntry(id)
      upsertSeriesEntry({
        id,
        title: currentBible.series_title,
        genre: currentBible.genre,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        status: 'complete',
        clipCount: Object.keys(newVideoUrls).length,
        episodeCount: episodesToProcess.length,
      })

      setIsComplete(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setPhases(prev =>
        prev.map((p, i) => (i === currentPhase ? { ...p, status: 'error', detail: message } : p))
      )
      const existing = getSeriesEntry(id)
      if (existing) {
        upsertSeriesEntry({ ...existing, status: 'error' })
      }
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <p className="text-lg mb-4">Session not found.</p>
          <button onClick={() => router.push('/')} className="text-pink-500 hover:text-pink-400">
            ← Start a new series
          </button>
        </div>
      </div>
    )
  }

  const totalClips = Object.keys(videoUrls).length

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/60 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 bg-zinc-950/90 backdrop-blur">
        <button
          onClick={() => router.push('/')}
          className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          ← Dashboard
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-600">Generating Series</p>
          <p className="text-base font-bold text-white truncate">
            {formData?.series_title || 'Untitled Series'}
          </p>
        </div>
        {isComplete && (
          <span className="text-xs font-mono text-green-400 bg-green-950/50 border border-green-900 px-3 py-1 rounded-full">
            Complete
          </span>
        )}
        {error && (
          <span className="text-xs font-mono text-red-400 bg-red-950/50 border border-red-900 px-3 py-1 rounded-full">
            Error
          </span>
        )}
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Completion banner */}
        {isComplete && bible && (
          <div className="bg-green-950/20 border border-green-900/60 rounded-xl p-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-2xl font-bold text-green-400">Series Complete</p>
              <p className="text-zinc-400 text-sm mt-1">
                {bible.episodes.length} episode{bible.episodes.length > 1 ? 's' : ''} · {totalClips} clips · Ready to download
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={async () => {
                  for (const [key, url] of Object.entries(videoUrls)) {
                    const [ep, clip] = key.replace('ep', 'Ep').replace('_clip', '_Clip').split('_')
                    const filename = `${(formData?.series_title ?? 'Series').replace(/\s+/g, '_')}_${ep}_${clip}.mp4`
                    await downloadVideo(url, filename)
                    await sleep(400)
                  }
                }}
                className="text-sm bg-green-800 hover:bg-green-700 text-green-100 px-5 py-2.5 rounded-lg font-semibold transition-colors"
              >
                ↓ Download All {totalClips} Clips
              </button>
              <button
                onClick={() => {
                  if (!bible) return
                  const newId = crypto.randomUUID()
                  const contData = {
                    series_title: bible.series_title,
                    genre: bible.genre,
                    setting_era: formData?.setting_era ?? '',
                    core_conflict: formData?.core_conflict ?? '',
                    tone: formData?.tone ?? 'Warm, cinematic, Pixar-style 3D animation',
                    main_characters: formData?.main_characters ?? 'LLM to design (3–5)',
                    total_episodes: 1,
                    episode_length_s: 60,
                    clip_length_s: 15,
                    episode_formula: formData?.episode_formula ?? '',
                    _continuation: { source_id: id, ep_num: bible.episodes.length + 1 },
                  }
                  localStorage.setItem(`tiktok_${newId}`, JSON.stringify(contData))
                  upsertSeriesEntry({
                    id: newId,
                    title: `${bible.series_title} — Ep ${bible.episodes.length + 1}`,
                    genre: bible.genre,
                    createdAt: new Date().toISOString(),
                    status: 'generating',
                    clipCount: 0,
                    episodeCount: 0,
                  })
                  router.push(`/generate/${newId}`)
                }}
                className="text-sm bg-pink-900/40 hover:bg-pink-900/60 border border-pink-800/60 text-pink-300 px-5 py-2.5 rounded-lg transition-colors"
              >
                + Add Episode
              </button>
              <button
                onClick={() => router.push('/new')}
                className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-5 py-2.5 rounded-lg transition-colors"
              >
                + New Series
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-8">
          {/* Phase list */}
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-600 mb-3 px-2">
              Workflow Phases
            </p>
            {PHASES.map((phase, i) => {
              const state = phases[i]
              const isActive = currentPhase === i
              return (
                <div
                  key={phase.id}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                    isActive ? 'bg-zinc-900 border border-zinc-800' : ''
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5 transition-colors ${
                      state.status === 'done'
                        ? 'bg-green-950/60 text-green-400 border border-green-800'
                        : state.status === 'running'
                        ? 'bg-pink-950/60 text-pink-400 border border-pink-800 animate-pulse'
                        : state.status === 'error'
                        ? 'bg-red-950/60 text-red-500 border border-red-800'
                        : 'bg-zinc-800/60 text-zinc-600 border border-zinc-700'
                    }`}
                  >
                    {state.status === 'done' ? '✓' : state.status === 'error' ? '✕' : phase.id}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium leading-tight ${
                        state.status === 'done'
                          ? 'text-zinc-300'
                          : state.status === 'running'
                          ? 'text-white'
                          : state.status === 'error'
                          ? 'text-red-400'
                          : 'text-zinc-600'
                      }`}
                    >
                      {phase.name}
                    </p>
                    {state.detail && (
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed line-clamp-2">
                        {state.detail}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Main detail panel */}
          <div className="space-y-6 min-w-0">
            {/* Active phase card */}
            {currentPhase >= 0 && currentPhase < PHASES.length && (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-pink-500">
                    Phase {PHASES[currentPhase].id}
                  </span>
                  {phases[currentPhase].status === 'running' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                  )}
                </div>
                <h2 className="text-xl font-bold text-white mb-1">{PHASES[currentPhase].name}</h2>
                <p className="text-sm text-zinc-500 mb-5">{PHASES[currentPhase].desc}</p>

                {phases[currentPhase].status === 'running' && (
                  <div>
                    <div className="flex justify-between text-xs text-zinc-400 mb-2">
                      <span className="truncate pr-4">{phases[currentPhase].detail}</span>
                      <span className="flex-shrink-0">{Math.round(phases[currentPhase].progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-pink-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(2, phases[currentPhase].progress)}%` }}
                      />
                    </div>
                  </div>
                )}

                {phases[currentPhase].status === 'done' && (
                  <p className="text-sm text-green-400">✓ {phases[currentPhase].detail}</p>
                )}

                {phases[currentPhase].status === 'error' && (
                  <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-lg">
                    <p className="text-sm text-red-400 font-mono break-all">{phases[currentPhase].detail}</p>
                  </div>
                )}
              </div>
            )}

            {/* Error card */}
            {error && (
              <div className="bg-red-950/20 border border-red-900/60 rounded-xl p-6">
                <p className="font-semibold text-red-400 mb-2">Generation stopped</p>
                <p className="text-sm text-red-300/70 font-mono mb-4 break-all">{error}</p>
                <button
                  onClick={() => router.push('/')}
                  className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg transition-colors"
                >
                  ← Dashboard
                </button>
              </div>
            )}

            {/* Series Bible preview */}
            {bible && (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
                <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-4">
                  Series Bible
                </p>
                <div className="grid grid-cols-3 gap-4 mb-5 text-center">
                  <div className="bg-zinc-800/40 rounded-lg p-3">
                    <div className="text-2xl font-bold text-white">{bible.characters.length}</div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">Characters</div>
                  </div>
                  <div className="bg-zinc-800/40 rounded-lg p-3">
                    <div className="text-2xl font-bold text-white">{bible.venues.length}</div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">Venues</div>
                  </div>
                  <div className="bg-zinc-800/40 rounded-lg p-3">
                    <div className="text-2xl font-bold text-white">{bible.episodes.length}</div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">Episodes</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {bible.characters.map(c => (
                    <div key={c.name} className="flex items-center gap-3 text-sm">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded font-mono flex-shrink-0 ${
                          c.role === 'protagonist'
                            ? 'bg-pink-950/50 text-pink-400 border border-pink-900/60'
                            : c.role === 'antagonist'
                            ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                            : 'bg-zinc-800/50 text-zinc-500 border border-zinc-800'
                        }`}
                      >
                        {c.role}
                      </span>
                      {c.fruit_type && (
                        <span className="text-[11px] font-mono text-zinc-600 flex-shrink-0">
                          [{c.fruit_type}]
                        </span>
                      )}
                      <span className="font-semibold text-zinc-200">{c.name}</span>
                      <span className="text-zinc-500 text-xs truncate hidden sm:block">{c.personality}</span>
                    </div>
                  ))}
                </div>
                {bible.overall_arc && (
                  <p className="text-sm text-zinc-500 mt-4 pt-4 border-t border-zinc-800 leading-relaxed">
                    {bible.overall_arc}
                  </p>
                )}
              </div>
            )}

            {/* Reference images */}
            {Object.keys(refImages).length > 0 && (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
                <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-4">
                  Pixar Reference Images ({Object.keys(refImages).length})
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {Object.entries(refImages).map(([name, url]) => (
                    <div key={name} className="aspect-square bg-zinc-800 rounded-lg overflow-hidden relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={name} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-[10px] text-white font-medium truncate">{name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scripts */}
            {scripts.length > 0 && (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
                <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-4">
                  Scene Scripts ({scripts.reduce((n, s) => n + s.scenes.length, 0)} scenes)
                </p>
                <div className="space-y-6">
                  {scripts.map(ep => (
                    <div key={ep.ep_num}>
                      <p className="text-[11px] font-mono text-zinc-400 font-semibold mb-3 uppercase tracking-wider">
                        Episode {ep.ep_num}
                      </p>
                      <div className="space-y-3">
                        {ep.scenes.map(scene => (
                          <SceneCard key={scene.clip_num} scene={scene} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live video clips */}
            {(totalClips > 0 || Object.keys(videoErrors).length > 0) && bible && (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
                <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-4">
                  Video Clips — {totalClips} / {(formData?.total_episodes ?? 1) * 4} ready
                </p>
                <div className="space-y-6">
                  {bible.episodes.map(ep => {
                    const clips = [1, 2, 3, 4]
                    const hasAny = clips.some(c => {
                      const k = `ep${ep.ep_num}_clip${c}`
                      return videoUrls[k] || videoErrors[k]
                    })
                    if (!hasAny) return null
                    return (
                      <div key={ep.ep_num}>
                        <p className="text-[11px] font-mono text-zinc-400 font-semibold mb-3">
                          Episode {ep.ep_num}: {ep.title}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {clips.map(clip => {
                            const k = `ep${ep.ep_num}_clip${clip}`
                            const url = videoUrls[k]
                            const err = videoErrors[k]
                            if (url) {
                              return (
                                <VideoCard
                                  key={clip}
                                  epNum={ep.ep_num}
                                  clipNum={clip}
                                  formulaStep={clip}
                                  url={url}
                                  seriesTitle={formData?.series_title ?? 'Series'}
                                />
                              )
                            }
                            if (err) {
                              return (
                                <div key={clip} className="bg-red-950/30 border border-red-900/60 rounded-xl p-3 flex flex-col gap-2 col-span-2 sm:col-span-1">
                                  <p className="text-xs font-mono text-red-400 font-semibold">Clip {clip} Failed</p>
                                  <p className="text-[11px] text-red-300 font-mono break-all leading-relaxed whitespace-pre-wrap">{err}</p>
                                </div>
                              )
                            }
                            return null
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
