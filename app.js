// In-memory data storage
let clients = [
    {
        name: 'Entreprise ABC',
        siret: '123 456 789 00012',
        address: '123 Rue de la République\n75001 Paris'
    },
    {
        name: 'Société XYZ',
        siret: '987 654 321 00034',
        address: '456 Avenue des Champs\n69002 Lyon'
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
    { day: 0, time: '09:00', duration: 4, type: 'work', description: 'Développement client ABC' },
    { day: 0, time: '14:00', duration: 2, type: 'meeting', description: 'Rendez-vous client XYZ' },
    { day: 2, time: '09:00', duration: 5, type: 'work', description: 'Développement application' },
    { day: 3, time: '10:00', duration: 3, type: 'work', description: 'Réunion et suivi projet' },
    { day: 4, time: '14:00', duration: 2, type: 'admin', description: 'Comptabilité et factures' }
];

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
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${client.name}</strong></td>
            <td>${client.siret || '-'}</td>
            <td style="white-space: pre-line; max-width: 200px;">${client.address || '-'}</td>
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
        address: document.getElementById('clientFormAddress').value
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
    document.getElementById('clientFormCard').style.display = 'block';
}

function deleteClient(index) {
    if (confirm('Voulez-vous vraiment supprimer ce client ?')) {
        clients.splice(index, 1);
        renderClientsTable();
        populateClientSelects();
    }
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
    alert('Facture enregistrée avec succès!');
    
    // Reset form
    invoiceForm.reset();
    document.getElementById('clientSelect').value = '';
    document.getElementById('clientName').readOnly = false;
    document.getElementById('clientSiret').readOnly = false;
    document.getElementById('clientAddress').readOnly = false;
    invoiceNumberInput.value = getNextInvoiceNumber();
    setDefaultDates();
    calculateTotal();
});

// PLANNING - Calendar (Monday to Friday only)
const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

function renderCalendar() {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    
    daysOfWeek.forEach((day, index) => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        dayDiv.appendChild(dayHeader);
        
        const dayTasks = tasks.filter(task => task.day === index);
        dayTasks.forEach(task => {
            const taskDiv = document.createElement('div');
            taskDiv.className = `calendar-task type-${task.type}`;
            taskDiv.innerHTML = `
                <div class="task-time">${task.time} (${task.duration}h)</div>
                <div class="task-description">${task.description}</div>
            `;
            dayDiv.appendChild(taskDiv);
        });
        
        calendar.appendChild(dayDiv);
    });
    
    updateWeeklyStats();
}

function updateWeeklyStats() {
    const totalHours = tasks.reduce((sum, task) => sum + task.duration, 0);
    const workHours = tasks.filter(t => t.type === 'work').reduce((sum, task) => sum + task.duration, 0);
    const meetingHours = tasks.filter(t => t.type === 'meeting').reduce((sum, task) => sum + task.duration, 0);
    const adminHours = tasks.filter(t => t.type === 'admin').reduce((sum, task) => sum + task.duration, 0);
    
    document.getElementById('weeklyStats').innerHTML = `
        <strong>Total hebdomadaire: ${totalHours}h</strong> 
        (Travail: ${workHours}h | Rendez-vous: ${meetingHours}h | Admin: ${adminHours}h)
    `;
}

// Task form
document.getElementById('addTaskBtn').addEventListener('click', () => {
    document.getElementById('taskFormCard').style.display = 'block';
});

document.getElementById('cancelTask').addEventListener('click', () => {
    document.getElementById('taskFormCard').style.display = 'none';
    document.getElementById('taskForm').reset();
});

document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const task = {
        day: parseInt(document.getElementById('taskDay').value),
        time: document.getElementById('taskTime').value,
        duration: parseFloat(document.getElementById('taskDuration').value),
        type: document.getElementById('taskType').value,
        description: document.getElementById('taskDescription').value
    };
    
    tasks.push(task);
    renderCalendar();
    document.getElementById('taskFormCard').style.display = 'none';
    document.getElementById('taskForm').reset();
});

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
        `;
        tbody.appendChild(row);
    });
}

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

// Initialize app
function initApp() {
    invoiceNumberInput.value = getNextInvoiceNumber();
    setDefaultDates();
    calculateTotal();
    renderCalendar();
    renderClientsTable();
    populateClientSelects();
    checkOverdueInvoices();
    applyFilters();
    renderCharts();
    calculateTaxes();
    updateCFEMensuel();
}

// Start the app
initApp();