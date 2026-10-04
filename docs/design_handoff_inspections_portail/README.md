# Passation — Refonte Inspections + Portail client (SA Platform)

Document autonome à remettre à Claude Code. À lire **avec** `docs/HANDOFF-CLAUDE-CODE.md` du dépôt `cww-soucy/sa-platform` (architecture, pipeline `assemble.py`, sécurité, incidents). Rien ici ne remplace ces règles.

---

## 1. Vue d'ensemble

La section **Inspections et rapports** de sa-admin est trop centrée sur la chimie de l'eau et difficile à lire (8 onglets de paramètres, chiffres sans priorité). Le nouveau design :

1. Organise toute inspection par **6 systèmes de l'installation** : Eau du bassin · Traitement et dosage · Circulation et filtration · Chauffage et ventilation · Sécurité et RQEP · Structure et surfaces.
2. Donne à chaque point **un état écrit en toutes lettres** : Conforme / À surveiller / Action requise (+ Sans objet).
3. Montre **les exceptions d'abord** ; ce qui est conforme tient en une ligne.
4. Gère les **sites à plusieurs bassins**, avec **plans** rattachés au site, à un bassin ou au dossier client.
5. Ajoute un **portail client** (code QR dans la salle mécanique + lien « Envoyer au client »), sécurisé, avec **niveaux d'accès** et **logo du client**.
6. Tout ce que fait le terrain ou le client est **aussi faisable depuis sa-admin** (saisie bureau, aperçu client, gestion QR et accès).

## 2. À propos des fichiers de design

`Inspections Mockups.dc.html` est une **référence de design en HTML** (maquettes), pas du code de production. Il ne faut **pas** le copier tel quel. La tâche est de **recréer ces écrans dans les apps existantes** (`admin.html`, `terrain.html`, nouvelle app portail) avec leurs conventions : gabarit `<sc-if>/<sc-for>`, logique dans `admin.app.js` / `terrain.app.js`, construction par `assemble.py`, styles `ds/styles.css`, icônes `sa-icons.js`.

Ouvrir le fichier dans un navigateur (servir le dossier en local, ex. `npx serve .`). Les écrans sont groupés en **tours**, le plus récent en haut. Les données affichées viennent de `src/design/sa-data.js` (démo) ; les points de contrôle hors chimie, les 6 bassins de Granby, les notes, produits et photos sont **inventés pour l'exemple**.

## 3. Fidélité

**Haute fidélité** pour la mise en page, la hiérarchie, les états et le vocabulaire. Les couleurs et polices sont celles du design system déjà en place (Industry : Barlow Condensed / Barlow, accent acier). Recréer avec les variables CSS existantes — ne pas introduire de nouvelles couleurs.

## 4. Écrans retenus et écrans d'exploration

| Id dans le fichier | Statut | Destination |
|---|---|---|
| **3a** (5 écrans téléphone) | Retenu | sa-terrain · saisie de visite |
| **2a** Bilan par système | Retenu | sa-admin › Inspections · vue par défaut d'un site |
| **2b** Rapport de visite | Retenu | sa-admin › Inspections › une visite (et base du PDF client) |
| **1a** Matrice de conformité | Retenu en secondaire | cible du bouton « Tendances de l'eau » |
| **5a-1** Fiche site, bassins sur plan | Retenu | sa-admin › Sites › fiche · onglet « Bassins et plan » |
| **5a-2** Saisie bureau + niveaux d'accès | Retenu | sa-admin › Inspections › Nouvelle inspection |
| **4a-5** Accès client et QR | Retenu | sa-admin › Sites › fiche · onglet « Accès client » |
| **4a-1** Affiche QR | Retenu | impression depuis sa-admin |
| **4a-2/3/4**, **5a-3/4** | Retenu | Portail client (mobile et ordinateur) |
| **2c** Schéma de l'installation | Phase ultérieure (optionnel) | nécessite un modèle d'équipements ordonnés |
| **1b, 1c** | Exploration, non retenu | — |

## 5. Arborescence cible

