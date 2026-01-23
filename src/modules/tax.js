import {
    defaultSettings,
    getTaxSettings
} from "./config.js";
import { showToast } from "./toast.js";
import { updateAlerts } from "./alerts.js";
import {
    evaluateMonEntreprise,
    fetchUrssafRule
} from "./api.js";
import { formatNumber } from "./number-utils.js";
import { checkSeuils } from "./revenue.js";

// Cache for thresholds to avoid repeated calls
let urssafThresholdCache = {
    fetchedAt: null,
    data: null
};

// Cache pour le calcul dynamique des cotisations via API URSSAF
let cotisationsCache = {
    key: null,          // Composite key: "ca_hasACRE_creationDate"
    data: null,         // { montantAnnuel, taux }
    fetchedAt: null     // Timestamp
};

/**
 * Calcule l'IRPP selon le barème progressif
 * @param {number} revenuImposable - Revenu annuel imposable (après abattement BNC si applicable)
 * @param {Array} bareme - Barème IRPP (tranches avec min, max, taux)
 * @returns {number} Montant de l'impôt annuel
 */
export function calculateIRPPProgressif(revenuImposable, bareme = null) {
    if (!bareme) bareme = getTaxSettings().irppBareme;
    // Sécurité : vérifier que le barème existe et est un tableau
    if (!bareme || !Array.isArray(bareme) || bareme.length === 0) {
        console.warn('calculateIRPPProgressif: barème IRPP non disponible, utilisation du barème par défaut');
        bareme = defaultSettings.irppBareme;
    }
    if (revenuImposable <= 0) return 0;

    let impot = 0;
    for (let i = 0; i < bareme.length; i++) {
        const tranche = bareme[i];
        const min = tranche.min;
        const max = tranche.max === Infinity ? Infinity : tranche.max;
        const taux = tranche.taux / 100;

        if (revenuImposable <= min) break;

        const trancheMax = Math.min(revenuImposable, max);
        const montantTranche = trancheMax - min + 1; // +1 car bornes inclusives
        if (montantTranche > 0) {
            impot += montantTranche * taux;
        }

        if (revenuImposable <= max) break;
    }

    return Math.max(0, impot);
}

/**
 * Calcule le revenu imposable BNC (après abattement forfaitaire)
 * @param {number} caAnnuel - Chiffre d'affaires annuel
 * @param {number} abattement - Taux d'abattement (défaut 34%)
 * @returns {number} Revenu imposable
 */
export function calculateBNCRevenuImposable(caAnnuel, abattement = null) {
    if (!abattement) abattement = getTaxSettings().bncAbattement || defaultSettings.bncAbattement || 34;
    const revenuImposable = caAnnuel * (1 - abattement / 100);
    return Math.max(0, revenuImposable);
}

/**
 * Compare versement libératoire vs IRPP progressif
 * @param {number} caAnnuel - Chiffre d'affaires annuel
 * @returns {Object} { versementLib, irppProgressif, difference, meilleurChoix }
 */
export function compareImpots(caAnnuel) {
    // Versement libératoire : taux fixe sur CA
    const versementLib = caAnnuel * (getTaxSettings().versementLiberatoire / 100);

    // IRPP progressif : appliqué sur revenu imposable BNC
    const revenuImposable = calculateBNCRevenuImposable(caAnnuel);
    const irppProgressif = calculateIRPPProgressif(revenuImposable);

    const difference = versementLib - irppProgressif;
    const meilleurChoix = difference > 0 ? 'progressif' : 'versementLib';

    return {
        versementLib,
        irppProgressif,
        revenuImposable,
        difference,
        meilleurChoix,
        economie: Math.abs(difference)
    };
}

export function updateIRPPTranche(index, field, value) {
    if (!getTaxSettings().irppBareme[index]) return;

    if (field === 'min' || field === 'max') {
        getTaxSettings().irppBareme[index][field] = value === '' || value === null ? (field === 'max' ? Infinity : 0) : parseFloat(value);
    } else if (field === 'taux') {
        getTaxSettings().irppBareme[index][field] = parseFloat(value) || 0;
    }

    // Trier les tranches par min croissant
    getTaxSettings().irppBareme.sort((a, b) => a.min - b.min);
    renderIRPPBareme();
}

export function addIRPPTranche() {
    const lastTranche = getTaxSettings().irppBareme[getTaxSettings().irppBareme.length - 1];
    const newMin = lastTranche && lastTranche.max !== Infinity ? lastTranche.max + 1 : 0;
    getTaxSettings().irppBareme.push({ min: newMin, max: Infinity, taux: 0 });
    renderIRPPBareme();
}

export function removeIRPPTranche(index) {
    if (getTaxSettings().irppBareme.length <= 1) {
        alert('⚠️ Vous devez conserver au moins une tranche');
        return;
    }
    getTaxSettings().irppBareme.splice(index, 1);
    renderIRPPBareme();
}

export function resetIRPPBareme() {
    if (confirm('Réinitialiser le barème IRPP aux valeurs par défaut 2025 ?')) {
        getTaxSettings().irppBareme = JSON.parse(JSON.stringify(defaultSettings.irppBareme));
        getTaxSettings().bncAbattement = defaultSettings.bncAbattement;
        renderIRPPBareme();
        showToast('✅ Barème IRPP réinitialisé');
    }
}

