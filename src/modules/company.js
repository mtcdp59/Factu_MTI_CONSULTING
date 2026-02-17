import { showToast } from "./toast.js";
import { getCFEFromAPI } from "./api.js";
import { getTaxSettings } from "./config.js";
import { communeInput } from "./event-listener.js";
import { formatNumber } from "./number-utils.js";
import { calculateTaxes } from "./tax.js";

// Fonction auto-remplissage champs client depuis données SIRENE
export function autoFillClientFromSIRET(statusElementId, siretData) {
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

export function updateSiretStatus(statusElementId, infoElementId, state, message) {
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
export async function updateCFEEstimation() {
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
    getTaxSettings().cfeAnnuel = result.taux;
    calculateTaxes();
}

// Fonction calcul période ACRE
export function calculateACREPeriod() {
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