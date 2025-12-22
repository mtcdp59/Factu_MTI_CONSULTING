// Force la demande d'autorisation Gmail (à appeler une fois depuis l'éditeur Apps Script)
function forceGmailAuthorization() {
  // Cette fonction force Apps Script à demander les autorisations Gmail
  // Appelez-la une fois depuis l'éditeur pour déclencher le consentement
  GmailApp.getAliases();
  GmailApp.sendEmail(Session.getActiveUser().getEmail(), 'Test autorisation Gmail', 'Ceci est un test pour forcer l’autorisation Gmail.');
}
// Importer les factures depuis Sheets
function importInvoices(sheetId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId || CONFIG.SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Factures');
    if (!sheet) {
      return createResponse(false, 'Feuille "Factures" non trouvée. Créez d\'abord un onglet "Factures" dans Google Sheets.');
    }
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      // Seulement en-tête ou vide
      return createResponse(true, { invoices: [] });
    }
    // Import générique : les entêtes du Sheets doivent correspondre aux champs attendus
    const headers = data[0];
    const invoices = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] && !row[1]) continue;
      const invoice = {};
      for (let j = 0; j < headers.length; j++) {
        invoice[headers[j]] = row[j];
      }
      invoices.push(invoice);
    }
    return createResponse(true, { invoices: invoices });
  } catch (error) {
    return createResponse(false, 'Erreur import factures: ' + error.toString());
  }
}
// MTI CONSULTING - Backend Google Apps Script
// Services: Drive (stockage JSON) + Gmail API + Calendar API + Sheets API

const CONFIG = {
  DRIVE_FOLDER: 'MTI_CONSULTING_DATA',
  DATA_FILE: 'mti_data.json',
  SHEETS_ID: '1Zu6I-c64YrBdlfvWhiVnlbwbvhv6Mw5NL8iRn2mvXoE',
  TIERS_SHEET: 'Tiers',
  EMAIL_FROM: 'contact@mticonsulting.fr'
};

const companyInfo = {
  name: 'MTI CONSULTING',
  logoUrl: 'https://github.com/mtcdp59/Factu_MTI_CONSULTING/blob/main/MTI_CONSULTING.png?raw=true',
  siret: '994 149 904 00017',
  address: '13A rue du Général de Gaulle',
  postalCode: '59110',
  city: 'La Madeleine',
  email: 'contact@mticonsulting.fr',
  phone: '07 77 37 17 39',
  iban: 'FR76 4061 8804 9700 0403 3099 557',
  bic: 'BOUSFRPPXXX'
};

// ==========================================
// ROUTING
// ==========================================

// Point d'entrée POST
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    Logger.log('Action: ' + action);
    
    // Créer la réponse avec headers CORS
    let response;
    
    switch(action) {
      case 'saveToDrive':
        response = saveToDrive(data.data);
        break;
      case 'loadFromDrive':
        response = loadFromDrive();
        break;
      case 'ensureStorage':
        response = ensureStorage();
        break;
      case 'sendEmail':
        response = sendEmail(data);
        break;
      case 'send_invoice':
        // Expect either full pdfBase64 in payload or instruct client to provide it
        response = sendInvoiceAction(data);
        break;
      case 'sync_invoices':
        response = syncInvoices(data.sheetId, data.invoices);
        break;
      case 'sync_calendar':
        response = syncCalendarAction(data.tasks, data.calendarId);
        break;
      case 'savePdfToDrive':
        response = savePdfToDrive(data.pdfBase64, data.pdfFilename, data.folderName);
        break;
      case 'sendEmailWithDriveFile':
        response = sendEmailWithDriveFile(data);
        break;
      case 'listCalendarEvents':
        response = listCalendarEvents(data.startDate, data.endDate, data.maxResults, data.calendarId);
        break;
      case 'importCalendarEvents':
        response = importCalendarEvents(data.startDate, data.endDate, data.calendarId);
        break;
      case 'importClients':
        response = importClients(data.sheetId);
        break;
      case 'exportClients':
        response = exportClients(data.sheetId, data.clients);
        break;
      case 'addCalendarEvent':
        response = addCalendarEvent(data.event);
        break;
      case 'deleteCalendarEvent':
        response = deleteCalendarEvent(data.eventId, data.calendarId);
        break;
      case 'updateCalendarEvent':
        response = updateCalendarEvent(data.event);
        break;
      case 'sendRAMEmail':
        response = sendRAMEmail(data);
        break;
      case 'exportRAMToSheets':
        response = exportRAMToSheets(data);
        break;
      case 'sync_rams':
        response = syncRAMs(data.sheetId, data.rams);
        break;
      case 'import_rams':
        response = importRAMs(data.sheetId);
        break;
      case 'importInvoicesFromSheets':
        response = importInvoices(data.sheetId);
        break;
      case 'exportInvoicesToSheets':
        response = exportInvoices(data.sheetId, data.invoices);
        break;
      case 'sync_quotes':
        response = syncQuotes(data.sheetId, data.quotes);
        break;
      case 'import_quotes':
        response = importQuotes(data.sheetId);
        break;
      case 'sendInvoiceWithRAM':
        response = sendInvoiceWithRAM(data);
        break;
      case 'clearRAMSheet':
        response = clearRAMSheet();
        break;
      default:
        response = createResponse(false, 'Action inconnue: ' + action);
    }
    
    return response;
  } catch (error) {
    Logger.log('Erreur: ' + error.toString());
    return createResponse(false, error.toString());
  }
}

