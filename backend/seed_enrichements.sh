#!/bin/bash
# seed_enrichments.sh
# Enrichit les 9 schemas event7 seed avec des metadata business réalistes.
# Usage: bash seed_enrichments.sh [REGISTRY_ID] [BASE_URL]

REGISTRY_ID="${1:-e9282922-291e-4798-9e2e-aef8e84b43c9}"
BASE_URL="${2:-http://localhost:8000}"
API="$BASE_URL/api/v1/registries/$REGISTRY_ID"

echo "═══════════════════════════════════════════════"
echo "  event7 — Seed Enrichments & Governance"
echo "  Registry: $REGISTRY_ID"
echo "  API:      $BASE_URL"
echo "═══════════════════════════════════════════════"
echo ""

# ── Helper ──
enrich() {
  local subject="$1"
  local payload="$2"
  local resp
  resp=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    "$API/subjects/$subject/enrichment" \
    -H "Content-Type: application/json" \
    -d "$payload")
  if [ "$resp" = "200" ]; then
    echo "  ✓ $subject"
  else
    echo "  ✗ $subject (HTTP $resp)"
  fi
}

# ════════════════════════════════════════════════
# Phase 1: Enrichments
# ════════════════════════════════════════════════
echo "Phase 1: Enrichments"
echo "────────────────────"

enrich "com.event7.Address" '{
  "description": "Canonical address type shared across all domains. Used by Customer (billing/shipping) and Shipment (destination).",
  "owner_team": "platform-team",
  "tags": ["domain:shared", "pii", "reusable", "gdpr"],
  "classification": "confidential",
  "data_layer": "core"
}'

enrich "com.event7.User" '{
  "description": "Core user identity with role-based access. Referenced by Order (user_id) and AuditEvent (actor).",
  "owner_team": "identity-team",
  "tags": ["domain:identity", "pii", "gdpr", "critical-path"],
  "classification": "restricted",
  "data_layer": "core"
}'

enrich "com.event7.Customer" '{
  "description": "Customer profile with billing and shipping addresses. Central entity for the commerce domain.",
  "owner_team": "commerce-team",
  "tags": ["domain:commerce", "pii", "gdpr"],
  "classification": "confidential",
  "data_layer": "core"
}'

enrich "com.event7.Order" '{
  "description": "Order placed by a user. Triggers downstream Invoice, Shipment, and Payment flows.",
  "owner_team": "orders-team",
  "tags": ["domain:orders", "critical-path", "revenue"],
  "classification": "confidential",
  "data_layer": "core"
}'

enrich "com.event7.Invoice" '{
  "description": "Financial invoice generated from an Order. Links to Customer for billing details.",
  "owner_team": "billing-team",
  "tags": ["domain:billing", "pci", "financial", "audit-required"],
  "classification": "restricted",
  "data_layer": "refined"
}'

enrich "com.event7.Shipment" '{
  "description": "Shipment tracking for an Order. Contains destination Address and carrier details.",
  "owner_team": "logistics-team",
  "tags": ["domain:logistics", "pii"],
  "classification": "confidential",
  "data_layer": "refined"
}'

enrich "com.event7.Payment" '{
  "description": "Payment transaction linked to an Order. Supports card, bank transfer, and PayPal methods.",
  "owner_team": "payments-team",
  "tags": ["domain:payments", "pci", "financial", "critical-path"],
  "classification": "restricted",
  "data_layer": "application"
}'

enrich "com.event7.Notification" '{
  "description": "Multi-channel notification (EMAIL, SMS, PUSH) sent to users. Fire-and-forget pattern.",
  "owner_team": "platform-team",
  "tags": ["domain:notifications", "async"],
  "classification": "internal",
  "data_layer": "application"
}'

enrich "com.event7.AuditEvent" '{
  "description": "Immutable audit trail entry. Records actor, action, resource, and timestamp for compliance.",
  "owner_team": "security-team",
  "tags": ["domain:security", "compliance", "audit-required", "immutable"],
  "classification": "restricted",
  "data_layer": "raw"
}'

echo ""

# ════════════════════════════════════════════════
# Phase 2: Apply CORE governance template
# ════════════════════════════════════════════════
echo "Phase 2: Governance Templates"
echo "─────────────────────────────"

# First, list available templates
echo "  Fetching templates..."
TEMPLATES=$(curl -s "$BASE_URL/api/v1/governance/templates")
TEMPLATE_COUNT=$(echo "$TEMPLATES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
echo "  Found $TEMPLATE_COUNT templates"

if [ "$TEMPLATE_COUNT" != "0" ]; then
  # Get the CORE template ID (the most comprehensive one)
  CORE_ID=$(echo "$TEMPLATES" | python3 -c "
import sys, json
templates = json.load(sys.stdin)
for t in templates:
    if t.get('template_name') == 'core' or 'CORE' in t.get('display_name', ''):
        print(t['id'])
        break
" 2>/dev/null)

  if [ -n "$CORE_ID" ]; then
    echo "  Applying CORE template ($CORE_ID) to registry..."
    APPLY_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
      "$API/rules/templates/$CORE_ID/apply" \
      -H "Content-Type: application/json" \
      -d "{\"registry_id\": \"$REGISTRY_ID\", \"subject\": null, \"overwrite\": false}")
    echo "  ✓ CORE template applied (HTTP $APPLY_RESP)"
  else
    echo "  No CORE template found, trying first available..."
    FIRST_ID=$(echo "$TEMPLATES" | python3 -c "
import sys, json
templates = json.load(sys.stdin)
if templates:
    print(templates[0]['id'])
" 2>/dev/null)
    if [ -n "$FIRST_ID" ]; then
      APPLY_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        "$API/rules/templates/$FIRST_ID/apply" \
        -H "Content-Type: application/json" \
        -d "{\"registry_id\": \"$REGISTRY_ID\", \"subject\": null, \"overwrite\": false}")
      echo "  ✓ Template applied (HTTP $APPLY_RESP)"
    fi
  fi
else
  echo "  ⚠ No governance templates available — skipping"
fi

echo ""

# ════════════════════════════════════════════════
# Phase 3: Verify
# ════════════════════════════════════════════════
echo "Phase 3: Verify"
echo "───────────────"

# Check a few enrichments
for subject in "com.event7.Address" "com.event7.Order" "com.event7.Payment"; do
  DESC=$(curl -s "$API/subjects/$subject/enrichment" | python3 -c "
import sys, json
data = json.load(sys.stdin)
desc = data.get('description', '')[:60] if data else 'N/A'
owner = data.get('owner_team', 'N/A')
layer = data.get('data_layer', 'N/A')
tags = len(data.get('tags', []))
print(f'{owner} | {layer} | {tags} tags | {desc}...')
" 2>/dev/null)
  echo "  $subject"
  echo "    $DESC"
done

echo ""

# Check governance score for one subject
echo "Governance scores (sample):"
for subject in "com.event7.Address" "com.event7.Invoice" "com.event7.AuditEvent"; do
  SCORE=$(curl -s "$API/governance/score?subject=$subject" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"  {data.get('score', 0)}/100 ({data.get('grade', 'F')}) confidence={data.get('confidence', '?')}\")
" 2>/dev/null)
  echo "  $subject"
  echo "  $SCORE"
done

echo ""
echo "═══════════════════════════════════════════════"
echo "  Done! Now run:"
echo "    cd ~/my-catalog && npm run generate && npm run dev"
echo "═══════════════════════════════════════════════"