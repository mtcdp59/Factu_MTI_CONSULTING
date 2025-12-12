# ⚠️ Autres éléments à surveiller pour votre activité

## 🚨 Seuils critiques 2025

### 1. Franchise en base de TVA (actuellement non applicable)

Votre simulateur **ne gère pas la TVA** car vous êtes sous le régime de franchise.

**Seuils BNC 2025** :
- **Seuil classique** : 37 500 € de CA annuel
- **Seuil majoré** : 39 100 € de CA annuel
- **Seuil de tolérance** : 39 100 € (dépassement 2 années consécutives)

**Conséquences si dépassement** :
```
CA < 37 500 €     → Franchise TVA (pas de TVA à facturer)
37 500 € < CA < 39 100 € → Franchise maintenue si 1ère fois
CA > 39 100 €     → Assujettissement TVA dès le 1er jour du mois de dépassement
```

**Si vous dépassez 37 500 €** :
1. Vous devez **facturer la TVA** (20% pour prestations de services)
2. Vous devez **collecter la TVA** pour le compte de l'État
3. Vous pouvez **récupérer la TVA** sur vos achats pro
4. Vous devez faire des **déclarations CA3** (mensuelles ou trimestrielles)

**Action recommandée** :
- Ajouter un **compteur CA annuel** dans votre app
- **Alerte automatique** à 35 000 € (pour anticiper)
- **Calculateur TVA** intégré (20% prestations, 10% services, 5,5% livres...)

### 2. Plafond micro-entreprise BNC : 77 700 €

**Votre statut actuel** : Micro-entreprise BNC

**Si vous dépassez 77 700 €** :
- **Année N** : Dépassement toléré si < 85 470 € (110% du seuil)
- **Année N+1** : Sortie automatique du régime micro-entreprise
- **Passage au régime réel** : Comptabilité complète obligatoire

**Régime réel = adieu simplicité** :
```
Micro-entreprise            Régime réel
─────────────────────────   ─────────────────────────
✅ Déclaration CA           ❌ Comptabilité complète
✅ Abattement 34%           ❌ Frais réels justifiés
✅ Pas de TVA               ⚠️ TVA à gérer
✅ Charges sociales sur CA  ⚠️ Charges sur bénéfice
```

**Action recommandée** :
- Surveiller votre **CA mensuel cumulé**
- Anticiper le passage si croissance forte
- Prévoir un **expert-comptable** dès 70 000 €

### 3. Abattement BNC : 34% (fixe)

**Important** : L'abattement de 34% est **forfaitaire**, vous **ne pouvez pas déduire vos frais réels** en micro-entreprise.

**Calcul du revenu imposable** :
```
Revenu imposable = CA × 66% (= CA - 34%)
```

**Exemple CA annuel 77 700 €** :
```
Revenu imposable = 77 700 × 0,66 = 51 282 €
IRPP (barème progressif) ≈ 7 200 € (selon situation familiale)
```

**Si vos frais réels > 34%** :
- Vous êtes **pénalisé** en micro-entreprise
- **Solution** : passer au régime réel (déclaration contrôlée)
- Nécessite : comptabilité complète + expert-comptable

**Frais typiques en BNC** :
- Loyer bureau / coworking
- Matériel informatique
- Logiciels / abonnements
- Formation professionnelle
- Assurance RC Pro
- Frais de déplacement
- Documentation technique

**Action recommandée** :
- Tenez un **tableur de frais** même en micro-entreprise
- Calculez votre **% frais réels** annuel
- Si > 40% → envisager le régime réel

## 📊 Indicateurs à suivre

### Dashboard recommandé