// Point d'entrée GET (test)
function doGet(e) {
  try {
    // If an action is provided as a query parameter, route it here.
    // This supports simple GET/JSONP checks from the frontend to avoid CORS preflight blockers
    // (useful for quick tests from file:// or static hosts). Only non-sensitive, small actions
    // should be exposed via GET (we keep POST for heavier operations).
    if (e && e.parameter && e.parameter.action) {
      var action = e.parameter.action;
      var callback = e.parameter.callback;
      var resultText = '';

      switch (action) {
        case 'ensureStorage':
          resultText = ensureStorage().getContent();
          break;
        case 'loadFromDrive':
          resultText = loadFromDrive().getContent();
          break;
        case 'importClients':
          // allow optional sheetId via query param
          var sheetId = e.parameter.sheetId || CONFIG.SHEETS_ID;
          resultText = importClients(sheetId).getContent();
          break;
        default:
          resultText = createResponse(false, 'Action inconnue (GET): ' + action).getContent();
      }

      if (callback) {
        // Return JSONP (application/javascript) so browsers don't enforce CORS on script tags
        return ContentService.createTextOutput(callback + '(' + resultText + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
      } else {
        return ContentService.createTextOutput(resultText).setMimeType(ContentService.MimeType.JSON);
      }
    }

    const defaultResponse = ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'MTI CONSULTING Backend OK',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    return defaultResponse;
  } catch (err) {
    return createResponse(false, 'Erreur doGet: ' + err.toString());
  }
}

// ==========================================
// GOOGLE DRIVE - STOCKAGE JSON
// ==========================================

// Sauvegarder les données dans Drive
function saveToDrive(data) {
  try {
    const folder = getOrCreateFolder(CONFIG.DRIVE_FOLDER);
    const files = folder.getFilesByName(CONFIG.DATA_FILE);
    
    const jsonContent = JSON.stringify(data, null, 2);
    
    if (files.hasNext()) {
      const file = files.next();
      file.setContent(jsonContent);
      Logger.log('Fichier mis à jour: ' + file.getId());
    } else {
      const file = folder.createFile(CONFIG.DATA_FILE, jsonContent, MimeType.PLAIN_TEXT);
      Logger.log('Fichier créé: ' + file.getId());
    }
    
    return createResponse(true, { 
      message: 'Données sauvegardées',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return createResponse(false, 'Erreur sauvegarde: ' + error.toString());
  }
}

// Charger les données depuis Drive
function loadFromDrive() {
  try {
    const folder = getOrCreateFolder(CONFIG.DRIVE_FOLDER);
    const files = folder.getFilesByName(CONFIG.DATA_FILE);
    
    if (files.hasNext()) {
      const file = files.next();
      const content = file.getBlob().getDataAsString();
      const data = JSON.parse(content);
      
      Logger.log('Données chargées');
      return createResponse(true, data);
    } else {
      Logger.log('Fichier non trouvé, création avec données vides');
      const emptyData = {
        clients: [],
        invoices: [],
        quotes: [],
        tasks: [],
        rams: [],
        recurringInvoices: [],
        companyInfo: companyInfo,
        taxSettings: { tvaRate: 20, retenuSource: 0, defaultPaymentTerms: 30 }
      };
      
      folder.createFile(CONFIG.DATA_FILE, JSON.stringify(emptyData, null, 2), MimeType.PLAIN_TEXT);
      return createResponse(true, emptyData);
    }
  } catch (error) {
    return createResponse(false, 'Erreur chargement: ' + error.toString());
  }
}

// Obtenir ou créer le dossier Drive
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

// ==========================================
// GMAIL API - ENVOI EMAILS
// ==========================================

// Envoyer un email avec pièce jointe PDF
function sendEmail(data) {
  try {
    const { to, subject, body, pdfBase64, pdfFilename } = data;
    
    // Décoder le PDF base64
    const pdfBlob = Utilities.newBlob(
      Utilities.base64Decode(pdfBase64),
      'application/pdf',
      pdfFilename
    );
    
    // Envoyer l'email avec Gmail API
    // Note: avoid forcing 'from' (alias) to prevent authorization issues; send from the account executing the script.
    GmailApp.sendEmail(to, subject, body, {
      attachments: [pdfBlob],
      name: 'MTI CONSULTING',
      from: CONFIG.EMAIL_FROM
    });
    
    Logger.log('Email envoyé à: ' + to);
    return createResponse(true, { 
      message: 'Email envoyé',
      to: to,
      subject: subject
    });
  } catch (error) {
    return createResponse(false, 'Erreur envoi email: ' + error.toString());
  }
}

// ==========================================
// GOOGLE SHEETS - SYNC TIERS
// ==========================================

// Importer les clients depuis Sheets
function importClients(sheetId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    let sheet = spreadsheet.getSheetByName(CONFIG.TIERS_SHEET);
    
    if (!sheet) {
      return createResponse(false, 'Feuille "Tiers" non trouvée');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Trouver les indices des colonnes (9 colonnes enrichies SIRENE)
    const nameIdx = headers.indexOf('Nom');
    const siretIdx = headers.indexOf('SIRET');
    const addressIdx = headers.indexOf('Adresse');
    const emailIdx = headers.indexOf('Email Facturation');
    const contactIdx = headers.indexOf('Contact');
    const nafIdx = headers.indexOf('Code NAF');
    const categorieIdx = headers.indexOf('Catégorie Juridique');
    const etatIdx = headers.indexOf('État Administratif');
    const typeSiegeIdx = headers.indexOf('Type Siège');
    
    if (nameIdx === -1) {
      return createResponse(false, 'Colonne "Nom" non trouvée');
    }
    
    // Extraire les clients
    const clients = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[nameIdx]) continue;
      
      clients.push({
        name: row[nameIdx] || '',
        siret: row[siretIdx] || '',
        address: row[addressIdx] || '',
        email_facturation: row[emailIdx] || '',
        contact_name: row[contactIdx] || '',
        naf: row[nafIdx] || '',
        categorie_juridique: row[categorieIdx] || '',
        etat_administratif: row[etatIdx] || '',
        type_siege: row[typeSiegeIdx] || ''
      });
    }
    
    Logger.log('Clients importés: ' + clients.length);
    return createResponse(true, { clients: clients });
  } catch (error) {
    return createResponse(false, 'Erreur import clients: ' + error.toString());
  }
}

// Exporter les clients vers Sheets
function exportClients(sheetId, clients) {
  if (!sheetId) {
    return createResponse(false, 'Paramètre sheetId manquant');
  }
  if (!clients || !Array.isArray(clients) || clients.length === 0) {
    return createResponse(false, 'Paramètre clients manquant ou invalide');
  }
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    let sheet = spreadsheet.getSheetByName(CONFIG.TIERS_SHEET);
    
    if (!sheet) {
      sheet = spreadsheet.insertSheet(CONFIG.TIERS_SHEET);
    }
    
    // Clear et headers (9 colonnes enrichies SIRENE)
    sheet.clear();
    sheet.appendRow(['Nom', 'SIRET', 'Adresse', 'Email Facturation', 'Contact', 'Code NAF', 'Catégorie Juridique', 'État Administratif', 'Type Siège']);
    
    // Formater headers
    const headerRange = sheet.getRange(1, 1, 1, 9);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    
    // Ajouter les données
    clients.forEach(client => {
      sheet.appendRow([
        client.name,
        client.siret || '',
        client.address || '',
        client.email_facturation || '',
        client.contact_name || '',
        client.naf || '',
        client.categorie_juridique || '',
        client.etat_administratif || '',
        client.type_siege || ''
      ]);
    });
    
    // Auto-resize
    sheet.autoResizeColumns(1, 9);
    
    Logger.log('Clients exportés: ' + clients.length);
    return createResponse(true, { 
      count: clients.length,
      sheetUrl: spreadsheet.getUrl()
    });
  } catch (error) {
    return createResponse(false, 'Erreur export clients: ' + error.toString());
  }
}

