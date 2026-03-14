"""
event7 — AsyncAPI Overview Models
Pydantic v2 models for the dual-mode AsyncAPI overview.

Placement: backend/app/models/asyncapi_overview.py

Key design decisions:
  - origin and status are SEPARATED (not mixed)
  - origin  = provenance / ownership   → "imported" | "generated" | null
  - status  = documentation coverage   → "documented" | "ready" | "raw"
  - sync_status prepared but not computed yet (Phase 4)
  - "ready" = at least one enrichment (description) OR one channel binding
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# ════════════════════════════════════════════════════════════════════
# Per-subject status
# ════════════════════════════════════════════════════════════════════

class SubjectAsyncAPIStatus(BaseModel):
    """Status of a single subject in the AsyncAPI overview."""

    subject: str

    # ── Origin / Status (separated) ──
    origin: Literal["imported", "generated"] | None = None
    status: Literal["documented", "ready", "raw"] = "raw"
    sync_status: Literal["in_sync", "outdated", "unknown"] | None = None  # Phase 4

    # ── Spec metadata (when documented) ──
    asyncapi_version: str | None = None
    spec_title: str | None = None
    spec_updated_at: str | None = None

    # ── Governance ──
    governance_score: int | None = None
    governance_grade: str | None = None
    spec_version: int | None = None
    # ── Enrichment / Channel flags ──
    has_enrichment: bool = False
    has_description: bool = False
    has_channels: bool = False
    has_bindings: bool = False

    # ── Display helpers ──
    description: str | None = None
    owner_team: str | None = None
    data_layer: str | None = None


# ════════════════════════════════════════════════════════════════════
# Aggregated KPIs
# ════════════════════════════════════════════════════════════════════

class AsyncAPIOverviewKPIs(BaseModel):
    """Top-level KPIs for the AsyncAPI overview page."""

    total_subjects: int = 0
    documented: int = 0          # origin = imported | generated
    ready: int = 0               # status = ready (enriched, no spec yet)
    raw: int = 0                 # status = raw (nothing)
    imported: int = 0            # origin = imported
    generated: int = 0           # origin = generated
    coverage_pct: float = 0.0    # documented / total * 100


# ════════════════════════════════════════════════════════════════════
# Overview response
# ════════════════════════════════════════════════════════════════════

class AsyncAPIOverviewResponse(BaseModel):
    """Full response for GET /asyncapi/overview."""

    kpis: AsyncAPIOverviewKPIs
    subjects: list[SubjectAsyncAPIStatus] = Field(default_factory=list)