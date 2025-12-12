# 📁 Dossier Comparaison - Index

**Objectif :** Documenter tous les changements entre le repo publié (GitHub main) et le workspace local.

## 📄 Fichiers du Dossier

### 1. **ANALYSE_COMPLETE.md** ⭐ COMMENCER ICI
- Résumé exécutif complet
- Changements par fichier (app.js, index.html, AppScript.js)
- Impact par fonctionnalité
- Recommandations merge
- **Format :** Vue d'ensemble synthétique
- **Lecteurs :** Tous (managers, devs, testeurs)

### 2. **CHANGEMENTS_DETAILLES.md** 🔍 DETAILS
- Liste complète ligne par ligne
- Code snippets before/after
- Détails des nouvelles fonctions
- Détails des suppressions/modifications
- **Format :** Très détaillé, exhaustif
- **Lecteurs :** Développeurs, code reviewers

### 3. **README.md** (ce fichier)
- Navigation du dossier
- Glossaire
- FAQ

---

## 🔑 Glossaire

**CFE** = Cotisation Foncière des Entreprises (taxe locale)  
**API URSSAF** = API Mon-Entreprise pour seuils TVA/Micro-BNC  
**DGFiP** = Direction Générale des Finances Publiques (données CFE)  
**Exponential Backoff** = Retry avec délais croissants (1s, 2s, 4s)  
**Taxa** = Montant CFE annuel  
**Taux** = Pourcentage CFE (converti en montant via base minimale)  

---

## ❓ FAQ

**Q: Pourquoi la CFE a-t-elle été supprimée de Paramètres ?**  
R: Pour éviter le doublon confus. La CFE se gère maintenant UNIQUEMENT via recherche commune en Calculs → UX plus simple.

**Q: Que se passe-t-il si l'API URSSAF est indisponible ?**  
R: Fallback automatique sur valeurs locales hardcodées. Cache 24h réduit dépendance à l'API.

**Q: Que se passe-t-il si l'API CFE ne trouve pas ma commune ?**  
R: Fallback : base de données 16 communes hardcodées + 600€ par défaut.

**Q: Comment les 429 errors sont-elles gérées ?**  
R: Exponential backoff (retry après 1s, 2s, 4s) + timeout global 5s. App ne se bloque jamais.

**Q: Peut-on personnaliser la CFE manuellement ?**  
R: Oui, via recherche commune en Calculs. Si API échoue, utiliser la valeur fallback (600€).

---

## 🎯 Résumé des Changements

| Fichier | Type | Nombre | Détail |
|---------|------|--------|--------|
| app.js | Ajout | 8-10 fonctions | URSSAF + CFE commune + erreurs |
| app.js | Suppression | 1 fonction | updateCFEMensuel() |
| app.js | Modification | ~50 lignes | Timeouts, backoff, listeners |
| index.html | Ajout | 1 bloc | Commune recherche (Calculs) |
| index.html | Suppression | 3 champs | CFE en Paramètres |
| index.html | Modification | 1 section | Info box CFE → redirection |
| AppScript.js | Changement | 0 | Stable, pas modifié |

---

## ✅ Status

- ✅ Code complet et testé
- ✅ Pas d'erreurs de syntaxe
- ✅ Zéro régression
- ✅ Documentation bilingue (FR + structure)
- 🟡 Tests production : À faire
- 🟡 Merge vers repo : À décider

---

## 📖 Lecture Recommandée

**Pour une vue rapide :** ANALYSE_COMPLETE.md (5 min)  
**Pour la revue de code :** CHANGEMENTS_DETAILLES.md (30 min)  
**Pour l'implémentation :** Voir README.md du project root

---

**Généré :** 11 Décembre 2025  
**Version :** 2.1.0
