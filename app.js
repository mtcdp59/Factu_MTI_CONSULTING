// MTI CONSULTING - Application de facturation
// Version v2.0 - Google Drive Storage + Gmail API + Calendar API

const CONFIG = {
    BACKEND_URL: 'https://script.google.com/macros/s/AKfycbyUp4uaDfbrZpziEXI3SRBYm8M_cF32mU17Ji_L3qYnxaQGl-K6KZ19-33yHkCCMD92/exec',
    DRIVE_FILE_NAME: 'mti_data.json',
    SHEETS_ID: '1Zu6I-c64YrBdlfvWhiVnlbwbvhv6Mw5NL8iRn2mvXoE',
    CALENDAR_ID: 'mticonsulting59@gmail.com'
};

function getConfiguredCalendarId() {
    return localStorage.getItem('mti_calendar_id') || CONFIG.CALENDAR_ID;
}

// Send mode storage key: 'drive' or 'manual'
const SEND_MODE_KEY = 'mti_send_mode';

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
    let body = generateEmailBody(invoice, client || { name: invoice.client });

    // Generate PDF base64 and save to Drive so user can attach or link
    try {
        const pdfBase64 = await generateInvoicePDFBase64(invoice);
        // Save to Drive (folder 'Factures') so user can attach; include link in body as hint
        const saveResp = await callBackend('savePdfToDrive', { pdfBase64: pdfBase64, pdfFilename: 'Facture_' + (invoice.number || Date.now()) + '.pdf', folderName: 'Factures' });
        if (saveResp && saveResp.success && saveResp.data && saveResp.data.fileUrl) {
            body += '\n\n(La pièce jointe a été sauvegardée sur Drive: ' + saveResp.data.fileUrl + ')';
        }
        // Also open PDF in new tab for review
        try {
            const blob = base64ToBlob(pdfBase64, 'application/pdf');
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
            // Trigger download to make attaching easier
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `Facture_${invoice.number}.pdf`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try { document.body.removeChild(a); } catch(e){} }, 1000);
        } catch (e) { /* ignore preview failure */ }
    } catch (err) {
        console.warn('Could not generate/save PDF for compose:', err);
        body += '\n\n(La pièce jointe n\'a pas pu être générée automatiquement)';
    }

    // Open Gmail compose (prefilled). Note: attachments cannot be auto-attached.
    const gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(toEmail || '') + '&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
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
let useAppCalendar = false; // true = app calendar (day/week/month), false = FullCalendar (Google)

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

