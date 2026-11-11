-- User settings: one jsonb blob per user, validated client-side with zod
-- (src/lib/settings/schema.ts). docs/DESIGN.md section 9.

create table public.user_settings (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings: own row"
  on public.user_settings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
