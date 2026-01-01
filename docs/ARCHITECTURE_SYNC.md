# Architecture Sync : Drive ↔ Sheets ↔ localStorage

## Vue d'ensemble

MTI CONSULTING utilise une architecture **tri-directionnelle** pour synchroniser les données entre trois couches:
- **Google Drive** : source de vérité (sauvegarde persistante, format JSON)
- **Google Sheets** : visualisation/reporting (onglets Factures, Devis, RAM, Tiers)
- **localStorage** : cache client (accès rapide, fallback si Drive inaccessible)

```
┌─────────────┐
│ User Action │
│  (Create/   │
│   Update)   │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│   localStorage   │
│   (Client Cache) │
└────────┬─────────┘
         │ [saveToDrive]
         ▼
┌──────────────────┐     [auto-sync debounced 2s]
│  Google Drive    │────────────────────────────┐
│  (Source Truth)  │                            │
└──────────────────┘                            ▼
         ▲                                ┌────────────────┐
         │                                │ Google Sheets  │
         │ [import from Sheets]           │ (Visualization)│
         │ [loadFromDrive]                └────────────────┘
         │
┌────────┴──────────────┐
│    App.js (Frontend)  │
│  - syncSheetsNow()    │
│  - loadFromDrive()    │
│  - syncQueueManager() │
└───────────────────────┘
```

---

## Flux de Données Détaillé

### 1. **Écriture Locale** → **Drive** → **Sheets**

#### Étape 1 : Sauvegarde en localStorage
```javascript
// User crée une facture
invoices.push(newInvoice);
localStorage.setItem('mti_invoices', JSON.stringify(invoices));
```

**Quand?** : Immédiatement après créer/modifier un document
**Durée** : Synchrone (< 5ms)
**Fallback** : Si localStorage échoue, les données restent en RAM (perdues au refresh)

#### Étape 2 : Push vers Google Drive
```javascript
await callBackend('saveToDrive', {
    invoices, quotes, rams, clients, // Toutes les données
    companyInfo, taxSettings  
});
```

**Quand?** : Immédiatement après sauvegarde localStorage
**Durée** : Async (500-2000ms selon la taille)
**Gestion d'erreur** : Affiche toast d'erreur, conserve les données localement

#### Étape 3 : Auto-sync vers Google Sheets (Debounced)
```javascript
// Déclenché après saveToDrive
queueSheetsSync('auto'); // Ajoute à la file d'attente
// Attendre 2 secondes si d'autres sync sont en cours
syncSheetsNow(); // Exporte vers Sheets
```

**Quand?** : 2 secondes après saveToDrive (debounced)
**Durée** : Async (1000-5000ms)
**Protection** : 
- `sheetsSyncInProgress` : empêche les chevauchements
- `pendingSheetsSync` : rejoue si une sync était déjà en cours
- `suppressSheetsSync` : lors des imports (évite les boucles)

**Résultat** :
```
localStorage → Drive (source truth) → Sheets (visualisation)
```

---

### 2. **Import depuis Google Sheets** (Reverse Sync)

#### Étape 1 : Charger les données depuis Sheets
```javascript
const sheetsData = await callBackend('getSheetsData', {
    sheetId: CONFIG.SHEETS_ID,
    ranges: ['Factures!A:Z', 'Devis!A:Z', ...]
});
```

#### Étape 2 : Désactiver l'auto-sync temporairement
```javascript
suppressSheetsSync = true; // Empêche la relance auto
```

**Pourquoi?** : Éviter une boucle infinie (import → auto-sync → re-import)

#### Étape 3 : Fusionner les données
```javascript
// Merge strategy : données de Sheets écrasent les locales
quotes = sheetsData.quotes || quotes;
// + Sauvegarder en localStorage comme backup
localStorage.setItem('mti_quotes', JSON.stringify(quotes));
```

#### Étape 4 : Réactiver auto-sync
```javascript
suppressSheetsSync = false;
// Relance si une sync était en attente
if (pendingSheetsSync) {
    queueSheetsSync('replay');
}
```

**Flux** :
```
Sheets → Drive (via Backend) → localStorage (cache) → App (memory)
```

---

### 3. **Fallback Mode** (Offline/Backend Down)

Si le backend n'est pas configuré ou Down:

```javascript
if (!isConfigured) {
    console.log('Mode offline: Backend non disponible');
    // Utiliser localStorage comme source unique
    const storedQuotes = localStorage.getItem('mti_quotes');
    quotes = storedQuotes ? JSON.parse(storedQuotes) : [];
}
```

**Comportement** :
- ✅ Créer/modifier documents localement
- ✅ Sauvegarder en localStorage
- ❌ **Pas d'export Drive** (données perdues au changement de device)
- ❌ **Pas de sync Sheets** (aucune visualisation externe)
- ✅ **Persiste au refresh** (via localStorage)

---

## Système de Journal (Sync Log)

Depuis v2.4.3, chaque tentative de sync est loggée:

