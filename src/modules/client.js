import {
    getClients,
    getInvoices,
    setClients,
    setInvoices,
    setSuppressSheetsSyncInterval
} from "./config.js";
import { formatNumber } from "./number-utils.js";
import { showToast } from "./toast.js";
import { showConfirmation } from "./modal.js";
import { callBackend } from "./api.js";

// TIERS - Client Management
export function renderClientsTable() {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    getClients().forEach((client, index) => {
        const clientInvoices = getInvoices().filter(inv => inv.client === client.name);
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

export function populateClientSelects() {
    const clientSelect = document.getElementById('clientSelect');
    const clientFilterSelect = document.getElementById('clientFilterSelect');
    const quoteClientSelect = document.getElementById('quoteClientSelect');
    const ramClientSelect = document.getElementById('ramClientSelect');

    if (clientSelect) {
        clientSelect.innerHTML = '<option value="">Saisie manuelle</option>';
        getClients().forEach((client, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = client.name;
            clientSelect.appendChild(option);
        });
    }

    if (quoteClientSelect) {
        quoteClientSelect.innerHTML = '<option value="">Saisie manuelle</option>';
        getClients().forEach((client, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = client.name;
            quoteClientSelect.appendChild(option);
        });
    }

    if (ramClientSelect) {
        ramClientSelect.innerHTML = '<option value="">Saisie manuelle</option>';
        getClients().forEach((client, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = client.name;
            ramClientSelect.appendChild(option);
        });
    }

    if (clientFilterSelect) {
        clientFilterSelect.innerHTML = '<option value="all">Tous les clients</option>';
        getClients().forEach((client) => {
            const option = document.createElement('option');
            option.value = client.name;
            option.textContent = client.name;
            clientFilterSelect.appendChild(option);
        });
    }
}

// Client select change
export function setupClientSelectListener() {
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
            const client = getClients()[parseInt(index)];
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
export function setupRAMClientSelectListener() {
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
            const client = getClients()[parseInt(index)];
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
export function setupClientFormHandlers() {
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
                getClients().push(client);
            } else {
                getClients()[index] = client;
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

export function editClient(index) {
    const client = getClients()[index];
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

export function deleteClient(index) {
    const client = getClients()[index];
    const clientInvoices = getInvoices().filter(inv => inv.client === client.name);

    let message = `Voulez-vous vraiment supprimer le client "${client.name}" ?`;
    if (clientInvoices.length > 0) {
        message = `Attention : Ce client a ${clientInvoices.length} facture(s) associée(s).\n\nSupprimer quand même ?`;
    }

    showConfirmation(
        'Supprimer le client',
        message,
        () => {
            getClients().splice(index, 1);
            // Remove invoices for this client
            const removedInvoicesCount = getInvoices().filter(inv => inv.client === client.name).length;
            if (removedInvoicesCount > 0) {
                setInvoices(getInvoices().filter(inv => inv.client !== client.name));
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

// ==========================================
// SYNC TIERS GOOGLE SHEETS
// ==========================================

// Importer clients depuis Sheets
export async function importClientsFromSheets() {
    const btn = document.getElementById('importClientsBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Import...';
    }

    setSuppressSheetsSyncInterval(true);
    try {
        const result = await callBackend('importClients', { sheetId: CONFIG.SHEETS_ID });
        if (!result || result.success === false) throw new Error((result && result.data) ? result.data : 'Erreur serveur lors de l\'import');
        const payload = result.data || {};
        setClients(payload.clients || []);
        await saveToDrive({ skipSheetsSync: true });
        renderClientsTable();
        populateClientSelects();
        alert(`✅ ${getClients().length} clients importés`);
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
        setSuppressSheetsSyncInterval(false);
    }
}

// Exporter clients vers Sheets
export async function exportClientsToSheets() {
    const btn = document.getElementById('exportClientsBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Export...';
    }

    try {
        // Note: Le backend Google Apps Script doit gérer les colonnes enrichies :
        // name, siret, address, email_facturation, contact_name, naf, categorie_juridique, etat_administratif, type_siege
        const clients = getClients();
        const result = await callBackend('exportClients', { sheetId: CONFIG.SHEETS_ID, clients });
        if (!result || result.success === false) throw new Error((result && result.data) ? result.data : 'Erreur serveur lors de l\'export');
        const count = Array.isArray(getClients()) ? getClients().length : 0;
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
export async function clearClientsInSheets() {
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