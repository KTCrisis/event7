# ============================================================
# event7 — Schema Validator Demo Schemas
# ============================================================
#
# Fichier de référence pour la démo du Schema Validator.
# Aligné sur seed_apicurio.py (compatibilités) + seed_event7.py (rules).
#
# Compatibility modes configurés par le seed :
#   GLOBAL default:  BACKWARD
#   CORE layer:      FULL_TRANSITIVE (Address, User, Customer, Order)
#   REFINED layer:   BACKWARD_TRANSITIVE (Shipment, Invoice)
#   RAW/APP layer:   BACKWARD (Payment, Notification, AuditEvent)
#
# Usage :
#   Copier le JSON dans le Validator UI ou utiliser les curl commands.
#   Remplacer {REGISTRY_ID} par l'UUID du registry.
#
# ============================================================


# ════════════════════════════════════════════════════════════
# 1. FULL_TRANSITIVE — com.event7.User (CORE layer)
# ════════════════════════════════════════════════════════════


# ── 1a. PASS — Ajout champ optionnel avec default + doc ──
# Attendu: compatible, pas de breaking, verdict PASS

SUBJECT="com.event7.User"

SCHEMA_1A='{
  "type": "record",
  "name": "User",
  "namespace": "com.event7",
  "fields": [
    {"name": "id", "type": "string"},
    {"name": "email", "type": "string"},
    {"name": "name", "type": "string"},
    {"name": "role", "type": {"type": "enum", "name": "UserRole", "symbols": ["USER", "ADMIN", "MODERATOR"]}, "default": "USER"},
    {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    {"name": "phone", "type": ["null", "string"], "default": null, "doc": "Phone number"}
  ]
}'

# curl:
# curl -s -X POST http://localhost:8000/api/v1/registries/{REGISTRY_ID}/schemas/validate \
#   -H "Content-Type: application/json" \
#   -d "{\"subject\": \"com.event7.User\", \"schema_content\": $(echo $SCHEMA_1A | python -c 'import sys,json; print(json.dumps(json.dumps(json.loads(sys.stdin.read()))))')}" \
#   | python -m json.tool


# ── 1b. FAIL (SR) — Suppression de champs requis ──
# Attendu: is_compatible=false (FULL_TRANSITIVE rejette), breaking=true, verdict FAIL

SCHEMA_1B='{
  "type": "record",
  "name": "User",
  "namespace": "com.event7",
  "fields": [
    {"name": "id", "type": "string", "doc": "User ID"},
    {"name": "name", "type": "string", "doc": "Full name"}
  ]
}'


# ── 1c. FAIL (SR) — Changement de type incompatible ──
# Attendu: is_compatible=false (string → int), verdict FAIL

SCHEMA_1C='{
  "type": "record",
  "name": "User",
  "namespace": "com.event7",
  "fields": [
    {"name": "id", "type": "int"},
    {"name": "email", "type": "string"},
    {"name": "name", "type": "string"},
    {"name": "role", "type": {"type": "enum", "name": "UserRole", "symbols": ["USER", "ADMIN", "MODERATOR"]}, "default": "USER"},
    {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}}
  ]
}'


# ── 1d. FAIL (SR) — Ajout champ requis sans default ──
# Attendu: is_compatible=false (FULL_TRANSITIVE : ancien reader ne sait pas lire le nouveau champ sans default)

SCHEMA_1D='{
  "type": "record",
  "name": "User",
  "namespace": "com.event7",
  "fields": [
    {"name": "id", "type": "string"},
    {"name": "email", "type": "string"},
    {"name": "name", "type": "string"},
    {"name": "role", "type": {"type": "enum", "name": "UserRole", "symbols": ["USER", "ADMIN", "MODERATOR"]}, "default": "USER"},
    {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    {"name": "age", "type": "int"}
  ]
}'


# ════════════════════════════════════════════════════════════
# 2. FULL_TRANSITIVE — com.event7.Address (CORE layer)
# ════════════════════════════════════════════════════════════


