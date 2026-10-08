'use strict';
// Liste de contrôle « Hivernement » partagée (src/hivernage/checklist.js) : contenu du formulaire papier, stockage, document client.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../src/hivernage/checklist.js');
const schema = require('./schema.json');

test('même contenu que le formulaire papier : 8 sections, 58 cases, étapes critiques 1, 12, 13 et 25', () => {
  assert.deepEqual(H.SECTIONS.map((s) => s.no + '. ' + s.titre), ['2. Sécurité et préparation', '3. Phase 1 — Vidange', '4. Phase 2 — Retrait et démontage',
    '5. Phase 3 — Protection des conduits et antigel', '6. Phase 4 — Remise d’eau contrôlée', '7. Phase 5 — Vérifications finales', '8. Matériel et pièces', '9. Formation des employés']);
  assert.equal(H.progress(H.blank()).total, 58);
  assert.deepEqual(H.critiquesManquants(H.blank()).map((x) => x.split('.')[0]), ['1', '12', '13', '25']);
  const nums = H.SECTIONS.flatMap((s) => s.items.map((i) => i.n)).filter((n) => n && n !== '—').map(Number).sort((a, b) => a - b);
  assert.deepEqual(nums, Array.from({ length: 25 }, (_, i) => i + 1), 'les 25 étapes numérotées, une seule fois chacune');
});

test('rapport : colonnes existantes de rapports_hivernage seulement, relu à l’identique', () => {
  const d = H.blank({ site: 'Parc Alexandra', date: '2026-10-08', chef: 'Kaël' });
  d.c['p1-0'] = true; d.employes.push({ nom: 'Jean', formation: true, demo: false }); d.remarques = 'RAS';
  const r = H.toReport(d, { site_id: '7' }, [{ data: 'data:image/jpeg;base64,xx', name: 'p' }]);
  assert.deepEqual(Object.keys(r).filter((k) => !schema.rapports_hivernage.includes(k)), []);
  assert.equal(r.site_id, '7'); assert.equal(r.technicien, 'Kaël'); assert.equal(r.callout, 'RAS');
  assert.ok(H.isChecklist(r));
  assert.deepEqual(H.fromReport(JSON.parse(JSON.stringify(r))), H.norm(d));
  assert.equal(H.photosOf(r).length, 1);
  assert.equal(H.isChecklist({ sections: [{ title: 'Joints de céramique', items: [] }] }), false, 'ancien rapport de pré-hivernage');
});

test('document client : toutes les étapes, cases cochées, échappement, nom de fichier', () => {
  const d = H.blank({ site: 'Parc <Alexandra>', date: '2026-10-08' });
  d.c['secu-0'] = true; d.remarques = '<b>x</b>';
  const h = H.html(d);
  assert.ok(H.SECTIONS.every((s) => s.items.every((i) => h.includes(i.t.replace(/&/g, '&amp;')))));
  assert.equal((h.match(/class="box on"/g) || []).length, 1);
  assert.ok(!h.includes('<Alexandra>') && !h.includes('<b>x</b>'));
  assert.match(H.texte(d), /1 \/ 58 cases cochées \(2 %\)[\s\S]*Étapes non cochées/);
  assert.equal(H.fichier(d), 'Hivernement-Parc-Alexandra-2026-10-08.html');
});