export function renderIRPPBareme() {
    const container = document.getElementById('irppBaremeContainer');
    if (!container) return;

    // Sécurité : initialiser le barème si absent
    if (!getTaxSettings().irppBareme || !Array.isArray(getTaxSettings().irppBareme) || getTaxSettings().irppBareme.length === 0) {
        getTaxSettings().irppBareme = JSON.parse(JSON.stringify(defaultSettings.irppBareme));
    }

    const bareme = getTaxSettings().irppBareme;
    container.innerHTML = '';

    bareme.forEach((tranche, index) => {
        // Sécurité : vérifier que tranche existe et a les propriétés nécessaires
        if (!tranche || typeof tranche.min === 'undefined' || typeof tranche.taux === 'undefined') {
            console.warn('renderIRPPBareme: tranche invalide ignorée', tranche);
            return;
        }

        const div = document.createElement('div');
        div.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 8px; align-items: center; padding: 8px; background: var(--color-bg-1); border-radius: var(--radius-base);';

        const maxDisplay = tranche.max === Infinity ? '∞' : (tranche.max || 0).toLocaleString('fr-FR');

        // Préparer les valeurs pour éviter null/undefined dans les inputs
        const minValue = tranche.min !== null && tranche.min !== undefined ? tranche.min : 0;
        const maxValue = tranche.max === Infinity ? '' : (tranche.max !== null && tranche.max !== undefined ? tranche.max : '');
        const tauxValue = tranche.taux !== null && tranche.taux !== undefined ? tranche.taux : 0;

        div.innerHTML = `
            <input type="number" class="form-control" value="${minValue}" 
                   onchange="updateIRPPTranche(${index}, 'min', this.value)" 
                   placeholder="Min" style="font-size: 13px;">
            <input type="number" class="form-control" value="${maxValue}" 
                   onchange="updateIRPPTranche(${index}, 'max', this.value)" 
                   placeholder="Max (∞ si vide)" style="font-size: 13px;">
            <input type="number" class="form-control" value="${tauxValue}" step="0.1" 
                   onchange="updateIRPPTranche(${index}, 'taux', this.value)" 
                   placeholder="Taux %" style="font-size: 13px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="removeIRPPTranche(${index})" 
                    style="padding: 4px 8px; min-width: auto;">🗑️</button>
        `;

        container.appendChild(div);
    });

    // Bouton pour ajouter une tranche
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-secondary btn-sm';
    addBtn.textContent = '➕ Ajouter une tranche';
    addBtn.onclick = addIRPPTranche;
    addBtn.style.marginTop = '8px';
    container.appendChild(addBtn);
}

/**
 * Load fiscal thresholds (TVA, micro-BNC) from URSSAF API when possible.
 * Updates `taxSettings` and refreshes dependent UI.
 */
export async function loadFiscalThresholdsFromAPI() {
    // If cached within 24h, reuse
    const now = Date.now();
    if (urssafThresholdCache.fetchedAt && (now - urssafThresholdCache.fetchedAt) < 24 * 60 * 60 * 1000) {
        const d = urssafThresholdCache.data;
        if (d) {
            getTaxSettings().seuilTVAAnnuel = d.seuilTVAAnnuel ?? getTaxSettings().seuilTVAAnnuel;
            getTaxSettings().seuilTVAMajore = d.seuilTVAMajore ?? getTaxSettings().seuilTVAMajore;
            getTaxSettings().caMaxBNC = d.caMaxBNC ?? getTaxSettings().caMaxBNC;
            try { updateAlerts(); } catch {}
            return d;
        }
    }

    // Publicodes rules to query (names from Mon-entreprise models)
    // Note: Rules names may change; we attempt resilient mapping.
    const candidateRules = [
        'entreprise . franchise de TVA . seuil',
        'entreprise . franchise de TVA . seuil majoré',
        'dirigeant . auto-entrepreneur . seuil micro-BNC'
    ];

    // Try to evaluate rules directly (no situation dependency for thresholds)
    let thresholds = { seuilTVAAnnuel: null, seuilTVAMajore: null, caMaxBNC: null };
    for (const rule of candidateRules) {
        try {
            const info = await Promise.race([
                fetchUrssafRule(rule),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]);
            if (info?.rule) {
                const val = info?.rule?.nodeValue ?? info?.rule?.value;
                const unit = info?.rule?.unit || info?.rule?.rawNode?.unit;
                if (val) {
                    if (rule.includes('franchise de TVA') && rule.includes('majoré')) thresholds.seuilTVAMajore = Number(val);
                    else if (rule.includes('franchise de TVA')) thresholds.seuilTVAAnnuel = Number(val);
                    else if (rule.includes('micro-BNC')) thresholds.caMaxBNC = Number(val);
                }
            }
        } catch (err) {
            console.warn(`Rule fetch timeout/error for ${rule}:`, err.message);
        }
    }

    // If direct rule fetch failed, fallback via evaluate with explicit expressions
    if (!thresholds.seuilTVAAnnuel || !thresholds.seuilTVAMajore || !thresholds.caMaxBNC) {
        try {
            const evals = await Promise.race([
                evaluateMonEntreprise({}, [
                    'entreprise . franchise de TVA . seuil',
                    'entreprise . franchise de TVA . seuil majoré',
                    'dirigeant . auto-entrepreneur . seuil micro-BNC'
                ]),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]);
            if (evals) {
                thresholds.seuilTVAAnnuel = thresholds.seuilTVAAnnuel ?? Number(evals['entreprise . franchise de TVA . seuil']?.nodeValue || evals['entreprise . franchise de TVA . seuil']?.value);
                thresholds.seuilTVAMajore = thresholds.seuilTVAMajore ?? Number(evals['entreprise . franchise de TVA . seuil majoré']?.nodeValue || evals['entreprise . franchise de TVA . seuil majoré']?.value);
                thresholds.caMaxBNC = thresholds.caMaxBNC ?? Number(evals['dirigeant . auto-entrepreneur . seuil micro-BNC']?.nodeValue || evals['dirigeant . auto-entrepreneur . seuil micro-BNC']?.value);
            }
        } catch (err) {
            console.warn('URSSAF evaluate timeout/error:', err.message);
        }
    }

    // Apply if present; keep current if not
    const applied = {
        seuilTVAAnnuel: thresholds.seuilTVAAnnuel || getTaxSettings().seuilTVAAnnuel,
        seuilTVAMajore: thresholds.seuilTVAMajore || getTaxSettings().seuilTVAMajore,
        caMaxBNC: thresholds.caMaxBNC || getTaxSettings().caMaxBNC
    };
    getTaxSettings().seuilTVAAnnuel = applied.seuilTVAAnnuel;
    getTaxSettings().seuilTVAMajore = applied.seuilTVAMajore;
    getTaxSettings().caMaxBNC = applied.caMaxBNC;

    urssafThresholdCache = { fetchedAt: now, data: applied };

    // Update UI pieces that depend on thresholds
    try { updateAlerts(); } catch {}
    // Update Paramètres fields if present
    const seuilBaseEl = document.getElementById('seuilTVAAnnuel');
    const seuilMajEl = document.getElementById('seuilTVAMajore');
    const caMaxBNCEl = document.getElementById('caMaxBNC');
    if (seuilBaseEl) seuilBaseEl.value = String(getTaxSettings().seuilTVAAnnuel);
    if (seuilMajEl) seuilMajEl.value = String(getTaxSettings().seuilTVAMajore);
    if (caMaxBNCEl) caMaxBNCEl.value = String(getTaxSettings().caMaxBNC);

    // Persist to Drive if values changed (optional but recommended)
    const hasChanges = thresholds.seuilTVAAnnuel || thresholds.seuilTVAMajore || thresholds.caMaxBNC;
    if (hasChanges) {
        try {
            await saveToDrive();
            console.log('✅ Seuils URSSAF persistés dans Drive');
        } catch (err) {
            console.warn('Échec sauvegarde Drive des seuils URSSAF:', err);
        }
    }

    return applied;
}