# ── 2a. PASS — Ajout champ optionnel ──

SCHEMA_2A='{
  "type": "record",
  "name": "Address",
  "namespace": "com.event7",
  "fields": [
    {"name": "street", "type": "string"},
    {"name": "city", "type": "string"},
    {"name": "zip", "type": "string"},
    {"name": "country", "type": "string"},
    {"name": "state", "type": ["null", "string"], "default": null}
  ]
}'


# ── 2b. FAIL (SR) — Suppression champ ──

SCHEMA_2B='{
  "type": "record",
  "name": "Address",
  "namespace": "com.event7",
  "fields": [
    {"name": "street", "type": "string"},
    {"name": "city", "type": "string"},
    {"name": "country", "type": "string"}
  ]
}'


# ════════════════════════════════════════════════════════════
# 3. BACKWARD_TRANSITIVE — com.event7.Shipment (REFINED layer)
# ════════════════════════════════════════════════════════════


# ── 3a. PASS — Ajout champ optionnel ──
# BACKWARD permet d'ajouter des champs avec default

SCHEMA_3A='{
  "type": "record",
  "name": "Shipment",
  "namespace": "com.event7",
  "fields": [
    {"name": "shipment_id", "type": "string"},
    {"name": "order_id", "type": "string"},
    {"name": "destination", "type": "com.event7.Address"},
    {"name": "carrier", "type": "string"},
    {"name": "tracking_number", "type": ["null", "string"], "default": null},
    {"name": "status", "type": {"type": "enum", "name": "ShipmentStatus", "symbols": ["PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED"]}},
    {"name": "estimated_delivery", "type": ["null", "string"], "default": null}
  ]
}'


# ── 3b. FAIL (SR) — Suppression champ ──
# BACKWARD_TRANSITIVE : suppression = incompatible (reader attend le champ)

SCHEMA_3B='{
  "type": "record",
  "name": "Shipment",
  "namespace": "com.event7",
  "fields": [
    {"name": "shipment_id", "type": "string"},
    {"name": "order_id", "type": "string"},
    {"name": "carrier", "type": "string"},
    {"name": "status", "type": {"type": "enum", "name": "ShipmentStatus", "symbols": ["PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED"]}}
  ]
}'


# ── 3c. PASS — Ajout symbole enum ──
# BACKWARD : ajouter un symbole à un enum est backward-compatible

SCHEMA_3C='{
  "type": "record",
  "name": "Shipment",
  "namespace": "com.event7",
  "fields": [
    {"name": "shipment_id", "type": "string"},
    {"name": "order_id", "type": "string"},
    {"name": "destination", "type": "com.event7.Address"},
    {"name": "carrier", "type": "string"},
    {"name": "tracking_number", "type": ["null", "string"], "default": null},
    {"name": "status", "type": {"type": "enum", "name": "ShipmentStatus", "symbols": ["PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "RETURNED"]}}
  ]
}'


# ════════════════════════════════════════════════════════════
# 4. BACKWARD (global) — com.event7.Payment (RAW layer, JSON Schema)
# ════════════════════════════════════════════════════════════


# ── 4a. PASS — Ajout propriété optionnelle ──

SCHEMA_4A='{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Payment",
  "properties": {
    "payment_id": {"type": "string"},
    "order_id": {"type": "string"},
    "amount": {"type": "number"},
    "method": {"type": "string", "enum": ["card", "bank_transfer", "paypal"]},
    "status": {"type": "string", "enum": ["pending", "completed", "failed"]},
    "processed_at": {"type": "string", "format": "date-time"},
    "receipt_url": {"type": "string", "format": "uri"}
  },
  "required": ["payment_id", "order_id", "amount", "method"]
}'


# ── 4b. FAIL (SR) — Ajout required field ──
# BACKWARD : ajouter un champ required = incompatible (ancien writer ne le fournit pas)

SCHEMA_4B='{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Payment",
  "properties": {
    "payment_id": {"type": "string"},
    "order_id": {"type": "string"},
    "amount": {"type": "number"},
    "method": {"type": "string", "enum": ["card", "bank_transfer", "paypal"]},
    "status": {"type": "string", "enum": ["pending", "completed", "failed"]},
    "processed_at": {"type": "string", "format": "date-time"},
    "currency": {"type": "string"}
  },
  "required": ["payment_id", "order_id", "amount", "method", "currency"]
}'


