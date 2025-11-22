// MTI CONSULTING - Application de facturation
// Version v2.0 - Google Drive Storage + Gmail API + Calendar API

const CONFIG = {
    BACKEND_URL: 'https://script.google.com/macros/s/AKfycbyUp4uaDfbrZpziEXI3SRBYm8M_cF32mU17Ji_L3qYnxaQGl-K6KZ19-33yHkCCMD92/exec',
    DRIVE_FILE_NAME: 'mti_data.json',
    SHEETS_ID: '1Zu6I-c64YrBdlfvWhiVnlbwbvhv6Mw5NL8iRn2mvXoE',
    CALENDAR_ID: 'primary'
};

// Helper to call the Apps Script backend with better error handling and CORS guidance
async function callBackend(action, payload = {}) {
    try {
        const body = JSON.stringify(Object.assign({ action }, payload));
        console.debug('Calling backend:', CONFIG.BACKEND_URL, body);

        // Avoid setting 'application/json' Content-Type to prevent CORS preflight.
        // Sending a plain text body (JSON string) will keep Content-Type as a simple type
        // (text/plain;charset=UTF-8) and avoid the OPTIONS preflight on most browsers.
        const resp = await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            body
        });

        // If the response is opaque due to CORS misconfiguration, resp.ok will be false or fetch may throw
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            const errMsg = `Backend returned status ${resp.status}. ${text}`;
            console.error('Backend error:', errMsg);
            // Show raw backend response to help debugging
            showBackendRawResponse(`HTTP ${resp.status}\n\n${text}`);
            throw new Error(errMsg);
        }

        // Try to parse JSON, fall back to text
        const txt = await resp.text();
        try {
            return JSON.parse(txt);
        } catch (e) {
            return { success: true, data: txt };
        }
    } catch (err) {
        console.error('callBackend error (possible CORS or network issue):', err);
        // Show error details in backend tester modal for faster diagnosis
        try { showBackendRawResponse(String(err.stack || err.message || err)); } catch (e) {}
        // Provide actionable error for the user/developer
        throw new Error('Impossible de contacter le BACKEND. Vérifiez que le script Apps Script est déployé et qu\'il autorise les requêtes CORS (Access-Control-Allow-Origin). Détails: ' + (err.message || err));
    }
}

