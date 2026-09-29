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
  '<div style="font-size:13px">Heures en décimal pour la paie (7,25 = 7 h 15). La feuille regroupe les punchs d’une même journée sur un même lieu et ODT ; le journal les montre un par un. Le fichier Excel contient un sommaire, une feuille par employé et le journal complet.</div>'
  +CARD('<sc-for list="{{ paie }}" as="p"><div style="display:grid;grid-template-columns:40px minmax(160px,1.4fr) repeat(3,90px) 70px minmax(160px,1.6fr) 44px;gap:10px;align-items:center;padding:10px 18px;border-bottom:1px solid var(--color-divider)">'
  '<button onClick="{{ p.toggle }}" aria-label="Sélectionner" style="all:unset;cursor:pointer;width:24px;height:24px;border:1.5px solid var(--color-text);background:{{ p.box }};color:var(--color-bg);display:flex;align-items:center;justify-content:center"><sc-if value="{{ p.on }}"><sa-i n="check" s="16" w="2.5"></sa-i></sc-if></button>'
  '<span style="font-weight:500">{{ p.nom }}</span><span style="text-align:right;font:600 16px var(--font-heading)">{{ p.total }} h</span><span style="text-align:right">{{ p.reg }} rég.</span><span style="text-align:right">{{ p.supp }} supp.</span><span style="text-align:right">{{ p.punchs }}</span>'
  '<span style="font-size:13px">{{ p.statut }}</span><button class="btn btn-ghost btn-icon" onClick="{{ p.expand }}" aria-label="Détail"><sa-i n="{{ p.chev }}" s="18"></sa-i></button></div>'
  '<sc-if value="{{ p.open }}"><div style="padding:6px 18px 14px 68px;border-bottom:1px solid var(--color-divider);background:var(--color-accent-100)"><sc-for list="{{ p.detail }}" as="d"><div style="font:600 15px var(--font-heading);margin-top:8px">{{ d.jour }}</div>'
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
<script>'''+icons+'''</script><script>'''+rt+'''</script><script>'''+app+'''</script>
</body></html>'''
open(os.path.join(OUT,'admin.html'),'w',encoding='utf-8').write(html)
print('taille',len(html),'| règles',len(css))
