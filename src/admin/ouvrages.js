/* ---------- sa-admin › Inspection et hivernage par ouvrage, gabarits d'hivernage ----------
   Inséré dans app.js par assemble.py (même portée : get, rest, Comp, norm, nowIso, auditT…).
   Fiche du site › bassin › « Inspection et hivernage » : gabarit d'hivernage (bassin.hiv.gabarit, enregistré avec la fiche), points et étapes
   retirés ou ajoutés (table ouvrage_ajustements, la même que sa-terrain : le technicien ajuste sur place, le bureau voit et annule ici),
   points d'inspection propres à l'ouvrage (inspection_points.bassin_id).
   Hivernage › « Gabarits d'hivernage » : étapes de chaque gabarit (table gabarits_hivernage ; src/hivernage/checklist.js tant qu'elle est vide).
   Base : docs/sql/MIGRATION_2026-10-22_gabarits_ouvrages.sql. */
var OUV_TYPE='_ouvrage';   /* type_code des points propres à un ouvrage : jamais pris pour un type de bassin, même par une ancienne version */
function ouvId(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);}
function fdAdj(r){return(r.par_nom||'')+(r.cree_le?' le '+fdate(String(r.cree_le).slice(0,10)):'');}

Comp.prototype.ocMut=function(fn){var i=this.state.oc.i;this.sfMut(function(x){var b=x.bassins[i];if(b)fn(b);});};
Comp.prototype.adjDe=function(sid){return(this.D.adj||[]).filter(function(r){return String(r.site_id)===String(sid)&&r.actif!==false;});};
/* Bassin (ou site sans bassin) avec ses ajustements, pour l'inspection et l'hivernage */
Comp.prototype.ouvInsp=function(site,b){var a=this.adjDe(site.id);if(b)return window.SAHiv.avecAjustements([b],a)[0];
  return{id:'site:'+site.id,insp:{exclus:a.filter(function(r){return!r.bassin_id&&r.domaine==='insp'&&r.action==='exclure';}).map(function(r){return r.ref;})}};};
Comp.prototype.adjLoad=function(){var self=this;return get('ouvrage_ajustements?select=*&actif=eq.true').then(function(r){self.D.adj=r||[];self.update();});};
Comp.prototype.adjAdd=function(row){var self=this,u=this.user;row=Object.assign({id:ouvId('adj'),actif:true,par:u.id,par_nom:(u.prenom+' '+u.nom).trim(),cree_le:nowIso()},row);
  return rest('POST','ouvrage_ajustements',row,'return=minimal').then(function(){auditT(self,'CREATION','ouvrage_ajustements',row.id);return self.adjLoad();}).catch(function(e){self.flash('Échec — rien n’a été modifié : '+netMsg(e));});};
Comp.prototype.adjDel=function(ids){var self=this,u=this.user;return Promise.all(ids.map(function(id){return rest('PATCH','ouvrage_ajustements?id=eq.'+encodeURIComponent(id),{actif:false,annule_par:u.id,annule_par_nom:(u.prenom+' '+u.nom).trim(),annule_le:nowIso()},'return=minimal');}))
  .then(function(){ids.forEach(function(id){auditT(self,'SUPPRESSION','ouvrage_ajustements',id);});return self.adjLoad();}).catch(function(e){self.flash('Échec — rien n’a été modifié : '+netMsg(e));});};
