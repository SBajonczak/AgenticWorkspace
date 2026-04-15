'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { CompanyGoal, MarketSignal } from '@/mocks'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Target, AlertTriangle } from 'lucide-react'

interface CompanyDirectionWidgetProps {
  goals: CompanyGoal[]
  signals: MarketSignal[]
}

export default function CompanyDirectionWidget({ goals, signals }: CompanyDirectionWidgetProps) {
  const t = useTranslations('widgets.companyDirection')
  const highImpactSignals = signals.filter((s) => s.impact === 'high')

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <Card className="bg-card border-border hover:shadow-md transition-all rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-foreground mb-1">{t('title')}</h3>
              <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
              <Target className="h-5 w-5 text-violet-500" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {/* Goals Summary */}
          <div className="bg-muted/40 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-foreground font-semibold">{t('goals')}</h4>
              <span className="text-2xl font-bold text-primary">{goals.length}</span>
            </div>
            <div className="space-y-2">
              {goals.slice(0, 2).map((goal) => (
                <div key={goal.id} className="flex items-center gap-2">
                  <Progress
                    value={goal.progress}
                    className="flex-1 h-2 [&>div]:bg-primary"
                  />
                  <span className="text-xs text-muted-foreground min-w-[3rem] text-right">
                    {goal.progress}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Market Signals */}
          <div className="bg-muted/40 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-foreground font-semibold">{t('signals')}</h4>
              <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs">
                {highImpactSignals.length} {t('highImpact')}
              </Badge>
            </div>
            <div className="space-y-2">
              {highImpactSignals.slice(0, 2).map((signal) => (
                <div key={signal.id} className="text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-400 mt-0.5 shrink-0" />
                    <p className="flex-1 line-clamp-2">{signal.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Link
            href="/goals"
            className="w-full text-center text-primary hover:text-primary/80 transition-colors text-sm font-semibold"
          >
            {t('viewDetails')} →
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
