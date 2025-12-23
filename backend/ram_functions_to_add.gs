/**
 * ============================================
 * FUNCTIONS TO ADD TO GOOGLE APPS SCRIPT BACKEND
 * ============================================
 * 
 * Copy-paste these functions into your Google Apps Script project
 * Backend URL: https://script.google.com/macros/s/AKfycbxTOqi84ohatIrRuZ12bb2GSPd__YnyqIKpO2Pz_YE78TdWjOTPv82gmOtQnF9w4GY_/exec
 */

// ============================================
// 1. ACTION: sendRAMEmail
// ============================================

/**
 * Send Monthly Activity Report (RAM) by email
 * @param {Object} params - { to, client, month, year, pdfBase64 }
 * @return {Object} { success: boolean, error?: string }
 */
function sendRAMEmail(params) {
  try {
    const { to, client, month, year, pdfBase64 } = params;
    
    if (!to) {
      throw new Error('Email destinataire manquant');
    }
    
    if (!pdfBase64) {
      throw new Error('PDF manquant');
    }
    
    // Objet de l'email
    const subject = `Rapport d'Activité Mensuelle - ${client} - ${month} ${year}`;
    
    // Corps de l'email
    const body = `Bonjour,

Veuillez trouver ci-joint le rapport d'activité mensuelle pour ${month} ${year}.

Ce rapport détaille les heures travaillées et les activités réalisées durant cette période.

Cordialement,
${companyInfo.name}

---
${companyInfo.name}
${companyInfo.address}
${companyInfo.postalCode} ${companyInfo.city}
Email: ${companyInfo.email}
Tél: ${companyInfo.phone}
SIRET: ${companyInfo.siret}`;
    
    // Créer le blob PDF depuis le base64
    const pdfBlob = Utilities.newBlob(
      Utilities.base64Decode(pdfBase64),
      'application/pdf',
      `RAM_${year}_${month}_${client.replace(/[^a-z0-9]/gi, '_')}.pdf`
    );
    
    // Envoyer l'email avec pièce jointe
    GmailApp.sendEmail(to, subject, body, {
      attachments: [pdfBlob],
      name: companyInfo.name,
      htmlBody: body.replace(/\n/g, '<br>')
    });
    
    Logger.log(`✅ RAM envoyé à ${to} pour ${client} - ${month} ${year}`);
    
    return { 
      success: true,
      message: `Email envoyé avec succès à ${to}`
    };
    
  } catch (error) {
    Logger.log(`❌ Erreur sendRAMEmail: ${error.toString()}`);
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}


// ============================================
// 2. ACTION: exportRAMToSheets
// ============================================

/**
 * Export RAM data to Google Sheets (tab "RAM")
 * @param {Object} params - { ram: { client, month, year, monthName, activities, remarks } }
 * @return {Object} { success: boolean, error?: string }
 */
function exportRAMToSheets(params) {
  try {
    const { ram } = params;
    
    if (!ram) {
      throw new Error('Données RAM manquantes');
    }
    
    // Ouvrir le Google Sheets
    const ss = SpreadsheetApp.openById(SHEETS_ID);
    
    // Créer l'onglet RAM s'il n'existe pas
    let sheet = ss.getSheetByName('RAM');
    if (!sheet) {
      sheet = ss.insertSheet('RAM');
      
      // En-têtes
      const headers = [
        'Date Export',
        'Client', 
        'Mois', 
        'Année', 
        'Jour', 
        'Date', 
        'Heures', 
        'Commentaires',
        'Remarques'
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, headers.length).setBackground('#21808D');
      sheet.getRange(1, 1, 1, headers.length).setFontColor('#FFFFFF');
      
      // Ajuster les largeurs de colonnes
      sheet.setColumnWidth(1, 150); // Date Export
      sheet.setColumnWidth(2, 150); // Client
      sheet.setColumnWidth(3, 100); // Mois
      sheet.setColumnWidth(4, 80);  // Année
      sheet.setColumnWidth(5, 100); // Jour
      sheet.setColumnWidth(6, 80);  // Date
      sheet.setColumnWidth(7, 80);  // Heures
      sheet.setColumnWidth(8, 300); // Commentaires
      sheet.setColumnWidth(9, 300); // Remarques
      
      // Figer la première ligne
      sheet.setFrozenRows(1);
    }
    
    // Préparer les données à exporter
    const exportDate = new Date().toISOString();
    const rows = [];
    
    // Exporter uniquement les jours avec des heures travaillées
    ram.activities.forEach(activity => {
      if (activity.hours && activity.hours > 0) {
        rows.push([
          exportDate,
          ram.client,
          ram.monthName,
          ram.year,
          activity.day,
          activity.dayNum,
          activity.hours,
          activity.comment || '',
          ram.remarks || ''
        ]);
      }
    });
    
    // Insérer les lignes si on a des données
    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      const startRow = lastRow + 1;
      
      sheet.getRange(startRow, 1, rows.length, 9).setValues(rows);
      
      // Formatage des nouvelles lignes
      sheet.getRange(startRow, 1, rows.length, 9).setBorder(
        true, true, true, true, true, true,
        '#CCCCCC',
        SpreadsheetApp.BorderStyle.SOLID
      );
      
      // Aligner les heures à droite
      sheet.getRange(startRow, 7, rows.length, 1).setHorizontalAlignment('right');
      
      Logger.log(`✅ ${rows.length} lignes exportées vers Sheets pour ${ram.client} - ${ram.monthName} ${ram.year}`);
    } else {
      Logger.log(`⚠️ Aucune activité à exporter (toutes les heures sont à 0)`);
    }
    
    return { 
      success: true,
      rowsExported: rows.length,
      message: `${rows.length} ligne(s) exportée(s) avec succès`
    };
    
  } catch (error) {
    Logger.log(`❌ Erreur exportRAMToSheets: ${error.toString()}`);
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}


// ============================================
// 3. ADD TO doPost() FUNCTION
// ============================================

/**
 * IMPORTANT: Add these cases to your existing doPost() function's switch statement
 */

/*
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    
    switch (action) {
      // ... existing actions (loadFromDrive, saveToDrive, etc.) ...
      
      // ⬇️ ADD THESE TWO NEW CASES ⬇️
      
      case 'sendRAMEmail':
        return respond(sendRAMEmail(params));
      
      case 'exportRAMToSheets':
        return respond(exportRAMToSheets(params));
      
      // ... rest of your code ...
      
      default:
        return respond({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (error) {
    Logger.log('❌ Error in doPost: ' + error.toString());
    return respond({ success: false, error: error.toString() });
  }
}
*/


// ============================================
// 4. UPDATE saveToDrive() FUNCTION
// ============================================

/**
 * IMPORTANT: Update your saveToDrive() function to include 'rams' in the saved data
 */

/*
function saveToDrive(params) {
  try {
    const { data } = params;
    
    // Make sure 'rams' is included in the data object
    const dataToSave = {
      clients: data.clients || [],
      invoices: data.invoices || [],
      tasks: data.tasks || [],
      rams: data.rams || [],        // ⬅️ ADD THIS LINE
      companyInfo: data.companyInfo || {},
      taxSettings: data.taxSettings || {}
    };
    
    // ... rest of your saveToDrive code ...
  }
}
*/


// ============================================
// CONFIGURATION REQUIRED
// ============================================

/**
 * Make sure these variables are defined at the top of your script:
 * 
 * const SHEETS_ID = '1Zu6I-c64YrBdlfvWhiVnlbwbvhv6Mw5NL8iRn2mvXoE';
 * const companyInfo = {
 *   name: 'MTI CONSULTING',
 *   address: '13A rue du Général de Gaulle',
 *   postalCode: '59110',
 *   city: 'La Madeleine',
 *   email: 'contact@mticonsulting.fr',
 *   phone: '07 56 98 99 59',
 *   siret: '994 149 904 00017'
 * };
 */


// ============================================
// PERMISSIONS REQUIRED
// ============================================

/**
 * Your Google Apps Script project needs these OAuth scopes:
 * 
 * - https://www.googleapis.com/auth/gmail.send
 *   (for sending emails with GmailApp)
 * 
 * - https://www.googleapis.com/auth/spreadsheets
 *   (for reading/writing Google Sheets)
 * 
 * - https://www.googleapis.com/auth/drive
 *   (for accessing Google Drive files)
 * 
 * These should already be configured if you're using Gmail and Sheets in your project.
 */


// ============================================
// TESTING
// ============================================

/**
 * Test function for sendRAMEmail:
 */
function testSendRAMEmail() {
  const testParams = {
    to: 'test@example.com',
    client: 'Test Client',
    month: 'Novembre',
    year: 2025,
    pdfBase64: 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDIxMCAyOTddL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PD4+Pj4KZW5kb2JqCnhyZWYKMCA0CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMTMgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDQvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoyMDQKJSVFT0YK'
  };
  
  const result = sendRAMEmail(testParams);
  Logger.log(result);
}

/**
 * Test function for exportRAMToSheets:
 */
function testExportRAMToSheets() {
  const testParams = {
    ram: {
      client: 'Test Client',
      month: 10,
      year: 2025,
      monthName: 'Novembre',
      activities: [
        { day: 'Lundi', dayNum: 1, hours: 7.5, comment: 'Test activity 1' },
        { day: 'Mardi', dayNum: 2, hours: 8.0, comment: 'Test activity 2' },
        { day: 'Mercredi', dayNum: 3, hours: 0, comment: '' } // Ne sera pas exporté
      ],
      remarks: 'Test remarks'
    }
  };
  
  const result = exportRAMToSheets(testParams);
  Logger.log(result);
}


// ============================================
// DEPLOYMENT CHECKLIST
// ============================================

/**
 * ✅ CHECKLIST AVANT DÉPLOIEMENT:
 * 
 * 1. [ ] Copier sendRAMEmail() dans le script
 * 2. [ ] Copier exportRAMToSheets() dans le script
 * 3. [ ] Ajouter les 2 cases dans doPost()
 * 4. [ ] Mettre à jour saveToDrive() pour inclure 'rams'
 * 5. [ ] Vérifier que SHEETS_ID est défini
 * 6. [ ] Vérifier que companyInfo est défini
 * 7. [ ] Tester sendRAMEmail() avec testSendRAMEmail()
 * 8. [ ] Tester exportRAMToSheets() avec testExportRAMToSheets()
 * 9. [ ] Vérifier l'onglet "RAM" dans le Google Sheets
 * 10. [ ] Déployer une nouvelle version du Web App
 * 11. [ ] Tester depuis l'application frontend
 */

// FIN DU FICHIER