```
sa-terrain (terrain.html)
└─ Tournée › Site › Visite d'inspection          [NOUVEAU flux, remplace la saisie de relevé actuelle]
   ├─ 1 Démarrer (liste des 6 systèmes + bassins du site)
   ├─ 2 Eau du bassin (par bassin)
   ├─ 3..6 Systèmes (Conforme / À surveiller / Action)
   ├─ Produits et photos
   └─ Résumé › Valider et envoyer (hors réseau : file d'attente)

sa-admin (admin.html)
├─ Terrain › Inspections et rapports
│  ├─ Liste des sites (tri par gravité, 4 pastilles : eau / mécanique / sécurité / structure)
│  ├─ Site › Bilan par système (2a)            [par défaut]
│  ├─ Site › Visite (2b) · historique des visites à gauche
│  ├─ Site › Tendances de l'eau (1a)
│  └─ Nouvelle inspection · saisie bureau (5a-2)
├─ Gestion › Sites › fiche du site
│  ├─ Bassins et plan                           [NOUVEAU]
│  ├─ Inspections (raccourci vers ci-dessus)
│  ├─ Plans et documents                        [NOUVEAU]
│  ├─ Équipements (existant)
│  └─ Accès client (QR, contacts, visibilité, journal)  [NOUVEAU]
└─ Gestion › Clients (ou Paramètres)
   ├─ Logo du client                            [NOUVEAU]
   ├─ Niveaux d'accès (Opérateur / Gestionnaire / Direction)  [NOUVEAU]
   └─ Documents du dossier client               [NOUVEAU]

Portail client (NOUVELLE app : client.html ou /portail/)
├─ /q/<jeton>  → identification du bassin/site → vérification (code à usage unique)
├─ Accueil installation : interventions en cours, bassins, « à votre attention »
├─ Bassin › Relevés · Historique · Rapports · Plans et documents · Interventions · Factures
└─ Mes installations (sélecteur si le contact a plusieurs sites)
```

## 6. Écrans en détail

Conventions communes (toutes les vues) :
- Texte courant **15 px** Barlow, line-height 1.5. Titres Barlow Condensed 600 : écran 30 px, section 22 px, carte 18 px, nom de site 28–32 px.
- Bordures fines `var(--color-divider)`, coins carrés. Barre latérale sa-admin sur `--color-accent-100`, élément actif fond `--color-bg` + barre gauche 3 px `--color-accent-700`. En-tête d'écran : trait bas 2 px `--color-accent-500`. Onglet actif : trait bas 3 px `--color-accent-700`.
- Ligne sélectionnée dans une liste : fond `--color-accent-100` + barre gauche 3 px `--color-accent-700`.
- Mobile : cibles ≥ 44 px, boutons principaux 52 px, champs de valeur 40 px avec chiffre Barlow Condensed 600 20 px.

### Pastilles d'état (composant à créer une fois, réutilisé partout)
| État | Code | Carré 12 px (14 px mobile) | Texte |
|---|---|---|---|
| Conforme | `ok` | contour 1,5 px `--color-text`, fond vide | « Conforme » |
| À surveiller | `watch` | contour 1,5 px + hachures `repeating-linear-gradient(135deg, var(--color-text) 0 1.5px, transparent 1.5px 4px)` | « À surveiller » |
| Action requise | `action` | plein `--color-accent-900` | « Action requise » (client : « Intervention ») |
| Sans objet | `na` | contour pointillé `--color-neutral-500` | « Sans objet » / « Hiverné » |

Toujours accompagner la pastille du **libellé texte** (jamais la couleur seule). Une valeur hors zone s'affiche **en plein** (`--color-accent-900`, texte blanc).

