import {
    CONFIG,
    defaultSettings,
    getClients,
    getDueDateInput,
    getInvoiceDateInput,
    getInvoiceForm,
    getInvoiceNumberInput,
    getInvoices,
    getNavTabs,
    getQuotes,
    getRams,
    getTabContents,
    getTasks,
    getSyncLog,
    setClients,
    setDueDateInput,
    setInvoiceDateInput,
    setInvoiceForm,
    setInvoiceNumberInput,
    setInvoices,
    setNavTabs,
    setQuantityInput,
    setQuotes,
    setRams,
    setSyncLog,
    setTabContents,
    setTotalHTInput,
    setUnitPriceInput,
    SYNC_LOG_STORAGE_KEY,
    getCompanyInfo,
    getTaxSettings,
    setEditMode,
    setEditingInvoiceNumberInput,
    getCurrentInvoiceItems,
    getConfirmCallback,
    setConfirmCallback
} from './src/modules/config.js';
import {
    batchSaveAllData,
    exportLocalBackup,
    getStorageStatus,
    importLocalBackup,
    loadInvoicesFromStorage,
    saveConfigToStorage,
    saveInvoicesToStorage,
    scheduleLocalStorageCleanup,
    batchLoadAllData,
    storageManager
} from './src/modules/storage.js';
import {
    deleteGoogleCalendarEvent,
    getConfiguredCalendarId,
    initCalendarManager,
    initGoogleCalendarEmbed,
    syncToGoogleCalendar,
    updateGoogleCalendarEvent,
    changeCalendarView,
    navigateCalendar,
    renderCalendar
} from './src/modules/calendar.js';
import {
    formatDate,
    setDefaultDates
} from './src/modules/date-utils.js';
import { showToast } from './src/modules/toast.js';
import { showBackendRawResponse } from "./src/modules/debug.js";
import {
    communeInput,
    rfrInput
} from "./src/modules/event-listener.js";
import { formatNumber } from "./src/modules/number-utils.js";
import {
    calculateTaxes,
    initUrssafIntegration,
    loadFiscalThresholdsFromAPI,
    renderIRPPBareme,
    resetIRPPBareme,
    updateIRPPTranche,
    addIRPPTranche,
    removeIRPPTranche
} from "./src/modules/tax.js";
import {
    autoCheckRecurringInvoices,
    checkOverdueInvoices,
    clearInvoiceItems,
    exportInvoicesToSheets,
    getCurrentInvoiceForPreview,
    getNextInvoiceNumber,
    importInvoicesFromSheets,
    initRecurringInvoicesListeners,
    previewAndConfirmSend,
    renderInvoiceList,
    renderRecurringList,
    setupInvoiceFormListeners,
    setupInvoiceSaveHandler,
    addInvoiceItem,
    removeInvoiceItem,
    updateInvoiceItemField,
    resetInvoiceForm,
    editInvoiceInForm,
    editInvoice,
    deleteInvoiceFromList,
    deleteInvoice,
    duplicateInvoice,
    setInvoiceStatus,
    downloadInvoiceFromList,
    filterInvoiceList
} from "./src/modules/invoices.js";
import { calculateTotal } from "./src/modules/calculations.js";
import {
    callBackend,
    callBackendJSONP,
    generateInvoicePDFBase64,
    searchCommunesAPI,
    testBackend,
    validateSIRET,
    sendRAMEmail,
    sendInvoiceWithRAM
} from "./src/modules/api.js";
import {
    calculateACREPeriod,
    updateCFEEstimation,
    updateSiretStatus
} from "./src/modules/company.js";
import { updateDevisKPIs } from "./src/modules/kpi.js";
import {
    initQuoteForm,
    renderQuoteList,
    exportQuotesToSheets,
    importQuotesFromSheets,
    openQuoteByNumber,
    addQuoteItem,
    removeQuoteItem,
    updateQuoteItemField,
    setQuoteStatus,
    editQuoteInForm,
    deleteQuote,
    sendQuoteEmail,
    downloadQuotePDF,
    convertQuoteToInvoice,
    showQuoteEmailPreview,
    confirmQuoteEmailSend,
    previewAndConfirmQuoteSend,
    confirmQuoteEmailSendFromForm
} from "./src/modules/quotes.js";
import {
    addSyncLogEntry,
    autoSync,
    loadAutoSyncPreference,
    updateSyncLogDisplay,
    clearSyncLog,
    toggleAutoSync,
    showSyncLogModal,
    syncToGoogleSheets
} from "./src/modules/sync.js";
import {
    fetchDriveDataOnly,
    loadFromDrive,
    saveToDrive
} from "./src/modules/drive.js";
import {
    initCACounterListeners,
    updateCADisplay
} from "./src/modules/revenue.js";
import { renderCharts } from "./src/modules/charts.js";
import { applyFilters } from "./src/modules/filters.js";
import {
    exportClientsToSheets,
    importClientsFromSheets,
    populateClientSelects,
    renderClientsTable,
    setupClientFormHandlers,
    setupClientSelectListener,
    setupRAMClientSelectListener,
    editClient,
    deleteClient,
    clearClientsInSheets
} from "./src/modules/client.js";
import {
    setupEmailPreviewHandlers,
    setupEmailPreviewHandlersForConfirmSend,
    sendInvoiceEmail
} from "./src/modules/mail.js";
import { exportFEC } from "./src/modules/export.js";
import {
    showDayTasks,
    setupTaskHandlers,
    editTask,
    deleteTaskFromEdit
} from "./src/modules/tasks.js";
import {
    setupRAMFormListeners,
    generateRAMForInvoice,
    showRAMModal,
    generateRAMCalendar,
    refreshRAMCalendar,
    closeRAMModal,
    generateRAMFromModal,
    showRAMPreview,
    saveRAM,
    downloadRAMPDF,
    editRAM,
    updateRAMFromModal,
    clearRAMsInSheets,
    renderRAMList,
    filterRAMList,
    editRAMInForm,
    cancelRAMEdit,
    populateRAMInvoiceSelect,
    resetRAMForm,
    showNewRAMForm,
    generateRAMCalendarInForm,
    refreshRAMFormCalendar,
    saveRAMFromForm,
    deleteRAM,
    exportRAMsToSheets,
    importRAMsFromSheets,
} from "./src/modules/ram.js";

// VARIABLES

