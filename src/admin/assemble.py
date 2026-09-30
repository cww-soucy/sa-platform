import re
import os
HERE=os.path.dirname(os.path.abspath(__file__));SRC=os.path.dirname(HERE);OUT=os.path.join(SRC,'build')
M=open(os.path.join(OUT,'admin_markup.txt'),encoding='utf-8').read()
def block(M,name):
    i=M.find('<sc-if value="{{ %s }}"'%name)
    if i<0: return None
    depth=0
    for m in re.finditer(r'<sc-if\b|</sc-if>',M[i:]):
        depth+= 1 if m.group(0).startswith('<sc-if') else -1
        if depth==0: return M[i:i+m.end()]
for n in ['isCommunication']:
    b=block(M,n)
    if b: M=M.replace(b,'',1)
    else: print('!! absent',n)
M=re.sub(r'<helmet>.*?</helmet>','',M,flags=re.S)
M=re.sub(r'\s+hint-[a-z-]+="[^"]*"','',M)
css=[];k=[0]
def sty(m):
    kind=m.group(1);decl=m.group(2);k[0]+=1
    css.append('[data-%s="%d"]:%s{%s}'%('hv' if kind=='hover' else 'ac',k[0],'hover' if kind=='hover' else 'active',';'.join(d.strip()+' !important' for d in decl.split(';') if d.strip())))
    return ' data-%s="%d"'%('hv' if kind=='hover' else 'ac',k[0])
M=re.sub(r'\s+style-(hover|active)="([^"]*)"',sty,M)
def rep(a,b,c=None):
    global M
    n=M.count(a)
    if n==0: print('!! introuvable:',a[:60]); return
    M=M.replace(a,b)
rep('En direct · jeu 1er oct. · 09:42','{{ liveTxt }}')
rep('Geneviève Lemieux','{{ meNom }}'); rep('>GL<','>{{ meIni }}<'); rep('>Coordination<','>{{ meRole }}<')
# nav: ajout du lien de déconnexion sous le profil
m=re.search(r'(<span style="font-weight:500">\{\{ meNom \}\}</span><span style="font-size:12px">\{\{ meRole \}\}</span>)',M)
if m: M=M.replace(m.group(1),m.group(1)+'<button onClick="{{ logout }}" style="all:unset;cursor:pointer;font-size:12px;text-decoration:underline;margin-top:2px">Se déconnecter</button>',1)
else: print('!! bloc profil')
# écrans ajoutés : chargement/erreur et « Bientôt »
LOAD='<sc-if value="{{ isLoading }}"><div style="padding:32px 28px;font-size:16px">Chargement des données réelles…<br><span style="font-size:14px">{{ loadErr }}</span></div></sc-if>\n'
SOON='''<sc-if value="{{ isSoon }}"><div style="padding:28px;max-width:640px;display:flex;flex-direction:column;gap:14px">
<h2 style="margin:0;font-size:34px">{{ soonTitle }}</h2>
<p style="margin:0;font-size:16px;line-height:1.5">Ce module arrive dans une prochaine version de sa-admin. En attendant, il reste disponible dans SA Platform, qui continue de fonctionner normalement.</p>
<a class="btn btn-primary" href="/" style="text-decoration:none;width:fit-content;padding:0 18px;min-height:44px;display:inline-flex;align-items:center">Ouvrir SA Platform</a></div></sc-if>
'''
WARN='<sc-if value="{{ hasWarn }}"><div role="alert" style="margin:0 0 16px;padding:10px 14px;border:2px solid var(--color-accent-900);font-size:14px;line-height:1.4;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:240px">{{ warnTxt }}</span><button onClick="{{ retry }}" class="btn" style="min-height:32px">Réessayer</button></div></sc-if>\n'
mm=re.search(r'<main[^>]*>',M)
if mm: M=M[:mm.end()]+WARN+LOAD+SOON+M[mm.end():]
else: print('!! <main> introuvable')

# ---------- Temps + Planning : navigation de semaine, libellés dynamiques ----------
NAV=lambda p,n,l:('<div style="display:flex;align-items:center;gap:8px"><button class="btn btn-secondary btn-icon" aria-label="Semaine précédente" onClick="{{ %s }}"><sa-i n="left" s="18"></sa-i></button><span style="font:600 20px var(--font-heading);padding:0 8px">{{ %s }}</span><button class="btn btn-secondary btn-icon" aria-label="Semaine suivante" onClick="{{ %s }}"><sa-i n="right" s="18"></sa-i></button></div>'%(p,l,n))
# Temps : navigation de semaine juste après l'ouverture du bloc
mt=re.search(r'(<sc-if value="\{\{ isTemps \}\}"[^>]*>\s*<div style="display:flex;flex-direction:column;gap:18px">)',M)
if mt: M=M.replace(mt.group(1),mt.group(1)+NAV('tPrev','tNext','tLabel'),1)
else: print('!! Temps intro')
# Cumul : en-tête dynamique (1re occurrence de Semaine 40 = Planning, 2e = Cumul, selon l'ordre du gabarit)
ip=M.find('value="{{ isPlanning }}"'); it=M.find('value="{{ isTemps }}"')
def swap_first(start,new_txt):
    k=M.find('Semaine 40',start); return M[:k]+new_txt+M[k+len('Semaine 40'):] if k>=0 else M
M=swap_first(ip if ip>=0 else 0,'{{ pLabel }}')
M=swap_first(M.find('value="{{ isCumulTab }}"'),'{{ tLabel }}')
# flèches du planning
def arrow(label,fn):
    global M
    k=M.find('aria-label="%s"'%label,ip)
    if k>=0: M=M[:k]+'onClick="{{ %s }}" '%fn+M[k:]
    else: print('!! flèche',label)
arrow('Semaine précédente','pPrev'); arrow('Semaine suivante','pNext')
rep('{{ r.hours }} h planifiées','{{ r.hours }}')
rep('Valeurs produites par le calcul existant — affichage seulement, aucune règle modifiée','Lecture seule · heures des punchs terminés (● = punch en cours) · banque et heures sup. : SA Platform › Cumul')


# ---------- ÉTAPES 1-2 : dialogues de modification (WO/créneau/tâche) et fiche de site ----------
FL=lambda lab,inner: '<div class="field"><label>%s</label>%s</div>'%(lab,inner)
SEL=lambda opts,fn:'<select class="input" onChange="{{ %s }}"><template data-sc="for" list="{{ %s }}" as="o"><option value="{{ o.v }}" selected="{{ o.sel }}">{{ o.l }}</option></template></select>'%(fn,opts)
SEG=lambda lst:'<div style="display:flex;border:1px solid var(--color-divider);align-self:flex-start"><template data-sc="for" list="{{ %s }}" as="t"><button onClick="{{ t.go }}" style="all:unset;cursor:pointer;white-space:nowrap;padding:7px 14px;font:600 15px var(--font-heading);border-right:1px solid var(--color-divider);background:{{ t.bg }};color:{{ t.fg }}">{{ t.label }}</button></template></div>'%lst
IF=lambda v,inner:'<template data-sc="if" value="{{ %s }}">%s</template>'%(v,inner)
BTNX=lambda cls,fn,txt:'<button class="btn %s" onClick="{{ %s }}" style="white-space:nowrap">%s</button>'%(cls,fn,txt)
DLGHEAD=lambda title,close:'<div style="display:flex;align-items:center;justify-content:space-between"><span class="dialog-title" style="font-size:24px">{{ %s }}</span><button class="btn btn-ghost btn-icon" onClick="{{ %s }}" aria-label="Fermer"><sa-i n="x" s="20"></sa-i></button></div>'%(title,close)
WRAP=lambda flag,bg,inner:'<template data-sc="if" value="{{ %s }}"><div class="dialog-backdrop" onClick="{{ %s }}" style="z-index:60"><div class="dialog" onClick="{{ stop }}" style="width:min(560px,100%%);background:var(--color-bg);max-height:calc(100vh - 40px);overflow-y:auto;gap:16px;padding:22px 24px;border:1px solid var(--color-text)">%s</div></div></template>\n'%(flag,bg,inner)
EDIT=WRAP('edOpen','edCloseBg',DLGHEAD('edTitle','edClose')+IF('edLoading','<div>Chargement…</div>')+IF('edReady',
  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'+IF('edCanDate',FL('Date','<input class="input" type="date" value="{{ edDate }}" onChange="{{ onEdDate }}">'))+IF('edShowHeure',FL('Heure','<input class="input" type="time" value="{{ edHeure }}" onChange="{{ onEdHeure }}">'))+'</div>'
  +IF('edMultiJour','<div style="font-size:13px">Tâche sur plusieurs jours : les dates se modifient dans SA Platform.</div>')
  +IF('edMulti','<div style="font-size:13px">Plusieurs techniciens assignés : la réassignation se fait dans SA Platform.</div>')
  +'<template data-sc="if" value="{{ edMultiFalse }}"></template>'
  +FL('Technicien',SEL('edTechOpts','onEdTech'))+FL('Statut',SEG('edStatuts'))
  +IF('edC0','<div class="dialog-actions" style="margin-top:0;flex-wrap:wrap">'+BTNX('btn-secondary','edAsk1','Supprimer')+IF('edSerie',BTNX('btn-secondary','edAsk2','Supprimer la série à venir'))+BTNX('btn-primary','edSave','Enregistrer')+'</div>')
  +IF('edC1','<div style="border:1px solid var(--color-text);padding:12px;font-size:15px">Supprimer cet élément ? Une copie de sécurité est conservée.</div><div class="dialog-actions" style="margin-top:0">'+BTNX('btn-secondary','edBack','Annuler')+BTNX('btn-primary','edDo1','Oui, supprimer')+'</div>')
  +IF('edC2','<div style="border:1px solid var(--color-text);padding:12px;font-size:15px">Supprimer les <b>{{ edSerieN }}</b> occurrences à venir de cette série (seulement celles non commencées) ? Une copie de sécurité est conservée.</div><div class="dialog-actions" style="margin-top:0">'+BTNX('btn-secondary','edBack','Annuler')+BTNX('btn-primary','edDo2','Oui, supprimer la série')+'</div>')))
SITE=WRAP('sdOpen','sdCloseBg',DLGHEAD('sdNom','sdClose')
  +FL('Nom du site','<input class="input" value="{{ sdNom }}" onChange="{{ onSdNom }}">')+FL('Adresse','<input class="input" value="{{ sdAddr }}" onChange="{{ onSdAddr }}">')
  +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'+FL('Type de bassin',SEL('sdTypes','onSdType'))+FL('N° de contrat (optionnel)','<input class="input" value="{{ sdCode }}" onChange="{{ onSdCode }}">')+'</div>'
  +'<div style="font-size:13px">Le nom sert à relier les bons de travail : ne le changez que pour corriger une faute.</div>'
  +'<div class="dialog-actions" style="margin-top:0;flex-wrap:wrap">'+BTNX('btn-secondary','sdRelevés','Voir les relevés')+BTNX('btn-primary','sdSave','Enregistrer')+'</div>')
