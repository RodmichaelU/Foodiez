# Pantry Camera Recipe App: Build Guide

Instructions for Claude Code. Build this app phase by phase. **Stop at the end of every phase**, summarize what was built, list how to test it on the iPhone, and wait for confirmation before starting the next phase.

---

## 0. Product summary

A mobile app where the user points their iPhone camera at food they have on hand. The app detects the ingredients, lets the user confirm or edit the list, then returns recipes they can make right now. Recipes come from three sources, merged into one ranked list:

1. **Chef's Picks**: the owner's own recipes (stored in Supabase), shown first with a badge
2. **Online**: Spoonacular (find by ingredients), TheMealDB as backup
3. **AI**: Gemini-generated recipes when the other sources match poorly, labelled "AI idea"

Nav bar (Instagram style): **Home | Search | Capture (centre) | Profile**.

MVP goal: runs locally on an iPhone through **Expo Go**. No App Store release. **$0 budget**: free tiers only.

---

## 1. Ground rules (apply to every phase)

- **No API keys in the mobile app, ever.** Gemini and Spoonacular keys live only in `backend/.env`. The app talks to the FastAPI backend, plus Supabase directly for auth only (Supabase anon key is safe for the client).
- Only use libraries that work in **Expo Go**. If a feature needs custom native code, stop and ask.
- TypeScript (strict) for mobile. Python 3.11+ with type hints for the backend.
- Every external call (Gemini, Spoonacular, TheMealDB, Supabase) gets a timeout, error handling, and a user-friendly error message in the app.
- Keep secrets out of git: add `.env` files to `.gitignore`, commit `.env.example` files instead.
- Write small, readable modules. Prefer clarity over cleverness; this is also a portfolio project.
- Add backend tests (pytest) for the scoring, normalization and merge logic.
- Do not use em dashes in any user-facing copy.

---

## 2. Tech stack

| Layer | Choice |
| --- | --- |
| Mobile | React Native + Expo (latest SDK), TypeScript, Expo Router (tabs) |
| Camera | `expo-camera` (`CameraView`) |
| Image compression | `expo-image-manipulator` (resize to ~1024 px wide, JPEG ~0.6) |
| Auth + DB + storage | Supabase (`@supabase/supabase-js` in app, `supabase` Python client in backend) |
| Backend | FastAPI, `uvicorn`, `httpx` (async), `pydantic` |
| Vision + AI recipes | Google Gemini via the `google-genai` Python SDK, free-tier Flash model. Model name read from `GEMINI_MODEL` env var |
| Online recipes | Spoonacular API (free tier), TheMealDB (free) |

---

## 3. Repository structure

```
pantry-app/
├── BUILD_GUIDE.md
├── README.md
├── mobile/                  # Expo app
│   ├── app/                 # Expo Router screens
│   │   ├── _layout.tsx
│   │   ├── onboarding.tsx
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx  # tab bar with centre Capture button
│   │   │   ├── index.tsx    # Home feed
│   │   │   ├── search.tsx
│   │   │   ├── capture.tsx
│   │   │   └── profile.tsx
│   │   ├── confirm.tsx      # ingredient confirm/edit
│   │   ├── results.tsx
│   │   └── recipe/[id].tsx  # recipe detail
│   ├── src/
│   │   ├── api/             # backend client
│   │   ├── lib/supabase.ts
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types.ts
│   ├── .env.example         # EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
│   └── app.json
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py        # settings from env
│   │   ├── routers/         # scan.py, recipes.py, search.py, cooked.py, feed.py
│   │   ├── services/        # gemini.py, spoonacular.py, mealdb.py, chef_picks.py
│   │   ├── core/            # normalize.py, scoring.py, merge.py, auth.py
│   │   └── models.py        # pydantic schemas
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example         # GEMINI_API_KEY, GEMINI_MODEL, SPOONACULAR_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
├── supabase/
│   └── migrations/          # SQL files
└── seed/
    ├── ingredients.json     # canonical ingredients + aliases
    └── chef_picks.json      # owner's recipes
```

---

## 4. Data model (Supabase Postgres)

Create as SQL migrations in `supabase/migrations/`. Enable Row Level Security on all tables.

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  avoid_ingredients text[] default '{}',   -- allergies / never include
  created_at timestamptz default now()
);

create table ingredients (
  canonical_name text primary key,          -- e.g. 'tomato', 'chicken_breast'
  display_name text not null,
  aliases text[] default '{}',              -- e.g. {'roma tomato','tomatoes'}
  category text,                            -- produce, dairy, protein, pantry...
  is_staple boolean default false           -- salt, pepper, oil, butter, flour
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('chef','online','ai')),
  external_id text,                         -- spoonacular / mealdb id
  title text not null,
  description text,
  core_ingredients text[] not null,         -- canonical names, must have
  optional_ingredients text[] default '{}',
  ingredient_lines jsonb default '[]',      -- [{name, amount, unit}]
  steps jsonb default '[]',                 -- ["step 1", ...]
  image_url text,
  prep_minutes int,
  created_at timestamptz default now(),
  unique (source, external_id)
);

