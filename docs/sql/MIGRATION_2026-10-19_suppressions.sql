-- 2026-10-19 — Un compte supprimé ne revient plus.
-- Cause : SA Platform (index.html) garde une copie des comptes sur chaque appareil ; à l'ouverture, il relit le
-- serveur SANS retirer ce qui a été supprimé (« un pull ne supprime jamais »), puis renvoie toute sa copie
-- (upsert). Un seul appareil qui avait encore un compte en mémoire le recréait donc (ex. comptes ZZ de test,
-- supprimés 6 fois entre le 30/09 et le 09/10, recréés le 19/10 sans trace dans audit_log).
-- Correctif côté base, valable pour toutes les versions des apps déjà installées sur les appareils :
--   1. chaque suppression d'un compte est retenue dans « suppressions » ;
--   2. une insertion d'un compte retenu est ignorée en silence (le reste de l'envoi passe normalement) ;
--   3. aucune nouvelle feuille de temps n'est créée pour un compte supprimé.
-- Recréer volontairement un compte du même identifiant : sa-admin efface d'abord la ligne de « suppressions ».
create table if not exists public.suppressions (
  table_nom text not null,
  id text not null,
  supprime_le timestamptz not null default now(),
  primary key (table_nom, id)
);
alter table public.suppressions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='suppressions' and policyname='supp_select') then
    create policy supp_select on public.suppressions for select to anon using (true);
    create policy supp_delete on public.suppressions for delete to anon using (true);
  end if;
end $$;
grant select, delete on public.suppressions to anon;

create or replace function public.memoriser_suppression() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.suppressions(table_nom, id) values (TG_TABLE_NAME, OLD.id::text)
  on conflict (table_nom, id) do update set supprime_le = now();
  return OLD;
end; $$;

create or replace function public.refuser_resurrection() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.suppressions where table_nom = TG_TABLE_NAME and id = NEW.id::text) then
    return null; -- ligne ignorée : un appareil renvoie une vieille copie
  end if;
  return NEW;
end; $$;

create or replace function public.refuser_ft_compte_supprime() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.suppressions where table_nom = 'comptes' and id = NEW.uid::text) then
    return null;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_memoriser_suppression on public.comptes;
create trigger trg_memoriser_suppression after delete on public.comptes for each row execute function public.memoriser_suppression();
drop trigger if exists trg_refuser_resurrection on public.comptes;
create trigger trg_refuser_resurrection before insert on public.comptes for each row execute function public.refuser_resurrection();
drop trigger if exists trg_ft_compte_supprime on public.feuilles_temps;
create trigger trg_ft_compte_supprime before insert on public.feuilles_temps for each row execute function public.refuser_ft_compte_supprime();

-- Comptes de test ZZ (recréés à répétition) : supprimés une dernière fois, avec leurs feuilles de temps de test.
delete from public.feuilles_temps where uid in ('zztest', 'zzpm', 'zzsync');
delete from public.comptes where id in ('zztest', 'zzpm', 'zzsync');
notify pgrst, 'reload schema';
