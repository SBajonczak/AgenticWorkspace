'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { cn } from '@/lib/utils'
import { Sun, Moon, Menu, X, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ActiveLink = 'dashboard' | 'meetings' | 'projects' | 'schedule' | 'goals' | 'admin'

interface AppHeaderProps {
  activeLink?: ActiveLink
}

const navItems: { key: ActiveLink; href: string; labelKey: string }[] = [
  { key: 'dashboard', href: '/dashboard', labelKey: 'navigation.dashboard' },
  { key: 'meetings', href: '/meetings', labelKey: 'navigation.meetings' },
  { key: 'projects', href: '/projects', labelKey: 'navigation.projects' },
  { key: 'schedule', href: '/schedule', labelKey: 'navigation.schedule' },
  { key: 'goals', href: '/goals', labelKey: 'navigation.goals' },
]

export default function AppHeader({ activeLink }: AppHeaderProps) {
  const tCommon = useTranslations('common')
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isProjectAdmin, setIsProjectAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/user/me')
      .then((r) => r.json())
      .then((data: { appRoles?: string[] }) => {
        if (data.appRoles?.includes('projectadmin')) {
          setIsProjectAdmin(true)
        }
      })
      .catch(() => {/* silently ignore */})
  }, [])

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-foreground tracking-tight">
            {tCommon('brand.name')}
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex gap-1 items-center">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  activeLink === item.key
                    ? 'text-foreground bg-accent font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {(tCommon as any)(item.labelKey)}
              </Link>
            ))}
            {isProjectAdmin && (
              <Link
                href="/admin/projects"
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1',
                  activeLink === 'admin'
                    ? 'text-foreground bg-accent font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {(tCommon as any)('navigation.admin')}
              </Link>
            )}
            <div className="ml-2 flex items-center gap-1">
              <LanguageSwitcher />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle theme"
                className="relative"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </div>
          </nav>

          {/* Mobile controls */}
          <div className="flex md:hidden items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              className="relative"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-3 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                activeLink === item.key
                  ? 'text-foreground bg-accent font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {(tCommon as any)(item.labelKey)}
            </Link>
          ))}
          {isProjectAdmin && (
            <Link
              href="/admin/projects"
              onClick={() => setMobileOpen(false)}
              className={cn(
                'px-3 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1',
                activeLink === 'admin'
                  ? 'text-foreground bg-accent font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {(tCommon as any)('navigation.admin')}
            </Link>
          )}
          <div className="pt-2 border-t border-border mt-1">
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </header>
  )
}
