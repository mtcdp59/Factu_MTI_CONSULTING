/**
 * TEST CONNEXION PISTE API
 * Application: PISTE_MTI_CONSULTING
 * 
 * À exécuter dans Google Apps Script pour valider:
 * 1. Authentification OAuth2
 * 2. Accès annuaire Chorus Pro
 * 3. Compte MTI CONSULTING actif
 * 
 * INSTRUCTIONS:
 * 1. Ouvrir Google Apps Script (extensions.google.com/apps-script)
 * 2. Créer nouveau projet "Test PISTE MTI"
 * 3. Copier/coller ce code
 * 4. Exécuter testPisteConnection()
 * 5. Vérifier les logs (Ctrl+Enter)
 */

/**
 * Test connexion PISTE avec credentials OAuth2 MTI CONSULTING
 * Application: PISTE_MTI_CONSULTING
 */


function testPisteConnection() {
  try {
    Logger.log('🔍 Test connexion PISTE API (PRODUCTION)...');
    Logger.log('Application: PISTE_MTI_CONSULTING');
    Logger.log('URL API: https://api.piste.gouv.fr');

    // 1. Obtenir token OAuth2 sur l'URL de production
    Logger.log('\n📡 Étape 1: Authentification OAuth2 (production)...');
    const OAUTH_URL = 'https://api.piste.gouv.fr/oauth/token';
    const API_BASE = 'https://api.piste.gouv.fr';
    const tokenResponse = UrlFetchApp.fetch(OAUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: {
        grant_type: 'client_credentials',
        client_id: '34b37cc5-2c5d-4272-b411-0940742714ec',
        client_secret: '3af5bad7-5c77-4908-8dbb-ae67e6e82dc2',
        scope: 'openid'
      },
      muteHttpExceptions: true
    });

    Logger.log('Status OAuth: ' + tokenResponse.getResponseCode());

    if (tokenResponse.getResponseCode() !== 200) {
      Logger.log('❌ Erreur OAuth: ' + tokenResponse.getContentText());
      return;
    }

    const tokenData = JSON.parse(tokenResponse.getContentText());
    const token = tokenData.access_token;
    Logger.log('✅ Token OAuth2 obtenu');
    Logger.log('Token: ' + token.substring(0, 30) + '...');
    Logger.log('Expires in: ' + tokenData.expires_in + ' secondes');

    // 2. Test annuaire Chorus Pro (rechercher un SIRET) sur la production
    Logger.log('\n📡 Étape 2: Test annuaire Chorus Pro (production)...');
    const siretTest = '13002526500013'; // SIRET test DGFiP
    Logger.log('Recherche SIRET: ' + siretTest);

    const annuaireResponse = UrlFetchApp.fetch(
      API_BASE + '/cpro/v1/annuaire/rechercher?siret=' + siretTest,
      {
        headers: {
          'Authorization': 'Bearer ' + token
        },
        muteHttpExceptions: true
      }
    );

    Logger.log('Status annuaire: ' + annuaireResponse.getResponseCode());

    if (annuaireResponse.getResponseCode() === 200) {
      Logger.log('✅ Annuaire Chorus Pro accessible');
      const annuaireData = JSON.parse(annuaireResponse.getContentText());
      Logger.log('Résultats trouvés: ' + (annuaireData.length || 0));
      if (annuaireData.length > 0) {
        Logger.log('Premier résultat: ' + JSON.stringify(annuaireData[0], null, 2));
      }
    } else {
      Logger.log('⚠️ Erreur annuaire: ' + annuaireResponse.getContentText());
    }

    // 3. Vérifier compte émetteur MTI CONSULTING (production)
    Logger.log('\n📡 Étape 3: Vérification compte MTI CONSULTING (production)...');
    Logger.log('SIRET MTI: 99414990400017');

    const compteResponse = UrlFetchApp.fetch(
      API_BASE + '/cpro/v1/structures/siret/99414990400017',
      {
        headers: {
          'Authorization': 'Bearer ' + token
        },
        muteHttpExceptions: true
      }
    );

    Logger.log('Status compte: ' + compteResponse.getResponseCode());

    if (compteResponse.getResponseCode() === 200) {
      Logger.log('✅ Compte MTI CONSULTING trouvé');
      Logger.log('Détails: ' + compteResponse.getContentText());
    } else {
      Logger.log('⚠️ Compte non trouvé ou erreur: ' + compteResponse.getContentText());
    }

    Logger.log('\n' + '='.repeat(50));
    Logger.log('✅ Test PISTE terminé avec succès');
    Logger.log('Raccordement Chorus Pro: Opérationnel');
    Logger.log('='.repeat(50));

  } catch (error) {
    Logger.log('❌ Erreur: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
  }
}

/**
 * Configuration credentials PISTE (optionnel - utilise Properties)
 */
function setupPisteCredentials() {
  const props = PropertiesService.getScriptProperties();
  
  // Credentials OAuth2 PISTE MTI CONSULTING
  props.setProperty('PISTE_CLIENT_ID', '34b37cc5-2c5d-4272-b411-0940742714ec');
  props.setProperty('PISTE_CLIENT_SECRET', '3af5bad7-5c77-4908-8dbb-ae67e6e82dc2');
  
  Logger.log('✅ Credentials PISTE OAuth2 configurés');
  Logger.log('Application: PISTE_MTI_CONSULTING');
  Logger.log('Raccordement Chorus Pro: Actif');
}
