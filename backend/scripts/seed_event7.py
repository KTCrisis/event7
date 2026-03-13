#!/usr/bin/env python3
"""
event7 — Enrichments, Channels, Bindings & Governance Rules Seed
Placement: scripts/seed_event7.py

Usage:
  # First seed schemas in Apicurio:
  python scripts/seed_apicurio.py --url http://localhost:8081

  # Then create a registry in event7 Settings (http://localhost:3000/settings)
  # pointing to http://apicurio:8080

  # Then seed event7 data:
  python scripts/seed_event7.py [--url http://localhost:8000]

  # Or target a specific registry:
  python scripts/seed_event7.py --registry-id <uuid>

  # Skip specific sections:
  python scripts/seed_event7.py --skip-enrichments --skip-rules
"""

import argparse
import json
import sys
import time
import requests

DEFAULT_URL = "http://localhost:8000"
HEADERS = {"Content-Type": "application/json"}


# ════════════════════════════════════════════════════════════════════
# 1. ENRICHMENTS
# ════════════════════════════════════════════════════════════════════

ENRICHMENTS = [
    {
        "subject": "com.event7.Address",
        "description": "Base address record — reused by Customer, Shipment, and Invoice schemas.",
        "owner_team": "platform",
        "tags": ["base", "shared", "pii"],
        "classification": "confidential",
        "data_layer": "core",
    },
    {
        "subject": "com.event7.User",
        "description": "Core user identity. Contains PII fields (email, name). Referenced by Order and AuditEvent.",
        "owner_team": "identity",
        "tags": ["identity", "pii", "core"],
        "classification": "restricted",
        "data_layer": "core",
    },
    {
        "subject": "com.event7.Customer",
        "description": "Customer profile with billing/shipping addresses. References Address schema.",
        "owner_team": "commerce",
        "tags": ["customer", "pii"],
        "classification": "confidential",
        "data_layer": "core",
    },
    {
        "subject": "com.event7.Order",
        "description": "Order lifecycle events. Central to the commerce domain.",
        "owner_team": "commerce",
        "tags": ["order", "commerce", "transactional"],
        "classification": "internal",
        "data_layer": "core",
    },
    {
        "subject": "com.event7.Shipment",
        "description": "Shipment tracking events. References Address and Order.",
        "owner_team": "logistics",
        "tags": ["shipping", "logistics"],
        "classification": "internal",
        "data_layer": "refined",
    },
    {
        "subject": "com.event7.Invoice",
        "description": "Invoice generation events. References Customer and Order. Used for billing reports.",
        "owner_team": "finance",
        "tags": ["billing", "finance", "compliance"],
        "classification": "confidential",
        "data_layer": "refined",
    },
    {
        "subject": "com.event7.Payment",
        "description": "Payment processing events (JSON Schema). Tracks card/bank/PayPal transactions.",
        "owner_team": "finance",
        "tags": ["payment", "finance", "pci"],
        "classification": "restricted",
        "data_layer": "raw",
    },
    {
        "subject": "com.event7.Notification",
        "description": "Notification dispatch events — email, SMS, push. Application-level schema.",
        "owner_team": "engagement",
        "tags": ["notification", "messaging"],
        "classification": "internal",
        "data_layer": "application",
    },
    {
        "subject": "com.event7.AuditEvent",
        "description": "Audit trail for all user actions. Compliance requirement. References User.",
        "owner_team": "security",
        "tags": ["audit", "compliance", "security"],
        "classification": "restricted",
        "data_layer": "raw",
    },
]


# ════════════════════════════════════════════════════════════════════
# 2. CHANNELS + BINDINGS
# ════════════════════════════════════════════════════════════════════

