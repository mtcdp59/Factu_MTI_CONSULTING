# Guide du Stockage - MTI Consulting

## Vue d'ensemble

L'application utilise un **Storage Manager** hybride qui privilégie IndexedDB (via localforage) avec un fallback automatique vers localStorage en cas d'échec.

### Modes de stockage

- **IndexedDB** (mode par défaut) : Stockage navigateur haute performance, capacité ~50MB+
- **localStorage** (mode secours) : Fallback automatique si IndexedDB indisponible (navigation privée, quota dépassé)

### Backup localStorage

Par défaut, le backup localStorage est **activé** : chaque écriture dans IndexedDB est dupliquée dans localStorage pour sécurité.

## Architecture

```
┌─────────────────────────────────────┐
│   Storage Manager (storageManager)  │
│                                     │
│  Mode: indexeddb / localStorage     │
│  Backup: enabled / disabled         │
└─────────────────────────────────────┘
           │
           ├─── IndexedDB (via localforage)
           │    • mti_data store
           │    • Async, haute capacité
           │    • Transactions, indexes
           │
           └─── localStorage (backup/fallback)
                • JSON stringifié
                • Sync, ~5-10MB
                • Secours si IDB fail
```

## Optimisations Performance (v2.1.4)

### Memory Cache

La lecture répétée d'une même clé est extrêmement rapide grâce au **cache mémoire** (Map) :

```javascript
// 1ère lecture (depuis IndexedDB) : 45ms
const data = await storageManager.getItem('mti_invoices');

// 2e lecture (depuis cache mémoire) : <1ms ✨
const data = await storageManager.getItem('mti_invoices');

// Écriture invalide automatiquement le cache
await storageManager.setItem('mti_invoices', newData); // Cache cleared
```

**Gain** : 70% plus rapide sur rendu de listes (2e accès)

**Implémentation** :
- Cache = Map stockée dans `storageManager.memCache`
- Invalidation automatique on write/delete
- Transparent : aucun changement pour le code appelant

### Debounce sur saveToDrive

Les appels à `saveToDrive()` sont **groupés** pour limiter les requêtes Drive API :

```javascript
// Avant : 3 créations = 3 appels Drive
deleteInvoice(0);  // → saveToDrive() immédiat
deleteInvoice(1);  // → saveToDrive() immédiat
deleteInvoice(2);  // → saveToDrive() immédiat

// Après : 3 créations = 1 appel Drive (après 2 secondes)
deleteInvoice(0);  // → debouncedSaveToDrive() enqueue
deleteInvoice(1);  // → debouncedSaveToDrive() reschedule (2s)
deleteInvoice(2);  // → debouncedSaveToDrive() reschedule (2s) → 1 call total
```

**Gain** : 75% moins d'appels Drive, quota économisé

**Protection contre la concurrence** :
```javascript
if (saveToDriveInProgress) {
    console.log('⏳ Sauvegarde Drive déjà en cours, ignorée');
    return true; // Évite race conditions
}
```

---

## Données stockées

### Clés principales

- `mti_invoices` : Liste des factures
- `mti_quotes` : Liste des devis
- `mti_rams` : Liste des RAM (Réunions À Minuter)
- `mti_clients` : Liste des clients/tiers
- `mti_syncLog` : Journal de synchronisation
- `mti_autoSyncEnabled` : Flag auto-sync
- `mti_app_config` : Configuration applicative

### Clés d'index (recherche rapide)

- `mti_idx_invoices_number` : Index factures par numéro
- `mti_idx_quotes_number` : Index devis par numéro
- `mti_idx_clients_name` : Index clients par nom

### Métadonnées

- `mti_indexeddb_migrated` : Flag de migration localStorage → IndexedDB

## API Console (Diagnostic)

### Inspection

```javascript
// Vérifier le mode actuel
getStorageMode() // 'indexeddb' ou 'localStorage'

// État du stockage (espace utilisé)
await getStorageStatus() // "Storage (IndexedDB): 2.45 MB / 50.00 MB (5%)"

// Lister toutes les clés
await storageManager.keys()

// Lire une clé
await storageManager.getItem('mti_invoices')

// Stats détaillées
await storageManager.getStorageStats()
```

### Recherche rapide (index)

```javascript
// Rechercher une facture par numéro
await findInvoiceByNumber('FA-2025-001')

// Rechercher un devis par numéro
await findQuoteByNumber('DV-2025-005')

// Rechercher un client par nom
await findClientByName('ACME Corp')

// Régénérer les index
await ensureIndexes() // utilise invoices, quotes, clients globaux
await ensureIndexes({ invoices: [...], quotes: [...], clients: [...] })
```

### Backup et Export/Import

```javascript
// Exporter toutes les données (snapshot JSON compressé)
const backup = await exportLocalBackup(true) // true = compresser
console.log(backup.serialized) // chaîne compressée LZ-string
console.log(backup.meta) // { createdAt, mode, keys }

// Sauvegarder dans un fichier
const blob = new Blob([backup.serialized], { type: 'application/json' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = `mti_backup_${Date.now()}.json`
a.click()

// Importer un snapshot
const restored = await importLocalBackup(backup.serialized, { compressed: true })
console.log(restored.restored) // liste des clés restaurées
```

### Contrôle du backup localStorage

