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
 '<sc-for list="{{ d.tasks }}" as="t"><div style="display:flex;gap:10px;font-size:15px;padding:3px 0"><span style="flex:none;min-width:118px">{{ t.h }}</span><span style="flex:1;min-width:0">{{ t.lieu }} <b>{{ t.pend }}</b></span><span style="flex:none">{{ t.dur }}</span></div></sc-for></div></sc-for></div>'
 '<div style="font-size:14px;line-height:1.4">Pour corriger ou supprimer un punch, ouvrez SA Platform.</div></div></sc-if>\n')
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

# --- finitions ---
rep('Punché à {{ punchAt }} · {{ cur.ville }}','{{ punchShort }} · {{ cur.ville }}',1)
rep('<span class="tag tag-outline" style="font-size:13px;padding:4px 10px;display:inline-block;white-space:nowrap">Contrat {{ cur.contrat }}</span>','<sc-if value="{{ cur.hasContrat }}"><span class="tag tag-outline" style="font-size:13px;padding:4px 10px;display:inline-block;white-space:nowrap">Contrat {{ cur.contrat }}</span></sc-if>',1)
rep('{{ hivDoneCount }}/33','Bientôt')

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
#login{position:fixed;inset:0;background:var(--color-bg);display:none;align-items:center;justify-content:center;padding:24px;z-index:50}
#login form{width:100%;max-width:360px;display:flex;flex-direction:column;gap:16px}
#login h1{margin:0;font-size:44px;line-height:1}
#login .input{font-size:18px;min-height:52px}
'''+'\n'.join(css)+'''
</style></head><body>
<div id="app"></div>
<div id="login"><form id="loginForm" autocomplete="on">
<div style="font:400 14px var(--font-body);color:var(--color-accent-700)">Soucy Aquatik · sa-terrain</div>
<h1>La Tournée</h1>
<div class="field"><label style="font-size:15px">Identifiant</label><input id="lu" class="input" autocomplete="username" autocapitalize="off" autocorrect="off"></div>
<div class="field"><label style="font-size:15px">Mot de passe</label><input id="lp" class="input" type="password" autocomplete="current-password"></div>
<div id="le" style="min-height:22px;font-size:15px"></div>
<button class="btn btn-primary" type="submit" style="min-height:58px;font-size:20px">Se connecter</button>
</form></div>
<input id="photoInput" type="file" accept="image/*" capture="environment" style="display:none">
<template id="tpl">'''+M+'''</template>
<script>'''+icons+'''</script>
<script>'''+rt+'''</script>
<script>'''+app+'''</script>
</body></html>'''
open(os.path.join(OUT,'terrain.html'),'w',encoding='utf-8').write(html)
print('taille',len(html),'règles hover/active',len(css))
