import type { SeriesBible, EpisodeScript, UniversePrompt } from './types'

export interface SeriesEntry {
  id: string
  title: string
  genre: string
  createdAt: string
  status: 'generating' | 'complete' | 'error'
  clipCount: number
  episodeCount: number
}

export interface SeriesResult {
  videoUrls: Record<string, string>
  bible: SeriesBible
  refImages: Record<string, string>
  scripts: EpisodeScript[]
}

function readIndex(): SeriesEntry[] {
  try {
    return JSON.parse(localStorage.getItem('tiktok_index') ?? '[]')
  } catch {
    return []
  }
}

export function getSeriesIndex(): SeriesEntry[] {
  if (typeof window === 'undefined') return []
  return readIndex()
}

export function upsertSeriesEntry(entry: SeriesEntry): void {
  if (typeof window === 'undefined') return
  const index = readIndex()
  const i = index.findIndex(e => e.id === entry.id)
  if (i >= 0) index[i] = entry
  else index.unshift(entry)
  localStorage.setItem('tiktok_index', JSON.stringify(index))
}

export function getSeriesEntry(id: string): SeriesEntry | null {
  if (typeof window === 'undefined') return null
  return readIndex().find(e => e.id === id) ?? null
}

export function getSeriesInput(id: string): UniversePrompt | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`tiktok_${id}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getSeriesResult(id: string): SeriesResult | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`tiktok_${id}_result`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSeriesResult(id: string, result: SeriesResult): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(`tiktok_${id}_result`, JSON.stringify(result))
}

export function deleteSeriesEntry(id: string): void {
  if (typeof window === 'undefined') return
  const index = readIndex().filter(e => e.id !== id)
  localStorage.setItem('tiktok_index', JSON.stringify(index))
  localStorage.removeItem(`tiktok_${id}`)
  localStorage.removeItem(`tiktok_${id}_result`)
}
