# Deploying Geo Ranao

Three moving parts: **Supabase** (Postgres + photo storage), **Railway** (the NestJS API), **Vercel** (the Quasar frontend). Steps below are the ones only you can do (they need your accounts); Claude has already prepared the code/config for each.

## 1. Supabase (you've done this — confirm credentials are in `.env`)

In `geo-ranao-api/.env`, uncommented and filled in:
- `DATABASE_URL` — Project Settings → Database → Connection string (URI), **Session pooler** mode
- `DB_SSL=true`
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` — Project Settings → API Keys

Once these are set, tell Claude — it will run migrations and seed the admin account + stations against Supabase, and create the private `fish-photos` storage bucket automatically.

## 2. Railway (backend)

1. [railway.app](https://railway.app) → sign in with GitHub → **New Project → Deploy from GitHub repo**
2. Push `geo-ranao-api` to a GitHub repo first if it isn't already (Railway deploys from a repo, not a local folder)
3. Railway auto-detects the `Dockerfile` in the repo root — no build config needed
4. In the Railway project → **Variables**, add every variable from `.env` *except* the local `DB_*` ones (only `DATABASE_URL`, `DB_SSL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`, `PHOTO_RETENTION_DAYS`, `JWT_SECRET`, `ADMIN_*`) — plus `FRONTEND_URL` set to your Vercel URL once you have it (step 3)
5. Railway assigns a public URL like `https://geo-ranao-api-production.up.railway.app` — note it down, the frontend needs it

## 3. Vercel (frontend)

1. [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project** → import the `geo-ranao-front-end` repo
2. Vercel reads `vercel.json` (already in the repo) for build command/output dir — no extra config needed
3. Project Settings → **Environment Variables** → add `VITE_API_URL` = your Railway backend URL from step 2
4. Deploy. Vercel assigns a URL like `https://geo-ranao.vercel.app`

## 4. Close the loop

Go back to Railway → Variables → set `FRONTEND_URL` to the Vercel URL from step 3, so CORS allows it. Redeploy the backend (Railway does this automatically on variable changes).

## Local dev is unaffected

`docker-compose up` + local Postgres still works exactly as before — `DATABASE_URL` only takes priority when set, so local dev keeps using the `DB_*` vars. Local dev now also needs real `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` values for photo uploads to work (photos always go to Supabase Storage — there's no local-disk fallback anymore).
