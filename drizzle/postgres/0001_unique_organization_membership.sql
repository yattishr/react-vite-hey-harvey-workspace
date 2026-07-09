DELETE FROM "organizationMembers" a
USING "organizationMembers" b
WHERE a."organizationId" = b."organizationId"
  AND a."userId" = b."userId"
  AND a."id" > b."id";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizationMembers_organizationId_userId_unique"
ON "organizationMembers" ("organizationId", "userId");