// Open Gmail compose in a new tab and provide the generated PDF for review/download
async function openGmailComposeWithPDF(invoice, toEmail) {
    if (!invoice) throw new Error('Invoice missing');
    const client = clients.find(c => c.name === invoice.client) || {};
    const subject = `Facture ${invoice.number} - MTI CONSULTING`;
    const body = generateEmailBody(invoice, client || { name: invoice.client });

    // Generate PDF base64 and open
    const pdfBase64 = await generateInvoicePDFBase64(invoice);
    const blob = base64ToBlob(pdfBase64, 'application/pdf');
    const blobUrl = URL.createObjectURL(blob);

    // Open PDF in new tab for review
    window.open(blobUrl, '_blank');

    // Trigger download to make attaching easier
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `Facture_${invoice.number}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { document.body.removeChild(a); } catch(e){} }, 1000);

    // Open Gmail compose (prefilled). Note: attachments cannot be auto-attached.
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail || '')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');

    return true;
}

// JSONP fallback for simple GET-based actions to avoid CORS preflight when running from file://
function callBackendJSONP(action, params = {}) {
    return new Promise((resolve, reject) => {
        try {
            const cbName = '__mti_cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
            window[cbName] = function(res) {
                try { delete window[cbName]; } catch (e) {}
                if (script && script.parentNode) script.parentNode.removeChild(script);
                resolve(res);
            };

            const query = new URLSearchParams(Object.assign({}, params, { action }));
            const src = CONFIG.BACKEND_URL + '?' + query.toString() + '&callback=' + cbName;
            const script = document.createElement('script');
            script.src = src;
            script.onerror = function(err) {
                try { delete window[cbName]; } catch (e) {}
                if (script && script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('JSONP load error'));
            };
            document.head.appendChild(script);
        } catch (err) {
            reject(err);
        }
    });
}

// Quick backend tester (uses GET to call doGet and shows raw response in a modal)
async function testBackend() {
    const modal = document.getElementById('backendModal');
    const pre = document.getElementById('backendRawResponse');
    if (pre) pre.textContent = '⏳ Test en cours...';
    try {
        const resp = await fetch(CONFIG.BACKEND_URL, { method: 'GET' });
        const text = await resp.text();
        if (pre) pre.textContent = text;
        if (modal) modal.classList.add('show');
    } catch (err) {
        const msg = 'Erreur lors du test BACKEND: ' + (err.message || err);
        console.error(msg, err);
        if (pre) pre.textContent = msg + '\n\nVérifiez que `CONFIG.BACKEND_URL` est correct et que le Web App Apps Script est déployé.';
        if (modal) modal.classList.add('show');
    }
}

// Affiche la réponse brute du backend dans la modal de test (utile pour diagnostiquer)
function showBackendRawResponse(text) {
    try {
        const modal = document.getElementById('backendModal');
        const pre = document.getElementById('backendRawResponse');
        if (pre) pre.textContent = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
        if (modal) modal.classList.add('show');
    } catch (e) {
        console.error('Impossible d\'afficher la réponse brute du backend:', e);
    }
}

// Modal handlers for backend tester
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'closeBackendModal') {
        document.getElementById('backendModal')?.classList.remove('show');
    }
    if (e.target && e.target.id === 'copyBackendResponse') {
        const pre = document.getElementById('backendRawResponse');
        if (pre) {
            navigator.clipboard?.writeText(pre.textContent || '')
                .then(() => showToast('✅ Réponse copiée dans le presse-papiers'))
                .catch(() => showToast('⚠️ Impossible de copier', 'error'));
        }
    }
});

let isEditMode = false;
let editingInvoiceIndex = -1;

// ==========================================
// GOOGLE DRIVE STORAGE
// ==========================================

// Sauvegarder toutes les données dans Google Drive
async function saveToDrive() {
    try {
        const data = { clients, invoices, tasks, companyInfo, taxSettings };
        const result = await callBackend('saveToDrive', { data });
        if (!result || !result.success) throw new Error(result && result.error ? result.error : 'Unknown error');
        console.log('✅ Sauvegarde Drive OK');
        return true;
    } catch (error) {
        console.error('❌ Erreur sauvegarde:', error);
        try { showBackendRawResponse(error && (error.stack || error.message || JSON.stringify(error))); } catch (e) {}
        return false;
    }
}

// Charger toutes les données depuis Google Drive
async function loadFromDrive() {
    try {
        const result = await callBackend('loadFromDrive');
        if (!result.success) {
            console.log('Pas de données Drive, utilisation données par défaut');
            return false;
        }

        const data = result.data;
        if (data.clients) clients = data.clients;
        if (data.invoices) invoices = data.invoices;
        if (data.tasks) tasks = data.tasks;
        if (data.companyInfo) companyInfo = data.companyInfo;
        if (data.taxSettings) taxSettings = data.taxSettings;


    
        console.log('✅ Données chargées depuis Drive');

        // Rafraîchir vues si fonctions définies
        if (typeof renderClientsTable === 'function') renderClientsTable();
        if (typeof populateClientSelects === 'function') populateClientSelects();
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
        if (typeof renderInvoiceList === 'function') renderInvoiceList();

        return true;
    } catch (error) {
        console.error('❌ Erreur chargement:', error);
        try { showBackendRawResponse(error && (error.stack || error.message || JSON.stringify(error))); } catch (e) {}
        return false;
    }
}

const SYNC_TIMEOUT = 15000;
let isSyncing = false;
let lastSyncTime = null;

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
        number: '202511-001',
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
        number: '202512-001',
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
        number: '202510-001',
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
        number: '202512-002',
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

// Company info - now editable via settings
let companyInfo = {
    name: 'MTI CONSULTING',
    logoUrl: '',
    siret: '[SIRET à venir]',
    address: '[Adresse]',
    postalCode: '[Code postal]',
    city: '[Ville]',
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

// DOM Elements (lazy initialization)
let navTabs = null;
let tabContents = null;
let invoiceForm = null;
let invoiceNumberInput = null;
let invoiceDateInput = null;
let dueDateInput = null;
let quantityInput = null;
let unitPriceInput = null;
let totalHTInput = null;

// Navigation - set up after DOM ready
function setupNavigation() {
    navTabs = document.querySelectorAll('.nav-tab');
    tabContents = document.querySelectorAll('.tab-content');

    if (!navTabs) return;

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            navTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetEl = document.getElementById(targetTab);
            if (targetEl) targetEl.classList.add('active');

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
}

// TIERS - Client Management
function renderClientsTable() {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    clients.forEach((client, index) => {
        const clientInvoices = invoices.filter(inv => inv.client === client.name);
        const totalBilled = clientInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
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

// Setup bindings for elements that used inline onclick in HTML
function setupLegacyBindings() {
    // Simple button mappings
    document.getElementById('cancelEditBtn')?.addEventListener('click', cancelEditMode);
    document.getElementById('newInvoiceBtn')?.addEventListener('click', resetInvoiceForm);

    // Import / Export clients
    const importBtn = document.getElementById('importClientsBtn');
    if (importBtn) importBtn.addEventListener('click', () => { if (typeof importClientsFromSheets === 'function') importClientsFromSheets(); });
    const exportBtn = document.getElementById('exportClientsBtn');
    if (exportBtn) exportBtn.addEventListener('click', () => { if (typeof exportClientsToSheets === 'function') exportClientsToSheets(); });

    // Calendar view buttons
    document.getElementById('viewDay')?.addEventListener('click', () => changeCalendarView('day'));
    document.getElementById('viewWeek')?.addEventListener('click', () => changeCalendarView('week'));
    document.getElementById('viewMonth')?.addEventListener('click', () => changeCalendarView('month'));

    // Sync calendar
    const syncCalendarBtn = document.getElementById('syncCalendarBtn');
    if (syncCalendarBtn) syncCalendarBtn.addEventListener('click', () => { if (typeof syncToGoogleCalendar === 'function') syncToGoogleCalendar(); });

    // Calendar navigation
    document.getElementById('navPrevBtn')?.addEventListener('click', () => navigateCalendar(-1));
    document.getElementById('navTodayBtn')?.addEventListener('click', () => navigateCalendar(0));
    document.getElementById('navNextBtn')?.addEventListener('click', () => navigateCalendar(1));

    // Sync sheet button
    document.getElementById('syncButton')?.addEventListener('click', () => { if (typeof syncToGoogleSheets === 'function') syncToGoogleSheets(); });

    // Delete task button inside edit modal (search by emoji fallback)
    const deleteButtons = Array.from(document.querySelectorAll('#editTaskModal button'));
    const deleteBtn = deleteButtons.find(b => b.textContent && b.textContent.includes('🗑️'));
    if (deleteBtn) deleteBtn.addEventListener('click', deleteTaskFromEdit);
}

function populateClientSelects() {
    const clientSelect = document.getElementById('clientSelect');
    const clientFilterSelect = document.getElementById('clientFilterSelect');

    if (clientSelect) {
        clientSelect.innerHTML = '<option value="">Saisie manuelle</option>';
        clients.forEach((client, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = client.name;
            clientSelect.appendChild(option);
        });
    }

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

// Client select change
function setupClientSelectListener() {
    const clientSelect = document.getElementById('clientSelect');
    if (!clientSelect) return;

    clientSelect.addEventListener('change', (e) => {
        const index = e.target.value;
        if (index === '') {
            // Manual entry
            const nameEl = document.getElementById('clientName');
            const siretEl = document.getElementById('clientSiret');
            const addressEl = document.getElementById('clientAddress');
            if (nameEl) nameEl.value = '';
            if (siretEl) siretEl.value = '';
            if (addressEl) addressEl.value = '';
            if (nameEl) nameEl.readOnly = false;
            if (siretEl) siretEl.readOnly = false;
            if (addressEl) addressEl.readOnly = false;
            // Hide email button for manual entry
            const sendEmailBtn = document.getElementById('sendEmailBtn');
            if (sendEmailBtn) sendEmailBtn.style.display = 'none';
        } else {
            // Auto-fill from client
            const client = clients[parseInt(index)];
            const nameEl = document.getElementById('clientName');
            const siretEl = document.getElementById('clientSiret');
            const addressEl = document.getElementById('clientAddress');
            if (nameEl) nameEl.value = client.name;
            if (siretEl) siretEl.value = client.siret || '';
            if (addressEl) addressEl.value = client.address || '';
            if (nameEl) nameEl.readOnly = true;
            if (siretEl) siretEl.readOnly = true;
            if (addressEl) addressEl.readOnly = true;

            // Show send email button if email exists
            const sendEmailBtn = document.getElementById('sendEmailBtn');
            if (sendEmailBtn) {
                const hasEmail = client.email_facturation && client.email_facturation.trim() !== '';
                sendEmailBtn.style.display = hasEmail ? 'inline-flex' : 'none';
            }
        }
    });
}

// Client Form handlers
function setupClientFormHandlers() {
    const addClientBtn = document.getElementById('addClientBtn');
    if (addClientBtn) {
        addClientBtn.addEventListener('click', () => {
            const card = document.getElementById('clientFormCard');
            if (card) card.style.display = 'block';
            const title = document.getElementById('clientFormTitle');
            if (title) title.textContent = 'Nouveau client';
            const editIdx = document.getElementById('editClientIndex');
            if (editIdx) editIdx.value = '-1';
            const form = document.getElementById('clientForm');
            if (form) form.reset();
        });
    }
    
        // Backwards-compatible helper for inline onclick in `index.html`
        function openClientModal() {
            const card = document.getElementById('clientFormCard');
            if (card) card.style.display = 'block';
            const title = document.getElementById('clientFormTitle');
            if (title) title.textContent = 'Nouveau client';
            const editIndex = document.getElementById('editClientIndex');
            if (editIndex) editIndex.value = '-1';
            const form = document.getElementById('clientForm');
            if (form) form.reset();
        }
        window.openClientModal = openClientModal;

    const cancelClient = document.getElementById('cancelClient');
    if (cancelClient) {
        cancelClient.addEventListener('click', () => {
            const card = document.getElementById('clientFormCard');
            if (card) card.style.display = 'none';
            const form = document.getElementById('clientForm');
            if (form) form.reset();
        });
    }

    const clientFormEl = document.getElementById('clientForm');
    if (clientFormEl) {
        clientFormEl.addEventListener('submit', (e) => {
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

            const card = document.getElementById('clientFormCard');
            if (card) card.style.display = 'none';
            clientFormEl.reset();
            renderClientsTable();
            populateClientSelects();
            showToast('✅ Client enregistré');
            saveToDrive(); // persist changes
        });
    }
}

function editClient(index) {
    const client = clients[index];
    const title = document.getElementById('clientFormTitle');
    if (title) title.textContent = 'Modifier le client';
    const editIdx = document.getElementById('editClientIndex');
    if (editIdx) editIdx.value = index;
    const nameEl = document.getElementById('clientFormName');
    const siretEl = document.getElementById('clientFormSiret');
    const addressEl = document.getElementById('clientFormAddress');
    const emailEl = document.getElementById('clientFormEmail');
    const contactEl = document.getElementById('clientFormContactName');
    if (nameEl) nameEl.value = client.name;
    if (siretEl) siretEl.value = client.siret || '';
    if (addressEl) addressEl.value = client.address || '';
    if (emailEl) emailEl.value = client.email_facturation || '';
    if (contactEl) contactEl.value = client.contact_name || '';
    const card = document.getElementById('clientFormCard');
    if (card) card.style.display = 'block';
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
            // Remove invoices for this client
            const removedInvoicesCount = invoices.filter(inv => inv.client === client.name).length;
            if (removedInvoicesCount > 0) {
                invoices = invoices.filter(inv => inv.client !== client.name);
            }

            // Persist changes to Drive (non-blocking) and report if invoice(s) removed
            saveToDrive()
                .then(() => {
                    if (removedInvoicesCount > 0) {
                        showToast(`${removedInvoicesCount} facture(s) associée(s) supprimée(s)`);
                    }
                })
                .catch(err => {
                    console.error('Erreur sauvegarde après suppression client', err);
                    showToast('⚠️ Erreur sauvegarde Drive', 'error');
                });

            renderClientsTable();
            populateClientSelects();
            showToast('Client supprimé');
        }
    );
}

window.editClient = editClient;
window.deleteClient = deleteClient;

// FACTURES - Invoice Generator
// lazy elements will be initialized in initApp

// Initialize invoice number with new format YYYYMM-NNN
function getNextInvoiceNumber(date = null) {
    const invoiceDate = date ? new Date(date) : new Date();
    const year = invoiceDate.getFullYear();
    const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}${month}`;

    // Find all invoices for this year-month
    const sameMonthInvoices = invoices.filter(inv => {
        const invNumber = inv.number || '';
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
        const parts = (inv.number || '').split('-');
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

    if (invoiceDateInput) invoiceDateInput.value = today.toISOString().split('T')[0];
    if (dueDateInput) dueDateInput.value = defaultDue.toISOString().split('T')[0];
}

// Auto-update due date and invoice number when invoice date changes
function setupInvoiceFormListeners() {
    if (invoiceDateInput) {
        invoiceDateInput.addEventListener('change', () => {
            const invoiceDate = new Date(invoiceDateInput.value);
            const dueDate = new Date(invoiceDate);
            dueDate.setDate(dueDate.getDate() + 30);
            if (dueDateInput) dueDateInput.value = dueDate.toISOString().split('T')[0];

            // Update invoice number based on new date (only if not in edit mode)
            if (!isEditMode && invoiceNumberInput) {
                invoiceNumberInput.value = getNextInvoiceNumber(invoiceDateInput.value);
            }
        });
    }

    if (quantityInput) {
        quantityInput.addEventListener('input', calculateTotal);
    }
    if (unitPriceInput) {
        unitPriceInput.addEventListener('input', calculateTotal);
    }

    const tvaToggle = document.getElementById('tvaToggle');
    if (tvaToggle) {
        tvaToggle.addEventListener('change', () => {
            const tvaEnabled = tvaToggle.checked;
            const tvaFields = document.getElementById('tvaFields');
            const noTvaFields = document.getElementById('noTvaFields');
            if (tvaFields) tvaFields.style.display = tvaEnabled ? 'block' : 'none';
            if (noTvaFields) noTvaFields.style.display = tvaEnabled ? 'none' : 'block';
            calculateTotal();
        });
    }

    const previewBtn = document.getElementById('previewInvoice');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            const clientNameEl = document.getElementById('clientName');
            const clientAddressEl = document.getElementById('clientAddress');
            const serviceDescriptionEl = document.getElementById('serviceDescription');
            if (!clientNameEl || !clientAddressEl || !invoiceNumberInput || !invoiceDateInput || !dueDateInput || !serviceDescriptionEl || !quantityInput || !unitPriceInput) {
                alert('Veuillez remplir tous les champs obligatoires');
                return;
            }

            const clientName = clientNameEl.value;
            const clientAddress = clientAddressEl.value;
            const invoiceNumber = invoiceNumberInput.value;
            const invoiceDate = invoiceDateInput.value;
            const dueDate = dueDateInput.value;
            const description = serviceDescriptionEl.value;
            const quantity = quantityInput.value;
            const unitPrice = unitPriceInput.value;
            const total = calculateTotal();

            if (!clientName || !clientAddress || !invoiceDate || !dueDate || !description || !quantity || !unitPrice) {
                alert('Veuillez remplir tous les champs obligatoires');
                return;
            }

            const tvaEnabled = document.getElementById('tvaToggle') && document.getElementById('tvaToggle').checked;
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

            const previewContent = document.getElementById('invoicePreviewContent');
            if (previewContent) previewContent.innerHTML = previewHTML;
            const modal = document.getElementById('invoiceModal');
            if (modal) modal.classList.add('show');
        });
    }

    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            const modal = document.getElementById('invoiceModal');
            if (modal) modal.classList.remove('show');
        });
    }
}

