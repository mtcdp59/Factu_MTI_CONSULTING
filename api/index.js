// MTI CONSULTING - Proxy CORS pour Google Apps Script
// Ce serveur Node.js relaie les requêtes vers Google Apps Script en contournant CORS

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyUp4uaDfbrZpziEXI3SRBYm8M_cF32mU17Ji_L3qYnxaQGl-K6KZ19-33yHkCCMD92/exec';

module.exports = async (req, res) => {
  // Headers CORS pour toutes les requêtes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let body = '';
    
    // Lire le body pour POST
    if (req.method === 'POST') {
      for await (const chunk of req) {
        body += chunk;
      }
    }

    // Construire l'URL avec query params pour GET
    let targetUrl = GOOGLE_APPS_SCRIPT_URL;
    if (req.method === 'GET' && req.url && req.url.includes('?')) {
      const queryString = req.url.split('?')[1];
      targetUrl += '?' + queryString;
    }

    // Faire la requête vers Google Apps Script
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method === 'POST' ? body : undefined,
    });

    const data = await response.text();
    
    // Retourner la réponse avec headers CORS
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      success: false,
      error: 'Proxy error: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
};