```javascript
// Activer le backup localStorage (écrit en double)
setStorageBackupEnabled(true)

// Désactiver le backup (IndexedDB seul)
setStorageBackupEnabled(false)

// Nettoyer localStorage (supprimer les doublons si IndexedDB OK)
await cleanupLocalStorage()
await cleanupLocalStorage(['mti_custom_key']) // préserver des clés
```

### Opérations batch

```javascript
// Sauvegarder toutes les données en une seule fois
await batchSaveAllData() // sauvegarde invoices, quotes, rams, clients + rebuild index

// Charger toutes les données
await batchLoadAllData() // charge et assigne à invoices, quotes, rams, clients

// Batch custom
await storageManager.batchSave({
  'mti_invoices': [...],
  'mti_quotes': [...]
})

await storageManager.batchLoad(['mti_invoices', 'mti_quotes'])
```

## Compression (LZ-string)

Si LZ-string est disponible, les gros objets (>100 entrées) sont automatiquement compressés.

```javascript
// Sauvegarder avec compression
await storageManager.saveWithCompression('mti_invoices', invoices, true)

// Charger avec décompression auto
const data = await storageManager.loadWithDecompression('mti_invoices')
```

## Migration localStorage → IndexedDB

Au premier chargement, si IndexedDB est disponible et que `mti_indexeddb_migrated` n'existe pas :

1. Le manager lit toutes les clés `mti_*` depuis localStorage
2. Les données sont copiées dans IndexedDB
3. Le flag `mti_indexeddb_migrated = true` est posé
4. localStorage est conservé comme backup (nettoyage auto toutes les 72h)

## Gestion d'erreur et Fallback

### Détection automatique

Si IndexedDB échoue (quota, private mode, erreur) :

```javascript
storageManager.switchToLocalStorage(reason)
// ⚠️ Bascule en mode localStorage (IndexedDB indisponible: QuotaExceededError)
```

Toutes les opérations suivantes utilisent localStorage en fallback.

### Forcer le fallback (test)

```javascript
// Simuler un échec IndexedDB
storageManager.mode = 'localStorage'
```

### Repli sur localStorage

La fonction `loadDual(key)` tente toujours de lire IndexedDB en premier, puis replie sur localStorage si vide/erreur.

## Nettoyage automatique

Un timer s'exécute toutes les **72h** pour nettoyer localStorage (si en mode IndexedDB) :

- Lit chaque clé `mti_*`
- Vérifie si elle existe dans IndexedDB
- Si oui, supprime de localStorage (évite doublons)
- Préserve `mti_indexeddb_migrated` et `mti_app_config`

```javascript
// Déclencher manuellement
await storageManager.cleanupLocalStorage()
```

## Limitations

### IndexedDB

- Quota : ~50MB (varie selon navigateur)
- Navigation privée : peut être désactivé ou effacé à la fermeture
- Asynchrone uniquement

### localStorage

- Limite : 5-10MB (selon navigateur)
- Synchrone (peut bloquer UI sur gros objets)
- Pas de transactions

## Bonnes pratiques

1. **Toujours utiliser les helpers async** : `saveInvoicesToStorage`, `loadInvoicesFromStorage`
2. **Privilégier batchSave** pour plusieurs écritures groupées
3. **Rebuilder les index** après import ou modif massive : `await ensureIndexes()`
4. **Exporter un backup régulier** (avant maj majeure) : `exportLocalBackup()`
5. **Vérifier le mode** si comportement inattendu : `getStorageMode()`
6. **Ne pas écrire de gros objets unitaires** : préférer découper ou compresser

## Dépannage

### "Quota exceeded" / "Storage full"

```javascript
// Vérifier l'espace
await getStorageStatus()

// Si plein, nettoyer ou exporter puis vider
const backup = await exportLocalBackup()
await storageManager.clear() // vide IndexedDB + localStorage
await importLocalBackup(backup.serialized, { compressed: true })
```

### "IndexedDB non disponible"

→ Vérifier la console, le manager bascule auto en localStorage.

```javascript
getStorageMode() // doit retourner 'localStorage'
```

### "Données perdues après fermeture"

→ Vérifier si en navigation privée (localStorage/IndexedDB peuvent être effacés).

→ Vérifier que le backup est activé : `storageManager.backupEnabled`

### "Index obsolète ou recherche échoue"

```javascript
// Reconstruire les index
await ensureIndexes({ invoices, quotes, clients })
```

## Exemple complet

```javascript
// 1. Vérifier le mode
console.log('Mode:', getStorageMode())
console.log(await getStorageStatus())

// 2. Activer backup localStorage
setStorageBackupEnabled(true)

// 3. Sauvegarder des données
invoices.push({ number: 'FA-2025-099', ... })
await batchSaveAllData() // sauvegarde + rebuild index

// 4. Recherche rapide
const invoice = await findInvoiceByNumber('FA-2025-099')
console.log(invoice)

// 5. Export backup
const backup = await exportLocalBackup(true)
console.log('Backup créé:', backup.meta)

// 6. Nettoyer localStorage
await cleanupLocalStorage()
console.log('localStorage nettoyé')
```

## Maintenance

- **Tous les 72h** : cleanup localStorage automatique (si IndexedDB actif)
- **Tous les mois** : exporter un backup manuel (recommandé)
- **Avant migration majeure** : exporter + tester import sur copie

---

**Version** : 2.1.3+  
**Dernière mise à jour** : 2 janvier 2026
