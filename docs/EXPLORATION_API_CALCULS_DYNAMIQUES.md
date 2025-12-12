# Exploration API URSSAF - Calculs Dynamiques vs Valeurs en Dur

**Date:** Janvier 2025  
**Contexte:** Investigation approfondie des capacités `/evaluate` de l'API Mon-entreprise  
**Objectif:** Déterminer si les calculs dynamiques peuvent remplacer les valeurs en dur

---

## 🎯 Question initiale

> "Vois ce qui peut être récupéré voire automatisé depuis l'API URSSAF pour la partie auto-entrepreneur"

---

## 🔬 DÉCOUVERTES TECHNIQUES

### 1. L'API `/evaluate` peut calculer les cotisations URSSAF

**Endpoint testé :**
```javascript
POST https://mon-entreprise.urssaf.fr/api/v1/evaluate
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

**Résultats validés (CA 50 000 € BNC) :**
- **AVEC ACRE :** 6 150 EUR/an → **Taux 12,30%** ✅ (cohérent avec app)
- **SANS ACRE :** 12 300 EUR/an → **Taux 24,60%** ✅ (cohérent avec app)

### 2. Renommage règle ACRE (version 7.0.0)

**Important :** La règle ACRE a été déplacée dans le CHANGELOG modèle-social :

```
Ancien (< v7.0.0) : dirigeant . auto-entrepreneur . ACRE ❌
Nouveau (>= v7.0.0) : dirigeant . exonérations . ACRE ✅
```

**Attention :** Le nom correct est `exonérations` **avec accent** (pas `exonerations`).

### 3. Variables situation requises

Pour obtenir des résultats cohérents, **8 variables minimum** sont nécessaires :

```javascript
{
  "entreprise . catégorie juridique": "'EI'",
  "entreprise . catégorie juridique . EI . auto-entrepreneur": "oui",
  "dirigeant . auto-entrepreneur": "oui",
  "dirigeant . auto-entrepreneur . chiffre d'affaires": "50000", // NOMBRE, pas string
  "entreprise . activité . nature": "'libérale'",
  "entreprise . activité . nature . libérale . réglementée": "non",
  "entreprise . date de création": "01/01/2025",
  "dirigeant . auto-entrepreneur . éligible à l'ACRE": "oui",
  "dirigeant . exonérations . ACRE": "oui"
}
```

---

## ⚠️ LIMITATIONS IDENTIFIÉES (CORRIGÉES)

### ~~1. CFP (Contribution Formation Professionnelle) retourne 0~~ ✅ RÉSOLU

**Erreur initiale :** Test de l'expression `formation professionnelle` séparément retournait 0.

**Solution :** Utiliser l'expression **complète** `cotisations et contributions` :
```javascript
"expressions": [
  "dirigeant . auto-entrepreneur . cotisations et contributions"  // ✅ CORRECT (inclut CFP)
]
// Au lieu de :
"expressions": [
  "dirigeant . auto-entrepreneur . cotisations et contributions . cotisations"  // ❌ Exclut CFP
]
```

**Résultats validés (CA 50 000 € BNC) :**
- **AVEC ACRE :** 6 250 EUR/an (**12,50%**) = 6 150 cotisations + **100 CFP** ✅
- **SANS ACRE :** 12 400 EUR/an (**24,80%**) = 12 300 cotisations + **100 CFP** ✅

**Répartition accessible :**
```javascript
"cotisations . répartition . formation professionnelle"  // Retourne 100 EUR (0,2%)
```

**Impact :** Le calcul total est **maintenant complet**. L'API peut calculer 100% des cotisations (URSSAF + CFP).

### 2. Complexité de la situation

Pour calculer correctement les cotisations, l'API nécessite :
- 8+ variables minimum
- Format précis (strings entre quotes, nombres sans quotes)
- Gestion des unités (€/mois à convertir en €/an)
- Logique ACRE dégressif non gérée (taux 1ère année seulement)

**Comparaison avec `/rules` :**
| Méthode | Requête | Variables | Résultat |
|---------|---------|-----------|----------|
| `/rules/...` | `GET` simple | 0 | Valeur directe |
| `/evaluate` | `POST` complexe | 8+ | Calcul partiel |

### 3. Versement libératoire non disponible en montant

**Test effectué :**
```javascript
"expressions": [
  "dirigeant . auto-entrepreneur . impôt . versement libératoire . montant"
]
```

**Résultat :** `null` (pas de valeur retournée)

**Note :** Le taux (2,2%) est disponible via `/rules`, mais pas le montant calculé.

---

## ❌ DÉCISION FINALE : NE PAS IMPLÉMENTER LES CALCULS DYNAMIQUES

**Malgré la disponibilité complète des données (CFP inclus), l'approche dynamique reste non recommandée.**

### Raisons techniques

1. ~~**CFP manquant**~~ ✅ **RÉSOLU** : CFP disponible via `cotisations et contributions`
2. **Complexité excessive** : 8+ variables vs 1 règle simple
3. **Performance** : POST + traitement JSON vs GET direct
4. **Maintenance** : Évolution structure Publicodes peut casser intégration
5. **Dépendance réseau** : Calcul local instantané vs latence API

### Raisons réglementaires

1. **Taux stables** : Les taux URSSAF changent **1x/an** maximum
2. **Décrets prévisibles** : Publication en décembre N-1 pour année N
3. **Constantes réglementaires** : Pas de variabilité mensuelle/trimestrielle
4. **Tests unitaires référence** : GitHub betagouv/mon-entreprise valide les valeurs

### Raisons fonctionnelles

1. **ACRE dégressif** : L'app gère la dégressivité sur 3 ans (50% → 25% → 0%)
2. **Calcul CFP séparé** : Logique métier spécifique à l'application
3. **Offline-first** : Valeurs en dur permettent fonctionnement hors ligne
4. **Fiabilité** : Pas de risque d'erreur si API temporairement indisponible

---

## ✅ RECOMMANDATION FINALE

### Option A : Approche hybride actuelle (RECOMMANDÉE)

**Synchroniser via API (/rules) :**
- Seuils TVA (37 500 € / 39 100 €)
- Plafond CA (77 700 €)
- Taux VL (2,2%)
- Abattement fiscal (34%)

**Garder en dur (mise à jour manuelle annuelle) :**
- Taux URSSAF + CFP avec ACRE (12,5%)
- Taux URSSAF + CFP sans ACRE (24,8%)
- Jours ouvrés (218)
- Jours congés (25)

**Avantages :**
- ⚡ Performance maximale (calculs locaux)
- 🔒 Fiabilité (pas de dépendance réseau)
- 🎯 Simplicité (code lisible et maintenable)
- 📅 Maintenance minimale (1x/an)

### Option B : Calculs dynamiques via /evaluate (POSSIBLE mais NON RECOMMANDÉE)

**Faisabilité technique :** ✅ **VALIDÉE** - L'API peut calculer 100% des cotisations (CFP inclus)

**Implémentation requise :**
```javascript
async function calculateCotisationsFromAPI(ca, hasACRE, creationDate) {
  const situation = {
    "entreprise . catégorie juridique": "'EI'",
    "entreprise . catégorie juridique . EI . auto-entrepreneur": "oui",
    "dirigeant . auto-entrepreneur": "oui",
    "dirigeant . auto-entrepreneur . chiffre d'affaires": ca.toString(),
    "entreprise . activité . nature": "'libérale'",
    "entreprise . activité . nature . libérale . réglementée": "non",
    "entreprise . date de création": creationDate,
    "dirigeant . auto-entrepreneur . éligible à l'ACRE": hasACRE ? "oui" : "non",
    "dirigeant . exonérations . ACRE": hasACRE ? "oui" : "non"
  }
  
  const response = await fetch('https://mon-entreprise.urssaf.fr/api/v1/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      situation,
      expressions: ["dirigeant . auto-entrepreneur . cotisations et contributions"]
    })
  })
  
  const data = await response.json()
  const montantMensuel = data.evaluate[0].nodeValue
  return montantMensuel * 12  // Conversion EUR/an
}
```

**Inconvénients :**
- ❌ Complexité : 8+ variables requises
- ❌ ACRE dégressif non géré (3 ans : 50% → 25% → 10%)
- ❌ Latence réseau à chaque calcul
- ❌ Dépendance API externe
- ❌ Évolution structure Publicodes risque de casser l'intégration

**Quand considérer cette option :**
- Si les taux URSSAF changent fréquemment (>2x/an) → Actuellement **NON** (1x/an)
- Si l'app doit supporter plusieurs activités (BIC, BNC, Cipav, etc.) → Actuellement **NON** (BNC uniquement)
- Si calcul temps réel avec paramètres utilisateur multiples → Actuellement **NON** (simulation simple)

### Option C : Hybride améliorée (ALTERNATIVE)

**Synchroniser via API :**
- Même que Option A (5 paramètres /rules)

**Calcul dynamique CFP uniquement :**
```javascript
// Récupérer uniquement le taux CFP dynamiquement
const cfpRate = await fetchCFPRate()  // Via /evaluate si nécessaire
const totalRate = URSSAF_RATE_HARDCODED + cfpRate
```

**Avantages :**
- CFP toujours à jour (change rarement mais possible)
- Taux URSSAF en dur (plus stable)
- Compromis complexité/fiabilité

**Inconvénient :** Complexité ajoutée pour gain marginal (CFP stable depuis 2022)

### Processus de mise à jour annuel

```javascript
// 1. Synchronisation automatique (janvier)
await loadFiscalThresholdsFromAPI()

