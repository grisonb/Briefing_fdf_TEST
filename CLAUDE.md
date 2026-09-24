# BFG — Briefing Fdf TEST — Guide de contexte pour Claude Code

## Qu'est-ce que ce projet

BFG (Briefing Fdf) est une PWA opérationnelle de préparation de briefing feux de
forêt, utilisée sur iPad/Safari, qui doit rester utilisable **hors ligne** (NOTAM,
METAR/TAF, feuille de service, GAAR, cartes des risques, SUP AIP, TEMSI).
Ce dépôt est la **version TEST** ; la version pérenne vit dans le dépôt séparé
`Briefing-fdf`.

**C'est un outil opérationnel, pas un projet expérimental.** Beaucoup de
comportements ont été calés après des dizaines d'essais réels sur iPad (latences,
particularités Safari/iPadOS, isolement des stockages entre PWA installées,
réseau dégradé). Un changement qui « semble » être une amélioration peut casser un
comportement validé sur le terrain.

## ⚠️ RÈGLES PRIORITAIRES — à lire avant toute action

Ces règles sont rédigées par l'utilisateur, en tête de `MODIFICATIONS_BFG_TEST`,
section **« 0. RÈGLES DU CHAT / CONTRAT DE TRAVAIL »**. **Elles priment sur tout
le reste de ce document.** Toujours relire cette section dans le fichier réel
avant de commencer une session — elle peut évoluer. Résumé de l'essentiel :

1. **Aucun code sans demande explicite.** Une question, un DIAG ou une demande
   d'analyse n'autorisent pas à modifier le code.
2. **Toujours partir des fichiers réels** du dossier `Briefing_fdf_TEST/` —
   jamais reconstruire de mémoire ni depuis un extrait.
3. **Périmètre strict**, aucune refactorisation opportuniste, priorité au
   fonctionnement hors ligne.
4. **Une version par livraison poussée** : tout push sur GitHub reçoit un
   nouveau numéro (`index.html`, `sw.js`, `manifest.json` + entrée de journal),
   même pour une petite correction. Les itérations non poussées ne changent pas
   de numéro.
5. **Livraison = 4 fichiers complets**, dans l'ordre `1_Modifications` →
   `2_Index` → `3_Manifest` → `4_Sw`, jamais de patchs. Un 5e fichier NAS/VPS
   seulement sur demande.
6. **`MODIFICATIONS_BFG_TEST` est cumulatif, jamais tronqué**, avec statuts
   (`NON IMPLÉMENTÉ`, `À MESURER`, `À DÉCIDER`, `ABANDONNÉ`, `À REVOIR`,
   `VALIDÉ`).
7. **Backend NAS/VPS non versionné ici : ne jamais supposer** ce qu'il fait ou
   renvoie.
8. **Points sensibles** (détaillés en section 0.B) : routage du Service Worker et
   caches partagés entre les trois applications, persistance NOTAM, surligneur
   Apple Pencil, deltas TEST/pérenne.
9. **Git : jamais de commit ni de push sans demande explicite, à chaque fois.**
   Voir la section « Règles permanentes » ci-dessous : aucun `git push` sans
   accord écrit, aucun travail dans les dépôts pérennes.

## 🚫 RÈGLES PERMANENTES — sans exception, sans expiration

Ces règles ne se périment pas et ne se déduisent jamais du contexte. Une
autorisation donnée une fois ne vaut jamais pour la suivante.

### 1. Aucun `git push` sans accord écrit dans le chat

Avant **chaque** `git push`, sans exception :

1. afficher le **dépôt distant** (`git remote get-url origin`) et la **branche**
   (`git branch --show-current` et son upstream) ;
2. **attendre un « OK » écrit de l'utilisateur dans le chat** ;
3. seulement alors, pousser — et jamais en `--force`.

Ne jamais considérer comme un accord de pousser : une demande de commit, un
« vas-y » portant sur le code, un feu vert donné à un plan, une urgence
invoquée, ou une autorisation obtenue plus tôt dans la même conversation.
Commiter n'autorise pas à pousser. Dans le doute, s'arrêter et demander.

### 2. Ne jamais travailler dans les dépôts pérennes

`Briefing-fdf` et `NPF-Q400` sont les **versions pérennes, en usage
opérationnel**. Aucune écriture : pas de modification de fichier, pas de
commit, pas de push, pas de branche, pas de `git` qui modifie l'état.

