# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

## [2.5.2] - 2026-01-02

### Optimisations stockage IndexedDB

- Compression automatique LZ-string (>100 clés) avec décompression transparente
- Batch save/load parallélisés (+ helpers `batchSaveAllData` / `batchLoadAllData`)
- Statistiques de quota via `navigator.storage.estimate()` et nettoyage localStorage optionnel
- CDN LZ-string ajouté (fallback si non disponible)

## [2.5.1] - 2026-01-01

### Migration progressive vers storageManager

- Remplacement des accès direct localStorage par `storageManager` (config, sync log, data)
- Fonctions critiques passées en async (load/save config, sync log, save/load Drive, delete/convert)
- Tests localhost documentés et validés

## [2.5.0] - 2026-01-01

### Infrastructure IndexedDB

- Ajout de `storageManager` (init, get/set/remove/clear/keys) avec localforage
- Dual-write IndexedDB + localStorage, flag `mti_indexeddb_migrated`
- Wrappers de compatibilité (save/load invoices/quotes/rams/clients)

## [2.4.3] - 2025-12-31

### Améliorations UX : Indicateur de sync et contrôle auto-sync

**Visibilité et contrôle de la synchronisation automatique**
- Indicateur visuel de sync dans le header : affiche l'état de synchronisation (🔄 Sync..., ⚠️ Sync error, ✅ Sync HH:MM)
- Bouton toggle pour activer/désactiver l'auto-sync avec état persistant (localStorage)
- Icône du bouton change selon l'état (▶️ enabled, ⏸️ disabled)
- Tooltip dynamique affichant la dernière synchronisation et statistiques
- Animations CSS : rotation continue lors de la sync, pulse sur erreur
- Toast amélioré : affiche le nombre d'items synchronisés et le timestamp

**Tracking des statistiques de sync**
- Nouvel objet `syncStats` : lastSyncTime, itemsSynced, errorCount, lastError
- Mise à jour automatique lors de chaque synchronisation
- Affichage des stats dans le tooltip de l'indicateur

**Stockage persistant**
- Préférence utilisateur (auto-sync enabled/disabled) sauvegardée en localStorage
- Restauration automatique au chargement de la page avec fallback `true`

**Fichiers impactés**
- app.js : nouv. fonctions `updateSyncIndicator()`, `toggleAutoSync()`, `loadAutoSyncPreference()`; amélioration `syncSheetsNow()` avec stats et toasts enrichis
- index.html : ajout du span `#syncIndicator` et button `#toggleAutoSyncBtn` dans le header; styles CSS pour animations et états
- CSS : nouvelles animations (`spin`, `pulse-error`) et classes (`.sync-indicator`, `.btn-auto-sync`)

## [2.4.2] - 2025-12-31

### Automatisation sync Sheets + nettoyage

- Frontend : synchronisation automatique (délaisée 2s) des factures, devis, RAM et tiers vers Google Sheets après chaque sauvegarde Drive ; file d’attente pour éviter les overlaps et rejoue si une sync était en cours.
- Imports Sheets (factures, devis, RAM, tiers) neutralisent l’auto-sync (`suppressSheetsSync`, `skipSheetsSync`) pour éviter les boucles et ne relancent la sync qu’après l’opération.
- Backend : exports tolèrent les tableaux vides (factures, devis, RAM, tiers) pour permettre de vider les onglets ; nouvelles actions `clearInvoiceSheet`, `clearQuoteSheet`, `clearClientSheet` et nettoyage RAM plus verbeux.
- UI : boutons « 🗑️ Nettoyer Sheets » ajoutés sur Factures, Devis et Tiers ; toasts affichent le nombre de lignes supprimées.
- Sauvegarde locale renforcée après `saveToDrive` (backup invoices/quotes/rams dans localStorage) pour cohérence en cas de purge côté Sheets.

**Fichiers impactés**
- app.js : auto-sync, sauvegarde locale post-Drive, suppression des boucles lors des imports.
- backend/AppScript.js : exports tolérant le vide, nouveaux endpoints de nettoyage Sheets.
- index.html : boutons Nettoyer Sheets (Factures, Devis, Tiers).

### Améliorée : Disposition 2 lignes pour actions (Factures & Devis)

**Refonte UX des colonnes actions**
- Remplacement des menus déroulants par disposition 2-lignes optimisée
  - **Ligne 1** (toujours visible) : Actions principales avec icônes compactes + bouton toggle (⋯)
    - Factures : ✏️ Modifier, 📥 Télécharger, 📧 Envoyer, 🔔 Relancer, ⋯
    - Devis : ✏️ Modifier, 📥 Télécharger, 📧 Envoyer, 🔄 Convertir, ⋯
  - **Ligne 2** (masquée par défaut) : Actions secondaires et statuts
    - Factures : 📊 RAM, 📧+📊 Facture+RAM, 🗑️ Supprimer, + 4 statuts
    - Devis : 🗑️ Supprimer, + 4 statuts
- Clic sur ⋯ bascule la visibilité de Ligne 2
- Élimine le besoin de scroller la table pour accéder aux actions
- Gain d'espace et meilleure lisibilité des données principales

**JavaScript & CSS**
- Nouvelles fonctions : `toggleInvoiceSecondaryActions()`, `toggleQuoteSecondaryActions()`
- Nouvelles classes CSS : `.invoice-secondary-actions`, `.quote-secondary-actions`
- Flexbox layout avec gap et flex-wrap pour adaptabilité responsive
- Suppression des styles de dropdown déroulant (absolus, shadows complexes)

**Utiliser/UX**
- Tableau plus compact et lisible par défaut
- Actions secondaires accessibles au clic sans refonte majeure
- Pattern cohérent entre factures et devis
- Émojis intuitifs pour identification rapide des actions

