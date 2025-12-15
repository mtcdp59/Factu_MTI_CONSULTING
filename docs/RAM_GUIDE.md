# 📊 Rapports d'Activité Mensuels (RAM)

## Vue d'ensemble

Les **Rapports d'Activité Mensuels (RAM)** permettent de documenter et facturer vos activités sur base mensuelle. Ils sont particulièrement utiles pour :
- 📅 Suivre le temps passé jour par jour
- 📝 Ajouter des commentaires par journée
- 📧 Envoyer un compte-rendu mensuel au client
- 🔗 Lier le RAM à une facture spécifique

## Nouveautés v2.2.0 (Décembre 2024)

### Interface utilisateur
- **Formatage français** : Séparateur d'espace pour les milliers et virgule décimale (ex: `1 234,56 €`)
- **Dropdown client** : Liste déroulante pour sélectionner un client existant
- **Auto-remplissage** : SIRET et Adresse automatiquement complétés depuis la fiche client
- **Saisie manuelle** : Option disponible pour les nouveaux clients

### Calculateur fiscal
- **API URSSAF optimisée** : Récupération séparée des taux
  - Cotisations sociales : 12,3% (via `cotisations et contributions . cotisations`)
  - CFP : 0,2% (via `cotisations et contributions . CFP`)
- **Calculs précis** : Taux récupérés directement de l'API Mon-Entreprise
- **Évolutivité** : Mise à jour automatique si les taux légaux changent

## Fonctionnalités

### Sélection du client

Deux modes de saisie sont disponibles :

**Mode 1 : Sélection depuis la base clients**
- Liste déroulante avec tous les clients enregistrés
- Nom, SIRET et Adresse automatiquement remplis
- Champs SIRET et Adresse en lecture seule

**Mode 2 : Saisie manuelle**
- Option "Saisie manuelle" dans la liste déroulante
- Tous les champs modifiables
- Données sauvegardées avec le RAM

## 🚀 Fonctionnalités

### Création d'un RAM

1. **Accédez à l'onglet RAM**
2. **Cliquez sur "➕ Nouveau RAM"**
3. **Remplissez le formulaire** :
   - **Client** : Dropdown avec clients existants ou "Saisie manuelle"
   - **Client SIRET** : Auto-rempli si client sélectionné
   - **Client Adresse** : Auto-remplie si client sélectionné
   - **Mois** : Sélectionnez le mois
   - **Année** : Sélectionnez l'année
   - **N° Facture** (optionnel) : Liez à une facture existante

4. **Calendrier auto-généré** :
   - 📅 Tous les jours du mois affichés
   - ⏰ Heures pré-remplies (7,5h en semaine, 0h le week-end)
   - 💬 Colonne commentaires pour chaque jour
   - 🔄 Bouton "Rafraîchir" pour régénérer le calendrier

5. **Remarques** : Ajoutez des notes globales (optionnel)

6. **Enregistrement** :
   - 💾 Cliquez sur "Enregistrer le RAM"
   - Sauvegarde automatique sur Google Drive

### Gestion des RAMs

#### 📋 Liste des RAMs

La liste affiche :
- **Client** : Nom du client
- **Période** : Mois et année
- **Heures totales** : Somme calculée automatiquement
- **N° Facture** : Facture liée (si applicable)
- **Date création** : Horodatage
- **Actions** :
  - ✏️ **Modifier** : Ouvre le RAM en mode édition
  - 🗑️ **Supprimer** : Suppression avec confirmation
  - 📄 **PDF** : Télécharge le PDF du RAM
  - 📧 **Envoyer** : Envoi par email au client

#### 🔍 Recherche et filtrage

Recherchez par :
- Nom du client
- Mois/année (ex: "janvier 2025")
- Numéro de facture
- **Heures** : Tapez un nombre d'heures (ex: "160") pour filtrer

### Édition d'un RAM

1. **Cliquez sur "✏️ Modifier"** dans la liste
2. **Formulaire pré-rempli** avec les données existantes
3. **Dropdown client** :
   - Si le client existe dans la liste → Automatiquement sélectionné
   - Si le client est inconnu → Mode "Saisie manuelle" activé
4. **Modifiez** les heures et commentaires
5. **Cliquez sur "Mettre à jour le RAM"**

### PDF généré automatiquement

Le RAM est exporté en PDF avec une structure optimisée sur 2 pages :

