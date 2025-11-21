// In-memory data storage
let isEditMode = false;
let editingInvoiceIndex = -1;

// ===== AJOUT PERSISTANCE LOCALSTORAGE =====
function saveToLocalStorage() {
    try {
        localStorage.setItem('mti_clients', JSON.stringify(clients));
        localStorage.setItem('mti_invoices', JSON.stringify(invoices));
        localStorage.setItem('mti_tasks', JSON.stringify(tasks));
        localStorage.setItem('mti_companyInfo', JSON.stringify(companyInfo));
        localStorage.setItem('mti_taxSettings', JSON.stringify(taxSettings));
        console.log('✅ Données sauvegardées dans localStorage');
    } catch (e) {
        console.error('❌ Erreur sauvegarde localStorage:', e);
    }
}

function loadFromLocalStorage() {
    try {
        const savedClients = localStorage.getItem('mti_clients');
        const savedInvoices = localStorage.getItem('mti_invoices');
        const savedTasks = localStorage.getItem('mti_tasks');
        const savedCompanyInfo = localStorage.getItem('mti_companyInfo');
        const savedTaxSettings = localStorage.getItem('mti_taxSettings');
        
        if (savedClients) clients = JSON.parse(savedClients);
        if (savedInvoices) invoices = JSON.parse(savedInvoices);
        if (savedTasks) tasks = JSON.parse(savedTasks);
        if (savedCompanyInfo) companyInfo = JSON.parse(savedCompanyInfo);
        if (savedTaxSettings) taxSettings = JSON.parse(savedTaxSettings);
        
        console.log('✅ Données restaurées depuis localStorage');
    } catch (e) {
        console.error('❌ Erreur chargement localStorage:', e);
    }
}
// ===== FIN AJOUT =====


// Google Apps Script configuration
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbxOdUw3IXIytGkenoi8pAUDPa8fnUn6XRPnHvRzxNopEAph4asS3Ja4rLOr9AXi_xXO/exec';
const SYNC_TIMEOUT = 15000;
let isSyncing = false;
let lastSyncTime = null;

let clients = [];

let invoices = [];

let tasks = [];

// Calendar state
let currentView = 'week';
let currentDate = new Date();

// Company info - now editable via settings
let companyInfo = {
    name: 'MTI CONSULTING',
    logoUrl: 'https://github.com/mtcdp59/Factu_MTI_CONSULTING/blob/main/MTI_CONSULTING.png?raw=true',
    siret: '994 149 904 00017',
    address: '13A rue du Général de Gaulle',
    postalCode: '59110',
    city: 'La Madeleine',
    email: 'mticonsulting59@gmail.com',
    phone: '07 77 37 17 39'
};

// Tax rates - now stored in memory, editable via settings
let taxSettings = {
    tauxIS: 0,
    versementLiberatoire: 2.2,
    prorationMensuelle: 8.33,
    cfeAnnuel: 600,
    acreActif: 11.6,
    acreInactif: 24.6
};

const defaultSettings = {
    tauxIS: 0,
    versementLiberatoire: 2.2,
    prorationMensuelle: 8.33,
    cfeAnnuel: 600,
    acreActif: 11.6,
    acreInactif: 24.6
};

// DOM Elements
const navTabs = document.querySelectorAll('.nav-tab');
const tabContents = document.querySelectorAll('.tab-content');


// ===== AJOUT CHARGEMENT INITIAL =====
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    console.log('✅ Application MTI CONSULTING initialisée avec données sauvegardées');
});
// ===== FIN AJOUT =====

// Navigation
navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        navTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
        
        // Refresh content when switching tabs
        if (targetTab === 'suivi') {
            checkOverdueInvoices();
            applyFilters();
            renderCharts();
        } else if (targetTab === 'planning') {
            renderCalendar();
        } else if (targetTab === 'tiers') {
            renderClientsTable();
        } else if (targetTab === 'factures') {
            renderInvoiceList();
        }
    });
});

