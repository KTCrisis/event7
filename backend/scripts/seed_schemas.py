"""
event7 — Seed Test Schemas (Confluent SR)
Pushes a realistic dataset into a Confluent Schema Registry.

Aligned with seed_apicurio.py — same 9 subjects, same namespaces,
same references, same schema evolution. This allows seed_event7.py
to work identically regardless of the provider.

Subjects:
  1. com.event7.Address      (Avro, 2 versions, referenced by Customer + Shipment)
  2. com.event7.User         (Avro, 2 versions, referenced by Order + AuditEvent)
  3. com.event7.Customer     (Avro, 1 version, refs Address)
  4. com.event7.Order        (Avro, 1 version, refs User)
  5. com.event7.Shipment     (Avro, 1 version, refs Address + Order)
  6. com.event7.Invoice      (Avro, 1 version, refs Customer + Order)
  7. com.event7.Payment      (JSON Schema, 1 version)
  8. com.event7.Notification (Avro, 1 version)
  9. com.event7.AuditEvent   (Avro, 1 version, refs User)

Reference graph:
  Address <-- Customer <-- Invoice
    ^                        ^
    +-- Shipment             |
          ^                  |
  User <-- Order ------------+
    ^
    +-- AuditEvent

Usage:
  python scripts/seed_schemas.py

Requires .env with:
  CONFLUENT_SR_URL=https://psrc-xxxxx.region.confluent.cloud
  CONFLUENT_SR_API_KEY=...
  CONFLUENT_SR_API_SECRET=...
"""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from dotenv import load_dotenv

load_dotenv()


# ================================================================
# AVRO SCHEMAS
# ================================================================

# --- Address (CORE, shared) ---

ADDRESS_V1 = {
    "type": "record",
    "name": "Address",
    "namespace": "com.event7",
    "doc": "Canonical address type shared across all domains",
    "fields": [
        {"name": "street", "type": "string", "doc": "Street address"},
        {"name": "city", "type": "string", "doc": "City"},
        {"name": "zip", "type": "string", "doc": "ZIP/postal code"},
        {"name": "country", "type": "string", "doc": "Country code"},
    ],
}

ADDRESS_V2 = {
    "type": "record",
    "name": "Address",
    "namespace": "com.event7",
    "doc": "Canonical address type shared across all domains",
    "fields": [
        {"name": "street", "type": "string", "doc": "Street address"},
        {"name": "city", "type": "string", "doc": "City"},
        {"name": "zip", "type": "string", "doc": "ZIP/postal code"},
        {"name": "country", "type": "string", "doc": "Country code"},
        {"name": "region", "type": ["null", "string"], "default": None, "doc": "Region or state"},
    ],
}

# --- User (CORE, identity) ---

USER_V1 = {
    "type": "record",
    "name": "User",
    "namespace": "com.event7",
    "doc": "Core user identity with role-based access",
    "fields": [
        {"name": "id", "type": "string", "doc": "User UUID"},
        {"name": "email", "type": "string", "doc": "Email address (PII)"},
        {"name": "name", "type": "string", "doc": "Full name (PII)"},
        {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}, "doc": "Registration timestamp"},
    ],
}

USER_V2 = {
    "type": "record",
    "name": "User",
    "namespace": "com.event7",
    "doc": "Core user identity with role-based access",
    "fields": [
        {"name": "id", "type": "string", "doc": "User UUID"},
        {"name": "email", "type": "string", "doc": "Email address (PII)"},
        {"name": "name", "type": "string", "doc": "Full name (PII)"},
        {
            "name": "role",
            "type": {
                "type": "enum",
                "name": "UserRole",
                "symbols": ["USER", "ADMIN", "MODERATOR"],
            },
            "default": "USER",
            "doc": "User role",
        },
        {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}, "doc": "Registration timestamp"},
    ],
}

# --- Customer (CORE, refs Address) ---