// Helper to initialize API-driven thresholds on app start
export async function initUrssafIntegration() {
    // Add timeout to avoid excessive concurrent requests
    await Promise.race([
        Promise.all([
            loadFiscalThresholdsFromAPI(),
            loadAdditionalFiscalParamsFromAPI()
        ]),
        new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
    ]).catch(err => {
        console.warn('URSSAF init timeout, using local values', err);
    });
}

/**
 * Charger d'autres paramètres fiscaux depuis l'API si disponibles.
 * Exemples: taux de versement libératoire, abattement BNC.
 * Met à jour taxSettings avec fallback silencieux.
 */
export async function loadAdditionalFiscalParamsFromAPI() {
    // Tentatives de récupération de paramètres additionnels
    const expressions = [
        'dirigeant . auto-entrepreneur . impôt . versement libératoire . taux',
        'dirigeant . BNC . abattement'
    ];

    const evals = await evaluateMonEntreprise({}, expressions);
    if (!evals) return null;

    const vlTaux = evals['dirigeant . auto-entrepreneur . impôt . versement libératoire . taux']?.nodeValue ?? evals['dirigeant . auto-entrepreneur . impôt . versement libératoire . taux']?.value;
    const bncAbatt = evals['dirigeant . BNC . abattement']?.nodeValue ?? evals['dirigeant . BNC . abattement']?.value;

    if (vlTaux) getTaxSettings().versementLiberatoire = Number(vlTaux); // en %
    if (bncAbatt) getTaxSettings().bncAbattement = Number(bncAbatt);    // en %

    // Rafraîchir les sections dépendantes
    try { updateAlerts(); } catch {}

    // Synchroniser les champs Paramètres si présents
    const vlEl = document.getElementById('versementLiberatoire');
    const bncEl = document.getElementById('bncAbattement');
    if (vlEl) vlEl.value = String(getTaxSettings().versementLiberatoire);
    if (bncEl) bncEl.value = String(getTaxSettings().bncAbattement);

    return { vlTaux, bncAbatt };
}

/**
 * Calcule dynamiquement les cotisations sociales via API URSSAF.
 * Calcul dynamique : Utilise le simulateur officiel Mon-entreprise pour obtenir
 * les taux exacts incluant cotisations + CFP (Contribution Formation Professionnelle).
 *
 * @param {number} ca - Chiffre d'affaires annuel
 * @param {boolean} hasACRE - Si l'auto-entrepreneur bénéficie de l'ACRE
 * @param {string} creationDate - Date de création au format 'DD/MM/YYYY'
 * @returns {Promise<{montantAnnuel: number, taux: number}>} Cotisations annuelles et taux effectif
 */
