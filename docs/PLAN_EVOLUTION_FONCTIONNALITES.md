# 📋 Plan d'Action - Évolutions Fonctionnalités MTI CONSULTING

**Date d'analyse** : 16 décembre 2024  
**Version actuelle** : 2.2.2  
**Base de référence** : Fonctionnalités standards des logiciels de facturation/comptabilité

---

## 🎯 Objectif

Évaluer la couverture fonctionnelle de MTI CONSULTING par rapport aux standards du marché et prioriser les évolutions.

---

## 📊 Matrice de Couverture Fonctionnelle

### Légende
- ✅ **Implémenté** : Fonctionnalité opérationnelle
- 🟡 **Partiel** : Fonctionnalité présente mais incomplète
- ❌ **Manquant** : Fonctionnalité absente
- 🔵 **Prévu** : En cours de développement ou planifié

---

## 1️⃣ FACTURATION

| Fonctionnalité | Statut | Couverture | Priorité | Notes |
|----------------|--------|------------|----------|-------|
| **Création de devis et factures illimités** | ✅ | 100% | - | Factures + Devis multi-lignes opérationnels |
| **Compatible facturation électronique** | ❌ | 0% | 🔴 HAUTE | **Obligatoire 2026** : Chorus Pro, Factur-X, CII |
| **Personnalisation des devis et factures** | 🟡 | 60% | 🟠 MOYENNE | PDF A4 avec logo, mais pas de templates personnalisables |
| **Base de données clients** | ✅ | 100% | - | Enrichissement SIRENE automatique (9 colonnes) |
| **Envoi par email** | ✅ | 100% | - | Gmail API avec PJ PDF |
| **Suivi automatique des paiements** | 🟡 | 50% | 🟠 MOYENNE | Statuts manuels (Brouillon/Envoyée/Payée/Retard) |
| **Acquittement des factures** | 🟡 | 40% | 🟠 MOYENNE | Champs montantRecu + dateReception, mais pas de workflow auto |
| **Factures d'acompte** | ❌ | 0% | 🟢 BASSE | Factures partielles non gérées |
| **Factures d'avoir** | ❌ | 0% | 🟠 MOYENNE | Annulation/Remboursement non implémenté |
| **Conformité et archivage** | 🟡 | 70% | 🔴 HAUTE | Google Drive OK, mais pas de coffre-fort numérique certifié |
| **Rapprochement bancaire** | ❌ | 0% | 🟠 MOYENNE | Import CSV bancaire non disponible |
| **Création et partage lien de paiement** | ❌ | 0% | 🟢 BASSE | Stripe/PayPal non intégré |
| **Signature électronique de devis** | ❌ | 0% | 🟠 MOYENNE | DocuSign/eIDAS non disponible |
| **Relances automatiques d'impayés** | ❌ | 0% | 🟠 MOYENNE | Système de relances programmées absent |

### 📈 Score Facturation : **56% (8/14 fonctionnalités complètes ou partielles)**

---

## 2️⃣ COMPTABILITÉ & PILOTAGE

| Fonctionnalité | Statut | Couverture | Priorité | Notes |
|----------------|--------|------------|----------|-------|
| **Tableau de bord en temps réel** | 🟡 | 50% | 🟠 MOYENNE | KPIs basiques (CA, nb factures), mais pas de graphiques temps réel |
| **Catégorisation automatique des transactions** | ❌ | 0% | 🟠 MOYENNE | Imports bancaires + IA classification absents |
| **Comptabilité sans saisie manuelle** | 🟡 | 30% | 🟠 MOYENNE | Drive stockage OK, mais pas de FEC auto |
| **Auto-détection de la TVA** | ✅ | 100% | - | Calcul TVA 20% intégré |
| **Gestion simplifiée des notes de frais** | ❌ | 0% | 🟢 BASSE | Module dépenses absent |
| **Ajout de justificatifs** | ❌ | 0% | 🟠 MOYENNE | Upload PDF/images non disponible |
| **Gestion indemnités kilométriques et espèces** | ❌ | 0% | 🟢 BASSE | Barème km non implémenté |
| **Application mobile** | ❌ | 0% | 🟢 BASSE | PWA possible mais pas d'app native |
| **Suivi seuil TVA** | 🟡 | 60% | 🟠 MOYENNE | CA visible mais pas d'alertes auto (seuil 37.500€ ou 39.100€) |
| **Suivi seuils sortie régime micro** | 🟡 | 60% | 🟠 MOYENNE | CA BNC visible (seuil 77.700€) mais pas d'alertes |
| **Export documents comptables** | 🟡 | 50% | 🔴 HAUTE | Google Sheets OK, mais pas de FEC certifié |
| **Synchronisation comptes bancaires** | ❌ | 0% | 🔴 HAUTE | Budget Insight/Bridge API absents |
| **Certification et stockage justificatifs** | ❌ | 0% | 🟠 MOYENNE | Coffre-fort numérique absent |