CUSTOMER_V1 = {
    "type": "record",
    "name": "Customer",
    "namespace": "com.event7",
    "doc": "Customer profile with billing and shipping addresses",
    "fields": [
        {"name": "id", "type": "string", "doc": "Customer UUID"},
        {"name": "name", "type": "string", "doc": "Full name"},
        {"name": "email", "type": "string", "doc": "Contact email (PII)"},
        {"name": "billing_address", "type": "com.event7.Address", "doc": "Billing address"},
        {"name": "shipping_address", "type": ["null", "com.event7.Address"], "default": None, "doc": "Shipping address"},
    ],
}

# --- Order (CORE, refs User) ---

ORDER_V1 = {
    "type": "record",
    "name": "Order",
    "namespace": "com.event7",
    "doc": "Order placed by a user. Triggers downstream flows.",
    "fields": [
        {"name": "order_id", "type": "string", "doc": "Order UUID"},
        {"name": "user_id", "type": "string", "doc": "FK to User"},
        {"name": "amount", "type": "double", "doc": "Total amount"},
        {"name": "currency", "type": "string", "doc": "Currency code"},
        {
            "name": "status",
            "type": {
                "type": "enum",
                "name": "OrderStatus",
                "symbols": ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
            },
            "doc": "Order lifecycle status",
        },
        {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}, "doc": "Order timestamp"},
    ],
}

# --- Shipment (REFINED, refs Address + Order) ---

SHIPMENT_V1 = {
    "type": "record",
    "name": "Shipment",
    "namespace": "com.event7",
    "doc": "Shipment tracking for an Order",
    "fields": [
        {"name": "shipment_id", "type": "string", "doc": "Shipment UUID"},
        {"name": "order_id", "type": "string", "doc": "FK to Order"},
        {"name": "destination", "type": "com.event7.Address", "doc": "Delivery address"},
        {"name": "carrier", "type": "string", "doc": "Carrier name"},
        {"name": "tracking_number", "type": ["null", "string"], "default": None, "doc": "Tracking number"},
        {
            "name": "status",
            "type": {
                "type": "enum",
                "name": "ShipmentStatus",
                "symbols": ["PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED"],
            },
            "doc": "Shipment status",
        },
    ],
}

# --- Invoice (REFINED, refs Customer + Order) ---

INVOICE_V1 = {
    "type": "record",
    "name": "Invoice",
    "namespace": "com.event7",
    "doc": "Invoice generated from an Order",
    "fields": [
        {"name": "invoice_id", "type": "string", "doc": "Invoice UUID"},
        {"name": "order_id", "type": "string", "doc": "FK to Order"},
        {"name": "customer_id", "type": "string", "doc": "FK to Customer"},
        {"name": "total", "type": "double", "doc": "Invoice total"},
        {"name": "currency", "type": "string", "doc": "Currency code"},
        {"name": "issued_at", "type": {"type": "long", "logicalType": "timestamp-millis"}, "doc": "Issue timestamp"},
    ],
}

# --- Notification (APPLICATION) ---

NOTIFICATION_V1 = {
    "type": "record",
    "name": "Notification",
    "namespace": "com.event7",
    "doc": "Multi-channel notification (EMAIL, SMS, PUSH)",
    "fields": [
        {"name": "id", "type": "string", "doc": "Notification UUID"},
        {"name": "user_id", "type": "string", "doc": "Target user"},
        {
            "name": "channel",
            "type": {
                "type": "enum",
                "name": "Channel",
                "symbols": ["EMAIL", "SMS", "PUSH"],
            },
            "doc": "Delivery channel",
        },
        {"name": "title", "type": "string", "doc": "Notification title"},
        {"name": "body", "type": "string", "doc": "Notification body"},
        {"name": "sent_at", "type": ["null", {"type": "long", "logicalType": "timestamp-millis"}], "default": None, "doc": "Send timestamp"},
    ],
}

# --- AuditEvent (RAW, refs User) ---

