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
  this.user=user;this.rootRef={current:null};this.D=null;this.ftw={};this._ftwL={};this.envois={};this.loadedAt=null;this.err='';
  this.state={mod:'monitoring',q:'',toast:null,inspSite:null,inspKey:null,inspFilter:'all',opsFilter:'Tous',opsOpen:{},siteType:'all',carteView:'geo',factFilter:'Tous',tempsTab:'semaine',tOff:0,sOff:0,hj:null,hp:null,paieSel:{},paieOpen:{},paieMode:'synthese',pOff:0,ed:null,sed:null,survey:null,sondKey:(function(){try{return localStorage.getItem('sa_admin_sondkey')||'';}catch(e){return '';}})(),keyIn:'',dlg:false,busy:false,f:{type:'Bon de travail',site:'',tech:'',debut:'',heure:'07:00',rec:'aucune',jours:{},fin:''}};this.pl={};this._pl={};this.sd={};this._sd={};
}
Comp.prototype.setState=function(p){this.state=Object.assign({},this.state,typeof p==='function'?p(this.state):p);this.update();};
Comp.prototype.flash=function(t){var s=this;clearTimeout(this._tt);this.state.toast=t;this.update();this._tt=setTimeout(function(){s.state.toast=null;s.update();},2800);};
Comp.prototype.go=function(m,x){this.setState(Object.assign({mod:m,q:''},x||{}));var el=this.rootRef.current&&this.rootRef.current.querySelector('main');if(el)el.scrollTop=0;};

