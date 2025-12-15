# AUDIT TECHNIQUE - API URSSAF (Mon-entreprise)

**Date:** Janvier 2025  
**Contexte:** Analyse exhaustive des capacités d'intégration de l'API publique Mon-entreprise.urssaf.fr  
**Objectif:** Maximiser l'automatisation des paramètres fiscaux BNC auto-entrepreneur

---

## 📋 RÉSUMÉ EXÉCUTIF

L'API Mon-entreprise.urssaf.fr (basée sur le modèle Publicodes) expose **5 paramètres récupérables** pour les auto-entrepreneurs BNC via l'endpoint `/rules`. Les **5 paramètres restants** doivent rester en dur pour des raisons techniques et réglementaires valides.

**Découverte importante :** L'API peut calculer dynamiquement les cotisations URSSAF via `/evaluate`, mais cette approche n'est **pas recommandée** pour récupérer des taux isolés (voir section "Évaluation calculs dynamiques").

**Statut actuel:** ✅ **100% conforme** - Tous les paramètres synchronisables sont intégrés.

---

## 🔍 MÉTHODOLOGIE

### 1. Endpoints API testés
- **Base URL:** `https://mon-entreprise.urssaf.fr/api/v1`
- **GET /rules/{rule}** : Métadonnées d'une règle Publicodes (valeurs fixes)
- **POST /evaluate** : Calcul d'expressions avec situation donnée (calculs dynamiques)

### 2. Périmètre analysé
- Règles sous `dirigeant . auto-entrepreneur`
- Règles sous `dirigeant . exonérations . ACRE` (renommage v7.0.0)
- Règles sous `entreprise . activité . nature . libérale`
- Règles TVA et plafonds de chiffre d'affaires
- Règles fiscales (abattement, versement libératoire)

### 3. Critères de validité
- ✅ **Récupérable** : Valeur exposée via `/rules/{rule}` ET extractible via `rawNode.explanation.valeur`
- 🟡 **Calculable** : Valeur obtenue via `/evaluate` mais nécessitant simulation complète
- ❌ **Non récupérable** : Pas d'endpoint disponible OU logique métier applicative

---

## ✅ PARAMÈTRES RÉCUPÉRABLES VIA /rules (5/10)

### 1. **Seuil TVA Franchise Base (Services)**
- **Règle Publicodes:** `entreprise . activité . service . seuil TVA franchise en base`
- **Valeur 2025:** 37 500 €
- **Utilisation app:** `taxSettings.tva.seuils.services`
- **Statut:** ✅ Synchronisé

### 2. **Seuil TVA Franchise Majoré (Services)**
- **Règle Publicodes:** `entreprise . activité . service . seuil TVA franchise en base majoré`
- **Valeur 2025:** 39 100 €
- **Utilisation app:** `taxSettings.tva.seuils.servicesMajore`
- **Statut:** ✅ Synchronisé

### 3. **Plafond CA Services BNC**
- **Règle Publicodes:** `dirigeant . auto-entrepreneur . plafond chiffre d'affaires service`
- **Valeur 2025:** 77 700 €
- **Utilisation app:** `taxSettings.plafondCA`
- **Statut:** ✅ Synchronisé

### 4. **Taux Versement Libératoire BNC**
- **Règle Publicodes:** `dirigeant . auto-entrepreneur . impôt . versement libératoire . taux . service BNC`
- **Valeur 2025:** 2,2 %
- **Utilisation app:** `taxSettings.versementLiberatoire.bnc`
- **Statut:** ✅ Synchronisé

### 5. **Taux Abattement Fiscal BNC**
- **Règle Publicodes:** `dirigeant . auto-entrepreneur . impôt . revenu imposable . abattement . service BNC`
- **Valeur 2025:** 34 %
- **Utilisation app:** `taxSettings.abattementFiscal.bnc`
- **Statut:** ✅ Synchronisé

---

## 🧪 ÉVALUATION CALCULS DYNAMIQUES (/evaluate)

### Tests effectués
```json
{
  "situation": {
    "entreprise . catégorie juridique": "'EI'",
    "entreprise . catégorie juridique . EI . auto-entrepreneur": "oui",
    "dirigeant . auto-entrepreneur": "oui",
    "dirigeant . auto-entrepreneur . chiffre d'affaires": "50000",
    "entreprise . activité . nature": "'libérale'",
    "entreprise . activité . nature . libérale . réglementée": "non",
    "entreprise . date de création": "01/01/2025",
    "dirigeant . auto-entrepreneur . éligible à l'ACRE": "oui",
    "dirigeant . exonérations . ACRE": "oui"
  },
  "expressions": [
    "dirigeant . auto-entrepreneur . cotisations et contributions . cotisations"
  ]
}
```