CHANNELS = [
    {
        "name": "Core User Events",
        "address": "core.user.events",
        "broker_type": "kafka",
        "resource_kind": "topic",
        "messaging_pattern": "topic_log",
        "data_layer": "core",
        "description": "Central topic for user lifecycle events (created, updated, deleted).",
        "owner": "identity",
        "tags": ["identity", "core"],
        "broker_config": {"partitions": 6, "replication_factor": 3, "retention_ms": 604800000},
        "bindings": [
            {"subject_name": "com.event7.User", "binding_strategy": "domain_bound", "schema_role": "value", "binding_origin": "manual"},
        ],
    },
    {
        "name": "Core Commerce Events",
        "address": "core.commerce.events",
        "broker_type": "kafka",
        "resource_kind": "topic",
        "messaging_pattern": "topic_log",
        "data_layer": "core",
        "description": "Canonical commerce events — orders, customers. FULL_TRANSITIVE compatibility.",
        "owner": "commerce",
        "tags": ["commerce", "core", "transactional"],
        "broker_config": {"partitions": 12, "replication_factor": 3, "retention_ms": 2592000000},
        "bindings": [
            {"subject_name": "com.event7.Order", "binding_strategy": "domain_bound", "schema_role": "value", "binding_origin": "manual"},
            {"subject_name": "com.event7.Customer", "binding_strategy": "domain_bound", "schema_role": "value", "binding_origin": "manual"},
        ],
    },
    {
        "name": "Raw Payment Ingestion",
        "address": "raw.payment.ingestion",
        "broker_type": "kafka",
        "resource_kind": "topic",
        "messaging_pattern": "topic_log",
        "data_layer": "raw",
        "description": "Raw payment events from PSP webhooks. No transformation — fidelity to source.",
        "owner": "finance",
        "tags": ["payment", "raw", "pci"],
        "broker_config": {"partitions": 3, "replication_factor": 3, "cleanup_policy": "compact"},
        "bindings": [
            {"subject_name": "com.event7.Payment", "binding_strategy": "channel_bound", "schema_role": "value", "binding_origin": "manual"},
        ],
    },
    {
        "name": "Refined Billing Reports",
        "address": "refined.billing.reports",
        "broker_type": "kafka",
        "resource_kind": "topic",
        "messaging_pattern": "topic_log",
        "data_layer": "refined",
        "description": "Aggregated billing data — invoices joined with orders. Used by dashboards.",
        "owner": "finance",
        "tags": ["billing", "refined", "analytics"],
        "broker_config": {"partitions": 6, "replication_factor": 3},
        "bindings": [
            {"subject_name": "com.event7.Invoice", "binding_strategy": "domain_bound", "schema_role": "value", "binding_origin": "manual"},
        ],
    },
    {
        "name": "Logistics Tracking",
        "address": "logistics.shipment.tracking",
        "broker_type": "kafka",
        "resource_kind": "topic",
        "messaging_pattern": "topic_log",
        "data_layer": "refined",
        "description": "Shipment tracking updates enriched with address data.",
        "owner": "logistics",
        "tags": ["logistics", "tracking"],
        "broker_config": {"partitions": 6, "replication_factor": 3},
        "bindings": [
            {"subject_name": "com.event7.Shipment", "binding_strategy": "domain_bound", "schema_role": "value", "binding_origin": "manual"},
            {"subject_name": "com.event7.Address", "binding_strategy": "domain_bound", "schema_role": "key", "binding_origin": "manual"},
        ],
    },
    {
        "name": "App Notifications",
        "address": "app.notifications.dispatch",
        "broker_type": "rabbitmq",
        "resource_kind": "exchange",
        "messaging_pattern": "pubsub",
        "data_layer": "application",
        "description": "Fanout exchange for notification dispatch — email/SMS/push routing.",
        "owner": "engagement",
        "tags": ["notification", "application"],
        "broker_config": {"exchange_type": "topic", "durable": True, "routing_key_pattern": "notify.*"},
        "bindings": [
            {
                "subject_name": "com.event7.Notification",
                "binding_strategy": "app_bound",
                "schema_role": "value",
                "binding_origin": "routing_key",
                "binding_selector": "notify.*",
            },
        ],
    },
    {
        "name": "Audit Stream",
        "address": "security.audit.stream",
        "broker_type": "redis_streams",
        "resource_kind": "stream",
        "messaging_pattern": "topic_log",
        "data_layer": "raw",
        "description": "Redis Streams audit trail — low latency, compliance requirement.",
        "owner": "security",
        "tags": ["audit", "security", "compliance"],
        "broker_config": {"maxlen": 500000, "approximate_trimming": True},
        "bindings": [
            {"subject_name": "com.event7.AuditEvent", "binding_strategy": "channel_bound", "schema_role": "value", "binding_origin": "manual"},
        ],
    },
]


