/* ---------- sa-admin › Sondages clients : liste (actifs et fermés), création, réutilisation, modification et résultats ----------
   Inséré dans app.js par assemble.py (même portée : rpc, Comp, fdate, fr, netMsg…).
   Base : fonctions sondages_liste / sondage_enregistrer / sondage_stats protégées par la clé (docs/sql/MIGRATION_2026-10-14_sondages_admin.sql).
   Le lien envoyé au client est la page sondage (gabarit de 11 questions) avec ?slug=… */
var SOND_URL='https://sa-platform.pages.dev/sondage-hivernement-levis.html';
function sondUrl(slug){return SOND_URL+'?slug='+encodeURIComponent(slug);}
function sondSlug(t){return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}
/* « Client — Site » est enregistré dans une seule colonne : on le sépare pour le formulaire */
function sondSplit(c){var s=String(c||''),i=s.indexOf(' — ');return i<0?{client:s,site:''}:{client:s.slice(0,i),site:s.slice(i+3)};}

Comp.prototype.sondLoadListe=function(force){var self=this,k=this.state.sondKey;if(!k||(this._soL&&!force))return;this._soL=1;
  rpc('sondages_liste',{p_cle:k}).then(function(rows){if(!Array.isArray(rows))throw new Error('cle');self.soListe=rows;self.update();})
   .catch(function(e){self._soL=0;
     if(/accès refusé|cle/.test(String(e&&e.message))){try{localStorage.removeItem('sa_admin_sondkey');}catch(x){}self.soListe=null;self.setState({sondKey:''});self.flash('Clé d’accès incorrecte');}
     else{self.soListe=(self.D.sond||[]).map(function(s){return Object.assign({reponses:null},s);});self.flash('Liste complète indisponible : '+netMsg(e));}});};

Comp.prototype.sondSave=function(){var self=this,st=this.state,f=st.soF||{},titre=String(f.titre||'').trim(),client=String(f.client||'').trim(),site=String(f.site||'').trim();
  if(!titre||!client){this.flash('Le titre et le client sont requis');return;}
  var full=site?client+' — '+site:client,slug=f.slug,liste=this.soListe||[];
  if(!slug){slug=sondSlug(titre+'-'+client+'-'+new Date().getFullYear());var b=slug,n=2;while(liste.some(function(s){return s.slug===slug;}))slug=b+'-'+(n++);}
  rpc('sondage_enregistrer',{p_cle:st.sondKey,p_slug:slug,p_titre:titre,p_client:full,p_actif:f.slug?f.actif!==false:true})
   .then(function(){self.flash(f.slug?'Sondage modifié':'Sondage créé — copiez le lien pour l’envoyer au client');self._soL=0;self.setState({soF:null,survey:slug});self.sondLoadListe(true);})
   .catch(function(e){self.flash('Échec — rien n’a été enregistré : '+netMsg(e));});};

Comp.prototype.sondBasculer=function(s){var self=this;
  rpc('sondage_enregistrer',{p_cle:this.state.sondKey,p_slug:s.slug,p_titre:s.titre,p_client:s.client,p_actif:!s.actif})
   .then(function(){self.flash(s.actif?'Sondage fermé : le lien n’accepte plus de réponses':'Sondage rouvert');self._soL=0;self.sondLoadListe(true);})
   .catch(function(e){self.flash('Échec : '+netMsg(e));});};

