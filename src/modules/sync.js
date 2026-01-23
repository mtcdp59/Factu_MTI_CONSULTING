import { showToast } from "./toast.js";
import {
    getAutoSheetsSyncEnabled,
    getInvoices,
    getIsSyncing,
    setAutoSheetsSyncEnabled,
    setIsSyncing,
    setSyncLog,
    SYNC_LOG_MAX_ENTRIES,
    SYNC_LOG_STORAGE_KEY
} from "./config.js";
import { updateSyncIndicator } from "./sheets.js";
import { callBackend } from "./api.js";
import { showBackendRawResponse } from "./debug.js";
import { updateLastSyncTime } from "./date-utils.js";

// Auto-sync disabled - user manually syncs
export function autoSync(action = 'modification') {
    // Auto-sync disabled in this version
    // User will manually click sync button when needed
    return;
}

// Add entry to sync log
export async function addSyncLogEntry(status, message, details = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        status: status, // 'pending', 'success', 'error', 'retry'
        message: message,
        details: details,
        itemsSynced: details.itemsSynced || 0,
        errorMessage: details.errorMessage || null
    };

    getSyncLog().unshift(entry); // Add at beginning (newest first)

    // Keep only last SYNC_LOG_MAX_ENTRIES
    if (getSyncLog().length > SYNC_LOG_MAX_ENTRIES) {
        setSyncLog(getSyncLog().slice(0, SYNC_LOG_MAX_ENTRIES));
    }

    // Save to IndexedDB + localStorage
    try {
        await storageManager.saveDual(SYNC_LOG_STORAGE_KEY, getSyncLog());
    } catch (e) {
        console.warn('Could not save sync log:', e);
    }

    console.log('[SyncLog]', status, ':', message, details);
}

// Get sync log (for display in UI)
export function getRecentSyncLog(limit = 20) {
    return getSyncLog().slice(0, limit);
}

// Clear sync log
export async function clearSyncLog() {
    setSyncLog([]);
    try {
        await storageManager.removeItem(SYNC_LOG_STORAGE_KEY);
    } catch (e) {
        console.warn('Could not clear sync log:', e);
    }
}

// Toggle auto-sync on/off
export function toggleAutoSync() {
    setAutoSheetsSyncEnabled(!getAutoSheetsSyncEnabled());
    localStorage.setItem('mti_autoSyncEnabled', String(getAutoSheetsSyncEnabled()));
    updateSyncIndicator(false);
    const msg = getAutoSheetsSyncEnabled() ? '✅ Auto-sync activé' : '⏸️ Auto-sync désactivé';
    showToast(msg, 'info');
    console.log('Auto-sync toggled:', getAutoSheetsSyncEnabled());
}

