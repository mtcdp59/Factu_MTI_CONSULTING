# Migration localStorage → IndexedDB (v2.5.0)

## Vue d'ensemble

Migration **progressive et sécurisée** de localStorage vers IndexedDB pour améliorer:
- 📦 **Capacité**: 5-10MB → 50MB+ (jusqu'à plusieurs GB)
- ⚡ **Performance**: Opérations asynchrones (non-bloquantes)
- 🔍 **Recherche**: Index natifs pour queries rapides
- 💾 **Types**: Stockage direct d'objets JS (pas de JSON.parse/stringify)

---

## Stratégie de migration

### Phase 1: Cohabitation (v2.5.0) ✅

**Principes**:
- ✅ localStorage **maintenu** comme backup
- ✅ IndexedDB utilisé en **priorité**
- ✅ Dual-write: écriture dans les deux (redondance)
- ✅ Fallback automatique si IndexedDB échoue

**Bénéfices**:
- Pas de breaking changes
- Rollback possible instantanément

- IndexedDB devient source primaire
- localStorage = backup read-only
- Suppression complète localStorage (optionnel)

---


**API unifiée** pour gérer localStorage et IndexedDB:


await storageManager.getItem('mti_invoices');
await storageManager.setItem('mti_quotes', quotes);
await storageManager.removeItem('mti_rams');
await storageManager.clear();

// Dual-write (IndexedDB + localStorage backup)
await storageManager.saveDual('mti_invoices', invoices);

// Load avec fallback automatique
const invoices = await storageManager.loadDual('mti_invoices');
// → Essaie IndexedDB d'abord
// → Fallback localStorage si vide
**Au démarrage** (`initApp()`):

```javascript
storageManager.migrateFromLocalStorage()
→ Vérifie flag: mti_indexeddb_migrated
→ Si false: copie localStorage → IndexedDB
→ Marque migration terminée
→ Garde localStorage comme backup
```

**Données migrées**:
- `mti_clients` (tiers)
- `mti_syncLog` (journal de sync)
- `mti_autoSyncEnabled` (préférences)
- `mti_app_config` (configuration)

---

## Helpers de compatibilité

Wrappers pour faciliter l'adoption:

```javascript
// Factures
await saveInvoicesToStorage(invoices);
const invoices = await loadInvoicesFromStorage();

// Devis
await saveQuotesToStorage(quotes);
const quotes = await loadQuotesFromStorage();

// RAMs
await saveRAMsToStorage(rams);
const rams = await loadRAMsFromStorage();

// Clients
await saveClientsToStorage(clients);

**Note**: Ces fonctions utilisent automatiquement dual-write (IndexedDB + localStorage).

---

## Utilisation

### Vérifier le statut de migration

```javascript
// Console (F12)
localStorage.getItem('mti_indexeddb_migrated')
// → 'true' si migration effectuée
// → null si pas encore migrée
```

### Forcer une nouvelle migration

// Console (F12)
localStorage.removeItem('mti_indexeddb_migrated');
location.reload();
// → Re-migrera au prochain chargement
```
// → ['mti_invoices', 'mti_quotes', 'mti_rams', ...]
await storageManager.getItem('mti_invoices')
// → [...] (array d'objets factures)
```
```javascript
window.storageManager

// Tester save/load
await window.saveInvoicesToStorage([{number: 'TEST', ...}])
await window.loadInvoicesFromStorage()
```

---

## Compatibilité

### Navigateurs supportés

**IndexedDB**:
- ✅ Chrome 24+
- ✅ Firefox 16+
- ✅ Safari 10+
- ✅ Edge 12+
- ✅ Mobile (iOS 10+, Android 4.4+)

**Fallback localStorage**:
- ✅ Tous navigateurs modernes
- ✅ Mode privé/incognito

### Gestion des erreurs

**Si localforage n'est pas chargé**:
```javascript
// Fallback automatique vers localStorage
console.warn('⚠️ localforage not loaded, falling back to localStorage');
```

**Si IndexedDB désactivé** (mode privé, etc.):
- localforage bascule automatiquement sur localStorage
- Aucune action requise

---

## Performance

### Comparaison

| Opération | localStorage | IndexedDB |
|-----------|-------------|-----------|
| **Écriture 1 facture** | ~2ms | ~5ms (async) |
| **Lecture 100 factures** | ~10ms (bloquant) | ~5ms (non-bloquant) |
| **Capacité max** | 5-10MB | 50MB-2GB |
| **Bloque UI?** | Oui | Non |

### Optimisations

- ✅ Dual-write asynchrone (ne bloque pas l'UI)
- ✅ Batch operations possibles (futures optimisations)
- ✅ Index natifs pour recherches (non utilisé pour l'instant)

---

## Migration du code existant

### Avant (v2.4.x)

```javascript
// Synchrone, bloquant
localStorage.setItem('mti_invoices', JSON.stringify(invoices));
const invoices = JSON.parse(localStorage.getItem('mti_invoices'));
```

### Après (v2.5.0+)

```javascript
// Asynchrone, non-bloquant
await saveInvoicesToStorage(invoices);
const invoices = await loadInvoicesFromStorage();
```

**Note**: Ancien code localStorage **fonctionne toujours** (backward compatible).

---

## Rollback

### Si problème détecté

```javascript
// 1. Désactiver IndexedDB
localStorage.setItem('mti_indexeddb_migrated', 'false');

// 2. Recharger
location.reload();

// → App utilisera localStorage uniquement
```

### Restaurer depuis localStorage

```javascript
// Les données sont toujours présentes en localStorage (backup)
// Supprimer la migration et recharger suffit
```

---

## Prochaines étapes

### v2.5.1 (futur)

- [ ] Remplacer tous les `localStorage.setItem/getItem` par `storageManager`
- [ ] Supprimer dual-write (IndexedDB uniquement)
- [ ] Garder localStorage comme cold backup

### v2.5.2 (futur)

- [ ] Ajouter index pour recherches rapides
- [ ] Batch operations (save multiple items)
- [ ] Compression automatique (LZ-string)

### v2.6.0 (futur - optionnel)

- [ ] Supprimer complètement localStorage
- [ ] Migration vers pure IndexedDB

---

## Ressources

- **localforage**: https://localforage.github.io/localForage/
- **IndexedDB API**: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **Can I Use IndexedDB**: https://caniuse.com/indexeddb

---

**Version**: 2.5.0  
**Date**: 2026-01-01  
**Statut**: ✅ Migration progressive active