let clients = getClients();
let invoices = getInvoices();
let quotes = getQuotes();
let rams = getRams();

// MTI CONSULTING - Application de facturation
// Version 2.1.3 - Google Drive Storage + Gmail API + Calendar API + FullCalendar + RAMs

console.log('✅ app.js chargé - début du script');

// ==========================================
// STORAGE MANAGER - IndexedDB prioritaire + secours localStorage
// ==========================================

// Initialiser le stockage au chargement
storageManager.init();

scheduleLocalStorageCleanup();

// ==========================================
// STORAGE HELPERS - wrappers de compatibilité
// ==========================================

// ========== v2.5.2 FONCTIONS HELPER ========== 


// Exposer les helpers en console pour un diagnostic rapide (v2.5.2)
// TODO: JE LAISSE ICI POUR L'INSTANT
window.ensureIndexes = (payload) => storageManager.ensureIndexes(payload || { invoices, quotes, clients });
window.findInvoiceByNumber = (number) => storageManager.findInvoiceByNumber(number);
window.findQuoteByNumber = (number) => storageManager.findQuoteByNumber(number);
window.findClientByName = (name) => storageManager.findClientByName(name);
window.cleanupLocalStorage = (keysToKeep) => storageManager.cleanupLocalStorage(keysToKeep);
window.exportLocalBackup = exportLocalBackup;
window.importLocalBackup = importLocalBackup;
window.setStorageBackupEnabled = (enabled) => storageManager.setBackupEnabled(enabled);
window.getStorageMode = () => storageManager.mode;

// ========== HELPERS ORIGINELS (compatibilité) ========== 

// Export pour debug console
// TODO: ON LAISSE ICI POUR L'INSTANT
window.storageManager = storageManager;
window.saveInvoicesToStorage = saveInvoicesToStorage;
window.loadInvoicesFromStorage = loadInvoicesFromStorage;
window.batchSaveAllData = batchSaveAllData;
window.batchLoadAllData = batchLoadAllData;
window.getStorageStatus = getStorageStatus;
window.findInvoiceByNumber = (num) => storageManager.findInvoiceByNumber(num);
window.findQuoteByNumber = (num) => storageManager.findQuoteByNumber(num);
window.findClientByName = (name) => storageManager.findClientByName(name);

// Configuration chargée (credentials en dur dans CONFIG ci-dessus)
console.log('✅ Configuration chargée depuis app.js (v42 style)');

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


// Load sync log from IndexedDB/localStorage on startup
async function loadSyncLog() {
    try {
        const saved = await storageManager.getItem(SYNC_LOG_STORAGE_KEY);
        if (saved) {
            setSyncLog(saved);
            if (!Array.isArray(getSyncLog())) {
                setSyncLog([]);
            }
        }
    } catch (e) {
        console.warn('Could not load sync log:', e);
        setSyncLog([]);
    }
}

// Export window functions for UI
window.getSyncLog = getSyncLog;
window.clearSyncLog = clearSyncLog;

// ==========================================
// INTELLIGENT RECONCILIATION SYSTEM (v2.4.4)
// ==========================================

// Detect divergences between Drive, Sheets, and localStorage
async function detectDataDivergences() {
    const divergences = {
        invoices: false,
        quotes: false,
        rams: false,
        clients: false,
        details: {}
    };
    
    try {
        // Get localStorage data (current state)
        const localInvoices = invoices || [];
        const localQuotes = quotes || [];
        const localRAMs = rams || [];
        const localClients = clients || [];
        
        // Get Drive data (source of truth)
        const driveData = await fetchDriveDataOnly();
        if (!driveData) {
            console.warn('Could not load Drive data for reconciliation');
            return null;
        }
        
        // Compare counts and checksums
        divergences.invoices = localInvoices.length !== (driveData.invoices?.length || 0);
        divergences.quotes = localQuotes.length !== (driveData.quotes?.length || 0);
        divergences.rams = localRAMs.length !== (driveData.rams?.length || 0);
        divergences.clients = localClients.length !== (driveData.clients?.length || 0);
        
        // Store details for resolution
        divergences.details = {
            local: { invoices: localInvoices.length, quotes: localQuotes.length, rams: localRAMs.length, clients: localClients.length },
            drive: { invoices: driveData.invoices?.length || 0, quotes: driveData.quotes?.length || 0, rams: driveData.rams?.length || 0, clients: driveData.clients?.length || 0 }
        };
        
        // Return both divergences and data for reconciliation
        return { divergences, driveData };
    } catch (err) {
        console.error('Error detecting divergences:', err);
        return null;
    }
}

// Reconcile data using timestamps and unique keys
function reconcileData(localData, driveData, dataType) {
    if (!localData || !driveData) return localData || driveData || [];
    
    const result = [];
    const keyField = {
        'invoices': 'number',
        'quotes': 'number', 
        'rams': 'id',
        'clients': 'siret'
    }[dataType] || 'id';
    
    // Create maps for fast lookup
    const localMap = new Map(localData.map(item => [item[keyField], item]));
    const driveMap = new Map(driveData.map(item => [item[keyField], item]));
    
    // Get all unique keys
    const allKeys = new Set([...localMap.keys(), ...driveMap.keys()]);
    
    allKeys.forEach(key => {
        const localItem = localMap.get(key);
        const driveItem = driveMap.get(key);
        
        if (!localItem) {
            // Only in Drive - use Drive version
            result.push(driveItem);
        } else if (!driveItem) {
            // Only in local - use local version
            result.push(localItem);
        } else {
            // In both - compare timestamps
            const localDate = new Date(localItem.date || localItem.createdAt || 0);
            const driveDate = new Date(driveItem.date || driveItem.createdAt || 0);
            
            // Drive wins in case of tie (source of truth)
            result.push(driveDate >= localDate ? driveItem : localItem);
        }
    });
    
    return result;
}

