/* ---------- sa-admin › Inspection et hivernage par ouvrage, gabarits d'hivernage ----------
   Inséré dans app.js par assemble.py (même portée : get, rest, Comp, norm, nowIso, auditT…).
   Fiche du site › bassin › « Inspection et hivernage » : points d'inspection retirés (bassin.insp.exclus) ou propres à l'ouvrage
   (inspection_points.bassin_id), gabarit d'hivernage, étapes retirées (bassin.hiv.exclus) ou ajoutées (bassin.hiv.ajouts).
   Hivernage › « Gabarits d'hivernage » : étapes de chaque gabarit (table gabarits_hivernage ; src/hivernage/checklist.js tant qu'elle est vide).
   Base : docs/sql/MIGRATION_2026-10-22_gabarits_ouvrages.sql. */
var OUV_TYPE='_ouvrage';   /* type_code des points propres à un ouvrage : jamais pris pour un type de bassin, même par une ancienne version */
function ouvId(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);}
function basculer(arr,v){var a=(arr||[]).slice(),i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);return a;}

Comp.prototype.ocMut=function(fn){var i=this.state.oc.i;this.sfMut(function(x){var b=x.bassins[i];if(b)fn(b);});};
Comp.prototype.ocSet=function(o){this.setState({oc:Object.assign({},this.state.oc,o)});};
Comp.prototype.ocVals=function(){var self=this,st=this.state,sf=st.sf,oc=st.oc,D=this.D,I=window.SAInsp,H=window.SAHiv;
  if(!oc||!D||!sf||!sf.f||!sf.f.bassins||!sf.f.bassins[oc.i])return{ocOpen:false};
  var b=sf.f.bassins[oc.i],bid=String(b.id||''),code=b.type_code&&D.types[b.type_code]?b.type_code:(sf.type_code||'GEN'),T=D.types[code]||{label:code,checks:[]};
  var close=function(){self.setState({oc:null});};
  /* Inspection */
  var ex=(b.insp&&b.insp.exclus)||[],pts=I.pointsDuType(code,D.cat||[],T.checks||[]),pr=I.propres(D.cat||[],bid);
  var sysOpts=I.SYSTEMES.filter(function(s){return s.code!=='eau';});
  /* Hivernage */
  var L=H.gabarits(D.gab),cfg=b.hiv||{},g=H.gabaritDe(b,D.gab),auto=H.gabaritDe(Object.assign({},b,{hiv:null}),D.gab),hex=cfg.exclus||[],aj=cfg.ajouts||[];
  var gsel=cfg.gabarit||'';
  var corps=g?(g.sections||[]).filter(function(s){return!s.commun;}):[];
  return{ocOpen:true,ocTitle:(b.nom||'Bassin')+' — inspection et hivernage',ocClose:close,ocCloseBg:function(e){if(e.target===e.currentTarget)close();},
    ocInspTxt:'Points du type « '+(T.label||code)+' » (décocher ceux qui ne s’appliquent pas à cet ouvrage)',
    ocPts:pts.map(function(p){var on=ex.indexOf(p.id)<0;return{l:p.libelle,sys:I.NOM[p.systeme_code]||'',on:on,go:function(){self.ocMut(function(x){x.insp=Object.assign({},x.insp,{exclus:basculer((x.insp&&x.insp.exclus)||[],p.id)});});}};}),
    ocNoPts:!pts.length,
    ocPropres:pr.map(function(p){return{l:p.libelle,sys:I.NOM[p.systeme_code]||'',del:function(){self.savePoint(Object.assign({},p,{actif:false})).then(function(){self.flash('Point retiré de cet ouvrage');});}};}),
    ocNoPropre:!pr.length,
    ocPt:{v:oc.pt||'',on:function(e){self.ocSet({pt:e.target.value});}},
    ocSys:sysOpts.map(function(s){return{v:s.code,l:s.nom,sel:s.code===(oc.sys||'structure')};}),onOcSys:function(e){self.ocSet({sys:e.target.value});},
    ocAddPt:function(){var l=String(self.state.oc.pt||'').trim();if(!l)return;var sy=self.state.oc.sys||I.systemeDe(l);
      self.savePoint({id:ouvId('ouv-'),systeme_code:sy,type_code:OUV_TYPE,bassin_id:bid,site_id:sf.id||null,libelle:l,mode:sy==='securite'?'ouinon':'etat',obligatoire:false,ordre:100+pr.length,actif:true})
        .then(function(){self.ocSet({pt:''});});},
    ocGabs:[{v:'',l:'Automatique'+(auto?' ('+auto.nom+')':''),sel:!gsel}].concat(L.map(function(x){return{v:x.code,l:x.nom,sel:gsel===x.code};}),[{v:'aucun',l:'Aucun hivernage',sel:gsel==='aucun'}]),
    onOcGab:function(e){var v=e.target.value;self.ocMut(function(x){x.hiv=Object.assign({},x.hiv,{gabarit:v||undefined,exclus:[]});if(!v)delete x.hiv.gabarit;});},
    ocHasGab:!!g,ocGabTxt:g?'Étapes du gabarit « '+g.nom+' » (décocher celles qui ne s’appliquent pas)':'Pas d’hivernement pour cet ouvrage.',
    ocSecs:g?(g.sections||[]).map(function(s){return{titre:s.titre+(s.commun?' (commune au site)':''),items:s.items.map(function(it,j){var ref=s.id+'-'+j,on=hex.indexOf(ref)<0;
      return{l:(it.n&&it.n!=='—'?it.n+'. ':'')+it.t+(it.b?' '+it.b:''),fw:it.crit?'700':'400',on:on,go:function(){self.ocMut(function(x){x.hiv=Object.assign({},x.hiv,{exclus:basculer((x.hiv&&x.hiv.exclus)||[],ref)});});}};})};}):[],
    ocAjouts:aj.map(function(a,i){var sec=corps.filter(function(s){return s.id===a.section;})[0];return{l:a.t+(a.crit?' (critique)':''),sec:sec?sec.titre:'',del:function(){self.ocMut(function(x){x.hiv.ajouts.splice(i,1);});}};}),
    ocNoAjout:!aj.length,
    ocEt:{v:oc.et||'',on:function(e){self.ocSet({et:e.target.value});}},
    ocEtSecs:corps.map(function(s,i){return{v:s.id,l:s.titre,sel:(oc.sec||(corps[corps.length-1]||{}).id)===s.id};}),onOcEtSec:function(e){self.ocSet({sec:e.target.value});},
    ocCrit:!!oc.crit,onOcCrit:function(e){self.ocSet({crit:e.target.checked});},
    ocAddEt:function(){var o=self.state.oc,t=String(o.et||'').trim();if(!t)return;var sec=o.sec||(corps[corps.length-1]||{}).id||'';
      self.ocMut(function(x){x.hiv=Object.assign({},x.hiv);x.hiv.ajouts=(x.hiv.ajouts||[]).concat([{id:ouvId(''),t:t,section:sec,crit:!!o.crit}]);});self.ocSet({et:'',crit:false});},
    ocNote:'Les retraits, ajouts d’étapes et le gabarit sont enregistrés avec la fiche du site. Les points d’inspection propres à l’ouvrage sont enregistrés tout de suite.'};
};

