# 🧪 Test v2.5.1 - En direct (localhost)

## 🎯 Objectif
Valider la migration localStorage → IndexedDB en environnement réel.

---

## 📋 Checklist de test

### 1. ✅ Console: Vérifier l'initialisation

Ouvre **DevTools (F12)** → **Console** et copie ce bloc:

```javascript
// 1. Vérifier le démarrage
console.log('=== TEST v2.5.1 ===');

// 2. Vérifier le flag de migration
const migrationFlag = localStorage.getItem('mti_indexeddb_migrated');
console.log('Migration flag:', migrationFlag); // → 'true'

// 3. Lister les clés IndexedDB
await storageManager.keys().then(k => {
    console.log('IndexedDB keys:', k);
    // Doit afficher: ['mti_invoices', 'mti_quotes', 'mti_rams', 'mti_syncLog', 'mti_app_config']
});

// 4. Comparer IndexedDB vs localStorage
const idbKeys = await storageManager.keys();
const lsKeys = Object.keys(localStorage).filter(k => k.startsWith('mti_'));
console.log('IndexedDB keys:', idbKeys.length, 'localStorage keys:', lsKeys.length);
```

### 2. ✅ DevTools: Vérifier IndexedDB

**DevTools → Application tab → IndexedDB**

Vérifier:
- ✅ Database: `MTI_CONSULTING`
- ✅ Store: `mti_data`
- ✅ Keys: 
  - `mti_invoices` (factures)
  - `mti_quotes` (devis)
  - `mti_rams` (rapports)
  - `mti_syncLog` (journal)
  - `mti_app_config` (config)

### 3. ✅ UI: Créer une facture test

**Actions:**
1. Aller à l'onglet **Factures**
2. Cliquer sur **Créer une facture**
3. Remplir:
   - Client: "Test Client"
   - Montant: "100.00"
4. Sauvegarder

**Vérifier en console:**
```javascript
// Charger les factures depuis IndexedDB
const invoices = await storageManager.getItem('mti_invoices');
console.log('Factures en IndexedDB:', invoices.length);

// Vérifier aussi localStorage (backup)
const invoicesLS = JSON.parse(localStorage.getItem('mti_invoices') || '[]');
console.log('Factures en localStorage:', invoicesLS.length);

// Doivent être identiques
console.log('Match?', invoices.length === invoicesLS.length);
```

### 4. ✅ UI: Créer un devis test

**Actions:**
1. Aller à l'onglet **Devis**
2. Cliquer sur **Créer un devis**
3. Remplir:
   - Client: "Test Client 2"
   - Montant: "50.00"
4. Sauvegarder

**Vérifier en console:**
```javascript
const quotes = await storageManager.getItem('mti_quotes');
console.log('Devis en IndexedDB:', quotes.length);
```

### 5. ✅ Sync Log: Vérifier journal

**Actions:**
1. Aller à **Paramètres** → **🔄 Journal de Synchronisation**
2. Vérifier que les logs de:
   - Migration IndexedDB
   - Sauvegarde facture
   - Sauvegarde devis
   sont présents

**En console:**
```javascript
const syncLog = await storageManager.getItem('mti_syncLog');
console.log('Sync log entries:', syncLog.length);
console.log('Last 3 entries:');
syncLog.slice(0, 3).forEach((entry, i) => {
    console.log(`${i+1}. [${entry.status}] ${entry.message}`);
});
```

### 6. ✅ Fallback test: Désactiver IndexedDB

**Actions en console:**
```javascript
// Effacer IndexedDB (simuler dysfonctionnement)
await storageManager.removeItem('mti_invoices');
console.log('IndexedDB vidé');

// Charger les données
const invoicesFromLS = await storageManager.getItem('mti_invoices');
console.log('Récupéré depuis localStorage (fallback):', invoicesFromLS.length);
// → Doit charger depuis localStorage (backup)
```

### 7. ✅ Performance: Comparer vitesses

**Console:**
```javascript
// Test localStorage (ancien)
console.time('localStorage');
const ls = JSON.parse(localStorage.getItem('mti_invoices') || '[]');
console.timeEnd('localStorage');

// Test IndexedDB (nouveau)
console.time('IndexedDB');
const idb = await storageManager.getItem('mti_invoices');
console.timeEnd('IndexedDB');

// IndexedDB devrait être plus rapide ou similaire
```

### 8. ✅ Recharge page

**Actions:**
1. Recharger la page (F5)
2. Attendre 2-3 secondes
3. Vérifier que:
   - Factures toujours chargées ✅
   - Devis toujours visibles ✅
   - Sync log persistant ✅

**En console:**
```javascript
console.log('Page rechargée. Vérification données:');
const inv = await storageManager.getItem('mti_invoices');
const quo = await storageManager.getItem('mti_quotes');
console.log('✅ Factures:', inv.length);
console.log('✅ Devis:', quo.length);
```

---

## 🎯 Résultats attendus

| Test | Résultat attendu | Status |
|------|------------------|--------|
| **Migration flag** | `true` | ⏳ |
| **IndexedDB keys** | 5+ clés | ⏳ |
| **Facture créée** | Visible en IDB et LS | ⏳ |
| **Devis créé** | Visible en IDB et LS | ⏳ |
| **Sync log** | ≥ 10 entrées | ⏳ |
| **Fallback LS** | Fonctionne | ⏳ |
| **Performance** | IDB ≥ 5ms | ⏳ |
| **Persistance reload** | Données sauvées | ⏳ |

---

## ⚠️ Problèmes possibles

### Symptôme 1: "localforage not loaded"
**Cause:** CDN localforage non chargée  
**Solution:**
```javascript
window.localforage !== undefined // Doit être true
```

### Symptôme 2: "IndexedDB vide après création"
**Cause:** Dual-write échoué  
**Solution:**
```javascript
// Vérifier les deux
const idb = await storageManager.getItem('mti_invoices');
const ls = JSON.parse(localStorage.getItem('mti_invoices') || '[]');
console.log('IDB length:', idb?.length, 'LS length:', ls.length);
```

### Symptôme 3: "Error: Cannot await in non-async function"
**Cause:** Fonction parente pas async  
**Solution:** Vérifier que la fonction qui appelle est marquée `async`

---

## ✅ Validation complète

Tous les tests passent ✅ → **v2.5.1 prête pour production**

---

**Date du test:** 2 janvier 2026  
**Version testée:** v2.5.1  
**Commit:** 5612beb
