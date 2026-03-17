'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus, Pencil, Trash2, ChevronRight, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SourceType = 'confluence' | 'jira' | 'github' | 'sharepoint'

interface ProjectAlias {
  id: string
  alias: string
}

interface ProjectSourceLink {
  id: string
  type: SourceType
  label: string | null
  identifier: string
  config: string | null
}

interface Project {
  id: string
  name: string
  description: string | null
  status: string
  owner: string | null
  archived: boolean
  confirmed: boolean
  aliases: ProjectAlias[]
  sourceLinks: ProjectSourceLink[]
}

type FilterType = 'all' | 'active' | 'on_hold' | 'completed' | 'unconfirmed'

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
// Source form component
// ---------------------------------------------------------------------------

function SourceRow({
  source,
  projectId,
  t,
  onRemove,
}: {
  source: ProjectSourceLink
  projectId: string
  t: ReturnType<typeof useTranslations>
  onRemove: () => void
}) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      let config: Record<string, unknown> | null = null
      try { config = source.config ? JSON.parse(source.config) : null } catch { /* ignore */ }
      const res = await fetch(`/api/projects/${projectId}/sources/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: source.type, identifier: source.identifier, config }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, message: 'Network error' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
      <Badge variant="outline" className="shrink-0 text-xs capitalize">{source.type}</Badge>
      <span className="flex-1 truncate font-mono text-xs text-muted-foreground">{source.identifier}</span>
      {source.label && <span className="shrink-0 text-xs text-foreground">{source.label}</span>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={testConnection}
        disabled={testing}
      >
        {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : t('manage.testConnection')}
      </Button>
      {testResult && (
        testResult.ok
          ? <CheckCircle className="h-4 w-4 text-green-500" />
          : <span title={testResult.message}><AlertCircle className="h-4 w-4 text-destructive" /></span>
      )}
      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive" onClick={onRemove}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Project edit / create dialog
// ---------------------------------------------------------------------------

function ProjectDialog({
  project,
  t,
  onClose,
  onSaved,
}: {
  project: Project | null
  t: ReturnType<typeof useTranslations>
  onClose: () => void
  onSaved: (p: Project) => void
}) {
  const isEdit = project !== null
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [owner, setOwner] = useState(project?.owner ?? '')
  const [status, setStatus] = useState(project?.status ?? 'active')
  const [aliasText, setAliasText] = useState(project?.aliases.map((a) => a.alias).join('\n') ?? '')
  const [sources, setSources] = useState<ProjectSourceLink[]>(project?.sourceLinks ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New source form
  const [newSrcType, setNewSrcType] = useState<SourceType>('confluence')
  const [newSrcLabel, setNewSrcLabel] = useState('')
  const [newSrcId, setNewSrcId] = useState('')

  const addSource = async () => {
    if (!newSrcId.trim() || !isEdit) return
    const res = await fetch(`/api/projects/${project!.id}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newSrcType, label: newSrcLabel || null, identifier: newSrcId }),
    })
    if (res.ok) {
      const { source } = await res.json()
      setSources((prev) => [...prev, source])
      setNewSrcLabel('')
      setNewSrcId('')
    }
  }

  const removeSource = async (srcId: string) => {
    if (!isEdit) {
      setSources((prev) => prev.filter((s) => s.id !== srcId))
      return
    }
    const res = await fetch(`/api/projects/${project!.id}/sources/${srcId}`, { method: 'DELETE' })
    if (res.ok) setSources((prev) => prev.filter((s) => s.id !== srcId))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const aliases = aliasText
      .split('\n')
      .map((a) => a.trim())
      .filter(Boolean)
    const payload = { name, description: description || null, owner: owner || null, status, aliases }
    const res = await fetch(
      isEdit ? `/api/projects/${project!.id}` : '/api/projects',
      {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    if (res.ok) {
      const { project: saved } = await res.json()
      onSaved(saved)
    } else {
      setError(t('manage.saveError'))
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">
            {isEdit ? t('manage.editTitle') : t('manage.createTitle')}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('manage.name')} *</label>
            <input
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('manage.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('manage.description')}</label>
            <textarea
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={2}
              placeholder={t('manage.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Owner + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t('manage.owner')}</label>
              <input
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t('manage.ownerPlaceholder')}
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t('manage.status')}</label>
              <select
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {(['active', 'on_hold', 'completed'] as const).map((s) => (
                  <option key={s} value={s}>{t(`status.${s}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Aliases */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('manage.aliases')}</label>
            <textarea
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              value={aliasText}
              onChange={(e) => setAliasText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">{t('manage.aliasesHint')}</p>
          </div>

          {/* Knowledge Sources (only when editing) */}
          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">{t('manage.sources')}</label>
              <div className="space-y-2 mb-3">
                {sources.map((src) => (
                  <SourceRow
                    key={src.id}
                    source={src}
                    projectId={project!.id}
                    t={t}
                    onRemove={() => removeSource(src.id)}
                  />
                ))}
              </div>
              {/* Add source form */}
              <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className="rounded-md border border-border bg-muted px-2 py-1.5 text-xs text-foreground focus:outline-none"
                    value={newSrcType}
                    onChange={(e) => setNewSrcType(e.target.value as SourceType)}
                  >
                    {(['confluence', 'jira', 'github', 'sharepoint'] as const).map((t2) => (
                      <option key={t2} value={t2}>{t(`manage.sourceTypes.${t2}`)}</option>
                    ))}
                  </select>
                  <input
                    className="rounded-md border border-border bg-muted px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none col-span-2"
                    placeholder={t(`manage.sourceIdentifierHint.${newSrcType}`)}
                    value={newSrcId}
                    onChange={(e) => setNewSrcId(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-border bg-muted px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                    placeholder={t('manage.sourceLabelPlaceholder')}
                    value={newSrcLabel}
                    onChange={(e) => setNewSrcLabel(e.target.value)}
                  />
                  <Button type="button" size="sm" variant="secondary" className="text-xs" onClick={addSource} disabled={!newSrcId.trim()}>
                    <Plus className="h-3 w-3 mr-1" />{t('manage.addSource')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose}>{t('manage.cancel')}</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {t('manage.save')}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProjectsListPage() {
  const tCommon = useTranslations('common')
  const tList = useTranslations('projects.list')
  const [filter, setFilter] = useState<FilterType>('all')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editProject, setEditProject] = useState<Project | null | undefined>(undefined) // undefined = closed, null = create
  const [deleteProject, setDeleteProject] = useState<Project | null>(null)
  const [reassignToProjectId, setReassignToProjectId] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { projects: data } = await res.json()
      setProjects(data ?? [])
      setLoadError(null)
    } catch {
      setLoadError(tList('manage.loadError'))
    } finally {
      setLoading(false)
    }
  }, [tList])

  useEffect(() => { loadProjects() }, [loadProjects])

  const openDeleteDialog = (project: Project) => {
    const defaultTarget = projects.find((candidate) =>
      candidate.id !== project.id &&
      !candidate.archived &&
      candidate.confirmed &&
      candidate.status === 'active'
    )

    setDeleteProject(project)
    setDeleteError(null)
    setReassignToProjectId(defaultTarget?.id ?? '')
  }

  const closeDeleteDialog = () => {
    setDeleteProject(null)
    setDeleteError(null)
    setReassignToProjectId('')
    setDeleting(false)
  }

  const handleDelete = async () => {
    if (!deleteProject) return
    if (!reassignToProjectId) {
      setDeleteError(tList('manage.deleteReassignRequired'))
      return
    }

    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/projects/${deleteProject.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reassignToProjectId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setDeleteError(body?.error ?? tList('manage.deleteErrorGeneric'))
        return
      }

      setProjects((prev) => prev.filter((p) => p.id !== deleteProject.id))
      closeDeleteDialog()
    } finally {
      setDeleting(false)
    }
  }

  const handleSaved = (saved: Project) => {
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id)
      return idx >= 0 ? prev.map((p, i) => (i === idx ? saved : p)) : [saved, ...prev]
    })
    setEditProject(undefined)
  }

  const filteredProjects = projects.filter((p) => {
    if (p.archived) return false
    if (filter === 'unconfirmed') return !p.confirmed
    if (filter === 'all') return true
    return p.status === filter
  })

  const reassignmentTargets = deleteProject
    ? projects.filter((candidate) =>
        candidate.id !== deleteProject.id &&
        !candidate.archived &&
        candidate.confirmed &&
        candidate.status === 'active'
      )
    : []

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeLink="projects" />

      {editProject !== undefined && (
        <ProjectDialog
          project={editProject}
          t={tList}
          onClose={() => setEditProject(undefined)}
          onSaved={handleSaved}
        />
      )}

      {deleteProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">{tList('manage.deleteTitle')}</h2>
              <Button variant="ghost" size="sm" onClick={closeDeleteDialog} disabled={deleting}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              {tList('manage.deleteConfirm')}
            </p>
            <p className="text-sm text-foreground mb-4">
              <span className="font-medium">{deleteProject.name}</span>
            </p>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {tList('manage.deleteReassignLabel')}
              </label>
              <select
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={reassignToProjectId}
                onChange={(e) => setReassignToProjectId(e.target.value)}
                disabled={deleting || reassignmentTargets.length === 0}
              >
                <option value="">{tList('manage.deleteReassignPlaceholder')}</option>
                {reassignmentTargets.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                ))}
              </select>
              {reassignmentTargets.length === 0 && (
                <p className="mt-2 text-xs text-destructive">{tList('manage.deleteNoTargets')}</p>
              )}
            </div>

            {deleteError && <p className="text-xs text-destructive mt-3">{deleteError}</p>}

            <div className="flex justify-end gap-2 pt-5">
              <Button variant="ghost" size="sm" onClick={closeDeleteDialog} disabled={deleting}>
                {tList('manage.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || !reassignToProjectId || reassignmentTargets.length === 0}
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                {tList('manage.delete')}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      <main className="container mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link href="/dashboard" className="text-primary hover:text-primary/80 mb-4 inline-block text-sm">
            ← {tCommon('navigation.dashboard')}
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">{tList('title')}</h1>
              <p className="text-muted-foreground">{tList('subtitle')}</p>
            </div>
            <Button size="sm" onClick={() => setEditProject(null)} className="gap-1.5">
              <Plus className="h-4 w-4" />{tList('newProject')}
            </Button>
          </div>
        </motion.div>

        {loadError && (
          <p className="mb-6 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{loadError}</p>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6 flex gap-2">
          {(['all', 'active', 'on_hold', 'completed', 'unconfirmed'] as const).map((f) => (
            <Button key={f} variant={filter === f ? 'default' : 'secondary'} size="sm" onClick={() => setFilter(f)}>
              {tList(`filters.${f}`)}
            </Button>
          ))}
        </motion.div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl border border-border bg-muted animate-pulse" />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <p className="text-muted-foreground text-xl">{tList('empty')}</p>
            <Button className="mt-4 gap-1.5" onClick={() => setEditProject(null)}>
              <Plus className="h-4 w-4" />{tList('newProject')}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredProjects.map((project, index) => (
              <motion.div key={project.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * index }}>
                <Card className="backdrop-blur hover:border-primary/50 transition-all h-full">
                  <CardContent className="p-6 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-bold text-foreground flex-1">{project.name}</h3>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {!project.confirmed && (
                          <Badge variant="outline" className="text-xs border-amber-500/40 bg-amber-500/15 text-amber-400">
                            {tList('status.unconfirmed' as Parameters<typeof tList>[0])}
                          </Badge>
                        )}
                        <Badge variant="outline" className={cn('text-xs', statusBadgeClass(project.status))}>
                          {tList(`status.${project.status}` as Parameters<typeof tList>[0])}
                        </Badge>
                      </div>
                    </div>

                    {project.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
                    )}

                    {project.aliases.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-1">
                        {project.aliases.slice(0, 3).map((a) => (
                          <span key={a.id} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{a.alias}</span>
                        ))}
                        {project.aliases.length > 3 && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">+{project.aliases.length - 3}</span>
                        )}
                      </div>
                    )}

                    {project.sourceLinks.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-1">
                        {[...new Set(project.sourceLinks.map((s) => s.type))].map((t2) => (
                          <Badge key={t2} variant="outline" className="text-xs capitalize">{t2}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
                      {project.owner && (
                        <span className="text-xs text-muted-foreground truncate">{project.owner}</span>
                      )}
                      <div className="flex gap-1 ml-auto">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditProject(project)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(project)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Link href={`/projects/${project.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  )
}

