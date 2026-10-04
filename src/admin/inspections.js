/* ---------- sa-admin › Inspections (refonte : 6 systèmes, rapport de visite, saisie bureau, bassins et plan, accès client) ----------
   Inséré dans app.js par assemble.py (même portée : get, rest, Comp, fdate, iso, norm, fr, qrData, escH, auditT…).
   Règles de calcul : src/inspection/model.js (window.SAInsp). Passation : docs/design_handoff_inspections_portail/README.md. */
var PFN=SB+'/functions/v1/portail';
function pfn(action,body,tok){return fetch(PFN,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},tok?{'x-portail-session':tok}:{}),body:JSON.stringify(Object.assign({action:action},body||{}))})
  .then(function(r){return r.json().catch(function(){return{ok:false,message:'HTTP '+r.status};});});}
var PZS={ok:'border:1.5px solid var(--color-text)',watch:'border:1.5px solid var(--color-text);background:repeating-linear-gradient(135deg,var(--color-text) 0 1.5px,transparent 1.5px 4px)',action:'border:1.5px solid var(--color-accent-900);background:var(--color-accent-900)',na:'border:1.5px dashed var(--color-neutral-500)'};
function pzSt(e,sz){sz=sz||12;return'display:inline-block;flex:none;box-sizing:border-box;width:'+sz+'px;height:'+sz+'px;'+(PZS[e]||PZS.na);}
var MK={ok:'border:1.5px solid var(--color-text);background:var(--color-bg)',watch:'border:1.5px solid var(--color-text);background:repeating-linear-gradient(135deg,var(--color-accent-200) 0 2px,var(--color-bg) 2px 5px)',action:'border:1.5px solid var(--color-accent-900);background:var(--color-accent-900);color:#ffffff',na:'border:1.5px dashed var(--color-neutral-500);background:var(--color-bg)'};
var DROIT_LIB={etat:'État des systèmes',releves:'Relevés du jour',rqep:'Registre RQEP',plans:'Plans',historique:'Historique',rapports:'Rapports de visite',interventions:'Interventions',exports:'Exports Excel',factures:'Factures'};
var SRCS=[['telephone','Relevé transmis par téléphone'],['correction','Correction'],['sans_reseau','Visite sans réseau'],['bureau','Saisie au bureau']];
function rid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function fdateL(s){if(!s)return'—';var p=String(s).slice(0,10).split('-');return(+p[2])+' '+MOIS[+p[1]-1]+' '+p[0];}
function num(v){if(v==null||v==='')return null;var n=parseFloat(String(v).replace(',','.'));return isNaN(n)?null:n;}

Comp.prototype.admTok=function(){var o=jget('sa_portail_admin',null);if(o&&o.t&&o.exp>Date.now())return o.t;return null;};
Comp.prototype.inspItems=function(r){return window.SAInsp.itemsVisite(r,this.T(r.type_code),this.D.cat||[]);};
/* Visites d'un site, plus récente d'abord ; chaque visite est rattachée à un bassin (le 1er bassin reprend les anciens relevés sans bassin) */
Comp.prototype.inspVisits=function(site){var self=this,b0=((site.bassins||[])[0]||{}).nom||'';
  return this.D.rel.filter(function(r){return r.site_id===site.id;}).map(function(r){return{r:r,date:r.date,bassin:r.bassin||b0,items:self.inspItems(r),pub:(r.statut||'publiee')==='publiee'};})
    .sort(function(a,b){return(b.date+(b.r.heure||'')).localeCompare(a.date+(a.r.heure||''));});};
Comp.prototype.inspSummary=function(site){var I=window.SAInsp,vis=this.inspVisits(site),last={},items=[];
  vis.forEach(function(v){if(v.pub&&!last[v.bassin])last[v.bassin]=v;});Object.keys(last).forEach(function(k){items=items.concat(last[k].items.map(function(i){return Object.assign({bassin:k,_v:last[k]},i);}));});
  var se=I.etatsSystemes(items),lastV=vis.filter(function(v){return v.pub;})[0]||null;
  return{vis:vis,last:last,items:items,se:se,pz:I.pastilles(se),score:I.score(items),lastV:lastV};};

Comp.prototype.admOpen=function(){var self=this,pw=this.state.iqPw||'';if(!pw){this.setState({iqAdminErr:'Entrez votre mot de passe.'});return;}
  this.setState({iqAdminErr:'Vérification…'});
  pfn('admin_ouvrir',{id:this.user.id,mdp:pw}).then(function(r){if(!r.ok){self.setState({iqAdminErr:r.message||'Refusé.'});return;}
    try{localStorage.setItem('sa_portail_admin',JSON.stringify({t:r.session,exp:Date.now()+11.5*36e5}));}catch(e){}
    self.setState({iqPw:'',iqAdminErr:''});self.admLoad();}).catch(function(){self.setState({iqAdminErr:'Service injoignable — réessayez.'});});};
Comp.prototype.admLoad=function(){var self=this,t=this.admTok();if(!t){this.adm=null;this.update();return Promise.resolve();}
  return pfn('admin_lire',{},t).then(function(r){if(!r.ok){if(r.session===false){try{localStorage.removeItem('sa_portail_admin');}catch(e){}}self.adm=null;self.update();return;}self.adm=r;self.update();})
    .catch(function(){self.adm=null;self.update();});};
Comp.prototype.admWrite=function(table,row,del){var self=this,t=this.admTok();if(!t){this.flash('Session de gestion expirée — rouvrez-la dans « Accès client »');return Promise.resolve(false);}
  return pfn('admin_ecrire',del?{table:table,supprimer:true,id:row.id}:{table:table,row:row},t).then(function(r){if(!r.ok){self.flash('Refusé : '+(r.message||'erreur'));return false;}return self.admLoad().then(function(){return true;});});};