AUDIT_EVENT_V1 = {
    "type": "record",
    "name": "AuditEvent",
    "namespace": "com.event7",
    "doc": "Immutable audit trail entry for compliance",
    "fields": [
        {"name": "event_id", "type": "string", "doc": "Event UUID"},
        {"name": "actor_id", "type": "string", "doc": "User who performed the action"},
        {"name": "action", "type": "string", "doc": "Action performed"},
        {"name": "resource_type", "type": "string", "doc": "Target resource type"},
        {"name": "resource_id", "type": "string", "doc": "Target resource ID"},
        {"name": "details", "type": ["null", "string"], "default": None, "doc": "Additional details"},
        {"name": "timestamp", "type": {"type": "long", "logicalType": "timestamp-millis"}, "doc": "Event timestamp"},
    ],
}


# ================================================================
# JSON SCHEMA
# ================================================================

PAYMENT_V1 = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "title": "Payment",
    "description": "Payment transaction linked to an Order",
    "properties": {
        "payment_id": {"type": "string", "description": "Payment UUID"},
        "order_id": {"type": "string", "description": "FK to Order"},
        "amount": {"type": "number", "description": "Payment amount"},
        "method": {"type": "string", "enum": ["card", "bank_transfer", "paypal"], "description": "Payment method"},
        "status": {"type": "string", "enum": ["pending", "completed", "failed"], "description": "Payment status"},
        "processed_at": {"type": "string", "format": "date-time", "description": "Processing timestamp"},
    },
    "required": ["payment_id", "order_id", "amount", "method"],
}


# ================================================================
# SEED SEQUENCE
# ================================================================

# (subject, schema, schema_type, references)
# References use version -1 = resolve to latest at seed time
SCHEMAS_TO_SEED = [
    # 1. Address — 2 versions (CORE, shared base)
    ("com.event7.Address", ADDRESS_V1, "AVRO", []),
    ("com.event7.Address", ADDRESS_V2, "AVRO", []),

    # 2. User — 2 versions (CORE, identity)
    ("com.event7.User", USER_V1, "AVRO", []),
    ("com.event7.User", USER_V2, "AVRO", []),

    # 3. Customer — refs Address (CORE)
    ("com.event7.Customer", CUSTOMER_V1, "AVRO", [
        {"name": "com.event7.Address", "subject": "com.event7.Address", "version": -1},
    ]),

    # 4. Order — refs User (CORE)
    ("com.event7.Order", ORDER_V1, "AVRO", [
        {"name": "com.event7.User", "subject": "com.event7.User", "version": -1},
    ]),

    # 5. Shipment — refs Address + Order (REFINED)
    ("com.event7.Shipment", SHIPMENT_V1, "AVRO", [
        {"name": "com.event7.Address", "subject": "com.event7.Address", "version": -1},
        {"name": "com.event7.Order", "subject": "com.event7.Order", "version": -1},
    ]),

    # 6. Invoice — refs Customer + Order (REFINED)
    ("com.event7.Invoice", INVOICE_V1, "AVRO", [
        {"name": "com.event7.Customer", "subject": "com.event7.Customer", "version": -1},
        {"name": "com.event7.Order", "subject": "com.event7.Order", "version": -1},
    ]),

    # 7. Payment — JSON Schema (RAW)
    ("com.event7.Payment", PAYMENT_V1, "JSON", []),

    # 8. Notification — no refs (APPLICATION)
    ("com.event7.Notification", NOTIFICATION_V1, "AVRO", []),

    # 9. AuditEvent — refs User (RAW)
    ("com.event7.AuditEvent", AUDIT_EVENT_V1, "AVRO", [
        {"name": "com.event7.User", "subject": "com.event7.User", "version": -1},
    ]),
]

# Compatibility rules aligned with data layers
COMPATIBILITY_RULES = {
    # Global default
    "__global__": "BACKWARD",
    # CORE — canonical model, never break
    "com.event7.Address": "FULL_TRANSITIVE",
    "com.event7.User": "FULL_TRANSITIVE",
    "com.event7.Customer": "FULL_TRANSITIVE",
    "com.event7.Order": "FULL_TRANSITIVE",
    # REFINED — aggregations, strict backward
    "com.event7.Shipment": "BACKWARD_TRANSITIVE",
    "com.event7.Invoice": "BACKWARD_TRANSITIVE",
    # RAW + APPLICATION — inherits global BACKWARD
}