/* ---------- Gabarits d'hivernage ---------- */
function gbSlug(s){return norm(s).replace(/[^a-z0-9]+/g,'').slice(0,24)||'gabarit';}
function gbRow(g){return{code:g.code,nom:g.nom,types:g.types||[],sections:g.sections,conseils:g.conseils||[],alerte:g.alerte||'',ordre:g.ordre||0,actif:g.actif!==false};}
Comp.prototype.gbOpen=function(code){var H=window.SAHiv,L=H.gabarits(this.D.gab),g=L.filter(function(x){return x.code===code;})[0]||L[0];
  this.setState({gb:{code:g.code,nom:g.nom,types:(g.types||[]).join(', '),txt:H.versTexte(g.sections),conseils:(g.conseils||[]).join('\n'),alerte:g.alerte||'',isNew:false,busy:false,confirm:false}});};
Comp.prototype.gbNew=function(){this.setState({gb:{code:'',nom:'',types:'',txt:'## Sécurité et préparation [commun]\n- \n\n## Phase 1 — \n1. \n\n## Formation des employés [commun]\n- ',conseils:'',alerte:window.SAHiv.GABARITS[0].alerte,isNew:true,busy:false,confirm:false}});};
Comp.prototype.gbLoad=function(){var self=this;return get('gabarits_hivernage?select=*').then(function(r){self.D.gab=r||[];self.update();});};
Comp.prototype.gbSave=function(desactiver){var self=this,gb=this.state.gb,H=window.SAHiv;if(!gb||gb.busy)return;
  var L=H.gabarits(this.D.gab),old=L.filter(function(x){return x.code===gb.code;})[0],nom=String(gb.nom||'').trim();
  if(!nom){this.flash('Le nom du gabarit est requis');return;}
  var secs=H.deTexte(gb.txt,old&&old.sections);if(!secs.length){this.flash('Le gabarit doit compter au moins une étape');return;}
  var code=gb.code||gbSlug(nom);if(gb.isNew&&L.some(function(x){return x.code===code;}))code=code+'-'+Date.now().toString(36).slice(-3);
  var g={code:code,nom:nom,types:String(gb.types||'').split(/[,;]/).map(function(x){return x.trim();}).filter(Boolean),sections:secs,
    conseils:String(gb.conseils||'').split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean),alerte:String(gb.alerte||'').trim(),ordre:old?old.ordre:L.length+1,actif:!desactiver,updated_at:nowIso()};
  /* Table encore vide : on y met aussi les gabarits par défaut, sinon ils disparaîtraient dès le premier enregistrement */
  var rows=(this.D.gab||[]).length?[g]:H.GABARITS.filter(function(x){return x.code!==code;}).map(function(x){return Object.assign(gbRow(x),{updated_at:g.updated_at});}).concat([g]);
  this.setState({gb:Object.assign({},gb,{busy:true})});
  rest('POST','gabarits_hivernage',rows,'resolution=merge-duplicates,return=minimal').then(function(){auditT(self,old?'MODIFICATION':'CREATION','gabarits_hivernage',code);self.setState({gb:null});
    self.flash(desactiver?'Gabarit désactivé':'Gabarit enregistré — sa-terrain l’utilise pour les nouvelles listes dès sa prochaine synchronisation');return self.gbLoad();})
    .catch(function(e){self.setState({gb:Object.assign({},self.state.gb,{busy:false})});self.flash('Échec — gabarit non enregistré : '+netMsg(e));});};
