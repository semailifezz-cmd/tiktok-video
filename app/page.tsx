'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSeriesIndex, deleteSeriesEntry, type SeriesEntry } from '@/lib/store'

export default function Dashboard() {
  const router = useRouter()
  const [series, setSeries] = useState<SeriesEntry[]>([])

  useEffect(() => {
    setSeries(getSeriesIndex())
  }, [])

  const handleDelete = (id: string) => {
    deleteSeriesEntry(id)
    setSeries(getSeriesIndex())
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between sticky top-0 z-10 bg-zinc-950/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-pink-600 rounded flex items-center justify-center text-white text-[11px] font-bold tracking-tight">
            TV
          </div>
          <span className="font-mono text-xs tracking-widest uppercase text-zinc-400">
            TikTok Video Generator
          </span>
        </div>
        <button
          onClick={() => router.push('/new')}
          className="bg-pink-700 hover:bg-pink-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + New Series
        </button>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {series.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl">
              🍌
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">No series yet</h1>
            <p className="text-zinc-500 text-sm mb-8 max-w-sm mx-auto">
              Create your first Pixar-style anthropomorphic fruit drama series for TikTok.
            </p>
            <button
              onClick={() => router.push('/new')}
              className="bg-pink-700 hover:bg-pink-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Create First Series →
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-1">
                  Your Series
                </p>
                <h1 className="text-2xl font-bold text-white">{series.length} series</h1>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {series.map(s => (
                <div
                  key={s.id}
                  className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors cursor-pointer group"
                  onClick={() => router.push(`/generate/${s.id}`)}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm truncate leading-tight">{s.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{s.genre}</p>
                    </div>
                    <span
                      className={`flex-shrink-0 text-[10px] font-mono px-2 py-0.5 rounded border ${
                        s.status === 'complete'
                          ? 'bg-green-950/50 text-green-400 border-green-900/60'
                          : s.status === 'error'
                          ? 'bg-red-950/50 text-red-400 border-red-900/60'
                          : 'bg-yellow-950/50 text-yellow-400 border-yellow-900/60 animate-pulse'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-500 mb-4">
                    <span>{s.episodeCount} ep</span>
                    <span>{s.clipCount} clips</span>
                    <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-pink-500 group-hover:text-pink-400 transition-colors font-mono">
                      View details →
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(s.id) }}
                      className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors font-mono"
                    >
                      delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
