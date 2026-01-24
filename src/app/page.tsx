import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-12">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
              Agentic Workplace
            </h1>
            <p className="text-2xl text-gray-300 mb-8">
              Your AI-powered workplace agent that transforms meetings into actionable outcomes
            </p>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Automatically process Microsoft Teams meetings, extract decisions and TODOs,
              and sync them to Jira—all while you focus on what matters.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-4 justify-center mb-16">
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-lg transition-colors"
            >
              View Dashboard
            </Link>
            <button
              onClick={() => {
                alert('Agent configuration required. See README.md for setup instructions.')
              }}
              className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold text-lg transition-colors"
            >
              Run Agent
            </button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-gray-800/50 p-6 rounded-lg backdrop-blur">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold mb-2 text-white">Autonomous Agent</h3>
              <p className="text-gray-400">
                Works in the background, no manual intervention needed
              </p>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-lg backdrop-blur">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-xl font-semibold mb-2 text-white">Smart Extraction</h3>
              <p className="text-gray-400">
                Identifies decisions and actionable tasks from conversations
              </p>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-lg backdrop-blur">
              <div className="text-4xl mb-4">🔗</div>
              <h3 className="text-xl font-semibold mb-2 text-white">Auto-Sync</h3>
              <p className="text-gray-400">
                Pushes TODOs directly to Jira with proper assignees
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
