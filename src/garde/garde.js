/* Garde-saisie (sa-admin et sa-terrain) — empêche de perdre une saisie non enregistrée.
   window.SAGarde.init(options) :
     dom        : true → suit les champs modifiés par l'utilisateur (sa-admin) ; false → seul options.estSale compte (sa-terrain)
     estSale    : function() → true quand l'app a une saisie en cours (en plus des champs suivis)
     brouillons : préfixe localStorage → copie automatique des fenêtres (.dialog) en cours de saisie, proposée à la réouverture
   Ce que la garde fait :
   - clic à côté d'une fenêtre (fond grisé) : ne ferme plus si quelque chose a été tapé, ni si le clic a commencé dans la fenêtre
     (sélection de texte à la souris qui se termine sur le fond) ;
   - Retour arrière hors d'un champ, Alt+←, Cmd+[, Cmd+←, F5, Ctrl/Cmd+R : sans effet tant qu'une saisie est en cours ;
   - fermeture, rechargement ou départ de la page : le navigateur demande confirmation ;
   - brouillon : chaque fenêtre en cours de saisie est copiée sur l'appareil ; si la page est quittée sans « Enregistrer »
     ni « Annuler », la saisie est proposée (« Récupérer ») à la prochaine ouverture de la même fenêtre. */
