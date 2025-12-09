// MTI CONSULTING - Application de facturation
// Version v2.0 - Google Drive Storage + Gmail API + Calendar API + FullCalendar

console.log('✅ app.js chargé - début du script');

// Configuration production (credentials en dur comme en v42)
const CONFIG = {
    BACKEND_URL: 'https://script.google.com/macros/s/AKfycby7tGJVMVB51juVHJUWfv-gAmf8Fkp5K8nkSTdzpherNdH1Wn2kYK_Hu08pYoOTwCqL/exec',
    DRIVE_FILE_NAME: 'mti_data.json',
    SHEETS_ID: '1Zu6I-c64YrBdlfvWhiVnlbwbvhv6Mw5NL8iRn2mvXoE',
    CALENDAR_ID: 'mticonsulting59@gmail.com',
    GOOGLE_CLIENT_ID: '913475747202-dg6rnc0hhu16thk3gckbnqkdcoei2a1n.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: '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',
    GOOGLE_API_KEY: '',
    GOOGLE_SCOPES: 'https://www.googleapis.com/auth/calendar.events',
    DRIVE_FOLDER: 'MTI_CONSULTING_DATA'
};

// Charger la configuration depuis localStorage (pour GitHub Pages) ou window.CONFIG (pour fichier local)
function loadConfigFromStorage() {
    const storedConfig = localStorage.getItem('mti_app_config');
    if (storedConfig) {
        try {
            return JSON.parse(storedConfig);
        } catch (e) {
            console.warn('Configuration invalide dans localStorage');
        }
    }
    return null;
}

// Sauvegarder la configuration dans localStorage
function saveConfigToStorage(config) {
    try {
        localStorage.setItem('mti_app_config', JSON.stringify(config));
        console.log('✅ Configuration sauvegardée dans localStorage');
    } catch (e) {
        console.error('Impossible de sauvegarder la configuration:', e);
    }
}

// Configuration chargée (credentials en dur dans CONFIG ci-dessus)
console.log('✅ Configuration chargée depuis app.js (v42 style)');

function getConfiguredCalendarId() {
    return localStorage.getItem('mti_calendar_id') || CONFIG.CALENDAR_ID;
}

// Send mode storage key: 'drive' or 'manual'
const SEND_MODE_KEY = 'mti_send_mode';

// Helper to call the Apps Script backend with better error handling and CORS guidance
async function callBackend(action, payload = {}) {
    // Vérifier si le backend est configuré
    if (!CONFIG.BACKEND_URL || CONFIG.BACKEND_URL.includes('VOTRE_SCRIPT_ID')) {
        throw new Error('Backend non configuré. Allez dans Paramètres → Configuration Technique');
    }
    
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
        const data = { clients, invoices, tasks, rams, recurringInvoices, companyInfo, taxSettings };
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

// Alias pour compatibilité
async function syncToDrive() {
    return await saveToDrive();
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
        if (data.rams) rams = data.rams;
        if (data.recurringInvoices) recurringInvoices = data.recurringInvoices;
        if (data.companyInfo) companyInfo = data.companyInfo;
        if (data.taxSettings) taxSettings = data.taxSettings;


    
        console.log('✅ Données chargées depuis Drive');

        // Rafraîchir vues si fonctions définies
        if (typeof renderClientsTable === 'function') renderClientsTable();
        if (typeof populateClientSelects === 'function') populateClientSelects();
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
        if (typeof renderInvoiceList === 'function') renderInvoiceList();
        if (typeof renderRAMList === 'function') renderRAMList();
        if (typeof renderRecurringList === 'function') renderRecurringList();
        if (typeof updateCADisplay === 'function') updateCADisplay();

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

// Données chargées depuis Google Drive (vides par défaut, seront écrasées au chargement)
let clients = [];
let invoices = [];
let tasks = [];
let rams = []; // Rapports d'Activité Mensuels
let recurringInvoices = []; // Factures récurrentes / abonnements

// Calendar state
let currentView = 'week';
let currentDate = new Date();
let useAppCalendar = false; // true = app calendar (day/week/month), false = FullCalendar (Google)

// Company info - now editable via settings
let companyInfo = {
    name: 'MTI CONSULTING',
    logoUrl: 'https://github.com/mtcdp59/Factu_MTI_CONSULTING/blob/main/MTI_CONSULTING.png?raw=true',
    siret: '994 149 904 00017',
    address: '13A rue du Général de Gaulle',
    postalCode: '59110',
    city: 'La Madeleine',
    email: 'mticonsulting59@gmail.com',
    phone: '07 77 37 17 39',
    iban: 'FR76 4061 8804 9700 0403 3099 557', // IBAN professionnel affiché en footer de facture
    bic: 'BOUSFRPPXXX'   // BIC (Code SWIFT) de la banque
};

// Tax rates - now stored in memory, editable via settings
let taxSettings = {
    tauxIS: 0,
    versementLiberatoire: 2.2,
    prorationMensuelle: 8.33,
    cfeAnnuel: 600,
    // Charges sociales URSSAF (BNC - Prestations de services / Activités libérales)
    // Source : https://www.autoentrepreneur.urssaf.fr/portail/accueil/sinformer-sur-le-statut/lessentiel-du-statut.html
    // ACRE depuis 2020 : durée 12 mois (plus de dégressivité sur 3 ans)
    acreActif: 12.3,          // Année 1 avec ACRE - Taux réduit BNC 2025 : 12,30%
    acreInactif: 24.6,        // Année 2+ sans ACRE - Taux plein 2025 (évolution +1%/an jusqu'en 2029)
    // CFP (Contribution Formation Professionnelle) BNC - OBLIGATOIRE
    cfpBNC: 0.2,              // 0,2% du CA (Code du travail L6331-48)
    // Conditions versement libératoire
    rfrMaxVL: 28797,          // RFR max par part pour VL 2026 (27478€ pour 2025)
    caMaxBNC: 77700,          // Plafond CA BNC pour micro-entreprise
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
    acreActif: 12.3,
    acreInactif: 24.6,
    cfpBNC: 0.2,
    rfrMaxVL: 28797,
    caMaxBNC: 77700,
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
            <td>${client.naf || '-'}</td>
            <td>${client.categorie_juridique || '-'}</td>
            <td>${client.etat_administratif || '-'}</td>
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
                contact_name: document.getElementById('clientFormContactName').value,
                // Données SIRENE enrichies
                naf: document.getElementById('clientFormNAF')?.value || '',
                categorie_juridique: document.getElementById('clientFormCategorieJuridique')?.value || '',
                etat_administratif: document.getElementById('clientFormEtat')?.value || '',
                type_siege: document.getElementById('clientFormTypeSiege')?.value || ''
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
    const nafEl = document.getElementById('clientFormNAF');
    const categorieJuridiqueEl = document.getElementById('clientFormCategorieJuridique');
    const etatEl = document.getElementById('clientFormEtat');
    const typeSiegeEl = document.getElementById('clientFormTypeSiege');
    
    if (nameEl) nameEl.value = client.name;
    if (siretEl) siretEl.value = client.siret || '';
    if (addressEl) addressEl.value = client.address || '';
    if (emailEl) emailEl.value = client.email_facturation || '';
    if (contactEl) contactEl.value = client.contact_name || '';
    
    // Charger données SIRENE enrichies
    if (nafEl) nafEl.value = client.naf || '';
    if (categorieJuridiqueEl) categorieJuridiqueEl.value = client.categorie_juridique || '';
    if (etatEl) etatEl.value = client.etat_administratif || '';
    if (typeSiegeEl) typeSiegeEl.value = client.type_siege || '';
    
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
            
            // Vérifier les éléments de base
            if (!clientNameEl || !clientAddressEl || !invoiceNumberInput || !invoiceDateInput || !dueDateInput) {
                alert('❌ Erreur: Éléments du formulaire introuvables');
                return;
            }

            const clientName = clientNameEl.value.trim();
            const clientAddress = clientAddressEl.value.trim();
            const invoiceNumber = invoiceNumberInput.value.trim();
            const invoiceDate = invoiceDateInput.value;
            const dueDate = dueDateInput.value;
            
            // Récupérer les items (multi-ligne) depuis currentInvoiceItems
            const items = currentInvoiceItems;
            
            // Validation
            if (!clientName || !clientAddress || !invoiceDate || !dueDate) {
                alert('❌ Veuillez remplir tous les champs obligatoires (client, adresse, dates)');
                return;
            }
            
            if (!items || items.length === 0) {
                alert('❌ Veuillez ajouter au moins une ligne de facturation');
                return;
            }
            
            // Vérifier que chaque item est valide
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (!item.description || !item.description.trim()) {
                    alert(`❌ La ligne ${i + 1} doit avoir une description`);
                    return;
                }
                if (!item.quantity || item.quantity <= 0) {
                    alert(`❌ La ligne ${i + 1} doit avoir une quantité > 0`);
                    return;
                }
                if (!item.unitPrice || item.unitPrice <= 0) {
                    alert(`❌ La ligne ${i + 1} doit avoir un prix unitaire > 0`);
                    return;
                }
            }
            
            const total = calculateTotal();

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

            // Générer les lignes HTML pour les items multi-lignes
            const itemsHTML = items.map(item => `
                <tr>
                    <td>${item.description || ''}</td>
                    <td style="text-align: center;">${item.quantity || 0}</td>
                    <td style="text-align: right;">${parseFloat(item.unitPrice || 0).toFixed(2)} €</td>
                    <td style="text-align: right;">${(item.total || 0).toFixed(2)} €</td>
                </tr>
            `).join('');

            // Use local logo file (MTI_CONSULTING.png) or configured data-URI
            const logoSrc = companyInfo.logoUrl && (companyInfo.logoUrl.startsWith('data:') || !companyInfo.logoUrl.includes('github')) 
                ? companyInfo.logoUrl 
                : 'MTI_CONSULTING.png';
            const logoHTML = logoSrc
                ? `<img src="${logoSrc}" alt="Logo" style="max-width: 150px; max-height: 80px; object-fit: contain; margin-bottom: var(--space-12);" crossorigin="anonymous">`
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
                        ${itemsHTML}
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
                items: items,
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
                ${(inv.items && inv.items.length > 0) 
                    ? inv.items.map(item => `
                        <tr>
                            <td>${item.description || ''}</td>
                            <td style="text-align: center;">${item.quantity || 0}</td>
                            <td style="text-align: right;">${parseFloat(item.unitPrice || 0).toFixed(2)} €</td>
                            <td style="text-align: right;">${(item.total || 0).toFixed(2)} €</td>
                        </tr>
                    `).join('')
                    : `
                        <tr>
                            <td>${inv.description || ''}</td>
                            <td style="text-align: center;">${inv.quantity || 0}</td>
                            <td style="text-align: right;">${parseFloat(inv.unitPrice || 0).toFixed(2)} €</td>
                            <td style="text-align: right;">${(inv.total || 0).toFixed(2)} €</td>
                        </tr>
                    `
                }
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

    // Note: confirmEmail listener is now managed by setupEmailPreviewHandlersForConfirmSend()
    // to avoid duplicate executions (was causing double send). Old listener removed.
    // See line 5729: setupEmailPreviewHandlersForConfirmSend() handles click with proper protection.
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

// Flag global pour empêcher double soumission
let isSubmittingInvoice = false;

// Save invoice
function setupInvoiceSaveHandler() {
    if (!invoiceForm) return;
    invoiceForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Protection double-clic : vérifier flag global + disabled
        if (isSubmittingInvoice) {
            console.warn('⚠️ Soumission déjà en cours, ignorée');
            return;
        }
        
        isSubmittingInvoice = true;

        // Protection double-clic : désactiver le bouton pendant le traitement
        const submitBtn = document.getElementById('submitInvoiceBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
            submitBtn.style.cursor = 'not-allowed';
            const originalText = submitBtn.textContent;
            submitBtn.textContent = '⏳ Traitement...';
            // Restaurer texte après traitement
            submitBtn.dataset.originalText = originalText;
        }

        // Validate that at least one item exists
        if (!currentInvoiceItems || currentInvoiceItems.length === 0) {
            showToast('⚠️ Veuillez ajouter au moins une ligne de facturation', 'error');
            // Réactiver le bouton
            isSubmittingInvoice = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.textContent = submitBtn.dataset.originalText || '💾 Créer facture';
            }
            return;
        }

        // Validate that all items have descriptions
        const hasEmptyDescription = currentInvoiceItems.some(item => !item.description || item.description.trim() === '');
        if (hasEmptyDescription) {
            showToast('⚠️ Toutes les lignes doivent avoir une description', 'error');
            // Réactiver le bouton
            isSubmittingInvoice = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.textContent = submitBtn.dataset.originalText || '💾 Créer facture';
            }
            return;
        }

        // Calculate total from items
        const totalHT = currentInvoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);

        const invoiceNumber = invoiceNumberInput ? invoiceNumberInput.value : getNextInvoiceNumber();
        
        // Validation : vérifier que le numéro de facture est unique (sauf en mode édition)
        if (!isEditMode) {
            const duplicateInvoice = invoices.find(inv => inv.number === invoiceNumber);
            if (duplicateInvoice) {
                showToast(`❌ Le numéro de facture "${invoiceNumber}" existe déjà. Veuillez modifier le numéro.`, 'error');
                isSubmittingInvoice = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    submitBtn.textContent = submitBtn.dataset.originalText || '💾 Créer facture';
                }
                return;
            }
        }

        const invoiceData = {
            number: invoiceNumber,
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
        
        // Update CA counter (fix: compteur ne s'actualise pas après création)
        if (typeof updateCADisplay === 'function') {
            updateCADisplay();
        }

        // Persist changes
        saveToDrive();

        // Réactiver le bouton après traitement
        isSubmittingInvoice = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            submitBtn.textContent = submitBtn.dataset.originalText || '💾 Créer facture';
        }
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
    
    const modal = document.getElementById('editTaskModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
    }
}

window.editTask = editTask;