// TIERS - Client Management
function renderClientsTable() {
    const tbody = document.getElementById('clientsTableBody');
    tbody.innerHTML = '';
    
    clients.forEach((client, index) => {
        const clientInvoices = invoices.filter(inv => inv.client === client.name);
        const totalBilled = clientInvoices.reduce((sum, inv) => sum + inv.total, 0);
        const hasEmail = client.email_facturation && client.email_facturation.trim() !== '';
        const emailIcon = hasEmail ? ' ✉️' : '';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${client.name}${emailIcon}</strong></td>
            <td>${client.siret || '-'}</td>
            <td style="white-space: pre-line; max-width: 200px;">${client.address || '-'}</td>
            <td>${client.email_facturation || '-'}</td>
            <td>${client.contact_name || '-'}</td>
            <td>${clientInvoices.length}</td>
            <td><strong>${totalBilled.toFixed(2)} €</strong></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editClient(${index})">✏️</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteClient(${index})" style="margin-left: var(--space-4);">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function populateClientSelects() {
    const clientSelect = document.getElementById('clientSelect');
    const clientFilterSelect = document.getElementById('clientFilterSelect');
    
    // Populate invoice form select
    clientSelect.innerHTML = '<option value="">Saisie manuelle</option>';
    clients.forEach((client, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = client.name;
        clientSelect.appendChild(option);
    });
    
    // Populate filter select
    if (clientFilterSelect) {
        clientFilterSelect.innerHTML = '<option value="all">Tous les clients</option>';
        clients.forEach((client) => {
            const option = document.createElement('option');
            option.value = client.name;
            option.textContent = client.name;
            clientFilterSelect.appendChild(option);
        });
    }
}

document.getElementById('clientSelect').addEventListener('change', (e) => {
    const index = e.target.value;
    if (index === '') {
        // Manual entry
        document.getElementById('clientName').value = '';
        document.getElementById('clientSiret').value = '';
        document.getElementById('clientAddress').value = '';
        document.getElementById('clientName').readOnly = false;
        document.getElementById('clientSiret').readOnly = false;
        document.getElementById('clientAddress').readOnly = false;
        // Hide email button for manual entry
        document.getElementById('sendEmailBtn').style.display = 'none';
    } else {
        // Auto-fill from client
        const client = clients[parseInt(index)];
        document.getElementById('clientName').value = client.name;
        document.getElementById('clientSiret').value = client.siret || '';
        document.getElementById('clientAddress').value = client.address || '';
        document.getElementById('clientName').readOnly = true;
        document.getElementById('clientSiret').readOnly = true;
        document.getElementById('clientAddress').readOnly = true;
    }
});

document.getElementById('addClientBtn').addEventListener('click', () => {
    document.getElementById('clientFormCard').style.display = 'block';
    document.getElementById('clientFormTitle').textContent = 'Nouveau client';
    document.getElementById('editClientIndex').value = '-1';
    document.getElementById('clientForm').reset();
});

document.getElementById('cancelClient').addEventListener('click', () => {
    document.getElementById('clientFormCard').style.display = 'none';
    document.getElementById('clientForm').reset();
});

document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const index = parseInt(document.getElementById('editClientIndex').value);
    const client = {
        name: document.getElementById('clientFormName').value,
        siret: document.getElementById('clientFormSiret').value,
        address: document.getElementById('clientFormAddress').value,
        email_facturation: document.getElementById('clientFormEmail').value,
        contact_name: document.getElementById('clientFormContactName').value
    };
    
    if (index === -1) {
        clients.push(client);
    } else {
        clients[index] = client;
    }
    
    document.getElementById('clientFormCard').style.display = 'none';
    document.getElementById('clientForm').reset();
    renderClientsTable();
    populateClientSelects();
});

function editClient(index) {
    const client = clients[index];
    document.getElementById('clientFormTitle').textContent = 'Modifier le client';
    document.getElementById('editClientIndex').value = index;
    document.getElementById('clientFormName').value = client.name;
    document.getElementById('clientFormSiret').value = client.siret || '';
    document.getElementById('clientFormAddress').value = client.address || '';
    document.getElementById('clientFormEmail').value = client.email_facturation || '';
    document.getElementById('clientFormContactName').value = client.contact_name || '';
    document.getElementById('clientFormCard').style.display = 'block';
}

function deleteClient(index) {
    const client = clients[index];
    const clientInvoices = invoices.filter(inv => inv.client === client.name);
    
    let message = `Voulez-vous vraiment supprimer le client "${client.name}" ?`;
    if (clientInvoices.length > 0) {
        message = `Attention : Ce client a ${clientInvoices.length} facture(s) associée(s).\n\nSupprimer quand même ?`;
    }
    
    showConfirmation(
        'Supprimer le client',
        message,
        () => {
            clients.splice(index, 1);
    saveToLocalStorage();
            renderClientsTable();
            populateClientSelects();
            showToast('Client supprimé');
        }
    );
}

window.editClient = editClient;
window.deleteClient = deleteClient;

// FACTURES - Invoice Generator
const invoiceForm = document.getElementById('invoiceForm');
const invoiceNumberInput = document.getElementById('invoiceNumber');
const invoiceDateInput = document.getElementById('invoiceDate');
const dueDateInput = document.getElementById('dueDate');
const quantityInput = document.getElementById('quantity');
const unitPriceInput = document.getElementById('unitPrice');
const totalHTInput = document.getElementById('totalHT');

// Initialize invoice number with new format YYYYMM-NNN
function getNextInvoiceNumber(date = null) {
    const invoiceDate = date ? new Date(date) : new Date();
    const year = invoiceDate.getFullYear();
    const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}${month}`;
    
    // Find all invoices for this year-month
    const sameMonthInvoices = invoices.filter(inv => {
        const invNumber = inv.number;
        // Extract YYYYMM from invoice number (format: YYYYMM-NNN)
        if (invNumber.includes('-')) {
            const [invYearMonth] = invNumber.split('-');
            return invYearMonth === yearMonth;
        }
        return false;
    });
    
    // Find max sequence number for this month
    let maxSeq = 0;
    sameMonthInvoices.forEach(inv => {
        const parts = inv.number.split('-');
        if (parts.length === 2) {
            const seq = parseInt(parts[1]);
            if (seq > maxSeq) maxSeq = seq;
        }
    });
    
    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    return `${yearMonth}-${nextSeq}`;
}

// Set default dates
function setDefaultDates() {
    const today = new Date();
    const defaultDue = new Date(today);
    defaultDue.setDate(defaultDue.getDate() + 30);
    
    invoiceDateInput.value = today.toISOString().split('T')[0];
    dueDateInput.value = defaultDue.toISOString().split('T')[0];
}

// Auto-update due date and invoice number when invoice date changes
invoiceDateInput.addEventListener('change', () => {
    const invoiceDate = new Date(invoiceDateInput.value);
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);
    dueDateInput.value = dueDate.toISOString().split('T')[0];
    
    // Update invoice number based on new date (only if not in edit mode)
    if (!isEditMode) {
        invoiceNumberInput.value = getNextInvoiceNumber(invoiceDateInput.value);
    }
});

// Calculate total with optional TVA
function calculateTotal() {
    const quantity = parseFloat(quantityInput.value) || 0;
    const unitPrice = parseFloat(unitPriceInput.value) || 0;
    const totalHT = quantity * unitPrice;
    
    const tvaEnabled = document.getElementById('tvaToggle').checked;
    
    if (tvaEnabled) {
        const tva = totalHT * 0.20;
        const totalTTC = totalHT + tva;
        document.getElementById('totalHT').value = totalHT.toFixed(2) + ' €';
        document.getElementById('totalTVA').value = tva.toFixed(2) + ' €';
        document.getElementById('totalTTC').value = totalTTC.toFixed(2) + ' €';
    } else {
        document.getElementById('totalHTOnly').value = totalHT.toFixed(2) + ' €';
    }
    
    return totalHT;
}

// Toggle TVA fields visibility
const tvaToggle = document.getElementById('tvaToggle');
if (tvaToggle) {
    tvaToggle.addEventListener('change', () => {
        const tvaEnabled = tvaToggle.checked;
        document.getElementById('tvaFields').style.display = tvaEnabled ? 'block' : 'none';
        document.getElementById('noTvaFields').style.display = tvaEnabled ? 'none' : 'block';
        calculateTotal();
    });
}

quantityInput.addEventListener('input', calculateTotal);
unitPriceInput.addEventListener('input', calculateTotal);

// Format date to French format
function formatDateFR(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
}

// Preview invoice
document.getElementById('previewInvoice').addEventListener('click', () => {
    const clientName = document.getElementById('clientName').value;
    const clientAddress = document.getElementById('clientAddress').value;
    const invoiceNumber = invoiceNumberInput.value;
    const invoiceDate = invoiceDateInput.value;
    const dueDate = dueDateInput.value;
    const description = document.getElementById('serviceDescription').value;
    const quantity = quantityInput.value;
    const unitPrice = unitPriceInput.value;
    const total = calculateTotal();
    
    if (!clientName || !clientAddress || !invoiceDate || !dueDate || !description || !quantity || !unitPrice) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
    }
    
    const tvaEnabled = document.getElementById('tvaToggle').checked;
    const totalHT = total;
    const tva = tvaEnabled ? totalHT * 0.20 : 0;
    const totalTTC = totalHT + tva;
    
    let tvaSection = '';
    if (tvaEnabled) {
        tvaSection = `
            <div class="invoice-total">
                Total HT: ${totalHT.toFixed(2)} €<br>
                TVA (20%): ${tva.toFixed(2)} €<br>
                <strong>Total TTC: ${totalTTC.toFixed(2)} €</strong>
            </div>
        `;
    } else {
        tvaSection = `
            <div class="invoice-total">
                Total HT: ${totalHT.toFixed(2)} €<br>
                TVA non applicable (art. 293 B du CGI)<br>
                <strong>Total TTC: ${totalHT.toFixed(2)} €</strong>
            </div>
        `;
    }
    
    // Build company address
    const companyAddressLine = companyInfo.address && companyInfo.postalCode && companyInfo.city 
        ? `${companyInfo.address}\n${companyInfo.postalCode} ${companyInfo.city}`
        : '[À compléter dans Paramètres]';
    
    const logoHTML = companyInfo.logoUrl 
        ? `<img src="${companyInfo.logoUrl}" alt="Logo" style="max-width: 150px; max-height: 80px; object-fit: contain; margin-bottom: var(--space-12);">`
        : '';
    
    const previewHTML = `
        <div class="invoice-header">
            <div class="invoice-header-left">
                ${logoHTML}
                <div class="invoice-company">${companyInfo.name}</div>
                <div style="white-space: pre-line; font-size: 12px; line-height: 1.5; margin-top: 4px;">${companyAddressLine}</div>
                <div style="font-size: 12px; margin-top: 4px;">SIRET: ${companyInfo.siret}</div>
            </div>
            <div class="invoice-header-right">
                <div style="font-weight: bold; margin-bottom: 4px;">${clientName}</div>
                <div style="white-space: pre-line; font-size: 12px; line-height: 1.5;">${clientAddress}</div>
            </div>
        </div>
        
        <div class="invoice-details">
            <h2 class="invoice-number">FACTURE N° ${invoiceNumber}</h2>
            <div style="font-size: 13px;">
                <div>Date: ${formatDateFR(invoiceDate)}</div>
                <div>Échéance: ${formatDateFR(dueDate)}</div>
            </div>
        </div>
        
        <hr class="separator">
        
        <table class="invoice-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th style="text-align: center;">Quantité</th>
                    <th style="text-align: right;">Prix unitaire</th>
                    <th style="text-align: right;">Total HT</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${description}</td>
                    <td style="text-align: center;">${quantity}</td>
                    <td style="text-align: right;">${parseFloat(unitPrice).toFixed(2)} €</td>
                    <td style="text-align: right;">${total.toFixed(2)} €</td>
                </tr>
            </tbody>
        </table>
        
        ${tvaSection}
        
        <div class="invoice-legal">
            <p>Dispensé d'immatriculation RCS/RM | TVA non applicable art. 293B CGI | Conditions: Paiement à 30 jours</p>
            <p>Retard: indemnité forfaitaire 40€ + intérêts au taux légal | Escompte: néant</p>
        </div>
    `;
    
    document.getElementById('invoicePreviewContent').innerHTML = previewHTML;
    document.getElementById('invoiceModal').classList.add('show');
});

// Close modal
document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('invoiceModal').classList.remove('show');
});

// Email sending functionality
let currentInvoiceData = null;

document.getElementById('sendEmailBtn').addEventListener('click', () => {
    const clientName = document.getElementById('clientName').value;
    const invoiceNumber = invoiceNumberInput.value;
    const invoiceDate = invoiceDateInput.value;
    const dueDate = dueDateInput.value;
    const total = calculateTotal();
    
    if (!clientName || !invoiceDate || !dueDate) {
        alert('Veuillez remplir tous les champs obligatoires avant d\'envoyer l\'email');
        return;
    }
    
    // Find client data
    const client = clients.find(c => c.name === clientName);
    
    currentInvoiceData = {
        clientName,
        invoiceNumber,
        invoiceDate,
        dueDate,
        total,
        client
    };
    
    showEmailPreview();
});

function showEmailPreview() {
    const { clientName, invoiceNumber, invoiceDate, dueDate, total, client } = currentInvoiceData;
    
    // Check if email is configured
    const hasEmail = client && client.email_facturation && client.email_facturation.trim() !== '';
    const contactName = (client && client.contact_name && client.contact_name.trim() !== '') ? client.contact_name : clientName;
    const emailTo = hasEmail ? client.email_facturation : '';
    
    // Build email content
    const subject = `Facture #${invoiceNumber} - MTI CONSULTING`;
    const body = `Bonjour ${contactName},

Veuillez trouver ci-joint la facture #${invoiceNumber} d'un montant de ${total.toFixed(2)}€ HT.

Date d'émission : ${formatDateFR(invoiceDate)}
Date d'échéance : ${formatDateFR(dueDate)}
Conditions de paiement : 30 jours nets

⚠️ Note importante : Merci de joindre le fichier PDF de la facture avant l'envoi (limitation technique des emails pré-remplis).

Pour toute question, n'hésitez pas à me contacter.

Cordialement,
Mickaël TOURDOT-IGUEDJETAL
MTI CONSULTING
Email : mticonsulting59@gmail.com
Téléphone : 07 77 37 17 39`;
    
    // Display preview
    document.getElementById('emailTo').textContent = emailTo || '(À compléter manuellement)';
    document.getElementById('emailSubject').textContent = subject;
    document.getElementById('emailBody').textContent = body;
    
    // Show warning if no email
    const warningDiv = document.getElementById('emailWarning');
    if (!hasEmail) {
        warningDiv.style.display = 'block';
        warningDiv.innerHTML = '⚠️ <strong>Aucun contact email configuré pour ce client.</strong><br>L\'email s\'ouvrira en brouillon sans destinataire. Veuillez ajouter l\'email dans la gestion des tiers ou compléter manuellement.';
    } else {
        warningDiv.style.display = 'none';
    }
    
    document.getElementById('emailModal').classList.add('show');
}

document.getElementById('closeEmailModal').addEventListener('click', () => {
    document.getElementById('emailModal').classList.remove('show');
});

document.getElementById('cancelEmail').addEventListener('click', () => {
    document.getElementById('emailModal').classList.remove('show');
});

