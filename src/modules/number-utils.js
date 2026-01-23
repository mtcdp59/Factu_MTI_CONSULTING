// Format number with thousands separator (space)
export function formatNumber(number, decimals = 2) {
    if (number === null || number === undefined || isNaN(number)) return '0,00';

    const num = parseFloat(number);
    const parts = num.toFixed(decimals).split('.');

    // Add space separator for thousands
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    // Use comma for decimal separator (French format)
    return parts.join(',');
}