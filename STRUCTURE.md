# 📁 Structure du Projet MTI CONSULTING

```
Factu_MTI_CONSULTING/
│
├── 📄 index.html                   # Application principale (UI complète - ~1984 lignes)
├── 📄 app.js                       # Logique métier (~8828 lignes)
├── 📄 README.md                    # Documentation utilisateur
├── 📄 STRUCTURE.md                 # Ce fichier
├── 📄 CHANGELOG.md                 # Historique des versions
├── 📄 TAUX_OFFICIELS_2025.md       # Taux fiscaux officiels 2025
├── 📄 .gitignore                   # Fichiers à ignorer par Git
│
├── 📁 assets/                      # Ressources statiques
│   ├── 📁 images/                  # Images du projet
│   │   └── MTI_CONSULTING.png     # Logo entreprise (180×90px)
│   │
│   └── 📁 icons/                   # Favicons multi-formats
│       ├── favicon.svg
│       ├── favicon.ico
│       ├── favicon-96x96.png
│       ├── apple-touch-icon.png
│       ├── web-app-manifest-192x192.png
│       ├── web-app-manifest-512x512.png
│       └── site.webmanifest
│
├── 📁 docs/                        # Documentation technique
│   ├── BAREME_IRPP.md             # Guide calculateur IRPP progressif
│   ├── FICHE_TECHNIQUE.md         # Fiche technique développeur
│   ├── DEMARRAGE.md               # Guide de démarrage rapide
│   ├── DEMARRAGE_GITHUB_PAGES.md  # Déploiement GitHub Pages
│   ├── DEBUG_CORS.md              # Debugging CORS (historique)
│   └── CORS_URGENCE.md            # Solutions CORS (historique)
│
├── 📁 backend/                     # Code backend
│   └── AppScript.js               # Google Apps Script (~1364 lignes, v42 style)
│
├── 📁 scripts/                     # Scripts utilitaires
│   ├── start-server.bat           # Lancement serveur (Windows)
│   └── start-server.ps1           # Lancement serveur (PowerShell)
│
└── 📁 .github/                     # Configuration GitHub
    └── instructions-copilot.md    # Conventions projet (AI agents - français)
```

## 📝 Description des dossiers

### `/` (Racine)
Fichiers principaux de l'application :
- **index.html** : Single Page Application complète
- **app.js** : Toute la logique JavaScript
- **README.md** : Point d'entrée documentation

### `assets/`
Toutes les ressources statiques du projet.

#### `assets/images/`
- Logo entreprise
- Images utilisées dans l'application

#### `assets/icons/`
- Favicons pour tous les navigateurs et appareils
- Manifest PWA

### `docs/`
Documentation complète du projet :
- **BAREME_IRPP.md** : Détails du calculateur fiscal
- **FICHE_TECHNIQUE.md** : Guide développeur
- **DEMARRAGE.md** : Quick start

### `backend/`
Code backend Google Apps Script (v42 style) :
- **AppScript.js** : API REST pour Drive/Gmail/Calendar/Sheets (~1080 lignes)
- Actions : saveData, loadData, savePdfToDrive, sendRAMEmail, exportRAMToSheets, sendInvoiceWithRAM
- Architecture simple : pas de gestion CORS, retours de réponses directs
- Déployé sur Google Apps Script en tant que Web App (accès: Tout le monde)

### `scripts/`
Outils de développement :
- Scripts de lancement serveur local
- Utilitaires maintenance

### `.github/`
Configuration GitHub et CI/CD :
- Instructions pour GitHub Copilot
- Workflows (si ajoutés)

## 🔗 Liens entre fichiers

```
index.html
  ├─> app.js (logique)
  ├─> assets/icons/* (favicons)
  └─> assets/images/MTI_CONSULTING.png (logo)

app.js
  ├─> backend/AppScript.js (API REST)
  └─> assets/images/MTI_CONSULTING.png (fallback logo)

README.md
  ├─> docs/BAREME_IRPP.md
  ├─> docs/FICHE_TECHNIQUE.md
  └─> .github/instructions-copilot.md

scripts/start-server.*
  └─> index.html (lance serveur HTTP)
```

## 📊 Statistiques