```
┌─────────────────────────────────────────────────┐
│ TABLEAU DE BORD ANNUEL                          │
├─────────────────────────────────────────────────┤
│ CA cumulé              :  45 600 € / 77 700 €   │ 58%
│ Seuil TVA (franchise)  :  45 600 € / 37 500 €   │ 🚨 DÉPASSÉ
│ Charges URSSAF cumulées:   5 608 € (12,3%)      │
│ CFP cumulée            :      91 € (0,2%)       │
│ VL/IRPP cumulé         :   1 003 € (2,2%)       │
│ CFE (estimation)       :     600 €              │
├─────────────────────────────────────────────────┤
│ Total charges          :   7 302 €              │
│ Revenu net             :  38 298 €              │
│ Taux de charges global :    16,0%               │
└─────────────────────────────────────────────────┘

⚠️ ALERTES :
- Seuil TVA dépassé → Assujettissement dès le 1er janvier 2026
- Projections : 54 000 € annuels → 16 500 € CA restant autorisé
```

### Suivi mensuel recommandé

| Mois | CA Mensuel | CA Cumulé | Seuil TVA | Seuil Micro | Charges | Net |
|------|-----------|-----------|-----------|-------------|---------|-----|
| Jan | 7 200 € | 7 200 € | 19% | 9% | 1 108 € | 6 091 € |
| Fév | 7 200 € | 14 400 € | 38% | 19% | 1 108 € | 6 091 € |
| Mar | 7 200 € | 21 600 € | 58% | 28% | 1 108 € | 6 091 € |
| Avr | 7 200 € | 28 800 € | 77% | 37% | 1 108 € | 6 091 € |
| Mai | 7 200 € | 36 000 € | 96% | 46% | 1 108 € | 6 091 € |
| Jun | 7 200 € | 43 200 € | 🚨 115% | 56% | 1 108 € | 6 091 € |

## 🛠️ Améliorations suggérées pour votre app

### Fonctionnalités manquantes critiques

1. **Compteur CA annuel**
   ```javascript
   // Dans l'onglet Suivi
   const caAnnuel = invoices
     .filter(inv => inv.date.startsWith('2025'))
     .reduce((sum, inv) => sum + inv.total, 0);
   ```

2. **Alertes seuils**
   ```javascript
   if (caAnnuel > 35000) {
     showAlert('⚠️ Approche du seuil TVA (37 500 €)');
   }
   if (caAnnuel > 70000) {
     showAlert('🚨 Approche du plafond micro-entreprise (77 700 €)');
   }
   ```

3. **Calculateur TVA** (pour anticiper)
   ```javascript
   function calculateWithTVA(ht, tauxTVA = 20) {
     const tva = ht * (tauxTVA / 100);
     const ttc = ht + tva;
     return { ht, tva, ttc };
   }
   ```

4. **Graphique évolution CA**
   ```
   77 700€ ┤                    ─────────────── Plafond micro
           │                   ╱
   60 000€ ┤                  ╱
           │                 ╱
   40 000€ ┤           ─────────────────────── Seuil TVA
           │          ╱
   20 000€ ┤        ╱
           │      ╱
       0 € ┼────────────────────────────────
           Jan  Mar  Mai  Jul  Sep  Nov
   ```

5. **Export comptable**
   - Format CSV pour expert-comptable
   - Colonnes : Date, Client, Montant HT, TVA, TTC, Paiement
   - Filtres : année fiscale, client, statut paiement

## 📅 Calendrier fiscal auto-entrepreneur 2025

### Déclarations obligatoires

| Date limite | Déclaration | Fréquence | Notes |
|-------------|-------------|-----------|-------|
| **31 janvier** | CA URSSAF T4 2024 | Trimestrielle | Si option trimestrielle |
| **30 avril** | CA URSSAF T1 2025 | Trimestrielle | |
| **Mai** | Déclaration 2042-C-PRO | Annuelle | Revenus 2024 |
| **31 juillet** | CA URSSAF T2 2025 | Trimestrielle | |
| **31 octobre** | CA URSSAF T3 2025 | Trimestrielle | |
| **15 décembre** | CFE 2025 | Annuelle | Paiement en ligne |

### Option mensuelle (recommandé)

Si vous avez opté pour la déclaration **mensuelle** :
- Déclaration **avant le dernier jour** de chaque mois
- Pour le CA du **mois précédent**
- Paiement automatique sous 3-5 jours

