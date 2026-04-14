import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/db/prisma'
import { authConfig } from './auth.config'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readNestedValue(source: unknown, path: string[]): unknown {
  let current: unknown = source
  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

function readNestedString(source: unknown, path: string[]): string | undefined {
  return getString(readNestedValue(source, path))
}

function serializeForLog(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: serializeForLog(value.cause, depth + 1, seen),
    }
  }

  if (depth >= 4) return '[MaxDepthReached]'

  if (Array.isArray(value)) {
    return value.map((entry) => serializeForLog(entry, depth + 1, seen))
  }

  if (!isRecord(value)) {
    return String(value)
  }

  if (seen.has(value)) return '[Circular]'
  seen.add(value)

  const out: UnknownRecord = {}
  for (const [key, entry] of Object.entries(value)) {
    out[key] = serializeForLog(entry, depth + 1, seen)
  }
  return out
}

function findPrimaryErrorObject(messages: unknown[]): unknown {
  if (messages.length === 0) return undefined
  const [first] = messages

  if (isRecord(first) && first.error) {
    return first.error
  }
  return first
}

function getAuthErrorDiagnostics(code: string, messages: unknown[]): UnknownRecord {
  const errorCandidate = findPrimaryErrorObject(messages)

  const adapterCauseError =
    readNestedValue(errorCandidate, ['cause', 'err']) ??
    readNestedValue(errorCandidate, ['cause', 'cause']) ??
    readNestedValue(errorCandidate, ['cause'])

  const prismaCode =
    getString(readNestedValue(adapterCauseError, ['code'])) ||
    getString(readNestedValue(errorCandidate, ['cause', 'code']))

  const details: UnknownRecord = {
    code,
    message: getString(readNestedString(errorCandidate, ['message'])),
    type: getString(readNestedString(errorCandidate, ['type'])),
    provider: getString(readNestedString(errorCandidate, ['providerId'])),
    oauthError: getString(readNestedString(errorCandidate, ['cause', 'error'])),
    oauthDescription: getString(readNestedString(errorCandidate, ['cause', 'error_description'])),
    oauthSubError: getString(readNestedString(errorCandidate, ['cause', 'suberror'])),
    traceId:
      getString(readNestedString(errorCandidate, ['cause', 'trace_id'])) ||
      getString(readNestedString(errorCandidate, ['cause', 'traceId'])),
    correlationId:
      getString(readNestedString(errorCandidate, ['cause', 'correlation_id'])) ||
      getString(readNestedString(errorCandidate, ['cause', 'correlationId'])),
    adapterCauseMessage:
      getString(readNestedString(adapterCauseError, ['message'])) ||
      getString(readNestedString(errorCandidate, ['cause', 'message'])),
    adapterCauseName:
      getString(readNestedString(adapterCauseError, ['name'])) ||
      getString(readNestedString(errorCandidate, ['cause', 'name'])),
    prismaCode,
    prismaMeta: readNestedValue(adapterCauseError, ['meta']),
    raw: serializeForLog(messages),
  }

  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined))
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(code, ...message) {
      const diagnostics = getAuthErrorDiagnostics(String(code), message)
      console.error('[auth] NextAuth error', diagnostics)
      if (message.length > 0) {
        console.error('[auth] NextAuth raw error payload', ...message)
      }
    },
  },
})
