// testPisteConnection.axios.js
// Teste la connexion à l'API PISTE (OAuth2, annuaire, structure MTI) avec axios
// Usage : npm install axios && node testPisteConnection.axios.js

const axios = require('axios');

const CLIENT_ID = '34b37cc5-2c5d-4272-b411-0940742714ec';
const CLIENT_SECRET = '3af5bad7-5c77-4908-8dbb-ae67e6e82dc2';
const OAUTH_URL = 'https://api.piste.gouv.fr/oauth/token';
const API_BASE = 'https://api.piste.gouv.fr';

async function postOAuthToken() {
  try {
    const response = await axios.post(
      OAUTH_URL,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: 'openid'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'Node.js/axios',
        },
        validateStatus: () => true // Pour gérer les erreurs HTTP manuellement
      }
    );
    if (response.status !== 200) {
      console.error('Réponse brute OAuth:', response.data);
      throw new Error(`Erreur OAuth (${response.status}): ${JSON.stringify(response.data)}`);
    }
    return response.data;
  } catch (err) {
    throw err;
  }
}

async function getAPI(path, token) {
  const response = await axios.get(API_BASE + path, {
    headers: {
      Authorization: 'Bearer ' + token,
      'Accept': 'application/json',
      'User-Agent': 'Node.js/axios',
    },
    validateStatus: () => true
  });
  if (response.status !== 200) {
    throw new Error(`Erreur API (${response.status}): ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

(async () => {
  try {
    console.log('🔍 Test connexion PISTE API (PRODUCTION) avec axios...');
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
    console.log('✅ Annuaire Chorus Pro accessible. Résultats trouvés:', annuaireData.length || 0);
    if (annuaireData.length > 0) {
      console.log('Premier résultat:', JSON.stringify(annuaireData[0], null, 2));
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
    console.error('❌ Erreur:', err.message);
  }
})();
