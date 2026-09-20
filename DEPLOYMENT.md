# Going live

The target this repository is built for is **Vercel + Supabase**: `vercel.json`
already carries the cron schedule, and `.env.example` documents Supabase's
pooled and direct connection strings. Nothing here is Vercel-specific beyond
the cron file — any Node host that can run `next start` and hit the database
works, but you would need to replace the crons with your own scheduler.

Work through the stages in order. Each one ends with something you can check,
so you find out a stage failed before it matters.

---

## Stage 0 — Before you start

You need accounts for: **Supabase**, **Vercel**, **Companies House** (free),
and later **Stripe** and **Resend**. Only the first three are needed to have
something working; billing and email can follow.

Decide the production domain now — Supabase Auth and Stripe both need it, and
changing it later means revisiting both.

---

## Stage 1 — Database

1. Create a Supabase project in a region close to your users (London,
   `eu-west-2`, for a Welsh audience). Save the database password it shows you
   once.
2. From **Project Settings → Database → Connection string**, take both:
   - the **Transaction pooler** URI (port `6543`) → `DATABASE_URL`, with
     `?pgbouncer=true&connection_limit=1` appended
   - the **Direct connection** URI (port `5432`) → `DIRECT_URL`

   The pooler is what a serverless application must use; Prisma Migrate must
   not go through it, which is why there are two.

3. Apply the schema from your machine:

   ```bash
   export DATABASE_URL="…6543/postgres?pgbouncer=true&connection_limit=1"
   export DIRECT_URL="…5432/postgres"

   npx prisma migrate deploy
   npm run db:seed:reference
   ```

   `migrate deploy` applies the four migrations. `db:seed:reference` inserts
   the 22 local authorities, 25 planning authorities, sector taxonomy, plan
   definitions and source registry. It creates **no** companies, contracts or
   applications — those only ever arrive through a connector.

**Check:** `npx prisma migrate status` prints *Database schema is up to date*.

> Do not run `npm run db:seed:dev` against this database. It refuses when
> `NODE_ENV=production` or when real records exist, but do not rely on that.

---

## Stage 2 — Authentication

1. In Supabase, **Authentication → URL Configuration**: set the Site URL to
   your production domain and add `https://yourdomain/auth/callback` to the
   redirect allow-list. Add your Vercel preview domain too if you want
   previews to sign in.
2. **Project Settings → API**: copy the Project URL, the `anon` key and the
   `service_role` key.

The `service_role` key bypasses row-level security. It belongs only in server
environment variables — never in anything prefixed `NEXT_PUBLIC_`.

---

## Stage 3 — Deploy

1. Import the repository in Vercel. Framework preset: Next.js. Leave the build
   command alone — `package.json` already runs `prisma generate && next build`,
   and `postinstall` regenerates the client.
2. Set environment variables (Production, and Preview if you want previews to
   work):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | pooled, port 6543 |
   | `DIRECT_URL` | direct, port 5432 |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role key |
   | `APP_URL` | `https://yourdomain` |
   | `CRON_SECRET` | `openssl rand -base64 32` |
   | `ADMIN_BOOTSTRAP_EMAIL` | the address you will sign up with first |

   **Never set `DEV_AUTH_EMAIL`.** It does nothing in a production build — the
   branch is eliminated at compile time — but it has no business being there.

3. Deploy, then point your domain at it.

**Check:** `https://yourdomain/` loads the landing page, and:

```bash
curl -s https://yourdomain/api/health | jq
# {"status":"ok","database":{"reachable":true}, …}

curl -s -H "Authorization: Bearer $CRON_SECRET" https://yourdomain/api/health | jq
# the detailed view: migrations applied, reference data counts,
# and every integration with the exact variables it is missing
```

The detailed health view is the fastest way to see what is still unconfigured
at any point below.

---

## Stage 4 — First administrator

Sign up at `https://yourdomain/register` with the address you put in
`ADMIN_BOOTSTRAP_EMAIL`. That account is promoted to admin on creation. Confirm
the email, then open `/admin` — it should load.

Promote anyone else from **Admin → Users**. Once you have a second admin,
remove `ADMIN_BOOTSTRAP_EMAIL` so it cannot be used again.

---

## Stage 5 — First real data

1. Register for a **Companies House** API key at
   <https://developer.company-information.service.gov.uk/> (free; create an
   application, then a *live* API key).