Comp.prototype.load=function(){
  var self=this,now=new Date(),wk=iso(mondayOf(now)),wk0=iso(addDays(mondayOf(now),-7)),today=iso(now),since=iso(addDays(now,-120));
  SOFT_ERR=[];
  return Promise.all([
    get('sites?select=id,nom,addr,type,notes'),get('contrats?select=site_id,type_code,code'),get('types_bassin?select=*'),
    soft('comptes_publics?select=id,prenom,nom,role,dept,tel',[]),
    soft('feuilles_temps?select=uid,emp,week,days,total_h&week=gte.'+iso(addDays(now,-56)),[]),
    soft('workorders?select=id,client,site,type,priorite,status,date,assigne,descr,groupe_id&order=date.asc',[]),
    soft('releves?select=id,site_id,site_nom,tech,tech_nom,date,heure,type_code,vals,touched,checks,prods,note,hors_zone&date=gte.'+since+'&order=date.asc,heure.asc',[]),
    soft('punch_gps_log?select=emp,heure,lieu,date&date=eq.'+today+'&order=heure.desc&limit=30',[]),
    soft('plan?select=id&date=eq.'+today,[]),soft('planning_tasks?select=id&date_debut=lte.'+today+'&date_fin=gte.'+today,[]),soft('demandes?select=id,tech,tech_nom,site_nom,type,motif,texte,statut,created_at,has_photo&order=created_at.desc&limit=40',[]),soft('feuilles_temps?select=uid,week,total_h',[]),soft('facturation?select=*',[]),soft('projets_excel?select=*',[]),soft('comptes?select=id,statut',[]),soft('sondages?select=id,slug,titre,client,actif,created_at&order=created_at.desc',[]),soft('punch_gps_log?select=site_id,emp,lat,lng,acc,date,heure,lieu&lat=not.is.null&order=date.desc,heure.desc&limit=800',[]),soft('inventaire?select=id,nom,qte,seuil',[])
  ]).then(function(r){
    var T={};r[2].forEach(function(t){T[t.code]=t;});var ct={};r[1].forEach(function(c){ct[c.site_id]=c;});
    var sites=r[0].map(function(s){var c=ct[s.id],code=(c&&c.type_code&&T[c.type_code])?c.type_code:'GEN';return{id:String(s.id),nom:s.nom||'(sans nom)',addr:s.addr||'',ville:villeOf(s.addr),type:code,contrat:(c&&c.code)||'',notes:s.notes||''};})
      .sort(function(a,b){return a.nom.localeCompare(b.nom,'fr');});
    var byId={};sites.forEach(function(s){byId[s.id]=s;s.merged=/^Fusionné →/.test(s.notes);});var sitesAll=sites;sites=sites.filter(function(s){return!s.merged;});
    self.D={sites:sites,sitesAll:sitesAll,byId:byId,types:T,comptes:r[3],ft:r[4],wo:r[5],rel:r[6].map(function(x){x.site_id=String(x.site_id);return x;}),gps:r[7],nPlan:r[8].length,nPt:r[9].length,dem:r[10]||[],ftAll:r[11]||[],fact:r[12]||[],proj:r[13]||[],sond:r[15]||[],geo:r[16]||[],inv:r[17]||[],statut:(function(){var m={};(r[14]||[]).forEach(function(c){m[c.id]=c.statut;});return m;})(),today:today};
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
Comp.prototype.reloadAll=function(){var self=this;this.pl={};this._pl={};this.ftw={};return this.load().then(function(){self.update();});};
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
Comp.prototype.openSiteEdit=function(id){var s=this.D.byId[id];if(!s)return;var t=this.D.types;this.setState({sed:{id:id,nom:s.nom,addr:s.addr,type:s.type,code:s.contrat,busy:false}});};
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
  var G=this.geoData(),names={};this.D.comptes.forEach(function(c){names[c.id]=(c.prenom+' '+c.nom).trim();});
  this._layer.clearLayers();var pts=[];
  G.sites.forEach(function(s){var m=L.circleMarker([s.lat,s.lng],{radius:7,color:'#1d2d3d',weight:2,fillColor:'#94bce3',fillOpacity:.95}).bindPopup('<b>'+s.nom.replace(/</g,'&lt;')+'</b><br>'+self.T(s.type).court+'<br>'+s.n+' punch(s) · dernier '+s.last);m.addTo(self._layer);pts.push([s.lat,s.lng]);});
  Object.keys(G.techs).forEach(function(e){var t=G.techs[e];var m=L.circleMarker([Number(t.lat),Number(t.lng)],{radius:11,color:'#000',weight:3,fillColor:'#1d2d3d',fillOpacity:1}).bindPopup('<b>'+(names[e]||e)+'</b><br>Punch à '+t.heure+'<br>'+(t.lieu||'').replace(/</g,'&lt;'));m.addTo(self._layer);pts.push([Number(t.lat),Number(t.lng)]);});
  setTimeout(function(){self._map.invalidateSize();if(!self._fitted&&pts.length){self._map.fitBounds(pts,{padding:[40,40],maxZoom:14});self._fitted=true;}},60);
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
Comp.prototype.exportPaie=function(){var wk=iso(addDays(mondayOf(new Date()),7*this.state.tOff)),data=this.weekData(wk),sel=this.paieSel(wk,data),emps=data.filter(function(e){return sel[e.id]&&e.any;});
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
Comp.prototype.markSent=function(){var self=this,wk=iso(addDays(mondayOf(new Date()),7*this.state.tOff)),data=this.weekData(wk),sel=this.paieSel(wk,data),emps=data.filter(function(e){return sel[e.id]&&e.any;}),now=new Date().toISOString();
  if(!emps.length){this.flash('Sélectionnez au moins un employé');return;}
  rest('POST','feuilles_temps_envois',emps.map(function(e){return{id:e.id+'_'+wk,uid:e.id,emp:e.nom,semaine:wk,email:e.email,methode:'sa-admin',punchs:e.nbPunchs,heures:dec(e.total),par:self.user.id,le:now,updated_at:now};}),'resolution=merge-duplicates,return=minimal')
    .then(function(){self.flash(emps.length+' feuille(s) marquée(s) envoyée(s) à la paie');return self.loadWeekFT(wk,true);}).catch(function(e){self.flash('Échec : '+netMsg(e));});};
Comp.prototype.printPaie=function(){var wk=iso(addDays(mondayOf(new Date()),7*this.state.tOff)),data=this.weekData(wk),sel=this.paieSel(wk,data),emps=data.filter(function(e){return sel[e.id]&&e.any;}),mon=new Date(wk+'T12:00:00');
  if(!emps.length){this.flash('Sélectionnez au moins un employé');return;}
  var E=function(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});};
  var h='<!doctype html><meta charset="utf-8"><title>Feuilles de temps '+wk+'</title><style>body{font:12px Arial,sans-serif;margin:18px}h2{margin:0 0 4px;font-size:17px}table{border-collapse:collapse;width:100%;margin:6px 0 4px}td,th{border:1px solid #bbb;padding:3px 6px;text-align:left}th{background:#e8f2fb}.n{text-align:right}section{page-break-after:always}.s{margin-top:26px;display:flex;gap:40px}.s div{border-top:1px solid #555;flex:1;padding-top:3px;font-size:10px}</style>';
  emps.forEach(function(e){h+='<section><h2>'+E(e.nom)+'</h2><div>Semaine du '+fdate(wk)+' au '+fdate(iso(addDays(mon,6)))+' · Total '+decTxt(e.total)+' h (régulières '+decTxt(e.reg)+' · supplémentaires '+decTxt(e.supp)+')</div><table><tr><th>Jour</th><th>Lieu</th><th>ODT</th><th>Début</th><th>Fin</th><th class="n">Heures</th></tr>';
    for(var i=0;i<7;i++)grouperJour(e.punchs.filter(function(p){return p.di===i;})).forEach(function(l){h+='<tr><td>'+DLF[i]+' '+addDays(mon,i).getDate()+'</td><td>'+E(l.lieu)+'</td><td>'+E(l.odt)+'</td><td>'+E(l.debut)+'</td><td>'+(l.act?'en cours':E(l.fin))+'</td><td class="n">'+decTxt(l.h)+'</td></tr>';});
    h+='</table><div class="s"><div>Signature de l’employé</div><div>Signature du superviseur</div></div></section>';});
  var w=window.open('','_blank');if(!w){this.flash('Fenêtre bloquée — autorisez les fenêtres pour imprimer');return;}w.document.write(h+'<script>setTimeout(function(){print();},300)<\/script>');w.document.close();};
Comp.prototype.teamReport=function(wk){var data=this.weekData(wk).filter(function(e){return e.any;});if(!data.length)return null;var L=['DONNÉES BRUTES — FEUILLES DE TEMPS SOUCY AQUATIK','Semaine du '+fdate(wk)+' | '+data.length+' employé(s) actif(s)','','── PUNCHS (une ligne par tâche) ──','Employé | Jour | Début | Fin | Durée | Lieu | ODT | Détail'];
  data.forEach(function(e){e.punchs.forEach(function(p){L.push([e.nom,DLF[p.di],p.start,p.act?'(en cours)':p.end,fmtH(p.hrs),p.lieu,p.odt,p.detail].join(' | '));});});
  L.push('','── TOTAUX PAR EMPLOYÉ ──');var tt=0,tr=0,ts=0;data.forEach(function(e){tt+=e.total;tr+=e.reg;ts+=e.supp;L.push(e.nom+' | Total: '+fmtH(e.total)+' | Régulier: '+fmtH(e.reg)+' | Supp: '+fmtH(e.supp)+' | Punchs: '+e.nbPunchs);});
  L.push('','── TOTAL ÉQUIPE ──','Total: '+fmtH(tt)+' | Régulier: '+fmtH(tr)+' | Supplémentaire: '+fmtH(ts));return L.join('\n');};

/* Valeurs d'écran : Temps (Semaine · À valider · Paie · Cumul) et Stats */
Comp.prototype.tempsVals=function(punchRows){var self=this,st=this.state,D=this.D,mod=st.mod,tMon=addDays(mondayOf(new Date()),7*st.tOff),wk=iso(tMon),today=iso(new Date());
  if((mod==='temps'||mod==='stats'||st.hj)&&this.ftw[wk]===undefined)this.loadWeekFT(wk);
  var loaded=Array.isArray(this.ftw[wk]),data=loaded?this.weekData(wk):[],tt=st.tempsTab;
  var days=[];for(var i=0;i<7;i++){var d=addDays(tMon,i);days.push({label:DJ[i]+' '+d.getDate(),bg:iso(d)===today?'var(--color-accent-100)':'transparent'});}
  var rows=data.map(function(e){return{nom:e.nom,total:e.any?fmtH(e.total):'—',reg:e.any?fmtH(e.reg):'—',supp:e.supp>0?'+'+fmtH(e.supp):'—',suppFg:e.supp>0?'var(--color-accent-900)':'var(--color-text)',
    etat:e.enCours?'● en cours':(e.approuvee?'Approuvée':(e.nbAV?e.nbAV+' à valider':'')),canApprove:e.any&&!e.approuvee&&!e.enCours,approve:function(){self.approve(e.id,wk,null);},
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
      open:open,chev:open?'down':'right',expand:function(){var o=Object.assign({},op);o[e.id]=!open;self.setState({paieOpen:o});},detail:detail};});
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
  var TT=[['semaine','Semaine',''],['valider','À valider',punchRows.length||''],['paie','Paie',''],['cumul','Cumul','']];
  return Object.assign(hjV,{tempsTabs:TT.map(function(x){var on=tt===x[0];return{label:x[1],n:x[2],bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)',go:function(){self.setState({tempsTab:x[0]});}};}),
    isTempsTab:tt==='semaine',isSuiviTab:tt==='valider',isPaieTab:tt==='paie',isCumulTab:tt==='cumul',tWeekLoading:!loaded&&this.ftw[wk]!=='err',tWeekErr:this.ftw[wk]==='err'?'Feuilles de temps illisibles : '+(this.ftwErr||''):'',
    tLabel:wkLabel(tMon),tPrev:function(){self.setState({tOff:st.tOff-1});},tNext:function(){self.setState({tOff:Math.min(0,st.tOff+1)});},tToday:function(){self.setState({tOff:0});},
    tDays:days,tRows:rows,tTeam:fmtH(teamT),tTeamSupp:teamS>0?'dont +'+fmtH(teamS)+' supplémentaires':'',noTRows:loaded&&!rows.length,
    paie:paie,paieNone:loaded&&!paie.length,paieCount:nSel+' sélectionné(s) sur '+paie.length,paieAll:function(){var s={};data.forEach(function(e){s[e.id]=e.any;});var o={};o[wk]=s;self.setState({paieSel:Object.assign({},st.paieSel,o)});},
    paieNoneSel:function(){var o={};o[wk]={};self.setState({paieSel:Object.assign({},st.paieSel,o)});},paieXlsx:function(){self.exportPaie();},paiePrint:function(){self.printPaie();},paieSent:function(){self.markSent();},
    paieModes:[['synthese','Feuille (regroupée)'],['journal','Journal des punchs']].map(function(x){return Object.assign({label:x[1],go:function(){self.setState({paieMode:x[0]});}},segS(mode===x[0]));})});};

Comp.prototype.statsVals=function(){var self=this,st=this.state,D=this.D,sMon=addDays(mondayOf(new Date()),7*st.sOff),wk=iso(sMon);
  if(st.mod==='stats'&&this.ftw[wk]===undefined)this.loadWeekFT(wk);
  var loaded=Array.isArray(this.ftw[wk]),data=loaded?this.weekData(wk):[],max=Math.max(40,data.reduce(function(m,e){return Math.max(m,e.total);},0));
  var tot=data.reduce(function(s,e){return s+e.total;},0),supp=data.reduce(function(s,e){return s+e.supp;},0);
  var woOuv=D.wo.filter(function(w){return w.status!=='termine';}).length,woUrg=D.wo.filter(function(w){return w.priorite==='urgent'&&w.status!=='termine';}).length;
  var bas=(D.inv||[]).filter(function(i){return Number(i.seuil)>0&&Number(i.qte)<=Number(i.seuil);});
  var av=data.reduce(function(s,e){return s+e.nbAV;},0);
  var WS=[['ouvert','Ouverts'],['en_cours','En cours'],['termine','Terminés']];
  var copy=function(){var t=self.teamReport(wk);if(!t){self.flash('Aucune heure cette semaine');return;}(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){self.flash('Rapport copié');}).catch(function(){self.flash('Copie impossible — utilisez Télécharger');});};
  return{isStats:st.mod==='stats',sLabel:wkLabel(sMon),sPrev:function(){self.setState({sOff:st.sOff-1});},sNext:function(){self.setState({sOff:Math.min(0,st.sOff+1)});},sToday:function(){self.setState({sOff:0});},sLoading:!loaded,
    sKpis:[{l:'Heures de l’équipe',v:fmtH(tot),s:supp>0?'dont '+fmtH(supp)+' supplémentaires':'aucune heure supplémentaire'},{l:'Punchs à valider',v:String(av),s:'cette semaine'},
      {l:'Bons de travail ouverts',v:String(woOuv),s:woUrg?woUrg+' urgent(s)':'aucun urgent'},{l:'Stock sous le seuil',v:String(bas.length),s:bas.slice(0,3).map(function(i){return i.nom;}).join(', ')||'—'}],
    sBars:data.filter(function(e){return e.any||e.total>0;}).sort(function(a,b){return b.total-a.total;}).map(function(e){return{nom:e.nom,h:fmtH(e.total),w:Math.round(e.total/max*100),bg:e.total>40?'var(--color-accent-900)':'var(--color-accent-700)',
      sub:e.supp>0?'+'+fmtH(e.supp)+' supp.':'',open:function(){self.setState({mod:'temps',tempsTab:'semaine',tOff:st.sOff});}};}),sNoBars:loaded&&!data.some(function(e){return e.any;}),
    sWo:WS.map(function(x){return{l:x[1],n:D.wo.filter(function(w){return w.status===x[0];}).length};}),
    sCopy:copy,sDownload:function(){var t=self.teamReport(wk);if(!t){self.flash('Aucune heure cette semaine');return;}saveBlob(new Blob([t],{type:'text/plain;charset=utf-8'}),'SoucyAquatik_Equipe_Semaine_'+wk+'.txt');},
    sXlsx:function(){self.setState({mod:'temps',tempsTab:'paie',tOff:st.sOff});self.flash('Choisissez les employés puis « Télécharger Excel »');}};};

Comp.prototype.vals=function(){
  var self=this,st=this.state,D=this.D,mod=st.mod;
  var base={rootRef:this.rootRef,hasToast:!!st.toast,toast:st.toast,q:st.q,onQ:function(e){self.setState({q:e.target.value});},meNom:(this.user.prenom+' '+this.user.nom).trim(),meIni:((this.user.prenom||'?')[0]+(this.user.nom||'?')[0]).toUpperCase(),meRole:this.user.role==='admin'?'Administration':'Supervision',
    logout:function(){localStorage.removeItem('sa_admin_user');location.reload();}};
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
  var is=D.byId[st.inspSite]||D.sites[0]||{id:'',nom:'—',type:'GEN',ville:'',contrat:''},IT=this.T(is.type),fields=IT.fields||[];
  var f=fields.filter(function(x){return x.key===st.inspKey;})[0]||fields[0]||{key:'',label:'—',unit:'',min:0,max:1,lo:0,hi:1,step:0.1};
  var hist=D.rel.filter(function(r){return r.site_id===is.id&&r.vals&&r.vals[f.key]!=null;}).slice(-30),n=hist.length;
  var yp=function(v){return(1-(v-f.min)/(f.max-f.min))*100;},outV=function(v){return v<f.lo||v>f.hi;};
  var vs=hist.map(function(h){return h.vals[f.key];}),avg=n?vs.reduce(function(a,b){return a+b;},0)/n:0,nOutH=vs.filter(outV).length,xpos=function(i){return n>1?i/(n-1)*100:50;};
  var chart={path:n>1?hist.map(function(h,i){return(i?'L':'M')+(xpos(i)*10).toFixed(1)+' '+(yp(h.vals[f.key])*2.6).toFixed(1);}).join(' '):'',
    dots:hist.map(function(h,i){var v=h.vals[f.key];return{x:xpos(i),y:yp(v),s:outV(v)?12:8,bg:outV(v)?'var(--color-text)':'var(--color-bg)',tip:fdate(h.date)+' · '+fr(v,f.step)+' '+f.unit};}),
    xl:hist.map(function(h,i){return{x:xpos(i),d:fdate(h.date)};}).filter(function(_,i){return i%5===0||i===n-1;}),
    hiTop:yp(f.hi),loTop:yp(f.lo),bandH:yp(f.lo)-yp(f.hi),minTxt:fr(f.min,f.step),maxTxt:fr(f.max,f.step),loTxt:fr(f.lo,f.step),hiTxt:fr(f.hi,f.step),
    stats:[{l:'Dernier relevé',v:n?fr(vs[n-1],f.step)+' '+f.unit:'—'},{l:'Moyenne 30 j',v:n?fr(avg,f.step):'—'},{l:'Min / max',v:n?fr(Math.min.apply(null,vs),f.step)+' / '+fr(Math.max.apply(null,vs),f.step):'—'},{l:'Dans la zone',v:n?Math.round((n-nOutH)/n*100)+' %':'—'},{l:'Jours hors zone',v:String(nOutH)}]};
  var siteRel=D.rel.filter(function(r){return r.site_id===is.id;}).slice(-10).reverse();
  var inspTable={cols:fields.map(function(x){return x.label+(x.unit?' ('+x.unit+')':'');}),rows:siteRel.map(function(r){return{d:fdate(r.date)+' '+(r.heure||''),cells:fields.map(function(x){var v=r.vals&&r.vals[x.key],has=v!=null&&r.touched&&r.touched[x.key],o=has&&(v<x.lo||v>x.hi);return{v:has?fr(v,x.step):'—',bg:o?'var(--color-accent-900)':'transparent',fg:o?'#ffffff':'var(--color-text)'};})};})};
  var lastR=lastRel[is.id];
  // ---- opérations (WO groupés par dossier)
  var names={};D.comptes.forEach(function(c){names[c.id]=(c.prenom+' '+c.nom).trim();});
  var groups={};D.wo.forEach(function(w){var k=w.groupe_id||(norm(w.client)+'|'+norm(w.site)+'|'+norm(w.type));(groups[k]=groups[k]||[]).push(w);});
  var OST={'Urgent':['var(--color-accent-900)','#ffffff','var(--color-accent-900)'],'En cours':['var(--color-accent-700)','#ffffff','var(--color-accent-700)'],'Fermé':['transparent','var(--color-neutral-700)','var(--color-divider)']};
  var VST={'fait':['var(--color-accent-700)','#ffffff'],'en cours':['var(--color-text)','var(--color-bg)'],'planifié':['transparent','var(--color-text)'],'à assigner':['var(--color-accent-100)','var(--color-accent-900)']};
  var all=Object.keys(groups).map(function(k){var g=groups[k],faits=g.filter(function(w){return w.status==='termine';}).length,urg=g.some(function(w){return w.priorite==='urgent';})&&faits<g.length;
    var stt=faits===g.length?'Fermé':(urg?'Urgent':'En cours'),f0=g[0],as={};g.forEach(function(w){String(w.assigne||'').split(/,\s*/).filter(Boolean).forEach(function(a){as[a]=1;});});
    var s=null;D.sites.forEach(function(x){if(!s&&(norm(x.nom)===norm(f0.client)))s=x;});var c=OST[stt];
    return{id:String(f0.id).slice(-6).toUpperCase(),client:f0.client,objet:(f0.type?f0.type.charAt(0).toUpperCase()+f0.type.slice(1):'Visite')+(f0.site?' · '+f0.site:''),contrat:s&&s.contrat||'—',nVisites:g.length,
      resp:Object.keys(as).map(function(a){return names[a]||a;}).join(', ')||'À assigner',faits:faits,total:g.length,pct:faits/g.length*100,statut:stt,stBg:c[0],stFg:c[1],stBd:c[2],_next:g.filter(function(w){return w.status!=='termine';})[0],_g:g,_s:s};});
  var opsF=['Tous','Urgent','En cours','Fermé'];
  var opsFilters=opsF.map(function(o){var n=o==='Tous'?all.length:all.filter(function(d){return d.statut===o;}).length;return Object.assign({label:o,n:n,go:function(){self.setState({opsFilter:o});}},segS(st.opsFilter===o));});
  var dossiers=all.filter(function(d){return st.opsFilter==='Tous'||d.statut===st.opsFilter;}).sort(function(a,b){var r=function(x){return x.statut==='Urgent'?0:x.statut==='En cours'?1:2;};return r(a)-r(b)||String((a._next||{}).date||'9').localeCompare(String((b._next||{}).date||'9'));}).map(function(d){var open=!!st.opsOpen[d.id];
    return Object.assign({},d,{open:open,chev:open?'down':'right',rowBg:open?'var(--color-accent-100)':'transparent',toggle:function(){self.setState(function(s2){var o=Object.assign({},s2.opsOpen);o[d.id]=!o[d.id];return{opsOpen:o};});},
      visites:d._g.map(function(w){var open=function(){self.openEdit({kind:'wo',id:w.id});};var sv=w.status==='termine'?'fait':w.status==='en_cours'?'en cours':(w.assigne?'planifié':'à assigner'),c=VST[sv];return{open:open,date:fdate(w.date),tache:String(w.descr||'').split('\n')[0].slice(0,80)||'Visite',tech:String(w.assigne||'').split(/,\s*/).filter(Boolean).map(function(a){return names[a]||a;}).join(', ')||'—',statut:sv,bg:c[0],fg:c[1]};}),
      sites:d._s?[{nom:d._s.nom,go:function(){self.go('inspections',{inspSite:d._s.id,inspKey:null});}}]:[],
      addVisit:function(){var e=String(d._g[0].assigne||'').split(/,\s*/)[0]||'';self.openDlg({type:'Bon de travail',site:d._s?d._s.id:'',tech:e});},goFact:function(){self.setState({mod:'facturation',factFilter:'Tous'});}});});
  // ---- sites
  var nouveaux=D.sites.filter(function(s){return/automatiquement/i.test(s.notes);}).map(function(s){var dup=null;D.sites.forEach(function(x){if(!dup&&x.id!==s.id&&!/automatiquement/i.test(x.notes)&&norm(x.nom).length>3&&(norm(s.nom).indexOf(norm(x.nom))>=0||norm(x.nom).indexOf(norm(s.nom))>=0))dup=x;});
    return{nom:s.nom,source:'Détecté depuis un punch',gps:'—',icon:'pin',isNew:!dup,isDup:!!dup,pending:true,done:false,doneTxt:'',dupNom:dup?dup.nom:'',dupGps:'—',op:1,suggestion:dup?'Probable doublon de « '+dup.nom+' »':'Nouveau site à confirmer',
      primaryLabel:dup?'Fusionner dans « '+dup.nom+' »':'Valider ce site',primary:function(){self.siteAction(s.id,dup?'merge':'validate',dup?dup.id:null);},altLabel:'Garder séparé',alt:function(){self.siteAction(s.id,'validate',null);},ignore:function(){self.flash('Aucune modification effectuée');}};});
  var stype=st.siteType;
  var siteTypeOptions=[{v:'all',l:'Tous les types de bassin'}].concat(typesArr.map(function(k){return{v:k,l:D.types[k].label};})).map(function(o){return Object.assign({},o,{sel:o.v===stype});});
  var siteRows=D.sites.filter(function(s){return stype==='all'||s.type===stype;}).map(function(s){return{nom:s.nom,client:'—',ville:s.ville||'—',court:self.T(s.type).court,freq:'—',tech:'—',gps:'Non défini',bassin:'—',contrat:s.contrat||'—',go:function(){self.openSiteEdit(s.id);}};});

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
    PL.wo.forEach(function(w){var as=String(w.assigne||'').split(/,\s*/).filter(Boolean);if(!as.length)as=[''];as.forEach(function(e){addSlot(e,idx(w.date),mk('',w.client,String(w.descr||'').split('\n')[0].slice(0,40)||'Visite',w.groupe_id,w.status==='termine',0,'wo',w.id));});});
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
  var G=[['Terrain',[['monitoring','Monitoring','activity',horsZone.length+urgDem.length,true],['carte','Carte des sites','map'],['inspections','Inspections','chart']]],['Gestion',[['operations','Opérations','folder'],['planning','Planning équipe','calendar'],['sites','Sites','building',nouveaux.length],['facturation','Facturation','receipt']]],['Équipe',[['sondages','Sondages clients','star'],['communication','Communication','megaphone'],['temps','Temps · Paie','timer'],['stats','Stats','chart']]]];
  var LIVE=['stats','monitoring','inspections','operations','sites','temps','planning','sondages','carte','facturation'];
  var navGroups=G.map(function(g){return{label:g[0],items:g[1].map(function(i){return{label:i[1],icon:i[2],badge:i[3]||null,badgeBg:i[4]?'var(--color-text)':'transparent',badgeFg:i[4]?'var(--color-bg)':'var(--color-text)',go:function(){self.go(i[0]);},bar:mod===i[0]?'var(--color-text)':'transparent',bg:mod===i[0]?'var(--color-accent-100)':'transparent',fw:mod===i[0]?600:400};})};});
  var TITLES={monitoring:['Monitoring en direct','Qui est où, activité terrain et relevés hors zone'],inspections:['Inspections et rapports','Relevés techniques saisis en tournée, par site et dans le temps'],operations:['Opérations','Dossiers clients — les visites d’un même contrat restent regroupées'],sites:['Sites','Répertoire et sites détectés automatiquement'],
    carte:['Carte des sites','Sites et techniciens, d’après les punchs GPS'],sondages:['Sondages clients','Résultats de satisfaction — lecture seule'],planning:['Planning équipe','Qui fait quoi cette semaine — lecture seule'],temps:['Temps · Paie','Feuilles de temps de l’équipe — corriger, ajouter, approuver, sortir la paie'],stats:['Stats','Heures de l’équipe, bons de travail, stock — par semaine'],facturation:['Facturation','Depuis ton fichier Excel — ODT, prix, écarts. PO manquant sur '+poManquant+' dossier(s).'],communication:['Communication d’équipe','Bientôt']};
  var soonName={communication:'Communication d’équipe'};
  var qq=st.q.trim().toLowerCase();
  var results=qq.length<2?[]:D.sites.filter(function(s){return(s.nom+s.ville+s.contrat).toLowerCase().indexOf(qq)>=0;}).slice(0,5).map(function(s){return{label:s.nom,sub:s.ville+' · '+self.T(s.type).court,go:function(){self.go('inspections',{inspSite:s.id,inspKey:null});}};})
    .concat(all.filter(function(d){return(d.client+d.objet+d.id).toLowerCase().indexOf(qq)>=0;}).slice(0,3).map(function(d){return{label:d.id+' · '+d.client,sub:d.objet,go:function(){var o={};o[d.id]=true;self.go('operations',{opsOpen:o,opsFilter:'Tous'});}};}));
  return Object.assign(base,dlgV,edV,sdV,svV,carteV,fxV,{isFacturation:mod==='facturation',factKpis:factKpis,factFilters:factFilters,factRows:factRows,factCount:factCount,factTotCalc:factTotCalc,factTotFact:factTotFact,factTotEcart:factTotEcart,exportXls:exportXls,isSondages:mod==='sondages',isCarte:mod==='carte',carteInfo:carteInfo,navGroups:navGroups,modTitle:TITLES[mod][0],modSub:TITLES[mod][1],results:results,hasResults:results.length>0,
    hasWarn:!!(this.err||(this.softErr&&this.softErr.length)),retry:function(){self.flash('Rechargement…');self.reloadAll();},
    warnTxt:this.err?(this.err+' — données affichées : dernière lecture réussie à '+pad(this.loadedAt.getHours())+':'+pad(this.loadedAt.getMinutes())+'.'):('Données incomplètes — lecture impossible : '+(this.softErr||[]).join(', ')+'. Les écrans qui en dépendent peuvent paraître vides à tort.'),
    liveTxt:(this.err?'Hors ligne · ':'En direct · ')+JS[now.getDay()]+' '+now.getDate()+' '+MOIS[now.getMonth()].slice(0,4)+'. · '+pad(now.getHours())+':'+pad(now.getMinutes()),isLoading:false,loadErr:this.err,
    isTemps:mod==='temps',isTempsTab:tt==='temps',isSuiviTab:tt==='suivi',isCumulTab:tt==='cumul',tempsTabs:tempsTabs,weekDays:mod==='planning'?pDays:tDays,tempsRows:tempsRows,punchRows:punchRows,tLabel:wkLabel(tMon),tPrev:function(){self.setState({tOff:Math.max(-7,st.tOff-1)});},tNext:function(){self.setState({tOff:Math.min(0,st.tOff+1)});},
    isPlanning:mod==='planning',planRows:planRows,pLabel:wkLabel(pMon),pPrev:function(){self.setState({pOff:st.pOff-1});},pNext:function(){self.setState({pOff:st.pOff+1});},openDlg:function(){self.openDlg({});},pLoading:!PL,
    isMonitoring:mod==='monitoring',isInspections:mod==='inspections',isOperations:mod==='operations',isSites:mod==='sites',isSoon:LIVE.indexOf(mod)<0,soonTitle:soonName[mod]||'',
    kpis:kpis,techRows:techRows,flux:flux,salles:[],sallesSummary:'Aucune salle mécanique suivie pour l’instant — les fiches de salle arrivent avec la prochaine version de sa-terrain.',horsZone:horsZone,horsZoneCount:horsZone.length,
    typeOptions:typeOptions,inspFilter:fil,onInspFilter:function(e){self.setState({inspFilter:e.target.value});},inspSites:inspSites,
    insp:{nom:is.nom,client:is.ville||'—',bassin:'—',contrat:is.contrat||'—',typeLabel:IT.label+(is.type==='GEN'?' · valeurs par défaut':''),norme:IT.norme||'',tech:lastR?(lastR.tech_nom||lastR.tech):'—'},
    inspParams:fields.map(function(x){return Object.assign({label:x.label,go:function(){self.setState({inspKey:x.key});}},segS(x.key===f.key));}),chart:chart,inspTable:inspTable,noHist:n===0,histMsg:n===0?'Aucun relevé enregistré pour ce site et ce paramètre. Les relevés apparaissent ici dès que les techniciens valident une fiche dans sa-terrain.':'',
    exportMsg:function(){self.flash('Export PDF : bientôt');},
    opsFilters:opsFilters,dossiers:dossiers,newDossier:function(){self.openDlg({type:'Bon de travail'});},noDossier:dossiers.length===0,
    nouveaux:nouveaux,siteTypeOptions:siteTypeOptions,siteType:stype,onSiteType:function(e){self.setState({siteType:e.target.value});},siteRows:siteRows,siteCount:siteRows.length,noNouveaux:nouveaux.length===0},
    this.tempsVals(punchRows),this.statsVals());
};
Comp.prototype.update=function(){if(!this._host)return;SARender(document.getElementById('tpl'),this._host,this.vals());this.syncMap();var el=this.rootRef.current;if(el)el.style.setProperty('--sa-row','10px');};
Comp.prototype.mount=function(host){var self=this;this._host=host;this.update();
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
