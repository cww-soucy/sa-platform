'use strict';
// Modules activables / désactivables (sa-admin › Affichage des apps › Modules) et « aucun prix dans les apps » — 2026-11-19.
// Un module désactivé l'est pour tout le monde (administrateurs compris) : écrans retirés, lien direct refusé,
// et la base refuse ses données (politiques restrictives de MIGRATION_2026-11-19_modules_actifs.sql).
// La partie SQL tourne sur une réplique de la structure de production dans un PostgreSQL jetable (sautée sans initdb).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');
const A = require('../src/affichage/affichage.js');

const ROOT = path.join(__dirname, '..');
const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
const SUP = { id: 'chef', prenom: 'Chef', nom: 'Équipe', role: 'superviseur' };
const TECH = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
const OFF = (...ids) => ids.map((id) => ({ id, actif: false, updated_by: 'cwweil', updated_at: '2026-11-19T10:00:00Z' }));
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });
const ready = (page) => page.waitForFunction(() => window.__admin && window.__admin.D);
const menu = (page) => page.locator('nav').first().innerText();
const cache = (page, sel) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).display === 'none');

test('catalogue : chaque clé de module existe ; un module désactivé masque même ce qui est verrouillé ou réaffiché', () => {
  A.MODULES.forEach((m) => Object.keys(m.cles).forEach((app) => m.cles[app].forEach((k) => assert.ok(A.ITEMS[app][k], m.id + ' : clé inconnue ' + app + ' ' + k))));
  const regles = [{ id: 'admin|compte:cwweil', app: 'admin', cible: 'compte:cwweil', masques: { 'menu.facturation': false } }];
  const e = A.resoudre(regles, 'admin', { role: 'admin', compte: 'cwweil' }, null, OFF('facturation', 'hivernage'));
  assert.equal(A.visible(e, 'menu.facturation'), false, 'un réaffichage par profil ne rallume pas un module désactivé');
  assert.equal(A.visible(e, 'sites.hiv'), false);
  assert.equal(A.visible(e, 'fiche.hiver'), false);
  assert.equal(A.visible(e, 'menu.stats'), true);
  assert.equal(e.off['menu.facturation'], 'facturation');
  assert.equal(A.visible(A.resoudre(regles, 'admin', { role: 'admin' }, null, [{ id: 'facturation', actif: true }]), 'menu.facturation'), true, 'actif = visible');
  assert.equal(A.visible(A.resoudre([], 'admin', { role: 'admin' }, null, [{ id: 'inconnu', actif: false }]), 'menu.stats'), true, 'module inconnu ignoré');
  const t = A.resoudre([], 'terrain', { role: 'employe' }, null, OFF('demandes'));
  assert.equal(A.visible(t, 'onglet.demandes'), false);
  assert.equal(A.visible(t, 'accueil.demande'), false, 'la tuile suit son onglet');
});