### 📈 Score Comptabilité : **31% (4/13 fonctionnalités complètes ou partielles)**

---

## 🎯 PLAN D'ACTION PRIORISÉ

### 🔴 PRIORITÉ HAUTE (Réglementaire / Impact Business)

#### 1. Facturation Électronique (Deadline : 1er septembre 2026)
**Contexte réglementaire** ([Source officielle Gouv.fr](https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises)) :
- **Obligation légale** : À partir du **1er septembre 2026** pour toutes les entreprises assujetties à la TVA établies en France
- **Double obligation** :
  - **E-invoicing** : Émission et réception de factures électroniques (B2B)
  - **E-reporting** : Transmission des données de transaction à l'administration fiscale
- **Formats acceptés** : Factur-X (hybride PDF/XML EN 16931) ou CII (XML pur)
- **Plateformes** :
  - **Chorus Pro** : Facturation secteur public (déjà obligatoire depuis 2020)
  - **Plateformes agréées** : Prestataires immatriculés par l'administration (liste officielle)
  - **Solutions compatibles** : Logiciels devant se connecter à une plateforme agréée

**Actions** :
- [ ] **Phase 1 : Choix stratégique** (5 jours)
  - Comparer plateformes agréées ([Liste officielle](https://www.impots.gouv.fr/liste-des-plateformes-agreees-immatriculees-sous-reserve))
  - Évaluer coût partenariat vs développement interne
  - Option A : Partenariat plateforme (ex: Chorus Pro, Pennylane, Sellsy)
  - Option B : Développement solution compatible + API plateforme
  
- [ ] **Phase 2 : Conformité format** (20-30 jours)
  - Intégration bibliothèque Factur-X (recommandé : [factur-x Python](https://github.com/invoice-x/factur-x))
  - Génération XML CII conforme EN 16931 (18 champs obligatoires)
  - Validation contre schémas XSD officiels
  - Hybridation PDF existant + couche XML invisible
  
- [ ] **Phase 3 : Connexion plateforme** (15-20 jours)
  - Inscription/immatriculation auprès plateforme agréée
  - Implémentation API REST émission/réception
  - Annuaire facturation électronique (SIRET entreprises)
  - Gestion statuts factures (envoyée, reçue, rejetée)
  
- [ ] **Phase 4 : Tests & Certification** (10-15 jours)
  - Tests bac à sable plateforme
  - Scénarios B2B : Envoi, réception, e-reporting
  - Validation conformité DGFiP
  - Tests avec clients pilotes

**Estimation totale** : 50-70 jours/dev  
**Coût plateforme** : 0-100€/mois selon partenaire (Chorus Pro gratuit pour TPE/PME)  
**Dépendances** : 
- Bibliothèque Factur-X open source
- API plateforme agréée (documentation fournie)
- Annuaire facturation électronique (API publique)
  
**ROI** : 
- ✅ **Conformité légale obligatoire** (pénalités jusqu'à 15€/facture non conforme)
- ✅ Automatisation transmission données fiscales (supprime déclarations manuelles)
- ✅ Accélération délais de paiement (traçabilité temps réel)
- ✅ Réduction fraude TVA (sécurisation transactions)

---

#### 2. Synchronisation Bancaire Automatique
**Besoin métier** :
- Éliminer la saisie manuelle des transactions
- Rapprochement auto factures ↔ virements
- Détection anomalies de trésorerie

**Actions** :
- [ ] Intégration API Budget Insight ou Bridge
- [ ] Import automatique des transactions (CSV/OFX/API)
- [ ] Algorithme de rapprochement auto (montant + date ± 3 jours)
- [ ] Catégorisation intelligente (machine learning simple)
- [ ] Dashboard flux de trésorerie

**Estimation** : 20-30 jours/dev  
**Coût API** : ~50-200€/mois selon volume  
**ROI** : Gain 5-10h/mois de saisie comptable

---

#### 3. Export FEC (Fichier des Écritures Comptables)
**Contexte réglementaire** :
- Obligation pour contrôles fiscaux
- Format normalisé (arrêté 29 juillet 2013)

**Actions** :
- [ ] Génération fichier FEC au format TXT (18 colonnes)
- [ ] Validation structure avec outil DGFIP
- [ ] Export depuis interface Google Sheets
- [ ] Archivage horodaté (10 ans)

**Estimation** : 8-12 jours/dev  
**Dépendances** : Aucune  
**ROI** : Conformité contrôle fiscal

---

### 🟠 PRIORITÉ MOYENNE (Productivité / Confort)

#### 4. Workflow de Relances Automatiques
**Besoin métier** :
- Relance J+7, J+15, J+30 après échéance
- Templates emails personnalisables
- Tracking des relances envoyées

**Actions** :
- [ ] Système de déclencheurs temporels (Google Apps Script Triggers)
- [ ] Templates emails (3 niveaux : courtois, ferme, mise en demeure)
- [ ] Historique des relances dans fiche facture
- [ ] Option "Ne plus relancer" (client régularisé)

**Estimation** : 5-8 jours/dev  
**ROI** : Réduction DSO (Days Sales Outstanding)

---

#### 5. Factures d'Avoir (Annulation/Remboursement)
**Besoin métier** :
- Gestion des retours/annulations
- Régularisation TVA

**Actions** :
- [ ] Bouton "Créer un avoir" depuis facture
- [ ] Copie inverse des lignes (montants négatifs)
- [ ] Numérotation AV-YYYY-NNN
- [ ] Liaison bidirectionnelle facture ↔ avoir
- [ ] PDF avec mention "AVOIR"

**Estimation** : 5-7 jours/dev  
**ROI** : Conformité gestion commerciale

---

#### 6. Signature Électronique de Devis
**Besoin métier** :
- Validation instantanée du client
- Traçabilité juridique

**Options** :
- [ ] **Option A** : Intégration DocuSign (15€/mois)
- [ ] **Option B** : Intégration Yousign (10€/signature)
- [ ] **Option C** : Système interne simple (case à cocher + IP/horodatage)

**Estimation** : 
- Option A/B : 10-15 jours/dev (API)
- Option C : 3-5 jours/dev (simple)

**ROI** : Accélération cycle de vente

---

#### 7. Personnalisation Templates PDF
**Besoin métier** :
- Branding spécifique par client
- Adaptation mise en page

**Actions** :
- [ ] Interface WYSIWYG pour templates
- [ ] Variables dynamiques {{client.name}}, {{invoice.total}}
- [ ] Bibliothèque de templates pré-conçus
- [ ] Upload logos clients (multi-société)

**Estimation** : 12-18 jours/dev  
**Complexité** : Moyenne (jsPDF limitations)

---

#### 8. Module Notes de Frais & Justificatifs
**Besoin métier** :
- Suivi des dépenses professionnelles
- Déduction fiscale optimisée

**Actions** :
- [ ] Formulaire de saisie dépenses (date, montant, catégorie, TVA)
- [ ] Upload justificatifs (PDF/images) → Google Drive
- [ ] Barème kilométrique auto (CV fiscaux)
- [ ] Export comptable des charges
- [ ] Dashboard dépenses par catégorie

**Estimation** : 15-20 jours/dev  
**ROI** : Optimisation fiscale BNC

---

### 🟢 PRIORITÉ BASSE (Nice-to-have)

#### 9. Lien de Paiement en Ligne
**Actions** :
- [ ] Intégration Stripe Checkout
- [ ] Génération lien unique par facture
- [ ] Webhook validation paiement → Statut "Payée"

**Estimation** : 8-12 jours/dev  
**Coût** : Stripe 1,4% + 0,25€/transaction

---

#### 10. Application Mobile (PWA)
**Actions** :
- [ ] Service Worker pour offline
- [ ] Responsive mobile-first
- [ ] Notifications push (relances)
- [ ] Installation écran d'accueil

**Estimation** : 20-30 jours/dev  
**Complexité** : Moyenne

---

#### 11. Factures d'Acompte
**Actions** :
- [ ] Bouton "Générer acompte" (30%, 50%, 100%)
- [ ] Liaison facture acompte → facture solde
- [ ] Calcul auto du solde restant dû

**Estimation** : 5-7 jours/dev

---

## 📊 SYNTHÈSE DES PRIORITÉS

| Priorité | Fonctionnalités | Charge totale | ROI |
|----------|----------------|---------------|-----|
| 🔴 HAUTE | 3 (Factu élec, Sync bancaire, FEC) | 68-102 jours | Conformité + Productivité |
| 🟠 MOYENNE | 5 (Relances, Avoir, Signature, Templates, Notes frais) | 50-75 jours | Productivité + Business |
| 🟢 BASSE | 3 (Paiement en ligne, Mobile, Acompte) | 33-49 jours | Confort |

**Total estimé** : 151-226 jours/dev (6-9 mois à 1 ETP)

---

## 🚀 ROADMAP SUGGÉRÉE (2025-2026)

### Q1 2025 (Janvier - Mars)
- ✅ Finaliser V9 RAM (positionnement fixe) ← **FAIT**
- 🔲 Export FEC (12 jours)
- 🔲 Workflow relances automatiques (8 jours)
- 🔲 Factures d'avoir (7 jours)

**Total Q1** : 27 jours

---

### Q2 2025 (Avril - Juin)
- 🔲 Module Notes de Frais (20 jours)
- 🔲 Signature électronique simple (5 jours)
- 🔲 Templates PDF personnalisables (18 jours)

**Total Q2** : 43 jours

---

### Q3 2025 (Juillet - Septembre)
- 🔲 Synchronisation bancaire API (30 jours)
- 🔲 Dashboard flux de trésorerie (10 jours)

**Total Q3** : 40 jours

---

### Q4 2025 - Q2 2026 (Octobre - Juin)
- 🔲 Facturation électronique - Choix stratégique (5 jours)
- 🔲 Conformité format Factur-X/CII (30 jours)
- 🔲 Connexion plateforme agréée (20 jours)
- 🔲 Tests & validation DGFiP (15 jours)

**Total Q4-Q2** : 70 jours

**Deadline réglementaire** : **1er septembre 2026** (tous les assujettis TVA)
**Pénalités** : Jusqu'à 15€ par facture non conforme (art. 1737 CGI)

---

## 💡 RECOMMANDATIONS STRATÉGIQUES

### 1. Focus Réglementaire
**Priorité absolue** : Facturation électronique avant **1er septembre 2026**
- **Contexte** : Obligation légale pour toutes les entreprises assujetties à la TVA
- **Budget estimé** :
  - Option A (Partenariat plateforme) : 0-100€/mois + 10-20 jours intégration API
  - Option B (Solution interne) : 15-25k€ (dev + certification plateforme compatible)
- **Recommandation** : Option A (partenariat) pour micro-entreprise
- **Plateformes gratuites TPE** : Chorus Pro (public), certaines plateformes agréées
- **Risques** : Pénalités 15€/facture + blocage transactions B2B

### 2. Quick Wins (< 10 jours)
- Export FEC (conformité immédiate)
- Factures d'avoir (gestion commerciale)
- Relances auto (amélioration trésorerie)

### 3. Différenciation Concurrentielle
- Synchronisation bancaire (rare chez micro-logiciels gratuits)
- Calculateur charges BNC temps réel (unique avec API URSSAF)

### 4. Monétisation Possible
- Version gratuite : Fonctionnalités actuelles
- Version Pro (9,90€/mois) : Facturation élec + Sync bancaire + Templates
- Version Enterprise (29,90€/mois) : Multi-société + API + Support prioritaire

---

  - Complexité normative (XML CII EN 16931 - 18 champs obligatoires)
  - Dépendance plateforme agréée (disponibilité, tarifs)
  - Migration format factures existantes (rétroactivité non requise)
  - Gestion rejets/anomalies plateforme
- **Certification** : 
  - Plateforme agréée : Immatriculation DGFiP (gratuit si partenariat)
  - Solution compatible maison : Audit organisme + frais 5-10k€

### Risques Techniques
- **API bancaires** : Coûts récurrents 50-200€/mois
- **Facturation électronique** : Complexité normative (XML CII)
- **Certification** : Audit organisme agréé (2-5k€)

### Dépendances Externes
- Google Apps Script (quotas 6h/jour)
- Gmail API (100 emails/jour)
- Google Sheets (5M cellules max)

### Scalabilité
- Au-delà de 1000 factures/an → Migrer vers PostgreSQL/MySQL
- Multi-utilisateurs → Authentification JWT + permissions

---

## 📚 RESSOURCES COMPLÉMENTAIRES

### Documentation Officielle
- **Facturation électronique** :
  - [Guide officiel Ministère Économie](https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises)
  - [Portail DGFiP - Je passe à la facturation électronique](https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique)
  - [FAQ officielle](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/faq---fe_je-decouvre-la-facturation-electronique.pdf)
  - [Liste plateformes agréées](https://www.impots.gouv.fr/liste-des-plateformes-agreees-immatriculees-sous-reserve)
  - [Annuaire facturation électronique](https://annuaire.facturation-electronique.fr/)

- **Formats et normes** :
  - [Factur-X - FNFE-MPE](https://fnfe-mpe.org/factur-x/)
  - [Norme EN 16931 (CII)](https://ec.europa.eu/cefdigital/wiki/display/CEFDIGITAL/Electronic+invoicing)
  - [Chorus Pro - Portail](https://portail.chorus-pro.gouv.fr/)

- **Comptabilité** :
  - [FEC - Spécifications DGFIP](https://www.economie.gouv.fr/dgfip/fec)
  - [API Budget Insight](https://docs.budget-insight.com/)

### Bibliothèques Open Source
- [factur-x-python](https://github.com/invoice-x/factur-x) (Python)
- [zug-factur-x](https://github.com/ZUGFeRD/mustangproject) (Java)

---

**Dernière mise à jour** : 16 décembre 2024  
**Auteur** : GitHub Copilot  
**Version du document** : 1.0
