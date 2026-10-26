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
  assert.match(m.sujet, /Sortie d'inventaire SA-INV-20261026-123 — Piscine <Alpha>/);
  assert.match(m.texte, /• Chlore liquide 20 L — 2 bidon \(empl\. EMP-A1\)/);
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
