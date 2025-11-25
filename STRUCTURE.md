# 📁 Structure du Projet MTI CONSULTING

```
Factu_MTI_CONSULTING/
│
├── 📄 index.html                   # Application principale (UI complète)
├── 📄 app.js                       # Logique métier (5165 lignes)
├── 📄 README.md                    # Documentation utilisateur
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
│   └── DEMARRAGE.md               # Guide de démarrage rapide
│
├── 📁 backend/                     # Code backend
│   └── AppScript.js               # Google Apps Script (REST API)
│
├── 📁 scripts/                     # Scripts utilitaires
│   ├── start-server.bat           # Lancement serveur (Windows)
│   └── start-server.ps1           # Lancement serveur (PowerShell)
│
└── 📁 .github/                     # Configuration GitHub
    └── copilot-instructions.md    # Conventions projet (AI)
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
Code backend Google Apps Script :
- **AppScript.js** : API REST pour Drive/Gmail/Calendar

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
  └─> .github/copilot-instructions.md

scripts/start-server.*
  └─> index.html (lance serveur HTTP)
```

## 📊 Statistiques

- **Fichiers principaux** : 2 (index.html + app.js)
- **Lignes de code** : ~6650 (5165 JS + 1485 HTML/CSS)
- **Assets** : 8 fichiers (1 logo + 7 icons)
- **Documentation** : 4 fichiers markdown
- **Backend** : 1 fichier Google Apps Script

## 🚀 Points d'entrée

1. **Utilisateur** : `index.html` (ouvrir dans navigateur)
2. **Développeur** : `docs/FICHE_TECHNIQUE.md`
3. **Quick start** : `docs/DEMARRAGE.md`
4. **Backend** : `backend/AppScript.js` (déployer sur Google Apps Script)

---

**Dernière mise à jour** : Novembre 2025  
**Version** : 2.0