// Export invoices to the 'Factures' sheet (gid=0)
function exportInvoices(sheetId, invoices) {
  if (!sheetId) {
    return createResponse(false, 'Paramètre sheetId manquant');
  }
  if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
    return createResponse(false, 'Paramètre invoices manquant ou invalide');
  }
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    let sheet = spreadsheet.getSheetByName('Factures');

    if (!sheet) {
      sheet = spreadsheet.insertSheet('Factures');
    }

    sheet.clear();
    sheet.appendRow(['Number', 'Client', 'Client SIRET', 'Client Address', 'Date', 'DueDate', 'Description', 'Quantity', 'UnitPrice', 'Total', 'Status', 'MontantRecu', 'DateReception']);

    invoices.forEach(inv => {
      sheet.appendRow([
        inv.number || '',
        inv.client || '',
        inv.clientSiret || '',
        inv.clientAddress || '',
        inv.date || '',
        inv.dueDate || '',
        inv.description || '',
        inv.quantity || 0,
        inv.unitPrice || 0,
        inv.total || 0,
        inv.status || '',
        inv.montantRecu || 0,
        inv.dateReception || ''
      ]);
    });

    sheet.autoResizeColumns(1, 13);

    return createResponse(true, { count: invoices.length, sheetUrl: spreadsheet.getUrl() });
  } catch (error) {
    return createResponse(false, 'Erreur export invoices: ' + error.toString());
  }
}

// Sync multiple tasks to Google Calendar
function syncCalendarAction(tasks) {
  try {
    if (!tasks || !Array.isArray(tasks)) {
      return createResponse(false, 'Payload tasks invalide');
    }

    // Allow optional calendarId to target a specific calendar
    var calendarId = arguments.length > 1 ? arguments[1] : null;
    var calendar = calendarId ? CalendarApp.getCalendarById(calendarId) : CalendarApp.getDefaultCalendar();

    const results = [];
    tasks.forEach(task => {
      try {
        // If the client already provided an eventId, skip creation to avoid duplicates
        if (task.eventId) {
          results.push({ task: task, skipped: true, reason: 'eventId présent, création ignorée' });
          return;
        }
        const date = task.date;
        const time = task.startTime || task.time || '09:00';
        const duration = task.duration || 1;
        const description = task.description || 'Tâche';
        const type = task.type || 'Autre';

        const startDateTime = new Date(date + 'T' + time + ':00');
        const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);

        var calEvent;
        if (calendar) {
          calEvent = calendar.createEvent(description, startDateTime, endDateTime, { description: 'Type: ' + type, location: 'MTI CONSULTING' });
        } else {
          calEvent = CalendarApp.getDefaultCalendar().createEvent(description, startDateTime, endDateTime, { description: 'Type: ' + type, location: 'MTI CONSULTING' });
        }

        const colorId = getColorForType(type);
        if (colorId && calEvent.setColor) {
          try { calEvent.setColor(colorId); } catch (e) {}
        }

        results.push({ task: task, eventId: calEvent.getId() });
      } catch (errTask) {
        results.push({ task: task, error: errTask.toString() });
      }
    });
    return createResponse(true, { message: 'Tâches synchronisées', count: tasks.length, details: results });
  } catch (error) {
    return createResponse(false, 'Erreur sync calendar: ' + error.toString());
  }
}

// Handle send_invoice action: expect pdfBase64 OR instruct client
function sendInvoiceAction(data) {
  try {
    const invoice = data.invoice;
    const clientEmail = data.clientEmail;

    if (!clientEmail) {
      return createResponse(false, 'Adresse email destinataire manquante');
    }

    // If client supplied a base64 PDF, forward to sendEmail
    if (data.pdfBase64) {
      return sendEmail({ to: clientEmail, subject: data.subject || ('Facture ' + (invoice && invoice.number ? invoice.number : '')), body: data.body || '', pdfBase64: data.pdfBase64, pdfFilename: data.pdfFilename || 'facture.pdf' });
    }

    // Otherwise, ask the client to provide the pdfBase64 (server-side PDF generation not implemented)
    return createResponse(false, 'Aucun PDF fourni. Le client doit envoyer le PDF encodé en base64 (pdfBase64) avec l\'appel send_invoice.');
  } catch (error) {
    return createResponse(false, 'Erreur send_invoice: ' + error.toString());
  }
}

