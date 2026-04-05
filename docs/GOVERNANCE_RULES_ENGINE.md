# SESSION — Governance Rules Engine

**Date :** 12-13 Mars 2026
**Branche :** `feature/governance-rules-engine`
**Statut :** Mergée dans main
**Dernière mise à jour :** 5 avril 2026

---

## Résumé

Conception, implémentation complète, et intégration du moteur de governance rules dans event7. Parti d'un besoin de rendre les data rules Confluent compatibles avec un modèle agnostique, abouti à un moteur complet avec rules, policies, templates, scoring, et intégration frontend.

Depuis la session initiale, le moteur a été étendu avec le Schema Validator (évaluation automatique des rules sur le schema content), les custom templates (création/clone utilisateur), et le contextual severity scoring (ajustement de la sévérité selon le contexte d'enrichment).

---

## Décisions clés prises pendant la session

### 1. Rules vs Policies (review externe)

Le modèle initial mélangeait des règles exécutables (CEL encrypt-pii) et des standards organisationnels (require-owner) sous le même concept. Ajout de `POLICY` dans l'enum `rule_kind` pour distinguer clairement les deux. Impact : UI groupée en sections "Rules" et "Policies", scoring pondéré différemment.

### 2. rule_scope ajouté (review externe)

Distinction explicite entre `runtime` (exécuté au produce/consume), `control_plane` (à l'enregistrement), `declarative` (convention), `audit` (vérification a posteriori). Drive le comportement UI, le scoring, et l'éligibilité au sync provider.

### 3. is_enforced remplacé par enforcement_status (review externe)

Le boolean `is_enforced` était trop binaire. Remplacé par un enum à 5 valeurs : `declared` → `expected` → `synced` → `verified` → `drifted`. Contrainte CHECK en DB : seuls runtime et control_plane peuvent être synced/verified/drifted.

### 4. evaluation_source ajouté (review externe)

Champ qui indique comment event7 peut vérifier une rule : `provider_config`, `schema_content`, `enrichment_metadata`, `declared_only`, `not_evaluable`. Impact direct sur la confiance du score (high/medium/low).

### 5. target_type + target_ref (préparation V2)

Deux champs optionnels pour l'héritage étendu (group Apicurio, namespace Confluent, layer, tag). V1 implémente uniquement `registry` et `subject`. Documenté comme limite connue.

### 6. Taxonomie rule_type documentée

Pas un enum (reste TEXT pour extensibilité) mais une taxonomie de référence : COMPATIBILITY, VALIDITY, INTEGRITY, BREAKING_CHECK, LINT pour schema_validation ; CEL, CEL_FIELD, JSONATA pour runtime ; REGEX, REQUIRED_FIELDS, CUSTOM pour declarative. Avec disclaimer : l'équivalence entre providers est partielle.

### 7. Guardrails sync Confluent

Documenté dans le design : optimistic locking (vérifier que latest n'a pas changé), preview diff before push, confirmation UX explicite ("This creates a new schema version"), version pinning = latest only en V1.

### 8. source + origin_template_id + applies_to_version

Trois champs de traçabilité : d'où vient la rule (manual/template/imported_provider), quel template l'a créée (FK nullable), quelle version du schéma était concernée à l'import.

### 9. Catalog score toggle

Les scores ne sont pas affichés par défaut dans le catalog — bouton toggle Eye/EyeOff pour les activer. Évite les appels API inutiles et le bruit visuel quand l'utilisateur ne s'intéresse pas au scoring.

### 10. Dashboard governance fusionné

L'ancien bloc "Governance Coverage" (barres description/owner/tags) et le nouveau bloc rules sont fusionnés en une seule section 2 colonnes : score + coverage + KPIs à gauche, scope pie chart + enforcement funnel à droite.

---

## Évolutions post-session

### Custom templates — `5df1c60`, `ad60e1b`, `728b6f0`

Ajout de la création et du clonage de templates par l'utilisateur. Nouveau composant `template-manager.tsx` dans le frontend. Gestion des doublons de noms (duplicate check avec message d'erreur explicite).

### Schema Validator — rules evaluator — `d98304e`

Implémentation du `rules_evaluator.py` : évaluation automatique des rules `evaluation_source=schema_content` en dry-run. Supporte 6 types d'évaluateurs (require-doc, require-fields, naming-convention, max-fields, field-regex). Les rules non-évaluables (CEL, runtime, declared_only) sont retournées comme `skipped` avec raison explicite.

### Contextual severity scoring — `83f34ca`

Ajout du `rules_context_resolver.py` : la sévérité des violations est ajustée selon le contexte d'enrichment (classification, data_layer, binding_count). Intégré dans le rules evaluator et dans le scoring du governance service. Voir [CONTEXTUAL_SEVERITY.md](CONTEXTUAL_SEVERITY.md) pour le détail du calcul.

### Bug fixes — `912f15e`, `d321e79`, `f10e556`

- 11 bugs critical+high corrigés (dont template duplicate error handling)
- 10 bugs medium corrigés
- Verdict case mismatch dans le validator UI (backend uppercase vs frontend lowercase)

---

## Fichiers livrés

### Backend

| Fichier | Description |
|---------|-------------|
| `backend/migrations/003_governance_rules.sql` | Migration incrémentale (6 enums, 2 tables, 6 CHECK, 8 index, 4 seed templates) |
| `backend/migrations/002_postgresql_standalone.sql` | Mis à jour v0.3.0 avec governance |
| `bootstrap.sql` | Mis à jour v0.3.0 (Supabase, non versionné) |
| `backend/app/models/governance_rules.py` | 10 enums + 14 modèles Pydantic |
| `backend/app/db/base.py` | +8 méthodes abstraites |
| `backend/app/db/supabase_client.py` | +8 méthodes (supabase-py query builder) |
| `backend/app/db/postgresql_client.py` | +8 méthodes (psycopg2 SQL) |
| `backend/app/services/governance_rules_service.py` | 21 méthodes (CRUD, templates, scoring) + contextual severity |
| `backend/app/services/rules_evaluator.py` | Évaluation dry-run des rules schema_content (6 évaluateurs) |
| `backend/app/services/rules_context_resolver.py` | Ajustement contextuel de la sévérité (3 facteurs, delta stacking) |
| `backend/app/api/rules.py` | 9 endpoints FastAPI |
| `backend/app/main.py` | Router enregistré |

### Frontend

| Fichier | Description |
|---------|-------------|
| `frontend/src/types/governance-rules.ts` | 11 types + 14 interfaces + 4 config maps UI |
| `frontend/src/lib/api/rules.ts` | 9 fonctions API client |
| `frontend/src/app/(dashboard)/rules/page.tsx` | Page rules : liste, filtres, KPIs, templates dropdown |
| `frontend/src/components/rules/rule-editor.tsx` | Drawer adaptatif par scope/kind |
| `frontend/src/components/rules/rule-badges.tsx` | 6 composants badges réutilisables |
| `frontend/src/components/rules/governance-score.tsx` | Score widget (circle SVG + breakdown + confidence) |
| `frontend/src/components/rules/dashboard-governance.tsx` | Section dashboard unifiée (coverage + rules + score) |
| `frontend/src/components/rules/catalog-score.tsx` | Badge score pour catalog avec cache mémoire |
| `frontend/src/components/rules/template-manager.tsx` | Création/clone de templates custom |
| `frontend/src/app/(dashboard)/page.tsx` | Dashboard mis à jour avec DashboardGovernance |
| `frontend/src/app/(dashboard)/catalog/page.tsx` | Catalog avec toggle score |
| `frontend/src/components/layout/sidebar.tsx` | Entrée "Rules" ajoutée |

### Documentation

| Fichier | Description |
|---------|-------------|
| `docs/CONTEXTUAL_SEVERITY.md` | Comment fonctionne la sévérité contextuelle (Phase 0) |
| `docs/SEVERITY_SCORING_DESIGN.md` | Design doc complet du severity scoring (Phases 0-5) |
| `frontend/src/app/docs/governance-rules/page.tsx` | Page docs frontend (10 sections) |
| `frontend/src/app/docs/features/page.tsx` | Mis à jour : Governance Rules dans features actives |
| `frontend/src/app/docs/api-reference/page.tsx` | Mis à jour : 2 groupes endpoints ajoutés |
| `frontend/src/app/docs/licensing/page.tsx` | Mis à jour : governance dans tiers + comparison table |
| `frontend/src/app/docs/roadmap/page.tsx` | Mis à jour : 5 items moved to Done, 4 added to Next |
| `frontend/src/components/docs/docs-sidebar.tsx` | Entrée "Governance Rules" ajoutée |

---

## Tests

### Tests manuels effectués (session initiale)

- Templates list (GET /governance/templates) — 4 templates retournés
- Create rule manuelle (POST /rules) — CEL condition, enforcement expected
- Apply template core_layer — 5 rules créées, source=template
- List rules par subject — retourne subject-specific + global
- Scoring — 3 axes calculés, grade F (normal : pas d'enrichments, rules pas synced)
- Frontend page /rules — liste, filtres, editor drawer fonctionnel
- Dashboard governance section — score + coverage + enforcement funnel
- Catalog score toggle — badges affichés/masqués

### Tests automatisés

- `test_validator.py` : couvre le rules evaluator (require-doc, naming-convention, max-fields) et l'intégration du contextual severity dans le verdict
- Tests unitaires du scoring et du context resolver : à faire

---

## Problèmes rencontrés et résolus

| Problème | Cause | Solution |
|----------|-------|----------|
| `DROP TRIGGER IF EXISTS` échoue sur table inexistante | PostgreSQL exige que la table existe | Wrappé dans `DO $$ EXCEPTION WHEN undefined_table` |
| `ModuleNotFoundError: supabase` en local | DB_PROVIDER pas configuré pour PostgreSQL | Mis `DB_PROVIDER=postgresql` + `DATABASE_URL` dans .env |
| Credentials PG incorrects | docker-compose utilise event7/event7_dev_password, pas postgres/postgres | Corrigé l'URL de connexion |
| DashboardGovernance mal positionné | Placé à l'intérieur de la grid 2 colonnes au lieu d'en dessous | Sorti de la grid, bloc standalone |
| Template duplicate silently fails | `create_governance_template` retournait None | Try/except avec check "unique"/"duplicate" dans l'erreur |
| Verdict case mismatch | Backend PASS/WARN/FAIL uppercase, frontend expects lowercase | `.toLowerCase()` avant matching config keys |

---

## Architecture résultante

```
Governance Rules Engine
├── DB Layer (6 enums, 2 tables, 8 méthodes x 3 implémentations)
├── Service Layer
│   ├── governance_rules_service.py (21 méthodes : CRUD + templates + scoring)
│   ├── rules_evaluator.py (dry-run evaluation, 6 évaluateurs)
│   └── rules_context_resolver.py (contextual severity, 3 facteurs)
├── API Layer (9 endpoints)
├── Frontend Layer
│   ├── Types + API client
│   ├── Page /rules (liste, filtres, editor drawer)
│   ├── Template manager (create, clone)
│   ├── Score widget (réutilisable)
│   ├── Dashboard integration
│   └── Catalog integration (toggle)
└── Docs (feature page, API ref, licensing, roadmap, severity docs)
```

---

## Ce qui reste

| Item | Statut | Notes |
|------|:------:|-------|
| Tests unitaires (scoring, contraintes, templates) | A faire | |
| Tests intégration API (routes + DB) | A faire | |
| Provider sync : import Confluent ruleSet | A faire | |
| Provider sync : import Apicurio artifact rules | A faire | |
| Provider sync : push event7 rules → Confluent | A faire | |
| Drift detection (enforcement_status synced → drifted) | A faire | |
| Explorer integration (onglet Governance dans détail schema) | A faire | |
| Exposure Score (multi-factor 0-100) | A faire | Design doc : [SEVERITY_SCORING_DESIGN.md](SEVERITY_SCORING_DESIGN.md) Phase 1 |
| Semantic Risk Detector | A faire | Design doc : Phase 2 |
| Verdict adjustment matrix | A faire | Design doc : Phase 3 |
| ~~Automated policy evaluation (schema_content)~~ | **Fait** | `rules_evaluator.py` — `d98304e` |
| ~~Custom templates (user-created)~~ | **Fait** | `template-manager.tsx` — `5df1c60` |
| ~~Contextual severity scoring~~ | **Fait** | `rules_context_resolver.py` — `83f34ca` |

---

*~6200 lignes initiales + ~800 lignes post-session · ~35 fichiers · 0 breaking changes*
