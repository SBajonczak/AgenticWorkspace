import cron from 'node-cron'
import { AgentRunner } from '../agent/runner'

let isRunning = false

async function runAgent(): Promise<void> {
  if (isRunning) {
    console.log('[Worker] Previous run still in progress, skipping.')
    return
  }

  isRunning = true
  try {
    console.log(`[Worker] Starting agent run at ${new Date().toISOString()}`)
    const runner = new AgentRunner(false)
    const result = await runner.run()

    if (Array.isArray(result)) {
      const succeeded = result.filter((r) => r.success).length
      const failed = result.filter((r) => !r.success).length
      console.log(`[Worker] Completed: ${succeeded} succeeded, ${failed} failed`)
    } else {
      console.log(
        `[Worker] Completed: ${result.success ? 'success' : 'failed'}${result.error ? ` - ${result.error}` : ''}`
      )
    }
  } catch (error) {
    console.error('[Worker] Unhandled error during agent run:', error)
  } finally {
    isRunning = false
  }
}

export function startWorker(intervalMinutes: number = 30): void {
  const cronExpression = `*/${intervalMinutes} * * * *`

  console.log(`[Worker] Scheduling agent every ${intervalMinutes} minutes (${cronExpression})`)

  cron.schedule(cronExpression, runAgent)

  // Also run once immediately on startup
  console.log('[Worker] Running initial agent pass...')
  runAgent().catch((err) => console.error('[Worker] Initial run failed:', err))
}
