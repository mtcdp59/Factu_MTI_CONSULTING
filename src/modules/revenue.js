import { formatNumber } from "./number-utils.js";
import {
    getInvoices,
    getTaxSettings
} from "./config.js";
import { updateDevisKPIs } from "./kpi.js";

/**
 * Met à jour l'affichage du compteur CA annuel dans l'onglet Suivi
 */
export function updateCADisplay(annee = new Date().getFullYear()) {
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
export function updateCAYearOptions() {
    const yearSelect = document.getElementById('caYearSelect');
    if (!yearSelect) return;

    // Extraire toutes les ann\u00e9es des factures
    const years = new Set();
    getInvoices().forEach(inv => {
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
export function initCACounterListeners() {
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

/**
 * Vérifie les seuils critiques (TVA, Micro-entreprise) et affiche des alertes
 * @param {number} ca - CA annuel à vérifier
 * @returns {Object} { alerte, message, niveau } où niveau = 'ok'|'warning'|'danger'
 */
export function checkSeuils(ca = null) {
    if (ca === null) ca = getCACumule();

    const seuilTVA = getTaxSettings().seuilTVAAnnuel || 37500;
    const seuilTVAMajore = getTaxSettings().seuilTVAMajore || 39100;
    const seuilMicro = getTaxSettings().caMaxBNC || 77700;
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
    return getInvoices()
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
    return getInvoices()
        .filter(inv => {
            if (!inv.date) return false;
            const invYear = new Date(inv.date).getFullYear();
            return invYear === annee && !isCancelled(inv.status);
        })
        .reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
}