// Calculate total with optional TVA
function calculateTotal() {
    if (!quantityInput || !unitPriceInput) return 0;
    const quantity = parseFloat(quantityInput.value) || 0;
    const unitPrice = parseFloat(unitPriceInput.value) || 0;
    const totalHT = quantity * unitPrice;

    const tvaEnabled = document.getElementById('tvaToggle') && document.getElementById('tvaToggle').checked;

    if (tvaEnabled) {
        const tva = totalHT * 0.20;
        const totalTTC = totalHT + tva;
        const totalHTEl = document.getElementById('totalHT');
        const totalTVAEl = document.getElementById('totalTVA');
        const totalTTCEl = document.getElementById('totalTTC');
        if (totalHTEl) totalHTEl.value = totalHT.toFixed(2) + ' €';
        if (totalTVAEl) totalTVAEl.value = tva.toFixed(2) + ' €';
        if (totalTTCEl) totalTTCEl.value = totalTTC.toFixed(2) + ' €';
    } else {
        const totalHTOnlyEl = document.getElementById('totalHTOnly');
        if (totalHTOnlyEl) totalHTOnlyEl.value = totalHT.toFixed(2) + ' €';
    }

    return totalHT;
}

// Format date to French format
function formatDateFR(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
}

// Email sending functionality (preview)
let currentInvoiceData = null;

function setupEmailPreviewHandlers() {
    const sendEmailBtn = document.getElementById('sendEmailBtn');
    if (sendEmailBtn) {
        sendEmailBtn.addEventListener('click', () => {
            const clientNameEl = document.getElementById('clientName');
            if (!clientNameEl || !invoiceNumberInput || !invoiceDateInput || !dueDateInput) {
                alert('Veuillez remplir tous les champs obligatoires avant d\'envoyer l\'email');
                return;
            }

            const clientName = clientNameEl.value;
            const invoiceNumber = invoiceNumberInput.value;
            const invoiceDate = invoiceDateInput.value;
            const dueDate = dueDateInput.value;
            const total = calculateTotal();

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
    }

    const closeEmailModal = document.getElementById('closeEmailModal');
    if (closeEmailModal) closeEmailModal.addEventListener('click', () => {
        const modal = document.getElementById('emailModal');
        if (modal) modal.classList.remove('show');
    });

    const cancelEmail = document.getElementById('cancelEmail');
    if (cancelEmail) cancelEmail.addEventListener('click', () => {
        const modal = document.getElementById('emailModal');
        if (modal) modal.classList.remove('show');
    });

    const confirmEmail = document.getElementById('confirmEmail');
    if (confirmEmail) confirmEmail.addEventListener('click', () => {
        if (!currentInvoiceData) return;
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
        const modal = document.getElementById('emailModal');
        if (modal) modal.classList.remove('show');

        // Show confirmation and prompt to reset
        setTimeout(() => {
            alert('Email préparé et ouvert dans votre client de messagerie. N\'oubliez pas de joindre le PDF de la facture avant l\'envoi !');
            if (confirm('Voulez-vous créer une nouvelle facture ?')) {
                resetInvoiceForm();
            }
        }, 500);
    });
}

function showEmailPreview() {
    if (!currentInvoiceData) return;
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
    const emailToEl = document.getElementById('emailTo');
    const emailSubjectEl = document.getElementById('emailSubject');
    const emailBodyEl = document.getElementById('emailBody');
    if (emailToEl) emailToEl.textContent = emailTo || '(À compléter manuellement)';
    if (emailSubjectEl) emailSubjectEl.textContent = subject;
    if (emailBodyEl) emailBodyEl.textContent = body;

    // Show warning if no email
    const warningDiv = document.getElementById('emailWarning');
    if (warningDiv) {
        if (!hasEmail) {
            warningDiv.style.display = 'block';
            warningDiv.innerHTML = '⚠️ <strong>Aucun contact email configuré pour ce client.</strong><br>L\'email s\'ouvrira en brouillon sans destinataire. Veuillez ajouter l\'email dans la gestion des tiers ou compléter manuellement.';
        } else {
            warningDiv.style.display = 'none';
        }
    }

    const modal = document.getElementById('emailModal');
    if (modal) modal.classList.add('show');
}

document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
    cancelEditMode();
});