Comp.prototype.ocSet=function(o){this.setState({oc:Object.assign({},this.state.oc,o)});};
Comp.prototype.ocVals=function(){var self=this,st=this.state,sf=st.sf,oc=st.oc,D=this.D,I=window.SAInsp,H=window.SAHiv;
  if(!oc||!D||!sf||!sf.f||!sf.f.bassins||!sf.f.bassins[oc.i])return{ocOpen:false};
  var b=sf.f.bassins[oc.i],bid=String(b.id||''),code=b.type_code&&D.types[b.type_code]?b.type_code:(sf.type_code||'GEN'),T=D.types[code]||{label:code,checks:[]};
  var close=function(){self.setState({oc:null});},sid=sf.id,adj=sid?this.adjDe(sid):[];
  var mien=function(dom,act){return adj.filter(function(r){return r.domaine===dom&&r.action===act&&(!r.bassin_id||String(r.bassin_id)===bid);});};
  var exI=mien('insp','exclure'),exH=mien('hiv','exclure'),aj=mien('hiv','ajouter').filter(function(r){return r.bassin_id;});
  /* Case cochée = demandée à ce site ; décocher crée un retrait (comme « Ne s'applique pas ici » sur le terrain), recocher l'annule */
  var basc=function(dom,ref,rows){if(!sid){self.flash('Enregistrez d’abord la fiche du site');return;}var r=rows.filter(function(x){return x.ref===ref;});
    if(r.length)self.adjDel(r.map(function(x){return x.id;}));else self.adjAdd({site_id:String(sid),bassin_id:bid,domaine:dom,action:'exclure',ref:ref});};
  /* Inspection */
  var pts=I.pointsDuType(code,D.cat||[],T.checks||[]),pr=I.propres(D.cat||[],bid);
  var sysOpts=I.SYSTEMES.filter(function(s){return s.code!=='eau';});
  /* Hivernage */
  var L=H.gabarits(D.gab),cfg=b.hiv||{},g=H.gabaritDe(b,D.gab),auto=H.gabaritDe(Object.assign({},b,{hiv:null}),D.gab);
  var gsel=cfg.gabarit||'';
  var corps=g?(g.sections||[]).filter(function(s){return!s.commun;}):[];
  return{ocOpen:true,ocTitle:(b.nom||'Bassin')+' — inspection et hivernage',ocClose:close,ocCloseBg:function(e){if(e.target===e.currentTarget)close();},
    ocInspTxt:'Points du type « '+(T.label||code)+' » (décocher ceux qui ne s’appliquent pas à cet ouvrage)',
    ocPts:pts.map(function(p){var r=exI.filter(function(x){return x.ref===p.id;})[0];return{l:p.libelle,sys:r?'Retiré par '+fdAdj(r):(I.NOM[p.systeme_code]||''),on:!r,fw:'400',go:function(){basc('insp',p.id,exI);}};}),
    ocNoPts:!pts.length,
    ocPropres:pr.map(function(p){return{l:p.libelle,sys:I.NOM[p.systeme_code]||'',del:function(){self.savePoint(Object.assign({},p,{actif:false})).then(function(){self.flash('Point retiré de cet ouvrage');});}};}),
    ocNoPropre:!pr.length,
    ocPt:{v:oc.pt||'',on:function(e){self.ocSet({pt:e.target.value});}},
    ocSys:sysOpts.map(function(s){return{v:s.code,l:s.nom,sel:s.code===(oc.sys||'structure')};}),onOcSys:function(e){self.ocSet({sys:e.target.value});},
    ocAddPt:function(){var l=String(self.state.oc.pt||'').trim();if(!l)return;var sy=self.state.oc.sys||I.systemeDe(l);
      self.savePoint({id:ouvId('ouv-'),systeme_code:sy,type_code:OUV_TYPE,bassin_id:bid,site_id:sf.id||null,libelle:l,mode:sy==='securite'?'ouinon':'etat',obligatoire:false,ordre:100+pr.length,actif:true})
        .then(function(){self.ocSet({pt:''});});},
    ocGabs:[{v:'',l:'Automatique'+(auto?' ('+auto.nom+')':''),sel:!gsel}].concat(L.map(function(x){return{v:x.code,l:x.nom,sel:gsel===x.code};}),[{v:'aucun',l:'Aucun hivernage',sel:gsel==='aucun'}]),
    onOcGab:function(e){var v=e.target.value;self.ocMut(function(x){x.hiv=Object.assign({},x.hiv,{gabarit:v||undefined});if(!v)delete x.hiv.gabarit;});},
    ocHasGab:!!g,ocGabTxt:g?'Étapes du gabarit « '+g.nom+' » (décocher celles qui ne s’appliquent pas)':'Pas d’hivernement pour cet ouvrage.',
    ocSecs:g?(g.sections||[]).map(function(s){return{titre:s.titre+(s.commun?' (commune au site)':''),items:s.items.map(function(it,j){var ref=g.code+':'+s.id+'-'+window.SAHiv.iid(it,j),r=exH.filter(function(x){return x.ref===ref;})[0];
      return{l:(it.n&&it.n!=='—'?it.n+'. ':'')+it.t+(it.b?' '+it.b:''),sys:r?'Retirée par '+fdAdj(r):'',fw:it.crit?'700':'400',on:!r,go:function(){basc('hiv',ref,exH);}};})};}):[],
    ocAjouts:aj.map(function(a){var sec=corps.filter(function(s){return s.id===a.section;})[0];return{l:a.texte+(a.crit?' (critique)':''),sec:(sec?sec.titre+' · ':'')+'ajoutée par '+fdAdj(a),del:function(){self.adjDel([a.id]);}};}),
    ocNoAjout:!aj.length,
    ocEt:{v:oc.et||'',on:function(e){self.ocSet({et:e.target.value});}},
    ocEtSecs:corps.map(function(s,i){return{v:s.id,l:s.titre,sel:(oc.sec||(corps[corps.length-1]||{}).id)===s.id};}),onOcEtSec:function(e){self.ocSet({sec:e.target.value});},
    ocCrit:!!oc.crit,onOcCrit:function(e){self.ocSet({crit:e.target.checked});},
    ocAddEt:function(){var o=self.state.oc,t=String(o.et||'').trim();if(!t)return;if(!sid){self.flash('Enregistrez d’abord la fiche du site');return;}var sec=o.sec||(corps[corps.length-1]||{}).id||'';
      self.adjAdd({site_id:String(sid),bassin_id:bid,domaine:'hiv',action:'ajouter',section:sec,texte:t,crit:!!o.crit}).then(function(){self.ocSet({et:'',crit:false});});},
    ocNote:'Chaque changement est enregistré tout de suite et vaut aussi pour sa-terrain. Les techniciens peuvent faire les mêmes ajustements sur place ; ils apparaissent ici avec leur nom. Le gabarit choisi est enregistré avec la fiche du site.'};
};