### 6.1 sa-terrain · Visite d'inspection (3a)
1. **Démarrer** : en-tête site (nom 26 px, bassin, type, heure du punch), barre d'avancement « N systèmes sur 6 » + estimation, liste des systèmes (ligne 62 px : icône, nom, « Fait · état » ou « À faire · N points », pastille ou chevron), bouton bas « Continuer : <système suivant> ». Les systèmes et points viennent de la configuration du site (§7).
2. **Eau** : une ligne par paramètre du type de bassin (`types_bassin`) : libellé + unité, « Zone lo – hi » en dessous, champ valeur à droite. Clavier numérique intégré (virgule décimale, « Suivant » passe au champ suivant). Valeur hors zone → ligne teintée `accent-100`, valeur en plein, libellé « Hors zone · max X », puis « Qu'avez-vous fait ? » (puces : Chloration choc / Apport d'eau neuve / Signaler seulement — liste configurable par paramètre).
3. **Équipements / Structure / Chauffage** : bouton « Tout est conforme » en tête (met tous les points à `ok`). Chaque point : segmenté 3 états. Si `watch` ou `action` : note, photos (vignettes 52 px + bouton appareil photo), champ mesure optionnel (ex. niveau réservoir %), case « Créer un bon de travail urgent » (crée un WO lié).
4. **Sécurité RQEP** : oui/non par point. Points obligatoires : tant qu'ils n'ont pas de réponse, le bouton bas est désactivé (« N point(s) à répondre »). « Non » exige une note.
5. **Résumé** : phrase générée (§8), une ligne par système avec pastille, produits ajoutés (± par pas, unité du produit), signature facultative du responsable (réutiliser la signature au doigt de Logistique), « Valider et envoyer ». Hors réseau : file locale, envoi au retour du réseau (même mécanique que `qr-carnet`).

