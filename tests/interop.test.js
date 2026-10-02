'use strict';
// Interopérabilité avec SA Platform (index.html), qui partage les mêmes tables et tourne toujours en production :
// on exécute SES fonctions de fusion et de conversion sur ce que produisent sa-terrain et sa-admin.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SCHEMA = require('./schema.json');

const ROOT = path.join(__dirname, '..');
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('fonction introuvable : ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
}
function load(file, names, extra) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return new Function((extra || '') + names.map((n) => grab(src, n)).join('\n') + '\nreturn {' + names.join(',') + '};')();
}
const IDX = load('index.html', ['_ftSig', '_ftMod', '_ftFusionDel', '_ftDelViseTache', 'mergeFTDay', 'mapRowToDb', 'mapRowFromDb']);
const TER = load('src/terrain/app.js', ['pad', 'clone', 'emptyDay', 'minsFrom', 'hrsFrom', 'sig', 'findTask', 'applyOp']);
const ADM = load('src/admin/app.js', ['marquerModif']);

const jour = () => ({ status: 'done', tasks: [{ id: 1, lieu: 'Entrepôt', start: '07:00', end: '08:00', hrs: 1, active: false }], del: [] });
const semaine = () => { const d = []; for (let i = 0; i < 7; i++) d.push(i === 2 ? jour() : TER.emptyDay()); return d; };

test('correction faite dans sa-terrain : un téléphone SA Platform à l’ancienne version ne l’annule pas', () => {
  const serveur = TER.applyOp(semaine(), { type: 'edit', id: 'e1', ts: Date.now(), uid: 'kael', week: 'w', dayIdx: 2, k: '', sig: '07:00|Entrepôt', lieu: 'Entrepôt', start: '07:00', end: '09:30' });
  const fusion = IDX.mergeFTDay(jour(), serveur[2]); // jour() = copie locale, jamais corrigée
  assert.equal(fusion.tasks.length, 1);
  assert.equal(fusion.tasks[0].end, '09:30');
  assert.equal(fusion.tasks[0].hrs, 2.5);
});

test('correction de l’heure de DÉBUT dans sa-terrain : pas de doublon à la fusion', () => {
  const serveur = TER.applyOp(semaine(), { type: 'edit', id: 'e2', ts: Date.now(), uid: 'kael', week: 'w', dayIdx: 2, k: '', sig: '07:00|Entrepôt', lieu: 'Entrepôt', start: '06:45', end: '08:00' });
  const fusion = IDX.mergeFTDay(jour(), serveur[2]);
  assert.deepEqual(fusion.tasks.map((t) => t.start), ['06:45']);
});

test('suppression faite dans sa-terrain : le punch ne ressuscite pas depuis un téléphone SA Platform', () => {
  const serveur = TER.applyOp(semaine(), { type: 'delete', id: 'x1', ts: Date.now(), uid: 'kael', week: 'w', dayIdx: 2, k: '', sig: '07:00|Entrepôt' });
  assert.equal(serveur[2].tasks.length, 0);
  const fusion = IDX.mergeFTDay(jour(), serveur[2]);
  assert.equal(fusion.tasks.length, 0);
});

test('correction faite dans sa-admin (marquerModif) : l’emporte sur la copie non corrigée du téléphone', () => {
  const serveur = jour();
  const t = ADM.marquerModif(serveur.tasks[0]);
  t.end = '07:30'; t.hrs = 0.5; // correction à la BAISSE : c'était le cas perdu avant v64
  const fusion = IDX.mergeFTDay(jour(), serveur);
  assert.equal(fusion.tasks.length, 1);
  assert.equal(fusion.tasks[0].end, '07:30');
});

test('les opérations de sa-terrain sont idempotentes (rejouées à chaque affichage et à chaque envoi)', () => {
  const op = { type: 'edit', id: 'e3', ts: 1000, uid: 'kael', week: 'w', dayIdx: 2, k: '', sig: '07:00|Entrepôt', lieu: 'Bureau', start: '07:00', end: '08:00' };
  const une = TER.applyOp(semaine(), op), deux = TER.applyOp(une, op);
  assert.deepEqual(deux, une);
  const del = { type: 'delete', id: 'x2', ts: 2000, uid: 'kael', week: 'w', dayIdx: 2, k: une[2].tasks[0].k, sig: 'x|y' };
  const a = TER.applyOp(une, del), b = TER.applyOp(a, del);
  assert.deepEqual(b, a);
  assert.equal(a[2].del.length, 1);
});

function colonnesInconnues(table, localKey, rec) {
  const row = IDX.mapRowToDb(localKey, JSON.parse(JSON.stringify(rec)));
  row.updated_at = rec.updatedAt; // posé par sbPushAll
  return Object.keys(row).filter((c) => !SCHEMA[table].includes(c));
}

