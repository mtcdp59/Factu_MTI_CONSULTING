# Copilot Instructions for MTI CONSULTING

## Project Overview
This is a browser-based freelance management tool for MTI CONSULTING. The app is built with vanilla JavaScript (`app.js`) and a single HTML file (`index.html`). It stores data in `localStorage` and syncs with a Google Apps Script backend via REST API.

## Architecture & Data Flow
- **Frontend only**: No Node.js, no build system, no package manager.
- **Data Storage**: Uses browser `localStorage` for clients, invoices, tasks, company info, and tax settings.
- **Sync**: Communicates with Google Apps Script backend (`BACKEND_URL` in `app.js`) for data persistence and remote operations.
- **Company Info**: Hardcoded defaults for MTI CONSULTING, loaded from `localStorage` if available.
- **Tax Settings**: Defaults provided, can be customized and saved in `localStorage`.

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

---
**For AI agents:**
- Focus on localStorage and Google Apps Script integration.
- Respect French language and branding conventions.
- No build/test scripts; manual browser testing only.
- Document new patterns in this file for future agents.
