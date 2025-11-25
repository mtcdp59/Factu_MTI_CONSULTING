# 🚀 Démarrage de l'application MTI CONSULTING

## ⚠️ IMPORTANT : OAuth2 Google nécessite un serveur HTTP

L'application utilise l'authentification OAuth2 de Google pour le calendrier. Cette technologie **ne fonctionne pas** avec le protocole `file://` (ouverture directe du fichier).

Vous **DEVEZ** servir l'application via un serveur HTTP local.

---

## ✅ Solution 1 : Script PowerShell automatique (RECOMMANDÉ)

Double-cliquez sur le fichier **`start-server.ps1`** dans le dossier du projet.

Le script :
- ✅ Détecte Python ou Node.js automatiquement
- ✅ Démarre le serveur sur `http://localhost:8000`
- ✅ Ouvre votre navigateur automatiquement

**Si Windows bloque l'exécution :**
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## ✅ Solution 2 : Python (manuel)

```powershell
# Dans le dossier du projet
python -m http.server 8000
```

Puis ouvrez : **http://localhost:8000/index.html**

---

## ✅ Solution 3 : Node.js

```powershell
npx http-server -p 8000
```

Puis ouvrez : **http://localhost:8000/index.html**

---

## ✅ Solution 4 : VS Code Live Server

1. Installer l'extension **"Live Server"** dans VS Code
2. Clic droit sur `index.html` → **"Open with Live Server"**
3. S'ouvre automatiquement sur `http://127.0.0.1:5500/index.html`

---

## 🔐 Configuration OAuth2 Google

L'application utilise la **nouvelle API Google Identity Services (GIS)** pour OAuth2.

Vos credentials sont configurés pour :
- ✅ `http://localhost` (tous les ports)
- ✅ `https://mtcdp59.github.io` (production)

**Client ID :** `913475747202-dg6rnc0hhu16thk3gckbnqkdcoei2a1n.apps.googleusercontent.com`

**⚠️ Important :** Au premier lancement, Google demandera les permissions. Cliquez sur "Continuer" même si vous voyez un avertissement "Application non vérifiée" (c'est normal pour une app en développement).

---

## 📅 Fonctionnalités du calendrier

Une fois connecté à Google :

- **Créer un RDV** : Cliquez + glissez sur une plage horaire
- **Déplacer** : Glissez-déposez un événement
- **Redimensionner** : Tirez le bas d'un événement pour ajuster la durée
- **Modifier/Supprimer** : Cliquez sur un événement

**Plage horaire affichée :** 8h - 20h  
**Semaine :** Du lundi au dimanche  
**Langue :** Français

---

## 🐛 Dépannage

### Erreur "Invalid cookiePolicy" ou "CORS"
➡️ Vous n'utilisez pas de serveur HTTP. Utilisez l'une des solutions ci-dessus.

### Erreur "OAuth2 impossible en mode file://"
➡️ Même problème : démarrez un serveur HTTP local.

### Le calendrier ne se charge pas
1. Vérifiez que vous êtes sur `http://localhost` (pas `file://`)
2. Cliquez sur **"🔐 Se connecter à Google"**
3. Acceptez les permissions Google Calendar

---

## 📞 Support

En cas de problème, vérifiez :
1. ✅ Serveur HTTP démarré (`http://localhost:8000`)
2. ✅ Bouton "Se connecter à Google" cliqué
3. ✅ Permissions Google Calendar acceptées
4. ✅ Console navigateur (F12) pour voir les erreurs détaillées