// Save invoice
function setupInvoiceSaveHandler() {
    if (!invoiceForm) return;
    invoiceForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const invoiceData = {
            number: invoiceNumberInput ? invoiceNumberInput.value : getNextInvoiceNumber(),
            client: document.getElementById('clientName') ? document.getElementById('clientName').value : '',
            clientSiret: document.getElementById('clientSiret') ? document.getElementById('clientSiret').value : '',
            clientAddress: document.getElementById('clientAddress') ? document.getElementById('clientAddress').value : '',
            date: invoiceDateInput ? invoiceDateInput.value : '',
            dueDate: dueDateInput ? dueDateInput.value : '',
            description: document.getElementById('serviceDescription') ? document.getElementById('serviceDescription').value : '',
            quantity: quantityInput ? parseFloat(quantityInput.value) : 0,
            unitPrice: unitPriceInput ? parseFloat(unitPriceInput.value) : 0,
            total: calculateTotal()
        };

        if (isEditMode && editingInvoiceIndex >= 0) {
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
            const sendEmailBtn = document.getElementById('sendEmailBtn');
            const newInvoiceBtn = document.getElementById('newInvoiceBtn');
            if (sendEmailBtn) sendEmailBtn.style.display = 'inline-flex';
            if (newInvoiceBtn) newInvoiceBtn.style.display = 'inline-flex';

            // Prompt after save
            setTimeout(() => {
                if (confirm('Facture enregistrée ! Voulez-vous envoyer l\'email maintenant ?')) {
                                // Open Gmail compose with generated PDF for manual validation and send
                                const clientObj = clients.find(c => c.name === invoice.client);
                                const hasEmail = clientObj && clientObj.email_facturation && clientObj.email_facturation.trim() !== '';

                                if (hasEmail) {
                                    openGmailComposeWithPDF(invoice, clientObj.email_facturation).catch(err => {
                                        console.error('Ouverture Gmail échouée:', err);
                                        showToast('⚠️ Impossible d\'ouvrir Gmail, ouverture de l\'aperçu email.', 'error');
                                        currentInvoiceData = {
                                            clientName: invoice.client,
                                            invoiceNumber: invoice.number,
                                            invoiceDate: invoice.date,
                                            dueDate: invoice.dueDate,
                                            total: invoice.total,
                                            client: clientObj
                                        };
                                        showEmailPreview();
                                    });
                                } else {
                                    currentInvoiceData = {
                                        clientName: invoice.client,
                                        invoiceNumber: invoice.number,
                                        invoiceDate: invoice.date,
                                        dueDate: invoice.dueDate,
                                        total: invoice.total,
                                        client: clientObj || { name: invoice.client }
                                    };
                                    showEmailPreview();
                                }
                }
            }, 100);
        }

        // Refresh invoice list and tracking
        renderInvoiceList();
        applyFilters();
        renderCharts();

        // Persist changes
        saveToDrive();
    });
}

// Add a reset button handler
function resetInvoiceForm() {
    // Exit edit mode if active
    if (isEditMode) {
        isEditMode = false;
        editingInvoiceIndex = -1;
        const indicator = document.getElementById('editModeIndicator');
        if (indicator) indicator.style.display = 'none';
        const submitBtn = document.getElementById('submitInvoiceBtn');
        if (submitBtn) submitBtn.textContent = '💾 Créer facture';
        const cancelBtn = document.getElementById('cancelEditBtn');
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    if (invoiceForm) invoiceForm.reset();
    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) clientSelect.value = '';
    const nameEl = document.getElementById('clientName');
    const siretEl = document.getElementById('clientSiret');
    const addressEl = document.getElementById('clientAddress');
    if (nameEl) nameEl.readOnly = false;
    if (siretEl) siretEl.readOnly = false;
    if (addressEl) addressEl.readOnly = false;
    const sendEmailBtn = document.getElementById('sendEmailBtn');
    const newInvoiceBtn = document.getElementById('newInvoiceBtn');
    if (sendEmailBtn) sendEmailBtn.style.display = 'none';
    if (newInvoiceBtn) newInvoiceBtn.style.display = 'none';
    if (invoiceNumberInput) invoiceNumberInput.value = getNextInvoiceNumber();
    setDefaultDates();
    calculateTotal();
}

window.resetInvoiceForm = resetInvoiceForm;

// PLANNING - Calendar with Day/Week/Month views
function changeCalendarView(view) {
    currentView = view;
    document.getElementById('viewDay')?.classList.remove('active');
    document.getElementById('viewWeek')?.classList.remove('active');
    document.getElementById('viewMonth')?.classList.remove('active');
    const el = document.getElementById('view' + view.charAt(0).toUpperCase() + view.slice(1));
    if (el) el.classList.add('active');
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
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
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

    if (!display) return;

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
    if (!container) return;
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
    if (!container) return;
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
    if (!container) return;
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

    const totalHours = filteredTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
    const workHours = filteredTasks.filter(t => t.type === 'Travail').reduce((sum, task) => sum + (task.duration || 0), 0);
    const meetingHours = filteredTasks.filter(t => t.type === 'Réunion client').reduce((sum, task) => sum + (task.duration || 0), 0);
    const adminHours = filteredTasks.filter(t => t.type === 'Administratif').reduce((sum, task) => sum + (task.duration || 0), 0);

    const viewLabel = currentView === 'day' ? 'journalier' : currentView === 'week' ? 'hebdomadaire' : 'mensuel';

    const statsEl = document.getElementById('weeklyStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <strong>Total ${viewLabel}: ${totalHours}h</strong> 
            (Travail: ${workHours}h | Réunions: ${meetingHours}h | Admin: ${adminHours}h)
        `;
    }
}

// Task form
function setupTaskHandlers() {
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            const taskDate = document.getElementById('taskDate');
            if (taskDate) taskDate.value = formatDate(currentDate);
            const card = document.getElementById('taskFormCard');
            if (card) card.style.display = 'block';
        });
    }

    const cancelTask = document.getElementById('cancelTask');
    if (cancelTask) {
        cancelTask.addEventListener('click', () => {
            const card = document.getElementById('taskFormCard');
            if (card) card.style.display = 'none';
            const form = document.getElementById('taskForm');
            if (form) form.reset();
        });
    }

    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
        taskForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const task = {
                date: document.getElementById('taskDate').value,
                startTime: document.getElementById('taskTime').value,
                duration: parseFloat(document.getElementById('taskDuration').value) || 0,
                type: document.getElementById('taskType').value,
                description: document.getElementById('taskDescription').value
            };

            tasks.push(task);
            renderCalendar();
            const card = document.getElementById('taskFormCard');
            if (card) card.style.display = 'none';
            taskForm.reset();
            showToast('Tâche ajoutée avec succès');
            saveToDrive();
        });
    }
}

// Edit task
function editTask(index) {
    const task = tasks[index];
    if (!task) return;
    document.getElementById('editTaskIndex').value = index;
    document.getElementById('editTaskDate').value = task.date;
    document.getElementById('editTaskTime').value = task.startTime;
    document.getElementById('editTaskDuration').value = task.duration;
    document.getElementById('editTaskType').value = task.type;
    document.getElementById('editTaskDescription').value = task.description;
    document.getElementById('editTaskModal').classList.add('show');
}

window.editTask = editTask;

document.getElementById('closeEditTaskModal')?.addEventListener('click', () => {
    document.getElementById('editTaskModal')?.classList.remove('show');
});

document.getElementById('cancelEditTask')?.addEventListener('click', () => {
    document.getElementById('editTaskModal')?.classList.remove('show');
});

document.getElementById('editTaskForm')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const index = parseInt(document.getElementById('editTaskIndex').value);
    tasks[index] = {
        date: document.getElementById('editTaskDate').value,
        startTime: document.getElementById('editTaskTime').value,
        duration: parseFloat(document.getElementById('editTaskDuration').value) || 0,
        type: document.getElementById('editTaskType').value,
        description: document.getElementById('editTaskDescription').value
    };

    renderCalendar();
    document.getElementById('editTaskModal')?.classList.remove('show');
    showToast('Tâche mise à jour');
    saveToDrive();
});

function deleteTaskFromEdit() {
    const index = parseInt(document.getElementById('editTaskIndex').value);
    showConfirmation(
        'Supprimer la tâche',
        'Êtes-vous sûr de vouloir supprimer cette tâche ?',
        () => {
            tasks.splice(index, 1);
            renderCalendar();
            document.getElementById('editTaskModal')?.classList.remove('show');
            showToast('Tâche supprimée');
            saveToDrive();
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
    const periodEl = document.getElementById('periodFilter');
    const period = periodEl ? periodEl.value : 'all';
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
    const startDate = document.getElementById('startDateFilter')?.value;
    const endDate = document.getElementById('endDateFilter')?.value;

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
    const clientFilter = document.getElementById('clientFilterSelect') ? document.getElementById('clientFilterSelect').value : 'all';
    if (clientFilter !== 'all') {
        filtered = filtered.filter(inv => inv.client === clientFilter);
    }

    // Status filter
    const statusFilter = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : 'all';
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
    if (!tbody) return;
    tbody.innerHTML = '';

    filteredInvoices.forEach((invoice) => {
        const index = invoices.indexOf(invoice);
        const montantRecu = parseFloat(invoice.montantRecu) || 0;
        const reste = (invoice.total || 0) - montantRecu;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${invoice.number}</strong></td>
            <td>${invoice.client}</td>
            <td>${formatDateFR(invoice.date)}</td>
            <td>${formatDateFR(invoice.dueDate)}</td>
            <td><strong>${(invoice.total || 0).toFixed(2)} €</strong></td>
            <td><input type="number" class="form-control" style="width: 100px; font-size: var(--font-size-xs);" value="${montantRecu}" step="0.01" min="0" onchange="updateMontantRecu(${index}, this.value)"></td>
            <td><input type="date" class="form-control" style="width: 140px; font-size: var(--font-size-xs);" value="${invoice.dateReception || ''}" onchange="updateDateReception(${index}, this.value)"></td>
            <td><strong>${reste.toFixed(2)} €</strong></td>
            <td><span class="status-badge status-${(invoice.status || '').toLowerCase().replace('ée', 'ee').replace('é', 'e')}">${invoice.status || ''}</span></td>
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
    if (!tbody) return;
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
            <td><strong>${(invoice.total || 0).toFixed(2)} €</strong></td>
            <td><span class="status-badge status-${(invoice.status || '').toLowerCase().replace('ée', 'ee').replace('é', 'e')}">${invoice.status || ''}</span></td>
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
    if (!invoice) return;

    // Set edit mode
    isEditMode = true;
    editingInvoiceIndex = index;

    // Show edit mode indicator
    const indicator = document.getElementById('editModeIndicator');
    if (indicator) indicator.style.display = 'block';
    const editingInvoiceNumberEl = document.getElementById('editingInvoiceNumber');
    if (editingInvoiceNumberEl) editingInvoiceNumberEl.textContent = invoice.number;

    // Update submit button text
    const submitBtn = document.getElementById('submitInvoiceBtn');
    if (submitBtn) submitBtn.textContent = '💾 Mettre à jour facture';

    // Show cancel button
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';

    // Pre-fill form fields
    if (invoiceNumberInput) invoiceNumberInput.value = invoice.number;
    const clientNameEl = document.getElementById('clientName');
    if (clientNameEl) clientNameEl.value = invoice.client;
    const clientSiretEl = document.getElementById('clientSiret');
    if (clientSiretEl) clientSiretEl.value = invoice.clientSiret || '';
    const clientAddressEl = document.getElementById('clientAddress');
    if (clientAddressEl) clientAddressEl.value = invoice.clientAddress || '';
    if (invoiceDateInput) invoiceDateInput.value = invoice.date;
    if (dueDateInput) dueDateInput.value = invoice.dueDate;
    const serviceDescriptionEl = document.getElementById('serviceDescription');
    if (serviceDescriptionEl) serviceDescriptionEl.value = invoice.description;
    if (quantityInput) quantityInput.value = invoice.quantity;
    if (unitPriceInput) unitPriceInput.value = invoice.unitPrice;

    // Reset client select to manual mode
    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) clientSelect.value = '';
    if (clientNameEl) clientNameEl.readOnly = false;
    if (clientSiretEl) clientSiretEl.readOnly = false;
    if (clientAddressEl) clientAddressEl.readOnly = false;

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
    const indicator = document.getElementById('editModeIndicator');
    if (indicator) indicator.style.display = 'none';

    // Reset submit button text
    const submitBtn = document.getElementById('submitInvoiceBtn');
    if (submitBtn) submitBtn.textContent = '💾 Créer facture';

    // Hide cancel button
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';

    // Reset form
    if (invoiceForm) invoiceForm.reset();
    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) clientSelect.value = '';
    const clientNameEl = document.getElementById('clientName');
    const clientSiretEl = document.getElementById('clientSiret');
    const clientAddressEl = document.getElementById('clientAddress');
    if (clientNameEl) clientNameEl.readOnly = false;
    if (clientSiretEl) clientSiretEl.readOnly = false;
    if (clientAddressEl) clientAddressEl.readOnly = false;
    setDefaultDates();
    if (invoiceNumberInput) invoiceNumberInput.value = getNextInvoiceNumber(invoiceDateInput ? invoiceDateInput.value : null);
    calculateTotal();
}

window.editInvoiceInForm = editInvoiceInForm;
window.cancelEditMode = cancelEditMode;

// Edit invoice (for tracking table modal)
function editInvoice(index) {
    const invoice = invoices[index];
    if (!invoice) return;
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

document.getElementById('closeEditInvoiceModal')?.addEventListener('click', () => {
    document.getElementById('editInvoiceModal')?.classList.remove('show');
});

document.getElementById('cancelEditInvoice')?.addEventListener('click', () => {
    document.getElementById('editInvoiceModal')?.classList.remove('show');
});

document.getElementById('editInvoiceForm')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const index = parseInt(document.getElementById('editInvoiceIndex').value);
    const quantity = parseFloat(document.getElementById('editQuantity').value) || 0;
    const unitPrice = parseFloat(document.getElementById('editUnitPrice').value) || 0;

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

    document.getElementById('editInvoiceModal')?.classList.remove('show');
    renderInvoiceList();
    applyFilters();
    showToast('Facture mise à jour');

    // Auto-sync after edit
    autoSync('update');
    saveToDrive();
});

// Delete invoice from list (FACTURES tab)
function deleteInvoiceFromList(index) {
    const invoice = invoices[index];
    showConfirmation(
        'Confirmation de suppression',
        `Êtes-vous sûr de vouloir supprimer la facture #${invoice.number} du client ${invoice.client} ?`,
        async () => {
            invoices.splice(index, 1);
            await saveToDrive();
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
            saveToDrive();
        }
    );
}