# ════════════════════════════════════════════════════════════════════
# 3. GOVERNANCE RULES
# ════════════════════════════════════════════════════════════════════

GOVERNANCE_RULES = [
    # Global rules (subject=null)
    {
        "rule_name": "require-description",
        "description": "All schemas must have a description in their enrichment metadata.",
        "rule_scope": "declarative",
        "rule_category": "data_quality",
        "rule_kind": "POLICY",
        "rule_type": "CUSTOM",
        "rule_mode": "REGISTER",
        "severity": "warning",
        "evaluation_source": "enrichment_metadata",
    },
    {
        "rule_name": "require-owner-team",
        "description": "All schemas must have an owner_team assigned.",
        "rule_scope": "declarative",
        "rule_category": "data_quality",
        "rule_kind": "POLICY",
        "rule_type": "CUSTOM",
        "rule_mode": "REGISTER",
        "severity": "error",
        "evaluation_source": "enrichment_metadata",
    },
    # Subject-specific rules
    {
        "subject": "com.event7.User",
        "rule_name": "encrypt-pii-fields",
        "description": "User PII fields (email, name) must be encrypted at rest.",
        "rule_scope": "runtime",
        "rule_category": "data_transform",
        "rule_kind": "TRANSFORM",
        "rule_type": "CEL_FIELD",
        "rule_mode": "WRITE",
        "expression": "typeName == 'string' && tags.exists(t, t == 'PII')",
        "on_success": "ENCRYPT",
        "on_failure": "ERROR",
        "severity": "critical",
        "evaluation_source": "provider_config",
    },
    {
        "subject": "com.event7.Order",
        "rule_name": "validate-order-fields",
        "description": "Orders must contain order_id, amount, and created_at.",
        "rule_scope": "runtime",
        "rule_category": "data_quality",
        "rule_kind": "CONDITION",
        "rule_type": "CEL",
        "rule_mode": "WRITE",
        "expression": "has(value.order_id) && has(value.amount) && has(value.created_at)",
        "severity": "error",
        "evaluation_source": "provider_config",
    },
    {
        "subject": "com.event7.Payment",
        "rule_name": "pci-compliance-policy",
        "description": "Payment data must follow PCI-DSS guidelines. No raw card numbers in payload.",
        "rule_scope": "declarative",
        "rule_category": "custom",
        "rule_kind": "POLICY",
        "rule_type": "CUSTOM",
        "rule_mode": "READWRITE",
        "severity": "critical",
        "evaluation_source": "declared_only",
    },
    {
        "subject": "com.event7.AuditEvent",
        "rule_name": "audit-immutability",
        "description": "Audit events are append-only. No updates or deletes allowed.",
        "rule_scope": "declarative",
        "rule_category": "custom",
        "rule_kind": "POLICY",
        "rule_type": "CUSTOM",
        "rule_mode": "WRITE",
        "severity": "error",
        "evaluation_source": "declared_only",
    },
    {
        "subject": "com.event7.Invoice",
        "rule_name": "backward-transitive-compat",
        "description": "Invoice schema must maintain backward-transitive compatibility for reporting.",
        "rule_scope": "control_plane",
        "rule_category": "schema_validation",
        "rule_kind": "VALIDATION",
        "rule_type": "COMPATIBILITY",
        "rule_mode": "REGISTER",
        "expression": "BACKWARD_TRANSITIVE",
        "severity": "error",
        "evaluation_source": "provider_config",
    },
]