// Save a PDF (base64 without data: prefix) into Drive under a folder (default 'Factures')
function savePdfToDrive(pdfBase64, pdfFilename, folderName) {
  try {
    if (!pdfBase64) return createResponse(false, 'pdfBase64 manquant');
    folderName = folderName || 'Factures';
    pdfFilename = pdfFilename || 'document.pdf';

    // Ensure parent folder exists
    var parent = getOrCreateFolder(folderName);

    // Contrôle doublon : si fichier existe, le supprimer
    try {
      var existing = parent.getFilesByName(pdfFilename);
      while (existing.hasNext()) {
        var ef = existing.next();
        try { ef.setTrashed(true); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }

    // Créer le blob PDF
    var blob = Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', pdfFilename);
    var file = parent.createFile(blob);
    Logger.log('PDF sauvegardé sur Drive: ' + file.getId());

    // Générer l'URL de prévisualisation Drive
    var fileUrl = file.getUrl();
    var previewUrl = 'https://drive.google.com/file/d/' + file.getId() + '/preview';

    return createResponse(true, {
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: fileUrl,
      previewUrl: previewUrl
    });
  } catch (err) {
    return createResponse(false, 'Erreur savePdfToDrive: ' + err.toString());
  }
}

// Lister les fichiers PDF dans un dossier Drive
function listFilesInFolder(folderName) {
  try {
    folderName = folderName || 'Factures';
    var folder = getOrCreateFolder(folderName);
    var files = folder.getFiles();
    var out = [];
    while (files.hasNext()) {
      var file = files.next();
      if (file.getMimeType() === MimeType.PDF) {
        out.push({
          fileId: file.getId(),
          fileName: file.getName(),
          fileUrl: file.getUrl(),
          previewUrl: 'https://drive.google.com/file/d/' + file.getId() + '/preview'
        });
      }
    }
    return createResponse(true, { files: out });
  } catch (err) {
    return createResponse(false, 'Erreur listFilesInFolder: ' + err.toString());
  }
}

// Supprimer un fichier PDF dans un dossier Drive
function deleteFileFromFolder(folderName, fileName) {
  try {
    folderName = folderName || 'Factures';
    if (!fileName) return createResponse(false, 'fileName manquant');
    var folder = getOrCreateFolder(folderName);
    var files = folder.getFilesByName(fileName);
    var deleted = 0;
    while (files.hasNext()) {
      var file = files.next();
      if (file.getMimeType() === MimeType.PDF) {
        file.setTrashed(true);
        deleted++;
      }
    }
    return createResponse(true, { deleted: deleted, fileName: fileName });
  } catch (err) {
    return createResponse(false, 'Erreur deleteFileFromFolder: ' + err.toString());
  }
}

// Send email attaching a file that exists in Drive by fileId
function sendEmailWithDriveFile(data) {
  try {
    var to = data.to;
    var subject = data.subject || 'Facture';
    var body = data.body || '';
    var fileId = data.fileId;
    if (!fileId) return createResponse(false, 'fileId manquant');

    var file = DriveApp.getFileById(fileId);
    if (!file) return createResponse(false, 'Fichier introuvable: ' + fileId);

    var blob = file.getBlob().setName(data.fileName || file.getName());

    GmailApp.sendEmail(to, subject, body, { attachments: [blob], name: 'MTI CONSULTING', from: CONFIG.EMAIL_FROM });

    Logger.log('Email envoyé avec pièce jointe Drive: ' + to + ' / ' + fileId);
    return createResponse(true, { message: 'Email envoyé (Drive PJ)', to: to, fileId: fileId });
  } catch (err) {
    return createResponse(false, 'Erreur sendEmailWithDriveFile: ' + err.toString());
  }
}

// Wrapper for sync_invoices
function syncInvoices(sheetId, invoices) {
  // Reuse exportInvoices function to write invoices to a sheet
  return exportInvoices(sheetId || CONFIG.SHEETS_ID, invoices || []);
}

// ==========================================
// GOOGLE CALENDAR API
// ==========================================

// Ajouter un événement au Calendar
function addCalendarEvent(event) {
  try {
    const { date, time, duration, description, type, calendarId } = event;
    
    // Créer les dates de début et fin
    const startDateTime = new Date(`${date}T${time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);
    
    // Couleur selon type
    const colorId = getColorForType(type);
    
    // Créer l'événement
    var calendar = calendarId ? CalendarApp.getCalendarById(calendarId) : CalendarApp.getDefaultCalendar();
    const calEvent = (calendar || CalendarApp.getDefaultCalendar()).createEvent(
      description,
      startDateTime,
      endDateTime,
      {
        description: `Type: ${type}`,
        location: 'MTI CONSULTING'
      }
    );
    
    if (colorId) {
      calEvent.setColor(colorId);
    }
    
    Logger.log('Événement créé: ' + calEvent.getId());
    return createResponse(true, { 
      eventId: calEvent.getId(),
      message: 'Événement créé'
    });
  } catch (error) {
    return createResponse(false, 'Erreur création événement: ' + error.toString());
  }
}

// Supprimer un événement du Calendar par eventId
function deleteCalendarEvent(eventId, calendarId) {
  try {
    if (!eventId) return createResponse(false, 'eventId manquant');
    var cal = calendarId ? CalendarApp.getCalendarById(calendarId) : CalendarApp.getDefaultCalendar();
    if (!cal) return createResponse(false, 'Calendrier introuvable: ' + calendarId);

    // getEventById expects the iCal UID; CalendarApp provides getEventById (uses internal id)
    try {
      var ev = CalendarApp.getEventById(eventId);
      if (ev) {
        ev.deleteEvent();
        Logger.log('Événement supprimé: ' + eventId);
        return createResponse(true, { message: 'Événement supprimé', eventId: eventId });
      } else {
        return createResponse(false, 'Événement introuvable: ' + eventId);
      }
    } catch (e) {
      // Some calendars may not expose getEventById for returned id formats; try fallback search by scanning nearby events
      Logger.log('deleteCalendarEvent getEventById failed, attempting fallback search: ' + e.toString());
      try {
        var now = new Date();
        var start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        var end = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        var events = cal.getEvents(start, end);
        for (var i = 0; i < events.length; i++) {
          var candidate = events[i];
          var cid = candidate.getId();
          var title = candidate.getTitle() || '';
          var desc = candidate.getDescription() || '';
          // Try matching by id substring (some ids differ by suffix) or by presence in title/description
          if ((cid && cid.indexOf(eventId) !== -1) || (eventId && eventId.indexOf(cid) !== -1) || (title && title.indexOf(eventId) !== -1) || (desc && desc.indexOf(eventId) !== -1)) {
            try {
              candidate.deleteEvent();
              Logger.log('Événement supprimé par fallback: ' + cid + ' (matched on ' + eventId + ')');
              return createResponse(true, { message: 'Événement supprimé (fallback)', eventId: cid });
            } catch (delErr) {
              Logger.log('Fallback delete failed for ' + cid + ' : ' + delErr.toString());
            }
          }
        }
        return createResponse(false, 'Événement introuvable via fallback: ' + eventId);
      } catch (ferr) {
        Logger.log('deleteCalendarEvent fallback search error: ' + ferr.toString());
        return createResponse(false, 'Impossible de localiser l\'événement via fallback: ' + ferr.toString());
      }
    }
  } catch (err) {
    return createResponse(false, 'Erreur deleteCalendarEvent: ' + err.toString());
  }
}

// Mettre à jour un événement existant (si possible)
function updateCalendarEvent(event) {
  try {
    if (!event || !event.eventId) return createResponse(false, 'event.eventId manquant');
    var calendarId = event.calendarId || null;
    var cal = calendarId ? CalendarApp.getCalendarById(calendarId) : CalendarApp.getDefaultCalendar();
    if (!cal) return createResponse(false, 'Calendrier introuvable: ' + calendarId);

    try {
      var ev = CalendarApp.getEventById(event.eventId);
      if (!ev) return createResponse(false, 'Événement introuvable par ID: ' + event.eventId);

      // Construire nouvelles dates
      var start = new Date(event.date + 'T' + event.time + ':00');
      var end = new Date(start.getTime() + (parseFloat(event.duration || 1) * 60 * 60 * 1000));

      ev.setTitle(event.description || ev.getTitle());
      ev.setTime(start, end);
      if (event.type) ev.setDescription('Type: ' + event.type + (event.descriptionDetail ? '\n' + event.descriptionDetail : ''));
      if (event.location) ev.setLocation(event.location);

      Logger.log('Événement mis à jour: ' + event.eventId);
      return createResponse(true, { message: 'Événement mis à jour', eventId: event.eventId });
    } catch (e) {
      // Fallback: attempt to find event and update
      Logger.log('updateCalendarEvent getEventById failed, attempting fallback: ' + e.toString());
      var now = new Date();
      var startWindow = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      var endWindow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      var events = cal.getEvents(startWindow, endWindow);
      for (var i = 0; i < events.length; i++) {
        var candidate = events[i];
        var cid = candidate.getId();
        if (cid && cid.indexOf(event.eventId) !== -1) {
          // Found candidate - update it
          var start2 = new Date(event.date + 'T' + event.time + ':00');
          var end2 = new Date(start2.getTime() + (parseFloat(event.duration || 1) * 60 * 60 * 1000));
          try {
            candidate.setTitle(event.description || candidate.getTitle());
            candidate.setTime(start2, end2);
            if (event.type) candidate.setDescription('Type: ' + event.type + (event.descriptionDetail ? '\n' + event.descriptionDetail : ''));
            if (event.location) candidate.setLocation(event.location);
            Logger.log('Événement mis à jour via fallback: ' + cid);
            return createResponse(true, { message: 'Événement mis à jour (fallback)', eventId: cid });
          } catch (uerr) {
            Logger.log('Fallback update failed for ' + cid + ' : ' + uerr.toString());
          }
        }
      }
      return createResponse(false, 'Impossible de mettre à jour l\'événement: ' + e.toString());
    }
  } catch (err) {
    return createResponse(false, 'Erreur updateCalendarEvent: ' + err.toString());
  }
}

// Obtenir la couleur selon le type de tâche
function getColorForType(type) {
  const colors = {
    'Réunion': CalendarApp.EventColor.BLUE,
    'Travail': CalendarApp.EventColor.GREEN,
    'Administratif': CalendarApp.EventColor.ORANGE,
    'Autre': CalendarApp.EventColor.GRAY
  };
  return colors[type] || CalendarApp.EventColor.BLUE;
}

// Lister les événements d'un calendrier sur une plage donnée
function listCalendarEvents(startDate, endDate, maxResults, calendarId) {
  try {
    if (!startDate || !endDate) {
      return createResponse(false, 'startDate et endDate requis (format AAAA-MM-JJ)');
    }

    var start = new Date(startDate + 'T00:00:00');
    var end = new Date(endDate + 'T23:59:59');
    var cal = calendarId ? CalendarApp.getCalendarById(calendarId) : CalendarApp.getDefaultCalendar();
    if (!cal) return createResponse(false, 'Calendrier introuvable: ' + calendarId);

    var events = cal.getEvents(start, end);
    var out = [];
    for (var i = 0; i < events.length && (typeof maxResults === 'undefined' || i < maxResults); i++) {
      var ev = events[i];
      out.push({
        id: ev.getId(),
        title: ev.getTitle(),
        start: ev.getStartTime().toISOString(),
        end: ev.getEndTime().toISOString(),
        description: ev.getDescription(),
        location: ev.getLocation()
      });
    }

    return createResponse(true, { count: out.length, events: out });
  } catch (err) {
    return createResponse(false, 'Erreur listCalendarEvents: ' + err.toString());
  }
}

// List calendars available to the Apps Script user
function listCalendars() {
  try {
    var cals = CalendarApp.getAllCalendars();
    var out = cals.map(function(c) { return { id: c.getId(), name: c.getName() }; });
    return createResponse(true, { count: out.length, calendars: out });
  } catch (err) {
    return createResponse(false, 'Erreur listCalendars: ' + err.toString());
  }
}

// Importer les événements d'un calendrier et les fusionner dans le fichier mti_data.json
function importCalendarEvents(startDate, endDate, calendarId) {
  try {
    if (!startDate || !endDate) {
      return createResponse(false, 'startDate et endDate requis (format AAAA-MM-JJ)');
    }

    var start = new Date(startDate + 'T00:00:00');
    var end = new Date(endDate + 'T23:59:59');
    var cal = calendarId ? CalendarApp.getCalendarById(calendarId) : CalendarApp.getDefaultCalendar();
    if (!cal) return createResponse(false, 'Calendrier introuvable: ' + calendarId);

    // Lire ou créer le fichier mti_data.json
    var folder = getOrCreateFolder(CONFIG.DRIVE_FOLDER);
    var files = folder.getFilesByName(CONFIG.DATA_FILE);
    var data = null;
    if (files.hasNext()) {
      var file = files.next();
      try {
        data = JSON.parse(file.getBlob().getDataAsString());
      } catch (e) {
        data = { clients: [], invoices: [], tasks: [], companyInfo: {}, taxSettings: {} };
      }
    } else {
      data = { clients: [], invoices: [], tasks: [], companyInfo: {}, taxSettings: {} };
      folder.createFile(CONFIG.DATA_FILE, JSON.stringify(data, null, 2), MimeType.PLAIN_TEXT);
    }

    data.tasks = data.tasks || [];

    // Index existant par eventId pour éviter doublons
    var existingIds = {};
    for (var i = 0; i < data.tasks.length; i++) {
      var t = data.tasks[i];
      if (t && t.eventId) existingIds[t.eventId] = true;
    }

    var events = cal.getEvents(start, end);
    var imported = [];
    for (var j = 0; j < events.length; j++) {
      var ev = events[j];
      var evId = ev.getId();
      if (existingIds[evId]) continue; // déjà importé

      var s = ev.getStartTime();
      var eDate = ev.getEndTime();
      var dateStr = Utilities.formatDate(s, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      var startTime = Utilities.formatDate(s, Session.getScriptTimeZone(), 'HH:mm');
      // calculer durée en heures (arrondi à 0.5)
      var durationH = Math.round(((eDate.getTime() - s.getTime()) / (1000 * 60 * 60)) * 2) / 2;

      var task = {
        date: dateStr,
        startTime: startTime,
        duration: durationH,
        description: ev.getTitle() || ev.getDescription() || 'Événement',
        type: 'Réunion',
        eventId: evId
      };

      data.tasks.push(task);
      imported.push(task);
    }

    // Sauvegarder le fichier mis à jour
    try {
      var files2 = folder.getFilesByName(CONFIG.DATA_FILE);
      if (files2.hasNext()) {
        var f2 = files2.next();
        f2.setContent(JSON.stringify(data, null, 2));
      } else {
        folder.createFile(CONFIG.DATA_FILE, JSON.stringify(data, null, 2), MimeType.PLAIN_TEXT);
      }
    } catch (saveErr) {
      return createResponse(false, 'Import OK mais impossible de sauvegarder le fichier: ' + saveErr.toString());
    }

    return createResponse(true, { importedCount: imported.length, imported: imported });
  } catch (err) {
    return createResponse(false, 'Erreur importCalendarEvents: ' + err.toString());
  }
}

// ==========================================
// UTILITAIRES
// ==========================================

// Créer une réponse JSON standardisée
function createResponse(success, data) {
  const response = {
    success: success,
    data: data,
    timestamp: new Date().toISOString()
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// RAM (MONTHLY ACTIVITY REPORTS)
// ==========================================

function sendRAMEmail(params) {
  if (!params || typeof params !== 'object') {
    return createResponse(false, 'Paramètres manquants ou invalides');
  }
  const { to, client, month, year, pdfBase64 } = params;
  if (!to) {
    return createResponse(false, 'Email destinataire manquant');
  }
  if (!pdfBase64) {
    return createResponse(false, 'PDF manquant');
  }
  try {
    
    const subject = `Rapport d'Activité Mensuelle - ${client} - ${month} ${year}`;
    
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
    
    const pdfBlob = Utilities.newBlob(
      Utilities.base64Decode(pdfBase64),
      'application/pdf',
      `RAM_${year}_${month}_${client.replace(/[^a-z0-9]/gi, '_')}.pdf`
    );
    
    GmailApp.sendEmail(to, subject, body, {
      attachments: [pdfBlob],
      name: companyInfo.name,
      from: CONFIG.EMAIL_FROM
    });
    
    Logger.log(`✅ RAM envoyé à ${to} pour ${client} - ${month} ${year}`);
    
    return createResponse(true, { 
      message: `Email envoyé avec succès à ${to}`
    });
    
  } catch (error) {
    Logger.log(`❌ Erreur sendRAMEmail: ${error.toString()}`);
    return createResponse(false, error.toString());
  }
}

function exportRAMToSheets(params) {
  if (!params || typeof params !== 'object') {
    return createResponse(false, 'Paramètres manquants ou invalides');
  }
  const { ram } = params;
  if (!ram || typeof ram !== 'object') {
    return createResponse(false, 'Données RAM manquantes ou invalides');
  }
  try {
    
    const ss = SpreadsheetApp.openById(CONFIG.SHEETS_ID);
    
    let sheet = ss.getSheetByName('RAM');
    if (!sheet) {
      sheet = ss.insertSheet('RAM');
      
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
      
      sheet.setColumnWidth(1, 150);
      sheet.setColumnWidth(2, 150);
      sheet.setColumnWidth(3, 100);
      sheet.setColumnWidth(4, 80);
      sheet.setColumnWidth(5, 100);
      sheet.setColumnWidth(6, 80);
      sheet.setColumnWidth(7, 80);
      sheet.setColumnWidth(8, 300);
      sheet.setColumnWidth(9, 300);
      
      sheet.setFrozenRows(1);
    }
    
    const exportDate = new Date().toISOString();
    const rows = [];
    
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
    
    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      const startRow = lastRow + 1;
      
      sheet.getRange(startRow, 1, rows.length, 9).setValues(rows);
      
      sheet.getRange(startRow, 1, rows.length, 9).setBorder(
        true, true, true, true, true, true,
        '#CCCCCC',
        SpreadsheetApp.BorderStyle.SOLID
      );
      
      sheet.getRange(startRow, 7, rows.length, 1).setHorizontalAlignment('right');
      
      Logger.log(`✅ ${rows.length} lignes exportées vers Sheets pour ${ram.client} - ${ram.monthName} ${ram.year}`);
    } else {
      Logger.log(`⚠️ Aucune activité à exporter (toutes les heures sont à 0)`);
    }
    
    return createResponse(true, {
      rowsExported: rows.length,
      message: `${rows.length} ligne(s) exportée(s) avec succès`
    });
    
  } catch (error) {
    Logger.log(`❌ Erreur exportRAMToSheets: ${error.toString()}`);
    return createResponse(false, error.toString());
  }
}

// Synchroniser tous les RAMs vers Sheets (export)
function syncRAMs(sheetId, rams) {
  if (!sheetId) {
    return createResponse(false, 'Paramètre sheetId manquant');
  }
  if (!rams || !Array.isArray(rams) || rams.length === 0) {
    return createResponse(false, 'Paramètre rams manquant ou invalide');
  }
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId || CONFIG.SHEETS_ID);
    let sheet = spreadsheet.getSheetByName('RAM');
    
    if (!sheet) {
      sheet = spreadsheet.insertSheet('RAM');
    }
    
    // Clear et headers
    sheet.clear();
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
    
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 100);
    sheet.setColumnWidth(4, 80);
    sheet.setColumnWidth(5, 100);
    sheet.setColumnWidth(6, 80);
    sheet.setColumnWidth(7, 80);
    sheet.setColumnWidth(8, 300);
    sheet.setColumnWidth(9, 300);
    
    sheet.setFrozenRows(1);
    
    // Ajouter toutes les données
    const exportDate = new Date().toISOString();
    const allRows = [];
    
    (rams || []).forEach(ram => {
      (ram.activities || []).forEach(activity => {
        if (activity.hours && activity.hours > 0) {
          allRows.push([
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
    });
    
    if (allRows.length > 0) {
      sheet.getRange(2, 1, allRows.length, 9).setValues(allRows);
      sheet.getRange(2, 1, allRows.length, 9).setBorder(
        true, true, true, true, true, true,
        '#CCCCCC',
        SpreadsheetApp.BorderStyle.SOLID
      );
      sheet.getRange(2, 7, allRows.length, 1).setHorizontalAlignment('right');
    }
    
    Logger.log('RAMs synchronisés: ' + allRows.length + ' lignes');
    return createResponse(true, { 
      count: allRows.length,
      sheetUrl: spreadsheet.getUrl()
    });
  } catch (error) {
    return createResponse(false, 'Erreur sync RAMs: ' + error.toString());
  }
}

// Importer les RAMs depuis Sheets
function importRAMs(sheetId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId || CONFIG.SHEETS_ID);
    let sheet = spreadsheet.getSheetByName('RAM');
    
    if (!sheet) {
      return createResponse(false, 'Feuille "RAM" non trouvée');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Trouver les indices des colonnes
    const clientIdx = headers.indexOf('Client');
    const moisIdx = headers.indexOf('Mois');
    const anneeIdx = headers.indexOf('Année');
    const jourIdx = headers.indexOf('Jour');
    const dateIdx = headers.indexOf('Date');
    const heuresIdx = headers.indexOf('Heures');
    const commentairesIdx = headers.indexOf('Commentaires');
    const remarquesIdx = headers.indexOf('Remarques');
    
    if (clientIdx === -1 || moisIdx === -1) {
      return createResponse(false, 'Colonnes requises manquantes');
    }
    
    // Regrouper par client/mois/année
    const ramsMap = {};
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[clientIdx]) continue;
      
      const client = row[clientIdx];
      const mois = row[moisIdx];
      const annee = row[anneeIdx];
      const key = `${client}_${mois}_${annee}`;
      
      if (!ramsMap[key]) {
        ramsMap[key] = {
          client: client,
          monthName: mois,
          year: annee,
          remarks: row[remarquesIdx] || '',
          activities: []
        };
      }
      
      ramsMap[key].activities.push({
        day: row[jourIdx] || '',
        dayNum: row[dateIdx] || '',
        hours: parseFloat(row[heuresIdx]) || 0,
        comment: row[commentairesIdx] || ''
      });
    }
    
    const rams = Object.values(ramsMap);
    
    Logger.log('RAMs importés: ' + rams.length);
    return createResponse(true, { rams: rams });
  } catch (error) {
    return createResponse(false, 'Erreur import RAMs: ' + error.toString());
  }
}

function sendInvoiceWithRAM(params) {
  if (!params || typeof params !== 'object') {
    return createResponse(false, 'Paramètres manquants ou invalides');
  }
  const { to, invoiceSubject, invoiceBody, invoicePdfBase64, invoiceFilename, ramPdfBase64, ramFilename, client, month, year } = params;
  if (!to) {
    return createResponse(false, 'Email destinataire manquant');
  }
  if (!invoicePdfBase64 || !ramPdfBase64) {
    return createResponse(false, 'PDF manquant (facture ou RAM)');
  }
  if (!invoiceFilename || !ramFilename) {
    return createResponse(false, 'Nom de fichier PDF manquant (facture ou RAM)');
  }
  try {
    const { to, invoiceSubject, invoiceBody, invoicePdfBase64, invoiceFilename, ramPdfBase64, ramFilename, client, month, year } = params;
    
    if (!to) {
      throw new Error('Email destinataire manquant');
    }
    
    if (!invoicePdfBase64 || !ramPdfBase64) {
      throw new Error('PDF manquant (facture ou RAM)');
    }
    
    const subject = `Facture + RAM - ${client} - ${month} ${year}`;
    
    const body = `Bonjour,

Veuillez trouver ci-joint :
- La facture ${invoiceFilename}
- Le rapport d'activité mensuelle pour ${month} ${year}

${invoiceBody}

Cordialement,
${companyInfo.name}

---
${companyInfo.name}
${companyInfo.address}
${companyInfo.postalCode} ${companyInfo.city}
Email: ${companyInfo.email}
Tél: ${companyInfo.phone}
SIRET: ${companyInfo.siret}`;
    
    const invoiceBlob = Utilities.newBlob(
      Utilities.base64Decode(invoicePdfBase64),
      'application/pdf',
      invoiceFilename
    );
    
    const ramBlob = Utilities.newBlob(
      Utilities.base64Decode(ramPdfBase64),
      'application/pdf',
      ramFilename
    );
    
    GmailApp.sendEmail(to, subject, body, {
      attachments: [invoiceBlob, ramBlob],
      name: companyInfo.name,
      from: CONFIG.EMAIL_FROM
    });
    
    Logger.log(`✅ Facture + RAM envoyés à ${to} pour ${client}`);
    
    return createResponse(true, { 
      message: `Email envoyé avec succès à ${to} (Facture + RAM)`
    });
    
  } catch (error) {
    Logger.log(`❌ Erreur sendInvoiceWithRAM: ${error.toString()}`);
    return createResponse(false, error.toString());
  }
}

// ==========================================
// UTILITAIRES
// ==========================================

function ensureStorage() {
  try {
    const folder = getOrCreateFolder(CONFIG.DRIVE_FOLDER);
    const files = folder.getFilesByName(CONFIG.DATA_FILE);
    let fileId = null;
    let created = false;

    if (files.hasNext()) {
      const file = files.next();
      fileId = file.getId();
    } else {
      const emptyData = {
        clients: [],
        invoices: [],
        tasks: [],
        rams: [],
        recurringInvoices: [],
        companyInfo: companyInfo,
        taxSettings: { tvaRate: 20, retenuSource: 0, defaultPaymentTerms: 30 }
      };
      const f = folder.createFile(CONFIG.DATA_FILE, JSON.stringify(emptyData, null, 2), MimeType.PLAIN_TEXT);
      fileId = f.getId();
      created = true;
    }

    return createResponse(true, { folderId: folder.getId(), fileId: fileId, created: created, message: 'Storage verified' });
  } catch (err) {
    return createResponse(false, 'Erreur ensureStorage: ' + err.toString());
  }
}

//==========================================
// MAINTENANCE AUTOMATIQUE DES AUTORISATIONS
// ==========================================

/**
 * Fonction de maintenance pour garder les autorisations actives
 * À configurer avec un déclencheur temporel hebdomadaire dans Apps Script
 * Cela empêche l'expiration des tokens OAuth en mode Test
 */
function maintainAuthorizations() {
  try {
    Logger.log('🔄 Maintenance des autorisations - Début');
    
    // 1. Accès Google Sheets (maintient le scope spreadsheets)
    const sheet = SpreadsheetApp.openById(CONFIG.SHEETS_ID);
    Logger.log('✅ Sheets accessible: ' + sheet.getName());
    
    // 2. Accès Google Drive (maintient le scope drive)
    const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER);
    if (folders.hasNext()) {
      const folder = folders.next();
      Logger.log('✅ Drive accessible: ' + folder.getName());
    }
    
    // 3. Accès Google Calendar (maintient le scope calendar)
    const calendar = CalendarApp.getDefaultCalendar();
    Logger.log('✅ Calendar accessible: ' + calendar.getName());
    
    // 4. Test Gmail (maintient le scope gmail.send)
    // Note: On ne teste pas l'envoi réel pour éviter le spam
    Logger.log('✅ Gmail scope présent dans manifest');
    
    const timestamp = new Date().toLocaleString('fr-FR');
    Logger.log('✅ Maintenance terminée avec succès - ' + timestamp);
    
    return '✅ Autorisations maintenues - ' + timestamp;
  } catch (e) {
    Logger.log('❌ Erreur maintenance: ' + e.toString());
    return '❌ Erreur: ' + e.toString();
  }
}

