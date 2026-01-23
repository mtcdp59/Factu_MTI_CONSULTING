import {
    CONFIG,
    getAutoSheetsSyncEnabled,
    getClients,
    getInvoices,
    getPendingSheetsSyncInterval,
    getQuotes,
    getRams,
    getSheetsSyncInterval,
    getSheetsSyncTimer,
    getSuppressSheetsSyncInterval,
    setPendingSheetsSyncInterval,
    setSheetsSyncInterval,
    setSheetsSyncTimer,
    SHEETS_SYNC_DEBOUNCE,
    syncStats
} from "./config.js";
import { addSyncLogEntry } from "./sync.js";
import { callBackend } from "./api.js";
import { showToast } from "./toast.js";

let clients = getClients();
let invoices = getInvoices();
let quotes = getQuotes();
let rams = getRams();

// Debounced synchronisation automatique vers Sheets (factures, devis, RAM, tiers)
export function queueSheetsSync(reason = '') {
    if (!getAutoSheetsSyncEnabled() || getSuppressSheetsSyncInterval()) return;
    clearTimeout(getSheetsSyncTimer());
    setSheetsSyncTimer(setTimeout(() => syncSheetsNow(reason), SHEETS_SYNC_DEBOUNCE));
}

export async function syncSheetsNow(reason = 'auto') {
    if (getSheetsSyncInterval()) {
        setPendingSheetsSyncInterval(true);
        await addSyncLogEntry('pending', 'Sync déjà en cours, mise en file d\'attente');
        return;
    }

    setSheetsSyncInterval(true);
    setPendingSheetsSyncInterval(false);
    updateSyncIndicator(true);
    await addSyncLogEntry('pending', `Début sync Sheets (${reason})`);

    try {
        const itemCount = invoices.length + quotes.length + rams.length + clients.length;
        await callBackend('exportInvoicesToSheets', { sheetId: CONFIG.SHEETS_ID, invoices });
        await callBackend('sync_quotes', { sheetId: CONFIG.SHEETS_ID, quotes });
        await callBackend('sync_rams', { sheetId: CONFIG.SHEETS_ID, rams });
        await callBackend('exportClients', { sheetId: CONFIG.SHEETS_ID, clients });

        // Update stats
        syncStats.lastSyncTime = new Date();
        syncStats.itemsSynced = itemCount;
        syncStats.errorCount = 0;
        syncStats.lastError = null;

        console.log('✅ Sync Sheets auto OK', reason ? `(${reason})` : '');
        updateSyncIndicator(false);
        await addSyncLogEntry('success', `Sync Sheets réussie (${itemCount} items)`, {
            itemsSynced: itemCount,
            reason: reason
        });

        // Toast with stats
        const timeStr = syncStats.lastSyncTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        showToast(`✅ Sync Sheets OK (${itemCount} items) à ${timeStr}`, 'success');
    } catch (err) {
        console.error('syncSheetsNow error:', err);
        syncStats.errorCount++;
        syncStats.lastError = err.message || String(err);
        updateSyncIndicator(false, true);
        await addSyncLogEntry('error', `Erreur sync Sheets: ${err.message || err}`, {
            errorMessage: err.message || String(err)
        });
        showToast('❌ Sync Sheets auto : ' + (err.message || err) + ' [Nouvelle tentative en 2s]', 'error');
    } finally {
        setSheetsSyncInterval(false);
        if (getPendingSheetsSyncInterval()) {
            setPendingSheetsSyncInterval(false);
            await addSyncLogEntry('retry', 'Relance sync après attente');
            queueSheetsSync('replay');
        }
    }
}

// Update sync indicator (visual UI feedback)
export function updateSyncIndicator(syncing = false, hasError = false) {
    const indicator = document.getElementById('syncIndicator');
    const toggleBtn = document.getElementById('toggleAutoSyncBtn');
    const autoSyncIcon = document.getElementById('autoSyncIcon');

    if (!indicator) return;

    // Update indicator visual state
    indicator.classList.toggle('syncing', syncing);
    indicator.classList.toggle('error', hasError);
    indicator.classList.toggle('ok', !syncing && !hasError);

    if (syncing) {
        indicator.innerHTML = '🔄 Sync...';
        indicator.title = 'Synchronisation en cours';
    } else if (hasError) {
        indicator.innerHTML = '⚠️ Sync error';
        indicator.title = 'Erreur de synchronisation - nouvelle tentative en attente';
    } else {
        const lastSync = syncStats.lastSyncTime ? syncStats.lastSyncTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'jamais';
        indicator.innerHTML = `✅ Sync (${lastSync})`;
        const itemsInfo = syncStats.itemsSynced > 0 ? `${syncStats.itemsSynced} items` : 'aucun item';
        indicator.title = `Dernière sync: ${lastSync}\n${itemsInfo}\nAuto-sync: ${getAutoSheetsSyncEnabled() ? 'Activé' : 'Désactivé'}`;
    }

    // Update toggle button state with better info
    if (toggleBtn) {
        toggleBtn.classList.toggle('disabled', !getAutoSheetsSyncEnabled());
        if (autoSyncIcon) {
            autoSyncIcon.textContent = getAutoSheetsSyncEnabled() ? '▶️ Auto-Sync' : '⏸️ Auto-Sync';
        }
        const queuedItems = invoices.length + quotes.length + rams.length + clients.length;
        toggleBtn.title = getAutoSheetsSyncEnabled() ?
            `Auto-sync ENABLED - ${queuedItems} items to sync (debounce 2s)` :
            `Auto-sync DISABLED - Manual sync only`;
    }
}