### Améliorée : Menus déroulants compacts pour actions (Factures & Devis)

**Redesign tables d'actions**
- Remplacement des listes de boutons inline par menus déroulants à 3 sections
  - **ÉDITION** : Modifier, Télécharger PDF, Envoyer (email ou Drive)
  - **GESTION** : Générer RAM/Convertir, Relancer, Supprimer
  - **STATUT RAPIDE** : Buttons 4 statuts avec changement au clic sur badge
- Bouton compact "⋮ Actions" réduit l'espace des colonnes Action
- Corrige le problème d'encapsulation du texte des colonnes N° et Montant sur 2-3 lignes

**Interaction statuts**
- Badge de statut maintenant cliquable : double clic pour passer au statut suivant
- Cycle automatique des statuts par catégorie (Facture: Brouillon→Envoyée→Payée→Annulée)
- Feedback visuel : cursor pointer sur badge, tooltip explicatif

**Application globale**
- Pattern appliqué à FACTURES et DEVIS (2 tables principales)
- Clients (2 buttons) et RAMs (4 buttons) : inchangés (déjà compacts)
- Menus déroulants ferment au clic en dehors (event delegation)
- Seul un menu ouvert à la fois (fermeture des autres)

**CSS intégré**
- Styles intégrés dans `<style>` (`.actions-dropdown`, `.actions-menu`, `.actions-menu.show`)
- Animations hover subtiles (background-color 0.15s)
- Ombre douce, arrondi 4px, min-width 200px pour lisibilité

### Améliorée : Visibilité et UX du contrôle des relances automatiques

**Interface utilisateur**
- Indicateur visuel 🔕 dans les listes des clients et factures quand les relances sont désactivées
- Checkbox "Désactiver les relances automatiques" repositionnée en haut des formulaires avec surbrillance orange
- Message d'avertissement héréditaire : affichage automatique si un client a les relances désactivées lors de l'édition de ses factures
- Explication claire de la hiérarchie : client prime sur facture

**Synchronisation Google Sheets**
- Export/Import des clients : nouvelle colonne "Désactiver Relances" (OUI/NON)
- Export/Import des factures : nouvelle colonne "Désactiver Relances" (OUI/NON)
- Permet de gérer les relances en masse via Google Sheets
- Format lisible : "OUI" pour actif, "NON" pour inactif

**Persistance des données**
- Correction du bug de persistence du flag `noAutoRelance` sur les factures après actualisation
- Le flag est maintenant chargé correctement lors de l'édition

## [2.4.0] - 2025-12-29

### Nouvelle fonctionnalité : Système de relances automatiques pour factures impayées

**Système à 3 niveaux d'escalade**
- **Niveau 1 (J+7)** : Rappel aimable - ton professionnel courtois
- **Niveau 2 (J+15)** : Relance ferme - mention des pénalités de retard  
- **Niveau 3 (J+30)** : Mise en demeure - référence légale (Code de commerce L.441-6)

**Filtrage dual-level**
- Désactivation par **CLIENT** : `noAutoRelance` checkbox dans formulaire client
- Désactivation par **FACTURE** : `noAutoRelance` checkbox dans formulaire facture
- Logique AND : relance envoyée uniquement si AUCUN des deux flags n'est activé

**Fonctionnalités automatiques**
- Trigger Apps Script : exécution quotidienne à 8h
- Vérification automatique de toutes les factures impayées
- Historique complet : dates, niveaux, état (envoyée/brouillon), type (auto/manuel)
- Pièce jointe PDF automatique avec chaque relance

**Relances manuelles**
- Bouton **🔔 Relancer** dans la liste des factures
- Sélection du niveau de relance (1, 2 ou 3)
- Sélecteur de niveau via prompt utilisateur
- Enregistrement immédiat dans l'historique

**Email avec templates dynamiques**
- 18 placeholders dynamiques : {invoiceNumber}, {clientName}, {dueDate}, {daysLate}, {amount}, etc.
- Personnalisation complète : en-têtes, corps, signature
- Pièce jointe PDF : nom normalisé, récupération automatique depuis Drive
- Fallback Gmail compose si backend indisponible

**Interface utilisateur**
- Historique des relances dans le modal de visualisation facture
- Code couleur par niveau : 🟢 niveau 1, 🟠 niveau 2, 🔴 niveau 3
- Affichage pour chaque relance : date, niveau, jours de retard, statut (envoyée/brouillon), type (auto/manuel)
- Toast notifications pour feedback utilisateur

**Configuration et déploiement**
- Guide complet : `docs/DEMARRAGE.md` - Section "Configuration des relances automatiques"
- Instructions pas-à-pas pour créer le trigger Apps Script
- Permissions Google requises : Gmail, Drive, Calendrier

**Fonctionnalité marketing**
- Améliore la trésorerie : relances automatiques = paiements plus rapides
- Conforme légalement : mise en demeure avec références légales
- Professionnalisme : automatis​ation évite les oublis

**Technique**
- Backend : `checkAndSendRelances()` pour vérification automatique
- Backend : `sendRelanceManual()` pour relances manuelles  
- Backend : `sendRelanceEmail()` avec gestion PDF et CORS
- Backend : `getInvoicePdfFromDrive()` pour retrieval des factures
- Backend : `RELANCE_TEMPLATES` avec 3 templates préconfigurés
- Frontend : `sendRelanceFromList()` avec fallback Gmail compose
- Frontend : Historique intégré dans `renderInvoicePreviewImpl()`
- Données : `invoice.relances[]` array avec structure : {date, level, daysLate, sent, manual}
- Données : `invoice.noAutoRelance` et `client.noAutoRelance` flags

