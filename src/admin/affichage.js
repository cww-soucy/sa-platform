/* ═════════════ AFFICHAGE DES APPS : ce que chaque profil voit (sa-admin, sa-terrain, portail client) ═════════════
   Catalogue et règles de calcul : src/affichage/affichage.js (window.SAAff). Règles en base : affichage_regles.
   Tout est visible par défaut ; une règle masque (true) ou réaffiche (false) une clé pour un profil.
   Ici : (1) application des règles à sa-admin lui-même (menu, onglets, sections, tuiles d'accueil),
         (2) l'écran de configuration, (3) l'aperçu « voir sa-admin comme ce profil ». */
var AFF_CACHE='sa_admin_affichage';
var AFF_MODS=['monitoring','carte','sites','globale','planmatch','operations','planning','facturation','logistique','stock','flotte','outils','sondages','communication','temps','stats','comptes','affichage'];
var AFF_TABS=[['inspView','fiche.',['bilan','visite','perso','tendances','saisie','bassins','hiver','acces','points'],'bilan'],['pView','planning.',['semaine','mois','gantt','series'],'semaine'],
  ['tempsTab','temps.',['semaine','employe','valider','paie','cumul'],'semaine'],['logTab','log.',['bl','so','ent'],'bl'],['outTab','outils.',['outils','emp','cfg'],'outils']];
/* Modules activés / désactivés (table modules_etat ; catalogue SAAff.MODULES). Désactivé = pour tout le monde,
   administrateurs compris : menu, onglets et tuiles forcés masqués, lien direct refusé, et la base refuse les données du module. */
var MOD_CACHE='sa_admin_modules';
Comp.prototype.modRows=function(){if(!this.modEtat)this.modEtat=jget(MOD_CACHE,[]);return Array.isArray(this.modEtat)?this.modEtat:[];};
Comp.prototype.modSet=function(rows){if(!Array.isArray(rows))return;this.modEtat=rows;this._affE=null;try{localStorage.setItem(MOD_CACHE,JSON.stringify(rows));}catch(e){}};
/* Écran sa-admin (mod) bloqué par un module désactivé ? */
Comp.prototype.modBloque=function(m){var A=window.SAAff;if(!A)return false;var off=A.clesOff(this.modRows(),'admin');
  return!!(off['menu.'+m]||(m==='hivernage'&&off['sites.hiv'])||((m==='inspections'||m==='sites'||m==='hivernage')&&off['menu.sites']));};
Comp.prototype.modBasculer=function(id,actif){var self=this,A=window.SAAff,M=A&&A.MODS[id];if(!M||this._modBusy)return;
  if(this.user.role!=='admin'){this.flash('Réservé aux administrateurs');return;}
  if(!actif&&!confirm('Désactiver « '+M.nom+' » pour tout le monde ?\n\nLe module disparaît de toutes les apps et ses données deviennent inaccessibles jusqu’à sa réactivation. Rien n’est effacé.'))return;
  var row={id:id,actif:!!actif,updated_by:this.user.id,updated_at:new Date().toISOString()};this._modBusy=id;this.update();
  rest('POST','modules_etat',row,'resolution=merge-duplicates,return=minimal').then(function(){
    self._modBusy=null;self.modPret=true;self.modSet(self.modRows().filter(function(r){return r.id!==id;}).concat([row]));
    auditT(self,'MODIFICATION','modules_etat',id,{actif:row.actif});self.flash('« '+M.nom+' » '+(actif?'activé':'désactivé')+' — appliqué à la prochaine ouverture des apps');})
  .catch(function(e){self._modBusy=null;self.update();self.flash('Échec — rien n’a été modifié : '+netMsg(e));});};
Comp.prototype.modVals=function(){var self=this,A=window.SAAff,rows=this.modRows(),off=A.modulesOff(rows),admin=this.user.role==='admin',busy=this._modBusy;
  var APPN={admin:'sa-admin',terrain:'sa-terrain',portail:'portail client'};
  var items=A.MODULES.map(function(m){var on=!off[m.id],r=rows.filter(function(x){return x.id===m.id;})[0];
    var ou=Object.keys(m.cles||{}).map(function(a){return APPN[a];}).join(', ');
    return{id:m.id,nom:m.nom,aide:m.aide,ou:'Dans : '+ou+(m.tables.length?' · données bloquées dans la base':' · écran seulement'),on:on,etat:on?'Activé':'Désactivé',
      eBg:on?'var(--color-accent-700)':'var(--color-accent-900)',rowBg:on?'transparent':'var(--color-accent-100)',
      quand:r&&r.updated_at?'Modifié le '+fdate(String(r.updated_at).slice(0,10))+(r.updated_by?' par '+r.updated_by:''):'',
      peut:admin,lbl:busy===m.id?'Enregistrement…':on?'Désactiver':'Activer',aria:(on?'Désactiver ':'Activer ')+m.nom,
      go:function(){self.modBasculer(m.id,!on);}};});
  var n=Object.keys(off).length;
  return{isModules:true,modSansTable:this.modPret===false,modLecture:!admin,mods:items,modResume:n?n+' module'+(n>1?'s':'')+' désactivé'+(n>1?'s':'')+' sur '+A.MODULES.length:'Tous les modules sont activés'};};
