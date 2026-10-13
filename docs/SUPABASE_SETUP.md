# Supabase setup (M3: food search)

Food search goes through a small Supabase Edge Function so the USDA API key never ships in the app.
This takes about 15 minutes. Accounts and sync (M5) reuse the same project.

## Option A: try search right now (development only)

1. Get a free USDA key: https://fdc.nal.usda.gov/api-key-signup (arrives by email).
2. `cp .env.example .env` and set `EXPO_PUBLIC_USDA_DEV_KEY=<your key>`.
3. Restart with a clean cache: `npx expo start -c`.

The app calls USDA directly. This works only in development builds. Production builds ignore it, so you need Option B before release.

## Option B: the real setup

1. **Create a project** at https://supabase.com/dashboard. Pick region **East US**, and save the database password somewhere safe.
2. **Install the CLI and link the project** from this repo's folder:
   ```bash
   npm install -g supabase        # or: brew install supabase/tap/supabase
   supabase login
   supabase init                  # creates supabase/config.toml (keeps our functions folder)
   supabase link --project-ref <your-project-ref>   # the ref is in the dashboard URL
   ```
3. **Store the USDA key as a server secret:**
   ```bash
   supabase secrets set USDA_API_KEY=<your USDA key>
   ```
4. **Deploy the function:**
   ```bash
   supabase functions deploy food-search --no-verify-jwt
   ```
   `--no-verify-jwt` is needed because people can use the app without an account. The function limits each IP address to 60 requests a minute, and validates every query. Once accounts arrive in M5, we can require a session token instead.
5. **Check it works:**
   ```bash
   curl "https://<your-project-ref>.supabase.co/functions/v1/food-search?q=banana"
   ```
   You should get JSON with a `foods` list.
6. **Point the app at it.** In `.env`, set the two values from Dashboard → Project Settings → API:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=<publishable (or anon) key>
   ```
   The publishable key is designed to be public, so shipping it in the app is fine. Never put the `service_role` / secret key in the app.
7. Restart: `npx expo start -c`.

## Barcodes

Barcode lookups go to Open Food Facts first, straight from the phone; it needs no key. If a product isn't found there, the app tries USDA branded foods through the same function. Open Food Facts data is ODbL-licensed, and the app shows the attribution on those foods.