**Page 1** :
- En-tête avec logo MTI CONSULTING
- Informations client (nom, SIRET, adresse)
- Tableau d'activité jour par jour avec heures et commentaires
- Total des heures du mois

**Page 2** (structure fixe V9) :
- **Remarques** (Y=20mm → Y=245mm)
  - Espace disponible : 225mm (~75 lignes)
  - Texte dynamique : 6-7pt selon longueur
  - Bordure avec titre "Remarques"
- **Gap sécurité** : 10mm
- **Visas** (Y=255mm fixe)
  - 2 boîtes : "Visa Prestataire" / "Visa Superviseur Client"
  - Centrage avec marges 22mm de chaque côté
  - Hauteur : 20mm (fin à 275mm)
- **Gap sécurité** : 5mm
- **Footer** (Y=280mm fixe)
  - Nom société + SIRET centré
  - Marge sécurité : 17mm du bord (compatible tous PDF viewers)

**Historique positionnement** :
- V1-V5 : Positionnement dynamique page 1 (footer coupé)
- V6 : Page 2 systématique sans remarques
- V7-V8 : Positionnement dynamique page 2 (overlap possible)
- V9 (actuel) : Positionnement fixe page 2 (aucune collision)

L'approche V9 garantit :
- Aucun chevauchement entre remarques/visas/footer
- Capacité remarques 4,7x supérieure (vs V8)
- Visibilité footer sur tous PDF viewers

### Envoi par email

#### Envoi RAM seul

1. **Cliquez sur "📧 Envoyer"** dans la liste
2. **Vérification automatique** :
   - Client doit avoir un email de facturation
   - Si manquant → Message d'erreur avec instructions
3. **PDF généré automatiquement** avec :
   - Logo et coordonnées MTI CONSULTING
   - Informations client (nom, adresse, SIRET)
   - Calendrier détaillé jour par jour
   - Total d'heures
   - Remarques éventuelles
4. **Email envoyé via Gmail** avec le PDF en pièce jointe

#### Envoi Facture + RAM ensemble

Si un RAM est lié à une facture, un bouton spécial apparaît dans la liste des factures :

- **📧+📊 Facture+RAM** : Envoie les deux documents dans le même email
- Pratique pour la facturation mensuelle avec rapport d'activité

## 📊 Structure des données

### Objet RAM

```javascript
{
  id: 1702834567890,                    // Timestamp unique
  client: "Nom du client",               // Nom du client
  clientSiret: "12345678901234",         // SIRET (nouveau)
  clientAddress: "Adresse complète",     // Adresse (nouveau)
  month: 11,                             // Index du mois (0-11)
  year: 2024,                            // Année
  monthName: "Décembre",                 // Nom du mois
  invoiceNumber: "202412-001",           // N° facture liée (optionnel)
  remarks: "Notes globales...",          // Remarques (optionnel)
  activities: [
    {
      day: "Lundi",                      // Jour de la semaine
      dayNum: 1,                         // Numéro du jour (1-31)
      date: "2024-12-01",                // Date ISO
      hours: 7.5,                        // Nombre d'heures
      comment: "Développement API"       // Commentaire
    },
    // ... un objet par jour du mois
  ],
  createdAt: "2024-12-01T10:30:00Z",     // Date de création
  updatedAt: "2024-12-14T15:45:00Z"      // Date de dernière modification
}
```

### Sauvegarde

- **Drive** : Sauvegarde automatique dans `mti_data.json`
- **Sheets** : Synchronisation manuelle via boutons (comme les factures)

## 🔧 Synchronisation Google Sheets

### Export vers Sheets

1. **Onglet RAM** → Cliquez sur "📤 Exporter vers Sheets"
2. **Création automatique** de l'onglet "RAM" si inexistant
3. **Structure de l'onglet** :

| Date Export | Client | Mois | Année | Jour | Date | Heures | Commentaires | Remarques |
|-------------|--------|------|-------|------|------|--------|--------------|-----------|
| 2024-12-14... | ACME Corp | Décembre | 2024 | Lundi | 1 | 7.5 | Dev API | Notes... |

4. **Formatage** :
   - En-tête : Fond #21808D (teal MTI), texte blanc
   - Bordures sur toutes les cellules
   - Colonnes auto-redimensionnées
   - Alignement des heures à droite

### Import depuis Sheets

