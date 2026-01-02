// MTI CONSULTING - Application de facturation
// Version 2.1.3 - Google Drive Storage + Gmail API + Calendar API + FullCalendar + RAMs

console.log('✅ app.js chargé - début du script');

// ==========================================
// STORAGE MANAGER - IndexedDB prioritaire + secours localStorage
// ==========================================

const STORAGE_DATA_KEYS = [
    'mti_invoices',
    'mti_quotes',
    'mti_rams',
    'mti_clients',
    'mti_syncLog',
    'mti_autoSyncEnabled',
    'mti_app_config'
];

const STORAGE_META_KEYS_TO_KEEP = ['mti_indexeddb_migrated', 'mti_app_config'];

const storageManager = {
    mode: 'indexeddb',
    backupEnabled: true, // Backup localStorage activé par sécurité

    // Initialiser localforage et choisir le mode
    init() {
        this.mode = 'indexeddb';
        this.backupEnabled = true; // Backup localStorage activé par sécurité

        if (typeof localforage === 'undefined') {
            this.switchToLocalStorage('localforage absent');
            return;
        }

        try {
            localforage.config({
                name: 'MTI_CONSULTING',
                storeName: 'mti_data',
                description: 'Stockage principal MTI Consulting (IndexedDB)'
            });

            localforage.ready()
                .then(() => {
                    console.log('✅ IndexedDB prêt via localforage');
                })
                .catch((err) => {
                    this.switchToLocalStorage(`IndexedDB indisponible: ${err}`);
                });
        } catch (err) {
            this.switchToLocalStorage(`Erreur init IndexedDB: ${err}`);
        }
    },

    switchToLocalStorage(reason = 'fallback') {
        if (this.mode === 'localStorage') return;
        this.mode = 'localStorage';
        console.warn(`⚠️ Bascule en mode localStorage (${reason})`);
    },

    isIndexedDB() {
        return this.mode === 'indexeddb';
    },

    setBackupEnabled(enabled = false) {
        this.backupEnabled = !!enabled;
        return this.backupEnabled;
    },

    // Lire une clé (async)
    async getItem(key) {
        try {
            if (this.isIndexedDB() && typeof localforage !== 'undefined') {
                return await localforage.getItem(key);
            }
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            if (this.isIndexedDB()) this.switchToLocalStorage(e.toString());
            console.error(`Error reading ${key}:`, e);
            return null;
        }
    },

    // Écrire une clé (async)
    async setItem(key, value) {
        try {
            if (this.isIndexedDB() && typeof localforage !== 'undefined') {
                await localforage.setItem(key, value);
                return;
            }
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            if (this.isIndexedDB()) this.switchToLocalStorage(e.toString());
            console.error(`Error saving ${key}:`, e);
        }
    },

    // Supprimer une clé (async)
    async removeItem(key) {
        try {
            if (this.isIndexedDB() && typeof localforage !== 'undefined') {
                await localforage.removeItem(key);
                return;
            }
            localStorage.removeItem(key);
        } catch (e) {
            if (this.isIndexedDB()) this.switchToLocalStorage(e.toString());
            console.error(`Error removing ${key}:`, e);
        }
    },

    // Tout effacer (async)
    async clear() {
        try {
            if (this.isIndexedDB() && typeof localforage !== 'undefined') {
                await localforage.clear();
            }
            localStorage.clear();
        } catch (e) {
            console.error('Error clearing storage:', e);
        }
    },

    // Lister toutes les clés (async)
    async keys() {
        try {
            if (this.isIndexedDB() && typeof localforage !== 'undefined') {
                return await localforage.keys();
            }
            return Object.keys(localStorage);
        } catch (e) {
            if (this.isIndexedDB()) this.switchToLocalStorage(e.toString());
            console.error('Error getting keys:', e);
            return [];
        }
    },

    // Migrer de localStorage vers IndexedDB
    async migrateFromLocalStorage() {
        if (!this.isIndexedDB() || typeof localforage === 'undefined') return;

        const migrationDone = localStorage.getItem('mti_indexeddb_migrated');
        if (migrationDone === 'true') {
            console.log('✅ Migration already completed');
            return;
        }

        let migrated = 0;
        for (const key of STORAGE_DATA_KEYS) {
            const lsData = localStorage.getItem(key);
            if (!lsData) continue;

            try {
                const parsed = JSON.parse(lsData);
                await localforage.setItem(key, parsed);
                migrated++;
                console.log(`📦 Migrated: ${key}`);
            } catch (e) {
                console.warn(`⚠️ Migration failed for ${key}:`, e);
            }
        }

        localStorage.setItem('mti_indexeddb_migrated', 'true');
        if (migrated > 0) {
            console.log(`✅ Migrated ${migrated} items from localStorage to IndexedDB`);
        } else {
            console.log('ℹ️ No data to migrate');
        }
    },

    readFromLocalStorage(key, { log = false } = {}) {
        const lsData = localStorage.getItem(key);
        if (!lsData) return null;
        try {
            const parsed = JSON.parse(lsData);
            if (log) console.log(`📦 Loaded ${key} from localStorage fallback`);
            return parsed;
        } catch (e) {
            console.error(`Error parsing localStorage ${key}:`, e);
            return null;
        }
    },

    // Helper : sauvegarde (IndexedDB prioritaire) + backup optionnel
    async saveDual(key, value, { backup = false } = {}) {
        await this.setItem(key, value);

        const shouldBackup = backup || (this.backupEnabled && this.isIndexedDB());
        if (shouldBackup) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.warn(`localStorage backup failed for ${key}:`, e);
            }
        }
    },

    // Helper : lecture avec repli (IndexedDB → localStorage)
    async loadDual(key) {
        if (!this.isIndexedDB()) {
            return this.readFromLocalStorage(key);
        }

        const data = await this.getItem(key);
        if (data !== null && data !== undefined) return data;

        return this.readFromLocalStorage(key, { log: true });
    },

    // ========== v2.5.2 OPTIMISATIONS ========== 
    
    // Vérifier si la compression est disponible (LZ-string)
    hasCompression() {
        return typeof LZString !== 'undefined';
    },

    // Sauvegarder avec compression optionnelle (v2.5.2)
    async saveWithCompression(key, value, compress = true) {
        let toStore = value;
        
        if (compress && this.hasCompression() && typeof value === 'object' && Object.keys(value).length > 100) {
            try {
                const jsonStr = JSON.stringify(value);
                const compressed = LZString.compressToBase64(jsonStr);
                
                toStore = {
                    __compressed: true,
                    __timestamp: Date.now(),
                    data: compressed
                };
                console.log(`📦 Compressed ${key}: ${jsonStr.length} → ${compressed.length} bytes`);
            } catch (e) {
                console.warn(`Compression failed for ${key}, storing uncompressed:`, e);
                toStore = value;
            }
        }
        
        await this.saveDual(key, toStore);
    },

    // Charger avec décompression automatique (v2.5.2)
    async loadWithDecompression(key) {
        let data = await this.loadDual(key);
        
        if (data && data.__compressed && this.hasCompression()) {
            try {
                const decompressed = LZString.decompressFromBase64(data.data);
                data = JSON.parse(decompressed);
                console.log(`📦 Decompressed ${key}`);
            } catch (e) {
                console.warn(`Decompression failed for ${key}:`, e);
            }
        }
        
        return data;
    },

    // Sauvegarde groupée de plusieurs clés (v2.5.2)
    async batchSave(items) {
        const results = [];
        for (const [key, value] of Object.entries(items)) {
            try {
                await this.saveDual(key, value);
                results.push({ key, success: true });
            } catch (e) {
                console.error(`Batch save failed for ${key}:`, e);
                results.push({ key, success: false, error: e.message });
            }
        }
        return results;
    },

    // Chargement groupé de plusieurs clés (v2.5.2)
    async batchLoad(keys) {
        const results = {};
        for (const key of keys) {
            try {
                results[key] = await this.loadDual(key);
            } catch (e) {
                console.error(`Batch load failed for ${key}:`, e);
                results[key] = null;
            }
        }
        return results;
    },

    // Obtenir une estimation de l'espace de stockage (v2.5.2)
    async getStorageStats() {
        if (!navigator.storage || !navigator.storage.estimate) {
            return { available: 'unknown', used: 'unknown', percentage: 'unknown' };
        }

        try {
            const estimate = await navigator.storage.estimate();
            const used = estimate.usage || 0;
            const quota = estimate.quota || 0;
            const percentage = quota > 0 ? Math.round((used / quota) * 100) : 0;
            
            return {
                used: `${(used / 1024 / 1024).toFixed(2)} MB`,
                available: `${(quota / 1024 / 1024).toFixed(2)} MB`,
                percentage: `${percentage}%`
            };
        } catch (e) {
            console.warn('Impossible de récupérer les statistiques de stockage :', e);
            return { available: 'unknown', used: 'unknown', percentage: 'unknown' };
        }
    },

    // Nettoyer la sauvegarde localStorage (v2.5.2)
    async cleanupLocalStorage(keysToKeep = []) {
        if (!this.isIndexedDB()) {
            return { cleaned: 0, message: 'Cleanup skipped (localStorage primaire)' };
        }

        const keysToPreserve = [...new Set([...keysToKeep, ...STORAGE_META_KEYS_TO_KEEP])];
        
        let cleaned = 0;
        const allKeys = Object.keys(localStorage);
        
        for (const key of allKeys) {
            if (key.startsWith('mti_') && !keysToPreserve.includes(key)) {
                try {
                    const idbData = await this.getItem(key);
                    if (idbData) {
                        localStorage.removeItem(key);
                        cleaned++;
                        console.log(`🧹 Cleaned localStorage: ${key}`);
                    }
                } catch (e) {
                    console.warn(`Cleanup skipped for ${key} (not in IndexedDB):`, e);
                }
            }
        }
        
        return { cleaned, message: `Cleaned ${cleaned} localStorage keys` };
    },

    // ========== v2.5.3 PREP: Indexation utilitaire ==========
    async ensureIndexes({ invoices = [], quotes = [], clients = [] } = {}) {
        try {
            const invoiceByNumber = {};
            invoices.forEach((inv, idx) => {
                if (inv && inv.number) invoiceByNumber[inv.number] = idx;
            });

            const quoteByNumber = {};
            quotes.forEach((q, idx) => {
                if (q && q.number) quoteByNumber[q.number] = idx;
            });

            const clientByName = {};
            clients.forEach((c, idx) => {
                if (c && c.name) clientByName[c.name] = idx;
            });

            await this.setItem('mti_idx_invoices_number', invoiceByNumber);
            await this.setItem('mti_idx_quotes_number', quoteByNumber);
            await this.setItem('mti_idx_clients_name', clientByName);

            console.log('✅ Indexes mis à jour (numéro facture/devis, nom client)');
            return true;
        } catch (e) {
            console.warn('Indexation non réalisée:', e);
            return false;
        }
    },

    async findInvoiceByNumber(number) {
        if (!number) return null;
        const indexMap = await this.getItem('mti_idx_invoices_number') || {};
        const pos = indexMap[number];
        if (typeof pos !== 'number') return null;
        const list = await this.getItem('mti_invoices') || [];
        return list[pos] || null;
    },

    async findQuoteByNumber(number) {
        if (!number) return null;
        const indexMap = await this.getItem('mti_idx_quotes_number') || {};
        const pos = indexMap[number];
        if (typeof pos !== 'number') return null;
        const list = await this.getItem('mti_quotes') || [];
        return list[pos] || null;
    },

    async findClientByName(name) {
        if (!name) return null;
        const indexMap = await this.getItem('mti_idx_clients_name') || {};
        const pos = indexMap[name];
        if (typeof pos !== 'number') return null;
        const list = await this.getItem('mti_clients') || [];
        return list[pos] || null;
    },

    // Export/Import manuel pour backup JSON
    async exportSnapshot(keys = STORAGE_DATA_KEYS, { compress = true } = {}) {
        const logs = [];
        const addLog = (msg) => {
            logs.push(msg);
            console.log(msg);
        };

        try {
            addLog('▶️ exportSnapshot start');
            addLog(`Keys to export: ${keys.join(', ')}`);
            const data = {};
            for (const key of keys) {
                addLog(`Loading ${key}...`);
                const value = await this.loadDual(key);
                // Filtrer les valeurs null/undefined pour réduire la taille
                if (value !== null && value !== undefined) {
                    data[key] = value;
                    addLog(`✓ ${key} loaded`);
                } else {
                    addLog(`⚠ ${key} is null/undefined`);
                }
            }

            const payload = {
                meta: {
                    createdAt: Date.now(),
                    mode: this.mode,
                    keys: Object.keys(data)
                },
                data
            };

            // Stringify avec gestion des références circulaires (simple replacer)
            const safeStringify = (obj) => {
                const seen = new WeakSet();
                return JSON.stringify(obj, (key, value) => {
                    if (typeof value === 'object' && value !== null) {
                        if (seen.has(value)) {
                            return '[Circular]';
                        }
                        seen.add(value);
                    }
                    return value;
                });
            };

            let serialized;
            try {
                addLog('▶️ exportSnapshot stringify...');
                serialized = safeStringify(payload);
            } catch (stringifyError) {
                console.error('Erreur stringify:', stringifyError);
                throw stringifyError;
            }

            let compressed = false;
            const sizeKB = (serialized.length / 1024).toFixed(2);
            addLog(`📦 Snapshot size: ${sizeKB} KB`);

            // Compresser seulement si < 5MB pour éviter stack overflow
            if (compress && this.hasCompression() && serialized.length < 5 * 1024 * 1024) {
                try {
                    addLog('▶️ exportSnapshot compress...');
                    const compressedData = LZString.compressToBase64(serialized);
                    const compressedSizeKB = (compressedData.length / 1024).toFixed(2);
                    addLog(`📦 Compressed: ${compressedSizeKB} KB (${((compressedData.length / serialized.length) * 100).toFixed(1)}%)`);
                    serialized = compressedData;
                    compressed = true;
                } catch (compressError) {
                    console.warn('⚠️ Compression échouée, export non compressé:', compressError);
                }
            } else if (serialized.length >= 5 * 1024 * 1024) {
                addLog('⚠️ Données trop volumineuses (>5MB), compression désactivée');
            }

            return { serialized, compressed, meta: payload.meta, logs };
        } catch (error) {
            addLog(`❌ Erreur exportSnapshot: ${error.message}`);
            addLog(`Stack: ${error.stack?.substring(0, 500)}`);
            console.error('❌ Erreur exportSnapshot:', error);
            const err = new Error('Export échoué: ' + error.message);
            err.logs = logs;
            throw err;
        }
    },

    async importSnapshot(snapshot, { compressed } = {}) {
        if (!snapshot) throw new Error('Snapshot vide');

        let serialized = snapshot.serialized || snapshot;
        const isCompressed = typeof compressed === 'boolean' ? compressed : !!snapshot.compressed;

        if (isCompressed) {
            if (!this.hasCompression()) throw new Error('Compression indisponible pour importer');
            serialized = LZString.decompressFromBase64(serialized);
        }

        const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
        if (!parsed || !parsed.data) throw new Error('Format snapshot invalide');

        const entries = Object.entries(parsed.data);
        for (const [key, value] of entries) {
            await this.setItem(key, value);
            if (this.backupEnabled && this.isIndexedDB()) {
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                } catch (e) {
                    console.warn(`Backup localStorage ignoré pour ${key}:`, e);
                }
            }
        }

        await this.ensureIndexes({
            invoices: parsed.data.mti_invoices || [],
            quotes: parsed.data.mti_quotes || [],
            clients: parsed.data.mti_clients || []
        });

        return { restored: entries.map(([key]) => key) };
    }
};

// Initialiser le stockage au chargement
storageManager.init();

// Planifier un cleanup localStorage périodique (72h) si IndexedDB est OK
const LOCALSTORAGE_CLEANUP_INTERVAL_MS = 72 * 60 * 60 * 1000;
let cleanupTimer = null;

function scheduleLocalStorageCleanup() {
    if (cleanupTimer || !storageManager.isIndexedDB()) return; // éviter doublons ou mode fallback
    cleanupTimer = setInterval(() => {
        if (storageManager.isIndexedDB()) {
            storageManager.cleanupLocalStorage().catch(() => {});
        }
    }, LOCALSTORAGE_CLEANUP_INTERVAL_MS);

    // premier passage après le chargement (dans 5s pour ne pas bloquer l'init)
    setTimeout(() => {
        if (storageManager.isIndexedDB()) {
            storageManager.cleanupLocalStorage().catch(() => {});
        }
    }, 5000);
}

scheduleLocalStorageCleanup();

// ==========================================
// STORAGE HELPERS - wrappers de compatibilité
// ==========================================

// ========== v2.5.2 FONCTIONS HELPER ========== 

// Sauvegarder en batch factures, devis, RAM et clients en une seule opération
async function batchSaveAllData() {
    const items = {
        'mti_invoices': invoices,
        'mti_quotes': quotes,
        'mti_rams': rams,
        'mti_clients': clients
    };
    
    const results = await storageManager.batchSave(items);
    // Mettre à jour les index pour accélérer les recherches
    await storageManager.ensureIndexes({ invoices, quotes, clients });
    const succeeded = results.filter(r => r.success).length;
    console.log(`✅ Batch saved ${succeeded}/${results.length} items`);
    return results;
}

// Charger en batch toutes les données avec décompression
async function batchLoadAllData() {
    const keys = ['mti_invoices', 'mti_quotes', 'mti_rams', 'mti_clients'];
    const data = await storageManager.batchLoad(keys);
    
    if (data['mti_invoices']) invoices = data['mti_invoices'];
    if (data['mti_quotes']) quotes = data['mti_quotes'];
    if (data['mti_rams']) rams = data['mti_rams'];
    if (data['mti_clients']) clients = data['mti_clients'];
    
    console.log(`📦 Batch loaded all data`);
    return data;
}

// Obtenir l'état du stockage (barre de statut UI)
async function getStorageStatus() {
    const stats = await storageManager.getStorageStats();
    const mode = storageManager.isIndexedDB() ? 'IndexedDB' : 'localStorage';
    return `Storage (${mode}): ${stats.used} / ${stats.available} (${stats.percentage})`;
}

// Export/import manuel (backup JSON local)
async function exportLocalBackup(compress = true) {
    return storageManager.exportSnapshot(STORAGE_DATA_KEYS, { compress });
}

async function importLocalBackup(serialized, options = {}) {
    return storageManager.importSnapshot(serialized, options);
}

// Exposer les helpers en console pour un diagnostic rapide (v2.5.2)
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

// Sauvegarder les factures (stockage principal, backup optionnel)
async function saveInvoicesToStorage(invoicesData) {
    await storageManager.saveDual('mti_invoices', invoicesData);
}

// Charger les factures (avec repli)
async function loadInvoicesFromStorage() {
    return await storageManager.loadDual('mti_invoices');
}

// Sauvegarder les devis (stockage principal, backup optionnel)
async function saveQuotesToStorage(quotesData) {
    await storageManager.saveDual('mti_quotes', quotesData);
}

// Charger les devis
async function loadQuotesFromStorage() {
    return await storageManager.loadDual('mti_quotes');
}

// Sauvegarder les RAMs (stockage principal, backup optionnel)
async function saveRAMsToStorage(ramsData) {
    await storageManager.saveDual('mti_rams', ramsData);
}

// Charger les RAMs
async function loadRAMsFromStorage() {
    return await storageManager.loadDual('mti_rams');
}

// Sauvegarder les clients (stockage principal, backup optionnel)
async function saveClientsToStorage(clientsData) {
    await storageManager.saveDual('mti_clients', clientsData);
}

// Charger les clients
async function loadClientsFromStorage() {
    return await storageManager.loadDual('mti_clients');
}

// Export pour debug console
window.storageManager = storageManager;
window.saveInvoicesToStorage = saveInvoicesToStorage;
window.loadInvoicesFromStorage = loadInvoicesFromStorage;
window.batchSaveAllData = batchSaveAllData;
window.batchLoadAllData = batchLoadAllData;
window.getStorageStatus = getStorageStatus;
window.findInvoiceByNumber = (num) => storageManager.findInvoiceByNumber(num);
window.findQuoteByNumber = (num) => storageManager.findQuoteByNumber(num);
window.findClientByName = (name) => storageManager.findClientByName(name);

// Configuration : priorité à window.CONFIG (config.js), sinon valeurs par défaut
const CONFIG = window.CONFIG || {
    BACKEND_URL: 'https://script.google.com/macros/s/AKfycbwE4GfTi5MQaYdvcwgFg3UUW6l-VEyzbPFYXjhkFGW1ZowsAlrLANMnhp8K-zIQ622D/exec',
    DRIVE_FILE_NAME: 'mti_data.json',
    SHEETS_ID: '17YPRArzfDaxQ5m1LKQLSzKOqeuCxfgLisKeQMthESi4',
    CALENDAR_ID: 'contact@mticonsulting.fr',
    GOOGLE_CLIENT_ID: '419421611576-v36rss6abjs0ahrv3vt9u6tcl4hhtos9.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: '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',
    GOOGLE_API_KEY: '',
    GOOGLE_SCOPES: 'https://www.googleapis.com/auth/calendar.events',
    DRIVE_FOLDER: 'MTI_CONSULTING_DATA'
};

// Charger la configuration depuis IndexedDB/localStorage (pour GitHub Pages) ou window.CONFIG (pour fichier local)
async function loadConfigFromStorage() {
    try {
        const storedConfig = await storageManager.getItem('mti_app_config');
        if (storedConfig) {
            return storedConfig;
        }
    } catch (e) {
        console.warn('Configuration invalide dans IndexedDB/localStorage');
    }
    return null;
}

// Sauvegarder la configuration dans IndexedDB + localStorage backup
async function saveConfigToStorage(config) {
    try {
        await storageManager.saveDual('mti_app_config', config);
        console.log('✅ Configuration sauvegardée (IndexedDB prioritaire, backup localStorage si activé)');
    } catch (e) {
        console.error('Impossible de sauvegarder la configuration:', e);
    }
}

// Configuration chargée (credentials en dur dans CONFIG ci-dessus)
console.log('✅ Configuration chargée depuis app.js (v42 style)');

// Sync version - reads from CONFIG (already loaded at startup)
function getConfiguredCalendarId() {
    // Check if stored value is in CONFIG first (from initial load)
    return CONFIG.CALENDAR_ID;
}

