-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'DISSOLVED', 'LIQUIDATION', 'RECEIVERSHIP', 'ADMINISTRATION', 'VOLUNTARY_ARRANGEMENT', 'INSOLVENCY_PROCEEDINGS', 'CONVERTED_CLOSED', 'REGISTERED', 'REMOVED', 'CLOSED', 'OPEN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('REGISTERED_OFFICE', 'SERVICE_ADDRESS', 'TRADING', 'CORRESPONDENCE');

-- CreateEnum
CREATE TYPE "CompanyEventType" AS ENUM ('INCORPORATED', 'DISSOLVED', 'STATUS_CHANGED', 'NAME_CHANGED', 'ADDRESS_CHANGED', 'OFFICER_APPOINTED', 'OFFICER_RESIGNED', 'PSC_NOTIFIED', 'PSC_CEASED', 'FILING', 'CHARGE_CREATED', 'CHARGE_SATISFIED', 'ACCOUNTS_DUE', 'PLANNING_APPLICATION', 'CONTRACT_AWARDED', 'CONTRACT_TENDERED', 'FUNDING_AWARDED', 'JOB_POSTED');

-- CreateEnum
CREATE TYPE "WelshConfidence" AS ENUM ('CONFIRMED', 'LIKELY', 'POSSIBLE', 'NOT_WELSH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FundingStatus" AS ENUM ('UPCOMING', 'OPEN', 'CLOSING_SOON', 'CLOSED', 'ONGOING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FundingType" AS ENUM ('GRANT', 'LOAN', 'EQUITY', 'TAX_RELIEF', 'VOUCHER', 'COMPETITION', 'SUPPORT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WelshRegion" AS ENUM ('NORTH_WALES', 'MID_WALES', 'WEST_WALES', 'SOUTH_WALES', 'SOUTH_EAST_WALES', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('COUNTRY', 'REGION', 'LOCAL_AUTHORITY', 'TOWN', 'POSTCODE_DISTRICT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'PRO', 'BUSINESS', 'ENTERPRISE', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "OrgMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'PRO', 'BUSINESS', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'UNPAID', 'PAUSED');

-- CreateEnum
CREATE TYPE "UsageKind" AS ENUM ('SEARCH', 'EXPORT', 'API_CALL', 'REPORT', 'ALERT_RUN', 'SAVED_COMPANY');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('MARKETING_EMAIL', 'TERMS', 'PRIVACY', 'COOKIES');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ALERT', 'SAVED_COMPANY_UPDATE', 'SYSTEM', 'BILLING', 'REPORT_READY');

-- CreateEnum
CREATE TYPE "DataSourceCategory" AS ENUM ('COMPANIES', 'PROCUREMENT', 'PLANNING', 'FUNDING', 'GEOSPATIAL', 'JOBS', 'INFRASTRUCTURE', 'ECONOMIC');

-- CreateEnum
CREATE TYPE "DataSourceStatus" AS ENUM ('CONNECTED', 'NOT_CONFIGURED', 'UNAVAILABLE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportTrigger" AS ENUM ('CRON', 'MANUAL', 'BACKFILL', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "ImportStage" AS ENUM ('FETCH', 'VALIDATE', 'NORMALISE', 'DEDUPLICATE', 'RESOLVE', 'STORE', 'INDEX');

-- CreateEnum
CREATE TYPE "PlanningStatus" AS ENUM ('SUBMITTED', 'VALIDATED', 'PENDING', 'UNDER_CONSIDERATION', 'APPROVED', 'APPROVED_WITH_CONDITIONS', 'REFUSED', 'WITHDRAWN', 'APPEAL', 'DECIDED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PlanningCategory" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'RETAIL', 'ENERGY', 'INFRASTRUCTURE', 'LEISURE', 'AGRICULTURAL', 'MIXED_USE', 'CHANGE_OF_USE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProcurementNoticeType" AS ENUM ('PRIOR_INFORMATION', 'TENDER', 'CONTRACT_AWARD', 'QUOTATION', 'FRAMEWORK', 'MODIFICATION', 'CONTRACT_IMPLEMENTATION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProcurementStatus" AS ENUM ('PLANNING', 'ACTIVE', 'CLOSED', 'AWARDED', 'CANCELLED', 'UNSUCCESSFUL', 'COMPLETE', 'WITHDRAWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('COMPANY', 'PLANNING', 'PROCUREMENT', 'FUNDING', 'JOB', 'INFRASTRUCTURE');

-- CreateEnum
CREATE TYPE "AlertFrequency" AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('COMPANY', 'REGIONAL', 'SECTOR', 'PLANNING', 'PROCUREMENT', 'FUNDING');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('QUEUED', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'CSV', 'XLSX');

-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "company_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalised_name" TEXT NOT NULL,
    "previous_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CompanyStatus" NOT NULL DEFAULT 'UNKNOWN',
    "status_detail" TEXT,
    "company_type" TEXT,
    "jurisdiction" TEXT,
    "incorporated_on" TIMESTAMP(3),
    "dissolved_on" TIMESTAMP(3),
    "is_welsh" BOOLEAN NOT NULL DEFAULT false,
    "welsh_confidence" "WelshConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "welsh_evidence" TEXT,
    "country" TEXT,
    "region" "WelshRegion",
    "local_authority_id" TEXT,
    "town" TEXT,
    "postcode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sic_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primary_sector_id" TEXT,
    "accounts_last_made_up_to" TIMESTAMP(3),
    "accounts_next_due" TIMESTAMP(3),
    "accounts_category" TEXT,
    "confirmation_statement_next_due" TIMESTAMP(3),
    "size_band" TEXT,
    "has_insolvency_history" BOOLEAN NOT NULL DEFAULT false,
    "has_charges" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'companies_house',
    "source_id" TEXT NOT NULL,
    "source_url" TEXT,
    "raw_record_id" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_updated_at" TIMESTAMP(3),
    "detail_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_addresses" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "AddressType" NOT NULL DEFAULT 'REGISTERED_OFFICE',
    "care_of" TEXT,
    "premises" TEXT,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "locality" TEXT,
    "region_text" TEXT,
    "postcode" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'companies_house',
    "source_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_officers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "officer_id" TEXT,
    "name" TEXT NOT NULL,
    "normalised_name" TEXT NOT NULL,
    "role" TEXT,
    "appointed_on" TIMESTAMP(3),
    "resigned_on" TIMESTAMP(3),
    "nationality" TEXT,
    "country_of_residence" TEXT,
    "occupation" TEXT,
    "dob_month" INTEGER,
    "dob_year" INTEGER,
    "address_locality" TEXT,
    "address_postcode" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'companies_house',
    "source_id" TEXT NOT NULL,
    "source_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_officers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_pscs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalised_name" TEXT NOT NULL,
    "kind" TEXT,
    "natures_of_control" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notified_on" TIMESTAMP(3),
    "ceased_on" TIMESTAMP(3),
    "nationality" TEXT,
    "country_of_residence" TEXT,
    "dob_month" INTEGER,
    "dob_year" INTEGER,
    "psc_company_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'companies_house',
    "source_id" TEXT NOT NULL,
    "source_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_pscs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_filings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
    "type" TEXT,
    "description" TEXT,
    "description_values" JSONB,
    "date" TIMESTAMP(3),
    "pages" INTEGER,
    "document_url" TEXT,
    "source" TEXT NOT NULL DEFAULT 'companies_house',
    "source_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_filings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_charges" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "charge_code" TEXT,
    "classification" TEXT,
    "status" TEXT,
    "created_on" TIMESTAMP(3),
    "delivered_on" TIMESTAMP(3),
    "satisfied_on" TIMESTAMP(3),
    "persons_entitled" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "amount_secured" TEXT,
    "particulars" TEXT,
    "source" TEXT NOT NULL DEFAULT 'companies_house',
    "source_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_events" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "CompanyEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "source_entity_type" TEXT,
    "source_entity_id" TEXT,
    "source" TEXT NOT NULL,
    "source_url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_industries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sic_code_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "company_industries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_aliases" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalised_alias" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_links" (
    "id" TEXT NOT NULL,
    "from_type" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_type" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "method" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_organisations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT,
    "website" TEXT,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "source_id" TEXT,
    "source_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funding_organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_opportunities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organisation_id" TEXT,
    "organisation_name" TEXT,
    "description" TEXT,
    "summary" TEXT,
    "type" "FundingType" NOT NULL DEFAULT 'UNKNOWN',
    "status" "FundingStatus" NOT NULL DEFAULT 'UNKNOWN',
    "amount_min" DECIMAL(16,2),
    "amount_max" DECIMAL(16,2),
    "total_fund_pot" DECIMAL(16,2),
    "currency" TEXT DEFAULT 'GBP',
    "opens_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "eligibility" TEXT,
    "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "business_stage" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "application_url" TEXT,
    "source" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT,
    "raw_record_id" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_checked_at" TIMESTAMP(3),
    "source_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funding_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_awards" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT,
    "recipient_name" TEXT NOT NULL,
    "recipient_normalised_name" TEXT NOT NULL,
    "resolved_company_id" TEXT,
    "resolution_confidence" DOUBLE PRECISION,
    "amount" DECIMAL(16,2),
    "currency" TEXT DEFAULT 'GBP',
    "awarded_at" TIMESTAMP(3),
    "purpose" TEXT,
    "source" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funding_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "employer_name" TEXT NOT NULL,
    "employer_normalised_name" TEXT NOT NULL,
    "company_id" TEXT,
    "description" TEXT,
    "location_text" TEXT,
    "postcode" TEXT,
    "local_authority_id" TEXT,
    "region" "WelshRegion",
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "salary_min" DECIMAL(12,2),
    "salary_max" DECIMAL(12,2),
    "salary_period" TEXT,
    "contract_type" TEXT,
    "posted_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "application_url" TEXT,
    "source" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "infrastructure_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" TEXT,
    "value_amount" DECIMAL(16,2),
    "currency" TEXT DEFAULT 'GBP',
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "promoter_name" TEXT,
    "local_authority_id" TEXT,
    "region" "WelshRegion",
    "postcode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "infrastructure_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "code" TEXT,
    "parent_id" TEXT,
    "region" "WelshRegion",
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_authorities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "welsh_name" TEXT,
    "slug" TEXT NOT NULL,
    "gss_code" TEXT NOT NULL,
    "region" "WelshRegion" NOT NULL DEFAULT 'UNKNOWN',
    "website_url" TEXT,
    "planning_portal_url" TEXT,
    "centroid_lat" DOUBLE PRECISION,
    "centroid_lng" DOUBLE PRECISION,
    "population" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_authorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectors" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sic_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sector_id" TEXT,

    CONSTRAINT "sic_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geocode_cache" (
    "id" TEXT NOT NULL,
    "query_hash" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "precision" TEXT,
    "provider" TEXT NOT NULL,
    "hit" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "auth_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "job_title" TEXT,
    "phone" TEXT,
    "avatar_url" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "onboarded_at" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "email_alerts" BOOLEAN NOT NULL DEFAULT true,
    "email_digest" BOOLEAN NOT NULL DEFAULT true,
    "email_product" BOOLEAN NOT NULL DEFAULT true,
    "organisation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "company_number" TEXT,
    "website" TEXT,
    "billing_email" TEXT,
    "vat_number" TEXT,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'GB',
    "stripe_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation_members" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrgMemberRole" NOT NULL DEFAULT 'MEMBER',
    "invited_email" TEXT,
    "invited_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisation_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" "PlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_monthly_pence" INTEGER,
    "price_yearly_pence" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "stripe_product_id" TEXT,
    "stripe_price_id_monthly" TEXT,
    "stripe_price_id_yearly" TEXT,
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT,
    "user_id" TEXT,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "stripe_event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "organisation_id" TEXT,
    "api_key_id" TEXT,
    "kind" "UsageKind" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hashed_key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organisation_id" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 60,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "emailed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "business_name" TEXT,
    "industry" TEXT,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'landing_page',
    "ip_hash" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "unsubscribe_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT,
    "type" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "version" TEXT NOT NULL,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_subject_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "storage_path" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "category" "DataSourceCategory" NOT NULL,
    "description" TEXT,
    "homepage_url" TEXT,
    "docs_url" TEXT,
    "licence" TEXT,
    "licence_url" TEXT,
    "usage_restrictions" TEXT,
    "update_frequency" TEXT,
    "schedule" TEXT,
    "required_env_vars" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "DataSourceStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "status_message" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "last_run_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_checked_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_runs" (
    "id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "connector_key" TEXT NOT NULL,
    "status" "ImportRunStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" "ImportTrigger" NOT NULL DEFAULT 'CRON',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "records_fetched" INTEGER NOT NULL DEFAULT 0,
    "records_created" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "records_skipped" INTEGER NOT NULL DEFAULT 0,
    "records_rejected" INTEGER NOT NULL DEFAULT 0,
    "cursor_before" TEXT,
    "cursor_after" TEXT,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "triggered_by_user_id" TEXT,

    CONSTRAINT "data_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_errors" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "stage" "ImportStage" NOT NULL,
    "source_record_id" TEXT,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_change_log" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "data_source_id" TEXT,
    "run_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_change_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_records" (
    "id" TEXT NOT NULL,
    "data_source_id" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "http_cache_entries" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "etag" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "http_cache_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_authorities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "local_authority_id" TEXT,
    "data_source_id" TEXT,
    "connector_key" TEXT,
    "portal_url" TEXT,
    "search_url" TEXT,
    "data_format" TEXT,
    "licence" TEXT,
    "status" "DataSourceStatus" NOT NULL DEFAULT 'UNAVAILABLE',
    "status_message" TEXT,
    "last_success_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planning_authorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_applications" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "authority_id" TEXT NOT NULL,
    "local_authority_id" TEXT,
    "site_address" TEXT,
    "postcode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "easting" INTEGER,
    "northing" INTEGER,
    "description" TEXT,
    "application_type" TEXT,
    "category" "PlanningCategory" NOT NULL DEFAULT 'UNKNOWN',
    "status" "PlanningStatus" NOT NULL DEFAULT 'UNKNOWN',
    "decision" TEXT,
    "submitted_on" TIMESTAMP(3),
    "validated_on" TIMESTAMP(3),
    "consultation_ends_on" TIMESTAMP(3),
    "decided_on" TIMESTAMP(3),
    "appeal_decided_on" TIMESTAMP(3),
    "applicant_name" TEXT,
    "applicant_normalised_name" TEXT,
    "agent_name" TEXT,
    "agent_normalised_name" TEXT,
    "resolved_company_id" TEXT,
    "resolution_confidence" DOUBLE PRECISION,
    "dwelling_count" INTEGER,
    "floor_space_sqm" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT,
    "raw_record_id" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planning_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_documents" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "title" TEXT,
    "document_type" TEXT,
    "url" TEXT NOT NULL,
    "published_on" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_buyers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalised_name" TEXT NOT NULL,
    "identifier_scheme" TEXT,
    "identifier_id" TEXT,
    "company_number" TEXT,
    "resolved_company_id" TEXT,
    "resolution_confidence" DOUBLE PRECISION,
    "contact_email" TEXT,
    "website" TEXT,
    "address_locality" TEXT,
    "postcode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'sell2wales',
    "source_id" TEXT NOT NULL,
    "source_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalised_name" TEXT NOT NULL,
    "identifier_scheme" TEXT,
    "identifier_id" TEXT,
    "company_number" TEXT,
    "resolved_company_id" TEXT,
    "resolution_confidence" DOUBLE PRECISION,
    "is_sme" BOOLEAN,
    "address_locality" TEXT,
    "postcode" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'sell2wales',
    "source_id" TEXT NOT NULL,
    "source_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_notices" (
    "id" TEXT NOT NULL,
    "ocid" TEXT NOT NULL,
    "notice_id" TEXT NOT NULL,
    "type" "ProcurementNoticeType" NOT NULL DEFAULT 'UNKNOWN',
    "status" "ProcurementStatus" NOT NULL DEFAULT 'UNKNOWN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "buyer_id" TEXT,
    "value_amount" DECIMAL(16,2),
    "value_currency" TEXT,
    "value_amount_min" DECIMAL(16,2),
    "value_amount_max" DECIMAL(16,2),
    "published_at" TIMESTAMP(3),
    "deadline_at" TIMESTAMP(3),
    "contract_start_at" TIMESTAMP(3),
    "contract_end_at" TIMESTAMP(3),
    "cpv_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "procurement_method" TEXT,
    "delivery_locality" TEXT,
    "postcode" TEXT,
    "local_authority_id" TEXT,
    "region" "WelshRegion",
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'sell2wales',
    "source_id" TEXT NOT NULL,
    "source_url" TEXT,
    "raw_record_id" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_awards" (
    "id" TEXT NOT NULL,
    "notice_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "award_id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "status" "ProcurementStatus" NOT NULL DEFAULT 'UNKNOWN',
    "value_amount" DECIMAL(16,2),
    "value_currency" TEXT,
    "awarded_at" TIMESTAMP(3),
    "contract_start_at" TIMESTAMP(3),
    "contract_end_at" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'sell2wales',
    "source_url" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_documents" (
    "id" TEXT NOT NULL,
    "notice_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "document_type" TEXT,
    "url" TEXT NOT NULL,
    "format" TEXT,
    "published_at" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'sell2wales',
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_companies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "query" TEXT,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "query" TEXT,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "frequency" "AlertFrequency" NOT NULL DEFAULT 'DAILY',
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "watermark" TIMESTAMP(3),
    "match_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organisation_id" TEXT,
    "type" "ReportType" NOT NULL,
    "title" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "status" "ReportStatus" NOT NULL DEFAULT 'QUEUED',
    "data" JSONB,
    "data_as_of" TIMESTAMP(3),
    "sources_used" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_exports" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "storage_path" TEXT,
    "size_bytes" INTEGER,
    "row_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT,
    "body_markdown" TEXT,
    "hero_image_url" TEXT,
    "status" "InsightStatus" NOT NULL DEFAULT 'DRAFT',
    "author_user_id" TEXT,
    "data_as_of" TIMESTAMP(3),
    "queries" JSONB NOT NULL DEFAULT '[]',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "sources_used" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_company_number_key" ON "companies"("company_number");

-- CreateIndex
CREATE INDEX "companies_normalised_name_idx" ON "companies"("normalised_name");

-- CreateIndex
CREATE INDEX "companies_is_welsh_status_idx" ON "companies"("is_welsh", "status");

-- CreateIndex
CREATE INDEX "companies_region_idx" ON "companies"("region");

-- CreateIndex
CREATE INDEX "companies_local_authority_id_idx" ON "companies"("local_authority_id");

-- CreateIndex
CREATE INDEX "companies_postcode_idx" ON "companies"("postcode");

-- CreateIndex
CREATE INDEX "companies_primary_sector_id_idx" ON "companies"("primary_sector_id");

-- CreateIndex
CREATE INDEX "companies_incorporated_on_idx" ON "companies"("incorporated_on");

-- CreateIndex
CREATE INDEX "companies_latitude_longitude_idx" ON "companies"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "company_addresses_company_id_idx" ON "company_addresses"("company_id");

-- CreateIndex
CREATE INDEX "company_addresses_postcode_idx" ON "company_addresses"("postcode");

-- CreateIndex
CREATE INDEX "company_officers_normalised_name_idx" ON "company_officers"("normalised_name");

-- CreateIndex
CREATE INDEX "company_officers_company_id_is_active_idx" ON "company_officers"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "company_officers_company_id_source_id_key" ON "company_officers"("company_id", "source_id");

-- CreateIndex
CREATE INDEX "company_pscs_normalised_name_idx" ON "company_pscs"("normalised_name");

-- CreateIndex
CREATE UNIQUE INDEX "company_pscs_company_id_source_id_key" ON "company_pscs"("company_id", "source_id");

-- CreateIndex
CREATE INDEX "company_filings_company_id_date_idx" ON "company_filings"("company_id", "date");

-- CreateIndex
CREATE INDEX "company_filings_category_idx" ON "company_filings"("category");

-- CreateIndex
CREATE UNIQUE INDEX "company_filings_company_id_transaction_id_key" ON "company_filings"("company_id", "transaction_id");

-- CreateIndex
CREATE INDEX "company_charges_company_id_created_on_idx" ON "company_charges"("company_id", "created_on");

-- CreateIndex
CREATE UNIQUE INDEX "company_charges_company_id_charge_id_key" ON "company_charges"("company_id", "charge_id");

-- CreateIndex
CREATE INDEX "company_events_company_id_occurred_at_idx" ON "company_events"("company_id", "occurred_at");

-- CreateIndex
CREATE INDEX "company_events_type_idx" ON "company_events"("type");

-- CreateIndex
CREATE UNIQUE INDEX "company_events_company_id_type_occurred_at_source_entity_id_key" ON "company_events"("company_id", "type", "occurred_at", "source_entity_id");

-- CreateIndex
CREATE INDEX "company_industries_sic_code_id_idx" ON "company_industries"("sic_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_industries_company_id_sic_code_id_key" ON "company_industries"("company_id", "sic_code_id");

-- CreateIndex
CREATE INDEX "company_aliases_normalised_alias_idx" ON "company_aliases"("normalised_alias");

-- CreateIndex
CREATE UNIQUE INDEX "company_aliases_company_id_normalised_alias_key" ON "company_aliases"("company_id", "normalised_alias");

-- CreateIndex
CREATE INDEX "entity_links_from_type_from_id_idx" ON "entity_links"("from_type", "from_id");

-- CreateIndex
CREATE INDEX "entity_links_to_type_to_id_idx" ON "entity_links"("to_type", "to_id");

-- CreateIndex
CREATE INDEX "entity_links_relation_idx" ON "entity_links"("relation");

-- CreateIndex
CREATE UNIQUE INDEX "entity_links_from_type_from_id_to_type_to_id_relation_key" ON "entity_links"("from_type", "from_id", "to_type", "to_id", "relation");

-- CreateIndex
CREATE UNIQUE INDEX "funding_organisations_slug_key" ON "funding_organisations"("slug");

-- CreateIndex
CREATE INDEX "funding_opportunities_status_closes_at_idx" ON "funding_opportunities"("status", "closes_at");

-- CreateIndex
CREATE INDEX "funding_opportunities_opens_at_idx" ON "funding_opportunities"("opens_at");

-- CreateIndex
CREATE INDEX "funding_opportunities_organisation_id_idx" ON "funding_opportunities"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "funding_opportunities_source_source_id_key" ON "funding_opportunities"("source", "source_id");

-- CreateIndex
CREATE INDEX "funding_awards_recipient_normalised_name_idx" ON "funding_awards"("recipient_normalised_name");

-- CreateIndex
CREATE INDEX "funding_awards_resolved_company_id_idx" ON "funding_awards"("resolved_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "funding_awards_source_source_id_key" ON "funding_awards"("source", "source_id");

-- CreateIndex
CREATE INDEX "jobs_posted_at_idx" ON "jobs"("posted_at");

-- CreateIndex
CREATE INDEX "jobs_company_id_idx" ON "jobs"("company_id");

-- CreateIndex
CREATE INDEX "jobs_local_authority_id_idx" ON "jobs"("local_authority_id");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_source_source_id_key" ON "jobs"("source", "source_id");

-- CreateIndex
CREATE INDEX "infrastructure_projects_local_authority_id_idx" ON "infrastructure_projects"("local_authority_id");

-- CreateIndex
CREATE UNIQUE INDEX "infrastructure_projects_source_source_id_key" ON "infrastructure_projects"("source", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "locations_slug_key" ON "locations"("slug");

-- CreateIndex
CREATE INDEX "locations_parent_id_idx" ON "locations"("parent_id");

-- CreateIndex
CREATE INDEX "locations_type_idx" ON "locations"("type");

-- CreateIndex
CREATE UNIQUE INDEX "locations_type_code_key" ON "locations"("type", "code");

-- CreateIndex
CREATE UNIQUE INDEX "local_authorities_slug_key" ON "local_authorities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "local_authorities_gss_code_key" ON "local_authorities"("gss_code");

-- CreateIndex
CREATE INDEX "local_authorities_region_idx" ON "local_authorities"("region");

-- CreateIndex
CREATE UNIQUE INDEX "sectors_code_key" ON "sectors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sectors_slug_key" ON "sectors"("slug");

-- CreateIndex
CREATE INDEX "sectors_parent_id_idx" ON "sectors"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "sic_codes_code_key" ON "sic_codes"("code");

-- CreateIndex
CREATE INDEX "sic_codes_sector_id_idx" ON "sic_codes"("sector_id");

-- CreateIndex
CREATE UNIQUE INDEX "geocode_cache_query_hash_key" ON "geocode_cache"("query_hash");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_id_key" ON "users"("auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organisation_id_idx" ON "users"("organisation_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "organisations_slug_key" ON "organisations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organisations_stripe_customer_id_key" ON "organisations"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "organisation_members_user_id_idx" ON "organisation_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organisation_members_organisation_id_user_id_key" ON "organisation_members"("organisation_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_organisation_id_idx" ON "subscriptions"("organisation_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_stripe_event_id_key" ON "billing_events"("stripe_event_id");

-- CreateIndex
CREATE INDEX "billing_events_type_idx" ON "billing_events"("type");

-- CreateIndex
CREATE INDEX "billing_events_processed_at_idx" ON "billing_events"("processed_at");

-- CreateIndex
CREATE INDEX "usage_events_user_id_kind_created_at_idx" ON "usage_events"("user_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "usage_events_organisation_id_kind_created_at_idx" ON "usage_events"("organisation_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "usage_events_created_at_idx" ON "usage_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_prefix_key" ON "api_keys"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hashed_key_key" ON "api_keys"("hashed_key");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_organisation_id_idx" ON "api_keys"("organisation_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_token_key" ON "newsletter_subscribers"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_created_at_idx" ON "newsletter_subscribers"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "consent_records_user_id_type_idx" ON "consent_records"("user_id", "type");

-- CreateIndex
CREATE INDEX "data_subject_requests_user_id_idx" ON "data_subject_requests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_key_key" ON "data_sources"("key");

-- CreateIndex
CREATE INDEX "data_sources_category_idx" ON "data_sources"("category");

-- CreateIndex
CREATE INDEX "data_sources_status_idx" ON "data_sources"("status");

-- CreateIndex
CREATE INDEX "data_import_runs_data_source_id_started_at_idx" ON "data_import_runs"("data_source_id", "started_at");

-- CreateIndex
CREATE INDEX "data_import_runs_status_idx" ON "data_import_runs"("status");

-- CreateIndex
CREATE INDEX "data_import_errors_run_id_idx" ON "data_import_errors"("run_id");

-- CreateIndex
CREATE INDEX "data_import_errors_stage_idx" ON "data_import_errors"("stage");

-- CreateIndex
CREATE INDEX "data_change_log_entity_type_entity_id_changed_at_idx" ON "data_change_log"("entity_type", "entity_id", "changed_at");

-- CreateIndex
CREATE INDEX "data_change_log_changed_at_idx" ON "data_change_log"("changed_at");

-- CreateIndex
CREATE INDEX "raw_records_data_source_id_source_record_id_idx" ON "raw_records"("data_source_id", "source_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_records_data_source_id_source_record_id_content_hash_key" ON "raw_records"("data_source_id", "source_record_id", "content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "http_cache_entries_cache_key_key" ON "http_cache_entries"("cache_key");

-- CreateIndex
CREATE INDEX "http_cache_entries_expires_at_idx" ON "http_cache_entries"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "planning_authorities_slug_key" ON "planning_authorities"("slug");

-- CreateIndex
CREATE INDEX "planning_authorities_status_idx" ON "planning_authorities"("status");

-- CreateIndex
CREATE INDEX "planning_applications_status_submitted_on_idx" ON "planning_applications"("status", "submitted_on");

-- CreateIndex
CREATE INDEX "planning_applications_local_authority_id_idx" ON "planning_applications"("local_authority_id");

-- CreateIndex
CREATE INDEX "planning_applications_postcode_idx" ON "planning_applications"("postcode");

-- CreateIndex
CREATE INDEX "planning_applications_latitude_longitude_idx" ON "planning_applications"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "planning_applications_resolved_company_id_idx" ON "planning_applications"("resolved_company_id");

-- CreateIndex
CREATE INDEX "planning_applications_applicant_normalised_name_idx" ON "planning_applications"("applicant_normalised_name");

-- CreateIndex
CREATE UNIQUE INDEX "planning_applications_authority_id_reference_key" ON "planning_applications"("authority_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "planning_applications_source_source_id_key" ON "planning_applications"("source", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "planning_documents_application_id_document_id_key" ON "planning_documents"("application_id", "document_id");

-- CreateIndex
CREATE INDEX "procurement_buyers_normalised_name_idx" ON "procurement_buyers"("normalised_name");

-- CreateIndex
CREATE INDEX "procurement_buyers_resolved_company_id_idx" ON "procurement_buyers"("resolved_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_buyers_source_source_id_key" ON "procurement_buyers"("source", "source_id");

-- CreateIndex
CREATE INDEX "procurement_suppliers_normalised_name_idx" ON "procurement_suppliers"("normalised_name");

-- CreateIndex
CREATE INDEX "procurement_suppliers_resolved_company_id_idx" ON "procurement_suppliers"("resolved_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_suppliers_source_source_id_key" ON "procurement_suppliers"("source", "source_id");

-- CreateIndex
CREATE INDEX "procurement_notices_ocid_idx" ON "procurement_notices"("ocid");

-- CreateIndex
CREATE INDEX "procurement_notices_published_at_idx" ON "procurement_notices"("published_at");

-- CreateIndex
CREATE INDEX "procurement_notices_status_published_at_idx" ON "procurement_notices"("status", "published_at");

-- CreateIndex
CREATE INDEX "procurement_notices_value_amount_idx" ON "procurement_notices"("value_amount");

-- CreateIndex
CREATE INDEX "procurement_notices_buyer_id_idx" ON "procurement_notices"("buyer_id");

-- CreateIndex
CREATE INDEX "procurement_notices_local_authority_id_idx" ON "procurement_notices"("local_authority_id");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_notices_source_source_id_key" ON "procurement_notices"("source", "source_id");

-- CreateIndex
CREATE INDEX "procurement_awards_supplier_id_idx" ON "procurement_awards"("supplier_id");

-- CreateIndex
CREATE INDEX "procurement_awards_awarded_at_idx" ON "procurement_awards"("awarded_at");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_awards_notice_id_award_id_key" ON "procurement_awards"("notice_id", "award_id");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_documents_notice_id_document_id_key" ON "procurement_documents"("notice_id", "document_id");

-- CreateIndex
CREATE INDEX "saved_companies_company_id_idx" ON "saved_companies"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_companies_user_id_company_id_key" ON "saved_companies"("user_id", "company_id");

-- CreateIndex
CREATE INDEX "saved_searches_user_id_idx" ON "saved_searches"("user_id");

-- CreateIndex
CREATE INDEX "alerts_user_id_idx" ON "alerts"("user_id");

-- CreateIndex
CREATE INDEX "alerts_is_active_next_run_at_idx" ON "alerts"("is_active", "next_run_at");

-- CreateIndex
CREATE INDEX "alert_events_alert_id_created_at_idx" ON "alert_events"("alert_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "alert_events_alert_id_entityType_entity_id_key" ON "alert_events"("alert_id", "entityType", "entity_id");

-- CreateIndex
CREATE INDEX "reports_user_id_created_at_idx" ON "reports"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "report_exports_report_id_idx" ON "report_exports"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "insights_slug_key" ON "insights"("slug");

-- CreateIndex
CREATE INDEX "insights_status_published_at_idx" ON "insights"("status", "published_at");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_local_authority_id_fkey" FOREIGN KEY ("local_authority_id") REFERENCES "local_authorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_primary_sector_id_fkey" FOREIGN KEY ("primary_sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_addresses" ADD CONSTRAINT "company_addresses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_officers" ADD CONSTRAINT "company_officers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_pscs" ADD CONSTRAINT "company_pscs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_filings" ADD CONSTRAINT "company_filings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_charges" ADD CONSTRAINT "company_charges_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_industries" ADD CONSTRAINT "company_industries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_industries" ADD CONSTRAINT "company_industries_sic_code_id_fkey" FOREIGN KEY ("sic_code_id") REFERENCES "sic_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_aliases" ADD CONSTRAINT "company_aliases_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_opportunities" ADD CONSTRAINT "funding_opportunities_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "funding_organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_awards" ADD CONSTRAINT "funding_awards_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "funding_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_awards" ADD CONSTRAINT "funding_awards_resolved_company_id_fkey" FOREIGN KEY ("resolved_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_local_authority_id_fkey" FOREIGN KEY ("local_authority_id") REFERENCES "local_authorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "infrastructure_projects" ADD CONSTRAINT "infrastructure_projects_local_authority_id_fkey" FOREIGN KEY ("local_authority_id") REFERENCES "local_authorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sic_codes" ADD CONSTRAINT "sic_codes_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_runs" ADD CONSTRAINT "data_import_runs_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_errors" ADD CONSTRAINT "data_import_errors_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "data_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_change_log" ADD CONSTRAINT "data_change_log_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_change_log" ADD CONSTRAINT "data_change_log_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "data_import_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_authorities" ADD CONSTRAINT "planning_authorities_local_authority_id_fkey" FOREIGN KEY ("local_authority_id") REFERENCES "local_authorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_authorities" ADD CONSTRAINT "planning_authorities_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_applications" ADD CONSTRAINT "planning_applications_authority_id_fkey" FOREIGN KEY ("authority_id") REFERENCES "planning_authorities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_applications" ADD CONSTRAINT "planning_applications_local_authority_id_fkey" FOREIGN KEY ("local_authority_id") REFERENCES "local_authorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_applications" ADD CONSTRAINT "planning_applications_resolved_company_id_fkey" FOREIGN KEY ("resolved_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_documents" ADD CONSTRAINT "planning_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "planning_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_buyers" ADD CONSTRAINT "procurement_buyers_resolved_company_id_fkey" FOREIGN KEY ("resolved_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_suppliers" ADD CONSTRAINT "procurement_suppliers_resolved_company_id_fkey" FOREIGN KEY ("resolved_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_notices" ADD CONSTRAINT "procurement_notices_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "procurement_buyers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_notices" ADD CONSTRAINT "procurement_notices_local_authority_id_fkey" FOREIGN KEY ("local_authority_id") REFERENCES "local_authorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_awards" ADD CONSTRAINT "procurement_awards_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "procurement_notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_awards" ADD CONSTRAINT "procurement_awards_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "procurement_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_documents" ADD CONSTRAINT "procurement_documents_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "procurement_notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_companies" ADD CONSTRAINT "saved_companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_companies" ADD CONSTRAINT "saved_companies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