// Application-specific settings persisted with Drive data
let appSettings = {
    sendMode: 'drive', // 'drive' or 'compose'
    previewBeforeSend: true // if true, open saved Drive PDF before sending
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
                // Auto-refresh FullCalendar on tab switch to Planning
                if (window.mti_fullCalendar) window.mti_fullCalendar.refetchEvents();
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

    // Header import Calendar button (wire to backend importCalendarEvents)
    const importCalHeaderBtn = document.getElementById('importCalendarHeaderBtn');
    if (importCalHeaderBtn) {
        importCalHeaderBtn.addEventListener('click', async () => {
            try {
                // Offer to choose calendar before import
                if (!localStorage.getItem('mti_calendar_id')) {
                    if (confirm('Aucun calendrier configuré. Voulez-vous sélectionner un calendrier maintenant ?')) {
                        try {
                            const calsResp = await callBackend('listCalendars');
                            if (calsResp && calsResp.success && calsResp.data && Array.isArray(calsResp.data.calendars)) {
                                const list = calsResp.data.calendars;
                                let pickList = 'Calendriers disponibles:\n';
                                for (let i = 0; i < list.length; i++) pickList += `${i+1}. ${list[i].name} (${list[i].id})\n`;
                                const choice = prompt(pickList + '\nEntrez le numéro du calendrier à utiliser:');
                                const idx = parseInt(choice) - 1;
                                if (!isNaN(idx) && list[idx]) {
                                    localStorage.setItem('mti_calendar_id', list[idx].id);
                                    showToast('Calendrier configuré: ' + list[idx].name, 'success');
                                }
                            }
                        } catch (e) { console.warn('listCalendars failed', e); }
                    }
                }
                const startDate = prompt('Date de début (AAAA-MM-JJ)', formatDate(new Date()));
                if (!startDate) return;
                const endDate = prompt('Date de fin (AAAA-MM-JJ)', formatDate(new Date()));
                if (!endDate) return;

                importCalHeaderBtn.disabled = true;
                importCalHeaderBtn.textContent = '⏳ Import...';

                const res = await callBackend('importCalendarEvents', { startDate: startDate, endDate: endDate, calendarId: getConfiguredCalendarId() });
                if (!res || res.success === false) {
                    try { showBackendRawResponse(res); } catch (e) {}
                    throw new Error((res && (res.data || res.error)) || 'Erreur import calendrier');
                }

                // Merge results into client tasks and persist
                const payload = res.data || {};
                const imported = payload.imported || [];
                if (imported.length > 0) {
                    // Reload from Drive to refresh UI (server already saved file)
                    await loadFromDrive();
                    renderCalendar();
                    showToast(`✅ ${imported.length} événement(s) importé(s)`,'success');
                } else {
                    showToast('Aucun événement importé', 'info');
                }
            } catch (err) {
                console.error('importCalendarHeaderBtn error:', err);
                alert('Erreur import Calendar: ' + (err.message || err));
            } finally {
                importCalHeaderBtn.disabled = false;
                importCalHeaderBtn.textContent = '📥 Importer Calendar';
            }
        });
    }

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

    // Use local logo file (MTI_CONSULTING.png) or configured data-URI
    const logoSrc = companyInfo.logoUrl && (companyInfo.logoUrl.startsWith('data:') || !companyInfo.logoUrl.includes('github')) 
        ? companyInfo.logoUrl 
        : 'MTI_CONSULTING.png';
    const logoHTML = logoSrc
        ? `<img src="${logoSrc}" alt="Logo" style="max-width: 150px; max-height: 80px; object-fit: contain; margin-bottom: var(--space-12);" crossorigin="anonymous">`
        : '';            const previewHTML = `
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

            // Render using shared helper so PDF generator can reuse exact DOM
            renderInvoicePreview({
                client: clientName,
                clientAddress: clientAddress,
                number: invoiceNumber,
                date: invoiceDate,
                dueDate: dueDate,
                description: description,
                quantity: quantity,
                unitPrice: unitPrice,
                total: total,
                tvaEnabled: tvaEnabled
            }, true);
        });
    }

// Render the invoice preview into the modal / preview DOM. If `showModal` is true, open modal.
function renderInvoicePreview(inv, showModal) {
    const companyAddressLine = companyInfo.address && companyInfo.postalCode && companyInfo.city
        ? `${companyInfo.address}\n${companyInfo.postalCode} ${companyInfo.city}`
        : '[À compléter dans Paramètres]';

    // Use local logo file (MTI_CONSULTING.png) or configured URL
    const logoSrc = companyInfo.logoUrl && !companyInfo.logoUrl.includes('github') ? companyInfo.logoUrl : 'MTI_CONSULTING.png';
    const logoHTML = logoSrc
        ? `<img src="${logoSrc}" alt="Logo" style="max-width: 150px; max-height: 80px; object-fit: contain; margin-bottom: var(--space-12);" crossorigin="anonymous">`
        : '';

    const tvaEnabled = inv.tvaEnabled;
    const totalHT = inv.total || 0;
    const tva = tvaEnabled ? totalHT * 0.20 : 0;
    const totalTTC = totalHT + tva;

    const previewHTML = `
        <div class="invoice-header">
            <div class="invoice-header-left">
                ${logoHTML}
                <div class="invoice-company">${companyInfo.name}</div>
                <div style="white-space: pre-line; font-size: 12px; line-height: 1.5; margin-top: 4px;">${companyAddressLine}</div>
                <div style="font-size: 12px; margin-top: 4px;">SIRET: ${companyInfo.siret || ''}</div>
            </div>
            <div class="invoice-header-right">
                <div style="font-weight: bold; margin-bottom: 4px;">${inv.client || ''}</div>
                <div style="white-space: pre-line; font-size: 12px; line-height: 1.5;">${inv.clientAddress || ''}</div>
            </div>
        </div>

        <div class="invoice-details">
            <h2 class="invoice-number">FACTURE N° ${inv.number || ''}</h2>
            <div style="font-size: 13px;"><div>Date: ${formatDateFR(inv.date)}</div><div>Échéance: ${formatDateFR(inv.dueDate)}</div></div>
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
                    <td>${inv.description || ''}</td>
                    <td style="text-align: center;">${inv.quantity || 0}</td>
                    <td style="text-align: right;">${parseFloat(inv.unitPrice || 0).toFixed(2)} €</td>
                    <td style="text-align: right;">${(inv.total || 0).toFixed(2)} €</td>
                </tr>
            </tbody>
        </table>

        <div class="invoice-total">
            ${tvaEnabled ? `<div>Total HT: ${totalHT.toFixed(2)} €</div><div>TVA (20%): ${tva.toFixed(2)} €</div><div><strong>Total TTC: ${totalTTC.toFixed(2)} €</strong></div>` : `<div>Total HT: ${totalHT.toFixed(2)} €</div><div>TVA non applicable (art. 293 B du CGI)</div><div><strong>Total TTC: ${totalHT.toFixed(2)} €</strong></div>`}
        </div>

        <div class="invoice-legal"><p>Dispensé d'immatriculation RCS/RM | TVA non applicable art. 293B CGI | Conditions: Paiement à 30 jours</p><p>Retard: indemnité forfaitaire 40€ + intérêts au taux légal | Escompte: néant</p></div>
    `;

    const previewContent = document.getElementById('invoicePreviewContent');
    if (previewContent) previewContent.innerHTML = previewHTML;
    if (showModal) {
        const modal = document.getElementById('invoiceModal');
        if (modal) modal.classList.add('show');
    }
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

        // Prefer opening Gmail compose with generated PDF so user can attach/review the exact PDF
        const invoiceObj = {
            number: invoiceNumber,
            client: clientName,
            clientSiret: client && client.siret ? client.siret : '',
            clientAddress: client && client.address ? client.address : '',
            date: invoiceDate,
            dueDate: dueDate,
            description: '',
            quantity: 0,
            unitPrice: 0,
            total: total
        };

        // Try to open Gmail compose with PDF (this also opens the PDF in a new tab and triggers download)
        openGmailComposeWithPDF(invoiceObj, emailTo)
            .then(() => {
                // Mark invoice as sent if it exists in the invoices array
                try {
                    const idx = invoices.findIndex(inv => inv.number === invoiceNumber && inv.client === clientName);
                    if (idx >= 0) {
                        invoices[idx].status = 'Envoyée';
                        saveToDrive();
                        renderInvoiceList();
                    }
                } catch (e) { console.warn('Impossible de marquer la facture envoyée après ouverture compose :', e); }

                // Close modal
                const modal = document.getElementById('emailModal');
                if (modal) modal.classList.remove('show');

                setTimeout(() => {
                    alert('Gmail ouvert en nouvel onglet. N\'oubliez pas d\'ajouter la pièce jointe PDF si nécessaire, puis envoyer.');
                    if (confirm('Voulez-vous créer une nouvelle facture ?')) {
                        resetInvoiceForm();
                    }
                }, 300);
            })
            .catch(err => {
                console.error('Erreur ouverture compose Gmail depuis preview:', err);
                // Fallback to mailto behaviour
                const encodedSubject = encodeURIComponent(subject);
                const encodedBody = encodeURIComponent(body);
                const mailtoLink = `mailto:${emailTo}?subject=${encodedSubject}&body=${encodedBody}`;
                window.location.href = mailtoLink;
                const modal = document.getElementById('emailModal');
                if (modal) modal.classList.remove('show');
                setTimeout(() => {
                    alert('Email préparé et ouvert dans votre client de messagerie. N\'oubliez pas de joindre le PDF de la facture avant l\'envoi !');
                    if (confirm('Voulez-vous créer une nouvelle facture ?')) {
                        resetInvoiceForm();
                    }
                }, 500);
            });
    });
}

function showEmailPreview() {
    if (!currentInvoiceData) return;
    const { clientName, invoiceNumber, invoiceDate, dueDate, total, client } = currentInvoiceData;

    // Check if email is configured
    const hasEmail = client && client.email_facturation && client.email_facturation.trim() !== '';
    const contactName = (client && client.contact_name && client.contact_name.trim() !== '') ? client.contact_name : clientName;
    const emailTo = hasEmail ? client.email_facturation : '';

    // Build email content using shared helper for consistent wording
    const subject = `Facture #${invoiceNumber} - MTI CONSULTING`;
    // Use generateEmailBody to keep manual and automatic flows consistent
    const body = generateEmailBody({ number: invoiceNumber, date: invoiceDate, dueDate: dueDate, total: total }, { name: contactName, contact_name: contactName });

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
                    const clientObj = clients.find(c => c.name === invoice.client);
                    const hasEmail = clientObj && clientObj.email_facturation && clientObj.email_facturation.trim() !== '';

                    if (hasEmail) {
                        // Try automatic send via Drive (preferred): generate PDF, save to Drive and send
                        sendInvoiceViaDrive(invoice, clientObj.email_facturation)
                            .catch(err => {
                                console.error('sendInvoiceViaDrive failed:', err);
                                showToast('⚠️ Envoi via Drive échoué, fallback ouverture compose Gmail', 'error');
                                openGmailComposeWithPDF(invoice, clientObj.email_facturation).catch(e => {
                                    console.error('Fallback compose failed:', e);
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
    for (let i = 0; i < 7; i++) {
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
        const end = weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        display.textContent = `Semaine du ${start} au ${end}`;
    } else if (currentView === 'month') {
        display.textContent = currentDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
    }
}

function renderDayView() {
    const container = document.getElementById(useAppCalendar ? 'appCalendarContainer' : 'calendarContainer');
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
    const container = document.getElementById(useAppCalendar ? 'appCalendarContainer' : 'calendarContainer');
    if (!container) return;
    const weekDates = getWeekDates(currentDate);
    const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    let html = '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--space-8);">';

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
    const container = document.getElementById(useAppCalendar ? 'appCalendarContainer' : 'calendarContainer');
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

// --- Calendar Manager UI & actions ---
function initCalendarManager() {
    const container = document.getElementById('calendarEmbedContainer');
    if (!container) return;

    // Manager panel will be inserted below the iframe
    let manager = document.getElementById('calendarManager');
    if (manager) return; // already initialized

    manager = document.createElement('div');
    manager.id = 'calendarManager';
    manager.style.marginTop = '12px';
    manager.innerHTML = `
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
            <label style="font-size:13px; color:var(--color-text-secondary);">Gérer les RDV</label>
            <input type="date" id="mgrStartDate" class="form-control" style="width:160px;" />
            <input type="date" id="mgrEndDate" class="form-control" style="width:160px;" />
            <button class="btn btn-sm btn-primary" id="mgrLoadEvents">Charger</button>
            <button class="btn btn-sm btn-secondary" id="mgrNewEvent">Nouvel RDV</button>
        </div>
        <div id="mgrEventsList" style="max-height:260px; overflow:auto; border:1px solid var(--color-card-border); padding:8px; border-radius:6px; background:#fff;"></div>
        <div id="mgrEventForm" style="display:none; margin-top:8px; border:1px solid var(--color-card-border); padding:12px; border-radius:6px; background:#fff;">
            <div style="display:flex; gap:8px; margin-bottom:8px;"><input type="date" id="evtDate" class="form-control" style="width:160px;" /><input type="time" id="evtTime" class="form-control" style="width:120px;" /><input type="number" id="evtDuration" class="form-control" style="width:100px;" value="1" step="0.5" /></div>
            <input type="text" id="evtDesc" class="form-control" placeholder="Titre / description" style="margin-bottom:8px;" />
            <select id="evtType" class="form-control" style="margin-bottom:8px;"><option value="Travail">Travail</option><option value="Réunion">Réunion</option><option value="Administratif">Administratif</option></select>
            <div style="display:flex; gap:8px; justify-content:flex-end;"><button class="btn btn-secondary" id="evtCancel">Annuler</button><button class="btn btn-primary" id="evtSave">Enregistrer</button></div>
        </div>
    `;

    container.appendChild(manager);

    // Bind controls
    document.getElementById('mgrLoadEvents').addEventListener('click', async () => {
        const sd = document.getElementById('mgrStartDate').value;
        const ed = document.getElementById('mgrEndDate').value;
        if (!sd || !ed) { alert('Sélectionnez une plage de dates'); return; }
        await loadCalendarEvents(sd, ed);
    });

    document.getElementById('mgrNewEvent').addEventListener('click', () => {
        openEventForm();
    });

    document.getElementById('evtCancel').addEventListener('click', () => {
        closeEventForm();
    });

    document.getElementById('evtSave').addEventListener('click', async () => {
        const eid = document.getElementById('evtDate').dataset.eventId || null;
        const evt = {
            eventId: eid,
            date: document.getElementById('evtDate').value,
            time: document.getElementById('evtTime').value,
            duration: parseFloat(document.getElementById('evtDuration').value) || 1,
            description: document.getElementById('evtDesc').value || 'RDV',
            type: document.getElementById('evtType').value || 'Autre',
            calendarId: getConfiguredCalendarId()
        };

        try {
            if (eid) {
                const resp = await callBackend('updateCalendarEvent', { event: evt });
                if (!resp || resp.success === false) { showBackendRawResponse(resp); alert('Erreur mise à jour event'); return; }
                showToast('✅ Événement mis à jour');
            } else {
                const resp = await callBackend('addCalendarEvent', { event: evt });
                if (!resp || resp.success === false) { showBackendRawResponse(resp); alert('Erreur création event'); return; }
                showToast('✅ Événement créé');
            }
            closeEventForm();
            // reload list if a range present
            const sd = document.getElementById('mgrStartDate').value;
            const ed = document.getElementById('mgrEndDate').value;
            if (sd && ed) await loadCalendarEvents(sd, ed);
            // Auto-refresh FullCalendar to show new/updated event
            if (window.mti_fullCalendar) window.mti_fullCalendar.refetchEvents();
        } catch (e) { console.error('evtSave failed', e); alert('Erreur lors de la sauvegarde'); }
    });
}

async function loadCalendarEvents(startDate, endDate) {
    const listEl = document.getElementById('mgrEventsList');
    if (!listEl) return;
    listEl.innerHTML = 'Chargement...';
    try {
        const resp = await callBackend('listCalendarEvents', { startDate: startDate, endDate: endDate, calendarId: getConfiguredCalendarId(), maxResults: 500 });
        if (!resp || resp.success === false) { listEl.innerHTML = 'Erreur chargement'; showBackendRawResponse(resp); return; }
        const events = resp.data && resp.data.events ? resp.data.events : [];
        if (events.length === 0) { listEl.innerHTML = '<div style="padding:8px;">Aucun événement</div>'; return; }
        listEl.innerHTML = '';
        events.forEach(ev => {
            const card = document.createElement('div');
            card.style.borderBottom = '1px solid var(--color-card-border)';
            card.style.padding = '8px';
            const start = new Date(ev.start).toLocaleString('fr-FR');
            const end = new Date(ev.end).toLocaleString('fr-FR');
            card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><div><strong>${ev.title}</strong><br><span style='font-size:12px;color:var(--color-text-secondary)'>${start} — ${end}</span></div><div style="display:flex; gap:6px;"><button class='btn btn-sm btn-secondary' data-id='${ev.id}' data-action='edit'>✏️</button><button class='btn btn-sm btn-secondary' data-id='${ev.id}' data-action='delete'>🗑️</button></div></div>`;
            listEl.appendChild(card);
            const editBtn = card.querySelector("button[data-action='edit']");
            const delBtn = card.querySelector("button[data-action='delete']");
            editBtn.addEventListener('click', () => openEventForm(ev));
            delBtn.addEventListener('click', async () => {
                if (!confirm('Supprimer cet événement ?')) return;
                try {
                    const dresp = await callBackend('deleteCalendarEvent', { eventId: ev.id, calendarId: getConfiguredCalendarId(), startDate: startDate, endDate: endDate });
                    if (!dresp || dresp.success === false) { showBackendRawResponse(dresp); alert('Erreur suppression'); return; }
                    showToast('✅ Événement supprimé');
                    await loadCalendarEvents(startDate, endDate);
                } catch (e) { console.error('delete event failed', e); alert('Erreur suppression'); }
            });
        });
    } catch (e) { console.error('loadCalendarEvents failed', e); listEl.innerHTML = 'Erreur'; }
}

function openEventForm(ev) {
    const form = document.getElementById('mgrEventForm');
    if (!form) return;
    if (!ev) {
        document.getElementById('evtDate').value = '';
        document.getElementById('evtTime').value = '';
        document.getElementById('evtDuration').value = 1;
        document.getElementById('evtDesc').value = '';
        document.getElementById('evtType').value = 'Travail';
        document.getElementById('evtDate').dataset.eventId = '';
    } else {
        const start = new Date(ev.start);
        document.getElementById('evtDate').value = start.toISOString().slice(0,10);
        document.getElementById('evtTime').value = start.toTimeString().slice(0,5);
        const end = new Date(ev.end);
        const duration = (end - start) / (1000*60*60);
        document.getElementById('evtDuration').value = duration;
        document.getElementById('evtDesc').value = ev.title || '';
        // No strong mapping for type; attempt to parse description
        document.getElementById('evtType').value = (ev.description && ev.description.indexOf('Réunion') !== -1) ? 'Réunion' : 'Travail';
        document.getElementById('evtDate').dataset.eventId = ev.id;
    }
    form.style.display = 'block';
}

function closeEventForm() {
    const form = document.getElementById('mgrEventForm');
    if (!form) return; form.style.display = 'none';
}

// Initialize FullCalendar inside #calendarContainer and wire backend actions
function initFullCalendar() {
    if (!window.FullCalendar) return; // FullCalendar not loaded
    const container = document.getElementById('calendarContainer');
    if (!container) return;

    // Replace existing content with the calendar root
    container.innerHTML = '<div id="fcRoot"></div>';
    const calendarEl = document.getElementById('fcRoot');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        selectable: true,
        editable: true,
        navLinks: true,
        nowIndicator: true,
        height: 'auto',
        // Load events via backend
        events: async function(fetchInfo, successCallback, failureCallback) {
            try {
                const startDate = fetchInfo.startStr.slice(0,10);
                const endDate = fetchInfo.endStr.slice(0,10);
                const resp = await callBackend('listCalendarEvents', { startDate: startDate, endDate: endDate, calendarId: getConfiguredCalendarId(), maxResults: 500 });
                if (!resp || resp.success === false) {
                    if (resp) showBackendRawResponse(resp);
                    return successCallback([]);
                }
                const events = (resp.data && resp.data.events) ? resp.data.events.map(ev => ({
                    id: ev.id,
                    title: ev.title || '(sans titre)',
                    start: ev.start,
                    end: ev.end,
                    extendedProps: { description: ev.description, location: ev.location }
                })) : [];
                successCallback(events);
            } catch (e) { console.error('FullCalendar events load failed', e); failureCallback(e); }
        },
        dateClick: function(info) {
            // open form to create new event for clicked date
            openEventForm({ start: info.dateStr, end: info.dateStr });
            // prefill date/time
            const dateEl = document.getElementById('evtDate');
            const timeEl = document.getElementById('evtTime');
            if (dateEl) dateEl.value = info.dateStr.slice(0,10);
            if (timeEl) timeEl.value = '09:00';
        },
        eventClick: function(info) {
            // open edit form
            const ev = info.event;
            openEventForm({ id: ev.id, title: ev.title, start: ev.start.toISOString(), end: ev.end.toISOString(), description: ev.extendedProps && ev.extendedProps.description });
        },
        eventDrop: async function(info) {
            // update moved event
            try {
                const ev = info.event;
                const start = ev.start;
                const end = ev.end || new Date(start.getTime() + 60*60*1000);
                const duration = (end - start) / (1000*60*60);
                const payload = {
                    event: {
                        eventId: ev.id,
                        date: start.toISOString().slice(0,10),
                        time: start.toTimeString().slice(0,5),
                        duration: duration,
                        description: ev.title,
                        calendarId: getConfiguredCalendarId()
                    }
                };
                const resp = await callBackend('updateCalendarEvent', payload);
                if (!resp || resp.success === false) { showBackendRawResponse(resp); alert('Erreur mise à jour événement'); info.revert(); }
            } catch (e) { console.error('eventDrop update failed', e); info.revert(); }
        },
        eventResize: async function(info) {
            try {
                const ev = info.event;
                const start = ev.start;
                const end = ev.end;
                const duration = (end - start) / (1000*60*60);
                const payload = { event: { eventId: ev.id, date: start.toISOString().slice(0,10), time: start.toTimeString().slice(0,5), duration: duration, description: ev.title, calendarId: getConfiguredCalendarId() } };
                const resp = await callBackend('updateCalendarEvent', payload);
                if (!resp || resp.success === false) { showBackendRawResponse(resp); alert('Erreur mise à jour événement'); info.revert(); }
            } catch (e) { console.error('eventResize update failed', e); info.revert(); }
        }
    });

    calendar.render();

    // Expose refresh function to other parts (manager)
    window.mti_fullCalendar = calendar;
}

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
        async () => {
            // If this task has a calendar event, attempt to delete it server-side
            const task = tasks[index];
            if (task && task.eventId) {
                try {
                    // Provide a narrow search window to backend to help locate the event if getEventById fails
                    const startDate = (() => { const d = new Date(task.date); d.setDate(d.getDate() - 1); return d.toISOString().slice(0,10); })();
                    const endDate = (() => { const d = new Date(task.date); d.setDate(d.getDate() + 1); return d.toISOString().slice(0,10); })();
                    const resp = await callBackend('deleteCalendarEvent', { eventId: task.eventId, calendarId: getConfiguredCalendarId(), startDate: startDate, endDate: endDate });
                    if (!resp || resp.success === false) {
                        console.warn('deleteCalendarEvent initial failed', resp);
                        // Fallback: try to locate event by listing nearby events (±1 day) and match by title/description
                        try {
                            const startDate = (() => {
                                const d = new Date(task.date);
                                d.setDate(d.getDate() - 1);
                                return d.toISOString().slice(0,10);
                            })();
                            const endDate = (() => {
                                const d = new Date(task.date);
                                d.setDate(d.getDate() + 1);
                                return d.toISOString().slice(0,10);
                            })();
                            const eventsResp = await callBackend('listCalendarEvents', { startDate: startDate, endDate: endDate, calendarId: getConfiguredCalendarId() });
                            if (eventsResp && eventsResp.success && eventsResp.data && eventsResp.data.events) {
                                const cand = eventsResp.data.events.find(ev => {
                                    const titleMatch = task.description && ev.title && ev.title.includes(task.description);
                                    const descMatch = task.description && ev.description && ev.description.includes(task.description);
                                    return titleMatch || descMatch;
                                });
                                if (cand) {
                                    const del2 = await callBackend('deleteCalendarEvent', { eventId: cand.id, calendarId: getConfiguredCalendarId(), startDate: startDate, endDate: endDate });
                                    if (!del2 || del2.success === false) console.warn('Fallback delete also failed', del2);
                                }
                            }
                        } catch (e) { console.warn('Fallback search/delete failed', e); }
                    }
                } catch (e) {
                    console.warn('deleteCalendarEvent failed', e);
                }
            }

            // Remove locally regardless (we attempted server delete)
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
        `Envoyer la facture #${invoice.number} à ${contactName} (${client.email_facturation}) ?\n\nLe PDF sera généré et envoyé automatiquement via Drive.`,
        () => {
            // Attempt automatic send via Drive: generate PDF, save to Drive, then send from Drive
            sendInvoiceViaDrive(invoice, client.email_facturation)
                .catch(err => {
                    console.error('Envoi via Drive échoué:', err);
                    showToast('⚠️ Envoi via Drive échoué, ouverture du compose Gmail en fallback', 'error');
                    // Fallback to opening Gmail compose with PDF for manual send
                    openGmailComposeWithPDF(invoice, client.email_facturation).catch(e => {
                        console.error('Fallback compose failed:', e);
                        showEmailPreview();
                    });
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

// Logo file conversion to data URI
if (document.getElementById('convertLogoBtn') && document.getElementById('logoFileInput')) {
    document.getElementById('convertLogoBtn').addEventListener('click', async () => {
        const fileInput = document.getElementById('logoFileInput');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            alert('Sélectionnez un fichier image d\'abord');
            return;
        }
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(evt) {
            const dataUri = evt.target.result;
            // Set into the logo URL field and companyInfo
            const logoEl = document.getElementById('logoUrl');
            if (logoEl) {
                logoEl.value = dataUri;
                companyInfo.logoUrl = dataUri;
            }
            // Save settings automatically
            saveSettings();
            showToast('✅ Logo converti et enregistré (data‑URI)', 'success');
        };
        reader.onerror = function(err) {
            console.error('FileReader error', err);
            alert('Impossible de lire le fichier image');
        };
        reader.readAsDataURL(file);
    });
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

        // Prepare task data for sync - include eventId so we can filter already-synced tasks
        const taskData = tasks.map(task => ({
            date: task.date,
            startTime: task.startTime,
            duration: task.duration,
            description: task.description,
            type: task.type,
            eventId: task.eventId || null
        }));

        try {
            // Only sync tasks that don't already have an eventId to avoid duplicates
            const tasksToSync = taskData.filter(t => !t.eventId);
            if (tasksToSync.length === 0) {
                showToast('📅 Aucun nouvel événement à synchroniser', 'info');
            } else {
                const result = await callBackend('sync_calendar', { tasks: tasksToSync, calendarId: getConfiguredCalendarId() });
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

                // Additionally, fetch events from the calendar for the range and remove local tasks whose eventId no longer exists (handle deletions on the calendar)
                try {
                    // compute date range from tasks
                    const dates = tasks.map(t => t.date).filter(Boolean).sort();
                    const startDate = dates.length ? dates[0] : formatDate(new Date());
                    const endDate = dates.length ? dates[dates.length - 1] : formatDate(new Date());
                    const eventsResp = await callBackend('listCalendarEvents', { startDate: startDate, endDate: endDate, calendarId: getConfiguredCalendarId() });
                    if (eventsResp && eventsResp.success) {
                        const remoteIds = new Set((eventsResp.data && eventsResp.data.events || []).map(e => e.id));
                        // Remove tasks that have an eventId but that event is not present remotely
                        let removed = 0;
                        for (let i = tasks.length - 1; i >= 0; i--) {
                            const t = tasks[i];
                            if (t && t.eventId && !remoteIds.has(t.eventId)) {
                                tasks.splice(i, 1);
                                removed++;
                            }
                        }
                        if (removed > 0) {
                            await saveToDrive();
                            renderCalendar();
                            showToast(`✅ ${removed} tâche(s) supprimée(s) (événements absents du calendrier)`,'info');
                        }
                    }
                } catch (cleanupErr) {
                    console.warn('Cleanup calendar deletions failed:', cleanupErr);
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

// Save invoice PDF to Drive (without sending email) - returns { fileId, fileName, fileUrl }
async function saveInvoicePdfToDrive(invoice) {
    if (!invoice) throw new Error('Invoice missing');
    
    // Generate PDF base64
    const pdfBase64 = await generateInvoicePDFBase64(invoice);
    
    // Save to Drive via backend
    const saveRes = await callBackend('savePdfToDrive', { 
        pdfBase64: pdfBase64, 
        pdfFilename: `Facture_${invoice.number}.pdf`, 
        folderName: 'Factures' 
    });
    
    if (!saveRes || saveRes.success === false) {
        try { showBackendRawResponse(saveRes); } catch (e) {}
        throw new Error((saveRes && (saveRes.data || saveRes.error)) || 'Erreur sauvegarde PDF sur Drive');
    }
    
    const fileId = saveRes.data && saveRes.data.fileId;
    const fileUrl = saveRes.data && saveRes.data.fileUrl;
    if (!fileId) throw new Error('savePdfToDrive n\'a pas retourné fileId');
    
    return { fileId, fileName: `Facture_${invoice.number}.pdf`, fileUrl };
}

// Preferred flow: generate PDF, save to Drive, then send email attaching that Drive file
async function sendInvoiceViaDrive(invoice, toEmail) {
    if (!invoice) throw new Error('Invoice missing');
    const client = clients.find(c => c.name === invoice.client) || {};
    const subject = `Facture ${invoice.number} - MTI CONSULTING`;
    const body = generateEmailBody(invoice, client || { name: invoice.client });

    // Generate PDF base64
    const pdfBase64 = await generateInvoicePDFBase64(invoice);

    // Save to Drive via backend
    const saveRes = await callBackend('savePdfToDrive', { pdfBase64: pdfBase64, pdfFilename: `Facture_${invoice.number}.pdf`, folderName: 'Factures' });
    if (!saveRes || saveRes.success === false) {
        try { showBackendRawResponse(saveRes); } catch (e) {}
        throw new Error((saveRes && (saveRes.data || saveRes.error)) || 'Erreur sauvegarde PDF sur Drive');
    }

    const fileId = saveRes.data && saveRes.data.fileId;
    if (!fileId) throw new Error('savePdfToDrive n\'a pas retourné fileId');

    // Send email by referencing Drive file
    const sendRes = await callBackend('sendEmailWithDriveFile', { to: toEmail, subject: subject, body: body, fileId: fileId, fileName: `Facture_${invoice.number}.pdf` });
    if (!sendRes || sendRes.success === false) {
        try { showBackendRawResponse(sendRes); } catch (e) {}
        throw new Error((sendRes && (sendRes.data || sendRes.error)) || 'Erreur envoi email via Drive');
    }

    // Mark invoice sent and persist
    try {
        const idx = invoices.findIndex(inv => inv.number === invoice.number && inv.client === invoice.client);
        if (idx >= 0) {
            invoices[idx].status = 'Envoyée';
            await saveToDrive();
            renderInvoiceList();
        }
    } catch (e) { console.warn('Impossible de marquer/sauver la facture après envoi Drive:', e); }

    showToast('✅ Email envoyé avec pièce jointe depuis Drive', 'success');
    return sendRes;
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

// Confirm action: execute the stored callback (supports async), disable button while running
document.getElementById('confirmAction')?.addEventListener('click', async () => {
    const btn = document.getElementById('confirmAction');
    try {
        if (btn) { btn.disabled = true; }
        if (confirmCallback) {
            // If callback returns a promise, await it
            const res = confirmCallback();
            if (res && typeof res.then === 'function') {
                await res;
            }
        }
    } catch (err) {
        console.error('Erreur lors de l\'action confirmée:', err);
        showToast('Erreur lors de l\'action', 'error');
    } finally {
        document.getElementById('confirmModal')?.classList.remove('show');
        confirmCallback = null;
        if (btn) { btn.disabled = false; btn.style.backgroundColor = ''; btn.style.color = ''; }
    }
});

// --- Send mode helpers and preview/confirm flow ---
function getSendMode() {
    return localStorage.getItem(SEND_MODE_KEY) || 'drive';
}

function setSendMode(mode) {
    if (mode !== 'drive' && mode !== 'manual') return;
    localStorage.setItem(SEND_MODE_KEY, mode);
    const sel = document.getElementById('sendModeSelect');
    if (sel) sel.value = mode;
}

function initSendModeUI() {
    const sel = document.getElementById('sendModeSelect');
    if (!sel) return;
    sel.value = getSendMode();
    sel.addEventListener('change', (e) => setSendMode(e.target.value));
}

function openGmailComposePrefilled(to, subject, body) {
    try {
        const url = 'https://mail.google.com/mail/?view=cm&fs=1'
            + '&to=' + encodeURIComponent(to || '')
            + '&su=' + encodeURIComponent(subject || '')
            + '&body=' + encodeURIComponent(body || '');
        window.open(url, '_blank');
        return true;
    } catch (e) {
        console.error('Impossible d\'ouvrir Gmail compose:', e);
        return false;
    }
}

async function saveInvoicesAndRefreshUI() {
    try {
        await saveToDrive();
    } catch (e) { console.warn('saveToDrive failed', e); }
    try { renderInvoiceList(); } catch (e) {}
    try { applyFilters(); } catch (e) {}
    try { renderCharts(); } catch (e) {}
}

function getCurrentInvoiceForPreview() {
    // Build an invoice object from the form fields (same structure used elsewhere)
    try {
        const clientNameEl = document.getElementById('clientName');
        const clientAddressEl = document.getElementById('clientAddress');
        const clientSiretEl = document.getElementById('clientSiret');
        const serviceDescriptionEl = document.getElementById('serviceDescription');
        const quantityEl = document.getElementById('quantity');
        const unitPriceEl = document.getElementById('unitPrice');

        const invoice = {
            number: invoiceNumberInput ? invoiceNumberInput.value : getNextInvoiceNumber(),
            client: clientNameEl ? clientNameEl.value : '',
            clientSiret: clientSiretEl ? clientSiretEl.value : '',
            clientAddress: clientAddressEl ? clientAddressEl.value : '',
            date: invoiceDateInput ? invoiceDateInput.value : '',
            dueDate: dueDateInput ? dueDateInput.value : '',
            description: serviceDescriptionEl ? serviceDescriptionEl.value : '',
            quantity: quantityEl ? parseFloat(quantityEl.value) : 0,
            unitPrice: unitPriceEl ? parseFloat(unitPriceEl.value) : 0,
            total: calculateTotal(),
            clientEmail: (clients.find(c => c.name === (clientNameEl ? clientNameEl.value : '')) || {}).email_facturation || ''
        };
        return invoice;
    } catch (e) {
        console.error('getCurrentInvoiceForPreview error', e);
        return null;
    }
}

// Preview & confirm flow: (1) generate and save PDF to Drive (replacing existing), (2) open Drive PDF in new tab for preview, (3) show email modal with unified body for review, (4) on confirm send via backend or open compose
async function previewAndConfirmSend(invoice) {
    if (!invoice) throw new Error('Invoice missing');

    // Ensure the preview DOM matches the invoice
    try {
        renderInvoicePreview(invoice, true); // Show modal preview
    } catch (e) {
        console.warn('renderInvoicePreview failed', e);
    }

    // Prepare email preview using the unified body (same as list send)
    const clientObj = clients.find(c => c.name === invoice.client) || { name: invoice.client, contact_name: invoice.client };
    const to = clientObj.email_facturation || invoice.clientEmail || '';
    const subject = `Facture ${invoice.number} - MTI CONSULTING`;
    const body = generateEmailBody(invoice, clientObj);

    // Store current invoice data for the email confirmation modal
    // Note: PDF will be generated by sendInvoiceViaDrive when user confirms
    currentInvoiceData = {
        clientName: invoice.client,
        clientSiret: invoice.clientSiret,
        clientAddress: invoice.clientAddress,
        invoiceNumber: invoice.number,
        invoiceDate: invoice.date,
        dueDate: invoice.dueDate,
        description: invoice.description,
        quantity: invoice.quantity,
        unitPrice: invoice.unitPrice,
        total: invoice.total,
        client: clientObj,
        fileId: null, // Will be generated on send
        pdfFilename: `Facture_${invoice.number}.pdf`
    };

    // Show email preview modal (user can review/edit before confirming)
    showEmailPreviewForConfirmSend(to, subject, body);
}

function showEmailPreviewForConfirmSend(to, subject, body) {
    const emailToEl = document.getElementById('emailTo');
    const emailSubjectEl = document.getElementById('emailSubject');
    const emailBodyEl = document.getElementById('emailBody');
    if (emailToEl) emailToEl.textContent = to || '(À compléter manuellement)';
    if (emailSubjectEl) emailSubjectEl.textContent = subject;
    if (emailBodyEl) emailBodyEl.textContent = body;

    const hasEmail = to && to.trim() !== '';
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

function setupEmailPreviewHandlersForConfirmSend() {
    const confirmEmail = document.getElementById('confirmEmail');
    if (confirmEmail) {
        // Remove old listener and bind new one
        const newConfirm = confirmEmail.cloneNode(true);
        confirmEmail.parentNode.replaceChild(newConfirm, confirmEmail);
        newConfirm.addEventListener('click', async () => {
            if (!currentInvoiceData) return;
            const { client } = currentInvoiceData;
            const to = client && client.email_facturation ? client.email_facturation : '';
            const subject = `Facture ${currentInvoiceData.invoiceNumber} - MTI CONSULTING`;
            
            // Reconstruct full invoice object for sendInvoiceViaDrive
            const invoice = {
                number: currentInvoiceData.invoiceNumber,
                client: currentInvoiceData.clientName,
                clientSiret: currentInvoiceData.clientSiret || (client && client.siret),
                clientAddress: currentInvoiceData.clientAddress || (client && client.address),
                date: currentInvoiceData.invoiceDate,
                dueDate: currentInvoiceData.dueDate,
                description: currentInvoiceData.description,
                quantity: currentInvoiceData.quantity,
                unitPrice: currentInvoiceData.unitPrice,
                total: currentInvoiceData.total
            };

            const mode = getSendMode();
            if (mode === 'drive') {
                try {
                    // Use the same flow as "Liste des Factures": sendInvoiceViaDrive
                    await sendInvoiceViaDrive(invoice, to);
                    showToast('✅ Email envoyé avec pièce jointe depuis Drive', 'success');
                } catch (err) {
                    console.error('Envoi via Drive failed:', err);
                    const proceed = confirm('Envoi via serveur échoué. Voulez-vous ouvrir la fenêtre de composition Gmail pour attacher manuellement le PDF ?');
                    if (proceed) {
                        const body = generateEmailBody(invoice, client);
                        openGmailComposePrefilled(to, subject, body);
                    }
                }
            } else {
                // manual mode: save PDF to Drive first, then open Gmail compose with Drive link
                try {
                    showToast('💾 Génération et sauvegarde du PDF sur Drive...', 'info');
                    const { fileId, fileName, fileUrl } = await saveInvoicePdfToDrive(invoice);
                    
                    // Include Drive link in email body so user can easily attach the file
                    const body = generateEmailBody(invoice, client) + 
                        `\n\n📎 Votre facture a été sauvegardée sur Drive:\n${fileUrl}\n\n` +
                        `⚠️ Veuillez attacher manuellement le fichier "${fileName}" depuis votre Drive avant d'envoyer cet email.`;
                    
                    openGmailComposePrefilled(to, subject, body);
                    showToast('✅ PDF sauvegardé sur Drive. Gmail Compose ouvert - attachez manuellement le fichier.', 'success');
                } catch (err) {
                    console.error('Mode manuel - sauvegarde Drive failed:', err);
                    showToast('❌ Erreur lors de la sauvegarde du PDF sur Drive', 'error');
                }
            }
            const modal = document.getElementById('emailModal');
            if (modal) modal.classList.remove('show');
        });
    }
}function initPreviewConfirmButton() {
    const btn = document.getElementById('previewConfirmSendBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const invoice = getCurrentInvoiceForPreview();
        if (!invoice) { alert('Aucune facture trouvée pour prévisualisation'); return; }
        try { await previewAndConfirmSend(invoice); } catch (e) { console.error('previewAndConfirmSend failed', e); alert('Erreur lors de la préparation de l\'envoi'); }
    });
    setupEmailPreviewHandlersForConfirmSend();
}

// PDF Download functionality using iframe print fallback
function buildInvoiceHtml({clientName, clientAddress, invoiceNumber, invoiceDate, dueDate, description, quantity, unitPrice, total, tvaEnabled}) {
    const totalHT = total;
    const tva = tvaEnabled ? totalHT * 0.20 : 0;
    const totalTTC = totalHT + tva;

    const companyAddressLine = companyInfo.address && companyInfo.postalCode && companyInfo.city
        ? `${companyInfo.address}, ${companyInfo.postalCode} ${companyInfo.city}`
        : '[À compléter dans Paramètres]';

    // Use local logo file or data-URI if available
    const logoSrc = companyInfo.logoUrl && (companyInfo.logoUrl.startsWith('data:') || !companyInfo.logoUrl.includes('github')) 
        ? companyInfo.logoUrl 
        : 'MTI_CONSULTING.png';
    const logoHTML = logoSrc
        ? `<img src="${logoSrc}" style="max-width: 150px; max-height: 80px; object-fit: contain; margin-bottom: 10px;" crossorigin="anonymous">`
        : '';

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, Helvetica, sans-serif; color: #222; margin: 18px; }
        .page-container { max-width: 800px; margin: 0 auto; position: relative; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; }
        .header-left { max-width: 60%; }
        .header-right { text-align: right; }
        .company { font-weight: bold; font-size: 16px; margin-bottom: 6px; }
        .separator { border: none; border-top: 1px solid #ddd; margin: 10px 0; clear: both; }
        .invoice-details { margin-top: 20px; margin-bottom: 12px; line-height: 1.5; }
        .invoice-number { font-size: 18px; font-weight: bold; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f5f5f5; font-weight: bold; font-size: 11px; }
        td { font-size: 11px; height: 25px; }
        .totals { text-align: right; margin-top: 10px; padding-top: 10px; border-top: 2px solid #5E5240; font-size: 13px; }
        .legal { position: absolute; bottom: 0; left: 0; right: 0; font-size: 7.5px; color: #666; line-height: 1.3; background: #f9f9f9; padding: 6px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="page-container">
        <div class="header">
            <div class="header-left">
                ${logoHTML}
                <div class="company">${companyInfo.name}</div>
                <div style="font-size: 12px; line-height: 1.5; margin-top: 4px;">${companyAddressLine}</div>
                <div style="font-size: 12px; margin-top: 4px;">SIRET: ${companyInfo.siret || ''}</div>
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
</html>`;
}

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

    const pdfContent = buildInvoiceHtml({
        clientName, clientAddress, invoiceNumber, invoiceDate, dueDate, description, quantity, unitPrice, total, tvaEnabled
    });
    

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

// Download PDF button: generate, save to Drive (replacing existing), open Drive PDF for preview
document.getElementById('downloadPDF')?.addEventListener('click', async () => {
    const invoice = getCurrentInvoiceForPreview();
    if (!invoice) { alert('Aucune facture pour téléchargement'); return; }
    try {
        renderInvoicePreview(invoice, false);
    } catch (e) { console.warn('renderInvoicePreview failed', e); }
    try {
        const pdfBase64 = await generateInvoicePDFBase64(invoice);
        const pdfFilename = 'Facture_' + (invoice.number || Date.now()) + '.pdf';
        const saveResp = await callBackend('savePdfToDrive', { pdfBase64: pdfBase64, pdfFilename: pdfFilename, folderName: 'Factures' });
        if (!saveResp || saveResp.success === false) {
            try { showBackendRawResponse(saveResp); } catch (e) {}
            alert('Impossible de sauvegarder la facture sur Drive.');
            return;
        }
        const fileUrl = saveResp.data && saveResp.data.fileUrl;
        if (fileUrl) {
            window.open(fileUrl, '_blank');
            showToast('✅ Facture sauvegardée et ouverte depuis Drive');
        }
    } catch (e) { console.error('downloadPDF failed', e); alert('Erreur lors de la génération du PDF'); }
});

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

    // Initialize send mode UI and preview-confirm button
    try { initSendModeUI(); } catch (e) { console.warn('initSendModeUI failed', e); }
    try { initPreviewConfirmButton(); } catch (e) { console.warn('initPreviewConfirmButton failed', e); }

    // Calendar view toggle: switch between FullCalendar (Google) and app calendar (day/week/month views)
    try {
        const toggleViewBtn = document.getElementById('toggleCalendarViewBtn');
        if (toggleViewBtn) {
            console.log('✅ toggleCalendarViewBtn found, attaching listener');
            toggleViewBtn.addEventListener('click', () => {
                console.log('🔄 Toggle calendar view clicked, current useAppCalendar:', useAppCalendar);
                const fcContainer = document.getElementById('calendarContainer');
                const appContainer = document.getElementById('appCalendarContainer');
                if (!fcContainer || !appContainer) {
                    console.warn('Calendar containers not found:', { fcContainer, appContainer });
                    return;
                }
                useAppCalendar = !useAppCalendar;
                console.log('🔄 Switching to', useAppCalendar ? 'app calendar' : 'Google calendar');
                if (useAppCalendar) {
                    // switch to app calendar
                    fcContainer.style.display = 'none';
                    appContainer.style.display = 'block';
                    renderCalendar(); // will render into appCalendarContainer (via useAppCalendar flag)
                    toggleViewBtn.textContent = '🔄 Afficher calendrier Google';
                } else {
                    // switch to FullCalendar (Google)
                    fcContainer.style.display = 'block';
                    appContainer.style.display = 'none';
                    if (window.mti_fullCalendar) window.mti_fullCalendar.refetchEvents();
                    toggleViewBtn.textContent = '🔄 Afficher calendrier de l\'appli';
                }
            });
        } else {
            console.warn('❌ toggleCalendarViewBtn NOT FOUND in DOM');
        }
    } catch (e) { console.warn('calendar view toggle init failed', e); }

    // Calendar embed toggle init (small widget to show Google Calendar iframe)
    try {
        const toggleBtn = document.getElementById('toggleCalendarEmbedBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const container = document.getElementById('calendarEmbedContainer');
                if (!container) return;
                if (container.style.display === 'none' || container.style.display === '') {
                    // show and set src
                    const calId = getConfiguredCalendarId() || 'primary';
                    const iframe = document.getElementById('calendarEmbed');
                    if (iframe) {
                        iframe.src = 'https://calendar.google.com/calendar/embed?src=' + encodeURIComponent(calId) + '&ctz=Europe%2FParis';
                    }
                    container.style.display = 'block';
                    toggleBtn.textContent = '🗓️ Masquer calendrier intégré';
                } else {
                    container.style.display = 'none';
                    toggleBtn.textContent = '🗓️ Afficher calendrier intégré';
                }
            });
        }
    } catch (e) { console.warn('calendar embed init failed', e); }

    // Initialize calendar manager (interactive event create/modify/delete)
    try { initCalendarManager(); } catch (e) { console.warn('initCalendarManager failed', e); }
    try { initFullCalendar(); } catch (e) { console.warn('initFullCalendar failed', e); }

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

        // Mark invoice as sent and persist
        try {
            invoices[index].status = 'Envoyée';
            await saveToDrive();
            renderInvoiceList();
        } catch (e) { console.warn('Impossible de marquer/sauver la facture après envoi automatique:', e); }

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
    // Helper: try to fetch an image URL and convert to data URI (best-effort, may fail due to CORS)
    async function fetchImageAsDataUri(url) {
        if (!url) return null;
        if (url.startsWith('data:')) return url;
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('Image fetch failed');
            const blob = await resp.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn('fetchImageAsDataUri failed for', url, e);
            return null;
        }
    }
    // Build HTML for the invoice. Prefer using the on-page preview DOM if present
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = 'auto';
    tempContainer.style.padding = '0';

    // Try to fetch logo as data URI to avoid CORS issues when rendering canvas
    let originalLogo = companyInfo.logoUrl;
    let logoDataUri = null;
    try {
        // Use local logo file instead of GitHub URL
        const logoSrc = companyInfo.logoUrl && !companyInfo.logoUrl.includes('github') ? companyInfo.logoUrl : 'MTI_CONSULTING.png';
        logoDataUri = await fetchImageAsDataUri(logoSrc);
        if (logoDataUri) companyInfo.logoUrl = logoDataUri;
    } catch (e) {
        console.warn('Could not inline logo', e);
        // Fallback: try local file
        try {
            logoDataUri = await fetchImageAsDataUri('MTI_CONSULTING.png');
            if (logoDataUri) companyInfo.logoUrl = logoDataUri;
        } catch (e2) {
            console.warn('Fallback logo load failed', e2);
        }
    }

    try {
        const previewNode = document.getElementById('invoicePreviewContent');
        if (previewNode && previewNode.innerHTML && previewNode.innerHTML.trim().length > 0) {
            // Clone the existing preview so PDF exactly matches the UI
            const clone = previewNode.cloneNode(true);
            // Ensure images in clone reference inlined logo if present
            if (companyInfo.logoUrl && companyInfo.logoUrl.startsWith('data:')) {
                const imgs = clone.querySelectorAll('img');
                imgs.forEach(img => { if (img.src && img.src.indexOf('blob:') === -1) img.src = companyInfo.logoUrl; });
            }
            tempContainer.appendChild(clone);
        } else {
            // Fallback: use shared HTML builder
            tempContainer.innerHTML = buildInvoiceHtml({
                clientName: invoice.client || '',
                clientAddress: invoice.clientAddress || '',
                invoiceNumber: invoice.number || '',
                invoiceDate: invoice.date || '',
                dueDate: invoice.dueDate || '',
                description: invoice.description || '',
                quantity: invoice.quantity || 0,
                unitPrice: invoice.unitPrice || 0,
                total: invoice.total || 0,
                tvaEnabled: document.getElementById('tvaToggle') && document.getElementById('tvaToggle').checked
            });
        }
    } finally {
        // restore original logo setting
        companyInfo.logoUrl = originalLogo;
    }

    document.body.appendChild(tempContainer);

    // If html2canvas is available, use it for faithful rendering
    if (window.html2canvas && window.jspdf) {
        try {
            // Render with html2canvas. Use moderate scale for good quality without excessive file size.
            // Reduced from 2.5 to 1.5 to optimize PDF size (21 Mo → ~200-300 Ko)
            const canvasScale = 1.5;
            // Compute printable width in px so layout matches A4 printable area
            const { jsPDF } = window.jspdf;
            const pdfForCalc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdfForCalc.internal.pageSize.getWidth();
            const pageHeight = pdfForCalc.internal.pageSize.getHeight();
            const margin = 8; // mm
            const printableWidthMm = pageWidth - margin * 2;
            const effectiveDpi = 96 * canvasScale;
            const printableWidthPx = Math.round(printableWidthMm * effectiveDpi / 25.4);
            // Apply printable width to temp container before rendering
            tempContainer.style.width = printableWidthPx + 'px';

            const canvas = await html2canvas(tempContainer, { scale: canvasScale, useCORS: true, backgroundColor: '#ffffff' });
            // Use JPEG with 0.85 quality for much smaller file size while preserving visual quality
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            const pdf = new jsPDF('p', 'mm', 'a4');

            // canvas dimensions in px
            const imgProps = { width: canvas.width, height: canvas.height };
            // Convert px -> mm taking canvas scale (effective DPI = 96 * scale)
            const pxToMm = (px) => px * 25.4 / effectiveDpi;
            const imgWidthMm = pxToMm(imgProps.width);
            const imgHeightMm = pxToMm(imgProps.height);

            let renderWidth = printableWidthMm;
            // scale so width fits the printable area
            let scale = renderWidth / imgWidthMm;
            let totalHeightMm = imgHeightMm * scale;

            // If image is taller than a single page, split into multiple pages
            const imgDataType = 'JPEG';

            // Create an offscreen canvas to slice the image if necessary
            const tmpCanvas = document.createElement('canvas');
            const tmpCtx = tmpCanvas.getContext('2d');
            tmpCanvas.width = canvas.width;
            tmpCanvas.height = canvas.height;
            tmpCtx.drawImage(canvas, 0, 0);

            // Height in source pixels corresponding to one PDF page (in px). We reverse pxToMm.
            const pageHeightPx = Math.round((pageHeight - margin * 2) / scale * (effectiveDpi / 25.4));
            let startPx = 0;
            while (startPx < canvas.height) {
                const sliceHeightPx = Math.min(pageHeightPx, canvas.height - startPx);
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = sliceHeightPx;
                const sc = sliceCanvas.getContext('2d');
                sc.drawImage(canvas, 0, startPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
                const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.85);
                const sliceHeightMm = pxToMm(sliceHeightPx) * scale;

                // center horizontally
                const drawX = (pageWidth - renderWidth) / 2;
                const drawY = margin;
                pdf.addImage(sliceData, imgDataType, drawX, drawY, renderWidth, sliceHeightMm);

                startPx += sliceHeightPx;
                if (startPx < canvas.height) pdf.addPage();
            }
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

    // Logo - try to inline as data URI first
    if (companyInfo.logoUrl) {
        try {
            const dataUri = await (async function(){
                try { return await fetchImageAsDataUri(companyInfo.logoUrl); } catch(e){ return null; }
            })();
            const imgToUse = dataUri || companyInfo.logoUrl;
            if (imgToUse) {
                try { doc.addImage(imgToUse, 'PNG', 20, 20, 30, 30); } catch(e) { /* ignore */ }
            }
        } catch(e) { /* ignore */ }
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
