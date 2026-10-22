-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- SÉCURISATION — ÉTAPE 3 : plus aucun accès à la base avec la seule clé publique
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- PRÉREQUIS (dans cet ordre) :
--   1. SECURISATION_ETAPE3_PREPARATION.sql appliquée (comptes de connexion Supabase Auth) ;
--   2. PR des apps fusionnée et en ligne (SA Platform v81+, sa-terrain, sa-admin envoient le jeton) ;
--   3. quelques jours plus tard, quand les téléphones sont à jour : ce fichier.
-- Le script refuse de s'exécuter si l'étape 1 manque.
--
-- Après ce fichier :
--   • Sans connexion (clé publique seule) : plus rien, SAUF
--       - rpc verifier_connexion, rpc changer_mdp (écran de connexion) ;
--       - water_logs en lecture + ajout et rpc carnet_site_nom (carnet de bord QR des salles mécaniques) ;
--       - sondages actifs en lecture + sondage_reponses en ajout, et les rpc sondage_* protégées par leur clé
--         (sondages envoyés aux clients et page de statistiques) ;
--       - le portail client ne change pas (fonction serveur avec la clé de service).
--   • Connecté (jeton signé : compte_id + app_role) — « employé » = tout compte actif :
--       - comptes : lecture admin + superviseur ; création, modification, suppression : admin seulement.
--         comptes_publics (nom, téléphone, courriel) : lisible seulement connecté ;
--       - tech_calendar_connections : chacun sa ligne, l'admin tout (planning-ics garde la clé de service) ;
--       - facturation, projets_excel : admin + superviseur ;
--       - feuilles_temps, punch_gps_log, releves, demandes : lecture par l'équipe, écriture de SES lignes
--         (uid / tech = son identifiant), admin + superviseur écrivent tout ;
--       - communication_lectures, preferences_comptes : ses propres lignes ;
--       - gabarits_hivernage (écriture admin + superviseur), ouvrage_ajustements (équipe) — si la migration du 22/10 est appliquée ;
--       - communications, types_bassin, inspection_points, contrats, clients, feuilles_temps_envois,
--         ft_envois, sondages : lecture par l'équipe, écriture admin + superviseur ;
--       - tables d'exploitation que SA Platform renvoie EN ENTIER depuis chaque appareil (sites, workorders,
--         plan, planning_tasks, plan_match, flotte, inventaire, sorties_inventaire, bons_livraison,
--         rapports_hivernage, site_journal, photos_chantier, outils, outils_mouvements, logistique_config,
--         planning_conflicts, lieux_alias) : lecture et écriture par l'équipe connectée, SUPPRESSION par
--         admin + superviseur. Voir la PR : les restreindre davantage bloquerait SA Platform sur le terrain ;
--       - garde-fous conservés : wo_insert_fresh / pt_insert_fresh (created_cutoff), audit_log en ajout
--         seulement, déclencheurs d'historique et anti-résurrection inchangés.
--
-- VÉRIFICATIONS après exécution (remplacer <clé> par la clé publique sb_publishable_…, depuis n'importe quel poste) :
--   curl -s 'https://ldqvdiaewvhnukuaxdmc.supabase.co/rest/v1/comptes_publics?select=id' -H 'apikey: <clé>'
--     → {"code":"42501",… "permission denied …"}            (avant : la liste des employés)
--   même chose avec punch_gps_log, facturation, tech_calendar_connections, feuilles_temps → refusé
--   curl -s 'https://ldqvdiaewvhnukuaxdmc.supabase.co/rest/v1/water_logs?select=id&limit=1' -H 'apikey: <clé>' → [ … ] (carnet QR)
--   Puis : se connecter dans sa-terrain, SA Platform, sa-admin ; ouvrir un carnet QR ; ouvrir un sondage client.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$ begin
  if to_regprocedure('public.sa_role()') is null
     or not exists (select 1 from auth.users where email like '%@comptes.soucyaquatik.local') then
    raise exception 'Appliquez d''abord SECURISATION_ETAPE3_PREPARATION.sql (aucun compte de connexion)';
  end if;
end $$;

-- ───────── 1. Clé publique (anon) : plus rien, sauf ce qui doit rester public ─────────
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
-- PUBLIC inclut anon : on retire l'exécution à PUBLIC, puis on la rend explicitement à authenticated / service_role
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.rapport_audit(text, integer), public.reinitialiser_mdp(text, text, text),
  public.supprimer_secret_compte(), public.sa_auth_sync(text), public.sa_auth_sync_trg() from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon;

grant select, insert on public.water_logs to anon;
grant select on public.sondages to anon;
grant insert on public.sondage_reponses to anon;
grant execute on function public.verifier_connexion(text, text), public.changer_mdp(text, text, text), public.carnet_site_nom(text),
  public.sondage_stats(text, text), public.sondages_liste(text), public.sondage_enregistrer(text, text, text, text, boolean) to anon;

revoke all on public.comptes_publics from anon;
grant select on public.comptes_publics to authenticated;

-- ───────── 2. Politiques : on retire celles en « true » et on les remplace ─────────
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename = any (array[
    'app_meta','audit_log','bons_livraison','clients','communication_lectures','communications','comptes','contrats','demandes',
    'facturation','feuilles_temps','feuilles_temps_envois','flotte','ft_envois','inspection_points','inventaire','lieux_alias',
    'logistique_config','outils','outils_mouvements','photos_chantier','plan','plan_match','planning_conflicts','planning_tasks',
    'preferences_comptes','projets_excel','punch_gps_log','rapports_hivernage','releves','site_journal','sites','sites_fusions',
    'sondage_reponses','sondages','sorties_inventaire','suppressions','tech_calendar_connections','types_bassin','water_logs','workorders',
    'gabarits_hivernage','ouvrage_ajustements'])
  loop execute format('drop policy %I on public.%I', p.policyname, p.tablename); end loop;
end $$;

-- Abréviations utilisées ci-dessous (évaluées une fois par requête grâce au « select ») :
--   connecté   : (select public.sa_role()) is not null           — compte actif identifié par le jeton
--   sup        : (select public.sa_role()) in ('admin','superviseur')
--   admin      : (select public.sa_role()) = 'admin'
--   moi        : (select public.sa_compte())

-- Lecture par l'équipe, écriture admin + superviseur
do $$ declare t text; begin
  foreach t in array array['communications','types_bassin','inspection_points','contrats','clients','feuilles_temps_envois','ft_envois','sondages'] loop
    execute format('create policy sa3_lecture on public.%I for select to authenticated using ((select public.sa_role()) is not null)', t);
    execute format('create policy sa3_ecriture_sup on public.%I for all to authenticated using ((select public.sa_role()) in (''admin'',''superviseur'')) with check ((select public.sa_role()) in (''admin'',''superviseur''))', t);
  end loop;
end $$;

-- Tables d'exploitation (SA Platform les renvoie en entier depuis chaque appareil) : l'équipe lit et écrit, admin + superviseur suppriment
do $$ declare t text; begin
  foreach t in array array['sites','plan','plan_match','flotte','inventaire','sorties_inventaire','bons_livraison','rapports_hivernage',
                           'site_journal','photos_chantier','outils','outils_mouvements','logistique_config','planning_conflicts','lieux_alias',
                           'workorders','planning_tasks'] loop
    execute format('create policy sa3_lecture on public.%I for select to authenticated using ((select public.sa_role()) is not null)', t);
    execute format('create policy sa3_modif on public.%I for update to authenticated using ((select public.sa_role()) is not null) with check ((select public.sa_role()) is not null)', t);
    execute format('create policy sa3_suppr on public.%I for delete to authenticated using ((select public.sa_role()) in (''admin'',''superviseur''))', t);
    if t not in ('workorders','planning_tasks') then
      execute format('create policy sa3_ajout on public.%I for insert to authenticated with check ((select public.sa_role()) is not null)', t);
    end if;
  end loop;
end $$;
-- Garde-fou anti-doublon conservé tel quel (created_cutoff)
create policy wo_insert_fresh on public.workorders for insert to authenticated with check ((select public.sa_role()) is not null and
  ((created_at is null) or (created_at >= ((select app_meta.value from public.app_meta where (app_meta.key = 'created_cutoff'::text)))::timestamp with time zone)));
create policy pt_insert_fresh on public.planning_tasks for insert to authenticated with check ((select public.sa_role()) is not null and
  ((created_at is null) or (created_at >= ((select app_meta.value from public.app_meta where (app_meta.key = 'created_cutoff'::text)))::timestamp with time zone)));

-- Ses propres lignes (admin + superviseur : toutes)
do $$ declare t text; c text; begin
  foreach t in array array['feuilles_temps:uid','punch_gps_log:uid','releves:tech','demandes:tech'] loop
    c := split_part(t, ':', 2); t := split_part(t, ':', 1);
    execute format('create policy sa3_lecture on public.%I for select to authenticated using ((select public.sa_role()) is not null)', t);
    execute format('create policy sa3_ajout on public.%I for insert to authenticated with check (%I = (select public.sa_compte()) and (select public.sa_role()) is not null or (select public.sa_role()) in (''admin'',''superviseur''))', t, c);
    execute format('create policy sa3_modif on public.%I for update to authenticated using (%I = (select public.sa_compte()) and (select public.sa_role()) is not null or (select public.sa_role()) in (''admin'',''superviseur'')) with check (%I = (select public.sa_compte()) and (select public.sa_role()) is not null or (select public.sa_role()) in (''admin'',''superviseur''))', t, c, c);
    execute format('create policy sa3_suppr on public.%I for delete to authenticated using ((select public.sa_role()) in (''admin'',''superviseur''))', t);
  end loop;
end $$;

-- Inspection / hivernage par ouvrage (MIGRATION_2026-10-22_gabarits_ouvrages.sql, si appliquée) :
-- gabarits lus par l'équipe, modifiés par admin + superviseur ; ajustements lus, ajoutés et annulés par l'équipe (jamais supprimés)
do $$ begin
  if to_regclass('public.gabarits_hivernage') is not null then
    create policy sa3_lecture on public.gabarits_hivernage for select to authenticated using ((select public.sa_role()) is not null);
    create policy sa3_ecriture_sup on public.gabarits_hivernage for all to authenticated
      using ((select public.sa_role()) in ('admin','superviseur')) with check ((select public.sa_role()) in ('admin','superviseur'));
  end if;
  if to_regclass('public.ouvrage_ajustements') is not null then
    create policy sa3_lecture on public.ouvrage_ajustements for select to authenticated using ((select public.sa_role()) is not null);
    create policy sa3_ajout on public.ouvrage_ajustements for insert to authenticated with check ((select public.sa_role()) is not null);
    create policy sa3_modif on public.ouvrage_ajustements for update to authenticated
      using ((select public.sa_role()) is not null) with check ((select public.sa_role()) is not null);
  end if;
end $$;

create policy sa3_lecture on public.communication_lectures for select to authenticated using ((select public.sa_role()) is not null);
create policy sa3_ajout on public.communication_lectures for insert to authenticated with check (uid = (select public.sa_compte()) and (select public.sa_role()) is not null);
create policy sa3_modif on public.communication_lectures for update to authenticated
  using (uid = (select public.sa_compte()) and (select public.sa_role()) is not null) with check (uid = (select public.sa_compte()));

create policy sa3_les_miennes on public.preferences_comptes for all to authenticated
  using (uid = (select public.sa_compte()) and (select public.sa_role()) is not null) with check (uid = (select public.sa_compte()) and (select public.sa_role()) is not null);

-- Comptes : lecture admin + superviseur, écriture admin
create policy sa3_lecture_sup on public.comptes for select to authenticated using ((select public.sa_role()) in ('admin','superviseur'));
create policy sa3_ecriture_admin on public.comptes for all to authenticated using ((select public.sa_role()) = 'admin') with check ((select public.sa_role()) = 'admin');

-- Lien calendrier : chacun le sien, l'admin tous
create policy sa3_le_mien on public.tech_calendar_connections for all to authenticated
  using (emp = (select public.sa_compte()) and (select public.sa_role()) is not null or (select public.sa_role()) = 'admin')
  with check (emp = (select public.sa_compte()) and (select public.sa_role()) is not null or (select public.sa_role()) = 'admin');

-- Facturation, projets Excel : admin + superviseur
create policy sa3_sup on public.facturation for all to authenticated
  using ((select public.sa_role()) in ('admin','superviseur')) with check ((select public.sa_role()) in ('admin','superviseur'));
create policy sa3_sup on public.projets_excel for all to authenticated
  using ((select public.sa_role()) in ('admin','superviseur')) with check ((select public.sa_role()) in ('admin','superviseur'));

-- Journal d'audit : ajout seulement (aucune lecture, modification ni suppression par l'API)
create policy audit_insert on public.audit_log for insert to authenticated with check ((select public.sa_role()) is not null);

