import re,json,sys
import os
HERE=os.path.dirname(os.path.abspath(__file__));SRC=os.path.dirname(HERE);OUT=os.path.join(SRC,'build')
M=open(os.path.join(OUT,'app_markup.txt'),encoding='utf-8').read()
M=M.replace('</x-import>','').rstrip()
def rep(old,new,cnt=None,regex=False):
    global M
    n=len(re.findall(old,M)) if regex else M.count(old)
    if n==0: print('!! introuvable:',old[:70]); return
    if cnt and n!=cnt: print('?? occurrences',n,'≠',cnt,':',old[:60])
    M=re.sub(old,new,M) if regex else M.replace(old,new)
# 1) attributs de maquette
M=re.sub(r'\s+hint-[a-z-]+="[^"]*"','',M)
# 2) hover / active -> règles CSS
css=[];n=[0]
def sty(m):
    kind=m.group(1); decl=m.group(2)
    n[0]+=1; i=n[0]
    ds=';'.join((d.strip()+' !important') for d in decl.split(';') if d.strip())
    css.append('[data-%s="%d"]:%s{%s}'%('hv' if kind=='hover' else 'ac',i,kind if kind=='hover' else 'active',ds))
    return ' data-%s="%d"'%('hv' if kind=='hover' else 'ac',i)
M=re.sub(r'\s+style-(hover|active)="([^"]*)"',sty,M)
# 3) cadre iPhone -> plein écran
rep('<div style="height:54px;flex:none"></div>','<div style="height:max(env(safe-area-inset-top),8px);flex:none"></div>',1)
# 4) libellés de démonstration -> données réelles
rep('Hors-ligne prêt · synchro 09:42','{{ syncLbl }}',1)
# Logo Soucy Aquatik (le même que SA Platform), intégré au fichier
import base64
LOGO='data:image/png;base64,'+base64.b64encode(open(os.path.join(SRC,'design','logo-soucy-aquatik.png'),'rb').read()).decode()
rep('<div style="width:46px;height:46px;background:#004987;color:#ffffff;display:flex;align-items:flex-end;padding:5px;box-sizing:border-box;font:600 11px/0.95 var(--font-heading);letter-spacing:0.01em">Soucy<br>Aquatik</div>','<img src="'+LOGO+'" alt="Soucy Aquatik" style="width:46px;height:46px;flex:none;display:block">',1)
# Fiche : choix du bassin quand le site en a plusieurs (bassins déclarés dans la fiche du site)
rep('{{ cur.typeLabel }} · {{ cur.bassin }}</div>','{{ cur.typeLabel }} · {{ cur.bassin }}</div><sc-if value="{{ cur.hasBassins }}"><div role="group" aria-label="Bassin" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"><sc-for list="{{ cur.bassinChips }}" as="b"><button onClick="{{ b.go }}" style="all:unset;cursor:pointer;padding:8px 14px;border:1.5px solid var(--color-text);font:600 16px var(--font-heading);background:{{ b.bg }};color:{{ b.fg }}">{{ b.label }}</button></sc-for></div></sc-if>',1)
rep('Punché depuis {{ punchAt }}','{{ punchLbl }}',1)
rep('Punch sur ce site','Ouvrir la fiche')
rep('>Punch<','>Fiche<')
rep('Aucun punch en cours','Aucun punch actif — punchez dans SA Platform')
rep('Dépunch','Retour à la tournée')
rep('>Jeudi 1er octobre<','>{{ todayTxt }}<',1)
rep('Jérémie Roy','{{ me.nom }}',1)
rep('Technicien · opérateur certifié','{{ me.role }}',1)
rep('<span>Camion</span><span style="font-weight:500">07 · Ford Transit</span>','<span>Département</span><span style="font-weight:500">{{ me.dept }}</span>',1)
rep('819 571-2203','{{ me.tel }}',1)
rep('22 sites · 7 jours','{{ queueLbl }}',1)
rep('{{ myBank }} h</span><span style="font-size:14px">Banque d’heures','{{ jobCount }}</span><span style="font-size:14px">Arrêts aujourd’hui',1)
rep('tel:18195620000','tel:{{ bureauTel }}')
rep('envoyée au bureau','{{ cur.syncTxt }}',1)
rep('le bureau sera avisé','signalez-le au bureau')
rep('<textarea class="input" placeholder="Note pour le bureau ou le prochain technicien"','<textarea class="input" value="{{ noteTxt }}" onChange="{{ onNote }}" placeholder="Note pour le bureau ou le prochain technicien"',1)

