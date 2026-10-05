/* ---------- sa-admin › Sites & Clients : un client regroupe plusieurs sites ; un site garde ses bassins et installations ----------
   Inséré dans app.js par assemble.py (même portée : get, rest, rpc, Comp, fdate, iso, norm, auditT…).
   Base : tables clients, lieux_alias, sites_fusions et fonctions site_fusionner / lieu_classer (docs/sql/MIGRATION_2026-10-05_clients_sites.sql). */
var CL_TABS=[['clients','Clients'],['lieux','Lieux à classer'],['rep','Répertoire']];
function lieuKey(s){return String(s||'').trim().toLowerCase();}
var CL_VIDES=/^(ccnq|ville|de|des|du|la|le|les|l|d|piscine|residence|complexe|locatif|groupe|quai|place|station|et|a|au)$/;
function clMots(s){return norm(s).split(' ').filter(function(w){return w.length>1&&!CL_VIDES.test(w);});}

/* Site conservé d'un identifiant : suit les fusions (« Fusionné → Nom [id] ») */
Comp.prototype.siteCanon=function(id){var D=this.D,s=D&&D.byId[String(id)],n=0;
  while(s&&s.merged&&n++<5){var m=/\[([^\]]+)\]/.exec(s.notes);if(!m||!D.byId[m[1]])break;s=D.byId[m[1]];}return s||null;};
/* Site d'un punch : identifiant (suivi des fusions), sinon lieu déjà classé, sinon nom identique */
Comp.prototype.siteOfTask=function(t){var D=this.D;if(!D||!t)return null;
  var s=t.siteId?this.siteCanon(t.siteId):null;if(s)return s;
  var a=D.alias&&D.alias[lieuKey(t.lieu)];if(a){s=this.siteCanon(a);if(s)return s;}
  var k=norm(t.lieu);if(!k)return null;return D.sites.filter(function(x){return norm(x.nom)===k;})[0]||null;};

/* Tous les punchs (lecture à la demande, pour « Lieux à classer » et le nombre de punchs par site) */
Comp.prototype.clLoadFt=function(force){var self=this;if(this._clFt&&!force)return;this._clFt=1;
  get('feuilles_temps?select=uid,week,days').then(function(rows){self.clFt=rows||[];self.update();}).catch(function(e){self._clFt=0;self.flash('Lecture des punchs impossible : '+netMsg(e));});};
Comp.prototype.clStats=function(){var self=this,parSite={},lieux={};
  (this.clFt||[]).forEach(function(f){(f.days||[]).forEach(function(d,i){((d&&d.tasks)||[]).forEach(function(t){
    var s=self.siteOfTask(t);if(s){parSite[s.id]=(parSite[s.id]||0)+1;return;}
    var k=norm(t.lieu);if(!k)return;var date=iso(addDays(new Date(f.week+'T12:00:00'),i)),L=lieux[k]||(lieux[k]={k:k,brut:{},n:0,last:''});
    L.brut[String(t.lieu)]=(L.brut[String(t.lieu)]||0)+1;L.n++;if(date>L.last)L.last=date;});});});
  return{parSite:parSite,lieux:Object.keys(lieux).map(function(k){return lieux[k];}).sort(function(a,b){return b.n-a.n;})};};
/* Site le plus probable pour un lieu saisi à la main : mots en commun avec le nom du site et de son client */
Comp.prototype.clSuggest=function(lieu){var D=this.D,cn={},m=clMots(lieu),k=norm(lieu),best=null,bs=0;(D.clients||[]).forEach(function(c){cn[c.id]=c.nom;});
  if(!m.length&&!k)return null;
  D.sites.forEach(function(s){var nom=norm(s.nom),cli=norm(cn[s.client_id]||''),sm=clMots(s.nom+' '+(cn[s.client_id]||'')),sc=0;
    m.forEach(function(w){if(sm.indexOf(w)>=0)sc+=2;else if(sm.some(function(x){return x.length>3&&(x.indexOf(w)===0||w.indexOf(x)===0);}))sc+=1;});
    if(k&&(nom.indexOf(k)>=0||k.indexOf(nom)>=0))sc+=1;if(k&&cli&&k.indexOf(cli)>=0)sc+=0.5;
    if(s.interne&&/\b(entrepot|bureau|shop|garage)\b/.test(k)&&nom.indexOf(k.split(' ')[0])>=0)sc+=3;
    if(sc>bs){bs=sc;best=s;}});
  return bs>=2?best:null;};

Comp.prototype.clSetClient=function(siteId,clientId){var self=this,s=this.D.byId[siteId];
  rest('PATCH','sites?id=eq.'+encodeURIComponent(siteId),{client_id:clientId||null,updated_at:nowIso()})
   .then(function(){s.client_id=clientId||null;auditT(self,'MODIFICATION','sites',siteId,{client_id:clientId||null});var c=self.clientById(clientId);self.flash(c?'« '+s.nom+' » rattaché à '+c.nom:'« '+s.nom+' » n’a plus de client');self.update();})
   .catch(function(e){self.flash('Échec — rien n’a été modifié : '+netMsg(e));});};