Comp.prototype.admUpload=function(file,dossier){var self=this,t=this.admTok();if(!t){this.flash('Ouvrez d’abord la gestion sécurisée (onglet « Accès client »)');return Promise.resolve(null);}
  if(file.size>15*1024*1024){this.flash('Fichier trop lourd (15 Mo maximum)');return Promise.resolve(null);}
  return pfn('admin_televerser',{nom:file.name,dossier:dossier},t).then(function(r){if(!r.ok||!r.url)throw new Error(r.message||'téléversement refusé');
    return fetch(r.url,{method:'PUT',headers:{'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:file}).then(function(x){if(!x.ok)throw new Error('HTTP '+x.status);return r.path;});})
    .catch(function(e){self.flash('Téléversement impossible : '+e.message);return null;});};
Comp.prototype.compteOf=function(site){return((this.adm&&this.adm.comptes)||[]).filter(function(c){return(c.sites||[]).map(String).indexOf(site.id)>=0;})[0]||null;};
Comp.prototype.inspTabsPref=function(v){var K='sa_admin_insp_onglets';
  try{if(v){localStorage.setItem(K,JSON.stringify(v));return v;}var p=JSON.parse(localStorage.getItem(K)||'null');if(p&&Array.isArray(p.ordre)&&Array.isArray(p.cache))return p;}catch(e){}
  return{ordre:[],cache:[]};};
Comp.prototype.voirClient=function(site,niveau){var t=this.admTok();if(!t){this.setState({inspView:'acces'});this.flash('Ouvrez la gestion sécurisée pour l’aperçu client');return;}
  var c=this.compteOf(site),u='portail/?apercu=1&site='+encodeURIComponent(site.id)+(c?'&compte='+encodeURIComponent(c.id):'')+'&niveau='+(niveau||'gestionnaire');
  var w=window.open(u,'_blank');if(!w)this.flash('Fenêtre bloquée — autorisez les fenêtres');};

/* ---------- saisie bureau (5a-2) ---------- */
Comp.prototype.isfNew=function(site,draft){var r=draft||null,b=(site.bassins||[])[0],me=this.user.id;
  var f={id:r?r.id:null,date:r?r.date:iso(new Date()),heure:r?r.heure||'':pad(new Date().getHours())+':'+pad(new Date().getMinutes()),tech:r?r.tech||me:me,src:r?r.source_detail||'telephone':'telephone',
    bassin:r?(r.bassin||(b&&b.nom)||''):(b?b.nom:''),vals:{},pts:{},note:r?r.note||'':'',envoyer:false};
  if(r){Object.keys(r.vals||{}).forEach(function(k){if(!r.touched||r.touched[k])f.vals[k]=String(r.vals[k]).replace('.',',');});Object.keys(r.points||{}).forEach(function(k){f.pts[k]=Object.assign({},r.points[k]);});}
  return f;};
Comp.prototype.isfSave=function(site,statut){var self=this,I=window.SAInsp,f=this.state.isf,D=this.D;if(!f||this.state.isfBusy)return;
  var b=(site.bassins||[]).filter(function(x){return x.nom===f.bassin;})[0]||null,code=b&&b.type_code&&D.types[b.type_code]?b.type_code:site.type,T=this.T(code);
  var PTS=I.pointsDuType(code,D.cat||[],T.checks),vals={},tch={},pts={},ch={};
  (T.fields||[]).forEach(function(x){var v=num(f.vals[x.key]);if(v!=null){vals[x.key]=v;tch[x.key]=true;}});
  PTS.forEach(function(p){var x=f.pts[p.id];ch[p.libelle]=!!(x&&x.etat==='ok');if(x&&x.etat){pts[p.id]={etat:x.etat};if(x.note)pts[p.id].note=x.note;}});
  if(statut==='publiee'){var miss=PTS.filter(function(p){return p.obligatoire&&!pts[p.id];});if(miss.length){this.flash(miss.length+' point(s) obligatoire(s) à répondre : '+miss.map(function(p){return p.libelle;}).join(', '));return;}
    var sn=PTS.filter(function(p){return p.mode==='ouinon'&&pts[p.id]&&pts[p.id].etat==='action'&&!pts[p.id].note;});if(sn.length){this.flash('« Non » exige une note : '+sn[0].libelle);return;}
    if(!Object.keys(vals).length&&!Object.keys(pts).length){this.flash('Rien à publier — saisissez au moins une mesure ou un point');return;}}
  var rec={type_code:code,vals:vals,touched:tch,points:pts},items=I.itemsVisite(rec,T,D.cat||[]),tech=(D.comptes.filter(function(c){return c.id===f.tech;})[0])||{},now=new Date().toISOString();
  var row={id:f.id||rid('bur-'),site_id:site.id,site_nom:site.nom,tech:f.tech,tech_nom:((tech.prenom||'')+' '+(tech.nom||'')).trim()||f.tech,date:f.date,heure:f.heure||null,type_code:code,bassin:(site.bassins||[]).length>1&&b?b.nom:(b?b.nom:null),
    vals:vals,touched:tch,checks:ch,prods:{},note:f.note||null,hors_zone:items.filter(function(i){return i.systeme==='eau'&&i.etat==='action';}).length,points:pts,actions:{},statut:statut,source:'bureau',
    source_detail:f.src,saisi_par:this.user.id,resume:I.resume(items),publiee_le:statut==='publiee'?now:null,updated_at:now};
  this.setState({isfBusy:true});
  rest('POST','releves',row,'resolution=merge-duplicates,return=minimal').then(function(){auditT(self,f.id?'UPDATE':'INSERT','releves',row.id,{saisie_bureau:true,statut:statut,source:f.src});
    var env=statut==='publiee'&&f.envoyer;self.setState({isf:null,isfBusy:false,inspView:'visite',inspVisite:row.id});self.flash(statut==='publiee'?'Visite publiée':'Brouillon enregistré');
    return self.reloadAll().then(function(){if(env)self.envoyerClient(site,row.id);});})
    .catch(function(e){self.setState({isfBusy:false});self.flash('Échec — rien n’a été enregistré : '+e.message);});};
Comp.prototype.envoyerClient=function(site,relId){var self=this,t=this.admTok(),c=this.compteOf(site);
  if(!t){this.setState({inspView:'acces'});this.flash('Ouvrez la gestion sécurisée pour envoyer au client');return;}
  if(!c){this.setState({inspView:'acces'});this.flash('Créez d’abord le compte client et ses contacts');return;}
  var cts=(this.adm.contacts||[]).filter(function(x){return x.compte_id===c.id&&x.actif!==false&&(x.niveau!=='operateur');}),r=this.D.rel.filter(function(x){return x.id===relId;})[0];
  var txt='Bonjour,\n\nLe rapport de la visite du '+fdateL(r&&r.date)+' à '+site.nom+' est disponible sur votre portail.\n\n'+(r?window.SAInsp.resume(this.inspItems(r),true):'');
  pfn('admin_envoyer',{releves:[relId],contacts:cts.map(function(x){return x.id;}),sujet:'Rapport de visite — '+site.nom,texte:txt},t).then(function(x){if(!x.ok){self.flash('Envoi refusé : '+(x.message||'erreur'));return;}
    if(r)r.envoyee_le=new Date().toISOString();
    if(x.aEnvoyer&&x.aEnvoyer.length)location.href='mailto:'+x.aEnvoyer.join(',')+'?subject='+encodeURIComponent('Rapport de visite — '+site.nom)+'&body='+encodeURIComponent(txt+'\n\nConsulter le rapport : '+x.portail);
    self.flash(x.envoyes&&x.envoyes.length?'Rapport publié et envoyé à '+x.envoyes.length+' contact(s)':(x.aEnvoyer&&x.aEnvoyer.length?'Rapport publié — courriel préparé dans votre logiciel':'Rapport publié sur le portail (aucun contact gestionnaire à aviser)'));self.update();});};
Comp.prototype.printVisite=function(site,v){var I=window.SAInsp,E=escH,se=I.etatsSystemes(v.items),r=v.r;
  var sec=I.SYSTEMES.filter(function(s){return se[s.code]!=='na';}).map(function(s){var its=v.items.filter(function(i){return i.systeme===s.code;});
    return'<h3>'+E(s.nom)+' — '+E(I.LIB_CLIENT[se[s.code]])+'</h3><table>'+its.map(function(i){return'<tr><td>'+E(i.libelle)+'</td><td>'+E([i.valeur,i.detail].filter(Boolean).join(' — '))+'</td><td><b>'+E(I.LIB_CLIENT[i.etat])+'</b></td></tr>';}).join('')+'</table>';}).join('');
  var h='<!doctype html><meta charset="utf-8"><title>Rapport de visite — '+E(site.nom)+'</title><style>body{font:14px/1.45 Barlow,Arial,sans-serif;margin:28px;color:#1d1f20}h1{font-size:26px;margin:0}h3{margin:18px 0 6px;font-size:17px;border-bottom:2px solid #749dc4}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #ddd;padding:5px 4px;vertical-align:top}</style>'
    +'<img src="'+window.SA_LOGO+'" alt="" style="height:48px;float:right"><h1>'+E(site.nom)+'</h1><div>Visite du '+E(fdateL(r.date))+(r.heure?', '+E(r.heure):'')+' · '+E(v.bassin)+' · '+E(r.tech_nom||'')+'</div><p style="font-size:16px">'+E(I.resume(v.items,true))+'</p>'+sec+'<p style="font-size:12px;margin-top:24px">Soucy Aquatik · rapport généré par sa-admin</p>';
  var w=window.open('','_blank');if(!w){this.flash('Fenêtre bloquée — autorisez les fenêtres pour imprimer');return;}w.document.write(h+'<script>setTimeout(function(){print();},300)<\/script>');w.document.close();auditT(this,'EXPORT','releves',r.id,{format:'rapport_visite'});};
Comp.prototype.printAffiche=function(site,q,nom,img){var E=escH;
  var h='<!doctype html><meta charset="utf-8"><title>Affiche QR — '+E(site.nom)+'</title><style>@page{size:letter;margin:18mm}body{font:16px Barlow,Arial,sans-serif;text-align:center;color:#1d1f20}h1{font:600 30px "Barlow Condensed",Arial;margin:8px 0}img.qr{width:5.5cm;height:5.5cm}</style>'
    +'<img src="'+window.SA_LOGO+'" alt="Soucy Aquatik" style="height:64px"><div style="margin-top:18px">Relevés et rapports de cette installation</div><h1>'+E(site.nom)+'</h1><div>'+E(nom)+'</div>'
    +'<p><img class="qr" src="'+img+'" alt="Code QR"></p><p>Scannez avec l’appareil photo de votre téléphone.</p><p style="font-size:13px">Accès réservé aux personnes autorisées par le gestionnaire de l’installation.</p>'
    +'<p style="margin-top:40px;font-size:14px;border-top:1px solid #999;padding-top:8px">Urgence 24/7 · Soucy Aquatik · '+E(q.code_affiche)+'</p>';
  var w=window.open('','_blank');if(!w){this.flash('Fenêtre bloquée — autorisez les fenêtres pour imprimer');return;}w.document.write(h+'<script>setTimeout(function(){print();},300)<\/script>');w.document.close();};
Comp.prototype.saveBassins=function(site,list,msg){var self=this,now=new Date().toISOString();
  return rest('PATCH','sites?id=eq.'+encodeURIComponent(site.id),{bassins:list,updated_at:now}).then(function(){site.bassins=list;auditT(self,'UPDATE','sites',site.id,{bassins:true});if(msg)self.flash(msg);self.update();})
    .catch(function(e){self.flash('Échec — rien n’a été modifié : '+e.message);});};
Comp.prototype.savePoint=function(p){var self=this;return rest('POST','inspection_points',Object.assign({},p,{updated_at:new Date().toISOString()}),'resolution=merge-duplicates,return=minimal')
  .then(function(){return get('inspection_points?select=*');}).then(function(c){self.D.cat=c;self.update();}).catch(function(e){self.flash('Échec — point non enregistré : '+e.message);});};

Comp.prototype.inspVals=function(){
  var self=this,st=this.state,D=this.D,I=window.SAInsp;
  if(!D||st.mod!=='inspections'||!I)return{isInspNew:false,iq:{h:{},f:{},v:{},cp:{},nc:{},nb:{},pc:{}},iqTabs:[]};
  var view=st.inspView||'bilan',sites=D.sites.filter(function(s){return!s.interne;});
  if(view==='acces'&&this.adm===undefined&&this.admTok()){this.adm=null;this.admLoad();}
  var sum={};sites.forEach(function(s){sum[s.id]=self.inspSummary(s);});
  var site=D.byId[st.inspSite]&&!D.byId[st.inspSite].interne?D.byId[st.inspSite]:sites[0];
  if(!site)return{isInspNew:view!=='tendances',isInspections:view==='tendances',iq:{h:{},f:{},v:{},cp:{},nc:{},nb:{},pc:{},sites:[],tabs:[]},iqTabs:[]};
  var S=sum[site.id],T=this.T(site.type),qq=norm(st.iqQ||'');
  var PZT={eau:'Eau',meca:'Mécanique',secu:'Sécurité',struct:'Structure'};
  var list=sites.filter(function(s){return!qq||norm(s.nom+' '+s.ville).indexOf(qq)>=0;}).sort(function(a,b){var x=sum[a.id],y=sum[b.id];return y.score-x.score||String(x.lastV?x.lastV.date:'0').localeCompare(String(y.lastV?y.lastV.date:'0'))||a.nom.localeCompare(b.nom,'fr');})
    .map(function(s){var x=sum[s.id],on=s.id===site.id;return{nom:s.nom,sub:[s.ville,self.T(s.type).court,x.lastV?fdate(x.lastV.date):'aucune visite'].filter(Boolean).join(' · '),bg:on?'var(--color-accent-100)':'transparent',bar:on?'inset 3px 0 0 var(--color-accent-700)':'none',
      pz:['eau','meca','secu','struct'].map(function(k){return{t:PZT[k]+' : '+I.LIB[x.pz[k]],st:pzSt(x.pz[k])};}),go:function(){self.setState({inspSite:s.id,inspVisite:null,isf:null,inspBassin:null});}};});
  var TABS=[['bilan','Bilan par système'],['visite','Visites'],['tendances','Tendances de l’eau'],['saisie','Nouvelle inspection'],['bassins','Bassins et plan'],['acces','Accès client'],['points','Points de contrôle']];
  var go=function(v){return function(){var p={inspView:v};if(v==='saisie'&&!st.isf)p.isf=self.isfNew(site);self.setState(p);if(v==='acces'||v==='bassins'){if(self.admTok()&&!self.adm)self.admLoad();}};};
  // Onglets personnalisables (ordre et visibilité), mémorisés sur ce navigateur
  var pref=this.inspTabsPref(),LIBT={};TABS.forEach(function(t){LIBT[t[0]]=t[1];});
  var ordre=pref.ordre.filter(function(k){return LIBT[k];}).concat(TABS.map(function(t){return t[0];}).filter(function(k){return pref.ordre.indexOf(k)<0;}));
  var vis=ordre.filter(function(k){return pref.cache.indexOf(k)<0||k===view;});
  var tabs=vis.map(function(k){return{label:LIBT[k],on:view===k,bd:view===k?'var(--color-accent-700)':'transparent',go:go(k)};});
  var perso=!!st.inspPerso,savePref=function(o,c){self.inspTabsPref({ordre:o,cache:c});self.setState({inspPrefV:(st.inspPrefV||0)+1});};
  var cp=this.compteOf(site),lv=S.lastV,nb=(site.bassins||[]).length;
  var iq={q:st.iqQ||'',onQ:function(e){self.setState({iqQ:e.target.value});},sites:list,tabs:tabs,
    perso:perso,persoLbl:perso?'Terminé':'Personnaliser',togglePerso:function(){self.setState({inspPerso:!perso});},
    persoRows:ordre.map(function(k,i){var cache=pref.cache.indexOf(k)>=0;return{label:LIBT[k],on:!cache,aria:'Afficher l’onglet '+LIBT[k],
      toggle:function(e){var c=pref.cache.filter(function(x){return x!==k;});if(!e.target.checked){if(ordre.length-c.length<=1){self.flash('Gardez au moins un onglet');return;}c.push(k);}savePref(ordre,c);},
      up:function(){if(!i)return;var o=ordre.slice();o.splice(i-1,0,o.splice(i,1)[0]);savePref(o,pref.cache);},
      down:function(){if(i>=ordre.length-1)return;var o=ordre.slice();o.splice(i+1,0,o.splice(i,1)[0]);savePref(o,pref.cache);},
      upDis:i===0,downDis:i===ordre.length-1};}),
    persoReset:function(){savePref([],[]);self.flash('Onglets réinitialisés');},isBilan:view==='bilan',isVisite:view==='visite',isSaisie:view==='saisie',isBassins:view==='bassins',isAcces:view==='acces',isPoints:view==='points',
    h:{nom:site.nom,type:T.label,contrat:site.contrat||'—',logo:cp&&cp.logo_url?cp.logo_url:'',sub:[cp?cp.nom:site.ville,nb>1?nb+' bassins':(nb?site.bassins[0].nom:'1 bassin'),lv?'dernière visite le '+fdateL(lv.date)+' par '+(lv.r.tech_nom||lv.r.tech):'aucune visite publiée'].filter(Boolean).join(' · ')},
    goRapport:go('visite'),goTend:go('tendances'),goSaisie:function(){self.setState({inspView:'saisie',isf:self.isfNew(site)});},voirClient:function(){self.voirClient(site);},
    hasVisit:!!(view==='visite'?S.vis.length:lv),noVisit:!(view==='visite'?S.vis.length:lv)};
  /* ----- 2a Bilan ----- */
  if(view==='bilan'){var c=I.compteurs(S.items);iq.verdict=I.verdict(S.items);
    iq.cpt=[{n:c.action,l:'actions requises',st:pzSt('action',14)},{n:c.watch,l:'à surveiller',st:pzSt('watch',14)},{n:c.ok,l:'conformes',st:pzSt('ok',14)}];
    var R={action:3,watch:2,ok:1,na:0};
    iq.cards=I.SYSTEMES.map(function(s){var its=S.items.filter(function(i){return i.systeme===s.code;}),e=S.se[s.code],bad=its.filter(function(i){return i.etat==='action'||i.etat==='watch';}).sort(function(a,b){return R[b.etat]-R[a.etat];});
      return{nom:s.nom,icone:s.icone,lib:I.LIB[e],pz:pzSt(e,13)+(e==='action'?';border-color:#ffffff;background:#ffffff':''),hbg:e==='action'?'var(--color-accent-900)':e==='watch'?'var(--color-accent-100)':'transparent',hfg:e==='action'?'#ffffff':'var(--color-text)',
        top:bad.slice(0,2).map(function(i){return{libelle:i.libelle,valeur:i.valeur,detail:[i.detail,nb>1?i.bassin:''].filter(Boolean).join(' · ')};}),rien:!bad.length,
        pied:its.length?(function(n){return n+(n>1?' points conformes':' point conforme')+' sur '+its.length;})(its.filter(function(i){return i.etat==='ok';}).length):'Aucun point relevé',go:go('visite')};});
    iq.todo=S.items.filter(function(i){return i.etat==='action'||i.etat==='watch';}).sort(function(a,b){return R[b.etat]-R[a.etat];}).map(function(i){
      return{pz:pzSt(i.etat),lib:I.LIB[i.etat],libelle:i.libelle,valeur:i.valeur,note:i.note||i.detail||'',sys:I.NOM[i.systeme],bassin:nb>1?i.bassin:'',hasWo:!!i.wo_id,noWo:!i.wo_id,
        mkWo:function(){var v=i._v,now=new Date().toISOString(),id='wo-insp-'+v.r.id+'-'+String(i.id).replace(/[^\w-]/g,'_');
          rest('POST','workorders',{id:id,client:site.nom,site:site.addr||site.nom,type:'réparation',priorite:i.etat==='action'?'urgent':'normal',status:'ouvert',date:iso(new Date()),assigne:'',descr:'Inspection '+(nb>1?v.bassin+' · ':'')+I.NOM[i.systeme]+' : '+i.libelle+(i.valeur?' '+i.valeur:'')+(i.note?' — '+i.note:''),created_by:self.user.id,created_at:now,updated_at:now},'resolution=ignore-duplicates,return=minimal')
            .then(function(){if(!String(i.id).indexOf('eau:'))return;var pts=Object.assign({},v.r.points||{});pts[i.id]=Object.assign({},pts[i.id]||{},{wo_id:id});v.r.points=pts;return rest('PATCH','releves?id=eq.'+encodeURIComponent(v.r.id),{points:pts,updated_at:now});})
            .then(function(){auditT(self,'INSERT','workorders',id,{depuis:'inspection'});self.flash('Bon de travail créé');return self.reloadAll();}).catch(function(e){self.flash('Échec : '+e.message);});}};});
    iq.noTodo=!iq.todo.length;}
  /* ----- 2b Visites ----- */
  if(view==='visite'){var cur=S.vis.filter(function(v){return v.r.id===st.inspVisite;})[0]||S.vis[0];
    var idx=list.map(function(x){return x.nom;}),sl=sites.slice().sort(function(a,b){return a.nom.localeCompare(b.nom,'fr');}),si=sl.indexOf(site);
    iq.prevSite=function(){var s=sl[(si-1+sl.length)%sl.length];self.setState({inspSite:s.id,inspVisite:null});};iq.nextSite=function(){var s=sl[(si+1)%sl.length];self.setState({inspSite:s.id,inspVisite:null});};
    iq.visites=S.vis.map(function(v){var on=v===cur,c=I.compteurs(v.items);return{date:fdate(v.date)+' '+(v.r.heure||''),txt:(c.action||c.watch?[c.action?c.action+' action'+(c.action>1?'s':''):'',c.watch?c.watch+' à surveiller':''].filter(Boolean).join(' · '):'Tout conforme')+(nb>1?' · '+v.bassin:''),
      tech:(v.r.tech_nom||v.r.tech||'')+(v.r.source==='bureau'?' · saisie bureau':''),brouillon:!v.pub,pz:pzSt(I.pire(v.items.map(function(i){return i.etat;}))),bg:on?'var(--color-accent-100)':'transparent',bar:on?'inset 3px 0 0 var(--color-accent-700)':'none',go:function(){self.setState({inspVisite:v.r.id});}};});
    if(cur){var prev=S.vis.filter(function(v){return v.bassin===cur.bassin&&v.pub&&(v.date+(v.r.heure||''))<(cur.date+(cur.r.heure||''));}),se=I.etatsSystemes(cur.items),R2={action:3,watch:2,ok:1,na:0},r=cur.r;
      var saisi=r.source==='bureau'?' · saisie bureau par '+(r.saisi_par||'?')+(r.source_detail?' ('+((SRCS.filter(function(x){return x[0]===r.source_detail;})[0]||[0,r.source_detail])[1])+')':''):'';
      var photos=[];if(r.photo)photos.push({src:r.photo,leg:'Vue d’ensemble'});cur.items.forEach(function(i){(i.photos||[]).forEach(function(p){photos.push({src:p,leg:i.libelle});});});
      iq.v={titre:'Visite du '+fdateL(r.date)+(r.heure?', '+r.heure:''),sub:(r.tech_nom||r.tech||'')+(r.publiee_le?' · validée à '+String(r.publiee_le).slice(11,16):'')+(nb>1?' · '+cur.bassin:'')+saisi+(cur.pub?'':' · BROUILLON'),
        resume:I.resume(cur.items)+(r.note?' Note : '+r.note:''),photos:photos,noPhoto:!photos.length,prods:Object.keys(r.prods||{}).map(function(k){return{nom:k,q:fr(r.prods[k],0.01)};}),noProd:!Object.keys(r.prods||{}).length,
        envoye:r.envoyee_le?'Envoyé au client le '+fdateL(r.envoyee_le)+' à '+String(r.envoyee_le).slice(11,16)+' (UTC)':'',brouillon:!cur.pub,
        envoyer:function(){self.envoyerClient(site,r.id);},pdf:function(){self.printVisite(site,cur);},editer:function(){self.setState({inspView:'saisie',isf:self.isfNew(site,r)});},
        sections:I.SYSTEMES.filter(function(s){return se[s.code]!=='na';}).sort(function(a,b){return R2[se[b.code]]-R2[se[a.code]];}).map(function(s){var its=cur.items.filter(function(i){return i.systeme===s.code;}),bad=its.filter(function(i){return i.etat!=='ok';}),e=se[s.code];
          var nOk=its.length-bad.length;
          return{nom:s.nom,icone:s.icone,lib:I.LIB[e],pz:pzSt(e),open:e!=='ok',closed:e==='ok',liste:its.map(function(i){return i.libelle;}).join(' · '),
            more:s.code==='eau'&&nOk?nOk+' autre'+(nOk>1?'s':'')+' paramètre'+(nOk>1?'s':'')+' dans la zone · afficher le tableau complet et les tendances →':'',
            rows:bad.map(function(i){return{libelle:i.libelle,valeur:i.valeur,detail:[i.detail!==i.note?i.detail:'',i.note].filter(Boolean).join(' — '),lib:I.LIB[i.etat],pz:pzSt(i.etat),tag:I.depuis(i.id,i.etat,prev,fdateL)+(i.wo_id?' · bon de travail':'')};})};})};}
    else iq.v={sections:[],photos:[],prods:[]};}
  /* ----- 5a-2 Saisie bureau ----- */
  var f=st.isf;
  if(view==='saisie'&&f){var b=(site.bassins||[]).filter(function(x){return x.nom===f.bassin;})[0]||null,code=b&&b.type_code&&D.types[b.type_code]?b.type_code:site.type,TT=this.T(code),PTS=I.pointsDuType(code,D.cat||[],TT.checks);
    var setF=function(p){self.setState(function(s2){return{isf:Object.assign({},s2.isf,p)};});},setP=function(id,p){var o=Object.assign({},f.pts);o[id]=Object.assign({},o[id]||{},p);setF({pts:o});};
    var vals={},tch={};(TT.fields||[]).forEach(function(x){var v=num(f.vals[x.key]);if(v!=null){vals[x.key]=v;tch[x.key]=true;}});
    var items=I.itemsVisite({type_code:code,vals:vals,touched:tch,points:f.pts},TT,D.cat||[]),se2=I.etatsSystemes(items);
    var techs=D.comptes.filter(function(c){return c.role!=='admin'||c.id===self.user.id;}).map(function(c){return{v:c.id,l:(c.prenom+' '+c.nom).trim(),sel:c.id===f.tech};});
    iq.f={date:f.date,heure:f.heure,onDate:function(e){setF({date:e.target.value});},onHeure:function(e){setF({heure:e.target.value});},techs:techs,onTech:function(e){setF({tech:e.target.value});},
      srcs:SRCS.map(function(x){return{v:x[0],l:x[1],sel:x[0]===f.src};}),onSrc:function(e){setF({src:e.target.value});},hasB:nb>1,bassins:(site.bassins||[]).map(function(x){return{v:x.nom,l:x.nom,sel:x.nom===f.bassin};}),onB:function(e){setF({bassin:e.target.value,pts:{}});},
      eau:(TT.fields||[]).map(function(x){var v=num(f.vals[x.key]),e=v==null?'na':I.etatEau(x,v);return{label:x.label+' · '+fr(x.lo,x.step)+'–'+fr(x.hi,x.step)+(x.unit?' '+x.unit:''),aria:x.label,v:f.vals[x.key]||'',bg:e==='action'?'var(--color-accent-900)':'transparent',fg:e==='action'?'#ffffff':'var(--color-text)',
        on:function(ev){var o=Object.assign({},f.vals);o[x.key]=ev.target.value;setF({vals:o});}};}),
      sys:I.SYSTEMES.filter(function(s){return s.code!=='eau'&&PTS.some(function(p){return p.systeme_code===s.code;});}).map(function(s){var ps=PTS.filter(function(p){return p.systeme_code===s.code;}),fait=ps.filter(function(p){return f.pts[p.id]&&f.pts[p.id].etat;}).length;
        return{nom:s.nom,icone:s.icone,open:fait<ps.length,txt:fait+'/'+ps.length+' · '+I.LIB[se2[s.code]],canAll:s.code!=='securite',allOk:function(){var o=Object.assign({},f.pts);ps.forEach(function(p){if(p.mode!=='ouinon')o[p.id]=Object.assign({},o[p.id]||{},{etat:'ok'});});setF({pts:o});},
          pts:ps.map(function(p){var x=f.pts[p.id]||{},yn=p.mode==='ouinon',O=yn?[['ok','Oui'],['action','Non']]:[['ok','Conforme'],['watch','À surveiller'],['action','Action']];
            return{libelle:p.libelle,req:!!p.obligatoire,bad:x.etat==='watch'||x.etat==='action',note:x.note||'',onNote:function(e){setP(p.id,{note:e.target.value});},
              opts:O.map(function(o){var on=x.etat===o[0];return{label:o[1],on:on,bg:on?(o[0]==='action'?'var(--color-accent-900)':'var(--color-text)'):'transparent',fg:on?'#ffffff':'var(--color-text)',go:function(){setP(p.id,{etat:on?null:o[0]});}};})};})};}),
      note:f.note,onNote:function(e){setF({note:e.target.value});},resume:I.resume(items),envoyer:!!f.envoyer,onEnvoyer:function(e){setF({envoyer:e.target.checked});},par:this.user.id,
      brouillon:function(){self.isfSave(site,'brouillon');},publier:function(){self.isfSave(site,'publiee');},publierLbl:st.isfBusy?'Enregistrement…':'Valider et publier'};
    iq.grille=I.DROITS.map(function(k){var g=function(n){return I.droits(n,cp&&cp.niveaux)[k]?'✓':'—';};return{l:DROIT_LIB[k],o:g('operateur'),g:g('gestionnaire'),d:g('direction')};});}
  else iq.f={};
  /* ----- 5a-1 Bassins et plan ----- */
  var adm=this.adm,docs=adm?(adm.documents||[]).filter(function(d){return d.site_id===site.id||(cp&&d.portee==='client'&&d.compte_id===cp.id);}):[];
  iq.needAdmin=!adm;iq.hasAdmin=!!adm;
  if(view==='bassins'){var plans=docs.filter(function(d){return d.type==='plan'&&/^image\//.test(d.mime||'');}),pl=plans.filter(function(d){return d.id===st.iqPlan;})[0]||plans[0]||null,drag=this._drag;
    iq.plans=plans.map(function(d){var on=d===pl;return{label:d.niveau_plan||d.titre,bg:on?'var(--color-text)':'transparent',fg:on?'var(--color-bg)':'var(--color-text)',go:function(){self.setState({iqPlan:d.id});}};});
    iq.planSrc=pl?pl.url:'';iq.noPlan=!pl;
    var bl=site.bassins||[],eB=function(b){var v=S.last[b.nom];return v?I.pire(v.items.map(function(i){return i.etat;})):'na';};
    iq.markers=pl?bl.map(function(b,i){var d=drag&&drag.id===String(b.id||b.nom)?drag:null,x=d?d.x:b.plan_doc===pl.id?b.plan_x:null,y=d?d.y:b.plan_doc===pl.id?b.plan_y:null;
      if(x==null){x=6+i*8;y=8;}return{id:String(b.id||b.nom),nom:b.nom,n:String(b.numero||i+1),x:x,y:y,st:MK[eB(b)]+(b.plan_doc===pl.id||d?'':';opacity:.55')};}):[];
    iq.planDown=function(e){var m=e.target.closest&&e.target.closest('[data-bassin]');if(!m||!pl)return;self._drag={id:m.getAttribute('data-bassin'),x:null,y:null,box:e.currentTarget.getBoundingClientRect()};try{e.currentTarget.setPointerCapture(e.pointerId);}catch(x){}};
    iq.planMove=function(e){var d=self._drag;if(!d)return;var r=d.box;d.x=Math.max(0,Math.min(100,Math.round((e.clientX-r.left)/r.width*1000)/10));d.y=Math.max(0,Math.min(100,Math.round((e.clientY-r.top)/r.height*1000)/10));self.update();};
    iq.planUp=function(){var d=self._drag;self._drag=null;if(!d||d.x==null){self.update();return;}
      self.saveBassins(site,bl.map(function(b){return String(b.id||b.nom)===d.id?Object.assign({},b,{plan_doc:pl.id,plan_x:d.x,plan_y:d.y}):b;}),'Position enregistrée');};
    iq.upPlan=function(e){var file=e.target.files&&e.target.files[0];e.target.value='';if(!file)return;var nv=window.prompt('Niveau du plan (ex. Niveau des bassins, Salle mécanique, Extérieur)','Niveau des bassins');if(nv===null)return;
      self.admUpload(file,'plans').then(function(path){if(!path)return;return self.admWrite('documents',{id:rid('doc-'),portee:'site',site_id:site.id,compte_id:cp?cp.id:null,titre:file.name,type:'plan',niveau_plan:nv,storage_path:path,mime:file.type,taille:file.size,visibilite:'operateur'}).then(function(ok){if(ok)self.flash('Plan ajouté');});});};
    iq.upDoc=function(e){var file=e.target.files&&e.target.files[0];e.target.value='';if(!file)return;
      self.admUpload(file,'docs').then(function(path){if(!path)return;return self.admWrite('documents',{id:rid('doc-'),portee:'site',site_id:site.id,compte_id:cp?cp.id:null,titre:file.name,type:/contrat/i.test(file.name)?'contrat':'autre',storage_path:path,mime:file.type,taille:file.size,visibilite:'interne'}).then(function(ok){if(ok)self.flash('Document ajouté — visible à l’interne seulement');});});};
    var VIS=[['interne','Interne'],['operateur','Opérateur et +'],['gestionnaire','Gestionnaire et +'],['direction','Direction']];
    iq.docs=docs.map(function(d){return{titre:d.titre,url:d.url||'',noUrl:!d.url,icon:d.type==='plan'?'layers':'file',sub:[d.type,d.niveau_plan,d.taille?Math.round(d.taille/1024)+' Ko':''].filter(Boolean).join(' · '),
      vis:VIS.map(function(v){return{v:v[0],l:v[1],sel:v[0]===d.visibilite};}),onVis:function(e){self.admWrite('documents',Object.assign({},d,{visibilite:e.target.value}));},
      del:function(){if(window.confirm('Retirer « '+d.titre+' » ?'))self.admWrite('documents',{id:d.id},true);}};});
    iq.nB=bl.length;
    iq.bassins=bl.map(function(b,i){var v=S.last[b.nom],e=eB(b);return{n:String(b.numero||i+1),nom:b.nom,st:MK[e],etat:I.LIB[e],resume:v?I.verdict(v.items):'aucune visite',meta:[b.volume?b.volume+' m³':'',self.T(b.type_code||site.type).court,v?'visite du '+fdate(v.date):''].filter(Boolean).join(' · ')};});
    var nbf=st.iqNb||{nom:'',type:'',vol:''},setNb=function(p){self.setState({iqNb:Object.assign({},nbf,p)});};
    iq.nb={nom:nbf.nom,vol:nbf.vol,types:[{v:'',l:'Même type que le site'}].concat(Object.keys(D.types).map(function(k){return{v:k,l:D.types[k].label};})).map(function(o){return Object.assign(o,{sel:o.v===nbf.type});}),
      onNom:function(e){setNb({nom:e.target.value});},onType:function(e){setNb({type:e.target.value});},onVol:function(e){setNb({vol:e.target.value});},
      add:function(){var n=String(nbf.nom||'').trim();if(!n){self.flash('Nommez le bassin');return;}if(bl.some(function(b){return norm(b.nom)===norm(n);})){self.flash('Ce bassin existe déjà');return;}
        self.setState({iqNb:null});self.saveBassins(site,bl.concat([{id:rid('b'),nom:n,type:'',type_code:nbf.type||'',volume:nbf.vol||'',numero:bl.length+1,notes:''}]),'Bassin ajouté');}};}
  else{iq.plans=[];iq.markers=[];iq.docs=[];iq.bassins=[];iq.nb={types:[]};}
  /* ----- 4a-5 Accès client et QR ----- */
  iq.pw=st.iqPw||'';iq.onPw=function(e){self.setState({iqPw:e.target.value});};iq.ouvrir=function(e){if(e&&e.preventDefault)e.preventDefault();self.admOpen();};iq.adminErr=st.iqAdminErr||'';
  if(view==='acces'&&adm){var cpn=st.iqCp&&st.iqCp.site===site.id?st.iqCp.nom:(cp?cp.nom:'');
    iq.cp={nom:cpn,exists:!!cp,onNom:function(e){self.setState({iqCp:{site:site.id,nom:e.target.value}});},saveLbl:cp?'Enregistrer le nom':'Créer le compte client',
      save:function(){var n=String(cpn||'').trim()||site.nom;self.admWrite('client_comptes',cp?Object.assign({},cp,{nom:n}):{id:rid('cl-'),nom:n,sites:[site.id],niveaux:{}}).then(function(ok){if(ok){self.setState({iqCp:null});self.flash(cp?'Compte enregistré':'Compte client créé');}});},
      upLogo:function(e){var file=e.target.files&&e.target.files[0];e.target.value='';if(!file)return;if(!cp){self.flash('Créez d’abord le compte client');return;}
        self.admUpload(file,'logos').then(function(path){if(path)self.admWrite('client_comptes',Object.assign({},cp,{logo_path:path})).then(function(ok){if(ok)self.flash('Logo enregistré');});});}};
    var bls=(site.bassins||[]).length>1?site.bassins:[null],qrs=adm.qr||[];
    iq.qrs=bls.map(function(b,i){var bid=b?String(b.id||b.nom):null,q=qrs.filter(function(x){return x.site_id===site.id&&(x.bassin_id||null)===bid&&x.actif;})[0],url=q?(adm.portail||'')+'?q='+q.jeton:'',img=q?(self._qrc=self._qrc||{},self._qrc[url]=self._qrc[url]||qrData(url)):'';
      var code='SA-'+String(site.id).slice(-4).toUpperCase()+(b?'-B'+(b.numero||i+1):'');
      return{nom:b?b.nom:'Installation',code:q?q.code_affiche:code,etat:q?'actif depuis le '+fdate(q.cree_le):'aucun code',img:img,regenLbl:q?'Régénérer le code':'Créer le code',
        print:function(){self.printAffiche(site,q,b?b.nom:'',img);},
        regen:function(){if(q&&!window.confirm('L’ancien code cessera immédiatement de fonctionner. Continuer ?'))return;var t=self.admTok();
          pfn('admin_qr',{site_id:site.id,bassin_id:bid,code_affiche:code},t).then(function(r){if(!r.ok){self.flash('Refusé : '+(r.message||'erreur'));return;}self.flash(q?'Nouveau code créé — l’ancien est désactivé':'Code créé');self.admLoad();});}};});
    iq.droits=I.DROITS.map(function(k){return{l:DROIT_LIB[k],c:['operateur','gestionnaire','direction'].map(function(n){var on=I.droits(n,cp&&cp.niveaux)[k];
      return{on:on,aria:DROIT_LIB[k]+' — '+I.NIVEAU_NOM[n],go:function(e){if(!cp)return;var nv=JSON.parse(JSON.stringify(cp.niveaux||{}));nv[n]=Object.assign({},nv[n]||{});nv[n][k]=e.target.checked;self.admWrite('client_comptes',Object.assign({},cp,{niveaux:nv}));}};})};});
    var cts=cp?(adm.contacts||[]).filter(function(x){return x.compte_id===cp.id;}):[];
    iq.contacts=cts.map(function(c){return{nom:c.nom,niveau:I.NIVEAU_NOM[c.niveau]||c.niveau,courriel:c.courriel||'—',cel:c.cellulaire||'—',acces:c.dernier_acces?fdate(c.dernier_acces):'jamais',del:function(){if(window.confirm('Retirer l’accès de '+c.nom+' ?'))self.admWrite('client_contacts',{id:c.id},true);}};});
    var ncf=st.iqNc||{nom:'',niveau:'gestionnaire',courriel:'',cel:''},setNc=function(p){self.setState({iqNc:Object.assign({},ncf,p)});};
    iq.nc={nom:ncf.nom,courriel:ncf.courriel,cel:ncf.cel,nivs:['operateur','gestionnaire','direction'].map(function(n){return{v:n,l:I.NIVEAU_NOM[n],sel:n===ncf.niveau};}),
      onNom:function(e){setNc({nom:e.target.value});},onNiv:function(e){setNc({niveau:e.target.value});},onMail:function(e){setNc({courriel:e.target.value});},onCel:function(e){setNc({cel:e.target.value});},
      add:function(){if(!cp){self.flash('Créez d’abord le compte client');return;}if(!String(ncf.nom).trim()||(!String(ncf.courriel).trim()&&!String(ncf.cel).trim())){self.flash('Nom et courriel (ou cellulaire) requis');return;}
        self.admWrite('client_contacts',{id:rid('ct-'),compte_id:cp.id,nom:String(ncf.nom).trim(),courriel:String(ncf.courriel).trim()||null,cellulaire:String(ncf.cel).trim()||null,niveau:ncf.niveau,actif:true}).then(function(ok){if(ok){self.setState({iqNc:null});self.flash('Contact autorisé');}});}};
    var ids={};cts.forEach(function(c){ids[c.id]=c.nom;});var qids={};qrs.forEach(function(q){if(q.site_id===site.id)qids[q.id]=1;});
    var RES={ok:'Accès',refuse:'Refusé',otp_echoue:'Code erroné',otp_envoye:'Code envoyé',envoi_impossible:'Envoi impossible',revoque:'Code QR révoqué'};
    iq.journal=(adm.journal||[]).filter(function(j){return(cp&&j.compte_id===cp.id)||ids[j.contact_id]||qids[j.qr_id];}).slice(0,60).map(function(j){return{quand:fdate(j.quand)+' '+String(j.quand).slice(11,16),qui:ids[j.contact_id]||j.identifiant||'—',action:j.action||'',res:RES[j.resultat]||j.resultat,fw:j.resultat==='ok'?400:600};});
    iq.noJournal=!iq.journal.length;
    iq.envoiTxt=(adm.envoi?'Envoi des codes par courriel : actif.':'Envoi des codes : aucun fournisseur de courriel configuré sur le serveur (RESEND_API_KEY) — les contacts ne peuvent pas encore recevoir leur code.');}
  else{iq.cp={};iq.qrs=[];iq.droits=[];iq.contacts=[];iq.nc={nivs:[]};iq.journal=[];}
  /* ----- Catalogue des points de contrôle ----- */
  if(view==='points'){var tc=st.pcType||site.type,TP=this.T(tc),cat=(D.cat||[]).filter(function(p){return p.type_code===tc||!p.type_code;}),derive=!(D.cat||[]).some(function(p){return p.type_code===tc;});
    var rows=derive?I.pointsDuType(tc,[],TP.checks):cat.slice().sort(function(a,b){return(a.ordre||0)-(b.ordre||0);});
    var put=function(p,patch){var all=derive?rows:[p];Promise.all(all.map(function(x){return self.savePoint(Object.assign({id:x.id,systeme_code:x.systeme_code,type_code:x.type_code,libelle:x.libelle,mode:x.mode,obligatoire:!!x.obligatoire,ordre:x.ordre||0,actif:x.actif!==false},x===p?patch:{}));})).then(function(){self.flash('Point enregistré');});};
    iq.pc={types:Object.keys(D.types).map(function(k){return{v:k,l:D.types[k].label,sel:k===tc};}),onType:function(e){self.setState({pcType:e.target.value});},
      src:derive?'Points actuels du type (pas encore dans le catalogue) : la première modification les y enregistre.':rows.length+' point(s) au catalogue',
      rows:rows.map(function(p){return{libelle:p.libelle,obl:!!p.obligatoire,actif:p.actif!==false,
        sys:I.SYSTEMES.filter(function(s){return s.code!=='eau';}).map(function(s){return{v:s.code,l:s.nom,sel:s.code===p.systeme_code};}),
        modes:[['etat','Conforme / À surveiller / Action'],['ouinon','Oui / Non'],['mesure','Mesure + état']].map(function(m){return{v:m[0],l:m[1],sel:m[0]===p.mode};}),
        onSys:function(e){put(p,{systeme_code:e.target.value});},onLib:function(e){put(p,{libelle:e.target.value});},onMode:function(e){put(p,{mode:e.target.value});},
        onObl:function(e){put(p,{obligatoire:e.target.checked});},onActif:function(e){put(p,{actif:e.target.checked});}};}),
      nouveau:st.pcNew||'',onNouveau:function(e){self.setState({pcNew:e.target.value});},
      add:function(){var l=String(st.pcNew||'').trim();if(!l)return;var sy=I.systemeDe(l),np={id:tc+'-'+Date.now().toString(36),systeme_code:sy,type_code:tc,libelle:l,mode:sy==='securite'?'ouinon':'etat',obligatoire:false,ordre:rows.length+1,actif:true};
        (derive?Promise.all(rows.map(function(x){return self.savePoint(x);})):Promise.resolve()).then(function(){return self.savePoint(np);}).then(function(){self.setState({pcNew:''});self.flash('Point ajouté dans « '+I.NOM[sy]+' » — modifiable ci-dessus');});}};}
  else iq.pc={types:[],rows:[]};
  return{isInspNew:view!=='tendances',isInspections:view==='tendances',iq:iq,iqTabs:tabs};
};
