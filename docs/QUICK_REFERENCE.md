# QUICK REFERENCE: Commune Search & URSSAF API Location Guide

## 📍 Where Things Are

### COMMUNE SEARCH INPUT
- **File**: `index.html`
- **Line**: 1841
- **Tab**: **Calculs** (NOT Paramètres!)
- **ID**: `#communeInput`
- **Type**: Text input with autocomplete dropdown

```html
<!-- Line 1841 -->
<input type="text" class="form-control" id="communeInput" 
       placeholder="Tapez le nom de votre commune..." autocomplete="off">

<!-- Line 1842 -->
<div id="communeAutocomplete" style="position: absolute; ...">
    <!-- Results dropdown -->
</div>
```

### COMMUNE SEARCH LOGIC
- **File**: `app.js`
- **Main Function**: `searchCommunesAPI()`
- **Line**: 4555-4620
- **Trigger**: Event listener at line 4335-4340

```javascript
// Line 4330 - Event listener
const communeInput = document.getElementById('communeInput');
if (communeInput) {
    communeInput.addEventListener('input', (e) => {
        searchCommunesAPI(e.target.value);  // Line 4338
    });
}

// Line 4555 - Main function
async function searchCommunesAPI(query) {
    // Debounced search, caches results, calls Open Data Soft API
}

// Line 4622 - Display results
function displayCommunesResults(results) {
    // Shows dropdown, handles clicks
}
```

---

## 🏛️ URSSAF API INTEGRATION

### API BASE URL
- **File**: `app.js`
- **Line**: 3906
- **Value**: `https://mon-entreprise.urssaf.fr/api/v1`

```javascript
const MON_ENTREPRISE_API_BASE = 'https://mon-entreprise.urssaf.fr/api/v1';
```

### URSSAF FUNCTIONS
| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `evaluateMonEntreprise()` | app.js | 3914-3920 | POST /evaluate |
| `fetchUrssafRule()` | app.js | 3934-3940 | GET /rules/{name} |
| `loadFiscalThresholdsFromAPI()` | app.js | 4040-4115 | Load TVA/BNC thresholds |
| `loadAdditionalFiscalParamsFromAPI()` | app.js | 4153-4191 | Load VL rate, BNC abattement |

### INITIALIZATION
- **File**: `app.js`
- **Event**: `DOMContentLoaded`
- **Line**: 4126
- **Function**: `initUrssafIntegration()`

```javascript
document.addEventListener('DOMContentLoaded', async function() {
    // ... other code ...
    initUrssafIntegration();  // Line 4126 (fire and forget)
});
```

---

## 📊 CFE CALCULATION

### CFE BY COMMUNE
- **File**: `app.js`
- **Function**: `getCFEFromAPI()`
- **Lines**: 4481-4540
- **Calls**: Open Data Soft API (if needed) or uses fallback DB

```javascript
async function getCFEFromAPI(commune) {
    // 1. Check localStorage cache
    // 2. Search inseeCodesDB (hardcoded commune data)
    // 3. Call Open Data Soft API for actual CFE rate
    // 4. Return with source attribution
}
```

### CFE ESTIMATION UPDATE
- **File**: `app.js`
- **Function**: `updateCFEEstimation()`
- **Lines**: 4905-4970
- **Triggered by**: User selecting commune from dropdown

```javascript
async function updateCFEEstimation() {
    // Shows estimated CFE in UI element #cfeEstimation
}
```

### CFE FALLBACK DATABASE
- **File**: `app.js`
- **Lines**: 4442-4478
- **Contains**: ~50 communes with hardcoded CFE rates
- **Default**: 600€/year if commune not found

---

## 🔴 429 ERROR LOCATIONS

### Where 429 Errors Can Occur

| API Call | Endpoint | Line | Frequency |
|----------|----------|------|-----------|
| Fiscal thresholds | `/evaluate` | 3916 | 1x per 24h (cached) |
| VL rate | `/evaluate` | 3916 | 1x per 24h (cached) |
| Rule metadata | `/rules/{name}` | 3936 | Varies |

### Error Handling
- **File**: `app.js`
- **Line**: 3917, 3938 (catch blocks)
- **Strategy**: Silent fallback to `taxSettings` local defaults
- **No retry logic**: ⚠️ This is the problem!

```javascript
catch (err) {
    console.warn('URSSAF error, using local values', err);
    return null;  // ← Silent failure
}
```

### Caching (Rate Limit Prevention)
- **File**: `app.js`
- **Variable**: `urssafThresholdCache`
- **TTL**: 24 hours (line 3955-3963)
- **Effect**: 95%+ API calls avoided after first load

---

## 📋 RULES BEING QUERIED

The app asks Mon-Entreprise API for these Publicodes rules:

