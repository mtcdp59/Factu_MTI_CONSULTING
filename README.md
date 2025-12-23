
## [22/12/2025] Migration complète MTI CONSULTING : email, backend, sécurité, configuration

### Modifications apportées dans le commit :

- **Email expéditeur** :
  - L’expéditeur affiché dans la prévisualisation d’email est désormais dynamique (frontend/app.js) : le champ utilise la valeur de `companyInfo.email`.
  - Backend (backend/AppScript.js) : tous les envois d’email (factures, RAM, devis, PJ Drive) utilisent `contact@mticonsulting.fr` comme expéditeur (CONFIG.EMAIL_FROM et companyInfo.email).
  - Correction de l’ancien affichage statique et des envois depuis l’ancien compte.

- **Configuration et migration** :
  - Les fichiers de configuration (config.production.js, config.migration.json) sont mis à jour avec les nouveaux identifiants Google, backend URL, spreadsheetId, etc.
  - La documentation migration (config.migration.json) détaille les nouveaux IDs et endpoints.

- **Sécurité** :
  - Les identifiants OAuth Google sont présents en dur dans le code (frontend et backend). GitHub Push Protection a été utilisé pour autoriser le commit.
  - Il est recommandé d’externaliser ces secrets ou de protéger le dépôt.

- **Backend Apps Script** :
  - Tous les workflows email (sendEmail, sendRAMEmail, sendEmailWithDriveFile, sendInvoiceWithRAM) utilisent le nouvel expéditeur.
  - Contrôle des doublons PDF sur Drive, suppression automatique avant upload.
  - Ajout de la prévisualisation Drive pour les PDF générés.
  - Amélioration de la robustesse des fonctions d’export/import (vérification des paramètres, gestion des erreurs).

- **Frontend** :
  - La fonction `showEmailPreview` met à jour dynamiquement le champ expéditeur dans la modale d’envoi d’email.
  - Le workflow Devis/RAM/Facture est unifié pour stockage Drive et preview.

- **Scripts et tâches VS Code** :
  - Ajout d’un fichier tasks.json pour lancer un serveur local avec live-server.


### Utilisation :

- L’expéditeur affiché dans la modale d’email est toujours synchronisé avec la configuration société (modifiable dans l’app ou Drive).
- Tous les emails envoyés par l’application (factures, RAM, devis) proviennent de contact@mticonsulting.fr.
- Les PDF générés sont stockés sur Drive, avec contrôle des doublons et lien de prévisualisation.
- La configuration (backend, spreadsheet, OAuth) est centralisée et documentée dans config.production.js et config.migration.json.

### Sécurité :

- Les identifiants OAuth Google sont présents dans le code : pensez à les externaliser ou à activer la protection GitHub.
- La migration backend/Drive/Sheets est documentée dans config.migration.json.

### Maintenance :

- Pour changer l’expéditeur, modifiez companyInfo.email dans l’app ou le backend.
- Pour migrer le backend, suivez les instructions de config.migration.json et DEPLOY_BACKEND.md.

### Fichiers impactés :

- app.js (frontend)
- backend/AppScript.js (backend)
- config.production.js, config.migration.json (configuration)

- .vscode/tasks.json (tâches VS Code)
# 🧾 MTI CONSULTING - Gestion Freelance

Application web de gestion complète pour micro-entreprise (BNC) avec intégration Google Drive, Gmail et Calendar.