// ==========================================
// FONCTION DE TEST - ACCÈS SHEETS
// ==========================================

function testSheetsAccess() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEETS_ID);
    Logger.log('✅ Accès Sheets OK: ' + ss.getName());
    Logger.log('📊 URL: ' + ss.getUrl());
    
    // Tester création onglet Tiers si inexistant
    let sheet = ss.getSheetByName(CONFIG.TIERS_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.TIERS_SHEET);
      Logger.log('✅ Onglet "Tiers" créé');
    } else {
      Logger.log('✅ Onglet "Tiers" existe déjà');
    }
    
    return '✅ Test réussi - Accès Sheets opérationnel';
  } catch (e) {
    Logger.log('❌ Erreur: ' + e.toString());
    return '❌ Erreur: ' + e.toString();
  }
}

// ==========================================
// NETTOYAGE FEUILLE RAM
// ==========================================

/**
 * Nettoie toutes les lignes de données de la feuille RAM (garde uniquement les en-têtes)
 */
function clearRAMSheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SHEETS_ID);
    let sheet = spreadsheet.getSheetByName('RAM');
    
    if (!sheet) {
      return createResponse(false, 'Feuille RAM introuvable');
    }
    
    const lastRow = sheet.getLastRow();
    
    // Si seulement l'en-tête (ligne 1) ou feuille vide, rien à faire
    if (lastRow <= 1) {
      Logger.log('ℹ️ Feuille RAM déjà vide (aucune donnée à supprimer)');
      return createResponse(true, { 
        message: 'Feuille RAM déjà vide',
        rowsDeleted: 0
      });
    }
    
    // Supprimer toutes les lignes de données (garde la ligne 1 des en-têtes)
    const rowsToDelete = lastRow - 1;
    sheet.deleteRows(2, rowsToDelete);
    
    Logger.log(`✅ ${rowsToDelete} ligne(s) supprimée(s) de la feuille RAM`);
    
    return createResponse(true, {
      message: `${rowsToDelete} ligne(s) supprimée(s)`,
      rowsDeleted: rowsToDelete,
      sheetUrl: spreadsheet.getUrl()
    });
  } catch (error) {
    return createResponse(false, 'Erreur clear RAM: ' + error.toString());
  }
}

