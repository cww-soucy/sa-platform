'use strict';
// Garde-fous du dépôt : tout ce qui est à la racine est PUBLIÉ par Cloudflare Pages.
// (Le 03/10/2026, un envoi de fichiers directement sur GitHub avait remis d'anciennes versions en ligne.)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

const RACINE = ['.github', '.gitignore', '_headers', 'admin.html', 'docs', 'index.html', 'package-lock.json', 'package.json', 'portail', 'qr-carnet', 'README.md',
  'recuperation.html', 'sa-admin', 'sa-terrain', 'sondage-hivernement-levis.html', 'src', 'stats-sondages.html', 'supabase', 'sw.js', 'terrain.html', 'tests'];

test('racine du dépôt : seulement les fichiers en service (pas de copies, d’archives ni de fichiers Excel)', () => {
  const suivis = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).map((f) => f.split('/')[0]);
  const inattendus = [...new Set(suivis)].filter((f) => !RACINE.includes(f));
  assert.deepEqual(inattendus, [], 'fichiers inattendus à la racine — les sources vont dans src/, la documentation dans docs/');
  const sensibles = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((f) => /\.(zip|xlsx?|csv)$/i.test(f));
  assert.deepEqual(sensibles, [], 'aucune archive ni feuille de calcul : elles seraient publiques sur le site');
});

test('SA Platform : la version affichée (APP_BUILD) suit celle du service worker (CACHE_NAME)', () => {
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/var APP_BUILD='(v\d+)'/);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/var CACHE_NAME = 'sa-platform-(v\d+)'/);
  assert.ok(idx && sw, 'APP_BUILD ou CACHE_NAME introuvable');
  assert.equal(idx[1], sw[1]);
  assert.ok(Number(sw[1].slice(1)) >= 80, 'jamais revenir sous la v80 (version restaurée le 03/10/2026)');
});