/* ---------- Gabarits d'hivernage ---------- */
function gbSlug(s){return norm(s).replace(/[^a-z0-9]+/g,'').slice(0,24)||'gabarit';}
function gbRow(g){return{code:g.code,nom:g.nom,types:g.types||[],sections:g.sections,conseils:g.conseils||[],alerte:g.alerte||'',ordre:g.ordre||0,actif:g.actif!==false};}
/* L'éditeur travaille sur une copie des sections : chaque case garde son identifiant (sa position d'origine pour les gabarits existants),
   donc déplacer ou supprimer une étape ne décale pas les retraits faits sur les sites. */
function gbCopie(secs){return(secs||[]).map(function(s){return Object.assign({},s,{items:(s.items||[]).map(function(it,j){var x=Object.assign({},it,{id:window.SAHiv.iid(it,j)});x.choixTxt=(it.choix||[]).join(', ');return x;})});});}
function gbNid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);}
Comp.prototype.gbOpen=function(code){var H=window.SAHiv,L=H.gabarits(this.D.gab),g=L.filter(function(x){return x.code===code;})[0]||L[0];
  this.setState({gb:{code:g.code,nom:g.nom,types:(g.types||[]).join(', '),secs:gbCopie(g.sections),conseils:(g.conseils||[]).join('\n'),alerte:g.alerte||'',isNew:false,busy:false,confirm:false}});};