test('SA Platform : un rapport d’hivernage local s’envoie sans colonne inconnue (il était refusé)', () => {
  const r = { id: 'h', createdBy: 'u', createdAt: 't', client: 'C', site: 'Piscine', siteId: '1', objet: 'o', dateRapport: 'd', dateInspection: 'd', preparePar: 'p', technicien: 't',
    sections: [], plan: [], suivi: [], timeline: {}, callout: '', signataireSA: 'a', signataireClient: 'b', updatedAt: 't', status: 'brouillon' };
  assert.deepEqual(colonnesInconnues('rapports_hivernage', 'hivernage', r), []);
});

test('SA Platform : une sortie d’inventaire locale s’envoie sans colonne inconnue (elle était refusée)', () => {
  const s = { id: 's', noBon: 'SA-INV-1', createdBy: 'u', createdAt: 't', client: 'C', nom: 'N', noEmploye: '1', departement: 'D', date: '', lignes: [], updatedAt: 't', status: 'envoye', sentAt: 't' };
  assert.deepEqual(colonnesInconnues('sorties_inventaire', 'sortie', s), []);
  assert.equal(IDX.mapRowToDb('sortie', Object.assign({}, s)).date, null, 'date vide → null (colonne de type date)');
});

test('SA Platform affiche le site d’un rapport d’hivernage envoyé par sa-terrain', () => {
  const r = IDX.mapRowFromDb('hivernage', { id: 'hv1', site_id: '4', site_nom: 'Piscine Alpha Sud', status: 'brouillon', sections: [{ title: 'x', tag: 'modere', items: ['Fait — a'] }] });
  assert.equal(r.site, 'Piscine Alpha Sud');
  assert.equal(r.siteId, '4');
});

test('SA Platform relit une sortie envoyée par sa-terrain', () => {
  const r = IDX.mapRowFromDb('sortie', { id: 's1', no_bon: 'SA-INV-20260929-123', no_employe: 'kael', sent_at: '2026-09-29T12:00:00Z', date: '2026-09-29', client: 'Piscine Beta', lignes: [] });
  assert.equal(r.noBon, 'SA-INV-20260929-123');
  assert.equal(r.noEmploye, 'kael');
  assert.equal(r.client, 'Piscine Beta');
});

test('SA Platform : un bon de travail, un créneau ou une tâche « terminé / validé » s’envoie sans colonne inconnue (il était refusé)', () => {
  const t = { termine: true, termineBy: 'kael', termineAt: '2026-10-02T12:00:00Z', valide: true, valideBy: 'cwweil', valideAt: '2026-10-02T13:00:00Z', updatedAt: 't' };
  const wo = Object.assign({ id: 'w', client: 'C', site: 'S', type: 'entretien', priorite: 'normal', status: 'ouvert', date: '2026-10-02', assignes: ['kael'], desc: 'd', notes: '', tasks: [], files: [], reqBassin: false, reqPhoto: false, reqNotes: false, createdAt: 't', createdBy: 'u' }, t);
  assert.deepEqual(colonnesInconnues('workorders', 'workorders', wo), []);
  assert.equal(IDX.mapRowToDb('workorders', Object.assign({}, wo)).termine_by, 'kael');
  const pl = Object.assign({ id: 'p', woId: 'w', date: '2026-10-02', heure: '08:00', emps: ['kael'], vehicule: '', notes: '', status: 'assigned', client: 'C', addr: '', siteId: '1', type: 'entretien', desc: '' }, t);
  assert.deepEqual(colonnesInconnues('plan', 'plan', pl), []);
  const r = IDX.mapRowFromDb('workorders', { id: 'w', termine: true, termine_by: 'kael', termine_at: 'x', valide: null, valide_by: null, valide_at: null });
  assert.equal(r.termineBy, 'kael');
  assert.equal(r.valideBy, '');
  assert.equal('valide' in r, false, 'valide absent plutôt que null');
});

test('SA Platform : un site créé automatiquement (à valider) s’envoie sans colonne inconnue et garde son statut', () => {
  const s = { id: 's', nom: 'Club', addr: '', tel: '', email: '', type: '', annee: '', equips: [], notes: 'Ajouté automatiquement depuis un punch', files: [], updatedAt: 't', aValider: true, creePar: 'kael', creeLe: '2026-10-02T12:00:00Z' };
  assert.deepEqual(colonnesInconnues('sites', 'sites', s), []);
  const back = IDX.mapRowFromDb('sites', IDX.mapRowToDb('sites', Object.assign({}, s)));
  assert.equal(back.aValider, true);
  assert.equal(back.creePar, 'kael');
});
