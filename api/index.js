// MTI CONSULTING - Proxy CORS pour Google Apps Script
// Ce serveur Vercel relaie les requêtes vers Google Apps Script en contournant CORS

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyUp4uaDfbrZpziEXI3SRBYm8M_cF32mU17Ji_L3qYnxaQGl-K6KZ19-33yHkCCMD92/exec';

export default async function handler(req, res) {
  // Headers CORS pour toutes les requêtes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Body déjà parsé par Vercel
    const body = req.method === 'POST' ? JSON.stringify(req.body) : undefined;

    // Construire l'URL avec query params pour GET
    let targetUrl = GOOGLE_APPS_SCRIPT_URL;
    if (req.method === 'GET' && req.query) {
      const params = new URLSearchParams(req.query);
      targetUrl += '?' + params.toString();
    }

    // Faire la requête vers Google Apps Script
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body,
    });

    const data = await response.text();
    
    // Retourner la réponse avec headers CORS
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    return res.status(response.status).send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      success: false,
      error: 'Proxy error: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
}