/* Autres réglages : raccourcis vers les réglages qui vivent dans leur module (un module désactivé ou masqué n'y figure pas) */
Comp.prototype.reglagesVals=function(){var self=this,admin=this.user.role==='admin';
  var R=[['comptes','Comptes et accès','Employés, rôles, droits, statut et mots de passe.','users',function(){self.go('comptes');},'menu.comptes'],
    ['entrepot','Entrepôt et courriels de logistique','Adresses de l’entrepôt et courriels envoyés avec les bons de livraison.','send',function(){self.go('logistique',{logTab:'ent'});},'log.ent'],
    ['qr','Outils · QR : configuration','Emplacements, étiquettes et réglages des codes QR.','wrench',function(){self.go('outils',{outTab:'cfg'});},'outils.cfg'],
    ['points','Points de contrôle des inspections','Ce que le technicien vérifie à chaque visite, par type de bassin.','clipboard',function(){self.go('inspections',{inspView:'points'});},'fiche.points'],
    ['portail','Accès des clients au portail','Contacts clients, niveaux d’accès et codes QR des installations.','building',function(){self.go('inspections',{inspView:'acces'});},'fiche.acces'],
    ['sauvegarde','Sauvegarde complète','Télécharger une copie de toutes les données (sans mot de passe ni prix).','download',function(){self.exportAll();},'menu.comptes']];
  var items=R.filter(function(r){return self.affOk(r[5]);}).map(function(r){return{id:r[0],nom:r[1],aide:r[2],ic:r[3],go:r[4]};});
  return{isReglages:true,reglages:items,reglagesVide:items.length?'':'Aucun autre réglage disponible pour ce profil.',reglagesNote:admin?'':'Certains réglages sont réservés aux administrateurs.'};};
Comp.prototype.affRows=function(){if(!this.affRegles)this.affRegles=jget(AFF_CACHE,[]);return Array.isArray(this.affRegles)?this.affRegles:[];};
Comp.prototype.affSet=function(rows){if(!Array.isArray(rows))return;this.affRegles=rows;this._affE=null;try{localStorage.setItem(AFF_CACHE,JSON.stringify(rows));}catch(e){}};
/* Règles + brouillon en cours (pour l'aperçu et le calcul de l'écran de configuration) */
Comp.prototype.affAvecBrouillon=function(){var d=this.state.affDraft,rows=this.affRows();if(!d)return rows;var p=d.key.split('|');
  return rows.filter(function(r){return r.id!==d.key;}).concat([{id:d.key,app:p[0],cible:p.slice(1).join('|'),masques:d.m}]);};
Comp.prototype.affEtat=function(){var A=window.SAAff;if(!A)return null;if(this._affE)return this._affE;var ap=this.state.affApercu;
  var e=ap?A.resoudre(this.affAvecBrouillon(),'admin',ap.qui,null,this.modRows()):A.resoudre(this.affRows(),'admin',{role:this.user.role,compte:this.user.id},null,this.modRows());
  if(ap)delete e.masque['menu.affichage']; /* en aperçu, on garde toujours le chemin du retour */
  return(this._affE=e);};
Comp.prototype.affOk=function(k){var A=window.SAAff;return!A||A.visible(this.affEtat(),k);};
/* Appelé au début de chaque rendu : module ou onglet masqué → premier visible ; règles CSS des sections */
Comp.prototype.affNorm=function(){var self=this,st=this.state,ok=function(k){return self.affOk(k);};this._affE=null;
  var mk=function(m){return m==='inspections'||m==='hivernage'?'sites':m;};
  if(TITLES_OK(st.mod)||st.mod==='affichage'){if(!ok('menu.'+mk(st.mod))){var m=AFF_MODS.filter(function(x){return ok('menu.'+x);})[0]||'monitoring';st.mod=m==='sites'?'inspections':m;}}
  if(st.mod==='inspections'||st.mod==='hivernage'||st.mod==='sites'){var cur=st.mod==='inspections'?'insp':st.mod==='hivernage'?'hiv':(st.sitesTab||'clients');
    if(!ok('sites.'+cur)){var t=['insp','hiv','clients','lieux','rep'].filter(function(x){return ok('sites.'+x);})[0];
      if(t==='insp')st.mod='inspections';else if(t==='hiv')st.mod='hivernage';else if(t){st.mod='sites';st.sitesTab=t;}}}
  AFF_TABS.forEach(function(x){var v=st[x[0]]||x[3];if(x[2].indexOf(v)>=0&&!ok(x[1]+v)){var f=x[2].filter(function(y){return ok(x[1]+y);})[0];if(f)st[x[0]]=f;}});
  if(window.SAAff)window.SAAff.appliquer(document,this.affEtat());};
