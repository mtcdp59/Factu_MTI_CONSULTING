import {
    CONFIG,
    getIsGoogleSignedIn,
    setIsGoogleSignedIn,
    getFullCalendarInstance,
    getIsGoogleAuthInitialized,
    setIsGoogleAuthInitialized,
    getAccessToken,
    setAccessToken,
    getTokenClient,
    setTokenClient
} from './config.js';
import { showToast } from "./toast.js";

// Update UI based on sign-in status
export function updateSignInStatus(signedIn) {
    setIsGoogleSignedIn(signedIn);
    const authBtn = document.getElementById('googleAuthBtn');
    const calendarContainer = document.getElementById('fullCalendarContainer');
    const notConnectedMsg = document.getElementById('calendarNotConnected');
    const calendarEl = document.getElementById('fullCalendar');

    if (authBtn) {
        if (signedIn) {
            authBtn.textContent = '✅ Connecté à Google';
            authBtn.className = 'btn btn-secondary';
            authBtn.onclick = handleAuthClick;
            if (calendarContainer) calendarContainer.style.display = 'block';

            // Hide "not connected" message and show calendar
            if (notConnectedMsg) notConnectedMsg.style.display = 'none';
            if (calendarEl) calendarEl.style.display = 'block';

            // Enable calendar editing
            if (getFullCalendarInstance()) {
                getFullCalendarInstance().setOption('editable', true);
                getFullCalendarInstance().setOption('selectable', true);
                getFullCalendarInstance().refetchEvents();
            }
            showToast('Connecté à Google Calendar', 'success');
        } else {
            authBtn.textContent = '🔐 Se connecter à Google';
            authBtn.className = 'btn btn-primary';
            authBtn.onclick = handleAuthClick;

            // Show "not connected" message and hide calendar
            if (calendarContainer) calendarContainer.style.display = 'block'; // Keep container visible
            if (notConnectedMsg) notConnectedMsg.style.display = 'block';
            if (calendarEl) calendarEl.style.display = 'none';

            // Disable calendar editing
            if (getFullCalendarInstance()) {
                getFullCalendarInstance().setOption('editable', false);
                getFullCalendarInstance().setOption('selectable', false);
                getFullCalendarInstance().refetchEvents();
            }
        }
    }
}

// Initialize Google Identity Services (GIS) for OAuth2
export function initGoogleAuth() {
    // Check if running from file:// protocol (not supported by Google OAuth2)
    if (window.location.protocol === 'file:') {
        const errorMsg = `
⚠️ ERREUR : OAuth2 Google nécessite un serveur HTTP

Vous ne pouvez pas utiliser OAuth2 depuis file://

✅ SOLUTION : Servez l'application via HTTP

Option 1 (Python) :
  python -m http.server 8000
  Puis : http://localhost:8000/index.html

Option 2 (Node.js) :
  npx http-server -p 8000
  Puis : http://localhost:8000/index.html

Option 3 (VS Code) :
  Extension "Live Server" → Clic droit → "Open with Live Server"
        `;
        console.error(errorMsg);
        showToast('❌ OAuth2 impossible en mode file:// - Utilisez un serveur HTTP local', 'error');

        // Display alert with instructions
        const authBtn = document.getElementById('googleAuthBtn');
        if (authBtn) {
            authBtn.textContent = '⚠️ Serveur HTTP requis';
            authBtn.disabled = true;
            authBtn.style.cursor = 'not-allowed';
            authBtn.onclick = () => {
                alert(errorMsg);
            };
        }

        return Promise.reject(new Error('OAuth2 requires HTTP/HTTPS protocol'));
    }

    return new Promise((resolve, reject) => {
        // Initialize gapi client for Calendar API
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    apiKey: CONFIG.GOOGLE_API_KEY || '',
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
                });

                // Initialize Google Identity Services token client
                setTokenClient(google.accounts.oauth2.initTokenClient({
                    client_id: CONFIG.GOOGLE_CLIENT_ID,
                    scope: CONFIG.GOOGLE_SCOPES,
                    callback: (response) => {
                        if (response.error !== undefined) {
                            console.error('❌ Token error:', response);
                            updateSignInStatus(false);
                            reject(response);
                            return;
                        }

                        // Token received successfully
                        setAccessToken(response.access_token);
                        gapi.client.setToken({ access_token: getAccessToken() });
                        setIsGoogleSignedIn(true);
                        updateSignInStatus(true);
                        console.log('✅ Google Auth token received');
                        resolve(response);
                    }
                }));

                setIsGoogleAuthInitialized(true);
                console.log('✅ Google Identity Services initialized');
                resolve(getTokenClient());
            } catch (error) {
                console.error('❌ Error initializing Google Auth:', error);
                reject(error);
            }
        });
    });
}

// Handle sign-in/sign-out button
export function handleAuthClick() {
    if (!getIsGoogleAuthInitialized()) {
        showToast('Google Auth non initialisé', 'error');
        return;
    }

    if (getIsGoogleSignedIn()) {
        // Sign out - revoke token
        google.accounts.oauth2.revoke(getAccessToken(), () => {
            setAccessToken(null);
            gapi.client.setToken(null);
            setIsGoogleSignedIn(false);
            updateSignInStatus(false);
            console.log('✅ Signed out');
        });
    } else {
        // Sign in - request token
        if (getTokenClient()) {
            getTokenClient().requestAccessToken({ prompt: 'consent' });
        }
    }
}