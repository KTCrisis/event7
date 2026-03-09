"""
event7 - Seed Test Schemas
Pousse un jeu de données réaliste dans un SR Confluent vide.
Inclut : versions multiples, références, Avro + JSON Schema.

Lance avec: python scripts/seed_schemas.py
"""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from dotenv import load_dotenv

load_dotenv()


# === Schemas Avro ===

# Shared schema (sera référencé par d'autres)
ADDRESS_V1 = {
    "type": "record",
    "name": "Address",
    "namespace": "com.event7.common",
    "doc": "Shared address schema",
    "fields": [
        {"name": "street", "type": "string", "doc": "Street address"},
        {"name": "city", "type": "string"},
        {"name": "zip_code", "type": "string"},
        {"name": "country", "type": "string", "default": "FR"},
    ],
}

ADDRESS_V2 = {
    "type": "record",
    "name": "Address",
    "namespace": "com.event7.common",
    "doc": "Shared address schema with region",
    "fields": [
        {"name": "street", "type": "string", "doc": "Street address"},
        {"name": "city", "type": "string"},
        {"name": "zip_code", "type": "string"},
        {"name": "country", "type": "string", "default": "FR"},
        {"name": "region", "type": ["null", "string"], "default": None, "doc": "Region or state"},
    ],
}

