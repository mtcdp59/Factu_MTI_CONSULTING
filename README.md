# 🧾 MTI CONSULTING - Gestion Freelance

Application web de gestion complète pour micro-entreprise (BNC) avec intégration Google Drive, Gmail et Calendar.

![Version](https://img.shields.io/badge/version-2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-production-brightgreen)

## 📋 Fonctionnalités

### 💼 Gestion Clients
- ✅ Création et modification de fiches clients
- ✅ SIRET, adresse, email de facturation
- ✅ Recherche et filtrage
- ✅ Import/Export CSV

### 🧾 Facturation Multi-lignes
- ✅ **Facturation multi-lignes** : Plusieurs lignes par facture
- ✅ Numérotation automatique séquentielle
- ✅ Génération PDF A4 (794×1123px) avec logo
- ✅ Adresse client positionnée pour enveloppes à fenêtre
- ✅ Mentions légales micro-entreprise
- ✅ IBAN + BIC affichés en footer
- ✅ Statuts : Brouillon, Envoyée, Payée, Retard
- ✅ Dates d'échéance et suivi des paiements
- ✅ **Validation stricte** : Empêche les factures vides

### 📊 Calculs Fiscaux et Sociaux
- ✅ **Barème IRPP progressif 2025** (éditable)
- ✅ **Comparaison automatique** : Versement libératoire vs IRPP progressif
- ✅ Calcul BNC avec abattement 34%
- ✅ Charges sociales URSSAF (ACRE actif/inactif)
- ✅ CFE (Cotisation Foncière des Entreprises)
- ✅ Simulateur de CA mensuel
- ✅ Graphiques : CA par mois, répartition par statut

### 📅 Agenda Google Calendar
- ✅ **FullCalendar** intégré avec OAuth2
- ✅ Création/Modification/Suppression d'événements
- ✅ Événements toute la journée
- ✅ Modal d'édition avec dates et heures
- ✅ Synchronisation temps réel (auto-refresh 5 min)
- ✅ Vue 8h-20h, semaine du lundi au dimanche

### 🔄 Stockage et Synchronisation
- ✅ **Google Drive API** : Sauvegarde automatique dans `mti_data.json`
- ✅ **Google Apps Script Backend** : REST API pour opérations
- ✅ Persistance locale (localStorage) + sync cloud
- ✅ Fallback JSONP pour compatibilité CORS

### 📧 Envoi de Factures
- ✅ Sauvegarde PDF sur Google Drive (dossier "Factures")
- ✅ Ouverture automatique du PDF depuis Drive
- ✅ Génération email Gmail pré-rempli
- ✅ Corps d'email personnalisé par client

## 🚀 Installation

### 🌐 Utilisation directe (GitHub Pages)

**L'application fonctionne directement dans votre navigateur !**

👉 **[Ouvrir l'application](https://mtcdp59.github.io/Factu_MTI_CONSULTING/)**

#### **Configuration rapide (3 méthodes)**

**Méthode 1 : Script PowerShell automatique (⚡ Recommandé)**
```powershell
.\scripts\deploy-config.ps1
```
→ Copie automatiquement votre `config.js` local vers GitHub Pages

**Méthode 2 : Interface HTML**
1. Ouvrez `scripts/deploy-config.html` dans votre navigateur
2. Cliquez sur "Charger config.js"
3. Cliquez sur "Déployer la configuration"

**Méthode 3 : Manuelle**
- Suivez le **[Guide de démarrage GitHub Pages](docs/DEMARRAGE_GITHUB_PAGES.md)** (5 minutes)

---

### 💻 Installation locale (développement)

### Prérequis
- Navigateur moderne (Chrome, Firefox, Edge, Safari)
- Compte Google (pour Drive, Gmail, Calendar)

### Étapes

1. **Cloner le repository**
   ```bash
   git clone https://github.com/mtcdp59/Factu_MTI_CONSULTING.git
   cd Factu_MTI_CONSULTING
   ```

2. **Configurer Google Apps Script Backend**
   - Créer un nouveau projet Google Apps Script
   - Copier le code de `backend/AppScript.js`
   - Déployer en tant que Web App
   - Copier l'URL de déploiement

3. **Configurer les identifiants Google (IMPORTANT)**
   
   🔐 **Ne jamais commiter vos secrets !**
   
   a. Copier le fichier de configuration :
   ```bash
   cp config.example.js config.js
   ```
   
   b. Éditer `config.js` avec vos vraies valeurs :
   ```javascript
   const CONFIG = {
       GOOGLE_CLIENT_ID: 'VOTRE_CLIENT_ID.apps.googleusercontent.com',
       GOOGLE_CLIENT_SECRET: 'VOTRE_CLIENT_SECRET',
       BACKEND_URL: 'https://script.google.com/macros/s/VOTRE_SCRIPT_ID/exec'
   };
   ```
   
   c. Obtenir les credentials OAuth2 :
   - Aller sur [Google Cloud Console](https://console.cloud.google.com/)
   - Créer un projet → APIs & Services → Credentials
   - Créer OAuth 2.0 Client ID (type: Web application)
   - Ajouter les origines autorisées : `http://localhost:8000`, `http://127.0.0.1:8000`
   - Copier Client ID et Client Secret dans `config.js`
   
   ⚠️ Le fichier `config.js` est déjà dans `.gitignore` et ne sera pas commité.

4. **Lancer l'application**
   
   Ouvrir directement `index.html` dans un navigateur, ou utiliser un serveur local :
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js (npx)
   npx serve
   ```
   
   Puis ouvrir http://localhost:8000

## ⚙️ Configuration

### Informations Entreprise (Onglet Paramètres)

**Section 1 : Informations Entreprise**
- Logo URL (ou conversion data-URI depuis fichier local)
- SIRET
- Adresse complète
- IBAN professionnel
- BIC / SWIFT

**Section 2 : Calculs Fiscaux et Sociaux**
- Taux IS / IRPP
- Versement libératoire (défaut 2.2%)
- CFE annuel et proration mensuelle
- Cotisations sociales ACRE actif/inactif

**Section 3 : Barème Progressif IRPP**
- Édition des tranches (Min/Max/Taux)
- Ajout/Suppression de tranches
- Réinitialisation au barème officiel 2025
- Source : [service-public.gouv.fr](https://www.service-public.gouv.fr/particuliers/vosdroits/F1419)

**Section 4 : Divers**
- Test de connexion backend
- Diagnostics PDF

### Barème IRPP 2025 (Célibataire - 1 part)

| Tranche | Revenu annuel | Taux |
|---------|---------------|------|
| 1 | 0 - 11 497 € | 0% |
| 2 | 11 498 - 29 315 € | 11% |
| 3 | 29 316 - 83 823 € | 30% |
| 4 | 83 824 - 180 294 € | 41% |
| 5 | > 180 295 € | 45% |

**Abattement BNC** : 34% (micro-entreprise)

## 📖 Documentation

- **[docs/BAREME_IRPP.md](docs/BAREME_IRPP.md)** : Guide complet du calculateur IRPP progressif
  - Exemples de calcul détaillés
  - Comparaison versement libératoire vs progressif
  - Formules et point d'équilibre

- **[docs/FICHE_TECHNIQUE.md](docs/FICHE_TECHNIQUE.md)** : Documentation technique développeur
  - Architecture détaillée
  - API Backend
  - Structures de données
  - Pipeline PDF

- **[docs/DEMARRAGE.md](docs/DEMARRAGE.md)** : Guide de démarrage rapide

- **[STRUCTURE.md](STRUCTURE.md)** : Organisation du projet

- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** : Architecture du projet
  - Patterns de code
  - Conventions
  - Points d'intégration

## 🏗️ Architecture Technique

### Stack
- **Frontend** : Vanilla JavaScript (ES6+), HTML5, CSS3
- **Bibliothèques** :
  - [FullCalendar 6.1.10](https://fullcalendar.io/) : Agenda interactif
  - [jsPDF](https://github.com/parallax/jsPDF) : Génération PDF
  - [html2canvas](https://html2canvas.hertzen.com/) : Capture HTML vers canvas
  - [Chart.js](https://www.chartjs.org/) : Graphiques
  - [Google Identity Services (GIS)](https://developers.google.com/identity/gsi/web) : OAuth2
- **Backend** : Google Apps Script (REST API)
- **Stockage** : Google Drive + localStorage

### Structure des fichiers
```
Factu_MTI_CONSULTING/
├── index.html              # UI principale (single-page app)
├── app.js                  # Logique métier complète
├── README.md               # Ce fichier
├── STRUCTURE.md            # Détails structure projet
├── assets/                 # Ressources statiques
│   ├── images/             # Logo et images
│   └── icons/              # Favicons multi-formats
├── docs/                   # Documentation
│   ├── BAREME_IRPP.md      # Documentation IRPP
│   ├── FICHE_TECHNIQUE.md  # Guide développeur
│   └── DEMARRAGE.md        # Quick start
├── backend/                # Google Apps Script
│   └── AppScript.js        # REST API
├── scripts/                # Scripts utilitaires
│   ├── start-server.bat
│   └── start-server.ps1
└── .github/
    └── copilot-instructions.md
```

### Data Flow
```
UI (index.html) 
  ↕️
app.js (logique métier)
  ↕️
localStorage (cache local)
  ↕️
Google Apps Script Backend (REST API)
  ↕️
Google Drive (persistence cloud)
```

## 🎨 Personnalisation

### Modifier le logo
1. Remplacer `MTI_CONSULTING.png` (recommandé : 180×90px)
2. Ou utiliser l'outil "Convertir en data-URI" dans Paramètres

### Adapter le barème fiscal
1. Aller dans **Paramètres > Section 3**
2. Modifier les tranches (Min/Max/Taux)
3. Cliquer **💾 Enregistrer les paramètres**

### Changer les couleurs
Éditer les CSS custom properties dans `index.html` (lignes 14-42) :
```css
:root {
  --color-primary: rgba(33, 128, 141, 1);
  --color-secondary: rgba(29, 116, 128, 1);
  /* ... */
}
```

## 🐛 Dépannage

### Erreur : "Impossible de contacter le BACKEND"
- Vérifier que `BACKEND_URL` est correct dans `app.js`
- Vérifier que le script Apps Script est déployé en mode "Tout le monde"
- Tester avec le bouton "🧪 Tester BACKEND" dans Paramètres

### PDF ne se génère pas
- Vérifier que jsPDF est chargé (pas de warning rouge dans Paramètres)
- Ouvrir la console (F12) pour voir les erreurs
- Tester avec une facture valide (client + lignes remplies)

### Calendar ne se synchronise pas
- Vérifier les credentials OAuth2 dans `app.js`
- Vérifier que `CALENDAR_ID` correspond à votre email Google
- Autoriser l'accès au calendrier lors de la première connexion

### Facture vide générée
- **CORRIGÉ** : Validation stricte ajoutée (v2.0)
- Le système vérifie maintenant :
  - Nom du client renseigné
  - Au moins une ligne de facturation
  - Descriptions non vides
  - Montant total > 0 €
  - Adresse client renseignée

## 🔒 Sécurité

⚠️ **Important** :
- Ne pas committer les vraies credentials Google dans le repo public
- Utiliser des variables d'environnement ou fichier de config local
- Le `GOOGLE_CLIENT_SECRET` ne doit jamais être exposé côté client en production
- Pour un usage réel, utiliser un backend sécurisé avec gestion OAuth server-side

## 📊 Statistiques du Projet

- **Lignes de code** : ~5200 (app.js) + ~1500 (index.html)
- **Fonctionnalités** : 30+
- **API intégrées** : Google Drive, Gmail, Calendar
- **Format de données** : JSON
- **Compatibilité** : Navigateurs modernes (ES6+)

## 🤝 Contribution

Ce projet est personnel mais les suggestions sont bienvenues :
1. Fork le projet
2. Créer une branche (`git checkout -b feature/amelioration`)
3. Commit les changements (`git commit -m 'Ajout fonctionnalité'`)
4. Push vers la branche (`git push origin feature/amelioration`)
5. Ouvrir une Pull Request

## 📝 Licence

MIT License - Voir LICENSE pour plus de détails

## 👤 Auteur

**MTI CONSULTING**
- Email : mticonsulting59@gmail.com
- Téléphone : 07 77 37 17 39
- SIRET : [Votre SIRET]

## 🙏 Remerciements

- [FullCalendar](https://fullcalendar.io/) pour l'agenda interactif
- [jsPDF](https://github.com/parallax/jsPDF) pour la génération PDF
- [RealFaviconGenerator](https://realfavicongenerator.net/) pour les favicons
- [service-public.gouv.fr](https://www.service-public.gouv.fr/) pour le barème IRPP officiel
- Google pour les APIs Drive, Gmail, Calendar

## 📅 Changelog

### v2.0 (Novembre 2025)
- ✨ **Facturation multi-lignes** : Plusieurs lignes par facture
- ✨ **Barème IRPP progressif 2025** : Éditable + comparaison automatique
- ✨ **Validation PDF** : Empêche les factures vides
- 🔧 IBAN + BIC séparés (remplace RIB)
- 🔧 Bouton Annuler calendrier corrigé
- 🔧 Optimisation refresh calendrier (5 min au lieu de 30s)
- 📊 Calculateur BNC avec abattement 34%
- 🎨 Favicons multi-formats

### v1.0 (Octobre 2025)
- 🎉 Version initiale
- Gestion clients, factures, tâches
- Intégration Google Drive + Calendar
- Génération PDF basique
- Calculateur de charges

---

**Dernière mise à jour** : Novembre 2025  
**Version** : 2.0  
**Statut** : Production
