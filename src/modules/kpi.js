import {getInvoices} from "./config.js";
import {formatNumber} from "./number-utils.js";
import {getFilteredQuotes} from "./quotes.js";

// Met à jour les KPI Devis → Facture dans l'onglet Suivi (avec filtres)
export function updateDevisKPIs() {
    const rateEl = document.getElementById('devisConversionRate');
    const amountMonthEl = document.getElementById('devisConvertedAmountMonth');
    const countMonthEl = document.getElementById('devisCountMonth');
    const avgDelayEl = document.getElementById('devisAvgDelay');
    if (!rateEl || !amountMonthEl || !countMonthEl || !avgDelayEl) return;

    const quotesFiltered = getFilteredQuotes();
    const invoicesAll = Array.isArray(getInvoices()) ? getInvoices() : [];

    const convertedQuotes = quotesFiltered.filter(q => !!q.linkedInvoiceNumber);

    const conversionRate = quotesFiltered.length > 0 ? (convertedQuotes.length / quotesFiltered.length) * 100 : 0;
    rateEl.textContent = `${conversionRate.toFixed(0)}%`;

    // Montant des devis filtrés
    const quotesAmount = quotesFiltered.reduce((sum, q) => sum + (q.total || 0), 0);
    amountMonthEl.textContent = `${formatNumber(quotesAmount)} €`;

    countMonthEl.textContent = `${quotesFiltered.length}`;

    const delays = convertedQuotes.map(q => {
        const inv = invoicesAll.find(i => i.number === q.linkedInvoiceNumber);
        if (!inv) return null;
        const dq = new Date(q.date);
        const di = new Date(inv.date);
        if (isNaN(dq) || isNaN(di)) return null;
        return Math.max(0, Math.round((di - dq) / (1000 * 60 * 60 * 24)));
    }).filter(v => v !== null);
    const avgDelay = delays.length > 0 ? (delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
    avgDelayEl.textContent = `${avgDelay.toFixed(1)} j`;
}

export function updateSummary(filteredInvoices = getInvoices()) {
    // Exclude cancelled invoices from summary
    const activeInvoices = filteredInvoices.filter(inv => inv.status !== 'Annulée');
    const totalFacture = activeInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalPaye = activeInvoices.reduce((sum, inv) => sum + (parseFloat(inv.montantRecu) || 0), 0);
    const totalAttente = totalFacture - totalPaye;
    const tauxRecouvrement = totalFacture > 0 ? (totalPaye / totalFacture * 100) : 0;

    const totalFactEl = document.getElementById('totalFacture');
    const totalPayeEl = document.getElementById('totalPaye');
    const totalAttEl = document.getElementById('totalAttente');
    const tauxEl = document.getElementById('tauxRecouvrement');

    if (totalFactEl) totalFactEl.textContent = formatNumber(totalFacture) + ' €';
    if (totalPayeEl) totalPayeEl.textContent = formatNumber(totalPaye) + ' €';
    if (totalAttEl) totalAttEl.textContent = formatNumber(totalAttente) + ' €';
    if (tauxEl) tauxEl.textContent = tauxRecouvrement.toFixed(1) + '%';
}