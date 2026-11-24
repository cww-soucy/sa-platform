/* Bon de livraison (SA-AAAAMMJJ-NNN) — document imprimable / PDF dans la nouvelle DA, la même que la sortie d’inventaire
   (src/impression/sortie-inventaire.js, maquette SI-305552) : logo, bloc titre bleu, rangée d’infos à filets, tableaux,
   puis la livraison — signature du client en image (faite au doigt dans sa-terrain), « validée sans signature », ou lignes
   à signer si le bon n’est pas encore livré. Toutes les valeurs viennent du bon : un champ vide reste vide.
   Expose window.SABon (navigateur) ou module.exports (Node). */
(function (root) {
  'use strict';
  var H = root && root.SAHiv;
  if (!H && typeof require === 'function') H = require('../hivernage/checklist.js');

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  /* Heure du Québec, quel que soit le fuseau de l’appareil qui imprime */
  function quebec(isoTs) {
    var d = new Date(isoTs || '');
    if (!isoTs || isNaN(d)) return { date: '', heure: '' };
    var p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, heure: p.hour + ' h ' + p.minute };
  }
  function lignes(arr) { return (arr || []).filter(function (r) { return r && txt(r.item); }); }
  /* Signatures du client : photos « Signature — Nom » avec une image réelle */
  function signatures(f) {
    return (f.photos || []).filter(function (p) { return p && /^Signature/.test(p.name || '') && /^data:image\/|^https:\/\//.test(String(p.data || p.url || '')); });
  }
  function signataire(p) { return txt(String(p.name || '').replace(/^Signature\s*[—–-]?\s*/, '')); }

  var LIV = [['item', 'Article', 330], ['qteSortie', 'Qté sortie', 90, 'q'], ['unite', 'Unité', 90, 'q'], ['qteLivree', 'Qté livrée', 90, 'q'], ['statut', 'Statut', 136]];
  var RET = [['item', 'Article récupéré', 300], ['qteRecuperee', 'Qté', 80, 'q'], ['unite', 'Unité', 90, 'q'], ['raison', 'Raison / remarque', 266]];

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
    + '.titre .u{display:inline-block;margin-left:8px;padding:0 6px;border:1px solid #fff;font-weight:600;font-size:11px;line-height:15px;letter-spacing:.5px}'
    + '.titre h1{font-family:"Barlow Condensed","Arial Narrow",Arial,sans-serif;font-weight:700;font-size:44px;line-height:52px;letter-spacing:0;overflow-wrap:anywhere}'
    + '.titre .d{font-size:15px;font-weight:600;white-space:nowrap;padding-bottom:6px}'
    + '.infos{display:grid;grid-template-columns:200fr 236fr 120fr 180fr;border-top:1px solid var(--filet);border-bottom:1px solid var(--filet);margin-top:20px;break-inside:avoid}'
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
    + '.vide{padding:10px 0 12px;color:var(--gris);border-bottom:1px solid var(--filet2)}'
    + '.liv{break-inside:avoid;page-break-inside:avoid}'
    + '.liv .etat{margin-top:12px;font-size:13px;line-height:18px}'
    + '.liv .etat b{font-weight:600}'
    + '.sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:18px}'
    + '.sigs .img{height:96px;display:flex;align-items:flex-end}'
    + '.sigs img{display:block;max-height:96px;max-width:100%;object-fit:contain}'
    + '.sigs .l{border-top:1px solid var(--ink);padding-top:8px;font-size:12px;line-height:15px;color:var(--gris)}'
    + '.sigs .l b{display:block;margin-top:3px;font-size:13px;line-height:16px;font-weight:600;color:var(--ink)}'
    + '.blanc{display:grid;grid-template-columns:1fr 1fr;gap:40px;padding-top:103px}'
    + '.blanc div{border-top:1px solid var(--ink);padding-top:46px;font-size:12px;line-height:15px;color:var(--gris)}';

  function table(cols, rows) {
    if (!rows.length) return '<div class="vide">Aucun article.</div>';
    return '<table><colgroup>' + cols.map(function (c) { return '<col style="width:' + c[2] + 'px">'; }).join('') + '</colgroup>'
      + '<thead><tr>' + cols.map(function (c) { return '<th' + (c[3] ? ' class="q"' : '') + '>' + E(c[1]) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td' + (c[3] ? ' class="q"' : '') + '>' + E(txt(r[c[0]])) + '</td>'; }).join('') + '</tr>'; }).join('')
      + '</tbody></table>';
  }

  function livraison(f) {
    var sigs = signatures(f), q = quebec(f.livre_at), livre = f.status === 'livre';
    var quand = q.date ? H.dateLongue(q.date) + ' à ' + q.heure : '';
    var h = '<div class="liv"><h2>Livraison</h2>';
    if (livre) h += '<div class="etat"><b>Livré</b>' + (quand ? ' le ' + E(quand) : '') + (txt(f.livre_par_nom) ? ' par ' + E(txt(f.livre_par_nom)) : '') + '</div>';
    if (sigs.length) {
      h += '<div class="sigs">' + sigs.map(function (p) {
        var at = quebec(p.addedAt);
        return '<div><div class="img"><img src="' + E(p.data || p.url) + '" alt="Signature du client"></div><div class="l">Signature du client'
          + (signataire(p) ? '<b>' + E(signataire(p)) + '</b>' : '') + (at.date ? '<span>' + E(H.dateLongue(at.date) + ' à ' + at.heure) + '</span>' : '') + '</div></div>';
      }).join('') + '</div>';
    } else if (livre) {
      h += '<div class="etat">Livraison validée sans signature du client.</div>';
    } else {
      h += '<div class="blanc"><div>Signature du client</div><div>Date</div></div>';
    }
    return h + '</div>';
  }

  function html(f) {
    f = f || {};
    var no = txt(f.no_bon), ret = lignes(f.items_ret);
    var info = [['Client', f.client], ['Adresse', f.adresse], ['Téléphone', f.tel], ['Technicien', f.technicien]];
    var date = H.dateLongue(f.date || '') + (txt(f.heure) ? ' · ' + txt(f.heure) : '');
    return '<!DOCTYPE html><html lang="fr-CA"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<title>' + E('Bon de livraison ' + no) + '</title><style>' + H.fontesCss() + CSS + '</style></head><body><div class="page">'
      + '<img class="logo" src="' + H.LOGO + '" alt="Soucy Aquatik">'
      + '<div class="titre"><div><div class="k">Bon de livraison' + (f.urgent ? '<span class="u">URGENT</span>' : '') + '</div><h1>' + E(no) + '</h1></div><div class="d">' + E(date) + '</div></div>'
      + '<div class="infos">' + info.map(function (x) { return '<div>' + E(x[0]) + '<b>' + E(txt(x[1])) + '</b></div>'; }).join('') + '</div>'
      + '<h2>Articles livrés</h2>' + table(LIV, lignes(f.items_liv))
      + (ret.length ? '<h2>Articles récupérés</h2>' + table(RET, ret) : '')
      + livraison(f)
      + '</div></body></html>';
  }

  var api = { html: html, signatures: signatures, quebec: quebec, LIV: LIV, RET: RET };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SABon = api;
})(typeof window !== 'undefined' ? window : this);
