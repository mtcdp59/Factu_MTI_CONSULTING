import {
    getInvoices,
    getQuotes,
    getTaxSettings
} from "./config.js";
import { formatNumber } from "./number-utils.js";
import { applyFilters } from "./filters.js";

/**
 * Met à jour les alertes intelligentes
 */
export function updateAlerts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    const alerts = [];

    // Factures en retard (>30j)
    const overdueInvoices = getInvoices().filter(inv => {
        if (inv.status !== 'Envoyée') return false;
        const dueDate = new Date(inv.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        return daysDiff > 30;
    });

    if (overdueInvoices.length > 0) {
        const total = overdueInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        alerts.push({
            type: 'error',
            icon: '🔴',
            message: `${overdueInvoices.length} facture(s) en retard (+30j) - ${formatNumber(total)} €`,
            action: () => {
                document.getElementById('statusFilter').value = 'Retard';
                applyFilters();
            }
        });
    }

    // Factures proches échéance (<7j)
    const soonDueInvoices = getInvoices().filter(inv => {
        if (inv.status !== 'Envoyée') return false;
        const dueDate = new Date(inv.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate >= today && dueDate <= in7Days;
    });

    if (soonDueInvoices.length > 0) {
        const total = soonDueInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        alerts.push({
            type: 'warning',
            icon: '🟠',
            message: `${soonDueInvoices.length} facture(s) échéance <7j - ${formatNumber(total)} €`,
            action: null
        });
    }

    // Devis expirés non convertis
    const expiredQuotes = getQuotes().filter(q => {
        if (q.linkedInvoiceNumber) return false;
        const validityDate = new Date(q.validityDate);
        validityDate.setHours(0, 0, 0, 0);
        return validityDate < today;
    });

    if (expiredQuotes.length > 0) {
        const total = expiredQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
        alerts.push({
            type: 'info',
            icon: '🟡',
            message: `${expiredQuotes.length} devis expiré(s) non converti(s) - ${formatNumber(total)} €`,
            action: null
        });
    }

    // Objectif CA mensuel personnalisé
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthInvoices = getInvoices().filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= startOfMonth && invDate <= today;
    });
    const monthCA = monthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    // CA annuel (année en cours)
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const yearInvoices = getInvoices().filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= startOfYear && invDate <= today;
    });
    const yearCA = yearInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    const objectif = getTaxSettings().objectifCAMensuel || 6000;
    const seuilTVAAnnuel = getTaxSettings().seuilTVAAnnuel || 37500;
    const seuilMicroAnnuel = getTaxSettings().caMaxBNC || 77700;

    // Calculer les pourcentages pour les barres de progression
    const progressObjectif = Math.min(((monthCA / objectif) * 100), 100);
    const progressTVA = Math.min(((yearCA / seuilTVAAnnuel) * 100), 100);
    const progressMicro = Math.min(((yearCA / seuilMicroAnnuel) * 100), 100);

    // Alerte Objectif Personnel avec barre de progression
    if (monthCA >= objectif) {
        const overProgress = ((monthCA / objectif) * 100).toFixed(0);
        alerts.push({
            type: 'success',
            icon: '🎯',
            message: `Objectif CA mensuel atteint : ${monthCA.toFixed(0)} € (${overProgress}% de ${objectif.toFixed(0)}€)`,
            action: null,
            progress: 100,
            progressColor: '#22c55e',
            subtitle: `🎉 Félicitations ! Vous avez dépassé votre objectif de ${(monthCA - objectif).toFixed(0)}€`
        });
    } else if (monthCA >= objectif * 0.8) {
        const nearProgress = ((monthCA / objectif) * 100).toFixed(0);
        const remaining = objectif - monthCA;
        alerts.push({
            type: 'info',
            icon: '🎯',
            message: `Proche de l'objectif : ${monthCA.toFixed(0)} € (${nearProgress}%)`,
            action: null,
            progress: progressObjectif,
            progressColor: '#3b82f6',
            subtitle: `Plus que ${remaining.toFixed(0)}€ pour atteindre votre objectif de ${objectif.toFixed(0)}€`
        });
    }

    // Alertes seuils fiscaux ANNUELS avec barres de progression
    if (yearCA >= seuilMicroAnnuel * 0.9) {
        const microPercent = ((yearCA / seuilMicroAnnuel) * 100).toFixed(0);
        const remaining = seuilMicroAnnuel - yearCA;
        const isOver = yearCA >= seuilMicroAnnuel;
        alerts.push({
            type: isOver ? 'error' : 'warning',
            icon: isOver ? '🚨' : '⚠️',
            message: `Seuil Micro-BNC annuel : ${yearCA.toFixed(0)} € / ${seuilMicroAnnuel.toFixed(0)} € (${microPercent}%)`,
            action: null,
            progress: progressMicro,
            progressColor: isOver ? '#dc2626' : '#f59e0b',
            subtitle: isOver
                ? `🚨 Dépassement de ${(yearCA - seuilMicroAnnuel).toFixed(0)}€ ! Consultez votre comptable`
                : `⚡ Plus que ${remaining.toFixed(0)}€ avant le plafond (CA cumulé ${today.getFullYear()})`
        });
    } else if (yearCA >= seuilTVAAnnuel * 0.9) {
        const tvaPercent = ((yearCA / seuilTVAAnnuel) * 100).toFixed(0);
        const remaining = seuilTVAAnnuel - yearCA;
        const isOver = yearCA >= seuilTVAAnnuel;
        alerts.push({
            type: isOver ? 'warning' : 'info',
            icon: isOver ? '⚡' : 'ℹ️',
            message: `Seuil TVA annuel : ${yearCA.toFixed(0)} € / ${seuilTVAAnnuel.toFixed(0)} € (${tvaPercent}%)`,
            action: null,
            progress: progressTVA,
            progressColor: isOver ? '#f59e0b' : '#3b82f6',
            subtitle: isOver
                ? `⚠️ Dépassement de ${(yearCA - seuilTVAAnnuel).toFixed(0)}€ - Anticipez la franchise TVA`
                : `📊 Plus que ${remaining.toFixed(0)}€ avant le seuil (CA cumulé ${today.getFullYear()})`
        });
    }

    // Affichage des alertes
    const alertsContainer = document.getElementById('alertsContainer');
    if (!alertsContainer) return;

    if (alerts.length === 0) {
        alertsContainer.innerHTML = `
            <div style="
                text-align: center; 
                padding: var(--space-24);
                background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
                border-radius: var(--radius-lg);
                border: 2px dashed rgba(34, 197, 94, 0.3);
            ">
                <div style="font-size: 48px; margin-bottom: var(--space-8);">✅</div>
                <p style="color: #22c55e; font-weight: var(--font-weight-semibold); font-size: var(--font-size-base); margin: 0;">
                    Aucune alerte - Tout est sous contrôle !
                </p>
            </div>
        `;
        return;
    }

    alertsContainer.innerHTML = alerts.map(alert => {
        const bgColor = {
            error: 'linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)',
            warning: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
            info: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
            success: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)'
        }[alert.type];

        const borderColor = {
            error: '#dc2626',
            warning: '#f59e0b',
            info: '#3b82f6',
            success: '#22c55e'
        }[alert.type];

        const shadowColor = {
            error: 'rgba(220, 38, 38, 0.2)',
            warning: 'rgba(245, 158, 11, 0.2)',
            info: 'rgba(59, 130, 246, 0.2)',
            success: 'rgba(34, 197, 94, 0.2)'
        }[alert.type];

        const clickable = alert.action ? 'cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;' : '';
        const onclick = alert.action ? `onclick="(${alert.action.toString()})()"` : '';
        const hoverStyle = alert.action ? 'onmouseover="this.style.transform=\'translateY(-2px)\'; this.style.boxShadow=\'0 8px 16px ' + shadowColor + '\'" onmouseout="this.style.transform=\'translateY(0)\'; this.style.boxShadow=\'0 2px 8px ' + shadowColor + '\'"' : '';

        // Barre de progression si présente
        const progressBar = alert.progress !== undefined ? `
            <div style="margin-top: var(--space-12); background: rgba(255,255,255,0.5); border-radius: 999px; height: 8px; overflow: hidden; position: relative;">
                <div style="
                    width: ${alert.progress}%;
                    height: 100%;
                    background: ${alert.progressColor};
                    border-radius: 999px;
                    transition: width 1s ease-out;
                    box-shadow: 0 0 10px ${alert.progressColor};
                "></div>
            </div>
        ` : '';

        const subtitle = alert.subtitle ? `
            <div style="
                margin-top: var(--space-8);
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                font-style: italic;
            ">
                ${alert.subtitle}
            </div>
        ` : '';

        return `
            <div style="
                padding: var(--space-16);
                background: ${bgColor};
                border-left: 5px solid ${borderColor};
                border-radius: var(--radius-lg);
                margin-bottom: var(--space-12);
                box-shadow: 0 2px 8px ${shadowColor};
                ${clickable}
            " ${onclick} ${hoverStyle}>
                <div style="display: flex; align-items: flex-start; gap: var(--space-12);">
                    <div style="
                        font-size: 32px;
                        line-height: 1;
                        flex-shrink: 0;
                        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
                    ">
                        ${alert.icon}
                    </div>
                    <div style="flex: 1;">
                        <div style="
                            font-size: var(--font-size-base);
                            font-weight: var(--font-weight-semibold);
                            color: var(--color-text-primary);
                            line-height: 1.4;
                        ">
                            ${alert.message}
                        </div>
                        ${subtitle}
                        ${progressBar}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}