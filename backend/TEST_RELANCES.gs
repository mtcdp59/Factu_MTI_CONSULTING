/**
 * TEST DIRECT DES RELANCES
 * À copier dans l'éditeur Apps Script pour tester sans CORS
 */

// Test 1 : Créer une facture de test ET LA SAUVEGARDER
function test1_creerFactureTest() {
  // Charger les données existantes
  const response = loadFromDrive();
  const data = response.data || { invoices: [], clients: [], quotes: [] };
  
  Logger.log('📦 Données actuelles: ' + data.invoices.length + ' factures, ' + data.clients.length + ' clients');
  
  const testInvoice = {
    number: 'FAC-202512-001',
    client: 'ELAP',
    clientEmail: 'mickael.tourdot@elap.io',
    total: 4500,
    dueDate: '2025-12-19', // 10 jours en retard
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
  
  // Supprimer l'ancienne facture si elle existe
  data.invoices = data.invoices.filter(inv => inv.number !== 'FAC-202512-001');
  data.clients = data.clients.filter(c => c.name !== 'ELAP');
  
  // Ajouter la facture et le client de test
  data.invoices.push(testInvoice);
  data.clients.push(testClient);
  
  Logger.log('💾 Sauvegarde: ' + data.invoices.length + ' factures, ' + data.clients.length + ' clients');
  
  // SAUVEGARDER dans Drive
  const saveResult = saveToDrive(data);
  Logger.log('💾 Résultat sauvegarde: ' + JSON.stringify(saveResult));
  
  Logger.log('✅ Facture de test créée ET SAUVEGARDÉE dans Drive:');
  Logger.log(JSON.stringify(testInvoice, null, 2));
  Logger.log('\n📧 Email sera envoyé à: ' + testClient.email);
  
  return testInvoice;
}

// Test 2 : Vérifier et envoyer les relances automatiques
function test2_checkRelancesAuto() {
  Logger.log('🔍 Vérification des relances automatiques...\n');
  const result = checkAndSendRelances();
  Logger.log('\n✅ Résultat:');
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// Test 3 : Envoyer une relance manuelle niveau 1
function test3_relanceManuelleNiveau1() {
  Logger.log('📤 Envoi relance manuelle niveau 1...\n');
  const result = sendRelanceManual({
    invoiceNumber: 'FAC-202512-001',
    level: 1
  });
  Logger.log('\n✅ Résultat:');
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// Test 4 : Envoyer une relance manuelle niveau 2
function test4_relanceManuelleNiveau2() {
  Logger.log('📤 Envoi relance manuelle niveau 2...\n');
  const result = sendRelanceManual({
    invoiceNumber: 'FAC-202512-001',
    level: 2
  });
  Logger.log('\n✅ Résultat:');
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// Test 5 : Envoyer une relance manuelle niveau 3
function test5_relanceManuelleNiveau3() {
  Logger.log('📤 Envoi relance manuelle niveau 3 (MISE EN DEMEURE)...\n');
  const result = sendRelanceManual({
    invoiceNumber: 'FAC-202512-001',
    level: 3
  });
  Logger.log('\n✅ Résultat:');
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// Test complet : Tous les niveaux
function test_COMPLET_TousLesNiveaux() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('🧪 TEST COMPLET DES RELANCES');
  Logger.log('═══════════════════════════════════════\n');
  
  // Étape 1
  Logger.log('📝 ÉTAPE 1 : Création facture test');
  Logger.log('─────────────────────────────────────');
  test1_creerFactureTest();
  
  // Étape 2
  Logger.log('\n\n📨 ÉTAPE 2 : Relance automatique');
  Logger.log('─────────────────────────────────────');
  test2_checkRelancesAuto();
  
  // Étape 3
  Logger.log('\n\n📤 ÉTAPE 3 : Relance manuelle niveau 1');
  Logger.log('─────────────────────────────────────');
  test3_relanceManuelleNiveau1();
  
  // Étape 4
  Logger.log('\n\n📤 ÉTAPE 4 : Relance manuelle niveau 2');
  Logger.log('─────────────────────────────────────');
  test4_relanceManuelleNiveau2();
  
  // Étape 5
  Logger.log('\n\n⚠️  ÉTAPE 5 : Relance manuelle niveau 3 (MISE EN DEMEURE)');
  Logger.log('─────────────────────────────────────');
  test5_relanceManuelleNiveau3();
  
  Logger.log('\n\n═══════════════════════════════════════');
  Logger.log('✅ TEST COMPLET TERMINÉ');
  Logger.log('═══════════════════════════════════════');
  Logger.log('📧 Vérifie ta boîte email: mickael.tourdot@elap.io');
}

// Test UNIQUEMENT niveau 2 (ferme)
function test_NIVEAU2_Seul() {
  Logger.log('⚡ TEST NIVEAU 2 SEUL\n');
  
  // Vérifier que la facture existe d'abord
  const data = loadFromDrive();
  const invoices = data.data ? data.data.invoices : [];
  Logger.log('📦 Factures trouvées: ' + invoices.length);
  if (invoices.length > 0) {
    Logger.log('📋 Première facture: ' + invoices[0].number);
    Logger.log('📋 Relances actuelles: ' + (invoices[0].relances ? invoices[0].relances.length : 0));
  }
  
  const result = sendRelanceManual({
    invoiceNumber: 'FAC-202512-001',
    level: 2
  });
  Logger.log('✅ Résultat: ' + JSON.stringify(result, null, 2));
  
  if (result && result.success) {
    Logger.log('📧 Email niveau 2 envoyé !');
  } else {
    Logger.log('❌ Échec: ' + (result ? result.message : 'Pas de résultat'));
  }
}

// Test UNIQUEMENT niveau 3 (mise en demeure)
function test_NIVEAU3_Seul() {
  Logger.log('⚡ TEST NIVEAU 3 SEUL (MISE EN DEMEURE)\n');
  
  // Vérifier que la facture existe d'abord
  const data = loadFromDrive();
  const invoices = data.data ? data.data.invoices : [];
  Logger.log('📦 Factures trouvées: ' + invoices.length);
  if (invoices.length > 0) {
    Logger.log('📋 Première facture: ' + invoices[0].number);
    Logger.log('📋 Relances actuelles: ' + (invoices[0].relances ? invoices[0].relances.length : 0));
  }
  
  const result = sendRelanceManual({
    invoiceNumber: 'FAC-202512-001',
    level: 3
  });
  Logger.log('✅ Résultat: ' + JSON.stringify(result, null, 2));
  
  if (result && result.success) {
    Logger.log('📧 Email niveau 3 (MISE EN DEMEURE) envoyé !');
  } else {
    Logger.log('❌ Échec: ' + (result ? result.message : 'Pas de résultat'));
  }
}

// Test RAPIDE : Crée facture + envoie les 3 niveaux
function test_TOUS_NIVEAUX_RAPIDE() {
  Logger.log('🚀 TEST RAPIDE - TOUS NIVEAUX\n');
  
  // 1. Créer la facture
  test1_creerFactureTest();
  
  // 2. Niveau 1
  Logger.log('\n📧 Envoi niveau 1...');
  const r1 = sendRelanceManual({ invoiceNumber: 'FAC-202512-001', level: 1 });
  const r1Data = r1.getContent ? JSON.parse(r1.getContent()) : r1;
  Logger.log('Niveau 1: ' + (r1Data.success ? '✅ OK' : '❌ ÉCHEC - ' + r1Data.message));
  
  // 3. Niveau 2
  Logger.log('\n📧 Envoi niveau 2...');
  const r2 = sendRelanceManual({ invoiceNumber: 'FAC-202512-001', level: 2 });
  const r2Data = r2.getContent ? JSON.parse(r2.getContent()) : r2;
  Logger.log('Niveau 2: ' + (r2Data.success ? '✅ OK' : '❌ ÉCHEC - ' + r2Data.message));
  
  // 4. Niveau 3
  Logger.log('\n📧 Envoi niveau 3 (MISE EN DEMEURE)...');
  const r3 = sendRelanceManual({ invoiceNumber: 'FAC-202512-001', level: 3 });
  const r3Data = r3.getContent ? JSON.parse(r3.getContent()) : r3;
  Logger.log('Niveau 3: ' + (r3Data.success ? '✅ OK' : '❌ ÉCHEC - ' + r3Data.message));
  
  Logger.log('\n✅ Test terminé ! Vérifie tes emails (3 mails attendus)');
  Logger.log('📧 mickael.tourdot@elap.io');
}