// Auto-reconciliation at startup
async function autoReconcile() {
    console.log('🔄 Auto-reconciliation: checking for divergences...');
    
    // Check if backend is configured
    const isConfigured = CONFIG.BACKEND_URL && !CONFIG.BACKEND_URL.includes('VOTRE_SCRIPT_ID');
    if (!isConfigured) {
        console.log('⚠️ Auto-reconciliation skipped (backend not configured)');
        await addSyncLogEntry('info', 'Réconciliation ignorée: backend non configuré');
        return;
    }
    
    const result = await detectDataDivergences();
    if (!result) {
        console.log('⚠️ Auto-reconciliation skipped (no Drive data)');
        await addSyncLogEntry('info', 'Réconciliation ignorée: pas de données Drive');
        return;
    }
    
    const { divergences, driveData } = result;
    const hasDivergence = divergences.invoices || divergences.quotes || divergences.rams || divergences.clients;
    
    if (!hasDivergence) {
        console.log('✅ No divergences detected');
        await addSyncLogEntry('success', 'Réconciliation: aucune divergence détectée');
        return;
    }
    
    console.warn('⚠️ Divergences detected:', divergences.details);
    await addSyncLogEntry('pending', 'Divergences détectées, réconciliation en cours...', divergences.details);
    
    // Reconcile each data type (always apply if divergence detected)
    let hasChanges = false;
    
    if (divergences.invoices) {
        const reconciled = reconcileData(invoices, driveData.invoices, 'invoices');
        setInvoices(reconciled);
        hasChanges = true;
        console.log(`📋 Invoices reconciled: ${reconciled.length} items`);
    }
    
    if (divergences.quotes) {
        const reconciled = reconcileData(quotes, driveData.quotes, 'quotes');
        setQuotes(reconciled);
        hasChanges = true;
        console.log(`📄 Quotes reconciled: ${reconciled.length} items`);
    }
    
    if (divergences.rams) {
        const reconciled = reconcileData(rams, driveData.rams, 'rams');
        setRams(reconciled);
        hasChanges = true;
        console.log(`📊 RAMs reconciled: ${reconciled.length} items`);
    }
    
    if (divergences.clients) {
        const reconciled = reconcileData(clients, driveData.clients, 'clients');
        setClients(reconciled);
        hasChanges = true;
        console.log(`👥 Clients reconciled: ${reconciled.length} items`);
    }
    
    if (hasChanges) {
        // Save reconciled data to IndexedDB + localStorage
        try {
            await storageManager.saveDual('mti_invoices', invoices);
            await storageManager.saveDual('mti_quotes', quotes);
            await storageManager.saveDual('mti_rams', rams);
            await storageManager.saveDual('mti_clients', clients);
        } catch (e) {
            console.error('Error saving reconciled data to IndexedDB:', e);
        }
        
        // Sync to Drive (source of truth)
        await saveToDrive({ skipToast: true });
        
        // Refresh UI
        if (typeof renderClientsTable === 'function') renderClientsTable();
        if (typeof renderInvoiceList === 'function') renderInvoiceList();
        if (typeof renderQuoteList === 'function') renderQuoteList();
        if (typeof renderRAMList === 'function') renderRAMList();
        
        await addSyncLogEntry('success', `Réconciliation terminée: ${Object.keys(divergences.details.local).reduce((sum, key) => sum + divergences.details.local[key], 0)} items synchronisés`);
        showToast('✅ Réconciliation automatique terminée', 'success');
    } else {
        await addSyncLogEntry('success', 'Réconciliation: données déjà synchronisées');
    }
}

// Export for testing
window.detectDataDivergences = detectDataDivergences;
window.reconcileData = reconcileData;
window.autoReconcile = autoReconcile;


// ========== CALCUL IRPP PROGRESSIF ==========

// Navigation - set up after DOM ready
function setupNavigation() {
    setNavTabs(document.querySelectorAll('.nav-tab'));
    setTabContents(document.querySelectorAll('.tab-content'));

    if (!getNavTabs()) return;

    getNavTabs().forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            getNavTabs().forEach(t => t.classList.remove('active'));
            getTabContents().forEach(c => c.classList.remove('active'));

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



// Setup bindings for elements that used inline onclick in HTML
function setupLegacyBindings() {
    // Simple button mappings
    document.getElementById('cancelEditBtn')?.addEventListener('click', cancelEditMode);
    document.getElementById('newInvoiceBtn')?.addEventListener('click', resetInvoiceForm);
    
    // Import / Export invoices (form)
    const importInvoicesBtn = document.getElementById('importInvoicesBtn');
    if (importInvoicesBtn) importInvoicesBtn.addEventListener('click', () => { importInvoicesFromSheets(); });
    const exportInvoicesBtn = document.getElementById('exportInvoicesBtn');
    if (exportInvoicesBtn) exportInvoicesBtn.addEventListener('click', () => { exportInvoicesToSheets(); });

    // Import / Export invoices (list)
    const importInvoicesBtnList = document.getElementById('importInvoicesBtnList');
    if (importInvoicesBtnList) importInvoicesBtnList.addEventListener('click', () => { importInvoicesFromSheets(); });
    const exportInvoicesBtnList = document.getElementById('exportInvoicesBtnList');
    if (exportInvoicesBtnList) exportInvoicesBtnList.addEventListener('click', () => { exportInvoicesToSheets(); });

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

window.editClient = editClient;
window.deleteClient = deleteClient;

// FACTURES - Invoice Generator
// lazy elements will be initialized in initApp

document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
    cancelEditMode();
});

// ========== MULTI-LINE INVOICE ITEMS MANAGEMENT ==========

// Expose functions to global scope for HTML onclick handlers
window.addInvoiceItem = addInvoiceItem;
window.removeInvoiceItem = removeInvoiceItem;
window.updateInvoiceItemField = updateInvoiceItemField;

// ========== END MULTI-LINE INVOICE ITEMS ==========

window.resetInvoiceForm = resetInvoiceForm;
window.changeCalendarView = changeCalendarView;
window.navigateCalendar = navigateCalendar;
window.showDayTasks = showDayTasks;

// ========================================
// GOOGLE CALENDAR API + FULLCALENDAR INTEGRATION
// Using Google Identity Services (GIS) - New OAuth2 method
// ========================================


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
    getTasks()[index] = {
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

window.deleteTaskFromEdit = deleteTaskFromEdit;

// Cancel edit mode
function cancelEditMode() {
    setEditMode(false);
    setEditingInvoiceNumberInput(-1);

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
    if (getInvoiceForm()) getInvoiceForm().reset();
    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) clientSelect.value = '';
    const clientNameEl = document.getElementById('clientName');
    const clientSiretEl = document.getElementById('clientSiret');
    const clientAddressEl = document.getElementById('clientAddress');
    if (clientNameEl) clientNameEl.readOnly = false;
    if (clientSiretEl) clientSiretEl.readOnly = false;
    if (clientAddressEl) clientAddressEl.readOnly = false;
    setDefaultDates();
    if (getInvoiceNumberInput()) getInvoiceNumberInput().value = getNextInvoiceNumber(getInvoiceDateInput() ? getInvoiceDateInput().value : null);
    
    // Clear invoice items and add one empty line
    clearInvoiceItems();
    addInvoiceItem();
    
    calculateTotal();
}

