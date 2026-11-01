-- Tables

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  avoid_ingredients text[] default '{}',
  created_at timestamptz default now()
);

create table ingredients (
  canonical_name text primary key,
  display_name text not null,
  aliases text[] default '{}',
  category text,
  is_staple boolean default false
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('chef','online','ai')),
  external_id text,
  title text not null,
  description text,
  core_ingredients text[] not null,
  optional_ingredients text[] default '{}',
  ingredient_lines jsonb default '[]',
  steps jsonb default '[]',
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

-- Row Level Security. The backend's service role bypasses these policies.

alter table profiles enable row level security;
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table scans enable row level security;
alter table cooked enable row level security;

create policy "Users manage their own profile" on profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Users manage their own scans" on scans
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage their own cooked rows" on cooked
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Authenticated users read public cooked rows" on cooked
  for select to authenticated
  using (is_public = true);

create policy "Authenticated users read recipes" on recipes
  for select to authenticated
  using (true);

create policy "Authenticated users read ingredients" on ingredients
  for select to authenticated
  using (true);

-- Storage. Files live under a folder named after the user's id.

insert into storage.buckets (id, name, public) values
  ('scan-photos', 'scan-photos', false),
  ('dish-photos', 'dish-photos', true);

create policy "Users manage their own scan photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'scan-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'scan-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Anyone reads dish photos" on storage.objects
  for select
  using (bucket_id = 'dish-photos');

create policy "Users upload their own dish photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete their own dish photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);
