-- 2026-09-30 — Plusieurs bassins par site + paramètres de relevé modifiables (APPLIQUÉ en production, testé à blanc)
-- 1) releves.bassin : nom du bassin relevé (vide = relevé du site / bassin par défaut, comme avant)
alter table public.releves add column if not exists bassin text;
-- 2) types_bassin : sa-admin › Inspections › Paramètres de relevé peut créer / modifier les types (plages, points de
--    contrôle, produits). Même niveau d'accès que contrats / releves (clé publique) — voir la limite connue de sécurité.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='types_bassin' and policyname='tb_update') then
    create policy tb_update on public.types_bassin for update to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='types_bassin' and policyname='tb_insert') then
    create policy tb_insert on public.types_bassin for insert to anon with check (true);
  end if;
end $$;
notify pgrst, 'reload schema';