### Résultats (CA 50 000 € BNC)
| Situation | Cotisations | CFP | **TOTAL** | Taux app | Cohérence |
|-----------|-------------|-----|-----------|----------|-----------|--------|
| **AVEC ACRE** | 6 150 EUR/an | 100 EUR | **6 250 EUR/an** | 12,5% | ✅ |
| **SANS ACRE** | 12 300 EUR/an | 100 EUR | **12 400 EUR/an** | 24,8% | ✅ |

**Note importante :** Le CFP (0,2%) est **inclus dans la répartition des cotisations**. Il faut utiliser l'expression complète `cotisations et contributions` pour obtenir le total correct.

### ✅ DÉCOUVERTE : Le CFP est bien inclus !

**Correction suite aux tests :** En utilisant l'expression complète `dirigeant . auto-entrepreneur . cotisations et contributions` (au lieu de seulement `cotisations`), le CFP est **bien calculé** !

**Preuves :**
- AVEC ACRE : 6 250 EUR (12,50%) = 6 150 (cotisations) + **100 (CFP 0,2%)**
- SANS ACRE : 12 400 EUR (24,80%) = 12 300 (cotisations) + **100 (CFP 0,2%)**
- Répartition disponible : `cotisations . répartition . formation professionnelle`

### ⚠️ Décision : Utilisation possible mais NON RECOMMANDÉE

**⚠️ CORRECTION IMPORTANTE - ACRE:**

**FAUX (version initiale):** "ACRE dégressif sur 3 ans (50% → 25% → 10%)"
**VRAI (depuis réforme 2020):** ACRE exonération 1ère année uniquement (12 mois)
**Impact:** Argument principal "complexité ACRE" invalide → **Calculs Dynamiques via API désormais viable**

**Note:** Cette section garde l'analyse historique pour référence, mais les Calculs Dynamiques ont été implémentés suite à cette correction.

**Raisons HISTORIQUES contre calculs dynamiques (partiellement obsolètes) :**

1. **Complexité situation** : Nécessite 8+ variables pour calcul correct (vs 1 règle simple `/rules`)
2. ~~**Logique ACRE dégressif**~~ : ❌ **ERREUR CORRIGÉE** - ACRE NON dégressif depuis 2020
3. **Performance** : Requête POST complexe vs GET simple (mitigé par cache 5 min dans implémentation)
4. **Maintenance** : Évolution structure situation Publicodes peut casser intégration
5. **Fiabilité** : Dépendance réseau pour chaque calcul vs calcul local instantané (mitigé par fallback automatique)

**Justification réglementaire :**

Les taux URSSAF (12,5% / 24,8% avec CFP) sont des **constantes réglementaires** fixées par décret annuel, pas des variables dynamiques nécessitant simulation. Mise à jour manuelle 1x/an est plus fiable qu'une dépendance réseau complexe.

**Référence :** Tests API validés (CA 50k EUR)
- PLNR sans ACRE : **12 400 EUR (24,8%)** = 12 300 cotisations + 100 CFP
- PLNR avec ACRE : **6 250 EUR (12,5%)** = 6 150 cotisations + 100 CFP

---

## ❌ PARAMÈTRES NON RÉCUPÉRABLES (5/10)

### 6. **Taux Cotisations URSSAF + CFP (ACRE actif)**
- **Valeur app:** 12,5 % (incluant 0,2% CFP)
- **Statut:** ✅ **DÉSORMAIS CALCULÉ DYNAMIQUEMENT via API**
- **Raisons implémentation:**
  - ✅ Calculable via `/evaluate` avec `cotisations et contributions` (CFP inclus)
  - ✅ ACRE NON dégressif depuis 2020 → Gestion simple (12 mois)
  - ✅ Cache 5 min implémenté → Performance acceptable
  - ✅ Fallback automatique → Fiabilité garantie
- **Source règle:** `dirigeant . auto-entrepreneur . cotisations et contributions`
- **Justification HISTORIQUE (obsolète):** ~~Taux stable annuellement, MAJ manuelle plus simple~~ → Calcul dynamique préféré après correction ACRE

