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

#### Configuration

L'application est **pré-configurée** avec les credentials Google API de MTI CONSULTING. Elle fonctionne immédiatement sans configuration supplémentaire !

- ✅ Backend Google Apps Script opérationnel
- ✅ Stockage Google Drive activé
- ✅ Google Calendar intégré
- ✅ Toutes les fonctionnalités disponibles

ℹ️ Les credentials sont hardcodés dans `app.js` (v42 style) et peuvent être modifiés dans l'onglet **Paramètres** si besoin.

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

2. **Lancer l'application**
   
   Ouvrir directement `index.html` dans un navigateur, ou utiliser un serveur local :
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js (npx)
   npx serve
   ```
   
   Puis ouvrir http://localhost:8000

3. **Configuration (optionnel)**
   
   L'application est pré-configurée avec les credentials MTI CONSULTING.
   
   Pour utiliser vos propres credentials :
   - Créer un projet Google Apps Script avec `backend/AppScript.js`
   - Déployer en tant que Web App (accès: Tout le monde)
   - Modifier les valeurs dans `app.js` (lignes 4-14) :
   ```javascript
   const CONFIG = {
       BACKEND_URL: 'https://script.google.com/macros/s/VOTRE_SCRIPT_ID/exec',
       GOOGLE_CLIENT_ID: 'VOTRE_CLIENT_ID.apps.googleusercontent.com',
       GOOGLE_CLIENT_SECRET: 'VOTRE_CLIENT_SECRET',
       CALENDAR_ID: 'votre.email@gmail.com'
   };
   ```
   
   **Obtenir les credentials OAuth2 :**
   - [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
   - Créer OAuth 2.0 Client ID (type: Web application)
   - Ajouter les origines autorisées : `http://localhost:8000`, `https://mtcdp59.github.io`
   - Copier Client ID et Client Secret

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

✅ **Architecture sécurisée** :
- Backend Google Apps Script avec authentification Google
- Credentials OAuth2 configurés pour domaines autorisés uniquement
- Données stockées sur Google Drive (authentification requise)
- Pas de serveur tiers à maintenir
- HTTPS natif via GitHub Pages

## 📊 Statistiques du Projet

- **Lignes de code** : ~5300 (app.js) + ~1500 (index.html) + ~850 (backend)
- **Fonctionnalités** : 30+
- **API intégrées** : Google Drive, Gmail, Calendar
- **Format de données** : JSON
- **Architecture** : Frontend vanilla JS + Google Apps Script backend (v42 style)
- **Compatibilité** : Navigateurs modernes (ES6+)
- **Déploiement** : GitHub Pages (gratuit)

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
- SIRET : 994 149 904 00017
- Adresse : 13A rue du Général de Gaulle, 59110 La Madeleine

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
