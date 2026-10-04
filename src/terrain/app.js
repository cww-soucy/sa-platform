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
function fd(s){if(!s)return'';var d=new Date(String(s).slice(0,10)+'T12:00:00');return dnum(d)+' '+MOIS[d.getMonth()];}
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
  }else if(op.type==='edit'||op.type==='delete'){
    /* Même protocole que SA Platform (v64) : identité stable k (+ k0 = signature d'origine), heure de modification
       mod, et pierre tombale dans d.del pour une suppression — sinon la synchro d'index.html ramènerait l'ancien punch. */
    var tk=findTask(d,op);if(!tk)return days;
    if(op.type==='edit'){
      if(!tk.k){tk.k0=sig(tk);tk.k=op.id;}tk.mod=op.ts;tk.lieu=op.lieu;tk.start=op.start;
      if(op.end){tk.end=op.end;tk.active=false;}if(tk.end&&!tk.active)tk.hrs=hrsFrom(tk.start,tk.end);
      tk.pendingValidation=true;tk.pendingReason='correction_employe';tk.correctedBy=op.uid;tk.correctedAt=new Date(op.ts).toISOString();
    }else{
      d.del=d.del||[];if(!d.del.some(function(x){return x.at===op.ts;}))d.del.push({k:tk.k||'',sig:sig(tk),at:op.ts});
      d.tasks=d.tasks.filter(function(x){return x!==tk;});
    }
    d.status=d.tasks.some(function(x){return x.active;})?'running':(d.tasks.length?'done':'idle');
  }
  return days;
}
function sig(t){return(t.start||'')+'|'+(t.lieu||'');}
function findTask(d,op){return(d.tasks||[]).filter(function(t){return(op.k&&t.k===op.k)||sig(t)===op.sig||(t.k0&&t.k0===op.sig);})[0]||null;}
var HM=/^([01]\d|2[0-3]):[0-5]\d$/;
function rid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);}
function noBon(prefix){var d=new Date();return prefix+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+(Math.floor(Math.random()*900)+100);}
function cap(s){s=String(s||'');return s.charAt(0).toUpperCase()+s.slice(1);}

/* ---------- Données de référence (types, sites, contrats) : cache local pour le hors-ligne ---------- */
var REF={types:{},sites:{},list:[],cat:[]};
function villeOf(addr){var p=String(addr||'').split(',').map(function(x){return x.trim();}).filter(function(x){return x&&!/^(qc|québec|quebec|canada)$/i.test(x)&&!/[a-z]\d[a-z]\s?\d[a-z]\d/i.test(x);});return p.length>1?p[p.length-1].replace(/^Ville de\s+/i,''):'';}
function buildRef(raw){
  REF.cat=Array.isArray(raw.cat)?raw.cat:[];
  REF.types={};(raw.types||[]).forEach(function(t){REF.types[t.code]={label:t.label,court:t.court||t.label,norme:t.norme||'',fields:t.fields||[],checks:t.checks||[],produits:t.produits||[],photo:t.photo||'Vue d’ensemble du bassin'};});
  var ct={};(raw.contrats||[]).forEach(function(c){ct[c.site_id]=c;});
  REF.sites={};REF.list=[];
  (raw.sites||[]).forEach(function(s){var c=ct[s.id];var code=(c&&c.type_code&&REF.types[c.type_code])?c.type_code:'GEN';
    /* Bassins déclarés dans la fiche du site (sa-admin / SA Platform) : chacun peut avoir ses propres paramètres de relevé */
    var bs=(Array.isArray(s.bassins)?s.bassins:[]).filter(function(b){return b&&String(b.nom||'').trim();}).map(function(b,i){return{id:String(b.id||('b'+i)),nom:String(b.nom).trim(),code:(b.type_code&&REF.types[b.type_code])?b.type_code:code,first:i===0};});
    var o={id:String(s.id),nom:s.nom||'(sans nom)',ville:villeOf(s.addr),addr:s.addr||'',type:code,bassin:'',bassins:bs,contrat:(c&&c.code)||'',client:'',interne:s.type==='interne'||isBureau(s.nom)};REF.sites[o.id]=o;if(!/^Fusionné →/.test(s.notes||''))REF.list.push(o);});
}
function siteById(id){return REF.sites[String(id)]||null;}
function pseudoSite(nom,addr){var id='x:'+norm(nom||addr||'inconnu').replace(/ /g,'-');
  if(!REF.sites[id])REF.sites[id]={id:id,nom:nom||addr||'Site non répertorié',ville:villeOf(addr),addr:addr||'',type:'GEN',bassin:'',contrat:'',client:'',interne:isBureau(nom)};return REF.sites[id];}
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
  this.inv=[];this.bons=[];this.hivRep={};this.lastSortie=null;this._sig={strokes:[],w:0};
  this.dem=[];this.ft=jget(LSK_FT+user.id+'_'+iso(mondayOf(new Date())),null);this.state=Object.assign({pf:{q:'',lieu:'',siteId:null,odt:'',detail:'',km:'',src:null},sf:{km:''},demande:null,demChip:null,demandeTxt:'',screen:'today',logTab:'sortie',sortie:{},invQ:'',bonSel:null,signer:'',hivFilter:'todo',hivSel:null,hivChecks:{},hivAntigel:{},hivEtat:{},hivNote:{},hivSent:{},demPhoto:null,pe:null,openJob:null,vals:{},touched:{},checks:{},prods:{},photo:{},photoData:{},notes:{},validated:{},sync:{},pts:{},acts:{},step:{},planDay:0,toast:null,soon:''},saved);
  this.state.toast=null;this.state.screen='today';this.state.pf={q:'',lieu:'',siteId:null,odt:'',detail:'',km:'',src:null};this.state.sf={km:''};
}
Comp.prototype.persist=function(){var s=this.state,keep={vals:s.vals,touched:s.touched,checks:s.checks,prods:s.prods,photo:s.photo,notes:s.notes,validated:s.validated,sync:s.sync,photoData:s.photoData,pts:s.pts,acts:s.acts,step:s.step,hivChecks:s.hivChecks,hivAntigel:s.hivAntigel,hivEtat:s.hivEtat,hivNote:s.hivNote,hivSent:s.hivSent};
  if(!jset('sa_terrain_state_'+this.user.id+'_'+this.today,keep)){keep.photoData={};jset('sa_terrain_state_'+this.user.id+'_'+this.today,keep);}};
Comp.prototype.setState=function(p){var n=typeof p==='function'?p(this.state):p;this.state=Object.assign({},this.state,n);this.persist();this.update();};
Comp.prototype.flash=function(t){var s=this;clearTimeout(this._tt);this.state.toast=t;this.update();this._tt=setTimeout(function(){s.state.toast=null;s.update();},2600);};
Comp.prototype.go=function(s){this.setState({screen:s});var c=this.contentRef.current;if(c)c.scrollTop=0;if(s==='logistique')this.loadLog();if(s==='hivernage')this.loadHiv();if(s==='comm')this.loadComm();};
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
  return Promise.all([get('types_bassin?select=*'),get('sites?select=id,nom,addr,notes,bassins,type'),get('contrats?select=*'),get('inspection_points?select=*&actif=eq.true').catch(function(){return null;})]).then(function(r){var raw={types:r[0],sites:r[1],contrats:r[2],cat:r[3]||(cached&&cached.cat)||[]};jset('sa_terrain_ref',raw);buildRef(raw);self.syncAt=new Date();self.okLoad('ref');}).catch(function(e){self.failLoad('ref','sites et contrats'+(cached?' (copie locale utilisée)':''),e);});};