# ---------- PUNCH (écrans ajoutés, style du design) ----------
CORN='<i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>'
BTN=lambda cls,fn,ic,txt,sz='58px;font-size:20px': '<button class="btn %s" onClick="{{ %s }}" style="min-height:%s;gap:10px"><sa-i n="%s" s="22"></sa-i>%s</button>'%(cls,fn,sz,ic,txt)
PANEL=('<div class="blueprint" style="padding:18px;display:flex;flex-direction:column;gap:12px">'+CORN+
 '<div style="display:flex;align-items:center;gap:8px;font-size:15px"><span style="width:10px;height:10px;background:var(--color-accent);flex:none"></span><span>{{ pn.statusTxt }}</span></div>'
 '<div style="font:600 26px/1.05 var(--font-heading)">{{ pn.title }}</div>'
 '<div style="font-size:15px">Aujourd’hui {{ pn.dayTotal }} · Semaine {{ pn.weekTotal }}</div>'
 '<sc-if value="{{ pn.active }}">'+BTN('btn-secondary','pn.openStart','login','Changer de site','52px;font-size:18px')+BTN('btn-primary','pn.openStop','logout','Terminer la journée')+'</sc-if>'
 '<sc-if value="{{ pn.idle }}">'+BTN('btn-primary','pn.openStart','login','Démarrer un punch')+'</sc-if>'
 '<sc-if value="{{ pn.hasPending }}"><div style="font-size:14px">{{ pn.pendingTxt }}</div></sc-if></div>\n')
m=re.search(r'(Tournée · \{\{ jobCount \}\} arrêts · \{\{ doneTxt \}\}</div>\s*</div>)',M)
if m: M=M.replace(m.group(1),m.group(1)+'\n'+PANEL.replace('\n',''),1)
else: print('!! ancre Aujourd hui introuvable')
rep('Aucun punch actif — punchez dans SA Platform','Prochain arrêt de la tournée')
rep('<sa-i n="login" s="24"></sa-i>Ouvrir la fiche</button>','<sa-i n="clipboard" s="24"></sa-i>Ouvrir la fiche</button><button class="btn btn-secondary" onClick="{{ nextJob.punchHere }}" style="min-height:52px;font-size:18px;gap:10px"><sa-i n="login" s="22"></sa-i>Puncher ici</button>')
FIELD=lambda lab,inner: '<div class="field"><label style="font-size:15px">%s</label>%s</div>'%(lab,inner)
TEMPS=('<sc-if value="{{ isTemps }}"><div style="padding:20px;display:flex;flex-direction:column;gap:20px"><h1 style="margin:0;font-size:38px;line-height:1">Temps</h1>'+PANEL+
 '<div style="display:flex;flex-direction:column"><h3 style="margin:0 0 6px;font-size:24px">Cette semaine</h3>'
 '<sc-for list="{{ pn.days }}" as="d"><div style="border-top:1px solid var(--color-divider);padding:10px 8px;background:{{ d.bg }}"><div style="display:flex;justify-content:space-between;font:600 20px var(--font-heading)"><span>{{ d.label }}</span><span>{{ d.total }}</span></div>'
 '<sc-for list="{{ d.tasks }}" as="t"><button onClick="{{ t.edit }}" style="all:unset;cursor:pointer;display:flex;gap:10px;font-size:15px;padding:8px 0;min-height:32px"><span style="flex:none;min-width:118px">{{ t.h }}</span><span style="flex:1;min-width:0;text-decoration:underline">{{ t.lieu }} <b>{{ t.pend }}</b></span><span style="flex:none">{{ t.dur }}</span></button></sc-for></div></sc-for></div>'
 '<div style="font-size:14px;line-height:1.4">Touchez un punch de la semaine pour le corriger ou le supprimer. Chaque correction est soumise au superviseur.</div></div></sc-if>\n')
