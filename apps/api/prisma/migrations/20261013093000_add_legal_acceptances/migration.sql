CREATE TABLE "legal_acceptances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "terms_page_id" TEXT NOT NULL,
    "terms_version" INTEGER NOT NULL,
    "terms_content_hash" TEXT NOT NULL,
    "privacy_page_id" TEXT NOT NULL,
    "privacy_version" INTEGER NOT NULL,
    "privacy_content_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "legal_acceptances_user_legal_versions_key"
ON "legal_acceptances"("user_id", "terms_page_id", "terms_version", "privacy_page_id", "privacy_version");

CREATE INDEX "legal_acceptances_user_id_accepted_at_idx"
ON "legal_acceptances"("user_id", "accepted_at");

ALTER TABLE "legal_acceptances"
ADD CONSTRAINT "legal_acceptances_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
