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

## � Configuration des relances automatiques

L'application dispose d'un système de relances automatiques pour les factures impayées. Celui-ci peut s'exécuter **automatiquement chaque jour à 8h**.

### 🚀 Activer le trigger automatique (optionnel)

Pour que les relances s'envoient **automatiquement**, vous devez configurer un trigger dans Google Apps Script :

#### Étape 1 : Accéder à Apps Script

1. Ouvrez https://script.google.com
2. Sélectionnez votre projet **"Factu_MTI_CONSULTING"**

#### Étape 2 : Ajouter le trigger

1. Cliquez sur **Triggers** (icône horloge) dans la barre latérale
2. Cliquez sur **"+ Add Trigger"** en bas à droite
3. Configurez comme suit :

| Paramètre | Valeur |
|-----------|--------|
| **Function** | `checkAndSendRelances` |
| **Event source** | Time-driven |
| **Type** | Day timer |
| **Time of day** | 8am - 9am |

4. Cliquez **"Save"**

#### Étape 3 : Autorisations

À la première exécution, Google demande les permissions :
- ✅ Accès à Gmail pour envoyer les emails
- ✅ Accès à Google Drive pour lire/écrire les fichiers
- ✅ Accès au calendrier (optionnel)

Acceptez les permissions pour continuer.

#### ✅ C'est prêt !

À partir de **demain à 8h**, le système vérifiera automatiquement :
- 📅 Les factures en retard depuis 7 jours → Relance niveau 1 (rappel aimable)
- 📅 Les factures en retard depuis 15 jours → Relance niveau 2 (relance ferme)
- 📅 Les factures en retard depuis 30 jours → Relance niveau 3 (mise en demeure)

**Les relances ne s'envoient que pour :**
- ✅ Factures avec un client Email valide
- ✅ Clients **sans** le drapeau "Désactiver relances automatiques"
- ✅ Factures **sans** le drapeau "Désactiver relances automatiques"

### 📧 Relances manuelles

Vous pouvez **également envoyer une relance immédiatement** depuis la liste des factures :

1. Cliquez sur le bouton **🔔 Relancer** dans la ligne de la facture
2. Sélectionnez le niveau (1/2/3)
3. L'email est envoyé immédiatement

---

## 📞 Support
````

En cas de problème, vérifiez :
1. ✅ Serveur HTTP démarré (`http://localhost:8000`)
2. ✅ Bouton "Se connecter à Google" cliqué
3. ✅ Permissions Google Calendar acceptées
4. ✅ Console navigateur (F12) pour voir les erreurs détaillées
