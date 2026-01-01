# Guide Troubleshooting : Problèmes de Synchronisation

## 📋 Contenu

1. [Problèmes courants](#problèmes-courants)
2. [Diagnostic](#diagnostic)
3. [Solutions par symptôme](#solutions-par-symptôme)
4. [Logs et déboggage](#logs-et-déboggage)
5. [Recovery procedures](#recovery-procedures)

---

## Problèmes Courants

### ❌ Les données ne se synchent pas vers Sheets

**Symptômes** :
- ✅ Les données sont sauvegardées localement
- ✅ localStorage contient les données
- ❌ Sheets n'est pas mis à jour
- 🔴 Toast : "Sync Sheets auto: [Erreur]"

**Causes possibles** :
1. Backend URL non configurée ou invalide
2. Erreur d'authentification OAuth
3. Sheets non créée ou pas accessible
4. Auto-sync désactivé

**Solutions** :

#### 1. Vérifier la configuration
```
⚙️ Paramètres → Configuration Technique
→ Backend URL: doit être une URL HTTPS valide
→ Tester Backend: bouton bleu
```

Si ❌ "Backend non accessible":
- Vérifier que le script Apps Script est déployé
- Vérifier que le lien est copié correctement (sans caractères supplémentaires)
- Vérifier les droits d'accès au script

#### 2. Vérifier auto-sync
```
Header → Bouton ▶️ Auto-Sync (ou ⏸️ si désactivé)
→ Click pour activer
→ Un toast "Auto-sync activé" doit apparaître
```

#### 3. Forcer une sync manuelle
```
⚙️ Paramètres → Journal de Synchronisation
→ Bouton "Afficher historique"
→ Chercher les erreurs (❌)
```

#### 4. Vérifier les droits Sheets
```
Google Sheets (directement dans le navigateur)
→ Onglets: Factures, Devis, RAM, Tiers
→ Vérifier que ces onglets existent
→ Vérifier les permissions (editable)
```

---

### ❌ Les données ne chargent pas au démarrage

**Symptômes** :
- App se charge mais "Aucune donnée"
- localStorage contient les données
- Drive inaccessible

**Solutions** :

#### Mode Offline
```javascript
// Vérifier dans la console (F12)
window.isConfigured // doit être true
localStorage.getItem('mti_invoices') // doit avoir des données
```

**Si en mode offline** :
- ✅ Les données locales (localStorage) vont charger
- ❌ Sync Drive/Sheets pas actif
- ✅ Vous pouvez créer/modifier localement
- ⚠️ Les données ne se sauvegarderont pas sur Drive

**Solution** : Configurer le backend et rafraîchir la page

---

### ⚠️ Conflit de données entre Drive et Sheets

**Symptômes** :
- Données différentes dans Sheets vs App
- Impossible de savoir quelle version croire

**Causes** :
- Modifications manuelles dans Sheets
- Import depuis Sheets en même temps qu'une modification locale
- Crash / perte de connexion pendant une sync

**Solution** :

#### Étape 1 : Afficher le journal
```
⚙️ Paramètres → Journal de Synchronisation
→ "Afficher historique"
→ Chercher le moment du problème
→ Vérifier les timestamps
```

#### Étape 2 : Identifier la version valide
```
Drive (source truth):
→ Fichier JSON dans le dossier MTI_CONSULTING
→ Chercher la date/heure du fichier

Sheets:
→ Voir les données visibles
→ Format: à partir de la ligne 2 (ligne 1 = headers)

App (localStorage):
→ F12 → Console
→ localStorage.getItem('mti_invoices')
→ Comparer les IDs et dates
```

#### Étape 3 : Réconcilier manuellement
```javascript
// Si Drive est trustworthy:
// 1. Effacer le localStorage
localStorage.removeItem('mti_invoices');
localStorage.removeItem('mti_quotes');
// 2. Recharger la page
location.reload();
// 3. App va recharger depuis Drive automatiquement
```

---

### 🔄 Sync bouclant (constant retry)

**Symptômes** :
- Toast de sync toutes les 2 secondes
- Beaucoup de requêtes API (console réseau)
- App lente

**Causes** :
- Backend retourne une erreur
- Sheets inaccessible temporairement
- Configuration invalide

**Solution** :

#### Étape 1 : Vérifier le journal détaillé
```
⚙️ Paramètres → Journal de Synchronisation
→ "Afficher historique"
→ Voir le message d'erreur exact (colonne "Message")
```

#### Étape 2 : Désactiver auto-sync temporairement
```
Header → Bouton ⏸️ Auto-Sync (click pour désactiver)
→ Les retrys vont s'arrêter
→ Vous pouvez encore créer/modifier localement
```

#### Étape 3 : Identifier la cause
```javascript
// Erreur courant: "Invalid SHEETS_ID"
→ ⚙️ Paramètres → Configuration Technique
→ Vérifier CONFIG_SHEETS_ID (copier depuis URL de Sheets)

// Erreur: "Sheets not found"
→ Créer les onglets: Factures, Devis, RAM, Tiers
→ Au minimum: entête avec colonnes
```

#### Étape 4 : Réactiver auto-sync
```
Header → Bouton ▶️ Auto-Sync (click pour réactiver)
```

---

## Diagnostic

### Checklist de Configuration

```javascript
// 1. Backend configuré?
⚙️ Paramètres → Backend URL
✅ Doit avoir une valeur HTTPS
✅ Test Backend: "OK" réponse

// 2. Sheets créée?
Google Sheets (direct)
✅ Onglets présents: Factures, Devis, RAM, Tiers
✅ Ligne 1: headers (ID, Date, Montant, etc.)

// 3. Auto-sync activé?
Header → Bouton (▶️ = enabled, ⏸️ = disabled)
✅ Doit montrer ▶️

// 4. localStorage pas pleine?
F12 → Console
localStorage.getItem('mti_invoices').length < 5000000
✅ Doit être < 5MB
```

### Console Debugging

```javascript
// Ouvrir la console (F12 → Console)

// Vérifier les variables globales
window.autoSheetsSyncEnabled // true/false
window.isConfigured // true/false
window.syncLog // tableau des logs

// Afficher le journal
getSyncLog(10) // Derniers 10 entrées

// Afficher les stats actuelles
window.syncStats
{
    lastSyncTime: Date | null,
    itemsSynced: 0,
    errorCount: 0,
    lastError: null
}

// Afficher la config
CONFIG
{
    BACKEND_URL: "https://...",
    SHEETS_ID: "xxx",
    ...
}

// Forcer une sync manuelle
syncSheetsNow('manual') // Wait for promise

// Vérifier localStorage usage
Object.keys(localStorage).forEach(key => {
    const size = localStorage.getItem(key).length;
    console.log(`${key}: ${size} bytes`);
});
```

---

## Solutions par Symptôme

### "❌ Backend not accessible"

**Causes** :
- Script Apps Script pas déployé
- URL copiée avec caractères supplémentaires
- Script desactivé ou supprimé
- Erreur de CORS (rare, backend doit avoir headers CORS)

**Fix** :
```
1. Aller dans Google Apps Script
2. Vérifier: Déployer → Déploiements → Web app
3. Copier l'URL exactement (sans espaces)
4. ⚙️ Paramètres → Backend URL → Coller
5. ⚙️ Test Backend → Should say "OK"
```

---

### "⚠️ Invalid SHEETS_ID"

**Cause** :
- L'ID Sheets copiée est incorrecte
- Sheets a été supprimée
- Permissions insuffisantes

**Fix** :
```
1. Ouvrir Google Sheets
2. URL: https://docs.google.com/spreadsheets/d/[ID]/edit
3. Copier l'ID (les x après /d/)
4. ⚙️ Paramètres → Configuration → 
   "Google Spreadsheet ID" → Coller
5. Tester Backend
```

---

### "🔄 Sync keeps retrying"

**Causes** :
- Erreur Backend (mais se relance automatiquement)
- Sheets inaccessible temporairement
- Limite d'API atteinte (60 appels/min)

**Quick Fix** :
```
1. Attendre 2-3 minutes (reset des limites API)
2. Rafraîchir la page (F5)
3. Les données devraient syncer
```

**Permanent Fix** :
```
Si persiste:
1. Désactiver auto-sync (⏸️)
2. ⚙️ Paramètres → Journal → Clear log
3. Rafraîchir
4. Réactiver auto-sync (▶️)
```

---

### "💾 Data lost after reload"

**Cause** :
- localStorage cleared (user, upgrade, incognito mode)
- Drive sync failed (données jamais poussées)
- Backend down au moment de la sauvegarde

**Prevention** :
```
✅ Toujours vérifier les toasts:
   - "✅ Sync Sheets OK (12 items)"
   - "✅ Sauvegardé sur Drive"
   
❌ Si vous voyez des erreurs (❌), attendez que ça synce
```

**Recovery** :
```
1. Si Drive a les données:
   ⚙️ Paramètres → Charger depuis Drive
   
2. Si Sheets a les données:
   ⚙️ Paramètres → Importer depuis Sheets
   
3. Si tout est perdu:
   ⚠️ Faire une sauvegarde manuelle (export CSV)
   ⚠️ Contact: vérifier si backup automatique existe
```

---

## Logs et Déboggage

### Lire le Journal de Sync

```
⚙️ Paramètres → Journal de Synchronisation
→ "Afficher historique"
→ Tableau avec colonnes: Time, Status, Message, Items
```

**Interpréter les statuts** :
- ✅ `success` : Sync réussie, X items synchronisés
- ❌ `error` : Erreur lors de la sync (voir message)
- 🔄 `retry` : Relance après une tentative échouée
- ⏳ `pending` : Sync en file d'attente

**Exemples d'erreurs courants** :

```
"Error: Invalid SHEETS_ID"
→ L'ID Sheets est mauvaise
→ Fix: Copier l'ID depuis l'URL de Sheets

"Error: Sheets API disabled"
→ L'API Google Sheets n'est pas activée
→ Fix: Google Cloud Console → Enable API

"Error: 403 Forbidden"
→ Pas de droits sur la Sheets ou Drive
→ Fix: Vérifier les permissions dans Google

"Error: Network timeout"
→ Connexion réseau faible
→ Fix: Attendre, réessayer
```

### Exporter les Logs

```javascript
// Console (F12)
console.table(getSyncLog(50))  // Affiche tableau

// Copier pour envoi/debug
JSON.stringify(getSyncLog(50), null, 2)
```

---

## Recovery Procedures

### Procédure 1 : Reset Complet

⚠️ Utiliser en dernier recours (efface tout!)

```
1. ⚙️ Paramètres → Journal → "Clear & Reload"
   OU
   F12 → Console:
   localStorage.clear();
   location.reload();

2. App recharge avec aucune donnée
3. ⚙️ Paramètres → Charger depuis Drive
4. Data revient depuis Drive

Résultat: ✅ localStorage = Drive (synchronized)
```

---

### Procédure 2 : Recover from Sheets

Si seule Sheets a les bonnes données:

```
1. ⚙️ Paramètres → [FUTURE BUTTON] "Importer de Sheets"
   (Actuellement: copier-coller manuellement)

2. Copier chaque onglet (Factures, Devis, etc.)
3. Importer/créer manuellement en app

OU (Plus facile):

1. Backend fetch depuis Sheets
   callBackend('getSheetsData', {sheetId})
2. Parser et mapper vers format app
3. Sauvegarder en localStorage
4. saveToDrive pour syncer
```

---

### Procédure 3 : Sync Forced Manual

Si auto-sync ne marche plus:

```javascript
// Console (F12)

// 1. Attendre que syncSheetsNow finisse
await syncSheetsNow('manual-force');

// 2. Vérifier le log
getSyncLog(1); // Dernière entrée

// 3. Si succès:
// ✅ Data synced!

// 4. Si erreur:
// ❌ Voir le message pour diagnostiquer
```

---

## Preventive Measures

### Bonnes pratiques

```
✅ Régulièrement:
   - Vérifier les toasts (vert = bon, rouge = erreur)
   - Jeter un oeil au journal (⚙️ → Journal)
   - Relancer la page (F5) une fois par jour

✅ Avant d'importer de Sheets:
   - Désactiver auto-sync temporairement (⏸️)
   - Faire l'import
   - Réactiver (▶️)

✅ Avant un travail important:
   - Exporter FEC/données en CSV (backup local)
   - Vérifier que Drive a reçu une sauvegarde
```

---

## Contacter le Support

Si aucune solution ne marche:

```
1. Exporter les logs:
   F12 → Console → JSON.stringify(getSyncLog(50))
   → Copier tout

2. Exporter la config:
   F12 → Console → JSON.stringify(CONFIG)

3. Screenshots:
   - Journal de Sync (⚙️)
   - Toast d'erreur
   - Console logs (F12)

4. Envoyer avec:
   - Description du problème
   - Étapes pour reproduire
   - Logs + config + screenshots
```

---

## Ressources

- [ARCHITECTURE_SYNC.md](ARCHITECTURE_SYNC.md) : Architecture complète
- [FICHE_TECHNIQUE.md](../docs/FICHE_TECHNIQUE.md) : Configuration backend
- Google Apps Script Debugging: [Link](https://developers.google.com/apps-script/guides/support/debugging)
- Google Drive API: [Link](https://developers.google.com/drive)
- Google Sheets API: [Link](https://developers.google.com/sheets)

---

**Version** : 2.4.3+  
**Mise à jour** : 2026-01-01  
**Statut** : ✅ Production Ready