# ================================================================
# SEED LOGIC
# ================================================================

async def seed():
    url = os.getenv("CONFLUENT_SR_URL")
    key = os.getenv("CONFLUENT_SR_API_KEY")
    secret = os.getenv("CONFLUENT_SR_API_SECRET")

    if not url:
        print("CONFLUENT_SR_URL not set in .env")
        print("Required: CONFLUENT_SR_URL, CONFLUENT_SR_API_KEY, CONFLUENT_SR_API_SECRET")
        return

    print(f"Seeding schemas into {url}\n")

    async with httpx.AsyncClient(
        base_url=url,
        auth=(key, secret),
        headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        timeout=30.0,
    ) as client:
        # Set global compatibility to NONE for easy seeding
        print("Setting global compatibility to NONE (for seeding)...")
        await client.put("/config", json={"compatibility": "NONE"})

        current_subject = None
        version_counter = 0

        for subject, schema, schema_type, references in SCHEMAS_TO_SEED:
            if subject != current_subject:
                current_subject = subject
                version_counter = 1
                print(f"\n  {subject}")
            else:
                version_counter += 1

            payload = {
                "schema": json.dumps(schema),
                "schemaType": schema_type,
            }

            if references:
                resolved_refs = []
                for ref in references:
                    ref_version = ref["version"]
                    if ref_version == -1:
                        resp = await client.get(f"/subjects/{ref['subject']}/versions/latest")
                        ref_version = resp.json()["version"] if resp.status_code == 200 else 1
                    resolved_refs.append({
                        "name": ref["name"],
                        "subject": ref["subject"],
                        "version": ref_version,
                    })
                payload["references"] = resolved_refs

            response = await client.post(f"/subjects/{subject}/versions", json=payload)

            if response.status_code == 200:
                schema_id = response.json().get("id")
                refs_label = f" (refs: {len(references)})" if references else ""
                print(f"    v{version_counter} registered (id={schema_id}) [{schema_type}]{refs_label}")
            else:
                error = response.json() if response.content else {}
                print(f"    v{version_counter} FAILED: {error.get('message', response.status_code)}")

        # Set compatibility rules per subject
        print("\n\nConfiguring compatibility rules...")
        for subject, mode in COMPATIBILITY_RULES.items():
            if subject == "__global__":
                resp = await client.put("/config", json={"compatibility": mode})
                label = "GLOBAL"
            else:
                resp = await client.put(f"/config/{subject}", json={"compatibility": mode})
                label = subject
            if resp.status_code == 200:
                print(f"    {label} -> {mode}")
            else:
                print(f"    {label} FAILED: {resp.status_code}")

        # Summary
        resp = await client.get("/subjects")
        subjects = resp.json() if resp.status_code == 200 else []
        print(f"\nDone! {len(subjects)} subjects in registry:")
        for s in sorted(subjects):
            resp = await client.get(f"/subjects/{s}/versions")
            versions = resp.json() if resp.status_code == 200 else []
            resp_c = await client.get(f"/config/{s}")
            compat = resp_c.json().get("compatibilityLevel", "inherits global") if resp_c.status_code == 200 else "inherits global"
            print(f"    {s} ({len(versions)} versions, {compat})")

        print(f"\nReference graph:")
        print(f"  Address <-- Customer <-- Invoice")
        print(f"    ^                        ^")
        print(f"    +-- Shipment             |")
        print(f"          ^                  |")
        print(f"  User <-- Order ------------+")
        print(f"    ^")
        print(f"    +-- AuditEvent")
        print(f"\nCompatibility rules:")
        print(f"  GLOBAL:   BACKWARD")
        print(f"  CORE:     FULL_TRANSITIVE (Address, User, Customer, Order)")
        print(f"  REFINED:  BACKWARD_TRANSITIVE (Shipment, Invoice)")
        print(f"  RAW/APP:  BACKWARD (Payment, Notification, AuditEvent)")
        print(f"\nNext: create a registry in event7 Settings, then run:")
        print(f"  python scripts/seed_event7.py")


if __name__ == "__main__":
    asyncio.run(seed())
