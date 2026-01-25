'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

export default function Home() {
  const tCommon = useTranslations('common')
  
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
              {tCommon('brand.name')}
            </Link>
            <nav className="flex gap-6 items-center">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
                {tCommon('navigation.dashboard')}
              </Link>
              <LanguageSwitcher />
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-12">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
              {tCommon('brand.name')}
            </h1>
            <p className="text-2xl text-gray-300 mb-8">
              {tCommon('home.hero.subtitle')}
            </p>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              {tCommon('home.hero.description')}
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-4 justify-center mb-16">
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-lg transition-colors"
            >
              {tCommon('navigation.dashboard')}
            </Link>
            <button
              onClick={() => {
                alert(tCommon('home.alerts.configRequired'))
              }}
              className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold text-lg transition-colors"
            >
              {tCommon('buttons.runAgent')}
            </button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-gray-800/50 p-6 rounded-lg backdrop-blur">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold mb-2 text-white">{tCommon('home.features.autonomous.title')}</h3>
              <p className="text-gray-400">
                {tCommon('home.features.autonomous.description')}
              </p>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-lg backdrop-blur">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-xl font-semibold mb-2 text-white">{tCommon('home.features.extraction.title')}</h3>
              <p className="text-gray-400">
                {tCommon('home.features.extraction.description')}
              </p>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-lg backdrop-blur">
              <div className="text-4xl mb-4">🔗</div>
              <h3 className="text-xl font-semibold mb-2 text-white">{tCommon('home.features.sync.title')}</h3>
              <p className="text-gray-400">
                {tCommon('home.features.sync.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
