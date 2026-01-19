// Toast notification with types
export function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');

    let borderColor = 'var(--color-success)';
    let bgColor = 'var(--color-surface)';

    if (type === 'error') {
        borderColor = 'var(--color-error)';
    } else if (type === 'info') {
        borderColor = '#3B82F6';
    }

    toast.style.cssText = `
        background-color: ${bgColor};
        border: 1px solid var(--color-border);
        border-left: 4px solid ${borderColor};
        padding: var(--space-16);
        border-radius: var(--radius-base);
        box-shadow: var(--shadow-lg);
        max-width: 350px;
        font-size: var(--font-size-base);
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s, transform 0.3s';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}