PUNCHF=('<sc-if value="{{ isPunchForm }}"><div style="padding:20px;display:flex;flex-direction:column;gap:16px"><h1 style="margin:0;font-size:34px;line-height:1.05">Démarrer un punch</h1>'
 '<sc-if value="{{ pf.willClose }}"><div style="font-size:15px;border:1px solid var(--color-divider);padding:10px;line-height:1.35">{{ pf.closeTxt }}</div></sc-if>'
 '<sc-if value="{{ pf.hasJobs }}"><div style="display:flex;flex-direction:column;gap:6px"><div style="font-size:15px">Depuis la tournée</div><sc-for list="{{ pf.jobs }}" as="j"><button onClick="{{ j.go }}" style="all:unset;cursor:pointer;padding:12px;border:1px solid var(--color-divider);background:{{ j.bg }};color:{{ j.fg }};display:flex;justify-content:space-between;font-size:17px"><span>{{ j.nom }}</span><span>{{ j.h }}</span></button></sc-for></div></sc-if>'
 +FIELD('Chercher un site','<input class="input" value="{{ pf.q }}" onInput="{{ pf.onQ }}" placeholder="Nom du site…" style="min-height:52px;font-size:18px">')+
 '<div style="display:flex;flex-direction:column;border:1px solid var(--color-divider);max-height:260px;overflow-y:auto"><sc-for list="{{ pf.sites }}" as="s"><button onClick="{{ s.go }}" style="all:unset;cursor:pointer;padding:12px;border-bottom:1px solid var(--color-divider);background:{{ s.bg }};color:{{ s.fg }};display:flex;flex-direction:column"><span style="font-size:17px">{{ s.nom }}</span><span style="font-size:13px">{{ s.ville }}</span></button></sc-for></div>'
 +FIELD('Lieu (ou tapez un autre lieu)','<input class="input" value="{{ pf.lieu }}" onInput="{{ pf.onLieu }}" placeholder="Site ou lieu" style="min-height:52px;font-size:18px">')
 +FIELD('N° ODT (optionnel)','<input class="input" value="{{ pf.odt }}" onInput="{{ pf.onOdt }}" style="min-height:52px;font-size:18px">')
 +FIELD('Détail (optionnel)','<textarea class="input" value="{{ pf.detail }}" onInput="{{ pf.onDetail }}" style="min-height:70px;font-size:17px"></textarea>')
 +FIELD('Km départ (optionnel)','<input class="input" inputmode="decimal" value="{{ pf.km }}" onInput="{{ pf.onKm }}" style="min-height:52px;font-size:18px">')
 +'<sc-if value="{{ pf.hasSource }}"><div style="font-size:15px">Lié à : {{ pf.sourceLabel }}</div></sc-if>'
 +BTN('btn-primary','pf.submit','login','Démarrer le punch')+BTN('btn-secondary','pf.cancel','left','Annuler','52px;font-size:18px')+'</div></sc-if>\n')
STOPF=('<sc-if value="{{ isStopForm }}"><div style="padding:20px;display:flex;flex-direction:column;gap:16px"><h1 style="margin:0;font-size:34px;line-height:1.05">Terminer la journée</h1>'
 '<div class="blueprint" style="padding:18px;display:flex;flex-direction:column;gap:6px">'+CORN+'<div style="font:600 34px/1 var(--font-heading)">{{ sf.total }}</div><div style="font-size:16px">{{ sf.nPunchs }} punch(s) · {{ sf.lieux }}</div></div>'
 +FIELD('Km arrivée (optionnel)','<input class="input" inputmode="decimal" value="{{ sf.km }}" onInput="{{ sf.onKm }}" style="min-height:52px;font-size:18px">')
 +'<div style="font-size:15px;line-height:1.4">Le punch actif sera terminé maintenant et la journée enregistrée.</div>'
 +BTN('btn-primary','sf.submit','check','Valider la journée')+BTN('btn-secondary','sf.cancel','left','Annuler','52px;font-size:18px')+'</div></sc-if>\n')