### 7. **Taux Cotisations URSSAF + CFP (ACRE inactif)**
- **Valeur app:** 24,8 % (incluant 0,2% CFP)
- **Statut:** ✅ **DÉSORMAIS CALCULÉ DYNAMIQUEMENT via API**
- **Raisons implémentation:** Idem paramètre 6 (même fonction `calculateCotisationsDynamically()`)
- **Source règle:** `dirigeant . auto-entrepreneur . cotisations et contributions`
- **Justification HISTORIQUE (obsolète):** ~~Constante réglementaire stable~~ → Calcul dynamique préféré


### 8. **CFP BNC (déjà inclus dans paramètres 6-7)**
- **Valeur app:** 0,2 % (inclus dans total)
- **Statut:** ✅ **Récupérable via API** dans répartition cotisations
- **Source règle:** `cotisations . répartition . formation professionnelle`
- **Note:** Le CFP n'est plus un paramètre séparé, il fait partie intégrante du calcul total

### 9. **Nombre de jours ouvrés annuels**
- **Valeur app:** 218 jours
- **Pourquoi non récupérable:**
  - Paramètre métier spécifique à l'application
  - Non présent dans modèle social Publicodes
- **Justification:** Valeur conventionnelle standard

### 10. **Nombre de jours congés annuels**
- **Valeur app:** 25 jours
- **Pourquoi non récupérable:**
  - Idem paramètre 9 (métier application)
- **Justification:** Minimum légal français

---

## 🎯 ACTIONS RECOMMANDÉES

### Maintenance annuelle (janvier)
```javascript
// 1. Synchroniser automatiquement les 5 seuils API
await loadFiscalThresholdsFromAPI()

// 2. Vérifier manuellement taux cotisations URSSAF (sources officielles)
// Décret annuel publié en décembre N-1 pour année N
// - taxSettings.acreActif (12,3% en 2025)
// - taxSettings.acreInactif (24,6% en 2025)  

// 3. Vérifier CFP (stable depuis 2022)
// - taxSettings.cfpBNC (0,2%)
```

### Sources de référence
- **Décret cotisations AE:** [n° 2022-1529 du 7 décembre 2022](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000046710841)
- **Taux CFP:** [Urssaf.fr - Formation professionnelle](https://www.autoentrepreneur.urssaf.fr/portail/accueil/sinformer-sur-le-statut/lessentiel-du-statut.html)
- **Plafonds CA/TVA:** [Service-Public.fr](https://www.service-public.fr/professionnels-entreprises/vosdroits/F23267)
- **Tests unitaires référence:** [ae-cotisations-cipav.test.ts](https://github.com/betagouv/mon-entreprise/blob/main/site/test/modele-social/ae-cotisations-cipav.test.ts)

---

## 🔗 RESSOURCES TECHNIQUES

- **Repository GitHub:** [betagouv/mon-entreprise](https://github.com/betagouv/mon-entreprise)
- **Documentation API:** [mon-entreprise.urssaf.fr/développeur](https://mon-entreprise.urssaf.fr/développeur/bibliothèque-de-calcul)
- **CHANGELOG modèle social:** Renommage ACRE v7.0.0 (`dirigeant . exonérations . ACRE`)

---

## 📊 ANNEXE : Tests validation API

### Test 1 : Règle ACRE (renommage v7.0.0)
```bash
# Ancien nom (FAIL)
GET /rules/dirigeant . auto-entrepreneur . ACRE

# Nom correct (OK)
GET /rules/dirigeant . exonérations . ACRE
```

### Test 2 : Calcul cotisations avec ACRE
```json
// Résultat attendu (CA 50k EUR BNC)
{
  "AVEC ACRE": {
    "cotisations": 6150.00,
    "taux": 12.30
  },
  "SANS ACRE": {
    "cotisations": 12300.00,
    "taux": 24.60
  }
}
```

### Test 3 : Variables situation minimales requises
```javascript
const situationMinimale = {
  "entreprise . catégorie juridique": "'EI'",
  "entreprise . catégorie juridique . EI . auto-entrepreneur": "oui",
  "dirigeant . auto-entrepreneur": "oui",
  "dirigeant . auto-entrepreneur . chiffre d'affaires": "50000",
  "entreprise . activité . nature": "'libérale'",
  "entreprise . activité . nature . libérale . réglementée": "non",
  "entreprise . date de création": "01/01/2025",
  "dirigeant . auto-entrepreneur . éligible à l'ACRE": "oui",
  "dirigeant . exonérations . ACRE": "oui"
}
```

---

**Conclusion:** L'intégration API actuelle est **optimale**. L'endpoint `/evaluate` permet des calculs dynamiques mais n'est **pas adapté** à la récupération de taux isolés. Les 5 paramètres en dur sont justifiés techniquement et réglementairement.
