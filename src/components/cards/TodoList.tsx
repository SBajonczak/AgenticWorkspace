'use client'

import { motion } from 'framer-motion'

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
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return 'text-green-400'
    if (confidence >= 0.7) return 'text-yellow-400'
    return 'text-orange-400'
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.85) return 'High'
    if (confidence >= 0.7) return 'Medium'
    return 'Low'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700"
    >
      <h2 className="text-2xl font-bold text-white mb-6">Action Items</h2>
      
      {todos.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No action items found</p>
      ) : (
        <div className="space-y-4">
          {todos.map((todo, index) => (
            <motion.div
              key={todo.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="bg-gray-900/50 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-white flex-1">{todo.title}</h3>
                <div className="flex items-center gap-3">
                  {/* Confidence Badge */}
                  <div className={`text-sm font-medium ${getConfidenceColor(todo.confidence)}`}>
                    {getConfidenceLabel(todo.confidence)} ({Math.round(todo.confidence * 100)}%)
                  </div>
                  
                  {/* Jira Sync Status */}
                  {todo.jiraSync && todo.jiraSync.status === 'synced' && (
                    <a
                      href={`${process.env.NEXT_PUBLIC_JIRA_HOST}/browse/${todo.jiraSync.jiraIssueKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 transition-colors"
                    >
                      <span>📋</span>
                      <span>{todo.jiraSync.jiraIssueKey}</span>
                    </a>
                  )}
                </div>
              </div>

              <p className="text-gray-400 mb-4">{todo.description}</p>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  {todo.assigneeHint && (
                    <span className="text-gray-400">
                      👤 <span className="text-purple-400">{todo.assigneeHint}</span>
                    </span>
                  )}
                  <span className="text-gray-500">
                    Status: <span className="text-gray-300 capitalize">{todo.status}</span>
                  </span>
                </div>

                {todo.jiraSync && todo.jiraSync.status === 'failed' && (
                  <span className="text-red-400 text-xs">❌ Jira sync failed</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
