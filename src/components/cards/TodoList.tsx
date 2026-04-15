'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Todo {
  id: string
  title: string
  description: string
  assigneeHint: string | null
  confidence: number
  status: string
  jiraSync: JiraSync | null
}

interface JiraSync {
  jiraIssueKey: string | null
  status: string
  syncedAt: string | null
}

interface TodoListProps {
  todos: Todo[]
}

export default function TodoList({ todos }: TodoListProps) {
  const tMeetings = useTranslations('meetings')
  const tCommon = useTranslations('common')

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 0.85) return 'text-green-400'
    if (confidence >= 0.7) return 'text-yellow-400'
    return 'text-orange-400'
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.85) return tCommon('labels.high')
    if (confidence >= 0.7) return tCommon('labels.medium')
    return tCommon('labels.low')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="backdrop-blur rounded-2xl">
        <CardContent className="p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">{tMeetings('actionItems.title')}</h2>

          {todos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{tMeetings('actionItems.noItems')}</p>
          ) : (
            <div className="space-y-4">
              {todos.map((todo, index) => (
                <motion.div
                  key={todo.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <Card className="bg-background/50 border-border hover:border-primary/50 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-foreground flex-1">{todo.title}</h3>
                        <div className="flex items-center gap-3">
                          <span className={cn('text-sm font-medium', getConfidenceClass(todo.confidence))}>
                            {getConfidenceLabel(todo.confidence)} ({Math.round(todo.confidence * 100)}%)
                          </span>
                          {todo.jiraSync?.status === 'synced' && (
                            <a
                              href={`${process.env.NEXT_PUBLIC_JIRA_HOST}/browse/${todo.jiraSync.jiraIssueKey}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Badge className="bg-blue-600 text-white hover:bg-blue-700 gap-1">
                                📋 {todo.jiraSync.jiraIssueKey}
                              </Badge>
                            </a>
                          )}
                        </div>
                      </div>

                      <p className="text-muted-foreground mb-4">{todo.description}</p>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          {todo.assigneeHint && (
                            <span className="text-muted-foreground">
                              👤 <span className="text-primary">{todo.assigneeHint}</span>
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            {tCommon('labels.status')}:{' '}
                            <span className="text-foreground capitalize">{todo.status}</span>
                          </span>
                        </div>
                        {todo.jiraSync?.status === 'failed' && (
                          <span className="text-destructive text-xs">❌ {tMeetings('actionItems.jiraSyncFailed')}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
