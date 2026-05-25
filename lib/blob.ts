import { put } from '@vercel/blob'

export async function persistUrl(sourceUrl: string, filename: string): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return sourceUrl

  try {
    const res = await fetch(sourceUrl)
    if (!res.ok) throw new Error(`fetch ${res.status}`)

    const contentType = res.headers.get('content-type') ?? 'application/octet-stream'

    const { url } = await put(`tiktok-video/${filename}`, res.body!, {
      access: 'public',
      contentType,
    })

    return url
  } catch (err) {
    // Blob upload failed — return original URL so the pipeline continues
    console.error(`[blob] persistUrl failed for ${filename}:`, err)
    return sourceUrl
  }
}
