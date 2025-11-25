# 🔧 Fiche Technique - MTI CONSULTING

**Application de gestion freelance (BNC) - Single Page Application**

**Version** : 2.0  
**Date** : Novembre 2025  
**Langage** : JavaScript (ES6+), HTML5, CSS3  
**Statut** : Production

---

## 📌 Vue d'ensemble

Application web **sans framework**, **sans build**, avec un seul fichier HTML contenant tout le CSS inline. Stockage hybride localStorage + Google Drive via REST API.

### Principe de fonctionnement
- **Frontend-only** : Aucun serveur Node.js, aucune compilation
- **Ouverture directe** : `index.html` fonctionne en ouvrant le fichier ou via serveur HTTP local
- **Backend externe** : Google Apps Script déployé en Web App (REST API)
- **Stockage** : localStorage (cache) + Google Drive (persistence)

---

## 📂 Structure du Projet

```
Factu_MTI_CONSULTING/
│
├── index.html                      # UI complète (1484 lignes)
│   ├── <head>                      # Meta, favicon, CSS inline
│   ├── <style>                     # Tous les styles (lignes 7-680)
│   ├── <body>                      # Structure HTML
│   │   ├── Navigation (tabs)      # Clients, Factures, Tâches, Calculs, Agenda, Paramètres
│   │   ├── Modals                 # Preview facture, confirmation, edit
│   │   └── Scripts externes       # CDN libraries
│   └── <script src="app.js">      # Logique métier
│
├── app.js                          # Logique complète (5159 lignes)
│   ├── CONFIG (lignes 4-13)       # Backend URL, OAuth2 credentials
│   ├── Data structures (340-370)  # clients[], invoices[], tasks[], companyInfo, taxSettings
│   ├── Google APIs (400-800)      # Calendar, Drive, Gmail integration
│   ├── Invoice management         # CRUD, PDF generation, multi-line items
│   ├── Tax calculator             # IRPP progressif, BNC, comparaison
│   ├── FullCalendar (3800-4200)   # Agenda interactif
│   └── Init sequence (4700-4850)  # DOMContentLoaded, data loading
│
├── MTI_CONSULTING.png              # Logo (180×90px)
├── favicon.*                       # Favicons multi-formats
├── site.webmanifest                # PWA manifest
├── README.md                       # Documentation utilisateur
├── BAREME_IRPP.md                  # Doc calculateur fiscal
└── .github/
    └── copilot-instructions.md     # Conventions projet
```

---

## 🔑 Points d'entrée et Configuration

### 1. Configuration Backend (app.js + config.js)

**Fichier `config.js` (à créer, non commité)** :
```javascript
const CONFIG = {
    GOOGLE_CLIENT_ID: 'VOTRE_CLIENT_ID.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'VOTRE_CLIENT_SECRET',
    BACKEND_URL: 'https://script.google.com/macros/s/VOTRE_SCRIPT_ID/exec'
};
```

**Valeurs par défaut dans app.js** :
```javascript
const CONFIG_DEFAULTS = {
    BACKEND_URL: 'https://script.google.com/macros/s/VOTRE_SCRIPT_ID/exec',
    DRIVE_FILE_NAME: 'mti_data.json',
    SHEETS_ID: 'VOTRE_SHEETS_ID',
    CALENDAR_ID: 'votre-email@gmail.com',
    GOOGLE_CLIENT_ID: 'VOTRE_CLIENT_ID.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'VOTRE_CLIENT_SECRET',
    GOOGLE_API_KEY: '',
    GOOGLE_SCOPES: 'https://www.googleapis.com/auth/calendar.events'
};

// Fusion avec config.js
const CONFIG = typeof window !== 'undefined' && window.CONFIG 
    ? { ...CONFIG_DEFAULTS, ...window.CONFIG } 
    : CONFIG_DEFAULTS;
```