M=M.rstrip()+'\n'+EDIT+SITE
# créneaux/tâches/WO : cliquables dans la grille et dans les dossiers
ms=re.search(r'<div style="padding:5px 7px;border:1px solid var\(--color-text\);background:\{\{ s\.bg \}\}',M)
if ms: M=M.replace(ms.group(0),'<div onClick="{{ s.open }}" style="cursor:pointer;padding:5px 7px;border:1px solid var(--color-text);background:{{ s.bg }}',1)
else: print('!! slot')
mv=re.search(r'<tr>(<td style="padding:var\(--sa-row,8px\) 8px;white-space:nowrap;font-weight:500">\{\{ v\.date \}\})',M)
if mv: M=M.replace(mv.group(0),'<tr onClick="{{ v.open }}" style="cursor:pointer">'+mv.group(1),1)
else: print('!! visite')


# ---------- Sondages : saisie de clé, résultats masqués tant qu'elle n'est pas fournie ----------
KEYBOX=('<div style="display:flex;flex-direction:column;gap:14px;max-width:420px"><h3 style="margin:0;font-size:22px">Clé d’accès requise</h3>'
 '<p style="margin:0;font-size:14px;line-height:1.4">Les réponses des sondages sont protégées par une clé, gardée uniquement dans ce navigateur — jamais dans le fichier de l’app.</p>'
 '<div class="field"><label>Clé d’accès</label><input class="input" type="password" value="{{ keyVal }}" onChange="{{ onKey }}"></div>'
 '<button class="btn btn-primary" onClick="{{ saveKey }}" style="align-self:flex-start">Valider</button></div>')
mm=re.search(r'(<sc-if value="\{\{ isSondages \}\}"[^>]*>\s*<div style="display:grid;grid-template-columns:300px minmax\(0,1fr\);gap:24px;align-items:start">)',M)
if mm: M=M.replace(mm.group(0),mm.group(0)+'<template data-sc="if" value="{{ needKey }}">'+KEYBOX+'</template><template data-sc="if" value="{{ noSurvey }}"><div style="padding:20px">Aucun sondage pour l’instant.</div></template>',1)
else: print('!! intro Sondages')
rep("this.setState({ dlg: true })","self.openDlg({})") if False else None


FL2=lambda lab,inner: '<div class="field"><label>%s</label>%s</div>'%(lab,inner)
FIX=('<template data-sc="if" value="{{ fxOpen }}"><div class="dialog-backdrop" onClick="{{ fxCloseBg }}" style="z-index:60"><div class="dialog" onClick="{{ stop }}" style="width:min(460px,100%);background:var(--color-bg);padding:22px 24px;border:1px solid var(--color-text);display:flex;flex-direction:column;gap:14px">'
 '<div style="display:flex;align-items:center;justify-content:space-between"><span class="dialog-title" style="font-size:22px">Corriger un punch</span><button class="btn btn-ghost btn-icon" onClick="{{ fxClose }}" aria-label="Fermer"><sa-i n="x" s="20"></sa-i></button></div>'
 '<div style="font-size:14px">{{ fxTitle }}</div>'
 +FL2('Lieu','<input class="input" value="{{ fxLieu }}" onChange="{{ onFxLieu }}">')
 +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'+FL2('Entrée','<input class="input" type="time" value="{{ fxEntree }}" onChange="{{ onFxEntree }}">')+FL2('Sortie','<input class="input" type="time" value="{{ fxSortie }}" onChange="{{ onFxSortie }}">')+'</div>'
 +'<div class="dialog-actions" style="margin-top:0"><button class="btn btn-secondary" onClick="{{ fxClose }}">Annuler</button><button class="btn btn-primary" onClick="{{ fxSave }}">Enregistrer</button></div></div></div></template>\n')
M=M.rstrip()+'\n'+FIX

b=block(M,'isInspections')
if b:
    nb=b.replace('<sc-if value="{{ isInspections }}">','<sc-if value="{{ isInspections }}"><sc-if value="{{ noHist }}"><div style="margin:12px 28px 0;padding:12px 14px;border:1px dashed var(--color-text);font-size:15px">{{ histMsg }}</div></sc-if>',1)
    M=M.replace(b,nb,1)
b=block(M,'isOperations')
if b:
    nb=b.replace('<sc-if value="{{ isOperations }}">','<sc-if value="{{ isOperations }}"><sc-if value="{{ noDossier }}"><div style="margin:12px 28px 0;padding:12px 14px;border:1px dashed var(--color-text);font-size:15px">Aucun dossier pour ce filtre.</div></sc-if>',1)
    M=M.replace(b,nb,1)
b=block(M,'isSites')
if b:
    nb=b.replace('<sc-if value="{{ isSites }}">','<sc-if value="{{ isSites }}"><sc-if value="{{ noNouveaux }}"><div style="margin:12px 28px 0;padding:12px 14px;border:1px dashed var(--color-text);font-size:15px">Aucun site détecté automatiquement en attente.</div></sc-if>',1)
    M=M.replace(b,nb,1)


# ---------- TEMPS · PAIE (gestion complète, comme SA Platform) et STATS ----------
TH='<th style="text-transform:none;letter-spacing:0;font-size:12px;%s">%s</th>'
TD='<td style="padding:var(--sa-row,10px) 8px;%s">%s</td>'
CARD=lambda inner,st='': '<section class="blueprint" style="display:flex;flex-direction:column;%s"><i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>%s</section>'%(st,inner)
NAV=lambda prev,lab,nxt,today: ('<div style="display:flex;align-items:center;gap:8px"><button class="btn btn-secondary btn-icon" aria-label="Semaine précédente" onClick="{{ %s }}"><sa-i n="left" s="18"></sa-i></button>'
  '<span style="font:600 20px var(--font-heading);padding:0 8px">{{ %s }}</span><button class="btn btn-secondary btn-icon" aria-label="Semaine suivante" onClick="{{ %s }}"><sa-i n="right" s="18"></sa-i></button>'
  '<button class="btn btn-ghost" onClick="{{ %s }}">Cette semaine</button></div>')%(prev,lab,nxt,today)
TABS=('<div style="display:flex;border:1px solid var(--color-divider)"><sc-for list="{{ tempsTabs }}" as="t"><button onClick="{{ t.go }}" style="all:unset;cursor:pointer;white-space:nowrap;padding:8px 18px;font:600 16px var(--font-heading);border-right:1px solid var(--color-divider);background:{{ t.bg }};color:{{ t.fg }}">{{ t.label }} <span style="font-weight:400">{{ t.n }}</span></button></sc-for></div>')
SEMAINE=CARD('<div style="padding:12px 18px;border-bottom:1px solid var(--color-divider);display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><span style="font:600 22px var(--font-heading)">Équipe : {{ tTeam }}</span><span style="font-size:14px">{{ tTeamSupp }}</span></div>'
  '<table class="table" style="font-size:14px"><thead><tr>'+TH%('padding-left:18px','Technicien')+'<sc-for list="{{ tDays }}" as="w">'+TH%('text-align:center;background:{{ w.bg }}','{{ w.label }}')+'</sc-for>'
  +TH%('text-align:right','Total')+TH%('text-align:right','Régulières')+TH%('text-align:right','Supp.')+TH%('','État')+TH%('','')+'</tr></thead><tbody>'
  '<sc-for list="{{ tRows }}" as="r"><tr><td style="padding:var(--sa-row,10px) 8px var(--sa-row,10px) 18px;font-weight:500;white-space:nowrap">{{ r.nom }}</td>'
  '<sc-for list="{{ r.jours }}" as="j"><td style="padding:2px;text-align:center"><button onClick="{{ j.open }}" style="all:unset;cursor:pointer;display:block;min-width:58px;padding:7px 4px;background:{{ j.bg }};font-variant-numeric:tabular-nums">{{ j.txt }} <b>{{ j.ok }}</b></button></td></sc-for>'
  +TD%('text-align:right;font:600 16px var(--font-heading);white-space:nowrap','{{ r.total }}')+TD%('text-align:right;white-space:nowrap','{{ r.reg }}')+TD%('text-align:right;white-space:nowrap;color:{{ r.suppFg }}','{{ r.supp }}')
  +TD%('font-size:13px;white-space:nowrap','{{ r.etat }}')+'<td style="padding:4px 18px 4px 8px"><sc-if value="{{ r.canApprove }}"><button class="btn btn-secondary" onClick="{{ r.approve }}" style="white-space:nowrap">Approuver la semaine</button></sc-if></td></tr></sc-for></tbody></table>'
  '<sc-if value="{{ noTRows }}"><div style="padding:14px 18px">Aucun employé actif.</div></sc-if>'
  '<div style="padding:10px 18px;font-size:13px;border-top:1px solid var(--color-divider)">Touchez une journée pour voir, corriger, ajouter ou supprimer des punchs. ● = punch en cours · ✓ = journée approuvée · 40 h régulières, le surplus en supplémentaires.</div>','overflow-x:auto')
