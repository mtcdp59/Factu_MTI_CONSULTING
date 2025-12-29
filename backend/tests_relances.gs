/**
 * TEST DIRECT DES RELANCES
 * À copier dans l'éditeur Apps Script pour tester sans CORS
 */

// Test 1 : Créer une facture de test ET LA SAUVEGARDER
function test1_creerFactureTest() {
  const response = loadFromDrive();
  const dataContent = response.getContent ? JSON.parse(response.getContent()) : response;
  const data = (dataContent && dataContent.success && dataContent.data) ? dataContent.data : { invoices: [], clients: [], quotes: [] };

  Logger.log('📦 Données actuelles: ' + data.invoices.length + ' factures, ' + data.clients.length + ' clients');

  const testInvoice = {
    number: 'FAC-202512-001',
    client: 'ELAP',
    clientEmail: 'mickael.tourdot@elap.io',
    total: 4500,
    dueDate: '2025-12-19',
    status: 'En attente de paiement',
    noAutoRelance: false,
    relances: []
  };

  const testClient = {
    name: 'ELAP',
    email: 'mickael.tourdot@elap.io',
    address: '123 Rue Test',
    noAutoRelance: false
  };

  data.invoices = data.invoices.filter(function(inv){ return inv.number !== 'FAC-202512-001'; });
  data.clients = data.clients.filter(function(c){ return c.name !== 'ELAP'; });

  data.invoices.push(testInvoice);
  data.clients.push(testClient);

  Logger.log('💾 Sauvegarde: ' + data.invoices.length + ' factures, ' + data.clients.length + ' clients');

  const saveResult = saveToDrive(data);
  Logger.log('💾 Résultat sauvegarde: ' + (saveResult && saveResult.getContent ? saveResult.getContent() : JSON.stringify(saveResult)));

  Logger.log('✅ Facture de test créée ET SAUVEGARDÉE dans Drive');
  Logger.log(JSON.stringify(testInvoice, null, 2));
  Logger.log('\n📧 Email sera envoyé à: ' + testClient.email);

  return testInvoice;
}

// Test 2 : Vérifier et envoyer les relances automatiques
function test2_checkRelancesAuto() {
  Logger.log('🔍 Vérification des relances automatiques...');
  const result = checkAndSendRelances();
  Logger.log('✅ Résultat: ' + (result && result.getContent ? result.getContent() : JSON.stringify(result)));
  return result;
}

// Test 3 : Envoyer une relance manuelle niveau 1
function test3_relanceManuelleNiveau1() {
  Logger.log('📤 Envoi relance manuelle niveau 1...');
  const result = sendRelanceManual({ invoiceNumber: 'FAC-202512-001', level: 1 });
  Logger.log('✅ Résultat: ' + (result && result.getContent ? result.getContent() : JSON.stringify(result)));
  return result;
}

// Test 4 : Envoyer une relance manuelle niveau 2
function test4_relanceManuelleNiveau2() {
  Logger.log('📤 Envoi relance manuelle niveau 2...');
  const result = sendRelanceManual({ invoiceNumber: 'FAC-202512-001', level: 2 });
  Logger.log('✅ Résultat: ' + (result && result.getContent ? result.getContent() : JSON.stringify(result)));
  return result;
}

// Test 5 : Envoyer une relance manuelle niveau 3
function test5_relanceManuelleNiveau3() {
  Logger.log('📤 Envoi relance manuelle niveau 3 (MISE EN DEMEURE)...');
  const result = sendRelanceManual({ invoiceNumber: 'FAC-202512-001', level: 3 });
  Logger.log('✅ Résultat: ' + (result && result.getContent ? result.getContent() : JSON.stringify(result)));
  return result;
}

// Test complet : Tous les niveaux
function test_COMPLET_TousLesNiveaux() {
  Logger.log('🧪 TEST COMPLET DES RELANCES');

  test1_creerFactureTest();
  test2_checkRelancesAuto();
  test3_relanceManuelleNiveau1();
  test4_relanceManuelleNiveau2();
  test5_relanceManuelleNiveau3();

  Logger.log('✅ TEST COMPLET TERMINÉ');
}

function test_NIVEAU2_Seul() {
  Logger.log('⚡ TEST NIVEAU 2 SEUL');
  const result = sendRelanceManual({ invoiceNumber: 'FAC-202512-001', level: 2 });
  Logger.log('✅ Résultat: ' + (result && result.getContent ? result.getContent() : JSON.stringify(result)));
  return result;
}

function test_NIVEAU3_Seul() {
  Logger.log('⚡ TEST NIVEAU 3 SEUL (MISE EN DEMEURE)');
  const result = sendRelanceManual({ invoiceNumber: 'FAC-202512-001', level: 3 });
  Logger.log('✅ Résultat: ' + (result && result.getContent ? result.getContent() : JSON.stringify(result)));
  return result;
}

function test_TOUS_NIVEAUX_RAPIDE() {
  Logger.log('🚀 TEST RAPIDE - TOUS NIVEAUX');
  test1_creerFactureTest();
  var r1 = sendRelanceManual({ invoiceNumber: 'FAC-202512-001', level: 1 });
  Logger.log('Niveau 1: ' + (r1 && r1.getContent ? r1.getContent() : JSON.stringify(r1)));
  var r2 = sendRelanceManual({ invoiceNumber: 'FAC-202512-001', level: 2 });
  Logger.log('Niveau 2: ' + (r2 && r2.getContent ? r2.getContent() : JSON.stringify(r2)));
  var r3 = sendRelanceManual({ invoiceNumber: 'FAC-202512-001', level: 3 });
  Logger.log('Niveau 3: ' + (r3 && r3.getContent ? r3.getContent() : JSON.stringify(r3)));
}
