# Pixolateds — Event Photo Galleries

Multi-tenant photo delivery for corporate events, built on Cloudflare Workers.

- **Admins** sign in at `admin.pixolateds.com` (Clerk, invite-only), claim a permanent
  subdomain, create events, and upload photographer JPEGs.
- **Attendees** visit `{slug}.pixolateds.com/{event}` for a mobile-first gallery with
  lightbox, multi-select, native share sheet, and single/ZIP downloads.

## Stack

| Layer | Tech |
|---|---|
| App | Next.js 16 (App Router) via `@opennextjs/cloudflare` on Workers |
| DB | Cloudflare D1 + Drizzle ORM (`src/db/schema.ts`, migrations in `drizzle/`) |
| Storage | Cloudflare R2 — 3 objects per photo: original + 1600px/400px WebP made **in the browser** at upload |
| Auth | Clerk (admin only; public galleries have zero Clerk dependency) |
| Routing | `src/middleware.ts` rewrites by hostname: `admin.*` → `/admin`, `{slug}.*` → `/s/{slug}` |

## Local development

```bash
npm install
cp .env.example .env.local          # fill in Clerk keys (dev instance is fine)
npx wrangler d1 migrations apply pixolateds-db --local
npm run dev                         # local D1 + R2 simulators via Miniflare
```

- Tenant pages are path-addressable in dev: `http://localhost:3000/s/{slug}/{event}`.
- Admin: `http://localhost:3000/admin`. Clerk needs real (test-mode) keys in
  `.env.local`; keyless mode does not reach the edge middleware.
- Without R2 S3 credentials, uploads automatically fall back to streaming
  through the Worker (`/api/uploads/direct`) into the local R2 simulator.

`npm run preview` runs the real Workers runtime locally (OpenNext build + Miniflare).

## First production deploy

### 1. Cloudflare resources

```bash
npx wrangler login
npx wrangler d1 create pixolateds-db     # paste database_id into wrangler.jsonc
npx wrangler r2 bucket create pixolateds-media
npx wrangler d1 migrations apply pixolateds-db --remote
npx wrangler r2 bucket cors put pixolateds-media --file r2-cors.json
```

### 2. R2 public custom domain (free egress for photos)

Dashboard → R2 → `pixolateds-media` → Settings → **Custom Domains** → add
`media.pixolateds.com`. This creates the DNS record automatically and enables
edge caching. Photo keys are unguessable (`{companyId}/{eventId}/{uid}/…`), so
public-bucket exposure is limited to people who already have the gallery.

Also create an R2 API token (Object Read & Write, scoped to the bucket) for
presigned uploads: R2 → Manage API Tokens.

### 3. Clerk

1. Create a production Clerk app; add `admin.pixolateds.com` as its domain.
2. **User & Authentication → Restrictions → Sign-up mode: Restricted** —
   only emails you invite can register (you are the only tenant for now).
3. Copy the publishable key into `.env` (build-time) and set
   `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/admin/sign-in`.

### 4. Secrets

```bash
npx wrangler secret put CLERK_SECRET_KEY
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put PIN_COOKIE_SECRET      # openssl rand -hex 32
```

### 5. DNS + routes (WordPress stays untouched)

The zone `pixolateds.com` is already on Cloudflare. Add **proxied** records —
do not touch the apex/`www` records that point at WordPress:

| Type | Name | Content | Proxy |
|---|---|---|---|
| AAAA | `*` | `100::` | Proxied |
| AAAA | `admin` | `100::` | Proxied |

`wrangler.jsonc` already declares the route `*.pixolateds.com/*`. After the
first deploy, add an **exclusion route** so `www` keeps serving WordPress:
Dashboard → Workers Routes → Add route → `www.pixolateds.com/*` → **None**.
(The apex `pixolateds.com/*` never matches the `*.` pattern, so it needs nothing.)

Free Universal SSL already covers one-level wildcards (`*.pixolateds.com`).

### 6. Deploy

```bash
npm run deploy
```

Smoke test: `pixolateds.com` + `www` still serve WordPress; `admin.pixolateds.com`
shows the Clerk sign-in; `anything.pixolateds.com` 404s until a company claims it.

### Subsequent deploys with a schema change

**`npm run deploy` (`opennextjs-cloudflare build && opennextjs-cloudflare deploy`)
does NOT apply pending D1 migrations.** Whenever a change adds a new migration
under `drizzle/`, you must apply it to the remote database **before** deploying
the Worker — otherwise the newly-deployed code will query columns/tables that
don't exist yet on remote D1 and every affected route will 500 (full outage)
until the migration is applied:

```bash
npx wrangler d1 migrations apply pixolateds-db --remote   # 1. migrate remote D1 first
npm run deploy                                             # 2. then deploy the Worker
```

## Cost model

- **Photos never touch the Worker**: served from `media.pixolateds.com`
  (R2 custom domain — free egress, edge-cached).
- **No image transformation fees**: thumb/display WebP variants are generated
  client-side at upload; ~3 PUTs/photo ≈ $0.0000135.
- **Storage**: ~$0.015/GB-month. A 500-photo event (~5GB with variants) ≈ $0.08/mo.
- **ZIP downloads** stream through the Worker (no buffering, no compression) —
  negligible CPU, free egress.
- D1 free tier (5M reads/day) covers metadata for a long time.

## Future work (schema is ready)

- `companies.plan` + `events.expires_at` exist for a free plan with 30-day
  expiry — add a Worker cron to purge expired events' R2 objects + rows.
- PIN entry has no rate limiting; add a Turnstile or a D1-backed attempt
  counter if galleries become sensitive.
- Flip Clerk to open sign-up once quotas/expiry are enforced.
