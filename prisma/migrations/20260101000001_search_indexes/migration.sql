-- Full-text search and fuzzy entity-matching support.
--
-- These objects are maintained by hand rather than by `prisma migrate dev`,
-- because Prisma has no first-class representation for expression indexes.
-- They are deliberately implemented as EXPRESSION indexes (not generated
-- columns) so the Prisma schema stays the single source of truth for columns.
--
-- The trade-off: `prisma migrate diff` cannot see these indexes in the schema,
-- so it reports them as drift for ever. CI therefore gates on
-- `prisma migrate status` and prints the diff as information only. When you
-- read that diff, anything OTHER than the indexes below is a missing
-- migration.
--
-- The search layer in src/lib/search/ builds tsquery expressions
-- that match these index expressions exactly. If you change an expression
-- here, change it there too, or the index will stop being used.

-- pg_trgm powers similarity() / % matching used by entity resolution when no
-- company number is available.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- btree_gin lets us combine scalar columns with GIN text indexes.
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- array_to_string is marked STABLE rather than IMMUTABLE, so PostgreSQL
-- refuses it inside an index expression ("functions in index expression must
-- be marked IMMUTABLE"). For a text[] with a constant text separator the
-- result genuinely does not depend on any setting, so this wrapper asserts
-- that. The search layer must call this function, not array_to_string, or the
-- expression will not match the index.
CREATE OR REPLACE FUNCTION immutable_array_to_string(text[], text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  RETURNS NULL ON NULL INPUT
AS $$ SELECT array_to_string($1, $2) $$;

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "companies_fts_idx" ON "companies" USING GIN (
  (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("company_number", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("town", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("postcode", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(immutable_array_to_string("previous_names", ' '), '')), 'C')
  )
);

CREATE INDEX IF NOT EXISTS "companies_normalised_name_trgm_idx"
  ON "companies" USING GIN ("normalised_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "company_aliases_normalised_trgm_idx"
  ON "company_aliases" USING GIN ("normalised_alias" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "company_officers_normalised_name_trgm_idx"
  ON "company_officers" USING GIN ("normalised_name" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Planning applications
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "planning_applications_fts_idx" ON "planning_applications" USING GIN (
  (
    setweight(to_tsvector('english', coalesce("reference", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("site_address", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("postcode", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("applicant_name", '')), 'C')
  )
);

CREATE INDEX IF NOT EXISTS "planning_applicant_trgm_idx"
  ON "planning_applications" USING GIN ("applicant_normalised_name" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Procurement notices
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "procurement_notices_fts_idx" ON "procurement_notices" USING GIN (
  (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("delivery_locality", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(immutable_array_to_string("cpv_codes", ' '), '')), 'C')
  )
);

CREATE INDEX IF NOT EXISTS "procurement_suppliers_normalised_trgm_idx"
  ON "procurement_suppliers" USING GIN ("normalised_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "procurement_buyers_normalised_trgm_idx"
  ON "procurement_buyers" USING GIN ("normalised_name" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Funding opportunities
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "funding_opportunities_fts_idx" ON "funding_opportunities" USING GIN (
  (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("organisation_name", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("summary", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'C')
  )
);

-- ---------------------------------------------------------------------------
-- Jobs and infrastructure
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "jobs_fts_idx" ON "jobs" USING GIN (
  (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("employer_name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("location_text", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'C')
  )
);

CREATE INDEX IF NOT EXISTS "infrastructure_fts_idx" ON "infrastructure_projects" USING GIN (
  (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  )
);
