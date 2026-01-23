import {
    getClients,
    getCompanyInfo,
    getInvoices,
    getIsSyncing,
    getQuotes,
    setIsSyncing,
    setQuotes,
    setSuppressSheetsSyncInterval
} from "./config.js";
import {
    callBackend,
    generateQuotePDFBase64
} from "./api.js";
import { showToast } from "./toast.js";
import { formatNumber } from "./number-utils.js";
import { formatDateFR } from "./date-utils.js";
import { updateDevisKPIs } from "./kpi.js";
import {
    getNextInvoiceNumber,
    renderInvoiceList
} from "./invoices.js";

let quotes = getQuotes();

// Variables globales devis
let currentQuoteItems = [];
let isQuoteEditMode = false;
let editingQuoteIndex = -1;

/**
 * Affiche un aperçu du mail avant envoi
 */
// Store current quote index for email sending from modal
let currentQuoteIndexForEmail = null;

// Variable globale pour stocker le devis temporaire en création
let currentQuoteTempForEmail = null;

// Exporter tous les devis vers Sheets (tolère un export vide pour effacer la feuille)
export async function exportQuotesToSheets() {
    if (getIsSyncing()) {
        alert('⏳ Une synchronisation est déjà en cours...');
        return;
    }

    const confirm = window.confirm(`Exporter ${quotes.length} devis vers Google Sheets ?\n\nCela écrasera le contenu existant de la feuille Devis.`);
    if (!confirm) return;

    setIsSyncing(true);
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
        setIsSyncing(false);
    }
}

