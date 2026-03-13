#!/usr/bin/env bash
# ============================================================
# event7 — Schema Validator Demo Script
# ============================================================
# Usage:
#   chmod +x demo_validator.sh
#   ./demo_validator.sh <REGISTRY_ID>
#
# Pre-requisites:
#   - Backend running on http://localhost:8000
#   - Apicurio seeded: python scripts/seed_apicurio.py --clean
#   - event7 seeded:   python scripts/seed_event7.py
#   - (Optional) Governance rules with enforcement=expected for tests 6a-6c
# ============================================================

set -e

REGISTRY_ID="${1:?Usage: $0 <REGISTRY_ID>}"
BASE="http://localhost:8000/api/v1/registries/${REGISTRY_ID}/schemas/validate"
HDR="Content-Type: application/json"

validate() {
  local label="$1"
  local subject="$2"
  local schema="$3"
  local schema_type="${4:-AVRO}"

  # Escape schema for JSON string
  local escaped
  escaped=$(echo "$schema" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read().strip()))')

  echo ""
  echo "════════════════════════════════════════════════"
  echo "  $label"
  echo "  Subject: $subject"
  echo "════════════════════════════════════════════════"

  local result
  result=$(curl -s -X POST "$BASE" -H "$HDR" \
    -d "{\"subject\": \"$subject\", \"schema_content\": $escaped, \"schema_type\": \"$schema_type\"}")

  local verdict=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['verdict'].upper())")
  local compat=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin)['compatibility']; print(f\"compatible={d['is_compatible']} mode={d['mode']}\")")
  local diff_info=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin)['diff']; print(f\"changes={d['total_changes']} breaking={d['is_breaking']} new={d['is_new_subject']}\")")
  local gov=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin)['governance']; print(f\"score={d['score']} passed={d['passed']} failed={d['failed']} skipped={len(d['skipped'])}\")")

  # Color verdict
  case "$verdict" in
    PASS) echo -e "  Verdict: \033[32m✓ PASS\033[0m" ;;
    WARN) echo -e "  Verdict: \033[33m⚠ WARN\033[0m" ;;
    FAIL) echo -e "  Verdict: \033[31m✗ FAIL\033[0m" ;;
  esac
  echo "  $compat"
  echo "  $diff_info"
  echo "  $gov"
}


# ════════════════════════════════════════════════
# 1. FULL_TRANSITIVE — User (CORE)
# ════════════════════════════════════════════════

validate "1a. User — PASS (add optional field)" "com.event7.User" '{
  "type": "record", "name": "User", "namespace": "com.event7",
  "fields": [
    {"name": "id", "type": "string"},
    {"name": "email", "type": "string"},
    {"name": "name", "type": "string"},
    {"name": "role", "type": {"type": "enum", "name": "UserRole", "symbols": ["USER", "ADMIN", "MODERATOR"]}, "default": "USER"},
    {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    {"name": "phone", "type": ["null", "string"], "default": null, "doc": "Phone number"}
  ]
}'

validate "1b. User — FAIL (remove required fields)" "com.event7.User" '{
  "type": "record", "name": "User", "namespace": "com.event7",
  "fields": [
    {"name": "id", "type": "string", "doc": "User ID"},
    {"name": "name", "type": "string", "doc": "Full name"}
  ]
}'

validate "1c. User — FAIL (type change string→int)" "com.event7.User" '{
  "type": "record", "name": "User", "namespace": "com.event7",
  "fields": [
    {"name": "id", "type": "int"},
    {"name": "email", "type": "string"},
    {"name": "name", "type": "string"},
    {"name": "role", "type": {"type": "enum", "name": "UserRole", "symbols": ["USER", "ADMIN", "MODERATOR"]}, "default": "USER"},
    {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}}
  ]
}'

validate "1d. User — FAIL (add required field, no default)" "com.event7.User" '{
  "type": "record", "name": "User", "namespace": "com.event7",
  "fields": [
    {"name": "id", "type": "string"},
    {"name": "email", "type": "string"},
    {"name": "name", "type": "string"},
    {"name": "role", "type": {"type": "enum", "name": "UserRole", "symbols": ["USER", "ADMIN", "MODERATOR"]}, "default": "USER"},
    {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    {"name": "age", "type": "int"}
  ]
}'


