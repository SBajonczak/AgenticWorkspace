'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MeetingPreparationResponse } from '@/types/meetings'
import { AlertTriangle, ChevronLeft, Clock, Sparkles } from 'lucide-react'

export default function MeetingPreparationPage() {
  const params = useParams()
  const t = useTranslations('meetings.preparation')
  const tCommon = useTranslations('common')
  const meetingId = params.id as string

  const [data, setData] = useState<MeetingPreparationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadPreparation = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/meetings/${meetingId}/preparation`, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`)
        }

        const payload = (await response.json()) as MeetingPreparationResponse
        if (active) {
          setData(payload)
        }
      } catch {
        if (active) {
          setData(null)
          setError(t('loadError'))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    if (meetingId) {
      void loadPreparation()
    }

    return () => {
      active = false
    }
  }, [meetingId, t])

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeLink="meetings" />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Link
            href={`/meetings/${meetingId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('backToMeeting')}
          </Link>
        </motion.div>

        {loading ? (
          <p className="text-muted-foreground">{tCommon('labels.loading')}</p>
        ) : error || !data ? (
          <Card>
            <CardContent className="p-6 text-destructive">{error || t('loadError')}</CardContent>
          </Card>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
              <p className="text-muted-foreground mt-1">{data.upcomingMeeting.title}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {new Date(data.upcomingMeeting.startTime).toLocaleString()}
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-3 gap-6 items-start">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2">
                <Card>
                  <CardHeader className="font-semibold text-foreground flex flex-row items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    {t('agendaTitle')}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.preparedAgenda.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('noAgenda')}</p>
                    ) : (
                      data.preparedAgenda.map((item, index) => (
                        <div key={`agenda-${index}`} className="rounded-lg border border-border p-3 bg-muted/20">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-medium text-foreground text-sm">{item.title}</p>
                            <Badge variant="outline" className="text-[11px] shrink-0 capitalize">
                              {item.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{item.rationale}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <div className="space-y-6">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader className="font-semibold text-foreground">{t('conflictsTitle')}</CardHeader>
                    <CardContent>
                      {data.conflicts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('noConflicts')}</p>
                      ) : (
                        <div className="space-y-2">
                          {data.conflicts.map((conflict) => (
                            <div key={conflict.id} className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
                              <p className="text-sm text-foreground font-medium flex items-center gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                {conflict.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(conflict.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {' - '}
                                {new Date(conflict.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader className="font-semibold text-foreground">{t('kbTitle')}</CardHeader>
                    <CardContent>
                      {data.knowledgeBaseItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('noKnowledgeBase')}</p>
                      ) : (
                        <div className="space-y-2">
                          {data.knowledgeBaseItems.map((item, index) => (
                            <div key={`kb-${index}`} className="rounded-md border border-border p-2">
                              <p className="text-sm font-medium text-foreground">{item.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">{item.excerpt}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader className="font-semibold text-foreground">{t('historyTitle')}</CardHeader>
                <CardContent>
                  {data.relatedMeetings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('noHistory')}</p>
                  ) : (
                    <div className="space-y-4">
                      {data.relatedMeetings.map((relatedMeeting) => (
                        <div key={relatedMeeting.id} className="rounded-lg border border-border p-4 bg-muted/20">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-foreground">{relatedMeeting.title}</p>
                            <span className="text-xs text-muted-foreground">
                              {new Date(relatedMeeting.startTime).toLocaleDateString()}
                            </span>
                          </div>

                          {relatedMeeting.summary && (
                            <p className="text-sm text-muted-foreground mt-2">{relatedMeeting.summary}</p>
                          )}

                          {relatedMeeting.decisions.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-semibold text-foreground mb-1">{t('decisionsLabel')}</p>
                              <ul className="space-y-1">
                                {relatedMeeting.decisions.slice(0, 3).map((decision, index) => (
                                  <li key={`decision-${relatedMeeting.id}-${index}`} className="text-xs text-muted-foreground">
                                    • {decision}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {relatedMeeting.openTodos.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-semibold text-foreground mb-1">{t('openTodosLabel')}</p>
                              <ul className="space-y-1">
                                {relatedMeeting.openTodos.slice(0, 3).map((todo) => (
                                  <li key={todo.id} className="text-xs text-muted-foreground">
                                    • {todo.title}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </main>
    </div>
  )
}
