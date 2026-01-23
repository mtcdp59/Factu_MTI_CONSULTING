import {
    getAutoSheetsSyncEnabled,
    getClients,
    getCompanyInfo,
    getInvoices,
    getQuotes,
    getRams,
    getRecurringInvoices,
    getSuppressSheetsSyncInterval,
    getTasks,
    getTaxSettings,
    setClients, setCompanyInfo,
    setInvoices,
    setQuotes,
    setRams,
    setRecurringInvoices,
    setTasks,
    setTaxSettings
} from "./config.js";
import {
    callBackend,
    callBackendJSONP
} from "./api.js";
import { queueSheetsSync } from "./sheets.js";
import { showBackendRawResponse } from "./debug.js";
import {
    renderInvoiceList,
    renderRecurringList
} from "./invoices.js";
import { renderQuoteList } from "./quotes.js";
import { updateCADisplay } from "./revenue.js";
import {
    populateClientSelects,
    renderClientsTable
} from "./client.js";

// ==========================================
// GOOGLE DRIVE STORAGE
// ==========================================

// Version debounced de saveToDrive (2 secondes)
export const debouncedSaveToDrive = debounce(saveToDrive, 2000);

// Sauvegarder toutes les données dans Google Drive
let saveToDriveInProgress = false;

let clients = getClients();
let invoices = getInvoices();
let quotes = getQuotes();
let rams = getRams();
let recurringInvoices = getRecurringInvoices();

// Debounce helper
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export async function saveToDrive(options = {}) {
    if (saveToDriveInProgress) {
        console.log('⏳ Sauvegarde Drive déjà en cours, ignorée');
        return true;
    }

    saveToDriveInProgress = true;

    try {
        const { skipSheetsSync = false } = options;
        const tasks = getTasks()
        const companyInfo = getCompanyInfo();
        const taxSettings = getTaxSettings();
        const data = { clients, invoices, quotes, tasks, rams, recurringInvoices, companyInfo, taxSettings };
        const result = await callBackend('saveToDrive', { data });
        if (!result || !result.success) throw new Error(result && result.error ? result.error : 'Unknown error');
        console.log('✅ Sauvegarde Drive OK');

        // Sauvegarde locale pour assurer la cohérence après suppression
        try {
            await storageManager.saveDual('mti_invoices', invoices || []);
            await storageManager.saveDual('mti_quotes', quotes || []);
            await storageManager.saveDual('mti_rams', rams || []);
        } catch (e) {
            console.warn('Backup IndexedDB après saveToDrive échoué:', e);
        }

        if (!skipSheetsSync && getAutoSheetsSyncEnabled() && !getSuppressSheetsSyncInterval()) {
            queueSheetsSync('saveToDrive');
        }
        return true;
    } catch (error) {
        console.error('❌ Erreur sauvegarde:', error);
        try { showBackendRawResponse(error && (error.stack || error.message || JSON.stringify(error))); } catch (e) {}
        return false;
    } finally {
        saveToDriveInProgress = false;
    }
}

// Alias pour compatibilité
export async function syncToDrive() {
    return await saveToDrive();
}

// Charger toutes les données depuis Google Drive (POST puis fallback JSONP si CORS)
export async function loadFromDrive() {
    const applyData = async (data) => {
        if (data.clients) setClients(data.clients);
        if (data.invoices) setInvoices(data.invoices);
        if (data.quotes) setQuotes(data.quotes);
        if (data.tasks) setTasks(data.tasks);
        if (data.rams) setRams(data.rams);
        if (data.recurringInvoices) setRecurringInvoices(data.recurringInvoices);
        if (data.companyInfo) setCompanyInfo(data.companyInfo);
        if (data.taxSettings) setTaxSettings(data.taxSettings);

        console.log('✅ Données chargées depuis Drive');

        // Sauvegarde backup IndexedDB
        try {
            if (quotes && quotes.length > 0) {
                await storageManager.saveDual('mti_quotes', quotes);
                console.log(`Backup: ${quotes.length} devis en IndexedDB`);
            }
            if (rams && rams.length > 0) {
                await storageManager.saveDual('mti_rams', rams);
                console.log(`Backup: ${rams.length} RAMs en IndexedDB`);
            }
        } catch (e) {
            console.warn('Erreur backup IndexedDB:', e);
        }

        // Rafraîchir vues si fonctions définies
        if (typeof renderClientsTable === 'function') renderClientsTable();
        if (typeof populateClientSelects === 'function') populateClientSelects();
        if (typeof renderInvoiceList === 'function') renderInvoiceList();
        if (typeof renderQuoteList === 'function') renderQuoteList();
        if (typeof renderRAMList === 'function') renderRAMList();
        if (typeof renderRecurringList === 'function') renderRecurringList();
        if (typeof updateCADisplay === 'function') updateCADisplay();
    };

    try {
        const result = await callBackend('loadFromDrive');
        if (!result.success) {
            console.log('Pas de données Drive, utilisation données par défaut');
            return false;
        }
        await applyData(result.data || {});
        return true;
    } catch (error) {
        console.warn('loadFromDrive POST failed, trying JSONP fallback', error);
        try {
            const result = await callBackendJSONP('loadFromDrive');
            if (result && result.success) {
                await applyData(result.data || {});
                console.log('✅ Données chargées via JSONP (fallback)');
                return true;
            }
        } catch (jsonpErr) {
            console.warn('loadFromDrive JSONP failed:', jsonpErr);
        }
        try { showBackendRawResponse(error && (error.stack || error.message || JSON.stringify(error))); } catch (e) {}
        return false;
    }
}

// Fetch Drive data without applying (for comparison)
export async function fetchDriveDataOnly() {
    try {
        const result = await callBackend('loadFromDrive');
        if (!result.success) {
            return null;
        }
        return result.data || null;
    } catch (error) {
        console.warn('fetchDriveDataOnly failed:', error);
        try {
            const result = await callBackendJSONP('loadFromDrive');
            if (result && result.success) {
                return result.data || null;
            }
        } catch (jsonpErr) {
            console.warn('fetchDriveDataOnly JSONP failed:', jsonpErr);
        }
        return null;
    }
}