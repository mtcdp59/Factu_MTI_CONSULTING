# Instructions Copilot pour MTI CONSULTING

## Vue d'Ensemble du Projet
Application web de gestion freelance pour MTI CONSULTING. Construite en JavaScript vanilla (`app.js`) et un seul fichier HTML (`index.html`). Stockage des données dans Google Drive via un backend Google Apps Script (style v42 - pas de gestion CORS).

**Fonctionnalités Majeures :**
- Gestion Clients, Factures & Tâches
- Rapports d'Activité Mensuels (RAM) avec génération PDF et automatisation email
- **Calculateur de Charges Avancé** (taux officiels 2025) avec simulation, projection et outils de comparaison

## Architecture & Flux de Données (Style v42)
- **Frontend uniquement** : Pas de Node.js, pas de build system, pas de package manager.
- **Stockage de Données** : Google Drive (`mti_data.json`) via backend Google Apps Script.
- **Synchronisation** : Communique avec le backend Google Apps Script (`BACKEND_URL` hardcodé dans `app.js`) pour toutes les opérations.
- **Infos Société** : Valeurs par défaut hardcodées pour MTI CONSULTING dans `app.js` (nom, SIRET, adresse, IBAN, BIC, etc.).
- **Paramètres Fiscaux** : Basés sur les **taux officiels 2025** (URSSAF, CFP, VL, IRPP), entièrement personnalisables via l'onglet Paramètres.
- **Configuration** : Credentials hardcodés dans `app.js` (style v42), modifiables via l'onglet Paramètres (sauvegarde dans localStorage).
- **Backend** : Google Apps Script sans gestion CORS (retours de réponses directs via `ContentService`).

## Workflows Développeurs
- **Pas de build** : Ouvrir directement `index.html` dans un navigateur pour lancer l'app.
- **Debugging** : Utiliser DevTools du navigateur (Console, onglet Network) pour inspecter les données, débugger le JS et monitorer les appels API.
- **Tests** : Pas de tests automatisés ; tests manuels via interactions UI.
- **Tests locaux** : `python -m http.server 8000` pour serveur local.
- **Réinitialisation** : Effacer le `localStorage` du navigateur pour réinitialiser l'état de l'app.

## Patterns Spécifiques au Projet
- **Sauvegarde/Chargement Données** : Toutes les entités majeures (clients, invoices, tasks, RAMs, taxSettings) ont des fonctions dédiées save/load utilisant `localStorage` + `syncToDrive()`.
- **Mode Édition** :
  - Factures : `isEditMode` et `editingInvoiceIndex`
  - RAMs : `window.editingRAMIndex` (partagé entre modal et édition formulaire)
- **État Sync** : `isSyncing` et `lastSyncTime` trackent le statut de synchronisation backend.
- **Persistance Simulation** : Paramètres du calculateur fiscal sauvegardés dans `localStorage` (clé : `mti_simulation_params`).
- **UI/UX** : Tokens de couleur personnalisés et styles dans `index.html` pour le branding.
- **Pattern Async** : Toujours utiliser `await syncToDrive()` pour la persistance des données (encapsule `saveToDrive()`).

## Points d'Intégration
- **Google Apps Script** : Toutes les opérations distantes utilisent l'endpoint `BACKEND_URL`. Voir `app.js` pour la logique de requête.
- **Logo** : Utilise une image statique (`MTI_CONSULTING.png`) et une URL GitHub raw pour le branding société.
- **jsPDF** : Bibliothèque de génération PDF (chargée depuis CDN) pour factures, RAMs et exports simulateur fiscal.

## Calculateur Fiscal (Onglet Calculs) - Taux Officiels 2025
**Sources légales vérifiées :**
- **URSSAF BNC** : 12,3% (ACRE année 1) / 24,6% (standard 2025) - Décret n°2024-484 du 30/05/2024
- **CFP (Formation Pro)** : 0,2% obligatoire - Code du travail L6331-48
- **Versement Libératoire** : 2,2% (BNC) - Conditions : RFR ≤ 28,797€/part (2026), CA ≤ 77,700€
- **IRPP Progressif** : Barème 2025 (0% / 11% / 30% / 41% / 45%) - service-public.gouv.fr
- **ACRE** : Période jusqu'à fin du 3ème trimestre civil suivant le début d'activité (Art. L.131-6-4 CSS)
- **Évolution** : URSSAF +1%/an jusqu'en 2029 (24,6% → 28,6%)

