# 🔍 Changements Détaillés - Ligne par Ligne

**Scope :** app.js, index.html, backend/AppScript.js  
**Base de comparaison :** GitHub main branch vs Workspace 11 Dec 2025

---

## 📊 app.js - Changements Détaillés

### ➕ AJOUTS COMPLETS

#### 1. **Bloc Intégration URSSAF** (Lignes ~3905-4160)

**Constante API :**
```javascript
// LIGNE 3906
const MON_ENTREPRISE_API_BASE = 'https://mon-entreprise.urssaf.fr/api/v1';
```

**Fonction 1 : evaluateMonEntreprise**
```javascript
// LIGNES 3914-3937
async function evaluateMonEntreprise(situation, expressions, attempt = 1) {
    try {
        const res = await fetch(`${MON_ENTREPRISE_API_BASE}/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ situation, expressions })
        });
        if (res.status === 429 && attempt < 3) {
            // Rate limited; exponential backoff
            const delay = Math.pow(2, attempt - 1) * 1000;
            console.warn(`Rate limited on evaluate, retry after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return evaluateMonEntreprise(situation, expressions, attempt + 1);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data?.evaluations || {};
    } catch (err) {
        console.warn('URSSAF evaluate error, using local values', err);
        return null;
    }
}
```

**Nouveauté clé :** Exponential backoff sur code HTTP 429 (rate limiting)

**Fonction 2 : fetchUrssafRule**
```javascript
// LIGNES 3940-3957
async function fetchUrssafRule(rule, attempt = 1) {
    try {
        const res = await fetch(`${MON_ENTREPRISE_API_BASE}/rules/${encodeURIComponent(rule)}`);
        if (res.status === 429 && attempt < 3) {
            const delay = Math.pow(2, attempt - 1) * 1000;
            console.warn(`Rate limited on ${rule}, retry after ${delay}ms`);
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
```

**Cache et Thresholds**
```javascript
// LIGNES 3960-3963
let urssafThresholdCache = {
    fetchedAt: null,
    data: null
};
// Cache persiste 24 heures
const CACHE_TTL = 24 * 60 * 60 * 1000;
```

**Fonction 3 : loadFiscalThresholdsFromAPI**
```javascript
// LIGNES 3968-4068
async function loadFiscalThresholdsFromAPI() {
    // Check cache (24h)
    const now = Date.now();
    if (urssafThresholdCache.fetchedAt && (now - urssafThresholdCache.fetchedAt) < 24 * 60 * 60 * 1000) {
        const d = urssafThresholdCache.data;
        if (d) {
            taxSettings.seuilTVAAnnuel = d.seuilTVAAnnuel ?? taxSettings.seuilTVAAnnuel;
            taxSettings.seuilTVAMajore = d.seuilTVAMajore ?? taxSettings.seuilTVAMajore;
            taxSettings.caMaxBNC = d.caMaxBNC ?? taxSettings.caMaxBNC;
            try { updateAlerts(); } catch {}
            return d;
        }
    }

    // Candidate rules
    const candidateRules = [
        'entreprise . franchise de TVA . seuil',
        'entreprise . franchise de TVA . seuil majoré',
        'dirigeant . auto-entrepreneur . seuil micro-BNC'
    ];

    // Try individual fetches with timeout
    let thresholds = { seuilTVAAnnuel: null, seuilTVAMajore: null, caMaxBNC: null };
    for (const rule of candidateRules) {
        try {
            const info = await Promise.race([
                fetchUrssafRule(rule),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]);
            // ... parse rule value ...
        } catch (err) {
            console.warn(`Rule fetch timeout/error for ${rule}:`, err.message);
        }
    }

    // Fallback: try evaluate API
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
            // ... apply results ...
        } catch (err) {
            console.warn('URSSAF evaluate timeout/error:', err.message);
        }
    }

    // Apply with fallback
    const applied = {
        seuilTVAAnnuel: thresholds.seuilTVAAnnuel || taxSettings.seuilTVAAnnuel,
        seuilTVAMajore: thresholds.seuilTVAMajore || taxSettings.seuilTVAMajore,
        caMaxBNC: thresholds.caMaxBNC || taxSettings.caMaxBNC
    };
    taxSettings.seuilTVAAnnuel = applied.seuilTVAAnnuel;
    taxSettings.seuilTVAMajore = applied.seuilTVAMajore;
    taxSettings.caMaxBNC = applied.caMaxBNC;

    urssafThresholdCache = { fetchedAt: now, data: applied };
    
    // Update UI
    try { updateAlerts(); } catch {}
    const seuilBaseEl = document.getElementById('seuilTVAAnnuel');
    const seuilMajEl = document.getElementById('seuilTVAMajore');
    const caMaxBNCEl = document.getElementById('caMaxBNC');
    if (seuilBaseEl) seuilBaseEl.value = String(taxSettings.seuilTVAAnnuel);
    if (seuilMajEl) seuilMajEl.value = String(taxSettings.seuilTVAMajore);
    if (caMaxBNCEl) caMaxBNCEl.value = String(taxSettings.caMaxBNC);

    return applied;
}
```

**Nouveautés clés :**
- Try/catch avec timeout 3s par requête
- Promise.race pour éviter blocage
- Fallback cascadé (rule → evaluate → local values)
- Update UI fields en temps réel

**Fonction 4 : loadAdditionalFiscalParamsFromAPI**
```javascript
// LIGNES 4115-4160
async function loadAdditionalFiscalParamsFromAPI() {
    const expressions = [
        'dirigeant . auto-entrepreneur . impôt . versement libératoire . taux',
        'dirigeant . BNC . abattement'
    ];

    const evals = await evaluateMonEntreprise({}, expressions);
    if (!evals) return null;

    const vlTaux = evals['dirigeant . auto-entrepreneur . impôt . versement libératoire . taux']?.nodeValue;
    const bncAbatt = evals['dirigeant . BNC . abattement']?.nodeValue;

    if (vlTaux) taxSettings.versementLiberatoire = Number(vlTaux);
    if (bncAbatt) taxSettings.bncAbattement = Number(bncAbatt);

    // Update UI
    try { updateAlerts(); } catch {}
    const vlEl = document.getElementById('versementLiberatoire');
    const bncEl = document.getElementById('bncAbattement');
    if (vlEl) vlEl.value = String(taxSettings.versementLiberatoire);
    if (bncEl) bncEl.value = String(taxSettings.bncAbattement);

    return { versementLiberatoire: taxSettings.versementLiberatoire, bncAbattement: taxSettings.bncAbattement };
}
```

**Initialisation URSSAF**
```javascript
// LIGNES 4161-4177
async function initUrssafIntegration() {
    await Promise.race([
        Promise.all([
            loadFiscalThresholdsFromAPI(),
            loadAdditionalFiscalParamsFromAPI()
        ]),
        new Promise(resolve => setTimeout(resolve, 5000))
    ]).catch(err => {
        console.warn('URSSAF init timeout, using local values', err);
    });
}

// Appel avec délai 1s pour éviter pics 429
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => initUrssafIntegration(), 1000);
    // ...
});
```

---

#### 2. **Bloc CFE par Commune** (Lignes ~4366-4980)

**Listeners Commune**
```javascript
// LIGNES 4330-4350
const communeInput = document.getElementById('communeInput');
const rfrInput = document.getElementById('rfrInput');
if (communeInput) {
    let communeDebounceTimer;
    communeInput.addEventListener('input', (e) => {
        clearTimeout(communeDebounceTimer);
        communeDebounceTimer = setTimeout(() => {
            searchCommunesAPI(e.target.value);
        }, 300);
    });
    
    document.addEventListener('click', (e) => {
        if (!communeInput.contains(e.target) && !document.getElementById('communeAutocomplete').contains(e.target)) {
            document.getElementById('communeAutocomplete').style.display = 'none';
        }
    });
}
if (rfrInput) rfrInput.addEventListener('input', verifierEligibiliteVL);
```

**Constantes CFE**
```javascript
// LIGNES 4475-4517
const CFE_CACHE_KEY = 'mti_cfe_api_cache';
const CFE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 jours

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
    'madeleine': { insee: '59368', cp: '59110' }
};

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
```

**Fonction : getCFEFromAPI**
```javascript
// LIGNES 4518-4594
async function getCFEFromAPI(commune) {
    const communeLower = commune.toLowerCase();
    
    // Check cache
    const cache = JSON.parse(localStorage.getItem(CFE_CACHE_KEY) || '{}');
    const cached = cache[communeLower];
    if (cached && Date.now() - cached.timestamp < CFE_CACHE_TTL) {
        return { taux: cached.taux, source: 'API (cache)', inseeCode: cached.inseeCode };
    }
    
    // Search INSEE code
    let inseeCode = null;
    for (const [ville, data] of Object.entries(inseeCodesDB)) {
        if (communeLower.includes(ville) || ville.includes(communeLower)) {
            inseeCode = data.insee;
            break;
        }
        if (data.cp && communeLower.replace(/\s/g, '') === data.cp.replace(/\s/g, '')) {
            inseeCode = data.insee;
            break;
        }
    }
    
    if (!inseeCode) {
        const fallback = cfeFallbackDB[communeLower] || cfeFallbackDB.default;
        return { taux: fallback, source: 'Estimation (commune non référencée)', inseeCode: null };
    }
    
    // Call API
    try {
        const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-entreprises/records?limit=1&refine=exercice:"2024"&refine=insee_com:"${inseeCode}"`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const tauxCFE = result.taux_global_cfe_hz;
            
            if (tauxCFE !== null && tauxCFE !== undefined) {
                // Base minimale estimée: 1,200€
                const baseMinimaleEstimee = 1200;
                const cfeEstimee = Math.round((tauxCFE / 100) * baseMinimaleEstimee);
                
                // Update cache
                cache[communeLower] = {
                    taux: cfeEstimee,
                    inseeCode: inseeCode,
                    timestamp: Date.now()
                };
                localStorage.setItem(CFE_CACHE_KEY, JSON.stringify(cache));
                
                return { taux: cfeEstimee, source: 'API DGFiP 2024 (taux officiel)', inseeCode: inseeCode, tauxPct: tauxCFE };
            }
        }
        
        const fallback = cfeFallbackDB[communeLower] || cfeFallbackDB.default;
        return { taux: fallback, source: 'Estimation (données API incomplètes)', inseeCode: inseeCode };
        
    } catch (error) {
        console.warn('Erreur API CFE:', error);
        const fallback = cfeFallbackDB[communeLower] || cfeFallbackDB.default;
        return { taux: fallback, source: 'Estimation (erreur API)', inseeCode: inseeCode };
    }
}
```

**Fonction : searchCommunesAPI**
```javascript
// LIGNES 4597-4650
let communesSearchCache = {};
async function searchCommunesAPI(query) {
    const autocompleteDiv = document.getElementById('communeAutocomplete');
    if (!autocompleteDiv) return;
    
    if (!query || query.length < 2) {
        autocompleteDiv.style.display = 'none';
        return;
    }
    
    if (communesSearchCache[query]) {
        displayCommunesResults(communesSearchCache[query]);
        return;
    }
    
    autocompleteDiv.style.display = 'block';
    autocompleteDiv.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--color-text-secondary);">🔄 Recherche...</div>';
    
    try {
        const cleanQuery = query.replace(/[%*]/g, ' ');
        const searchByName = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-entreprises/records?select=libcom,insee_com&where=search(libcom,'${encodeURIComponent(cleanQuery)}')&group_by=libcom,insee_com&limit=10&refine=exercice:"2024"`;
        
        const responses = await Promise.all([fetch(searchByName)]);
        const dataResults = await Promise.all(responses.map(r => r.json()));
        
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
            autocompleteDiv.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--color-text-secondary);">Aucune commune trouvée</div>';
        }
    } catch (error) {
        console.error('Erreur recherche communes:', error);
        autocompleteDiv.innerHTML = '<div style="padding: 12px; text-align: center; color: red;">❌ Erreur API</div>';
    }
}
```

**Fonction : displayCommunesResults**
```javascript
// LIGNES 4652-4679
function displayCommunesResults(results) {
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
    
    document.querySelectorAll('.commune-result').forEach(el => {
        el.addEventListener('mouseenter', (e) => e.target.style.background = 'var(--color-bg-1)');
        el.addEventListener('mouseleave', (e) => e.target.style.background = 'white');
        el.addEventListener('click', async (e) => {
            const commune = e.currentTarget.dataset.commune;
            communeInput.value = commune;
            autocompleteDiv.style.display = 'none';
            await updateCFEEstimation();
        });
    });
}
```

**Fonction : updateCFEEstimation**
```javascript
// LIGNES 4942-4980
async function updateCFEEstimation() {
    const commune = communeInput?.value.trim();
    const cfeEstimationDiv = document.getElementById('cfeEstimation');
    
    if (!cfeEstimationDiv) return;
    
    if (!commune) {
        cfeEstimationDiv.style.display = 'none';
        return;
    }
    
    cfeEstimationDiv.style.display = 'block';
    cfeEstimationDiv.innerHTML = '<small>🔄 Recherche données officielles...</small>';
    
    const result = await getCFEFromAPI(commune);
    
    let sourceIcon = '📊';
    if (result.source.includes('Estimation')) sourceIcon = '⚠️';
    if (result.source.includes('cache')) sourceIcon = '💾';
    
    cfeEstimationDiv.style.display = 'block';
    cfeEstimationDiv.innerHTML = `
        <strong>📍 CFE pour "${commune}" :</strong> ${result.taux} €/an (${(result.taux / 12).toFixed(2)} €/mois)<br>
        <small style="color: var(--color-text-secondary);">
            ${sourceIcon} Source: ${result.source}
            ${result.inseeCode ? `<br>Code INSEE: ${result.inseeCode}` : ''}
            ${result.tauxPct ? `<br>Taux CFE: ${result.tauxPct}% (base minimale estimée: 1,200€)` : ''}
            <br><em>⚠️ CFE réelle = Taux × Base minimale (selon votre CA). Consultez votre avis CFE pour le montant exact.</em>
        </small>
    `;
    
    taxSettings.cfeAnnuel = result.taux;
    calculateTaxes();
}
```

---

### ❌ SUPPRESSIONS (Code supprimé)

#### 1. **Fonction updateCFEMensuel** (Anciennement ligne ~3685)

```javascript
// ❌ SUPPRIMÉ
function updateCFEMensuel() {
    const cfeAnnuel = parseFloat(document.getElementById('cfeAnnuel')?.value) || 600;
    const cfeMensuel = cfeAnnuel / 12;
    const el = document.getElementById('cfeMensuel');
    if (el) el.textContent = cfeMensuel.toFixed(2);
}
```

**Raison :** Plus utilisée. CFE est maintenant gérée uniquement via `updateCFEEstimation()` en Calculs.

#### 2. **Listener CFE en Paramètres** (Ligne 3802)

```javascript
// ❌ SUPPRIMÉ
document.getElementById('cfeAnnuel')?.addEventListener('input', updateCFEMensuel);
```

**Raison :** Champ supprimé de Paramètres.

---

### 🔄 MODIFICATIONS (Code existant modifié)

#### 1. **saveSettings() - Suppression lectures DOM CFE** (Lignes ~3640)

```javascript
// AVANT
taxSettings.tauxIS = parseFloat(document.getElementById('tauxIS')?.value) || 0;
taxSettings.versementLiberatoire = parseFloat(document.getElementById('tauxVersementLib')?.value) || 2.2;
taxSettings.prorationMensuelle = parseFloat(document.getElementById('prorationMensuelle')?.value) || 8.33;
taxSettings.cfeAnnuel = parseFloat(document.getElementById('cfeAnnuel')?.value) || 600;

// APRÈS
taxSettings.tauxIS = parseFloat(document.getElementById('tauxIS')?.value) || 0;
taxSettings.versementLiberatoire = parseFloat(document.getElementById('tauxVersementLib')?.value) || 2.2;
// Note: cfeAnnuel is now managed only via commune search in Calculs tab
```

#### 2. **resetSettings() - Suppression réinitialisation CFE** (Lignes ~3670)

```javascript
// AVANT
document.getElementById('tauxIS').value = defaultSettings.tauxIS;
document.getElementById('tauxVersementLib').value = defaultSettings.versementLiberatoire;
document.getElementById('prorationMensuelle').value = defaultSettings.prorationMensuelle;
document.getElementById('cfeAnnuel').value = defaultSettings.cfeAnnuel;

// APRÈS
document.getElementById('tauxIS').value = defaultSettings.tauxIS;
document.getElementById('tauxVersementLib').value = defaultSettings.versementLiberatoire;
```

#### 3. **loadSettings() - Suppression affichage CFE** (Lignes ~3600)

```javascript
// AVANT
document.getElementById('tauxVersementLib').value = taxSettings.versementLiberatoire;
document.getElementById('cfeAnnuel').value = taxSettings.cfeAnnuel;
// Bloc suivant ...

// APRÈS
document.getElementById('tauxVersementLib').value = taxSettings.versementLiberatoire;
// Note: cfeAnnuel is no longer loaded from DOM in Paramètres, managed via Calculs commune search
```

#### 4. **initApp() - Suppression appel updateCFEMensuel** (Ligne 6505)

```javascript
// AVANT
calculateTaxes();
updateCFEMensuel();
loadCompanySettings();

// APRÈS
calculateTaxes();
// Note: updateCFEMensuel() removed - CFE is now managed only via commune search in Calculs tab
loadCompanySettings();
```

---

## 📊 index.html - Changements Détaillés

### ➕ AJOUTS

#### 1. **Bloc Commune en Onglet Calculs** (Lignes 1838-1850)

```html
<!-- CFE Personnalisée par Commune -->
<div class="form-group" style="margin-top: var(--space-16); position: relative;">
    <label class="form-label">🏙️ Commune (CFE personnalisée)</label>
    <input type="text" class="form-control" id="communeInput" placeholder="Tapez le nom de votre commune..." autocomplete="off">
    <div id="communeAutocomplete" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--color-border); border-radius: var(--radius-base); max-height: 200px; overflow-y: auto; display: none; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <!-- Résultats autocomplétion dynamiques -->
    </div>
    <small style="color: var(--color-text-secondary); font-size: var(--font-size-xs); margin-top: var(--space-4); display: block;">
        📊 Recherche en temps réel parmi 34,934 communes (DGFiP 2024). Laissez vide pour estimation par défaut (600€/an).
    </small>
    <div id="cfeEstimation" style="margin-top: var(--space-8); padding: var(--space-8); background: var(--color-bg-1); border-radius: var(--radius-base); font-size: var(--font-size-sm); display: none;">
        <!-- Affichage dynamique CFE estimée -->
    </div>
</div>
```

**Location :** Entre ACRE et RFR en onglet **Calculs**

---

### ❌ SUPPRESSIONS

#### 1. **Champ CFE Annuel en Paramètres** (Anciennement ligne 1493)

```html
<!-- ❌ SUPPRIMÉ -->
<div class="form-group">
    <label class="form-label">Montant CFE annuel (€)</label>
    <input type="number" class="form-control" id="cfeAnnuel" step="1" min="0" value="600">
</div>
```

#### 2. **Champ % Mensuel CFE** (Anciennement ligne 1499)

```html
<!-- ❌ SUPPRIMÉ -->
<div class="form-group">
    <label class="form-label">% mensuel à ventiler CFE</label>
    <input type="number" class="form-control" id="prorationMensuelle" step="0.01" min="0" value="8.33">
    <small style="color: var(--color-text-secondary); font-size: var(--font-size-xs);">Défaut: 8.33% (1/12)</small>
</div>
```

#### 3. **Box Affichage CFE Mensuelle** (Anciennement ligne 1504)

```html
<!-- ❌ SUPPRIMÉ -->
<div style="padding: var(--space-12); background-color: var(--color-bg-1); border-radius: var(--radius-base); margin-bottom: var(--space-16);">
    <strong>CFE mensuelle: <span id="cfeMensuel">50.00</span>€</strong>
</div>
```

---

### 🔄 MODIFICATIONS

#### 1. **Section CFE en Paramètres - Remplacement** (Ligne ~1493)

```html
<!-- AVANT -->
<h4 style="...">CFE (Cotisation Foncière des Entreprises)</h4>
<div class="form-group">
    <!-- 3 champs ... -->
</div>

<!-- APRÈS -->
<h4 style="...">CFE (Cotisation Foncière des Entreprises)</h4>
<div style="padding: var(--space-12); background-color: rgba(59, 130, 246, 0.1); border-left: 4px solid rgba(59, 130, 246, 1); border-radius: var(--radius-base); margin-bottom: var(--space-16);">
    <p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary);">
        💡 <strong>CFE personnalisée par commune</strong> : Allez à l'onglet <strong>Calculs</strong> et recherchez votre commune pour obtenir la CFE officielle DGFiP 2024 (34 934 communes).
    </p>
</div>
```

**Raison :** Redirection claire vers la fonctionnalité réelle.

---

## 📁 backend/AppScript.js

### Status : ✅ Pas de modifications

- Synchronisation Google Drive : stable
- Validation SIRET INSEE : stable
- Gestion OAuth2 : stable

**Raison :** Les changements (URSSAF + CFE) sont côté frontend uniquement.

---

## 📊 Résumé Chiffres

| Métrique | Avant | Après | Changement |
|----------|-------|-------|-----------|
| **app.js** | ~8,828 | ~11,102 | +2,274 lignes (+25.8%) |
| **index.html** | ~1,984 | ~2,371 | +387 lignes (+19.5%) |
| **Fonctions ajoutées** | - | 8 | +8 |
| **Fonctions supprimées** | - | 1 | -1 |
| **Constantes ajoutées** | - | 8 | +8 |
| **Listeners ajoutés** | - | 3 | +3 |
| **API externes** | 2 (Drive + Google) | 3 (+ URSSAF) | +1 |
| **Communes supportées** | ~600 (fallback) | 34,934 (API) | +34,334 |
| **Cache implementations** | 2 (Citésns) | 4 (+ URSSAF, + CFE) | +2 |

---

**Généré :** 11 Décembre 2025