// ==========================================
// QUOTES (DEVIS) SHEETS SYNC
// ==========================================

/**
 * Synchroniser les devis vers Google Sheets
 * @param {string} sheetId - ID du spreadsheet
 * @param {Array} quotes - Tableau des devis
 */
function syncQuotes(sheetId, quotes) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId || CONFIG.SHEETS_ID);
    let sheet = spreadsheet.getSheetByName('Devis');
    
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Devis');
    }
    
    // Clear et headers
    sheet.clear();
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
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange(1, 1, 1, headers.length).setBackground('#218c8d');
    sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
    
    // Auto-resize sera fait après ajout des données
    sheet.setFrozenRows(1);
    
    // Ajouter les données
    const rows = [];
    (quotes || []).forEach(quote => {
      const description = formatQuoteDescription(quote.items || []);
      rows.push([
        quote.number || '',
        quote.client || '',
        quote.clientSiret || '',
        quote.clientAddress || '',
        quote.date || '',
        quote.validityDate || '',
        quote.status || 'Brouillon',
        description,
        quote.totalHT || 0,
        quote.total || 0,
        quote.linkedInvoice || '',
        quote.createdAt || quote.date || '',
        quote.notes || ''
      ]);
    });
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      
      // Bordures
      sheet.getRange(2, 1, rows.length, headers.length).setBorder(
        true, true, true, true, true, true,
        '#CCCCCC',
        SpreadsheetApp.BorderStyle.SOLID
      );
      
      // Alignement des montants
      sheet.getRange(2, 9, rows.length, 2).setHorizontalAlignment('right');
    }
    
    // Auto-resize colonnes
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
    
    Logger.log('Devis synchronisés: ' + rows.length + ' lignes');
    return createResponse(true, { 
      count: rows.length,
      sheetUrl: spreadsheet.getUrl()
    });
  } catch (error) {
    return createResponse(false, 'Erreur sync devis: ' + error.toString());
  }
}

