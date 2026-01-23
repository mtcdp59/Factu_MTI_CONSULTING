import {
    CONFIG,
    defaultSettings,
    getClients,
    getCurrentDate,
    getDueDateInput,
    getFullCalendarInstance,
    getInvoiceDateInput,
    getInvoiceForm,
    getInvoiceNumberInput,
    getInvoices,
    getIsSyncing,
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
    setIsSyncing,
    setNavTabs,
    setQuantityInput,
    setQuotes,
    setRams,
    setSuppressSheetsSyncInterval,
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
    createGoogleCalendarEvent,
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
    generateRAMPDF,
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
    syncToDrive,
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
import { showConfirmation } from "./src/modules/modal.js";

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

// Export FEC (Fichier des Écritures Comptables)
// TODO: EXPORT
async function exportFEC() {
    try {
        // Demander l'exercice comptable à l'utilisateur
        const yearStr = prompt('Année de l\'exercice comptable (ex: 2025):', new Date().getFullYear());
        if (!yearStr) return;
        
        const year = parseInt(yearStr);
        if (isNaN(year) || year < 2000 || year > 2100) {
            showToast('⚠️ Année invalide', 'error');
            return;
        }
        
        // Format YYYYMMDD pour le FEC
        const exerciceStart = year + '0101'; // 1er janvier
        const exerciceEnd = year + '1231';   // 31 décembre
        
        // Extraire SIREN du SIRET (9 premiers chiffres)
        const siret = getCompanyInfo().siret || '000000000';
        const siren = siret.replace(/\s/g, '').substring(0, 9);
        
        showToast('⏳ Génération du FEC en cours...', 'info');
        
        const result = await callBackend('generateFEC', {
            exerciceStart: exerciceStart,
            exerciceEnd: exerciceEnd,
            siren: siren
        });
        
        console.log('📦 Réponse FEC:', result);
        
        if (!result.success) {
            showToast('❌ Erreur: ' + result.message, 'error');
            return;
        }
        
        const { filename, content, lineCount, invoiceCount, debug } = result.data;
        
        // Afficher les infos de débogage
        if (debug) {
            console.log('🔍 Debug FEC:', debug);
            console.log(`  Total factures: ${debug.totalInvoices}`);
            console.log(`  Factures retenues: ${debug.filteredInvoices}`);
            console.log(`  Factures exclues: ${debug.excludedCount}`);
            console.log(`  Échantillon:`, debug.sampleInvoices);
        }
        
        // Télécharger le fichier FEC
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast(`✅ FEC exporté : ${invoiceCount} facture(s), ${lineCount} ligne(s)`, 'success');
        
        console.log('FEC généré:', filename, 'Lignes:', lineCount, 'Factures:', invoiceCount);
    } catch (error) {
        console.error('Erreur export FEC:', error);
        showToast('❌ Erreur lors de l\'export FEC: ' + error.message, 'error');
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


// TODO: TASKS
function showDayTasks(dateStr) {
    const dayTasks = getTasks().filter(task => task.date === dateStr);
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

// Task form
// TODO: TASK
function setupTaskHandlers() {
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            const taskDate = document.getElementById('taskDate');
            if (taskDate) taskDate.value = formatDate(getCurrentDate());
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
                if (getFullCalendarInstance()) {
                    getFullCalendarInstance().refetchEvents();
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
// TODO: TASK
function editTask(index) {
    const task = getTasks()[index];
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

// TODO: TASK
function deleteTaskFromEdit() {
    const index = parseInt(document.getElementById('editTaskIndex').value);
    showConfirmation(
        'Supprimer la tâche',
        'Êtes-vous sûr de vouloir supprimer cette tâche ?',
        async () => {
            // If this task has a calendar event, attempt to delete it server-side
            const task = getTasks()[index];
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
            getTasks().splice(index, 1);
            renderCalendar();
            document.getElementById('editTaskModal')?.classList.remove('show');
            showToast('Tâche supprimée');
            saveToDrive();
        }
    );
}

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

// Setup listeners pour mise à jour automatique du select factures dans le formulaire RAM
// TODO: RAM
function setupRAMFormListeners() {
    const clientSelect = document.getElementById('ramClientSelect');
    const clientInput = document.getElementById('ramClientInput');
    const monthSelect = document.getElementById('ramMonthSelect');
    const yearInput = document.getElementById('ramYearInput');
    
    if (!monthSelect || !yearInput) return;
    
    // Fonction pour récupérer le nom du client actuel (depuis select ou input manuel)
    const getCurrentClientName = () => {
        if (clientSelect && clientSelect.value !== '') {
            // Client sélectionné dans le dropdown
            const index = parseInt(clientSelect.value);
            return clients[index] ? clients[index].name : '';
        }
        // Saisie manuelle
        return clientInput ? clientInput.value.trim() : '';
    };
    
    // Fonction pour mettre à jour le select des factures
    const updateInvoiceSelect = () => {
        const client = getCurrentClientName();
        const month = parseInt(monthSelect.value);
        const year = parseInt(yearInput.value);
        
        if (client) {
            populateRAMInvoiceSelect(client, month, year);
        }
    };
    
    // Écouter les changements
    if (clientSelect) clientSelect.addEventListener('change', updateInvoiceSelect);
    if (clientInput) clientInput.addEventListener('blur', updateInvoiceSelect);
    if (monthSelect) monthSelect.addEventListener('change', updateInvoiceSelect);
    if (yearInput) yearInput.addEventListener('change', updateInvoiceSelect);
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

// Générer le Rapport d'Activité Mensuelle pour une facture
// TODO: RAM
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
// TODO: RAM
function showRAMModal(invoice, ramIndex = null) {
    // Stocker l'index si on édite un RAM existant
    if (ramIndex !== null) {
        window.editingRAMIndex = ramIndex;
    }
    
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
// TODO: RAM
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
// TODO: RAM
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
// TODO: RAM
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
    
    // Vérifier si un RAM existe déjà pour CE CLIENT et ce mois/année
    const existingRAMIndex = rams.findIndex(r => r.client === client && r.month === month && r.year === year);
    
    // Si on est en mode édition (window.editingRAMIndex défini), vérifier que ce n'est pas le même RAM
    const isEditingThisRAM = (window.editingRAMIndex >= 0 && existingRAMIndex === window.editingRAMIndex);
    
    if (existingRAMIndex !== -1 && !isEditingThisRAM) {
        // Un autre RAM existe déjà pour ce client/mois/année
        const monthName = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][month];
        if (!confirm(`⚠️ Un RAM existe déjà pour "${client}" - ${monthName} ${year}.\n\nVoulez-vous le remplacer ?`)) {
            closeRAMModal();
            return;
        }
        // Supprimer l'ancien pour le remplacer
        rams.splice(existingRAMIndex, 1);
    } else if (isEditingThisRAM) {
        // On édite le RAM existant, le supprimer pour le remplacer
        rams.splice(existingRAMIndex, 1);
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
    
    // Enregistrer directement le RAM (sans étape aperçu)
    rams.push(ram);
    await storageManager.saveDual('mti_rams', rams);
    await syncToDrive();

    // Réinitialiser le mode édition
    window.editingRAMIndex = -1;

    closeRAMModal();

    // Basculer vers l'onglet RAM et afficher la liste
    document.querySelector('[data-tab="ram"]')?.click();
    renderRAMList();    showToast(`✅ RAM créé avec succès pour ${client} - ${monthName} ${year}`, 'success');
    
    // Générer automatiquement le PDF
    try {
        await generateRAMPDF(ram);
        showToast('📄 PDF généré avec succès', 'success');
    } catch (error) {
        console.error('Erreur génération PDF:', error);
        showToast('⚠️ RAM enregistré mais erreur génération PDF', 'warning');
    }
}

window.generateRAMFromModal = generateRAMFromModal;

// Afficher l'aperçu du RAM
// TODO: RAM
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
// TODO: RAM
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
        await storageManager.saveDual('mti_rams', rams);
        
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
// TODO: RAM
async function downloadRAMPDF(ramId) {
    const ram = window.currentRAM || rams.find(r => r.id === ramId);
    if (!ram) {
        showToast('❌ RAM introuvable', 'error');
        return;
    }
    
    try {
        showToast('⏳ Génération du PDF et sauvegarde sur Drive...');
        const pdfBase64 = await generateRAMPDF(ram);
        const monthStr = (ram.month + 1).toString().padStart(2, '0');
        const filename = `RAM_${ram.year}${monthStr}_${ram.client.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        const saveRes = await callBackend('savePdfToDrive', {
            pdfBase64,
            pdfFilename: filename,
            folderName: 'RAM'
        });
        if (!saveRes || !saveRes.success) {
            showToast('❌ Erreur sauvegarde sur Drive', 'error');
            return;
        }
        showToast('✅ PDF RAM sauvegardé sur Drive !', 'success');
        // Afficher le lien de prévisualisation Drive
        if (saveRes.data && saveRes.data.previewUrl) {
            window.open(saveRes.data.previewUrl, '_blank');
        }
    } catch (error) {
        console.error('Erreur génération/sauvegarde PDF:', error);
        showToast('❌ Erreur lors de la génération ou sauvegarde du PDF: ' + error.message, 'error');
    }
}

window.downloadRAMPDF = downloadRAMPDF;
window.sendRAMEmail = sendRAMEmail;

// Modifier le RAM
// TODO: RAM
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
// TODO: RAM
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
// TODO: RAM
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
// TODO: RAM
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
        const deleted = result?.data?.rowsDeleted ?? 0;
        showToast(`✅ Feuille RAM nettoyée (${deleted} ligne(s) supprimée(s))`, 'success');
    } catch (error) {
        console.error('Erreur clearRAMsInSheets:', error);
        showToast('❌ Erreur lors du nettoyage : ' + error.message, 'error');
    }
}

window.clearRAMsInSheets = clearRAMsInSheets;

// Afficher la liste des RAMs enregistrés (table comme les factures)
// TODO: RAM
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
            <td>${ram.createdAt && !isNaN(new Date(ram.createdAt)) ? new Date(ram.createdAt).toLocaleDateString('fr-FR') : 'Non renseignée'}</td>
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
window.filterInvoiceList = filterInvoiceList;
window.filterRAMList = filterRAMList;

/**
 * Filtre la liste des RAM selon la recherche
 */
// TODO: RAM
function filterRAMList() {
    const searchInput = document.getElementById('ramSearchInput');
    if (!searchInput) return;
    
    const rawTerm = searchInput.value.trim();
    const searchTerm = rawTerm.toLowerCase();
    const tbody = document.getElementById('ramTableBody');
    if (!tbody) return;
    
    // Si vide, afficher tous les RAM
    if (searchTerm === '') {
        renderRAMList();
        return;
    }
    
    // Filtrer les RAM
    // Déterminer si la recherche cible les heures (accepte "12", "12.5", "12h", "12,5h")
    const hoursQueryStr = rawTerm.replace(/\s/gi, '').replace(/h$/i, '').replace(',', '.');
    const hoursQuery = parseFloat(hoursQueryStr);

    const filtered = rams.filter(ram => {
        const matchesText = (
            ram.client.toLowerCase().includes(searchTerm) ||
            ram.monthName.toLowerCase().includes(searchTerm) ||
            ram.year.toString().includes(searchTerm) ||
            (ram.invoiceNumber && ram.invoiceNumber.toLowerCase().includes(searchTerm))
        );

        // Calculer le total d'heures du RAM
        const totalHours = ram.activities.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0);

        // Match heures si une valeur numérique est détectée dans la recherche
        const matchesHours = !isNaN(hoursQuery) && (
            Math.abs(totalHours - hoursQuery) < 0.0001 ||
            totalHours.toFixed(2).includes(hoursQueryStr)
        );

        return matchesText || matchesHours;
    });
    
    // Afficher les résultats filtrés
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: var(--space-24); color: var(--color-text-secondary);">Aucun résultat trouvé</td></tr>';
        return;
    }
    
    filtered.forEach((ram) => {
        const index = rams.indexOf(ram);
        const totalHours = ram.activities.reduce((sum, a) => sum + (a.hours || 0), 0);
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${ram.client}</td>
            <td>${ram.monthName} ${ram.year}</td>
            <td>${totalHours.toFixed(2)}h</td>
            <td>${ram.invoiceNumber || '-'}</td>
            <td>${ram.createdAt && !isNaN(new Date(ram.createdAt)) ? new Date(ram.createdAt).toLocaleDateString('fr-FR') : 'Non renseignée'}</td>
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

// Modifier un RAM dans le formulaire (comme les factures)
// TODO: RAM
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
    const clientSelect = document.getElementById('ramClientSelect');
    const clientInput = document.getElementById('ramClientInput');
    const clientSiret = document.getElementById('ramClientSiret');
    const clientAddress = document.getElementById('ramClientAddress');
    const monthSelect = document.getElementById('ramMonthSelect');
    const yearInput = document.getElementById('ramYearInput');
    const invoiceInput = document.getElementById('ramInvoiceNumber');
    const remarksInput = document.getElementById('ramRemarksInput');
    const manualGroup = document.getElementById('ramManualClientGroup');
    
    // Chercher si le client existe dans la liste
    const clientIndex = clients.findIndex(c => c.name === ram.client);
    if (clientIndex !== -1 && clientSelect) {
        // Client trouvé - sélectionner dans le dropdown
        clientSelect.value = clientIndex.toString();
        if (manualGroup) manualGroup.style.display = 'none';
        if (clientInput) clientInput.value = ram.client;
        if (clientSiret) clientSiret.value = clients[clientIndex].siret || '';
        if (clientAddress) clientAddress.value = clients[clientIndex].address || '';
    } else {
        // Client non trouvé - saisie manuelle
        if (clientSelect) clientSelect.value = '';
        if (manualGroup) manualGroup.style.display = 'block';
        if (clientInput) clientInput.value = ram.client;
        if (clientSiret) clientSiret.value = ram.clientSiret || '';
        if (clientAddress) clientAddress.value = ram.clientAddress || '';
    }
    
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
// TODO: RAM
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
// TODO: RAM
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
// TODO: RAM
function resetRAMForm() {
    const clientSelect = document.getElementById('ramClientSelect');
    const clientInput = document.getElementById('ramClientInput');
    const clientSiret = document.getElementById('ramClientSiret');
    const clientAddress = document.getElementById('ramClientAddress');
    const monthSelect = document.getElementById('ramMonthSelect');
    const yearInput = document.getElementById('ramYearInput');
    const invoiceInput = document.getElementById('ramInvoiceNumber');
    const remarksInput = document.getElementById('ramRemarksInput');
    
    if (clientSelect) clientSelect.value = '';
    if (clientInput) clientInput.value = '';
    if (clientSiret) clientSiret.value = '';
    if (clientAddress) clientAddress.value = '';
    if (monthSelect) monthSelect.selectedIndex = new Date().getMonth();
    if (yearInput) yearInput.value = new Date().getFullYear();
    
    // Afficher le champ de saisie manuelle
    const manualGroup = document.getElementById('ramManualClientGroup');
    if (manualGroup) manualGroup.style.display = 'block';
    
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
// TODO: RAM
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
// TODO: RAM
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
// TODO: RAM
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
// TODO: RAM
async function saveRAMFromForm() {
    const clientSelect = document.getElementById('ramClientSelect');
    const clientInput = document.getElementById('ramClientInput');
    const clientSiret = document.getElementById('ramClientSiret');
    const clientAddress = document.getElementById('ramClientAddress');
    const monthSelect = document.getElementById('ramMonthSelect');
    const yearInput = document.getElementById('ramYearInput');
    const invoiceInput = document.getElementById('ramInvoiceNumber');
    const remarksInput = document.getElementById('ramRemarksInput');
    
    if (!monthSelect || !yearInput) return;
    
    // Récupérer le nom du client (depuis select ou input manuel)
    let client = '';
    let ramClientSiret = '';
    let ramClientAddress = '';
    
    if (clientSelect && clientSelect.value !== '') {
        // Client sélectionné dans le dropdown
        const index = parseInt(clientSelect.value);
        if (clients[index]) {
            client = clients[index].name;
            ramClientSiret = clients[index].siret || '';
            ramClientAddress = clients[index].address || '';
        }
    } else {
        // Saisie manuelle
        client = clientInput ? clientInput.value.trim() : '';
        ramClientSiret = clientSiret ? clientSiret.value.trim() : '';
        ramClientAddress = clientAddress ? clientAddress.value.trim() : '';
    }
    
    if (!client) {
        showToast('❌ Veuillez sélectionner ou saisir un nom de client', 'error');
        return;
    }
    
    const month = parseInt(monthSelect.value);
    const year = parseInt(yearInput.value);
    
    // Vérifier si un RAM existe déjà pour ce client et ce mois (sauf en mode édition)
    const existingRAMIndex = rams.findIndex(r => r.client === client && r.month === month && r.year === year);
    const isEditingThisRAM = (window.editingRAMIndex >= 0 && existingRAMIndex === window.editingRAMIndex);
    
    if (existingRAMIndex !== -1 && !isEditingThisRAM) {
        // Un autre RAM existe déjà
        const monthName = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][month];
        showToast(`⚠️ Un RAM existe déjà pour ${client} - ${monthName} ${year}`, 'error');
        return;
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
            // Mise à jour (préserver id et createdAt)
            const ram = rams[window.editingRAMIndex];
            ram.client = client;
            ram.clientSiret = ramClientSiret;
            ram.clientAddress = ramClientAddress;
            ram.month = month;
            ram.year = year;
            ram.monthName = monthName;
            ram.activities = activities;
            ram.remarks = remarks;
            ram.invoiceNumber = invoiceNumber;
            // Préserver createdAt et id, ajouter updatedAt
            if (!ram.createdAt) ram.createdAt = new Date().toISOString();
            ram.updatedAt = new Date().toISOString();
        } else {
            // Création
            const ram = {
                id: Date.now(),
                client,
                clientSiret: ramClientSiret,
                clientAddress: ramClientAddress,
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
        await storageManager.saveDual('mti_rams', rams);
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
// TODO: RAM
async function deleteRAM(index) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rapport d\'activité ?')) return;
    
    rams.splice(index, 1);
    await storageManager.saveDual('mti_rams', rams);
    await syncToDrive();
    renderRAMList();
    showToast('✅ RAM supprimé', 'success');
}

window.deleteRAM = deleteRAM;
window.sendInvoiceWithRAM = sendInvoiceWithRAM;

window.clearClientsInSheets = clearClientsInSheets;

// ==========================================
// RAM SYNC AVEC GOOGLE SHEETS
// ==========================================

// Exporter tous les RAMs vers Sheets
// TODO: RAM
async function exportRAMsToSheets() {
    if (getIsSyncing()) {
        alert('⏳ Une synchronisation est déjà en cours...');
        return;
    }
    
    if (rams.length === 0) {
        alert('ℹ️ Aucun RAM à exporter');
        return;
    }
    
    const confirm = window.confirm(`Exporter ${rams.length} RAM(s) vers Google Sheets ?\n\nCela écrasera le contenu existant de la feuille RAM.`);
    if (!confirm) return;

    setIsSyncing(true);
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
        setIsSyncing(false);
    }
}

// Importer les RAMs depuis Sheets
// TODO: RAM
async function importRAMsFromSheets() {
    if (getIsSyncing()) {
        alert('⏳ Une synchronisation est déjà en cours...');
        return;
    }
    
    const confirm = window.confirm('Importer les RAMs depuis Google Sheets ?\n\nCela écrasera les RAMs locaux non sauvegardés.');
    if (!confirm) return;

    setIsSyncing(true);
    setSuppressSheetsSyncInterval(true);
    try {
        const result = await callBackend('import_rams', { sheetId: CONFIG.SHEETS_ID });
        if (!result || result.success === false) {
            throw new Error(result?.data || 'Erreur serveur lors de l\'import');
        }

        setRams(result.data.rams || []);
        await storageManager.saveDual('mti_rams', rams);
        await saveToDrive({ skipSheetsSync: true });
        renderRAMList();
        
        alert(`✅ ${rams.length} RAM(s) importé(s) depuis Sheets`);
    } catch (error) {
        console.error('importRAMsFromSheets error:', error);
        alert(`❌ Erreur import RAMs : ${error.message || error}`);
    } finally {
        setIsSyncing(false);
        setSuppressSheetsSyncInterval(false);
    }
}

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

