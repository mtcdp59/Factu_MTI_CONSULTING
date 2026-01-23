// Affiche la réponse brute du backend dans la modal de test (utile pour diagnostiquer)
export function showBackendRawResponse(text) {
    try {
        const modal = document.getElementById('backendModal');
        const pre = document.getElementById('backendRawResponse');
        if (pre) pre.textContent = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
        if (modal) modal.classList.add('show');
    } catch (e) {
        console.error('Impossible d\'afficher la réponse brute du backend:', e);
    }
}