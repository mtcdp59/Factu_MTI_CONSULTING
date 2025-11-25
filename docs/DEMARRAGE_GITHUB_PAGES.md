# 🚀 Guide de démarrage rapide - GitHub Pages

## 📍 Vous êtes ici : GitHub Pages

L'application est hébergée sur **GitHub Pages** et fonctionne 100% dans votre navigateur.

### ⚠️ Configuration requise (première utilisation)

Pour que l'application fonctionne complètement, vous devez configurer 2 éléments :

#### 1️⃣ Backend Google Apps Script (pour Drive & Calendar)

**Prérequis** : Compte Google

**Étapes** :

1. Ouvrez [Google Apps Script](https://script.google.com/)
2. Créez un nouveau projet : `Nouveau projet`
3. Copiez le contenu de `backend/AppScript.js` depuis ce repository
4. Collez-le dans l'éditeur Apps Script
5. Cliquez sur `Déployer` → `Nouveau déploiement`
6. Type : `Application Web`
7. Exécuter en tant que : `Moi`
8. Qui a accès : `Tout le monde` (pour permettre l'app d'appeler le backend)
9. Cliquez sur `Déployer`
10. **Copiez l'URL de déploiement** (ex: `https://script.google.com/macros/s/AKfycby.../exec`)

#### 2️⃣ OAuth2 Google (pour Calendar)

**Prérequis** : Compte Google Cloud (gratuit)

**Étapes** :

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet : `MTI CONSULTING`
3. Activez l'API : `APIs & Services` → `Enable APIs and Services` → Recherchez `Google Calendar API` → `Enable`
4. Créez des credentials :
   - `APIs & Services` → `Credentials` → `Create Credentials` → `OAuth client ID`
   - Type : `Application Web`
   - Nom : `MTI CONSULTING Web`
   - **Origines autorisées** :
     - `https://mtcdp59.github.io`
     - `http://localhost:8000` (pour tests locaux)
   - **URIs de redirection** : Laissez vide ou ajoutez `https://mtcdp59.github.io/Factu_MTI_CONSULTING/`
   - Cliquez sur `Créer`
5. **Copiez le Client ID** (ex: `123456789-xxx.apps.googleusercontent.com`)
6. **Copiez le Client Secret** (affiché une seule fois)

### 🔧 Configuration dans l'application

1. Ouvrez l'application : https://mtcdp59.github.io/Factu_MTI_CONSULTING/
2. Allez dans l'onglet **Paramètres**
3. Scrollez jusqu'à la section **🔧 Configuration Technique (Requis)**
4. Remplissez les champs :
   - **Backend URL** : L'URL de déploiement Apps Script (étape 1️⃣)
   - **Google Client ID** : Le Client ID OAuth2 (étape 2️⃣)
   - **Google Client Secret** : Le Client Secret OAuth2 (étape 2️⃣)
   - **Calendar ID** : Votre email Gmail (ex: `votre.email@gmail.com`)
5. Cliquez sur **💾 Sauvegarder la configuration**
6. Cliquez sur **🧪 Tester Backend** pour vérifier la connexion
7. Rechargez la page

### ✅ Vérification

Si tout fonctionne :
- ✅ Aucun message d'erreur dans la console
- ✅ Le toast "✅ Stockage Drive vérifié" apparaît
- ✅ Vous pouvez créer des factures et des clients
- ✅ Les données sont sauvegardées sur Google Drive

### 🆘 Problèmes fréquents

#### Erreur : "Failed to load resource: 404" pour config.js
**Normal** ! Ce fichier n'existe que en développement local. Sur GitHub Pages, la config est dans `localStorage`.

#### Erreur : "Backend non configuré"
→ Suivez les étapes ci-dessus pour configurer le Backend URL

#### Erreur : "CORS policy: No 'Access-Control-Allow-Origin'"
→ Vérifiez que votre script Apps Script est bien déployé avec "Qui a accès : Tout le monde"

#### Erreur : "OAuth2 requires HTTP/HTTPS protocol"
→ Sur GitHub Pages, ça fonctionne automatiquement (HTTPS). Si vous testez en local, utilisez `python -m http.server 8000`

### 📚 Documentation complète

- [README.md](README.md) : Guide utilisateur complet
- [FICHE_TECHNIQUE.md](docs/FICHE_TECHNIQUE.md) : Documentation technique développeur
- [BAREME_IRPP.md](docs/BAREME_IRPP.md) : Documentation du calculateur fiscal

### 💡 Mode offline

L'application fonctionne en **mode dégradé** sans configuration :
- ✅ Création de factures (localStorage uniquement)
- ✅ Gestion clients
- ✅ Calculs fiscaux
- ✅ Génération PDF locale
- ❌ Sauvegarde Google Drive
- ❌ Google Calendar
- ❌ Envoi email automatique

---

**Bon démarrage ! 🚀**

Pour toute question : [Issues GitHub](https://github.com/mtcdp59/Factu_MTI_CONSULTING/issues)