# ════════════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════════════

def wait_for_event7(url: str, timeout: int = 30) -> bool:
    print(f"Waiting for event7 at {url}...", end="", flush=True)
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(f"{url}/api/v1/registries", headers=HEADERS, timeout=3)
            if r.status_code in (200, 401):
                print(" ready")
                return True
        except requests.ConnectionError:
            pass
        print(".", end="", flush=True)
        time.sleep(2)
    print(" TIMEOUT")
    return False


def get_registry_id(url: str, target_id: str | None = None) -> str | None:
    """Get registry ID — either the specified one or the first active one."""
    r = requests.get(f"{url}/api/v1/registries", headers=HEADERS)
    if r.status_code != 200 or not r.json():
        return None
    registries = r.json()

    if target_id:
        match = [reg for reg in registries if reg["id"] == target_id]
        if match:
            return match[0]["id"]
        print(f"  Registry {target_id} not found!")
        return None

    reg = registries[0]
    print(f"  Using registry: {reg['name']} ({reg['id'][:8]}…) [{reg['provider_type']}]")
    return reg["id"]


def seed_enrichment(url: str, registry_id: str, enrichment: dict) -> bool:
    subject = enrichment["subject"]
    endpoint = f"{url}/api/v1/registries/{registry_id}/subjects/{subject}/enrichment"
    r = requests.put(endpoint, json=enrichment, headers=HEADERS)
    if r.status_code == 200:
        layer = enrichment.get("data_layer", "—")
        print(f"  ✓ {subject} [layer={layer}, owner={enrichment.get('owner_team', '—')}]")
        return True
    else:
        print(f"  ✗ {subject} — {r.status_code}: {r.text[:200]}")
        return False


def seed_channel(url: str, registry_id: str, channel_def: dict) -> str | None:
    channel = {k: v for k, v in channel_def.items() if k != "bindings"}
    bindings = channel_def.get("bindings", [])

    endpoint = f"{url}/api/v1/registries/{registry_id}/channels"
    r = requests.post(endpoint, json=channel, headers=HEADERS)

    if r.status_code == 201:
        ch_id = r.json()["id"]
        print(f"  ✓ {channel['address']} [{channel['broker_type']}] → {ch_id[:8]}…")

        for binding in bindings:
            bind_url = f"{url}/api/v1/registries/{registry_id}/channels/{ch_id}/subjects"
            rb = requests.post(bind_url, json=binding, headers=HEADERS)
            if rb.status_code == 201:
                print(f"    ↳ {binding['subject_name']} [{binding['binding_strategy']}/{binding['schema_role']}]")
            else:
                print(f"    ✗ {binding['subject_name']} — {rb.status_code}: {rb.text[:150]}")
        return ch_id
    elif r.status_code == 400 and "unique" in r.text.lower():
        print(f"  · {channel['address']} already exists")
        return "exists"
    else:
        print(f"  ✗ {channel['address']} — {r.status_code}: {r.text[:200]}")
        return None


def seed_rule(url: str, registry_id: str, rule: dict) -> bool:
    endpoint = f"{url}/api/v1/registries/{registry_id}/rules"
    r = requests.post(endpoint, json=rule, headers=HEADERS)
    subject = rule.get("subject") or "(global)"
    if r.status_code in (200, 201):
        print(f"  ✓ {rule['rule_name']} → {subject} [{rule['rule_kind']}/{rule['severity']}]")
        return True
    elif r.status_code == 409 or (r.status_code == 400 and "unique" in r.text.lower()):
        print(f"  · {rule['rule_name']} already exists")
        return True
    else:
        print(f"  ✗ {rule['rule_name']} — {r.status_code}: {r.text[:200]}")
        return False