PAIE=('<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="font-size:14px">{{ paieCount }}</span><button class="btn btn-ghost" onClick="{{ paieAll }}">Tout</button><button class="btn btn-ghost" onClick="{{ paieNoneSel }}">Aucun</button>'
  +SEG('paieModes')+'<span style="flex:1"></span><button class="btn btn-primary" onClick="{{ paieXlsx }}" style="gap:8px"><sa-i n="download" s="17"></sa-i>Télécharger Excel</button>'
  '<button class="btn btn-secondary" onClick="{{ paiePrint }}">Imprimer</button><button class="btn btn-secondary" onClick="{{ paieSent }}">Marquer envoyée(s) à la paie</button></div>'
  '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label style="font-size:14px" for="emailPaie">Courriel de la paie</label><input id="emailPaie" class="input" type="email" placeholder="paie@exemple.com" value="{{ emailPaie }}" onInput="{{ onEmailPaie }}" style="max-width:280px">'
  '<button class="btn btn-secondary" onClick="{{ paieMail }}" style="gap:8px"><sa-i n="send" s="16"></sa-i>Préparer le courriel à la paie</button><span style="font-size:13px">Télécharge l’Excel, ouvre votre logiciel de courriel avec le résumé et marque les feuilles envoyées — il reste à joindre le fichier.</span></div>'
  '<div style="font-size:13px">Heures en décimal pour la paie (7,25 = 7 h 15). La feuille regroupe les punchs d’une même journée sur un même lieu et ODT ; le journal les montre un par un. Le fichier Excel contient un sommaire, une feuille par employé et le journal complet.</div>'
  +CARD('<sc-for list="{{ paie }}" as="p"><div style="display:grid;grid-template-columns:40px minmax(160px,1.4fr) repeat(3,90px) 70px minmax(160px,1.6fr) 44px;gap:10px;align-items:center;padding:10px 18px;border-bottom:1px solid var(--color-divider)">'
  '<button onClick="{{ p.toggle }}" aria-label="Sélectionner" style="all:unset;cursor:pointer;width:24px;height:24px;border:1.5px solid var(--color-text);background:{{ p.box }};color:var(--color-bg);display:flex;align-items:center;justify-content:center"><sc-if value="{{ p.on }}"><sa-i n="check" s="16" w="2.5"></sa-i></sc-if></button>'
  '<span style="font-weight:500">{{ p.nom }}</span><span style="text-align:right;font:600 16px var(--font-heading)">{{ p.total }} h</span><span style="text-align:right">{{ p.reg }} rég.</span><span style="text-align:right">{{ p.supp }} supp.</span><span style="text-align:right">{{ p.punchs }}</span>'
  '<span style="font-size:13px">{{ p.statut }}</span><button class="btn btn-ghost btn-icon" onClick="{{ p.expand }}" aria-label="Détail"><sa-i n="{{ p.chev }}" s="18"></sa-i></button></div>'
  '<sc-if value="{{ p.open }}"><div style="padding:6px 18px 14px 68px;border-bottom:1px solid var(--color-divider);background:var(--color-accent-100)"><button class="btn btn-ghost" onClick="{{ p.mail }}" style="gap:6px;margin-top:4px"><sa-i n="send" s="15"></sa-i>{{ p.mailLbl }}</button><sc-for list="{{ p.detail }}" as="d"><div style="font:600 15px var(--font-heading);margin-top:8px">{{ d.jour }}</div>'
  '<sc-for list="{{ d.lines }}" as="l"><div style="display:grid;grid-template-columns:minmax(160px,2fr) 90px 120px 70px minmax(120px,1.4fr);gap:10px;font-size:14px;padding:3px 0"><span>{{ l.lieu }}</span><span>{{ l.odt }}</span><span>{{ l.debut }} → {{ l.fin }}</span><span style="text-align:right">{{ l.h }}</span><span style="font-size:12px">{{ l.note }}</span></div></sc-for></sc-for></div></sc-if></sc-for>'
  '<sc-if value="{{ paieNone }}"><div style="padding:14px 18px">Aucune heure cette semaine.</div></sc-if>','overflow-x:auto'))
CUMUL=CARD('<table class="table" style="font-size:14px"><thead><tr>'+TH%('padding-left:18px','Technicien')+TH%('text-align:right','{{ tLabel }}')+TH%('text-align:right','Cumul saison')+'</tr></thead><tbody><sc-for list="{{ tempsRows }}" as="r"><tr style="opacity:{{ r.op }}">'
  '<td style="padding:var(--sa-row,10px) 8px var(--sa-row,10px) 18px;font-weight:500">{{ r.nom }}</td>'+TD%('text-align:right','{{ r.semaine }}')+TD%('text-align:right;font:600 16px var(--font-heading);padding-right:18px','{{ r.cumul }}')+'</tr></sc-for></tbody></table>','overflow-x:auto')