Le seul travail autorisé se fait dans `Briefing_fdf_TEST/`. La **lecture** de
ces dépôts reste permise pour comparer ou analyser — c'est ainsi que sont
relevés les écarts TEST/pérenne de la section 0.B4 du journal. Toute promotion
vers la pérenne est une opération manuelle de l'utilisateur, jamais de Claude
Code.

### 3. Toujours écrire « NPF-Q400 », jamais « NPF » seul

Dans **tous les textes affichés** par BFG (alertes, bandeaux, boutons, aides,
messages d'erreur), l'application sœur s'appelle toujours « NPF-Q400 ». Jamais
« NPF » seul. Les identifiants internes jamais affichés (`BFG_NPF_*`,
`npf-docs-api.php`, clés `bfgNpf*`) ne sont pas concernés et ne doivent pas être
renommés pour autant (cf. persistance NOTAM). Relevé v5.20 : aucun texte affiché
de BFG TEST n'enfreignait la règle.

## ⚠️ Ce projet n'est PAS NPF-Q400

Ne pas transposer les réflexes de l'autre dépôt. Ici :
- **3 fichiers de code, pas 7** ;
- **pas de `sia.js`, pas de `script.js`, pas de `style.css`** : tout est inline
  dans `index.html` ;
- **pas d'ordre de chargement de scripts locaux** à préserver ; les
  bibliothèques (pdf.js, jsPDF, Leaflet) viennent de CDN externes et ne sont
  pas mises en cache par le Service Worker ;
- pas de moteur de tuiles cartographiques offline.

## Structure des fichiers

| Fichier livré | Fichier réel | Rôle |
|---|---|---|
| `1_Modifications_vX.XX.txt` | `MODIFICATIONS_BFG_TEST` | Règles (section 0) + historique cumulatif |
| `2_Index_vX.XX.txt` | `index.html` | **~14 450 lignes / ~706 Ko.** Application entière : CSS, HTML et JS inline |
| `3_Manifest_vX.XX.txt` | `manifest.json` | Manifest PWA (31 lignes) |
| `4_Sw_vX.XX.txt` | `sw.js` | Service Worker (~306 lignes) : routage, caches, migration |

Également présents et non livrés sous forme de `.txt` : `icons/` et
`tdf2026/` (21 photos d'étapes + 6 SUP AIP PDF, tous préchargés par le Service
Worker à l'installation).

## ⚠️ Ne jamais charger `index.html` en entier « par réflexe »

706 Ko. Avant de le lire : identifier la zone concernée, chercher la
fonction ou le bloc exact, ne lire que cette zone et son contexte immédiat.
Ne proposer une lecture intégrale que si c'est explicitement demandé.

### Carte des grandes zones d'`index.html` (repères v5.15 — les lignes bougent à chaque version, à revérifier)

- `L.7–13` — micro-script `<head>` : `history.scrollRestoration = 'manual'`
- `L.30–2410` — CSS inline (dont les styles du surligneur et du verrou de
  défilement Pencil, ~L.815–860)
- `L.2412–2872` — HTML (panneaux NOTAM, météo, PDF, association NPF-Q400,
  diagnostic)
- `L.2873–14450` — JS principal :
  - `~L.2874` — `APP_VERSION_NUMBER` / `APP_VERSION`
  - `~L.2886–3180` — diagnostic BFG → NAS → worker VPS → SDVFR, export texte
  - `~L.3567–3700` — constantes d'API NAS, noms de caches et de bases NOTAM
  - `~L.3690–3990` — persistance et restauration SDVFR (IndexedDB
    `BriefingFdfSdvfrNotamsV1`)
  - `~L.4252–4460` — pont d'autorisation BFG → NPF-Q400 via le NAS
  - `~L.5470–5870` — génération NOTAM NATS via le service VPS (délai de prise en
    charge 90 s)
  - `~L.6799–6875` — Service Worker côté page : `BFG_REQUIRED_SW_VERSION_`,
    `ensureBfgServiceWorker_()`
  - `~L.7870–8210` — carte des risques (statut, génération, affichage)
  - `~L.9139–9350` — TEMSI ; `~L.9352–9460` — annotations PDF
  - `~L.10777–10880` — SUP AIP persistants (`bfgSupAipPersistentDB`)
  - `~L.10967–11620` — session et partage (`briefingSessionDB`,
    `window.performBfgLocalSave_`)
  - `~L.12643–12800` — **état persistant NOTAM, `clearMarkers`, partage NPF** —
    zone sensible
  - `~L.12880–13010` — `persistCurrentNotamState_()` et restauration de la
    sélection
  - `~L.13240–13700` — **surligneur : clic, Apple Pencil, verrouillage de ligne,
    verrou de défilement** — zone sensible
  - `~L.13980–14020` — cache carte SUP AIP et espaces temporaires SDVFR

## Workflow réel du projet

- Tous les essais se font sur la **version TEST** (`vX.XX`, ex. `v5.15`), dépôt
  `Briefing_fdf_TEST`.
- Une fois validée en usage réel, une version est promue en **version pérenne**
  (numérotation séparée `v2026.NN`, ex. `v2026.27`), dépôt `Briefing-fdf`, dont
  le journal s'appelle `CHANGELOG_BFG.txt`.
- **La promotion ne se fait jamais par copie intégrale d'`index.html`** : la
  section 0.B4 du journal liste les écarts TEST/pérenne à reprendre un par un.
  Au moment de la rédaction de ce document : 12 écarts dans `index.html`,
  3 lignes dans `manifest.json`, 3 lignes dans `sw.js`.
- La livraison reste manuelle : l'utilisateur copie-colle les fichiers `.txt`
  dans le dépôt GitHub. Claude Code ne commite et ne pousse que sur demande
  explicite, à chaque fois.

## Backend NAS / VPS — hors dépôt

Aucun code serveur n'est versionné ici. BFG dépend de :
- le NAS `grisonb.synology.me` : une vingtaine de points d'entrée
  `/briefing-api/*.php` et les dépôts `/briefing-data/{risk-maps,gaar,
  feuille-service,temsi}/` ;
- des workers VPS (`bfg-notams-worker`, `bfg-sdvfr-worker`) atteints via le NAS ;
- un Apps Script Google pour le rafraîchissement Gmail de la feuille de service ;
- `aviation.meteo.fr` pour les images TEMSI.

**Ne jamais affirmer ce que ces services font, attendent ou renvoient sans
vérification** (réponse réelle, DIAG, ou fichier fourni par l'utilisateur). En
cas de doute : le dire et demander.

## Ce qu'il ne faut PAS faire sans demande explicite

- Refactoriser, renommer ou réorganiser « pour la propreté du code ».
- Toucher à l'ordre des règles du listener `fetch` de `sw.js`, en particulier
  l'exclusion METAR/TAF et SUP AIP qui doit rester en tête.
- Élargir le filtre de purge d'`activate` au-delà de `'briefing-fdf-test-'` :
  les trois applications partagent la même origine `grisonb.github.io`, et une
  purge trop large effacerait les données de la version pérenne et de NPF-Q400
  sur l'iPad de l'utilisateur.
- Renommer ou supprimer un cache, une base IndexedDB ou une clé localStorage de
  la chaîne de persistance NOTAM, ou casser la compatibilité avec les snapshots
  déjà présents sur les appareils.
- Retoucher les seuils du surligneur Apple Pencil (280 ms, 9 px, 7 px, 4 px,
  1 200 ms, 700 ms, marges 14/10 px, tolérance de ligne) : ils sont calés sur
  des essais réels.
- « Aligner » les constantes figées à `5.07` (`BFG_REQUIRED_SW_VERSION_`,
  `./sw.js?v=5.07`, `./manifest.json?v=5.07`) : l'écart avec `BFG_SW_VERSION`
  est un fait constaté dont l'origine — choix volontaire ou oubli — n'est pas
  connue, et le corriger changerait un comportement réel au démarrage. Le
  signaler, ne pas le trancher (cf. section 0.B1 du journal).
- Réintroduire une piste marquée `ABANDONNÉ` sans nouvel élément.
- Incrémenter la version à chaque échange au lieu de garder la version TEST
  stable.
- Travailler hors du dossier `Briefing_fdf_TEST/` — et **jamais d'écriture**
  dans `Briefing-fdf` ni `NPF-Q400` (cf. règles permanentes).
- Pousser sans avoir montré dépôt et branche et obtenu un « OK » écrit
  (cf. règles permanentes).

## Environnement de test

Pas de suite de tests automatisés, pas d'étape de build. Validation manuelle sur
iPad et en usage réel, consignée dans `MODIFICATIONS_BFG_TEST`. Ne pas supposer
l'existence de tests automatisés.