2. Add `COMPANIES_HOUSE_API_KEY` in Vercel and redeploy.
3. Run the first ingest by hand rather than waiting for the cron, so you can
   watch it:

   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     "https://yourdomain/api/cron/ingest/companies_house_discovery?limit=200"
   ```

   Start small. The response reports created / updated / rejected counts.

4. Check **Admin → Import runs** and **Admin → Errors**. Rejected records are
   normal in small numbers; a run that rejects everything means the response
   shape has changed and the normaliser needs a look.

5. When that looks right, backfill properly:

   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     "https://yourdomain/api/cron/ingest/companies_house_discovery?backfill=true&limit=20000"
   ```

   Each run is capped and resumes from a stored cursor, so repeat it until the
   counts stop growing. Companies House allows 600 requests per five minutes;
   the client respects that and backs off on `429`.

Procurement needs no key — set `SELL2WALES_OCDS_BASE` to the publisher's OCDS
endpoint and run `/api/cron/ingest/sell2wales_ocds` the same way.

**Check:** `/dashboard/companies` returns real Welsh companies, and each row
links back to its Companies House record.

---

## Stage 6 — Scheduled ingestion

Vercel reads `vercel.json` on deploy, so the five crons register themselves:

| UTC | Endpoint |
| --- | --- |
| 02:00 | Companies House discovery |
| 02:30 | Company enrichment (officers, PSCs, filings) |
| 03:00 | Sell2Wales procurement |
| 04:00 | Every configured planning authority |
| 07:00 | Alert matching and email |

Confirm them under **Vercel → Project → Cron Jobs**. They authenticate with
`CRON_SECRET`; if it is unset the endpoints return 503 rather than running
open, so check it is set before assuming a quiet night means success.

---

## Stage 7 — Optional integrations

Each one is independent, and until you configure it the product says so on the
relevant page rather than pretending.

**Email — Resend.** Verify your sending domain, then set `RESEND_API_KEY` and
`EMAIL_FROM`. Until you do, alerts still run and matches appear in the
dashboard; no mail is sent, and the alerts page says that.

**Billing — Stripe.** Create products and prices matching
`src/lib/billing/plan-definitions.ts` (Pro £49/mo, Business £99/mo, or your
own figures), put the price IDs on the plan rows, then set
`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and a webhook at
`https://yourdomain/api/webhooks/stripe` for `checkout.session.completed`,
`customer.subscription.*` and `invoice.*`. Put the signing secret in
`STRIPE_WEBHOOK_SECRET`. Test with Stripe's CLI against a preview deploy
before pointing it at production — webhook signatures are verified and events
deduplicated, so replaying one is safe.

**Maps.** `NEXT_PUBLIC_MAP_STYLE_URL` pointing at any MapLibre style. Without
it the map draws markers on a plain background.

**Plain-English search.** `ANTHROPIC_API_KEY`. Without it the search box
reports itself as not configured and the filter panel is unaffected.

**Planning.** No key exists to buy. Each authority is connected individually
under **Admin → Planning authorities** by giving it an adapter, an https
endpoint and a field map, then pressing *Test now*, which reads ten records so
you can check the mapping before the nightly job runs. Authorities that publish
only HTML search pages stay unavailable, and say why.

---

## Keeping it running

**After every deploy**, hit the authenticated health endpoint. `ready: false`
means migrations or reference data are missing.

**Migrations are a deliberate step, not part of the build.** If they ran during
`next build`, every preview deployment would migrate production. When a release
includes a migration, run `npm run db:deploy` against `DIRECT_URL` *before*
promoting the deployment.

**Watch for staleness.** The health endpoint reports `staleDays` per source.
A source that has not succeeded for several days is either rate-limited, has a
rotated key, or the publisher changed shape — **Admin → Errors** says which.

**Back-ups.** Supabase takes daily backups on paid plans. The ingested data is
reproducible from the publishers, but user accounts, saved searches, alerts and
subscriptions are not. Check the backup schedule matches how much you are
willing to lose.

**Rotating `CRON_SECRET`** disables the cron endpoints until Vercel
redeploys with the new value. Rotate, then redeploy immediately.

---

## What is still unproven

Stated plainly, because the rest of this document reads like everything is
ready:

- No live call has ever been made to Companies House, Sell2Wales, Stripe,
  Supabase, Resend or the Anthropic API. Every connector is complete and
  tested against fixtures, but Stage 5 is the first time any of them meets a
  real publisher. Expect to iterate on the normalisers.
- The migrations, the search indexes and every page have been verified against
  a real PostgreSQL 16 — that part is proven, and it found three bugs.
- No Welsh planning authority has a configured endpoint, so the planning
  adapters have run against test data only.
