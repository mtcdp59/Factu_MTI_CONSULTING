/**
 * ============================================
 * FUNCTIONS TO ADD TO GOOGLE APPS SCRIPT BACKEND
 * Quote (Devis) Management - Sheets Synchronization
 * ============================================
 * 
 * Copy-paste these functions into your Google Apps Script project
 * Backend URL: https://script.google.com/macros/s/AKfycbxTOqi84ohatIrRuZ12bb2GSPd__YnyqIKpO2Pz_YE78TdWjOTPv82gmOtQnF9w4GY_/exec
 * 
 * IMPORTANT: You need to create a "Devis" sheet in your Google Spreadsheet first.
 */

// ============================================
// 1. ACTION: sync_quotes
// Export quotes to Google Sheets
// ============================================

/**
 * Export quotes to Google Sheets (overwrites existing data)
 * @param {Object} params - { sheetId: string, quotes: Array }
 * @return {Object} { success: boolean, data: { count: number } }
 */
function sync_quotes(params) {
  try {
    const { sheetId, quotes } = params;
    
    if (!sheetId) {
      throw new Error('sheetId manquant');
    }
    
    if (!quotes || !Array.isArray(quotes)) {
      throw new Error('quotes doit être un tableau');
    }
    
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    let sheet = spreadsheet.getSheetByName('Devis');
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Devis');
    }
    
    // Clear existing content
    sheet.clear();
    
    // Headers
    const headers = [
      'Numéro',
      'Client',
      'Client SIRET',
      'Client Adresse',
      'Date',
      'Validité',
      'Statut',
      'Description',
      'Montant HT',
      'Montant TTC',
      'Facture liée',
      'Créé le',
      'Notes'
    ];
    
    sheet.appendRow(headers);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#218c8d');
    headerRange.setFontColor('#ffffff');
    
    // Add data rows
    quotes.forEach(quote => {
      const row = [
        quote.number || '',
        quote.client || '',
        quote.clientSiret || '',
        quote.clientAddress || '',
        quote.date || '',
        quote.validityDate || '',
        quote.status || '',
        formatQuoteDescription(quote.items || []),
        quote.totalHT || 0,
        quote.total || 0,
        quote.linkedInvoice || '',
        quote.createdAt || '',
        quote.notes || ''
      ];
      
      sheet.appendRow(row);
    });
    
    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
    return {
      success: true,
      data: { count: quotes.length }
    };
  } catch (error) {
    return {
      success: false,
      data: error.message || 'Erreur inconnue'
    };
  }
}

/**
 * Format quote items for display in Sheets
 * @param {Array} items - Quote line items
 * @return {string} Formatted description
 */
function formatQuoteDescription(items) {
  if (!items || items.length === 0) return '';
  
  return items.map(item => {
    const desc = item.description || '';
    const qty = item.quantity || 0;
    const price = item.unitPrice || 0;
    return `${desc} (${qty} × ${price}€)`;
  }).join(' | ');
}

// ============================================
// 2. ACTION: import_quotes
// Import quotes from Google Sheets
// ============================================

/**
 * Import quotes from Google Sheets
 * @param {Object} params - { sheetId: string }
 * @return {Object} { success: boolean, data: { quotes: Array } }
 */
function import_quotes(params) {
  try {
    const { sheetId } = params;
    
    if (!sheetId) {
      throw new Error('sheetId manquant');
    }
    
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName('Devis');
    
    if (!sheet) {
      throw new Error('Feuille "Devis" introuvable. Créez d\'abord un onglet "Devis" dans votre Google Sheets.');
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      // Only header or empty
      return {
        success: true,
        data: { quotes: [] }
      };
    }
    
    // Parse rows (skip header)
    const quotes = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows
      if (!row[0] && !row[1]) continue;
      
      const quote = {
        number: row[0] || '',
        client: row[1] || '',
        clientSiret: row[2] || '',
        clientAddress: row[3] || '',
        date: row[4] || '',
        validityDate: row[5] || '',
        status: row[6] || 'Brouillon',
        // items will be reconstructed from description if needed
        items: parseQuoteDescription(row[7] || ''),
        totalHT: parseFloat(row[8]) || 0,
        total: parseFloat(row[9]) || 0,
        linkedInvoice: row[10] || '',
        createdAt: row[11] || '',
        notes: row[12] || ''
      };
      
      quotes.push(quote);
    }
    
    return {
      success: true,
      data: { quotes }
    };
  } catch (error) {
    return {
      success: false,
      data: error.message || 'Erreur inconnue'
    };
  }
}