window.editInvoiceInForm = editInvoiceInForm;
window.cancelEditMode = cancelEditMode;

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
    try { updateDevisKPIs(); } catch (err) { console.warn('updateDevisKPIs after invoice edit failed', err); }
    showToast('Facture mise à jour');

    // Auto-sync after edit
    autoSync('update');
    saveToDrive();
});

window.deleteInvoiceFromList = deleteInvoiceFromList;
window.deleteInvoice = deleteInvoice;

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
    try { updateDevisKPIs(); } catch (err) { console.warn('updateDevisKPIs after payment update failed', err); }

    // Auto-sync after payment update
    autoSync('payment');
    saveToDrive();
}

function updateDateReception(index, value) {
    invoices[index].dateReception = value;
    applyFilters();
    try { updateDevisKPIs(); } catch (err) { console.warn('updateDevisKPIs after reception date update failed', err); }

    // Auto-sync after date update
    autoSync('payment');
    saveToDrive();
}

window.updateMontantRecu = updateMontantRecu;
window.updateDateReception = updateDateReception;

window.sendInvoiceEmail = sendInvoiceEmail;
window.setInvoiceStatus = setInvoiceStatus;

// Filter event listeners
function setupFilterListeners() {
    const applyFiltersAndKPIs = () => {
        applyFilters();
        try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
    };
    document.getElementById('periodFilter')?.addEventListener('change', applyFiltersAndKPIs);
    document.getElementById('startDateFilter')?.addEventListener('change', applyFiltersAndKPIs);
    document.getElementById('endDateFilter')?.addEventListener('change', applyFiltersAndKPIs);
    document.getElementById('clientFilterSelect')?.addEventListener('change', applyFiltersAndKPIs);
    document.getElementById('statusFilter')?.addEventListener('change', applyFiltersAndKPIs);
}

// PARAMÈTRES - Settings Management

// Charger la configuration technique dans l'UI (pré-remplit avec les valeurs de CONFIG)
// TODO: SETTINGS
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
// TODO: SETTINGS
async function saveTechnicalConfig() {
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
    
    // Sauvegarder dans IndexedDB + localStorage
    await saveConfigToStorage(newConfig);
    
    // Mettre à jour l'objet CONFIG global
    Object.assign(CONFIG, newConfig);
    
    showToast('✅ Configuration sauvegardée ! Rechargez la page pour appliquer les changements.', 'success');
    return true;
}

// TODO: SETTINGS
function loadCompanySettings() {
    // Charger la config technique
    loadTechnicalConfig();
    
    // Charger les infos entreprise
    if (document.getElementById('logoUrl')) {
        document.getElementById('logoUrl').value = getCompanyInfo().logoUrl || '';
        document.getElementById('companyLegalSiret').value = getCompanyInfo().siret || '[SIRET à venir]';
        document.getElementById('companyAddress').value = getCompanyInfo().address || '[Adresse]';
        document.getElementById('companyPostal').value = getCompanyInfo().postalCode || '[Code postal]';
        document.getElementById('companyCity').value = getCompanyInfo().city || '[Ville]';
        document.getElementById('companyIBAN').value = getCompanyInfo().iban || '';
        document.getElementById('companyBIC').value = getCompanyInfo().bic || '';
    }
    
    // Charger les paramètres fiscaux (taxSettings → HTML)
    if (document.getElementById('tauxAcreActif')) {
        document.getElementById('tauxAcreActif').value = getTaxSettings().acreActif;
        document.getElementById('tauxAcreInactif').value = getTaxSettings().acreInactif;
        document.getElementById('tauxCFPBNC').value = getTaxSettings().cfpBNC;
        document.getElementById('rfrMaxVL').value = getTaxSettings().rfrMaxVL;
        document.getElementById('seuilTVAAnnuel').value = getTaxSettings().seuilTVAAnnuel || 37500;
        document.getElementById('seuilTVAMajore').value = getTaxSettings().seuilTVAMajore || 39100;
        document.getElementById('caMaxBNC').value = getTaxSettings().caMaxBNC;
        document.getElementById('tauxVersementLib').value = getTaxSettings().versementLiberatoire;
        // Note: cfeAnnuel is no longer loaded from DOM in Paramètres, managed via Calculs commune search
    }
    
    // Charger l'objectif CA mensuel
    if (document.getElementById('objectifCAMensuel')) {
        document.getElementById('objectifCAMensuel').value = getTaxSettings().objectifCAMensuel || 6000;
        
        // Mettre à jour les seuils fiscaux affichés (référence mensuelle)
        const seuilTVAMensuel = (getTaxSettings().seuilTVAAnnuel || 37500) / 12;
        const seuilMicroMensuel = (getTaxSettings().caMaxBNC || 77700) / 12;
        
        if (document.getElementById('seuilTVAMensuel')) {
            document.getElementById('seuilTVAMensuel').textContent = seuilTVAMensuel.toFixed(0);
        }
        if (document.getElementById('seuilTVAAnnuel')) {
            document.getElementById('seuilTVAAnnuel').textContent = (getTaxSettings().seuilTVAAnnuel || 37500).toLocaleString('fr-FR');
        }
        if (document.getElementById('seuilMicroMensuel')) {
            document.getElementById('seuilMicroMensuel').textContent = seuilMicroMensuel.toFixed(0);
        }
        if (document.getElementById('seuilMicroAnnuel')) {
            document.getElementById('seuilMicroAnnuel').textContent = (getTaxSettings().caMaxBNC || 77700).toLocaleString('fr-FR');
        }
    }
}

