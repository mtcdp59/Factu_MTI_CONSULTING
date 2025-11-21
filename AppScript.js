// MTI CONSULTING - Backend Google Apps Script
// Services: Drive (stockage JSON) + Gmail API + Calendar API + Sheets API

const CONFIG = {
  DRIVE_FOLDER: 'MTI_CONSULTING_DATA',
  DATA_FILE: 'mti_data.json',
  SHEETS_ID: '1Zu6I-c64YrBdlfvWhiVnlbwbvhv6Mw5NL8iRn2mvXoE',
  TIERS_SHEET: 'Tiers',
  EMAIL_FROM: 'mticonsulting59@gmail.com'
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
    
    switch(action) {
      case 'saveToDrive':
        return saveToDrive(data.data);
      case 'loadFromDrive':
        return loadFromDrive();
      case 'sendEmail':
        return sendEmail(data);
      case 'send_invoice':
        // Expect either full pdfBase64 in payload or instruct client to provide it
        return sendInvoiceAction(data);
      case 'sync_invoices':
        return syncInvoices(data.sheetId, data.invoices);
      case 'sync_calendar':
        return syncCalendarAction(data.tasks);
      case 'importClients':
        return importClients(data.sheetId);
      case 'exportClients':
        return exportClients(data.sheetId, data.clients);
      case 'addCalendarEvent':
        return addCalendarEvent(data.event);
      default:
        return createResponse(false, 'Action inconnue: ' + action);
    }
  } catch (error) {
    Logger.log('Erreur: ' + error.toString());
    return createResponse(false, error.toString());
  }
}

// Point d'entrée GET (test)
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'MTI CONSULTING Backend OK',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
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
        tasks: [],
        companyInfo: {
          name: 'MTI CONSULTING',
          logoUrl: 'https://github.com/mtcdp59/Factu_MTI_CONSULTING/blob/main/MTI_CONSULTING.png?raw=true',
          siret: '994 149 904 00017',
          address: '13A rue du Général de Gaulle',
          postalCode: '59110',
          city: 'La Madeleine',
          email: 'mticonsulting59@gmail.com',
          phone: '07 77 37 17 39'
        },
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
    GmailApp.sendEmail(to, subject, body, {
      from: CONFIG.EMAIL_FROM,
      attachments: [pdfBlob],
      name: 'MTI CONSULTING'
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
    
    // Trouver les indices des colonnes
    const nameIdx = headers.indexOf('Nom');
    const siretIdx = headers.indexOf('SIRET');
    const addressIdx = headers.indexOf('Adresse');
    const emailIdx = headers.indexOf('Email Facturation');
    const contactIdx = headers.indexOf('Contact');
    
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
        contact_name: row[contactIdx] || ''
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
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    let sheet = spreadsheet.getSheetByName(CONFIG.TIERS_SHEET);
    
    if (!sheet) {
      sheet = spreadsheet.insertSheet(CONFIG.TIERS_SHEET);
    }
    
    // Clear et headers
    sheet.clear();
    sheet.appendRow(['Nom', 'SIRET', 'Adresse', 'Email Facturation', 'Contact']);
    
    // Formater headers
    const headerRange = sheet.getRange(1, 1, 1, 5);
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
        client.contact_name || ''
      ]);
    });
    
    // Auto-resize
    sheet.autoResizeColumns(1, 5);
    
    Logger.log('Clients exportés: ' + clients.length);
    return createResponse(true, { 
      count: clients.length,
      sheetUrl: spreadsheet.getUrl()
    });
  } catch (error) {
    return createResponse(false, 'Erreur export clients: ' + error.toString());
  }
}

// Export invoices to a dedicated sheet (Invoices)
function exportInvoices(sheetId, invoices) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    let sheet = spreadsheet.getSheetByName('Invoices');

    if (!sheet) {
      sheet = spreadsheet.insertSheet('Invoices');
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

    const results = [];
    tasks.forEach(task => {
      try {
        const date = task.date;
        const time = task.startTime || task.time || '09:00';
        const duration = task.duration || 1;
        const description = task.description || 'Tâche';
        const type = task.type || 'Autre';

        const startDateTime = new Date(date + 'T' + time + ':00');
        const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);

        const calEvent = CalendarApp.getDefaultCalendar().createEvent(description, startDateTime, endDateTime, { description: 'Type: ' + type, location: 'MTI CONSULTING' });
        const colorId = getColorForType(type);
        if (colorId) {
          calEvent.setColor(colorId);
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
    const { date, time, duration, description, type } = event;
    
    // Créer les dates de début et fin
    const startDateTime = new Date(`${date}T${time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);
    
    // Couleur selon type
    const colorId = getColorForType(type);
    
    // Créer l'événement
    const calEvent = CalendarApp.getDefaultCalendar().createEvent(
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
