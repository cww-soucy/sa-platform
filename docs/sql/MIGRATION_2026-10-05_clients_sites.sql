-- 2026-10-05 — Clients, sites et lieux à classer (sa-admin › Sites & Clients).
-- Un client regroupe plusieurs sites ; un site garde ses bassins / installations (salle mécanique, fontainiers…).
-- Fusion de sites en une seule opération (toutes les données suivent, rien n'est effacé) et classement des
-- « lieux » saisis en texte libre dans les punchs.
-- APPLIQUÉE en production le 2026-10-05 (projet ldqvdiaewvhnukuaxdmc). Idempotente : peut être relancée sans risque. Même niveau d'accès que les autres tables partagées (clé publique).

create table if not exists public.clients (
  id text primary key,
  nom text not null check (length(btrim(nom)) > 0),
  interne boolean not null default false,          -- Soucy Aquatik lui-même : entrepôt, bureau, shop
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sites add column if not exists client_id text references public.clients(id) on delete set null;
create index if not exists sites_client on public.sites(client_id);

-- Nom de lieu (minuscules, sans espaces autour) → site. Sert au classement des punchs saisis en texte libre.
create table if not exists public.lieux_alias (
  lieu text primary key check (lieu = lower(btrim(lieu)) and length(lieu) > 0),
  site_id text not null references public.sites(id) on delete cascade,
  cree_par text,
  cree_le timestamptz not null default now()
);

-- Trace de chaque fusion : ancien identifiant → site conservé (sert aussi à rediriger les vieux QR codes).
create table if not exists public.sites_fusions (
  src text primary key,
  dst text not null,
  src_nom text,
  dst_nom text,
  par text,
  le timestamptz not null default now(),
  n jsonb not null default '{}'
);

alter table public.clients enable row level security;
alter table public.lieux_alias enable row level security;
alter table public.sites_fusions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clients' and policyname='acces_equipe') then
    create policy acces_equipe on public.clients for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lieux_alias' and policyname='acces_equipe') then
    create policy acces_equipe on public.lieux_alias for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sites_fusions' and policyname='sf_select') then
    create policy sf_select on public.sites_fusions for select using (true);
  end if;
end $$;
-- sites_fusions : lecture seule pour la clé publique, écrite uniquement par site_fusionner()
revoke insert, update, delete, truncate on public.sites_fusions from anon, authenticated;
grant select on public.sites_fusions to anon, authenticated;

-- Remplace un identifiant de site dans les punchs (feuilles_temps.days[].tasks[].siteId).
create or replace function public._ft_remplacer_site(p_days jsonb, p_src text, p_dst text) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_agg(
    case when jsonb_typeof(d->'tasks') = 'array' then jsonb_set(d, '{tasks}', coalesce((
      select jsonb_agg(case when t->>'siteId' = p_src then t || jsonb_build_object('siteId', p_dst) else t end order by o)
      from jsonb_array_elements(d->'tasks') with ordinality x(t, o)), '[]'::jsonb))
    else d end order by i), '[]'::jsonb)
  from jsonb_array_elements(p_days) with ordinality y(d, i)
$$;

-- Fusionne le site p_src dans p_dst : toutes les données liées suivent, la fiche p_src reste (marquée « Fusionné → »).
-- p_installation : nom d'installation à ajouter au site conservé quand p_src n'a pas de bassin (ex. « Fontainiers »).
create or replace function public.site_fusionner(p_src text, p_dst text, p_par text default null, p_installation text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.sites; d public.sites; n jsonb := '{}'; k int; t text; b jsonb;
begin
  if p_src is null or p_dst is null or p_src = p_dst then raise exception 'Choisissez deux sites différents'; end if;
  select * into s from public.sites where id = p_src for update;
  select * into d from public.sites where id = p_dst for update;
  if s.id is null or d.id is null then raise exception 'Site introuvable'; end if;
  if coalesce(d.notes, '') ~ '^Fusionné →' then raise exception 'Le site « % » a déjà été fusionné ailleurs', d.nom; end if;
  -- une fusion faite avant le 2026-10-05 (seuls plan et planning_tasks suivaient) peut être complétée ou redirigée

  foreach t in array array['client_qr','demandes','documents','outils_mouvements','photos_chantier','plan','planning_tasks',
                           'punch_gps_log','rapports_hivernage','releves','site_journal','water_logs'] loop
    if to_regclass('public.' || t) is not null then
      execute format('update public.%I set site_id = $1 where site_id = $2', t) using p_dst, p_src;
      get diagnostics k = row_count; if k > 0 then n := n || jsonb_build_object(t, k); end if;
    end if;
  end loop;
  foreach t in array array['demandes','outils_mouvements','planning_tasks','rapports_hivernage','releves'] loop
    execute format('update public.%I set site_nom = $1 where site_id = $2 and site_nom = $3', t) using d.nom, p_dst, s.nom;
  end loop;
  if not exists (select 1 from public.contrats where site_id = p_dst) then
    update public.contrats set site_id = p_dst where site_id = p_src;
  end if;

  update public.feuilles_temps set days = public._ft_remplacer_site(days, p_src, p_dst), updated_at = now()
   where jsonb_typeof(days) = 'array' and days::text like '%"' || p_src || '"%';
  get diagnostics k = row_count; if k > 0 then n := n || jsonb_build_object('feuilles_temps', k); end if;

  update public.client_comptes set sites = (select jsonb_agg(distinct case when v #>> '{}' = p_src then to_jsonb(p_dst) else v end) from jsonb_array_elements(sites) v)
   where jsonb_typeof(sites) = 'array' and sites ? p_src;
  update public.client_contacts set sites = (select jsonb_agg(distinct case when v #>> '{}' = p_src then to_jsonb(p_dst) else v end) from jsonb_array_elements(sites) v)
   where jsonb_typeof(sites) = 'array' and sites ? p_src;

  -- bassins / installations : ceux du site fusionné s'ajoutent au site conservé
  b := coalesce(d.bassins, '[]'::jsonb);
  if jsonb_typeof(s.bassins) = 'array' and jsonb_array_length(s.bassins) > 0 then
    b := b || s.bassins;
  elsif nullif(btrim(p_installation), '') is not null then
    b := b || jsonb_build_array(jsonb_build_object('id', 'b' || p_src, 'nom', btrim(p_installation), 'type', '', 'type_code', 'GEN',
                                                   'notes', '', 'volume', '', 'numero', jsonb_array_length(b) + 1));
  end if;
  update public.sites set bassins = b, client_id = coalesce(d.client_id, s.client_id),
         addr = coalesce(nullif(d.addr, ''), s.addr), gps = coalesce(d.gps, s.gps), updated_at = now()
   where id = p_dst;
  update public.sites set notes = btrim('Fusionné → ' || d.nom || ' [' || d.id || '] le ' || to_char(now() at time zone 'America/Toronto', 'YYYY-MM-DD') || '. ' || coalesce(s.notes, '')),
         client_id = coalesce(d.client_id, s.client_id), updated_at = now()
   where id = p_src;

  update public.lieux_alias set site_id = p_dst where site_id = p_src;
  insert into public.lieux_alias(lieu, site_id, cree_par) values (lower(btrim(s.nom)), p_dst, p_par)
    on conflict (lieu) do update set site_id = excluded.site_id;
  update public.sites_fusions set dst = p_dst, dst_nom = d.nom where dst = p_src;
  insert into public.sites_fusions(src, dst, src_nom, dst_nom, par, n) values (p_src, p_dst, s.nom, d.nom, p_par, n)
    on conflict (src) do update set dst = excluded.dst, dst_nom = excluded.dst_nom, par = excluded.par, le = now(), n = excluded.n;
  return n;
end $$;

-- Classe un lieu saisi en texte libre : retient l'alias et rattache au site les punchs passés de ce lieu qui n'en ont pas.
create or replace function public.lieu_classer(p_lieux text[], p_site text, p_par text default null)
returns int language plpgsql security definer set search_path = public as $$
declare k int; l text; ls text[];
begin
  if not exists (select 1 from public.sites where id = p_site) then raise exception 'Site introuvable'; end if;
  select array_agg(distinct lower(btrim(x))) into ls from unnest(p_lieux) x where length(btrim(x)) > 0;
  if ls is null then raise exception 'Aucun lieu'; end if;
  foreach l in array ls loop
    insert into public.lieux_alias(lieu, site_id, cree_par) values (l, p_site, p_par) on conflict (lieu) do update set site_id = excluded.site_id, cree_par = excluded.cree_par;
  end loop;
  update public.feuilles_temps f set updated_at = now(), days = (
    select coalesce(jsonb_agg(case when jsonb_typeof(d->'tasks') = 'array' then jsonb_set(d, '{tasks}', coalesce((
      select jsonb_agg(case when coalesce(t->>'siteId', '') = '' and lower(btrim(coalesce(t->>'lieu', ''))) = any(ls)
                            then t || jsonb_build_object('siteId', p_site) else t end order by o)
      from jsonb_array_elements(d->'tasks') with ordinality x(t, o)), '[]'::jsonb)) else d end order by i), '[]'::jsonb)
    from jsonb_array_elements(f.days) with ordinality y(d, i))
  where jsonb_typeof(f.days) = 'array' and exists (
    select 1 from jsonb_array_elements(f.days) d, jsonb_array_elements(case when jsonb_typeof(d->'tasks') = 'array' then d->'tasks' else '[]'::jsonb end) t
    where coalesce(t->>'siteId', '') = '' and lower(btrim(coalesce(t->>'lieu', ''))) = any(ls));
  get diagnostics k = row_count;
  return k;
end $$;

-- Les vieux QR codes et les téléphones pas encore à jour envoient parfois l'identifiant d'un site fusionné : on redirige.
create or replace function public.site_canon_fn() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.site_id is not null then
    new.site_id := coalesce((select dst from public.sites_fusions where src = new.site_id), new.site_id);
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['demandes','photos_chantier','punch_gps_log','releves','site_journal','water_logs','client_qr'] loop
    if to_regclass('public.' || t) is not null then
      execute format('create or replace trigger site_canon before insert on public.%I for each row execute function public.site_canon_fn()', t);
    end if;
  end loop;
end $$;

revoke all on function public.site_fusionner(text, text, text, text) from public;
revoke all on function public.lieu_classer(text[], text, text) from public;
grant execute on function public.site_fusionner(text, text, text, text) to anon, authenticated;
grant execute on function public.lieu_classer(text[], text, text) to anon, authenticated;