export async function calculateCotisationsDynamically(ca, hasACRE, creationDate) {
    // Validation de la date
    if (!creationDate || !creationDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        console.warn('Date invalide:', creationDate);
        throw new Error('Date création invalide (format attendu: DD/MM/YYYY)');
    }

    // Construction de la situation Publicodes
    const situation = {
        "entreprise . catégorie juridique": "'EI'",
        "entreprise . catégorie juridique . EI . auto-entrepreneur": "oui",
        "dirigeant . auto-entrepreneur": "oui",
        "dirigeant . auto-entrepreneur . chiffre d'affaires": ca,
        "entreprise . activité . nature": "'libérale'",
        "entreprise . activité . nature . libérale . réglementée": "non",
        "entreprise . date de création": creationDate,
        "dirigeant . auto-entrepreneur . éligible à l'ACRE": hasACRE ? "oui" : "non",
        "dirigeant . exonérations . ACRE": hasACRE ? "oui" : "non"
    };

    try {
        // Appel API avec deux règles : cotisations sociales ET CFP séparément
        console.log('Appel API URSSAF avec situation:', { ca, hasACRE, creationDate });
        const response = await evaluateMonEntreprise(situation, [
            "dirigeant . auto-entrepreneur . cotisations et contributions . cotisations",
            "dirigeant . auto-entrepreneur . cotisations et contributions . CFP"
        ]);

        if (!response) {
            throw new Error('API response is null');
        }

        // L'API retourne soit un tableau (nouveau format) soit un objet (ancien format)
        let evaluationTotal, evaluationCFP;

        if (Array.isArray(response)) {
            // Nouveau format: evaluate: [{nodeValue: ...}] (sans dottedName si 2 règles)
            console.log('API response array:', JSON.stringify(response, null, 2));

            // Quand on demande 2 règles, l'API retourne dans l'ordre demandé
            // [0] = cotisations totales, [1] = CFP
            if (response.length >= 2 && !response[0].error) {
                evaluationTotal = response[0];
                evaluationCFP = response[1].error ? null : response[1];
            } else if (response.length === 1) {
                // Une seule règle demandée ou seule la première a réussi
                evaluationTotal = response[0];
                evaluationCFP = null;
            } else {
                console.warn('Unexpected API response format:', response);
                throw new Error('Total cotisations rule not found in API response');
            }
        } else {
            // Ancien format: {ruleKey: {nodeValue: ...}}
            const ruleTotal = "dirigeant . auto-entrepreneur . cotisations et contributions";
            const ruleCFP = "dirigeant . auto-entrepreneur . cotisations et contributions . CFP";

            evaluationTotal = response[ruleTotal];
            evaluationCFP = response[ruleCFP];
        }

        if (!evaluationTotal || typeof evaluationTotal.nodeValue !== 'number') {
            console.warn('Response structure:', response);
            throw new Error('Invalid API response structure for total');
        }

        // L'API retourne les cotisations mensuelles (URSSAF seul + CFP séparé)
        const montantMensuelURSSAF = evaluationTotal.nodeValue;
        const montantMensuelCFP = evaluationCFP && typeof evaluationCFP.nodeValue === 'number'
            ? evaluationCFP.nodeValue
            : (ca / 12) * (getTaxSettings().cfpBNC / 100); // Fallback si CFP non retournée

        if (isNaN(montantMensuelURSSAF)) {
            throw new Error('Invalid nodeValue from API');
        }

        // Total = URSSAF + CFP
        const montantAnnuelURSSAF = montantMensuelURSSAF * 12;
        const montantAnnuelCFP = montantMensuelCFP * 12;
        const montantAnnuel = montantAnnuelURSSAF + montantAnnuelCFP;
        const taux = ca > 0 ? (montantAnnuel / ca) * 100 : 0;
        const tauxCFP = ca > 0 ? (montantAnnuelCFP / ca) * 100 : 0;

        console.log(`✅ Cotisations URSSAF: ${montantAnnuelURSSAF.toFixed(2)} EUR/an (${((montantAnnuelURSSAF / ca) * 100).toFixed(2)}%)`);
        console.log(`✅ CFP: ${montantAnnuelCFP.toFixed(2)} EUR/an (${tauxCFP.toFixed(2)}%)`);
        console.log(`✅ Total cotisations: ${montantAnnuel.toFixed(2)} EUR/an (${taux.toFixed(2)}%)`);

        return { montantAnnuel, taux, montantAnnuelCFP, tauxCFP };
    } catch (err) {
        // Log silencieux si API null (normal avec CA=0), sinon warning
        if (err.message === 'API response is null') {
            console.log('ℹ️ Calcul local (CA faible ou API indisponible)');
        } else {
            console.warn('⚠️ Échec calcul dynamique cotisations:', err.message);
        }

        // Fallback sur valeurs en dur (12,3% ACRE / 24,6% standard)
        // Note: ACRE est une exonération 1ère année uniquement (depuis réforme 2020)
        const tauxFallback = hasACRE ? 12.3 : 24.6;
        const montantAnnuel = ca * (tauxFallback / 100);
        const montantAnnuelCFP = ca * (getTaxSettings().cfpBNC / 100);
        const tauxCFP = getTaxSettings().cfpBNC;

        return { montantAnnuel, taux: tauxFallback, montantAnnuelCFP, tauxCFP };
    }

    return { versementLiberatoire: getTaxSettings().versementLiberatoire, bncAbattement: getTaxSettings().bncAbattement };
}

export function updateComparaisonVL_IRPP(ca, multiplicateur, scenarios) {
    const { vl, irpp } = scenarios;
    const isMensuel = multiplicateur === 1;
    const periodeText = isMensuel ? 'Mensuel' : 'Annuel';

    // Scenario VL
    const scenarioVLContent = document.getElementById('scenarioVLContent');
    if (scenarioVLContent) {
        scenarioVLContent.innerHTML = `
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8);">CA ${periodeText}: <strong>${formatNumber((ca * multiplicateur))} €</strong></div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">URSSAF: ${formatNumber((vl.charges * multiplicateur))} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">CFP: ${formatNumber((vl.cfp * multiplicateur))} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">Impôt VL (${getTaxSettings().versementLiberatoire}%): ${formatNumber((vl.impot * multiplicateur))} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">CFE: ${formatNumber((vl.cfe * multiplicateur))} €</div>
            <div style="border-top: 2px solid var(--color-border); padding-top: var(--space-8); margin-top: var(--space-8); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);">Total charges: <span style="color: var(--color-warning);">${formatNumber((vl.total * multiplicateur))} €</span></div>
            <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-bold); margin-top: var(--space-8); color: var(--color-primary);">Revenu net: ${formatNumber((vl.net * multiplicateur))} €</div>
        `;
    }

    // Scenario IRPP
    const scenarioIRPPContent = document.getElementById('scenarioIRPPContent');
    if (scenarioIRPPContent) {
        scenarioIRPPContent.innerHTML = `
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8);">CA ${periodeText}: <strong>${formatNumber((ca * multiplicateur))} €</strong></div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">URSSAF: ${formatNumber((irpp.charges * multiplicateur))} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">CFP: ${formatNumber((irpp.cfp * multiplicateur))} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">Impôt IRPP (progressif): ${formatNumber((irpp.impot * multiplicateur))} €</div>
            <div style="font-size: var(--font-size-sm); margin-bottom: var(--space-8); color: var(--color-text-secondary);">CFE: ${formatNumber((irpp.cfe * multiplicateur))} €</div>
            <div style="border-top: 2px solid var(--color-border); padding-top: var(--space-8); margin-top: var(--space-8); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);">Total charges: <span style="color: var(--color-warning);">${formatNumber((irpp.total * multiplicateur))} €</span></div>
            <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-bold); margin-top: var(--space-8); color: var(--color-primary);">Revenu net: ${formatNumber((irpp.net * multiplicateur))} €</div>
        `;
    }

    // Recommandation
    const comparaisonRecommandation = document.getElementById('comparaisonRecommandation');
    if (comparaisonRecommandation) {
        const diff = Math.abs(vl.net - irpp.net) * multiplicateur;
        const meilleur = vl.net > irpp.net ? 'Versement Libératoire' : 'IRPP Progressif';
        const icone = vl.net > irpp.net ? '💼' : '📊';
        comparaisonRecommandation.innerHTML = `${icone} <strong>Recommandation :</strong> ${meilleur} (gain de ${formatNumber(diff)} € ${isMensuel ? 'par mois' : 'par an'})`;
        comparaisonRecommandation.style.background = vl.net > irpp.net ? 'var(--color-success)' : 'var(--color-primary)';
    }
}