(function(){
var O={dom:true,estSale:null,brouillons:''},edits=[],ignoreJusqua=0,downEl=null,pret=false,zones=[],offre=null,TTL=48*3600e3;
function champ(el){if(!el||el.nodeType!==1)return false;var t=el.tagName;return t==='INPUT'||t==='TEXTAREA'||t==='SELECT';}
function val(el){var ty=(el.type||'').toLowerCase();return(ty==='checkbox'||ty==='radio')?(el.checked?'1':''):String(el.value==null?'':el.value);}
function dansFenetre(el){return!!(el.closest&&el.closest('.dialog'));}
function exclu(el){
  if(!champ(el))return true;
  var ty=(el.type||'').toLowerCase();
  if(['search','button','submit','reset','file','hidden','password','range','color','image'].indexOf(ty)>=0)return true;
  if(el.closest('[data-garde="non"],#login'))return true;
  var h=((el.getAttribute('placeholder')||'')+' '+(el.getAttribute('aria-label')||'')).toLowerCase();
  if(/recherch|cherch|filtr|search/.test(h))return true;
  /* hors fenêtre, les listes, cases et dates servent surtout de filtres d'affichage : elles ne retiennent rien */
  if(!dansFenetre(el)&&(el.tagName==='SELECT'||['checkbox','radio','date','month','week','time'].indexOf(ty)>=0))return true;
  return false;
}
function nettoie(){edits=edits.filter(function(x){return x.el.isConnected;});}
function champsSales(racine){nettoie();return edits.filter(function(x){var v=val(x.el);return v!==''&&v===x.v&&(!racine||racine.contains(x.el));});}
function sale(racine){if(O.dom&&champsSales(racine).length)return true;if(!racine&&typeof O.estSale==='function'){try{return!!O.estSale();}catch(e){}}return false;}
function propre(tout){nettoie();edits=edits.filter(function(x){return!tout&&dansFenetre(x.el);});}
function noter(e){var el=e.target;if(!O.dom||exclu(el))return;var v=val(el);for(var i=0;i<edits.length;i++)if(edits[i].el===el){edits[i].v=v;break;}if(i===edits.length)edits.push({el:el,v:v});
  var z=el.closest('.dialog');if(z&&O.brouillons)planifier(z);}

/* ---------- petit avis flottant (hors du rendu de l'app) ---------- */
var avisEl=null,avisT=0;
function avis(txt){if(!document.body)return;if(!avisEl){avisEl=document.createElement('div');avisEl.setAttribute('role','alert');avisEl.setAttribute('data-garde-avis','');
    avisEl.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;max-width:min(560px,calc(100vw - 32px));padding:12px 16px;background:#111;color:#fff;font:500 16px/1.35 Barlow,system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25);text-align:center';
    document.body.appendChild(avisEl);}
  avisEl.textContent=txt;avisEl.style.display='block';clearTimeout(avisT);avisT=setTimeout(function(){if(avisEl)avisEl.style.display='none';},3800);}
function secouer(fd){var d=fd.querySelector('.dialog')||fd;try{d.animate([{transform:'translateX(0)'},{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'translateX(0)'}],{duration:260});}catch(e){}}
var MSG='Saisie non enregistrée — utilisez « Enregistrer » ou « Annuler » pour fermer cette fenêtre.';

/* ---------- clic sur le fond d'une fenêtre ---------- */
function surPointeur(e){downEl=e.target;}
function surClic(e){var b=e.target;if(!b||!b.classList||!b.classList.contains('dialog-backdrop'))return;
  var glisse=downEl&&downEl!==b&&b.contains(downEl);/* appui commencé dans la fenêtre (sélection de texte), relâché sur le fond */
  if(glisse||sale(b)){e.stopImmediatePropagation();e.preventDefault();if(!glisse){secouer(b);avis(MSG);}}}

/* ---------- touches qui font quitter ou recharger la page ---------- */
function editable(el){if(!el||el.nodeType!==1)return false;if(el.isContentEditable)return true;if(el.tagName==='TEXTAREA')return!el.readOnly&&!el.disabled;
  if(el.tagName==='INPUT'){var ty=(el.type||'text').toLowerCase();return['button','submit','reset','checkbox','radio','file','image','range','color'].indexOf(ty)<0&&!el.readOnly&&!el.disabled;}return false;}
function surTouche(e){var k=e.key,ed=editable(e.target),mod=e.ctrlKey||e.metaKey;
  /* Retour arrière hors d'un champ : jamais de « page précédente » */
  if(k==='Backspace'&&!ed&&!mod&&!e.altKey){e.preventDefault();return;}
  if(!sale())return;
  var quitte=(e.altKey&&(k==='ArrowLeft'||k==='ArrowRight'))||(e.metaKey&&(k==='['||k===']'))||(e.metaKey&&!ed&&(k==='ArrowLeft'||k==='ArrowRight'))||
    k==='F5'||k==='BrowserBack'||k==='BrowserForward'||(mod&&(k==='r'||k==='R'));
  if(quitte){e.preventDefault();e.stopPropagation();avis('Saisie en cours non enregistrée — enregistrez avant de quitter la page.');}}

/* ---------- départ de la page ---------- */
function avantDepart(e){if(Date.now()<ignoreJusqua)return;if(!sale())return;sauverTout();e.preventDefault();e.returnValue='';return '';}

/* ---------- brouillons des fenêtres ---------- */
function titreDe(z){var t=z.querySelector('.dialog-title,h1,h2,h3');return t?String(t.textContent||'').replace(/\s+/g,' ').trim().slice(0,120):'';}
function cle(t){return O.brouillons+'_brouillon_'+t;}
function champsDe(z){return Array.prototype.slice.call(z.querySelectorAll('input,textarea,select')).filter(function(el){return!exclu(el);});}
function lire(t){try{var b=JSON.parse(localStorage.getItem(cle(t))||'null');if(b&&Date.now()-b.t<TTL)return b;if(b)localStorage.removeItem(cle(t));}catch(e){}return null;}
function sauver(z){var t=titreDe(z);if(!t||!z.isConnected)return;if(!champsSales(z).length)return;
  var c=champsDe(z).map(function(el){return{ty:(el.type||el.tagName).toLowerCase(),v:val(el)};});
  try{localStorage.setItem(cle(t),JSON.stringify({t:Date.now(),titre:t,champs:c}));}catch(e){}
  for(var i=0;i<zones.length;i++)if(zones[i].z===z){zones[i].titre=t;return;}zones.push({z:z,titre:t});}
var tSauve=0,aSauver=[];
function planifier(z){if(aSauver.indexOf(z)<0)aSauver.push(z);clearTimeout(tSauve);tSauve=setTimeout(function(){var l=aSauver;aSauver=[];l.forEach(sauver);},300);}
function sauverTout(){if(!O.brouillons)return;clearTimeout(tSauve);var l=aSauver;aSauver=[];l.forEach(sauver);}
/* fenêtre fermée normalement (Enregistrer, Annuler, ✕) pendant que la page vit : son brouillon n'a plus lieu d'être */
function verifierZones(){if(!O.brouillons)return;zones=zones.filter(function(x){if(x.z.isConnected&&titreDe(x.z)===x.titre)return true;
  if(aSauver.indexOf(x.z)>=0)aSauver.splice(aSauver.indexOf(x.z),1);try{localStorage.removeItem(cle(x.titre));}catch(e){}return false;});
  proposer();}
function apercu(b){var v=b.champs.filter(function(c){return c.v&&c.ty!=='checkbox'&&c.ty!=='radio';}).map(function(c){return c.v.length>40?c.v.slice(0,40)+'…':c.v;});return v.slice(0,3).join(' · ');}
function depuis(t){var m=Math.round((Date.now()-t)/60000);if(m<1)return'à l’instant';if(m<60)return'il y a '+m+' min';var h=Math.round(m/60);return h<24?'il y a '+h+' h':'il y a '+Math.round(h/24)+' j';}
function fermerOffre(){if(offre&&offre.el&&offre.el.parentNode)offre.el.parentNode.removeChild(offre.el);offre=null;}
function proposer(){
  var d=Array.prototype.slice.call(document.querySelectorAll('.dialog')).filter(function(z){return z.isConnected;});
  var z=null,b=null;for(var i=0;i<d.length&&!b;i++){var t=titreDe(d[i]);if(!t)continue;if(zones.some(function(x){return x.z===d[i];}))continue;var bb=lire(t);if(bb){z=d[i];b=bb;}}
  if(offre&&(offre.z===z&&z))return;fermerOffre();if(!z)return;
  var el=document.createElement('div');el.setAttribute('data-garde-offre','');el.setAttribute('role','status');
  el.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483001;width:min(560px,calc(100vw - 24px));box-sizing:border-box;padding:12px 14px;background:#fff8e1;color:#111;border:2px solid #111;font:500 15px/1.35 Barlow,system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;box-shadow:0 6px 24px rgba(0,0,0,.2)';
  var p=document.createElement('div');p.style.cssText='flex:1 1 260px';p.textContent='Saisie non enregistrée retrouvée ('+depuis(b.t)+')'+(apercu(b)?' : « '+apercu(b)+' »':'')+'.';
  var bR=document.createElement('button');bR.type='button';bR.textContent='Récupérer';bR.style.cssText='font:600 15px Barlow,system-ui,sans-serif;padding:8px 14px;background:#111;color:#fff;border:0;cursor:pointer;min-height:40px';
  var bI=document.createElement('button');bI.type='button';bI.textContent='Ignorer';bI.style.cssText='font:500 15px Barlow,system-ui,sans-serif;padding:8px 14px;background:transparent;color:#111;border:1px solid #111;cursor:pointer;min-height:40px';
  el.appendChild(p);el.appendChild(bR);el.appendChild(bI);document.body.appendChild(el);
  var titre=titreDe(z);offre={el:el,z:z,titre:titre};
  bI.onclick=function(){try{localStorage.removeItem(cle(titre));}catch(e){}fermerOffre();};
  bR.onclick=function(){fermerOffre();restaurer(z,titre,b);};
}
function poser(el,v){var ty=(el.type||'').toLowerCase();
  if(ty==='checkbox'||ty==='radio'){var on=v==='1';if(el.checked===on)return;el.checked=on;}
  else{if(el.value===v)return;var pr=Object.getPrototypeOf(el),d=Object.getOwnPropertyDescriptor(pr,'value');if(d&&d.set)d.set.call(el,v);else el.value=v;}
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
function zoneTitre(t,z0){if(z0&&z0.isConnected&&titreDe(z0)===t)return z0;var d=document.querySelectorAll('.dialog');for(var i=0;i<d.length;i++)if(titreDe(d[i])===t)return d[i];return null;}
function restaurer(z,titre,b){
  /* champ par champ : chaque saisie peut redessiner la fenêtre (ex. un choix qui ajoute des champs) */
  b.champs.forEach(function(c,i){var zz=zoneTitre(titre,z);if(!zz)return;var el=champsDe(zz)[i];if(!el)return;var ty=(el.type||el.tagName).toLowerCase();if(ty!==c.ty)return;
    poser(el,c.v);var e2=champsDe(zoneTitre(titre,z)||zz)[i];if(e2)noter({target:e2});});
  var zz=zoneTitre(titre,z);if(zz){sauver(zz);}avis('Saisie récupérée — vérifiez puis « Enregistrer ».');}

function init(o){O=Object.assign({dom:true,estSale:null,brouillons:''},o||{});if(pret)return;pret=true;
  document.addEventListener('input',noter,true);document.addEventListener('change',noter,true);
  document.addEventListener('pointerdown',surPointeur,true);document.addEventListener('click',surClic,true);
  document.addEventListener('keydown',surTouche,true);window.addEventListener('beforeunload',avantDepart);
  window.addEventListener('pagehide',sauverTout);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')sauverTout();});
  if(O.brouillons&&typeof MutationObserver==='function'){var tV=0;new MutationObserver(function(){clearTimeout(tV);tV=setTimeout(verifierZones,60);}).observe(document.documentElement,{childList:true,subtree:true});}
}
window.SAGarde={init:init,sale:function(r){return sale(r);},propre:propre,
  /* départ volontaire (courriel mailto:, déconnexion) : pas de demande de confirmation pendant un court instant */
  ignorer:function(ms){ignoreJusqua=Date.now()+(ms||1500);},avis:avis};
})();
