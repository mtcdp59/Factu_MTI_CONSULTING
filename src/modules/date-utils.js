import {
    getDueDateInput,
    getInvoiceDateInput,
    getLastSyncTime,
    setLastSyncTime
} from "./config.js";

export function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getWeekDates(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));

    const dates = [];
    for (let i = 0; i < 7; i++) {
        const weekDay = new Date(monday);
        weekDay.setDate(monday.getDate() + i);
        dates.push(weekDay);
    }
    return dates;
}

/**
 * Calcule la prochaine date d'échéance selon la fréquence
 * @param {Date} currentDate - Date de référence
 * @param {string} frequency - Fréquence
 * @returns {string} Prochaine date (ISO format)
 */
export function calculateNextDate(currentDate, frequency) {
    const date = new Date(currentDate);

    switch(frequency) {
        case 'monthly':
            date.setMonth(date.getMonth() + 1);
            break;
        case 'quarterly':
            date.setMonth(date.getMonth() + 3);
            break;
        case 'yearly':
            date.setFullYear(date.getFullYear() + 1);
            break;
        default:
            date.setMonth(date.getMonth() + 1);
    }

    return date.toISOString().split('T')[0];
}

// Set default dates
export function setDefaultDates() {
    const today = new Date();
    const defaultDue = new Date(today);
    defaultDue.setDate(defaultDue.getDate() + 30);

    if (getInvoiceDateInput()) getInvoiceDateInput().value = today.toISOString().split('T')[0];
    if (getDueDateInput()) getDueDateInput().value = defaultDue.toISOString().split('T')[0];
}

// Format date to French format
export function formatDateFR(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
}

// Update last sync time
export function updateLastSyncTime() {
    setLastSyncTime(new Date());
    const timeString = getLastSyncTime().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const lastSyncElement = document.getElementById('lastSyncTime');
    if (lastSyncElement) {
        lastSyncElement.textContent = `Dernière sync: ${timeString}`;
    }
}