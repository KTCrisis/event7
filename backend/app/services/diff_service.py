"""
event7 - Schema Diff Service
Diff field-level entre deux versions de schemas.
Supporte Avro et JSON Schema.
"""

from app.models.schema import (
    SchemaDiff,
    FieldDiff,
    DiffChangeType,
    SchemaFormat,
)


def compute_schema_diff(
    subject: str,
    version_from: int,
    version_to: int,
    schema_from: dict,
    schema_to: dict,
    schema_format: SchemaFormat,
) -> SchemaDiff:
    """Point d'entrée pour le diff entre deux schemas"""
    if schema_format == SchemaFormat.AVRO:
        changes = _diff_avro(schema_from, schema_to)
    elif schema_format == SchemaFormat.JSON_SCHEMA:
        changes = _diff_json_schema(schema_from, schema_to)
    else:
        changes = _diff_generic(schema_from, schema_to)

    is_breaking = any(
        c.change_type == DiffChangeType.REMOVED
        or (c.change_type == DiffChangeType.MODIFIED and "type changed" in (c.details or ""))
        for c in changes
    )

    added = sum(1 for c in changes if c.change_type == DiffChangeType.ADDED)
    removed = sum(1 for c in changes if c.change_type == DiffChangeType.REMOVED)
    modified = sum(1 for c in changes if c.change_type == DiffChangeType.MODIFIED)

    parts = []
    if added:
        parts.append(f"{added} added")
    if removed:
        parts.append(f"{removed} removed")
    if modified:
        parts.append(f"{modified} modified")
    summary = ", ".join(parts) if parts else "No changes"

    return SchemaDiff(
        subject=subject,
        version_from=version_from,
        version_to=version_to,
        format=schema_format,
        changes=changes,
        is_breaking=is_breaking,
        summary=summary,
    )


# === Avro Diff ===


def _diff_avro(schema_from: dict, schema_to: dict, path: str = "") -> list[FieldDiff]:
    """Diff field-level pour Avro (records, enums, arrays)"""
    changes = []

    # Compare top-level properties (name, namespace, doc)
    for prop in ("name", "namespace", "doc"):
        old_val = schema_from.get(prop)
        new_val = schema_to.get(prop)
        if old_val != new_val:
            changes.append(FieldDiff(
                field_path=f"{path}{prop}" if path else prop,
                change_type=DiffChangeType.MODIFIED,
                old_value=old_val,
                new_value=new_val,
                details=f"{prop} changed",
            ))

    # Compare fields (for records)
    if schema_from.get("type") == "record" and schema_to.get("type") == "record":
        changes.extend(_diff_avro_fields(
            schema_from.get("fields", []),
            schema_to.get("fields", []),
            path,
        ))
    # Compare symbols (for enums)
    elif schema_from.get("type") == "enum" and schema_to.get("type") == "enum":
        changes.extend(_diff_enum_symbols(
            schema_from.get("symbols", []),
            schema_to.get("symbols", []),
            path,
        ))
    # Type changed entirely
    elif schema_from.get("type") != schema_to.get("type"):
        changes.append(FieldDiff(
            field_path=path or "type",
            change_type=DiffChangeType.MODIFIED,
            old_value=schema_from.get("type"),
            new_value=schema_to.get("type"),
            details="type changed",
        ))

    return changes


def _diff_avro_fields(
    fields_from: list[dict], fields_to: list[dict], parent_path: str
) -> list[FieldDiff]:
    """Compare les champs d'un record Avro"""
    changes = []
    prefix = f"{parent_path}." if parent_path else ""

    from_map = {f["name"]: f for f in fields_from}
    to_map = {f["name"]: f for f in fields_to}

    from_names = set(from_map.keys())
    to_names = set(to_map.keys())

    # Champs ajoutés
    for name in to_names - from_names:
        field = to_map[name]
        has_default = "default" in field
        changes.append(FieldDiff(
            field_path=f"{prefix}{name}",
            change_type=DiffChangeType.ADDED,
            new_value=_summarize_type(field.get("type")),
            details=f"added with default={field['default']}" if has_default else "added (no default - breaking)",
        ))

    # Champs supprimés
    for name in from_names - to_names:
        field = from_map[name]
        changes.append(FieldDiff(
            field_path=f"{prefix}{name}",
            change_type=DiffChangeType.REMOVED,
            old_value=_summarize_type(field.get("type")),
            details="field removed",
        ))

    # Champs modifiés
    for name in from_names & to_names:
        old_field = from_map[name]
        new_field = to_map[name]
        field_path = f"{prefix}{name}"

        # Type change
        old_type = _summarize_type(old_field.get("type"))
        new_type = _summarize_type(new_field.get("type"))
        if old_type != new_type:
            changes.append(FieldDiff(
                field_path=field_path,
                change_type=DiffChangeType.MODIFIED,
                old_value=old_type,
                new_value=new_type,
                details="type changed",
            ))

        # Default value change
        old_default = old_field.get("default", "__MISSING__")
        new_default = new_field.get("default", "__MISSING__")
        if old_default != new_default:
            changes.append(FieldDiff(
                field_path=f"{field_path}.default",
                change_type=DiffChangeType.MODIFIED,
                old_value=None if old_default == "__MISSING__" else old_default,
                new_value=None if new_default == "__MISSING__" else new_default,
                details="default value changed",
            ))

        # Doc change
        if old_field.get("doc") != new_field.get("doc"):
            changes.append(FieldDiff(
                field_path=f"{field_path}.doc",
                change_type=DiffChangeType.MODIFIED,
                old_value=old_field.get("doc"),
                new_value=new_field.get("doc"),
                details="documentation changed",
            ))

        # Recurse into nested records
        old_inner = _unwrap_type(old_field.get("type"))
        new_inner = _unwrap_type(new_field.get("type"))
        if isinstance(old_inner, dict) and isinstance(new_inner, dict):
            if old_inner.get("type") == "record" and new_inner.get("type") == "record":
                changes.extend(_diff_avro(old_inner, new_inner, field_path))

    return changes