Comp.prototype.sondagesVals=function(){var self=this,st=this.state,D=this.D,k=st.sondKey;
  var RAMP=['var(--color-accent-100)','var(--color-accent-300)','var(--color-accent-500)','var(--color-accent-700)','var(--color-accent-900)'];
  var so={needKey:!k,ready:false,ramp:RAMP,keyVal:st.keyIn,onKey:function(e){self.state.keyIn=e.target.value;},
    saveKey:function(){var v=String(self.state.keyIn||'').trim();if(!v)return;try{localStorage.setItem('sa_admin_sondkey',v);}catch(e){}self.sd={};self._sd={};self._soL=0;self.soListe=null;self.setState({sondKey:v,keyIn:''});}};
  if(!D||st.mod!=='sondages'||!k)return{so:so};
  this.sondLoadListe();
  var L=this.soListe;
  if(!L){so.needKey=false;so.ready=false;return{so:so};}
  so.ready=true;so.vide=!L.length;
  var slugS=st.survey&&L.some(function(x){return x.slug===st.survey;})?st.survey:(L[0]&&L[0].slug),S=L.filter(function(x){return x.slug===slugS;})[0];
  var form=st.soF;
  so.liste=L.map(function(x){var on=!form&&x.slug===slugS,rs=self.sd[x.slug];return{slug:x.slug,titre:x.titre,client:x.client||'—',statut:x.actif?'Ouvert':'Fermé',
    reponses:rs?rs.length:(x.reponses==null?'—':x.reponses),date:fdate(x.created_at),bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)',
    go:function(){self.setState({survey:x.slug,soF:null});}};});
  var setF=function(key){return function(e){self.state.soF[key]=e.target.type==='checkbox'?e.target.checked:e.target.value;};};
  so.nouveau=function(){self.setState({soF:{titre:'Formation hivernement',client:'',site:''}});};
  so.fermer=function(){self.setState({soF:null});};
  so.form=!!form;
  if(form){var ed=!!form.slug;so.f={h:ed?'Modifier le sondage':'Nouveau sondage',btn:ed?'Enregistrer':'Créer le lien',edit:ed,
    aide:ed?'Le lien déjà envoyé reste le même ; les réponses reçues sont conservées.':'Le sondage utilise le questionnaire de satisfaction (11 questions). Le lien sera prêt à copier après la création.',
    titre:form.titre,client:form.client,site:form.site,actif:form.actif!==false,
    onTitre:setF('titre'),onClient:setF('client'),onSite:setF('site'),onActif:function(e){self.state.soF.actif=e.target.checked;},save:function(){self.sondSave();}};}
  so.sel=!form&&!!S;
  if(S&&!form){
    var rows=this.sd[S.slug];
    if(rows===undefined&&!this._sd[S.slug]){this._sd[S.slug]=1;this.loadSond(S.slug);}
    var rs=rows||[];
    var avg=function(c){var v=rs.map(function(r){return Number(r[c]);}).filter(function(x){return x>0;});return v.length?v.reduce(function(a,b){return a+b;},0)/v.length:0;};
    var dist=function(c){var d=[0,0,0,0,0];rs.forEach(function(r){var v=Number(r[c]);if(v>=1&&v<=5)d[v-1]++;});return d;};
    var nps=(function(){var v=rs.map(function(r){return r.q10_nps;}).filter(function(x){return x!=null;});if(!v.length)return null;return Math.round((v.filter(function(x){return x>=9;}).length-v.filter(function(x){return x<=6;}).length)/v.length*100);})();
    var compte=function(c){var o={};rs.forEach(function(r){(r[c]||[]).forEach(function(x){o[x]=(o[x]||0)+1;});});var n=rs.length||1;
      return Object.keys(o).sort(function(a,b){return o[b]-o[a];}).map(function(x){return{l:x,n:o[x],w:Math.round(o[x]/n*100)};});};
    var qs=[['q2_qualite','Qualité générale'],['q3_clarte','Clarté des explications']].map(function(q){var d=dist(q[0]),tot=d.reduce(function(a,b){return a+b;},0)||1,a=avg(q[0]);
      return{q:q[1],avg:a?fr(a,'0.1'):'—',segs:d.map(function(n,i){return{w:n/tot*100,bg:RAMP[i],fg:i>=2?'#ffffff':'var(--color-accent-900)',label:n/tot>0.08?n:'',tip:(i+1)+' : '+n+' réponse(s)'};})};});
    var verb=[];rs.forEach(function(r){[['q7_utile','Le plus utile'],['q8_ameliorer','À améliorer'],['q11_commentaire','Commentaire']].forEach(function(c){if(r[c[0]]&&String(r[c[0]]).trim().length>2)verb.push(c[1]+' — '+r[c[0]]+'  ('+(r.nom||'anonyme')+(r.fonction?', '+r.fonction:'')+')');});});
    var choix=[['q6_sujets','Sujets bien couverts'],['q9_besoins','Besoins pour une prochaine formation']].map(function(c){return{h:c[1],rows:compte(c[0])};}).filter(function(c){return c.rows.length;});
    var url=sondUrl(S.slug),sp=sondSplit(S.client);
    so.v={titre:S.titre,client:S.client||'—',statut:S.actif?'ouvert aux réponses':'fermé',url:url,
      copier:function(){(navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(function(){self.flash('Lien copié');},function(){self.flash('Copie impossible : sélectionnez le lien et copiez-le');});},
      modifier:function(){self.setState({soF:{slug:S.slug,titre:S.titre,client:sp.client,site:sp.site,actif:S.actif}});},
      reutiliser:function(){self.setState({soF:{titre:S.titre,client:'',site:''}});},
      basculer:function(){self.sondBasculer(S);},basculerLbl:S.actif?'Fermer le sondage':'Rouvrir le sondage',
      charge:rows===undefined,aucune:rows!==undefined&&!rs.length,hasQ:rs.length>0,questions:qs,choix:choix,verbatims:verb,
      kpis:[{l:'Réponses',v:rows===undefined?'…':rs.length},{l:'Qualité moy.',v:avg('q2_qualite')?fr(avg('q2_qualite'),'0.1')+' / 5':'—'},{l:'Clarté moy.',v:avg('q3_clarte')?fr(avg('q3_clarte'),'0.1')+' / 5':'—'},{l:'NPS',v:nps==null?'—':(nps>0?'+':'')+nps}]};
  }
  return{so:so};};