// Async version for saving
async function setConfiguredCalendarId(calendarId) {
    await storageManager.saveDual('mti_calendar_id', calendarId);
    CONFIG.CALENDAR_ID = calendarId;
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
        // Prepare the body with action and payload
        const body = JSON.stringify(Object.assign({ action }, payload));
        
        console.debug('Calling backend:', CONFIG.BACKEND_URL, 'action:', action);

        // POST without explicit Content-Type header to avoid CORS preflight
        // This keeps the Content-Type as text/plain;charset=UTF-8 which is a "simple" request
        // Simple requests don't trigger CORS preflight OPTIONS
        const resp = await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            body: body,
            // Don't set Content-Type header explicitly - let browser use text/plain
            // This prevents CORS preflight which Google Apps Script doesn't handle well
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
        const safeInvNum = String(invoice.number || Date.now()).replace(/^(FACTURE|INVOICE)[-_ ]?/i, '');
        const saveResp = await callBackend('savePdfToDrive', { pdfBase64: pdfBase64, pdfFilename: 'Facture_' + safeInvNum + '.pdf', folderName: 'Factures' });
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
            const dlInvNum = String(invoice.number || Date.now()).replace(/^(FACTURE|INVOICE)[-_ ]?/i, '');
            a.download = `Facture_${dlInvNum}.pdf`;
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

// Export FEC (Fichier des Écritures Comptables)
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
        const siret = companyInfo.siret || '000000000';
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
async function saveToDrive(options = {}) {
    const { skipSheetsSync = false } = options;
    try {
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

        if (!skipSheetsSync && autoSheetsSyncEnabled && !suppressSheetsSync) {
            queueSheetsSync('saveToDrive');
        }
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

// Debounced synchronisation automatique vers Sheets (factures, devis, RAM, tiers)
function queueSheetsSync(reason = '') {
    if (!autoSheetsSyncEnabled || suppressSheetsSync) return;
    clearTimeout(sheetsSyncTimer);
    sheetsSyncTimer = setTimeout(() => syncSheetsNow(reason), SHEETS_SYNC_DEBOUNCE);
}

async function syncSheetsNow(reason = 'auto') {
    if (sheetsSyncInProgress) {
        pendingSheetsSync = true;
        await addSyncLogEntry('pending', 'Sync déjà en cours, mise en file d\'attente');
        return;
    }

    sheetsSyncInProgress = true;
    pendingSheetsSync = false;
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
        sheetsSyncInProgress = false;
        if (pendingSheetsSync) {
            pendingSheetsSync = false;
            await addSyncLogEntry('retry', 'Relance sync après attente');
            queueSheetsSync('replay');
        }
    }
}

// Charger toutes les données depuis Google Drive (POST puis fallback JSONP si CORS)
async function loadFromDrive() {
    const applyData = async (data) => {
        if (data.clients) clients = data.clients;
        if (data.invoices) invoices = data.invoices;
        if (data.quotes) quotes = data.quotes;
        if (data.tasks) tasks = data.tasks;
        if (data.rams) rams = data.rams;
        if (data.recurringInvoices) recurringInvoices = data.recurringInvoices;
        if (data.companyInfo) companyInfo = data.companyInfo;
        if (data.taxSettings) taxSettings = data.taxSettings;

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
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
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

const SYNC_TIMEOUT = 15000;
let isSyncing = false;
let lastSyncTime = null;

// Feuilles Sheets : sync auto (debounce)
let autoSheetsSyncEnabled = true;  // Can be toggled by user
const SHEETS_SYNC_DEBOUNCE = 2000;
let sheetsSyncTimer = null;
let sheetsSyncInProgress = false;
let suppressSheetsSync = false;
let pendingSheetsSync = false;

// Sync statistics for UI
let syncStats = {
    lastSyncTime: null,
    itemsSynced: 0,
    errorCount: 0,
    lastError: null
};

// Sync history/journal for troubleshooting
// Stored in IndexedDB + localStorage with max 50 entries (to avoid bloating)
let syncLog = [];
const SYNC_LOG_MAX_ENTRIES = 50;
const SYNC_LOG_STORAGE_KEY = 'mti_syncLog';

// Load sync log from IndexedDB/localStorage on startup
async function loadSyncLog() {
    try {
        const saved = await storageManager.getItem(SYNC_LOG_STORAGE_KEY);
        if (saved) {
            syncLog = saved;
            if (!Array.isArray(syncLog)) {
                syncLog = [];
            }
        }
    } catch (e) {
        console.warn('Could not load sync log:', e);
        syncLog = [];
    }
}

// Add entry to sync log
async function addSyncLogEntry(status, message, details = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        status: status, // 'pending', 'success', 'error', 'retry'
        message: message,
        details: details,
        itemsSynced: details.itemsSynced || 0,
        errorMessage: details.errorMessage || null
    };
    
    syncLog.unshift(entry); // Add at beginning (newest first)
    
    // Keep only last SYNC_LOG_MAX_ENTRIES
    if (syncLog.length > SYNC_LOG_MAX_ENTRIES) {
        syncLog = syncLog.slice(0, SYNC_LOG_MAX_ENTRIES);
    }
    
    // Save to IndexedDB + localStorage
    try {
        await storageManager.saveDual(SYNC_LOG_STORAGE_KEY, syncLog);
    } catch (e) {
        console.warn('Could not save sync log:', e);
    }
    
    console.log('[SyncLog]', status, ':', message, details);
}

// Get sync log (for display in UI)
function getSyncLog(limit = 20) {
    return syncLog.slice(0, limit);
}

// Clear sync log
async function clearSyncLog() {
    syncLog = [];
    try {
        await storageManager.removeItem(SYNC_LOG_STORAGE_KEY);
    } catch (e) {
        console.warn('Could not clear sync log:', e);
    }
}

// Export window functions for UI
window.getSyncLog = getSyncLog;
window.clearSyncLog = clearSyncLog;

// ==========================================
// INTELLIGENT RECONCILIATION SYSTEM (v2.4.4)
// ==========================================

// Fetch Drive data without applying (for comparison)
async function fetchDriveDataOnly() {
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
        invoices = reconciled;
        hasChanges = true;
        console.log(`📋 Invoices reconciled: ${reconciled.length} items`);
    }
    
    if (divergences.quotes) {
        const reconciled = reconcileData(quotes, driveData.quotes, 'quotes');
        quotes = reconciled;
        hasChanges = true;
        console.log(`📄 Quotes reconciled: ${reconciled.length} items`);
    }
    
    if (divergences.rams) {
        const reconciled = reconcileData(rams, driveData.rams, 'rams');
        rams = reconciled;
        hasChanges = true;
        console.log(`📊 RAMs reconciled: ${reconciled.length} items`);
    }
    
    if (divergences.clients) {
        const reconciled = reconcileData(clients, driveData.clients, 'clients');
        clients = reconciled;
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

// Données chargées depuis Google Drive (vides par défaut, seront écrasées au chargement)
let clients = [];
let invoices = [];
let quotes = []; // Devis
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
    email: 'contact@mticonsulting.fr',
    phone: '07 56 98 99 59',
    website: 'www.mticonsulting.fr',
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
    acreActif: 12.3,          // Année 1 avec ACRE - Taux réduit BNC 2025 : 12,30% (hors CFP)
    acreInactif: 24.6,        // Année 2+ sans ACRE - Taux plein 2025 (évolution +1%/an jusqu'en 2029)
    // CFP (Contribution Formation Professionnelle) BNC - OBLIGATOIRE
    cfpBNC: 0.2,              // 0,2% du CA (Code du travail L6331-48)
    // Conditions versement libératoire
    rfrMaxVL: 28797,          // RFR max par part pour VL 2026 (27478€ pour 2025)
    // Seuils fiscaux annuels
    seuilTVAAnnuel: 37500,    // Franchise TVA (prestations de services)
    seuilTVAMajore: 39100,    // Seuil majoré TVA (tolérance 2 ans)
    caMaxBNC: 77700,          // Plafond CA BNC pour micro-entreprise
    objectifCAMensuel: 6000,  // Objectif CA mensuel personnalisable (€)
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
    seuilTVAAnnuel: 37500,
    seuilTVAMajore: 39100,
    caMaxBNC: 77700,
    objectifCAMensuel: 6000,
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
        const noAutoRelanceIcon = client.noAutoRelance ? ' 🔕' : '';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${client.name}${emailIcon}${noAutoRelanceIcon}</strong></td>
            <td>${client.siret || '-'}</td>
            <td style="white-space: pre-line; max-width: 200px;">${client.address || '-'}</td>
            <td>${client.naf || '-'}</td>
            <td>${client.categorie_juridique || '-'}</td>
            <td>${client.etat_administratif || '-'}</td>
            <td>${client.email_facturation || '-'}</td>
            <td>${client.contact_name || '-'}</td>
            <td>${clientInvoices.length}</td>
            <td><strong>${formatNumber(totalBilled)} €</strong></td>
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
// Import invoices from Google Sheets
async function importInvoicesFromSheets() {
    suppressSheetsSync = true;
    try {
        const result = await callBackend('importInvoicesFromSheets', { sheetId: CONFIG.SHEETS_ID });
        if (!result || !result.success) {
            showBackendRawResponse(result);
            throw new Error(result && result.error ? result.error : 'Erreur import factures');
        }
        if (result.data && Array.isArray(result.data.invoices)) {
            invoices = result.data.invoices;
            await storageManager.saveDual('mti_invoices', invoices);
            renderInvoiceList();
            showToast(`✅ ${invoices.length} facture(s) importée(s)`,'success');
            await saveToDrive({ skipSheetsSync: true });
        } else {
            showToast('Aucune facture importée', 'info');
        }
    } catch (err) {
        console.error('importInvoicesFromSheets error:', err);
        alert('Erreur import factures: ' + (err.message || err));
    } finally {
        suppressSheetsSync = false;
    }
}

// Export invoices to Google Sheets
async function exportInvoicesToSheets() {
    try {
        const result = await callBackend('exportInvoicesToSheets', { sheetId: CONFIG.SHEETS_ID, invoices });
        if (!result || !result.success) throw new Error(result && result.error ? result.error : 'Erreur export factures');
        showToast('✅ Export factures réussi','success');
    } catch (err) {
        console.error('exportInvoicesToSheets error:', err);
        alert('Erreur export factures: ' + (err.message || err));
    }
}

// Nettoyer l'onglet Sheets Factures
async function clearInvoicesInSheets() {
    if (!confirm('⚠️ Cela va vider l\'onglet "Factures" dans Sheets (les données locales restent). Continuer ?')) return;
    try {
        const result = await callBackend('clearInvoiceSheet');
        if (!result || !result.success) throw new Error(result?.data || 'Erreur nettoyage Factures');
        const deleted = result?.data?.rowsDeleted ?? 0;
        showToast(`✅ Feuille Factures nettoyée (${deleted} ligne(s) supprimée(s))`,'success');
    } catch (err) {
        console.error('clearInvoicesInSheets error:', err);
        alert('Erreur nettoyage Factures: ' + (err.message || err));
    }
}

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
    const quoteClientSelect = document.getElementById('quoteClientSelect');
    const ramClientSelect = document.getElementById('ramClientSelect');

    if (clientSelect) {
        clientSelect.innerHTML = '<option value="">Saisie manuelle</option>';
        clients.forEach((client, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = client.name;
            clientSelect.appendChild(option);
        });
    }
    
    if (quoteClientSelect) {
        quoteClientSelect.innerHTML = '<option value="">Saisie manuelle</option>';
        clients.forEach((client, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = client.name;
            quoteClientSelect.appendChild(option);
        });
    }
    
    if (ramClientSelect) {
        ramClientSelect.innerHTML = '<option value="">Saisie manuelle</option>';
        clients.forEach((client, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = client.name;
            ramClientSelect.appendChild(option);
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

// Setup RAM client select listener
function setupRAMClientSelectListener() {
    const ramClientSelect = document.getElementById('ramClientSelect');
    if (!ramClientSelect) return;

    ramClientSelect.addEventListener('change', (e) => {
        const index = e.target.value;
        const clientInput = document.getElementById('ramClientInput');
        const clientSiret = document.getElementById('ramClientSiret');
        const clientAddress = document.getElementById('ramClientAddress');
        const manualGroup = document.getElementById('ramManualClientGroup');
        
        if (index === '') {
            // Saisie manuelle
            if (manualGroup) manualGroup.style.display = 'block';
            if (clientInput) {
                clientInput.value = '';
                clientInput.readOnly = false;
            }
            if (clientSiret) {
                clientSiret.value = '';
                clientSiret.readOnly = false;
            }
            if (clientAddress) {
                clientAddress.value = '';
                clientAddress.readOnly = false;
            }
        } else {
            // Client sélectionné - remplissage auto
            const client = clients[parseInt(index)];
            if (manualGroup) manualGroup.style.display = 'none';
            if (clientInput) {
                clientInput.value = client.name;
                clientInput.readOnly = true;
            }
            if (clientSiret) {
                clientSiret.value = client.siret || '';
                clientSiret.readOnly = true;
            }
            if (clientAddress) {
                clientAddress.value = client.address || '';
                clientAddress.readOnly = true;
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
                type_siege: document.getElementById('clientFormTypeSiege')?.value || '',
                // Relances automatiques
                noAutoRelance: document.getElementById('clientFormNoAutoRelance')?.checked || false
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
    
    // Charger checkbox relances automatiques
    const noAutoRelanceEl = document.getElementById('clientFormNoAutoRelance');
    if (noAutoRelanceEl) noAutoRelanceEl.checked = client.noAutoRelance || false;
    
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
                showToast('❌ Erreur: Éléments du formulaire introuvables', 'error');
                return;
            }

            const clientName = clientNameEl.value.trim();
            const clientAddress = clientAddressEl.value.trim();
            const invoiceNumber = invoiceNumberInput.value.trim();
            const invoiceDate = invoiceDateInput.value;
            const dueDate = dueDateInput.value;
            
            // Récupérer les items (multi-ligne) depuis currentInvoiceItems
            const items = currentInvoiceItems;
            
            // Validations bloquantes (même pattern que devis)
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
            
            const total = calculateTotal();

            const tvaEnabled = document.getElementById('tvaToggle') && document.getElementById('tvaToggle').checked;
            const totalHT = total;
            const tva = tvaEnabled ? totalHT * 0.20 : 0;
            const totalTTC = totalHT + tva;

            let tvaSection = '';
            if (tvaEnabled) {
                tvaSection = `
                    <div class="invoice-total">
                        Total HT: ${formatNumber(totalHT)} €<br>
                        TVA (20%): ${formatNumber(tva)} €<br>
                        <strong>Total TTC: ${formatNumber(totalTTC)} €</strong>
                    </div>
                `;
            } else {
                tvaSection = `
                    <div class="invoice-total">
                        Total HT: ${formatNumber(totalHT)} €<br>
                        TVA non applicable (art. 293 B du CGI)<br>
                        <strong>Total TTC: ${formatNumber(totalHT)} €</strong>
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
                    <td style="text-align: right;">${formatNumber(parseFloat(item.unitPrice || 0))} €</td>
                    <td style="text-align: right;">${formatNumber(item.total || 0)} €</td>
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
window.renderInvoicePreview = function(inv, showModal) {
    renderInvoicePreviewImpl(inv, showModal);
};
function renderInvoicePreviewImpl(inv, showModal) {
    // Préparer l'HTML complet de la facture en utilisant le même builder que le PDF
    const previewHTML = buildInvoiceHtml({
        clientName: inv.client || '',
        clientAddress: inv.clientAddress || '',
        invoiceNumber: inv.number || '',
        invoiceDate: inv.date || '',
        dueDate: inv.dueDate || '',
        total: inv.total || 0,
        tvaEnabled: !!inv.tvaEnabled,
        items: inv.items && inv.items.length ? inv.items : [
            { description: inv.description || '', quantity: inv.quantity || 0, unitPrice: inv.unitPrice || 0, total: inv.total || 0 }
        ],
        sourceQuoteNumber: inv.sourceQuoteNumber || ''
    });

    // Build reminder history HTML
    const relancesHTML = inv.relances && inv.relances.length > 0 
        ? inv.relances.map(r => {
            const levelLabels = { 1: 'Rappel aimable', 2: 'Relance ferme', 3: 'Mise en demeure' };
            const sentLabel = r.sent ? '✅ Envoyée' : '⏳ Brouillon';
            const manualLabel = r.manual ? ' (Manuel)' : ' (Auto)';
            return `
            <div style="padding: 8px 12px; border-left: 4px solid ${r.level === 3 ? '#dc3545' : r.level === 2 ? '#ff9800' : '#4caf50'}; background: ${r.level === 3 ? 'rgba(220,53,69,0.05)' : r.level === 2 ? 'rgba(255,152,0,0.05)' : 'rgba(76,175,80,0.05)'}; border-radius: 4px; margin-bottom: 8px; font-size: 13px;">
                <div style="font-weight: bold; color: #1a1a1a;">${levelLabels[r.level] || 'Niveau ' + r.level} ${sentLabel} ${manualLabel}</div>
                <div style="color: #666; margin-top: 4px;">📅 ${formatDateFR(r.date)} • 📊 ${r.daysLate} jours de retard</div>
            </div>
            `;
        }).join('')
        : '<p style="color: #999; font-style: italic; text-align: center; padding: 16px; margin: 0;">Aucune relance envoyée</p>';

    if (showModal) {
        // Afficher dans un modal avec iframe + historique relances
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; overflow-y: auto;';
        modal.innerHTML = `
            <div style="position: relative; background: white; border-radius: 8px; max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto; padding: 20px;">
                <button onclick="this.closest('div').parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 18px; z-index: 10000;">×</button>
                <iframe style="width: 100%; height: 600px; border: none; border-radius: 8px; margin-bottom: 20px;" srcdoc="${previewHTML.replace(/"/g, '&quot;')}"></iframe>
                <div style="border-top: 2px solid #e0e0e0; padding-top: 20px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1a1a1a;">📧 Historique des relances</h3>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${relancesHTML}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        // Remplir le conteneur d'aperçu si présent
        const previewContent = document.getElementById('invoicePreviewContent');
        if (previewContent) {
            previewContent.innerHTML = `
                <iframe style="width: 100%; height: 600px; border: none; border-radius: 8px; margin-bottom: 20px;" srcdoc="${previewHTML.replace(/"/g, '&quot;')}"></iframe>
                <div style="border-top: 2px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #1a1a1a;">📧 Historique des relances</h3>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${relancesHTML}
                    </div>
                </div>
            `;
        }
    }
}
window.renderInvoicePreviewImpl = renderInvoicePreviewImpl;

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
        if (totalHTEl) totalHTEl.value = formatNumber(totalHT) + ' €';
        if (totalTVAEl) totalTVAEl.value = formatNumber(tva) + ' €';
        if (totalTTCEl) totalTTCEl.value = formatNumber(totalTTC) + ' €';
    } else {
        const totalHTOnlyEl = document.getElementById('totalHTOnly');
        if (totalHTOnlyEl) totalHTOnlyEl.value = formatNumber(totalHT) + ' €';
    }

    return totalHT;
}

// Format date to French format
function formatDateFR(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
}

// Format number with thousands separator (space)
function formatNumber(number, decimals = 2) {
    if (number === null || number === undefined || isNaN(number)) return '0,00';
    
    const num = parseFloat(number);
    const parts = num.toFixed(decimals).split('.');
    
    // Add space separator for thousands
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    
    // Use comma for decimal separator (French format)
    return parts.join(',');
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
    const emailFromEl = document.getElementById('emailFrom');
    if (emailToEl) emailToEl.textContent = emailTo || '(À compléter manuellement)';
    if (emailSubjectEl) emailSubjectEl.textContent = subject;
    if (emailBodyEl) emailBodyEl.textContent = body;
    // Correction : forcer le champ 'De:' à afficher l'email paramétré et nettoyer tout contenu HTML/innerText
    if (emailFromEl) {
        emailFromEl.textContent = '';
        emailFromEl.innerText = '';
        emailFromEl.value = '';
        emailFromEl.textContent = 'contact@mticonsulting.fr';
    }

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
let currentInvoiceSourceQuoteNumber = '';

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
                ${formatNumber(item.total)} €
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
            total: totalHT,
            sourceQuoteNumber: currentInvoiceSourceQuoteNumber || '',
            // Relances automatiques
            noAutoRelance: document.getElementById('invoiceNoAutoRelance')?.checked || false,
            relances: [] // Historique des relances
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

    // Réinitialiser l'origine devis éventuelle
    currentInvoiceSourceQuoteNumber = '';

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
    
    // Check status filter first to decide about cancelled invoices
    const statusFilter = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : 'all';
    
    // By default, exclude cancelled invoices unless explicitly selected
    if (statusFilter !== 'Annulée') {
        filtered = filtered.filter(inv => inv.status !== 'Annulée');
    }

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

    // Apply specific status filter if selected
    if (statusFilter !== 'all' && statusFilter !== 'Annulée') {
        filtered = filtered.filter(inv => inv.status === statusFilter);
    } else if (statusFilter === 'Annulée') {
        filtered = filtered.filter(inv => inv.status === 'Annulée');
    }

    return filtered;
}

function applyFilters() {
    const filtered = getFilteredInvoices();
    renderInvoiceTable(filtered);
    updateSummary(filtered);
    renderCharts(); // FIX: Actualiser les graphiques après filtrage
    try { updateDashboard(); } catch (e) { console.warn('updateDashboard error', e); }
    try { updateAlerts(); } catch (e) { console.warn('updateAlerts error', e); }
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
            <td><strong>${formatNumber(invoice.total || 0)} €</strong></td>
            <td><input type="number" class="form-control" style="width: 100px; font-size: var(--font-size-xs);" value="${montantRecu}" step="0.01" min="0" onchange="updateMontantRecu(${index}, this.value)"></td>
            <td><input type="date" class="form-control" style="width: 140px; font-size: var(--font-size-xs);" value="${invoice.dateReception || ''}" onchange="updateDateReception(${index}, this.value)"></td>
            <td><strong>${formatNumber(reste)} €</strong></td>
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

// ========== DROPDOWN MENU FUNCTIONS ==========

// Toggle secondary actions visibility
function toggleInvoiceSecondaryActions(button) {
    const actionsDiv = button.parentElement.nextElementSibling;
    if (!actionsDiv || !actionsDiv.classList.contains('invoice-secondary-actions')) {
        console.error('Secondary actions not found');
        return;
    }
    const isHidden = actionsDiv.style.display === 'none';
    actionsDiv.style.display = isHidden ? 'flex' : 'none';
}

// Toggle secondary actions for quotes
function toggleQuoteSecondaryActions(button) {
    const actionsDiv = button.parentElement.nextElementSibling;
    if (!actionsDiv || !actionsDiv.classList.contains('quote-secondary-actions')) {
        console.error('Secondary actions not found');
        return;
    }
    const isHidden = actionsDiv.style.display === 'none';
    actionsDiv.style.display = isHidden ? 'flex' : 'none';
}

// Change invoice/quote status by clicking badge
function changeStatusFromBadge(statusBadge, dataType, index, currentStatus) {
    if (event) event.stopPropagation();
    const statuses = dataType === 'invoice' ? 
        ['Brouillon', 'Envoyée', 'Payée', 'Annulée'] : 
        ['Brouillon', 'Envoyé', 'Accepté', 'Refusé'];
    
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    if (dataType === 'invoice') {
        setInvoiceStatus(index, nextStatus);
    } else if (dataType === 'quote') {
        setQuoteStatus(index, nextStatus);
    }
}

// ========== END DROPDOWN FUNCTIONS ==========

// Render invoice list in FACTURES tab
function renderInvoiceList() {
    const tbody = document.getElementById('invoiceListBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (invoices.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" style="text-align: center; color: var(--color-text-secondary); padding: var(--space-24);">Aucune facture créée</td>';
        tbody.appendChild(row);
        updateCAYearOptions(); // Mettre \u00e0 jour les ann\u00e9es m\u00eame s'il n'y a pas de factures
        return;
    }

    invoices.forEach((invoice, index) => {
        const row = document.createElement('tr');
        const sourceQuoteBadge = invoice.sourceQuoteNumber
            ? `<a href="#" onclick="openQuoteByNumber('${invoice.sourceQuoteNumber}')" title="Ouvrir le devis d'origine" style="text-decoration: none; display: inline-block; padding: 4px 8px; border-radius: 999px; background: rgba(37, 99, 235, 0.12); color: #1d4ed8; font-size: 12px; font-weight: 700;">${invoice.sourceQuoteNumber}</a>`
            : `<span style="color: var(--color-text-secondary); font-size: 12px;">—</span>`;
        const noAutoRelanceIcon = invoice.noAutoRelance ? ' 🔕' : '';
        row.innerHTML = `
            <td><strong>${invoice.number}${noAutoRelanceIcon}</strong></td>
            <td>${invoice.client}</td>
            <td>${sourceQuoteBadge}</td>
            <td>${formatDateFR(invoice.date)}</td>
            <td><strong>${formatNumber(invoice.total || 0)} €</strong></td>
            <td><span class="status-badge status-${(invoice.status || '').toLowerCase().replace('ée', 'ee').replace('é', 'e')}" style="cursor: pointer;" title="Cliquez pour changer le statut" onclick="changeStatusFromBadge(this, 'invoice', ${index}, '${invoice.status || ''}')">${invoice.status || ''}</span></td>
            <td style="padding: 0;">
                <div style="display: flex; flex-direction: column; gap: 6px; padding: 8px 12px;">
                    <!-- Ligne 1 : Actions principales -->
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-secondary" onclick="editInvoiceInForm(${index})" title="Modifier">✏️</button>
                        <button class="btn btn-sm btn-secondary" onclick="downloadInvoiceFromList(${index})" title="Télécharger PDF">📥</button>
                        <button class="btn btn-sm btn-secondary" onclick="sendInvoiceEmail(${index})" title="Envoyer par email">📧</button>
                        <button class="btn btn-sm btn-secondary" onclick="sendRelanceFromList(${index})" title="Envoyer une relance">🔔</button>
                        <button class="btn btn-sm btn-secondary" onclick="toggleInvoiceSecondaryActions(this)" title="Actions secondaires" style="padding: 6px 8px;">⋯</button>
                    </div>
                    <!-- Ligne 2 : Actions secondaires (masquées par défaut) -->
                    <div class="invoice-secondary-actions" style="display: none; flex-wrap: wrap; gap: 6px;">
                        <button class="btn btn-sm btn-secondary" onclick="generateRAMForInvoice(${index})" title="Générer RAM">📊</button>
                        ${rams.some(r => r.invoiceNumber === invoice.number) ? `<button class="btn btn-sm btn-secondary" onclick="sendInvoiceWithRAM(${index})" title="Envoyer Facture + RAM">📧+📊</button>` : ''}
                        <button class="btn btn-sm btn-secondary" onclick="deleteInvoiceFromList(${index})" title="Supprimer" style="color: #d32f2f;">🗑️</button>
                        <button class="btn btn-sm btn-secondary btn-xs" onclick="setInvoiceStatus(${index}, 'Brouillon')" title="Brouillon">📝</button>
                        <button class="btn btn-sm btn-secondary btn-xs" onclick="setInvoiceStatus(${index}, 'Envoyée')" title="Envoyée">📤</button>
                        <button class="btn btn-sm btn-secondary btn-xs" onclick="setInvoiceStatus(${index}, 'Payée')" title="Payée">✅</button>
                        <button class="btn btn-sm btn-secondary btn-xs" onclick="setInvoiceStatus(${index}, 'Annulée')" title="Annulée">❌</button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Mettre à jour les années disponibles dans le compteur CA
    updateCAYearOptions();
}

// Edit invoice in main form (FACTURES tab)
function editInvoiceInForm(index) {
    const invoice = invoices[index];
    if (!invoice) return;

    // Conserver l'origine devis si présente
    currentInvoiceSourceQuoteNumber = invoice.sourceQuoteNumber || '';

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
    // Normaliser les dates au format AAAA-MM-JJ pour les inputs HTML
    const normalizeDateInput = (val) => {
        if (!val) return '';
        const d = new Date(val);
        if (isNaN(d.getTime())) {
            // Si chaîne non parsable, tenter de prendre les 10 premiers caractères
            return String(val).slice(0, 10);
        }
        return d.toISOString().slice(0, 10);
    };
    if (invoiceDateInput) invoiceDateInput.value = normalizeDateInput(invoice.date);
    if (dueDateInput) dueDateInput.value = normalizeDateInput(invoice.dueDate);

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

    // Load noAutoRelance checkbox
    const noAutoRelanceEl = document.getElementById('invoiceNoAutoRelance');
    if (noAutoRelanceEl) noAutoRelanceEl.checked = invoice.noAutoRelance || false;
    
    // Check if client has noAutoRelance and show warning
    const clientObj = clients.find(c => c.name === invoice.client);
    const relanceWarningDiv = document.getElementById('invoiceRelanceInheritanceWarning');
    if (relanceWarningDiv) {
        if (clientObj && clientObj.noAutoRelance) {
            relanceWarningDiv.style.display = 'block';
            relanceWarningDiv.innerHTML = '⚠️ <strong>Les relances sont désactivées pour ce client.</strong> Cette facture ne sera pas relancée automatiquement, même si vous décochez la case ci-dessous.';
        } else {
            relanceWarningDiv.style.display = 'none';
        }
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

/**
 * Filtre la liste des factures selon la recherche
 */
function filterInvoiceList() {
    const searchInput = document.getElementById('invoiceSearchInput');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    const tbody = document.getElementById('invoiceListBody');
    if (!tbody) return;
    
    // Si vide, afficher toutes les factures
    if (searchTerm === '') {
        renderInvoiceList();
        return;
    }
    
    // Filtrer les factures
    const filtered = invoices.filter(invoice => 
        invoice.number.toLowerCase().includes(searchTerm) ||
        invoice.client.toLowerCase().includes(searchTerm)
    );
    
    // Afficher les résultats filtrés
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="text-align: center; color: var(--color-text-secondary); padding: var(--space-24);">Aucun résultat trouvé</td>';
        tbody.appendChild(row);
        return;
    }
    
    filtered.forEach((invoice) => {
        const index = invoices.indexOf(invoice);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${invoice.number}</strong></td>
            <td>${invoice.client}</td>
            <td>${formatDateFR(invoice.date)}</td>
            <td><strong>${formatNumber((invoice.total || 0))} €</strong></td>
            <td><span class="status-badge status-${(invoice.status || '').toLowerCase().replace('ée', 'ee').replace('é', 'e')}">${invoice.status || ''}</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editInvoiceInForm(${index})" title="Modifier">✏️ Modifier</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteInvoiceFromList(${index})" title="Supprimer" style="margin-left: var(--space-4);">🗑️ Supprimer</button>
                <button class="btn btn-sm btn-primary" onclick="generateRAMForInvoice(${index})" title="Générer Rapport d'Activité Mensuelle" style="margin-left: var(--space-4);">📊 RAM</button>
                <button class="btn btn-sm btn-primary" onclick="sendInvoiceEmail(${index})" title="Envoyer par email" style="margin-left: var(--space-4);">📧 Envoyer</button>
                ${rams.some(r => r.invoiceNumber === invoice.number) ? `<button class="btn btn-sm btn-success" onclick="sendInvoiceWithRAM(${index})" title="Envoyer Facture + RAM ensemble" style="margin-left: var(--space-4);">📧+📊 Facture+RAM</button>` : ''}
                <div style="margin-top: 6px; display: inline-flex; gap: 6px;">
                    <button class="btn btn-sm btn-secondary" onclick="setInvoiceStatus(${index}, 'Brouillon')" title="Marquer Brouillon">📝 Brouillon</button>
                    <button class="btn btn-sm btn-secondary" onclick="setInvoiceStatus(${index}, 'Envoyée')" title="Marquer Envoyée">📤 Envoyée</button>
                    <button class="btn btn-sm btn-secondary" onclick="setInvoiceStatus(${index}, 'Payée')" title="Marquer Payée">✅ Payée</button>
                    <button class="btn btn-sm btn-secondary" onclick="setInvoiceStatus(${index}, 'Annulée')" title="Marquer Annulée">❌ Annulée</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
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
    try { updateDevisKPIs(); } catch (err) { console.warn('updateDevisKPIs after invoice edit failed', err); }
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
            try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
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
    try { updateDevisKPIs(); } catch (err) { console.warn('updateDevisKPIs after duplicate failed', err); }
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

function updateSummary(filteredInvoices = invoices) {
    // Exclude cancelled invoices from summary
    const activeInvoices = filteredInvoices.filter(inv => inv.status !== 'Annulée');
    const totalFacture = activeInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalPaye = activeInvoices.reduce((sum, inv) => sum + (parseFloat(inv.montantRecu) || 0), 0);
    const totalAttente = totalFacture - totalPaye;
    const tauxRecouvrement = totalFacture > 0 ? (totalPaye / totalFacture * 100) : 0;

    const totalFactEl = document.getElementById('totalFacture');
    const totalPayeEl = document.getElementById('totalPaye');
    const totalAttEl = document.getElementById('totalAttente');
    const tauxEl = document.getElementById('tauxRecouvrement');

    if (totalFactEl) totalFactEl.textContent = formatNumber(totalFacture) + ' €';
    if (totalPayeEl) totalPayeEl.textContent = formatNumber(totalPaye) + ' €';
    if (totalAttEl) totalAttEl.textContent = formatNumber(totalAttente) + ' €';
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

// Quick status update for invoices
function setInvoiceStatus(index, status) {
    const invoice = invoices[index];
    if (!invoice) return;
    invoice.status = status;
    renderInvoiceList();
    applyFilters();
    try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
    // Also refresh the annual CA counter tile when status changes
    try { if (typeof updateCADisplay === 'function') updateCADisplay(); } catch (e) { console.warn('updateCADisplay failed', e); }
    showToast(`Statut mis à jour: ${status}`);
    autoSync('update');
    saveToDrive();
}

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
        document.getElementById('seuilTVAAnnuel').value = taxSettings.seuilTVAAnnuel || 37500;
        document.getElementById('seuilTVAMajore').value = taxSettings.seuilTVAMajore || 39100;
        document.getElementById('caMaxBNC').value = taxSettings.caMaxBNC;
        document.getElementById('tauxVersementLib').value = taxSettings.versementLiberatoire;
        // Note: cfeAnnuel is no longer loaded from DOM in Paramètres, managed via Calculs commune search
    }
    
    // Charger l'objectif CA mensuel
    if (document.getElementById('objectifCAMensuel')) {
        document.getElementById('objectifCAMensuel').value = taxSettings.objectifCAMensuel || 6000;
        
        // Mettre à jour les seuils fiscaux affichés (référence mensuelle)
        const seuilTVAMensuel = (taxSettings.seuilTVAAnnuel || 37500) / 12;
        const seuilMicroMensuel = (taxSettings.caMaxBNC || 77700) / 12;
        
        if (document.getElementById('seuilTVAMensuel')) {
            document.getElementById('seuilTVAMensuel').textContent = seuilTVAMensuel.toFixed(0);
        }
        if (document.getElementById('seuilTVAAnnuel')) {
            document.getElementById('seuilTVAAnnuel').textContent = (taxSettings.seuilTVAAnnuel || 37500).toLocaleString('fr-FR');
        }
        if (document.getElementById('seuilMicroMensuel')) {
            document.getElementById('seuilMicroMensuel').textContent = seuilMicroMensuel.toFixed(0);
        }
        if (document.getElementById('seuilMicroAnnuel')) {
            document.getElementById('seuilMicroAnnuel').textContent = (taxSettings.caMaxBNC || 77700).toLocaleString('fr-FR');
        }
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
    // Note: cfeAnnuel is now managed only via commune search in Calculs tab, not in Paramètres
    taxSettings.acreActif = parseFloat(document.getElementById('tauxAcreActif')?.value) || 12.3;
    taxSettings.acreInactif = parseFloat(document.getElementById('tauxAcreInactif')?.value) || 24.6;
    taxSettings.cfpBNC = parseFloat(document.getElementById('tauxCFPBNC')?.value) || 0.2;
    taxSettings.rfrMaxVL = parseFloat(document.getElementById('rfrMaxVL')?.value) || 28797;
    taxSettings.seuilTVAAnnuel = parseFloat(document.getElementById('seuilTVAAnnuel')?.value) || 37500;
    taxSettings.seuilTVAMajore = parseFloat(document.getElementById('seuilTVAMajore')?.value) || 39100;
    taxSettings.caMaxBNC = parseFloat(document.getElementById('caMaxBNC')?.value) || 77700;
    taxSettings.objectifCAMensuel = parseFloat(document.getElementById('objectifCAMensuel')?.value) || 6000;
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
    document.getElementById('tauxAcreActif').value = defaultSettings.acreActif;
    document.getElementById('tauxAcreInactif').value = defaultSettings.acreInactif;
    document.getElementById('tauxCFPBNC').value = defaultSettings.cfpBNC;
    document.getElementById('rfrMaxVL').value = defaultSettings.rfrMaxVL;
    document.getElementById('seuilTVAAnnuel').value = defaultSettings.seuilTVAAnnuel || 37500;
    document.getElementById('seuilTVAMajore').value = defaultSettings.seuilTVAMajore || 39100;
    document.getElementById('caMaxBNC').value = defaultSettings.caMaxBNC;
    document.getElementById('objectifCAMensuel').value = defaultSettings.objectifCAMensuel || 6000;
    
    // Réinitialiser le barème IRPP
    taxSettings.irppBareme = JSON.parse(JSON.stringify(defaultSettings.irppBareme));
    taxSettings.bncAbattement = defaultSettings.bncAbattement;
    renderIRPPBareme();
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

// ================= URSSAF Mon-entreprise API Integration =================
// Minimal client to evaluate official rules and fetch thresholds.
// Docs: https://mon-entreprise.urssaf.fr/documentation/dirigeant/auto%E2%80%91entrepreneur
// OpenAPI: https://mon-entreprise.urssaf.fr/api/v1/openapi.json

const MON_ENTREPRISE_API_BASE = 'https://mon-entreprise.urssaf.fr/api/v1';

/**
 * Evaluate Publicodes expressions via Mon-entreprise API
 * @param {Object} situation - Publicodes situation (inputs)
 * @param {Array<string>} expressions - List of expressions (rules) to evaluate
 * @returns {Promise<Object>} Map of expression -> { value, unit, nodeValue }
 */
async function evaluateMonEntreprise(situation, expressions, attempt = 1) {
    try {
        const res = await fetch(`${MON_ENTREPRISE_API_BASE}/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ situation, expressions })
        });
        if (res.status === 429 && attempt < 5) {
            // Gestion du Retry-After si présent, sinon backoff exponentiel
            let delay = 0;
            const retryAfter = res.headers.get('Retry-After');
            if (retryAfter) {
                // Retry-After peut être en secondes ou en date HTTP
                const retryNum = parseInt(retryAfter, 10);
                if (!isNaN(retryNum)) {
                    delay = retryNum * 1000;
                } else {
                    // Si c'est une date, calculer la différence
                    const retryDate = new Date(retryAfter);
                    const now = new Date();
                    delay = Math.max(retryDate - now, 1000);
                }
            } else {
                delay = Math.pow(2, attempt - 1) * 1000;
            }
            // Ajout d'une gigue aléatoire (jitter)
            delay += Math.floor(Math.random() * 500);
            console.warn(`Rate limited on evaluate, retry after ${delay}ms (attempt ${attempt})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return evaluateMonEntreprise(situation, expressions, attempt + 1);
        }
        if (!res.ok) {
            console.warn(`URSSAF API HTTP error: ${res.status} ${res.statusText}`);
            throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        console.log('URSSAF API raw response:', data);
        // L'API retourne soit 'evaluate' (nouveau format) soit 'evaluations' (ancien format)
        const evaluations = data?.evaluate || data?.evaluations || null;
        return evaluations;
    } catch (err) {
        console.warn('URSSAF evaluate error, using local values', err);
        return null; // caller handles fallback
    }
}

/**
 * Fetch rule details with exponential backoff
 * @param {string} rule - Publicodes rule name
 */
async function fetchUrssafRule(rule, attempt = 1) {
    try {
        const res = await fetch(`${MON_ENTREPRISE_API_BASE}/rules/${encodeURIComponent(rule)}`);
        if (res.status === 429 && attempt < 5) {
            // Gestion du Retry-After si présent, sinon backoff exponentiel
            let delay = 0;
            const retryAfter = res.headers.get('Retry-After');
            if (retryAfter) {
                const retryNum = parseInt(retryAfter, 10);
                if (!isNaN(retryNum)) {
                    delay = retryNum * 1000;
                } else {
                    const retryDate = new Date(retryAfter);
                    const now = new Date();
                    delay = Math.max(retryDate - now, 1000);
                }
            } else {
                delay = Math.pow(2, attempt - 1) * 1000;
            }
            delay += Math.floor(Math.random() * 500);
            console.warn(`Rate limited on ${rule}, retry after ${delay}ms (attempt ${attempt})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchUrssafRule(rule, attempt + 1);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn('URSSAF rule fetch failed', rule, err);
        return null;
    }
}

// Cache for thresholds to avoid repeated calls
let urssafThresholdCache = {
    fetchedAt: null,
    data: null
};

// Cache pour le calcul dynamique des cotisations via API URSSAF
let cotisationsCache = {
    key: null,          // Composite key: "ca_hasACRE_creationDate"
    data: null,         // { montantAnnuel, taux }
    fetchedAt: null     // Timestamp
};

/**
 * Load fiscal thresholds (TVA, micro-BNC) from URSSAF API when possible.
 * Updates `taxSettings` and refreshes dependent UI.
 */
async function loadFiscalThresholdsFromAPI() {
    // If cached within 24h, reuse
    const now = Date.now();
    if (urssafThresholdCache.fetchedAt && (now - urssafThresholdCache.fetchedAt) < 24 * 60 * 60 * 1000) {
        const d = urssafThresholdCache.data;
        if (d) {
            taxSettings.seuilTVAAnnuel = d.seuilTVAAnnuel ?? taxSettings.seuilTVAAnnuel;
            taxSettings.seuilTVAMajore = d.seuilTVAMajore ?? taxSettings.seuilTVAMajore;
            taxSettings.caMaxBNC = d.caMaxBNC ?? taxSettings.caMaxBNC;
            try { updateAlerts(); } catch {}
            return d;
        }
    }

    // Publicodes rules to query (names from Mon-entreprise models)
    // Note: Rules names may change; we attempt resilient mapping.
    const candidateRules = [
        'entreprise . franchise de TVA . seuil',
        'entreprise . franchise de TVA . seuil majoré',
        'dirigeant . auto-entrepreneur . seuil micro-BNC'
    ];

    // Try to evaluate rules directly (no situation dependency for thresholds)
    let thresholds = { seuilTVAAnnuel: null, seuilTVAMajore: null, caMaxBNC: null };
    for (const rule of candidateRules) {
        try {
            const info = await Promise.race([
                fetchUrssafRule(rule),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]);
            if (info?.rule) {
                const val = info?.rule?.nodeValue ?? info?.rule?.value;
                const unit = info?.rule?.unit || info?.rule?.rawNode?.unit;
                if (val) {
                    if (rule.includes('franchise de TVA') && rule.includes('majoré')) thresholds.seuilTVAMajore = Number(val);
                    else if (rule.includes('franchise de TVA')) thresholds.seuilTVAAnnuel = Number(val);
                    else if (rule.includes('micro-BNC')) thresholds.caMaxBNC = Number(val);
                }
            }
        } catch (err) {
            console.warn(`Rule fetch timeout/error for ${rule}:`, err.message);
        }
    }

    // If direct rule fetch failed, fallback via evaluate with explicit expressions
    if (!thresholds.seuilTVAAnnuel || !thresholds.seuilTVAMajore || !thresholds.caMaxBNC) {
        try {
            const evals = await Promise.race([
                evaluateMonEntreprise({}, [
                    'entreprise . franchise de TVA . seuil',
                    'entreprise . franchise de TVA . seuil majoré',
                    'dirigeant . auto-entrepreneur . seuil micro-BNC'
                ]),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]);
            if (evals) {
                thresholds.seuilTVAAnnuel = thresholds.seuilTVAAnnuel ?? Number(evals['entreprise . franchise de TVA . seuil']?.nodeValue || evals['entreprise . franchise de TVA . seuil']?.value);
                thresholds.seuilTVAMajore = thresholds.seuilTVAMajore ?? Number(evals['entreprise . franchise de TVA . seuil majoré']?.nodeValue || evals['entreprise . franchise de TVA . seuil majoré']?.value);
                thresholds.caMaxBNC = thresholds.caMaxBNC ?? Number(evals['dirigeant . auto-entrepreneur . seuil micro-BNC']?.nodeValue || evals['dirigeant . auto-entrepreneur . seuil micro-BNC']?.value);
            }
        } catch (err) {
            console.warn('URSSAF evaluate timeout/error:', err.message);
        }
    }

    // Apply if present; keep current if not
    const applied = {
        seuilTVAAnnuel: thresholds.seuilTVAAnnuel || taxSettings.seuilTVAAnnuel,
        seuilTVAMajore: thresholds.seuilTVAMajore || taxSettings.seuilTVAMajore,
        caMaxBNC: thresholds.caMaxBNC || taxSettings.caMaxBNC
    };
    taxSettings.seuilTVAAnnuel = applied.seuilTVAAnnuel;
    taxSettings.seuilTVAMajore = applied.seuilTVAMajore;
    taxSettings.caMaxBNC = applied.caMaxBNC;

    urssafThresholdCache = { fetchedAt: now, data: applied };

    // Update UI pieces that depend on thresholds
    try { updateAlerts(); } catch {}
    // Update Paramètres fields if present
    const seuilBaseEl = document.getElementById('seuilTVAAnnuel');
    const seuilMajEl = document.getElementById('seuilTVAMajore');
    const caMaxBNCEl = document.getElementById('caMaxBNC');
    if (seuilBaseEl) seuilBaseEl.value = String(taxSettings.seuilTVAAnnuel);
    if (seuilMajEl) seuilMajEl.value = String(taxSettings.seuilTVAMajore);
    if (caMaxBNCEl) caMaxBNCEl.value = String(taxSettings.caMaxBNC);

    // Persist to Drive if values changed (optional but recommended)
    const hasChanges = thresholds.seuilTVAAnnuel || thresholds.seuilTVAMajore || thresholds.caMaxBNC;
    if (hasChanges) {
        try {
            await saveToDrive();
            console.log('✅ Seuils URSSAF persistés dans Drive');
        } catch (err) {
            console.warn('Échec sauvegarde Drive des seuils URSSAF:', err);
        }
    }

    return applied;
}

// Helper to initialize API-driven thresholds on app start
async function initUrssafIntegration() {
    // Add timeout to avoid excessive concurrent requests
    await Promise.race([
        Promise.all([
            loadFiscalThresholdsFromAPI(),
            loadAdditionalFiscalParamsFromAPI()
        ]),
        new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
    ]).catch(err => {
        console.warn('URSSAF init timeout, using local values', err);
    });
}

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

/**
 * Charger d'autres paramètres fiscaux depuis l'API si disponibles.
 * Exemples: taux de versement libératoire, abattement BNC.
 * Met à jour taxSettings avec fallback silencieux.
 */
async function loadAdditionalFiscalParamsFromAPI() {
    // Tentatives de récupération de paramètres additionnels
    const expressions = [
        'dirigeant . auto-entrepreneur . impôt . versement libératoire . taux',
        'dirigeant . BNC . abattement'
    ];

    const evals = await evaluateMonEntreprise({}, expressions);
    if (!evals) return null;

    const vlTaux = evals['dirigeant . auto-entrepreneur . impôt . versement libératoire . taux']?.nodeValue ?? evals['dirigeant . auto-entrepreneur . impôt . versement libératoire . taux']?.value;
    const bncAbatt = evals['dirigeant . BNC . abattement']?.nodeValue ?? evals['dirigeant . BNC . abattement']?.value;

    if (vlTaux) taxSettings.versementLiberatoire = Number(vlTaux); // en %
    if (bncAbatt) taxSettings.bncAbattement = Number(bncAbatt);    // en %

    // Rafraîchir les sections dépendantes
    try { updateAlerts(); } catch {}

    // Synchroniser les champs Paramètres si présents
    const vlEl = document.getElementById('versementLiberatoire');
    const bncEl = document.getElementById('bncAbattement');
    if (vlEl) vlEl.value = String(taxSettings.versementLiberatoire);
    if (bncEl) bncEl.value = String(taxSettings.bncAbattement);

    return { vlTaux, bncAbatt };
}

/**
 * Calcule dynamiquement les cotisations sociales via API URSSAF.
 * Calcul dynamique : Utilise le simulateur officiel Mon-entreprise pour obtenir
 * les taux exacts incluant cotisations + CFP (Contribution Formation Professionnelle).
 * 
 * @param {number} ca - Chiffre d'affaires annuel
 * @param {boolean} hasACRE - Si l'auto-entrepreneur bénéficie de l'ACRE
 * @param {string} creationDate - Date de création au format 'DD/MM/YYYY'
 * @returns {Promise<{montantAnnuel: number, taux: number}>} Cotisations annuelles et taux effectif
 */
async function calculateCotisationsDynamically(ca, hasACRE, creationDate) {
    // Validation de la date
    if (!creationDate || !creationDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        console.warn('Date invalide:', creationDate);
        throw new Error('Date création invalide (format attendu: DD/MM/YYYY)');
    }
    
    // Construction de la situation Publicodes
    const situation = {
        "entreprise . catégorie juridique": "'EI'",
        "entreprise . catégorie juridique . EI . auto-entrepreneur": "oui",
        "dirigeant . auto-entrepreneur": "oui",
        "dirigeant . auto-entrepreneur . chiffre d'affaires": ca,
        "entreprise . activité . nature": "'libérale'",
        "entreprise . activité . nature . libérale . réglementée": "non",
        "entreprise . date de création": creationDate,
        "dirigeant . auto-entrepreneur . éligible à l'ACRE": hasACRE ? "oui" : "non",
        "dirigeant . exonérations . ACRE": hasACRE ? "oui" : "non"
    };

    try {
        // Appel API avec deux règles : cotisations sociales ET CFP séparément
        console.log('Appel API URSSAF avec situation:', { ca, hasACRE, creationDate });
        const response = await evaluateMonEntreprise(situation, [
            "dirigeant . auto-entrepreneur . cotisations et contributions . cotisations",
            "dirigeant . auto-entrepreneur . cotisations et contributions . CFP"
        ]);

        if (!response) {
            throw new Error('API response is null');
        }

        // L'API retourne soit un tableau (nouveau format) soit un objet (ancien format)
        let evaluationTotal, evaluationCFP;
        
        if (Array.isArray(response)) {
            // Nouveau format: evaluate: [{nodeValue: ...}] (sans dottedName si 2 règles)
            console.log('API response array:', JSON.stringify(response, null, 2));
            
            // Quand on demande 2 règles, l'API retourne dans l'ordre demandé
            // [0] = cotisations totales, [1] = CFP
            if (response.length >= 2 && !response[0].error) {
                evaluationTotal = response[0];
                evaluationCFP = response[1].error ? null : response[1];
            } else if (response.length === 1) {
                // Une seule règle demandée ou seule la première a réussi
                evaluationTotal = response[0];
                evaluationCFP = null;
            } else {
                console.warn('Unexpected API response format:', response);
                throw new Error('Total cotisations rule not found in API response');
            }
        } else {
            // Ancien format: {ruleKey: {nodeValue: ...}}
            const ruleTotal = "dirigeant . auto-entrepreneur . cotisations et contributions";
            const ruleCFP = "dirigeant . auto-entrepreneur . cotisations et contributions . CFP";
            
            evaluationTotal = response[ruleTotal];
            evaluationCFP = response[ruleCFP];
        }
        
        if (!evaluationTotal || typeof evaluationTotal.nodeValue !== 'number') {
            console.warn('Response structure:', response);
            throw new Error('Invalid API response structure for total');
        }

        // L'API retourne les cotisations mensuelles (URSSAF seul + CFP séparé)
        const montantMensuelURSSAF = evaluationTotal.nodeValue;
        const montantMensuelCFP = evaluationCFP && typeof evaluationCFP.nodeValue === 'number' 
            ? evaluationCFP.nodeValue 
            : (ca / 12) * (taxSettings.cfpBNC / 100); // Fallback si CFP non retournée
        
        if (isNaN(montantMensuelURSSAF)) {
            throw new Error('Invalid nodeValue from API');
        }

        // Total = URSSAF + CFP
        const montantAnnuelURSSAF = montantMensuelURSSAF * 12;
        const montantAnnuelCFP = montantMensuelCFP * 12;
        const montantAnnuel = montantAnnuelURSSAF + montantAnnuelCFP;
        const taux = ca > 0 ? (montantAnnuel / ca) * 100 : 0;
        const tauxCFP = ca > 0 ? (montantAnnuelCFP / ca) * 100 : 0;

        console.log(`✅ Cotisations URSSAF: ${montantAnnuelURSSAF.toFixed(2)} EUR/an (${((montantAnnuelURSSAF / ca) * 100).toFixed(2)}%)`);
        console.log(`✅ CFP: ${montantAnnuelCFP.toFixed(2)} EUR/an (${tauxCFP.toFixed(2)}%)`);
        console.log(`✅ Total cotisations: ${montantAnnuel.toFixed(2)} EUR/an (${taux.toFixed(2)}%)`);

        return { montantAnnuel, taux, montantAnnuelCFP, tauxCFP };
    } catch (err) {
        // Log silencieux si API null (normal avec CA=0), sinon warning
        if (err.message === 'API response is null') {
            console.log('ℹ️ Calcul local (CA faible ou API indisponible)');
        } else {
            console.warn('⚠️ Échec calcul dynamique cotisations:', err.message);
        }
        
        // Fallback sur valeurs en dur (12,3% ACRE / 24,6% standard)
        // Note: ACRE est une exonération 1ère année uniquement (depuis réforme 2020)
        const tauxFallback = hasACRE ? 12.3 : 24.6;
        const montantAnnuel = ca * (tauxFallback / 100);
        const montantAnnuelCFP = ca * (taxSettings.cfpBNC / 100);
        const tauxCFP = taxSettings.cfpBNC;

        return { montantAnnuel, taux: tauxFallback, montantAnnuelCFP, tauxCFP };
    }

    return { versementLiberatoire: taxSettings.versementLiberatoire, bncAbattement: taxSettings.bncAbattement };
}

function updateComparaisonVL_IRPP(ca, multiplicateur, scenarios) {
    const { vl, irpp } = scenarios;
    const isMensuel = multiplicateur === 1;
    const periodeText = isMensuel ? 'Mensuel' : 'Annuel';

    // Scenario VL
    const scenarioVLContent = document.getElementById('scenarioVLContent');
    if (scenarioVLContent) {
        scenarioVLContent.innerHTML = `
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8);">CA ${periodeText}: <strong>${formatNumber((ca * multiplicateur))} €</strong></div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">URSSAF: ${formatNumber((vl.charges * multiplicateur))} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">CFP: ${formatNumber((vl.cfp * multiplicateur))} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">Impôt VL (${taxSettings.versementLiberatoire}%): ${formatNumber((vl.impot * multiplicateur))} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">CFE: ${formatNumber((vl.cfe * multiplicateur))} €</div>
            <div style="border-top: 2px solid var(--color-border); padding-top: var(--space-8); margin-top: var(--space-8); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);">Total charges: <span style="color: var(--color-warning);">${formatNumber((vl.total * multiplicateur))} €</span></div>
            <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-bold); margin-top: var(--space-8); color: var(--color-primary);">Revenu net: ${formatNumber((vl.net * multiplicateur))} €</div>
        `;
    }

    // Scenario IRPP
    const scenarioIRPPContent = document.getElementById('scenarioIRPPContent');
    if (scenarioIRPPContent) {
        scenarioIRPPContent.innerHTML = `
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8);">CA ${periodeText}: <strong>${formatNumber((ca * multiplicateur))} €</strong></div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">URSSAF: ${formatNumber((irpp.charges * multiplicateur))} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">CFP: ${formatNumber((irpp.cfp * multiplicateur))} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">Impôt IRPP (progressif): ${formatNumber((irpp.impot * multiplicateur))} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">CFE: ${formatNumber((irpp.cfe * multiplicateur))} €</div>
            <div style="border-top: 2px solid var(--color-border); padding-top: var(--space-8); margin-top: var(--space-8); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);">Total charges: <span style="color: var(--color-warning);">${formatNumber((irpp.total * multiplicateur))} €</span></div>
            <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-bold); margin-top: var(--space-8); color: var(--color-primary);">Revenu net: ${formatNumber((irpp.net * multiplicateur))} €</div>
        `;
    }

    // Recommandation
    const comparaisonRecommandation = document.getElementById('comparaisonRecommandation');
    if (comparaisonRecommandation) {
        const diff = Math.abs(vl.net - irpp.net) * multiplicateur;
        const meilleur = vl.net > irpp.net ? 'Versement Libératoire' : 'IRPP Progressif';
        const icone = vl.net > irpp.net ? '💼' : '📊';
        comparaisonRecommandation.innerHTML = `${icone} <strong>Recommandation :</strong> ${meilleur} (gain de ${formatNumber(diff)} € ${isMensuel ? 'par mois' : 'par an'})`;
        comparaisonRecommandation.style.background = vl.net > irpp.net ? 'var(--color-success)' : 'var(--color-primary)';
    }
}

function calculateTaxes() {
    // Sécurité : initialiser le barème IRPP si absent
    if (!taxSettings.irppBareme || taxSettings.irppBareme.length === 0) {
        taxSettings.irppBareme = JSON.parse(JSON.stringify(defaultSettings.irppBareme));
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
    
    // Si CA est 0 ou invalide, utiliser directement les valeurs locales (pas d'appel API)
    if (!ca || ca <= 0) {
        const chargesRate = acreActive ? (taxSettings.acreActif / 100) : (taxSettings.acreInactif / 100);
        finalizeTaxCalculation(ca, acreActive, ca * chargesRate, chargesRate * 100);
        return;
    }
    
    // Obtenir date création pour calculs API
    const creationDateInput = document.getElementById('dateDebutActivite');
    let creationDate = creationDateInput && creationDateInput.value ? creationDateInput.value : null;
    
    // Convertir format YYYY-MM-DD (HTML5 date) vers DD/MM/YYYY (Publicodes)
    if (creationDate && creationDate.includes('-')) {
        const parts = creationDate.split('-');
        creationDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    } else if (!creationDate) {
        // Par défaut: 1er janvier année en cours
        creationDate = `01/01/${new Date().getFullYear()}`;
    }
    
    // Calcul des charges sociales : API URSSAF (calcul dynamique) avec fallback
    calculateCotisationsWithFallback(ca * 12, acreActive, creationDate).then(result => {
        // Stocker les données CFP pour finalizeTaxCalculation
        window.lastCFPMensuel = result.montantAnnuelCFP / 12;
        window.lastTauxCFP = result.tauxCFP;
        
        // Une fois les cotisations calculées, finaliser les calculs
        finalizeTaxCalculation(ca, acreActive, result.montantAnnuel / 12, result.taux);
    }).catch(err => {
        console.error('Erreur calcul cotisations:', err);
        // Fallback immédiat sur valeurs en dur
        const chargesRate = acreActive ? (taxSettings.acreActif / 100) : (taxSettings.acreInactif / 100);
        window.lastCFPMensuel = ca * (taxSettings.cfpBNC / 100);
        window.lastTauxCFP = taxSettings.cfpBNC;
        finalizeTaxCalculation(ca, acreActive, ca * chargesRate, chargesRate * 100);
    });
}

/**
 * Calcule cotisations avec cache et fallback automatique.
 * Tente API d'abord, puis fallback sur valeurs locales si échec.
 */
async function calculateCotisationsWithFallback(caAnnuel, hasACRE, creationDate) {
    // Vérifier cache (5 min de validité)
    const cacheKey = `${caAnnuel}_${hasACRE}_${creationDate}`;
    const now = Date.now();
    if (cotisationsCache.key === cacheKey && 
        cotisationsCache.fetchedAt && 
        (now - cotisationsCache.fetchedAt) < 5 * 60 * 1000) {
        return cotisationsCache.data;
    }
    
    // Tenter calcul dynamique API
    try {
        const result = await calculateCotisationsDynamically(caAnnuel, hasACRE, creationDate);
        
        // Mettre en cache
        cotisationsCache = {
            key: cacheKey,
            data: result,
            fetchedAt: now
        };
        
        return result;
    } catch (err) {
        // Fallback sur valeurs en dur + alerte visible
        const tauxFallback = hasACRE ? taxSettings.acreActif : taxSettings.acreInactif;
        try {
            showToast(`⚠️ API URSSAF indisponible, fallback sur taux locaux (${tauxFallback}% + CFP ${taxSettings.cfpBNC}%).`, 'warning');
            console.warn('Fallback URSSAF avec taux locaux:', err);
        } catch (e) {
            console.warn('Fallback URSSAF (toast non affiché):', err);
        }
        return {
            montantAnnuel: caAnnuel * (tauxFallback / 100),
            taux: tauxFallback
        };
    }
}

/**
 * Test manuel de l'API URSSAF (avec/sans ACRE) depuis l'onglet Calculs.
 * Affiche les taux URSSAF et CFP séparés pour vérifier que l'API répond.
 */
async function testUrssafAPI() {
    try {
        const ca = parseFloat(document.getElementById('caInput')?.value) || 0;
        if (!ca || ca <= 0) {
            showToast('Veuillez saisir un CA > 0 avant de tester l\'API URSSAF.', 'warning');
            return;
        }

        // Récupérer la date de début d'activité (convertir vers DD/MM/YYYY)
        const creationDateInput = document.getElementById('dateDebutActivite');
        let creationDate = creationDateInput && creationDateInput.value ? creationDateInput.value : null;
        if (creationDate && creationDate.includes('-')) {
            const parts = creationDate.split('-');
            creationDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else if (!creationDate) {
            creationDate = `01/01/${new Date().getFullYear()}`;
        }

        const caAnnuel = ca * 12;
        const scenarios = [];
        for (const hasACRE of [true, false]) {
            const res = await calculateCotisationsDynamically(caAnnuel, hasACRE, creationDate);
            const montantCFP = res.montantAnnuelCFP ?? 0;
            const montantURSSAF = (res.montantAnnuel ?? 0) - montantCFP;
            const urssafRate = caAnnuel ? (montantURSSAF / caAnnuel) * 100 : 0;
            const cfpRate = caAnnuel ? (montantCFP / caAnnuel) * 100 : (res.tauxCFP || taxSettings.cfpBNC || 0);
            scenarios.push({ hasACRE, urssafRate, cfpRate, montantURSSAF, montantCFP });
        }

        const msg = `API OK · ACRE: URSSAF ${scenarios[0].urssafRate.toFixed(2)}% / CFP ${scenarios[0].cfpRate.toFixed(2)}% | Sans ACRE: URSSAF ${scenarios[1].urssafRate.toFixed(2)}% / CFP ${scenarios[1].cfpRate.toFixed(2)}%`;
        showToast(msg, 'success');
        console.log('🧪 Test API URSSAF détaillé:', scenarios);
    } catch (err) {
        console.error('Test API URSSAF en échec:', err);
        showToast('⚠️ Test API URSSAF en échec: ' + (err.message || err), 'error');
    }
}

/**
 * Finalise les calculs fiscaux avec les cotisations obtenues.
 * @param {number} ca - CA mensuel
 * @param {boolean} acreActive - ACRE actif ou non
 * @param {number} chargesMensuelles - Montant charges mensuelles URSSAF (hors CFP, récupéré séparément via API)
 * @param {number} tauxEffectif - Taux effectif en %
 */
function finalizeTaxCalculation(ca, acreActive, chargesMensuelles, tauxEffectif) {
    const chargesLabel = acreActive ? 'ACRE Année 1 (12 mois)' : 'Sans ACRE (taux plein)'
    
    // Déterminer période affichage (mensuel ou annuel)
    const periodeMensuelRadio = document.getElementById('periodeMensuel');
    const isMensuel = periodeMensuelRadio ? periodeMensuelRadio.checked : true;
    const multiplicateur = isMensuel ? 1 : 12;
    
    // Vérifier seuils avec CA annuel
    const seuil = checkSeuils(ca * 12);
    const alertDiv = document.getElementById('seuilsAlert');
    
    if (alertDiv && seuil.alerte) {
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
    } else if (alertDiv) {
        alertDiv.style.display = 'none';
    }
    
    // Mise à jour label période
    const periodeLabel = document.getElementById('periodeLabel');
    if (periodeLabel) {
        periodeLabel.textContent = isMensuel ? '(Mensuelles)' : '(Annuelles)';
    }

    // 1. Charges sociales URSSAF et CFP (récupérées dynamiquement de l'API)
    // Correction : URSSAF (hors CFP) et CFP séparés
    // Si l'API retourne le taux total (URSSAF+CFP), on doit le corriger ici
    // On force le taux URSSAF à la valeur hors CFP (taxSettings.acreActif ou acreInactif)
    const tauxURSSAF = acreActive ? taxSettings.acreActif : taxSettings.acreInactif;
    const charges = ca * (tauxURSSAF / 100);
    const tauxCFP = taxSettings.cfpBNC;
    const cfpMensuel = ca * (tauxCFP / 100);

    // 2. CFE mensuel
    const cfe = taxSettings.cfeAnnuel / 12;

    // === CALCUL SCENARIO VL ===
    const impotVL = ca * (taxSettings.versementLiberatoire / 100);
    const totalChargesVL = charges + cfpMensuel + impotVL + cfe;
    const netVL = ca - totalChargesVL;

    // === CALCUL SCENARIO IRPP ===
    const caAnnuel = ca * 12;
    const revenuImposable = calculateBNCRevenuImposable(caAnnuel);
    const impotAnnuelIRPP = calculateIRPPProgressif(revenuImposable);
    const impotIRPP = impotAnnuelIRPP / 12;
    const totalChargesIRPP = charges + cfpMensuel + impotIRPP + cfe;
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
    const impotBase = useVL ? formatNumber(ca * multiplicateur) : formatNumber(revenuImposable);

    // === REMPLIR TABLEAU DE DETAIL (utilise régime sélectionné) ===
    const detailBody = document.getElementById('detailChargesBody');
    if (detailBody) {
        detailBody.innerHTML = `
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-12);">Charges sociales URSSAF <small style="color: var(--color-text-secondary);">(${chargesLabel})</small></td>
                <td style="padding: var(--space-12); text-align: center;">${tauxURSSAF.toFixed(1)}%</td>
                <td style="padding: var(--space-12); text-align: right;">${formatNumber((ca * multiplicateur))} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold);">${formatNumber((charges * multiplicateur))} €</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-12);">CFP <small style="color: var(--color-text-secondary);">(Formation professionnelle)</small></td>
                <td style="padding: var(--space-12); text-align: center;">${tauxCFP.toFixed(1)}%</td>
                <td style="padding: var(--space-12); text-align: right;">${formatNumber((ca * multiplicateur))} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold);">${formatNumber((cfpMensuel * multiplicateur))} €</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-12);">Impôt sur le revenu <small style="color: var(--color-text-secondary);">(${regimeLabel})</small></td>
                <td style="padding: var(--space-12); text-align: center;">${impotTaux}</td>
                <td style="padding: var(--space-12); text-align: right;">${impotBase} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold);">${formatNumber((impotDetail * multiplicateur))} €</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-12);">CFE <small style="color: var(--color-text-secondary);">(Cotisation Foncière Entreprises)</small></td>
                <td style="padding: var(--space-12); text-align: center;">—</td>
                <td style="padding: var(--space-12); text-align: right;">—</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold);">${formatNumber((cfe * multiplicateur))} €</td>
            </tr>
        `;
    }
    document.getElementById('detailTotalCharges') && (document.getElementById('detailTotalCharges').textContent = formatNumber(totalChargesDetail * multiplicateur) + ' €');
    document.getElementById('detailRevenuNet') && (document.getElementById('detailRevenuNet').textContent = formatNumber(netDetail * multiplicateur) + ' €');

    // === COMPARAISON VL vs IRPP ===
    const scenarios = {
        vl: { charges, cfp: cfpMensuel, impot: impotVL, cfe, total: totalChargesVL, net: netVL },
        irpp: { charges, cfp: cfpMensuel, impot: impotIRPP, cfe, total: totalChargesIRPP, net: netIRPP }
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
                <span><strong>${formatNumber(versementLibMensuel)} €/mois</strong> (${formatNumber(comp.versementLib)} €/an)</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-bg-1); border-radius: var(--radius-base);">
                <span><strong>IRPP progressif</strong> <small style="color: var(--color-text-secondary);">(après abattement BNC ${taxSettings.bncAbattement}%)</small></span>
                <span><strong>${formatNumber(irppProgressifMensuel)} €/mois</strong> (${formatNumber(comp.irppProgressif)} €/an)</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-bg-1); border-radius: var(--radius-base);">
                <span style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">Revenu imposable annuel (après abattement BNC)</span>
                <span style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">${formatNumber(comp.revenuImposable)} €</span>
            </div>
        </div>
        <div style="padding: var(--space-12); background: ${meilleurColor}15; border: 2px solid ${meilleurColor}; border-radius: var(--radius-base); text-align: center;">
            <strong style="color: ${meilleurColor}; font-size: var(--font-size-base);">
                ✅ Meilleur choix : ${meilleurLabel}
            </strong>
            <br>
            <span style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
                Économie : ${formatNumber(economieMensuelle)} €/mois (${formatNumber(comp.economie)} €/an)
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
        // Note: code_postal retiré car champ supprimé par Data.gouv (décembre 2025)
        const searchByName = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-entreprises/records?select=libcom,insee_com&where=search(libcom,'${encodeURIComponent(cleanQuery)}')&group_by=libcom,insee_com&limit=10&refine=exercice:"2024"`;
        
        // Recherche par code postal désactivée (champ supprimé de l'API)
        let searchByCP = null;
        
        // Lancer la recherche
        const promises = [fetch(searchByName)];
        
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
        <strong>📍 CFE pour "${commune}" :</strong> ${result.taux} €/an (${formatNumber((result.taux / 12))} €/mois)<br>
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
    
    // Utiliser le taux CFP dynamique de l'API (ou fallback si non disponible)
    const tauxCFPDynamique = window.lastTauxCFP || taxSettings.cfpBNC;
    
    let html = '';
    anneesProjection.forEach((annee, index) => {
        const tauxURSSAF = tauxURSSAFBase + index; // +1%/an
        const urssaf = ca * (tauxURSSAF / 100) * multiplicateur;
        const cfp = ca * (tauxCFPDynamique / 100) * multiplicateur;
        const impot = impotBase * multiplicateur;
        const cfe = (taxSettings.cfeAnnuel / 12) * multiplicateur;
        const totalCharges = urssaf + cfp + impot + cfe;
        const revenuNet = (ca * multiplicateur) - totalCharges;
        
        const rowStyle = index === 0 ? 'background: var(--color-bg-1);' : '';
        
        html += `
            <tr style="border-bottom: 1px solid var(--color-border); ${rowStyle}">
                <td style="padding: var(--space-12); font-weight: var(--font-weight-semibold);">${annee}</td>
                <td style="padding: var(--space-12); text-align: center;">${tauxURSSAF.toFixed(1)}%</td>
                <td style="padding: var(--space-12); text-align: right;">${formatNumber(urssaf)} €</td>
                <td style="padding: var(--space-12); text-align: right;">${formatNumber(cfp)} €</td>
                <td style="padding: var(--space-12); text-align: right;">${formatNumber(impot)} €</td>
                <td style="padding: var(--space-12); text-align: right;">${formatNumber(cfe)} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold); color: var(--color-warning);">${formatNumber(totalCharges)} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-bold); color: var(--color-primary);">${formatNumber(revenuNet)} €</td>
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
    pdf.text(`Chiffre d'affaires: ${formatNumber(ca)} € ${isMensuel ? '(mensuel)' : '(annuel)'}`, 15, 48);
    pdf.text(`Situation ACRE: ${acreActive ? 'Année 1 (12,3%)' : 'Année 2+ (24,6%)'}`, 15, 54);
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
    // Exclude cancelled invoices from CA chart
    const filteredInvoices = getFilteredInvoices().filter(inv => inv.status !== 'Annulée');
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

    // Count by status (exclude cancelled from main chart)
    const statusCounts = {
        'Brouillon': 0,
        'Envoyée': 0,
        'Payée': 0,
        'Retard': 0
    };

    // FIX: Utiliser getFilteredInvoices() au lieu de invoices directement
    // Exclude cancelled invoices from status chart
    const filteredInvoices = getFilteredInvoices().filter(inv => inv.status !== 'Annulée');
    filteredInvoices.forEach(inv => {
        statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
    });

    // Palette alignée sur les variables CSS pour cohérence avec les badges
    const rootStyle = getComputedStyle(document.documentElement);
    const colors = {
        'Brouillon': rootStyle.getPropertyValue('--color-slate-500').trim() || '#626C71',
        'Envoyée': '#1D4ED8',
        'Payée': rootStyle.getPropertyValue('--color-success').trim() || '#10B981',
        'Retard': rootStyle.getPropertyValue('--color-error').trim() || '#DC2626'
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

// Update sync indicator (visual UI feedback)
function updateSyncIndicator(syncing = false, hasError = false) {
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
        indicator.title = `Dernière sync: ${lastSync}\n${itemsInfo}\nAuto-sync: ${autoSheetsSyncEnabled ? 'Activé' : 'Désactivé'}`;
    }
    
    // Update toggle button state with better info
    if (toggleBtn) {
        toggleBtn.classList.toggle('disabled', !autoSheetsSyncEnabled);
        if (autoSyncIcon) {
            autoSyncIcon.textContent = autoSheetsSyncEnabled ? '▶️ Auto-Sync' : '⏸️ Auto-Sync';
        }
        const queuedItems = invoices.length + quotes.length + rams.length + clients.length;
        const syncInfoText = autoSheetsSyncEnabled ? 
            `Auto-sync ENABLED - ${queuedItems} items to sync (debounce 2s)` : 
            `Auto-sync DISABLED - Manual sync only`;
        toggleBtn.title = syncInfoText;
    }
}

// Toggle auto-sync on/off
function toggleAutoSync() {
    autoSheetsSyncEnabled = !autoSheetsSyncEnabled;
    localStorage.setItem('mti_autoSyncEnabled', String(autoSheetsSyncEnabled));
    updateSyncIndicator(false);
    const msg = autoSheetsSyncEnabled ? '✅ Auto-sync activé' : '⏸️ Auto-sync désactivé';
    showToast(msg, 'info');
    console.log('Auto-sync toggled:', autoSheetsSyncEnabled);
}

window.toggleAutoSync = toggleAutoSync;

// Display sync log in UI preview
function updateSyncLogDisplay() {
    const preview = document.getElementById('syncLogPreview');
    if (!preview) return;
    
    const entries = getSyncLog(10);
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
function showSyncLogModal() {
    const entries = getSyncLog(50);
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

window.showSyncLogModal = showSyncLogModal;

// Load auto-sync preference from localStorage
function loadAutoSyncPreference() {
    const saved = localStorage.getItem('mti_autoSyncEnabled');
    if (saved !== null) {
        autoSheetsSyncEnabled = saved === 'true';
        console.log('Auto-sync preference loaded:', autoSheetsSyncEnabled);
    }
    // Initialize indicator on load
    updateSyncIndicator(false);
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
        const listDlInvNum = String(invoice.number || Date.now()).replace(/^(FACTURE|INVOICE)[-_ ]?/i, '');
        a.download = `Facture_${listDlInvNum}.pdf`;
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
    const safeInvNumDrive = String(invoice.number || Date.now()).replace(/^(FACTURE|INVOICE)[-_ ]?/i, '');
    const saveRes = await callBackend('savePdfToDrive', { 
        pdfBase64: pdfBase64, 
        pdfFilename: `Facture_${safeInvNumDrive}.pdf`, 
        folderName: 'Factures' 
    });
    
    if (!saveRes || saveRes.success === false) {
        try { showBackendRawResponse(saveRes); } catch (e) {}
        throw new Error((saveRes && (saveRes.data || saveRes.error)) || 'Erreur sauvegarde PDF sur Drive');
    }
    
    const fileId = saveRes.data && saveRes.data.fileId;
    const fileUrl = saveRes.data && saveRes.data.fileUrl;
    if (!fileId) throw new Error('savePdfToDrive n\'a pas retourné fileId');
    
    return { fileId, fileName: `Facture_${safeInvNumDrive}.pdf`, fileUrl };
}

// Preferred flow: generate PDF, save to Drive, then send email attaching that Drive file
async function sendInvoiceViaDrive(invoice, toEmail) {
    if (!invoice) throw new Error('Invoice missing');
    const client = clients.find(c => c.name === invoice.client) || {};
    const subject = `Facture ${invoice.number} - MTI CONSULTING`;
    const body = generateEmailBody(invoice, client || { name: invoice.client });

    // Reuse existing PDF in Drive if present to avoid regeneration
    const safeInvNumSend = String(invoice.number || Date.now()).replace(/^(FACTURE|INVOICE)[-_ ]?/i, '');
    const expectedName = `Facture_${safeInvNumSend}.pdf`;

    let fileId = null;
    try {
        const listRes = await callBackend('listFilesInFolder', { folderName: 'Factures' });
        if (listRes && listRes.success && Array.isArray(listRes.data)) {
            const match = listRes.data.find(f => String(f.fileName).trim() === expectedName);
            if (match) fileId = match.fileId;
        }
    } catch (listErr) {
        try {
            const jsonpList = await callBackendJSONP('listFilesInFolder', { folderName: 'Factures' });
            if (jsonpList && jsonpList.success && Array.isArray(jsonpList.data)) {
                const match = jsonpList.data.find(f => String(f.fileName).trim() === expectedName);
                if (match) fileId = match.fileId;
            }
        } catch (jsonpListErr) {
            // listing unavailable; we'll generate
        }
    }

    if (!fileId) {
        // Generate PDF base64 and save to Drive via backend
        const pdfBase64 = await generateInvoicePDFBase64(invoice);
        const saveRes = await callBackend('savePdfToDrive', { pdfBase64: pdfBase64, pdfFilename: expectedName, folderName: 'Factures' });
        if (!saveRes || saveRes.success === false) {
            try { showBackendRawResponse(saveRes); } catch (e) {}
            throw new Error((saveRes && (saveRes.data || saveRes.error)) || 'Erreur sauvegarde PDF sur Drive');
        }
        fileId = saveRes.data && saveRes.data.fileId;
        if (!fileId) throw new Error('savePdfToDrive n\'a pas retourné fileId');
    }

    // Send email by referencing Drive file
    let sentOk = false;
    try {
        const sendRes = await callBackend('sendEmailWithDriveFile', { to: toEmail, subject, body, fileId, fileName: expectedName });
        sentOk = !!(sendRes && sendRes.success);
        if (!sentOk) {
            try { showBackendRawResponse(sendRes); } catch (e) {}
        }
    } catch (postErr) {
        // try JSONP fallback
        try {
            const jsonpRes = await callBackendJSONP('sendEmailWithDriveFile', { to: toEmail, subject, body, fileId, fileName: expectedName });
            sentOk = !!(jsonpRes && jsonpRes.success);
            if (!sentOk) {
                throw new Error((jsonpRes && (jsonpRes.data || jsonpRes.error)) || 'Erreur envoi email via Drive (JSONP)');
            }
        } catch (jsonpErr) {
            throw jsonpErr;
        }
    }

    // Mark invoice sent and persist
    try {
        const idx = invoices.findIndex(inv => inv.number === invoice.number && inv.client === invoice.client);
        if (idx >= 0) {
            invoices[idx].status = 'Envoyée';
            await saveToDrive();
            renderInvoiceList();
            applyFilters();
            try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
        }
    } catch (e) { console.warn('Impossible de marquer/sauver la facture après envoi Drive:', e); }

    if (sentOk) {
        showToast('✅ Email envoyé avec pièce jointe depuis Drive', 'success');
        return { success: true };
    }
    // Should not reach here: failure throws above
    throw new Error('Envoi email via Drive non confirmé');
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
    try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
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
            clientEmail: (clients.find(c => c.name === (clientNameEl ? clientNameEl.value : '')) || {}).email_facturation || '',
            sourceQuoteNumber: currentInvoiceSourceQuoteNumber || ''
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
        if (typeof renderInvoicePreview === 'function') {
            renderInvoicePreview(invoice, true); // Show modal preview
        } else {
            console.warn('renderInvoicePreview not yet available, skipping preview');
        }
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
        pdfFilename: `Facture_${String(invoice.number || Date.now()).replace(/^(FACTURE|INVOICE)[-_ ]?/i, '')}.pdf`
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
        // Validations bloquantes (même pattern que preview)
        const clientNameEl = document.getElementById('clientName');
        const clientAddressEl = document.getElementById('clientAddress');
        
        if (!clientNameEl || !clientAddressEl || !invoiceNumberInput || !invoiceDateInput || !dueDateInput) {
            showToast('❌ Erreur: Éléments du formulaire introuvables', 'error');
            return;
        }

        const clientName = clientNameEl.value.trim();
        const clientAddress = clientAddressEl.value.trim();
        const invoiceDate = invoiceDateInput.value;
        const dueDate = dueDateInput.value;
        const items = currentInvoiceItems;
        
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

// PDF Download functionality using iframe print fallback
function buildInvoiceHtml({clientName, clientAddress, invoiceNumber, invoiceDate, dueDate, description, quantity, unitPrice, total, tvaEnabled, items, sourceQuoteNumber}) {
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
        table { width: 100%; border-collapse: collapse; margin: 25px 0; table-layout: fixed; }
        th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        th { background-color: rgba(33, 128, 141, 0.12); font-weight: bold; font-size: 13px; color: #1a1a1a; }
        td { font-size: 14px; color: #333; }
        /* Colonne description large; chiffres non-wrap pour éviter le retour à la ligne */
        th:nth-child(1), td:nth-child(1) { width: 58%; }
        th:nth-child(2), td:nth-child(2) { width: 10%; white-space: nowrap; text-align: center; }
        th:nth-child(3), td:nth-child(3) { width: 16%; white-space: nowrap; text-align: right; }
        th:nth-child(4), td:nth-child(4) { width: 16%; white-space: nowrap; text-align: right; }
        .totals { text-align: right; margin-top: 30px; padding-top: 20px; border-top: 3px solid #21808D; font-size: 15px; line-height: 1.8; }
        .legal { 
            position: absolute; 
            bottom: 60px; 
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
        .footer {
            position: absolute;
            bottom: 10px;
            left: 50px;
            right: 50px;
            font-size: 8px;
            color: #666;
            text-align: center;
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
                    ${sourceQuoteNumber ? `<div style="margin-top: 6px; color: #21808D; font-weight: bold;">Créée depuis le devis ${sourceQuoteNumber}</div>` : ''}
                </div>
            </div>

            <hr class="separator">

            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: center;">Quantité</th>
                        <th style="text-align: right;">Prix unitaire HT</th>
                        <th style="text-align: right;">Total HT</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoiceItems.map(item => `
                        <tr>
                            <td>${item.description || ''}</td>
                            <td style="text-align: center;">${item.quantity || 0}</td>
                            <td style="text-align: right;">${formatNumber(parseFloat(item.unitPrice || 0))} €</td>
                            <td style="text-align: right;">${formatNumber((item.total || 0))} €</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="totals">
                ${tvaEnabled ? `
                    <div style="margin-bottom: 6px;">Total HT: ${formatNumber(totalHT)} €</div>
                    <div style="margin-bottom: 6px;">TVA (20%): ${formatNumber(tva)} €</div>
                    <div style="font-weight: bold; font-size: 18px; margin-top: 12px; color: #21808D;">Total TTC: ${formatNumber(totalTTC)} €</div>
                ` : `
                    <div style="margin-bottom: 6px;">Total HT: ${formatNumber(totalHT)} €</div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 6px;">TVA non applicable (art. 293 B du CGI)</div>
                    <div style="font-weight: bold; font-size: 18px; margin-top: 12px; color: #21808D;">Total TTC: ${formatNumber(totalHT)} €</div>
                `}
            </div>

        <div class="legal">
            <p><strong>Conditions de paiement:</strong> 30 jours nets à réception | <strong>Escompte:</strong> néant</p>
            <p><strong>Pénalités de retard:</strong> 3 fois le taux d'intérêt légal en vigueur | <strong>Indemnité forfaitaire pour frais de recouvrement:</strong> 40€ (art. D.441-5 du Code de commerce)</p>
            <p><strong>TVA non applicable, art. 293 B du CGI</strong> (franchise en base) | Dispensé d'immatriculation au RCS et au RM (micro-entreprise)</p>
            ${(companyInfo.iban || companyInfo.bic) ? `<p style="margin-top: 6px;">${companyInfo.iban ? `<strong>IBAN:</strong> ${companyInfo.iban}` : ''}${companyInfo.iban && companyInfo.bic ? ' | ' : ''}${companyInfo.bic ? `<strong>BIC:</strong> ${companyInfo.bic}` : ''}</p>` : ''}
        </div>

        <div class="footer">
            <div>${companyInfo.name} - SIRET: ${companyInfo.siret || ''}</div>
            <div>${companyInfo.email} - ${companyInfo.phone}</div>
            <div>${companyInfo.website || 'www.mticonsulting.fr'}</div>
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
        sourceQuoteNumber: currentInvoiceSourceQuoteNumber || '',
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

// Télécharger une facture depuis la liste (même logique que le générateur)
async function downloadInvoiceFromList(index) {
    const invoice = invoices[index];
    if (!invoice) { showToast('❌ Facture introuvable', 'error'); return; }

    // Validations minimales
    if (!invoice.client || !invoice.clientAddress) {
        alert('❌ Client ou adresse manquants pour cette facture');
        return;
    }
    const items = (invoice.items && invoice.items.length > 0) ? invoice.items : [
        { description: invoice.description || '', quantity: invoice.quantity || 0, unitPrice: invoice.unitPrice || 0, total: invoice.total || 0 }
    ];
    if (items.length === 0 || items.some(i => !i.description || i.description.trim() === '')) {
        alert('❌ Lignes de facturation manquantes ou incomplètes');
        return;
    }
    if (!invoice.total || invoice.total <= 0) {
        alert('❌ Montant total de la facture invalide');
        return;
    }

    const invForPdf = {
        client: invoice.client,
        clientAddress: invoice.clientAddress,
        number: invoice.number,
        date: invoice.date,
        dueDate: invoice.dueDate,
        items,
        total: invoice.total,
        tvaEnabled: (document.getElementById('tvaToggle') && document.getElementById('tvaToggle').checked) || false,
        sourceQuoteNumber: invoice.sourceQuoteNumber || ''
    };

    try {
        renderInvoicePreview(invForPdf, false);
    } catch (e) { console.warn('renderInvoicePreview failed', e); }

    try {
        const pdfBase64 = await generateInvoicePDFBase64(invForPdf);
        const safeNum = String(invoice.number || Date.now()).replace(/^(FACTURE|INVOICE)[-_ ]?/i, '');
        const pdfFilename = `Facture_${safeNum}.pdf`;
        const saveResp = await callBackend('savePdfToDrive', { pdfBase64, pdfFilename, folderName: 'Factures' });
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
    } catch (e) {
        console.error('downloadInvoiceFromList failed', e);
        alert('Erreur lors de la génération du PDF');
    }
}

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
            quotes = storedQuotes;
            console.log(`✅ ${quotes.length} devis chargés depuis IndexedDB`);
        }
    } catch (e) {
        console.warn('Erreur chargement quotes IndexedDB:', e);
    }
    
    try {
        const storedRAMs = await storageManager.getItem('mti_rams');
        if (storedRAMs) {
            rams = storedRAMs;
            console.log(`✅ ${rams.length} RAMs chargés depuis IndexedDB`);
        }
    } catch (e) {
        console.warn('Erreur chargement RAMs IndexedDB:', e);
    }

    // Charger les factures depuis IndexedDB si disponibles et si aucune facture n'est chargée
    try {
        const storedInvoices = await storageManager.getItem('mti_invoices');
        if ((!invoices || invoices.length === 0) && storedInvoices) {
            invoices = storedInvoices;
            console.log(`✅ ${invoices.length} factures chargées depuis IndexedDB`);
        }
    } catch (e) {
        console.warn('Erreur chargement factures IndexedDB:', e);
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
    if (invoiceNumberInput) invoiceNumberInput.value = getNextInvoiceNumber(invoiceDateInput ? invoiceDateInput.value : null);
    
    // Initialize invoice items with one empty line
    if (currentInvoiceItems.length === 0) {
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
            pdfFilename: `Facture_${String(invoice.number || Date.now()).replace(/^(FACTURE|INVOICE)[-_ ]?/i, '')}.pdf`
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

// Envoyer une relance pour une facture (même pattern que sendInvoiceByEmail)
async function sendRelanceFromList(index) {
    const invoice = invoices[index];
    const client = clients.find(c => c.name === invoice.client);

    if (!client || !client.email_facturation) {
        alert('❌ Email de facturation manquant');
        return;
    }

    // Ask for reminder level
    const level = prompt('Niveau de relance :\n1 = Rappel aimable\n2 = Relance ferme\n3 = Mise en demeure\n\nEntrez 1, 2 ou 3:', '1');
    if (!level || ![1, 2, 3].includes(parseInt(level))) {
        return;
    }

    try {
        // Ensure the invoice PDF exists in Drive; avoid re-generation if already present
        const safeInvNum = String(invoice.number || Date.now()).replace(/^(FACTURE|INVOICE)[-_ ]?/i, '').replace(/^FAC-/i, '');
        const expectedName = 'Facture_' + safeInvNum + '.pdf';

        let pdfExists = false;
        try {
            const listRes = await callBackend('listFilesInFolder', { folderName: 'Factures' });
            if (listRes && listRes.success && Array.isArray(listRes.data)) {
                pdfExists = listRes.data.some(f => String(f.fileName).trim() === expectedName);
            }
        } catch (listErr) {
            // Fallback to JSONP listing if POST failed
            try {
                const jsonpList = await callBackendJSONP('listFilesInFolder', { folderName: 'Factures' });
                if (jsonpList && jsonpList.success && Array.isArray(jsonpList.data)) {
                    pdfExists = jsonpList.data.some(f => String(f.fileName).trim() === expectedName);
                }
            } catch (jsonpListErr) {
                console.warn('Liste fichiers (Drive) indisponible, on tentera de créer le PDF:', jsonpListErr);
            }
        }

        if (!pdfExists) {
            try {
                const pdfBase64 = await generateInvoicePDFBase64(invoice);
                await callBackend('savePdfToDrive', {
                    pdfBase64,
                    pdfFilename: expectedName,
                    folderName: 'Factures'
                });
            } catch (prepErr) {
                console.warn('Préparation PDF relance (Drive) échouée, tentative d\'envoi sans PJ:', prepErr);
            }
        }

        // Call backend to send relance
        const result = await callBackend('sendRelance', {
            invoiceNumber: invoice.number,
            level: parseInt(level)
        });
        if (!result || !result.success) {
            try { showBackendRawResponse(result); } catch (e) {}
            // Fallback to JSONP to avoid CORS issues
            try {
                const jsonpRes = await callBackendJSONP('sendRelance', {
                    invoiceNumber: invoice.number,
                    level: parseInt(level)
                });
                if (!jsonpRes || !jsonpRes.success) {
                    throw new Error((jsonpRes && (jsonpRes.data || jsonpRes.error)) || 'Erreur lors de l\'envoi de la relance (JSONP)');
                }
            } catch (jsonpErr) {
                throw jsonpErr;
            }
        }

        // Record relance in invoice and persist
        if (!invoice.relances) invoice.relances = [];
        invoice.relances.push({
            date: new Date().toISOString(),
            level: parseInt(level),
            daysLate: Math.floor((new Date() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24)),
            sent: true,
            manual: true
        });
        await saveToDrive();
        renderInvoiceList();

        showToast(`✅ Relance niveau ${level} envoyée à ${client.email_facturation}`, 'success');
    } catch (error) {
        console.error('❌ Erreur relance:', error);
        showToast('⚠️ Envoi via backend échoué, ouverture du compose Gmail en fallback', 'error');
        
        // Fallback to Gmail compose with relance email template
        try {
            const daysLate = Math.floor((new Date() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24));
            const subject = `Relance - Facture ${invoice.number} (${daysLate} jours de retard)`;
            let body = '';
            
            // Generate body based on level
            const levelInt = parseInt(level);
            if (levelInt === 1) {
                body = `Bonjour ${client.contact_name || client.name},

Nous vous rappelons que la facture n°${invoice.number} d'un montant de ${formatNumber(invoice.total || 0)} € HT, arrivant à échéance le ${formatDateFR(invoice.dueDate)}, n'a pas encore été réglée.

Nous vous demandons de bien vouloir effectuer le paiement dans les plus brefs délais.

Cordialement,
MTI CONSULTING`;
            } else if (levelInt === 2) {
                body = `Bonjour ${client.contact_name || client.name},

Malgré notre rappel précédent, la facture n°${invoice.number} d'un montant de ${formatNumber(invoice.total || 0)} € HT reste impayée depuis ${daysLate} jours.

Nous vous demandons instamment de régulariser cette situation. Veuillez effectuer le paiement immédiatement.

À défaut de règlement sous 7 jours, nous serons contraints de prendre les mesures nécessaires.

Cordialement,
MTI CONSULTING`;
            } else if (levelInt === 3) {
                body = `Mise en Demeure de Paiement

${client.contact_name || client.name}
${client.address || ''}

MISE EN DEMEURE

Facture n°: ${invoice.number}
Montant: ${formatNumber(invoice.total || 0)} € HT
Échéance: ${formatDateFR(invoice.dueDate)}
Jours de retard: ${daysLate}

Conformément à l'article L.441-6 du Code de commerce, nous vous adressons cette mise en demeure de procéder au paiement de la somme sus-mentionnée.

À défaut de paiement sous 8 jours à compter de la réception de la présente, nous engagerons une action en recouvrement.

Cordialement,
MTI CONSULTING`;
            }
            
            // Open Gmail compose
            const gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(client.email_facturation) + '&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
            window.open(gmailUrl, '_blank');
            
            // Record relance attempt in invoice
            if (!invoice.relances) invoice.relances = [];
            invoice.relances.push({
                date: new Date().toISOString(),
                level: levelInt,
                daysLate: daysLate,
                sent: false,
                manual: true
            });
            await saveToDrive();
            renderInvoiceList();
            
            showToast('📧 Gmail ouvert - relance à envoyer manuellement', 'info');
        } catch (fallbackErr) {
            console.error('❌ Fallback échoué:', fallbackErr);
            alert('Erreur : ' + (error.message || error));
        }
    }
}

// Générer le corps de l'email
function generateEmailBody(invoice, client) {
    const contactName = client.contact_name || client.name;
    return `Bonjour ${contactName},

Veuillez trouver ci-joint la facture n°${invoice.number} d'un montant de ${formatNumber((invoice.total || 0))} € HT.

Date de facturation : ${formatDateFR(invoice.date)}
Date d'échéance : ${formatDateFR(invoice.dueDate)}

Conditions de paiement : 30 jours nets

Cordialement,
Mickaël TOURDOT-IGUEDJETAL
MTI CONSULTING
Téléphone : +33 7 56 98 99 59
Mail : contact@mticonsulting.fr
Web : www.mticonsulting.fr`;
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

    // Try to fetch logo as data URI using LOCAL asset to avoid CORS
    let originalLogo = companyInfo.logoUrl;
    let logoDataUri = null;
    try {
        logoDataUri = await fetchImageAsDataUri('assets/images/MTI_CONSULTING.png');
        if (logoDataUri) companyInfo.logoUrl = logoDataUri;
    } catch (e) {
        console.warn('Inline local logo failed', e);
    }

    try {
        // Always use the shared HTML builder (same as Devis) for consistent layout/margins/footer
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
            items: invoice.items || [],
            sourceQuoteNumber: invoice.sourceQuoteNumber || ''
        });
    } finally {
        // restore original logo setting
        companyInfo.logoUrl = originalLogo;
    }

    document.body.appendChild(tempContainer);
    // Restore the html2canvas-first path (same as quotes)
    if (window.html2canvas && window.jspdf) {
        try {
            const { jsPDF } = window.jspdf;
            const pdfDoc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdfDoc.internal.pageSize.getWidth();
            const pageHeight = pdfDoc.internal.pageSize.getHeight();
            const a4WidthPx = 794;
            const a4HeightPx = 1123;
            tempContainer.style.width = a4WidthPx + 'px';
            tempContainer.style.height = a4HeightPx + 'px';

            const canvasScale = 2.0;
            const canvas = await html2canvas(tempContainer, { scale: canvasScale, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            pdfDoc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
            const dataUri = pdfDoc.output('datauristring');
            try { document.body.removeChild(tempContainer); } catch(e) {}
            return dataUri.split(',')[1];
        } catch (err) {
            console.warn('html2canvas/pdf path failed, falling back to legacy jsPDF:', err);
            try { document.body.removeChild(tempContainer); } catch(e) {}
            // Fall through to legacy below
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

    // Logo - prefer previously inlined local data URI; never fetch GitHub
    if (logoDataUri) {
        try { doc.addImage(logoDataUri, 'PNG', 20, 20, 30, 30); } catch(e) { /* ignore */ }
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
                `${formatNumber((item.unitPrice || 0))} €`,
                `${formatNumber(((item.quantity || 0) * (item.unitPrice || 0)))} €`
            ])
            : [[
                invoice.description || '',
                (invoice.quantity || 0).toString(),
                `${formatNumber((invoice.unitPrice || 0))} €`,
                `${formatNumber((invoice.total || 0))} €`
            ]];
        
        doc.autoTable({
            startY: 120,
            head: [['Description', 'Quantité', 'Prix unitaire', 'Total HT']],
            body: tableBody,
            colWidth: [85, 25, 35, 35],
            margin: { top: 10, right: 20, bottom: 50, left: 20 }
        });
    } else {
        // Fallback sans autoTable
        if (invoice.items && invoice.items.length > 0) {
            let y = 120;
            invoice.items.forEach(item => {
                doc.text(`${item.description} - ${item.quantity} x ${item.unitPrice}€ = ${formatNumber((item.quantity * item.unitPrice))} €`, 20, y);
                y += 7;
            });
        } else {
            doc.text(invoice.description || '', 20, 120);
        }
    }

    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 140;
    const tva = (invoice.total || 0) * 0.2;
    const ttc = (invoice.total || 0) + tva;

    doc.text(`Total HT : ${formatNumber((invoice.total || 0))} €`, 120, finalY);
    doc.text(`TVA 20% : ${formatNumber(tva)} €`, 120, finalY + 7);
    doc.setFontSize(12);
    doc.text(`Total TTC : ${formatNumber(ttc)} €`, 120, finalY + 14);

    // Footer en bas de page (Y=270 pour marge sûre avant limite 297mm A4)
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    const footerY = 270;
    doc.text(`${companyInfo.name} - SIRET: ${companyInfo.siret}`, 105, footerY, { align: 'center' });
    doc.text(`${companyInfo.email} - ${companyInfo.phone}`, 105, footerY + 4, { align: 'center' });
    doc.text(`${companyInfo.website || 'www.mticonsulting.fr'}`, 105, footerY + 8, { align: 'center' });

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
        const deleted = result?.data?.rowsDeleted ?? 0;
        showToast(`✅ Feuille RAM nettoyée (${deleted} ligne(s) supprimée(s))`, 'success');
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
async function deleteRAM(index) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rapport d\'activité ?')) return;
    
    rams.splice(index, 1);
    await storageManager.saveDual('mti_rams', rams);
    await syncToDrive();
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
        const invoiceFilename = `Facture_${String(invoice.number || Date.now()).replace(/^(FACTURE|INVOICE)[-_ ]?/i, '').replace(/\//g, '_')}.pdf`;
        const ramFilename = `RAM_${linkedRAM.year}_${linkedRAM.monthName}_${invoice.client.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        
        // Corps de l'email
        const invoiceBody = `Montant total : ${formatNumber(invoice.total)} €\nÉchéance : ${formatDateFR(invoice.dueDate)}`;
        
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
    
    // Titre (centré et ultra-compact pour garder visas page 1)
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('RAPPORT D\'ACTIVITÉ MENSUELLE', 105, 42, { align: 'center' });
    
    // Mois et client (ultra-compact, espacement réduit)
    doc.setFontSize(10);
    doc.text(`${monthName} ${year}`, 105, 49, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(`Client : ${client}`, 105, 55, { align: 'center' });
    if (invoiceNumber) {
        doc.text(`Facture : ${invoiceNumber}`, 105, 60, { align: 'center' });
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
        
        // Ajuster taille tableau selon présence remarques (pour tout tenir sur 1 page)
        const hasRemarks = remarks && remarks.trim().length > 0;
        const tableFontSize = hasRemarks ? 6.5 : 7;
        const tableCellPadding = hasRemarks ? 1.2 : 1.5;
        const tableHeaderFontSize = hasRemarks ? 7.5 : 8;
        
        doc.autoTable({
            startY: invoiceNumber ? 65 : 60,
            head: [['Jour', 'Date', 'Heures', 'Commentaires']],
            body: tableData.map(row => [row.day, row.date, row.hours, row.comment]),
            foot: [['', 'TOTAL', monthTotal.toFixed(1) + 'h', '']],
            theme: 'grid',
            styles: { 
                fontSize: tableFontSize,
                cellPadding: tableCellPadding,
                lineColor: [200, 200, 200],
                lineWidth: 0.1,
                overflow: 'linebreak',
                cellWidth: 'wrap'
            },
            headStyles: { 
                fillColor: [33, 128, 141],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: tableHeaderFontSize,
                halign: 'center'
            },
            footStyles: {
                fillColor: [240, 240, 240],
                textColor: 0,
                fontStyle: 'bold',
                fontSize: tableHeaderFontSize
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
    
    // Remarques (compactes avec compression intelligente)
    // Compression intelligente selon longueur des remarques
    let remarksFontSize = 7;
    let remarksLineHeight = 3;
    
    if (remarks) {
        const remarksLength = remarks.length;
        
        if (remarksLength > 500) {
            // Remarques très longues : police 6, interligne 2.5mm
            remarksFontSize = 6;
            remarksLineHeight = 2.5;
        } else if (remarksLength > 300) {
            // Remarques moyennes : police 6.5, interligne 2.8mm
            remarksFontSize = 6.5;
            remarksLineHeight = 2.8;
        }
        
        // Ne pas afficher les remarques sur page 1, elles seront sur page 2
    }
    
    // Page 2 - Remarques, Visas et Footer
    doc.addPage();
    
    // Structure fixe pour éviter chevauchement :
    // - Footer fixe à Y=275mm (hauteur 6mm, marge sûre avant limite 297mm)
    // - Visas fixes à Y=255mm (hauteur 20mm, finissent à 275mm)
    // - Remarques de Y=20mm à Y=245mm max (225mm disponibles)
    
    // Placer le footer sous les visas pour éviter chevauchement
    const footerY = 280;
    const sigY = 255;
    const remarksStartY = 20;
    const remarksMaxY = 245; // 10mm avant les visas
    
    // Afficher les remarques en haut de page 2 (si présentes)
    if (remarks) {
        doc.setFont(undefined, 'bold');
        doc.setFontSize(8);
        doc.text('Remarques', 15, remarksStartY);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(remarksFontSize);
        const remarksLines = doc.splitTextToSize(remarks, 175);
        
        // Calculer hauteur max disponible pour remarques (jusqu'à 10mm avant visas)
        const maxRemarksHeight = remarksMaxY - remarksStartY - 6; // 6mm pour titre + padding
        const maxRemarksLines = Math.floor(maxRemarksHeight / remarksLineHeight);
        const truncatedLines = remarksLines.slice(0, maxRemarksLines);
        
        if (remarksLines.length > maxRemarksLines) {
            truncatedLines[truncatedLines.length - 1] += ' [...]';
            console.warn(`Remarques tronquées: ${remarksLines.length} lignes → ${maxRemarksLines} lignes (hauteur max: ${maxRemarksHeight}mm)`);
        }
        
        const actualRemarksHeight = truncatedLines.length * remarksLineHeight + 6;
        doc.text(truncatedLines, 15, remarksStartY + 4);
        doc.rect(15, remarksStartY - 2, 180, actualRemarksHeight);
        
        console.log(`✅ Remarques affichées en page 2 : Y=${remarksStartY}mm, hauteur=${actualRemarksHeight}mm (max: ${maxRemarksHeight}mm)`);
    }
    
    // Visas FIXES à Y=255mm pour éviter chevauchement
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    
    // Visas recentrés : marge 22mm de chaque côté
    doc.text('Visa Prestataire', 24, sigY);
    doc.rect(22, sigY + 2, 78, 20);
    
    // Ajouter la signature dans la case Prestataire (centrée)
    try {
        const signaturePath = 'assets/images/signature_pandadoc.png';
        const sigDataUri = await fetchImageAsDataUri(signaturePath);
        if (sigDataUri) {
            doc.addImage(sigDataUri, 'PNG', 36, sigY + 4, 50, 15);
        }
    } catch(e) {
        console.warn('Signature non chargée:', e);
    }
    
    doc.text('Visa Superviseur Client', 112, sigY);
    doc.rect(110, sigY + 2, 78, 20);
    
    // Footer FIXE à Y=280mm (5mm après visas)
    
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    
    doc.text(`${companyInfo.name} - SIRET: ${companyInfo.siret}`, 105, footerY, { align: 'center' });
    doc.text(`${companyInfo.email} - ${companyInfo.phone}`, 105, footerY + 3, { align: 'center' });
    doc.text(`${companyInfo.website || 'www.mticonsulting.fr'}`, 105, footerY + 6, { align: 'center' });
    console.log('✅ Footer affiché en page 2 à Y=' + footerY + 'mm');
    
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

    suppressSheetsSync = true;
    try {
        const result = await callBackend('importClients', { sheetId: CONFIG.SHEETS_ID });
        if (!result || result.success === false) throw new Error((result && result.data) ? result.data : 'Erreur serveur lors de l\'import');
        const payload = result.data || {};
        clients = payload.clients || [];
        await saveToDrive({ skipSheetsSync: true });
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
        suppressSheetsSync = false;
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
        const count = Array.isArray(clients) ? clients.length : 0;
        showToast(`✅ ${count} client(s) exporté(s)`, 'success');
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

// Nettoyer l'onglet Sheets Tiers
async function clearClientsInSheets() {
    if (!confirm('⚠️ Cela va vider l\'onglet "Tiers" dans Sheets (les données locales restent). Continuer ?')) return;
    try {
        const result = await callBackend('clearClientSheet');
        if (!result || !result.success) throw new Error(result?.data || 'Erreur nettoyage Tiers');
        const deleted = result?.data?.rowsDeleted ?? 0;
        showToast(`✅ Feuille Tiers nettoyée (${deleted} ligne(s) supprimée(s))`, 'success');
    } catch (err) {
        console.error('clearClientsInSheets error:', err);
        alert('Erreur nettoyage Tiers: ' + (err.message || err));
    }
}

window.clearClientsInSheets = clearClientsInSheets;

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
    suppressSheetsSync = true;
    try {
        const result = await callBackend('import_rams', { sheetId: CONFIG.SHEETS_ID });
        if (!result || result.success === false) {
            throw new Error(result?.data || 'Erreur serveur lors de l\'import');
        }
        
        rams = result.data.rams || [];
        await storageManager.saveDual('mti_rams', rams);
        await saveToDrive({ skipSheetsSync: true });
        renderRAMList();
        
        alert(`✅ ${rams.length} RAM(s) importé(s) depuis Sheets`);
    } catch (error) {
        console.error('importRAMsFromSheets error:', error);
        alert(`❌ Erreur import RAMs : ${error.message || error}`);
    } finally {
        isSyncing = false;
        suppressSheetsSync = false;
    }
}

window.exportRAMsToSheets = exportRAMsToSheets;
window.importRAMsFromSheets = importRAMsFromSheets;

// ==========================================
// QUOTES SYNC AVEC GOOGLE SHEETS
// ==========================================

// Exporter tous les devis vers Sheets (tolère un export vide pour effacer la feuille)
async function exportQuotesToSheets() {
    if (isSyncing) {
        alert('⏳ Une synchronisation est déjà en cours...');
        return;
    }
    
    const confirm = window.confirm(`Exporter ${quotes.length} devis vers Google Sheets ?\n\nCela écrasera le contenu existant de la feuille Devis.`);
    if (!confirm) return;
    
    isSyncing = true;
    try {
        const result = await callBackend('sync_quotes', { sheetId: CONFIG.SHEETS_ID, quotes });
        if (!result || result.success === false) {
            throw new Error(result?.data || 'Erreur serveur lors de l\'export');
        }
        
        alert(`✅ ${result.data.count} ligne(s) exportée(s) vers Sheets`);
        window.open(`https://docs.google.com/spreadsheets/d/${CONFIG.SHEETS_ID}`, '_blank');
    } catch (error) {
        console.error('exportQuotesToSheets error:', error);
        alert(`❌ Erreur export devis : ${error.message || error}`);
    } finally {
        isSyncing = false;
    }
}

// Nettoyer l'onglet Sheets Devis
async function clearQuotesInSheets() {
    if (!confirm('⚠️ Cela va vider l\'onglet "Devis" dans Sheets (les données locales restent). Continuer ?')) return;
    try {
        const result = await callBackend('clearQuoteSheet');
        if (!result || !result.success) throw new Error(result?.data || 'Erreur nettoyage Devis');
        const deleted = result?.data?.rowsDeleted ?? 0;
        showToast(`✅ Feuille Devis nettoyée (${deleted} ligne(s) supprimée(s))`,'success');
    } catch (err) {
        console.error('clearQuotesInSheets error:', err);
        alert('Erreur nettoyage Devis: ' + (err.message || err));
    }
}

// Importer les devis depuis Sheets
async function importQuotesFromSheets() {
    if (isSyncing) {
        alert('⏳ Une synchronisation est déjà en cours...');
        return;
    }
    
    const confirm = window.confirm('Importer les devis depuis Google Sheets ?\n\nCela écrasera les devis locaux non sauvegardés.');
    if (!confirm) return;
    
    isSyncing = true;
    suppressSheetsSync = true;
    try {
        const result = await callBackend('import_quotes', { sheetId: CONFIG.SHEETS_ID });
        if (!result || result.success === false) {
            throw new Error(result?.data || 'Erreur serveur lors de l\'import');
        }
        
        quotes = result.data.quotes || [];
        await saveToDrive({ skipSheetsSync: true });
        // Sauvegarde backup localStorage
        try {
            await storageManager.saveDual('mti_quotes', quotes);
        } catch (e) {
            console.warn('Erreur sauvegarde quotes localStorage:', e);
        }
        renderQuoteList();
        
        alert(`✅ ${quotes.length} devis importé(s) depuis Sheets`);
    } catch (error) {
        console.error('importQuotesFromSheets error:', error);
        alert(`❌ Erreur import devis : ${error.message || error}`);
    } finally {
        isSyncing = false;
        suppressSheetsSync = false;
    }
}

window.exportQuotesToSheets = exportQuotesToSheets;
window.importQuotesFromSheets = importQuotesFromSheets;

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
    const isPaid = (status) => {
        const s = String(status || '').toLowerCase();
        return s === 'payée' || s === 'paid';
    };
    return invoices
        .filter(inv => {
            if (!inv.date) return false;
            const invYear = new Date(inv.date).getFullYear();
            return invYear === annee && isPaid(inv.status);
        })
        .reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
}

/**
 * Calcule le CA annuel cumulé (toutes factures, même non payées)
 * @param {number} annee - Année à analyser
 * @returns {number} CA cumulé en euros
 */
function getCACumule(annee = new Date().getFullYear()) {
    const isCancelled = (status) => {
        const s = String(status || '').toLowerCase();
        return s === 'annulée' || s === 'cancelled';
    };
    return invoices
        .filter(inv => {
            if (!inv.date) return false;
            const invYear = new Date(inv.date).getFullYear();
            return invYear === annee && !isCancelled(inv.status);
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
    
    const seuilTVA = taxSettings.seuilTVAAnnuel || 37500;
    const seuilTVAMajore = taxSettings.seuilTVAMajore || 39100;
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


// ============================================================
// 2.5 DEVIS (QUOTES)
// ============================================================

// Variables globales devis
let currentQuoteItems = [];
let isQuoteEditMode = false;
let editingQuoteIndex = -1;

/**
 * Génère le prochain numéro de devis
 * Format: DEVIS-YYYY-NNN
 */
function getNextQuoteNumber(date = null) {
    const targetDate = date ? new Date(date) : new Date();
    const year = targetDate.getFullYear();
    
    // Filtrer les devis de l'année en cours
    const quotesThisYear = quotes.filter(q => {
        if (!q.number) return false;
        return q.number.startsWith(`DEVIS-${year}`);
    });
    
    // Trouver le prochain numéro séquentiel
    const nextNum = quotesThisYear.length + 1;
    return `DEVIS-${year}-${String(nextNum).padStart(3, '0')}`;
}

/**
 * Ajoute une ligne de devis
 */
function addQuoteItem() {
    const item = {
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0
    };
    currentQuoteItems.push(item);
    renderQuoteItems();
}

/**
 * Supprime une ligne de devis
 */
function removeQuoteItem(index) {
    if (currentQuoteItems.length <= 1) {
        showToast('⚠️ Un devis doit contenir au moins une ligne', 'error');
        return;
    }
    currentQuoteItems.splice(index, 1);
    renderQuoteItems();
}

/**
 * Met à jour un champ d'une ligne de devis
 */
function updateQuoteItemField(index, field, value) {
    if (!currentQuoteItems[index]) return;
    
    if (field === 'quantity' || field === 'unitPrice') {
        currentQuoteItems[index][field] = parseFloat(value) || 0;
        currentQuoteItems[index].total = currentQuoteItems[index].quantity * currentQuoteItems[index].unitPrice;
    } else {
        currentQuoteItems[index][field] = value;
    }
    
    renderQuoteItems();
}

/**
 * Affiche les lignes de devis dans le tableau
 */
function renderQuoteItems() {
    const tbody = document.getElementById('quoteItemsBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    currentQuoteItems.forEach((item, index) => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--color-border)';
        row.innerHTML = `
            <td style="padding: 8px;">
                <input type="text" class="form-control" value="${item.description || ''}" 
                       onchange="updateQuoteItemField(${index}, 'description', this.value)" 
                       placeholder="Description du service/produit" style="font-size: var(--font-size-sm);">
            </td>
            <td style="padding: 8px; text-align: center;">
                <input type="number" class="form-control" value="${item.quantity || 1}" 
                       onchange="updateQuoteItemField(${index}, 'quantity', this.value)" 
                       min="0" step="0.01" style="width: 70px; text-align: center; font-size: var(--font-size-sm);">
            </td>
            <td style="padding: 8px; text-align: right;">
                <input type="number" class="form-control" value="${item.unitPrice || 0}" 
                       onchange="updateQuoteItemField(${index}, 'unitPrice', this.value)" 
                       min="0" step="0.01" style="width: 110px; text-align: right; font-size: var(--font-size-sm);">
            </td>
            <td style="padding: 8px; text-align: right;">
                <strong style="font-size: var(--font-size-sm);">${formatNumber(item.total)} €</strong>
            </td>
            <td style="padding: 8px; text-align: center;">
                <button type="button" class="btn btn-sm btn-secondary" 
                        onclick="removeQuoteItem(${index})" 
                        title="Supprimer ligne" 
                        style="padding: 4px 8px; font-size: 12px;">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    updateQuoteTotals();
}

/**
 * Met à jour les totaux du devis
 */
function updateQuoteTotals() {
    const totalHT = currentQuoteItems.reduce((sum, item) => sum + (item.total || 0), 0);
    
    const totalHTInput = document.getElementById('quoteTotalHT');
    if (totalHTInput) totalHTInput.value = `${formatNumber(totalHT)} €`;
}

/**
 * Initialise les lignes de devis
 */
function loadQuoteItems(items) {
    currentQuoteItems = items && items.length > 0 ? [...items] : [];
    renderQuoteItems();
}

/**
 * Vide les lignes de devis
 */
function clearQuoteItems() {
    currentQuoteItems = [];
    renderQuoteItems();
}

/**
 * Affiche la liste des devis
 */
function renderQuoteList() {
    const tbody = document.getElementById('quoteListBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (quotes.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="8" style="text-align: center; color: var(--color-text-secondary); padding: var(--space-24);">Aucun devis créé</td>';
        tbody.appendChild(row);
        return;
    }

    quotes.forEach((quote, index) => {
        const row = document.createElement('tr');
        const statusClass = (quote.status || '').toLowerCase().replace('é', 'e').replace('è', 'e');
        const linkedInvoiceBadge = quote.linkedInvoiceNumber
            ? `<a href="#" onclick="openInvoiceByNumber('${quote.linkedInvoiceNumber}')" title="Ouvrir la facture liée" style="text-decoration: none; display: inline-block; padding: 4px 8px; border-radius: 999px; background: rgba(16, 185, 129, 0.15); color: #065f46; font-size: 12px; font-weight: 600;">Facture ${quote.linkedInvoiceNumber}</a>`
            : `<span style="color: var(--color-text-secondary); font-size: 12px;">—</span>`;

        row.innerHTML = `
            <td><strong>${quote.number}</strong></td>
            <td>${quote.client}</td>
            <td>${formatDateFR(quote.date)}</td>
            <td>${formatDateFR(quote.validityDate)}</td>
            <td><strong>${formatNumber((quote.total || 0))} €</strong></td>
            <td>${linkedInvoiceBadge}</td>
            <td><span class="status-badge status-${statusClass}" style="cursor: pointer;" title="Cliquez pour changer le statut" onclick="changeStatusFromBadge(this, 'quote', ${index}, '${quote.status || 'Brouillon'}')">${quote.status || 'Brouillon'}</span></td>
            <td style="padding: 0;">
                <div style="display: flex; flex-direction: column; gap: 6px; padding: 8px 12px;">
                    <!-- Ligne 1: Actions principales -->
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-secondary" onclick="editQuoteInForm(${index})" title="Modifier">✏️</button>
                        <button class="btn btn-sm btn-secondary" onclick="downloadQuotePDF(${index})" title="Télécharger PDF">📥</button>
                        <button class="btn btn-sm btn-secondary" onclick="sendQuoteEmail(${index})" title="Envoyer par email">📧</button>
                        <button class="btn btn-sm btn-secondary" onclick="convertQuoteToInvoice(${index})" title="Convertir en facture">🔄</button>
                        <button class="btn btn-sm btn-secondary" onclick="toggleQuoteSecondaryActions(this)" title="Plus d'actions">⋯</button>
                    </div>
                    <!-- Ligne 2: Actions secondaires (cachées par défaut) -->
                    <div class="quote-secondary-actions" style="display: none; flex-wrap: wrap; gap: 6px;">
                        <button class="btn btn-sm btn-secondary" onclick="deleteQuote(${index})" title="Supprimer">🗑️</button>
                        <button class="btn btn-sm btn-secondary" onclick="setQuoteStatus(${index}, 'Brouillon')" title="Marquer comme Brouillon">📝</button>
                        <button class="btn btn-sm btn-secondary" onclick="setQuoteStatus(${index}, 'Envoyé')" title="Marquer comme Envoyé">📤</button>
                        <button class="btn btn-sm btn-secondary" onclick="setQuoteStatus(${index}, 'Accepté')" title="Marquer comme Accepté">✅</button>
                        <button class="btn btn-sm btn-secondary" onclick="setQuoteStatus(${index}, 'Refusé')" title="Marquer comme Refusé">❌</button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Ouvre un devis par son numéro (appelé depuis badge dans liste factures)
 */
function openQuoteByNumber(quoteNumber) {
    const index = quotes.findIndex(q => q.number === quoteNumber);
    if (index === -1) {
        showToast('Devis introuvable', 'error');
        return;
    }
    
    // Switch to Devis tab
    const devisTab = document.querySelector('[data-tab="devis"]');
    if (devisTab) devisTab.click();
    
    // Small delay to ensure tab switch completes
    setTimeout(() => {
        editQuoteInForm(index);
    }, 100);
}

window.openQuoteByNumber = openQuoteByNumber;

/**
 * Filtre la liste des devis
 */
function filterQuoteList() {
    const searchInput = document.getElementById('quoteSearchInput');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    const tbody = document.getElementById('quoteListBody');
    if (!tbody) return;
    
    // Si vide, afficher tous les devis
    if (searchTerm === '') {
        renderQuoteList();
        return;
    }
    
    // Filtrer les devis
    const filtered = quotes.filter(quote => 
        quote.number.toLowerCase().includes(searchTerm) ||
        quote.client.toLowerCase().includes(searchTerm)
    );
    
    // Afficher les résultats filtrés
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="8" style="text-align: center; color: var(--color-text-secondary); padding: var(--space-24);">Aucun résultat pour "${searchTerm}"</td>`;
        tbody.appendChild(row);
        return;
    }
    
    filtered.forEach((quote, filteredIndex) => {
        const index = quotes.indexOf(quote);
        const row = document.createElement('tr');
        const statusClass = (quote.status || '').toLowerCase().replace('é', 'e').replace('è', 'e');
        const linkedInvoiceBadge = quote.linkedInvoiceNumber
            ? `<a href="#" onclick="openInvoiceByNumber('${quote.linkedInvoiceNumber}')" title="Ouvrir la facture liée" style="text-decoration: none; display: inline-block; padding: 4px 8px; border-radius: 999px; background: rgba(16, 185, 129, 0.15); color: #065f46; font-size: 12px; font-weight: 600;">Facture ${quote.linkedInvoiceNumber}</a>`
            : `<span style="color: var(--color-text-secondary); font-size: 12px;">—</span>`;

        row.innerHTML = `
            <td><strong>${quote.number}</strong></td>
            <td>${quote.client}</td>
            <td>${formatDateFR(quote.date)}</td>
            <td>${formatDateFR(quote.validityDate)}</td>
            <td><strong>${formatNumber((quote.total || 0))} €</strong></td>
            <td>${linkedInvoiceBadge}</td>
            <td><span class="status-badge status-${statusClass}" style="cursor: pointer;" title="Cliquez pour changer le statut" onclick="changeStatusFromBadge(this, 'quote', ${index}, '${quote.status || 'Brouillon'}')">${quote.status || 'Brouillon'}</span></td>
            <td style="padding: 0;">
                <div style="display: flex; flex-direction: column; gap: 6px; padding: 8px 12px;">
                    <!-- Ligne 1: Actions principales -->
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-secondary" onclick="editQuoteInForm(${index})" title="Modifier">✏️</button>
                        <button class="btn btn-sm btn-secondary" onclick="downloadQuotePDF(${index})" title="Télécharger PDF">📥</button>
                        <button class="btn btn-sm btn-secondary" onclick="sendQuoteEmail(${index})" title="Envoyer par email">📧</button>
                        <button class="btn btn-sm btn-secondary" onclick="convertQuoteToInvoice(${index})" title="Convertir en facture">🔄</button>
                        <button class="btn btn-sm btn-secondary" onclick="toggleQuoteSecondaryActions(this)" title="Plus d'actions">⋯</button>
                    </div>
                    <!-- Ligne 2: Actions secondaires (cachées par défaut) -->
                    <div class="quote-secondary-actions" style="display: none; flex-wrap: wrap; gap: 6px;">
                        <button class="btn btn-sm btn-secondary" onclick="deleteQuote(${index})" title="Supprimer">🗑️</button>
                        <button class="btn btn-sm btn-secondary" onclick="setQuoteStatus(${index}, 'Brouillon')" title="Marquer comme Brouillon">📝</button>
                        <button class="btn btn-sm btn-secondary" onclick="setQuoteStatus(${index}, 'Envoyé')" title="Marquer comme Envoyé">📤</button>
                        <button class="btn btn-sm btn-secondary" onclick="setQuoteStatus(${index}, 'Accepté')" title="Marquer comme Accepté">✅</button>
                        <button class="btn btn-sm btn-secondary" onclick="setQuoteStatus(${index}, 'Refusé')" title="Marquer comme Refusé">❌</button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

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

// Met à jour le statut d'un devis et rafraîchit l'UI + KPIs
function setQuoteStatus(index, status) {
    const quote = quotes[index];
    if (!quote) return;
    quote.status = status;
    // Si accepté sans facture liée, on garde la possibilité de convertir plus tard
    renderQuoteList();
    try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
    saveToDrive();
}

window.setQuoteStatus = setQuoteStatus;

/**
 * Initialise le formulaire de devis
 */
function initQuoteForm() {
    const quoteForm = document.getElementById('quoteForm');
    if (!quoteForm) return;
    
    // Définir date par défaut (aujourd'hui)
    const quoteDateInput = document.getElementById('quoteDate');
    if (quoteDateInput && !quoteDateInput.value) {
        quoteDateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Définir date validité par défaut (30 jours)
    const validityDateInput = document.getElementById('quoteValidityDate');
    if (validityDateInput && !validityDateInput.value) {
        const validityDate = new Date();
        validityDate.setDate(validityDate.getDate() + 30);
        validityDateInput.value = validityDate.toISOString().split('T')[0];
    }
    
    // Auto-update validity date when quote date changes (+30 days)
    if (quoteDateInput && validityDateInput) {
        quoteDateInput.addEventListener('change', () => {
            const quoteDate = new Date(quoteDateInput.value);
            const validity = new Date(quoteDate);
            validity.setDate(validity.getDate() + 30);
            validityDateInput.value = validity.toISOString().split('T')[0];
        });
    }
    
    // Définir numéro de devis
    const quoteNumberInput = document.getElementById('quoteNumber');
    if (quoteNumberInput && !quoteNumberInput.value) {
        quoteNumberInput.value = getNextQuoteNumber();
    }
    
    // Initialiser avec une ligne vide
    if (currentQuoteItems.length === 0) {
        addQuoteItem();
    }
    
    // Handler soumission formulaire
    quoteForm.addEventListener('submit', saveQuote);
    
    // Setup quote client select listener
    setupQuoteClientSelectListener();
    
    // Setup cancel button
    const cancelBtn = document.getElementById('cancelQuoteEditBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelQuoteEditMode);
    }
    
    // Setup preview button
    const previewBtn = document.getElementById('previewQuote');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            if (currentQuoteItems.length === 0) {
                showToast('⚠️ Ajoutez au moins une ligne au devis', 'error');
                return;
            }
            showQuotePreview();
        });
    }
    
    // Setup download PDF button
    const downloadPDFBtn = document.getElementById('downloadQuotePDF');
    if (downloadPDFBtn) {
        downloadPDFBtn.addEventListener('click', async () => {
            // Validations bloquantes (mêmes exigences que facture)
            if (!currentQuoteItems || currentQuoteItems.length === 0) {
                showToast('❌ Ajoutez au moins une ligne au devis', 'error');
                return;
            }
            if (currentQuoteItems.some(i => !i.description || i.description.trim() === '')) {
                showToast('❌ Chaque ligne doit avoir une description', 'error');
                return;
            }
            // Créer un objet devis temporaire depuis le formulaire
            const tempQuote = {
                number: document.getElementById('quoteNumber').value,
                client: document.getElementById('quoteClientName').value,
                clientSiret: document.getElementById('quoteClientSiret').value,
                clientAddress: document.getElementById('quoteClientAddress').value,
                date: document.getElementById('quoteDate').value,
                validityDate: document.getElementById('quoteValidityDate').value,
                items: [...currentQuoteItems],
                total: currentQuoteItems.reduce((sum, item) => sum + (item.total || 0), 0)
            };
            if (!tempQuote.client || !tempQuote.clientAddress) {
                showToast('❌ Client ou adresse manquants pour ce devis', 'error');
                return;
            }
            if (!tempQuote.date || !tempQuote.validityDate) {
                showToast('❌ Dates du devis incomplètes (émission/validité)', 'error');
                return;
            }
            if (!tempQuote.total || tempQuote.total <= 0) {
                showToast('❌ Montant total du devis invalide', 'error');
                return;
            }
            try {
                showToast('⏳ Génération du PDF et sauvegarde sur Drive...', 'info');
                const pdfBase64 = await generateQuotePDFBase64(tempQuote);
                const safeQuoteNum = String(tempQuote.number || Date.now()).replace(/^(DEVIS|DEVI|Devis)[-_ ]?/i, '');
                const safeClient = (tempQuote.client || 'CLIENT').replace(/[^a-z0-9]/gi, '_');
                const filename = `Devis_${safeQuoteNum}_${safeClient}.pdf`;
                const saveRes = await callBackend('savePdfToDrive', {
                    pdfBase64,
                    pdfFilename: filename,
                    folderName: 'Devis'
                });
                if (!saveRes || !saveRes.success) {
                    showToast('❌ Erreur sauvegarde sur Drive', 'error');
                    return;
                }
                showToast('✅ PDF Devis sauvegardé sur Drive !', 'success');
                // Ouvre la prévisualisation Drive
                if (saveRes.data && saveRes.data.previewUrl) {
                    window.open(saveRes.data.previewUrl, '_blank');
                }
            } catch (error) {
                console.error('Erreur génération/sauvegarde PDF:', error);
                showToast('❌ Erreur lors de la génération ou sauvegarde du PDF: ' + error.message, 'error');
            }
        });
    }
}

/**
 * Configure le listener pour la sélection client dans devis
 */
function setupQuoteClientSelectListener() {
    const quoteClientSelect = document.getElementById('quoteClientSelect');
    if (!quoteClientSelect) return;
    
    quoteClientSelect.addEventListener('change', (e) => {
        const index = e.target.value;
        const nameEl = document.getElementById('quoteClientName');
        const siretEl = document.getElementById('quoteClientSiret');
        const addressEl = document.getElementById('quoteClientAddress');
        
        if (index === '') {
            // Saisie manuelle
            if (nameEl) { nameEl.value = ''; nameEl.readOnly = false; }
            if (siretEl) { siretEl.value = ''; siretEl.readOnly = false; }
            if (addressEl) { addressEl.value = ''; addressEl.readOnly = false; }
        } else {
            // Auto-remplissage depuis client
            const client = clients[parseInt(index)];
            if (nameEl) { nameEl.value = client.name; nameEl.readOnly = true; }
            if (siretEl) { siretEl.value = client.siret || ''; siretEl.readOnly = true; }
            if (addressEl) { addressEl.value = client.address || ''; addressEl.readOnly = true; }
        }
    });
}

/**
 * Sauvegarde un devis
 */
async function saveQuote(e) {
    if (e) e.preventDefault();
    
    // Validation lignes
    if (!currentQuoteItems || currentQuoteItems.length === 0) {
        showToast('⚠️ Veuillez ajouter au moins une ligne au devis', 'error');
        return;
    }
    
    const hasEmptyDescription = currentQuoteItems.some(item => !item.description || item.description.trim() === '');
    if (hasEmptyDescription) {
        showToast('⚠️ Toutes les lignes doivent avoir une description', 'error');
        return;
    }
    
    // Calcul total
    const totalHT = currentQuoteItems.reduce((sum, item) => sum + (item.total || 0), 0);
    
    const quoteNumber = document.getElementById('quoteNumber').value;
    const quoteData = {
        number: quoteNumber,
        client: document.getElementById('quoteClientName').value,
        clientSiret: document.getElementById('quoteClientSiret').value,
        clientAddress: document.getElementById('quoteClientAddress').value,
        date: document.getElementById('quoteDate').value,
        validityDate: document.getElementById('quoteValidityDate').value,
        items: [...currentQuoteItems],
        total: totalHT,
        status: 'Brouillon'
    };
    
    if (isQuoteEditMode && editingQuoteIndex >= 0) {
        // Mise à jour
        quotes[editingQuoteIndex] = {
            ...quotes[editingQuoteIndex],
            ...quoteData
        };
        showToast('✅ Devis mis à jour');
        cancelQuoteEditMode();
    } else {
        // Création
        quotes.push(quoteData);
        showToast('✅ Devis créé avec succès');
        resetQuoteForm();
    }
    
    renderQuoteList();
    saveToDrive();
    // Sauvegarde backup localStorage
    try {
        await storageManager.saveDual('mti_quotes', quotes);
    } catch (e) {
        console.warn('Erreur sauvegarde quotes localStorage:', e);
    }
    try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
}

/**
 * Édite un devis
 */
function editQuoteInForm(index) {
    const quote = quotes[index];
    if (!quote) return;
    
    isQuoteEditMode = true;
    editingQuoteIndex = index;
    
    // Afficher indicateur édition
    const indicator = document.getElementById('editQuoteModeIndicator');
    if (indicator) indicator.style.display = 'block';
    const editingNumberEl = document.getElementById('editingQuoteNumber');
    if (editingNumberEl) editingNumberEl.textContent = quote.number;
    
    // Pré-remplir formulaire
    document.getElementById('quoteNumber').value = quote.number;
    document.getElementById('quoteClientName').value = quote.client;
    document.getElementById('quoteClientSiret').value = quote.clientSiret || '';
    document.getElementById('quoteClientAddress').value = quote.clientAddress || '';
    // Corrige le format de date pour le champ input type="date"
    function formatDateForInput(dateStr) {
        if (!dateStr) return '';
        // Si déjà au format yyyy-MM-dd, retourne tel quel
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        // Si format ISO, extrait la partie date
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }
        // Fallback: retourne la chaîne d'origine
        return dateStr;
    }
    document.getElementById('quoteDate').value = formatDateForInput(quote.date);
    document.getElementById('quoteValidityDate').value = formatDateForInput(quote.validityDate);
    
    loadQuoteItems(quote.items);
    
    // Afficher bouton annuler
    const cancelBtn = document.getElementById('cancelQuoteEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    
    // Changer texte bouton
    const submitBtn = document.getElementById('submitQuoteBtn');
    if (submitBtn) submitBtn.textContent = '💾 Mettre à jour devis';
    
    // Scroll vers formulaire
    document.getElementById('quoteForm').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Annule le mode édition
 */
function cancelQuoteEditMode() {
    isQuoteEditMode = false;
    editingQuoteIndex = -1;
    
    const indicator = document.getElementById('editQuoteModeIndicator');
    if (indicator) indicator.style.display = 'none';
    
    const cancelBtn = document.getElementById('cancelQuoteEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    
    const submitBtn = document.getElementById('submitQuoteBtn');
    if (submitBtn) submitBtn.textContent = '💾 Créer devis';
    
    resetQuoteForm();
}

/**
 * Réinitialise le formulaire devis
 */
function resetQuoteForm() {
    const quoteForm = document.getElementById('quoteForm');
    if (quoteForm) quoteForm.reset();
    
    document.getElementById('quoteNumber').value = getNextQuoteNumber();
    document.getElementById('quoteDate').value = new Date().toISOString().split('T')[0];
    
    const validityDate = new Date();
    validityDate.setDate(validityDate.getDate() + 30);
    document.getElementById('quoteValidityDate').value = validityDate.toISOString().split('T')[0];
    
    clearQuoteItems();
    addQuoteItem();
}

/**
 * Supprime un devis
 */
async function deleteQuote(index) {
    const quote = quotes[index];
    if (!quote) return;
    
    if (confirm(`Supprimer le devis ${quote.number} ?`)) {
        quotes.splice(index, 1);
        showToast('✅ Devis supprimé');
        renderQuoteList();
        await saveToDrive();
        // Sauvegarde backup IndexedDB
        try {
            await storageManager.saveDual('mti_quotes', quotes);
        } catch (e) {
            console.warn('Erreur sauvegarde quotes IndexedDB:', e);
        }
        try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
    }
}

/**
 * Construit le HTML d'un devis (même format que les factures)
 */
function buildQuoteHtml({clientName, clientAddress, quoteNumber, quoteDate, validityDate, items}) {
    const quoteItems = items && items.length > 0 ? items : [];
    const totalHT = quoteItems.reduce((sum, item) => sum + (item.total || 0), 0);
    
    const companyAddressLine = companyInfo.address && companyInfo.postalCode && companyInfo.city
        ? `${companyInfo.address}, ${companyInfo.postalCode} ${companyInfo.city}`
        : '[À compléter dans Paramètres]';

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
        table { width: 100%; border-collapse: collapse; margin: 25px 0; table-layout: fixed; }
        th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        th { background-color: rgba(33, 128, 141, 0.12); font-weight: bold; font-size: 13px; color: #1a1a1a; }
        td { font-size: 14px; color: #333; }
        /* Colonne description large; chiffres non-wrap pour éviter le retour à la ligne */
        th:nth-child(1), td:nth-child(1) { width: 58%; }
        th:nth-child(2), td:nth-child(2) { width: 10%; white-space: nowrap; text-align: center; }
        th:nth-child(3), td:nth-child(3) { width: 16%; white-space: nowrap; text-align: right; }
        th:nth-child(4), td:nth-child(4) { width: 16%; white-space: nowrap; text-align: right; }
        .totals { text-align: right; margin-top: 30px; padding-top: 20px; border-top: 3px solid #21808D; font-size: 15px; line-height: 1.8; }
        .legal { 
            position: absolute; 
            bottom: 60px; 
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
        .warning-box {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 10px 12px;
            border-radius: 3px;
            margin: 15px 0;
            font-size: 12px;
            color: #856404;
        }
        .footer {
            position: absolute;
            bottom: 10px;
            left: 50px;
            right: 50px;
            font-size: 8px;
            color: #666;
            text-align: center;
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
                <div style="font-size: 12px; margin-top: 4px;">SIRET: ${companyInfo.siret || ''}</div>
            </div>
            <div class="header-right">
                <div style="font-weight: bold; margin-bottom: 4px;">${clientName}</div>
                <div style="white-space: pre-line; font-size: 12px; line-height: 1.5;">${clientAddress}</div>
            </div>
        </div>

        <div class="invoice-details">
            <h2 class="invoice-number">${quoteNumber}</h2>
            <div style="font-size: 13px;">
                <div>Date d'émission: ${formatDateFR(quoteDate)}</div>
                <div>Valide jusqu'au: ${formatDateFR(validityDate)}</div>
            </div>
        </div>

        <hr class="separator">

        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th style="text-align: center;">Quantité</th>
                    <th style="text-align: right;">Prix unitaire HT</th>
                    <th style="text-align: right;">Total HT</th>
                </tr>
            </thead>
            <tbody>
                ${quoteItems.map(item => `
                    <tr>
                        <td>${item.description || ''}</td>
                        <td style="text-align: center;">${item.quantity || 0}</td>
                        <td style="text-align: right;">${formatNumber(parseFloat(item.unitPrice || 0))} €</td>
                        <td style="text-align: right;">${formatNumber((item.total || 0))} €</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="totals">
            <div style="margin-bottom: 6px;">Total HT: ${formatNumber(totalHT)} €</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 6px;">TVA non applicable (art. 293 B du CGI)</div>
            <div style="font-weight: bold; font-size: 18px; margin-top: 12px; color: #21808D;">Total TTC: ${formatNumber(totalHT)} €</div>
        </div>

        <div class="warning-box">
            <strong>⚠️ Bon pour accord:</strong> Ce devis est valable jusqu'au ${formatDateFR(validityDate)}. Une fois signé, il a valeur de contrat.
        </div>

        <div class="legal">
            <p><strong>Conditions de validité:</strong> Ce devis est valable ${Math.ceil((new Date(validityDate) - new Date(quoteDate)) / (1000 * 60 * 60 * 24))} jours à compter de la date d'émission | <strong>Conditions de paiement:</strong> À définir après acceptation</p>
            <p><strong>Mentions légales:</strong> ${companyInfo.name} | SIRET: ${companyInfo.siret || ''} | TVA non applicable (art. 293 B du CGI) | Dispensé d'immatriculation au RCS et au RM (micro-entreprise)</p>
            ${(companyInfo.iban || companyInfo.bic) ? `<p style="margin-top: 6px;">${companyInfo.iban ? `<strong>IBAN:</strong> ${companyInfo.iban}` : ''}${companyInfo.iban && companyInfo.bic ? ' | ' : ''}${companyInfo.bic ? `<strong>BIC:</strong> ${companyInfo.bic}` : ''}</p>` : ''}
        </div>
        <div class="footer">
            <div>${companyInfo.name} - SIRET: ${companyInfo.siret || ''}</div>
            <div>${companyInfo.email} - ${companyInfo.phone}</div>
            <div>${companyInfo.website || 'www.mticonsulting.fr'}</div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Génère un PDF pour un devis (Base64)
 */
async function generateQuotePDFBase64(quote) {
    // Helper: fetch image as data URI
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
    
    if (!window.jspdf) {
        throw new Error('jsPDF manquant - impossible de générer le PDF');
    }
    
    // Construire le HTML du devis
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = 'auto';
    tempContainer.style.padding = '0';
    
    // Essayer de charger le logo
    let originalLogo = companyInfo.logoUrl;
    let logoDataUri = null;
    try {
        const logoSrc = companyInfo.logoUrl && !companyInfo.logoUrl.includes('github') 
            ? companyInfo.logoUrl 
            : 'assets/images/MTI_CONSULTING.png';
        logoDataUri = await fetchImageAsDataUri(logoSrc);
        if (logoDataUri) companyInfo.logoUrl = logoDataUri;
    } catch (e) {
        console.warn('Could not inline logo', e);
    }
    
    try {
        tempContainer.innerHTML = buildQuoteHtml({
            clientName: quote.client || '',
            clientAddress: quote.clientAddress || '',
            quoteNumber: quote.number || '',
            quoteDate: quote.date || '',
            validityDate: quote.validityDate || '',
            items: quote.items || []
        });
    } finally {
        companyInfo.logoUrl = originalLogo;
    }
    
    document.body.appendChild(tempContainer);

    // Utiliser html2canvas si disponible pour meilleure qualité
    if (window.html2canvas && window.jspdf) {
        try {
            const { jsPDF } = window.jspdf;
            const pdfDoc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdfDoc.internal.pageSize.getWidth();
            const pageHeight = pdfDoc.internal.pageSize.getHeight();
            
            const a4WidthPx = 794;
            const a4HeightPx = 1123;
            tempContainer.style.width = a4WidthPx + 'px';
            tempContainer.style.height = a4HeightPx + 'px';

            const canvasScale = 2.0;
            const canvas = await html2canvas(tempContainer, { 
                scale: canvasScale, 
                useCORS: true, 
                backgroundColor: '#ffffff' 
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.85);

            pdfDoc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
            
            const dataUri = pdfDoc.output('datauristring');
            try { document.body.removeChild(tempContainer); } catch(e) {}
            return dataUri.split(',')[1];
        } catch (err) {
            console.warn('html2canvas/pdf path failed, falling back to legacy jsPDF:', err);
            try { document.body.removeChild(tempContainer); } catch(e) {}
        }
    } else {
        try { document.body.removeChild(tempContainer); } catch(e) {}
    }

    // Fallback: utiliser jsPDF autoTable
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Logo
    if (companyInfo.logoUrl) {
        try {
            const imgToUse = logoDataUri || companyInfo.logoUrl;
            if (imgToUse) {
                try { doc.addImage(imgToUse, 'PNG', 20, 20, 30, 30); } catch(e) { /* ignore */ }
            }
        } catch(e) { /* ignore */ }
    }

    // En-tête
    doc.setFontSize(20);
    doc.setTextColor(0, 102, 204); // Bleu
    doc.text(companyInfo.name, 60, 30);
    doc.setTextColor(0, 0, 0); // Reset noir
    doc.setFontSize(10);
    doc.text(companyInfo.address, 60, 37);
    doc.text(`${companyInfo.postalCode} ${companyInfo.city}`, 60, 42);
    doc.text(`SIRET : ${companyInfo.siret}`, 60, 47);

    // Titre
    doc.setFontSize(18);
    doc.setTextColor(33, 128, 141); // #21808D
    doc.text(`DEVIS ${quote.number}`, 20, 70);
    doc.setTextColor(0, 0, 0);

    // Client
    doc.setFontSize(10);
    doc.text('Client :', 20, 85);
    doc.text(quote.client, 20, 90);
    if (quote.clientSiret) doc.text(`SIRET : ${quote.clientSiret}`, 20, 95);

    // Dates
    doc.text(`Date d'émission : ${formatDateFR(quote.date)}`, 120, 85);
    doc.text(`Valide jusqu'au : ${formatDateFR(quote.validityDate)}`, 120, 90);

    // Tableau multi-lignes
    if (doc.autoTable) {
        const tableBody = quote.items && quote.items.length > 0
            ? quote.items.map(item => [
                item.description || '',
                (item.quantity || 0).toString(),
                `${formatNumber((item.unitPrice || 0))} €`,
                `${formatNumber(((item.quantity || 0) * (item.unitPrice || 0)))} €`
            ])
            : [];
        
        doc.autoTable({
            startY: 120,
            head: [['Description', 'Quantité', 'Prix unitaire HT', 'Total HT']],
            body: tableBody,
            colWidth: [85, 25, 35, 35],
            margin: { top: 10, right: 20, bottom: 50, left: 20 },
            headStyles: { fillColor: [33, 128, 141] },
            styles: { fontSize: 10 },
            columnStyles: {
                0: { cellWidth: 85 },    // Description
                1: { cellWidth: 25 },    // Quantité
                2: { cellWidth: 35 },    // Prix unitaire
                3: { cellWidth: 35 }     // Total HT
            }
        });
    }

    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 160;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Total HT : ${formatNumber((quote.total || 0))} €`, 120, finalY);
    doc.setFont(undefined, 'normal');
    
    doc.setFontSize(9);
    doc.text(`TVA non applicable (art. 293 B du CGI)`, 120, finalY + 7);

    // Mention légale
    doc.setFontSize(9);
    doc.setTextColor(200, 100, 0);
    doc.text(`⚠️ Bon pour accord - Valable jusqu'au ${formatDateFR(quote.validityDate)}`, 20, finalY + 20);
    doc.setTextColor(0, 0, 0);

    // Footer en bas de page (Y=270 pour marge sûre avant limite 297mm A4)
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    const footerY = 270;
    doc.text(`${companyInfo.name} - SIRET: ${companyInfo.siret}`, 105, footerY, { align: 'center' });
    doc.text(`${companyInfo.email} - ${companyInfo.phone}`, 105, footerY + 4, { align: 'center' });
    doc.text(`${companyInfo.website || 'www.mticonsulting.fr'}`, 105, footerY + 8, { align: 'center' });

    return doc.output('datauristring').split(',')[1];
}

/**
 * Télécharge le PDF d'un devis
 */
async function downloadQuotePDF(index) {
    const quote = quotes[index];
    if (!quote) {
        showToast('❌ Devis introuvable', 'error');
        return;
    }
    
    if (!window.jspdf) {
        showToast('❌ jsPDF manquant - impossible de générer le PDF', 'error');
        return;
    }
    // Validations bloquantes (cohérentes avec factures)
    if (!quote.client || !quote.clientAddress) {
        showToast('❌ Client ou adresse manquants pour ce devis', 'error');
        return;
    }
    const items = (quote.items && quote.items.length > 0) ? quote.items : [];
    if (items.length === 0 || items.some(i => !i.description || i.description.trim() === '')) {
        showToast('❌ Lignes de devis manquantes ou incomplètes', 'error');
        return;
    }
    if (!quote.total || quote.total <= 0) {
        showToast('❌ Montant total du devis invalide', 'error');
        return;
    }
    if (!quote.date || !quote.validityDate) {
        showToast('❌ Dates du devis incomplètes (émission/validité)', 'error');
        return;
    }
    
    try {
        showToast('⏳ Génération du PDF et sauvegarde sur Drive...', 'info');
        const pdfBase64 = await generateQuotePDFBase64(quote);
        // Nom de fichier cohérent : Devis_NUMERO_CLIENT.pdf (sans préfixe redondant)
        const safeQuoteNum2 = String(quote.number || Date.now()).replace(/^(DEVIS|DEVI|Devis)[-_ ]?/i, '');
        const filename = `Devis_${safeQuoteNum2}_${quote.client.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        const saveRes = await callBackend('savePdfToDrive', {
            pdfBase64,
            pdfFilename: filename,
            folderName: 'Devis'
        });
        if (!saveRes || !saveRes.success) {
            showToast('❌ Erreur sauvegarde sur Drive', 'error');
            return;
        }
        showToast('✅ PDF Devis sauvegardé sur Drive !', 'success');
        // Ouvre la prévisualisation Drive
        if (saveRes.data && saveRes.data.previewUrl) {
            window.open(saveRes.data.previewUrl, '_blank');
        }
    } catch (error) {
        console.error('Erreur génération/sauvegarde PDF:', error);
        showToast('❌ Erreur lors de la génération ou sauvegarde du PDF: ' + error.message, 'error');
    }
}

/**
 * Génère le corps du mail pour un devis
 */
function generateQuoteEmailBody(quote, client) {
    const contactName = client.contact_name || client.name;
    return `Bonjour ${contactName},

Veuillez trouver ci-joint le devis n°${quote.number} d'un montant de ${formatNumber((quote.total || 0))} € HT.

Date d'émission : ${formatDateFR(quote.date)}
Date de validité : ${formatDateFR(quote.validityDate)}

Ce devis en attente de votre accord constitue une offre ferme et précise.

Cordialement,
Mickaël TOURDOT-IGUEDJETAL
MTI CONSULTING
Téléphone : +33 7 56 98 99 59
Mail : contact@mticonsulting.fr
Web : www.mticonsulting.fr`;
}

/**
 * Affiche un aperçu du mail avant envoi
 */
// Store current quote index for email sending from modal
let currentQuoteIndexForEmail = null;

function showQuoteEmailPreview(index) {
    const quote = quotes[index];
    if (!quote) {
        showToast('❌ Devis introuvable', 'error');
        return;
    }
    
    const client = clients.find(c => c.name === quote.client);
    if (!client) {
        showToast('❌ Client introuvable', 'error');
        return;
    }
    
    // Store current quote index for sending
    currentQuoteIndexForEmail = index;
    
    const hasEmail = client && client.email_facturation && client.email_facturation.trim() !== '';
    const emailTo = hasEmail ? client.email_facturation : '';
    
    // Construire le contenu de l'email
    const subject = `${quote.number} - MTI CONSULTING`;
    const body = generateQuoteEmailBody(quote, client);
    
    // Remplir le modal réutilisable
    const emailToEl = document.getElementById('emailTo');
    const emailSubjectEl = document.getElementById('emailSubject');
    const emailBodyEl = document.getElementById('emailBody');
    
    if (emailToEl) emailToEl.textContent = emailTo || '(À compléter manuellement)';
    if (emailSubjectEl) emailSubjectEl.textContent = subject;
    if (emailBodyEl) emailBodyEl.textContent = body;
    
    // Afficher warning si pas d'email
    const warningDiv = document.getElementById('emailWarning');
    if (warningDiv) {
        if (!hasEmail) {
            warningDiv.style.display = 'block';
            warningDiv.innerHTML = '⚠️ <strong>Aucun contact email configuré pour ce devis.</strong><br>Veuillez ajouter l\'email dans la gestion des tiers.';
        } else {
            warningDiv.style.display = 'none';
        }
    }
    
    // Configurer le bouton de confirmation pour les devis
    setupQuoteEmailConfirmButton(index, hasEmail);
    
    // Afficher le modal
    const modal = document.getElementById('emailModal');
    if (modal) modal.classList.add('show');
}

function setupQuoteEmailConfirmButton(index, hasEmail) {
    const confirmEmail = document.getElementById('confirmEmail');
    if (confirmEmail) {
        // Cloner le bouton pour enlever les anciens listeners
        const newConfirm = confirmEmail.cloneNode(true);
        confirmEmail.parentNode.replaceChild(newConfirm, confirmEmail);
        
        // Désactiver si pas d'email
        if (!hasEmail) {
            newConfirm.disabled = true;
            newConfirm.style.opacity = '0.6';
            newConfirm.style.cursor = 'not-allowed';
        } else {
            newConfirm.disabled = false;
            newConfirm.style.opacity = '1';
            newConfirm.style.cursor = 'pointer';
        }
        
        // Ajouter listener pour envoi
        newConfirm.addEventListener('click', async () => {
            if (newConfirm.disabled) return;
            newConfirm.disabled = true;
            newConfirm.style.opacity = '0.6';
            const originalText = newConfirm.textContent;
            newConfirm.textContent = '⏳ Envoi en cours...';
            
            try {
                await confirmQuoteEmailSend(index);
            } finally {
                newConfirm.disabled = false;
                newConfirm.style.opacity = '1';
                newConfirm.textContent = originalText;
            }
        });
    }
}

/**
 * Confirme et envoie l'email du devis
 */
async function confirmQuoteEmailSend(index) {
    const quote = quotes[index];
    if (!quote) {
        showToast('❌ Devis introuvable', 'error');
        return;
    }
    
    const client = clients.find(c => c.name === quote.client);
    if (!client || !client.email_facturation) {
        showToast('❌ Email du client manquant', 'error');
        return;
    }
    
    try {
        showToast('⏳ Génération du PDF et envoi...', 'info');
        
        // Générer PDF
        const pdfBase64 = await generateQuotePDFBase64(quote);
        
        // Utiliser la fonction generateQuoteEmailBody pour cohérence
        const subject = `${quote.number} - MTI CONSULTING`;
        const body = generateQuoteEmailBody(quote, client);
        
        // Envoyer via backend
        const result = await callBackend('sendEmail', {
            to: client.email_facturation,
            subject: subject,
            body: body,
            pdfBase64: pdfBase64,
            pdfFilename: `${quote.number}-${quote.client.replace(/\s+/g, '_')}.pdf`
        });
        
        if (!result || !result.success) {
            throw new Error((result && (result.data || result.error)) || 'Erreur inconnue');
        }
        
        // Marquer comme envoyé
        quotes[index].status = 'Envoyé';
        await saveToDrive();
        // Sauvegarde backup localStorage
        try {
            await storageManager.saveDual('mti_quotes', quotes);
        } catch (e) {
            console.warn('Erreur sauvegarde quotes localStorage:', e);
        }
        renderQuoteList();
        try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
        
        showToast(`✅ Devis envoyé à ${client.email_facturation}`, 'success');
        
        // Fermer le modal (même méthode que pour les factures)
        const modal = document.getElementById('emailModal');
        if (modal) modal.classList.remove('show');
    } catch (error) {
        console.error('❌ Erreur envoi email:', error);
        showToast('❌ Erreur : ' + (error.message || error), 'error');
    }
}

/**
 * Envoie un devis par email avec PDF
 */
async function sendQuoteEmail(index) {
    const quote = quotes[index];
    if (!quote) {
        showToast('❌ Devis introuvable', 'error');
        return;
    }
    
    const client = clients.find(c => c.name === quote.client);
    if (!client || !client.email_facturation) {
        showToast('❌ Email du client manquant', 'error');
        return;
    }
    
    // Afficher le modal de prévisualisation
    showQuoteEmailPreview(index);
}

/**
 * Prévisualise et prépare l'envoi d'un devis depuis le formulaire
 */
async function previewAndConfirmQuoteSend() {
    const quoteNumber = document.getElementById('quoteNumber').value;
    const clientName = document.getElementById('quoteClientName').value;
    const clientSiret = document.getElementById('quoteClientSiret').value;
    const clientAddress = document.getElementById('quoteClientAddress').value;
    const quoteDate = document.getElementById('quoteDate').value;
    const validityDate = document.getElementById('quoteValidityDate').value;
    
    if (!clientName) {
        showToast('⚠️ Veuillez saisir le nom du client', 'error');
        return;
    }
    
    if (!currentQuoteItems || currentQuoteItems.length === 0) {
        showToast('⚠️ Veuillez ajouter au moins une ligne au devis', 'error');
        return;
    }
    
    // Créer l'objet devis temporaire
    const tempQuote = {
        number: quoteNumber,
        client: clientName,
        clientSiret: clientSiret,
        clientAddress: clientAddress,
        date: quoteDate,
        validityDate: validityDate,
        items: currentQuoteItems,
        total: currentQuoteItems.reduce((sum, item) => sum + (item.total || 0), 0)
    };
    
    // Trouver le client dans la liste
    const clientObj = clients.find(c => c.name === clientName) || { name: clientName, contact_name: clientName };
    
    // Préparer le contenu de l'email
    const to = clientObj.email_facturation || '';
    const subject = `${tempQuote.number} - MTI CONSULTING`;
    const body = generateQuoteEmailBody(tempQuote, clientObj);
    
    // Afficher le modal de prévisualisation
    showEmailPreviewForQuoteConfirmSend(to, subject, body, tempQuote);
}

/**
 * Affiche le modal de prévisualisation pour l'envoi d'un devis
 */
function showEmailPreviewForQuoteConfirmSend(to, subject, body, quote) {
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
            warningDiv.innerHTML = '⚠️ <strong>Aucun contact email configuré pour ce client.</strong><br>Veuillez ajouter l\'email dans la gestion des tiers.';
        } else {
            warningDiv.style.display = 'none';
        }
    }
    
    // Stocker l'index temporaire pour la confirmation
    currentQuoteIndexForEmail = -1; // -1 signifie qu'on est en création, pas en édition depuis la liste
    currentQuoteTempForEmail = quote; // Sauvegarder le devis temporaire
    
    // Configurer le bouton de confirmation
    setupQuoteEmailConfirmButtonForForm(hasEmail);
    
    // Afficher le modal
    const modal = document.getElementById('emailModal');
    if (modal) modal.classList.add('show');
}

/**
 * Configure le bouton de confirmation pour l'envoi depuis le formulaire
 */
function setupQuoteEmailConfirmButtonForForm(hasEmail) {
    const confirmEmail = document.getElementById('confirmEmail');
    if (confirmEmail) {
        // Cloner le bouton pour enlever les anciens listeners
        const newConfirm = confirmEmail.cloneNode(true);
        confirmEmail.parentNode.replaceChild(newConfirm, confirmEmail);
        
        // Désactiver si pas d'email
        if (!hasEmail) {
            newConfirm.disabled = true;
            newConfirm.style.opacity = '0.6';
            newConfirm.style.cursor = 'not-allowed';
        } else {
            newConfirm.disabled = false;
            newConfirm.style.opacity = '1';
            newConfirm.style.cursor = 'pointer';
        }
        
        // Ajouter listener pour envoi
        newConfirm.addEventListener('click', async () => {
            if (newConfirm.disabled) return;
            newConfirm.disabled = true;
            newConfirm.style.opacity = '0.6';
            const originalText = newConfirm.textContent;
            newConfirm.textContent = '⏳ Envoi en cours...';
            
            try {
                await confirmQuoteEmailSendFromForm();
            } finally {
                newConfirm.disabled = false;
                newConfirm.style.opacity = '1';
                newConfirm.textContent = originalText;
            }
        });
    }
}

/**
 * Confirme et envoie l'email du devis depuis le formulaire
 */
async function confirmQuoteEmailSendFromForm() {
    if (!currentQuoteTempForEmail) {
        showToast('❌ Devis manquant', 'error');
        return;
    }
    
    const quote = currentQuoteTempForEmail;
    const client = clients.find(c => c.name === quote.client);
    
    if (!client || !client.email_facturation) {
        showToast('❌ Email du client manquant', 'error');
        return;
    }
    
    try {
        showToast('⏳ Génération du PDF et envoi...', 'info');
        
        // Générer PDF
        const pdfBase64 = await generateQuotePDFBase64(quote);
        
        // Utiliser la fonction generateQuoteEmailBody pour cohérence
        const subject = `${quote.number} - MTI CONSULTING`;
        const body = generateQuoteEmailBody(quote, client);
        
        // Envoyer via backend
        const result = await callBackend('sendEmail', {
            to: client.email_facturation,
            subject: subject,
            body: body,
            pdfBase64: pdfBase64,
            pdfFilename: `${quote.number}-${quote.client.replace(/\s+/g, '_')}.pdf`
        });
        
        if (!result || !result.success) {
            throw new Error((result && (result.data || result.error)) || 'Erreur inconnue');
        }
        
        showToast(`✅ Devis envoyé à ${client.email_facturation}`, 'success');
        
        // Fermer le modal
        const modal = document.getElementById('emailModal');
        if (modal) modal.classList.remove('show');
        
        // Nettoyer la variable temporaire
        currentQuoteTempForEmail = null;
        
        // Rafraîchir KPIs
        try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
    } catch (error) {
        console.error('❌ Erreur envoi email:', error);
        showToast('❌ Erreur : ' + (error.message || error), 'error');
    }
}

// Variable globale pour stocker le devis temporaire en création
let currentQuoteTempForEmail = null;

/**
 * Affiche l'aperçu d'un devis
 */
function showQuotePreview() {
    const quoteNumber = document.getElementById('quoteNumber').value;
    const client = document.getElementById('quoteClientName').value;
    const clientAddress = document.getElementById('quoteClientAddress').value;
    const date = document.getElementById('quoteDate').value;
    const validityDate = document.getElementById('quoteValidityDate').value;
    
    if (!client) {
        showToast('⚠️ Veuillez saisir le nom du client', 'error');
        return;
    }
    
    // Créer l'objet devis temporaire
    const tempQuote = {
        number: quoteNumber,
        client: client,
        clientAddress: clientAddress,
        date: date,
        validityDate: validityDate,
        items: currentQuoteItems,
        total: currentQuoteItems.reduce((sum, item) => sum + (item.total || 0), 0)
    };
    
    // Utiliser le même HTML que le PDF
    const previewHTML = buildQuoteHtml({
        clientName: tempQuote.client,
        clientAddress: tempQuote.clientAddress,
        quoteNumber: tempQuote.number,
        quoteDate: tempQuote.date,
        validityDate: tempQuote.validityDate,
        items: tempQuote.items
    });
    
    // Afficher dans un modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; overflow-y: auto;';
    modal.innerHTML = `
        <div style="position: relative; background: white; border-radius: 8px; max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto;">
            <button onclick="this.closest('div').parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 18px; z-index: 10000;">×</button>
            <iframe style="width: 100%; height: 600px; border: none; border-radius: 8px;" srcdoc="${previewHTML.replace(/"/g, '&quot;')}"></iframe>
        </div>
    `;
    document.body.appendChild(modal);
}

/**
 * Convertit un devis en facture
 */
async function convertQuoteToInvoice(index) {
    const quote = quotes[index];
    if (!quote) {
        showToast('❌ Devis introuvable', 'error');
        return;
    }
    
    if (!confirm(`Convertir le devis ${quote.number} en facture ?`)) {
        return;
    }
    
    // Créer nouvelle facture depuis le devis
    const newInvoice = {
        number: getNextInvoiceNumber(),
        client: quote.client,
        clientSiret: quote.clientSiret,
        clientAddress: quote.clientAddress,
        date: new Date().toISOString().split('T')[0],
        dueDate: (() => {
            const due = new Date();
            due.setDate(due.getDate() + 30);
            return due.toISOString().split('T')[0];
        })(),
        items: [...quote.items],
        total: quote.total,
        status: 'Brouillon',
        sourceQuoteNumber: quote.number
    };
    
    invoices.push(newInvoice);
    
    // Marquer le devis comme accepté et lier la facture
    quotes[index].status = 'Accepté';
    quotes[index].linkedInvoiceNumber = newInvoice.number;
    
    await saveToDrive();
    // Sauvegarde backup IndexedDB
    try {
        await storageManager.saveDual('mti_quotes', quotes);
    } catch (e) {
        console.warn('Erreur sauvegarde quotes IndexedDB:', e);
    }
    renderInvoiceList();
    renderQuoteList();
    try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
    
    showToast(`✅ Facture ${newInvoice.number} créée depuis devis ${quote.number}`, 'success');
    
    // Basculer sur l'onglet factures
    const facturesTab = document.querySelector('[data-tab="factures"]');
    if (facturesTab) facturesTab.click();
}

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
    document.getElementById('caCumule').textContent = formatNumber(caCumule) + ' €';
    document.getElementById('caPaye').textContent = formatNumber(caPaye) + ' €';
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

    // Mettre à jour les KPI Devis → Facture au chargement
    try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs error', e); }
}

// Retourne les devis filtrés selon les mêmes critères que les factures
function getFilteredQuotes() {
    let filtered = [...quotes];

    // Period filter (identique à getFilteredInvoices)
    const periodEl = document.getElementById('periodFilter');
    const period = periodEl ? periodEl.value : 'all';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (period !== 'all') {
        filtered = filtered.filter(q => {
            const qDate = new Date(q.date);
            qDate.setHours(0, 0, 0, 0);
            if (period === 'day') return qDate.getTime() === today.getTime();
            if (period === 'week') {
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return qDate >= weekAgo && qDate <= today;
            }
            if (period === 'month') {
                return qDate.getMonth() === today.getMonth() && qDate.getFullYear() === today.getFullYear();
            }
            if (period === 'year') {
                return qDate.getFullYear() === today.getFullYear();
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
        filtered = filtered.filter(q => new Date(q.date) >= start);
    }

    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(q => new Date(q.date) <= end);
    }

    // Client filter
    const clientFilter = document.getElementById('clientFilterSelect') ? document.getElementById('clientFilterSelect').value : 'all';
    if (clientFilter !== 'all') {
        filtered = filtered.filter(q => q.client === clientFilter);
    }

    return filtered;
}

/**
 * Met à jour le dashboard d'accueil avec les chiffres clés
 */
function updateDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // CA du mois en cours
    const monthInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= startOfMonth && invDate <= today;
    });
    const monthCA = monthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    
    // Factures en attente (envoyées non payées)
    const pendingInvoices = invoices.filter(inv => 
        inv.status === 'Envoyée' && (parseFloat(inv.montantRecu) || 0) < (inv.total || 0)
    );
    const pendingAmount = pendingInvoices.reduce((sum, inv) => 
        sum + ((inv.total || 0) - (parseFloat(inv.montantRecu) || 0)), 0
    );
    
    // Dernière facture créée
    const lastInvoice = invoices.length > 0 ? invoices[invoices.length - 1] : null;
    
    // Dernier paiement reçu
    const paidInvoices = invoices.filter(inv => inv.dateReception).sort((a, b) => 
        new Date(b.dateReception) - new Date(a.dateReception)
    );
    const lastPayment = paidInvoices.length > 0 ? paidInvoices[0] : null;
    
    // Mise à jour du DOM
    const dashCAEl = document.getElementById('dashMonthCA');
    const dashPendingCountEl = document.getElementById('dashPendingCount');
    const dashPendingAmountEl = document.getElementById('dashPendingAmount');
    const dashLastInvoiceEl = document.getElementById('dashLastInvoice');
    const dashLastPaymentEl = document.getElementById('dashLastPayment');
    
    if (dashCAEl) dashCAEl.textContent = `${formatNumber(monthCA)} €`;
    if (dashPendingCountEl) dashPendingCountEl.textContent = pendingInvoices.length;
    if (dashPendingAmountEl) dashPendingAmountEl.textContent = `${formatNumber(pendingAmount)} €`;
    
    if (dashLastInvoiceEl) {
        if (lastInvoice) {
            dashLastInvoiceEl.innerHTML = `<strong>${lastInvoice.number}</strong> - ${lastInvoice.client} (${formatDateFR(lastInvoice.date)})`;
        } else {
            dashLastInvoiceEl.textContent = 'Aucune facture';
        }
    }
    
    if (dashLastPaymentEl) {
        if (lastPayment) {
            dashLastPaymentEl.innerHTML = `<strong>${lastPayment.number}</strong> - ${formatNumber((parseFloat(lastPayment.montantRecu) || 0))} € (${formatDateFR(lastPayment.dateReception)})`;
        } else {
            dashLastPaymentEl.textContent = 'Aucun paiement';
        }
    }
}

/**
 * Met à jour les alertes intelligentes
 */
function updateAlerts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    
    const alerts = [];
    
    // Factures en retard (>30j)
    const overdueInvoices = invoices.filter(inv => {
        if (inv.status !== 'Envoyée') return false;
        const dueDate = new Date(inv.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        return daysDiff > 30;
    });
    
    if (overdueInvoices.length > 0) {
        const total = overdueInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        alerts.push({
            type: 'error',
            icon: '🔴',
            message: `${overdueInvoices.length} facture(s) en retard (+30j) - ${formatNumber(total)} €`,
            action: () => {
                document.getElementById('statusFilter').value = 'Retard';
                applyFilters();
            }
        });
    }
    
    // Factures proches échéance (<7j)
    const soonDueInvoices = invoices.filter(inv => {
        if (inv.status !== 'Envoyée') return false;
        const dueDate = new Date(inv.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate >= today && dueDate <= in7Days;
    });
    
    if (soonDueInvoices.length > 0) {
        const total = soonDueInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        alerts.push({
            type: 'warning',
            icon: '🟠',
            message: `${soonDueInvoices.length} facture(s) échéance <7j - ${formatNumber(total)} €`,
            action: null
        });
    }
    
    // Devis expirés non convertis
    const expiredQuotes = quotes.filter(q => {
        if (q.linkedInvoiceNumber) return false;
        const validityDate = new Date(q.validityDate);
        validityDate.setHours(0, 0, 0, 0);
        return validityDate < today;
    });
    
    if (expiredQuotes.length > 0) {
        const total = expiredQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
        alerts.push({
            type: 'info',
            icon: '🟡',
            message: `${expiredQuotes.length} devis expiré(s) non converti(s) - ${formatNumber(total)} €`,
            action: null
        });
    }
    
    // Objectif CA mensuel personnalisé
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= startOfMonth && invDate <= today;
    });
    const monthCA = monthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    
    // CA annuel (année en cours)
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const yearInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= startOfYear && invDate <= today;
    });
    const yearCA = yearInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    
    const objectif = taxSettings.objectifCAMensuel || 6000;
    const seuilTVAAnnuel = taxSettings.seuilTVAAnnuel || 37500;
    const seuilMicroAnnuel = taxSettings.caMaxBNC || 77700;
    
    // Calculer les pourcentages pour les barres de progression
    const progressObjectif = Math.min(((monthCA / objectif) * 100), 100);
    const progressTVA = Math.min(((yearCA / seuilTVAAnnuel) * 100), 100);
    const progressMicro = Math.min(((yearCA / seuilMicroAnnuel) * 100), 100);
    
    // Alerte Objectif Personnel avec barre de progression
    if (monthCA >= objectif) {
        const overProgress = ((monthCA / objectif) * 100).toFixed(0);
        alerts.push({
            type: 'success',
            icon: '🎯',
            message: `Objectif CA mensuel atteint : ${monthCA.toFixed(0)} € (${overProgress}% de ${objectif.toFixed(0)}€)`,
            action: null,
            progress: 100,
            progressColor: '#22c55e',
            subtitle: `🎉 Félicitations ! Vous avez dépassé votre objectif de ${(monthCA - objectif).toFixed(0)}€`
        });
    } else if (monthCA >= objectif * 0.8) {
        const nearProgress = ((monthCA / objectif) * 100).toFixed(0);
        const remaining = objectif - monthCA;
        alerts.push({
            type: 'info',
            icon: '🎯',
            message: `Proche de l'objectif : ${monthCA.toFixed(0)} € (${nearProgress}%)`,
            action: null,
            progress: progressObjectif,
            progressColor: '#3b82f6',
            subtitle: `Plus que ${remaining.toFixed(0)}€ pour atteindre votre objectif de ${objectif.toFixed(0)}€`
        });
    }
    
    // Alertes seuils fiscaux ANNUELS avec barres de progression
    if (yearCA >= seuilMicroAnnuel * 0.9) {
        const microPercent = ((yearCA / seuilMicroAnnuel) * 100).toFixed(0);
        const remaining = seuilMicroAnnuel - yearCA;
        const isOver = yearCA >= seuilMicroAnnuel;
        alerts.push({
            type: isOver ? 'error' : 'warning',
            icon: isOver ? '🚨' : '⚠️',
            message: `Seuil Micro-BNC annuel : ${yearCA.toFixed(0)} € / ${seuilMicroAnnuel.toFixed(0)} € (${microPercent}%)`,
            action: null,
            progress: progressMicro,
            progressColor: isOver ? '#dc2626' : '#f59e0b',
            subtitle: isOver 
                ? `🚨 Dépassement de ${(yearCA - seuilMicroAnnuel).toFixed(0)}€ ! Consultez votre comptable`
                : `⚡ Plus que ${remaining.toFixed(0)}€ avant le plafond (CA cumulé ${today.getFullYear()})`
        });
    } else if (yearCA >= seuilTVAAnnuel * 0.9) {
        const tvaPercent = ((yearCA / seuilTVAAnnuel) * 100).toFixed(0);
        const remaining = seuilTVAAnnuel - yearCA;
        const isOver = yearCA >= seuilTVAAnnuel;
        alerts.push({
            type: isOver ? 'warning' : 'info',
            icon: isOver ? '⚡' : 'ℹ️',
            message: `Seuil TVA annuel : ${yearCA.toFixed(0)} € / ${seuilTVAAnnuel.toFixed(0)} € (${tvaPercent}%)`,
            action: null,
            progress: progressTVA,
            progressColor: isOver ? '#f59e0b' : '#3b82f6',
            subtitle: isOver
                ? `⚠️ Dépassement de ${(yearCA - seuilTVAAnnuel).toFixed(0)}€ - Anticipez la franchise TVA`
                : `📊 Plus que ${remaining.toFixed(0)}€ avant le seuil (CA cumulé ${today.getFullYear()})`
        });
    }
    
    // Affichage des alertes
    const alertsContainer = document.getElementById('alertsContainer');
    if (!alertsContainer) return;
    
    if (alerts.length === 0) {
        alertsContainer.innerHTML = `
            <div style="
                text-align: center; 
                padding: var(--space-24);
                background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
                border-radius: var(--radius-lg);
                border: 2px dashed rgba(34, 197, 94, 0.3);
            ">
                <div style="font-size: 48px; margin-bottom: var(--space-8);">✅</div>
                <p style="color: #22c55e; font-weight: var(--font-weight-semibold); font-size: var(--font-size-base); margin: 0;">
                    Aucune alerte - Tout est sous contrôle !
                </p>
            </div>
        `;
        return;
    }
    
    alertsContainer.innerHTML = alerts.map(alert => {
        const bgColor = {
            error: 'linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)',
            warning: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
            info: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
            success: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)'
        }[alert.type];
        
        const borderColor = {
            error: '#dc2626',
            warning: '#f59e0b',
            info: '#3b82f6',
            success: '#22c55e'
        }[alert.type];
        
        const shadowColor = {
            error: 'rgba(220, 38, 38, 0.2)',
            warning: 'rgba(245, 158, 11, 0.2)',
            info: 'rgba(59, 130, 246, 0.2)',
            success: 'rgba(34, 197, 94, 0.2)'
        }[alert.type];
        
        const clickable = alert.action ? 'cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;' : '';
        const onclick = alert.action ? `onclick="(${alert.action.toString()})()"` : '';
        const hoverStyle = alert.action ? 'onmouseover="this.style.transform=\'translateY(-2px)\'; this.style.boxShadow=\'0 8px 16px ' + shadowColor + '\'" onmouseout="this.style.transform=\'translateY(0)\'; this.style.boxShadow=\'0 2px 8px ' + shadowColor + '\'"' : '';
        
        // Barre de progression si présente
        const progressBar = alert.progress !== undefined ? `
            <div style="margin-top: var(--space-12); background: rgba(255,255,255,0.5); border-radius: 999px; height: 8px; overflow: hidden; position: relative;">
                <div style="
                    width: ${alert.progress}%;
                    height: 100%;
                    background: ${alert.progressColor};
                    border-radius: 999px;
                    transition: width 1s ease-out;
                    box-shadow: 0 0 10px ${alert.progressColor};
                "></div>
            </div>
        ` : '';
        
        const subtitle = alert.subtitle ? `
            <div style="
                margin-top: var(--space-8);
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                font-style: italic;
            ">
                ${alert.subtitle}
            </div>
        ` : '';
        
        return `
            <div style="
                padding: var(--space-16);
                background: ${bgColor};
                border-left: 5px solid ${borderColor};
                border-radius: var(--radius-lg);
                margin-bottom: var(--space-12);
                box-shadow: 0 2px 8px ${shadowColor};
                ${clickable}
            " ${onclick} ${hoverStyle}>
                <div style="display: flex; align-items: flex-start; gap: var(--space-12);">
                    <div style="
                        font-size: 32px;
                        line-height: 1;
                        flex-shrink: 0;
                        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
                    ">
                        ${alert.icon}
                    </div>
                    <div style="flex: 1;">
                        <div style="
                            font-size: var(--font-size-base);
                            font-weight: var(--font-weight-semibold);
                            color: var(--color-text-primary);
                            line-height: 1.4;
                        ">
                            ${alert.message}
                        </div>
                        ${subtitle}
                        ${progressBar}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Met à jour les KPI Devis → Facture dans l'onglet Suivi (avec filtres)
function updateDevisKPIs() {
    const rateEl = document.getElementById('devisConversionRate');
    const amountMonthEl = document.getElementById('devisConvertedAmountMonth');
    const countMonthEl = document.getElementById('devisCountMonth');
    const avgDelayEl = document.getElementById('devisAvgDelay');
    if (!rateEl || !amountMonthEl || !countMonthEl || !avgDelayEl) return;

    const quotesFiltered = getFilteredQuotes();
    const invoicesAll = Array.isArray(invoices) ? invoices : [];

    const convertedQuotes = quotesFiltered.filter(q => !!q.linkedInvoiceNumber);

    const conversionRate = quotesFiltered.length > 0 ? (convertedQuotes.length / quotesFiltered.length) * 100 : 0;
    rateEl.textContent = `${conversionRate.toFixed(0)}%`;

    // Montant des devis filtrés
    const quotesAmount = quotesFiltered.reduce((sum, q) => sum + (q.total || 0), 0);
    amountMonthEl.textContent = `${formatNumber(quotesAmount)} €`;

    countMonthEl.textContent = `${quotesFiltered.length}`;

    const delays = convertedQuotes.map(q => {
        const inv = invoicesAll.find(i => i.number === q.linkedInvoiceNumber);
        if (!inv) return null;
        const dq = new Date(q.date);
        const di = new Date(inv.date);
        if (isNaN(dq) || isNaN(di)) return null;
        const diffDays = Math.max(0, Math.round((di - dq) / (1000 * 60 * 60 * 24)));
        return diffDays;
    }).filter(v => v !== null);
    const avgDelay = delays.length > 0 ? (delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
    avgDelayEl.textContent = `${avgDelay.toFixed(1)} j`;
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
                <td style="text-align: right; font-weight: var(--font-weight-semibold);">${formatNumber(parseFloat(template.total || 0))} €</td>
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