# Customer schema v1
CUSTOMER_V1 = {
    "type": "record",
    "name": "CustomerCreated",
    "namespace": "com.event7.customers",
    "doc": "Event emitted when a new customer is created",
    "fields": [
        {"name": "customer_id", "type": "string", "doc": "Unique customer identifier"},
        {"name": "email", "type": "string", "doc": "Customer email (PII)"},
        {"name": "first_name", "type": "string"},
        {"name": "last_name", "type": "string"},
        {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    ],
}

# Customer schema v2 — added phone + status
CUSTOMER_V2 = {
    "type": "record",
    "name": "CustomerCreated",
    "namespace": "com.event7.customers",
    "doc": "Event emitted when a new customer is created",
    "fields": [
        {"name": "customer_id", "type": "string", "doc": "Unique customer identifier"},
        {"name": "email", "type": "string", "doc": "Customer email (PII)"},
        {"name": "first_name", "type": "string"},
        {"name": "last_name", "type": "string"},
        {"name": "phone", "type": ["null", "string"], "default": None, "doc": "Phone number (PII)"},
        {
            "name": "status",
            "type": {
                "type": "enum",
                "name": "CustomerStatus",
                "symbols": ["ACTIVE", "INACTIVE", "SUSPENDED"],
            },
            "default": "ACTIVE",
        },
        {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    ],
}

# Customer v3 — added loyalty_tier
CUSTOMER_V3 = {
    "type": "record",
    "name": "CustomerCreated",
    "namespace": "com.event7.customers",
    "doc": "Event emitted when a new customer is created",
    "fields": [
        {"name": "customer_id", "type": "string", "doc": "Unique customer identifier"},
        {"name": "email", "type": "string", "doc": "Customer email (PII)"},
        {"name": "first_name", "type": "string"},
        {"name": "last_name", "type": "string"},
        {"name": "phone", "type": ["null", "string"], "default": None, "doc": "Phone number (PII)"},
        {
            "name": "status",
            "type": {
                "type": "enum",
                "name": "CustomerStatus",
                "symbols": ["ACTIVE", "INACTIVE", "SUSPENDED"],
            },
            "default": "ACTIVE",
        },
        {
            "name": "loyalty_tier",
            "type": ["null", "string"],
            "default": None,
            "doc": "Loyalty program tier (BRONZE, SILVER, GOLD, PLATINUM)",
        },
        {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    ],
}

# Order schema — references Address
ORDER_V1 = {
    "type": "record",
    "name": "OrderPlaced",
    "namespace": "com.event7.orders",
    "doc": "Event emitted when an order is placed",
    "fields": [
        {"name": "order_id", "type": "string"},
        {"name": "customer_id", "type": "string", "doc": "FK to customer"},
        {
            "name": "items",
            "type": {
                "type": "array",
                "items": {
                    "type": "record",
                    "name": "OrderItem",
                    "fields": [
                        {"name": "product_id", "type": "string"},
                        {"name": "product_name", "type": "string"},
                        {"name": "quantity", "type": "int"},
                        {"name": "unit_price", "type": {"type": "bytes", "logicalType": "decimal", "precision": 10, "scale": 2}},
                    ],
                },
            },
        },
        {"name": "total_amount", "type": {"type": "bytes", "logicalType": "decimal", "precision": 12, "scale": 2}},
        {"name": "currency", "type": "string", "default": "EUR"},
        {"name": "placed_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    ],
}

# Order v2 — added discount + delivery_type
ORDER_V2 = {
    "type": "record",
    "name": "OrderPlaced",
    "namespace": "com.event7.orders",
    "doc": "Event emitted when an order is placed",
    "fields": [
        {"name": "order_id", "type": "string"},
        {"name": "customer_id", "type": "string", "doc": "FK to customer"},
        {
            "name": "items",
            "type": {
                "type": "array",
                "items": {
                    "type": "record",
                    "name": "OrderItem",
                    "fields": [
                        {"name": "product_id", "type": "string"},
                        {"name": "product_name", "type": "string"},
                        {"name": "quantity", "type": "int"},
                        {"name": "unit_price", "type": {"type": "bytes", "logicalType": "decimal", "precision": 10, "scale": 2}},
                    ],
                },
            },
        },
        {"name": "total_amount", "type": {"type": "bytes", "logicalType": "decimal", "precision": 12, "scale": 2}},
        {"name": "discount_percent", "type": ["null", "float"], "default": None, "doc": "Discount applied"},
        {"name": "currency", "type": "string", "default": "EUR"},
        {
            "name": "delivery_type",
            "type": {
                "type": "enum",
                "name": "DeliveryType",
                "symbols": ["STANDARD", "EXPRESS", "PICKUP"],
            },
            "default": "STANDARD",
        },
        {"name": "placed_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    ],
}

# Payment schema
PAYMENT_V1 = {
    "type": "record",
    "name": "PaymentProcessed",
    "namespace": "com.event7.payments",
    "doc": "Event emitted when a payment is processed",
    "fields": [
        {"name": "payment_id", "type": "string"},
        {"name": "order_id", "type": "string", "doc": "FK to order"},
        {"name": "customer_id", "type": "string", "doc": "FK to customer"},
        {"name": "amount", "type": {"type": "bytes", "logicalType": "decimal", "precision": 12, "scale": 2}},
        {"name": "currency", "type": "string", "default": "EUR"},
        {
            "name": "method",
            "type": {
                "type": "enum",
                "name": "PaymentMethod",
                "symbols": ["CARD", "BANK_TRANSFER", "PAYPAL", "APPLE_PAY"],
            },
        },
        {
            "name": "status",
            "type": {
                "type": "enum",
                "name": "PaymentStatus",
                "symbols": ["PENDING", "COMPLETED", "FAILED", "REFUNDED"],
            },
        },
        {"name": "processed_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    ],
}

# Inventory — simple schema
INVENTORY_V1 = {
    "type": "record",
    "name": "InventoryUpdated",
    "namespace": "com.event7.inventory",
    "doc": "Event emitted when inventory level changes",
    "fields": [
        {"name": "product_id", "type": "string"},
        {"name": "warehouse_id", "type": "string"},
        {"name": "quantity_available", "type": "int"},
        {"name": "quantity_reserved", "type": "int", "default": 0},
        {"name": "updated_at", "type": {"type": "long", "logicalType": "timestamp-millis"}},
    ],
}


# === JSON Schema ===

PRODUCT_CATALOG_V1 = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "ProductCatalogUpdated",
    "description": "Event emitted when product catalog is updated",
    "type": "object",
    "properties": {
        "product_id": {"type": "string", "description": "Unique product ID"},
        "name": {"type": "string"},
        "category": {"type": "string"},
        "price": {"type": "number", "minimum": 0},
        "currency": {"type": "string", "default": "EUR"},
        "in_stock": {"type": "boolean"},
    },
    "required": ["product_id", "name", "category", "price"],
}

PRODUCT_CATALOG_V2 = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "ProductCatalogUpdated",
    "description": "Event emitted when product catalog is updated",
    "type": "object",
    "properties": {
        "product_id": {"type": "string", "description": "Unique product ID"},
        "name": {"type": "string"},
        "category": {"type": "string"},
        "subcategory": {"type": "string", "description": "Product subcategory"},
        "price": {"type": "number", "minimum": 0},
        "currency": {"type": "string", "default": "EUR"},
        "in_stock": {"type": "boolean"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "weight_kg": {"type": "number", "description": "Product weight in kg"},
    },
    "required": ["product_id", "name", "category", "price"],
}

SHIPPING_NOTIFICATION_V1 = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "ShippingNotification",
    "description": "Event emitted when shipment status changes",
    "type": "object",
    "properties": {
        "shipment_id": {"type": "string"},
        "order_id": {"type": "string"},
        "carrier": {"type": "string", "enum": ["DHL", "UPS", "FEDEX", "COLISSIMO"]},
        "status": {"type": "string", "enum": ["PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED"]},
        "tracking_url": {"type": "string", "format": "uri"},
        "estimated_delivery": {"type": "string", "format": "date"},
    },
    "required": ["shipment_id", "order_id", "carrier", "status"],
}


# === Seed Logic ===

SCHEMAS_TO_SEED = [
    # (subject, schema, schema_type, references)
    # Address — 2 versions
    ("com.event7.common.Address", ADDRESS_V1, "AVRO", []),
    ("com.event7.common.Address", ADDRESS_V2, "AVRO", []),
    # Customer — 3 versions
    ("com.event7.customers.CustomerCreated-value", CUSTOMER_V1, "AVRO", []),
    ("com.event7.customers.CustomerCreated-value", CUSTOMER_V2, "AVRO", []),
    ("com.event7.customers.CustomerCreated-value", CUSTOMER_V3, "AVRO", []),
    # Order — 2 versions, references Address
    (
        "com.event7.orders.OrderPlaced-value",
        ORDER_V1,
        "AVRO",
        [{"name": "com.event7.common.Address", "subject": "com.event7.common.Address", "version": -1}],
    ),
    (
        "com.event7.orders.OrderPlaced-value",
        ORDER_V2,
        "AVRO",
        [{"name": "com.event7.common.Address", "subject": "com.event7.common.Address", "version": -1}],
    ),
    # Payment — 1 version
    ("com.event7.payments.PaymentProcessed-value", PAYMENT_V1, "AVRO", []),
    # Inventory — 1 version
    ("com.event7.inventory.InventoryUpdated-value", INVENTORY_V1, "AVRO", []),
    # Product Catalog (JSON Schema) — 2 versions
    ("com.event7.catalog.ProductCatalogUpdated-value", PRODUCT_CATALOG_V1, "JSON", []),
    ("com.event7.catalog.ProductCatalogUpdated-value", PRODUCT_CATALOG_V2, "JSON", []),
    # Shipping (JSON Schema) — 1 version
    ("com.event7.shipping.ShippingNotification-value", SHIPPING_NOTIFICATION_V1, "JSON", []),
]


async def seed():
    url = os.getenv("CONFLUENT_SR_URL")
    key = os.getenv("CONFLUENT_SR_API_KEY")
    secret = os.getenv("CONFLUENT_SR_API_SECRET")

    if not url:
        print("❌ CONFLUENT_SR_URL non configuré")
        return

    print(f"🌱 Seeding schemas into {url}\n")

    async with httpx.AsyncClient(
        base_url=url,
        auth=(key, secret),
        headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        timeout=30.0,
    ) as client:
        # Set global compatibility to NONE for easy seeding
        print("⚙️  Setting global compatibility to NONE (for seeding)...")
        await client.put("/config", json={"compatibility": "NONE"})

        current_subject = None
        version_counter = 0

        for subject, schema, schema_type, references in SCHEMAS_TO_SEED:
            if subject != current_subject:
                current_subject = subject
                version_counter = 1
                print(f"\n📋 {subject}")
            else:
                version_counter += 1

            payload = {
                "schema": json.dumps(schema),
                "schemaType": schema_type,
            }
            if references:
                # Resolve -1 to latest version
                resolved_refs = []
                for ref in references:
                    ref_version = ref["version"]
                    if ref_version == -1:
                        # Get latest version of referenced subject
                        resp = await client.get(f"/subjects/{ref['subject']}/versions/latest")
                        if resp.status_code == 200:
                            ref_version = resp.json()["version"]
                        else:
                            ref_version = 1
                    resolved_refs.append({
                        "name": ref["name"],
                        "subject": ref["subject"],
                        "version": ref_version,
                    })
                payload["references"] = resolved_refs

            response = await client.post(f"/subjects/{subject}/versions", json=payload)

            if response.status_code == 200:
                schema_id = response.json().get("id")
                print(f"   ✅ v{version_counter} registered (id={schema_id}) [{schema_type}]")
            else:
                error = response.json() if response.content else {}
                print(f"   ❌ v{version_counter} failed: {error.get('message', response.status_code)}")

        # Restore compatibility to BACKWARD
        print("\n⚙️  Restoring global compatibility to BACKWARD...")
        await client.put("/config", json={"compatibility": "BACKWARD"})

        # Summary
        resp = await client.get("/subjects")
        subjects = resp.json() if resp.status_code == 200 else []
        print(f"\n🎉 Done! {len(subjects)} subjects in registry:")
        for s in subjects:
            resp = await client.get(f"/subjects/{s}/versions")
            versions = resp.json() if resp.status_code == 200 else []
            print(f"   • {s} ({len(versions)} versions)")


if __name__ == "__main__":
    asyncio.run(seed())