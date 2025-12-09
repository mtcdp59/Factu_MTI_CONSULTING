# 🧾 MTI CONSULTING - Gestion Freelance

Application web de gestion complète pour micro-entreprise (BNC) avec intégration Google Drive, Gmail et Calendar.

![Version](https://img.shields.io/badge/version-2.1.3-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-production-brightgreen)

## 📋 Fonctionnalités

### 💼 Gestion Clients
- ✅ Création et modification de fiches clients
- ✅ **Enrichissement SIRENE automatique** : API INSEE pour auto-complétion (v2.1)
  - Code NAF (activité principale)
  - Catégorie juridique (ex: SAS, SASU, SARL)
  - État administratif (Actif/Fermé)
  - Type établissement (Siège social/Établissement)
- ✅ SIRET validé + cache 90 jours
- ✅ Export Google Sheets : 9 colonnes enrichies
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

### 📊 Calculateur de Charges et Impôts (Taux Officiels 2025)
- ✅ **Taux URSSAF vérifiés** : 12,3% (ACRE) / 24,6% (Standard 2025) - Décret n°2024-484
- ✅ **CFP obligatoire** : 0,2% (Code du travail L6331-48)
- ✅ **Période ACRE automatique** : Calcul selon date de début d'activité (Art. L.131-6-4 CSS)
- ✅ **Sélection régime fiscal** : IRPP Progressif ou Versement Libératoire (2,2%)
- ✅ **Vérification éligibilité VL** : RFR ≤ 28,797€/part (seuil 2026)
- ✅ **CFE personnalisée** : API Open Data Soft DGFiP 2024 (34,934 communes) + fallback 14 villes
- ✅ **Tableau détaillé** : 4 colonnes (Poste/Taux/Base/Montant)
- ✅ **Comparaison VL vs IRPP** : Affichage côte à côte avec recommandation
- ✅ **Projection 2025-2029** : Évolution URSSAF +1%/an (→ 28,6%)
- ✅ **Graphique distribution** : Histogramme empilé des charges
- ✅ **Toggle Mensuel/Annuel** : Flexibilité d'affichage
- ✅ **Sauvegarde simulation** : Persistance paramètres dans localStorage
- ✅ **Export PDF** : Simulation complète avec sources légales

### 📅 Agenda Google Calendar
- ✅ **FullCalendar** intégré avec OAuth2
- ✅ Création/Modification/Suppression d'événements
- ✅ Événements toute la journée
- ✅ Modal d'édition avec dates et heures
- ✅ Synchronisation temps réel (auto-refresh 5 min)
- ✅ Vue 8h-20h, semaine du lundi au dimanche

### 🔄 Stockage et Synchronisation
- ✅ **Google Drive API** : Sauvegarde automatique dans `mti_data.json`
- ✅ **Google Apps Script Backend** : REST API pour opérations (clients, factures, RAMs)
- ✅ **Google Sheets Export** : Export automatique RAMs vers onglet dédié
- ✅ Persistance locale (localStorage) + sync cloud
- ✅ Fallback JSONP pour compatibilité CORS
- ✅ Triple-layer : localStorage → Drive → Sheets

### 📧 Envoi de Factures
- ✅ Sauvegarde PDF sur Google Drive (dossier "Factures")
- ✅ Ouverture automatique du PDF depuis Drive
- ✅ Génération email Gmail pré-rempli
- ✅ Corps d'email personnalisé par client

### 📄 Rapports d'Activité Mensuelle (RAM)
- ✅ **Génération calendrier 30 jours** : Interface complète mois/année
- ✅ **Saisie détaillée** : Heures, commentaires, remarques par jour
- ✅ **PDF format professionnel optimisé** : Format A4 portrait identique aux factures
  - Logo MTI CONSULTING 35×18mm
  - Couleurs corporate #21808D (bleu MTI)
  - Weekends grisés automatiquement
  - Tableau optimisé 4 colonnes (Jour/Date/Heures/Commentaires)
  - **Mise en page optimisée** : RAM 31 jours + remarques courtes tient sur 1 page avec visas
  - Tableau adaptatif (taille réduite si remarques présentes)
  - Signature PandaDoc intégrée
- ✅ **Envoi email** : RAM seul ou combiné facture + RAM
- ✅ **Export Google Sheets** : Synchronisation automatique vers onglet RAM
- ✅ **Liaison factures** : Dropdown intelligent filtré par client et période
- ✅ **Prévention doublons** : Contrôle client + mois + année
- ✅ **Gestion CRUD** : Création, lecture, modification, suppression, liste
- ✅ **Persistance données** : Triple-layer (localStorage + Drive + Sheets)

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

**Section 2 : Calculs Fiscaux et Sociaux (Taux Officiels 2025)**
- **Cotisations sociales URSSAF BNC** :
  - Taux avec ACRE Année 1 : 11,6% (Décret n°2024-484)
  - Taux standard 2025 : 24,6% (évolution +1%/an jusqu'en 2029)
- **CFP (Formation Pro)** : 0,2% obligatoire (Code du travail L6331-48)
- **Versement libératoire** : 2,2% (BNC)
- **Conditions VL** : RFR max 28,797€/part (2026), CA max 77,700€ (BNC)
- **CFE annuel** : Personnalisable par commune

**Section 3 : Barème Progressif IRPP 2025**
- Édition des tranches (Min/Max/Taux)
- Ajout/Suppression de tranches
- Réinitialisation au barème officiel 2025
- Abattement BNC : 34% (forfaitaire micro-entreprise)
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

- **Lignes de code** : ~7,266 (app.js) + ~1,830 (index.html) + ~1,080 (backend)
- **Fonctionnalités** : 45+
- **API intégrées** : Google Drive, Gmail, Calendar, Sheets
- **Format de données** : JSON + Google Sheets
- **Architecture** : Frontend vanilla JS + Google Apps Script backend (v42 style)
- **Compatibilité** : Navigateurs modernes (ES6+)
- **Déploiement** : GitHub Pages (gratuit)
- **Sources légales** : URSSAF, Legifrance, service-public.gouv.fr (taux officiels 2025)

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
- [service-public.gouv.fr](https://www.service-public.gouv.fr/) pour le barème IRPP officiel 2025
- [URSSAF](https://www.autoentrepreneur.urssaf.fr/) pour les taux de cotisations 2025 (Décret n°2024-484)
- [Legifrance](https://www.legifrance.gouv.fr/) pour le Code du travail (Art. L6331-48 CFP) et CSS (Art. L.131-6-4 ACRE)
- Google pour les APIs Drive, Gmail, Calendar, Sheets

## 📅 Changelog

### v2.2 (Décembre 2025) - 🧮 Calculateur Avancé
- ✨ **Calculateur de charges complet** (taux officiels 2025 vérifiés)
  - **Taux URSSAF** : 11,6% (ACRE) / 24,6% (Standard) - Décret n°2024-484
  - **CFP obligatoire** : 0,2% (Code du travail L6331-48)
  - **Période ACRE automatique** : Calcul selon date de début d'activité (Art. L.131-6-4 CSS)
  - **Sélection régime fiscal** : IRPP Progressif ou Versement Libératoire (2,2%)
  - **Vérification éligibilité VL** : RFR ≤ 28,797€/part (seuil 2026)
  - **CFE personnalisée** : Base de données 12 communes (237€ - 2,433€)
- 📊 **Tableau détaillé des charges** : 4 colonnes (Poste/Taux/Base/Montant)
- ⚖️ **Comparaison VL vs IRPP** : Affichage côte à côte avec recommandation automatique
- 📈 **Projection 2025-2029** : Évolution URSSAF +1%/an (24,6% → 28,6%)
- 📊 **Graphique distribution** : Histogramme empilé des charges (URSSAF/CFP/Impôt/CFE/Net)
- 🔄 **Toggle Mensuel/Annuel** : Flexibilité d'affichage
- 💾 **Sauvegarde simulation** : Persistance paramètres dans localStorage
- 📄 **Export PDF** : Simulation complète avec sources légales
- 🔧 Tous les taux modifiables dans Paramètres (mise à jour annuelle simplifiée)

### v2.1 (Décembre 2025) - 📋 Système RAM
- ✨ **Système RAM complet** : Rapports d'Activité Mensuelle
  - Génération PDF A4 format professionnel (logo 35×18mm, #21808D)
  - Envoi email (RAM seul ou facture + RAM combiné)
  - Export Google Sheets automatique
  - Liaison intelligente avec factures
  - Prévention doublons (client + mois + année)
  - CRUD complet avec persistance triple-layer
- 🔧 Chargement images optimisé (fetchImageAsDataUri, évite CORS)
- 🔧 Signature PandaDoc intégrée dans RAMs
- 🐛 Corrections logo, table overflow, variables email

### v2.0 (Novembre 2025) - 🧾 Facturation Multi-lignes
- ✨ **Facturation multi-lignes** : Plusieurs lignes par facture
- ✨ **Barème IRPP progressif 2025** : Éditable + comparaison automatique
- ✨ **Validation PDF** : Empêche les factures vides
- 🔧 IBAN + BIC séparés (remplace RIB)
- 🔧 Bouton Annuler calendrier corrigé
- 🔧 Optimisation refresh calendrier (5 min au lieu de 30s)
- 📊 Calculateur BNC avec abattement 34%
- 🎨 Favicons multi-formats

### v1.0 (Octobre 2025) - 🎉 Version Initiale
- Gestion clients, factures, tâches
- Intégration Google Drive, Gmail, Calendar
- Intégration Google Drive + Calendar
- Génération PDF basique
- Calculateur de charges

---

**Dernière mise à jour** : Décembre 2025  
**Version** : 2.1  
**Statut** : Production