window.deleteInvoice = deleteInvoice;

// Duplicate invoice
async function duplicateInvoice(index) {
    const invoice = invoices[index];
    if (!invoice) return;
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
    await saveToDrive();
    renderInvoiceList();
    applyFilters();
    showToast('Facture dupliquée');
}

window.duplicateInvoice = duplicateInvoice;

// Initial render & try to persist current data to Drive (non-blocking)
function initialRenderAndPersist() {
    renderInvoiceList();
    applyFilters();
    saveToDrive()
        .then(() => {
            showToast('✅ Données sauvegardées sur Drive');
        })
        .catch(() => {
            showToast('⚠️ Impossible de sauvegarder sur Drive', 'error');
        });
}

function updateMontantRecu(index, value) {
    invoices[index].montantRecu = parseFloat(value) || 0;

    // Auto-update status to Payée if fully paid
    if (invoices[index].montantRecu >= invoices[index].total) {
        invoices[index].status = 'Payée';
    }

    applyFilters();

    // Auto-sync after payment update
    autoSync('payment');
    saveToDrive();
}

function updateDateReception(index, value) {
    invoices[index].dateReception = value;
    applyFilters();

    // Auto-sync after date update
    autoSync('payment');
    saveToDrive();
}

function updateSummary(filteredInvoices = invoices) {
    const totalFacture = filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalPaye = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.montantRecu) || 0), 0);
    const totalAttente = totalFacture - totalPaye;
    const tauxRecouvrement = totalFacture > 0 ? (totalPaye / totalFacture * 100) : 0;

    const totalFactEl = document.getElementById('totalFacture');
    const totalPayeEl = document.getElementById('totalPaye');
    const totalAttEl = document.getElementById('totalAttente');
    const tauxEl = document.getElementById('tauxRecouvrement');

    if (totalFactEl) totalFactEl.textContent = totalFacture.toFixed(2) + ' €';
    if (totalPayeEl) totalPayeEl.textContent = totalPaye.toFixed(2) + ' €';
    if (totalAttEl) totalAttEl.textContent = totalAttente.toFixed(2) + ' €';
    if (tauxEl) tauxEl.textContent = tauxRecouvrement.toFixed(1) + '%';
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
            // Open Gmail compose with PDF for manual validation/send
            openGmailComposeWithPDF(invoice, client.email_facturation).catch(err => {
                console.error('Ouverture Gmail échouée depuis liste:', err);
                showToast('⚠️ Impossible d\'ouvrir Gmail automatiquement. Ouverture de l\'aperçu.', 'error');
                currentInvoiceData = {
                    clientName: invoice.client,
                    invoiceNumber: invoice.number,
                    invoiceDate: invoice.date,
                    dueDate: invoice.dueDate,
                    total: invoice.total,
                    client: client
                };
                showEmailPreview();
            });
        }
    );
}

window.sendInvoiceEmail = sendInvoiceEmail;