# ════════════════════════════════════════════════════════════
# 5. NEW SUBJECT — com.event7.ReturnRequest (n'existe pas)
# ════════════════════════════════════════════════════════════


# ── 5a. PASS — Premier schema, rien à comparer ──
# Attendu: is_compatible=true (new subject), diff vide, verdict PASS

SCHEMA_5A='{
  "type": "record",
  "name": "ReturnRequest",
  "namespace": "com.event7",
  "fields": [
    {"name": "return_id", "type": "string", "doc": "Unique return request ID"},
    {"name": "order_id", "type": "string", "doc": "Original order reference"},
    {"name": "reason", "type": "string", "doc": "Return reason"},
    {"name": "requested_at", "type": {"type": "long", "logicalType": "timestamp-millis"}, "doc": "Request timestamp"}
  ]
}'


# ════════════════════════════════════════════════════════════
# 6. GOVERNANCE RULES — Tests event7 rules
# ════════════════════════════════════════════════════════════
#
# NOTE: Pour que ces tests fonctionnent, il faut des rules avec
# enforcement_status = "expected" (pas "declared").
# Les rules du seed_event7.py par défaut sont "declared" → skipped.
#
# Créer des rules "expected" via l'API ou l'UI Rules :
#
#   POST /api/v1/registries/{REGISTRY_ID}/rules
#   {
#     "rule_name": "require-doc-on-fields",
#     "rule_scope": "audit",
#     "rule_category": "data_quality",
#     "rule_kind": "POLICY",
#     "rule_type": "CUSTOM",
#     "rule_mode": "REGISTER",
#     "severity": "error",
#     "enforcement_status": "expected",
#     "evaluation_source": "schema_content",
#     "description": "All fields must have a doc attribute"
#   }
#
#   POST /api/v1/registries/{REGISTRY_ID}/rules
#   {
#     "rule_name": "max-fields-limit",
#     "rule_scope": "audit",
#     "rule_category": "custom",
#     "rule_kind": "POLICY",
#     "rule_type": "CUSTOM",
#     "rule_mode": "REGISTER",
#     "severity": "warning",
#     "enforcement_status": "expected",
#     "evaluation_source": "schema_content",
#     "params": {"max_fields": 10},
#     "description": "Schemas should not exceed 10 fields"
#   }
#
#   POST /api/v1/registries/{REGISTRY_ID}/rules
#   {
#     "rule_name": "naming-convention",
#     "rule_scope": "audit",
#     "rule_category": "schema_validation",
#     "rule_kind": "POLICY",
#     "rule_type": "NAMING",
#     "rule_mode": "REGISTER",
#     "severity": "error",
#     "enforcement_status": "expected",
#     "evaluation_source": "schema_content",
#     "rule_expression": "^[A-Z][a-zA-Z]+$",
#     "params": {"target": "name"},
#     "description": "Record name must be PascalCase"
#   }


# ── 6a. FAIL (governance) — Champs sans doc ──
# Attendu: compatible (ajout optionnel), mais violation "require-doc" → FAIL
# Prérequis: rule "require-doc-on-fields" avec severity=error, enforcement=expected

SCHEMA_6A='{
  "type": "record",
  "name": "User",
  "namespace": "com.event7",
  "fields": [
    {"name": "id", "type": "string"},
    {"name": "email", "type": "string"},
    {"name": "name", "type": "string"},
    {"name": "role", "type": {"type": "enum", "name": "UserRole", "symbols": ["USER", "ADMIN", "MODERATOR"]}, "default": "USER"},
    {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    {"name": "phone", "type": ["null", "string"], "default": null}
  ]
}'


