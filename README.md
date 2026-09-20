# Cymru Intelligence

*A clearer view of a stronger Wales.*

A Welsh business intelligence platform. It aggregates trusted public data —
companies, public contracts, planning, funding and economic activity —
normalises it, resolves the same organisation across sources, and makes it
searchable with full provenance.

## The rule this codebase is built around

**No record in this system is ever invented.**

Every row comes from a named publisher and keeps its `source`, `source_id`,
`source_url`, `first_seen_at`, `last_seen_at` and a pointer to the verbatim
payload in `raw_records`. Where an integration has no credentials, the product
says *"Not configured"* and names the missing environment variable. Where a
dataset has no usable structured public feed, it is registered as
*"Unavailable"* with an explanation. Neither case is ever filled in with
placeholder data.

The reference-data seed creates local authorities, sectors, plans and the
source registry — and no companies, contracts, applications or funding schemes.

---

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, Radix primitives |
| Database | PostgreSQL (Supabase), Prisma 7 with the node-postgres driver adapter |
| Auth | Supabase Auth |
| Payments | Stripe (Checkout, Customer Portal, webhooks) |
| Email | Resend |
| Maps | MapLibre GL |
| Search | PostgreSQL full-text search behind a swappable interface |
| Tests | Vitest |

---

## Previewing without any external service

The application runs against nothing but a PostgreSQL database. To see it
working before a single credential exists:

```bash
export DATABASE_URL=postgresql://…/intel
npx prisma migrate deploy
npm run db:seed:reference
npm run db:seed:dev            # synthetic fixtures, refuses to run in production
DEV_AUTH_EMAIL=owner@demo.cymru-intelligence.test npm run dev
```

`db:seed:dev` writes clearly-marked synthetic records — every one carries
`source = "dev_fixture"` and a company number in a range Companies House does
not issue. It refuses to run when `NODE_ENV` is `production` or when the
database already holds real ingested records, and `npm run db:seed:dev --
--clear` removes everything it wrote.

`DEV_AUTH_EMAIL` signs you in as a seeded account without Supabase. It is
gated on `NODE_ENV === "development"`, which Next.js sets only for `next dev`;
a production build inlines `"production"`, so the branch cannot exist in
anything you deploy. The seeded accounts are `owner@`, `analyst@` and `admin@`
at `demo.cymru-intelligence.test`.

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run db:migrate             # applies prisma/migrations
npm run db:seed:reference      # local authorities, sectors, plans, sources
npm run dev
```

### Required to boot

| Variable | Where to get it |
| --- | --- |
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (pooled, port 6543) |
| `DIRECT_URL` | The same page, direct connection (port 5432). Migrations must not go through the pooler. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API. Server-side only — never prefix with `NEXT_PUBLIC_`. |

Everything else is optional. The app runs without it and reports the feature as
unconfigured. See `.env.example` for the full annotated list.

---

## Data sources

| Source | What it provides | Requires | Status without it |
| --- | --- | --- | --- |
| **Companies House** | Company register, officers, PSCs, filings, charges | `COMPANIES_HOUSE_API_KEY` | `NOT_CONFIGURED` — no company data is ingested |
| **Sell2Wales (OCDS)** | Welsh public contract notices and awards | `SELL2WALES_OCDS_BASE` | `NOT_CONFIGURED` — no procurement data is ingested |
| **postcodes.io** | Authoritative postcode → country / authority / coordinates | none | Works out of the box |
| **DataMapWales** | Welsh Government geospatial layers | per-layer config | `NOT_CONFIGURED` until a layer and its licence are added |
| **Planning (25 authorities)** | Planning applications | per-authority feed | `UNAVAILABLE` — see below |
| **Funding** | Grant and support schemes | per-funder feed | `UNAVAILABLE` — see below |

### Companies House

Register a free key at
<https://developer.company-information.service.gov.uk/>. The key is used as the
HTTP Basic username and never reaches the browser. The published rate limit is
600 requests per five minutes; the client enforces this proactively with a
sliding window and honours `Retry-After` if throttled anyway.

Welsh discovery works by walking the advanced-search endpoint across Welsh
location terms. Every candidate is then classified on **address evidence
only** (`src/lib/wales/classification.ts`) — a company's *name* is never
evidence. Cross-border postcodes (CH, SY, HR) are not guessed: they need an
ONS postcode lookup or corroborating address text, otherwise the record is left
`UNKNOWN` and queued for lookup.

### Sell2Wales

Set `SELL2WALES_OCDS_BASE` to the OCDS release-package endpoint. The connector
consumes standard Open Contracting Data Standard releases and follows
`links.next` for pagination, so it works against any conforming publisher
without modification.

### Planning — why it is honest about being incomplete

Wales has **25 planning authorities** (22 unitary authorities plus 3 national
park authorities), each publishing independently. There is no single Welsh
planning API. All 25 are registered in the database so the admin screen can
show a true connected/total count, and every one starts as `UNAVAILABLE` with
a message explaining that a feed must be identified and its licence confirmed
before it can be enabled.

Connecting an authority is a **configuration change, not a deploy**. Each
authority row carries an adapter key, an endpoint and a field map (see
Admin → Planning authorities), and the connector is built from that. The
supported adapters read genuinely machine-readable formats:

| Adapter | Format |
| --- | --- |
| `arcgis_feature_server` | ArcGIS FeatureServer/MapServer `query` endpoint |
| `ckan_datastore` | CKAN `datastore_search` |
| `geojson` | A GeoJSON FeatureCollection |
| `json_array` | A plain JSON array, or `{ records: [...] }` |

`idox_html`, `ocella_html` and `none` are recognised and recorded, but
deliberately **not implemented**. Those portals publish search results as HTML
built for a browser; scraping them would load a public service in a way its
terms do not contemplate, and would break on any redesign. Such an authority is
recorded as unavailable with that reason stated, rather than quietly scraped.

The endpoint is typed into a form by an administrator and then fetched by the
server, which makes it an SSRF surface. `src/lib/http/ssrf.ts` rejects
non-https URLs, embedded credentials, bare IPs, `localhost`, internal suffixes
and every non-routable range (including cloud instance metadata at
169.254.169.254 and its IPv6-mapped form), both when the configuration is
stored and again — after resolving DNS — before each fetch. Being an
administrator is not a reason to allow a request into the internal network.

Only `reference` is a required field in a field map. A field an authority does
not publish stays null; an unmapped status word becomes `UNKNOWN`. Nothing is
inferred from a value that was not published. Grid references (eastings and
northings) are converted to WGS84 via `src/lib/geo/osgb.ts`, which is tested
against Ordnance Survey control points.

*A parser is not a feed*: an authority only becomes `CONNECTED` once its
specific endpoint has been configured and a test run has actually read records
from it. Authorities without one produce no data, and the product says so.

### Funding

Same approach. Funders are enabled individually once a structured feed (API,
RSS, Atom, CSV, JSON) exists and its terms permit automated access. Nothing is
scraped from HTML in breach of a publisher's terms.

---

## Architecture

```
Publisher API
     │
     ▼
 HttpClient          rate limiting · retry · exponential backoff · timeouts
     │
     ▼
 Connector           fetch → validate → normalise (pure, unit-tested)
     │
     ▼
 Runner              deduplicate (content hash) → resolve → store → log
     │                per-record error isolation; a bad record never aborts a run
     ▼
 PostgreSQL          provenance on every row + raw_records + data_change_log
     │
     ▼
 Search / API / UI   every fact rendered with its source
