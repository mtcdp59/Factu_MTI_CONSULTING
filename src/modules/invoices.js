import {
    callBackend,
    callBackendJSONP,
    generateInvoicePDFBase64
} from "./api.js";
import { showToast } from "./toast.js";
import {
    getClients,
    getCompanyInfo,
    getCurrentInvoiceItems,
    getCurrentInvoiceSourceQuoteNumber,
    getDueDateInput,
    getEditingInvoiceNumberInput,
    getEditMode,
    getInvoiceDateInput,
    getInvoiceForm,
    getInvoiceNumberInput,
    getInvoices,
    getQuantityInput, getRams,
    getRecurringInvoices,
    getSubmittingInvoice,
    getUnitPriceInput,
    setCurrentInvoiceData,
    setCurrentInvoiceItems,
    setCurrentInvoiceSourceQuoteNumber,
    setEditingInvoiceNumberInput,
    setEditMode,
    setInvoices,
    setSubmittingInvoice,
    setSuppressSheetsSyncInterval
} from "./config.js";
import { showBackendRawResponse } from "./debug.js";
import { formatNumber } from "./number-utils.js";
import {
    calculateNextDate,
    formatDateFR,
    setDefaultDates
} from "./date-utils.js";
import { calculateTotal } from "./calculations.js";
import { autoSync } from "./sync.js";
import {
    openGmailComposeWithPDF,
    showEmailPreview,
    generateEmailBody,
    showEmailPreviewForConfirmSend,
    sendRelanceFromList
} from "./mail.js";
import { applyFilters } from "./filters.js";
import { renderCharts } from "./charts.js";
import {
    updateCADisplay,
    updateCAYearOptions
} from "./revenue.js";
import { showConfirmation } from "./modal.js";
import { updateDevisKPIs } from "./kpi.js";
import { debouncedSaveToDrive } from "./drive.js";
import { changeStatusFromBadge } from "./quotes.js";

// Import invoices from Google Sheets
export async function importInvoicesFromSheets() {
    setSuppressSheetsSyncInterval(true);
    try {
        const result = await callBackend('importInvoicesFromSheets', { sheetId: CONFIG.SHEETS_ID });
        if (!result || !result.success) {
            showBackendRawResponse(result);
            throw new Error(result && result.error ? result.error : 'Erreur import factures');
        }
        if (result.data && Array.isArray(result.data.invoices)) {
            setInvoices(result.data.invoices);
            await storageManager.saveDual('mti_invoices', invoices);
            renderInvoiceList();
            showToast(`✅ ${getInvoices().length} facture(s) importée(s)`,'success');
            await saveToDrive({ skipSheetsSync: true });
        } else {
            showToast('Aucune facture importée', 'info');
        }
    } catch (err) {
        console.error('importInvoicesFromSheets error:', err);
        alert('Erreur import factures: ' + (err.message || err));
    } finally {
        setSuppressSheetsSyncInterval(false);
    }
}

// Export invoices to Google Sheets
export async function exportInvoicesToSheets() {
    try {
        const invoices = getInvoices()
        const result = await callBackend('exportInvoicesToSheets', { sheetId: CONFIG.SHEETS_ID, invoices });
        if (!result || !result.success) throw new Error(result && result.error ? result.error : 'Erreur export factures');
        showToast('✅ Export factures réussi','success');
    } catch (err) {
        console.error('exportInvoicesToSheets error:', err);
        alert('Erreur export factures: ' + (err.message || err));
    }
}