Comp.prototype.clientById=function(id){return(this.D.clients||[]).filter(function(c){return c.id===id;})[0]||null;};
Comp.prototype.clSaveClient=function(){var self=this,e=this.state.cle;if(!e||e.busy)return;var nom=String(e.nom||'').trim();
  if(!nom){this.flash('Le nom du client ne peut pas être vide');return;}
  if((this.D.clients||[]).some(function(c){return c.id!==e.id&&norm(c.nom)===norm(nom);})){this.flash('Un client porte déjà ce nom');return;}
  var id=e.id||('cl-'+norm(nom).replace(/ /g,'-').slice(0,40)+'-'+Date.now().toString(36).slice(-4)),body={nom:nom,interne:!!e.interne,updated_at:nowIso()};
  this.setState({cle:Object.assign({},e,{busy:true})});
  (e.id?rest('PATCH','clients?id=eq.'+encodeURIComponent(id),body):rest('POST','clients',Object.assign({id:id},body)))
   .then(function(){auditT(self,e.id?'MODIFICATION':'CREATION','clients',id);var site=e.siteId;self.setState({cle:null});self.flash(e.id?'Client enregistré':'Client « '+nom+' » créé');
     return self.reloadAll().then(function(){if(site)self.clSetClient(site,id);});})
   .catch(function(err){self.setState({cle:Object.assign({},e,{busy:false})});self.flash('Échec — rien n’a été modifié : '+netMsg(err));});};
/* Fusion : la base déplace toutes les données liées en une seule opération (site_fusionner) */
Comp.prototype.clFusionner=function(){var self=this,m=this.state.clm;if(!m||m.busy)return;var s=this.D.byId[m.src],d=this.D.byId[m.dst];
  this.setState({clm:Object.assign({},m,{busy:true})});
  rpc('site_fusionner',{p_src:m.src,p_dst:m.dst,p_par:this.user.id,p_installation:m.garde&&!(s.bassins||[]).length?String(m.inst||'').trim()||null:null})
   .then(function(){auditT(self,'FUSION','sites',m.src,{dans:m.dst});self.setState({clm:null});self.flash('« '+s.nom+' » fusionné dans « '+d.nom+' » — tout l’historique a suivi');self._clFt=0;return self.reloadAll();})
   .catch(function(e){self.setState({clm:Object.assign({},m,{busy:false})});self.flash('Échec — rien n’a été fusionné : '+netMsg(e));});};
Comp.prototype.clClasser=function(L,siteId){var self=this,s=this.D.byId[siteId];if(!s)return;
  rpc('lieu_classer',{p_lieux:Object.keys(L.brut),p_site:siteId,p_par:this.user.id})
   .then(function(n){auditT(self,'CLASSEMENT','lieux_alias',L.k,{site:siteId});Object.keys(L.brut).forEach(function(b){self.D.alias[lieuKey(b)]=siteId;});
     self.flash('« '+Object.keys(L.brut)[0]+' » classé dans « '+s.nom+' » ('+L.n+' punch'+(L.n>1?'s':'')+')');var ls=Object.assign({},self.state.lieuSel);delete ls[L.k];self.setState({lieuSel:ls});})
   .catch(function(e){self.flash('Échec — rien n’a été classé : '+netMsg(e));});};

