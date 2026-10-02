(function(){
'use strict';
var SB='https://ldqvdiaewvhnukuaxdmc.supabase.co',KEY='sb_publishable_qVd_6eoAvwrDGs9u81woAg_RrMpTJxn';
var H={apikey:KEY,Authorization:'Bearer '+KEY};
function get(p){return fetch(SB+'/rest/v1/'+p,{headers:H}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status+' '+p.split('?')[0]);return r.json();});}
/* Lecture « non bloquante » : l'écran reste utilisable, mais l'échec est consigné et affiché (bandeau), jamais avalé. */
var SOFT_ERR=[];
function netMsg(e){var m=String(e&&e.message||e);return /Failed to fetch|NetworkError|Load failed/i.test(m)?'réseau injoignable':m;}
function soft(p,d){return get(p).catch(function(e){var t=p.split('?')[0];if(SOFT_ERR.indexOf(t)<0)SOFT_ERR.push(t+' ('+netMsg(e).replace(/ [a-z_]+$/,'')+')');return d;});}
function jget(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
var MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],JS=['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
function pad(n){return n<10?'0'+n:''+n;}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
function mondayOf(d){var x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function fr(v,step){var d=(String(step).split('.')[1]||'').length;return Number(v).toFixed(d).replace('.',',');}
function fdate(s){if(!s)return'—';var p=String(s).slice(0,10).split('-');return p[2]+' '+MOIS[+p[1]-1].slice(0,4)+'.';}
function villeOf(a){var p=String(a||'').split(',').map(function(x){return x.trim();}).filter(function(x){return x&&!/^(qc|québec|quebec|canada)$/i.test(x)&&!/[a-z]\d[a-z]\s?\d[a-z]\d/i.test(x);});return p.length>1?p[p.length-1].replace(/^Ville de\s+/i,''):'';}
function fmtH(h){if(!h||h<=0)return '0 h 00';var m=Math.round(h*60);return Math.floor(m/60)+' h '+pad(m%60);}
function minsFrom(s,e){if(!s||!e)return 0;var sp=String(s).split(':'),ep=String(e).split(':'),sm=parseInt(sp[0],10)*60+parseInt(sp[1],10),em=parseInt(ep[0],10)*60+parseInt(ep[1],10);if(isNaN(sm)||isNaN(em))return 0;if(em<sm)em+=1440;return Math.max(0,em-sm);}
function isoWeek(d){var t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),dn=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-dn);var y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y0)/86400000+1)/7);}
function wkLabel(m){return 'Semaine '+isoWeek(m)+' · '+m.getDate()+' '+MOIS[m.getMonth()].slice(0,4)+'.';}
var DJ=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
var SUN={},segS=function(on){return{bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)'};};

function Comp(user){
  this.user=user;this.rootRef={current:null};this.D=null;this.ftw={};this._ftwL={};this.envois={};this.pmm={};this.docs={};this.stk=null;this.flt=null;this.tools=null;this.tmoves=null;this.lcfg=null;this.loadedAt=null;this.err='';
  this.state={portail:!hashMod()&&portailPref(),mod:'monitoring',q:'',toast:null,inspSite:null,inspKey:null,inspFilter:'all',opsFilter:'Tous',opsOpen:{},siteType:'all',carteView:'geo',sr:null,pView:'semaine',gHideDone:false,carteAcc:100,carteFix:null,carteTour:null,carteQ:'',carteType:'all',sf:null,ty:null,inspBassin:null,monPer:'jour',monWall:false,factFilter:'Tous',tempsTab:'semaine',eUid:null,eDay:null,tOff:0,sOff:0,fe:null,pmmDate:null,pb:null,ce:null,de:null,docQ:'',docF:'tous',logTab:'bl',se:null,stkQ:'',stkCat:'tous',te:null,ke:null,outTab:'outils',outF:'tous',outQ:'',qrIn:null,hj:null,hp:null,paieSel:{},paieOpen:{},paieMode:'synthese',pOff:0,ed:null,sed:null,survey:null,sondKey:(function(){try{return localStorage.getItem('sa_admin_sondkey')||'';}catch(e){return '';}})(),keyIn:'',dlg:false,busy:false,f:{type:'Bon de travail',site:'',tech:'',debut:'',heure:'07:00',rec:'aucune',jours:{},fin:''}};this.pl={};this._pl={};this.sd={};this._sd={};
}
Comp.prototype.setState=function(p){this.state=Object.assign({},this.state,typeof p==='function'?p(this.state):p);this.update();};
Comp.prototype.flash=function(t){var s=this;clearTimeout(this._tt);this.state.toast=t;this.update();this._tt=setTimeout(function(){s.state.toast=null;s.update();},2800);};
Comp.prototype.go=function(m,x){this.setState(Object.assign({mod:m,q:''},x||{}));var el=this.rootRef.current&&this.rootRef.current.querySelector('main');if(el)el.scrollTop=0;};

Comp.prototype.load=function(){
  var self=this,now=new Date(),wk=iso(mondayOf(now)),wk0=iso(addDays(mondayOf(now),-7)),today=iso(now),since=iso(addDays(now,-120));
  SOFT_ERR=[];
  /* Requêtes nommées : chaque résultat est lu par son nom (plus par sa position), pour qu'ajouter ou retirer une
     requête ne décale plus jamais les autres en silence. */
  var Q={sites:get('sites?select=id,nom,addr,type,notes,tel,bassins,gps'),contrats:get('contrats?select=site_id,type_code,code'),types:get('types_bassin?select=*'),
    comptes:soft('comptes_publics?select=id,prenom,nom,role,dept,tel',[]),
    ft:soft('feuilles_temps?select=uid,emp,week,days,total_h&week=gte.'+iso(addDays(now,-56)),[]),
    wo:soft('workorders?select=id,client,site,type,priorite,status,date,assigne,descr,groupe_id&order=date.asc',[]),
    rel:soft('releves?select=id,site_id,site_nom,tech,tech_nom,date,heure,type_code,vals,touched,checks,prods,note,hors_zone,bassin&date=gte.'+since+'&order=date.asc,heure.asc',[]),
    gps:soft('punch_gps_log?select=emp,heure,lieu,date&date=eq.'+today+'&order=heure.desc&limit=30',[]),
    plan:soft('plan?select=id&date=eq.'+today,[]),pt:soft('planning_tasks?select=id&date_debut=lte.'+today+'&date_fin=gte.'+today,[]),
    dem:soft('demandes?select=id,tech,tech_nom,site_nom,type,motif,texte,statut,created_at,has_photo&order=created_at.desc&limit=40',[]),
    ftAll:soft('feuilles_temps?select=uid,week,total_h',[]),fact:soft('facturation?select=*',[]),proj:soft('projets_excel?select=*',[]),
    statut:soft('comptes?select=id,statut,email',[]),sond:soft('sondages?select=id,slug,titre,client,actif,created_at&order=created_at.desc',[]),
    geo:soft('punch_gps_log?select=site_id,emp,lat,lng,acc,date,heure,lieu&lat=not.is.null&order=date.desc,heure.desc&limit=800',[]),
    inv:soft('inventaire?select=id,nom,qte,seuil',[]),flotte:soft('flotte?select=id,nom,plaque',[])};
  var K=Object.keys(Q);
  return Promise.all(K.map(function(k){return Q[k];})).then(function(arr){
    var r={};K.forEach(function(k,i){r[k]=arr[i];});
    var T={};r.types.forEach(function(t){T[t.code]=t;});var ct={};r.contrats.forEach(function(c){ct[c.site_id]=c;});
    var sites=r.sites.map(function(s){var c=ct[s.id],code=(c&&c.type_code&&T[c.type_code])?c.type_code:'GEN';return{id:String(s.id),nom:s.nom||'(sans nom)',addr:s.addr||'',ville:villeOf(s.addr),type:code,contrat:(c&&c.code)||'',notes:s.notes||'',tel:s.tel||'',bassins:Array.isArray(s.bassins)?s.bassins:[],gps:s.gps&&s.gps.lat!=null?s.gps:null};})
      .sort(function(a,b){return a.nom.localeCompare(b.nom,'fr');});
    var byId={};sites.forEach(function(s){byId[s.id]=s;s.merged=/^Fusionné →/.test(s.notes);});var sitesAll=sites;sites=sites.filter(function(s){return!s.merged;});
    var statut={},email={};(r.statut||[]).forEach(function(c){statut[c.id]=c.statut;if(c.email)email[c.id]=c.email;});
    (r.comptes||[]).forEach(function(c){if(c.email==null&&email[c.id])c.email=email[c.id];});
    self.D={sites:sites,sitesAll:sitesAll,byId:byId,types:T,comptes:r.comptes,ft:r.ft,wo:r.wo,rel:r.rel.map(function(x){x.site_id=String(x.site_id);return x;}),gps:r.gps,nPlan:r.plan.length,nPt:r.pt.length,dem:r.dem||[],ftAll:r.ftAll||[],fact:r.fact||[],proj:r.proj||[],sond:r.sond||[],geo:r.geo||[],inv:r.inv||[],flotte:r.flotte||[],statut:statut,today:today};
    self.loadedAt=new Date();self.err='';self.softErr=SOFT_ERR.slice();
    if(!self.state.inspSite){var w=self.D.rel.length?String(self.D.rel[self.D.rel.length-1].site_id):(sites[0]&&sites[0].id);self.state.inspSite=w||null;}
  }).catch(function(e){self.err='Chargement impossible : '+netMsg(e);});
};
Comp.prototype.loadPlan=function(mon){var self=this,a=iso(mon),b=iso(addDays(mon,6));
  return Promise.all([soft('workorders?select=id,client,site,date,assigne,status,descr,groupe_id&date=gte.'+a+'&date=lte.'+b,[]),soft('plan?select=id,client,addr,date,heure,emp,descr,type,status&date=gte.'+a+'&date=lte.'+b,[]),
    soft('planning_tasks?select=id,titre,emp,site_nom,date_debut,date_fin,heure_debut,heure_fin,statut,recurrence,wo_id,plan_id&date_debut=lte.'+b+'&date_fin=gte.'+a,[])]).then(function(r){self.pl[a]={wo:r[0],plan:r[1],pt:r[2]};});};
function rest(method,path,body,pref){return fetch(SB+'/rest/v1/'+path,{method:method,headers:Object.assign({'Content-Type':'application/json',Prefer:pref||'return=representation'},H),body:body?JSON.stringify(body):undefined}).then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error('HTTP '+r.status+' '+t.slice(0,140));});return r.text().then(function(t){return t?JSON.parse(t):[];});});}
function postRows(table,rows){return fetch(SB+'/rest/v1/'+table,{method:'POST',headers:Object.assign({'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},H),body:JSON.stringify(rows)}).then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error('HTTP '+r.status+' '+t.slice(0,120));});return r.json();});}
function occurrences(f){if(!f.debut)return[];var d0=new Date(f.debut+'T12:00:00');if(f.rec==='aucune')return[d0];var fin=f.fin?new Date(f.fin+'T12:00:00'):null;if(!fin||fin<d0)return[d0];
  var step=f.rec==='bihebdo'?2:1,days=Object.keys(f.jours).filter(function(k){return f.jours[k];}).map(Number);if(!days.length)days=[d0.getDay()];var out=[],m0=mondayOf(d0);
  for(var d=new Date(d0);d<=fin&&out.length<104;d.setDate(d.getDate()+1)){var w=Math.round((mondayOf(d)-m0)/604800000);if(w%step)continue;if(days.indexOf(d.getDay())>=0)out.push(new Date(d));}return out;}
Comp.prototype.openDlg=function(p){var f=Object.assign({type:'Bon de travail',site:'',tech:'',debut:iso(new Date()),heure:'07:00',rec:'aucune',jours:{},fin:''},p||{});this.setState({dlg:true,f:f,busy:false});};
Comp.prototype.createSeries=function(){var self=this,D=this.D,f=this.state.f;if(this.state.busy)return;var occ=occurrences(f);
  if(!f.site||!D.byId[f.site]){this.flash('Choisissez un site');return;}if(!occ.length){this.flash('Choisissez une première date');return;}
  var site=D.byId[f.site],tech=f.tech||'',names={};D.comptes.forEach(function(c){names[c.id]=(c.prenom+' '+c.nom).trim();});
  var dates=occ.map(iso),first=dates[0],last=dates[dates.length-1],now=new Date().toISOString(),gid=occ.length>1?('s'+Date.now().toString(36)):null,tb,sel,dateKey,mkRow;
  var slug=function(d){return[f.type[0],site.id,tech||'x',d.replace(/-/g,''),(f.heure||'').replace(':','')].join('-');};
  if(f.type==='Bon de travail'){tb='workorders';sel='select=date,assigne&client=eq.'+encodeURIComponent(site.nom)+'&date=gte.'+first+'&date=lte.'+last;dateKey='date';
    mkRow=function(d){return{id:'adm-'+slug(d),client:site.nom,site:site.addr||'',type:'entretien',priorite:'normal',status:'ouvert',date:d,assigne:tech,descr:'',notes:'',tasks:[],files:[],created_at:now,updated_at:now,created_by:self.user.id,req_bassin:false,req_photo:false,req_notes:false,groupe_id:gid};};}
  else if(f.type==='Créneau'){tb='plan';sel='select=date,emp&site_id=eq.'+encodeURIComponent(site.id)+'&date=gte.'+first+'&date=lte.'+last;dateKey='date';
    mkRow=function(d){return{id:'adm-'+slug(d),date:d,heure:f.heure||'',emp:tech,client:site.nom,addr:site.addr||'',site_id:site.id,type:'',descr:'',notes:'',status:'assigned',updated_at:now};};}
  else{tb='planning_tasks';sel='select=date_debut,emp&site_id=eq.'+encodeURIComponent(site.id)+'&date_debut=gte.'+first+'&date_debut=lte.'+last;dateKey='date_debut';
    mkRow=function(d){return{id:'adm-'+slug(d),titre:site.nom,descr:'',emp:tech,emp_nom:tech?(names[tech]||''):'',site_id:site.id,site_nom:site.nom,date_debut:d,date_fin:d,heure_debut:f.heure||'',heure_fin:'',statut:'assigne',recurrence:gid?{serie:gid,freq:f.rec,fin:f.fin||null}:null,created_by:self.user.id,created_at:now,updated_at:now};};}
  this.setState({busy:true});
  get(tb+'?'+sel).then(function(ex){var have={};ex.forEach(function(x){var e=String(x.assigne!=null?x.assigne:x.emp||'');have[x[dateKey]+'|'+e]=1;});
    var todo=dates.filter(function(d){return!have[d+'|'+tech];}),skipped=dates.length-todo.length;
    if(!todo.length){self.setState({busy:false});self.flash('Rien à créer — ces dates existent déjà ('+skipped+')');return;}
    return postRows(tb,todo.map(mkRow)).then(function(ins){var msg=ins.length+' créé'+(ins.length>1?'s':'')+(skipped?' · '+skipped+' déjà existant'+(skipped>1?'s':'')+' ignoré'+(skipped>1?'s':''):'');
      self.pl={};self._pl={};self.setState({dlg:false,busy:false});self.flash(msg);return self.load().then(function(){self.update();});});
  }).catch(function(e){self.setState({busy:false});self.flash('Échec — rien n’a été modifié : '+e.message);});};
Comp.prototype.reloadAll=function(){var self=this;this.pl={};this._pl={};this.ftw={};this.rng={};return this.load().then(function(){self.update();});};
Comp.prototype.openEdit=function(m){var self=this,TB={wo:'workorders',plan:'plan',pt:'planning_tasks'}[m.kind];this.setState({ed:{loading:true,kind:m.kind,id:m.id,confirm:0}});
  get(TB+'?id=eq.'+encodeURIComponent(m.id)+'&select=*').then(function(r){var x=r[0];if(!x){self.setState({ed:null});self.flash('Élément introuvable');return;}
    var e={kind:m.kind,id:m.id,tb:TB,loading:false,confirm:0,busy:false,serieN:0},em=function(v){var s=String(v||'');return{t:s.split(/,\s*/)[0]||'',m:s.indexOf(',')>=0};},t;
    if(m.kind==='wo'){t=em(x.assigne);e.date=x.date;e.tech=t.t;e.multi=t.m;e.statut=x.status==='termine'?'termine':x.status==='en_cours'?'en_cours':'ouvert';e.heure='';e.titre=x.client;e.serie=x.groupe_id||'';e.label='Bon de travail';}
    else if(m.kind==='plan'){t=em(x.emp);e.date=x.date;e.tech=t.t;e.multi=t.m;e.statut=x.status==='termine'?'termine':'ouvert';e.heure=x.heure||'';e.titre=x.client;e.serie='';e.label='Créneau';}
    else{t=em(x.emp);e.date=x.date_debut;e.tech=t.t;e.multi=t.m;e.statut=x.statut==='termine'?'termine':'ouvert';e.heure=x.heure_debut||'';e.titre=x.site_nom||x.titre;e.serie=(x.recurrence&&x.recurrence.serie)||'';e.multiJour=!!(x.date_fin&&x.date_fin!==x.date_debut);e.label='Tâche';}
    self.setState({ed:e});}).catch(function(err){self.setState({ed:null});self.flash('Erreur : '+err.message);});};
Comp.prototype.saveEdit=function(){var self=this,e=this.state.ed,D=this.D;if(!e||e.busy)return;var now=new Date().toISOString(),b,nm={};D.comptes.forEach(function(c){nm[c.id]=(c.prenom+' '+c.nom).trim();});
  if(!e.date){this.flash('Choisissez une date');return;}
  if(e.kind==='wo'){b={date:e.date,status:e.statut,updated_at:now};if(!e.multi)b.assigne=e.tech;}
  else if(e.kind==='plan'){b={date:e.date,heure:e.heure,status:e.statut==='termine'?'termine':'assigned',updated_at:now};if(!e.multi)b.emp=e.tech;}
  else{b={heure_debut:e.heure,statut:e.statut==='termine'?'termine':'assigne',updated_at:now};if(!e.multiJour){b.date_debut=e.date;b.date_fin=e.date;}if(!e.multi){b.emp=e.tech;b.emp_nom=e.tech?(nm[e.tech]||''):'';}}
  this.setState({ed:Object.assign({},e,{busy:true})});
  rest('PATCH',e.tb+'?id=eq.'+encodeURIComponent(e.id),b).then(function(rows){if(!rows.length)throw new Error('élément introuvable');self.setState({ed:null});self.flash('Modification enregistrée');return self.reloadAll();})
   .catch(function(err){self.setState({ed:Object.assign({},e,{busy:false})});self.flash('Échec — rien n’a été modifié : '+err.message);});};
Comp.prototype.serieFilter=function(e){var td=iso(new Date());return e.kind==='wo'?('workorders?groupe_id=eq.'+encodeURIComponent(e.serie)+'&status=eq.ouvert&date=gte.'+td):('planning_tasks?recurrence->>serie=eq.'+encodeURIComponent(e.serie)+'&statut=eq.assigne&date_debut=gte.'+td);};
Comp.prototype.askDel=function(level){var self=this,e=this.state.ed;if(level===2){get(this.serieFilter(e)+'&select=id').then(function(r){self.setState({ed:Object.assign({},self.state.ed,{confirm:2,serieN:r.length})});}).catch(function(err){self.flash('Erreur : '+err.message);});}else this.setState({ed:Object.assign({},e,{confirm:level})});};
Comp.prototype.doDel=function(level){var self=this,e=this.state.ed;if(!e||e.busy)return;this.setState({ed:Object.assign({},e,{busy:true})});
  var path=level===2?this.serieFilter(e):(e.tb+'?id=eq.'+encodeURIComponent(e.id));
  rest('DELETE',path).then(function(rows){self.setState({ed:null});self.flash(rows.length+' supprimé'+(rows.length>1?'s':'')+' — une copie est conservée');return self.reloadAll();})
   .catch(function(err){self.setState({ed:Object.assign({},e,{busy:false})});self.flash('Échec — rien n’a été supprimé : '+err.message);});};
Comp.prototype.openSiteEdit=function(id){this.openSiteFiche(id);};
Comp.prototype.saveSite=function(){var self=this,e=this.state.sed;if(!e||e.busy)return;if(!String(e.nom||'').trim()){this.flash('Le nom ne peut pas être vide');return;}var now=new Date().toISOString();this.setState({sed:Object.assign({},e,{busy:true})});
  rest('PATCH','sites?id=eq.'+encodeURIComponent(e.id),{nom:String(e.nom).trim(),addr:String(e.addr||'').trim(),updated_at:now}).then(function(){return rest('POST','contrats',{site_id:e.id,type_code:e.type,code:e.code||null,actif:true,updated_at:now},'resolution=merge-duplicates,return=minimal');})
   .then(function(){self.setState({sed:null});self.flash('Site enregistré');return self.reloadAll();}).catch(function(err){self.setState({sed:Object.assign({},e,{busy:false})});self.flash('Échec — rien n’a été modifié : '+err.message);});};
Comp.prototype.siteAction=function(id,mode,canonId){var self=this,D=this.D,s=D.byId[id],c=canonId&&D.byId[canonId],now=new Date().toISOString(),d=iso(new Date()),orig=String(s.notes||'').replace(/Ajouté automatiquement depuis un punch\.?\s*/i,'').trim(),notes,p;
  if(mode==='merge'&&c){notes=('Fusionné → '+c.nom+' ['+c.id+'] le '+d+'. '+orig).trim();
    p=rest('PATCH','sites?id=eq.'+encodeURIComponent(id),{notes:notes,updated_at:now})
     .then(function(){return rest('PATCH','planning_tasks?site_id=eq.'+encodeURIComponent(id),{site_id:c.id,site_nom:c.nom,updated_at:now});})
     .then(function(){return rest('PATCH','plan?site_id=eq.'+encodeURIComponent(id),{site_id:c.id,updated_at:now});})
     .then(function(){return rest('POST','contrats',{site_id:id,type_code:c.type,code:c.contrat||null,actif:true,updated_at:now},'resolution=merge-duplicates,return=minimal');});}
  else{notes=('Site validé le '+d+'. '+orig).trim();p=rest('PATCH','sites?id=eq.'+encodeURIComponent(id),{notes:notes,updated_at:now});}
  p.then(function(){self.flash(mode==='merge'?'Fusionné dans « '+c.nom+' » — l’historique des punchs est conservé':'Site validé');return self.reloadAll();}).catch(function(err){self.flash('Échec — rien n’a été modifié : '+err.message);});};
Comp.prototype.loadSond=function(slug){var self=this;
  fetch(SB+'/rest/v1/rpc/sondage_stats',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},H),body:JSON.stringify({p_slug:slug,p_cle:this.state.sondKey})})
   .then(function(r){if(!r.ok)throw new Error('cle');return r.json();}).then(function(rows){if(!Array.isArray(rows))throw new Error('cle');self.sd[slug]=rows;self.update();})
   .catch(function(){delete self._sd[slug];try{localStorage.removeItem('sa_admin_sondkey');}catch(e){}self.setState({sondKey:''});self.flash('Clé d’accès incorrecte');});};
Comp.prototype.geoData=function(){var D=this.D,g={},techs={},today=D.today;
  D.geo.forEach(function(x){if(x.lat==null||x.lng==null||(x.acc!=null&&Number(x.acc)>500))return;
    if(x.site_id){(g[x.site_id]=g[x.site_id]||[]).push(x);}
    if(x.date===today&&!techs[x.emp])techs[x.emp]=x;});
  var sites=[];Object.keys(g).forEach(function(id){var s=D.byId[id];if(!s||s.merged)return;var rows=g[id].slice(0,15),la=0,ln=0;rows.forEach(function(r){la+=Number(r.lat);ln+=Number(r.lng);});
    sites.push({id:id,nom:s.nom,type:s.type,lat:la/rows.length,lng:ln/rows.length,n:g[id].length,last:g[id][0].date});});
  return{sites:sites,techs:techs};};
Comp.prototype.syncMap=function(){var self=this;
  try{
  if(this.state.mod!=='carte'||this.state.carteView!=='geo'||!this.D)return;
  var slot=document.getElementById('mapSlot');
  if(!slot){console.error('[carte] #mapSlot introuvable dans le DOM — le gabarit n’a pas rendu ce bloc.');return;}
  if(!window.L){
    var reason='Bibliothèque de carte (Leaflet, intégrée au fichier) non initialisée — voir la console.';
    slot.innerHTML='<div style="padding:16px;font-size:13px;color:var(--color-text)">'+reason+'</div>';console.error('[carte] window.L absent —',reason);return;
  }
  if(!this._mapHost){this._mapHost=document.createElement('div');this._mapHost.setAttribute('data-keep','1');this._mapHost.style.cssText='height:100%;width:100%';}
  if(this._mapHost.parentNode!==slot){slot.appendChild(this._mapHost);}
  if(!this._map){this._map=L.map(this._mapHost,{zoomControl:true,attributionControl:true}).setView([46.82,-71.25],10);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(this._map);this._layer=L.layerGroup().addTo(this._map);this._fitted=false;}
  var st=this.state,G=this.carteGeo(),names={};this.D.comptes.forEach(function(c){names[c.id]=(c.prenom+' '+c.nom).trim();});
  var tour=Array.isArray(this._tour)?this._tour:[];
  /* ne redessine que si quelque chose a changé (sinon une bulle ouverte se refermait à chaque relecture) */
  var routes=st.cartePlan?this.plannedRoutes(st.cartePlanDate||this.D.today):null;
  var key=JSON.stringify([st.cartePlan,st.cartePlanDate,routes&&routes.map(function(r){return r.stops.length;}).join(),st.carteSites,st.carteTechs,st.cartePrec,st.carteAcc,st.carteType,st.carteQ,st.carteTour,G.sites.map(function(x){return x.id+x.lat+x.lng;}).join(),Object.keys(G.techs).join(),tour.length,this.loadedAt&&+this.loadedAt]);
  if(!this._map._saClick){this._map._saClick=true;this._map.on('click',function(e){var fx=self.state.carteFix;if(fx)self.setSiteGps(fx,e.latlng.lat,e.latlng.lng,'corrigée sur la carte');});}
  this._mapHost.style.cursor=st.carteFix?'crosshair':'';
  if(key===this._mapKey&&!this._mapDirty){setTimeout(function(){self._map.invalidateSize();},60);return;}this._mapKey=key;this._mapDirty=false;
  this._layer.clearLayers();var pts=[],E=function(x){return String(x==null?'':x).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
  if(st.carteSites!==false)G.sites.forEach(function(s){var fiche=s.src==='fiche';
    var pop='<b>'+E(s.nom)+'</b><br>'+E(self.T(s.type).court)+(s.addr?'<br>'+E(s.addr):'')+'<br>'+(fiche?'Position de la fiche du site':'Estimée d’après '+Math.min(20,s.n)+' punch(s) précis (± '+s.prec+' m)')
      +'<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px"><a href="#" onclick="window.__admin.openSiteFiche(\''+s.id+'\');return false">Ouvrir la fiche du site</a>'
      +(fiche?'':'<a href="#" onclick="window.__admin.setSiteGps(\''+s.id+'\','+s.lat+','+s.lng+',\'estimation des punchs\');return false">Garder cette position dans la fiche</a>')
      +'<a href="#" onclick="window.__admin.setState({carteFix:\''+s.id+'\'});window.__admin._map.closePopup();return false">Corriger : cliquer l’endroit exact sur la carte</a></div>';
    if(!fiche&&st.cartePrec!==false&&s.prec)L.circle([s.lat,s.lng],{radius:Math.min(s.prec,400),color:'#5b86b0',weight:1,fillOpacity:.08,interactive:false}).addTo(self._layer);
    var m=fiche?L.marker([s.lat,s.lng],{icon:L.divIcon({className:'',html:'<div style="width:14px;height:14px;background:#004987;border:2px solid #fff;box-shadow:0 0 0 1px #004987"></div>',iconSize:[14,14],iconAnchor:[7,7]})})
      :L.circleMarker([s.lat,s.lng],{radius:7,color:'#1d2d3d',weight:2,fillColor:'#94bce3',fillOpacity:.95});
    m.bindPopup(pop).addTo(self._layer);pts.push([s.lat,s.lng]);});
  if(st.carteTechs!==false)Object.keys(G.techs).forEach(function(e){var t=G.techs[e];var m=L.circleMarker([Number(t.lat),Number(t.lng)],{radius:11,color:'#000',weight:3,fillColor:'#1d2d3d',fillOpacity:1}).bindPopup('<b>'+E(names[e]||e)+'</b><br>Punch à '+E(t.heure)+'<br>'+E(t.lieu||'')+(t.acc!=null?'<br>Précision ± '+Math.round(t.acc)+' m':''));m.addTo(self._layer);pts.push([Number(t.lat),Number(t.lng)]);});
  if(routes){var allR=[];routes.forEach(function(r){var lls=r.stops.filter(function(s){return s.lat!=null;}).map(function(s){return[s.lat,s.lng];});if(lls.length>1)L.polyline(lls,{color:r.col,weight:4,opacity:.75}).addTo(self._layer);
      var k=0;r.stops.forEach(function(s){if(s.lat==null)return;k++;L.marker([s.lat,s.lng],{icon:L.divIcon({className:'',html:'<div style="width:24px;height:24px;border-radius:50%;background:'+r.col+';color:#fff;font:700 12px/24px Arial;text-align:center;border:2px solid #fff">'+k+'</div>',iconSize:[24,24],iconAnchor:[12,12]})})
        .bindPopup('<b>'+k+'. '+E(s.nom)+'</b><br>'+E(r.nom)+' · '+(s.h||'sans heure')).addTo(self._layer);allR.push([s.lat,s.lng]);});});if(allR.length&&!this._fittedPlan){pts=allR;this._fitted=false;this._fittedPlan=true;}}
  if(tour.length){var lls=tour.map(function(p){return[Number(p.lat),Number(p.lng)];});L.polyline(lls,{color:'#c0392b',weight:3,dashArray:'6 6'}).addTo(this._layer);
    tour.forEach(function(p,i){var bad=p.acc!=null&&Number(p.acc)>Number(st.carteAcc||100);L.marker([Number(p.lat),Number(p.lng)],{icon:L.divIcon({className:'',html:'<div style="width:22px;height:22px;border-radius:50%;background:'+(bad?'#999':'#c0392b')+';color:#fff;font:700 12px/22px Arial;text-align:center;border:2px solid #fff">'+(i+1)+'</div>',iconSize:[22,22],iconAnchor:[11,11]})})
      .bindPopup('<b>'+(i+1)+'. '+E(p.heure)+'</b><br>'+E(p.lieu||'')+(p.acc!=null?'<br>Précision ± '+Math.round(p.acc)+' m'+(bad?' (imprécis)':''):'')).addTo(self._layer);});pts=lls.concat(tour.length?[]:pts);if(!this._fitted){this._fitted=false;}}
  setTimeout(function(){self._map.invalidateSize();if(!self._fitted&&pts.length){self._map.fitBounds(pts,{padding:[40,40],maxZoom:15});self._fitted=true;}},60);
  }catch(e){console.error('[carte] erreur de rendu :',e);var s2=document.getElementById('mapSlot');if(s2)s2.innerHTML='<div style="padding:16px;font-size:13px">Erreur d’affichage de la carte : '+e.message+'</div>';}};
Comp.prototype.writeFT=function(uid,week,fn,tries){var self=this,id=uid+'_'+week;tries=tries||0;
  return get('feuilles_temps?id=eq.'+encodeURIComponent(id)+'&select=*').then(function(r){var row=r[0];if(!row)throw new Error('feuille introuvable');var nd=fn(JSON.parse(JSON.stringify(row.days)));
    var tot=0;nd.forEach(function(d){(d.tasks||[]).forEach(function(t){tot+=Number(t.hrs)||0;});});var now=new Date().toISOString();
    return fetch(SB+'/rest/v1/feuilles_temps?id=eq.'+encodeURIComponent(id)+'&updated_at='+(row.updated_at==null?'is.null':'eq.'+encodeURIComponent(row.updated_at)),{method:'PATCH',headers:Object.assign({'Content-Type':'application/json',Prefer:'return=representation'},H),body:JSON.stringify({days:nd,total_h:tot,updated_at:now})})
     .then(function(res){if(!res.ok)throw new Error('HTTP '+res.status);return res.json();})
     .then(function(rows){if(rows.length)return rows[0];if(tries>=5)throw new Error('conflit, réessayez');return self.writeFT(uid,week,fn,tries+1);});});};
/* Même protocole que SA Platform (v64) : un punch touché à la main reçoit une identité stable (k, k0 = signature
   d'origine) et l'heure de la modification (mod). Sans mod, la fusion d'index.html garde la version « la plus complète »
   — le téléphone de l'employé pouvait donc annuler une correction ou une validation faite ici. */
function marquerModif(t){if(!t.k){t.k0=(t.start||'')+'|'+(t.lieu||'');t.k=Date.now().toString(36)+Math.random().toString(36).slice(2,6);}t.mod=Date.now();return t;}
Comp.prototype.openDemPhoto=function(id){var w=window.open('','_blank');if(w)w.document.write('<p style="font:16px sans-serif">Chargement de la photo…</p>');
  get('demandes?id=eq.'+encodeURIComponent(id)+'&select=photo').then(function(r){var ph=r[0]&&r[0].photo;if(!ph)throw new Error('photo introuvable');if(w){w.document.open();w.document.write('<title>Photo de la demande</title><body style="margin:0;background:#111"><img src="'+ph+'" style="max-width:100%;display:block;margin:auto"></body>');w.document.close();}})
   .catch(function(e){if(w)w.close();this.flash('Photo : '+netMsg(e));}.bind(this));};
Comp.prototype.findTask=function(days,dayIdx,start,lieu){return((days[dayIdx]||{}).tasks||[]).filter(function(t){return t.start===start&&t.lieu===lieu;})[0];};
Comp.prototype.validerPunch=function(p){var self=this;this.flash('Validation…');
  this.writeFT(p.uid,p.week,function(days){var t=self.findTask(days,p.dayIdx,p._start,p._lieu);if(!t)throw new Error('punch introuvable — la feuille a changé');marquerModif(t);{t.pendingValidation=false;t.autoClosed=false;t.validatedBy=self.user.id;t.validatedAt=new Date().toISOString();}return days;})
   .then(function(){self.flash('Punch validé');return self.reloadAll();}).catch(function(e){self.flash('Échec — rien n’a été modifié : '+e.message);});};
Comp.prototype.openFix=function(p){this.setState({fx:Object.assign({},p,{lieu2:p._lieu,entree2:p._start,sortie2:p.sortie==='—'?'':p.sortie})});};
var HM=/^([01]\d|2[0-3]):[0-5]\d$/;
Comp.prototype.saveFix=function(){var self=this,f=this.state.fx;if(!f)return;
  var lieu2=String(f.lieu2||'').trim(),e2=String(f.entree2||'').trim(),s2=String(f.sortie2||'').trim();
  if(!lieu2){this.flash('Le lieu ne peut pas être vide');return;}if(!HM.test(e2)){this.flash('Heure d’entrée invalide (HH:MM)');return;}if(s2&&!HM.test(s2)){this.flash('Heure de sortie invalide (HH:MM)');return;}
  this.writeFT(f.uid,f.week,function(days){var t=self.findTask(days,f.dayIdx,f._start,f._lieu);if(!t)throw new Error('punch introuvable — la feuille a changé');marquerModif(t);
    t.lieu=lieu2;t.start=e2;if(s2){t.end=s2;t.active=false;}if(t.end&&!t.active)t.hrs=hrsFrom(t.start,t.end);t.pendingValidation=false;t.autoClosed=false;t.correctedBy=self.user.id;t.correctedAt=new Date().toISOString();return days;})
   .then(function(){self.setState({fx:null});self.flash('Punch corrigé');return self.reloadAll();}).catch(function(e){self.flash('Échec — rien n’a été modifié : '+e.message);});};
function hrsFrom(s,e){var sp=String(s).split(':'),ep=String(e).split(':'),sm=+sp[0]*60+ +sp[1],em=+ep[0]*60+ +ep[1];if(em<sm)em+=1440;return Math.max(0,(em-sm)/60);}
Comp.prototype.cycleStatut=function(b){var ORD=['À facturer','Facturé','Payé'],cur=b.statut,i=ORD.indexOf(cur),nx=ORD[(i+1)%ORD.length]||ORD[0];
  if(cur==='—'||!ORD.includes(cur))nx='À facturer';var self=this;
  rest('PATCH','facturation?id=eq.'+encodeURIComponent(b.id),{statut_facturation:nx,updated_at:new Date().toISOString()})
   .then(function(){self.flash('Statut → '+nx);return self.reloadAll();}).catch(function(e){self.flash('Échec — rien n’a été modifié : '+e.message);});};
Comp.prototype.exportFact=function(rows){var head=['ID projet','Client','Ville','Date','ODT','PO','Prix calculé','Prix facturé','Écart','Statut','Technicien'];
  // vrai classeur Excel (.xlsx) : montants numériques, en-têtes en gras, total en bas
  var M=function(v){return v==null?'':{v:Number(v),s:3};},sum=function(k){return rows.reduce(function(s,r){return s+(Number(r[k])||0);},0);};
  var data=[head.map(function(h){return{v:h,s:1};})].concat(rows.map(function(r){return[r._idp,r.client,r._ville,r.date,r.odt==='—'?'':r.odt,r.po||'',M(r._calc),M(r._fact),M(r._ec),r.statut==='—'?'':r.statut,r._tech||''];}));
  data.push([{v:'Total',s:2},'','','','','',{v:sum('_calc'),s:4},{v:sum('_fact'),s:4},{v:sum('_ec'),s:4}]);
  saveBlob(xlsxBlob([{name:'Facturation',widths:[12,30,16,12,12,12,14,14,12,14,18],rows:data}]),'SoucyAquatik_Facturation_'+iso(new Date())+'.xlsx');this.flash('Fichier Excel téléchargé');};
Comp.prototype.T=function(code){return this.D.types[code]||this.D.types.GEN||{label:'Bassin',court:'Bassin',norme:'',fields:[]};};
Comp.prototype.outOf=function(rel){var T=this.T(rel.type_code),o=[];(T.fields||[]).forEach(function(f){var v=rel.vals&&rel.vals[f.key];if(v!=null&&rel.touched&&rel.touched[f.key]&&(v<f.lo||v>f.hi))o.push({f:f,v:v});});return o;};
Comp.prototype.latest=function(){var m={};this.D.rel.forEach(function(r){m[r.site_id]=r;});return m;};

/* ═════════════ Fichier Excel (.xlsx) sans dépendance ═════════════
   Un .xlsx est un zip de fichiers XML : on l'écrit directement (zip « stocké », sans compression).
   Aucune bibliothèque externe à charger — rien qu'un bloqueur ou un CDN en panne puisse empêcher. */
var CRC_T=(function(){var t=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u){var c=0xFFFFFFFF;for(var i=0;i<u.length;i++)c=CRC_T[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
function zipStore(files,type){var enc=new TextEncoder(),parts=[],central=[],off=0;
  files.forEach(function(f){var nm=enc.encode(f.name),d=enc.encode(f.x),crc=crc32(d);
    var h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,0x21,true);h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nm.length,true);
    parts.push(new Uint8Array(h.buffer),nm,d);
    var c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(14,0x21,true);c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+d.length;});
  var csz=central.reduce(function(s,a){return s+a.length;},0),e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csz,true);e.setUint32(16,off,true);
  return new Blob(parts.concat(central,[new Uint8Array(e.buffer)]),{type:type});}
function xmlEsc(s){return String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/[<>&"]/g,function(c){return{'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];});}
function colName(i){var s='';i++;while(i>0){var m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;}
/* sheets : [{name, widths:[..], rows:[[cellule…]…]}] ; cellule = texte, nombre, ou {v, s}
   s : 1 en-tête, 2 gras, 3 nombre 0,00, 4 total (gras, 0,00, fond), 5 titre */
function xlsxBlob(sheets){var X='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',NS='http://schemas.openxmlformats.org/',names={};
  var sh=sheets.map(function(s,i){var nm=String(s.name||('Feuille '+(i+1))).replace(/[\[\]:*?\/\\]/g,' ').trim().slice(0,31)||'Feuille',b=nm,k=2;
    while(names[nm.toLowerCase()])nm=b.slice(0,27)+' ('+(k++)+')';names[nm.toLowerCase()]=1;return{nm:nm,s:s};});
  var f=[{name:'[Content_Types].xml',x:X+'<Types xmlns="'+NS+'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sh.map(function(_,i){return'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';}).join('')+'</Types>'},
    {name:'_rels/.rels',x:X+'<Relationships xmlns="'+NS+'package/2006/relationships"><Relationship Id="rId1" Type="'+NS+'officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',x:X+'<workbook xmlns="'+NS+'spreadsheetml/2006/main" xmlns:r="'+NS+'officeDocument/2006/relationships"><sheets>'+sh.map(function(o,i){return'<sheet name="'+xmlEsc(o.nm)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>';}).join('')+'</sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',x:X+'<Relationships xmlns="'+NS+'package/2006/relationships">'+sh.map(function(_,i){return'<Relationship Id="rId'+(i+1)+'" Type="'+NS+'officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>';}).join('')+'<Relationship Id="rIdS" Type="'+NS+'officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/styles.xml',x:X+'<styleSheet xmlns="'+NS+'spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.00"/></numFmts>'
      +'<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF0B2E52"/><name val="Calibri"/></font></fonts>'
      +'<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1A5C9A"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F2FB"/></patternFill></fill></fills>'
      +'<borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      +'<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="3" borderId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" applyFont="1"/></cellXfs></styleSheet>'}];
  sh.forEach(function(o,i){var s=o.s,rows=(s.rows||[]).map(function(r,ri){return'<row r="'+(ri+1)+'">'+r.map(function(c,ci){if(c==null||c==='')return'';var v=c,st=0;if(typeof c==='object'){v=c.v;st=c.s||0;}if(v==null||v==='')return st?'<c r="'+colName(ci)+(ri+1)+'" s="'+st+'"/>':'';
      var ref=colName(ci)+(ri+1);return typeof v==='number'&&isFinite(v)?'<c r="'+ref+'" s="'+st+'"><v>'+v+'</v></c>':'<c r="'+ref+'" s="'+st+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEsc(v)+'</t></is></c>';}).join('')+'</row>';}).join('');
    var cols=(s.widths||[]).length?'<cols>'+s.widths.map(function(w,wi){return'<col min="'+(wi+1)+'" max="'+(wi+1)+'" width="'+w+'" customWidth="1"/>';}).join('')+'</cols>':'';
    f.push({name:'xl/worksheets/sheet'+(i+1)+'.xml',x:X+'<worksheet xmlns="'+NS+'spreadsheetml/2006/main">'+cols+'<sheetData>'+rows+'</sheetData></worksheet>'});});
  return zipStore(f,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}
function saveBlob(blob,name){var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},2000);}
function dec(h){return Math.round((h||0)*100)/100;}
function decTxt(h){return dec(h).toFixed(2).replace('.',',');}

/* ═════════════ TEMPS : feuilles de temps de l'équipe (lecture ET gestion, comme SA Platform) ═════════════ */
var DLF=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
function emptyDayFT(){return{status:'idle',tasks:[],saved:false,kmArr:'',stopFiles:[],del:[]};}
function sigT(t){return(t.start||'')+'|'+(t.lieu||'');}
/* Journal d'audit (Loi 25) : même table et même forme que SA Platform ; l'échec n'empêche jamais la correction. */
Comp.prototype.audit=function(action,rid,details){fetch(SB+'/rest/v1/audit_log',{method:'POST',headers:Object.assign({'Content-Type':'application/json',Prefer:'return=minimal'},H),
  body:JSON.stringify({acteur:this.user.id,acteur_nom:(this.user.prenom+' '+this.user.nom).trim(),action:action,ressource:'feuilles_temps',ressource_id:rid,details:details||null,appareil:'sa-admin'})}).catch(function(){});};
/* Feuilles d'une semaine, chargées à la demande (toutes les semaines sont accessibles, pas seulement les 8 dernières). */
Comp.prototype.loadWeekFT=function(wk,force){var self=this;if(!force&&this.ftw[wk]&&this.ftw[wk]!=='err')return Promise.resolve();if(this._ftwL[wk])return this._ftwL[wk];
  var p=Promise.all([get('feuilles_temps?week=eq.'+wk+'&select=*'),soft('feuilles_temps_envois?semaine=eq.'+wk+'&select=*',[])]).then(function(r){self.ftw[wk]=r[0];self.envois[wk]=r[1];delete self._ftwL[wk];self.update();})
    .catch(function(e){self.ftw[wk]='err';self.ftwErr=netMsg(e);delete self._ftwL[wk];self.update();});
  this._ftwL[wk]=p;return p;};
Comp.prototype.names=function(){var n={};(this.D?this.D.comptes:[]).forEach(function(c){n[c.id]=(c.prenom+' '+c.nom).trim();});return n;};
/* Écrit une feuille (création si l'employé n'en a pas encore cette semaine), puis rafraîchit la semaine et le tableau de bord. */
Comp.prototype.editFT=function(uid,wk,fn,okMsg,audit){var self=this;
  var nm=this.names()[uid]||uid,cp=(this.D.comptes||[]).filter(function(c){return c.id===uid;})[0]||{};
  return get('feuilles_temps?id=eq.'+encodeURIComponent(uid+'_'+wk)+'&select=id').then(function(r){if(r.length)return;var d=[];for(var i=0;i<7;i++)d.push(emptyDayFT());var now=new Date().toISOString();
      return rest('POST','feuilles_temps',{id:uid+'_'+wk,uid:uid,emp:nm,email:cp.email||'',week:wk,days:d,total_h:0,saved_at:now,updated_at:now},'resolution=ignore-duplicates,return=minimal');})
    .then(function(){return self.writeFT(uid,wk,function(days){while(days.length<7)days.push(emptyDayFT());return fn(days);});})
    .then(function(){if(audit)self.audit(audit[0],uid+'_'+wk,audit[1]);self.flash(okMsg);return Promise.all([self.loadWeekFT(wk,true),self.load()]);}).then(function(){self.update();})
    .catch(function(e){self.flash('Échec — rien n’a été modifié : '+netMsg(e));});};
function dayStatus(d){d.status=(d.tasks||[]).some(function(t){return t.active;})?'running':((d.tasks||[]).length?'done':'idle');}
Comp.prototype.openDay=function(uid,wk,di){this.setState({hj:{uid:uid,wk:wk,di:di},hp:null});this.loadWeekFT(wk);};
Comp.prototype.dayTasks=function(){var h=this.state.hj;if(!h)return[];var rows=this.ftw[h.wk];if(!Array.isArray(rows))return[];var row=rows.filter(function(r){return r.uid===h.uid;})[0];
  var d=row&&row.days&&row.days[h.di];return(d&&d.tasks)||[];};
Comp.prototype.editPunch=function(i){var t=this.dayTasks()[i];if(!t)return;this.setState({hp:{i:i,k:t.k||'',sig:sigT(t),lieu:t.lieu||'',start:t.start||'',end:t.end||'',detail:t.detail||'',odt:t.odt||'',active:!!t.active,confirm:false}});};
Comp.prototype.newPunch=function(){this.setState({hp:{i:-1,lieu:'',start:'',end:'',detail:'',odt:'',active:false,confirm:false}});};
function findT(d,p){return(d.tasks||[]).filter(function(t){return(p.k&&t.k===p.k)||sigT(t)===p.sig||(t.k0&&t.k0===p.sig);})[0]||null;}
Comp.prototype.savePunch=function(){var self=this,h=this.state.hj,p=this.state.hp;if(!h||!p)return;var lieu=String(p.lieu||'').trim(),st=String(p.start||'').trim(),en=String(p.end||'').trim();
  if(!lieu){this.flash('Le lieu ne peut pas être vide');return;}if(!HM.test(st)){this.flash('Heure de début invalide (HH:MM)');return;}if(en&&!HM.test(en)){this.flash('Heure de fin invalide (HH:MM)');return;}
  if(p.i<0&&!en){this.flash('Indiquez l’heure de fin');return;}
  this.setState({hp:null});var who=this.user.id,now=new Date().toISOString();
  this.editFT(h.uid,h.wk,function(days){var d=days[h.di]||(days[h.di]=emptyDayFT());d.tasks=d.tasks||[];var t;
    if(p.i<0){var mx=0;days.forEach(function(dd){(dd.tasks||[]).forEach(function(x){if(typeof x.id==='number'&&x.id>mx)mx=x.id;});});
      t={id:mx+1,lieu:lieu,start:st,end:en,hrs:hrsFrom(st,en),active:false,detail:String(p.detail||'').trim(),odt:String(p.odt||'').trim(),addr:'',files:[],gps:null,ajoutePar:who,ajouteLe:now};
      t.k=Date.now().toString(36)+Math.random().toString(36).slice(2,6);t.k0=sigT(t);t.mod=Date.now();d.tasks.push(t);d.tasks.sort(function(a,b){return(a.start||'').localeCompare(b.start||'');});}
    else{t=findT(d,p);if(!t)throw new Error('punch introuvable — la feuille a changé');marquerModif(t);t.lieu=lieu;t.start=st;t.detail=String(p.detail||'').trim();t.odt=String(p.odt||'').trim();
      if(en){t.end=en;t.active=false;}if(t.end&&!t.active)t.hrs=hrsFrom(t.start,t.end);t.pendingValidation=false;t.autoClosed=false;t.correctedBy=who;t.correctedAt=now;}
    dayStatus(d);return days;},p.i<0?'Punch ajouté':'Punch corrigé',['MODIFICATION',{action:p.i<0?'ajout_punch':'correction_punch',jour:h.di,lieu:lieu,debut:st,fin:en}]);};
Comp.prototype.delPunch=function(){var h=this.state.hj,p=this.state.hp;if(!h||!p||p.i<0)return;if(!p.confirm){this.setState({hp:Object.assign({},p,{confirm:true})});return;}
  this.setState({hp:null});
  this.editFT(h.uid,h.wk,function(days){var d=days[h.di];var t=d&&findT(d,p);if(!t)throw new Error('punch introuvable — la feuille a changé');
    d.del=d.del||[];d.del.push({k:t.k||'',sig:sigT(t),at:Date.now()});d.tasks=d.tasks.filter(function(x){return x!==t;});dayStatus(d);return days;},'Punch supprimé',['SUPPRESSION',{action:'suppression_punch',jour:h.di,lieu:p.lieu,debut:p.start}]);};
Comp.prototype.approve=function(uid,wk,di){var who=this.user.id,now=new Date().toISOString(),n=0;
  this.editFT(uid,wk,function(days){days.forEach(function(d,i){if(di!=null&&i!==di)return;(d.tasks||[]).forEach(function(t){if(t.active)return;marquerModif(t);t.approuve=true;t.approuvePar=who;t.approuveLe=now;n++;});});return days;},
    di==null?'Semaine approuvée':'Journée approuvée',['MODIFICATION',{action:di==null?'approbation_semaine':'approbation',jour:di}]);};

/* Agrégation d'une semaine — mêmes règles que SA Platform : heures des punchs terminés ; 40 h régulières, le reste en supplémentaire ;
   feuille « synthèse » = punchs d'un même jour sur un même job (lieu + ODT) regroupés en une ligne. */
Comp.prototype.weekData=function(wk){var D=this.D,rows=Array.isArray(this.ftw[wk])?this.ftw[wk]:[],by={};rows.forEach(function(r){by[r.uid]=r;});
  var st=D.statut,emps=D.comptes.filter(function(c){return c.role!=='admin'&&(st[c.id]!=='inactif'||by[c.id]);}),env={};(this.envois[wk]||[]).forEach(function(e){env[e.uid]=e;});
  return emps.map(function(c){var row=by[c.id],jours=[],tot=0,nbP=0,nbAV=0,enCours=false,ap=true,any=false,punchs=[];
    for(var i=0;i<7;i++){var d=row&&row.days&&row.days[i],ts=(d&&d.tasks)||[],h=0,live=false,dap=true;
      ts.forEach(function(t,ti){var act=!!(t.active||!t.end);if(act){live=true;enCours=true;}else h+=Number(t.hrs)||0;nbP++;any=true;if(t.pendingValidation)nbAV++;if(!t.approuve&&!act){dap=false;ap=false;}
        punchs.push({di:i,lieu:t.lieu||'—',odt:t.odt||'',detail:t.detail||'',start:t.start||'',end:t.end||'',hrs:act?0:(Number(t.hrs)||0),act:act,av:!!t.pendingValidation,ap:!!t.approuve});});
      tot+=h;jours.push({h:h,nb:ts.length,live:live,ap:ts.length>0&&dap});}
    return{id:c.id,nom:(c.prenom+' '+c.nom).trim()+(st[c.id]==='inactif'?' (inactif)':''),email:c.email||'',jours:jours,total:tot,reg:Math.min(tot,40),supp:Math.max(0,tot-40),nbPunchs:nbP,nbAV:nbAV,enCours:enCours,approuvee:any&&ap,any:any,punchs:punchs,envoi:env[c.id]||null};});};
function grouperJour(ps){var m={},o=[];ps.forEach(function(p){var k=norm(p.lieu)+'|'+p.odt;if(!m[k]){m[k]={lieu:p.lieu,odt:p.odt,detail:p.detail,debut:p.start,fin:p.end,h:0,nb:0,act:false,av:false};o.push(k);}
  var l=m[k];l.nb++;if(p.act)l.act=true;else l.h+=p.hrs;if(p.start&&(!l.debut||p.start<l.debut))l.debut=p.start;if(p.end&&(!l.fin||p.end>l.fin))l.fin=p.end;if(!l.detail&&p.detail)l.detail=p.detail;if(p.av)l.av=true;});
  return o.map(function(k){return m[k];}).sort(function(a,b){return(a.debut||'').localeCompare(b.debut||'');});}
Comp.prototype.paieSel=function(wk,data){var s=this.state.paieSel[wk];if(!s){s={};data.forEach(function(e){s[e.id]=e.any&&!e.enCours;});}return s;};
Comp.prototype.exportPaie=function(only){var wk=iso(addDays(mondayOf(new Date()),7*this.state.tOff)),data=this.weekData(wk),sel=this.paieSel(wk,data),emps=data.filter(function(e){return(only?e.id===only:sel[e.id])&&e.any;});
  if(!emps.length){this.flash('Sélectionnez au moins un employé qui a des heures');return;}
  var H1=function(v){return{v:v,s:1};},N=function(v){return{v:dec(v),s:3};},T=function(v){return{v:v,s:4};},mon=new Date(wk+'T12:00:00'),fin=addDays(mon,6);
  var titre='Feuilles de temps — semaine du '+fdate(wk)+' au '+fdate(iso(fin));
  var som=[[{v:'Soucy Aquatik — '+titre,s:5}],[],[H1('Employé'),H1('Heures'),H1('Régulières'),H1('Supplémentaires'),H1('Punchs'),H1('À valider'),H1('Statut')]];
  var tt=0,tr=0,ts=0;emps.forEach(function(e){tt+=e.total;tr+=e.reg;ts+=e.supp;som.push([e.nom,N(e.total),N(e.reg),N(e.supp),e.nbPunchs,e.nbAV||'',e.enCours?'Punch en cours':e.approuvee?'Approuvée':'']);});
  som.push([{v:'Total équipe',s:2},T(dec(tt)),T(dec(tr)),T(dec(ts))]);
  var sheets=[{name:'Sommaire',widths:[30,12,12,16,9,11,16],rows:som}];
  emps.forEach(function(e){var r=[[{v:e.nom+' — '+titre,s:5}],[],[H1('Jour'),H1('Date'),H1('Lieu / site'),H1('ODT'),H1('Détail'),H1('Début'),H1('Fin'),H1('Heures'),H1('Punchs'),H1('Note')]];
    for(var i=0;i<7;i++){var lines=grouperJour(e.punchs.filter(function(p){return p.di===i;}));lines.forEach(function(l){r.push([DLF[i],iso(addDays(mon,i)),l.lieu,l.odt,l.detail,l.debut,l.act?'en cours':l.fin,N(l.h),l.nb,[l.av?'à valider':'',l.act?'punch en cours':''].filter(Boolean).join(', ')]);});}
    r.push([]);r.push([{v:'Total',s:2},'','','','','','',T(dec(e.total))]);r.push(['Régulières','','','','','','',N(e.reg)]);r.push(['Supplémentaires','','','','','','',N(e.supp)]);
    sheets.push({name:e.nom,widths:[11,11,32,10,30,8,10,9,8,16],rows:r});});
  var j=[[H1('Employé'),H1('Jour'),H1('Date'),H1('Début'),H1('Fin'),H1('Heures'),H1('Lieu'),H1('ODT'),H1('Détail'),H1('Approuvé')]];
  emps.forEach(function(e){e.punchs.forEach(function(p){j.push([e.nom,DLF[p.di],iso(addDays(mon,p.di)),p.start,p.act?'en cours':p.end,N(p.hrs),p.lieu,p.odt,p.detail,p.ap?'oui':'']);});});
  sheets.push({name:'Journal des punchs',widths:[24,10,11,7,9,8,32,10,30,9],rows:j});
  saveBlob(xlsxBlob(sheets),'SoucyAquatik_Feuilles_de_temps_'+wk+'.xlsx');this.audit('EXPORT',wk,{action:'sortie_feuilles_temps',format:'xlsx',employes:emps.map(function(e){return e.id;})});
  this.flash('Fichier Excel téléchargé — '+emps.length+' employé(s)');};
Comp.prototype.markSent=function(methode,only){var self=this,wk=iso(addDays(mondayOf(new Date()),7*this.state.tOff)),data=this.weekData(wk),sel=this.paieSel(wk,data),emps=data.filter(function(e){return(only?e.id===only:sel[e.id])&&e.any;}),now=new Date().toISOString();
  if(!emps.length){this.flash('Sélectionnez au moins un employé');return;}
  rest('POST','feuilles_temps_envois',emps.map(function(e){return{id:e.id+'_'+wk,uid:e.id,emp:e.nom,semaine:wk,email:e.email,methode:methode||'sa-admin',punchs:e.nbPunchs,heures:dec(e.total),par:self.user.id,le:now,updated_at:now};}),'resolution=merge-duplicates,return=minimal')
    .then(function(){self.flash(emps.length+' feuille(s) marquée(s) envoyée(s) à la paie');return self.loadWeekFT(wk,true);}).catch(function(e){self.flash('Échec : '+netMsg(e));});};
/* Courriel — comme SA Platform : l'app n'a pas accès à un serveur de courriel, elle ouvre le logiciel de courriel installé
   (Outlook, Mail…) avec un message prêt ; le fichier Excel vient d'être téléchargé, il reste à le joindre. */
function mailto(to,sujet,corps){var u='mailto:'+encodeURIComponent(to||'').replace(/%40/g,'@')+'?subject='+encodeURIComponent(sujet)+'&body='+encodeURIComponent(corps);if(window.__openMail)return window.__openMail(u);/* point d'observation pour les tests */try{window.location.href=u;}catch(e){window.open(u,'_blank');}}
function emailPaie(){try{return localStorage.getItem('sa_admin_email_paie')||'';}catch(e){return '';}}
Comp.prototype.mailPaie=function(only){var wk=iso(addDays(mondayOf(new Date()),7*this.state.tOff)),data=this.weekData(wk),sel=this.paieSel(wk,data),emps=data.filter(function(e){return(only?e.id===only:sel[e.id])&&e.any;});
  if(!emps.length){this.flash('Sélectionnez au moins un employé');return;}var fin=iso(addDays(new Date(wk+'T12:00:00'),6)),tt=0;
  var b='Bonjour,\n\nVoici les feuilles de temps de la semaine du '+wk+' au '+fin+'.\n\n';
  emps.forEach(function(e){tt+=e.total;b+='• '+e.nom+' : '+decTxt(e.total)+' h (régulières '+decTxt(e.reg)+(e.supp>0?', supplémentaires '+decTxt(e.supp):'')+')'+(e.enCours?' — punch encore en cours':'')+(e.nbAV?' — '+e.nbAV+' punch(s) à valider':'')+'\n';});
  b+='\nTotal de l’équipe : '+decTxt(tt)+' h\n\nLe détail complet est dans le fichier Excel joint.\n\nMerci.';
  this.exportPaie(only);mailto(this.state.emailPaie!=null?this.state.emailPaie:emailPaie(),(only?'Feuille de temps — '+emps[0].nom+' — ':'Feuilles de temps — ')+'semaine du '+wk,b);this.markSent('courriel',only);};
Comp.prototype.mailEmp=function(id){var wk=iso(addDays(mondayOf(new Date()),7*this.state.tOff)),e=this.weekData(wk).filter(function(x){return x.id===id;})[0];if(!e)return;
  if(!e.email)this.flash('Aucun courriel dans le compte de '+e.nom+' — ajoutez-le dans Comptes (le message s’ouvre quand même)');var mon=new Date(wk+'T12:00:00');
  var b='Bonjour '+e.nom.split(' ')[0]+',\n\nVoici ta feuille de temps pour la semaine du '+wk+' au '+iso(addDays(mon,6))+'.\n\nTotal : '+decTxt(e.total)+' h (régulières '+decTxt(e.reg)+(e.supp>0?', supplémentaires '+decTxt(e.supp):'')+')\n';
  for(var i=0;i<7;i++){var ps=e.punchs.filter(function(p){return p.di===i;});if(!ps.length)continue;b+='\n'+DLF[i]+' '+iso(addDays(mon,i))+'\n';
    grouperJour(ps).forEach(function(l){b+='   • '+l.lieu+(l.odt?' ['+l.odt+']':'')+' : '+l.debut+' → '+(l.act?'en cours':l.fin)+' = '+decTxt(l.h)+' h\n';});}
  b+='\nSi quelque chose ne correspond pas, dis-le-moi avant l’envoi à la paie.\n\nMerci.';
  mailto(e.email,'Ta feuille de temps — semaine du '+wk,b);auditT(this,'EXPORT','feuilles_temps',e.id+'_'+wk,{action:'courriel_employe'});};
Comp.prototype.printPaie=function(only){var wk=iso(addDays(mondayOf(new Date()),7*this.state.tOff)),data=this.weekData(wk),sel=this.paieSel(wk,data),emps=data.filter(function(e){return(only?e.id===only:sel[e.id])&&e.any;}),mon=new Date(wk+'T12:00:00');
  if(!emps.length){this.flash('Sélectionnez au moins un employé');return;}
  var E=function(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});};
  var h='<!doctype html><meta charset="utf-8"><title>Feuilles de temps '+wk+'</title><style>body{font:12px Arial,sans-serif;margin:18px}h2{margin:0 0 4px;font-size:17px}table{border-collapse:collapse;width:100%;margin:6px 0 4px}td,th{border:1px solid #bbb;padding:3px 6px;text-align:left}th{background:#e8f2fb}.n{text-align:right}section{page-break-after:always}.s{margin-top:26px;display:flex;gap:40px}.s div{border-top:1px solid #555;flex:1;padding-top:3px;font-size:10px}</style>';
  emps.forEach(function(e){h+='<section><h2>'+E(e.nom)+'</h2><div>Semaine du '+fdate(wk)+' au '+fdate(iso(addDays(mon,6)))+' · Total '+decTxt(e.total)+' h (régulières '+decTxt(e.reg)+' · supplémentaires '+decTxt(e.supp)+')</div><table><tr><th>Jour</th><th>Lieu</th><th>ODT</th><th>Début</th><th>Fin</th><th class="n">Heures</th></tr>';
    for(var i=0;i<7;i++)grouperJour(e.punchs.filter(function(p){return p.di===i;})).forEach(function(l){h+='<tr><td>'+DLF[i]+' '+addDays(mon,i).getDate()+'</td><td>'+E(l.lieu)+'</td><td>'+E(l.odt)+'</td><td>'+E(l.debut)+'</td><td>'+(l.act?'en cours':E(l.fin))+'</td><td class="n">'+decTxt(l.h)+'</td></tr>';});
    h+='</table><div class="s"><div>Signature de l’employé</div><div>Signature du superviseur</div></div></section>';});
  var w=window.open('','_blank');if(!w){this.flash('Fenêtre bloquée — autorisez les fenêtres pour imprimer');return;}w.document.write(h+'<script>setTimeout(function(){print();},300)<\/script>');w.document.close();};
/* Rapport d'équipe — même format que SA Platform (« Copier pour Claude ») : une ligne par punch, données brutes, totaux,
   comparaison avec la semaine précédente ; plus le contexte bons de travail / stock. Avec prompt=true, une demande d'analyse en tête. */
var CLAUDE_PROMPT='Tu es l’assistant de gestion de Soucy Aquatik (entretien de piscines et de salles mécaniques). Analyse les données brutes ci-dessous et réponds en français, de façon concise :\n'
  +'1. Heures : total, heures supplémentaires par employé, écarts marqués avec la semaine précédente et causes probables.\n'
  +'2. Anomalies : punchs très longs ou très courts, punchs en cours ou fermés automatiquement, lieux inhabituels, ODT manquants, trous dans les journées.\n'
  +'3. Charge : sites qui prennent le plus de temps, répartition entre employés, déplacements (km).\n'
  +'4. Bons de travail et stock : urgences ouvertes, retards, produits sous le seuil.\n'
  +'5. Trois actions concrètes recommandées pour la semaine prochaine.\n'
  +'N’invente aucune donnée : si une information manque, dis-le.\n\n';
Comp.prototype.teamReport=function(wk,prompt){var self=this,D=this.D,data=this.weekData(wk).filter(function(e){return e.any;});if(!data.length)return null;
  var prev=iso(addDays(new Date(wk+'T12:00:00'),-7)),prevRows=Array.isArray(this.ftw[prev])?this.ftw[prev]:null,raw=Array.isArray(this.ftw[wk])?this.ftw[wk]:[],by={};raw.forEach(function(r){by[r.uid]=r;});
  var prevTot=function(uid){var r=prevRows&&prevRows.filter(function(x){return x.uid===uid;})[0],h=0;if(r)(r.days||[]).forEach(function(d){((d&&d.tasks)||[]).forEach(function(t){h+=Number(t.hrs)||0;});});return h;};
  var L=[];if(prompt)L.push(CLAUDE_PROMPT);
  L.push('DONNÉES BRUTES — FEUILLES DE TEMPS SOUCY AQUATIK','Semaine du '+fdate(wk)+' au '+fdate(iso(addDays(new Date(wk+'T12:00:00'),6)))+' | '+data.length+' employé(s) actif(s) | Généré le '+new Date().toLocaleString('fr-CA'),
    'Note: aucune interprétation faite ici — lieu/adresse/durée/km bruts, tels que saisis par les employés. Notes et photos de chantier exclues.','','── PUNCHS (une ligne par tâche) ──','Employé | Jour | Début | Fin | Durée | Lieu | Adresse | ODT | Détail | Km');
  data.forEach(function(e){var row=by[e.id];for(var i=0;i<7;i++){((row&&row.days&&row.days[i]&&row.days[i].tasks)||[]).forEach(function(t){var act=!!(t.active||!t.end);
    var km=(t.kmDep&&t.kmArr)?Math.round(Math.abs(parseFloat(t.kmArr)-parseFloat(t.kmDep))):'';
    L.push([e.nom,DLF[i],t.start||'',act?'(en cours)':(t.end||''),fmtH(act?0:(Number(t.hrs)||0)),t.lieu||'—',t.addr||'',t.odt||'',t.detail||'',km].join(' | '));});}});
  L.push('','── TOTAUX PAR EMPLOYÉ ──');var tt=0,tr=0,ts=0,tp=0;
  data.forEach(function(e){var ph=prevTot(e.id);tt+=e.total;tr+=e.reg;ts+=e.supp;tp+=ph;L.push(e.nom+' | Total: '+fmtH(e.total)+' | Régulier: '+fmtH(e.reg)+' | Supp: '+fmtH(e.supp)+' | Punchs: '+e.nbPunchs+(e.nbAV?' | À valider: '+e.nbAV:'')+' | Sem. préc. ('+fdate(prev)+'): '+(prevRows?fmtH(ph):'non chargée'));});
  L.push('','── TOTAL ÉQUIPE ──','Total: '+fmtH(tt)+' | Régulier: '+fmtH(tr)+' | Supplémentaire: '+fmtH(ts)+' (ratio '+(tt>0?(ts/tt*100).toFixed(1):'0')+'%)');
  if(prevRows)L.push('Semaine précédente ('+fdate(prev)+', mêmes employés): '+fmtH(tp)+' | Δ: '+(tt>=tp?'+':'-')+fmtH(Math.abs(tt-tp)));
  var open=D.wo.filter(function(w){return!woDone(w.status);}),nm=this.names();
  L.push('','── BONS DE TRAVAIL OUVERTS ('+open.length+') ──','Date | Client | Type | Priorité | Statut | Assigné');
  open.slice(0,60).forEach(function(w){L.push([w.date||'',w.client||'',w.type||'',w.priorite||'',w.status||'',String(w.assigne||'').split(',').map(function(x){x=x.trim();return nm[x]||x;}).join(', ')].join(' | '));});
  var low=(D.inv||[]).filter(function(i){return Number(i.seuil)>0&&Number(i.qte)<=Number(i.seuil);});
  L.push('','── STOCK SOUS LE SEUIL ('+low.length+') ──');low.forEach(function(i){L.push(i.nom+' | Qté: '+i.qte+' | Seuil: '+i.seuil);});
  L.push('','---','Soucy Aquatik · sa-admin');return L.join('\n');};

/* ═════════════ Éditeur complet : bon de travail · créneau · tâche planning (mêmes champs que SA Platform) ═════════════ */
var WO_TYPES=[['installation','Installation'],['entretien','Entretien'],['reparation','Réparation'],['inspection','Inspection'],['miseeneau','Mise en eau'],['autre','Autre']];
var WO_PRIO=[['normal','Normal'],['urgent','Urgent'],['planifie','Planifié']];
var WO_STAT=[['ouvert','Ouvert'],['en_cours','En cours'],['complete','Complété'],['facture','Facturé']];
var PM_TYPES=[['entretien','Entretien'],['installation','Installation'],['reparation','Réparation'],['inspection','Inspection'],['livraison','Livraison'],['autre','Autre']];
var PT_STAT=[['assigne','Assigné'],['approuve','Approuvé'],['en_attente','En attente'],['termine','Terminé'],['refuse','Refusé'],['annule','Annulé']];
var FE_KIND={wo:['workorders','Bon de travail','bons de travail'],plan:['plan','Créneau','créneaux'],pt:['planning_tasks','Tâche planning','tâches planning']};
function woDone(s){return s==='complete'||s==='facture'||s==='termine';}
function splitIds(s){return String(s||'').split(/,\s*/).filter(Boolean);}
function auditT(self,action,table,id,details){fetch(SB+'/rest/v1/audit_log',{method:'POST',headers:Object.assign({'Content-Type':'application/json',Prefer:'return=minimal'},H),
  body:JSON.stringify({acteur:self.user.id,acteur_nom:(self.user.prenom+' '+self.user.nom).trim(),action:action,ressource:table,ressource_id:id,details:details||null,appareil:'sa-admin'})}).catch(function(){});}
Comp.prototype.openFE=function(kind,id,preset){var self=this,p=preset||{},today=iso(new Date());
  var blank={wo:{client:'',site:'',type:'entretien',priorite:'normal',status:'ouvert',assignes:[],descr:'',notes:'',tasks:[],files:[],req_bassin:false,req_photo:false,req_notes:false,date:today,groupe_id:null},
    plan:{client:'',addr:'',site_id:null,heure:'07:00',emps:[],type:'entretien',descr:'',notes:'',wo_id:'',status:'assigned',date:today},
    pt:{titre:'',descr:'',emps:[],site_id:'',site_nom:'',date_debut:today,date_fin:today,heure_debut:'',heure_fin:'',statut:'assigne',recurrence:null}}[kind];
  if(!id){var f=Object.assign({},blank);
    if(p.site){var s=this.D.byId[p.site];if(s){if(kind==='wo'){f.client=s.nom;f.site=s.addr;}else if(kind==='plan'){f.client=s.nom;f.addr=s.addr;f.site_id=s.id;}else{f.site_id=s.id;f.site_nom=s.nom;f.titre=s.nom;}}}
    if(p.client&&kind==='wo'){f.client=p.client;f.site=p.siteAddr||f.site;}
    if(p.tech){if(kind==='wo')f.assignes=[p.tech];else f.emps=[p.tech];}
    var d0=p.debut||today;if(kind==='pt'){f.date_debut=d0;f.date_fin=d0;}else f.date=d0;
    this.setState({fe:{kind:kind,id:null,f:f,when:{mode:'jour',debut:d0,fin:'',rec:'hebdo',jours:{}},indep:false,busy:false,confirm:0,taskIn:''}});return;}
  this.setState({fe:{kind:kind,id:id,loading:true}});
  get(FE_KIND[kind][0]+'?id=eq.'+encodeURIComponent(id)+'&select=*').then(function(r){var x=r[0];if(!x){self.setState({fe:null});self.flash('Élément introuvable');return;}
    var f=Object.assign({},blank,x);if(kind==='wo'){f.assignes=(x.assignes&&x.assignes.length?x.assignes:splitIds(x.assigne));f.tasks=(x.tasks||[]).slice();f.files=(x.files||[]).slice();if(x.status==='termine')f.status='complete';}
    else f.emps=splitIds(x.emp);
    self.setState({fe:{kind:kind,id:id,f:f,orig:x,busy:false,confirm:0,taskIn:''}});}).catch(function(e){self.setState({fe:null});self.flash('Erreur : '+netMsg(e));});};
Comp.prototype.feSet=function(k,v){var fe=this.state.fe,o={};o[k]=v;this.setState({fe:Object.assign({},fe,{f:Object.assign({},fe.f,o),confirm:0})});};
Comp.prototype.feDates=function(){var fe=this.state.fe,w=fe.when;if(fe.id)return[fe.kind==='pt'?fe.f.date_debut:fe.f.date];if(!w.debut)return[];
  if(w.mode==='jour')return[w.debut];
  if(w.mode==='plage'){if(!w.fin||w.fin<w.debut)return[];var out=[],d=new Date(w.debut+'T12:00:00'),e=new Date(w.fin+'T12:00:00');for(;d<=e&&out.length<120;d.setDate(d.getDate()+1))out.push(iso(d));return out;}
  return occurrences({debut:w.debut,fin:w.fin,rec:w.rec,jours:w.jours}).map(iso);};
Comp.prototype.feSave=function(){var self=this,fe=this.state.fe;if(!fe||fe.busy||fe.loading)return;var f=fe.f,k=fe.kind,tb=FE_KIND[k][0],now=new Date().toISOString(),D=this.D,names=this.names();
  var nm=function(ids){return ids.map(function(i){return names[i]||i;}).join(', ');};
  if(k==='wo'&&!String(f.client).trim()){this.flash('Le client est requis');return;}
  if(k==='plan'&&!String(f.client).trim()&&!f.wo_id){this.flash('Indiquez le client / site, ou liez un bon de travail');return;}
  if(k==='pt'&&!String(f.titre).trim()){this.flash('Le titre est requis');return;}
  if(k==='pt'&&(!f.date_debut||!f.date_fin||f.date_fin<f.date_debut)){this.flash('Dates invalides (la fin doit suivre le début)');return;}
  var site=D.sites.filter(function(s){return norm(s.nom)===norm(k==='pt'?f.site_nom:f.client);})[0]||(f.site_id&&D.byId[f.site_id])||null;
  var body;
  if(k==='wo')body={client:String(f.client).trim(),site:String(f.site||'').trim(),type:f.type,priorite:f.priorite,status:f.status,assignes:f.assignes,assigne:f.assignes.join(', '),descr:String(f.descr||'').trim(),notes:String(f.notes||'').trim(),
    tasks:f.tasks,files:f.files,req_bassin:!!f.req_bassin,req_photo:!!f.req_photo,req_notes:!!f.req_notes,updated_at:now};
  else if(k==='plan')body={client:String(f.client||'').trim(),addr:String(f.addr||'').trim()||(site?site.addr:''),site_id:site?site.id:(f.site_id||null),heure:f.heure||'',emps:f.emps,emp:f.emps.join(', '),type:f.type,descr:String(f.descr||'').trim(),notes:String(f.notes||''),wo_id:f.wo_id||null,status:f.status||'assigned',updated_at:now};
  else body={titre:String(f.titre).trim(),descr:String(f.descr||'').trim(),emp:f.emps.join(', '),emp_nom:nm(f.emps),site_id:site?site.id:'',site_nom:site?site.nom:String(f.site_nom||'').trim(),heure_debut:f.heure_debut||'',heure_fin:f.heure_fin||'',statut:f.statut,updated_at:now};
  var done=function(msg){self.pl={};self._pl={};self.setState({fe:null});self.flash(msg);return self.load().then(function(){self.update();});};
  var fail=function(e){self.setState({fe:Object.assign({},self.state.fe,{busy:false})});self.flash('Échec — rien n’a été modifié : '+netMsg(e));};
  this.setState({fe:Object.assign({},fe,{busy:true})});
  if(fe.id){if(k==='pt'){body.date_debut=f.date_debut;body.date_fin=f.date_fin;}else body.date=f.date;
    rest('PATCH',tb+'?id=eq.'+encodeURIComponent(fe.id),body).then(function(rows){if(!rows.length)throw new Error('élément introuvable');auditT(self,'MODIFICATION',tb,fe.id);return done(FE_KIND[k][1]+' enregistré'+(k==='pt'?'e':''));}).catch(fail);return;}
  var dates=this.feDates();if(!dates.length){this.setState({fe:Object.assign({},fe,{busy:false})});this.flash('Choisissez la ou les dates');return;}
  var rid=function(){return'adm-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);},rows=[],gid=dates.length>1?('g'+Date.now().toString(36)):null;
  if(k==='pt'&&fe.when.mode==='plage'){dates=[fe.when.debut];}
  dates.forEach(function(d){
    if(k==='wo')rows.push(Object.assign({id:rid(),date:d,groupe_id:gid,created_at:now,created_by:self.user.id},body));
    else if(k==='plan')rows.push(Object.assign({id:rid(),date:d},body));
    else{var fin=fe.when.mode==='plage'?fe.when.fin:d,serie=gid?{serie:gid,freq:fe.when.rec,fin:fe.when.fin||null}:null;
      var groups=(fe.indep&&f.emps.length>1)?f.emps.map(function(e){return[e];}):[f.emps];
      groups.forEach(function(g){rows.push(Object.assign({},body,{id:rid(),emp:g.join(', '),emp_nom:nm(g),date_debut:d,date_fin:fin,recurrence:serie,created_by:self.user.id,created_at:now}));});}});
  postRows(tb,rows).then(function(ins){ins.forEach(function(r){auditT(self,'CREATION',tb,r.id);});return done(ins.length>1?ins.length+' '+FE_KIND[k][2]+' créé'+(k==='pt'?'e':'')+'s':FE_KIND[k][1]+' créé'+(k==='pt'?'e':''));}).catch(fail);};
Comp.prototype.feDelete=function(level){var self=this,fe=this.state.fe;if(!fe||!fe.id||fe.busy)return;if(fe.confirm!==level){this.setState({fe:Object.assign({},fe,{confirm:level})});return;}
  var tb=FE_KIND[fe.kind][0],td=iso(new Date()),path=tb+'?id=eq.'+encodeURIComponent(fe.id);
  if(level===2){if(fe.kind==='wo')path='workorders?groupe_id=eq.'+encodeURIComponent(fe.f.groupe_id)+'&status=eq.ouvert&date=gte.'+td;else path='planning_tasks?recurrence->>serie=eq.'+encodeURIComponent(fe.f.recurrence.serie)+'&statut=eq.assigne&date_debut=gte.'+td;}
  this.setState({fe:Object.assign({},fe,{busy:true})});
  rest('DELETE',path).then(function(rows){rows.forEach(function(r){auditT(self,'SUPPRESSION',tb,r.id);});self.pl={};self._pl={};self.setState({fe:null});self.flash(rows.length+' supprimé'+(rows.length>1?'s':'')+' — une copie de sécurité est conservée');return self.load().then(function(){self.update();});})
    .catch(function(e){self.setState({fe:Object.assign({},self.state.fe,{busy:false})});self.flash('Échec — rien n’a été supprimé : '+netMsg(e));});};
/* Pièce jointe : image recompressée (comme au terrain), PDF gardé tel quel s'il reste raisonnable */
Comp.prototype.feAddFile=function(){var self=this,inp=document.createElement('input');inp.type='file';inp.accept='image/*,application/pdf';inp.onchange=function(){var file=inp.files&&inp.files[0];if(!file)return;
  var add=function(data){var fe=self.state.fe;self.feSet('files',(fe.f.files||[]).concat([{data:data,name:file.name,addedBy:self.user.id,addedAt:new Date().toISOString()}]));};
  if(/^image\//.test(file.type)){var img=new Image(),u=URL.createObjectURL(file);img.onload=function(){var k=Math.min(1,1400/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);add(c.toDataURL('image/jpeg',0.7));};img.src=u;}
  else{if(file.size>2e6){self.flash('PDF trop volumineux (max 2 Mo)');return;}var rd=new FileReader();rd.onload=function(){add(rd.result);};rd.readAsDataURL(file);}};inp.click();};
Comp.prototype.printWO=function(){var fe=this.state.fe;if(!fe||fe.kind!=='wo')return;var f=fe.f,names=this.names(),E=function(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});};
  var lab=function(L,v){return(L.filter(function(x){return x[0]===v;})[0]||['',v])[1];},done=f.tasks.filter(function(t){return t.done;}).length;
  var h='<!doctype html><meta charset="utf-8"><title>Bon de travail — '+E(f.client)+'</title><style>body{font:13px Arial,sans-serif;margin:24px}h1{font-size:20px;margin:0 0 4px}.m{display:flex;gap:22px;flex-wrap:wrap;margin:8px 0 14px}h2{font-size:14px;background:#e8f2fb;padding:5px 8px;margin:16px 0 0}.b{border:1px solid #c5d8ec;border-top:0;padding:8px;white-space:pre-wrap}table{border-collapse:collapse;width:100%}td{border:1px solid #c5d8ec;padding:4px 8px}.s{margin-top:34px;display:flex;gap:50px}.s div{border-top:1px solid #333;width:240px;font-size:11px;padding-top:3px}</style>'
    +'<h1>Bon de travail — '+E(f.client)+'</h1><div>'+E(lab(WO_TYPES,f.type))+' · Priorité '+E(lab(WO_PRIO,f.priorite))+' · '+E(lab(WO_STAT,f.status))+'</div>'
    +'<div class="m"><span><b>Site :</b> '+E(f.site||'—')+'</span><span><b>Date :</b> '+E(fdate(f.date))+'</span><span><b>Assigné(s) :</b> '+E(f.assignes.map(function(i){return names[i]||i;}).join(', ')||'—')+'</span></div>'
    +(f.descr?'<h2>Travaux à effectuer</h2><div class="b">'+E(f.descr)+'</div>':'')
    +(f.tasks.length?'<h2>Tâches ('+done+'/'+f.tasks.length+')</h2><table>'+f.tasks.map(function(t){return'<tr><td style="width:24px;text-align:center">'+(t.done?'☑':'☐')+'</td><td>'+E(t.label)+'</td></tr>';}).join('')+'</table>':'')
    +(f.notes?'<h2>Notes techniques</h2><div class="b">'+E(f.notes)+'</div>':'')+'<div class="s"><div>Signature (nom et prénom)</div><div>Date</div></div>';
  var w=window.open('','_blank');if(!w){this.flash('Fenêtre bloquée — autorisez les fenêtres pour imprimer');return;}w.document.write(h+'<script>setTimeout(function(){print();},300)<\/script>');w.document.close();};
Comp.prototype.feVals=function(){var self=this,fe=this.state.fe,D=this.D;if(!fe)return{feOpen:false};
  if(fe.loading)return{feOpen:true,feLoading:true,feReady:false,feTitle:'Chargement…',feClose:function(){self.setState({fe:null});},feCloseBg:function(e){if(e.target===e.currentTarget)self.setState({fe:null});}};
  var f=fe.f,k=fe.kind,isNew=!fe.id,set=function(key){return function(e){self.feSet(key,e.target.type==='checkbox'?e.target.checked:e.target.value);};};
  var opts=function(L,v){return L.map(function(x){return{v:x[0],l:x[1],sel:x[0]===v};});};
  var ids=k==='wo'?f.assignes:f.emps,techs=D.comptes.filter(function(c){return c.role!=='admin'&&(D.statut[c.id]!=='inactif'||ids.indexOf(c.id)>=0);});
  var dates=this.feDates(),w=fe.when||{};
  var setW=function(key,v){self.setState({fe:Object.assign({},self.state.fe,{when:Object.assign({},self.state.fe.when,(function(){var o={};o[key]=v;return o;})())})});};
  var DLd=[['L',1],['M',2],['M',3],['J',4],['V',5],['S',6],['D',0]];
  var linked=k==='plan'?D.wo.filter(function(x){return!woDone(x.status);}).slice(0,200).map(function(x){return{v:x.id,l:x.client+' · '+fdate(x.date),sel:x.id===f.wo_id};}):[];
  return{feOpen:true,feLoading:false,feReady:true,feNew:isNew,feTitle:(isNew?'Nouveau · ':'')+FE_KIND[k][1]+(isNew?'':' — '+(f.client||f.titre||'')),isWO:k==='wo',isPlanF:k==='plan',isPT:k==='pt',
    feKinds:isNew?[['wo','Bon de travail'],['plan','Créneau'],['pt','Tâche planning']].map(function(x){return Object.assign({label:x[1],go:function(){self.openFE(x[0],null,{debut:w.debut,tech:(ids||[])[0],site:self.state.fe.f.site_id||null});}},segS(k===x[0]));}):[],
    sitesList:D.sites.map(function(s){return{v:s.nom};}),
    fClient:f.client||'',onClient:function(e){var v=e.target.value,s=D.sites.filter(function(x){return norm(x.nom)===norm(v);})[0],o={client:v};if(s){if(k==='wo'&&!self.state.fe.f.site)o.site=s.addr;if(k==='plan'){o.addr=s.addr;o.site_id=s.id;}}
      self.setState({fe:Object.assign({},self.state.fe,{f:Object.assign({},self.state.fe.f,o),confirm:0})});},
    fSite:f.site||'',onSite:set('site'),fAddr:f.addr||'',onAddr:set('addr'),fTitre:f.titre||'',onTitre:set('titre'),fSiteNom:f.site_nom||'',onSiteNom:set('site_nom'),
    fTypes:opts(k==='plan'?PM_TYPES:WO_TYPES,f.type),onType:set('type'),fPrios:opts(WO_PRIO,f.priorite),onPrio:set('priorite'),
    fStats:k==='wo'?opts(WO_STAT,f.status):k==='pt'?opts(PT_STAT,f.statut):opts([['assigned','Planifié'],['termine','Terminé']],f.status),onStat:set(k==='pt'?'statut':'status'),
    fDescr:f.descr||'',onDescr:set('descr'),fNotes:f.notes||'',onNotes:set('notes'),fHeure:f.heure||'',onHeure:set('heure'),fHD:f.heure_debut||'',onHD:set('heure_debut'),fHF:f.heure_fin||'',onHF:set('heure_fin'),
    fDate:f.date||'',onDate:set('date'),fDD:f.date_debut||'',onDD:set('date_debut'),fDF:f.date_fin||'',onDF:set('date_fin'),fWo:linked,onWo:set('wo_id'),hasWoLinks:linked.length>0,
    fReqB:!!f.req_bassin,fReqP:!!f.req_photo,fReqN:!!f.req_notes,onReqB:set('req_bassin'),onReqP:set('req_photo'),onReqN:set('req_notes'),
    fTechs:techs.map(function(c){var on=ids.indexOf(c.id)>=0;return{l:(c.prenom+' '+c.nom).trim(),box:on?'var(--color-text)':'transparent',on:on,go:function(){var cur=(k==='wo'?self.state.fe.f.assignes:self.state.fe.f.emps).slice(),i=cur.indexOf(c.id);if(i>=0)cur.splice(i,1);else cur.push(c.id);self.feSet(k==='wo'?'assignes':'emps',cur);}};}),
    showIndep:k==='pt'&&isNew&&ids.length>1,indepLbl:fe.indep?'Une copie indépendante par technicien':'Tâche partagée par les techniciens',toggleIndep:function(){self.setState({fe:Object.assign({},self.state.fe,{indep:!self.state.fe.indep})});},
    fTasks:(f.tasks||[]).map(function(t,i){return{label:t.label,box:t.done?'var(--color-text)':'transparent',on:!!t.done,toggle:function(){var a=self.state.fe.f.tasks.slice();a[i]=Object.assign({},a[i],{done:!a[i].done});self.feSet('tasks',a);},
      del:function(){var a=self.state.fe.f.tasks.slice();a.splice(i,1);self.feSet('tasks',a);}};}),
    taskIn:fe.taskIn||'',onTaskIn:function(e){self.setState({fe:Object.assign({},self.state.fe,{taskIn:e.target.value})});},
    addTask:function(){var v=String(self.state.fe.taskIn||'').trim();if(!v)return;var a=(self.state.fe.f.tasks||[]).concat([{id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),label:v,done:false}]);self.setState({fe:Object.assign({},self.state.fe,{taskIn:'',f:Object.assign({},self.state.fe.f,{tasks:a})})});},
    fFiles:(f.files||[]).map(function(x,i){var src=x.data||x.url||'';return{name:x.name||('Fichier '+(i+1)),has:!!src,open:function(){var ww=window.open('','_blank');if(ww){ww.document.write(/^data:application\/pdf/.test(src)?'<iframe src="'+src+'" style="border:0;width:100%;height:100vh"></iframe>':'<img src="'+src+'" style="max-width:100%">');ww.document.close();}},
      del:function(){var a=self.state.fe.f.files.slice();a.splice(i,1);self.feSet('files',a);}};}),addFile:function(){self.feAddFile();},
    whenJour:isNew&&w.mode==='jour',whenPlage:isNew&&w.mode==='plage',whenRec:isNew&&w.mode==='rec',
    whenModes:isNew?[['jour','Un jour'],['plage','Du … au …'],['rec','Récurrence']].map(function(x){return Object.assign({label:x[1],go:function(){setW('mode',x[0]);}},segS(w.mode===x[0]));}):[],
    wDebut:w.debut||'',onWDebut:function(e){setW('debut',e.target.value);},wFin:w.fin||'',onWFin:function(e){setW('fin',e.target.value);},
    recOpts:[['hebdo','Chaque semaine'],['bihebdo','Aux 2 semaines']].map(function(x){return Object.assign({label:x[1],go:function(){setW('rec',x[0]);}},segS(w.rec===x[0]));}),
    dayToggles:DLd.map(function(x){return Object.assign({l:x[0],go:function(){var j=Object.assign({},self.state.fe.when.jours);j[x[1]]=!j[x[1]];setW('jours',j);}},segS(!!(w.jours||{})[x[1]]));}),
    whenCount:isNew?(k==='pt'&&w.mode==='plage'?(dates.length?'1 tâche du '+fdate(w.debut)+' au '+fdate(w.fin):'Choisissez les deux dates'):(dates.length?dates.length+' '+(dates.length>1?'éléments seront créés':'élément sera créé')+(dates.length>1?' ('+dates.slice(0,6).map(fdate).join(', ')+(dates.length>6?'…':'')+')':''):'Choisissez les dates')):'',
    feEditDate:!isNew,isNotPT:k!=='pt',feBusy:!!fe.busy,feSaveLbl:fe.busy?'Enregistrement…':(isNew?'Créer':'Enregistrer'),feSave:function(){self.feSave();},
    feCanDel:!isNew,feDel1Lbl:fe.confirm===1?'Confirmer la suppression':'Supprimer',feDel1:function(){self.feDelete(1);},
    feHasSerie:!isNew&&((k==='wo'&&!!f.groupe_id)||(k==='pt'&&!!(f.recurrence&&f.recurrence.serie))),feDel2Lbl:fe.confirm===2?'Confirmer : supprimer les à venir':'Supprimer les à venir de la série',feDel2:function(){self.feDelete(2);},
    fePrint:function(){self.printWO();},canPrint:k==='wo'&&!isNew,
    feClose:function(){self.setState({fe:null});},feCloseBg:function(e){if(e.target===e.currentTarget)self.setState({fe:null});}};};
/* Les anciens dialogues simplifiés ouvrent désormais l'éditeur complet */
Comp.prototype.openEdit=function(m){this.openFE(m.kind,m.id);};
Comp.prototype.printPlanning=function(rows,days,label){var E=function(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});};
  var h='<!doctype html><meta charset="utf-8"><title>Planning '+E(label)+'</title><style>@page{size:A4 landscape}body{font:11px Arial,sans-serif;margin:14px}h1{font-size:17px;margin:0 0 8px}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{border:1px solid #aaa;padding:4px;vertical-align:top;text-align:left}th{background:#e8f2fb}.s{margin:0 0 4px;padding:3px 4px;border-left:3px solid #1a5c9a;background:#f4f6fa}.d{background:#dff0e6;border-left-color:#1d7a4a}</style>'
    +'<h1>Planning équipe — '+E(label)+'</h1><table><tr><th style="width:15%">Technicien</th>'+days.map(function(d){return'<th>'+E(d.label)+'</th>';}).join('')+'</tr>'
    +rows.map(function(r){return'<tr><td><b>'+E(r.nom)+'</b><br>'+E(r.hours)+'</td>'+r.cells.map(function(c){return'<td>'+c.slots.map(function(s){return'<div class="s'+(s.bg!=='var(--color-bg)'?' d':'')+'"><b>'+E(s.h)+'</b> '+E(s.nom)+(s.tache?'<br>'+E(s.tache):'')+(s.rec?' ↻':'')+'</div>';}).join('')+'</td>';}).join('')+'</tr>';}).join('')+'</table>';
  var w=window.open('','_blank');if(!w){this.flash('Fenêtre bloquée — autorisez les fenêtres pour imprimer');return;}w.document.write(h+'<script>setTimeout(function(){print();},300)<\/script>');w.document.close();};
Comp.prototype.openDlg=function(p){p=p||{};this.openFE(p.type==='Créneau'?'plan':p.type==='Tâche'?'pt':'wo',null,p);};

/* ═════════════ PLAN DE MATCH (table plan_match, même format que SA Platform) ═════════════
   Un plan = un ou plusieurs employés (emp « id1, id2 ») × un jour : véhicule, superviseur, résumé,
   sections {id,title,color,note,tasks:[{id,label,est,done,status,notes,photos,valide…}]}, obstacles, bons coups. */
var PMM_COLORS=[['bleu','Bleu','#1a5c9a'],['vert','Vert','#1d7a4a'],['orange','Orange','#c2410c'],['purple','Violet','#6d28d9']];
function pmmId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
Comp.prototype.loadPMM=function(day,force){var self=this;if(!force&&this.pmm[day]!==undefined)return Promise.resolve();this.pmm[day]=this.pmm[day]||null;
  return get('plan_match?date=eq.'+day+'&select=*').then(function(r){self.pmm[day]=r;self.update();}).catch(function(e){self.pmm[day]='err';self.pmmErr=netMsg(e);self.update();});};
/* Écriture sûre : relit le plan, applique fn sur la version du serveur, n'écrit que si personne ne l'a changé entre-temps. */
Comp.prototype.editPMM=function(id,fn,msg,tries){var self=this;tries=tries||0;
  return get('plan_match?id=eq.'+encodeURIComponent(id)+'&select=*').then(function(r){var row=r[0];if(!row)throw new Error('plan introuvable');var nr=fn(JSON.parse(JSON.stringify(row)));nr.updated_at=new Date().toISOString();delete nr.id;
    return fetch(SB+'/rest/v1/plan_match?id=eq.'+encodeURIComponent(id)+'&updated_at='+(row.updated_at==null?'is.null':'eq.'+encodeURIComponent(row.updated_at)),{method:'PATCH',headers:Object.assign({'Content-Type':'application/json',Prefer:'return=representation'},H),body:JSON.stringify(nr)})
      .then(function(res){if(!res.ok)throw new Error('HTTP '+res.status);return res.json();}).then(function(rows){if(!rows.length){if(tries>=4)throw new Error('conflit, réessayez');return self.editPMM(id,fn,msg,tries+1);}
        auditT(self,'MODIFICATION','plan_match',id);if(msg)self.flash(msg);return self.loadPMM(rows[0].date,true);});})
    .catch(function(e){self.flash('Échec — rien n’a été modifié : '+netMsg(e));});};
Comp.prototype.openPMM=function(id,preset){var day=this.pmmDay();
  if(id){var p=(Array.isArray(this.pmm[day])?this.pmm[day]:[]).filter(function(x){return x.id===id;})[0];if(!p)return;
    this.setState({pb:{id:id,emps:splitIds(p.emp),date:p.date,vehicule:p.vehicule||'',superviseur:p.superviseur||'',resume:p.resume||'',sections:JSON.parse(JSON.stringify(p.sections||[])),confirm:false,busy:false}});return;}
  var pr=preset||{};this.setState({pb:{id:null,emps:pr.emp?[pr.emp]:[],date:day,vehicule:'',superviseur:(this.user.prenom+' '+this.user.nom).trim(),resume:'',sections:[{id:pmmId(),title:'',color:'bleu',note:'',tasks:[{id:pmmId(),label:'',est:'',notes:'',status:'À faire',done:false,photos:[]}]}],confirm:false,busy:false}});};
Comp.prototype.pbSet=function(fn){var pb=JSON.parse(JSON.stringify(this.state.pb));fn(pb);pb.confirm=false;this.setState({pb:pb});};
Comp.prototype.savePMM=function(){var self=this,pb=this.state.pb;if(!pb||pb.busy)return;if(!pb.emps.length){this.flash('Choisissez au moins un employé');return;}if(!pb.date){this.flash('Date requise');return;}
  var secs=pb.sections.map(function(s){return Object.assign({},s,{tasks:(s.tasks||[]).filter(function(t){return String(t.label||'').trim();})});}).filter(function(s){return String(s.title||'').trim()||s.tasks.length;});
  var now=new Date().toISOString(),body={emp:pb.emps.join(', '),date:pb.date,vehicule:pb.vehicule,superviseur:pb.superviseur,resume:pb.resume};
  var fin=function(){self.setState({pb:null});self.pmm={};return self.loadPMM(pb.date,true);};
  this.setState({pb:Object.assign({},pb,{busy:true})});
  if(!pb.id){postRows('plan_match',[Object.assign({id:pmmId(),sections:secs,obstacles:'',bonscoups:'',created_by:this.user.id,created_at:now,updated_at:now},body)])
      .then(function(r){auditT(self,'CREATION','plan_match',r[0]&&r[0].id);self.flash('Plan de Match créé');self.state.pmmDate=pb.date;return fin();}).catch(function(e){self.setState({pb:Object.assign({},self.state.pb,{busy:false})});self.flash('Échec : '+netMsg(e));});return;}
  // Garde ce que le technicien a coché/noté entre-temps (même tâche = même id)
  this.editPMM(pb.id,function(row){var cur={};(row.sections||[]).forEach(function(s){(s.tasks||[]).forEach(function(t){cur[t.id]=t;});});
    secs.forEach(function(s){s.tasks=s.tasks.map(function(t){var c=cur[t.id];return c?Object.assign({},t,{done:c.done,status:c.status,notes:c.notes,photos:c.photos&&c.photos.length?c.photos:t.photos,valide:c.valide,valideBy:c.valideBy,valideAt:c.valideAt}):t;});});
    return Object.assign(row,body,{sections:secs});},'Plan de Match enregistré').then(function(){self.state.pmmDate=pb.date;return fin();});};
Comp.prototype.deletePMM=function(){var self=this,pb=this.state.pb;if(!pb||!pb.id)return;if(!pb.confirm){this.setState({pb:Object.assign({},pb,{confirm:true})});return;}
  rest('DELETE','plan_match?id=eq.'+encodeURIComponent(pb.id)).then(function(){auditT(self,'SUPPRESSION','plan_match',pb.id);self.setState({pb:null});self.flash('Plan de Match supprimé');return self.loadPMM(pb.date,true);}).catch(function(e){self.flash('Échec : '+netMsg(e));});};
Comp.prototype.validerTache=function(planId,taskId){var who=this.user.id;this.editPMM(planId,function(row){(row.sections||[]).forEach(function(s){(s.tasks||[]).forEach(function(t){if(t.id===taskId&&t.done){t.valide=true;t.valideBy=who;t.valideAt=new Date().toISOString();}});});return row;},'Tâche validée');};
Comp.prototype.pmmDay=function(){return this.state.pmmDate||iso(new Date());};
Comp.prototype.dayJobs=function(uid,day){var D=this.D,mon=iso(mondayOf(new Date(day+'T12:00:00'))),PL=this.pl[mon];if(!PL){if(!this._pl[mon]){var self=this;this._pl[mon]=1;this.loadPlan(mondayOf(new Date(day+'T12:00:00'))).then(function(){self.update();});}return[];}
  var has=function(s){return splitIds(s).indexOf(uid)>=0;},out=[];
  PL.wo.forEach(function(w){if(w.date===day&&has(w.assigne))out.push({kind:'wo',id:w.id,k:'Bon de travail',t:w.client+(w.descr?' — '+String(w.descr).split('\n')[0].slice(0,60):''),h:'',done:woDone(w.status),cur:w.status==='en_cours',st:w.status});});
  PL.plan.forEach(function(p){if(p.date===day&&has(p.emp))out.push({kind:'plan',id:p.id,k:'Créneau',t:(p.client||'')+(p.descr?' — '+p.descr:''),h:p.heure||'',done:p.status==='termine'||p.status==='done',cur:p.status==='en_cours',st:p.status});});
  PL.pt.forEach(function(t){if(t.date_debut<=day&&t.date_fin>=day&&has(t.emp))out.push({kind:'pt',id:t.id,k:'Tâche',t:(t.titre||'')+(t.site_nom&&t.site_nom!==t.titre?' — '+t.site_nom:''),h:t.heure_debut||'',done:t.statut==='termine',cur:false,st:t.statut});});
  return out.sort(function(a,b){return(a.h||'99').localeCompare(b.h||'99');});};
Comp.prototype.printPMMDay=function(){var self=this,day=this.pmmDay(),plans=Array.isArray(this.pmm[day])?this.pmm[day]:[],names=this.names(),D=this.D,E=function(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});};
  var emps=D.comptes.filter(function(c){return c.role!=='admin'&&D.statut[c.id]!=='inactif';}),col={};PMM_COLORS.forEach(function(c){col[c[0]]=c[2];});
  var h='<!doctype html><meta charset="utf-8"><title>Plan de Match '+day+'</title><style>body{font:12px Arial,sans-serif;margin:16px}section{page-break-after:always}h1{font-size:18px;margin:0 0 2px}.m{margin:0 0 10px;color:#333}h3{color:#fff;padding:4px 8px;margin:10px 0 0;font-size:13px}.n{border:1px solid #c00;color:#900;padding:4px 8px;margin-top:6px}table{border-collapse:collapse;width:100%}td{border:1px solid #bbb;padding:4px 6px}.b{width:18px;text-align:center}.l{margin-top:14px}.ff{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.ff div{border:1px solid #bbb;min-height:60px;padding:4px}</style>';
  var n=0;emps.forEach(function(c){var p=plans.filter(function(x){return splitIds(x.emp).indexOf(c.id)>=0;})[0],jobs=self.dayJobs(c.id,day);if(!p&&!jobs.length)return;n++;
    h+='<section><h1>Plan de Match — '+E((c.prenom+' '+c.nom).trim())+'</h1><div class="m">'+E(fdate(day))+(p&&p.vehicule?' · Véhicule : '+E(p.vehicule):'')+(p&&p.superviseur?' · Superviseur : '+E(p.superviseur):'')+(p&&p.resume?'<br>'+E(p.resume):'')+'</div>';
    if(p)(p.sections||[]).forEach(function(s,i){h+='<h3 style="background:'+(col[s.color]||col.bleu)+'">'+E(s.title||('Section '+(i+1)))+'</h3>'+(s.note?'<div class="n">'+E(s.note)+'</div>':'')+'<table>'+(s.tasks||[]).map(function(t){return'<tr><td class="b">'+(t.done?'☑':'☐')+'</td><td>'+E(t.label)+(t.est?' ('+E(t.est)+' min)':'')+'</td></tr>';}).join('')+'</table>';});
    if(jobs.length)h+='<div class="l"><b>Travaux du jour</b><table>'+jobs.map(function(j){return'<tr><td class="b">'+(j.done?'☑':'☐')+'</td><td style="width:60px">'+E(j.h)+'</td><td style="width:110px">'+E(j.k)+'</td><td>'+E(j.t)+'</td></tr>';}).join('')+'</table></div>';
    h+='<div class="ff"><div><b>Obstacles</b><br>'+E(p&&p.obstacles||'')+'</div><div><b>Bons coups</b><br>'+E(p&&p.bonscoups||'')+'</div></div></section>';});
  if(!n){this.flash('Rien à imprimer pour cette journée');return;}
  var w=window.open('','_blank');if(!w){this.flash('Fenêtre bloquée — autorisez les fenêtres pour imprimer');return;}w.document.write(h+'<script>setTimeout(function(){print();},300)<\/script>');w.document.close();};
Comp.prototype.pmmVals=function(){var self=this,st=this.state,D=this.D,day=this.pmmDay();
  if(st.mod==='planmatch'&&this.pmm[day]===undefined)this.loadPMM(day);
  var plans=Array.isArray(this.pmm[day])?this.pmm[day]:[],col={};PMM_COLORS.forEach(function(c){col[c[0]]=c[2];});
  var shift=function(n){self.setState({pmmDate:iso(addDays(new Date(day+'T12:00:00'),n))});};
  var emps=st.mod==='planmatch'?D.comptes.filter(function(c){return c.role!=='admin'&&D.statut[c.id]!=='inactif';}):[];
  /* Activité réelle de la journée : punchs de la feuille de temps + travaux (bons, créneaux, tâches), en cours / à faire / faits / en retard */
  var dMon=iso(mondayOf(new Date(day+'T12:00:00'))),dIdx=(new Date(day+'T12:00:00').getDay()+6)%7,isToday=day===iso(new Date());
  if(st.mod==='planmatch'&&!(D.ft||[]).some(function(f){return f.week===dMon;})&&this.ftw[dMon]===undefined)this.loadWeekFT(dMon);
  var ftRow=function(uid){return(D.ft||[]).filter(function(f){return f.uid===uid&&f.week===dMon;})[0]||(Array.isArray(self.ftw[dMon])?self.ftw[dMon].filter(function(f){return f.uid===uid;})[0]:null);};
  var jobItem=function(j,cls){return{txt:(j.h?j.h+' · ':'')+j.k+' — '+j.t,etat:cls,open:function(){self.openFE(j.kind,j.id);},bd:cls==='En cours'?'var(--color-accent-700)':cls==='En retard'?'var(--color-accent-900)':'var(--color-divider)',op:cls==='Fait'?0.6:1};};
  var tot={faits:0,total:0,cours:0,retard:0,punch:0};
  var cards=emps.map(function(c){var p=plans.filter(function(x){return splitIds(x.emp).indexOf(c.id)>=0;})[0],all=[],jobs=self.dayJobs(c.id,day);
    var fr0=ftRow(c.id),dd=fr0&&fr0.days&&fr0.days[dIdx],ts=(dd&&dd.tasks)||[],run=ts.filter(function(t){return t.active;})[0],hrs=ts.reduce(function(s,t){return s+(t.active||!t.end?0:(Number(t.hrs)||0));},0);
    jobs.forEach(function(j){if(run&&run.sourceId&&String(run.sourceId)===String(j.id))j.cur=true;});
    var late=D.wo.filter(function(w){return w.date&&w.date<day&&!woDone(w.status)&&splitIds(w.assigne).indexOf(c.id)>=0;}).map(function(w){return{kind:'wo',id:w.id,k:'Bon de travail du '+fdate(w.date),t:w.client+(w.descr?' — '+String(w.descr).split('\n')[0].slice(0,50):''),h:''};});
    var enc=jobs.filter(function(j){return j.cur&&!j.done;}),todo=jobs.filter(function(j){return!j.cur&&!j.done;}),done=jobs.filter(function(j){return j.done;});
    tot.total+=jobs.length;tot.faits+=done.length;tot.cours+=enc.length;tot.retard+=late.length;if(run)tot.punch++;
    var live=run?'En punch : '+(run.lieu||'—')+' depuis '+run.start+(run.sourceLabel?' — '+run.sourceLabel:''):(ts.length?(isToday?'Hors punch':'Journée')+' · '+ts.length+' punch(s), '+fmtH(hrs)+(ts.length&&ts[ts.length-1].end?' · dernier : '+ts[ts.length-1].lieu+' jusqu’à '+ts[ts.length-1].end:''):(isToday?'Pas encore punché aujourd’hui':'Aucun punch ce jour'));
    if(p)(p.sections||[]).forEach(function(s){(s.tasks||[]).forEach(function(t){all.push(t);});});var dn=all.filter(function(t){return t.done;}).length;
    return{nom:(c.prenom+' '+c.nom).trim(),hasPlan:!!p,noPlan:!p,meta:p?[p.vehicule?'Véhicule : '+p.vehicule:'',p.superviseur?'Superviseur : '+p.superviseur:''].filter(Boolean).join(' · '):'',resume:p?p.resume||'':'',
      prog:all.length?dn+' / '+all.length+' tâches':'',pct:all.length?Math.round(dn/all.length*100):0,
      sections:p?(p.sections||[]).map(function(s,i){return{title:s.title||('Section '+(i+1)),bg:col[s.color]||col.bleu,note:s.note||'',hasNote:!!s.note,
        tasks:(s.tasks||[]).map(function(t){return{label:t.label+(t.est?' ('+t.est+' min)':''),etat:t.valide?'Validé':(t.done?'Fait — à valider':(t.status&&t.status!=='À faire'?t.status:'')),box:t.done?'var(--color-text)':'transparent',on:!!t.done,
          canVal:!!t.done&&!t.valide,valider:function(){self.validerTache(p.id,t.id);},notes:t.notes||''};})};}):[],
      obstacles:p?p.obstacles||'':'',bonscoups:p?p.bonscoups||'':'',hasFF:!!(p&&(p.obstacles||p.bonscoups)),
      live:live,liveBd:run?'var(--color-accent-700)':'var(--color-divider)',liveFw:run?700:400,_run:!!run,hrs:ts.length?fmtH(hrs):'',
      jobsCur:enc.map(function(j){return jobItem(j,'En cours');}),jobsTodo:todo.map(function(j){return jobItem(j,'À faire');}),jobsDone:done.map(function(j){return jobItem(j,'Fait');}),jobsLate:late.map(function(j){return jobItem(j,'En retard');}),
      hasJobs:jobs.length+late.length>0,jobsSum:jobs.length?done.length+' / '+jobs.length+' fait(s)':'',noJobs:!jobs.length&&!late.length,
      edit:function(){if(p)self.openPMM(p.id);else self.openPMM(null,{emp:c.id});},editLbl:p?'Modifier le plan':'Créer le plan'};});
  var pb=st.pb,pbV={pbOpen:!!pb};
  if(pb){pbV=Object.assign(pbV,{pbTitle:pb.id?'Modifier le Plan de Match':'Créer un Plan de Match',pbDate:pb.date,onPbDate:function(e){self.pbSet(function(x){x.date=e.target.value;});},
    pbVeh:pb.vehicule,onPbVeh:function(e){self.pbSet(function(x){x.vehicule=e.target.value;});},pbSup:pb.superviseur,onPbSup:function(e){self.pbSet(function(x){x.superviseur=e.target.value;});},
    pbRes:pb.resume,onPbRes:function(e){self.pbSet(function(x){x.resume=e.target.value;});},vehList:(D.flotte||[]).map(function(v){return{v:v.nom+(v.plaque?' · '+v.plaque:'')};}),
    pbTechs:D.comptes.filter(function(c){return c.role!=='admin'&&(D.statut[c.id]!=='inactif'||pb.emps.indexOf(c.id)>=0);}).map(function(c){var on=pb.emps.indexOf(c.id)>=0;return{l:(c.prenom+' '+c.nom).trim(),on:on,box:on?'var(--color-text)':'transparent',go:function(){self.pbSet(function(x){var i=x.emps.indexOf(c.id);if(i>=0)x.emps.splice(i,1);else x.emps.push(c.id);});}};}),
    pbSecs:pb.sections.map(function(s,si){return{title:s.title||'',onTitle:function(e){self.pbSet(function(x){x.sections[si].title=e.target.value;});},note:s.note||'',onNote:function(e){self.pbSet(function(x){x.sections[si].note=e.target.value;if(!x.sections[si].noteColor)x.sections[si].noteColor='rouge';});},
      colors:PMM_COLORS.map(function(c){return{v:c[0],l:c[1],sel:(s.color||'bleu')===c[0]};}),onColor:function(e){self.pbSet(function(x){x.sections[si].color=e.target.value;});},bar:col[s.color]||col.bleu,
      del:function(){self.pbSet(function(x){x.sections.splice(si,1);});},addTask:function(){self.pbSet(function(x){x.sections[si].tasks.push({id:pmmId(),label:'',est:'',notes:'',status:'À faire',done:false,photos:[]});});},
      tasks:(s.tasks||[]).map(function(t,ti){return{label:t.label||'',est:t.est||'',done:t.done?'fait':'',onLabel:function(e){self.pbSet(function(x){x.sections[si].tasks[ti].label=e.target.value;});},onEst:function(e){self.pbSet(function(x){x.sections[si].tasks[ti].est=e.target.value;});},
        del:function(){self.pbSet(function(x){x.sections[si].tasks.splice(ti,1);});}};})};}),
    pbAddSec:function(){self.pbSet(function(x){x.sections.push({id:pmmId(),title:'',color:'bleu',note:'',tasks:[{id:pmmId(),label:'',est:'',notes:'',status:'À faire',done:false,photos:[]}]});});},
    pbSave:function(){self.savePMM();},pbSaveLbl:pb.busy?'Enregistrement…':'Enregistrer',pbCanDel:!!pb.id,pbDelLbl:pb.confirm?'Confirmer la suppression':'Supprimer',pbDel:function(){self.deletePMM();},
    pbClose:function(){self.setState({pb:null});},pbCloseBg:function(e){if(e.target===e.currentTarget)self.setState({pb:null});}});}
  cards.sort(function(a,b){return(b._run?1:0)-(a._run?1:0);});
  var PL=this.pl[dMon],una=[];if(PL){PL.wo.forEach(function(w){if(w.date===day&&!splitIds(w.assigne).length&&!woDone(w.status))una.push({kind:'wo',id:w.id,k:'Bon de travail',t:w.client||'',h:''});});
    PL.plan.forEach(function(p){if(p.date===day&&!splitIds(p.emp).length)una.push({kind:'plan',id:p.id,k:'Créneau',t:p.client||'',h:p.heure||''});});
    PL.pt.forEach(function(t){if(t.date_debut<=day&&t.date_fin>=day&&!splitIds(t.emp).length&&t.statut!=='termine')una.push({kind:'pt',id:t.id,k:'Tâche',t:t.titre||'',h:t.heure_debut||''});});}
  var sumK=[{l:isToday?'En punch maintenant':'Employés ayant punché',v:isToday?tot.punch+' / '+cards.length:String(cards.filter(function(c){return c.hrs;}).length)},{l:'Travaux du jour faits',v:tot.faits+' / '+tot.total},{l:'En cours',v:String(tot.cours)},
    {l:'En retard (bons de travail)',v:String(tot.retard),hot:tot.retard>0},{l:'Non assignés',v:String(una.length),hot:una.length>0}];
  return Object.assign(pbV,{pmmSum:sumK.map(function(k){return Object.assign(k,{bg:k.hot?'var(--color-accent-900)':'transparent',fg:k.hot?'#ffffff':'var(--color-text)'});}),
    pmmUna:una.map(function(j){return jobItem(j,'Non assigné');}),pmmHasUna:una.length>0,isPlanMatch:st.mod==='planmatch',pmmLabel:DLF[(new Date(day+'T12:00:00').getDay()+6)%7]+' '+fdate(day),pmmPrev:function(){shift(-1);},pmmNext:function(){shift(1);},pmmToday:function(){self.setState({pmmDate:null});},
    pmmDateVal:day,onPmmDate:function(e){if(e.target.value)self.setState({pmmDate:e.target.value});},pmmCards:cards,pmmLoading:this.pmm[day]===undefined||this.pmm[day]===null,pmmErrTxt:this.pmm[day]==='err'?'Plans illisibles : '+(this.pmmErr||''):'',
    pmmPrint:function(){self.printPMMDay();},pmmNew:function(){self.openPMM(null);},pmmCount:plans.length+' plan'+(plans.length>1?'s':'')+' ce jour'});};

/* ═════════════ COMPTES : employés, rôles, droits, statut, mot de passe (même table que SA Platform) ═════════════ */
var DROITS=[['plan','Plan journalier'],['ft','Feuilles de temps'],['suivi','Suivi opérations (live)'],['wo','Work Orders'],['sites','Sites & Clients'],['flotte','Flotte véhicules'],['inventaire','Inventaire / Stock'],['comptes','Gestion des comptes'],['stats','Statistiques'],['map','Carte GPS']];
var ROLES=[['employe','Employé'],['superviseur','Superviseur'],['admin','Administrateur']];
Comp.prototype.loadComptes=function(force){var self=this;if(!force&&this.cptes)return;this.cptes='loading';
  get('comptes?select=id,prenom,nom,dept,email,tel,role,droits,statut,saisonnier,updated_at&order=nom.asc').then(function(r){self.cptes=r;self.update();}).catch(function(e){self.cptes='err';self.cptErr=netMsg(e);self.update();});};
Comp.prototype.openCompte=function(id){var c=id&&Array.isArray(this.cptes)?this.cptes.filter(function(x){return x.id===id;})[0]:null;
  var dr={};DROITS.forEach(function(d){dr[d[0]]=c?!!(c.droits&&c.droits[d[0]]):(d[0]!=='comptes');});
  this.setState({ce:{id:c?c.id:'',isNew:!c,prenom:c?c.prenom||'':'',nom:c?c.nom||'':'',dept:c?c.dept||'':'Terrain',email:c?c.email||'':'',tel:c?c.tel||'':'',role:c?c.role||'employe':'employe',
    statut:c?(c.statut||'actif'):'actif',saisonnier:!!(c&&c.saisonnier),droits:dr,pw1:'',pw2:'',adminPw:'',confirm:false,busy:false}});};
Comp.prototype.ceSet=function(k,v){var o={};o[k]=v;this.setState({ce:Object.assign({},this.state.ce,o,{confirm:false})});};
function rpc(name,body){return fetch(SB+'/rest/v1/rpc/'+name,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},H),body:JSON.stringify(body)})
  .then(function(r){return r.text().then(function(t){var j=t?JSON.parse(t):null;if(!r.ok)throw new Error((j&&j.message)||('HTTP '+r.status));return j;});});}
Comp.prototype.saveCompte=function(){var self=this,e=this.state.ce;if(!e||e.busy)return;var id=String(e.id||'').trim().toLowerCase();
  if(this.user.role!=='admin'){this.flash('Réservé aux administrateurs');return;}
  if(!/^[a-z0-9._-]{2,40}$/.test(id)){this.flash('Identifiant : lettres minuscules, chiffres, point ou tiret (2 caractères min.)');return;}
  if(!String(e.prenom).trim()&&!String(e.nom).trim()){this.flash('Indiquez le prénom ou le nom');return;}
  if(e.isNew&&Array.isArray(this.cptes)&&this.cptes.some(function(c){return c.id===id;})){this.flash('Identifiant déjà utilisé');return;}
  var pw=e.pw1||e.pw2;if(e.isNew&&!pw){this.flash('Choisissez un mot de passe pour le nouveau compte');return;}
  if(pw){if(e.pw1!==e.pw2){this.flash('Les deux mots de passe ne correspondent pas');return;}if(e.pw1.length<8){this.flash('Mot de passe : 8 caractères minimum');return;}if(!e.adminPw){this.flash('Confirmez avec VOTRE mot de passe administrateur');return;}}
  if(id===this.user.id&&e.role!=='admin'){this.flash('Vous ne pouvez pas retirer votre propre rôle d’administrateur');return;}
  var dr=Object.assign({},e.droits);if(e.role==='admin')DROITS.forEach(function(d){dr[d[0]]=true;});
  var body={prenom:String(e.prenom).trim(),nom:String(e.nom).trim(),dept:String(e.dept||'').trim(),email:String(e.email||'').trim(),tel:String(e.tel||'').trim(),role:e.role,droits:dr,statut:e.statut,saisonnier:!!e.saisonnier,updated_at:new Date().toISOString()};
  this.setState({ce:Object.assign({},e,{busy:true})});
  var w=e.isNew?postRows('comptes',[Object.assign({id:id},body)]):rest('PATCH','comptes?id=eq.'+encodeURIComponent(id),body);
  w.then(function(){auditT(self,e.isNew?'CREATION':'MODIFICATION','comptes',id);
      if(!pw)return true;return rpc('admin_definir_mdp',{p_admin_id:self.user.id,p_admin_mdp:e.adminPw,p_cible_id:id,p_nouveau:e.pw1});})
    .then(function(ok){if(ok===false){self.setState({ce:Object.assign({},self.state.ce,{busy:false,isNew:false,adminPw:''})});self.loadComptes(true);self.flash('Compte enregistré, mais mot de passe NON défini : votre mot de passe administrateur est incorrect');return;}
      self.setState({ce:null});self.flash(e.isNew?'Compte créé — l’employé changera son mot de passe à la 1re connexion':(pw?'Compte et mot de passe enregistrés':'Compte enregistré'));self.loadComptes(true);return self.load().then(function(){self.update();});})
    .catch(function(err){self.setState({ce:Object.assign({},self.state.ce,{busy:false})});self.flash('Échec : '+netMsg(err));});};
Comp.prototype.deleteCompte=function(){var self=this,e=this.state.ce;if(!e||e.isNew)return;
  if(e.id===this.user.id||e.id==='admin'){this.flash('Ce compte ne peut pas être supprimé');return;}
  if(!e.confirm){this.setState({ce:Object.assign({},e,{confirm:true})});return;}
  rest('DELETE','comptes?id=eq.'+encodeURIComponent(e.id)).then(function(){auditT(self,'SUPPRESSION','comptes',e.id);self.setState({ce:null});self.flash('Compte supprimé');self.loadComptes(true);return self.load().then(function(){self.update();});})
    .catch(function(err){self.flash('Échec : '+netMsg(err));});};
/* Sauvegarde complète (comme SA Platform › Comptes) : toutes les tables de travail dans un fichier JSON */
Comp.prototype.exportAll=function(){var self=this,T=['sites','contrats','workorders','plan','planning_tasks','plan_match','feuilles_temps','feuilles_temps_envois','releves','demandes','facturation','projets_excel','inventaire','flotte','sorties_inventaire','bons_livraison','rapports_hivernage','punch_gps_log','types_bassin','sondages'];
  this.flash('Préparation de la sauvegarde…');
  Promise.all(T.map(function(t){return get(t+'?select=*').catch(function(e){return{_erreur:netMsg(e)};});})).then(function(r){var o={_app:'sa-admin',_date:new Date().toISOString(),_par:self.user.id,comptes:Array.isArray(self.cptes)?self.cptes:[]};
    T.forEach(function(t,i){o[t]=r[i];});saveBlob(new Blob([JSON.stringify(o)],{type:'application/json'}),'SoucyAquatik_sauvegarde_'+iso(new Date())+'.json');auditT(self,'EXPORT','sauvegarde','complete');self.flash('Sauvegarde téléchargée ('+T.length+' tables, sans aucun mot de passe)');});};
Comp.prototype.comptesVals=function(){var self=this,st=this.state,isAdm=this.user.role==='admin';if(st.mod==='comptes'&&!this.cptes)this.loadComptes();
  var L=Array.isArray(this.cptes)?this.cptes:[],rl={};ROLES.forEach(function(r){rl[r[0]]=r[1];});
  var rows=L.map(function(c){var inact=(c.statut||'actif')==='inactif';return{nom:((c.prenom||'')+' '+(c.nom||'')).trim()||c.id,id:c.id,role:rl[c.role]||c.role||'—',dept:c.dept||'—',etat:(inact?'Inactif':'Actif')+(c.saisonnier?' · saisonnier':''),op:inact?0.55:1,
    open:function(){self.openCompte(c.id);}};});
  var e=st.ce,ceV={ceOpen:!!e};
  if(e){var set=function(k){return function(ev){self.ceSet(k,ev.target.type==='checkbox'?ev.target.checked:ev.target.value);};};
    ceV=Object.assign(ceV,{ceNotNewId:!e.isNew,ceTitle:e.isNew?'Nouveau compte':'Compte — '+((e.prenom+' '+e.nom).trim()||e.id),ceNew:e.isNew,ceId:e.id,onCeId:function(ev){self.ceSet('id',ev.target.value.toLowerCase().replace(/\s+/g,''));},
      cePrenom:e.prenom,onCePrenom:set('prenom'),ceNom:e.nom,onCeNom:set('nom'),ceDept:e.dept,onCeDept:set('dept'),ceEmail:e.email,onCeEmail:set('email'),ceTel:e.tel,onCeTel:set('tel'),
      ceRoles:ROLES.map(function(r){return{v:r[0],l:r[1],sel:e.role===r[0]};}),onCeRole:set('role'),ceStatuts:[['actif','Actif'],['inactif','Inactif (ne peut plus se connecter)']].map(function(r){return{v:r[0],l:r[1],sel:e.statut===r[0]};}),onCeStatut:set('statut'),
      ceSais:!!e.saisonnier,onCeSais:set('saisonnier'),ceIsAdmin:e.role==='admin',ceNotAdmin:e.role!=='admin',
      ceDroits:DROITS.map(function(d){var on=!!e.droits[d[0]];return{l:d[1],on:on,box:on?'var(--color-text)':'transparent',go:function(){var o=Object.assign({},self.state.ce.droits);o[d[0]]=!o[d[0]];self.ceSet('droits',o);}};}),
      cePw1:e.pw1,onCePw1:set('pw1'),cePw2:e.pw2,onCePw2:set('pw2'),ceAdminPw:e.adminPw,onCeAdminPw:set('adminPw'),cePwLbl:e.isNew?'Mot de passe initial':'Nouveau mot de passe (laisser vide pour ne pas le changer)',
      ceCanEdit:isAdm,ceReadOnly:!isAdm,ceSave:function(){self.saveCompte();},ceSaveLbl:e.busy?'Enregistrement…':(e.isNew?'Créer le compte':'Enregistrer'),
      ceCanDel:isAdm&&!e.isNew&&e.id!==self.user.id&&e.id!=='admin',ceDelLbl:e.confirm?'Confirmer la suppression':'Supprimer le compte',ceDel:function(){self.deleteCompte();},
      ceClose:function(){self.setState({ce:null});},ceCloseBg:function(ev){if(ev.target===ev.currentTarget)self.setState({ce:null});}});}
  return Object.assign(ceV,{isComptes:st.mod==='comptes',cRows:rows,cLoading:this.cptes==='loading',cErr:this.cptes==='err'?'Comptes illisibles : '+(this.cptErr||''):'',cCanEdit:isAdm,cReadOnly:!isAdm,
    cNew:function(){self.openCompte(null);},cExport:function(){self.exportAll();},cCount:rows.length+' compte(s)'});};


/* ═════════════ LOGISTIQUE (bons de livraison, sorties d'inventaire) et HIVERNAGE — côté bureau ═════════════
   Mêmes tables et mêmes formats que SA Platform (bons_livraison, sorties_inventaire, rapports_hivernage). */
var HIV_TAGS=[['','Sans priorité'],['urgent','Urgent'],['eleve','Priorité élevée'],['modere','Modérée'],['reglementaire','Réglementaire']];
var DOC={bl:{t:'bons_livraison',lbl:'Bon de livraison'},so:{t:'sorties_inventaire',lbl:'Sortie d’inventaire'},hv:{t:'rapports_hivernage',lbl:'Rapport d’hivernage'}};
var ROWS={items_liv:[['item','Article',3],['qteSortie','Qté sortie',1],['unite','Unité',1],['qteLivree','Qté livrée',1],['statut','Statut',2]],
  items_ret:[['item','Article récupéré',3],['qteRecuperee','Qté',1],['unite','Unité',1],['raison','Raison / remarque',3]],
  lignes:[['code','Code',1],['loc','Emplacement',1],['desc','Description',3],['qteSortie','Qté sortie',1],['qteRetour','Qté retour',1],['projet','Projet / client',2]],
  plan:[['num','N°',0.5],['element','Élément',2],['travaux','Travaux prévus',3],['periode','Période',1.2],['remarques','Remarques',2]]};
function nowIso(){return new Date().toISOString();}
function docNo(p){var d=new Date();return p+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+(Math.floor(Math.random()*900)+100);}
function escH(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
Comp.prototype.loadDocs=function(kind,force){var self=this,y=new Date().getFullYear();if(!force&&this.docs[kind]!==undefined)return;this.docs[kind]=null;
  var q={bl:'bons_livraison?select=*&order=date.desc',so:'sorties_inventaire?select=*&order=date.desc',hv:'rapports_hivernage?select=*&order=date_inspection.desc'}[kind];
  get(q).then(function(r){self.docs[kind]=r;self.update();}).catch(function(e){self.docs[kind]='err';self.docErr=netMsg(e);self.update();});};
Comp.prototype.openDoc=function(kind,id){var me=(this.user.prenom+' '+this.user.nom).trim(),today=iso(new Date()),L=Array.isArray(this.docs[kind])?this.docs[kind]:[];
  var x=id?L.filter(function(r){return r.id===id;})[0]:null,f;
  if(x)f=JSON.parse(JSON.stringify(x));
  else f={bl:{no_bon:docNo('SA-'),urgent:false,date:today,heure:'',technicien:'',client:'',tel:'',adresse:'',items_liv:[{item:'',qteSortie:'',unite:'',qteLivree:'',statut:''}],items_ret:[],photos:[],status:'brouillon'},
    so:{no_bon:docNo('SA-INV-'),client:'',nom:me,no_employe:this.user.id,departement:'Bureau',date:today,lignes:[{code:'',loc:'',desc:'',qteSortie:'',qteRetour:'',projet:''}],status:'brouillon'},
    hv:{site_id:'',site_nom:'',client:'',objet:'Inspection pré-hivernage',titre:'Rapport de pré-hivernage',sous_titre:'',date_rapport:today,date_inspection:today,prepare_par:'Soucy Aquatik',technicien:'',
      sections:['Joints de céramique','Peinture du bassin','Structure en béton','Échelles en inox / accessoires','Marquage et visibilité'].map(function(t){return{id:pmmId(),title:t,tag:'',items:[],photos:[]};}),
      plan:[],suivi:[],timeline:{q1:'',q2:'',q3:'',q4:''},callout:'',signataire_sa:me,signataire_client:'',status:'brouillon'}}[kind];
  ['items_liv','items_ret','photos','lignes','sections','plan','suivi'].forEach(function(k){if(f[k]==null&&(kind==='bl'&&/items|photos/.test(k)||kind==='so'&&k==='lignes'||kind==='hv'&&/sections|plan|suivi/.test(k)))f[k]=[];});
  if(kind==='hv'&&!f.timeline)f.timeline={q1:'',q2:'',q3:'',q4:''};
  this.setState({de:{kind:kind,id:id||null,f:f,confirm:false,busy:false}});};
Comp.prototype.deMut=function(fn){var de=JSON.parse(JSON.stringify(this.state.de));fn(de.f,de);de.confirm=false;this.setState({de:de});};
Comp.prototype.saveDoc=function(extra,msg){var self=this,de=this.state.de;if(!de||de.busy)return;var k=de.kind,tb=DOC[k].t,f=Object.assign({},de.f,extra||{});
  if(k==='bl'&&!String(f.client||'').trim()){this.flash('Le client est requis');return;}
  if(k==='hv'&&!String(f.site_nom||'').trim()){this.flash('Le site est requis');return;}
  if(k==='bl'){f.items_liv=f.items_liv.filter(function(r){return String(r.item||'').trim();});f.items_ret=f.items_ret.filter(function(r){return String(r.item||'').trim();});}
  if(k==='so'){f.lignes=f.lignes.filter(function(r){return String(r.desc||r.code||'').trim();});if(!f.date)f.date=null;}
  if(k==='hv'){var s=this.D.sites.filter(function(x){return norm(x.nom)===norm(f.site_nom);})[0];if(s)f.site_id=s.id;f.plan=f.plan.filter(function(r){return String(r.element||r.travaux||'').trim();});f.suivi=f.suivi.filter(function(r){return String(r.element||'').trim();});}
  f.updated_at=nowIso();delete f.id;
  var fin=function(){auditT(self,de.id?'MODIFICATION':'CREATION',tb,de.id||'nouveau');self.setState({de:null});self.flash(msg||(DOC[k].lbl+' enregistré'));self.loadDocs(k,true);};
  this.setState({de:Object.assign({},de,{busy:true})});
  (de.id?rest('PATCH',tb+'?id=eq.'+encodeURIComponent(de.id),f):postRows(tb,[Object.assign({id:pmmId(),created_by:this.user.id,created_at:nowIso()},f)]))
    .then(fin).catch(function(e){self.setState({de:Object.assign({},self.state.de,{busy:false})});self.flash('Échec — rien n’a été modifié : '+netMsg(e));});};
Comp.prototype.deleteDoc=function(){var self=this,de=this.state.de;if(!de||!de.id)return;if(!de.confirm){this.setState({de:Object.assign({},de,{confirm:true})});return;}
  rest('DELETE',DOC[de.kind].t+'?id=eq.'+encodeURIComponent(de.id)).then(function(){auditT(self,'SUPPRESSION',DOC[de.kind].t,de.id);self.setState({de:null});self.flash('Supprimé');self.loadDocs(de.kind,true);}).catch(function(e){self.flash('Échec : '+netMsg(e));});};
Comp.prototype.printDoc=function(){var de=this.state.de;if(!de)return;var f=de.f,k=de.kind,E=escH,h='<!doctype html><meta charset="utf-8"><title>'+E(DOC[k].lbl)+'</title><style>body{font:12px Arial,sans-serif;margin:22px}h1{font-size:19px;margin:0 0 4px}h2{font-size:14px;background:#e8f2fb;padding:5px 8px;margin:16px 0 0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#f4f6fa}.m{display:flex;gap:20px;flex-wrap:wrap;margin:6px 0 10px}.s{margin-top:30px;display:flex;gap:50px}.s div{border-top:1px solid #333;width:240px;font-size:11px;padding-top:3px}.t{display:inline-block;padding:1px 6px;border:1px solid #999;font-size:11px;margin-left:6px}img.sig{max-height:90px;border:1px solid #ccc}</style>';
  var tbl=function(cols,rows){return rows.length?'<table><tr>'+cols.map(function(c){return'<th>'+E(c[1])+'</th>';}).join('')+'</tr>'+rows.map(function(r){return'<tr>'+cols.map(function(c){return'<td>'+E(r[c[0]])+'</td>';}).join('')+'</tr>';}).join('')+'</table>':'<div>—</div>';};
  if(k==='bl'){var sigs=(f.photos||[]).filter(function(p){return/^Signature/.test(p.name||'')&&p.data;});
    h+='<h1>Bon de livraison '+E(f.no_bon)+(f.urgent?' <span class="t">URGENT</span>':'')+'</h1><div class="m"><span><b>Client :</b> '+E(f.client)+'</span><span><b>Adresse :</b> '+E(f.adresse||'—')+'</span><span><b>Tél. :</b> '+E(f.tel||'—')+'</span><span><b>Date :</b> '+E(f.date||'—')+' '+E(f.heure||'')+'</span><span><b>Technicien :</b> '+E(f.technicien||'—')+'</span></div>'
      +'<h2>Articles livrés</h2>'+tbl(ROWS.items_liv,f.items_liv||[])+((f.items_ret||[]).length?'<h2>Articles récupérés</h2>'+tbl(ROWS.items_ret,f.items_ret):'')
      +(f.status==='livre'?'<p><b>Livré</b> le '+E(f.livre_at?new Date(f.livre_at).toLocaleString('fr-CA'):'')+' par '+E(f.livre_par_nom||'')+'</p>':'')
      +(sigs.length?sigs.map(function(p){return'<div><img class="sig" src="'+p.data+'"><div>'+E(p.name)+'</div></div>';}).join(''):'<div class="s"><div>Signature du client</div><div>Date</div></div>');}
  else if(k==='so')h+='<h1>Sortie d’inventaire '+E(f.no_bon)+'</h1><div class="m"><span><b>Client / projet :</b> '+E(f.client||'—')+'</span><span><b>Employé :</b> '+E(f.nom||'')+' ('+E(f.no_employe||'')+')</span><span><b>Département :</b> '+E(f.departement||'—')+'</span><span><b>Date :</b> '+E(f.date||'—')+'</span></div>'+tbl(ROWS.lignes,f.lignes||[])+'<div class="s"><div>Signature de l’employé</div><div>Signature du superviseur</div></div>';
  else{var tg={};HIV_TAGS.forEach(function(t){tg[t[0]]=t[1];});
    h+='<h1>'+E(f.titre||'Rapport de pré-hivernage')+' — '+E(f.site_nom)+'</h1><div>'+E(f.objet||'')+'</div><div class="m"><span><b>Client :</b> '+E(f.client||'—')+'</span><span><b>Inspection :</b> '+E(f.date_inspection||'—')+'</span><span><b>Rapport :</b> '+E(f.date_rapport||'—')+'</span><span><b>Préparé par :</b> '+E(f.prepare_par||'—')+'</span><span><b>Technicien :</b> '+E(f.technicien||'—')+'</span></div>'
      +(f.sections||[]).map(function(s){return'<h2>'+E(s.title)+(s.tag?'<span class="t">'+E(tg[s.tag]||s.tag)+'</span>':'')+'</h2>'+((s.items||[]).length?'<ul>'+s.items.map(function(i){return'<li>'+E(i)+'</li>';}).join('')+'</ul>':'<div>Aucun constat.</div>')+(s.photos||[]).filter(function(p){return p.data;}).map(function(p){return'<img src="'+p.data+'" style="max-width:200px;margin:4px">';}).join('');}).join('')
      +((f.plan||[]).length?'<h2>Prévisionnel des travaux</h2>'+tbl([['num','N°'],['element','Élément'],['travaux','Travaux prévus'],['prio','Priorité'],['periode','Période'],['remarques','Remarques']],f.plan.map(function(r){return Object.assign({},r,{prio:tg[r.prio]||''});})):'')
      +((f.suivi||[]).length?'<h2>Suivi</h2><table><tr><th>Élément</th><th>Devis demandé</th><th>Devis reçu</th><th>Travaux complétés</th><th>Date / responsable</th></tr>'+f.suivi.map(function(r){return'<tr><td>'+E(r.element)+'</td><td>'+(r.c1?'☑':'☐')+'</td><td>'+(r.c2?'☑':'☐')+'</td><td>'+(r.c3?'☑':'☐')+'</td><td>'+E(r.who)+'</td></tr>';}).join('')+'</table>':'')
      +'<h2>Calendrier prévisionnel</h2><table><tr><th>T1</th><th>T2</th><th>T3</th><th>T4</th></tr><tr><td>'+E(f.timeline.q1)+'</td><td>'+E(f.timeline.q2)+'</td><td>'+E(f.timeline.q3)+'</td><td>'+E(f.timeline.q4)+'</td></tr></table>'
      +(f.callout?'<h2>Recommandation générale</h2><p>'+E(f.callout)+'</p>':'')+'<div class="s"><div>'+E(f.signataire_sa||'Soucy Aquatik')+'</div><div>'+E(f.signataire_client||'Client')+'</div></div>';}
  var w=window.open('','_blank');if(!w){this.flash('Fenêtre bloquée — autorisez les fenêtres pour imprimer');return;}w.document.write(h+'<script>setTimeout(function(){print();},300)<\/script>');w.document.close();};
Comp.prototype.docsVals=function(){var self=this,st=this.state,D=this.D,mod=st.mod,lt=st.logTab,kind=mod==='hivernage'?'hv':(mod==='logistique'?(lt==='so'?'so':'bl'):null);
  if(kind&&this.docs[kind]===undefined)this.loadDocs(kind);var L=kind&&Array.isArray(this.docs[kind])?this.docs[kind]:[],q=norm(st.docQ),flt=st.docF||'tous';
  var rows=L.filter(function(r){var hay=norm([r.no_bon,r.client,r.technicien,r.site_nom,r.nom,r.adresse].join(' '));if(q&&hay.indexOf(q)<0)return false;
    var done=kind==='bl'?r.status==='livre':kind==='so'?r.status==='envoye':r.status==='complete';return flt==='tous'||(flt==='faits'?done:!done);}).map(function(r){
    var done=kind==='bl'?r.status==='livre':kind==='so'?r.status==='envoye':r.status==='complete';
    return{a:kind==='hv'?r.site_nom||'—':r.no_bon||'—',b:kind==='hv'?(r.client||r.objet||''):(r.client||'—'),c:kind==='hv'?(r.date_inspection||'—')+' · '+(r.technicien||'—'):(r.date||'—')+' · '+(kind==='bl'?(r.technicien||'—'):(r.nom||'—')),
      d:(kind==='bl'?(r.items_liv||[]).length+' article(s)':kind==='so'?(r.lignes||[]).length+' ligne(s)':(r.sections||[]).length+' section(s)')+(r.urgent?' · URGENT':''),etat:done?(kind==='bl'?'Livré':kind==='so'?'Envoyée':'Complété'):'Brouillon',open:function(){self.openDoc(kind,r.id);}};});
  var FL3=[['attente',kind==='bl'?'À livrer':'Brouillons'],['faits',kind==='bl'?'Livrés':kind==='so'?'Envoyées':'Complétés'],['tous','Tous']];
  var out={isLogi:mod==='logistique',isHivB:mod==='hivernage',logTabs:[['bl','Bons de livraison'],['so','Sorties d’inventaire']].map(function(x){return Object.assign({label:x[1],go:function(){self.setState({logTab:x[0],docF:'tous',docQ:''});}},segS((lt||'bl')===x[0]));}),
    docFilters:FL3.map(function(x){return Object.assign({label:x[1],go:function(){self.setState({docF:x[0]});}},segS(flt===x[0]));}),docQ:st.docQ||'',onDocQ:function(e){self.setState({docQ:e.target.value});},
    docRows:rows,docNone:!!kind&&Array.isArray(this.docs[kind])&&!rows.length,docLoading:!!kind&&this.docs[kind]===null,docErr:kind&&this.docs[kind]==='err'?'Lecture impossible : '+(this.docErr||''):'',
    docNew:function(){self.openDoc(kind);},docNewLbl:kind==='bl'?'Nouveau bon de livraison':kind==='so'?'Nouvelle sortie':'Nouveau rapport'};
  var de=st.de;out.deOpen=!!de;if(!de)return out;var f=de.f,k=de.kind;
  var fld=function(key){return{v:f[key]==null?'':f[key],on:function(e){var v=e.target.type==='checkbox'?e.target.checked:e.target.value;self.deMut(function(ff){ff[key]=v;if(key==='client'||key==='site_nom'){var s=D.sites.filter(function(x){return norm(x.nom)===norm(v);})[0];if(s&&k==='bl'&&!ff.adresse)ff.adresse=s.addr;}});}};};
  var rowsV=function(key){return(f[key]||[]).map(function(r,i){return{cells:ROWS[key].map(function(c){return{v:r[c[0]]==null?'':r[c[0]],ph:c[1],w:c[2],on:function(e){var v=e.target.value;self.deMut(function(ff){ff[key][i][c[0]]=v;});}};}),
    del:function(){self.deMut(function(ff){ff[key].splice(i,1);});},prio:key==='plan'?HIV_TAGS.map(function(t){return{v:t[0],l:t[1],sel:(r.prio||'')===t[0]};}):[],onPrio:function(e){var v=e.target.value;self.deMut(function(ff){ff[key][i].prio=v;});}};});};
  var add=function(key,o){return function(){self.deMut(function(ff){ff[key]=(ff[key]||[]).concat([o()]);});};};
  var photos=function(arr,setArr){return(arr||[]).map(function(p,i){var src=p.data||p.url||'';return{name:p.name||('Photo '+(i+1)),src:src,has:/^data:image|^https?:/.test(src),open:function(){var w=window.open('','_blank');if(w){w.document.write('<img src="'+src+'" style="max-width:100%">');w.document.close();}},del:function(){setArr(function(a){a.splice(i,1);});}};});};
  var pick=function(cb){var inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.onchange=function(){var file=inp.files&&inp.files[0];if(!file)return;var img=new Image(),u=URL.createObjectURL(file);img.onload=function(){var s=Math.min(1,1400/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);cb({data:c.toDataURL('image/jpeg',0.7),name:file.name,addedBy:self.user.id,addedAt:nowIso()});};img.src=u;};inp.click();};
  var techs=D.comptes.filter(function(c){return c.role!=='admin'&&D.statut[c.id]!=='inactif';}).map(function(c){var n=(c.prenom+' '+c.nom).trim();return{v:n,l:n,id:c.id,sel:(k==='bl'?f.technicien:k==='so'?f.nom:f.technicien)===n};});
  var done=k==='bl'?f.status==='livre':k==='so'?f.status==='envoye':f.status==='complete',me=(self.user.prenom+' '+self.user.nom).trim();
  var deV={deTitle:(de.id?'':'Nouveau · ')+DOC[k].lbl+(f.no_bon?' '+f.no_bon:''),isBL:k==='bl',isSO:k==='so',isHV:k==='hv',sitesList2:D.sites.map(function(s){return{v:s.nom};}),invList:(D.inv||[]).map(function(i){return{v:i.nom};}),
    dClient:fld('client'),dTel:fld('tel'),dAdr:fld('adresse'),dDate:fld('date'),dHeure:fld('heure'),dUrg:fld('urgent'),dNom:fld('nom'),dDept:fld('departement'),dNoEmp:fld('no_employe'),
    dSite:fld('site_nom'),dObjet:fld('objet'),dTitre:fld('titre'),dDR:fld('date_rapport'),dDI:fld('date_inspection'),dPrep:fld('prepare_par'),dTech:fld('technicien'),dCall:fld('callout'),dSSA:fld('signataire_sa'),dSCl:fld('signataire_client'),
    dTechs:techs,onDTech:function(e){var v=e.target.value,t=techs.filter(function(x){return x.v===v;})[0];self.deMut(function(ff){if(k==='so'){ff.nom=v;if(t)ff.no_employe=t.id;}else ff.technicien=v;});},
    dQ:['q1','q2','q3','q4'].map(function(q,i){return{l:'T'+(i+1),v:(f.timeline||{})[q]||'',on:function(e){var v=e.target.value;self.deMut(function(ff){ff.timeline=ff.timeline||{};ff.timeline[q]=v;});}};}),
    rLiv:rowsV('items_liv'),rRet:rowsV('items_ret'),rLig:rowsV('lignes'),rPlan:rowsV('plan'),
    addLiv:add('items_liv',function(){return{item:'',qteSortie:'',unite:'',qteLivree:'',statut:''};}),addRet:add('items_ret',function(){return{item:'',qteRecuperee:'',unite:'',raison:''};}),
    addLig:add('lignes',function(){return{code:'',loc:'',desc:'',qteSortie:'',qteRetour:'',projet:''};}),addPlan:add('plan',function(){return{num:String((f.plan||[]).length+1),element:'',travaux:'',prio:'',periode:'',remarques:''};}),
    addSuivi:add('suivi',function(){return{element:'',c1:false,c2:false,c3:false,who:''};}),addSec:add('sections',function(){return{id:pmmId(),title:'',tag:'',items:[],photos:[]};}),
    rSuivi:(f.suivi||[]).map(function(r,i){var ck=function(c,l){return{l:l,on:!!r[c],box:r[c]?'var(--color-text)':'transparent',go:function(){self.deMut(function(ff){ff.suivi[i][c]=!ff.suivi[i][c];});}};};
      return{el:r.element||'',onEl:function(e){var v=e.target.value;self.deMut(function(ff){ff.suivi[i].element=v;});},who:r.who||'',onWho:function(e){var v=e.target.value;self.deMut(function(ff){ff.suivi[i].who=v;});},cks:[ck('c1','Devis demandé'),ck('c2','Devis reçu'),ck('c3','Travaux complétés')],del:function(){self.deMut(function(ff){ff.suivi.splice(i,1);});}};}),
    dSecs:(f.sections||[]).map(function(s,si){return{title:s.title||'',onTitle:function(e){var v=e.target.value;self.deMut(function(ff){ff.sections[si].title=v;});},tags:HIV_TAGS.map(function(t){return{v:t[0],l:t[1],sel:(s.tag||'')===t[0]};}),onTag:function(e){var v=e.target.value;self.deMut(function(ff){ff.sections[si].tag=v;});},
      items:(s.items||[]).map(function(it,ii){return{v:it,on:function(e){var v=e.target.value;self.deMut(function(ff){ff.sections[si].items[ii]=v;});},del:function(){self.deMut(function(ff){ff.sections[si].items.splice(ii,1);});}};}),
      addItem:function(){self.deMut(function(ff){ff.sections[si].items=(ff.sections[si].items||[]).concat(['']);});},del:function(){self.deMut(function(ff){ff.sections.splice(si,1);});},
      photos:photos(s.photos,function(fn){self.deMut(function(ff){fn(ff.sections[si].photos);});}),addPhoto:function(){pick(function(p){self.deMut(function(ff){ff.sections[si].photos=(ff.sections[si].photos||[]).concat([p]);});});}};}),
    blPhotos:photos(f.photos,function(fn){self.deMut(function(ff){fn(ff.photos);});}),addBlPhoto:function(){pick(function(p){self.deMut(function(ff){ff.photos=(ff.photos||[]).concat([p]);});});},
    deDone:done,deNotDone:!done,deDoneTxt:k==='bl'&&done?'Livré le '+(f.livre_at?new Date(f.livre_at).toLocaleString('fr-CA'):'')+' — '+(f.livre_par_nom||''):(k==='so'&&done?'Envoyée au superviseur':(done?'Rapport complété':'')),
    deFinalLbl:k==='bl'?'Marquer livré':k==='so'?'Envoyer au superviseur':'Marquer complété',
    deFinal:function(){var x=k==='bl'?{status:'livre',livre_at:nowIso(),livre_by:self.user.id,livre_par_nom:me}:k==='so'?{status:'envoye',sent_at:nowIso()}:{status:'complete'};self.saveDoc(x,k==='bl'?'Bon marqué livré':k==='so'?'Sortie envoyée':'Rapport complété');},
    deReopen:function(){self.saveDoc({status:'brouillon'},'Remis en brouillon');},
    deSave:function(){self.saveDoc();},deSaveLbl:de.busy?'Enregistrement…':'Enregistrer',deCanDel:!!de.id,deDelLbl:de.confirm?'Confirmer la suppression':'Supprimer',deDel:function(){self.deleteDoc();},dePrint:function(){self.printDoc();},
    deClose:function(){self.setState({de:null});},deCloseBg:function(e){if(e.target===e.currentTarget)self.setState({de:null});}};
  return Object.assign(out,deV);};

/* ═════════════ STOCK (inventaire) et FLOTTE — mêmes tables et mêmes champs que SA Platform ═════════════ */
var INV_CATS=[['chimique','Chimique'],['equipement','Équipement'],['piece','Pièce'],['consommable','Consommable'],['autre','Autre']];
var INV_UNITS=['kg','L','unité','sac','boîte'];
function nbr(v){var n=parseFloat(String(v==null?'':v).replace(',','.'));return isFinite(n)?n:0;}
function invLow(i){return nbr(i.seuil)>0&&nbr(i.qte)<=nbr(i.seuil);}
Comp.prototype.loadStock=function(kind,force){var self=this,k=kind==='fl'?'flt':'stk';if(!force&&this[k])return;this[k]='loading';
  get(kind==='fl'?'flotte?select=*&order=nom.asc':'inventaire?select=*&order=nom.asc').then(function(r){self[k]=r;
    if(self.D){if(kind==='fl')self.D.flotte=r.map(function(v){return{id:v.id,nom:v.nom,plaque:v.plaque};});else self.D.inv=r.map(function(i){return{id:i.id,nom:i.nom,qte:i.qte,seuil:i.seuil};});}self.update();})
    .catch(function(e){self[k]='err';self.stkErr=netMsg(e);self.update();});};
Comp.prototype.openStk=function(kind,id){var L=Array.isArray(this[kind==='fl'?'flt':'stk'])?this[kind==='fl'?'flt':'stk']:[],x=id?L.filter(function(r){return r.id===id;})[0]:null;
  var f=x?JSON.parse(JSON.stringify(x)):(kind==='fl'?{nom:'',plaque:'',annee:'',couleur:'',km:'',assigne:'',notes:''}:{nom:'',categorie:'chimique',unite:'kg',qte:'',seuil:'',prix:'',notes:''});
  Object.keys(f).forEach(function(k){if(f[k]==null)f[k]='';});
  this.setState({se:{kind:kind,id:id||null,f:f,delta:'',confirm:false,busy:false}});};
Comp.prototype.seSet=function(k,v){var se=this.state.se,f=Object.assign({},se.f);f[k]=v;this.setState({se:Object.assign({},se,{f:f,confirm:false})});};
Comp.prototype.saveStk=function(){var self=this,se=this.state.se;if(!se||se.busy)return;var f=se.f,fl=se.kind==='fl',tb=fl?'flotte':'inventaire';
  if(!String(f.nom).trim()){this.flash(fl?'Le nom du véhicule est requis':'Le nom du produit est requis');return;}
  var body=fl?{nom:String(f.nom).trim(),plaque:String(f.plaque||'').trim().toUpperCase(),annee:String(f.annee||''),couleur:String(f.couleur||'').trim(),km:String(f.km||''),assigne:String(f.assigne||'').trim(),notes:String(f.notes||'').trim()}
    :{nom:String(f.nom).trim(),categorie:f.categorie||'autre',unite:f.unite||'unité',qte:nbr(f.qte),seuil:nbr(f.seuil),prix:nbr(f.prix),notes:String(f.notes||'').trim()};
  body.updated_at=nowIso();this.setState({se:Object.assign({},se,{busy:true})});
  (se.id?rest('PATCH',tb+'?id=eq.'+encodeURIComponent(se.id),body):postRows(tb,[Object.assign({id:pmmId()},body)])).then(function(){
    auditT(self,se.id?'MODIFICATION':'CREATION',tb,se.id||body.nom);self.setState({se:null});self.flash(fl?'Véhicule enregistré':'Produit enregistré');self.loadStock(se.kind,true);})
    .catch(function(e){self.setState({se:Object.assign({},self.state.se,{busy:false})});self.flash('Échec — rien n’a été modifié : '+netMsg(e));});};
/* Entrée / sortie de stock : relit la quantité sur le serveur et n'écrit que si personne ne l'a changée entre-temps */
Comp.prototype.adjustStk=function(sign){var self=this,se=this.state.se;if(!se||!se.id||se.busy)return;var d=nbr(se.delta);if(!(d>0)){this.flash('Indiquez une quantité');return;}
  var id=encodeURIComponent(se.id),tries=0;this.setState({se:Object.assign({},se,{busy:true})});
  var go=function(){return get('inventaire?select=qte,updated_at&id=eq.'+id).then(function(r){if(!r.length)throw new Error('produit supprimé entre-temps');var q=Math.round((nbr(r[0].qte)+sign*d)*1000)/1000;
    if(q<0)throw new Error('stock insuffisant ('+nbr(r[0].qte)+' en stock)');
    return rest('PATCH','inventaire?id=eq.'+id+'&updated_at='+(r[0].updated_at?'eq.'+encodeURIComponent(r[0].updated_at):'is.null'),{qte:q,updated_at:nowIso()},'return=representation').then(function(w){
      if(Array.isArray(w)&&!w.length){if(++tries<3)return go();throw new Error('modifié en même temps ailleurs, réessayez');}return q;});});};
  go().then(function(q){auditT(self,'MODIFICATION','inventaire',se.id,{mouvement:(sign>0?'+':'-')+d,qte:q});var s2=self.state.se,f=Object.assign({},s2.f,{qte:q});
    self.setState({se:Object.assign({},s2,{f:f,delta:'',busy:false})});self.flash((sign>0?'Entrée':'Sortie')+' enregistrée — stock : '+q);self.loadStock('inv',true);})
    .catch(function(e){self.setState({se:Object.assign({},self.state.se,{busy:false})});self.flash('Échec : '+netMsg(e));});};
Comp.prototype.deleteStk=function(){var self=this,se=this.state.se;if(!se||!se.id)return;if(!se.confirm){this.setState({se:Object.assign({},se,{confirm:true})});return;}var tb=se.kind==='fl'?'flotte':'inventaire';
  rest('DELETE',tb+'?id=eq.'+encodeURIComponent(se.id)).then(function(){auditT(self,'SUPPRESSION',tb,se.id);self.setState({se:null});self.flash('Supprimé');self.loadStock(se.kind,true);}).catch(function(e){self.flash('Échec : '+netMsg(e));});};
Comp.prototype.exportStock=function(){var L=Array.isArray(this.stk)?this.stk:[],cat={};INV_CATS.forEach(function(c){cat[c[0]]=c[1];});
  var N=function(v){return{v:nbr(v),s:3};},data=[['Produit','Catégorie','Qté','Unité','Seuil','Prix unitaire','Valeur','Sous le seuil','Notes'].map(function(h){return{v:h,s:1};})];
  L.forEach(function(i){data.push([i.nom,cat[i.categorie]||i.categorie||'',N(i.qte),i.unite||'',N(i.seuil),N(i.prix),N(nbr(i.qte)*nbr(i.prix)),invLow(i)?'OUI':'',i.notes||'']);});
  data.push([{v:'Total',s:2},'','','','','',{v:L.reduce(function(s,i){return s+nbr(i.qte)*nbr(i.prix);},0),s:4}]);
  saveBlob(xlsxBlob([{name:'Stock',widths:[30,14,10,8,10,12,12,12,30],rows:data}]),'SoucyAquatik_Stock_'+iso(new Date())+'.xlsx');auditT(this,'EXPORT','inventaire','xlsx');this.flash('Fichier Excel téléchargé');};
Comp.prototype.stockVals=function(){var self=this,st=this.state,mod=st.mod,names=this.names();
  if(mod==='stock'&&!this.stk)this.loadStock('inv');if(mod==='flotte'&&!this.flt)this.loadStock('fl');
  var cat={};INV_CATS.forEach(function(c){cat[c[0]]=c[1];});var q=norm(st.stkQ),cf=st.stkCat||'tous';
  var inv=Array.isArray(this.stk)?this.stk:[],low=inv.filter(invLow);
  var iRows=inv.filter(function(i){return(!q||norm(i.nom+' '+(i.notes||'')).indexOf(q)>=0)&&(cf==='tous'||(cf==='bas'?invLow(i):i.categorie===cf));}).map(function(i){var lo=invLow(i);
    return{nom:i.nom,cat:cat[i.categorie]||i.categorie||'—',qte:nbr(i.qte)+' '+(i.unite||''),seuil:nbr(i.seuil)?String(nbr(i.seuil)):'—',prix:nbr(i.prix)?nbr(i.prix).toFixed(2)+' $':'—',val:nbr(i.prix)?(nbr(i.qte)*nbr(i.prix)).toFixed(2)+' $':'—',
      low:lo,fw:lo?700:400,etat:lo?'Sous le seuil':'',open:function(){self.openStk('inv',i.id);}};});
  var fl=Array.isArray(this.flt)?this.flt:[];
  var fRows=fl.filter(function(v){return!q||norm([v.nom,v.plaque,v.assigne,names[v.assigne]].join(' ')).indexOf(q)>=0;}).map(function(v){
    return{nom:v.nom,plaque:v.plaque||'—',annee:v.annee||'—',couleur:v.couleur||'—',km:v.km?nbr(v.km).toLocaleString('fr-CA')+' km':'—',assigne:v.assigne?(names[v.assigne]||v.assigne):'Disponible',open:function(){self.openStk('fl',v.id);}};});
  var out={isStock:mod==='stock',isFlotte:mod==='flotte',stkQ:st.stkQ||'',onStkQ:function(e){self.setState({stkQ:e.target.value});},
    stkCats:[['tous','Tous']].concat([['bas','Sous le seuil ('+low.length+')']],INV_CATS).map(function(c){return Object.assign({label:c[1],go:function(){self.setState({stkCat:c[0]});}},segS(cf===c[0]));}),
    stkAlert:low.length?low.length+' produit(s) sous le seuil d’alerte : '+low.map(function(i){return i.nom;}).join(', '):'',
    stkSum:inv.length+' produit(s) · valeur en stock : '+inv.reduce(function(s,i){return s+nbr(i.qte)*nbr(i.prix);},0).toFixed(2)+' $',
    iRows:iRows,fRows:fRows,fSum:fl.length+' véhicule(s) · '+fl.filter(function(v){return v.assigne;}).length+' assigné(s)',
    stkLoading:(mod==='stock'&&this.stk==='loading')||(mod==='flotte'&&this.flt==='loading'),stkErr:(mod==='stock'&&this.stk==='err')||(mod==='flotte'&&this.flt==='err')?'Lecture impossible : '+(this.stkErr||''):'',
    stkNone:(mod==='stock'&&Array.isArray(this.stk)&&!iRows.length)||(mod==='flotte'&&Array.isArray(this.flt)&&!fRows.length),
    stkNew:function(){self.openStk('inv');},fltNew:function(){self.openStk('fl');},stkExport:function(){self.exportStock();}};
  var se=st.se;out.seOpen=!!se;if(!se)return out;var f=se.f,isFl=se.kind==='fl';
  var F=function(k){return{v:f[k],on:function(e){self.seSet(k,e.target.value);}};};
  return Object.assign(out,{seTitle:se.id?(isFl?f.nom+(f.plaque?' · '+f.plaque:''):f.nom):(isFl?'Nouveau véhicule':'Nouveau produit'),seFl:isFl,seInv:!isFl,
    sNom:F('nom'),sPlaque:F('plaque'),sAnnee:F('annee'),sCouleur:F('couleur'),sKm:F('km'),sNotes:F('notes'),sQte:F('qte'),sSeuil:F('seuil'),sPrix:F('prix'),
    sCats:INV_CATS.map(function(c){return{v:c[0],l:c[1],sel:f.categorie===c[0]};}),onSCat:function(e){self.seSet('categorie',e.target.value);},
    sUnits:INV_UNITS.concat(INV_UNITS.indexOf(f.unite)<0&&f.unite?[f.unite]:[]).map(function(u){return{v:u,l:u,sel:f.unite===u};}),onSUnit:function(e){self.seSet('unite',e.target.value);},
    sAssignes:[{v:'',l:'Disponible (non assigné)',sel:!f.assigne}].concat(this.D.comptes.filter(function(c){return self.D.statut[c.id]!=='inactif'||c.id===f.assigne;}).map(function(c){return{v:c.id,l:(c.prenom+' '+c.nom).trim()||c.id,sel:f.assigne===c.id};})),onSAssigne:function(e){self.seSet('assigne',e.target.value);},
    seCanAdj:!isFl&&!!se.id,seDelta:se.delta,onSeDelta:function(e){self.setState({se:Object.assign({},self.state.se,{delta:e.target.value})});},seIn:function(){self.adjustStk(1);},seOut:function(){self.adjustStk(-1);},
    seSave:function(){self.saveStk();},seSaveLbl:se.busy?'Enregistrement…':(se.id?'Enregistrer':'Créer'),seCanDel:!!se.id,seDelLbl:se.confirm?'Confirmer la suppression':'Supprimer',seDel:function(){self.deleteStk();},
    seClose:function(){self.setState({se:null});},seCloseBg:function(e){if(e.target===e.currentTarget)self.setState({se:null});}});};

/* ═════════════ OUTILS (QR), EMPLACEMENTS et CONFIGURATION LOGISTIQUE — tables outils, outils_mouvements, logistique_config (SA Platform v61+) ═════════════ */
var LOGI_DEF={categories:[{id:'outil',icon:'🔧',label:'Outil'},{id:'equipement',icon:'⚙️',label:'Équipement'},{id:'securite',icon:'🦺',label:'Sécurité'},{id:'mesure',icon:'📏',label:'Mesure'},{id:'autre',icon:'📋',label:'Autre'}],
  prefixes:[{id:'PER',label:'Perceuses / visseuses',next:1,scope:'outils'},{id:'OUT',label:'Outils génériques',next:1,scope:'outils'},{id:'MES',label:'Instruments de mesure',next:1,scope:'outils'},{id:'SEC',label:'Équipement de sécurité',next:1,scope:'outils'},
    {id:'CHI',label:'Produits chimiques',next:1,scope:'inventaire'},{id:'EQU',label:'Équipements inventaire',next:1,scope:'inventaire'},{id:'CON',label:'Consommables',next:1,scope:'inventaire'}],
  qr_prefix:'SOUCY-DPTM:',
  emplacements:[{id:'EMP-A1',bat:'Entrepôt',zone:'Zone A — Chimiques',nom:'Étagère 1'},{id:'EMP-A2',bat:'Entrepôt',zone:'Zone A — Chimiques',nom:'Étagère 2'},{id:'EMP-B3',bat:'Entrepôt',zone:'Zone B — Outils',nom:'Étagère 3'},{id:'EMP-B4',bat:'Entrepôt',zone:'Zone B — Outils',nom:'Étagère 4'},{id:'EMP-BUR1',bat:'Bureau',zone:'Local technique',nom:'Armoire 1'}]};
var TOOL_ST={disponible:'Disponible',sorti:'Sorti',maintenance:'En maintenance'};
function cfgVal(rows,k){var r=(rows||[]).filter(function(x){return x.id===k;})[0],v=r&&r.value;if(k==='emplacements'||k==='categories'||k==='prefixes')return Array.isArray(v)&&v.length?v:JSON.parse(JSON.stringify(LOGI_DEF[k]));return v||LOGI_DEF[k];}
function qrData(text){var d=document.createElement('div');new QRCode(d,{text:text,width:240,height:240,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.L});var c=d.querySelector('canvas');return c?c.toDataURL('image/png'):((d.querySelector('img')||{}).src||'');}
function pickImg(user,cb){var inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.onchange=function(){var file=inp.files&&inp.files[0];if(!file)return;var img=new Image(),u=URL.createObjectURL(file);img.onload=function(){var s=Math.min(1,1200/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);cb({data:c.toDataURL('image/jpeg',0.7),name:'photo',addedBy:user.id,addedAt:nowIso()});};img.src=u;};inp.click();}
Comp.prototype.loadOutils=function(force){var self=this;if(!force&&this.tools)return;if(!this.tools)this.tools='loading';
  Promise.all([get('outils?select=*&order=nom.asc'),get('outils_mouvements?select=*&order=created_at.desc&limit=500'),get('logistique_config?select=*')]).then(function(r){self.tools=r[0];self.tmoves=r[1];self.lcfg=r[2];self.update();})
    .catch(function(e){self.tools='err';self.toolErr=netMsg(e);self.update();});};
/* Écrit une clé de configuration en partant de la valeur relue au serveur (jamais d'une copie périmée) */
Comp.prototype.mutCfg=function(key,fn){var self=this;return get('logistique_config?select=*&id=eq.'+key).then(function(r){var v=JSON.parse(JSON.stringify(cfgVal(r,key)));var nv=fn(v);if(nv===undefined)nv=v;
  return rest('POST','logistique_config?on_conflict=id',[{id:key,value:nv,updated_at:nowIso()}],'resolution=merge-duplicates,return=representation');});};
Comp.prototype.cfg=function(k){return cfgVal(Array.isArray(this.lcfg)?this.lcfg:[],k);};
Comp.prototype.openTool=function(id){var L=Array.isArray(this.tools)?this.tools:[],t=id?L.filter(function(x){return x.id===id;})[0]:null,pres=this.cfg('prefixes').filter(function(p){return p.scope!=='inventaire';});
  var f;if(t){var rp=String(t.reperage||'').split('-');f={prefix:rp[0]||'',num:rp.slice(1).join('-')||'',nom:t.nom||'',categorie_id:t.categorie_id||'',emplacement:t.emplacement||'',notes:t.notes||'',photos:(t.photos||[]).slice()};}
  else{var p0=pres[0]||{id:'OUT',next:1};f={prefix:p0.id,num:String(p0.next||1).padStart(4,'0'),nom:'',categorie_id:(this.cfg('categories')[0]||{}).id||'',emplacement:'',notes:'',photos:[]};}
  this.setState({te:{id:id||null,f:f,confirm:false,busy:false}});};
Comp.prototype.teSet=function(k,v){var te=this.state.te,f=Object.assign({},te.f);f[k]=v;if(k==='prefix'&&!te.id){var p=this.cfg('prefixes').filter(function(x){return x.id===v;})[0];f.num=String((p&&p.next)||1).padStart(4,'0');}this.setState({te:Object.assign({},te,{f:f,confirm:false})});};
Comp.prototype.toolAudit=function(action,id,d){auditT(this,action,'outils',id,d);};
Comp.prototype.saveTool=function(){var self=this,te=this.state.te;if(!te||te.busy)return;var f=te.f,nom=String(f.nom).trim(),num=String(f.num).trim(),rep=f.prefix+'-'+num,L=Array.isArray(this.tools)?this.tools:[];
  if(!nom){this.flash('Le nom de l’outil est requis');return;}if(!num){this.flash('Le numéro de repérage est requis');return;}
  if(L.some(function(x){return x.reperage===rep&&x.id!==te.id;})){this.flash('Ce repérage existe déjà');return;}
  var body={reperage:rep,nom:nom,categorie_id:f.categorie_id,qr_payload:this.cfg('qr_prefix')+rep+'|'+nom,notes:String(f.notes||'').trim(),emplacement:f.emplacement||'',photos:f.photos||[],updated_at:nowIso()};
  this.setState({te:Object.assign({},te,{busy:true})});
  var w=te.id?rest('PATCH','outils?id=eq.'+encodeURIComponent(te.id),body)
    :postRows('outils',[Object.assign({id:pmmId(),status:'disponible',current_holder:'',current_holder_name:'',current_punch_task_id:'',current_punch_week:'',created_at:nowIso()},body)]).then(function(r){
      return self.mutCfg('prefixes',function(ps){var p=ps.filter(function(x){return x.id===f.prefix;})[0];var n=parseInt(num,10);if(p&&n>=(p.next||1))p.next=n+1;}).catch(function(){}).then(function(){return r;});});
  w.then(function(r){var id=te.id||(r&&r[0]&&r[0].id);self.toolAudit(te.id?'MODIFICATION':'CREATION',id,{reperage:rep});self.setState({te:null});self.flash('Outil enregistré');self.loadOutils(true);})
   .catch(function(e){self.setState({te:Object.assign({},self.state.te,{busy:false})});self.flash('Échec — rien n’a été modifié : '+netMsg(e));});};
Comp.prototype.toolMove=function(t,action,notes){var me=(this.user.prenom+' '+this.user.nom).trim(),n=new Date();
  return postRows('outils_mouvements',[{id:pmmId(),tool_id:t.id,tool_reperage:t.reperage,tool_nom:t.nom,uid:this.user.id,emp_nom:me,action:action,punch_task_id:'',punch_week:'',punch_date:iso(n),heure:pad(n.getHours())+':'+pad(n.getMinutes()),site_id:'',site_nom:'',wo_id:'',gps:null,notes:notes||'',created_at:nowIso(),updated_at:nowIso()}]);};
/* Statut écrit seulement si l'outil est toujours dans l'état affiché (un technicien a pu le prendre entre-temps) */
Comp.prototype.toolStatus=function(to){var self=this,te=this.state.te,L=Array.isArray(this.tools)?this.tools:[],t=te&&L.filter(function(x){return x.id===te.id;})[0];if(!t||te.busy)return;
  var from=t.status||'disponible',holder=t.current_holder_name||this.names()[t.current_holder]||t.current_holder||'';
  var body={status:to,updated_at:nowIso()};if(to==='disponible'&&from==='sorti')Object.assign(body,{current_holder:'',current_holder_name:'',current_punch_task_id:'',current_punch_week:''});
  this.setState({te:Object.assign({},te,{busy:true})});
  rest('PATCH','outils?id=eq.'+encodeURIComponent(t.id)+'&status='+(t.status?'eq.'+encodeURIComponent(t.status):'is.null'),body).then(function(w){
    if(Array.isArray(w)&&!w.length)throw new Error('l’outil vient de changer d’état (pris ou retourné sur le terrain) — rechargé');
    var forced=from==='sorti';return (forced?self.toolMove(t,'retour','Retour forcé par '+(self.user.prenom+' '+self.user.nom).trim()+' (détenu par '+holder+')'):Promise.resolve()).then(function(){
      self.toolAudit('MODIFICATION',t.id,forced?{action:'retour',force:true}:{action:'maintenance',statut:to});self.setState({te:Object.assign({},self.state.te,{busy:false})});
      self.flash(forced?'Retour forcé enregistré':(to==='maintenance'?'Mis en maintenance':'Remis en service'));self.loadOutils(true);});})
    .catch(function(e){self.setState({te:Object.assign({},self.state.te,{busy:false})});self.flash('Échec : '+netMsg(e));self.loadOutils(true);});};
Comp.prototype.deleteTool=function(){var self=this,te=this.state.te;if(!te||!te.id)return;if(!te.confirm){this.setState({te:Object.assign({},te,{confirm:true})});return;}
  rest('DELETE','outils?id=eq.'+encodeURIComponent(te.id)).then(function(){self.toolAudit('SUPPRESSION',te.id);self.setState({te:null});self.flash('Outil supprimé (historique conservé)');self.loadOutils(true);}).catch(function(e){self.flash('Échec : '+netMsg(e));});};
Comp.prototype.printLabels=function(items){var w=window.open('','_blank');if(!w){this.flash('Fenêtre bloquée — autorisez les fenêtres pour imprimer');return;}
  var h='<!doctype html><meta charset="utf-8"><title>Étiquettes QR</title><style>@page{margin:8mm}body{margin:0;font-family:Arial,sans-serif;display:flex;flex-wrap:wrap;gap:3mm}.l{width:3cm;height:3cm;border:1px dashed #bbb;box-sizing:border-box;padding:1mm;display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-inside:avoid}.l img{width:2.2cm;height:2.2cm}.r{font-size:6pt;font-weight:700;margin-top:.6mm}.s{font-size:5pt;text-align:center;overflow:hidden;white-space:nowrap;max-width:2.8cm}</style>';
  items.forEach(function(i){h+='<div class="l"><img src="'+qrData(i.payload)+'" alt=""><div class="r">'+escH(i.code)+'</div>'+(i.sub?'<div class="s">'+escH(i.sub)+'</div>':'')+'</div>';});
  w.document.write(h+'<script>setTimeout(function(){print();},300)<\/script>');w.document.close();};
Comp.prototype.openKe=function(kind,id){var src=kind==='cat'?this.cfg('categories'):kind==='pre'?this.cfg('prefixes'):this.cfg('emplacements'),x=id?src.filter(function(r){return r.id===id;})[0]:null;
  var f=x?JSON.parse(JSON.stringify(x)):({cat:{id:'',icon:'🔧',label:''},pre:{id:'',label:'',next:1,scope:'outils'},emp:{id:'EMP-',bat:'Entrepôt',zone:'',nom:''}})[kind];
  this.setState({ke:{kind:kind,id:id||null,f:f,confirm:false,busy:false}});};
Comp.prototype.keSet=function(k,v){var ke=this.state.ke,f=Object.assign({},ke.f);f[k]=v;this.setState({ke:Object.assign({},ke,{f:f,confirm:false})});};
var KE_KEY={cat:'categories',pre:'prefixes',emp:'emplacements'};
Comp.prototype.saveKe=function(del){var self=this,ke=this.state.ke;if(!ke||ke.busy)return;var f=ke.f,k=ke.kind,L=Array.isArray(this.tools)?this.tools:[];
  if(del){var used=L.filter(function(t){return k==='cat'?t.categorie_id===ke.id:t.emplacement===ke.id;}).length;if(used){this.flash('Impossible : '+used+' outil(s) '+(k==='cat'?'dans cette catégorie':'rangé(s) ici'));return;}
    if(!ke.confirm){this.setState({ke:Object.assign({},ke,{confirm:true})});return;}}
  else{var id=k==='cat'?(ke.id||String(f.label).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')):ke.id||String(f.id).toUpperCase().replace(/[^A-Z0-9-]/g,'');
    if(k==='cat'&&!String(f.label).trim()||k==='pre'&&!String(f.label).trim()||k==='emp'&&!(String(f.zone).trim()&&String(f.nom).trim()&&String(f.bat).trim())){this.flash('Remplissez tous les champs');return;}
    if(!id||k==='emp'&&id==='EMP-'){this.flash('Code invalide');return;}
    if(!ke.id&&this.cfg(KE_KEY[k]).some(function(x){return x.id===id;})){this.flash('Ce code existe déjà');return;}
    var row=k==='cat'?{id:id,icon:String(f.icon||'📋').trim(),label:String(f.label).trim()}:k==='pre'?{id:id,label:String(f.label).trim(),next:Math.max(1,parseInt(f.next,10)||1),scope:f.scope==='inventaire'?'inventaire':'outils'}:{id:id,bat:String(f.bat).trim(),zone:String(f.zone).trim(),nom:String(f.nom).trim()};}
  this.setState({ke:Object.assign({},ke,{busy:true})});
  this.mutCfg(KE_KEY[k],function(arr){var i=arr.findIndex(function(x){return x.id===(ke.id||row.id);});if(del){if(i>=0)arr.splice(i,1);}else if(i>=0)arr[i]=Object.assign({},arr[i],row);else arr.push(row);})
    .then(function(){auditT(self,del?'SUPPRESSION':(ke.id?'MODIFICATION':'CREATION'),'logistique_config',KE_KEY[k],{id:ke.id||row.id});self.setState({ke:null});self.flash(del?'Supprimé':'Enregistré');self.loadOutils(true);})
    .catch(function(e){self.setState({ke:Object.assign({},self.state.ke,{busy:false})});self.flash('Échec : '+netMsg(e));});};
Comp.prototype.saveQrPrefix=function(){var self=this,v=String(this.state.qrIn==null?this.cfg('qr_prefix'):this.state.qrIn).trim();if(!v){this.flash('Préfixe requis');return;}
  this.mutCfg('qr_prefix',function(){return v;}).then(function(){auditT(self,'MODIFICATION','logistique_config','qr_prefix',{valeur:v});self.setState({qrIn:null});self.flash('Préfixe QR enregistré — réimprimez les étiquettes des outils modifiés ensuite');self.loadOutils(true);}).catch(function(e){self.flash('Échec : '+netMsg(e));});};
Comp.prototype.outilsVals=function(){var self=this,st=this.state,mod=st.mod,names=this.names();if(mod==='outils'&&!this.tools)this.loadOutils();
  var tab=st.outTab||'outils',L=Array.isArray(this.tools)?this.tools:[],cats=this.cfg('categories'),emps=this.cfg('emplacements'),pres=this.cfg('prefixes'),qp=this.cfg('qr_prefix');
  var catI={};cats.forEach(function(c){catI[c.id]=c;});var empI={};emps.forEach(function(e){empI[e.id]=e;});
  var holderOf=function(t){return t.current_holder_name||names[t.current_holder]||t.current_holder||'';};
  var q=norm(st.outQ),flt=st.outF||'tous';
  var rows=L.filter(function(t){return(flt==='tous'||(t.status||'disponible')===flt)&&(!q||norm([t.nom,t.reperage,t.notes,holderOf(t)].join(' ')).indexOf(q)>=0);}).map(function(t){var s=t.status||'disponible',e=empI[t.emplacement];
    return{nom:t.nom,rep:t.reperage||'',cat:catI[t.categorie_id]?catI[t.categorie_id].icon+' '+catI[t.categorie_id].label:(t.categorie_id||'—'),etat:TOOL_ST[s]+(s==='sorti'?' — '+holderOf(t):''),fw:s==='disponible'?400:700,emp:e?e.nom+' ('+e.id+')':(t.emplacement||'—'),open:function(){self.openTool(t.id);}};});
  var cnt=function(s){return L.filter(function(t){return(t.status||'disponible')===s;}).length;};
  var bats=[],byBat={};emps.forEach(function(e){if(!byBat[e.bat]){byBat[e.bat]=[];bats.push(e.bat);}byBat[e.bat].push(e);});
  var empGroups=bats.map(function(b){return{bat:b,rows:byBat[b].map(function(e){var inn=L.filter(function(t){return t.emplacement===e.id;}),so=inn.filter(function(t){return t.status==='sorti';}).length;
    return{id:e.id,zone:e.zone,nom:e.nom,n:inn.length+' outil(s)'+(so?' · '+so+' sorti(s)':''),items:inn.length?inn.slice(0,4).map(function(t){return t.nom;}).join(' · ')+(inn.length>4?' …':''):'vide',
      edit:function(){self.openKe('emp',e.id);},print:function(){self.printLabels([{payload:qp+e.id+'|'+e.bat+' '+e.nom,code:e.id,sub:e.nom}]);}};})};});
  var sansEmp=L.filter(function(t){return!t.emplacement;}).length;
  var out={isOutils:mod==='outils',outTabs:[['outils','Outils ('+L.length+')'],['emp','Emplacements'],['cfg','Configuration']].map(function(x){return Object.assign({label:x[1],go:function(){self.setState({outTab:x[0]});}},segS(tab===x[0]));}),
    otOutils:tab==='outils',otEmp:tab==='emp',otCfg:tab==='cfg',outLoading:this.tools==='loading',outErr:this.tools==='err'?'Lecture impossible : '+(this.toolErr||''):'',
    outFilters:[['tous','Tous'],['disponible','Disponibles ('+cnt('disponible')+')'],['sorti','Sortis ('+cnt('sorti')+')'],['maintenance','Maintenance ('+cnt('maintenance')+')']].map(function(x){return Object.assign({label:x[1],go:function(){self.setState({outF:x[0]});}},segS(flt===x[0]));}),
    outQ:st.outQ||'',onOutQ:function(e){self.setState({outQ:e.target.value});},oRows:rows,oNone:Array.isArray(this.tools)&&!rows.length,
    oNew:function(){self.openTool(null);},oPrintAll:function(){var r=L.filter(function(t){return rows.some(function(x){return x.rep===t.reperage;});});if(!r.length){self.flash('Aucun outil à imprimer');return;}self.printLabels(r.map(function(t){return{payload:t.qr_payload||(qp+t.reperage+'|'+t.nom),code:t.reperage,sub:t.nom};}));},
    empGroups:empGroups,empSans:sansEmp?sansEmp+' outil(s) sans emplacement — ouvrez leur fiche pour en assigner un.':'',empNew:function(){self.openKe('emp',null);},
    empPrintAll:function(){self.printLabels(emps.map(function(e){return{payload:qp+e.id+'|'+e.bat+' '+e.nom,code:e.id,sub:e.nom};}));},
    cfgCats:cats.map(function(c){return{icon:c.icon,label:c.label,n:L.filter(function(t){return t.categorie_id===c.id;}).length+' outil(s)',edit:function(){self.openKe('cat',c.id);}};}),
    cfgPres:pres.map(function(p){return{id:p.id+'-',label:p.label,n:p.scope==='inventaire'?'(inventaire)':'prochain : '+String(p.next||1).padStart(4,'0'),edit:function(){self.openKe('pre',p.id);}};}),
    catNew:function(){self.openKe('cat',null);},preNew:function(){self.openKe('pre',null);},
    qrIn:st.qrIn==null?qp:st.qrIn,onQrIn:function(e){self.setState({qrIn:e.target.value});},qrSave:function(){self.saveQrPrefix();},qrFmt:'Format du code : '+(st.qrIn==null?qp:st.qrIn)+'{repérage}|{nom}'};
  var te=st.te;out.teOpen=!!te;
  if(te){var f=te.f,t=te.id?L.filter(function(x){return x.id===te.id;})[0]:null,s=t?(t.status||'disponible'):'disponible',rep=f.prefix+'-'+f.num,set=function(k){return function(e){self.teSet(k,e.target.value);};};
    var mv=(Array.isArray(this.tmoves)?this.tmoves:[]).filter(function(m){return te.id&&m.tool_id===te.id;}).slice(0,10).map(function(m){return{txt:(m.action==='sortie'?'Sortie':'Retour')+' — '+(m.emp_nom||m.uid||''),sub:(m.punch_date||'')+' '+(m.heure||'')+(m.site_nom?' · '+m.site_nom:'')+(m.notes?' · '+m.notes:'')};});
    Object.assign(out,{teTitle:t?t.nom:'Nouvel outil',teRep:rep,tePayload:qp+rep+'|'+(String(f.nom).trim()||'Nouvel outil'),teEtat:t?TOOL_ST[s]+(s==='sorti'?' par '+holderOf(t):''):'',teHasEtat:!!t,
      tePres:pres.filter(function(p){return p.scope!=='inventaire'||p.id===f.prefix;}).map(function(p){return{v:p.id,l:p.id+' — '+p.label,sel:f.prefix===p.id};}),onTePre:set('prefix'),teNum:f.num,onTeNum:set('num'),teNom:f.nom,onTeNom:set('nom'),teNotes:f.notes,onTeNotes:set('notes'),
      teCats:cats.map(function(c){return{v:c.id,l:c.icon+' '+c.label,sel:f.categorie_id===c.id};}),onTeCat:set('categorie_id'),
      teEmps:[{v:'',l:'— Aucun —',sel:!f.emplacement}].concat(emps.map(function(e){return{v:e.id,l:e.bat+' · '+e.zone+' · '+e.nom,sel:f.emplacement===e.id};})),onTeEmp:set('emplacement'),
      tePhotos:(f.photos||[]).map(function(p,i){return{name:'Photo '+(i+1),open:function(){var w=window.open('','_blank');if(w){w.document.write('<img src="'+p.data+'" style="max-width:100%">');w.document.close();}},del:function(){var a=f.photos.slice();a.splice(i,1);self.teSet('photos',a);}};}),
      teAddPhoto:function(){pickImg(self.user,function(p){self.teSet('photos',(self.state.te.f.photos||[]).concat([p]));});},
      teMoves:mv,teHasMoves:mv.length>0,teCanMaint:!!t&&s!=='sorti',teMaintLbl:s==='maintenance'?'Remettre en service':'Mettre en maintenance',teMaint:function(){self.toolStatus(s==='maintenance'?'disponible':'maintenance');},
      teCanForce:!!t&&s==='sorti',teForce:function(){self.toolStatus('disponible');},
      tePrint:function(){self.printLabels([{payload:qp+rep+'|'+(String(f.nom).trim()||'Nouvel outil'),code:rep,sub:String(f.nom).trim()}]);},
      teSave:function(){self.saveTool();},teSaveLbl:te.busy?'Enregistrement…':(te.id?'Enregistrer':'Créer'),teCanDel:!!te.id,teDelLbl:te.confirm?'Confirmer la suppression':'Supprimer',teDel:function(){self.deleteTool();},
      teClose:function(){self.setState({te:null});},teCloseBg:function(e){if(e.target===e.currentTarget)self.setState({te:null});}});}
  var ke=st.ke;out.keOpen=!!ke;
  if(ke){var kf=ke.f,ks=function(k){return function(e){self.keSet(k,e.target.value);};};
    Object.assign(out,{keTitle:(ke.id?'Modifier · ':'Nouveau · ')+({cat:'catégorie',pre:'préfixe de repérage',emp:'emplacement'})[ke.kind],keCat:ke.kind==='cat',kePre:ke.kind==='pre',keEmp:ke.kind==='emp',keNew:!ke.id,keOld:!!ke.id,keCode:ke.id||'',
      kIcon:kf.icon,onKIcon:ks('icon'),kLabel:kf.label,onKLabel:ks('label'),kId:kf.id,onKId:ks('id'),kNext:kf.next,onKNext:ks('next'),kZone:kf.zone,onKZone:ks('zone'),kNom:kf.nom,onKNom:ks('nom'),
      kBats:['Entrepôt','Bureau'].concat(['Entrepôt','Bureau'].indexOf(kf.bat)<0&&kf.bat?[kf.bat]:[]).map(function(b){return{v:b,l:b,sel:kf.bat===b};}),onKBat:ks('bat'),
      kScopes:[['outils','Outils'],['inventaire','Inventaire']].map(function(x){return{v:x[0],l:x[1],sel:(kf.scope||'outils')===x[0]};}),onKScope:ks('scope'),
      keSave:function(){self.saveKe(false);},keSaveLbl:ke.busy?'Enregistrement…':'Enregistrer',keCanDel:!!ke.id&&ke.kind!=='pre',keDelLbl:ke.confirm?'Confirmer la suppression':'Supprimer',keDel:function(){self.saveKe(true);},
      keClose:function(){self.setState({ke:null});},keCloseBg:function(e){if(e.target===e.currentTarget)self.setState({ke:null});}});}
  return out;};

/* ═════════════ PORTAIL : page d'accueil après la connexion — SA Platform, sa-admin, Temps · Paie, sa-terrain ═════════════
   admin.html#temps (ou #stock, #planning…) ouvre directement l'écran demandé, sans passer par le portail. */
var MODS=['monitoring','carte','inspections','planmatch','operations','planning','sites','facturation','hivernage','logistique','stock','flotte','outils','sondages','communication','temps','stats','comptes'];
function TITLES_OK(m){return MODS.indexOf(m)>=0;}
function portailPref(){try{return localStorage.getItem('sa_admin_portail')!=='off';}catch(e){return true;}}
function hashMod(){var h=String(location.hash||'').replace(/^#/,'');return /^[a-z]+$/.test(h)?h:'';}
Comp.prototype.openApp=function(url){var u=this.user;
  /* sa-terrain garde sa propre session sur ce poste : on la prépare avec le même compte (déjà vérifié par le serveur) si elle est vide */
  if(/terrain/.test(url)){try{if(!localStorage.getItem('sa_terrain_user'))localStorage.setItem('sa_terrain_user',JSON.stringify({id:u.id,prenom:u.prenom,nom:u.nom,role:u.role,dept:u.dept||'',tel:u.tel||'',email:u.email||''}));}catch(e){}}
  auditT(this,'CONNEXION','portail',u.id,{vers:url});location.href=url;};
Comp.prototype.portalVals=function(){var self=this,st=this.state,D=this.D,now=new Date(),h=now.getHours(),av=null,urg=null,hz=null,live=null;
  if(D){av=0;live=0;var wk=iso(mondayOf(now)),di=(now.getDay()+6)%7;(D.ft||[]).forEach(function(r){(r.days||[]).forEach(function(d,i){((d&&d.tasks)||[]).forEach(function(t){if(t.pendingValidation)av++;if(r.week===wk&&i===di&&(t.active||!t.end))live++;});});});
    urg=D.dem.filter(function(d){return d.statut!=='Traitée'&&d.type==='Urgence';}).length;}
  var n=function(v,one,many){return v==null?'…':v+' '+(v>1?many:one);};
  var go=function(m){return function(){self.setState({portail:false});self.go(m);try{history.replaceState(null,'','#'+m);}catch(e){}};};
  return{isPortail:!!st.portail,portHello:(h<12?'Bonjour':h<18?'Bon après-midi':'Bonsoir')+' '+(this.user.prenom||''),portDate:JS[now.getDay()]+' '+now.getDate()+' '+MOIS[now.getMonth()]+' '+now.getFullYear(),
    portTiles:[
      {icon:'layers',title:'SA Platform',sub:'L’application complète d’origine — punch, bons de travail, planning, feuilles de temps, logistique.',info:'Se connecte avec le même identifiant',btn:'Ouvrir SA Platform',go:function(){self.openApp('index.html');},primary:false,sec:true},
      {icon:'activity',title:'sa-admin',sub:'Centre des opérations — monitoring en direct, opérations, sites, matériel, comptes.',info:D?n(live,'employé en punch','employés en punch')+' · '+n(urg,'urgence','urgences'):'Chargement des données…',btn:'Entrer dans sa-admin',go:go('monitoring'),primary:true,sec:false},
      {icon:'timer',title:'Temps · Paie',sub:'Feuilles de temps de l’équipe — corriger, approuver, sortir la paie en Excel ou par courriel.',info:D?n(av,'punch à valider','punchs à valider'):'Chargement des données…',btn:'Ouvrir Temps · Paie',go:go('temps'),primary:false,sec:true},
      {icon:'nav',title:'sa-terrain',sub:'L’app du technicien — punch, fiche du site, relevés, demandes, logistique.',info:'Pour téléphone ; s’ouvre aussi ici',btn:'Ouvrir sa-terrain',go:function(){self.openApp('terrain.html');},primary:false,sec:true}],
    portSkip:!portailPref(),onPortSkip:function(e){try{localStorage.setItem('sa_admin_portail',e.target.checked?'off':'on');}catch(x){}self.update();},
    openPortail:function(){self.setState({portail:true});try{history.replaceState(null,'','#');}catch(e){}},
    closePortail:go(st.mod||'monitoring')};};

/* Temps · « Par employé » : la feuille d'UN employé, avec tout le détail des punchs (notes, mesures, pièces, GPS, lien au travail)
   et toutes les actions de publication pour lui seul (imprimer, Excel, courriel, envoyée à la paie, approuver). */
var BP=[['cl','Chlore libre','ppm'],['ph','pH',''],['alc','Alcalinité','ppm'],['temp','Temp.','°C']];
Comp.prototype.empVals=function(){var self=this,st=this.state,D=this.D;if(!D)return{};var tMon=addDays(mondayOf(new Date()),7*st.tOff),wk=iso(tMon),today=iso(new Date()),yest=iso(addDays(new Date(),-1));
  var emps=D.comptes.filter(function(c){return c.role!=='admin'&&D.statut[c.id]!=='inactif';}).sort(function(a,b){return(a.prenom+a.nom).localeCompare(b.prenom+b.nom,'fr');});
  var uid=st.eUid&&emps.some(function(c){return c.id===st.eUid;})?st.eUid:(emps[0]&&emps[0].id);
  var rows=Array.isArray(this.ftw[wk])?this.ftw[wk]:null,row=rows&&rows.filter(function(r){return r.uid===uid;})[0],e=rows?this.weekData(wk).filter(function(x){return x.id===uid;})[0]:null;
  var nm=this.names(),eDay=st.eDay==null?null:st.eDay,siteBy=function(l){return D.sites.filter(function(s){return norm(s.nom)===norm(l);})[0];};
  var days=[];for(var i=0;i<7;i++){(function(i){if(eDay!=null&&eDay!==i)return;var d=row&&row.days&&row.days[i],ts=(d&&d.tasks)||[],dd=addDays(tMon,i),date=iso(dd);
    var tot=ts.reduce(function(s,t){return s+(t.active||!t.end?0:(Number(t.hrs)||0));},0);
    days.push({jour:DLF[i]+' '+dd.getDate()+' '+MOIS[dd.getMonth()]+(date===today?' — aujourd’hui':(date===yest?' — hier':'')),tot:ts.length?fmtH(tot):'',none:!ts.length,
      add:function(){self.openDay(uid,wk,i);self.newPunch();},canApprove:ts.some(function(t){return!t.approuve&&!(t.active||!t.end);}),approve:function(){self.approve(uid,wk,i);},
      punchs:ts.map(function(t,ti){var act=!!(t.active||!t.end),b=(t.bassins||[]).filter(function(x){return x;}),s=siteBy(t.lieu);
        var mes=b.map(function(x){var v=BP.filter(function(p){return x[p[0]]!=null&&x[p[0]]!=='';}).map(function(p){return p[1]+' '+x[p[0]]+(p[2]?' '+p[2]:'');});return v.length?(x.bassin||'Bassin')+' : '+v.join(' · '):'';}).filter(Boolean);
        var files=(t.files||[]).map(function(f){return f&&(f.name||'pièce jointe');}).filter(Boolean);
        return{h:(t.start||'?')+' → '+(act?'en cours':(t.end||'?')),dur:act?'en cours':fmtH(Number(t.hrs)||0),lieu:t.lieu||'—',odt:t.odt?'ODT '+t.odt:'',detail:t.detail||'',
          notes:t.notes||'',hasNotes:!!t.notes,mes:mes.join('   |   '),hasMes:mes.length>0,
          files:files.length?files.length+' pièce(s) : '+files.join(', ')+((t.files||[]).some(function(f){return f&&f._local;})?' — les photos restent sur le téléphone et dans le journal du site':''):'',hasFiles:files.length>0,
          lien:t.sourceLabel?'Lié à : '+t.sourceLabel:'',hasLien:!!t.sourceLabel,km:(t.kmDep||t.kmArr)?'Km : '+(t.kmDep||'?')+' → '+(t.kmArr||'?'):'',hasKm:!!(t.kmDep||t.kmArr),
          gps:t.gps&&t.gps.lat?'https://maps.google.com/?q='+t.gps.lat+','+t.gps.lng:'',hasGps:!!(t.gps&&t.gps.lat),gpsLbl:t.gps&&t.gps.acc?'Position GPS (±'+Math.round(t.gps.acc)+' m)':'Position GPS',
          tags:[t.pendingValidation?'À valider':'',t.approuve?'Approuvé'+(t.approuvePar?' par '+(nm[t.approuvePar]||t.approuvePar):''):'',t.correctedBy?'Corrigé par '+(nm[t.correctedBy]||t.correctedBy):'',t.ajoutePar?'Ajouté au bureau':'',t.autoClosed?'Fermé automatiquement':''].filter(Boolean).join(' · '),
          bd:act?'var(--color-accent-700)':(t.pendingValidation?'var(--color-accent-900)':'var(--color-text)'),
          edit:function(){self.openDay(uid,wk,i);self.editPunch(ti);},
          odtNew:function(){self.openFE('wo',null,{site:s?s.id:null,client:s?null:t.lieu,tech:uid,debut:today});}};})});})(i);}
  var chips=[{l:'Toute la semaine',on:eDay==null,go:function(){self.setState({eDay:null});}}];
  for(var j=0;j<7;j++)(function(j){chips.push({l:DJ[j]+' '+addDays(tMon,j).getDate(),on:eDay===j,go:function(){self.setState({eDay:j});}});})(j);
  var jump=function(dt){var off=Math.round((mondayOf(dt)-mondayOf(new Date()))/(7*864e5));self.setState({tOff:off,eDay:(dt.getDay()+6)%7});};
  var env=e&&e.envoi;
  return{isEmpTab:st.tempsTab==='employe',eEmps:emps.map(function(c){return{v:c.id,l:(c.prenom+' '+c.nom).trim(),sel:c.id===uid};}),onEUid:function(ev){self.setState({eUid:ev.target.value});},
    eChips:chips.map(function(c){return Object.assign({label:c.l,go:c.go},segS(c.on));}),eToday:function(){jump(new Date());},eYest:function(){jump(addDays(new Date(),-1));},
    eDays:days,eLoading:!rows,eNoRow:!!rows&&!row,
    eSum:e?[{l:'Total',v:fmtH(e.total)},{l:'Régulières',v:fmtH(e.reg)},{l:'Supplémentaires',v:e.supp>0?fmtH(e.supp):'—'},{l:'Punchs',v:String(e.nbPunchs)},{l:'À valider',v:e.nbAV?String(e.nbAV):'—'}]:[],
    eEtat:e?(e.enCours?'Punch en cours — semaine pas terminée':(env?'Envoyée à la paie le '+fdate(env.le)+(env.methode?' ('+env.methode+')':''):(e.approuvee?'Semaine approuvée':(e.any?'Pas encore approuvée':'Aucun punch cette semaine')))):'',
    ePrint:function(){self.printPaie(uid);},eXlsx:function(){self.exportPaie(uid);},eMailEmp:function(){self.mailEmp(uid);},eMailPaie:function(){self.mailPaie(uid);},eSent:function(){self.markSent('sa-admin',uid);},
    eCanApprove:!!(e&&e.any&&!e.approuvee&&!e.enCours),eApprove:function(){self.approve(uid,wk,null);},eAdd:function(){self.openDay(uid,wk,eDay!=null?eDay:(new Date().getDay()+6)%7);self.newPunch();},
    eOdt:function(){self.openFE('wo',null,{tech:uid,debut:today});},eHas:!!(e&&e.any)};};

/* ═════════════ MONITORING : période (aujourd'hui / hier / 7 jours), salles mécaniques, mur de contrôle grand écran ═════════════ */
var MON_PER=[['jour','Aujourd’hui'],['hier','Hier'],['7j','7 derniers jours']];
function ageTxt(d){var n=Math.round((new Date(iso(new Date())+'T12:00:00')-new Date(d+'T12:00:00'))/864e5);return n<=0?'aujourd’hui':n===1?'hier':'il y a '+n+' j';}
Comp.prototype.monVals=function(){var self=this,st=this.state,D=this.D;if(!D)return{};var now=new Date(),today=D.today,yest=iso(addDays(now,-1)),per=st.monPer||'jour';
  var inPer=function(d){return per==='jour'?d===today:per==='hier'?d===yest:d>=iso(addDays(now,-6));},perLbl=per==='jour'?'aujourd’hui':per==='hier'?'hier':'sur 7 jours';
  var relP=D.rel.filter(function(r){return inPer(r.date);}).slice().sort(function(a,b){return(b.date+(b.heure||'')).localeCompare(a.date+(a.heure||''));});
  var nVals=function(r){var n=0;Object.keys(r.vals||{}).forEach(function(k){if(r.vals[k]!=null&&(!r.touched||r.touched[k]))n++;});return n;};
  var relRows=relP.map(function(r){var no=self.outOf(r).length,nv=nVals(r);return{d:(r.date===today?'':fdate(r.date)+' ')+(r.heure||''),site:r.site_nom||(D.byId[r.site_id]||{}).nom||'—',tech:r.tech_nom||r.tech||'—',
    n:nv?nv+' valeur(s)':'aucune valeur saisie',hz:no?no+' hors zone':'',fw:no?700:400,note:r.note||'',go:function(){self.setState({monWall:false});self.go('inspections',{inspSite:String(r.site_id),inspKey:null});}};});
  // Salles mécaniques : une tuile par site ayant au moins un relevé (dernier relevé, valeurs colorées, qui est sur place)
  var last={};D.rel.forEach(function(r){var k=String(r.site_id),p=last[k];if(!p||(r.date+(r.heure||''))>(p.date+(p.heure||'')))last[k]=r;});
  var onSite={};var wk=iso(mondayOf(now)),di=(now.getDay()+6)%7,nm=this.names();
  D.ft.forEach(function(f){if(f.week!==wk)return;var d=f.days&&f.days[di];((d&&d.tasks)||[]).forEach(function(t){if(!t.active)return;var s=D.sites.filter(function(x){return String(x.id)===String(t.siteId)||norm(x.nom)===norm(t.lieu);})[0];if(s)(onSite[s.id]=onSite[s.id]||[]).push({nom:nm[f.uid]||f.emp||f.uid,depuis:t.start});});});
  var salles=Object.keys(last).map(function(sid){var r=last[sid],s=D.byId[sid],T=self.T(s?s.type:r.type_code),out=self.outOf(r),nv=nVals(r),age=Math.round((new Date(today+'T12:00:00')-new Date(r.date+'T12:00:00'))/864e5);
    var lvl=out.length?3:(age>7?2:(nv?0:1)),who=onSite[sid]||[];
    return{_lvl:lvl,_age:age,id:sid,nom:s?s.nom:(r.site_nom||'—'),ville:s?s.ville:'',debit:T.court||'',
      headBg:lvl===3?'var(--color-accent-900)':'var(--color-text)',headFg:'#ffffff',
      etat:lvl===3?out.length+' valeur(s) hors zone':lvl===2?'Aucun relevé depuis '+age+' j':lvl===1?'Relevé sans valeur':'Dans les normes',
      rows:(T.fields||[]).map(function(f){var v=r.vals&&r.vals[f.key],has=v!=null&&(!r.touched||r.touched[f.key]),o=has&&(v<f.lo||v>f.hi);return{l:f.label,txt:has?fr(v,f.step)+(f.unit?' '+f.unit:''):'—',bg:!has?'transparent':(o?'var(--color-accent-900)':'var(--color-accent-100)'),o:o,has:has};}),
      note:'Dernier relevé '+ageTxt(r.date)+(r.heure?' à '+r.heure:'')+' par '+(r.tech_nom||r.tech||'—')+(r.note?' — « '+r.note+' »':''),
      live:who.length?'Sur place : '+who.map(function(w){return w.nom+' depuis '+w.depuis;}).join(', '):'',hasLive:who.length>0,
      go:function(){self.setState({monWall:false});self.go('inspections',{inspSite:sid,inspKey:null});}};})
    .sort(function(a,b){return b._lvl-a._lvl||(b.hasLive?1:0)-(a.hasLive?1:0)||a.nom.localeCompare(b.nom,'fr');});
  var nOut=salles.filter(function(s){return s._lvl===3;}).length,nOld=salles.filter(function(s){return s._lvl===2;}).length;
  // Mur de contrôle (grand écran)
  var team=[];D.ft.forEach(function(f){if(f.week!==wk)return;var d=f.days&&f.days[di],ts=(d&&d.tasks)||[],run=ts.filter(function(t){return t.active;})[0],h=ts.reduce(function(s,t){return s+(t.active||!t.end?0:(Number(t.hrs)||0));},0);
    if(ts.length)team.push({nom:nm[f.uid]||f.emp||f.uid,on:!!run,lieu:run?run.lieu:(ts[ts.length-1].lieu||'—'),depuis:run?'depuis '+run.start:'fini à '+(ts[ts.length-1].end||'—'),h:fmtH(h),dot:run?'#3ddc84':'#6b7c93'});});
  team.sort(function(a,b){return(b.on?1:0)-(a.on?1:0)||a.nom.localeCompare(b.nom,'fr');});
  var openDem=D.dem.filter(function(d){return d.statut!=='Traitée';}),urg=openDem.filter(function(d){return d.type==='Urgence';});
  var woToday=D.wo.filter(function(w){return w.date===today;}),woDoneT=woToday.filter(function(w){return woDone(w.status);}).length;
  var wallK=[{l:'En punch',v:String(team.filter(function(t){return t.on;}).length),s:'sur '+team.length+' au travail aujourd’hui'},{l:'Relevés aujourd’hui',v:String(D.rel.filter(function(r){return r.date===today;}).length),s:'hier : '+D.rel.filter(function(r){return r.date===yest;}).length},
    {l:'Salles hors zone',v:String(nOut),s:nOld+' sans relevé depuis 7 j',hot:nOut>0},{l:'Bons de travail du jour',v:woDoneT+' / '+woToday.length,s:'terminés'},{l:'Demandes ouvertes',v:String(openDem.length),s:urg.length+' urgence(s)',hot:urg.length>0}];
  var fl=[];relP.slice(0,12).forEach(function(r){var no=self.outOf(r).length;fl.push({t:r.date+' '+(r.heure||''),h:(r.date===today?'':fdate(r.date)+' ')+(r.heure||''),txt:no?'Relevé — '+no+' hors zone':'Relevé',who:r.tech_nom||r.tech,site:r.site_nom,hot:no>0});});
  D.dem.slice(0,8).forEach(function(d){var t=new Date(d.created_at),ds=iso(t);if(!inPer(ds)&&!(d.type==='Urgence'&&d.statut!=='Traitée'))return;fl.push({t:ds+' '+pad(t.getHours())+':'+pad(t.getMinutes()),h:(ds===today?'':fdate(ds)+' ')+pad(t.getHours())+':'+pad(t.getMinutes()),txt:d.type+' — '+(d.texte||d.motif||''),who:d.tech_nom||d.tech,site:d.site_nom||'hors site',hot:d.type==='Urgence'&&d.statut!=='Traitée'});});
  fl.sort(function(a,b){return String(b.t).localeCompare(String(a.t));});
  return{monPers:MON_PER.map(function(p){return Object.assign({label:p[1],go:function(){self.setState({monPer:p[0]});}},segS(per===p[0]));}),monPerLbl:perLbl,
    relRows:relRows,relNone:!relRows.length,relTitle:'Relevés '+perLbl+' ('+relRows.length+')',
    salles:salles,sallesSummary:salles.length?salles.length+' salle(s) suivie(s) · '+nOut+' hors zone · '+nOld+' sans relevé depuis 7 j':'Aucun relevé enregistré pour l’instant — les salles apparaissent dès le premier relevé saisi dans sa-terrain.',
    monWall:!!st.monWall,openWall:function(){self.setState({monWall:true});var el=document.documentElement;try{if(el.requestFullscreen&&!document.fullscreenElement)el.requestFullscreen().catch(function(){});}catch(e){}self.startWallTimer();},
    closeWall:function(){self.setState({monWall:false});try{if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen();}catch(e){}},
    wallClock:pad(now.getHours())+':'+pad(now.getMinutes()),wallDate:JS[now.getDay()]+' '+now.getDate()+' '+MOIS[now.getMonth()]+' '+now.getFullYear(),
    wallSync:this.err?'Hors ligne — dernière lecture '+(this.loadedAt?pad(this.loadedAt.getHours())+':'+pad(this.loadedAt.getMinutes()):'—'):'En direct · mis à jour à '+(this.loadedAt?pad(this.loadedAt.getHours())+':'+pad(this.loadedAt.getMinutes())+':'+pad(this.loadedAt.getSeconds()):'—'),
    wallKpis:wallK.map(function(k){return Object.assign(k,{bg:k.hot?'#c0392b':'rgba(255,255,255,.06)'});}),wallTeam:team,wallNoTeam:!team.length,wallFlux:fl.slice(0,10).map(function(f){return Object.assign(f,{bg:f.hot?'#c0392b':'transparent'});}),
    wallSalles:salles.map(function(s){return Object.assign({},s,{bd:s._lvl===3?'#e74c3c':s._lvl===2?'#f39c12':s._lvl===1?'#6b7c93':'#3ddc84',tag:s._lvl===3?'#e74c3c':s._lvl===2?'#f39c12':'transparent',
      rows:s.rows.map(function(r){return Object.assign({},r,{bg:!r.has?'transparent':(r.o?'#e74c3c':'#3ddc84'),fg:r.o?'#ff8a80':'#ffffff'});})});}),wallNoSalles:!salles.length};};
/* Mur de contrôle : relecture toutes les 30 s et horloge à la minute, tant qu'il est affiché */
Comp.prototype.startWallTimer=function(){var self=this;if(this._wallT)return;this._wallT=setInterval(function(){if(!self.state.monWall){clearInterval(self._wallT);self._wallT=null;return;}self._wn=(self._wn||0)+1;if(self._wn%2===0)self.load().then(function(){self.update();});else self.update();},15000);};

/* ═════════════ FICHE SITE COMPLÈTE (mêmes champs que SA Platform + bassins avec leurs paramètres de relevé) ═════════════
   sites : nom, addr, tel, email, siteweb, type, annee, equips[], files[], bassins[], gps, notes — contrats : type_code (relevé par défaut), code */
var SITE_TYPES=[['','—'],['commercial','Commercial'],['creusee','Piscine creusée'],['spa','Spa'],['autre','Autre']];
var BASSIN_TYPES=[['piscine','Piscine'],['spa','Spa'],['pataugeoire','Pataugeoire'],['jeuxdeau','Jeux d’eau'],['autre','Autre']];
Comp.prototype.openSiteFiche=function(id){var self=this;
  if(!id){this.setState({sf:{id:null,isNew:true,f:{nom:'',addr:'',tel:'',email:'',siteweb:'',type:'',annee:'',equips:[],files:[],bassins:[],gps:null,notes:''},type_code:'GEN',code:'',journal:[],equipIn:'',confirm:false,busy:false,loading:false}});return;}
  var s=this.D.byId[id];this.setState({sf:{id:id,loading:true}});
  Promise.all([get('sites?id=eq.'+encodeURIComponent(id)+'&select=*'),soft('site_journal?site_id=eq.'+encodeURIComponent(id)+'&select=*&order=date.desc,heure.desc&limit=40',[])]).then(function(r){var x=r[0][0];if(!x)throw new Error('site introuvable');
    var f={nom:x.nom||'',addr:x.addr||'',tel:x.tel||'',email:x.email||'',siteweb:x.siteweb||'',type:x.type||'',annee:x.annee||'',equips:Array.isArray(x.equips)?x.equips.slice():[],files:Array.isArray(x.files)?x.files.slice():[],
      bassins:Array.isArray(x.bassins)?x.bassins.map(function(b){return Object.assign({id:b.id||pmmId(),nom:'',type:'piscine',type_code:'',volume:'',notes:''},b);}):[],gps:x.gps||null,notes:x.notes||''};
    self.setState({sf:{id:id,isNew:false,f:f,upd:x.updated_at||null,type_code:s?s.type:'GEN',code:s?s.contrat:'',journal:r[1],equipIn:'',confirm:false,busy:false,loading:false}});})
    .catch(function(e){self.setState({sf:null});self.flash('Fiche illisible : '+netMsg(e));});};
Comp.prototype.sfMut=function(fn){var sf=JSON.parse(JSON.stringify(this.state.sf));fn(sf.f,sf);sf.confirm=false;this.setState({sf:sf});};
Comp.prototype.saveSiteFiche=function(){var self=this,sf=this.state.sf;if(!sf||sf.busy)return;var f=sf.f,nom=String(f.nom).trim();if(!nom){this.flash('Le nom du site est requis');return;}
  if(sf.isNew&&this.D.sitesAll.some(function(s){return norm(s.nom)===norm(nom);})){this.flash('Un site porte déjà ce nom');return;}
  var gps=null;if(f.gps&&f.gps.lat!==''&&f.gps.lat!=null&&f.gps.lng!==''&&f.gps.lng!=null){var la=parseFloat(String(f.gps.lat).replace(',','.')),ln=parseFloat(String(f.gps.lng).replace(',','.'));if(!(Math.abs(la)<=90&&Math.abs(ln)<=180)){this.flash('Coordonnées GPS invalides');return;}gps={lat:la,lng:ln};}
  var now=nowIso(),id=sf.id||pmmId();
  var body={nom:nom,addr:String(f.addr).trim(),tel:String(f.tel).trim(),email:String(f.email).trim(),siteweb:String(f.siteweb).trim(),type:f.type||'',annee:String(f.annee||'').trim(),equips:f.equips,files:f.files,
    bassins:f.bassins.filter(function(b){return String(b.nom).trim();}).map(function(b){return{id:b.id,nom:String(b.nom).trim(),type:b.type||'piscine',type_code:b.type_code||'',volume:String(b.volume||'').trim(),notes:String(b.notes||'').trim()};}),gps:gps,notes:String(f.notes||'').trim(),updated_at:now};
  this.setState({sf:Object.assign({},sf,{busy:true})});
  var w=sf.isNew?postRows('sites',[Object.assign({id:id},body)]).then(function(r){if(!r.length)throw new Error('identifiant déjà utilisé');})
    :rest('PATCH','sites?id=eq.'+encodeURIComponent(id)+'&updated_at='+(sf.upd?'eq.'+encodeURIComponent(sf.upd):'is.null'),body).then(function(r){if(Array.isArray(r)&&!r.length)throw new Error('la fiche a été modifiée ailleurs entre-temps — rouvrez-la');});
  w.then(function(){return rest('POST','contrats',{site_id:id,type_code:sf.type_code||'GEN',code:sf.code||null,actif:true,updated_at:now},'resolution=merge-duplicates,return=minimal');})
   .then(function(){auditT(self,sf.isNew?'CREATION':'MODIFICATION','sites',id);self.setState({sf:null});self.flash(sf.isNew?'Site créé':'Fiche du site enregistrée');return self.reloadAll();})
   .catch(function(e){self.setState({sf:Object.assign({},self.state.sf,{busy:false})});self.flash('Échec — rien n’a été modifié : '+netMsg(e));});};
Comp.prototype.deleteSiteFiche=function(){var self=this,sf=this.state.sf;if(!sf||sf.isNew)return;if(!sf.confirm){this.setState({sf:Object.assign({},sf,{confirm:true})});return;}
  rest('DELETE','sites?id=eq.'+encodeURIComponent(sf.id)).then(function(){auditT(self,'SUPPRESSION','sites',sf.id);self.setState({sf:null});self.flash('Site supprimé — une copie est conservée dans l’historique');return self.reloadAll();}).catch(function(e){self.flash('Échec : '+netMsg(e));});};
Comp.prototype.sfAddFile=function(){var self=this,inp=document.createElement('input');inp.type='file';inp.accept='image/*,application/pdf';inp.onchange=function(){var file=inp.files&&inp.files[0];if(!file)return;
  var add=function(data){self.sfMut(function(f){f.files.push({name:file.name,size:file.size,type:file.type,data:data,addedBy:self.user.id,addedAt:nowIso()});});};
  if(/^image\//.test(file.type)){var img=new Image(),u=URL.createObjectURL(file);img.onload=function(){var k=Math.min(1,1400/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);add(c.toDataURL('image/jpeg',0.7));};img.src=u;}
  else{if(file.size>2e6){self.flash('PDF trop volumineux (max 2 Mo)');return;}var rd=new FileReader();rd.onload=function(){add(rd.result);};rd.readAsDataURL(file);}};inp.click();};
Comp.prototype.siteFicheVals=function(){var self=this,st=this.state,D=this.D,sf=st.sf;var sb={siteQ:st.siteQ||'',onSiteQ:function(e){self.setState({siteQ:e.target.value});},siteNew:function(){self.openSiteFiche(null);}};
  if(!D||!sf)return Object.assign(sb,{sfOpen:false});if(sf.loading)return Object.assign(sb,{sfOpen:true,sfLoading:true,sfReady:false,sfTitle:'Chargement…',sfClose:function(){self.setState({sf:null});},sfCloseBg:function(e){if(e.target===e.currentTarget)self.setState({sf:null});}});
  var f=sf.f,F=function(k){return{v:f[k]==null?'':f[k],on:function(e){var v=e.target.value;self.sfMut(function(x){x[k]=v;});}};},types=Object.keys(D.types);
  var tOpts=function(cur,withNone){return(withNone?[{v:'',l:'Même que le site',sel:!cur}]:[]).concat(types.map(function(k){return{v:k,l:D.types[k].label,sel:cur===k};}));};
  var nm=this.names(),sid=sf.id,wo=sid?D.wo.filter(function(w){return norm(w.client)===norm(f.nom);}).sort(function(a,b){return String(b.date).localeCompare(String(a.date));}):[];
  var rel=sid?D.rel.filter(function(r){return String(r.site_id)===String(sid);}):[],lastR=rel[rel.length-1];
  return Object.assign(sb,{sfOpen:true,sfLoading:false,sfReady:true,sfTitle:sf.isNew?'Nouveau site':f.nom||'Site',sfNom:F('nom'),sfAddr:F('addr'),sfTel:F('tel'),sfEmail:F('email'),sfWeb:F('siteweb'),sfAnnee:F('annee'),sfNotes:F('notes'),
    sfTypes:SITE_TYPES.map(function(t){return{v:t[0],l:t[1],sel:(f.type||'')===t[0]};}),onSfType:function(e){var v=e.target.value;self.sfMut(function(x){x.type=v;});},
    sfRelTypes:tOpts(sf.type_code,false),onSfRelType:function(e){var v=e.target.value;self.sfMut(function(x,s){s.type_code=v;});},sfCode:sf.code||'',onSfCode:function(e){var v=e.target.value;self.sfMut(function(x,s){s.code=v;});},
    sfLat:f.gps&&f.gps.lat!=null?f.gps.lat:'',sfLng:f.gps&&f.gps.lng!=null?f.gps.lng:'',onSfLat:function(e){var v=e.target.value;self.sfMut(function(x){x.gps=Object.assign({},x.gps||{},{lat:v});});},onSfLng:function(e){var v=e.target.value;self.sfMut(function(x){x.gps=Object.assign({},x.gps||{},{lng:v});});},
    sfGeoMaps:f.addr?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(f.addr):'',sfHasAddr:!!f.addr,
    sfBassins:f.bassins.map(function(b,i){var up=function(k){return function(e){var v=e.target.value;self.sfMut(function(x){x.bassins[i][k]=v;});};};
      return{nom:b.nom,onNom:up('nom'),vol:b.volume||'',onVol:up('volume'),notes:b.notes||'',onNotes:up('notes'),types:BASSIN_TYPES.map(function(t){return{v:t[0],l:t[1],sel:(b.type||'piscine')===t[0]};}),onType:up('type'),
        rel:tOpts(b.type_code,true),onRel:up('type_code'),del:function(){self.sfMut(function(x){x.bassins.splice(i,1);});}};}),
    sfNoBassin:!f.bassins.length,sfAddBassin:function(){self.sfMut(function(x){x.bassins.push({id:pmmId(),nom:x.bassins.length?'':'Bassin principal',type:'piscine',type_code:'',volume:'',notes:''});});},
    sfEquips:f.equips.map(function(e,i){return{l:e,del:function(){self.sfMut(function(x){x.equips.splice(i,1);});}};}),sfEquipIn:sf.equipIn||'',onSfEquipIn:function(e){var v=e.target.value;var s2=Object.assign({},self.state.sf,{equipIn:v});self.setState({sf:s2});},
    sfEquipAdd:function(){var v=String(self.state.sf.equipIn||'').trim();if(!v)return;self.sfMut(function(x,s){x.equips.push(v);s.equipIn='';});},
    sfFiles:f.files.map(function(p,i){return{name:(p.name||'fichier')+(p.size?' ('+Math.round(p.size/1024)+' Ko)':''),has:!!p.data,noData:!p.data,open:function(){if(!p.data)return;var w=window.open('','_blank');if(w){w.document.write(/^data:image/.test(p.data)?'<img src="'+p.data+'" style="max-width:100%">':'<iframe src="'+p.data+'" style="border:0;width:100%;height:100vh"></iframe>');w.document.close();}},del:function(){self.sfMut(function(x){x.files.splice(i,1);});}};}),
    sfAddFile:function(){self.sfAddFile();},
    sfJournal:(sf.journal||[]).map(function(j){var ph=(j.photos||[]).filter(function(p){return p&&(p.data||p.url);});return{h:fdate(j.date)+(j.heure?' '+j.heure:'')+' — '+(j.emp||nm[j.uid]||j.uid||'—'),notes:j.notes||'',
      mes:(j.bassins||[]).map(function(b){return(b.bassin||'Bassin')+' : '+BP.filter(function(p){return b[p[0]]!=null;}).map(function(p){return p[1]+' '+b[p[0]];}).join(' · ');}).join(' | '),
      photos:ph.map(function(p,i){var src=p.data||p.url;return{src:src,open:function(){var w=window.open('','_blank');if(w){w.document.write('<img src="'+src+'" style="max-width:100%">');w.document.close();}}};}),hasPh:ph.length>0};}),sfNoJournal:!(sf.journal||[]).length,
    sfWo:wo.slice(0,12).map(function(w){return{txt:(w.date||'')+' · '+(w.type||'')+' · '+(WO_STAT.filter(function(s){return s[0]===w.status;})[0]||[0,w.status])[1]+(w.descr?' — '+String(w.descr).split('\n')[0].slice(0,60):''),open:function(){self.setState({sf:null});self.openFE('wo',w.id);}};}),sfHasWo:wo.length>0,sfWoN:wo.length+' bon(s) de travail',
    sfRelTxt:rel.length?rel.length+' relevé(s) — dernier le '+fdate(lastR.date)+' par '+(lastR.tech_nom||lastR.tech):'Aucun relevé',sfIsOld:!sf.isNew,
    sfNewWo:function(){var i=sf.id;self.setState({sf:null});self.openFE('wo',null,{site:i});},sfInsp:function(){var i=sf.id;self.setState({sf:null});self.go('inspections',{inspSite:i,inspKey:null});},
    sfSave:function(){self.saveSiteFiche();},sfSaveLbl:sf.busy?'Enregistrement…':(sf.isNew?'Créer le site':'Enregistrer'),sfCanDel:!sf.isNew,sfDelLbl:sf.confirm?'Confirmer la suppression':'Supprimer le site',sfDel:function(){self.deleteSiteFiche();},
    sfClose:function(){self.setState({sf:null});},sfCloseBg:function(e){if(e.target===e.currentTarget)self.setState({sf:null});}});};

/* ═════════════ INSPECTIONS : rapport imprimable, export Excel, paramètres de relevé (types_bassin) ═════════════ */
Comp.prototype.inspData=function(sid,days){var self=this,D=this.D,s=D.byId[sid];if(!s)return null;var since=iso(addDays(new Date(),-(days||90))),bl=s.bassins&&s.bassins.length?s.bassins:[null];
  return{site:s,bassins:bl.map(function(b,i){var T=self.T(b&&b.type_code?b.type_code:s.type),rel=D.rel.filter(function(r){return String(r.site_id)===String(sid)&&r.date>=since&&(bl.length<2||(r.bassin?r.bassin===b.nom:i===0));});
    return{nom:b?b.nom:'Bassin',T:T,rel:rel,stats:(T.fields||[]).map(function(f){var vs=rel.map(function(r){return r.vals&&r.vals[f.key];}).filter(function(v){return v!=null;}),n=vs.length,out=vs.filter(function(v){return v<f.lo||v>f.hi;}).length;
      return{f:f,n:n,last:n?vs[n-1]:null,avg:n?vs.reduce(function(a,b){return a+b;},0)/n:null,min:n?Math.min.apply(null,vs):null,max:n?Math.max.apply(null,vs):null,out:out,pct:n?Math.round((n-out)/n*100):null};})};})};};
Comp.prototype.printInsp=function(sid){var d=this.inspData(sid,90);if(!d)return;var E=escH,s=d.site,v=function(x,f){return x==null?'—':fr(x,f.step)+(f.unit?' '+f.unit:'');};
  var h='<!doctype html><meta charset="utf-8"><title>Rapport d’inspection — '+E(s.nom)+'</title><style>body{font:12px Arial,sans-serif;margin:22px}h1{font-size:20px;margin:0}h2{font-size:15px;background:#e8f2fb;padding:5px 8px;margin:18px 0 6px}table{border-collapse:collapse;width:100%;margin-bottom:8px}td,th{border:1px solid #bbb;padding:3px 6px;text-align:left}th{background:#f4f6fa}.o{background:#fde2e2;font-weight:700}.m{color:#555;margin:4px 0 10px}</style>'
    +'<h1>Rapport d’inspection — '+E(s.nom)+'</h1><div class="m">'+E(s.addr||'')+(s.contrat?' · contrat '+E(s.contrat):'')+' · 90 derniers jours · généré le '+new Date().toLocaleString('fr-CA')+'</div>';
  d.bassins.forEach(function(b){var F=b.T.fields||[];h+='<h2>'+E(b.nom)+' — '+E(b.T.label)+(b.T.norme?' · '+E(b.T.norme):'')+' · '+b.rel.length+' relevé(s)</h2>';
    h+='<table><tr><th>Paramètre</th><th>Zone visée</th><th>Dernier</th><th>Moyenne</th><th>Min / max</th><th>Dans la zone</th><th>Hors zone</th></tr>'+b.stats.map(function(x){var f=x.f;return'<tr><td>'+E(f.label)+'</td><td>'+fr(f.lo,f.step)+' – '+fr(f.hi,f.step)+(f.unit?' '+E(f.unit):'')+'</td><td'+(x.last!=null&&(x.last<f.lo||x.last>f.hi)?' class="o"':'')+'>'+v(x.last,f)+'</td><td>'+v(x.avg,f)+'</td><td>'+(x.n?fr(x.min,f.step)+' / '+fr(x.max,f.step):'—')+'</td><td>'+(x.pct==null?'—':x.pct+' %')+'</td><td>'+x.out+'</td></tr>';}).join('')+'</table>';
    h+='<table><tr><th>Date</th><th>Technicien</th>'+F.map(function(f){return'<th>'+E(f.label)+'</th>';}).join('')+'<th>Note</th></tr>'+b.rel.slice(-25).reverse().map(function(r){return'<tr><td>'+E(fdate(r.date))+' '+E(r.heure||'')+'</td><td>'+E(r.tech_nom||r.tech||'')+'</td>'+F.map(function(f){var x=r.vals&&r.vals[f.key],o=x!=null&&(x<f.lo||x>f.hi);return'<td'+(o?' class="o"':'')+'>'+(x==null?'—':fr(x,f.step))+'</td>';}).join('')+'<td>'+E(r.note||'')+'</td></tr>';}).join('')+'</table>';});
  h+='<div style="margin-top:30px;display:flex;gap:60px"><div style="border-top:1px solid #333;width:240px;padding-top:3px">Soucy Aquatik</div><div style="border-top:1px solid #333;width:240px;padding-top:3px">Client</div></div>';
  var w=window.open('','_blank');if(!w){this.flash('Fenêtre bloquée — autorisez les fenêtres pour imprimer');return;}w.document.write(h+'<script>setTimeout(function(){print();},300)<\/script>');w.document.close();auditT(this,'EXPORT','releves',sid,{format:'impression'});};
Comp.prototype.xlsxInsp=function(sid){var d=this.inspData(sid,365);if(!d)return;var sheets=d.bassins.map(function(b){var F=b.T.fields||[],rows=[[{v:d.site.nom+' — '+b.nom+' ('+b.T.label+')',s:5}],[],[{v:'Date',s:1},{v:'Heure',s:1},{v:'Technicien',s:1}].concat(F.map(function(f){return{v:f.label+(f.unit?' ('+f.unit+')':''),s:1};}),[{v:'Hors zone',s:1},{v:'Note',s:1}])];
    b.rel.forEach(function(r){rows.push([r.date,r.heure||'',r.tech_nom||r.tech||''].concat(F.map(function(f){var x=r.vals&&r.vals[f.key];return x==null?'':{v:x,s:3};}),[self_out(r,F)||'',r.note||'']));});
    return{name:b.nom,widths:[12,8,18].concat(F.map(function(){return 12;}),[10,40]),rows:rows};});
  function self_out(r,F){return F.filter(function(f){var x=r.vals&&r.vals[f.key];return x!=null&&(x<f.lo||x>f.hi);}).length;}
  saveBlob(xlsxBlob(sheets),'SoucyAquatik_Releves_'+d.site.nom.replace(/[^A-Za-zÀ-ÿ0-9]+/g,'_')+'_'+iso(new Date())+'.xlsx');auditT(this,'EXPORT','releves',sid,{format:'xlsx'});this.flash('Fichier Excel téléchargé (12 derniers mois)');};
/* Paramètres de relevé : ce que le technicien saisit dans sa-terrain (plages, points de contrôle, produits) */
Comp.prototype.openTypes=function(code){var T=this.D.types,c=T[code]?code:Object.keys(T)[0];this.setState({ty:this.tyLoad(c)});};
Comp.prototype.tyLoad=function(code){var t=this.D.types[code]||{};return{code:code,isNew:!this.D.types[code],label:t.label||'',court:t.court||'',norme:t.norme||'',photo:t.photo||'',
  fields:(t.fields||[]).map(function(f){return{key:f.key,label:f.label||'',unit:f.unit||'',kind:f.kind||'range',icon:f.icon||'flask',min:String(f.min),max:String(f.max),lo:String(f.lo),hi:String(f.hi),step:String(f.step)};}),
  checks:(t.checks||[]).join('\n'),produits:(t.produits||[]).map(function(p){return{nom:p[0]||'',unite:p[1]||'',pas:String(p[2]==null?'':p[2])};}),busy:false};};
Comp.prototype.tyMut=function(fn){var t=JSON.parse(JSON.stringify(this.state.ty));fn(t);this.setState({ty:t});};
Comp.prototype.saveTypes=function(){var self=this,t=this.state.ty;if(!t||t.busy)return;var code=String(t.code||'').trim().toUpperCase();
  if(!/^[A-Z0-9_]{2,12}$/.test(code)){this.flash('Code : 2 à 12 lettres majuscules ou chiffres');return;}if(t.isNew&&this.D.types[code]){this.flash('Ce code existe déjà');return;}
  if(!String(t.label).trim()){this.flash('Le nom du type est requis');return;}var keys={},err='';
  var fields=t.fields.map(function(f,i){var n=function(x){return parseFloat(String(x).replace(',','.'));},o={key:String(f.key||'').trim()||('p'+(i+1)),label:String(f.label).trim(),unit:String(f.unit).trim(),kind:f.kind==='count'?'count':'range',icon:f.icon||'flask',min:n(f.min),max:n(f.max),lo:n(f.lo),hi:n(f.hi),step:n(f.step)};
    if(!o.label)err=err||'Paramètre '+(i+1)+' : nom requis';else if([o.min,o.max,o.lo,o.hi,o.step].some(function(x){return!isFinite(x);}))err=err||o.label+' : valeurs numériques requises';
    else if(!(o.min<=o.lo&&o.lo<=o.hi&&o.hi<=o.max))err=err||o.label+' : il faut min ≤ zone basse ≤ zone haute ≤ max';else if(!(o.step>0))err=err||o.label+' : le pas doit être positif';
    if(keys[o.key])err=err||'Clé en double : '+o.key;keys[o.key]=1;return o;});
  if(err){this.flash(err);return;}
  var body={label:String(t.label).trim(),court:String(t.court).trim()||String(t.label).trim(),norme:String(t.norme).trim(),photo:String(t.photo).trim()||null,fields:fields,checks:String(t.checks).split('\n').map(function(x){return x.trim();}).filter(Boolean),
    produits:t.produits.filter(function(p){return String(p.nom).trim();}).map(function(p){return[String(p.nom).trim(),String(p.unite).trim(),parseFloat(String(p.pas).replace(',','.'))||1];}),updated_at:nowIso()};
  this.setState({ty:Object.assign({},t,{busy:true})});
  (t.isNew?postRows('types_bassin',[Object.assign({code:code,a_valider:false},body)]):rest('PATCH','types_bassin?code=eq.'+encodeURIComponent(code),body)).then(function(){auditT(self,t.isNew?'CREATION':'MODIFICATION','types_bassin',code);self.setState({ty:null});self.flash('Paramètres enregistrés — sa-terrain les utilise dès sa prochaine synchronisation');return self.reloadAll();})
    .catch(function(e){self.setState({ty:Object.assign({},self.state.ty,{busy:false})});self.flash('Échec — rien n’a été modifié : '+netMsg(e));});};
Comp.prototype.typesVals=function(){var self=this,t=this.state.ty,D=this.D;if(!D||!t)return{tyOpen:false};
  var up=function(k){return function(e){var v=e.target.value;self.tyMut(function(x){x[k]=v;});};};
  var nSites=D.sites.filter(function(s){return s.type===t.code||(s.bassins||[]).some(function(b){return b.type_code===t.code;});}).length;
  return{tyOpen:true,tyTitle:t.isNew?'Nouveau type de bassin':'Paramètres de relevé — '+t.label,tyTypes:Object.keys(D.types).map(function(k){return{v:k,l:D.types[k].label+' ('+k+')',sel:k===t.code};}).concat([{v:'__new',l:'+ Nouveau type…',sel:!!t.isNew}]),
    onTyType:function(e){var v=e.target.value;if(v==='__new')self.setState({ty:{code:'',isNew:true,label:'',court:'',norme:'',photo:'',fields:[],checks:'',produits:[],busy:false}});else self.setState({ty:self.tyLoad(v)});},
    tyNew:!!t.isNew,tyCode:t.code,onTyCode:up('code'),tyLabel:t.label,onTyLabel:up('label'),tyCourt:t.court,onTyCourt:up('court'),tyNorme:t.norme,onTyNorme:up('norme'),tyPhoto:t.photo,onTyPhoto:up('photo'),tyChecks:t.checks,onTyChecks:up('checks'),
    tyUse:t.isNew?'':'Utilisé par '+nSites+' site(s) ou bassin(s). Les changements s’appliquent aux prochains relevés ; les anciens gardent leurs valeurs.',
    tyFields:t.fields.map(function(f,i){var c=function(k,ph,w){return{v:f[k],ph:ph,w:w,on:function(e){var v=e.target.value;self.tyMut(function(x){x.fields[i][k]=v;});}};};
      return{cells:[c('label','Nom',2.2),c('key','Clé',1),c('unit','Unité',0.9),c('min','Min',0.8),c('lo','Zone basse',0.9),c('hi','Zone haute',0.9),c('max','Max',0.8),c('step','Pas',0.7)],del:function(){self.tyMut(function(x){x.fields.splice(i,1);});}};}),
    tyAddField:function(){self.tyMut(function(x){x.fields.push({key:'',label:'',unit:'',kind:'range',icon:'flask',min:'0',max:'10',lo:'1',hi:'3',step:'0.1'});});},
    tyProds:t.produits.map(function(p,i){var c=function(k,ph,w){return{v:p[k],ph:ph,w:w,on:function(e){var v=e.target.value;self.tyMut(function(x){x.produits[i][k]=v;});}};};return{cells:[c('nom','Produit',3),c('unite','Unité',1),c('pas','Pas',0.8)],del:function(){self.tyMut(function(x){x.produits.splice(i,1);});}};}),
    tyAddProd:function(){self.tyMut(function(x){x.produits.push({nom:'',unite:'L',pas:'0.5'});});},
    tySave:function(){self.saveTypes();},tySaveLbl:t.busy?'Enregistrement…':(t.isNew?'Créer le type':'Enregistrer'),tyClose:function(){self.setState({ty:null});},tyCloseBg:function(e){if(e.target===e.currentTarget)self.setState({ty:null});}};};

/* ═════════════ CARTE : position des sites (fiche ou punchs précis), filtres, tournée d'un technicien, géolocalisation des adresses ═════════════ */
function medianOf(a){var b=a.slice().sort(function(x,y){return x-y;}),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2;}
function distM(a,b,c,d){var R=6371000,r=Math.PI/180,x=(d-b)*r*Math.cos((a+c)/2*r),y=(c-a)*r;return Math.sqrt(x*x+y*y)*R;}
Comp.prototype.carteGeo=function(){var D=this.D,st=this.state,acc=Number(st.carteAcc||100),g={},techs={},today=D.today,q=norm(st.carteQ||''),ty=st.carteType||'all';
  D.geo.forEach(function(x){if(x.lat==null||x.lng==null)return;var a=x.acc==null?null:Number(x.acc);if(a!=null&&a>acc)return;if(x.site_id)(g[x.site_id]=g[x.site_id]||[]).push(x);if(x.date===today&&!techs[x.emp])techs[x.emp]=x;});
  var sites=[],sans=[];D.sites.forEach(function(s){if((ty!=='all'&&s.type!==ty)||(q&&norm(s.nom+' '+s.addr).indexOf(q)<0))return;
    if(s.gps){sites.push({id:s.id,nom:s.nom,type:s.type,addr:s.addr,lat:Number(s.gps.lat),lng:Number(s.gps.lng),src:'fiche',prec:null,n:(g[s.id]||[]).length});return;}
    var rows=(g[s.id]||[]).slice(0,20);if(!rows.length){sans.push(s);return;}
    /* médiane (robuste : un punch fait du camion ou avec un mauvais signal ne déplace plus le site) */
    var la=medianOf(rows.map(function(r){return Number(r.lat);})),ln=medianOf(rows.map(function(r){return Number(r.lng);})),prec=Math.round(medianOf(rows.map(function(r){return distM(la,ln,Number(r.lat),Number(r.lng));}))+medianOf(rows.map(function(r){return r.acc==null?30:Number(r.acc);}))/Math.sqrt(rows.length));
    sites.push({id:s.id,nom:s.nom,type:s.type,addr:s.addr,lat:la,lng:ln,src:'punchs',prec:prec,n:(g[s.id]||[]).length,last:g[s.id][0].date});});
  return{sites:sites,sans:sans,techs:techs};};
Comp.prototype.setSiteGps=function(id,lat,lng,why){var self=this,s=this.D.byId[id];if(!s)return;
  return rest('PATCH','sites?id=eq.'+encodeURIComponent(id),{gps:{lat:Math.round(lat*1e6)/1e6,lng:Math.round(lng*1e6)/1e6},updated_at:nowIso()}).then(function(){auditT(self,'MODIFICATION','sites',id,{gps:why||'carte'});s.gps={lat:lat,lng:lng};self.setState({carteFix:null});self.flash('Position de « '+s.nom+' » enregistrée');self._mapDirty=true;self.update();})
    .catch(function(e){self.flash('Échec : '+netMsg(e));});};
/* Géolocalise les adresses des sites sans position (OpenStreetMap / Nominatim, 1 requête par seconde comme l'exige le service) */
Comp.prototype.geocodeAll=function(){var self=this,list=this.carteGeo().sans.filter(function(s){return s.addr;});if(!list.length){this.flash('Aucun site sans position n’a d’adresse');return;}if(this._geocoding)return;this._geocoding=true;var ok=0,ko=0,i=0;
  var next=function(){if(i>=list.length){self._geocoding=false;self.flash('Géolocalisation terminée : '+ok+' site(s) placé(s)'+(ko?', '+ko+' adresse(s) introuvable(s)':''));return self.reloadAll();}var s=list[i++];self.flash('Géolocalisation '+i+' / '+list.length+' : '+s.nom);
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ca&q='+encodeURIComponent(s.addr)).then(function(r){return r.json();}).then(function(r){if(!r.length){ko++;return;}ok++;
      return rest('PATCH','sites?id=eq.'+encodeURIComponent(s.id),{gps:{lat:Number(r[0].lat),lng:Number(r[0].lon),src:'adresse'},updated_at:nowIso()});}).catch(function(){ko++;}).then(function(){setTimeout(next,1100);});};
  auditT(this,'MODIFICATION','sites','geocodage',{n:list.length});next();};
Comp.prototype.loadTour=function(){var self=this,st=this.state,t=st.carteTour;if(!t||!t.emp){this._tour=null;return;}var k=t.emp+'|'+t.date;if(this._tourK===k)return;this._tourK=k;this._tour='loading';
  get('punch_gps_log?emp=eq.'+encodeURIComponent(t.emp)+'&date=eq.'+t.date+'&lat=not.is.null&select=emp,heure,lieu,lat,lng,acc,site_id&order=heure.asc').then(function(r){if(self._tourK!==k)return;self._tour=r;self._mapDirty=true;self.update();})
    .catch(function(e){self._tour=[];self.flash('Tournée illisible : '+netMsg(e));});};
Comp.prototype.carteCtlVals=function(){var self=this,st=this.state,D=this.D;if(!D)return{};var G=st.mod==='carte'?this.carteGeo():{sites:[],sans:[],techs:{}},t=st.carteTour||{emp:'',date:D.today};
  if(st.mod==='carte')this.loadTour();var tour=Array.isArray(this._tour)?this._tour:[];
  var emps=D.comptes.filter(function(c){return c.role!=='admin';}).map(function(c){return(c.prenom+' '+c.nom).trim();});
  var chk=function(k,l){var on=st[k]!==false;return{l:l,on:on,box:on?'var(--color-text)':'transparent',go:function(){var o={};o[k]=!on;self._mapDirty=true;self.setState(o);}};};
  /* Schéma des tournées : pour chaque employé, ses travaux du jour dans l'ordre (fait / en cours / à venir) et ses punchs */
  var lines=[];if(st.mod==='carte'&&st.carteView==='schema'){var wk=iso(mondayOf(new Date())),di=(new Date().getDay()+6)%7;
    D.comptes.filter(function(c){return c.role!=='admin'&&D.statut[c.id]!=='inactif';}).forEach(function(c){var jobs=self.dayJobs(c.id,D.today),f=(D.ft||[]).filter(function(x){return x.uid===c.id&&x.week===wk;})[0],ts=(f&&f.days&&f.days[di]&&f.days[di].tasks)||[],run=ts.filter(function(t){return t.active;})[0];
      jobs.forEach(function(j){if(run&&run.sourceId&&String(run.sourceId)===String(j.id))j.cur=true;});
      var stops=jobs.length?jobs.map(function(j){return{h:j.h||'—',nom:j.t,done:j.done,cur:j.cur,go:function(){self.openFE(j.kind,j.id);}};}):ts.map(function(t){return{h:t.start||'—',nom:t.lieu||'—',done:!t.active&&!!t.end,cur:!!t.active,go:function(){self.setState({mod:'temps',tempsTab:'employe',eUid:c.id,eDay:di,tOff:0});}};});
      if(!stops.length)return;var dn=stops.filter(function(s){return s.done;}).length;
      lines.push({nom:(c.prenom+' '+c.nom).trim(),statut:run?'En punch · '+(run.lieu||''):(ts.length?'Hors punch':'Pas encore punché'),done:dn,total:stops.length,progress:Math.round(dn/Math.max(1,stops.length-1)*100),
        stops:stops.map(function(s){return{h:s.h,nom:s.nom,go:s.go,size:s.cur?18:14,mt:s.cur?-2:0,bg:s.done?'var(--color-text)':(s.cur?'var(--color-accent-700)':'var(--color-bg)'),ring:s.cur?'0 0 0 3px var(--color-bg),0 0 0 5px var(--color-text)':'none',fw:s.cur?700:400};})});});}
  var pr=st.mod==='carte'&&st.cartePlan?this.plannedRoutes(st.cartePlanDate||D.today):null;
  var planV={cPlanOn:!!st.cartePlan,onCPlan:function(e){self._mapDirty=true;self._fittedPlan=false;self.setState({cartePlan:e.target.checked});},cPlanDate:st.cartePlanDate||D.today,onCPlanDate:function(e){self._mapDirty=true;self._fittedPlan=false;self.setState({cartePlanDate:e.target.value||D.today});},
    cPlanRows:(pr||[]).map(function(r){var miss=r.stops.filter(function(s){return s.lat==null;});return{nom:r.nom,col:r.col,txt:r.stops.map(function(s,i){return(s.h||'—')+' '+s.nom;}).join(' → '),miss:miss.length?miss.length+' arrêt(s) sans position : '+miss.map(function(s){return s.nom;}).join(', '):''};}),cPlanNone:!!pr&&!pr.length};
  return Object.assign(planV,{lines:lines,linesNone:st.carteView==='schema'&&!lines.length,cShows:[chk('carteSites','Sites'),chk('carteTechs','Techniciens aujourd’hui'),chk('cartePrec','Zone de précision')],
    cAccs:[[30,'± 30 m'],[100,'± 100 m'],[500,'± 500 m']].map(function(a){return{v:String(a[0]),l:'Punchs précis à '+a[1],sel:Number(st.carteAcc||100)===a[0]};}),onCAcc:function(e){self._mapDirty=true;self.setState({carteAcc:Number(e.target.value)});},
    cTypes:[{v:'all',l:'Tous les types',sel:(st.carteType||'all')==='all'}].concat(Object.keys(D.types).map(function(k){return{v:k,l:D.types[k].label,sel:st.carteType===k};})),onCType:function(e){self._mapDirty=true;self._fitted=false;self.setState({carteType:e.target.value});},
    cQ:st.carteQ||'',onCQ:function(e){self._mapDirty=true;self._fitted=false;self.setState({carteQ:e.target.value});},
    cEmps:[{v:'',l:'— Tournée d’un technicien —',sel:!t.emp}].concat(emps.map(function(n){return{v:n,l:n,sel:t.emp===n};})),onCEmp:function(e){self._fitted=false;self.setState({carteTour:{emp:e.target.value,date:t.date}});},
    cDate:t.date,onCDate:function(e){self._fitted=false;self.setState({carteTour:{emp:t.emp,date:e.target.value||D.today}});},
    cTour:tour.map(function(p,i){return{n:String(i+1),txt:(p.heure||'')+' · '+(p.lieu||'—'),acc:p.acc!=null?'± '+Math.round(p.acc)+' m':'',bad:p.acc!=null&&Number(p.acc)>Number(st.carteAcc||100)};}),cHasTour:!!t.emp,cTourNone:!!t.emp&&Array.isArray(this._tour)&&!tour.length,
    cTourKm:tour.length>1?'Distance à vol d’oiseau : '+(tour.reduce(function(s,p,i){return i?s+distM(Number(tour[i-1].lat),Number(tour[i-1].lng),Number(p.lat),Number(p.lng)):0;},0)/1000).toFixed(1).replace('.',',')+' km':'',
    cSans:G.sans.length?G.sans.length+' site(s) sans position'+(G.sans.filter(function(s){return s.addr;}).length?' — '+G.sans.filter(function(s){return s.addr;}).length+' avec adresse':''):'',cCanGeo:G.sans.some(function(s){return s.addr;}),cGeo:function(){self.geocodeAll();},
    cFixing:!!st.carteFix,cFixTxt:st.carteFix?'Cliquez sur la carte à l’endroit exact de « '+((D.byId[st.carteFix]||{}).nom||'')+' »':'',cFixCancel:function(){self.setState({carteFix:null});},
    carteInfo:st.mod==='carte'?G.sites.filter(function(s){return s.src==='fiche';}).length+' site(s) placé(s) par leur fiche · '+G.sites.filter(function(s){return s.src==='punchs';}).length+' d’après les punchs précis · '+G.sans.length+' sans position':''});};

/* ═════════════ PLANNING : calendrier 4 semaines et diagramme des travaux (Gantt 8 semaines, imprimable A3) ═════════════ */
var TECH_COL=['#1f6fb2','#c0392b','#16a085','#8e44ad','#d35400','#2c3e50','#7f8c8d','#27ae60','#b7950b','#e84393'];
function techCol(id){var h=0;String(id||'').split('').forEach(function(c){h=(h*31+c.charCodeAt(0))>>>0;});return TECH_COL[h%TECH_COL.length];}
Comp.prototype.loadRange=function(a,b){var self=this,k=a+'|'+b;this.rng=this.rng||{};if(this.rng[k]!==undefined)return;this.rng[k]=null;
  Promise.all([soft('plan?select=id,client,addr,date,heure,emp,descr,type,status,wo_id&date=gte.'+a+'&date=lte.'+b,[]),soft('planning_tasks?select=id,titre,emp,site_nom,date_debut,date_fin,heure_debut,heure_fin,statut,recurrence,wo_id,plan_id&date_debut=lte.'+b+'&date_fin=gte.'+a,[])])
    .then(function(r){self.rng[k]={plan:r[0],pt:r[1]};self.update();});};
Comp.prototype.rangeItems=function(a,b){var D=this.D,R=this.rng&&this.rng[a+'|'+b];if(!R)return null;var nm=this.names(),out=[];
  D.wo.forEach(function(w){if(!w.date||w.date<a||w.date>b)return;out.push({kind:'wo',id:w.id,d0:w.date,d1:w.date,h:'',t:w.client+(w.type?' · '+w.type:''),emps:splitIds(w.assigne),done:woDone(w.status),urg:w.priorite==='urgent',grp:w.client||'Sans client',lbl:'Bon de travail'+(w.type?' · '+w.type:'')});});
  R.plan.forEach(function(p){if(p.wo_id&&D.wo.some(function(w){return w.id===p.wo_id;}))return;out.push({kind:'plan',id:p.id,d0:p.date,d1:p.date,h:p.heure||'',t:(p.client||'Créneau')+(p.descr?' · '+p.descr:''),emps:splitIds(p.emp),done:p.status==='termine',grp:p.client||'Créneau',lbl:'Créneau'+(p.descr?' · '+p.descr:'')});});
  R.pt.forEach(function(t){if(t.statut==='annule'||t.wo_id||t.plan_id)return;out.push({kind:'pt',id:t.id,d0:t.date_debut,d1:t.date_fin||t.date_debut,h:t.heure_debut||'',t:t.titre||'Tâche',emps:splitIds(t.emp),done:t.statut==='termine',rec:!!t.recurrence,lbl:t.titre||'Tâche',grp:t.site_nom||(splitIds(t.emp).map(function(e){return nm[e]||e;}).join(', ')||'Sans site')});});
  return out;};
Comp.prototype.plan2Vals=function(){var self=this,st=this.state,D=this.D;if(!D||st.mod!=='planning')return{};var view=st.pView||'semaine',nm=this.names(),today=iso(new Date()),ini=function(id){var n=nm[id]||id;return n.split(' ').map(function(x){return x[0]||'';}).join('').toUpperCase().slice(0,2);};
  var base={pViews:[['semaine','Semaine'],['mois','4 semaines'],['gantt','Diagramme des travaux'],['series','Séries récurrentes']].map(function(x){return Object.assign({label:x[1],go:function(){self.setState({pView:x[0]});}},segS(view===x[0]));}),pIsWeek:view==='semaine',pIsMonth:view==='mois',pIsGantt:view==='gantt'};
  if(view==='semaine'||view==='series')return base;
  var nW=view==='mois'?4:8,mon=addDays(mondayOf(new Date()),7*(st.pOff||0)),a=iso(mon),b=iso(addDays(mon,7*nW-1));this.loadRange(a,b);var items=this.rangeItems(a,b),hide=!!st.gHideDone;
  var label=fdate(a)+' → '+fdate(b),open=function(it){return function(){self.openFE(it.kind,it.id);};};
  Object.assign(base,{p2Label:label,p2Loading:!items,p2Prev:function(){self.setState({pOff:(st.pOff||0)-(view==='mois'?4:4)});},p2Next:function(){self.setState({pOff:(st.pOff||0)+4});},p2Today:function(){self.setState({pOff:0});}});
  if(!items)return base;
  if(view==='mois'){var weeks=[];for(var w=0;w<4;w++){var days=[];for(var d=0;d<7;d++){var dt=addDays(mon,w*7+d),ds=iso(dt);
      var its=items.filter(function(it){return it.d0<=ds&&it.d1>=ds;}).sort(function(x,y){return(x.h||'99').localeCompare(y.h||'99');});
      days.push({n:dt.getDate()+(dt.getDate()===1||d===0?' '+MOIS[dt.getMonth()].slice(0,4)+'.':''),bg:ds===today?'var(--color-accent-100)':(d>4?'rgba(0,0,0,.03)':'transparent'),fw:ds===today?700:400,
        items:its.slice(0,6).map(function(it){return{txt:(it.h?it.h+' ':'')+it.t,who:it.emps.map(ini).join(' '),bd:it.emps.length?techCol(it.emps[0]):'var(--color-divider)',op:it.done?0.5:1,open:open(it),tip:it.t+' — '+(it.emps.map(function(e){return nm[e]||e;}).join(', ')||'non assigné')};}),more:its.length>6?'+ '+(its.length-6)+' autre(s)':''});}
    weeks.push({days:days});}
    return Object.assign(base,{p2Weeks:weeks,p2Dows:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']});}
  // Gantt : une ligne par chantier (client / site), une barre par travail, 8 semaines
  var groups={},order=[],tot=nW*7;items.forEach(function(it){if(hide&&it.done)return;var g=groups[it.grp];if(!g){g=groups[it.grp]={label:it.grp,bars:[],late:false,active:false};order.push(it.grp);}
    var s=Math.max(0,(new Date(it.d0+'T12:00:00')-mon)/864e5),e=Math.min(tot-1,(new Date(it.d1+'T12:00:00')-mon)/864e5);if(it.kind==='wo'&&!it.done&&it.d0<today)g.late=true;if(it.d0<=today&&it.d1>=today&&!it.done)g.active=true;
    g.bars.push({left:(s/tot*100).toFixed(2),width:Math.max((e-s+1)/tot*100,1.2).toFixed(2),lbl:(it.h?it.h+' ':'')+(it.lbl||it.t),who:it.emps.map(ini).join(' '),bg:it.done?'#9aa5b1':(it.urg?'#c0392b':(it.emps.length?techCol(it.emps[0]):'#5b6b7b')),open:open(it),tip:it.d0+(it.d1!==it.d0?' → '+it.d1:'')+' · '+it.t+' — '+(it.emps.map(function(e){return nm[e]||e;}).join(', ')||'non assigné')});});
  order.sort(function(x,y){return groups[x].label.localeCompare(groups[y].label,'fr');});
  var wks=[];for(var i=0;i<nW;i++){var wd=addDays(mon,i*7);wks.push({l:'S'+isoWeek(wd),r:wd.getDate()+' '+MOIS[wd.getMonth()].slice(0,4)+'.',bg:iso(wd)<=today&&today<=iso(addDays(wd,6))?'var(--color-accent-100)':'transparent'});}
  var rows=order.map(function(k){var g=groups[k];return{label:g.label,etat:g.late?'En retard':(g.active?'En cours':'À venir'),etatBg:g.late?'#c0392b':(g.active?'#16a085':'#1f6fb2'),bars:g.bars,h:Math.max(1,g.bars.length)*26+14};});
  return Object.assign(base,{gWeeks:wks,gRows:rows,gNone:!rows.length,gHide:hide,onGHide:function(e){self.setState({gHideDone:e.target.checked});},gPrint:function(){self.printGantt(a,b,wks,rows);}});};
function isoWeek(d){var t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));var n=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-n);var y=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y)/864e5+1)/7);}
Comp.prototype.printGantt=function(a,b,wks,rows){var E=escH,h='<!doctype html><meta charset="utf-8"><title>Diagramme des travaux</title><style>@page{size:A3 landscape;margin:10mm}body{font:11px Arial,sans-serif;margin:0}h1{font-size:18px;margin:0 0 8px}.g{display:grid;grid-template-columns:220px 1fr;border-top:2px solid #222}.h{display:grid;grid-template-columns:repeat('+wks.length+',1fr)}.h div{border-left:1px solid #bbb;text-align:center;padding:3px 0;font-weight:700}.r{display:contents}.l{border-bottom:1px solid #ccc;padding:5px 6px;font-weight:700}.t{position:relative;border-bottom:1px solid #ccc;background:repeating-linear-gradient(90deg,transparent 0 calc(100%/'+wks.length+' - 1px),#ddd calc(100%/'+wks.length+' - 1px) calc(100%/'+wks.length+'))}.b{position:absolute;height:20px;color:#fff;font-size:10px;line-height:20px;padding:0 4px;overflow:hidden;white-space:nowrap;border-radius:3px;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>'
  +'<h1>Soucy Aquatik — Diagramme des travaux — '+E(fdate(a))+' au '+E(fdate(b))+'</h1><div class="g"><div class="l">Chantier</div><div class="h">'+wks.map(function(w){return'<div'+(w.bg!=='transparent'?' style="background:#e8f2fb"':'')+'>'+E(w.l)+'<br>'+E(w.r)+'</div>';}).join('')+'</div>';
  rows.forEach(function(r){h+='<div class="l">'+E(r.label)+'<br><span style="font-weight:400">'+E(r.etat)+'</span></div><div class="t" style="height:'+r.h+'px">'+r.bars.map(function(x,i){return'<div class="b" style="left:'+x.left+'%;width:'+x.width+'%;top:'+(6+i*26)+'px;background:'+x.bg+'">'+E(x.lbl)+(x.who?' · '+E(x.who):'')+'</div>';}).join('')+'</div>';});
  var w=window.open('','_blank');if(!w){this.flash('Fenêtre bloquée — autorisez les fenêtres pour imprimer');return;}w.document.write(h+'</div><script>setTimeout(function(){print();},300)<\/script>');w.document.close();};

/* ═════════════ LIEN CALENDRIER OUTLOOK / GMAIL (même table et même service que SA Platform : tech_calendar_connections + planning-ics) ═════════════ */
var ICS_ENDPOINT=SB+'/functions/v1/planning-ics';
function icsToken(){var a=new Uint8Array(24);(window.crypto||window.msCrypto).getRandomValues(a);return Array.prototype.map.call(a,function(x){return('0'+x.toString(16)).slice(-2);}).join('');}
Comp.prototype.loadCal=function(emp){var self=this;this.cal=this.cal||{};if(this.cal[emp]!==undefined)return;this.cal[emp]=null;
  get('tech_calendar_connections?emp=eq.'+encodeURIComponent(emp)+'&provider=eq.ics&select=id,emp,ics_token,statut,updated_at').then(function(r){self.cal[emp]=r[0]||false;self.update();}).catch(function(e){self.cal[emp]=false;self.flash('Calendrier : '+netMsg(e));});};
Comp.prototype.calGenerate=function(emp){var self=this,c=this.cal&&this.cal[emp],now=nowIso(),row={id:c&&c.id||pmmId(),emp:emp,provider:'ics',ics_token:icsToken(),statut:'actif',updated_at:now};if(!c)row.created_at=now;
  rest('POST','tech_calendar_connections?on_conflict=id',[row],'resolution=merge-duplicates,return=representation').then(function(r){self.cal[emp]=r[0]||row;auditT(self,c?'MODIFICATION':'CREATION','tech_calendar_connections',emp,{action:'lien_calendrier'});self.flash(c?'Nouveau lien créé — l’ancien ne fonctionne plus':'Lien calendrier créé');self.update();})
    .catch(function(e){self.flash('Échec : '+netMsg(e));});};
Comp.prototype.calRevoke=function(emp){var self=this,c=this.cal&&this.cal[emp];if(!c)return;
  rest('PATCH','tech_calendar_connections?id=eq.'+encodeURIComponent(c.id),{statut:'revoque',updated_at:nowIso()}).then(function(){c.statut='revoque';auditT(self,'MODIFICATION','tech_calendar_connections',emp,{action:'revocation'});self.flash('Lien révoqué — le calendrier de l’employé cesse de se mettre à jour');self.update();})
    .catch(function(e){self.flash('Échec : '+netMsg(e));});};
Comp.prototype.calVals=function(){var self=this,e=this.state.ce;if(!e||e.isNew||!e.id)return{calShow:false};var emp=e.id;this.loadCal(emp);var c=this.cal&&this.cal[emp],on=!!(c&&c.statut==='actif');
  var link=on?ICS_ENDPOINT+'?token='+encodeURIComponent(c.ics_token):'',copy=function(t){return function(){(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){self.flash('Lien copié');}).catch(function(){self.flash('Copie impossible — sélectionnez le lien');});};};
  return{calShow:true,calLoading:c===null,calOn:on,calOff:c!==null&&!on,calWebcal:link.replace(/^https:/,'webcal:'),calHttps:link,calCopyW:copy(link.replace(/^https:/,'webcal:')),calCopyH:copy(link),
    calGen:function(){self.calGenerate(emp);},calGenLbl:on?'Générer un nouveau lien':(c&&c.statut==='revoque'?'Réactiver avec un nouveau lien':'Créer le lien calendrier'),calRevoke:function(){self.calRevoke(emp);},
    calMail:function(){var u=(self.D.comptes.filter(function(x){return x.id===emp;})[0]||{});mailto(u.email||'','Ton planning Soucy Aquatik dans ton calendrier','Bonjour '+(e.prenom||'')+',\n\nPour voir ton planning (tâches, bons de travail, créneaux) dans ton calendrier :\n\nOutlook : Calendrier → Ajouter un calendrier → S’abonner à partir du web → colle ce lien :\n'+link.replace(/^https:/,'webcal:')+'\n\nGmail : Autres agendas (+) → À partir de l’URL → colle ce lien :\n'+link+'\n\nMise à jour automatique environ toutes les 30 minutes.\n\nMerci.');}};};

/* Tournée PRÉVUE d'une journée : arrêts (bons de travail, créneaux, tâches) de chaque technicien, dans l'ordre des heures,
   placés sur la position du site (fiche ou punchs précis). Comme renderRouteMap de SA Platform. */
Comp.prototype.plannedRoutes=function(day){var self=this,D=this.D,mon=iso(mondayOf(new Date(day+'T12:00:00'))),PL=this.pl[mon];
  if(!PL){if(!this._pl[mon]){this._pl[mon]=1;this.loadPlan(mondayOf(new Date(day+'T12:00:00'))).then(function(){self._mapDirty=true;self.update();});}return null;}
  var G=this.carteGeo(),pos={};G.sites.forEach(function(s){pos[norm(s.nom)]=s;});var byNom=function(n){return pos[norm(n)]||null;};
  var techs=D.comptes.filter(function(c){return c.role!=='admin'&&D.statut[c.id]!=='inactif';});
  return techs.map(function(c,i){var has=function(v){return splitIds(v).indexOf(c.id)>=0;},st=[];
    PL.wo.forEach(function(w){if(w.date===day&&has(w.assigne))st.push({h:'',nom:w.client,kind:'wo',id:w.id});});
    PL.plan.forEach(function(p){if(p.date===day&&has(p.emp))st.push({h:p.heure||'',nom:p.client,kind:'plan',id:p.id});});
    PL.pt.forEach(function(t){if(t.date_debut<=day&&t.date_fin>=day&&has(t.emp))st.push({h:t.heure_debut||'',nom:t.site_nom||t.titre,kind:'pt',id:t.id});});
    st.sort(function(a,b){return(a.h||'99').localeCompare(b.h||'99');});
    st.forEach(function(s){var p=byNom(s.nom);s.lat=p?p.lat:null;s.lng=p?p.lng:null;});
    return{id:c.id,nom:(c.prenom+' '+c.nom).trim(),col:TECH_COL[i%TECH_COL.length],stops:st};}).filter(function(r){return r.stops.length;});};

/* ═════════════ SÉRIES RÉCURRENTES : tâches planning (recurrence.serie) et dossiers de bons de travail (groupe_id) ═════════════
   (Les « tâches récurrentes » de SA Platform ne sont gardées que sur l'appareil qui les crée — jamais au serveur ;
    les séries partagées par toute l'équipe sont celles-ci.) */
Comp.prototype.loadSeries=function(force){var self=this;if(!force&&this.series!==undefined)return;this.series=null;var from=iso(addDays(new Date(),-60));
  soft('planning_tasks?select=id,titre,emp,site_nom,date_debut,date_fin,heure_debut,statut,recurrence&recurrence=not.is.null&date_fin=gte.'+from+'&order=date_debut.asc',[]).then(function(r){self.series=r;self.update();});};
Comp.prototype.seriesList=function(){var self=this,D=this.D,td=iso(new Date()),nm=this.names(),g={};
  (Array.isArray(this.series)?this.series:[]).forEach(function(t){var k='pt:'+t.recurrence.serie;var s=g[k]=g[k]||{kind:'pt',serie:t.recurrence.serie,titre:t.titre||t.site_nom||'Tâche',rec:t.recurrence,items:[]};s.items.push({d:t.date_debut,h:t.heure_debut||'',emp:t.emp,done:t.statut==='termine'});});
  D.wo.forEach(function(w){if(!w.groupe_id)return;var k='wo:'+w.groupe_id;var s=g[k]=g[k]||{kind:'wo',serie:w.groupe_id,titre:w.client||'Bon de travail',items:[]};s.items.push({d:w.date,h:'',emp:w.assigne,done:woDone(w.status)});});
  return Object.keys(g).map(function(k){var s=g[k],it=s.items.sort(function(a,b){return String(a.d).localeCompare(String(b.d));}),fut=it.filter(function(x){return x.d>=td&&!x.done;});
    var emps={};it.forEach(function(x){splitIds(x.emp).forEach(function(e){emps[e]=1;});});var dows={};it.forEach(function(x){dows[(new Date(x.d+'T12:00:00').getDay()+6)%7]=1;});
    var freq=s.rec&&s.rec.freq?({hebdo:'chaque semaine',quot:'chaque jour',ouvr:'jours ouvrables',mensuel:'chaque mois'}[s.rec.freq]||s.rec.freq):'';
    return Object.assign(s,{n:it.length,fut:fut.length,next:fut[0]?fut[0].d:'',last:it[it.length-1].d,first:it[0].d,h:(fut[0]||it[0]).h,emps:Object.keys(emps),regle:(freq?freq+' · ':'')+Object.keys(dows).sort().map(function(i){return DJ[i];}).join(', ')});})
    .filter(function(s){return s.n>1;}).sort(function(a,b){return(a.fut?0:1)-(b.fut?0:1)||String(a.next||a.last).localeCompare(String(b.next||b.last));});};
Comp.prototype.serieFilt=function(s,from){return s.kind==='wo'?'workorders?groupe_id=eq.'+encodeURIComponent(s.serie)+'&status=eq.ouvert&date=gte.'+from:'planning_tasks?recurrence->>serie=eq.'+encodeURIComponent(s.serie)+'&statut=eq.assigne&date_debut=gte.'+from;};
Comp.prototype.serieSave=function(){var self=this,e=this.state.sr;if(!e||e.busy)return;var s=e.s,from=e.from||iso(new Date());
  var body=s.kind==='wo'?{assigne:e.emps.join(', '),updated_at:nowIso()}:{titre:String(e.titre).trim()||s.titre,heure_debut:e.h||'',emp:e.emps.join(', '),emp_nom:e.emps.map(function(x){return self.names()[x]||x;}).join(', '),updated_at:nowIso()};
  if(s.kind==='wo'&&String(e.titre).trim()&&e.titre!==s.titre)body.client=String(e.titre).trim();
  this.setState({sr:Object.assign({},e,{busy:true})});
  rest('PATCH',this.serieFilt(s,from),body).then(function(r){auditT(self,'MODIFICATION',s.kind==='wo'?'workorders':'planning_tasks',s.serie,{action:'serie_modifiee',a_partir_du:from,n:r.length});self.setState({sr:null});self.flash(r.length+' élément(s) à venir modifié(s)');self.loadSeries(true);return self.reloadAll();})
    .catch(function(x){self.setState({sr:Object.assign({},self.state.sr,{busy:false})});self.flash('Échec : '+netMsg(x));});};
Comp.prototype.serieStop=function(){var self=this,e=this.state.sr;if(!e)return;if(!e.confirm){this.setState({sr:Object.assign({},e,{confirm:true})});return;}var s=e.s,from=e.from||iso(new Date());
  rest('DELETE',this.serieFilt(s,from)).then(function(r){auditT(self,'SUPPRESSION',s.kind==='wo'?'workorders':'planning_tasks',s.serie,{action:'serie_arretee',a_partir_du:from,n:r.length});self.setState({sr:null});self.flash('Série arrêtée : '+r.length+' élément(s) supprimé(s) — une copie est conservée');self.loadSeries(true);return self.reloadAll();})
    .catch(function(x){self.flash('Échec : '+netMsg(x));});};
Comp.prototype.seriesVals=function(){var self=this,st=this.state,D=this.D;if(!D||st.mod!=='planning'||st.pView!=='series')return{pIsSeries:false,srOpen:false};this.loadSeries();var nm=this.names(),L=this.series===null?null:this.seriesList();
  var out={pIsSeries:true,srLoading:L===null,srNone:!!L&&!L.length,srRows:(L||[]).map(function(s){return{titre:s.titre,type:s.kind==='wo'?'Bons de travail':'Tâches planning',regle:s.regle,h:s.h||'—',qui:s.emps.map(function(e){return nm[e]||e;}).join(', ')||'non assigné',
    etat:s.fut?s.fut+' à venir · prochaine le '+fdate(s.next):'Terminée (dernière le '+fdate(s.last)+')',op:s.fut?1:0.55,canEdit:s.fut>0,edit:function(){self.setState({sr:{s:s,titre:s.titre,h:s.h,emps:s.emps.slice(),from:iso(new Date()),confirm:false,busy:false}});}};})};
  var e=st.sr;out.srOpen=!!e;if(!e)return out;var set=function(k){return function(ev){var o={};o[k]=ev.target.value;self.setState({sr:Object.assign({},self.state.sr,o,{confirm:false})});};};
  return Object.assign(out,{srTitle:'Série — '+e.s.titre,srIsPt:e.s.kind==='pt',srT:e.titre,onSrT:set('titre'),srH:e.h,onSrH:set('h'),srFrom:e.from,onSrFrom:set('from'),
    srEmps:D.comptes.filter(function(c){return c.role!=='admin'&&(D.statut[c.id]!=='inactif'||e.emps.indexOf(c.id)>=0);}).map(function(c){var on=e.emps.indexOf(c.id)>=0;return{l:(c.prenom+' '+c.nom).trim(),on:on,box:on?'var(--color-text)':'transparent',go:function(){var a=self.state.sr.emps.slice(),i=a.indexOf(c.id);if(i>=0)a.splice(i,1);else a.push(c.id);self.setState({sr:Object.assign({},self.state.sr,{emps:a,confirm:false})});}};}),
    srSave:function(){self.serieSave();},srSaveLbl:e.busy?'Enregistrement…':'Modifier les éléments à venir',srStop:function(){self.serieStop();},srStopLbl:e.confirm?'Confirmer : supprimer à partir de cette date':'Arrêter la série à partir de cette date',
    srClose:function(){self.setState({sr:null});},srCloseBg:function(ev){if(ev.target===ev.currentTarget)self.setState({sr:null});}});};

/* Valeurs d'écran : Temps (Semaine · À valider · Paie · Cumul) et Stats */
Comp.prototype.tempsVals=function(punchRows){var self=this,st=this.state,D=this.D,mod=st.mod,tMon=addDays(mondayOf(new Date()),7*st.tOff),wk=iso(tMon),today=iso(new Date());
  if((mod==='temps'||mod==='stats'||st.hj)&&this.ftw[wk]===undefined)this.loadWeekFT(wk);
  var loaded=Array.isArray(this.ftw[wk]),data=loaded?this.weekData(wk):[],tt=st.tempsTab;
  var days=[];for(var i=0;i<7;i++){var d=addDays(tMon,i);days.push({label:DJ[i]+' '+d.getDate(),bg:iso(d)===today?'var(--color-accent-100)':'transparent'});}
  var rows=data.map(function(e){return{nom:e.nom,total:e.any?fmtH(e.total):'—',reg:e.any?fmtH(e.reg):'—',supp:e.supp>0?'+'+fmtH(e.supp):'—',suppFg:e.supp>0?'var(--color-accent-900)':'var(--color-text)',
    etat:e.enCours?'● en cours':(e.approuvee?'Approuvée':(e.nbAV?e.nbAV+' à valider':'')),canApprove:e.any&&!e.approuvee&&!e.enCours,approve:function(){self.approve(e.id,wk,null);},fiche:function(){self.setState({tempsTab:'employe',eUid:e.id,eDay:null});},
    jours:e.jours.map(function(j,i){return{txt:j.nb?(j.h>0?fmtH(j.h):'')+(j.live?' ●':''):'—',ok:j.ap?'✓':'',bg:j.ap?'var(--color-accent-100)':'transparent',open:function(){self.openDay(e.id,wk,i);}};})};});
  var teamT=data.reduce(function(s,e){return s+e.total;},0),teamS=data.reduce(function(s,e){return s+e.supp;},0);
  // Paie
  var sel=loaded?this.paieSel(wk,data):{},op=st.paieOpen,mode=st.paieMode;
  var paie=data.filter(function(e){return e.any;}).map(function(e){var on=!!sel[e.id],open=!!op[e.id];
    var detail=[];if(open){for(var i=0;i<7;i++){var ps=e.punchs.filter(function(p){return p.di===i;});if(!ps.length)continue;
      var lines=mode==='journal'?ps.map(function(p){return{lieu:p.lieu,odt:p.odt,debut:p.start,fin:p.act?'en cours':p.end,h:p.act?'—':decTxt(p.hrs),note:[p.av?'à valider':'',p.ap?'approuvé':''].filter(Boolean).join(' · ')};})
        :grouperJour(ps).map(function(l){return{lieu:l.lieu,odt:l.odt,debut:l.debut,fin:l.act?'en cours':l.fin,h:decTxt(l.h),note:[l.nb>1?l.nb+' punchs regroupés':'',l.av?'à valider':''].filter(Boolean).join(' · ')};});
      detail.push({jour:DLF[i]+' '+addDays(tMon,i).getDate(),lines:lines});}}
    return{nom:e.nom,total:decTxt(e.total),reg:decTxt(e.reg),supp:decTxt(e.supp),punchs:e.nbPunchs+(e.nbPunchs>1?' punchs':' punch'),box:on?'var(--color-text)':'transparent',on:on,
      statut:e.enCours?'Punch en cours — semaine pas finie':(e.envoi?'Envoyée à la paie le '+fdate(e.envoi.le):(e.nbAV?e.nbAV+' punch(s) à valider':(e.approuvee?'Approuvée':'Prête'))),
      toggle:function(){var s=Object.assign({},sel);s[e.id]=!on;var o={};o[wk]=s;self.setState({paieSel:Object.assign({},st.paieSel,o)});},
      open:open,chev:open?'down':'right',expand:function(){var o=Object.assign({},op);o[e.id]=!open;self.setState({paieOpen:o});},detail:detail,mail:function(){self.mailEmp(e.id);},mailLbl:'Courriel à '+e.nom.split(' ')[0]+(e.email?' ('+e.email+')':' (aucune adresse)')};});
  var nSel=paie.filter(function(p){return p.on;}).length;
  // Journée d'un employé (dialogue)
  var hj=st.hj,hp=st.hp,hjRows=hj&&Array.isArray(this.ftw[hj.wk])?this.ftw[hj.wk]:null,tasks=this.dayTasks(),nm=this.names();
  var setP=function(k){return function(e){var o={};o[k]=e.target.value;self.setState({hp:Object.assign({},st.hp,o,{confirm:false})});};};
  var hjV={hjOpen:!!hj,hjLoading:!!hj&&!hjRows,hjTitle:hj?(nm[hj.uid]||hj.uid)+' — '+DLF[hj.di]+' '+fdate(iso(addDays(new Date(hj.wk+'T12:00:00'),hj.di))):'',
    hjTotal:fmtH(tasks.reduce(function(s,t){return s+(t.active||!t.end?0:(Number(t.hrs)||0));},0)),hjCount:tasks.length+' punch'+(tasks.length>1?'s':''),hjEmpty:!!hjRows&&!tasks.length,
    hjTasks:tasks.map(function(t,i){var act=!!(t.active||!t.end);return{lieu:t.lieu||'—',h:(t.start||'?')+' → '+(act?'en cours':(t.end||'?')),dur:act?'en cours':fmtH(Number(t.hrs)||0),
      detail:[t.odt?'ODT '+t.odt:'',t.detail||''].filter(Boolean).join(' · '),tags:[t.pendingValidation?'À valider':'',t.approuve?'Approuvé':'',t.correctedBy?'Corrigé':'',t.ajoutePar?'Ajouté au bureau':''].filter(Boolean).join(' · '),
      edit:function(){self.editPunch(i);},bd:act?'var(--color-accent-700)':'var(--color-text)'};}),
    hjCanApprove:tasks.some(function(t){return!t.approuve&&!(t.active||!t.end);}),hjApprove:function(){self.approve(hj.uid,hj.wk,hj.di);},hjAdd:function(){self.newPunch();},
    hjClose:function(){self.setState({hj:null,hp:null});},hjCloseBg:function(e){if(e.target===e.currentTarget)self.setState({hj:null,hp:null});},
    hpOpen:!!hp,hpNew:!!hp&&hp.i<0,hpTitle:hp?(hp.i<0?'Ajouter un punch':'Corriger le punch'):'',hpLieu:hp?hp.lieu:'',hpStart:hp?hp.start:'',hpEnd:hp?hp.end:'',hpDetail:hp?hp.detail:'',hpOdt:hp?hp.odt:'',hpActive:!!(hp&&hp.active),
    onHpLieu:setP('lieu'),onHpStart:setP('start'),onHpEnd:setP('end'),onHpDetail:setP('detail'),onHpOdt:setP('odt'),hpSave:function(){self.savePunch();},hpDel:function(){self.delPunch();},hpCancel:function(){self.setState({hp:null});},
    hpClosed:!hp,hpCanDel:!!hp&&hp.i>=0,hpDelLbl:hp&&hp.confirm?'Confirmer la suppression':'Supprimer ce punch'};
  var TT=[['semaine','Semaine',''],['employe','Par employé',''],['valider','À valider',punchRows.length||''],['paie','Paie',''],['cumul','Cumul','']];
  return Object.assign(hjV,{tempsTabs:TT.map(function(x){var on=tt===x[0];return{label:x[1],n:x[2],bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)',go:function(){self.setState({tempsTab:x[0]});}};}),
    isTempsTab:tt==='semaine',isSuiviTab:tt==='valider',isPaieTab:tt==='paie',isCumulTab:tt==='cumul',tWeekLoading:!loaded&&this.ftw[wk]!=='err',tWeekErr:this.ftw[wk]==='err'?'Feuilles de temps illisibles : '+(this.ftwErr||''):'',
    tLabel:wkLabel(tMon),tPrev:function(){self.setState({tOff:st.tOff-1});},tNext:function(){self.setState({tOff:Math.min(0,st.tOff+1)});},tToday:function(){self.setState({tOff:0});},
    tDays:days,tRows:rows,tTeam:fmtH(teamT),tTeamSupp:teamS>0?'dont +'+fmtH(teamS)+' supplémentaires':'',noTRows:loaded&&!rows.length,
    paie:paie,paieNone:loaded&&!paie.length,paieCount:nSel+' sélectionné(s) sur '+paie.length,paieAll:function(){var s={};data.forEach(function(e){s[e.id]=e.any;});var o={};o[wk]=s;self.setState({paieSel:Object.assign({},st.paieSel,o)});},
    paieNoneSel:function(){var o={};o[wk]={};self.setState({paieSel:Object.assign({},st.paieSel,o)});},paieXlsx:function(){self.exportPaie();},paiePrint:function(){self.printPaie();},paieSent:function(){self.markSent();},paieMail:function(){self.mailPaie();},emailPaie:st.emailPaie!=null?st.emailPaie:emailPaie(),onEmailPaie:function(ev){var v=ev.target.value;try{localStorage.setItem('sa_admin_email_paie',v.trim());}catch(x){}self.setState({emailPaie:v});},
    paieModes:[['synthese','Feuille (regroupée)'],['journal','Journal des punchs']].map(function(x){return Object.assign({label:x[1],go:function(){self.setState({paieMode:x[0]});}},segS(mode===x[0]));})});};

Comp.prototype.statsVals=function(){var self=this,st=this.state,D=this.D,sMon=addDays(mondayOf(new Date()),7*st.sOff),wk=iso(sMon);
  if(st.mod==='stats'&&this.ftw[wk]===undefined)this.loadWeekFT(wk);
  var loaded=Array.isArray(this.ftw[wk]),data=loaded?this.weekData(wk):[],max=Math.max(40,data.reduce(function(m,e){return Math.max(m,e.total);},0));
  var tot=data.reduce(function(s,e){return s+e.total;},0),supp=data.reduce(function(s,e){return s+e.supp;},0);
  var woOuv=D.wo.filter(function(w){return!woDone(w.status);}).length,woUrg=D.wo.filter(function(w){return w.priorite==='urgent'&&!woDone(w.status);}).length;
  var bas=(D.inv||[]).filter(function(i){return Number(i.seuil)>0&&Number(i.qte)<=Number(i.seuil);});
  var av=data.reduce(function(s,e){return s+e.nbAV;},0);
  var WS=[['ouvert','Ouverts'],['en_cours','En cours'],['complete','Complétés'],['facture','Facturés']];
  var prevWk=iso(addDays(sMon,-7));if(st.mod==='stats'&&loaded&&this.ftw[prevWk]===undefined)this.loadWeekFT(prevWk);
  var copyT=function(prompt,thenOpen){var t=self.teamReport(wk,prompt);if(!t){self.flash('Aucune heure cette semaine');return;}self.audit('CONSULTATION',wk,{action:'rapport_equipe',format:prompt?'claude':'copie'});
    var w=thenOpen?window.open('https://claude.ai/new','_blank'):null;
    (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){self.flash(thenOpen?(w?'Copié — collez-le dans Claude (Ctrl+V / ⌘V) dans l’onglet qui vient de s’ouvrir':'Copié — ouvrez claude.ai et collez-le'):(prompt?'Copié avec la demande d’analyse — collez-le dans Claude':'Rapport copié — collez-le directement dans Claude'));})
      .catch(function(){self.flash('Copie impossible — utilisez Télécharger');});};
  var copy=function(){copyT(false,false);};
  return{isStats:st.mod==='stats',sLabel:wkLabel(sMon),sPrev:function(){self.setState({sOff:st.sOff-1});},sNext:function(){self.setState({sOff:Math.min(0,st.sOff+1)});},sToday:function(){self.setState({sOff:0});},sLoading:!loaded,
    sKpis:[{l:'Heures de l’équipe',v:fmtH(tot),s:supp>0?'dont '+fmtH(supp)+' supplémentaires':'aucune heure supplémentaire'},{l:'Punchs à valider',v:String(av),s:'cette semaine'},
      {l:'Bons de travail ouverts',v:String(woOuv),s:woUrg?woUrg+' urgent(s)':'aucun urgent'},{l:'Stock sous le seuil',v:String(bas.length),s:bas.slice(0,3).map(function(i){return i.nom;}).join(', ')||'—'}],
    sBars:data.filter(function(e){return e.any||e.total>0;}).sort(function(a,b){return b.total-a.total;}).map(function(e){return{nom:e.nom,h:fmtH(e.total),w:Math.round(e.total/max*100),bg:e.total>40?'var(--color-accent-900)':'var(--color-accent-700)',
      sub:e.supp>0?'+'+fmtH(e.supp)+' supp.':'',open:function(){self.setState({mod:'temps',tempsTab:'employe',eUid:e.id,eDay:null,tOff:st.sOff});}};}),sNoBars:loaded&&!data.some(function(e){return e.any;}),
    sWo:WS.map(function(x){return{l:x[1],n:D.wo.filter(function(w){return w.status===x[0]||(x[0]==='complete'&&w.status==='termine');}).length};}),
    sCopy:copy,sClaude:function(){copyT(true,true);},sCopyPrompt:function(){copyT(true,false);},sDownload:function(){var t=self.teamReport(wk);if(!t){self.flash('Aucune heure cette semaine');return;}saveBlob(new Blob([t],{type:'text/plain;charset=utf-8'}),'SoucyAquatik_Equipe_Semaine_'+wk+'.txt');},
    sXlsx:function(){self.setState({mod:'temps',tempsTab:'paie',tOff:st.sOff});self.flash('Choisissez les employés puis « Télécharger Excel »');}};};

Comp.prototype.vals=function(){
  var self=this,st=this.state,D=this.D,mod=st.mod;
  var base={rootRef:this.rootRef,hasToast:!!st.toast,toast:st.toast,q:st.q,onQ:function(e){self.setState({q:e.target.value});},meNom:(this.user.prenom+' '+this.user.nom).trim(),meIni:((this.user.prenom||'?')[0]+(this.user.nom||'?')[0]).toUpperCase(),meRole:this.user.role==='admin'?'Administration':'Supervision',
    logout:function(){localStorage.removeItem('sa_admin_user');location.reload();}};
  Object.assign(base,this.portalVals());
  if(!D)return Object.assign(base,{navGroups:[],modTitle:'Chargement…',modSub:this.err||'Lecture des données en cours',results:[],hasResults:false,liveTxt:'Connexion…',isLoading:true,loadErr:this.err,isMonitoring:false,isInspections:false,isOperations:false,isSites:false,isSoon:false});
  var now=new Date(),lastRel=this.latest();
  // ---- équipe (feuilles de temps de la semaine : lecture seule)
  var di=(now.getDay()+6)%7,wk=iso(mondayOf(now)),team={};
  D.comptes.forEach(function(c){if(c.role!=='admin')team[c.id]={c:c,seen:false,task:null,running:false};});
  D.ft.forEach(function(f){var t=team[f.uid];if(!t)return;t.seen=true;if(f.week===wk){var d=f.days&&f.days[di];var ts=(d&&d.tasks)||[];t.n=ts.length;t.task=ts.length?ts[ts.length-1]:null;t.running=ts.some(function(x){return x.active;});var run=ts.filter(function(x){return x.active;})[0];if(run)t.task=run;}});
  var techRows=Object.keys(team).map(function(k){return team[k];}).filter(function(t){return t.seen;}).map(function(t){
    var nom=(t.c.prenom+' '+t.c.nom).trim(),tk=t.task,s=tk&&(D.byId[String(tk.siteId)]),run=t.running;
    return{ini:((t.c.prenom||'?')[0]+(t.c.nom||'?')[0]).toUpperCase(),nom:nom,statut:run?'Punché':(tk?'Hors punch':'Aucun punch'),site:tk?(s?s.nom:(tk.lieu||'—')):'—',ville:s?s.ville:'',depuis:run&&tk?tk.start:'—',
      last:tk?((tk.end||tk.start||'')+' · '+(tk.lieu||'')):'—',stBg:run?'var(--color-accent-700)':'transparent',stFg:run?'#ffffff':'var(--color-text)',stBd:run?'var(--color-accent-700)':'var(--color-text)',op:tk?1:0.55,
      go:function(){if(s)self.go('inspections',{inspSite:s.id,inspKey:null});},_run:run};});
  var nPunched=techRows.filter(function(t){return t._run;}).length;
  // ---- relevés / hors zone
  var horsZone=[];Object.keys(lastRel).forEach(function(sid){var r=lastRel[sid];self.outOf(r).forEach(function(o){var s=D.byId[sid];horsZone.push({site:s?s.nom:r.site_nom,param:o.f.label,val:fr(o.v,o.f.step)+(o.f.unit?' '+o.f.unit:''),dir:o.v<o.f.lo?'bas':'élevé',zone:fr(o.f.lo,o.f.step)+' – '+fr(o.f.hi,o.f.step),tech:r.tech_nom||r.tech,go:function(){self.go('inspections',{inspSite:sid,inspKey:o.f.key});}});});});
  var relToday=D.rel.filter(function(r){return r.date===D.today;});
  var woToday=D.wo.filter(function(w){return w.date===D.today;}).length+D.nPlan+D.nPt;
  var suivis=Object.keys(lastRel).filter(function(s){return lastRel[s].date>=iso(addDays(now,-30));}).length;
  var openDem=D.dem.filter(function(d){return d.statut!=='Traitée';}),urgDem=openDem.filter(function(d){return d.type==='Urgence';});
  var kpis=[{label:'Techniciens punchés',val:nPunched,of:' / '+techRows.length,sub:techRows.length-nPunched+' hors punch'},
    {label:'Visites du jour',val:woToday,of:'',sub:'WO, créneaux et tâches'},
    {label:'Relevés saisis aujourd’hui',val:relToday.length,of:'',sub:relToday.length?'par les techniciens':'aucun encore'},
    {label:'Relevés hors zone',val:horsZone.length,of:'',sub:'à la dernière visite',hot:horsZone.length>0},
    {label:'Demandes ouvertes',val:openDem.length,of:'',sub:urgDem.length?urgDem.length+' urgence(s)':'du terrain',hot:urgDem.length>0},
    {label:'Sites avec relevé (30 j)',val:suivis,of:' / '+D.sites.length,sub:'sa-terrain'}].map(function(k){return Object.assign(k,{bg:k.hot?'var(--color-accent-900)':'transparent',fg:k.hot?'#ffffff':'var(--color-text)'});});
  // ---- flux
  var flux=[];
  D.gps.forEach(function(g){flux.push({t:D.today+' '+(g.heure||''),h:g.heure||'',txt:'Punch',who:g.emp,site:g.lieu||'—',icon:'login',bg:'transparent',fg:'var(--color-text)'});});
  relToday.forEach(function(r){var no=self.outOf(r).length;flux.push({t:D.today+' '+(r.heure||''),h:r.heure||'',txt:no?'Relevé — '+no+' valeur(s) hors zone':'Relevé enregistré',who:r.tech_nom||r.tech,site:r.site_nom,icon:no?'alert':'clipboard',bg:no?'var(--color-accent-900)':'transparent',fg:no?'#ffffff':'var(--color-text)'});});
  D.dem.slice(0,10).forEach(function(d){var t=new Date(d.created_at),urg=d.type==='Urgence'&&d.statut!=='Traitée',tod=iso(t)===D.today;flux.push({t:iso(t)+' '+pad(t.getHours())+':'+pad(t.getMinutes()),h:(tod?'':t.getDate()+' '+MOIS[t.getMonth()].slice(0,3)+'. ')+pad(t.getHours())+':'+pad(t.getMinutes()),txt:d.type+' — '+(d.texte||d.motif||''),who:d.tech_nom||d.tech,site:d.site_nom||'hors site',hasPhoto:!!d.has_photo,openPhoto:function(){self.openDemPhoto(d.id);},icon:urg?'alert':'message',bg:urg?'var(--color-accent-900)':'transparent',fg:urg?'#ffffff':'var(--color-text)'});});
  flux.sort(function(a,b){return String(b.t).localeCompare(String(a.t));});flux=flux.slice(0,16);
  // ---- inspections
  var fil=st.inspFilter,typesArr=Object.keys(D.types);
  var typeOptions=[{v:'all',l:'Tous les types de bassin'}].concat(typesArr.map(function(k){return{v:k,l:D.types[k].label};})).map(function(o){return Object.assign({},o,{sel:o.v===fil});});
  var inspSites=D.sites.filter(function(s){return fil==='all'||s.type===fil;}).map(function(s){var on=s.id===st.inspSite,r=lastRel[s.id],n=r?self.outOf(r).length:0;
    return{nom:s.nom,ville:s.ville,court:self.T(s.type).court,nOut:n||null,bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)',go:function(){self.setState({inspSite:s.id,inspKey:null});}};});
  var is=D.byId[st.inspSite]||D.sites[0]||{id:'',nom:'—',type:'GEN',ville:'',contrat:'',bassins:[]},ibl=is.bassins||[],ib=ibl.filter(function(b){return(b.id||b.nom)===st.inspBassin;})[0]||ibl[0]||null;
  /* Plusieurs bassins : chaque bassin a ses relevés et ses paramètres ; le 1er bassin reprend les anciens relevés sans bassin */
  var inB=function(r){if(!ib||ibl.length<2)return true;return r.bassin?r.bassin===ib.nom:ib===ibl[0];},IT=this.T(ib&&ib.type_code?ib.type_code:is.type),fields=IT.fields||[];
  var f=fields.filter(function(x){return x.key===st.inspKey;})[0]||fields[0]||{key:'',label:'—',unit:'',min:0,max:1,lo:0,hi:1,step:0.1};
  var hist=D.rel.filter(function(r){return r.site_id===is.id&&inB(r)&&r.vals&&r.vals[f.key]!=null;}).slice(-30),n=hist.length;
  var yp=function(v){return(1-(v-f.min)/(f.max-f.min))*100;},outV=function(v){return v<f.lo||v>f.hi;};
  var vs=hist.map(function(h){return h.vals[f.key];}),avg=n?vs.reduce(function(a,b){return a+b;},0)/n:0,nOutH=vs.filter(outV).length,xpos=function(i){return n>1?i/(n-1)*100:50;};
  var chart={path:n>1?hist.map(function(h,i){return(i?'L':'M')+(xpos(i)*10).toFixed(1)+' '+(yp(h.vals[f.key])*2.6).toFixed(1);}).join(' '):'',
    dots:hist.map(function(h,i){var v=h.vals[f.key];return{x:xpos(i),y:yp(v),s:outV(v)?12:8,bg:outV(v)?'var(--color-text)':'var(--color-bg)',tip:fdate(h.date)+' · '+fr(v,f.step)+' '+f.unit};}),
    xl:hist.map(function(h,i){return{x:xpos(i),d:fdate(h.date)};}).filter(function(_,i){return i%5===0||i===n-1;}),
    hiTop:yp(f.hi),loTop:yp(f.lo),bandH:yp(f.lo)-yp(f.hi),minTxt:fr(f.min,f.step),maxTxt:fr(f.max,f.step),loTxt:fr(f.lo,f.step),hiTxt:fr(f.hi,f.step),
    stats:[{l:'Dernier relevé',v:n?fr(vs[n-1],f.step)+' '+f.unit:'—'},{l:'Moyenne 30 j',v:n?fr(avg,f.step):'—'},{l:'Min / max',v:n?fr(Math.min.apply(null,vs),f.step)+' / '+fr(Math.max.apply(null,vs),f.step):'—'},{l:'Dans la zone',v:n?Math.round((n-nOutH)/n*100)+' %':'—'},{l:'Jours hors zone',v:String(nOutH)}]};
  var siteRel=D.rel.filter(function(r){return r.site_id===is.id&&inB(r);}).slice(-10).reverse();
  var inspTable={cols:fields.map(function(x){return x.label+(x.unit?' ('+x.unit+')':'');}),rows:siteRel.map(function(r){return{d:fdate(r.date)+' '+(r.heure||''),cells:fields.map(function(x){var v=r.vals&&r.vals[x.key],has=v!=null&&r.touched&&r.touched[x.key],o=has&&(v<x.lo||v>x.hi);return{v:has?fr(v,x.step):'—',bg:o?'var(--color-accent-900)':'transparent',fg:o?'#ffffff':'var(--color-text)'};})};})};
  var lastR=lastRel[is.id];
  // ---- opérations (WO groupés par dossier)
  var names={};D.comptes.forEach(function(c){names[c.id]=(c.prenom+' '+c.nom).trim();});
  var groups={};D.wo.forEach(function(w){var k=w.groupe_id||(norm(w.client)+'|'+norm(w.site)+'|'+norm(w.type));(groups[k]=groups[k]||[]).push(w);});
  var OST={'Urgent':['var(--color-accent-900)','#ffffff','var(--color-accent-900)'],'En cours':['var(--color-accent-700)','#ffffff','var(--color-accent-700)'],'Fermé':['transparent','var(--color-neutral-700)','var(--color-divider)']};
  var VST={'fait':['var(--color-accent-700)','#ffffff'],'en cours':['var(--color-text)','var(--color-bg)'],'planifié':['transparent','var(--color-text)'],'à assigner':['var(--color-accent-100)','var(--color-accent-900)']};
  var all=Object.keys(groups).map(function(k){var g=groups[k],faits=g.filter(function(w){return woDone(w.status);}).length,urg=g.some(function(w){return w.priorite==='urgent';})&&faits<g.length;
    var stt=faits===g.length?'Fermé':(urg?'Urgent':'En cours'),f0=g[0],as={};g.forEach(function(w){String(w.assigne||'').split(/,\s*/).filter(Boolean).forEach(function(a){as[a]=1;});});
    var s=null;D.sites.forEach(function(x){if(!s&&(norm(x.nom)===norm(f0.client)))s=x;});var c=OST[stt];
    return{id:String(f0.id).slice(-6).toUpperCase(),client:f0.client,objet:(f0.type?f0.type.charAt(0).toUpperCase()+f0.type.slice(1):'Visite')+(f0.site?' · '+f0.site:''),contrat:s&&s.contrat||'—',nVisites:g.length,
      resp:Object.keys(as).map(function(a){return names[a]||a;}).join(', ')||'À assigner',faits:faits,total:g.length,pct:faits/g.length*100,statut:stt,stBg:c[0],stFg:c[1],stBd:c[2],_next:g.filter(function(w){return!woDone(w.status);})[0],_g:g,_s:s};});
  var opsF=['Tous','Urgent','En cours','Fermé'];
  var opsFilters=opsF.map(function(o){var n=o==='Tous'?all.length:all.filter(function(d){return d.statut===o;}).length;return Object.assign({label:o,n:n,go:function(){self.setState({opsFilter:o});}},segS(st.opsFilter===o));});
  var dossiers=all.filter(function(d){return st.opsFilter==='Tous'||d.statut===st.opsFilter;}).sort(function(a,b){var r=function(x){return x.statut==='Urgent'?0:x.statut==='En cours'?1:2;};return r(a)-r(b)||String((a._next||{}).date||'9').localeCompare(String((b._next||{}).date||'9'));}).map(function(d){var open=!!st.opsOpen[d.id];
    return Object.assign({},d,{open:open,chev:open?'down':'right',rowBg:open?'var(--color-accent-100)':'transparent',toggle:function(){self.setState(function(s2){var o=Object.assign({},s2.opsOpen);o[d.id]=!o[d.id];return{opsOpen:o};});},
      visites:d._g.map(function(w){var open=function(){self.openEdit({kind:'wo',id:w.id});};var sv=woDone(w.status)?'fait':w.status==='en_cours'?'en cours':(w.assigne?'planifié':'à assigner'),c=VST[sv];return{open:open,date:fdate(w.date),tache:String(w.descr||'').split('\n')[0].slice(0,80)||'Visite',tech:String(w.assigne||'').split(/,\s*/).filter(Boolean).map(function(a){return names[a]||a;}).join(', ')||'—',statut:sv,bg:c[0],fg:c[1]};}),
      sites:d._s?[{nom:d._s.nom,go:function(){self.go('inspections',{inspSite:d._s.id,inspKey:null});}}]:[],
      addVisit:function(){var e=String(d._g[0].assigne||'').split(/,\s*/)[0]||'';self.openDlg({type:'Bon de travail',site:d._s?d._s.id:'',tech:e});},goFact:function(){self.setState({mod:'facturation',factFilter:'Tous'});}});});
  // ---- sites
  var nouveaux=D.sites.filter(function(s){return/automatiquement/i.test(s.notes);}).map(function(s){var dup=null;D.sites.forEach(function(x){if(!dup&&x.id!==s.id&&!/automatiquement/i.test(x.notes)&&norm(x.nom).length>3&&(norm(s.nom).indexOf(norm(x.nom))>=0||norm(x.nom).indexOf(norm(s.nom))>=0))dup=x;});
    return{nom:s.nom,source:'Détecté depuis un punch',gps:'—',icon:'pin',isNew:!dup,isDup:!!dup,pending:true,done:false,doneTxt:'',dupNom:dup?dup.nom:'',dupGps:'—',op:1,suggestion:dup?'Probable doublon de « '+dup.nom+' »':'Nouveau site à confirmer',
      primaryLabel:dup?'Fusionner dans « '+dup.nom+' »':'Valider ce site',primary:function(){self.siteAction(s.id,dup?'merge':'validate',dup?dup.id:null);},altLabel:'Garder séparé',alt:function(){self.siteAction(s.id,'validate',null);},ignore:function(){self.flash('Aucune modification effectuée');}};});
  var stype=st.siteType;
  var siteTypeOptions=[{v:'all',l:'Tous les types de bassin'}].concat(typesArr.map(function(k){return{v:k,l:D.types[k].label};})).map(function(o){return Object.assign({},o,{sel:o.v===stype});});
  var sq=norm(st.siteQ||''),lastBy=this.latest();
  var siteRows=D.sites.filter(function(s){return(stype==='all'||s.type===stype)&&(!sq||norm(s.nom+' '+s.addr+' '+s.contrat).indexOf(sq)>=0);}).map(function(s){var r=lastBy[s.id],nb=s.bassins.length,wo=D.wo.filter(function(w){return norm(w.client)===norm(s.nom)&&!woDone(w.status);}).length;
    return{nom:s.nom,client:nb?nb+' bassin'+(nb>1?'s':''):'1 (par défaut)',ville:s.ville||'—',court:self.T(s.type).court,freq:r?fdate(r.date):'—',tech:wo?wo+' ouvert(s)':'—',gps:s.gps?'Défini':(s.addr?'Adresse':'—'),bassin:s.addr||'sans adresse',contrat:s.contrat||'—',go:function(){self.openSiteEdit(s.id);}};});

  // ---- TEMPS · SUIVI · CUMUL (lecture seule des feuilles de temps existantes)
  var tMon=addDays(mondayOf(now),7*st.tOff),tWk=iso(tMon),allTeam=D.comptes.filter(function(c){return c.role!=='admin';}),actif=function(id){return D.statut[id]!=='inactif';},team=allTeam.filter(function(c){return actif(c.id);}),cn={};D.comptes.forEach(function(c){cn[c.id]=(c.prenom+' '+c.nom).trim();});
  var tempsRows=allTeam.map(function(c){var row=D.ft.filter(function(f){return f.uid===c.id&&f.week===tWk;})[0],tot=0,live=false,jours=[];
    for(var i=0;i<7;i++){var d=row&&row.days&&row.days[i],h=0,lv=false;((d&&d.tasks)||[]).forEach(function(t){h+=Number(t.hrs)||0;if(t.active)lv=true;});tot+=h;if(lv)live=true;jours.push((h>0?fmtH(h):'—')+(lv?' ●':''));}
    var cum=D.ftAll.filter(function(f){return f.uid===c.id;}).reduce(function(s,f){return s+(Number(f.total_h)||0);},0);
    return{_keep:actif(c.id)||tot>0||live,nom:(c.prenom+' '+c.nom).trim()+(actif(c.id)?'':' (inactif)'),op:(tot>0||live)?1:0.5,jours:jours,semaine:tot>0?fmtH(tot):'—',cumul:fmtH(cum),banque:'—',sup:'—'};}).filter(function(r){return r._keep||st.tempsTab==='cumul';});
  var punchRows=[];(Array.isArray(this.ftw[tWk])?this.ftw[tWk]:D.ft.filter(function(f){return f.week===tWk;})).forEach(function(f){(f.days||[]).forEach(function(d,i){var di=iso(addDays(tMon,i));((d&&d.tasks)||[]).forEach(function(t){
    var flag=t.pendingValidation?(t.pendingReason==='nouveau_site'?'Nouveau site à valider':t.pendingReason==='correction_employe'?'Corrigé par l’employé — à valider':'Entrepôt / bureau à confirmer'):(t.autoClosed?'Fermé automatiquement à 20 h':((t.active&&di<D.today)?'Punch resté ouvert':''));if(!flag)return;
    var nomE=cn[f.uid]||f.emp||f.uid,pRow={uid:f.uid,week:tWk,dayIdx:i,_start:t.start||'',_lieu:t.lieu||'',nom:nomE,jour:DJ[i]+' '+addDays(tMon,i).getDate(),entree:t.start||'—',sortie:t.end||'—',site:t.lieu||'—',flag:flag,pending:true,done:false,etat:'',bg:'var(--color-accent-100)'};
    pRow.fix=function(){self.openFix(pRow);};pRow.ok=function(){self.validerPunch(pRow);};punchRows.push(pRow);});});});
  var tt=st.tempsTab,tempsTabs=[['temps','Temps',''],['suivi','Suivi',punchRows.length||''],['cumul','Cumul','']].map(function(x){var on=tt===x[0];return{label:x[1],n:x[2],bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)',go:function(){self.setState({tempsTab:x[0]});}};});
  var tDays=[];for(var ti=0;ti<7;ti++)tDays.push({label:DJ[ti]+' '+addDays(tMon,ti).getDate()});
  // ---- PLANNING ÉQUIPE (5 jours, lecture seule)
  var pMon=addDays(mondayOf(now),7*st.pOff),pk=iso(pMon),PL=this.pl[pk];
  if(mod==='planning'&&!PL&&!this._pl[pk]){this._pl[pk]=1;this.loadPlan(pMon).then(function(){self.update();});}
  var planRows=[],pDays=[];
  for(var pi=0;pi<5;pi++){var pdt=addDays(pMon,pi),isT=iso(pdt)===D.today;pDays.push({label:DJ[pi]+' '+pdt.getDate(),bg:isT?'var(--color-text)':'transparent',fg:isT?'var(--color-bg)':'var(--color-text)'});}
  if(PL){var rowsP={},order=[];
    var addSlot=function(emp,di,slot){if(di<0||di>4)return;var k=emp||'_none';if(!rowsP[k]){rowsP[k]={nom:emp?(cn[emp]||emp):'Non assigné',cells:[[],[],[],[],[]],n:0,min:0};order.push(k);}rowsP[k].cells[di].push(slot);rowsP[k].n++;if(slot._min)rowsP[k].min+=slot._min;};
    team.forEach(function(c){rowsP[c.id]={nom:(c.prenom+' '+c.nom).trim(),cells:[[],[],[],[],[]],n:0,min:0};order.push(c.id);});
    var idx=function(dt){return Math.round((new Date(dt+'T12:00:00')-pMon)/86400000);};
    var mk=function(h,nom,tache,rec,done,mn,kind,id){return{h:h||'—',nom:nom||'—',tache:tache||'',rec:!!rec,bg:done?'var(--color-accent-700)':'var(--color-bg)',fg:done?'#ffffff':'var(--color-text)',_min:mn||0,open:function(e){if(e&&e.stopPropagation)e.stopPropagation();self.openEdit({kind:kind,id:id});}};};
    var woIds={},plIds={};PL.wo.forEach(function(w){woIds[w.id]=1;});PL.plan.forEach(function(p){plIds[p.id]=1;});
    PL.wo.forEach(function(w){var as=String(w.assigne||'').split(/,\s*/).filter(Boolean);if(!as.length)as=[''];as.forEach(function(e){addSlot(e,idx(w.date),mk('',w.client,String(w.descr||'').split('\n')[0].slice(0,40)||'Visite',w.groupe_id,woDone(w.status),0,'wo',w.id));});});
    PL.plan.forEach(function(p){var as=String(p.emp||'').split(/,\s*/).filter(Boolean);if(!as.length)as=[''];as.forEach(function(e){addSlot(e,idx(p.date),mk(p.heure,p.client,String(p.descr||'').split('\n')[0].slice(0,40)||'Intervention',false,p.status==='termine',0,'plan',p.id));});});
    PL.pt.forEach(function(t){if((t.wo_id&&woIds[t.wo_id])||(t.plan_id&&plIds[t.plan_id]))return;var as=String(t.emp||'').split(/,\s*/).filter(Boolean);if(!as.length)as=[''];
      for(var d=0;d<5;d++){var dd=iso(addDays(pMon,d));if(dd<t.date_debut||dd>t.date_fin)continue;as.forEach(function(e){addSlot(e,d,mk(t.heure_debut,t.site_nom,t.titre,t.recurrence,t.statut==='termine',minsFrom(t.heure_debut,t.heure_fin),'pt',t.id));});}});
    planRows=order.map(function(k){var r=rowsP[k];var kk=k;return{nom:r.nom,op:1,hours:r.n+' visite'+(r.n>1?'s':'')+(r.min?' · '+fmtH(r.min/60):''),cells:r.cells.map(function(sl,d){return{slots:sl,bg:iso(addDays(pMon,d))===D.today?'var(--color-accent-100)':'transparent',add:function(e){if(e&&e.target!==e.currentTarget)return;self.openDlg({tech:k==='_none'?'':k,debut:iso(addDays(pMon,d))});}};})};});}


  var f=st.f,setF=function(k,v){var o={};o[k]=v;self.setState({f:Object.assign({},st.f,o)});},occ=occurrences(f);
  var techOpts=[{v:'',l:'Non assigné',sel:!f.tech}].concat(D.comptes.filter(function(c){return c.role!=='admin'&&D.statut[c.id]!=='inactif';}).map(function(c){return{v:c.id,l:(c.prenom+' '+c.nom).trim(),sel:c.id===f.tech};}));
  var siteOpts=[{v:'',l:'— Choisir un site —',sel:!f.site}].concat(D.sites.map(function(s){return{v:s.id,l:s.nom+(s.ville?' — '+s.ville:''),sel:s.id===f.site};}));
  var DLd=[['L',1],['M',2],['M',3],['J',4],['V',5],['S',6],['D',0]],fd=function(d){return DJ[(d.getDay()+6)%7]+' '+d.getDate()+' '+MOIS[d.getMonth()].slice(0,4)+'.';};
  var dlgV={dlgOpen:!!st.dlg,closeDlg:function(){self.setState({dlg:false});},closeDlgBg:function(e){if(e.target===e.currentTarget)self.setState({dlg:false});},stop:function(e){e.stopPropagation();},
    dlgTypes:['Bon de travail','Créneau','Tâche'].map(function(t){return Object.assign({label:t,go:function(){setF('type',t);}},segS(f.type===t));}),
    fv:f,onF:{site:function(e){setF('site',e.target.value);},tech:function(e){setF('tech',e.target.value);},debut:function(e){setF('debut',e.target.value);},heure:function(e){setF('heure',e.target.value);},fin:function(e){setF('fin',e.target.value);}},
    siteOptions:siteOpts,techOptions:techOpts,recOpts:[['aucune','Une seule fois'],['hebdo','Chaque semaine'],['bihebdo','Aux 2 semaines']].map(function(x){return Object.assign({label:x[1],go:function(){setF('rec',x[0]);}},segS(f.rec===x[0]));}),hasRec:f.rec!=='aucune',
    dayToggles:DLd.map(function(x){return Object.assign({l:x[0],go:function(){var j=Object.assign({},f.jours);j[x[1]]=!j[x[1]];setF('jours',j);}},segS(!!f.jours[x[1]]));}),
    occCount:occ.length,occLabel:(occ.length>1?'occurrences · ':'occurrence · ')+((D.byId[f.site]||{}).nom||'site à choisir'),occList:occ.slice(0,14).map(fd).concat(occ.length>14?['+ '+(occ.length-14)+' autres']:[]),
    createLabel:st.busy?'Création…':(occ.length>1?'Créer la série ('+occ.length+')':'Créer'),createSeries:function(){self.createSeries();}};

  var ed=st.ed,sd=st.sed,setE=function(k,v){var o={};o[k]=v;self.setState({ed:Object.assign({},st.ed,o)});},setS=function(k,v){var o={};o[k]=v;self.setState({sed:Object.assign({},st.sed,o)});};
  var edTechs=[{v:'',l:'Non assigné',sel:ed&&!ed.tech}].concat(D.comptes.filter(function(c){return c.role!=='admin'&&(D.statut[c.id]!=='inactif'||(ed&&ed.tech===c.id));}).map(function(c){return{v:c.id,l:(c.prenom+' '+c.nom).trim(),sel:!!ed&&c.id===ed.tech};}));
  var edStat=ed?(ed.kind==='wo'?[['ouvert','À faire'],['en_cours','En cours'],['termine','Terminé']]:[['ouvert','À faire'],['termine','Terminé']]).map(function(x){return Object.assign({label:x[1],go:function(){setE('statut',x[0]);}},segS(ed.statut===x[0]));}):[];
  var edV={edOpen:!!ed,edLoading:!!(ed&&ed.loading),edReady:!!(ed&&!ed.loading),edTitle:ed&&!ed.loading?ed.label+' — '+ed.titre:'Chargement…',edDate:ed?ed.date:'',edHeure:ed?ed.heure:'',edShowHeure:!!(ed&&ed.kind!=='wo'),edCanDate:!!(ed&&!ed.multiJour),edMulti:!!(ed&&ed.multi),edMultiJour:!!(ed&&ed.multiJour),
    edTechOpts:edTechs,edStatuts:edStat,edSerie:!!(ed&&ed.serie),edC0:!!(ed&&ed.confirm===0),edC1:!!(ed&&ed.confirm===1),edC2:!!(ed&&ed.confirm===2),edSerieN:ed?ed.serieN:0,edBusy:!!(ed&&ed.busy),
    onEdDate:function(e){setE('date',e.target.value);},onEdHeure:function(e){setE('heure',e.target.value);},onEdTech:function(e){setE('tech',e.target.value);},
    edSave:function(){self.saveEdit();},edClose:function(){self.setState({ed:null});},edCloseBg:function(e){if(e.target===e.currentTarget)self.setState({ed:null});},
    edAsk1:function(){self.askDel(1);},edAsk2:function(){self.askDel(2);},edDo1:function(){self.doDel(1);},edDo2:function(){self.doDel(2);},edBack:function(){self.setState({ed:Object.assign({},st.ed,{confirm:0})});}};
  var sdTypes=sd?Object.keys(D.types).map(function(k){return{v:k,l:D.types[k].label,sel:sd.type===k};}):[];
  var sdV={sdOpen:!!sd,sdNom:sd?sd.nom:'',sdAddr:sd?sd.addr:'',sdCode:sd?sd.code:'',sdTypes:sdTypes,sdBusy:!!(sd&&sd.busy),
    onSdNom:function(e){setS('nom',e.target.value);},onSdAddr:function(e){setS('addr',e.target.value);},onSdCode:function(e){setS('code',e.target.value);},onSdType:function(e){setS('type',e.target.value);},
    sdSave:function(){self.saveSite();},sdClose:function(){self.setState({sed:null});},sdCloseBg:function(e){if(e.target===e.currentTarget)self.setState({sed:null});},sdRelevés:function(){var id=st.sed.id;self.setState({sed:null});self.go('inspections',{inspSite:id,inspKey:null});}};

  // ---- SONDAGES (résultats lus via la clé du superviseur)
  var RAMP=['var(--color-accent-100)','var(--color-accent-300)','var(--color-accent-500)','var(--color-accent-700)','var(--color-accent-900)'],sk=st.sondKey,slugS=st.survey||(D.sond[0]&&D.sond[0].slug),SV=D.sond.filter(function(x){return x.slug===slugS;})[0],rowsS=slugS?this.sd[slugS]:undefined;
  if(mod==='sondages'&&sk&&slugS&&rowsS===undefined&&!this._sd[slugS]){this._sd[slugS]=1;this.loadSond(slugS);}
  var avgS=function(k,rs){var v=rs.map(function(r){return Number(r[k]);}).filter(function(x){return x>0;});return v.length?v.reduce(function(a,b){return a+b;},0)/v.length:0;};
  var distS=function(k,rs){var d=[0,0,0,0,0];rs.forEach(function(r){var v=Number(r[k]);if(v>=1&&v<=5)d[v-1]++;});return d;};
  var npsS=function(rs){var v=rs.map(function(r){return r.q10_nps;}).filter(function(x){return x!=null;});if(!v.length)return null;var pr=v.filter(function(x){return x>=9;}).length,de=v.filter(function(x){return x<=6;}).length;return Math.round((pr-de)/v.length*100);};
  var surveys=D.sond.map(function(x){var rs=self.sd[x.slug],on=x.slug===slugS,n=rs?npsS(rs):null;return{titre:x.titre,statut:x.actif?'Actif':'Fermé',reponses:rs?rs.length:'—',envoyes:'',scoreTxt:rs&&rs.length?'NPS '+(n>0?'+':'')+n:'—',bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)',go:function(){self.setState({survey:x.slug});}};});
  var rsx=rowsS||[],nN=npsS(rsx),qs=[['q2_qualite','Qualité globale de la formation'],['q3_clarte','Clarté des explications']].map(function(q){var d=distS(q[0],rsx),tot=d.reduce(function(a,b){return a+b;},0)||1;return{q:q[1],avg:avgS(q[0],rsx)?fr(avgS(q[0],rsx),'0.1'):'—',n:rsx.length,segs:d.map(function(n,i){return{w:n/tot*100,bg:RAMP[i],fg:i>=2?'#ffffff':'var(--color-accent-900)',label:n/tot>0.08?n:'',tip:(i+1)+' : '+n+' réponse(s)'};})};});
  var verb=[];rsx.forEach(function(r){[['q7_utile','Le plus utile'],['q8_ameliorer','À améliorer'],['q11_commentaire','Commentaire']].forEach(function(k){if(r[k[0]]&&String(r[k[0]]).trim().length>2)verb.push(k[1]+' — '+r[k[0]]+'  ('+(r.nom||'anonyme')+(r.fonction?', '+r.fonction:'')+')');});});
  var svV={surveys:surveys,scaleLegend:RAMP,needKey:mod==='sondages'&&!sk,noSurvey:mod==='sondages'&&!!sk&&!D.sond.length,showResults:mod==='sondages'&&!!sk&&!!SV&&rowsS!==undefined,builder:false,
    keyVal:st.keyIn,onKey:function(e){self.setState({keyIn:e.target.value});},saveKey:function(){var k=String(st.keyIn||'').trim();if(!k)return;try{localStorage.setItem('sa_admin_sondkey',k);}catch(e){}self.sd={};self._sd={};self.setState({sondKey:k,keyIn:''});},
    openBuilder:function(){self.flash('La création d’un sondage se fait dans SA Platform › Stats');},closeBuilder:function(){},
    sv:{titre:SV?SV.titre:'',cible:SV?SV.client:'',ferme:SV?(SV.actif?'non fixée':'terminée'):'',hasQ:rsx.length>0,noQ:false,reponses:rsx.length,scoreTxt:nN==null?'—':(nN>0?'+':'')+nN,
      kpis:[{l:'Réponses',v:rsx.length},{l:'Qualité moy.',v:avgS('q2_qualite',rsx)?fr(avgS('q2_qualite',rsx),'0.1')+' / 5':'—'},{l:'Clarté moy.',v:avgS('q3_clarte',rsx)?fr(avgS('q3_clarte',rsx),'0.1')+' / 5':'—'},{l:'NPS',v:nN==null?'—':(nN>0?'+':'')+nN}],questions:qs,verbatims:verb}};
  var carteView=st.carteView,segCV=function(v){return segS(carteView===v);};
  var carteV={isGeo:carteView==='geo',isSchema:carteView==='schema',viewGeo:function(){self.setState({carteView:'geo'});},viewSchema:function(){self.setState({carteView:'schema'});},
    geoBg:segCV('geo').bg,geoFg:segCV('geo').fg,schBg:segCV('schema').bg,schFg:segCV('schema').fg,techRows:[],lines:[]};
  var carteInfo=(function(){if(mod!=='carte')return'';var G=self.geoData(),n=Object.keys(G.techs).length;return G.sites.length+' site(s) positionnés d’après les punchs GPS · '+(D.sites.length-G.sites.length)+' sans position · '+n+' technicien(s) punché(s) aujourd’hui (points noirs)';})();

  var fx=st.fx,setFx=function(k,v){var o={};o[k]=v;self.setState({fx:Object.assign({},st.fx,o)});};
  var fxV={fxOpen:!!fx,fxTitle:fx?(fx.nom+' — '+fx.jour):'',fxLieu:fx?fx.lieu2:'',fxEntree:fx?fx.entree2:'',fxSortie:fx?fx.sortie2:'',
    onFxLieu:function(e){setFx('lieu2',e.target.value);},onFxEntree:function(e){setFx('entree2',e.target.value);},onFxSortie:function(e){setFx('sortie2',e.target.value);},
    fxSave:function(){self.saveFix();},fxClose:function(){self.setState({fx:null});},fxCloseBg:function(e){if(e.target===e.currentTarget)self.setState({fx:null});}};

  // ---- FACTURATION (issue de ton fichier Excel, lue en direct)
  var money=function(n){return n==null?'—':n.toLocaleString('fr-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0});};
  var pnom={};D.proj.forEach(function(p){pnom[p.id_projet]=p.nom;});
  var factAll=D.fact.map(function(f){var ec=(f.prix_calcule!=null&&f.prix_facture!=null)?(f.prix_facture-f.prix_calcule):null;
    return{id:f.id,odt:f.odt||'—',po:f.po,hasPo:!!f.po,noPo:!f.po,client:f.client||pnom[f.id_projet]||f.id_projet,site:f.ville||'—',date:f.date?fdate(f.date):'—',
      calc:money(f.prix_calcule),fact:money(f.prix_facture),ecart:ec==null?'—':(ec>0?'+':'')+money(ec).replace('-',''),ecBg:ec>0?'var(--color-accent-900)':'transparent',ecFg:ec>0?'#ffffff':(ec<0?'var(--color-text)':'var(--color-neutral-500)'),
      statut:f.statut_facturation||'—',cycle:function(){self.cycleStatut(f);},_idp:f.id_projet,_ville:f.ville,_calc:f.prix_calcule,_fact:f.prix_facture,_ec:ec,_tech:f.technicien,
      stBg:{'À facturer':'var(--color-accent-100)','Facturé':'var(--color-text)','Payé':'var(--color-accent-700)'}[f.statut_facturation]||'transparent',stFg:{'Facturé':'var(--color-bg)','Payé':'#ffffff'}[f.statut_facturation]||'var(--color-text)'};});
  var ffilt=st.factFilter||'Tous';
  var factRows=factAll.filter(function(b){return ffilt==='Tous'||b.statut===ffilt;});
  var sum=function(k){return factAll.reduce(function(s,b){return s+(b[k]||0);},0);};
  var factKpis=[{l:'Dossiers',v:factAll.length,s:D.proj.length+' projets au répertoire'},{l:'Prix calculé (total)',v:money(sum('_calc')),s:'toutes priorités'},
    {l:'Prix facturé (total)',v:money(sum('_fact')),s:factAll.filter(function(b){return b._fact!=null;}).length+' facturés'},
    {l:'Écart net',v:money(sum('_ec')),s:factAll.filter(function(b){return b._ec>0;}).length+' au-dessus du calculé'}];
  var FF=['Tous','À facturer','Facturé','Payé'];
  var factFilters=FF.map(function(x){var n=x==='Tous'?factAll.length:factAll.filter(function(b){return b.statut===x;}).length;return Object.assign({label:x,n:n,go:function(){self.setState({factFilter:x});}},segS(ffilt===x));});
  var factCount=factRows.length,factTotCalc=money(factRows.reduce(function(s,b){return s+(b._calc||0);},0)),factTotFact=money(factRows.reduce(function(s,b){return s+(b._fact||0);},0)),factTotEcart=money(factRows.reduce(function(s,b){return s+(b._ec||0);},0));
  var exportXls=function(){self.exportFact(factRows);};
  var poManquant=factAll.filter(function(b){return b.noPo;}).length;

  // ---- navigation
  var G=[['Terrain',[['monitoring','Monitoring','activity',horsZone.length+urgDem.length,true],['carte','Carte des sites','map'],['inspections','Inspections','chart']]],['Gestion',[['planmatch','Plan de Match','clipboard'],['operations','Opérations','folder'],['planning','Planning équipe','calendar'],['sites','Sites','building',nouveaux.length],['facturation','Facturation','receipt'],['hivernage','Hivernage','snow']]],['Matériel',[['logistique','Logistique','send'],['stock','Stock','package'],['flotte','Flotte','truck'],['outils','Outils · QR','wrench']]],['Équipe',[['sondages','Sondages clients','star'],['communication','Communication','megaphone'],['temps','Temps · Paie','timer'],['stats','Stats','chart'],['comptes','Comptes','users']]]];
  var LIVE=['outils','stock','flotte','logistique','hivernage','comptes','planmatch','stats','monitoring','inspections','operations','sites','temps','planning','sondages','carte','facturation'];
  var navGroups=G.map(function(g){return{label:g[0],items:g[1].map(function(i){return{label:i[1],icon:i[2],badge:i[3]||null,badgeBg:i[4]?'var(--color-text)':'transparent',badgeFg:i[4]?'var(--color-bg)':'var(--color-text)',go:function(){self.go(i[0]);},bar:mod===i[0]?'var(--color-text)':'transparent',bg:mod===i[0]?'var(--color-accent-100)':'transparent',fw:mod===i[0]?600:400};})};});
  var TITLES={monitoring:['Monitoring en direct','Qui est où, activité terrain et relevés hors zone'],inspections:['Inspections et rapports','Relevés techniques saisis en tournée, par site et dans le temps'],operations:['Opérations','Dossiers clients — les visites d’un même contrat restent regroupées'],sites:['Sites','Répertoire et sites détectés automatiquement'],
    carte:['Carte des sites','Sites et techniciens, d’après les punchs GPS'],sondages:['Sondages clients','Résultats de satisfaction — lecture seule'],planning:['Planning équipe','Qui fait quoi — la semaine, 4 semaines ou le diagramme des travaux sur 8 semaines'],temps:['Temps · Paie','Feuilles de temps de l’équipe — corriger, ajouter, approuver, sortir la paie'],comptes:['Comptes','Employés, rôles, droits, statut et mots de passe — partagés avec SA Platform et sa-terrain'],planmatch:['Plan de Match','Le plan de la journée de chaque employé — tâches, véhicule, travaux du jour'],stats:['Stats','Heures de l’équipe, bons de travail, stock — par semaine'],facturation:['Facturation','Depuis ton fichier Excel — ODT, prix, écarts. PO manquant sur '+poManquant+' dossier(s).'],communication:['Communication d’équipe','Bientôt'],logistique:['Logistique','Bons de livraison et sorties d’inventaire — les mêmes que SA Platform et sa-terrain'],outils:['Outils · QR','Outils étiquetés, qui les a en main, emplacements de l’entrepôt et du bureau, étiquettes QR'],stock:['Stock','Inventaire de l’entrepôt — quantités, seuils d’alerte, prix, entrées et sorties'],flotte:['Flotte','Véhicules de l’entreprise et à qui ils sont assignés'],hivernage:['Hivernage','Rapports de pré-hivernage par site — constats, travaux prévus, suivi']};
  var soonName={communication:'Communication d’équipe'};
  var qq=st.q.trim().toLowerCase();
  var results=qq.length<2?[]:D.sites.filter(function(s){return(s.nom+s.ville+s.contrat).toLowerCase().indexOf(qq)>=0;}).slice(0,5).map(function(s){return{label:s.nom,sub:s.ville+' · '+self.T(s.type).court,go:function(){self.go('inspections',{inspSite:s.id,inspKey:null});}};})
    .concat(all.filter(function(d){return(d.client+d.objet+d.id).toLowerCase().indexOf(qq)>=0;}).slice(0,3).map(function(d){return{label:d.id+' · '+d.client,sub:d.objet,go:function(){var o={};o[d.id]=true;self.go('operations',{opsOpen:o,opsFilter:'Tous'});}};}));
  return Object.assign(base,dlgV,edV,sdV,svV,carteV,fxV,{isFacturation:mod==='facturation',factKpis:factKpis,factFilters:factFilters,factRows:factRows,factCount:factCount,factTotCalc:factTotCalc,factTotFact:factTotFact,factTotEcart:factTotEcart,exportXls:exportXls,isSondages:mod==='sondages',isCarte:mod==='carte',carteInfo:carteInfo,navGroups:navGroups,modTitle:TITLES[mod][0],modSub:TITLES[mod][1],results:results,hasResults:results.length>0,
    hasWarn:!!(this.err||(this.softErr&&this.softErr.length)),retry:function(){self.flash('Rechargement…');self.reloadAll();},
    warnTxt:this.err?(this.err+' — données affichées : dernière lecture réussie à '+pad(this.loadedAt.getHours())+':'+pad(this.loadedAt.getMinutes())+'.'):('Données incomplètes — lecture impossible : '+(this.softErr||[]).join(', ')+'. Les écrans qui en dépendent peuvent paraître vides à tort.'),
    liveTxt:(this.err?'Hors ligne · ':'En direct · ')+JS[now.getDay()]+' '+now.getDate()+' '+MOIS[now.getMonth()].slice(0,4)+'. · '+pad(now.getHours())+':'+pad(now.getMinutes()),isLoading:false,loadErr:this.err,
    isTemps:mod==='temps',isTempsTab:tt==='temps',isSuiviTab:tt==='suivi',isCumulTab:tt==='cumul',tempsTabs:tempsTabs,weekDays:mod==='planning'?pDays:tDays,tempsRows:tempsRows,punchRows:punchRows,tLabel:wkLabel(tMon),tPrev:function(){self.setState({tOff:Math.max(-7,st.tOff-1)});},tNext:function(){self.setState({tOff:Math.min(0,st.tOff+1)});},
    isPlanning:mod==='planning',planRows:planRows,pPrint:function(){self.printPlanning(planRows,pDays,wkLabel(pMon));},pLabel:wkLabel(pMon),pPrev:function(){self.setState({pOff:st.pOff-1});},pNext:function(){self.setState({pOff:st.pOff+1});},openDlg:function(){self.openDlg({});},pLoading:!PL,
    isMonitoring:mod==='monitoring',isInspections:mod==='inspections',isOperations:mod==='operations',isSites:mod==='sites',isSoon:LIVE.indexOf(mod)<0,soonTitle:soonName[mod]||'',
    kpis:kpis,techRows:techRows,flux:flux,salles:[],sallesSummary:'Aucune salle mécanique suivie pour l’instant — les fiches de salle arrivent avec la prochaine version de sa-terrain.',horsZone:horsZone,horsZoneCount:horsZone.length,
    typeOptions:typeOptions,inspFilter:fil,onInspFilter:function(e){self.setState({inspFilter:e.target.value});},inspSites:inspSites,
    insp:{nom:is.nom,client:is.ville||'—',bassin:ib?ib.nom+(ibl.length>1?' ('+ibl.length+' bassins)':''):'1 bassin',contrat:is.contrat||'—',typeLabel:IT.label+(is.type==='GEN'?' · valeurs par défaut':''),norme:IT.norme||'',tech:lastR?(lastR.tech_nom||lastR.tech):'—'},
    inspParams:fields.map(function(x){return Object.assign({label:x.label,go:function(){self.setState({inspKey:x.key});}},segS(x.key===f.key));}),chart:chart,inspTable:inspTable,noHist:n===0,histMsg:n===0?'Aucun relevé enregistré pour ce site et ce paramètre. Les relevés apparaissent ici dès que les techniciens valident une fiche dans sa-terrain.':'',
    inspBassins:ibl.length>1?ibl.map(function(b){return Object.assign({label:b.nom,go:function(){self.setState({inspBassin:b.id||b.nom,inspKey:null});}},segS(b===ib));}):[],inspHasB:ibl.length>1,
    inspPrint:function(){self.printInsp(is.id);},inspXlsx:function(){self.xlsxInsp(is.id);},inspParamsEdit:function(){self.openTypes(ib&&ib.type_code?ib.type_code:is.type);},
    exportMsg:function(){self.printInsp(is.id);},
    opsFilters:opsFilters,dossiers:dossiers,newDossier:function(){self.openDlg({type:'Bon de travail'});},noDossier:dossiers.length===0,
    nouveaux:nouveaux,siteTypeOptions:siteTypeOptions,siteType:stype,onSiteType:function(e){self.setState({siteType:e.target.value});},siteRows:siteRows,siteCount:siteRows.length,noNouveaux:nouveaux.length===0},
    this.tempsVals(punchRows),this.empVals(),this.statsVals(),this.feVals(),this.pmmVals(),this.comptesVals(),this.docsVals(),this.stockVals(),this.outilsVals(),this.monVals(),this.siteFicheVals(),this.typesVals(),this.carteCtlVals(),this.plan2Vals(),this.calVals(),this.seriesVals());
};
Comp.prototype.update=function(){if(!this._host)return;SARender(document.getElementById('tpl'),this._host,this.vals());this.syncMap();var el=this.rootRef.current;if(el)el.style.setProperty('--sa-row','10px');};
Comp.prototype.mount=function(host){var self=this;this._host=host;var hm=hashMod();if(hm&&TITLES_OK(hm))this.state.mod=hm;this.update();
  window.addEventListener('hashchange',function(){var m=hashMod();if(m&&TITLES_OK(m)&&(m!==self.state.mod||self.state.portail)){self.setState({portail:false});self.go(m);}});
  this.load().then(function(){self.update();});
  setInterval(function(){if(document.visibilityState==='visible')self.load().then(function(){self.update();});},60000);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')self.load().then(function(){self.update();});});};

function showLogin(){var el=document.getElementById('login');el.style.display='flex';
  document.getElementById('loginForm').onsubmit=function(e){e.preventDefault();var u=document.getElementById('lu').value.trim().toLowerCase(),p=document.getElementById('lp').value,err=document.getElementById('le');err.textContent='Vérification…';
    fetch(SB+'/rest/v1/rpc/verifier_connexion',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},H),body:JSON.stringify({p_id:u,p_mdp:p})}).then(function(r){return r.json();}).then(function(rows){
      if(!Array.isArray(rows)||!rows.length){err.textContent='Identifiant ou mot de passe incorrect';return;}
      var c=rows[0];if(c.role!=='admin'&&c.role!=='superviseur'){err.textContent='Accès réservé à la supervision.';return;}
      if(c.doit_changer_mdp){err.textContent='Changez d’abord votre mot de passe dans SA Platform.';return;}
      localStorage.setItem('sa_admin_user',JSON.stringify({id:c.id,prenom:c.prenom,nom:c.nom,role:c.role}));location.reload();
    }).catch(function(){err.textContent='Réseau indisponible — réessayez.';});};}
window.addEventListener('DOMContentLoaded',function(){var user=jget('sa_admin_user',null);if(!user){showLogin();return;}
  document.getElementById('login').style.display='none';var c=new Comp(user);window.__admin=c;c.mount(document.getElementById('app'));});
})();