// Filter event listeners
function setupFilterListeners() {
    document.getElementById('periodFilter')?.addEventListener('change', applyFilters);
    document.getElementById('startDateFilter')?.addEventListener('change', applyFilters);
    document.getElementById('endDateFilter')?.addEventListener('change', applyFilters);
    document.getElementById('clientFilterSelect')?.addEventListener('change', applyFilters);
    document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
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
    taxSettings.tauxIS = parseFloat(document.getElementById('tauxIS')?.value) || 0;
    taxSettings.versementLiberatoire = parseFloat(document.getElementById('tauxVersementLib')?.value) || 2.2;
    taxSettings.prorationMensuelle = parseFloat(document.getElementById('prorationMensuelle')?.value) || 8.33;
    taxSettings.cfeAnnuel = parseFloat(document.getElementById('cfeAnnuel')?.value) || 600;
    taxSettings.acreActif = parseFloat(document.getElementById('tauxAcreActif')?.value) || 11.6;
    taxSettings.acreInactif = parseFloat(document.getElementById('tauxAcreInactif')?.value) || 24.6;

    // Show confirmation
    const confirmation = document.getElementById('saveConfirmation');
    if (confirmation) {
        confirmation.style.display = 'block';
        setTimeout(() => {
            confirmation.style.display = 'none';
        }, 3000);
    }

    // Recalculate taxes if on calculs tab
    calculateTaxes();
    saveToDrive();
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
    const cfeAnnuel = parseFloat(document.getElementById('cfeAnnuel')?.value) || 600;
    const cfeMensuel = cfeAnnuel / 12;
    const el = document.getElementById('cfeMensuel');
    if (el) el.textContent = cfeMensuel.toFixed(2);
}

