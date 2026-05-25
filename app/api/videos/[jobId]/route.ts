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
        // URL not populated yet — keep polling rather than treating as a failure
        return NextResponse.json({ status: 'processing', state: 'success_pending_url' })
      }
      const rawUrl = resultUrls[0]
      const filename = `videos/${jobId}.mp4`
      const url = await persistUrl(rawUrl, filename)
      return NextResponse.json({ status: 'done', url })
    }

    if (state === 'fail') {
      const reason = failReason ?? 'Kie.ai reported failure (no reason given)'
      console.error(`[video poll] ${jobId} failed:`, reason)
      return NextResponse.json({ status: 'failed', reason })
    }

    return NextResponse.json({ status: 'processing', state })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
