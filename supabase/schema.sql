-- Hood to Coast tracker — append-only event log.
-- Paste this whole file into the Supabase SQL editor and click Run.

create table public.events (
  id text primary key,
  team_id text not null,
  v int not null,
  ts bigint not null,
  seen_ts bigint not null,
  device_id text not null,
  role text not null,
  type text not null,
  payload jsonb not null,
  inserted_at timestamptz not null default now()
);

create index events_team_inserted on public.events (team_id, inserted_at);

alter table public.events enable row level security;

create policy "read team" on public.events for select to anon using (length(team_id) >= 20);
create policy "append team" on public.events for insert to anon with check (length(team_id) >= 20);

revoke all on public.events from anon, authenticated;
grant select on public.events to anon;
grant insert (id, team_id, v, ts, seen_ts, device_id, role, type, payload) on public.events to anon;

alter publication supabase_realtime add table public.events;
