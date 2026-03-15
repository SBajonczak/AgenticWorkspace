'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Rocket, User } from 'lucide-react'

export interface ActiveProjectItem {
  id: string
  name: string
  aiSummary: string
  completionPercentage: number
  owner: string | null
  openActions: number
  confirmed: boolean
}

interface ActiveProjectsWidgetProps {
  projects: ActiveProjectItem[]
}

export default function ActiveProjectsWidget({ projects }: ActiveProjectsWidgetProps) {
  const t = useTranslations('widgets.activeProjects')

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="bg-card border-border hover:shadow-md transition-all rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-foreground mb-1">{t('title')}</h3>
              <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <Rocket className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {projects.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noProjects')}</p>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 3).map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block bg-muted/40 rounded-lg p-4 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-foreground font-semibold flex-1">{project.name}</h4>
                    <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                      {project.confirmed ? `${project.completionPercentage}%` : t('pendingApproval')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{project.aiSummary}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{project.owner || t('unassigned')}</span>
                    <span>•</span>
                    <span>
                      {project.openActions} {project.openActions === 1 ? t('openActions') : t('openActions_plural')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter>
          <Link
            href="/projects"
            className="w-full text-center text-primary hover:text-primary/80 transition-colors text-sm font-semibold"
          >
            {t('viewAll')} →
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