document.getElementById('confirmEmail').addEventListener('click', () => {
    const { clientName, invoiceNumber, invoiceDate, dueDate, total, client } = currentInvoiceData;
    
    const hasEmail = client && client.email_facturation && client.email_facturation.trim() !== '';
    const contactName = (client && client.contact_name && client.contact_name.trim() !== '') ? client.contact_name : clientName;
    const emailTo = hasEmail ? client.email_facturation : '';
    
    // Build mailto link
    const subject = `Facture #${invoiceNumber} - MTI CONSULTING`;
    const body = `Bonjour ${contactName},

Veuillez trouver ci-joint la facture #${invoiceNumber} d'un montant de ${total.toFixed(2)}€ HT.

Date d'émission : ${formatDateFR(invoiceDate)}
Date d'échéance : ${formatDateFR(dueDate)}
Conditions de paiement : 30 jours nets

⚠️ Note importante : Merci de joindre le fichier PDF de la facture avant l'envoi (limitation technique des emails pré-remplis).

Pour toute question, n'hésitez pas à me contacter.

Cordialement,
Mickaël TOURDOT-IGUEDJETAL
MTI CONSULTING
Email : mticonsulting59@gmail.com
Téléphone : 07 77 37 17 39`;
    
    // URL encode
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    
    // Create mailto link
    const mailtoLink = `mailto:${emailTo}?subject=${encodedSubject}&body=${encodedBody}`;
    
    // Open in default email client
    window.location.href = mailtoLink;
    
    // Close modal
    document.getElementById('emailModal').classList.remove('show');
    
    // Show confirmation and prompt to reset
    setTimeout(() => {
        alert('Email préparé et ouvert dans votre client de messagerie. N\'oubliez pas de joindre le PDF de la facture avant l\'envoi !');
        if (confirm('Voulez-vous créer une nouvelle facture ?')) {
            resetInvoiceForm();
        }
    }, 500);
});

// Save invoice
invoiceForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const invoiceData = {
        number: invoiceNumberInput.value,
        client: document.getElementById('clientName').value,
        clientSiret: document.getElementById('clientSiret').value,
        clientAddress: document.getElementById('clientAddress').value,
        date: invoiceDateInput.value,
        dueDate: dueDateInput.value,
        description: document.getElementById('serviceDescription').value,
        quantity: parseFloat(quantityInput.value),
        unitPrice: parseFloat(unitPriceInput.value),
        total: calculateTotal()
    };
    
    if (isEditMode) {
        // Update existing invoice
        invoices[editingInvoiceIndex] = {
            ...invoices[editingInvoiceIndex],
            ...invoiceData
        };
        showToast('✅ Facture mise à jour');
        
        // Auto-sync after update
        autoSync('update');
        
        // Exit edit mode
        cancelEditMode();
    } else {
        // Create new invoice
        const invoice = {
            ...invoiceData,
            status: 'Brouillon',
            montantRecu: 0,
            dateReception: null
        };
        
        invoices.push(invoice);
        showToast('✅ Facture créée avec succès');
        
        // Auto-sync after creation
        autoSync('create');
        
        // Show send email button and new invoice button
        document.getElementById('sendEmailBtn').style.display = 'inline-flex';
        document.getElementById('newInvoiceBtn').style.display = 'inline-flex';
        
        // Add prompt after save
        setTimeout(() => {
            if (confirm('Facture enregistrée ! Voulez-vous envoyer l\'email maintenant ?')) {
                document.getElementById('sendEmailBtn').click();
            }
        }, 100);
    }
    
    // Refresh invoice list and tracking
    renderInvoiceList();
    applyFilters();
    renderCharts();
});

// Add a reset button handler
function resetInvoiceForm() {
    // Exit edit mode if active
    if (isEditMode) {
        isEditMode = false;
        editingInvoiceIndex = -1;
        document.getElementById('editModeIndicator').style.display = 'none';
        document.getElementById('submitInvoiceBtn').textContent = '💾 Créer facture';
        document.getElementById('cancelEditBtn').style.display = 'none';
    }
    
    invoiceForm.reset();
    document.getElementById('clientSelect').value = '';
    document.getElementById('clientName').readOnly = false;
    document.getElementById('clientSiret').readOnly = false;
    document.getElementById('clientAddress').readOnly = false;
    document.getElementById('sendEmailBtn').style.display = 'none';
    document.getElementById('newInvoiceBtn').style.display = 'none';
    invoiceNumberInput.value = getNextInvoiceNumber();
    setDefaultDates();
    calculateTotal();
}

window.resetInvoiceForm = resetInvoiceForm;

// PLANNING - Calendar with Day/Week/Month views
function changeCalendarView(view) {
    currentView = view;
    document.getElementById('viewDay').classList.remove('active');
    document.getElementById('viewWeek').classList.remove('active');
    document.getElementById('viewMonth').classList.remove('active');
    document.getElementById('view' + view.charAt(0).toUpperCase() + view.slice(1)).classList.add('active');
    renderCalendar();
}

function navigateCalendar(direction) {
    if (direction === 0) {
        currentDate = new Date();
    } else if (currentView === 'day') {
        currentDate.setDate(currentDate.getDate() + direction);
    } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + (direction * 7));
    } else if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + direction);
    }
    renderCalendar();
}

