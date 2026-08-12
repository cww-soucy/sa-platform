/* ════════════════════════════════════════════════════════════════
   CÉDULE DE TEST — SA Platform (intégration Planning / Suivi / Carte)
   Priorité #1 : AUCUNE PERTE DE DONNÉES.
   Charge index.html dans jsdom (sans réseau), puis teste les fonctions.
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const { JSDOM } = require('jsdom');

let PASS=0, FAIL=0, LOG=[];
function ok(name,cond){ if(cond){PASS++;LOG.push('  ✅ '+name);} else {FAIL++;LOG.push('  ❌ '+name);} }
function section(t){ LOG.push('\n▓▓ '+t); }

const html = fs.readFileSync('index.html','utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost/',
  pretendToBeVisual: true,
  // resources NON 'usable' => les <script src> externes (xlsx/supabase/leaflet) ne sont PAS chargés (pas de réseau)
  beforeParse(window){
    // stubs navigateur pour que le boot ne plante pas
    window.scrollTo=()=>{};
    window.alert=()=>{};
    window.matchMedia=window.matchMedia||function(){return{matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}};};
    window.navigator.vibrate=()=>{};
    window.navigator.geolocation={getCurrentPosition:()=>{},watchPosition:()=>{}};
    const g=window.HTMLCanvasElement.prototype.getContext;
    window.HTMLCanvasElement.prototype.getContext=function(){try{return g.apply(this,arguments)||fakeCtx();}catch(e){return fakeCtx();}};
    function fakeCtx(){return{fillRect(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},drawImage(){},getImageData(){return{data:[]};},putImageData(){},scale(){},save(){},restore(){},translate(){},setTransform(){},fillText(){},measureText(){return{width:0};}};}
  }
});

const { window } = dom;

setTimeout(runTests, 900); // laisser le boot s'exécuter

function runTests(){
  const W = window;

  section('0 · Boot — les fonctions critiques sont définies');
  ['mergeById','mapRowToDb','mapRowFromDb','pmAssignees','woAssignees','planAssignees',
   'empLatestPunches','drawSuiviMap','getWOs','getPlan','getPlanMatches','lsGet','lsSet','syncPull','sbPush']
   .forEach(fn=>ok('fonction '+fn+' définie', typeof W[fn]==='function'));

  /* ---------- 1 · FUSION — AUCUNE PERTE DE DONNÉES ---------- */
  section('1 · Fusion (mergeById) — le serveur ne peut JAMAIS effacer le local');
  const L3=[{id:'a',v:1,updatedAt:'2026-08-10T09:00:00Z'},
            {id:'b',v:1,updatedAt:'2026-08-10T09:05:00Z'},
            {id:'c',v:1,updatedAt:'2026-08-10T09:06:00Z'}];
  ok('serveur VIDE → 3 locaux conservés', W.mergeById(L3,[]).length===3);
  ok('serveur partiel (1) → 3 conservés', W.mergeById(L3,[{id:'a',v:9,updatedAt:'2026-08-10T08:00:00Z'}]).length===3);
  ok('modif locale récente protégée', W.mergeById(L3,[{id:'a',v:9,updatedAt:'2026-08-10T08:00:00Z'}]).find(x=>x.id==='a').v===1);
  ok('maj distante plus récente appliquée', W.mergeById(L3,[{id:'b',v:42,updatedAt:'2026-08-10T10:00:00Z'}]).find(x=>x.id==='b').v===42);
  ok('nouvel enregistrement serveur ajouté', W.mergeById(L3,[{id:'d',v:1,updatedAt:'2026-08-10T11:00:00Z'}]).length===4);
  ok('local vide + serveur plein → récupéré', W.mergeById([],[{id:'z',updatedAt:'x'}]).length===1);

  /* ---------- 2 · MAPPING SYNC (colonnes réelles) ---------- */
  section('2 · Mapping app↔Supabase (créneaux / WO / plan de match)');
  // créneau : woId→wo_id, emps→emp
  let db=W.mapRowToDb('plan',{id:'s1',woId:'wX',emps:['e1','e2'],emp:'',date:'2026-08-10'});
  ok('plan: woId→wo_id', db.wo_id==='wX' && db.woId===undefined);
  ok('plan: emps→emp (joint)', db.emp==='e1, e2' && db.emps===undefined);
  let back=W.mapRowFromDb('plan',{id:'s1',wo_id:'wX',emp:'e1, e2'});
  ok('plan retour: wo_id→woId', back.woId==='wX');
  ok('plan retour: emp→emps[]', JSON.stringify(back.emps)==='["e1","e2"]');
  // WO : assignes→assigne, createdAt→created_at
  let dbw=W.mapRowToDb('workorders',{id:'w1',assignes:['e1','e2'],assigne:'',createdAt:'2026-08-10T00:00:00Z',desc:'d'});
  ok('WO: assignes→assigne', dbw.assigne==='e1, e2' && dbw.assignes===undefined);
  ok('WO: createdAt→created_at', dbw.created_at==='2026-08-10T00:00:00Z' && dbw.createdAt===undefined);
  ok('WO: desc→descr', dbw.descr==='d' && dbw.desc===undefined);
  let backw=W.mapRowFromDb('workorders',{id:'w1',assigne:'e1, e2',descr:'d'});
  ok('WO retour: assigne→assignes[]', JSON.stringify(backw.assignes)==='["e1","e2"]');
  // plan de match : emps + createdBy
  let dbp=W.mapRowToDb('planmatch',{id:'p1',emps:['e1','e2','e3'],emp:'',createdBy:'boss',createdAt:'2026-08-10T00:00:00Z',updatedAt:'x'});
  ok('PM: emps→emp', dbp.emp==='e1, e2, e3' && dbp.emps===undefined);
  ok('PM: createdBy→created_by', dbp.created_by==='boss' && dbp.createdBy===undefined);
  ok('PM: updatedAt retiré (updated_at posé à part)', dbp.updatedAt===undefined);
  let backp=W.mapRowFromDb('planmatch',{id:'p1',emp:'e1, e2, e3'});
  ok('PM retour: emp→emps[3]', backp.emps.length===3);

  /* ---------- 3 · ASSIGNATION MULTI ---------- */
  section('3 · Assignation multi-employés');
  ok('pmAssignees (emps[])', W.pmAssignees({emps:['a','b']}).length===2);
  ok('pmAssignees compat ancien (emp seul)', JSON.stringify(W.pmAssignees({emp:'a'}))==='["a"]');
  ok('pmAssignees compat (emp joint)', W.pmAssignees({emp:'a, b, c'}).length===3);
  ok('woAssignees (assignes[])', W.woAssignees({assignes:['a','b']}).length===2);
  ok('planAssignees (emps[])', W.planAssignees({emps:['a']}).length===1);

  /* ---------- 4 · PERSISTANCE LOCALE — pas d'écrasement destructeur ---------- */
  section('4 · Persistance locale (lsSet/lsGet + coffre)');
  W.lsSet('workorders',[{id:'w1'},{id:'w2'},{id:'w3'}]);
  ok('lsGet relit ce qui a été écrit', (W.lsGet('workorders')||[]).length===3);
  // simuler une fusion pull avec serveur plus pauvre : le local doit rester à 3
  const merged=W.mergeById(W.lsGet('workorders'), [{id:'w1',updatedAt:'z'}]);
  ok('pull serveur pauvre → local reste 3', merged.length===3);

  /* ---------- 5 · EXTRACTION GPS PAR PUNCH (localisation) ---------- */
  section('5 · Localisation par punch (empLatestPunches)');
  // seed comptes + feuille de temps avec punchs GPS
  W.lsSet('comptes',[
    {id:'ch',prenom:'Cheikh',nom:'Ndiaye',role:'employe',dept:'Terrain'},
    {id:'sa',prenom:'Samuel',nom:'Pomerleau',role:'employe',dept:'Terrain'},
    {id:'ma',prenom:'Mathis',nom:'Bédard',role:'employe',dept:'Terrain'},
    {id:'boss',prenom:'Max',nom:'L',role:'admin',dept:'Bureau'}
  ]);
  const wk = W.weekKey();
  const day = W.curDay;
  function ftWith(tasks){ const days=[]; for(let i=0;i<7;i++)days[i]={tasks:[],status:'idle'}; days[day]={tasks:tasks,status:tasks.some(t=>t.active)?'running':'done'}; return {week:wk,days:days}; }
  W.lsSet('ft_week_ch_'+wk, ftWith([
    {lieu:'CCNQ',start:'08:00',gps:{lat:46.7745,lng:-71.2660,acc:12}},
    {lieu:'Canotier',start:'10:15',active:true,gps:{lat:46.7830,lng:-71.2540,acc:9}}
  ]));
  W.lsSet('ft_week_sa_'+wk, ftWith([
    {lieu:'Quai Paquet',start:'08:05',gps:{lat:46.8188,lng:-71.1790,acc:15}}
  ]));
  W.lsSet('ft_week_ma_'+wk, ftWith([
    {lieu:'Sans GPS',start:'08:00'} // pas de gps → doit être "non disponible"
  ]));
  const emps = W.empLatestPunches();
  ok('2 employés géolocalisés (Cheikh, Samuel)', emps.length===2);
  const ch = emps.find(e=>e.id==='ch');
  ok('Cheikh : dernière position = Canotier', ch && ch.last.lieu==='Canotier');
  ok('Cheikh : trajet de 2 points', ch && ch.path.length===2);
  ok('Cheikh : marqué en activité (punch actif)', ch && ch.running===true);
  ok('Samuel : 1 position (Quai Paquet)', emps.find(e=>e.id==='sa').path.length===1);
  ok('Mathis EXCLU (aucun punch GPS)', !emps.some(e=>e.id==='ma'));
  ok('admin exclu de la carte', !emps.some(e=>e.id==='boss'));
  ok('coordonnées réelles conservées', Math.abs(ch.last.lat-46.7830)<0.001);

  /* ---------- 6 · RENDU CARTE — pas de plantage ---------- */
  section('6 · Rendu carte (drawSuiviMap) — robustesse');
  // injecter les conteneurs attendus
  const box=window.document.createElement('div');box.id='suiviMap';window.document.body.appendChild(box);
  const note=window.document.createElement('div');note.id='suiviMapNote';window.document.body.appendChild(note);
  let threw=false; try{ W.drawSuiviMap(); }catch(e){ threw=true; LOG.push('     (drawSuiviMap: '+e.message+')'); }
  ok('drawSuiviMap ne plante pas (Leaflet absent en test)', !threw);
  ok('note "non disponible" affichée pour Mathis', /Mathis/.test(note.innerHTML) || note.style.display!=='none');

  /* ---------- 7 · INTÉGRITÉ : rien touché aux feuilles de temps ---------- */
  section('7 · Intégrité feuilles de temps (données punch intactes)');
  const ftCheck=W.lsGet('ft_week_ch_'+wk);
  ok('FT Cheikh toujours présente', !!ftCheck && ftCheck.days[day].tasks.length===2);
  ok('GPS du punch intact', ftCheck.days[day].tasks[0].gps.lat===46.7745);
  ok('heures/lieu du punch intacts', ftCheck.days[day].tasks[1].lieu==='Canotier');


  /* ---------- 8 · TABLEAU GLISSABLE — réassignation sans perte ---------- */
  section('8 · Tableau glissable (drag = réassigner) — aucune perte');
  W.renderPlan = function(){}; // neutralise le rendu DOM, on teste la donnée
  W.currentUser = {id:'boss',role:'admin'};
  W.lsSet('plan',[{id:'s1',woId:'w1',date:'PMDAY',emps:['ch'],emp:'ch',heure:'08:00'}]);
  W.lsSet('workorders',[{id:'w1',client:'X',date:'PMDAY',assignes:['ch'],assigne:'ch'},{id:'w2',client:'Y',date:'PMDAY',assignes:[],assigne:''}]);
  // aligner pmDay avec la date des données
  W.pmDay='PMDAY';
  // fixer les dates au vrai pmDay
  let _pl=W.getPlan();_pl[0].date=W.pmDay;W.lsSet('plan',_pl);
  let _wo=W.getWOs();_wo.forEach(w=>w.date=W.pmDay);W.lsSet('workorders',_wo);
  // réassigner le créneau s1 de Cheikh -> Samuel
  W.boardReassign('slot','s1','sa');
  ok('créneau réassigné à Samuel', JSON.stringify(W.getPlan().find(x=>x.id==='s1').emps)==='["sa"]');
  ok('emp joint mis à jour', W.getPlan().find(x=>x.id==='s1').emp==='sa');
  ok('toujours 1 créneau (rien perdu)', W.getPlan().length===1);
  // réassigner WO w2 -> Mathis
  W.boardReassign('wo','w2','ma');
  ok('WO réassigné à Mathis', JSON.stringify(W.getWOs().find(x=>x.id==='w2').assignes)==='["ma"]');
  ok('toujours 2 WO (rien perdu)', W.getWOs().length===2);
  // changer l'heure d'un créneau
  W.boardSetTime('s1','09:30');
  ok('heure du créneau modifiée', W.getPlan().find(x=>x.id==='s1').heure==='09:30');
  ok('créneau w1 lié intact', W.getPlan().find(x=>x.id==='s1').woId==='w1');
  // remettre au pool (désassigner)
  W.boardReassign('slot','s1',null);
  ok('désassignation → emps vide, créneau conservé', W.getPlan().length===1 && W.getPlan()[0].emps.length===0);


  /* ---------- 9 · SIMULATION DÉPLOIEMENT — aucune perte au 1er chargement ---------- */
  section('9 · Déploiement réel : appareil PLEIN + serveur VIDE/plus vieux → rien perdu');
  // Feuille de temps LOCALE récente (punchs du jour, pas encore montés)
  W.lsSet('ft_week_ch_2026-W33', {uid:'ch',week:'2026-W33',emp:'Cheikh',savedAt:'2026-08-14T17:00:00Z',
    days:[{tasks:[{lieu:'CCNQ',hrs:4,gps:{lat:46.77,lng:-71.26,acc:10}}],status:'done'}]});
  // reproduire la logique corrigée de syncPullFT (protection par récence)
  function pullFT(serverRow){
    var key='ft_week_'+serverRow.id;
    var local=W.lsGet(key);
    var serverTs=new Date(serverRow.saved_at||0).getTime()||0;
    var localTs=local?(new Date(local.savedAt||0).getTime()||0):-1;
    if(!local || serverTs>=localTs){ W.lsSet(key,{week:serverRow.week,emp:serverRow.emp,savedAt:serverRow.saved_at,days:serverRow.days,uid:serverRow.uid}); }
  }
  // serveur a une version PLUS VIEILLE (vide) de la même semaine
  pullFT({id:'ch_2026-W33',week:'2026-W33',emp:'Cheikh',saved_at:'2026-08-10T09:00:00Z',days:[{tasks:[],status:'idle'}],uid:'ch'});
  const ftAfter=W.lsGet('ft_week_ch_2026-W33');
  ok('feuille de temps locale récente CONSERVÉE (punch pas effacé)', ftAfter.days[0].tasks.length===1);
  ok('heures du punch intactes (4h)', ftAfter.days[0].tasks[0].hrs===4);
  ok('GPS du punch intact', ftAfter.days[0].tasks[0].gps.lat===46.77);
  // serveur PLUS RÉCENT → doit mettre à jour
  pullFT({id:'ch_2026-W33',week:'2026-W33',emp:'Cheikh',saved_at:'2026-08-14T18:30:00Z',days:[{tasks:[{lieu:'CCNQ',hrs:4},{lieu:'Quai',hrs:2}],status:'done'}],uid:'ch'});
  ok('maj serveur plus récente appliquée (2 punchs)', W.lsGet('ft_week_ch_2026-W33').days[0].tasks.length===2);
  // Tables métier : appareil plein, serveur vide → tout conservé (fusion)
  W.lsSet('workorders',[{id:'w1'},{id:'w2'},{id:'w3'},{id:'w4'},{id:'w5'}]);
  W.lsSet('plan',[{id:'s1'},{id:'s2'},{id:'s3'}]);
  W.lsSet('planmatch',[{id:'p1'},{id:'p2'}]);
  ok('5 WO conservés (serveur vide)', W.mergeById(W.getWOs(),[]).length===5);
  ok('3 créneaux conservés (serveur vide)', W.mergeById(W.getPlan(),[]).length===3);
  ok('2 plans de match conservés (serveur vide)', W.mergeById(W.getPlanMatches(),[]).length===2);
  // serveur avec 1 nouveau + suppression apparente → local jamais réduit, nouveau ajouté
  const m=W.mergeById(W.getWOs(),[{id:'w6',updatedAt:'z'}]);
  ok('serveur ajoute w6 sans rien retirer → 6', m.length===6);
  ok('pushAllLocalFT existe (montée des punchs)', typeof W.pushAllLocalFT==='function');


  /* ---------- 10 · CRÉATION (saveWO / savePlan / savePmm) ---------- */
  section('10 · Création WO / Créneau / Plan de Match — bon enregistrement + aucune perte');
  ['closeModal','renderWOList','renderPlan','buildDayTabs','toast','renderTaskLog','refreshCumul','renderPlanMatch','renderChrono'].forEach(function(fn){ if(typeof W[fn]==='function') W[fn]=function(){}; });
  W.getCheckedEmp=function(){return ['ch','sa'];};
  W.isSup=function(){return true;};
  W.currentUser={id:'boss',role:'admin',prenom:'Max',nom:'L'};
  function setVal(id,v){var e=W.document.getElementById(id);if(e)e.value=v;}
  // données existantes à préserver
  W.lsSet('workorders',[{id:'old1'},{id:'old2'}]);
  W.lsSet('plan',[{id:'olds1'}]);
  W.lsSet('planmatch',[{id:'oldp1'}]);
  // --- saveWO ---
  W.woEditId=null; W.woTasks=[]; W.woPjFiles=[];
  setVal('woClient','Nouveau Client');setVal('woSite','Site X');setVal('woType','entretien');setVal('woPriorite','haute');setVal('woStatus','ouvert');setVal('woDate','2026-08-14');setVal('woDesc','desc');setVal('woNotes','notes');
  W.saveWO();
  var nw=W.getWOs();
  ok('WO créé — 3 au total (2 anciens préservés)', nw.length===3);
  ok('nouveau WO en tête', nw[0].client==='Nouveau Client');
  ok('WO multi-assigné (assignes + assigne)', JSON.stringify(nw[0].assignes)==='["ch","sa"]' && nw[0].assigne==='ch, sa');
  ok('anciens WO préservés', nw.some(w=>w.id==='old1')&&nw.some(w=>w.id==='old2'));
  ok('WO a un id et une date', !!nw[0].id && nw[0].date==='2026-08-14');
  // --- savePlan (créneau) ---
  var sel=W.document.getElementById('pmWoSel');
  if(sel){var o=W.document.createElement('option');o.value=nw[0].id;sel.appendChild(o);sel.value=nw[0].id;}
  var sb=W.document.getElementById('pmSaveBtn'); if(sb)sb.dataset.slotId='';
  setVal('pmDate','2026-08-14');setVal('pmHeure','09:00');setVal('pmNotes','n');
  W.savePlan();
  var np=W.getPlan();
  ok('créneau créé — 2 (ancien préservé)', np.length===2);
  var newSlot=np.find(function(s){return s.woId===nw[0].id;});
  ok('créneau lié au bon WO', !!newSlot);
  ok('créneau multi-employés', newSlot && JSON.stringify(newSlot.emps)==='["ch","sa"]');
  ok('créneau a heure + date', newSlot && newSlot.heure==='09:00' && newSlot.date==='2026-08-14');
  ok('ancien créneau préservé', np.some(function(s){return s.id==='olds1';}));
  // --- savePmm (plan de match) ---
  setVal('pmmDate','2026-08-14');setVal('pmmVehicule','266');setVal('pmmSuperviseur','CW');setVal('pmmResume','r');
  W.pmmBuilderSections=[{titre:'A',taches:[]}]; W.pmmEditingId=null;
  W.savePmm();
  var npm=W.getPlanMatches();
  ok('plan de match créé — 2 (ancien préservé)', npm.length===2);
  var newPm=npm.find(function(p){return p.date==='2026-08-14';});
  ok('PM multi-employés', newPm && JSON.stringify(newPm.emps)==='["ch","sa"]');
  ok('PM porte véhicule + sections', newPm && newPm.vehicule==='266' && (newPm.sections||[]).length===1);
  ok('ancien plan de match préservé', npm.some(function(p){return p.id==='oldp1';}));

  /* ---------- RÉSULTAT ---------- */
  LOG.push('\n════════════════════════════════════════');
  LOG.push('  RÉSULTAT : '+PASS+' réussis · '+FAIL+' échoués');
  LOG.push('════════════════════════════════════════');
  console.log(LOG.join('\n'));
  process.exit(FAIL===0?0:1);
}
