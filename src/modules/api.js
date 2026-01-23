import { showBackendRawResponse } from "./debug.js";
import {
    autoFillClientFromSIRET,
    updateCFEEstimation,
    updateSiretStatus
} from "./company.js";
import {
    getClients,
    getCompanyInfo,
    getInvoices,
    getRams
} from "./config.js";
import { buildInvoiceHtml } from "./invoices.js";
import { formatNumber } from "./number-utils.js";
import { showToast } from "./toast.js";
import { formatDateFR } from "./date-utils.js";
import { communeInput } from "./event-listener.js";
import { buildQuoteHtml } from "./quotes.js";
import { CONFIG } from './config.js';

const MON_ENTREPRISE_API_BASE = 'https://mon-entreprise.urssaf.fr/api/v1';

// Cache API CFE (localStorage)
const CFE_CACHE_KEY = 'mti_cfe_api_cache';
const CFE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 jours

// Fonction recherche communes dynamique via API
let communesSearchCache = {};

// Cache validation SIRET (90 jours)
const SIRET_CACHE_KEY = 'mti_siret_cache';
const SIRET_CACHE_TTL = 90 * 24 * 60 * 60 * 1000; // 90 jours
const INSEE_API_KEY = '84dbb5c2-6a3c-41d4-9bb5-c26a3c41d4f4'; // Clé API SIRENE INSEE

// Base de données codes INSEE + codes postaux principales communes (fallback)
const inseeCodesDB = {
    'paris': { insee: '75056', cp: '75000' },
    'lyon': { insee: '69123', cp: '69000' },
    'marseille': { insee: '13055', cp: '13000' },
    'toulouse': { insee: '31555', cp: '31000' },
    'nice': { insee: '06088', cp: '06000' },
    'nantes': { insee: '44109', cp: '44000' },
    'montpellier': { insee: '34172', cp: '34000' },
    'strasbourg': { insee: '67482', cp: '67000' },
    'bordeaux': { insee: '33063', cp: '33000' },
    'lille': { insee: '59350', cp: '59000' },
    'rennes': { insee: '35238', cp: '35000' },
    'reims': { insee: '51454', cp: '51100' },
    'tourcoing': { insee: '59599', cp: '59200' },
    'roubaix': { insee: '59512', cp: '59100' },
    'la madeleine': { insee: '59368', cp: '59110' },
    'madeleine': { insee: '59368', cp: '59110' } // Alias pour recherche partielle
};

// Base de données CFE fallback (estimations si API échoue)
const cfeFallbackDB = {
    'paris': 2433,
    'lyon': 1500,
    'marseille': 1200,
    'toulouse': 900,
    'nice': 1100,
    'nantes': 800,
    'montpellier': 750,
    'strasbourg': 850,
    'bordeaux': 950,
    'lille': 700,
    'rennes': 650,
    'reims': 600,
    'la madeleine': 418,
    'default': 600
};

// Helper to call the Apps Script backend with better error handling and CORS guidance
export async function callBackend(action, payload = {}) {
    // Vérifier si le backend est configuré
    if (!CONFIG.BACKEND_URL || CONFIG.BACKEND_URL.includes('VOTRE_SCRIPT_ID')) {
        throw new Error('Backend non configuré. Allez dans Paramètres → Configuration Technique');
    }

    try {
        // Prepare the body with action and payload
        const body = JSON.stringify(Object.assign({ action }, payload));

        console.debug('Calling backend:', CONFIG.BACKEND_URL, 'action:', action);

        // POST without explicit Content-Type header to avoid CORS preflight
        // This keeps the Content-Type as text/plain;charset=UTF-8 which is a "simple" request
        // Simple requests don't trigger CORS preflight OPTIONS
        const resp = await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            body: body,
            // Don't set Content-Type header explicitly - let browser use text/plain
            // This prevents CORS preflight which Google Apps Script doesn't handle well
        });

        // If the response is opaque due to CORS misconfiguration, resp.ok will be false or fetch may throw
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            const errMsg = `Backend returned status ${resp.status}. ${text}`;
            console.error('Backend error:', errMsg);
            // Show raw backend response to help debugging
            showBackendRawResponse(`HTTP ${resp.status}\n\n${text}`);
            throw new Error(errMsg);
        }

        // Try to parse JSON, fall back to text
        const txt = await resp.text();
        try {
            return JSON.parse(txt);
        } catch (e) {
            return { success: true, data: txt };
        }
    } catch (err) {
        console.error('callBackend error (possible CORS or network issue):', err);
        // Show error details in backend tester modal for faster diagnosis
        try { showBackendRawResponse(String(err.stack || err.message || err)); } catch (e) {}
        // Provide actionable error for the user/developer
        throw new Error('Impossible de contacter le BACKEND. Vérifiez que le script Apps Script est déployé et qu\'il autorise les requêtes CORS (Access-Control-Allow-Origin). Détails: ' + (err.message || err));
    }
}

// JSONP fallback for simple GET-based actions to avoid CORS preflight when running from file://
export function callBackendJSONP(action, params = {}) {
    return new Promise((resolve, reject) => {
        try {
            const cbName = '__mti_cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
            window[cbName] = function(res) {
                try { delete window[cbName]; } catch (e) {}
                if (script && script.parentNode) script.parentNode.removeChild(script);
                resolve(res);
            };

            const query = new URLSearchParams(Object.assign({}, params, { action }));
            const src = CONFIG.BACKEND_URL + '?' + query.toString() + '&callback=' + cbName;
            const script = document.createElement('script');
            script.src = src;
            script.onerror = function(err) {
                try { delete window[cbName]; } catch (e) {}
                if (script && script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('JSONP load error'));
            };
            document.head.appendChild(script);
        } catch (err) {
            reject(err);
        }
    });
}