**Fichiers impactés**
- `backend/AppScript.js` : +400 lignes (RELANCE_TEMPLATES, checkAndSendRelances, sendRelanceEmail, getInvoicePdfFromDrive, sendRelanceManual)
- `app.js` : +150 lignes (sendRelanceFromList, historique relances dans modal)
- `index.html` : checkboxes noAutoRelance pour clients et factures
- `docs/DEMARRAGE.md` : guide configuration trigger automatique

---

## [2.4.1] - 2025-12-30

### Corrections et robustesse relances (CORS/JSONP, alias Gmail, PDF Drive)

- Backend: retrait du champ `from` lors des envois Gmail pour éviter les erreurs d'alias; envoi se fait depuis le compte du script.
- Backend: action `sendRelance` exposée aussi via `doGet` (JSONP) pour contourner les préflights CORS en local.
- Backend: action `listFilesInFolder` exposée via `doPost` et `doGet` (JSONP) pour permettre au frontend de détecter les PDFs déjà présents.
- Backend: sélection de l'email destinataire fiabilisée (`client.email_facturation` → `client.email` → `invoice.clientEmail`).
- Frontend: `sendRelanceFromList()`
  - Vérifie si le PDF facture existe déjà dans Drive (`Factures/Facture_<ref>.pdf`) et évite une régénération si présent.
  - Sauvegarde le PDF en Drive si manquant, puis envoie la relance.
  - Fallback JSONP si le POST échoue (CORS), pour éviter l’ouverture du compose Gmail.
- Frontend: `sendInvoiceViaDrive()` aligné
  - Réutilisation du PDF existant en Drive si présent (listing Drive).
  - Sauvegarde conditionnelle si absent.
  - Fallback JSONP pour l'envoi d'email `sendEmailWithDriveFile` si le POST échoue.
- Maintenance: nettoyage des duplications dans `backend/AppScript.js` (doPost/doGet) et retour au comportement du 24/12 (réponses directes JSON/JSONP, sans en-têtes CORS).
- Tests: ajout d’un fichier de tests Apps Script `backend/tests_relances.gs` pour valider relances auto et manuelles sans CORS.

### Fichiers impactés

- `backend/AppScript.js` : doGet JSONP `sendRelance`, exposition `listFilesInFolder`, retrait `from` dans mails, sélection d’email de facturation.
- `app.js` : fallback JSONP pour relance, réutilisation PDF Drive si présent, sauvegarde conditionnelle.
- `backend/tests_relances.gs` : scénarios de test relances (création facture, relances auto/manuelles).

---

## [2.3.0] - 2025-12-29

### Nouvelle fonctionnalité : Export FEC (Fichier des Écritures Comptables)

**Conformité DGFIP pour contrôles fiscaux**
- Export FEC conforme article A.47 A-1 du Livre des Procédures Fiscales
- Format 18 colonnes séparé par pipe (|), validé par l'outil Test Compta Démat
- Nom de fichier normalisé : `SirenFECAAAAMMJJ.txt`

**Fonctionnalités**
- Génération automatique des écritures comptables depuis les factures
- Filtrage par exercice comptable (année)
- Écritures de vente (Journal VE) :
  - Créance client (compte 411xxx)
  - Produit de vente (compte 706000 - Prestations de services)
  - TVA collectée (compte 445710)
- Écritures d'encaissement (Journal BQ) pour factures payées :
  - Débit banque (compte 512000)
  - Crédit client avec lettrage automatique

**Workflow et validations**
- Seules les factures VALIDÉES sont incluses (statuts : En attente, Payée, Envoyée)
- Exclusion automatique des devis et factures brouillon
- Validation stricte des dates au format YYYYMMDD (8 chiffres)
- Montants avec 2 décimales et virgule (format français)
- Gestion robuste des données manquantes ou invalides

**Interface utilisateur**
- Bouton "📊 Exporter FEC" dans Paramètres > Divers
- Saisie de l'année d'exercice via prompt
- Téléchargement automatique du fichier TXT
- Feedback utilisateur : nombre de factures et lignes exportées

**Technique**
- Backend : fonction `generateFEC()` dans AppScript.js
- Frontend : fonction `exportFEC()` dans app.js
- Extraction SIREN depuis SIRET de l'entreprise
- Format date robuste : gestion ISO 8601, Date objects, validation
- Logs détaillés pour debug et audit

**Fichiers impactés**
- `backend/AppScript.js` : générateur FEC avec comptabilité BNC
- `app.js` : interface utilisateur et appel backend
- `index.html` : bouton export dans onglet Paramètres

---

## [2.2.3] - 2025-12-24

### Harmonisation Devis ↔ Factures, PDF et Statuts

- Prévisualisation unifiée via iframe `srcdoc` pour Devis et Factures (même builder HTML, mêmes marges/footer/couleurs)
- Noms de PDF nettoyés (suppression des redondances « Devis_DEVIS… », « Facture_FACTURE… »)
- Mentions légales remontées pour éviter tout chevauchement avec le footer
- Bouton « 📥 Télécharger » ajouté dans la liste des Factures (même logique que le générateur)
- Sauvegarde Drive: ouverture automatique de `previewUrl` (fallback `fileUrl`)
- Passage automatique au statut « Envoyée » après envoi via Drive
- Statistiques/KPIs « Suivi »: exclusion de « Annulée » des calculs et graphiques
- Compteur de CA rafraîchi après annulation/modification

### Palette statuts unifiée + vitrine debug

- Badges de statut harmonisés entre Devis et Factures (classes et couleurs alignées)
- Palette des graphiques alignée sur les badges (Brouillon → slate, Envoyée → blue, Payée → success, Retard → error)
- Vitrine visuelle des statuts (QA) ajoutée et masquée en production par défaut via `DEBUG_UI_BADGES: false`

### Devis: validations PDF strictes

