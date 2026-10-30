'use strict';
// Fonction serveur « logistique-courriel » (logique pure) : réglage des responsables de l'entrepôt, destinataires, messages.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const mod = () => import(path.join(__dirname, '..', 'supabase', 'functions', 'logistique-courriel', 'lib.js'));

test('logistique-courriel : réglage par défaut (sorties oui, livraisons non) et destinataires valides sans doublon', async () => {
  const L = await mod();
  assert.equal(L.CLE, 'entrepot_courriels');
  const vide = L.reglage(null);
  assert.deepEqual(vide, { responsables: [], sortie: true, livraison: false });
  assert.equal(L.actif(vide, 'sortie'), true);
  assert.equal(L.actif(vide, 'livraison'), false);
  assert.equal(L.actif(vide, 'autre'), false);
  const c = L.reglage({ responsables: [{ nom: 'Entrepôt', courriel: ' Entrepot@Soucy.com ' }, { nom: 'Doublon', courriel: 'entrepot@soucy.com' }, { nom: 'Sans courriel', courriel: 'pas-un-courriel' }, null], sortie: false, livraison: true });
  assert.deepEqual(L.destinataires(c), ['entrepot@soucy.com']);
  assert.equal(L.actif(c, 'sortie'), false);
  assert.equal(L.actif(c, 'livraison'), true);
});

test('logistique-courriel : message de sortie (articles, n°, projet) et de livraison (signée ou non), HTML échappé', async () => {
  const L = await mod();
  const m = L.message('sortie', { no_bon: 'SA-INV-20261026-123', client: 'Piscine <Alpha>', nom: 'Kaël Test', no_employe: 'kael', date: '2026-10-26',
    lignes: [{ desc: 'Chlore liquide 20 L', qteSortie: '2', unite: 'bidon', loc: 'EMP-A1' }, { desc: '', code: '' }] });
  assert.match(m.sujet, /Sortie d’inventaire SA-INV-20261026-123 — Piscine <Alpha>/);
  assert.match(m.texte, /• Chlore liquide 20 L \/\s+2 bidon\s+EMP-A1/);
  assert.match(m.texte, /Date : 2026-10-26\n/, 'sans heure d’émission : la date seule');
  assert.match(m.texte, /ODT : —/);
  assert.equal((m.texte.match(/•/g) || []).length, 1, 'ligne vide ignorée');
  assert.match(m.html, /Piscine &lt;Alpha&gt;/);
  assert.doesNotMatch(m.html, /<Alpha>/);
  const sig = L.message('livraison', { no_bon: 'SA-20261026-123', client: 'Piscine Beta', livre_par_nom: 'Kaël Test', livre_at: '2026-10-26T15:00:00Z', status: 'livre',
    items_liv: [{ item: 'Chlore liquide 20 L', qteLivree: '2', unite: 'bidon' }], photos: [{ name: 'Signature — Julie Côté', data: 'data:image/jpeg;base64,xx' }] });
  assert.match(sig.sujet, /Livraison confirmée SA-20261026-123/);
  assert.match(sig.texte, /signé par le client/);
  assert.match(sig.texte, /• Chlore liquide 20 L — 2 bidon/);
  assert.match(L.message('livraison', { no_bon: 'X', status: 'livre', items_liv: [], photos: [] }).texte, /sans signature/);
});

test('logistique-courriel : format demandé (date et heure d’émission, ODT, colonnes Articles / Quantités / Emp)', async () => {
  const L = await mod();
  const r = { no_bon: 'SA-INV-20261026-148', nom: 'Charles-William Weil', client: 'Complexe Aloha', date: '2026-10-26', sent_at: '2026-10-26T18:05:00Z',
    lignes: [{ desc: 'Bisulfate de Sodium - 20kg', qteSortie: '4', loc: 'CWW', odt: 'ODT-4512' }, { desc: 'Chlore', qteSortie: '2', unite: 'bidon', loc: '', odt: 'ODT-4512' }] };
  const t = L.sortieTexte(r, { timeZone: 'America/Toronto' }).texte.split('\n');
  assert.deepEqual(t.slice(0, 8), ['Bonjour,', '', 'Sortie d’inventaire émise par Charles-William Weil.', '', 'N° : SA-INV-20261026-148', 'Date : 2026-10-26 14:05', 'Client / projet : Complexe Aloha', 'ODT : ODT-4512']);
  const [h, l1, l2] = t.slice(9, 12);
  assert.match(h, /^Articles :\s+Quantités :\s+Emp :$/);
  assert.match(l1, /^• Bisulfate de Sodium - 20kg \/\s+4\s+CWW$/);
  assert.match(l2, /^• Chlore \/\s+2 bidon\s+—$/);
  assert.equal(h.indexOf('Quantités'), l1.indexOf('4'), 'quantités alignées sous leur titre');
  assert.equal(h.indexOf('Emp'), l1.indexOf('CWW'), 'emplacements alignés sous leur titre');
  assert.equal(t[t.length - 1], 'Soucy Aquatik');
  const m = L.message('sortie', r);
  assert.match(m.sujet, /— ODT ODT-4512$/);
  assert.match(m.html, /<th>Quantités<\/th><th>Emp<\/th>/);
});

test('logistique-courriel : envoi direct depuis sa-terrain (responsables et/ou moi) — le choix passe outre l’interrupteur', async () => {
  const L = await mod();
  const c = L.reglage({ responsables: [{ nom: 'Entrepôt', courriel: 'entrepot@soucy.com' }], sortie: false });
  assert.deepEqual(L.destinatairesEnvoi(c, 'sortie', null, 'moi@soucy.com'), [], 'appel automatique : sorties désactivées');
  assert.deepEqual(L.destinatairesEnvoi(c, 'sortie', { responsables: true, moi: false }, 'moi@soucy.com'), ['entrepot@soucy.com']);
  assert.deepEqual(L.destinatairesEnvoi(c, 'sortie', { responsables: false, moi: true }, ' Moi@Soucy.com '), ['moi@soucy.com']);
  assert.deepEqual(L.destinatairesEnvoi(c, 'sortie', { responsables: true, moi: true }, 'entrepot@soucy.com'), ['entrepot@soucy.com'], 'sans doublon');
  assert.deepEqual(L.destinatairesEnvoi(c, 'sortie', { responsables: false, moi: true }, ''), [], 'compte sans courriel');
  assert.deepEqual(L.destinatairesEnvoi(c, 'livraison', { responsables: false, moi: true }, 'moi@soucy.com'), [], 'envoi direct : sorties seulement');
});
