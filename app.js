// MTI CONSULTING - Application de facturation
// Version v2.0 - Google Drive Storage + Gmail API + Calendar API + FullCalendar

// Configuration par défaut (valeurs d'exemple)
// IMPORTANT : Créez un fichier config.js à la racine avec vos vraies valeurs
// Voir config.example.js pour le template
const CONFIG_DEFAULTS = {
    BACKEND_URL: 'https://script.google.com/macros/s/VOTRE_SCRIPT_ID/exec',
    DRIVE_FILE_NAME: 'mti_data.json',
    SHEETS_ID: 'VOTRE_SHEETS_ID',
    CALENDAR_ID: 'votre-email@gmail.com',
    // OAuth2 credentials for FullCalendar + Google Calendar API integration
    GOOGLE_CLIENT_ID: 'VOTRE_CLIENT_ID.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'VOTRE_CLIENT_SECRET',
    GOOGLE_API_KEY: '', // Optional
    GOOGLE_SCOPES: 'https://www.googleapis.com/auth/calendar.events'
};

// Fusionner avec les valeurs réelles de config.js (si le fichier existe)
const CONFIG = typeof window !== 'undefined' && window.CONFIG 
    ? { ...CONFIG_DEFAULTS, ...window.CONFIG } 
    : CONFIG_DEFAULTS;

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
    phone: '07 77 37 17 39',
    iban: '', // IBAN professionnel affiché en footer de facture
    bic: ''   // BIC (Code SWIFT) de la banque
};

// Tax rates - now stored in memory, editable via settings
let taxSettings = {
    tauxIS: 0,
    versementLiberatoire: 2.2,
    prorationMensuelle: 8.33,
    cfeAnnuel: 600,
    acreActif: 11.6,
    acreInactif: 24.6,
    // Barème IRPP progressif 2025 (tranches annuelles - célibataire 1 part)
    // Source : https://www.service-public.gouv.fr/particuliers/vosdroits/F1419
    irppBareme: [
        { min: 0, max: 11497, taux: 0 },
        { min: 11498, max: 29315, taux: 11 },
        { min: 29316, max: 83823, taux: 30 },
        { min: 83824, max: 180294, taux: 41 },
        { min: 180295, max: Infinity, taux: 45 }
    ],
    // BNC (Bénéfices Non Commerciaux) - abattement forfaitaire
    bncAbattement: 34
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
    acreInactif: 24.6,
    irppBareme: [
        { min: 0, max: 11497, taux: 0 },
        { min: 11498, max: 29315, taux: 11 },
        { min: 29316, max: 83823, taux: 30 },
        { min: 83824, max: 180294, taux: 41 },
        { min: 180295, max: Infinity, taux: 45 }
    ],
    bncAbattement: 34
};

// ========== CALCUL IRPP PROGRESSIF ==========

/**
 * Calcule l'IRPP selon le barème progressif
 * @param {number} revenuImposable - Revenu annuel imposable (après abattement BNC si applicable)
 * @param {Array} bareme - Barème IRPP (tranches avec min, max, taux)
 * @returns {number} Montant de l'impôt annuel
 */
function calculateIRPPProgressif(revenuImposable, bareme = null) {
    if (!bareme) bareme = taxSettings.irppBareme;
    // Sécurité : vérifier que le barème existe et est un tableau
    if (!bareme || !Array.isArray(bareme) || bareme.length === 0) {
        console.warn('calculateIRPPProgressif: barème IRPP non disponible, utilisation du barème par défaut');
        bareme = defaultSettings.irppBareme;
    }
    if (revenuImposable <= 0) return 0;

    let impot = 0;
    for (let i = 0; i < bareme.length; i++) {
        const tranche = bareme[i];
        const min = tranche.min;
        const max = tranche.max === Infinity ? Infinity : tranche.max;
        const taux = tranche.taux / 100;

        if (revenuImposable <= min) break;

        const trancheMax = Math.min(revenuImposable, max);
        const montantTranche = trancheMax - min + 1; // +1 car bornes inclusives
        if (montantTranche > 0) {
            impot += montantTranche * taux;
        }

        if (revenuImposable <= max) break;
    }

    return Math.max(0, impot);
}

/**
 * Calcule le revenu imposable BNC (après abattement forfaitaire)
 * @param {number} caAnnuel - Chiffre d'affaires annuel
 * @param {number} abattement - Taux d'abattement (défaut 34%)
 * @returns {number} Revenu imposable
 */
function calculateBNCRevenuImposable(caAnnuel, abattement = null) {
    if (!abattement) abattement = taxSettings.bncAbattement || defaultSettings.bncAbattement || 34;
    const revenuImposable = caAnnuel * (1 - abattement / 100);
    return Math.max(0, revenuImposable);
}

/**
 * Compare versement libératoire vs IRPP progressif
 * @param {number} caAnnuel - Chiffre d'affaires annuel
 * @returns {Object} { versementLib, irppProgressif, difference, meilleurChoix }
 */
function compareImpots(caAnnuel) {
    // Versement libératoire : taux fixe sur CA
    const versementLib = caAnnuel * (taxSettings.versementLiberatoire / 100);

    // IRPP progressif : appliqué sur revenu imposable BNC
    const revenuImposable = calculateBNCRevenuImposable(caAnnuel);
    const irppProgressif = calculateIRPPProgressif(revenuImposable);

    const difference = versementLib - irppProgressif;
    const meilleurChoix = difference > 0 ? 'progressif' : 'versementLib';

    return {
        versementLib,
        irppProgressif,
        revenuImposable,
        difference,
        meilleurChoix,
        economie: Math.abs(difference)
    };
}

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

    // Use local logo file (assets/images/MTI_CONSULTING.png) or configured URL
    const logoSrc = companyInfo.logoUrl && !companyInfo.logoUrl.includes('github') ? companyInfo.logoUrl : 'assets/images/MTI_CONSULTING.png';
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

        <div class="invoice-total" style="margin-bottom: 30px;">
            ${tvaEnabled ? `<div>Total HT: ${totalHT.toFixed(2)} €</div><div>TVA (20%): ${tva.toFixed(2)} €</div><div><strong>Total TTC: ${totalTTC.toFixed(2)} €</strong></div>` : `<div>Total HT: ${totalHT.toFixed(2)} €</div><div>TVA non applicable (art. 293 B du CGI)</div><div><strong>Total TTC: ${totalHT.toFixed(2)} €</strong></div>`}
        </div>

        <div class="invoice-legal" style="margin-top: 30px; clear: both;"><p>Dispensé d'immatriculation RCS/RM | TVA non applicable art. 293B CGI | Conditions: Paiement à 30 jours</p><p>Retard: indemnité forfaitaire 40€ + intérêts au taux légal | Escompte: néant</p></div>
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
    // Use multi-line items if available
    let totalHT = 0;
    
    if (currentInvoiceItems && currentInvoiceItems.length > 0) {
        totalHT = currentInvoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);
    } else if (quantityInput && unitPriceInput) {
        // Legacy fallback for old single-line logic
        const quantity = parseFloat(quantityInput.value) || 0;
        const unitPrice = parseFloat(unitPriceInput.value) || 0;
        totalHT = quantity * unitPrice;
    }

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