- Blocage du téléchargement PDF d’un devis si données critiques manquantes (client/adresse, lignes non vides, total > 0, dates)
- Contrôles appliqués depuis la liste et depuis le formulaire (bouton « Télécharger PDF »)
### Factures: validations preview strictes

- Bouton "👁️ Aperçu" : validations bloquantes identiques aux devis (client, adresse, dates, lignes avec description/quantité/prix)
- Bouton "🔎 Prévisualiser et confirmer" : mêmes validations strictes avant envoi
- Remplacement de `alert()` par `showToast()` pour UX cohérente avec les devis
- Messages d'erreur explicites avec émoji ⚠️ par champ manquant
### Fichiers impactés

- app.js: prévisualisation facture/ devis unifiée, validations devis, bouton Télécharger facture, couleurs graphiques
- index.html: CSS des badges statuts, vitrine de statut (debug-only)
- config.production.js: ajout `DEBUG_UI_BADGES: false`

---

## [2.2.2] - 2024-12-16

### Corrections

#### PDF RAM - Refonte système de positionnement page 2 (V9)
- **Problème** : Chevauchement des remarques multi-lignes avec les visas et le footer
- **Cause** : 
  - Positionnement dynamique permettant aux remarques (max 48mm) d'empiéter sur les visas (Y=250mm)
  - Remarques commençant à Y=230mm pouvaient s'étendre jusqu'à 278mm
  - Collision avec visas (255mm) et footer (280mm)
- **Solution V9** : Système de positionnement fixe
  - **Remarques** : Y=20mm → Y=245mm (225mm disponibles, ~75 lignes)
  - **Gap sécurité** : 10mm
  - **Visas** : Y=255mm fixe (20mm hauteur, fin à 275mm)
  - **Gap sécurité** : 5mm
  - **Footer** : Y=280mm fixe (6mm hauteur, 17mm du bord)
- **Bénéfices** :
  - Capacité remarques augmentée de 4,7x (48mm → 225mm)
  - Séparation physique empêchant toute collision
  - Structure prédictible et maintenable
  - Footer toujours visible (marge sécurité 17mm PDF viewers)

**Fichiers modifiés** :
- `app.js` : Refonte generateRAMPDF() lignes 8840-8910
  - Constantes de positionnement fixe (footerY, sigY, remarksStartY, remarksMaxY)
  - Suppression logique positionnement dynamique
  - Calcul espace remarques avec limitation lignes

**Migration V8 → V9** :
```javascript
// V8 - Positionnement dynamique (causait overlap)
let remarksY = 230;
const sigY = remarks ? (remarksY + actualRemarksHeight + 5) : 250;

// V9 - Positionnement fixe (collision impossible)
const footerY = 280;           // Footer toujours à 280mm
const sigY = 255;              // Visas toujours à 255mm
const remarksStartY = 20;      // Remarques en haut page 2
const remarksMaxY = 245;       // Fin remarques 10mm avant visas
```

### Documentation

- Mise à jour CHANGELOG.md : Détails V9 système positionnement fixe
- Mise à jour docs/RAM_GUIDE.md : Section structure PDF page 2

---

## [2.2.1] - 2024-12-15

### Corrections

#### Persistance des devis
- **Problème** : Les devis n'étaient pas récupérés après actualisation de la page
- **Cause** : 
  - Le backend ne créait pas la propriété `quotes: []` dans `emptyData`
  - Pas de sauvegarde localStorage comme backup (contrairement aux RAMs)
- **Solution** :
  - Ajout de `quotes: []` dans `backend/AppScript.js` ligne 221
  - Sauvegarde automatique en localStorage après chaque opération sur les devis
  - Chargement localStorage dans `initApp()` comme fallback
  - Synchronisation localStorage après `loadFromDrive()` pour backup

**Fichiers modifiés** :
- `backend/AppScript.js` : Ajout `quotes: []` dans emptyData
- `app.js` : Sauvegarde localStorage après création, modification, suppression, changement statut, import Sheets

### Améliorations

#### Auto-actualisation date validité devis
- **Fonctionnalité** : La date de validité s'actualise automatiquement (+30 jours) quand la date d'émission du devis est modifiée
- **Comportement** : Identique aux factures (date échéance = date facture + 30 jours)
- **Implémentation** : Listener `change` sur `#quoteDate` dans `initQuoteForm()`

**Fichier modifié** :
- `app.js` : Ajout listener dans `initQuoteForm()` (ligne 9537)

### Documentation

- Mise à jour README.md : Version 2.2.1, notes de version
- Mise à jour CHANGELOG.md : Historique détaillé des modifications

---

## [2.2.0] - 2024-12-14

### Interface utilisateur

- Formatage français des montants avec séparateur de milliers (espace) et virgule décimale
- Fonction `formatNumber()` appliquée à 50+ emplacements
- Dropdown client intelligent avec auto-remplissage (SIRET, Adresse)

### Calculateur fiscal

- Interrogation séparée de l'API URSSAF pour plus de précision :
  - `dirigeant . auto-entrepreneur . cotisations et contributions . cotisations` (12,3%)
  - `dirigeant . auto-entrepreneur . cotisations et contributions . CFP` (0,2%)
- Suppression des calculs par soustraction
- Évolutivité automatique en cas de modification des taux légaux

### Documentation

- Professionnalisation de toute la documentation

---

## [2.1.4] - 2025-12-12

### ✨ Nouveaux Modules : Devis + Calculs Dynamiques API URSSAF