// Quick backend tester (uses GET to call doGet and shows raw response in a modal)
export async function testBackend() {
    const modal = document.getElementById('backendModal');
    const pre = document.getElementById('backendRawResponse');
    if (pre) pre.textContent = '⏳ Test en cours...';
    try {
        const resp = await fetch(CONFIG.BACKEND_URL, { method: 'GET' });
        const text = await resp.text();
        if (pre) pre.textContent = text;
        if (modal) modal.classList.add('show');
    } catch (err) {
        const msg = 'Erreur lors du test BACKEND: ' + (err.message || err);
        console.error(msg, err);
        if (pre) pre.textContent = msg + '\n\nVérifiez que `CONFIG.BACKEND_URL` est correct et que le Web App Apps Script est déployé.';
        if (modal) modal.classList.add('show');
    }
}

/**
 * Evaluate Publicodes expressions via Mon-entreprise API
 * @param {Object} situation - Publicodes situation (inputs)
 * @param {Array<string>} expressions - List of expressions (rules) to evaluate
 * @returns {Promise<Object>} Map of expression -> { value, unit, nodeValue }
 */
export async function evaluateMonEntreprise(situation, expressions, attempt = 1) {
    try {
        const res = await fetch(`${MON_ENTREPRISE_API_BASE}/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ situation, expressions })
        });
        if (res.status === 429 && attempt < 5) {
            // Gestion du Retry-After si présent, sinon backoff exponentiel
            let delay = 0;
            const retryAfter = res.headers.get('Retry-After');
            if (retryAfter) {
                // Retry-After peut être en secondes ou en date HTTP
                const retryNum = parseInt(retryAfter, 10);
                if (!isNaN(retryNum)) {
                    delay = retryNum * 1000;
                } else {
                    // Si c'est une date, calculer la différence
                    const retryDate = new Date(retryAfter);
                    const now = new Date();
                    delay = Math.max(retryDate - now, 1000);
                }
            } else {
                delay = Math.pow(2, attempt - 1) * 1000;
            }
            // Ajout d'une gigue aléatoire (jitter)
            delay += Math.floor(Math.random() * 500);
            console.warn(`Rate limited on evaluate, retry after ${delay}ms (attempt ${attempt})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return evaluateMonEntreprise(situation, expressions, attempt + 1);
        }
        if (!res.ok) {
            console.warn(`URSSAF API HTTP error: ${res.status} ${res.statusText}`);
            throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        console.log('URSSAF API raw response:', data);
        // L'API retourne soit 'evaluate' (nouveau format) soit 'evaluations' (ancien format)
        return data?.evaluate || data?.evaluations || null;
    } catch (err) {
        console.warn('URSSAF evaluate error, using local values', err);
        return null; // caller handles fallback
    }
}

/**
 * Fetch rule details with exponential backoff
 * @param {string} rule - Publicodes rule name
 */
export async function fetchUrssafRule(rule, attempt = 1) {
    try {
        const res = await fetch(`${MON_ENTREPRISE_API_BASE}/rules/${encodeURIComponent(rule)}`);
        if (res.status === 429 && attempt < 5) {
            // Gestion du Retry-After si présent, sinon backoff exponentiel
            let delay = 0;
            const retryAfter = res.headers.get('Retry-After');
            if (retryAfter) {
                const retryNum = parseInt(retryAfter, 10);
                if (!isNaN(retryNum)) {
                    delay = retryNum * 1000;
                } else {
                    const retryDate = new Date(retryAfter);
                    const now = new Date();
                    delay = Math.max(retryDate - now, 1000);
                }
            } else {
                delay = Math.pow(2, attempt - 1) * 1000;
            }
            delay += Math.floor(Math.random() * 500);
            console.warn(`Rate limited on ${rule}, retry after ${delay}ms (attempt ${attempt})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchUrssafRule(rule, attempt + 1);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn('URSSAF rule fetch failed', rule, err);
        return null;
    }
}

// Fonction récupération CFE depuis API Open Data Soft
export async function getCFEFromAPI(commune) {
    const communeLower = commune.toLowerCase();

    // 1. Vérifier cache localStorage
    const cache = JSON.parse(localStorage.getItem(CFE_CACHE_KEY) || '{}');
    const cached = cache[communeLower];
    if (cached && Date.now() - cached.timestamp < CFE_CACHE_TTL) {
        return { taux: cached.taux, source: 'API (cache)', inseeCode: cached.inseeCode };
    }

    // 2. Rechercher code INSEE (recherche par nom ou code postal)
    let inseeCode = null;
    for (const [ville, data] of Object.entries(inseeCodesDB)) {
        // Recherche par nom de ville (partielle)
        if (communeLower.includes(ville) || ville.includes(communeLower)) {
            inseeCode = data.insee;
            break;
        }
        // Recherche par code postal
        if (data.cp && communeLower.replace(/\s/g, '') === data.cp.replace(/\s/g, '')) {
            inseeCode = data.insee;
            break;
        }
    }

    if (!inseeCode) {
        // Fallback estimation si commune inconnue
        const fallback = cfeFallbackDB[communeLower] || cfeFallbackDB.default;
        return { taux: fallback, source: 'Estimation (commune non référencée)', inseeCode: null };
    }

    // 3. Appel API Open Data Soft
    try {
        const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-entreprises/records?limit=1&refine=exercice:"2024"&refine=insee_com:"${inseeCode}"`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const tauxCFE = result.taux_global_cfe_hz;

            if (tauxCFE !== null && tauxCFE !== undefined) {
                // Conversion taux (%) vers base minimale estimée (€)
                // Note: l'API donne le TAUX CFE, pas la base minimale
                // Base minimale 2024: entre 237€ et 7,349€ selon CA
                // Estimation base minimale moyenne: 1,200€
                const baseMinimaleEstimee = 1200;
                const cfeEstimee = Math.round((tauxCFE / 100) * baseMinimaleEstimee);

                // Mise à jour cache
                cache[communeLower] = {
                    taux: cfeEstimee,
                    inseeCode: inseeCode,
                    timestamp: Date.now()
                };
                localStorage.setItem(CFE_CACHE_KEY, JSON.stringify(cache));

                return { taux: cfeEstimee, source: 'API DGFiP 2024 (taux officiel)', inseeCode: inseeCode, tauxPct: tauxCFE };
            }
        }

        // Si API ne retourne pas de résultat, utiliser fallback
        const fallback = cfeFallbackDB[communeLower] || cfeFallbackDB.default;
        return { taux: fallback, source: 'Estimation (données API incomplètes)', inseeCode: inseeCode };

    } catch (error) {
        console.warn('Erreur API CFE:', error);
        const fallback = cfeFallbackDB[communeLower] || cfeFallbackDB.default;
        return { taux: fallback, source: 'Estimation (erreur API)', inseeCode: inseeCode };
    }
}

export async function searchCommunesAPI(query) {
    const autocompleteDiv = document.getElementById('communeAutocomplete');
    if (!autocompleteDiv) return;

    if (!query || query.length < 2) {
        autocompleteDiv.style.display = 'none';
        return;
    }

    // Vérifier cache
    if (communesSearchCache[query]) {
        displayCommunesResults(communesSearchCache[query]);
        return;
    }

    // Afficher loading
    autocompleteDiv.style.display = 'block';
    autocompleteDiv.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--color-text-secondary);">🔄 Recherche...</div>';

    try {
        // API Open Data Soft - Recherche communes avec support jokers (*)
        // Remplacer les jokers utilisateur (%, *) par des espaces pour recherche partielle
        const cleanQuery = query.replace(/[%*]/g, ' ');

        // Recherche par nom de commune (partielle, insensible à la casse)
        // Note: code_postal retiré car champ supprimé par Data.gouv (décembre 2025)
        const searchByName = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-entreprises/records?select=libcom,insee_com&where=search(libcom,'${encodeURIComponent(cleanQuery)}')&group_by=libcom,insee_com&limit=10&refine=exercice:"2024"`;

        // Recherche par code postal désactivée (champ supprimé de l'API)
        let searchByCP = null;

        // Lancer la recherche
        const promises = [await fetch(searchByName)];

        const responses = await Promise.all(promises);
        const dataResults = await Promise.all(responses.map(r => r.json()));

        // Fusionner les résultats (dédupliquer par INSEE)
        const allResults = [];
        const seenInsee = new Set();

        dataResults.forEach(data => {
            if (data.results) {
                data.results.forEach(r => {
                    if (!seenInsee.has(r.insee_com)) {
                        seenInsee.add(r.insee_com);
                        allResults.push(r);
                    }
                });
            }
        });

        if (allResults.length > 0) {
            communesSearchCache[query] = allResults;
            displayCommunesResults(allResults);
        } else {
            autocompleteDiv.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--color-text-secondary);">Aucune commune trouvée<br><small>Astuce: Essayez une recherche partielle (ex: "MADEL" pour La Madeleine) ou un code postal (59110)</small></div>';
        }
    } catch (error) {
        console.error('Erreur recherche communes:', error);
        autocompleteDiv.innerHTML = '<div style="padding: 12px; text-align: center; color: red;">❌ Erreur API</div>';
    }
}

export async function validateSIRET(siret, statusElementId, infoElementId) {
    const statusEl = document.getElementById(statusElementId);
    const infoEl = document.getElementById(infoElementId);

    if (!statusEl || !infoEl) return;

    // Vérifier format (14 chiffres)
    if (!/^\d{14}$/.test(siret)) {
        updateSiretStatus(statusElementId, infoElementId, 'error', 'Format invalide (14 chiffres requis)');
        return;
    }

    // Vérifier cache
    const cache = JSON.parse(localStorage.getItem(SIRET_CACHE_KEY) || '{}');
    const cached = cache[siret];
    if (cached && Date.now() - cached.timestamp < SIRET_CACHE_TTL) {
        const cacheLabel = cached.source === 'insee' ? '💾' : '⚠️';
        const btnId = `fill-${statusElementId}`;
        updateSiretStatus(statusElementId, infoElementId, 'valid',
            `✅ ${cached.nom} (${cached.etat}) ${cacheLabel} Cache<br><button id="${btnId}" style="margin-top: 4px; padding: 4px 8px; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">📋 Remplir les champs</button>`
        );

        // Event listener pour bouton de remplissage manuel
        setTimeout(() => {
            const fillBtn = document.getElementById(btnId);
            if (fillBtn) {
                fillBtn.addEventListener('click', () => {
                    autoFillClientFromSIRET(statusElementId, cached);
                });
            }
        }, 100);

        return;
    }

    // Loading
    updateSiretStatus(statusElementId, infoElementId, 'loading', '🔄 Vérification INSEE...');

    try {
        // API SIRENE INSEE Officielle (https://api.insee.fr/api-sirene/3.11)
        const url = `https://api.insee.fr/api-sirene/3.11/siret/${siret}`;
        const response = await fetch(url, {
            headers: {
                'X-INSEE-Api-Key-Integration': INSEE_API_KEY,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();

            if (data.etablissement) {
                const etab = data.etablissement;
                const ul = etab.uniteLegale;
                const periode = etab.periodesEtablissement[0]; // Période la plus récente

                // Extraction données
                const nom = ul.denominationUniteLegale ||
                    `${ul.prenomUsuelUniteLegale || ''} ${ul.nomUniteLegale || ''}`.trim() ||
                    ul.denominationUsuelle1UniteLegale ||
                    'Entreprise sans dénomination';

                const etat = periode.etatAdministratifEtablissement === 'A' ? 'Actif' : 'Fermé';
                const etatUL = ul.etatAdministratifUniteLegale === 'A' ? 'Active' : 'Cessée';

                // Adresse
                const adr = etab.adresseEtablissement;
                const adresse = [
                    adr.numeroVoieEtablissement,
                    adr.typeVoieEtablissement,
                    adr.libelleVoieEtablissement,
                    adr.codePostalEtablissement,
                    adr.libelleCommuneEtablissement
                ].filter(Boolean).join(' ');

                // Informations complémentaires
                const sigle = ul.sigleUniteLegale ? ` (${ul.sigleUniteLegale})` : '';
                const categorieJuridique = ul.categorieJuridiqueUniteLegale;
                const naf = etab.uniteLegale.activitePrincipaleUniteLegale;
                const typeSiege = etab.etablissementSiege ? 'Siège social' : 'Établissement';

                // Mise à jour cache
                cache[siret] = {
                    nom: nom + sigle,
                    etat: etat,
                    etatUL: etatUL,
                    adresse: adresse,
                    categorieJuridique: categorieJuridique,
                    naf: naf,
                    typeSiege: typeSiege,
                    source: 'insee',
                    timestamp: Date.now()
                };
                localStorage.setItem(SIRET_CACHE_KEY, JSON.stringify(cache));

                // Affichage résultat détaillé
                const etablissementLabel = etab.etablissementSiege ? '🏢 Siège' : '📍 Établissement';
                const message = `✅ ${nom}${sigle} (${etat} - ${etatUL})<br>${etablissementLabel} ${adresse}<br><small>NAF: ${naf} | CJ: ${categorieJuridique}</small>`;
                updateSiretStatus(statusElementId, infoElementId, 'valid', message);

                // Auto-remplissage des champs client si SIRET valide
                autoFillClientFromSIRET(statusElementId, cache[siret]);
            } else {
                updateSiretStatus(statusElementId, infoElementId, 'error', '❌ SIRET non trouvé dans la base SIRENE INSEE');
            }
        } else if (response.status === 404) {
            updateSiretStatus(statusElementId, infoElementId, 'error', '❌ SIRET non trouvé (404)');
        } else if (response.status === 401 || response.status === 403) {
            // Fallback vers API Recherche Entreprises si problème de clé
            console.warn('Erreur authentification INSEE, fallback vers API Recherche Entreprises');
            await validateSIRETFallback(siret, statusElementId, infoElementId, cache);
        } else {
            updateSiretStatus(statusElementId, infoElementId, 'error', `⚠️ Erreur API (${response.status})`);
        }
    } catch (error) {
        console.error('Erreur validation SIRET INSEE:', error);
        // Fallback vers API Recherche Entreprises
        await validateSIRETFallback(siret, statusElementId, infoElementId, cache);
    }
}

// Fonction fallback si API INSEE échoue
export async function validateSIRETFallback(siret, statusElementId, infoElementId, cache) {
    try {
        const url = `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const entreprise = data.results[0];
            const nom = entreprise.nom_complet || entreprise.nom_raison_sociale;
            const etat = entreprise.etat_administratif === 'A' ? 'Actif' : 'Fermé';
            const adresse = entreprise.siege?.adresse || '';

            // Mise à jour cache (source: fallback)
            cache[siret] = {
                nom: nom,
                etat: etat,
                adresse: adresse,
                source: 'fallback',
                timestamp: Date.now()
            };
            localStorage.setItem(SIRET_CACHE_KEY, JSON.stringify(cache));

            // Affichage résultat
            const message = `✅ ${nom} (${etat})${adresse ? `<br>${adresse}` : ''}<br><small>⚠️ Source: API Recherche Entreprises (fallback)</small>`;
            updateSiretStatus(statusElementId, infoElementId, 'valid', message);

            // Auto-remplissage des champs client (fallback)
            autoFillClientFromSIRET(statusElementId, cache[siret]);
        } else {
            updateSiretStatus(statusElementId, infoElementId, 'error', '❌ SIRET non trouvé');
        }
    } catch (error) {
        console.error('Erreur fallback SIRET:', error);
        updateSiretStatus(statusElementId, infoElementId, 'error', '⚠️ Erreur API (vérifiez votre connexion)');
    }
}

// Générer PDF en base64 en priorité via html2canvas -> jsPDF pour conserver le rendu HTML, sinon fallback jsPDF legacy
export async function generateInvoicePDFBase64(invoice) {

    // Build HTML for the invoice. Prefer using the on-page preview DOM if present
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = 'auto';
    tempContainer.style.padding = '0';

    // Try to fetch logo as data URI using LOCAL asset to avoid CORS
    let originalLogo = getCompanyInfo().logoUrl;
    let logoDataUri = null;
    try {
        logoDataUri = await fetchImageAsDataUri('../assets/images/MTI_CONSULTING.png');
        if (logoDataUri) getCompanyInfo().logoUrl = logoDataUri;
    } catch (e) {
        console.warn('Inline local logo failed', e);
    }

    try {
        // Always use the shared HTML builder (same as Devis) for consistent layout/margins/footer
        tempContainer.innerHTML = buildInvoiceHtml({
            clientName: invoice.client || '',
            clientAddress: invoice.clientAddress || '',
            invoiceNumber: invoice.number || '',
            invoiceDate: invoice.date || '',
            dueDate: invoice.dueDate || '',
            description: invoice.description || '',
            quantity: invoice.quantity || 0,
            unitPrice: invoice.unitPrice || 0,
            total: invoice.total || 0,
            tvaEnabled: document.getElementById('tvaToggle') && document.getElementById('tvaToggle').checked,
            items: invoice.items || [],
            sourceQuoteNumber: invoice.sourceQuoteNumber || ''
        });
    } finally {
        // restore original logo setting
        getCompanyInfo().logoUrl = originalLogo;
    }

    document.body.appendChild(tempContainer);
    // Restore the html2canvas-first path (same as quotes)
    if (window.html2canvas && window.jspdf) {
        try {
            const { jsPDF } = window.jspdf;
            const pdfDoc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdfDoc.internal.pageSize.getWidth();
            const pageHeight = pdfDoc.internal.pageSize.getHeight();
            const a4WidthPx = 794;
            const a4HeightPx = 1123;
            tempContainer.style.width = a4WidthPx + 'px';
            tempContainer.style.height = a4HeightPx + 'px';

            const canvasScale = 2.0;
            const canvas = await html2canvas(tempContainer, { scale: canvasScale, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            pdfDoc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
            const dataUri = pdfDoc.output('datauristring');
            try { document.body.removeChild(tempContainer); } catch(e) {}
            return dataUri.split(',')[1];
        } catch (err) {
            console.warn('html2canvas/pdf path failed, falling back to legacy jsPDF:', err);
            try { document.body.removeChild(tempContainer); } catch(e) {}
            // Fall through to legacy below
        }
    } else {
        try { document.body.removeChild(tempContainer); } catch(e) {}
    }

    // Legacy fallback: use jsPDF autoTable-based generator if available
    if (!window.jspdf) {
        throw new Error('Aucune méthode de génération PDF disponible (html2canvas ou jsPDF manquants).');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Logo - prefer previously inlined local data URI; never fetch GitHub
    if (logoDataUri) {
        try { doc.addImage(logoDataUri, 'PNG', 20, 20, 30, 30); } catch(e) { /* ignore */ }
    }

    // En-tête
    doc.setFontSize(20);
    doc.text(getCompanyInfo().name, 60, 30);
    doc.setFontSize(10);
    doc.text(getCompanyInfo().address, 60, 37);
    doc.text(`${getCompanyInfo().postalCode} ${getCompanyInfo().city}`, 60, 42);
    doc.text(`SIRET : ${getCompanyInfo().siret}`, 60, 47);

    // Titre
    doc.setFontSize(18);
    doc.text(`FACTURE ${invoice.number}`, 20, 70);

    // Client
    doc.setFontSize(10);
    doc.text('Client :', 20, 85);
    doc.text(invoice.client, 20, 90);
    if (invoice.clientSiret) doc.text(`SIRET : ${invoice.clientSiret}`, 20, 95);

    // Dates
    doc.text(`Date : ${formatDateFR(invoice.date)}`, 120, 85);
    doc.text(`Échéance : ${formatDateFR(invoice.dueDate)}`, 120, 90);

    // Tableau multi-lignes
    if (doc.autoTable) {
        // Support multi-lignes (v2.0) : utiliser items[] si disponible, sinon fallback ancien format
        const tableBody = invoice.items && invoice.items.length > 0
            ? invoice.items.map(item => [
                item.description || '',
                (item.quantity || 0).toString(),
                `${formatNumber((item.unitPrice || 0))} €`,
                `${formatNumber(((item.quantity || 0) * (item.unitPrice || 0)))} €`
            ])
            : [[
                invoice.description || '',
                (invoice.quantity || 0).toString(),
                `${formatNumber((invoice.unitPrice || 0))} €`,
                `${formatNumber((invoice.total || 0))} €`
            ]];

        doc.autoTable({
            startY: 120,
            head: [['Description', 'Quantité', 'Prix unitaire', 'Total HT']],
            body: tableBody,
            colWidth: [85, 25, 35, 35],
            margin: { top: 10, right: 20, bottom: 50, left: 20 }
        });
    } else {
        // Fallback sans autoTable
        if (invoice.items && invoice.items.length > 0) {
            let y = 120;
            invoice.items.forEach(item => {
                doc.text(`${item.description} - ${item.quantity} x ${item.unitPrice}€ = ${formatNumber((item.quantity * item.unitPrice))} €`, 20, y);
                y += 7;
            });
        } else {
            doc.text(invoice.description || '', 20, 120);
        }
    }

    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 140;
    const tva = (invoice.total || 0) * 0.2;
    const ttc = (invoice.total || 0) + tva;

    doc.text(`Total HT : ${formatNumber((invoice.total || 0))} €`, 120, finalY);
    doc.text(`TVA 20% : ${formatNumber(tva)} €`, 120, finalY + 7);
    doc.setFontSize(12);
    doc.text(`Total TTC : ${formatNumber(ttc)} €`, 120, finalY + 14);

    // Footer en bas de page (Y=270 pour marge sûre avant limite 297mm A4)
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    const footerY = 270;
    doc.text(`${getCompanyInfo().name} - SIRET: ${getCompanyInfo().siret}`, 105, footerY, { align: 'center' });
    doc.text(`${getCompanyInfo().email} - ${getCompanyInfo().phone}`, 105, footerY + 4, { align: 'center' });
    doc.text(`${getCompanyInfo().website || 'www.mticonsulting.fr'}`, 105, footerY + 8, { align: 'center' });

    return doc.output('datauristring').split(',')[1];
}

// Envoyer le RAM par email
export async function sendRAMEmail(ramId) {
    const ram = window.currentRAM || getRams().find(r => r.id === ramId);
    if (!ram) {
        showToast('❌ RAM introuvable', 'error');
        return;
    }

    const clientObj = getClients().find(c => c.name === ram.client);
    if (!clientObj || !clientObj.email_facturation) {
        showToast('❌ Email du client introuvable', 'error');
        return;
    }

    try {
        showToast('⏳ Génération et envoi du RAM...');
        const pdfBase64 = await generateRAMPDF(ram);

        // Envoyer via le backend
        const response = await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'sendRAMEmail',
                to: clientObj.email_facturation,
                client: ram.client,
                month: ram.monthName,
                year: ram.year,
                pdfBase64: pdfBase64
            })
        });

        const result = await response.json();
        if (result.success) {
            showToast('✅ RAM envoyé avec succès !', 'success');
        } else {
            throw new Error(result.error || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('Erreur envoi RAM:', error);
        showToast('❌ Erreur lors de l\'envoi: ' + error.message, 'error');
    }
}

// Envoyer facture + RAM ensemble (si liés)
export async function sendInvoiceWithRAM(invoiceIndex) {
    const invoice = getInvoices()[invoiceIndex];
    if (!invoice) {
        showToast('❌ Facture introuvable', 'error');
        return;
    }

    // Chercher un RAM lié à cette facture
    const linkedRAM = getRams().find(r => r.invoiceNumber === invoice.number);

    if (!linkedRAM) {
        showToast('⚠️ Aucun RAM lié à cette facture', 'error');
        return;
    }

    const clientObj = getClients().find(c => c.name === invoice.client);
    if (!clientObj || !clientObj.email_facturation) {
        showToast('❌ Email du client introuvable', 'error');
        return;
    }

    try {
        showToast('⏳ Génération facture + RAM...');

        // Générer les deux PDFs
        const invoicePdf = await generateInvoicePDFBase64(invoice);
        const ramPdf = await generateRAMPDF(linkedRAM);

        // Noms de fichiers
        const invoiceFilename = `Facture_${String(invoice.number || Date.now()).replace(/^(FACTURE|INVOICE)[-_ ]?/i, '').replace(/\//g, '_')}.pdf`;
        const ramFilename = `RAM_${linkedRAM.year}_${linkedRAM.monthName}_${invoice.client.replace(/[^a-z0-9]/gi, '_')}.pdf`;

        // Corps de l'email
        const invoiceBody = `Montant total : ${formatNumber(invoice.total)} €\nÉchéance : ${formatDateFR(invoice.dueDate)}`;

        // Envoyer via le backend
        const response = await fetch(CONFIG.BACKEND_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'sendInvoiceWithRAM',
                to: clientObj.email_facturation,
                client: invoice.client,
                invoiceFilename: invoiceFilename,
                ramFilename: ramFilename,
                invoiceBody: invoiceBody,
                invoicePdfBase64: invoicePdf,
                ramPdfBase64: ramPdf,
                month: linkedRAM.monthName,
                year: linkedRAM.year
            })
        });

        const result = await response.json();
        if (result.success) {
            showToast('✅ Facture + RAM envoyés avec succès !', 'success');
        } else {
            throw new Error(result.error || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('Erreur envoi facture+RAM:', error);
        showToast('❌ Erreur lors de l\'envoi: ' + error.message, 'error');
    }
}

// Générer le PDF du RAM (format facture A4 portrait)
export async function generateRAMPDF(ram) {
    if (!window.jspdf) {
        throw new Error('jsPDF non chargé');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait', 'mm', 'a4');

    const { client, month, year, activities, remarks, invoiceNumber } = ram;
    const monthName = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][month];

    // Logo - utiliser la même logique que les factures (local ou data URI)
    if (getCompanyInfo().logoUrl) {
        try {
            // Utiliser logo local si l'URL GitHub n'est pas accessible
            const logoSrc = getCompanyInfo().logoUrl && !getCompanyInfo().logoUrl.includes('github')
                ? getCompanyInfo().logoUrl
                : '../images/MTI_CONSULTING.png';
            const dataUri = await fetchImageAsDataUri(logoSrc);
            if (dataUri) {
                doc.addImage(dataUri, 'PNG', 10, 15, 35, 18);
            }
        } catch(e) {
            console.warn('Logo non chargé:', e);
            // Fallback: essayer directement le fichier local
            try {
                const localDataUri = await fetchImageAsDataUri('../assets/images/MTI_CONSULTING.png');
                if (localDataUri) {
                    doc.addImage(localDataUri, 'PNG', 10, 15, 35, 18);
                }
            } catch(e2) {
                console.warn('Fallback logo échoué:', e2);
            }
        }
    }

    // En-tête entreprise (format compact comme facture)
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(33, 128, 141); // #21808D (bleu MTI)
    doc.text(getCompanyInfo().name, 45, 20);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0); // Retour au noir
    doc.text(getCompanyInfo().address, 45, 25);
    doc.text(`${getCompanyInfo().postalCode} ${getCompanyInfo().city}`, 45, 29);
    doc.text(`SIRET : ${getCompanyInfo().siret}`, 45, 33);

    // Titre (centré et ultra-compact pour garder visas page 1)
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('RAPPORT D\'ACTIVITÉ MENSUELLE', 105, 42, { align: 'center' });

    // Mois et client (ultra-compact, espacement réduit)
    doc.setFontSize(10);
    doc.text(`${monthName} ${year}`, 105, 49, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(`Client : ${client}`, 105, 55, { align: 'center' });
    if (invoiceNumber) {
        doc.text(`Facture : ${invoiceNumber}`, 105, 60, { align: 'center' });
    }

    // Tableau des activités (optimisé pour A4)
    if (doc.autoTable) {
        const tableData = [];
        let monthTotal = 0;

        activities.forEach((activity) => {
            const activityDate = new Date(activity.date);
            const dayNum = activityDate.getDate().toString().padStart(2, '0');
            const isWeekend = (activity.day === 'Samedi' || activity.day === 'Dimanche');

            monthTotal += activity.hours || 0;

            // Ajouter la ligne avec style pour weekends
            tableData.push({
                day: activity.day,
                date: dayNum,
                hours: (activity.hours || 0).toFixed(1),
                comment: activity.comment || '',
                isWeekend: isWeekend
            });
        });

        // Ajuster taille tableau selon présence remarques (pour tout tenir sur 1 page)
        const hasRemarks = remarks && remarks.trim().length > 0;
        const tableFontSize = hasRemarks ? 6.5 : 7;
        const tableCellPadding = hasRemarks ? 1.2 : 1.5;
        const tableHeaderFontSize = hasRemarks ? 7.5 : 8;

        doc.autoTable({
            startY: invoiceNumber ? 65 : 60,
            head: [['Jour', 'Date', 'Heures', 'Commentaires']],
            body: tableData.map(row => [row.day, row.date, row.hours, row.comment]),
            foot: [['', 'TOTAL', monthTotal.toFixed(1) + 'h', '']],
            theme: 'grid',
            styles: {
                fontSize: tableFontSize,
                cellPadding: tableCellPadding,
                lineColor: [200, 200, 200],
                lineWidth: 0.1,
                overflow: 'linebreak',
                cellWidth: 'wrap'
            },
            headStyles: {
                fillColor: [33, 128, 141],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: tableHeaderFontSize,
                halign: 'center'
            },
            footStyles: {
                fillColor: [240, 240, 240],
                textColor: 0,
                fontStyle: 'bold',
                fontSize: tableHeaderFontSize
            },
            columnStyles: {
                0: { cellWidth: 22, halign: 'left' },
                1: { cellWidth: 13, halign: 'center' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 130, halign: 'left' }
            },
            didParseCell: function(data) {
                // Griser les lignes de weekend
                if (data.section === 'body') {
                    const rowData = tableData[data.row.index];
                    if (rowData && rowData.isWeekend) {
                        data.cell.styles.fillColor = [245, 245, 245];
                        data.cell.styles.textColor = [100, 100, 100];
                    }
                }
            },
            margin: { left: 15, right: 15 }
        });
    }

    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 5 : 220;

    // Remarques (compactes avec compression intelligente)
    // Compression intelligente selon longueur des remarques
    let remarksFontSize = 7;
    let remarksLineHeight = 3;

    if (remarks) {
        const remarksLength = remarks.length;

        if (remarksLength > 500) {
            // Remarques très longues : police 6, interligne 2.5mm
            remarksFontSize = 6;
            remarksLineHeight = 2.5;
        } else if (remarksLength > 300) {
            // Remarques moyennes : police 6.5, interligne 2.8mm
            remarksFontSize = 6.5;
            remarksLineHeight = 2.8;
        }

        // Ne pas afficher les remarques sur page 1, elles seront sur page 2
    }

    // Page 2 - Remarques, Visas et Footer
    doc.addPage();

    // Structure fixe pour éviter chevauchement :
    // - Footer fixe à Y=275mm (hauteur 6mm, marge sûre avant limite 297mm)
    // - Visas fixes à Y=255mm (hauteur 20mm, finissent à 275mm)
    // - Remarques de Y=20mm à Y=245mm max (225mm disponibles)

    // Placer le footer sous les visas pour éviter chevauchement
    const footerY = 280;
    const sigY = 255;
    const remarksStartY = 20;
    const remarksMaxY = 245; // 10mm avant les visas

    // Afficher les remarques en haut de page 2 (si présentes)
    if (remarks) {
        doc.setFont(undefined, 'bold');
        doc.setFontSize(8);
        doc.text('Remarques', 15, remarksStartY);

        doc.setFont(undefined, 'normal');
        doc.setFontSize(remarksFontSize);
        const remarksLines = doc.splitTextToSize(remarks, 175);

        // Calculer hauteur max disponible pour remarques (jusqu'à 10mm avant visas)
        const maxRemarksHeight = remarksMaxY - remarksStartY - 6; // 6mm pour titre + padding
        const maxRemarksLines = Math.floor(maxRemarksHeight / remarksLineHeight);
        const truncatedLines = remarksLines.slice(0, maxRemarksLines);

        if (remarksLines.length > maxRemarksLines) {
            truncatedLines[truncatedLines.length - 1] += ' [...]';
            console.warn(`Remarques tronquées: ${remarksLines.length} lignes → ${maxRemarksLines} lignes (hauteur max: ${maxRemarksHeight}mm)`);
        }

        const actualRemarksHeight = truncatedLines.length * remarksLineHeight + 6;
        doc.text(truncatedLines, 15, remarksStartY + 4);
        doc.rect(15, remarksStartY - 2, 180, actualRemarksHeight);

        console.log(`✅ Remarques affichées en page 2 : Y=${remarksStartY}mm, hauteur=${actualRemarksHeight}mm (max: ${maxRemarksHeight}mm)`);
    }

    // Visas FIXES à Y=255mm pour éviter chevauchement
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);

    // Visas recentrés : marge 22mm de chaque côté
    doc.text('Visa Prestataire', 24, sigY);
    doc.rect(22, sigY + 2, 78, 20);

    // Ajouter la signature dans la case Prestataire (centrée)
    try {
        const signaturePath = '../assets/images/signature_pandadoc.png';
        const sigDataUri = await fetchImageAsDataUri(signaturePath);
        if (sigDataUri) {
            doc.addImage(sigDataUri, 'PNG', 36, sigY + 4, 50, 15);
        }
    } catch(e) {
        console.warn('Signature non chargée:', e);
    }

    doc.text('Visa Superviseur Client', 112, sigY);
    doc.rect(110, sigY + 2, 78, 20);

    // Footer FIXE à Y=280mm (5mm après visas)

    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);

    doc.text(`${getCompanyInfo().name} - SIRET: ${getCompanyInfo().siret}`, 105, footerY, { align: 'center' });
    doc.text(`${getCompanyInfo().email} - ${getCompanyInfo().phone}`, 105, footerY + 3, { align: 'center' });
    doc.text(`${getCompanyInfo().website || 'www.mticonsulting.fr'}`, 105, footerY + 6, { align: 'center' });
    console.log('✅ Footer affiché en page 2 à Y=' + footerY + 'mm');

    return doc.output('datauristring').split(',')[1];
}

/**
 * Génère un PDF pour un devis (Base64)
 */
export async function generateQuotePDFBase64(quote) {
    if (!window.jspdf) {
        throw new Error('jsPDF manquant - impossible de générer le PDF');
    }

    // Construire le HTML du devis
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = 'auto';
    tempContainer.style.padding = '0';

    // Essayer de charger le logo
    let originalLogo = getCompanyInfo().logoUrl;
    let logoDataUri = null;
    try {
        const logoSrc = getCompanyInfo().logoUrl && !getCompanyInfo().logoUrl.includes('github')
            ? getCompanyInfo().logoUrl
            : '../assets/images/MTI_CONSULTING.png';
        logoDataUri = await fetchImageAsDataUri(logoSrc);
        if (logoDataUri) getCompanyInfo().logoUrl = logoDataUri;
    } catch (e) {
        console.warn('Could not inline logo', e);
    }

    try {
        tempContainer.innerHTML = buildQuoteHtml({
            clientName: quote.client || '',
            clientAddress: quote.clientAddress || '',
            quoteNumber: quote.number || '',
            quoteDate: quote.date || '',
            validityDate: quote.validityDate || '',
            items: quote.items || []
        });
    } finally {
        getCompanyInfo().logoUrl = originalLogo;
    }

    document.body.appendChild(tempContainer);

    // Utiliser html2canvas si disponible pour meilleure qualité
    if (window.html2canvas && window.jspdf) {
        try {
            const { jsPDF } = window.jspdf;
            const pdfDoc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdfDoc.internal.pageSize.getWidth();
            const pageHeight = pdfDoc.internal.pageSize.getHeight();

            const a4WidthPx = 794;
            const a4HeightPx = 1123;
            tempContainer.style.width = a4WidthPx + 'px';
            tempContainer.style.height = a4HeightPx + 'px';

            const canvasScale = 2.0;
            const canvas = await html2canvas(tempContainer, {
                scale: canvasScale,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.85);

            pdfDoc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);

            const dataUri = pdfDoc.output('datauristring');
            try { document.body.removeChild(tempContainer); } catch(e) {}
            return dataUri.split(',')[1];
        } catch (err) {
            console.warn('html2canvas/pdf path failed, falling back to legacy jsPDF:', err);
            try { document.body.removeChild(tempContainer); } catch(e) {}
        }
    } else {
        try { document.body.removeChild(tempContainer); } catch(e) {}
    }

    // Fallback: utiliser jsPDF autoTable
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Logo
    if (getCompanyInfo().logoUrl) {
        try {
            const imgToUse = logoDataUri || getCompanyInfo().logoUrl;
            if (imgToUse) {
                try { doc.addImage(imgToUse, 'PNG', 20, 20, 30, 30); } catch(e) { /* ignore */ }
            }
        } catch(e) { /* ignore */ }
    }

    // En-tête
    doc.setFontSize(20);
    doc.setTextColor(0, 102, 204); // Bleu
    doc.text(getCompanyInfo().name, 60, 30);
    doc.setTextColor(0, 0, 0); // Reset noir
    doc.setFontSize(10);
    doc.text(getCompanyInfo().address, 60, 37);
    doc.text(`${getCompanyInfo().postalCode} ${getCompanyInfo().city}`, 60, 42);
    doc.text(`SIRET : ${getCompanyInfo().siret}`, 60, 47);

    // Titre
    doc.setFontSize(18);
    doc.setTextColor(33, 128, 141); // #21808D
    doc.text(`DEVIS ${quote.number}`, 20, 70);
    doc.setTextColor(0, 0, 0);

    // Client
    doc.setFontSize(10);
    doc.text('Client :', 20, 85);
    doc.text(quote.client, 20, 90);
    if (quote.clientSiret) doc.text(`SIRET : ${quote.clientSiret}`, 20, 95);

    // Dates
    doc.text(`Date d'émission : ${formatDateFR(quote.date)}`, 120, 85);
    doc.text(`Valide jusqu'au : ${formatDateFR(quote.validityDate)}`, 120, 90);

    // Tableau multi-lignes
    if (doc.autoTable) {
        const tableBody = quote.items && quote.items.length > 0
            ? quote.items.map(item => [
                item.description || '',
                (item.quantity || 0).toString(),
                `${formatNumber((item.unitPrice || 0))} €`,
                `${formatNumber(((item.quantity || 0) * (item.unitPrice || 0)))} €`
            ])
            : [];

        doc.autoTable({
            startY: 120,
            head: [['Description', 'Quantité', 'Prix unitaire HT', 'Total HT']],
            body: tableBody,
            colWidth: [85, 25, 35, 35],
            margin: { top: 10, right: 20, bottom: 50, left: 20 },
            headStyles: { fillColor: [33, 128, 141] },
            styles: { fontSize: 10 },
            columnStyles: {
                0: { cellWidth: 85 },    // Description
                1: { cellWidth: 25 },    // Quantité
                2: { cellWidth: 35 },    // Prix unitaire
                3: { cellWidth: 35 }     // Total HT
            }
        });
    }

    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 160;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Total HT : ${formatNumber((quote.total || 0))} €`, 120, finalY);
    doc.setFont(undefined, 'normal');

    doc.setFontSize(9);
    doc.text(`TVA non applicable (art. 293 B du CGI)`, 120, finalY + 7);

    // Mention légale
    doc.setFontSize(9);
    doc.setTextColor(200, 100, 0);
    doc.text(`⚠️ Bon pour accord - Valable jusqu'au ${formatDateFR(quote.validityDate)}`, 20, finalY + 20);
    doc.setTextColor(0, 0, 0);

    // Footer en bas de page (Y=270 pour marge sûre avant limite 297mm A4)
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    const footerY = 270;
    doc.text(`${getCompanyInfo().name} - SIRET: ${getCompanyInfo().siret}`, 105, footerY, { align: 'center' });
    doc.text(`${getCompanyInfo().email} - ${getCompanyInfo().phone}`, 105, footerY + 4, { align: 'center' });
    doc.text(`${getCompanyInfo().website || 'www.mticonsulting.fr'}`, 105, footerY + 8, { align: 'center' });

    return doc.output('datauristring').split(',')[1];
}

export function displayCommunesResults(results) {
    const autocompleteDiv = document.getElementById('communeAutocomplete');
    if (!autocompleteDiv) return;

    autocompleteDiv.style.display = 'block';
    autocompleteDiv.innerHTML = results.map(r => {
        const codePostal = r.code_postal || '';
        const displayCP = codePostal ? ` - CP ${codePostal}` : '';
        return `
        <div class="commune-result" data-commune="${r.libcom}" data-insee="${r.insee_com}" style="padding: 12px; cursor: pointer; border-bottom: 1px solid var(--color-border); transition: background 0.2s;">
            <strong>${r.libcom}</strong> <span style="color: var(--color-text-secondary); font-size: 12px;">(INSEE ${r.insee_com}${displayCP})</span>
        </div>
    `;
    }).join('');

    // Event listeners pour sélection
    document.querySelectorAll('.commune-result').forEach(el => {
        el.addEventListener('mouseenter', (e) => e.target.style.background = 'var(--color-bg-1)');
        el.addEventListener('mouseleave', (e) => e.target.style.background = 'white');
        el.addEventListener('click', async (e) => {
            communeInput.value = e.currentTarget.dataset.commune;
            autocompleteDiv.style.display = 'none';
            await updateCFEEstimation(); // Déclencher calcul CFE
        });
    });
}

// Helper: try to fetch an image URL and convert to data URI (best-effort, may fail due to CORS)
async function fetchImageAsDataUri(url) {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Image fetch failed');
        const blob = await resp.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('fetchImageAsDataUri failed for', url, e);
        return null;
    }
}