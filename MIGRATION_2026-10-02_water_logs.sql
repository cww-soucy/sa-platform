-- 2026-10-02 — Carnet de bord Salle Mécanique (QR) : relevés d'eau saisis en salle mécanique en scannant le QR du site
-- (page qr-carnet/?site=ID_SITE), lus en temps réel par la plateforme de gestion (src/services/waterLogConnector.js).
-- À APPLIQUER dans l'éditeur SQL Supabase (projet ldqvdiaewvhnukuaxdmc) — idempotent, peut être relancé sans risque.
-- Même niveau d'accès que les autres tables partagées (clé publique) — voir la limite connue de sécurité (passation §5).
-- Carnet en AJOUT SEULEMENT : la clé publique peut lire et insérer, jamais modifier ni supprimer (traçabilité sanitaire).
create table if not exists public.water_logs (
  id bigint generated always as identity primary key,
  site_id text not null,                              -- = sites.id (paramètre ?site= du QR)
  technician_name text not null,
  ph_level numeric(4,2) not null,
  free_chlorine numeric(5,2) not null,                -- mg/L
  water_temp numeric(4,1),                            -- °C
  alkalinity numeric(5,1),                            -- mg/L CaCO3
  notes text,
  created_at timestamptz not null default now(),
  -- bornes physiques seulement (fautes de frappe) : une valeur HORS NORME doit pouvoir être consignée
  constraint water_logs_site_chk check (length(btrim(site_id)) > 0),
  constraint water_logs_tech_chk check (length(btrim(technician_name)) > 0),
  constraint water_logs_ph_chk check (ph_level between 0 and 14),
  constraint water_logs_cl_chk check (free_chlorine between 0 and 20),
  constraint water_logs_temp_chk check (water_temp is null or water_temp between 0 and 50),
  constraint water_logs_alc_chk check (alkalinity is null or alkalinity between 0 and 500)
);
create index if not exists water_logs_site_created on public.water_logs(site_id, created_at desc);

alter table public.water_logs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='water_logs' and policyname='wl_select') then
    create policy wl_select on public.water_logs for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='water_logs' and policyname='wl_insert') then
    create policy wl_insert on public.water_logs for insert to anon with check (true);
  end if;
end $$;
grant select, insert on public.water_logs to anon;

-- Supabase Realtime : diffuse les nouvelles saisies (PORT OUT subscribeToWaterLogs)
do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='water_logs') then
    alter publication supabase_realtime add table public.water_logs;
  end if;
end $$;

notify pgrst, 'reload schema';
