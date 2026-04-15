/**
 * Background Worker – Agentic Meeting Processor
 *
 * Runs independently from the Next.js web server.
 * Polls for new Teams meetings and processes them automatically.
 *
 * Start with: npm run worker
 *
 * Environment variables:
 *   WORKER_INTERVAL_MINUTES  – polling interval in minutes (default: 30)
 *   DRY_RUN                  – set to "true" to skip LLM/Jira calls
 *   DATABASE_URL             – Prisma database connection
 *   AZURE_TENANT_ID          – Microsoft Entra ID tenant
 *   AZURE_CLIENT_ID          – App registration client ID
 *   AZURE_CLIENT_SECRET      – App registration client secret (refresh token exchange)
 *   OPENAI_API_KEY or AZURE_OPENAI_* – LLM credentials
 *   JIRA_*                   – Jira integration (optional)
 */

import 'dotenv/config'
import { startWorker } from './scheduler'

const intervalMinutes = parseInt(process.env.WORKER_INTERVAL_MINUTES || '30', 10)

if (isNaN(intervalMinutes) || intervalMinutes < 1) {
  console.error('[Worker] Invalid WORKER_INTERVAL_MINUTES value. Using 30.')
  process.exit(1)
}

console.log('='.repeat(60))
console.log('  AGENTIC WORKSPACE – BACKGROUND WORKER')
console.log('='.repeat(60))
console.log(`  Interval : every ${intervalMinutes} minutes`)
console.log(`  Dry run  : ${process.env.DRY_RUN === 'true' ? 'YES (no external calls)' : 'NO (production mode)'}`)
console.log(`  Database : ${process.env.DATABASE_URL || 'file:./dev.db'}`)
console.log('='.repeat(60))
console.log()

startWorker(intervalMinutes)

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Worker] Received SIGTERM. Shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[Worker] Received SIGINT. Shutting down gracefully...')
  process.exit(0)
})
