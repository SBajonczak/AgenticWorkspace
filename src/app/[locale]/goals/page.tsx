'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
import { mockGoals, mockMarketSignals, MarketSignal } from '@/mocks'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { User, ExternalLink, Swords, TrendingUp, Scale, Microscope, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GoalsPage() {
  const tCommon = useTranslations('common')
  const tGoals = useTranslations('goals')

  const [agentStatus, setAgentStatus] = useState<{ consentRequired: boolean; hasRefreshToken: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/agent/status', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setAgentStatus(data) })
      .catch(() => {/* silently ignore */})
  }, [])

  const needsReConsent = Boolean(agentStatus?.consentRequired || (agentStatus && !agentStatus.hasRefreshToken))
  const reConsentUrl = `/auth/signin?consent=required&reason=consent_required&callbackUrl=${encodeURIComponent('/goals')}`

  const getImpactBadgeClass = (impact: MarketSignal['impact']) => {
    switch (impact) {
      case 'high':   return 'border-red-500/30 bg-red-500/20 text-red-400'
      case 'medium': return 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
      case 'low':    return 'border-green-500/30 bg-green-500/20 text-green-400'
    }
  }

  const getTypeIcon = (type: MarketSignal['type']) => {
    switch (type) {
      case 'competitor':  return <Swords className="h-5 w-5" />
      case 'trend':       return <TrendingUp className="h-5 w-5" />
      case 'regulation':  return <Scale className="h-5 w-5" />
      case 'technology':  return <Microscope className="h-5 w-5" />
    }
  }

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'revenue':     return 'border-green-500/30 bg-green-500/20 text-green-400'
      case 'product':     return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
      case 'customer':    return 'border-purple-500/30 bg-purple-500/20 text-purple-400'
      case 'operational': return 'border-orange-500/30 bg-orange-500/20 text-orange-400'
      default:            return 'border-border bg-muted/20 text-muted-foreground'
    }
  }

  const getSignalTypeBadgeClass = (type: MarketSignal['type']) => {
    switch (type) {
      case 'competitor':  return 'border-red-500/30 bg-red-500/20 text-red-400'
      case 'trend':       return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
      case 'regulation':  return 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
      case 'technology':  return 'border-purple-500/30 bg-purple-500/20 text-purple-400'
      default:            return 'border-border bg-muted/20 text-muted-foreground'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeLink="goals" />

      <main className="container mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link href="/dashboard" className="text-primary hover:text-primary/80 mb-4 inline-block text-sm">
            ← {tCommon('navigation.dashboard')}
          </Link>
          <h1 className="text-4xl font-bold text-foreground mb-2">{tGoals('title')}</h1>
          <p className="text-muted-foreground">{tGoals('subtitle')}</p>
        </motion.div>

        {needsReConsent && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-xl border border-amber-500/60 bg-amber-500/10 p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Action required
                </div>
                <h2 className="text-lg font-semibold text-amber-100">Microsoft consent has to be renewed</h2>
                <p className="mt-1 text-sm text-amber-200/90">
                  Meeting sync currently cannot use a valid refresh token. Please start Microsoft sign-in again and approve the requested permissions.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => { window.location.href = reConsentUrl }}
                className="w-full sm:w-auto bg-amber-500 text-gray-950 hover:bg-amber-400"
              >
                Renew Microsoft consent
              </Button>
            </div>
          </motion.div>
        )}

        {/* Company Goals */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">{tGoals('labels.goal')}</h2>
          <div className="space-y-6">
            {mockGoals.map((goal, index) => (
              <motion.div key={goal.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * index }}>
                <Card className="backdrop-blur hover:border-primary/50 transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold text-foreground">{goal.title}</h3>
                          <Badge variant="outline" className={cn(getCategoryBadgeClass(goal.category))}>
                            {tGoals(`categories.${goal.category}`)}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mb-3">{goal.description}</p>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-3xl font-bold text-primary">{goal.progress}%</div>
                        <div className="text-xs text-muted-foreground">{tGoals('labels.progress')}</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <Progress
                        value={goal.progress}
                        className="h-3 [&>div]:bg-primary"
                      />
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      {goal.metrics.map((metric, idx) => (
                        <div key={idx} className="bg-background/50 rounded-lg p-3">
                          <div className="text-xs text-muted-foreground mb-1">{metric.label}</div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-foreground">{metric.current}</span>
                            <span className="text-xs text-muted-foreground">/ {metric.target}</span>
                            <span className="text-xs text-muted-foreground">{metric.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                      <span>{tGoals('labels.owner')}: <span className="text-foreground flex items-center gap-1.5 inline-flex"><User className="h-3.5 w-3.5" /> {goal.owner}</span></span>
                      <span>•</span>
                      <span>{tGoals('labels.deadline')}: <span className="text-foreground">{new Date(goal.targetDate).toLocaleDateString()}</span></span>
                    </div>

                    {goal.agentRecommendation && (
                      <div className="bg-primary/10 rounded-lg p-4 border border-primary/30 mb-3">
                        <p className="text-xs text-primary mb-1">{tGoals('insights.recommendation')}</p>
                        <p className="text-sm text-muted-foreground italic">{goal.agentRecommendation}</p>
                      </div>
                    )}

                    {goal.relatedProjectIds.length > 0 && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">{tGoals('labels.relatedProjects')}:</p>
                        <div className="flex flex-wrap gap-2">
                          {goal.relatedProjectIds.map((projectId) => (
                            <Link key={projectId} href={`/projects/${projectId}`}>
                              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer gap-1">
                                <ExternalLink className="h-3 w-3" /> {projectId}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Market Signals */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h2 className="text-2xl font-bold text-foreground mb-6">{tGoals('signals.title')}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {mockMarketSignals.map((signal, index) => (
              <motion.div key={signal.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * index }}>
                <Card className="backdrop-blur hover:border-primary/50 transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{getTypeIcon(signal.type)}</span>
                        <Badge variant="outline" className={cn(getSignalTypeBadgeClass(signal.type))}>
                          {tGoals(`signals.types.${signal.type}`)}
                        </Badge>
                      </div>
                      <Badge variant="outline" className={cn(getImpactBadgeClass(signal.impact))}>
                        {tGoals(`signals.impact.${signal.impact}`)}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{signal.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{signal.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{tGoals('signals.source')}: {signal.source}</span>
                      <span>•</span>
                      <span>{new Date(signal.date).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  )
}