# ── 6b. WARN (governance) — Trop de champs ──
# Attendu: compatible, mais violation "max-fields-limit" (warning) → WARN
# Prérequis: rule "max-fields-limit" avec severity=warning, enforcement=expected, max_fields=10

SCHEMA_6B='{
  "type": "record",
  "name": "Order",
  "namespace": "com.event7",
  "fields": [
    {"name": "order_id", "type": "string"},
    {"name": "user_id", "type": "string"},
    {"name": "amount", "type": "double"},
    {"name": "currency", "type": "string"},
    {"name": "status", "type": {"type": "enum", "name": "OrderStatus", "symbols": ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]}},
    {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    {"name": "shipping_method", "type": ["null", "string"], "default": null},
    {"name": "discount_code", "type": ["null", "string"], "default": null},
    {"name": "notes", "type": ["null", "string"], "default": null},
    {"name": "priority", "type": ["null", "int"], "default": null},
    {"name": "channel", "type": ["null", "string"], "default": null},
    {"name": "region", "type": ["null", "string"], "default": null}
  ]
}'


# ── 6c. FAIL (governance) — Naming convention violée ──
# Attendu: compatible, mais violation "naming-convention" (error) → FAIL
# Prérequis: rule "naming-convention" avec severity=error, enforcement=expected

SCHEMA_6C='{
  "type": "record",
  "name": "user_event",
  "namespace": "com.event7",
  "fields": [
    {"name": "id", "type": "string"},
    {"name": "email", "type": "string"},
    {"name": "name", "type": "string"},
    {"name": "role", "type": {"type": "enum", "name": "UserRole", "symbols": ["USER", "ADMIN", "MODERATOR"]}, "default": "USER"},
    {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}}
  ]
}'


# ════════════════════════════════════════════════════════════
# RÉSUMÉ — Matrice des tests
# ════════════════════════════════════════════════════════════
#
# | Test | Subject          | Mode              | Changement                  | SR    | event7 | Verdict |
# |------|------------------|-------------------|-----------------------------|-------|--------|---------|
# | 1a   | User             | FULL_TRANSITIVE   | +phone (optional+default)   | ✓     | ✓      | PASS    |
# | 1b   | User             | FULL_TRANSITIVE   | −email −role −created_at    | ✗     | break  | FAIL    |
# | 1c   | User             | FULL_TRANSITIVE   | id: string→int              | ✗     | break  | FAIL    |
# | 1d   | User             | FULL_TRANSITIVE   | +age (required, no default) | ✗     | —      | FAIL    |
# | 2a   | Address          | FULL_TRANSITIVE   | +state (optional)           | ✓     | ✓      | PASS    |
# | 2b   | Address          | FULL_TRANSITIVE   | −zip                        | ✗     | break  | FAIL    |
# | 3a   | Shipment         | BACKWARD_TRANS.   | +estimated_delivery (opt)   | ✓     | ✓      | PASS    |
# | 3b   | Shipment         | BACKWARD_TRANS.   | −destination −tracking      | ✗     | break  | FAIL    |
# | 3c   | Shipment         | BACKWARD_TRANS.   | +RETURNED enum symbol       | ✓     | ✓      | PASS    |
# | 4a   | Payment (JSON)   | BACKWARD          | +receipt_url (optional)     | ✓     | ✓      | PASS    |
# | 4b   | Payment (JSON)   | BACKWARD          | +currency (required)        | ✗     | —      | FAIL    |
# | 5a   | ReturnRequest    | (new)             | First schema                | n/a   | ✓      | PASS    |
# | 6a   | User             | FULL_TRANSITIVE   | +phone (no doc)             | ✓     | ✗ doc  | FAIL*   |
# | 6b   | Order            | FULL_TRANSITIVE   | +6 fields (>10 max)         | ✓     | ⚠ max  | WARN*   |
# | 6c   | User             | FULL_TRANSITIVE   | name: user_event            | ✓     | ✗ name | FAIL*   |
#
# * Requiert des governance rules "expected" — voir section 6 ci-dessus
#