// ========== MULTI-LINE INVOICE ITEMS MANAGEMENT ==========

let currentInvoiceItems = [];

function addInvoiceItem() {
    const item = {
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0
    };
    currentInvoiceItems.push(item);
    renderInvoiceItems();
}

function removeInvoiceItem(index) {
    currentInvoiceItems.splice(index, 1);
    renderInvoiceItems();
    updateInvoiceTotal();
}

function updateInvoiceItemField(index, field, value) {
    if (!currentInvoiceItems[index]) return;
    
    currentInvoiceItems[index][field] = value;
    
    // Recalculate item total
    if (field === 'quantity' || field === 'unitPrice') {
        const qty = parseFloat(currentInvoiceItems[index].quantity) || 0;
        const price = parseFloat(currentInvoiceItems[index].unitPrice) || 0;
        currentInvoiceItems[index].total = qty * price;
    }
    
    renderInvoiceItems();
    updateInvoiceTotal();
}

function renderInvoiceItems() {
    const tbody = document.getElementById('invoiceItemsBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (currentInvoiceItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 16px; text-align: center; color: var(--color-text-secondary); font-size: var(--font-size-sm);">Aucune ligne. Cliquez sur "➕ Ajouter une ligne" pour commencer.</td></tr>';
        return;
    }

    currentInvoiceItems.forEach((item, index) => {
        const row = document.createElement('tr');
        row.style.borderTop = '1px solid var(--color-border)';
        
        row.innerHTML = `
            <td style="padding: 8px;">
                <input type="text" 
                    value="${item.description || ''}" 
                    onchange="updateInvoiceItemField(${index}, 'description', this.value)"
                    placeholder="Description de la prestation"
                    style="width: 100%; padding: 6px; border: 1px solid var(--color-border); border-radius: 4px; font-size: var(--font-size-sm);">
            </td>
            <td style="padding: 8px; text-align: center;">
                <input type="number" 
                    value="${item.quantity}" 
                    onchange="updateInvoiceItemField(${index}, 'quantity', this.value)"
                    min="0.01"
                    step="0.01"
                    style="width: 100%; padding: 6px; border: 1px solid var(--color-border); border-radius: 4px; font-size: var(--font-size-sm); text-align: center;">
            </td>
            <td style="padding: 8px; text-align: right;">
                <input type="number" 
                    value="${item.unitPrice}" 
                    onchange="updateInvoiceItemField(${index}, 'unitPrice', this.value)"
                    min="0"
                    step="0.01"
                    style="width: 100%; padding: 6px; border: 1px solid var(--color-border); border-radius: 4px; font-size: var(--font-size-sm); text-align: right;">
            </td>
            <td style="padding: 8px; text-align: right; font-weight: 600; font-size: var(--font-size-sm);">
                ${item.total.toFixed(2)} €
            </td>
            <td style="padding: 8px; text-align: center;">
                <button type="button" 
                    onclick="removeInvoiceItem(${index})" 
                    style="background: #dc2626; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: var(--font-size-xs);"
                    title="Supprimer cette ligne">
                    🗑️
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function updateInvoiceTotal() {
    // Recalculate and update the invoice total display
    calculateTotal();
}

function clearInvoiceItems() {
    currentInvoiceItems = [];
    renderInvoiceItems();
    updateInvoiceTotal();
}

function loadInvoiceItems(items) {
    currentInvoiceItems = items && items.length > 0 ? [...items] : [];
    renderInvoiceItems();
    updateInvoiceTotal();
}

// Expose functions to global scope for HTML onclick handlers
window.addInvoiceItem = addInvoiceItem;
window.removeInvoiceItem = removeInvoiceItem;
window.updateInvoiceItemField = updateInvoiceItemField;

// ========== END MULTI-LINE INVOICE ITEMS ==========

// Save invoice
function setupInvoiceSaveHandler() {
    if (!invoiceForm) return;
    invoiceForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Validate that at least one item exists
        if (!currentInvoiceItems || currentInvoiceItems.length === 0) {
            showToast('⚠️ Veuillez ajouter au moins une ligne de facturation', 'error');
            return;
        }

        // Validate that all items have descriptions
        const hasEmptyDescription = currentInvoiceItems.some(item => !item.description || item.description.trim() === '');
        if (hasEmptyDescription) {
            showToast('⚠️ Toutes les lignes doivent avoir une description', 'error');
            return;
        }

        // Calculate total from items
        const totalHT = currentInvoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);

        const invoiceData = {
            number: invoiceNumberInput ? invoiceNumberInput.value : getNextInvoiceNumber(),
            client: document.getElementById('clientName') ? document.getElementById('clientName').value : '',
            clientSiret: document.getElementById('clientSiret') ? document.getElementById('clientSiret').value : '',
            clientAddress: document.getElementById('clientAddress') ? document.getElementById('clientAddress').value : '',
            date: invoiceDateInput ? invoiceDateInput.value : '',
            dueDate: dueDateInput ? dueDateInput.value : '',
            items: [...currentInvoiceItems], // Store items array
            // Keep legacy fields for backward compatibility
            description: currentInvoiceItems[0]?.description || '',
            quantity: currentInvoiceItems[0]?.quantity || 0,
            unitPrice: currentInvoiceItems[0]?.unitPrice || 0,
            total: totalHT
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
    
    // Clear invoice items and add one empty line
    clearInvoiceItems();
    addInvoiceItem();
    
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
    // Always render to appCalendarContainer (app's own calendar views)
    const container = document.getElementById('appCalendarContainer');
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
    // Always render to appCalendarContainer (app's own calendar views)
    const container = document.getElementById('appCalendarContainer');
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
    // Always render to appCalendarContainer (app's own calendar views)
    const container = document.getElementById('appCalendarContainer');
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

// ========================================
// GOOGLE CALENDAR API + FULLCALENDAR INTEGRATION
// Using Google Identity Services (GIS) - New OAuth2 method
// ========================================

let fullCalendarInstance = null;
let isGoogleAuthInitialized = false;
let isGoogleSignedIn = false;
let accessToken = null;
let tokenClient = null;

// Initialize Google Identity Services (GIS) for OAuth2
function initGoogleAuth() {
    // Check if running from file:// protocol (not supported by Google OAuth2)
    if (window.location.protocol === 'file:') {
        const errorMsg = `
⚠️ ERREUR : OAuth2 Google nécessite un serveur HTTP

Vous ne pouvez pas utiliser OAuth2 depuis file://

✅ SOLUTION : Servez l'application via HTTP

Option 1 (Python) :
  python -m http.server 8000
  Puis : http://localhost:8000/index.html

Option 2 (Node.js) :
  npx http-server -p 8000
  Puis : http://localhost:8000/index.html

Option 3 (VS Code) :
  Extension "Live Server" → Clic droit → "Open with Live Server"
        `;
        console.error(errorMsg);
        showToast('❌ OAuth2 impossible en mode file:// - Utilisez un serveur HTTP local', 'error');
        
        // Display alert with instructions
        const authBtn = document.getElementById('googleAuthBtn');
        if (authBtn) {
            authBtn.textContent = '⚠️ Serveur HTTP requis';
            authBtn.disabled = true;
            authBtn.style.cursor = 'not-allowed';
            authBtn.onclick = () => {
                alert(errorMsg);
            };
        }
        
        return Promise.reject(new Error('OAuth2 requires HTTP/HTTPS protocol'));
    }

    return new Promise((resolve, reject) => {
        // Initialize gapi client for Calendar API
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    apiKey: CONFIG.GOOGLE_API_KEY || '',
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
                });

                // Initialize Google Identity Services token client
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CONFIG.GOOGLE_CLIENT_ID,
                    scope: CONFIG.GOOGLE_SCOPES,
                    callback: (response) => {
                        if (response.error !== undefined) {
                            console.error('❌ Token error:', response);
                            updateSignInStatus(false);
                            reject(response);
                            return;
                        }
                        
                        // Token received successfully
                        accessToken = response.access_token;
                        gapi.client.setToken({ access_token: accessToken });
                        isGoogleSignedIn = true;
                        updateSignInStatus(true);
                        console.log('✅ Google Auth token received');
                        resolve(response);
                    }
                });

                isGoogleAuthInitialized = true;
                console.log('✅ Google Identity Services initialized');
                resolve(tokenClient);
            } catch (error) {
                console.error('❌ Error initializing Google Auth:', error);
                reject(error);
            }
        });
    });
}

// Handle sign-in/sign-out button
function handleAuthClick() {
    if (!isGoogleAuthInitialized) {
        showToast('Google Auth non initialisé', 'error');
        return;
    }

    if (isGoogleSignedIn) {
        // Sign out - revoke token
        google.accounts.oauth2.revoke(accessToken, () => {
            accessToken = null;
            gapi.client.setToken(null);
            isGoogleSignedIn = false;
            updateSignInStatus(false);
            console.log('✅ Signed out');
        });
    } else {
        // Sign in - request token
        if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    }
}

// Update UI based on sign-in status
function updateSignInStatus(signedIn) {
    isGoogleSignedIn = signedIn;
    const authBtn = document.getElementById('googleAuthBtn');
    const calendarContainer = document.getElementById('fullCalendarContainer');
    const notConnectedMsg = document.getElementById('calendarNotConnected');
    const calendarEl = document.getElementById('fullCalendar');

    if (authBtn) {
        if (signedIn) {
            authBtn.textContent = '✅ Connecté à Google';
            authBtn.className = 'btn btn-secondary';
            authBtn.onclick = handleAuthClick;
            if (calendarContainer) calendarContainer.style.display = 'block';
            
            // Hide "not connected" message and show calendar
            if (notConnectedMsg) notConnectedMsg.style.display = 'none';
            if (calendarEl) calendarEl.style.display = 'block';
            
            // Enable calendar editing
            if (fullCalendarInstance) {
                fullCalendarInstance.setOption('editable', true);
                fullCalendarInstance.setOption('selectable', true);
                fullCalendarInstance.refetchEvents();
            }
            showToast('Connecté à Google Calendar', 'success');
        } else {
            authBtn.textContent = '🔐 Se connecter à Google';
            authBtn.className = 'btn btn-primary';
            authBtn.onclick = handleAuthClick;
            
            // Show "not connected" message and hide calendar
            if (calendarContainer) calendarContainer.style.display = 'block'; // Keep container visible
            if (notConnectedMsg) notConnectedMsg.style.display = 'block';
            if (calendarEl) calendarEl.style.display = 'none';
            
            // Disable calendar editing
            if (fullCalendarInstance) {
                fullCalendarInstance.setOption('editable', false);
                fullCalendarInstance.setOption('selectable', false);
                fullCalendarInstance.refetchEvents();
            }
        }
    }
}

// Load events from Google Calendar API
async function loadGoogleCalendarEvents(fetchInfo, successCallback, failureCallback) {
    if (!isGoogleSignedIn) {
        // Return empty array instead of error when not connected
        // This prevents FullCalendar from showing errors on initial load
        console.log('ℹ️ Not connected to Google - returning empty calendar');
        successCallback([]);
        return;
    }

    try {
        const calendarId = getConfiguredCalendarId();
        const response = await gapi.client.calendar.events.list({
            calendarId: calendarId,
            timeMin: fetchInfo.startStr,
            timeMax: fetchInfo.endStr,
            showDeleted: false,
            singleEvents: true,
            orderBy: 'startTime'
        });

        const events = response.result.items.map(event => ({
            id: event.id,
            title: event.summary || '(Sans titre)',
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            description: event.description || '',
            backgroundColor: getEventColor(event),
            borderColor: getEventColor(event),
            extendedProps: {
                googleEvent: event
            }
        }));

        successCallback(events);
    } catch (error) {
        console.error('❌ Error loading calendar events:', error);
        failureCallback(error);
    }
}

// Get event color based on type/category
function getEventColor(googleEvent) {
    const summary = (googleEvent.summary || '').toLowerCase();
    if (summary.includes('travail') || summary.includes('dev')) return '#218c8d'; // Teal
    if (summary.includes('réunion') || summary.includes('meeting')) return '#3B82F6'; // Blue
    if (summary.includes('admin') || summary.includes('administratif')) return '#626c71'; // Gray
    return '#218c8d'; // Default teal
}

// Create event in Google Calendar
async function createGoogleCalendarEvent(eventData) {
    if (!isGoogleSignedIn) {
        throw new Error('Non connecté à Google');
    }

    const calendarId = getConfiguredCalendarId();
    
    // Détecte si c'est un événement "toute la journée" (pas d'heure dans la date)
    const isAllDay = !eventData.start.includes('T') || eventData.start.includes('T00:00:00');
    
    const event = {
        summary: eventData.title,
        description: eventData.description || '',
        start: isAllDay ? {
            date: eventData.start.split('T')[0]
        } : {
            dateTime: eventData.start,
            timeZone: 'Europe/Paris'
        },
        end: isAllDay ? {
            date: eventData.end.split('T')[0]
        } : {
            dateTime: eventData.end,
            timeZone: 'Europe/Paris'
        }
    };

    try {
        const response = await gapi.client.calendar.events.insert({
            calendarId: calendarId,
            resource: event
        });
        console.log('✅ Event created:', response.result);
        return response.result;
    } catch (error) {
        console.error('❌ Error creating event:', error);
        throw error;
    }
}

// Update event in Google Calendar
async function updateGoogleCalendarEvent(eventId, changes) {
    if (!isGoogleSignedIn) {
        throw new Error('Non connecté à Google');
    }

    const calendarId = getConfiguredCalendarId();
    const updates = {};

    if (changes.title !== undefined) updates.summary = changes.title;
    
    if (changes.start !== undefined) {
        const isAllDay = !changes.start.includes('T') || changes.start.includes('T00:00:00');
        updates.start = isAllDay ? 
            { date: changes.start.split('T')[0] } : 
            { dateTime: changes.start, timeZone: 'Europe/Paris' };
    }
    
    if (changes.end !== undefined) {
        const isAllDay = !changes.end.includes('T') || changes.end.includes('T00:00:00');
        updates.end = isAllDay ? 
            { date: changes.end.split('T')[0] } : 
            { dateTime: changes.end, timeZone: 'Europe/Paris' };
    }
    
    if (changes.description !== undefined) updates.description = changes.description;

    try {
        const response = await gapi.client.calendar.events.patch({
            calendarId: calendarId,
            eventId: eventId,
            resource: updates
        });
        console.log('✅ Event updated:', response.result);
        return response.result;
    } catch (error) {
        console.error('❌ Error updating event:', error);
        throw error;
    }
}

// Delete event from Google Calendar
async function deleteGoogleCalendarEvent(eventId) {
    if (!isGoogleSignedIn) {
        throw new Error('Non connecté à Google');
    }

    const calendarId = getConfiguredCalendarId();

    try {
        await gapi.client.calendar.events.delete({
            calendarId: calendarId,
            eventId: eventId
        });
        console.log('✅ Event deleted:', eventId);
    } catch (error) {
        console.error('❌ Error deleting event:', error);
        throw error;
    }
}

// Show event edit modal with comprehensive editing options
function showEventEditModal(event) {
    // Format dates for input fields (YYYY-MM-DD and HH:MM)
    const startDate = event.start.toISOString().split('T')[0];
    const startTime = event.start.toTimeString().slice(0, 5);
    const endDate = event.end ? event.end.toISOString().split('T')[0] : startDate;
    const endTime = event.end ? event.end.toTimeString().slice(0, 5) : startTime;

    // Create modal HTML
    const modalHtml = `
        <div id="eventEditModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        ">
            <div style="
                background: white;
                border-radius: 8px;
                padding: 24px;
                min-width: 400px;
                max-width: 500px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            ">
                <h3 style="margin-top: 0; color: #218c8d;">Modifier l'événement</h3>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Titre</label>
                    <input type="text" id="editEventTitle" value="${event.title}" style="
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 14px;
                    ">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Date début</label>
                        <input type="date" id="editEventStartDate" value="${startDate}" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 14px;
                        ">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Heure début</label>
                        <input type="time" id="editEventStartTime" value="${startTime}" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 14px;
                        ">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Date fin</label>
                        <input type="date" id="editEventEndDate" value="${endDate}" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 14px;
                        ">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Heure fin</label>
                        <input type="time" id="editEventEndTime" value="${endTime}" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 14px;
                        ">
                    </div>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                    <button id="deleteEventBtn" style="
                        padding: 8px 16px;
                        background: #dc2626;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        margin-right: auto;
                    ">🗑️ Supprimer</button>
                    <button id="cancelEditBtn" style="
                        padding: 8px 16px;
                        background: #6b7280;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Annuler</button>
                    <button id="saveEditBtn" style="
                        padding: 8px 16px;
                        background: #218c8d;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">💾 Enregistrer</button>
                </div>
            </div>
        </div>
    `;

    // Insert modal into DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Get modal and buttons
    const modal = document.getElementById('eventEditModal');
    const saveBtn = document.getElementById('saveEditBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const deleteBtn = document.getElementById('deleteEventBtn');

    if (!cancelBtn || !saveBtn || !deleteBtn) {
        console.error('Buttons not found in modal');
        return;
    }

    // Prevent clicks on the modal content from closing the modal
    const modalContent = modal.querySelector('div');
    if (modalContent) {
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Save changes
    saveBtn.onclick = async () => {
        const newTitle = document.getElementById('editEventTitle').value.trim();
        const newStartDate = document.getElementById('editEventStartDate').value;
        const newStartTime = document.getElementById('editEventStartTime').value;
        const newEndDate = document.getElementById('editEventEndDate').value;
        const newEndTime = document.getElementById('editEventEndTime').value;

        // Validation
        if (!newTitle) {
            showToast('Le titre est obligatoire', 'error');
            return;
        }

        const newStart = `${newStartDate}T${newStartTime}:00`;
        const newEnd = `${newEndDate}T${newEndTime}:00`;

        if (new Date(newEnd) <= new Date(newStart)) {
            showToast('La date de fin doit être après la date de début', 'error');
            return;
        }

        try {
            await updateGoogleCalendarEvent(event.id, {
                title: newTitle,
                start: newStart,
                end: newEnd
            });

            // Update calendar display
            event.setProp('title', newTitle);
            event.setStart(newStart);
            event.setEnd(newEnd);

            showToast('✅ Événement modifié', 'success');
            modal.remove();
        } catch (error) {
            console.error('Error updating event:', error);
            showToast('❌ Erreur lors de la modification', 'error');
        }
    };

    // Cancel - stop propagation to prevent modal background click handler
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modal.remove();
    });

    // Delete
    deleteBtn.onclick = async () => {
        if (confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
            try {
                await deleteGoogleCalendarEvent(event.id);
                event.remove();
                showToast('✅ Événement supprimé', 'success');
                modal.remove();
            } catch (error) {
                console.error('Error deleting event:', error);
                showToast('❌ Erreur lors de la suppression', 'error');
            }
        }
    };

    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
}

// Initialize FullCalendar with Google Calendar API integration
async function initFullCalendar() {
    const calendarEl = document.getElementById('fullCalendar');
    if (!calendarEl) {
        console.warn('FullCalendar element not found');
        return;
    }

    // Check if running from file:// protocol - show warning
    const warningEl = document.getElementById('fileProtocolWarning');
    if (window.location.protocol === 'file:') {
        if (warningEl) warningEl.style.display = 'block';
        console.warn('⚠️ Calendar cannot be initialized from file:// protocol');
        return;
    } else {
        if (warningEl) warningEl.style.display = 'none';
    }

    // Initialize Google Auth first
    try {
        await initGoogleAuth();
    } catch (error) {
        console.error('Failed to initialize Google Auth:', error);
        showToast('Erreur d\'authentification Google', 'error');
        return;
    }

    // Initialize FullCalendar
    fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'fr',
        firstDay: 1, // Monday
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        height: 'auto',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        buttonText: {
            today: 'Aujourd\'hui',
            month: 'Mois',
            week: 'Semaine',
            day: 'Jour'
        },
        slotLabelFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        // Enable drag & drop (will be disabled until user signs in)
        editable: false,
        selectable: false,
        selectMirror: true,
        dayMaxEvents: true,
        weekends: true,
        
        // Event sources
        events: loadGoogleCalendarEvents,

        // Handle date selection (create new event)
        select: async function(info) {
            if (!isGoogleSignedIn) {
                showToast('⚠️ Connectez-vous d\'abord à Google', 'warning');
                fullCalendarInstance.unselect();
                return;
            }
            
            const title = prompt('Titre de l\'événement:');
            if (title) {
                try {
                    await createGoogleCalendarEvent({
                        title: title,
                        start: info.startStr,
                        end: info.endStr,
                        description: ''
                    });
                    fullCalendarInstance.refetchEvents();
                    showToast('Événement créé', 'success');
                } catch (error) {
                    showToast('Erreur lors de la création', 'error');
                }
            }
            fullCalendarInstance.unselect();
        },

        // Handle event drop (move)
        eventDrop: async function(info) {
            if (!isGoogleSignedIn) {
                showToast('⚠️ Connectez-vous d\'abord à Google', 'warning');
                info.revert();
                return;
            }
            
            try {
                await updateGoogleCalendarEvent(info.event.id, {
                    start: info.event.startStr,
                    end: info.event.endStr
                });
                showToast('Événement déplacé', 'success');
            } catch (error) {
                showToast('Erreur lors du déplacement', 'error');
                info.revert();
            }
        },

        // Handle event resize
        eventResize: async function(info) {
            if (!isGoogleSignedIn) {
                showToast('⚠️ Connectez-vous d\'abord à Google', 'warning');
                info.revert();
                return;
            }
            
            try {
                await updateGoogleCalendarEvent(info.event.id, {
                    start: info.event.startStr,
                    end: info.event.endStr
                });
                showToast('Durée modifiée', 'success');
            } catch (error) {
                showToast('Erreur lors de la modification', 'error');
                info.revert();
            }
        },

        // Handle event click (edit/delete)
        eventClick: function(info) {
            if (!isGoogleSignedIn) {
                showToast('⚠️ Connectez-vous d\'abord à Google', 'warning');
                return;
            }
            
            const event = info.event;
            showEventEditModal(event);
        }
    });

    fullCalendarInstance.render();
    console.log('✅ FullCalendar initialized with 8h-20h range, Monday-first week, French locale');
    
    // Show initial state (not connected)
    updateSignInStatus(false);
    
    // Auto-refresh calendar every 5 minutes to sync with external changes
    // Consommation estimée: ~2000 appels/mois (bien sous la limite Google)
    setInterval(() => {
        if (isGoogleSignedIn && fullCalendarInstance) {
            console.log('🔄 Auto-refresh calendar...');
            fullCalendarInstance.refetchEvents();
        }
    }, 300000); // 5 minutes (300 000 ms)
}

// Legacy function kept for compatibility (redirects to FullCalendar)
function initGoogleCalendarEmbed() {
    initFullCalendar();
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
        taskForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const date = document.getElementById('taskDate').value;
            const startTime = document.getElementById('taskTime').value;
            const duration = parseFloat(document.getElementById('taskDuration').value) || 1;
            const type = document.getElementById('taskType').value;
            const description = document.getElementById('taskDescription').value;

            // Calculate start and end datetime
            const startDateTime = new Date(`${date}T${startTime}:00`);
            const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);

            const title = `${type}: ${description}`;

            try {
                // Create event via Google Calendar API
                await createGoogleCalendarEvent({
                    title: title,
                    start: startDateTime.toISOString(),
                    end: endDateTime.toISOString(),
                    description: description
                });

                // Refresh FullCalendar
                if (fullCalendarInstance) {
                    fullCalendarInstance.refetchEvents();
                }

                const card = document.getElementById('taskFormCard');
                if (card) card.style.display = 'none';
                taskForm.reset();
                showToast('Rendez-vous créé avec succès', 'success');
            } catch (error) {
                console.error('Error creating task:', error);
                showToast('Erreur lors de la création du rendez-vous', 'error');
            }
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

    // Load invoice items (multi-line support)
    if (invoice.items && invoice.items.length > 0) {
        loadInvoiceItems(invoice.items);
    } else {
        // Legacy: single-line invoice
        const serviceDescriptionEl = document.getElementById('serviceDescription');
        if (serviceDescriptionEl) serviceDescriptionEl.value = invoice.description;
        if (quantityInput) quantityInput.value = invoice.quantity;
        if (unitPriceInput) unitPriceInput.value = invoice.unitPrice;
        
        // Convert legacy to items array
        loadInvoiceItems([{
            description: invoice.description || '',
            quantity: invoice.quantity || 0,
            unitPrice: invoice.unitPrice || 0,
            total: invoice.total || 0
        }]);
    }

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
    
    // Clear invoice items and add one empty line
    clearInvoiceItems();
    addInvoiceItem();
    
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
        document.getElementById('companyIBAN').value = companyInfo.iban || '';
        document.getElementById('companyBIC').value = companyInfo.bic || '';
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
        companyInfo.iban = document.getElementById('companyIBAN').value || '';
        companyInfo.bic = document.getElementById('companyBIC').value || '';
    }
    taxSettings.tauxIS = parseFloat(document.getElementById('tauxIS')?.value) || 0;
    taxSettings.versementLiberatoire = parseFloat(document.getElementById('tauxVersementLib')?.value) || 2.2;
    taxSettings.prorationMensuelle = parseFloat(document.getElementById('prorationMensuelle')?.value) || 8.33;
    taxSettings.cfeAnnuel = parseFloat(document.getElementById('cfeAnnuel')?.value) || 600;
    taxSettings.acreActif = parseFloat(document.getElementById('tauxAcreActif')?.value) || 11.6;
    taxSettings.acreInactif = parseFloat(document.getElementById('tauxAcreInactif')?.value) || 24.6;
    // Le barème IRPP est déjà dans taxSettings.irppBareme (mis à jour par updateIRPPTranche)

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
    
    // Réinitialiser le barème IRPP
    taxSettings.irppBareme = JSON.parse(JSON.stringify(defaultSettings.irppBareme));
    taxSettings.bncAbattement = defaultSettings.bncAbattement;
    renderIRPPBareme();

    updateCFEMensuel();
}

function updateCFEMensuel() {
    const cfeAnnuel = parseFloat(document.getElementById('cfeAnnuel')?.value) || 600;
    const cfeMensuel = cfeAnnuel / 12;
    const el = document.getElementById('cfeMensuel');
    if (el) el.textContent = cfeMensuel.toFixed(2);
}

// ========== GESTION UI BARÈME IRPP ==========

function renderIRPPBareme() {
    const container = document.getElementById('irppBaremeContainer');
    if (!container) return;

    // Sécurité : initialiser le barème si absent
    if (!taxSettings.irppBareme || !Array.isArray(taxSettings.irppBareme) || taxSettings.irppBareme.length === 0) {
        taxSettings.irppBareme = JSON.parse(JSON.stringify(defaultSettings.irppBareme));
    }

    const bareme = taxSettings.irppBareme;
    container.innerHTML = '';

    bareme.forEach((tranche, index) => {
        // Sécurité : vérifier que tranche existe et a les propriétés nécessaires
        if (!tranche || typeof tranche.min === 'undefined' || typeof tranche.taux === 'undefined') {
            console.warn('renderIRPPBareme: tranche invalide ignorée', tranche);
            return;
        }

        const div = document.createElement('div');
        div.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 8px; align-items: center; padding: 8px; background: var(--color-bg-1); border-radius: var(--radius-base);';

        const maxDisplay = tranche.max === Infinity ? '∞' : (tranche.max || 0).toLocaleString('fr-FR');

        // Préparer les valeurs pour éviter null/undefined dans les inputs
        const minValue = tranche.min !== null && tranche.min !== undefined ? tranche.min : 0;
        const maxValue = tranche.max === Infinity ? '' : (tranche.max !== null && tranche.max !== undefined ? tranche.max : '');
        const tauxValue = tranche.taux !== null && tranche.taux !== undefined ? tranche.taux : 0;

        div.innerHTML = `
            <input type="number" class="form-control" value="${minValue}" 
                   onchange="updateIRPPTranche(${index}, 'min', this.value)" 
                   placeholder="Min" style="font-size: 13px;">
            <input type="number" class="form-control" value="${maxValue}" 
                   onchange="updateIRPPTranche(${index}, 'max', this.value)" 
                   placeholder="Max (∞ si vide)" style="font-size: 13px;">
            <input type="number" class="form-control" value="${tauxValue}" step="0.1" 
                   onchange="updateIRPPTranche(${index}, 'taux', this.value)" 
                   placeholder="Taux %" style="font-size: 13px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="removeIRPPTranche(${index})" 
                    style="padding: 4px 8px; min-width: auto;">🗑️</button>
        `;

        container.appendChild(div);
    });

    // Bouton pour ajouter une tranche
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-secondary btn-sm';
    addBtn.textContent = '➕ Ajouter une tranche';
    addBtn.onclick = addIRPPTranche;
    addBtn.style.marginTop = '8px';
    container.appendChild(addBtn);
}

function updateIRPPTranche(index, field, value) {
    if (!taxSettings.irppBareme[index]) return;

    if (field === 'min' || field === 'max') {
        const numValue = value === '' || value === null ? (field === 'max' ? Infinity : 0) : parseFloat(value);
        taxSettings.irppBareme[index][field] = numValue;
    } else if (field === 'taux') {
        taxSettings.irppBareme[index][field] = parseFloat(value) || 0;
    }

    // Trier les tranches par min croissant
    taxSettings.irppBareme.sort((a, b) => a.min - b.min);
    renderIRPPBareme();
}

function addIRPPTranche() {
    const lastTranche = taxSettings.irppBareme[taxSettings.irppBareme.length - 1];
    const newMin = lastTranche && lastTranche.max !== Infinity ? lastTranche.max + 1 : 0;
    taxSettings.irppBareme.push({ min: newMin, max: Infinity, taux: 0 });
    renderIRPPBareme();
}

function removeIRPPTranche(index) {
    if (taxSettings.irppBareme.length <= 1) {
        alert('⚠️ Vous devez conserver au moins une tranche');
        return;
    }
    taxSettings.irppBareme.splice(index, 1);
    renderIRPPBareme();
}

function resetIRPPBareme() {
    if (confirm('Réinitialiser le barème IRPP aux valeurs par défaut 2025 ?')) {
        taxSettings.irppBareme = JSON.parse(JSON.stringify(defaultSettings.irppBareme));
        taxSettings.bncAbattement = defaultSettings.bncAbattement;
        renderIRPPBareme();
        showToast('✅ Barème IRPP réinitialisé');
    }
}

// Exposer les fonctions au global scope pour les onclick
window.updateIRPPTranche = updateIRPPTranche;
window.addIRPPTranche = addIRPPTranche;
window.removeIRPPTranche = removeIRPPTranche;

// Settings event listeners
if (document.getElementById('saveSettings')) {
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('resetSettings').addEventListener('click', resetSettings);
    document.getElementById('cfeAnnuel')?.addEventListener('input', updateCFEMensuel);
    document.getElementById('resetIRPPBareme')?.addEventListener('click', resetIRPPBareme);
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
    // Sécurité : initialiser le barème IRPP si absent
    if (!taxSettings.irppBareme || !Array.isArray(taxSettings.irppBareme) || taxSettings.irppBareme.length === 0) {
        taxSettings.irppBareme = JSON.parse(JSON.stringify(defaultSettings.irppBareme));
    }
    if (!taxSettings.bncAbattement) {
        taxSettings.bncAbattement = defaultSettings.bncAbattement;
    }

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
        // Versement libératoire: taux fixe sur CA
        impot = ca * (taxSettings.versementLiberatoire / 100);
        impotLabel = `${impot.toFixed(2)} € (Versement libératoire ${taxSettings.versementLiberatoire}%)`;
    } else {
        // IRPP barème progressif avec abattement BNC
        const caAnnuel = ca * 12;
        const revenuImposable = calculateBNCRevenuImposable(caAnnuel);
        const impotAnnuel = calculateIRPPProgressif(revenuImposable);
        impot = impotAnnuel / 12; // Ramené au mensuel
        impotLabel = `${impot.toFixed(2)} € (IRPP progressif)`;
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

    // Mise à jour de la comparaison (si élément présent)
    updateComparaison(ca);
}

function updateComparaison(caMensuel) {
    const compContainer = document.getElementById('comparaisonContainer');
    if (!compContainer) return;

    // Sécurité : vérifier que le barème est initialisé
    if (!taxSettings.irppBareme || taxSettings.irppBareme.length === 0) {
        compContainer.innerHTML = '<p style="color: var(--color-text-secondary);">⏳ Chargement du barème IRPP...</p>';
        return;
    }

    const caAnnuel = caMensuel * 12;
    const comp = compareImpots(caAnnuel);

    const versementLibMensuel = comp.versementLib / 12;
    const irppProgressifMensuel = comp.irppProgressif / 12;
    const economieMensuelle = comp.economie / 12;

    const meilleurLabel = comp.meilleurChoix === 'versementLib' ? 'Versement libératoire' : 'IRPP progressif';
    const meilleurColor = comp.meilleurChoix === 'versementLib' ? 'var(--color-primary)' : 'var(--color-success)';

    compContainer.innerHTML = `
        <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-12);">
            📊 Comparaison des modes d'imposition (CA annuel : ${caAnnuel.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)
        </h3>
        <div style="display: grid; gap: var(--space-8); margin-bottom: var(--space-12);">
            <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-bg-1); border-radius: var(--radius-base);">
                <span><strong>Versement libératoire (${taxSettings.versementLiberatoire}%)</strong></span>
                <span><strong>${versementLibMensuel.toFixed(2)} €/mois</strong> (${comp.versementLib.toFixed(2)} €/an)</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-bg-1); border-radius: var(--radius-base);">
                <span><strong>IRPP progressif</strong> <small style="color: var(--color-text-secondary);">(après abattement BNC ${taxSettings.bncAbattement}%)</small></span>
                <span><strong>${irppProgressifMensuel.toFixed(2)} €/mois</strong> (${comp.irppProgressif.toFixed(2)} €/an)</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-bg-1); border-radius: var(--radius-base);">
                <span style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">Revenu imposable annuel (après abattement BNC)</span>
                <span style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">${comp.revenuImposable.toFixed(2)} €</span>
            </div>
        </div>
        <div style="padding: var(--space-12); background: ${meilleurColor}15; border: 2px solid ${meilleurColor}; border-radius: var(--radius-base); text-align: center;">
            <strong style="color: ${meilleurColor}; font-size: var(--font-size-base);">
                ✅ Meilleur choix : ${meilleurLabel}
            </strong>
            <br>
            <span style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
                Économie : ${economieMensuelle.toFixed(2)} €/mois (${comp.economie.toFixed(2)} €/an)
            </span>
        </div>
    `;
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

// --- Preview/confirm flow (always uses Drive mode) ---
// Send mode selection removed - app now always uses automatic Drive mode with preview

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
    // Build an invoice object from the form fields (with multi-line items support)
    try {
        const clientNameEl = document.getElementById('clientName');
        const clientAddressEl = document.getElementById('clientAddress');
        const clientSiretEl = document.getElementById('clientSiret');

        const invoice = {
            number: invoiceNumberInput ? invoiceNumberInput.value : getNextInvoiceNumber(),
            client: clientNameEl ? clientNameEl.value : '',
            clientSiret: clientSiretEl ? clientSiretEl.value : '',
            clientAddress: clientAddressEl ? clientAddressEl.value : '',
            date: invoiceDateInput ? invoiceDateInput.value : '',
            dueDate: dueDateInput ? dueDateInput.value : '',
            items: currentInvoiceItems && currentInvoiceItems.length > 0 ? [...currentInvoiceItems] : [],
            // Legacy fields for backward compatibility (use first item)
            description: currentInvoiceItems[0]?.description || '',
            quantity: currentInvoiceItems[0]?.quantity || 0,
            unitPrice: currentInvoiceItems[0]?.unitPrice || 0,
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

            // Always use Drive mode (automatic email with PDF attachment)
            try {
                await sendInvoiceViaDrive(invoice, to);
                showToast('✅ Email envoyé avec pièce jointe depuis Drive', 'success');
            } catch (err) {
                console.error('Envoi via Drive failed:', err);
                showToast('❌ Erreur lors de l\'envoi de l\'email. Vérifiez la console pour plus de détails.', 'error');
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
function buildInvoiceHtml({clientName, clientAddress, invoiceNumber, invoiceDate, dueDate, description, quantity, unitPrice, total, tvaEnabled, items}) {
    // Support multi-line items or legacy single-line
    const invoiceItems = items && items.length > 0 ? items : [
        { description: description || '', quantity: quantity || 0, unitPrice: unitPrice || 0, total: total || 0 }
    ];
    
    const totalHT = invoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const tva = tvaEnabled ? totalHT * 0.20 : 0;
    const totalTTC = totalHT + tva;

    const companyAddressLine = companyInfo.address && companyInfo.postalCode && companyInfo.city
        ? `${companyInfo.address}, ${companyInfo.postalCode} ${companyInfo.city}`
        : '[À compléter dans Paramètres]';

    // Force local logo file - always use MTI_CONSULTING.png unless data-URI is provided
    const logoSrc = companyInfo.logoUrl && companyInfo.logoUrl.startsWith('data:') 
        ? companyInfo.logoUrl 
        : 'MTI_CONSULTING.png';
    const logoHTML = `<img src="${logoSrc}" style="max-width: 180px; max-height: 90px; object-fit: contain; margin-bottom: 8px; display: block;" crossorigin="anonymous">`;

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        @page { 
            size: A4 portrait; 
            margin: 0;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: Arial, Helvetica, sans-serif; 
            color: #1a1a1a; 
            margin: 0; 
            padding: 0; 
            background: white;
            width: 794px;
            height: 1123px;
        }
        .page-container { 
            width: 794px;
            height: 1123px;
            margin: 0; 
            padding: 60px 50px 100px 50px;
            position: relative; 
            background: white;
            box-sizing: border-box;
        }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 35px; }
        .header-left { max-width: 48%; }
        .header-right { max-width: 45%; margin-top: 85px; }
        .company { font-weight: bold; font-size: 20px; color: #21808D; margin-bottom: 10px; line-height: 1.2; }
        .separator { border: none; border-top: 2px solid #e0e0e0; margin: 20px 0; clear: both; }
        .invoice-details { margin-top: 30px; margin-bottom: 25px; line-height: 1.7; }
        .invoice-number { font-size: 24px; font-weight: bold; margin-bottom: 12px; color: #21808D; }
        table { width: 100%; border-collapse: collapse; margin: 25px 0; }
        th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        th { background-color: rgba(33, 128, 141, 0.12); font-weight: bold; font-size: 13px; color: #1a1a1a; }
        td { font-size: 14px; color: #333; }
        .totals { text-align: right; margin-top: 30px; padding-top: 20px; border-top: 3px solid #21808D; font-size: 15px; line-height: 1.8; }
        .legal { 
            position: absolute; 
            bottom: 40px; 
            left: 50px; 
            right: 50px; 
            font-size: 9px; 
            color: #666; 
            line-height: 1.4; 
            background: #f9f9f9; 
            padding: 10px 12px; 
            border-radius: 3px; 
            border-left: 3px solid #21808D; 
        }
        .legal p { margin: 3px 0; }
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
                    ${invoiceItems.map(item => `
                        <tr>
                            <td>${item.description || ''}</td>
                            <td style="text-align: center;">${item.quantity || 0}</td>
                            <td style="text-align: right;">${parseFloat(item.unitPrice || 0).toFixed(2)} €</td>
                            <td style="text-align: right;">${(item.total || 0).toFixed(2)} €</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="totals">
                ${tvaEnabled ? `
                    <div style="margin-bottom: 6px;">Total HT: ${totalHT.toFixed(2)} €</div>
                    <div style="margin-bottom: 6px;">TVA (20%): ${tva.toFixed(2)} €</div>
                    <div style="font-weight: bold; font-size: 18px; margin-top: 12px; color: #21808D;">Total TTC: ${totalTTC.toFixed(2)} €</div>
                ` : `
                    <div style="margin-bottom: 6px;">Total HT: ${totalHT.toFixed(2)} €</div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 6px;">TVA non applicable (art. 293 B du CGI)</div>
                    <div style="font-weight: bold; font-size: 18px; margin-top: 12px; color: #21808D;">Total TTC: ${totalHT.toFixed(2)} €</div>
                `}
            </div>

        <div class="legal">
            <p><strong>Conditions de paiement:</strong> 30 jours nets à réception | <strong>Escompte:</strong> néant</p>
            <p><strong>Pénalités de retard:</strong> 3 fois le taux d'intérêt légal en vigueur | <strong>Indemnité forfaitaire pour frais de recouvrement:</strong> 40€ (art. D.441-5 du Code de commerce)</p>
            <p><strong>TVA non applicable, art. 293 B du CGI</strong> (franchise en base) | Dispensé d'immatriculation au RCS et au RM (micro-entreprise)</p>
            ${(companyInfo.iban || companyInfo.bic) ? `<p style="margin-top: 6px;">${companyInfo.iban ? `<strong>IBAN:</strong> ${companyInfo.iban}` : ''}${companyInfo.iban && companyInfo.bic ? ' | ' : ''}${companyInfo.bic ? `<strong>BIC:</strong> ${companyInfo.bic}` : ''}</p>` : ''}
        </div>
    </div>
