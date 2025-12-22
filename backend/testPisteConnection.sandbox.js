// testPisteConnection.sandbox.js
// Teste la connexion à l'API PISTE SANDBOX (OAuth2, annuaire, structure MTI) avec axios
// Usage : npm install axios && node testPisteConnection.sandbox.js

const axios = require('axios');

// SANDBOX CREDENTIALS (APP_SANDBOX_contact@mticonsulting.fr)
const CLIENT_ID = '834275b4-f4c0-487c-ab71-20b946f10f15';
const CLIENT_SECRET = '2427eac9-e007-4e46-be3b-a7bda3fa2511';
const OAUTH_URL = 'https://sandbox-oauth.piste.gouv.fr/api/oauth/token';
const API_BASE = 'https://sandbox-api.piste.gouv.fr';

const qs = require('qs');
async function postOAuthToken() {
  try {
    const response = await axios.post(
      OAUTH_URL,
      qs.stringify({
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
        validateStatus: () => true
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
    console.log('🔍 Test connexion PISTE API (SANDBOX) avec axios...');
    // 1. Authentification OAuth2
    console.log('\n📡 Étape 1: Authentification OAuth2...');
    const tokenData = await postOAuthToken();
    const token = tokenData.access_token;
    console.log('✅ Token OAuth2 obtenu:', token.substring(0, 30) + '...');
    console.log('Expires in:', tokenData.expires_in, 'secondes');

    // 2. Test annuaire Chorus Pro (rechercher un SIRET)
    console.log('\n📡 Étape 2: Test annuaire Chorus Pro...');
    const siretTest = '13002526500013'; // SIRET de démonstration DGFiP pour sandbox
    try {
      const annuaireData = await getAPI(`/cpro/v1/annuaire/rechercher?siret=${siretTest}`, token);
      console.log('✅ Annuaire Chorus Pro accessible. Résultats trouvés:', annuaireData.length || 0);
      if (annuaireData.length > 0) {
        console.log('Premier résultat:', JSON.stringify(annuaireData[0], null, 2));
      }
    } catch (err) {
      console.error('❌ Erreur Annuaire Chorus Pro:', err.message);
      if (err.response && err.response.data) {
        console.error('Réponse détaillée:', JSON.stringify(err.response.data));
      }
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
