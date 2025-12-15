# 🐛 Historique des Corrections

**Versions**: v1.0.1 & v1.0.2  
**Date**: Décembre 2025

---

## Version 1.0.1

### Bug #1: Structure réponse API incorrecte

**Symptôme**:
```
⚠️ Invalid API response structure
```

**Cause**:
```javascript
// ❌ FAUX - API ne retourne pas un tableau
const montantMensuel = response.evaluate[0].nodeValue;
```

**Correction**:
```javascript
// ✅ CORRECT - API retourne un objet
const ruleKey = "dirigeant . auto-entrepreneur . cotisations et contributions";
const evaluation = response[ruleKey];
const montantMensuel = evaluation.nodeValue;
```

---

### Bug #2: Ligne corrompue dans calculateTaxes()

**Symptôme**:
```
ReferenceError: updateComparaisonVL_IRPP is not defined
```

**Cause**:
```javascript
// ❌ Ligne corrompue
// Sécurité : initialiser le barème IRPP si absentgify(defaultSettings.irppBareme));
```

**Correction**:
```javascript
// ✅ CORRECT
if (!taxSettings.irppBareme || taxSettings.irppBareme.length === 0) {
    taxSettings.irppBareme = JSON.parse(JSON.stringify(defaultSettings.irppBareme));
}
```

---

## Version 1.0.2

### Bug #3: Format API dual support

**Symptôme**:
```
Invalid API response structure
```

**Cause**: Format API a évolué (objet → tableau)

**Correction**:
```javascript
// Support dual format
const evaluations = data?.evaluate || data?.evaluations || null;

if (Array.isArray(response)) {
    evaluation = response[0];  // New format
} else {
    evaluation = response[ruleKey];  // Old format
}
```

---

### Bug #4: Logs console bruyants

**Symptôme**: Console polluée de warnings avec CA=0

**Correction**:
```javascript
catch (err) {
    if (err.message === 'API response is null') {
        console.log('ℹ️ Calcul local (CA faible ou API indisponible)');
    } else {
        console.warn('⚠️ Échec calcul dynamique:', err.message);
    }
}
```

---

### Bug #5: Alertes seuils absentes du simulateur

**Symptôme**: User avec CA 86k€ ne voit pas alerte dépassement

**Correction**: Ajout zone alerte en haut du simulateur
```html
<div id="seuilsAlert" style="display: none; padding: 16px; ...">
  <!-- Alertes dynamiques -->
</div>
```

Appel dans `finalizeTaxCalculation()`:
```javascript
const seuil = checkSeuils(ca * 12);
if (alertDiv && seuil.alerte) {
    alertDiv.style.display = 'block';
    alertDiv.textContent = seuil.message;
    // Styling selon niveau (danger/warning/info)
}
```

---

## 🎯 Clarifications

### CFP (0,2%)

**Question**: "L'API renvoie 12,5% mais taux affiché est 12,3% ?"

**Réponse**:
```
Taux URSSAF seul    : 12,3%
CFP obligatoire     : +0,2%
─────────────────────────────
Total API           : 12,5% ✅
```

L'API Mon-entreprise **inclut automatiquement le CFP**.

---

## ✅ Tests de validation

| Test | CA | ACRE | Résultat | Statut |
|------|-----|------|----------|--------|
| 1 | 50k€ | OUI | 6 250€ (12,50%) | ✅ |
| 2 | 50k€ | NON | 12 400€ (24,80%) | ✅ |
| 3 | 25k€ | OUI | 3 125€ (12,50%) | ✅ |
| 4 | 72.6k€ | NON | 18 005€ (24,80%) | ✅ |

**Toutes les corrections validées** ✅

---

**Voir aussi**:
- [02_IMPLEMENTATION.md](02_IMPLEMENTATION.md) - Guide technique
- [05_RESUME.md](05_RESUME.md) - Résumé exécutif
