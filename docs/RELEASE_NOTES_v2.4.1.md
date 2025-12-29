# v2.4.1 – Relances/factures robustes (JSONP), PDF Drive, correctif ReferenceError

Date: 2025-12-30
Tag: v2.4.1

## Points clés
- Relances et envois de factures robustes en local: fallback JSONP pour contourner CORS.
- Réutilisation des PDFs existants en Drive pour éviter les régénérations inutiles.
- Suppression de l’alias `from` côté Gmail pour éviter les erreurs d’autorisation.
- Correctif d’un ReferenceError empêchant l’ouverture intempestive de Gmail.

## Backend
- `doGet` expose désormais:
  - `sendRelance`: envoi de relance (niveau 1/2/3) avec PJ PDF.
  - `listFilesInFolder`: lister les fichiers d’un dossier Drive (ex: Factures).
  - `sendEmailWithDriveFile`: envoyer un email avec une PJ existante (Drive `fileId`).
- `GmailApp.sendEmail`: retrait du champ `from`, envoi depuis le compte du script.
- Sélection email destinataire des relances: priorité `client.email_facturation`, puis `client.email`, puis `invoice.clientEmail`.

Voir [backend/AppScript.js](backend/AppScript.js).

## Frontend
- `sendRelanceFromList()`:
  - Vérifie d’abord si `Factures/Facture_<num>.pdf` existe en Drive; génère/sauvegarde seulement si nécessaire.
  - Fallback JSONP si POST échoue (CORS) pour éviter l’ouverture de Gmail.
- `sendInvoiceViaDrive()`:
  - Réutilise le PDF Drive si présent (listing via backend), sinon génère + sauvegarde.
  - Fallback JSONP pour `sendEmailWithDriveFile` si le POST échoue.
- Correctif: suppression du retour hors portée (`sendRes`) qui causait un `ReferenceError` et le fallback Gmail.

Voir [app.js](app.js).

## Déploiement
- Mettre à jour et déployer Apps Script en Web App (voir [DEPLOY_BACKEND.md](DEPLOY_BACKEND.md)):
  - Exécuter en tant que: vous-même.
  - Accès: Tout le monde (Anyone with the link).
  - Accepter les permissions Gmail et Drive.
- Nouvelles actions disponibles via POST/GET (JSON/JSONP): `sendRelance`, `listFilesInFolder`, `sendEmailWithDriveFile`.

## Tests rapides
- Relances:
  - Utiliser [backend/tests_relances.gs](backend/tests_relances.gs) dans Apps Script pour tester auto/manuelles sans CORS.
- JSONP GET (dans un navigateur):
  ```js
  const cb = '__cb' + Date.now();
  window[cb] = (res) => console.log(res);
  const u = 'https://script.google.com/macros/s/VOTRE_ID/exec?action=sendRelance&invoiceNumber=FAC-202512-001&level=1&callback=' + cb;
  var s = document.createElement('script'); s.src = u; document.body.appendChild(s);
  ```

## Compatibilité
- Pas de changements cassants côté API.
- Les avertissements html2canvas restent non bloquants.

## Références
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Guide déploiement: [DEPLOY_BACKEND.md](DEPLOY_BACKEND.md)
