# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

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
