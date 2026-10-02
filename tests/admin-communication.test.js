'use strict';
// sa-admin — Communication : infolettre du lundi, informations, lettres, procédures (internes / externes), accusés de lecture.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, iso, mondayOf, today } = require('./harness');
const { base } = require('./fixtures');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const A = (page, fn, arg) => page.evaluate(fn, arg);
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const dlg = (page) => page.locator('.dialog');
const field = (page, label) => dlg(page).locator('.field').filter({ has: page.locator('label', { hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) }).locator('input,select,textarea').first();
const MON = iso(mondayOf(new Date()));

function tables() {
  const t = base();
  t.communications = [
    { id: 'pr1', type: 'procedure', portee: 'interne', titre: 'Manipulation du chlore', resume: 'EPI obligatoires', contenu: '1. Gants\n2. Lunettes', sections: [], reference: 'PR-001', version: 1, confirmation: true, statut: 'publie', date_pub: '2026-09-15', epingle: false, auteur: 'cwweil', auteur_nom: 'Bureau SA', created_at: '2026-09-15T12:00:00Z', updated_at: '2026-09-15T12:00:00Z' },
  ];
  t.communication_lectures = [{ id: 'pr1_kael', comm_id: 'pr1', uid: 'kael', emp_nom: 'Kaël Test', version: 1, lu_at: '2026-09-16T12:00:00Z' }];
  return t;
}
async function open(page) {
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await A(page, () => window.__admin.go('communication'));
  await page.getByRole('row', { name: /Manipulation du chlore/ }).waitFor();
}

test('infolettre du lundi : préparée avec les chiffres réels, rédigée puis publiée à l’équipe', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: tables() });
  await open(page);
  await page.getByText(/L’infolettre du lundi .* n’est pas encore préparée/).waitFor();
  await page.getByRole('button', { name: 'Préparer l’infolettre' }).click();
  await toast(page, /Chiffres de la semaine insérés/);
  const secs = await A(page, () => window.__admin.state.cm.f.sections);
  assert.deepEqual(secs.map((s) => s.titre), ['Mot de la semaine', 'Retour sur la semaine dernière', 'Heures terrain par technicien', 'Cette semaine', 'Rappel sécurité', 'Bons coups']);
  assert.match(secs[1].texte, /h travaillées par l’équipe/);
  assert.match(secs[3].texte, /Piscine Alpha \(Kaël Test\)/, 'les bons de travail de la semaine, avec le technicien');
  await dlg(page).getByLabel('Texte de la section').first().fill('Belle semaine à tous !');
  await dlg(page).getByRole('button', { name: 'Publier à l’équipe' }).click();
  await toast(page, /Communication publiée/);
  const c = db.rows('communications').find((x) => x.type === 'infolettre');
  assert.equal(c.statut, 'publie');
  assert.equal(c.semaine, MON);
  assert.equal(c.sections[0].texte, 'Belle semaine à tous !');
  assert.equal(c.auteur, 'cwweil');
  await page.getByText(/Infolettre de la semaine du .* : publiée/).waitFor();
  assert.ok(db.rows('audit_log').some((a) => a.ressource === 'communications'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('procédure : accusés de lecture, nouvelle version à relire', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: tables() });
  await open(page);
  await page.getByRole('row', { name: /Manipulation du chlore.*Confirmé 1 \/ 2/ }).waitFor();
  await page.getByRole('row', { name: /Manipulation du chlore/ }).getByRole('button', { name: 'Ouvrir' }).click();
  await dlg(page).getByText('Lecture confirmée par 1 / 2 (version 1)').waitFor();
  await dlg(page).getByText('Pas encore : Autre Tech').waitFor();
  assert.equal(await dlg(page).getByRole('button', { name: 'Publier une nouvelle version' }).count(), 0);
  await field(page, 'Contenu').fill('1. Gants nitrile\n2. Lunettes\n3. Ventilation');
  await dlg(page).getByRole('button', { name: 'Publier une nouvelle version' }).click();
  await toast(page, /Nouvelle version 2 publiée/);
  const c = db.rows('communications').find((x) => x.id === 'pr1');
  assert.equal(c.version, 2);
  assert.match(c.contenu, /Ventilation/);
  await page.getByRole('row', { name: /Manipulation du chlore.*Confirmé 0 \/ 2/ }).waitFor();
  await page.close();
});

test('lettre externe : imprimée sur papier à en-tête, courriel au destinataire, aucune modification écrasée', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: tables() });
  await open(page);
  await A(page, () => { window.__mails = []; window.__openMail = (u) => window.__mails.push(u); });
  await page.getByRole('button', { name: '+ Lettre' }).click();
  await field(page, 'Titre').fill('Fermeture de la piscine pour l’hiver');
  await field(page, 'Destinataires').fill('Ville de Lévis\nService des loisirs');
  await field(page, 'Courriels (séparés par des virgules)').fill('loisirs@levis.ca');
  await field(page, 'Contenu').fill('Nous procéderons à la fermeture le 15 octobre.');
  const [pop] = await Promise.all([page.waitForEvent('popup'), dlg(page).getByRole('button', { name: 'Imprimer / PDF' }).click()]);
  await pop.waitForLoadState();
  assert.match(await pop.locator('body').innerText(), /Ville de Lévis[\s\S]*Objet : Fermeture de la piscine pour l’hiver[\s\S]*15 octobre[\s\S]*Bureau SA/);
  assert.match(await pop.locator('img').first().getAttribute('src'), /^data:image\/png;base64,/);
  await pop.close();
  await dlg(page).getByRole('button', { name: 'Courriel' }).click();
  const mail = await A(page, () => window.__mails[0]);
  assert.match(mail, /^mailto:loisirs@levis\.ca\?subject=Fermeture/);
  assert.match(decodeURIComponent(mail), /Ville de Lévis,\n\nNous procéderons/);
  await dlg(page).getByRole('button', { name: 'Marquer envoyée' }).click();
  await toast(page, /Communication publiée/);
  const c = db.rows('communications').find((x) => x.type === 'lettre');
  assert.equal(c.portee, 'externe');
  assert.equal(c.date_pub, today());
  // modifiée ailleurs pendant qu'elle est ouverte : rien n'est écrasé
  await page.getByRole('row', { name: /Fermeture de la piscine/ }).getByRole('button', { name: 'Ouvrir' }).click();
  c.updated_at = '2026-10-02T23:00:00Z'; c.titre = 'Titre changé ailleurs';
  await field(page, 'Titre').fill('Mon titre');
  await dlg(page).getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await toast(page, /vient d’être modifiée ailleurs/);
  assert.equal(db.rows('communications').find((x) => x.type === 'lettre').titre, 'Titre changé ailleurs');
  await page.close();
});
