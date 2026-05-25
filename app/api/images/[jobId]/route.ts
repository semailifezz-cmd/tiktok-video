import { NextRequest, NextResponse } from 'next/server'
import { pollTask } from '@/lib/kie'
import { persistUrl } from '@/lib/blob'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  try {
    const { state, resultUrls, failReason } = await pollTask(jobId)

    if (state === 'success') {
      if (resultUrls.length === 0) {
        return NextResponse.json({
          status: 'failed',
          reason: 'Kie.ai returned success state but resultJson contained no URLs',
        })
      }
      const rawUrl = resultUrls[0]
      const filename = `images/${jobId}.jpg`
      const image_url = await persistUrl(rawUrl, filename)
      return NextResponse.json({ status: 'done', image_url })
    }

    if (state === 'fail') {
      return NextResponse.json({
        status: 'failed',
        reason: failReason ?? 'Kie.ai reported image generation failure (no reason given)',
      })
    }

    return NextResponse.json({ status: 'processing', state })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
