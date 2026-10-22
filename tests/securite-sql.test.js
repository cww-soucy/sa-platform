'use strict';
// Sécurité, étape 3 : SECURISATION_ETAPE3_PREPARATION.sql puis SECURISATION_ETAPE3.sql, appliquées sur une réplique de la
// STRUCTURE de production (tests/sql/production.sql) dans un PostgreSQL local jetable. Les requêtes passent par les rôles
// anon / authenticated et les revendications du jeton (request.jwt.claims), comme PostgREST.
// Sans PostgreSQL installé (initdb), le test est sauté.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BIN = (() => { try { const v = fs.readdirSync('/usr/lib/postgresql').sort().pop(); const b = path.join('/usr/lib/postgresql', v, 'bin'); return fs.existsSync(path.join(b, 'initdb')) ? b : null; } catch (e) { return null; } })();
const ROOT_USER = process.getuid && process.getuid() === 0;
const skip = !BIN && 'PostgreSQL absent (initdb)';
let dir, port;

// initdb / pg_ctl refusent root : on passe alors par l'utilisateur postgres
function asPg(cmd, args) { return ROOT_USER ? ['runuser', ['-u', 'postgres', '--', cmd, ...args]] : [cmd, args]; }
function run(cmd, args, opts) { const [c, a] = asPg(cmd, args); return execFileSync(c, a, Object.assign({ stdio: 'pipe' }, opts)); }
function psql(sql, { db = 'replica', file, cwd } = {}) {
  const args = ['-h', dir, '-p', String(port), '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-qtA', '-X'];
  const r = spawnSync('psql', file ? args.concat(['-f', file]) : args.concat(['-c', sql]), { cwd: cwd || ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
// Requête au nom d'un appelant : sans jeton (anon) ou avec le jeton d'un compte SA
function as(compte, sql, db) {
  const claims = compte ? JSON.stringify({ role: 'authenticated', app_metadata: { compte_id: compte } }) : '';
  const role = compte ? 'authenticated' : 'anon';
  return psql(`begin; set local role ${role}; set local request.jwt.claims to '${claims}'; ${sql}; commit;`, { db });
}
const lignes = (r) => r.out.split('\n').filter(Boolean);
const refuse = (r) => !r.ok && /permission denied|row-level security/.test(r.err);

before(() => {
  if (skip) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-pg-'));
  fs.chmodSync(dir, 0o777);
  port = 55000 + Math.floor(Math.random() * 5000);
  run(path.join(BIN, 'initdb'), ['-D', path.join(dir, 'data'), '-A', 'trust', '-U', 'postgres']);
  run(path.join(BIN, 'pg_ctl'), ['-D', path.join(dir, 'data'), '-o', `-p ${port} -k ${dir} -c listen_addresses=''`, '-w', 'start', '-l', path.join(dir, 'log')]);
  assert.ok(psql('create database replica', { db: 'postgres' }).ok);
  const r = psql('', { file: 'production.sql', cwd: path.join(__dirname, 'sql') });
  assert.ok(r.ok, r.err);
  const seed = psql(`
    insert into comptes(id,prenom,nom,role) values ('cwweil','Charles','W','admin'),('kael','Kaël','T','employe'),('chef','Chef','S','superviseur'),('vieux','V','X','employe');
    update comptes set statut='inactif' where id='vieux';
    insert into comptes_secrets(id,mdp_hash) values ('cwweil',extensions.crypt('Admin-12345',extensions.gen_salt('bf',4))),('kael',extensions.crypt('Kael-1234',extensions.gen_salt('bf',4))),
      ('chef',extensions.crypt('Chef-1234',extensions.gen_salt('bf',4))),('vieux',extensions.crypt('Vieux-1234',extensions.gen_salt('bf',4)));
    insert into app_meta(key,value) values ('created_cutoff','2026-10-01T00:00:00Z');
    insert into sites(id,nom) values ('1','Piscine Alpha');
    insert into punch_gps_log(id,uid,lat,lng) values ('g1','kael',46.8,-71.2);
    insert into facturation(id,client,prix_facture) values ('f1','Ville',1234);
    insert into tech_calendar_connections(id,emp,ics_token) values ('t-kael','kael','secret-kael'),('t-chef','chef','secret-chef');
    insert into feuilles_temps(id,uid,week) values ('kael_w','kael','w'),('chef_w','chef','w');
    insert into sondages(slug,titre,actif) values ('levis','Sondage',true);
    insert into workorders(id,client,created_at) values ('wo-1','Alpha','2026-10-10T00:00:00Z');`);
  assert.ok(seed.ok, seed.err);
});
after(() => { if (!skip) { try { run(path.join(BIN, 'pg_ctl'), ['-D', path.join(dir, 'data'), '-m', 'immediate', 'stop']); } catch (e) { /* déjà arrêté */ } fs.rmSync(dir, { recursive: true, force: true }); } });

const snapshot = () => psql(`select string_agg(format('%s|%s|%s|%s|%s|%s', tablename, policyname, cmd, roles, qual, with_check), E'\\n' order by tablename, policyname) from pg_policies where schemaname='public'`).out
  + psql(`select string_agg(table_name||':'||privilege_type, ',' order by table_name, privilege_type) from information_schema.role_table_grants where table_schema='public' and grantee='anon'`).out;
let avant;

test('préparation : un utilisateur Supabase Auth par compte, même haché, rôle dans le jeton, compte inactif bloqué', { skip }, () => {
  avant = snapshot();
  const r = psql('', { file: 'docs/sql/SECURISATION_ETAPE3_PREPARATION.sql' });
  assert.ok(r.ok, r.err);
  assert.equal(snapshot(), avant, 'la préparation ne change ni politique ni droit');
  const u = psql(`select string_agg(format('%s|%s|%s|%s', u.email, u.raw_app_meta_data->>'compte_id', u.raw_app_meta_data->>'app_role', (u.encrypted_password = s.mdp_hash)), ',' order by u.email)
    from auth.users u join comptes_secrets s on s.id = u.raw_app_meta_data->>'compte_id'`).out;
  assert.equal(u, 'chef@comptes.soucyaquatik.local|chef|superviseur|t,cwweil@comptes.soucyaquatik.local|cwweil|admin|t,kael@comptes.soucyaquatik.local|kael|employe|t,vieux@comptes.soucyaquatik.local|vieux|employe|t');
  assert.equal(psql(`select count(*) from auth.identities`).out, '4');
  assert.equal(psql(`select banned_until > now() + interval '100 years' from auth.users where email like 'vieux@%'`).out, 't');
  assert.equal(psql(`select count(*) from auth.users where banned_until is not null`).out, '1');
});

test('avant l’étape 3 : une session avec jeton voit et écrit les mêmes données que la clé publique (correctif du 20/10)', { skip }, () => {
  // régression du 20/10 : politiques « to anon » seulement → sa-admin connecté ne voyait plus relevés, bons de travail…
  assert.ok(psql(`insert into releves(id,site_id,tech,date) values ('r0','1','kael','2026-10-19'); insert into types_bassin(code,label) values ('GEN','Générique')`).ok);
  for (const t of ['releves', 'types_bassin', 'workorders', 'contrats', 'demandes', 'planning_tasks', 'communications', 'facturation']) {
    assert.deepEqual(lignes(as('kael', `select count(*) from ${t}`)), lignes(as(null, `select count(*) from ${t}`)), t);
  }
  assert.ok(as('kael', `insert into releves(id,site_id,tech,date) values ('r-av','1','kael','2026-10-20')`).ok, 'fiche envoyée avec jeton');
  assert.ok(as('kael', `insert into demandes(id,tech,type) values ('d-av','kael','Matériel')`).ok);
});

test('préparation : changer_mdp, admin_definir_mdp, rôle, statut et suppression restent synchronisés', { skip }, () => {
  assert.equal(psql(`select changer_mdp('kael','Kael-1234','Nouveau-5678')`).out, 't');
  assert.equal(psql(`select encrypted_password = extensions.crypt('Nouveau-5678', encrypted_password) from auth.users where email='kael@comptes.soucyaquatik.local'`).out, 't');
  assert.ok(psql(`insert into comptes(id,prenom,nom) values ('julie','Julie','C')`).ok);
  assert.equal(psql(`select count(*) from auth.users where email='julie@comptes.soucyaquatik.local'`).out, '0', 'pas de mot de passe : pas d’utilisateur');
  assert.equal(psql(`select admin_definir_mdp('cwweil','Admin-12345','julie','Depart-2026')`).out, 't');
  assert.equal(psql(`select encrypted_password = extensions.crypt('Depart-2026', encrypted_password) from auth.users where email='julie@comptes.soucyaquatik.local'`).out, 't');
  assert.ok(psql(`update comptes set role='superviseur' where id='julie'`).ok);
  assert.equal(psql(`select raw_app_meta_data->>'app_role' from auth.users where email='julie@comptes.soucyaquatik.local'`).out, 'superviseur');
  assert.ok(psql(`update comptes set statut='inactif' where id='julie'`).ok);
  assert.equal(psql(`select banned_until is not null from auth.users where email='julie@comptes.soucyaquatik.local'`).out, 't');
  assert.ok(psql(`update comptes set statut='actif' where id='julie'`).ok);
  assert.equal(psql(`select banned_until is null from auth.users where email='julie@comptes.soucyaquatik.local'`).out, 't');
  assert.ok(psql(`delete from comptes where id='julie'`).ok);
  assert.equal(psql(`select count(*) from auth.users where email='julie@comptes.soucyaquatik.local'`).out, '0');
});

test('nouvelle table (Supabase, 30/10/2026) : sans grant, refusée même connecté ; le modèle de docs/sql/README.md la rend utilisable', { skip }, () => {
  assert.ok(psql(`create table public.essai_sans (id text primary key); alter table public.essai_sans enable row level security;`).ok);
  assert.ok(refuse(as('kael', `select * from essai_sans`)), 'pas de droit automatique');
  const modele = fs.readFileSync(path.join(ROOT, 'docs/sql/README.md'), 'utf8').split('```sql')[1].split('```')[0];
  const r = psql(modele.replace(/ma_table/g, 'essai_modele'));
  assert.ok(r.ok, r.err);
  assert.ok(psql(`insert into essai_modele(id) values ('a')`).ok);
  assert.deepEqual(lignes(as('kael', `select count(*) from essai_modele`)), ['1'], 'connecté : lecture');
  assert.ok(refuse(as('kael', `insert into essai_modele(id) values ('b')`)), 'employé : écriture refusée (supervision)');
  assert.ok(as('chef', `insert into essai_modele(id) values ('c')`).ok, 'superviseur : écriture');
  assert.ok(refuse(as(null, `select * from essai_modele`)), 'clé publique seule : rien');
  assert.ok(psql(`drop table essai_sans, essai_modele`).ok);
});

test('étape 3 refusée sans la préparation', { skip }, () => {
  assert.ok(psql('create database vide', { db: 'postgres' }).ok);
  assert.ok(psql('', { db: 'vide', file: 'production.sql', cwd: path.join(__dirname, 'sql') }).ok);
  const r = psql('', { db: 'vide', file: 'docs/sql/SECURISATION_ETAPE3.sql' });
  assert.equal(r.ok, false);
  assert.match(r.err, /Appliquez d'abord SECURISATION_ETAPE3_PREPARATION/);
});

test('sans jeton (clé publique seule) : données personnelles et confidentielles refusées ; connexion, carnet QR et sondages toujours publics', { skip }, () => {
  // avant l'étape 3, la clé publique lisait tout
  assert.deepEqual(lignes(as(null, 'select ics_token from tech_calendar_connections order by 1')), ['secret-chef', 'secret-kael']);
  const r = psql('', { file: 'docs/sql/SECURISATION_ETAPE3.sql' });
  assert.ok(r.ok, r.err);
  for (const t of ['comptes_publics', 'punch_gps_log', 'facturation', 'tech_calendar_connections', 'feuilles_temps', 'comptes', 'clients', 'sites', 'releves', 'workorders', 'bons_livraison', 'projets_excel']) {
    assert.ok(refuse(as(null, `select * from ${t}`)), t + ' lisible sans jeton');
  }
  assert.ok(refuse(as(null, `insert into comptes(id,role) values ('pirate','admin')`)));
  assert.ok(refuse(as(null, `update comptes set role='admin'`)));
  assert.ok(refuse(as(null, `select site_fusionner('1','2')`)));
  assert.ok(refuse(as(null, `select admin_definir_mdp('cwweil','x','kael','12345678')`)));
  // ce qui reste public
  assert.deepEqual(lignes(as(null, `select count(*) from verifier_connexion('cwweil','Admin-12345')`)), ['1']);
  assert.deepEqual(lignes(as(null, `select changer_mdp('kael','mauvais','Autre-1234')`)), ['f']);
  assert.ok(as(null, `insert into water_logs(site_id,technician_name,ph_level,free_chlorine) values ('1','Kaël',7.4,1.2)`).ok, 'carnet QR : ajout');
  assert.deepEqual(lignes(as(null, `select count(*) from water_logs`)), ['1'], 'carnet QR : lecture');
  assert.ok(refuse(as(null, `delete from water_logs`)), 'carnet QR : pas de suppression');
  assert.deepEqual(lignes(as(null, `select carnet_site_nom('1')`)), ['Piscine Alpha']);
  assert.deepEqual(lignes(as(null, `select titre from sondages`)), ['Sondage']);
  assert.ok(as(null, `insert into sondage_reponses(sondage_slug,nom) values ('levis','Client')`).ok, 'réponse à un sondage');
  assert.ok(!as(null, `insert into sondage_reponses(sondage_slug,nom) values ('inconnu','x')`).ok, 'sondage inactif ou inconnu refusé');
  assert.ok(refuse(as(null, `select * from sondage_reponses`)));
  assert.equal(lignes(as(null, `select count(*) from sondage_stats('levis','CW-Soucy-9421-Stats')`))[0], '1', 'statistiques par la clé du sondage');
});

test('connecté : un employé ne modifie pas comptes, un admin oui ; superviseur en lecture ; comptes_publics lisible', { skip }, () => {
  assert.deepEqual(lignes(as('kael', `select count(*) from comptes`)), ['0'], 'employé : comptes illisible (passer par comptes_publics)');
  assert.deepEqual(lignes(as('kael', `select count(*) from comptes_publics`)), ['4']);
  assert.ok(refuse(as('kael', `insert into comptes(id,role) values ('pirate','admin')`)));
  assert.deepEqual(lignes(as('kael', `with x as (update comptes set role='admin' where id='kael' returning 1) select count(*) from x`)), ['0']);
  assert.deepEqual(lignes(as('chef', `select count(*) from comptes`)), ['4'], 'superviseur : lecture');
  assert.deepEqual(lignes(as('chef', `with x as (update comptes set role='admin' where id='chef' returning 1) select count(*) from x`)), ['0'], 'superviseur : pas d’écriture');
  assert.ok(as('cwweil', `insert into comptes(id,prenom,role) values ('nouveau','N','employe')`).ok, 'admin : création');
  assert.deepEqual(lignes(as('cwweil', `with x as (update comptes set role='superviseur' where id='nouveau' returning 1) select count(*) from x`)), ['1'], 'admin : rôle');
  assert.equal(psql(`select role from comptes where id='kael'`).out, 'employe');
  // compte désactivé : son jeton (encore valide une heure) n'ouvre plus rien
  assert.deepEqual(lignes(as('vieux', `select count(*) from sites`)), ['0']);
  assert.deepEqual(lignes(as('inconnu', `select count(*) from sites`)), ['0']);
});

test('connecté : feuilles de temps et GPS — ses lignes ; calendrier — la sienne ; facturation — supervision', { skip }, () => {
  assert.ok(as('kael', `update feuilles_temps set total_h=8 where id='kael_w'`).ok);
  assert.deepEqual(lignes(as('kael', `with x as (update feuilles_temps set total_h=99 where id='chef_w' returning 1) select count(*) from x`)), ['0']);
  assert.ok(refuse(as('kael', `insert into feuilles_temps(id,uid,week) values ('chef_w2','chef','w2')`)));
  assert.ok(as('kael', `insert into feuilles_temps(id,uid,week) values ('kael_w2','kael','w2') on conflict (id) do update set total_h=1`).ok, 'upsert de sa feuille');
  assert.ok(as('chef', `update feuilles_temps set total_h=7 where id='kael_w'`).ok, 'superviseur : approuve / corrige');
  assert.equal(psql(`select total_h from feuilles_temps where id='kael_w'`).out, '7');
  assert.ok(as('kael', `insert into punch_gps_log(id,uid,lat,lng) values ('g2','kael',46.8,-71.2)`).ok);
  assert.ok(refuse(as('kael', `insert into punch_gps_log(id,uid,lat,lng) values ('g3','chef',46.8,-71.2)`)));
  // ajout-ou-mise-à-jour (Prefer: resolution=merge-duplicates) : vérifié comme un ajout → sa-terrain envoie toujours uid
  assert.ok(refuse(as('kael', `insert into punch_gps_log(id,lat) values ('g2',47) on conflict (id) do update set lat=excluded.lat`)));
  assert.ok(as('kael', `insert into punch_gps_log(id,uid,lat) values ('g2','kael',47) on conflict (id) do update set lat=excluded.lat`).ok);
  assert.deepEqual(lignes(as('kael', `select ics_token from tech_calendar_connections`)), ['secret-kael']);
  assert.deepEqual(lignes(as('cwweil', `select count(*) from tech_calendar_connections`)), ['2']);
  assert.deepEqual(lignes(as('kael', `select count(*) from facturation`)), ['0']);
  assert.deepEqual(lignes(as('chef', `select prix_facture from facturation`)), ['1234']);
  assert.ok(as('kael', `insert into releves(id,site_id,tech,date) values ('r1','1','kael','2026-10-20')`).ok);
  assert.ok(refuse(as('kael', `insert into releves(id,site_id,tech,date) values ('r2','1','chef','2026-10-20')`)));
  assert.ok(as('kael', `insert into demandes(id,tech,type) values ('d1','kael','Matériel')`).ok);
  assert.ok(as('chef', `update demandes set statut='Traitée' where id='d1'`).ok);
});

test('connecté : exploitation (SA Platform) — l’équipe lit et écrit, seule la supervision supprime ; garde-fous conservés', { skip }, () => {
  assert.ok(as('kael', `insert into sites(id,nom) values ('2','Ajouté depuis un punch')`).ok);
  assert.ok(as('kael', `insert into workorders(id,client,created_at) values ('wo-insp','Alpha',now())`).ok, 'bon urgent depuis une inspection');
  assert.ok(refuse(as('kael', `insert into workorders(id,client,created_at) values ('wo-vieux','Alpha','2026-01-01')`)), 'wo_insert_fresh conservé');
  assert.ok(as('kael', `update workorders set status='complete' where id='wo-1'`).ok);
  assert.deepEqual(lignes(as('kael', `with x as (delete from sites where id='2' returning 1) select count(*) from x`)), ['0'], 'employé : pas de suppression');
  assert.deepEqual(lignes(as('chef', `with x as (delete from sites where id='2' returning 1) select count(*) from x`)), ['1']);
  assert.ok(as('kael', `insert into audit_log(acteur,action) values ('kael','TEST')`).ok);
  assert.deepEqual(lignes(as('cwweil', `select count(*) from audit_log`)), ['0'], 'journal : ajout seulement');
  assert.ok(as('kael', `insert into communication_lectures(id,comm_id,uid) values ('c1_kael','c1','kael')`).ok);
  assert.ok(refuse(as('kael', `insert into communication_lectures(id,comm_id,uid) values ('c1_chef','c1','chef')`)));
  assert.ok(refuse(as('kael', `insert into communications(id,titre) values ('c2','x')`)), 'communications : supervision');
  assert.ok(as('chef', `insert into communications(id,titre) values ('c2','x')`).ok);
  assert.ok(as('chef', `select site_fusionner('1','2')`).ok, 'fonctions de sa-admin : connecté');
  assert.equal(psql(`select count(*) from histo_modifs`).out !== '0', true, 'historique toujours alimenté');
});

test('retour arrière : droits et politiques exactement comme avant', { skip }, () => {
  const src = fs.readFileSync(path.join(ROOT, 'docs/sql/SECURISATION_ETAPE3.sql'), 'utf8');
  const bloc = src.split('RETOUR ARRIÈRE')[1].split('\n').filter((l) => l.startsWith('-- ')).map((l) => l.slice(3)).join('\n');
  const f = path.join(dir, 'retour.sql');
  fs.writeFileSync(f, bloc.slice(bloc.indexOf('begin;')));
  fs.chmodSync(f, 0o644);
  const r = psql('', { file: f });
  assert.ok(r.ok, r.err);
  assert.equal(snapshot(), avant);
  assert.deepEqual(lignes(as(null, `select count(*) from comptes_publics`)), ['5'], 'la clé publique relit comme avant');
});

test('MIGRATION_2026-10-22_gabarits_ouvrages : nouvelles tables utilisables (droits explicites), puis couvertes par l’étape 3 et son retour arrière', { skip }, () => {
  const db = 'ouvrages';
  assert.ok(psql(`create database ${db}`, { db: 'postgres' }).ok);
  assert.ok(psql('', { db, file: 'production.sql', cwd: path.join(__dirname, 'sql') }).ok);
  assert.ok(psql(`insert into comptes(id,prenom,nom,role) values ('kael','Kaël','T','employe'),('chef','Chef','S','superviseur');
    insert into comptes_secrets(id,mdp_hash) values ('kael',extensions.crypt('Kael-1234',extensions.gen_salt('bf',4))),('chef',extensions.crypt('Chef-1234',extensions.gen_salt('bf',4)));`, { db }).ok);
  let r = psql('', { db, file: 'docs/sql/MIGRATION_2026-10-22_gabarits_ouvrages.sql' });
  assert.ok(r.ok, r.err);
  assert.ok(psql('', { db, file: 'docs/sql/MIGRATION_2026-10-22_gabarits_ouvrages.sql' }).ok, 'réexécutable');
  const ajout = (id) => `insert into ouvrage_ajustements(id,site_id,domaine,action,ref) values ('${id}','1','hiv','exclure','fontaine:p1-0')`;
  // avant l'étape 3 : clé publique et jeton (aucun droit automatique sur une table neuve : sans grant, « permission denied »)
  assert.deepEqual(lignes(as(null, `select count(*) from gabarits_hivernage`, db)), ['3']);
  assert.deepEqual(lignes(as('kael', `select count(*) from gabarits_hivernage`, db)), ['3']);
  assert.ok(as(null, ajout('a-anon'), db).ok);
  assert.ok(as('kael', ajout('a-kael') + `; update ouvrage_ajustements set actif=false where id='a-kael'`, db).ok);
  assert.ok(psql('', { db, file: 'docs/sql/SECURISATION_ETAPE3_PREPARATION.sql' }).ok);
  r = psql('', { db, file: 'docs/sql/SECURISATION_ETAPE3.sql' });
  assert.ok(r.ok, r.err);
  assert.ok(refuse(as(null, `select * from gabarits_hivernage`, db)), 'sans jeton : gabarits');
  assert.ok(refuse(as(null, ajout('a-anon2'), db)), 'sans jeton : ajustements');
  assert.deepEqual(lignes(as('kael', `select count(*) from gabarits_hivernage`, db)), ['3']);
  assert.ok(as('kael', ajout('a-kael2') + `; update ouvrage_ajustements set actif=false where id='a-kael2'`, db).ok, 'technicien : ajoute et annule');
  assert.deepEqual(lignes(as('kael', `with x as (update gabarits_hivernage set nom='x' returning 1) select count(*) from x`, db)), ['0'], 'gabarits : supervision');
  assert.deepEqual(lignes(as('chef', `with x as (update gabarits_hivernage set alerte='' where code='fontaine' returning 1) select count(*) from x`, db)), ['1']);
  // retour arrière : la clé publique retrouve l'accès de la migration
  const src = fs.readFileSync(path.join(ROOT, 'docs/sql/SECURISATION_ETAPE3.sql'), 'utf8');
  const bloc = src.split('RETOUR ARRIÈRE')[1].split('\n').filter((l) => l.startsWith('-- ')).map((l) => l.slice(3)).join('\n');
  const f = path.join(dir, 'retour-ouvrages.sql');
  fs.writeFileSync(f, bloc.slice(bloc.indexOf('begin;')));
  fs.chmodSync(f, 0o644);
  r = psql('', { db, file: f });
  assert.ok(r.ok, r.err);
  assert.ok(as(null, ajout('a-anon3'), db).ok);
  assert.deepEqual(lignes(as(null, `select count(*) from ouvrage_ajustements`, db)), ['4']);
});