Comp.prototype.loadJobs=function(){var self=this,uid=encodeURIComponent(this.user.id),d0=this.today,d6=iso(addDays(new Date(),6));
  var q=[get('workorders?select=id,client,site,type,date,assigne,status,descr,groupe_id&date=gte.'+d0+'&date=lte.'+d6+'&assigne=ilike.*'+uid+'*'),
    get('planning_tasks?select=id,titre,emp,site_id,site_nom,date_debut,date_fin,heure_debut,heure_fin,statut,recurrence,wo_id,plan_id&date_debut=lte.'+d6+'&date_fin=gte.'+d0+'&emp=ilike.*'+uid+'*'),
    get('plan?select=id,client,addr,date,heure,emp,site_id,descr,type,status&date=gte.'+d0+'&date=lte.'+d6+'&emp=ilike.*'+uid+'*')];
  var me=this.user.id;
  return Promise.all(q).then(function(r){var wo=r[0].filter(function(w){return hasId(w.assigne,me);}),pt=r[1].filter(function(t){return hasId(t.emp,me);}),pl=r[2].filter(function(p){return hasId(p.emp,me);});var all=[];
    var woIds={},plIds={};wo.forEach(function(w){woIds[w.id]=1;});pl.forEach(function(p){plIds[p.id]=1;});
    wo.forEach(function(w){var s=matchSite(w.client,w.site)||pseudoSite(w.client,w.site);
      all.push({id:'wo:'+w.id,date:w.date,site:s.id,h:'',fin:'',statut:(w.status==='termine'||w.status==='complete'||w.status==='facture')?'fait':'à venir',tache:(String(w.descr||'').split('\n')[0].slice(0,90))||cap(w.type||'Visite'),rec:w.groupe_id?'Visite récurrente':''});});
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
/* sid = id du site, ou « site#bassin » quand le site a plusieurs bassins (le 1er bassin reprend aussi les anciens relevés sans bassin) */
Comp.prototype.loadLast=function(sid){var self=this;if(self.last[sid]!==undefined)return;self.last[sid]=null;var p=String(sid).split('#'),s=siteById(p[0]),b=p[1]&&s&&(s.bassins||[]).filter(function(x){return x.id===p[1];})[0];
  var bf=b?(b.first?'&or=(bassin.eq.'+encodeURIComponent('"'+b.nom+'"')+',bassin.is.null)':'&bassin=eq.'+encodeURIComponent(b.nom)):'';
  get('releves?site_id=eq.'+encodeURIComponent(p[0])+bf+'&select=vals,date&order=date.desc,updated_at.desc&limit=1').then(function(r){self.last[sid]=r[0]||null;self.update();}).catch(function(){self.last[sid]=undefined;});};
Comp.prototype.okLoad=function(k){delete this.loadErr[k];};
Comp.prototype.failLoad=function(k,label,e){var first=!Object.keys(this.loadErr).length;this.loadErr[k]=label+' ('+netMsg(e)+')';if(first&&navigator.onLine)this.flash('Lecture impossible : '+this.loadErr[k]);};
Comp.prototype.loadDem=function(){var self=this;return get('demandes?tech=eq.'+encodeURIComponent(this.user.id)+'&select=id,type,motif,texte,statut,created_at&order=created_at.desc&limit=15').then(function(r){self.dem=r;self.okLoad('dem');self.update();}).catch(function(e){self.failLoad('dem','demandes',e);});};
Comp.prototype.loadLog=function(){var self=this;return Promise.all([get('inventaire?select=id,nom,unite,qte,categorie&order=nom.asc'),
    get('bons_livraison?select=id,no_bon,client,tel,adresse,date,heure,technicien,urgent,status,items_liv,photos&status=neq.livre&order=date.asc')])
  .then(function(r){var cur=self.curBon();self.inv=r[0];self.bons=r[1].filter(function(b){return b.status!=='livre';});
    // le bon qu'on vient de faire signer reste affiché (avec sa confirmation) jusqu'au retour à la liste
    if(cur&&cur.status==='livre'&&!self.bons.some(function(b){return b.id===cur.id;}))self.bons.unshift(cur);self.okLoad('log');self.update();}).catch(function(e){self.failLoad('log','logistique',e);self.update();});};
Comp.prototype.loadHiv=function(){var self=this,y=new Date().getFullYear();
  return get('rapports_hivernage?select=id,site_id,site_nom,status,date_inspection,technicien&date_inspection=gte.'+y+'-01-01&order=date_inspection.desc')
  .then(function(r){self.hivRep={};r.filter(function(x){return String(x.date_inspection||'').slice(0,4)===String(y);}).forEach(function(x){if(x.site_id&&!self.hivRep[x.site_id])self.hivRep[x.site_id]=x;});self.okLoad('hiv');self.update();})
  .catch(function(e){self.failLoad('hiv','hivernage',e);self.update();});};
/* ---------- Communications du bureau (infolettre, informations, procédures) : lues ici, lecture confirmée au bureau ---------- */
Comp.prototype.loadComm=function(){var self=this,c=jget('sa_terrain_comm_'+this.user.id,null);if(c&&!this.comm){this.comm=c.l;this.commLus=c.r;}
  return Promise.all([get('communications?statut=eq.publie&portee=eq.interne&select=id,type,titre,resume,contenu,sections,reference,version,confirmation,date_pub,epingle,auteur_nom&order=date_pub.desc&limit=40'),
    get('communication_lectures?uid=eq.'+encodeURIComponent(this.user.id)+'&select=comm_id,version')])
  .then(function(r){var lus={};r[1].forEach(function(l){lus[l.comm_id]=Math.max(lus[l.comm_id]||0,l.version||1);});
    jget('sa_terrain_queue',[]).forEach(function(q){if(q._t==='communication_lectures')lus[q.comm_id]=Math.max(lus[q.comm_id]||0,q.version||1);});
    self.comm=r[0];self.commLus=lus;jset('sa_terrain_comm_'+self.user.id,{l:r[0],r:lus});self.okLoad('comm');self.update();})
  .catch(function(e){self.failLoad('comm','communications',e);self.update();});};
Comp.prototype.commUnread=function(c){var v=this.commLus&&this.commLus[c.id];return!v||(c.type==='procedure'&&v<(c.version||1));};
Comp.prototype.commRead=function(c){if(!this.commUnread(c))return;var now=new Date().toISOString(),v=c.version||1;this.commLus=Object.assign({},this.commLus);this.commLus[c.id]=v;
  jset('sa_terrain_comm_'+this.user.id,{l:this.comm||[],r:this.commLus});
  this.enqueue({_t:'communication_lectures',id:c.id+'_'+this.user.id,comm_id:c.id,uid:this.user.id,emp_nom:this.me.nom,version:v,lu_at:now,updated_at:now});};
Comp.prototype.loadBureau=function(){var self=this;return get('comptes_publics?id=eq.cwweil&select=tel').then(function(r){self.bureau=(r[0]&&r[0].tel)||'';}).catch(function(){});};
Comp.prototype.refresh=function(){var self=this;this.loadComm();return Promise.all([this.loadRef(),this.loadBureau(),this.loadDem()]).then(function(){return Promise.all([self.loadJobs(),self.loadPunch()]);}).then(function(){var c=self.curJob();if(c)self.loadLast(c.site);self.flush();self.flushOps();self.update();});};

/* ---------- File d'attente : rien n'est perdu si le réseau tombe ---------- */
Comp.prototype.flush=function(){var self=this,q=jget('sa_terrain_queue',[]);if(!q.length||!navigator.onLine){self.queueN=q.length;return;}
  var item=q[0],tbl=item._t||'releves',body=Object.assign({},item);delete body._t;delete body._sk;
  /* _m:'PATCH' → mise à jour partielle (ex. bon de livraison validé) : on ne réécrit jamais toute la ligne,
     pour ne pas écraser ce que le bureau a modifié entre-temps. */
  var req=item._m==='PATCH'?fetch(SB+'/rest/v1/'+tbl+'?'+item._q,{method:'PATCH',headers:Object.assign({'Content-Type':'application/json',Prefer:'return=minimal'},H),body:JSON.stringify(item.body)}):post(tbl,body,'resolution=merge-duplicates,return=minimal');
  req.then(function(r){
    if(r.ok){var cur=jget('sa_terrain_queue',[]).filter(function(x){return x.id!==item.id;});jset('sa_terrain_queue',cur);self.queueN=cur.length;
      self.sendErr='';if(tbl==='releves'){var s=Object.assign({},self.state.sync);s[item._sk||item.site_id]='ok';self.state=Object.assign({},self.state,{sync:s});self.persist();}else if(tbl==='demandes'){self.loadDem();}else if(tbl==='rapports_hivernage'){self.loadHiv();}else if(tbl==='bons_livraison'){self.loadLog();}self.update();if(cur.length)self.flush();}
    else{self.queueN=q.length;self.sendErr=(tbl==='demandes'?'demande':'fiche')+' refusée par le serveur (HTTP '+r.status+') — gardée sur le téléphone, prévenez le bureau';self.update();}}).catch(function(){self.queueN=q.length;self.update();});};
Comp.prototype.enqueue=function(rec){var q=jget('sa_terrain_queue',[]).filter(function(x){return x.id!==rec.id;});q.push(rec);
  if(!jset('sa_terrain_queue',q)){rec.photo=null;q[q.length-1]=rec;jset('sa_terrain_queue',q);}this.queueN=q.length;this.flush();};

/* ---------- Photo compressée (max 900 px, JPEG) ---------- */
Comp.prototype.pickImage=function(cb){var inp=document.getElementById('photoInput');inp.value='';inp.onchange=function(){var f=inp.files&&inp.files[0];if(!f)return;
  var img=new Image(),u=URL.createObjectURL(f);img.onload=function(){var k=Math.min(1,900/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);cb(c.toDataURL('image/jpeg',0.6));};img.src=u;};inp.click();};
/* ---------- Visite d'inspection : état d'un point, étape, photo d'un point ---------- */
Comp.prototype.setPt=function(sid,id,patch){this.setState(function(s2){var o=Object.assign({},s2.pts||{}),p=Object.assign({},o[sid]||{});p[id]=Object.assign({},p[id]||{},patch);o[sid]=p;return{pts:o};});};
Comp.prototype.setStep=function(sid,v){var o=Object.assign({},this.state.step||{});o[sid]=v;this.setState({step:o});var c=this.contentRef&&this.contentRef.current;if(c&&c.scrollTo)c.scrollTo(0,0);};
Comp.prototype.ptPhoto=function(sid,id){var self=this;this.pickImage(function(data){var x=((self.state.pts||{})[sid]||{})[id]||{};self.setPt(sid,id,{photos:(x.photos||[]).concat([data]).slice(-3)});});};
Comp.prototype.pickPhoto=function(sid){var self=this;this.pickImage(function(data){
    self.setState(function(s){var a={},b={};a[sid]=hhmm(new Date());b[sid]=data;return{photo:Object.assign({},s.photo,a),photoData:Object.assign({},s.photoData,b)};});});};

/* ---------- Correction / suppression d'un punch (semaine en cours) — soumise au superviseur ---------- */
Comp.prototype.openPunchEdit=function(dayIdx,t){this.setState({pe:{dayIdx:dayIdx,k:t.k||'',sig:sig(t),lieu:t.lieu||'',start:t.start||'',end:t.end||'',active:!!t.active,confirm:false},screen:'punchedit'});};
Comp.prototype.savePunchEdit=function(){var e=this.state.pe;if(!e)return;var lieu=String(e.lieu||'').trim(),st=String(e.start||'').trim(),en=String(e.end||'').trim();
  if(!lieu){this.flash('Le lieu ne peut pas être vide');return;}if(!HM.test(st)){this.flash('Heure de début invalide (HH:MM)');return;}if(en&&!HM.test(en)){this.flash('Heure de fin invalide (HH:MM)');return;}
  if(!e.active&&!en){this.flash('Indiquez l’heure de fin');return;}
  var now=Date.now();this.setState({pe:null,screen:'temps'});
  this.enqueueOp({type:'edit',id:rid('e'),ts:now,uid:this.user.id,week:this.weekKey(),dayIdx:e.dayIdx,k:e.k,sig:e.sig,lieu:lieu,start:st,end:en});
  this.flash('Correction enregistrée — le superviseur la validera');};
Comp.prototype.deletePunch=function(){var e=this.state.pe;if(!e)return;if(!e.confirm){this.setState({pe:Object.assign({},e,{confirm:true})});return;}
  this.setState({pe:null,screen:'temps'});this.enqueueOp({type:'delete',id:rid('x'),ts:Date.now(),uid:this.user.id,week:this.weekKey(),dayIdx:e.dayIdx,k:e.k,sig:e.sig});this.flash('Punch supprimé');};

/* ---------- Logistique : sortie d'inventaire → bon de livraison signé (mêmes tables et formats que SA Platform) ---------- */
Comp.prototype.logSiteObj=function(){var cj=this.curJob();return cj?(siteById(cj.site)||pseudoSite(cj.site,'')):null;};
Comp.prototype.saveSortie=function(){var self=this,sel=this.state.sortie,items=this.inv.filter(function(p){return sel[p.id]>0;}).map(function(p){return{nom:p.nom,qty:sel[p.id],unite:p.unite||''};});
  if(!items.length){this.flash('Choisissez au moins un article');return;}var s=this.logSiteObj(),dest=s?s.nom:'',now=new Date();
  this.enqueue({_t:'sorties_inventaire',id:rid('so'),no_bon:noBon('SA-INV-'),nom:this.me.nom,no_employe:this.user.id,departement:this.user.dept||'',date:iso(now),client:dest,
    lignes:items.map(function(i){return{code:'',loc:'',desc:i.nom,qteSortie:String(i.qty),qteRetour:'',projet:dest,unite:i.unite};}),status:'envoye',sent_at:now.toISOString(),created_by:this.user.id,created_at:now.toISOString(),updated_at:now.toISOString()});
  this.lastSortie={site:s,items:items};this.setState({sortie:{}});this.flash('Sortie enregistrée · '+items.length+' article(s)');};
Comp.prototype.newBonFromSortie=function(){var L=this.lastSortie;if(!L)return;var s=L.site,now=new Date();
  var b={id:rid('bl'),no_bon:noBon('SA-'),client:s?s.nom:'',tel:'',adresse:s?s.addr:'',date:iso(now),heure:hhmm(now),technicien:this.me.nom,urgent:false,status:'brouillon',
    items_liv:L.items.map(function(i){return{item:i.nom,qteSortie:String(i.qty),unite:i.unite,qteLivree:String(i.qty),statut:''};}),items_ret:[],photos:[],created_by:this.user.id,created_at:now.toISOString(),_new:true};
  this.bons=[b].concat(this.bons);this.lastSortie=null;this.openBon(b.id);};
Comp.prototype.openBon=function(id){this._sig={strokes:[],w:0};this.setState({bonSel:id,signer:'',logTab:'bon'});};
Comp.prototype.curBon=function(){var id=this.state.bonSel;return id?this.bons.filter(function(b){return b.id===id;})[0]||null:null;};
Comp.prototype.clearSig=function(){this._sig.strokes=[];this.drawSig(true);this.update();};
Comp.prototype.drawSig=function(force){var c=this.sigRef.current;if(!c)return;var w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;
  if(!force&&c.width===w*2&&c.height===h*2)return;c.width=w*2;c.height=h*2;var g=c.getContext('2d');g.setTransform(2,0,0,2,0,0);g.clearRect(0,0,w,h);
  g.lineWidth=2.5;g.lineCap='round';g.lineJoin='round';g.strokeStyle=getComputedStyle(c).color||'#000';
  this._sig.strokes.forEach(function(s){g.beginPath();s.forEach(function(p,i){if(i)g.lineTo(p[0],p[1]);else g.moveTo(p[0],p[1]);});g.stroke();});};
/* Le rendu (morphing) retire les attributs width/height du canvas : on redessine les traits après chaque mise à jour. */
Comp.prototype.bindSig=function(){var self=this,c=this.sigRef.current;if(!c)return;this.drawSig(false);if(c.__sa)return;c.__sa=true;var cur=null;
  var pt=function(e){var r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
  c.addEventListener('pointerdown',function(e){if(self.curBon()&&self.curBon().status==='livre')return;c.setPointerCapture(e.pointerId);cur=[pt(e)];self._sig.strokes.push(cur);});
  c.addEventListener('pointermove',function(e){if(!cur)return;cur.push(pt(e));var g=c.getContext('2d'),n=cur.length;g.beginPath();g.moveTo(cur[n-2][0],cur[n-2][1]);g.lineTo(cur[n-1][0],cur[n-1][1]);g.stroke();});
  var end=function(){if(cur){cur=null;self.update();}};c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);};
Comp.prototype.confirmSig=function(){var b=this.curBon();if(!b)return;var nom=String(this.state.signer||'').trim();
  if(!nom){this.flash('Inscrivez le nom du signataire');return;}if(!this._sig.strokes.some(function(s){return s.length>1;})){this.flash('Faites signer dans le cadre');return;}
  var c=this.sigRef.current,out=document.createElement('canvas');out.width=c.width;out.height=c.height;var g=out.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,out.width,out.height);g.drawImage(c,0,0);
  var now=new Date(),ph={data:out.toDataURL('image/jpeg',0.7),name:'Signature — '+nom,addedBy:this.user.id,addedAt:now.toISOString()};
  var patch={status:'livre',livre_at:now.toISOString(),livre_by:this.user.id,livre_par_nom:this.me.nom,photos:(b.photos||[]).concat([ph]),updated_at:now.toISOString()};
  if(b._new){var full=Object.assign({},b,patch,{_t:'bons_livraison'});delete full._new;delete full._signedBy;delete full._signedAt;this.enqueue(full);}
  else this.enqueue({_t:'bons_livraison',_m:'PATCH',_q:'id=eq.'+encodeURIComponent(b.id)+'&status=neq.livre',id:'bl-'+b.id,body:patch});
  Object.assign(b,patch,{_signedBy:nom,_signedAt:hhmm(now)});delete b._new;this.update();this.flash('Bon '+b.no_bon+' marqué livré');};

/* ---------- Hivernage : liste de contrôle du pré-hivernage → rapport (brouillon) que le bureau complète dans SA Platform ---------- */
var HIV_CHECKS=['Niveau d’eau abaissé sous les retours','Conduites purgées à l’air comprimé','Bouchons d’hivernage installés','Antigel versé dans les conduites','Pompe et filtre vidangés','Équipements amovibles rentrés','Couverture d’hiver installée et tendue'];
var HIV_ETATS=[['Bon',''],['À surveiller','modere'],['Réparation requise','urgent']];
Comp.prototype.hivSites=function(){return REF.list.filter(function(s){return s.type!=='SP'&&s.type!=='MI';});};
Comp.prototype.sendHiv=function(){var st=this.state,sid=st.hivSel,s=sid&&siteById(sid);if(!s)return;var ck=st.hivChecks[sid]||{},now=new Date(),y=now.getFullYear();
  var etat=st.hivEtat[sid]||'Bon',tag=(HIV_ETATS.filter(function(e){return e[0]===etat;})[0]||['',''])[1],ant=st.hivAntigel[sid]||0,note=String(st.hivNote[sid]||'').trim();
  this.enqueue({_t:'rapports_hivernage',id:rid('hv'),site_id:s.id,site_nom:s.nom,client:'',objet:'Pré-hivernage '+y,titre:'Rapport de pré-hivernage',sous_titre:'',date_rapport:iso(now),date_inspection:iso(now),
    prepare_par:this.me.nom,technicien:this.me.nom,sections:[{id:rid('s'),title:'Pré-hivernage — liste de contrôle',tag:tag,items:HIV_CHECKS.map(function(l,i){return(ck[i]?'Fait — ':'Non fait — ')+l;}),photos:[]}],
    plan:[],suivi:[],timeline:{q1:'',q2:'',q3:'',q4:''},callout:'État général : '+etat+'. Antigel ajouté : '+ant+' L.'+(note?' '+note:''),signataire_sa:this.me.nom,signataire_client:'',
    status:'brouillon',created_by:this.user.id,created_at:now.toISOString(),updated_at:now.toISOString()});
  var o={};o[sid]=iso(now);this.setState(function(s2){return{hivSent:Object.assign({},s2.hivSent,o),screen:'hivernage'};});this.flash('Rapport envoyé au bureau — '+s.nom);};

/* ---------- Valeurs dérivées pour le gabarit ---------- */
Comp.prototype.vals=function(){
  var self=this,st=this.state,scr=st.screen,me=this;this.syncDerived();
  var titles={logistique:'Logistique',hivernage:'Hivernage',hivForm:'Hivernage',punchedit:'Corriger un punch',temps:'Temps',punchform:'Démarrer un punch',stopform:'Terminer la journée',demandes:'Demandes',comm:'Communications',commView:'Communication',today:'La Tournée',fiche:'Fiche technique',planning:'Planning',profil:'Profil',soon:st.soon||'Bientôt'};
  var cj=this.curJob();
  var jobs=this.jobs.map(function(j){var s=siteById(j.site)||pseudoSite(j.site,''),isDone=j.statut==='fait'||!!st.validated[j.site],isCur=!!cj&&cj.id===j.id&&!isDone;
    return Object.assign({},j,{nom:s.nom,ville:s.ville,typeCourt:TY(s.type).court,isDone:isDone,isCur:isCur,canPunch:!isDone&&!isCur,nodeBg:isDone?'var(--color-accent-700)':isCur?'var(--color-text)':'var(--color-bg)',op:isDone?0.6:1,fw:isCur?600:400,punch:function(){self.open(j.id);}});});
  var next=jobs.filter(function(j){return j.canPunch;})[0];
  var cur={},fields=[],checks=[],prods=[],ph=null;
  if(cj){var s=siteById(cj.site)||pseudoSite(cj.site,''),bl=s.interne?[]:(s.bassins||[]),bsel=bl.length?(bl.filter(function(x){return x.id===(st.bassinSel||{})[s.id];})[0]||bl[0]):null,T=TY(bsel?bsel.code:s.type),sid=bsel&&bl.length>1?s.id+'#'+bsel.id:s.id;
    if(sid!==s.id&&self.last[sid]===undefined)self.loadLast(sid);var vals=st.vals[sid]||{},tch=st.touched[sid]||{},lastRow=self.last[sid];
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
    if(s.interne){fields=[];checks=[];prods=[];}
    var I=window.SAInsp,PTS=s.interne?[]:I.pointsDuType(bsel?bsel.code:s.type,REF.cat,T.checks),ps=(st.pts||{})[sid]||{},acts=(st.acts||{})[sid]||{},vv0={};
    Object.keys(tch).forEach(function(k){if(vals[k]!=null)vv0[k]=vals[k];});
    var items=I.itemsVisite({type_code:bsel?bsel.code:s.type,vals:vv0,touched:tch,points:ps,actions:acts},T,REF.cat),se=I.etatsSystemes(items);
    var sysL=I.SYSTEMES.filter(function(x){return x.code==='eau'?fields.length>0:PTS.some(function(p){return p.systeme_code===x.code;});});
    var steps=['start'].concat(sysL.map(function(x){return x.code;})).concat(['resume']),step=(st.step||{})[sid]||'start';if(steps.indexOf(step)<0)step='start';
    var PZB={ok:['solid var(--color-text)','transparent'],watch:['solid var(--color-text)','repeating-linear-gradient(135deg,var(--color-text) 0 1.5px,transparent 1.5px 4px)'],action:['solid var(--color-accent-900)','var(--color-accent-900)'],na:['dashed var(--color-neutral-500)','transparent']};
    var sysDone=function(c){return c==='eau'?fields.every(function(f){return!!tch[f.key];}):PTS.filter(function(p){return p.systeme_code===c;}).every(function(p){return ps[p.id]&&ps[p.id].etat;});};
    var nSysDone=sysL.filter(function(x){return sysDone(x.code);}).length,missing=PTS.filter(function(p){return p.obligatoire&&!(ps[p.id]&&ps[p.id].etat);});
    var sysRows=sysL.map(function(x){var e=se[x.code],d=sysDone(x.code),n=x.code==='eau'?fields.length:PTS.filter(function(p){return p.systeme_code===x.code;}).length;
      return{nom:x.nom,icone:x.icone,lib:d||e!=='na'?I.LIB[e]:'',pzBd:PZB[e][0],pzBg:d||e!=='na'?PZB[e][1]:'transparent',txt:d?'Fait · '+I.LIB[e]:'À faire · '+n+' point'+(n>1?'s':''),go:function(){self.setStep(sid,x.code);}};});
    var sysCur=I.SYSTEMES.filter(function(x){return x.code===step;})[0]||{};
    var sysPts=PTS.filter(function(p){return p.systeme_code===step;}).map(function(p){var x=ps[p.id]||{},yn=p.mode==='ouinon',bad=x.etat==='watch'||x.etat==='action';
      var O=yn?[['ok','Oui'],['action','Non']]:[['ok','Conforme'],['watch','À surveiller'],['action','Action']];
      return{libelle:p.libelle,req:!!p.obligatoire&&!x.etat,isMesure:p.mode==='mesure',unite:p.unite||'',valeur:x.valeur==null?'':String(x.valeur),bad:bad,note:x.note||'',wo:!!x.wo,woBg:x.wo?'var(--color-text)':'transparent',
        notePh:yn?'Note obligatoire : que manque-t-il ?':'Note (ce qui a été constaté, ce qui reste à faire)',thumbs:(x.photos||[]).map(function(src){return{src:src};}),
        opts:O.map(function(o){var on=x.etat===o[0];return{label:o[1],on:on,bg:on?(o[0]==='action'?'var(--color-accent-900)':'var(--color-text)'):'transparent',fg:on?'#ffffff':'var(--color-text)',go:function(){self.setPt(sid,p.id,{etat:on?null:o[0]});}};}),
        onNote:function(e){self.setPt(sid,p.id,{note:e.target.value});},onVal:function(e){self.setPt(sid,p.id,{valeur:e.target.value.replace(',','.')});},
        addPhoto:function(){self.ptPhoto(sid,p.id);},toggleWo:function(){self.setPt(sid,p.id,{wo:!x.wo});}};});
    sysCur=Object.assign({},sysCur,{canAll:step!=='securite'&&sysPts.length>0,allOk:function(){self.setState(function(s2){var o=Object.assign({},s2.pts||{}),q=Object.assign({},o[sid]||{});PTS.filter(function(p){return p.systeme_code===step&&p.mode!=='ouinon';}).forEach(function(p){q[p.id]=Object.assign({},q[p.id]||{},{etat:'ok'});});o[sid]=q;return{pts:o};});}});
    var ACTS=['Chloration choc','Apport d’eau neuve','Signaler seulement'];
    fields.forEach(function(f){var src=(T.fields.filter(function(x){return x.key===f.key;})[0]||{}),L=Array.isArray(src.actions)&&src.actions.length?src.actions:ACTS;
      f.acts=L.map(function(a){var on=acts[f.key]===a;return{label:a,on:on,bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)',go:function(){self.setState(function(s2){var o=Object.assign({},s2.acts||{}),q=Object.assign({},o[sid]||{});q[f.key]=on?null:a;o[sid]=q;return{acts:o};});}};});});
    var si=steps.indexOf(step),nx=steps[si+1],nxS=I.SYSTEMES.filter(function(x){return x.code===nx;})[0];
    var nOut=fields.filter(function(f){return f.out;}).length,nT=fields.filter(function(f){return!f.pending;}).length,va=st.validated[sid];
    cur={isInterne:!!s.interne,isBassin:!s.interne,nom:s.nom,ville:s.ville,bassin:bsel?bsel.nom:s.bassin,hasBassins:bl.length>1,bassinChips:bl.length>1?bl.map(function(b){var on=b.id===bsel.id,k=s.id+'#'+b.id;return{label:b.nom+(st.validated[k]?' ✓':''),bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)',go:function(){var o={};o[s.id]=b.id;self.setState(function(s2){return{bassinSel:Object.assign({},s2.bassinSel||{},o)};});self.loadLast(k);}};}):[],contrat:s.contrat,hasContrat:!!s.contrat,typeLabel:s.interne?'Lieu de travail interne · aucun bassin':T.label+(s.type==='GEN'?' · valeurs par défaut':''),norme:s.interne?'Pas de relevé':T.norme,nFields:fields.length,nTouched:nT,nOut:nOut,hasOut:nOut>0,
      outBg:nOut?'var(--color-accent-900)':'transparent',outFg:nOut?'var(--color-bg)':'var(--color-text)',nChecks:checks.filter(function(c){return c.on;}).length,nChecksTotal:checks.length,
      isValidated:!!va,notValidated:!va,validAt:va,photoReq:T.photo,sid:sid,nSys:sysL.length,nSysDone:nSysDone,pct:sysL.length?nSysDone/sysL.length*100:0,reste:sysL.length-nSysDone?'reste '+(sysL.length-nSysDone)+' système'+(sysL.length-nSysDone>1?'s':''):'prêt à valider',syncTxt:st.sync[sid]==='ok'?'synchronisée avec le bureau':'en attente de réseau — sera envoyée automatiquement'};
    ph=st.photo[sid];
    cur._site=s;cur._T=T;cur._fields=fields;cur._checks=checks;cur._pts=PTS;cur._ps=ps;cur._acts=acts;cur._items=items;cur._missing=missing;
    var stepV={step:step,stStart:step==='start',stEau:step==='eau',stSys:step!=='start'&&step!=='eau'&&step!=='resume',stResume:step==='resume',notResume:step!=='resume',notStart:step!=='start',sysRows:sysRows,sysCur:sysCur,sysPts:sysPts,
      resumeTxt:I.resume(items),validateLbl:missing.length?missing.length+' point'+(missing.length>1?'s':'')+' à répondre':'Valider et envoyer',
      nextLbl:step==='start'?'Continuer : '+(nxS?nxS.nom:'Résumé'):'Suivant : '+(nxS?nxS.nom:'Résumé'),stepNext:function(){self.setStep(sid,nx||'resume');},stepBack:function(){self.setStep(sid,steps[Math.max(0,si-1)]);}};
  }
  var punchOn=!!(this.punch&&cj&&(String(this.punch.siteId)===cj.site||cj.id==='punch'));
  var days=this.days.length?this.days:[{dow:JOURS[new Date().getDay()].slice(0,3),num:dnum(new Date()),title:'Aujourd’hui',items:[]}];
  var dsel=days[Math.min(st.planDay,days.length-1)];
  var recMap={};days.forEach(function(d){d.items.forEach(function(it){if(it[3]&&!recMap[it[1]+it[2]]){var s=siteById(it[1]);recMap[it[1]+it[2]]={nom:s?s.nom:'—',rec:it[3]+' · '+it[2]};}});});
  var segStyle=function(on){return{bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)'};};
  var tabOf={logistique:'today',hivernage:'today',hivForm:'today',punchedit:'temps',temps:'temps',punchform:'temps',stopform:'temps',today:'today',fiche:'fiche',planning:'planning',profil:'profil',soon:'demandes',demandes:'demandes'}[scr];
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
      tasks:(d.tasks||[]).map(function(t){return{h:t.start+(t.end?' → '+t.end:' → en cours'),lieu:t.lieu,dur:t.active?fmtMin(minsFrom(t.start,hhmm(nw))):fmtH(t.hrs||0),pend:t.pendingValidation?'À valider':'',edit:function(){self.openPunchEdit(i,t);}};})};})};
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

  // ---- Logistique
  var ls=this.logSiteObj(),sel=st.sortie,iq=norm(st.invQ),bon=this.curBon(),mine=norm(this.me.nom);
  var inventaire=this.inv.filter(function(p){return!iq||norm(p.nom).indexOf(iq)>=0||(sel[p.id]>0);}).map(function(p){var q=sel[p.id]||0,set=function(n){self.setState(function(s2){var o=Object.assign({},s2.sortie);o[p.id]=Math.max(0,n);return{sortie:o};});};
    return{nom:p.nom,unite:p.unite||'',qty:q,reste:p.qte==null?'—':fr(Math.round((Number(p.qte)-q)*100)/100),minus:function(){set(q-1);},plus:function(){set(q+1);}};});
  var sortieCount=this.inv.filter(function(p){return sel[p.id]>0;}).length;
  var bonList=this.bons.filter(function(b){return b.status!=='livre';}).map(function(b){var m=norm(b.technicien)===mine;return{_m:m,_d:b.date||'',no:b.no_bon||'—',client:b.client||'Client non précisé',sub:(b.date||'—')+(b.urgent?' · URGENT':'')+' · '+(m?'à vous':(b.technicien||'non assigné')),open:function(){self.openBon(b.id);}};})
    .sort(function(a,b){return(b._m-a._m)||a._d.localeCompare(b._d);});
  var logV={isLog:scr==='logistique',isSortie:st.logTab==='sortie',isBon:st.logTab==='bon',tabSortie:function(){self.setState({logTab:'sortie'});},tabBon:function(){self.setState({logTab:'bon'});},
    sortieTabBg:segStyle(st.logTab==='sortie').bg,sortieTabFg:segStyle(st.logTab==='sortie').fg,bonTabBg:segStyle(st.logTab==='bon').bg,bonTabFg:segStyle(st.logTab==='bon').fg,
    logSite:ls?ls.nom:'aucun site (pas de punch en cours)',inventaire:inventaire,noInv:!this.inv.length,sortieCount:sortieCount,saveSortie:function(){self.saveSortie();},invQ:st.invQ,onInvQ:function(e){self.setState({invQ:e.target.value});},
    bonPick:!bon,bonOpen:!!bon,bonList:bonList,noBons:!bonList.length,hasLastSortie:!!this.lastSortie,lastSortieTxt:this.lastSortie?(this.lastSortie.items.length+' article(s) · '+(this.lastSortie.site?this.lastSortie.site.nom:'hors site')):'',newBon:function(){self.newBonFromSortie();},
    bon:bon?{no:bon.no_bon||'—',client:bon.client||'—',addr:bon.adresse||''}:{},bonBack:function(){self.setState({bonSel:null});self.loadLog();},
    bonItems:bon?(bon.items_liv||[]).filter(function(i){return i.item;}).map(function(i){return{nom:i.item,qty:i.qteLivree||i.qteSortie||'—',unite:i.unite||''};}):[],
    signer:st.signer,onSigner:function(e){self.setState({signer:e.target.value});},clearSig:function(){self.clearSig();},confirmSig:function(){self.confirmSig();},
    isSigned:!!(bon&&bon.status==='livre'),notSigned:!!(bon&&bon.status!=='livre'),signedBy:bon?(bon._signedBy||''):'',signedAt:bon?(bon._signedAt||''):''};
  // ---- Hivernage
  var hs=this.hivSites(),rep=this.hivRep,sent=st.hivSent,y=String(new Date().getFullYear());
  var hivDone=function(s){var r=rep[s.id];return r?(r.date_inspection||''):(sent[s.id]&&String(sent[s.id]).slice(0,4)===y?sent[s.id]:'');};
  var hivDoneCount=hs.filter(function(s){return!!hivDone(s);}).length,hf=st.hivFilter;
  var HF=[['todo','À faire'],['done','Faits'],['all','Tous']];
  var hivSel=st.hivSel&&siteById(st.hivSel),hck=hivSel?(st.hivChecks[hivSel.id]||{}):{};
  var setH=function(key,val){var o={};o[hivSel.id]=val;self.setState(function(s2){var r={};r[key]=Object.assign({},s2[key],o);return r;});};
  var hivV={isHiv:scr==='hivernage',isHivForm:scr==='hivForm'&&!!hivSel,hivDoneCount:hivDoneCount,hivTotalSites:hs.length,
    hivCells:hs.map(function(s){return{bg:hivDone(s)?'var(--color-accent-700)':'transparent'};}),
    hivFilters:HF.map(function(f,i){var on=hf===f[0];return{label:f[1],go:function(){self.setState({hivFilter:f[0]});},bl:i?'1px solid var(--color-divider)':'none',bg:segStyle(on).bg,fg:segStyle(on).fg};}),
    hivList:hs.filter(function(s){var d=!!hivDone(s);return hf==='all'||(hf==='done'?d:!d);}).map(function(s){var d=hivDone(s);return{nom:s.nom,ville:s.ville||'—',statutTxt:d?'Fait le '+d:'À faire',icon:d?'check':'right',open:function(){self.setState({hivSel:s.id,screen:'hivForm'});}};}),
    hivSite:hivSel?{nom:hivSel.nom,ville:hivSel.ville||'—'}:{},
    hivChecks:HIV_CHECKS.map(function(l,i){return{label:l,on:!!hck[i],box:hck[i]?'var(--color-text)':'transparent',toggle:function(){var o=Object.assign({},hck);o[i]=!hck[i];setH('hivChecks',o);}};}),
    hivProgress:HIV_CHECKS.filter(function(l,i){return hck[i];}).length,hivTotal:HIV_CHECKS.length,hivAntigel:hivSel?(st.hivAntigel[hivSel.id]||0):0,
    antigelMinus:function(){setH('hivAntigel',Math.max(0,(st.hivAntigel[hivSel.id]||0)-1));},antigelPlus:function(){setH('hivAntigel',(st.hivAntigel[hivSel.id]||0)+1);},
    hivEtats:HIV_ETATS.map(function(e){var on=hivSel&&(st.hivEtat[hivSel.id]||'Bon')===e[0];return{label:e[0],go:function(){setH('hivEtat',e[0]);},bg:segStyle(on).bg,fg:segStyle(on).fg,dot:on?'var(--color-bg)':'transparent'};}),
    hivNoteTxt:hivSel?(st.hivNote[hivSel.id]||''):'',onHivNote:function(e){setH('hivNote',e.target.value);},sendHiv:function(){self.sendHiv();}};
  // ---- Correction de punch
  var pe=st.pe,setPe=function(k){return function(e){var o={};o[k]=e.target.value;self.setState({pe:Object.assign({},st.pe,o,{confirm:false})});};};
  var peV={isPunchEdit:scr==='punchedit'&&!!pe,pe:pe?{lieu:pe.lieu,start:pe.start,end:pe.end,active:pe.active,onLieu:setPe('lieu'),onStart:setPe('start'),onEnd:setPe('end'),
    delLabel:pe.confirm?'Confirmer la suppression':'Supprimer ce punch',save:function(){self.savePunchEdit();},del:function(){self.deletePunch();},cancel:function(){self.setState({pe:null,screen:'temps'});}}:{}};
  // ---- Photo jointe à une demande
  var CL={infolettre:'Infolettre',information:'Information',lettre:'Lettre',procedure:'Procédure'},cms=(this.comm||[]).slice().sort(function(a,b){return(b.epingle?1:0)-(a.epingle?1:0)||String(b.date_pub||'').localeCompare(String(a.date_pub||''));}),
    nUnread=cms.filter(function(c){return self.commUnread(c);}).length,cv=st.commId?cms.filter(function(c){return c.id===st.commId;})[0]:null;
  var commV={isComm:scr==='comm',isCommView:scr==='commView'&&!!cv,commUnread:nUnread,hasCommUnread:nUnread>0,commBanner:nUnread+' communication'+(nUnread>1?'s':'')+' à lire',goComm:function(){self.go('comm');},
    commNone:this.comm!==undefined&&this.comm!==null&&!cms.length,commLoading:!this.comm,
    commList:cms.map(function(c){var un=self.commUnread(c);return{titre:(c.epingle?'📌 ':'')+c.titre,sub:CL[c.type]+(c.reference?' · '+c.reference:'')+(c.type==='procedure'?' · version '+(c.version||1):'')+' · '+fd(c.date_pub),resume:c.resume||'',isNew:un,newLbl:c.confirmation?'À confirmer':'Nouveau',fw:un?700:400,
      open:function(){self.setState({commId:c.id});self.go('commView');if(!c.confirmation)self.commRead(c);}};}),
    cv:cv?{titre:cv.titre,meta:CL[cv.type]+(cv.reference?' · '+cv.reference:'')+(cv.type==='procedure'?' · version '+(cv.version||1):'')+' · '+fd(cv.date_pub)+(cv.auteur_nom?' · '+cv.auteur_nom:''),resume:cv.resume||'',hasResume:!!cv.resume,
      isNews:cv.type==='infolettre',notNews:cv.type!=='infolettre',contenu:cv.contenu||'',secs:(Array.isArray(cv.sections)?cv.sections:[]).filter(function(x){return String(x.texte||'').trim();}),
      mustConfirm:!!cv.confirmation&&self.commUnread(cv),confirmed:!!cv.confirmation&&!self.commUnread(cv),confLbl:cv.type==='procedure'?'J’ai lu et compris cette procédure':'J’ai lu',
      confirm:function(){self.commRead(cv);self.flash('Lecture confirmée — merci');self.update();}}:{},
    commBack:function(){self.go('comm');}};
  var demV={demPhotoLbl:st.demPhoto?'Photo jointe · retirer':'Joindre une photo',demPhotoBtn:function(){if(st.demPhoto)self.setState({demPhoto:null});else self.pickImage(function(d){self.setState({demPhoto:d});});}};
  var nowD=new Date(),sun=this.prefs.sun,big=this.prefs.big;
  return Object.assign(logV,hivV,peV,demV,commV,{
    rootRef:this.rootRef,contentRef:this.contentRef,sigRef:this.sigRef,
    toggleSun:function(){self.setPref('sun');},toggleBig:function(){self.setPref('big');},
    sunLabel:sun?'activé':'désactivé',sunBtnBg:sun?'var(--color-text)':'transparent',sunBtnFg:sun?'var(--color-bg)':'var(--color-text)',
    sunJustify:sun?'flex-end':'flex-start',sunTrack:sun?'var(--color-text)':'transparent',sunKnob:sun?'var(--color-bg)':'var(--color-text)',
    bigJustify:big?'flex-end':'flex-start',bigTrack:big?'var(--color-text)':'transparent',bigKnob:big?'var(--color-bg)':'var(--color-text)',
    hasToast:!!st.toast,toast:st.toast,headerTitle:scr==='today'?bonjour(this.user.prenom):(titles[scr]||'La Tournée'),
    syncLbl:(this.online&&this.sendErr)?'⚠ '+cap(this.sendErr):(this.online&&Object.keys(this.loadErr).length)?'⚠ Données incomplètes : '+Object.keys(this.loadErr).map(function(k){return self.loadErr[k];}).join(', '):this.online?((this.queueN+opsN)?(this.queueN+opsN)+' envoi(s) en attente':'Connecté · synchro '+(this.syncAt?hhmm(this.syncAt):'—')):'Hors-ligne · '+this.queueN+' fiche(s) en attente',
    isToday:scr==='today',isTemps:scr==='temps',isPunchForm:scr==='punchform',isStopForm:scr==='stopform',pn:pn,pf:pf,sf:sf,isFiche:scr==='fiche'&&!!cj,isFicheEmpty:scr==='fiche'&&!cj,isDem:scr==='demandes',isPlan:scr==='planning',isProfil:scr==='profil',isSoon:scr==='soon',soonTitle:st.soon,
    goToday:function(){self.closeFiche();},goFiche:function(){self.go('fiche');},goLog:function(){self.go('logistique');},goHiv:function(){self.go('hivernage');},goDemandes:function(){self.go('demandes');},demTypes:demTypes,hasComposer:!!cd,composer:composer,composerSite:cj?(cur.nom||'—'):'Aucun (hors site)',closeComposer:function(){self.setState({demande:null});},demandeTxt:st.demandeTxt,onDemTxt:function(e){self.setState({demandeTxt:e.target.value});},demHist:demHist,
    sendDemande:function(){if(!st.demande)return;var t=DT[st.demande],txt=[st.demChip,st.demandeTxt].filter(Boolean).join(' — ')||t.label,s=cj?(cur._site||siteById(cj.site)):null,now=new Date();
      var rec={_t:'demandes',id:self.user.id+'-'+now.getTime(),site_id:s?s.id:null,site_nom:s?s.nom:null,tech:self.user.id,tech_nom:self.me.nom,type:t.label,motif:st.demChip||null,texte:txt,statut:'Envoyée',photo:st.demPhoto||null};
      self.dem=[{type:t.label,texte:txt,statut:navigator.onLine?'Envoyée':'En attente de réseau',created_at:now.toISOString()}].concat(self.dem);self.setState({demande:null,demChip:null,demandeTxt:'',demPhoto:null});self.enqueue(rec);self.flash(t.urgent?'Urgence envoyée — appelez aussi le bureau':'Demande envoyée au bureau');},
    todayTxt:JOURS[nowD.getDay()]+' '+dnum(nowD)+' '+MOIS[nowD.getMonth()],
    jobs:jobs,jobCount:jobs.length,doneTxt:(function(n){return n+(n>1?' faits':' fait');})(jobs.filter(function(j){return j.isDone;}).length),emptyDay:!jobs.length&&!cj,
    hasPunch:!!cj,noPunch:!cj&&!!next,punchAt:cj&&this.punch?this.punch.start:'',
    punchLbl:punchOn?'Punché depuis '+this.punch.start:'Fiche ouverte · aucun punch actif',punchShort:punchOn?'Punché à '+this.punch.start:'Aucun punch actif',
    punchElapsed:(punchOn&&this.punch.start)?(function(){var p=self.punch.start.split(':'),m=(nowD.getHours()*60+nowD.getMinutes())-(+p[0]*60+ +p[1]);if(m<0)return'';return m>=60?Math.floor(m/60)+' h '+pad(m%60):m+' min';})():'',
    nextJob:next?{punchHere:function(){var jj=self.jobs.filter(function(x){return x.id===next.id;})[0];self.openPunchForm(jj);},nom:next.nom,h:next.h||'sans heure',ville:next.ville,punch:next.punch}:{},
    depunch:function(){self.closeFiche();},cur:cur,fields:fields,checks:checks,prods:prods,stStart:false,stEau:false,stSys:false,stResume:false,notResume:true,sysRows:[],sysCur:{},sysPts:[],
    noteTxt:cj?(st.notes[cur.sid]||''):'',onNote:function(e){var v=e.target.value;if(!cj)return;self.setState(function(s2){var o={};o[cur.sid]=v;return{notes:Object.assign({},s2.notes,o)};});},
    takePhoto:function(){if(cj)self.pickPhoto(cur.sid);},
    photoTitle:ph?'Photo prise à '+ph:'Prendre la photo',photoSub:ph?'Toucher pour reprendre':'Requise : '+(cur.photoReq||''),
    photoBg:ph?'repeating-linear-gradient(135deg,var(--color-accent-200) 0 1px,transparent 1px 8px)':'transparent',
    validate:function(){if(!cj)return;var s=cur._site,T=cur._T,k=cur.sid,vv=st.vals[k]||{},tt=st.touched[k]||{},vout={},ch={},pr={};
      if(s.interne){self.flash('Bureau / entrepôt : aucun relevé à faire ici');return;}
      var I=window.SAInsp,ps=cur._ps,PTS=cur._pts,nPts=Object.keys(ps).filter(function(id){return ps[id]&&ps[id].etat;}).length;
      if(cur._missing.length){self.flash(cur._missing.length+' point(s) obligatoire(s) à répondre : '+cur._missing.map(function(p){return p.libelle;}).join(', '));self.setStep(k,cur._missing[0].systeme_code);return;}
      var sansNote=PTS.filter(function(p){var x=ps[p.id];return p.mode==='ouinon'&&x&&x.etat==='action'&&!String(x.note||'').trim();});
      if(sansNote.length){self.flash('« Non » exige une note : '+sansNote[0].libelle);self.setStep(k,sansNote[0].systeme_code);return;}
      if(!cur.nTouched&&!nPts&&!String(st.notes[k]||'').trim()){self.flash('Aucune mesure saisie — mesurez au moins une valeur, ou écrivez une note (ex. bassin fermé)');return;}
      Object.keys(tt).forEach(function(k){if(vv[k]!=null)vout[k]=vv[k];});
      PTS.forEach(function(p){ch[p.libelle]=!!(ps[p.id]&&ps[p.id].etat==='ok');});T.produits.forEach(function(p,i){var q=(st.prods[k]||{})[i]||0;if(q>0)pr[p[0]]=q;});
      var bs=s.bassins||[],b=bs.length>1?bs.filter(function(x){return k===s.id+'#'+x.id;})[0]:(bs[0]||null);
      var now=new Date(),rec={_sk:k,id:self.user.id+'-'+self.today+'-'+s.id+(bs.length>1&&b?'-'+b.id:''),site_id:s.id,site_nom:s.nom,tech:self.user.id,tech_nom:self.me.nom,date:self.today,heure:hhmm(now),type_code:b?b.code:s.type,bassin:b?b.nom:null,
        vals:vout,touched:tt,checks:ch,prods:pr,note:st.notes[k]||null,photo:st.photoData[k]||null,hors_zone:cur.nOut};
      /* Visite par système : états des points, mesures prises, résumé ; bon de travail urgent créé pour les points cochés */
      var pout={},aout={},wos=[];PTS.forEach(function(p){var x=ps[p.id];if(!x||!x.etat)return;var o={etat:x.etat};if(x.note)o.note=x.note;if(x.valeur!=null&&x.valeur!=='')o.valeur=x.valeur;if(x.photos&&x.photos.length)o.photos=x.photos;
        if(x.wo&&(x.etat==='watch'||x.etat==='action')){o.wo_id='wo-insp-'+rec.id+'-'+p.id;wos.push({id:o.wo_id,client:s.nom,site:s.addr||s.nom,type:'réparation',priorite:'urgent',status:'ouvert',date:self.today,assigne:'',
          descr:'Inspection '+(b?b.nom+' · ':'')+I.NOM[p.systeme_code]+' : '+p.libelle+(x.note?' — '+x.note:''),created_by:self.user.id,created_at:now.toISOString(),updated_at:now.toISOString()});}
        pout[p.id]=o;});
      cur._fields.forEach(function(f){if(f.out&&cur._acts[f.key])aout[f.key]=cur._acts[f.key];});
      Object.assign(rec,{points:pout,actions:aout,statut:'publiee',source:'terrain',resume:I.resume(cur._items),publiee_le:now.toISOString()});
      var va={};va[k]=hhmm(now);if(k!==s.id&&bs.every(function(x){var kk=s.id+'#'+x.id;return kk===k||st.validated[kk];}))va[s.id]=hhmm(now);self.setState(function(s2){return{validated:Object.assign({},s2.validated,va)};});self.enqueue(rec);wos.forEach(function(w){self.enqueue(Object.assign({_t:'workorders'},w));});
      self.flash(navigator.onLine?'Fiche enregistrée':'Fiche enregistrée — sera envoyée au retour du réseau');},
    planDays:days.map(function(d,i){return Object.assign({dow:d.dow,num:d.num,go:function(){self.setState({planDay:i});}},segStyle(st.planDay===i));}),
    planTitle:dsel.title,planItems:dsel.items.map(function(it){var s=siteById(it[1])||pseudoSite(it[1],'');return{h:it[0]||'—',nom:s.nom,ville:s.ville,tache:it[2],rec:it[3]};}),recurrences:Object.keys(recMap).map(function(k){return recMap[k];}),
    myWeek:this.hours==null?'—':fr(Math.round(this.hours*100)/100),me:this.me,queueLbl:this.queueN?this.queueN+' fiche(s) à envoyer':'Rien en attente',
    bureauTel:String(this.bureau||'').replace(/[^\d+]/g,''),logout:function(){localStorage.removeItem('sa_terrain_user');location.reload();},
    tabs:TABS.map(function(t){return{label:t[1],icon:t[2],go:function(){self.go(t[0]);},fg:tabOf===t[0]?'var(--color-text)':'var(--color-neutral-600)',fw:tabOf===t[0]?600:400,bar:tabOf===t[0]?'inset 0 3px 0 var(--color-text)':'none',dot:t[0]==='fiche'&&!!cj};})
  },stepV||{});};
Comp.prototype.update=function(){if(!this._host)return;SARender(document.getElementById('tpl'),this._host,this.vals());this.applyTheme();this.bindSig();};
/* Mot de bienvenue : « Bonjour Kaël » en tête de la tournée ; écran d'accueil au logo juste après la connexion */
function bonjour(p){var h=new Date().getHours();return(h<12?'Bonjour':h<18?'Bon après-midi':'Bonsoir')+(p?' '+p:'');}
function bienvenue(u){var f=false;try{f=localStorage.getItem('sa_terrain_bienvenue')==='1';localStorage.removeItem('sa_terrain_bienvenue');}catch(e){}if(!f)return;
  var lg=document.querySelector('#login .logo'),d=new Date(),el=document.createElement('div');el.id='welcome';el.setAttribute('role','status');
  el.innerHTML=(lg?'<img alt="Soucy Aquatik" src="'+lg.getAttribute('src')+'">':'')+'<h1></h1><div style="font-size:18px"></div><div style="font-size:15px;opacity:.85">Bonne journée sur la tournée !</div>';
  el.querySelector('h1').textContent='Bienvenue'+(u.prenom?', '+u.prenom:'')+'\u00a0!';el.querySelector('h1+div').textContent=JOURS[d.getDay()]+' '+d.getDate()+' '+MOIS[d.getMonth()];
  var bye=function(){el.style.opacity='0';setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},500);};el.addEventListener('click',bye);document.body.appendChild(el);setTimeout(bye,2600);}
Comp.prototype.mount=function(host){var self=this;this._host=host;this.update();bienvenue(this.user);
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
      localStorage.setItem('sa_terrain_user',JSON.stringify({id:c.id,prenom:c.prenom,nom:c.nom,role:c.role,dept:c.dept,tel:c.tel,email:c.email||''}));try{localStorage.setItem('sa_terrain_bienvenue','1');}catch(x){}location.reload();
    }).catch(function(){err.textContent='Réseau indisponible — réessayez.';});};}
window.addEventListener('DOMContentLoaded',function(){
  var user=jget('sa_terrain_user',null);
  if(!user){showLogin();return;}
  document.getElementById('login').style.display='none';
  var c=new Comp(user);window.__terrain=c;c.mount(document.getElementById('app'));
});
})();