- **Fichiers principaux** : 2 (index.html + app.js)
- **Lignes de code** : ~10,812 (8828 JS + 1984 HTML/CSS)
- **Backend** : 1 fichier Google Apps Script (~1364 lignes, v42 style)
- **Assets** : 8+ fichiers (1 logo + 7+ icons)
- **Documentation** : 12+ fichiers markdown
- **Architecture** : Frontend-only (vanilla JS) + Google Apps Script backend
- **Déploiement** : GitHub Pages (production), localhost (dev)

## 🔑 Fonctions clés app.js

### Gestion Clients
- `loadClients()`, `saveClients()` : Persistance localStorage
- `addOrEditClient()`, `deleteClient()` : CRUD clients
- `displayClients()`, `filterClients()` : Affichage et recherche

### Facturation
- `addInvoiceLine()`, `deleteInvoiceLine()` : Lignes de facture
- `generateInvoicePDF()` : Génération PDF A4 avec jsPDF
- `saveInvoice()`, `editInvoice()`, `deleteInvoice()` : CRUD factures
- `displayInvoices()`, `filterInvoices()` : Liste et recherche
- `getCurrentInvoiceForPreview()` : Prévisualisation facture

### RAM (Rapports d'Activité Mensuelle) - v2.1.3
- `generateRAMPDF(ram)` : Génération PDF A4 format professionnel optimisé (visas page 1)
- `saveRAMFromForm()` : Sauvegarde RAM depuis formulaire (onglet RAM)
- `generateRAMFromModal()` : Création RAM depuis modal (onglet Factures)
- `sendRAMEmail(ramId)` : Envoi RAM seul par email
- `sendInvoiceWithRAM(invoiceIndex)` : Envoi combiné facture + RAM
- `exportRAMToSheets(ram)` : Export automatique vers Google Sheets
- `exportRAMsToSheets()`, `importRAMsFromSheets()` : Sync batch RAMs (exposés à window)
- `showRAMPreview(ram)` : Prévisualisation RAM
- `populateRAMInvoiceSelect()` : Dropdown factures intelligent (filtré par client et période)
- `setupRAMFormListeners()` : Auto-update dropdown lors changement client/mois/année
- `editRAM(ramId)`, `deleteRAM(ramId)` : CRUD RAMs (async avec syncToDrive)
- `displayRAMs()` : Affichage liste RAMs avec boutons actions
- `fetchImageAsDataUri(url)` : Helper chargement images sans CORS
- **Structure RAM** : `{ id, client, month, year, monthName, activities[], remarks, invoiceNumber, createdAt, updatedAt }`
- **Duplicate Prevention** : Validation client+mois+année avant création (mode édition via window.editingRAMIndex)
- **PDF Optimisé** : En-tête compact (12/10/8pt), tableau adaptatif, visas sur page 1 (~236mm < 277mm)
- **Triple-layer Storage** : localStorage + Google Drive + Google Sheets

### Calculs Fiscaux
- `calculateSocialCharges(amount)` : URSSAF avec ACRE
- `calculateTaxes(amount)` : IRPP progressif 2025
- `compareIRPPvsVL(ca)` : Comparaison versement libératoire vs progressif
- `calculateBNC(ca)` : Revenu imposable avec abattement 34%

### Google Calendar
- `initGoogleCalendar()` : Initialisation OAuth2
- `loadCalendarEvents()` : Chargement événements
- `createCalendarEvent()`, `updateCalendarEvent()`, `deleteCalendarEvent()` : CRUD

### Backend Sync
- `syncToBackend()` : Sauvegarde Drive automatique
- `callBackend(action, params)` : Wrapper appels backend
- **Actions backend** : saveData, loadData, savePdfToDrive, sendRAMEmail, exportRAMToSheets, sendInvoiceWithRAM

### UI & Charts
- `displayDashboard()` : Graphiques CA et statuts (Chart.js)
- `showToast(message, type)` : Notifications utilisateur
- `showTab(tabName)` : Navigation onglets
- `initApp()` : Initialisation complète (clients, invoices, tasks, rams, calendar)

## 🚀 Points d'entrée

1. **Utilisateur** : `index.html` (ouvrir dans navigateur)
2. **Développeur** : `docs/FICHE_TECHNIQUE.md`
3. **Quick start** : `docs/DEMARRAGE.md`
4. **Backend** : `backend/AppScript.js` (déployer sur Google Apps Script)

---

**Dernière mise à jour** : 10 Décembre 2025  
**Version** : 2.1.3