-- Divers
create policy sa3_lecture on public.app_meta for select to authenticated using ((select public.sa_role()) is not null);
create policy sa3_lecture on public.sites_fusions for select to authenticated using ((select public.sa_role()) is not null);
create policy sa3_lecture on public.suppressions for select to authenticated using ((select public.sa_role()) is not null);
create policy sa3_suppr on public.suppressions for delete to authenticated using ((select public.sa_role()) in ('admin','superviseur'));

-- Public : carnet QR, sondages clients
create policy wl_select on public.water_logs for select to anon, authenticated using (true);
create policy wl_insert on public.water_logs for insert to anon, authenticated with check (true);
create policy sondages_select_actif on public.sondages for select to anon using (actif = true);
create policy sondage_reponses_insert on public.sondage_reponses for insert to anon, authenticated
  with check (sondage_slug in (select s.slug from public.sondages s where s.actif = true));

commit;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- RETOUR ARRIÈRE — rétablit EXACTEMENT les droits et politiques d'avant (relevés le 2026-10-20)
-- Copier tout le bloc ci-dessous dans le SQL Editor, retirer les « -- » de début de ligne, exécuter.
-- Les apps continuent de marcher : les anciennes politiques sont recréées pour la clé publique ET pour les sessions avec jeton.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- begin;
-- do $$ declare p record; begin
--   for p in select policyname, tablename from pg_policies where schemaname = 'public' and (policyname like 'sa3\_%' or policyname in
--     ('wo_insert_fresh','pt_insert_fresh','audit_insert','wl_select','wl_insert','sondages_select_actif','sondage_reponses_insert'))
--   loop execute format('drop policy %I on public.%I', p.policyname, p.tablename); end loop;
-- end $$;
-- grant all on public.app_meta, public.audit_log, public.bons_livraison, public.clients, public.communication_lectures, public.communications,
--   public.comptes, public.comptes_publics, public.contrats, public.demandes, public.facturation, public.feuilles_temps, public.feuilles_temps_envois,
--   public.feuilles_temps_hist, public.flotte, public.ft_envois, public.histo_modifs, public.inspection_points, public.inventaire, public.lieux_alias,
--   public.logistique_config, public.outils, public.outils_mouvements, public.photos_chantier, public.plan, public.plan_match, public.planning_conflicts,
--   public.planning_tasks, public.preferences_comptes, public.projets_excel, public.punch_gps_log, public.rapports_hivernage, public.releves,
--   public.site_journal, public.sites, public.sondage_reponses, public.sondages, public.sorties_inventaire, public.suppressions,
--   public.tech_calendar_connections, public.types_bassin, public.workorders to anon;
-- grant select, references, trigger on public.sites_fusions to anon;
-- grant select, insert on public.water_logs to anon;
-- grant usage on all sequences in schema public to anon;
-- grant execute on all functions in schema public to public;
-- revoke execute on function public.rapport_audit(text, integer), public.reinitialiser_mdp(text, text, text), public.supprimer_secret_compte(),
--   public.sa_auth_sync(text), public.sa_auth_sync_trg() from public, anon, authenticated;
-- alter default privileges in schema public grant all on tables to anon;
-- alter default privileges in schema public grant all on sequences to anon;
-- alter default privileges in schema public grant execute on functions to public;
-- create policy acces_equipe on public.comptes as permissive for all to public using (true) with check (true);
-- create policy acces_equipe on public.sites as permissive for all to public using (true) with check (true);
-- create policy acces_equipe on public.flotte as permissive for all to public using (true) with check (true);
-- create policy acces_equipe on public.inventaire as permissive for all to public using (true) with check (true);
-- create policy acces_equipe on public.plan as permissive for all to public using (true) with check (true);
-- create policy acces_equipe on public.feuilles_temps as permissive for all to public using (true) with check (true);
-- create policy "Allow all - sorties select" on public.sorties_inventaire as permissive for select to public using (true);
-- create policy "Allow all - sorties insert" on public.sorties_inventaire as permissive for insert to public with check (true);
-- create policy "Allow all - sorties update" on public.sorties_inventaire as permissive for update to public using (true);
-- create policy "Allow all - sorties delete" on public.sorties_inventaire as permissive for delete to public using (true);
-- create policy rw_all_plan_match on public.plan_match as permissive for all to public using (true) with check (true);
-- create policy rw_all_punch_gps_log on public.punch_gps_log as permissive for all to public using (true) with check (true);
-- create policy rw_all_site_journal on public.site_journal as permissive for all to public using (true) with check (true);
-- create policy audit_insert on public.audit_log as permissive for insert to public with check (true);
-- create policy audit_no_read on public.audit_log as permissive for select to public using (false);
-- create policy audit_no_update on public.audit_log as permissive for update to public using (false);
-- create policy audit_no_delete on public.audit_log as permissive for delete to public using (false);
-- create policy comptes_no_direct_read on public.comptes as permissive for select to public using (false);
-- create policy comptes_write on public.comptes as permissive for insert to public with check (true);
-- create policy comptes_update on public.comptes as permissive for update to public using (true);
-- create policy photos_rw on public.photos_chantier as permissive for all to public using (true) with check (true);
-- create policy rw_all_bons_livraison on public.bons_livraison as permissive for all to public using (true) with check (true);
-- create policy tech_calendar_connections_all on public.tech_calendar_connections as permissive for all to public using (true) with check (true);
-- create policy planning_conflicts_all on public.planning_conflicts as permissive for all to public using (true) with check (true);
-- create policy rw_all_rapports_hivernage on public.rapports_hivernage as permissive for all to public using (true) with check (true);
-- create policy acces_equipe on public.feuilles_temps_envois as permissive for all to public using (true) with check (true);
-- create policy acces_equipe on public.outils as permissive for all to public using (true) with check (true);
-- create policy acces_equipe on public.outils_mouvements as permissive for all to public using (true) with check (true);
-- create policy acces_equipe on public.logistique_config as permissive for all to public using (true) with check (true);
-- create policy sondages_select_actif on public.sondages as permissive for select to anon using ((actif = true));
-- create policy sondage_reponses_insert on public.sondage_reponses as permissive for insert to anon with check ((sondage_slug in (select sondages.slug from sondages where (sondages.actif = true))));
-- create policy sondages_insert on public.sondages as permissive for insert to anon with check (((slug is not null) and (titre is not null)));
-- create policy app_meta_select on public.app_meta as permissive for select to anon using (true);
-- create policy wo_select on public.workorders as permissive for select to anon using (true);
-- create policy wo_update_delete on public.workorders as permissive for update to anon using (true) with check (true);
-- create policy wo_delete on public.workorders as permissive for delete to anon using (true);
-- create policy wo_insert_fresh on public.workorders as permissive for insert to anon with check (((created_at is null) or (created_at >= ((select app_meta.value from app_meta where (app_meta.key = 'created_cutoff'::text)))::timestamp with time zone)));
-- create policy pt_select on public.planning_tasks as permissive for select to anon using (true);
-- create policy pt_update_delete on public.planning_tasks as permissive for update to anon using (true) with check (true);
-- create policy pt_delete on public.planning_tasks as permissive for delete to anon using (true);
-- create policy pt_insert_fresh on public.planning_tasks as permissive for insert to anon with check (((created_at is null) or (created_at >= ((select app_meta.value from app_meta where (app_meta.key = 'created_cutoff'::text)))::timestamp with time zone)));
-- create policy tb_select on public.types_bassin as permissive for select to anon using (true);
-- create policy ct_select on public.contrats as permissive for select to anon using (true);
-- create policy rl_select on public.releves as permissive for select to anon using (true);
-- create policy rl_insert on public.releves as permissive for insert to anon with check (true);
-- create policy rl_update on public.releves as permissive for update to anon using (true) with check (true);
-- create policy dm_select on public.demandes as permissive for select to anon using (true);
-- create policy dm_insert on public.demandes as permissive for insert to anon with check (true);
-- create policy dm_update on public.demandes as permissive for update to anon using (true) with check (true);
-- create policy ct_insert on public.contrats as permissive for insert to anon with check (true);
-- create policy ct_update on public.contrats as permissive for update to anon using (true) with check (true);
-- create policy pe_select on public.projets_excel as permissive for select to anon using (true);
-- create policy fa_select on public.facturation as permissive for select to anon using (true);
-- create policy fa_update on public.facturation as permissive for update to anon using (true) with check (true);
-- create policy fte_select on public.ft_envois as permissive for select to anon using (true);
-- create policy fte_insert on public.ft_envois as permissive for insert to anon with check (true);
-- create policy fte_update on public.ft_envois as permissive for update to anon using (true) with check (true);
-- create policy tb_update on public.types_bassin as permissive for update to anon using (true) with check (true);
-- create policy tb_insert on public.types_bassin as permissive for insert to anon with check (true);
-- create policy comm_all on public.communications as permissive for all to anon using (true) with check (true);
-- create policy comml_select on public.communication_lectures as permissive for select to anon using (true);
-- create policy comml_insert on public.communication_lectures as permissive for insert to anon with check (true);
-- create policy comml_update on public.communication_lectures as permissive for update to anon using (true) with check (true);
-- create policy wl_select on public.water_logs as permissive for select to anon using (true);
-- create policy wl_insert on public.water_logs as permissive for insert to anon with check (true);
-- create policy ip_select on public.inspection_points as permissive for select to anon using (true);
-- create policy ip_insert on public.inspection_points as permissive for insert to anon with check (true);
-- create policy ip_update on public.inspection_points as permissive for update to anon using (true) with check (true);
-- create policy acces_equipe on public.clients as permissive for all to public using (true) with check (true);
-- create policy acces_equipe on public.lieux_alias as permissive for all to public using (true) with check (true);
-- create policy sf_select on public.sites_fusions as permissive for select to public using (true);
-- create policy prefc_select on public.preferences_comptes as permissive for select to anon using (true);
-- create policy prefc_insert on public.preferences_comptes as permissive for insert to anon with check (true);
-- create policy prefc_update on public.preferences_comptes as permissive for update to anon using (true) with check (true);
-- create policy supp_select on public.suppressions as permissive for select to anon using (true);
-- create policy supp_delete on public.suppressions as permissive for delete to anon using (true);
-- -- les mêmes pour les sessions avec jeton (CORRECTIF_2026-10-20_politiques_connectes.sql) : sans elles, sa-admin et les apps
-- -- connectées ne verraient plus relevés, bons de travail, demandes…
-- do $c$ declare p record; begin
--   for p in select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and roles = '{anon}' loop
--     execute format('create policy %I on public.%I for %s to authenticated%s%s', p.policyname || '_connecte', p.tablename, p.cmd,
--       coalesce(' using (' || p.qual || ')', ''), coalesce(' with check (' || p.with_check || ')', ''));
--   end loop;
-- end $c$;
-- -- gabarits_hivernage, ouvrage_ajustements (si MIGRATION_2026-10-22_gabarits_ouvrages.sql est appliquée) : droits et politiques de la migration
-- do $o$ declare t text; r text; begin
--   foreach t in array array['gabarits_hivernage','ouvrage_ajustements'] loop
--     if to_regclass('public.' || t) is not null then
--       execute format('grant select, insert, update on public.%I to anon', t);
--       foreach r in array array['anon','authenticated'] loop
--         execute format('create policy %I on public.%I for select to %I using (true)', t||'_select_'||r, t, r);
--         execute format('create policy %I on public.%I for insert to %I with check (true)', t||'_insert_'||r, t, r);
--         execute format('create policy %I on public.%I for update to %I using (true) with check (true)', t||'_update_'||r, t, r);
--       end loop;
--     end if;
--   end loop;
-- end $o$;
-- commit;