function getWeekDates(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    
    const dates = [];
    for (let i = 0; i < 5; i++) {
        const weekDay = new Date(monday);
        weekDay.setDate(monday.getDate() + i);
        dates.push(weekDay);
    }
    return dates;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function renderCalendar() {
    updateCurrentDateDisplay();
    
    if (currentView === 'day') {
        renderDayView();
    } else if (currentView === 'week') {
        renderWeekView();
    } else if (currentView === 'month') {
        renderMonthView();
    }
    
    updateWeeklyStats();
}

function updateCurrentDateDisplay() {
    const display = document.getElementById('currentDateDisplay');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    
    if (currentView === 'day') {
        display.textContent = currentDate.toLocaleDateString('fr-FR', options);
    } else if (currentView === 'week') {
        const weekDates = getWeekDates(currentDate);
        const start = weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        const end = weekDates[4].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        display.textContent = `Semaine du ${start} au ${end}`;
    } else if (currentView === 'month') {
        display.textContent = currentDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
    }
}

function renderDayView() {
    const container = document.getElementById('calendarContainer');
    const dateStr = formatDate(currentDate);
    const dayTasks = tasks.filter(task => task.date === dateStr);
    
    const timeSlots = [];
    for (let h = 8; h <= 18; h++) {
        for (let m = 0; m < 60; m += 30) {
            if (h === 18 && m > 0) break;
            timeSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    }
    
    let html = '<div style="border: 1px solid var(--color-card-border); border-radius: var(--radius-base); overflow: hidden;">';
    
    timeSlots.forEach(slot => {
        const tasksAtTime = dayTasks.filter(task => task.startTime === slot);
        html += `<div style="display: flex; border-bottom: 1px solid var(--color-card-border);">`;
        html += `<div style="width: 80px; padding: var(--space-8); background-color: var(--color-bg-1); font-weight: var(--font-weight-medium); font-size: var(--font-size-sm);">${slot}</div>`;
        html += `<div style="flex: 1; padding: var(--space-8); min-height: 40px;">`;
        
        tasksAtTime.forEach(task => {
            const color = task.type === 'Travail' ? 'var(--color-primary)' : task.type === 'Réunion client' ? '#3B82F6' : 'var(--color-slate-500)';
            html += `<div style="background-color: rgba(var(--color-teal-500-rgb), 0.1); border-left: 3px solid ${color}; padding: var(--space-6); border-radius: var(--radius-sm); margin-bottom: var(--space-4); cursor: pointer;" onclick="editTask(${tasks.indexOf(task)})">`;
            html += `<strong>${task.description}</strong> (${task.duration}h)`;
            html += `</div>`;
        });
        
        html += `</div></div>`;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function renderWeekView() {
    const container = document.getElementById('calendarContainer');
    const weekDates = getWeekDates(currentDate);
    const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    
    let html = '<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-8);">';
    
    weekDates.forEach((date, index) => {
        const dateStr = formatDate(date);
        const dayTasks = tasks.filter(task => task.date === dateStr);
        const isToday = formatDate(new Date()) === dateStr;
        
        html += `<div style="border: 1px solid var(--color-card-border); border-radius: var(--radius-base); padding: var(--space-12); min-height: 200px; background-color: var(--color-surface); ${isToday ? 'box-shadow: 0 0 0 2px var(--color-primary);' : ''}">`;
        html += `<div style="font-weight: var(--font-weight-semibold); margin-bottom: var(--space-8); padding-bottom: var(--space-8); border-bottom: 1px solid var(--color-card-border); font-size: var(--font-size-sm);">${daysOfWeek[index]}<br><span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${date.getDate()}/${date.getMonth()+1}</span></div>`;
        
        dayTasks.forEach(task => {
            const color = task.type === 'Travail' ? 'var(--color-primary)' : task.type === 'Réunion client' ? '#3B82F6' : 'var(--color-slate-500)';
            html += `<div style="background-color: rgba(var(--color-teal-500-rgb), 0.1); border-left: 3px solid ${color}; padding: var(--space-6); border-radius: var(--radius-sm); margin-bottom: var(--space-6); font-size: var(--font-size-xs); cursor: pointer;" onclick="editTask(${tasks.indexOf(task)})">`;
            html += `<div style="font-weight: var(--font-weight-semibold); color: var(--color-text);">${task.startTime} (${task.duration}h)</div>`;
            html += `<div style="color: var(--color-text-secondary); font-size: var(--font-size-xs);">${task.description}</div>`;
            html += `</div>`;
        });
        
        html += `</div>`;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function renderMonthView() {
    const container = document.getElementById('calendarContainer');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const daysInMonth = lastDay.getDate();
    
    let html = '<div style="border: 1px solid var(--color-card-border); border-radius: var(--radius-base); overflow: hidden;">';
    
    // Header
    html += '<div style="display: grid; grid-template-columns: repeat(7, 1fr); background-color: var(--color-bg-1);">';
    ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(day => {
        html += `<div style="padding: var(--space-8); text-align: center; font-weight: var(--font-weight-semibold); font-size: var(--font-size-sm);">${day}</div>`;
    });
    html += '</div>';
    
    // Days
    html += '<div style="display: grid; grid-template-columns: repeat(7, 1fr);">';
    
    for (let i = 0; i < firstDayOfWeek; i++) {
        html += '<div style="padding: var(--space-8); min-height: 80px; border: 1px solid var(--color-card-border); background-color: var(--color-secondary);"></div>';
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDate(date);
        const dayTasks = tasks.filter(task => task.date === dateStr);
        const isToday = formatDate(new Date()) === dateStr;
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        
        html += `<div style="padding: var(--space-8); min-height: 80px; border: 1px solid var(--color-card-border); cursor: pointer; ${isToday ? 'background-color: rgba(var(--color-teal-500-rgb), 0.1); font-weight: var(--font-weight-bold);' : ''} ${isWeekend ? 'background-color: var(--color-secondary);' : ''}" onclick="showDayTasks('${dateStr}')">`;
        html += `<div style="font-size: var(--font-size-sm); margin-bottom: var(--space-4);">${day}</div>`;
        
        if (dayTasks.length > 0) {
            dayTasks.slice(0, 2).forEach(task => {
                const color = task.type === 'Travail' ? 'var(--color-primary)' : task.type === 'Réunion client' ? '#3B82F6' : 'var(--color-slate-500)';
                html += `<div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; display: inline-block; margin-right: var(--space-4);"></div>`;
            });
            if (dayTasks.length > 2) {
                html += `<span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">+${dayTasks.length - 2}</span>`;
            }
        }
        
        html += '</div>';
    }
    
    html += '</div></div>';
    container.innerHTML = html;
}

function showDayTasks(dateStr) {
    const dayTasks = tasks.filter(task => task.date === dateStr);
    const date = new Date(dateStr);
    const dateFormatted = date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    if (dayTasks.length === 0) {
        alert(`Aucune tâche pour ${dateFormatted}`);
        return;
    }
    
    let message = `Tâches pour ${dateFormatted}:\n\n`;
    dayTasks.forEach((task, index) => {
        message += `${index + 1}. ${task.startTime} - ${task.description} (${task.duration}h)\n`;
    });
    message += `\nCliquez sur une tâche dans le calendrier pour la modifier.`;
    
    alert(message);
}

window.changeCalendarView = changeCalendarView;
window.navigateCalendar = navigateCalendar;
window.showDayTasks = showDayTasks;

function updateWeeklyStats() {
    let filteredTasks = tasks;
    
    if (currentView === 'week') {
        const weekDates = getWeekDates(currentDate);
        const weekDateStrs = weekDates.map(d => formatDate(d));
        filteredTasks = tasks.filter(task => weekDateStrs.includes(task.date));
    } else if (currentView === 'day') {
        const dateStr = formatDate(currentDate);
        filteredTasks = tasks.filter(task => task.date === dateStr);
    } else if (currentView === 'month') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        filteredTasks = tasks.filter(task => {
            const taskDate = new Date(task.date);
            return taskDate.getFullYear() === year && taskDate.getMonth() === month;
        });
    }
    
    const totalHours = filteredTasks.reduce((sum, task) => sum + task.duration, 0);
    const workHours = filteredTasks.filter(t => t.type === 'Travail').reduce((sum, task) => sum + task.duration, 0);
    const meetingHours = filteredTasks.filter(t => t.type === 'Réunion client').reduce((sum, task) => sum + task.duration, 0);
    const adminHours = filteredTasks.filter(t => t.type === 'Administratif').reduce((sum, task) => sum + task.duration, 0);
    
    const viewLabel = currentView === 'day' ? 'journalier' : currentView === 'week' ? 'hebdomadaire' : 'mensuel';
    
    document.getElementById('weeklyStats').innerHTML = `
        <strong>Total ${viewLabel}: ${totalHours}h</strong> 
        (Travail: ${workHours}h | Réunions: ${meetingHours}h | Admin: ${adminHours}h)
    `;
}

// Task form
document.getElementById('addTaskBtn').addEventListener('click', () => {
    document.getElementById('taskDate').value = formatDate(currentDate);
    document.getElementById('taskFormCard').style.display = 'block';
});

document.getElementById('cancelTask').addEventListener('click', () => {
    document.getElementById('taskFormCard').style.display = 'none';
    document.getElementById('taskForm').reset();
});

document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const task = {
        date: document.getElementById('taskDate').value,
        startTime: document.getElementById('taskTime').value,
        duration: parseFloat(document.getElementById('taskDuration').value),
        type: document.getElementById('taskType').value,
        description: document.getElementById('taskDescription').value
    };
    
    tasks.push(task);
    renderCalendar();
    document.getElementById('taskFormCard').style.display = 'none';
    document.getElementById('taskForm').reset();
    showToast('Tâche ajoutée avec succès');
});

// Edit task
function editTask(index) {
    const task = tasks[index];
    document.getElementById('editTaskIndex').value = index;
    document.getElementById('editTaskDate').value = task.date;
    document.getElementById('editTaskTime').value = task.startTime;
    document.getElementById('editTaskDuration').value = task.duration;
    document.getElementById('editTaskType').value = task.type;
    document.getElementById('editTaskDescription').value = task.description;
    document.getElementById('editTaskModal').classList.add('show');
}

window.editTask = editTask;

document.getElementById('closeEditTaskModal').addEventListener('click', () => {
    document.getElementById('editTaskModal').classList.remove('show');
});

document.getElementById('cancelEditTask').addEventListener('click', () => {
    document.getElementById('editTaskModal').classList.remove('show');
});

document.getElementById('editTaskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const index = parseInt(document.getElementById('editTaskIndex').value);
    tasks[index] = {
        date: document.getElementById('editTaskDate').value,
        startTime: document.getElementById('editTaskTime').value,
        duration: parseFloat(document.getElementById('editTaskDuration').value),
        type: document.getElementById('editTaskType').value,
        description: document.getElementById('editTaskDescription').value
    };
    
    renderCalendar();
    document.getElementById('editTaskModal').classList.remove('show');
    showToast('Tâche mise à jour');
});

function deleteTaskFromEdit() {
    const index = parseInt(document.getElementById('editTaskIndex').value);
    showConfirmation(
        'Supprimer la tâche',
        'Êtes-vous sûr de vouloir supprimer cette tâche ?',
        () => {
            tasks.splice(index, 1);
            renderCalendar();
            document.getElementById('editTaskModal').classList.remove('show');
            showToast('Tâche supprimée');
        }
    );
}

window.deleteTaskFromEdit = deleteTaskFromEdit;

// SUIVI - Invoice Tracking
function checkOverdueInvoices() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    invoices.forEach(invoice => {
        const dueDate = new Date(invoice.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        if (invoice.status === 'Envoyée' && dueDate < today) {
            invoice.status = 'Retard';
        }
    });
}

function getFilteredInvoices() {
    let filtered = [...invoices];
    
    // Period filter
    const period = document.getElementById('periodFilter').value;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (period !== 'all') {
        filtered = filtered.filter(inv => {
            const invDate = new Date(inv.date);
            invDate.setHours(0, 0, 0, 0);
            
            if (period === 'day') {
                return invDate.getTime() === today.getTime();
            } else if (period === 'week') {
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay() + 1);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                return invDate >= weekStart && invDate <= weekEnd;
            } else if (period === 'month') {
                return invDate.getMonth() === today.getMonth() && invDate.getFullYear() === today.getFullYear();
            } else if (period === 'year') {
                return invDate.getFullYear() === today.getFullYear();
            }
            return true;
        });
    }
    
    // Date range filter
    const startDate = document.getElementById('startDateFilter').value;
    const endDate = document.getElementById('endDateFilter').value;
    
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
            filtered = filtered.filter(inv => new Date(inv.date) >= start);
    }
    
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(inv => new Date(inv.date) <= end);
    }
    
    // Client filter
    const clientFilter = document.getElementById('clientFilterSelect').value;
    if (clientFilter !== 'all') {
        filtered = filtered.filter(inv => inv.client === clientFilter);
    }
    
    // Status filter
    const statusFilter = document.getElementById('statusFilter').value;
    if (statusFilter !== 'all') {
        filtered = filtered.filter(inv => inv.status === statusFilter);
    }
    
    return filtered;
}

function applyFilters() {
    const filtered = getFilteredInvoices();
    renderInvoiceTable(filtered);
    updateSummary(filtered);
}

function renderInvoiceTable(filteredInvoices) {
    const tbody = document.getElementById('invoiceTableBody');
    tbody.innerHTML = '';
    
    filteredInvoices.forEach((invoice, realIndex) => {
        const index = invoices.indexOf(invoice);
        const montantRecu = parseFloat(invoice.montantRecu) || 0;
        const reste = invoice.total - montantRecu;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${invoice.number}</strong></td>
            <td>${invoice.client}</td>
            <td>${formatDateFR(invoice.date)}</td>
            <td>${formatDateFR(invoice.dueDate)}</td>
            <td><strong>${invoice.total.toFixed(2)} €</strong></td>
            <td><input type="number" class="form-control" style="width: 100px; font-size: var(--font-size-xs);" value="${montantRecu}" step="0.01" min="0" onchange="updateMontantRecu(${index}, this.value)"></td>
            <td><input type="date" class="form-control" style="width: 140px; font-size: var(--font-size-xs);" value="${invoice.dateReception || ''}" onchange="updateDateReception(${index}, this.value)"></td>
            <td><strong>${reste.toFixed(2)} €</strong></td>
            <td><span class="status-badge status-${invoice.status.toLowerCase().replace('ée', 'ee').replace('é', 'e')}">${invoice.status}</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editInvoice(${index})" title="Modifier">✏️</button>
                <button class="btn btn-sm btn-secondary" onclick="duplicateInvoice(${index})" title="Dupliquer" style="margin-left: var(--space-4);">📋</button>
                <button class="btn btn-sm btn-primary" onclick="sendInvoiceEmail(${index})" title="Envoyer par email" style="margin-left: var(--space-4);">📧</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteInvoice(${index})" title="Supprimer" style="margin-left: var(--space-4);">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Render invoice list in FACTURES tab
function renderInvoiceList() {
    const tbody = document.getElementById('invoiceListBody');
    tbody.innerHTML = '';
    
    if (invoices.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="text-align: center; color: var(--color-text-secondary); padding: var(--space-24);">Aucune facture créée</td>';
        tbody.appendChild(row);
        return;
    }
    
    invoices.forEach((invoice, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${invoice.number}</strong></td>
            <td>${invoice.client}</td>
            <td>${formatDateFR(invoice.date)}</td>
            <td><strong>${invoice.total.toFixed(2)} €</strong></td>
            <td><span class="status-badge status-${invoice.status.toLowerCase().replace('ée', 'ee').replace('é', 'e')}">${invoice.status}</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editInvoiceInForm(${index})" title="Modifier">✏️ Modifier</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteInvoiceFromList(${index})" title="Supprimer" style="margin-left: var(--space-4);">🗑️ Supprimer</button>
                <button class="btn btn-sm btn-primary" onclick="sendInvoiceEmail(${index})" title="Envoyer par email" style="margin-left: var(--space-4);">📧 Envoyer</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Edit invoice in main form (FACTURES tab)
function editInvoiceInForm(index) {
    const invoice = invoices[index];
    
    // Set edit mode
    isEditMode = true;
    editingInvoiceIndex = index;
    
    // Show edit mode indicator
    document.getElementById('editModeIndicator').style.display = 'block';
    document.getElementById('editingInvoiceNumber').textContent = invoice.number;
    
    // Update submit button text
    document.getElementById('submitInvoiceBtn').textContent = '💾 Mettre à jour facture';
    
    // Show cancel button
    document.getElementById('cancelEditBtn').style.display = 'inline-flex';
    
    // Pre-fill form fields
    document.getElementById('invoiceNumber').value = invoice.number;
    document.getElementById('clientName').value = invoice.client;
    document.getElementById('clientSiret').value = invoice.clientSiret || '';
    document.getElementById('clientAddress').value = invoice.clientAddress || '';
    document.getElementById('invoiceDate').value = invoice.date;
    document.getElementById('dueDate').value = invoice.dueDate;
    document.getElementById('serviceDescription').value = invoice.description;
    document.getElementById('quantity').value = invoice.quantity;
    document.getElementById('unitPrice').value = invoice.unitPrice;
    
    // Reset client select to manual mode
    document.getElementById('clientSelect').value = '';
    document.getElementById('clientName').readOnly = false;
    document.getElementById('clientSiret').readOnly = false;
    document.getElementById('clientAddress').readOnly = false;
    
    // Recalculate totals
    calculateTotal();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Cancel edit mode
function cancelEditMode() {
    isEditMode = false;
    editingInvoiceIndex = -1;
    
    // Hide edit mode indicator
    document.getElementById('editModeIndicator').style.display = 'none';
    
    // Reset submit button text
    document.getElementById('submitInvoiceBtn').textContent = '💾 Créer facture';
    
    // Hide cancel button
    document.getElementById('cancelEditBtn').style.display = 'none';
    
    // Reset form
    invoiceForm.reset();
    document.getElementById('clientSelect').value = '';
    document.getElementById('clientName').readOnly = false;
    document.getElementById('clientSiret').readOnly = false;
    document.getElementById('clientAddress').readOnly = false;
    setDefaultDates();
    invoiceNumberInput.value = getNextInvoiceNumber(invoiceDateInput.value);
    calculateTotal();
}

window.editInvoiceInForm = editInvoiceInForm;
window.cancelEditMode = cancelEditMode;

// Edit invoice (for tracking table modal)
function editInvoice(index) {
    const invoice = invoices[index];
    document.getElementById('editInvoiceIndex').value = index;
    document.getElementById('editInvoiceNumber').value = invoice.number;
    document.getElementById('editInvoiceStatus').value = invoice.status;
    document.getElementById('editClientName').value = invoice.client;
    document.getElementById('editClientSiret').value = invoice.clientSiret || '';
    document.getElementById('editClientAddress').value = invoice.clientAddress || '';
    document.getElementById('editInvoiceDate').value = invoice.date;
    document.getElementById('editDueDate').value = invoice.dueDate;
    document.getElementById('editServiceDescription').value = invoice.description;
    document.getElementById('editQuantity').value = invoice.quantity;
    document.getElementById('editUnitPrice').value = invoice.unitPrice;
    document.getElementById('editInvoiceModal').classList.add('show');
}

window.editInvoice = editInvoice;

document.getElementById('closeEditInvoiceModal').addEventListener('click', () => {
    document.getElementById('editInvoiceModal').classList.remove('show');
});

document.getElementById('cancelEditInvoice').addEventListener('click', () => {
    document.getElementById('editInvoiceModal').classList.remove('show');
});

document.getElementById('editInvoiceForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const index = parseInt(document.getElementById('editInvoiceIndex').value);
    const quantity = parseFloat(document.getElementById('editQuantity').value);
    const unitPrice = parseFloat(document.getElementById('editUnitPrice').value);
    
    invoices[index] = {
        ...invoices[index],
        status: document.getElementById('editInvoiceStatus').value,
        client: document.getElementById('editClientName').value,
        clientSiret: document.getElementById('editClientSiret').value,
        clientAddress: document.getElementById('editClientAddress').value,
        date: document.getElementById('editInvoiceDate').value,
        dueDate: document.getElementById('editDueDate').value,
        description: document.getElementById('editServiceDescription').value,
        quantity: quantity,
        unitPrice: unitPrice,
        total: quantity * unitPrice
    };
    
    document.getElementById('editInvoiceModal').classList.remove('show');
    renderInvoiceList();
    applyFilters();
    showToast('Facture mise à jour');
    
    // Auto-sync after edit
    autoSync('update');
});

// Delete invoice from list (FACTURES tab)
function deleteInvoiceFromList(index) {
    const invoice = invoices[index];
    showConfirmation(
        'Confirmation de suppression',
        `Êtes-vous sûr de vouloir supprimer la facture #${invoice.number} du client ${invoice.client} ?`,
        () => {
            invoices.splice(index, 1);
            renderInvoiceList();
            applyFilters();
            renderCharts();
            showToast('✅ Facture supprimée');
            
            // Auto-sync after deletion
            autoSync('delete');
            
            // If we were editing this invoice, cancel edit mode
            if (isEditMode && editingInvoiceIndex === index) {
                cancelEditMode();
            }
        }
    );
}

window.deleteInvoiceFromList = deleteInvoiceFromList;

// Delete invoice (for tracking table)
function deleteInvoice(index) {
    const invoice = invoices[index];
    showConfirmation(
        'Confirmation de suppression',
        `Êtes-vous sûr de vouloir supprimer la facture #${invoice.number} du client ${invoice.client} ?`,
        () => {
            invoices.splice(index, 1);
            renderInvoiceList();
            applyFilters();
            renderCharts();
            showToast('✅ Facture supprimée');
            
            // Auto-sync after deletion
            autoSync('delete');
        }
    );
}

window.deleteInvoice = deleteInvoice;

// Duplicate invoice
function duplicateInvoice(index) {
    const invoice = invoices[index];
    const today = new Date().toISOString().split('T')[0];
    const newInvoice = {
        ...invoice,
        number: getNextInvoiceNumber(today),
        date: today,
        dueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        status: 'Brouillon',
        montantRecu: 0,
        dateReception: null
    };
    invoices.push(newInvoice);
    renderInvoiceList();
    applyFilters();
    showToast('Facture dupliquée');
}

window.duplicateInvoice = duplicateInvoice;

function updateMontantRecu(index, value) {
    invoices[index].montantRecu = parseFloat(value) || 0;
    
    // Auto-update status to Payée if fully paid
    if (invoices[index].montantRecu >= invoices[index].total) {
        invoices[index].status = 'Payée';
    }
    
    applyFilters();
    
    // Auto-sync after payment update
    autoSync('payment');
}

function updateDateReception(index, value) {
    invoices[index].dateReception = value;
    applyFilters();
    
    // Auto-sync after date update
    autoSync('payment');
}

function updateSummary(filteredInvoices = invoices) {
    const totalFacture = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaye = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.montantRecu) || 0), 0);
    const totalAttente = totalFacture - totalPaye;
    const tauxRecouvrement = totalFacture > 0 ? (totalPaye / totalFacture * 100) : 0;
    
    document.getElementById('totalFacture').textContent = totalFacture.toFixed(2) + ' €';
    document.getElementById('totalPaye').textContent = totalPaye.toFixed(2) + ' €';
    document.getElementById('totalAttente').textContent = totalAttente.toFixed(2) + ' €';
    document.getElementById('tauxRecouvrement').textContent = tauxRecouvrement.toFixed(1) + '%';
}

window.updateMontantRecu = updateMontantRecu;
window.updateDateReception = updateDateReception;

// Send email for existing invoice from tracking table
function sendInvoiceEmail(index) {
    const invoice = invoices[index];
    const client = clients.find(c => c.name === invoice.client);
    
    // Check if email is available
    const hasEmail = client && client.email_facturation && client.email_facturation.trim() !== '';
    
    if (!hasEmail) {
        showToast('⚠️ Aucun email configuré pour ce client', 'info');
        // Fall back to old email preview
        currentInvoiceData = {
            clientName: invoice.client,
            invoiceNumber: invoice.number,
            invoiceDate: invoice.date,
            dueDate: invoice.dueDate,
            total: invoice.total,
            client: client
        };
        showEmailPreview();
        return;
    }
    
    // Confirm before sending
    const contactName = client.contact_name || invoice.client;
    showConfirmation(
        'Envoi par Gmail',
        `Envoyer la facture #${invoice.number} à ${contactName} (${client.email_facturation}) ?\n\nLe PDF sera généré et envoyé automatiquement via Gmail.`,
        () => {
            sendInvoiceWithPDF(invoice);
        }
    );
}

window.sendInvoiceEmail = sendInvoiceEmail;

// Filter event listeners
if (document.getElementById('periodFilter')) {
    document.getElementById('periodFilter').addEventListener('change', applyFilters);
    document.getElementById('startDateFilter').addEventListener('change', applyFilters);
    document.getElementById('endDateFilter').addEventListener('change', applyFilters);
    document.getElementById('clientFilterSelect').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
}

// PARAMÈTRES - Settings Management
function loadCompanySettings() {
    if (document.getElementById('logoUrl')) {
        document.getElementById('logoUrl').value = companyInfo.logoUrl || '';
        document.getElementById('companyLegalSiret').value = companyInfo.siret || '[SIRET à venir]';
        document.getElementById('companyAddress').value = companyInfo.address || '[Adresse]';
        document.getElementById('companyPostal').value = companyInfo.postalCode || '[Code postal]';
        document.getElementById('companyCity').value = companyInfo.city || '[Ville]';
    }
}

function saveSettings() {
    // Save company info
    if (document.getElementById('logoUrl')) {
        companyInfo.logoUrl = document.getElementById('logoUrl').value || '';
        companyInfo.siret = document.getElementById('companyLegalSiret').value || '[SIRET à venir]';
        companyInfo.address = document.getElementById('companyAddress').value || '[Adresse]';
        companyInfo.postalCode = document.getElementById('companyPostal').value || '[Code postal]';
        companyInfo.city = document.getElementById('companyCity').value || '[Ville]';
    }
    taxSettings.tauxIS = parseFloat(document.getElementById('tauxIS').value) || 0;
    taxSettings.versementLiberatoire = parseFloat(document.getElementById('tauxVersementLib').value) || 2.2;
    taxSettings.prorationMensuelle = parseFloat(document.getElementById('prorationMensuelle').value) || 8.33;
    taxSettings.cfeAnnuel = parseFloat(document.getElementById('cfeAnnuel').value) || 600;
    taxSettings.acreActif = parseFloat(document.getElementById('tauxAcreActif').value) || 11.6;
    taxSettings.acreInactif = parseFloat(document.getElementById('tauxAcreInactif').value) || 24.6;
    
    // Show confirmation
    const confirmation = document.getElementById('saveConfirmation');
    confirmation.style.display = 'block';
    setTimeout(() => {
        confirmation.style.display = 'none';
    }, 3000);
    
    // Recalculate taxes if on calculs tab
    calculateTaxes();
}

function resetSettings() {
    document.getElementById('tauxIS').value = defaultSettings.tauxIS;
    document.getElementById('tauxVersementLib').value = defaultSettings.versementLiberatoire;
    document.getElementById('prorationMensuelle').value = defaultSettings.prorationMensuelle;
    document.getElementById('cfeAnnuel').value = defaultSettings.cfeAnnuel;
    document.getElementById('tauxAcreActif').value = defaultSettings.acreActif;
    document.getElementById('tauxAcreInactif').value = defaultSettings.acreInactif;
    
    updateCFEMensuel();
}

function updateCFEMensuel() {
    const cfeAnnuel = parseFloat(document.getElementById('cfeAnnuel').value) || 600;
    const cfeMensuel = cfeAnnuel / 12;
    document.getElementById('cfeMensuel').textContent = cfeMensuel.toFixed(2);
}

// Settings event listeners
if (document.getElementById('saveSettings')) {
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('resetSettings').addEventListener('click', resetSettings);
    document.getElementById('cfeAnnuel').addEventListener('input', updateCFEMensuel);
}

// Company settings event listeners
if (document.getElementById('logoUrl')) {
    document.getElementById('logoUrl').addEventListener('input', () => {
        companyInfo.logoUrl = document.getElementById('logoUrl').value || '';
    });
    document.getElementById('companyLegalSiret').addEventListener('input', () => {
        companyInfo.siret = document.getElementById('companyLegalSiret').value || '[SIRET à venir]';
    });
    document.getElementById('companyAddress').addEventListener('input', () => {
        companyInfo.address = document.getElementById('companyAddress').value || '[Adresse]';
    });
    document.getElementById('companyPostal').addEventListener('input', () => {
        companyInfo.postalCode = document.getElementById('companyPostal').value || '[Code postal]';
    });
    document.getElementById('companyCity').addEventListener('input', () => {
        companyInfo.city = document.getElementById('companyCity').value || '[Ville]';
    });
}

// CALCULS - Tax Calculator
const caInput = document.getElementById('caInput');
const acreToggle = document.getElementById('acreToggle');
const versementToggle = document.getElementById('versementToggle');

function calculateTaxes() {
    const ca = parseFloat(caInput.value) || 0;
    const acreActive = acreToggle.checked;
    const versementLib = versementToggle.checked;
    
    // Calculate charges using settings
    const chargesRate = acreActive ? (taxSettings.acreActif / 100) : (taxSettings.acreInactif / 100);
    const charges = ca * chargesRate;
    
    // Calculate taxes based on versement libératoire toggle
    let impot = 0;
    let impotLabel = '';
    
    if (versementLib) {
        // Versement libératoire: 2.2% flat rate on CA
        impot = ca * (taxSettings.versementLiberatoire / 100);
        impotLabel = `${impot.toFixed(2)} € (Versement libératoire ${taxSettings.versementLiberatoire}%)`;
    } else {
        // IRPP barème progressif with 34% abattement
        const baseImposable = ca * 0.66; // After 34% abattement
        
        // Apply progressive tax brackets (monthly amounts)
        const tranche1 = 11294 / 12; // 941.17€ at 0%
        const tranche2 = 28797 / 12; // 2399.75€ at 11%
        
        if (baseImposable <= tranche1) {
            impot = 0;
        } else if (baseImposable <= tranche2) {
            impot = (baseImposable - tranche1) * 0.11;
        } else {
            impot = (tranche2 - tranche1) * 0.11 + (baseImposable - tranche2) * 0.30;
        }
        
        impotLabel = `${impot.toFixed(2)} € (IRPP barème progressif)`;
    }
    
    // Calculate CFE monthly
    const cfe = taxSettings.cfeAnnuel / 12;
    const net = ca - charges - impot - cfe;
    
    // Display results
    document.getElementById('calcCA').textContent = ca.toFixed(2) + ' €';
    document.getElementById('calcCharges').textContent = charges.toFixed(2) + ' € (' + (chargesRate * 100).toFixed(1) + '%)';
    document.getElementById('calcImpot').textContent = impotLabel;
    document.getElementById('calcCFE').textContent = cfe.toFixed(2) + ' € (CFE mensuel)';
    document.getElementById('calcNet').textContent = net.toFixed(2) + ' €';
}

if (caInput) {
    caInput.addEventListener('input', calculateTaxes);
}
if (acreToggle) {
    acreToggle.addEventListener('change', calculateTaxes);
}
if (versementToggle) {
    versementToggle.addEventListener('change', calculateTaxes);
}

// Charts
function renderCharts() {
    renderCAChart();
    renderStatusChart();
}

function renderCAChart() {
    const canvas = document.getElementById('caChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 48;
    canvas.height = 300;
    
    // Get last 6 months data
    const months = ['Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthValues = [7, 8, 9, 10, 11, 12];
    const data = [0, 0, 0, 0, 0, 0];
    
    invoices.forEach(inv => {
        const invDate = new Date(inv.date);
        const monthIndex = monthValues.indexOf(invDate.getMonth() + 1);
        if (monthIndex !== -1 && invDate.getFullYear() === 2025) {
            data[monthIndex] += inv.total;
        }
    });
    
    // Draw chart
    const maxValue = Math.max(...data, 1);
    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const barWidth = chartWidth / months.length;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#626C71';
    ctx.font = '12px -apple-system, sans-serif';
    
    // Draw bars
    data.forEach((value, index) => {
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding + index * barWidth + barWidth * 0.2;
        const y = padding + chartHeight - barHeight;
        const width = barWidth * 0.6;
        
        ctx.fillStyle = '#21808D';
        ctx.fillRect(x, y, width, barHeight);
        
        // Labels
        ctx.fillStyle = '#134252';
        ctx.textAlign = 'center';
        ctx.fillText(months[index], x + width / 2, canvas.height - 10);
        
        if (value > 0) {
            ctx.fillText(value.toFixed(0) + '€', x + width / 2, y - 5);
        }
    });
}

function renderStatusChart() {
    const canvas = document.getElementById('statusChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 48;
    canvas.height = 300;
    
    // Count by status
    const statusCounts = {
        'Brouillon': 0,
        'Envoyée': 0,
        'Payée': 0,
        'Retard': 0
    };
    
    invoices.forEach(inv => {
        statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
    });
    
    const colors = {
        'Brouillon': '#626C71',
        'Envoyée': '#3B82F6',
        'Payée': '#21808D',
        'Retard': '#C0152F'
    };
    
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    if (total === 0) return;
    
    // Draw pie chart
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 - 20;
    const radius = Math.min(centerX, centerY) - 40;
    
    let currentAngle = -Math.PI / 2;
    
    Object.keys(statusCounts).forEach((status, index) => {
        const count = statusCounts[status];
        if (count === 0) return;
        
        const sliceAngle = (count / total) * Math.PI * 2;
        
        ctx.fillStyle = colors[status];
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();
        
        currentAngle += sliceAngle;
    });
    
    // Draw legend
    const legendY = canvas.height - 50;
    let legendX = 20;
    
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    
    Object.keys(statusCounts).forEach(status => {
        const count = statusCounts[status];
        
        ctx.fillStyle = colors[status];
        ctx.fillRect(legendX, legendY, 12, 12);
        
        ctx.fillStyle = '#134252';
        ctx.fillText(`${status} (${count})`, legendX + 18, legendY + 10);
        
        legendX += 120;
    });
}

// Toast notification with types
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    let borderColor = 'var(--color-success)';
    let bgColor = 'var(--color-surface)';
    
    if (type === 'error') {
        borderColor = 'var(--color-error)';
    } else if (type === 'info') {
        borderColor = '#3B82F6';
    }
    
    toast.style.cssText = `
        background-color: ${bgColor};
        border: 1px solid var(--color-border);
        border-left: 4px solid ${borderColor};
        padding: var(--space-16);
        border-radius: var(--radius-base);
        box-shadow: var(--shadow-lg);
        max-width: 350px;
        font-size: var(--font-size-base);
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s, transform 0.3s';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Google Sheets Sync Functions
async function syncToGoogleSheets() {
    if (isSyncing) {
        showToast('⏳ Synchronisation déjà en cours...', 'info');
        return;
    }
    
    const button = document.getElementById('syncButton');
    const originalContent = button.innerHTML;
    
    try {
        isSyncing = true;
        button.disabled = true;
        button.innerHTML = '⏳ Synchronisation...';
        button.style.opacity = '0.6';
        
        showToast('⏳ Synchronisation en cours...', 'info');
        
        // Prepare invoice data for sync
        const invoiceData = invoices.map(inv => ({
            number: inv.number,
            client: inv.client,
            date: inv.date,
            dueDate: inv.dueDate,
            total: inv.total,
            status: inv.status,
            montantRecu: inv.montantRecu || 0,
            dateReception: inv.dateReception || ''
        }));
        
        // Use no-cors mode for Apps Script
        await fetch(BACKEND_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'exportInvoices',
                invoices: invoiceData
            })
        });
        
        // no-cors doesn't give response, assume success if no error
        const count = invoiceData.length;
        showToast(`✅ ${count} facture${count > 1 ? 's' : ''} synchronisée${count > 1 ? 's' : ''} avec Google Sheets`, 'success');
        button.innerHTML = '✅ Synchronisé';
        updateLastSyncTime();
        
        setTimeout(() => {
            button.innerHTML = originalContent;
        }, 3000);
    } catch (error) {
        console.error('Sync error:', error);
        showToast('❌ Erreur de synchronisation', 'error');
        button.innerHTML = '❌ Erreur - Réessayer';
        
        setTimeout(() => {
            button.innerHTML = originalContent;
        }, 3000);
    } finally {
        isSyncing = false;
        button.disabled = false;
        button.style.opacity = '1';
    }
}

// Auto-sync disabled - user manually syncs
function autoSync(action = 'modification') {
    // Auto-sync disabled in this version
    // User will manually click sync button when needed
    return;
}

// Update last sync time
function updateLastSyncTime() {
    lastSyncTime = new Date();
    const timeString = lastSyncTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const lastSyncElement = document.getElementById('lastSyncTime');
    if (lastSyncElement) {
        lastSyncElement.textContent = `Dernière sync: ${timeString}`;
    }
}

// Google Calendar Sync
async function syncToGoogleCalendar() {
    if (isSyncing) {
        showToast('⏳ Synchronisation déjà en cours...', 'info');
        return;
    }
    
    try {
        isSyncing = true;
        showToast('📅 Synchronisation Calendar...', 'info');
        
        // Prepare task data for sync
        const taskData = tasks.map(task => ({
            date: task.date,
            startTime: task.startTime,
            duration: task.duration,
            description: task.description,
            type: task.type
        }));
        
        // Use no-cors mode for Apps Script
        await fetch(BACKEND_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'sync_calendar',
                tasks: taskData
            })
        });
        
        // no-cors doesn't give response, assume success if no error
        showToast('✅ Planning synchronisé avec Google Calendar', 'success');
    } catch (error) {
        console.error('Calendar sync error:', error);
        showToast('❌ Erreur de synchronisation Calendar', 'error');
    } finally {
        isSyncing = false;
    }
}

// Send invoice via Gmail with PDF
async function sendInvoiceWithPDF(invoice) {
    try {
        showToast('📧 Préparation de l\'email...', 'info');
        
        // Find client data
        const client = clients.find(c => c.name === invoice.client);
        const clientEmail = (client && client.email_facturation) ? client.email_facturation : '';
        const contactName = (client && client.contact_name) ? client.contact_name : invoice.client;
        
        // Prepare invoice data for email
        const invoiceData = {
            number: invoice.number,
            client: invoice.client,
            contactName: contactName,
            date: invoice.date,
            dueDate: invoice.dueDate,
            total: invoice.total,
            description: invoice.description,
            quantity: invoice.quantity,
            unitPrice: invoice.unitPrice
        };
        
        // Use no-cors mode for Apps Script
        await fetch(BACKEND_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'send_invoice',
                invoice: invoiceData,
                clientEmail: clientEmail
            })
        });
        
        // no-cors doesn't give response, assume success if no error
        showToast('✅ Email envoyé avec facture PDF via Gmail', 'success');
        
        // Update invoice status to "Envoyée"
        invoice.status = 'Envoyée';
        renderInvoiceList();
        applyFilters();
    } catch (error) {
        console.error('Email send error:', error);
        showToast('❌ Erreur d\'envoi', 'error');
    }
}

// Make sync function global
window.syncToGoogleSheets = syncToGoogleSheets;

// Confirmation modal
let confirmCallback = null;

function showConfirmation(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    
    // Update button styling for delete confirmations
    const confirmBtn = document.getElementById('confirmAction');
    if (title.toLowerCase().includes('supprimer')) {
        confirmBtn.textContent = 'Supprimer';
        confirmBtn.style.backgroundColor = 'var(--color-error)';
        confirmBtn.style.color = 'white';
    } else {
        confirmBtn.textContent = 'Confirmer';
        confirmBtn.style.backgroundColor = '';
        confirmBtn.style.color = '';
    }
    
    document.getElementById('confirmModal').classList.add('show');
}

document.getElementById('cancelConfirm').addEventListener('click', () => {
    document.getElementById('confirmModal').classList.remove('show');
    confirmCallback = null;
    
    // Reset button styling
    const confirmBtn = document.getElementById('confirmAction');
    confirmBtn.style.backgroundColor = '';
    confirmBtn.style.color = '';
});

document.getElementById('confirmAction').addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback();
    }
    document.getElementById('confirmModal').classList.remove('show');
    confirmCallback = null;
    
    // Reset button styling
    const confirmBtn = document.getElementById('confirmAction');
    confirmBtn.style.backgroundColor = '';
    confirmBtn.style.color = '';
});

// PDF Download functionality using html2pdf
function downloadInvoicePDF() {
    const clientName = document.getElementById('clientName').value;
    const clientAddress = document.getElementById('clientAddress').value;
    const invoiceNumber = invoiceNumberInput.value;
    const invoiceDate = invoiceDateInput.value;
    const dueDate = dueDateInput.value;
    const description = document.getElementById('serviceDescription').value;
    const quantity = quantityInput.value;
    const unitPrice = unitPriceInput.value;
    const total = calculateTotal();
    
    if (!clientName || !clientAddress || !invoiceDate || !dueDate || !description || !quantity || !unitPrice) {
        alert('Veuillez remplir tous les champs obligatoires avant de télécharger le PDF');
        return;
    }
    
    const tvaEnabled = document.getElementById('tvaToggle').checked;
    const totalHT = total;
    const tva = tvaEnabled ? totalHT * 0.20 : 0;
    const totalTTC = totalHT + tva;
    
    const companyAddressLine = companyInfo.address && companyInfo.postalCode && companyInfo.city 
        ? `${companyInfo.address}, ${companyInfo.postalCode} ${companyInfo.city}`
        : '[À compléter dans Paramètres]';
    
    const logoHTML = companyInfo.logoUrl 
        ? `<img src="${companyInfo.logoUrl}" style="max-width: 150px; max-height: 80px; object-fit: contain; margin-bottom: 10px;">`
        : '';
    
    let tvaSection = '';
    if (tvaEnabled) {
        tvaSection = `
            <div style="text-align: right; margin-top: 20px; font-size: 14px;">
                <div>Total HT: ${totalHT.toFixed(2)} €</div>
                <div>TVA (20%): ${tva.toFixed(2)} €</div>
                <div style="font-weight: bold; font-size: 16px; margin-top: 5px;">Total TTC: ${totalTTC.toFixed(2)} €</div>
            </div>
        `;
    } else {
        tvaSection = `
            <div style="text-align: right; margin-top: 20px; font-size: 14px;">
                <div>Total HT: ${totalHT.toFixed(2)} €</div>
                <div style="font-size: 12px; color: #666;">TVA non applicable (art. 293 B du CGI)</div>
                <div style="font-weight: bold; font-size: 16px; margin-top: 5px;">Total TTC: ${totalHT.toFixed(2)} €</div>
            </div>
        `;
    }
    
    const pdfContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @page { margin: 15mm; size: A4; }
                * { box-sizing: border-box; }
                body { 
                    font-family: 'Arial', 'Helvetica', 'Trebuchet MS', sans-serif; 
                    padding: 0;
                    margin: 0;
                    color: #134252; 
                    font-size: 13px;
                    position: relative;
                    height: 267mm;
                    overflow: hidden;
                }
                .page-container {
                    padding: 0;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    page-break-inside: avoid !important;
                    page-break-after: avoid !important;
                }
                .header { 
                    position: relative; 
                    min-height: 140px;
                    max-height: 140px;
                    margin-bottom: 12px; 
                    page-break-inside: avoid; 
                    flex-shrink: 0;
                }
                .header-left { 
                    position: absolute; 
                    top: 0; 
                    left: 0; 
                    max-width: 50%; 
                    line-height: 1.4;
                }
                .header-right { 
                    position: absolute; 
                    top: 90px; 
                    right: 0; 
                    text-align: right; 
                    max-width: 45%; 
                    line-height: 1.4;
                }
                .company { 
                    font-weight: bold; 
                    font-size: 16px; 
                    color: #21808D; 
                    margin-bottom: 4px; 
                }
                .separator {
                    border: none;
                    border-top: 1px solid #ddd;
                    margin: 10px 0;
                    clear: both;
                    flex-shrink: 0;
                }
                .invoice-details {
                    margin-top: 145px;
                    margin-bottom: 12px;
                    line-height: 1.5;
                    clear: both;
                    flex-shrink: 0;
                }
                .invoice-number { 
                    font-size: 18px; 
                    font-weight: bold; 
                    margin-bottom: 6px;
                    white-space: nowrap;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 12px 0; 
                    page-break-inside: avoid; 
                    flex-shrink: 0;
                }
                th, td { 
                    padding: 6px 10px; 
                    text-align: left; 
                    border-bottom: 1px solid #ddd; 
                }
                th { 
                    background-color: #f5f5f5; 
                    font-weight: bold; 
                    font-size: 11px; 
                }
                td { 
                    font-size: 11px; 
                    height: 25px;
                }
                .totals { 
                    text-align: right; 
                    margin-top: 10px; 
                    padding-top: 10px; 
                    border-top: 2px solid #5E5240; 
                    font-size: 13px; 
                    page-break-inside: avoid; 
                    flex-shrink: 0;
                }
                .legal { 
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    font-size: 7.5px; 
                    color: #666; 
                    line-height: 1.3; 
                    background: #f9f9f9;
                    padding: 6px;
                    border-radius: 3px;
                    page-break-before: avoid !important;
                    page-break-inside: avoid !important;
                }
                .legal p { 
                    margin: 1px 0; 
                }
            </style>
        </head>
        <body>
            <div class="page-container">
                <div class="header">
                    <div class="header-left">
                        ${logoHTML}
                        <div class="company">${companyInfo.name}</div>
                        <div style="font-size: 12px; line-height: 1.5; margin-top: 4px;">${companyAddressLine}</div>
                        <div style="font-size: 12px; margin-top: 4px;">SIRET: ${companyInfo.siret}</div>
                    </div>
                    <div class="header-right">
                        <div style="font-weight: bold; margin-bottom: 4px;">${clientName}</div>
                        <div style="white-space: pre-line; font-size: 12px; line-height: 1.5;">${clientAddress}</div>
                    </div>
                </div>
                
                <div class="invoice-details">
                    <h2 class="invoice-number">FACTURE N° ${invoiceNumber}</h2>
                    <div style="font-size: 13px;">
                        <div>Date: ${formatDateFR(invoiceDate)}</div>
                        <div>Échéance: ${formatDateFR(dueDate)}</div>
                    </div>
                </div>
                
                <hr class="separator">
                
                <table>
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th style="text-align: center;">Quantité</th>
                            <th style="text-align: right;">Prix unitaire</th>
                            <th style="text-align: right;">Total HT</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${description}</td>
                            <td style="text-align: center;">${quantity}</td>
                            <td style="text-align: right;">${parseFloat(unitPrice).toFixed(2)} €</td>
                            <td style="text-align: right;">${total.toFixed(2)} €</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="totals">
                    ${tvaEnabled ? `
                        <div>Total HT: ${totalHT.toFixed(2)} €</div>
                        <div>TVA (20%): ${tva.toFixed(2)} €</div>
                        <div style="font-weight: bold; font-size: 16px; margin-top: 8px;">Total TTC: ${totalTTC.toFixed(2)} €</div>
                    ` : `
                        <div>Total HT: ${totalHT.toFixed(2)} €</div>
                        <div style="font-size: 11px; color: #666;">TVA non applicable (art. 293 B du CGI)</div>
                        <div style="font-weight: bold; font-size: 16px; margin-top: 8px;">Total TTC: ${totalHT.toFixed(2)} €</div>
                    `}
                </div>
            </div>
            
            <div class="legal">
                <p>Dispensé d'immatriculation RCS/RM | TVA non applicable art. 293B CGI | Conditions: Paiement à 30 jours</p>
                <p>Retard: indemnité forfaitaire 40€ + intérêts au taux légal | Escompte: néant</p>
            </div>
        </body>
        </html>
    `;
    
    // Create a temporary iframe to render the PDF with enhanced rendering
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.style.letterRendering = 'optimizeLegibility';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(pdfContent);
    iframeDoc.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
        iframe.contentWindow.print();
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    }, 500);
}

// Download PDF button listener
if (document.getElementById('downloadPDF')) {
    document.getElementById('downloadPDF').addEventListener('click', downloadInvoicePDF);
}

// Initialize app
function initApp() {
    setDefaultDates();
    invoiceNumberInput.value = getNextInvoiceNumber(invoiceDateInput.value);
    calculateTotal();
    renderCalendar();
    renderClientsTable();
    renderInvoiceList();
    populateClientSelects();
    checkOverdueInvoices();
    applyFilters();
    renderCharts();
    calculateTaxes();
    updateCFEMensuel();
    loadCompanySettings();
}

// Start the app
initApp();

async function syncCalendar() {
    const syncBtn = document.getElementById('syncCalendarBtn');
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = '⏳ Synchronisation...';
    }
    
    try {
        console.log('🔄 Début synchronisation Calendar...');
        
        // Récupérer les événements de Google Calendar
        const getResponse = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getCalendarEvents' })
        });
        
        const getResult = await getResponse.json();
        console.log('📥 Événements Google récupérés:', getResult);
        
        if (!getResult.success) {
            throw new Error(getResult.data || 'Erreur récupération événements');
        }
        
        const remoteEvents = getResult.data.events || [];
        console.log('📅 Nombre d\'événements Google:', remoteEvents.length);
        
        // Comparer avec tâches locales
        const localEventsMap = new Map();
        tasks.forEach(task => {
            const key = `${task.date}-${task.startTime}-${task.description}`;
            localEventsMap.set(key, task);
        });
        
        const remoteEventsMap = new Map();
        remoteEvents.forEach(event => {
            const key = `${event.date}-${event.startTime}-${event.description}`;
            remoteEventsMap.set(key, event);
        });
        
        // À créer sur Google
        const toCreate = [];
        tasks.forEach(task => {
            const key = `${task.date}-${task.startTime}-${task.description}`;
            if (!remoteEventsMap.has(key)) {
                toCreate.push(task);
            }
        });
        
        // À créer localement
        const toCreateLocally = [];
        remoteEvents.forEach(event => {
            const key = `${event.date}-${event.startTime}-${event.description}`;
            if (!localEventsMap.has(key)) {
                toCreateLocally.push(event);
            }
        });
        
        console.log('📤 À créer sur Google:', toCreate.length);
        console.log('📥 À créer localement:', toCreateLocally.length);
        
        // Envoyer vers Google
        if (toCreate.length > 0) {
            const syncResponse = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'syncCalendar',
                    toCreate: toCreate,
                    toDelete: []
                })
            });
            
            const syncResult = await syncResponse.json();
            console.log('✅ Sync Google result:', syncResult);
            
            if (!syncResult.success) {
                throw new Error(syncResult.data || 'Erreur synchronisation');
            }
        }
        
        // Ajouter événements Google localement
        toCreateLocally.forEach(event => {
            if (!tasks.find(t => 
                t.date === event.date && 
                t.startTime === event.startTime && 
                t.description === event.description
            )) {
                tasks.push({
                    date: event.date,
                    startTime: event.startTime,
                    duration: event.duration,
                    description: event.description,
                    type: event.type || 'Travail',
                    googleEventId: event.googleEventId
                });
            }
        });
        
        // Sauvegarder et rafraîchir
        saveToLocalStorage();
        if (typeof renderCalendar === 'function') {
            renderCalendar();
        }
        
        alert(`✅ Synchronisation réussie !

📤 ${toCreate.length} événement(s) envoyé(s) vers Google Calendar
📥 ${toCreateLocally.length} événement(s) importé(s) depuis Google Calendar`);
        
    } catch (error) {
        console.error('❌ Erreur synchronisation Calendar:', error);
        alert('❌ Erreur synchronisation : ' + error.message);
    } finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.textContent = '🔄 Synchroniser Calendar';
        }
    }
}