#### 🆕 Module Devis
**Fonctionnalités principales** :
- ✅ **Création devis** : Formulaire complet avec numérotation auto (`DEVIS-YYYY-NNN`)
- ✅ **Génération PDF** : Devis professionnels avec logo et branding (`generateQuotePDFBase64`)
- ✅ **Conversion devis → facture** : 1 clic pour créer facture depuis devis (`convertQuoteToInvoice`)
- ✅ **Liaison bidirectionnelle** : Champ `sourceQuoteNumber` sur factures + `linkedInvoiceNumber` sur devis
- ✅ **Statuts** : Brouillon, Envoyé, Accepté, Refusé
- ✅ **Intégration tiers** : Sélection client avec auto-remplissage SIRET + adresse
- ✅ **Synchronisation Drive** : Devis sauvegardés automatiquement
- ✅ **KPIs Dashboard** : Fonction `updateDevisKPIs()` appelée après modifications factures

**Fichiers** :
- `app.js` : Lignes 9653 (PDF), 10290 (conversion), 284 (variable `quotes`)
- `index.html` : Lignes 943-1030 (onglet Devis), 719-720 (navigation)

**UI** :
- Badge "Depuis devis XXX" sur factures (ligne 1103-1104, 3080)
- Badge cliquable dans liste factures (`openQuoteByNumber`)
- Mention dans PDF facture (ligne 6495)
- Indicateur mode édition (ligne 946-948)

**Documentation** :
- Création `docs/FEATURES_DEVIS_v2.1.4.md`

---

#### 🆕 Calculs Dynamiques API URSSAF (Nouveau Module)
**Fonctionnalités principales** :
- ✅ **API Mon-entreprise URSSAF** : Intégration complète pour calculs cotisations temps réel
- ✅ **Calculs dynamiques** : Cotisations URSSAF + CFP calculées via API (plus de taux en dur)
- ✅ **Gestion ACRE** : Exonération 1ère année (12 mois) automatique
- ✅ **Cache intelligent** : 5 minutes pour éviter appels répétés
- ✅ **Fallback robuste** : Valeurs locales si API indisponible (12,5% / 24,8%)
- ✅ **Taux officiels 2025** : 12,3% URSSAF + 0,2% CFP = 12,5% total (ACRE actif)

**Fonctions** :
- `calculateCotisationsDynamically()` ligne ~4190 : Appel API pour calcul exact
- `calculateCotisationsWithFallback()` ligne ~4275 : Wrapper avec cache + fallback
- `finalizeTaxCalculation()` ligne ~4307 : Finalisation calculs fiscaux

**Cache** :
- Variable `cotisationsCache` ligne ~3953
- TTL 5 minutes (300 000 ms)
- Clé composite : `${ca}_${hasACRE}_${creationDate}`

**Validation** :
- CA 7200 EUR/mois → 900 EUR/mois (12,5%) ✅
- CA 86 400 EUR/an → 10 800 EUR/an ✅
- Conforme déclaration URSSAF réelle (8 déc 2025)

---

#### 🐛 Corrections Bugs Production (Calculs Dynamiques)

**Bug #5 - Structure API incompatible** :
- **Problème** : Code attendait `data.evaluations` (ancien format objet), API retourne `data.evaluate` (nouveau format tableau)
- **Solution** : Gestion dual format avec fallback (`data?.evaluate || data?.evaluations || null`)
- **Résultat** : API fonctionne correctement (10 800 EUR/an validé)

**Bug #6 - Logs console bruyants** :
- **Problème** : 3× warnings `API response is null` au chargement (CA=0)
- **Solution** : Log silencieux si `err.message === 'API response is null'` → `console.log` au lieu de `console.warn`
- **Résultat** : Console propre au chargement

**Bug #7 - Alertes seuils absentes simulateur** :
- **Problème** : `checkSeuils()` appelée seulement dans Dashboard, pas Simulateur → Dépassement 86 400 EUR non signalé
- **Solution** : Ajout zone alerte `#seuilsAlert` en haut simulateur + appel `checkSeuils(ca * 12)` dans `finalizeTaxCalculation()`
- **Résultat** : Alerte rouge visible si dépassement micro-entreprise

#### Clarifications Techniques (Calculs Dynamiques API URSSAF)
**CFP (Contribution Formation Professionnelle)** :
- Taux URSSAF : **12,3%** (cotisations sociales seules)
- CFP : **+0,2%** (formation obligatoire)
- **Total API : 12,5%** ✅ (incluant CFP automatiquement)
- Validation : CA 7200 EUR/mois → 900 EUR/mois (12,5%) → 10 800 EUR/an ✅

#### Fichiers Modifiés
**app.js** :
- Lignes ~3920, ~4190 : Gestion dual format API (tableau vs objet)
- Ligne ~4229 : Logs silencieux si CA=0
- Ligne ~4390 : Vérification seuils dans `finalizeTaxCalculation()`
- Lignes 9653-9700 : Génération PDF devis
- Lignes 10290-10340 : Conversion devis → facture
- Ligne 284 : Variable globale `quotes`

**index.html** :
- Ligne ~1810 : Zone alerte déplacée en haut simulateur (très visible, box-shadow)
- Ligne ~1820 : Texte ACRE "URSSAF 12,3% - durée 12 mois"
- Lignes 943-1030 : Onglet Devis complet
- Lignes 719-720 : Navigation "📝 Devis"

**Documentation** :
- Création `docs/BUGFIX_OPTION_B_v1.0.2.md` (bugs API)
- Création `docs/FEATURES_DEVIS_v2.1.4.md` (module devis)

### 🎯 Validation
- ✅ Tests : 4/4 scénarios API passés
- ✅ API : 100% conforme déclaration URSSAF réelle (8 déc 2025)
- ✅ Devis : Génération PDF fonctionnelle, conversion facture OK
- ✅ Code : Compilable sans erreur
- ✅ UX : Alertes visibles, console propre, module devis intégré

---

## [2.1.3] - 2025-12-09

### 🐛 Correctifs Critiques RAM & API

