/* Sortie d’inventaire (SA-INV-AAAAMMJJ-NNN) — document imprimable / PDF dans la nouvelle DA (maquette SI-305552, novembre 2026).
   Page Letter 816 × 1056 px, marges 40 px : logo, bloc titre bleu, rangée d’infos à filets, tableau « Articles sortis », signatures.
   Réutilise le gabarit d’impression de l’hivernement (src/hivernage/checklist.js) : logo, polices locales (/fonts/, gardées
   par le service worker pour l’impression hors ligne) et date longue en français. Toutes les valeurs viennent de la sortie :
   un champ vide reste vide, un code incomplet (« PH- ») est affiché tel quel.
   Expose window.SASortie (navigateur) ou module.exports (Node). */
(function (root) {
  'use strict';
  var H = root && root.SAHiv;
  if (!H && typeof require === 'function') H = require('../hivernage/checklist.js');

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  /* ODT : saisi sur la fiche, sinon rangé dans les lignes (sorties_inventaire n’a pas de colonne odt) */
  function odtDe(f) {
    if (txt(f.odt)) return txt(f.odt);
    var l = (f.lignes || []).filter(function (x) { return x && txt(x.odt); })[0];
    return l ? txt(l.odt) : '';
  }
  function employe(f) { var n = txt(f.nom), id = txt(f.no_employe); return id ? (n ? n + ' ' : '') + '(' + id + ')' : n; }
  /* Lignes réelles : on garde celles qui ont un code ou une description (comme à l’enregistrement) */
  function lignesDe(f) { return (f.lignes || []).filter(function (r) { return r && (txt(r.desc) || txt(r.code)); }); }

  var COLS = [['code', 'Code', 102], ['loc', 'Emplacement', 132], ['desc', 'Description', 180], ['qteSortie', 'Qté sortie', 86, 'q'], ['qteRetour', 'Qté retour', 116, 'q'], ['projet', 'Projet / client', 120]];

  var CSS = ':root{--bleu:#1B4F8C;--ink:#1d2330;--gris:#5b6776;--filet:#c9d2de;--filet2:#e1e6ee}'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + '@page{size:letter;margin:40px}'
    + 'html{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + 'body{font-family:Inter,"Segoe UI",Arial,sans-serif;font-size:13px;line-height:1.25;color:var(--ink);background:#fff}'
    + '.page{width:816px;min-height:1056px;margin:0 auto;padding:40px;background:#fff}'
    + '@media print{.page{width:auto;min-height:0;padding:0;margin:0}}'
    + '.logo{display:block;width:60px;height:60px}'
    + '.titre{margin-top:24px;background:var(--bleu);color:#fff;border-radius:2px;padding:19px 24px 13px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px}'
    + '.titre .k{font-size:13px;line-height:16px}'
    + '.titre h1{font-family:"Barlow Condensed","Arial Narrow",Arial,sans-serif;font-weight:700;font-size:44px;line-height:52px;letter-spacing:0;overflow-wrap:anywhere}'
    + '.titre .d{font-size:15px;font-weight:600;white-space:nowrap;padding-bottom:6px}'
    + '.infos{display:grid;grid-template-columns:239fr 129fr 221fr 147fr;border-top:1px solid var(--filet);border-bottom:1px solid var(--filet);margin-top:20px;break-inside:avoid}'
    + '.infos div{padding:9px 12px 12px;border-left:1px solid var(--filet);font-size:12px;line-height:15px;color:var(--gris);min-width:0}'
    + '.infos div:first-child{border-left:0;padding-left:0}'
    + '.infos b{display:block;margin-top:4px;font-size:13px;line-height:16px;font-weight:600;color:var(--ink);overflow-wrap:anywhere}'
    + 'h2{font-family:"Barlow Condensed","Arial Narrow",Arial,sans-serif;font-weight:700;font-size:22px;line-height:26px;color:var(--bleu);border-bottom:2px solid var(--bleu);padding-bottom:5px;margin-top:27px;break-after:avoid}'
    + 'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + 'thead{display:table-header-group}'
    + 'th{font-size:12px;line-height:15px;font-weight:400;color:var(--gris);text-align:left;padding:8px 10px 10px 0;border-bottom:1px solid var(--filet)}'
    + 'td{padding:10px 10px 12px 0;border-bottom:1px solid var(--filet2);vertical-align:top;overflow-wrap:anywhere;word-break:break-word}'
    + 'th.q,td.q{text-align:center;padding-left:5px;padding-right:5px}td.q{font-weight:600}'
    + 'tr{break-inside:avoid;page-break-inside:avoid}'
    + 'tbody.fin{break-inside:avoid;page-break-inside:avoid}'
    + 'tr.sig td{border:0;padding:103px 0 0}'
    + 'tr.sig td>div{display:grid;grid-template-columns:1fr 1fr;gap:40px}'
    + 'tr.sig td>div>div{border-top:1px solid var(--ink);padding-top:46px;font-size:12px;line-height:15px;color:var(--gris);font-weight:400}';

  function ligne(r) { return '<tr>' + COLS.map(function (c) { return '<td' + (c[3] ? ' class="q"' : '') + '>' + E(txt(r[c[0]])) + '</td>'; }).join('') + '</tr>'; }

  function html(f) {
    f = f || {};
    var no = txt(f.no_bon), L = lignesDe(f);
    var info = [['Client / projet', f.client], ['ODT', odtDe(f)], ['Employé', employe(f)], ['Département', f.departement]];
    return '<!DOCTYPE html><html lang="fr-CA"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<title>' + E('Sortie d\'inventaire ' + no) + '</title><style>' + H.fontesCss() + CSS + '</style></head><body><div class="page">'
      + '<img class="logo" src="' + H.LOGO + '" alt="Soucy Aquatik">'
      + '<div class="titre"><div><div class="k">Sortie d\'inventaire</div><h1>' + E(no) + '</h1></div><div class="d">' + E(H.dateLongue(f.date || '')) + '</div></div>'
      + '<div class="infos">' + info.map(function (x) { return '<div>' + E(x[0]) + '<b>' + E(txt(x[1])) + '</b></div>'; }).join('') + '</div>'
      + '<h2>Articles sortis</h2>'
      + '<table><colgroup>' + COLS.map(function (c) { return '<col style="width:' + c[2] + 'px">'; }).join('') + '</colgroup>'
      + '<thead><tr>' + COLS.map(function (c) { return '<th' + (c[3] ? ' class="q"' : '') + '>' + E(c[1]) + '</th>'; }).join('') + '</tr></thead>'
      + (L.length > 1 ? '<tbody>' + L.slice(0, -1).map(ligne).join('') + '</tbody>' : '')
      /* Dernière ligne + signatures dans le même groupe insécable : les signatures ne partent jamais seules sur une page */
      + '<tbody class="fin">' + L.slice(-1).map(ligne).join('')
      + '<tr class="sig"><td colspan="' + COLS.length + '"><div><div>Signature de l\'employé</div><div>Signature du superviseur</div></div></td></tr></tbody></table>'
      + '</div></body></html>';
  }

  var api = { html: html, odtDe: odtDe, employe: employe, lignesDe: lignesDe, COLS: COLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SASortie = api;
})(typeof window !== 'undefined' ? window : this);