anchor2='<sc-if value="{{ isLog }}">'
if anchor2 in M: M=M.replace(anchor2,TEMPS+PUNCHF+STOPF+anchor2,1)
else: print('!! ancre isLog')

rep('grid-template-columns:repeat(5,minmax(0,1fr));border-top:1px solid var(--color-text)','grid-template-columns:repeat(6,minmax(0,1fr));border-top:1px solid var(--color-text)')
rep('gap:3px;position:relative;color:{{ t.fg }};box-shadow:{{ t.bar }}','gap:3px;position:relative;color:{{ t.fg }};box-shadow:{{ t.bar }};padding:0 1px')
rep('<sa-i n="{{ t.icon }}" s="26"></sa-i><span style="font-size:12px;font-weight:{{ t.fw }}">','<sa-i n="{{ t.icon }}" s="24"></sa-i><span style="font-size:11px;font-weight:{{ t.fw }}">')
# bouton déconnexion
m=re.search(r'<button([^>]*)>((?:(?!</button>).)*?Se déconnecter)',M,re.S)
if m: M=M.replace(m.group(0),'<button onClick="{{ logout }}"'+m.group(1)+'>'+m.group(2),1); print('logout lié')
else: print('!! bouton déconnexion introuvable')
# blocs ajoutés : écran « Bientôt » et journée vide
SOON='''<sc-if value="{{ isSoon }}"><div style="padding:24px 20px;display:flex;flex-direction:column;gap:16px">
<h1 style="margin:0;font-size:38px;line-height:1">{{ soonTitle }}</h1>
<p style="margin:0;font-size:17px;line-height:1.45">Cette section arrive bientôt dans sa-terrain. En attendant, elle reste disponible dans SA Platform.</p>
<a class="btn btn-primary" href="/" style="min-height:58px;font-size:20px;text-decoration:none;display:flex;align-items:center;justify-content:center">Ouvrir SA Platform</a>
<a class="btn btn-secondary" href="tel:{{ bureauTel }}" style="min-height:58px;font-size:20px;text-decoration:none;display:flex;align-items:center;justify-content:center">Appeler le bureau</a>
<button class="btn btn-secondary" onClick="{{ goToday }}" style="min-height:58px;font-size:20px">Retour à la tournée</button>
</div></sc-if>
'''
anchor='<sc-if value="{{ isLog }}">'
if anchor in M: M=M.replace(anchor,SOON+anchor,1)
else: print('!! ancre isLog introuvable')
EMPTY='<sc-if value="{{ emptyDay }}"><div style="padding:4px 0 12px;font-size:17px;line-height:1.4">Aucun arrêt planifié pour vous aujourd’hui. Consultez le Planning ou appelez le bureau.</div></sc-if>\n'
a2='<h3 style="margin:0;font-size:24px">Tournée</h3>'
if M.count(a2)==1: M=M.replace(a2,a2+EMPTY,1)
else: print('!! ancre Tournée',M.count(a2))