**Exemple** :
```
Déclaration du 31 janvier 2025
→ CA de décembre 2024
→ Paiement prélevé début février 2025
```

## 🔗 Ressources utiles

### Sites officiels
1. **Mon compte URSSAF** : https://www.autoentrepreneur.urssaf.fr/
2. **Impots.gouv.fr** : https://www.impots.gouv.fr/professionnel
3. **Infogreffe** : https://www.infogreffe.fr/ (modification statuts)
4. **Service-Public Pro** : https://www.service-public.fr/professionnels-entreprises

### Simulateurs officiels
1. **URSSAF** : https://mon-entreprise.urssaf.fr/simulateurs
2. **Impôts** : https://simulateur-ir-ifi.impots.gouv.fr/

### 🎯 Votre outil MTI CONSULTING

Votre application intègre déjà :
- ✅ **Gestion facturation** : Création, envoi, suivi paiements
- ✅ **Gestion clients** : SIRENE auto-rempli, export Sheets
- ✅ **RAM (Rapports d'Activité)** : Génération PDF + envoi automatique
- ✅ **Simulateur fiscal** : VL vs IRPP, projection 2025-2029, CFE par commune
- ✅ **Planning** : Synchronisation Google Calendar
- ✅ **Suivi activité** : Dashboard, statistiques, export comptable
- ✅ **Compteur CA annuel** : Alertes seuils TVA (37 500€) et Micro (77 700€) *(Nouveau - Déc 2025)*
- ✅ **Calculateur TVA** : Conversions HT/TTC pour anticiper assujettissement *(Nouveau - Déc 2025)*
- ✅ **Factures récurrentes** : Abonnements mensuels/trimestriels/annuels automatiques *(Nouveau - Déc 2025)*

**Fonctionnalités à développer** (cf. améliorations ci-dessus) :
- [ ] Export comptable CSV pour expert-comptable
- [ ] Gestion acomptes et factures partielles
- [ ] Relances automatiques (J+7, J+15, J+30)
- [ ] Bons de commande / Bons de livraison
- [ ] Notes de frais et indemnités kilométriques
- [ ] Prévisionnel de trésorerie 6 mois

## 📝 Actions immédiates recommandées

### Checklist de mise en conformité

- [ ] **Vérifier mes taux URSSAF** (12,3% avec ACRE / 24,6% sans ACRE)
- [ ] **Vérifier ma situation ACRE** (si début activité < 12 mois → avec ACRE)
- [ ] **Calculer mon CA 2024 cumulé**
- [ ] **Vérifier si j'ai dépassé 37 500 €** (seuil TVA)
- [ ] **Anticiper mon CA 2025** (projection)
- [ ] **Mettre à jour ma feuille Excel frais réels**
- [ ] **Configurer alertes seuils** dans l'app
- [ ] **Vérifier date limite prochaine déclaration URSSAF**
- [ ] **Préparer déclaration 2042-C-PRO** (revenus 2024)
- [ ] **Payer CFE 2025** (avant 15 décembre)

### Si CA > 37 500 € en 2025

Vous devrez :
1. **Prévenir l'URSSAF** dès le dépassement
2. **Vous inscrire à la TVA** (formulaire en ligne)
3. **Modifier vos factures** (ajouter TVA 20%)
4. **Déclarer CA3** (mensuelle ou trimestrielle)
5. **Récupérer TVA** sur achats pro passés et futurs

**Impact sur vos prix** :
```
AVANT (franchise TVA)
Facture : 7 200 € TTC (= HT)

APRÈS (assujetti TVA)
Facture : 8 640 € TTC (7 200 € HT + 1 440 € TVA)

Option 1 : Augmenter prix → Client paie 8 640 €
Option 2 : Garder prix TTC → Vous perdez 1 440 € (= 20%)
```

---

**Dernière mise à jour** : 8 décembre 2025 (v1.1.1 - Correction ACRE réforme 2020)
**Prochaine révision** : Janvier 2026 (nouveaux taux URSSAF si annoncés)
**Important** : ACRE valable 12 mois depuis réforme 2020 (plus de dégressivité sur 3 ans)
