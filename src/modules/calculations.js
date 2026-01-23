import {
    getCurrentInvoiceItems,
    getQuantityInput,
    getUnitPriceInput
} from "./config.js";
import { formatNumber } from "./number-utils.js";

// Calculate total with optional TVA
export function calculateTotal() {
    // Use multi-line items if available
    let totalHT = 0;

    if (getCurrentInvoiceItems() && getCurrentInvoiceItems().length > 0) {
        totalHT = getCurrentInvoiceItems().reduce((sum, item) => sum + (item.total || 0), 0);
    } else if (getQuantityInput() && getUnitPriceInput()) {
        // Legacy fallback for old single-line logic
        const quantity = parseFloat(getQuantityInput().value) || 0;
        const unitPrice = parseFloat(getUnitPriceInput().value) || 0;
        totalHT = quantity * unitPrice;
    }

    const tvaEnabled = document.getElementById('tvaToggle') && document.getElementById('tvaToggle').checked;

    if (tvaEnabled) {
        const tva = totalHT * 0.20;
        const totalTTC = totalHT + tva;
        const totalHTEl = document.getElementById('totalHT');
        const totalTVAEl = document.getElementById('totalTVA');
        const totalTTCEl = document.getElementById('totalTTC');
        if (totalHTEl) totalHTEl.value = formatNumber(totalHT) + ' €';
        if (totalTVAEl) totalTVAEl.value = formatNumber(tva) + ' €';
        if (totalTTCEl) totalTTCEl.value = formatNumber(totalTTC) + ' €';
    } else {
        const totalHTOnlyEl = document.getElementById('totalHTOnly');
        if (totalHTOnlyEl) totalHTOnlyEl.value = formatNumber(totalHT) + ' €';
    }

    return totalHT;
}