'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ShieldCheck, Loader2, Search, UserCog, CheckCircle, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectOwner {
  oid: string | null
  tid: string | null
  name: string | null
}

interface AdminProject {
  id: string
  name: string
  description: string | null
  status: string
  owner: string | null
  ownerOid: string | null
  ownerTid: string | null
  ownerName: string | null
  archived: boolean
  _count?: { members: number }
}

interface UserSearchResult {
  id: string
  oid: string
  tid?: string
  displayName: string
  mail?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string) {
  switch (status) {
    case 'active':    return 'border-green-500/30 bg-green-500/20 text-green-400'
    case 'on_hold':   return 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
    case 'completed': return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
    case 'archived':  return 'border-gray-500/30 bg-gray-500/20 text-gray-400'
    default:          return 'border-gray-500/30 bg-gray-500/20 text-gray-400'
  }
}

// ---------------------------------------------------------------------------
// Owner Dialog
// ---------------------------------------------------------------------------

interface OwnerDialogProps {
  project: AdminProject
  onClose: () => void
  onOwnerChanged: (projectId: string, owner: ProjectOwner) => void
  t: ReturnType<typeof useTranslations>
}

function OwnerDialog({ project, onClose, onOwnerChanged, t }: OwnerDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/tenants/users?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data: UserSearchResult[] = await res.json()
        setResults(data)
      }
    } catch {
      /* ignore */
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, handleSearch])

  const handleConfirm = async () => {
    if (!selectedUser) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${project.id}/owner`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerOid: selectedUser.oid,
          ownerTid: selectedUser.tid ?? null,
          ownerName: selectedUser.displayName,
        }),
      })
      if (res.ok) {
        onOwnerChanged(project.id, {
          oid: selectedUser.oid,
          tid: selectedUser.tid ?? null,
          name: selectedUser.displayName,
        })
        onClose()
      } else {
        setError('Failed to update owner')
      }
    } catch {
      setError('Failed to update owner')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">{t('projects.changeOwnerDialog.title')}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t('projects.changeOwnerDialog.description')}
        </p>
        <p className="text-sm font-medium mb-4">
          <span className="text-muted-foreground">Project: </span>{project.name}
        </p>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('projects.changeOwnerDialog.search')}
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="min-h-[120px] max-h-48 overflow-y-auto rounded-md border border-border mb-4">
          {searching && (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!searching && results.length === 0 && query.trim() && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('projects.changeOwnerDialog.noResults')}
            </p>
          )}
          {!searching && results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => setSelectedUser(user)}
              className={cn(
                'w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-accent transition-colors',
                selectedUser?.id === user.id && 'bg-accent'
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.displayName}</p>
                {user.mail && (
                  <p className="text-xs text-muted-foreground truncate">{user.mail}</p>
                )}
              </div>
              {selectedUser?.id === user.id && (
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive mb-3">{error}</p>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('projects.changeOwnerDialog.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedUser || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {t('projects.changeOwnerDialog.confirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminProjectsPage() {
  const t = useTranslations('admin')
  const router = useRouter()
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<AdminProject | null>(null)

  useEffect(() => {
    fetch('/api/projects/admin')
      .then(async (res) => {
        if (res.status === 403) {
          router.replace('/dashboard')
          return
        }
        if (!res.ok) {
          setError(t('projects.error'))
          return
        }
        const data: AdminProject[] = await res.json()
        setProjects(data)
      })
      .catch(() => setError(t('projects.error')))
      .finally(() => setLoading(false))
  }, [router, t])

  const handleOwnerChanged = (projectId: string, owner: ProjectOwner) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, ownerOid: owner.oid, ownerTid: owner.tid, ownerName: owner.name, owner: owner.name }
          : p
      )
    )
  }

  return (
    <>
      <AppHeader activeLink="admin" />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t('projects.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('projects.subtitle')}</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && projects.length === 0 && (
          <p className="text-muted-foreground text-center py-20">{t('projects.noProjects')}</p>
        )}

        {!loading && !error && projects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('projects.table.name')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('projects.table.name')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('projects.table.status')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('projects.table.owner')}</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('projects.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project, idx) => (
                      <tr
                        key={project.id}
                        className={cn(
                          'border-b border-border last:border-0 hover:bg-muted/30 transition-colors',
                          project.archived && 'opacity-60'
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{project.name}</p>
                          {project.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-xs">{project.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn('text-xs', statusBadgeClass(project.status))}>
                            {t(`projects.statusLabels.${project.status}` as any) || project.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm">{project.ownerName ?? project.owner ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => setSelectedProject(project)}
                          >
                            <UserCog className="h-3.5 w-3.5" />
                            {t('projects.changeOwner')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {selectedProject && (
        <OwnerDialog
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onOwnerChanged={handleOwnerChanged}
          t={t}
        />
      )}
    </>
  )
}
