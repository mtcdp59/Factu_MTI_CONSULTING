import { showToast } from "./toast.js";
import { getCompanyInfo } from "./config.js";
import { callBackend } from "./api.js";

// Export FEC (Fichier des Écritures Comptables)
export async function exportFEC() {
    try {
        // Demander l'exercice comptable à l'utilisateur
        const yearStr = prompt('Année de l\'exercice comptable (ex: 2025):', new Date().getFullYear());
        if (!yearStr) return;

        const year = parseInt(yearStr);
        if (isNaN(year) || year < 2000 || year > 2100) {
            showToast('⚠️ Année invalide', 'error');
            return;
        }

        // Format YYYYMMDD pour le FEC
        const exerciceStart = year + '0101'; // 1er janvier
        const exerciceEnd = year + '1231';   // 31 décembre

        // Extraire SIREN du SIRET (9 premiers chiffres)
        const siret = getCompanyInfo().siret || '000000000';
        const siren = siret.replace(/\s/g, '').substring(0, 9);

        showToast('⏳ Génération du FEC en cours...', 'info');

        const result = await callBackend('generateFEC', {
            exerciceStart: exerciceStart,
            exerciceEnd: exerciceEnd,
            siren: siren
        });

        console.log('📦 Réponse FEC:', result);

        if (!result.success) {
            showToast('❌ Erreur: ' + result.message, 'error');
            return;
        }

        const { filename, content, lineCount, invoiceCount, debug } = result.data;

        // Afficher les infos de débogage
        if (debug) {
            console.log('🔍 Debug FEC:', debug);
            console.log(`  Total factures: ${debug.totalInvoices}`);
            console.log(`  Factures retenues: ${debug.filteredInvoices}`);
            console.log(`  Factures exclues: ${debug.excludedCount}`);
            console.log(`  Échantillon:`, debug.sampleInvoices);
        }

        // Télécharger le fichier FEC
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`✅ FEC exporté : ${invoiceCount} facture(s), ${lineCount} ligne(s)`, 'success');

        console.log('FEC généré:', filename, 'Lignes:', lineCount, 'Factures:', invoiceCount);
    } catch (error) {
        console.error('Erreur export FEC:', error);
        showToast('❌ Erreur lors de l\'export FEC: ' + error.message, 'error');
    }
}