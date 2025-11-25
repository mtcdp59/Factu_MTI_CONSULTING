# Déploiement du Proxy CORS

## Problème résolu

Google Apps Script ne supporte pas CORS pour les requêtes POST depuis des origines externes (localhost, GitHub Pages). Ce proxy contourne cette limitation en relayant les requêtes.

## Déploiement sur Vercel (Gratuit)

### 1. Créer un compte Vercel

1. Allez sur https://vercel.com
2. Connectez-vous avec GitHub
3. Autorisez Vercel à accéder à vos repos

### 2. Déployer le proxy

**Option A : Via l'interface web**
1. Cliquez sur "Add New Project"
2. Sélectionnez le repo `Factu_MTI_CONSULTING`
3. Root Directory: laissez vide (racine)
4. Build Command: laissez vide
5. Output Directory: laissez vide
6. Cliquez "Deploy"

**Option B : Via CLI**
```bash
# Installer Vercel CLI
npm install -g vercel

# Dans le dossier du projet
cd C:\Users\micka\OneDrive\Documents\GitHub\Factu_MTI_CONSULTING

# Déployer
vercel --prod
```

### 3. Récupérer l'URL du proxy

Après le déploiement, Vercel vous donne une URL comme :
```
https://factu-mti-consulting.vercel.app
```

Le proxy sera accessible à :
```
https://factu-mti-consulting.vercel.app/api
```

### 4. Mettre à jour la configuration

Modifiez `app.js` ligne 6 :

```javascript
const CONFIG = {
    BACKEND_URL: 'https://VOTRE-PROJET.vercel.app/api',  // ← Nouvelle URL
    // ... reste identique
};
```

Ou en local dans `config.js` :
```javascript
window.CONFIG = {
    BACKEND_URL: 'https://VOTRE-PROJET.vercel.app/api',
    // ... reste identique
};
```

### 5. Tester

```bash
# Démarrer le serveur local
python -m http.server 8000

# Ouvrir http://localhost:8000
# L'application devrait maintenant fonctionner sans erreur CORS !
```

## Architecture

```
[Frontend]                    [Proxy Vercel]              [Google Apps Script]
localhost:8000  ──POST──>  vercel.app/api  ──POST──>  script.google.com
    │                            │                            │
    │                        Ajoute headers                   │
    │                            CORS                         │
    │                            │                            │
    └────────────<──200 OK──────┴────────<──200 OK──────────┘
```

## Avantages

✅ **Gratuit** : Plan Vercel Hobby gratuit (100 GB bandwidth/mois)
✅ **Rapide** : Edge network mondial
✅ **Simple** : Déploiement en 2 minutes
✅ **Fiable** : Uptime 99.9%
✅ **HTTPS** : Certificat SSL automatique

## Dépannage

**Erreur "Module not found"**
→ Vérifiez que `vercel.json` est à la racine du repo

**Erreur 404 sur /api**
→ Vérifiez que la route dans `vercel.json` est correcte

**Toujours des erreurs CORS**
→ Videz le cache du navigateur (Ctrl+Shift+R)

**Proxy timeout**
→ Google Apps Script peut être lent. Augmentez le timeout si nécessaire.

## Alternative : Netlify

Si Vercel ne fonctionne pas, vous pouvez utiliser Netlify :

1. Créez `netlify.toml` :
```toml
[build]
  functions = "proxy"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/proxy/:splat"
  status = 200
```

2. Renommez `proxy/index.js` en `proxy/proxy.js`
3. Déployez sur Netlify

## Support

Pour toute question, consultez :
- Documentation Vercel : https://vercel.com/docs
- Issues GitHub : https://github.com/mtcdp59/Factu_MTI_CONSULTING/issues