![Version](https://img.shields.io/badge/version-2.2.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-production-brightgreen)

## Historique des versions

### v2.2.3 (Décembre 2025)

**Harmonisation Devis ↔ Factures**
- Prévisualisation unifiée via iframe (mêmes marges/footer/couleurs)
- Noms de PDF nettoyés (suppression redondances)
- Mentions légales remontées (pas de chevauchement)
- Bouton « 📥 Télécharger » dans la liste Factures
- Sauvegarde Drive → ouverture automatique du `previewUrl`
- Passage auto au statut « Envoyée » après envoi
- Statistiques/KPIs : « Annulée » exclue; compteur CA rafraîchi

**Statuts & Graphiques**
- Badges Devis/Factures unifiés (palette cohérente)
- Graphiques alignés sur couleurs des badges
- Vitrine statuts (debug-only) masquée en prod (`DEBUG_UI_BADGES`)

**Devis – validations strictes PDF**
- Blocage si client/adresse manquants, items vides, total ≤ 0, dates absentes
- Contrôles appliqués depuis la liste et le formulaire

### v2.2.2 (Décembre 2025)

**Mises à jour des informations de contact**
- Mise à jour du numéro de téléphone : 07 56 98 99 59
- Ajout du site web www.mticonsulting.fr dans :
  - Footer des PDF (RAM, Factures, Devis)
  - Signatures emails (factures et devis)
  - Configuration companyInfo (frontend et backend)
- Documentation enrichie avec domaines d'expertise

### v2.2.1 (Décembre 2024)

**Corrections**
- Correction de la persistance des devis après actualisation (backend + localStorage)
- Ajout de `quotes: []` dans la structure `emptyData` du backend Google Apps Script
- Sauvegarde automatique des devis en localStorage comme backup
- Synchronisation localStorage après chargement depuis Drive

**Améliorations**
- Auto-actualisation de la date de validité du devis (+30 jours) lors de la modification de la date d'émission
- Comportement identique aux factures pour une meilleure cohérence UX

### v2.2.0 (Décembre 2024)

**Interface utilisateur**
- Formatage français des montants avec séparateur de milliers (ex: `12 345,67 €`)
- Dropdown client intelligent avec auto-remplissage SIRET et Adresse
- Optimisation du rendu PDF des devis (largeurs de colonnes)

**Calculateur fiscal**
- Interrogation séparée de l'API URSSAF pour les cotisations sociales (12,3%) et la CFP (0,2%)
- Utilisation de règles API distinctes : `cotisations et contributions . cotisations` + `cotisations et contributions . CFP`
- Amélioration de la précision des calculs (suppression des calculs par soustraction)
- Évolutivité automatique en cas de modification des taux légaux

**Documentation**
- Guide complet des Rapports d'Activité Mensuels (RAMs)
- Documentation technique de la synchronisation Google Sheets pour les devis

## 📋 Fonctionnalités

### 💼 Gestion Clients
- Création et modification de fiches clients
- **Enrichissement SIRENE automatique** : API INSEE pour auto-complétion (v2.1)
  - Code NAF (activité principale)
  - Catégorie juridique (ex: SAS, SASU, SARL)
  - État administratif (Actif/Fermé)
  - Type établissement (Siège social/Établissement)
- SIRET validé + cache 90 jours
- Export Google Sheets : 9 colonnes enrichies
- Recherche et filtrage
- Import/Export CSV

### 📝 Gestion Devis
- **Création devis multi-lignes** : Formulaire complet avec numérotation auto (`DEVIS-YYYY-NNN`)
- **Génération PDF professionnelle** : Logo, branding MTI CONSULTING, template optimisé
- **Conversion devis → facture** : 1 clic pour créer facture depuis devis accepté
- **Liaison bidirectionnelle** : Traçabilité complète devis ↔ facture (badges cliquables)
- **4 statuts** : Brouillon, Envoyé, Accepté, Refusé
- **Synchronisation Drive** : Sauvegarde automatique dans `mti_data.json`
- **Synchronisation Sheets** : Import/Export vers Google Sheets (onglet "Devis") - [📖 Guide](docs/SYNCHRONISATION_DEVIS_SHEETS.md)
- **KPIs Dashboard** : Indicateurs temps réel (nombre devis, taux conversion)
- **Recherche & filtrage** : Par numéro ou nom client
- **Dropdown client** : Sélection rapide avec auto-remplissage

### 🧾 Facturation Multi-lignes
- **Facturation multi-lignes** : Plusieurs lignes par facture
- **Badge origine devis** : Lien cliquable vers devis source si facture créée depuis devis
- Numérotation automatique séquentielle
- Génération PDF A4 (794×1123px) avec logo
- Adresse client positionnée pour enveloppes à fenêtre
- Mentions légales micro-entreprise
- **Dropdown client** : Sélection rapide avec auto-remplissage
- IBAN + BIC affichés en footer
- Statuts : Brouillon, Envoyée, Payée, Retard
- Dates d'échéance et suivi des paiements
- **Validation stricte** : Empêche les factures vides

### 📊 Calculateur de Charges et Impôts (Taux Officiels 2025)
- **Calculs dynamiques API URSSAF** : Intégration API Mon-entreprise.urssaf.fr pour taux toujours à jour
- **Taux URSSAF officiels** : 12,3% (ACRE) / 24,6% (Standard 2025) via API - Décret n°2024-484
- **CFP incluse** : 0,2% récupérée via l'API (pas de calcul séparé)
- **Validation rapide** : Bouton "🧪 Tester l'API URSSAF" dans l'onglet Calculs pour afficher les taux ACRE / sans ACRE
- **Cache intelligent** : 5 minutes pour optimiser performances
- **Fallback robuste** : Valeurs locales si API indisponible (12,5% / 24,8%)
- **Période ACRE automatique** : Calcul selon date de début d'activité (Art. L.131-6-4 CSS)
- **Sélection régime fiscal** : IRPP Progressif ou Versement Libératoire (2,2%)
- **Vérification éligibilité VL** : RFR ≤ 28,797€/part (seuil 2026)
- **CFE personnalisée** : API Open Data Soft DGFiP 2024 (34,934 communes) + fallback 14 villes
- **Tableau détaillé** : 4 colonnes (Poste/Taux/Base/Montant)
- **Comparaison VL vs IRPP** : Affichage côte à côte avec recommandation
- **Projection 2025-2029** : Évolution URSSAF +1%/an (→ 28,6%)
- **Graphique distribution** : Histogramme empilé des charges
- **Toggle Mensuel/Annuel** : Flexibilité d'affichage
- **Sauvegarde simulation** : Persistance paramètres dans localStorage
- **Export PDF** : Simulation complète avec sources légales

### 📅 Agenda Google Calendar
- **FullCalendar** intégré avec OAuth2
- Création/Modification/Suppression d'événements
- Événements toute la journée
- Modal d'édition avec dates et heures
- Synchronisation temps réel (auto-refresh 5 min)
- Vue 8h-20h, semaine du lundi au dimanche

### 🔄 Stockage et Synchronisation
- **Google Drive API** : Sauvegarde automatique dans `mti_data.json`
- **Google Apps Script Backend** : REST API pour opérations (clients, factures, RAMs)
- **Google Sheets Export** : Export automatique RAMs vers onglet dédié
- Persistance locale (localStorage) + sync cloud
- Fallback JSONP pour compatibilité CORS
- Triple-layer : localStorage → Drive → Sheets

### 📧 Envoi de Factures
- Sauvegarde PDF sur Google Drive (dossier "Factures")
- Ouverture automatique du PDF depuis Drive
- Génération email Gmail pré-rempli
- Corps d'email personnalisé par client

### 📄 Rapports d'Activité Mensuelle (RAM)
- **Guide complet** : [📖 Documentation RAM](docs/RAM_GUIDE.md)
- **Génération calendrier 30 jours** : Interface complète mois/année
- **Saisie détaillée** : Heures, commentaires, remarques par jour
- **PDF format professionnel optimisé** : Format A4 portrait identique aux factures
  - Logo MTI CONSULTING 35×18mm
  - Couleurs corporate #21808D (bleu MTI)
  - Weekends grisés automatiquement
  - Tableau optimisé 4 colonnes (Jour/Date/Heures/Commentaires)
  - **Mise en page optimisée** : RAM 31 jours + remarques courtes tient sur 1 page avec visas
  - Tableau adaptatif (taille réduite si remarques présentes)
  - Signature PandaDoc intégrée
- **Envoi email** : RAM seul ou combiné facture + RAM
- **Export Google Sheets** : Synchronisation automatique vers onglet RAM
- **Liaison factures** : Dropdown intelligent filtré par client et période
- **Prévention doublons** : Contrôle client + mois + année
- **Gestion CRUD** : Création, lecture, modification, suppression, liste
- **Persistance données** : Triple-layer (localStorage + Drive + Sheets)

## 📚 Documentation utile

- **URSSAF dynamique** : docs/api-urssaf/00_README.md
- **Sync devis ↔ Sheets** : docs/SYNCHRONISATION_DEVIS_SHEETS.md
- **Déploiement backend Apps Script** : DEPLOY_BACKEND.md

## 🚀 Installation

### 🌐 Utilisation directe (GitHub Pages)

**L'application fonctionne directement dans votre navigateur !**

👉 **[Ouvrir l'application](https://mtcdp59.github.io/Factu_MTI_CONSULTING/)**

#### Configuration

L'application est **pré-configurée** avec les credentials Google API de MTI CONSULTING. Elle fonctionne immédiatement sans configuration supplémentaire.

- Backend Google Apps Script opérationnel
- Stockage Google Drive activé
- Google Calendar intégré
- Toutes les fonctionnalités disponibles

Les credentials sont hardcodés dans `app.js` et peuvent être modifiés dans l'onglet **Paramètres** si besoin.

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
  - Taux avec ACRE Année 1 : 12,3% (Décret n°2024-484)
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

### Documentation générale

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

### Documentation API URSSAF - Calculs Dynamiques

**👉 [Documentation complète: docs/api-urssaf/](docs/api-urssaf/00_README.md)**

| Document | Description | Lecture |
|----------|-------------|---------|
| **[00_README.md](docs/api-urssaf/00_README.md)** | 📚 Index et navigation | 5 min |
| **[01_DECISION.md](docs/api-urssaf/01_DECISION.md)** | 📊 Décision stratégique et comparaison | 10 min |
| **[02_IMPLEMENTATION.md](docs/api-urssaf/02_IMPLEMENTATION.md)** | 🔧 Guide technique complet | 30 min |
| **[03_MIGRATION.md](docs/api-urssaf/03_MIGRATION.md)** | 🔄 Guide de migration | 15 min |
| **[04_BUGFIXES.md](docs/api-urssaf/04_BUGFIXES.md)** | 🐛 Historique des corrections | 10 min |
| **[05_RESUME.md](docs/api-urssaf/05_RESUME.md)** | ⚡ Résumé exécutif | 5 min |

**Résumé**: L'application utilise l'API URSSAF Mon-entreprise pour calculer dynamiquement les cotisations sociales (12,50% AVEC ACRE / 24,80% SANS ACRE, CFP inclus). Maintenance automatique, fallback robuste, cache 5 minutes.

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

**Architecture sécurisée** :
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
- Entreprise : Consulting spécialisé en gestion de projets SI, décisionnel et contrôle de gestion
- Consultant expert : Mickaël TOURDOT-IGUEDJETAL
- Domaines d'expertise : Gestion de Projets SI (ERP, SIRH, BI), Pilotage de la Performance, Data governance
- Expérience : 15 ans
- Site web : www.mticonsulting.fr
- Email : contact@mticonsulting.fr
- Téléphone : 07 56 98 99 59
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
### v2.1 (Novembre 2024)

**Système de Rapports d'Activité Mensuelle (RAM)**
- Génération PDF professionnelle (A4, logo MTI CONSULTING, charte graphique)
- Envoi par email (RAM seul ou combiné avec facture)
- Export automatique vers Google Sheets
- Liaison bidirectionnelle avec les factures
- Prévention des doublons (validation client + mois + année)
- Persistance sur triple couche (localStorage + Drive + Sheets)

**Enrichissement clients**
- Intégration API INSEE SIRENE pour auto-complétion
- Récupération automatique : NAF, catégorie juridique, état administratif
- Cache des résultats API (validité 90 jours)
- Export enrichi vers Google Sheets (9 colonnes)

**Corrections techniques**
- Optimisation du chargement d'images (gestion CORS via base64)
- Intégration signature PandaDoc dans les RAMs
- Corrections affichage logo et tableaux

### v2.0 (Octobre 2024)

**Facturation**
- Support multi-lignes (plusieurs prestations par facture)
- Barème IRPP progressif 2025 (éditable et à jour)
- Validation stricte empêchant les factures vides
- Séparation IBAN / BIC (remplacement du RIB unique)

**Calculateur fiscal**
- Implémentation barème progressif avec abattement BNC 34%
- Comparaison automatique Versement Libératoire vs IRPP
- Interface de configuration des taux fiscaux

**Optimisations**
- Intervalle de rafraîchissement du calendrier : 5 minutes (au lieu de 30s)
- Correction bouton d'annulation du calendrier
- Ajout favicons multi-formats

### v1.0 (Septembre 2024)

**Fonctionnalités principales**
- Gestion complète des clients (CRUD, recherche, import/export CSV)
- Facturation simple avec génération PDF
- Gestion des tâches
- Intégration Google Drive (sauvegarde automatique dans `mti_data.json`)
- Intégration Gmail (envoi de factures)
- Intégration Google Calendar (FullCalendar avec OAuth2)
- Intégration Google Drive + Calendar
- Génération PDF basique
- Calculateur de charges

---

**Dernière mise à jour** : Décembre 2025  
**Version** : 2.2.1  
**Statut** : Production
