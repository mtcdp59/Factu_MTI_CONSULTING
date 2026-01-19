import {STORAGE_DATA_KEYS, STORAGE_META_KEYS_TO_KEEP} from "./config.js";

export const storageManager = {
    mode: 'indexeddb',
    backupEnabled: true, // Backup localStorage activé par sécurité
    memCache: new Map(), // Cache mémoire pour optimiser les lectures

    // Initialiser localforage et choisir le mode
    init() {
        this.mode = 'indexeddb';
        this.backupEnabled = true; // Backup localStorage activé par sécurité
        this.memCache.clear(); // Reset cache

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
        // Vérifier cache mémoire d'abord
        if (this.memCache.has(key)) {
            return this.memCache.get(key);
        }

        try {
            let data;
            if (this.isIndexedDB() && typeof localforage !== 'undefined') {
                data = await localforage.getItem(key);
            } else {
                const raw = localStorage.getItem(key);
                data = raw ? JSON.parse(raw) : null;
            }

            // Mettre en cache
            if (data !== null && data !== undefined) {
                this.memCache.set(key, data);
            }
            return data;
        } catch (e) {
            if (this.isIndexedDB()) this.switchToLocalStorage(e.toString());
            console.error(`Error reading ${key}:`, e);
            return null;
        }
    },

    // Écrire une clé (async)
    async setItem(key, value) {
        // Invalider cache
        this.memCache.delete(key);

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
        // Invalider cache
        this.memCache.delete(key);

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
                        this.memCache.delete(key); // Invalider cache
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

// Sauvegarder en batch factures, devis, RAM et clients en une seule opération
// TODO: STORAGE
export async function batchSaveAllData() {
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

// Obtenir l'état du stockage (barre de statut UI)
export async function getStorageStatus() {
    const stats = await storageManager.getStorageStats();
    const mode = storageManager.isIndexedDB() ? 'IndexedDB' : 'localStorage';
    return `Storage (${mode}): ${stats.used} / ${stats.available} (${stats.percentage})`;
}

// Export/import manuel (backup JSON local)
export async function exportLocalBackup(compress = true) {
    return storageManager.exportSnapshot(STORAGE_DATA_KEYS, { compress });
}

export async function importLocalBackup(serialized, options = {}) {
    return storageManager.importSnapshot(serialized, options);
}

// Sauvegarder les factures (stockage principal, backup optionnel)
export async function saveInvoicesToStorage(invoicesData) {
    await storageManager.saveDual('mti_invoices', invoicesData);
}

// Charger les factures (avec repli)
export async function loadInvoicesFromStorage() {
    return await storageManager.loadDual('mti_invoices');
}

// Sauvegarder les devis (stockage principal, backup optionnel)
export async function saveQuotesToStorage(quotesData) {
    await storageManager.saveDual('mti_quotes', quotesData);
}

// Charger les devis
export async function loadQuotesFromStorage() {
    return await storageManager.loadDual('mti_quotes');
}

// Sauvegarder les RAMs (stockage principal, backup optionnel)
export async function saveRAMsToStorage(ramsData) {
    await storageManager.saveDual('mti_rams', ramsData);
}

// Charger les RAMs
export async function loadRAMsFromStorage() {
    return await storageManager.loadDual('mti_rams');
}

// Sauvegarder les clients (stockage principal, backup optionnel)
export async function saveClientsToStorage(clientsData) {
    await storageManager.saveDual('mti_clients', clientsData);
}

// Charger les clients
export async function loadClientsFromStorage() {
    return await storageManager.loadDual('mti_clients');
}

// Charger la configuration depuis IndexedDB/localStorage (pour GitHub Pages) ou window.CONFIG (pour fichier local)
export async function loadConfigFromStorage() {
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
export async function saveConfigToStorage(config) {
    try {
        await storageManager.saveDual('mti_app_config', config);
        console.log('✅ Configuration sauvegardée (IndexedDB prioritaire, backup localStorage si activé)');
    } catch (e) {
        console.error('Impossible de sauvegarder la configuration:', e);
    }
}
