import 'dotenv/config'
import { runAgentCycle } from './scheduler'

async function main(): Promise<void> {
  await runAgentCycle()
}

main()
  .then(() => {
    console.log('[Worker] Single cycle completed.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[Worker] Single cycle failed:', error)
    process.exit(1)
  })