**Fonctionnalités :**
- Simulation interactive avec sauvegarde paramètres (localStorage)
- Sélection ACRE automatique selon date de début d'activité
- Choix régime fiscal (IRPP/VL) avec vérification éligibilité RFR
- **CFE personnalisée par commune** (API Open Data Soft DGFiP 2024)
  - Données officielles (taux CFE réels par code INSEE)
  - Cache localStorage 30 jours (`mti_cfe_api_cache`)
  - Fallback hardcodé (14 villes) si API indisponible
  - Conversion taux (%) → montant (€) via base minimale estimée 1,200€
  - Autocomplétion communes + indicateurs source (🔹API / ⚠️Estimation)
- Tableau détaillé des charges (4 colonnes : Poste/Taux/Base/Montant)
- Comparaison VL vs IRPP côte à côte avec recommandation
- Projection 2025-2029 (évolution URSSAF +1%/an)
- Graphique distribution charges (histogramme empilé)
- Toggle Mensuel/Annuel
- Export PDF complet

## Conventions
- **Langue française** : UI et commentaires de code principalement en français.
- **App mono-page** : Toute la logique dans `app.js`, toute l'UI dans `index.html`.
- **Pas de frameworks** : JS/HTML/CSS pur, pas de React/Vue/Angular.

## Fichiers Clés
- `app.js` : Logique applicative principale (~8,828 lignes), gestion données, sync API, calculateur fiscal, intégration SIRENE.
- `index.html` : UI, styles, tokens de couleur (~1,830 lignes).
- `backend/AppScript.js` : Backend Google Apps Script (1,364 lignes), stockage Drive, APIs Gmail, Sheets, Calendar.
- `backend/appsscript.json` : Manifeste avec scopes OAuth et configuration des services avancés.
- `MTI_CONSULTING.png` : Logo société (35×18mm optimisé pour PDFs).
- `.github/instructions-copilot.md` : Ce fichier (documentation technique pour IA).

## Structure Backend (backend/AppScript.js)
**Endpoints Principaux (routing doPost) :**
- `saveToDrive` / `loadFromDrive` - Persistance données dans Drive
- `ensureStorage` - Initialiser structure de stockage
- `sendEmail` / `sendEmailWithDriveFile` - Envoi email API Gmail
- `importClients` / `exportClients` - Sync Sheets 9 colonnes avec données SIRENE
- `sync_invoices` - Export factures vers Sheets
- `addCalendarEvent` / `deleteCalendarEvent` / `updateCalendarEvent` - CRUD Calendar
- `listCalendarEvents` / `importCalendarEvents` - Sync Calendar
- `sendRAMEmail` / `exportRAMToSheets` / `sendInvoiceWithRAM` - Workflows RAM
- `savePdfToDrive` - Stocker PDFs dans dossiers Drive

**Fonctions Clés :**
- `getOrCreateFolder()` - Gestion dossiers Drive
- `createResponse()` - Réponses JSON standardisées
- `getColorForType()` - Couleurs événements Calendar par type de tâche
- `syncCalendarAction()` - Sync Calendar par batch
- `listCalendars()` - Lister calendriers disponibles

**Structures de Données :**
- CONFIG : DRIVE_FOLDER, DATA_FILE, SHEETS_ID, TIERS_SHEET, EMAIL_FROM
- companyInfo : Defaults branding société (nom, SIRET, adresse, IBAN, BIC)

