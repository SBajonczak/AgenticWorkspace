export type DatabaseProvider = 'sqlite' | 'turso' | 'mssql'

export function getDatabaseProvider(): DatabaseProvider {
  const rawProvider = process.env.DATABASE_PROVIDER?.toLowerCase()

  switch (rawProvider) {
    case 'turso':
      return 'turso'
    case 'mssql':
    case 'tsql':
    case 'sqlserver':
      return 'mssql'
    case 'sqlite':
    default:
      return 'sqlite'
  }
}