export function calculateTaxes() {
    // Sécurité : initialiser le barème IRPP si absent
    if (!getTaxSettings().irppBareme || getTaxSettings().irppBareme.length === 0) {
        getTaxSettings().irppBareme = JSON.parse(JSON.stringify(defaultSettings.irppBareme));
    }
    if (!getTaxSettings().bncAbattement) {
        getTaxSettings().bncAbattement = defaultSettings.bncAbattement;
    }
    if (!getTaxSettings().cfpBNC) {
        getTaxSettings().cfpBNC = defaultSettings.cfpBNC;
    }

    const ca = parseFloat(caInput?.value) || 0;

    // Déterminer situation ACRE (2 options depuis réforme 2020)
    const acreAnnee1Radio = document.getElementById('acreAnnee1');
    const acreActive = acreAnnee1Radio ? acreAnnee1Radio.checked : false;

    // Si CA est 0 ou invalide, utiliser directement les valeurs locales (pas d'appel API)
    if (!ca || ca <= 0) {
        const chargesRate = acreActive ? (getTaxSettings().acreActif / 100) : (getTaxSettings().acreInactif / 100);
        finalizeTaxCalculation(ca, acreActive, ca * chargesRate, chargesRate * 100);
        return;
    }

    // Obtenir date création pour calculs API
    const creationDateInput = document.getElementById('dateDebutActivite');
    let creationDate = creationDateInput && creationDateInput.value ? creationDateInput.value : null;

    // Convertir format YYYY-MM-DD (HTML5 date) vers DD/MM/YYYY (Publicodes)
    if (creationDate && creationDate.includes('-')) {
        const parts = creationDate.split('-');
        creationDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    } else if (!creationDate) {
        // Par défaut: 1er janvier année en cours
        creationDate = `01/01/${new Date().getFullYear()}`;
    }

    // Calcul des charges sociales : API URSSAF (calcul dynamique) avec fallback
    calculateCotisationsWithFallback(ca * 12, acreActive, creationDate).then(result => {
        // Stocker les données CFP pour finalizeTaxCalculation
        window.lastCFPMensuel = result.montantAnnuelCFP / 12;
        window.lastTauxCFP = result.tauxCFP;

        // Une fois les cotisations calculées, finaliser les calculs
        finalizeTaxCalculation(ca, acreActive, result.montantAnnuel / 12, result.taux);
    }).catch(err => {
        console.error('Erreur calcul cotisations:', err);
        // Fallback immédiat sur valeurs en dur
        const chargesRate = acreActive ? (getTaxSettings().acreActif / 100) : (getTaxSettings().acreInactif / 100);
        window.lastCFPMensuel = ca * (getTaxSettings().cfpBNC / 100);
        window.lastTauxCFP = getTaxSettings().cfpBNC;
        finalizeTaxCalculation(ca, acreActive, ca * chargesRate, chargesRate * 100);
    });
}

/**
 * Calcule cotisations avec cache et fallback automatique.
 * Tente API d'abord, puis fallback sur valeurs locales si échec.
 */
export async function calculateCotisationsWithFallback(caAnnuel, hasACRE, creationDate) {
    // Vérifier cache (5 min de validité)
    const cacheKey = `${caAnnuel}_${hasACRE}_${creationDate}`;
    const now = Date.now();
    if (cotisationsCache.key === cacheKey &&
        cotisationsCache.fetchedAt &&
        (now - cotisationsCache.fetchedAt) < 5 * 60 * 1000) {
        return cotisationsCache.data;
    }

    // Tenter calcul dynamique API
    try {
        const result = await calculateCotisationsDynamically(caAnnuel, hasACRE, creationDate);

        // Mettre en cache
        cotisationsCache = {
            key: cacheKey,
            data: result,
            fetchedAt: now
        };

        return result;
    } catch (err) {
        // Fallback sur valeurs en dur + alerte visible
        const tauxFallback = hasACRE ? getTaxSettings().acreActif : getTaxSettings().acreInactif;
        try {
            showToast(`⚠️ API URSSAF indisponible, fallback sur taux locaux (${tauxFallback}% + CFP ${getTaxSettings().cfpBNC}%).`, 'warning');
            console.warn('Fallback URSSAF avec taux locaux:', err);
        } catch (e) {
            console.warn('Fallback URSSAF (toast non affiché):', err);
        }
        return {
            montantAnnuel: caAnnuel * (tauxFallback / 100),
            taux: tauxFallback
        };
    }
}