Comp.prototype.gbNew=function(){this.setState({gb:{code:'',nom:'',types:'',secs:[{id:'secu',titre:'Sécurité et préparation',col:'Vérification',commun:true,items:[{id:gbNid('e'),t:''}]},
  {id:'p1',titre:'Phase 1 — ',col:'Tâche',num:true,items:[{id:gbNid('e'),n:'1',t:''}]},{id:'form',titre:'Formation des employés',col:'Sujet de formation',commun:true,items:[{id:gbNid('e'),t:''}]}],
  conseils:'',alerte:window.SAHiv.GABARITS[0].alerte,isNew:true,busy:false,confirm:false}});};
/* Modification d'une copie des sections du gabarit en cours */
Comp.prototype.gbMut=function(fn){var gb=this.state.gb;if(!gb)return;var secs=gb.secs.map(function(x){return Object.assign({},x,{items:x.items.map(function(it){return Object.assign({},it);})});});fn(secs);this.setState({gb:Object.assign({},gb,{secs:secs,confirm:false})});};
/* Sections prêtes à enregistrer : étapes vides retirées, choix « Oui, Non, N/A » en liste */
function gbPropre(secs){var vu={};return(secs||[]).map(function(s){
    var items=s.items.filter(function(it){return String(it.t||'').trim();}).map(function(it){var x={id:it.id,t:String(it.t).trim()};if(String(it.n||'').trim())x.n=String(it.n).trim();if(String(it.b||'').trim())x.b=String(it.b).trim();
      if(it.crit)x.crit=true;if(it.g===2)x.g=2;var ch=String(it.choixTxt||'').split(/[,;\/]/).map(function(c){return c.trim();}).filter(Boolean);if(it.isChoix!==false&&ch.length>1)x.choix=ch;return x;});
    var id=s.id&&!vu[s.id]?s.id:'';if(!id){var k=1;while(vu['p'+k]||(secs||[]).some(function(o){return o!==s&&o.id==='p'+k;}))k++;id='p'+k;}vu[id]=1;
    var o={id:id,titre:String(s.titre||'').trim()||'Section',col:s.col||(s.commun?'Vérification':'Tâche')};if(s.col2)o.col2=s.col2;if(s.commun)o.commun=true;if(items.some(function(it){return it.n;}))o.num=true;o.items=items;return o;})
  .filter(function(s){return s.items.length;});}
