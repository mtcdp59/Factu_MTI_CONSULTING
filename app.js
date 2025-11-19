// In-memory data storage
let clients = [
    {
        name: 'Entreprise ABC',
        siret: '123 456 789 00012',
        address: '123 Rue de la République\n75001 Paris',
        email_facturation: 'facturation@entreprise-abc.fr',
        contact_name: 'Marie Dupont'
    },
    {
        name: 'Société XYZ',
        siret: '987 654 321 00034',
        address: '456 Avenue des Champs\n69002 Lyon',
        email_facturation: '',
        contact_name: ''
    }
];

let invoices = [
    {
        number: '001',
        client: 'Entreprise ABC',
        clientSiret: '123 456 789 00012',
        clientAddress: '123 Rue de la République\n75001 Paris',
        date: '2025-11-15',
        dueDate: '2025-12-15',
        description: 'Prestation de conseil en développement',
        quantity: 12,
        unitPrice: 600,
        total: 7200,
        status: 'Payée',
        montantRecu: 7200,
        dateReception: '2025-12-10'
    },
    {
        number: '002',
        client: 'Société XYZ',
        clientSiret: '987 654 321 00034',
        clientAddress: '456 Avenue des Champs\n69002 Lyon',
        date: '2025-12-01',
        dueDate: '2025-12-31',
        description: 'Développement application web',
        quantity: 12,
        unitPrice: 600,
        total: 7200,
        status: 'Envoyée',
        montantRecu: 0,
        dateReception: null
    },
    {
        number: '003',
        client: 'Entreprise ABC',
        clientSiret: '123 456 789 00012',
        clientAddress: '123 Rue de la République\n75001 Paris',
        date: '2025-10-15',
        dueDate: '2025-11-14',
        description: 'Conseil stratégique',
        quantity: 10,
        unitPrice: 600,
        total: 6000,
        status: 'Retard',
        montantRecu: 0,
        dateReception: null
    },
    {
        number: '004',
        client: 'Société XYZ',
        clientSiret: '987 654 321 00034',
        clientAddress: '456 Avenue des Champs\n69002 Lyon',
        date: '2025-12-15',
        dueDate: '2026-01-14',
        description: 'Audit technique',
        quantity: 12,
        unitPrice: 600,
        total: 7200,
        status: 'Brouillon',
        montantRecu: 0,
        dateReception: null
    }
];

let tasks = [
    { date: '2025-12-16', startTime: '09:00', duration: 3, description: 'Développement module facturation', type: 'Travail' },
    { date: '2025-12-16', startTime: '14:00', duration: 2, description: 'Réunion client Entreprise ABC', type: 'Réunion client' },
    { date: '2025-12-17', startTime: '10:00', duration: 1.5, description: 'Déclaration URSSAF', type: 'Administratif' },
    { date: '2025-12-18', startTime: '09:30', duration: 4, description: 'Consulting SI Finance', type: 'Travail' },
    { date: '2025-12-19', startTime: '15:00', duration: 1, description: 'Suivi projet Société XYZ', type: 'Réunion client' }
];

// Calendar state
let currentView = 'week';
let currentDate = new Date();

