# Copilot Instructions for MTI CONSULTING

## Project Overview
This is a browser-based freelance management tool for MTI CONSULTING. The app is built with vanilla JavaScript (`app.js`) and a single HTML file (`index.html`). It stores data in Google Drive via a Google Apps Script backend (v42 style - no CORS handling).

**Major Features:**
- Client, Invoice & Task Management
- Monthly Activity Reports (RAM) with PDF generation & email automation
- **Advanced Tax Calculator** (2025 official rates) with simulation, projection, and comparison tools

## Architecture & Data Flow (v42 Style)
- **Frontend only**: No Node.js, no build system, no package manager.
- **Data Storage**: Google Drive (`mti_data.json`) via Google Apps Script backend.
- **Sync**: Communicates with Google Apps Script backend (hardcoded `BACKEND_URL` in `app.js`) for all operations.
- **Company Info**: Hardcoded defaults for MTI CONSULTING in `app.js` (name, SIRET, address, IBAN, BIC, etc.).
- **Tax Settings**: Defaults based on **official 2025 rates** (URSSAF, CFP, VL, IRPP), fully customizable via Paramètres tab.
- **Configuration**: Credentials hardcodés dans `app.js` (v42 style), modifiables via l'onglet Paramètres (sauvegarde dans localStorage).
- **Backend**: Google Apps Script sans gestion CORS (retours de réponses directs via `ContentService`).

## Developer Workflows
- **No build step**: Directly open `index.html` in a browser to run the app.
- **Debugging**: Use browser DevTools (Console, Network tab) to inspect data, debug JS, and monitor API calls.
- **Testing**: No automated tests; manual testing via UI interactions.
- **Local testing**: `python -m http.server 8000` pour serveur local.
- **Data Reset**: Clear browser `localStorage` to reset app state.

## Project-Specific Patterns
- **Data Save/Load**: All major entities (clients, invoices, tasks, RAMs, taxSettings) have dedicated save/load functions using `localStorage`.
- **Edit Mode**: Controlled by `isEditMode` and `editingInvoiceIndex` for invoice editing.
- **Sync State**: `isSyncing` and `lastSyncTime` track backend sync status.
- **Simulation Persistence**: Tax calculator parameters saved in `localStorage` (key: `mti_simulation_params`).
- **UI/UX**: Custom color tokens and styles in `index.html` for branding.

## Integration Points
- **Google Apps Script**: All remote operations use the `BACKEND_URL` endpoint. See `app.js` for request logic.
- **Logo**: Uses a static image (`MTI_CONSULTING.png`) and a GitHub raw URL for company branding.
- **jsPDF**: PDF generation library (loaded from CDN) for invoices, RAMs, and tax simulator exports.

## Tax Calculator (Onglet Calculs) - Official 2025 Rates
**Sources légales vérifiées :**
- **URSSAF BNC**: 11,6% (ACRE année 1) / 24,6% (standard 2025) - Décret n°2024-484 du 30/05/2024
- **CFP (Formation Pro)**: 0,2% obligatoire - Code du travail L6331-48
- **Versement Libératoire**: 2,2% (BNC) - Conditions: RFR ≤ 28,797€/part (2026), CA ≤ 77,700€
- **IRPP Progressif**: Barème 2025 (0% / 11% / 30% / 41% / 45%) - service-public.gouv.fr
- **ACRE**: Période jusqu'à fin du 3ème trimestre civil suivant le début d'activité (Art. L.131-6-4 CSS)
- **Évolution**: URSSAF +1%/an jusqu'en 2029 (24,6% → 28,6%)

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
- **French language**: UI and code comments are primarily in French.
- **Single-page app**: All logic in `app.js`, all UI in `index.html`.
- **No frameworks**: Pure JS/HTML/CSS, no React/Vue/Angular.

## Key Files
- `app.js`: Main application logic (~7,800 lines), data management, API sync, tax calculator, SIRENE integration.
- `index.html`: UI, styles, color tokens (1,830 lines).
- `backend/AppScript.js`: Google Apps Script backend (1,092 lines), Drive storage, Gmail, Sheets, Calendar APIs.
- `backend/appsscript.json`: Manifest with OAuth scopes and advanced services configuration.
- `MTI_CONSULTING.png`: Company logo (35×18mm optimized for PDFs).
- `.github/copilot-instructions.md`: This file (technical documentation).

## Backend Structure (backend/AppScript.js)
**Main Endpoints (doPost routing):**
- `saveToDrive` / `loadFromDrive` - Data persistence in Drive
- `ensureStorage` - Initialize storage structure
- `sendEmail` / `sendEmailWithDriveFile` - Gmail API email sending
- `importClients` / `exportClients` - 9-column Sheets sync with SIRENE data
- `sync_invoices` - Export invoices to Sheets
- `addCalendarEvent` / `deleteCalendarEvent` / `updateCalendarEvent` - Calendar CRUD
- `listCalendarEvents` / `importCalendarEvents` - Calendar sync
- `sendRAMEmail` / `exportRAMToSheets` / `sendInvoiceWithRAM` - RAM workflows
- `savePdfToDrive` - Store PDFs in Drive folders

**Key Functions:**
- `getOrCreateFolder()` - Drive folder management
- `createResponse()` - Standardized JSON responses
- `getColorForType()` - Calendar event colors by task type
- `syncCalendarAction()` - Batch calendar sync
- `listCalendars()` - List available calendars