test('migration : les tables bloquées dans la base correspondent au catalogue des modules', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'docs/sql/MIGRATION_2026-11-19_modules_actifs.sql'), 'utf8').replace(/--[^\n]*/g, '');
  const enBase = [...sql.matchAll(/\('([a-z_]+)',\s*'\(+(?:select public\.sa_module_actif\(''([a-z]+)''\)\)?(?: or )?)+/g)].map((m) => m[1]).sort();
  const parModule = {};
  for (const m of sql.matchAll(/\('([a-z_]+)',\s*'([^\n]*)'\)/g)) parModule[m[1]] = [...m[2].matchAll(/sa_module_actif\(''([a-z]+)''\)/g)].map((x) => x[1]);
  const attendu = [].concat(...A.MODULES.map((m) => m.tables)).sort();
  assert.deepEqual(Object.keys(parModule).sort(), attendu);
  assert.deepEqual(enBase, attendu);
  A.MODULES.forEach((m) => m.tables.forEach((t) => assert.ok(parModule[t].includes(m.id), t + ' doit dépendre du module ' + m.id)));
});

test('sa-admin : module désactivé → absent du menu, même pour l’administrateur ; lien direct refusé', async () => {
  const t = base();
  t.modules_etat = OFF('facturation', 'stats');
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: t });
  await ready(page);
  const m = await menu(page);
  assert.doesNotMatch(m, /Facturation|Stats/);
  assert.match(m, /Planning équipe[\s\S]*Affichage des apps/);
  await page.evaluate(() => window.__admin.go('facturation'));
  assert.notEqual(await page.evaluate(() => window.__admin.state.mod), 'facturation');
  assert.match(await page.evaluate(() => window.__admin.state.toast || ''), /Module désactivé/);
  await page.evaluate(() => { location.hash = '#stats'; });
  await page.waitForTimeout(100);
  assert.notEqual(await page.evaluate(() => window.__admin.state.mod), 'stats', 'lien direct (#stats) refusé');
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-admin : l’administrateur désactive puis réactive un module ; le superviseur est en lecture seule', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  await ready(page);
  page.on('dialog', (d) => d.accept());
  await page.evaluate(() => window.__admin.go('affichage'));
  await page.getByRole('tab', { name: /Modules/ }).click();
  await page.getByText('Tous les modules sont activés').waitFor();
  const flotte = page.locator('[data-module="flotte"]');
  await flotte.getByRole('button', { name: 'Désactiver Flotte' }).click();
  await page.waitForFunction(() => /« Flotte » désactivé/.test(window.__admin.state.toast || ''));
  const row = db.rows('modules_etat').find((r) => r.id === 'flotte');
  assert.equal(row.actif, false); assert.equal(row.updated_by, 'cwweil');
  assert.match(await flotte.innerText(), /Désactivé/);
  assert.doesNotMatch(await menu(page), /Flotte/, 'appliqué tout de suite dans ce sa-admin');
  assert.match(await page.locator('main').innerText(), /1 module désactivé sur/);
  // l'écran Affichage montre la clé comme désactivée (plus de choix Afficher / Masquer)
  await page.getByRole('tab', { name: /sa-admin/ }).click();
  assert.match(await page.locator('[data-cle="menu.flotte"]').innerText(), /Module désactivé/);
  await page.getByRole('tab', { name: /Modules/ }).click();
  await flotte.getByRole('button', { name: 'Activer Flotte' }).click();
  await page.waitForFunction(() => /« Flotte » activé/.test(window.__admin.state.toast || ''));
  assert.equal(db.rows('modules_etat').find((r) => r.id === 'flotte').actif, true);
  assert.match(await menu(page), /Flotte/);
  assert.deepEqual(errors, []);
  await page.close();

  const t = base();
  t.comptes.push({ id: 'chef', prenom: 'Chef', nom: 'Équipe', dept: 'Bureau', email: '', tel: '', role: 'superviseur', droits: {}, statut: 'actif', saisonnier: false });
  const s = await openApp(browser, srv.url, { app: 'admin', user: SUP, tables: t });
  await ready(s.page);
  await s.page.evaluate(() => window.__admin.go('affichage'));
  await s.page.getByRole('tab', { name: /Modules/ }).click();
  await s.page.getByText('Lecture seule : seuls les administrateurs').waitFor();
  assert.equal(await s.page.locator('[data-module] button').count(), 0, 'aucun bouton pour un superviseur');
  assert.deepEqual(s.errors, []);
  await s.page.close();
});

test('sa-terrain : modules désactivés → tuiles et onglets retirés, gardé hors réseau', async () => {
  const t = base();
  t.modules_etat = OFF('logistique', 'demandes');
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: t });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt && window.__terrain.modEtat && window.__terrain.modEtat.length);
  await page.waitForTimeout(100);
  const barre = await page.evaluate(() => window.__terrain.vals().tabs.map((x) => x.label));
  assert.deepEqual(barre, ['Aujourd’hui', 'Temps', 'Fiche', 'Planning', 'Profil'], 'Demandes retiré');
  assert.ok(await cache(page, '[data-aff~="accueil.logistique"]'), 'tuile Logistique retirée');
  assert.equal(await cache(page, '[data-aff~="accueil.hivernage"]'), false);
  await page.evaluate(() => window.__terrain.go('logistique'));
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.__terrain.state.screen), 'today');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('sa_terrain_modules'))).length, 2);
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-admin : aucun prix — ni lu, ni affiché, ni sauvegardé', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  await ready(page);
  const lu = db.log.filter((l) => l.table === 'facturation' && l.method === 'GET').map((l) => decodeURIComponent(l.query));
  assert.ok(lu.length && lu.every((q) => /select=/.test(q) && !/select=\*|prix/.test(q)), 'la facturation est lue sans ses colonnes de prix : ' + lu.join(' '));
  await page.evaluate(() => window.__admin.go('facturation'));
  const txt = await page.locator('main').innerText();
  assert.match(txt, /ODT-1/);
  assert.doesNotMatch(txt, /\$|Prix|Écart|1 000|1 200/);
  await page.evaluate(() => window.__admin.vaultSnapshot());
  const coffre = await page.evaluate(() => localStorage.getItem('sa_admin_vault') || '');
  assert.ok(coffre.includes('ODT-1'));
  assert.doesNotMatch(coffre, /prix/, 'coffre local sans prix');
  assert.deepEqual(errors, []);
  await page.close();
});

