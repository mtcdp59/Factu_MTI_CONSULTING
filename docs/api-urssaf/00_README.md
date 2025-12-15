# 📚 Documentation API URSSAF - Calculs Dynamiques

**Version**: 1.0.0  
**Statut**: ✅ **Implémentation complète**  
**Date**: Décembre 2025

---

## 🎯 Navigation rapide

| Document | Description | Durée lecture |
|----------|-------------|---------------|
| **[01_DECISION.md](01_DECISION.md)** | 📊 Décision stratégique et comparaison des approches | 10 min |
| **[02_IMPLEMENTATION.md](02_IMPLEMENTATION.md)** | 🔧 Guide technique complet d'implémentation | 30 min |
| **[03_MIGRATION.md](03_MIGRATION.md)** | 🔄 Guide de migration depuis taux statiques | 15 min |
| **[04_BUGFIXES.md](04_BUGFIXES.md)** | 🐛 Historique des corrections (v1.0.1 & v1.0.2) | 10 min |
| **[05_RESUME.md](05_RESUME.md)** | ⚡ Résumé exécutif (lecture rapide) | 5 min |

---

## 🚀 Résumé en 3 points

1. ✅ **Calculs dynamiques via API URSSAF** : Les cotisations sont calculées en temps réel
2. ✅ **Taux automatiques** : 12,50% AVEC ACRE / 24,80% SANS ACRE (CFP inclus)
3. ✅ **Maintenance zéro** : Toujours à jour avec la réglementation officielle

---

## 📖 Comprendre le projet

### Pour les développeurs

**Démarrage rapide** :
1. Lire [05_RESUME.md](05_RESUME.md) - Vue d'ensemble (5 min)
2. Lire [02_IMPLEMENTATION.md](02_IMPLEMENTATION.md) - Détails techniques (30 min)
3. Tester avec `test-api-calculs-dynamiques.html`

**Code source** : `app.js` lignes 3945-4422

### Pour les décideurs

**Comprendre la décision** :
1. Lire [01_DECISION.md](01_DECISION.md) - Comparaison des 3 approches
2. Lire [05_RESUME.md](05_RESUME.md) - Impact business

---

## 🗂️ Structure du dossier

```
docs/api-urssaf/
├── 00_README.md              # Index et navigation (ce fichier)
├── 01_DECISION.md            # Décision stratégique et comparaison
├── 02_IMPLEMENTATION.md      # Documentation technique complète
├── 03_MIGRATION.md           # Guide de migration
├── 04_BUGFIXES.md            # Historique des corrections
└── 05_RESUME.md              # Résumé exécutif
```

---

## 📊 Historique du projet

### Phase 1 - Audit initial (Novembre 2025)
- ✅ Identification des 10 paramètres fiscaux BNC
- ✅ Synchronisation de 5 seuils via API `/rules`
- ✅ Utilisation de taux URSSAF en dur (12,3% / 24,6%)

### Phase 2 - Exploration (Décembre 2025)
- ✅ Découverte : CFP disponible via API
- ✅ Tests de validation (12,50% / 24,80%)
- ✅ Comparaison de 3 approches possibles

### Phase 3 - Implémentation (Décembre 2025)
- ✅ Correction erreur ACRE dégressif
- ✅ Implémentation calculs dynamiques (~300 lignes)
- ✅ Tests de validation (4 scénarios)

### Phase 4 - Corrections (Décembre 2025)
- ✅ v1.0.1 : Corrections erreurs API et cache
- ✅ v1.0.2 : Amélioration fallback et logs

---

## 🔗 Ressources externes

- **API officielle** : [Mon-entreprise URSSAF](https://mon-entreprise.urssaf.fr/api/v1)
- **Documentation Publicodes** : [publi.codes](https://publi.codes/)
- **OpenAPI Spec** : [/api/v1/openapi.json](https://mon-entreprise.urssaf.fr/api/v1/openapi.json)

---

## ❓ Questions fréquentes

**Q: L'API URSSAF est-elle fiable ?**  
R: Oui, c'est l'API officielle utilisée par le simulateur Mon-entreprise de l'URSSAF.

**Q: Que se passe-t-il si l'API est indisponible ?**  
R: Le système bascule automatiquement sur des valeurs locales (12,5% / 24,8%).

**Q: Dois-je mettre à jour les taux manuellement ?**  
R: Non, les calculs sont automatiquement à jour via l'API.

**Q: Quelle est la latence de l'API ?**  
R: ~200-500ms par calcul, optimisé par un cache de 5 minutes.

---

## 📝 Maintenance

**Effort de maintenance** : ⏱️ 0 heure/an

Les calculs sont automatiquement synchronisés avec la réglementation URSSAF.

**Actions recommandées** :
- Vérifier logs console pour détecter erreurs API (1x/mois)
- Tester scénarios ACRE/SANS ACRE après màj réglementaire (1x/an en janvier)