// Display sync log in UI preview
export function updateSyncLogDisplay() {
    const preview = document.getElementById('syncLogPreview');
    if (!preview) return;

    const entries = getRecentSyncLog(10);
    if (entries.length === 0) {
        preview.innerHTML = '<div style="color: var(--color-text-secondary); text-align: center;">Aucune entrée</div>';
        return;
    }

    let html = '';
    entries.forEach(entry => {
        const time = new Date(entry.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const statusEmoji = entry.status === 'success' ? '✅' :
            entry.status === 'error' ? '❌' :
                entry.status === 'retry' ? '🔄' : '⏳';
        html += `<div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(0,0,0,0.1);">
            <div style="color: var(--color-primary); font-weight: bold;">${time} ${statusEmoji} ${entry.status}</div>
            <div style="color: var(--color-text); font-size: 11px; margin-top: 2px;">${entry.message}</div>
            ${entry.itemsSynced > 0 ? `<div style="color: var(--color-success); font-size: 11px;">↳ ${entry.itemsSynced} items</div>` : ''}
        </div>`;
    });

    preview.innerHTML = html;
}

// Show sync log modal
export function showSyncLogModal() {
    const entries = getRecentSyncLog(50);
    let html = '<h3 style="margin: 0 0 var(--space-16) 0; font-size: var(--font-size-lg);">Historique Sync (50 derniers)</h3>';

    if (entries.length === 0) {
        html += '<p style="color: var(--color-text-secondary); text-align: center;">Aucune entrée</p>';
    } else {
        html += '<table style="width: 100%; border-collapse: collapse; font-size: var(--font-size-sm);">';
        html += '<thead><tr style="background: var(--color-bg-1); border-bottom: 2px solid var(--color-border);">';
        html += '<th style="padding: 8px; text-align: left;">Heure</th>';
        html += '<th style="padding: 8px; text-align: left;">Statut</th>';
        html += '<th style="padding: 8px; text-align: left;">Message</th>';
        html += '<th style="padding: 8px; text-align: right;">Items</th>';
        html += '</tr></thead><tbody>';

        entries.forEach(entry => {
            const time = new Date(entry.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const statusEmoji = entry.status === 'success' ? '✅' :
                entry.status === 'error' ? '❌' :
                    entry.status === 'retry' ? '🔄' : '⏳';
            const statusColor = entry.status === 'success' ? 'var(--color-success)' :
                entry.status === 'error' ? 'var(--color-error)' : 'var(--color-info)';

            html += `<tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: 8px;">${time}</td>
                <td style="padding: 8px; color: ${statusColor}; font-weight: bold;">${statusEmoji} ${entry.status}</td>
                <td style="padding: 8px;">${entry.message}</td>
                <td style="padding: 8px; text-align: right;">${entry.itemsSynced || '-'}</td>
            </tr>`;
        });

        html += '</tbody></table>';
    }

    // Create simple modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
        z-index: 9999;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white; border-radius: 8px; padding: 24px; max-width: 800px;
        max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    `;
    content.innerHTML = html + `<div style="margin-top: 24px; text-align: right;">
        <button class="btn btn-secondary" onclick="document.body.removeChild(document.body.lastChild)" style="margin-right: 8px;">Close</button>
        <button class="btn btn-secondary" onclick="(function(){ clearSyncLog(); showToast('Log cleared', 'info'); location.reload(); })()">Clear &amp; Reload</button>
    </div>`;

    content.innerHTML = html + `<div style="margin-top: 24px; text-align: right;">
        <button class="btn btn-secondary" onclick="document.body.removeChild(document.body.lastChild)" style="margin-right: 8px;">Fermer</button>
        <button class="btn btn-secondary" onclick="(function(){ clearSyncLog(); showToast('Journal effacé', 'info'); location.reload(); })()">Effacer &amp; Recharger</button>
    </div>`;

    modal.appendChild(content);
    modal.onclick = (e) => { if(e.target === modal) document.body.removeChild(modal); };
    document.body.appendChild(modal);
}


// Load auto-sync preference from localStorage
export function loadAutoSyncPreference() {
    const saved = localStorage.getItem('mti_autoSyncEnabled');
    if (saved !== null) {
        setAutoSheetsSyncEnabled(saved === 'true');
        console.log('Auto-sync preference loaded:', getAutoSheetsSyncEnabled());
    }
    // Initialize indicator on load
    updateSyncIndicator(false);
}

// Google Sheets Sync Functions
export async function syncToGoogleSheets() {
    if (getIsSyncing()) {
        showToast('⏳ Synchronisation déjà en cours...', 'info');
        return;
    }

    const button = document.getElementById('syncButton');
    if (!button) return;
    const originalContent = button.innerHTML;

    try {
        setIsSyncing(true);
        button.disabled = true;
        button.innerHTML = '⏳ Synchronisation...';
        button.style.opacity = '0.6';

        showToast('⏳ Synchronisation en cours...', 'info');

        // Prepare invoice data for sync
        const invoiceData = getInvoices().map(inv => {
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
            setIsSyncing(false);
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
        setIsSyncing(false);
        button.disabled = false;
        button.style.opacity = '1';
    }
}