Comp.prototype.gbLoad=function(){var self=this;return get('gabarits_hivernage?select=*').then(function(r){self.D.gab=r||[];self.update();});};
Comp.prototype.gbSave=function(desactiver){var self=this,gb=this.state.gb,H=window.SAHiv;if(!gb||gb.busy)return;
  var L=H.gabarits(this.D.gab),old=L.filter(function(x){return x.code===gb.code;})[0],nom=String(gb.nom||'').trim();
  if(!nom){this.flash('Le nom du gabarit est requis');return;}
  var secs=gbPropre(gb.secs);if(!secs.length){this.flash('Le gabarit doit compter au moins une étape');return;}
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
  var secs=gbPropre(gb.secs),n=0,c=0,q=0;secs.forEach(function(s){s.items.forEach(function(it){n++;if(it.crit)c++;if(it.choix)q++;});});
  var nb=(D.sites||[]).filter(function(s){return(s.bassins||[]).some(function(b){var g=H.gabaritDe(b,D.gab);return g&&g.code===gb.code;});}).length;
  var NS=gb.secs.length,move=function(arr,i,d){var x=arr[i];arr.splice(i,1);arr.splice(i+d,0,x);};
  var gbSecs=gb.secs.map(function(s,si){var mut=function(fn){return function(e){var v=e&&e.target?(e.target.type==='checkbox'?e.target.checked:e.target.value):null;self.gbMut(function(S){fn(S[si],v,S);});};};
    var NI=s.items.length;
    return{no:si+2,titre:{v:s.titre,on:mut(function(x,v){x.titre=v;})},commun:!!s.commun,onCommun:mut(function(x,v){x.commun=!!v;}),
      up:mut(function(x,v,S){move(S,si,-1);}),down:mut(function(x,v,S){move(S,si,1);}),canUp:si>0,canDown:si<NS-1,
      delLbl:s._del?'Confirmer : supprimer la section':'Supprimer la section',del:mut(function(x,v,S){if(!x._del){x._del=true;return;}S.splice(si,1);}),
      addItem:mut(function(x){var num=x.num||x.items.some(function(it){return it.n;});x.items.push({id:gbNid('e'),n:num?String(x.items.length+1):'',t:''});}),
      hasPiece:!!s.col2,ariaSec:'Section '+(si+2),
      items:s.items.map(function(it,ii){var m=function(fn){return mut(function(x,v,S){fn(x.items[ii],v,x);});},isC=it.isChoix!=null?!!it.isChoix:!!(it.choix&&it.choix.length>1);
        return{lbl:'Étape '+(ii+1)+' de la section '+(si+2),n:{v:it.n||'',on:m(function(y,v){y.n=v;})},t:{v:it.t||'',on:m(function(y,v){y.t=v;})},b:{v:it.b||'',on:m(function(y,v){y.b=v;})},
          crit:!!it.crit,onCrit:m(function(y,v){y.crit=!!v;}),piece:it.g===2,onPiece:m(function(y,v){if(v)y.g=2;else delete y.g;}),
          types:[{v:'case',l:'Case à cocher',sel:!isC},{v:'choix',l:'Choix multiple',sel:isC}],onType:m(function(y,v){y.isChoix=v==='choix';if(y.isChoix&&!String(y.choixTxt||'').trim())y.choixTxt='Oui, Non, N/A';}),
          isChoix:isC,choix:{v:it.choixTxt||'',on:m(function(y,v){y.choixTxt=v;})},
          up:m(function(y,v,x){move(x.items,ii,-1);}),down:m(function(y,v,x){move(x.items,ii,1);}),canUp:ii>0,canDown:ii<NI-1,del:m(function(y,v,x){x.items.splice(ii,1);})};})};});
  return Object.assign(base,{gbOpen:true,gbTitle:gb.isNew?'Nouveau gabarit d’hivernage':'Gabarit d’hivernage — '+gb.nom,
    gbClose:function(){self.setState({gb:null});},gbCloseBg:function(e){if(e.target===e.currentTarget)self.setState({gb:null});},
    gbList:L.map(function(g){return{v:g.code,l:g.nom,sel:g.code===gb.code};}).concat(gb.isNew?[{v:'',l:'Nouveau gabarit',sel:true}]:[]),onGbSel:function(e){if(e.target.value)self.gbOpen(e.target.value);},gbNew:function(){self.gbNew();},
    gbNom:{v:gb.nom,on:set('nom')},gbTypes:{v:gb.types,on:set('types')},gbConseils:{v:gb.conseils,on:set('conseils')},gbAlerte:{v:gb.alerte,on:set('alerte')},
    gbSecs:gbSecs,gbAddSec:function(){self.gbMut(function(S){var fin=S.filter(function(x){return x.commun;}).length&&S[S.length-1].commun?S.length-1:S.length;S.splice(fin,0,{id:'',titre:'Nouvelle section',col:'Tâche',items:[{id:gbNid('e'),n:'',t:''}]});});},
    gbApercu:secs.length+' section(s), '+n+' étape(s), dont '+c+' critique(s) et '+q+' à choix multiple'+(gb.isNew?'':' · utilisé sur '+nb+' site(s)'),
    gbSrc:(D.gab||[]).length?'':'Gabarits par défaut : le premier enregistrement les copie dans la base.',
    gbSave:function(){self.gbSave(false);},gbSaveLbl:gb.busy?'Enregistrement…':'Enregistrer',
    gbCanDel:!gb.isNew&&L.length>1,gbDelLbl:gb.confirm?'Confirmer la désactivation':'Désactiver',
    gbDel:function(){if(!self.state.gb.confirm){self.setState({gb:Object.assign({},self.state.gb,{confirm:true})});return;}self.gbSave(true);}});
};