// Company info
const company = {
    name: 'MTI CONSULTING',
    address: '[Votre adresse]\n[Code postal] [Ville]',
    siret: '[Votre SIRET]',
    email: '[Votre email]',
    phone: '[Votre téléphone]'
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

// Initialize invoice number
function getNextInvoiceNumber() {
    if (invoices.length === 0) return '001';
    const lastNumber = Math.max(...invoices.map(inv => parseInt(inv.number)));
    return String(lastNumber + 1).padStart(3, '0');
}

// Set default dates
function setDefaultDates() {
    const today = new Date();
    const defaultDue = new Date(today);
    defaultDue.setDate(defaultDue.getDate() + 30);
    
    invoiceDateInput.value = today.toISOString().split('T')[0];
    dueDateInput.value = defaultDue.toISOString().split('T')[0];
}

// Auto-update due date when invoice date changes
invoiceDateInput.addEventListener('change', () => {
    const invoiceDate = new Date(invoiceDateInput.value);
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);
    dueDateInput.value = dueDate.toISOString().split('T')[0];
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
    
    const previewHTML = `
        <div class="invoice-header">
            <div>
                <div class="invoice-company">${company.name}</div>
                <div>${company.address}</div>
                <div>SIRET: ${company.siret}</div>
            </div>
            <div>
                <h2>FACTURE N° ${invoiceNumber}</h2>
                <div>Date: ${formatDateFR(invoiceDate)}</div>
                <div>Échéance: ${formatDateFR(dueDate)}</div>
            </div>
        </div>
        
        <div class="invoice-details">
            <h3>Client</h3>
            <div><strong>${clientName}</strong></div>
            <div style="white-space: pre-line;">${clientAddress}</div>
        </div>
        
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
            <p><strong>Mentions légales obligatoires - Micro-entreprise:</strong></p>
            <p><strong>${company.name}</strong><br>
            ${company.address}<br>
            SIRET: ${company.siret}</p>
            <p>• <strong>Dispensé d'immatriculation au RCS/RM - Micro-entrepreneur</strong></p>
            ${!tvaEnabled ? '<p>• <strong>TVA non applicable, art. 293 B du CGI</strong></p>' : ''}
            <p>• En cas de retard de paiement: intérêts de retard au taux légal + indemnité forfaitaire de 40€</p>
            <p>• <strong>Conditions de règlement: paiement à 30 jours - Date d'échéance: ${formatDateFR(dueDate)}</strong></p>
            <p>• Bénéficiaire de l'ACRE - Taux réduit de cotisations sociales</p>
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
MTI CONSULTING
Email : mticonsulting59@gmail.com`;
    
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
MTI CONSULTING
Email : mticonsulting59@gmail.com`;
    
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
    
    const invoice = {
        number: invoiceNumberInput.value,
        client: document.getElementById('clientName').value,
        clientSiret: document.getElementById('clientSiret').value,
        clientAddress: document.getElementById('clientAddress').value,
        date: invoiceDateInput.value,
        dueDate: dueDateInput.value,
        description: document.getElementById('serviceDescription').value,
        quantity: parseFloat(quantityInput.value),
        unitPrice: parseFloat(unitPriceInput.value),
        total: calculateTotal(),
        status: 'Brouillon',
        montantRecu: 0,
        dateReception: null
    };
    
    invoices.push(invoice);
    showToast('Facture enregistrée avec succès!');
    renderInvoiceList();
    
    // Show send email button and new invoice button
    document.getElementById('sendEmailBtn').style.display = 'inline-flex';
    document.getElementById('newInvoiceBtn').style.display = 'inline-flex';
    
    // Add prompt after save
    setTimeout(() => {
        if (confirm('Facture enregistrée ! Voulez-vous envoyer l\'email maintenant ?')) {
            document.getElementById('sendEmailBtn').click();
        }
    }, 100);
});

// Add a reset button handler
function resetInvoiceForm() {
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
    
    invoices.forEach((invoice, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${invoice.number}</strong></td>
            <td>${invoice.client}</td>
            <td>${formatDateFR(invoice.date)}</td>
            <td><strong>${invoice.total.toFixed(2)} €</strong></td>
            <td><span class="status-badge status-${invoice.status.toLowerCase().replace('ée', 'ee').replace('é', 'e')}">${invoice.status}</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editInvoice(${index})">✏️ Modifier</button>
                <button class="btn btn-sm btn-primary" onclick="sendInvoiceEmail(${index})" style="margin-left: var(--space-4);">📧 Email</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteInvoice(${index})" style="margin-left: var(--space-4);">🗑️ Supprimer</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Edit invoice
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
});

// Delete invoice
function deleteInvoice(index) {
    const invoice = invoices[index];
    showConfirmation(
        'Supprimer la facture',
        `Êtes-vous sûr de vouloir supprimer la facture #${invoice.number} ?`,
        () => {
            invoices.splice(index, 1);
            renderInvoiceList();
            applyFilters();
            renderCharts();
            showToast('Facture supprimée');
        }
    );
}

window.deleteInvoice = deleteInvoice;

// Duplicate invoice
function duplicateInvoice(index) {
    const invoice = invoices[index];
    const newInvoice = {
        ...invoice,
        number: getNextInvoiceNumber(),
        date: new Date().toISOString().split('T')[0],
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
}

function updateDateReception(index, value) {
    invoices[index].dateReception = value;
    applyFilters();
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
    
    currentInvoiceData = {
        clientName: invoice.client,
        invoiceNumber: invoice.number,
        invoiceDate: invoice.date,
        dueDate: invoice.dueDate,
        total: invoice.total,
        client: client
    };
    
    showEmailPreview();
    
    // Auto-update status to Envoyée if currently Brouillon
    if (invoice.status === 'Brouillon') {
        invoice.status = 'Envoyée';
        applyFilters();
    }
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
function saveSettings() {
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
    
    // Calculate taxes - always using versement libératoire
    const impot = ca * (taxSettings.versementLiberatoire / 100);
    
    // Calculate CFE monthly
    const cfe = taxSettings.cfeAnnuel / 12;
    const net = ca - charges - impot - cfe;
    
    // Display results
    document.getElementById('calcCA').textContent = ca.toFixed(2) + ' €';
    document.getElementById('calcCharges').textContent = charges.toFixed(2) + ' € (' + (chargesRate * 100).toFixed(1) + '%)';
    document.getElementById('calcImpot').textContent = impot.toFixed(2) + ' € (Versement lib. ' + taxSettings.versementLiberatoire.toFixed(1) + '%)';
    document.getElementById('calcCFE').textContent = cfe.toFixed(2) + ' € (CFE mensuel)';
    document.getElementById('calcNet').textContent = net.toFixed(2) + ' €';
}

if (caInput) caInput.addEventListener('input', calculateTaxes);
if (acreToggle) acreToggle.addEventListener('change', calculateTaxes);
if (versementToggle) versementToggle.addEventListener('change', calculateTaxes);

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

// Toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: var(--color-surface);
        border: 1px solid var(--color-border);
        border-left: 4px solid var(--color-success);
        padding: var(--space-16);
        border-radius: var(--radius-base);
        box-shadow: var(--shadow-lg);
        z-index: 10000;
        max-width: 300px;
        font-size: var(--font-size-base);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Confirmation modal
let confirmCallback = null;

function showConfirmation(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    document.getElementById('confirmModal').classList.add('show');
}

document.getElementById('cancelConfirm').addEventListener('click', () => {
    document.getElementById('confirmModal').classList.remove('show');
    confirmCallback = null;
});

document.getElementById('confirmAction').addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback();
    }
    document.getElementById('confirmModal').classList.remove('show');
    confirmCallback = null;
});

// Initialize app
function initApp() {
    invoiceNumberInput.value = getNextInvoiceNumber();
    setDefaultDates();
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
}

// Start the app
initApp();