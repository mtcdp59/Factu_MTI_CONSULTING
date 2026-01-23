import { getFilteredInvoices } from "./invoices.js";

// Charts
export function renderCharts() {
    renderCAChart();
    renderStatusChart();
}

export function renderCAChart() {
    const canvas = document.getElementById('caChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 48;
    canvas.height = 350;

    // Get full year data (12 months)
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const monthValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const data = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    // FIX: Utiliser getFilteredInvoices() au lieu de invoices directement
    // Exclude cancelled invoices from CA chart
    const filteredInvoices = getFilteredInvoices().filter(inv => inv.status !== 'Annulée');
    filteredInvoices.forEach(inv => {
        const invDate = new Date(inv.date);
        const monthIndex = monthValues.indexOf(invDate.getMonth() + 1);
        if (monthIndex !== -1 && invDate.getFullYear() === 2025) {
            data[monthIndex] += inv.total || 0;
        }
    });

    // Draw chart
    const maxValue = Math.max(...data, 1);
    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const barWidth = chartWidth / months.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#626C71';
    ctx.font = '12px -apple-system, sans-serif';

    // Draw bars
    data.forEach((value, index) => {
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding + index * barWidth + barWidth * 0.2;
        const y = padding + chartHeight - barHeight;
        const width = barWidth * 0.6;

        ctx.fillStyle = '#21808D';
        ctx.fillRect(x, y, width, barHeight);

        // Labels
        ctx.fillStyle = '#134252';
        ctx.textAlign = 'center';
        ctx.fillText(months[index], x + width / 2, canvas.height - 10);

        if (value > 0) {
            ctx.fillText(value.toFixed(0) + '€', x + width / 2, y - 5);
        }
    });
}

export function renderStatusChart() {
    const canvas = document.getElementById('statusChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 48;
    canvas.height = 300;

    // Count by status (exclude cancelled from main chart)
    const statusCounts = {
        'Brouillon': 0,
        'Envoyée': 0,
        'Payée': 0,
        'Retard': 0
    };

    // FIX: Utiliser getFilteredInvoices() au lieu de invoices directement
    // Exclude cancelled invoices from status chart
    const filteredInvoices = getFilteredInvoices().filter(inv => inv.status !== 'Annulée');
    filteredInvoices.forEach(inv => {
        statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
    });

    // Palette alignée sur les variables CSS pour cohérence avec les badges
    const rootStyle = getComputedStyle(document.documentElement);
    const colors = {
        'Brouillon': rootStyle.getPropertyValue('--color-slate-500').trim() || '#626C71',
        'Envoyée': '#1D4ED8',
        'Payée': rootStyle.getPropertyValue('--color-success').trim() || '#10B981',
        'Retard': rootStyle.getPropertyValue('--color-error').trim() || '#DC2626'
    };

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    if (total === 0) return;

    // Draw pie chart
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 - 20;
    const radius = Math.min(centerX, centerY) - 40;

    let currentAngle = -Math.PI / 2;

    Object.keys(statusCounts).forEach((status) => {
        const count = statusCounts[status];
        if (count === 0) return;

        const sliceAngle = (count / total) * Math.PI * 2;

        ctx.fillStyle = colors[status];
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();

        currentAngle += sliceAngle;
    });

    // Draw legend
    const legendY = canvas.height - 50;
    let legendX = 20;

    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'left';

    Object.keys(statusCounts).forEach(status => {
        const count = statusCounts[status];

        ctx.fillStyle = colors[status];
        ctx.fillRect(legendX, legendY, 12, 12);

        ctx.fillStyle = '#134252';
        ctx.fillText(`${status} (${count})`, legendX + 18, legendY + 10);

        legendX += 120;
    });
}