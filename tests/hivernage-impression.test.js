'use strict';
// Rapport imprimable d’hivernement (nouvelle DA, novembre 2026) : contenu tiré des données, durée, unités, photo de tête,
// polices locales, et passage propre sur une 2e page (Chrome → PDF).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const H = require('../src/hivernage/checklist.js');
const { launch } = require('./harness');
const ROOT = path.join(__dirname, '..');

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const plan = { conseils: [], alerte: '', sections: [{ id: 's1', titre: 'Étanchéité', col: 'Tâche', items: [
  { k: 'a', t: 'Bouchon 1 1/12 po — écumoires' }, { k: 'b', t: 'Bouchon extensible T10 — drains de fond' }] }] };
const saisie = (o) => H.norm(Object.assign({ type: 'complete', plan, c: { a: true }, responsable: 'A.A',
  info: { date: '2026-11-11', site: 'Aera 3R', heure_debut: '08:30', heure_fin: '12:15', chef: 'Charles-William Weil', temperature: '8 C', equipe: 'CWW', bassins: 'Piscine extérieure' },
  materiel: [{ nom: 'Bouchons 1 1/2 po NPT', qte: '9', unite: 'unité' }, { nom: 'Antigel biodégradable', qte: '20', unite: 'L' }],
  remarques: 'grilles et portes correctement verrouillées' }, o || {}));

test('le type d’intervention vient des données, jamais écrit en dur', () => {
  assert.match(H.html(saisie()), /Hivernement · fermeture complète/);
  assert.doesNotMatch(H.html(saisie()), /avec formation/);
  assert.match(H.html(saisie({ type: 'formation' })), /Hivernement · fermeture avec formation/);
  assert.match(H.html(saisie({ type: 'autre', type_nom: 'Fermeture des jeux seulement' })), /Hivernement · fermeture des jeux seulement/);
});

test('durée calculée, date longue, température, unités et texte libre nettoyés', () => {
  assert.equal(H.duree('08:30', '12:15'), '3 h 45 min');
  assert.equal(H.duree('11:45', '12:41'), '56 min');
  assert.equal(H.duree('23:30', '00:15'), '45 min');
  assert.equal(H.duree('', '12:00'), '');
  assert.equal(H.unites('Bouchon 1 1/12 po'), 'Bouchon 1 ½ po');
  assert.equal(H.unites('Bouchons 1-1/2" NPT'), 'Bouchons 1 ½ po NPT');
  assert.equal(H.unites('Antigel 4L'), 'Antigel 4 L');
  assert.equal(H.propre('grilles fermées. voir le gérant\nok', true), 'Grilles fermées. Voir le gérant.\nOk.');
  assert.equal(H.dateLongue('2026-11-01'), '1er novembre 2026');
  const h = H.html(saisie());
  assert.match(h, /<b>11 novembre 2026<\/b><span>08:30 à 12:15 \(3 h 45 min\)<\/span>/);
  assert.match(h, /Température<b>8 °C<\/b>/);
  assert.match(h, /Bouchon 1 ½ po — écumoires/);
  assert.doesNotMatch(h, /1\/12|1 1\/2/);
  assert.match(h, /Bouchons 1 ½ po NPT<\/span><b>9<\/b>/, 'quantité seule quand l’unité est « unité »');
  assert.match(h, /Antigel biodégradable<\/span><b>20 L<\/b>/);
  assert.match(h, /Grilles et portes correctement verrouillées\./);
  assert.match(h, /Étapes réalisées <small>1 sur 2<\/small>/);
  assert.match(h, /Responsable \(A\.A\) — signature et date/);
  assert.match(h, /Soucy Aquatik · liste de contrôle générée par SA Platform/);
  assert.doesNotMatch(h, /gradient|box-shadow/, 'ni dégradé ni ombre');
});

test('photo de tête = première photo ; sans photo, bandeau bleu plein', () => {
  const avec = H.html(saisie(), { photos: [{ data: PHOTO, name: 'tete' }, { data: PHOTO, name: 'autre' }] });
  assert.match(avec, /<div class="tete"><img class="ph" src="data:image\/png/);
  assert.match(avec, /<div class="photos"><img src="data:image\/png[^"]*" alt="autre">/);
  const sans = H.html(saisie(), { photos: [] });
  assert.match(sans, /<div class="tete sans"><img class="logo"/);
  assert.doesNotMatch(sans, /class="ph"|class="photos"/);
});

test('polices locales présentes et déclarées ; mises en cache par le service worker', () => {
  const h = H.html(saisie());
  ['inter-400', 'inter-500', 'inter-600', 'inter-700', 'barlow-condensed-600', 'barlow-condensed-700'].forEach((f) => {
    assert.ok(fs.existsSync(path.join(ROOT, 'fonts', f + '.woff2')), f);
    assert.ok(h.includes('/fonts/' + f + '.woff2'), f);
    assert.ok(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes("'/fonts/" + f + ".woff2'"), 'sw.js : ' + f);
  });
  assert.match(h, /font-family:"Barlow Condensed"/);
});

test('l’inspection garde son rapport classique', () => {
  const d = H.norm({ genre: 'insp', modele_nom: 'Inspection après chantier', info: { site: 'Parc' } });
  assert.match(H.html(d), /Rapport d’inspection · Inspection après chantier/);
  assert.doesNotMatch(H.html(d), /fonts\/inter/);
});

test('rendu PDF : une page pour un rapport court, 2e page propre pour la liste complète, lignes insécables', async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    const pdf = async (d) => { await page.setContent(H.html(d, { photos: [{ data: PHOTO }] })); return (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString('latin1'); };
    const pages = (b) => (b.match(/\/Type\s*\/Page[^s]/g) || []).length;
    assert.match(H.html(saisie()), /\.r\{[^}]*break-inside:avoid/, 'une ligne d’étape ne se coupe jamais entre deux pages');
    assert.equal(pages(await pdf(saisie())), 1);
    const long = H.blank({ site: 'Parc Alexandra', date: '2026-10-08' });
    H.SECTIONS.forEach((s) => s.items.forEach((it) => { long.c[it.k] = true; }));
    assert.ok(pages(await pdf(long)) >= 2, 'la liste complète passe sur une 2e page');
  } finally { await browser.close(); }
});