def _diff_enum_symbols(
    symbols_from: list[str], symbols_to: list[str], parent_path: str
) -> list[FieldDiff]:
    """Compare les symboles d'un enum Avro"""
    changes = []
    prefix = f"{parent_path}.symbols" if parent_path else "symbols"

    from_set = set(symbols_from)
    to_set = set(symbols_to)

    for sym in to_set - from_set:
        changes.append(FieldDiff(
            field_path=prefix,
            change_type=DiffChangeType.ADDED,
            new_value=sym,
            details=f"enum symbol '{sym}' added",
        ))

    for sym in from_set - to_set:
        changes.append(FieldDiff(
            field_path=prefix,
            change_type=DiffChangeType.REMOVED,
            old_value=sym,
            details=f"enum symbol '{sym}' removed",
        ))

    return changes


# === JSON Schema Diff ===


def _diff_json_schema(schema_from: dict, schema_to: dict, path: str = "") -> list[FieldDiff]:
    """Diff pour JSON Schema (properties, required, $ref)"""
    changes = []
    prefix = f"{path}." if path else ""

    # Compare properties
    props_from = schema_from.get("properties", {})
    props_to = schema_to.get("properties", {})

    for name in set(props_to) - set(props_from):
        changes.append(FieldDiff(
            field_path=f"{prefix}{name}",
            change_type=DiffChangeType.ADDED,
            new_value=props_to[name].get("type", "unknown"),
            details="property added",
        ))

    for name in set(props_from) - set(props_to):
        changes.append(FieldDiff(
            field_path=f"{prefix}{name}",
            change_type=DiffChangeType.REMOVED,
            old_value=props_from[name].get("type", "unknown"),
            details="property removed",
        ))

    for name in set(props_from) & set(props_to):
        old_prop = props_from[name]
        new_prop = props_to[name]
        if old_prop != new_prop:
            old_type = old_prop.get("type", old_prop.get("$ref", "unknown"))
            new_type = new_prop.get("type", new_prop.get("$ref", "unknown"))
            changes.append(FieldDiff(
                field_path=f"{prefix}{name}",
                change_type=DiffChangeType.MODIFIED,
                old_value=str(old_type),
                new_value=str(new_type),
                details="property changed",
            ))
            # Recurse into nested objects
            if old_prop.get("type") == "object" and new_prop.get("type") == "object":
                changes.extend(_diff_json_schema(old_prop, new_prop, f"{prefix}{name}"))

    # Compare required
    req_from = set(schema_from.get("required", []))
    req_to = set(schema_to.get("required", []))

    for field in req_to - req_from:
        changes.append(FieldDiff(
            field_path=f"{prefix}{field}",
            change_type=DiffChangeType.MODIFIED,
            details="field became required (breaking)",
        ))

    for field in req_from - req_to:
        changes.append(FieldDiff(
            field_path=f"{prefix}{field}",
            change_type=DiffChangeType.MODIFIED,
            details="field no longer required",
        ))

    return changes


# === Generic Diff (fallback) ===


def _diff_generic(schema_from: dict, schema_to: dict) -> list[FieldDiff]:
    """Diff basique clé par clé pour les formats non supportés"""
    changes = []

    all_keys = set(schema_from.keys()) | set(schema_to.keys())
    for key in all_keys:
        old_val = schema_from.get(key)
        new_val = schema_to.get(key)
        if old_val is None and new_val is not None:
            changes.append(FieldDiff(field_path=key, change_type=DiffChangeType.ADDED, new_value=str(new_val)))
        elif old_val is not None and new_val is None:
            changes.append(FieldDiff(field_path=key, change_type=DiffChangeType.REMOVED, old_value=str(old_val)))
        elif old_val != new_val:
            changes.append(FieldDiff(field_path=key, change_type=DiffChangeType.MODIFIED, old_value=str(old_val), new_value=str(new_val)))

    return changes


# === Helpers ===


def _summarize_type(avro_type) -> str:
    """Résume un type Avro en string lisible"""
    if isinstance(avro_type, str):
        return avro_type
    if isinstance(avro_type, list):
        return " | ".join(_summarize_type(t) for t in avro_type)
    if isinstance(avro_type, dict):
        t = avro_type.get("type", "unknown")
        if t == "array":
            items = _summarize_type(avro_type.get("items", "unknown"))
            return f"array<{items}>"
        if t == "map":
            values = _summarize_type(avro_type.get("values", "unknown"))
            return f"map<{values}>"
        if t == "record":
            return avro_type.get("name", "record")
        if t == "enum":
            return avro_type.get("name", "enum")
        return t
    return str(avro_type)


def _unwrap_type(avro_type):
    """Unwrap un union pour trouver le type non-null"""
    if isinstance(avro_type, list):
        non_null = [t for t in avro_type if t != "null"]
        return non_null[0] if len(non_null) == 1 else avro_type
    return avro_type
