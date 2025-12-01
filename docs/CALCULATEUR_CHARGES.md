# 🧮 Calculateur de Charges et Impôts - Documentation Technique

## Vue d'ensemble

Le calculateur de charges et impôts est un simulateur complet intégré à l'onglet **Calculs** de l'application. Il permet aux auto-entrepreneurs en BNC (Bénéfices Non Commerciaux) de calculer précisément leurs charges sociales et fiscales selon les **taux officiels 2025**.

## Sources Légales Vérifiées

Tous les taux utilisés sont conformes aux textes officiels :

| Paramètre | Valeur | Source légale | Date |
|-----------|--------|---------------|------|
| **URSSAF ACRE** | 11,6% | Exonération 50% | 2025 |
| **URSSAF Standard** | 24,6% | Décret n°2024-484 | 30/05/2024 |
| **CFP BNC** | 0,2% | Code du travail L6331-48 | - |
| **Versement Libératoire** | 2,2% | Taux fixe BNC | 2025 |
| **RFR max VL 2026** | 28,797€ | Seuil officiel par part | 2026 |
| **CA max BNC** | 77,700€ | Plafond micro-entreprise | 2025 |
| **IRPP Barème** | 0/11/30/41/45% | service-public.gouv.fr | 2025 |
| **Abattement BNC** | 34% | Forfaitaire micro-BNC | 2025 |
| **Période ACRE** | Fin Q3 suivant | Art. L.131-6-4 CSS | - |
| **Évolution URSSAF** | +1%/an → 28,6% | Décret 2024-484 | 2029 |

## Intégration API Open Data Soft (CFE)

### Endpoint API
```
https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-entreprises/records
```

### Paramètres de requête
- `limit=1` : 1 résultat par commune
- `refine=exercice:"2024"` : Année fiscale 2024
- `refine=insee_com:"75056"` : Code INSEE commune (ex: Paris)

### Données récupérées
- `taux_global_cfe_hz` : Taux CFE hors zones (%) - **utilisé pour le calcul**
- `libcom` : Nom de la commune
- `insee_com` : Code INSEE
- `exercice` : Année fiscale

### Conversion Taux → Montant
```javascript
// API retourne: taux_global_cfe_hz = 25.42 (%)
// Base minimale estimée: 1,200€ (moyenne)
// CFE estimée = (25.42 / 100) * 1,200 = 305€/an
```

### Cache & Performance
- **Clé localStorage** : `mti_cfe_api_cache`
- **TTL** : 30 jours (2,592,000,000 ms)
- **Structure** :
```json
{
  "paris": {
    "taux": 305,
    "inseeCode": "75056",
    "timestamp": 1733011200000
  }
}
```

### Fallback Automatique
Si l'API échoue ou la commune n'est pas référencée :
- Utilisation base hardcodée (14 villes)
- Affichage source : "⚠️ Estimation (erreur API)"
- Valeur par défaut : 600€/an

### Indicateurs Source
- 📊 **API DGFiP 2024** : Données officielles (taux réel)
- 💾 **API (cache)** : Données en cache (< 30j)
- ⚠️ **Estimation** : Fallback hardcodé (API indisponible)

## Fonctionnalités

### 1. Paramètres de Simulation

#### 📅 Situation ACRE
- **Radio buttons** : "Avec ACRE" (11,6%) / "Sans ACRE" (24,6%)
- **Date de début d'activité** : Input date pour calcul automatique période ACRE
- **Calcul automatique** : Fin de période = fin du 3ème trimestre civil suivant le début
- **Affichage dynamique** :
  - ✅ Badge vert si ACRE active (avec durée restante en mois/jours)
  - ⚠️ Badge orange si ACRE expirée
- **Bascule automatique** : Le radio button se met à jour selon la période

**Exemple de calcul ACRE :**
```javascript
// Début d'activité : 15 janvier 2025 (Q1 2025)
// Trimestre début : Q1
// Fin ACRE : Q1 + 3 trimestres = fin Q4 2025 (31 décembre 2025)
// Durée totale : 4 trimestres (≈ 12 mois)
```

#### 🏙️ Commune (CFE personnalisée)
- **Input texte** : Saisie libre du nom de la commune (autocomplétion 14 villes)
- **Source officielle** : API Open Data Soft DGFiP (data.economie.gouv.fr)
- **Données 2024** : Taux CFE réels par commune (code INSEE)
- **Cache localStorage** : 30 jours de persistance
- **Fallback automatique** : Base de données hardcodée si API indisponible

