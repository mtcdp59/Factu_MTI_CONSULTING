import { CONFIG } from './config.js';
import { saveConfigToStorage } from "./storage.js";
import { showToast } from "./toast.js";
import {
    defaultSettings,
    getCompanyInfo,
    getTaxSettings
} from "./config.js";
import {
    calculateTaxes,
    renderIRPPBareme
} from "./tax.js";

// PARAMÈTRES - Settings Management

// Sauvegarder la configuration technique
export async function saveTechnicalConfig() {
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

export function loadCompanySettings() {
    // Charger la config technique
    loadTechnicalConfig();

    // Charger les infos entreprise
    if (document.getElementById('logoUrl')) {
        document.getElementById('logoUrl').value = getCompanyInfo().logoUrl || '';
        document.getElementById('companyLegalSiret').value = getCompanyInfo().siret || '[SIRET à venir]';
        document.getElementById('companyAddress').value = getCompanyInfo().address || '[Adresse]';
        document.getElementById('companyPostal').value = getCompanyInfo().postalCode || '[Code postal]';
        document.getElementById('companyCity').value = getCompanyInfo().city || '[Ville]';
        document.getElementById('companyIBAN').value = getCompanyInfo().iban || '';
        document.getElementById('companyBIC').value = getCompanyInfo().bic || '';
    }

    // Charger les paramètres fiscaux (taxSettings → HTML)
    if (document.getElementById('tauxAcreActif')) {
        document.getElementById('tauxAcreActif').value = getTaxSettings().acreActif;
        document.getElementById('tauxAcreInactif').value = getTaxSettings().acreInactif;
        document.getElementById('tauxCFPBNC').value = getTaxSettings().cfpBNC;
        document.getElementById('rfrMaxVL').value = getTaxSettings().rfrMaxVL;
        document.getElementById('seuilTVAAnnuel').value = getTaxSettings().seuilTVAAnnuel || 37500;
        document.getElementById('seuilTVAMajore').value = getTaxSettings().seuilTVAMajore || 39100;
        document.getElementById('caMaxBNC').value = getTaxSettings().caMaxBNC;
        document.getElementById('tauxVersementLib').value = getTaxSettings().versementLiberatoire;
        // Note: cfeAnnuel is no longer loaded from DOM in Paramètres, managed via Calculs commune search
    }

    // Charger l'objectif CA mensuel
    if (document.getElementById('objectifCAMensuel')) {
        document.getElementById('objectifCAMensuel').value = getTaxSettings().objectifCAMensuel || 6000;

        // Mettre à jour les seuils fiscaux affichés (référence mensuelle)
        const seuilTVAMensuel = (getTaxSettings().seuilTVAAnnuel || 37500) / 12;
        const seuilMicroMensuel = (getTaxSettings().caMaxBNC || 77700) / 12;

        if (document.getElementById('seuilTVAMensuel')) {
            document.getElementById('seuilTVAMensuel').textContent = seuilTVAMensuel.toFixed(0);
        }
        if (document.getElementById('seuilTVAAnnuel')) {
            document.getElementById('seuilTVAAnnuel').textContent = (getTaxSettings().seuilTVAAnnuel || 37500).toLocaleString('fr-FR');
        }
        if (document.getElementById('seuilMicroMensuel')) {
            document.getElementById('seuilMicroMensuel').textContent = seuilMicroMensuel.toFixed(0);
        }
        if (document.getElementById('seuilMicroAnnuel')) {
            document.getElementById('seuilMicroAnnuel').textContent = (getTaxSettings().caMaxBNC || 77700).toLocaleString('fr-FR');
        }
    }
}

export function saveSettings() {
    // Save company info
    if (document.getElementById('logoUrl')) {
        getCompanyInfo().logoUrl = document.getElementById('logoUrl').value || '';
        getCompanyInfo().siret = document.getElementById('companyLegalSiret').value || '[SIRET à venir]';
        getCompanyInfo().address = document.getElementById('companyAddress').value || '[Adresse]';
        getCompanyInfo().postalCode = document.getElementById('companyPostal').value || '[Code postal]';
        getCompanyInfo().city = document.getElementById('companyCity').value || '[Ville]';
        getCompanyInfo().iban = document.getElementById('companyIBAN').value || '';
        getCompanyInfo().bic = document.getElementById('companyBIC').value || '';
    }
    getTaxSettings().tauxIS = parseFloat(document.getElementById('tauxIS')?.value) || 0;
    getTaxSettings().versementLiberatoire = parseFloat(document.getElementById('tauxVersementLib')?.value) || 2.2;
    // Note: cfeAnnuel is now managed only via commune search in Calculs tab, not in Paramètres
    getTaxSettings().acreActif = parseFloat(document.getElementById('tauxAcreActif')?.value) || 12.3;
    getTaxSettings().acreInactif = parseFloat(document.getElementById('tauxAcreInactif')?.value) || 24.6;
    getTaxSettings().cfpBNC = parseFloat(document.getElementById('tauxCFPBNC')?.value) || 0.2;
    getTaxSettings().rfrMaxVL = parseFloat(document.getElementById('rfrMaxVL')?.value) || 28797;
    getTaxSettings().seuilTVAAnnuel = parseFloat(document.getElementById('seuilTVAAnnuel')?.value) || 37500;
    getTaxSettings().seuilTVAMajore = parseFloat(document.getElementById('seuilTVAMajore')?.value) || 39100;
    getTaxSettings().caMaxBNC = parseFloat(document.getElementById('caMaxBNC')?.value) || 77700;
    getTaxSettings().objectifCAMensuel = parseFloat(document.getElementById('objectifCAMensuel')?.value) || 6000;
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

export function resetSettings() {
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
    getTaxSettings().irppBareme = JSON.parse(JSON.stringify(defaultSettings.irppBareme));
    getTaxSettings().bncAbattement = defaultSettings.bncAbattement;
    renderIRPPBareme();
}

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