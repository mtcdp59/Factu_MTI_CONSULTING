# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

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