# ════════════════════════════════════════════════
# 2. FULL_TRANSITIVE — Address (CORE)
# ════════════════════════════════════════════════

validate "2a. Address — PASS (add optional state)" "com.event7.Address" '{
  "type": "record", "name": "Address", "namespace": "com.event7",
  "fields": [
    {"name": "street", "type": "string"},
    {"name": "city", "type": "string"},
    {"name": "zip", "type": "string"},
    {"name": "country", "type": "string"},
    {"name": "state", "type": ["null", "string"], "default": null}
  ]
}'

validate "2b. Address — FAIL (remove zip)" "com.event7.Address" '{
  "type": "record", "name": "Address", "namespace": "com.event7",
  "fields": [
    {"name": "street", "type": "string"},
    {"name": "city", "type": "string"},
    {"name": "country", "type": "string"}
  ]
}'


# ════════════════════════════════════════════════
# 3. BACKWARD_TRANSITIVE — Shipment (REFINED)
# ════════════════════════════════════════════════

validate "3a. Shipment — PASS (add optional field)" "com.event7.Shipment" '{
  "type": "record", "name": "Shipment", "namespace": "com.event7",
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

validate "3b. Shipment — FAIL (remove fields)" "com.event7.Shipment" '{
  "type": "record", "name": "Shipment", "namespace": "com.event7",
  "fields": [
    {"name": "shipment_id", "type": "string"},
    {"name": "order_id", "type": "string"},
    {"name": "carrier", "type": "string"},
    {"name": "status", "type": {"type": "enum", "name": "ShipmentStatus", "symbols": ["PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED"]}}
  ]
}'

validate "3c. Shipment — PASS (add enum symbol)" "com.event7.Shipment" '{
  "type": "record", "name": "Shipment", "namespace": "com.event7",
  "fields": [
    {"name": "shipment_id", "type": "string"},
    {"name": "order_id", "type": "string"},
    {"name": "destination", "type": "com.event7.Address"},
    {"name": "carrier", "type": "string"},
    {"name": "tracking_number", "type": ["null", "string"], "default": null},
    {"name": "status", "type": {"type": "enum", "name": "ShipmentStatus", "symbols": ["PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "RETURNED"]}}
  ]
}'


# ════════════════════════════════════════════════
# 4. BACKWARD — Payment (RAW, JSON Schema)
# ════════════════════════════════════════════════

validate "4a. Payment — PASS (add optional property)" "com.event7.Payment" '{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object", "title": "Payment",
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
}' "JSON"

validate "4b. Payment — FAIL (add required property)" "com.event7.Payment" '{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object", "title": "Payment",
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
}' "JSON"


# ════════════════════════════════════════════════
# 5. NEW SUBJECT
# ════════════════════════════════════════════════

validate "5a. ReturnRequest — PASS (new subject)" "com.event7.ReturnRequest" '{
  "type": "record", "name": "ReturnRequest", "namespace": "com.event7",
  "fields": [
    {"name": "return_id", "type": "string", "doc": "Unique return request ID"},
    {"name": "order_id", "type": "string", "doc": "Original order reference"},
    {"name": "reason", "type": "string", "doc": "Return reason"},
    {"name": "requested_at", "type": {"type": "long", "logicalType": "timestamp-millis"}, "doc": "Request timestamp"}
  ]
}'


# ════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════

echo ""
echo "════════════════════════════════════════════════"
echo "  DEMO COMPLETE"
echo "════════════════════════════════════════════════"
echo "  Expected results:"
echo "    1a PASS  │ 2a PASS  │ 3a PASS  │ 4a PASS  │ 5a PASS"
echo "    1b FAIL  │ 2b FAIL  │ 3b FAIL  │ 4b FAIL  │"
echo "    1c FAIL  │          │ 3c PASS  │          │"
echo "    1d FAIL  │          │          │          │"
echo ""
echo "  Governance tests (6a-6c) require 'expected' rules — see VALIDATOR_DEMO_SCHEMAS.sh"
echo "════════════════════════════════════════════════"