/* Filtre d'une liste d'onglets [[code,…],…] selon le préfixe de clé */
Comp.prototype.affTabs=function(pre,list){var self=this;return list.filter(function(x){return self.affOk(pre+x[0]);});};
Comp.prototype.affLoad=function(){var self=this;return get('affichage_regles?select=*').then(function(r){self.affPret=true;self.affSet(r);self.update();return r;}).catch(function(){self.affPret=false;return null;});};

/* ---------- Écran de configuration ---------- */
Comp.prototype.affProfils=function(app){var A=window.SAAff,D=this.D,q=norm(this.state.affQ||'');
  if(app==='portail')return[{nom:'Tous les clients',profils:[{cible:'tous',nom:'Tous les clients',qui:{}}]},
    {nom:'Par niveau d’accès',profils:A.NIVEAUX.map(function(n){return{cible:'niveau:'+n[0],nom:n[1],qui:{niveau:n[0]}};})}];
  var RL={};A.ROLES.forEach(function(r){RL[r[0]]=r[1];});
  var cs=(D.comptes||[]).filter(function(c){return D.statut[c.id]!=='inactif';}).sort(function(a,b){return(a.prenom+' '+a.nom).localeCompare(b.prenom+' '+b.nom,'fr');});
  var emp=cs.filter(function(c){return!q||norm(c.prenom+' '+c.nom+' '+c.id).indexOf(q)>=0;}).map(function(c){return{cible:'compte:'+String(c.id).toLowerCase(),nom:((c.prenom||'')+' '+(c.nom||'')).trim()||c.id,sub:({admin:'Administrateur',superviseur:'Superviseur'})[c.role]||'Employé',qui:{role:c.role,compte:c.id}};});
  return[{nom:'Tout le monde',profils:[{cible:'tous',nom:'Tout le monde',qui:{}}]},
    {nom:'Par rôle',profils:A.ROLES.map(function(r){return{cible:'role:'+r[0],nom:r[1],qui:{role:r[0]}};})},
    {nom:'Par employé',cherche:true,profils:emp,vide:emp.length?'':(q?'Aucun employé trouvé.':'Aucun compte actif.')}];};
Comp.prototype.affSave=function(){var self=this,d=this.state.affDraft;if(!d||this._affBusy)return;
  var p=d.key.split('|'),now=new Date().toISOString(),m={};Object.keys(d.m).forEach(function(k){if(typeof d.m[k]==='boolean')m[k]=d.m[k];});
  var row={id:d.key,app:p[0],cible:p.slice(1).join('|'),masques:m,updated_by:this.user.id,updated_at:now};
  this._affBusy=true;this.update();
  rest('POST','affichage_regles',row,'resolution=merge-duplicates,return=minimal').then(function(){
    self._affBusy=false;self.affPret=true;self.affSet(self.affRows().filter(function(r){return r.id!==row.id;}).concat([row]));self.setState({affDraft:null});
    auditT(self,'MODIFICATION','affichage_regles',row.id,{masques:Object.keys(m).length});
    self.flash('Affichage enregistré — appliqué à la prochaine ouverture de '+({admin:'sa-admin',terrain:'sa-terrain',portail:'portail client'})[row.app]);})
  .catch(function(e){self._affBusy=false;self.update();self.flash('Échec — rien n’a été enregistré : '+netMsg(e));});};
