"""
event7 - Schema Service
Orchestre le provider (live), le cache (Redis), et les enrichissements (Supabase).
Les routes API délèguent ici toute la logique métier.
"""

from loguru import logger

from app.cache.redis_cache import RedisCache
from app.db.base import DatabaseProvider
from app.models.schema import SubjectInfo, SchemaDetail, SchemaVersion, SchemaDiff, SchemaReference
from app.models.governance import (
    CatalogEntry,
    CompatibilityMode,
    CompatibilityResult,
    Enrichment,
    EnrichmentUpdate,
)
from app.providers.base import SchemaRegistryProvider


class SchemaService:
    """
    Couche métier principale.
    Flow: Route → Service → Provider (live) + Cache (Redis) + DB 
    """

    CACHE_TTL = 300  # 5 min

    def __init__(
        self,
        provider: SchemaRegistryProvider,
        cache: RedisCache,
        db: DatabaseProvider,
        registry_id: str,
    ):
        self.provider = provider
        self.cache = cache
        self.db = db
        self.registry_id = registry_id

    def _key(self, *parts: str) -> str:
        return self.cache.cache_key(self.registry_id, *parts)

    # === Subjects ===

    async def list_subjects(self, enriched: bool = True) -> list[SubjectInfo]:
        """Liste les subjects avec cache + enrichissements optionnels"""
        cache_key = self._key("subjects", "enriched" if enriched else "raw")
        cached = await self.cache.get(cache_key)
        if cached:
            return [SubjectInfo(**s) for s in cached]

        subjects = await self.provider.list_subjects()

        if enriched:
            for subject in subjects:
                enrichment = self.db.get_enrichment(self.registry_id, subject.subject)
                if enrichment:
                    subject.description = enrichment.get("description")
                    subject.owner_team = enrichment.get("owner_team")
                    subject.tags = enrichment.get("tags", [])
                    subject.data_layer = enrichment.get("data_layer")
        await self.cache.set(cache_key, [s.model_dump() for s in subjects], self.CACHE_TTL)
        return subjects

    # === Schema Detail ===

    async def get_schema(self, subject: str, version: int | str = "latest") -> SchemaDetail:
        cache_key = self._key("schema", subject, str(version))
        cached = await self.cache.get(cache_key)
        if cached:
            return SchemaDetail(**cached)

        schema = await self.provider.get_schema(subject, version)
        await self.cache.set(cache_key, schema.model_dump(), self.CACHE_TTL)
        return schema

    # === Versions ===

    async def get_versions(self, subject: str) -> list[int]:
        cache_key = self._key("versions", subject)
        cached = await self.cache.get(cache_key)
        if cached:
            return cached

        versions = await self.provider.get_subject_versions(subject)
        await self.cache.set(cache_key, versions, self.CACHE_TTL)
        return versions

    async def get_versions_detail(self, subject: str) -> list[SchemaVersion]:
        """Toutes les versions avec contenu (plus coûteux)"""
        cache_key = self._key("versions_detail", subject)
        cached = await self.cache.get(cache_key)
        if cached:
            return [SchemaVersion(**v) for v in cached]

        versions = await self.provider.get_versions(subject)
        await self.cache.set(cache_key, [v.model_dump() for v in versions], self.CACHE_TTL)
        return versions

    # === CRUD ===

    async def create_schema(
        self, subject: str, schema: dict, schema_type: str = "AVRO"
    ) -> SchemaDetail:
        result = await self.provider.create_schema(subject, schema)
        # Invalidate cache
        await self.cache.delete_pattern(self._key("*"))
        return result

    async def delete_subject(self, subject: str, permanent: bool = False) -> bool:
        result = await self.provider.delete_subject(subject, permanent)
        if result:
            await self.cache.delete_pattern(self._key("*"))
        return result

    # === Diff ===

    async def diff_versions(self, subject: str, v1: int, v2: int) -> SchemaDiff:
        cache_key = self._key("diff", subject, f"{v1}-{v2}")
        cached = await self.cache.get(cache_key)
        if cached:
            return SchemaDiff(**cached)

        diff = await self.provider.diff_versions(subject, v1, v2)
        await self.cache.set(cache_key, diff.model_dump(), self.CACHE_TTL)
        return diff

    # === References ===

    async def get_references(self, subject: str) -> list[SchemaReference]:
        cache_key = self._key("refs", subject)
        cached = await self.cache.get(cache_key)
        if cached:
            return [SchemaReference(**r) for r in cached]

        refs = await self.provider.get_references(subject)
        await self.cache.set(cache_key, [r.model_dump() for r in refs], self.CACHE_TTL)
        return refs

    async def get_dependents(self, subject: str) -> list[SchemaReference]:
        cache_key = self._key("dependents", subject)
        cached = await self.cache.get(cache_key)
        if cached:
            return [SchemaReference(**r) for r in cached]

        deps = await self.provider.get_dependents(subject)
        await self.cache.set(cache_key, [r.model_dump() for r in deps], self.CACHE_TTL)
        return deps

    # === Compatibility ===

    async def get_compatibility(self, subject: str) -> CompatibilityMode:
        return await self.provider.get_compatibility(subject)

    async def check_compatibility(self, subject: str, schema: dict) -> CompatibilityResult:
        return await self.provider.check_compatibility(subject, schema)

    # === Enrichments ===

    def get_enrichment(self, subject: str) -> Enrichment | None:
        data = self.db.get_enrichment(self.registry_id, subject)
        if data:
            return Enrichment(**data)
        return None

    def update_enrichment(self, subject: str, update: EnrichmentUpdate) -> Enrichment:
        payload = {
            "registry_id": self.registry_id,
            "subject": subject,
        }
        if update.description is not None:
            payload["description"] = update.description
        if update.owner_team is not None:
            payload["owner_team"] = update.owner_team
        if update.tags is not None:
            payload["tags"] = update.tags
        if update.classification is not None:
            payload["classification"] = update.classification.value
        if update.data_layer is not None:
            payload["data_layer"] = update.data_layer.value
        data = self.db.upsert_enrichment(payload)

        # Invalidate cached views that embed enrichment data
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.cache.delete(self._key("catalog")))
            loop.create_task(self.cache.delete(self._key("subjects", "enriched")))
        except RuntimeError:
            pass  # No running loop (e.g. tests) — cache will expire via TTL

        return Enrichment(**data)

    # === Catalog (vue business) ===

    async def get_catalog(self) -> list[CatalogEntry]:
        """Catalogue enrichi = subjects + enrichments + channels + metadata"""
        subjects = await self.list_subjects(enriched=True)

        # Single query: subject → [broker_types]
        channel_map = self.db.get_subject_channel_map(self.registry_id)

        # Enrichments with updated_at (batch fetch)
        enrichments_raw = self.db.get_enrichments_for_registry(self.registry_id)
        enrichment_dates = {
            e["subject"]: e.get("updated_at")
            for e in enrichments_raw
        }

        catalog = []
        for s in subjects:
            refs = await self.get_references(s.subject)
            brokers = channel_map.get(s.subject, [])
            catalog.append(CatalogEntry(
                subject=s.subject,
                format=s.format.value,
                latest_version=s.latest_version,
                version_count=s.version_count,
                description=s.description,
                owner_team=s.owner_team,
                tags=s.tags,
                data_layer=s.data_layer,
                reference_count=len(refs),
                broker_types=brokers,
                channel_count=len(brokers),
                updated_at=enrichment_dates.get(s.subject),
            ))

        return catalog