**Configuration requise** :
1. Copier `config.example.js` → `config.js`
2. Remplir avec les vraies valeurs :
   - `BACKEND_URL` : URL du script Apps Script déployé
   - `CALENDAR_ID` : Email du calendrier Google
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` : Credentials OAuth2 (Google Cloud Console)
3. Ne JAMAIS commiter `config.js` (déjà dans .gitignore)

### 2. Fonction d'initialisation (app.js ligne 4747)

```javascript
document.addEventListener('DOMContentLoaded', async function() {
    // 1. Vérification backend storage
    await callBackend('ensureStorage');
    
    // 2. Chargement données depuis Drive
    await loadFromDrive();
    
    // 3. Initialisation UI
    initApp();
});
```

**Ordre critique** :
1. Backend vérifié (`ensureStorage`)
2. Données chargées (`loadFromDrive`)
3. UI initialisée (`initApp`)

---

## 📊 Structures de Données

### Clients (app.js ligne 271)

```javascript
{
    name: "Nom Client",
    siret: "123 456 789 00012",
    address: "123 Rue...",
    postalCode: "59000",
    city: "Lille",
    email_facturation: "client@example.com",
    phone: "06 12 34 56 78"
}
```

### Factures (app.js ligne 279)

```javascript
{
    number: "2024-001",
    client: "Nom Client",
    clientSiret: "...",
    clientAddress: "...",
    date: "2024-11-25",
    dueDate: "2024-12-25",
    items: [                        // ⚠️ NOUVEAU v2.0 : Multi-lignes
        {
            description: "Prestation conseil",
            quantity: 1,
            unitPrice: 500,
            total: 500
        }
    ],
    // Legacy fields (backward compatibility)
    description: "",
    quantity: 0,
    unitPrice: 0,
    total: 1500,
    status: "Envoyée",              // "Brouillon", "Envoyée", "Payée", "Retard"
    montantRecu: 0,
    dateReception: ""
}
```

### Paramètres Fiscaux (app.js ligne 343)

```javascript
taxSettings = {
    tauxIS: 0,
    versementLiberatoire: 2.2,      // %
    prorationMensuelle: 8.33,       // CFE mensuelle
    cfeAnnuel: 600,                 // €/an
    acreActif: 11.6,                // % charges sociales avec ACRE
    acreInactif: 24.6,              // % charges sociales sans ACRE
    irppBareme: [                   // ⚠️ NOUVEAU v2.0 : Barème progressif
        { min: 0, max: 11497, taux: 0 },
        { min: 11498, max: 29315, taux: 11 },
        { min: 29316, max: 83823, taux: 30 },
        { min: 83824, max: 180294, taux: 41 },
        { min: 180295, max: Infinity, taux: 45 }
    ],
    bncAbattement: 34               // % abattement BNC
}
```

### Informations Entreprise (app.js ligne 318)

```javascript
companyInfo = {
    name: 'MTI CONSULTING',
    logoUrl: 'data:image/png;base64,...',  // ou URL
    siret: '...',
    address: '...',
    postalCode: '...',
    city: '...',
    email: 'mticonsulting59@gmail.com',
    phone: '07 77 37 17 39',
    iban: 'FR76...',                // ⚠️ NOUVEAU v2.0 : Remplace RIB
    bic: 'ABCDEFGHXXX'              // ⚠️ NOUVEAU v2.0
}
```

---

## 🔌 API Backend (Google Apps Script)

### Endpoints disponibles

#### 1. `ensureStorage`
Vérifie/crée le fichier `mti_data.json` sur Drive.

**Request** :
```json
{ "action": "ensureStorage" }
```

**Response** :
```json
{
    "success": true,
    "data": {
        "fileId": "abc123...",
        "fileName": "mti_data.json"
    }
}
```

#### 2. `loadData`
Charge les données depuis Drive.

**Request** :
```json
{ "action": "loadData" }
```

**Response** :
```json
{
    "success": true,
    "data": {
        "clients": [...],
        "invoices": [...],
        "tasks": [...],
        "companyInfo": {...},
        "taxSettings": {...}
    }
}
```

#### 3. `saveData`
Sauvegarde les données sur Drive.

**Request** :
```json
{
    "action": "saveData",
    "data": {
        "clients": [...],
        "invoices": [...],
        "tasks": [...],
        "companyInfo": {...},
        "taxSettings": {...}
    }
}
```

**Response** :
```json
{
    "success": true,
    "message": "Data saved successfully"
}
```

#### 4. `savePdfToDrive`
Sauvegarde un PDF dans un dossier Drive.

**Request** :
```json
{
    "action": "savePdfToDrive",
    "pdfBase64": "JVBERi0xLjQ...",
    "pdfFilename": "Facture_2024-001.pdf",
    "folderName": "Factures"
}
```

**Response** :
```json
{
    "success": true,
    "data": {
        "fileId": "xyz789...",
        "fileUrl": "https://drive.google.com/file/d/xyz789..."
    }
}
```

#### 5. Calendar Events (Google Calendar API)
- `listEvents` : Liste événements
- `createEvent` : Créer événement
- `updateEvent` : Modifier événement
- `deleteEvent` : Supprimer événement

---

## 🎨 Génération PDF

### Pipeline (app.js lignes 4100-4300)

```
Invoice Data → buildInvoiceHtml() → HTML String
                        ↓
               renderInvoicePreview() → DOM Element
                        ↓
                  html2canvas() → Canvas
                        ↓
                    jsPDF.addImage() → PDF Base64
                        ↓
              savePdfToDrive() → Google Drive
