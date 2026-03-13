#!/usr/bin/env python3
"""
event7 — Apicurio Test Data Seed
Placement: scripts/seed_apicurio.py

Usage:
  python scripts/seed_apicurio.py [--url http://localhost:8081] [--clean]

Creates a realistic set of schemas with references in the default group.
Configures compatibility rules aligned with data layers.
"""

import argparse
import json
import sys
import time
import requests

DEFAULT_URL = "http://localhost:8081"
BASE_PATH = "/apis/registry/v3"
GROUP = "default"


# ── Schema definitions ──

SCHEMAS = [
    # 1. Address (base, referenced by Customer + Shipment)
    {
        "artifactId": "com.event7.Address",
        "artifactType": "AVRO",
        "content": {
            "type": "record",
            "name": "Address",
            "namespace": "com.event7",
            "fields": [
                {"name": "street", "type": "string"},
                {"name": "city", "type": "string"},
                {"name": "zip", "type": "string"},
                {"name": "country", "type": "string"},
            ],
        },
        "references": [],
    },
    # 2. User (base, no references)
    {
        "artifactId": "com.event7.User",
        "artifactType": "AVRO",
        "content": {
            "type": "record",
            "name": "User",
            "namespace": "com.event7",
            "fields": [
                {"name": "id", "type": "string"},
                {"name": "email", "type": "string"},
                {"name": "name", "type": "string"},
                {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
            ],
        },
        "references": [],
    },
    # 2b. User v2 (add role field — schema evolution)
    {
        "artifactId": "com.event7.User",
        "artifactType": "AVRO",
        "version_only": True,
        "content": {
            "type": "record",
            "name": "User",
            "namespace": "com.event7",
            "fields": [
                {"name": "id", "type": "string"},
                {"name": "email", "type": "string"},
                {"name": "name", "type": "string"},
                {"name": "role", "type": {"type": "enum", "name": "UserRole", "symbols": ["USER", "ADMIN", "MODERATOR"]}, "default": "USER"},
                {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
            ],
        },
        "references": [],
    },
    # 3. Customer (references Address)
    {
        "artifactId": "com.event7.Customer",
        "artifactType": "AVRO",
        "content": {
            "type": "record",
            "name": "Customer",
            "namespace": "com.event7",
            "fields": [
                {"name": "id", "type": "string"},
                {"name": "name", "type": "string"},
                {"name": "email", "type": "string"},
                {"name": "billing_address", "type": "com.event7.Address"},
                {"name": "shipping_address", "type": ["null", "com.event7.Address"], "default": None},
            ],
        },
        "references": [
            {"groupId": GROUP, "artifactId": "com.event7.Address", "version": "1", "name": "com.event7.Address"},
        ],
    },
    # 4. Order (references User)
    {
        "artifactId": "com.event7.Order",
        "artifactType": "AVRO",
        "content": {
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
            ],
        },
        "references": [
            {"groupId": GROUP, "artifactId": "com.event7.User", "version": "1", "name": "com.event7.User"},
        ],
    },
    # 5. Shipment (references Address + Order)
    {
        "artifactId": "com.event7.Shipment",
        "artifactType": "AVRO",
        "content": {
            "type": "record",
            "name": "Shipment",
            "namespace": "com.event7",
            "fields": [
                {"name": "shipment_id", "type": "string"},
                {"name": "order_id", "type": "string"},
                {"name": "destination", "type": "com.event7.Address"},
                {"name": "carrier", "type": "string"},
                {"name": "tracking_number", "type": ["null", "string"], "default": None},
                {"name": "status", "type": {"type": "enum", "name": "ShipmentStatus", "symbols": ["PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED"]}},
            ],
        },
        "references": [
            {"groupId": GROUP, "artifactId": "com.event7.Address", "version": "1", "name": "com.event7.Address"},
            {"groupId": GROUP, "artifactId": "com.event7.Order", "version": "1", "name": "com.event7.Order"},
        ],
    },
    # 6. Invoice (references Customer + Order)
    {
        "artifactId": "com.event7.Invoice",
        "artifactType": "AVRO",
        "content": {
            "type": "record",
            "name": "Invoice",
            "namespace": "com.event7",
            "fields": [
                {"name": "invoice_id", "type": "string"},
                {"name": "order_id", "type": "string"},
                {"name": "customer_id", "type": "string"},
                {"name": "total", "type": "double"},
                {"name": "currency", "type": "string"},
                {"name": "issued_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
            ],
        },
        "references": [
            {"groupId": GROUP, "artifactId": "com.event7.Customer", "version": "1", "name": "com.event7.Customer"},
            {"groupId": GROUP, "artifactId": "com.event7.Order", "version": "1", "name": "com.event7.Order"},
        ],
    },
    # 7. Payment (JSON Schema — no references)
    {
        "artifactId": "com.event7.Payment",
        "artifactType": "JSON",
        "content": {
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
            },
            "required": ["payment_id", "order_id", "amount", "method"],
        },
        "references": [],
    },
    # 8. Notification (Avro — no references)
    {
        "artifactId": "com.event7.Notification",
        "artifactType": "AVRO",
        "content": {
            "type": "record",
            "name": "Notification",
            "namespace": "com.event7",
            "fields": [
                {"name": "id", "type": "string"},
                {"name": "user_id", "type": "string"},
                {"name": "channel", "type": {"type": "enum", "name": "Channel", "symbols": ["EMAIL", "SMS", "PUSH"]}},
                {"name": "title", "type": "string"},
                {"name": "body", "type": "string"},
                {"name": "sent_at", "type": ["null", {"type": "long", "logicalType": "timestamp-millis"}], "default": None},
            ],
        },
        "references": [],
    },
    # 9. AuditEvent (Avro — references User)
    {
        "artifactId": "com.event7.AuditEvent",
        "artifactType": "AVRO",
        "content": {
            "type": "record",
            "name": "AuditEvent",
            "namespace": "com.event7",
            "fields": [
                {"name": "event_id", "type": "string"},
                {"name": "actor_id", "type": "string"},
                {"name": "action", "type": "string"},
                {"name": "resource_type", "type": "string"},
                {"name": "resource_id", "type": "string"},
                {"name": "details", "type": ["null", "string"], "default": None},
                {"name": "timestamp", "type": {"type": "long", "logicalType": "timestamp-millis"}},
            ],
        },
        "references": [
            {"groupId": GROUP, "artifactId": "com.event7.User", "version": "1", "name": "com.event7.User"},
        ],
    },
]


# ── Compatibility rules (aligned with data layers) ──

COMPATIBILITY_RULES = {
    # Global default — safety net for any new artifact
    "__global__": "BACKWARD",
    # CORE layer — canonical model, never break
    "com.event7.Address": "FULL_TRANSITIVE",
    "com.event7.User": "FULL_TRANSITIVE",
    "com.event7.Customer": "FULL_TRANSITIVE",
    "com.event7.Order": "FULL_TRANSITIVE",
    # REFINED layer — aggregations, strict backward compat
    "com.event7.Shipment": "BACKWARD_TRANSITIVE",
    "com.event7.Invoice": "BACKWARD_TRANSITIVE",
    # RAW layer — raw data, basic backward compat (inherits global)
    # "com.event7.Payment": uses global BACKWARD
    # APPLICATION layer — consumption views (inherits global)
    # "com.event7.Notification": uses global BACKWARD
    # "com.event7.AuditEvent": uses global BACKWARD
}


# ── Helpers ──

def wait_for_apicurio(base_url: str, timeout: int = 60):
    """Wait until Apicurio is ready."""
    print(f"Waiting for Apicurio at {base_url}...", end="", flush=True)
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(f"{base_url}{BASE_PATH}/system/info", timeout=3)
            if r.status_code == 200:
                print(f" ready ({r.json().get('name', 'Apicurio')} {r.json().get('version', '')})")
                return True
        except requests.ConnectionError:
            pass
        print(".", end="", flush=True)
        time.sleep(2)
    print(" TIMEOUT")
    return False


def delete_artifact(base_url: str, artifact_id: str):
    """Delete an artifact (ignores 404/405)."""
    url = f"{base_url}{BASE_PATH}/groups/{GROUP}/artifacts/{artifact_id}"
    r = requests.delete(url)
    if r.status_code == 204:
        print(f"  Deleted {artifact_id}")
    elif r.status_code == 404:
        pass  # doesn't exist
    elif r.status_code == 405:
        print(f"  Warning: deletion not enabled for {artifact_id}")


def create_artifact(base_url: str, schema: dict) -> bool:
    """Create an artifact with optional references."""
    artifact_id = schema["artifactId"]
    content_str = json.dumps(schema["content"])
    refs = schema.get("references", [])
    is_version_only = schema.get("version_only", False)

    content_block = {
        "content": content_str,
        "contentType": "application/json",
    }
    if refs:
        content_block["references"] = refs

    if is_version_only:
        url = f"{base_url}{BASE_PATH}/groups/{GROUP}/artifacts/{artifact_id}/versions"
        payload = {"content": content_block}
    else:
        url = f"{base_url}{BASE_PATH}/groups/{GROUP}/artifacts"
        payload = {
            "artifactId": artifact_id,
            "artifactType": schema["artifactType"],
            "firstVersion": {
                "version": "1",
                "content": content_block,
            },
        }

    r = requests.post(url, json=payload, headers={"Content-Type": "application/json"})

    if r.status_code in (200, 201):
        refs_label = f" (refs: {len(refs)})" if refs else ""
        label = "v2" if is_version_only else "new"
        print(f"  ✓ {artifact_id} [{label}]{refs_label}")
        return True
    elif r.status_code == 409:
        print(f"  · {artifact_id} already exists, skipping")
        return True
    else:
        print(f"  ✗ {artifact_id} — {r.status_code}: {r.text[:200]}")
        return False


def set_compatibility(base_url: str, artifact_id: str, mode: str) -> bool:
    """Set compatibility rule on an artifact or globally.

    Apicurio has TWO rule systems:
      - Native v3 API: /apis/registry/v3/.../rules (used by get_compatibility)
      - Ccompat API:   /api/ccompat/v7/config     (used by check_compatibility)
    We must configure BOTH for full coverage.
    """
    label = "GLOBAL" if artifact_id == "__global__" else artifact_id
    headers = {"Content-Type": "application/json"}
    ok_v3 = False
    ok_ccompat = False

    # ── 1. Native v3 API (for event7 get_compatibility reading) ──
    if artifact_id == "__global__":
        base_v3 = f"{base_url}{BASE_PATH}/admin/rules"
    else:
        base_v3 = f"{base_url}{BASE_PATH}/groups/{GROUP}/artifacts/{artifact_id}/rules"

    # Try PUT first (update existing), fallback POST (create)
    r = requests.put(f"{base_v3}/COMPATIBILITY", json={"config": mode}, headers=headers)
    if r.status_code in (200, 204):
        ok_v3 = True
    elif r.status_code == 404:
        r2 = requests.post(base_v3, json={"ruleType": "COMPATIBILITY", "config": mode}, headers=headers)
        ok_v3 = r2.status_code in (200, 201, 204)

    # ── 2. Ccompat API (for check_compatibility endpoint) ──
    if artifact_id == "__global__":
        ccompat_url = f"{base_url}/apis/ccompat/v7/config"
    else:
        ccompat_url = f"{base_url}/apis/ccompat/v7/config/{artifact_id}"

    r = requests.put(ccompat_url, json={"compatibility": mode}, headers=headers)
    ok_ccompat = r.status_code in (200, 204)

    if ok_v3 and ok_ccompat:
        print(f"  ✓ {label} → {mode}")
        return True
    elif ok_v3 or ok_ccompat:
        parts = []
        if ok_v3:
            parts.append("v3")
        if ok_ccompat:
            parts.append("ccompat")
        print(f"  ~ {label} → {mode} (partial: {'+'.join(parts)} only)")
        return True
    else:
        print(f"  ✗ {label} — failed on both v3 and ccompat APIs")
        return False


# ── Main ──

def main():
    parser = argparse.ArgumentParser(description="Seed Apicurio with test schemas")
    parser.add_argument("--url", default=DEFAULT_URL, help=f"Apicurio URL (default: {DEFAULT_URL})")
    parser.add_argument("--clean", action="store_true", help="Delete existing schemas before seeding")
    parser.add_argument("--skip-compat", action="store_true", help="Skip compatibility rules configuration")
    args = parser.parse_args()

    if not wait_for_apicurio(args.url):
        print("Apicurio not available, aborting.")
        sys.exit(1)

    if args.clean:
        print("\nCleaning existing schemas...")
        for schema in reversed(SCHEMAS):
            if not schema.get("version_only"):
                delete_artifact(args.url, schema["artifactId"])

    print("\nSeeding schemas...")
    success = 0
    for schema in SCHEMAS:
        if create_artifact(args.url, schema):
            success += 1

    # Verify references
    print("\nVerifying references...")
    test_cases = [
        ("com.event7.Customer", 1),
        ("com.event7.Order", 1),
        ("com.event7.Shipment", 2),
        ("com.event7.Invoice", 2),
        ("com.event7.AuditEvent", 1),
    ]
    for artifact_id, expected_refs in test_cases:
        url = f"{args.url}{BASE_PATH}/groups/{GROUP}/artifacts/{artifact_id}/versions/1/references"
        r = requests.get(url)
        if r.status_code == 200:
            actual = len(r.json()) if isinstance(r.json(), list) else 0
            status = "✓" if actual == expected_refs else "✗"
            print(f"  {status} {artifact_id}: {actual}/{expected_refs} refs")
        else:
            print(f"  ✗ {artifact_id}: HTTP {r.status_code}")

    # Configure compatibility rules
    if not args.skip_compat:
        print("\nConfiguring compatibility rules...")
        compat_ok = 0

        # Global default first
        if set_compatibility(args.url, "__global__", COMPATIBILITY_RULES["__global__"]):
            compat_ok += 1

        # Per-artifact overrides
        for artifact_id, mode in COMPATIBILITY_RULES.items():
            if artifact_id == "__global__":
                continue
            if set_compatibility(args.url, artifact_id, mode):
                compat_ok += 1

        print(f"  → {compat_ok}/{len(COMPATIBILITY_RULES)} compatibility rules configured")

        # Verify compatibility modes
        print("\nVerifying compatibility modes...")
        all_subjects = [s["artifactId"] for s in SCHEMAS if not s.get("version_only")]
        for artifact_id in all_subjects:
            url = f"{args.url}{BASE_PATH}/groups/{GROUP}/artifacts/{artifact_id}/rules/COMPATIBILITY"
            r = requests.get(url)
            if r.status_code == 200:
                actual = r.json().get("config", "???")
                expected = COMPATIBILITY_RULES.get(artifact_id)
                if expected:
                    status = "✓" if actual == expected else "✗"
                    print(f"  {status} {artifact_id}: {actual}")
                else:
                    print(f"  · {artifact_id}: {actual} (inherits global)")
            elif r.status_code == 404:
                print(f"  · {artifact_id}: inherits global (BACKWARD)")
            else:
                print(f"  ✗ {artifact_id}: HTTP {r.status_code}")

        # Verify global
        url = f"{args.url}{BASE_PATH}/admin/rules/COMPATIBILITY"
        r = requests.get(url)
        if r.status_code == 200:
            print(f"  ✓ GLOBAL: {r.json().get('config', '???')}")
        else:
            print(f"  ✗ GLOBAL: HTTP {r.status_code}")

    # Summary
    print(f"\nDone: {success}/{len(SCHEMAS)} schemas created")
    print(f"\nReference graph:")
    print(f"  Address ← Customer ← Invoice")
    print(f"    ↑                    ↑")
    print(f"    └── Shipment         │")
    print(f"          ↑              │")
    print(f"  User ← Order ──────────┘")
    print(f"    ↑")
    print(f"    └── AuditEvent")

    if not args.skip_compat:
        print(f"\nCompatibility rules:")
        print(f"  GLOBAL default:  BACKWARD")
        print(f"  CORE layer:      FULL_TRANSITIVE (Address, User, Customer, Order)")
        print(f"  REFINED layer:   BACKWARD_TRANSITIVE (Shipment, Invoice)")
        print(f"  RAW/APP layer:   BACKWARD (Payment, Notification, AuditEvent — inherits global)")

    print(f"\nView in event7: http://localhost:3000")
    print(f"View in Apicurio: http://localhost:8081")


if __name__ == "__main__":
    main()