// Nettoyer l'onglet Sheets Devis
export async function clearQuotesInSheets() {
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
export async function importQuotesFromSheets() {
    if (getIsSyncing()) {
        alert('⏳ Une synchronisation est déjà en cours...');
        return;
    }

    const confirm = window.confirm('Importer les devis depuis Google Sheets ?\n\nCela écrasera les devis locaux non sauvegardés.');
    if (!confirm) return;

    setIsSyncing(true);
    setSuppressSheetsSyncInterval(true);
    try {
        const result = await callBackend('import_quotes', { sheetId: CONFIG.SHEETS_ID });
        if (!result || result.success === false) {
            throw new Error(result?.data || 'Erreur serveur lors de l\'import');
        }

        setQuotes(result.data.quotes || []);
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
        setIsSyncing(false);
        setSuppressSheetsSyncInterval(false);
    }
}

/**
 * Génère le prochain numéro de devis
 * Format: DEVIS-YYYY-NNN
 */
export function getNextQuoteNumber(date = null) {
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
export function addQuoteItem() {
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
export function removeQuoteItem(index) {
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
export function updateQuoteItemField(index, field, value) {
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
export function renderQuoteItems() {
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
export function updateQuoteTotals() {
    const totalHT = currentQuoteItems.reduce((sum, item) => sum + (item.total || 0), 0);

    const totalHTInput = document.getElementById('quoteTotalHT');
    if (totalHTInput) totalHTInput.value = `${formatNumber(totalHT)} €`;
}

/**
 * Initialise les lignes de devis
 */
export function loadQuoteItems(items) {
    currentQuoteItems = items && items.length > 0 ? [...items] : [];
    renderQuoteItems();
}

/**
 * Vide les lignes de devis
 */
export function clearQuoteItems() {
    currentQuoteItems = [];
    renderQuoteItems();
}

/**
 * Affiche la liste des devis
 */
export function renderQuoteList() {
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
export function openQuoteByNumber(quoteNumber) {
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

/**
 * Filtre la liste des devis
 */
export function filterQuoteList() {
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

// Met à jour le statut d'un devis et rafraîchit l'UI + KPIs
export function setQuoteStatus(index, status) {
    const quote = quotes[index];
    if (!quote) return;
    quote.status = status;
    // Si accepté sans facture liée, on garde la possibilité de convertir plus tard
    renderQuoteList();
    try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
    saveToDrive();
}

/**
 * Initialise le formulaire de devis
 */
export function initQuoteForm() {
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
export function setupQuoteClientSelectListener() {
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
            const client = getClients()[parseInt(index)];
            if (nameEl) { nameEl.value = client.name; nameEl.readOnly = true; }
            if (siretEl) { siretEl.value = client.siret || ''; siretEl.readOnly = true; }
            if (addressEl) { addressEl.value = client.address || ''; addressEl.readOnly = true; }
        }
    });
}

/**
 * Sauvegarde un devis
 */
export async function saveQuote(e) {
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
export function editQuoteInForm(index) {
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
export function cancelQuoteEditMode() {
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
export function resetQuoteForm() {
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
export async function deleteQuote(index) {
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
export function buildQuoteHtml({clientName, clientAddress, quoteNumber, quoteDate, validityDate, items}) {
    const quoteItems = items && items.length > 0 ? items : [];
    const totalHT = quoteItems.reduce((sum, item) => sum + (item.total || 0), 0);

    const companyAddressLine = getCompanyInfo().address && getCompanyInfo().postalCode && getCompanyInfo().city
        ? `${getCompanyInfo().address}, ${getCompanyInfo().postalCode} ${getCompanyInfo().city}`
        : '[À compléter dans Paramètres]';

    const logoSrc = getCompanyInfo().logoUrl && getCompanyInfo().logoUrl.startsWith('data:')
        ? getCompanyInfo().logoUrl
        : '../assets/images/MTI_CONSULTING.png';
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
                <div class="company">${getCompanyInfo().name}</div>
                <div style="font-size: 12px; line-height: 1.5; margin-top: 4px;">${companyAddressLine}</div>
                <div style="font-size: 12px; margin-top: 4px;">SIRET: ${getCompanyInfo().siret || ''}</div>
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
            <p><strong>Mentions légales:</strong> ${getCompanyInfo().name} | SIRET: ${getCompanyInfo().siret || ''} | TVA non applicable (art. 293 B du CGI) | Dispensé d'immatriculation au RCS et au RM (micro-entreprise)</p>
            ${(getCompanyInfo().iban || getCompanyInfo().bic) ? `<p style="margin-top: 6px;">${getCompanyInfo().iban ? `<strong>IBAN:</strong> ${getCompanyInfo().iban}` : ''}${getCompanyInfo().iban && getCompanyInfo().bic ? ' | ' : ''}${getCompanyInfo().bic ? `<strong>BIC:</strong> ${getCompanyInfo().bic}` : ''}</p>` : ''}
        </div>
        <div class="footer">
            <div>${getCompanyInfo().name} - SIRET: ${getCompanyInfo().siret || ''}</div>
            <div>${getCompanyInfo().email} - ${getCompanyInfo().phone}</div>
            <div>${getCompanyInfo().website || 'www.mticonsulting.fr'}</div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Télécharge le PDF d'un devis
 */
export async function downloadQuotePDF(index) {
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
export function generateQuoteEmailBody(quote, client) {
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

export function showQuoteEmailPreview(index) {
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

export function setupQuoteEmailConfirmButton(index, hasEmail) {
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
export async function confirmQuoteEmailSend(index) {
    const quote = quotes[index];
    if (!quote) {
        showToast('❌ Devis introuvable', 'error');
        return;
    }

    const client = getClients().find(c => c.name === quote.client);
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
export async function sendQuoteEmail(index) {
    const quote = quotes[index];
    if (!quote) {
        showToast('❌ Devis introuvable', 'error');
        return;
    }

    const client = getClients().find(c => c.name === quote.client);
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
export async function previewAndConfirmQuoteSend() {
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
    const clientObj = getClients().find(c => c.name === clientName) || { name: clientName, contact_name: clientName };

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
export function showEmailPreviewForQuoteConfirmSend(to, subject, body, quote) {
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
export function setupQuoteEmailConfirmButtonForForm(hasEmail) {
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
export async function confirmQuoteEmailSendFromForm() {
    if (!currentQuoteTempForEmail) {
        showToast('❌ Devis manquant', 'error');
        return;
    }

    const quote = currentQuoteTempForEmail;
    const client = getClients().find(c => c.name === quote.client);

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

/**
 * Affiche l'aperçu d'un devis
 */
export function showQuotePreview() {
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
export async function convertQuoteToInvoice(index) {
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

    getInvoices().push(newInvoice);

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

// Retourne les devis filtrés selon les mêmes critères que les factures
export function getFilteredQuotes() {
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

// Change invoice/quote status by clicking badge
export function changeStatusFromBadge(statusBadge, dataType, index, currentStatus) {
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