async function exportClientsToGoogleSheets() {
    const exportBtn = document.getElementById('exportClientsBtn');
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.textContent = '⏳ Export en cours...';
    }
    
    try {
        // Calculer les stats par client
        const dataToExport = clients.map(client => {
            const clientInvoices = invoices.filter(inv => inv.client === client.name);
            const totalBilled = clientInvoices.reduce((sum, inv) => sum + inv.total, 0);
            const totalPaid = clientInvoices.reduce((sum, inv) => sum + (inv.montantRecu || 0), 0);
            
            return {
                name: client.name,
                siret: client.siret || '',
                address: client.address || '',
                email_facturation: client.email_facturation || '',
                contact_name: client.contact_name || '',
                totalBilled: totalBilled,
                totalPaid: totalPaid,
                balance: totalBilled - totalPaid
            };
        });
        
        console.log('📤 Export de', dataToExport.length, 'clients...');
        
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'exportClients',
                sheetId: '1r2fxsy94ufRqAGlgan2CCEIwsI6X_B6m0ujXs6tk8WI',
                data: dataToExport
            })
        });
        
        const result = await response.json();
        console.log('📥 Résultat export:', result);
        
        if (result.success) {
            alert(`✅ ${result.data.count} clients exportés vers Google Sheets !`);
            window.open('https://docs.google.com/spreadsheets/d/1r2fxsy94ufRqAGlgan2CCEIwsI6X_B6m0ujXs6tk8WI', '_blank');
        } else {
            throw new Error(result.error || result.data || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('❌ Erreur export clients:', error);
        alert('❌ Erreur : ' + error.message);
    } finally {
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.textContent = '📊 Exporter vers Google Sheets';
        }
    }
}


