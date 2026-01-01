# Guide de test - Migration IndexedDB (v2.5.0)

## 🧪 Tests à effectuer

### 1. Vérifier l'initialisation

**Action**: Rafraîchir la page (F5)

**Console attendue**:
```
✅ IndexedDB initialized via localforage
✅ Migrated 7 items from localStorage to IndexedDB
```

**Si déjà migré**:
```
ℹ️ Already migrated to IndexedDB (flag found)
```

---

### 2. Vérifier la base IndexedDB

**Action**: Ouvrir DevTools (F12) → Application tab → IndexedDB

**Vérifier**:
- ✅ Database: `MTI_CONSULTING`
- ✅ Store: `mti_data`
- ✅ Keys: `mti_invoices`, `mti_quotes`, `mti_rams`, `mti_clients`, etc.

**Screenshot**: ![IndexedDB Structure]

---

### 3. Tester le dual-write

**Console**:
```javascript
// Créer une facture test
const testInvoice = {
  number: 'TEST-001',
  date: new Date().toISOString(),
  clientName: 'Client Test',
  amount: 1000
};

// Charger factures existantes
let invoices = await window.loadInvoicesFromStorage();
console.log('Factures avant:', invoices.length);

// Ajouter la facture test
invoices.push(testInvoice);

// Sauvegarder (dual-write)
await window.saveInvoicesToStorage(invoices);

// Vérifier IndexedDB
const fromIndexedDB = await storageManager.getItem('mti_invoices');
console.log('IndexedDB:', fromIndexedDB.length);

// Vérifier localStorage
const fromLocalStorage = JSON.parse(localStorage.getItem('mti_invoices'));
console.log('localStorage:', fromLocalStorage.length);

// → Les deux doivent être identiques ✅
```

---

### 4. Tester le fallback

**Console**:
```javascript
// Supprimer IndexedDB
await storageManager.removeItem('mti_invoices');
console.log('IndexedDB vidé');

// Charger (doit fallback vers localStorage)
const invoices = await window.loadInvoicesFromStorage();
console.log('Chargé depuis localStorage:', invoices.length);

// → Doit charger depuis localStorage ✅
```

---

### 5. Tester la re-migration

**Console**:
```javascript
// Supprimer le flag de migration
localStorage.removeItem('mti_indexeddb_migrated');
console.log('Flag supprimé');

// Recharger la page
location.reload();

// → Console doit afficher:
// ✅ Migrated X items from localStorage to IndexedDB
```

---

### 6. Vérifier les performances

**Console**:
```javascript
// Test localStorage
console.time('localStorage');
const ls = JSON.parse(localStorage.getItem('mti_invoices'));
console.timeEnd('localStorage');

// Test IndexedDB
console.time('IndexedDB');
const idb = await storageManager.getItem('mti_invoices');
console.timeEnd('IndexedDB');

// → Comparer les temps
```

---

## 🐛 Troubleshooting

### Problème 1: localforage not loaded

**Symptôme**:
```
⚠️ localforage not loaded, falling back to localStorage
```

**Solution**:
- Vérifier CDN dans [index.html](../index.html#L2578)
- Vérifier connexion internet
- Ouvrir http://127.0.0.1:8000 (pas file://)

---

### Problème 2: Migration ne se lance pas

**Symptôme**: Aucun log de migration dans console

**Solution**:
```javascript
// Console
localStorage.removeItem('mti_indexeddb_migrated');
location.reload();
```

---

### Problème 3: IndexedDB vide après migration

**Vérifier localStorage**:
```javascript
// Console
console.log('localStorage keys:', Object.keys(localStorage));
console.log('Invoices:', localStorage.getItem('mti_invoices'));
```

**Si localStorage vide aussi**: Normal si première utilisation

---

### Problème 4: Erreur en mode privé

**Symptôme**: IndexedDB disabled in private mode

**Solution**: localforage fallback automatique vers localStorage (aucune action)

---

## ✅ Checklist validation

- [ ] Console affiche "✅ IndexedDB initialized"
- [ ] Console affiche migration ou "Already migrated"
- [ ] DevTools → IndexedDB → Database `MTI_CONSULTING` visible
- [ ] Dual-write fonctionne (test console)
- [ ] Fallback localStorage fonctionne (test console)
- [ ] Aucune erreur JavaScript dans console
- [ ] App fonctionne normalement (créer facture, sauvegarder)
- [ ] Données persistantes après refresh (F5)

---

## 📊 Résultats attendus

### Console logs (startup)

```
[MTI_CONSULTING] Initializing...
✅ IndexedDB initialized via localforage
✅ Migrated 7 items from localStorage to IndexedDB
  - mti_invoices: 15 items
  - mti_quotes: 8 items
  - mti_rams: 3 items
  - mti_clients: 12 items
  - mti_syncLog: 1 item
  - mti_autoSyncEnabled: true
  - mti_app_config: {...}
[MTI_CONSULTING] Ready
```

### IndexedDB Structure

```
MTI_CONSULTING (database)
└── mti_data (object store)
    ├── mti_invoices → [...] (array)
    ├── mti_quotes → [...] (array)
    ├── mti_rams → [...] (array)
    ├── mti_clients → [...] (array)
    ├── mti_syncLog → [...] (array)
    ├── mti_autoSyncEnabled → true/false
    └── mti_app_config → {...} (object)
```

---

**Version**: 2.5.0  
**Date**: 2026-01-01  
**Testeur**: [Nom]  
**Statut**: 🔄 En cours