/**
 * Parse description back to items array (best effort)
 * @param {string} description - Formatted description
 * @return {Array} Items array
 */
function parseQuoteDescription(description) {
  if (!description) return [];
  
  // Try to parse "Desc (qty × price€) | Desc2 (qty × price€)"
  const parts = description.split(' | ');
  return parts.map(part => {
    const match = part.match(/^(.*?)\s*\((\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)€\)$/);
    if (match) {
      return {
        description: match[1].trim(),
        quantity: parseFloat(match[2]),
        unitPrice: parseFloat(match[3]),
        total: parseFloat(match[2]) * parseFloat(match[3])
      };
    }
    // Fallback: single line item
    return {
      description: part,
      quantity: 1,
      unitPrice: 0,
      total: 0
    };
  });
}

// ============================================
// INSTRUCTIONS D'INSTALLATION
// ============================================

/*
ÉTAPES D'INSTALLATION :

1. Ouvrez votre projet Google Apps Script backend
   URL: https://script.google.com/home/projects/[VOTRE_PROJECT_ID]

2. Copiez-collez ces 3 fonctions dans votre fichier Code.gs :
   - sync_quotes(params)
   - import_quotes(params)
   - formatQuoteDescription(items) [helper]
   - parseQuoteDescription(description) [helper]

3. Dans votre Google Spreadsheet, créez un nouvel onglet nommé "Devis"
   URL: https://docs.google.com/spreadsheets/d/1Zu6I-c64YrBdlfvWhiVnlbwbvhv6Mw5NL8iRn2mvXoE

4. Dans le fichier doPost() de votre backend, ajoutez ces actions :
   
   function doPost(e) {
     const params = JSON.parse(e.postData.contents);
     const action = params.action;
     
     // ... existing actions ...
     
     if (action === 'sync_quotes') {
       return ContentService.createTextOutput(JSON.stringify(sync_quotes(params)))
         .setMimeType(ContentService.MimeType.JSON);
     }
     
     if (action === 'import_quotes') {
       return ContentService.createTextOutput(JSON.stringify(import_quotes(params)))
         .setMimeType(ContentService.MimeType.JSON);
     }
     
     // ... rest of doPost ...
   }

5. Déployez votre backend mis à jour (Nouvelle version)

6. Testez avec les boutons dans l'onglet DEVIS de l'application

STRUCTURE DE LA FEUILLE "Devis" :
┌─────────┬────────┬──────────────┬─────────────────┬──────────┬──────────┬─────────┬─────────────┬────────────┬────────────┬──────────────┬──────────┬───────┐
│ Numéro  │ Client │ Client SIRET │ Client Adresse  │ Date     │ Validité │ Statut  │ Description │ Montant HT │ Montant TTC│ Facture liée │ Créé le  │ Notes │
├─────────┼────────┼──────────────┼─────────────────┼──────────┼──────────┼─────────┼─────────────┼────────────┼────────────┼──────────────┼──────────┼───────┤
│ D-001   │ ACME   │ 12345678901  │ 10 rue Paris... │ 01/12/25 │ 31/12/25 │ Accepté │ Prestation  │ 1000       │ 1200       │ F-202512-001 │ 01/12/25 │       │
└─────────┴────────┴──────────────┴─────────────────┴──────────┴──────────┴─────────┴─────────────┴────────────┴────────────┴──────────────┴──────────┴───────┘

COLONNES EXPORTÉES :
1. Numéro : Numéro unique du devis (ex: DEVIS-202512-001)
2. Client : Nom du client
3. Client SIRET : SIRET du client
4. Client Adresse : Adresse complète
5. Date : Date d'émission
6. Validité : Date de validité du devis
7. Statut : Brouillon, Envoyé, Accepté, Refusé, Converti
8. Description : Liste des prestations (format: "Desc (qty × price€)")
9. Montant HT : Total hors taxes
10. Montant TTC : Total TTC
11. Facture liée : Numéro de facture si converti
12. Créé le : Date de création
13. Notes : Notes additionnelles

*/
