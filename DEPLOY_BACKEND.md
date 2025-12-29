# 🚀 Guide de déploiement du backend

## Contexte

Vous venez d'ajouter les fonctions de synchronisation des devis dans [backend/AppScript.js](backend/AppScript.js). Pour que ces modifications soient actives, vous devez **déployer une nouvelle version** de votre backend Google Apps Script.

## ⚠️ Erreur actuelle

```
Error: Action inconnue: sync_quotes
```

**Cause** : Le backend déployé actuellement ne contient pas encore les nouvelles actions `sync_quotes` et `import_quotes`.

**Solution** : Déployer une nouvelle version.

## 📋 Étapes de déploiement

### 1. Ouvrir Google Apps Script

1. Allez sur https://script.google.com/home
2. Cherchez votre projet "MTI CONSULTING Backend" (ou le nom que vous lui avez donné)
3. Cliquez dessus pour l'ouvrir

### 2. Copier le code mis à jour

1. Ouvrez le fichier [backend/AppScript.js](backend/AppScript.js) depuis ce projet
2. Sélectionnez **tout le contenu** (Ctrl+A)
3. Copiez (Ctrl+C)
4. Dans Google Apps Script, sélectionnez votre fichier `Code.gs`
5. Sélectionnez tout le contenu actuel (Ctrl+A)
6. Collez le nouveau code (Ctrl+V)
7. Enregistrez (Ctrl+S)

### 3. Déployer la nouvelle version (incluant relances et envoi factures)

#### Option A : Via l'interface graphique

1. Cliquez sur **"Déployer"** (en haut à droite)
2. Sélectionnez **"Gérer les déploiements"**
3. Vous verrez votre déploiement actif (ex: "Déploiement 1")
4. Cliquez sur l'icône **⚙️** (à droite du déploiement)
5. Sélectionnez **"Modifier"**
6. Dans "Version", sélectionnez **"Nouvelle version"** dans le menu déroulant
7. (Optionnel) Ajoutez une description : `Ajout synchronisation devis (sync_quotes, import_quotes)`
8. Cliquez sur **"Déployer"**
9. ✅ Vous verrez un message "Déploiement mis à jour"

#### Option B : Via nouveau déploiement

1. Cliquez sur **"Déployer"** (en haut à droite)
2. Sélectionnez **"Nouveau déploiement"**
3. Cliquez sur l'icône **⚙️** à côté de "Sélectionner un type"
4. Choisissez **"Application web"**
5. Remplissez les champs :
   - **Description** : `Version avec sync devis - Dec 2024`
   - **Exécuter en tant que** : `Moi (votre email)`
   - **Qui peut accéder** : `Tout le monde`
6. Cliquez sur **"Déployer"**
7. Copiez la **nouvelle URL** de déploiement
8. ⚠️ Si vous créez un nouveau déploiement, mettez à jour `BACKEND_URL` dans [app.js](app.js) (ligne 6)

#### Permissions requises