```

### Key modules

| Path | Responsibility |
| --- | --- |
| `src/lib/ingestion/runner.ts` | The pipeline. Transactions, counters, change logging, error isolation. |
| `src/lib/ingestion/source-registry.ts` | What each dataset is, its licence, and whether it is genuinely available. |
| `src/lib/entity-resolution/resolve-company.ts` | Cross-source matching. Prefers company numbers; returns *unresolved* rather than guessing between ambiguous candidates. |
| `src/lib/wales/classification.ts` | Is this record actually Welsh, and where? Address evidence only. |
| `src/lib/search/` | Engine-agnostic search interface with a PostgreSQL implementation. |
| `src/lib/billing/` | Database-backed plans, entitlements, usage metering, Stripe. |
| `src/lib/api/auth.ts` | API key hashing, rate limits, quota enforcement. |

### Entity resolution

Different publishers write the same company differently — `ABC Construction
Ltd`, `ABC CONSTRUCTION LIMITED`, `A.B.C. Construction`. All normalise to
`ABC CONSTRUCTION`.

Resolution order: Companies House number (confidence 1.0) → recorded alias
(0.95) → unique exact normalised name (0.9) → name plus location (0.75) →
trigram fuzzy match (0.6–0.85). When two candidates score within 0.08 of each
other the record is left **unresolved for review**. A wrong link is far more
damaging than a missing one, and the UI shows match confidence wherever a link
was made by name rather than by number.

### Search

PostgreSQL full-text search using expression-based GIN indexes
(`prisma/migrations/20260101000001_search_indexes`). The tsvector expression in
`src/lib/search/companies.ts` must stay identical to the one in that migration,
or the index stops being used. Filters are structured values rather than SQL, so
an Elasticsearch/OpenSearch/Typesense provider can be added later without
touching callers.

---

## Database

```bash
npm run db:migrate         # apply migrations (production)
npm run db:migrate:dev     # create a migration from schema changes (development)
npm run db:generate        # regenerate the Prisma client
npm run db:studio          # browse the data
```

The schema is split across `prisma/schema/*.prisma` by domain. Connection URLs
live in `prisma.config.ts` (a Prisma 7 requirement), and Migrate uses
`DIRECT_URL` because it must not run through a connection pooler.

The search-index migration is hand-written and additive. It also enables the
`pg_trgm` and `btree_gin` extensions, which Supabase permits.

---

## Scheduled jobs

Configured in `vercel.json` and protected by `CRON_SECRET`, compared in
constant time. **If `CRON_SECRET` is unset the endpoints refuse to run** rather
than defaulting to open — an unauthenticated ingestion trigger would let anyone
exhaust the Companies House quota.

| Schedule (UTC) | Endpoint | Purpose |
| --- | --- | --- |
| `0 2 * * *` | `/api/cron/ingest/companies_house_discovery` | Discover and refresh Welsh companies |
| `30 2 * * *` | `/api/cron/enrich-companies` | Officers, PSCs, filings, charges for the stalest companies |
| `0 3 * * *` | `/api/cron/ingest/sell2wales_ocds` | Procurement notices and awards |
| `0 4 * * *` | `/api/cron/ingest-planning` | Every configured planning authority, in turn |
| `0 7 * * *` | `/api/cron/alerts` | Match alerts, notify, email |

Run one by hand:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-app.vercel.app/api/cron/ingest/companies_house_discovery?limit=500"
```

Backfill with `?backfill=true&limit=20000` — this resets the cursor and reads
from the beginning.

Every run is capped by `limit` and resumes from a stored cursor, so a run that
hits the platform's execution limit simply continues next time.

---

## Stripe setup

1. Create products and prices in Stripe for Pro and Business.
2. Set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. Add a webhook endpoint pointing at `/api/webhooks/stripe`, subscribed to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`, `invoice.payment_succeeded`.
4. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
5. In the database (or Admin → Subscriptions), set each plan's
   `stripeProductId`, `stripePriceIdMonthly` and `stripePriceIdYearly`.

Pricing is **not hard-coded**. Plans live in the `plans` table with their
limits as JSON, and checkout reads the price from the database — a user cannot
check out at a price of their choosing.

Subscription state is only ever written from a signature-verified webhook or a
direct Stripe API read. Events are stored by `stripe_event_id` before
processing, so redelivery is a no-op and a failed handler can be replayed.

---

## Admin

Set `ADMIN_BOOTSTRAP_EMAIL` to your address before first sign-in; that account
is promoted to `SUPER_ADMIN` automatically. Afterwards, roles are managed in
Admin → Users.

| Screen | Purpose |
| --- | --- |
| Overview | Live counts and the state of every integration |
| Sources | Every dataset, its licence, sync history, and a manual run trigger |
| Import runs | Per-run counters and cursors |
| Errors | Per-record failures with the stage they failed at |
| Data quality | Duplicates, missing locations, unresolved links, stale records |

---

## API

Authenticated with an API key (Business and Enterprise plans):

```bash
curl -H "Authorization: Bearer ci_live_..." \
  "https://your-app.vercel.app/api/v1/companies?q=manufacturing&region=SOUTH_WALES"
```

| Endpoint | Description |
| --- | --- |
| `GET /api/v1/companies` | Search Welsh companies |
| `GET /api/v1/companies/{companyNumber}` | Full profile with officers, filings, contracts, planning |
| `GET /api/v1/procurement` | Search notices and awards |
| `GET /api/v1/sources` | The source registry, so consumers can see what is connected |

Keys are shown once and stored only as SHA-256 hashes. Rate limits are counted
in the database so they hold across serverless instances. Every response
carries source attribution as the Open Government Licence requires.

---

## Testing

```bash
npm run verify     # typecheck + lint + tests
npm test           # vitest
npm run typecheck
npm run lint
npm run build
```

Tests cover the pure logic that correctness depends on: name normalisation,
Welsh classification, Companies House and OCDS mapping, content hashing and
deduplication, rate limiting and backoff, API key hashing, plan status mapping
and alert scheduling.

---

## Security

- Service role key and all publisher API keys are server-side only.
- Every page and route handler re-checks authorisation. The proxy
  (`src/proxy.ts`) is a first gate, never the only one.
- Subscription state and usage limits are read from the database, never from
  the client.
- API keys are hashed; lookup is by non-secret prefix, comparison is
  constant-time.
- Stripe webhooks are signature-verified before the body is parsed.
- Cron endpoints use a constant-time secret comparison and fail closed.
- Search input is length-capped and passed to `websearch_to_tsquery`, which
  cannot be made to throw on malformed input; all other queries are
  parameterised.
- Audit log for security-relevant and admin actions.

---

## Deployment

1. Create a Supabase project; copy the pooled and direct connection strings.
2. Deploy to Vercel and set the environment variables from `.env.example`.
3. Run `npm run db:migrate` and `npm run db:seed:reference` against production.
4. Add the Stripe webhook endpoint and price IDs.
5. Confirm cron jobs appear in the Vercel dashboard.
6. Sign in with `ADMIN_BOOTSTRAP_EMAIL`, open Admin → Sources, and trigger the
   first sync for each connected source.

---

## Attribution

Cymru Intelligence is an independent service. Using public data published by a
government body does not imply affiliation with or endorsement by that body.

Contains public sector information licensed under the Open Government Licence
v3.0. Postcode data contains OS data © Crown copyright and database right, and
Royal Mail and ONS copyright.