**⚠️ Note importante CFE** :
L'API fournit le **taux CFE** (%), pas la base minimale (€). Le calcul utilise une **base minimale estimée à 1,200€** (moyenne entreprises).

**Formule** : `CFE estimée = Taux CFE (%) × Base minimale estimée (1,200€)`

**Base minimale réelle 2024** : Entre 237€ et 7,349€ selon CA (non communiquée par l'API)

**Communes référencées (codes INSEE)** :
  - Paris (75056) : Taux officiel DGFiP 2024
  - Lyon (69123) : Taux officiel DGFiP 2024
  - Marseille (13055) : Taux officiel DGFiP 2024
  - Toulouse : 900€/an
  - Nice : 1,100€/an
  - Nantes : 800€/an
  - Montpellier : 750€/an
  - Strasbourg : 850€/an
  - Bordeaux : 950€/an
  - Lille : 700€/an
  - Rennes : 650€/an
  - Reims : 600€/an
  - **Défaut** : 600€/an
- **Affichage** : Estimation mensuelle et annuelle
- **Mise à jour automatique** : Recalcul instantané des charges

#### 💰 Revenu Fiscal de Référence (RFR)
- **Input numérique** : Saisie du RFR par part
- **Vérification automatique** : Comparaison avec seuil VL (28,797€ en 2026)
- **Badge d'éligibilité** :
  - ✅ Vert : Éligible au Versement Libératoire
  - ❌ Rouge : Non éligible (IRPP obligatoire)
- **Message détaillé** : RFR saisi vs seuil

#### 💰 Régime fiscal
- **Radio buttons** : "IRPP Progressif" (barème) / "Versement Libératoire" (2,2%)
- **Avertissement** : Rappel des conditions d'éligibilité VL
- **Impact** : Tous les tableaux et graphiques s'adaptent au choix

#### 📊 Affichage
- **Radio buttons** : "Mensuel" / "Annuel" (×12)
- **Impact** : Tous les montants affichés sont multipliés par 1 ou 12
- **Label dynamique** : "(Mensuelles)" ou "(Annuelles)" dans les titres

### 2. Tableau Détaillé des Charges

Format 4 colonnes : **Poste | Taux | Base | Montant**

**Lignes :**
1. **Charges sociales URSSAF** : Taux ACRE ou Standard appliqué au CA
2. **CFP (Formation professionnelle)** : 0,2% du CA
3. **Impôt sur le revenu** : VL (2,2% du CA) ou IRPP (barème sur revenu imposable)
4. **CFE** : Montant mensuel ou annuel selon commune

**Footer :**
- **TOTAL CHARGES** : Somme des 4 lignes (badge orange)
- **REVENU NET** : CA - Total charges (fond bleu primaire)

**Adaptation dynamique :**
- Le régime fiscal sélectionné (IRPP/VL) détermine la ligne d'impôt affichée
- Le multiplicateur mensuel/annuel s'applique à tous les montants
- Le taux ACRE/Standard s'adapte selon la situation

### 3. Graphique Distribution des Charges

**Type** : Histogramme empilé (Canvas 2D)

**Colonnes** :
- **IRPP** : Scénario IRPP Progressif
- **VL** : Scénario Versement Libératoire

**Segments empilés (de bas en haut)** :
1. URSSAF (bleu foncé #003366)
2. CFP (bleu moyen #0066cc)
3. Impôt (bleu clair #3399ff)
4. CFE (bleu très clair #66b3ff)
5. Revenu Net (vert #00cc66)

**Légende** : 5 badges de couleur sous le graphique

**Échelle** : Axe Y dynamique adapté au CA

### 4. Comparaison VL vs IRPP

**Affichage côte à côte** : 2 colonnes en grid

**Colonne Versement Libératoire :**
- CA (mensuel ou annuel)
- URSSAF
- CFP
- Impôt VL (2,2%)
- CFE
- **Total charges** (badge orange)
- **Revenu net** (gras, bleu primaire)

**Colonne IRPP Progressif :**
- Même structure avec impôt IRPP calculé sur barème

**Recommandation automatique** :
- Badge vert/bleu selon le meilleur choix
- Message : "💼 Recommandation : [Meilleur régime] (gain de XXX € par mois/an)"
- Comparaison du revenu net des deux scénarios

### 5. Projection 2025-2029

**Tableau 8 colonnes :**
- Année
- Taux URSSAF (évolution +1%/an)
- URSSAF
- CFP
- Impôt (VL ou IRPP selon sélection)
- CFE
- Total Charges
- Revenu Net

**Années affichées** : 2025, 2026, 2027, 2028, 2029

**Évolution URSSAF** :
- 2025 : 24,6%
- 2026 : 25,6%
- 2027 : 26,6%
- 2028 : 27,6%
- 2029 : 28,6%

**Note** : "Projection basée sur un CA constant. Seul le taux URSSAF augmente."

### 6. Export PDF

**Bouton dédié** : "📄 Exporter la simulation en PDF"

**Contenu du PDF** :
- **Page 1** :
  - Titre : "Simulation Charges Auto-Entrepreneur BNC"
  - Date de génération
  - Paramètres de simulation (CA, ACRE, CFE, régime fiscal)
  - Tableau de détail des charges
  - Sources légales (Décret 2024-484, Code du travail L6331-48)

**Nom du fichier** : `Simulation_AE_YYYY-MM-DD.pdf`

**Librairie** : jsPDF (chargée depuis CDN)

### 7. Sauvegarde et Chargement

**Boutons d'action** :
- **💾 Enregistrer simulation** : Sauvegarde tous les paramètres
- **🔄 Réinitialiser simulation** : Remet à zéro + supprime la sauvegarde

**Paramètres sauvegardés** (localStorage : `mti_simulation_params`) :
- Chiffre d'affaires
- Situation ACRE (Avec/Sans)
- Date de début d'activité
- Commune (CFE)
- RFR (éligibilité VL)
- Régime fiscal (IRPP/VL)
- Période d'affichage (Mensuel/Annuel)

**Chargement automatique** : Au démarrage de l'application (`initApp()`), les paramètres sont restaurés et la simulation recalculée.

**Confirmation visuelle** : Badge vert pendant 3 secondes après sauvegarde.

## Formules de Calcul

### Charges Sociales URSSAF

```javascript
const tauxURSSAF = acreActive ? 0.116 : 0.246; // 11,6% ou 24,6%
const chargesURSSAF = CA × tauxURSSAF;
```

### CFP (Contribution Formation Professionnelle)

```javascript
const CFP = CA × 0.002; // 0,2% du CA
```

### Versement Libératoire

```javascript
const impotVL = CA × 0.022; // 2,2% du CA
```

### IRPP Progressif

```javascript
// 1. Calcul revenu imposable (abattement BNC 34%)
const caAnnuel = caMensuel × 12;
const revenuImposable = caAnnuel × (1 - 0.34); // Abattement 34%

// 2. Application du barème progressif par tranches
let impot = 0;
let resteImposable = revenuImposable;

for (const tranche of bareme) {
  const plafond = tranche.max - tranche.min;
  const montantTranche = Math.min(resteImposable, plafond);
  impot += montantTranche × (tranche.taux / 100);
  resteImposable -= montantTranche;
  if (resteImposable <= 0) break;
}

// 3. Ramené au mensuel
const impotMensuel = impot / 12;
```

### CFE

```javascript
const cfeMensuel = cfeAnnuel / 12;
```

### Total Charges et Revenu Net

```javascript
const totalCharges = chargesURSSAF + CFP + impot + cfeMensuel;
const revenuNet = CA - totalCharges;
```

## Architecture Code

### Fichiers concernés

- **`index.html`** (lignes 1430-1650) : Interface utilisateur (inputs, tableaux, canvas)
- **`app.js`** (lignes 3690-4100) : Logique de calcul et mise à jour dynamique

### Fonctions principales

#### `calculateTaxes()`
Fonction centrale qui :
1. Récupère tous les paramètres (CA, ACRE, régime, période)
2. Calcule les deux scénarios (VL et IRPP)
3. Remplit le tableau de détail selon le régime sélectionné
4. Appelle les fonctions de mise à jour (comparaison, projection, graphique)

#### `calculateACREPeriod()`
Calcule automatiquement la fin de période ACRE :
- Détermine le trimestre de début (1 à 4)
- Ajoute 3 trimestres
- Gère le passage d'année si nécessaire
- Affiche la durée restante
- Bascule automatiquement le radio button

#### `updateCFEEstimation()`
Recherche la commune dans la base de données et affiche l'estimation CFE.

#### `verifierEligibiliteVL()`
Compare le RFR saisi avec le seuil (28,797€) et affiche le badge d'éligibilité.

#### `updateComparaisonVL_IRPP(ca, multiplicateur, scenarios)`
Génère l'affichage côte à côte des deux scénarios avec recommandation.

#### `updateProjection3_5Ans(ca, multiplicateur, scenarios)`
Génère le tableau de projection 2025-2029 avec évolution URSSAF.

#### `renderChargesDistributionChart(scenarios, multiplicateur)`
Dessine l'histogramme empilé sur le canvas.

#### `saveSimulationParams()` / `loadSimulationParams()` / `resetSimulationParams()`
Gestion de la persistance des paramètres dans localStorage.

#### `exportSimulateurPDF()`
Génère le PDF avec jsPDF et déclenche le téléchargement.

### Event Listeners

Tous les contrôles déclenchent `calculateTaxes()` en temps réel :
- Input CA : `input` event
- Radio ACRE : `change` event
- Date début activité : `change` event → `calculateACREPeriod()` → `calculateTaxes()`
- Input commune : `input` event → `updateCFEEstimation()` → `calculateTaxes()`
- Input RFR : `input` event → `verifierEligibiliteVL()`
- Radio régime fiscal : `change` event
- Radio période affichage : `change` event

## Configuration Paramètres

Tous les taux sont modifiables dans **Paramètres → Calculs Fiscaux et Sociaux** :

### Cotisations sociales URSSAF (BNC)
- Taux avec ACRE Année 1 : `11.6` (%)
- Taux standard 2025 : `24.6` (%)

### CFP (Formation Pro)
- Taux CFP BNC : `0.2` (%)

### Conditions d'éligibilité VL
- RFR maximum par part : `28797` (€)
- CA maximum BNC : `77700` (€)

### Autres
- Versement libératoire BNC : `2.2` (%)
- CFE annuel : `600` (€) - modifiable par commune
- Barème IRPP : Éditable tranche par tranche

**Bouton "Réinitialiser tout"** : Restaure les valeurs par défaut (taux officiels 2025).

## Tests de Cohérence

### Exemple 1 : CA 3,000€/mois, ACRE active, IRPP

**Paramètres :**
- CA mensuel : 3,000€
- ACRE : Avec (11,6%)
- Régime : IRPP Progressif
- CFE : 600€/an (Paris : 2,433€)
- RFR : 20,000€ (éligible VL)

**Résultats attendus :**
- URSSAF : 3,000 × 0.116 = 348€
- CFP : 3,000 × 0.002 = 6€
- IRPP : (3,000 × 12 × 0.66) / 12 = 1,980€ (base imposable) → ~180€/mois
- CFE : 2,433 / 12 = 202.75€
- **Total charges** : ~736.75€
- **Revenu net** : ~2,263.25€

### Exemple 2 : Même CA, Sans ACRE, VL

**Paramètres :**
- CA mensuel : 3,000€
- ACRE : Sans (24,6%)
- Régime : Versement Libératoire
- CFE : 600€/an
- RFR : 20,000€ (éligible VL)

**Résultats attendus :**
- URSSAF : 3,000 × 0.246 = 738€
- CFP : 3,000 × 0.002 = 6€
- VL : 3,000 × 0.022 = 66€
- CFE : 600 / 12 = 50€
- **Total charges** : 860€
- **Revenu net** : 2,140€

**Comparaison** : IRPP plus avantageux avec ACRE (gain ~123€/mois).

### Exemple 3 : Période ACRE

**Date de début** : 15 mars 2025 (Q1 2025)

**Calcul :**
- Trimestre début : Q1 (janvier-mars)
- Fin ACRE : Fin Q4 2025 (31 décembre 2025)
- Durée : 4 trimestres (≈ 9 mois et demi restants au 01/12/2025)

**Badge affiché** :
✅ Période ACRE active
Début : 15/03/2025 (T1 2025)
Fin : 31/12/2025 (fin T4 2025)
**Durée restante : 0 mois (30 jours)**

## Évolutions Futures Possibles

- [ ] API CFE réelle (données communes exhaustives)
- [ ] Alerte push "ACRE expire dans X jours"
- [ ] Historique simulations (comparaison temporelle)
- [ ] Graphiques Chart.js (plus interactifs)
- [ ] Export Excel (en plus du PDF)
- [ ] Comparaison multi-scénarios (3+ en parallèle)
- [ ] Intégration avec factures (CA réel vs simulation)
- [ ] Mode "régime réel" (vs micro-BNC)

## Support

Pour toute question ou bug concernant le calculateur :
- Email : mticonsulting59@gmail.com
- GitHub Issues : [Factu_MTI_CONSULTING/issues](https://github.com/mtcdp59/Factu_MTI_CONSULTING/issues)

---

**Dernière mise à jour** : Décembre 2025 (v2.2)
**Taux vérifiés** : Décembre 2025
**Prochaine révision** : Janvier 2026 (mise à jour annuelle des taux)