# ---------- COMMUNICATIONS (infolettre, informations, procédures du bureau) ----------
COMM=('<sc-if value="{{ isComm }}"><div style="padding:16px 20px 28px;display:flex;flex-direction:column;gap:6px">'
  '<sc-if value="{{ commLoading }}"><div style="font-size:17px">Chargement…</div></sc-if><sc-if value="{{ commNone }}"><div style="font-size:17px">Aucune communication pour l’instant.</div></sc-if>'
  '<sc-for list="{{ commList }}" as="c"><button onClick="{{ c.open }}" style="all:unset;cursor:pointer;display:flex;flex-direction:column;gap:3px;padding:14px 0;border-bottom:1px solid var(--color-divider)">'
  '<span style="display:flex;gap:8px;align-items:baseline"><span style="font:{{ c.fw }} 20px/1.2 var(--font-heading);flex:1">{{ c.titre }}</span><sc-if value="{{ c.isNew }}"><span style="font:600 13px var(--font-heading);background:var(--color-text);color:var(--color-bg);padding:2px 8px;white-space:nowrap">{{ c.newLbl }}</span></sc-if></span>'
  '<span style="font-size:14px">{{ c.sub }}</span><span style="font-size:15px">{{ c.resume }}</span></button></sc-for>'
  '<button class="btn btn-secondary" onClick="{{ goToday }}" style="min-height:52px;font-size:18px;margin-top:12px">Retour à la tournée</button></div></sc-if>\n'
  '<sc-if value="{{ isCommView }}"><div style="padding:12px 20px 28px;display:flex;flex-direction:column;gap:12px">'
  '<button onClick="{{ commBack }}" style="all:unset;cursor:pointer;display:flex;align-items:center;gap:4px;height:40px;font-size:16px;color:var(--color-accent-700)"><sa-i n="left" s="20"></sa-i>Communications</button>'
  '<h1 style="margin:0;font-size:30px;line-height:1.1">{{ cv.titre }}</h1><div style="font-size:14px">{{ cv.meta }}</div>'
  '<sc-if value="{{ cv.hasResume }}"><div style="font-size:17px;font-style:italic">{{ cv.resume }}</div></sc-if>'
  '<sc-if value="{{ cv.notNews }}"><div style="font-size:17px;line-height:1.5;white-space:pre-wrap">{{ cv.contenu }}</div></sc-if>'
  '<sc-if value="{{ cv.isNews }}"><sc-for list="{{ cv.secs }}" as="s"><div style="display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--color-divider);padding-top:10px">'
  '<h3 style="margin:0;font-size:20px">{{ s.titre }}</h3><div style="font-size:17px;line-height:1.5;white-space:pre-wrap">{{ s.texte }}</div></div></sc-for></sc-if>'
  '<sc-if value="{{ cv.mustConfirm }}"><button class="btn btn-primary" onClick="{{ cv.confirm }}" style="min-height:60px;font-size:19px;margin-top:8px">{{ cv.confLbl }}</button></sc-if>'
  '<sc-if value="{{ cv.confirmed }}"><div style="font:600 17px var(--font-heading);display:flex;gap:6px;align-items:center"><sa-i n="check" s="20"></sa-i>Lecture confirmée</div></sc-if>'
  '</div></sc-if>\n')
anchor='<sc-if value="{{ isLog }}">'
if anchor in M: M=M.replace(anchor,COMM+anchor,1)
else: print('!! ancre isLog (Communications)')
# Accueil : bandeau « à lire » en tête de la tournée, et accès permanent sous les tuiles
CB='<sc-if value="{{ hasCommUnread }}"><button onClick="{{ goComm }}" style="all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;padding:14px 16px;background:var(--color-text);color:var(--color-bg);font:600 18px var(--font-heading)"><sa-i n="megaphone" s="22"></sa-i><span style="flex:1">{{ commBanner }}</span><sa-i n="right" s="20"></sa-i></button></sc-if>\n'
a2=re.search(r'<div style="font-size:16px">Tournée · \{\{ jobCount \}\} arrêts · \{\{ doneTxt \}\}</div>\s*</div>',M)
if a2: M=M[:a2.end()]+CB+M[a2.end():]
else: print('!! ancre en-tête du jour (Communications)')
tile='<a href="tel:{{ bureauTel }}"'
k=M.find(tile)
if k>=0:
    e=M.find('</div>',M.find('</a>',k))
    M=M[:e+6]+'<button onClick="{{ goComm }}" style="all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;padding:14px 16px;border:1px solid var(--color-divider);font:600 18px var(--font-heading)"><sa-i n="megaphone" s="22"></sa-i><span style="flex:1">Communications</span><sa-i n="right" s="20"></sa-i></button>'+M[e+6:]
