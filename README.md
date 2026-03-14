# Agentic Workplace

> An AI-powered workplace agent that autonomously processes Microsoft Teams meetings and transforms conversations into actionable outcomes.

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![License](https://img.shields.io/badge/license-MIT-green)

## 🤖 What is an Agentic Workplace?

An **Agentic Workplace** is a new paradigm where autonomous AI agents work on your behalf, handling routine cognitive tasks without requiring constant human supervision. This project implements a background agent that:

- 🎯 **Works asynchronously** - Runs after meetings end, no user presence required
- 🧠 **Understands context** - Processes full meeting transcripts with AI
- ✅ **Extracts actionable items** - Identifies decisions and TODOs with confidence scoring
- 🔗 **Auto-syncs to tools** - Pushes tasks directly to Jira with proper assignees
- 📊 **Presents insights** - Beautiful dashboard to review outcomes

Unlike chatbots or assistants, this agent has **agency** and **responsibility** - it makes decisions within its domain and takes action.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Agentic Workplace                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │  Graph   │───▶│   Agent  │───▶│   Jira   │             │
│  │   API    │    │   Core   │    │   API    │             │
│  └──────────┘    └──────────┘    └──────────┘             │
│       │                │                │                   │
│       │                ▼                │                   │
│       │          ┌──────────┐           │                   │
│       │          │    AI    │           │                   │
│       │          │   LLM    │           │                   │
│       │          └──────────┘           │                   │
│       │                │                │                   │
│       ▼                ▼                ▼                   │
│  ┌────────────────────────────────────────┐                │
│  │         SQLite Database                │                │
│  │  (Meetings, TODOs, Jira Sync)          │                │
│  └────────────────────────────────────────┘                │
│                     │                                        │
│                     ▼                                        │
│              ┌─────────────┐                                │
│              │  Dashboard  │                                │
│              │  (Next.js)  │                                │
│              └─────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- OpenAI API key or Azure OpenAI credentials
- Microsoft Entra ID app registration (optional for Graph API)
- Jira account with API token (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/SBajonczak/AgenticWorkspace.git
cd AgenticWorkspace

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Initialize database
npx prisma generate
npx prisma migrate dev
npm run prisma:seed

# Start development server
npm run dev
```

Visit `http://localhost:3000` to see the dashboard with demo data.

## ⚙️ Configuration

### 1. Database Setup

The application uses SQLite for the MVP. The database is automatically created on first run.

For future migration paths, set `DATABASE_PROVIDER` to `turso` or `mssql` and switch Prisma datasource/provider accordingly.
Current runtime focus remains SQLite (`DATABASE_PROVIDER=sqlite`).

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed with demo data
npm run prisma:seed
```

### 2. Microsoft Entra ID App Registration

To access Microsoft Teams meetings and transcripts:

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. Create a new app registration
3. Configure permissions:
   - `OnlineMeetings.Read`
   - `OnlineMeetingTranscript.Read.All`
   - `offline_access`
4. Enable "Allow public client flows" for device code flow
5. Copy your **Tenant ID** and **Client ID** to `.env`

```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
```

### 3. LLM Configuration

#### Option A: OpenAI

```env
OPENAI_API_KEY=sk-...
```

#### Option B: Azure OpenAI

```env
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
```

### 4. Jira Integration

1. Generate an API token at https://id.atlassian.com/manage-profile/security/api-tokens
2. Configure in `.env`:

```env
JIRA_HOST=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=YOUR-PROJECT
```

## 🎯 Running the Agent

The agent now runs as an **automatic background worker** for all signed-in users that have valid Microsoft consent + refresh token state.

### Start the Worker

```bash
# Start background worker (runs immediately, then on schedule)
npm run worker
```

The worker:
- refreshes delegated Microsoft tokens per user in background,
- fetches each user's meetings periodically,
- processes only new/unprocessed meetings,
- stores sync state for UI feedback (`isProcessing`, `nextRunAt`, `lastError`).

### Manual Immediate Trigger (Optional)

```bash
# Trigger immediate processing for the signed-in user
curl -X POST http://localhost:3000/api/agent/run \
  -H "Content-Type: application/json" \
  -b "<your-auth-cookie>"
```

### User Processing Status API

```bash
# Returns current user sync state (processing + next run)
curl http://localhost:3000/api/agent/status -b "<your-auth-cookie>"
```

### Required Microsoft Consent / Tokens

On sign-in, the app validates that delegated Graph consent is present and a refresh token exists.

If consent is missing/expired:
- the sync state is marked `consentRequired`,
- `/api/agent/run` returns `409` with `auth_reauth_required`,
- user should sign in again with consent prompt (`/auth/signin?consent=required`).

### Shared Meeting Visibility (No Double Processing)

- Meetings are processed once by `meetingId` (dedupe).
- Participant lists are persisted and merged when a meeting is seen from different user contexts.
- All meeting participants can see the same processed meeting results without duplicate processing.

## 📊 Dashboard

The dashboard displays:

- **Meeting summary** - AI-generated executive summary
- **Key decisions** - Explicit decisions made during the meeting
- **Action items** - TODOs with confidence scores and assignees
- **Jira sync status** - Links to created Jira tasks

### Features

- ✨ **Modern UI** - Dark mode, animations with Framer Motion
- 📱 **Responsive** - Works on desktop and mobile
- 🎨 **Non-standard layout** - Hero sections, gradient cards, typography-first
- ⚡ **Real-time** - Fetches latest data from database
- 👀 **Worker feedback** - UI shows processing state and next scheduled run

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### E2E Tests

```bash
npm run test:e2e
```

## 🔒 Security

- ✅ No secrets in code - all credentials via environment variables
- ✅ Token caching with isolated interface
- ✅ Strict TypeScript for type safety
- ✅ Input validation with Zod schemas
- ✅ SQL injection protection via Prisma ORM

## 📝 Agent Behavior

The agent follows strict rules defined in `src/ai/prompts/agent-system.md`:

- **Conservative** - Only extracts explicit, actionable TODOs
- **High quality** - Fewer high-confidence tasks > many low-confidence tasks
- **Structured output** - Enforces JSON schema validation
- **Confidence scoring** - Rates each TODO based on commitment level:
  - 0.9 → "I will", "TODO", "Action"
  - 0.7 → "We need to"
  - 0.6 → "Can you", "Please"
  - <0.6 → Discarded

## 🚧 MVP Limitations & Next Steps

### Current Limitations

- Single-user mode (no multi-tenancy)
- SQLite database (not production-scalable)
- Basic error handling
- No webhook triggers (manual agent runs)
- Device code flow only (requires manual auth)

### Roadmap

- [ ] Multi-user support with proper auth
- [ ] PostgreSQL/MySQL database
- [ ] Scheduled agent runs (cron)
- [ ] Webhooks for real-time processing
- [ ] Meeting history and analytics
- [ ] Custom prompts per user/organization
- [ ] More integrations (Slack, Linear, Notion)

## 🛠️ Development

### Project Structure

```
/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts            # Demo data
├── src/
│   ├── app/               # Next.js app router
│   │   ├── dashboard/     # Dashboard page
│   │   ├── meetings/      # Meeting detail pages
│   │   └── api/           # API routes
│   ├── agent/             # Agent core logic
│   │   ├── runner.ts      # Main agent runner
│   │   └── meetingProcessor.ts
│   ├── ai/                # AI/LLM integration
│   │   ├── llmClient.ts   # OpenAI/Azure client
│   │   └── prompts/       # System prompts
│   ├── graph/             # Microsoft Graph API
│   │   ├── auth.ts        # Device code auth
│   │   ├── userTokenService.ts # Delegated token refresh service
│   │   ├── meetings.ts    # Meetings client
│   │   └── transcripts.ts # Transcripts client
│   ├── jira/              # Jira integration
│   │   └── client.ts      # Jira REST API client
│   ├── db/                # Database layer
│   │   ├── prisma.ts      # Prisma client
│   │   └── repositories/  # Data access layer
│   ├── worker/            # Background processing scheduler
│   └── components/        # React components
│       ├── cards/         # Card components
│       └── layout/        # Layout components
├── tests/                 # Tests
└── README.md
```

### Code Quality

```bash
# Lint
npm run lint

# Type check
npx tsc --noEmit

# Format (if configured)
npx prettier --write .
```

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## 💬 Support

- 📧 Email: support@example.com
- 💬 Discord: [Join our community](https://discord.gg/example)
- 🐛 Issues: [GitHub Issues](https://github.com/SBajonczak/AgenticWorkspace/issues)

---

Built with ❤️ by the Agentic Workplace team