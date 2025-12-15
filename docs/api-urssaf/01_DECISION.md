# Décision Stratégique - Intégration API URSSAF

**Date:** Décembre 2025  
**Statut:** ✅ **CALCULS DYNAMIQUES IMPLÉMENTÉS**  
**Version:** 1.0.0

---

## 🎯 DÉCISION FINALE

✅ **CALCULS DYNAMIQUES VIA API IMPLÉMENTÉS**

L'utilisateur a demandé l'implémentation des calculs dynamiques malgré la recommandation initiale des taux statiques.

**Raison du changement de décision:**
- ❌ **Erreur identifiée**: L'argument principal contre les calculs dynamiques était la "complexité de l'ACRE dégressif"
- ✅ **Correction**: L'ACRE n'est PAS dégressif depuis la réforme 2020 (exonération 1ère année uniquement)
- ✅ **Simplicité**: La gestion ACRE est finalement simple → Calculs Dynamiques viables

---

## 🎯 DÉCOUVERTE IMPORTANTE

### ✅ CFP Disponible via API

**Correction critique :** Le CFP (0,2%) est **bien calculé** par l'API. Il fallait utiliser l'expression complète :

```javascript
// ✅ CORRECT - Inclut cotisations URSSAF + CFP
"dirigeant . auto-entrepreneur . cotisations et contributions"

// ❌ INCORRECT - Exclut le CFP
"dirigeant . auto-entrepreneur . cotisations et contributions . cotisations"
```

**Résultats validés (CA 50 000 € BNC) :**

| Situation | Cotisations URSSAF | CFP (0,2%) | **TOTAL** | Taux effectif |
|-----------|-------------------|-----------|-----------|---------------|
| **AVEC ACRE** | 6 150 € | 100 € | **6 250 €** | **12,50%** |
| **SANS ACRE** | 12 300 € | 100 € | **12 400 €** | **24,80%** |

---

## 📊 COMPARAISON DES 3 APPROCHES

### Approche A : Taux Statiques (État initial)

**Synchronisation via API `/rules` :**
- ✅ Seuils TVA (37 500 € / 39 100 €)
- ✅ Plafond CA BNC (77 700 €)
- ✅ Taux versement libératoire (2,2%)
- ✅ Abattement fiscal BNC (34%)

**Valeurs en dur (mise à jour 1x/an) :**
- Taux URSSAF + CFP avec ACRE : 12,5%
- Taux URSSAF + CFP sans ACRE : 24,8%
- Jours ouvrés : 218
- Jours congés : 25

**✅ Avantages :**
- ⚡ **Performance** : Calculs instantanés (pas de latence réseau)
- 🔒 **Fiabilité** : Fonctionne offline, pas de dépendance API
- 🎯 **Simplicité** : Code lisible, maintenable, testable
- 📅 **Maintenance minimale** : 1 mise à jour/an (taux stables)
- ✅ **Éprouvée** : Déjà implémentée et fonctionnelle

**❌ Inconvénients :**
- 📝 Nécessite vérification manuelle annuelle des taux URSSAF

**Maintenance annuelle :**
```javascript
// Janvier : Synchronisation automatique des seuils
await loadFiscalThresholdsFromAPI()

// Décembre : Vérification manuelle taux année suivante
// Source : https://www.legifrance.gouv.fr
taxSettings.acreActif = 12.5    // Vérifier si changement
taxSettings.acreInactif = 24.8  // Vérifier si changement
```

**Effort estimé :** ⏱️ 15 minutes/an

---

### Approche B : Calculs Dynamiques 100% API ✅ IMPLÉMENTÉE

**Synchronisation via API `/evaluate` :**
- ✅ **Tout** calculé dynamiquement à chaque simulation
- ✅ Cotisations URSSAF + CFP (12,50% / 24,80%)
- ✅ Montants exacts basés sur CA réel
- ✅ Toujours à jour avec la réglementation officielle
- ✅ **Cache 5 min** pour limiter les appels répétés
- ✅ **Fallback automatique** si API indisponible

**⚠️ CORRECTION IMPORTANTE - ACRE:**
- ❌ **Faux (analyse initiale)**: "ACRE dégressif sur 3 ans (50% → 25% → 10%)"
- ✅ **Vrai (réforme 2020)**: ACRE = exonération 1ère année uniquement (12 mois)
- **Impact**: Argument principal contre calculs dynamiques était invalide → Simplification réelle