/**
 * Formater les items du devis pour affichage dans Sheets
 * @param {Array} items - Lignes du devis
 * @return {string} Description formatée
 */
function formatQuoteDescription(items) {
  if (!items || items.length === 0) return '';
  
  return items.map(item => {
    const desc = item.description || '';
    const qty = item.quantity || 0;
    const price = item.unitPrice || 0;
    return desc + ' (' + qty + ' × ' + price + '€)';
  }).join(' | ');
}

/**
 * Importer les devis depuis Google Sheets
 * @param {string} sheetId - ID du spreadsheet
 */
function importQuotes(sheetId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId || CONFIG.SHEETS_ID);
    const sheet = spreadsheet.getSheetByName('Devis');
    
    if (!sheet) {
      return createResponse(false, 'Feuille "Devis" introuvable. Créez d\'abord un onglet "Devis" dans Google Sheets.');
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      // Seulement en-tête ou vide
      return createResponse(true, { quotes: [] });
    }
    
    // Parser les lignes (skip header)
    const quotes = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip lignes vides
      if (!row[0] && !row[1]) continue;
      
      const quote = {
        number: row[0] || '',
        client: row[1] || '',
        clientSiret: row[2] || '',
        clientAddress: row[3] || '',
        date: row[4] || '',
        validityDate: row[5] || '',
        status: row[6] || 'Brouillon',
        items: parseQuoteDescription(row[7] || ''),
        totalHT: parseFloat(row[8]) || 0,
        total: parseFloat(row[9]) || 0,
        linkedInvoice: row[10] || '',
        createdAt: row[11] || '',
        notes: row[12] || ''
      };
      
      quotes.push(quote);
    }
    
    Logger.log('Devis importés: ' + quotes.length);
    return createResponse(true, { quotes: quotes });
  } catch (error) {
    return createResponse(false, 'Erreur import devis: ' + error.toString());
  }
}

/**
 * Parser la description pour reconstruire les items
 * @param {string} description - Description formatée
 * @return {Array} Tableau d'items
 */
function parseQuoteDescription(description) {
  if (!description) return [];
  
  // Parser "Desc (qty × price€) | Desc2 (qty × price€)"
  const parts = description.split(' | ');
  return parts.map(function(part) {
    // Regex pour capturer: "Description (quantity × price€)"
    const match = part.match(/^(.*?)\s*\((\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)€\)$/);
    if (match) {
      const qty = parseFloat(match[2]);
      const price = parseFloat(match[3]);
      return {
        description: match[1].trim(),
        quantity: qty,
        unitPrice: price,
        total: qty * price
      };
    }
    // Fallback: ligne unique
    return {
      description: part,
      quantity: 1,
      unitPrice: 0,
      total: 0
    };
  });
}

