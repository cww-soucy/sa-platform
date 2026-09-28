(function(){
'use strict';
var SB='https://ldqvdiaewvhnukuaxdmc.supabase.co',KEY='sb_publishable_qVd_6eoAvwrDGs9u81woAg_RrMpTJxn';
var H={apikey:KEY,Authorization:'Bearer '+KEY};
function get(p){return fetch(SB+'/rest/v1/'+p,{headers:H}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();});}
function post(p,b,pref){return fetch(SB+'/rest/v1/'+p,{method:'POST',headers:Object.assign({'Content-Type':'application/json',Prefer:pref||'return=minimal'},H),body:JSON.stringify(b)});}
function netMsg(e){var m=String(e&&e.message||e);return /Failed to fetch|NetworkError|Load failed/i.test(m)?'réseau injoignable':m;}
/* Un identifiant figure-t-il EXACTEMENT dans une liste « a, b, c » ? (le filtre serveur ilike.*id* accepte aussi les sous-chaînes) */
function hasId(list,id){return String(list||'').split(/,\s*/).indexOf(String(id))>=0;}
function jget(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function jset(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
var MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
var JOURS=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
function pad(n){return n<10?'0'+n:''+n;}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
function mondayOf(d){var x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;}
function hhmm(d){return pad(d.getHours())+':'+pad(d.getMinutes());}
function dnum(d){return d.getDate()===1?'1er':String(d.getDate());}
function fr(n){return String(n).replace('.',',');}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function minsFrom(s,e){if(!s||!e)return 0;var sp=s.split(':'),ep=e.split(':'),sm=parseInt(sp[0],10)*60+parseInt(sp[1],10),em=parseInt(ep[0],10)*60+parseInt(ep[1],10);if(em<sm)em+=1440;return Math.max(0,em-sm);}
function hrsFrom(s,e){return minsFrom(s,e)/60;}
function fmtH(h){if(!h||h<=0)return '0 h 00';var m=Math.round(h*60);return Math.floor(m/60)+' h '+pad(m%60);}
function fmtMin(m){return m>=60?Math.floor(m/60)+' h '+pad(m%60):m+' min';}
function clone(x){return JSON.parse(JSON.stringify(x));}
function emptyDay(){return{status:'idle',tasks:[],saved:false,kmArr:'',stopFiles:[],del:[]};}
function isBureau(l){var n=String(l||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();return /\b(entrepot|bureau|shop|garage)\b/.test(n);}
var LSK_OPS='sa_terrain_ftops',LSK_FT='sa_terrain_ft_';
/* Applique UNE opération de punch à la liste des 7 jours — même format que SA Platform. Idempotent. */
function applyOp(days,op){
  days=clone(days||[]);while(days.length<7)days.push(emptyDay());
  var d=days[op.dayIdx];d.tasks=d.tasks||[];
  if(op.type==='start'){
    if(d.tasks.some(function(t){return t.opId===op.id;}))return days;
    d.tasks.forEach(function(t){if(t.active){t.end=op.hhmm;t.hrs=hrsFrom(t.start,op.hhmm);t.active=false;}});
    var mx=0;days.forEach(function(dd){(dd.tasks||[]).forEach(function(t){if(typeof t.id==='number'&&t.id>mx)mx=t.id;});});
    var t={id:mx+1,lieu:op.lieu,odt:op.odt||'',detail:op.detail||'',addr:op.addr||'',siteId:op.siteId||null,start:op.hhmm,startTs:op.ts,end:'',hrs:0,active:true,kmDep:op.kmDep||'',kmArr:'',files:[],gps:null,
      pendingValidation:!!op.pendingReason,pendingReason:op.pendingReason||null,sourceType:op.srcType||null,sourceId:op.srcId||null,sourceLabel:op.srcLabel||null,opId:op.id,k:op.id};
    t.k0=t.start+'|'+t.lieu;d.tasks.push(t);d.status='running';
  }else if(op.type==='stop'){
    var any=false;d.tasks.forEach(function(t){if(t.active){t.end=op.hhmm;t.hrs=hrsFrom(t.start,op.hhmm);t.kmArr=op.kmArr||'';t.active=false;any=true;}});
    if(any){d.kmArr=op.kmArr||d.kmArr||'';d.status='done';}
  }else if(op.type==='autoclose'){
    var c=false;d.tasks.forEach(function(t){if(t.active){t.end='20:00';t.hrs=hrsFrom(t.start,'20:00');t.active=false;t.autoClosed=true;c=true;}});
    if(c)d.status='done';
  }else if(op.type==='gps'){
    d.tasks.forEach(function(t){if(t.opId===op.opId&&!t.gps)t.gps=op.gps;});
  }
  return days;
}
function cap(s){s=String(s||'');return s.charAt(0).toUpperCase()+s.slice(1);}

/* ---------- Données de référence (types, sites, contrats) : cache local pour le hors-ligne ---------- */
var REF={types:{},sites:{},list:[]};
function villeOf(addr){var p=String(addr||'').split(',').map(function(x){return x.trim();}).filter(function(x){return x&&!/^(qc|québec|quebec|canada)$/i.test(x)&&!/[a-z]\d[a-z]\s?\d[a-z]\d/i.test(x);});return p.length>1?p[p.length-1].replace(/^Ville de\s+/i,''):'';}
function buildRef(raw){
  REF.types={};(raw.types||[]).forEach(function(t){REF.types[t.code]={label:t.label,court:t.court||t.label,norme:t.norme||'',fields:t.fields||[],checks:t.checks||[],produits:t.produits||[],photo:t.photo||'Vue d’ensemble du bassin'};});
  var ct={};(raw.contrats||[]).forEach(function(c){ct[c.site_id]=c;});
  REF.sites={};REF.list=[];
  (raw.sites||[]).forEach(function(s){var c=ct[s.id];var code=(c&&c.type_code&&REF.types[c.type_code])?c.type_code:'GEN';
    var o={id:String(s.id),nom:s.nom||'(sans nom)',ville:villeOf(s.addr),addr:s.addr||'',type:code,bassin:'',contrat:(c&&c.code)||'',client:''};REF.sites[o.id]=o;if(!/^Fusionné →/.test(s.notes||''))REF.list.push(o);});
}
function siteById(id){return REF.sites[String(id)]||null;}
function pseudoSite(nom,addr){var id='x:'+norm(nom||addr||'inconnu').replace(/ /g,'-');
  if(!REF.sites[id])REF.sites[id]={id:id,nom:nom||addr||'Site non répertorié',ville:villeOf(addr),addr:addr||'',type:'GEN',bassin:'',contrat:'',client:''};return REF.sites[id];}
function matchSite(a,b){var keys=[a,b].filter(Boolean).map(norm).filter(Boolean);if(!keys.length)return null;
  for(var i=0;i<REF.list.length;i++){var n=norm(REF.list[i].nom);if(keys.indexOf(n)>=0)return REF.list[i];}
  for(var j=0;j<REF.list.length;j++){var m=norm(REF.list[j].nom);if(m.length>4&&keys.some(function(k){return k.indexOf(m)>=0||m.indexOf(k)>=0&&k.length>4;}))return REF.list[j];}
  return null;}
var TYPE_FALLBACK=null;
function TY(code){return REF.types[code]||REF.types.GEN||{label:'Bassin',court:'Bassin',norme:'',fields:[],checks:[],produits:[],photo:'Vue d’ensemble'};}

/* ---------- Composant ---------- */
function Comp(user){
  var self=this;this.user=user;this.today=iso(new Date());
  this.rootRef={current:null};this.contentRef={current:null};this.sigRef={current:null};
  this.jobs=[];this.days=[];this.punch=null;this.last={};this.hours=null;this.bureau='';this.me={nom:(user.prenom+' '+user.nom).trim(),role:cap(user.dept||'Technicien'),dept:user.dept||'—',tel:user.tel||'—'};
  this.online=navigator.onLine;this.syncAt=null;this.loadErr={};this.sendErr='';this.queueN=(jget('sa_terrain_queue',[])).length;
  var prefs=jget('sa_terrain_prefs',{});this.prefs={sun:!!prefs.sun,big:!!prefs.big};
  var saved=jget('sa_terrain_state_'+user.id+'_'+this.today,{});
  this.dem=[];this.ft=jget(LSK_FT+user.id+'_'+iso(mondayOf(new Date())),null);this.state=Object.assign({pf:{q:'',lieu:'',siteId:null,odt:'',detail:'',km:'',src:null},sf:{km:''},demande:null,demChip:null,demandeTxt:'',screen:'today',openJob:null,vals:{},touched:{},checks:{},prods:{},photo:{},photoData:{},notes:{},validated:{},sync:{},planDay:0,toast:null,soon:''},saved);
  this.state.toast=null;this.state.screen='today';this.state.pf={q:'',lieu:'',siteId:null,odt:'',detail:'',km:'',src:null};this.state.sf={km:''};
}
Comp.prototype.persist=function(){var s=this.state,keep={vals:s.vals,touched:s.touched,checks:s.checks,prods:s.prods,photo:s.photo,notes:s.notes,validated:s.validated,sync:s.sync,photoData:s.photoData};
  if(!jset('sa_terrain_state_'+this.user.id+'_'+this.today,keep)){keep.photoData={};jset('sa_terrain_state_'+this.user.id+'_'+this.today,keep);}};
Comp.prototype.setState=function(p){var n=typeof p==='function'?p(this.state):p;this.state=Object.assign({},this.state,n);this.persist();this.update();};
Comp.prototype.flash=function(t){var s=this;clearTimeout(this._tt);this.state.toast=t;this.update();this._tt=setTimeout(function(){s.state.toast=null;s.update();},2600);};
Comp.prototype.go=function(s){this.setState({screen:s});var c=this.contentRef.current;if(c)c.scrollTop=0;};
Comp.prototype.applyTheme=function(){var el=this.rootRef.current;if(!el)return;
  var SUN={'--color-bg':'#ffffff','--color-surface':'#ededed','--color-text':'#000000','--color-divider':'rgba(0,0,0,.6)','--color-accent':'#1d2d3d','--color-accent-600':'#000000','--color-accent-700':'#1d2d3d','--color-accent-800':'#000000','--color-accent-200':'#94bce3','--color-accent-300':'#416180','--color-neutral-500':'#6a6a6d','--color-neutral-600':'#3a3a3c','--color-neutral-700':'#2b2b2d'};
  var on=this.prefs.sun;Object.keys(SUN).forEach(function(k){if(on)el.style.setProperty(k,SUN[k]);else el.style.removeProperty(k);});
  el.style.fontWeight=on?'500':'';var c=this.contentRef.current;if(c)c.style.zoom=this.prefs.big?'1.12':'';};
Comp.prototype.setPref=function(k){this.prefs[k]=!this.prefs[k];jset('sa_terrain_prefs',this.prefs);this.update();};
Comp.prototype.curJob=function(){var id=this.state.openJob,j=id&&this.jobs.filter(function(x){return x.id===id;})[0];if(j)return j;
  if(this.punch){var p=this.punch;j=this.jobs.filter(function(x){return x.site===String(p.siteId);})[0];if(j)return j;
    var s=siteById(p.siteId)||matchSite(p.lieu,p.addr)||pseudoSite(p.lieu,p.addr);
    return{id:'punch',site:s.id,h:p.start||'',fin:'',statut:'en cours',tache:'Punch en cours',rec:''};}
  return null;};
Comp.prototype.dec=function(step){return(String(step).split('.')[1]||'').length;};
Comp.prototype.fmt=function(v,step){return Number(v).toFixed(this.dec(step)).replace('.',',');};
Comp.prototype.setVal=function(sid,f,v){var self=this;v=Math.min(f.max,Math.max(f.min,Math.round(v/f.step)*f.step));v=+v.toFixed(this.dec(f.step));
  this.setState(function(s){var a={},b={};a[sid]=Object.assign({},s.vals[sid]||{});a[sid][f.key]=v;b[sid]=Object.assign({},s.touched[sid]||{});b[sid][f.key]=1;
    return{vals:Object.assign({},s.vals,a),touched:Object.assign({},s.touched,b)};});};
Comp.prototype.open=function(id){this.setState({openJob:id});this.go('fiche');var j=this.jobs.filter(function(x){return x.id===id;})[0];if(j)this.loadLast(j.site);};
Comp.prototype.closeFiche=function(){this.setState({openJob:null});this.go('today');};
Comp.prototype.soon=function(t){this.setState({soon:t});this.go('soon');};

/* ---------- Chargements ---------- */
Comp.prototype.loadRef=function(){var self=this;var cached=jget('sa_terrain_ref',null);if(cached)buildRef(cached);
  return Promise.all([get('types_bassin?select=*'),get('sites?select=id,nom,addr,notes'),get('contrats?select=*')]).then(function(r){var raw={types:r[0],sites:r[1],contrats:r[2]};jset('sa_terrain_ref',raw);buildRef(raw);self.syncAt=new Date();self.okLoad('ref');}).catch(function(e){self.failLoad('ref','sites et contrats'+(cached?' (copie locale utilisée)':''),e);});};
Comp.prototype.loadJobs=function(){var self=this,uid=encodeURIComponent(this.user.id),d0=this.today,d6=iso(addDays(new Date(),6));
  var q=[get('workorders?select=id,client,site,type,date,assigne,status,descr,groupe_id&date=gte.'+d0+'&date=lte.'+d6+'&assigne=ilike.*'+uid+'*'),
    get('planning_tasks?select=id,titre,emp,site_id,site_nom,date_debut,date_fin,heure_debut,heure_fin,statut,recurrence,wo_id,plan_id&date_debut=lte.'+d6+'&date_fin=gte.'+d0+'&emp=ilike.*'+uid+'*'),
    get('plan?select=id,client,addr,date,heure,emp,site_id,descr,type,status&date=gte.'+d0+'&date=lte.'+d6+'&emp=ilike.*'+uid+'*')];
  var me=this.user.id;
  return Promise.all(q).then(function(r){var wo=r[0].filter(function(w){return hasId(w.assigne,me);}),pt=r[1].filter(function(t){return hasId(t.emp,me);}),pl=r[2].filter(function(p){return hasId(p.emp,me);});var all=[];
    var woIds={},plIds={};wo.forEach(function(w){woIds[w.id]=1;});pl.forEach(function(p){plIds[p.id]=1;});
    wo.forEach(function(w){var s=matchSite(w.client,w.site)||pseudoSite(w.client,w.site);
      all.push({id:'wo:'+w.id,date:w.date,site:s.id,h:'',fin:'',statut:w.status==='termine'?'fait':'à venir',tache:(String(w.descr||'').split('\n')[0].slice(0,90))||cap(w.type||'Visite'),rec:w.groupe_id?'Visite récurrente':''});});
    pl.forEach(function(p){var s=(p.site_id&&siteById(p.site_id))||matchSite(p.client,p.addr)||pseudoSite(p.client,p.addr);
      all.push({id:'pl:'+p.id,date:p.date,site:s.id,h:p.heure||'',fin:'',statut:p.status==='termine'?'fait':'à venir',tache:(String(p.descr||'').split('\n')[0].slice(0,90))||cap(p.type||'Intervention'),rec:''});});
    pt.forEach(function(t){if((t.wo_id&&woIds[t.wo_id])||(t.plan_id&&plIds[t.plan_id]))return;
      var s=(t.site_id&&siteById(t.site_id))||matchSite(t.site_nom,'')||pseudoSite(t.site_nom||t.titre,'');
      for(var i=0;i<7;i++){var dd=iso(addDays(new Date(),i));if(dd>=t.date_debut&&dd<=t.date_fin)all.push({id:'pt:'+t.id+':'+dd,date:dd,site:s.id,h:t.heure_debut||'',fin:t.heure_fin||'',statut:t.statut==='termine'?'fait':'à venir',tache:t.titre||'Tâche',rec:t.recurrence?'Récurrent':''});}});
    self.jobs=all.filter(function(j){return j.date===self.today;}).sort(function(a,b){return(a.h||'99').localeCompare(b.h||'99');});
    self.days=[];for(var i=0;i<7;i++){var dt=addDays(new Date(),i),ds=iso(dt);
      self.days.push({dow:JOURS[dt.getDay()].slice(0,3),num:dnum(dt),title:(i===0?'Aujourd’hui · ':'')+JOURS[dt.getDay()].toLowerCase()+' '+dnum(dt)+' '+MOIS[dt.getMonth()],
        items:all.filter(function(j){return j.date===ds;}).sort(function(a,b){return(a.h||'99').localeCompare(b.h||'99');}).map(function(j){return[j.h,j.site,j.tache,j.rec];})});}
    self.syncAt=new Date();self.okLoad('jobs');}).catch(function(e){self.failLoad('jobs','tournée du jour',e);});};
Comp.prototype.weekKey=function(){return iso(mondayOf(new Date()));};
Comp.prototype.ftSet=function(row){this.ft={days:row.days,updated_at:row.updated_at,total_h:row.total_h};jset(LSK_FT+this.user.id+'_'+this.weekKey(),this.ft);};
Comp.prototype.ops=function(){return jget(LSK_OPS,[]);};
Comp.prototype.viewDays=function(){var wk=this.weekKey(),d=this.ft&&this.ft.days?this.ft.days:[];d=clone(d);while(d.length<7)d.push(emptyDay());this.ops().forEach(function(op){if(op.week===wk)d=applyOp(d,op);});return d;};
Comp.prototype.activeTask=function(days){var i=(new Date().getDay()+6)%7,ts=(days[i]&&days[i].tasks)||[];for(var k=ts.length-1;k>=0;k--)if(ts[k].active)return ts[k];return null;};
Comp.prototype.syncDerived=function(){var d=this.viewDays(),act=this.activeTask(d),h=0;d.forEach(function(x){(x.tasks||[]).forEach(function(t){h+=t.hrs||0;});});this.hours=h;this.punch=act?{start:act.start,siteId:act.siteId,lieu:act.lieu,addr:act.addr}:null;};
Comp.prototype.loadPunch=function(){return this.loadWeek();};
Comp.prototype.loadWeek=function(){var self=this,id=this.user.id+'_'+this.weekKey();
  return get('feuilles_temps?id=eq.'+encodeURIComponent(id)+'&select=days,updated_at,total_h').then(function(r){if(r[0])self.ftSet(r[0]);else if(!self.ft)self.ft={days:[],updated_at:null,total_h:0};self.okLoad('week');self.autoClose();}).catch(function(e){self.failLoad('week','feuille de temps',e);});};
/* Relit la feuille, applique l'opération sur la version LA PLUS RÉCENTE, écrit seulement si la ligne n'a pas changé entre-temps. */
Comp.prototype.writeWeek=function(week,fn,tries){var self=this,id=this.user.id+'_'+week;tries=tries||0;
  return get('feuilles_temps?id=eq.'+encodeURIComponent(id)+'&select=*').then(function(r){
    var row=r[0],days=row&&row.days?row.days:[];while(days.length<7)days.push(emptyDay());var nd=fn(days);
    var tot=0;nd.forEach(function(d){(d.tasks||[]).forEach(function(t){tot+=t.hrs||0;});});var now=new Date().toISOString();
    if(row){
      return fetch(SB+'/rest/v1/feuilles_temps?id=eq.'+encodeURIComponent(id)+'&updated_at='+(row.updated_at==null?'is.null':'eq.'+encodeURIComponent(row.updated_at)),{method:'PATCH',headers:Object.assign({'Content-Type':'application/json',Prefer:'return=representation'},H),body:JSON.stringify({days:nd,total_h:tot,saved_at:now,updated_at:now})})
        .then(function(res){if(!res.ok)throw new Error('HTTP '+res.status);return res.json();})
        .then(function(rows){if(rows.length)return{row:rows[0]};if(tries>=5)throw new Error('conflit');return self.writeWeek(week,fn,tries+1);});
    }
    var nr={id:id,uid:self.user.id,emp:self.me.nom,email:self.user.email||'',week:week,days:nd,total_h:tot,saved_at:now,updated_at:now};
    return post('feuilles_temps',nr,'return=representation').then(function(res){
      if(res.status===409){if(tries>=5)throw new Error('conflit');return self.writeWeek(week,fn,tries+1);}
      if(!res.ok)throw new Error('HTTP '+res.status);return res.json().then(function(rows){return{row:rows[0]};});});
  });};
Comp.prototype.enqueueOp=function(op){var q=this.ops();q.push(op);jset(LSK_OPS,q);this.update();this.flushOps();};
Comp.prototype.flushOps=function(){var self=this;if(this._fl||!navigator.onLine||!this.ops().length)return;this._fl=true;
  (function next(){var q=self.ops();if(!q.length){self._fl=false;self.update();return;}var op=q[0];
    self.writeWeek(op.week,function(days){return applyOp(days,op);}).then(function(res){
      if(op.type==='start')self.logGps(op,res.row);
      if(op.type==='gps')self.updGps(op);
      jset(LSK_OPS,self.ops().filter(function(x){return x.id!==op.id;}));
      if(res.row&&op.week===self.weekKey())self.ftSet(res.row);self.sendErr='';self.update();next();
    }).catch(function(e){self._fl=false;if(navigator.onLine)self.sendErr='punch non envoyé ('+netMsg(e)+')';self.update();});})();};
Comp.prototype.logGps=function(op,row){var tk=null;((row&&row.days&&row.days[op.dayIdx]&&row.days[op.dayIdx].tasks)||[]).forEach(function(t){if(t.opId===op.id)tk=t;});
  post('punch_gps_log',{id:'g'+op.id,uid:this.user.id,emp:this.me.nom,date:op.date,heure:op.hhmm,lieu:op.lieu,addr:op.addr||'',site_id:op.siteId||null,task_id:tk?tk.id:null,src:'pending',created_at:new Date(op.ts).toISOString(),updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=minimal').catch(function(){});};
Comp.prototype.updGps=function(op){post('punch_gps_log',{id:'g'+op.opId,lat:op.gps.lat,lng:op.gps.lng,acc:op.gps.acc,src:'gps',updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=minimal').catch(function(){});};
Comp.prototype.captureGps=function(op){var self=this;if(!navigator.geolocation)return;
  navigator.geolocation.getCurrentPosition(function(p){self.enqueueOp({type:'gps',id:'g-'+op.id,opId:op.id,week:op.week,dayIdx:op.dayIdx,gps:{lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy)}});},function(){},{enableHighAccuracy:true,timeout:9000,maximumAge:60000});};
/* Règle existante de SA Platform : un punch resté actif après 20 h (ou un jour passé) est fermé à 20:00. Semaine en cours seulement. */
Comp.prototype.autoClose=function(){var wk=this.weekKey(),d=this.viewDays(),now=new Date(),ti=(now.getDay()+6)%7,nm=now.getHours()*60+now.getMinutes(),n=0,self=this;
  d.forEach(function(x,i){var act=(x.tasks||[]).some(function(t){return t.active;});if(!act)return;if(i<ti||(i===ti&&nm>=1200)){self.enqueueOp({type:'autoclose',id:'ac-'+self.user.id+'-'+wk+'-'+i,week:wk,dayIdx:i});n++;}});
  if(n)this.flash('Un punch resté actif a été fermé à 20 h — repunchez si vous travaillez encore');};
Comp.prototype.openPunchForm=function(job){var pf={q:'',lieu:'',siteId:null,odt:'',detail:'',km:'',src:null};
  if(job){var s=siteById(job.site);if(s){pf.siteId=s.id;pf.lieu=s.nom;}var m=String(job.id).split(':');if(m[0]==='wo')pf.src={type:'wo',id:m[1],label:job.tache};else if(m[0]==='pl')pf.src={type:'plan',id:m[1],label:job.tache};}
  this.setState({pf:pf,screen:'punchform'});};
Comp.prototype.openStopForm=function(){this.setState({sf:{km:''},screen:'stopform'});};
Comp.prototype.submitPunch=function(){var st=this.state,pf=st.pf,s=pf.siteId?siteById(pf.siteId):null,lieu=String(pf.lieu||'').trim()||(s?s.nom:'');
  if(!lieu){this.flash('Choisissez un site ou tapez un lieu');return;}
  var km=String(pf.km||'').trim().replace(',','.');if(km&&(isNaN(parseFloat(km))||parseFloat(km)<0)){this.flash('Km départ invalide');return;}
  var now=new Date(),op={type:'start',id:'p'+now.getTime().toString(36)+Math.random().toString(36).slice(2,5),week:this.weekKey(),dayIdx:(now.getDay()+6)%7,date:iso(now),hhmm:hhmm(now),ts:now.getTime(),
    lieu:lieu,addr:s?s.addr:'',siteId:s?s.id:null,odt:String(pf.odt||'').trim(),detail:String(pf.detail||'').trim(),kmDep:km,pendingReason:isBureau(lieu)?'entrepot_bureau':null,
    srcType:pf.src?pf.src.type:null,srcId:pf.src?pf.src.id:null,srcLabel:pf.src?pf.src.label:null};
  this.setState({screen:'today'});this.enqueueOp(op);this.captureGps(op);
  if(s)this.loadLast(s.id);this.flash('Punch démarré : '+lieu+' à '+op.hhmm);};
Comp.prototype.submitStop=function(){var km=String(this.state.sf.km||'').trim().replace(',','.');if(km&&(isNaN(parseFloat(km))||parseFloat(km)<0)){this.flash('Km arrivée invalide');return;}
  var now=new Date(),op={type:'stop',id:'s'+now.getTime().toString(36)+Math.random().toString(36).slice(2,5),week:this.weekKey(),dayIdx:(now.getDay()+6)%7,hhmm:hhmm(now),kmArr:km};
  this.setState({screen:'today'});this.enqueueOp(op);this.flash('Journée terminée à '+op.hhmm);};
Comp.prototype.loadPunchOLD=function(){var self=this,wk=iso(mondayOf(new Date())),di=(new Date().getDay()+6)%7;
  return get('feuilles_temps?uid=eq.'+encodeURIComponent(this.user.id)+'&week=eq.'+wk+'&select=days,total_h').then(function(r){var row=r[0];self.hours=row?Number(row.total_h)||0:0;
    var d=row&&row.days&&row.days[di];var t=d&&d.tasks&&d.tasks.slice().reverse().filter(function(x){return x.active;})[0];
    self.punch=t?{start:t.start,siteId:t.siteId,lieu:t.lieu,addr:t.addr}:null;}).catch(function(){});};
Comp.prototype.loadLast=function(sid){var self=this;if(self.last[sid]!==undefined)return;self.last[sid]=null;
  get('releves?site_id=eq.'+encodeURIComponent(sid)+'&select=vals,date&order=date.desc,updated_at.desc&limit=1').then(function(r){self.last[sid]=r[0]||null;self.update();}).catch(function(){self.last[sid]=undefined;});};
Comp.prototype.okLoad=function(k){delete this.loadErr[k];};
Comp.prototype.failLoad=function(k,label,e){var first=!Object.keys(this.loadErr).length;this.loadErr[k]=label+' ('+netMsg(e)+')';if(first&&navigator.onLine)this.flash('Lecture impossible : '+this.loadErr[k]);};
Comp.prototype.loadDem=function(){var self=this;return get('demandes?tech=eq.'+encodeURIComponent(this.user.id)+'&select=id,type,motif,texte,statut,created_at&order=created_at.desc&limit=15').then(function(r){self.dem=r;self.okLoad('dem');self.update();}).catch(function(e){self.failLoad('dem','demandes',e);});};
Comp.prototype.loadBureau=function(){var self=this;return get('comptes_publics?id=eq.cwweil&select=tel').then(function(r){self.bureau=(r[0]&&r[0].tel)||'';}).catch(function(){});};
Comp.prototype.refresh=function(){var self=this;return Promise.all([this.loadRef(),this.loadBureau(),this.loadDem()]).then(function(){return Promise.all([self.loadJobs(),self.loadPunch()]);}).then(function(){var c=self.curJob();if(c)self.loadLast(c.site);self.flush();self.flushOps();self.update();});};

/* ---------- File d'attente : rien n'est perdu si le réseau tombe ---------- */
Comp.prototype.flush=function(){var self=this,q=jget('sa_terrain_queue',[]);if(!q.length||!navigator.onLine){self.queueN=q.length;return;}
  var item=q[0],tbl=item._t||'releves',body=Object.assign({},item);delete body._t;post(tbl,body,'resolution=merge-duplicates,return=minimal').then(function(r){
    if(r.ok){var cur=jget('sa_terrain_queue',[]).filter(function(x){return x.id!==item.id;});jset('sa_terrain_queue',cur);self.queueN=cur.length;
      self.sendErr='';if(tbl==='releves'){var s=Object.assign({},self.state.sync);s[item.site_id]='ok';self.state=Object.assign({},self.state,{sync:s});self.persist();}else if(tbl==='demandes'){self.loadDem();}self.update();if(cur.length)self.flush();}
    else{self.queueN=q.length;self.sendErr=(tbl==='demandes'?'demande':'fiche')+' refusée par le serveur (HTTP '+r.status+') — gardée sur le téléphone, prévenez le bureau';self.update();}}).catch(function(){self.queueN=q.length;self.update();});};
Comp.prototype.enqueue=function(rec){var q=jget('sa_terrain_queue',[]).filter(function(x){return x.id!==rec.id;});q.push(rec);
  if(!jset('sa_terrain_queue',q)){rec.photo=null;q[q.length-1]=rec;jset('sa_terrain_queue',q);}this.queueN=q.length;this.flush();};

/* ---------- Photo compressée (max 900 px, JPEG) ---------- */
Comp.prototype.pickPhoto=function(sid){var self=this,inp=document.getElementById('photoInput');inp.value='';inp.onchange=function(){var f=inp.files&&inp.files[0];if(!f)return;
  var img=new Image(),u=URL.createObjectURL(f);img.onload=function(){var k=Math.min(1,900/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);var data=c.toDataURL('image/jpeg',0.6);URL.revokeObjectURL(u);
    self.setState(function(s){var a={},b={};a[sid]=hhmm(new Date());b[sid]=data;return{photo:Object.assign({},s.photo,a),photoData:Object.assign({},s.photoData,b)};});};img.src=u;};inp.click();};

/* ---------- Valeurs dérivées pour le gabarit ---------- */
Comp.prototype.vals=function(){
  var self=this,st=this.state,scr=st.screen,me=this;this.syncDerived();
  var titles={temps:'Temps',punchform:'Démarrer un punch',stopform:'Terminer la journée',demandes:'Demandes',today:'La Tournée',fiche:'Fiche technique',planning:'Planning',profil:'Profil',soon:st.soon||'Bientôt'};
  var cj=this.curJob();
  var jobs=this.jobs.map(function(j){var s=siteById(j.site)||pseudoSite(j.site,''),isDone=j.statut==='fait'||!!st.validated[j.site],isCur=!!cj&&cj.id===j.id&&!isDone;
    return Object.assign({},j,{nom:s.nom,ville:s.ville,typeCourt:TY(s.type).court,isDone:isDone,isCur:isCur,canPunch:!isDone&&!isCur,nodeBg:isDone?'var(--color-accent-700)':isCur?'var(--color-text)':'var(--color-bg)',op:isDone?0.6:1,fw:isCur?600:400,punch:function(){self.open(j.id);}});});
  var next=jobs.filter(function(j){return j.canPunch;})[0];
  var cur={},fields=[],checks=[],prods=[],ph=null;
  if(cj){var s=siteById(cj.site)||pseudoSite(cj.site,''),T=TY(s.type),sid=s.id,vals=st.vals[sid]||{},tch=st.touched[sid]||{},lastRow=self.last[sid];
    fields=T.fields.map(function(f){var lv=lastRow&&lastRow.vals&&lastRow.vals[f.key],hasLast=lv!=null;var base=hasLast?lv:(f.lo+f.hi)/2;base=Math.min(f.max,Math.max(f.min,+(Math.round(base/f.step)*f.step).toFixed(self.dec(f.step))));
      var v=vals[f.key]!=null?vals[f.key]:base,touched=!!tch[f.key];
      var pc=function(x){return Math.max(0,Math.min(100,(x-f.min)/(f.max-f.min)*100));};
      var out=v<f.lo?'bas':v>f.hi?'haut':null,zone=f.lo===f.hi?self.fmt(f.lo,f.step):self.fmt(f.lo,f.step)+' – '+self.fmt(f.hi,f.step);
      return{key:f.key,label:f.label,unit:f.unit,icon:f.kind==='count'?'list':f.icon,isRange:f.kind==='range',isCount:f.kind==='count',val:self.fmt(v,f.step),
        pct:pc(v),loPct:pc(f.lo),hiPct:pc(f.hi),bandW:pc(f.hi)-pc(f.lo),minTxt:self.fmt(f.min,f.step),maxTxt:self.fmt(f.max,f.step),loTxt:self.fmt(f.lo,f.step),hiTxt:self.fmt(f.hi,f.step),zoneTxt:zone,
        pending:!touched,ok:touched&&!out,bad:touched&&!!out,out:touched&&!!out,badTxt:(out==='bas'?'Bas':'Élevé')+' · viser '+zone,valColor:touched?'var(--color-text)':'var(--color-neutral-500)',
        lastTxt:hasLast?self.fmt(lv,f.step)+(f.unit?' '+f.unit:'')+' · '+lastRow.date:'aucun relevé précédent',
        minus:function(){self.setVal(sid,f,v-f.step);},plus:function(){self.setVal(sid,f,v+f.step);},
        onRuler:function(e){if(e.type==='pointermove'&&!e.buttons)return;var r=e.currentTarget.getBoundingClientRect();var p=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));self.setVal(sid,f,f.min+p*(f.max-f.min));}};});
    var ck=st.checks[sid]||{};
    checks=T.checks.map(function(label,i){return{label:label,on:!!ck[i],box:ck[i]?'var(--color-text)':'transparent',toggle:function(){self.setState(function(s2){var o={};o[sid]=Object.assign({},s2.checks[sid]||{});o[sid][i]=!ck[i];return{checks:Object.assign({},s2.checks,o)};});}};});
    var pq=st.prods[sid]||{};
    prods=T.produits.map(function(p,i){var q=pq[i]||0;var set=function(n){self.setState(function(s2){var o={};o[sid]=Object.assign({},s2.prods[sid]||{});o[sid][i]=Math.max(0,+(n).toFixed(2));return{prods:Object.assign({},s2.prods,o)};});};return{nom:p[0],unite:p[1],qty:self.fmt(q,p[2]),minus:function(){set(q-p[2]);},plus:function(){set(q+p[2]);}};});
    var nOut=fields.filter(function(f){return f.out;}).length,nT=fields.filter(function(f){return!f.pending;}).length,va=st.validated[sid];
    cur={nom:s.nom,ville:s.ville,bassin:s.bassin,contrat:s.contrat,hasContrat:!!s.contrat,typeLabel:T.label+(s.type==='GEN'?' · valeurs par défaut':''),norme:T.norme,nFields:fields.length,nTouched:nT,nOut:nOut,hasOut:nOut>0,
      outBg:nOut?'var(--color-accent-900)':'transparent',outFg:nOut?'var(--color-bg)':'var(--color-text)',nChecks:checks.filter(function(c){return c.on;}).length,nChecksTotal:checks.length,
      isValidated:!!va,notValidated:!va,validAt:va,photoReq:T.photo,sid:sid,syncTxt:st.sync[sid]==='ok'?'synchronisée avec le bureau':'en attente de réseau — sera envoyée automatiquement'};
    ph=st.photo[sid];
    cur._site=s;cur._T=T;cur._fields=fields;cur._checks=checks;
  }
  var punchOn=!!(this.punch&&cj&&(String(this.punch.siteId)===cj.site||cj.id==='punch'));
  var days=this.days.length?this.days:[{dow:JOURS[new Date().getDay()].slice(0,3),num:dnum(new Date()),title:'Aujourd’hui',items:[]}];
  var dsel=days[Math.min(st.planDay,days.length-1)];
  var recMap={};days.forEach(function(d){d.items.forEach(function(it){if(it[3]&&!recMap[it[1]+it[2]]){var s=siteById(it[1]);recMap[it[1]+it[2]]={nom:s?s.nom:'—',rec:it[3]+' · '+it[2]};}});});
  var segStyle=function(on){return{bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)'};};
  var tabOf={temps:'temps',punchform:'temps',stopform:'temps',today:'today',fiche:'fiche',planning:'planning',profil:'profil',soon:'demandes',demandes:'demandes'}[scr];
  var TABS=[['today','Aujourd’hui','home'],['temps','Temps','clock'],['fiche','Fiche','clipboard'],['planning','Planning','calendar'],['demandes','Demandes','message'],['profil','Profil','user']];

  var DT={mat:{label:'Matériel',icon:'package',sub:'Produits, pièces',chips:['Hypochlorite 20 L','Trousse DPD','Bicarbonate','Joint ou pièce','Autre']},
    ren:{label:'Renfort',icon:'users',sub:'Un collègue sur place',chips:['1 personne · 1 h','Demi-journée','Levée de couverture','Autre']},
    urg:{label:'Urgence',icon:'alert',sub:'Avis immédiat',chips:['Fuite importante','Bris de pompe','Déversement de produit','Blessure','Autre'],urgent:true}};
  var demTypes=Object.keys(DT).map(function(k){return Object.assign({},DT[k],{go:function(){self.setState({demande:k,demChip:null,demandeTxt:''});},bg:k==='urg'?'var(--color-accent-900)':(st.demande===k?'var(--color-accent-100)':'var(--color-bg)'),fg:k==='urg'?'#ffffff':'var(--color-text)'});});
  var cd=st.demande&&DT[st.demande];
  var composer=cd?Object.assign({},cd,{chips:cd.chips.map(function(c){return{label:c,go:function(){self.setState({demChip:c});},bg:st.demChip===c?'var(--color-text)':'transparent',fg:st.demChip===c?'var(--color-bg)':'var(--color-text)'};})}):{chips:[]};
  var demHist=this.dem.map(function(d){var t=new Date(d.created_at);return{type:d.type,texte:d.texte||d.motif||d.type,statut:d.statut,quand:t.getDate()+' '+MOIS[t.getMonth()].slice(0,4)+'. '+hhmm(t)};});

  var nw=new Date(),tIdx=(nw.getDay()+6)%7,vd=this.viewDays(),act=this.activeTask(vd),opsN=this.ops().length;
  var closedH=function(d){var s=0;(d.tasks||[]).forEach(function(t){s+=t.hrs||0;});return s;};
  var liveMin=act?minsFrom(act.start,hhmm(nw)):0,dayH=closedH(vd[tIdx])+liveMin/60,weekH=vd.reduce(function(s,d){return s+closedH(d);},0)+liveMin/60;
  var DL3=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],mon=mondayOf(new Date());
  var pn={active:!!act,idle:!act,hasPending:opsN>0,pendingTxt:opsN+' opération(s) de punch en attente d’envoi — rien n’est perdu',
    statusTxt:act?('Punché depuis '+act.start+' · '+fmtMin(liveMin)):'Aucun punch actif',title:act?act.lieu:'Prêt à puncher',dayTotal:fmtH(dayH),weekTotal:fmtH(weekH),
    openStart:function(){self.openPunchForm(null);},openStop:function(){self.openStopForm();},
    days:vd.map(function(d,i){var dt=addDays(mon,i);return{label:DL3[i]+' '+dt.getDate(),total:fmtH(closedH(d)+(i===tIdx?liveMin/60:0)),bg:i===tIdx?'var(--color-accent-100)':'transparent',
      tasks:(d.tasks||[]).map(function(t){return{h:t.start+(t.end?' → '+t.end:' → en cours'),lieu:t.lieu,dur:t.active?fmtMin(minsFrom(t.start,hhmm(nw))):fmtH(t.hrs||0),pend:t.pendingValidation?'À valider':''};})};})};
  var pq=norm(st.pf.q);
  var pfSites=REF.list.filter(function(s){return!pq||norm(s.nom+' '+s.ville).indexOf(pq)>=0;}).slice(0,pq?20:8).map(function(s){var on=st.pf.siteId===s.id;
    return{nom:s.nom,ville:s.ville||'—',bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)',go:function(){self.setState({pf:Object.assign({},st.pf,{siteId:s.id,lieu:s.nom})});}};});
  var pfJobs=jobs.filter(function(j){return!j.isDone;}).map(function(j){var on=st.pf.src&&String(j.id).split(':')[1]===st.pf.src.id;return{nom:j.nom,h:j.h||'',bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)',go:function(){self.openPunchForm(j);}};});
  var pf={q:st.pf.q,onQ:function(e){self.setState({pf:Object.assign({},st.pf,{q:e.target.value})});},lieu:st.pf.lieu,onLieu:function(e){self.setState({pf:Object.assign({},st.pf,{lieu:e.target.value,siteId:null})});},
    odt:st.pf.odt,onOdt:function(e){self.setState({pf:Object.assign({},st.pf,{odt:e.target.value})});},detail:st.pf.detail,onDetail:function(e){self.setState({pf:Object.assign({},st.pf,{detail:e.target.value})});},
    km:st.pf.km,onKm:function(e){self.setState({pf:Object.assign({},st.pf,{km:e.target.value})});},sites:pfSites,hasJobs:pfJobs.length>0,jobs:pfJobs,hasSource:!!st.pf.src,sourceLabel:st.pf.src?st.pf.src.label:'',
    willClose:!!act,closeTxt:act?('Le punch en cours « '+act.lieu+' » (depuis '+act.start+') sera terminé à '+hhmm(nw)+'.'):'',hasSite:!!st.pf.siteId,siteNom:st.pf.siteId?(siteById(st.pf.siteId)||{}).nom:'',
    submit:function(){self.submitPunch();},cancel:function(){self.go('today');}};
  var lieux=[];(vd[tIdx].tasks||[]).forEach(function(t){if(t.lieu&&lieux.indexOf(t.lieu)<0)lieux.push(t.lieu);});
  var sf={total:fmtH(dayH),nPunchs:(vd[tIdx].tasks||[]).length,lieux:lieux.join(', ')||'—',km:st.sf.km,onKm:function(e){self.setState({sf:{km:e.target.value}});},submit:function(){self.submitStop();},cancel:function(){self.go('today');}};
  var nowD=new Date(),sun=this.prefs.sun,big=this.prefs.big;
  return{
    rootRef:this.rootRef,contentRef:this.contentRef,sigRef:this.sigRef,
    toggleSun:function(){self.setPref('sun');},toggleBig:function(){self.setPref('big');},
    sunLabel:sun?'activé':'désactivé',sunBtnBg:sun?'var(--color-text)':'transparent',sunBtnFg:sun?'var(--color-bg)':'var(--color-text)',
    sunJustify:sun?'flex-end':'flex-start',sunTrack:sun?'var(--color-text)':'transparent',sunKnob:sun?'var(--color-bg)':'var(--color-text)',
    bigJustify:big?'flex-end':'flex-start',bigTrack:big?'var(--color-text)':'transparent',bigKnob:big?'var(--color-bg)':'var(--color-text)',
    hasToast:!!st.toast,toast:st.toast,headerTitle:titles[scr]||'La Tournée',
    syncLbl:(this.online&&this.sendErr)?'⚠ '+cap(this.sendErr):(this.online&&Object.keys(this.loadErr).length)?'⚠ Données incomplètes : '+Object.keys(this.loadErr).map(function(k){return self.loadErr[k];}).join(', '):this.online?((this.queueN+opsN)?(this.queueN+opsN)+' envoi(s) en attente':'Connecté · synchro '+(this.syncAt?hhmm(this.syncAt):'—')):'Hors-ligne · '+this.queueN+' fiche(s) en attente',
    isToday:scr==='today',isTemps:scr==='temps',isPunchForm:scr==='punchform',isStopForm:scr==='stopform',pn:pn,pf:pf,sf:sf,isFiche:scr==='fiche'&&!!cj,isFicheEmpty:scr==='fiche'&&!cj,isLog:false,isHiv:false,isHivForm:false,isDem:scr==='demandes',isPlan:scr==='planning',isProfil:scr==='profil',isSoon:scr==='soon',soonTitle:st.soon,
    goToday:function(){self.closeFiche();},goFiche:function(){self.go('fiche');},goLog:function(){self.soon('Logistique');},goHiv:function(){self.soon('Hivernage');},goDemandes:function(){self.go('demandes');},demTypes:demTypes,hasComposer:!!cd,composer:composer,composerSite:cj?(cur.nom||'—'):'Aucun (hors site)',closeComposer:function(){self.setState({demande:null});},demandeTxt:st.demandeTxt,onDemTxt:function(e){self.setState({demandeTxt:e.target.value});},demHist:demHist,
    sendDemande:function(){if(!st.demande)return;var t=DT[st.demande],txt=[st.demChip,st.demandeTxt].filter(Boolean).join(' — ')||t.label,s=cj?(cur._site||siteById(cj.site)):null,now=new Date();
      var rec={_t:'demandes',id:self.user.id+'-'+now.getTime(),site_id:s?s.id:null,site_nom:s?s.nom:null,tech:self.user.id,tech_nom:self.me.nom,type:t.label,motif:st.demChip||null,texte:txt,statut:'Envoyée'};
      self.dem=[{type:t.label,texte:txt,statut:navigator.onLine?'Envoyée':'En attente de réseau',created_at:now.toISOString()}].concat(self.dem);self.setState({demande:null,demChip:null,demandeTxt:''});self.enqueue(rec);self.flash(t.urgent?'Urgence envoyée — appelez aussi le bureau':'Demande envoyée au bureau');},
    todayTxt:JOURS[nowD.getDay()]+' '+dnum(nowD)+' '+MOIS[nowD.getMonth()],
    jobs:jobs,jobCount:jobs.length,doneTxt:(function(n){return n+(n>1?' faits':' fait');})(jobs.filter(function(j){return j.isDone;}).length),emptyDay:!jobs.length&&!cj,
    hasPunch:!!cj,noPunch:!cj&&!!next,punchAt:cj&&this.punch?this.punch.start:'',
    punchLbl:punchOn?'Punché depuis '+this.punch.start:'Fiche ouverte · aucun punch actif',punchShort:punchOn?'Punché à '+this.punch.start:'Aucun punch actif',
    punchElapsed:(punchOn&&this.punch.start)?(function(){var p=self.punch.start.split(':'),m=(nowD.getHours()*60+nowD.getMinutes())-(+p[0]*60+ +p[1]);if(m<0)return'';return m>=60?Math.floor(m/60)+' h '+pad(m%60):m+' min';})():'',
    nextJob:next?{punchHere:function(){var jj=self.jobs.filter(function(x){return x.id===next.id;})[0];self.openPunchForm(jj);},nom:next.nom,h:next.h||'sans heure',ville:next.ville,punch:next.punch}:{},
    depunch:function(){self.closeFiche();},cur:cur,fields:fields,checks:checks,prods:prods,
    noteTxt:cj?(st.notes[cur.sid]||''):'',onNote:function(e){var v=e.target.value;if(!cj)return;self.setState(function(s2){var o={};o[cur.sid]=v;return{notes:Object.assign({},s2.notes,o)};});},
    takePhoto:function(){if(cj)self.pickPhoto(cur.sid);},
    photoTitle:ph?'Photo prise à '+ph:'Prendre la photo',photoSub:ph?'Toucher pour reprendre':'Requise : '+(cur.photoReq||''),
    photoBg:ph?'repeating-linear-gradient(135deg,var(--color-accent-200) 0 1px,transparent 1px 8px)':'transparent',
    validate:function(){if(!cj)return;var s=cur._site,T=cur._T,vv=st.vals[s.id]||{},tt=st.touched[s.id]||{},vout={},ch={},pr={};
      Object.keys(tt).forEach(function(k){if(vv[k]!=null)vout[k]=vv[k];});
      cur._checks.forEach(function(c){ch[c.label]=c.on;});T.produits.forEach(function(p,i){var q=(st.prods[s.id]||{})[i]||0;if(q>0)pr[p[0]]=q;});
      var now=new Date(),rec={id:self.user.id+'-'+self.today+'-'+s.id,site_id:s.id,site_nom:s.nom,tech:self.user.id,tech_nom:self.me.nom,date:self.today,heure:hhmm(now),type_code:s.type,
        vals:vout,touched:tt,checks:ch,prods:pr,note:st.notes[s.id]||null,photo:st.photoData[s.id]||null,hors_zone:cur.nOut};
      var va={};va[s.id]=hhmm(now);self.setState(function(s2){return{validated:Object.assign({},s2.validated,va)};});self.enqueue(rec);
      self.flash(navigator.onLine?'Fiche enregistrée':'Fiche enregistrée — sera envoyée au retour du réseau');},
    planDays:days.map(function(d,i){return Object.assign({dow:d.dow,num:d.num,go:function(){self.setState({planDay:i});}},segStyle(st.planDay===i));}),
    planTitle:dsel.title,planItems:dsel.items.map(function(it){var s=siteById(it[1])||pseudoSite(it[1],'');return{h:it[0]||'—',nom:s.nom,ville:s.ville,tache:it[2],rec:it[3]};}),recurrences:Object.keys(recMap).map(function(k){return recMap[k];}),
    myWeek:this.hours==null?'—':fr(Math.round(this.hours*100)/100),me:this.me,queueLbl:this.queueN?this.queueN+' fiche(s) à envoyer':'Rien en attente',
    bureauTel:String(this.bureau||'').replace(/[^\d+]/g,''),logout:function(){localStorage.removeItem('sa_terrain_user');location.reload();},
    tabs:TABS.map(function(t){return{label:t[1],icon:t[2],go:function(){self.go(t[0]);},fg:tabOf===t[0]?'var(--color-text)':'var(--color-neutral-600)',fw:tabOf===t[0]?600:400,bar:tabOf===t[0]?'inset 0 3px 0 var(--color-text)':'none',dot:t[0]==='fiche'&&!!cj};})
  };};
Comp.prototype.update=function(){if(!this._host)return;SARender(document.getElementById('tpl'),this._host,this.vals());this.applyTheme();};
Comp.prototype.mount=function(host){var self=this;this._host=host;this.update();
  window.addEventListener('online',function(){self.online=true;self.refresh();});window.addEventListener('offline',function(){self.online=false;self.update();});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')self.refresh();});
  setInterval(function(){if(document.visibilityState==='visible'){self.flush();self.flushOps();self.loadPunch().then(function(){self.update();});}},60000);
  this.refresh();};

/* ---------- Connexion (même vérification serveur que SA Platform) ---------- */
function showLogin(){var el=document.getElementById('login');el.style.display='flex';
  document.getElementById('loginForm').onsubmit=function(e){e.preventDefault();var u=document.getElementById('lu').value.trim().toLowerCase(),p=document.getElementById('lp').value,err=document.getElementById('le');err.textContent='Vérification…';
    fetch(SB+'/rest/v1/rpc/verifier_connexion',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},H),body:JSON.stringify({p_id:u,p_mdp:p})}).then(function(r){return r.json();}).then(function(rows){
      if(!Array.isArray(rows)||!rows.length){err.textContent='Identifiant ou mot de passe incorrect';return;}
      var c=rows[0];if(c.doit_changer_mdp){err.textContent='Changez d’abord votre mot de passe dans SA Platform.';return;}
      localStorage.setItem('sa_terrain_user',JSON.stringify({id:c.id,prenom:c.prenom,nom:c.nom,role:c.role,dept:c.dept,tel:c.tel,email:c.email||''}));location.reload();
    }).catch(function(){err.textContent='Réseau indisponible — réessayez.';});};}
window.addEventListener('DOMContentLoaded',function(){
  var user=jget('sa_terrain_user',null);
  if(!user){showLogin();return;}
  document.getElementById('login').style.display='none';
  var c=new Comp(user);window.__terrain=c;c.mount(document.getElementById('app'));
});
})();
