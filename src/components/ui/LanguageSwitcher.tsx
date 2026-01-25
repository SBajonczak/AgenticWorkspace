'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/routing'
import { useTransition } from 'react'

export default function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const handleLanguageChange = (newLocale: string) => {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale })
    })
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => handleLanguageChange('en')}
        disabled={isPending}
        className={`px-3 py-1 rounded transition-colors ${
          locale === 'en'
            ? 'bg-purple-600 text-white font-semibold'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
      >
        EN
      </button>
      <span className="text-gray-600">|</span>
      <button
        onClick={() => handleLanguageChange('de')}
        disabled={isPending}
        className={`px-3 py-1 rounded transition-colors ${
          locale === 'de'
            ? 'bg-purple-600 text-white font-semibold'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
      >
        DE
      </button>
    </div>
  )
}
