# Intégration URSSAF Mon‑entreprise

## ✅ État : COMPLET ET OPÉRATIONNEL

L'application synchronise automatiquement les seuils fiscaux officiels avec l'API URSSAF Mon-entreprise.

---

## 🎯 Objectif

Remplacer les montants en dur des seuils fiscaux par des valeurs officielles chargées via l'API Mon‑entreprise (URSSAF).

---

## 📋 Fonctionnalités implémentées

### 1. **Client API avec gestion erreurs 429**

Fichier : `app.js` (lignes 3888-4120)

**Fonctions principales :**
- `evaluateMonEntreprise(situation, expressions, attempt)` : POST `/api/v1/evaluate`
  - Exponential backoff (1s, 2s, 4s) pour gérer les erreurs 429 (rate limiting)
  - 3 tentatives maximum
  - Fallback silencieux vers valeurs locales en cas d'échec

- `fetchUrssafRule(rule, attempt)` : GET `/api/v1/rules/{rule}`
  - Même stratégie exponential backoff
  - Timeout 3s pour éviter blocages

- `loadFiscalThresholdsFromAPI()` : Fonction principale de synchronisation
  - Cache 24h pour éviter appels répétés
  - Double stratégie : fetch rules direct + evaluate
  - Mise à jour automatique de `taxSettings`
  - **NOUVEAU :** Persistance Drive des seuils mis à jour

- `loadAdditionalFiscalParamsFromAPI()` : Récupération paramètres additionnels
  - Taux versement libératoire
  - Abattement BNC

### 2. **Seuils synchronisés**

| Règle URSSAF | Variable app | Valeur défaut |
|--------------|--------------|---------------|
| `entreprise . franchise de TVA . seuil` | `taxSettings.seuilTVAAnnuel` | 37 500 € |
| `entreprise . franchise de TVA . seuil majoré` | `taxSettings.seuilTVAMajore` | 39 100 € |
| `dirigeant . auto-entrepreneur . seuil micro-BNC` | `taxSettings.caMaxBNC` | 77 700 € |
| `dirigeant . auto-entrepreneur . impôt . versement libératoire . taux` | `taxSettings.versementLiberatoire` | 2,2% |
| `dirigeant . BNC . abattement` | `taxSettings.bncAbattement` | 34% |

### 3. **Initialisation automatique**

```javascript
// Au chargement de la page (DOMContentLoaded)
setTimeout(() => initUrssafIntegration(), 1000); // Délai 1s pour éviter rate limiting
```

**Comportement :**
- Délai de 1 seconde au démarrage pour éviter les erreurs 429
- Timeout global de 5 secondes (l'app continue si API lente)
- Cache 24h : si données fraîches, pas de nouvel appel

### 4. **Bouton de rafraîchissement manuel**

**Emplacement :** Onglet Paramètres → Section "Seuils Fiscaux Annuels"

```html
<button id="refreshFiscalThresholdsBtn">🔄 Actualiser depuis URSSAF</button>
```

**Fonctionnement :**
- Désactive le bouton pendant le chargement
- Affiche "🔄 Rafraîchissement..." pendant l'opération
- Toast de confirmation : succès ✅ ou échec ⚠️
- Fonction exposée : `window.refreshFiscalThresholds()`

### 5. **Synchronisation UI automatique**

**Après chaque mise à jour :**
1. Update `taxSettings` (variables globales)
2. Synchronisation champs HTML Paramètres (`#seuilTVAAnnuel`, `#seuilTVAMajore`, `#caMaxBNC`)
3. Appel `updateAlerts()` pour rafraîchir les alertes TVA/Seuils
4. **NOUVEAU :** Sauvegarde Drive automatique si valeurs changées

### 6. **Persistance Drive**

Les seuils mis à jour sont automatiquement sauvegardés dans Drive via `saveToDrive()` :
- Permet usage offline si cache expiré
- Synchronisation cross-devices
- Historique des valeurs

---

## 🔧 Comportement & UX

### ✅ Points forts

1. **Zero Breaking Change** : Si API indisponible, valeurs locales conservées
2. **Performance optimisée** : Cache 24h + timeouts courts (3-5s)
3. **Rate limiting géré** : Exponential backoff automatique
4. **Transparence utilisateur** : Encadré info + bouton rafraîchissement visible
5. **Résilience** : Triple fallback (cache → API evaluate → API rules → valeurs défaut)

### ⚠️ Limitations connues

1. **Dépendance réseau** : Nécessite connexion internet au premier chargement
2. **Noms de règles** : Si URSSAF renomme les règles Publicodes, fallback vers défauts
3. **Quota API** : Limité à ~100 requêtes/min (mais cache + delays gèrent ça)

---

## 📊 Logs & Debugging

**Console browser :**
```javascript
// Succès
✅ Seuils URSSAF persistés dans Drive

// Warnings (non-bloquants)
⚠️ Rate limited on evaluate, retry after 1000ms
⚠️ URSSAF rule fetch failed [nom_règle]
⚠️ URSSAF init timeout, using local values

// Erreurs silencieuses
URSSAF evaluate error, using local values [Error details]
```

---

## 🚀 Évolutions futures possibles

### 1. **Calculs Auto-entrepreneur complets**

Utiliser `/evaluate` pour calculer :
- Cotisations sociales exactes (URSSAF + CFP)
- Impôt IRPP ou Versement Libératoire
- Revenu net après impôt

**Exemple situation :**
```json
{
  "dirigeant . auto-entrepreneur . chiffre d'affaires": 50000,
  "dirigeant . auto-entrepreneur . activité": "libérale",
  "dirigeant . auto-entrepreneur . ACRE": "oui"
}
```

### 2. **Indicateur de fraîcheur des données**

Afficher dans UI :
```
Dernière mise à jour : Il y a 3 heures (prochaine dans 21h)
```

### 3. **Synchronisation sélective**

Bouton séparé pour :
- Seuils uniquement
- Taux uniquement
- Tout actualiser

---

## 📚 Liens utiles

- **Documentation officielle** : https://mon-entreprise.urssaf.fr/documentation/dirigeant/auto%E2%80%91entrepreneur
- **OpenAPI Spec** : https://mon-entreprise.urssaf.fr/api/v1/openapi.json
- **Dataservice Data.gouv** : https://www.data.gouv.fr/dataservices/api-mon-entreprise/
- **Explorer Publicodes** : https://mon-entreprise.urssaf.fr/documentation/regles

---

## ✅ Checklist implémentation

- [x] Client API avec exponential backoff
- [x] Cache 24h pour éviter appels répétés
- [x] Initialisation auto au démarrage (délai 1s)
- [x] Bouton rafraîchissement manuel dans UI
- [x] Synchronisation champs Paramètres
- [x] Fallback silencieux vers valeurs locales
- [x] Persistance Drive des seuils mis à jour
- [x] Documentation utilisateur (encadré info)
- [x] Gestion erreurs 429 (rate limiting)
- [x] Timeouts pour éviter blocages

**Status : ✅ PRODUCTION READY**