// Nettoyer l'onglet Sheets Factures
export async function clearInvoicesInSheets() {
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

// Auto-update due date and invoice number when invoice date changes
export function setupInvoiceFormListeners() {
    if (getInvoiceDateInput()) {
        getInvoiceDateInput().addEventListener('change', () => {
            const invoiceDate = new Date(getInvoiceDateInput().value);
            const dueDate = new Date(invoiceDate);
            dueDate.setDate(dueDate.getDate() + 30);
            if (getDueDateInput()) getDueDateInput().value = dueDate.toISOString().split('T')[0];

            // Update invoice number based on new date (only if not in edit mode)
            if (!getEditMode() && getInvoiceNumberInput()) {
                getInvoiceNumberInput().value = getNextInvoiceNumber(getInvoiceDateInput().value);
            }
        });
    }

    if (getQuantityInput()) {
        getQuantityInput().addEventListener('input', calculateTotal);
    }
    if (getUnitPriceInput()) {
        getUnitPriceInput().addEventListener('input', calculateTotal);
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
            if (!clientNameEl || !clientAddressEl || !getInvoiceNumberInput() || !getInvoiceDateInput() || !getDueDateInput()) {
                showToast('❌ Erreur: Éléments du formulaire introuvables', 'error');
                return;
            }

            const clientName = clientNameEl.value.trim();
            const clientAddress = clientAddressEl.value.trim();
            const invoiceNumber = getInvoiceNumberInput().value.trim();
            const invoiceDate = getInvoiceDateInput().value;
            const dueDate = getDueDateInput().value;

            // Récupérer les items (multi-ligne) depuis currentInvoiceItems
            const items = getCurrentInvoiceItems();

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

            const companyAddressLine = getCompanyInfo().address && getCompanyInfo().postalCode && getCompanyInfo().city
                ? `${getCompanyInfo().address}\n${getCompanyInfo().postalCode} ${getCompanyInfo().city}`
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
            const logoSrc = getCompanyInfo().logoUrl && (getCompanyInfo().logoUrl.startsWith('data:') || !getCompanyInfo().logoUrl.includes('github'))
                ? getCompanyInfo().logoUrl
                : 'MTI_CONSULTING.png';
            const logoHTML = logoSrc
                ? `<img src="${logoSrc}" alt="Logo" style="max-width: 150px; max-height: 80px; object-fit: contain; margin-bottom: var(--space-12);" crossorigin="anonymous">`
                : '';

            const previewHTML = `
                <div class="invoice-header">
                    <div class="invoice-header-left">
                        ${logoHTML}
                        <div class="invoice-company">${getCompanyInfo().name}</div>
                        <div style="white-space: pre-line; font-size: 12px; line-height: 1.5; margin-top: 4px;">${companyAddressLine}</div>
                        <div style="font-size: 12px; margin-top: 4px;">SIRET: ${getCompanyInfo().siret}</div>
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

// Initialize invoice number with new format YYYYMM-NNN
export function getNextInvoiceNumber(date = null) {
    const invoiceDate = date ? new Date(date) : new Date();
    const year = invoiceDate.getFullYear();
    const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}${month}`;

    // Find all invoices for this year-month
    const sameMonthInvoices = getInvoices().filter(inv => {
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

export function addInvoiceItem() {
    const item = {
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0
    };
    getCurrentInvoiceItems().push(item);
    renderInvoiceItems();
}

export function removeInvoiceItem(index) {
    getCurrentInvoiceItems().splice(index, 1);
    renderInvoiceItems();
    updateInvoiceTotal();
}

export function updateInvoiceItemField(index, field, value) {
    if (!getCurrentInvoiceItems()[index]) return;

    getCurrentInvoiceItems()[index][field] = value;

    // Recalculate item total
    if (field === 'quantity' || field === 'unitPrice') {
        const qty = parseFloat(getCurrentInvoiceItems()[index].quantity) || 0;
        const price = parseFloat(getCurrentInvoiceItems()[index].unitPrice) || 0;
        getCurrentInvoiceItems()[index].total = qty * price;
    }

    renderInvoiceItems();
    updateInvoiceTotal();
}

export function renderInvoiceItems() {
    const tbody = document.getElementById('invoiceItemsBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (getCurrentInvoiceItems().length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 16px; text-align: center; color: var(--color-text-secondary); font-size: var(--font-size-sm);">Aucune ligne. Cliquez sur "➕ Ajouter une ligne" pour commencer.</td></tr>';
        return;
    }

    getCurrentInvoiceItems().forEach((item, index) => {
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

export function updateInvoiceTotal() {
    // Recalculate and update the invoice total display
    calculateTotal();
}

export function clearInvoiceItems() {
    setCurrentInvoiceItems([]);
    renderInvoiceItems();
    updateInvoiceTotal();
}

export function loadInvoiceItems(items) {
    setCurrentInvoiceItems(items && items.length > 0 ? [...items] : []);
    renderInvoiceItems();
    updateInvoiceTotal();
}

// Save invoice
export function setupInvoiceSaveHandler() {
    if (!getInvoiceForm()) return;
    getInvoiceForm().addEventListener('submit', (e) => {
        e.preventDefault();

        // Protection double-clic : vérifier flag global + disabled
        if (getSubmittingInvoice()) {
            console.warn('⚠️ Soumission déjà en cours, ignorée');
            return;
        }

        setSubmittingInvoice(true);

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
        if (!getCurrentInvoiceItems() || getCurrentInvoiceItems().length === 0) {
            showToast('⚠️ Veuillez ajouter au moins une ligne de facturation', 'error');
            // Réactiver le bouton
            setSubmittingInvoice(false);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.textContent = submitBtn.dataset.originalText || '💾 Créer facture';
            }
            return;
        }

        // Validate that all items have descriptions
        const hasEmptyDescription = getCurrentInvoiceItems().some(item => !item.description || item.description.trim() === '');
        if (hasEmptyDescription) {
            showToast('⚠️ Toutes les lignes doivent avoir une description', 'error');
            // Réactiver le bouton
            setSubmittingInvoice(false);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.textContent = submitBtn.dataset.originalText || '💾 Créer facture';
            }
            return;
        }

        // Calculate total from items
        const totalHT = getCurrentInvoiceItems().reduce((sum, item) => sum + (item.total || 0), 0);

        const invoiceNumber = getInvoiceNumberInput() ? getInvoiceNumberInput().value : getNextInvoiceNumber();

        // Validation : vérifier que le numéro de facture est unique (sauf en mode édition)
        if (!getEditMode()) {
            const duplicateInvoice = getInvoices().find(inv => inv.number === invoiceNumber);
            if (duplicateInvoice) {
                showToast(`❌ Le numéro de facture "${invoiceNumber}" existe déjà. Veuillez modifier le numéro.`, 'error');
                setSubmittingInvoice(false);
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
            date: getInvoiceDateInput() ? getInvoiceDateInput().value : '',
            dueDate: getDueDateInput() ? getDueDateInput().value : '',
            items: [...getCurrentInvoiceItems()], // Store items array
            // Keep legacy fields for backward compatibility
            description: getCurrentInvoiceItems()[0]?.description || '',
            quantity: getCurrentInvoiceItems()[0]?.quantity || 0,
            unitPrice: getCurrentInvoiceItems()[0]?.unitPrice || 0,
            total: totalHT,
            sourceQuoteNumber: getCurrentInvoiceSourceQuoteNumber() || '',
            // Relances automatiques
            noAutoRelance: document.getElementById('invoiceNoAutoRelance')?.checked || false,
            relances: [] // Historique des relances
        };

        if (getEditMode() && getEditingInvoiceNumberInput() >= 0) {
            // Update existing invoice
            getInvoices()[getEditingInvoiceNumberInput()] = {
                ...getInvoices()[getEditingInvoiceNumberInput()],
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

            getInvoices().push(invoice);
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
                    const clientObj = getClients().find(c => c.name === invoice.client);
                    const hasEmail = clientObj && clientObj.email_facturation && clientObj.email_facturation.trim() !== '';

                    if (hasEmail) {
                        // Try automatic send via Drive (preferred): generate PDF, save to Drive and send
                        sendInvoiceViaDrive(invoice, clientObj.email_facturation)
                            .catch(err => {
                                console.error('sendInvoiceViaDrive failed:', err);
                                showToast('⚠️ Envoi via Drive échoué, fallback ouverture compose Gmail', 'error');
                                openGmailComposeWithPDF(invoice, clientObj.email_facturation).catch(e => {
                                    console.error('Fallback compose failed:', e);
                                    setCurrentInvoiceData({
                                        clientName: invoice.client,
                                        invoiceNumber: invoice.number,
                                        invoiceDate: invoice.date,
                                        dueDate: invoice.dueDate,
                                        total: invoice.total,
                                        client: clientObj
                                    });
                                    showEmailPreview();
                                });
                            });
                    } else {
                        setCurrentInvoiceData({
                            clientName: invoice.client,
                            invoiceNumber: invoice.number,
                            invoiceDate: invoice.date,
                            dueDate: invoice.dueDate,
                            total: invoice.total,
                            client: clientObj || { name: invoice.client }
                        });
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
        setSubmittingInvoice(false);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            submitBtn.textContent = submitBtn.dataset.originalText || '💾 Créer facture';
        }
    });
}

// Add a reset button handler
export function resetInvoiceForm() {
    // Exit edit mode if active
    if (getEditMode()) {
        setEditMode(false);
        setEditingInvoiceNumberInput(-1);
        const indicator = document.getElementById('editModeIndicator');
        if (indicator) indicator.style.display = 'none';
        const submitBtn = document.getElementById('submitInvoiceBtn');
        if (submitBtn) submitBtn.textContent = '💾 Créer facture';
        const cancelBtn = document.getElementById('cancelEditBtn');
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    // Réinitialiser l'origine devis éventuelle
    setCurrentInvoiceSourceQuoteNumber('');

    if (getInvoiceForm()) getInvoiceForm().reset();
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
    if (getInvoiceNumberInput()) getInvoiceNumberInput().value = getNextInvoiceNumber();
    setDefaultDates();

    // Clear invoice items and add one empty line
    clearInvoiceItems();
    addInvoiceItem();

    calculateTotal();
}

// SUIVI - Invoice Tracking
export function checkOverdueInvoices() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    getInvoices().forEach(invoice => {
        const dueDate = new Date(invoice.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        if (invoice.status === 'Envoyée' && dueDate < today) {
            invoice.status = 'Retard';
        }
    });
}

export function getFilteredInvoices() {
    let filtered = [...getInvoices()];

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

export function renderInvoiceTable(filteredInvoices) {
    const tbody = document.getElementById('invoiceTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    filteredInvoices.forEach((invoice) => {
        const index = getInvoices().indexOf(invoice);
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

// Toggle secondary actions visibility
export function toggleInvoiceSecondaryActions(button) {
    const actionsDiv = button.parentElement.nextElementSibling;
    if (!actionsDiv || !actionsDiv.classList.contains('invoice-secondary-actions')) {
        console.error('Secondary actions not found');
        return;
    }
    const isHidden = actionsDiv.style.display === 'none';
    actionsDiv.style.display = isHidden ? 'flex' : 'none';
}

// Render invoice list in FACTURES tab
export function renderInvoiceList() {
    const tbody = document.getElementById('invoiceListBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (getInvoices().length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" style="text-align: center; color: var(--color-text-secondary); padding: var(--space-24);">Aucune facture créée</td>';
        tbody.appendChild(row);
        updateCAYearOptions(); // Mettre \u00e0 jour les ann\u00e9es m\u00eame s'il n'y a pas de factures
        return;
    }

    getInvoices().forEach((invoice, index) => {
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
                        ${getRams().some(r => r.invoiceNumber === invoice.number) ? `<button class="btn btn-sm btn-secondary" onclick="sendInvoiceWithRAM(${index})" title="Envoyer Facture + RAM">📧+📊</button>` : ''}
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
export function editInvoiceInForm(index) {
    const invoice = getInvoices()[index];
    if (!invoice) return;

    // Conserver l'origine devis si présente
    setCurrentInvoiceSourceQuoteNumber(invoice.sourceQuoteNumber || '');

    // Set edit mode
    setEditMode(true);
    setEditingInvoiceNumberInput(index);

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
    if (getInvoiceNumberInput()) getInvoiceNumberInput().value = invoice.number;
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
    if (getInvoiceDateInput()) getInvoiceDateInput().value = normalizeDateInput(invoice.date);
    if (getDueDateInput()) getDueDateInput().value = normalizeDateInput(invoice.dueDate);

    // Load invoice items (multi-line support)
    if (invoice.items && invoice.items.length > 0) {
        loadInvoiceItems(invoice.items);
    } else {
        // Legacy: single-line invoice
        const serviceDescriptionEl = document.getElementById('serviceDescription');
        if (serviceDescriptionEl) serviceDescriptionEl.value = invoice.description;
        if (getQuantityInput()) getQuantityInput().value = invoice.quantity;
        if (getUnitPriceInput()) getUnitPriceInput().value = invoice.unitPrice;

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
    const clientObj = getClients().find(c => c.name === invoice.client);
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
export function filterInvoiceList() {
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
    const filtered = getInvoices().filter(invoice =>
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
        const index = getInvoices().indexOf(invoice);
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
                ${getRams().some(r => r.invoiceNumber === invoice.number) ? `<button class="btn btn-sm btn-success" onclick="sendInvoiceWithRAM(${index})" title="Envoyer Facture + RAM ensemble" style="margin-left: var(--space-4);">📧+📊 Facture+RAM</button>` : ''}
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

// Edit invoice (for tracking table modal)
export function editInvoice(index) {
    const invoice = getInvoices()[index];
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

// Delete invoice from list (FACTURES tab)
export function deleteInvoiceFromList(index) {
    const invoice = getInvoices()[index];
    showConfirmation(
        'Confirmation de suppression',
        `Êtes-vous sûr de vouloir supprimer la facture #${invoice.number} du client ${invoice.client} ?`,
        async () => {
            getInvoices().splice(index, 1);
            await saveToDrive();
            renderInvoiceList();
            applyFilters();
            renderCharts();
            try { updateDevisKPIs(); } catch (e) { console.warn('updateDevisKPIs failed', e); }
            showToast('✅ Facture supprimée');

            // Auto-sync after deletion
            autoSync('delete');

            // If we were editing this invoice, cancel edit mode
            if (getEditMode() && getEditingInvoiceNumberInput() === index) {
                cancelEditMode();
            }
        }
    );
}

// Delete invoice (for tracking table)
export function deleteInvoice(index) {
    const invoice = getInvoices()[index];
    showConfirmation(
        'Confirmation de suppression',
        `Êtes-vous sûr de vouloir supprimer la facture #${invoice.number} du client ${invoice.client} ?`,
        () => {
            getInvoices().splice(index, 1);
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
            debouncedSaveToDrive();
        }
    );
}

// Duplicate invoice
export async function duplicateInvoice(index) {
    const invoice = getInvoices()[index];
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
    getInvoices().push(newInvoice);
    await saveToDrive();
    renderInvoiceList();
    applyFilters();
    try { updateDevisKPIs(); } catch (err) { console.warn('updateDevisKPIs after duplicate failed', err); }
    showToast('Facture dupliquée');
}

// Quick status update for invoices
export function setInvoiceStatus(index, status) {
    const invoice = getInvoices()[index];
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

// PDF Download functionality using iframe print fallback
export function buildInvoiceHtml({clientName, clientAddress, invoiceNumber, invoiceDate, dueDate, description, quantity, unitPrice, total, tvaEnabled, items, sourceQuoteNumber}) {
    // Support multi-line items or legacy single-line
    const invoiceItems = items && items.length > 0 ? items : [
        { description: description || '', quantity: quantity || 0, unitPrice: unitPrice || 0, total: total || 0 }
    ];

    const totalHT = invoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const tva = tvaEnabled ? totalHT * 0.20 : 0;
    const totalTTC = totalHT + tva;

    const companyAddressLine = getCompanyInfo().address && getCompanyInfo().postalCode && getCompanyInfo().city
        ? `${getCompanyInfo().address}, ${getCompanyInfo().postalCode} ${getCompanyInfo().city}`
        : '[À compléter dans Paramètres]';

    // Force local logo file - always use ../assets/images/MTI_CONSULTING.png unless data-URI is provided
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

// Preferred flow: generate PDF, save to Drive, then send email attaching that Drive file
export async function sendInvoiceViaDrive(invoice, toEmail) {
    if (!invoice) throw new Error('Invoice missing');
    const client = getClients().find(c => c.name === invoice.client) || {};
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
        const idx = getInvoices().findIndex(inv => inv.number === invoice.number && inv.client === invoice.client);
        if (idx >= 0) {
            getInvoices()[idx].status = 'Envoyée';
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

export function getCurrentInvoiceForPreview() {
    // Build an invoice object from the form fields (with multi-line items support)
    try {
        const clientNameEl = document.getElementById('clientName');
        const clientAddressEl = document.getElementById('clientAddress');
        const clientSiretEl = document.getElementById('clientSiret');

        return {
            number: getInvoiceNumberInput() ? getInvoiceNumberInput().value : getNextInvoiceNumber(),
            client: clientNameEl ? clientNameEl.value : '',
            clientSiret: clientSiretEl ? clientSiretEl.value : '',
            clientAddress: clientAddressEl ? clientAddressEl.value : '',
            date: getInvoiceDateInput() ? getInvoiceDateInput().value : '',
            dueDate: getDueDateInput() ? getDueDateInput().value : '',
            items: getCurrentInvoiceItems() && getCurrentInvoiceItems().length > 0 ? [...getCurrentInvoiceItems()] : [],
            // Legacy fields for backward compatibility (use first item)
            description: getCurrentInvoiceItems()[0]?.description || '',
            quantity: getCurrentInvoiceItems()[0]?.quantity || 0,
            unitPrice: getCurrentInvoiceItems()[0]?.unitPrice || 0,
            total: calculateTotal(),
            clientEmail: (getClients().find(c => c.name === (clientNameEl ? clientNameEl.value : '')) || {}).email_facturation || '',
            sourceQuoteNumber: getCurrentInvoiceSourceQuoteNumber() || ''
        };
    } catch (e) {
        console.error('getCurrentInvoiceForPreview error', e);
        return null;
    }
}

// Preview & confirm flow: (1) generate and save PDF to Drive (replacing existing), (2) open Drive PDF in new tab for preview, (3) show email modal with unified body for review, (4) on confirm send via backend or open compose
export async function previewAndConfirmSend(invoice) {
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
    const clientObj = getClients().find(c => c.name === invoice.client) || { name: invoice.client, contact_name: invoice.client };
    const to = clientObj.email_facturation || invoice.clientEmail || '';
    const subject = `Facture ${invoice.number} - MTI CONSULTING`;
    const body = generateEmailBody(invoice, clientObj);

    // Store current invoice data for the email confirmation modal
    // Note: PDF will be generated by sendInvoiceViaDrive when user confirms
    setCurrentInvoiceData({
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
    });

    // Show email preview modal (user can review/edit before confirming)
    showEmailPreviewForConfirmSend(to, subject, body);
}

// Télécharger une facture depuis la liste (même logique que le générateur)
export async function downloadInvoiceFromList(index) {
    const invoice = getInvoices()[index];
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
export function createRecurringInvoice(invoice, frequency = 'monthly', startDate = null) {
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

    getRecurringInvoices().push(recurring);
    saveToDrive();

    return recurring;
}

/**
 * Génère une facture à partir d'un modèle récurrent
 * @param {string} recurringId - ID de la facture récurrente
 * @returns {object} Nouvelle facture générée
 */
export function generateFromRecurring(recurringId) {
    const recurring = getRecurringInvoices().find(r => r.id === recurringId);
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
    getInvoices().push(newInvoice);

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
export function checkRecurringInvoices() {
    const today = new Date().toISOString().split('T')[0];
    const generated = [];

    getRecurringInvoices()
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
 * Supprime une facture récurrente
 * @param {string} recurringId - ID de la facture récurrente
 */
export function deleteRecurring(recurringId) {
    const index = getRecurringInvoices().findIndex(r => r.id === recurringId);
    if (index !== -1) {
        getRecurringInvoices().splice(index, 1);
        saveToDrive();
    }
}

/**
 * Exécute la vérification quotidienne des factures récurrentes
 * (À appeler au chargement de l'app)
 */
export function autoCheckRecurringInvoices() {
    const generated = checkRecurringInvoices();

    if (generated.length > 0) {
        const msg = `✅ ${generated.length} facture(s) récurrente(s) générée(s) automatiquement :\n` +
            generated.map(inv => `• ${inv.number} - ${inv.client}`).join('\n');

        alert(msg);

        // Rafraîchir l'affichage
        if (typeof renderInvoiceList === 'function') renderInvoiceList();
    }
}

/**
 * Affiche la liste des factures récurrentes dans le tableau
 */
export function renderRecurringList() {
    const tbody = document.getElementById('recurringListBody');
    if (!tbody) return;

    if (!getRecurringInvoices() || getRecurringInvoices().length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--color-text-secondary); padding: var(--space-24);">
                    Aucune facture récurrente. Créez-en une à partir d'une facture existante.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = getRecurringInvoices().map(rec => {
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
export function generateRecurringNow(recurringId) {
    try {
        const invoice = generateFromRecurring(recurringId);
        alert(`✅ Facture générée : ${invoice.number}\nClient : ${invoice.client}\nMontant : ${invoice.total}€`);

        // Rafraîchir les affichages
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
export function toggleRecurring(recurringId) {
    const recurring = getRecurringInvoices().find(r => r.id === recurringId);
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
export function confirmDeleteRecurring(recurringId) {
    const recurring = getRecurringInvoices().find(r => r.id === recurringId);
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
export function initRecurringInvoicesListeners() {
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
                getInvoices().forEach((inv, idx) => {
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

            if (isNaN(templateIdx) || templateIdx < 0 || templateIdx >= getInvoices().length) {
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
                const recurring = createRecurringInvoice(getInvoices()[templateIdx], frequency, startDate);

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
