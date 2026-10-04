'use strict';
// Règles de calcul des inspections (passation §8) : états, systèmes, gravité, résumé, étiquettes, droits.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/inspection/model.js');

const PH = { key: 'ph', label: 'pH', unit: '', lo: 7.2, hi: 7.6, step: 0.1 };
const CL = { key: 'cl', label: 'Chlore libre', unit: 'mg/L', lo: 1, hi: 3, step: 0.1 };
const TYPE = { fields: [PH, CL], checks: ['Paniers d’écumoire vidés', 'Registre RQEP signé', 'Parois et fond brossés'] };

test('eau : hors zone → action, près du bord (10 % de la zone) → à surveiller, sinon conforme', () => {
  assert.equal(M.etatEau(PH, 7.8), 'action');
  assert.equal(M.etatEau(PH, 7.1), 'action');
  assert.equal(M.etatEau(PH, 7.4), 'ok');
  assert.equal(M.etatEau(CL, 1.1), 'watch');
  assert.equal(M.etatEau(CL, 2.9), 'watch');
  assert.equal(M.etatEau(CL, null), 'na');
});

test('points : les vérifications actuelles sont réparties dans les 6 systèmes', () => {
  const p = M.pointsDuType('RE', [], TYPE.checks);
  assert.deepEqual(p.map((x) => x.systeme_code), ['circulation', 'securite', 'structure']);
  assert.equal(p[1].mode, 'ouinon');
  assert.equal(p[1].obligatoire, true);
  const cat = [{ id: 'x', systeme_code: 'chauffage', type_code: null, libelle: 'Échangeur', ordre: 1 }, { id: 'y', systeme_code: 'dosage', type_code: 'SP', libelle: 'Pompe doseuse', ordre: 2 }];
  assert.deepEqual(M.pointsDuType('RE', cat, TYPE.checks).map((x) => x.id), ['x'], 'catalogue prioritaire, filtré par type');
});

test('visite : états par système, compteurs, score, pastilles, verdict, résumé', () => {
  const r = { type_code: 'RE', vals: { ph: 7.9, cl: 1.1 }, touched: { ph: true, cl: true },
    points: { 'RE-0': { etat: 'ok' }, 'RE-1': { etat: 'action', note: 'Registre absent' }, 'RE-2': { etat: 'ok' } } };
  const it = M.itemsVisite(r, TYPE, []);
  const se = M.etatsSystemes(it);
  assert.equal(se.eau, 'action');
  assert.equal(se.securite, 'action');
  assert.equal(se.circulation, 'ok');
  assert.equal(se.chauffage, 'na');
  assert.deepEqual(M.compteurs(it), { action: 2, watch: 1, ok: 2, na: 0 });
  assert.equal(M.score(it), 23);
  assert.deepEqual(M.pastilles(se), { eau: 'action', meca: 'ok', secu: 'action', struct: 'ok' });
  assert.equal(M.verdict(it), '2 actions requises, 1 point à surveiller, 2 points conformes.');
  assert.match(M.resume(it), /^2 actions requises : pH 7,9, Registre RQEP signé\. À surveiller : Chlore libre 1,1 mg\/L\. Circulation et filtration et structure et surfaces sont conformes\.$/);
  assert.match(M.resume(it, true), /^Intervention en cours : pH et Registre RQEP signé\./);
});

test('visite : un ancien relevé (vérifications cochées, sans points) reste lisible', () => {
  const it = M.itemsVisite({ type_code: 'RE', vals: { ph: 7.4 }, checks: { 'Parois et fond brossés': true, 'Registre RQEP signé': false } }, TYPE, []);
  assert.deepEqual(it.map((i) => [i.id, i.etat]), [['eau:ph', 'ok'], ['RE-2', 'ok']]);
  assert.equal(M.resume(it), 'Tout est conforme. Eau du bassin et structure et surfaces sont conformes.');
});

test('étiquettes : Nouveau / Depuis le <date> / Depuis N visites', () => {
  const v = (e, d) => ({ date: d, items: [{ id: 'p', etat: e }] });
  assert.equal(M.depuis('p', 'action', [v('ok', '2026-10-01')]), 'Nouveau');
  assert.equal(M.depuis('p', 'action', [v('watch', '2026-10-01'), v('ok', '2026-09-20')]), 'Depuis le 2026-10-01');
  assert.equal(M.depuis('p', 'action', [v('watch', '2026-10-01'), v('action', '2026-09-20')]), 'Depuis 3 visites');
});

test('droits et visibilité : niveaux Opérateur / Gestionnaire / Direction', () => {
  assert.equal(M.droits('operateur').historique, false);
  assert.equal(M.droits('gestionnaire').historique, true);
  assert.equal(M.droits('gestionnaire', { gestionnaire: { factures: true } }).factures, true);
  assert.equal(M.visible('operateur', 'operateur'), true);
  assert.equal(M.visible('gestionnaire', 'operateur'), false);
  assert.equal(M.visible('interne', 'direction'), false);
  assert.equal(M.masquer('jean@ville.qc.ca'), 'j•••••@ville.qc.ca');
  assert.equal(M.masquer('819 555-1234'), '•••-•••-1234');
});