/**
 * Test manuel de l'API URSSAF (avec/sans ACRE) depuis l'onglet Calculs.
 * Affiche les taux URSSAF et CFP séparés pour vérifier que l'API répond.
 */
export async function testUrssafAPI() {
    try {
        const ca = parseFloat(document.getElementById('caInput')?.value) || 0;
        if (!ca || ca <= 0) {
            showToast('Veuillez saisir un CA > 0 avant de tester l\'API URSSAF.', 'warning');
            return;
        }

        // Récupérer la date de début d'activité (convertir vers DD/MM/YYYY)
        const creationDateInput = document.getElementById('dateDebutActivite');
        let creationDate = creationDateInput && creationDateInput.value ? creationDateInput.value : null;
        if (creationDate && creationDate.includes('-')) {
            const parts = creationDate.split('-');
            creationDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else if (!creationDate) {
            creationDate = `01/01/${new Date().getFullYear()}`;
        }

        const caAnnuel = ca * 12;
        const scenarios = [];
        for (const hasACRE of [true, false]) {
            const res = await calculateCotisationsDynamically(caAnnuel, hasACRE, creationDate);
            const montantCFP = res.montantAnnuelCFP ?? 0;
            const montantURSSAF = (res.montantAnnuel ?? 0) - montantCFP;
            const urssafRate = caAnnuel ? (montantURSSAF / caAnnuel) * 100 : 0;
            const cfpRate = caAnnuel ? (montantCFP / caAnnuel) * 100 : (res.tauxCFP || getTaxSettings().cfpBNC || 0);
            scenarios.push({ hasACRE, urssafRate, cfpRate, montantURSSAF, montantCFP });
        }

        const msg = `API OK · ACRE: URSSAF ${scenarios[0].urssafRate.toFixed(2)}% / CFP ${scenarios[0].cfpRate.toFixed(2)}% | Sans ACRE: URSSAF ${scenarios[1].urssafRate.toFixed(2)}% / CFP ${scenarios[1].cfpRate.toFixed(2)}%`;
        showToast(msg, 'success');
        console.log('🧪 Test API URSSAF détaillé:', scenarios);
    } catch (err) {
        console.error('Test API URSSAF en échec:', err);
        showToast('⚠️ Test API URSSAF en échec: ' + (err.message || err), 'error');
    }
}

/**
 * Finalise les calculs fiscaux avec les cotisations obtenues.
 * @param {number} ca - CA mensuel
 * @param {boolean} acreActive - ACRE actif ou non
 * @param {number} chargesMensuelles - Montant charges mensuelles URSSAF (hors CFP, récupéré séparément via API)
 * @param {number} tauxEffectif - Taux effectif en %
 */
export function finalizeTaxCalculation(ca, acreActive, chargesMensuelles, tauxEffectif) {
    const chargesLabel = acreActive ? 'ACRE Année 1 (12 mois)' : 'Sans ACRE (taux plein)'

    // Déterminer période affichage (mensuel ou annuel)
    const periodeMensuelRadio = document.getElementById('periodeMensuel');
    const isMensuel = periodeMensuelRadio ? periodeMensuelRadio.checked : true;
    const multiplicateur = isMensuel ? 1 : 12;

    // Vérifier seuils avec CA annuel
    const seuil = checkSeuils(ca * 12);
    const alertDiv = document.getElementById('seuilsAlert');

    if (alertDiv && seuil.alerte) {
        alertDiv.style.display = 'block';
        alertDiv.textContent = seuil.message;

        // Couleurs selon niveau
        switch(seuil.niveau) {
            case 'danger':
                alertDiv.style.background = 'var(--color-error-bg)';
                alertDiv.style.borderLeft = '4px solid var(--color-error)';
                alertDiv.style.color = 'var(--color-error)';
                break;
            case 'warning':
                alertDiv.style.background = 'var(--color-warning-bg)';
                alertDiv.style.borderLeft = '4px solid var(--color-warning)';
                alertDiv.style.color = 'var(--color-warning)';
                break;
            case 'info':
                alertDiv.style.background = 'var(--color-info-bg)';
                alertDiv.style.borderLeft = '4px solid var(--color-primary)';
                alertDiv.style.color = 'var(--color-primary)';
                break;
        }
    } else if (alertDiv) {
        alertDiv.style.display = 'none';
    }

    // Mise à jour label période
    const periodeLabel = document.getElementById('periodeLabel');
    if (periodeLabel) {
        periodeLabel.textContent = isMensuel ? '(Mensuelles)' : '(Annuelles)';
    }

    // 1. Charges sociales URSSAF et CFP (récupérées dynamiquement de l'API)
    // Correction : URSSAF (hors CFP) et CFP séparés
    // Si l'API retourne le taux total (URSSAF+CFP), on doit le corriger ici
    // On force le taux URSSAF à la valeur hors CFP (taxSettings.acreActif ou acreInactif)
    const tauxURSSAF = acreActive ? getTaxSettings().acreActif : getTaxSettings().acreInactif;
    const charges = ca * (tauxURSSAF / 100);
    const tauxCFP = getTaxSettings().cfpBNC;
    const cfpMensuel = ca * (tauxCFP / 100);

    // 2. CFE mensuel
    const cfe = getTaxSettings().cfeAnnuel / 12;

    // === CALCUL SCENARIO VL ===
    const impotVL = ca * (getTaxSettings().versementLiberatoire / 100);
    const totalChargesVL = charges + cfpMensuel + impotVL + cfe;
    const netVL = ca - totalChargesVL;

    // === CALCUL SCENARIO IRPP ===
    const caAnnuel = ca * 12;
    const revenuImposable = calculateBNCRevenuImposable(caAnnuel);
    const impotAnnuelIRPP = calculateIRPPProgressif(revenuImposable);
    const impotIRPP = impotAnnuelIRPP / 12;
    const totalChargesIRPP = charges + cfpMensuel + impotIRPP + cfe;
    const netIRPP = ca - totalChargesIRPP;

    // === DÉTERMINER RÉGIME FISCAL SÉLECTIONNÉ ===
    const regimeVLRadio = document.getElementById('regimeVL');
    const useVL = regimeVLRadio ? regimeVLRadio.checked : false;

    // Choisir le scénario à afficher dans le tableau de détail
    const impotDetail = useVL ? impotVL : impotIRPP;
    const totalChargesDetail = useVL ? totalChargesVL : totalChargesIRPP;
    const netDetail = useVL ? netVL : netIRPP;
    const regimeLabel = useVL ? 'Versement Libératoire' : 'IRPP progressif';
    const impotTaux = useVL ? `${getTaxSettings().versementLiberatoire}%` : 'Barème';
    const impotBase = useVL ? formatNumber(ca * multiplicateur) : formatNumber(revenuImposable);

    // === REMPLIR TABLEAU DE DETAIL (utilise régime sélectionné) ===
    const detailBody = document.getElementById('detailChargesBody');
    if (detailBody) {
        detailBody.innerHTML = `
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-12);">Charges sociales URSSAF <small style="color: var(--color-text-secondary);">(${chargesLabel})</small></td>
                <td style="padding: var(--space-12); text-align: center;">${tauxURSSAF.toFixed(1)}%</td>
                <td style="padding: var(--space-12); text-align: right;">${formatNumber((ca * multiplicateur))} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold);">${formatNumber((charges * multiplicateur))} €</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-12);">CFP <small style="color: var(--color-text-secondary);">(Formation professionnelle)</small></td>
                <td style="padding: var(--space-12); text-align: center;">${tauxCFP.toFixed(1)}%</td>
                <td style="padding: var(--space-12); text-align: right;">${formatNumber((ca * multiplicateur))} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold);">${formatNumber((cfpMensuel * multiplicateur))} €</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-12);">Impôt sur le revenu <small style="color: var(--color-text-secondary);">(${regimeLabel})</small></td>
                <td style="padding: var(--space-12); text-align: center;">${impotTaux}</td>
                <td style="padding: var(--space-12); text-align: right;">${impotBase} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold);">${formatNumber((impotDetail * multiplicateur))} €</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-12);">CFE <small style="color: var(--color-text-secondary);">(Cotisation Foncière Entreprises)</small></td>
                <td style="padding: var(--space-12); text-align: center;">—</td>
                <td style="padding: var(--space-12); text-align: right;">—</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold);">${formatNumber((cfe * multiplicateur))} €</td>
            </tr>
        `;
    }
    document.getElementById('detailTotalCharges') && (document.getElementById('detailTotalCharges').textContent = formatNumber(totalChargesDetail * multiplicateur) + ' €');
    document.getElementById('detailRevenuNet') && (document.getElementById('detailRevenuNet').textContent = formatNumber(netDetail * multiplicateur) + ' €');

    // === COMPARAISON VL vs IRPP ===
    const scenarios = {
        vl: { charges, cfp: cfpMensuel, impot: impotVL, cfe, total: totalChargesVL, net: netVL },
        irpp: { charges, cfp: cfpMensuel, impot: impotIRPP, cfe, total: totalChargesIRPP, net: netIRPP }
    };
    updateComparaisonVL_IRPP(ca, multiplicateur, scenarios);

    // === PROJECTION 3-5 ANS ===
    updateProjection3_5Ans(ca, multiplicateur, scenarios);

    // === GRAPHIQUE DISTRIBUTION CHARGES ===
    renderChargesDistributionChart(scenarios, multiplicateur);
}

export function updateComparaison(caMensuel) {
    const compContainer = document.getElementById('comparaisonContainer');
    if (!compContainer) return;

    // Sécurité : vérifier que le barème est initialisé
    if (!getTaxSettings().irppBareme || getTaxSettings().irppBareme.length === 0) {
        compContainer.innerHTML = '<p style="color: var(--color-text-secondary);">⏳ Chargement du barème IRPP...</p>';
        return;
    }

    const caAnnuel = caMensuel * 12;
    const comp = compareImpots(caAnnuel);

    const versementLibMensuel = comp.versementLib / 12;
    const irppProgressifMensuel = comp.irppProgressif / 12;
    const economieMensuelle = comp.economie / 12;

    const meilleurLabel = comp.meilleurChoix === 'versementLib' ? 'Versement libératoire' : 'IRPP progressif';
    const meilleurColor = comp.meilleurChoix === 'versementLib' ? 'var(--color-primary)' : 'var(--color-success)';

    compContainer.innerHTML = `
        <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-12);">
            📊 Comparaison des modes d'imposition (CA annuel : ${caAnnuel.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)
        </h3>
        <div style="display: grid; gap: var(--space-8); margin-bottom: var(--space-12);">
            <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-bg-1); border-radius: var(--radius-base);">
                <span><strong>Versement libératoire (${getTaxSettings().versementLiberatoire}%)</strong></span>
                <span><strong>${formatNumber(versementLibMensuel)} €/mois</strong> (${formatNumber(comp.versementLib)} €/an)</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-bg-1); border-radius: var(--radius-base);">
                <span><strong>IRPP progressif</strong> <small style="color: var(--color-text-secondary);">(après abattement BNC ${getTaxSettings().bncAbattement}%)</small></span>
                <span><strong>${formatNumber(irppProgressifMensuel)} €/mois</strong> (${formatNumber(comp.irppProgressif)} €/an)</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-bg-1); border-radius: var(--radius-base);">
                <span style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">Revenu imposable annuel (après abattement BNC)</span>
                <span style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">${formatNumber(comp.revenuImposable)} €</span>
            </div>
        </div>
        <div style="padding: var(--space-12); background: ${meilleurColor}15; border: 2px solid ${meilleurColor}; border-radius: var(--radius-base); text-align: center;">
            <strong style="color: ${meilleurColor}; font-size: var(--font-size-base);">
                ✅ Meilleur choix : ${meilleurLabel}
            </strong>
            <br>
            <span style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">
                Économie : ${formatNumber(economieMensuelle)} €/mois (${formatNumber(comp.economie)} €/an)
            </span>
        </div>
    `;
}

// Fonction génération projection 3-5 ans
export function updateProjection3_5Ans(ca, multiplicateur, baseScenario) {
    const projectionBody = document.getElementById('projectionTableBody');
    if (!projectionBody) return;

    const isMensuel = multiplicateur === 1;
    const anneesProjection = [2025, 2026, 2027, 2028, 2029];
    const tauxURSSAFBase = 24.6; // Taux standard 2025 (année 2+)

    // Déterminer régime fiscal sélectionné
    const regimeVLRadio = document.getElementById('regimeVL');
    const useVL = regimeVLRadio ? regimeVLRadio.checked : false;
    const impotBase = useVL ? baseScenario.vl.impot : baseScenario.irpp.impot;

    // Utiliser le taux CFP dynamique de l'API (ou fallback si non disponible)
    const tauxCFPDynamique = window.lastTauxCFP || getTaxSettings().cfpBNC;

    let html = '';
    anneesProjection.forEach((annee, index) => {
        const tauxURSSAF = tauxURSSAFBase + index; // +1%/an
        const urssaf = ca * (tauxURSSAF / 100) * multiplicateur;
        const cfp = ca * (tauxCFPDynamique / 100) * multiplicateur;
        const impot = impotBase * multiplicateur;
        const cfe = (getTaxSettings().cfeAnnuel / 12) * multiplicateur;
        const totalCharges = urssaf + cfp + impot + cfe;
        const revenuNet = (ca * multiplicateur) - totalCharges;

        const rowStyle = index === 0 ? 'background: var(--color-bg-1);' : '';

        html += `
            <tr style="border-bottom: 1px solid var(--color-border); ${rowStyle}">
                <td style="padding: var(--space-12); font-weight: var(--font-weight-semibold);">${annee}</td>
                <td style="padding: var(--space-12); text-align: center;">${tauxURSSAF.toFixed(1)}%</td>
                <td style="padding: var(--space-12); text-align: right;">${formatNumber(urssaf)} €</td>
                <td style="padding: var(--space-12); text-align: right;">${formatNumber(cfp)} €</td>
                <td style="padding: var(--space-12); text-align: right;">${formatNumber(impot)} €</td>
                <td style="padding: var(--space-12); text-align: right;">${formatNumber(cfe)} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-semibold); color: var(--color-warning);">${formatNumber(totalCharges)} €</td>
                <td style="padding: var(--space-12); text-align: right; font-weight: var(--font-weight-bold); color: var(--color-primary);">${formatNumber(revenuNet)} €</td>
            </tr>
        `;
    });

    projectionBody.innerHTML = html;
}

// Fonction rendu graphique distribution charges
export function renderChargesDistributionChart(scenarios, multiplicateur) {
    const canvas = document.getElementById('chargesDistributionChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { vl, irpp } = scenarios;
    const ca = parseFloat(caInput?.value) || 0;
    const caTotal = ca * multiplicateur;

    // Dimensions
    const chartWidth = canvas.width - 120;
    const chartHeight = canvas.height - 80;
    const barWidth = 80;
    const gap = 100;
    const startX = 60;
    const startY = canvas.height - 40;

    // Couleurs
    const colors = {
        urssaf: '#003366',
        cfp: '#0066cc',
        impot: '#3399ff',
        cfe: '#66b3ff',
        net: '#00cc66'
    };

    // Fonction de dessin barre empilée
    function drawStackedBar(x, scenario, label) {
        const scale = chartHeight / caTotal;
        let currentY = startY;

        // URSSAF
        const urssafHeight = scenario.charges * multiplicateur * scale;
        ctx.fillStyle = colors.urssaf;
        ctx.fillRect(x, currentY - urssafHeight, barWidth, urssafHeight);
        currentY -= urssafHeight;

        // CFP
        const cfpHeight = scenario.cfp * multiplicateur * scale;
        ctx.fillStyle = colors.cfp;
        ctx.fillRect(x, currentY - cfpHeight, barWidth, cfpHeight);
        currentY -= cfpHeight;

        // Impôt
        const impotHeight = scenario.impot * multiplicateur * scale;
        ctx.fillStyle = colors.impot;
        ctx.fillRect(x, currentY - impotHeight, barWidth, impotHeight);
        currentY -= impotHeight;

        // CFE
        const cfeHeight = scenario.cfe * multiplicateur * scale;
        ctx.fillStyle = colors.cfe;
        ctx.fillRect(x, currentY - cfeHeight, barWidth, cfeHeight);
        currentY -= cfeHeight;

        // Net
        const netHeight = scenario.net * multiplicateur * scale;
        ctx.fillStyle = colors.net;
        ctx.fillRect(x, currentY - netHeight, barWidth, netHeight);

        // Label
        ctx.fillStyle = '#000';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + barWidth / 2, startY + 20);

        // Total
        ctx.fillText(`${(scenario.total * multiplicateur).toFixed(0)} €`, x + barWidth / 2, startY + 35);
    }

    // Dessiner les deux barres
    drawStackedBar(startX, irpp, 'IRPP');
    drawStackedBar(startX + barWidth + gap, vl, 'VL');

    // Axe Y (échelle)
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX - 10, startY);
    ctx.lineTo(startX - 10, startY - chartHeight);
    ctx.stroke();

    // Valeurs axe Y
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const value = (caTotal / 5) * i;
        const y = startY - (chartHeight / 5) * i;
        ctx.fillText(`${value.toFixed(0)} €`, startX - 15, y + 4);
    }
}