document.getElementById('closeEditTaskModal')?.addEventListener('click', () => {
    const modal = document.getElementById('editTaskModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
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
    const modal = document.getElementById('editTaskModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
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
    renderCharts(); // FIX: Actualiser les graphiques après filtrage
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
        updateCAYearOptions(); // Mettre \u00e0 jour les ann\u00e9es m\u00eame s'il n'y a pas de factures
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
                <button class="btn btn-sm btn-primary" onclick="generateRAMForInvoice(${index})" title="Générer Rapport d'Activité Mensuelle" style="margin-left: var(--space-4);">📊 RAM</button>
                <button class="btn btn-sm btn-primary" onclick="sendInvoiceEmail(${index})" title="Envoyer par email" style="margin-left: var(--space-4);">📧 Envoyer</button>
                ${rams.some(r => r.invoiceNumber === invoice.number) ? `<button class="btn btn-sm btn-success" onclick="sendInvoiceWithRAM(${index})" title="Envoyer Facture + RAM ensemble" style="margin-left: var(--space-4);">📧+📊 Facture+RAM</button>` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Mettre \u00e0 jour les ann\u00e9es disponibles dans le compteur CA
    updateCAYearOptions();
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
            
            // FIX: Actualiser le compteur CA après suppression
            if (typeof updateCADisplay === 'function') {
                updateCADisplay();
            }

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

// Charger la configuration technique dans l'UI (pré-remplit avec les valeurs de CONFIG)
function loadTechnicalConfig() {
    if (document.getElementById('configBackendURL')) {
        // Pré-remplir avec les valeurs hardcodées de CONFIG (v42 style)
        document.getElementById('configBackendURL').value = CONFIG.BACKEND_URL || '';
        document.getElementById('configClientID').value = CONFIG.GOOGLE_CLIENT_ID || '';
        document.getElementById('configClientSecret').value = CONFIG.GOOGLE_CLIENT_SECRET || '';
        document.getElementById('configCalendarID').value = CONFIG.CALENDAR_ID || '';
        
        console.log('📝 Paramètres pré-remplis avec les valeurs par défaut (CONFIG)');
    }
}

// Sauvegarder la configuration technique
function saveTechnicalConfig() {
    if (!document.getElementById('configBackendURL')) return;
    
    const newConfig = {
        BACKEND_URL: document.getElementById('configBackendURL').value.trim(),
        GOOGLE_CLIENT_ID: document.getElementById('configClientID').value.trim(),
        GOOGLE_CLIENT_SECRET: document.getElementById('configClientSecret').value.trim(),
        CALENDAR_ID: document.getElementById('configCalendarID').value.trim(),
        DRIVE_FILE_NAME: CONFIG.DRIVE_FILE_NAME, // Garder les valeurs fixes
        SHEETS_ID: CONFIG.SHEETS_ID,
        GOOGLE_API_KEY: CONFIG.GOOGLE_API_KEY,
        GOOGLE_SCOPES: CONFIG.GOOGLE_SCOPES
    };
    
    // Validation basique
    if (!newConfig.BACKEND_URL || !newConfig.BACKEND_URL.startsWith('https://script.google.com')) {
        alert('❌ Backend URL invalide. Format attendu: https://script.google.com/macros/s/VOTRE_SCRIPT_ID/exec');
        return false;
    }
    
    if (!newConfig.GOOGLE_CLIENT_ID || !newConfig.GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com')) {
        alert('❌ Client ID invalide. Format attendu: XXXX.apps.googleusercontent.com');
        return false;
    }
    
    // Sauvegarder dans localStorage
    saveConfigToStorage(newConfig);
    
    // Mettre à jour l'objet CONFIG global
    Object.assign(CONFIG, newConfig);
    
    showToast('✅ Configuration sauvegardée ! Rechargez la page pour appliquer les changements.', 'success');
    return true;
}

function loadCompanySettings() {
    // Charger la config technique
    loadTechnicalConfig();
    
    // Charger les infos entreprise
    if (document.getElementById('logoUrl')) {
        document.getElementById('logoUrl').value = companyInfo.logoUrl || '';
        document.getElementById('companyLegalSiret').value = companyInfo.siret || '[SIRET à venir]';
        document.getElementById('companyAddress').value = companyInfo.address || '[Adresse]';
        document.getElementById('companyPostal').value = companyInfo.postalCode || '[Code postal]';
        document.getElementById('companyCity').value = companyInfo.city || '[Ville]';
        document.getElementById('companyIBAN').value = companyInfo.iban || '';
        document.getElementById('companyBIC').value = companyInfo.bic || '';
    }
    
    // Charger les paramètres fiscaux (taxSettings → HTML)
    if (document.getElementById('tauxAcreActif')) {
        document.getElementById('tauxAcreActif').value = taxSettings.acreActif;
        document.getElementById('tauxAcreInactif').value = taxSettings.acreInactif;
        document.getElementById('tauxCFPBNC').value = taxSettings.cfpBNC;
        document.getElementById('rfrMaxVL').value = taxSettings.rfrMaxVL;
        document.getElementById('caMaxBNC').value = taxSettings.caMaxBNC;
        document.getElementById('tauxVersementLib').value = taxSettings.versementLiberatoire;
        document.getElementById('cfeAnnuel').value = taxSettings.cfeAnnuel;
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
    taxSettings.acreActif = parseFloat(document.getElementById('tauxAcreActif')?.value) || 12.3;
    taxSettings.acreInactif = parseFloat(document.getElementById('tauxAcreInactif')?.value) || 24.6;
    taxSettings.cfpBNC = parseFloat(document.getElementById('tauxCFPBNC')?.value) || 0.2;
    taxSettings.rfrMaxVL = parseFloat(document.getElementById('rfrMaxVL')?.value) || 28797;
    taxSettings.caMaxBNC = parseFloat(document.getElementById('caMaxBNC')?.value) || 77700;
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
    document.getElementById('tauxCFPBNC').value = defaultSettings.cfpBNC;
    document.getElementById('rfrMaxVL').value = defaultSettings.rfrMaxVL;
    document.getElementById('caMaxBNC').value = defaultSettings.caMaxBNC;
    
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

// Configuration technique listeners
if (document.getElementById('saveConfigBtn')) {
    document.getElementById('saveConfigBtn').addEventListener('click', () => {
        if (saveTechnicalConfig()) {
            // Proposer de recharger la page pour appliquer les changements
            if (confirm('Configuration sauvegardée ! Voulez-vous recharger la page pour appliquer les changements ?')) {
                window.location.reload();
            }
        }
    });
}

if (document.getElementById('testConfigBtn')) {
    document.getElementById('testConfigBtn').addEventListener('click', async () => {
        const btn = document.getElementById('testConfigBtn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Test en cours...';
        
        try {
            // Tester la connexion au backend
            const testResult = await fetch(CONFIG.BACKEND_URL + '?action=test', { 
                method: 'GET',
                mode: 'cors'
            });
            
            if (testResult.ok) {
                const text = await testResult.text();
                showToast('✅ Backend accessible ! Réponse: ' + text.substring(0, 50) + '...', 'success');
                console.log('Test backend réponse:', text);
            } else {
                throw new Error('Status: ' + testResult.status);
            }
        } catch (error) {
            console.error('Test backend failed:', error);
            showToast('❌ Backend inaccessible. Vérifiez l\'URL et les paramètres CORS.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
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

function calculateTaxes() {
    // Sécurité : initialiser le barème IRPP si absent
function updateComparaisonVL_IRPP(ca, multiplicateur, scenarios) {
    const { vl, irpp } = scenarios;
    const isMensuel = multiplicateur === 1;
    const periodeText = isMensuel ? 'Mensuel' : 'Annuel';

    // Scenario VL
    const scenarioVLContent = document.getElementById('scenarioVLContent');
    if (scenarioVLContent) {
        scenarioVLContent.innerHTML = `
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8);">CA ${periodeText}: <strong>${(ca * multiplicateur).toFixed(2)} €</strong></div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">URSSAF: ${(vl.charges * multiplicateur).toFixed(2)} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">CFP: ${(vl.cfp * multiplicateur).toFixed(2)} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">Impôt VL (${taxSettings.versementLiberatoire}%): ${(vl.impot * multiplicateur).toFixed(2)} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">CFE: ${(vl.cfe * multiplicateur).toFixed(2)} €</div>
            <div style="border-top: 2px solid var(--color-border); padding-top: var(--space-8); margin-top: var(--space-8); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);">Total charges: <span style="color: var(--color-warning);">${(vl.total * multiplicateur).toFixed(2)} €</span></div>
            <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-bold); margin-top: var(--space-8); color: var(--color-primary);">Revenu net: ${(vl.net * multiplicateur).toFixed(2)} €</div>
        `;
    }

    // Scenario IRPP
    const scenarioIRPPContent = document.getElementById('scenarioIRPPContent');
    if (scenarioIRPPContent) {
        scenarioIRPPContent.innerHTML = `
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8);">CA ${periodeText}: <strong>${(ca * multiplicateur).toFixed(2)} €</strong></div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">URSSAF: ${(irpp.charges * multiplicateur).toFixed(2)} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">CFP: ${(irpp.cfp * multiplicateur).toFixed(2)} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">Impôt IRPP (progressif): ${(irpp.impot * multiplicateur).toFixed(2)} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">CFE: ${(irpp.cfe * multiplicateur).toFixed(2)} €</div>
            <div style="border-top: 2px solid var(--color-border); padding-top: var(--space-8); margin-top: var(--space-8); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);">Total charges: <span style="color: var(--color-warning);">${(irpp.total * multiplicateur).toFixed(2)} €</span></div>
            <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-bold); margin-top: var(--space-8); color: var(--color-primary);">Revenu net: ${(irpp.net * multiplicateur).toFixed(2)} €</div>
        `;
    }

    // Recommandation
    const comparaisonRecommandation = document.getElementById('comparaisonRecommandation');
    if (comparaisonRecommandation) {
        const diff = Math.abs(vl.net - irpp.net) * multiplicateur;
        const meilleur = vl.net > irpp.net ? 'Versement Libératoire' : 'IRPP Progressif';
        const icone = vl.net > irpp.net ? '💼' : '📊';
        comparaisonRecommandation.innerHTML = `${icone} <strong>Recommandation :</strong> ${meilleur} (gain de ${diff.toFixed(2)} € ${isMensuel ? 'par mois' : 'par an'})`;
        comparaisonRecommandation.style.background = vl.net > irpp.net ? 'var(--color-success)' : 'var(--color-primary)';
    }
}

function calculateTaxes() {
    // Sécurité : initialiser le barème IRPP si absentgify(defaultSettings.irppBareme));
    }
    if (!taxSettings.bncAbattement) {
        taxSettings.bncAbattement = defaultSettings.bncAbattement;
    }
    if (!taxSettings.cfpBNC) {
        taxSettings.cfpBNC = defaultSettings.cfpBNC;
    }

    const ca = parseFloat(caInput?.value) || 0;
    
    // Déterminer situation ACRE (2 options depuis réforme 2020)
    const acreAnnee1Radio = document.getElementById('acreAnnee1');
    const acreActive = acreAnnee1Radio ? acreAnnee1Radio.checked : false;
    
    const chargesRate = acreActive ? (taxSettings.acreActif / 100) : (taxSettings.acreInactif / 100);
    const chargesLabel = acreActive ? 'ACRE Année 1 (12 mois)' : 'Sans ACRE (taux plein)'
    
    // Déterminer période affichage (mensuel ou annuel)
    const periodeMensuelRadio = document.getElementById('periodeMensuel');
    const isMensuel = periodeMensuelRadio ? periodeMensuelRadio.checked : true;
    const multiplicateur = isMensuel ? 1 : 12;
    
    // Mise à jour label période
    const periodeLabel = document.getElementById('periodeLabel');
    if (periodeLabel) {
        periodeLabel.textContent = isMensuel ? '(Mensuelles)' : '(Annuelles)';
    }

    // 1. Charges sociales URSSAF
    const charges = ca * chargesRate;

    // 2. CFP (Contribution Formation Professionnelle) - OBLIGATOIRE
    const cfp = ca * (taxSettings.cfpBNC / 100);

    // 3. CFE mensuel
    const cfe = taxSettings.cfeAnnuel / 12;

    // === CALCUL SCENARIO VL ===
    const impotVL = ca * (taxSettings.versementLiberatoire / 100);
    const totalChargesVL = charges + cfp + impotVL + cfe;
    const netVL = ca - totalChargesVL;

    // === CALCUL SCENARIO IRPP ===
    const caAnnuel = ca * 12;
    const revenuImposable = calculateBNCRevenuImposable(caAnnuel);
    const impotAnnuelIRPP = calculateIRPPProgressif(revenuImposable);
    const impotIRPP = impotAnnuelIRPP / 12;
    const totalChargesIRPP = charges + cfp + impotIRPP + cfe;
    const netIRPP = ca - totalChargesIRPP;

    // === DÉTERMINER RÉGIME FISCAL SÉLECTIONNÉ ===
    const regimeVLRadio = document.getElementById('regimeVL');
    const useVL = regimeVLRadio ? regimeVLRadio.checked : false;
    
    // Choisir le scénario à afficher dans le tableau de détail
    const impotDetail = useVL ? impotVL : impotIRPP;
    const totalChargesDetail = useVL ? totalChargesVL : totalChargesIRPP;
    const netDetail = useVL ? netVL : netIRPP;
    const regimeLabel = useVL ? 'Versement Libératoire' : 'IRPP progressif';
    const impotTaux = useVL ? `${taxSettings.versementLiberatoire}%` : 'Barème';
    const impotBase = useVL ? (ca * multiplicateur).toFixed(2) : revenuImposable.toFixed(2);

    // === REMPLIR TABLEAU DE DETAIL (utilise régime sélectionné) ===
    const detailBody = document.getElementById('detailChargesBody');
    if (detailBody) {
        detailBody.innerHTML = `
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-12);">Charges sociales URSSAF <small style="color: var(--color-text-secondary);">(${chargesLabel})</small></td>
                <td style="padding: var(--space-12); text-align: center;">${(chargesRate * 100).toFixed(1)}%</td>
                <td style="padding: var(--space-12); text-align: right;">${(ca * multiplicateur).toFixed(2)} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold);">${(charges * multiplicateur).toFixed(2)} €</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-12);">CFP <small style="color: var(--color-text-secondary);">(Formation professionnelle)</small></td>
                <td style="padding: var(--space-12); text-align: center;">${taxSettings.cfpBNC}%</td>
                <td style="padding: var(--space-12); text-align: right;">${(ca * multiplicateur).toFixed(2)} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold);">${(cfp * multiplicateur).toFixed(2)} €</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-12);">Impôt sur le revenu <small style="color: var(--color-text-secondary);">(${regimeLabel})</small></td>
                <td style="padding: var(--space-12); text-align: center;">${impotTaux}</td>
                <td style="padding: var(--space-12); text-align: right;">${impotBase} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold);">${(impotDetail * multiplicateur).toFixed(2)} €</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-12);">CFE <small style="color: var(--color-text-secondary);">(Cotisation Foncière Entreprises)</small></td>
                <td style="padding: var(--space-12); text-align: center;">—</td>
                <td style="padding: var(--space-12); text-align: right;">—</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold);">${(cfe * multiplicateur).toFixed(2)} €</td>
            </tr>
        `;
    }
    document.getElementById('detailTotalCharges') && (document.getElementById('detailTotalCharges').textContent = (totalChargesDetail * multiplicateur).toFixed(2) + ' €');
    document.getElementById('detailRevenuNet') && (document.getElementById('detailRevenuNet').textContent = (netDetail * multiplicateur).toFixed(2) + ' €');

    // === COMPARAISON VL vs IRPP ===
    const scenarios = {
        vl: { charges, cfp, impot: impotVL, cfe, total: totalChargesVL, net: netVL },
        irpp: { charges, cfp, impot: impotIRPP, cfe, total: totalChargesIRPP, net: netIRPP }
    };
    updateComparaisonVL_IRPP(ca, multiplicateur, scenarios);
    
    // === PROJECTION 3-5 ANS ===
    updateProjection3_5Ans(ca, multiplicateur, scenarios);
    
    // === GRAPHIQUE DISTRIBUTION CHARGES ===
    renderChargesDistributionChart(scenarios, multiplicateur);
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

// Event listeners pour les radio buttons ACRE
const acreAnnee1 = document.getElementById('acreAnnee1');
const acreAnnee2Plus = document.getElementById('acreAnnee2Plus');
if (acreAnnee1) acreAnnee1.addEventListener('change', calculateTaxes);
if (acreAnnee2Plus) acreAnnee2Plus.addEventListener('change', calculateTaxes);

// Event listeners pour les radio buttons Régime Fiscal
const regimeIRPP = document.getElementById('regimeIRPP');
const regimeVL = document.getElementById('regimeVL');
if (regimeIRPP) regimeIRPP.addEventListener('change', calculateTaxes);
if (regimeVL) regimeVL.addEventListener('change', calculateTaxes);

// Event listeners pour les radio buttons Mensuel/Annuel
const periodeMensuel = document.getElementById('periodeMensuel');
const periodeAnnuel = document.getElementById('periodeAnnuel');
if (periodeMensuel) periodeMensuel.addEventListener('change', calculateTaxes);
if (periodeAnnuel) periodeAnnuel.addEventListener('change', calculateTaxes);

// Event listeners pour CFE commune et RFR
const communeInput = document.getElementById('communeInput');
const rfrInput = document.getElementById('rfrInput');
if (communeInput) {
    // Autocomplétion dynamique + update CFE
    let communeDebounceTimer;
    communeInput.addEventListener('input', (e) => {
        clearTimeout(communeDebounceTimer);
        communeDebounceTimer = setTimeout(() => {
            searchCommunesAPI(e.target.value);
        }, 300);
    });
    
    // Clic en dehors pour fermer autocomplete
    document.addEventListener('click', (e) => {
        if (!communeInput.contains(e.target) && !document.getElementById('communeAutocomplete').contains(e.target)) {
            document.getElementById('communeAutocomplete').style.display = 'none';
        }
    });
}
if (rfrInput) rfrInput.addEventListener('input', verifierEligibiliteVL);

// Event listeners pour validation SIRET (tous les champs)
const siretFields = [
    { input: 'clientSiret', status: 'clientSiretStatus', info: 'clientSiretInfo' },
    { input: 'clientFormSiret', status: 'clientFormSiretStatus', info: 'clientFormSiretInfo' },
    { input: 'companyLegalSiret', status: 'companyLegalSiretStatus', info: 'companyLegalSiretInfo' },
    { input: 'editClientSiret', status: 'editClientSiretStatus', info: 'editClientSiretInfo' }
];

siretFields.forEach(field => {
    const input = document.getElementById(field.input);
    if (input) {
        let siretDebounceTimer;
        
        // Contrôle strict : seulement chiffres
        input.addEventListener('keypress', (e) => {
            // Autoriser seulement chiffres (0-9)
            if (!/^\d$/.test(e.key)) {
                e.preventDefault();
            }
        });
        
        // Contrôle paste : filtrer caractères non-numériques
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const numericOnly = pastedText.replace(/\D/g, '').slice(0, 14); // Max 14 chiffres
            
            // Insérer texte nettoyé
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const currentValue = input.value.replace(/\D/g, '');
            const newValue = currentValue.slice(0, start) + numericOnly + currentValue.slice(end);
            input.value = newValue.slice(0, 14);
            
            // Déclencher validation
            const event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);
        });
        
        input.addEventListener('input', (e) => {
            clearTimeout(siretDebounceTimer);
            
            // Nettoyer : seulement chiffres
            let siret = e.target.value.replace(/\D/g, ''); // Supprimer tout sauf chiffres
            
            // Limiter à 14 caractères
            if (siret.length > 14) {
                siret = siret.slice(0, 14);
            }
            
            // Mettre à jour l'input (sans espaces pour l'instant)
            e.target.value = siret;
            
            // Validation selon longueur
            if (siret.length === 14) {
                siretDebounceTimer = setTimeout(() => {
                    validateSIRET(siret, field.status, field.info);
                }, 500);
            } else if (siret.length > 0) {
                updateSiretStatus(field.status, field.info, 'pending', `${siret.length}/14 chiffres`);
            } else {
                updateSiretStatus(field.status, field.info, 'empty', '');
            }
        });
    }
});

// Event listener pour date début activité ACRE
const dateDebutActiviteInput = document.getElementById('dateDebutActivite');
if (dateDebutActiviteInput) dateDebutActiviteInput.addEventListener('change', calculateACREPeriod);

// Event listener pour export PDF simulateur
const exportSimulateurPDFBtn = document.getElementById('exportSimulateurPDF');
if (exportSimulateurPDFBtn) {
    exportSimulateurPDFBtn.addEventListener('click', exportSimulateurPDF);
}

// Event listeners pour save/reset simulation
const saveSimulationBtn = document.getElementById('saveSimulation');
const resetSimulationBtn = document.getElementById('resetSimulation');
if (saveSimulationBtn) {
    saveSimulationBtn.addEventListener('click', saveSimulationParams);
}
if (resetSimulationBtn) {
    resetSimulationBtn.addEventListener('click', resetSimulationParams);
}

// Cache API CFE (localStorage)
const CFE_CACHE_KEY = 'mti_cfe_api_cache';
const CFE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 jours

// Base de données codes INSEE + codes postaux principales communes (fallback)
const inseeCodesDB = {
    'paris': { insee: '75056', cp: '75000' },
    'lyon': { insee: '69123', cp: '69000' },
    'marseille': { insee: '13055', cp: '13000' },
    'toulouse': { insee: '31555', cp: '31000' },
    'nice': { insee: '06088', cp: '06000' },
    'nantes': { insee: '44109', cp: '44000' },
    'montpellier': { insee: '34172', cp: '34000' },
    'strasbourg': { insee: '67482', cp: '67000' },
    'bordeaux': { insee: '33063', cp: '33000' },
    'lille': { insee: '59350', cp: '59000' },
    'rennes': { insee: '35238', cp: '35000' },
    'reims': { insee: '51454', cp: '51100' },
    'tourcoing': { insee: '59599', cp: '59200' },
    'roubaix': { insee: '59512', cp: '59100' },
    'la madeleine': { insee: '59368', cp: '59110' },
    'madeleine': { insee: '59368', cp: '59110' } // Alias pour recherche partielle
};

// Base de données CFE fallback (estimations si API échoue)
const cfeFallbackDB = {
    'paris': 2433,
    'lyon': 1500,
    'marseille': 1200,
    'toulouse': 900,
    'nice': 1100,
    'nantes': 800,
    'montpellier': 750,
    'strasbourg': 850,
    'bordeaux': 950,
    'lille': 700,
    'rennes': 650,
    'reims': 600,
    'la madeleine': 418,
    'default': 600
};

// Fonction récupération CFE depuis API Open Data Soft
async function getCFEFromAPI(commune) {
    const communeLower = commune.toLowerCase();
    
    // 1. Vérifier cache localStorage
    const cache = JSON.parse(localStorage.getItem(CFE_CACHE_KEY) || '{}');
    const cached = cache[communeLower];
    if (cached && Date.now() - cached.timestamp < CFE_CACHE_TTL) {
        return { taux: cached.taux, source: 'API (cache)', inseeCode: cached.inseeCode };
    }
    
    // 2. Rechercher code INSEE (recherche par nom ou code postal)
    let inseeCode = null;
    for (const [ville, data] of Object.entries(inseeCodesDB)) {
        // Recherche par nom de ville (partielle)
        if (communeLower.includes(ville) || ville.includes(communeLower)) {
            inseeCode = data.insee;
            break;
        }
        // Recherche par code postal
        if (data.cp && communeLower.replace(/\s/g, '') === data.cp.replace(/\s/g, '')) {
            inseeCode = data.insee;
            break;
        }
    }
    
    if (!inseeCode) {
        // Fallback estimation si commune inconnue
        const fallback = cfeFallbackDB[communeLower] || cfeFallbackDB.default;
        return { taux: fallback, source: 'Estimation (commune non référencée)', inseeCode: null };
    }
    
    // 3. Appel API Open Data Soft
    try {
        const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-entreprises/records?limit=1&refine=exercice:"2024"&refine=insee_com:"${inseeCode}"`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const tauxCFE = result.taux_global_cfe_hz;
            
            if (tauxCFE !== null && tauxCFE !== undefined) {
                // Conversion taux (%) vers base minimale estimée (€)
                // Note: l'API donne le TAUX CFE, pas la base minimale
                // Base minimale 2024: entre 237€ et 7,349€ selon CA
                // Estimation base minimale moyenne: 1,200€
                const baseMinimaleEstimee = 1200;
                const cfeEstimee = Math.round((tauxCFE / 100) * baseMinimaleEstimee);
                
                // Mise à jour cache
                cache[communeLower] = {
                    taux: cfeEstimee,
                    inseeCode: inseeCode,
                    timestamp: Date.now()
                };
                localStorage.setItem(CFE_CACHE_KEY, JSON.stringify(cache));
                
                return { taux: cfeEstimee, source: 'API DGFiP 2024 (taux officiel)', inseeCode: inseeCode, tauxPct: tauxCFE };
            }
        }
        
        // Si API ne retourne pas de résultat, utiliser fallback
        const fallback = cfeFallbackDB[communeLower] || cfeFallbackDB.default;
        return { taux: fallback, source: 'Estimation (données API incomplètes)', inseeCode: inseeCode };
        
    } catch (error) {
        console.warn('Erreur API CFE:', error);
        const fallback = cfeFallbackDB[communeLower] || cfeFallbackDB.default;
        return { taux: fallback, source: 'Estimation (erreur API)', inseeCode: inseeCode };
    }
}

// Fonction recherche communes dynamique via API
let communesSearchCache = {};
async function searchCommunesAPI(query) {
    const autocompleteDiv = document.getElementById('communeAutocomplete');
    if (!autocompleteDiv) return;
    
    if (!query || query.length < 2) {
        autocompleteDiv.style.display = 'none';
        return;
    }
    
    // Vérifier cache
    if (communesSearchCache[query]) {
        displayCommunesResults(communesSearchCache[query]);
        return;
    }
    
    // Afficher loading
    autocompleteDiv.style.display = 'block';
    autocompleteDiv.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--color-text-secondary);">🔄 Recherche...</div>';
    
    try {
        // API Open Data Soft - Recherche communes avec support jokers (*)
        // Remplacer les jokers utilisateur (%, *) par des espaces pour recherche partielle
        const cleanQuery = query.replace(/[%*]/g, ' ');
        
        // Recherche par nom de commune (partielle, insensible à la casse)
        const searchByName = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-entreprises/records?select=libcom,insee_com,code_postal&where=search(libcom,'${encodeURIComponent(cleanQuery)}')&group_by=libcom,insee_com,code_postal&limit=10&refine=exercice:"2024"`;
        
        // Si la requête ressemble à un code postal (5 chiffres), recherche aussi par CP
        let searchByCP = null;
        if (/^\d{5}$/.test(query.replace(/\s/g, ''))) {
            searchByCP = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-entreprises/records?select=libcom,insee_com,code_postal&where=code_postal='${query.replace(/\s/g, '')}'&group_by=libcom,insee_com,code_postal&limit=10&refine=exercice:"2024"`;
        }
        
        // Lancer les recherches en parallèle
        const promises = [fetch(searchByName)];
        if (searchByCP) promises.push(fetch(searchByCP));
        
        const responses = await Promise.all(promises);
        const dataResults = await Promise.all(responses.map(r => r.json()));
        
        // Fusionner les résultats (dédupliquer par INSEE)
        const allResults = [];
        const seenInsee = new Set();
        
        dataResults.forEach(data => {
            if (data.results) {
                data.results.forEach(r => {
                    if (!seenInsee.has(r.insee_com)) {
                        seenInsee.add(r.insee_com);
                        allResults.push(r);
                    }
                });
            }
        });
        
        if (allResults.length > 0) {
            communesSearchCache[query] = allResults;
            displayCommunesResults(allResults);
        } else {
            autocompleteDiv.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--color-text-secondary);">Aucune commune trouvée<br><small>Astuce: Essayez une recherche partielle (ex: "MADEL" pour La Madeleine) ou un code postal (59110)</small></div>';
        }
    } catch (error) {
        console.error('Erreur recherche communes:', error);
        autocompleteDiv.innerHTML = '<div style="padding: 12px; text-align: center; color: red;">❌ Erreur API</div>';
    }
}

function displayCommunesResults(results) {
    const autocompleteDiv = document.getElementById('communeAutocomplete');
    if (!autocompleteDiv) return;
    
    autocompleteDiv.style.display = 'block';
    autocompleteDiv.innerHTML = results.map(r => {
        const codePostal = r.code_postal || '';
        const displayCP = codePostal ? ` - CP ${codePostal}` : '';
        return `
        <div class="commune-result" data-commune="${r.libcom}" data-insee="${r.insee_com}" style="padding: 12px; cursor: pointer; border-bottom: 1px solid var(--color-border); transition: background 0.2s;">
            <strong>${r.libcom}</strong> <span style="color: var(--color-text-secondary); font-size: 12px;">(INSEE ${r.insee_com}${displayCP})</span>
        </div>
    `;
    }).join('');
    
    // Event listeners pour sélection
    document.querySelectorAll('.commune-result').forEach(el => {
        el.addEventListener('mouseenter', (e) => e.target.style.background = 'var(--color-bg-1)');
        el.addEventListener('mouseleave', (e) => e.target.style.background = 'white');
        el.addEventListener('click', async (e) => {
            const commune = e.currentTarget.dataset.commune;
            communeInput.value = commune;
            autocompleteDiv.style.display = 'none';
            await updateCFEEstimation(); // Déclencher calcul CFE
        });
    });
}

// Cache validation SIRET (90 jours)
const SIRET_CACHE_KEY = 'mti_siret_cache';
const SIRET_CACHE_TTL = 90 * 24 * 60 * 60 * 1000; // 90 jours
const INSEE_API_KEY = '84dbb5c2-6a3c-41d4-9bb5-c26a3c41d4f4'; // Clé API SIRENE INSEE

async function validateSIRET(siret, statusElementId, infoElementId) {
    const statusEl = document.getElementById(statusElementId);
    const infoEl = document.getElementById(infoElementId);
    
    if (!statusEl || !infoEl) return;
    
    // Vérifier format (14 chiffres)
    if (!/^\d{14}$/.test(siret)) {
        updateSiretStatus(statusElementId, infoElementId, 'error', 'Format invalide (14 chiffres requis)');
        return;
    }
    
    // Vérifier cache
    const cache = JSON.parse(localStorage.getItem(SIRET_CACHE_KEY) || '{}');
    const cached = cache[siret];
    if (cached && Date.now() - cached.timestamp < SIRET_CACHE_TTL) {
        const cacheLabel = cached.source === 'insee' ? '💾' : '⚠️';
        const btnId = `fill-${statusElementId}`;
        updateSiretStatus(statusElementId, infoElementId, 'valid', 
            `✅ ${cached.nom} (${cached.etat}) ${cacheLabel} Cache<br><button id="${btnId}" style="margin-top: 4px; padding: 4px 8px; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">📋 Remplir les champs</button>`
        );
        
        // Event listener pour bouton de remplissage manuel
        setTimeout(() => {
            const fillBtn = document.getElementById(btnId);
            if (fillBtn) {
                fillBtn.addEventListener('click', () => {
                    autoFillClientFromSIRET(statusElementId, cached);
                });
            }
        }, 100);
        
        return;
    }
    
    // Loading
    updateSiretStatus(statusElementId, infoElementId, 'loading', '🔄 Vérification INSEE...');
    
    try {
        // API SIRENE INSEE Officielle (https://api.insee.fr/api-sirene/3.11)
        const url = `https://api.insee.fr/api-sirene/3.11/siret/${siret}`;
        const response = await fetch(url, {
            headers: {
                'X-INSEE-Api-Key-Integration': INSEE_API_KEY,
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.etablissement) {
                const etab = data.etablissement;
                const ul = etab.uniteLegale;
                const periode = etab.periodesEtablissement[0]; // Période la plus récente
                
                // Extraction données
                const nom = ul.denominationUniteLegale || 
                           `${ul.prenomUsuelUniteLegale || ''} ${ul.nomUniteLegale || ''}`.trim() ||
                           ul.denominationUsuelle1UniteLegale ||
                           'Entreprise sans dénomination';
                
                const etat = periode.etatAdministratifEtablissement === 'A' ? 'Actif' : 'Fermé';
                const etatUL = ul.etatAdministratifUniteLegale === 'A' ? 'Active' : 'Cessée';
                
                // Adresse
                const adr = etab.adresseEtablissement;
                const adresse = [
                    adr.numeroVoieEtablissement,
                    adr.typeVoieEtablissement,
                    adr.libelleVoieEtablissement,
                    adr.codePostalEtablissement,
                    adr.libelleCommuneEtablissement
                ].filter(Boolean).join(' ');
                
                // Informations complémentaires
                const sigle = ul.sigleUniteLegale ? ` (${ul.sigleUniteLegale})` : '';
                const categorieJuridique = ul.categorieJuridiqueUniteLegale;
                const naf = etab.uniteLegale.activitePrincipaleUniteLegale;
                const typeSiege = etab.etablissementSiege ? 'Siège social' : 'Établissement';
                
                // Mise à jour cache
                cache[siret] = {
                    nom: nom + sigle,
                    etat: etat,
                    etatUL: etatUL,
                    adresse: adresse,
                    categorieJuridique: categorieJuridique,
                    naf: naf,
                    typeSiege: typeSiege,
                    source: 'insee',
                    timestamp: Date.now()
                };
                localStorage.setItem(SIRET_CACHE_KEY, JSON.stringify(cache));
                
                // Affichage résultat détaillé
                const etablissementLabel = etab.etablissementSiege ? '🏢 Siège' : '📍 Établissement';
                const message = `✅ ${nom}${sigle} (${etat} - ${etatUL})<br>${etablissementLabel} ${adresse}<br><small>NAF: ${naf} | CJ: ${categorieJuridique}</small>`;
                updateSiretStatus(statusElementId, infoElementId, 'valid', message);
                
                // Auto-remplissage des champs client si SIRET valide
                autoFillClientFromSIRET(statusElementId, cache[siret]);
            } else {
                updateSiretStatus(statusElementId, infoElementId, 'error', '❌ SIRET non trouvé dans la base SIRENE INSEE');
            }
        } else if (response.status === 404) {
            updateSiretStatus(statusElementId, infoElementId, 'error', '❌ SIRET non trouvé (404)');
        } else if (response.status === 401 || response.status === 403) {
            // Fallback vers API Recherche Entreprises si problème de clé
            console.warn('Erreur authentification INSEE, fallback vers API Recherche Entreprises');
            await validateSIRETFallback(siret, statusElementId, infoElementId, cache);
        } else {
            updateSiretStatus(statusElementId, infoElementId, 'error', `⚠️ Erreur API (${response.status})`);
        }
    } catch (error) {
        console.error('Erreur validation SIRET INSEE:', error);
        // Fallback vers API Recherche Entreprises
        await validateSIRETFallback(siret, statusElementId, infoElementId, cache);
    }
}

// Fonction fallback si API INSEE échoue
async function validateSIRETFallback(siret, statusElementId, infoElementId, cache) {
    try {
        const url = `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const entreprise = data.results[0];
            const nom = entreprise.nom_complet || entreprise.nom_raison_sociale;
            const etat = entreprise.etat_administratif === 'A' ? 'Actif' : 'Fermé';
            const adresse = entreprise.siege?.adresse || '';
            
            // Mise à jour cache (source: fallback)
            cache[siret] = {
                nom: nom,
                etat: etat,
                adresse: adresse,
                source: 'fallback',
                timestamp: Date.now()
            };
            localStorage.setItem(SIRET_CACHE_KEY, JSON.stringify(cache));
            
            // Affichage résultat
            const message = `✅ ${nom} (${etat})${adresse ? `<br>${adresse}` : ''}<br><small>⚠️ Source: API Recherche Entreprises (fallback)</small>`;
            updateSiretStatus(statusElementId, infoElementId, 'valid', message);
            
            // Auto-remplissage des champs client (fallback)
            autoFillClientFromSIRET(statusElementId, cache[siret]);
        } else {
            updateSiretStatus(statusElementId, infoElementId, 'error', '❌ SIRET non trouvé');
        }
    } catch (error) {
        console.error('Erreur fallback SIRET:', error);
        updateSiretStatus(statusElementId, infoElementId, 'error', '⚠️ Erreur API (vérifiez votre connexion)');
    }
}

// Fonction auto-remplissage champs client depuis données SIRENE
function autoFillClientFromSIRET(statusElementId, siretData) {
    if (!siretData) return;
    
    // Mapping des champs selon le contexte (input SIRET utilisé)
    const fieldMappings = {
        'clientSiretStatus': {
            name: 'clientName',
            address: 'clientAddress',
            naf: null,
            categorieJuridique: null,
            etat: null,
            typeSiege: null
        },
        'clientFormSiretStatus': {
            name: 'clientFormName',
            address: 'clientFormAddress',
            naf: 'clientFormNAF',
            categorieJuridique: 'clientFormCategorieJuridique',
            etat: 'clientFormEtat',
            typeSiege: 'clientFormTypeSiege'
        },
        'editClientSiretStatus': {
            name: 'editClientName',
            address: 'editClientAddress',
            naf: null,
            categorieJuridique: null,
            etat: null,
            typeSiege: null
        },
        'companyLegalSiretStatus': {
            name: 'companyLegalName',
            address: 'companyLegalAddress',
            naf: null,
            categorieJuridique: null,
            etat: null,
            typeSiege: null
        }
    };
    
    const mapping = fieldMappings[statusElementId];
    if (!mapping) return;
    
    const fieldsToFill = [
        { field: document.getElementById(mapping.name), value: siretData.nom },
        { field: document.getElementById(mapping.address), value: siretData.adresse },
        { field: document.getElementById(mapping.naf), value: siretData.naf },
        { field: document.getElementById(mapping.categorieJuridique), value: siretData.categorieJuridique },
        { field: document.getElementById(mapping.etat), value: siretData.etat || siretData.etatUL },
        { field: document.getElementById(mapping.typeSiege), value: siretData.typeSiege }
    ];
    
    // Remplir tous les champs disponibles
    fieldsToFill.forEach(({ field, value }) => {
        if (field && value && !field.value.trim()) {
            field.value = value;
            // Animation highlight
            field.style.transition = 'background 0.5s';
            field.style.background = '#e3f2fd';
            setTimeout(() => field.style.background = '', 1000);
        }
    });
    
    // Toast notification avec détails
    let toastMsg = `✅ Informations SIRENE récupérées :\n${siretData.nom}`;
    if (siretData.naf) toastMsg += `\n📊 Activité (NAF): ${siretData.naf}`;
    if (siretData.categorieJuridique) toastMsg += `\n🏢 Catégorie juridique: ${siretData.categorieJuridique}`;
    showToast(toastMsg);
}

function updateSiretStatus(statusElementId, infoElementId, state, message) {
    const statusEl = document.getElementById(statusElementId);
    const infoEl = document.getElementById(infoElementId);
    
    if (!statusEl || !infoEl) return;
    
    const states = {
        'empty': { icon: '', info: '' },
        'pending': { icon: '⏳', info: message },
        'loading': { icon: '🔄', info: message },
        'valid': { icon: '✅', info: message },
        'error': { icon: '❌', info: message }
    };
    
    const current = states[state] || states.empty;
    statusEl.innerHTML = current.icon;
    infoEl.innerHTML = current.info; // Supporte HTML (balises <br>, <small>, etc.)
    infoEl.style.display = current.info ? 'block' : 'none';
    infoEl.style.color = state === 'valid' ? 'var(--color-success)' : state === 'error' ? 'var(--color-danger)' : 'var(--color-text-secondary)';
    infoEl.style.fontSize = '12px';
    infoEl.style.lineHeight = '1.4';
}

// Fonction estimation CFE par commune (version API)
async function updateCFEEstimation() {
    const commune = communeInput?.value.trim();
    const cfeEstimationDiv = document.getElementById('cfeEstimation');
    
    if (!cfeEstimationDiv) return;
    
    if (!commune) {
        cfeEstimationDiv.style.display = 'none';
        return;
    }
    
    // Affichage loading
    cfeEstimationDiv.style.display = 'block';
    cfeEstimationDiv.innerHTML = '<small>🔄 Recherche données officielles...</small>';
    
    // Récupération CFE (API ou fallback)
    const result = await getCFEFromAPI(commune);
    
    // Icône source selon fiabilité
    let sourceIcon = '📊'; // API officielle
    if (result.source.includes('Estimation')) sourceIcon = '⚠️';
    if (result.source.includes('cache')) sourceIcon = '💾';
    
    cfeEstimationDiv.style.display = 'block';
    cfeEstimationDiv.innerHTML = `
        <strong>📍 CFE pour "${commune}" :</strong> ${result.taux} €/an (${(result.taux / 12).toFixed(2)} €/mois)<br>
        <small style="color: var(--color-text-secondary);">
            ${sourceIcon} Source: ${result.source}
            ${result.inseeCode ? `<br>Code INSEE: ${result.inseeCode}` : ''}
            ${result.tauxPct ? `<br>Taux CFE: ${result.tauxPct}% (base minimale estimée: 1,200€)` : ''}
            <br><em>⚠️ CFE réelle = Taux × Base minimale (selon votre CA). Consultez votre avis CFE pour le montant exact.</em>
        </small>
    `;
    
    // Mettre à jour taxSettings.cfeAnnuel temporairement
    taxSettings.cfeAnnuel = result.taux;
    calculateTaxes();
}

// Fonction calcul période ACRE
function calculateACREPeriod() {
    const dateDebutInput = document.getElementById('dateDebutActivite');
    const acrePeriodeInfo = document.getElementById('acrePeriodeInfo');
    
    if (!dateDebutInput || !acrePeriodeInfo) return;
    
    const dateDebut = dateDebutInput.value;
    if (!dateDebut) {
        acrePeriodeInfo.style.display = 'none';
        return;
    }
    
    const debut = new Date(dateDebut);
    
    // Calculer le trimestre de début
    const trimestreDebut = Math.floor(debut.getMonth() / 3) + 1;
    const anneeDebut = debut.getFullYear();
    
    // Fin ACRE = fin du 3ème trimestre civil suivant
    // Trimestre actuel + 3 trimestres = 4 trimestres au total
    let trimestreFin = trimestreDebut + 3;
    let anneeFin = anneeDebut;
    
    if (trimestreFin > 4) {
        anneeFin++;
        trimestreFin -= 4;
    }
    
    // Dates de fin de trimestre
    const finsTrimestre = {
        1: `${anneeFin}-03-31`,
        2: `${anneeFin}-06-30`,
        3: `${anneeFin}-09-30`,
        4: `${anneeFin}-12-31`
    };
    
    const dateFin = new Date(finsTrimestre[trimestreFin]);
    const dateFinFormatted = dateFin.toLocaleDateString('fr-FR');
    
    // Vérifier si l'ACRE est encore active aujourd'hui
    const aujourdhui = new Date();
    const acreActive = aujourdhui <= dateFin;
    
    // Calculer durée restante
    const joursRestants = Math.ceil((dateFin - aujourdhui) / (1000 * 60 * 60 * 24));
    const moisRestants = Math.floor(joursRestants / 30);
    
    // Afficher les informations
    acrePeriodeInfo.style.display = 'block';
    
    if (acreActive) {
        acrePeriodeInfo.style.background = 'rgba(var(--color-teal-500-rgb), 0.15)';
        acrePeriodeInfo.style.border = '1px solid rgba(var(--color-teal-500-rgb), 0.25)';
        acrePeriodeInfo.style.color = 'var(--color-success)';
        acrePeriodeInfo.innerHTML = `
            <strong>✅ Période ACRE active</strong><br>
            <small style="color: var(--color-text-secondary);">
                Début : ${debut.toLocaleDateString('fr-FR')} (T${trimestreDebut} ${anneeDebut})<br>
                Fin : ${dateFinFormatted} (fin T${trimestreFin} ${anneeFin})<br>
                <strong>Durée restante : ${moisRestants} mois (${joursRestants} jours)</strong>
            </small>
        `;
        
        // Activer automatiquement le radio "Avec ACRE"
        const acreRadio = document.getElementById('acreAnnee1');
        if (acreRadio) acreRadio.checked = true;
    } else {
        acrePeriodeInfo.style.background = 'rgba(255, 152, 0, 0.15)';
        acrePeriodeInfo.style.border = '1px solid rgba(255, 152, 0, 0.25)';
        acrePeriodeInfo.style.color = 'var(--color-warning)';
        acrePeriodeInfo.innerHTML = `
            <strong>⚠️ Période ACRE expirée</strong><br>
            <small style="color: var(--color-text-secondary);">
                Début : ${debut.toLocaleDateString('fr-FR')}<br>
                Fin : ${dateFinFormatted}<br>
                <strong>Taux plein URSSAF applicable (24,6%)</strong>
            </small>
        `;
        
        // Activer automatiquement le radio "Sans ACRE"
        const sansAcreRadio = document.getElementById('acreAnnee2Plus');
        if (sansAcreRadio) sansAcreRadio.checked = true;
    }
    
    // Recalculer les taxes
    calculateTaxes();
}

// Fonction sauvegarde paramètres simulation
function saveSimulationParams() {
    const params = {
        ca: parseFloat(caInput?.value) || 0,
        acreAnnee1: document.getElementById('acreAnnee1')?.checked || false,
        dateDebutActivite: document.getElementById('dateDebutActivite')?.value || '',
        commune: communeInput?.value || '',
        rfr: parseFloat(rfrInput?.value) || 0,
        regimeVL: document.getElementById('regimeVL')?.checked || false,
        periodeMensuel: document.getElementById('periodeMensuel')?.checked || true
    };
    
    localStorage.setItem('mti_simulation_params', JSON.stringify(params));
    
    // Afficher confirmation
    const confirmDiv = document.getElementById('saveSimulationConfirmation');
    if (confirmDiv) {
        confirmDiv.style.display = 'block';
        setTimeout(() => {
            confirmDiv.style.display = 'none';
        }, 3000);
    }
}

// Fonction chargement paramètres simulation
function loadSimulationParams() {
    const saved = localStorage.getItem('mti_simulation_params');
    if (!saved) return;
    
    try {
        const params = JSON.parse(saved);
        
        // Restaurer les valeurs
        if (caInput) caInput.value = params.ca || 0;
        
        // Restaurer date début activité (ACRE)
        const dateDebutInput = document.getElementById('dateDebutActivite');
        if (dateDebutInput && params.dateDebutActivite) {
            dateDebutInput.value = params.dateDebutActivite;
            calculateACREPeriod();
        }
        
        // Restaurer ACRE (si pas de date, utiliser le param manuel)
        if (!params.dateDebutActivite) {
            if (params.acreAnnee1) {
                const acreAnnee1Radio = document.getElementById('acreAnnee1');
                if (acreAnnee1Radio) acreAnnee1Radio.checked = true;
            } else {
                const acreAnnee2Radio = document.getElementById('acreAnnee2Plus');
                if (acreAnnee2Radio) acreAnnee2Radio.checked = true;
            }
        }
        
        // Restaurer commune
        if (communeInput && params.commune) {
            communeInput.value = params.commune;
            updateCFEEstimation();
        }
        
        // Restaurer RFR
        if (rfrInput && params.rfr) {
            rfrInput.value = params.rfr;
            verifierEligibiliteVL();
        }
        
        // Restaurer régime fiscal
        if (params.regimeVL) {
            const vlRadio = document.getElementById('regimeVL');
            if (vlRadio) vlRadio.checked = true;
        } else {
            const irppRadio = document.getElementById('regimeIRPP');
            if (irppRadio) irppRadio.checked = true;
        }
        
        // Restaurer période
        if (params.periodeMensuel) {
            const mensuelRadio = document.getElementById('periodeMensuel');
            if (mensuelRadio) mensuelRadio.checked = true;
        } else {
            const annuelRadio = document.getElementById('periodeAnnuel');
            if (annuelRadio) annuelRadio.checked = true;
        }
        
        // Recalculer
        calculateTaxes();
    } catch (e) {
        console.error('Erreur chargement simulation:', e);
    }
}

// Fonction réinitialisation simulation
function resetSimulationParams() {
    if (caInput) caInput.value = 0;
    
    const acreAnnee1Radio = document.getElementById('acreAnnee1');
    if (acreAnnee1Radio) acreAnnee1Radio.checked = true;
    
    const dateDebutInput = document.getElementById('dateDebutActivite');
    if (dateDebutInput) dateDebutInput.value = '';
    
    if (communeInput) communeInput.value = '';
    if (rfrInput) rfrInput.value = '';
    
    const irppRadio = document.getElementById('regimeIRPP');
    if (irppRadio) irppRadio.checked = true;
    
    const mensuelRadio = document.getElementById('periodeMensuel');
    if (mensuelRadio) mensuelRadio.checked = true;
    
    // Masquer les zones dynamiques
    const cfeEstDiv = document.getElementById('cfeEstimation');
    if (cfeEstDiv) cfeEstDiv.style.display = 'none';
    
    const eligDiv = document.getElementById('eligibiliteVL');
    if (eligDiv) eligDiv.style.display = 'none';
    
    const acrePeriodeInfo = document.getElementById('acrePeriodeInfo');
    if (acrePeriodeInfo) acrePeriodeInfo.style.display = 'none';
    
    // Réinitialiser CFE par défaut
    taxSettings.cfeAnnuel = defaultSettings.cfeAnnuel || 600;
    
    // Supprimer de localStorage
    localStorage.removeItem('mti_simulation_params');
    
    // Recalculer
    calculateTaxes();
}

// Fonction vérification éligibilité Versement Libératoire
function verifierEligibiliteVL() {
    const rfr = parseFloat(rfrInput?.value) || 0;
    const eligibiliteDiv = document.getElementById('eligibiliteVL');
    
    if (!eligibiliteDiv) return;
    
    if (rfr === 0) {
        eligibiliteDiv.style.display = 'none';
        return;
    }
    
    const seuil = taxSettings.rfrMaxVL || 28797;
    const isEligible = rfr <= seuil;
    
    eligibiliteDiv.style.display = 'block';
    if (isEligible) {
        eligibiliteDiv.style.background = 'var(--color-success)';
        eligibiliteDiv.style.color = 'white';
        eligibiliteDiv.innerHTML = `✅ <strong>Éligible au Versement Libératoire</strong><br>RFR (${rfr.toFixed(0)} €) ≤ Seuil 2026 (${seuil.toFixed(0)} €)`;
    } else {
        eligibiliteDiv.style.background = 'var(--color-error)';
        eligibiliteDiv.style.color = 'white';
        eligibiliteDiv.innerHTML = `❌ <strong>Non éligible au Versement Libératoire</strong><br>RFR (${rfr.toFixed(0)} €) > Seuil 2026 (${seuil.toFixed(0)} €)`;
    }
}

// Fonction génération projection 3-5 ans
function updateProjection3_5Ans(ca, multiplicateur, baseScenario) {
    const projectionBody = document.getElementById('projectionTableBody');
    if (!projectionBody) return;
    
    const isMensuel = multiplicateur === 1;
    const anneesProjection = [2025, 2026, 2027, 2028, 2029];
    const tauxURSSAFBase = 24.6; // Taux standard 2025 (année 2+)
    
    // Déterminer régime fiscal sélectionné
    const regimeVLRadio = document.getElementById('regimeVL');
    const useVL = regimeVLRadio ? regimeVLRadio.checked : false;
    const impotBase = useVL ? baseScenario.vl.impot : baseScenario.irpp.impot;
    
    let html = '';
    anneesProjection.forEach((annee, index) => {
        const tauxURSSAF = tauxURSSAFBase + index; // +1%/an
        const urssaf = ca * (tauxURSSAF / 100) * multiplicateur;
        const cfp = ca * (taxSettings.cfpBNC / 100) * multiplicateur;
        const impot = impotBase * multiplicateur;
        const cfe = (taxSettings.cfeAnnuel / 12) * multiplicateur;
        const totalCharges = urssaf + cfp + impot + cfe;
        const revenuNet = (ca * multiplicateur) - totalCharges;
        
        const rowStyle = index === 0 ? 'background: var(--color-bg-1);' : '';
        
        html += `
            <tr style="border-bottom: 1px solid var(--color-border); ${rowStyle}">
                <td style="padding: var(--space-12); font-weight: var(--font-weight-semibold);">${annee}</td>
                <td style="padding: var(--space-12); text-align: center;">${tauxURSSAF.toFixed(1)}%</td>
                <td style="padding: var(--space-12); text-align: right;">${urssaf.toFixed(2)} €</td>
                <td style="padding: var(--space-12); text-align: right;">${cfp.toFixed(2)} €</td>
                <td style="padding: var(--space-12); text-align: right;">${impot.toFixed(2)} €</td>
                <td style="padding: var(--space-12); text-align: right;">${cfe.toFixed(2)} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold); color: var(--color-warning);">${totalCharges.toFixed(2)} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-bold); color: var(--color-primary);">${revenuNet.toFixed(2)} €</td>
            </tr>
        `;
    });
    
    projectionBody.innerHTML = html;
}

// Fonction rendu graphique distribution charges
function renderChargesDistributionChart(scenarios, multiplicateur) {
    const canvas = document.getElementById('chargesDistributionChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const { vl, irpp } = scenarios;
    const ca = parseFloat(caInput?.value) || 0;
    const caTotal = ca * multiplicateur;
    
    // Dimensions
    const chartWidth = canvas.width - 120;
    const chartHeight = canvas.height - 80;
    const barWidth = 80;
    const gap = 100;
    const startX = 60;
    const startY = canvas.height - 40;
    
    // Couleurs
    const colors = {
        urssaf: '#003366',
        cfp: '#0066cc',
        impot: '#3399ff',
        cfe: '#66b3ff',
        net: '#00cc66'
    };
    
    // Fonction de dessin barre empilée
    function drawStackedBar(x, scenario, label) {
        const scale = chartHeight / caTotal;
        let currentY = startY;
        
        // URSSAF
        const urssafHeight = scenario.charges * multiplicateur * scale;
        ctx.fillStyle = colors.urssaf;
        ctx.fillRect(x, currentY - urssafHeight, barWidth, urssafHeight);
        currentY -= urssafHeight;
        
        // CFP
        const cfpHeight = scenario.cfp * multiplicateur * scale;
        ctx.fillStyle = colors.cfp;
        ctx.fillRect(x, currentY - cfpHeight, barWidth, cfpHeight);
        currentY -= cfpHeight;
        
        // Impôt
        const impotHeight = scenario.impot * multiplicateur * scale;
        ctx.fillStyle = colors.impot;
        ctx.fillRect(x, currentY - impotHeight, barWidth, impotHeight);
        currentY -= impotHeight;
        
        // CFE
        const cfeHeight = scenario.cfe * multiplicateur * scale;
        ctx.fillStyle = colors.cfe;
        ctx.fillRect(x, currentY - cfeHeight, barWidth, cfeHeight);
        currentY -= cfeHeight;
        
        // Net
        const netHeight = scenario.net * multiplicateur * scale;
        ctx.fillStyle = colors.net;
        ctx.fillRect(x, currentY - netHeight, barWidth, netHeight);
        
        // Label
        ctx.fillStyle = '#000';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + barWidth / 2, startY + 20);
        
        // Total
        ctx.fillText(`${(scenario.total * multiplicateur).toFixed(0)} €`, x + barWidth / 2, startY + 35);
    }
    
    // Dessiner les deux barres
    drawStackedBar(startX, irpp, 'IRPP');
    drawStackedBar(startX + barWidth + gap, vl, 'VL');
    
    // Axe Y (échelle)
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX - 10, startY);
    ctx.lineTo(startX - 10, startY - chartHeight);
    ctx.stroke();
    
    // Valeurs axe Y
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const value = (caTotal / 5) * i;
        const y = startY - (chartHeight / 5) * i;
        ctx.fillText(`${value.toFixed(0)} €`, startX - 15, y + 4);
    }
}

// Fonction export PDF simulateur
function exportSimulateurPDF() {
    if (typeof jsPDF === 'undefined') {
        alert('⚠️ jsPDF non chargé. Vérifiez les paramètres pour activer la génération PDF.');
        return;
    }
    
    const pdf = new jsPDF();
    const ca = parseFloat(caInput?.value) || 0;
    const acreAnnee1Radio = document.getElementById('acreAnnee1');
    const acreActive = acreAnnee1Radio ? acreAnnee1Radio.checked : true;
    const periodeMensuelRadio = document.getElementById('periodeMensuel');
    const isMensuel = periodeMensuelRadio ? periodeMensuelRadio.checked : true;
    
    // Page 1: Titre et paramètres
    pdf.setFontSize(18);
    pdf.setTextColor(0, 51, 102);
    pdf.text('Simulation Charges Auto-Entrepreneur BNC', 10, 20);
    
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} - MTI CONSULTING`, 10, 28);
    
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text('PARAMÈTRES DE SIMULATION', 10, 40);
    pdf.setFontSize(10);
    pdf.text(`Chiffre d'affaires: ${ca.toFixed(2)} € ${isMensuel ? '(mensuel)' : '(annuel)'}`, 15, 48);
    pdf.text(`Situation ACRE: ${acreActive ? 'Année 1 (11,6%)' : 'Année 2+ (24,6%)'}`, 15, 54);
    pdf.text(`CFE annuelle: ${taxSettings.cfeAnnuel} €`, 15, 60);
    
    // Tableau de détail
    pdf.setFontSize(12);
    pdf.text('DÉTAIL DES CHARGES', 10, 72);
    pdf.setFontSize(9);
    pdf.text('(Valeurs basées sur scénario IRPP progressif)', 15, 78);
    
    // Ajouter note légale
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Sources légales: Décret n°2024-484 (URSSAF), Code du travail L6331-48 (CFP)', 10, 280);
    
    // Sauvegarder
    const fileName = `Simulation_AE_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    
    alert(`✅ Simulation exportée: ${fileName}`);
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
    canvas.height = 350;

    // Get full year data (12 months)
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const monthValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const data = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    // FIX: Utiliser getFilteredInvoices() au lieu de invoices directement
    const filteredInvoices = getFilteredInvoices();
    filteredInvoices.forEach(inv => {
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

    // FIX: Utiliser getFilteredInvoices() au lieu de invoices directement
    const filteredInvoices = getFilteredInvoices();
    filteredInvoices.forEach(inv => {
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
        const invoiceData = invoices.map(inv => {
            // Gestion multi-lignes : concat\u00e9ner les descriptions
            let description = '';
            let quantity = 0;
            let unitPrice = 0;
            
            if (inv.items && inv.items.length > 0) {
                // Nouvelle structure multi-lignes
                description = inv.items.map(item => item.description).join(' | ');
                quantity = inv.items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
                // Prix unitaire moyen pond\u00e9r\u00e9
                const totalQuantity = quantity;
                if (totalQuantity > 0) {
                    unitPrice = inv.total / totalQuantity;
                }
            } else {
                // Ancienne structure mono-ligne (compatibilit\u00e9)
                description = inv.description || '';
                quantity = inv.quantity || 0;
                unitPrice = inv.unitPrice || 0;
            }
            
            return {
                number: inv.number,
                client: inv.client,
                clientSiret: inv.clientSiret || '',
                clientAddress: inv.clientAddress || '',
                date: inv.date,
                dueDate: inv.dueDate,
                description: description,
                quantity: quantity,
                unitPrice: unitPrice,
                total: inv.total,
                status: inv.status,
                montantRecu: inv.montantRecu || 0,
                dateReception: inv.dateReception || ''
            };
        });

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
            // Protection double-clic
            if (newConfirm.disabled) return;
            newConfirm.disabled = true;
            newConfirm.style.opacity = '0.6';
            newConfirm.style.cursor = 'not-allowed';
            const originalText = newConfirm.textContent;
            newConfirm.textContent = '⏳ Envoi en cours...';

            if (!currentInvoiceData) {
                // Réactiver si données manquantes
                newConfirm.disabled = false;
                newConfirm.style.opacity = '1';
                newConfirm.style.cursor = 'pointer';
                newConfirm.textContent = originalText;
                return;
            }
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
            } finally {
                // Réactiver le bouton après traitement
                newConfirm.disabled = false;
                newConfirm.style.opacity = '1';
                newConfirm.style.cursor = 'pointer';
                newConfirm.textContent = originalText;
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

    // Force local logo file - always use assets/images/MTI_CONSULTING.png unless data-URI is provided
    const logoSrc = companyInfo.logoUrl && companyInfo.logoUrl.startsWith('data:') 
        ? companyInfo.logoUrl 
        : 'assets/images/MTI_CONSULTING.png';
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
    // Load data from localStorage first
    try {
        const storedRAMs = localStorage.getItem('mti_rams');
        if (storedRAMs) {
            rams = JSON.parse(storedRAMs);
            console.log(`✅ ${rams.length} RAMs chargés depuis localStorage`);
        }
    } catch (e) {
        console.warn('Erreur chargement RAMs localStorage:', e);
    }
    
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
    renderRAMList();  // Afficher les RAMs chargés depuis localStorage
    populateClientSelects();
    checkOverdueInvoices();
    applyFilters();
    renderCharts();
    calculateTaxes();
    updateCFEMensuel();
    loadCompanySettings();
    renderIRPPBareme(); // Initialiser l'UI du barème IRPP
    loadSimulationParams(); // Charger les paramètres de simulation sauvegardés

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

    // Setup RAM form auto-update invoice select
    setupRAMFormListeners();
    
    // Initial persist attempt
    initialRenderAndPersist();
}

// Setup listeners pour mise à jour automatique du select factures dans le formulaire RAM
function setupRAMFormListeners() {
    const clientInput = document.getElementById('ramClientInput');
    const monthSelect = document.getElementById('ramMonthSelect');
    const yearInput = document.getElementById('ramYearInput');
    
    if (!clientInput || !monthSelect || !yearInput) return;
    
    // Fonction pour mettre à jour le select des factures
    const updateInvoiceSelect = () => {
        const client = clientInput.value.trim();
        const month = parseInt(monthSelect.value);
        const year = parseInt(yearInput.value);
        
        if (client) {
            populateRAMInvoiceSelect(client, month, year);
        }
    };
    
    // Écouter les changements
    clientInput.addEventListener('blur', updateInvoiceSelect);
    monthSelect.addEventListener('change', updateInvoiceSelect);
    yearInput.addEventListener('change', updateInvoiceSelect);
}

// Start the app on DOM ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initialisation MTI CONSULTING v2.0...');
    
    // Auto-configuration depuis URL (déploiement script)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('autoconfig')) {
        try {
            const configData = JSON.parse(decodeURIComponent(urlParams.get('autoconfig')));
            saveConfigToStorage(configData);
            CONFIG = { ...CONFIG_DEFAULTS, ...configData };
            console.log('✅ Configuration automatique appliquée depuis URL');
            showToast('✅ Configuration importée avec succès ! Rechargez la page.', 'success');
            
            // Nettoyer l'URL après 2 secondes et recharger
            setTimeout(() => {
                window.history.replaceState({}, document.title, window.location.pathname);
                window.location.reload();
            }, 2000);
            return; // Stop l'initialisation, on recharge
        } catch (e) {
            console.error('Erreur auto-config:', e);
        }
    }
    
    // Afficher un message si aucune configuration n'est trouvée
    if (CONFIG.BACKEND_URL === 'https://script.google.com/macros/s/VOTRE_SCRIPT_ID/exec' || 
        CONFIG.BACKEND_URL.includes('VOTRE_SCRIPT_ID')) {
        console.warn('⚠️ Application non configurée - les fonctionnalités Drive/Calendar ne fonctionneront pas');
        showToast('⚠️ Configuration requise : Rendez-vous dans Paramètres → Configuration Technique', 'info');
        
        // Basculer automatiquement sur l'onglet Paramètres après 2 secondes
        setTimeout(() => {
            const parametresTab = document.querySelector('[data-tab="parametres"]');
            if (parametresTab) {
                parametresTab.click();
                showToast('👆 Configurez ici votre Backend URL et OAuth2', 'info');
            }
        }, 2000);
    }
    
    // Si le backend n'est pas configuré, skip les appels Drive et initialiser en mode dégradé
    const isConfigured = CONFIG.BACKEND_URL && !CONFIG.BACKEND_URL.includes('VOTRE_SCRIPT_ID');
    
    if (isConfigured) {
        // Backend configuré : vérifier le stockage Drive
        try {
            // First try the standard POST-based call
            try {
                const ensure = await callBackend('ensureStorage');
                if (ensure && ensure.success) {
                    console.log('✅ Drive storage verified:', ensure.data);
                    showToast('✅ Stockage Drive vérifié', 'success');
                }
            } catch (postErr) {
                // Likely CORS / network issue — try JSONP fallback
                console.warn('POST ensureStorage failed, trying JSONP fallback');
                try {
                    const ensureJsonp = await callBackendJSONP('ensureStorage');
                    if (ensureJsonp && ensureJsonp.success) {
                        console.log('✅ Drive storage verified (JSONP)');
                        showToast('✅ Stockage Drive vérifié (JSONP)', 'success');
                    }
                } catch (jsonpErr) {
                    console.warn('JSONP ensureStorage failed:', jsonpErr.message);
                }
            }

            // Charger depuis Drive
            await loadFromDrive();
        } catch (e) {
            console.warn('Erreur lors du chargement Drive:', e.message);
        }
    } else {
        // Backend non configuré : mode dégradé (localStorage uniquement)
        console.log('📴 Mode hors ligne : Backend non configuré');
    }
    
    // Toujours initialiser l'app (même en mode dégradé)
    try {
        initApp();
        console.log('✅ Application prête' + (isConfigured ? '' : ' (mode hors ligne)'));
    } catch (e) {
        console.error('Erreur initialisation app:', e);
        showToast('Erreur d\'initialisation', 'error');
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

    // Tableau multi-lignes
    if (doc.autoTable) {
        // Support multi-lignes (v2.0) : utiliser items[] si disponible, sinon fallback ancien format
        const tableBody = invoice.items && invoice.items.length > 0
            ? invoice.items.map(item => [
                item.description || '',
                (item.quantity || 0).toString(),
                `${(item.unitPrice || 0).toFixed(2)} €`,
                `${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)} €`
            ])
            : [[
                invoice.description || '',
                (invoice.quantity || 0).toString(),
                `${(invoice.unitPrice || 0).toFixed(2)} €`,
                `${(invoice.total || 0).toFixed(2)} €`
            ]];
        
        doc.autoTable({
            startY: 120,
            head: [['Description', 'Quantité', 'Prix unitaire', 'Total HT']],
            body: tableBody
        });
    } else {
        // Fallback sans autoTable
        if (invoice.items && invoice.items.length > 0) {
            let y = 120;
            invoice.items.forEach(item => {
                doc.text(`${item.description} - ${item.quantity} x ${item.unitPrice}€ = ${(item.quantity * item.unitPrice).toFixed(2)}€`, 20, y);
                y += 7;
            });
        } else {
            doc.text(invoice.description || '', 20, 120);
        }
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
// RAPPORT D'ACTIVITÉ MENSUELLE (RAM)
// ==========================================

// Générer le Rapport d'Activité Mensuelle pour une facture
async function generateRAMForInvoice(index) {
    const invoice = invoices[index];
    if (!invoice) {
        showToast('❌ Facture introuvable', 'error');
        return;
    }

    // Afficher le modal de saisie RAM
    showRAMModal(invoice);
}

window.generateRAMForInvoice = generateRAMForInvoice;

// Afficher le modal de saisie du RAM
function showRAMModal(invoice) {
    const invoiceDate = new Date(invoice.date);
    const month = invoiceDate.getMonth();
    const year = invoiceDate.getFullYear();
    
    // Créer le modal
    const modalHTML = `
        <div id="ramModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; border-radius: var(--radius-8); padding: var(--space-24); width: 95%; max-width: 1200px; max-height: 95vh; overflow-y: auto;">
                <h2 style="margin-bottom: var(--space-16);">📊 Rapport d'Activité Mensuelle</h2>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-16); margin-bottom: var(--space-16);">
                    <div>
                        <label style="display: block; margin-bottom: var(--space-8); font-weight: 600;">Mois :</label>
                        <select id="ramMonth" style="width: 100%; padding: var(--space-8); border: 1px solid var(--border-color); border-radius: var(--radius-4);">
                            <option value="0" ${month === 0 ? 'selected' : ''}>Janvier</option>
                            <option value="1" ${month === 1 ? 'selected' : ''}>Février</option>
                            <option value="2" ${month === 2 ? 'selected' : ''}>Mars</option>
                            <option value="3" ${month === 3 ? 'selected' : ''}>Avril</option>
                            <option value="4" ${month === 4 ? 'selected' : ''}>Mai</option>
                            <option value="5" ${month === 5 ? 'selected' : ''}>Juin</option>
                            <option value="6" ${month === 6 ? 'selected' : ''}>Juillet</option>
                            <option value="7" ${month === 7 ? 'selected' : ''}>Août</option>
                            <option value="8" ${month === 8 ? 'selected' : ''}>Septembre</option>
                            <option value="9" ${month === 9 ? 'selected' : ''}>Octobre</option>
                            <option value="10" ${month === 10 ? 'selected' : ''}>Novembre</option>
                            <option value="11" ${month === 11 ? 'selected' : ''}>Décembre</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: var(--space-8); font-weight: 600;">Année :</label>
                        <input type="number" id="ramYear" value="${year}" min="2020" max="2100" 
                               style="width: 100%; padding: var(--space-8); border: 1px solid var(--border-color); border-radius: var(--radius-4);" />
                    </div>
                </div>
                
                <button onclick="refreshRAMCalendar()" style="margin-bottom: var(--space-16); padding: var(--space-8) var(--space-16); background: var(--secondary-color); color: white; border: none; border-radius: var(--radius-4); cursor: pointer;">
                    🔄 Mettre à jour le calendrier
                </button>
                
                <div style="margin-bottom: var(--space-16);">
                    <label style="display: block; margin-bottom: var(--space-8); font-weight: 600;">Client :</label>
                    <select id="ramClientSelect" style="width: 100%; padding: var(--space-8); border: 1px solid var(--border-color); border-radius: var(--radius-4); margin-bottom: var(--space-8);">
                        <option value="">-- Sélectionner un client --</option>
                        ${clients.map(c => `<option value="${c.name}" ${c.name === invoice.client ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                    <input type="text" id="ramClientManual" placeholder="ou saisir manuellement un nom de client" 
                           style="width: 100%; padding: var(--space-8); border: 1px solid var(--border-color); border-radius: var(--radius-4);" />
                </div>
                
                <div style="margin-bottom: var(--space-16);">
                    <h3 style="margin-bottom: var(--space-12);">Planning mensuel :</h3>
                    <div style="max-height: 500px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-4);">
                        <table id="ramActivityTable" style="width: 100%; border-collapse: collapse;">
                            <thead style="position: sticky; top: 0; background: white; z-index: 10;">
                                <tr style="background: var(--primary-color); color: white;">
                                    <th style="padding: var(--space-8); border: 1px solid #ddd; text-align: left; width: 80px;">Jour</th>
                                    <th style="padding: var(--space-8); border: 1px solid #ddd; text-align: center; width: 60px;">Date</th>
                                    <th style="padding: var(--space-8); border: 1px solid #ddd; text-align: center; width: 100px;">Heures</th>
                                    <th style="padding: var(--space-8); border: 1px solid #ddd; text-align: left;">Commentaires</th>
                                </tr>
                            </thead>
                            <tbody id="ramActivityBody">
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div style="margin-bottom: var(--space-16);">
                    <label style="display: block; margin-bottom: var(--space-8); font-weight: 600;">Remarques :</label>
                    <textarea id="ramRemarks" rows="3" style="width: 100%; padding: var(--space-8); border: 1px solid var(--border-color); border-radius: var(--radius-4);"></textarea>
                </div>
                
                <div style="display: flex; gap: var(--space-12); justify-content: flex-end;">
                    <button onclick="closeRAMModal()" style="padding: var(--space-8) var(--space-16); background: #6c757d; color: white; border: none; border-radius: var(--radius-4); cursor: pointer;">
                        Annuler
                    </button>
                    <button onclick="generateRAMFromModal()" style="padding: var(--space-8) var(--space-16); background: var(--primary-color); color: white; border: none; border-radius: var(--radius-4); cursor: pointer;">
                        📄 Générer le PDF
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Générer le calendrier mensuel
    generateRAMCalendar(month, year);
}

window.showRAMModal = showRAMModal;

// Générer le calendrier mensuel complet
function generateRAMCalendar(month, year) {
    const tbody = document.getElementById('ramActivityBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        const dayName = dayNames[dayOfWeek];
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const bgColor = isWeekend ? '#f0f0f0' : 'white';
        
        const row = document.createElement('tr');
        row.style.background = bgColor;
        row.innerHTML = `
            <td style="padding: var(--space-4); border: 1px solid #ddd; background: ${bgColor};">
                ${dayName}
            </td>
            <td style="padding: var(--space-4); border: 1px solid #ddd; text-align: center; background: ${bgColor};">
                ${day.toString().padStart(2, '0')}
            </td>
            <td style="padding: var(--space-4); border: 1px solid #ddd; background: ${bgColor};">
                <input type="number" class="ram-hours" step="0.5" min="0" max="24" 
                       style="width: 100%; padding: var(--space-4); text-align: center;" 
                       value="${isWeekend ? '' : '7.5'}" 
                       data-date="${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}" />
            </td>
            <td style="padding: var(--space-4); border: 1px solid #ddd; background: ${bgColor};">
                <input type="text" class="ram-comment" 
                       style="width: 100%; padding: var(--space-4);" 
                       placeholder="Commentaires..." />
            </td>
        `;
        
        tbody.appendChild(row);
    }
}

window.generateRAMCalendar = generateRAMCalendar;

// Rafraîchir le calendrier quand on change le mois/année
function refreshRAMCalendar() {
    const month = parseInt(document.getElementById('ramMonth').value);
    const year = parseInt(document.getElementById('ramYear').value);
    generateRAMCalendar(month, year);
    showToast('✅ Calendrier mis à jour', 'success');
}

window.refreshRAMCalendar = refreshRAMCalendar;

// Fermer le modal RAM
function closeRAMModal() {
    const modal = document.getElementById('ramModal');
    if (modal) modal.remove();
}

window.closeRAMModal = closeRAMModal;

// Générer le RAM à partir des données du modal
async function generateRAMFromModal() {
    const clientSelect = document.getElementById('ramClientSelect').value;
    const clientManual = document.getElementById('ramClientManual').value;
    const client = clientManual || clientSelect;
    
    if (!client) {
        showToast('❌ Veuillez sélectionner ou saisir un client', 'error');
        return;
    }
    
    const month = parseInt(document.getElementById('ramMonth').value);
    const year = parseInt(document.getElementById('ramYear').value);
    
    // Vérifier si un RAM existe déjà pour ce client et ce mois
    const existingRAM = rams.find(r => r.client === client && r.month === month && r.year === year);
    if (existingRAM) {
        const monthName = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][month];
        showToast(`⚠️ Un RAM existe déjà pour ${client} - ${monthName} ${year}`, 'error');
        return;
    }
    
    // Récupérer toutes les lignes d'activité du calendrier
    const activities = [];
    const rows = document.querySelectorAll('#ramActivityBody tr');
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    rows.forEach((row, index) => {
        const hoursInput = row.querySelector('.ram-hours');
        const commentInput = row.querySelector('.ram-comment');
        const hours = parseFloat(hoursInput.value) || 0;
        const comment = commentInput.value || '';
        const date = hoursInput.dataset.date;
        const dateObj = new Date(date);
        const day = dayNames[dateObj.getDay()];
        
        // Inclure même les lignes vides pour avoir le calendrier complet
        activities.push({ 
            day, 
            date, 
            hours, 
            comment,
            dayNum: index + 1
        });
    });
    
    const remarks = document.getElementById('ramRemarks').value;
    
    // Créer l'objet RAM
    const monthName = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][month];
    const ram = {
        id: Date.now(),
        client,
        month,
        year,
        monthName,
        activities,
        remarks,
        createdAt: new Date().toISOString(),
        invoiceNumber: '' // À lier avec une facture si besoin
    };
    
    // Afficher l'aperçu
    closeRAMModal();
    showRAMPreview(ram);
}

window.generateRAMFromModal = generateRAMFromModal;

// Afficher l'aperçu du RAM
function showRAMPreview(ram) {
    const previewContainer = document.getElementById('ramPreview');
    if (!previewContainer) {
        // Créer le conteneur d'aperçu s'il n'existe pas
        const container = document.createElement('div');
        container.id = 'ramPreview';
        container.style.cssText = 'margin-top: var(--space-24); padding: var(--space-24); border: 2px solid var(--primary-color); border-radius: var(--radius-8); background: white;';
        document.getElementById('ramSection')?.appendChild(container);
    }
    
    const monthTotal = ram.activities.reduce((sum, a) => sum + (a.hours || 0), 0);
    
    const previewHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-16);">
            <h2>📊 Aperçu du RAM - ${ram.monthName} ${ram.year}</h2>
            <div style="display: flex; gap: var(--space-8);">
                <button onclick="editRAM(${ram.id})" class="btn btn-secondary">✏️ Modifier</button>
                <button onclick="saveRAM(${ram.id})" class="btn btn-primary">💾 Enregistrer</button>
                <button onclick="downloadRAMPDF(${ram.id})" class="btn btn-success">📄 Télécharger PDF</button>
                <button onclick="sendRAMEmail(${ram.id})" class="btn btn-info">📧 Envoyer</button>
            </div>
        </div>
        
        <div style="background: #f8f9fa; padding: var(--space-16); border-radius: var(--radius-4); margin-bottom: var(--space-16);">
            <p><strong>Client :</strong> ${ram.client}</p>
            <p><strong>Période :</strong> ${ram.monthName} ${ram.year}</p>
            <p><strong>Total heures :</strong> ${monthTotal.toFixed(2)}h</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: var(--space-16);">
            <thead>
                <tr style="background: var(--primary-color); color: white;">
                    <th style="padding: var(--space-8); border: 1px solid #ddd; text-align: left;">Jour</th>
                    <th style="padding: var(--space-8); border: 1px solid #ddd; text-align: center;">Date</th>
                    <th style="padding: var(--space-8); border: 1px solid #ddd; text-align: center;">Heures</th>
                    <th style="padding: var(--space-8); border: 1px solid #ddd; text-align: left;">Commentaires</th>
                </tr>
            </thead>
            <tbody>
                ${ram.activities.filter(a => a.hours > 0).map(activity => `
                    <tr>
                        <td style="padding: var(--space-8); border: 1px solid #ddd;">${activity.day}</td>
                        <td style="padding: var(--space-8); border: 1px solid #ddd; text-align: center;">${activity.dayNum}</td>
                        <td style="padding: var(--space-8); border: 1px solid #ddd; text-align: center;">${activity.hours.toFixed(2)}h</td>
                        <td style="padding: var(--space-8); border: 1px solid #ddd;">${activity.comment || '-'}</td>
                    </tr>
                `).join('')}
                <tr style="font-weight: bold; background: #e9ecef;">
                    <td colspan="2" style="padding: var(--space-8); border: 1px solid #ddd;">TOTAL</td>
                    <td style="padding: var(--space-8); border: 1px solid #ddd; text-align: center;">${monthTotal.toFixed(2)}h</td>
                    <td style="padding: var(--space-8); border: 1px solid #ddd;"></td>
                </tr>
            </tbody>
        </table>
        
        ${ram.remarks ? `
            <div style="margin-top: var(--space-16);">
                <h4>Remarques :</h4>
                <p style="white-space: pre-line; padding: var(--space-12); background: #f8f9fa; border-radius: var(--radius-4);">${ram.remarks}</p>
            </div>
        ` : ''}
    `;
    
    const ramPreviewElement = document.getElementById('ramPreview');
    if (ramPreviewElement) {
        ramPreviewElement.innerHTML = previewHTML;
        ramPreviewElement.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Stocker temporairement le RAM en cours
    window.currentRAM = ram;
}

window.showRAMPreview = showRAMPreview;

// Enregistrer le RAM
async function saveRAM(ramId) {
    const ram = window.currentRAM;
    if (!ram) {
        showToast('❌ Aucun RAM à enregistrer', 'error');
        return;
    }
    
    try {
        showToast('⏳ Enregistrement du RAM...');
        
        // Ajouter à la liste des RAMs
        const existingIndex = rams.findIndex(r => r.id === ram.id);
        if (existingIndex >= 0) {
            rams[existingIndex] = ram;
        } else {
            rams.push(ram);
        }
        
        // Sauvegarder localement
        localStorage.setItem('mti_rams', JSON.stringify(rams));
        
        // Synchroniser avec Drive
        await syncToDrive();
        
        // Exporter vers Google Sheets
        await exportRAMToSheets(ram);
        
        showToast('✅ RAM enregistré avec succès !', 'success');
        renderRAMList();
    } catch (error) {
        console.error('Erreur enregistrement RAM:', error);
        showToast('❌ Erreur lors de l\'enregistrement: ' + error.message, 'error');
    }
}

window.saveRAM = saveRAM;

// Télécharger le PDF du RAM
async function downloadRAMPDF(ramId) {
    const ram = window.currentRAM || rams.find(r => r.id === ramId);
    if (!ram) {
        showToast('❌ RAM introuvable', 'error');
        return;
    }
    
    try {
        showToast('⏳ Génération du PDF...');
        const pdfBase64 = await generateRAMPDF(ram);
        
        const link = document.createElement('a');
        link.href = 'data:application/pdf;base64,' + pdfBase64;
        const monthStr = (ram.month + 1).toString().padStart(2, '0');
        link.download = `RAM_${ram.year}${monthStr}_${ram.client.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        link.click();
        
        showToast('✅ PDF téléchargé !', 'success');
    } catch (error) {
        console.error('Erreur génération PDF:', error);
        showToast('❌ Erreur lors de la génération du PDF: ' + error.message, 'error');
    }
}

window.downloadRAMPDF = downloadRAMPDF;

// Envoyer le RAM par email
async function sendRAMEmail(ramId) {
    const ram = window.currentRAM || rams.find(r => r.id === ramId);
    if (!ram) {
        showToast('❌ RAM introuvable', 'error');
        return;
    }
    
    const clientObj = clients.find(c => c.name === ram.client);
    if (!clientObj || !clientObj.email_facturation) {
        showToast('❌ Email du client introuvable', 'error');
        return;
    }
    
    try {
        showToast('⏳ Génération et envoi du RAM...');
        const pdfBase64 = await generateRAMPDF(ram);
        
        // Envoyer via le backend
        const response = await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'sendRAMEmail',
                to: clientObj.email_facturation,
                client: ram.client,
                month: ram.monthName,
                year: ram.year,
                pdfBase64: pdfBase64
            })
        });
        
        const result = await response.json();
        if (result.success) {
            showToast('✅ RAM envoyé avec succès !', 'success');
        } else {
            throw new Error(result.error || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('Erreur envoi RAM:', error);
        showToast('❌ Erreur lors de l\'envoi: ' + error.message, 'error');
    }
}

window.sendRAMEmail = sendRAMEmail;

// Modifier le RAM
function editRAM(ramId) {
    const ram = window.currentRAM;
    if (!ram) return;
    
    // Ré-ouvrir le modal avec les données
    const modalHTML = `
        <div id="ramModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; border-radius: var(--radius-8); padding: var(--space-24); width: 95%; max-width: 1200px; max-height: 95vh; overflow-y: auto;">
                <h2 style="margin-bottom: var(--space-16);">📊 Modifier le Rapport d'Activité</h2>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-16); margin-bottom: var(--space-16);">
                    <div>
                        <label style="display: block; margin-bottom: var(--space-8); font-weight: 600;">Mois :</label>
                        <select id="ramMonth" style="width: 100%; padding: var(--space-8); border: 1px solid var(--border-color); border-radius: var(--radius-4);">
                            ${['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => `<option value="${i}" ${i === ram.month ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: var(--space-8); font-weight: 600;">Année :</label>
                        <input type="number" id="ramYear" value="${ram.year}" min="2020" max="2100" 
                               style="width: 100%; padding: var(--space-8); border: 1px solid var(--border-color); border-radius: var(--radius-4);" />
                    </div>
                </div>
                
                <div style="margin-bottom: var(--space-16);">
                    <label style="display: block; margin-bottom: var(--space-8); font-weight: 600;">Client :</label>
                    <input type="text" id="ramClientManual" value="${ram.client}"
                           style="width: 100%; padding: var(--space-8); border: 1px solid var(--border-color); border-radius: var(--radius-4);" />
                </div>
                
                <div style="margin-bottom: var(--space-16);">
                    <h3 style="margin-bottom: var(--space-12);">Planning mensuel :</h3>
                    <div style="max-height: 500px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-4);">
                        <table id="ramActivityTable" style="width: 100%; border-collapse: collapse;">
                            <thead style="position: sticky; top: 0; background: white; z-index: 10;">
                                <tr style="background: var(--primary-color); color: white;">
                                    <th style="padding: var(--space-8); border: 1px solid #ddd; text-align: left; width: 80px;">Jour</th>
                                    <th style="padding: var(--space-8); border: 1px solid #ddd; text-align: center; width: 60px;">Date</th>
                                    <th style="padding: var(--space-8); border: 1px solid #ddd; text-align: center; width: 100px;">Heures</th>
                                    <th style="padding: var(--space-8); border: 1px solid #ddd; text-align: left;">Commentaires</th>
                                </tr>
                            </thead>
                            <tbody id="ramActivityBody">
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div style="margin-bottom: var(--space-16);">
                    <label style="display: block; margin-bottom: var(--space-8); font-weight: 600;">Remarques :</label>
                    <textarea id="ramRemarks" rows="3" style="width: 100%; padding: var(--space-8); border: 1px solid var(--border-color); border-radius: var(--radius-4);">${ram.remarks || ''}</textarea>
                </div>
                
                <div style="display: flex; gap: var(--space-12); justify-content: flex-end;">
                    <button onclick="closeRAMModal()" style="padding: var(--space-8) var(--space-16); background: #6c757d; color: white; border: none; border-radius: var(--radius-4); cursor: pointer;">
                        Annuler
                    </button>
                    <button onclick="updateRAMFromModal()" style="padding: var(--space-8) var(--space-16); background: var(--primary-color); color: white; border: none; border-radius: var(--radius-4); cursor: pointer;">
                        ✅ Valider les modifications
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Remplir le tableau avec les données existantes
    const tbody = document.getElementById('ramActivityBody');
    ram.activities.forEach(activity => {
        const isWeekend = (activity.day === 'Samedi' || activity.day === 'Dimanche');
        const bgColor = isWeekend ? '#f0f0f0' : 'white';
        
        const row = document.createElement('tr');
        row.style.background = bgColor;
        row.innerHTML = `
            <td style="padding: var(--space-4); border: 1px solid #ddd; background: ${bgColor};">${activity.day}</td>
            <td style="padding: var(--space-4); border: 1px solid #ddd; text-align: center; background: ${bgColor};">${activity.dayNum}</td>
            <td style="padding: var(--space-4); border: 1px solid #ddd; background: ${bgColor};">
                <input type="number" class="ram-hours" step="0.5" min="0" max="24" 
                       style="width: 100%; padding: var(--space-4); text-align: center;" 
                       value="${activity.hours || ''}" 
                       data-date="${activity.date}" />
            </td>
            <td style="padding: var(--space-4); border: 1px solid #ddd; background: ${bgColor};">
                <input type="text" class="ram-comment" 
                       style="width: 100%; padding: var(--space-4);" 
                       value="${activity.comment || ''}" />
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.editRAM = editRAM;

// Mettre à jour le RAM depuis le modal d'édition
function updateRAMFromModal() {
    const ram = window.currentRAM;
    if (!ram) return;
    
    const clientManual = document.getElementById('ramClientManual').value;
    const month = parseInt(document.getElementById('ramMonth').value);
    const year = parseInt(document.getElementById('ramYear').value);
    
    if (!clientManual) {
        showToast('❌ Veuillez saisir un client', 'error');
        return;
    }
    
    // Récupérer les activités mises à jour
    const activities = [];
    const rows = document.querySelectorAll('#ramActivityBody tr');
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    rows.forEach((row, index) => {
        const hoursInput = row.querySelector('.ram-hours');
        const commentInput = row.querySelector('.ram-comment');
        const hours = parseFloat(hoursInput.value) || 0;
        const comment = commentInput.value || '';
        const date = hoursInput.dataset.date;
        const dateObj = new Date(date);
        const day = dayNames[dateObj.getDay()];
        
        activities.push({ 
            day, 
            date, 
            hours, 
            comment,
            dayNum: index + 1
        });
    });
    
    const remarks = document.getElementById('ramRemarks').value;
    const monthName = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][month];
    
    // Mettre à jour le RAM
    ram.client = clientManual;
    ram.month = month;
    ram.year = year;
    ram.monthName = monthName;
    ram.activities = activities;
    ram.remarks = remarks;
    
    closeRAMModal();
    showRAMPreview(ram);
}

window.updateRAMFromModal = updateRAMFromModal;

// Exporter le RAM vers Google Sheets
async function exportRAMToSheets(ram) {
    try {
        const result = await callBackend('exportRAMToSheets', { ram });
        if (!result.success) {
            throw new Error(result.data || 'Erreur export Sheets');
        }
    } catch (error) {
        console.warn('Erreur export RAM vers Sheets:', error);
        // Ne pas bloquer l'enregistrement si l'export Sheets échoue
    }
}

// Nettoyer toutes les lignes RAM dans Google Sheets
async function clearRAMsInSheets() {
    if (!confirm('⚠️ Attention !\n\nCette action va SUPPRIMER TOUTES les lignes RAM dans Google Sheets (historique compris).\n\nLes RAMs dans votre application locale ne seront PAS supprimés.\n\nVoulez-vous continuer ?')) {
        return;
    }
    
    try {
        showToast('⏳ Nettoyage en cours...', 'info');
        const result = await callBackend('clearRAMSheet');
        
        if (!result.success) {
            throw new Error(result.data || 'Erreur lors du nettoyage');
        }
        
        showToast('✅ Feuille RAM nettoyée avec succès', 'success');
    } catch (error) {
        console.error('Erreur clearRAMsInSheets:', error);
        showToast('❌ Erreur lors du nettoyage : ' + error.message, 'error');
    }
}

window.clearRAMsInSheets = clearRAMsInSheets;

// Afficher la liste des RAMs enregistrés (table comme les factures)
function renderRAMList() {
    const tbody = document.getElementById('ramTableBody');
    if (!tbody) return;
    
    // Initialiser le formulaire avec mois/année courant (seulement au premier appel)
    const ramMonthSelect = document.getElementById('ramMonthSelect');
    const ramYearInput = document.getElementById('ramYearInput');
    if (ramMonthSelect && !ramMonthSelect.dataset.initialized) {
        ramMonthSelect.value = new Date().getMonth();
        ramMonthSelect.dataset.initialized = 'true';
    }
    if (ramYearInput && !ramYearInput.dataset.initialized) {
        ramYearInput.value = new Date().getFullYear();
        ramYearInput.dataset.initialized = 'true';
    }
    
    tbody.innerHTML = '';
    
    if (rams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: var(--space-24); color: var(--color-text-secondary);">Aucun rapport d\'activité enregistré</td></tr>';
        return;
    }
    
    rams.forEach((ram, index) => {
        const totalHours = ram.activities.reduce((sum, a) => sum + (a.hours || 0), 0);
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${ram.client}</td>
            <td>${ram.monthName} ${ram.year}</td>
            <td>${totalHours.toFixed(2)}h</td>
            <td>${ram.invoiceNumber || '-'}</td>
            <td>${new Date(ram.createdAt).toLocaleDateString('fr-FR')}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editRAMInForm(${index})" title="Modifier">✏️ Modifier</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteRAM(${index})" title="Supprimer" style="margin-left: var(--space-4);">🗑️ Supprimer</button>
                <button class="btn btn-sm btn-success" onclick="downloadRAMPDF(${ram.id})" title="Télécharger PDF" style="margin-left: var(--space-4);">📄 PDF</button>
                <button class="btn btn-sm btn-primary" onclick="sendRAMEmail(${ram.id})" title="Envoyer par email" style="margin-left: var(--space-4);">📧 Envoyer</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

window.renderRAMList = renderRAMList;

// Modifier un RAM dans le formulaire (comme les factures)
function editRAMInForm(index) {
    const ram = rams[index];
    if (!ram) return;
    
    window.editingRAMIndex = index;
    window.currentRAM = ram;
    
    // Afficher le formulaire avec les données
    const formContainer = document.getElementById('ramFormContainer');
    if (formContainer) {
        formContainer.style.display = 'block';
        formContainer.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Afficher l'indicateur de mode édition
    const editIndicator = document.getElementById('ramEditModeIndicator');
    if (editIndicator) {
        editIndicator.style.display = 'block';
        editIndicator.innerHTML = `✏️ <strong>Mode Édition</strong> - Modification du RAM: ${ram.client} - ${ram.monthName} ${ram.year}`;
    }
    
    // Pré-remplir les champs
    const clientInput = document.getElementById('ramClientInput');
    const monthSelect = document.getElementById('ramMonthSelect');
    const yearInput = document.getElementById('ramYearInput');
    const invoiceInput = document.getElementById('ramInvoiceNumber');
    const remarksInput = document.getElementById('ramRemarksInput');
    
    if (clientInput) clientInput.value = ram.client;
    if (monthSelect) monthSelect.value = ram.month;
    if (yearInput) yearInput.value = ram.year;
    if (remarksInput) remarksInput.value = ram.remarks || '';
    
    // Peupler le select des factures et pré-sélectionner
    populateRAMInvoiceSelect(ram.client, ram.month, ram.year);
    if (invoiceInput) invoiceInput.value = ram.invoiceNumber || '';
    
    // Régénérer le calendrier avec les données
    generateRAMCalendarInForm(ram.month, ram.year, ram.activities);
    
    // Changer le bouton "Générer" en "Mettre à jour"
    const submitBtn = document.getElementById('ramSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = '✅ Mettre à jour le RAM';
        submitBtn.className = 'btn btn-primary';
    }
}

window.editRAMInForm = editRAMInForm;

// Annuler l'édition d'un RAM
function cancelRAMEdit() {
    window.editingRAMIndex = -1;
    window.currentRAM = null;
    
    const formContainer = document.getElementById('ramFormContainer');
    if (formContainer) formContainer.style.display = 'none';
    
    const editIndicator = document.getElementById('ramEditModeIndicator');
    if (editIndicator) editIndicator.style.display = 'none';
    
    // Réinitialiser le formulaire
    resetRAMForm();
}

window.cancelRAMEdit = cancelRAMEdit;

// Peupler le select des factures filtrées par client et mois/année
function populateRAMInvoiceSelect(clientName = '', month = null, year = null) {
    const invoiceSelect = document.getElementById('ramInvoiceNumber');
    if (!invoiceSelect) return;
    
    // Réinitialiser le select
    invoiceSelect.innerHTML = '<option value="">-- Aucune facture liée --</option>';
    
    // Si pas de client, impossible de filtrer
    if (!clientName) return;
    
    // Construire le préfixe YYYYMM du numéro de facture
    const yearMonth = year && month !== null ? `${year}${(month + 1).toString().padStart(2, '0')}` : null;
    
    // Filtrer les factures : même client ET (si mois/année fournis) même période
    const matchingInvoices = invoices.filter(inv => {
        if (inv.client !== clientName) return false;
        
        // Si mois/année fournis, vérifier que le numéro de facture correspond
        if (yearMonth && inv.number) {
            return inv.number.startsWith(yearMonth);
        }
        
        return true;
    });
    
    // Ajouter les factures trouvées
    matchingInvoices.forEach(inv => {
        const option = document.createElement('option');
        option.value = inv.number;
        option.textContent = `${inv.number} - ${inv.total}€ - ${inv.status}`;
        invoiceSelect.appendChild(option);
    });
    
    // Si aucune facture trouvée, afficher un message
    if (matchingInvoices.length === 0 && yearMonth) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = `-- Aucune facture pour ${clientName} en ${new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} --`;
        option.disabled = true;
        invoiceSelect.appendChild(option);
    }
}

window.populateRAMInvoiceSelect = populateRAMInvoiceSelect;

// Réinitialiser le formulaire RAM
function resetRAMForm() {
    const clientInput = document.getElementById('ramClientInput');
    const monthSelect = document.getElementById('ramMonthSelect');
    const yearInput = document.getElementById('ramYearInput');
    const invoiceInput = document.getElementById('ramInvoiceNumber');
    const remarksInput = document.getElementById('ramRemarksInput');
    
    if (clientInput) clientInput.value = '';
    if (monthSelect) monthSelect.selectedIndex = new Date().getMonth();
    if (yearInput) yearInput.value = new Date().getFullYear();
    
    // Réinitialiser le select des factures
    if (invoiceInput) {
        invoiceInput.innerHTML = '<option value="">-- Aucune facture liée --</option>';
    }
    if (invoiceInput) invoiceInput.value = '';
    if (remarksInput) remarksInput.value = '';
    
    // Régénérer le calendrier du mois courant vide
    const month = monthSelect ? parseInt(monthSelect.value) : new Date().getMonth();
    const year = yearInput ? parseInt(yearInput.value) : new Date().getFullYear();
    generateRAMCalendarInForm(month, year);
    
    const submitBtn = document.getElementById('ramSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = '💾 Enregistrer le RAM';
        submitBtn.className = 'btn btn-primary';
    }
    
    window.editingRAMIndex = -1;
    window.currentRAM = null;
}

window.resetRAMForm = resetRAMForm;

// Afficher le formulaire de nouveau RAM
function showNewRAMForm() {
    window.editingRAMIndex = -1;
    window.currentRAM = null;
    
    const formContainer = document.getElementById('ramFormContainer');
    if (formContainer) {
        formContainer.style.display = 'block';
        formContainer.scrollIntoView({ behavior: 'smooth' });
    }
    
    const editIndicator = document.getElementById('ramEditModeIndicator');
    if (editIndicator) editIndicator.style.display = 'none';
    
    resetRAMForm();
}

window.showNewRAMForm = showNewRAMForm;

// Générer le calendrier dans le formulaire
function generateRAMCalendarInForm(month, year, existingActivities = null) {
    const tbody = document.getElementById('ramCalendarBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        const dayName = dayNames[dayOfWeek];
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const bgColor = isWeekend ? '#f0f0f0' : 'white';
        
        // Chercher les données existantes si en mode édition
        let hours = '';
        let comment = '';
        if (existingActivities) {
            const existing = existingActivities.find(a => a.dayNum === day);
            if (existing) {
                hours = existing.hours || '';
                comment = existing.comment || '';
            }
        } else if (!isWeekend) {
            hours = 7.5;
        }
        
        const row = document.createElement('tr');
        row.style.background = bgColor;
        row.innerHTML = `
            <td style="padding: var(--space-4); border: 1px solid #ddd; background: ${bgColor};">
                ${dayName}
            </td>
            <td style="padding: var(--space-4); border: 1px solid #ddd; text-align: center; background: ${bgColor};">
                ${day.toString().padStart(2, '0')}
            </td>
            <td style="padding: var(--space-4); border: 1px solid #ddd; background: ${bgColor};">
                <input type="number" class="ram-hours-input" step="0.5" min="0" max="24" 
                       style="width: 100%; padding: var(--space-4); text-align: center; border: 1px solid #ddd; border-radius: 4px;" 
                       value="${hours}" 
                       data-day="${day}" />
            </td>
            <td style="padding: var(--space-4); border: 1px solid #ddd; background: ${bgColor};">
                <input type="text" class="ram-comment-input" 
                       style="width: 100%; padding: var(--space-4); border: 1px solid #ddd; border-radius: 4px;" 
                       value="${comment}"
                       data-day="${day}" />
            </td>
        `;
        
        tbody.appendChild(row);
    }
}

window.generateRAMCalendarInForm = generateRAMCalendarInForm;

// Rafraîchir le calendrier du formulaire
function refreshRAMFormCalendar() {
    const monthSelect = document.getElementById('ramMonthSelect');
    const yearInput = document.getElementById('ramYearInput');
    
    if (!monthSelect || !yearInput) return;
    
    const month = parseInt(monthSelect.value);
    const year = parseInt(yearInput.value);
    
    generateRAMCalendarInForm(month, year);
    showToast('✅ Calendrier rafraîchi', 'success');
}

window.refreshRAMFormCalendar = refreshRAMFormCalendar;

// Sauvegarder le RAM depuis le formulaire
async function saveRAMFromForm() {
    const clientInput = document.getElementById('ramClientInput');
    const monthSelect = document.getElementById('ramMonthSelect');
    const yearInput = document.getElementById('ramYearInput');
    const invoiceInput = document.getElementById('ramInvoiceNumber');
    const remarksInput = document.getElementById('ramRemarksInput');
    
    if (!clientInput || !monthSelect || !yearInput) return;
    
    const client = clientInput.value.trim();
    if (!client) {
        showToast('❌ Veuillez saisir un nom de client', 'error');
        return;
    }
    
    const month = parseInt(monthSelect.value);
    const year = parseInt(yearInput.value);
    
    // Vérifier si un RAM existe déjà pour ce client et ce mois (sauf en mode édition)
    if (!isEditMode) {
        const existingRAM = rams.find(r => r.client === client && r.month === month && r.year === year);
        if (existingRAM) {
            const monthName = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][month];
            showToast(`⚠️ Un RAM existe déjà pour ${client} - ${monthName} ${year}`, 'error');
            return;
        }
    }
    const invoiceNumber = invoiceInput ? invoiceInput.value.trim() : '';
    const remarks = remarksInput ? remarksInput.value.trim() : '';
    
    // Récupérer les activités du calendrier
    const activities = [];
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const hoursInputs = document.querySelectorAll('.ram-hours-input');
    const commentInputs = document.querySelectorAll('.ram-comment-input');
    
    hoursInputs.forEach((input, index) => {
        const day = parseInt(input.dataset.day);
        const date = new Date(year, month, day);
        const dayName = dayNames[date.getDay()];
        const hours = parseFloat(input.value) || 0;
        const comment = commentInputs[index] ? commentInputs[index].value.trim() : '';
        
        activities.push({
            day: dayName,
            date: `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
            hours: hours,
            comment: comment,
            dayNum: day
        });
    });
    
    const monthName = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][month];
    
    try {
        showToast('⏳ Enregistrement du RAM...');
        
        // Mode édition ou création
        if (window.editingRAMIndex >= 0) {
            // Mise à jour
            const ram = rams[window.editingRAMIndex];
            ram.client = client;
            ram.month = month;
            ram.year = year;
            ram.monthName = monthName;
            ram.activities = activities;
            ram.remarks = remarks;
            ram.invoiceNumber = invoiceNumber;
        } else {
            // Création
            const ram = {
                id: Date.now(),
                client,
                month,
                year,
                monthName,
                activities,
                remarks,
                invoiceNumber,
                createdAt: new Date().toISOString()
            };
            rams.push(ram);
        }
        
        // Sauvegarder
        localStorage.setItem('mti_rams', JSON.stringify(rams));
        await syncToDrive();
        
        // Export Sheets (non bloquant)
        if (window.editingRAMIndex >= 0) {
            await exportRAMToSheets(rams[window.editingRAMIndex]);
        } else {
            await exportRAMToSheets(rams[rams.length - 1]);
        }
        
        showToast('✅ RAM enregistré avec succès !', 'success');
        
        // Masquer le formulaire et rafraîchir la liste
        cancelRAMEdit();
        renderRAMList();
        
    } catch (error) {
        console.error('Erreur enregistrement RAM:', error);
        showToast('❌ Erreur lors de l\'enregistrement: ' + error.message, 'error');
    }
}

window.saveRAMFromForm = saveRAMFromForm;

// Supprimer un RAM
function deleteRAM(index) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rapport d\'activité ?')) return;
    
    rams.splice(index, 1);
    localStorage.setItem('mti_rams', JSON.stringify(rams));
    syncToDrive();
    renderRAMList();
    showToast('✅ RAM supprimé', 'success');
}

window.deleteRAM = deleteRAM;

// Envoyer facture + RAM ensemble (si liés)
async function sendInvoiceWithRAM(invoiceIndex) {
    const invoice = invoices[invoiceIndex];
    if (!invoice) {
        showToast('❌ Facture introuvable', 'error');
        return;
    }
    
    // Chercher un RAM lié à cette facture
    const linkedRAM = rams.find(r => r.invoiceNumber === invoice.number);
    
    if (!linkedRAM) {
        showToast('⚠️ Aucun RAM lié à cette facture', 'error');
        return;
    }
    
    const clientObj = clients.find(c => c.name === invoice.client);
    if (!clientObj || !clientObj.email_facturation) {
        showToast('❌ Email du client introuvable', 'error');
        return;
    }
    
    try {
        showToast('⏳ Génération facture + RAM...');
        
        // Générer les deux PDFs
        const invoicePdf = await generateInvoicePDFBase64(invoice);
        const ramPdf = await generateRAMPDF(linkedRAM);
        
        // Noms de fichiers
        const invoiceFilename = `Facture_${invoice.number.replace(/\//g, '_')}.pdf`;
        const ramFilename = `RAM_${linkedRAM.year}_${linkedRAM.monthName}_${invoice.client.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        
        // Corps de l'email
        const invoiceBody = `Montant total : ${invoice.total.toFixed(2)}€\nÉchéance : ${formatDateFR(invoice.dueDate)}`;
        
        // Envoyer via le backend
        const response = await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'sendInvoiceWithRAM',
                to: clientObj.email_facturation,
                client: invoice.client,
                invoiceFilename: invoiceFilename,
                ramFilename: ramFilename,
                invoiceBody: invoiceBody,
                invoicePdfBase64: invoicePdf,
                ramPdfBase64: ramPdf,
                month: linkedRAM.monthName,
                year: linkedRAM.year
            })
        });
        
        const result = await response.json();
        if (result.success) {
            showToast('✅ Facture + RAM envoyés avec succès !', 'success');
        } else {
            throw new Error(result.error || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('Erreur envoi facture+RAM:', error);
        showToast('❌ Erreur lors de l\'envoi: ' + error.message, 'error');
    }
}

window.sendInvoiceWithRAM = sendInvoiceWithRAM;

// Générer le PDF du RAM (format facture A4 portrait)
async function generateRAMPDF(ram) {
    if (!window.jspdf) {
        throw new Error('jsPDF non chargé');
    }
    
    // Helper function pour convertir image en data URI (même que dans generateInvoicePDFBase64)
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
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait', 'mm', 'a4');
    
    const { client, month, year, activities, remarks, invoiceNumber } = ram;
    const monthName = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                       'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][month];
    
    // Logo - utiliser la même logique que les factures (local ou data URI)
    if (companyInfo.logoUrl) {
        try {
            // Utiliser logo local si l'URL GitHub n'est pas accessible
            const logoSrc = companyInfo.logoUrl && !companyInfo.logoUrl.includes('github') 
                ? companyInfo.logoUrl 
                : 'assets/images/MTI_CONSULTING.png';
            const dataUri = await fetchImageAsDataUri(logoSrc);
            if (dataUri) {
                doc.addImage(dataUri, 'PNG', 10, 15, 35, 18);
            }
        } catch(e) {
            console.warn('Logo non chargé:', e);
            // Fallback: essayer directement le fichier local
            try {
                const localDataUri = await fetchImageAsDataUri('assets/images/MTI_CONSULTING.png');
                if (localDataUri) {
                    doc.addImage(localDataUri, 'PNG', 10, 15, 35, 18);
                }
            } catch(e2) {
                console.warn('Fallback logo échoué:', e2);
            }
        }
    }
    
    // En-tête entreprise (format compact comme facture)
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(33, 128, 141); // #21808D (bleu MTI)
    doc.text(companyInfo.name, 45, 20);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0); // Retour au noir
    doc.text(companyInfo.address, 45, 25);
    doc.text(`${companyInfo.postalCode} ${companyInfo.city}`, 45, 29);
    doc.text(`SIRET : ${companyInfo.siret}`, 45, 33);
    
    // Titre (centré et plus compact, couleur noire comme factures)
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('RAPPORT D\'ACTIVITÉ MENSUELLE', 105, 48, { align: 'center' });
    
    // Mois et client (plus compact)
    doc.setFontSize(11);
    doc.text(`${monthName} ${year}`, 105, 56, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Client : ${client}`, 105, 64, { align: 'center' });
    if (invoiceNumber) {
        doc.text(`Facture : ${invoiceNumber}`, 105, 69, { align: 'center' });
    }
    
    // Tableau des activités (optimisé pour A4)
    if (doc.autoTable) {
        const tableData = [];
        let monthTotal = 0;
        
        activities.forEach((activity) => {
            const activityDate = new Date(activity.date);
            const dayNum = activityDate.getDate().toString().padStart(2, '0');
            const isWeekend = (activity.day === 'Samedi' || activity.day === 'Dimanche');
            
            monthTotal += activity.hours || 0;
            
            // Ajouter la ligne avec style pour weekends
            tableData.push({
                day: activity.day,
                date: dayNum,
                hours: (activity.hours || 0).toFixed(1),
                comment: activity.comment || '',
                isWeekend: isWeekend
            });
        });
        
        doc.autoTable({
            startY: invoiceNumber ? 75 : 70,
            head: [['Jour', 'Date', 'Heures', 'Commentaires']],
            body: tableData.map(row => [row.day, row.date, row.hours, row.comment]),
            foot: [['', 'TOTAL', monthTotal.toFixed(1) + 'h', '']],
            theme: 'grid',
            styles: { 
                fontSize: 7,
                cellPadding: 1.5,
                lineColor: [200, 200, 200],
                lineWidth: 0.1,
                overflow: 'linebreak',
                cellWidth: 'wrap'
            },
            headStyles: { 
                fillColor: [33, 128, 141],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'center'
            },
            footStyles: {
                fillColor: [240, 240, 240],
                textColor: 0,
                fontStyle: 'bold',
                fontSize: 8
            },
            columnStyles: {
                0: { cellWidth: 22, halign: 'left' },
                1: { cellWidth: 13, halign: 'center' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 130, halign: 'left' }
            },
            didParseCell: function(data) {
                // Griser les lignes de weekend
                if (data.section === 'body') {
                    const rowData = tableData[data.row.index];
                    if (rowData && rowData.isWeekend) {
                        data.cell.styles.fillColor = [245, 245, 245];
                        data.cell.styles.textColor = [100, 100, 100];
                    }
                }
            },
            margin: { left: 15, right: 15 }
        });
    }
    
    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 5 : 220;
    
    // Remarques (compactes)
    if (remarks) {
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text('Remarques :', 15, finalY);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(7);
        const remarksLines = doc.splitTextToSize(remarks, 175);
        doc.text(remarksLines, 15, finalY + 4);
        const remarksHeight = Math.min(remarksLines.length * 3, 15);
        doc.rect(15, finalY - 2, 180, remarksHeight + 6);
    }
    
    // Signatures (en bas de page, plus compact)
    const sigY = remarks ? finalY + 20 : finalY + 5;
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Visa Prestataire', 20, sigY);
    doc.rect(15, sigY + 2, 80, 20);
    
    // Ajouter la signature dans la case Prestataire (agrandie et centrée)
    try {
        const signaturePath = 'assets/images/signature_pandadoc.png';
        const sigDataUri = await fetchImageAsDataUri(signaturePath);
        if (sigDataUri) {
            // Case fait 80mm de large, signature 50mm centrée : début à 15 + (80-50)/2 = 30mm
            doc.addImage(sigDataUri, 'PNG', 30, sigY + 4, 50, 15);
        }
    } catch(e) {
        console.warn('Signature non chargée:', e);
    }
    
    doc.text('Visa Superviseur Client', 120, sigY);
    doc.rect(105, sigY + 2, 80, 20);
    
    // Footer (tout en bas, sans superposition)
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    const footerY = Math.max(sigY + 28, 285);
    doc.text(`${companyInfo.name} - SIRET: ${companyInfo.siret}`, 105, footerY, { align: 'center' });
    doc.text(`${companyInfo.email} - ${companyInfo.phone}`, 105, footerY + 3, { align: 'center' });
    
    return doc.output('datauristring').split(',')[1];
}

// Fonction helper pour obtenir le numéro de semaine
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
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
        // Note: Le backend Google Apps Script doit gérer les colonnes enrichies :
        // name, siret, address, email_facturation, contact_name, naf, categorie_juridique, etat_administratif, type_siege
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

// ==========================================
// RAM SYNC AVEC GOOGLE SHEETS
// ==========================================

// Exporter tous les RAMs vers Sheets
async function exportRAMsToSheets() {
    if (isSyncing) {
        alert('⏳ Une synchronisation est déjà en cours...');
        return;
    }
    
    if (rams.length === 0) {
        alert('ℹ️ Aucun RAM à exporter');
        return;
    }
    
    const confirm = window.confirm(`Exporter ${rams.length} RAM(s) vers Google Sheets ?\n\nCela écrasera le contenu existant de la feuille RAM.`);
    if (!confirm) return;
    
    isSyncing = true;
    try {
        const result = await callBackend('sync_rams', { sheetId: CONFIG.SHEETS_ID, rams });
        if (!result || result.success === false) {
            throw new Error(result?.data || 'Erreur serveur lors de l\'export');
        }
        
        alert(`✅ ${result.data.count} ligne(s) exportée(s) vers Sheets`);
        window.open(`https://docs.google.com/spreadsheets/d/${CONFIG.SHEETS_ID}`, '_blank');
    } catch (error) {
        console.error('exportRAMsToSheets error:', error);
        alert(`❌ Erreur export RAMs : ${error.message || error}`);
    } finally {
        isSyncing = false;
    }
}

// Importer les RAMs depuis Sheets
async function importRAMsFromSheets() {
    if (isSyncing) {
        alert('⏳ Une synchronisation est déjà en cours...');
        return;
    }
    
    const confirm = window.confirm('Importer les RAMs depuis Google Sheets ?\n\nCela écrasera les RAMs locaux non sauvegardés.');
    if (!confirm) return;
    
    isSyncing = true;
    try {
        const result = await callBackend('import_rams', { sheetId: CONFIG.SHEETS_ID });
        if (!result || result.success === false) {
            throw new Error(result?.data || 'Erreur serveur lors de l\'import');
        }
        
        rams = result.data.rams || [];
        saveData();
        displayRAMList();
        
        alert(`✅ ${rams.length} RAM(s) importé(s) depuis Sheets`);
    } catch (error) {
        console.error('importRAMsFromSheets error:', error);
        alert(`❌ Erreur import RAMs : ${error.message || error}`);
    } finally {
        isSyncing = false;
    }
}


// ===================================================================
// PHASE 1 - NOUVELLES FONCTIONNALITÉS (Décembre 2025)
// ===================================================================

// 1. COMPTEUR CA ANNUEL AVEC ALERTES SEUILS
// -----------------------------------------------------------
/**
 * Calcule le CA annuel total pour une année donnée (factures payées uniquement)
 * @param {number} annee - Année à analyser (ex: 2025)
 * @returns {number} CA total en euros
 */
function getCAnnuel(annee = new Date().getFullYear()) {
    return invoices
        .filter(inv => {
            if (!inv.date) return false;
            const invYear = new Date(inv.date).getFullYear();
            return invYear === annee && inv.status === 'paid';
        })
        .reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
}

/**
 * Calcule le CA annuel cumulé (toutes factures, même non payées)
 * @param {number} annee - Année à analyser
 * @returns {number} CA cumulé en euros
 */
function getCACumule(annee = new Date().getFullYear()) {
    return invoices
        .filter(inv => {
            if (!inv.date) return false;
            const invYear = new Date(inv.date).getFullYear();
            return invYear === annee && inv.status !== 'cancelled';
        })
        .reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
}

/**
 * Calcule le CA par mois pour une année donnée
 * @param {number} annee - Année à analyser
 * @returns {Object} { mois: CA } (ex: { '2025-01': 7200, '2025-02': 7200, ... })
 */
function getCAParMois(annee = new Date().getFullYear()) {
    const caParMois = {};
    
    invoices
        .filter(inv => {
            if (!inv.date) return false;
            const invYear = new Date(inv.date).getFullYear();
            return invYear === annee && inv.status !== 'cancelled';
        })
        .forEach(inv => {
            const moisKey = inv.date.slice(0, 7); // Format: '2025-01'
            caParMois[moisKey] = (caParMois[moisKey] || 0) + parseFloat(inv.total || 0);
        });
    
    return caParMois;
}

/**
 * Vérifie les seuils critiques (TVA, Micro-entreprise) et affiche des alertes
 * @param {number} ca - CA annuel à vérifier
 * @returns {Object} { alerte, message, niveau } où niveau = 'ok'|'warning'|'danger'
 */
function checkSeuils(ca = null) {
    if (ca === null) ca = getCACumule();
    
    const seuilTVA = 37500;
    const seuilTVAMajore = 39100;
    const seuilMicro = taxSettings.caMaxBNC || 77700;
    const seuilMicroMajore = seuilMicro * 1.1;
    
    // Seuil micro-entreprise (critique)
    if (ca >= seuilMicro) {
        if (ca >= seuilMicroMajore) {
            return {
                alerte: true,
                message: `🚨 CA ${ca.toFixed(0)}€ > ${seuilMicroMajore.toFixed(0)}€ : Dépassement plafond micro-entreprise ! Passage au régime réel obligatoire.`,
                niveau: 'danger'
            };
        }
        return {
            alerte: true,
            message: `⚠️ CA ${ca.toFixed(0)}€ > ${seuilMicro.toFixed(0)}€ : Dépassement plafond micro-entreprise (tolérance 110% jusqu'à ${seuilMicroMajore.toFixed(0)}€)`,
            niveau: 'warning'
        };
    }
    
    // Seuil TVA (important)
    if (ca >= seuilTVA) {
        if (ca >= seuilTVAMajore) {
            return {
                alerte: true,
                message: `🚨 CA ${ca.toFixed(0)}€ > ${seuilTVAMajore.toFixed(0)}€ : Assujettissement TVA obligatoire dès le 1er jour du mois de dépassement !`,
                niveau: 'danger'
            };
        }
        return {
            alerte: true,
            message: `⚠️ CA ${ca.toFixed(0)}€ > ${seuilTVA.toFixed(0)}€ : Dépassement seuil TVA (franchise maintenue si 1ère fois, limite ${seuilTVAMajore.toFixed(0)}€)`,
            niveau: 'warning'
        };
    }
    
    // Approche seuil TVA (anticipation)
    if (ca >= 35000) {
        return {
            alerte: true,
            message: `ℹ️ CA ${ca.toFixed(0)}€ approche du seuil TVA (${seuilTVA.toFixed(0)}€). Anticipez l'assujettissement.`,
            niveau: 'info'
        };
    }
    
    return { alerte: false, message: '', niveau: 'ok' };
}


// 2. CALCULATEUR TVA
// -----------------------------------------------------------
/**
 * Calcule HT → TTC avec TVA
 * @param {number} ht - Montant hors taxes
 * @param {number} tauxTVA - Taux de TVA (20, 10, 5.5, 2.1)
 * @returns {Object} { ht, tva, ttc }
 */
function calculateTVA_HT_to_TTC(ht, tauxTVA = 20) {
    const tva = ht * (tauxTVA / 100);
    const ttc = ht + tva;
    return { 
        ht: parseFloat(ht.toFixed(2)), 
        tva: parseFloat(tva.toFixed(2)), 
        ttc: parseFloat(ttc.toFixed(2)) 
    };
}

/**
 * Calcule TTC → HT avec TVA
 * @param {number} ttc - Montant toutes taxes comprises
 * @param {number} tauxTVA - Taux de TVA (20, 10, 5.5, 2.1)
 * @returns {Object} { ht, tva, ttc }
 */
function calculateTVA_TTC_to_HT(ttc, tauxTVA = 20) {
    const ht = ttc / (1 + tauxTVA / 100);
    const tva = ttc - ht;
    return { 
        ht: parseFloat(ht.toFixed(2)), 
        tva: parseFloat(tva.toFixed(2)), 
        ttc: parseFloat(ttc.toFixed(2)) 
    };
}

/**
 * Taux TVA français (2025)
 */
const tauxTVAFrance = {
    normal: 20,        // Prestations de services, biens
    intermediaire: 10, // Restauration, transports, hôtellerie
    reduit: 5.5,       // Livres, alimentation, énergie
    special: 2.1       // Médicaments remboursés, presse
};


// 3. FACTURES RÉCURRENTES / ABONNEMENTS
// -----------------------------------------------------------
/**
 * Structure d'une facture récurrente:
 * {
 *   id: string,
 *   templateInvoice: object (copie d'une facture existante),
 *   frequency: 'monthly' | 'quarterly' | 'yearly',
 *   nextDate: string (ISO date),
 *   active: boolean,
 *   createdDate: string,
 *   lastGeneratedDate: string (date de la dernière génération)
 * }
 */

/**
 * Crée une facture récurrente à partir d'une facture existante
 * @param {object} invoice - Facture modèle
 * @param {string} frequency - Fréquence: 'monthly', 'quarterly', 'yearly'
 * @param {string} startDate - Date de première génération (format YYYY-MM-DD) - optionnel
 * @returns {object} Facture récurrente créée
 */
function createRecurringInvoice(invoice, frequency = 'monthly', startDate = null) {
    if (!invoice) throw new Error('Facture modèle requise');
    
    // Utiliser la date fournie ou calculer la prochaine date automatiquement
    const nextDate = startDate || calculateNextDate(new Date(), frequency);
    
    const recurring = {
        id: 'REC-' + Date.now(),
        templateInvoice: JSON.parse(JSON.stringify(invoice)), // Copie profonde
        frequency: frequency,
        nextDate: nextDate,
        active: true,
        createdDate: new Date().toISOString().split('T')[0],
        lastGeneratedDate: null
    };
    
    recurringInvoices.push(recurring);
    saveToDrive();
    
    return recurring;
}

/**
 * Calcule la prochaine date d'échéance selon la fréquence
 * @param {Date} currentDate - Date de référence
 * @param {string} frequency - Fréquence
 * @returns {string} Prochaine date (ISO format)
 */
function calculateNextDate(currentDate, frequency) {
    const date = new Date(currentDate);
    
    switch(frequency) {
        case 'monthly':
            date.setMonth(date.getMonth() + 1);
            break;
        case 'quarterly':
            date.setMonth(date.getMonth() + 3);
            break;
        case 'yearly':
            date.setFullYear(date.getFullYear() + 1);
            break;
        default:
            date.setMonth(date.getMonth() + 1);
    }
    
    return date.toISOString().split('T')[0];
}

/**
 * Génère une facture à partir d'un modèle récurrent
 * @param {string} recurringId - ID de la facture récurrente
 * @returns {object} Nouvelle facture générée
 */
function generateFromRecurring(recurringId) {
    const recurring = recurringInvoices.find(r => r.id === recurringId);
    if (!recurring) throw new Error('Facture récurrente introuvable');
    if (!recurring.active) throw new Error('Facture récurrente inactive');
    
    // Copier le modèle
    const newInvoice = JSON.parse(JSON.stringify(recurring.templateInvoice));
    
    // Mettre à jour les champs
    newInvoice.date = new Date().toISOString().split('T')[0];
    newInvoice.number = getNextInvoiceNumber();
    newInvoice.status = 'draft';
    newInvoice.recurringSource = recurringId; // Traçabilité
    
    // Calculer nouvelle échéance (30 jours par défaut)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    newInvoice.dueDate = dueDate.toISOString().split('T')[0];
    
    // Ajouter aux factures
    invoices.push(newInvoice);
    
    // Mettre à jour la récurrence
    recurring.lastGeneratedDate = newInvoice.date;
    recurring.nextDate = calculateNextDate(new Date(), recurring.frequency);
    
    saveToDrive();
    
    return newInvoice;
}

/**
 * Vérifie les factures récurrentes à générer (à exécuter quotidiennement)
 * @returns {Array} Liste des factures générées
 */
function checkRecurringInvoices() {
    const today = new Date().toISOString().split('T')[0];
    const generated = [];
    
    recurringInvoices
        .filter(r => r.active && r.nextDate <= today)
        .forEach(r => {
            try {
                const invoice = generateFromRecurring(r.id);
                generated.push(invoice);
                console.log(`✅ Facture récurrente générée: ${invoice.number} (source: ${r.id})`);
            } catch (error) {
                console.error(`❌ Erreur génération récurrence ${r.id}:`, error);
            }
        });
    
    return generated;
}

/**
 * Désactive une facture récurrente
 * @param {string} recurringId - ID de la facture récurrente
 */
function deactivateRecurring(recurringId) {
    const recurring = recurringInvoices.find(r => r.id === recurringId);
    if (recurring) {
        recurring.active = false;
        saveToDrive();
    }
}

/**
 * Supprime une facture récurrente
 * @param {string} recurringId - ID de la facture récurrente
 */
function deleteRecurring(recurringId) {
    const index = recurringInvoices.findIndex(r => r.id === recurringId);
    if (index !== -1) {
        recurringInvoices.splice(index, 1);
        saveToDrive();
    }
}


// ===================================================================
// UI HANDLERS - NOUVELLES FONCTIONNALITÉS PHASE 1
// ===================================================================

/**
 * Met à jour l'affichage du compteur CA annuel dans l'onglet Suivi
 */
function updateCADisplay(annee = new Date().getFullYear()) {
    const caCumule = getCACumule(annee);
    const caPaye = getCAnnuel(annee);
    const seuilTVA = 37500;
    const seuilMicro = 77700;
    
    // Mise à jour des valeurs
    document.getElementById('caCumule').textContent = caCumule.toFixed(2) + ' €';
    document.getElementById('caPaye').textContent = caPaye.toFixed(2) + ' €';
    document.getElementById('seuilTVA').textContent = ((caCumule / seuilTVA) * 100).toFixed(1) + '%';
    document.getElementById('seuilMicro').textContent = ((caCumule / seuilMicro) * 100).toFixed(1) + '%';
    document.getElementById('caAnnee').textContent = annee;
    
    // Mise à jour de la barre de progression (max = 77700)
    const progressPercent = Math.min((caCumule / seuilMicro) * 100, 100);
    document.getElementById('caProgressBar').style.width = progressPercent + '%';
    
    // Vérification des seuils et affichage alerte
    const seuil = checkSeuils(caCumule);
    const alertDiv = document.getElementById('caAlert');
    
    if (seuil.alerte) {
        alertDiv.style.display = 'block';
        alertDiv.textContent = seuil.message;
        
        // Couleurs selon niveau
        switch(seuil.niveau) {
            case 'danger':
                alertDiv.style.background = 'var(--color-error-bg)';
                alertDiv.style.borderLeft = '4px solid var(--color-error)';
                alertDiv.style.color = 'var(--color-error)';
                break;
            case 'warning':
                alertDiv.style.background = 'var(--color-warning-bg)';
                alertDiv.style.borderLeft = '4px solid var(--color-warning)';
                alertDiv.style.color = 'var(--color-warning)';
                break;
            case 'info':
                alertDiv.style.background = 'var(--color-info-bg)';
                alertDiv.style.borderLeft = '4px solid var(--color-primary)';
                alertDiv.style.color = 'var(--color-primary)';
                break;
        }
    } else {
        alertDiv.style.display = 'none';
    }
}

/**
 * Met \u00e0 jour la liste des ann\u00e9es disponibles dans le s\u00e9lecteur CA
 */
function updateCAYearOptions() {
    const yearSelect = document.getElementById('caYearSelect');
    if (!yearSelect) return;
    
    // Extraire toutes les ann\u00e9es des factures
    const years = new Set();
    invoices.forEach(inv => {
        if (inv.date) {
            const year = parseInt(inv.date.split('-')[0]);
            if (!isNaN(year)) years.add(year);
        }
    });
    
    // Ajouter l'ann\u00e9e actuelle
    years.add(new Date().getFullYear());
    
    // Trier et cr\u00e9er les options
    const sortedYears = Array.from(years).sort((a, b) => b - a); // D\u00e9croissant
    const currentValue = yearSelect.value;
    
    yearSelect.innerHTML = '';
    sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });
    
    // Restaurer la s\u00e9lection pr\u00e9c\u00e9dente si elle existe toujours
    if (sortedYears.includes(parseInt(currentValue))) {
        yearSelect.value = currentValue;
    } else {
        yearSelect.value = new Date().getFullYear();
    }
}

/**
 * Initialise les event listeners pour le compteur CA annuel
 */
function initCACounterListeners() {
    const yearSelect = document.getElementById('caYearSelect');
    if (yearSelect) {
        yearSelect.addEventListener('change', (e) => {
            updateCADisplay(parseInt(e.target.value));
        });
    }
    
    // Mettre \u00e0 jour les options d'ann\u00e9es au chargement
    updateCAYearOptions();
}

/**
 * Initialise les event listeners pour le calculateur TVA
 */
function initTVACalculatorListeners() {
    const calculateBtn = document.getElementById('calculateTvaBtn');
    const htToTtcRadio = document.getElementById('tvaHtToTtc');
    const ttcToHtRadio = document.getElementById('tvaTtcToHt');
    const montantLabel = document.getElementById('tvaMontantLabel');
    
    // Change label selon direction
    if (htToTtcRadio) {
        htToTtcRadio.addEventListener('change', () => {
            if (montantLabel) montantLabel.textContent = 'Montant HT (€)';
        });
    }
    
    if (ttcToHtRadio) {
        ttcToHtRadio.addEventListener('change', () => {
            if (montantLabel) montantLabel.textContent = 'Montant TTC (€)';
        });
    }
    
    // Calcul TVA
    if (calculateBtn) {
        calculateBtn.addEventListener('click', () => {
            const montant = parseFloat(document.getElementById('tvaMontantInput').value) || 0;
            const taux = parseFloat(document.getElementById('tvaTauxSelect').value) || 20;
            const direction = document.querySelector('input[name="tvaDirection"]:checked').value;
            
            let result;
            if (direction === 'ht-to-ttc') {
                result = calculateTVA_HT_to_TTC(montant, taux);
            } else {
                result = calculateTVA_TTC_to_HT(montant, taux);
            }
            
            // Affichage des résultats
            document.getElementById('tvaResultHT').textContent = result.ht.toFixed(2) + ' €';
            document.getElementById('tvaResultTVA').textContent = result.tva.toFixed(2) + ' €';
            document.getElementById('tvaResultTTC').textContent = result.ttc.toFixed(2) + ' €';
            
            // Message d'impact
            const impactMsg = direction === 'ht-to-ttc' 
                ? `Si vous facturez actuellement ${result.ht.toFixed(2)}€ TTC (franchise TVA), vous devrez facturer ${result.ttc.toFixed(2)}€ TTC avec TVA (+${result.tva.toFixed(2)}€ pour le client) OU garder ${result.ht.toFixed(2)}€ TTC et perdre ${((result.tva / result.ttc) * 100).toFixed(1)}% de marge.`
                : `Votre prix actuel ${result.ttc.toFixed(2)}€ TTC correspond à ${result.ht.toFixed(2)}€ HT + ${result.tva.toFixed(2)}€ TVA. Si vous gardez ce prix TTC après assujettissement, vous perdrez ${result.tva.toFixed(2)}€ (collecté pour l'État).`;
            
            document.getElementById('tvaImpactMessage').textContent = impactMsg;
            document.getElementById('tvaResults').style.display = 'block';
        });
    }
}

/**
 * Exécute la vérification quotidienne des factures récurrentes
 * (À appeler au chargement de l'app)
 */
function autoCheckRecurringInvoices() {
    const generated = checkRecurringInvoices();
    
    if (generated.length > 0) {
        const msg = `✅ ${generated.length} facture(s) récurrente(s) générée(s) automatiquement :\n` +
                    generated.map(inv => `• ${inv.number} - ${inv.client}`).join('\n');
        
        alert(msg);
        
        // Rafraîchir l'affichage
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
        if (typeof renderInvoiceList === 'function') renderInvoiceList();
    }
}

/**
 * Affiche la liste des factures récurrentes dans le tableau
 */
function renderRecurringList() {
    const tbody = document.getElementById('recurringListBody');
    if (!tbody) return;
    
    if (!recurringInvoices || recurringInvoices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--color-text-secondary); padding: var(--space-24);">
                    Aucune facture récurrente. Créez-en une à partir d'une facture existante.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = recurringInvoices.map(rec => {
        const template = rec.templateInvoice;
        const frequencyLabels = {
            'monthly': 'Mensuelle',
            'quarterly': 'Trimestrielle',
            'yearly': 'Annuelle'
        };
        
        return `
            <tr style="background: ${rec.active ? 'inherit' : 'var(--color-gray-50)'};">
                <td style="font-family: monospace; font-size: var(--font-size-sm);">${rec.id}</td>
                <td><strong>${template.client || 'N/A'}</strong></td>
                <td style="text-align: right; font-weight: var(--font-weight-semibold);">${parseFloat(template.total || 0).toFixed(2)} €</td>
                <td>${frequencyLabels[rec.frequency] || rec.frequency}</td>
                <td>${new Date(rec.nextDate).toLocaleDateString('fr-FR')}</td>
                <td>${rec.lastGeneratedDate ? new Date(rec.lastGeneratedDate).toLocaleDateString('fr-FR') : '-'}</td>
                <td>
                    <span style="padding: 4px 8px; border-radius: var(--border-radius-sm); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); background: ${rec.active ? 'var(--color-success-bg)' : 'var(--color-gray-100)'}; color: ${rec.active ? 'var(--color-success)' : 'var(--color-text-secondary)'};">
                        ${rec.active ? '✓ Active' : '✗ Inactive'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: var(--space-8);">
                        ${rec.active ? `
                            <button class="btn btn-secondary" style="font-size: var(--font-size-xs); padding: 4px 8px;" onclick="generateRecurringNow('${rec.id}')">
                                ▶️ Générer
                            </button>
                            <button class="btn btn-secondary" style="font-size: var(--font-size-xs); padding: 4px 8px;" onclick="toggleRecurring('${rec.id}')">
                                ⏸ Pause
                            </button>
                        ` : `
                            <button class="btn btn-primary" style="font-size: var(--font-size-xs); padding: 4px 8px;" onclick="toggleRecurring('${rec.id}')">
                                ▶️ Activer
                            </button>
                        `}
                        <button class="btn btn-danger" style="font-size: var(--font-size-xs); padding: 4px 8px;" onclick="confirmDeleteRecurring('${rec.id}')">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Génère immédiatement une facture récurrente (action manuelle)
 */
function generateRecurringNow(recurringId) {
    try {
        const invoice = generateFromRecurring(recurringId);
        alert(`✅ Facture générée : ${invoice.number}\nClient : ${invoice.client}\nMontant : ${invoice.total}€`);
        
        // Rafraîchir les affichages
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
        if (typeof renderInvoiceList === 'function') renderInvoiceList();
        renderRecurringList();
        updateCADisplay();
    } catch (error) {
        alert(`❌ Erreur : ${error.message}`);
    }
}

/**
 * Active/désactive une facture récurrente
 */
function toggleRecurring(recurringId) {
    const recurring = recurringInvoices.find(r => r.id === recurringId);
    if (recurring) {
        recurring.active = !recurring.active;
        saveToDrive();
        renderRecurringList();
        
        const status = recurring.active ? 'activée' : 'désactivée';
        alert(`Facture récurrente ${status}`);
    }
}

/**
 * Confirmation avant suppression d'une récurrence
 */
function confirmDeleteRecurring(recurringId) {
    const recurring = recurringInvoices.find(r => r.id === recurringId);
    if (!recurring) return;
    
    const confirm = window.confirm(
        `Supprimer la facture récurrente ?\n\n` +
        `Client : ${recurring.templateInvoice.client}\n` +
        `Fréquence : ${recurring.frequency}\n` +
        `Montant : ${recurring.templateInvoice.total}€\n\n` +
        `Cette action est irréversible.`
    );
    
    if (confirm) {
        deleteRecurring(recurringId);
        renderRecurringList();
        alert('✅ Facture récurrente supprimée');
    }
}

/**
 * Initialise les listeners pour la gestion des factures récurrentes
 */
function initRecurringInvoicesListeners() {
    // Bouton "Créer récurrence"
    const createBtn = document.getElementById('createRecurringBtn');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            // Ouvrir la modal et remplir le select avec les factures existantes
            const modal = document.getElementById('createRecurringModal');
            const select = document.getElementById('recurringTemplateSelect');
            const dateInput = document.getElementById('recurringStartDate');
            
            if (select) {
                select.innerHTML = '<option value="">-- Choisir une facture existante --</option>';
                invoices.forEach((inv, idx) => {
                    select.innerHTML += `<option value="${idx}">${inv.number || 'N/A'} - ${inv.client} - ${inv.total}€</option>`;
                });
            }
            
            // Initialiser la date à demain par défaut
            if (dateInput) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                dateInput.value = tomorrow.toISOString().split('T')[0];
                dateInput.min = new Date().toISOString().split('T')[0]; // Empêcher les dates passées
            }
            
            if (modal) modal.style.display = 'flex';
        });
    }
    
    // Fermer modal
    const closeBtn = document.getElementById('closeRecurringModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('createRecurringModal');
            if (modal) modal.style.display = 'none';
        });
    }
    
    // Annuler
    const cancelBtn = document.getElementById('cancelRecurringBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const modal = document.getElementById('createRecurringModal');
            if (modal) modal.style.display = 'none';
        });
    }
    
    // Soumettre le formulaire
    const form = document.getElementById('recurringForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const templateIdx = parseInt(document.getElementById('recurringTemplateSelect').value);
            const frequency = document.querySelector('input[name="recurringFrequency"]:checked').value;
            const startDate = document.getElementById('recurringStartDate').value;
            
            if (isNaN(templateIdx) || templateIdx < 0 || templateIdx >= invoices.length) {
                alert('❌ Veuillez sélectionner une facture modèle');
                return;
            }
            
            if (!startDate) {
                alert('❌ Veuillez sélectionner une date de première génération');
                return;
            }
            
            // Vérifier que la date n'est pas dans le passé
            const selectedDate = new Date(startDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (selectedDate < today) {
                alert('❌ La date de génération ne peut pas être dans le passé');
                return;
            }
            
            try {
                const recurring = createRecurringInvoice(invoices[templateIdx], frequency, startDate);
                
                const freqText = { monthly: 'Mensuelle', quarterly: 'Trimestrielle', yearly: 'Annuelle' }[frequency];
                alert(`✅ Facture récurrente créée !\n\nClient : ${recurring.templateInvoice.client}\nFréquence : ${freqText}\nProchaine génération : ${new Date(recurring.nextDate).toLocaleDateString('fr-FR')}\n\nℹ️ La facture sera générée automatiquement en statut "Brouillon".`);
                
                // Fermer modal et rafraîchir
                const modal = document.getElementById('createRecurringModal');
                if (modal) modal.style.display = 'none';
                
                renderRecurringList();
                updateCADisplay(); // Rafraîchir le compteur CA
            } catch (error) {
                alert(`❌ Erreur : ${error.message}`);
            }
        });
    }
}

// Initialiser les listeners au chargement du DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initCACounterListeners();
        initTVACalculatorListeners();
        initRecurringInvoicesListeners();
        autoCheckRecurringInvoices();
        
        // Mise à jour initiale du CA
        setTimeout(() => {
            updateCADisplay();
            renderRecurringList();
        }, 1000);
    });
} else {
    // DOM déjà chargé
    initCACounterListeners();
    initTVACalculatorListeners();
    initRecurringInvoicesListeners();
    autoCheckRecurringInvoices();
    setTimeout(() => {
        updateCADisplay();
        renderRecurringList();
    }, 1000);
}