</body>
</html>`;
}

function downloadInvoicePDF() {
    const clientNameEl = document.getElementById('clientName');
    const clientAddressEl = document.getElementById('clientAddress');

    // Validation: check required fields
    if (!clientNameEl || !clientAddressEl || !invoiceNumberInput || !invoiceDateInput || !dueDateInput) {
        alert('Veuillez remplir tous les champs obligatoires avant de télécharger le PDF');
        return;
    }

    // Validate that we have at least one item with description
    if (!currentInvoiceItems || currentInvoiceItems.length === 0) {
        alert('Veuillez ajouter au moins une ligne de facturation');
        return;
    }

    const hasEmptyDescription = currentInvoiceItems.some(item => !item.description || item.description.trim() === '');
    if (hasEmptyDescription) {
        alert('Toutes les lignes doivent avoir une description');
        return;
    }

    const clientName = clientNameEl.value;
    const clientAddress = clientAddressEl.value;
    const invoiceNumber = invoiceNumberInput.value;
    const invoiceDate = invoiceDateInput.value;
    const dueDate = dueDateInput.value;
    const total = calculateTotal();

    const tvaEnabled = document.getElementById('tvaToggle') && document.getElementById('tvaToggle').checked;

    // Use buildInvoiceHtml with items array
    const pdfContent = buildInvoiceHtml({
        clientName, 
        clientAddress, 
        invoiceNumber, 
        invoiceDate, 
        dueDate, 
        total, 
        tvaEnabled,
        items: currentInvoiceItems,
        // Legacy fields for backward compatibility (use first item)
        description: currentInvoiceItems[0]?.description || '',
        quantity: currentInvoiceItems[0]?.quantity || 0,
        unitPrice: currentInvoiceItems[0]?.unitPrice || 0
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
    if (!invoice) { 
        alert('❌ Aucune facture pour téléchargement'); 
        return; 
    }

    // ========== VALIDATIONS STRICTES ==========
    
    // 1. Vérifier que le client est renseigné
    if (!invoice.client || invoice.client.trim() === '') {
        alert('❌ Veuillez renseigner le nom du client avant de générer le PDF');
        return;
    }

    // 2. Vérifier qu'il y a au moins une ligne de facturation
    if (!invoice.items || invoice.items.length === 0) {
        alert('❌ Veuillez ajouter au moins une ligne de facturation');
        return;
    }

    // 3. Vérifier que toutes les lignes ont une description
    const hasEmptyDescription = invoice.items.some(item => !item.description || item.description.trim() === '');
    if (hasEmptyDescription) {
        alert('❌ Toutes les lignes de facturation doivent avoir une description');
        return;
    }

    // 4. Vérifier que le montant total n'est pas nul
    if (!invoice.total || invoice.total <= 0) {
        alert('❌ Le montant total de la facture doit être supérieur à 0 €\nVeuillez renseigner les quantités et prix unitaires');
        return;
    }

    // 5. Vérifier que l'adresse client est renseignée
    if (!invoice.clientAddress || invoice.clientAddress.trim() === '') {
        alert('❌ Veuillez renseigner l\'adresse du client avant de générer le PDF');
        return;
    }

    // ========== FIN VALIDATIONS ==========

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
    
    // Initialize invoice items with one empty line
    if (currentInvoiceItems.length === 0) {
        addInvoiceItem();
    }
    
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
    renderIRPPBareme(); // Initialiser l'UI du barème IRPP

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

    // Initialize preview-confirm button (always uses Drive mode)
    try { initPreviewConfirmButton(); } catch (e) { console.warn('initPreviewConfirmButton failed', e); }

    // Initialize Google Calendar with FullCalendar + OAuth2
    try { initGoogleCalendarEmbed(); } catch (e) { console.warn('initGoogleCalendarEmbed failed', e); }
    
    // Initialize calendar manager (interactive event create/modify/delete via backend)
    try { initCalendarManager(); } catch (e) { console.warn('initCalendarManager failed', e); }
    
    // Setup "Ouvrir dans Google Calendar" button
    const openCalendarBtn = document.getElementById('openGoogleCalendarBtn');
    if (openCalendarBtn) {
        openCalendarBtn.addEventListener('click', () => {
            const calId = getConfiguredCalendarId();
            window.open(`https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calId)}`, '_blank');
        });
    }

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
        const logoSrc = companyInfo.logoUrl && !companyInfo.logoUrl.includes('github') ? companyInfo.logoUrl : 'assets/images/MTI_CONSULTING.png';
        logoDataUri = await fetchImageAsDataUri(logoSrc);
        if (logoDataUri) companyInfo.logoUrl = logoDataUri;
    } catch (e) {
        console.warn('Could not inline logo', e);
        // Fallback: try local file
        try {
            logoDataUri = await fetchImageAsDataUri('assets/images/MTI_CONSULTING.png');
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
                tvaEnabled: document.getElementById('tvaToggle') && document.getElementById('tvaToggle').checked,
                items: invoice.items || null
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
            // Render with html2canvas. Use scale 2.0 for excellent quality while keeping reasonable file size.
            // Scale 2.0 gives ~150-200 Ko (good balance between quality and size)
            const canvasScale = 2.0;
            // Use exact A4 dimensions in pixels (at 96 DPI: 210mm = 794px, 297mm = 1123px)
            const { jsPDF } = window.jspdf;
            const pdfDoc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdfDoc.internal.pageSize.getWidth(); // 210mm
            const pageHeight = pdfDoc.internal.pageSize.getHeight(); // 297mm
            
            // A4 at 96 DPI = 794x1123px, scale up for quality
            const a4WidthPx = 794;
            const a4HeightPx = 1123;
            tempContainer.style.width = a4WidthPx + 'px';
            tempContainer.style.height = a4HeightPx + 'px';

            const canvas = await html2canvas(tempContainer, { scale: canvasScale, useCORS: true, backgroundColor: '#ffffff' });
            // Use JPEG with 0.85 quality for much smaller file size while preserving visual quality
            const imgData = canvas.toDataURL('image/jpeg', 0.85);

            // canvas dimensions in px
            const imgProps = { width: canvas.width, height: canvas.height };
            // Convert px -> mm taking canvas scale (effective DPI = 96 * scale)
            const pxToMm = (px) => px * 25.4 / effectiveDpi;
            // Simply add the full canvas as one image covering the entire PDF page
            // Canvas should already be at correct A4 proportions (794x1123 * scale)
            pdfDoc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
            
            const dataUri = pdfDoc.output('datauristring');
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