# ════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Seed event7 with enrichments, channels & rules")
    parser.add_argument("--url", default=DEFAULT_URL, help=f"event7 backend URL (default: {DEFAULT_URL})")
    parser.add_argument("--registry-id", default=None, help="Target registry UUID (default: first active)")
    parser.add_argument("--skip-enrichments", action="store_true", help="Skip enrichment seeding")
    parser.add_argument("--skip-channels", action="store_true", help="Skip channel + binding seeding")
    parser.add_argument("--skip-rules", action="store_true", help="Skip governance rule seeding")
    args = parser.parse_args()

    if not wait_for_event7(args.url):
        print("event7 not available, aborting.")
        sys.exit(1)

    registry_id = get_registry_id(args.url, args.registry_id)
    if not registry_id:
        print("\nNo registry found. Create one in Settings first:")
        print(f"  1. Open http://localhost:3000/settings")
        print(f"  2. Connect Registry → Apicurio → http://apicurio:8080")
        print(f"  3. Re-run this script")
        sys.exit(1)

    # ── Enrichments ──
    if not args.skip_enrichments:
        print(f"\n{'='*60}")
        print(f"ENRICHMENTS ({len(ENRICHMENTS)} subjects)")
        print(f"{'='*60}")
        ok = sum(1 for e in ENRICHMENTS if seed_enrichment(args.url, registry_id, e))
        print(f"  → {ok}/{len(ENRICHMENTS)} enrichments seeded")

    # ── Channels + Bindings ──
    if not args.skip_channels:
        total_bindings = sum(len(c.get("bindings", [])) for c in CHANNELS)
        print(f"\n{'='*60}")
        print(f"CHANNELS ({len(CHANNELS)} channels, {total_bindings} bindings)")
        print(f"{'='*60}")
        ok = sum(1 for c in CHANNELS if seed_channel(args.url, registry_id, c))
        print(f"  → {ok}/{len(CHANNELS)} channels seeded")

    # ── Governance Rules ──
    if not args.skip_rules:
        global_count = sum(1 for r in GOVERNANCE_RULES if not r.get("subject"))
        subject_count = len(GOVERNANCE_RULES) - global_count
        print(f"\n{'='*60}")
        print(f"GOVERNANCE RULES ({global_count} global, {subject_count} subject-specific)")
        print(f"{'='*60}")
        ok = sum(1 for r in GOVERNANCE_RULES if seed_rule(args.url, registry_id, r))
        print(f"  → {ok}/{len(GOVERNANCE_RULES)} rules seeded")

    # ── Summary ──
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"  Registry:     {registry_id[:8]}…")
    if not args.skip_enrichments:
        print(f"  Enrichments:  {len(ENRICHMENTS)} subjects (4 layers, 6 teams)")
    if not args.skip_channels:
        print(f"  Channels:     {len(CHANNELS)} channels (3 brokers: kafka/rabbitmq/redis)")
        print(f"  Bindings:     {total_bindings} subject bindings")
    if not args.skip_rules:
        print(f"  Rules:        {len(GOVERNANCE_RULES)} rules ({global_count} global + {subject_count} per-subject)")

    print(f"\n  Channel topology:")
    print(f"    Kafka topics:")
    print(f"      core.user.events          → User (value)")
    print(f"      core.commerce.events      → Order + Customer (value)")
    print(f"      raw.payment.ingestion     → Payment (value)")
    print(f"      refined.billing.reports   → Invoice (value)")
    print(f"      logistics.shipment.track. → Shipment (value) + Address (key)")
    print(f"    RabbitMQ exchange:")
    print(f"      app.notifications.dispatch → Notification (routing_key: notify.*)")
    print(f"    Redis Streams:")
    print(f"      security.audit.stream     → AuditEvent (value)")

    print(f"\n  Layer distribution:")
    print(f"    RAW:         Payment, AuditEvent + 2 channels")
    print(f"    CORE:        Address, User, Customer, Order + 2 channels")
    print(f"    REFINED:     Shipment, Invoice + 2 channels")
    print(f"    APPLICATION: Notification + 1 channel")

    print(f"\n  View in event7: http://localhost:3000")


if __name__ == "__main__":
    main()