## Exemples de Patterns
```js
// Sauvegarder paramètres simulation dans localStorage
function saveSimulationParams() {
  const params = { ca, acreAnnee1, commune, rfr, regimeVL, periodeMensuel };
  localStorage.setItem('mti_simulation_params', JSON.stringify(params));
}

// Calculer période ACRE (fin du 3ème trimestre après date début)
function calculateACREPeriod() {
  const trimestreDebut = Math.floor(debut.getMonth() / 3) + 1;
  const trimestreFin = trimestreDebut + 3; // +3 trimestres
  // Logique pour gérer débordement année...
}

// Appeler backend depuis frontend
async function callBackend(action, payload = {}) {
  const body = JSON.stringify({ action, ...payload });
  const resp = await fetch(CONFIG.BACKEND_URL, { method: 'POST', body });
  return await resp.json();
}

// Intégration API SIRENE (cache 90 jours)
async function validateSIRET(siret) {
  const cache = JSON.parse(localStorage.getItem('mti_sirene_cache') || '{}');
  const url = `https://api.insee.fr/api-sirene/3.11/siret/${siret}`;
  const headers = { 'X-INSEE-Api-Key-Integration': '84dbb5c2-6a3c-41d4-9bb5-c26a3c41d4f4' };
  // Extraire : nom, adresse, NAF, catégorie juridique, état, type siège
}
```

## Gestion Clients avec Intégration SIRENE
**Structure Client 9 Colonnes :**
```javascript
{
  name: string,                   // Nom société
  siret: string,                  // SIRET 14 chiffres
  address: string,                // Adresse complète
  email_facturation: string,      // Email facturation
  contact_name: string,           // Personne de contact
  naf: string,                    // Code NAF (ex: 58.29C)
  categorie_juridique: string,    // Catégorie juridique (ex: 5710 - SAS)
  etat_administratif: string,     // Statut (Actif/Fermé)
  type_siege: string              // Type siège (Siège social/Établissement)
}
```

**Intégration API SIRENE :**
- Endpoint : `https://api.insee.fr/api-sirene/3.11/siret/{siret}`
- Clé API : `84dbb5c2-6a3c-41d4-9bb5-c26a3c41d4f4`
- Cache : 90 jours dans localStorage (`mti_sirene_cache`)
- Auto-remplissage : NAF, catégorie juridique, état administratif, type siège
- Export Google Sheets : 9 colonnes avec données SIRENE enrichies

**Workflow :**
1. Utilisateur saisit SIRET → appel API avec vérification cache
2. Extraction données entreprise (nom, adresse, NAF, catégorie, état, type)
3. Remplissage champs formulaire en readonly (fond gris)
4. Sauvegarde dans localStorage + export Google Sheets optionnel
5. Affichage dans tableau clients avec colonnes enrichies

## Architecture Style v42
- **Pas de gestion CORS** : Backend retourne réponses directement sans appels `setHeader()`
- **Credentials hardcodés** : Toute la config dans `app.js` (lignes 4-14), modifiable via UI
- **Données initiales vides** : `clients = []`, `invoices = []`, `tasks = []`, `rams = []` (chargées depuis Drive au démarrage)
- **Defaults infos société** : Infos complètes MTI CONSULTING hardcodées (SIRET, adresse, IBAN, BIC)
- **Defaults taux fiscaux** : Taux officiels 2025 dans objet `taxSettings`
- **Prêt GitHub Pages** : Fonctionne immédiatement sans fichiers de configuration

## Intégration API CFE (Open Data Soft)
```js
// Récupérer CFE depuis API officielle
async function getCFEFromAPI(commune) {
  // 1. Vérifier cache (TTL 30 jours)
  const cache = JSON.parse(localStorage.getItem('mti_cfe_api_cache') || '{}');
  
  // 2. Trouver code INSEE (34,934 communes supportées)
  const inseeCode = inseeCodesDB[commune.toLowerCase()]; // Ex: 'paris' → '75056'
  
  // 3. Appeler API : data.economie.gouv.fr/api/explore/v2.1/.../fiscalite-locale-des-entreprises
  const url = `...&refine=exercice:"2024"&refine=insee_com:"${inseeCode}"`;
  const data = await fetch(url).then(r => r.json());
  
  // 4. Convertir taux (%) en montant (€)
  const tauxCFE = data.results[0].taux_global_cfe_hz; // Ex: 25.42%
  const baseMinimaleEstimee = 1200; // Base moyenne estimée
  const cfeEstimee = (tauxCFE / 100) * baseMinimaleEstimee; // Ex: 305€
  
  // 5. Fallback si API échoue (cfeFallbackDB avec 14 villes)
}
```