// TODO: SETTINGS
function saveSettings() {
    // Save company info
    if (document.getElementById('logoUrl')) {
        getCompanyInfo().logoUrl = document.getElementById('logoUrl').value || '';
        getCompanyInfo().siret = document.getElementById('companyLegalSiret').value || '[SIRET à venir]';
        getCompanyInfo().address = document.getElementById('companyAddress').value || '[Adresse]';
        getCompanyInfo().postalCode = document.getElementById('companyPostal').value || '[Code postal]';
        getCompanyInfo().city = document.getElementById('companyCity').value || '[Ville]';
        getCompanyInfo().iban = document.getElementById('companyIBAN').value || '';
        getCompanyInfo().bic = document.getElementById('companyBIC').value || '';
    }
    getTaxSettings().tauxIS = parseFloat(document.getElementById('tauxIS')?.value) || 0;
    getTaxSettings().versementLiberatoire = parseFloat(document.getElementById('tauxVersementLib')?.value) || 2.2;
    // Note: cfeAnnuel is now managed only via commune search in Calculs tab, not in Paramètres
    getTaxSettings().acreActif = parseFloat(document.getElementById('tauxAcreActif')?.value) || 12.3;
    getTaxSettings().acreInactif = parseFloat(document.getElementById('tauxAcreInactif')?.value) || 24.6;
    getTaxSettings().cfpBNC = parseFloat(document.getElementById('tauxCFPBNC')?.value) || 0.2;
    getTaxSettings().rfrMaxVL = parseFloat(document.getElementById('rfrMaxVL')?.value) || 28797;
    getTaxSettings().seuilTVAAnnuel = parseFloat(document.getElementById('seuilTVAAnnuel')?.value) || 37500;
    getTaxSettings().seuilTVAMajore = parseFloat(document.getElementById('seuilTVAMajore')?.value) || 39100;
    getTaxSettings().caMaxBNC = parseFloat(document.getElementById('caMaxBNC')?.value) || 77700;
    getTaxSettings().objectifCAMensuel = parseFloat(document.getElementById('objectifCAMensuel')?.value) || 6000;
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

// TODO: SETTINGS
function resetSettings() {
    document.getElementById('tauxIS').value = defaultSettings.tauxIS;
    document.getElementById('tauxVersementLib').value = defaultSettings.versementLiberatoire;
    document.getElementById('tauxAcreActif').value = defaultSettings.acreActif;
    document.getElementById('tauxAcreInactif').value = defaultSettings.acreInactif;
    document.getElementById('tauxCFPBNC').value = defaultSettings.cfpBNC;
    document.getElementById('rfrMaxVL').value = defaultSettings.rfrMaxVL;
    document.getElementById('seuilTVAAnnuel').value = defaultSettings.seuilTVAAnnuel || 37500;
    document.getElementById('seuilTVAMajore').value = defaultSettings.seuilTVAMajore || 39100;
    document.getElementById('caMaxBNC').value = defaultSettings.caMaxBNC;
    document.getElementById('objectifCAMensuel').value = defaultSettings.objectifCAMensuel || 6000;
    
    // Réinitialiser le barème IRPP
    getTaxSettings().irppBareme = JSON.parse(JSON.stringify(defaultSettings.irppBareme));
    getTaxSettings().bncAbattement = defaultSettings.bncAbattement;
    renderIRPPBareme();
}

// ========== GESTION UI BARÈME IRPP ==========

// Exposer les fonctions au global scope pour les onclick
window.updateIRPPTranche = updateIRPPTranche;
window.addIRPPTranche = addIRPPTranche;
window.removeIRPPTranche = removeIRPPTranche;

// Settings event listeners
if (document.getElementById('saveSettings')) {
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('resetSettings').addEventListener('click', resetSettings);
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
                getCompanyInfo().logoUrl = dataUri;
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
        getCompanyInfo().logoUrl = document.getElementById('logoUrl').value || '';
    });
    document.getElementById('companyLegalSiret').addEventListener('input', () => {
        getCompanyInfo().siret = document.getElementById('companyLegalSiret').value || '[SIRET à venir]';
    });
    document.getElementById('companyAddress').addEventListener('input', () => {
        getCompanyInfo().address = document.getElementById('companyAddress').value || '[Adresse]';
    });
    document.getElementById('companyPostal').addEventListener('input', () => {
        getCompanyInfo().postalCode = document.getElementById('companyPostal').value || '[Code postal]';
    });
    document.getElementById('companyCity').addEventListener('input', () => {
        getCompanyInfo().city = document.getElementById('companyCity').value || '[Ville]';
    });
}

// CALCULS - Tax Calculator
const caInput = document.getElementById('caInput');

// ================= URSSAF Mon-entreprise API Integration =================
// Minimal client to evaluate official rules and fetch thresholds.
// Docs: https://mon-entreprise.urssaf.fr/documentation/dirigeant/auto%E2%80%91entrepreneur
// OpenAPI: https://mon-entreprise.urssaf.fr/api/v1/openapi.json



// Call integration early after initial render if available in DOM lifecycle
document.addEventListener('DOMContentLoaded', () => {
    // Fire and forget; UI falls back silently on local values
    // Add 1 second delay to avoid 429 rate limiting
    setTimeout(() => initUrssafIntegration(), 1000);
    // Bind manual refresh if button exists in settings
    const btn = document.getElementById('refreshFiscalThresholdsBtn');
    if (btn) {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const oldText = btn.textContent;
            btn.textContent = '🔄 Rafraîchissement...';
            const result = await loadFiscalThresholdsFromAPI();
            btn.textContent = oldText;
            btn.disabled = false;
            if (result) {
                showToast('Seuils fiscaux mis à jour depuis URSSAF', 'success');
            } else {
                showToast('Impossible de mettre à jour les seuils (réseau/API). Valeurs locales conservées.', 'warning');
            }
        });
    }
});

// Expose manual refresh to legacy inline handlers if needed
window.refreshFiscalThresholds = async function() {
    const res = await loadFiscalThresholdsFromAPI();
    if (res) showToast('Seuils fiscaux mis à jour depuis URSSAF', 'success');
    else showToast('Échec mise à jour seuils. Valeurs locales conservées.', 'warning');
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
const testUrssafAPIBtn = document.getElementById('testUrssafAPI');
if (saveSimulationBtn) {
    saveSimulationBtn.addEventListener('click', saveSimulationParams);
}
if (resetSimulationBtn) {
    resetSimulationBtn.addEventListener('click', resetSimulationParams);
}
if (testUrssafAPIBtn) {
    testUrssafAPIBtn.addEventListener('click', testUrssafAPI);
}

// Fonction sauvegarde paramètres simulation
// TODO: SIMULATION
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
// TODO: SIMULATION
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
// TODO: SIMULATION
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
    getTaxSettings().cfeAnnuel = defaultSettings.cfeAnnuel || 600;
    
    // Supprimer de localStorage
    localStorage.removeItem('mti_simulation_params');
    
    // Recalculer
    calculateTaxes();
}