create table scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  photo_url text,
  detected_ingredients jsonb default '[]',
  confirmed_ingredients text[] default '{}',
  created_at timestamptz default now()
);

create table cooked (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  scan_id uuid references scans on delete set null,
  recipe_id uuid references recipes on delete set null,
  dish_photo_url text,
  caption text,
  is_public boolean default true,
  created_at timestamptz default now()
);
```

RLS policies:
- `profiles`, `scans`: user can read/write only rows where `id`/`user_id = auth.uid()`
- `cooked`: user can write own rows; anyone authenticated can read rows where `is_public = true`
- `recipes`, `ingredients`: readable by all authenticated users; writes only via backend (service role)

Storage buckets: `scan-photos` (private, per-user folder), `dish-photos` (public read).

Online and AI recipes are inserted into `recipes` only when a user cooks them, so history never depends on an external API.

---

## 5. Core logic specs

### 5.1 Gemini ingredient detection

`POST /scan` accepts one or more JPEG images (multipart). Backend sends them to Gemini with structured JSON output (use `response_mime_type="application/json"` and a response schema).

Prompt intent:
- Identify every distinct food item or ingredient visible, including packaged items (read labels)
- Ignore non-food objects and containers
- Return each item with: `name` (as seen), `canonical_name` (lowercase snake_case, singular, generic, e.g. `cheddar`, `chicken_breast`), `category`, `confidence` (0 to 1)
- Provide the current canonical ingredient list in the prompt so Gemini reuses existing names where possible

Response to app:
```json
{ "scan_id": "uuid", "ingredients": [{"name": "Roma tomatoes", "canonical_name": "tomato", "category": "produce", "confidence": 0.93}] }
```

Items under 0.5 confidence are returned but flagged so the confirm screen shows them unchecked.

### 5.2 Normalization (`core/normalize.py`)

- Load `ingredients` table (cache in memory, refresh every 10 minutes)
- `normalize(name) -> canonical_name`: lowercase, strip, singularize, match against canonical names and aliases; fall back to the cleaned name if no match
- Used for Gemini output, Spoonacular/TheMealDB ingredient names, and user-typed additions
- Unit tests for plurals, aliases and unknown items

### 5.3 Recipe search (`POST /recipes`)

Request: `{ "scan_id": "uuid", "ingredients": ["tomato","egg"], "use_staples": true }`

Backend runs in parallel with `asyncio.gather` (each with its own timeout, failures return empty lists):
1. **Chef's Picks**: query `recipes` where `source = 'chef'`
2. **Spoonacular**: `GET /recipes/findByIngredients?ingredients=...&number=10&ranking=1&ignorePantry=true`, then fetch details for the top results (`/recipes/{id}/information`)
3. **TheMealDB** (backup, only if Spoonacular fails or returns < 3): `filter.php?i=<top ingredient>` then `lookup.php?i=<id>`
4. **AI**: only if fewer than 3 results score above 0.6 after steps 1 to 3. Gemini generates up to 3 recipes using only the user's ingredients + staples, same JSON shape as `recipes`

Cache online results in memory keyed by the sorted ingredient set (TTL 24 h) to protect free quotas.

### 5.4 Scoring (`core/scoring.py`)

```
owned = user ingredients ∪ (staples if use_staples)
core_have = |core ∩ owned| / |core|
missing = core - owned
score = core_have - 0.1 * len(missing) + 0.02 * |optional ∩ owned|
```

- Exclude any recipe containing an ingredient in the user's `avoid_ingredients`
- Exclude recipes with more than 2 missing core ingredients
- Return `score`, `have_count`, `total_core`, `missing` for each recipe

### 5.5 Merge (`core/merge.py`)

- Chef's Picks with score ≥ 0.7 go in a pinned `chef_picks` section, sorted by score
- Remaining results sorted by score, grouped into `online` and `ai` sections
- Deduplicate by normalized title

Response:
```json
{ "chef_picks": [Recipe], "online": [Recipe], "ai": [Recipe] }
```

### 5.6 Auth on the backend (`core/auth.py`)

- App sends the Supabase access token as `Authorization: Bearer <token>`
- Backend validates it via the Supabase client (`auth.get_user(token)`) and gets `user_id`
- All endpoints except `/health` require auth (Phase 1 runs without auth; see below)

### 5.7 Rate limiting

- Simple in-memory limiter: max 20 scans per user per day, 5 per minute
- On Gemini 429 errors, return a clear "Too many scans right now, try again in a minute" message

---

## 6. Build phases

Each phase ends with a **checkpoint**: stop, summarize, give test steps for the iPhone.

### Phase 0: Setup

1. Create the repo structure from section 3, `.gitignore`, `README.md` with run instructions
2. Mobile: create Expo app with TypeScript and Expo Router; tab layout with 4 tabs and a raised centre Capture button; placeholder screens
3. Backend: FastAPI app with `/health`, CORS enabled for local dev, settings from `.env`
4. `mobile/src/api/client.ts`: fetch wrapper using `EXPO_PUBLIC_API_URL`, with timeout and typed errors
5. Home screen calls `/health` and shows "Backend connected"

**Checkpoint:** app opens on iPhone via Expo Go (`npx expo start`), backend runs with `uvicorn app.main:app --host 0.0.0.0 --reload`, Home shows connected. Explain how to find the laptop's local IP for `EXPO_PUBLIC_API_URL`.

### Phase 1: Core loop (no auth yet)

1. **Capture screen:** camera permission flow with clear explanation; `CameraView` full screen; shutter button; option to add up to 3 photos; thumbnails strip; "Find recipes" button
2. Compress images with `expo-image-manipulator` before upload
3. **Backend `/scan`:** Gemini detection (5.1). Skip DB writes for now; return a temporary scan_id
4. **Confirm screen:** checklist of detected ingredients (low confidence unchecked); delete; add ingredient via text input; "Use pantry staples" toggle (default on); "Show recipes" button
5. **Backend `/recipes`:** AI source only for now (Gemini generates 3 to 5 recipes)
6. **Results screen:** recipe cards with title, image placeholder, prep time, "You have X/Y", missing items
7. **Recipe detail screen:** ingredients split into "You have" and "Missing", numbered steps, source label
8. Loading states with progress text ("Looking at your food...", "Finding recipes..."), error states with retry

**Checkpoint:** photo of a real fridge or counter returns usable recipes on the iPhone. Report average time from shutter to results.

### Phase 2: Recipe engine

1. Supabase project setup instructions (manual steps for the owner: create project, copy URL and keys into `.env` files)
2. Run migrations from section 4
3. `seed/ingredients.json`: ~150 common ingredients with aliases and staple flags; seed script `backend/scripts/seed.py`
4. `seed/chef_picks.json`: template with 3 example recipes in the `recipes` shape; the owner will replace and extend these. Seed script loads them with `source = 'chef'`
5. Implement normalization (5.2), Spoonacular + TheMealDB services, scoring (5.4), merge (5.5), caching
6. Update `/recipes` to run all sources in parallel (5.3)
7. Results screen: three sections, Chef's Picks first with a "Chef's Pick" badge; AI cards labelled "AI idea"
8. pytest coverage for normalize, scoring and merge

**Checkpoint:** a scan matching a seeded Chef's Pick shows it pinned on top; online recipes show with images.

### Phase 3: Accounts and Profile

1. Supabase auth with email + password (Google sign-in is deferred; it is awkward in Expo Go)
2. Session persistence with AsyncStorage; returning users skip onboarding
3. **Onboarding screen:** 3 short slides explaining the app, then Log in / Sign up
4. Backend auth (5.6) on all endpoints; rate limiting (5.7)
5. `/scan` now uploads the photo to `scan-photos` and writes a `scans` row
6. Settings in Profile: display name, "Never include" ingredients list (allergies)
7. **"I made this"** on recipe detail: optional dish photo (camera or library), caption, public toggle; backend saves the recipe to `recipes` if not already there, uploads photo, writes `cooked` row
8. **Profile screen:** header with name and counts; 3-column grid of cooked dishes (dish photo, else scan photo); tap opens a detail view with photo, ingredients used, and the recipe

**Checkpoint:** sign up, scan, cook, log out, log back in: history is still there.

### Phase 4: Search

1. Backend `GET /search?q=...&mode=name|ingredient`
2. Name mode: Chef's Picks (title ilike) + Spoonacular `complexSearch`
3. Ingredient mode: comma-separated ingredients run through the same pipeline as `/recipes`
4. Search screen: input with mode toggle, debounced queries, results in the same card component

**Checkpoint:** searching "pasta" and "egg, spinach" both return merged results.

### Phase 5: Home feed and polish

1. Backend `GET /feed?cursor=...`: public `cooked` rows, newest first, with user display name, dish photo, recipe title, ingredients used
2. Home screen: vertical feed of post cards, pull to refresh, infinite scroll; tapping a post opens the recipe
3. Seed script to create the owner's sample posts so the feed is never empty
4. Polish: empty states, skeleton loaders, consistent theme (colors, typography in one `theme.ts`), haptics on shutter, app icon and splash placeholders
5. Update README with setup steps, architecture diagram (Mermaid), and screenshots placeholders

**Checkpoint:** full flow works end to end; ready to record a 2-minute portfolio demo.

---

## 7. Out of scope for MVP (do not build yet)

- App Store / TestFlight release
- Following users, likes, comments, report/block
- Nutrition and healthy-goal filters
- Persistent pantry and expiry reminders
- Barcode scanning
- Payments and subscriptions
- Google / Apple sign-in

---

## 8. Owner's manual steps (Claude Code should prompt for these when needed)

- Create a Google AI Studio account and Gemini API key (free tier)
- Create a Spoonacular account and API key (free tier)
- Create a Supabase project; copy project URL, anon key and service role key
- Install Expo Go on the iPhone; keep laptop and iPhone on the same Wi-Fi
- Replace the sample recipes in `seed/chef_picks.json` with real Chef's Picks