/* ─────────────── Base de données : migrations sur une réplique PostgreSQL ─────────────── */
const BIN = (() => { try { const v = fs.readdirSync('/usr/lib/postgresql').sort().pop(); const b = path.join('/usr/lib/postgresql', v, 'bin'); return fs.existsSync(path.join(b, 'initdb')) ? b : null; } catch (e) { return null; } })();
const ROOT_USER = process.getuid && process.getuid() === 0;
const skip = !BIN && 'PostgreSQL absent (initdb)';
let dir, port, pgPret = false;
function asPg(cmd, args) { return ROOT_USER ? ['runuser', ['-u', 'postgres', '--', cmd, ...args]] : [cmd, args]; }
function run(cmd, args) { const [c, a] = asPg(cmd, args); return execFileSync(c, a, { stdio: 'pipe' }); }
function psql(sql, { db = 'replica', file, cwd } = {}) {
  const args = ['-h', dir, '-p', String(port), '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-qtA', '-X'];
  const r = spawnSync('psql', file ? args.concat(['-f', file]) : args.concat(['-c', sql]), { cwd: cwd || ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
function as(compte, sql) {
  const claims = compte ? JSON.stringify({ role: 'authenticated', app_metadata: { compte_id: compte } }) : '';
  return psql(`begin; set local role ${compte ? 'authenticated' : 'anon'}; set local request.jwt.claims to '${claims}'; ${sql}; commit;`);
}
const refuse = (r) => !r.ok && /row-level security|permission denied/.test(r.err);
function pg() {
  if (pgPret) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-pg-mod-'));
  fs.chmodSync(dir, 0o777);
  port = 50000 + Math.floor(Math.random() * 5000);
  run(path.join(BIN, 'initdb'), ['-D', path.join(dir, 'data'), '-A', 'trust', '-U', 'postgres']);
  run(path.join(BIN, 'pg_ctl'), ['-D', path.join(dir, 'data'), '-o', `-p ${port} -k ${dir} -c listen_addresses=''`, '-w', 'start', '-l', path.join(dir, 'log')]);
  assert.ok(psql('create database replica', { db: 'postgres' }).ok);
  let r = psql('', { file: 'production.sql', cwd: path.join(__dirname, 'sql') }); assert.ok(r.ok, r.err);
  r = psql(`insert into comptes(id,prenom,nom,role) values ('cwweil','Charles','W','admin'),('kael','Kaël','T','employe'),('chef','Chef','S','superviseur');
    insert into comptes_secrets(id,mdp_hash) select id, extensions.crypt('Mdp-12345', extensions.gen_salt('bf',4)) from comptes;
    insert into facturation(id,client,odt,prix_calcule,prix_facture,statut_facturation) values ('f1','Ville','ODT-1',1000,1234,'À facturer');
    insert into inventaire(id,nom,qte,prix) values ('i1','Chlore',5,42.5);
    insert into flotte(id,nom) values ('v1','Camion');
    insert into sondages(slug,titre,actif) values ('levis','Sondage',true);`);
  assert.ok(r.ok, r.err);
  assert.ok(psql(`update facturation set prix_facture = 1300 where id = 'f1'`).ok, 'historique : une ancienne version avec prix');
  for (const f of ['SECURISATION_ETAPE3_PREPARATION.sql', 'SECURISATION_ETAPE3.sql']) { r = psql('', { file: 'docs/sql/' + f }); assert.ok(r.ok, f + ' : ' + r.err); }
  pgPret = true;
}
after(() => { if (dir) { try { run(path.join(BIN, 'pg_ctl'), ['-D', path.join(dir, 'data'), '-m', 'immediate', 'stop']); } catch (e) { /* déjà arrêté */ } fs.rmSync(dir, { recursive: true, force: true }); } });

test('base : retrait des prix — vidés, retirés de l’historique, et refusés ensuite', { skip }, () => {
  pg();
  assert.equal(psql(`select count(*) from histo_modifs where tbl='facturation' and row_data ? 'prix_facture'`).out, '1');
  const r = psql('', { file: 'docs/sql/MIGRATION_2026-11-19_retrait_prix.sql' }); assert.ok(r.ok, r.err);
  assert.equal(psql(`select coalesce(prix_calcule::text,'∅')||'|'||coalesce(prix_facture::text,'∅')||'|'||odt||'|'||statut_facturation from facturation`).out, '∅|∅|ODT-1|À facturer', 'suivi conservé, prix vidés');
  assert.equal(psql(`select coalesce(prix::text,'∅') from inventaire`).out, '∅');
  assert.equal(psql(`select count(*) from histo_modifs where (tbl='facturation' and (row_data ? 'prix_calcule' or row_data ? 'prix_facture')) or (tbl='inventaire' and row_data ? 'prix')`).out, '0');
  assert.ok(!as('chef', `update facturation set prix_facture = 10 where id='f1'`).ok, 'un prix est refusé par la base');
  assert.ok(as('chef', `update inventaire set prix = 0, qte = 6 where id='i1'`).ok, 'une ancienne version de l’app qui envoie 0 passe encore');
  assert.ok(!as('chef', `update inventaire set prix = 3 where id='i1'`).ok);
  assert.ok(as('chef', `insert into inventaire(id,nom,qte) values ('i2','Algicide',2)`).ok, 'nouveau produit sans prix');
  assert.ok(psql('', { file: 'docs/sql/MIGRATION_2026-11-19_retrait_prix.sql' }).ok, 'rejouable');
});

test('base : module désactivé → données inaccessibles (lecture vide, écriture refusée), même avec jeton ou clé publique', { skip }, () => {
  pg();
  let r = psql('', { file: 'docs/sql/MIGRATION_2026-11-19_modules_actifs.sql' }); assert.ok(r.ok, r.err);
  assert.equal(psql(`select count(*) from pg_policies where schemaname='public' and policyname='module_actif' and permissive='RESTRICTIVE'`).out, '16');
  assert.equal(as('chef', `select count(*) from facturation`).out, '1', 'module activé par défaut : rien ne change');
  assert.ok(refuse(as('chef', `insert into modules_etat(id,actif) values ('facturation',false)`)), 'un superviseur ne désactive pas un module');
  assert.equal(as('kael', `select count(*) from modules_etat`).out, '0', 'lecture permise à un connecté');
  assert.ok(as('cwweil', `insert into modules_etat(id,actif,updated_by) values ('facturation',false,'cwweil'),('flotte',false,'cwweil'),('sondages',false,'cwweil'),('stock',false,'cwweil')`).ok);
  assert.equal(as('chef', `select count(*) from facturation`).out, '0', 'facturation : lecture vide');
  assert.equal(as('cwweil', `select count(*) from projets_excel`).out, '0', 'même pour un administrateur');
  assert.ok(refuse(as('chef', `insert into facturation(id,client) values ('f2','X')`)), 'facturation : écriture refusée');
  assert.equal(as('cwweil', `select count(*) from flotte`).out, '0');
  assert.ok(refuse(as(null, `insert into sondage_reponses(sondage_slug) values ('levis')`)) || !as(null, `insert into sondage_reponses(sondage_slug) values ('levis')`).ok, 'formulaire public fermé');
  assert.equal(as('chef', `select count(*) from inventaire`).out, '2', 'stock désactivé mais Logistique active : produits encore lisibles');
  assert.ok(as('cwweil', `update modules_etat set actif = true where id in ('facturation','flotte')`).ok);
  assert.equal(as('chef', `select count(*) from facturation`).out, '1', 'réactivé : tout revient, rien n’a été effacé');
  assert.equal(as('chef', `select count(*) from flotte`).out, '1');
  assert.equal(psql(`select count(*) from facturation`).out, '1', 'service_role / propriétaire : jamais bloqué');
  assert.ok(psql('', { file: 'docs/sql/MIGRATION_2026-11-19_modules_actifs.sql' }).ok, 'rejouable');
});