async function sendInvoiceByEmail(index) {
    const invoice = invoices[index];
    const client = clients.find(c => c.name === invoice.client);

    if (!client || !client.email_facturation) {
        alert('❌ Aucun email de facturation configuré pour ce client');
        return;
    }

    const contactName = client.contact_name || client.name;
    const emailSubject = `Facture ${invoice.number} - MTI CONSULTING`;
    const emailBody = `Bonjour ${contactName},

Veuillez trouver ci-joint la facture n°${invoice.number} d'un montant de ${invoice.total.toFixed(2)} € HT.

Date de facturation : ${formatDate(invoice.date)}
Date d'échéance : ${formatDate(invoice.dueDate)}

Conditions de paiement : 30 jours nets

Cordialement,
Mickaël TOURDOT-IGUEDJETAL
MTI CONSULTING
mticonsulting59@gmail.com
07 77 37 17 39`;

    const confirmSend = confirm(`📧 Gmail va s'ouvrir avec:\n\nÀ : ${client.email_facturation}\n\nAttacher le PDF manuellement.\n\nContinuer ?`);
    if (!confirmSend) return;

    try {
        await viewInvoice(index);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const mailtoUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(client.email_facturation)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        window.open(mailtoUrl, '_blank');
        alert('✅ Gmail ouvert ! Attachez le PDF téléchargé.');
    } catch (error) {
        alert('❌ Erreur : ' + error.message);
    }
}