```

### Spécifications PDF
- **Format** : A4 portrait
- **Dimensions** : 794px × 1123px (scale 2.0)
- **DPI** : 96 (standard web)
- **Logo** : 180×90px en haut à gauche
- **Adresse client** : Positionnée pour enveloppes à fenêtre
- **Footer** : IBAN + BIC, mentions légales micro-entreprise

### Fonction clé : `buildInvoiceHtml()` (ligne 4168)

```javascript
function buildInvoiceHtml({clientName, clientAddress, invoiceNumber, 
                           invoiceDate, dueDate, items, ...}) {
    // Support multi-lignes (v2.0) ou legacy single-line
    const invoiceItems = items && items.length > 0 ? items : [
        { description, quantity, unitPrice, total }
    ];
    
    const totalHT = invoiceItems.reduce((sum, item) => sum + item.total, 0);
    const tva = tvaEnabled ? totalHT * 0.20 : 0;
    const totalTTC = totalHT + tva;
    
    return `<!DOCTYPE html>
        <html>
        <head>
            <style>/* styles PDF */</style>
        </head>
        <body>
            <!-- Logo, en-têtes, tableau items, totaux, footer -->
        </body>
        </html>`;
}
```

**⚠️ Important** : Le HTML retourné doit être valide et autonome (styles inline).

---

## 🧮 Calculateur IRPP Progressif (Nouveau v2.0)

### Fonctions principales (app.js lignes 385-455)

#### 1. `calculateIRPPProgressif(revenuImposable, bareme)`
Calcule l'impôt selon le barème progressif par tranches.

```javascript
function calculateIRPPProgressif(revenuImposable, bareme = null) {
    if (!bareme) bareme = taxSettings.irppBareme;
    
    let impot = 0;
    for (let tranche of bareme) {
        if (revenuImposable <= tranche.min) break;
        
        const trancheMax = Math.min(revenuImposable, tranche.max);
        const montantTranche = trancheMax - tranche.min + 1;
        impot += montantTranche * (tranche.taux / 100);
        
        if (revenuImposable <= tranche.max) break;
    }
    
    return Math.max(0, impot);
}
```

#### 2. `calculateBNCRevenuImposable(caAnnuel, abattement)`
Calcule le revenu imposable après abattement BNC (34%).

```javascript
function calculateBNCRevenuImposable(caAnnuel, abattement = 34) {
    return caAnnuel * (1 - abattement / 100);
}
```

#### 3. `compareImpots(caAnnuel)`
Compare versement libératoire vs IRPP progressif.

```javascript
function compareImpots(caAnnuel) {
    const versementLib = caAnnuel * (taxSettings.versementLiberatoire / 100);
    
    const revenuImposable = calculateBNCRevenuImposable(caAnnuel);
    const irppProgressif = calculateIRPPProgressif(revenuImposable);
    
    return {
        versementLib,
        irppProgressif,
        revenuImposable,
        difference: versementLib - irppProgressif,
        meilleurChoix: versementLib > irppProgressif ? 'progressif' : 'versementLib',
        economie: Math.abs(versementLib - irppProgressif)
    };
}
```

### UI Barème éditable (app.js lignes 3440-3540)

L'utilisateur peut modifier les tranches IRPP dans Paramètres :
- `renderIRPPBareme()` : Affiche les tranches
- `updateIRPPTranche(index, field, value)` : Met à jour une tranche
- `addIRPPTranche()` : Ajoute une tranche
- `removeIRPPTranche(index)` : Supprime une tranche
- `resetIRPPBareme()` : Réinitialise au barème officiel 2025

---

## 📅 Intégration Google Calendar

### FullCalendar Configuration (app.js lignes 3800-4000)

```javascript
const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    locale: 'fr',
    firstDay: 1,                    // Lundi
    slotMinTime: '08:00:00',
    slotMaxTime: '20:00:00',
    headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    eventSources: [{
        events: fetchCalendarEvents,
        color: '#21808d'
    }],
    editable: true,
    selectable: true,
    select: handleDateSelect,       // Créer événement
    eventClick: handleEventClick,   // Modifier événement
    eventDrop: handleEventDrop,     // Déplacer événement
    eventResize: handleEventResize  // Redimensionner événement
});
```

### OAuth2 Flow (Google Identity Services)

```javascript
// Initialisation GIS
google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: CONFIG.GOOGLE_SCOPES,
    callback: (tokenResponse) => {
        accessToken = tokenResponse.access_token;
        calendar.refetchEvents();
    }
});