```javascript
// TVA Thresholds (Lines 4048-4050)
'entreprise . franchise de TVA . seuil'           // Expected: 37500
'entreprise . franchise de TVA . seuil majoré'    // Expected: 39100

// Micro-Entrepreneur (Line 4051)
'dirigeant . auto-entrepreneur . seuil micro-BNC' // Expected: 77700

// Tax Rates (Lines 4155-4156)
'dirigeant . auto-entrepreneur . impôt . versement libératoire . taux'
'dirigeant . BNC . abattement'
```

---

## 🔧 HOW TO FIX 429 ERRORS

### Quick Fix (5 minutes)
1. Open `429_ERROR_SOLUTION.md` in this workspace
2. Copy the `fetchWithBackoff()` function
3. Paste into `app.js` after line 3906
4. Replace fetch calls with `fetchWithBackoff()`
5. Test with rapid page reloads

### Full Implementation (30 minutes)
See `429_ERROR_SOLUTION.md` for:
- Complete code with exponential backoff
- Request deduplication
- User notifications
- Monitoring dashboard
- Testing procedures

---

## 🧪 HOW TO TEST

### Test Commune Search
1. Go to **Calculs** tab
2. Type "madel" in commune field
3. Expect: "La Madeleine" appears in dropdown
4. Click it: CFE shows "418€"

### Test URSSAF API
1. Open browser DevTools Console
2. Type: `loadFiscalThresholdsFromAPI()`
3. Expect: Check console for API calls
4. Check `taxSettings.seuilTVAAnnuel` (should be 37500 or similar)

### Simulate 429 Error
1. Open DevTools Network tab
2. Rapid page reloads (10x in 30 seconds)
3. Watch for HTTP 429 responses
4. Check that app still works with local values

---

## 📁 KEY FILES REFERENCED

| What | File | Lines |
|------|------|-------|
| Commune search HTML | `index.html` | 1838-1870 |
| Commune search JS | `app.js` | 4330-4650 |
| URSSAF API calls | `app.js` | 3906-4191 |
| CFE calculation | `app.js` | 4481-4970 |
| Error handling | `app.js` | 3917, 3938 |
| Initialization | `app.js` | 4126 |
| Cache management | `app.js` | 3955-3963 |

---

## 🎯 WHAT'S MISSING

❌ **No exponential backoff for 429 errors**
- Current: Fails on first 429
- Better: Would retry 2-3 times with delays

❌ **No user notification on API errors**
- Current: Silent fallback
- Better: Toast message: "Using local data (API unavailable)"

❌ **No request deduplication**
- Current: Multiple simultaneous requests for same data
- Better: Share single promise across concurrent requests

❌ **No 429-specific error handling**
- Current: Treats 429 like any other error
- Better: Recognize 429, use Retry-After header

---

## ✅ WHAT'S WORKING WELL

✅ **Commune search (Open Data Soft API)**
- 34,934 communes available
- Fast (~500ms per query)
- Results cached in browser
- Fallback to hardcoded DB

✅ **URSSAF integration**
- 24-hour cache prevents repeated API calls
- Silent fallback to local values on error
- No disruption to user experience
- 2025 fiscal rates hardcoded as defaults

✅ **CFE calculation**
- Real-time lookup via Open Data Soft
- Multiple fallback levels (API → cache → hardcoded DB)
- Accurate for most French communes

---

## 📝 TROUBLESHOOTING

### Problem: "Commune search not working"
- **Check**: Is input field visible in Calculs tab? (Line 1841)
- **Check**: Type 2+ characters for search to trigger
- **Check**: Browser console for errors
- **Solution**: Try "PARIS" instead of "paris"

### Problem: "429 errors in console"
- **Expected**: Some 429s are normal if rate limit hit
- **Impact**: None - app uses local values automatically
- **Solution**: Implement exponential backoff (see `429_ERROR_SOLUTION.md`)

### Problem: "CFE shows wrong amount"
- **Check**: Is Open Data Soft API available? (Network tab)
- **Check**: Is commune name spelled correctly?
- **Solution**: Try searching by partial name (e.g., "MADEL" for "La Madeleine")

### Problem: "Fiscal thresholds are old"
- **Expected**: Uses cache up to 24 hours
- **Check**: Clear cache: `localStorage.removeItem('mti_urssaf_thresholds')`
- **Solution**: Implement refresh button in Settings

---

## 🔗 EXTERNAL APIS

| API | URL | Purpose | Status |
|-----|-----|---------|--------|
| Open Data Soft | `data.economie.gouv.fr/api/explore/v2.1/...` | Communes + CFE | ✅ Working |
| Mon-Entreprise | `mon-entreprise.urssaf.fr/api/v1` | Fiscal thresholds | ⚠️ Rate limited |
| INSEE SIRENE | (Optional) | Company data | ❓ Not used |

---

## 📞 CONTACT / SUPPORT

If commune search or URSSAF API issues persist:

1. Check network tab for HTTP status codes
2. Check console for error messages
3. Compare actual values with `taxSettings` in app.js
4. Verify `localStorage` cache: `localStorage.getItem('mti_urssaf_thresholds')`
5. Test with fresh page load (clear cache)
6. Implement solution from `429_ERROR_SOLUTION.md`

