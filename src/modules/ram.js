import {
    getClients,
    getInvoices,
    getIsSyncing,
    getRams,
    setIsSyncing,
    setRams,
    setSuppressSheetsSyncInterval
} from "./config.js";
import { showToast } from "./toast.js";
import { syncToDrive } from "./drive.js";
import {
    callBackend,
    generateRAMPDF
} from "./api.js";

// Setup listeners pour mise à jour automatique du select factures dans le formulaire RAM
export function setupRAMFormListeners() {
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
            return getClients()[index] ? getClients()[index].name : '';
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

// Générer le Rapport d'Activité Mensuelle pour une facture
export async function generateRAMForInvoice(index) {
    const invoice = getInvoices()[index];
    if (!invoice) {
        showToast('❌ Facture introuvable', 'error');
        return;
    }

    // Afficher le modal de saisie RAM
    showRAMModal(invoice);
}

// Afficher le modal de saisie du RAM
export function showRAMModal(invoice, ramIndex = null) {
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
                        ${getClients().map(c => `<option value="${c.name}" ${c.name === invoice.client ? 'selected' : ''}>${c.name}</option>`).join('')}
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

// Générer le calendrier mensuel complet
export function generateRAMCalendar(month, year) {
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

// Rafraîchir le calendrier quand on change le mois/année
export function refreshRAMCalendar() {
    const month = parseInt(document.getElementById('ramMonth').value);
    const year = parseInt(document.getElementById('ramYear').value);
    generateRAMCalendar(month, year);
    showToast('✅ Calendrier mis à jour', 'success');
}

// Fermer le modal RAM
export function closeRAMModal() {
    const modal = document.getElementById('ramModal');
    if (modal) modal.remove();
}

// Générer le RAM à partir des données du modal
export async function generateRAMFromModal() {
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
    const existingRAMIndex = getRams().findIndex(r => r.client === client && r.month === month && r.year === year);

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
        getRams().splice(existingRAMIndex, 1);
    } else if (isEditingThisRAM) {
        // On édite le RAM existant, le supprimer pour le remplacer
        getRams().splice(existingRAMIndex, 1);
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
    getRams().push(ram);
    await storageManager.saveDual('mti_rams', getRams());
    await syncToDrive();

    // Réinitialiser le mode édition
    window.editingRAMIndex = -1;

    closeRAMModal();

    // Basculer vers l'onglet RAM et afficher la liste
    document.querySelector('[data-tab="ram"]')?.click();
    renderRAMList();
    showToast(`✅ RAM créé avec succès pour ${client} - ${monthName} ${year}`, 'success');

    // Générer automatiquement le PDF
    try {
        await generateRAMPDF(ram);
        showToast('📄 PDF généré avec succès', 'success');
    } catch (error) {
        console.error('Erreur génération PDF:', error);
        showToast('⚠️ RAM enregistré mais erreur génération PDF', 'warning');
    }
}

// Afficher l'aperçu du RAM
export function showRAMPreview(ram) {
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

// Enregistrer le RAM
export async function saveRAM(ramId) {
    const ram = window.currentRAM;
    if (!ram) {
        showToast('❌ Aucun RAM à enregistrer', 'error');
        return;
    }

    try {
        showToast('⏳ Enregistrement du RAM...');

        // Ajouter à la liste des RAMs
        const existingIndex = getRams().findIndex(r => r.id === ram.id);
        if (existingIndex >= 0) {
            getRams()[existingIndex] = ram;
        } else {
            getRams().push(ram);
        }

        // Sauvegarder localement
        await storageManager.saveDual('mti_rams', getRams());

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

// Télécharger le PDF du RAM
export async function downloadRAMPDF(ramId) {
    const ram = window.currentRAM || getRams().find(r => r.id === ramId);
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

// Modifier le RAM
export function editRAM(ramId) {
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

// Mettre à jour le RAM depuis le modal d'édition
export function updateRAMFromModal() {
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

// Nettoyer toutes les lignes RAM dans Google Sheets
export async function clearRAMsInSheets() {
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

// Afficher la liste des RAMs enregistrés (table comme les factures)
export function renderRAMList() {
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

    if (getRams().length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: var(--space-24); color: var(--color-text-secondary);">Aucun rapport d\'activité enregistré</td></tr>';
        return;
    }

    getRams().forEach((ram, index) => {
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

/**
 * Filtre la liste des RAM selon la recherche
 */
export function filterRAMList() {
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

    const filtered = getRams().filter(ram => {
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
        const index = getRams().indexOf(ram);
        const totalHours = getRams().activities.reduce((sum, a) => sum + (a.hours || 0), 0);
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
export function editRAMInForm(index) {
    const ram = getRams()[index];
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
    const clientIndex = getClients().findIndex(c => c.name === ram.client);
    if (clientIndex !== -1 && clientSelect) {
        // Client trouvé - sélectionner dans le dropdown
        clientSelect.value = clientIndex.toString();
        if (manualGroup) manualGroup.style.display = 'none';
        if (clientInput) clientInput.value = ram.client;
        if (clientSiret) clientSiret.value = getClients()[clientIndex].siret || '';
        if (clientAddress) clientAddress.value = getClients()[clientIndex].address || '';
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

// Annuler l'édition d'un RAM
export function cancelRAMEdit() {
    window.editingRAMIndex = -1;
    window.currentRAM = null;

    const formContainer = document.getElementById('ramFormContainer');
    if (formContainer) formContainer.style.display = 'none';

    const editIndicator = document.getElementById('ramEditModeIndicator');
    if (editIndicator) editIndicator.style.display = 'none';

    // Réinitialiser le formulaire
    resetRAMForm();
}

// Peupler le select des factures filtrées par client et mois/année
export function populateRAMInvoiceSelect(clientName = '', month = null, year = null) {
    const invoiceSelect = document.getElementById('ramInvoiceNumber');
    if (!invoiceSelect) return;

    // Réinitialiser le select
    invoiceSelect.innerHTML = '<option value="">-- Aucune facture liée --</option>';

    // Si pas de client, impossible de filtrer
    if (!clientName) return;

    // Construire le préfixe YYYYMM du numéro de facture
    const yearMonth = year && month !== null ? `${year}${(month + 1).toString().padStart(2, '0')}` : null;

    // Filtrer les factures : même client ET (si mois/année fournis) même période
    const matchingInvoices = getInvoices().filter(inv => {
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

// Réinitialiser le formulaire RAM
export function resetRAMForm() {
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

// Afficher le formulaire de nouveau RAM
export function showNewRAMForm() {
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

// Générer le calendrier dans le formulaire
export function generateRAMCalendarInForm(month, year, existingActivities = null) {
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

// Rafraîchir le calendrier du formulaire
export function refreshRAMFormCalendar() {
    const monthSelect = document.getElementById('ramMonthSelect');
    const yearInput = document.getElementById('ramYearInput');

    if (!monthSelect || !yearInput) return;

    const month = parseInt(monthSelect.value);
    const year = parseInt(yearInput.value);

    generateRAMCalendarInForm(month, year);
    showToast('✅ Calendrier rafraîchi', 'success');
}

// Sauvegarder le RAM depuis le formulaire
export async function saveRAMFromForm() {
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
        if (getClients()[index]) {
            client = getClients()[index].name;
            ramClientSiret = getClients()[index].siret || '';
            ramClientAddress = getClients()[index].address || '';
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
    const existingRAMIndex = getRams().findIndex(r => r.client === client && r.month === month && r.year === year);
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
            getRams().push(ram);
        }

        // Sauvegarder
        await storageManager.saveDual('mti_rams', getRams());
        await syncToDrive();

        // Export Sheets (non bloquant)
        if (window.editingRAMIndex >= 0) {
            await exportRAMToSheets(getRams()[window.editingRAMIndex]);
        } else {
            await exportRAMToSheets(getRams()[getRams().length - 1]);
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

// Supprimer un RAM
export async function deleteRAM(index) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rapport d\'activité ?')) return;

    getRams().splice(index, 1);
    await storageManager.saveDual('mti_rams', getRams());
    await syncToDrive();
    renderRAMList();
    showToast('✅ RAM supprimé', 'success');
}

// Exporter tous les RAMs vers Sheets
export async function exportRAMsToSheets() {
    if (getIsSyncing()) {
        alert('⏳ Une synchronisation est déjà en cours...');
        return;
    }

    if (getRams().length === 0) {
        alert('ℹ️ Aucun RAM à exporter');
        return;
    }

    const confirm = window.confirm(`Exporter ${getRams().length} RAM(s) vers Google Sheets ?\n\nCela écrasera le contenu existant de la feuille RAM.`);
    if (!confirm) return;

    setIsSyncing(true);
    try {
        const result = await callBackend('sync_rams', { sheetId: CONFIG.SHEETS_ID, getRams });
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
export async function importRAMsFromSheets() {
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
        await storageManager.saveDual('mti_rams', getRams());
        await saveToDrive({ skipSheetsSync: true });
        renderRAMList();

        alert(`✅ ${getRams().length} RAM(s) importé(s) depuis Sheets`);
    } catch (error) {
        console.error('importRAMsFromSheets error:', error);
        alert(`❌ Erreur import RAMs : ${error.message || error}`);
    } finally {
        setIsSyncing(false);
        setSuppressSheetsSyncInterval(false);
    }
}

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