// Fonction vérification éligibilité Versement Libératoire
// TODO: SIMULATION
function verifierEligibiliteVL() {
    const rfr = parseFloat(rfrInput?.value) || 0;
    const eligibiliteDiv = document.getElementById('eligibiliteVL');
    
    if (!eligibiliteDiv) return;
    
    if (rfr === 0) {
        eligibiliteDiv.style.display = 'none';
        return;
    }
    
    const seuil = getTaxSettings().rfrMaxVL || 28797;
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

// Fonction export PDF simulateur
// TODO: SIMULATION
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
    pdf.text(`Chiffre d'affaires: ${formatNumber(ca)} € ${isMensuel ? '(mensuel)' : '(annuel)'}`, 15, 48);
    pdf.text(`Situation ACRE: ${acreActive ? 'Année 1 (12,3%)' : 'Année 2+ (24,6%)'}`, 15, 54);
    pdf.text(`CFE annuelle: ${getTaxSettings().cfeAnnuel} €`, 15, 60);
    
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

window.toggleAutoSync = toggleAutoSync;
window.showSyncLogModal = showSyncLogModal;

// Make sync function global
window.syncToGoogleSheets = syncToGoogleSheets;
window.syncToGoogleCalendar = syncToGoogleCalendar;

document.getElementById('cancelConfirm')?.addEventListener('click', () => {
    document.getElementById('confirmModal')?.classList.remove('show');
    setConfirmCallback(null);

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
        if (getConfirmCallback()) {
            // If callback returns a promise, await it
            const res = getConfirmCallback();
            if (res && typeof res.then === 'function') {
                await res;
            }
        }
    } catch (err) {
        console.error('Erreur lors de l\'action confirmée:', err);
        showToast('Erreur lors de l\'action', 'error');
    } finally {
        document.getElementById('confirmModal')?.classList.remove('show');
        setConfirmCallback(null);
        if (btn) { btn.disabled = false; btn.style.backgroundColor = ''; btn.style.color = ''; }
    }
});

function initPreviewConfirmButton() {
    const btn = document.getElementById('previewConfirmSendBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        // Validations bloquantes (même pattern que preview)
        const clientNameEl = document.getElementById('clientName');
        const clientAddressEl = document.getElementById('clientAddress');
        
        if (!clientNameEl || !clientAddressEl || !getInvoiceNumberInput() || !getInvoiceDateInput() || !getDueDateInput()) {
            showToast('❌ Erreur: Éléments du formulaire introuvables', 'error');
            return;
        }

        const clientName = clientNameEl.value.trim();
        const clientAddress = clientAddressEl.value.trim();
        const invoiceDate = getInvoiceDateInput().value;
        const dueDate = getDueDateInput().value;
        const items = getCurrentInvoiceItems();
        
        if (!clientName) {
            showToast('⚠️ Veuillez saisir le nom du client', 'error');
            return;
        }
        
        if (!clientAddress) {
            showToast('⚠️ Veuillez saisir l\'adresse du client', 'error');
            return;
        }
        
        if (!invoiceDate || !dueDate) {
            showToast('⚠️ Veuillez remplir les dates (émission et échéance)', 'error');
            return;
        }
        
        if (!items || items.length === 0) {
            showToast('⚠️ Ajoutez au moins une ligne de facturation', 'error');
            return;
        }
        
        // Vérifier que chaque item est valide
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.description || !item.description.trim()) {
                showToast(`⚠️ La ligne ${i + 1} doit avoir une description`, 'error');
                return;
            }
            if (!item.quantity || item.quantity <= 0) {
                showToast(`⚠️ La ligne ${i + 1} doit avoir une quantité > 0`, 'error');
                return;
            }
            if (!item.unitPrice || item.unitPrice <= 0) {
                showToast(`⚠️ La ligne ${i + 1} doit avoir un prix unitaire > 0`, 'error');
                return;
            }
        }
        
        // Toutes les validations passées, on peut continuer
        const invoice = getCurrentInvoiceForPreview();
        if (!invoice) { showToast('❌ Aucune facture trouvée pour prévisualisation', 'error'); return; }
        try { await previewAndConfirmSend(invoice); } catch (e) { console.error('previewAndConfirmSend failed', e); showToast('❌ Erreur lors de la préparation de l\'envoi', 'error'); }
    });
    setupEmailPreviewHandlersForConfirmSend();
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
        const safeNumGen = String(invoice.number || Date.now()).replace(/^(FACTURE|INVOICE)[-_ ]?/i, '');
        const pdfFilename = 'Facture_' + safeNumGen + '.pdf';
        const saveResp = await callBackend('savePdfToDrive', { pdfBase64: pdfBase64, pdfFilename: pdfFilename, folderName: 'Factures' });
        if (!saveResp || saveResp.success === false) {
            try { showBackendRawResponse(saveResp); } catch (e) {}
            alert('Impossible de sauvegarder la facture sur Drive.');
            return;
        }
        const previewUrl = saveResp.data && saveResp.data.previewUrl;
        const fileUrl = saveResp.data && saveResp.data.fileUrl;
        if (previewUrl || fileUrl) {
            window.open(previewUrl || fileUrl, '_blank');
            showToast('✅ Facture sauvegardée et ouverte depuis Drive');
        }
    } catch (e) { console.error('downloadPDF failed', e); alert('Erreur lors de la génération du PDF'); }
});

window.downloadInvoiceFromList = downloadInvoiceFromList;