### 6.2 sa-admin · Inspections, Bilan par système (2a)
- Grille : liste des sites 272 px | contenu.
- **Liste des sites** : recherche, « Trié par gravité » + 4 icônes de colonnes (eau, mécanique, sécurité, structure), ligne = nom, « ville · type · dernière visite », 4 pastilles. Tri par score (§8).
- **En-tête du site** : type · contrat, nom 32 px, « client · bassin · dernière visite par <tech> » ; boutons « Rapport client » (principal) et « Tendances de l'eau ».
- **Verdict** : bandeau `accent-100` bordé `accent-300` : « N actions requises, N points à surveiller, N points conformes. » + 3 compteurs avec pastilles.
- **6 cartes** (grille 3 × 2, séparateurs 1 px) : en-tête (icône, nom 18 px, libellé d'état + pastille) — fond `accent-900` texte blanc si `action`, `accent-100` si `watch`. Corps : les 2 écarts les plus graves (« **Libellé** · valeur », détail 13 px gris) ou « Rien à signaler. », pied « N points conformes sur M » + « Détail → ».
- **À faire** : liste unique, tous systèmes : pastille, action, système, assignation / bon de travail. Alimentée par les points `watch`/`action` non résolus + WO liés.

### 6.3 sa-admin · Rapport de visite (2b)
- Barre site : sélecteur de site (bouton bordé, nom 22 px), contexte, « Site précédent / suivant ».
- Grille : historique des visites 220 px | article | panneau 250 px.
- **Visites** : date + heure, résumé (« 2 actions · 4 à surveiller » ou « Tout conforme »), technicien, pastille.
- **Article** : titre « Visite du <date>, <heure> », technicien + heure de validation ; paragraphe de résumé 16 px (§8) ; puis une section par système **triée par gravité**. Systèmes non conformes ouverts : lignes « point | valeur + détail | état » avec étiquette « Nouveau » / « Depuis le <date> » / « Depuis N visites ». Eau : seulement les paramètres hors zone + lien « N autres paramètres dans la zone · afficher le tableau complet et les tendances → ». Systèmes conformes : une ligne grise listant les points.
- **Panneau** : photos (légendées), produits ajoutés, boutons « Envoyer au client » (principal) et « PDF ».

### 6.4 sa-admin · Tendances de l'eau (1a)
Matrice paramètres × 12 dernières visites (cases hors zone pleines), colonne zone visée et % conforme 30 j ; une ligne se déplie en graphique 30 jours avec bande de zone hachurée et statistiques (moyenne, min/max, % dans la zone, jours hors zone). Sélecteur 12 visites / 30 j / 90 j. C'est l'actuelle vue graphique de l'onglet Inspections, réorganisée.

### 6.5 sa-admin · Fiche site › Bassins et plan (5a-1)
- En-tête : logo client 56 px, fil « Sites › client · contrat », nom 30 px, « N bassins · adresse », boutons « Voir comme le client », « Accès client et QR », « Nouvelle inspection » (principal).
- Onglets : Bassins et plan · Inspections · Plans et documents (N) · Équipements · Accès client (N).
- Gauche : sélecteur de plan par niveau (ex. Niveau des bassins / Salle mécanique / Extérieur), **plan 260 px de haut** (volontairement compact) avec marqueurs numérotés 30 px (style = état du bassin) + nom ; on glisse un numéro pour placer un bassin (coordonnées en % du plan). Dessous, liste « Plans et documents » : nom, type/poids/rattachement, niveau de visibilité (œil + niveau), menu « Visibilité ».
- Droite (400 px) : liste des bassins (numéro-pastille, nom, état, résumé, volume · fréquence RQEP · dernière visite), « + Ajouter un bassin », actions du bassin sélectionné.

### 6.6 sa-admin · Saisie bureau (5a-2)
Même contenu que 3a, en formulaire desktop : date/heure, « Au nom de » (technicien), source (« Relevé transmis par téléphone », « Correction », « Visite sans réseau »…), choix du bassin, bloc Eau en grille 4 colonnes (libellé = « Paramètre · zone »), systèmes repliés avec « Tout conforme » rapide, produits/photos/note (fichiers depuis l'ordinateur). Pied : « Enregistrer le brouillon », « Aperçu client », « Valider et publier ». Toute saisie bureau est journalisée (« saisie par <compte> »). À droite : grille des niveaux d'accès du client et bloc « Après publication » (visible sur la page QR, courriel au gestionnaire, texto à l'opérateur — cases à cocher) + « Voir comme : Opérateur · Gestionnaire · Direction ».

### 6.7 sa-admin · Accès client et QR (4a-5)
Code QR + identifiant (ex. `SA-S08-B1`), « Imprimer l'affiche », « Régénérer le code » (désactive immédiatement l'ancien). Contacts autorisés (nom, rôle/niveau, courriel ou cellulaire, dernier accès, retirer). « Ce que le client voit » (cases). Journal des accès, tentatives refusées incluses.

### 6.8 Affiche QR (4a-1)
Format lettre/demi-lettre imprimable : logo Soucy Aquatik, « Relevés et rapports de cette installation », nom du site 30 px, QR ~5,5 cm, « Scannez avec l'appareil photo de votre téléphone. », mention d'accès réservé, pied « Urgence 24/7 · numéro » + identifiant. Un code par bassin si le site en a plusieurs. Réutiliser la bibliothèque qrcodejs déjà intégrée (Outils › étiquettes).

### 6.9 Portail client
- **Vérification (4a-2)** : « Connexion sécurisée », « Installation reconnue » + nom, « Nous avons envoyé un code à j•••••@domaine », 6 cases de code, « Se souvenir de cet appareil 90 jours », « Accéder », renvoyer / autre canal, aide « Demandez l'accès à votre gestionnaire ». Étape précédente (non dessinée) : saisie du courriel ou cellulaire. Réponse identique que le contact soit autorisé ou non (ne rien révéler).
- **Accueil mobile (4a-3)** : contact + niveau, nom du site, dernière visite ; encadré `accent-100` « N interventions en cours » rédigé en langage client ; 6 systèmes (libellés client : Intervention / À votre attention / À surveiller / Conforme) ; encadré « À votre attention » (ce qui dépend du client) ; boutons « Rapport de la visite d'aujourd'hui », « Relevés et historique » ; pied : appeler le technicien, urgence 24/7.
- **Relevés (4a-4)** : onglets Relevés / Rapports / Interventions ; « 94 % dans la norme » 30 j ; valeurs du jour ; graphique 30 j avec bande de zone ; Registre RQEP mensuel (PDF) ; export Excel 12 mois.
- **Ordinateur, niveau Gestionnaire (5a-3)** : en-tête **logo du client** 150 × 52 + « Mes installations (N) ▾ » + nom du site, contact + niveau, signature « Entretenu par Soucy Aquatik ». Bandeau intervention, plan 220 px avec bassins, onglets Historique · Rapports · Plans et documents · Interventions · Factures (grisé + « niveau Direction » si non autorisé), Excel. Colonne droite « Vos bassins » + rapport du jour + contacts.
- **Mobile, niveau Opérateur (5a-4)** : logo, badge « Nom · Opérateur », liste des bassins avec état, registre RQEP, plan d'ensemble ; encadré pointillé « Historique, rapports et exports : accès Gestionnaire · Demander l'accès ».

## 7. Modèle de données (Supabase, **additif seulement**)

Respecter la règle du dépôt : ajouter des tables/colonnes, ne jamais en retirer. Noms indicatifs, à adapter à l'existant (vérifier d'abord ce qui existe pour les bassins de la fiche Sites et la colonne `releves.bassin`).

| Table | Colonnes clés | Notes |
|---|---|---|
| `bassins` (ou existante) | `id`, `site_id`, `numero`, `nom`, `type_code`, `volume_m3`, `freq_rqep`, `saisonnier`, `plan_id`, `plan_x`, `plan_y` (0–100 %) | relier `releves.bassin` / `water_logs` à `bassins.id` |
| `inspection_systemes` | `code` (`eau`,`dosage`,`circulation`,`chauffage`,`securite`,`structure`), `nom`, `icone`, `ordre` | catalogue fixe |
| `inspection_points` | `id`, `systeme_code`, `type_code` (ou `site_id`/`bassin_id` pour surcharge), `libelle`, `mode` (`etat` / `ouinon` / `mesure`), `unite`, `obligatoire`, `actions_correctives` jsonb, `ordre`, `actif` | l'eau reste définie par `types_bassin` (paramètres + zones) |
| `visites` | `id`, `site_id`, `bassin_id`, `debut`, `fin`, `technicien_id`, `source` (`terrain`/`bureau`), `saisi_par`, `statut` (`brouillon`/`publiee`), `resume_auto`, `signature`, `publiee_le`, `updated_at` | une visite peut regrouper plusieurs bassins (une ligne par bassin, même `groupe_id`) |
| `visite_points` | `visite_id`, `point_id` ou `parametre`, `valeur`, `etat` (`ok`/`watch`/`action`/`na`), `note`, `action_corrective`, `wo_id` | les relevés d'eau peuvent rester dans `releves` avec `visite_id` ajouté |
| `visite_photos` | `visite_id`, `point_id`, `storage_path`, `legende` | bucket Storage privé |
| `visite_produits` | `visite_id`, `produit_id` (stock), `quantite`, `unite` | peut décrémenter le stock (option) |
| `documents` | `id`, `portee` (`client`/`site`/`bassin`), `client_id`, `site_id`, `bassin_id`, `titre`, `type` (`plan`/`contrat`/`fiche`/`autre`), `niveau_plan` (ex. « Salle mécanique »), `storage_path`, `mime`, `taille`, `visibilite` (`interne`/`operateur`/`gestionnaire`/`direction`) | bucket privé, URL signées courtes |
| `clients` (colonnes) | `logo_path` | logo par client ; `sites.logo_path` en surcharge optionnelle |
| `client_niveaux` | `client_id`, `niveau`, droits jsonb (`etat`, `releves`, `rqep`, `plans`, `historique`, `rapports`, `interventions`, `exports`, `factures`) | défauts : voir grille 5a-2 |
| `client_contacts` | `id`, `client_id`, `nom`, `courriel`, `cellulaire`, `niveau`, `sites` (null = tous), `actif` | |
| `client_qr` | `id`, `site_id`, `bassin_id`, `jeton` (≥ 128 bits aléatoire), `code_affiche`, `actif`, `cree_le`, `revoque_le` | |
| `client_otp` / `client_sessions` | code haché, expiration 10 min, tentatives ; session : `contact_id`, `appareil_hash`, `expire_le` (90 j si « se souvenir ») | **jamais lisibles par anon** |
| `client_acces_journal` | `quand`, `contact_id` ou identifiant saisi, `qr_id`, `resultat` (`ok`/`refuse`/`otp_echoue`), `ip_hash`, `user_agent` | |

## 8. Règles de calcul

- **État d'un paramètre d'eau** : hors `[lo, hi]` de `types_bassin` → `action` ; dans les 10 % du bord de la zone → `watch` (seuil à confirmer).
- **État d'un système** = pire état de ses points (`action` > `watch` > `ok` > `na`).
- **Score de gravité d'un site** (tri des listes) : Σ points `action` × 10 + Σ `watch` × 3, sur la dernière visite publiée de chaque bassin ; égalité → plus ancienne visite d'abord.
- **4 pastilles de site** : eau = système `eau` ; mécanique = pire de `dosage`/`circulation`/`chauffage` ; sécurité = `securite` ; structure = `structure`.
- **Étiquettes** : « Nouveau » si l'état précédent du point était `ok` ; « Depuis le <date> » / « Depuis N visites » sinon.
- **Résumé automatique** : « **N actions requises :** <libellé point> <valeur> (…). **À surveiller :** <liste>. <Systèmes conformes> sont conformes. » — version client : « Intervention en cours » + vocabulaire simple, sans codes internes.
- **Verdict 2a** : « N actions requises, N points à surveiller, N points conformes. »

## 9. Sécurité du portail client — exigences

Le dépôt utilise aujourd'hui la clé publique anon avec des politiques RLS ouvertes (§5 de la passation existante). **Le portail client ne doit pas suivre ce modèle.**

1. Le jeton QR **identifie** un bassin/site ; il n'ouvre aucune donnée. Jeton aléatoire ≥ 128 bits, régénérable, révocable.
2. Accès uniquement après **code à usage unique** (6 chiffres, 10 min, 5 tentatives max, limitation par IP et par contact) envoyé au courriel ou cellulaire inscrit dans `client_contacts`. Réponse identique si l'identifiant n'est pas autorisé.
3. Toute lecture passe par une **Edge Function Supabase** (ou des fonctions `security definer`) qui vérifie la session et filtre par `client_id`, sites autorisés et **niveau d'accès**. Aucune table du portail lisible directement par anon.
4. Fichiers (plans, photos, PDF) en bucket **privé**, servis par URL signées de courte durée, après vérification de `documents.visibilite`.
5. Session : cookie `HttpOnly; Secure; SameSite=Strict`, 90 jours si « se souvenir de cet appareil », sinon session courte. Révocable depuis sa-admin.
6. **Lecture seule**. Journaliser chaque accès et chaque refus (`client_acces_journal`).
7. CSP stricte comme `/qr-carnet/*` dans `_headers` ; `noindex`.
8. Envoi des codes : courriel (Resend, Postmark… via Edge Function) et SMS (Twilio…) — **fournisseur à choisir** ; aucun envoi automatique n'existe aujourd'hui (seulement `mailto:`).

### Articulation avec le Carnet de bord QR existant (`qr-carnet/?site=ID_SITE`)
Le carnet actuel sert aux relevés **techniciens** (anon insert dans `water_logs`) avec l'ID de site en clair. **Décision à faire valider par l'utilisateur** : recommandation = une seule affiche par bassin, URL `/q/<jeton>` ; la page propose « Je suis technicien » (carnet existant) ou « Accès client » (portail). Ne plus exposer `sites.id` en clair dans les nouvelles affiches. Les relevés `water_logs` doivent apparaître dans l'historique (fusion avec `releves`).

## 10. Interactions et comportements

- Toutes les écritures sa-admin reprennent la **concurrence optimiste** existante (`updated_at`, relire avant d'écrire).
- sa-terrain : brouillon de visite enregistré localement à chaque champ ; reprise si l'app se ferme ; envoi en file hors réseau ; la visite n'est `publiee` qu'après « Valider et envoyer ».
- « Créer un bon de travail » depuis un point → WO lié (`visite_points.wo_id`), visible dans « À faire » et dans « Interventions » du portail (texte client).
- « Envoyer au client » : publie le rapport sur le portail + avise les contacts cochés (courriel ; `mailto:` en attendant un envoi serveur).
- « Voir comme le client » : ouvre le portail en mode aperçu (bandeau « Aperçu · niveau X », sélecteur de niveau), sans journaliser d'accès client.
- PDF : impression navigateur du rapport 2b (feuille de style d'impression), comme les autres impressions de sa-admin.
- Plan : chargement image/PDF → affichage `object-fit: contain` ; placement des bassins par glisser-déposer, positions en %.
- États de chargement et d'erreur : réutiliser le bandeau d'erreur `soft()` de sa-admin ; écran portail « Lien désactivé » si jeton révoqué.

## 11. Ordre de réalisation proposé

1. **Données** : migrations additives (§7) + `tests/schema.json` + RLS. Catalogue des points par type de bassin — **à faire valider par l'utilisateur** (les points des maquettes sont des exemples).
2. **sa-terrain** : flux 3a.
3. **sa-admin lecture** : 2a, 2b, 1a (tendances) ; liste des sites triée par gravité.
4. **sa-admin saisie bureau** (5a-2) + journalisation.
5. **Bassins, plans, documents** (5a-1) + Storage privé.
6. **Portail client** : Edge Function d'authentification, app portail (4a-2/3/4, 5a-3/4), logo client, niveaux d'accès, Accès client et QR (4a-5), affiche (4a-1).
7. **Envoi au client** (courriel serveur) et décision carnet QR.
8. Optionnel : schéma de l'installation (2c).

À chaque étape : `node --check`, `npm test`, puis **vérification sur `https://sa-platform.pages.dev`**, pas seulement en local.

## 12. Jetons de design

Utiliser les variables de `ds/styles.css` (identiques au design system Industry fourni dans `_ds/`) :
- Fond `--color-bg` (#f2f2f3), texte `--color-text` (#1d1f20), accent `--color-accent` (#5980a6) et sa rampe `--color-accent-100…900`, neutres `--color-neutral-200/400/500/700`, séparateurs `--color-divider`.
- Polices `--font-heading` (Barlow Condensed) / `--font-body` (Barlow).
- Ombres `--shadow-md`, `--shadow-lg` (cadres d'écran uniquement).
- Coins carrés. Icônes Lucide trait 1,5 (`sa-icons.js` ; icônes utilisées : droplet, flask, cycle, thermo, alert, building, package, wrench, file, chart, send, eye, users, plus, minus, check, camera, phone, pin, download, search, left, right, down, x, folder).
- Allègement demandé par l'utilisateur : **pas de marques d'angle « + »** sur les nouveaux écrans (tours 2 à 5), bordures en `--color-divider`. Touches de couleur : barre latérale `accent-100`, en-tête souligné `accent-500`, sélection/onglets `accent-700`, cartes « À surveiller » `accent-100`, « Action » `accent-900`.

## 13. Fichiers du dossier

- `Inspections Mockups.dc.html` — toutes les maquettes (tours 1 à 5, le plus récent en haut).
- `support.js` — moteur d'affichage des maquettes (pas à porter).
- `image-slot.js` — zones de dépôt d'image des maquettes (logo, plans).
- `src/design/sa-data.js`, `src/design/sa-icons.js` — données de démo et icônes (copies du dépôt).
- `_ds/industry-…/styles.css`, `_ds_bundle.js` — design system.

## 14. Questions ouvertes à poser à l'utilisateur

1. Liste réelle des points de contrôle par type de bassin et par système.
2. Qui gère les contacts autorisés : Soucy seulement, ou aussi le gestionnaire du client ?
3. Fournisseur courriel / SMS pour les codes et les avis.
4. Une affiche unique technicien + client, ou deux affiches ?
5. Seuil « À surveiller » pour l'eau (10 % du bord de zone ?).
6. Les produits ajoutés décrémentent-ils le stock ?
