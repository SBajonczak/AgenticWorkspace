-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "azureTenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Organization',
    "ticketProvider" TEXT NOT NULL DEFAULT 'none',
    "ticketConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "organizerEmail" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "transcript" TEXT,
    "summary" TEXT,
    "decisions" TEXT,
    "participants" TEXT,
    "processedAt" TIMESTAMP(3),
    "graphLastModifiedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Todo" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assigneeHint" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Todo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketSync" (
    "id" TEXT NOT NULL,
    "todoId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'jira',
    "ticketKey" TEXT,
    "ticketId" TEXT,
    "ticketUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingMinutes" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingMinutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStatus" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "projectId" TEXT,
    "projectName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "owner" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAlias" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,

    CONSTRAINT "ProjectAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSourceLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "identifier" TEXT NOT NULL,
    "config" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSyncState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isProcessing" BOOLEAN NOT NULL DEFAULT false,
    "hasRefreshToken" BOOLEAN NOT NULL DEFAULT false,
    "consentRequired" BOOLEAN NOT NULL DEFAULT false,
    "meetingLookaheadDays" INTEGER NOT NULL DEFAULT 14,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastMeetingSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_azureTenantId_key" ON "Tenant"("azureTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_meetingId_key" ON "Meeting"("meetingId");

-- CreateIndex
CREATE INDEX "Meeting_tenantId_idx" ON "Meeting"("tenantId");

-- CreateIndex
CREATE INDEX "Meeting_graphLastModifiedAt_idx" ON "Meeting"("graphLastModifiedAt");

-- CreateIndex
CREATE INDEX "Todo_meetingId_idx" ON "Todo"("meetingId");

-- CreateIndex
CREATE INDEX "Todo_projectId_idx" ON "Todo"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketSync_todoId_key" ON "TicketSync"("todoId");

-- CreateIndex
CREATE INDEX "TicketSync_todoId_idx" ON "TicketSync"("todoId");

-- CreateIndex
CREATE INDEX "MeetingMinutes_meetingId_idx" ON "MeetingMinutes"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingMinutes_meetingId_language_key" ON "MeetingMinutes"("meetingId", "language");

-- CreateIndex
CREATE INDEX "ProjectStatus_meetingId_idx" ON "ProjectStatus"("meetingId");

-- CreateIndex
CREATE INDEX "ProjectStatus_projectId_idx" ON "ProjectStatus"("projectId");

-- CreateIndex
CREATE INDEX "Project_tenantId_idx" ON "Project"("tenantId");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "ProjectAlias_projectId_idx" ON "ProjectAlias"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAlias_alias_idx" ON "ProjectAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAlias_projectId_alias_key" ON "ProjectAlias"("projectId", "alias");

-- CreateIndex
CREATE INDEX "ProjectSourceLink_projectId_idx" ON "ProjectSourceLink"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSyncState_userId_key" ON "UserSyncState"("userId");

-- CreateIndex
CREATE INDEX "UserSyncState_isProcessing_idx" ON "UserSyncState"("isProcessing");

-- CreateIndex
CREATE INDEX "UserSyncState_consentRequired_idx" ON "UserSyncState"("consentRequired");

-- CreateIndex
CREATE INDEX "UserSyncState_nextRunAt_idx" ON "UserSyncState"("nextRunAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSync" ADD CONSTRAINT "TicketSync_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingMinutes" ADD CONSTRAINT "MeetingMinutes_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatus" ADD CONSTRAINT "ProjectStatus_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatus" ADD CONSTRAINT "ProjectStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAlias" ADD CONSTRAINT "ProjectAlias_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSourceLink" ADD CONSTRAINT "ProjectSourceLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSyncState" ADD CONSTRAINT "UserSyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