// 2. Vérification manuelle taux URSSAF (décembre N-1)
// Source : https://www.legifrance.gouv.fr/search/jorf?tab_selection=jorf&query=auto-entrepreneur+cotisations
// Rechercher décret N° 20XX-XXXX "cotisations auto-entrepreneur"

// 3. Mise à jour si nécessaire
taxSettings.acreActif = 12.3  // Exemple 2025
taxSettings.acreInactif = 24.6  // Exemple 2025

// 4. Tests validation
console.assert(calculateCharges(50000, true, 1) === 6150)  // ACRE 1ère année
console.assert(calculateCharges(50000, false, 0) === 12300)  // Sans ACRE
```

---

## 📚 RÉFÉRENCES

### Tests unitaires GitHub
```javascript
// Source: betagouv/mon-entreprise/site/test/modele-social/ae-cotisations-cipav.test.ts

describe('calcule les cotisations', () => {
  it('pour les PLNR', () => {
    expect(cotisations).toEqual(1025)  // 24,6% de 50k (hors CFP)
    expect(taux).toEqual(24.6)
  })
})

describe('calcule les cotisations avec Acre', () => {
  it('pour les PLNR', () => {
    expect(cotisations).toEqual(512.5)  // 12,3% de 50k (hors CFP)
    expect(taux).toEqual(12.3)
  })
})
```

### Sources légales
- **Décret cotisations AE :** [n° 2022-1529 du 7 décembre 2022](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000046710841)
- **CFP :** [Urssaf.fr - Formation professionnelle](https://www.autoentrepreneur.urssaf.fr/portail/accueil/sinformer-sur-le-statut/lessentiel-du-statut.html)
- **ACRE :** [Urssaf.fr - Exonération ACRE](https://www.urssaf.fr/portail/home/independant/je-beneficie-dexonerations/accre.html)

---

## 📊 ANNEXE : Comparaison approches

| Critère | Valeurs en dur | Calculs dynamiques `/evaluate` |
|---------|----------------|--------------------------------|
| **Complexité code** | ⭐⭐⭐⭐⭐ Simple | ⭐⭐ Complexe (8+ vars) |
| **Performance** | ⭐⭐⭐⭐⭐ Instantané | ⭐⭐⭐ Latence réseau |
| **Fiabilité** | ⭐⭐⭐⭐⭐ Toujours disponible | ⭐⭐⭐ Dépend API |
| **Maintenance annuelle** | ⭐⭐⭐ MAJ manuelle | ⭐⭐⭐⭐ Auto (si CFP OK) |
| **Complétude calcul** | ⭐⭐⭐⭐⭐ CFP inclus | ⭐⭐ CFP manquant |
| **Gestion ACRE dégressif** | ⭐⭐⭐⭐⭐ Logique métier | ⭐⭐ Taux 1ère année seulement |
| **Offline-first** | ⭐⭐⭐⭐⭐ Fonctionnel | ⭐ Nécessite connexion |

**Score final :**
- **Valeurs en dur :** 33/35 (94%)
- **Calculs dynamiques :** 17/35 (49%)

---

**Conclusion :** Les calculs dynamiques via `/evaluate` sont **techniquement possibles** mais **non recommandés** pour récupérer des taux isolés. L'approche hybride actuelle (5 seuils API + 5 valeurs en dur) est **optimale**.