#### 1. API Data.gouv CFE - Champ `code_postal` Supprimé
**Problème** : `400 Bad Request - Unknown field: code_postal` (décembre 2025)  
**Cause** : Data.gouv a retiré le champ `code_postal` de l'API Fiscalité Locale  
**Solution** : 
- Suppression `code_postal` des clauses `select` et `group_by`
- Désactivation recherche par code postal
- Conservation recherche par nom commune (champ `libcom`)

#### 2. Édition RAM Bloquée par Validation
**Problème** : Message `⚠️ Un RAM existe déjà` lors modification RAM existant  
**Cause** : Validation sans distinction mode création/édition  
**Solution** :
- Détection `window.editingRAMIndex` dans `generateRAMFromModal()` et `saveRAMFromForm()`
- Exclusion RAM en cours d'édition de la validation duplicate
- Conservation demande confirmation si remplacement autre RAM

#### 3. Date Création "Non renseignée"
**Problème** : `createdAt` disparaissait après modification RAM  
**Cause** : Mise à jour objet RAM écrasait `createdAt`  
**Solution** :
- Préservation `createdAt` lors édition (`if (!ram.createdAt) ram.createdAt = new Date().toISOString()`)
- Ajout `updatedAt` pour traçabilité modifications
- Fallback affichage : `ram.createdAt && !isNaN(new Date(ram.createdAt)) ? ... : 'Non renseignée'`

#### 4. Fonctions RAM Non Exposées
**Problème** : Boutons "📥 Importer depuis Sheets" et "📤 Exporter vers Sheets" ne fonctionnaient pas  
**Cause** : Fonctions `exportRAMsToSheets()` et `importRAMsFromSheets()` non exposées à `window`  
**Solution** : Ajout `window.exportRAMsToSheets` et `window.importRAMsFromSheets`

#### 5. Async/Await Incohérences
**Problème** : 
- `deleteRAM()` utilisait `await syncToDrive()` sans être déclarée `async`
- `generateRAMFromModal()` utilisait `saveToDrive()` au lieu de `await syncToDrive()`
**Solution** :
- `async function deleteRAM(index)` avec `await syncToDrive()`
- `generateRAMFromModal()` utilise `await syncToDrive()` au lieu de `saveToDrive()`
- Cohérence globale: toujours `await syncToDrive()` pour sauvegardes RAM

#### 6. PDF RAM - Optimisation Mise en Page (Visas sur Page 1)
**Problème** : Visas systématiquement en page 2 même sans remarques  
**Cause** : Condition saut de page forcé (`if sigY + 30 > 270`) déclenchée incorrectement  
**Analyse** :
- `autoTable` gère automatiquement les sauts de page (31 jours sur page 1)
- `finalY` représente position sur dernière page du tableau, pas position absolue
- La condition forçait un `addPage()` inutile même avec espace disponible

**Solution Complète (3 phases)** :
1. **En-tête ultra-compact** : 
   - Titre 12pt (au lieu de 14pt), Y=42mm (au lieu de 48mm) → gain 6mm
   - Mois 10pt (au lieu de 11pt), Y=49mm (au lieu de 56mm) → gain 7mm
   - Client 8pt (au lieu de 9pt), Y=55mm (au lieu de 64mm) → gain 9mm
   - Facture Y=60mm (au lieu de 69mm) → gain 9mm
2. **Tableau repositionné** : `startY: 65/60mm` (au lieu de 75/70mm) → gain 10mm
3. **Tableau adaptatif** : Si remarques → `fontSize: 6.5`, `cellPadding: 1.2` (au lieu de 7/1.5)
4. **Suppression saut de page forcé** : `autoTable` gère les débordements, visas suivent naturellement

**Résultat** :
- RAM 31 jours sans remarques : ~228mm (< 277mm limite) → **1 page avec visas** ✅
- RAM 31 jours + remarques (3 lignes) : ~236mm → **1 page avec visas** ✅
- RAM débordant (remarques longues) : Visas sur dernière page du tableau (naturel)

### 🔧 Modifié
- **Validation RAM** : Confirmation utilisateur au lieu de blocage strict
- **Tracking modifications** : Ajout champ `updatedAt` sur RAMs édités
- **Backend** : 1,364 lignes (confirmé production-ready)

### 📚 Documentation
- **Ajout section RAM Workflow** dans `.github/copilot-instructions.md`
- **Patterns async** : `await syncToDrive()` obligatoire pour persistance
- **Edit Mode** : `window.editingRAMIndex` pour RAMs (shared modal + form)

### ✅ Tests à Valider (Localhost)
- ✅ Créer RAM depuis liste factures
- ✅ Modifier RAM existant (bouton "✏️ Modifier")
- ✅ Vérifier dates affichées correctement
- ✅ Supprimer RAM (sync Drive)
- ✅ Importer/Exporter RAMs via Sheets

---

## [2.1.2] - 2025-12-09

### 🐛 Correctifs Critiques

#### 1. Aperçu Facture Multi-Lignes
**Problème** : `ReferenceError: description is not defined` (ligne 1028)  
**Cause** : Migration système multi-lignes incomplète dans `renderInvoicePreview()`  
**Solution** : Génération HTML via `inv.items.map()` avec fallback anciennes factures mono-ligne

#### 2. Validation Numéro Facture Unique
**Problème** : Possibilité créer doublons malgré protection double-clic  
**Solution** : Validation `invoices.find()` avant création, message erreur explicite, exemption mode édition

#### 3. Modal Planning - Bouton Annuler
**Problème** : Bouton "Annuler" ne fermait pas la modal  
**Solution** : **Suppression du bouton** (conserve 🗑️ Supprimer + 💾 Mettre à jour). Fermeture via croix (×) uniquement

#### 4. Graphiques Filtres
**Problème** : Graphiques ignoraient filtres UI (période, statut, client)  
**Solution** : Usage `getFilteredInvoices()` dans `renderCAChart()` et `renderStatusChart()`, appel `renderCharts()` dans `applyFilters()`

