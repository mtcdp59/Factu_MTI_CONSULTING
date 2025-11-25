# Barème IRPP Progressif - Documentation

## Vue d'ensemble

L'application intègre maintenant un **calculateur IRPP progressif** conforme au barème 2025, avec comparaison automatique entre le **versement libératoire** et l'**IRPP progressif** pour le statut BNC (Bénéfices Non Commerciaux).

## Barème IRPP 2025 (par défaut - Célibataire 1 part)

| Tranche | Min (€) | Max (€) | Taux |
|---------|---------|---------|------|
| 1 | 0 | 11 497 | 0% |
| 2 | 11 498 | 29 315 | 11% |
| 3 | 29 316 | 83 823 | 30% |
| 4 | 83 824 | 180 294 | 41% |
| 5 | 180 295 | ∞ | 45% |

**Source officielle** : [service-public.gouv.fr - Barème 2025](https://www.service-public.gouv.fr/particuliers/vosdroits/F1419) (Vérifié le 10 avril 2025)

## Spécificités BNC (Micro-entreprise)

### Abattement forfaitaire
- **Taux** : 34% du CA
- **Application** : Automatique pour calculer le revenu imposable
- **Formule** : `Revenu imposable = CA × (1 - 34/100)`

### Calcul IRPP progressif
1. **Revenu imposable annuel** = CA annuel × 66% (après abattement 34%)
2. **Application du barème** : Calcul par tranche avec taux marginaux
3. **Impôt mensuel** = Impôt annuel / 12

## Fonctionnalités implémentées

### 1. Barème éditable (Paramètres > Section 3)
- ✅ **Modifier les tranches** : Min, Max, Taux
- ✅ **Ajouter/Supprimer** des tranches
- ✅ **Réinitialiser** au barème par défaut 2025
- ✅ **Sauvegarde automatique** avec les paramètres

### 2. Calculateur dans l'onglet Calculs
- ✅ **Mode Versement libératoire** : Taux fixe 2.2% sur CA
- ✅ **Mode IRPP progressif** : Calcul automatique avec abattement BNC
- ✅ **Bascule dynamique** : Checkbox "Versement libératoire"

### 3. Comparaison automatique
- ✅ **Comparaison side-by-side** : Affiche les deux modes simultanément
- ✅ **Indication du meilleur choix** : Couleur verte pour l'option la plus avantageuse
- ✅ **Économie estimée** : Mensuelle et annuelle
- ✅ **Revenu imposable** : Affiché pour transparence

## Utilisation

### Dans l'onglet Calculs

1. **Saisir le CA mensuel** dans le champ dédié
2. **Cocher/décocher "Versement libératoire"** :
   - ✅ Coché = Versement libératoire 2.2%
   - ❌ Décoché = IRPP progressif
3. **Observer la comparaison** en bas de page :
   - Montants pour chaque mode
   - Meilleur choix recommandé
   - Économie potentielle

### Dans l'onglet Paramètres

**Section 3 : Barème Progressif IRPP**

1. **Modifier une tranche** :
   - Cliquer dans les champs Min/Max/Taux
   - Modifier la valeur
   - Sauvegarde automatique au changement

2. **Ajouter une tranche** :
   - Cliquer sur "➕ Ajouter une tranche"
   - Remplir Min/Max/Taux
   - Tri automatique par Min croissant

3. **Supprimer une tranche** :
   - Cliquer sur 🗑️ à droite de la tranche
   - Minimum 1 tranche conservée

4. **Réinitialiser** :
   - Cliquer sur "🔄 Réinitialiser barème par défaut"
   - Confirmer dans la popup
   - Retour au barème IRPP 2025

5. **Enregistrer** :
   - Cliquer sur "💾 Enregistrer les paramètres"
   - Confirmation visuelle 3 secondes

## Exemples de calcul

### Exemple 1 : CA annuel 30 000 €

**Versement libératoire :**
- Impôt = 30 000 € × 2.2% = **660 €/an** (55 €/mois)

**IRPP progressif :**
- Revenu imposable = 30 000 € × 66% = 19 800 €
- Tranche 1 (0-10 777) : 10 777 × 0% = 0 €
- Tranche 2 (10 778-19 800) : 9 022 × 11% = **992,42 €/an** (82,70 €/mois)

**Meilleur choix** : Versement libératoire (économie de 332,42 €/an)

### Exemple 2 : CA annuel 50 000 €

**Versement libératoire :**
- Impôt = 50 000 € × 2.2% = **1 100 €/an** (91,67 €/mois)

**IRPP progressif :**
- Revenu imposable = 50 000 € × 66% = 33 000 €
- Tranche 1 (0-10 777) : 10 777 × 0% = 0 €
- Tranche 2 (10 778-27 478) : 16 700 × 11% = 1 837 €
- Tranche 3 (27 479-33 000) : 5 521 × 30% = 1 656,30 €
- Total = **3 493,30 €/an** (291,11 €/mois)

**Meilleur choix** : Versement libératoire (économie de 2 393,30 €/an)

### Exemple 3 : CA annuel 80 000 €

**Versement libératoire :**
- Impôt = 80 000 € × 2.2% = **1 760 €/an** (146,67 €/mois)

**IRPP progressif :**
- Revenu imposable = 80 000 € × 66% = 52 800 €
- Tranche 1 (0-10 777) : 10 777 × 0% = 0 €
- Tranche 2 (10 778-27 478) : 16 700 × 11% = 1 837 €
- Tranche 3 (27 479-52 800) : 25 321 × 30% = 7 596,30 €
- Total = **9 433,30 €/an** (786,11 €/mois)

**Meilleur choix** : Versement libératoire (économie de 7 673,30 €/an)

## Point d'équilibre

Le **versement libératoire** devient intéressant lorsque le **revenu imposable dépasse ~16 364 € annuel** (soit ~24 794 € de CA annuel).

Pour des CA plus faibles, l'IRPP progressif peut être avantageux car les premières tranches sont à 0% et 11%.

## Formules utilisées

### Revenu imposable BNC
```javascript
revenuImposable = caAnnuel × (1 - abattement/100)
// Par défaut : caAnnuel × 0.66
```

### IRPP progressif (méthode par tranche)
```javascript
impot = 0
for each tranche in barème:
    if revenuImposable > tranche.min:
        montantTranche = min(revenuImposable, tranche.max) - tranche.min + 1
        impot += montantTranche × (tranche.taux / 100)
```

### Versement libératoire
```javascript
impot = caAnnuel × (tauxVersementLib / 100)
// Par défaut : caAnnuel × 0.022
```

## Stockage des données

Le barème IRPP est stocké dans `taxSettings.irppBareme` :
```javascript
taxSettings = {
    // ... autres paramètres
    irppBareme: [
        { min: 0, max: 10777, taux: 0 },
        { min: 10778, max: 27478, taux: 11 },
        { min: 27479, max: 78570, taux: 30 },
        { min: 78571, max: 168994, taux: 41 },
        { min: 168995, max: Infinity, taux: 45 }
    ],
    bncAbattement: 34
}
```

**Persistance** : Sauvegardé automatiquement sur Google Drive via `saveToDrive()`.

## Limitations et remarques

⚠️ **Important** :
- Le calcul est une **estimation** basée sur le CA mensuel × 12
- Il ne tient **pas compte** :
  - Des autres revenus du foyer
  - Du quotient familial
  - Des réductions/crédits d'impôt
  - Des charges déductibles spécifiques
- Prévu pour **1 personne seule** (1 part fiscale)

✅ **Recommandation** : Consulter un expert-comptable pour une simulation précise incluant tous les paramètres du foyer.

## Prochaines améliorations possibles

- [ ] Simulateur multi-scénarios (variation CA sur l'année)
- [ ] Prise en compte du quotient familial (parts fiscales)
- [ ] Export de la comparaison en PDF
- [ ] Historique des simulations
- [ ] Graphique d'évolution impôt selon CA
- [ ] Intégration déclaration mensuelle URSSAF

---

**Dernière mise à jour** : Novembre 2025  
**Version barème** : IRPP 2025 (officiel)  
**Statut** : BNC - Micro-entreprise avec versement libératoire