else: print('!! tuile Appeler le bureau')

# ---------- MODULES AJOUTÉS : Logistique, Hivernage, correction de punch, photo de demande ----------
def sc_block(M,start):
    i=M.find(start)
    if i<0: return None
    depth=0
    for m in re.finditer(r'<sc-if\b|</sc-if>',M[i:]):
        depth+= 1 if m.group(0).startswith('<sc-if') else -1
        if depth==0: return M[i:i+m.end()]
rep('{{ hivDoneCount }}<span style="font-weight:400;font-size:22px"> / 33</span>','{{ hivDoneCount }}<span style="font-weight:400;font-size:22px"> / {{ hivTotalSites }}</span>',1)
# Sortie : plus de « camion » fictif — stock réel de l'inventaire, destination = site du punch en cours
rep('Camion 07 → {{ logSite }}','Pour : {{ logSite }}',1)
rep('En camion : {{ p.reste }} {{ p.unite }}','En stock : {{ p.reste }} {{ p.unite }}',1)
rep('<sc-for list="{{ inventaire }}" as="p">','<input class="input" value="{{ invQ }}" onInput="{{ invQ_ }}" placeholder="Chercher un article…" style="min-height:48px;font-size:17px;margin-bottom:8px"><sc-if value="{{ noInv }}"><div style="font-size:15px;padding:8px 0">Inventaire en chargement ou indisponible.</div></sc-if><sc-for list="{{ inventaire }}" as="p">',1)
M=M.replace('onInput="{{ invQ_ }}"','onInput="{{ onInvQ }}"')
# Bon : liste des bons en attente, puis le bon choisi (signature du client)
B=sc_block(M,'<sc-if value="{{ isBon }}">')
if B:
    head='<sc-if value="{{ isBon }}">'
    inner=B[len(head):-len('</sc-if>')]
    PICK=('<sc-if value="{{ bonPick }}"><div style="display:flex;flex-direction:column;gap:12px">'
      '<sc-if value="{{ hasLastSortie }}"><button class="btn btn-primary" onClick="{{ newBon }}" style="min-height:56px;font-size:18px">Nouveau bon depuis la sortie · {{ lastSortieTxt }}</button></sc-if>'
      '<h3 style="margin:4px 0 0;font-size:22px">Bons à livrer</h3>'
      '<sc-if value="{{ noBons }}"><div style="font-size:15px">Aucun bon en attente de livraison.</div></sc-if>'
      '<sc-for list="{{ bonList }}" as="b"><button onClick="{{ b.open }}" style="all:unset;cursor:pointer;display:flex;flex-direction:column;gap:2px;padding:12px 0;border-top:1px solid var(--color-divider)">'
      '<span style="font:600 19px var(--font-heading)">{{ b.no }} · {{ b.client }}</span><span style="font-size:14px">{{ b.sub }}</span></button></sc-for></div></sc-if>')
    BACK='<button onClick="{{ bonBack }}" style="all:unset;cursor:pointer;display:flex;align-items:center;gap:4px;height:40px;font-size:16px;color:var(--color-accent-700)"><sa-i n="left" s="20"></sa-i>Bons à livrer</button>'
    M=M.replace(B,head+PICK+'<sc-if value="{{ bonOpen }}">'+BACK+inner+'</sc-if></sc-if>',1)