// Initialize app
async function initApp() {
    // Migrate to IndexedDB if not already done (v2.5.0)
    storageManager.migrateFromLocalStorage().then(() => {
        console.log('✅ Storage migration check complete');
    }).catch(err => {
        console.error('⚠️ Migration error:', err);
    });
    
    // Load sync log and auto-sync preference early (loadSyncLog is now async)
    await loadSyncLog();
    loadAutoSyncPreference();
    
    // Load data from IndexedDB first (backup si Drive échoue)
    try {
        const storedQuotes = await storageManager.getItem('mti_quotes');
        if (storedQuotes) {
            setQuotes(storedQuotes);
            console.log(`✅ ${quotes.length} devis chargés depuis IndexedDB`);
        }
    } catch (e) {
        console.warn('Erreur chargement quotes IndexedDB:', e);
    }
    
    try {
        const storedRAMs = await storageManager.getItem('mti_rams');
        if (storedRAMs) {
            setRams(storedRAMs);
            console.log(`✅ ${rams.length} RAMs chargés depuis IndexedDB`);
        }
    } catch (e) {
        console.warn('Erreur chargement RAMs IndexedDB:', e);
    }

    // Charger les factures depuis IndexedDB si disponibles et si aucune facture n'est chargée
    try {
        const storedInvoices = await storageManager.getItem('mti_invoices');
        if ((!invoices || invoices.length === 0) && storedInvoices) {
            setInvoices(storedInvoices);
            console.log(`✅ ${invoices.length} factures chargées depuis IndexedDB`);
        }
    } catch (e) {
        console.warn('Erreur chargement factures IndexedDB:', e);
    }
    
    // Setup lazy DOM references
    setInvoiceForm(document.getElementById('invoiceForm'));
    setInvoiceNumberInput(document.getElementById('invoiceNumber'));
    setInvoiceDateInput(document.getElementById('invoiceDate'));
    setDueDateInput(document.getElementById('dueDate'));
    setQuantityInput(document.getElementById('quantity'));
    setUnitPriceInput(document.getElementById('unitPrice'));
    setTotalHTInput(document.getElementById('totalHT'));

    setupNavigation();
    setupClientSelectListener();
    setupRAMClientSelectListener();
    setupClientFormHandlers();
    setupInvoiceFormListeners();
    setupInvoiceSaveHandler();
    setupTaskHandlers();
    setupEmailPreviewHandlers();
    setupFilterListeners();
    setupLegacyBindings();
    
    // Initialize quote form
    initQuoteForm();
    
    // Initialize quote preview-confirm button
    const previewConfirmQuoteBtn = document.getElementById('previewConfirmQuoteSendBtn');
    if (previewConfirmQuoteBtn) {
        previewConfirmQuoteBtn.addEventListener('click', previewAndConfirmQuoteSend);
    }

    setDefaultDates();
    if (getInvoiceNumberInput()) getInvoiceNumberInput().value = getNextInvoiceNumber(getInvoiceDateInput() ? getInvoiceDateInput().value : null);
    
    // Initialize invoice items with one empty line
    if (getCurrentInvoiceItems().length === 0) {
        addInvoiceItem();
    }
    
    calculateTotal();
    renderCalendar();
    renderClientsTable();
    renderInvoiceList();
    renderQuoteList(); // Render quotes list
    renderRAMList();  // Afficher les RAMs chargés depuis localStorage
    populateClientSelects();
    checkOverdueInvoices();
    applyFilters();
    updateDevisKPIs(); // Initialiser les stats Devis au chargement
    renderCharts();
    calculateTaxes();
    // Note: updateCFEMensuel() removed - CFE is now managed only via commune search in Calculs tab
    loadCompanySettings();
    renderIRPPBareme(); // Initialiser l'UI du barème IRPP
    loadSimulationParams(); // Charger les paramètres de simulation sauvegardés

    // Auto-reconciliation check (v2.4.4)
    setTimeout(() => {
        autoReconcile();
    }, 2000); // Wait 2s for Drive data to load

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
    
    // Export FEC button binding
    const exportFECBtn = document.getElementById('exportFECBtn');
    if (exportFECBtn) exportFECBtn.addEventListener('click', exportFEC);

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

// Start the app on DOM ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initialisation MTI CONSULTING v2.0...');
    
    // Auto-configuration depuis URL (déploiement script)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('autoconfig')) {
        try {
            const configData = JSON.parse(decodeURIComponent(urlParams.get('autoconfig')));
            await saveConfigToStorage(configData);
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
        await initApp();
        // Update sync log display after init
        setTimeout(() => {
            updateSyncLogDisplay();
        }, 500);
        console.log('✅ Application prête' + (isConfigured ? '' : ' (mode hors ligne)'));
    } catch (e) {
        console.error('Erreur initialisation app:', e);
        showToast('Erreur d\'initialisation', 'error');
    }
});

// ==========================================
// RAPPORT D'ACTIVITÉ MENSUELLE (RAM)
// ==========================================

window.generateRAMForInvoice = generateRAMForInvoice;
window.showRAMModal = showRAMModal;
window.generateRAMCalendar = generateRAMCalendar;
window.refreshRAMCalendar = refreshRAMCalendar;
window.closeRAMModal = closeRAMModal;
window.generateRAMFromModal = generateRAMFromModal;
window.showRAMPreview = showRAMPreview;
window.saveRAM = saveRAM;
window.downloadRAMPDF = downloadRAMPDF;
window.sendRAMEmail = sendRAMEmail;
window.editRAM = editRAM;
window.updateRAMFromModal = updateRAMFromModal;
window.clearRAMsInSheets = clearRAMsInSheets;
window.renderRAMList = renderRAMList;
window.filterInvoiceList = filterInvoiceList;
window.filterRAMList = filterRAMList;
window.editRAMInForm = editRAMInForm;
window.cancelRAMEdit = cancelRAMEdit;
window.populateRAMInvoiceSelect = populateRAMInvoiceSelect;
window.resetRAMForm = resetRAMForm;
window.showNewRAMForm = showNewRAMForm;
window.generateRAMCalendarInForm = generateRAMCalendarInForm;
window.refreshRAMFormCalendar = refreshRAMFormCalendar;
window.saveRAMFromForm = saveRAMFromForm;
window.deleteRAM = deleteRAM;
window.sendInvoiceWithRAM = sendInvoiceWithRAM;
window.clearClientsInSheets = clearClientsInSheets;

// ==========================================
// RAM SYNC AVEC GOOGLE SHEETS
// ==========================================

window.exportRAMsToSheets = exportRAMsToSheets;
window.importRAMsFromSheets = importRAMsFromSheets;

// ==========================================
// QUOTES SYNC AVEC GOOGLE SHEETS
// ==========================================

window.exportQuotesToSheets = exportQuotesToSheets;
window.importQuotesFromSheets = importQuotesFromSheets;

// ===================================================================
// PHASE 1 - NOUVELLES FONCTIONNALITÉS (Décembre 2025)
// ===================================================================