Comp.prototype.gbVals=function(){var self=this,gb=this.state.gb,D=this.D,H=window.SAHiv;
  var base={gbGo:function(){self.gbOpen('piscine');},gbOpen:false};
  if(!gb||!D)return base;
  var L=H.gabarits(D.gab),set=function(k){return function(e){var o={};o[k]=e.target.value;self.setState({gb:Object.assign({},self.state.gb,o,{confirm:false})});};};
  var secs=H.deTexte(gb.txt),n=0,c=0;secs.forEach(function(s){s.items.forEach(function(it){n++;if(it.crit)c++;});});
  var nb=(D.sites||[]).filter(function(s){return(s.bassins||[]).some(function(b){var g=H.gabaritDe(b,D.gab);return g&&g.code===gb.code;});}).length;
  return Object.assign(base,{gbOpen:true,gbTitle:gb.isNew?'Nouveau gabarit d’hivernage':'Gabarit d’hivernage — '+gb.nom,
    gbClose:function(){self.setState({gb:null});},gbCloseBg:function(e){if(e.target===e.currentTarget)self.setState({gb:null});},
    gbList:L.map(function(g){return{v:g.code,l:g.nom,sel:g.code===gb.code};}).concat(gb.isNew?[{v:'',l:'Nouveau gabarit',sel:true}]:[]),onGbSel:function(e){if(e.target.value)self.gbOpen(e.target.value);},gbNew:function(){self.gbNew();},
    gbNom:{v:gb.nom,on:set('nom')},gbTypes:{v:gb.types,on:set('types')},gbTxt:{v:gb.txt,on:set('txt')},gbConseils:{v:gb.conseils,on:set('conseils')},gbAlerte:{v:gb.alerte,on:set('alerte')},
    gbApercu:secs.length+' section(s), '+n+' case(s), dont '+c+' critique(s)'+(gb.isNew?'':' · utilisé sur '+nb+' site(s)'),
    gbSrc:(D.gab||[]).length?'':'Gabarits par défaut : le premier enregistrement les copie dans la base.',
    gbSave:function(){self.gbSave(false);},gbSaveLbl:gb.busy?'Enregistrement…':'Enregistrer',
    gbCanDel:!gb.isNew&&L.length>1,gbDelLbl:gb.confirm?'Confirmer la désactivation':'Désactiver',
    gbDel:function(){if(!self.state.gb.confirm){self.setState({gb:Object.assign({},self.state.gb,{confirm:true})});return;}self.gbSave(true);}});
};