#### 5. Compteur CA Auto-Update
**Problème** : CA non actualisé après suppression facture  
**Solution** : Ajout `updateCADisplay()` dans `deleteInvoice()` (ligne 3290)

#### 6. Protection Double-Clic Renforcée
**Problème** : Timeout violation 1282ms, doubles créations  
**Solution** : Flag global `isSubmittingInvoice`, texte bouton "⏳ Traitement...", réactivation en cas erreur

### 🔧 Modifié
- **Graph "CA facturé par mois"** : Affichage 12 mois (Jan-Déc) au lieu de 6 (Jul-Déc), abréviations mois (Jan, Fév, Mar...), hauteur canvas 350px (au lieu de 300px)
- **Modal Planning** : Retrait bouton Annuler, uniquement Supprimer + Mettre à jour
- **Export Google Sheets** : ✅ Confirmé fonctionnel (format multi-ligne `"Ligne 1 | Ligne 2"`)

### 📚 Documentation
- **Nettoyage** : Suppression `CORRECTIFS_08DEC2025.md`, `CORRECTIFS_08DEC2025_SUITE.md`, `CHANGELOG_COMPLET.md`
- **Consolidation** : CHANGELOG.md unique, GUIDE_UTILISATEUR_COMPLET.md (toutes fonctionnalités)
- **Mise à jour** : README.md, STRUCTURE.md, FICHE_TECHNIQUE.md

### ✅ Tests Validés
- ✅ Aperçu multi-ligne (Test 202512-006: 2 lignes @ 750€ = 1500€)
- ✅ Doublons bloqués (validation numéro unique)
- ✅ CA counter auto-refresh (create/modify/delete)
- ✅ Graphs respect filtres (période, statut, client)
- ✅ Export Sheets multi-ligne (`Description | Description 2`)
- ✅ Modal Planning (fermeture croix, suppression bouton Annuler)
- ✅ 12 mois affichés dans graph CA (Janvier → Décembre)

---

## [2.0.0] - 2025-11-25

### ✨ Ajouté
- **Facturation multi-lignes** : Plusieurs lignes par facture avec tableau dynamique
- **Barème IRPP progressif 2025** : Éditable dans Paramètres avec 5 tranches officielles
- **Calculateur BNC** : Abattement 34% et revenu imposable
- **Comparaison fiscale** : Versement libératoire vs IRPP progressif (automatique)
- **Validation PDF stricte** : Empêche génération de factures vides
- **IBAN + BIC** : Deux champs séparés dans footer factures (remplace RIB)
- **Favicons multi-formats** : SVG, ICO, PNG pour tous appareils
- **Documentation complète** :
  - README.md (guide utilisateur)
  - FICHE_TECHNIQUE.md (guide développeur)
  - BAREME_IRPP.md (détails calculateur fiscal)
  - STRUCTURE.md (organisation projet)
  - DEMARRAGE.md (quick start)
- **.gitignore** : Fichiers système et sensibles exclus
- **LICENSE** : MIT License

### 🔧 Modifié
- **Organisation projet** : Structure en dossiers (assets/, docs/, backend/, scripts/)
- **Chemins assets** : Logo et favicons dans assets/images/ et assets/icons/
- **Bouton Annuler calendrier** : Ajout e.stopPropagation() pour corriger fermeture modal
- **Refresh calendrier** : Optimisé de 30s à 5 min (~1,920 appels/mois au lieu de 5,760)
- **Paramètres** : Réorganisés en 4 sections thématiques
  1. Informations Entreprise
  2. Calculs Fiscaux et Sociaux
  3. Barème Progressif IRPP
  4. Divers

### 🐛 Corrigé
- **Barème IRPP** : Valeurs officielles service-public.gouv.fr (célibataire 1 part)
  - Tranche 1 : 0-11 497 € (0%)
  - Tranche 2 : 11 498-29 315 € (11%)
  - Tranche 3 : 29 316-83 823 € (30%)
  - Tranche 4 : 83 824-180 294 € (41%)
  - Tranche 5 : > 180 295 € (45%)
- **PDF multi-lignes** : getCurrentInvoiceForPreview() utilise maintenant currentInvoiceItems
- **Erreurs initialisation** : Vérifications de sécurité sur taxSettings.irppBareme
- **Favicon 404** : Fichiers correctement placés dans assets/icons/

### 🔒 Sécurité
- Validation stricte avant génération PDF (client, items, montant > 0)
- .gitignore pour credentials et données sensibles
- **Configuration localStorage** : Secrets OAuth2 externalisés (config.js local + localStorage pour GitHub Pages)

---

## [2.0.1] - 2025-11-25

### 🐛 Correctif
- **Configuration GitHub Pages** : Interface de configuration technique dans Paramètres
  - Champs : Backend URL, Client ID, Client Secret, Calendar ID
  - Sauvegarde dans `localStorage` pour GitHub Pages
  - Priorité : `config.js` (local) > `localStorage` (GitHub Pages) > defaults
  - Bouton "🧪 Tester Backend" pour vérifier la connexion
  - Message d'avertissement si configuration manquante au démarrage
  - Documentation intégrée dans l'interface
- **Résout** : Erreur "Impossible de contacter le BACKEND" sur GitHub Pages

---

## [2.1.0] - 2025-12-01