## Workflow RAM & Corrections de Bugs (Déc 2025)
**Corrections critiques appliquées :**
1. **Détection Mode Édition** : `window.editingRAMIndex` tracke l'état d'édition, validation autorise mise à jour même RAM
2. **Préservation Dates** : `createdAt` préservé en édition, `updatedAt` ajouté pour tracking modifications
3. **Cohérence Async** : `deleteRAM` déclaré `async`, toutes opérations RAM utilisent `await syncToDrive()`
4. **Exports Window** : `exportRAMsToSheets` et `importRAMsFromSheets` exposés à `window` pour boutons HTML
5. **API Data.gouv** : Champ `code_postal` supprimé (déprécié déc 2025), requête CFE mise à jour
6. **Optimisation PDF** : Visas restent sur page 1 (en-tête compact, tableau adaptatif, suppression saut de page forcé)

**Flux Création RAM :**
- Modal : `generateRAMForInvoice()` → `showRAMModal()` → `generateRAMFromModal()`
- Formulaire : `editRAMInForm()` → `saveRAMFromForm()`
- Les deux valident les doublons via `window.editingRAMIndex` pour permettre l'édition

## Génération PDF RAM (Optimisations Déc 2025)
**Stratégie Mise en Page (pour visas page 1) :**
```js
// 1. En-tête ultra-compact (gain 9mm)
doc.setFontSize(12); // Titre (était 14pt)
doc.text('RAPPORT...', 105, 42, {align: 'center'}); // Y=42mm (était 48mm)
doc.setFontSize(10); // Mois (était 11pt)
doc.text(`${monthName} ${year}`, 105, 49); // Y=49mm (était 56mm)
doc.setFontSize(8); // Client (était 9pt)
doc.text(`Client: ${client}`, 105, 55); // Y=55mm (était 64mm)

// 2. Tableau repositionné (gain 10mm)
doc.autoTable({
  startY: invoiceNumber ? 65 : 60, // Était 75 : 70
  // ...
});

// 3. Tableau adaptatif selon présence remarques
const hasRemarks = remarks && remarks.trim().length > 0;
const tableFontSize = hasRemarks ? 6.5 : 7;
const tableCellPadding = hasRemarks ? 1.2 : 1.5;

// 4. Visas suivent naturellement (pas de saut de page forcé)
let sigY = remarks ? finalY + remarksHeight + 5 : finalY + 5;
// autoTable gère les sauts de page automatiquement
// finalY = position sur dernière page du tableau
```

**Résultat Calculs :**
- RAM 31 jours sans remarques : ~228mm (< 277mm limite) → **1 page** ✅
- RAM 31 jours + remarques (3-4 lignes) : ~236mm → **1 page** ✅

---
**Pour les agents IA :**
- **CRITIQUE** : Toujours vérifier les taux fiscaux contre sources officielles (URSSAF, Code du travail, service-public.gouv.fr)
- **API CFE** : Utiliser Open Data Soft DGFiP pour taux réels (taux_global_cfe_hz), convertir via base 1,200€ estimée
- **API SIRENE** : Cache 90 jours, auto-remplissage 6 champs (nom, adresse, NAF, catégorie, état, type siège)
- **Google Sheets** : Export 9 colonnes avec données SIRENE enrichies (feuille Tiers)
- **Backend** : 1,364 lignes, pas de fonctions de test, endpoints production uniquement
- **Opérations RAM** : Toujours utiliser `await syncToDrive()`, vérifier `window.editingRAMIndex` pour mode édition
- **PDF RAM** : En-tête compact (12/10/8pt), tableau adaptatif (6.5pt si remarques), pas de saut de page forcé
- Focus sur intégration localStorage et Google Apps Script
- Respecter langue française et conventions branding
- Pas de scripts build/test ; tests manuels navigateur uniquement
- Calculateur fiscal : Tous les taux modifiables via onglet Paramètres (utilisateur peut mettre à jour annuellement)
- Calcul période ACRE : Art. L.131-6-4 CSS (fin du 3ème trimestre)
- Documenter les nouveaux patterns dans ce fichier pour les agents futurs
