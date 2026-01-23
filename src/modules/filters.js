import {
    getFilteredInvoices,
    renderInvoiceTable
} from "./invoices.js";
import { updateAlerts } from "./alerts.js";
import { updateSummary } from "./kpi.js";
import { renderCharts } from "./charts.js";
import { updateDashboard } from "./dashboard.js";

export function applyFilters() {
    const filtered = getFilteredInvoices();
    renderInvoiceTable(filtered);
    updateSummary(filtered);
    renderCharts(); // FIX: Actualiser les graphiques après filtrage
    try { updateDashboard(); } catch (e) { console.warn('updateDashboard error', e); }
    try { updateAlerts(); } catch (e) { console.warn('updateAlerts error', e); }
}