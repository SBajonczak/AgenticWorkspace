'use client'

import { useState } from 'react'

interface MeetingMinutesViewerProps {
  minutes: Record<string, string>  // { 'de': '...', 'en': '...' }
  availableLanguages: string[]
}

const languageLabels: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
}

function getLanguageLabel(code: string): string {
  return languageLabels[code] || code.toUpperCase()
}

export function MeetingMinutesViewer({ minutes, availableLanguages }: MeetingMinutesViewerProps) {
  const [activeLanguage, setActiveLanguage] = useState(availableLanguages[0] || 'en')

  if (availableLanguages.length === 0) {
    return (
      <div className="text-slate-400 text-sm py-4">
        No meeting minutes available yet.
      </div>
    )
  }

  const content = minutes[activeLanguage] || ''

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      {/* Language Tabs */}
      <div className="flex border-b border-white/10 bg-white/5">
        {availableLanguages.map((lang) => (
          <button
            key={lang}
            onClick={() => setActiveLanguage(lang)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeLanguage === lang
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {getLanguageLabel(lang)}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => {
            const blob = new Blob([content], { type: 'text/markdown' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `meeting-minutes-${activeLanguage}.md`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
          title="Download as Markdown"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          .md
        </button>
      </div>

      {/* Content */}
      <div className="p-6 prose prose-invert prose-sm max-w-none
        prose-headings:text-slate-100 prose-headings:font-semibold
        prose-p:text-slate-300 prose-p:leading-relaxed
        prose-li:text-slate-300
        prose-strong:text-slate-100
        prose-table:text-slate-300
        prose-th:text-slate-200 prose-th:font-semibold
        prose-td:text-slate-300
        prose-hr:border-white/10
        prose-code:text-blue-300">
        <pre className="whitespace-pre-wrap text-sm text-slate-300 font-sans leading-relaxed">
          {content}
        </pre>
      </div>
    </div>
  )
}