bt=block(M,'isTemps')
if bt:
    SUIVI=block(bt,'isSuiviTab')
    TEMPS=('<sc-if value="{{ isTemps }}"><div style="display:flex;flex-direction:column;gap:18px"><div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">'
      +NAV('tPrev','tLabel','tNext','tToday')+TABS+'</div>'
      '<sc-if value="{{ tWeekLoading }}"><div>Chargement de la semaine…</div></sc-if><sc-if value="{{ tWeekErr }}"><div role="alert" style="padding:10px 14px;border:2px solid var(--color-accent-900)">{{ tWeekErr }}</div></sc-if>'
      '<sc-if value="{{ isTempsTab }}">'+SEMAINE+'</sc-if>'+(SUIVI or '')+'<sc-if value="{{ isPaieTab }}">'+PAIE+'</sc-if><sc-if value="{{ isCumulTab }}">'+CUMUL+'</sc-if></div></sc-if>')
    if not SUIVI: print('!! bloc isSuiviTab')
    STATS=('<sc-if value="{{ isStats }}"><div style="display:flex;flex-direction:column;gap:18px">'+NAV('sPrev','sLabel','sNext','sToday')
      +'<sc-if value="{{ sLoading }}"><div>Chargement…</div></sc-if>'
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px"><sc-for list="{{ sKpis }}" as="k">'+CARD('<div style="padding:14px 18px;display:flex;flex-direction:column;gap:4px"><span style="font-size:13px">{{ k.l }}</span><span style="font:600 34px/1 var(--font-heading)">{{ k.v }}</span><span style="font-size:12px">{{ k.s }}</span></div>')+'</sc-for></div>'
      +CARD('<h3 style="margin:0;padding:14px 18px 6px;font-size:20px">Heures par employé</h3><sc-for list="{{ sBars }}" as="b"><button onClick="{{ b.open }}" style="all:unset;cursor:pointer;display:grid;grid-template-columns:minmax(140px,220px) minmax(0,1fr) 150px;gap:12px;align-items:center;padding:6px 18px">'
      '<span style="font-weight:500">{{ b.nom }}</span><span style="height:18px;background:var(--color-accent-100);position:relative"><span style="position:absolute;left:0;top:0;bottom:0;width:{{ b.w }}%;background:{{ b.bg }}"></span></span><span style="text-align:right;font-variant-numeric:tabular-nums">{{ b.h }} <span style="font-size:12px">{{ b.sub }}</span></span></button></sc-for>'
      '<sc-if value="{{ sNoBars }}"><div style="padding:6px 18px 14px">Aucune heure cette semaine.</div></sc-if><div style="height:10px"></div>')
      +CARD('<h3 style="margin:0;padding:14px 18px 6px;font-size:20px">Bons de travail par statut</h3><div style="display:flex;gap:28px;padding:4px 18px 16px;flex-wrap:wrap"><sc-for list="{{ sWo }}" as="w"><div style="display:flex;flex-direction:column"><span style="font-size:13px">{{ w.l }}</span><span style="font:600 28px var(--font-heading)">{{ w.n }}</span></div></sc-for></div>')
      +CARD('<h3 style="margin:0;padding:14px 18px 6px;font-size:20px">Rapport de l’équipe</h3><div style="padding:0 18px 16px;display:flex;flex-direction:column;gap:10px"><span style="font-size:14px">Toutes les heures de la semaine, une ligne par punch, avec les totaux par employé — à transmettre ou à analyser.</span>'
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" onClick="{{ sCopy }}">Copier</button><button class="btn btn-secondary" onClick="{{ sDownload }}">Télécharger (.txt)</button><button class="btn btn-secondary" onClick="{{ sXlsx }}">Feuilles de temps Excel</button></div></div>')
      +'</div></sc-if>\n')
    M=M.replace(bt,TEMPS+STATS,1)
else: print('!! bloc isTemps')
HJ=WRAP('hjOpen','hjCloseBg',DLGHEAD('hjTitle','hjClose')+IF('hjLoading','<div>Chargement…</div>')
  +'<div style="display:flex;gap:10px;align-items:baseline"><span style="font:600 28px var(--font-heading)">{{ hjTotal }}</span><span>{{ hjCount }}</span></div>'
  +'<sc-for list="{{ hjTasks }}" as="t"><button onClick="{{ t.edit }}" style="all:unset;cursor:pointer;display:flex;flex-direction:column;gap:2px;padding:10px 12px;border:1px solid var(--color-divider);border-left:4px solid {{ t.bd }}">'
  '<span style="display:flex;justify-content:space-between;gap:10px"><b>{{ t.lieu }}</b><span style="font:600 16px var(--font-heading)">{{ t.dur }}</span></span><span style="font-size:14px">{{ t.h }} {{ t.detail }}</span><span style="font-size:12px">{{ t.tags }}</span></button></sc-for>'
  +IF('hjEmpty','<div>Aucun punch ce jour.</div>')
  +IF('hpOpen','<div style="border:1px solid var(--color-text);padding:14px;display:flex;flex-direction:column;gap:12px"><b style="font-size:18px">{{ hpTitle }}</b>'
    +FL('Lieu / site','<input class="input" value="{{ hpLieu }}" onInput="{{ onHpLieu }}">')
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+FL('Début','<input class="input" type="time" value="{{ hpStart }}" onInput="{{ onHpStart }}">')+FL('Fin','<input class="input" type="time" value="{{ hpEnd }}" onInput="{{ onHpEnd }}">')+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 2fr;gap:12px">'+FL('ODT','<input class="input" value="{{ hpOdt }}" onInput="{{ onHpOdt }}">')+FL('Détail','<input class="input" value="{{ hpDetail }}" onInput="{{ onHpDetail }}">')+'</div>'
    +IF('hpActive','<div style="font-size:13px">Punch en cours : laissez la fin vide pour qu’il continue.</div>')
    +'<div style="font-size:13px">Chaque correction est inscrite au journal d’audit (qui, quoi, quand).</div>'
    +'<div class="dialog-actions" style="margin-top:0;flex-wrap:wrap">'+BTNX('btn-secondary','hpCancel','Annuler')+IF('hpCanDel',BTNX('btn-secondary','hpDel','{{ hpDelLbl }}'))+BTNX('btn-primary','hpSave','Enregistrer')+'</div></div>')
  +IF('hpClosed','<div class="dialog-actions" style="margin-top:0;flex-wrap:wrap">'+BTNX('btn-secondary','hjAdd','Ajouter un punch')+IF('hjCanApprove',BTNX('btn-primary','hjApprove','Approuver la journée'))+'</div>'))
M=M.rstrip()+'\n'+HJ

rep('<span>Nouveau créneau ou série</span></button>','<span>Nouveau bon, créneau ou tâche</span></button>',1)
M=M.replace('<button class="btn btn-primary blueprint" onClick="{{ openDlg }}"','<button class="btn btn-secondary" onClick="{{ pPrint }}" style="white-space:nowrap">Imprimer la semaine</button><button class="btn btn-primary blueprint" onClick="{{ openDlg }}"',1)
# ---------- ÉDITEUR COMPLET : bon de travail · créneau · tâche planning ----------
CHK=lambda lst,lab: ('<div style="display:flex;flex-wrap:wrap;gap:6px"><sc-for list="{{ %s }}" as="c"><button onClick="{{ c.go }}" style="all:unset;cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--color-divider)">'
  '<span style="width:16px;height:16px;border:1.5px solid var(--color-text);background:{{ c.box }};color:var(--color-bg);display:flex;align-items:center;justify-content:center"><sc-if value="{{ c.on }}"><sa-i n="check" s="12" w="3"></sa-i></sc-if></span>{{ c.%s }}</button></sc-for></div>')%(lst,lab)
CBX=lambda val,fn,txt:'<label style="display:flex;align-items:center;gap:8px;font-size:14px"><input type="checkbox" checked="{{ %s }}" onChange="{{ %s }}">%s</label>'%(val,fn,txt)
G2=lambda a,b:'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'+a+b+'</div>'
INP=lambda val,fn,t='text',extra='':'<input class="input" type="%s" value="{{ %s }}" onInput="{{ %s }}"%s>'%(t,val,fn,extra)
TXT=lambda val,fn,ph:'<textarea class="input" value="{{ %s }}" onInput="{{ %s }}" placeholder="%s" style="min-height:70px"></textarea>'%(val,fn,ph)
WHEN=(IF('feNew',FL('Quand ?',SEG('whenModes'))
   +IF('whenJour',FL('Date',INP('wDebut','onWDebut','date')))
   +IF('whenPlage',G2(FL('Du',INP('wDebut','onWDebut','date')),FL('Au',INP('wFin','onWFin','date'))))
   +IF('whenRec',G2(FL('Première date',INP('wDebut','onWDebut','date')),FL('Jusqu’au',INP('wFin','onWFin','date')))+SEG('recOpts')
       +'<div style="display:flex;gap:6px"><sc-for list="{{ dayToggles }}" as="d"><button onClick="{{ d.go }}" style="all:unset;cursor:pointer;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid var(--color-divider);font-weight:600;background:{{ d.bg }};color:{{ d.fg }}">{{ d.l }}</button></sc-for></div>')
   +'<div style="font-size:13px">{{ whenCount }}</div>'))
FEDLG=('<template data-sc="if" value="{{ feOpen }}"><div class="dialog-backdrop" onClick="{{ feCloseBg }}" style="z-index:60"><div class="dialog" onClick="{{ stop }}" style="width:min(720px,100%);background:var(--color-bg);max-height:calc(100vh - 40px);overflow-y:auto;gap:14px;padding:22px 24px;border:1px solid var(--color-text)">'
  +DLGHEAD('feTitle','feClose')+IF('feLoading','<div>Chargement…</div>')
  +IF('feReady',IF('feNew',SEG('feKinds'))
    +'<datalist id="saSites"><sc-for list="{{ sitesList }}" as="s"><option value="{{ s.v }}"></option></sc-for></datalist>'
    +IF('isWO',G2(FL('Client','<input class="input" list="saSites" value="{{ fClient }}" onInput="{{ onClient }}" placeholder="Nom du client ou du site">'),FL('Site / adresse',INP('fSite','onSite')))
       +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">'+FL('Type',SEL('fTypes','onType'))+FL('Priorité',SEL('fPrios','onPrio'))+FL('Statut',SEL('fStats','onStat'))+'</div>')
    +IF('isPlanF',G2(FL('Client / site','<input class="input" list="saSites" value="{{ fClient }}" onInput="{{ onClient }}">'),FL('Adresse',INP('fAddr','onAddr')))
       +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">'+FL('Heure',INP('fHeure','onHeure','time'))+FL('Type',SEL('fTypes','onType'))+FL('Statut',SEL('fStats','onStat'))+'</div>'
       +IF('hasWoLinks',FL('Bon de travail lié (optionnel)','<select class="input" onChange="{{ onWo }}"><option value="">— Aucun —</option><sc-for list="{{ fWo }}" as="o"><option value="{{ o.v }}" selected="{{ o.sel }}">{{ o.l }}</option></sc-for></select>')))
    +IF('isPT',G2(FL('Titre',INP('fTitre','onTitre')),FL('Site (optionnel)','<input class="input" list="saSites" value="{{ fSiteNom }}" onInput="{{ onSiteNom }}">'))
       +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">'+FL('Heure début',INP('fHD','onHD','time'))+FL('Heure fin',INP('fHF','onHF','time'))+FL('Statut',SEL('fStats','onStat'))+'</div>')
    +WHEN
    +IF('feEditDate',IF('isPT',G2(FL('Du',INP('fDD','onDD','date')),FL('Au',INP('fDF','onDF','date'))))+IF('isNotPT',FL('Date',INP('fDate','onDate','date'))))
    +FL('Technicien(s)',CHK('fTechs','l'))+IF('showIndep','<button class="btn btn-ghost" onClick="{{ toggleIndep }}" style="align-self:flex-start">{{ indepLbl }} (changer)</button>')
    +FL('Description / travaux à effectuer',TXT('fDescr','onDescr','Décrivez les travaux…'))
    +IF('isWO',FL('Liste de tâches','<div style="display:flex;flex-direction:column;gap:4px"><sc-for list="{{ fTasks }}" as="t"><div style="display:flex;align-items:center;gap:8px">'
        '<button onClick="{{ t.toggle }}" aria-label="Cocher" style="all:unset;cursor:pointer;width:20px;height:20px;border:1.5px solid var(--color-text);background:{{ t.box }};color:var(--color-bg);display:flex;align-items:center;justify-content:center"><sc-if value="{{ t.on }}"><sa-i n="check" s="14" w="3"></sa-i></sc-if></button>'
        '<span style="flex:1">{{ t.label }}</span><button class="btn btn-ghost btn-icon" onClick="{{ t.del }}" aria-label="Retirer"><sa-i n="x" s="16"></sa-i></button></div></sc-for>'
        '<div style="display:flex;gap:8px"><input class="input" value="{{ taskIn }}" onInput="{{ onTaskIn }}" placeholder="Ajouter une tâche…" style="flex:1"><button class="btn btn-secondary" onClick="{{ addTask }}">Ajouter</button></div></div>')
       +FL('Photos / documents','<div style="display:flex;flex-direction:column;gap:4px"><sc-for list="{{ fFiles }}" as="x"><div style="display:flex;align-items:center;gap:8px"><button onClick="{{ x.open }}" style="all:unset;cursor:pointer;text-decoration:underline;flex:1">{{ x.name }}</button><button class="btn btn-ghost btn-icon" onClick="{{ x.del }}" aria-label="Retirer"><sa-i n="x" s="16"></sa-i></button></div></sc-for>'
        '<button class="btn btn-secondary" onClick="{{ addFile }}" style="align-self:flex-start">Joindre une photo ou un PDF</button></div>')
       +FL('Notes techniques',TXT('fNotes','onNotes','Notes, références équipements…'))
       +FL('Exigences obligatoires au punch',CBX('fReqB','onReqB','Relevés de bassin (chlore, pH…)')+CBX('fReqP','onReqP','Photo')+CBX('fReqN','onReqN','Notes')))
    +IF('isPlanF',FL('Notes',TXT('fNotes','onNotes','')))
    +'<div class="dialog-actions" style="margin-top:0;flex-wrap:wrap">'+IF('feCanDel',BTNX('btn-secondary','feDel1','{{ feDel1Lbl }}'))+IF('feHasSerie',BTNX('btn-secondary','feDel2','{{ feDel2Lbl }}'))
      +IF('canPrint',BTNX('btn-secondary','fePrint','Imprimer'))+'<span style="flex:1"></span>'+BTNX('btn-secondary','feClose','Annuler')+BTNX('btn-primary','feSave','{{ feSaveLbl }}')+'</div>')
  +'</div></div></template>\n')
M=M.rstrip()+'\n'+FEDLG

# ---------- PLAN DE MATCH ----------
PMMSCR=('<sc-if value="{{ isPlanMatch }}"><div style="display:flex;flex-direction:column;gap:18px">'
  '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><button class="btn btn-secondary btn-icon" aria-label="Jour précédent" onClick="{{ pmmPrev }}"><sa-i n="left" s="18"></sa-i></button>'
  '<span style="font:600 20px var(--font-heading);padding:0 8px">{{ pmmLabel }}</span><button class="btn btn-secondary btn-icon" aria-label="Jour suivant" onClick="{{ pmmNext }}"><sa-i n="right" s="18"></sa-i></button>'
  '<button class="btn btn-ghost" onClick="{{ pmmToday }}">Aujourd’hui</button><input class="input" type="date" value="{{ pmmDateVal }}" onChange="{{ onPmmDate }}" style="width:auto">'
  '<span style="flex:1"></span><span style="font-size:14px">{{ pmmCount }}</span><button class="btn btn-secondary" onClick="{{ pmmPrint }}">Imprimer la journée de l’équipe</button><button class="btn btn-primary" onClick="{{ pmmNew }}">Nouveau Plan de Match</button></div>'
  '<sc-if value="{{ pmmLoading }}"><div>Chargement…</div></sc-if><sc-if value="{{ pmmErrTxt }}"><div role="alert" style="padding:10px 14px;border:2px solid var(--color-accent-900)">{{ pmmErrTxt }}</div></sc-if>'
  '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px"><sc-for list="{{ pmmCards }}" as="c">'
  +CARD('<div style="padding:14px 18px;display:flex;flex-direction:column;gap:8px">'
    '<div style="display:flex;align-items:center;gap:10px"><b style="font:600 20px var(--font-heading);flex:1">{{ c.nom }}</b><button class="btn btn-secondary" onClick="{{ c.edit }}" style="white-space:nowrap">{{ c.editLbl }}</button></div>'
    '<sc-if value="{{ c.noPlan }}"><div style="font-size:14px">Aucun plan pour cette journée.</div></sc-if>'
    '<sc-if value="{{ c.hasPlan }}"><div style="font-size:13px">{{ c.meta }}</div><sc-if value="{{ c.resume }}"><div style="font-size:14px">{{ c.resume }}</div></sc-if>'
    '<div style="display:flex;align-items:center;gap:10px"><span style="flex:1;height:8px;background:var(--color-accent-100);position:relative"><span style="position:absolute;left:0;top:0;bottom:0;width:{{ c.pct }}%;background:var(--color-accent-700)"></span></span><span style="font-size:13px">{{ c.prog }}</span></div>'
    '<sc-for list="{{ c.sections }}" as="s"><div style="display:flex;flex-direction:column"><div style="background:{{ s.bg }};color:#fff;padding:4px 10px;font:600 15px var(--font-heading)">{{ s.title }}</div>'
    '<sc-if value="{{ s.hasNote }}"><div style="border:1px solid var(--color-accent-900);padding:4px 10px;font-size:13px">{{ s.note }}</div></sc-if>'
    '<sc-for list="{{ s.tasks }}" as="t"><div style="display:flex;align-items:center;gap:8px;padding:5px 10px;border:1px solid var(--color-divider);border-top:0">'
    '<span style="width:16px;height:16px;flex:none;border:1.5px solid var(--color-text);background:{{ t.box }};color:var(--color-bg);display:flex;align-items:center;justify-content:center"><sc-if value="{{ t.on }}"><sa-i n="check" s="12" w="3"></sa-i></sc-if></span>'
    '<span style="flex:1;font-size:14px">{{ t.label }}</span><span style="font-size:12px">{{ t.etat }}</span><sc-if value="{{ t.canVal }}"><button class="btn btn-secondary" onClick="{{ t.valider }}" style="min-height:28px;padding:2px 10px">Valider</button></sc-if></div></sc-for></div></sc-for>'
    '<sc-if value="{{ c.hasFF }}"><div style="font-size:13px"><b>Obstacles :</b> {{ c.obstacles }}<br><b>Bons coups :</b> {{ c.bonscoups }}</div></sc-if></sc-if>'
    '<sc-if value="{{ c.hasJobs }}"><div style="font-size:13px;border-top:1px solid var(--color-divider);padding-top:6px"><b>Travaux du jour</b><sc-for list="{{ c.jobs }}" as="j"><div>{{ j.txt }} <b>{{ j.done }}</b></div></sc-for></div></sc-if>'
    '</div>')
  +'</sc-for></div></div></sc-if>\n')
bs=block(M,'isStats')
if bs: M=M.replace(bs,bs+PMMSCR,1)
else: print('!! ancre isStats (PMM)')
PB=WRAP('pbOpen','pbCloseBg',DLGHEAD('pbTitle','pbClose')
  +'<datalist id="saVeh"><sc-for list="{{ vehList }}" as="v"><option value="{{ v.v }}"></option></sc-for></datalist>'
  +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">'+FL('Date','<input class="input" type="date" value="{{ pbDate }}" onInput="{{ onPbDate }}">')+FL('Véhicule','<input class="input" list="saVeh" value="{{ pbVeh }}" onInput="{{ onPbVeh }}">')+FL('Superviseur','<input class="input" value="{{ pbSup }}" onInput="{{ onPbSup }}">')+'</div>'
  +FL('Employé(s)',CHK('pbTechs','l'))+FL('Résumé de la journée','<input class="input" value="{{ pbRes }}" onInput="{{ onPbRes }}" placeholder="Ex. Tournée Rive-Sud, fermetures">')
  +'<sc-for list="{{ pbSecs }}" as="s"><div style="border:1px solid var(--color-divider);border-top:4px solid {{ s.bar }};padding:10px;display:flex;flex-direction:column;gap:8px">'
  '<div style="display:flex;gap:8px"><input class="input" value="{{ s.title }}" onInput="{{ s.onTitle }}" placeholder="Titre de la section (ex. SDC3 — ~2 h)" style="flex:1">'
  '<select class="input" onChange="{{ s.onColor }}" style="width:auto"><sc-for list="{{ s.colors }}" as="o"><option value="{{ o.v }}" selected="{{ o.sel }}">{{ o.l }}</option></sc-for></select>'
  '<button class="btn btn-ghost btn-icon" onClick="{{ s.del }}" aria-label="Supprimer la section"><sa-i n="x" s="16"></sa-i></button></div>'
  '<input class="input" value="{{ s.note }}" onInput="{{ s.onNote }}" placeholder="Note / alerte pour cette section (optionnelle)">'
  '<sc-for list="{{ s.tasks }}" as="t"><div style="display:flex;gap:8px;align-items:center"><input class="input" value="{{ t.label }}" onInput="{{ t.onLabel }}" placeholder="Tâche…" style="flex:1">'
  '<input class="input" value="{{ t.est }}" onInput="{{ t.onEst }}" placeholder="min" style="width:70px"><span style="font-size:12px;width:28px">{{ t.done }}</span><button class="btn btn-ghost btn-icon" onClick="{{ t.del }}" aria-label="Retirer la tâche"><sa-i n="x" s="16"></sa-i></button></div></sc-for>'
  '<button class="btn btn-ghost" onClick="{{ s.addTask }}" style="align-self:flex-start">Ajouter une tâche</button></div></sc-for>'
  +'<button class="btn btn-secondary" onClick="{{ pbAddSec }}" style="align-self:flex-start">Ajouter une section</button>'
  +'<div style="font-size:13px">Ce que le technicien a déjà coché ou noté est conservé à l’enregistrement.</div>'
  +'<div class="dialog-actions" style="margin-top:0;flex-wrap:wrap">'+IF('pbCanDel',BTNX('btn-secondary','pbDel','{{ pbDelLbl }}'))+'<span style="flex:1"></span>'+BTNX('btn-secondary','pbClose','Annuler')+BTNX('btn-primary','pbSave','{{ pbSaveLbl }}')+'</div>')
M=M.rstrip()+'\n'+PB

# ---------- COMPTES ----------
CPT=('<sc-if value="{{ isComptes }}"><div style="display:flex;flex-direction:column;gap:18px">'
  '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:14px">{{ cCount }}</span><span style="flex:1"></span>'
  '<button class="btn btn-secondary" onClick="{{ cExport }}">Sauvegarde complète (.json)</button><sc-if value="{{ cCanEdit }}"><button class="btn btn-primary" onClick="{{ cNew }}">Nouveau compte</button></sc-if></div>'
  '<sc-if value="{{ cReadOnly }}"><div style="font-size:14px;border:1px dashed var(--color-text);padding:10px 14px">Lecture seule : seul un administrateur peut créer ou modifier des comptes.</div></sc-if>'
  '<sc-if value="{{ cLoading }}"><div>Chargement…</div></sc-if><sc-if value="{{ cErr }}"><div role="alert" style="padding:10px 14px;border:2px solid var(--color-accent-900)">{{ cErr }}</div></sc-if>'
  +CARD('<table class="table" style="font-size:14px"><thead><tr>'+TH%('padding-left:18px','Nom')+TH%('','Identifiant')+TH%('','Rôle')+TH%('','Département')+TH%('','État')+TH%('','')+'</tr></thead><tbody>'
  '<sc-for list="{{ cRows }}" as="r"><tr style="opacity:{{ r.op }}"><td style="padding:var(--sa-row,10px) 8px var(--sa-row,10px) 18px;font-weight:500">{{ r.nom }}</td>'+TD%('','{{ r.id }}')+TD%('','{{ r.role }}')+TD%('','{{ r.dept }}')+TD%('','{{ r.etat }}')
  +'<td style="padding:4px 18px 4px 8px;text-align:right"><button class="btn btn-secondary" onClick="{{ r.open }}">Ouvrir</button></td></tr></sc-for></tbody></table>','overflow-x:auto')
  +'</div></sc-if>\n')
bs=block(M,'isStats')
if bs: M=M.replace(bs,bs+CPT,1)
else: print('!! ancre isStats (Comptes)')
CE=WRAP('ceOpen','ceCloseBg',DLGHEAD('ceTitle','ceClose')
  +G2(FL('Prénom',INP('cePrenom','onCePrenom')),FL('Nom',INP('ceNom','onCeNom')))
  +G2(IF('ceNew',FL('Identifiant de connexion',INP('ceId','onCeId','text',' autocapitalize="off" placeholder="ex. jtremblay"')))+'<sc-if value="{{ ceNotNewId }}"><div class="field"><label>Identifiant de connexion</label><div style="padding:8px 0;font-weight:600">{{ ceId }}</div></div></sc-if>',FL('Département',INP('ceDept','onCeDept')))
  +G2(FL('Courriel',INP('ceEmail','onCeEmail','email')),FL('Téléphone',INP('ceTel','onCeTel','tel')))
  +G2(FL('Rôle',SEL('ceRoles','onCeRole')),FL('Statut',SEL('ceStatuts','onCeStatut')))
  +CBX('ceSais','onCeSais','Employé saisonnier')
  +IF('ceNotAdmin',FL('Droits d’accès (SA Platform)',CHK('ceDroits','l')))+IF('ceIsAdmin','<div style="font-size:13px">Un administrateur a tous les droits.</div>')
  +IF('ceCanEdit','<div style="border:1px solid var(--color-divider);padding:12px;display:flex;flex-direction:column;gap:10px"><b>{{ cePwLbl }}</b>'
    +G2(FL('Mot de passe (8 caractères min.)',INP('cePw1','onCePw1','password',' autocomplete="new-password"')),FL('Confirmer',INP('cePw2','onCePw2','password',' autocomplete="new-password"')))
    +FL('Votre mot de passe administrateur (confirmation)',INP('ceAdminPw','onCeAdminPw','password',' autocomplete="current-password"'))
    +'<div style="font-size:13px">L’employé devra choisir son propre mot de passe à sa première connexion. Le mot de passe n’est jamais stocké en clair.</div></div>')
  +'<div class="dialog-actions" style="margin-top:0;flex-wrap:wrap">'+IF('ceCanDel',BTNX('btn-secondary','ceDel','{{ ceDelLbl }}'))+'<span style="flex:1"></span>'+BTNX('btn-secondary','ceClose','Fermer')+IF('ceCanEdit',BTNX('btn-primary','ceSave','{{ ceSaveLbl }}'))+'</div>')
M=M.rstrip()+'\n'+CE

# ---------- LOGISTIQUE + HIVERNAGE (côté bureau) ----------
DOCLIST=lambda flag,head:('<sc-if value="{{ %s }}"><div style="display:flex;flex-direction:column;gap:18px">'%flag+head
  +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+SEG('docFilters')+'<input class="input" type="search" placeholder="Rechercher (n°, client, site, technicien)…" value="{{ docQ }}" onInput="{{ onDocQ }}" style="max-width:320px"><span style="flex:1"></span>'
  +'<button class="btn btn-primary" onClick="{{ docNew }}" style="gap:8px"><sa-i n="plus" s="17"></sa-i>{{ docNewLbl }}</button></div>'
  '<sc-if value="{{ docLoading }}"><div>Chargement…</div></sc-if><sc-if value="{{ docErr }}"><div role="alert" style="padding:10px 14px;border:2px solid var(--color-accent-900)">{{ docErr }}</div></sc-if>'
  '<sc-if value="{{ docNone }}"><div style="font-size:15px;border:1px dashed var(--color-text);padding:14px">Aucun document pour ce filtre.</div></sc-if>'
  +CARD('<table class="table" style="font-size:14px"><tbody><sc-for list="{{ docRows }}" as="r"><tr><td style="padding:var(--sa-row,10px) 8px var(--sa-row,10px) 18px;font-weight:600">{{ r.a }}</td>'+TD%('','{{ r.b }}')+TD%('','{{ r.c }}')+TD%('','{{ r.d }}')+TD%('font-weight:600','{{ r.etat }}')
  +'<td style="padding:4px 18px 4px 8px;text-align:right"><button class="btn btn-secondary" onClick="{{ r.open }}">Ouvrir</button></td></tr></sc-for></tbody></table>','overflow-x:auto')
  +'</div></sc-if>\n')
LOGI=DOCLIST('isLogi',SEG('logTabs'))
HIVB=DOCLIST('isHivB','')
bs=block(M,'isStats')
if bs: M=M.replace(bs,bs+LOGI+HIVB,1)
else: print('!! ancre isStats (Logistique)')
CELL='<input class="input" value="{{ c.v }}" onInput="{{ c.on }}" placeholder="{{ c.ph }}" aria-label="{{ c.ph }}" style="flex:{{ c.w }};min-width:60px;padding:6px 8px">'
DELB=lambda fn:'<button class="btn btn-ghost btn-icon" onClick="{{ %s }}" aria-label="Retirer"><sa-i n="x" s="16"></sa-i></button>'%fn
ROWED=lambda lst,title,addfn,addlbl,extra='':('<div style="display:flex;flex-direction:column;gap:6px"><b>%s</b><sc-for list="{{ %s }}" as="r"><div style="display:flex;gap:6px;align-items:center"><sc-for list="{{ r.cells }}" as="c">'%(title,lst)
  +CELL+'</sc-for>'+extra+DELB('r.del')+'</div></sc-for><button class="btn btn-ghost" onClick="{{ %s }}" style="align-self:flex-start">+ %s</button></div>'%(addfn,addlbl))
PHOTOS=lambda lst,addfn:('<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><sc-for list="{{ %s }}" as="p"><span style="display:flex;align-items:center;gap:4px;border:1px solid var(--color-divider);padding:2px 4px 2px 8px;font-size:13px">'
  '<button onClick="{{ p.open }}" style="all:unset;cursor:pointer;text-decoration:underline">{{ p.name }}</button>'%lst+DELB('p.del')+'</span></sc-for><button class="btn btn-ghost" onClick="{{ %s }}" style="gap:6px"><sa-i n="camera" s="16"></sa-i>Ajouter une photo</button></div>'%addfn)
TECHSEL='<select class="input" onChange="{{ onDTech }}"><option value="">—</option><template data-sc="for" list="{{ dTechs }}" as="o"><option value="{{ o.v }}" selected="{{ o.sel }}">{{ o.l }}</option></template></select>'
DE_BL=IF('isBL',G2(FL('Client',INP('dClient.v','dClient.on','text',' list="deSites"')),FL('Téléphone',INP('dTel.v','dTel.on','tel')))
  +FL('Adresse de livraison',INP('dAdr.v','dAdr.on'))
  +G2(G2(FL('Date',INP('dDate.v','dDate.on','date')),FL('Heure',INP('dHeure.v','dHeure.on','time'))),FL('Technicien / livreur',TECHSEL))
  +'<label style="display:flex;align-items:center;gap:8px;font-size:14px"><input type="checkbox" checked="{{ dUrg.v }}" onChange="{{ dUrg.on }}">Livraison urgente</label>'
  +ROWED('rLiv','Articles à livrer','addLiv','Ajouter un article')+ROWED('rRet','Articles récupérés chez le client','addRet','Ajouter un article récupéré')
  +FL('Photos et signatures',PHOTOS('blPhotos','addBlPhoto')))
DE_SO=IF('isSO',G2(FL('Client / projet',INP('dClient.v','dClient.on','text',' list="deSites"')),FL('Date',INP('dDate.v','dDate.on','date')))
  +G2(FL('Employé',TECHSEL),G2(FL('N° employé',INP('dNoEmp.v','dNoEmp.on')),FL('Département',INP('dDept.v','dDept.on'))))
  +ROWED('rLig','Articles sortis','addLig','Ajouter une ligne'))
PRIO='<select class="input" onChange="{{ r.onPrio }}" aria-label="Priorité" style="flex:1.2;padding:6px 8px"><template data-sc="for" list="{{ r.prio }}" as="o"><option value="{{ o.v }}" selected="{{ o.sel }}">{{ o.l }}</option></template></select>'
DE_HV=IF('isHV',G2(FL('Site',INP('dSite.v','dSite.on','text',' list="deSites"')),FL('Client',INP('dClient.v','dClient.on')))
  +G2(FL('Titre',INP('dTitre.v','dTitre.on')),FL('Objet',INP('dObjet.v','dObjet.on')))
  +G2(G2(FL('Date d’inspection',INP('dDI.v','dDI.on','date')),FL('Date du rapport',INP('dDR.v','dDR.on','date'))),G2(FL('Préparé par',INP('dPrep.v','dPrep.on')),FL('Technicien',TECHSEL)))
  +'<div style="display:flex;flex-direction:column;gap:10px"><b>Constats par section</b><sc-for list="{{ dSecs }}" as="s"><div style="border:1px solid var(--color-divider);padding:10px;display:flex;flex-direction:column;gap:8px">'
    '<div style="display:flex;gap:8px;align-items:center"><input class="input" value="{{ s.title }}" onInput="{{ s.onTitle }}" placeholder="Titre de la section" aria-label="Titre de la section" style="flex:2;font-weight:600">'
    +SEL('s.tags','s.onTag').replace('<select class="input"','<select class="input" aria-label="Priorité de la section" style="flex:1"')+DELB('s.del')+'</div>'
    '<sc-for list="{{ s.items }}" as="it"><div style="display:flex;gap:6px"><input class="input" value="{{ it.v }}" onInput="{{ it.on }}" placeholder="Constat…" aria-label="Constat" style="flex:1;padding:6px 8px">'+DELB('it.del')+'</div></sc-for>'
    '<button class="btn btn-ghost" onClick="{{ s.addItem }}" style="align-self:flex-start">+ Ajouter un constat</button>'+PHOTOS('s.photos','s.addPhoto')+'</div></sc-for>'
    '<button class="btn btn-ghost" onClick="{{ addSec }}" style="align-self:flex-start">+ Ajouter une section</button></div>'
  +ROWED('rPlan','Prévisionnel des travaux','addPlan','Ajouter une ligne',PRIO)
  +'<div style="display:flex;flex-direction:column;gap:6px"><b>Suivi</b><sc-for list="{{ rSuivi }}" as="r"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input class="input" value="{{ r.el }}" onInput="{{ r.onEl }}" placeholder="Élément" aria-label="Élément suivi" style="flex:2;min-width:140px;padding:6px 8px">'
    +CHK('r.cks','l')+'<input class="input" value="{{ r.who }}" onInput="{{ r.onWho }}" placeholder="Date / responsable" aria-label="Date / responsable" style="flex:1;min-width:120px;padding:6px 8px">'+DELB('r.del')+'</div></sc-for>'
    '<button class="btn btn-ghost" onClick="{{ addSuivi }}" style="align-self:flex-start">+ Ajouter un suivi</button></div>'
  +FL('Calendrier prévisionnel','<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"><sc-for list="{{ dQ }}" as="q"><input class="input" value="{{ q.v }}" onInput="{{ q.on }}" placeholder="{{ q.l }}" aria-label="{{ q.l }}"></sc-for></div>')
  +FL('Recommandation générale',TXT('dCall.v','dCall.on','Texte mis en évidence dans le rapport'))
  +G2(FL('Signataire Soucy Aquatik',INP('dSSA.v','dSSA.on')),FL('Signataire client',INP('dSCl.v','dSCl.on'))))
DEDLG=('<template data-sc="if" value="{{ deOpen }}"><div class="dialog-backdrop" onClick="{{ deCloseBg }}" style="z-index:60"><div class="dialog" onClick="{{ stop }}" style="width:min(860px,100%);background:var(--color-bg);max-height:calc(100vh - 40px);overflow-y:auto;gap:14px;padding:22px 24px;border:1px solid var(--color-text)">'
  +DLGHEAD('deTitle','deClose')+'<datalist id="deSites"><sc-for list="{{ sitesList2 }}" as="o"><option value="{{ o.v }}"></option></sc-for></datalist>'
  +'<sc-if value="{{ deDone }}"><div style="padding:8px 12px;border:1px solid var(--color-text);font-weight:600;display:flex;align-items:center;gap:10px">{{ deDoneTxt }}<span style="flex:1"></span><button class="btn btn-ghost" onClick="{{ deReopen }}">Remettre en brouillon</button></div></sc-if>'
  +DE_BL+DE_SO+DE_HV
  +'<div class="dialog-actions" style="margin-top:0;flex-wrap:wrap">'+IF('deCanDel',BTNX('btn-secondary','deDel','{{ deDelLbl }}'))+BTNX('btn-secondary','dePrint','Imprimer')+'<span style="flex:1"></span>'+BTNX('btn-secondary','deClose','Fermer')
  +IF('deNotDone',BTNX('btn-secondary','deFinal','{{ deFinalLbl }}'))+BTNX('btn-primary','deSave','{{ deSaveLbl }}')+'</div></div></div></template>\n')
M=M.rstrip()+'\n'+DEDLG

# ---------- STOCK + FLOTTE ----------
STKHEAD=lambda extra:('<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><input class="input" type="search" placeholder="Rechercher…" value="{{ stkQ }}" onInput="{{ onStkQ }}" style="max-width:280px">%s</div>'
  '<sc-if value="{{ stkLoading }}"><div>Chargement…</div></sc-if><sc-if value="{{ stkErr }}"><div role="alert" style="padding:10px 14px;border:2px solid var(--color-accent-900)">{{ stkErr }}</div></sc-if>'
  '<sc-if value="{{ stkNone }}"><div style="font-size:15px;border:1px dashed var(--color-text);padding:14px">Aucun élément pour ce filtre.</div></sc-if>')%extra
OPENTD='<td style="padding:4px 18px 4px 8px;text-align:right"><button class="btn btn-secondary" onClick="{{ r.open }}">Ouvrir</button></td>'
STK=('<sc-if value="{{ isStock }}"><div style="display:flex;flex-direction:column;gap:14px">'
  +STKHEAD('<span style="font-size:14px">{{ stkSum }}</span><span style="flex:1"></span><button class="btn btn-secondary" onClick="{{ stkExport }}" style="gap:8px"><sa-i n="download" s="17"></sa-i>Excel</button><button class="btn btn-primary" onClick="{{ stkNew }}" style="gap:8px"><sa-i n="plus" s="17"></sa-i>Nouveau produit</button>')
  +SEG('stkCats')
  +'<sc-if value="{{ stkAlert }}"><div role="status" style="padding:10px 14px;border:2px solid var(--color-accent-900);font-weight:600">{{ stkAlert }}</div></sc-if>'
  +CARD('<table class="table" style="font-size:14px"><thead><tr>'+TH%('padding-left:18px','Produit')+TH%('','Catégorie')+TH%('text-align:right','En stock')+TH%('text-align:right','Seuil')+TH%('text-align:right','Prix')+TH%('text-align:right','Valeur')+TH%('','')+TH%('','')+'</tr></thead><tbody>'
  '<sc-for list="{{ iRows }}" as="r"><tr><td style="padding:var(--sa-row,10px) 8px var(--sa-row,10px) 18px;font-weight:{{ r.fw }}">{{ r.nom }}</td>'+TD%('','{{ r.cat }}')+TD%('text-align:right;font-weight:{{ r.fw }}','{{ r.qte }}')+TD%('text-align:right','{{ r.seuil }}')+TD%('text-align:right','{{ r.prix }}')+TD%('text-align:right','{{ r.val }}')+TD%('font-weight:700','{{ r.etat }}')
  +OPENTD+'</tr></sc-for></tbody></table>','overflow-x:auto')+'</div></sc-if>\n')
FLT=('<sc-if value="{{ isFlotte }}"><div style="display:flex;flex-direction:column;gap:14px">'
  +STKHEAD('<span style="font-size:14px">{{ fSum }}</span><span style="flex:1"></span><button class="btn btn-primary" onClick="{{ fltNew }}" style="gap:8px"><sa-i n="plus" s="17"></sa-i>Nouveau véhicule</button>')
  +CARD('<table class="table" style="font-size:14px"><thead><tr>'+TH%('padding-left:18px','Véhicule')+TH%('','Plaque')+TH%('','Année')+TH%('','Couleur')+TH%('text-align:right','Kilométrage')+TH%('','Assigné à')+TH%('','')+'</tr></thead><tbody>'
  '<sc-for list="{{ fRows }}" as="r"><tr><td style="padding:var(--sa-row,10px) 8px var(--sa-row,10px) 18px;font-weight:600">{{ r.nom }}</td>'+TD%('','{{ r.plaque }}')+TD%('','{{ r.annee }}')+TD%('','{{ r.couleur }}')+TD%('text-align:right','{{ r.km }}')+TD%('','{{ r.assigne }}')
  +OPENTD+'</tr></sc-for></tbody></table>','overflow-x:auto')+'</div></sc-if>\n')
bs=block(M,'isStats')
if bs: M=M.replace(bs,bs+STK+FLT,1)
else: print('!! ancre isStats (Stock)')
SE=WRAP('seOpen','seCloseBg',DLGHEAD('seTitle','seClose')
  +IF('seInv',FL('Nom du produit',INP('sNom.v','sNom.on'))
    +G2(FL('Catégorie',SEL('sCats','onSCat')),FL('Unité',SEL('sUnits','onSUnit')))
    +G2(FL('Qté en stock',INP('sQte.v','sQte.on','number',' min="0" step="0.1"')),FL('Seuil d’alerte',INP('sSeuil.v','sSeuil.on','number',' min="0" step="0.1"')))
    +FL('Prix unitaire ($)',INP('sPrix.v','sPrix.on','number',' min="0" step="0.01"'))
    +IF('seCanAdj','<div style="border:1px solid var(--color-divider);padding:12px;display:flex;flex-direction:column;gap:8px"><b>Entrée ou sortie de stock</b><div style="display:flex;gap:8px;align-items:center">'
      +'<input class="input" type="number" min="0" step="0.1" value="{{ seDelta }}" onInput="{{ onSeDelta }}" aria-label="Quantité à ajuster" placeholder="Quantité" style="max-width:140px">'
      +BTNX('btn-secondary','seIn','+ Entrée')+BTNX('btn-secondary','seOut','− Sortie')+'</div><div style="font-size:13px">Appliqué tout de suite sur la quantité du serveur (sans écraser un mouvement fait ailleurs au même moment).</div></div>'))
  +IF('seFl',G2(FL('Nom / modèle',INP('sNom.v','sNom.on')),FL('Plaque',INP('sPlaque.v','sPlaque.on')))
    +G2(G2(FL('Année',INP('sAnnee.v','sAnnee.on')),FL('Couleur',INP('sCouleur.v','sCouleur.on'))),FL('Kilométrage',INP('sKm.v','sKm.on','number',' min="0"')))
    +FL('Assigné à',SEL('sAssignes','onSAssigne')))
  +FL('Notes',TXT('sNotes.v','sNotes.on',''))
  +'<div class="dialog-actions" style="margin-top:0;flex-wrap:wrap">'+IF('seCanDel',BTNX('btn-secondary','seDel','{{ seDelLbl }}'))+'<span style="flex:1"></span>'+BTNX('btn-secondary','seClose','Fermer')+BTNX('btn-primary','seSave','{{ seSaveLbl }}')+'</div>')
M=M.rstrip()+'\n'+SE

# ---------- OUTILS · QR + EMPLACEMENTS + CONFIGURATION ----------
OT_LIST=IF('otOutils','<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+SEG('outFilters')+'<input class="input" type="search" placeholder="Rechercher (nom, repérage, détenteur)…" value="{{ outQ }}" onInput="{{ onOutQ }}" style="max-width:300px"><span style="flex:1"></span>'
  +BTNX('btn-secondary','oPrintAll','Imprimer les étiquettes')+'<button class="btn btn-primary" onClick="{{ oNew }}" style="gap:8px"><sa-i n="plus" s="17"></sa-i>Nouvel outil</button></div>'
  '<sc-if value="{{ oNone }}"><div style="font-size:15px;border:1px dashed var(--color-text);padding:14px">Aucun outil pour ce filtre.</div></sc-if>'
  +CARD('<table class="table" style="font-size:14px"><thead><tr>'+TH%('padding-left:18px','Outil')+TH%('','Repérage')+TH%('','Catégorie')+TH%('','État')+TH%('','Emplacement')+TH%('','')+'</tr></thead><tbody>'
  '<sc-for list="{{ oRows }}" as="r"><tr><td style="padding:var(--sa-row,10px) 8px var(--sa-row,10px) 18px;font-weight:600">{{ r.nom }}</td>'+TD%('font-family:monospace','{{ r.rep }}')+TD%('','{{ r.cat }}')+TD%('font-weight:{{ r.fw }}','{{ r.etat }}')+TD%('','{{ r.emp }}')
  +'<td style="padding:4px 18px 4px 8px;text-align:right"><button class="btn btn-secondary" onClick="{{ r.open }}">Ouvrir</button></td></tr></sc-for></tbody></table>','overflow-x:auto'))
OT_EMP=IF('otEmp','<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:14px">Chaque étagère a son étiquette QR : scannée sur le terrain, elle montre ce qui devrait s’y trouver.</span><span style="flex:1"></span>'
  +BTNX('btn-secondary','empPrintAll','Imprimer toutes les étiquettes')+'<button class="btn btn-primary" onClick="{{ empNew }}" style="gap:8px"><sa-i n="plus" s="17"></sa-i>Nouvel emplacement</button></div>'
  '<sc-if value="{{ empSans }}"><div role="status" style="padding:10px 14px;border:1px dashed var(--color-text)">{{ empSans }}</div></sc-if>'
  '<sc-for list="{{ empGroups }}" as="g">'+CARD('<div style="padding:10px 18px;border-bottom:1px solid var(--color-divider);font:600 20px var(--font-heading)">{{ g.bat }}</div><table class="table" style="font-size:14px"><tbody>'
  '<sc-for list="{{ g.rows }}" as="e"><tr><td style="padding:var(--sa-row,10px) 8px var(--sa-row,10px) 18px"><div style="font-weight:600">{{ e.nom }}</div><div style="font-size:12px">{{ e.zone }}</div></td>'+TD%('font-family:monospace','{{ e.id }}')+TD%('','{{ e.n }}')+TD%('font-size:13px','{{ e.items }}')
  +'<td style="padding:4px 18px 4px 8px;text-align:right;white-space:nowrap"><button class="btn btn-ghost" onClick="{{ e.print }}">Étiquette</button><button class="btn btn-secondary" onClick="{{ e.edit }}">Modifier</button></td></tr></sc-for></tbody></table>','overflow-x:auto')+'</sc-for>')
CFGLIST=lambda title,lst,addfn,cols:CARD('<div style="padding:10px 18px;border-bottom:1px solid var(--color-divider);display:flex;align-items:center;gap:10px"><span style="font:600 20px var(--font-heading);flex:1">%s</span><button class="btn btn-ghost" onClick="{{ %s }}">+ Ajouter</button></div><table class="table" style="font-size:14px"><tbody><sc-for list="{{ %s }}" as="c"><tr>%s<td style="padding:4px 18px 4px 8px;text-align:right"><button class="btn btn-secondary" onClick="{{ c.edit }}">Modifier</button></td></tr></sc-for></tbody></table>'%(title,addfn,lst,cols))
OT_CFG=IF('otCfg','<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:18px;align-items:start">'
  +CFGLIST('Catégories d’outils','cfgCats','catNew','<td style="padding:var(--sa-row,10px) 8px var(--sa-row,10px) 18px;width:30px">{{ c.icon }}</td>'+TD%('font-weight:600','{{ c.label }}')+TD%('','{{ c.n }}'))
  +CFGLIST('Préfixes de repérage','cfgPres','preNew','<td style="padding:var(--sa-row,10px) 8px var(--sa-row,10px) 18px;font-family:monospace;font-weight:700">{{ c.id }}</td>'+TD%('','{{ c.label }}')+TD%('','{{ c.n }}'))
  +CARD('<div style="padding:14px 18px;display:flex;flex-direction:column;gap:10px"><span style="font:600 20px var(--font-heading)">Préfixe QR global</span>'+FL('Préfixe',INP('qrIn','onQrIn','text',' aria-label="Préfixe QR"'))+'<div style="font-size:13px;font-family:monospace">{{ qrFmt }}</div>'+BTNX('btn-primary','qrSave','Enregistrer le préfixe').replace('style="white-space:nowrap"','style="white-space:nowrap;align-self:flex-start"')+'</div>')
  +'</div>')
OUTSCR=('<sc-if value="{{ isOutils }}"><div style="display:flex;flex-direction:column;gap:14px">'+SEG('outTabs')
  +'<sc-if value="{{ outLoading }}"><div>Chargement…</div></sc-if><sc-if value="{{ outErr }}"><div role="alert" style="padding:10px 14px;border:2px solid var(--color-accent-900)">{{ outErr }}</div></sc-if>'
  +OT_LIST+OT_EMP+OT_CFG+'</div></sc-if>\n')
bs=block(M,'isStats')
if bs: M=M.replace(bs,bs+OUTSCR,1)
else: print('!! ancre isStats (Outils)')
TE=WRAP('teOpen','teCloseBg',DLGHEAD('teTitle','teClose')
  +IF('teHasEtat','<div style="padding:8px 12px;border:1px solid var(--color-text);font-weight:600">{{ teEtat }}</div>')
  +G2(G2(FL('Préfixe',SEL('tePres','onTePre')),FL('Numéro',INP('teNum','onTeNum'))),FL('Catégorie',SEL('teCats','onTeCat')))
  +FL('Nom de l’outil',INP('teNom','onTeNom'))+FL('Emplacement',SEL('teEmps','onTeEmp'))+FL('Notes',TXT('teNotes','onTeNotes',''))
  +FL('Photos','<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><sc-for list="{{ tePhotos }}" as="p"><span style="display:flex;align-items:center;gap:4px;border:1px solid var(--color-divider);padding:2px 4px 2px 8px;font-size:13px"><button onClick="{{ p.open }}" style="all:unset;cursor:pointer;text-decoration:underline">{{ p.name }}</button><button class="btn btn-ghost btn-icon" onClick="{{ p.del }}" aria-label="Retirer"><sa-i n="x" s="16"></sa-i></button></span></sc-for><button class="btn btn-ghost" onClick="{{ teAddPhoto }}" style="gap:6px"><sa-i n="camera" s="16"></sa-i>Ajouter une photo</button></div>')
  +'<div style="font-size:13px">Repérage <b style="font-family:monospace">{{ teRep }}</b> · code QR : <span style="font-family:monospace;word-break:break-all">{{ tePayload }}</span></div>'
  +IF('teHasMoves','<div style="border:1px solid var(--color-divider);padding:10px 12px;display:flex;flex-direction:column;gap:6px"><b>Historique récent</b><sc-for list="{{ teMoves }}" as="m"><div><div style="font-weight:600;font-size:14px">{{ m.txt }}</div><div style="font-size:12px">{{ m.sub }}</div></div></sc-for></div>')
  +'<div class="dialog-actions" style="margin-top:0;flex-wrap:wrap">'+IF('teCanDel',BTNX('btn-secondary','teDel','{{ teDelLbl }}'))+BTNX('btn-secondary','tePrint','Imprimer l’étiquette')
  +IF('teCanMaint',BTNX('btn-secondary','teMaint','{{ teMaintLbl }}'))+IF('teCanForce',BTNX('btn-secondary','teForce','Forcer le retour'))+'<span style="flex:1"></span>'+BTNX('btn-secondary','teClose','Fermer')+BTNX('btn-primary','teSave','{{ teSaveLbl }}')+'</div>')
KE=WRAP('keOpen','keCloseBg',DLGHEAD('keTitle','keClose')
  +IF('keCat',G2(FL('Icône (emoji)',INP('kIcon','onKIcon')),FL('Nom de la catégorie',INP('kLabel','onKLabel'))))
  +IF('kePre',IF('keNew',FL('Préfixe (lettres)',INP('kId','onKId','text',' autocapitalize="characters" placeholder="ex. PER"')))+IF('keOld','<div style="font:700 18px monospace">{{ keCode }}-</div>')
    +FL('Description',INP('kLabel','onKLabel'))+G2(FL('Prochain numéro',INP('kNext','onKNext','number',' min="1"')),FL('Pour',SEL('kScopes','onKScope'))))
  +IF('keEmp',IF('keNew',FL('Code de repérage',INP('kId','onKId','text',' autocapitalize="characters" placeholder="ex. EMP-C1"')))+IF('keOld','<div style="font:700 18px monospace">{{ keCode }}</div>')
    +G2(FL('Bâtiment',SEL('kBats','onKBat')),FL('Zone',INP('kZone','onKZone')))+FL('Étagère / local',INP('kNom','onKNom')))
  +'<div class="dialog-actions" style="margin-top:0;flex-wrap:wrap">'+IF('keCanDel',BTNX('btn-secondary','keDel','{{ keDelLbl }}'))+'<span style="flex:1"></span>'+BTNX('btn-secondary','keClose','Fermer')+BTNX('btn-primary','keSave','{{ keSaveLbl }}')+'</div>')
M=M.rstrip()+'\n'+TE+KE

# ---------- PORTAIL (page d'accueil après la connexion) ----------
PTILE=('<sc-for list="{{ portTiles }}" as="t">'+CARD('<div style="padding:22px 22px 20px;display:flex;flex-direction:column;gap:12px;height:100%;box-sizing:border-box">'
  '<div style="display:flex;align-items:center;gap:12px"><span style="width:46px;height:46px;flex:none;border:1.5px solid var(--color-text);display:flex;align-items:center;justify-content:center"><sa-i n="{{ t.icon }}" s="24"></sa-i></span>'
  '<span style="font:600 24px/1.1 var(--font-heading);white-space:nowrap">{{ t.title }}</span></div>'
  '<div style="font-size:15px;line-height:1.45;flex:1">{{ t.sub }}</div><div style="font-size:13px;color:var(--color-accent-700);font-weight:600">{{ t.info }}</div>'
  '<sc-if value="{{ t.primary }}"><button class="btn btn-primary" onClick="{{ t.go }}" style="align-self:stretch;justify-content:center;min-height:44px">{{ t.btn }}</button></sc-if>'
  '<sc-if value="{{ t.sec }}"><button class="btn btn-secondary" onClick="{{ t.go }}" style="align-self:stretch;justify-content:center;min-height:44px">{{ t.btn }}</button></sc-if></div>')+'</sc-for>')
PORTAIL=('<sc-if value="{{ isPortail }}"><div role="dialog" aria-label="Portail Soucy Aquatik" style="position:fixed;inset:0;z-index:40;background:var(--color-bg);overflow-y:auto">'
  '<div style="max-width:1120px;margin:0 auto;padding:40px 24px 32px;display:flex;flex-direction:column;gap:28px;min-height:100%;box-sizing:border-box">'
  '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div style="width:56px;height:56px;flex:none;background:#004987;color:#ffffff;display:flex;align-items:flex-end;padding:6px;box-sizing:border-box;font:600 13px/0.95 var(--font-heading)">Soucy<br>Aquatik</div>'
  '<div style="display:flex;flex-direction:column;flex:1;min-width:220px"><span style="font:600 clamp(28px,5vw,40px)/1.05 var(--font-heading)">{{ portHello }}</span><span style="font-size:15px;color:var(--color-accent-700)">{{ portDate }} · Où voulez-vous aller ?</span></div>'
  '<button class="btn btn-ghost" onClick="{{ logout }}">Se déconnecter</button></div>'
  '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px">'+PTILE+'</div>'
  '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:14px;margin-top:auto"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" checked="{{ portSkip }}" onChange="{{ onPortSkip }}">Sur ce poste, ouvrir directement sa-admin (le portail reste accessible par « Accueil »)</label>'
  '<span style="flex:1"></span><span style="font-size:13px">Astuce : admin.html#temps ouvre directement Temps · Paie</span></div>'
  '</div></div></sc-if>\n')
M=M.rstrip()+'\n'+PORTAIL
_logo='<div style="display:flex;flex-direction:column;line-height:1.15"><span style="font:600 20px var(--font-heading)">sa-admin</span><span style="font-size:12px;color:var(--color-accent-700)">Centre des opérations</span></div>\n    </div>'
if M.count(_logo)==1: M=M.replace(_logo,_logo+'<button onClick="{{ openPortail }}" style="all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;height:38px;padding:0 14px 0 16px;border-bottom:1px solid var(--color-divider);font-weight:600" data-hv="1"><sa-i n="home" s="18"></sa-i>Accueil · toutes les applications</button>',1)
else: print('!! logo sa-admin introuvable',M.count(_logo))


# Monitoring : lien vers la photo jointe à une demande du terrain (chargée seulement au clic)
rep('<span style="font-size:12px">{{ f.who }} · {{ f.site }}</span>','<span style="font-size:12px">{{ f.who }} · {{ f.site }}</span><sc-if value="{{ f.hasPhoto }}"><button onClick="{{ f.openPhoto }}" style="all:unset;cursor:pointer;font-size:12px;text-decoration:underline;width:fit-content">Voir la photo jointe</button></sc-if>')
# Carte : la maquette affichait une <iframe src="SA Carte.html"> (fichier de démo jamais déployé : en production,
# l'URL inexistante renvoie une autre page, d'où une « carte » blanche ou étrangère). On remplace l'iframe par le
# conteneur de la vraie carte Leaflet (syncMap), dans le même panneau, à côté de la liste « En tournée ».
_ifr=re.findall(r'<iframe src="SA Carte\.html"[^>]*></iframe>',M)
if len(_ifr)==1: M=M.replace(_ifr[0],'<div id="mapSlot" style="position:absolute;inset:0"></div>',1)
else: print('!! iframe de carte introuvable',len(_ifr))

M=re.sub(r'<sc-(for|if)\b',r'<template data-sc="\1"',M); M=M.replace('</sc-for>','</template>').replace('</sc-if>','</template>')
open(os.path.join(OUT,'admin.markup.html'),'w',encoding='utf-8').write(M)
M=re.sub(r'(<template data-sc="if" value="\{\{ isCarte \}\}"[^>]*>\s*<div style="display:flex;flex-direction:column;gap:16px;height:100%">)',r'\1<div style="font-size:13px">{{ carteInfo }}</div>',M,count=1)
ds=re.sub(r"@import url\([^)]*\);\s*",'',open(os.path.join(SRC,'design')+'/ds/styles.css',encoding='utf-8').read())
icons=open(os.path.join(SRC,'design')+'/sa-icons.js',encoding='utf-8').read()
# Leaflet intégré au fichier (plus de dépendance à unpkg.com, bloqué par certains filtres/bloqueurs).
LF=os.path.join(SRC,'vendor','leaflet-1.9.4')
lcss=open(os.path.join(LF,'leaflet.css'),encoding='utf-8').read(); ljs=open(os.path.join(LF,'leaflet.js'),encoding='utf-8').read()
assert '</script' not in ljs.lower() and '</style' not in lcss.lower()
# Générateur QR (qrcodejs, MIT — la même bibliothèque que SA Platform) pour les étiquettes d'outils et d'emplacements
qjs=open(os.path.join(SRC,'vendor','qrcodejs','qrcode.min.js'),encoding='utf-8').read(); assert '</script' not in qjs.lower()
rt=open(os.path.join(HERE,'runtime.js'),encoding='utf-8').read(); app=open(os.path.join(HERE,'app.js'),encoding='utf-8').read()
html='''<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SA Admin — Centre des opérations</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;700&family=Barlow+Condensed:wght@400;600&display=swap" rel="stylesheet">
<style>
'''+ds+'''
html,body{margin:0;height:100%;background:var(--color-bg)}
#app{position:fixed;inset:0}#app>div{height:100%}
button{font-family:inherit}a{color:var(--color-accent-700)}
#login{position:fixed;inset:0;background:var(--color-bg);display:none;align-items:center;justify-content:center;padding:24px;z-index:50}
#login form{width:100%;max-width:380px;display:flex;flex-direction:column;gap:16px}#login h1{margin:0;font-size:44px;line-height:1}
'''+'\n'.join(css)+'''
</style></head><body>
<div id="app"></div>
<div id="login"><form id="loginForm" autocomplete="on">
<div style="font:400 14px var(--font-body);color:var(--color-accent-700)">Soucy Aquatik · sa-admin</div><h1>Centre des opérations</h1>
<div class="field"><label>Identifiant</label><input id="lu" class="input" autocomplete="username" autocapitalize="off"></div>
<div class="field"><label>Mot de passe</label><input id="lp" class="input" type="password" autocomplete="current-password"></div>
<div id="le" style="min-height:22px;font-size:15px"></div>
<button class="btn btn-primary" type="submit" style="min-height:48px">Se connecter</button></form></div>
<template id="tpl">'''+M+'''</template>
<style>'''+lcss+'''</style>
<script>'''+ljs+'''</script>
<script>'''+qjs+'''</script>
<script>'''+icons+'''</script><script>'''+rt+'''</script><script>'''+app+'''</script>
</body></html>'''
open(os.path.join(OUT,'admin.html'),'w',encoding='utf-8').write(html)
print('taille',len(html),'| règles',len(css))