### ✨ Ajouté
- **Système RAM (Rapport d'Activité Mensuelle)** complet
  - Interface calendrier 30 jours avec saisie heures/commentaires/remarques
  - Génération PDF format A4 portrait (identique aux factures)
  - Logo MTI CONSULTING 35×18mm position (10,15)
  - Couleurs corporate #21808D (bleu MTI) pour headers et nom entreprise
  - Weekends grisés (#F5F5F5) automatiquement
  - Tableau optimisé 4 colonnes (Jour 22mm, Date 13mm, Heures 15mm, Commentaires 130mm)
  - Marges 15mm gauche/droite = 180mm total (compatible A4)
  - Signature PandaDoc intégrée (50×15mm centrée dans case "Visa Prestataire")
- **Envoi RAM par email**
  - Envoi RAM seul avec PDF en pièce jointe
  - Envoi combiné facture + RAM avec deux PDFs joints
  - Variables email complètes (invoiceFilename, ramFilename, invoiceBody)
  - Subject personnalisé : "Facture + RAM - [Client] - [Mois] [Année]"
- **Export Google Sheets automatique**
  - Création onglet "RAM" avec headers #21808D
  - Colonnes : Date Export, Client, Mois, Année, Jour, Date, Heures, Commentaires, Remarques
  - Export automatique à chaque sauvegarde
  - Filtre : uniquement activités avec heures > 0
- **Liaison factures intelligente**
  - Dropdown factures filtré par client et période (YYYYMM)
  - Lien RAM ↔ facture bidirectionnel
  - Génération RAM depuis onglet Factures
- **Prévention doublons**
  - Validation client + mois + année avant création
  - Bloque création si RAM existant (sauf mode édition)
  - Toast d'avertissement explicite
- **Gestion données complète**
  - Triple-layer : localStorage + Google Drive + Google Sheets
  - CRUD complet : create, read, update, delete, list
  - Persistance automatique entre sessions
  - Chargement initial dans initApp()
- **Backend Google Apps Script**
  - Action `sendRAMEmail` : envoi RAM seul
  - Action `exportRAMToSheets` : export vers Sheets
  - Action `sendInvoiceWithRAM` : envoi combiné
  - Code complet 1079 lignes prêt pour déploiement

### 🔧 Modifié
- **Interface onglet RAM**
  - Pattern liste + formulaire (identique à Factures)
  - Formulaire en haut, table liste en bas
  - Boutons actions : Éditer, Supprimer, Envoyer par email, Export Sheets
- **Chargement images**
  - Helper `fetchImageAsDataUri()` pour éviter erreurs CORS
  - Chargement logo local depuis `assets/images/MTI_CONSULTING.png`
  - Fallback automatique si image distante échoue

### 🐛 Corrigé
- **Logo RAM** : Proportions finales 35×18mm (4 itérations : 25×25 → 40×20 → 30×15 → 35×18)
- **Table overflow** : Optimisation colonnes et marges (final : 180mm avec marges 15mm)
- **Variables email undefined** : Ajout invoiceFilename, ramFilename, invoiceBody dans sendInvoiceWithRAM
- **Erreur ramPreview null** : Vérification existence élément avant innerHTML
- **Export Sheets** : Changement fetch direct → callBackend wrapper
- **CORS errors** : Implémentation fetchImageAsDataUri pour images locales
- **Weekends non grisés** : Détection automatique samedi/dimanche avec style #F5F5F5

### 📚 Documentation
- Nettoyage fichiers temporaires (CORRECTIONS_FORMAT_RAM.md, DEPLOIEMENT_BACKEND_RAM.md, MODIFICATIONS_RAM_FINALES.md)
- README.md mis à jour avec section RAM complète
- STRUCTURE.md enrichi avec nouvelles fonctions RAM
- CHANGELOG.md détaillé pour v2.1.0

### 🔒 Sécurité
- Validation stricte avant génération PDF (client, mois, année requis)
- Prévention doublons pour éviter confusion données
- Gestion erreurs robuste avec try/catch et toasts utilisateur

---

## [1.0.0] - 2025-10-15

### ✨ Ajouté (Version initiale)
- Gestion clients (CRUD, recherche, filtrage)
- Facturation simple (1 ligne par facture)
- Génération PDF A4 avec logo
- Statuts factures : Brouillon, Envoyée, Payée, Retard
- Suivi paiements (montant reçu, date réception)
- Calculs fiscaux :
  - Charges sociales URSSAF (ACRE actif/inactif)
  - Versement libératoire 2.2%
  - CFE mensuelle
- Graphiques :
  - CA par mois (Chart.js)
  - Répartition par statut
- Google Calendar integration :
  - FullCalendar 6.1.10
  - OAuth2 avec Google Identity Services
  - CRUD événements
  - Auto-refresh 30s
- Google Drive storage :
  - mti_data.json
  - localStorage + sync cloud
- Backend Google Apps Script :
  - REST API
  - savePdfToDrive
  - loadData / saveData
- UI responsive
- Paramètres éditables (entreprise, fiscalité)

---

## [Non publié] - En développement

### 🎯 Planifié v3.0
- PWA (Progressive Web App) avec service worker
- Mode offline complet
- Export comptable CSV
- Support multi-devises
- Quotient familial IRPP (couples, enfants)
- Historique simulations fiscales
- Backup automatique périodique
- Notifications relances factures
- Dashboard analytics avancé
- Tests automatisés (Jest + Cypress)
- Migration backend Node.js (optionnel)

---

**Légende** :
- ✨ Ajouté : Nouvelles fonctionnalités
- 🔧 Modifié : Modifications de fonctionnalités existantes
- 🐛 Corrigé : Corrections de bugs
- 🔒 Sécurité : Améliorations de sécurité
- 🗑️ Supprimé : Fonctionnalités retirées
- ⚠️ Déprécié : Fonctionnalités à retirer prochainement

---

[2.0.0]: https://github.com/mtcdp59/Factu_MTI_CONSULTING/releases/tag/v2.0.0
[1.0.0]: https://github.com/mtcdp59/Factu_MTI_CONSULTING/releases/tag/v1.0.0
