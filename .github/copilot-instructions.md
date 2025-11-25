# Copilot Instructions for MTI CONSULTING

## Project Overview
This is a browser-based freelance management tool for MTI CONSULTING. The app is built with vanilla JavaScript (`app.js`) and a single HTML file (`index.html`). It stores data in Google Drive via a Google Apps Script backend (v42 style - no CORS handling).

## Architecture & Data Flow (v42 Style)
- **Frontend only**: No Node.js, no build system, no package manager.
- **Data Storage**: Google Drive (`mti_data.json`) via Google Apps Script backend.
- **Sync**: Communicates with Google Apps Script backend (hardcoded `BACKEND_URL` in `app.js`) for all operations.
- **Company Info**: Hardcoded defaults for MTI CONSULTING in `app.js` (name, SIRET, address, IBAN, BIC, etc.).
- **Tax Settings**: Defaults provided in `app.js`, can be customized and saved.
- **Configuration**: Credentials hardcodés dans `app.js` (v42 style), modifiables via l'onglet Paramètres (sauvegarde dans localStorage).
- **Backend**: Google Apps Script sans gestion CORS (retours de réponses directs via `ContentService`).

## Developer Workflows
- **No build step**: Directly open `index.html` in a browser to run the app.
- **Debugging**: Use browser DevTools (Console, Network tab) to inspect data, debug JS, and monitor API calls.
- **Testing**: No automated tests; manual testing via UI interactions.
- **Data Reset**: Clear browser `localStorage` to reset app state.

## Project-Specific Patterns
- **Data Save/Load**: All major entities (clients, invoices, tasks) have dedicated save/load functions using `localStorage`.
- **Edit Mode**: Controlled by `isEditMode` and `editingInvoiceIndex` for invoice editing.
- **Sync State**: `isSyncing` and `lastSyncTime` track backend sync status.
- **UI/UX**: Custom color tokens and styles in `index.html` for branding.

## Integration Points
- **Google Apps Script**: All remote operations use the `BACKEND_URL` endpoint. See `app.js` for request logic.
- **Logo**: Uses a static image (`MTI_CONSULTING.png`) and a GitHub raw URL for company branding.

## Conventions
- **French language**: UI and code comments are primarily in French.
- **Single-page app**: All logic in `app.js`, all UI in `index.html`.
- **No frameworks**: Pure JS/HTML/CSS, no React/Vue/Angular.

## Key Files
- `app.js`: Main application logic, data management, API sync.
- `index.html`: UI, styles, and color tokens.
- `MTI_CONSULTING.png`: Company logo.

## Example Patterns
```js
// Save clients to localStorage
function saveClients() {
  localStorage.setItem('mti_clients', JSON.stringify(clients));
}

// Sync with backend
fetch(BACKEND_URL, { method: 'POST', body: ... })
```

## v42 Style Architecture
- **No CORS handling**: Backend returns responses directly without `setHeader()` calls
- **Hardcoded credentials**: All config in `app.js` (lines 4-14), modifiable via UI
- **Empty initial data**: `clients = []`, `invoices = []`, `tasks = []` (loaded from Drive at startup)
- **Company info defaults**: Full MTI CONSULTING info hardcoded (SIRET, address, IBAN, BIC)
- **GitHub Pages ready**: Works immediately without configuration files

---
**For AI agents:**
- Focus on localStorage and Google Apps Script integration.
- Respect French language and branding conventions.
- No build/test scripts; manual browser testing only.
- Document new patterns in this file for future agents.
