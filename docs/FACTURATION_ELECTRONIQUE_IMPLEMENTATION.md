

## 🔄 Gestion avancée du 429 sur l'API URSSAF

Depuis décembre 2025, la gestion des erreurs 429 (Too Many Requests) sur l'API URSSAF a été renforcée pour garantir la robustesse de l'application et le respect des quotas imposés par l'API.

### Fonctionnement

- Lorsqu'une requête reçoit un code HTTP 429, le code lit désormais le header `Retry-After` si présent.
  - Si ce header est un nombre, il est interprété comme un délai en secondes avant le prochain essai.
  - S'il s'agit d'une date HTTP, le délai est calculé dynamiquement.
- Si le header n'est pas présent, un backoff exponentiel classique est appliqué (1s, 2s, 4s, 8s, etc.).
- Un jitter aléatoire est ajouté pour éviter la synchronisation des requêtes concurrentes.
- Jusqu'à 5 tentatives sont effectuées avant de retourner une erreur/fallback local.

### Avantages

- Respect strict des consignes de l'API URSSAF
- Réduction drastique du risque de blocage temporaire
- Meilleure expérience utilisateur (moins d'échecs silencieux)
- Code facilement adaptable à d'autres APIs REST

### Exemple de log

```
Rate limited on evaluate, retry after 3000ms (attempt 2)
```

### Où trouver le code ?

- Voir `app.js`, fonctions `evaluateMonEntreprise` et `fetchUrssafRule`
- Bloc de gestion du 429 et du header `Retry-After`

---
# 🔌 Facturation Électronique - Guide d'Implémentation Technique

**Date** : 16 décembre 2025  
**Deadline réglementaire** : 1er septembre 2026  
**Public** : MTI CONSULTING - Développeurs

---

## 🎯 Vue d'ensemble des options


> **Note terminologique (2025) :**
> Les termes « Option A », « Option B » et « Option C » sont utilisés ici uniquement pour la comparaison réglementaire des solutions de facturation électronique (plateforme agréée, solution interne, etc.).
> Cela ne concerne pas les méthodes de calcul URSSAF (voir docs/api-urssaf/01_DECISION.md pour la terminologie technique).

Deux approches possibles pour la conformité :

| Critère | **Option A : Partenariat Plateforme** | **Option B : Solution Compatible Interne** |
|---------|----------------------------------------|---------------------------------------------|
| **Coût initial** | Gratuit à 100€/mois | 15-25k€ (dev + certification) |
| **Coût récurrent** | 0-100€/mois | Maintenance + hosting |
| **Délai** | 10-20 jours (intégration API) | 50-70 jours (dev complet) |
| **Complexité technique** | ⭐⭐ Moyenne | ⭐⭐⭐⭐⭐ Très élevée |
| **Conformité garantie** | ✅ Oui (plateforme certifiée) | ⚠️ Audit DGFiP requis |
| **Maintenance** | Déléguée au prestataire | Interne (veille normative) |
| **Recommandation** | ✅ **Pour TPE/PME** | ❌ Grandes entreprises uniquement |

---

## 📋 OPTION A : Intégration Plateforme Agréée (RECOMMANDÉE)

### Principe
Votre application **MTI CONSULTING** reste le système de facturation principal, mais délègue l'émission/réception e-invoicing et e-reporting à une plateforme agréée via API REST.

---

### Étape 1 : Choix de la plateforme (2-3 jours)

#### Plateformes gratuites pour TPE
1. **Chorus Pro** (État français)
   - Gratuit pour toutes les entreprises
   - API publique documentée
   - Déjà utilisé pour facturation secteur public
   - [Documentation API](https://chorus-pro.gouv.fr/qualif/api/)
   - [Spécifications externes Chorus Pro](https://portail.chorus-pro.gouv.fr/aife_documentation?id=kb_article_view&sysparm_article=KB0011471)
   
2. **Alternatives certifiées gratuites**
   - Vérifier la [liste officielle DGFiP](https://www.impots.gouv.fr/liste-des-plateformes-agreees-immatriculees-sous-reserve)
   - Filtrer par "Gratuit TPE/PME"

#### Critères de sélection
- [ ] Gratuité pour volume < 100 factures/mois
- [ ] API REST bien documentée
- [ ] Support technique réactif
- [ ] Interface d'administration web (monitoring)
- [ ] Conformité formats Factur-X + CII
- [ ] Annuaire facturation électronique intégré

**Recommandation MTI CONSULTING** : **Chorus Pro** (gratuit, fiable, gouvernemental)

#### Normes AFNOR obligatoires (socle commun)

Trois normes AFNOR définissent le cadre technique (téléchargement gratuit) :

- **XP Z12-012** : Formats et profils des messages (Factures + Statuts de cycle de vie)
  - [Accès AFNOR](https://www.boutique.afnor.org/fr-fr/norme/xp-z12012/formats-et-profils-des-messages-factures-et-statuts-de-cycle-de-vie-constit/fa213746/452462)
  - Définit la structure Factur-X et CII conforme EN 16931

- **XP Z12-013** : API pour interfacer les SI des entreprises avec les plateformes
  - [Accès AFNOR](https://www.boutique.afnor.org/fr-fr/norme/xp-z12013/api-pour-interfacer-les-systemes-dinformations-des-entreprises-avec-les-pla/fa213747/452463)
  - Endpoints REST, OAuth2, webhooks

- **XP Z12-014** : Cas d'usage B2B applicables
  - [Accès AFNOR](https://www.boutique.afnor.org/fr-fr/norme/xp-z12014/cas-dusage-b2b-applicables-dans-le-cadre-la-reforme-facture-electronique-en/fa213748/452464)
  - Workflows émission, réception, statuts, rejets

---

### Étape 2 : Inscription & immatriculation (1 jour)

#### Sur Chorus Pro
1. **Créer un compte** : [portail.chorus-pro.gouv.fr](https://portail.chorus-pro.gouv.fr/)
   - SIRET : `994 149 904 00017`
  - Email : `contact@mticonsulting.fr`
   
2. **Activer l'API**
   - Menu "Gestion des comptes" → "Créer un compte technique"
   - Générer les credentials OAuth2 (client_id + client_secret)
   - Télécharger certificat SSL (si requis)
   
3. **Environnement de test**
   - URL bac à sable : `https://chorus-pro.gouv.fr/qualif/api/`
   - Tester avec SIRET fictifs fournis dans la doc
   - [Spécifications B2B v3.1](https://www.impots.gouv.fr/specifications-externes-b2b) (XSD, Swagger, exemples)

---

### Étape 2bis : Comprendre PISTE (Interface Éditeurs) ⚠️ IMPORTANT

#### Qu'est-ce que PISTE ?

**PISTE** (Plateforme d'Interopérabilité Sécurisée des Transmissions Électroniques) est **l'interface obligatoire** pour les éditeurs de logiciels souhaitant intégrer Chorus Pro.

```
MTI CONSULTING (app.js + backend)
         ↓
    [OAuth2 token]
         ↓
   🔌 API PISTE (Interface éditeurs)
         ↓
   Chorus Pro (Backend gouvernemental)
         ↓
   Portail Public de Facturation (PPF)
```

#### Architecture technique

1. **Accès direct Chorus Pro** (portail web uniquement)
   - Pour utilisateurs manuels
   - Interface graphique uniquement
   - Pas d'API programmatique

2. **Accès via PISTE** (pour logiciels/API) ✅ **VOTRE CAS**
   - API REST sécurisée
   - OAuth2 authentication
   - Endpoints dédiés éditeurs
   - **Obligatoire pour intégration logicielle**

#### URLs PISTE

**Production** :
- Base URL : `https://api.piste.gouv.fr`
- OAuth : `https://api.piste.gouv.fr/oauth/token`
- API Base : `https://api.piste.gouv.fr/cpro/v1`
- Swagger : `https://api.piste.gouv.fr/swagger-ui.html`

**Qualification (tests)** :
- Base URL : `https://sandbox-api.piste.gouv.fr`
- OAuth : `https://sandbox-api.piste.gouv.fr/oauth/token`
- API Base : `https://sandbox-api.piste.gouv.fr/cpro/v1`
- Swagger : `https://sandbox-api.piste.gouv.fr/swagger-ui.html`

#### Credentials MTI CONSULTING

**Application PISTE créée** : `PISTE_MTI_CONSULTING`

```
URL API: https://api.piste.gouv.fr

OAuth2 Credentials:
Client ID: 34b37cc5-2c5d-4272-b411-0940742714ec
Client Secret: 3af5bad7-5c77-4908-8dbb-ae67e6e82dc2

Compte Technique Chorus Pro:
Login: TECH_1_99414990400017@cpro.fr
Password: fajspJ(9hubty

SIRET: 994 149 904 00017
```

✅ **Raccordement Chorus Pro activé**

Ces credentials OAuth fonctionnent avec **PISTE API** pour accéder à Chorus Pro.

#### Documentation PISTE

- [Guide intégration PISTE](https://piste.chorus-pro.gouv.fr/qualif/api/documentation)
- [Spécifications API v3.1](https://www.impots.gouv.fr/specifications-externes-b2b)
- Swagger interactif pour tests

#### B2G vs B2B

**PISTE permet les deux** :

1. **B2G (Business to Government)** - Disponible maintenant
   - Facturation vers administrations publiques
   - Gratuit pour toutes entreprises
   - Obligatoire depuis 2020 pour factures > certains seuils

2. **B2B (Business to Business)** - Obligatoire 1er sept. 2026
   - Facturation entre entreprises privées
   - Gratuit via Chorus Pro/PISTE
   - Transmission e-reporting automatique vers DGFiP

**Vos credentials PISTE fonctionnent pour les deux cas d'usage.**

---

### Étape 3 : Adaptation architecture MTI CONSULTING (3-5 jours)

#### Modifications `app.js` (frontend)

**Nouveau bouton dans interface facture** :
```javascript
// Dans displayInvoices() - Ajouter colonne "E-invoicing"
function displayInvoices() {
  // ... code existant ...
  
  invoices.forEach(inv => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${inv.number}</td>
      <td>${inv.client}</td>
      <td>${formatNumber(inv.total)} €</td>
      <td><span class="badge ${getStatusClass(inv.status)}">${inv.status}</span></td>
      
      <!-- NOUVEAU : Badge e-invoicing -->
      <td>
        ${inv.eInvoicingStatus ? 
          `<span class="badge badge-success">✅ Envoyée</span>` : 
          `<button onclick="sendToChorusPro('${inv.id}')" class="btn-chorus">📤 Chorus Pro</button>`
        }
      </td>
      
      <td>
        <button onclick="viewInvoice('${inv.id}')">👁️</button>
        <button onclick="sendInvoiceEmail('${inv.id}')">📧</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}
```

**Fonction d'envoi Chorus Pro** :
```javascript
async function sendToChorusPro(invoiceId) {
  try {
    const invoice = invoices.find(i => i.id == invoiceId);
    if (!invoice) throw new Error('Facture introuvable');
    
    showMessage('⏳ Envoi vers Chorus Pro...', 'info');
    
    // 1. Générer PDF Factur-X (format hybride)
    const facturXPdf = await generateFacturXPDF(invoice);
    
    // 2. Appeler backend Google Apps Script
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'sendToChorusPro',
        invoice: invoice,
        facturXPdf: facturXPdf // Base64 du PDF Factur-X
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Mettre à jour statut local
      invoice.eInvoicingStatus = 'sent';
      invoice.eInvoicingId = result.data.chorusId;
      invoice.eInvoicingDate = new Date().toISOString();
      
      await saveToDrive();
      displayInvoices();
      
      showMessage('✅ Facture envoyée à Chorus Pro', 'success');
    } else {
      throw new Error(result.data);
    }
    
  } catch (error) {
    console.error('Erreur Chorus Pro:', error);
    showMessage('❌ Échec envoi Chorus Pro: ' + error.message, 'error');
  }
}
```

**Génération Factur-X** (bibliothèque JavaScript) :
```javascript
// Utiliser factur-x.js (à ajouter via CDN ou npm)
// https://github.com/zugferd/mustangproject (version JS)

async function generateFacturXPDF(invoice) {
  // 1. Générer PDF classique (existant)
  const pdfBytes = await generateInvoicePDFBase64(invoice);
  
  // 2. Créer XML CII EN 16931
  const xmlCII = generateCIIXML(invoice);
  
  // 3. Hybrider PDF + XML (Factur-X)
  const facturX = await embedXMLInPDF(pdfBytes, xmlCII);
  
  return facturX; // Base64
}

function generateCIIXML(invoice) {
  // Générer XML conforme EN 16931 (18 champs obligatoires)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
                          xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
                          xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  
  <!-- 1. Identifiant facture -->
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  
  <!-- 2. Métadonnées -->
  <rsm:ExchangedDocument>
    <ram:ID>${invoice.number}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode> <!-- 380 = Facture commerciale -->
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDateCII(invoice.date)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  
  <!-- 3. Parties (vendeur = MTI CONSULTING) -->
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${companyInfo.name}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${companyInfo.siret.replace(/\s/g, '')}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:LineOne>${companyInfo.address}</ram:LineOne>
          <ram:PostcodeCode>${companyInfo.postalCode}</ram:PostcodeCode>
          <ram:CityName>${companyInfo.city}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${companyInfo.email}</ram:URIID>
        </ram:URIUniversalCommunication>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">FR${companyInfo.siret.substring(0, 2)}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      
      <!-- Client -->
      <ram:BuyerTradeParty>
        <ram:Name>${invoice.client}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${invoice.clientSiret || ''}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:LineOne>${invoice.clientAddress || ''}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    
    <!-- 4. Lignes de facturation -->
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>1</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${invoice.items[0].description}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${invoice.items[0].unitPrice}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${invoice.items[0].quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${invoice.tvaRate || 20}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${invoice.items[0].total}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    
    <!-- 5. Totaux -->
    <ram:ApplicableHeaderTradeSettlement>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${invoice.totalHT}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${invoice.totalHT}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${invoice.totalTVA}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${invoice.total}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${invoice.total}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
  
  return xml;
}

function formatDateCII(dateStr) {
  // Convertir "2024-12-16" en "20241216" (format CII)
  return dateStr.replace(/-/g, '');
}

async function embedXMLInPDF(pdfBase64, xmlString) {
  // Utiliser pdf-lib + factur-x.js pour embedder le XML
  // https://github.com/Hopding/pdf-lib
  
  const { PDFDocument } = window.PDFLib;
  
  // 1. Charger PDF existant
  const pdfDoc = await PDFDocument.load(pdfBase64);
  
  // 2. Créer attachement XML
  const xmlBytes = new TextEncoder().encode(xmlString);
  
  await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
    mimeType: 'application/xml',
    description: 'Factur-X BASIC/EN 16931',
    creationDate: new Date(),
    modificationDate: new Date()
  });
  
  // 3. Ajouter métadonnées XMP (PDF/A-3)
  const xmpMetadata = generateXMPMetadata();
  pdfDoc.setTitle('Facture Factur-X');
  pdfDoc.setSubject('Facture électronique conforme EN 16931');
  pdfDoc.setKeywords(['Factur-X', 'EN16931', 'Invoice']);
  pdfDoc.setProducer('MTI CONSULTING - Factu App');
  pdfDoc.setCreator('MTI CONSULTING');
  
  // 4. Sauvegarder
  const pdfBytes = await pdfDoc.save();
  
  // Convertir en Base64
  return btoa(String.fromCharCode(...pdfBytes));
}
```

---

### Étape 4 : Backend Google Apps Script (5-8 jours)

**Nouveau fichier** : `backend/ChorusProAPI.js`

```javascript
// ==========================================
// CHORUS PRO API INTEGRATION
// ==========================================

const CHORUS_CONFIG = {
  // Production (via PISTE - Interface éditeurs)
  // Application: PISTE_MTI_CONSULTING
  OAUTH_URL: 'https://api.piste.gouv.fr/oauth/token',
  API_BASE: 'https://api.piste.gouv.fr/cpro/v1',
  
  // Qualification/Tests (via PISTE)
  OAUTH_URL_QUAL: 'https://sandbox-api.piste.gouv.fr/oauth/token',
  API_BASE_QUAL: 'https://sandbox-api.piste.gouv.fr/cpro/v1',
  
  // Credentials OAuth2 PISTE MTI CONSULTING
  CLIENT_ID: PropertiesService.getScriptProperties().getProperty('PISTE_CLIENT_ID') || '34b37cc5-2c5d-4272-b411-0940742714ec',
  CLIENT_SECRET: PropertiesService.getScriptProperties().getProperty('PISTE_CLIENT_SECRET') || '3af5bad7-5c77-4908-8dbb-ae67e6e82dc2',
  
  // SIRET MTI CONSULTING
  SIRET: '99414990400017'
};

/**
 * Envoyer une facture vers Chorus Pro
 * @param {Object} invoice - Facture MTI CONSULTING
 * @param {string} facturXPdf - PDF Factur-X en base64
 */
function sendToChorusPro(invoice, facturXPdf) {
  try {
    // 1. Obtenir token OAuth2
    const token = getChorusToken();
    
    // 2. Rechercher destinataire dans annuaire
    const recipientSiret = invoice.clientSiret.replace(/\s/g, '');
    const recipient = findRecipientInDirectory(recipientSiret, token);
    
    if (!recipient) {
      throw new Error('Client non trouvé dans l\'annuaire Chorus Pro. SIRET: ' + recipientSiret);
    }
    
    // 3. Uploader le PDF Factur-X
    const fileId = uploadFile(facturXPdf, invoice.number + '.pdf', token);
    
    // 4. Créer la facture dans Chorus Pro
    const chorusInvoice = {
      numeroFacture: invoice.number,
      dateFacture: invoice.date,
      montantHT: invoice.totalHT,
      montantTVA: invoice.totalTVA,
      montantTTC: invoice.total,
      devise: 'EUR',
      
      // Émetteur
      siretEmetteur: CHORUS_CONFIG.SIRET,
      
      // Destinataire
      siretDestinataire: recipientSiret,
      codeServiceExecutant: recipient.codeService || '00000',
      
      // Fichier
      pieceJointePrincipale: {
        fichier: fileId,
        designation: 'Facture ' + invoice.number
      },
      
      // Mode transmission
      modeDepot: 'API_PLATEFORME',
      cadreFacturation: 'A1_FACTURE_FOURNISSEUR'
    };
    
    // 5. Soumettre à Chorus Pro
    const response = UrlFetchApp.fetch(CHORUS_CONFIG.API_BASE + '/factures/deposer', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(chorusInvoice),
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() === 201) {
      Logger.log('✅ Facture déposée sur Chorus Pro: ' + result.identifiantFactureCPP);
      
      return createResponse(true, {
        chorusId: result.identifiantFactureCPP,
        numeroFlux: result.numeroFluxDepot,
        statut: result.statutCourant
      });
    } else {
      throw new Error('Chorus Pro error: ' + JSON.stringify(result));
    }
    
  } catch (error) {
    Logger.log('❌ Erreur Chorus Pro: ' + error.toString());
    return createResponse(false, error.toString());
  }
}

/**
 * Obtenir un token OAuth2 Chorus Pro
 */
function getChorusToken() {
  const response = UrlFetchApp.fetch(CHORUS_CONFIG.OAUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    payload: {
      grant_type: 'client_credentials',
      client_id: CHORUS_CONFIG.CLIENT_ID,
      client_secret: CHORUS_CONFIG.CLIENT_SECRET,
      scope: 'openid profile'
    }
  });
  
  const json = JSON.parse(response.getContentText());
  return json.access_token;
}

/**
 * Rechercher un destinataire dans l'annuaire Chorus Pro
 */
function findRecipientInDirectory(siret, token) {
  const response = UrlFetchApp.fetch(
    CHORUS_CONFIG.API_BASE + '/annuaire/rechercher?siret=' + siret,
    {
      headers: { 'Authorization': 'Bearer ' + token }
    }
  );
  
  const results = JSON.parse(response.getContentText());
  return results.length > 0 ? results[0] : null;
}

/**
 * Uploader un fichier (PDF Factur-X)
 */
function uploadFile(base64Content, filename, token) {
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64Content),
    'application/pdf',
    filename
  );
  
  const formData = {
    fichier: blob
  };
  
  const response = UrlFetchApp.fetch(CHORUS_CONFIG.API_BASE + '/fichiers/uploader', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    payload: formData
  });
  
  const result = JSON.parse(response.getContentText());
  return result.identifiantFichier;
}
```

**Ajouter au routeur** (`backend/AppScript.js`) :
```javascript
case 'sendToChorusPro':
  response = sendToChorusPro(data.invoice, data.facturXPdf);
  break;
```

---

### Étape 5 : Configuration credentials (1 heure)

1. **Credentials PISTE MTI CONSULTING** ✅ **Déjà créés**
   ```
   Application: PISTE_MTI_CONSULTING
   URL: https://api.piste.gouv.fr
   
   OAuth2:
   Client ID: 34b37cc5-2c5d-4272-b411-0940742714ec
   Client Secret: 3af5bad7-5c77-4908-8dbb-ae67e6e82dc2
   
   Chorus Pro (compte technique):
   Login: TECH_1_99414990400017@cpro.fr
   Password: fajspJ(9hubty
   
   SIRET: 994 149 904 00017
   ```

2. **Stocker dans Google Apps Script**
   ```javascript
   // Exécuter une fois dans l'éditeur Apps Script
   function setupPisteCredentials() {
     const props = PropertiesService.getScriptProperties();
     
     // Credentials OAuth2 PISTE MTI CONSULTING
     props.setProperty('PISTE_CLIENT_ID', '34b37cc5-2c5d-4272-b411-0940742714ec');
     props.setProperty('PISTE_CLIENT_SECRET', '3af5bad7-5c77-4908-8dbb-ae67e6e82dc2');
     
     Logger.log('✅ Credentials PISTE OAuth2 configurés');
     Logger.log('Application: PISTE_MTI_CONSULTING');
     Logger.log('Raccordement Chorus Pro: Actif');
   }
   ```

3. **Vérifier accès PISTE**
   - Swagger UI production : [api.piste.gouv.fr/swagger-ui.html](https://api.piste.gouv.fr/swagger-ui.html)
   - Swagger UI sandbox : [sandbox-api.piste.gouv.fr/swagger-ui.html](https://sandbox-api.piste.gouv.fr/swagger-ui.html)
   - Tester endpoint OAuth2 avec vos credentials
   - Vérifier annuaire accessible

---

### Étape 6 : Procédure de test bac à sable / qualification

#### 1. Environnements à utiliser

- **Qualification / Sandbox PISTE** :
  - Base API : https://sandbox-api.piste.gouv.fr/cpro/v1
  - OAuth2 : https://sandbox-api.piste.gouv.fr/oauth/token
  - Swagger : https://sandbox-api.piste.gouv.fr/swagger-ui.html
- **Portail de qualification Chorus Pro** :
  - https://qualif.chorus-pro.gouv.fr/
  - Documentation : https://communaute.chorus-pro.gouv.fr/documentation/

#### 2. SIRET à utiliser pour les tests

- Utiliser uniquement les SIRET de démonstration fournis par Chorus Pro pour les appels annuaire/structure en sandbox.
- Exemple : SIRET test DGFiP : 13002526500013
- Les SIRET réels (ex : MTI CONSULTING) ne sont pas présents dans la base de test et renverront 404 (comportement normal).

#### 3. Procédure de test

1. Authentification OAuth2 sur https://sandbox-api.piste.gouv.fr/oauth/token avec vos credentials PISTE (voir plus haut).
   - Succès attendu : code 200, token reçu.
2. Appel annuaire avec SIRET de démonstration :
   - Endpoint : /cpro/v1/annuaire/rechercher?siret=13002526500013
   - Succès attendu : code 200, résultats trouvés.
   - Si SIRET réel : code 404 attendu.
3. Appel structure avec SIRET de démonstration ou réel :
   - Endpoint : /cpro/v1/structures/siret/13002526500013
   - Succès attendu : code 200 si SIRET de démo, 404 sinon.
4. Tester l’envoi de facture, la récupération de statuts, etc. sur l’environnement de qualification.

#### 4. Liens utiles

- [Swagger API Sandbox](https://sandbox-api.piste.gouv.fr/swagger-ui.html)
- [Portail qualification Chorus Pro](https://qualif.chorus-pro.gouv.fr/)
- [Documentation officielle](https://communaute.chorus-pro.gouv.fr/documentation/)

#### 5. Résultats attendus

- OAuth2 : code 200, token reçu
- Annuaire/structure avec SIRET de démo : code 200, données trouvées
- Annuaire/structure avec SIRET réel : code 404 (normal)
- Envoi facture : code 200 ou 201 si succès, erreurs détaillées sinon

#### 6. Bonnes pratiques

- Toujours séparer les credentials et endpoints prod/sandbox
- Ne jamais tester de SIRET réel en sandbox pour l’annuaire
- Documenter les jeux de tests utilisés

---

### Étape 7 : Mise en production (1 jour)

1. **Basculer vers production**
   - `API_BASE` au lieu de `API_BASE_QUAL`
   - Credentials production

2. **Communication clients**
   - Email aux clients : "À partir du 1er sept. 2026, factures électroniques"
   - Vérifier que leurs SIRET sont dans annuaire Chorus Pro

3. **Monitoring**
   - Dashboard Chorus Pro : suivi statuts factures
   - Logs Apps Script : erreurs API

---

### Coût total Option A
- **Développement** : 10-20 jours (1 dev)
- **Plateforme** : 0€/mois (Chorus Pro gratuit)
- **Maintenance** : Minime (veille API Chorus Pro)

---

## 🛠️ OPTION B : Solution Compatible Interne (AVANCÉ)

### Principe
Développer une **plateforme compatible** complète qui gère tout en interne, puis demander l'immatriculation DGFiP.

⚠️ **Cette option est déconseillée pour MTI CONSULTING** (complexité + coût prohibitif).

---

### Étape 1 : Architecture système (10 jours)

#### Composants requis

1. **Serveur backend robuste**
   - Node.js/Python/Java (pas Google Apps Script - quotas insuffisants)
   - Base de données PostgreSQL/MySQL (historique factures)
   - Redis (cache + queues)

2. **Module génération Factur-X/CII**
   - Bibliothèque factur-x
   - Validation XSD EN 16931
   - Signature électronique (certificat eIDAS)

3. **API REST e-invoicing**
   - Endpoints :
     - `POST /api/invoices/send` (émission)
     - `POST /api/invoices/receive` (réception)
     - `GET /api/invoices/{id}/status` (consultation)
   - OAuth2 pour authentification

4. **Module e-reporting**
   - Transmission automatique données → DGFiP
   - Format JSON/XML défini par décret
   - Chiffrement AES-256

5. **Annuaire entreprises**
   - Import annuaire facturation électronique (API publique)
   - Mise à jour quotidienne
   - Routage factures vers plateformes destinataires

6. **Interface administration**
   - Dashboard monitoring
   - Gestion utilisateurs
   - Logs audits

---

### Étape 2 : Développement (30-40 jours)

**Stack technique recommandée** :
```yaml
Backend:
  - Runtime: Node.js 20 LTS
  - Framework: NestJS (TypeScript)
  - ORM: Prisma (PostgreSQL)
  - Queue: Bull (Redis)
  - Logs: Winston + Elasticsearch

Sécurité:
  - OAuth2: Auth0 ou Keycloak
  - Certificats: Let's Encrypt + eIDAS
  - Chiffrement: node-forge (AES-256-GCM)

Génération PDF:
  - jsPDF ou PDFKit
  - factur-x-nodejs (hybridation XML)

Conformité:
  - Validateur XSD EN 16931
  - Tests unitaires (Jest) + E2E (Supertest)
```

**Coût développement** :
- 1 développeur senior : 40 jours × 500€/jour = **20 000€**
- Infrastructure AWS/GCP : 200€/mois

---

### Étape 3 : Certification DGFiP (15-20 jours)

1. **Dossier d'immatriculation**
   - Formulaire Cerfa dédié (à publier)
   - Justificatifs entreprise (K-bis, statuts)
   - Architecture technique détaillée
   - Procédures sécurité/RGPD

2. **Audit conformité**
   - Tests fonctionnels (DGFiP ou organisme agréé)
   - Vérification formats (Factur-X, CII, e-reporting)
   - Contrôle sécurité (chiffrement, authentification)

3. **Coût audit** : 5 000 - 10 000€

4. **Délai** : 3-6 mois (instruction dossier)

---

### Étape 4 : Maintenance continue

- **Veille normative** : Suivi évolutions EN 16931, décrets DGFiP
- **Mises à jour** : Patchs sécurité, nouvelles fonctionnalités
- **Support clients** : Hotline, documentation
- **Coût annuel** : 10-15k€

---

### Coût total Option B
- **Développement initial** : 20 000€
- **Certification DGFiP** : 5 000 - 10 000€
- **Infrastructure annuelle** : 2 400€ (200€/mois)
- **Maintenance annuelle** : 10 000€

**Total première année** : **~40 000€**

---

## 🎯 Décision finale pour MTI CONSULTING

### Recommandation : **OPTION A** (Chorus Pro)

#### Justification
✅ **Coût** : Gratuit vs 40k€  
✅ **Délai** : 20 jours vs 90 jours  
✅ **Complexité** : API simple vs plateforme complète  
✅ **Conformité** : Garantie (Chorus Pro certifié) vs audit requis  
✅ **Maintenance** : Déléguée vs interne  

#### Prochaines actions immédiates
1. ✅ **S'inscrire sur Chorus Pro** (1h)
2. ✅ **Créer compte technique API** (30min)
3. ✅ **Télécharger documentation API** (30min)
4. 🔲 **Prototype intégration** (5 jours)
   - Ajouter bouton "Chorus Pro" dans interface factures
   - Implémenter génération Factur-X basique
   - Tester envoi en qualification

---

## 📚 Ressources complémentaires

### Documentation officielle DGFiP
- **[Spécifications externes B2B v3.1](https://www.impots.gouv.fr/specifications-externes-b2b)** (31/10/2025)
  - Package complet : XSD, Swagger, exemples, annexes
  - [Télécharger v3.1 (.zip)](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/specification_externes_b2b/specifications-externes-v3.1.zip)
  - Formats sémantiques : e-invoicing (flux 1&2), CDV, annuaire, e-reporting (flux 8/9/10)
  - Contact DGFiP : [formulaire AIFE](https://aife.economie.gouv.fr/formulaire-de-contact-ppf)

- **PISTE - API Éditeurs** ⭐ **INTERFACE PRINCIPALE**
  - **Application MTI** : `PISTE_MTI_CONSULTING`
  - **[Swagger UI Production](https://api.piste.gouv.fr/swagger-ui.html)** (production)
  - **[Swagger UI Sandbox](https://sandbox-api.piste.gouv.fr/swagger-ui.html)** (tests)
  - Base URL : `https://api.piste.gouv.fr`
  - Documentation API PISTE complète
  - Endpoints OAuth2, annuaire, dépôt factures, statuts
  - **Credentials OAuth2** : `34b37cc5-2c5d-4272-b411-0940742714ec`
  - **Raccordement Chorus Pro** : ✅ Actif

- **[Spécifications Chorus Pro](https://portail.chorus-pro.gouv.fr/aife_documentation?id=kb_article_view&sysparm_article=KB0011471)**
  - Documentation portail web (utilisation manuelle)
  - Cas d'usage B2G et B2B

### Normes AFNOR (socle commun)
- **[XP Z12-012](https://www.boutique.afnor.org/fr-fr/norme/xp-z12012/)** : Formats Factur-X/CII
- **[XP Z12-013](https://www.boutique.afnor.org/fr-fr/norme/xp-z12013/)** : API plateformes agréées
- **[XP Z12-014](https://www.boutique.afnor.org/fr-fr/norme/xp-z12014/)** : Cas d'usage B2B
- [Spécification Factur-X FNFE](https://fnfe-mpe.org/wp-content/uploads/2021/04/Factur-X_Spec_1.0.06.pdf)
- [Norme EN 16931 (CEN)](https://standards.cen.eu/dyn/www/f?p=204:110:0::::FSP_PROJECT,FSP_ORG_ID:60602,2298794&cs=1B0F862919A7304F13AE3F89B4E3D6368)

### Bibliothèques open source
- **JavaScript** :
  - [factur-x.js](https://github.com/horstoeko/factur-x-js) (hybridation PDF+XML)
  - [pdf-lib](https://pdf-lib.js.org/) (manipulation PDF)
  
- **Python** :
  - [factur-x](https://github.com/invoice-x/factur-x) (référence)
  
- **Java** :
  - [Mustang Project](https://github.com/ZUGFeRD/mustangproject) (Factur-X complet)

### Exemples de code
- [Chorus Pro API - Exemples](https://github.com/chorus-pro) (si public)
- [Factur-X samples](https://fnfe-mpe.org/ressources/)

---

**Dernière mise à jour** : 16 décembre 2025  
**Auteur** : GitHub Copilot  
**Version** : 1.1 (spéc. DGFiP v3.1)  
**Contact support** : contact@mticonsulting.fr  
**Spécifications B2B** : v3.1 (31/10/2025) - Conforme démarrage réforme 1er sept. 2026
