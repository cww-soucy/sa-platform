/* Portail client Soucy Aquatik — lecture seule. Toutes les données passent par la fonction serveur « portail »
   (session après code à usage unique). Aucun accès direct à la base : la clé publique n'est pas utilisée ici.
   Passation : docs/design_handoff_inspections_portail/README.md §6.9 et §9. */
(function () {
  'use strict';
  var FN = 'https://ldqvdiaewvhnukuaxdmc.supabase.co/functions/v1/portail';
  var I = window.SAInsp, app = document.getElementById('app');
  var P = new URLSearchParams(location.search);
  var S = { data: null, site: null, tab: 'releves', bassin: null, param: null, visite: null, ident: '', qr: null, apercu: P.get('apercu') === '1', niveau: P.get('niveau') || 'gestionnaire' };

  /* ---------- utilitaires ---------- */
  function h(tag, a) {
    var el = document.createElement(tag);
    if (a) Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v == null || v === false) return;
      if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(function (x) { add(el, x); }); else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); }
  function icon(n, s) { var e = document.createElement('sa-i'); e.setAttribute('n', n); e.setAttribute('s', s || 20); return e; }
  function show() { app.textContent = ''; for (var i = 0; i < arguments.length; i++) add(app, arguments[i]); window.scrollTo(0, 0); }
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function fdate(d) { if (!d) return '—'; var p = String(d).slice(0, 10).split('-'); return +p[2] + ' ' + MOIS[+p[1] - 1] + ' ' + p[0]; }
  function fr(v, step) { var dd = String(step || 1).indexOf('.') >= 0 ? String(step).split('.')[1].length : 0; return (+v).toFixed(Math.min(dd, 2)).replace('.', ','); }
  function pz(etat, client) { return h('span', { class: 'pz ' + etat }, h('i'), (client ? I.LIB_CLIENT : I.LIB)[etat] || ''); }
  function store(rem) { try { return rem ? localStorage : sessionStorage; } catch (e) { return null; } }
  function getTok() {
    var k = S.apercu ? 'sa_portail_admin' : 'sa_portail_session';
    for (var i = 0; i < 2; i++) { var st = store(i === 0); try { var o = st && JSON.parse(st.getItem(k) || 'null'); if (o && o.t && (!o.exp || o.exp > Date.now())) return o.t; } catch (e) { } }
    return null;
  }
  function setTok(t, jours) { var st = store(!!jours); try { st.setItem('sa_portail_session', JSON.stringify({ t: t, exp: jours ? Date.now() + jours * 864e5 : 0 })); } catch (e) { } }
  function clearTok() { [true, false].forEach(function (r) { try { store(r).removeItem('sa_portail_session'); } catch (e) { } }); }
  function call(action, body) {
    var hd = { 'Content-Type': 'application/json' }, t = getTok();
    if (t) hd['x-portail-session'] = t;
    return fetch(FN, { method: 'POST', headers: hd, body: JSON.stringify(Object.assign({ action: action }, body || {})) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, message: 'Réponse illisible (HTTP ' + r.status + ')' }; }); });
  }
  function erreur(msg) { show(h('div', { class: 'stack card' }, h('h2', { text: 'Service momentanément indisponible' }), h('p', { text: msg || 'Vérifiez votre connexion et réessayez.' }), h('button', { class: 'btn', onclick: function () { location.reload(); } }, 'Réessayer'))); }

  /* ---------- connexion : QR → identifiant → code à usage unique ---------- */
  var LOGO = '../src/design/logo-soucy-aquatik.png';
  function marque() { return h('img', { class: 'marque', src: LOGO, alt: 'Soucy Aquatik' }); }
  function ecranQr() {
    call('qr', { jeton: P.get('q') }).then(function (r) {
      if (!r.ok) return show(h('div', { class: 'stack card' }, h('h1', { text: 'Lien désactivé' }), h('p', { text: 'Ce code QR n’est plus valide. Demandez la nouvelle affiche à Soucy Aquatik.' })));
      S.qr = r;
      show(h('div', { class: 'stack', style: 'max-width:440px;margin:0 auto' }, marque(),
        h('div', { class: 'muted', text: 'Relevés et rapports de cette installation' }),
        h('h1', { text: r.site }), r.bassin ? h('div', { text: r.bassin }) : null,
        h('button', { class: 'btn primary big', onclick: ecranIdent }, 'Accès client'),
        h('a', { class: 'btn big', href: r.carnet }, 'Je suis technicien'),
        h('p', { class: 'muted', text: 'Accès réservé aux personnes autorisées par le gestionnaire de l’installation. Code ' + r.code + '.' })));
    }).catch(function () { erreur(); });
  }
  function ecranIdent() {
    var inp = h('input', { class: 'input', id: 'ident', type: 'text', inputmode: 'email', autocomplete: 'email', placeholder: 'Courriel ou numéro de cellulaire', value: S.ident });
    var go = function (e) {
      e.preventDefault(); if (!inp.value.trim()) return inp.focus(); S.ident = inp.value.trim(); btn.disabled = true; btn.textContent = 'Envoi…';
      call('demander_code', { identifiant: S.ident, jeton: P.get('q') }).then(function (r) { ecranCode(r.masque || S.ident, r.minutes || 10); }).catch(function () { erreur(); });
    };
    var btn = h('button', { class: 'btn primary big', type: 'submit' }, 'Recevoir un code');
    show(h('form', { class: 'stack', style: 'max-width:440px;margin:0 auto', onsubmit: go }, marque(),
      h('div', { class: 'row muted' }, icon('eye', 18), 'Connexion sécurisée'),
      h('h1', { text: S.qr ? S.qr.site : 'Portail client' }),
      h('label', { for: 'ident', text: 'Votre courriel ou cellulaire inscrit auprès de Soucy Aquatik' }), inp, btn,
      h('p', { class: 'muted', text: 'Pas encore inscrit ? Demandez l’accès à votre gestionnaire.' })));
    inp.focus();
  }
  function ecranCode(masque, minutes) {
    var cases = [], err = h('div', { role: 'alert', style: 'min-height:22px' }), rem = h('input', { type: 'checkbox', id: 'rem' });
    for (var i = 0; i < 6; i++) (function (i) {
      cases.push(h('input', { inputmode: 'numeric', maxlength: '1', 'aria-label': 'Chiffre ' + (i + 1), autocomplete: i ? 'off' : 'one-time-code',
        oninput: function (e) { var v = e.target.value.replace(/\D/g, ''); if (v.length > 1) { v.split('').slice(0, 6 - i).forEach(function (d, k) { cases[i + k].value = d; }); } else e.target.value = v; var n = cases[Math.min(5, i + Math.max(1, v.length))]; if (v && n) n.focus(); },
        onkeydown: function (e) { if (e.key === 'Backspace' && !e.target.value && i) cases[i - 1].focus(); } }));
    })(i);
    var go = function (e) {
      e.preventDefault(); var code = cases.map(function (c) { return c.value; }).join('');
      if (!/^\d{6}$/.test(code)) { err.textContent = 'Entrez les 6 chiffres reçus.'; return; }
      err.textContent = 'Vérification…';
      call('verifier_code', { identifiant: S.ident, code: code, souvenir: rem.checked }).then(function (r) {
        if (!r.ok) { err.textContent = r.message || 'Code incorrect ou expiré.'; return; }
        setTok(r.session, r.jours); history.replaceState(null, '', location.pathname); charger();
      }).catch(function () { err.textContent = 'Réseau indisponible — réessayez.'; });
    };
    show(h('form', { class: 'stack', style: 'max-width:440px;margin:0 auto', onsubmit: go }, marque(),
      h('div', { class: 'row muted' }, icon('eye', 18), 'Connexion sécurisée'),
      S.qr ? h('div', null, h('div', { class: 'muted', text: 'Installation reconnue' }), h('h2', { text: S.qr.site })) : null,
      h('p', { text: 'Si cette adresse est autorisée, nous avons envoyé un code à ' + masque + '. Il est valide ' + minutes + ' minutes.' }),
      h('div', { class: 'otp' }, cases), h('label', { class: 'row' }, rem, 'Se souvenir de cet appareil 90 jours'), err,
      h('button', { class: 'btn primary big', type: 'submit' }, 'Accéder'),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: function () { call('demander_code', { identifiant: S.ident }); err.textContent = 'Nouveau code demandé.'; } }, 'Renvoyer le code'),
        h('button', { class: 'btn', type: 'button', onclick: ecranIdent }, 'Autre courriel ou cellulaire')),
      h('p', { class: 'muted', text: 'Aucun code reçu ? Demandez l’accès à votre gestionnaire.' })));
    cases[0].focus();
  }

  /* ---------- données ---------- */
  function charger() {
    var p = S.apercu ? call('admin_apercu', { compte_id: P.get('compte'), site_id: P.get('site'), niveau: S.niveau }) : call('donnees', {});
    show(h('p', { class: 'muted', text: 'Chargement…' }));
    p.then(function (r) {
      if (!r.ok) { if (S.apercu) return erreur('Aperçu impossible : ouvrez-le depuis sa-admin (session administrateur expirée ?).'); clearTok(); return P.get('q') ? ecranQr() : ecranIdent(); }
      S.data = r; if (!S.site || !r.sites.some(function (s) { return s.id === S.site; })) S.site = (r.sites[0] || {}).id || null; rendre();
    }).catch(function () { erreur(); });
  }
  function visitesDe(site) {
    var D = S.data, b0 = (site.bassins[0] || {}).nom;
    return D.releves.filter(function (r) { return r.site_id === site.id; }).map(function (r) {
      var T = D.types[r.type_code] || D.types.GEN || {};
      return { r: r, T: T, date: r.date, bassin: r.bassin || b0 || '', items: I.itemsVisite(r, T, D.catalogue) };
    }).sort(function (a, b) { return (b.date + (b.r.heure || '')).localeCompare(a.date + (a.r.heure || '')); });
  }
  function derniere(vis) { var o = {}; vis.forEach(function (v) { if (!o[v.bassin]) o[v.bassin] = v; }); return o; }

  /* ---------- écran principal ---------- */
  function rendre() {
    var D = S.data, site = D.sites.filter(function (s) { return s.id === S.site; })[0];
    if (S.apercu) {
      var bar = document.getElementById('apercu'); bar.hidden = false; bar.textContent = '';
      var sel = h('select', { 'aria-label': 'Voir comme', onchange: function (e) { S.niveau = e.target.value; charger(); } },
        ['operateur', 'gestionnaire', 'direction'].map(function (n) { return h('option', { value: n, selected: n === S.niveau }, I.NIVEAU_NOM[n]); }));
      add(bar, [h('b', { text: 'Aperçu · niveau ' + I.NIVEAU_NOM[S.niveau] }), h('span', { text: 'Voir comme :' }), sel, h('span', { class: 'muted', style: 'color:inherit', text: 'aucun accès client n’est journalisé' })]);
    }
    if (!site) return show(h('div', { class: 'card' }, h('h2', { text: 'Aucune installation associée' }), h('p', { text: 'Votre accès n’est relié à aucun site. Communiquez avec Soucy Aquatik.' })));
    var vis = visitesDe(site), last = derniere(vis), dr = D.droits;
    var lastItems = []; Object.keys(last).forEach(function (k) { lastItems = lastItems.concat(last[k].items); });
    var se = I.etatsSystemes(lastItems), act = lastItems.filter(function (i) { return i.etat === 'action'; });
    var inter = D.interventions.filter(function (w) { return w.site === site.id && !w.faite; });
    var att = lastItems.filter(function (i) { return i.mode === 'ouinon' && i.etat !== 'ok' && i.etat !== 'na'; });
    var lv = vis[0];

    var head = h('header', { class: 'head' },
      D.compte && D.compte.logo ? h('img', { class: 'logo', src: D.compte.logo, alt: D.compte.nom }) : h('b', { class: 'nomclient', text: (D.compte && D.compte.nom) || site.nom }),
      h('div', { class: 'grow' },
        D.sites.length > 1 ? h('select', { class: 'input', style: 'max-width:340px', 'aria-label': 'Mes installations', onchange: function (e) { S.site = e.target.value; S.bassin = null; rendre(); } },
          D.sites.map(function (s) { return h('option', { value: s.id, selected: s.id === site.id }, s.nom); })) : null,
        h('h1', { text: site.nom }), h('div', { class: 'muted', text: lv ? 'Dernière visite : ' + fdate(lv.date) + (lv.r.heure ? ', ' + lv.r.heure : '') : 'Aucune visite publiée' })),
      h('div', { style: 'text-align:right' }, h('div', { text: D.contact.nom }), h('span', { class: 'badge', text: I.NIVEAU_NOM[D.contact.niveau] || '' }), h('div', { class: 'opere' }, h('span', { text: 'Opéré par' }), h('img', { src: LOGO, alt: '' }), h('b', { text: 'Soucy Aquatik' }))));

    var nInt = act.length + inter.length;
    var bandeau = nInt ? h('div', { class: 'box' }, h('b', { text: nInt + (nInt > 1 ? ' interventions en cours' : ' intervention en cours') }),
      h('div', { text: I.resume(lastItems, true) })) : h('div', { class: 'box' }, h('b', { text: lv ? 'Tout est conforme.' : 'En attente de la première visite.' }));

    var sys = h('div', { class: 'sys', role: 'list', 'aria-label': 'État des systèmes' }, I.SYSTEMES.map(function (s) {
      var e = se[s.code]; return h('div', { class: e, role: 'listitem' }, h('div', { class: 'row' }, icon(s.icone, 20), h('b', { text: s.nom })), pz(e, true));
    }));
    var attention = att.length ? h('div', { class: 'dash' }, h('h3', { text: 'À votre attention' }), h('ul', null, att.map(function (i) { return h('li', { text: i.libelle + (i.note && dr.rapports ? ' — ' + i.note : '') }); }))) : null;

    var bassins = h('div', { class: 'card stack' }, h('h3', { text: 'Vos bassins' }), site.bassins.length ? site.bassins.map(function (b, i) {
      var v = last[b.nom], e = v ? I.pire(v.items.map(function (x) { return x.etat; })) : 'na';
      return h('div', { class: 'row', style: 'border-top:1px solid var(--color-divider);padding-top:8px' }, h('span', { class: 'badge', text: String(b.numero || i + 1) }), h('div', { class: 'grow' }, h('b', { text: b.nom }), h('div', { class: 'muted', text: v ? 'Visite du ' + fdate(v.date) : 'Aucune visite publiée' })), pz(e, true));
    }) : h('div', { class: 'muted', text: 'Un seul bassin.' }));

    var plans = D.documents.filter(function (d) { return d.type === 'plan' && d.site_id === site.id && /^image\//.test(d.mime) && d.url; });
    var plan = dr.plans && plans.length ? h('div', { class: 'stack' }, h('h3', { text: plans[0].titre + (plans[0].niveau_plan ? ' · ' + plans[0].niveau_plan : '') }),
      h('div', { class: 'plan' }, h('img', { src: plans[0].url, alt: plans[0].titre }), site.bassins.filter(function (b) { return b.plan_doc === plans[0].id && b.plan_x != null; }).map(function (b, i) {
        var v = last[b.nom], e = v ? I.pire(v.items.map(function (x) { return x.etat; })) : 'na';
        return h('span', { class: 'm ' + e, style: 'left:' + b.plan_x + '%;top:' + b.plan_y + '%', title: b.nom, text: String(b.numero || i + 1) });
      }))) : null;

    var TABS = [['releves', 'Relevés', 'releves'], ['historique', 'Historique', 'historique'], ['rapports', 'Rapports', 'rapports'], ['documents', 'Plans et documents', 'plans'], ['interventions', 'Interventions', 'interventions'], ['factures', 'Factures', 'factures']];
    var tabs = h('div', { class: 'tabs', role: 'tablist' }, TABS.map(function (t) {
      return h('button', { role: 'tab', 'aria-selected': String(S.tab === t[0]), class: dr[t[2]] ? '' : 'off', onclick: function () { S.tab = t[0]; rendre(); } }, t[1]);
    }));
    var cur = TABS.filter(function (t) { return t[0] === S.tab; })[0] || TABS[0];
    var corps = !dr[cur[2]] ? h('div', { class: 'dash' }, h('b', { text: cur[1] + ' : accès ' + (cur[2] === 'factures' ? 'Direction' : 'Gestionnaire') + '.' }), h('div', { text: ' Demandez l’accès à votre gestionnaire.' }))
      : cur[0] === 'releves' ? ongletReleves(site, vis) : cur[0] === 'historique' ? ongletHistorique(vis) : cur[0] === 'rapports' ? ongletRapport(vis)
      : cur[0] === 'documents' ? ongletDocs(site) : cur[0] === 'interventions' ? ongletInterventions(site, vis) : h('div', { class: 'dash', text: 'Les factures seront disponibles ici prochainement. Pour une copie, écrivez à Soucy Aquatik.' });

    show(head, h('div', { class: 'cols' },
      h('div', { class: 'stack' }, bandeau, sys, attention, plan, tabs, corps),
      h('aside', { class: 'stack' }, bassins, lv && dr.rapports ? h('button', { class: 'btn big', onclick: function () { S.tab = 'rapports'; S.visite = lv.r.id; rendre(); } }, 'Rapport de la dernière visite') : null)),
      h('div', { class: 'foot' }, D.urgence ? h('a', { href: 'tel:' + D.urgence.replace(/[^\d+]/g, '') }, 'Urgence 24/7 · ' + D.urgence) : null,
        S.apercu ? null : h('button', { class: 'btn', onclick: function () { call('deconnexion'); clearTok(); location.reload(); } }, 'Se déconnecter')));
  }

  function ongletReleves(site, vis) {
    var D = S.data, bn = site.bassins.map(function (b) { return b.nom; });
    if (!S.bassin || bn.indexOf(S.bassin) < 0) S.bassin = bn[0] || '';
    var vb = vis.filter(function (v) { return !bn.length || v.bassin === S.bassin; });
    var T = vb[0] ? vb[0].T : (D.types[D.contrats && D.contrats[site.id]] || D.types.GEN || { fields: [] }), F = T.fields || [];
    if (!F.length) return h('div', { class: 'muted', text: 'Aucun relevé publié.' });
    var f = F.filter(function (x) { return x.key === S.param; })[0] || F[0]; S.param = f.key;
    var lim = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    var r30 = vb.filter(function (v) { return v.date >= lim; }), mes = [];
    r30.forEach(function (v) { F.forEach(function (x) { var val = v.r.vals && v.r.vals[x.key]; if (val != null && (!v.r.touched || v.r.touched[x.key])) mes.push(I.etatEau(x, val) !== 'action'); }); });
    var pct = mes.length ? Math.round(mes.filter(Boolean).length / mes.length * 100) : null;
    var lastV = vb[0], pts = r30.slice().reverse().filter(function (v) { return v.r.vals && v.r.vals[f.key] != null; });
    var W = 600, H = 180, y = function (v) { return H - (v - f.min) / ((f.max - f.min) || 1) * H; }, x = function (i) { return pts.length > 1 ? i / (pts.length - 1) * W : W / 2; };
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + String(f.label).replace(/[<>"&]/g, '') + ' sur 30 jours"><defs><pattern id="hz" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#b5d9fd" stroke-width="2"/></pattern></defs>'
      + '<rect x="0" y="' + y(f.hi) + '" width="' + W + '" height="' + Math.max(1, y(f.lo) - y(f.hi)) + '" fill="url(#hz)"/>'
      + (pts.length > 1 ? '<polyline fill="none" stroke="#1d1f20" stroke-width="2" points="' + pts.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v.r.vals[f.key]).toFixed(1); }).join(' ') + '"/>' : '')
      + pts.map(function (v, i) { var o = I.etatEau(f, v.r.vals[f.key]) === 'action'; return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v.r.vals[f.key]).toFixed(1) + '" r="' + (o ? 6 : 4) + '" fill="' + (o ? '#1d1f20' : '#f2f2f3') + '" stroke="#1d1f20" stroke-width="1.5"/>'; }).join('') + '</svg>';
    var chart = h('div'); chart.innerHTML = svg; // contenu numérique généré ici, aucune donnée texte de l'utilisateur
    var m = new Date(), mk = m.toISOString().slice(0, 7), reg = vb.filter(function (v) { return v.date.slice(0, 7) === mk; }).reverse();
    return h('div', { class: 'stack' },
      bn.length > 1 ? h('div', { class: 'row' }, bn.map(function (n) { return h('button', { class: 'btn' + (n === S.bassin ? ' primary' : ''), onclick: function () { S.bassin = n; rendre(); } }, n); })) : null,
      h('div', { class: 'row' }, h('div', { style: 'font:600 30px var(--font-heading)', text: pct == null ? '—' : pct + ' %' }), h('div', { class: 'muted', text: 'des mesures dans la norme sur 30 jours' })),
      lastV ? h('table', null, h('thead', null, h('tr', null, h('th', { text: 'Paramètre' }), h('th', { text: 'Valeur du ' + fdate(lastV.date) }), h('th', { text: 'Zone visée' }))),
        h('tbody', null, F.map(function (x) { var v = lastV.r.vals && lastV.r.vals[x.key], has = v != null && (!lastV.r.touched || lastV.r.touched[x.key]), o = has && I.etatEau(x, v) === 'action';
          return h('tr', null, h('td', { text: x.label }), h('td', { class: o ? 'out' : '', text: has ? fr(v, x.step) + (x.unit ? ' ' + x.unit : '') : '—' }), h('td', { text: fr(x.lo, x.step) + ' – ' + fr(x.hi, x.step) + (x.unit ? ' ' + x.unit : '') })); }))) : null,
      h('div', { class: 'row' }, h('label', { for: 'param', text: 'Graphique 30 jours :' }), h('select', { id: 'param', class: 'input', style: 'max-width:240px', onchange: function (e) { S.param = e.target.value; rendre(); } }, F.map(function (x) { return h('option', { value: x.key, selected: x.key === f.key }, x.label); }))),
      chart,
      S.data.droits.rqep ? h('div', { class: 'stack' }, h('div', { class: 'row' }, h('h3', { class: 'grow', text: 'Registre RQEP · ' + MOIS[m.getMonth()] + ' ' + m.getFullYear() }), h('button', { class: 'btn noprint', onclick: function () { window.print(); } }, 'Imprimer / PDF'),
        S.data.droits.exports ? h('button', { class: 'btn noprint', onclick: function () { exporter(site, vb, F); } }, 'Excel 12 mois') : null),
        h('table', null, h('thead', null, h('tr', null, h('th', { text: 'Date' }), F.map(function (x) { return h('th', { text: x.label + (x.unit ? ' (' + x.unit + ')' : '') }); }))),
          h('tbody', null, reg.length ? reg.map(function (v) { return h('tr', null, h('td', { text: fdate(v.date) + ' ' + (v.r.heure || '') }), F.map(function (x) { var val = v.r.vals && v.r.vals[x.key], has = val != null && (!v.r.touched || v.r.touched[x.key]); return h('td', { class: has && I.etatEau(x, val) === 'action' ? 'out' : '', text: has ? fr(val, x.step) : '—' }); })); })
            : h('tr', null, h('td', { colspan: String(F.length + 1), text: 'Aucun relevé ce mois-ci.' }))))) : null);
  }
  function exporter(site, vb, F) {
    var esc = function (s) { s = String(s == null ? '' : s); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var lignes = [['Date', 'Heure', 'Bassin'].concat(F.map(function (x) { return x.label + (x.unit ? ' (' + x.unit + ')' : ''); })).map(esc).join(';')];
    vb.slice().reverse().forEach(function (v) { lignes.push([v.date, v.r.heure || '', v.bassin].concat(F.map(function (x) { var val = v.r.vals && v.r.vals[x.key]; return val == null ? '' : String(val).replace('.', ','); })).map(esc).join(';')); });
    var a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + lignes.join('\r\n')], { type: 'text/csv;charset=utf-8' })), download: 'Releves_' + site.nom.replace(/[^A-Za-zÀ-ÿ0-9]+/g, '_') + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function compte(items) { var c = I.compteurs(items); return c.action || c.watch ? [c.action ? c.action + ' intervention' + (c.action > 1 ? 's' : '') : '', c.watch ? c.watch + ' à surveiller' : ''].filter(Boolean).join(' · ') : 'Tout conforme'; }
  function ongletHistorique(vis) {
    if (!vis.length) return h('div', { class: 'muted', text: 'Aucune visite publiée.' });
    return h('table', null, h('thead', null, h('tr', null, h('th', { text: 'Visite' }), h('th', { text: 'Bassin' }), h('th', { text: 'Constat' }), h('th', { text: 'État' }))),
      h('tbody', null, vis.map(function (v) { return h('tr', { style: 'cursor:pointer', onclick: function () { if (S.data.droits.rapports) { S.tab = 'rapports'; S.visite = v.r.id; rendre(); } } },
        h('td', { text: fdate(v.date) + ' ' + (v.r.heure || '') }), h('td', { text: v.bassin }), h('td', { text: compte(v.items) }), h('td', null, pz(I.pire(v.items.map(function (i) { return i.etat; })), true))); })));
  }
  function ongletRapport(vis) {
    if (!vis.length) return h('div', { class: 'muted', text: 'Aucun rapport publié.' });
    var v = vis.filter(function (x) { return x.r.id === S.visite; })[0] || vis[0], se = I.etatsSystemes(v.items);
    var ordre = I.SYSTEMES.slice().sort(function (a, b) { var R = { action: 3, watch: 2, ok: 1, na: 0 }; return R[se[b.code]] - R[se[a.code]]; });
    return h('article', { class: 'stack' },
      h('div', { class: 'row noprint' }, h('select', { class: 'input', style: 'max-width:340px', 'aria-label': 'Visite', onchange: function (e) { S.visite = e.target.value; rendre(); } }, vis.map(function (x) { return h('option', { value: x.r.id, selected: x === v }, fdate(x.date) + ' · ' + x.bassin); })),
        h('button', { class: 'btn', onclick: function () { window.print(); } }, 'Imprimer / PDF')),
      h('h2', { text: 'Visite du ' + fdate(v.date) + (v.r.heure ? ', ' + v.r.heure : '') }), h('div', { class: 'muted', text: v.bassin + (v.r.tech_nom ? ' · ' + v.r.tech_nom : '') }),
      h('p', { style: 'font-size:16px', text: I.resume(v.items, true) }),
      ordre.filter(function (s) { return se[s.code] !== 'na'; }).map(function (s) {
        var its = v.items.filter(function (i) { return i.systeme === s.code; }), bad = its.filter(function (i) { return i.etat !== 'ok'; });
        return h('section', { class: 'stack', style: 'border-top:1px solid var(--color-divider);padding-top:10px' }, h('div', { class: 'row' }, icon(s.icone, 20), h('h3', { class: 'grow', text: s.nom }), pz(se[s.code], true)),
          bad.length ? h('table', null, h('tbody', null, bad.map(function (i) { return h('tr', null, h('td', { text: i.libelle }), h('td', { text: [i.valeur, i.note].filter(Boolean).join(' — ') }), h('td', null, pz(i.etat, true))); })))
            : h('div', { class: 'muted', text: its.map(function (i) { return i.libelle; }).join(' · ') }));
      }));
  }
  function ongletDocs(site) {
    var docs = S.data.documents.filter(function (d) { return !d.site_id || d.site_id === site.id; });
    if (!docs.length) return h('div', { class: 'muted', text: 'Aucun document partagé.' });
    return h('table', null, h('tbody', null, docs.map(function (d) { return h('tr', null, h('td', null, icon(d.type === 'plan' ? 'layers' : 'file', 18)), h('td', null, d.url ? h('a', { href: d.url, target: '_blank', rel: 'noopener' }, d.titre) : d.titre), h('td', { class: 'muted', text: [d.type, d.niveau_plan, d.taille ? Math.round(d.taille / 1024) + ' Ko' : ''].filter(Boolean).join(' · ') })); })));
  }
  function ongletInterventions(site, vis) {
    var w = S.data.interventions.filter(function (x) { return x.site === site.id; });
    if (!w.length) return h('div', { class: 'muted', text: 'Aucune intervention prévue.' });
    return h('table', null, h('tbody', null, w.map(function (x) { return h('tr', null, h('td', { text: fdate(x.date) }), h('td', { text: x.type.charAt(0).toUpperCase() + x.type.slice(1) + (x.urgent ? ' · prioritaire' : '') }), h('td', { text: x.faite ? 'Terminée' : 'Prévue' })); })));
  }

  /* ---------- démarrage ---------- */
  if (S.apercu) charger();
  else if (getTok()) charger();
  else if (P.get('q')) ecranQr();
  else ecranIdent();
})();
