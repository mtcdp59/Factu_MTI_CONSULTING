import { setConfirmCallback } from "./config.js";

export function showConfirmation(title, message, callback) {
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    setConfirmCallback(callback);

    // Update button styling for delete confirmations
    const confirmBtn = document.getElementById('confirmAction');
    if (confirmBtn) {
        if (title.toLowerCase().includes('supprimer')) {
            confirmBtn.textContent = 'Supprimer';
            confirmBtn.style.backgroundColor = 'var(--color-error)';
            confirmBtn.style.color = 'white';
        } else {
            confirmBtn.textContent = 'Confirmer';
            confirmBtn.style.backgroundColor = '';
            confirmBtn.style.color = '';
        }
    }

    document.getElementById('confirmModal')?.classList.add('show');
}