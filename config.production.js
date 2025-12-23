// Configuration de production MTI CONSULTING
// Ce fichier EST committé sur GitHub et utilisé par GitHub Pages
// Pour le développement local, créez config.js (gitignored) qui remplace ces valeurs

// Ne déclarer CONFIG que s'il n'existe pas déjà (config.js peut l'avoir défini)
if (typeof window.CONFIG === 'undefined') {
    window.CONFIG = {
        GOOGLE_CLIENT_ID: '419421611576-v36rss6abjs0ahrv3vt9u6tcl4hhtos9.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: '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',
        BACKEND_URL: 'https://script.google.com/macros/s/AKfycbwE4GfTi5MQaYdvcwgFg3UUW6l-VEyzbPFYXjhkFGW1ZowsAlrLANMnhp8K-zIQ622D/exec',
        SHEETS_ID: '17YPRArzfDaxQ5m1LKQLSzKOqeuCxfgLisKeQMthESi4',
        CALENDAR_ID: '',  // Optionnel, sinon calendrier par défaut
        DRIVE_FOLDER: 'MTI_CONSULTING_DATA',
        // Flag debug UI (ne pas activer en production)
        DEBUG_UI_BADGES: false
    };
}