Comp.prototype.affVals=function(){var self=this,st=this.state,D=this.D,A=window.SAAff;
  var ap=st.affApercu,base={affApercuOn:!!ap,affApercuTxt:ap?'Aperçu : sa-admin tel que le voit « '+ap.nom+' »'+(st.affDraft?' (avec les changements pas encore enregistrés)':''):'',
    affApercuFin:function(){self.setState({affApercu:null,mod:'affichage'});}};
  if(st.mod!=='affichage'||!D||!A)return Object.assign(base,{isAffichage:false});
  if(this.affPret==null&&!this._affL){this._affL=true;this.affLoad();}
  /* Configuration de la plateforme : Modules (par défaut) · Affichage par app · Autres réglages */
  var vue=st.affApp||'modules',sale=function(){var d=st.affDraft;if(!d)return false;var r=self.affRows().filter(function(x){return x.id===d.key;})[0];return JSON.stringify(d.m)!==JSON.stringify((r&&r.masques)||{});},
    quitter=function(v){return function(){if(sale()&&!confirm('Quitter sans enregistrer les changements ?'))return;self.setState({affApp:v,affDraft:null,affCible:'tous',affQ:''});};};
  var appsTabs=[{nom:'Modules',sous:'Activer ou désactiver des fonctions',on:vue==='modules',n:(function(){var k=Object.keys(A.modulesOff(self.modRows())).length;return k?k+' désactivé'+(k>1?'s':''):'';})(),go:quitter('modules')}]
    .concat(['admin','terrain','portail'].map(function(a){return{nom:'Affichage · '+A.CATALOGUE[a].nom,sous:A.CATALOGUE[a].sous,on:a===vue,n:'',_a:a,go:quitter(a)};}))
    .concat([{nom:'Autres réglages',sous:'Comptes, entrepôt, QR, inspections, sauvegarde',on:vue==='reglages',n:'',go:quitter('reglages')}]);
  if(vue==='modules')return Object.assign(base,{isAffichage:true,af:Object.assign({isAff:false,isReglages:false,sansTable:false,apps:appsTabs},this.modVals())});
  if(vue==='reglages')return Object.assign(base,{isAffichage:true,af:Object.assign({isAff:false,isModules:false,sansTable:false,apps:appsTabs},this.reglagesVals())});
  var app=A.CATALOGUE[st.affApp]?st.affApp:'admin',C=A.CATALOGUE[app],blocs=this.affProfils(app),all=[];blocs.forEach(function(b){all=all.concat(b.profils);});
  var cible=st.affCible&&all.some(function(p){return p.cible===st.affCible;})?st.affCible:'tous',prof=all.filter(function(p){return p.cible===cible;})[0]||all[0];
  if(st.affCible&&cible!==st.affCible&&String(st.affCible).indexOf('compte:')===0){prof={cible:st.affCible,nom:st.affCibleNom||st.affCible.slice(7),qui:st.affCibleQui||{}};cible=st.affCible;} /* employé filtré par la recherche : reste choisi */
  var key=A.idRegle(app,cible),rows=this.affRows(),own=(rows.filter(function(r){return r.id===key;})[0]||{}).masques||{};
  var d=st.affDraft&&st.affDraft.key===key?st.affDraft:{key:key,m:JSON.parse(JSON.stringify(own))};
  var dirty=JSON.stringify(d.m)!==JSON.stringify(own);
  var setM=function(f){var m=JSON.parse(JSON.stringify(d.m));f(m);self.setState({affDraft:{key:key,m:m}});};
  var rowsD=rows.filter(function(r){return r.id!==key;}).concat([{id:key,app:app,cible:cible,masques:d.m}]);
  var modR=this.modRows(),eff=A.resoudre(rowsD,app,prof.qui,null,modR),inh=A.resoudre(rows,app,prof.qui,cible,modR);
  var nomCible=function(c){if(!c)return'';if(c==='tous')return app==='portail'?'Tous les clients':'Tout le monde';var x=all.filter(function(p){return p.cible===c;})[0];return x?x.nom:c.replace(/^[a-z]+:/,'');};
  var gen=A.cibles(app,prof.qui).filter(function(c){return c!==cible;}).map(nomCible);
  var nOwn=function(c){var r=rows.filter(function(x){return x.id===A.idRegle(app,c);})[0];var n=r?Object.keys(r.masques||{}).length:0;if(c===cible)n=Object.keys(d.m).length;return n||'';};
  var nMasq=0,nTot=0;
  var groupes=C.groupes.map(function(g){var gm=0;
    var lignes=g.items.map(function(it){var k=it.cle,mine=d.m[k],masq=!!eff.masque[k],modOff=eff.off&&eff.off[k],lock=A.verrouille(it,prof.qui)||!!modOff,lockTous=it.verrou==='admin'&&!prof.qui.role;nTot++;if(masq){nMasq++;gm++;}
      var parentMasq=masq&&mine!==true&&eff.brut[k]!==true&&it.parent&&eff.masque[it.parent],pIt=it.parent&&A.ITEMS[app][it.parent];
      var src=eff.source[k],note=lock?'':parentMasq?'masqué avec « '+(pIt?pIt.nom:it.parent)+' »':typeof mine==='boolean'?'choix de ce profil':src?'hérité de « '+nomCible(src)+' »':(cible==='tous'?'par défaut':'hérité (par défaut)');
      if(lockTous)note='toujours visible pour les administrateurs';if(modOff)note='module « '+A.MODS[modOff].nom+' » désactivé (onglet Modules)';
      var choix=[['h',cible==='tous'?'Par défaut':'Hériter',mine===undefined],['v','Afficher',mine===false],['m','Masquer',mine===true]].map(function(x){
        return{l:x[1],on:x[2],bg:x[2]?(x[0]==='m'?'var(--color-accent-900)':x[0]==='v'?'var(--color-accent-700)':'var(--color-accent-100)'):'transparent',fg:x[2]&&x[0]!=='h'?'#ffffff':'var(--color-text)',
          go:function(){setM(function(m){if(x[0]==='h')delete m[k];else m[k]=x[0]==='m';});}};});
      return{cle:k,nom:it.nom,sec:it.sec||'',etat:modOff?'Désactivé':lock?'Toujours visible':masq?'Masqué':'Visible',note:note,eIc:masq?'x':'eye',eBg:masq?'var(--color-accent-900)':'transparent',eFg:masq?'#ffffff':'var(--color-text)',
        op:parentMasq?0.6:1,rowBg:masq?'var(--color-accent-100)':'transparent',lock:lock,libre:!lock,lockTxt:modOff?'Module désactivé':it.verrou===true?'Toujours visible':'Toujours visible pour un administrateur',aria:it.nom+' — '+(masq?'masqué':'visible'),b:choix};});
    var cles=g.items.filter(function(it){return!A.verrouille(it,prof.qui)&&!(eff.off&&eff.off[it.cle]);}).map(function(it){return it.cle;});
    return{nom:g.nom,aide:g.aide,rows:lignes,compte:gm?gm+' masqué'+(gm>1?'s':'')+' sur '+g.items.length:'Tout visible',
      tousVis:function(){setM(function(m){cles.forEach(function(k){if(cible==='tous')delete m[k];else m[k]=false;});});},
      tousMasq:function(){setM(function(m){cles.forEach(function(k){if(!(A.ITEMS[app][k].verrou==='admin'&&!prof.qui.role))m[k]=true;});});}};});
  var nApp=function(a){var n=0;rows.forEach(function(r){if(r.app===a)Object.keys(r.masques||{}).forEach(function(k){if(r.masques[k]===true)n++;});});return n?n+' masquage'+(n>1?'s':''):'';};
  var busy=!!this._affBusy;
  appsTabs.forEach(function(t){if(t._a)t.n=nApp(t._a);});
  return Object.assign(base,{isAffichage:true,af:{isAff:true,isModules:false,isReglages:false,sansTable:this.affPret===false,q:st.affQ||'',onQ:function(e){self.setState({affQ:e.target.value});},
    apps:appsTabs,
    blocs:blocs.map(function(b){return{nom:b.nom,cherche:!!b.cherche,vide:b.vide||'',profils:b.profils.map(function(p){var on=p.cible===cible;
      return{nom:p.nom,sub:p.sub||'',on:on,n:nOwn(p.cible),go:function(){if(on)return;if(dirty&&!confirm('Quitter ce profil sans enregistrer les changements ?'))return;self.setState({affCible:p.cible,affCibleNom:p.nom,affCibleQui:p.qui,affDraft:null});}};})};}),
    titre:C.nom+' · '+prof.nom,herite:gen.length?'Hérite de : '+gen.join(' → ')+'.':'Profil de base : ce qui est choisi ici vaut pour tout le monde, sauf choix plus précis.',
    resume:nMasq?nMasq+' élément'+(nMasq>1?'s':'')+' masqué'+(nMasq>1?'s':'')+' sur '+nTot+' pour ce profil'+(dirty?' · changements non enregistrés':''):'Tout est visible pour ce profil'+(dirty?' · changements non enregistrés':''),
    dirty:dirty,saveOff:!dirty||busy,saveOp:dirty&&!busy?1:0.5,saveLbl:busy?'Enregistrement…':dirty?'Enregistrer':'Enregistré',
    save:function(){if(dirty)self.affSave();},annuler:function(){self.setState({affDraft:null});},
    toutAfficher:function(){setM(function(m){Object.keys(m).forEach(function(k){delete m[k];});});},
    peutApercu:app==='admin',apercu:function(){self.setState({affApercu:{nom:prof.nom,qui:prof.qui},affDraft:d,mod:'monitoring'});self.flash('Aperçu de sa-admin pour « '+prof.nom+' »');},
    groupes:groupes}});};