**Data Structures:**
- CONFIG: DRIVE_FOLDER, DATA_FILE, SHEETS_ID, TIERS_SHEET, EMAIL_FROM
- companyInfo: Company branding defaults (name, SIRET, address, IBAN, BIC)

## Example Patterns
```js
// Save simulation params to localStorage
function saveSimulationParams() {
  const params = { ca, acreAnnee1, commune, rfr, regimeVL, periodeMensuel };
  localStorage.setItem('mti_simulation_params', JSON.stringify(params));
}

// Calculate ACRE period (end of 3rd quarter after start date)
function calculateACREPeriod() {
  const trimestreDebut = Math.floor(debut.getMonth() / 3) + 1;
  const trimestreFin = trimestreDebut + 3; // +3 quarters
  // Logic to handle year overflow...
}

// Call backend from frontend
async function callBackend(action, payload = {}) {
  const body = JSON.stringify({ action, ...payload });
  const resp = await fetch(CONFIG.BACKEND_URL, { method: 'POST', body });
  return await resp.json();
}

// SIRENE API integration (90-day cache)
async function validateSIRET(siret) {
  const cache = JSON.parse(localStorage.getItem('mti_sirene_cache') || '{}');
  const url = `https://api.insee.fr/api-sirene/3.11/siret/${siret}`;
  const headers = { 'X-INSEE-Api-Key-Integration': '84dbb5c2-6a3c-41d4-9bb5-c26a3c41d4f4' };
  // Extract: nom, adresse, NAF, catégorie juridique, état, type siège
}
```

## Client Management with SIRENE Integration
**9-Column Client Structure:**
```javascript
{
  name: string,                   // Company name
  siret: string,                  // 14-digit SIRET
  address: string,                // Full address
  email_facturation: string,      // Billing email
  contact_name: string,           // Contact person
  naf: string,                    // NAF code (ex: 58.29C)
  categorie_juridique: string,    // Legal category (ex: 5710 - SAS)
  etat_administratif: string,     // Status (Actif/Fermé)
  type_siege: string              // HQ type (Siège social/Établissement)
}
```

**SIRENE API Integration:**
- Endpoint: `https://api.insee.fr/api-sirene/3.11/siret/{siret}`
- API Key: `84dbb5c2-6a3c-41d4-9bb5-c26a3c41d4f4`
- Cache: 90 days in localStorage (`mti_sirene_cache`)
- Auto-fill: NAF, catégorie juridique, état administratif, type siège
- Google Sheets Export: 9 columns with SIRENE enriched data

**Workflow:**
1. User enters SIRET → API call with cache check
2. Extract business data (nom, adresse, NAF, catégorie, état, type)
3. Populate readonly form fields (gray background)
4. Save to localStorage + optional Google Sheets export
5. Display in client table with enriched columns

## v42 Style Architecture
- **No CORS handling**: Backend returns responses directly without `setHeader()` calls
- **Hardcoded credentials**: All config in `app.js` (lines 4-14), modifiable via UI
- **Empty initial data**: `clients = []`, `invoices = []`, `tasks = []`, `rams = []` (loaded from Drive at startup)
- **Company info defaults**: Full MTI CONSULTING info hardcoded (SIRET, address, IBAN, BIC)
- **Tax rates defaults**: Official 2025 rates in `taxSettings` object
- **GitHub Pages ready**: Works immediately without configuration files

## API CFE Integration (Open Data Soft)
```js
// Fetch CFE from official API
async function getCFEFromAPI(commune) {
  // 1. Check cache (30 days TTL)
  const cache = JSON.parse(localStorage.getItem('mti_cfe_api_cache') || '{}');
  
  // 2. Find INSEE code (34,934 communes supported)
  const inseeCode = inseeCodesDB[commune.toLowerCase()]; // Ex: 'paris' → '75056'
  
  // 3. Call API: data.economie.gouv.fr/api/explore/v2.1/.../fiscalite-locale-des-entreprises
  const url = `...&refine=exercice:"2024"&refine=insee_com:"${inseeCode}"`;
  const data = await fetch(url).then(r => r.json());
  
  // 4. Convert rate (%) to amount (€)
  const tauxCFE = data.results[0].taux_global_cfe_hz; // Ex: 25.42%
  const baseMinimaleEstimee = 1200; // Average estimated base
  const cfeEstimee = (tauxCFE / 100) * baseMinimaleEstimee; // Ex: 305€
  
  // 5. Fallback if API fails (cfeFallbackDB with 14 cities)
}
```

---
**For AI agents:**
- **CRITICAL**: Always verify tax rates against official sources (URSSAF, Code du travail, service-public.gouv.fr)
- **CFE API**: Use Open Data Soft DGFiP for real rates (taux_global_cfe_hz), convert via 1,200€ estimated base
- **SIRENE API**: 90-day cache, auto-fill 6 fields (nom, adresse, NAF, catégorie, état, type siège)
- **Google Sheets**: 9-column export with SIRENE enriched data (Tiers sheet)
- **Backend**: 1,092 lines, no test functions, production-ready endpoints only
- Focus on localStorage and Google Apps Script integration
- Respect French language and branding conventions
- No build/test scripts; manual browser testing only
- Tax calculator: All rates editable via Paramètres tab (user can update annually)
- ACRE period calculation: Art. L.131-6-4 CSS (end of 3rd quarter)
- Document new patterns in this file for future agents