1. **Modifiez les données** dans Google Sheets (onglet "RAM")
2. **Onglet RAM** → Cliquez sur "📥 Importer depuis Sheets"
3. **Regroupement automatique** :
   - Les lignes sont regroupées par Client/Mois/Année
   - Reconstruction des objets RAM complets
4. **Fusion avec données locales** :
   - Les RAMs importés écrasent ceux avec même Client/Mois/Année
   - Les RAMs locaux non présents dans Sheets sont conservés

## 💡 Cas d'usage

### Facturation mensuelle au forfait

1. Créez un RAM en début de mois
2. Remplissez jour par jour vos heures et commentaires
3. En fin de mois :
   - Créez la facture correspondante
   - Liez le RAM à la facture (sélectionnez le N° dans le dropdown)
   - Envoyez Facture + RAM ensemble

### Suivi multi-clients

1. Créez un RAM par client et par mois
2. Exportez vers Sheets pour analyse globale
3. Utilisez les filtres Sheets pour :
   - Comparer les heures entre clients
   - Analyser les commentaires
   - Repérer les périodes de forte activité

### Archivage et reporting

1. Export mensuel vers Sheets
2. Utilisez les fonctions Sheets (SOMME, MOYENNE, etc.)
3. Créez des graphiques d'activité
4. Partagez l'onglet Sheets avec vos partenaires/comptable

## ⚠️ Points importants

### Validation des données

- **Client requis** : Le nom du client est obligatoire
- **Unicité** : Un seul RAM par Client/Mois/Année
  - Si vous créez un doublon → Message d'erreur
  - Utilisez "Modifier" pour mettre à jour un RAM existant

### Heures négatives ou vides

- Vous pouvez laisser des jours à 0 heures (jours de congé, week-end, etc.)
- Les jours à 0h ne sont **pas exportés** vers Sheets (évite les lignes inutiles)
- Total calculé automatiquement

### Email du client

Pour envoyer un RAM par email :
1. Le client doit exister dans l'onglet TIERS
2. Le client doit avoir un **Email Facturation** renseigné
3. Si manquant :
   - Message d'erreur avec lien vers l'onglet TIERS
   - Modifiez le client pour ajouter l'email

### Suppression

⚠️ **La suppression est définitive** :
- Confirmation demandée avant suppression
- Aucune corbeille/restauration disponible
- Pensez à exporter vers Sheets pour archivage

## 🎯 Bonnes pratiques

### Nomenclature des factures liées

Pour faciliter le suivi :
- Créez d'abord la facture (ex: `202412-001`)
- Puis créez le RAM et liez-le à cette facture
- Le N° apparaîtra dans la liste des RAMs

### Commentaires utiles

Exemples de commentaires efficaces :
- "Développement API REST + Documentation"
- "Réunion client (2h) + Corrections (5,5h)"
- "Formation équipe"
- ❌ "Travail" (trop vague)

### Mise à jour régulière

- Remplissez votre RAM **au fil de l'eau** (quotidien/hebdomadaire)
- Évitez de remplir 1 mois entier d'un coup → risque d'oubli
- Utilisez le bouton "🔄 Rafraîchir le calendrier" si vous changez de mois

## 🔗 Liens utiles

- [Google Sheets MTI](https://docs.google.com/spreadsheets/d/1Zu6I-c64YrBdlfvWhiVnlbwbvhv6Mw5NL8iRn2mvXoE)
- [Documentation Synchronisation Devis](./SYNCHRONISATION_DEVIS_SHEETS.md)
- [Guide Déploiement Backend](../DEPLOY_BACKEND.md)

## 🐛 Dépannage

### Le bouton "Envoyer" est grisé

→ Le client n'a pas d'email de facturation  
→ Solution : Onglet TIERS → Modifier le client → Ajouter "Email Facturation"

### Erreur "Un RAM existe déjà pour ce client"

→ Vous essayez de créer un doublon  
→ Solution : Recherchez le RAM existant et utilisez "Modifier"

### Les heures ne s'enregistrent pas

→ Vérifiez que vous avez cliqué sur "💾 Enregistrer le RAM"  
→ Attendez le message de confirmation

### L'import Sheets ne fonctionne pas

→ Vérifiez que l'onglet "RAM" existe dans Sheets  
→ Vérifiez que les en-têtes correspondent exactement  
→ Vérifiez le backend déployé (voir DEPLOY_BACKEND.md)

---

**Dernière mise à jour** : 16 décembre 2024  
**Version** : 2.2.2 (Positionnement fixe PDF V9)