// 1. COMPTEUR CA ANNUEL AVEC ALERTES SEUILS
// -----------------------------------------------------------

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


// ============================================================
// 2.5 DEVIS (QUOTES)
// ============================================================

window.openQuoteByNumber = openQuoteByNumber;

// Exposer les fonctions au scope global pour onclick handlers
window.addQuoteItem = addQuoteItem;
window.removeQuoteItem = removeQuoteItem;
window.updateQuoteItemField = updateQuoteItemField;
window.openInvoiceByNumber = function(number) {
    const idx = invoices.findIndex(inv => inv.number === number);
    if (idx >= 0) {
        // Basculer sur l’onglet factures puis ouvrir en édition
        const tab = document.querySelector('[data-tab="factures"]');
        if (tab) tab.click();
        editInvoiceInForm(idx);
    } else {
        showToast(`❌ Facture ${number} introuvable`, 'error');
    }
};
window.openQuoteByNumber = function(number) {
    const idx = quotes.findIndex(q => q.number === number);
    if (idx >= 0) {
        const tab = document.querySelector('[data-tab="devis"]');
        if (tab) tab.click();
        editQuoteInForm(idx);
    } else {
        showToast(`❌ Devis ${number} introuvable`, 'error');
    }
};

window.setQuoteStatus = setQuoteStatus;

// Exposer les fonctions globales
window.editQuoteInForm = editQuoteInForm;
window.deleteQuote = deleteQuote;
window.sendQuoteEmail = sendQuoteEmail;
window.downloadQuotePDF = downloadQuotePDF;
window.convertQuoteToInvoice = convertQuoteToInvoice;
window.showQuoteEmailPreview = showQuoteEmailPreview;
window.confirmQuoteEmailSend = confirmQuoteEmailSend;
window.previewAndConfirmQuoteSend = previewAndConfirmQuoteSend;
window.confirmQuoteEmailSendFromForm = confirmQuoteEmailSendFromForm;

// ===================================================================
// UI HANDLERS - NOUVELLES FONCTIONNALITÉS PHASE 1
// ===================================================================

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
            document.getElementById('tvaResultHT').textContent = result.formatNumber(ht) + ' €';
            document.getElementById('tvaResultTVA').textContent = result.formatNumber(tva) + ' €';
            document.getElementById('tvaResultTTC').textContent = result.formatNumber(ttc) + ' €';
            
            // Message d'impact
            const impactMsg = direction === 'ht-to-ttc' 
                ? `Si vous facturez actuellement ${formatNumber(result.ht)} € TTC (franchise TVA), vous devrez facturer ${formatNumber(result.ttc)} € TTC avec TVA (+${formatNumber(result.tva)} € pour le client) OU garder ${formatNumber(result.ht)} € TTC et perdre ${((result.tva / result.ttc) * 100).toFixed(1)}% de marge.`
                : `Votre prix actuel ${formatNumber(result.ttc)} € TTC correspond à ${formatNumber(result.ht)} € HT + ${formatNumber(result.tva)} € TVA. Si vous gardez ce prix TTC après assujettissement, vous perdrez ${formatNumber(result.tva)} € (collecté pour l'État).`;
            
            document.getElementById('tvaImpactMessage').textContent = impactMsg;
            document.getElementById('tvaResults').style.display = 'block';
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

async function updateStorageUI() {
    try {
        const mode = window.getStorageMode();
        const stats = await storageManager.getStorageStats();
        const backupEnabled = storageManager.backupEnabled;

        document.getElementById('storageMode').textContent = mode === 'indexeddb' ? 'IndexedDB' : 'localStorage';
        document.getElementById('storageBackupStatus').textContent = backupEnabled ? 'Activé ✅' : 'Désactivé ❌';
        document.getElementById('storageBackupStatus').style.color = backupEnabled ? 'var(--color-success)' : 'var(--color-error)';
        document.getElementById('storageSpaceUsed').textContent = `${stats.used} / ${stats.available} (${stats.percentage})`;
    } catch (e) {
        console.error('Erreur mise à jour UI stockage:', e);
    }
}

// Handlers boutons stockage
document.getElementById('refreshStorageStatsBtn')?.addEventListener('click', async () => {
    await updateStorageUI();
    showToast('Statistiques actualisées', 'success');
});

document.getElementById('exportLocalBackupBtn')?.addEventListener('click', async () => {
    try {
        const backup = await exportLocalBackup(true);
        const blob = new Blob([backup.serialized], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mti_backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup exporté avec succès', 'success');
    } catch (e) {
        showToast(`Erreur export: ${e.message}`, 'error');
    }
});

document.getElementById('importLocalBackupBtn')?.addEventListener('click', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const result = await importLocalBackup(text, { compressed: true });
            showToast(`Import réussi: ${result.restored.length} clés restaurées`, 'success');
            await updateStorageUI();
            location.reload(); // Recharger pour appliquer
        } catch (e) {
            showToast(`Erreur import: ${e.message}`, 'error');
        }
    };
    input.click();
});

document.getElementById('toggleBackupBtn')?.addEventListener('click', () => {
    const newState = !storageManager.backupEnabled;
    setStorageBackupEnabled(newState);
    updateStorageUI();
    showToast(`Backup localStorage ${newState ? 'activé' : 'désactivé'}`, newState ? 'success' : 'info');
});

// Initialiser au chargement de l'onglet paramètres
const parametresTab = document.querySelector('[onclick*="parametres"]');
if (parametresTab) {
    parametresTab.addEventListener('click', () => {
        setTimeout(updateStorageUI, 100);
    });
}

// Init au chargement de la page
setTimeout(updateStorageUI, 1000);

(function(){
    try {
        var cfg = window.CONFIG || (function(){ try { return JSON.parse(localStorage.getItem('mti_app_config')||'{}'); } catch(e){ return {}; } })();
        if (!cfg || !cfg.DEBUG_UI_BADGES) {
            var showcase = document.getElementById('statusShowcase');
            var toggleBtn = document.getElementById('toggleStatusShowcaseBtn');
            if (showcase) showcase.remove();
            if (toggleBtn) toggleBtn.remove();
        }
    } catch(e) {
        var showcase = document.getElementById('statusShowcase');
        var toggleBtn = document.getElementById('toggleStatusShowcaseBtn');
        if (showcase) showcase.remove();
        if (toggleBtn) toggleBtn.remove();
    }
})();

