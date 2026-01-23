import { getInvoices } from "./config.js";
import { formatNumber } from "./number-utils.js";
import { formatDateFR } from "./date-utils.js";

/**
 * Met à jour le dashboard d'accueil avec les chiffres clés
 */
export function updateDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // CA du mois en cours
    const monthInvoices = getInvoices().filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= startOfMonth && invDate <= today;
    });
    const monthCA = monthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    // Factures en attente (envoyées non payées)
    const pendingInvoices = getInvoices().filter(inv =>
        inv.status === 'Envoyée' && (parseFloat(inv.montantRecu) || 0) < (inv.total || 0)
    );
    const pendingAmount = pendingInvoices.reduce((sum, inv) =>
        sum + ((inv.total || 0) - (parseFloat(inv.montantRecu) || 0)), 0
    );

    // Dernière facture créée
    const lastInvoice = getInvoices().length > 0 ? getInvoices()[getInvoices().length - 1] : null;

    // Dernier paiement reçu
    const paidInvoices = getInvoices().filter(inv => inv.dateReception).sort((a, b) =>
        new Date(b.dateReception) - new Date(a.dateReception)
    );
    const lastPayment = paidInvoices.length > 0 ? paidInvoices[0] : null;

    // Mise à jour du DOM
    const dashCAEl = document.getElementById('dashMonthCA');
    const dashPendingCountEl = document.getElementById('dashPendingCount');
    const dashPendingAmountEl = document.getElementById('dashPendingAmount');
    const dashLastInvoiceEl = document.getElementById('dashLastInvoice');
    const dashLastPaymentEl = document.getElementById('dashLastPayment');

    if (dashCAEl) dashCAEl.textContent = `${formatNumber(monthCA)} €`;
    if (dashPendingCountEl) dashPendingCountEl.textContent = pendingInvoices.length;
    if (dashPendingAmountEl) dashPendingAmountEl.textContent = `${formatNumber(pendingAmount)} €`;

    if (dashLastInvoiceEl) {
        if (lastInvoice) {
            dashLastInvoiceEl.innerHTML = `<strong>${lastInvoice.number}</strong> - ${lastInvoice.client} (${formatDateFR(lastInvoice.date)})`;
        } else {
            dashLastInvoiceEl.textContent = 'Aucune facture';
        }
    }

    if (dashLastPaymentEl) {
        if (lastPayment) {
            dashLastPaymentEl.innerHTML = `<strong>${lastPayment.number}</strong> - ${formatNumber((parseFloat(lastPayment.montantRecu) || 0))} € (${formatDateFR(lastPayment.dateReception)})`;
        } else {
            dashLastPaymentEl.textContent = 'Aucun paiement';
        }
    }
}