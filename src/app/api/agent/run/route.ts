import { NextResponse } from 'next/server'
import { AgentRunner } from '@/agent/runner'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const dryRun = body.dryRun ?? process.env.DRY_RUN === 'true'

    const runner = new AgentRunner(dryRun)
    const result = await runner.run()

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Agent API endpoint. Use POST to trigger agent run.',
    dryRun: process.env.DRY_RUN === 'true',
  })
}
