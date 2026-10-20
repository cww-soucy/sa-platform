-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- CORRECTIF 20/10/2026 — APPLIQUÉ en production (migration « correctif_politiques_utilisateurs_connectes »)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Symptôme : après SECURISATION_ETAPE3_PREPARATION.sql, une session avec jeton (rôle « authenticated ») ne voyait plus
-- les relevés, types de bassin, bons de travail, demandes, contrats… dans sa-admin, et ses envois y étaient refusés.
-- Cause : ces tables avaient des politiques « to anon » seulement ; elles ne s'appliquaient pas au rôle authenticated.
-- Correctif : copie à l'identique de chaque politique « to anon » pour authenticated (suffixe _connecte).
-- Ajout seulement : aucun droit retiré ni restreint. SECURISATION_ETAPE3.sql les retire avec les autres (même tables).
do $$ declare p record; begin
  for p in select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and roles = '{anon}' loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = p.tablename and policyname = p.policyname || '_connecte') then
      execute format('create policy %I on public.%I for %s to authenticated%s%s', p.policyname || '_connecte', p.tablename, p.cmd,
        coalesce(' using (' || p.qual || ')', ''), coalesce(' with check (' || p.with_check || ')', ''));
    end if;
  end loop;
end $$;
-- Vérification : select count(*) from pg_policies where schemaname='public' and policyname like '%\_connecte';  → 44