### Structure
```javascript
syncLog = [
    {
        timestamp: "2026-01-01T14:30:45.123Z",
        status: "success" | "error" | "pending" | "retry",
        message: "Sync Sheets réussie (12 items)",
        details: { itemsSynced: 12, reason: "auto" },
        itemsSynced: 12,
        errorMessage: null
    },
    // ... (max 50 entries)
]
```

### Utilisation

**Afficher le journal UI** :
```javascript
// Aperçu en paramètres (derniers 10)
updateSyncLogDisplay();

// Modal avec tous les détails (50 derniers)
showSyncLogModal();
```

**Troubleshooting** :
- Chercher les erreurs (`status === 'error'`)
- Vérifier le timestamp et la fréquence des syncs
- Identifier les patterns d'erreur (ex: toujours au même moment)

---

## Statistiques de Sync (syncStats)

Objet mis à jour après chaque tentative:

```javascript
let syncStats = {
    lastSyncTime: Date | null,       // Dernière sync réussie
    itemsSynced: 0,                  // Nombre d'items dans la dernière sync
    errorCount: 0,                   // Nombre d'erreurs cumulées
    lastError: string | null         // Message de la dernière erreur
};
```

**Affichage** :
- 🔄 `Sync...` : syncing en cours
- ⚠️ `Sync error` : erreur détectée
- ✅ `Sync (14:30)` : succès, avec l'heure

---

## Auto-Sync avec Toggle

### Comportement

**Activé** (`autoSheetsSyncEnabled = true`) :
- Auto-sync démarré 2s après saveToDrive
- Debounced : évite les requêtes rapides successives
- Si un sync est en cours, met en file d'attente

**Désactivé** (`autoSheetsSyncEnabled = false`) :
- ✅ saveToDrive fonctionne normalement
- ❌ Auto-sync Sheets ne s'exécute **pas**
- ✅ Peut manuellement forcer sync via bouton (futur)

### Persistance

État sauvegardé en localStorage:
```javascript
localStorage.setItem('mti_autoSyncEnabled', 'true' | 'false');
```

Restauré au démarrage:
```javascript
loadAutoSyncPreference(); // Appelé dans initApp()
```

---

## Réconciliation Intelligente (v2.4.4+)

En cas de divergence détectée:

```
1. Charger 3 versions:
   - localStorage (cache client)
   - Drive (dernière sauvegarde)
   - Sheets (dernière modification)

2. Comparer les timestamps:
   - Prendre la version la plus récente
   - Si tie: Drive > localStorage > Sheets

3. Merger intelligemment:
   - Invoices: par ID
   - Devis: par ID
   - Tiers: par SIRET (unique key)
   - RAM: par mois + année (clé composite)

4. Sauvegarder le résultat:
   - Mettre à jour Drive
   - Sync vers Sheets
   - Mettre à jour localStorage
```

---

## Configuration Requise

### Backend (Google Apps Script)

Doit exposer les endpoints:
- `saveToDrive(invoices, quotes, rams, clients, companyInfo, taxSettings)` 
- `exportInvoicesToSheets(invoices)`
- `sync_quotes(quotes)`
- `sync_rams(rams)`
- `exportClients(clients)`
- `getSheetsData(sheetId, ranges)` (optionnel)

### Frontend

Doit définir dans `config.js`:
```javascript
CONFIG.BACKEND_URL = 'https://script.google.com/...';
CONFIG.SHEETS_ID = 'xxx';
CONFIG.DRIVE_FOLDER_ID = 'yyy';
```

---

## Performance

| Opération | Temps | Constraints |
|-----------|-------|-------------|
| localStorage save | <5ms | Jusqu'à 5-10MB selon le device |
| Drive API call | 500-2000ms | Limite: 100 appels/min |
| Sheets sync | 1000-5000ms | Limite: 60 appels/min |
| Load from Drive | 1000-5000ms | Basé sur la taille des données |

**Optimisations** :
- ✅ Debounce (2s) pour auto-sync
- ✅ Queue pour éviter les chevauchements
- ✅ localStorage cache pour accès rapide
- ✅ Suppression conditionnelle (suppressSheetsSync)

---

## Sécurité

### OAuth2 Flow
```
1. User clique "Login with Google"
2. Frontend demande accès (Drive, Sheets, Calendar)
3. Google envoie access_token + refresh_token
4. Frontend stocke en sessionStorage (auto-cleared)
5. Backend utilise pour APIs
```

### Données Sensibles
- ⚠️ Identifiants OAuth en dur dans config (future: externaliser)
- ✅ localStorage limité au device (pas de cloud transmission)
- ✅ Drive privé (folder accessible seulement par owner)
- ✅ Sheets partageable (permissions contrôlées par user)

---

## Troubleshooting

Voir [TROUBLESHOOTING_SYNC.md](TROUBLESHOOTING_SYNC.md)

---

## Évolutions Futures

- [ ] Offline first architecture (sync une fois online)
- [ ] Conflict resolution UI (le user choisit quelle version garder)
- [ ] Incremental sync (juste les changesets)
- [ ] Real-time webhooks (au lieu de polling)
- [ ] Encryption at rest (sensitive données)
