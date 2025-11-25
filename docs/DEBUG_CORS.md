# 🔧 Debugging CORS - Google Apps Script

## Problème
```
Access to fetch at 'https://script.google.com/...' from origin 'https://mtcdp59.github.io' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

## Solutions possibles

### ✅ Solution 1 : Vérifier les paramètres de déploiement

1. Allez sur https://script.google.com/
2. Ouvrez votre projet "MTI_CONSULTING_Backend"
3. **Déployer** → **Gérer les déploiements**
4. Cliquez sur ✏️ (éditer)
5. **VÉRIFIEZ CES PARAMÈTRES CRITIQUES :**
   - **Exécuter en tant que** : **Moi** (votre compte)
   - **Qui a accès** : **Tout le monde** ⚠️ **TRÈS IMPORTANT**
6. Si "Qui a accès" était différent, changez-le et cliquez **Déployer**

### ✅ Solution 2 : Créer un NOUVEAU déploiement (recommandé)

Parfois, éditer un déploiement ne suffit pas. Créez-en un nouveau :

1. Sur https://script.google.com/
2. Ouvrez "MTI_CONSULTING_Backend"
3. **Déployer** → **Gérer les déploiements**
4. Cliquez **+ Créer un déploiement**
5. Type : **Web App**
6. Description : "MTI Backend v2 - CORS fix"
7. **Exécuter en tant que** : Moi
8. **Qui a accès** : **Tout le monde**
9. **Déployer**
10. **COPIEZ LA NOUVELLE URL** (différente de l'ancienne)
11. Mettez à jour `config.js` avec cette nouvelle URL
12. Relancez le script PowerShell : `.\scripts\deploy-config.ps1`

### ✅ Solution 3 : Tester avec curl

Testez directement le backend avec curl :

```powershell
curl -X POST https://script.google.com/macros/s/VOTRE_SCRIPT_ID/exec -H "Content-Type: application/json" -d '{"action":"ensureStorage"}' -i
```

Vous devriez voir dans la réponse :
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

Si ces headers ne sont PAS présents, le problème vient du déploiement Apps Script.

### ✅ Solution 4 : Forcer le cache à se vider

Google Apps Script met en cache les déploiements. Pour forcer le refresh :

1. **Créez une nouvelle version** (pas seulement sauvegarder)
2. **Créez un nouveau déploiement** (pas éditer l'ancien)
3. Attendez **2-3 minutes** pour la propagation

### 🔍 Vérification du code CORS

Votre code doit contenir (lignes 88-96 et 137-142) :

```javascript
// Ligne 88 : doOptions pour preflight
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type')
    .setHeader('Access-Control-Max-Age', '3600');
}

// Ligne 137 : addCorsHeaders
function addCorsHeaders(response) {
  return response
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```

### 🐛 Debug en temps réel

1. Ouvrez la console DevTools (F12) sur GitHub Pages
2. Onglet **Network**
3. Rechargez la page
4. Trouvez la requête vers `script.google.com`
5. Cliquez dessus
6. Onglet **Headers**
7. Vérifiez **Response Headers** :
   - Si `Access-Control-Allow-Origin: *` est présent → OK
   - Si absent → Problème de déploiement Apps Script

### ⚡ Solution rapide : Mode GET au lieu de POST

Si CORS ne fonctionne vraiment pas, utilisez GET+JSONP :

```javascript
// Dans app.js, remplacer callBackend par :
async function callBackend(action, payload = {}) {
    const url = CONFIG.BACKEND_URL + '?action=' + action + '&callback=handleResponse';
    return new Promise((resolve, reject) => {
        window.handleResponse = (data) => {
            delete window.handleResponse;
            resolve(data);
        };
        const script = document.createElement('script');
        script.src = url;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
```

Mais ça ne fonctionne que pour GET (pas POST avec gros payload).

## 📋 Checklist finale

- [ ] Code contient `doOptions()` et `addCorsHeaders()`
- [ ] Déploiement Apps Script : **"Qui a accès" = Tout le monde**
- [ ] Nouvelle version créée (pas juste sauvegarde)
- [ ] Nouveau déploiement créé (pas juste édition)
- [ ] URL mise à jour dans `config.js`
- [ ] Config redéployée sur GitHub Pages
- [ ] Attendu 2-3 minutes pour propagation
- [ ] Cache navigateur vidé (Ctrl+Shift+R)

## 🆘 Si rien ne fonctionne

Il existe une limitation connue : Google Apps Script peut bloquer CORS pour certains domaines. Solutions alternatives :

1. **Backend Node.js sur Vercel/Netlify** (proxy vers Apps Script)
2. **Extension Chrome** (bypass CORS)
3. **Localhost uniquement** (pas de CORS en local)
