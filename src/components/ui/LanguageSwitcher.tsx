'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/routing'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
    <div className="flex items-center gap-1 text-sm">
      {(['en', 'de'] as const).map((lang, i) => (
        <>
          {i > 0 && <span key={`sep-${lang}`} className="text-border">|</span>}
          <Button
            key={lang}
            variant={locale === lang ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isPending}
            onClick={() => handleLanguageChange(lang)}
            className={cn(
              'h-7 px-2 text-xs font-medium',
              locale === lang && 'font-semibold'
            )}
          >
            {lang.toUpperCase()}
          </Button>
        </>
      ))}
    </div>
  )
}
