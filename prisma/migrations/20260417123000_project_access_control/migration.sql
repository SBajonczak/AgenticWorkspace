-- Project access control: owner oid/tid + project members

ALTER TABLE "Project"
ADD COLUMN "ownerOid" TEXT,
ADD COLUMN "ownerTid" TEXT,
ADD COLUMN "ownerName" TEXT;

ALTER TABLE "User"
ADD COLUMN "aadObjectId" TEXT;

CREATE TABLE "ProjectMember" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "memberOid" TEXT NOT NULL,
  "memberTid" TEXT NOT NULL,
  "displayName" TEXT,
  "email" TEXT,
  "role" TEXT NOT NULL DEFAULT 'viewer',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_ownerTid_ownerOid_idx" ON "Project"("ownerTid", "ownerOid");
CREATE UNIQUE INDEX "Project_tenantId_name_key" ON "Project"("tenantId", "name");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "User_aadObjectId_idx" ON "User"("aadObjectId");
CREATE UNIQUE INDEX "User_tenantId_aadObjectId_key" ON "User"("tenantId", "aadObjectId");
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");
CREATE INDEX "ProjectMember_memberTid_memberOid_idx" ON "ProjectMember"("memberTid", "memberOid");
CREATE UNIQUE INDEX "ProjectMember_projectId_memberTid_memberOid_key" ON "ProjectMember"("projectId", "memberTid", "memberOid");

ALTER TABLE "ProjectMember"
ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMember"
ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