**Exemple d'implémentation :**
```javascript
async function calculateCotisations(ca, hasACRE, creationDate) {
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
  
  const response = await evaluateMonEntreprise(situation, [
    "dirigeant . auto-entrepreneur . cotisations et contributions"
  ])
  
  return response.evaluate[0].nodeValue * 12  // EUR/an
}
```

**✅ Avantages :**
- ✅ **Maintenance zéro** : Pas de mise à jour manuelle des taux
- ✅ **Toujours à jour** : Synchronisé avec réglementation URSSAF
- ✅ **Conformité** : Mêmes calculs que le simulateur officiel Mon-entreprise
- ✅ **Précision** : Montants exacts au centime près

**❌ Inconvénients :**
- ⚠️ **Latence réseau** : ~200-500ms par calcul (mitigé par cache)
- ⚠️ **Dépendance API** : Nécessite connexion internet
- ⚠️ **Complexité** : 8+ variables requises pour situation valide
- ⚠️ **Rate limiting** : Risque 429 Too Many Requests (retry logic nécessaire)

**Effort estimé :** ⏱️ 0 minute/an (automatique)

---

### Approche C : Hybride Améliorée (Alternative non implémentée)

**Synchronisation mixte :**
- ✅ Seuils via API `/rules` (comme Approche A)
- ✅ **Uniquement le taux CFP** calculé dynamiquement via `/evaluate`
- ✅ Taux URSSAF restent en dur

**Implémentation :**
```javascript
// Récupérer CFP dynamiquement
const cfpRate = await fetchCFPRateFromAPI()  // 0.2%

// Combiner avec taux URSSAF en dur
const totalRateACRE = 12.3 + cfpRate      // 12.5%
const totalRateNoACRE = 24.6 + cfpRate    // 24.8%
```

**✅ Avantages :**
- ✅ CFP toujours à jour (si URSSAF le modifie)
- ✅ Taux URSSAF simples (en dur, stables)
- ✅ Compromis maintenance/automatisation

**❌ Inconvénients :**
- ⚠️ Complexité ajoutée pour gain marginal
- ⚠️ CFP stable depuis 2022 (dernière mise à jour)
- ⚠️ Dépendance API partielle

**Évaluation :** Complexité non justifiée pour un taux qui change tous les 3+ ans

---

## 🎯 TABLEAU COMPARATIF

| Critère | Taux Statiques | Calculs Dynamiques ✅ | Hybride Améliorée |
|---------|----------------|----------------------|-------------------|
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Fiabilité** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Simplicité code** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Maintenance** | ⭐⭐⭐ (15min/an) | ⭐⭐⭐⭐⭐ (0min/an) | ⭐⭐⭐⭐ (5min/an) |
| **Offline-first** | ⭐⭐⭐⭐⭐ | ❌ | ⭐⭐⭐ |
| **Précision** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Conformité URSSAF** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 📝 RECOMMANDATION INITIALE vs DÉCISION FINALE

### Recommandation initiale : Approche A (Taux Statiques)

**Justification :**
1. Taux URSSAF stables (changent 1x/an maximum)
2. CFP stable depuis 2022
3. Performance critique pour UX fluide
4. Fiabilité maximale (pas de dépendance réseau)
5. ACRE dégressif mieux géré côté application

### ✅ Décision finale : Approche B (Calculs Dynamiques)

**Justification de l'utilisateur :**
1. **Maintenance zéro** prioritaire sur performance
2. Correction erreur ACRE dégressif → Simplification réelle
3. Conformité maximale avec simulateur officiel URSSAF
4. Cache + fallback atténuent problèmes de latence/dépendance

---

## 📚 RÉFÉRENCES

- **API URSSAF :** https://mon-entreprise.urssaf.fr/api/v1/doc/
- **Documentation Publicodes :** https://publi.codes/
- **OpenAPI Spec :** https://mon-entreprise.urssaf.fr/api/v1/openapi.json
- **Décret cotisations AE :** [n° 2022-1529 du 7 décembre 2022](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000046710841)

---

## 🔗 Documents liés

- **Implémentation technique** : [02_IMPLEMENTATION.md](02_IMPLEMENTATION.md)
- **Guide migration** : [03_MIGRATION.md](03_MIGRATION.md)
- **Résumé exécutif** : [05_RESUME.md](05_RESUME.md)
