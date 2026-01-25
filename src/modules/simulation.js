import {
    communeInput,
    rfrInput,
    caInput
} from "./event-listener.js";
import {
    calculateACREPeriod,
    updateCFEEstimation
} from "./company.js";
import { calculateTaxes } from "./tax.js";
import {
    defaultSettings,
    getTaxSettings
} from "./config.js";
import { formatNumber } from "./number-utils.js";

// Fonction sauvegarde paramètres simulation
export function saveSimulationParams() {
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
export function loadSimulationParams() {
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
export function resetSimulationParams() {
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
    getTaxSettings().cfeAnnuel = defaultSettings.cfeAnnuel || 600;

    // Supprimer de localStorage
    localStorage.removeItem('mti_simulation_params');

    // Recalculer
    calculateTaxes();
}

// Fonction vérification éligibilité Versement Libératoire
export function verifierEligibiliteVL() {
    const rfr = parseFloat(rfrInput?.value) || 0;
    const eligibiliteDiv = document.getElementById('eligibiliteVL');

    if (!eligibiliteDiv) return;

    if (rfr === 0) {
        eligibiliteDiv.style.display = 'none';
        return;
    }

    const seuil = getTaxSettings().rfrMaxVL || 28797;
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

// Fonction export PDF simulateur
export function exportSimulateurPDF() {
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
    pdf.text(`CFE annuelle: ${getTaxSettings().cfeAnnuel} €`, 15, 60);

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