else: print('!! bloc isBon')
rep('<span style="font:600 24px var(--font-heading)">BL-26-0932</span>','<span style="font:600 24px var(--font-heading)">{{ bon.no }}</span>',1)
rep('<span style="font-size:15px">{{ logClient }} · {{ logSite }}</span>','<span style="font-size:15px">{{ bon.client }} · {{ bon.addr }}</span>',1)
rep('— copie envoyée au client','— bon marqué livré',1)
# légende hivernage : pas de planification « cette semaine » dans les données → deux états réels seulement
rep(r'<span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;box-sizing:border-box;border:1px solid var\(--color-text\);background:repeating-linear-gradient[^"]*"></span>Cette semaine</span>','',1,regex=True)
rep('>À planifier</span>','>À faire</span>',1)
# nom lu à chaque frappe (onChange n'arrive qu'à la sortie du champ : « Confirmer » touché juste après aurait lu un nom vide)
rep('value="{{ signer }}" onChange="{{ onSigner }}"','value="{{ signer }}" onInput="{{ onSigner }}"',1)
# Hivernage : remarques réellement enregistrées
rep('<textarea class="input" placeholder="Bris, pièces à commander, remarques"','<textarea class="input" value="{{ hivNoteTxt }}" onInput="{{ onHivNote }}" placeholder="Bris, pièces à commander, remarques"',1)
# Demande : photo jointe ; plus de promesse de rappel automatique (aucun répartiteur n'est avisé automatiquement)
rep('Le répartiteur est avisé immédiatement et vous rappelle.','La demande part au bureau tout de suite. Pour une urgence, appelez aussi le bureau.',1)
rep('<button class="btn btn-primary" onClick="{{ sendDemande }}"','<button class="btn btn-secondary" onClick="{{ demPhotoBtn }}" style="min-height:52px;font-size:18px;gap:10px"><sa-i n="camera" s="20"></sa-i>{{ demPhotoLbl }}</button><button class="btn btn-primary" onClick="{{ sendDemande }}"',1)
# Correction d'un punch
PEDIT=('<sc-if value="{{ isPunchEdit }}"><div style="padding:20px;display:flex;flex-direction:column;gap:16px"><h1 style="margin:0;font-size:34px;line-height:1.05">Corriger un punch</h1>'
 +FIELD('Lieu','<input class="input" value="{{ pe.lieu }}" onInput="{{ pe.onLieu }}" style="min-height:52px;font-size:18px">')
 +FIELD('Début','<input class="input" type="time" value="{{ pe.start }}" onInput="{{ pe.onStart }}" style="min-height:52px;font-size:18px">')
 +FIELD('Fin','<input class="input" type="time" value="{{ pe.end }}" onInput="{{ pe.onEnd }}" style="min-height:52px;font-size:18px">')
 +'<sc-if value="{{ pe.active }}"><div style="font-size:15px">Punch en cours : laissez la fin vide pour qu’il continue.</div></sc-if>'
 +'<div style="font-size:15px;line-height:1.4">La correction sera marquée « à valider » pour le superviseur.</div>'
 +BTN('btn-primary','pe.save','check','Enregistrer')+BTN('btn-secondary','pe.del','x','{{ pe.delLabel }}','52px;font-size:18px')+BTN('btn-secondary','pe.cancel','left','Annuler','52px;font-size:18px')+'</div></sc-if>\n')
anchor3='<sc-if value="{{ isLog }}">'
if anchor3 in M: M=M.replace(anchor3,PEDIT+anchor3,1)
else: print('!! ancre isLog (PEDIT)')

# Message temporaire : visible mais « traversable » — sinon il bloque 2,6 s ce qui est dessous (ex. le cadre de signature)
rep('bottom:100px;z-index:30;padding:14px 16px;','bottom:100px;z-index:30;pointer-events:none;padding:14px 16px;',1)
# --- finitions ---
rep('Punché à {{ punchAt }} · {{ cur.ville }}','{{ punchShort }} · {{ cur.ville }}',1)
rep('<span class="tag tag-outline" style="font-size:13px;padding:4px 10px;display:inline-block;white-space:nowrap">Contrat {{ cur.contrat }}</span>','<sc-if value="{{ cur.hasContrat }}"><span class="tag tag-outline" style="font-size:13px;padding:4px 10px;display:inline-block;white-space:nowrap">Contrat {{ cur.contrat }}</span></sc-if>',1)
rep('{{ hivDoneCount }}/33','{{ hivDoneCount }}/{{ hivTotalSites }}',1)

