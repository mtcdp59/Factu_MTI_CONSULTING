// testPisteConnection.node.js
// Teste la connexion à l'API PISTE (OAuth2, annuaire, structure MTI) en Node.js
// Usage : node testPisteConnection.node.js

const https = require('https');
const querystring = require('querystring');

const CLIENT_ID = '34b37cc5-2c5d-4272-b411-0940742714ec';
const CLIENT_SECRET = '3af5bad7-5c77-4908-8dbb-ae67e6e82dc2';
const OAUTH_URL = 'https://api.piste.gouv.fr/oauth/token';
const API_BASE = 'https://api.piste.gouv.fr';

function postOAuthToken() {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'openid'
    });
    const req = https.request(
      OAUTH_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error('Réponse brute OAuth:', data);
            reject(`Erreur OAuth (${res.statusCode}): ${data}`);
          } else {
            resolve(JSON.parse(data));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getAPI(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      API_BASE + path,
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token
        }
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(`Erreur API (${res.statusCode}): ${data}`);
          } else {
            resolve(data);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    console.log('🔍 Test connexion PISTE API (PRODUCTION)...');
    // 1. Authentification OAuth2
    console.log('\n📡 Étape 1: Authentification OAuth2...');
    const tokenData = await postOAuthToken();
    const token = tokenData.access_token;
    console.log('✅ Token OAuth2 obtenu:', token.substring(0, 30) + '...');
    console.log('Expires in:', tokenData.expires_in, 'secondes');

    // 2. Test annuaire Chorus Pro (rechercher un SIRET)
    console.log('\n📡 Étape 2: Test annuaire Chorus Pro...');
    const siretTest = '13002526500013';
    const annuaireData = await getAPI(`/cpro/v1/annuaire/rechercher?siret=${siretTest}`, token);
    const annuaireJson = JSON.parse(annuaireData);
    console.log('✅ Annuaire Chorus Pro accessible. Résultats trouvés:', annuaireJson.length || 0);
    if (annuaireJson.length > 0) {
      console.log('Premier résultat:', JSON.stringify(annuaireJson[0], null, 2));
    }

    // 3. Vérifier compte émetteur MTI CONSULTING
    console.log('\n📡 Étape 3: Vérification compte MTI CONSULTING...');
    const siretMTI = '99414990400017';
    const compteData = await getAPI(`/cpro/v1/structures/siret/${siretMTI}`, token);
    console.log('✅ Compte MTI CONSULTING trouvé. Détails:', compteData);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Test PISTE terminé avec succès');
    console.log('Raccordement Chorus Pro: Opérationnel');
    console.log('='.repeat(50));
  } catch (err) {
    console.error('❌ Erreur:', err);
  }
})();
