'use client'

import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
import { getProjectById, getMeetingById } from '@/mocks'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { User, Calendar, XCircle, ClipboardList, ChevronLeft } from 'lucide-react'

export default function ProjectDetailPage() {
  const params = useParams()
  const tCommon = useTranslations('common')
  const tDetail = useTranslations('projects.detail')

  const project = getProjectById(params.id as string)

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground text-2xl mb-4">Project not found</p>
          <Link href="/projects" className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80">
            <ChevronLeft className="h-4 w-4" /> Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  const relatedMeetings = project.relatedMeetingIds
    .map((id) => getMeetingById(id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined && m !== null)

  const getStatusBadgeClass = (status: typeof project.status) => {
    switch (status) {
      case 'active':    return 'border-green-500/30 bg-green-500/20 text-green-400'
      case 'on_hold':   return 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
      case 'completed': return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
    }
  }

  const getUpdateTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'progress':  return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
      case 'blocker':   return 'border-red-500/30 bg-red-500/20 text-red-400'
      case 'milestone': return 'border-green-500/30 bg-green-500/20 text-green-400'
      default:          return 'border-border bg-muted/20 text-muted-foreground'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeLink="projects" />

      <main className="container mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link href="/projects" className="text-primary hover:text-primary/80 mb-4 inline-block text-sm">
            ← {tDetail('backToList')}
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">{project.name}</h1>
              <p className="text-muted-foreground">{project.description}</p>
            </div>
            <Badge variant="outline" className={cn('ml-4 shrink-0', getStatusBadgeClass(project.status))}>
              {tDetail(`status.${project.status}`)}
            </Badge>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <Tabs defaultValue="overview" className="flex-col w-full">
            <TabsList className="border-b border-border rounded-none bg-transparent w-full justify-start gap-1 h-auto pb-0 mb-6">
              {(['overview', 'updates', 'meetings', 'actions'] as const).map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="rounded-none border-b-2 border-transparent data-active:border-primary data-active:text-primary data-active:bg-transparent pb-2 px-4 text-sm font-medium text-muted-foreground data-active:text-foreground"
                >
                  {tDetail(`tabs.${tab}`)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <Card className="bg-primary/10 border-primary/30 backdrop-blur rounded-xl">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-primary mb-3">{tDetail('overview.aiSummary')}</h3>
                    <p className="text-muted-foreground leading-relaxed">{project.aiSummary}</p>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="backdrop-blur rounded-xl">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('overview.metadata.owner')}</h3>
                      <p className="text-muted-foreground flex items-center gap-1.5"><User className="h-4 w-4" /> {project.owner}</p>
                    </CardContent>
                  </Card>
                  <Card className="backdrop-blur rounded-xl">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('overview.metadata.progress')}</h3>
                      <div className="flex items-center gap-3">
                        <Progress
                          value={project.completionPercentage}
                          className="flex-1 h-3 [&>div]:bg-primary"
                        />
                        <span className="text-xl font-bold text-foreground">{project.completionPercentage}%</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="backdrop-blur rounded-xl">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('overview.metadata.startDate')}</h3>
                      <p className="text-muted-foreground">{new Date(project.startDate).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                  <Card className="backdrop-blur rounded-xl">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('overview.metadata.targetDate')}</h3>
                      <p className="text-muted-foreground">{new Date(project.targetDate).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="backdrop-blur rounded-xl">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('overview.metadata.team')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {project.team.map((member, index) => (
                        <Badge key={index} variant="secondary" className="gap-1"><User className="h-3 w-3" /> {member}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="updates">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="backdrop-blur rounded-xl">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('updates.title')}</h3>
                    {project.updates.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">{tDetail('updates.noUpdates')}</p>
                    ) : (
                      <div className="space-y-4">
                        {project.updates.map((update) => (
                          <div key={update.id} className="bg-background/50 rounded-lg p-4 border-l-4 border-primary">
                            <div className="flex items-start justify-between mb-2">
                              <Badge variant="outline" className={cn(getUpdateTypeBadgeClass(update.type))}>
                                {tDetail(`updates.types.${update.type}`)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{new Date(update.date).toLocaleDateString()}</span>
                            </div>
                            <p className="text-muted-foreground mb-2">{update.content}</p>
                            <p className="text-xs text-muted-foreground/60">by {update.author}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="meetings">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="backdrop-blur rounded-xl">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('meetings.title')}</h3>
                    {relatedMeetings.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">{tDetail('meetings.noMeetings')}</p>
                    ) : (
                      <div className="space-y-3">
                        {relatedMeetings.map((meeting) => (
                          <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="block bg-background/50 rounded-lg p-4 hover:bg-background/70 transition-colors">
                            <h4 className="text-foreground font-semibold mb-1">{meeting.title}</h4>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {meeting.organizer}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(meeting.startTime).toLocaleDateString()}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="actions">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="backdrop-blur rounded-xl">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('actions.title')}</h3>
                    {project.openActions === 0 ? (
                      <p className="text-muted-foreground text-center py-8">{tDetail('actions.noActions')}</p>
                    ) : (
                      <div className="text-center py-8">
                        <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-2xl font-bold text-foreground mb-2">{project.openActions}</p>
                        <p className="text-muted-foreground">{tDetail('actions.title')}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  )
}
