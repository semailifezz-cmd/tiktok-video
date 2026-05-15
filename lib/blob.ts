import { put } from '@vercel/blob'

export async function persistUrl(sourceUrl: string, filename: string): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return sourceUrl

  const res = await fetch(sourceUrl)
  if (!res.ok) throw new Error(`Failed to fetch asset from ${sourceUrl}: ${res.status}`)

  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  const buffer = await res.arrayBuffer()

  const { url } = await put(`tiktok-video/${filename}`, buffer, {
    access: 'public',
    contentType,
  })

  return url
}
