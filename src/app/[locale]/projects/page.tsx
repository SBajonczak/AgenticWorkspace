'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
import { mockProjects, Project } from '@/mocks'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'

export default function ProjectsListPage() {
  const tCommon = useTranslations('common')
  const tList = useTranslations('projects.list')
  const [filter, setFilter] = useState<'all' | 'active' | 'on_hold' | 'completed'>('all')

  const filteredProjects = mockProjects.filter((p) => filter === 'all' || p.status === filter)

  const getStatusBadgeClass = (status: Project['status']) => {
    switch (status) {
      case 'active':    return 'border-green-500/30 bg-green-500/20 text-green-400'
      case 'on_hold':   return 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
      case 'completed': return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeLink="projects" />

      <main className="container mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link href="/dashboard" className="text-primary hover:text-primary/80 mb-4 inline-block text-sm">
            ← {tCommon('navigation.dashboard')}
          </Link>
          <h1 className="text-4xl font-bold text-foreground mb-2">{tList('title')}</h1>
          <p className="text-muted-foreground">{tList('subtitle')}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6 flex gap-2">
          {(['all', 'active', 'on_hold', 'completed'] as const).map((f) => (
            <Button key={f} variant={filter === f ? 'default' : 'secondary'} size="sm" onClick={() => setFilter(f)}>
              {tList(`filters.${f}`)}
            </Button>
          ))}
        </motion.div>

        {filteredProjects.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <p className="text-muted-foreground text-xl">{tList('empty')}</p>
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
                <Link href={`/projects/${project.id}`} className="block h-full">
                  <Card className="backdrop-blur hover:border-primary/50 transition-all h-full cursor-pointer">
                    <CardContent className="p-6 h-full flex flex-col">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-xl font-bold text-foreground flex-1">{project.name}</h3>
                        <Badge variant="outline" className={cn('ml-2 shrink-0', getStatusBadgeClass(project.status))}>
                          {tList(`status.${project.status}`)}
                        </Badge>
                      </div>

                      <div className="mb-4">
                        <p className="text-xs text-primary mb-1">{tList('aiSummary')}</p>
                        <p className="text-sm text-muted-foreground line-clamp-3">{project.aiSummary}</p>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>{tList('card.progress')}</span>
                          <span className="font-semibold text-foreground">{project.completionPercentage}%</span>
                        </div>
                        <Progress
                          value={project.completionPercentage}
                          className="h-2 [&>div]:bg-primary"
                        />
                      </div>

                      <div className="mt-auto space-y-2 text-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>{tList('card.owner')}</span>
                          <span className="text-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {project.owner}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>{project.openActions === 1 ? tList('card.openActions') : tList('card.openActions_plural')}</span>
                          <span className="text-foreground font-semibold">{project.openActions}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>{tList('card.targetDate')}</span>
                          <span className="text-foreground">{new Date(project.targetDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  )
}
