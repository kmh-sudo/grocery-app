# Grocery Items App

A simple app to quickly capture grocery needs so nothing is forgotten on shopping day.

## Features

- Add grocery items with required name and optional note
- Edit item name or note
- Mark items as bought/unbought
- Delete items
- Filter by All / Pending / Bought
- Clear all bought items in one click
- Empty states for first use and filtered results
- Family shared mode with Supabase login (all logged-in users share one list)

## How to run

```bash
npm install
npm run dev
```

Open the local URL shown by Vite in your terminal.

## Supabase setup (shared family accounts)

1. Create a Supabase project.
2. In Supabase SQL Editor, run:

```sql
create extension if not exists pgcrypto;

create table if not exists public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  family_id text not null default 'family-shared',
  name text not null,
  note text not null default '',
  bought boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.grocery_items enable row level security;

create policy "authenticated_select_grocery_items"
on public.grocery_items
for select
to authenticated
using (true);

create policy "authenticated_insert_grocery_items"
on public.grocery_items
for insert
to authenticated
with check (auth.uid() = created_by);

create policy "authenticated_update_grocery_items"
on public.grocery_items
for update
to authenticated
using (true)
with check (true);

create policy "authenticated_delete_grocery_items"
on public.grocery_items
for delete
to authenticated
using (true);
```

3. In Supabase Auth settings, keep Email provider enabled.
4. Create 3 users in **Authentication → Users → Add user** (your family emails + passwords).
5. Copy `.env.example` to `.env` and fill:
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_ANON_KEY` = your **anon/publishable** key (not service role, not `sb_secret_*`)
6. Restart dev server with `npm run dev`.

After this, each family member can log in and all accounts will see/update the same shared grocery list.

## How data is stored

- Local fallback mode: browser `localStorage` key `grocery-items`
- Shared mode: Supabase `public.grocery_items` table
- App auto-uses Supabase when valid env vars are present

## Test command

```bash
npm test
```