- Gmail (envoi d'emails)
- Google Drive (création/lecture de fichiers PDF)

Lors du premier envoi, Apps Script demandera l'autorisation. Acceptez les scopes Gmail/Drive.

#### Nouvelles actions exposées (JSON/JSONP)

- `sendRelance` (POST/GET) → envoi relances niveau 1/2/3 avec PJ PDF
- `listFilesInFolder` (POST/GET) → lister fichiers Drive (ex: Factures)
- `sendEmailWithDriveFile` (POST/GET) → envoyer une facture en PJ depuis Drive (fileId)

### 4. Vérifier le déploiement

1. Une fois déployé, Google Apps Script affichera :
   ```
   ID du déploiement : AKfycby...
   URL : https://script.google.com/macros/s/AKfycby.../exec
   ```

2. Testez que le backend répond :
   ```javascript
   // Dans la console du navigateur (F12)
   fetch('https://script.google.com/macros/s/VOTRE_ID/exec', {
     method: 'POST',
     body: JSON.stringify({ action: 'ensureStorage' })
   }).then(r => r.json()).then(console.log)

// Envoi relance (JSONP GET)
const cb = '__cb' + Date.now();
window[cb] = (res) => console.log(res);
const u = 'https://script.google.com/macros/s/VOTRE_ID/exec?action=sendRelance&invoiceNumber=FAC-202512-001&level=1&callback=' + cb;
var s = document.createElement('script'); s.src = u; document.body.appendChild(s);
   ```

### 5. Tester dans l'application

1. Rechargez l'application MTI CONSULTING (F5)
2. Allez dans l'onglet **DEVIS**
3. Créez 2-3 devis de test
4. Cliquez sur **"📤 Exporter vers Sheets"**
5. ✅ Vous devriez voir : `✅ 3 ligne(s) exportée(s) vers Sheets`
6. Google Sheets devrait s'ouvrir automatiquement

### 6. Créer l'onglet "Devis" dans Google Sheets

Si ce n'est pas déjà fait :

1. Ouvrez votre Google Spreadsheet :
   ```
   https://docs.google.com/spreadsheets/d/1Zu6I-c64YrBdlfvWhiVnlbwbvhv6Mw5NL8iRn2mvXoE
   ```

2. Cliquez sur le bouton **"+"** en bas pour ajouter une feuille
3. Renommez-la **exactement** : `Devis` (avec majuscule D)
4. L'export créera automatiquement les en-têtes

## 🔍 Vérifications

### ✅ Le déploiement a réussi si :

- Aucune erreur affichée dans Google Apps Script
- Vous voyez un ID de déploiement et une URL
- L'URL se termine par `/exec`

### ✅ La synchronisation fonctionne si :

- Bouton "📤 Exporter" affiche un message de succès
- Google Sheets s'ouvre avec un onglet "Devis"
- Les données de vos devis apparaissent dans le tableau
- Bouton "📥 Importer" restaure les devis depuis Sheets

## ❌ Dépannage

### Erreur : "Action inconnue: sync_quotes"

**Cause** : Le code n'a pas été copié correctement ou le déploiement n'a pas été fait

**Solution** :
1. Vérifiez que le fichier Code.gs contient bien les fonctions `syncQuotes` et `importQuotes`
2. Recherchez (Ctrl+F) : `function syncQuotes`
3. Si absent, recommencez l'étape 2 (copier le code)
4. Redéployez (étape 3)

### Erreur : "Feuille 'Devis' introuvable"

**Cause** : L'onglet "Devis" n'existe pas dans votre Google Spreadsheet

**Solution** :
1. Ouvrez votre Google Spreadsheet
2. Créez un onglet nommé exactement `Devis`
3. Réessayez l'export

### Erreur : "Failed to fetch" ou "CORS error"

**Cause** : L'URL du backend est incorrecte ou le déploiement n'est pas public

**Solution** :
1. Vérifiez que `BACKEND_URL` dans app.js pointe vers la bonne URL
2. Dans Google Apps Script, vérifiez que "Qui peut accéder" = "Tout le monde"
3. Essayez le fallback JSONP (GET avec `callback`), par ex. `action=sendRelance`
4. Redéployez si nécessaire

## 📊 Nouvelles fonctions ajoutées

Dans [backend/AppScript.js](backend/AppScript.js#L1375-L1560) :

```javascript
// Ligne 99-102 : Nouvelles actions dans le routeur
case 'sync_quotes':
  response = syncQuotes(data.sheetId, data.quotes);
  break;
case 'import_quotes':
  response = importQuotes(data.sheetId);
  break;

// Ligne 1375-1450 : Fonction d'export
function syncQuotes(sheetId, quotes) { ... }

// Ligne 1453-1470 : Helper de formatage
function formatQuoteDescription(items) { ... }

// Ligne 1475-1510 : Fonction d'import
function importQuotes(sheetId) { ... }

// Ligne 1515-1560 : Helper de parsing
function parseQuoteDescription(description) { ... }
```

## 🎯 Résultat attendu

Après le déploiement, vous pourrez :

✅ Exporter vos devis vers Google Sheets en 1 clic
✅ Modifier les devis dans Sheets (statuts, notes, montants)
✅ Importer les modifications depuis Sheets vers l'application
✅ Analyser vos devis avec les outils Google Sheets (graphiques, tableaux croisés)
✅ Conserver un historique externe en plus de Drive

## 📚 Documentation complète

- [Guide complet de synchronisation](docs/SYNCHRONISATION_DEVIS_SHEETS.md)
- [Structure des données exportées](docs/SYNCHRONISATION_DEVIS_SHEETS.md#structure-des-données-exportées)
- [Workflow de synchronisation](docs/SYNCHRONISATION_DEVIS_SHEETS.md#workflow-de-synchronisation)

---

**Créé le** : 14 décembre 2025  
**Prochaine étape** : Déployer le backend puis tester l'export
