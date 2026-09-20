-- CreateTable
CREATE TABLE "organisation_invitations" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgMemberRole" NOT NULL DEFAULT 'MEMBER',
    "token_hash" TEXT NOT NULL,
    "invited_by_user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisation_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisation_invitations_token_hash_key" ON "organisation_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "organisation_invitations_email_idx" ON "organisation_invitations"("email");

-- CreateIndex
CREATE INDEX "organisation_invitations_expires_at_idx" ON "organisation_invitations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "organisation_invitations_organisation_id_email_key" ON "organisation_invitations"("organisation_id", "email");

-- AddForeignKey
ALTER TABLE "organisation_invitations" ADD CONSTRAINT "organisation_invitations_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_invitations" ADD CONSTRAINT "organisation_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

