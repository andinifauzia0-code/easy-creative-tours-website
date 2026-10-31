# Easy Creative Tours CMS setup

The CMS extends the existing static website. Public pages keep working from their current source content until Supabase is configured. Admin routes fail closed when the Supabase project URL or anon/publishable key is missing.

## 1. Create and secure a Supabase project

Create a project in the official Supabase dashboard. In **Authentication → Settings**, turn off public sign-ups. Admin accounts should be invited by the owner; the CMS does not contain a registration screen.

Add these redirect URLs in **Authentication → URL Configuration**:

- `https://easy-creative-tours-website.vercel.app/admin/update-password`
- Your local development origin plus `/admin/update-password` if testing locally.

Set the project Site URL to the production site. Configure the Auth email delivery/provider before relying on password reset emails.

## 2. Create the database and migrate existing website content

Run the read-only `supabase/preflight.sql` first and review any existing CMS tables, policies, and Storage bucket contents. Do not change a pre-existing bucket's public setting until its current objects have been reviewed. If there are no conflicting objects or schema, run these SQL files in **Supabase Dashboard → SQL Editor**, in this order:

1. `supabase/migrations/20261031000000_cms_schema.sql`
2. `supabase/migrations/20261031000001_migrate_existing_site_content.sql`
3. `supabase/migrations/20261031000002_harden_admin_policies.sql`

The second file is generated from the current static services, destinations, packages, and portfolio examples by:

```sh
node scripts/generate-initial-cms-seed.mjs
```

It uses `ON CONFLICT DO NOTHING`, so rerunning it will not overwrite later CMS edits. Verify the seeded rows in Supabase before setting the Vercel environment variables. The current public website remains unchanged until valid database rows are available.

## 3. Invite the first administrator

In **Authentication → Users**, invite the owner's email and complete password setup through Supabase's email flow. Then replace `owner@example.com` in `supabase/provision-admin.sql` with that invited email and run the SQL in Supabase's SQL Editor. The profile insert grants administrator access; do not add a public signup flow or create a hardcoded password.

Only rows in `admin_profiles` with `is_active = true` can write CMS content. An authenticated user without an active profile cannot reach the dashboard or mutate content. Database RLS also protects writes if a browser request is forged.

## 4. Configure Vercel

In the existing Vercel project, open **Settings → Environment Variables** and add these variables for **Production** (and Preview if previews should use the CMS):

- `SUPABASE_URL` — the project's HTTPS URL from Supabase **Project Settings → API**.
- `SUPABASE_PUBLISHABLE_KEY` — the project's publishable key from the same page.

These two values are intentionally embedded in the public website build. They are not administrator credentials. Keep the Supabase service-role/secret key out of the repository, Vercel client config, and browser code; this implementation does not need it.

Redeploy the existing Vercel project after setting the variables. Do not set only one variable; the build rejects a partial configuration. Until both are configured, `/admin` displays setup instructions and no management data or API operations are available.

For local use, save both public values in the ignored root `.env.local` file (see `.env.example`) before running `node server.mjs` or `npm run build`. `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are read locally from that file; do not place secret or service-role keys there.

## 5. Use the CMS

- Admin login: `/admin/login`
- Dashboard: `/admin`
- Password recovery: `/admin/reset`
- Password update: `/admin/update-password`

Content edits write directly to Supabase through the authenticated user's JWT. RLS grants admin writes and public reads only for published rows. Public pages request published content without a build-time cache, so a refresh can see a newly published change without a code deployment. Draft rows are excluded by both the REST query and RLS.

Storage uses the `brand`, `homepage`, `products`, `services`, `destinations`, and `portfolio` buckets for JPG, PNG, and WEBP images up to 10 MB. The migration creates missing buckets and leaves existing bucket settings and objects unchanged; compare the preflight output before applying it. Admin-only policies protect listing and all writes. The named buckets are public-read for website photography, so never place private or confidential files there. The migration retains any legacy `ect-media` bucket and its objects without changing its public/private setting.

## Tables

The migration creates `admin_profiles`, `site_settings`, `homepage_sections`, `products`, `services`, `destinations`, `portfolio_projects`, `portfolio_images`, `media_assets`, and `seo_metadata`, with indexes, update timestamps, RLS, Storage policies, and initial catalog data.