// Requête avec token
fetch('https://www.googleapis.com/calendar/v3/calendars/.../events', {
    headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    }
});
```

---

## 🔄 Flux de Données

### Chargement initial

```
1. DOMContentLoaded
   ↓
2. callBackend('ensureStorage')    → Vérifie Drive
   ↓
3. loadFromDrive()                 → Charge mti_data.json
   ↓
4. localStorage.setItem(...)       → Cache local
   ↓
5. initApp()                       → Render UI
   ↓
6. renderIRPPBareme()              → Affiche barème IRPP
   ↓
7. calculateTaxes()                → Calculs fiscaux
```

### Sauvegarde automatique

```
User action (create/edit/delete)
   ↓
Update in-memory arrays (clients[], invoices[], ...)
   ↓
saveToDrive()
   ↓
callBackend('saveData', { data: ... })
   ↓
Google Drive updated (mti_data.json)
   ↓
localStorage.setItem(...)          → Sync cache local
```

---

## 🚨 Points d'Attention / Bugs Connus

### 1. ⚠️ CORS et Backend
**Problème** : Requêtes POST vers Apps Script peuvent échouer selon CORS browser.

**Solution actuelle** :
- Envoi `body` en JSON string sans `Content-Type: application/json`
- Fallback JSONP si POST échoue (ligne 25-60)

**Code** :
```javascript
const resp = await fetch(CONFIG.BACKEND_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload })
    // Pas de headers pour éviter preflight OPTIONS
});
```

### 2. ⚠️ Multi-lignes Invoice (Nouveau v2.0)
**Problème** : Backward compatibility avec factures anciennes (single-line).

**Solution** :
```javascript
// buildInvoiceHtml supporte les deux formats
const invoiceItems = items && items.length > 0 ? items : [
    { description, quantity, unitPrice, total }
];
```

**Migration** : Factures existantes sans `items[]` afficheront les anciens champs `description`, `quantity`, `unitPrice`.

### 3. ⚠️ Validation PDF
**Problème** : Utilisateur pouvait générer PDF avec facture vide (v1.0).

**Solution v2.0** : Validation stricte (ligne 4390-4430)
```javascript
// Vérifications avant génération PDF
if (!invoice.client || invoice.client.trim() === '') {
    alert('❌ Veuillez renseigner le nom du client');
    return;
}
if (!invoice.items || invoice.items.length === 0) {
    alert('❌ Veuillez ajouter au moins une ligne de facturation');
    return;
}
// ... autres validations
```

### 4. ⚠️ Barème IRPP non chargé
**Problème** : `taxSettings.irppBareme` undefined au premier chargement.

**Solution** : Fallback vers `defaultSettings.irppBareme` (ligne 398-402)
```javascript
if (!bareme || !Array.isArray(bareme) || bareme.length === 0) {
    bareme = defaultSettings.irppBareme;
}
```

---

## 🧪 Tests et Debugging

### Console Logs
- `console.log('🚀 Initialisation MTI CONSULTING v2.0...')` (ligne 4747)
- `console.debug('Calling backend:', CONFIG.BACKEND_URL, body)` (ligne 25)
- `console.error('Backend error:', errMsg)` (ligne 42)

### Outils de Test
- **Test Backend** : Bouton dans Paramètres → Appelle `testBackend()`
- **Preview Facture** : Modal avant génération PDF
- **Console Browser (F12)** : Voir erreurs CORS, API, etc.

### Commandes Utiles
```bash
# Serveur local Python
python -m http.server 8000