open(os.path.join(OUT,'terrain.markup.html'),'w',encoding='utf-8').write(M)
ds=open(os.path.join(SRC,'design')+'/ds/styles.css',encoding='utf-8').read()
ds=re.sub(r"@import url\([^)]*\);\s*",'',ds)
icons=open(os.path.join(SRC,'design')+'/sa-icons.js',encoding='utf-8').read()
rt=open(os.path.join(HERE,'runtime.js'),encoding='utf-8').read(); app=open(os.path.join(HERE,'app.js'),encoding='utf-8').read()
html='''<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="SA Terrain"><meta name="theme-color" content="#f2f2f3">
<title>SA Terrain — La Tournée</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;700&family=Barlow+Condensed:wght@400;600&display=swap" rel="stylesheet">
<style>
'''+ds+'''
html,body{margin:0;height:100%;background:var(--color-bg);-webkit-text-size-adjust:100%;overscroll-behavior:none}
#app{position:fixed;inset:0}
#app>div{height:100%}
button{font-family:inherit}
#login{position:fixed;inset:0;background:var(--color-bg);display:none;flex-direction:column;align-items:center;justify-content:center;padding:24px;z-index:50;overflow:auto}
#login::before{content:"";position:absolute;left:0;right:0;top:0;height:38%;background:#004987;z-index:-1}
#login form{width:100%;max-width:380px;display:flex;flex-direction:column;gap:16px;background:var(--color-bg);padding:26px 24px 22px;box-shadow:0 8px 30px rgba(0,30,60,.18);box-sizing:border-box}
#login .logo{width:132px;height:132px;display:block;margin:0 auto 18px;border:4px solid #fff;box-shadow:0 6px 20px rgba(0,0,0,.25)}
#welcome{position:fixed;inset:0;z-index:60;background:#004987;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;transition:opacity .5s}
#welcome img{width:120px;height:120px;border:4px solid #fff}
#welcome h1{margin:0;font:600 38px/1.1 var(--font-heading)}
#login h1{margin:0;font-size:44px;line-height:1}
#login .input{font-size:18px;min-height:52px}
'''+'\n'.join(css)+'''
</style></head><body>
<div id="app"></div>
<div id="login"><img class="logo" src="'''+LOGO+'''" alt="Soucy Aquatik"><form id="loginForm" autocomplete="on">
<div style="font:400 14px var(--font-body);color:var(--color-accent-700)">Soucy Aquatik · application terrain</div>
<h1>La Tournée</h1>
<div style="font-size:15px;line-height:1.4">Bienvenue ! Connectez-vous avec votre identifiant SA Platform pour voir votre tournée, puncher et saisir vos relevés.</div>
<div class="field"><label style="font-size:15px">Identifiant</label><input id="lu" class="input" autocomplete="username" autocapitalize="off" autocorrect="off"></div>
<div class="field"><label style="font-size:15px">Mot de passe</label><input id="lp" class="input" type="password" autocomplete="current-password"></div>
<div id="le" style="min-height:22px;font-size:15px"></div>
<button class="btn btn-primary" type="submit" style="min-height:58px;font-size:20px">Se connecter</button>
</form><div style="margin-top:18px;font-size:13px;color:var(--color-accent-700);text-align:center">Mot de passe oublié ? Demandez à votre superviseur.</div></div>
<input id="photoInput" type="file" accept="image/*" capture="environment" style="display:none">
<template id="tpl">'''+M+'''</template>
<script>'''+icons+'''</script>
<script>'''+rt+'''</script>
<script>'''+app+'''</script>
</body></html>'''
open(os.path.join(OUT,'terrain.html'),'w',encoding='utf-8').write(html)
print('taille',len(html),'règles hover/active',len(css))