// Settings event listeners
if (document.getElementById('saveSettings')) {
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('resetSettings').addEventListener('click', resetSettings);
    document.getElementById('cfeAnnuel')?.addEventListener('input', updateCFEMensuel);
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
    const ca = parseFloat(caInput?.value) || 0;
    const acreActive = acreToggle ? acreToggle.checked : false;
    const versementLib = versementToggle ? versementToggle.checked : false;

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
    document.getElementById('calcCA') && (document.getElementById('calcCA').textContent = ca.toFixed(2) + ' €');
    document.getElementById('calcCharges') && (document.getElementById('calcCharges').textContent = charges.toFixed(2) + ' € (' + (chargesRate * 100).toFixed(1) + '%)');
    document.getElementById('calcImpot') && (document.getElementById('calcImpot').textContent = impotLabel);
    document.getElementById('calcCFE') && (document.getElementById('calcCFE').textContent = cfe.toFixed(2) + ' € (CFE mensuel)');
    document.getElementById('calcNet') && (document.getElementById('calcNet').textContent = net.toFixed(2) + ' €');
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

    // Get last 6 months data (example labels - consider dynamic if needed)
    const months = ['Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthValues = [7, 8, 9, 10, 11, 12];
    const data = [0, 0, 0, 0, 0, 0];

    invoices.forEach(inv => {
        const invDate = new Date(inv.date);
        const monthIndex = monthValues.indexOf(invDate.getMonth() + 1);
        if (monthIndex !== -1 && invDate.getFullYear() === 2025) {
            data[monthIndex] += inv.total || 0;
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

    Object.keys(statusCounts).forEach((status) => {
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
    if (!container) return;
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
    if (!button) return;
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

        // Call backend and surface any errors (avoid using mode: 'no-cors')
        try {
            const result = await callBackend('sync_invoices', { invoices: invoiceData });
            const count = invoiceData.length;
            if (!result || result.success === false) {
                try { showBackendRawResponse(result); } catch (e) {}
                throw new Error((result && (result.data || result.error)) || 'Erreur serveur lors de la synchronisation');
            }
            showToast(`✅ ${count} facture${count > 1 ? 's' : ''} synchronisée${count > 1 ? 's' : ''} avec Google Sheets`, 'success');
        } catch (err) {
            console.error('sync invoices failed:', err);
            showToast('❌ Erreur de synchronisation (voir console). Assurez-vous que le BACKEND retourne Access-Control-Allow-Origin.', 'error');
            button.innerHTML = originalContent;
            button.disabled = false;
            isSyncing = false;
            return;
        }
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

        try {
            // Only sync tasks that don't already have an eventId to avoid duplicates
            const tasksToSync = taskData.filter(t => !t.eventId);
            if (tasksToSync.length === 0) {
                showToast('📅 Aucun nouvel événement à synchroniser', 'info');
            } else {
                const result = await callBackend('sync_calendar', { tasks: tasksToSync });
                if (!result || result.success === false) {
                    try { showBackendRawResponse(result); } catch (e) {}
                    throw new Error((result && (result.data || result.error)) || 'Erreur serveur lors de la synchronisation Calendar');
                }

                // Persist returned eventIds into tasks and save
                try {
                    const details = (result.data && result.data.details) || [];
                    details.forEach(d => {
                        if (d && d.eventId && d.task) {
                            // find matching task in client tasks by date/startTime/description
                            const match = tasks.find(t => t.date === d.task.date && (t.startTime || '') === (d.task.startTime || '') && t.description === d.task.description);
                            if (match) match.eventId = d.eventId;
                        }
                    });
                    await saveToDrive();
                } catch (persistErr) {
                    console.warn('Impossible de persister eventIds:', persistErr);
                }

                showToast('✅ Planning synchronisé avec Google Calendar', 'success');
            }
        } catch (err) {
            console.error('Calendar sync failed:', err);
            showToast('❌ Erreur de synchronisation Calendar (voir console). Assurez-vous que le BACKEND autorise CORS.', 'error');
        }
    } catch (error) {
        console.error('Calendar sync error:', error);
        showToast('❌ Erreur de synchronisation Calendar', 'error');
    } finally {
        isSyncing = false;
    }
}

// Send invoice via Gmail with PDF
async function sendInvoiceWithPDF(invoice) {
    // New behavior: generate a high-fidelity PDF (html2canvas -> jsPDF) and open Gmail compose in a new tab
    try {
        showToast('📧 Préparation de l\'email (ouverture Gmail)...', 'info');

        const client = clients.find(c => c.name === invoice.client) || {};
        const clientEmail = client.email_facturation || '';
        const subject = `Facture ${invoice.number} - MTI CONSULTING`;
        const body = generateEmailBody(invoice, client || { name: invoice.client });

        // Generate PDF base64 (html2canvas -> jsPDF preferred)
        let pdfBase64;
        try {
            pdfBase64 = await generateInvoicePDFBase64(invoice);
        } catch (err) {
            console.error('PDF generation failed:', err);
            showToast('⚠️ Impossible de générer le PDF automatiquement. L\'aperçu s\'ouvrira.', 'error');
            // Fallback to preview modal
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

        // Convert base64 to blob and open in a new tab so user can review/attach
        const blob = base64ToBlob(pdfBase64, 'application/pdf');
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank'); // opens the PDF for review

        // Trigger download to facilitate attaching in Gmail (browser may block automatic download)
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `Facture_${invoice.number}.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { try { document.body.removeChild(a); } catch(e){} }, 1000);

        // Open Gmail compose in a new tab (prefilled). Attachments cannot be auto-attached via URL,
        // so user should attach the downloaded PDF (drag/drop is possible from the opened PDF tab).
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(clientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, '_blank');

        showToast('📨 Gmail ouvert en nouvel onglet. Vérifiez la pièce jointe et envoyez manuellement.', 'info');
    } catch (error) {
        console.error('sendInvoiceWithPDF (compose) error:', error);
        showToast('❌ Erreur lors de la préparation du mail', 'error');
    }
}

// Make sync function global
window.syncToGoogleSheets = syncToGoogleSheets;
window.syncToGoogleCalendar = syncToGoogleCalendar;

// Confirmation modal
let confirmCallback = null;

function showConfirmation(title, message, callback) {
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    confirmCallback = callback;

    // Update button styling for delete confirmations
    const confirmBtn = document.getElementById('confirmAction');
    if (confirmBtn) {
        if (title.toLowerCase().includes('supprimer')) {
            confirmBtn.textContent = 'Supprimer';
            confirmBtn.style.backgroundColor = 'var(--color-error)';
            confirmBtn.style.color = 'white';
        } else {
            confirmBtn.textContent = 'Confirmer';
            confirmBtn.style.backgroundColor = '';
            confirmBtn.style.color = '';
        }
    }

    document.getElementById('confirmModal')?.classList.add('show');
}

document.getElementById('cancelConfirm')?.addEventListener('click', () => {
    document.getElementById('confirmModal')?.classList.remove('show');
    confirmCallback = null;

    // Reset button styling
    const confirmBtn = document.getElementById('confirmAction');
    if (confirmBtn) {
        confirmBtn.style.backgroundColor = '';
        confirmBtn.style.color = '';
    }
});

document.getElementById('confirmAction')?.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback();
    }
    document.getElementById('confirmModal')?.classList.remove('show');
    confirmCallback = null;

    // Reset button styling
    const confirmBtn = document.getElementById('confirmAction');
    if (confirmBtn) {
        confirmBtn.style.backgroundColor = '';
        confirmBtn.style.color = '';
    }
});

// PDF Download functionality using iframe print fallback
function downloadInvoicePDF() {
    const clientNameEl = document.getElementById('clientName');
    const clientAddressEl = document.getElementById('clientAddress');
    const serviceDescriptionEl = document.getElementById('serviceDescription');

    if (!clientNameEl || !clientAddressEl || !invoiceNumberInput || !invoiceDateInput || !dueDateInput || !serviceDescriptionEl || !quantityInput || !unitPriceInput) {
        alert('Veuillez remplir tous les champs obligatoires avant de télécharger le PDF');
        return;
    }

    const clientName = clientNameEl.value;
    const clientAddress = clientAddressEl.value;
    const invoiceNumber = invoiceNumberInput.value;
    const invoiceDate = invoiceDateInput.value;
    const dueDate = dueDateInput.value;
    const description = serviceDescriptionEl.value;
    const quantity = quantityInput.value;
    const unitPrice = unitPriceInput.value;
    const total = calculateTotal();

    const tvaEnabled = document.getElementById('tvaToggle') && document.getElementById('tvaToggle').checked;
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
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(pdfContent);
    iframeDoc.close();

    // Wait for content to load, then print
    setTimeout(() => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (e) {
            console.error('Print error', e);
            alert('Erreur lors de la génération du PDF');
        } finally {
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 1000);
        }
    }, 500);
}

// Download PDF button listener
document.getElementById('downloadPDF')?.addEventListener('click', downloadInvoicePDF);

// Initialize app
function initApp() {
    // Setup lazy DOM references
    invoiceForm = document.getElementById('invoiceForm');
    invoiceNumberInput = document.getElementById('invoiceNumber');
    invoiceDateInput = document.getElementById('invoiceDate');
    dueDateInput = document.getElementById('dueDate');
    quantityInput = document.getElementById('quantity');
    unitPriceInput = document.getElementById('unitPrice');
    totalHTInput = document.getElementById('totalHT');

    setupNavigation();
    setupClientSelectListener();
    setupClientFormHandlers();
    setupInvoiceFormListeners();
    setupInvoiceSaveHandler();
    setupTaskHandlers();
    setupEmailPreviewHandlers();
    setupFilterListeners();
    setupLegacyBindings();

    setDefaultDates();
    if (invoiceNumberInput) invoiceNumberInput.value = getNextInvoiceNumber(invoiceDateInput ? invoiceDateInput.value : null);
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

    // Show jsPDF warning if missing
    const pdfWarnEl = document.getElementById('pdfWarning');
    if (!window.jspdf) {
        if (pdfWarnEl) pdfWarnEl.style.display = 'block';
        console.warn('jsPDF non chargé — certaines fonctionnalités PDF seront indisponibles.');
    } else {
        if (pdfWarnEl) pdfWarnEl.style.display = 'none';
    }

    // Backend test button binding
    const testBtn = document.getElementById('testBackendBtn');
    if (testBtn) testBtn.addEventListener('click', testBackend);

    // Copy/close buttons exist in DOM; handlers attached globally above via event delegation

    // Initial persist attempt
    initialRenderAndPersist();
}

// Start the app on DOM ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initialisation MTI CONSULTING v2.0...');
    // Ensure backend storage exists (Drive folder + data file), then load from Drive
    try {
        // First try the standard POST-based call
        try {
            const ensure = await callBackend('ensureStorage');
            if (ensure && ensure.success) {
                console.log('Drive storage verified (POST):', ensure.data);
                showToast('✅ Stockage Drive vérifié (backend)', 'success');
            } else {
                console.warn('ensureStorage (POST) returned error:', ensure);
                throw new Error('ensureStorage POST failed');
            }
        } catch (postErr) {
            // Likely CORS / network issue — try JSONP fallback
            console.warn('POST ensureStorage failed, trying JSONP fallback:', postErr);
            try {
                const ensureJsonp = await callBackendJSONP('ensureStorage');
                if (ensureJsonp && ensureJsonp.success) {
                    console.log('Drive storage verified (JSONP):', ensureJsonp.data);
                    const ids = ensureJsonp.data || {};
                    showToast('✅ Stockage Drive vérifié (JSONP). dossier: ' + (ids.folderId || 'n/a'), 'success');
                } else {
                    console.warn('ensureStorage (JSONP) returned error:', ensureJsonp);
                    showToast('⚠️ Vérification stockage Drive: problème (JSONP)', 'info');
                }
            } catch (jsonpErr) {
                console.error('JSONP ensureStorage failed:', jsonpErr);
                showToast('⚠️ Impossible de vérifier le stockage Drive (CORS).', 'error');
            }
        }

        // Charger depuis Drive
        await loadFromDrive();
        initApp();
        console.log('✅ Application prête');
    } catch (e) {
        console.error('Erreur verify storage / init sequence:', e);
        showToast('Erreur d\'initialisation (voir console)', 'error');
        // Still attempt to continue initialization
        try { await loadFromDrive(); } catch (ee) { console.warn('loadFromDrive failed during fallback init:', ee); }
        try { initApp(); } catch (ee) { console.warn('initApp failed during fallback init:', ee); }
    }
});

// ==========================================
// ENVOI EMAIL GMAIL API (legacy functions kept)
// ==========================================

// Envoyer une facture par email avec PDF (legacy helper)
async function sendInvoiceByEmail(index) {
    const invoice = invoices[index];
    const client = clients.find(c => c.name === invoice.client);

    if (!client || !client.email_facturation) {
        alert('❌ Email de facturation manquant');
        return;
    }

    if (!confirm(`📧 Envoyer la facture ${invoice.number} à ${client.email_facturation} ?`)) {
        return;
    }

    try {
        // Générer PDF base64 (requires jsPDF & autotable)
        const pdfBase64 = await generateInvoicePDFBase64(invoice);

        // Envoyer via backend (use callBackend to avoid CORS preflight)
        const result = await callBackend('sendEmail', {
            to: client.email_facturation,
            subject: `Facture ${invoice.number} - MTI CONSULTING`,
            body: generateEmailBody(invoice, client),
            pdfBase64: pdfBase64,
            pdfFilename: `Facture_${invoice.number}.pdf`
        });
        if (!result || !result.success) {
            try { showBackendRawResponse(result); } catch (e) {}
            throw new Error((result && (result.data || result.error)) || 'Unknown error');
        }

        alert(`✅ Facture envoyée à ${client.email_facturation}`);
    } catch (error) {
        console.error('❌ Erreur:', error);
        alert('Erreur : ' + (error.message || error));
    }
}

// Générer le corps de l'email
function generateEmailBody(invoice, client) {
    const contactName = client.contact_name || client.name;
    return `Bonjour ${contactName},

Veuillez trouver ci-joint la facture n°${invoice.number} d'un montant de ${(invoice.total || 0).toFixed(2)} € HT.

Date de facturation : ${formatDateFR(invoice.date)}
Date d'échéance : ${formatDateFR(invoice.dueDate)}

Conditions de paiement : 30 jours nets

Cordialement,
Mickaël TOURDOT-IGUEDJETAL
MTI CONSULTING
Téléphone : +33 7 77 37 17 39
Mail : mticonsulting59@gmail.com`;
}

// Helper: convert base64 (no prefix) to Blob
function base64ToBlob(base64, mime) {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
}

// Générer PDF en base64 en priorité via html2canvas -> jsPDF pour conserver le rendu HTML, sinon fallback jsPDF legacy
async function generateInvoicePDFBase64(invoice) {
    // Build HTML for the invoice (reuse preview rendering logic)
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '800px';
    tempContainer.style.padding = '20px';
    tempContainer.innerHTML = (function(inv) {
        const companyAddressLine = companyInfo.address && companyInfo.postalCode && companyInfo.city
            ? `${companyInfo.address}\n${companyInfo.postalCode} ${companyInfo.city}`
            : '[À compléter dans Paramètres]';
        const logoHTML = companyInfo.logoUrl
            ? `<img src="${companyInfo.logoUrl}" alt="Logo" style="max-width:150px; max-height:80px; object-fit:contain; display:block; margin-bottom:8px;">`
            : '';
        const tvaEnabled = document.getElementById('tvaToggle') && document.getElementById('tvaToggle').checked;
        const totalHT = inv.total || 0;
        const tva = tvaEnabled ? totalHT * 0.2 : 0;
        const totalTTC = totalHT + tva;

        return `
            <div style="font-family: Arial, Helvetica, 'Trebuchet MS', sans-serif; color: #134252; width: 800px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="max-width:50%;">
                        ${logoHTML}
                        <div style="font-weight:700; font-size:16px; color:#21808D;">${companyInfo.name}</div>
                        <div style="white-space:pre-line; font-size:12px; margin-top:4px;">${companyAddressLine}</div>
                        <div style="font-size:12px; margin-top:4px;">SIRET: ${companyInfo.siret}</div>
                    </div>
                    <div style="text-align:right; max-width:45%;">
                        <div style="font-weight:700; margin-bottom:4px;">${inv.client || ''}</div>
                        <div style="white-space:pre-line; font-size:12px;">${inv.clientAddress || ''}</div>
                    </div>
                </div>
                <div style="margin-top:16px;">
                    <h2 style="font-size:18px; margin:8px 0;">FACTURE N° ${inv.number || ''}</h2>
                    <div style="font-size:13px;">Date: ${formatDateFR(inv.date)}<br>Échéance: ${formatDateFR(inv.dueDate)}</div>
                </div>
                <hr style="border:none; border-top:1px solid #ddd; margin:12px 0;">
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <thead><tr style="background:#f5f5f5; font-weight:700;"><th style="padding:6px 10px; text-align:left;">Description</th><th style="padding:6px 10px; text-align:center;">Quantité</th><th style="padding:6px 10px; text-align:right;">Prix unitaire</th><th style="padding:6px 10px; text-align:right;">Total HT</th></tr></thead>
                    <tbody>
                        <tr>
                            <td style="padding:6px 10px;">${inv.description || ''}</td>
                            <td style="padding:6px 10px; text-align:center;">${inv.quantity || 0}</td>
                            <td style="padding:6px 10px; text-align:right;">${(inv.unitPrice || 0).toFixed(2)} €</td>
                            <td style="padding:6px 10px; text-align:right;">${(inv.total || 0).toFixed(2)} €</td>
                        </tr>
                    </tbody>
                </table>
                <div style="text-align:right; margin-top:12px; font-size:13px;">
                    ${tvaEnabled ? `<div>Total HT: ${totalHT.toFixed(2)} €</div><div>TVA (20%): ${tva.toFixed(2)} €</div><div style="font-weight:700; font-size:16px; margin-top:6px;">Total TTC: ${totalTTC.toFixed(2)} €</div>` : `<div>Total HT: ${totalHT.toFixed(2)} €</div><div style="font-size:12px; color:#666;">TVA non applicable (art. 293 B du CGI)</div><div style="font-weight:700; font-size:16px; margin-top:6px;">Total TTC: ${totalHT.toFixed(2)} €</div>`}
                </div>
                <div style="margin-top:18px; font-size:8px; color:#666; background:#f9f9f9; padding:6px; border-radius:4px;">Dispensé d'immatriculation RCS/RM | TVA non applicable art. 293B CGI | Conditions: Paiement à 30 jours</div>
            </div>
        `;
    })(invoice);

    document.body.appendChild(tempContainer);

    // If html2canvas is available, use it for faithful rendering
    if (window.html2canvas && window.jspdf) {
        try {
            const canvas = await html2canvas(tempContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');

            // Calculate width/height to fit A4 while keeping aspect
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // canvas dimensions in px
            const imgProps = { width: canvas.width, height: canvas.height };
            const pxToMm = (px) => px * 25.4 / (window.devicePixelRatio * 96);
            const imgWidthMm = pxToMm(imgProps.width);
            const imgHeightMm = pxToMm(imgProps.height);

            const margin = 10; // mm
            let renderWidth = pageWidth - margin * 2;
            let renderHeight = (imgHeightMm * renderWidth) / imgWidthMm;

            if (renderHeight > pageHeight - margin * 2) {
                // scale down
                renderHeight = pageHeight - margin * 2;
                renderWidth = (imgWidthMm * renderHeight) / imgHeightMm;
            }

            pdf.addImage(imgData, 'PNG', (pageWidth - renderWidth) / 2, margin, renderWidth, renderHeight);
            const dataUri = pdf.output('datauristring');
            // Cleanup
            try { document.body.removeChild(tempContainer); } catch(e) {}
            return dataUri.split(',')[1];
        } catch (err) {
            console.warn('html2canvas/pdf path failed, falling back to legacy jsPDF:', err);
            try { document.body.removeChild(tempContainer); } catch(e) {}
            // fall through to legacy below
        }
    } else {
        try { document.body.removeChild(tempContainer); } catch(e) {}
    }

    // Legacy fallback: use jsPDF autoTable-based generator if available
    if (!window.jspdf) {
        throw new Error('Aucune méthode de génération PDF disponible (html2canvas ou jsPDF manquants).');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Logo
    if (companyInfo.logoUrl) {
        try {
            doc.addImage(companyInfo.logoUrl, 'PNG', 20, 20, 30, 30);
        } catch(e) {}
    }

    // En-tête
    doc.setFontSize(20);
    doc.text(companyInfo.name, 60, 30);
    doc.setFontSize(10);
    doc.text(companyInfo.address, 60, 37);
    doc.text(`${companyInfo.postalCode} ${companyInfo.city}`, 60, 42);
    doc.text(`SIRET : ${companyInfo.siret}`, 60, 47);

    // Titre
    doc.setFontSize(18);
    doc.text(`FACTURE ${invoice.number}`, 20, 70);

    // Client
    doc.setFontSize(10);
    doc.text('Client :', 20, 85);
    doc.text(invoice.client, 20, 90);
    if (invoice.clientSiret) doc.text(`SIRET : ${invoice.clientSiret}`, 20, 95);

    // Dates
    doc.text(`Date : ${formatDateFR(invoice.date)}`, 120, 85);
    doc.text(`Échéance : ${formatDateFR(invoice.dueDate)}`, 120, 90);

    // Tableau
    if (doc.autoTable) {
        doc.autoTable({
            startY: 120,
            head: [['Description', 'Quantité', 'Prix unitaire', 'Total HT']],
            body: [[
                invoice.description || '',
                (invoice.quantity || 0).toString(),
                `${(invoice.unitPrice || 0).toFixed(2)} €`,
                `${(invoice.total || 0).toFixed(2)} €`
            ]]
        });
    } else {
        doc.text(invoice.description || '', 20, 120);
    }

    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 140;
    const tva = (invoice.total || 0) * 0.2;
    const ttc = (invoice.total || 0) + tva;

    doc.text(`Total HT : ${(invoice.total || 0).toFixed(2)} €`, 120, finalY);
    doc.text(`TVA 20% : ${tva.toFixed(2)} €`, 120, finalY + 7);
    doc.setFontSize(12);
    doc.text(`Total TTC : ${ttc.toFixed(2)} €`, 120, finalY + 14);

    return doc.output('datauristring').split(',')[1];
}

// ==========================================
// SYNC TIERS GOOGLE SHEETS
// ==========================================

// Importer clients depuis Sheets
async function importClientsFromSheets() {
    const btn = document.getElementById('importClientsBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Import...';
    }

    try {
        const result = await callBackend('importClients', { sheetId: CONFIG.SHEETS_ID });
        if (!result || result.success === false) throw new Error((result && result.data) ? result.data : 'Erreur serveur lors de l\'import');
        const payload = result.data || {};
        clients = payload.clients || [];
        await saveToDrive();
        renderClientsTable();
        populateClientSelects();
        alert(`✅ ${clients.length} clients importés`);
    } catch (error) {
        console.error('importClientsFromSheets error:', error);
        const message = (error && error.message && error.message.includes('CORS')) || (error && error.message && error.message.includes('Access')) || (error && error.message && error.message.includes('Failed to fetch'))
            ? 'Erreur réseau/CORS lors de l\'import. Vérifiez que le BACKEND autorise CORS et que l\'URL est correcte.'
            : ('Erreur import : ' + (error.message || error));
        alert(message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📥 Importer depuis Sheets';
        }
    }
}

// Exporter clients vers Sheets
async function exportClientsToSheets() {
    const btn = document.getElementById('exportClientsBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Export...';
    }

    try {
        const result = await callBackend('exportClients', { sheetId: CONFIG.SHEETS_ID, clients });
        if (!result || result.success === false) throw new Error((result && result.data) ? result.data : 'Erreur serveur lors de l\'export');
        alert(`✅ ${clients.length} clients exportés`);
        window.open(`https://docs.google.com/spreadsheets/d/${CONFIG.SHEETS_ID}`, '_blank');
    } catch (error) {
        console.error('exportClientsToSheets error:', error);
        const message = (error && error.message && error.message.includes('CORS')) || (error && error.message && error.message.includes('Access')) || (error && error.message && error.message.includes('Failed to fetch'))
            ? 'Erreur réseau/CORS lors de l\'export. Vérifiez que le BACKEND autorise CORS et que l\'URL est correcte.'
            : ('Erreur export : ' + (error.message || error));
        alert(message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📤 Exporter vers Sheets';
        }
    }
}
