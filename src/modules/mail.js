import {
    getClients,
    getCurrentInvoiceData,
    getDueDateInput,
    getInvoiceDateInput,
    getInvoiceNumberInput,
    getInvoices,
    setCurrentInvoiceData
} from "./config.js";
import {
    callBackend,
    callBackendJSONP,
    generateInvoicePDFBase64
} from "./api.js";
import { base64ToBlob } from "./file-utils.js";
import {
    renderInvoiceList,
    sendInvoiceViaDrive
} from "./invoices.js";
import { showToast } from "./toast.js";
import { showBackendRawResponse } from "./debug.js";
import { formatNumber } from "./number-utils.js";
import { formatDateFR } from "./date-utils.js";
import { calculateTotal } from "./calculations.js";
import { showConfirmation } from "./modal.js";

// Open Gmail compose in a new tab and provide the generated PDF for review/download
export async function openGmailComposeWithPDF(invoice, toEmail) {
    if (!invoice) throw new Error('Invoice missing');
    const client = getClients().find(c => c.name === invoice.client) || {};
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

export function showEmailPreviewForConfirmSend(to, subject, body) {
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

export function setupEmailPreviewHandlersForConfirmSend() {
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

            if (!getCurrentInvoiceData()) {
                // Réactiver si données manquantes
                newConfirm.disabled = false;
                newConfirm.style.opacity = '1';
                newConfirm.style.cursor = 'pointer';
                newConfirm.textContent = originalText;
                return;
            }
            const { client } = getCurrentInvoiceData();
            const to = client && client.email_facturation ? client.email_facturation : '';
            const subject = `Facture ${getCurrentInvoiceData().invoiceNumber} - MTI CONSULTING`;

            // Reconstruct full invoice object for sendInvoiceViaDrive
            const invoice = {
                number: getCurrentInvoiceData().invoiceNumber,
                client: getCurrentInvoiceData().clientName,
                clientSiret: getCurrentInvoiceData().clientSiret || (client && client.siret),
                clientAddress: getCurrentInvoiceData().clientAddress || (client && client.address),
                date: getCurrentInvoiceData().invoiceDate,
                dueDate: getCurrentInvoiceData().dueDate,
                description: getCurrentInvoiceData().description,
                quantity: getCurrentInvoiceData().quantity,
                unitPrice: getCurrentInvoiceData().unitPrice,
                total: getCurrentInvoiceData().total
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
}

// Envoyer une relance pour une facture (même pattern que sendInvoiceByEmail)
export async function sendRelanceFromList(index) {
    const invoice = getInvoices()[index];
    const client = getClients().find(c => c.name === invoice.client);

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
export function generateEmailBody(invoice, client) {
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

export function setupEmailPreviewHandlers() {
    const sendEmailBtn = document.getElementById('sendEmailBtn');
    if (sendEmailBtn) {
        sendEmailBtn.addEventListener('click', () => {
            const clientNameEl = document.getElementById('clientName');
            if (!clientNameEl || !getInvoiceNumberInput() || !getInvoiceDateInput() || !getDueDateInput()) {
                alert('Veuillez remplir tous les champs obligatoires avant d\'envoyer l\'email');
                return;
            }

            const clientName = clientNameEl.value;
            const invoiceNumber = getInvoiceNumberInput().value;
            const invoiceDate = getInvoiceDateInput().value;
            const dueDate = getDueDateInput().value;
            const total = calculateTotal();

            // Find client data
            const client = getClients().find(c => c.name === clientName);

            setCurrentInvoiceData({
                clientName,
                invoiceNumber,
                invoiceDate,
                dueDate,
                total,
                client
            });

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

export function showEmailPreview() {
    if (!getCurrentInvoiceData()) return;
    const { clientName, invoiceNumber, invoiceDate, dueDate, total, client } = getCurrentInvoiceData();

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

// Send email for existing invoice from tracking table
export function sendInvoiceEmail(index) {
    const invoice = getInvoices()[index];
    const client = getClients().find(c => c.name === invoice.client);

    // Check if email is available
    const hasEmail = client && client.email_facturation && client.email_facturation.trim() !== '';

    if (!hasEmail) {
        showToast('⚠️ Aucun email configuré pour ce client', 'info');
        // Fall back to old email preview
        setCurrentInvoiceData({
            clientName: invoice.client,
            invoiceNumber: invoice.number,
            invoiceDate: invoice.date,
            dueDate: invoice.dueDate,
            total: invoice.total,
            client: client
        });
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