# Serveur local Node.js
npx serve

# Ouvrir directement
open index.html  # macOS
start index.html # Windows
```

---

## 📦 Dépendances Externes (CDN)

Chargées dans `index.html` (lignes 1420-1476) :

```html
<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<!-- jsPDF + html2canvas -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>

<!-- FullCalendar -->
<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/locales/fr.js"></script>

<!-- Google Identity Services -->
<script src="https://accounts.google.com/gsi/client"></script>

<!-- App -->
<script src="app.js"></script>
```

**⚠️ Versions figées** : Ne pas mettre à jour sans tests complets.

---

## 🔐 Sécurité

### Credentials exposés
⚠️ **ATTENTION** : `GOOGLE_CLIENT_SECRET` est exposé côté client (ligne 10).

**Recommandations** :
1. Pour usage **personnel/interne** : OK (app non publique)
2. Pour usage **production publique** :
   - Implémenter OAuth2 server-side
   - Ne jamais exposer `CLIENT_SECRET` côté client
   - Utiliser backend Node.js/PHP avec sessions

### CORS et Apps Script
- Script Apps Script doit être déployé en mode **"Tout le monde"** (Anyone)
- URL de déploiement ne doit **pas** être partagée publiquement

---

## 📞 Support et Contact

**Développeur actuel** : MTI CONSULTING  
**Email** : mticonsulting59@gmail.com  
**Repository** : https://github.com/mtcdp59/Factu_MTI_CONSULTING

### Ressources
- Documentation IRPP : `BAREME_IRPP.md`
- README utilisateur : `README.md`
- Conventions code : `.github/copilot-instructions.md`

---

## 🎯 Points d'Extension Futurs

### Améliorations suggérées
1. **PWA** : Service worker pour mode offline
2. **Export comptable** : CSV formaté pour comptable
3. **Multi-devises** : Support EUR, USD, etc.
4. **Quotient familial** : IRPP pour couples/enfants
5. **Historique simulations** : Stockage des calculs fiscaux
6. **Backup automatique** : Export JSON périodique
7. **Notifications** : Relances factures en retard
8. **Dashboard analytics** : Évolution CA, taux de conversion

### Architecture suggérée v3.0
- **Framework** : Migrer vers Vue.js/React (optionnel)
- **Build** : Vite ou Webpack pour optimisation
- **Backend** : Node.js + Express au lieu de Apps Script
- **Database** : PostgreSQL ou MongoDB
- **Auth** : JWT + refresh tokens
- **Tests** : Jest + Cypress

---

**Document généré le** : Novembre 2025  
**Version application** : 2.0  
**Statut** : Production ready

---

## 📋 Checklist Développeur

Avant modification/déploiement :

- [ ] Lire `.github/copilot-instructions.md`
- [ ] Tester en local (serveur HTTP)
- [ ] Vérifier credentials Google (OAuth2)
- [ ] Tester génération PDF multi-lignes
- [ ] Vérifier calculs IRPP (barème 2025)
- [ ] Tester intégration Calendar
- [ ] Valider sauvegarde Drive
- [ ] Vérifier CORS backend
- [ ] Console sans erreurs (F12)
- [ ] Test sur Chrome, Firefox, Safari
- [ ] Backup `mti_data.json` avant modifs

---

**Bon développement ! 🚀**