Comp.prototype.clientsVals=function(){var self=this,st=this.state,D=this.D;
  var off={sitesTabs:[],isClTab:false,isLxTab:false,sitesRepDisp:'flex',cl:{}};
  if(!D||st.mod!=='sites')return off;
  var tab=st.sitesTab||'clients',noDb=!D.hasClients;
  if(tab!=='rep'&&!noDb)this.clLoadFt();
  var S=this.clStats(),clients=(D.clients||[]).slice().sort(function(a,b){return(a.interne-b.interne)||a.nom.localeCompare(b.nom,'fr');});
  var nLieux=S.lieux.length;
  var tabs=CL_TABS.map(function(t){var on=t[0]===tab;return{label:t[1]+(t[0]==='lieux'&&self.clFt&&nLieux?' ('+nLieux+')':''),on:on,bd:on?'var(--color-text)':'transparent',go:function(){self.setState({sitesTab:t[0]});}};});
  var cl={noDb:noDb&&tab!=='rep',q:st.clQ||'',onQ:function(e){self.setState({clQ:e.target.value});},nouveau:function(){self.setState({cle:{id:null,nom:'',interne:false}});},
    close:function(){self.setState({cle:null,clm:null});},closeBg:function(e){if(e.target===e.currentTarget)self.setState({cle:null,clm:null});}};
  if(tab==='clients'&&!noDb){var q=norm(st.clQ||''),cOpts=function(cur){return[{v:'',l:'— Aucun client —',sel:!cur}].concat(clients.map(function(c){return{v:c.id,l:c.nom+(c.interne?' (interne)':''),sel:c.id===cur};})).concat([{v:'__new',l:'+ Nouveau client…',sel:false}]);};
    var row=function(s){var others=D.sites.filter(function(x){return x.id!==s.id;});
      return{nom:s.nom,addr:s.addr||'sans adresse',inst:(s.bassins||[]).map(function(b){return b.nom;}).filter(Boolean).join(' · ')||'—',n:self.clFt?(S.parSite[s.id]||0):'…',go:function(){self.openSiteFiche(s.id);},
        clientOpts:cOpts(s.client_id),onClient:function(e){var v=e.target.value;if(v==='__new'){e.target.value=s.client_id||'';self.setState({cle:{id:null,nom:'',interne:false,siteId:s.id}});return;}self.clSetClient(s.id,v);},
        mergeOpts:[{v:'',l:'—',sel:true}].concat(others.map(function(x){return{v:x.id,l:x.nom,sel:false};})),
        onMerge:function(e){var v=e.target.value;e.target.value='';if(!v)return;var d=D.byId[v],rest_=norm(s.nom).replace(norm(d.nom),'').trim();
          self.setState({clm:{src:s.id,dst:v,garde:!(s.bassins||[]).length&&!!rest_,inst:rest_?s.nom.split(/\s+-\s+/).pop():''}});}};};
    var match=function(s,c){return!q||norm(s.nom+' '+s.addr+' '+(c?c.nom:'')).indexOf(q)>=0;};
    var groupes=clients.map(function(c){var ss=D.sites.filter(function(s){return s.client_id===c.id&&match(s,c);});
      return{nom:c.nom,interne:!!c.interne,sous:ss.length+' site'+(ss.length>1?'s':''),vide:!ss.length,sites:ss.map(row),_ok:!q||ss.length||norm(c.nom).indexOf(q)>=0,
        edit:function(){self.setState({cle:{id:c.id,nom:c.nom,interne:!!c.interne}});}};}).filter(function(g){return g._ok;});
    var sans=D.sites.filter(function(s){return!self.clientById(s.client_id)&&match(s,null);});
    if(sans.length)groupes.push({nom:'Sites sans client',interne:false,sous:sans.length+' à rattacher',vide:false,sites:sans.map(row),edit:null});
    cl.groupes=groupes;cl.resume=clients.length+' client'+(clients.length>1?'s':'')+' · '+D.sites.length+' sites · '+D.sites.filter(function(s){return!self.clientById(s.client_id);}).length+' sans client';}
  if(tab==='lieux'&&!noDb){var sel=st.lieuSel||{},sOpts=D.sites.slice().sort(function(a,b){var ca=(self.clientById(a.client_id)||{}).nom||'~',cb=(self.clientById(b.client_id)||{}).nom||'~';return ca.localeCompare(cb,'fr')||a.nom.localeCompare(b.nom,'fr');});
    cl.lxLoading=!this.clFt;cl.lxVide=!!this.clFt&&!nLieux;
    cl.lieux=S.lieux.slice(0,150).map(function(L){var sg=self.clSuggest(Object.keys(L.brut)[0]),v=sel[L.k]!=null?sel[L.k]:(sg?sg.id:''),br=Object.keys(L.brut);
      return{lieu:br.sort(function(a,b){return L.brut[b]-L.brut[a];})[0],variantes:br.length>1?br.length+' écritures : '+br.slice(0,4).join(' · '):'',n:L.n,dernier:fdate(L.last),sugg:sg&&!sel[L.k]?'Suggestion d’après le nom':'',off:!v,
        opts:[{v:'',l:'— Choisir un site —',sel:!v}].concat(sOpts.map(function(s){var c=self.clientById(s.client_id);return{v:s.id,l:(c?c.nom+' › ':'')+s.nom,sel:s.id===v};})),
        onSite:function(e){var o=Object.assign({},self.state.lieuSel);o[L.k]=e.target.value;self.setState({lieuSel:o});},classer:function(){if(v)self.clClasser(L,v);}};});}
  var ce=st.cle,cm=st.clm,ms=cm&&D.byId[cm.src],md=cm&&D.byId[cm.dst];
  Object.assign(cl,{dlgClient:!!ce,ceTitre:ce&&ce.id?'Modifier le client':'Nouveau client',ceNom:ce?ce.nom:'',ceInterne:!!(ce&&ce.interne),
    onCeNom:function(e){self.setState({cle:Object.assign({},self.state.cle,{nom:e.target.value})});},onCeInterne:function(e){self.setState({cle:Object.assign({},self.state.cle,{interne:e.target.checked})});},ceSave:function(){self.clSaveClient();},
    dlgMerge:!!(ms&&md),mSrc:ms?ms.nom:'',mDst:md?md.nom:'',mSansBassin:!!ms&&!(ms.bassins||[]).length,mGarde:!!(cm&&cm.garde),mInst:cm?cm.inst:'',mLabel:cm&&cm.busy?'Fusion…':'Fusionner',
    onMGarde:function(e){self.setState({clm:Object.assign({},self.state.clm,{garde:e.target.checked})});},onMInst:function(e){self.setState({clm:Object.assign({},self.state.clm,{inst:e.target.value})});},mGo:function(){self.clFusionner();}});
  return{sitesTabs:tabs,isClTab:tab==='clients'&&!noDb,isLxTab:tab==='lieux'&&!noDb,sitesRepDisp:tab==='rep'?'flex':'none',cl:cl};};
